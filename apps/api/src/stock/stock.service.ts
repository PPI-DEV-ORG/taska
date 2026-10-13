import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import type { MovementCategory, MovementType } from "../generated/prisma/client.js";

export type MovementInput = {
  date: Date;
  type: MovementType;
  category: MovementCategory;
  productId: number;
  fromWarehouseId?: number | null;
  toWarehouseId?: number | null;
  qty: number;
  projectId?: number | null;
  deliveryNoteId?: number | null;
  receivingId?: number | null;
  serialUnitId?: number | null;
  reason?: string | null;
  createdById?: number | null;
};

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async balanceOf(productId: number, warehouseId: number) {
    const row = await this.prisma.main.stockBalance.findUnique({
      where: { productId_warehouseId: { productId, warehouseId } },
    });
    return row?.qty ?? 0;
  }

  private async changeBalance(productId: number, warehouseId: number, delta: number) {
    const current = await this.balanceOf(productId, warehouseId);
    const next = current + delta;
    if (next < 0) {
      const product = await this.prisma.main.product.findUnique({ where: { id: productId } });
      throw new BadRequestException(
        `Stok tidak boleh negatif: ${product?.name ?? `produk #${productId}`} sisa ${current}, diminta ${-delta}`,
      );
    }
    await this.prisma.main.stockBalance.upsert({
      where: { productId_warehouseId: { productId, warehouseId } },
      create: { productId, warehouseId, qty: next },
      update: { qty: next },
    });
    return next;
  }

  /** Catat pergerakan stok + saldo (PRD #8, #9). */
  async applyMovement(input: MovementInput) {
    if (input.qty <= 0) throw new BadRequestException("Qty harus lebih dari 0");

    if (input.type === "IN") {
      if (!input.toWarehouseId) throw new BadRequestException("Penerimaan wajib punya gudang tujuan");
      await this.changeBalance(input.productId, input.toWarehouseId, input.qty);
    } else if (input.type === "OUT") {
      if (input.fromWarehouseId) {
        await this.changeBalance(input.productId, input.fromWarehouseId, -input.qty);
      }
    } else if (input.type === "TRANSFER") {
      if (!input.fromWarehouseId || !input.toWarehouseId) {
        throw new BadRequestException("Transfer wajib punya gudang asal dan tujuan");
      }
      if (input.fromWarehouseId === input.toWarehouseId) {
        throw new BadRequestException("Gudang asal dan tujuan tidak boleh sama");
      }
      await this.changeBalance(input.productId, input.fromWarehouseId, -input.qty);
      await this.changeBalance(input.productId, input.toWarehouseId, input.qty);
    }

    return this.prisma.main.stockMovement.create({
      data: {
        date: input.date,
        type: input.type,
        category: input.category,
        productId: input.productId,
        fromWarehouseId: input.fromWarehouseId ?? null,
        toWarehouseId: input.toWarehouseId ?? null,
        qty: input.qty,
        projectId: input.projectId ?? null,
        deliveryNoteId: input.deliveryNoteId ?? null,
        receivingId: input.receivingId ?? null,
        serialUnitId: input.serialUnitId ?? null,
        reason: input.reason ?? null,
        createdById: input.createdById ?? null,
      },
    });
  }

  /** Saldo tersedia (semua gudang). */
  async totalAvailable(productId: number) {
    const rows = await this.prisma.main.stockBalance.findMany({ where: { productId } });
    return rows.reduce((s, r) => s + r.qty, 0);
  }
}
