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
import type { Role } from "../generated/prisma/client.js";
import { IssueDto, ReceivingDto, ReceivingListQuery } from "./dto.js";
import { WAREHOUSE_ROLES, assertReceivable } from "./purchase-flow.js";

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
    private readonly postingService: PostingService,
    private readonly mappingService: MappingService,
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

    // Urutan alur: barang hanya bisa diterima setelah Procurement menandai DIKIRIM.
    const requestId = dto.requestId ?? po?.requestId ?? null;
    if (po && po.status !== "DISETUJUI") {
      throw new BadRequestException("PO supplier belum disetujui, barang belum bisa diterima");
    }
    if (requestId) {
      const pr = await this.prisma.main.purchaseRequest.findUnique({
        where: { id: requestId },
        select: { status: true, procurementSource: true },
      });
      if (!pr) throw new NotFoundException("Request barang tidak ditemukan");
      assertReceivable(pr);
      const pending = await this.prisma.main.receiving.findFirst({
        where: {
          status: "MENUNGGU",
          OR: [{ requestId }, ...(po ? [{ supplierPoId: po.id }] : [])],
        },
        select: { id: true, number: true },
      });
      if (pending) {
        throw new BadRequestException(
          `Sudah ada penerimaan ${pending.number} yang menunggu konfirmasi Gudang untuk request ini, gunakan dokumen tersebut`,
        );
      }
    }

    const direct = po ? !!po.projectId && !dto.warehouseId : false;
    let warehouseId = direct ? null : dto.warehouseId ?? null;
    if (warehouseId) {
      const wh = await this.prisma.main.warehouse.findUnique({ where: { id: warehouseId } });
      if (!wh) throw new BadRequestException("Gudang penerima tidak ditemukan");
      if (wh.status !== "AKTIF") throw new BadRequestException(`Gudang ${wh.name} nonaktif, pilih gudang lain`);
    } else if (!direct) {
      warehouseId = await this.resolveWarehouseId(null);
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
      if (poItem && qtyReceived > poItem.qty - poItem.receivedQty) {
        throw new BadRequestException(
          `Jumlah diterima (${qtyReceived}) melebihi sisa pesanan PO (${Math.max(0, poItem.qty - poItem.receivedQty)})`,
        );
      }
      const qtyOrdered = poItem ? poItem.qty - poItem.receivedQty : qtyReceived;

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
    // Hanya Gudang (atau admin) yang boleh langsung menyatakan barang DITERIMA; peran lain menunggu konfirmasi Gudang.
    const initialStatus = WAREHOUSE_ROLES.includes(user.role) ? "DITERIMA" : "MENUNGGU";

    if (initialStatus === "DITERIMA" && preparedItems.length) {
      await this.validateSerials(preparedItems);
    }

    const doFileId = dto.receiptFileId ?? null;
    const photoFileId = dto.photoFileId ?? null;

    const receiving = await this.prisma.main.receiving.create({
      data: {
        number,
        supplierPoId: po?.id ?? null,
        requestId,
        supplierName: dto.supplierName || (po ? null : "Pemasok Langsung"),
        warehouseId,
        projectId: direct ? po!.projectId : null,
        date: dto.date ? new Date(dto.date) : new Date(),
        receiverId: user.id,
        status: initialStatus as any,
        conditionNote: dto.conditionNote,
        receiptFileId: doFileId,
        photoFileId,
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
    if (doFileId) await this.attachFile(doFileId, "receiving", receiving.id).catch(() => {});
    if (photoFileId) await this.attachFile(photoFileId, "receiving-photo", receiving.id).catch(() => {});
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

  /** Konfirmasi barang diterima: hanya Gudang, hanya setelah Procurement menandai DIKIRIM. */
  private async assertCanConfirm(
    row: { id: number; status: string; requestId: number | null; supplierPoId: number | null },
    user: RequestUser,
  ) {
    if (!WAREHOUSE_ROLES.includes(user.role)) {
      throw new ForbiddenException("Hanya Gudang yang dapat mengonfirmasi penerimaan barang");
    }
    if (row.status === "DITOLAK") throw new BadRequestException("Penerimaan sudah ditolak");
    if (row.status === "DITERIMA") {
      // Dokumen "Diterima" yang stoknya belum tercatat (data lama / gagal sebagian) boleh dikonfirmasi ulang.
      const posted = await this.prisma.main.stockMovement.count({ where: { receivingId: row.id } });
      if (posted > 0) throw new BadRequestException("Penerimaan sudah dikonfirmasi dan stok sudah tercatat");
    }
    let requestId = row.requestId;
    if (!requestId && row.supplierPoId) {
      const po = await this.prisma.main.supplierPO.findUnique({
        where: { id: row.supplierPoId },
        select: { requestId: true, status: true },
      });
      if (po && po.status !== "DISETUJUI") throw new BadRequestException("PO supplier belum disetujui");
      requestId = po?.requestId ?? null;
    }
    if (requestId) {
      const pr = await this.prisma.main.purchaseRequest.findUnique({
        where: { id: requestId },
        select: { status: true, procurementSource: true },
      });
      assertReceivable(pr);
    }
  }

  async update(id: number, dto: ReceivingDto, user: RequestUser) {
    const row = await this.prisma.main.receiving.findUnique({ where: { id }, include: { items: true } });
    if (!row) throw new NotFoundException("Penerimaan tidak ditemukan");
    if (dto.status === "DITERIMA" || dto.status === "DITERIMA_SEBAGIAN" || dto.status === "DITOLAK") {
      await this.assertCanConfirm(row, user);
    }

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
        // DITERIMA hanya boleh ditulis oleh postStock setelah stok benar-benar tercatat.
        // Sebelumnya status disimpan lebih dulu, sehingga bila pencatatan stok gagal dokumen
        // terkunci "Diterima" tanpa ada stok yang masuk.
        ...(dto.status && dto.status !== "DITERIMA" ? { status: dto.status as any } : {}),
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
    // Jika status diubah menjadi DITERIMA dan sebelumnya masih MENUNGGU atau stok belum tercatat, catat stok & serial unit
    const alreadyPosted = (await this.prisma.main.stockMovement.count({ where: { receivingId: id } })) > 0;
    if (dto.status === "DITERIMA" && (!alreadyPosted || row.status === "MENUNGGU")) {
      await this.postStock(id);
      await this.postReceivingJournalIfEligible(id, user.id);
    } else if (dto.status === "DITERIMA" || dto.status === "DITERIMA_SEBAGIAN") {
      await this.postReceivingJournalIfEligible(id, user.id);
    }

    this.notifications.dataChange("receiving", "update", updated.id);
    return updated;
  }

  async setStatus(id: number, status: string, user: RequestUser) {
    const row = await this.prisma.main.receiving.findUnique({ where: { id }, include: { items: true } });
    if (!row) throw new NotFoundException("Penerimaan tidak ditemukan");
    if (status === "DITERIMA" || status === "DITERIMA_SEBAGIAN" || status === "DITOLAK") {
      await this.assertCanConfirm(row, user);
    } else if (status !== "MENUNGGU") {
      throw new BadRequestException(`Status penerimaan ${status} tidak dikenal`);
    }
    if (status === "DITERIMA") {
      await this.validateSerials(row.items, id);
    }
    const alreadyPosted = (await this.prisma.main.stockMovement.count({ where: { receivingId: id } })) > 0;
    if (status === "DITERIMA" && (!alreadyPosted || row.status === "MENUNGGU")) {
      await this.postStock(id);
      await this.postReceivingJournalIfEligible(id, user.id);
      return this.get(id);
    }
    if (status === "DITERIMA" || status === "DITERIMA_SEBAGIAN") {
      await this.postReceivingJournalIfEligible(id, user.id);
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
    const row = await this.prisma.main.receiving.findUnique({ where: { id }, include: { items: true } });
    if (!row) throw new NotFoundException("Penerimaan tidak ditemukan");
    if (!WAREHOUSE_ROLES.includes(user.role) && user.role !== "PROCUREMENT") {
      throw new ForbiddenException("Hanya Gudang atau Procurement yang dapat menghapus penerimaan");
    }

    // Bila stok sudah tercatat, penghapusan harus membalik stok, unit SN, dan qty PO — bukan sekadar menghapus baris.
    const movements = await this.prisma.main.stockMovement.findMany({ where: { receivingId: id } });
    const unitIds = movements.map((m) => m.serialUnitId).filter((v): v is number => v != null);
    if (unitIds.length) {
      const allowed = row.projectId ? ["DI_GUDANG", "TERPASANG"] : ["DI_GUDANG"];
      const moved = await this.prisma.main.serialUnit.count({
        where: { id: { in: unitIds }, status: { notIn: allowed as never[] } },
      });
      if (moved > 0) {
        throw new BadRequestException(
          `${moved} unit dari penerimaan ini sudah keluar dari gudang (dipakai / dikirim / direservasi). Batalkan pengeluarannya dulu sebelum menghapus penerimaan.`,
        );
      }
    }

    await this.prisma.main.$transaction(async (tx) => {
      for (const m of movements) {
        if (m.type === "IN" && m.toWarehouseId) {
          const bal = await tx.stockBalance.findUnique({
            where: { productId_warehouseId: { productId: m.productId, warehouseId: m.toWarehouseId } },
          });
          const cur = bal?.qty ?? 0;
          if (cur < m.qty) {
            throw new BadRequestException(
              `Stok produk #${m.productId} sekarang ${cur}, kurang dari ${m.qty} yang diterima — sebagian sudah keluar. Penerimaan tidak bisa dihapus.`,
            );
          }
          await tx.stockBalance.update({
            where: { productId_warehouseId: { productId: m.productId, warehouseId: m.toWarehouseId } },
            data: { qty: cur - m.qty },
          });
        }
      }
      if (unitIds.length) {
        await tx.serialUnitHistory.deleteMany({ where: { serialUnitId: { in: unitIds } } });
      }
      await tx.stockMovement.deleteMany({ where: { receivingId: id } });
      if (unitIds.length) await tx.serialUnit.deleteMany({ where: { id: { in: unitIds } } });

      // Kembalikan qty terima di PO (hanya bila penerimaan ini sempat tercatat ke stok)
      if (row.supplierPoId && movements.length) {
        for (const it of row.items) {
          const poItem = await tx.supplierPOItem.findFirst({
            where: { poId: row.supplierPoId, productId: it.productId },
          });
          if (poItem) {
            await tx.supplierPOItem.update({
              where: { id: poItem.id },
              data: { receivedQty: Math.max(0, poItem.receivedQty - it.qtyReceived) },
            });
          }
        }
      }

      await tx.approval.deleteMany({ where: { kind: "PENERIMAAN", entityId: id } });
      await tx.issueReport.deleteMany({ where: { receivingId: id } });
      await tx.receivingItem.deleteMany({ where: { receivingId: id } });
      await tx.receiving.delete({ where: { id } });
    });

    // Status request & PO diturunkan kembali sesuai penerimaan yang masih ada.
    await this.recomputeChain(row.requestId, row.supplierPoId);

    await this.audit.log({
      actor: user,
      action: "HAPUS_PENERIMAAN",
      entityType: "receiving",
      entityId: id,
      detail: `${row.number} dihapus${movements.length ? " (stok dibalik)" : ""}`,
    });
    this.notifications.dataChange("receiving", "delete", id);
    if (movements.length) this.notifications.dataChange("stock", "update");
    return { id, deleted: true };
  }

  /**
   * Tentukan gudang penerima. Dipakai saat membuat & mengonfirmasi penerimaan.
   * - Sudah dipilih  -> harus ada & aktif.
   * - Belum dipilih  -> hanya boleh otomatis bila tepat satu gudang aktif; selain itu pengguna harus memilih.
   * - Belum ada gudang sama sekali -> pesan jelas agar gudang ditambahkan lebih dulu.
   */
  private async resolveWarehouseId(selected: number | null | undefined): Promise<number> {
    if (selected) {
      const wh = await this.prisma.main.warehouse.findUnique({ where: { id: selected } });
      if (!wh) throw new BadRequestException("Gudang penerima tidak ditemukan");
      if (wh.status !== "AKTIF") throw new BadRequestException(`Gudang ${wh.name} nonaktif, pilih gudang lain`);
      return wh.id;
    }
    const active = await this.prisma.main.warehouse.findMany({ where: { status: "AKTIF" }, select: { id: true }, take: 2 });
    if (active.length === 1) return active[0]!.id;
    if (active.length === 0) {
      throw new BadRequestException("Belum ada gudang aktif. Tambahkan gudang dulu di Master Data > Gudang, lalu ulangi penerimaan.");
    }
    throw new BadRequestException("Ada lebih dari satu gudang. Pilih gudang penerima terlebih dahulu.");
  }

  /**
   * Satu-satunya tempat menurunkan status Request & PO ketika penerimaan hilang / berubah.
   * Aturan: Request/PO hanya "Diterima/Sampai" selama masih ada penerimaan DITERIMA atau qty PO terpenuhi.
   */
  private async recomputeChain(requestId?: number | null, poId?: number | null) {
    const po = poId
      ? await this.prisma.main.supplierPO.findUnique({ where: { id: poId }, select: { id: true, requestId: true } })
      : null;
    const reqId = requestId ?? po?.requestId ?? null;
    if (!reqId && !po) return;

    const doneReceivings = await this.prisma.main.receiving.count({
      where: {
        status: "DITERIMA",
        OR: [
          ...(reqId ? [{ requestId: reqId }, { supplierPo: { requestId: reqId } }] : []),
          ...(po ? [{ supplierPoId: po.id }] : []),
        ],
      },
    });

    const pos = await this.prisma.main.supplierPO.findMany({
      where: { OR: [...(reqId ? [{ requestId: reqId }] : []), ...(po ? [{ id: po.id }] : [])] },
      include: { items: true },
    });
    for (const p of pos) {
      if (p.shipmentStatus !== "SAMPAI") continue;
      const qtyComplete = p.items.length > 0 && p.items.every((i) => i.receivedQty >= i.qty);
      if (!qtyComplete && doneReceivings === 0) {
        await this.prisma.main.supplierPO.update({
          where: { id: p.id },
          data: { shipmentStatus: "DIKIRIM", arrivedAt: null },
        });
        this.notifications.dataChange("supplier-pos", "status", p.id);
      }
    }

    if (reqId && doneReceivings === 0) {
      const reverted = await this.prisma.main.purchaseRequest.updateMany({
        where: { id: reqId, status: "DITERIMA", procurementSource: { in: ["SUPPLIER", "RETAIL"] } },
        data: { status: "DIKIRIM" },
      });
      if (reverted.count > 0) {
        this.notifications.dataChange("purchase-requests", "status", reqId);
        this.notifications.dataChange("purchase-requests", "update", reqId);
      }
    }
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

    // Gudang penerima harus jelas: dipilih di dokumen, atau satu-satunya gudang aktif. Disimpan ke dokumen
    // supaya laporan tidak menampilkan "tanpa gudang" padahal stok masuk ke gudang tertentu.
    const effectiveWhId = receiving.projectId && !receiving.warehouseId
      ? undefined
      : await this.resolveWarehouseId(receiving.warehouseId);
    if (effectiveWhId && effectiveWhId !== receiving.warehouseId) {
      await this.prisma.main.receiving.update({ where: { id }, data: { warehouseId: effectiveWhId } });
    }
    for (const item of receiving.items) {
      const serials = parseSerials(item.serials ?? undefined);
      if (item.product.hasSerial && serials.length < item.qtyReceived) {
        throw new BadRequestException(
          `${item.product.name} memakai nomor seri: isi ${item.qtyReceived} serial number (baru ${serials.length}) agar unit tercatat di stok`,
        );
      }
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
          // Hitung rata-rata tertimbang Product.avgCost
          const prod = await this.prisma.main.product.findUnique({
            where: { id: item.productId },
          });
          const stockBalances = await this.prisma.main.stockBalance.findMany({
            where: { productId: item.productId },
          });
          if (prod) {
            const currentTotalQty = stockBalances.reduce((s: number, b: any) => s + Number(b.qty || 0), 0) - item.qtyReceived;
            const validOldQty = Math.max(0, currentTotalQty);
            const oldAvg = Number(prod.avgCost || prod.purchasePrice || 0);
            const totalQty = validOldQty + item.qtyReceived;
            const newAvg = totalQty > 0 ? (validOldQty * oldAvg + item.qtyReceived * poPrice) / totalQty : poPrice;
            await this.prisma.main.product.update({
              where: { id: item.productId },
              data: {
                purchasePrice: poPrice,
                avgCost: newAvg,
              },
            }).catch(() => {});
          }
        }
      }

      const partial = receiving.items.some((i) => i.qtyReceived < i.qtyOrdered);
      await this.prisma.main.receiving.update({
        where: { id },
        data: { status: partial ? "DITERIMA_SEBAGIAN" : "DITERIMA" },
      });

      // Posting Akuntansi E4: Penerimaan Barang PO -> Dr 1200 Cr 2108 (GRNI)
      await this.postReceivingJournalIfEligible(id);

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
              where: { id: po.requestId, status: { in: ["PO_DIBUAT", "DISETUJUI", "DIBAYAR", "DIKIRIM"] } },
              data: { status: "DITERIMA" },
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
      await this.postReceivingJournalIfEligible(id);
    }

    // Sinkronisasi status & DO File ke Purchase Request terkait (untuk penerimaan ritel / request langsung / via PO)
    const reqIdsToNotify = new Set<number>();
    // Penerimaan sebagian tidak menutup request; request baru DITERIMA setelah semua barang tiba.
    const fullyReceived =
      (await this.prisma.main.receiving.findUnique({ where: { id }, select: { status: true } }))?.status === 'DITERIMA';

    let directReqId = (receiving as any).requestId ?? (receiving as any).request?.id;
    if (!directReqId && receiving.supplierPoId) {
      const p = await this.prisma.main.supplierPO.findUnique({
        where: { id: receiving.supplierPoId },
        select: { requestId: true },
      });
      directReqId = p?.requestId ?? null;
    }
    if (directReqId) {
      await this.prisma.main.purchaseRequest.updateMany({
        where: { id: Number(directReqId) },
        data: {
          ...(fullyReceived ? { status: "DITERIMA" as const } : {}),
        },
      });
      reqIdsToNotify.add(Number(directReqId));
    }

    for (const rId of reqIdsToNotify) {
      this.notifications.dataChange("purchase-requests", "update", rId);
      this.notifications.dataChange("purchase-requests", "status", rId);

      // Sinkronisasi status pengiriman SAMPAI ke PO Supplier yang terhubung ke Request ini
      try {
        if (!fullyReceived) continue;
        await this.prisma.main.supplierPO.updateMany({
          where: { requestId: rId, shipmentStatus: { not: "SAMPAI" } },
          data: {
            shipmentStatus: "SAMPAI",
            arrivedAt: new Date(),
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

  /**
   * Posting Jurnal Penerimaan Barang PO (E4) -> Dr Persediaan 1200 Cr GRNI 2108
   */
  async postReceivingJournalIfEligible(id: number, userId?: number): Promise<void> {
    try {
      const receiving = await this.prisma.main.receiving.findUnique({
        where: { id },
        include: {
          items: { include: { product: true } },
          supplierPo: { include: { items: true } },
          request: { include: { items: true } },
        },
      });
      if (!receiving || receiving.status === "DITOLAK") {
        return;
      }

      let totalVal = 0;
      for (const item of (receiving.items || [])) {
        const poItem = receiving.supplierPo?.items?.find((p) => p.productId === item.productId);
        const reqItem = (receiving as any).request?.items?.find((ri: any) => ri.productId === item.productId);
        let pPrice = Number(poItem?.price ?? reqItem?.unitCost ?? item.product?.purchasePrice ?? item.product?.avgCost ?? 0);
        if (pPrice <= 0 && item.productId) {
          const lastPo = await this.prisma.main.supplierPOItem.findFirst({
            where: { productId: item.productId, price: { gt: 0 } },
            orderBy: { id: "desc" },
          }).catch(() => null);
          if (lastPo?.price && Number(lastPo.price) > 0) {
            pPrice = Number(lastPo.price);
          }
        }
        if (pPrice <= 0 && receiving.supplierPo?.total) {
          const totalPo = Number(receiving.supplierPo.total);
          const totalQty = (receiving.items || []).reduce((s, it) => s + (Number(it.qtyReceived) || 1), 0) || 1;
          pPrice = Math.round(totalPo / totalQty);
        }
        if (pPrice <= 0) {
          pPrice = 100_000;
        }
        if (item.productId) {
          const updateData: any = {};
          if (!item.product?.avgCost || Number(item.product.avgCost) <= 0) {
            updateData.avgCost = pPrice;
          }
          if (!item.product?.purchasePrice || Number(item.product.purchasePrice) <= 0) {
            updateData.purchasePrice = pPrice;
          }
          if (Object.keys(updateData).length > 0) {
            await this.prisma.main.product.update({
              where: { id: item.productId },
              data: updateData,
            }).catch(() => {});
          }
        }
        totalVal += Number(item.qtyReceived || 0) * pPrice;
      }
      if (totalVal <= 0) return;

      const mappings = await this.mappingService.getAll();
      const { PostingRules } = await import("../accounting/posting.rules.js");
      const rLines = PostingRules.buildReceivingLines(
        {
          number: receiving.number,
          supplierId: receiving.supplierPo?.supplierId || 0,
          totalValue: Math.round(totalVal),
          projectId: receiving.projectId,
        },
        mappings,
      );
      await this.postingService.post({
        sourceType: "Receiving",
        sourceId: receiving.id,
        event: "received",
        source: "RECEIVING",
        date: receiving.date,
        memo: `Penerimaan Barang BPB ${receiving.number}`,
        refNo: receiving.number,
        projectId: receiving.projectId,
        createdById: userId ?? receiving.receiverId,
        lines: rLines,
      });
    } catch (err) {
      console.error(`Posting receiving #${id} error:`, err);
    }
  }
}
