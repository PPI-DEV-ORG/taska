import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { StockService } from "./stock.service.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import type { MovementListQuery, SummaryQuery, TransferDto } from "./dto.js";

@Injectable()
export class MovementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
  ) {}

  async list(q: MovementListQuery) {
    const where = {
      ...(q.productId ? { productId: q.productId } : {}),
      ...(q.warehouseId ? { OR: [{ fromWarehouseId: q.warehouseId }, { toWarehouseId: q.warehouseId }] } : {}),
      ...(q.type ? { type: q.type as "IN" | "OUT" | "TRANSFER" } : {}),
      ...(q.category ? { category: q.category as never } : {}),
      ...(q.projectId ? { projectId: q.projectId } : {}),
      ...(q.from || q.to
        ? {
            date: {
              ...(q.from ? { gte: new Date(q.from) } : {}),
              ...(q.to ? { lte: new Date(q.to) } : {}),
            },
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.main.stockMovement.count({ where }),
      this.prisma.main.stockMovement.findMany({
        where,
        include: {
          product: { select: { name: true, sku: true, unit: true, hasSerial: true } },
          fromWarehouse: { select: { name: true } },
          toWarehouse: { select: { name: true } },
          creator: { select: { name: true } },
          project: { select: { name: true } },
        },
        orderBy: [{ date: "desc" }, { id: "desc" }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
    ]);
    return { items: rows, total, page: q.page, limit: q.limit };
  }

  /** Agregat per SKU per gudang: masuk, keluar, transfer masuk/keluar, saldo, low stock (PRD gudang). */
  async summary(q: SummaryQuery) {
    const balances = await this.prisma.main.stockBalance.findMany({
      where: q.warehouseId ? { warehouseId: q.warehouseId } : {},
      include: { product: { select: { name: true, sku: true, unit: true, minStock: true, hasSerial: true } } },
      orderBy: { id: "asc" },
    });
    const moves = await this.prisma.main.stockMovement.groupBy({
      by: ["productId", "type", "fromWarehouseId", "toWarehouseId"],
      _sum: { qty: true },
      where: q.warehouseId
        ? { OR: [{ fromWarehouseId: q.warehouseId }, { toWarehouseId: q.warehouseId }] }
        : {},
    });
    const totals = await this.prisma.main.stockBalance.groupBy({
      by: ["productId"],
      _sum: { qty: true },
    });
    const totalByProduct = new Map(totals.map((t) => [t.productId, t._sum?.qty ?? 0]));

    const agg = new Map<string, { masuk: number; keluar: number; transferIn: number; transferOut: number }>();
    for (const m of moves) {
      const whs = new Set<number>();
      if (m.type === "IN" && m.toWarehouseId != null) whs.add(m.toWarehouseId);
      if (m.type === "OUT" && m.fromWarehouseId != null) whs.add(m.fromWarehouseId);
      if (m.type === "TRANSFER") {
        if (m.toWarehouseId != null) whs.add(m.toWarehouseId);
        if (m.fromWarehouseId != null) whs.add(m.fromWarehouseId);
      }
      for (const w of whs) {
        const key = `${m.productId}:${w}`;
        const row = agg.get(key) ?? { masuk: 0, keluar: 0, transferIn: 0, transferOut: 0 };
        const qty = m._sum?.qty ?? 0;
        if (m.type === "IN" && m.toWarehouseId === w) row.masuk += qty;
        if (m.type === "OUT" && m.fromWarehouseId === w) row.keluar += qty;
        if (m.type === "TRANSFER" && m.toWarehouseId === w) row.transferIn += qty;
        if (m.type === "TRANSFER" && m.fromWarehouseId === w) row.transferOut += qty;
        agg.set(key, row);
      }
    }

    let rows = balances.map((b) => {
      const a = agg.get(`${b.productId}:${b.warehouseId}`) ?? { masuk: 0, keluar: 0, transferIn: 0, transferOut: 0 };
      const productTotal = totalByProduct.get(b.productId) ?? 0;
      return {
        productId: b.productId,
        warehouseId: b.warehouseId,
        sku: b.product.sku,
        name: b.product.name,
        unit: b.product.unit,
        hasSerial: b.product.hasSerial,
        minStock: b.product.minStock,
        masuk: a.masuk,
        keluar: a.keluar,
        transferMasuk: a.transferIn,
        transferKeluar: a.transferOut,
        saldo: b.qty,
        productTotal,
        lowStock: b.product.minStock > 0 && productTotal < b.product.minStock,
      };
    });
    if (q.lowOnly === "true") rows = rows.filter((r) => r.lowStock);
    const total = rows.length;
    const start = (q.page - 1) * q.limit;
    return { items: rows.slice(start, start + q.limit), total, page: q.page, limit: q.limit };
  }

  async transfer(dto: TransferDto, user: RequestUser) {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException("Gudang asal dan tujuan tidak boleh sama");
    }
    const product = await this.prisma.main.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException("Produk tidak ditemukan");

    const from = await this.prisma.main.warehouse.findUnique({ where: { id: dto.fromWarehouseId } });
    const to = await this.prisma.main.warehouse.findUnique({ where: { id: dto.toWarehouseId } });
    if (!from || !to) throw new NotFoundException("Gudang tidak ditemukan");
    if (dto.deliveryNoteId) {
      const dn = await this.prisma.main.deliveryNote.findUnique({ where: { id: dto.deliveryNoteId } });
      if (!dn) throw new NotFoundException("Surat jalan tidak ditemukan");
    }

    if (product.hasSerial) {
      const sns = dto.serials ?? [];
      if (sns.length !== dto.qty) {
        throw new BadRequestException("Barang ber-SN: jumlah serial harus sama dengan qty transfer");
      }
      const units = await this.prisma.main.serialUnit.findMany({
        where: { sn: { in: sns } },
      });
      if (units.length !== sns.length) throw new BadRequestException("Ada serial number yang tidak ditemukan");
      for (const u of units) {
        if (u.productId !== product.id) throw new BadRequestException(`Serial ${u.sn} bukan milik produk ini`);
        if (u.status !== "DI_GUDANG") throw new BadRequestException(`Serial ${u.sn} status ${u.status}, harus DI_GUDANG`);
        if (u.warehouseId !== dto.fromWarehouseId) throw new BadRequestException(`Serial ${u.sn} tidak berada di gudang asal`);
      }
    }

    const movement = await this.stock.applyMovement({
      date: dto.date ? new Date(dto.date) : new Date(),
      type: "TRANSFER",
      category: "TRANSFER",
      productId: dto.productId,
      fromWarehouseId: dto.fromWarehouseId,
      toWarehouseId: dto.toWarehouseId,
      qty: dto.qty,
      deliveryNoteId: dto.deliveryNoteId ?? null,
      reason: dto.reason ?? null,
      createdById: user.id,
    });

    if (product.hasSerial) {
      for (const sn of dto.serials ?? []) {
        await this.prisma.main.serialUnit.updateMany({
          where: { sn },
          data: { warehouseId: dto.toWarehouseId },
        });
        const unit = await this.prisma.main.serialUnit.findUnique({ where: { sn } });
        if (unit) {
          await this.prisma.main.serialUnitHistory.create({
            data: {
              serialUnitId: unit.id,
              status: unit.status,
              warehouseId: dto.toWarehouseId,
              note: `Transfer ${from.name} → ${to.name}`,
              changedById: user.id,
            },
          });
        }
      }
    }
    return movement;
  }
}
