import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { DocumentNumberService } from "../document-number/document-number.service.js";
import { ApprovalsService } from "../approvals/approvals.service.js";
import { StockService } from "../stock/stock.service.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip } from "../common/utils/query.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import type { Role } from "../generated/prisma/client.js";
import { IssueDto, ReceivingDto, ReceivingListQuery } from "./dto.js";

function parseSerials(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

@Injectable()
export class ReceivingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly docnum: DocumentNumberService,
    private readonly approvals: ApprovalsService,
    private readonly stock: StockService,
  ) {
    this.approvals.onChange("PENERIMAAN", (entityId, status) => this.onApproval(entityId, status));
  }

  private async onApproval(entityId: number, status: "MENUNGGU" | "DISETUJUI" | "DITOLAK") {
    const receiving = await this.prisma.main.receiving.findUnique({ where: { id: entityId } });
    if (!receiving) return;
    if (status === "DISETUJUI") {
      await this.postStock(entityId);
    } else if (status === "DITOLAK") {
      await this.prisma.main.receiving.update({ where: { id: entityId }, data: { status: "DITOLAK" } });
      await this.notifications.notify({
        userIds: [receiving.receiverId],
        kind: "STOK",
        text: `Penerimaan ${receiving.number} ditolak`,
        href: `/receivings/${entityId}`,
      });
    }
  }

  private async attachFile(fileId: number, refType: string, refId: number) {
    await this.prisma.main.file.update({ where: { id: fileId }, data: { refType, refId: String(refId) } });
  }

  suggestNumber() {
    return this.docnum.suggest("penerimaan");
  }

  async list(q: ReceivingListQuery) {
    const where = {
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.supplierPoId ? { supplierPoId: q.supplierPoId } : {}),
      ...(q.warehouseId ? { warehouseId: q.warehouseId } : {}),
      ...(q.projectId ? { projectId: q.projectId } : {}),
      ...(q.q
        ? {
            OR: [
              { number: { contains: q.q } },
              { supplierName: { contains: q.q } },
              { supplierPo: { number: { contains: q.q } } },
              { supplierPo: { supplier: { name: { contains: q.q } } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.main.receiving.findMany({
        where,
        include: {
          supplierPo: { select: { id: true, number: true, shipmentStatus: true, supplier: { select: { name: true } } } },
          request: { select: { id: true, number: true, purpose: true, costType: true, procurementSource: true } },
          warehouse: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
          receiver: { select: { id: true, name: true } },
          items: { include: { product: { select: { id: true, sku: true, name: true, unit: true, hasSerial: true } } } },
          _count: { select: { items: true, issueReports: true } },
        },
        orderBy: orderBy(q.sort, q.dir, ["date", "createdAt"], "date"),
        ...pageSkip(q),
      }),
      this.prisma.main.receiving.count({ where }),
    ]);
    return paginate(items, total, q);
  }

  async get(id: number) {
    const row = await this.prisma.main.receiving.findUnique({
      where: { id },
      include: {
        supplierPo: {
          select: {
            id: true,
            number: true,
            status: true,
            shipmentStatus: true,
            supplier: { select: { id: true, name: true } },
          },
        },
        request: { select: { id: true, number: true, purpose: true, costType: true, procurementSource: true, requester: { select: { name: true } } } },
        warehouse: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        receiver: { select: { id: true, name: true, role: true } },
        items: { include: { product: { select: { id: true, sku: true, name: true, unit: true, hasSerial: true } } } },
        issueReports: { orderBy: { id: "desc" } },
      },
    });
    if (!row) throw new NotFoundException("Penerimaan tidak ditemukan");
    const approval = await this.approvals.getFor("PENERIMAAN", id);
    return { ...row, approval };
  }

  async create(dto: ReceivingDto, user: RequestUser) {
    const po = dto.supplierPoId
      ? await this.prisma.main.supplierPO.findUnique({
          where: { id: dto.supplierPoId },
          include: { items: true, project: true },
        })
      : null;

    const direct = po ? !!po.projectId && !dto.warehouseId : false;
    let warehouseId = direct ? null : dto.warehouseId ?? null;
    if (!direct && !warehouseId) {
      const firstWh = await this.prisma.main.warehouse.findFirst({ where: { status: "AKTIF" } });
      warehouseId = firstWh?.id ?? null;
    }

    const inputItems =
      dto.items && dto.items.length
        ? dto.items
        : po
        ? po.items
            .filter((pi): pi is typeof pi & { productId: number } => pi.productId != null)
            .map((pi) => ({
              productId: pi.productId,
              qtyReceived: Math.max(1, pi.qty - pi.receivedQty),
              serials: undefined as string | undefined,
              note: undefined as string | undefined,
            }))
        : [];

    const preparedItems: { productId: number; qtyOrdered: number; qtyReceived: number; serials: string | null; note?: string }[] = [];
    for (const item of inputItems) {
      if (!item.productId) continue;
      const poItem = po ? po.items.find((i) => i.productId === item.productId) : null;
      const qtyReceived = Math.max(1, item.qtyReceived || 1);
      const qtyOrdered = poItem ? Math.max(qtyReceived, poItem.qty - poItem.receivedQty) : qtyReceived;

      const product = await this.prisma.main.product.findUnique({ where: { id: item.productId } });
      let serialsList = parseSerials(item.serials);
      if (product?.hasSerial && serialsList.length < qtyReceived) {
        const needed = qtyReceived - serialsList.length;
        for (let k = 0; k < needed; k++) {
          serialsList.push(`SN-${item.productId}-${Date.now()}-${k + 1}`);
        }
      }
      preparedItems.push({
        productId: item.productId,
        qtyOrdered,
        qtyReceived,
        serials: serialsList.length ? serialsList.join(",") : null,
        note: item.note,
      });
    }

    const number = await this.docnum.next("penerimaan");
    const isDirectApproved = dto.status === "DITERIMA" || ["GUDANG", "SUPER_ADMIN", "ADMIN"].includes(user.role);
    const initialStatus = isDirectApproved ? "DITERIMA" : ((dto.status as any) ?? "MENUNGGU");

    if (initialStatus === "DITERIMA" && preparedItems.length) {
      await this.validateSerials(preparedItems);
    }

    const effectiveDoFileId = dto.receiptFileId ?? dto.photoFileId;

    const receiving = await this.prisma.main.receiving.create({
      data: {
        number,
        supplierPoId: po?.id ?? null,
        requestId: dto.requestId ?? null,
        supplierName: dto.supplierName || (po ? null : "Pemasok Langsung"),
        warehouseId,
        projectId: direct ? po!.projectId : null,
        date: dto.date ? new Date(dto.date) : new Date(),
        receiverId: user.id,
        status: initialStatus as any,
        conditionNote: dto.conditionNote,
        receiptFileId: effectiveDoFileId,
        photoFileId: dto.photoFileId ?? dto.receiptFileId,
        items: {
          create: preparedItems,
        },
      },
      include: {
        supplierPo: { select: { id: true, number: true, shipmentStatus: true, supplier: { select: { name: true } } } },
        warehouse: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        receiver: { select: { id: true, name: true } },
        items: true,
      },
    });
    if (effectiveDoFileId) await this.attachFile(effectiveDoFileId, "receiving", receiving.id).catch(() => {});
    if (dto.photoFileId) await this.attachFile(dto.photoFileId, "receiving-photo", receiving.id).catch(() => {});
    if (po?.id) {
      const poPatch: any = {};
      if (effectiveDoFileId) poPatch.doFileId = effectiveDoFileId;
      if (initialStatus === "DITERIMA") {
        poPatch.shipmentStatus = "SAMPAI";
        poPatch.arrivedAt = new Date();
      }
      if (Object.keys(poPatch).length > 0) {
        await this.prisma.main.supplierPO
          .update({
            where: { id: po.id },
            data: poPatch,
          })
          .catch(() => {});
        this.notifications.dataChange("supplier-pos", "update", po.id);
        this.notifications.dataChange("supplier-pos", "status", po.id);
      }
      if (po.requestId && initialStatus === "DITERIMA") {
        await this.prisma.main.purchaseRequest
          .updateMany({
            where: { id: po.requestId, status: { notIn: ["DIBATALKAN"] } },
            data: {
              status: "DITERIMA",
              ...(effectiveDoFileId ? { doFileId: effectiveDoFileId } : {}),
            },
          })
          .catch(() => {});
        this.notifications.dataChange("purchase-requests", "status", po.requestId);
      }
    }

    if (dto.requestId) {
      const prData: any = {};
      if (effectiveDoFileId) prData.doFileId = effectiveDoFileId;
      if (initialStatus === "DITERIMA") prData.status = "DITERIMA";
      if (Object.keys(prData).length > 0) {
        await this.prisma.main.purchaseRequest
          .update({
            where: { id: dto.requestId },
            data: prData,
          })
          .catch(() => {});
        this.notifications.dataChange("purchase-requests", "update", dto.requestId);
        this.notifications.dataChange("purchase-requests", "status", dto.requestId);
      }

      // Sinkronisasi status SAMPAI ke PO Supplier jika request barang ini memiliki PO terkait
      if (initialStatus === "DITERIMA") {
        await this.prisma.main.supplierPO
          .updateMany({
            where: { requestId: dto.requestId, shipmentStatus: { not: "SAMPAI" } },
            data: {
              shipmentStatus: "SAMPAI",
              arrivedAt: new Date(),
              ...(effectiveDoFileId ? { doFileId: effectiveDoFileId } : {}),
            },
          })
          .catch(() => {});
        const linkedPos = await this.prisma.main.supplierPO.findMany({
          where: { requestId: dto.requestId },
          select: { id: true },
        });
        for (const p of linkedPos) {
          this.notifications.dataChange("supplier-pos", "status", p.id);
          this.notifications.dataChange("supplier-pos", "update", p.id);
        }
      }
    }

    await this.audit.log({
      actor: user,
      action: "BUAT_PENERIMAAN",
      entityType: "receiving",
      entityId: receiving.id,
      detail: `${number} — ${po ? `PO ${po.number}` : (dto.supplierName || "Penerimaan Langsung")} (${preparedItems.length} item)`,
    });

    if (initialStatus === "DITERIMA") {
      await this.postStock(receiving.id);
    } else {
      await this.approvals.request({
        kind: "PENERIMAAN",
        entityId: receiving.id,
        title: `Penerimaan barang ${number}`,
        amount: po ? Number(po.total) : 0,
        requestedBy: user,
        href: `/receivings/${receiving.id}`,
        confirmRoles: [user.role as Role],
      });
    }

    this.notifications.dataChange("receiving", "create", receiving.id);
    return receiving;
  }

  async update(id: number, dto: ReceivingDto, user: RequestUser) {
    const row = await this.prisma.main.receiving.findUnique({ where: { id }, include: { items: true } });
    if (!row) throw new NotFoundException("Penerimaan tidak ditemukan");

    // Validasi serial number terlebih dahulu sebelum mengubah data apapun di DB
    const willBeReceived = (dto.status ?? row.status) === "DITERIMA";
    if (willBeReceived) {
      const itemsToValidate = dto.items && dto.items.length ? dto.items : row.items;
      await this.validateSerials(itemsToValidate, id);
    }

    let preparedItems: any[] | undefined = undefined;
    if (dto.items && dto.items.length) {
      preparedItems = [];
      for (const item of dto.items) {
        if (!item.productId) continue;
        const qtyReceived = Math.max(1, Number(item.qtyReceived) || 1);
        const qtyOrdered = Number(item.qtyOrdered) || qtyReceived;
        const serialsList = parseSerials(item.serials);
        preparedItems.push({
          productId: item.productId,
          qtyOrdered,
          qtyReceived,
          serials: serialsList.length ? serialsList.join(",") : null,
          note: item.note,
        });
      }
    }

    const updated = await this.prisma.main.receiving.update({
      where: { id },
      data: {
        ...(dto.supplierPoId !== undefined ? { supplierPoId: dto.supplierPoId } : {}),
        ...(dto.requestId !== undefined ? { requestId: dto.requestId } : {}),
        ...(dto.date ? { date: new Date(dto.date) } : {}),
        ...(dto.warehouseId !== undefined ? { warehouseId: dto.warehouseId } : {}),
        ...(dto.conditionNote !== undefined ? { conditionNote: dto.conditionNote } : {}),
        ...(dto.status ? { status: dto.status as any } : {}),
        ...(dto.receiptFileId !== undefined ? { receiptFileId: dto.receiptFileId } : {}),
        ...(dto.photoFileId !== undefined ? { photoFileId: dto.photoFileId } : {}),
        ...(preparedItems
          ? {
              items: {
                deleteMany: {},
                create: preparedItems,
              },
            }
          : {}),
      },
      include: {
        supplierPo: { select: { id: true, number: true, shipmentStatus: true, supplier: { select: { name: true } } } },
        request: { select: { id: true, number: true } },
        warehouse: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        receiver: { select: { id: true, name: true } },
        items: true,
      },
    });
    if (dto.receiptFileId) await this.attachFile(dto.receiptFileId, "receiving", updated.id).catch(() => {});
    if (dto.photoFileId) await this.attachFile(dto.photoFileId, "receiving-photo", updated.id).catch(() => {});
    const rawTargetPoId = dto.supplierPoId ?? updated.supplierPo?.id ?? row.supplierPoId;
    const targetPoId = rawTargetPoId != null ? Number(rawTargetPoId) : null;
    const syncedDoFileId = dto.receiptFileId ?? dto.photoFileId ?? updated.receiptFileId ?? updated.photoFileId;
    if (targetPoId && syncedDoFileId) {
      await this.prisma.main.supplierPO
        .update({
          where: { id: targetPoId },
          data: { doFileId: syncedDoFileId },
        })
        .catch(() => {});
      this.notifications.dataChange("supplier-pos", "update", targetPoId);
    }

    const rawTargetReqId = dto.requestId ?? (updated as any).request?.id ?? (updated as any).requestId ?? (row as any).requestId;
    const targetReqId = rawTargetReqId != null ? Number(rawTargetReqId) : null;
    if (targetReqId) {
      const prData: any = {};
      if (syncedDoFileId) prData.doFileId = syncedDoFileId;
      if (dto.status === "DITERIMA" || (updated.status as any) === "DITERIMA") {
        prData.status = "DITERIMA";
      }
      if (Object.keys(prData).length > 0) {
        await this.prisma.main.purchaseRequest
          .update({
            where: { id: targetReqId },
            data: prData,
          })
          .catch(() => {});
        this.notifications.dataChange("purchase-requests", "update", targetReqId);
      }
    }

    // Jika status diubah menjadi DITERIMA dan sebelumnya masih MENUNGGU atau stok belum tercatat, catat stok & serial unit
    const alreadyPosted = (await this.prisma.main.stockMovement.count({ where: { receivingId: id } })) > 0;
    if (dto.status === "DITERIMA" && (!alreadyPosted || row.status === "MENUNGGU")) {
      await this.postStock(id);
    }

    this.notifications.dataChange("receiving", "update", updated.id);
    return updated;
  }

  async setStatus(id: number, status: string, user: RequestUser) {
    const row = await this.prisma.main.receiving.findUnique({ where: { id }, include: { items: true } });
    if (!row) throw new NotFoundException("Penerimaan tidak ditemukan");
    if (status === "DITERIMA") {
      await this.validateSerials(row.items, id);
    }
    const alreadyPosted = (await this.prisma.main.stockMovement.count({ where: { receivingId: id } })) > 0;
    if (status === "DITERIMA" && (!alreadyPosted || row.status === "MENUNGGU")) {
      await this.postStock(id);
      return this.get(id);
    }
    const updated = await this.prisma.main.receiving.update({
      where: { id },
      data: { status: status as never },
      include: {
        supplierPo: { select: { id: true, number: true, shipmentStatus: true, supplier: { select: { name: true } } } },
        warehouse: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        receiver: { select: { id: true, name: true } },
      },
    });
    this.notifications.dataChange("receiving", "status", updated.id);
    return updated;
  }

  async remove(id: number, user: RequestUser) {
    const row = await this.prisma.main.receiving.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Penerimaan tidak ditemukan");
    await this.prisma.main.$transaction(async (tx) => {
      await tx.approval.deleteMany({ where: { kind: "PENERIMAAN", entityId: id } });
      await tx.issueReport.deleteMany({ where: { receivingId: id } });
      await tx.receivingItem.deleteMany({ where: { receivingId: id } });
      await tx.receiving.delete({ where: { id } });
    });
    await this.audit.log({
      actor: user,
      action: "HAPUS_PENERIMAAN",
      entityType: "receiving",
      entityId: id,
      detail: `${row.number} dihapus`,
    });
    this.notifications.dataChange("receiving", "delete", id);
    return { id, deleted: true };
  }

  private async validateSerials(
    items: { productId?: number; serials?: string | null; qtyReceived?: number }[],
    receivingId?: number,
  ) {
    const allSerials: string[] = [];
    for (const it of items) {
      if (!it.productId) continue;
      const parsed = parseSerials(it.serials ?? undefined);
      allSerials.push(...parsed);
    }

    if (allSerials.length === 0) return;

    // 1. Cek duplikat di dalam daftar payload input
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const sn of allSerials) {
      if (seen.has(sn)) dupes.add(sn);
      else seen.add(sn);
    }
    if (dupes.size > 0) {
      throw new BadRequestException(
        `Terdapat nomor serial duplikat dalam daftar input: ${Array.from(dupes).slice(0, 5).join(", ")}`,
      );
    }

    // 2. Cek apakah nomor serial sudah terdaftar di database
    const existing = await this.prisma.main.serialUnit.findMany({
      where: { sn: { in: allSerials } },
      select: { id: true, sn: true, status: true },
    });

    if (existing.length > 0) {
      let conflicting = existing;
      if (receivingId) {
        const movements = await this.prisma.main.stockMovement.findMany({
          where: {
            receivingId,
            serialUnitId: { in: existing.map((u) => u.id) },
          },
          select: { serialUnitId: true },
        });
        const processedIds = new Set(movements.map((m) => m.serialUnitId));
        conflicting = existing.filter((u) => !processedIds.has(u.id));
      }
      if (conflicting.length > 0) {
        throw new BadRequestException(
          `Nomor serial sudah terdaftar di sistem: ${conflicting.map((u) => u.sn).slice(0, 5).join(", ")}`,
        );
      }
    }
  }

  /** Setelah disetujui Gudang & Procurement: catat stok masuk (PRD #8). */
  private async postStock(id: number) {
    const receiving = await this.prisma.main.receiving.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        supplierPo: { include: { items: true } },
      },
    });
    if (!receiving) return;

    const effectiveWhId =
      receiving.warehouseId ??
      (await this.prisma.main.warehouse.findFirst({ where: { status: "AKTIF" } }))?.id ??
      (await this.prisma.main.warehouse.findFirst())?.id;

    for (const item of receiving.items) {
      const serials = parseSerials(item.serials ?? undefined);
      if (effectiveWhId) {
        if (item.product.hasSerial && serials.length) {
          const seen = new Set<string>();
          const dupesInList: string[] = [];
          for (const s of serials) {
            if (seen.has(s)) dupesInList.push(s);
            else seen.add(s);
          }
          if (dupesInList.length > 0) {
            throw new BadRequestException(
              `Terdapat nomor serial duplikat dalam daftar input: ${dupesInList.slice(0, 5).join(", ")}`,
            );
          }

          // Cek movement yang sudah pernah dipost untuk penerimaan ini
          const processedMovements = await this.prisma.main.stockMovement.findMany({
            where: { receivingId: receiving.id, productId: item.productId, serialUnitId: { not: null } },
            select: { serialUnitId: true },
          });
          const processedUnitIds = new Set(processedMovements.map((m) => m.serialUnitId));

          // Cek serial unit yang sudah ada di database
          const existingUnits = await this.prisma.main.serialUnit.findMany({
            where: { sn: { in: serials } },
            select: { id: true, sn: true, status: true },
          });
          const existingMap = new Map(existingUnits.map((u) => [u.sn, u]));

          // Pastikan serial yang sudah ada hanya yang sudah diproses pada penerimaan ini
          for (const u of existingUnits) {
            if (!processedUnitIds.has(u.id)) {
              throw new BadRequestException(
                `Serial number "${u.sn}" sudah terdaftar di sistem (Unit ID #${u.id}, Status: ${u.status}). Gunakan serial number yang unik.`,
              );
            }
          }

          // Bulk create serial unit baru yang belum ada di database
          const toCreateSns = serials.filter((sn) => !existingMap.has(sn));
          const warrantyEndsAt = item.product.warrantyMonths
            ? new Date(Date.now() + item.product.warrantyMonths * 30 * 24 * 3600 * 1000)
            : null;

          if (toCreateSns.length > 0) {
            const CHUNK_SIZE = 250;
            for (let i = 0; i < toCreateSns.length; i += CHUNK_SIZE) {
              const chunk = toCreateSns.slice(i, i + CHUNK_SIZE);
              await this.prisma.main.serialUnit.createMany({
                data: chunk.map((sn) => ({
                  sn,
                  productId: item.productId,
                  status: "DI_GUDANG" as const,
                  warehouseId: effectiveWhId,
                  warrantyEndsAt,
                })),
              });
            }
          }

          // Ambil semua unit record yang bersangkutan
          const allUnits = await this.prisma.main.serialUnit.findMany({
            where: { sn: { in: serials } },
            select: { id: true, sn: true },
          });
          const newUnitsToProcess = allUnits.filter((u) => !processedUnitIds.has(u.id));

          if (newUnitsToProcess.length > 0) {
            const CHUNK_SIZE = 250;

            // Batch insert history
            for (let i = 0; i < newUnitsToProcess.length; i += CHUNK_SIZE) {
              const chunk = newUnitsToProcess.slice(i, i + CHUNK_SIZE);
              await this.prisma.main.serialUnitHistory.createMany({
                data: chunk.map((u) => ({
                  serialUnitId: u.id,
                  status: "DI_GUDANG" as const,
                  warehouseId: effectiveWhId,
                  changedById: receiving.receiverId,
                  note: `Penerimaan ${receiving.number}`,
                })),
              });
            }

            // Batch insert stock movement per serial unit
            for (let i = 0; i < newUnitsToProcess.length; i += CHUNK_SIZE) {
              const chunk = newUnitsToProcess.slice(i, i + CHUNK_SIZE);
              await this.prisma.main.stockMovement.createMany({
                data: chunk.map((u) => ({
                  date: receiving.date,
                  type: "IN" as const,
                  category: "PENERIMAAN_SUPPLIER" as const,
                  productId: item.productId,
                  toWarehouseId: effectiveWhId,
                  qty: 1,
                  receivingId: receiving.id,
                  serialUnitId: u.id,
                  createdById: receiving.receiverId,
                })),
              });
            }

            // Update StockBalance sekaligus untuk seluruh batch unit ber-SN
            const currentBal = await this.stock.balanceOf(item.productId, effectiveWhId);
            await this.prisma.main.stockBalance.upsert({
              where: { productId_warehouseId: { productId: item.productId, warehouseId: effectiveWhId } },
              create: { productId: item.productId, warehouseId: effectiveWhId, qty: currentBal + newUnitsToProcess.length },
              update: { qty: { increment: newUnitsToProcess.length } },
            });
          }

          const nonSerial = item.qtyReceived - serials.length;
          if (nonSerial > 0) {
            await this.stock.applyMovement({
              date: receiving.date,
              type: "IN",
              category: "PENERIMAAN_SUPPLIER",
              productId: item.productId,
              toWarehouseId: effectiveWhId,
              qty: nonSerial,
              receivingId: receiving.id,
              createdById: receiving.receiverId,
            });
          }
        } else {
          await this.stock.applyMovement({
            date: receiving.date,
            type: "IN",
            category: "PENERIMAAN_SUPPLIER",
            productId: item.productId,
            toWarehouseId: effectiveWhId,
            qty: item.qtyReceived,
            receivingId: receiving.id,
            createdById: receiving.receiverId,
          });
        }
      } else if (receiving.projectId) {
        await this.stock.applyMovement({
          date: receiving.date,
          type: "OUT",
          category: "BARANG_TERPAKAI",
          productId: item.productId,
          qty: item.qtyReceived,
          projectId: receiving.projectId,
          receivingId: receiving.id,
          reason: `Pembelian langsung ${receiving.number}`,
          createdById: receiving.receiverId,
        });
        if (serials.length > 0) {
          const warrantyEndsAt = item.product.warrantyMonths
            ? new Date(Date.now() + item.product.warrantyMonths * 30 * 24 * 3600 * 1000)
            : null;
          const CHUNK_SIZE = 250;
          for (let i = 0; i < serials.length; i += CHUNK_SIZE) {
            const chunk = serials.slice(i, i + CHUNK_SIZE);
            await this.prisma.main.serialUnit.createMany({
              data: chunk.map((sn) => ({
                sn,
                productId: item.productId,
                status: "TERPASANG" as const,
                projectId: receiving.projectId,
                warrantyEndsAt,
              })),
            });
          }
          const createdUnits = await this.prisma.main.serialUnit.findMany({
            where: { sn: { in: serials } },
            select: { id: true },
          });
          for (let i = 0; i < createdUnits.length; i += CHUNK_SIZE) {
            const chunk = createdUnits.slice(i, i + CHUNK_SIZE);
            await this.prisma.main.serialUnitHistory.createMany({
              data: chunk.map((u) => ({
                serialUnitId: u.id,
                status: "TERPASANG" as const,
                projectId: receiving.projectId,
                changedById: receiving.receiverId,
                note: `Barang terpakai ${receiving.number}`,
              })),
            });
          }
        }
      }
    }

    if (receiving.supplierPoId) {
      for (const item of receiving.items) {
        await this.prisma.main.supplierPOItem.updateMany({
          where: { poId: receiving.supplierPoId, productId: item.productId },
          data: { receivedQty: { increment: item.qtyReceived } },
        });

        const poItem = receiving.supplierPo?.items?.find((p) => p.productId === item.productId);
        const poPrice = Number(poItem?.price ?? 0);
        if (poPrice > 0) {
          await this.prisma.main.product.update({
            where: { id: item.productId },
            data: { purchasePrice: poPrice },
          }).catch(() => {});
        }
      }

      const partial = receiving.items.some((i) => i.qtyReceived < i.qtyOrdered);
      await this.prisma.main.receiving.update({
        where: { id },
        data: { status: partial ? "DITERIMA_SEBAGIAN" : "DITERIMA" },
      });

      const po = await this.prisma.main.supplierPO.findUnique({
        where: { id: receiving.supplierPoId },
        include: { items: true, request: { select: { id: true, number: true, requesterId: true } } },
      });
      if (po) {
        const allReceived = po.items.every((i) => i.receivedQty >= i.qty);
        if (allReceived) {
          await this.prisma.main.supplierPO.update({
            where: { id: po.id },
            data: {
              shipmentStatus: "SAMPAI",
              arrivedAt: po.arrivedAt ?? new Date(),
            },
          });
          if (po.requestId) {
            const effectiveDo = receiving.receiptFileId ?? receiving.photoFileId;
            await this.prisma.main.purchaseRequest.updateMany({
              where: { id: po.requestId, status: { in: ["PO_DIBUAT", "DISETUJUI", "DIBAYAR", "DIKIRIM"] } },
              data: { status: "DITERIMA", ...(effectiveDo ? { doFileId: effectiveDo } : {}) },
            });
            this.notifications.dataChange("purchase-requests", "status", po.requestId);
          }
          await this.notifications.notify({
            roles: ["PROCUREMENT"],
            kind: "STOK",
            text: `Semua barang PO ${po.number} sudah diterima — nyatakan siap ke PM`,
            href: `/procurement/po/${po.id}`,
          });
          this.notifications.dataChange("supplier-pos", "status", po.id);
        }
      }
    } else {
      await this.prisma.main.receiving.update({
        where: { id },
        data: { status: "DITERIMA" },
      });
    }

    // Sinkronisasi status & DO File ke Purchase Request terkait (untuk penerimaan ritel / request langsung)
    const effectiveDoFile = receiving.receiptFileId ?? receiving.photoFileId;
    const reqIdsToNotify = new Set<number>();

    if (receiving.conditionNote) {
      const match = receiving.conditionNote.match(/Ref Request:\s*([^\s—]+)/);
      const reqNumber = match?.[1];
      if (reqNumber) {
        await this.prisma.main.purchaseRequest.updateMany({
          where: { number: reqNumber },
          data: {
            status: "DITERIMA",
            ...(effectiveDoFile ? { doFileId: effectiveDoFile } : {}),
          },
        });
        const matchedPr = await this.prisma.main.purchaseRequest.findFirst({ where: { number: reqNumber } });
        if (matchedPr) reqIdsToNotify.add(matchedPr.id);
      }
    }
    const directReqId = (receiving as any).requestId ?? (receiving as any).request?.id;
    if (directReqId) {
      await this.prisma.main.purchaseRequest.updateMany({
        where: { id: Number(directReqId) },
        data: {
          status: "DITERIMA",
          ...(effectiveDoFile ? { doFileId: effectiveDoFile } : {}),
        },
      });
      reqIdsToNotify.add(Number(directReqId));
    }

    for (const rId of reqIdsToNotify) {
      this.notifications.dataChange("purchase-requests", "update", rId);
      this.notifications.dataChange("purchase-requests", "status", rId);

      // Sinkronisasi status pengiriman SAMPAI ke PO Supplier yang terhubung ke Request ini
      try {
        await this.prisma.main.supplierPO.updateMany({
          where: { requestId: rId, shipmentStatus: { not: "SAMPAI" } },
          data: {
            shipmentStatus: "SAMPAI",
            arrivedAt: new Date(),
            ...(effectiveDoFile ? { doFileId: effectiveDoFile } : {}),
          },
        });
        const pos = await this.prisma.main.supplierPO.findMany({
          where: { requestId: rId },
          select: { id: true },
        });
        for (const p of pos) {
          this.notifications.dataChange("supplier-pos", "status", p.id);
          this.notifications.dataChange("supplier-pos", "update", p.id);
        }
      } catch (e) {
        console.warn(`Gagal sinkronisasi SAMPAI ke PO supplier dari request ${rId}:`, (e as Error).message);
      }
    }

    const receiver = await this.prisma.main.user.findUnique({ where: { id: receiving.receiverId } });
    await this.audit.log({
      actor: receiver as never,
      action: "TERIMA_BARANG",
      entityType: "receiving",
      entityId: id,
      detail: `${receiving.number} — stok tercatat`,
    });
    await this.notifications.notify({
      userIds: [receiving.receiverId],
      kind: "STOK",
      text: `Penerimaan ${receiving.number} disetujui dan stok sudah tercatat`,
      href: `/receivings/${id}`,
    });

    const projId = receiving.projectId ?? (receiving.supplierPoId ? (await this.prisma.main.supplierPO.findUnique({ where: { id: receiving.supplierPoId }, select: { projectId: true } }))?.projectId : null);
    if (projId) {
      const proj = await this.prisma.main.project.findUnique({
        where: { id: projId },
        select: { name: true, picId: true },
      });
      if (proj?.picId && proj.picId !== receiving.receiverId) {
        await this.notifications.notify({
          userIds: [proj.picId],
          kind: "STOK",
          text: `Barang pesanan proyek ${proj.name} telah tiba di gudang (${receiving.number})`,
          href: `/projects/${projId}`,
        });
      }
    }
    this.notifications.dataChange("receiving", "status", id);
    this.notifications.dataChange("stock", "update");
  }

  async reportIssue(id: number, dto: IssueDto, user: RequestUser) {
    const receiving = await this.prisma.main.receiving.findUnique({
      where: { id: dto.receivingId ?? id },
      include: { supplierPo: { select: { number: true } } },
    });
    if (!receiving) throw new NotFoundException("Penerimaan tidak ditemukan");

    const issue = await this.prisma.main.issueReport.create({
      data: {
        receivingId: receiving.id,
        poNumber: receiving.supplierPo?.number,
        productId: dto.productId,
        type: dto.type,
        qty: dto.qty ?? 1,
        description: dto.description,
        fileId: dto.fileId,
        reporterId: user.id,
        status: "DILAPORKAN",
      },
      include: { product: { select: { id: true, name: true } } },
    });
    if (dto.fileId) await this.attachFile(dto.fileId, "issue", issue.id);

    await this.audit.log({
      actor: user,
      action: "LAPOR_BARANG_BERMASALAH",
      entityType: "issue-report",
      entityId: issue.id,
      detail: `${dto.type} ×${dto.qty} — ${receiving.number}`,
    });
    await this.notifications.notify({
      roles: ["PROCUREMENT", "BOS", "FINANCE"],
      kind: "STOK",
      text: `Barang bermasalah (${dto.type}): ${dto.description}`,
      href: `/receivings/${receiving.id}`,
    });
    this.notifications.dataChange("issue-reports", "create", issue.id);
    return issue;
  }

  async listIssues(q: PageQuery & { status?: string }) {
    const where = {
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.q ? { OR: [{ description: { contains: q.q } }, { poNumber: { contains: q.q } }] } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.main.issueReport.findMany({
        where,
        include: {
          product: { select: { id: true, sku: true, name: true } },
          reporter: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
        ...pageSkip(q),
      }),
      this.prisma.main.issueReport.count({ where }),
    ]);
    return paginate(items, total, q);
  }
}
