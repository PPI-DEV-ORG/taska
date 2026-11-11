import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
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
  constructor(private readonly prisma: PrismaService) {}

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
    const rows = await (this.prisma.main as any)
      .$queryRawUnsafe("SELECT * FROM `ManualJournal` ORDER BY `createdAt` DESC")
      .catch(() => []);
    return { items: rows ?? [] };
  }

  async createManualJournal(dto: any) {
    const journalNo = String(dto.journalNo || `JM-${Date.now().toString().slice(-4)}`);
    const date = String(dto.tanggal || dto.date || new Date().toISOString().slice(0, 10));
    const refNo = dto.refNo ? String(dto.refNo) : null;
    const description = String(dto.keterangan || dto.description || "");
    const project = dto.project ? String(dto.project) : null;
    const lines = typeof dto.lines === "string" ? dto.lines : JSON.stringify(dto.lines || []);
    const createdBy = dto.createdBy ? String(dto.createdBy) : null;

    await (this.prisma.main as any).$executeRawUnsafe(
      "INSERT INTO `ManualJournal` (`journalNo`, `date`, `refNo`, `description`, `project`, `lines`, `createdBy`) VALUES (?, ?, ?, ?, ?, ?, ?)",
      journalNo,
      date,
      refNo,
      description,
      project,
      lines,
      createdBy
    );
    return { success: true, journalNo };
  }

  async removeManualJournal(id: string) {
    await (this.prisma.main as any).$executeRawUnsafe(
      "DELETE FROM `ManualJournal` WHERE `id` = ? OR `journalNo` = ?",
      id,
      id
    );
    return { success: true };
  }
}
