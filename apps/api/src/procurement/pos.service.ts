import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { DocumentNumberService } from "../document-number/document-number.service.js";
import { ApprovalsService } from "../approvals/approvals.service.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip } from "../common/utils/query.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { PoDto, PoListQuery, ShipmentDto } from "./dto.js";
import { can } from "../rbac/permissions.js";
import {
  assertPoCanBeCreatedFromPr,
  assertPoShipmentTransition,
} from "./purchase-flow.js";

type PoMeta = {
  supplierSoNumber?: string | null;
  soFileId: number | null;
  manualStatus: string | null;
  ppnMode: string | null;
  dpp: number | null;
  ppn: number | null;
  pphMode: string | null;
  tipePph: string | null;
  pph: number | null;
};

@Injectable()
export class PosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly docnum: DocumentNumberService,
    private readonly approvals: ApprovalsService,
  ) {
    this.approvals.onChange("SUPPLIER_PO", (entityId, status) => this.onApproval(entityId, status));
  }

  private async onApproval(entityId: number, status: "MENUNGGU" | "DISETUJUI" | "DITOLAK") {
    const row = await this.prisma.main.supplierPO.findUnique({ where: { id: entityId } });
    if (!row) return;
    if (row.status !== "MENUNGGU_PERSETUJUAN") return;

    if (status === "DISETUJUI") {
      const updated = await this.prisma.main.supplierPO.update({
        where: { id: entityId },
        data: { status: "DISETUJUI" },
      });
      if (row.requestId) {
        await this.prisma.main.purchaseRequest.updateMany({
          where: { id: row.requestId, status: "DISETUJUI" },
          data: { status: "PO_DIBUAT" },
        });
      }
      await this.notifications.notify({
        userIds: [row.createdById].filter((v): v is number => !!v),
        kind: "STOK",
        text: `PO supplier ${row.number} disetujui — siap dikirim ke supplier`,
        href: `/procurement/po/${entityId}`,
      });
      if (updated.projectId) {
        const project = await this.prisma.main.project.findUnique({ where: { id: updated.projectId } });
        if (project) {
          await this.notifications.notify({
            userIds: [project.picId],
            kind: "STOK",
            text: `Pembelian langsung untuk project ${project.name} disetujui (${row.number})`,
            href: `/procurement/po/${entityId}`,
          });
        }
      }
    } else if (status === "DITOLAK") {
      await this.prisma.main.supplierPO.update({ where: { id: entityId }, data: { status: "DITOLAK" } });
    }
  }

  suggestNumber() {
    return this.docnum.suggest("pesanan");
  }

  /** Metadata PO sekarang kolom SupplierPO (dulu JSON di SystemSetting). */
  private metaOf(row: {
    supplierSoNumber?: string | null;
    soFileId?: number | null;
    manualStatus?: string | null;
    ppnMode?: string | null;
    dpp?: unknown;
    ppn?: unknown;
    pphMode?: string | null;
    tipePph?: string | null;
    pph?: unknown;
  }): PoMeta {
    const n = (v: unknown) => (v == null ? null : Number(v));
    return {
      supplierSoNumber: row.supplierSoNumber ?? undefined,
      soFileId: row.soFileId ?? null,
      manualStatus: row.manualStatus ?? null,
      ppnMode: row.ppnMode ?? null,
      dpp: n(row.dpp),
      ppn: n(row.ppn),
      pphMode: row.pphMode ?? null,
      tipePph: row.tipePph ?? null,
      pph: n(row.pph),
    };
  }

  private async saveMeta(id: number, patch: Partial<PoMeta>) {
    await this.prisma.main.supplierPO.update({
      where: { id },
      data: {
        ...(patch.supplierSoNumber !== undefined ? { supplierSoNumber: patch.supplierSoNumber } : {}),
        ...(patch.soFileId !== undefined ? { soFileId: patch.soFileId } : {}),
        ...(patch.manualStatus !== undefined ? { manualStatus: patch.manualStatus } : {}),
        ...(patch.ppnMode !== undefined ? { ppnMode: patch.ppnMode } : {}),
        ...(patch.dpp !== undefined ? { dpp: patch.dpp } : {}),
        ...(patch.ppn !== undefined ? { ppn: patch.ppn } : {}),
        ...(patch.pphMode !== undefined ? { pphMode: patch.pphMode } : {}),
        ...(patch.tipePph !== undefined ? { tipePph: patch.tipePph } : {}),
        ...(patch.pph !== undefined ? { pph: patch.pph } : {}),
      },
    });
  }

  async list(q: PoListQuery) {
    const where = {
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.shipmentStatus ? { shipmentStatus: q.shipmentStatus as never } : {}),
      ...(q.supplierId ? { supplierId: q.supplierId } : {}),
      ...(q.requestId ? { requestId: q.requestId } : {}),
      ...(q.projectId ? { projectId: q.projectId } : {}),
      ...(q.from || q.to
        ? { date: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } }
        : {}),
      ...(q.q
        ? {
            OR: [
              { number: { contains: q.q } },
              { supplier: { name: { contains: q.q } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.main.supplierPO.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          request: { select: { id: true, number: true, purpose: true, status: true, paymentStatus: true, paymentProofFileId: true, otherNote: true, costType: true, procurementSource: true, paymentMethod: true, projectId: true } },
          project: { select: { id: true, name: true } },
          creator: { select: { id: true, name: true } },
          items: { include: { product: { select: { id: true, sku: true, name: true, unit: true, hasSerial: true } } } },
          receivings: {
            select: { id: true, number: true, status: true, date: true, warehouseId: true, receiptFileId: true, photoFileId: true },
            orderBy: { id: "desc" },
          },
          invoiceIns: {
            select: {
              id: true,
              number: true,
              status: true,
              amount: true,
              ppn: true,
              total: true,
              paidAmount: true,
              dueDate: true,
              createdAt: true,
              payments: { select: { id: true, method: true, reference: true, amount: true, date: true, createdAt: true } },
            },
          },
          _count: { select: { items: true, receivings: true } },
        },
        orderBy: orderBy(q.sort, q.dir, ["date", "createdAt"], "date"),
        ...pageSkip(q),
      }),
      this.prisma.main.supplierPO.count({ where }),
    ]);
    const enriched = await Promise.all(
      items.map(async (r) => {
        const m = this.metaOf(r);
        const recWithDo = (r.receivings ?? []).find((rc) => rc.receiptFileId || rc.photoFileId);
        const fallbackDoFileId = recWithDo?.receiptFileId ?? recWithDo?.photoFileId ?? null;
        const rawNum = String(r.number || "");
        const normalizedNumber = rawNum.replace(/^(?:POD|PO-S)\//i, "PO/");

        let linkedReq = r.request;

        const isManualLunas = m.manualStatus === "LUNAS";
        const isManualBelumLunas = m.manualStatus === "SAMPAI_BELUM_LUNAS";

        const isPrPaid =
          !isManualBelumLunas &&
          ((linkedReq as any)?.status === "DIBAYAR" || (linkedReq as any)?.paymentStatus === "DIBAYAR");
        const isInvoicePaid =
          !isManualBelumLunas &&
          Array.isArray(r.invoiceIns) &&
          r.invoiceIns.some(
            (inv: any) =>
              inv.status === "PAID" ||
              (Number(inv.paidAmount || 0) >= Number(inv.total || 0) && Number(inv.total || 0) > 0)
          );
        const isPaid = isManualLunas || (!isManualBelumLunas && (isPrPaid || isInvoicePaid));
        return {
          ...r,
          requestId: r.requestId,
          request: linkedReq,
          number: normalizedNumber || r.number,
          doFileId: r.doFileId ?? fallbackDoFileId,
          supplierSoNumber: m.supplierSoNumber ? String(m.supplierSoNumber).replace(/^SO-S\//i, "SO/") : null,
          soFileId: m.soFileId ?? null,
          manualStatus: m.manualStatus ?? null,
          ppnMode: m.ppnMode ?? null,
          ppn: m.ppn ?? null,
          dpp: m.dpp ?? null,
          pphMode: m.pphMode ?? null,
          tipePph: m.tipePph ?? null,
          pph: m.pph ?? null,
          isPaid,
        };
      })
    );
    return paginate(enriched, total, q);
  }

  async get(id: number) {
    const row = await this.prisma.main.supplierPO.findUnique({
      where: { id },
      include: {
        supplier: true,
        creator: { select: { id: true, name: true } },
        request: { select: { id: true, number: true, purpose: true, status: true, paymentStatus: true, paymentProofFileId: true, otherNote: true, costType: true, procurementSource: true, paymentMethod: true, projectId: true } },
        project: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, sku: true, name: true, unit: true, hasSerial: true } } } },
        receivings: {
          select: { id: true, number: true, status: true, date: true, warehouseId: true, receiptFileId: true, photoFileId: true },
          orderBy: { id: "desc" },
        },
        invoiceIns: {
          select: {
            id: true,
            number: true,
            status: true,
            amount: true,
            ppn: true,
            total: true,
            paidAmount: true,
            dueDate: true,
            createdAt: true,
            payments: { select: { id: true, method: true, reference: true, amount: true, date: true, createdAt: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException("PO supplier tidak ditemukan");
    const approval = await this.approvals.getFor("SUPPLIER_PO", id);
    const meta = this.metaOf(row);
    const recWithDo = (row.receivings ?? []).find((rc) => rc.receiptFileId || rc.photoFileId);
    const fallbackDoFileId = recWithDo?.receiptFileId ?? recWithDo?.photoFileId ?? null;
    const rawNum = String(row.number || "");
    const normalizedNumber = rawNum.replace(/^(?:POD|PO-S)\//i, "PO/");
    let linkedReq = row.request;
    const isManualLunas = meta.manualStatus === "LUNAS";
    const isManualBelumLunas = meta.manualStatus === "SAMPAI_BELUM_LUNAS";

    const isPrPaid =
      !isManualBelumLunas &&
      ((linkedReq as any)?.status === "DIBAYAR" || (linkedReq as any)?.paymentStatus === "DIBAYAR");
    const isInvoicePaid =
      !isManualBelumLunas &&
      Array.isArray(row.invoiceIns) &&
      row.invoiceIns.some(
        (inv: any) =>
          inv.status === "PAID" ||
          (Number(inv.paidAmount || 0) >= Number(inv.total || 0) && Number(inv.total || 0) > 0)
      );
    const isPaid = isManualLunas || (!isManualBelumLunas && (isPrPaid || isInvoicePaid));
    return {
      ...row,
      requestId: row.requestId,
      request: linkedReq,
      number: normalizedNumber || row.number,
      doFileId: row.doFileId ?? fallbackDoFileId,
      supplierSoNumber: meta.supplierSoNumber ? String(meta.supplierSoNumber).replace(/^SO-S\//i, "SO/") : null,
      soFileId: meta.soFileId ?? null,
      manualStatus: meta.manualStatus ?? null,
      ppnMode: meta.ppnMode ?? null,
      ppn: meta.ppn ?? null,
      dpp: meta.dpp ?? null,
      pphMode: meta.pphMode ?? null,
      tipePph: meta.tipePph ?? null,
      pph: meta.pph ?? null,
      isPaid,
      approval,
    };
  }

  async create(dto: PoDto, user: RequestUser) {
    if (!can(user.role, "procurement", "C")) {
      throw new ForbiddenException("Anda tidak memiliki hak akses (RBAC) untuk membuat PO supplier");
    }
    let parentPr: { id: number; status: string; procurementSource: string | null } | null = null;
    if (dto.requestId) {
      parentPr = await this.prisma.main.purchaseRequest.findUnique({
        where: { id: dto.requestId },
        select: { id: true, status: true, procurementSource: true },
      });
      if (!parentPr) throw new NotFoundException("Request barang tidak ditemukan");
      assertPoCanBeCreatedFromPr(parentPr);
    }
    const supplier = dto.supplierId
      ? await this.prisma.main.supplier.findUnique({ where: { id: dto.supplierId } })
      : await this.prisma.main.supplier.findFirst({ where: { status: "AKTIF" } });
    if (!supplier) throw new NotFoundException("Supplier tidak ditemukan");

    let projectId = dto.projectId;
    if (!projectId && dto.requestId) {
      const request = await this.prisma.main.purchaseRequest.findUnique({ where: { id: dto.requestId } });
      projectId = request?.projectId ?? undefined;
    }

    let items = dto.items ?? [];
    if (!items.length) {
      const firstProduct = await this.prisma.main.product.findFirst();
      if (firstProduct) {
        items = [{ productId: firstProduct.id, qty: 1, price: dto.total ?? 0 }];
      }
    }

    const resolvedItems: any[] = [];
    for (const i of items) {
      let prodId = i.productId ? Number(i.productId) : null;
      const isNonInv = Boolean(
        (i as any).isNonInventory ||
        (i as any).itemType === "JASA" ||
        (i as any).itemType === "NON_STOK" ||
        /^\[(JASA|NON[-_ ]?STOK)\]/i.test(String(i.customName || (i as any).name || ""))
      );
      if (!prodId && !isNonInv && (i.customName || (i as any).name)) {
        const prodName = String(i.customName || (i as any).name).trim();
        const existing = await this.prisma.main.product.findFirst({
          where: { name: { equals: prodName } },
        });
        if (existing) {
          prodId = existing.id;
        } else {
          const newSku = (i as any).sku || `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          const createdProd = await this.prisma.main.product.create({
            data: {
              name: prodName,
              sku: newSku,
              unit: i.customUnit || (i as any).unit || "unit",
              hasSerial: Boolean((i as any).hasSerial ?? (i as any).berSN),
              categoryId: (i as any).categoryId ? Number((i as any).categoryId) : null,
              purchasePrice: Number(i.price) || 0,
              price: Number((i as any).sellPrice || i.price) || 0,
              minStock: 0,
            },
          });
          prodId = createdProd.id;
          this.notifications.dataChange("products", "create", createdProd.id);
        }
      }
      resolvedItems.push({
        productId: prodId,
        customName: i.customName ?? (i as any).name ?? null,
        customUnit: i.customUnit ?? (i as any).unit ?? null,
        qty: Number(i.qty) || 1,
        price: Number(i.price) || 0,
      });
    }

    let number = dto.number?.trim();
    if (number) {
      const dup = await this.prisma.main.supplierPO.findFirst({ where: { number } });
      if (dup) {
        const isAutoPattern = /^(PO|POD|PO-S)\/\d{4}\/\d{2}\/\d+$/i.test(number);
        if (isAutoPattern) {
          number = await this.docnum.next("pesanan", dto.date ? new Date(dto.date) : new Date());
        } else {
          throw new ConflictException(`Nomor ${number} sudah dipakai`);
        }
      }
    } else {
      number = await this.docnum.next("pesanan", dto.date ? new Date(dto.date) : new Date());
    }
    const total = dto.total ?? resolvedItems.reduce((s, i) => s + i.qty * i.price, 0);

    // PO dari request yang sudah disetujui Finance otomatis disetujui. PO mandiri wajib melalui persetujuan;
    // klien tidak boleh menyetujui sendiri lewat body.
    const targetStatus = parentPr ? "DISETUJUI" : "MENUNGGU_PERSETUJUAN";

    const row = await this.prisma.main.supplierPO.create({
      data: {
        number,
        supplierId: supplier.id,
        requestId: dto.requestId,
        projectId,
        date: dto.date ? new Date(dto.date) : new Date(),
        eta: dto.eta ? new Date(dto.eta) : undefined,
        paymentTerms: dto.paymentTerms,
        total,
        status: targetStatus,
        shipmentStatus: dto.shipmentStatus ?? "DI_SUPPLIER",
        fileId: dto.fileId,
        doFileId: dto.doFileId,
        createdById: user.id,
        items: {
          create: resolvedItems.map((i) => ({
            productId: i.productId ?? null,
            customName: i.customName ?? null,
            customUnit: i.customUnit ?? null,
            qty: i.qty,
            price: i.price,
          })),
        },
      },
      include: {
        supplier: true,
        request: { select: { id: true, number: true, purpose: true, costType: true, procurementSource: true, paymentMethod: true, projectId: true } },
        project: { select: { id: true, name: true } },
      },
    });
    if (dto.fileId) {
      await this.prisma.main.file.update({
        where: { id: dto.fileId },
        data: { refType: "supplier-po", refId: String(row.id) },
      }).catch(() => {});
    }
    if (dto.soFileId) {
      await this.prisma.main.file.update({
        where: { id: dto.soFileId },
        data: { refType: "supplier-so", refId: String(row.id) },
      }).catch(() => {});
    }
    if (dto.doFileId) {
      await this.prisma.main.receiving
        .updateMany({
          where: { supplierPoId: row.id },
          data: { receiptFileId: dto.doFileId },
        })
        .catch(() => {});
      this.notifications.dataChange("receiving", "update", row.id);
    }
    if (
      dto.supplierSoNumber !== undefined ||
      dto.soFileId !== undefined ||
      dto.ppnMode !== undefined ||
      dto.ppn !== undefined ||
      dto.dpp !== undefined ||
      dto.pphMode !== undefined ||
      dto.tipePph !== undefined ||
      dto.pph !== undefined
    ) {
      await this.saveMeta(row.id, {
        ...(dto.supplierSoNumber !== undefined ? { supplierSoNumber: dto.supplierSoNumber } : {}),
        ...(dto.soFileId !== undefined ? { soFileId: dto.soFileId } : {}),
        ...(dto.ppnMode !== undefined ? { ppnMode: dto.ppnMode } : {}),
        ...(dto.ppn !== undefined ? { ppn: dto.ppn } : {}),
        ...(dto.dpp !== undefined ? { dpp: dto.dpp } : {}),
        ...(dto.pphMode !== undefined ? { pphMode: dto.pphMode } : {}),
        ...(dto.tipePph !== undefined ? { tipePph: dto.tipePph } : {}),
        ...(dto.pph !== undefined ? { pph: dto.pph } : {}),
      });
    }

    await this.audit.log({
      actor: user,
      action: "BUAT_PO_SUPPLIER",
      entityType: "supplier-po",
      entityId: row.id,
      detail: `${number} — ${supplier.name} Rp${total}`,
    });
    if (targetStatus !== "DISETUJUI") {
      await this.notifications.notify({
        roles: ["FINANCE"],
        kind: "APPROVAL",
        text: `PO supplier menunggu persetujuan: ${number} (Rp${total})`,
        href: `/procurement/po/${row.id}`,
      });
    }
    const approval = await this.approvals.request({
      kind: "SUPPLIER_PO",
      entityId: row.id,
      title: `PO supplier ${number}`,
      amount: total,
      requestedBy: user,
      href: `/procurement/po/${row.id}`,
    });
    if (targetStatus === "DISETUJUI") {
      await this.prisma.main.approval.update({
        where: { id: approval.id },
        data: { status: "DISETUJUI" },
      }).catch(() => {});
      await this.prisma.main.approvalStep.updateMany({
        where: { approvalId: approval.id },
        data: { status: "DISETUJUI", decidedById: user.id, decidedAt: new Date() },
      }).catch(() => {});
      this.notifications.dataChange("approvals", "update", approval.id);
    }

    if (dto.requestId) {
      await this.prisma.main.purchaseRequest.updateMany({
        where: { id: dto.requestId, status: "DISETUJUI" },
        data: { status: "PO_DIBUAT" },
      }).catch(() => {});
      this.notifications.dataChange("purchase-requests", "status", dto.requestId);
      this.notifications.dataChange("purchase-requests", "update", dto.requestId);
    }

    this.notifications.dataChange("supplier-pos", "create", row.id);
    return row;
  }

  async update(id: number, dto: PoDto, user: RequestUser) {
    const row = await this.prisma.main.supplierPO.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("PO supplier tidak ditemukan");
    if (!can(user.role, "procurement", "U")) {
      throw new ForbiddenException("Anda tidak memiliki hak akses (RBAC) untuk mengubah PO supplier");
    }
    // Status & pengiriman hanya lewat endpoint khusus (/status, /shipment) agar urutan alur divalidasi.
    const wantsShipment = dto.shipmentStatus && dto.shipmentStatus !== row.shipmentStatus;
    if (wantsShipment) {
      await this.setShipment(id, { shipmentStatus: dto.shipmentStatus as never } as ShipmentDto, user);
    }
    // Isi PO terkunci setelah disetujui / dikirim.
    const touchesContent =
      (Array.isArray(dto.items) && dto.items.length > 0) ||
      dto.supplierId !== undefined ||
      dto.total !== undefined ||
      dto.requestId !== undefined;
    if (touchesContent && (row.status === "DISETUJUI" || row.shipmentStatus !== "DI_SUPPLIER")) {
      throw new BadRequestException("PO yang sudah disetujui / dikirim tidak bisa diubah isinya");
    }

    if (Array.isArray(dto.items) && dto.items.length > 0) {
      await this.prisma.main.supplierPOItem.deleteMany({ where: { poId: id } });
      await this.prisma.main.supplierPOItem.createMany({
        data: dto.items.map((i) => ({
          poId: id,
          productId: i.productId ?? null,
          customName: i.customName ?? null,
          customUnit: i.customUnit ?? null,
          qty: i.qty,
          price: i.price,
        })),
      });
    }

    // Perubahan status lewat body sudah ditangani/ditolak di atas; tidak ditulis langsung ke database.
    if (dto.status && dto.status !== row.status) {
      await this.setStatus(id, dto.status, user);
    }
    const poStatus: any = undefined;
    const shipmentStatus: any = undefined;

    const updated = await this.prisma.main.supplierPO.update({
      where: { id },
      data: {
        ...(dto.number ? { number: dto.number } : {}),
        ...(dto.supplierId ? { supplierId: dto.supplierId } : {}),
        ...(dto.requestId !== undefined ? { requestId: dto.requestId } : {}),
        ...(dto.projectId !== undefined ? { projectId: dto.projectId } : {}),
        ...(dto.date ? { date: new Date(dto.date) } : {}),
        ...(dto.eta !== undefined ? { eta: dto.eta ? new Date(dto.eta) : null } : {}),
        ...(dto.paymentTerms !== undefined ? { paymentTerms: dto.paymentTerms } : {}),
        ...(dto.total !== undefined ? { total: dto.total } : {}),
        ...(poStatus ? { status: poStatus } : {}),
        ...(shipmentStatus ? { shipmentStatus, ...(shipmentStatus === "SAMPAI" ? { arrivedAt: new Date() } : {}) } : {}),
        ...(dto.fileId !== undefined ? { fileId: dto.fileId } : {}),
        ...(dto.doFileId !== undefined ? { doFileId: dto.doFileId } : {}),
      },
      include: {
        supplier: true,
        request: { select: { id: true, number: true, purpose: true } },
        project: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, sku: true, name: true, unit: true, hasSerial: true } } } },
      },
    });

    // Sinkronisasi status pengiriman ke Purchase Request terkait
    let reqId = row.requestId;
    if (shipmentStatus === "DIKIRIM" && reqId) {
      await this.prisma.main.purchaseRequest.updateMany({
        where: { id: reqId, status: { notIn: ["DIKIRIM", "DITERIMA", "DIBATALKAN"] } },
        data: { status: "DIKIRIM" },
      }).catch(() => {});
      this.notifications.dataChange("purchase-requests", "status", reqId);
    } else if (shipmentStatus === "SAMPAI" && reqId) {
      await this.prisma.main.purchaseRequest.updateMany({
        where: { id: reqId, status: { notIn: ["DIBATALKAN"] } },
        data: { status: "DITERIMA" },
      }).catch(() => {});
      this.notifications.dataChange("purchase-requests", "status", reqId);
    }
    if (dto.doFileId) {
      await this.prisma.main.receiving
        .updateMany({
          where: { supplierPoId: row.id },
          data: { receiptFileId: dto.doFileId },
        })
        .catch(() => {});
      this.notifications.dataChange("receiving", "update", row.id);
    }
    if (
      dto.supplierSoNumber !== undefined ||
      dto.soFileId !== undefined ||
      dto.ppnMode !== undefined ||
      dto.ppn !== undefined ||
      dto.dpp !== undefined ||
      dto.pphMode !== undefined ||
      dto.tipePph !== undefined ||
      dto.pph !== undefined
    ) {
      await this.saveMeta(id, {
        ...(dto.supplierSoNumber !== undefined ? { supplierSoNumber: dto.supplierSoNumber } : {}),
        ...(dto.soFileId !== undefined ? { soFileId: dto.soFileId } : {}),
        ...(dto.ppnMode !== undefined ? { ppnMode: dto.ppnMode } : {}),
        ...(dto.ppn !== undefined ? { ppn: dto.ppn } : {}),
        ...(dto.dpp !== undefined ? { dpp: dto.dpp } : {}),
        ...(dto.pphMode !== undefined ? { pphMode: dto.pphMode } : {}),
        ...(dto.tipePph !== undefined ? { tipePph: dto.tipePph } : {}),
        ...(dto.pph !== undefined ? { pph: dto.pph } : {}),
      });
    }
    if (dto.soFileId) {
      await this.prisma.main.file.update({
        where: { id: dto.soFileId },
        data: { refType: "supplier-so", refId: String(id) },
      }).catch(() => {});
    }
    this.notifications.dataChange("supplier-pos", "update", updated.id);
    return this.get(id);
  }

  async setStatus(id: number, status: string, user: RequestUser) {
    const row = await this.prisma.main.supplierPO.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("PO supplier tidak ditemukan");
    const shipmentStatuses = ["BELUM_DIKIRIM", "DIKIRIM", "DALAM_PERJALANAN", "SAMPAI", "DI_SUPPLIER"];
    const isLunas = status === "LUNAS" || status === "DIBAYAR" || status === "SELESAI";
    const isBelumLunas = status === "SAMPAI_BELUM_LUNAS" || status === "BELUM_LUNAS";

    // Pengiriman: lewat aturan yang sama dengan endpoint /shipment (urutan & peran divalidasi di sana).
    if (shipmentStatuses.includes(status)) {
      const eff = status === "BELUM_DIKIRIM" ? "DI_SUPPLIER" : status === "DALAM_PERJALANAN" ? "DIKIRIM" : status;
      await this.setShipment(id, { shipmentStatus: eff } as ShipmentDto, user);
      return this.get(id);
    }
    if (status === "DIBATALKAN") {
      await this.cancel(id, user);
      return this.get(id);
    }
    if (status === "DISETUJUI" || status === "DITOLAK") {
      throw new BadRequestException("Persetujuan PO dilakukan Finance lewat menu Persetujuan");
    }
    if (!isLunas && !isBelumLunas) {
      throw new BadRequestException(`Status PO "${status}" tidak dapat diubah manual`);
    }

    // Pembayaran PO: dicek lewat izin RBAC financeOut atau procurement
    if (!can(user.role, "financeOut", "U") && !can(user.role, "procurement", "U")) {
      throw new ForbiddenException("Anda tidak memiliki hak akses (RBAC) untuk mencatat pembayaran PO");
    }
    if (row.status !== "DISETUJUI") {
      throw new BadRequestException("PO belum disetujui, pembayaran belum bisa dicatat");
    }
    if (isBelumLunas && row.shipmentStatus !== "SAMPAI") {
      throw new BadRequestException("Barang belum diterima Gudang, status 'Sampai (Belum Lunas)' belum berlaku");
    }
    await this.saveMeta(id, { manualStatus: isLunas ? "LUNAS" : "SAMPAI_BELUM_LUNAS" });

    if (row.requestId && isLunas) {
      // Request yang belum dikirim naik ke DIBAYAR; yang sudah jalan hanya dicatat lunas (status alur tidak mundur).
      await this.prisma.main.purchaseRequest
        .updateMany({
          where: { id: row.requestId, status: { in: ["DISETUJUI", "PO_DIBUAT"] } },
          data: { status: "DIBAYAR", paymentStatus: "DIBAYAR" },
        })
        .catch(() => {});
      await this.prisma.main.purchaseRequest
        .updateMany({
          where: { id: row.requestId, status: { in: ["DIBAYAR", "DIKIRIM", "DITERIMA"] } },
          data: { paymentStatus: "DIBAYAR" },
        })
        .catch(() => {});
      this.notifications.dataChange("purchase-requests", "status", row.requestId);
      this.notifications.dataChange("purchase-requests", "update", row.requestId);
    }

    await this.audit.log({
      actor: user,
      action: "CATAT_PEMBAYARAN_PO",
      entityType: "supplier-po",
      entityId: id,
      detail: `${row.number}: ${isLunas ? "Lunas" : "Sampai (Belum Lunas)"}`,
    });
    this.notifications.dataChange("supplier-pos", "status", id);
    this.notifications.dataChange("supplier-pos", "update", id);
    return this.get(id);
  }

  /** Tracking pengiriman diubah manual oleh Procurement (PRD). */
  async setShipment(id: number, dto: ShipmentDto, user: RequestUser) {
    const row = await this.prisma.main.supplierPO.findUnique({
      where: { id },
      include: {
        request: {
          select: {
            status: true,
            requesterId: true,
            procurementSource: true,
            paymentMethod: true,
            paymentStatus: true,
            paymentProofFileId: true,
            otherNote: true,
          },
        },
      },
    });
    if (!row) throw new NotFoundException("PO supplier tidak ditemukan");

    const rawShipment = String(dto.shipmentStatus);
    const effShipment: "DI_SUPPLIER" | "DIKIRIM" | "SAMPAI" =
      rawShipment === "BELUM_DIKIRIM"
        ? "DI_SUPPLIER"
        : rawShipment === "DALAM_PERJALANAN"
        ? "DIKIRIM"
        : dto.shipmentStatus;
    // Urutan: PO disetujui -> (tunai: dibayar Finance) -> Procurement tandai DIKIRIM -> Gudang terima (SAMPAI).
    assertPoShipmentTransition(row, effShipment, user, row.request);

    if (dto.doFileId) {
      await this.prisma.main.file.update({
        where: { id: dto.doFileId },
        data: { refType: "supplier-po-do", refId: String(id) },
      }).catch(() => {});
    }
    const updated = await this.prisma.main.supplierPO.update({
      where: { id },
      data: {
        shipmentStatus: effShipment as never,
        ...(dto.doFileId ? { doFileId: dto.doFileId } : {}),
      },
      include: { supplier: { select: { id: true, name: true } } },
    });
    await this.audit.log({
      actor: user,
      action: "UBAH_STATUS_PENGIRIMAN",
      entityType: "supplier-po",
      entityId: id,
      detail: `${row.number}: → ${dto.shipmentStatus}`,
    });
    if (dto.shipmentStatus !== row.shipmentStatus) {
      await this.notifications.notify({
        roles: ["GUDANG"],
        kind: "STOK",
        text: `Pengiriman ${row.number} (${updated.supplier.name}): ${dto.shipmentStatus}`,
        href: `/procurement/po/${id}`,
      });
    }

    let reqId = row.requestId;

    if (effShipment === "DIKIRIM" && reqId) {
      await this.prisma.main.purchaseRequest.updateMany({
        where: { id: reqId, status: { notIn: ["DIKIRIM", "DITERIMA", "DIBATALKAN"] } },
        data: { status: "DIKIRIM" },
      }).catch(() => {});
      this.notifications.dataChange("purchase-requests", "status", reqId);
      this.notifications.dataChange("purchase-requests", "update", reqId);
    } else if (effShipment === "SAMPAI" && reqId) {
      await this.prisma.main.purchaseRequest.updateMany({
        where: { id: reqId, status: { notIn: ["DIBATALKAN"] } },
        data: { status: "DITERIMA" },
      }).catch(() => {});
      this.notifications.dataChange("purchase-requests", "status", reqId);
      this.notifications.dataChange("purchase-requests", "update", reqId);
    }

    if (effShipment === "DIKIRIM") {
      await this.ensureReceivingCreated(id, user, dto.doFileId ?? row.doFileId);
    }

    this.notifications.dataChange("supplier-pos", "status", updated.id);
    return updated;
  }

  /** Procurement menyatakan siap ke PM setelah semua barang diterima. */
  async declareReady(id: number, user: RequestUser) {
    const row = await this.prisma.main.supplierPO.findUnique({
      where: { id },
      include: { items: true, project: true },
    });
    if (!row) throw new NotFoundException("PO supplier tidak ditemukan");
    await this.audit.log({
      actor: user,
      action: "NYATAKAN_SIAP",
      entityType: "supplier-po",
      entityId: id,
      detail: `${row.number} siap untuk project`,
    });
    const targets = [row.project?.picId].filter((v): v is number => !!v);
    if (targets.length) {
      await this.notifications.notify({
        userIds: targets,
        kind: "STOK",
        text: `Barang project siap: ${row.number}${row.project ? ` — ${row.project.name}` : ""}`,
        href: `/procurement/po/${id}`,
      });
    }
    this.notifications.dataChange("supplier-pos", "status", id);
    return { id, ready: true, notified: targets.length };
  }

  async cancel(id: number, user: RequestUser, reason?: string) {
    const row = await this.prisma.main.supplierPO.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("PO supplier tidak ditemukan");
    if (row.status === "DIBATALKAN") return row;
    if (!can(user.role, "procurement", "U") && !can(user.role, "procurement", "A")) {
      throw new ForbiddenException("Anda tidak memiliki hak akses (RBAC) untuk membatalkan PO supplier");
    }
    if (row.shipmentStatus !== "DI_SUPPLIER") {
      throw new BadRequestException("PO yang sudah dikirim / diterima tidak bisa dibatalkan");
    }
    const receivingCount = await this.prisma.main.receiving.count({ where: { supplierPoId: id } });
    if (receivingCount > 0) {
      throw new BadRequestException("PO sudah memiliki dokumen penerimaan, tidak bisa dibatalkan");
    }
    const updated = await this.prisma.main.supplierPO.update({
      where: { id },
      data: { status: "DIBATALKAN" },
    });
    // Bila tidak ada PO aktif lain, request kembali ke Disetujui agar PO baru bisa dibuat.
    if (row.requestId) {
      const stillActive = await this.prisma.main.supplierPO.count({
        where: { requestId: row.requestId, id: { not: id }, status: { notIn: ["DITOLAK", "DIBATALKAN"] } },
      });
      if (stillActive === 0) {
        await this.prisma.main.purchaseRequest
          .updateMany({ where: { id: row.requestId, status: "PO_DIBUAT" }, data: { status: "DISETUJUI" } })
          .catch(() => {});
        this.notifications.dataChange("purchase-requests", "status", row.requestId);
      }
    }
    await this.audit.log({
      actor: user,
      action: "BATALKAN_PO_SUPPLIER",
      entityType: "supplier-po",
      entityId: id,
      detail: `${row.number}${reason ? ` — ${reason}` : ""}`,
    });
    this.notifications.dataChange("supplier-pos", "status", updated.id);
    return updated;
  }

  private async ensureReceivingCreated(poId: number, user: RequestUser, doFileId?: number | null) {
    try {
      const row = await this.prisma.main.supplierPO.findUnique({
        where: { id: poId },
        include: { items: true, supplier: true },
      });
      if (!row) return;

      const existingRec = await this.prisma.main.receiving.findFirst({
        where: {
          OR: [
            { supplierPoId: poId },
            ...(row.requestId ? [{ requestId: row.requestId }] : []),
          ],
        },
      });
      if (!existingRec) {
        const recNumber = await this.docnum.next("penerimaan");
        // Gudang diisi otomatis hanya bila tepat satu gudang aktif; bila lebih, Gudang memilih saat konfirmasi.
        const activeWhs = await this.prisma.main.warehouse.findMany({ where: { status: "AKTIF" }, select: { id: true }, take: 2 });
        const defaultWh = activeWhs.length === 1 ? activeWhs[0] : null;

        const recItems: any[] = [];
        for (const it of row.items) {
          let pId = it.productId;
          if (!pId && it.customName) {
            const matched = await this.prisma.main.product.findFirst({ where: { name: it.customName } });
            if (matched) pId = matched.id;
          }
          if (pId) {
            recItems.push({
              productId: pId,
              qtyOrdered: it.qty,
              qtyReceived: it.qty,
              note: it.customName ? `Item PO: ${it.customName}` : undefined,
            });
          }
        }

        const createdRec = await this.prisma.main.receiving.create({
          data: {
            number: recNumber,
            supplierPoId: poId,
            requestId: row.requestId ?? null,
            supplierName: row.supplier?.name || "Supplier",
            warehouseId: defaultWh?.id ?? null,
            projectId: row.projectId ?? null,
            date: new Date(),
            receiverId: user.id,
            status: "MENUNGGU",
            receiptFileId: doFileId ?? row.doFileId ?? null,
            items: {
              create: recItems,
            },
          },
        });
        this.notifications.dataChange("receiving", "create", createdRec.id);
        await this.notifications.notify({
          roles: ["GUDANG"],
          kind: "STOK",
          text: `Penerimaan baru ${recNumber} otomatis dibuat untuk PO ${row.number}. Cek fisik barang saat tiba.`,
          href: `/receivings/${createdRec.id}`,
        });
      }
    } catch (e) {
      console.warn(`Gagal membuat otomatis penerimaan untuk PO ${poId}:`, (e as Error).message);
    }
  }

  async remove(id: number, user: RequestUser) {
    const row = await this.prisma.main.supplierPO.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("PO supplier tidak ditemukan");
    if (!["MENUNGGU_PERSETUJUAN", "DITOLAK", "DIBATALKAN"].includes(row.status)) {
      throw new BadRequestException("PO yang sudah disetujui tidak bisa dihapus, batalkan terlebih dahulu");
    }
    await this.prisma.main.$transaction(async (tx) => {
      await tx.approval.deleteMany({ where: { kind: "SUPPLIER_PO", entityId: id } });
      await tx.supplierPOItem.deleteMany({ where: { poId: id } });
      await tx.supplierPO.delete({ where: { id } });
    });
    await this.audit.log({
      actor: user,
      action: "HAPUS_PO_SUPPLIER",
      entityType: "supplier-po",
      entityId: id,
      detail: `${row.number} dihapus`,
    });
    this.notifications.dataChange("supplier-pos", "delete", id);
    return { id, deleted: true };
  }
}
