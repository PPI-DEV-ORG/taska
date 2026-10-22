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
    } else if (dto.description) {
      const snMatch = dto.description.match(/\[SN:\s*([^\]]+)\]/i);
      if (snMatch?.[1]) {
        serial = await this.prisma.main.serialUnit.findUnique({
          where: { sn: snMatch[1].trim() },
        });
      }
    }

    const type = dto.type ?? "RUSAK";
    const description = dto.description || "-";
    const isReturPenjualan = description.includes("[RETUR-PENJUALAN]");
    const isReturPembelian = description.includes("[RETUR-PEMBELIAN]");

    const created = await this.prisma.main.$transaction(async (tx) => {
      const row = await tx.damageReport.create({
        data: {
          date: dto.date ? new Date(dto.date) : new Date(),
          productId: product.id,
          serialUnitId: serial?.id ?? dto.serialUnitId ?? null,
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
      if (serial) {
        const nextSerialStatus = isReturPenjualan || isReturPembelian ? "RETUR" : type === "RUSAK" ? "RUSAK" : null;
        if (nextSerialStatus && serial.status !== nextSerialStatus) {
          await tx.serialUnit.update({ where: { id: serial.id }, data: { status: nextSerialStatus as any } });
          await tx.serialUnitHistory.create({
            data: {
              serialUnitId: serial.id,
              status: nextSerialStatus as any,
              warehouseId: serial.warehouseId,
              note: description,
              changedById: user.id,
            },
          });
        }
      }
      if (isReturPenjualan || isReturPembelian) {
        const wh = serial?.warehouseId
          ? { id: serial.warehouseId }
          : await tx.warehouse.findFirst({ select: { id: true } });
        if (wh) {
          await tx.stockMovement.create({
            data: {
              date: dto.date ? new Date(dto.date) : new Date(),
              type: isReturPenjualan ? "IN" : "OUT",
              category: isReturPenjualan ? "RETUR_PROJECT" : "PENGGANTIAN",
              productId: product.id,
              qty: dto.qty ?? 1,
              ...(isReturPenjualan ? { toWarehouseId: wh.id } : { fromWarehouseId: wh.id }),
              snList: serial?.sn ?? null,
              note: description,
              createdById: user.id,
            },
          });
        }
      }
      return row;
    });
    if (dto.fileId) {
      await this.prisma.main.file
        .update({
          where: { id: dto.fileId },
          data: { refType: "damage-report", refId: String(created.id) },
        })
        .catch(() => {});
    }
    return created;
  }

  async get(id: number) {
    const row = await this.prisma.main.damageReport.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, name: true, sku: true, unit: true } },
        serialUnit: { select: { id: true, sn: true } },
        reporter: { select: { id: true, name: true } },
      },
    });
    if (!row) throw new NotFoundException("Laporan tidak ditemukan");
    const file = row.fileId
      ? await this.prisma.main.file.findUnique({
          where: { id: row.fileId },
          select: { id: true, originalName: true, mimeType: true, size: true },
        })
      : null;
    return { ...row, file };
  }

  async update(id: number, dto: DamageCreateDto) {
    const row = await this.prisma.main.damageReport.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Laporan tidak ditemukan");
    const updated = await this.prisma.main.damageReport.update({
      where: { id },
      data: {
        ...(dto.date ? { date: new Date(dto.date) } : {}),
        ...(dto.productId ? { productId: dto.productId } : {}),
        ...(dto.type ? { type: dto.type } : {}),
        ...(dto.qty !== undefined ? { qty: dto.qty } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.fileId !== undefined ? { fileId: dto.fileId } : {}),
      },
      include: {
        product: { select: { name: true, sku: true, unit: true } },
        serialUnit: { select: { sn: true } },
        reporter: { select: { name: true } },
      },
    });
    if (dto.fileId) {
      await this.prisma.main.file
        .update({
          where: { id: dto.fileId },
          data: { refType: "damage-report", refId: String(id) },
        })
        .catch(() => {});
    }
    return updated;
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
