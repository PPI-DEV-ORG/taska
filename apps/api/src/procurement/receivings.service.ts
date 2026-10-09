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
          warehouse: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
          receiver: { select: { id: true, name: true } },
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
    const po = await this.prisma.main.supplierPO.findUnique({
      where: { id: dto.supplierPoId },
      include: { items: true, project: true },
    });
    if (!po) throw new NotFoundException("PO supplier tidak ditemukan");
    if (po.status !== "DISETUJUI") throw new BadRequestException("PO harus disetujui sebelum penerimaan");

    const direct = !!po.projectId;
    if (direct && dto.warehouseId) {
      throw new BadRequestException("Pembelian langsung ke project tidak melewati gudang");
    }
    if (!direct) {
      if (!dto.warehouseId) throw new BadRequestException("Gudang penerima wajib dipilih");
      const warehouse = await this.prisma.main.warehouse.findUnique({ where: { id: dto.warehouseId } });
      if (!warehouse) throw new NotFoundException("Gudang tidak ditemukan");
      if (warehouse.status !== "AKTIF") throw new BadRequestException("Gudang tidak aktif");
    }
    if (!dto.receiptFileId) throw new BadRequestException("Bukti tanda terima wajib diunggah");

    const remainingFor: Record<number, number> = {};
    for (const item of dto.items) {
      const poItem = po.items.find((i) => i.productId === item.productId);
      if (!poItem) throw new BadRequestException(`Barang #${item.productId} tidak ada di PO`);
      if (item.qtyReceived <= 0) throw new BadRequestException("Qty diterima harus lebih dari 0");

      const others = await this.prisma.main.receivingItem.findMany({
        where: {
          productId: item.productId,
          receiving: { supplierPoId: po.id, status: { in: ["MENUNGGU", "DITERIMA_SEBAGIAN", "DITERIMA"] } },
        },
        select: { qtyReceived: true },
      });
      const already = others.reduce((s, o) => s + o.qtyReceived, 0);
      const remaining = poItem.qty - already;
      remainingFor[item.productId] = remaining;
      if (item.qtyReceived > remaining) {
        const product = await this.prisma.main.product.findUnique({ where: { id: item.productId } });
        throw new BadRequestException(
          `Qty ${product?.name} melebihi sisa PO (sisa ${Math.max(remaining, 0)}, diminta ${item.qtyReceived})`,
        );
      }

      const product = await this.prisma.main.product.findUnique({ where: { id: item.productId } });
      if (product?.hasSerial) {
        const serials = parseSerials(item.serials);
        if (serials.length !== item.qtyReceived) {
          throw new BadRequestException(`Barang ${product.name} ber-SN: isi ${item.qtyReceived} serial number`);
        }
        const dup = await this.prisma.main.serialUnit.findMany({ where: { sn: { in: serials } } });
        if (dup.length) {
          throw new BadRequestException(`Serial number sudah tercatat: ${dup.map((d) => d.sn).join(", ")}`);
        }
      }
    }

    const number = await this.docnum.next("penerimaan");
    const receiving = await this.prisma.main.receiving.create({
      data: {
        number,
        supplierPoId: po.id,
        warehouseId: direct ? null : dto.warehouseId,
        projectId: direct ? po.projectId : null,
        date: dto.date ? new Date(dto.date) : new Date(),
        receiverId: user.id,
        status: "MENUNGGU",
        conditionNote: dto.conditionNote,
        receiptFileId: dto.receiptFileId,
        photoFileId: dto.photoFileId,
        items: {
          create: dto.items.map((i) => ({
            productId: i.productId,
            qtyOrdered: remainingFor[i.productId] ?? 0,
            qtyReceived: i.qtyReceived,
            serials: i.serials ?? null,
            note: i.note,
          })),
        },
      },
      include: { items: true },
    });
    await this.attachFile(dto.receiptFileId, "receiving", receiving.id);
    if (dto.photoFileId) await this.attachFile(dto.photoFileId, "receiving-photo", receiving.id);

    await this.audit.log({
      actor: user,
      action: "BUAT_PENERIMAAN",
      entityType: "receiving",
      entityId: receiving.id,
      detail: `${number} — PO ${po.number} (${dto.items.length} item)`,
    });
    await this.approvals.request({
      kind: "PENERIMAAN",
      entityId: receiving.id,
      title: `Penerimaan barang ${number}`,
      amount: Number(po.total),
      requestedBy: user,
      href: `/receivings/${receiving.id}`,
      confirmRoles: [user.role as Role],
    });
    return receiving;
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

    for (const item of receiving.items) {
      const serials = parseSerials(item.serials ?? undefined);
      if (receiving.warehouseId) {
        if (item.product.hasSerial && serials.length) {
          for (const sn of serials) {
            const unit = await this.prisma.main.serialUnit.create({
              data: {
                sn,
                productId: item.productId,
                status: "DI_GUDANG",
                warehouseId: receiving.warehouseId,
                warrantyEndsAt: item.product.warrantyMonths
                  ? new Date(Date.now() + item.product.warrantyMonths * 30 * 24 * 3600 * 1000)
                  : null,
              },
            });
            await this.prisma.main.serialUnitHistory.create({
              data: { serialUnitId: unit.id, status: "DI_GUDANG", warehouseId: receiving.warehouseId, changedById: receiving.receiverId, note: `Penerimaan ${receiving.number}` },
            });
            await this.stock.applyMovement({
              date: receiving.date,
              type: "IN",
              category: "PENERIMAAN_SUPPLIER",
              productId: item.productId,
              toWarehouseId: receiving.warehouseId,
              qty: 1,
              receivingId: receiving.id,
              serialUnitId: unit.id,
              createdById: receiving.receiverId,
            });
          }
          const nonSerial = item.qtyReceived - serials.length;
          if (nonSerial > 0) {
            await this.stock.applyMovement({
              date: receiving.date,
              type: "IN",
              category: "PENERIMAAN_SUPPLIER",
              productId: item.productId,
              toWarehouseId: receiving.warehouseId,
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
            toWarehouseId: receiving.warehouseId,
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
        for (const sn of serials) {
          const unit = await this.prisma.main.serialUnit.create({
            data: {
              sn,
              productId: item.productId,
              status: "TERPASANG",
              projectId: receiving.projectId,
              warrantyEndsAt: item.product.warrantyMonths
                ? new Date(Date.now() + item.product.warrantyMonths * 30 * 24 * 3600 * 1000)
                : null,
            },
          });
          await this.prisma.main.serialUnitHistory.create({
            data: { serialUnitId: unit.id, status: "TERPASANG", projectId: receiving.projectId, changedById: receiving.receiverId, note: `Barang terpakai ${receiving.number}` },
          });
        }
      }
    }

    for (const item of receiving.items) {
      await this.prisma.main.supplierPOItem.updateMany({
        where: { poId: receiving.supplierPoId, productId: item.productId },
        data: { receivedQty: { increment: item.qtyReceived } },
      });
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
          await this.prisma.main.purchaseRequest.updateMany({
            where: { id: po.requestId, status: { in: ["PO_DIBUAT", "DISETUJUI", "DIKIRIM"] } },
            data: { status: "DITERIMA" },
          });
        }
        await this.notifications.notify({
          roles: ["PROCUREMENT"],
          kind: "STOK",
          text: `Semua barang PO ${po.number} sudah diterima — nyatakan siap ke PM`,
          href: `/procurement/po/${po.id}`,
        });
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
        poNumber: receiving.supplierPo.number,
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
