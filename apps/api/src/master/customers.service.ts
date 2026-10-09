import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip, searchWhere } from "../common/utils/query.js";
import { CustomerDto } from "./dto.js";

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: PageQuery & { status?: string }) {
    const where = searchWhere(
      q,
      [["name", "contains"], ["pic", "contains"], ["company", "contains"], ["email", "contains"], ["city", "contains"]],
      q.status ? { status: q.status as "AKTIF" | "NONAKTIF" } : {},
    );
    const [items, total] = await Promise.all([
      this.prisma.main.customer.findMany({
        where,
        orderBy: orderBy(q.sort, q.dir, ["name", "createdAt"], "createdAt"),
        ...pageSkip(q),
      }),
      this.prisma.main.customer.count({ where }),
    ]);
    return paginate(items, total, q);
  }

  options() {
    return this.prisma.main.customer.findMany({
      where: { status: "AKTIF" },
      select: { id: true, name: true, company: true, pic: true },
      orderBy: { name: "asc" },
    });
  }

  async get(id: number) {
    const row = await this.prisma.main.customer.findUnique({
      where: { id },
      include: { leads: { select: { id: true, name: true, stage: true } } },
    });
    if (!row) throw new NotFoundException("Customer tidak ditemukan");
    return row;
  }

  create(dto: CustomerDto) {
    return this.prisma.main.customer.create({ data: dto });
  }

  async update(id: number, dto: CustomerDto) {
    await this.get(id);
    return this.prisma.main.customer.update({ where: { id }, data: dto });
  }
}
