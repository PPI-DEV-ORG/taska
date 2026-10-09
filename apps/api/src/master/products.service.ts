import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip, searchWhere } from "../common/utils/query.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { ProductDto } from "./dto.js";

const PRICE_ROLES = new Set(["PROCUREMENT", "FINANCE", "PM", "BOS", "ADMIN"]);
const INCLUDE = { category: { select: { id: true, name: true } } } as const;

type Row = Awaited<ReturnType<PrismaService["main"]["product"]["findFirst"]>> & {
  category: { id: number; name: string } | null;
};

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private shape(row: Row, user: RequestUser) {
    const { purchasePrice, ...rest } = row ?? ({} as Row);
    return PRICE_ROLES.has(user.role) ? { ...rest, purchasePrice } : rest;
  }

  private async stockMap(ids: number[]) {
    if (!ids.length) return new Map<number, number>();
    const balances = await this.prisma.main.stockBalance.groupBy({
      by: ["productId"],
      _sum: { qty: true },
      where: { productId: { in: ids } },
    });
    return new Map<number, number>(balances.map((b) => [b.productId, b._sum?.qty ?? 0]));
  }

  async list(q: PageQuery & { status?: string; categoryId?: number }, user: RequestUser) {
    const where = searchWhere(
      q,
      [["sku", "contains"], ["name", "contains"], ["type", "contains"]],
      {
        ...(q.status ? { status: q.status as "AKTIF" | "NONAKTIF" } : {}),
        ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      },
    );
    const [rows, total] = await Promise.all([
      this.prisma.main.product.findMany({
        where,
        include: INCLUDE,
        orderBy: orderBy(q.sort, q.dir, ["sku", "name", "createdAt"], "createdAt"),
        ...pageSkip(q),
      }),
      this.prisma.main.product.count({ where }),
    ]);

    const stock = await this.stockMap(rows.map((r) => r.id));
    const items = rows.map((r) => {
      const qty = stock.get(r.id) ?? 0;
      return { ...this.shape(r, user), stock: qty, lowStock: qty < r.minStock };
    });

    return paginate(items, total, q);
  }

  async options(user: RequestUser) {
    const rows = await this.prisma.main.product.findMany({
      where: { status: "AKTIF" },
      include: INCLUDE,
      orderBy: { name: "asc" },
    });
    return rows.map((r) => this.shape(r, user));
  }

  async get(id: number, user: RequestUser) {
    const row = await this.prisma.main.product.findUnique({ where: { id }, include: INCLUDE });
    if (!row) throw new NotFoundException("Barang tidak ditemukan");

    const balances = await this.prisma.main.stockBalance.findMany({
      where: { productId: id },
      select: { warehouseId: true, qty: true, warehouse: { select: { id: true, name: true } } },
    });
    return {
      ...this.shape(row, user),
      balances,
      stock: balances.reduce((s, b) => s + b.qty, 0),
    };
  }

  async create(dto: ProductDto) {
    const exists = await this.prisma.main.product.findUnique({ where: { sku: dto.sku } });
    if (exists) throw new ConflictException(`SKU ${dto.sku} sudah dipakai`);
    return this.prisma.main.product.create({ data: dto, include: INCLUDE });
  }

  async update(id: number, dto: ProductDto, user: RequestUser) {
    const row = await this.prisma.main.product.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Barang tidak ditemukan");
    if (dto.purchasePrice !== undefined && !PRICE_ROLES.has(user.role)) {
      throw new ConflictException("Harga beli hanya untuk Procurement, Finance, PM, dan Bos");
    }
    if (dto.sku && dto.sku !== row.sku) {
      const dup = await this.prisma.main.product.findUnique({ where: { sku: dto.sku } });
      if (dup) throw new ConflictException(`SKU ${dto.sku} sudah dipakai`);
    }
    return this.prisma.main.product.update({ where: { id }, data: dto, include: INCLUDE });
  }
}
