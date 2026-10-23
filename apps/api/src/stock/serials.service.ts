import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { StockService } from "./stock.service.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import type { CreateSerialBatchDto, ReplaceSerialDto, SerialListQuery, SerialStatusDto } from "./dto.js";

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
          product: { select: { id: true, name: true, sku: true, unit: true, brand: true, purchasePrice: true } },
          warehouse: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
          reservations: {
            where: { releasedAt: null },
            include: {
              invoice: { select: { id: true, number: true, status: true } },
              quotation: { select: { id: true, number: true, status: true } },
              project: { select: { id: true, name: true } },
              purchaseRequest: { select: { id: true, number: true, status: true } },
            },
            orderBy: { id: "desc" },
          },
        },
        orderBy: q.fifo === "true" ? { id: "asc" } : { id: "desc" },
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
        product: { select: { id: true, name: true, sku: true, unit: true, brand: true } },
        warehouse: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        replacedFrom: { select: { id: true, sn: true } },
        replacedBy: { select: { id: true, sn: true } },
        reservations: {
          where: { releasedAt: null },
          include: {
            invoice: { select: { id: true, number: true, status: true } },
            quotation: { select: { id: true, number: true, status: true } },
            project: { select: { id: true, name: true } },
            purchaseRequest: { select: { id: true, number: true, status: true } },
          },
        },
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
    const cleanNewSn = dto.newSn.trim();
    const dup = await this.prisma.main.serialUnit.findUnique({ where: { sn: cleanNewSn } });
    if (dup) throw new BadRequestException(`Serial ${cleanNewSn} sudah tercatat`);

    // Cek apakah SN lama sebelumnya sudah dikurangi stoknya oleh Laporan Kerusakan / Retur
    const wasAlreadyDeducted = old.status === "RUSAK" || old.status === "RETUR";
    const wh = old.warehouseId
      ? { id: old.warehouseId }
      : await this.prisma.main.warehouse.findFirst({ select: { id: true } });

    const created = await this.prisma.main.$transaction(async (tx) => {
      const unit = await tx.serialUnit.create({
        data: {
          sn: cleanNewSn,
          productId: old.productId,
          status: "DI_GUDANG",
          warehouseId: wh?.id ?? old.warehouseId,
          replacedFromId: old.id,
          warrantyEndsAt: dto.warrantyEndsAt ? new Date(dto.warrantyEndsAt) : old.warrantyEndsAt,
        },
      });
      await tx.serialUnit.update({ where: { id: old.id }, data: { status: "DIGANTI" } });
      await tx.serialUnitHistory.createMany({
        data: [
          {
            serialUnitId: old.id,
            status: "DIGANTI" as SerialStatus,
            warehouseId: wh?.id ?? old.warehouseId,
            note: `Diganti dengan SN ${cleanNewSn} — ${dto.reason}`,
            changedById: user.id,
          },
          {
            serialUnitId: unit.id,
            status: "DI_GUDANG" as SerialStatus,
            warehouseId: wh?.id ?? old.warehouseId,
            note: `Unit pengganti dari SN ${old.sn}: ${dto.reason}`,
            changedById: user.id,
          },
        ],
      });

      // Tandai laporan kerusakan/retur terkait SN lama ini menjadi SELESAI
      await tx.damageReport.updateMany({
        where: {
          OR: [
            { serialUnitId: old.id },
            ...(dto.damageReportId ? [{ id: dto.damageReportId }] : []),
          ],
          status: { not: "SELESAI" },
        },
        data: {
          status: "SELESAI",
        },
      });
      return unit;
    });

    if (wh?.id) {
      const date = new Date();
      // Jika sebelumnya masih DI_GUDANG (belum dikurangi oleh laporan rusak/retur), kurangi dulu 1 unit
      if (!wasAlreadyDeducted) {
        await this.stock.applyMovement({
          date,
          type: "OUT",
          category: "PENGGANTIAN",
          productId: old.productId,
          fromWarehouseId: wh.id,
          qty: 1,
          serialUnitId: old.id,
          reason: `Unit rusak keluar (${old.sn} → ${cleanNewSn}): ${dto.reason}`,
          createdById: user.id,
        }).catch(() => {});
      }
      // Tambahkan +1 stok untuk unit pengganti baru yang masuk ke gudang
      await this.stock.applyMovement({
        date,
        type: "IN",
        category: "PENGGANTIAN",
        productId: old.productId,
        toWarehouseId: wh.id,
        qty: 1,
        serialUnitId: created.id,
        reason: `Terima unit pengganti SN ${cleanNewSn} (menggantikan SN ${old.sn}): ${dto.reason}`,
        createdById: user.id,
      });
    }
    return created;
  }

  /** Registrasi batch Serial Number untuk suatu barang (contoh: 10 unit kamera UNV dengan SN berbeda). */
  async createBatch(dto: CreateSerialBatchDto, user: RequestUser) {
    const product = await this.prisma.main.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException("Produk tidak ditemukan");

    const cleanedSerials = Array.from(
      new Set(
        (dto.serials ?? [])
          .flatMap((s) => String(s).split(/[\n,;]+/))
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    );
    if (cleanedSerials.length === 0) {
      throw new BadRequestException("Masukkan minimal 1 Serial Number (SN)");
    }

    let warehouseId = dto.warehouseId;
    if (warehouseId) {
      const wh = await this.prisma.main.warehouse.findUnique({ where: { id: warehouseId } });
      if (!wh) throw new NotFoundException("Gudang tidak ditemukan");
    } else {
      const defaultWh =
        (await this.prisma.main.warehouse.findFirst({ where: { status: "AKTIF" } })) ??
        (await this.prisma.main.warehouse.findFirst());
      warehouseId = defaultWh?.id;
    }

    const existing = await this.prisma.main.serialUnit.findMany({
      where: { sn: { in: cleanedSerials } },
      select: { sn: true },
    });
    const existingSet = new Set(existing.map((e) => e.sn.toLowerCase()));
    const newSerials = cleanedSerials.filter((sn) => !existingSet.has(sn.toLowerCase()));

    if (newSerials.length === 0) {
      throw new BadRequestException(
        `Semua Serial Number yang dimasukkan sudah terdaftar (${existing.map((e) => e.sn).join(", ")})`,
      );
    }

    let warrantyEndsAt: Date | null = null;
    if (dto.warrantyEndsAt) {
      warrantyEndsAt = new Date(dto.warrantyEndsAt);
    } else if (product.warrantyMonths && product.warrantyMonths > 0) {
      const d = new Date();
      d.setMonth(d.getMonth() + product.warrantyMonths);
      warrantyEndsAt = d;
    }

    if (!product.hasSerial) {
      await this.prisma.main.product.update({
        where: { id: product.id },
        data: { hasSerial: true },
      });
    }

    const createdUnits = await this.prisma.main.$transaction(async (tx) => {
      const units = [];
      for (const sn of newSerials) {
        const u = await tx.serialUnit.create({
          data: {
            sn,
            productId: product.id,
            status: "DI_GUDANG",
            warehouseId: warehouseId ?? null,
            warrantyEndsAt,
          },
        });
        await tx.serialUnitHistory.create({
          data: {
            serialUnitId: u.id,
            status: "DI_GUDANG",
            warehouseId: warehouseId ?? null,
            note: dto.note || `Registrasi unit SN baru (${product.name})`,
            changedById: user.id,
          },
        });
        units.push(u);
      }
      return units;
    });

    if (warehouseId) {
      const now = new Date();
      for (const u of createdUnits) {
        await this.stock.applyMovement({
          date: now,
          type: "IN",
          category: "LAINNYA",
          productId: product.id,
          toWarehouseId: warehouseId,
          qty: 1,
          serialUnitId: u.id,
          reason: dto.note || `Tambah unit SN ${u.sn}`,
          createdById: user.id,
        }).catch(() => {});
      }
    }

    return {
      productId: product.id,
      productName: product.name,
      addedCount: createdUnits.length,
      skippedDuplicates: cleanedSerials.length - newSerials.length,
      units: createdUnits,
    };
  }
}
