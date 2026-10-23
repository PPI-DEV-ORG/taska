import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { DocumentNumberService } from "../document-number/document-number.service.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip } from "../common/utils/query.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { ClientPoDto } from "./dto.js";

type ClientPoMeta = {
  soNumber?: string | null;
  poClientNumber?: string | null;
  docMode?: "SO" | "PO" | "BOTH";
  soFileId?: number | null;
  items?: any[];
};

@Injectable()
export class ClientPoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly docnum: DocumentNumberService,
  ) {}

  private metaKey(id: number) {
    return `client-po:meta:${id}`;
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

    return {
      ...row,
      soNumber: soNumber || "-",
      poClientNumber: poClientNumber || "-",
      docMode: meta.docMode || (soNumber !== "-" && poClientNumber !== "-" ? "BOTH" : soNumber !== "-" ? "SO" : "PO"),
      soFileId: meta.soFileId ?? null,
      items: Array.isArray(meta.items) ? meta.items : [],
      file,
      soFile,
    };
  }

  async list(q: PageQuery & { customerId?: number; from?: string; to?: string }) {
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
    const fileIds = [row.fileId, meta.soFileId].filter((x): x is number => typeof x === "number" && x > 0);
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

    let primaryNumber: string;
    if (isPoMode) {
      primaryNumber =
        dto.poClientNumber?.trim() ||
        dto.number?.trim() ||
        `PO/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, "0")}/${Date.now().toString().slice(-3)}`;
    } else if (isSoMode) {
      primaryNumber =
        dto.soNumber?.trim() ||
        dto.number?.trim() ||
        `SO/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, "0")}/${Date.now().toString().slice(-3)}`;
    } else {
      primaryNumber =
        dto.number?.trim() ||
        dto.soNumber?.trim() ||
        dto.poClientNumber?.trim() ||
        (await this.docnum.next("clientPO"));
    }

    await this.docnum.assertUnique(
      primaryNumber,
      async (v) => !!(await this.prisma.main.clientPO.findFirst({ where: { number: v } })),
    );

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
    const date = dto.date ? new Date(dto.date) : new Date();

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

  suggestNumber() {
    return this.docnum.suggest("clientPO");
  }
}
