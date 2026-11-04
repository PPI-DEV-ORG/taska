import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip, searchWhere } from "../common/utils/query.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { ProductDto } from "./dto.js";

const PRICE_ROLES = new Set(["PROCUREMENT", "FINANCE", "PM", "BOS", "ADMIN", "SUPER_ADMIN", "GUDANG"]);
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

  async cleanupNonMasterProducts() {
    try {
      const nonMasterProds = await this.prisma.main.product.findMany({
        where: {
          OR: [
            { sku: { startsWith: "SKU-PR-" } },
            { description: { contains: "Non-Master" } },
            { type: "NON_MASTER" },
          ],
        },
        select: { id: true },
      });
      if (nonMasterProds.length > 0) {
        const ids = nonMasterProds.map((p) => p.id);
        await this.prisma.main.projectRequirement.deleteMany({ where: { productId: { in: ids } } }).catch(() => {});
        await this.prisma.main.stockReservation.deleteMany({ where: { productId: { in: ids } } }).catch(() => {});
        await this.prisma.main.purchaseRequestItem.updateMany({ where: { productId: { in: ids } }, data: { productId: null } }).catch(() => {});
        await this.prisma.main.stockBalance.deleteMany({ where: { productId: { in: ids } } }).catch(() => {});
        await this.prisma.main.stockMovement.deleteMany({ where: { productId: { in: ids } } }).catch(() => {});
        await this.prisma.main.serialUnit.deleteMany({ where: { productId: { in: ids } } }).catch(() => {});
        await this.prisma.main.product.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
      }
    } catch (e) {
      console.warn("cleanupNonMasterProducts error:", (e as Error).message);
    }
  }

  async list(q: PageQuery & { status?: string; categoryId?: number; brand?: string }, user: RequestUser) {
    // Bersihkan item non-master dari tabel master product agar tidak pernah tersimpan di master inventory
    await this.cleanupNonMasterProducts();

    const where = searchWhere(
      q,
      [["sku", "contains"], ["name", "contains"], ["type", "contains"], ["brand", "contains"]],
      {
        ...(q.status && q.status !== "ALL"
          ? { status: q.status as "AKTIF" | "NONAKTIF" }
          : q.status === "ALL"
          ? {}
          : { status: "AKTIF" }),
        ...(q.categoryId ? { categoryId: q.categoryId } : {}),
        ...(q.brand ? { brand: { contains: q.brand } } : {}),
        NOT: { sku: { startsWith: "SKU-PR-" } },
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
    await this.cleanupNonMasterProducts();
    const rows = await this.prisma.main.product.findMany({
      where: {
        status: "AKTIF",
        NOT: { sku: { startsWith: "SKU-PR-" } },
      },
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
    if (dto.hargaBeli !== undefined && dto.purchasePrice === undefined) {
      dto.purchasePrice = dto.hargaBeli;
    }
    delete (dto as any).hargaBeli;
    const sku = dto.sku || `SKU-${Date.now()}`;
    const exists = await this.prisma.main.product.findUnique({ where: { sku } });
    if (exists) throw new ConflictException(`SKU ${sku} sudah dipakai`);
    return this.prisma.main.product.create({
      data: {
        ...dto,
        sku,
        name: dto.name || "Barang Baru",
        unit: dto.unit || "unit",
      },
      include: INCLUDE,
    });
  }

  async update(id: number, dto: ProductDto, user: RequestUser) {
    const row = await this.prisma.main.product.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Barang tidak ditemukan");
    if (dto.hargaBeli !== undefined && dto.purchasePrice === undefined) {
      dto.purchasePrice = dto.hargaBeli;
    }
    delete (dto as any).hargaBeli;
    if (dto.min !== undefined && dto.minStock === undefined) {
      dto.minStock = dto.min;
    }
    delete (dto as any).min;
    if (dto.purchasePrice !== undefined && !PRICE_ROLES.has(user.role)) {
      throw new ConflictException("Harga beli hanya untuk Procurement, Finance, PM, Bos, dan Gudang");
    }
    if (dto.sku && dto.sku !== row.sku) {
      const dup = await this.prisma.main.product.findUnique({ where: { sku: dto.sku } });
      if (dup) throw new ConflictException(`SKU ${dto.sku} sudah dipakai`);
    }
    return this.prisma.main.product.update({ where: { id }, data: dto, include: INCLUDE });
  }

  async remove(id: number) {
    const row = await this.prisma.main.product.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Barang tidak ditemukan");

    // Cek saldo fisik di gudang
    const balanceSum = await this.prisma.main.stockBalance.aggregate({
      where: { productId: id },
      _sum: { qty: true },
    });
    const physicalBalance = balanceSum._sum.qty ?? 0;

    // Cek unit serial yang berstatus aktif di gudang atau di-reserve
    const activeSerials = await this.prisma.main.serialUnit.count({
      where: {
        productId: id,
        status: { in: ["DI_GUDANG", "RESERVED"] },
      },
    });

    const currentStock = physicalBalance + (row.hasSerial ? activeSerials : 0);
    if (currentStock > 0) {
      throw new ConflictException(
        `Barang tidak dapat dihapus karena masih memiliki stok aktif di gudang (${currentStock} ${row.unit}). Kosongkan stok terlebih dahulu.`,
      );
    }

    // Jika stok sudah 0, bersihkan reservasi / saldo 0
    await this.prisma.main.stockReservation.deleteMany({ where: { productId: id } }).catch(() => {});
    await this.prisma.main.stockBalance.deleteMany({ where: { productId: id, qty: { lte: 0 } } }).catch(() => {});

    try {
      await this.prisma.main.product.delete({ where: { id } });
      return { id, deleted: true };
    } catch {
      // Jika foreign key database memblokir hard delete karena riwayat transaksi, nonaktifkan barang
      await this.prisma.main.product.update({
        where: { id },
        data: { status: "NONAKTIF" },
      });
      return { id, deleted: true, status: "NONAKTIF" };
    }
  }
}
