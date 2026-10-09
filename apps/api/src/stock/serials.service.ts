import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { StockService } from "./stock.service.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import type { ReplaceSerialDto, SerialListQuery, SerialStatusDto } from "./dto.js";

type SerialStatus = "DI_GUDANG" | "RESERVED" | "DIKIRIM" | "TERPASANG" | "RETUR" | "DIGANTI" | "RUSAK";

/** Transisi status SN (PRD: SN unik, status tercatat, keluar harus diretur dulu). */
const ALLOWED: Record<SerialStatus, SerialStatus[]> = {
  DI_GUDANG: ["RESERVED", "DIKIRIM", "RUSAK"],
  RESERVED: ["DI_GUDANG", "DIKIRIM", "RUSAK"],
  DIKIRIM: ["TERPASANG", "RETUR", "DI_GUDANG", "RUSAK"],
  TERPASANG: ["RETUR", "RUSAK"],
  RETUR: ["DI_GUDANG", "RUSAK"],
  RUSAK: ["DI_GUDANG"],
  DIGANTI: [],
};

@Injectable()
export class SerialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
  ) {}

  async list(q: SerialListQuery) {
    const where = {
      ...(q.sn ? { sn: { contains: q.sn } } : {}),
      ...(q.status ? { status: q.status as SerialStatus } : {}),
      ...(q.productId ? { productId: q.productId } : {}),
      ...(q.warehouseId ? { warehouseId: q.warehouseId } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.main.serialUnit.count({ where }),
      this.prisma.main.serialUnit.findMany({
        where,
        include: {
          product: { select: { name: true, sku: true, unit: true } },
          warehouse: { select: { name: true } },
          project: { select: { name: true } },
        },
        orderBy: { id: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
    ]);
    return { items: rows, total, page: q.page, limit: q.limit };
  }

  async get(id: number) {
    const unit = await this.prisma.main.serialUnit.findUnique({
      where: { id },
      include: {
        product: { select: { name: true, sku: true, unit: true } },
        warehouse: { select: { name: true } },
        project: { select: { name: true } },
        replacedFrom: { select: { id: true, sn: true } },
        replacedBy: { select: { id: true, sn: true } },
        history: {
          orderBy: { id: "desc" },
          include: { changer: { select: { name: true } } },
        },
      },
    });
    if (!unit) throw new NotFoundException("Serial number tidak ditemukan");
    return unit;
  }

  async setStatus(id: number, dto: SerialStatusDto, user: RequestUser) {
    const unit = await this.prisma.main.serialUnit.findUnique({ where: { id } });
    if (!unit) throw new NotFoundException("Serial number tidak ditemukan");
    const target = dto.status as SerialStatus;
    if (!ALLOWED[unit.status].includes(target)) {
      throw new BadRequestException(
        `Transisi ${unit.status} → ${target} tidak diizinkan${unit.status === "DIGANTI" ? " (unit sudah diganti)" : ""}`,
      );
    }
    if (dto.warehouseId) {
      const wh = await this.prisma.main.warehouse.findUnique({ where: { id: dto.warehouseId } });
      if (!wh) throw new NotFoundException("Gudang tidak ditemukan");
    }
    if (dto.projectId) {
      const project = await this.prisma.main.project.findUnique({ where: { id: dto.projectId } });
      if (!project) throw new NotFoundException("Project tidak ditemukan");
    }

    const updated = await this.prisma.main.serialUnit.update({
      where: { id },
      data: {
        status: target,
        ...(dto.warehouseId !== undefined ? { warehouseId: dto.warehouseId } : {}),
        ...(dto.projectId !== undefined ? { projectId: dto.projectId } : {}),
        ...(target === "DI_GUDANG" ? { projectId: null } : {}),
      },
    });
    await this.prisma.main.serialUnitHistory.create({
      data: {
        serialUnitId: id,
        status: target,
        warehouseId: updated.warehouseId,
        projectId: updated.projectId,
        note: dto.note ?? null,
        changedById: user.id,
      },
    });
    return updated;
  }

  /** Penggantian unit (PRD: alasan wajib, SN lama & SN baru terhubung). */
  async replace(id: number, dto: ReplaceSerialDto, user: RequestUser) {
    const old = await this.prisma.main.serialUnit.findUnique({ where: { id } });
    if (!old) throw new NotFoundException("Serial number tidak ditemukan");
    if (old.status === "DIGANTI") throw new BadRequestException("Unit sudah diganti sebelumnya");
    const dup = await this.prisma.main.serialUnit.findUnique({ where: { sn: dto.newSn } });
    if (dup) throw new BadRequestException(`Serial ${dto.newSn} sudah tercatat`);

    const created = await this.prisma.main.$transaction(async (tx) => {
      const unit = await tx.serialUnit.create({
        data: {
          sn: dto.newSn,
          productId: old.productId,
          status: "DI_GUDANG",
          warehouseId: old.warehouseId,
          replacedFromId: old.id,
          warrantyEndsAt: dto.warrantyEndsAt ? new Date(dto.warrantyEndsAt) : old.warrantyEndsAt,
        },
      });
      await tx.serialUnit.update({ where: { id: old.id }, data: { status: "DIGANTI" } });
      await tx.serialUnitHistory.createMany({
        data: [
          { serialUnitId: old.id, status: "DIGANTI" as SerialStatus, warehouseId: old.warehouseId, note: dto.reason, changedById: user.id },
          { serialUnitId: unit.id, status: "DI_GUDANG" as SerialStatus, warehouseId: old.warehouseId, note: `Penggantian unit ${old.sn}: ${dto.reason}`, changedById: user.id },
        ],
      });
      return unit;
    });

    if (old.warehouseId) {
      const date = new Date();
      await this.stock.applyMovement({
        date,
        type: "OUT",
        category: "PENGGANTIAN",
        productId: old.productId,
        fromWarehouseId: old.warehouseId,
        qty: 1,
        serialUnitId: old.id,
        reason: dto.reason,
        createdById: user.id,
      });
      await this.stock.applyMovement({
        date,
        type: "IN",
        category: "PENGGANTIAN",
        productId: old.productId,
        toWarehouseId: old.warehouseId,
        qty: 1,
        serialUnitId: created.id,
        reason: dto.reason,
        createdById: user.id,
      });
    }
    return created;
  }
}
