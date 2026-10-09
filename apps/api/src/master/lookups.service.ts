import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip, searchWhere } from "../common/utils/query.js";

export type LookupModel = "leadSource" | "lostReason" | "expenseCategory" | "costCenter";

/* eslint-disable @typescript-eslint/no-explicit-any */

@Injectable()
export class LookupsService {
  constructor(private readonly prisma: PrismaService) {}

  private delegate(model: LookupModel): any {
    return (this.prisma.main as any)[model];
  }

  async list(model: LookupModel, q: PageQuery & { status?: string }) {
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

  options(model: LookupModel) {
    return this.delegate(model).findMany({
      where: { status: "AKTIF" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  async create(model: LookupModel, name: string) {
    const dup = await this.delegate(model).findFirst({ where: { name } });
    if (dup) throw new ConflictException(`Nama "${name}" sudah ada`);
    return this.delegate(model).create({ data: { name } });
  }

  async update(model: LookupModel, id: number, name: string) {
    const row = await this.delegate(model).findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Data tidak ditemukan");
    if (name && name !== row.name) {
      const dup = await this.delegate(model).findFirst({ where: { name } });
      if (dup) throw new ConflictException(`Nama "${name}" sudah ada`);
    }
    return this.delegate(model).update({ where: { id }, data: { name } });
  }
}
