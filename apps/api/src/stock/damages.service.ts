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
    const product = dto.productId
      ? await this.prisma.main.product.findUnique({ where: { id: dto.productId } })
      : await this.prisma.main.product.findFirst();
    if (!product) throw new NotFoundException("Produk tidak ditemukan");
    let serial = null;
    if (dto.serialUnitId) {
      serial = await this.prisma.main.serialUnit.findUnique({ where: { id: dto.serialUnitId } });
      if (!serial) throw new NotFoundException("Serial number tidak ditemukan");
    }

    const type = dto.type ?? "RUSAK";
    const description = dto.description || "-";

    const created = await this.prisma.main.$transaction(async (tx) => {
      const row = await tx.damageReport.create({
        data: {
          date: dto.date ? new Date(dto.date) : new Date(),
          productId: product.id,
          serialUnitId: dto.serialUnitId ?? null,
          type,
          qty: dto.qty ?? 1,
          description,
          status: dto.status ?? "DILAPORKAN",
          fileId: dto.fileId ?? null,
          reporterId: user.id,
        },
        include: {
          product: { select: { name: true, sku: true, unit: true } },
          serialUnit: { select: { sn: true } },
          reporter: { select: { name: true } },
        },
      });
      if (serial && serial.status !== "RUSAK" && type === "RUSAK") {
        await tx.serialUnit.update({ where: { id: serial.id }, data: { status: "RUSAK" } });
        await tx.serialUnitHistory.create({
          data: {
            serialUnitId: serial.id,
            status: "RUSAK",
            warehouseId: serial.warehouseId,
            note: description,
            changedById: user.id,
          },
        });
      }
      return row;
    });
    return created;
  }

  async update(id: number, dto: DamageCreateDto) {
    const row = await this.prisma.main.damageReport.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Laporan tidak ditemukan");
    return this.prisma.main.damageReport.update({
      where: { id },
      data: {
        ...(dto.date ? { date: new Date(dto.date) } : {}),
        ...(dto.productId ? { productId: dto.productId } : {}),
        ...(dto.type ? { type: dto.type } : {}),
        ...(dto.qty !== undefined ? { qty: dto.qty } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
      include: {
        product: { select: { name: true, sku: true, unit: true } },
        serialUnit: { select: { sn: true } },
        reporter: { select: { name: true } },
      },
    });
  }

  async setStatus(id: number, status: "DILAPORKAN" | "DIPROSES" | "SELESAI") {
    const row = await this.prisma.main.damageReport.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Laporan tidak ditemukan");
    return this.prisma.main.damageReport.update({
      where: { id },
      data: { status },
      include: {
        product: { select: { name: true, sku: true, unit: true } },
        serialUnit: { select: { sn: true } },
        reporter: { select: { name: true } },
      },
    });
  }

  async remove(id: number) {
    const row = await this.prisma.main.damageReport.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Laporan tidak ditemukan");
    await this.prisma.main.damageReport.delete({ where: { id } });
    return { id, deleted: true };
  }
}
