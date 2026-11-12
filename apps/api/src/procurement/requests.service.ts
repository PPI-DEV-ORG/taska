import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { DocumentNumberService } from "../document-number/document-number.service.js";
import { ApprovalsService } from "../approvals/approvals.service.js";
import { StockService } from "../stock/stock.service.js";
import { PostingService } from "../accounting/posting.service.js";
import { MappingService } from "../accounting/mapping.service.js";
import { PostingRules } from "../accounting/posting.rules.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip } from "../common/utils/query.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { RequestDto, RequestListQuery, RequestStatusDto } from "./dto.js";
import {
  REQUEST_CREATOR_ROLES,
  assertPrEditable,
  assertPrTransition,
} from "./purchase-flow.js";

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly docnum: DocumentNumberService,
    private readonly approvals: ApprovalsService,
    private readonly stock: StockService,
    private readonly postingService: PostingService,
    private readonly mappingService: MappingService,
  ) {
    this.approvals.onChange("PURCHASE_REQUEST", (entityId, status) =>
      this.onApproval(entityId, status),
    );
  }

  private async onApproval(entityId: number, status: "MENUNGGU" | "DISETUJUI" | "DITOLAK") {
    const row = await this.prisma.main.purchaseRequest.findUnique({ where: { id: entityId } });
    if (!row) return;
    if (row.status !== "DIAJUKAN" && row.status !== "CEK_STOK") return;
    if (status === "DISETUJUI") {
      await this.prisma.main.purchaseRequest.update({
        where: { id: entityId },
        data: { status: "DISETUJUI" },
      });
      await this.syncConsumablesToProject(entityId);
    } else if (status === "DITOLAK") {
      await this.prisma.main.purchaseRequest.update({
        where: { id: entityId },
        data: { status: "DITOLAK" },
      });
    }
  }

  private scope(user: RequestUser) {
    if (["SUPER_ADMIN", "ADMIN", "BOS", "FINANCE", "PROCUREMENT", "GUDANG"].includes(user.role)) return {};
    if (user.role === "PM") {
      return {
        OR: [
          { requesterId: user.id },
          { project: { picId: user.id } },
          { project: { members: { some: { userId: user.id } } } },
        ],
      };
    }
    return { requesterId: user.id };
  }

  async list(q: RequestListQuery, user: RequestUser) {
    const where = {
      ...this.scope(user),
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.costType ? { costType: q.costType } : {}),
      ...(q.projectId ? { projectId: q.projectId } : {}),
      ...(q.requesterId ? { requesterId: q.requesterId } : {}),
      ...(q.from || q.to
        ? { date: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } }
        : {}),
      ...(q.q
        ? {
            OR: [
              { number: { contains: q.q } },
              { purpose: { contains: q.q } },
              { requester: { name: { contains: q.q } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.main.purchaseRequest.findMany({
        where,
        include: {
          requester: { select: { id: true, name: true, role: true } },
          project: { select: { id: true, name: true } },
          task: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          items: { include: { product: { select: { id: true, sku: true, name: true, unit: true, hasSerial: true } } } },
          supplierPOs: {
            select: {
              id: true,
              number: true,
              status: true,
              shipmentStatus: true,
              total: true,
              supplierId: true,
              supplier: { select: { id: true, name: true } },
            },
          },
          _count: { select: { supplierPOs: true } },
        },
        orderBy: orderBy(q.sort, q.dir, ["date", "createdAt"], "createdAt"),
        ...pageSkip(q),
      }),
      this.prisma.main.purchaseRequest.count({ where }),
    ]);
    return paginate(items, total, q);
  }

  async get(id: number, user: RequestUser) {
    const row = await this.prisma.main.purchaseRequest.findUnique({
      where: { id },
      include: {
        requester: { select: { id: true, name: true, role: true } },
        project: { select: { id: true, name: true, picId: true } },
        task: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, sku: true, name: true, unit: true } } } },
        supplierPOs: {
          select: {
            id: true,
            number: true,
            status: true,
            shipmentStatus: true,
            total: true,
            supplier: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException("Request tidak ditemukan");
    const [approval, evidenceFile, doFile, paymentProofFile, stock] = await Promise.all([
      this.approvals.getFor("PURCHASE_REQUEST", id),
      row.evidenceFileId
        ? this.prisma.main.file.findUnique({
            where: { id: row.evidenceFileId },
            select: { id: true, originalName: true, mimeType: true, size: true },
          })
        : Promise.resolve(null),
      this.resolveDoFile(id, (row as any).doFileId),
      this.resolvePaymentProofFile(id, (row as any).paymentProofFileId),
      Promise.all(
        row.items.map(async (i) => ({
          productId: i.productId,
          customName: (i as any).customName ?? null,
          customUnit: (i as any).customUnit ?? null,
          ordered: i.qty,
          available: i.productId ? await this.stock.totalAvailable(i.productId) : 0,
        })),
      ),
    ]);
    // Satu sumber: paymentStatus (status DIBAYAR selalu ikut menyetel paymentStatus).
    const isPaid = row.paymentStatus === "DIBAYAR" || (row.status as string) === "DIBAYAR";
    return {
      ...row,
      evidenceFile,
      doFile,
      approval,
      stock,
      paymentProofFile,
      paymentProofFileId: paymentProofFile?.id ?? null,
      fundingSource: row.paymentAccountCode ?? null,
      paymentStatus: isPaid ? "DIBAYAR" : "BELUM_DIBAYAR",
      isPaid,
    };
  }

  /**
   * Surat jalan / DO tidak disalin ke tiap dokumen. Sumbernya: yang diunggah Procurement saat kirim (request / PO),
   * kalau tidak ada maka foto/DO yang diunggah Gudang di penerimaan.
   */
  private async resolveDoFile(requestId: number, ownDoFileId?: number | null) {
    let fileId = ownDoFileId ?? null;
    if (!fileId) {
      const po = await this.prisma.main.supplierPO.findFirst({
        where: { requestId, doFileId: { not: null } },
        orderBy: { id: "desc" },
        select: { doFileId: true },
      });
      fileId = po?.doFileId ?? null;
    }
    if (!fileId) {
      const rec = await this.prisma.main.receiving.findFirst({
        where: { OR: [{ requestId }, { supplierPo: { requestId } }], receiptFileId: { not: null } },
        orderBy: { id: "desc" },
        select: { receiptFileId: true },
      });
      fileId = rec?.receiptFileId ?? null;
    }
    if (!fileId) return null;
    return this.prisma.main.file.findUnique({
      where: { id: fileId },
      select: { id: true, originalName: true, mimeType: true, size: true },
    });
  }

  /**
   * Bukti pembayaran dapat diambil langsung dari paymentProofFileId sendiri,
   * atau dari file bukti bayar Invoice Masuk / pembayaran invoice PO terkait request ini.
   */
  private async resolvePaymentProofFile(requestId: number, ownProofFileId?: number | null) {
    let fileId = ownProofFileId ?? null;
    if (!fileId) {
      const prFile = await this.prisma.main.file.findFirst({
        where: { refType: "purchase_request_payment", refId: String(requestId) },
        select: { id: true },
      });
      fileId = prFile?.id ?? null;
    }
    if (!fileId) {
      const invWithProof = await this.prisma.main.invoiceIn.findFirst({
        where: {
          supplierPo: { requestId },
          OR: [
            { transferFileId: { not: null } },
            { payments: { some: { fileId: { not: null } } } },
          ],
        },
        orderBy: { id: "desc" },
        include: {
          payments: {
            where: { fileId: { not: null } },
            orderBy: { date: "desc" },
            take: 1,
            select: { fileId: true },
          },
        },
      });
      fileId = invWithProof?.transferFileId ?? invWithProof?.payments?.[0]?.fileId ?? null;
    }
    if (!fileId) return null;
    return this.prisma.main.file.findUnique({
      where: { id: fileId },
      select: { id: true, originalName: true, mimeType: true, size: true },
    });
  }

  async create(dto: RequestDto, user: RequestUser) {
    if (!REQUEST_CREATOR_ROLES.includes(user.role)) {
      throw new ForbiddenException("Hanya Procurement, Gudang, Admin, atau PM yang dapat membuat request barang");
    }
    const costType = dto.costType ?? "STOK";
    const projectId = dto.projectId;
    if (costType === "PROJECT" && !projectId) {
      throw new BadRequestException("Request untuk project wajib memilih project");
    }
    const source = String(dto.procurementSource ?? "SUPPLIER").toUpperCase();
    if (!["SUPPLIER", "RETAIL", "GUDANG"].includes(source)) {
      throw new BadRequestException("Sumber pengadaan harus Supplier, Ritel, atau Gudang");
    }
    const purpose = dto.purpose || "Kebutuhan operasional";
    const otherNote = costType === "LAINNYA" && !dto.otherNote?.trim() ? purpose : dto.otherNote;

    const items = dto.items ?? [];
    if (!items.length) throw new BadRequestException("Request minimal berisi satu barang");
    if (items.some((i) => !i.productId && !i.customName?.trim())) {
      throw new BadRequestException("Setiap barang harus memilih produk atau mengisi nama barang");
    }

    const number = await this.docnum.next("permintaan");
    const rawItemsSum = items.reduce((s, i) => s + i.qty * (i.unitCost ?? 0), 0);
    const hasPpnExclude = String(otherNote || "").includes("[PPN:exclude]");
    const estimated = dto.estimatedCost != null && Number(dto.estimatedCost) > 0
      ? Number(dto.estimatedCost)
      : hasPpnExclude
      ? Math.round(rawItemsSum * 1.11)
      : rawItemsSum;

    const reqDate = dto.date ? new Date(dto.date) : new Date();
    let dueDate: Date | null = null;
    if (dto.dueDate) {
      dueDate = new Date(dto.dueDate);
    } else if ((dto.paymentMethod ?? "UTANG") === "UTANG") {
      dueDate = new Date(reqDate);
      dueDate.setMonth(dueDate.getMonth() + 1);
    }

    const row = await this.prisma.main.purchaseRequest.create({
      data: {
        number,
        date: reqDate,
        dueDate,
        requesterId: user.id,
        costType,
        procurementSource: source,
        paymentMethod: dto.paymentMethod ?? "UTANG",
        projectId,
        taskId: dto.taskId,
        supplierId: dto.supplierId,
        condition: dto.condition ?? "BARU",
        estimatedCost: estimated,
        purpose,
        otherNote,
        evidenceFileId: dto.evidenceFileId,
        status: "DIAJUKAN",
        items: {
          create: items.map((i) => ({
            productId: i.productId ?? null,
            customName: i.customName ?? null,
            customUnit: i.customUnit ?? null,
            qty: i.qty,
            unitCost: i.unitCost ?? 0,
            serials: i.serials ?? null,
          })),
        },
      },
      include: {
        requester: { select: { id: true, name: true, role: true } },
        project: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, sku: true, name: true, unit: true } } } },
      },
    });
    if (dto.evidenceFileId) {
      await this.prisma.main.file.update({
        where: { id: dto.evidenceFileId },
        data: { refType: "purchase-request", refId: String(row.id) },
      }).catch(() => {});
    }

    if (projectId && items.length > 0) {
      for (const item of items) {
        if (!item.productId) continue;
        const existingReq = await this.prisma.main.projectRequirement.findFirst({
          where: { projectId, productId: item.productId },
        });
        if (!existingReq) {
          await this.prisma.main.projectRequirement.create({
            data: { projectId, productId: item.productId, qty: item.qty },
          }).catch(() => {});
        }
      }
    }

    await this.audit.log({
      actor: user,
      action: "BUAT_REQUEST_BARANG",
      entityType: "purchase-request",
      entityId: row.id,
      detail: `${number} — ${purpose} Rp${estimated}`,
    });
    await this.notifications.notify({
      roles: ["PROCUREMENT", "GUDANG"],
      kind: "STOK",
      text: `Request barang baru: ${number} — ${purpose}`,
      href: `/requests/${row.id}`,
    });
    await this.approvals.request({
      kind: "PURCHASE_REQUEST",
      entityId: row.id,
      title: `Request barang ${number}`,
      amount: estimated,
      requestedBy: user,
      href: `/requests/${row.id}`,
    });
    return row;
  }

  async update(id: number, dto: RequestDto, user: RequestUser) {
    const row = await this.prisma.main.purchaseRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Request tidak ditemukan");
    // Status, pembayaran, dan surat jalan hanya berubah lewat /status agar alur tidak terlompati.
    assertPrEditable(row, user);

    const updated = await this.prisma.main.purchaseRequest.update({
      where: { id },
      data: {
        ...(dto.date ? { date: new Date(dto.date) } : {}),
        ...(dto.costType ? { costType: dto.costType } : {}),
        ...(dto.procurementSource !== undefined ? { procurementSource: dto.procurementSource } : {}),
        ...(dto.paymentMethod !== undefined ? { paymentMethod: dto.paymentMethod } : {}),
        ...(dto.dueDate !== undefined ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null } : {}),
        ...(dto.projectId !== undefined ? { projectId: dto.projectId } : {}),
        ...(dto.taskId !== undefined ? { taskId: dto.taskId } : {}),
        ...(dto.supplierId !== undefined ? { supplierId: dto.supplierId } : {}),
        ...(dto.condition ? { condition: dto.condition } : {}),
        ...(dto.purpose !== undefined ? { purpose: dto.purpose } : {}),
        ...(dto.otherNote !== undefined ? { otherNote: dto.otherNote } : {}),
        ...(dto.evidenceFileId !== undefined ? { evidenceFileId: dto.evidenceFileId } : {}),
        ...(dto.items?.length
          ? {
              estimatedCost:
                dto.estimatedCost != null && Number(dto.estimatedCost) > 0
                  ? Number(dto.estimatedCost)
                  : String(dto.otherNote ?? row.otherNote ?? "").includes("[PPN:exclude]")
                  ? Math.round(dto.items.reduce((s, i) => s + i.qty * (i.unitCost ?? 0), 0) * 1.11)
                  : dto.items.reduce((s, i) => s + i.qty * (i.unitCost ?? 0), 0),
              items: {
                deleteMany: {},
                create: dto.items.map((i) => ({
                  productId: i.productId ?? null,
                  customName: i.customName ?? null,
                  customUnit: i.customUnit ?? null,
                  qty: i.qty,
                  unitCost: i.unitCost ?? 0,
                  serials: i.serials ?? null,
                })),
              },
            }
          : {}),
      },
      include: {
        requester: { select: { id: true, name: true, role: true } },
        project: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, sku: true, name: true, unit: true } } } },
      },
    });
    if (dto.evidenceFileId) {
      await this.prisma.main.file
        .update({
          where: { id: dto.evidenceFileId },
          data: { refType: "purchase_request", refId: String(id) },
        })
        .catch(() => {});
    }

    return updated;
  }

  /** Sinkronisasi material non-master / pakai habis project (tidak disimpan ke master product) */
  async syncConsumablesToProject(prId: number) {
    try {
      const nonMasterProds = await this.prisma.main.product.findMany({
        where: {
          OR: [
            { sku: { startsWith: "SKU-PR-" } },
            { description: { contains: "Non-Master" } },
            { type: "NON_MASTER" },
          ],
        },
        select: { id: true },
      });
      if (nonMasterProds.length > 0) {
        const ids = nonMasterProds.map((p) => p.id);
        await this.prisma.main.projectRequirement.deleteMany({ where: { productId: { in: ids } } }).catch(() => {});
        await this.prisma.main.stockReservation.deleteMany({ where: { productId: { in: ids } } }).catch(() => {});
        await this.prisma.main.purchaseRequestItem.updateMany({ where: { productId: { in: ids } }, data: { productId: null } }).catch(() => {});
        await this.prisma.main.stockBalance.deleteMany({ where: { productId: { in: ids } } }).catch(() => {});
        await this.prisma.main.stockMovement.deleteMany({ where: { productId: { in: ids } } }).catch(() => {});
        await this.prisma.main.serialUnit.deleteMany({ where: { productId: { in: ids } } }).catch(() => {});
        await this.prisma.main.product.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
      }
    } catch (e) {
      console.warn(`Gagal sinkron PR #${prId} consumables ke project:`, (e as Error).message);
    }
  }

  /** Gudang & Procurement memproses request (cek stok, serahkan barang, konfirmasi terima, tolak). */
  async setStatus(id: number, dto: RequestStatusDto, user: RequestUser) {
    const row = await this.prisma.main.purchaseRequest.findUnique({
      where: { id },
      include: {
        items: true,
        project: { select: { id: true, name: true, picId: true } },
        requester: true,
        supplier: true,
        supplierPOs: { select: { id: true, number: true, status: true, total: true, supplierId: true } },
      },
    });
    if (!row) throw new NotFoundException("Request tidak ditemukan");

    if (row.status === dto.status) {
      return this.prisma.main.purchaseRequest.findUnique({
        where: { id },
        include: { project: { select: { id: true, name: true, picId: true } }, requester: true },
      });
    }

    // Persetujuan / penolakan wajib lewat modul Persetujuan (menghormati ambang Bos & larangan setujui sendiri).
    if (dto.status === "DISETUJUI" || dto.status === "DITOLAK") {
      if (row.status !== "DIAJUKAN" && row.status !== "CEK_STOK") {
        throw new BadRequestException(`Request berstatus ${row.status} tidak dapat diputuskan lagi`);
      }
      if (dto.status === "DITOLAK" && !dto.reason?.trim()) {
        throw new BadRequestException("Alasan penolakan wajib diisi");
      }
      const approval = await this.prisma.main.approval.findUnique({
        where: { kind_entityId: { kind: "PURCHASE_REQUEST", entityId: id } },
      });
      if (!approval) throw new BadRequestException("Pengajuan persetujuan request ini tidak ditemukan");
      await this.approvals.decide(approval.id, user, dto.status === "DISETUJUI", dto.reason);
      this.notifications.dataChange("purchase-requests", "status", id);
      this.notifications.dataChange("purchase-requests", "update", id);
      return this.prisma.main.purchaseRequest.findUnique({
        where: { id },
        include: { project: { select: { id: true, name: true, picId: true } }, requester: true },
      });
    }

    const activePos = (row.supplierPOs ?? []).filter((p) => !["DITOLAK", "DIBATALKAN"].includes(p.status));
    const isProjectConsumable =
      Boolean(row.projectId) &&
      (String(row.otherNote || "").includes("[ALL_CONSUMABLES]") ||
        (row.items.length > 0 &&
          row.items.every((it) => String(it.customName || "").includes("[PAKAI_HABIS]"))));

    assertPrTransition(row, dto.status, user, {
      activePoCount: activePos.length,
      hasApprovedPo: activePos.some((p) => p.status === "DISETUJUI"),
      paymentProofProvided: Boolean(dto.paymentProofFileId),
      isProjectConsumable,
    });

    // Untuk request internal (ambil stok gudang untuk project): kurangi stok OUT saat diserahkan/dikirim.
    // Untuk pembelian (ritel / PO): barang belum ada di gudang, stok baru bertambah saat Penerimaan (Receiving).
    const isPurchase =
      row.procurementSource === "RETAIL" ||
      row.procurementSource === "SUPPLIER";

    const shouldReduceStock =
      !isPurchase &&
      (dto.status === "DIKIRIM" || dto.status === "DITERIMA") &&
      row.status !== "DIKIRIM" &&
      row.status !== "DITERIMA";

    if (shouldReduceStock) {
      // Guard Stok Negatif (Poin 4 & 5 E7): Pastikan stok gudang mencukupi sebelum dikeluarkan
      for (const item of row.items) {
        if (!item.productId) continue;
        const totalAvail = await this.prisma.main.stockBalance.aggregate({
          where: { productId: item.productId },
          _sum: { qty: true },
        });
        const currentStock = totalAvail._sum.qty || 0;
        if (currentStock < item.qty) {
          const p = await this.prisma.main.product.findUnique({ where: { id: item.productId } });
          throw new BadRequestException(
            `Stok tidak mencukupi untuk "${p?.name || item.productId}". Tersedia: ${currentStock}, Dibutuhkan: ${item.qty}. Transaksi ditolak untuk mencegah stok negatif.`,
          );
        }
      }

      const defaultWarehouse =
        (await this.prisma.main.warehouse.findFirst({ where: { status: "AKTIF" } })) ??
        (await this.prisma.main.warehouse.findFirst());
      for (const item of row.items) {
        if (!item.productId) continue;
        const product = await this.prisma.main.product.findUnique({ where: { id: item.productId } });
        const requestedSns = item.serials
          ? String(item.serials)
              .split(/[\n,;]+/)
              .map((s) => s.trim())
              .filter(Boolean)
          : [];

        let handledQty = 0;
        if (product?.hasSerial) {
          const serialUnits =
            requestedSns.length > 0
              ? await this.prisma.main.serialUnit.findMany({
                  where: { sn: { in: requestedSns } },
                })
              : await this.prisma.main.serialUnit.findMany({
                  where: {
                    productId: item.productId,
                    status: { in: ["DI_GUDANG", "RESERVED"] },
                    warehouseId: { not: null },
                  },
                  take: item.qty,
                });

          for (const u of serialUnits) {
            const whId = u.warehouseId ?? defaultWarehouse?.id;
            if (!whId) continue;
            try {
              await this.stock.applyMovement({
                date: new Date(),
                type: "OUT",
                category: row.projectId ? "KELUAR_PROJECT" : "BARANG_TERPAKAI",
                productId: item.productId,
                fromWarehouseId: whId,
                qty: 1,
                serialUnitId: u.id,
                projectId: row.projectId ?? null,
                reason: `Pengeluaran unit SN ${u.sn} request ${row.number} oleh ${user.name}`,
                createdById: user.id,
              });
              const targetSnStatus = dto.status === "DITERIMA" && row.projectId ? "TERPASANG" : "DIKIRIM";
              await this.prisma.main.serialUnit.update({
                where: { id: u.id },
                data: {
                  status: targetSnStatus,
                  warehouseId: null,
                  projectId: row.projectId ?? u.projectId,
                },
              });
              await this.prisma.main.serialUnitHistory.create({
                data: {
                  serialUnitId: u.id,
                  status: targetSnStatus,
                  warehouseId: whId,
                  projectId: row.projectId ?? null,
                  note: `Keluar untuk request barang ${row.number}`,
                  changedById: user.id,
                },
              });
              handledQty++;
            } catch (e) {
              console.warn(`Gagal mencatat movement SN ${u.sn} request ${row.number}:`, (e as Error).message);
            }
          }
        }

        const remainingQty = Math.max(0, item.qty - handledQty);
        if (remainingQty > 0) {
          const balance =
            (await this.prisma.main.stockBalance.findFirst({
              where: { productId: item.productId, qty: { gte: remainingQty } },
            })) ??
            (await this.prisma.main.stockBalance.findFirst({
              where: { productId: item.productId, qty: { gt: 0 } },
            }));
          const warehouseId = balance?.warehouseId ?? defaultWarehouse?.id;
          if (warehouseId) {
            try {
              await this.stock.applyMovement({
                date: new Date(),
                type: "OUT",
                category: row.projectId ? "KELUAR_PROJECT" : "BARANG_TERPAKAI",
                productId: item.productId,
                fromWarehouseId: warehouseId,
                qty: remainingQty,
                projectId: row.projectId ?? null,
                reason: `Pengeluaran barang request ${row.number} status ${dto.status} oleh ${user.name}`,
                createdById: user.id,
              });
            } catch (e) {
              console.warn(`Gagal mencatat movement stok request ${row.number}:`, (e as Error).message);
            }
          }
        }
      }
    }

    if ((dto.status === "DIKIRIM" || dto.status === "DITERIMA") && row.projectId) {
      for (const item of row.items) {
        if (!item.productId) continue;
        const existing = await this.prisma.main.projectRequirement.findFirst({
          where: { projectId: row.projectId, productId: item.productId },
        });
        if (existing) {
          await this.prisma.main.projectRequirement.update({
            where: { id: existing.id },
            data: { reservedQty: item.qty, status: "DIRESERVE" },
          }).catch(() => {});
        } else {
          await this.prisma.main.projectRequirement.create({
            data: {
              projectId: row.projectId,
              productId: item.productId,
              qty: item.qty,
              reservedQty: item.qty,
              status: "DIRESERVE",
            },
          }).catch(() => {});
        }
      }
    }

    // Pembayaran hanya lewat status DIBAYAR (peran Finance + bukti wajib, divalidasi assertPrTransition).
    const isMarkingPaid =
      dto.status === "DIBAYAR" ||
      dto.status === "LUNAS" ||
      dto.status === "DITERIMA" ||
      dto.paymentStatus === "DIBAYAR" ||
      Boolean(dto.paymentProofFileId);

    // Jika request barang project dibayar / disetujui / diterima, masukkan barang non-master/pakai habis ke Project Requirement (Barang Tambahan Project)
    const shouldSyncConsumables =
      isMarkingPaid ||
      dto.status === "DISETUJUI" ||
      dto.status === "DITERIMA" ||
      row.status === "DISETUJUI" ||
      row.status === "DITERIMA";

    if (shouldSyncConsumables && row.projectId) {
      await this.syncConsumablesToProject(id);
    }

    // Material pakai habis proyek yang dibayar langsung selesai (DITERIMA) tanpa perlu kirim & terima gudang
    let targetStatus = dto.status;
    if (isProjectConsumable && isMarkingPaid) {
      targetStatus = "DITERIMA";
    } else if (
      (dto.status === "DIBAYAR" || dto.status === "LUNAS") &&
      (row.status === "DIKIRIM" || row.status === "DITERIMA" || row.status === "PO_DIBUAT")
    ) {
      targetStatus = row.status;
    } else if (dto.status === "LUNAS") {
      targetStatus = "DIBAYAR";
    }

    const updated = await this.prisma.main.purchaseRequest.update({
      where: { id },
      data: {
        status: targetStatus as never,
        ...(isMarkingPaid
          ? {
              paymentStatus: "DIBAYAR",
              ...(dto.paymentProofFileId ? { paymentProofFileId: dto.paymentProofFileId } : {}),
              ...(dto.paymentAccountCode || dto.fundingSource ? { paymentAccountCode: dto.paymentAccountCode || dto.fundingSource } : {}),
            }
          : {}),
        rejectReason: dto.status === "DIAJUKAN" ? null : (dto.reason ?? row.rejectReason),
        ...(dto.doFileId ? { doFileId: dto.doFileId } : {}),
      },
      include: { project: { select: { id: true, name: true, picId: true } }, requester: true },
    });
    // Posting Akuntansi E7b: Pembelian Ritel via Request Barang (tanpa PO)
    if (isMarkingPaid) {
      try {
        const mappings = await this.mappingService.getAll();
        const payAccount = dto.paymentAccountCode || dto.fundingSource || mappings.CASH_DEFAULT || "1000.02";
        const estimatedCost = Number(row.estimatedCost || 0) ||
          (row.items || []).reduce((acc: number, it: any) => acc + (Number(it.unitCost || 0) * Number(it.qty || 1)), 0);

        if (estimatedCost > 0) {
          if (row.procurementSource === "GUDANG" && !row.projectId) {
            // Masuk stok gudang ritel: Dr 1200 Cr Kas/Bank
            await this.postingService.post({
              sourceType: "PurchaseRequest",
              sourceId: row.id,
              event: "paid",
              source: "RETAIL_PURCHASE",
              date: new Date(),
              memo: `Pembelian Ritel Stok Masuk #${row.number}`,
              refNo: row.number,
              createdById: user.id,
              lines: [
                { accountCode: mappings.INVENTORY || "1200", debit: estimatedCost, credit: 0, memo: `Persediaan Ritel #${row.number}` },
                { accountCode: payAccount, debit: 0, credit: estimatedCost, memo: `Kas Keluar Ritel #${row.number}` },
              ],
            });
          } else if (row.projectId) {
            // Non-stok habis pakai proyek: Dr 5101 Cr Kas/Bank
            await this.postingService.post({
              sourceType: "PurchaseRequest",
              sourceId: row.id,
              event: "paid",
              source: "RETAIL_PURCHASE",
              date: new Date(),
              memo: `Pembelian Bahan/Material Proyek #${row.number}`,
              refNo: row.number,
              projectId: row.projectId,
              createdById: user.id,
              lines: [
                { accountCode: mappings.COGS_PROJECT || "5101", debit: estimatedCost, credit: 0, memo: `HPP Material Proyek #${row.number}`, projectId: row.projectId },
                { accountCode: payAccount, debit: 0, credit: estimatedCost, memo: `Kas Keluar Ritel #${row.number}`, projectId: row.projectId },
              ],
            });
          }
        }
      } catch (err) {
        console.error("Posting retail request error:", err);
      }
    }

    if (dto.status === "DIAJUKAN") {
      const estimated =
        Number(row.estimatedCost ?? 0) ||
        (row.items ?? []).reduce(
          (acc, it) => acc + (Number(it.unitCost ?? 0) * (it.qty ?? 1)),
          0,
        );
      await this.approvals.request({
        kind: "PURCHASE_REQUEST",
        entityId: row.id,
        title: `Request barang ${row.number}`,
        amount: estimated,
        requestedBy: user,
        href: `/requests/${row.id}`,
      }).catch(() => {});
    }
    if (dto.doFileId) {
      await this.prisma.main.file
        .update({
          where: { id: dto.doFileId },
          data: { refType: "purchase_request_do", refId: String(id) },
        })
        .catch(() => {});
    }
    if (dto.paymentProofFileId) {
      await this.prisma.main.file
        .update({
          where: { id: dto.paymentProofFileId },
          data: { refType: "purchase_request_payment", refId: String(id) },
        })
        .catch(() => {});
    }

    // Sinkronisasi status pengiriman ke Supplier PO terkait
    if (dto.status === "DIKIRIM") {
      try {
        await this.prisma.main.supplierPO.updateMany({
          where: { requestId: id, status: "DISETUJUI", shipmentStatus: "DI_SUPPLIER" },
          data: { shipmentStatus: "DIKIRIM" },
        });
        const linkedPos = await this.prisma.main.supplierPO.findMany({
          where: { requestId: id },
          select: { id: true },
        });
        for (const p of linkedPos) {
          this.notifications.dataChange("supplier-pos", "status", p.id);
        }
      } catch (err) {
        console.warn(`Gagal sinkronisasi DIKIRIM ke supplierPO request ${id}:`, (err as Error).message);
      }
    } else if (dto.status === "DITERIMA") {
      try {
        await this.prisma.main.supplierPO.updateMany({
          where: { requestId: id, status: "DISETUJUI", shipmentStatus: { not: "SAMPAI" } },
          data: { shipmentStatus: "SAMPAI", arrivedAt: new Date() },
        });
        const linkedPos = await this.prisma.main.supplierPO.findMany({
          where: { requestId: id },
          select: { id: true },
        });
        for (const p of linkedPos) {
          this.notifications.dataChange("supplier-pos", "status", p.id);
        }
      } catch (err) {
        console.warn(`Gagal sinkronisasi SAMPAI ke supplierPO request ${id}:`, (err as Error).message);
      }
    }

    // Sinkronisasi status lunas ke Supplier PO terkait
    if (isMarkingPaid) {
      try {
        const linkedPos = await this.prisma.main.supplierPO.findMany({
          where: { requestId: id },
          select: { id: true },
        });
        for (const p of linkedPos) {
          this.notifications.dataChange("supplier-pos", "update", p.id);
          this.notifications.dataChange("supplier-pos", "status", p.id);
        }
      } catch (err) {
        console.warn(`Gagal sinkronisasi Lunas ke supplierPO request ${id}:`, (err as Error).message);
      }
    }

    // Bila pengadaan (ritel atau PO supplier) ditandai DIKIRIM: otomatis buat data Penerimaan di Gudang
    if (dto.status === "DIKIRIM" && isPurchase) {
      try {
        const linkedPo = row.supplierPOs?.[0] || await this.prisma.main.supplierPO.findFirst({
          where: { requestId: row.id },
          select: { id: true, number: true, supplierId: true },
        });

        const existingRec = await this.prisma.main.receiving.findFirst({
          where: {
            OR: [
              { requestId: row.id },
              ...(linkedPo?.id ? [{ supplierPoId: linkedPo.id }] : []),
            ],
          },
        });
        if (!existingRec) {
          const recNumber = await this.docnum.next("penerimaan");
          // Gudang diisi otomatis hanya bila tepat satu gudang aktif; bila lebih, Gudang memilih saat konfirmasi.
        const activeWhs = await this.prisma.main.warehouse.findMany({ where: { status: "AKTIF" }, select: { id: true }, take: 2 });
        const defaultWh = activeWhs.length === 1 ? activeWhs[0] : null;
          const defaultCat =
            (await this.prisma.main.productCategory.findFirst({ where: { status: "AKTIF" } })) ??
            (await this.prisma.main.productCategory.findFirst());

          const recItems: any[] = [];
          for (const it of row.items) {
            let pId = it.productId;
            if (!pId && it.customName) {
              let p = await this.prisma.main.product.findFirst({
                where: { name: { equals: it.customName } },
              });
              let wasCreated = false;
              if (!p) {
                // Deteksi apakah user menandai ber-SN atau nama barang mengindikasikan barang elektronik/kamera
                const isSnItem = (it as any).hasSerial !== undefined
                  ? !!(it as any).hasSerial
                  : /kamera|cctv|dvr|nvr|switch|router|access point|server|ups|ip cam/i.test(it.customName);
                p = await this.prisma.main.product.create({
                  data: {
                    sku: `SKU-${Date.now().toString().slice(-6)}`,
                    name: it.customName,
                    unit: it.customUnit || "unit",
                    ...(defaultCat?.id ? { category: { connect: { id: defaultCat.id } } } : {}),
                    purchasePrice: Number(it.unitCost) || 0,
                    hasSerial: isSnItem,
                    status: "AKTIF",
                  },
                });
                wasCreated = true;
              }
              pId = p.id;
              if (wasCreated) {
                this.notifications.dataChange("products", "create", p.id);
              }
            }
            if (pId) {
              await this.prisma.main.purchaseRequestItem.update({
                where: { id: it.id },
                data: { productId: pId },
              }).catch(() => {});
              const itemQty = Math.max(1, Number(it.qty) || 1);
              recItems.push({
                productId: pId,
                qtyOrdered: itemQty,
                qtyReceived: itemQty,
                note: it.customName ? `Item: ${it.customName}` : undefined,
              });
            }
          }

          let supplierName = (row as any).supplier?.name;
          if (!supplierName && linkedPo?.supplierId) {
            const supp = await this.prisma.main.supplier.findUnique({ where: { id: linkedPo.supplierId } });
            supplierName = supp?.name;
          }
          if (!supplierName) {
            supplierName = row.procurementSource === "RETAIL" ? "Pembelian Ritel / Toko" : "Supplier";
          }

          const createdRec = await this.prisma.main.receiving.create({
            data: {
              number: recNumber,
              requestId: row.id,
              supplierPoId: linkedPo?.id ?? null,
              supplierName: supplierName,
              warehouseId: defaultWh?.id ?? null,
              projectId: row.projectId ?? null,
              date: new Date(),
              receiverId: user.id,
              status: "MENUNGGU",
              receiptFileId: (row as any).doFileId ?? null,
              items: {
                create: recItems,
              },
            },
          });
          this.notifications.dataChange("receiving", "create", createdRec.id);
          await this.notifications.notify({
            roles: ["GUDANG"],
            kind: "STOK",
            text: `Penerimaan baru ${recNumber} otomatis dibuat untuk request ${row.number}. Cek fisik barang saat tiba.`,
            href: `/receivings/${createdRec.id}`,
          });
        }
      } catch (err) {
        console.warn(`Gagal membuat otomatis penerimaan untuk request ${row.number}:`, (err as Error).message);
      }
    }
    await this.audit.log({
      actor: user,
      action: "UBAH_STATUS_REQUEST",
      entityType: "purchase-request",
      entityId: id,
      detail: `${row.number}: ${row.status} → ${dto.status}${dto.reason ? ` — ${dto.reason}` : ""}`,
    });

    if (row.requesterId !== user.id) {
      await this.notifications.notify({
        userIds: [row.requesterId],
        kind: "STOK",
        text: `Request ${row.number}: status menjadi ${dto.status}${dto.reason ? ` (${dto.reason})` : ""}`,
        href: `/requests/${id}`,
      });
    }

    if (dto.status === "DIKIRIM") {
      const recipientIds = new Set<number>();
      if (row.requesterId) recipientIds.add(row.requesterId);
      if (row.project?.picId) recipientIds.add(row.project.picId);
      recipientIds.delete(user.id);
      if (recipientIds.size > 0) {
        await this.notifications.notify({
          userIds: Array.from(recipientIds),
          kind: "STOK",
          text: `Barang untuk request ${row.number} (${row.project?.name ?? row.purpose}) telah disiapkan & diserahkan oleh Gudang`,
          href: `/requests/${id}`,
        });
      }
    } else if (dto.status === "DITERIMA") {
      await this.notifications.notify({
        roles: ["GUDANG", "PROCUREMENT"],
        kind: "STOK",
        text: `Barang request ${row.number} telah diterima oleh pemohon (${row.requester?.name ?? "User"})`,
        href: `/requests/${id}`,
      });
    } else if (dto.status === "CEK_STOK") {
      await this.notifications.notify({
        roles: ["GUDANG"],
        kind: "STOK",
        text: `Mohon cek ketersediaan stok untuk request ${row.number}`,
        href: `/requests/${id}`,
      });
    }

    if (dto.status === "DISETUJUI") {
      try {
        const apprv = await this.prisma.main.approval.findUnique({
          where: { kind_entityId: { kind: "PURCHASE_REQUEST", entityId: id } },
        });
        if (apprv && apprv.status === "MENUNGGU") {
          await this.prisma.main.approval.update({
            where: { id: apprv.id },
            data: { status: "DISETUJUI" },
          });
          await this.prisma.main.approvalStep.updateMany({
            where: { approvalId: apprv.id, status: "MENUNGGU" },
            data: { status: "DISETUJUI", decidedById: user.id, decidedAt: new Date() },
          });
          this.notifications.dataChange("approvals", "update", apprv.id);
        }
      } catch {}
    } else if (dto.status === "DITOLAK") {
      try {
        const apprv = await this.prisma.main.approval.findUnique({
          where: { kind_entityId: { kind: "PURCHASE_REQUEST", entityId: id } },
        });
        if (apprv && apprv.status === "MENUNGGU") {
          await this.prisma.main.approval.update({
            where: { id: apprv.id },
            data: { status: "DITOLAK", reason: dto.reason ?? null },
          });
          await this.prisma.main.approvalStep.updateMany({
            where: { approvalId: apprv.id, status: "MENUNGGU" },
            data: { status: "DITOLAK", decidedById: user.id, decidedAt: new Date(), reason: dto.reason ?? null },
          });
          this.notifications.dataChange("approvals", "update", apprv.id);
        }
      } catch {}
    }

    this.notifications.dataChange("purchase-requests", "status", id);
    this.notifications.dataChange("purchase-requests", "update", id);

    return updated;
  }

  async remove(id: number, user: RequestUser) {
    const row = await this.prisma.main.purchaseRequest.findUnique({
      where: { id },
      include: { supplierPOs: true },
    });
    if (!row) throw new NotFoundException("Request tidak ditemukan");
    const deletableStatuses = ["DIAJUKAN", "CEK_STOK", "DITOLAK"];
    if (!deletableStatuses.includes(row.status) || (row.supplierPOs && row.supplierPOs.length > 0)) {
      throw new BadRequestException(
        "Request sudah berjalan tidak bisa dihapus (hanya status Diajukan, Cek Stok, atau Ditolak yang dapat dihapus)",
      );
    }
    await this.prisma.main.$transaction(async (tx) => {
      await tx.stockReservation.deleteMany({ where: { purchaseRequestId: id } });
      await tx.approval.deleteMany({ where: { kind: "PURCHASE_REQUEST", entityId: id } });
      await tx.purchaseRequestItem.deleteMany({ where: { requestId: id } });
      await tx.purchaseRequest.delete({ where: { id } });
    });
    await this.audit.log({
      actor: user,
      action: "HAPUS_REQUEST_BARANG",
      entityType: "purchase-request",
      entityId: id,
      detail: `${row.number} dihapus`,
    });
    return { id, deleted: true };
  }

  suggestNumber() {
    return this.docnum.suggest("permintaan");
  }

  /** Ketersediaan stok per item (dipakai saat cek stok). */
  async checkStock(id: number) {
    const row = await this.prisma.main.purchaseRequest.findUnique({
      where: { id },
      include: { items: { include: { product: { select: { id: true, name: true, unit: true } } } } },
    });
    if (!row) throw new NotFoundException("Request tidak ditemukan");
    const items = await Promise.all(
      row.items.map(async (i) => {
        const available = i.productId ? await this.stock.totalAvailable(i.productId) : 0;
        return {
          productId: i.productId,
          name: i.product?.name ?? (i as any).customName ?? "Barang Non-Master",
          unit: i.product?.unit ?? (i as any).customUnit ?? "unit",
          ordered: i.qty,
          available,
          enough: i.productId ? available >= i.qty : false,
        };
      }),
    );
    return { requestId: id, number: row.number, items, allEnough: items.every((i) => i.enough) };
  }
}
