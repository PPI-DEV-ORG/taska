import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import type { DamageCreateDto, DamageListQuery } from "./dto.js";

@Injectable()
export class DamagesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: DamageListQuery) {
    const where = {
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.productId ? { productId: q.productId } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.main.damageReport.count({ where }),
      this.prisma.main.damageReport.findMany({
        where,
        include: {
          product: { select: { name: true, sku: true, unit: true } },
          serialUnit: { select: { sn: true } },
          reporter: { select: { name: true } },
        },
        orderBy: [{ date: "desc" }, { id: "desc" }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
    ]);
    return { items: rows, total, page: q.page, limit: q.limit };
  }

  async create(dto: DamageCreateDto, user: RequestUser) {
    const product = await this.prisma.main.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException("Produk tidak ditemukan");
    let serial = null;
    if (dto.serialUnitId) {
      serial = await this.prisma.main.serialUnit.findUnique({ where: { id: dto.serialUnitId } });
      if (!serial) throw new NotFoundException("Serial number tidak ditemukan");
      if (serial.productId !== product.id) throw new BadRequestException("Serial bukan milik produk ini");
      if (serial.status === "DIGANTI") throw new BadRequestException("Unit sudah diganti");
    }

    const created = await this.prisma.main.$transaction(async (tx) => {
      const row = await tx.damageReport.create({
        data: {
          date: dto.date ? new Date(dto.date) : new Date(),
          productId: dto.productId,
          serialUnitId: dto.serialUnitId ?? null,
          type: dto.type,
          qty: dto.qty ?? 1,
          description: dto.description,
          fileId: dto.fileId ?? null,
          reporterId: user.id,
        },
      });
      if (serial && serial.status !== "RUSAK" && dto.type === "RUSAK") {
        await tx.serialUnit.update({ where: { id: serial.id }, data: { status: "RUSAK" } });
        await tx.serialUnitHistory.create({
          data: {
            serialUnitId: serial.id,
            status: "RUSAK",
            warehouseId: serial.warehouseId,
            note: dto.description,
            changedById: user.id,
          },
        });
      }
      return row;
    });
    return created;
  }

  async setStatus(id: number, status: "DILAPORKAN" | "DIPROSES" | "SELESAI") {
    const row = await this.prisma.main.damageReport.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Laporan tidak ditemukan");
    if (row.status === "SELESAI" && status !== "SELESAI") {
      throw new BadRequestException("Laporan sudah selesai");
    }
    return this.prisma.main.damageReport.update({ where: { id }, data: { status } });
  }
}
