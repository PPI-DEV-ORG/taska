import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { DocumentNumberService } from "../document-number/document-number.service.js";
import { ApprovalsService } from "../approvals/approvals.service.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip } from "../common/utils/query.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { PoDto, PoListQuery, ShipmentDto } from "./dto.js";

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
          where: { id: row.requestId, status: { in: ["DIAJUKAN", "CEK_STOK", "DISETUJUI"] } },
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

  private metaKey(id: number) {
    return `supplier-po:meta:${id}`;
  }

  private async getMetaMap(ids: number[]): Promise<Map<number, { supplierSoNumber?: string; soFileId?: number | null; manualStatus?: string | null }>> {
    const map = new Map<number, { supplierSoNumber?: string; soFileId?: number | null; manualStatus?: string | null }>();
    if (!ids.length) return map;
    const rows = await this.prisma.main.systemSetting.findMany({
      where: { key: { in: ids.map((id) => this.metaKey(id)) } },
    });
    for (const r of rows) {
      try {
        const id = Number(r.key.replace("supplier-po:meta:", ""));
        map.set(id, JSON.parse(r.value));
      } catch {}
    }
    return map;
  }

  private async saveMeta(id: number, patch: { supplierSoNumber?: string; soFileId?: number | null; manualStatus?: string | null }) {
    const key = this.metaKey(id);
    let existing: { supplierSoNumber?: string; soFileId?: number | null; manualStatus?: string | null } = {};
    try {
      const cur = await this.prisma.main.systemSetting.findUnique({ where: { key } });
      if (cur?.value) existing = JSON.parse(cur.value);
    } catch {}
    const merged = { ...existing, ...patch };
    await this.prisma.main.systemSetting
      .upsert({
        where: { key },
        update: { value: JSON.stringify(merged) },
        create: { key, value: JSON.stringify(merged) },
      })
      .catch(() => {});
    return merged;
  }

  private migrationDone = false;
  private async ensurePoMigration() {
    if (this.migrationDone) return;
    this.migrationDone = true;
    try {
      await this.prisma.main.$executeRawUnsafe(`
        INSERT INTO \`SupplierPO\` (\`number\`, \`supplierId\`, \`total\`, \`date\`, \`paymentTerms\`, \`status\`, \`shipmentStatus\`, \`fileId\`, \`createdById\`, \`createdAt\`, \`updatedAt\`)
        SELECT 
          c.number,
          COALESCE(c.supplierId, (SELECT id FROM \`Supplier\` WHERE status = 'AKTIF' ORDER BY id ASC LIMIT 1), (SELECT id FROM \`Supplier\` ORDER BY id ASC LIMIT 1)),
          c.amount,
          c.date,
          'Tempo / Utang',
          'DI_SUPPLIER',
          'DI_SUPPLIER',
          c.fileId,
          (SELECT id FROM \`User\` WHERE role IN ('ADMIN', 'BOS', 'PROCUREMENT', 'FINANCE') ORDER BY id ASC LIMIT 1),
          c.createdAt,
          c.updatedAt
        FROM \`ClientPO\` c
        WHERE (c.number LIKE 'PO/%' OR c.number LIKE 'POD/%' OR c.number LIKE 'PO-%')
          AND c.number NOT IN (SELECT number FROM \`SupplierPO\`)
      `).catch(() => {});
      await this.prisma.main.$executeRawUnsafe(`
        UPDATE \`InvoiceOut\` 
        SET \`clientPoId\` = NULL 
        WHERE \`clientPoId\` IN (
          SELECT id FROM (SELECT id FROM \`ClientPO\` WHERE number LIKE 'PO/%' OR number LIKE 'POD/%' OR number LIKE 'PO-%') as tmp
        )
      `).catch(() => {});
      await this.prisma.main.$executeRawUnsafe(`
        DELETE FROM \`ClientPO\` WHERE number LIKE 'PO/%' OR number LIKE 'POD/%' OR number LIKE 'PO-%'
      `).catch(() => {});
    } catch {}
  }

  async list(q: PoListQuery) {
    await this.ensurePoMigration();
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
    const metaMap = await this.getMetaMap(items.map((r) => r.id));
    const enriched = await Promise.all(
      items.map(async (r) => {
        const m = metaMap.get(r.id) ?? {};
        const recWithDo = (r.receivings ?? []).find((rc) => rc.receiptFileId || rc.photoFileId);
        const fallbackDoFileId = recWithDo?.receiptFileId ?? recWithDo?.photoFileId ?? null;
        const rawNum = String(r.number || "");
        const normalizedNumber = rawNum.replace(/^(?:POD|PO-S)\//i, "PO/");
        if (normalizedNumber !== rawNum && normalizedNumber) {
          void this.prisma.main.supplierPO
            .update({ where: { id: r.id }, data: { number: normalizedNumber } })
            .catch(() => {});
        }

        let linkedReq = r.request;
        if (!r.requestId) {
          const suffix = (normalizedNumber || rawNum).replace(/^(?:POD|PO-S|PO)\//i, "");
          const matchedPr = await this.prisma.main.purchaseRequest.findFirst({
            where: {
              OR: [
                { number: `PNJ/${suffix}` },
                { number: { endsWith: suffix } },
              ],
            },
            select: {
              id: true,
              number: true,
              purpose: true,
              status: true,
              paymentStatus: true,
              paymentProofFileId: true,
              otherNote: true,
              costType: true,
              procurementSource: true,
              paymentMethod: true,
              projectId: true,
            },
          });
          if (matchedPr) {
            r.requestId = matchedPr.id;
            linkedReq = matchedPr;
            void this.prisma.main.supplierPO
              .update({ where: { id: r.id }, data: { requestId: matchedPr.id } })
              .catch(() => {});
          }
        }

        const isManualLunas = m.manualStatus === "LUNAS";
        const isManualBelumLunas = m.manualStatus === "SAMPAI_BELUM_LUNAS";

        const isPrPaid =
          !isManualBelumLunas &&
          ((linkedReq as any)?.status === "DIBAYAR" ||
          (linkedReq as any)?.paymentStatus === "DIBAYAR" ||
          !!(linkedReq as any)?.paymentProofFileId ||
          Boolean((linkedReq as any)?.otherNote?.includes("[DIBAYAR")));
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
    const [approval, metaMap] = await Promise.all([
      this.approvals.getFor("SUPPLIER_PO", id),
      this.getMetaMap([id]),
    ]);
    const meta = metaMap.get(id) ?? {};
    const recWithDo = (row.receivings ?? []).find((rc) => rc.receiptFileId || rc.photoFileId);
    const fallbackDoFileId = recWithDo?.receiptFileId ?? recWithDo?.photoFileId ?? null;
    const rawNum = String(row.number || "");
    const normalizedNumber = rawNum.replace(/^(?:POD|PO-S)\//i, "PO/");
    if (normalizedNumber !== rawNum && normalizedNumber) {
      void this.prisma.main.supplierPO
        .update({ where: { id: row.id }, data: { number: normalizedNumber } })
        .catch(() => {});
    }
    let linkedReq = row.request;
    if (!row.requestId) {
      const suffix = (normalizedNumber || rawNum).replace(/^(?:POD|PO-S|PO)\//i, "");
      const matchedPr = await this.prisma.main.purchaseRequest.findFirst({
        where: {
          OR: [
            { number: `PNJ/${suffix}` },
            { number: { endsWith: suffix } },
          ],
        },
        select: {
          id: true,
          number: true,
          purpose: true,
          status: true,
          paymentStatus: true,
          paymentProofFileId: true,
          otherNote: true,
          costType: true,
          procurementSource: true,
          paymentMethod: true,
          projectId: true,
        },
      });
      if (matchedPr) {
        row.requestId = matchedPr.id;
        linkedReq = matchedPr as any;
        void this.prisma.main.supplierPO
          .update({ where: { id: row.id }, data: { requestId: matchedPr.id } })
          .catch(() => {});
      }
    }
    const isManualLunas = meta.manualStatus === "LUNAS";
    const isManualBelumLunas = meta.manualStatus === "SAMPAI_BELUM_LUNAS";

    const isPrPaid =
      !isManualBelumLunas &&
      ((linkedReq as any)?.status === "DIBAYAR" ||
      (linkedReq as any)?.paymentStatus === "DIBAYAR" ||
      !!(linkedReq as any)?.paymentProofFileId ||
      Boolean((linkedReq as any)?.otherNote?.includes("[DIBAYAR")));
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
      isPaid,
      approval,
    };
  }

  async create(dto: PoDto, user: RequestUser) {
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
      if (!prodId && (i.customName || (i as any).name)) {
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
        status: (dto.status as any) ?? "MENUNGGU_PERSETUJUAN",
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
    if (dto.supplierSoNumber !== undefined || dto.soFileId !== undefined) {
      await this.saveMeta(row.id, {
        ...(dto.supplierSoNumber !== undefined ? { supplierSoNumber: dto.supplierSoNumber } : {}),
        ...(dto.soFileId !== undefined ? { soFileId: dto.soFileId } : {}),
      });
    }

    await this.audit.log({
      actor: user,
      action: "BUAT_PO_SUPPLIER",
      entityType: "supplier-po",
      entityId: row.id,
      detail: `${number} — ${supplier.name} Rp${total}`,
    });
    await this.notifications.notify({
      roles: ["FINANCE"],
      kind: "APPROVAL",
      text: `PO supplier menunggu persetujuan: ${number} (Rp${total})`,
      href: `/procurement/po/${row.id}`,
    });
    await this.approvals.request({
      kind: "SUPPLIER_PO",
      entityId: row.id,
      title: `PO supplier ${number}`,
      amount: total,
      requestedBy: user,
      href: `/procurement/po/${row.id}`,
    });

    if (dto.requestId) {
      await this.prisma.main.purchaseRequest.updateMany({
        where: { id: dto.requestId, status: { notIn: ["DIKIRIM", "DITERIMA", "DIBATALKAN"] } },
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

    const poStatusValues = ["MENUNGGU_PERSETUJUAN", "DISETUJUI", "DITOLAK", "DIBATALKAN"];
    const shipmentStatusValues = ["DI_SUPPLIER", "DIKIRIM", "SAMPAI", "BELUM_DIKIRIM", "DALAM_PERJALANAN"];
    let poStatus: any = undefined;
    let shipmentStatus: any = dto.shipmentStatus ?? undefined;

    if (dto.status) {
      if (poStatusValues.includes(dto.status)) {
        poStatus = dto.status;
      } else if (shipmentStatusValues.includes(dto.status)) {
        if (!shipmentStatus) {
          shipmentStatus = dto.status === "BELUM_DIKIRIM" ? "DI_SUPPLIER" : dto.status === "DALAM_PERJALANAN" ? "DIKIRIM" : dto.status;
        }
      }
    }
    if (shipmentStatus === "BELUM_DIKIRIM") shipmentStatus = "DI_SUPPLIER";
    if (shipmentStatus === "DALAM_PERJALANAN") shipmentStatus = "DIKIRIM";

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
    if (!reqId) {
      const suffix = String(row.number || "").replace(/^(?:POD|PO-S|PO)\//i, "");
      const matchedPr = await this.prisma.main.purchaseRequest.findFirst({
        where: {
          OR: [{ number: `PNJ/${suffix}` }, { number: { endsWith: suffix } }],
        },
        select: { id: true },
      });
      if (matchedPr) {
        reqId = matchedPr.id;
        void this.prisma.main.supplierPO.update({ where: { id: row.id }, data: { requestId: matchedPr.id } }).catch(() => {});
      }
    }
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
    if (dto.supplierSoNumber !== undefined || dto.soFileId !== undefined) {
      await this.saveMeta(id, {
        ...(dto.supplierSoNumber !== undefined ? { supplierSoNumber: dto.supplierSoNumber } : {}),
        ...(dto.soFileId !== undefined ? { soFileId: dto.soFileId } : {}),
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
    const isShipment = shipmentStatuses.includes(status);
    const effShipment = status === "BELUM_DIKIRIM" ? "DI_SUPPLIER" : status === "DALAM_PERJALANAN" ? "DIKIRIM" : status;
    const isLunas = status === "LUNAS" || status === "DIBAYAR" || status === "SELESAI";
    const isBelumLunas = status === "SAMPAI_BELUM_LUNAS" || status === "BELUM_LUNAS";

    let data: any = {};
    if (isLunas) {
      await this.saveMeta(id, { manualStatus: "LUNAS" });
      data = {
        status: "DISETUJUI",
        shipmentStatus: "SAMPAI",
        arrivedAt: row.arrivedAt || new Date(),
      };
    } else if (isBelumLunas) {
      await this.saveMeta(id, { manualStatus: "SAMPAI_BELUM_LUNAS" });
      data = {
        status: "DISETUJUI",
        shipmentStatus: "SAMPAI",
        arrivedAt: row.arrivedAt || new Date(),
      };
    } else if (isShipment) {
      await this.saveMeta(id, { manualStatus: null });
      data = {
        shipmentStatus: effShipment as never,
        ...(effShipment === "SAMPAI" ? { arrivedAt: row.arrivedAt || new Date() } : {}),
        ...(effShipment === "DIKIRIM" || effShipment === "SAMPAI" ? { status: "DISETUJUI" } : {}),
      };
    } else {
      await this.saveMeta(id, { manualStatus: null });
      data = { status: status as never };
    }

    const updated = await this.prisma.main.supplierPO.update({
      where: { id },
      data,
      include: { supplier: { select: { id: true, name: true } } },
    });

    if (row.requestId) {
      if (isLunas) {
        await this.prisma.main.purchaseRequest.updateMany({
          where: { id: row.requestId },
          data: {
            status: "DITERIMA",
            paymentStatus: "DIBAYAR",
          },
        }).catch(() => {});
        this.notifications.dataChange("purchase-requests", "status", row.requestId);
        this.notifications.dataChange("purchase-requests", "update", row.requestId);
      } else if (isBelumLunas) {
        await this.prisma.main.purchaseRequest.updateMany({
          where: { id: row.requestId },
          data: {
            status: "DITERIMA",
            paymentStatus: "BELUM_DIBAYAR",
          },
        }).catch(() => {});
        this.notifications.dataChange("purchase-requests", "status", row.requestId);
        this.notifications.dataChange("purchase-requests", "update", row.requestId);
      } else if (isShipment && effShipment === "DIKIRIM") {
        await this.prisma.main.purchaseRequest.updateMany({
          where: { id: row.requestId, status: { notIn: ["DIKIRIM", "DITERIMA", "DIBATALKAN"] } },
          data: { status: "DIKIRIM" },
        }).catch(() => {});
        this.notifications.dataChange("purchase-requests", "status", row.requestId);
        this.notifications.dataChange("purchase-requests", "update", row.requestId);
      } else if (isShipment && effShipment === "SAMPAI") {
        await this.prisma.main.purchaseRequest.updateMany({
          where: { id: row.requestId, status: { notIn: ["DIBATALKAN"] } },
          data: { status: "DITERIMA" },
        }).catch(() => {});
        this.notifications.dataChange("purchase-requests", "status", row.requestId);
        this.notifications.dataChange("purchase-requests", "update", row.requestId);
      }
    }

    if (isShipment && effShipment === "DIKIRIM") {
      await this.ensureReceivingCreated(id, user, (row as any).doFileId);
    }

    this.notifications.dataChange("supplier-pos", "status", updated.id);
    this.notifications.dataChange("supplier-pos", "update", updated.id);
    return this.get(updated.id);
  }

  /** Tracking pengiriman diubah manual oleh Procurement (PRD). */
  async setShipment(id: number, dto: ShipmentDto, user: RequestUser) {
    const row = await this.prisma.main.supplierPO.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("PO supplier tidak ditemukan");
    if (dto.doFileId) {
      await this.prisma.main.file.update({
        where: { id: dto.doFileId },
        data: { refType: "supplier-po-do", refId: String(id) },
      }).catch(() => {});
    }

    const rawShipment = String(dto.shipmentStatus);
    const effShipment: "DI_SUPPLIER" | "DIKIRIM" | "SAMPAI" =
      rawShipment === "BELUM_DIKIRIM"
        ? "DI_SUPPLIER"
        : rawShipment === "DALAM_PERJALANAN"
        ? "DIKIRIM"
        : dto.shipmentStatus;
    const updated = await this.prisma.main.supplierPO.update({
      where: { id },
      data: {
        shipmentStatus: effShipment as never,
        ...(effShipment === "DIKIRIM" || effShipment === "SAMPAI" ? { status: "DISETUJUI" } : {}),
        ...(dto.doFileId ? { doFileId: dto.doFileId } : {}),
        ...(effShipment === "SAMPAI" ? { arrivedAt: row.arrivedAt || new Date() } : {}),
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
    if (!reqId) {
      const suffix = String(row.number || "").replace(/^(?:POD|PO-S|PO)\//i, "");
      const matchedPr = await this.prisma.main.purchaseRequest.findFirst({
        where: {
          OR: [{ number: `PNJ/${suffix}` }, { number: { endsWith: suffix } }],
        },
        select: { id: true },
      });
      if (matchedPr) {
        reqId = matchedPr.id;
        void this.prisma.main.supplierPO.update({ where: { id: row.id }, data: { requestId: matchedPr.id } }).catch(() => {});
      }
    }

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
    const updated = await this.prisma.main.supplierPO.update({
      where: { id },
      data: { status: "DIBATALKAN" },
    });
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
            { conditionNote: { contains: row.number } },
          ],
        },
      });
      if (!existingRec) {
        const recNumber = await this.docnum.next("penerimaan");
        const defaultWh =
          (await this.prisma.main.warehouse.findFirst({ where: { status: "AKTIF" } })) ??
          (await this.prisma.main.warehouse.findFirst());

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
            conditionNote: `Pengiriman PO Supplier ${row.number}`,
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
