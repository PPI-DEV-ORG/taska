import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip, searchWhere } from "../common/utils/query.js";
import { ProductCategoryDto, WarehouseDto } from "./dto.js";

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: PageQuery & { status?: string }) {
    const where = searchWhere(q, [["name", "contains"], ["description", "contains"]], {
      ...(q.status ? { status: q.status as "AKTIF" | "NONAKTIF" } : {}),
    });
    const [items, total] = await Promise.all([
      this.prisma.main.productCategory.findMany({
        where,
        orderBy: orderBy(q.sort, q.dir, ["name"], "name"),
        ...pageSkip(q),
        include: { _count: { select: { products: true } } },
      }),
      this.prisma.main.productCategory.count({ where }),
    ]);
    return paginate(items, total, q);
  }

  async create(dto: ProductCategoryDto) {
    const name = dto.name || `Kategori-${Date.now()}`;
    const dup = await this.prisma.main.productCategory.findUnique({ where: { name } });
    if (dup) throw new ConflictException("Nama kategori sudah ada");
    return this.prisma.main.productCategory.create({ data: { ...dto, name } });
  }

  async update(id: number, dto: ProductCategoryDto) {
    const row = await this.prisma.main.productCategory.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Kategori tidak ditemukan");
    if (dto.name && dto.name !== row.name) {
      const dup = await this.prisma.main.productCategory.findUnique({ where: { name: dto.name } });
      if (dup) throw new ConflictException("Nama kategori sudah ada");
    }
    return this.prisma.main.productCategory.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    const row = await this.prisma.main.productCategory.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Kategori tidak ditemukan");
    const products = await this.prisma.main.product.count({ where: { categoryId: id } });
    if (products > 0) {
      throw new ConflictException(`Kategori masih dipakai oleh ${products} barang`);
    }
    await this.prisma.main.productCategory.delete({ where: { id } });
    return { id, deleted: true };
  }
}

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: PageQuery & { status?: string }) {
    const where = searchWhere(q, [["name", "contains"], ["city", "contains"]], {
      ...(q.status ? { status: q.status as "AKTIF" | "NONAKTIF" } : {}),
    });
    const [items, total] = await Promise.all([
      this.prisma.main.warehouse.findMany({
        where,
        orderBy: orderBy(q.sort, q.dir, ["name"], "name"),
        ...pageSkip(q),
        include: { _count: { select: { users: true, balances: true } } },
      }),
      this.prisma.main.warehouse.count({ where }),
    ]);
    return paginate(items, total, q);
  }

  options() {
    return this.prisma.main.warehouse.findMany({
      where: { status: "AKTIF" },
      select: { id: true, name: true, city: true },
      orderBy: { name: "asc" },
    });
  }

  async get(id: number) {
    const row = await this.prisma.main.warehouse.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Gudang tidak ditemukan");
    return row;
  }

  async create(dto: WarehouseDto) {
    const name = dto.name || `Gudang-${Date.now()}`;
    const dup = await this.prisma.main.warehouse.findFirst({ where: { name } });
    if (dup) throw new ConflictException("Nama gudang sudah ada");
    return this.prisma.main.warehouse.create({ data: { ...dto, name } });
  }

  async update(id: number, dto: WarehouseDto) {
    await this.get(id);
    if (dto.name) {
      const dup = await this.prisma.main.warehouse.findFirst({ where: { name: dto.name, NOT: { id } } });
      if (dup) throw new ConflictException("Nama gudang sudah ada");
    }
    return this.prisma.main.warehouse.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.get(id);
    const [users, balances, movements] = await Promise.all([
      this.prisma.main.user.count({ where: { warehouseId: id } }),
      this.prisma.main.stockBalance.count({ where: { warehouseId: id, qty: { gt: 0 } } }),
      this.prisma.main.stockMovement.count({
        where: { OR: [{ fromWarehouseId: id }, { toWarehouseId: id }] },
      }),
    ]);
    const used = [
      { label: "pengguna", count: users },
      { label: "saldo stok", count: balances },
      { label: "riwayat mutasi", count: movements },
    ].filter((b) => b.count > 0);
    if (used.length) {
      throw new ConflictException(
        `Gudang masih dipakai oleh ${used.map((b) => `${b.count} ${b.label}`).join(", ")}`,
      );
    }
    await this.prisma.main.warehouse.delete({ where: { id } });
    return { id, deleted: true };
  }
}
