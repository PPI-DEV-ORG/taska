import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import type { ReservationCreateDto, ReservationListQuery } from "./dto.js";

@Injectable()
export class ReservationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Stok total dikurangi reservasi aktif project lain (reserved tidak bisa dipakai project lain). */
  private async availableFor(productId: number, excludeProjectId?: number) {
    const balances = await this.prisma.main.stockBalance.findMany({
      where: { productId },
      select: { qty: true },
    });
    const reserved = await this.prisma.main.stockReservation.aggregate({
      where: {
        productId,
        releasedAt: null,
        ...(excludeProjectId ? { NOT: { projectId: excludeProjectId } } : {}),
      },
      _sum: { qty: true },
    });
    return balances.reduce((s, b) => s + b.qty, 0) - (reserved._sum?.qty ?? 0);
  }

  async list(q: ReservationListQuery) {
    const where = {
      ...(q.projectId ? { projectId: q.projectId } : {}),
      ...(q.productId ? { productId: q.productId } : {}),
      ...(q.released === "true" ? { releasedAt: { not: null } } : {}),
      ...(q.released === "false" ? { releasedAt: null } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.main.stockReservation.count({ where }),
      this.prisma.main.stockReservation.findMany({
        where,
        include: {
          project: { select: { name: true } },
          product: { select: { name: true, sku: true, unit: true } },
          serialUnit: { select: { sn: true, status: true } },
        },
        orderBy: { id: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
    ]);
    return { items: rows, total, page: q.page, limit: q.limit };
  }

  async create(dto: ReservationCreateDto, user: RequestUser) {
    const project = await this.prisma.main.project.findUnique({ where: { id: dto.projectId } });
    if (!project) throw new NotFoundException("Project tidak ditemukan");

    if (dto.serialUnitId) {
      const unit = await this.prisma.main.serialUnit.findUnique({ where: { id: dto.serialUnitId } });
      if (!unit) throw new NotFoundException("Serial number tidak ditemukan");
      if (unit.status !== "DI_GUDANG") throw new BadRequestException(`Unit ${unit.sn} status ${unit.status}, harus DI_GUDANG`);
      const available = await this.availableFor(unit.productId, dto.projectId);
      if (available < 1) throw new BadRequestException("Stok tidak mencukupi untuk direservasi");

      const reservation = await this.prisma.main.$transaction(async (tx) => {
        const r = await tx.stockReservation.create({
          data: { projectId: dto.projectId, productId: unit.productId, serialUnitId: unit.id, qty: 1 },
        });
        await tx.serialUnit.update({ where: { id: unit.id }, data: { status: "RESERVED" } });
        await tx.serialUnitHistory.create({
          data: {
            serialUnitId: unit.id,
            status: "RESERVED",
            warehouseId: unit.warehouseId,
            projectId: dto.projectId,
            note: `Reservasi untuk ${project.name}`,
            changedById: user.id,
          },
        });
        return r;
      });
      return reservation;
    }

    if (!dto.productId) throw new BadRequestException("Pilih produk atau unit serial untuk direservasi");
    const qty = dto.qty ?? 1;
    const product = await this.prisma.main.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException("Produk tidak ditemukan");
    const available = await this.availableFor(dto.productId, dto.projectId);
    if (available < qty) {
      throw new BadRequestException(
        `Stok ${product.name} tidak mencukupi: tersedia ${available}, diminta ${qty} (sebagian sudah direservasi project lain)`,
      );
    }
    return this.prisma.main.stockReservation.create({
      data: { projectId: dto.projectId, productId: dto.productId, qty },
    });
  }

  async release(id: number) {
    const reservation = await this.prisma.main.stockReservation.findUnique({ where: { id } });
    if (!reservation) throw new NotFoundException("Reservasi tidak ditemukan");
    if (reservation.releasedAt) return reservation;
    return this.prisma.main.$transaction(async (tx) => {
      const r = await tx.stockReservation.update({ where: { id }, data: { releasedAt: new Date() } });
      if (reservation.serialUnitId) {
        const unit = await tx.serialUnit.findUnique({ where: { id: reservation.serialUnitId } });
        if (unit && unit.status === "RESERVED") {
          await tx.serialUnit.update({ where: { id: unit.id }, data: { status: "DI_GUDANG", projectId: null } });
          await tx.serialUnitHistory.create({
            data: {
              serialUnitId: unit.id,
              status: "DI_GUDANG",
              warehouseId: unit.warehouseId,
              note: "Reservasi dilepas",
            },
          });
        }
      }
      return r;
    });
  }

  /** Lepas semua reservasi aktif sebuah project (dipakai saat project selesai/dibatalkan). */
  async releaseForProject(projectId: number) {
    const rows = await this.prisma.main.stockReservation.findMany({
      where: { projectId, releasedAt: null },
      select: { id: true },
    });
    for (const r of rows) await this.release(r.id);
    return rows.length;
  }
}
