import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip, searchWhere } from "../common/utils/query.js";
import { SupplierDto } from "./dto.js";

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: PageQuery & { status?: string }) {
    const where = searchWhere(
      q,
      [["name", "contains"], ["pic", "contains"], ["city", "contains"], ["email", "contains"]],
      q.status ? { status: q.status as "AKTIF" | "NONAKTIF" } : {},
    );
    const [items, total] = await Promise.all([
      this.prisma.main.supplier.findMany({
        where,
        orderBy: orderBy(q.sort, q.dir, ["name", "createdAt"], "createdAt"),
        ...pageSkip(q),
      }),
      this.prisma.main.supplier.count({ where }),
    ]);
    return paginate(items, total, q);
  }

  options() {
    return this.prisma.main.supplier.findMany({
      where: { status: "AKTIF" },
      select: { id: true, name: true, city: true, paymentTerms: true },
      orderBy: { name: "asc" },
    });
  }

  async get(id: number) {
    const row = await this.prisma.main.supplier.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Supplier tidak ditemukan");
    return row;
  }

  create(dto: SupplierDto) {
    return this.prisma.main.supplier.create({ data: dto });
  }

  async update(id: number, dto: SupplierDto) {
    await this.get(id);
    return this.prisma.main.supplier.update({ where: { id }, data: dto });
  }
}
