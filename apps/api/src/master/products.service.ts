import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip, searchWhere } from "../common/utils/query.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { MappingService } from "../accounting/mapping.service.js";
import { PostingService } from "../accounting/posting.service.js";
import { PostingRules } from "../accounting/posting.rules.js";
import { ProductDto } from "./dto.js";

const PRICE_ROLES = new Set(["PROCUREMENT", "FINANCE", "PM", "BOS", "ADMIN", "SUPER_ADMIN", "GUDANG"]);
const INCLUDE = { category: { select: { id: true, name: true } } } as const;

type Row = Awaited<ReturnType<PrismaService["main"]["product"]["findFirst"]>> & {
  category: { id: number; name: string } | null;
};

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postingService: PostingService,
    private readonly mappingService: MappingService,
  ) {}

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

  async create(dto: ProductDto, user?: RequestUser) {
    if (dto.hargaBeli !== undefined && dto.purchasePrice === undefined) {
      dto.purchasePrice = dto.hargaBeli;
    }
    delete (dto as any).hargaBeli;

    const sku = dto.sku || `SKU-${Date.now()}`;
    const initialStockRaw = Number(dto.initialStock ?? 0);
    const initialStock = Math.trunc(initialStockRaw);
    const purchasePrice = Number(dto.purchasePrice ?? 0);
    const isJasa = String(dto.type ?? "BARANG").toUpperCase() === "JASA";
    const hasSerial = !!dto.hasSerial;
    const warehouseId = dto.warehouseId != null ? Number(dto.warehouseId) : undefined;
    const serialNumbers = Array.isArray(dto.serialNumbers)
      ? dto.serialNumbers.map((sn) => String(sn).trim()).filter(Boolean)
      : [];

    if (!Number.isInteger(initialStockRaw) || initialStock < 0) {
      throw new BadRequestException("Stok awal harus berupa bilangan bulat >= 0");
    }
    if (initialStock > 0) {
      if (isJasa) throw new BadRequestException("Jasa tidak dapat memiliki stok awal fisik");
      if (!warehouseId) throw new BadRequestException("Gudang wajib dipilih untuk stok awal");
      if (purchasePrice <= 0) {
        throw new BadRequestException("Harga beli/modal wajib lebih dari 0 untuk stok awal");
      }
      if (hasSerial) {
        if (serialNumbers.length !== initialStock) {
          throw new BadRequestException(
            `Jumlah serial number (${serialNumbers.length}) harus sama dengan qty stok awal (${initialStock})`,
          );
        }
        if (new Set(serialNumbers).size !== serialNumbers.length) {
          throw new BadRequestException("Serial number tidak boleh duplikat");
        }
      }
    }

    const productData: Record<string, any> = { ...(dto as any) };
    delete productData.initialStock;
    delete productData.warehouseId;
    delete productData.serialNumbers;
    if (initialStock > 0 && purchasePrice > 0) productData.avgCost = purchasePrice;

    const mappings: Record<string, string> = initialStock > 0 ? await this.mappingService.getAll() : {};

    return this.prisma.main.$transaction(async (tx) => {
      const exists = await tx.product.findUnique({ where: { sku } });
      if (exists) throw new ConflictException(`SKU ${sku} sudah dipakai`);

      let targetWarehouseId: number | null = null;
      if (initialStock > 0) {
        const warehouse = await tx.warehouse.findUnique({ where: { id: warehouseId as number } });
        if (!warehouse) throw new BadRequestException("Gudang stok awal tidak ditemukan");
        targetWarehouseId = warehouse.id;

        if (hasSerial && serialNumbers.length > 0) {
          const existingSerial = await tx.serialUnit.findFirst({
            where: { sn: { in: serialNumbers } },
            select: { sn: true },
          });
          if (existingSerial) {
            throw new BadRequestException(`Serial number ${existingSerial.sn} sudah tercatat`);
          }
        }
      }

      const product = await tx.product.create({
        data: {
          ...productData,
          sku,
          name: dto.name || "Barang Baru",
          unit: dto.unit || "unit",
        } as any,
        include: INCLUDE,
      });

      if (initialStock <= 0 || targetWarehouseId == null) return product;

      const totalValue = purchasePrice * initialStock;
      const entryDate = new Date();

      await tx.stockBalance.upsert({
        where: {
          productId_warehouseId: {
            productId: product.id,
            warehouseId: targetWarehouseId,
          },
        },
        create: {
          productId: product.id,
          warehouseId: targetWarehouseId,
          qty: initialStock,
        },
        update: {
          qty: { increment: initialStock },
        },
      });

      await tx.stockMovement.create({
        data: {
          date: entryDate,
          type: "IN",
          category: "SALDO_AWAL",
          productId: product.id,
          toWarehouseId: targetWarehouseId,
          qty: initialStock,
          unitCost: purchasePrice,
          totalCost: totalValue,
          reason: "Saldo Awal Barang Baru",
          createdById: user?.id ?? null,
        },
      });

      if (hasSerial) {
        const warrantyEndsAt = product.warrantyMonths
          ? new Date(Date.now() + product.warrantyMonths * 30 * 24 * 3600 * 1000)
          : null;

        for (const sn of serialNumbers) {
          const unit = await tx.serialUnit.create({
            data: {
              sn,
              productId: product.id,
              status: "DI_GUDANG",
              warehouseId: targetWarehouseId,
              warrantyEndsAt,
            },
          });
          await tx.serialUnitHistory.create({
            data: {
              serialUnitId: unit.id,
              status: "DI_GUDANG",
              warehouseId: targetWarehouseId,
              note: "Saldo awal barang baru",
              changedById: user?.id ?? null,
            },
          });
        }
      }

      const lines = PostingRules.buildInitialStockLines(
        {
          productId: product.id,
          productName: product.name,
          qty: initialStock,
          cost: purchasePrice,
          unit: product.unit,
        },
        mappings,
      );

      await this.postingService.post(
        {
          date: entryDate,
          source: "INITIAL_STOCK",
          sourceType: "Product",
          sourceId: product.id,
          event: "initial-stock",
          memo: `Saldo Awal Persediaan Gudang: ${product.name} (${initialStock} ${product.unit})`,
          refNo: product.sku,
          createdById: user?.id ?? null,
          lines,
        },
        tx,
      );

      return product;
    });
  }

  async update(id: number, dto: ProductDto, user: RequestUser) {
    const row = await this.prisma.main.product.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Barang tidak ditemukan");
    if (dto.hargaBeli !== undefined && dto.purchasePrice === undefined) {
      dto.purchasePrice = dto.hargaBeli;
    }
    delete (dto as any).hargaBeli;
    // Field stok awal hanya untuk create; jangan pernah ikut di-update sebagai kolom Product.
    delete (dto as any).initialStock;
    delete (dto as any).warehouseId;
    delete (dto as any).serialNumbers;
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
