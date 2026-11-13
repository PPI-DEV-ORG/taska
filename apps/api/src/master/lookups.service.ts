import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { PostingService } from "../accounting/posting.service.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip, searchWhere } from "../common/utils/query.js";

export type LookupModel =
  | "leadSource"
  | "lostReason"
  | "expenseCategory"
  | "costCenter"
  | "visitActivityType"
  | "dealType";

const DEFAULT_DEAL_TYPES = [
  { id: 1, name: "Proyek (Instalasi & Jasa)", status: "AKTIF" },
  { id: 2, name: "Penjualan Barang (Perangkat / Retail)", status: "AKTIF" },
];

/* eslint-disable @typescript-eslint/no-explicit-any */

@Injectable()
export class LookupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postingService: PostingService,
  ) {}

  private async getDealTypes(): Promise<Array<{ id: number; name: string; status: string }>> {
    const row = await this.prisma.main.systemSetting.findUnique({ where: { key: "master.dealTypes" } });
    if (!row?.value) {
      return [...DEFAULT_DEAL_TYPES];
    }
    try {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
    return [...DEFAULT_DEAL_TYPES];
  }

  private async saveDealTypes(items: Array<{ id: number; name: string; status: string }>): Promise<void> {
    await this.prisma.main.systemSetting.upsert({
      where: { key: "master.dealTypes" },
      create: {
        key: "master.dealTypes",
        value: JSON.stringify(items),
        description: "Master Jenis Transaksi / Peluang Lead",
      },
      update: {
        value: JSON.stringify(items),
      },
    });
  }

  private delegate(model: LookupModel): any {
    return (this.prisma.main as any)[model];
  }

  async list(model: LookupModel, q: PageQuery & { status?: string }) {
    if (model === "dealType") {
      let items = await this.getDealTypes();
      if (q.status) {
        items = items.filter((i) => i.status === q.status);
      }
      if (q.q) {
        const query = q.q.toLowerCase();
        items = items.filter((i) => i.name.toLowerCase().includes(query));
      }
      items.sort((a, b) => a.name.localeCompare(b.name));
      const total = items.length;
      const page = q.page ? Math.max(1, Number(q.page)) : 1;
      const limit = q.limit ? Math.max(1, Number(q.limit)) : 50;
      const paginated = items.slice((page - 1) * limit, page * limit);
      return paginate(paginated, total, { ...q, page, limit });
    }

    const where = searchWhere(q, [["name", "contains"]], {
      ...(q.status ? { status: q.status as "AKTIF" | "NONAKTIF" } : {}),
    });
    const [items, total] = await Promise.all([
      this.delegate(model).findMany({
        where,
        orderBy: orderBy(q.sort, q.dir, ["name"], "name"),
        ...pageSkip(q),
      }),
      this.delegate(model).count({ where }),
    ]);
    return paginate(items, total, q);
  }

  async options(model: LookupModel) {
    if (model === "dealType") {
      const items = await this.getDealTypes();
      return items
        .filter((i) => i.status === "AKTIF")
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((i) => ({ id: i.id, name: i.name }));
    }

    return this.delegate(model).findMany({
      where: { status: "AKTIF" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  async create(model: LookupModel, name: string, status?: string) {
    if (model === "dealType") {
      const items = await this.getDealTypes();
      const trimmed = name.trim();
      if (items.some((i) => i.name.toLowerCase() === trimmed.toLowerCase())) {
        throw new ConflictException(`Nama "${trimmed}" sudah ada`);
      }
      const nextId = items.reduce((max, i) => Math.max(max, Number(i.id) || 0), 0) + 1;
      const newItem = { id: nextId, name: trimmed, status: status || "AKTIF" };
      items.push(newItem);
      await this.saveDealTypes(items);
      return newItem;
    }

    const dup = await this.delegate(model).findFirst({ where: { name } });
    if (dup) throw new ConflictException(`Nama "${name}" sudah ada`);
    return this.delegate(model).create({
      data: { name, ...(status ? { status } : {}) },
    });
  }

  async update(model: LookupModel, id: number, name?: string, status?: string) {
    if (model === "dealType") {
      const items = await this.getDealTypes();
      const item = items.find((i) => i.id === id);
      if (!item) throw new NotFoundException("Data tidak ditemukan");
      if (name && name.trim().toLowerCase() !== item.name.toLowerCase()) {
        const dup = items.find((i) => i.id !== id && i.name.toLowerCase() === name.trim().toLowerCase());
        if (dup) throw new ConflictException(`Nama "${name.trim()}" sudah ada`);
        item.name = name.trim();
      }
      if (status) item.status = status;
      await this.saveDealTypes(items);
      return item;
    }

    const row = await this.delegate(model).findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Data tidak ditemukan");
    if (name && name !== row.name) {
      const dup = await this.delegate(model).findFirst({ where: { name } });
      if (dup) throw new ConflictException(`Nama "${name}" sudah ada`);
    }
    return this.delegate(model).update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(status ? { status } : {}),
      },
    });
  }

  async remove(model: LookupModel, id: number) {
    if (model === "dealType") {
      const items = await this.getDealTypes();
      const idx = items.findIndex((i) => i.id === id);
      if (idx === -1) throw new NotFoundException("Data tidak ditemukan");
      items.splice(idx, 1);
      await this.saveDealTypes(items);
      return { id, deleted: true };
    }
    const row = await this.delegate(model).findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Data tidak ditemukan");

    const blockers: { label: string; count: number }[] = [];
    if (model === "leadSource") {
      blockers.push({ label: "lead", count: await this.prisma.main.lead.count({ where: { sourceId: id } }) });
    }
    if (model === "lostReason") {
      blockers.push({ label: "lead", count: await this.prisma.main.lead.count({ where: { lostReasonId: id } }) });
    }
    if (model === "expenseCategory") {
      blockers.push({ label: "pengeluaran", count: await this.prisma.main.expense.count({ where: { categoryId: id } }) });
    }
    if (model === "costCenter") {
      blockers.push({ label: "pengeluaran", count: await this.prisma.main.expense.count({ where: { costCenterId: id } }) });
    }
    const used = blockers.filter((b) => b.count > 0);
    if (used.length) {
      throw new ConflictException(`Data masih dipakai oleh ${used.map((b) => `${b.count} ${b.label}`).join(", ")}`);
    }

    await this.delegate(model).delete({ where: { id } });
    return { id, deleted: true };
  }

  async listCoa() {
    const items = await (this.prisma.main as any).coaAccount
      ?.findMany({
        where: { status: "AKTIF" },
        orderBy: { code: "asc" },
      })
      .catch(() => []);
    return { items: items ?? [] };
  }

  async upsertCoa(dto: {
    code?: string;
    name?: string;
    category?: string;
    normalBalance?: string;
    type?: string;
    parentCode?: string;
  }) {
    const code = (dto.code || "").trim();
    const name = (dto.name || "").trim();
    if (!code || !name) throw new ConflictException("Kode akun dan nama akun wajib diisi");
    const inferredParent = !dto.parentCode && code.includes(".") ? code.split(".")[0] : dto.parentCode;
    return (this.prisma.main as any).coaAccount.upsert({
      where: { code },
      update: {
        name,
        category: dto.category || "Beban Operasional",
        normalBalance: dto.normalBalance || "DEBIT",
        type: dto.type ?? null,
        parentCode: inferredParent && inferredParent !== "-" ? inferredParent : null,
        status: "AKTIF",
      },
      create: {
        code,
        name,
        category: dto.category || "Beban Operasional",
        normalBalance: dto.normalBalance || "DEBIT",
        type: dto.type ?? null,
        parentCode: inferredParent && inferredParent !== "-" ? inferredParent : null,
        status: "AKTIF",
      },
    });
  }

  async removeCoa(code: string) {
    await (this.prisma.main as any).coaAccount
      .updateMany({
        where: { code },
        data: { status: "NONAKTIF" },
      })
      .catch(() => {});
    return { code, deleted: true };
  }

  async listManualJournals() {
    const entries = await (this.prisma.main as any).journalEntry.findMany({
      where: { source: "MANUAL" },
      include: { lines: true },
      orderBy: { date: "desc" },
    });
    const rows = entries.map((e: any) => ({
      id: e.id,
      journalNo: e.number,
      date: e.date,
      refNo: e.refNo,
      description: e.memo,
      project: e.projectId ? `Project #${e.projectId}` : null,
      lines: JSON.stringify(e.lines),
      createdAt: e.createdAt,
    }));
    return { items: rows };
  }

  /**
   * Jurnal manual lewat mesin posting resmi: debit = kredit dicek, periode diambil dari tanggal (ditolak bila periode
   * sudah ditutup), nomor jurnal resmi. Dulu ditulis langsung ke tabel dengan periodId 1 tanpa validasi.
   */
  async createManualJournal(dto: any, userId?: number) {
    const date = dto.tanggal || dto.date || new Date();
    const memo = String(dto.keterangan || dto.description || "Jurnal Manual");
    const refNo = dto.refNo ? String(dto.refNo) : undefined;
    const rawLines = typeof dto.lines === "string" ? JSON.parse(dto.lines) : (dto.lines || []);
    const lines = rawLines.map((l: any) => ({
      accountCode: l.accountCode || l.kodeAkun,
      debit: Number(l.debit || 0),
      credit: Number(l.credit || l.kredit || 0),
      memo: l.memo || l.keterangan,
    }));

    if (lines.length < 2) throw new BadRequestException("Jurnal manual minimal punya dua baris (debit & kredit)");
    const entry = await this.postingService.post({
      date: new Date(date),
      source: "MANUAL",
      sourceType: "MANUAL",
      memo,
      refNo,
      createdById: userId,
      lines: lines.map((l: any) => ({ ...l, memo: l.memo || memo })),
    });
    return { success: true, id: entry?.id, journalNo: entry?.number };
  }

  /** Hapus jurnal manual = buat jurnal pembalik (jejak audit tetap ada), bukan sekadar mengubah status. */
  async removeManualJournal(id: string, userId?: number, reason?: string) {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) throw new BadRequestException("ID jurnal tidak valid");
    const row = await (this.prisma.main as any).journalEntry.findUnique({ where: { id: numId }, select: { source: true } });
    if (!row) throw new NotFoundException("Jurnal tidak ditemukan");
    if (row.source !== "MANUAL") throw new BadRequestException("Hanya jurnal manual yang bisa dihapus dari sini");
    await this.postingService.reverse(numId, reason?.trim() || "Jurnal manual dihapus", userId);
    return { success: true };
  }
}
