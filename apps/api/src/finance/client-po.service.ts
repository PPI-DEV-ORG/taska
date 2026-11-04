import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { DocumentNumberService } from "../document-number/document-number.service.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip } from "../common/utils/query.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { StockService } from "../stock/stock.service.js";
import { ClientPoDirectSettlementDto, ClientPoDto } from "./dto.js";

type ClientPoMeta = {
  soNumber?: string | null;
  poClientNumber?: string | null;
  docMode?: "SO" | "PO" | "BOTH";
  soFileId?: number | null;
  items?: any[];
  paymentStatus?: "LUNAS" | "BELUM_LUNAS";
  settlementType?: "LANGSUNG" | "TEMPO";
  paymentProofFileId?: number | null;
  coaAccount?: string | null;
  settledAt?: string | null;
  goodsDispatched?: boolean;
};

@Injectable()
export class ClientPoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly docnum: DocumentNumberService,
    private readonly stock: StockService,
  ) {}

  private metaKey(id: number) {
    return `client-po:meta:${id}`;
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

  private defaultSoNumber(id: number, date?: Date | null): string {
    const d = date ? new Date(date) : new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `SO/${yyyy}/${mm}/${String(id).padStart(3, "0")}`;
  }

  private async getMetaMap(ids: number[]): Promise<Map<number, ClientPoMeta>> {
    const map = new Map<number, ClientPoMeta>();
    if (!ids.length) return map;
    const rows = await this.prisma.main.systemSetting.findMany({
      where: { key: { in: ids.map((id) => this.metaKey(id)) } },
    });
    for (const r of rows) {
      try {
        const id = Number(r.key.replace("client-po:meta:", ""));
        map.set(id, JSON.parse(r.value));
      } catch {}
    }
    return map;
  }

  private async saveMeta(id: number, patch: Partial<ClientPoMeta>): Promise<ClientPoMeta> {
    const key = this.metaKey(id);
    let existing: ClientPoMeta = {};
    try {
      const cur = await this.prisma.main.systemSetting.findUnique({ where: { key } });
      if (cur?.value) existing = JSON.parse(cur.value);
    } catch {}
    const merged: ClientPoMeta = { ...existing, ...patch };
    await this.prisma.main.systemSetting
      .upsert({
        where: { key },
        update: { value: JSON.stringify(merged) },
        create: { key, value: JSON.stringify(merged) },
      })
      .catch(() => {});
    return merged;
  }

  private enrichRow(row: any, meta: ClientPoMeta, fileMap: Map<number, any>) {
    const isNumberSo = /^SO[\-\/]/i.test(String(row.number || ""));
    const isNumberPo = /^PO[\-\/]/i.test(String(row.number || ""));

    let soNumber = meta.soNumber != null ? meta.soNumber.trim() : "";
    let poClientNumber = meta.poClientNumber != null ? meta.poClientNumber.trim() : "";

    if (meta.docMode === "PO") {
      poClientNumber = poClientNumber || row.number;
      soNumber = soNumber || "-";
    } else if (meta.docMode === "SO") {
      soNumber = soNumber || row.number;
      poClientNumber = poClientNumber || "-";
    } else if (meta.docMode === "BOTH") {
      soNumber = soNumber || (isNumberSo ? row.number : "-");
      poClientNumber = poClientNumber || (!isNumberSo ? row.number : "-");
    } else {
      if (isNumberSo) {
        soNumber = row.number;
        poClientNumber = poClientNumber || "-";
      } else if (isNumberPo) {
        poClientNumber = row.number;
        soNumber = soNumber || "-";
      } else {
        soNumber = soNumber || row.number;
        poClientNumber = poClientNumber || "-";
      }
    }

    const file = row.fileId ? fileMap.get(row.fileId) ?? null : null;
    const soFile = meta.soFileId ? fileMap.get(Number(meta.soFileId)) ?? null : null;
    const paymentProofFile = meta.paymentProofFileId ? fileMap.get(Number(meta.paymentProofFileId)) ?? null : null;

    const isLunas =
      meta.paymentStatus === "LUNAS" ||
      (Array.isArray(row.invoices) &&
        row.invoices.some((i: any) => i.status === "PAID" && Number(i.total) > 0));

    return {
      ...row,
      soNumber: soNumber || "-",
      poClientNumber: poClientNumber || "-",
      docMode: meta.docMode || (soNumber !== "-" && poClientNumber !== "-" ? "BOTH" : soNumber !== "-" ? "SO" : "PO"),
      soFileId: meta.soFileId ?? null,
      items: Array.isArray(meta.items) ? meta.items : [],
      paymentStatus: isLunas ? "LUNAS" : meta.paymentStatus || "BELUM_LUNAS",
      settlementType: meta.settlementType ?? null,
      paymentProofFileId: meta.paymentProofFileId ?? null,
      paymentProofFile,
      coaAccount: meta.coaAccount ?? null,
      settledAt: meta.settledAt ?? null,
      goodsDispatched: meta.goodsDispatched ?? false,
      file,
      soFile,
    };
  }

  async list(q: PageQuery & { customerId?: number; from?: string; to?: string }) {
    await this.ensurePoMigration();
    const where = {
      ...(q.customerId ? { customerId: q.customerId } : {}),
      ...(q.from || q.to
        ? {
            date: {
              ...(q.from ? { gte: new Date(q.from) } : {}),
              ...(q.to ? { lte: new Date(q.to) } : {}),
            },
          }
        : {}),
      ...(q.q
        ? {
            OR: [
              { number: { contains: q.q } },
              { customer: { name: { contains: q.q } } },
              { notes: { contains: q.q } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.main.clientPO.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          quotation: { select: { id: true, number: true } },
          invoices: { select: { id: true, total: true, status: true } },
          _count: { select: { invoices: true } },
        },
        orderBy: orderBy(q.sort, q.dir, ["date", "createdAt"], "date"),
        ...pageSkip(q),
      }),
      this.prisma.main.clientPO.count({ where }),
    ]);

    const ids = items.map((r) => r.id);
    const metaMap = await this.getMetaMap(ids);
    const fileIds = new Set<number>();
    for (const r of items) {
      if (r.fileId) fileIds.add(r.fileId);
      const m = metaMap.get(r.id);
      if (m?.soFileId) fileIds.add(Number(m.soFileId));
      if (m?.paymentProofFileId) fileIds.add(Number(m.paymentProofFileId));
    }
    const files = fileIds.size
      ? await this.prisma.main.file.findMany({ where: { id: { in: Array.from(fileIds) } } })
      : [];
    const fileMap = new Map(files.map((f) => [f.id, f]));

    const enriched = items.map((r) => this.enrichRow(r, metaMap.get(r.id) ?? {}, fileMap));
    return paginate(enriched, total, q);
  }

  async get(id: number) {
    const row = await this.prisma.main.clientPO.findUnique({
      where: { id },
      include: {
        customer: true,
        supplier: true,
        quotation: { select: { id: true, number: true } },
        invoices: true,
      },
    });
    if (!row) throw new NotFoundException("Sales Order / PO client tidak ditemukan");
    const metaMap = await this.getMetaMap([id]);
    const meta = metaMap.get(id) ?? {};
    const fileIds = [row.fileId, meta.soFileId, meta.paymentProofFileId].filter((x): x is number => typeof x === "number" && x > 0);
    const files = fileIds.length
      ? await this.prisma.main.file.findMany({ where: { id: { in: fileIds } } })
      : [];
    const fileMap = new Map(files.map((f) => [f.id, f]));
    return this.enrichRow(row, meta, fileMap);
  }

  async create(dto: ClientPoDto, user: RequestUser) {
    const isPoMode =
      dto.docMode === "PO" ||
      (/^PO[\-\/]/i.test(dto.number || dto.poClientNumber || "") && !dto.soNumber);
    const isSoMode =
      dto.docMode === "SO" ||
      (/^SO[\-\/]/i.test(dto.number || dto.soNumber || "") && !dto.poClientNumber);

    const date = dto.date ? new Date(dto.date) : new Date();
    const manualNumber = (
      (isPoMode ? dto.poClientNumber?.trim() : dto.soNumber?.trim()) ||
      dto.number?.trim() ||
      ""
    );

    let primaryNumber: string;
    if (manualNumber) {
      const dup = await this.prisma.main.clientPO.findFirst({ where: { number: manualNumber } });
      if (dup) {
        const isAutoPattern = /^(SO|PO)\/\d{4}\/\d{2}\/\d+$/i.test(manualNumber);
        if (isAutoPattern) {
          primaryNumber = isPoMode
            ? `PO/${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${Date.now().toString().slice(-4)}`
            : await this.docnum.next("clientPO", date);
        } else {
          throw new ConflictException(`Nomor ${manualNumber} sudah dipakai`);
        }
      } else {
        primaryNumber = manualNumber;
      }
    } else if (isPoMode) {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      primaryNumber = `PO/${yyyy}/${mm}/${Date.now().toString().slice(-4)}`;
    } else {
      primaryNumber = await this.docnum.next("clientPO", date);
    }

    const customer = dto.customerId
      ? await this.prisma.main.customer.findUnique({ where: { id: dto.customerId } })
      : null;
    const supplier = dto.supplierId
      ? await this.prisma.main.supplier.findUnique({ where: { id: dto.supplierId } })
      : null;

    let items = Array.isArray(dto.items) ? dto.items : [];
    if (!items.length && dto.quotationId) {
      try {
        const qMeta = await this.prisma.main.systemSetting.findUnique({
          where: { key: `quotation.meta.${dto.quotationId}` },
        });
        if (qMeta?.value) {
          const parsed = JSON.parse(qMeta.value);
          if (Array.isArray(parsed.items) && parsed.items.length > 0) {
            items = parsed.items;
          }
        }
      } catch {}
    }

    let calculatedAmount = dto.amount;
    if ((calculatedAmount === undefined || calculatedAmount === null || calculatedAmount === 0) && items.length > 0) {
      const itemsSum = items.reduce((sum: number, it: any) => {
        const price = Number(it.harga ?? it.price ?? 0);
        const qty = Number(it.qty ?? 1);
        return sum + price * qty;
      }, 0);
      if (itemsSum > 0) {
        calculatedAmount = itemsSum;
      }
    }
    const amount = calculatedAmount ?? 0;

    const row = await this.prisma.main.clientPO.create({
      data: {
        number: primaryNumber,
        customerId: customer?.id ?? null,
        supplierId: supplier?.id ?? null,
        quotationId: dto.quotationId ?? null,
        amount,
        date,
        fileId: dto.fileId,
        notes: dto.notes,
      },
      include: {
        customer: true,
        supplier: true,
        quotation: { select: { id: true, number: true } },
      },
    });

    let soNumber: string | null = null;
    let poClientNumber: string | null = null;
    let docMode = dto.docMode;

    if (isPoMode) {
      docMode = "PO";
      poClientNumber = primaryNumber;
      soNumber = dto.soNumber?.trim() || null;
    } else if (isSoMode) {
      docMode = "SO";
      soNumber = primaryNumber;
      poClientNumber = dto.poClientNumber?.trim() || null;
    } else {
      docMode = "BOTH";
      soNumber = dto.soNumber?.trim() || primaryNumber;
      poClientNumber = dto.poClientNumber?.trim() || primaryNumber;
    }

    await this.saveMeta(row.id, {
      soNumber,
      poClientNumber,
      docMode,
      items,
      ...(dto.soFileId !== undefined ? { soFileId: dto.soFileId } : {}),
    });

    if (dto.fileId) {
      await this.prisma.main.file
        .update({
          where: { id: dto.fileId },
          data: { refType: "clientPo", refId: String(row.id) },
        })
        .catch(() => {});
    }
    if (dto.soFileId) {
      await this.prisma.main.file
        .update({
          where: { id: dto.soFileId },
          data: { refType: "clientSo", refId: String(row.id) },
        })
        .catch(() => {});
    }

    const party = customer?.name ? `Customer: ${customer.name}` : supplier?.name ? `Supplier: ${supplier.name}` : "Umum";
    await this.audit.log({
      actor: user,
      action: "BUAT_PO_CLIENT",
      entityType: "client-po",
      entityId: row.id,
      detail: `SO: ${soNumber} | PO: ${poClientNumber} Rp${amount} — ${party}`,
    });
    return this.get(row.id);
  }

  async update(id: number, dto: ClientPoDto, user: RequestUser) {
    const row = await this.get(id);
    if (dto.number && dto.number !== row.number) {
      await this.docnum.assertUnique(
        dto.number,
        async (v) => !!(await this.prisma.main.clientPO.findFirst({ where: { number: v, NOT: { id } } })),
      );
    }
    const updated = await this.prisma.main.clientPO.update({
      where: { id },
      data: {
        ...(dto.number ? { number: dto.number } : {}),
        customerId: dto.customerId !== undefined ? (dto.customerId ? dto.customerId : null) : undefined,
        supplierId: dto.supplierId !== undefined ? (dto.supplierId ? dto.supplierId : null) : undefined,
        quotationId: dto.quotationId !== undefined ? (dto.quotationId ? dto.quotationId : null) : undefined,
        amount: dto.amount ?? row.amount,
        date: dto.date ? new Date(dto.date) : row.date,
        fileId: dto.fileId !== undefined ? dto.fileId : row.fileId,
        notes: dto.notes !== undefined ? dto.notes : row.notes,
      },
      include: {
        customer: true,
        supplier: true,
        quotation: { select: { id: true, number: true } },
      },
    });

    if (
      dto.soNumber !== undefined ||
      dto.poClientNumber !== undefined ||
      dto.soFileId !== undefined ||
      dto.items !== undefined
    ) {
      await this.saveMeta(id, {
        ...(dto.soNumber !== undefined ? { soNumber: dto.soNumber } : {}),
        ...(dto.poClientNumber !== undefined ? { poClientNumber: dto.poClientNumber } : {}),
        ...(dto.soFileId !== undefined ? { soFileId: dto.soFileId } : {}),
        ...(dto.items !== undefined ? { items: dto.items } : {}),
      });
    }

    if (dto.fileId) {
      await this.prisma.main.file
        .update({
          where: { id: dto.fileId },
          data: { refType: "clientPo", refId: String(id) },
        })
        .catch(() => {});
    }
    if (dto.soFileId) {
      await this.prisma.main.file
        .update({
          where: { id: dto.soFileId },
          data: { refType: "clientSo", refId: String(id) },
        })
        .catch(() => {});
    }

    await this.audit.log({
      actor: user,
      action: "UBAH_PO_CLIENT",
      entityType: "client-po",
      entityId: id,
      detail: `${updated.number} Rp${updated.amount}`,
    });
    return this.get(id);
  }

  async remove(id: number, user: RequestUser) {
    const row = await this.get(id);
    await this.prisma.main.systemSetting.deleteMany({ where: { key: this.metaKey(id) } }).catch(() => {});
    await this.prisma.main.clientPO.delete({ where: { id } });
    await this.audit.log({
      actor: user,
      action: "HAPUS_PO_CLIENT",
      entityType: "client-po",
      entityId: id,
      detail: `${row.number} dihapus`,
    });
    return { id, deleted: true };
  }

  async directSettlement(id: number, dto: ClientPoDirectSettlementDto, user: RequestUser) {
    const row = await this.get(id);
    const settlementDate = dto.date ? new Date(dto.date) : new Date();

    let items = Array.isArray(row.items) ? row.items : [];
    if (!items.length && row.quotationId) {
      try {
        const qMeta = await this.prisma.main.systemSetting.findUnique({
          where: { key: `quotation.meta.${row.quotationId}` },
        });
        if (qMeta?.value) {
          const parsed = JSON.parse(qMeta.value);
          if (Array.isArray(parsed.items) && parsed.items.length > 0) {
            items = parsed.items;
          }
        }
      } catch {}
    }

    // 1. Eksekusi Pengeluaran Barang / Stok (Barang Keluar)
    const dispatchedSerialProductQty = new Map<number, number>();

    const itemSerials = items
      .flatMap((it: any) => {
        if (it.sn) return String(it.sn).split(",");
        if (Array.isArray(it.serialNumbers)) return it.serialNumbers;
        if (typeof it.serialNumbers === "string" && it.serialNumbers) return it.serialNumbers.split(",");
        const m = String(it.item || it.name || "").match(/\(SN:\s*([^\)]+)\)/i);
        return m?.[1] ? [m[1]] : [];
      })
      .map((s: string) => String(s).trim())
      .filter(Boolean);

    const serialList: string[] = Array.from(new Set(itemSerials));
    if (serialList.length > 0) {
      const units = await this.prisma.main.serialUnit.findMany({
        where: { sn: { in: serialList } },
      });
      for (const u of units) {
        if ((u.status === "DI_GUDANG" || u.status === "RESERVED") && u.warehouseId) {
          await this.stock.applyMovement({
            date: settlementDate,
            type: "OUT",
            category: "KELUAR_SURAT_JALAN",
            productId: u.productId,
            fromWarehouseId: u.warehouseId,
            qty: 1,
            serialUnitId: u.id,
            reason: `Penjualan Langsung / Nota Kontan SO ${row.number}`,
            createdById: user.id,
          });
          await this.prisma.main.serialUnit.update({
            where: { id: u.id },
            data: { status: "DIKIRIM", warehouseId: null },
          });
          await this.prisma.main.stockReservation.updateMany({
            where: { serialUnitId: u.id, releasedAt: null },
            data: { releasedAt: new Date() },
          });
          await this.prisma.main.serialUnitHistory.create({
            data: {
              serialUnitId: u.id,
              status: "DIKIRIM",
              warehouseId: u.warehouseId,
              note: `Keluar Penjualan Langsung / Nota Kontan SO ${row.number}`,
              changedById: user.id,
            },
          });
          dispatchedSerialProductQty.set(u.productId, (dispatchedSerialProductQty.get(u.productId) ?? 0) + 1);
        }
      }
    }

    for (const item of items) {
      let productId = Number(item.productId);
      if (!productId) {
        const rawName = String(item.item || item.name || item.nama || "").split(" (")[0].trim().toLowerCase();
        const matched = await this.prisma.main.product.findFirst({
          where: {
            OR: [
              { name: { equals: rawName } },
              { sku: { equals: rawName } },
            ],
          },
        });
        if (matched) productId = matched.id;
      }
      if (!productId) continue;

      const product = await this.prisma.main.product.findUnique({ where: { id: productId } });
      if (!product) continue;

      const alreadyOut = dispatchedSerialProductQty.get(productId) ?? 0;
      const totalItemQty = Number(item.qty || 1);
      const remainingQty = Math.max(0, totalItemQty - alreadyOut);
      if (remainingQty <= 0) continue;

      if (product.hasSerial) {
        const autoUnits = await this.prisma.main.serialUnit.findMany({
          where: {
            productId,
            status: { in: ["DI_GUDANG", "RESERVED"] },
            warehouseId: { not: null },
          },
          take: remainingQty,
        });
        for (const u of autoUnits) {
          if (!u.warehouseId) continue;
          await this.stock.applyMovement({
            date: settlementDate,
            type: "OUT",
            category: "KELUAR_SURAT_JALAN",
            productId: u.productId,
            fromWarehouseId: u.warehouseId,
            qty: 1,
            serialUnitId: u.id,
            reason: `Penjualan Langsung / Nota Kontan SO ${row.number}`,
            createdById: user.id,
          });
          await this.prisma.main.serialUnit.update({
            where: { id: u.id },
            data: { status: "DIKIRIM", warehouseId: null },
          });
          await this.prisma.main.stockReservation.updateMany({
            where: { serialUnitId: u.id, releasedAt: null },
            data: { releasedAt: new Date() },
          });
          await this.prisma.main.serialUnitHistory.create({
            data: {
              serialUnitId: u.id,
              status: "DIKIRIM",
              warehouseId: u.warehouseId,
              note: `Keluar Penjualan Langsung / Nota Kontan SO ${row.number}`,
              changedById: user.id,
            },
          });
        }
        dispatchedSerialProductQty.set(productId, alreadyOut + autoUnits.length);
      } else {
        const balance =
          (await this.prisma.main.stockBalance.findFirst({
            where: { productId, qty: { gte: remainingQty } },
          })) ??
          (await this.prisma.main.stockBalance.findFirst({
            where: { productId, qty: { gt: 0 } },
          }));
        const defaultWh =
          (await this.prisma.main.warehouse.findFirst({ where: { status: "AKTIF" } })) ??
          (await this.prisma.main.warehouse.findFirst());
        const warehouseId = balance?.warehouseId ?? defaultWh?.id;

        if (warehouseId) {
          await this.stock.applyMovement({
            date: settlementDate,
            type: "OUT",
            category: "KELUAR_SURAT_JALAN",
            productId,
            fromWarehouseId: warehouseId,
            qty: remainingQty,
            reason: `Penjualan Langsung / Nota Kontan SO ${row.number}`,
            createdById: user.id,
          });
        }
      }
    }

    // 2. Sinkronkan Invoice Lunas Otomatis (Hanya untuk Penjualan Langsung / Nota Kontan yang belum memiliki invoice)
    const hasExistingInvoices =
      (row.invoices && row.invoices.length > 0) ||
      (row.quotationId &&
        (await this.prisma.main.invoiceOut.count({
          where: { quotationId: row.quotationId, status: { not: "BATAL" } },
        })) > 0);

    if (!hasExistingInvoices && !row.projectId) {
      const cust = row.customerId
        ? await this.prisma.main.customer.findUnique({ where: { id: row.customerId } })
        : (await this.prisma.main.customer.findFirst());
      if (cust) {
        const invNumber = await this.docnum.next("invoiceOut", settlementDate);
        const inv = await this.prisma.main.invoiceOut.create({
          data: {
            number: invNumber,
            clientPoId: row.id,
            customerId: cust.id,
            description: `[AKUN:${dto.coaAccount}] Pembayaran Langsung / Nota Kontan SO ${row.number}${dto.notes ? ` — ${dto.notes}` : ""}`,
            type: "PELUNASAN",
            amount: row.amount,
            total: row.amount,
            paidAmount: row.amount,
            date: settlementDate,
            dueDate: settlementDate,
            status: "PAID",
            fileId: dto.fileId ?? null,
          },
        });
        if (items.length > 0) {
          await this.prisma.main.systemSetting.upsert({
            where: { key: `invoice.items.${inv.id}` },
            update: { value: JSON.stringify(items) },
            create: { key: `invoice.items.${inv.id}`, value: JSON.stringify(items) },
          }).catch(() => {});
        }
      }
    }

    // 3. Sinkronkan Delivery Note Otomatis (Under the hood agar status pengiriman terekam selesai)
    const dnNumber = await this.docnum.next("suratJalan", settlementDate);
    const partyName = row.customer?.name ?? (row.supplier?.name ? `${row.supplier.name} (Supplier)` : "Pelanggan");
    const mappedDnItems = items
      .map((it: any) => {
        const sn = it.sn || (Array.isArray(it.serialNumbers) ? it.serialNumbers.join(",") : "");
        return {
          productId: Number(it.productId) || 1,
          qty: Number(it.qty) || 1,
          serials: sn || undefined,
          note: it.item || it.name || it.productName || "Barang",
        };
      })
      .filter((x: any) => x.productId > 0);

    await this.prisma.main.deliveryNote.create({
      data: {
        number: dnNumber,
        creatorId: user.id,
        withGoods: true,
        date: settlementDate,
        status: "DITERIMA",
        receiveById: user.id,
        receivedAt: settlementDate,
        reportText: `Penyerahan barang langsung di tempat (Nota Kontan) untuk Sales Order ${row.number}`,
        scanFileId: dto.fileId ?? null,
        locations: {
          create: [
            {
              destination: partyName,
              reason: `Penjualan Langsung / Nota Kontan SO ${row.number}`,
            },
          ],
        },
        items: mappedDnItems.length > 0
          ? {
              create: mappedDnItems.map((mi: any) => ({
                productId: mi.productId,
                qty: mi.qty,
                serials: mi.serials ?? null,
                note: mi.note ?? null,
              })),
            }
          : undefined,
      },
    }).catch(() => {});

    // 4. Update Meta SO
    await this.saveMeta(row.id, {
      paymentStatus: "LUNAS",
      settlementType: "LANGSUNG",
      paymentProofFileId: dto.fileId ?? null,
      coaAccount: dto.coaAccount,
      settledAt: settlementDate.toISOString(),
      goodsDispatched: true,
    });

    if (dto.fileId) {
      await this.prisma.main.file
        .update({
          where: { id: dto.fileId },
          data: { refType: "clientPoNota", refId: String(row.id) },
        })
        .catch(() => {});
    }

    await this.audit.log({
      actor: user,
      action: "LUNAS_PO_CLIENT_LANGSUNG",
      entityType: "client-po",
      entityId: row.id,
      detail: `${row.number} diselesaikan via Nota Kontan Langsung (Akun: ${dto.coaAccount}) Rp${row.amount}`,
    });

    return this.get(row.id);
  }

  suggestNumber() {
    return this.docnum.suggest("clientPO");
  }
}
