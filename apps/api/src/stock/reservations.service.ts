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
      ...(q.quotationId ? { quotationId: q.quotationId } : {}),
      ...(q.invoiceId ? { invoiceId: q.invoiceId } : {}),
      ...(q.purchaseRequestId ? { purchaseRequestId: q.purchaseRequestId } : {}),
      ...(q.productId ? { productId: q.productId } : {}),
      ...(q.released === "true" ? { releasedAt: { not: null } } : {}),
      ...(q.released === "false" ? { releasedAt: null } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.main.stockReservation.count({ where }),
      this.prisma.main.stockReservation.findMany({
        where,
        include: {
          project: { select: { id: true, name: true } },
          quotation: { select: { id: true, number: true, status: true } },
          invoice: { select: { id: true, number: true, status: true } },
          purchaseRequest: { select: { id: true, number: true, status: true } },
          product: { select: { id: true, name: true, sku: true, unit: true } },
          serialUnit: { select: { id: true, sn: true, status: true } },
        },
        orderBy: { id: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
    ]);
    return { items: rows, total, page: q.page, limit: q.limit };
  }

  async create(dto: ReservationCreateDto, user: RequestUser) {
    const project = dto.projectId
      ? await this.prisma.main.project.findUnique({ where: { id: dto.projectId } })
      : null;
    if (dto.projectId && !project) throw new NotFoundException("Project tidak ditemukan");

    const targetUnitIds = Array.from(
      new Set([
        ...(dto.serialUnitId ? [dto.serialUnitId] : []),
        ...(Array.isArray(dto.serialUnitIds) ? dto.serialUnitIds : []),
      ].filter((id) => Number.isFinite(id) && id > 0)),
    );

    if (targetUnitIds.length > 0) {
      const units = await this.prisma.main.serialUnit.findMany({
        where: { id: { in: targetUnitIds } },
      });
      if (units.length !== targetUnitIds.length) {
        throw new NotFoundException("Sebagian serial number tidak ditemukan");
      }
      for (const unit of units) {
        if (unit.status !== "DI_GUDANG" && unit.status !== "RESERVED") {
          throw new BadRequestException(`Unit ${unit.sn} berstatus ${unit.status}, tidak dapat direservasi`);
        }
      }

      const created = await this.prisma.main.$transaction(async (tx) => {
        const results = [];
        for (const unit of units) {
          const r = await tx.stockReservation.create({
            data: {
              projectId: dto.projectId ?? null,
              quotationId: dto.quotationId ?? null,
              invoiceId: dto.invoiceId ?? null,
              purchaseRequestId: dto.purchaseRequestId ?? null,
              productId: unit.productId,
              serialUnitId: unit.id,
              qty: 1,
            },
          });
          await tx.serialUnit.update({
            where: { id: unit.id },
            data: {
              status: "RESERVED",
              ...(dto.projectId ? { projectId: dto.projectId } : {}),
            },
          });
          await tx.serialUnitHistory.create({
            data: {
              serialUnitId: unit.id,
              status: "RESERVED",
              warehouseId: unit.warehouseId,
              projectId: dto.projectId ?? unit.projectId ?? null,
              note: project ? `Reservasi untuk ${project.name}` : "Reservasi dokumen",
              changedById: user.id,
            },
          });
          results.push(r);
        }
        return results;
      });
      return created.length === 1 ? created[0] : created;
    }

    if (!dto.productId) throw new BadRequestException("Pilih produk atau unit serial untuk direservasi");
    const qty = dto.qty ?? 1;
    const product = await this.prisma.main.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException("Produk tidak ditemukan");
    const available = await this.availableFor(dto.productId, dto.projectId);
    if (available < qty) {
      throw new BadRequestException(
        `Stok ${product.name} tidak mencukupi: tersedia ${available}, diminta ${qty} (sebagian sudah direservasi)`,
      );
    }
    return this.prisma.main.stockReservation.create({
      data: {
        projectId: dto.projectId ?? null,
        quotationId: dto.quotationId ?? null,
        invoiceId: dto.invoiceId ?? null,
        purchaseRequestId: dto.purchaseRequestId ?? null,
        productId: dto.productId,
        qty,
      },
    });
  }

  async release(id: number) {
    const reservation = await this.prisma.main.stockReservation.findUnique({ where: { id } });
    if (!reservation) throw new NotFoundException("Reservasi tidak ditemukan");
    if (reservation.releasedAt) return reservation;
    return this.prisma.main.$transaction(async (tx) => {
      const r = await tx.stockReservation.update({ where: { id }, data: { releasedAt: new Date() } });
      if (reservation.serialUnitId) {
        const otherActive = await tx.stockReservation.count({
          where: {
            serialUnitId: reservation.serialUnitId,
            releasedAt: null,
            id: { not: id },
          },
        });
        if (otherActive === 0) {
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

  /** Lepas semua reservasi aktif berdasarkan quotationId / invoiceId / purchaseRequestId. */
  async releaseForDocument(filter: { quotationId?: number; invoiceId?: number; purchaseRequestId?: number }) {
    const where: Record<string, unknown> = { releasedAt: null };
    if (filter.quotationId) where.quotationId = filter.quotationId;
    else if (filter.invoiceId) where.invoiceId = filter.invoiceId;
    else if (filter.purchaseRequestId) where.purchaseRequestId = filter.purchaseRequestId;
    else return 0;

    const rows = await this.prisma.main.stockReservation.findMany({
      where,
      select: { id: true },
    });
    for (const r of rows) await this.release(r.id);
    return rows.length;
  }

  /**
   * Sinkronisasi reservasi SN untuk dokumen (Invoice / Quotation / PurchaseRequest / Project).
   * Saat Invoice dibuat dari Quotation, SN yang ada di item di-reserve untuk Invoice tersebut.
   */
  async syncDocumentReservations(params: {
    quotationId?: number | null;
    invoiceId?: number | null;
    purchaseRequestId?: number | null;
    projectId?: number | null;
    noteLabel: string;
    userId?: number | null;
    markSerialReserved?: boolean;
    items: Array<{
      kind?: string;
      productId?: number;
      sku?: string;
      serialUnitIds?: number[];
      serialNumbers?: string[];
    }>;
  }) {
    const {
      quotationId = null,
      invoiceId = null,
      purchaseRequestId = null,
      projectId = null,
      noteLabel,
      userId = null,
      markSerialReserved = true,
      items,
    } = params;

    const docFilter: Record<string, unknown> = {};
    if (invoiceId) docFilter.invoiceId = invoiceId;
    else if (quotationId) docFilter.quotationId = quotationId;
    else if (purchaseRequestId) docFilter.purchaseRequestId = purchaseRequestId;
    else if (projectId) docFilter.projectId = projectId;
    else return [];

    const requestedIds = new Set<number>();
    const requestedSns = new Set<string>();
    for (const it of items ?? []) {
      if (it.kind === "SERVICE") continue;
      for (const id of it.serialUnitIds ?? []) {
        const n = Number(id);
        if (Number.isFinite(n) && n > 0) requestedIds.add(n);
      }
      for (const sn of it.serialNumbers ?? []) {
        const s = String(sn ?? "").trim();
        if (s) requestedSns.add(s);
      }
    }

    const units =
      requestedIds.size > 0 || requestedSns.size > 0
        ? await this.prisma.main.serialUnit.findMany({
            where: {
              OR: [
                ...(requestedIds.size > 0 ? [{ id: { in: Array.from(requestedIds) } }] : []),
                ...(requestedSns.size > 0 ? [{ sn: { in: Array.from(requestedSns) } }] : []),
              ],
            },
          })
        : [];

    const desiredUnitIdSet = new Set(units.map((u) => u.id));

    const existingActive = await this.prisma.main.stockReservation.findMany({
      where: { ...docFilter, releasedAt: null },
    });

    // Release reservations that are no longer in desiredUnitIdSet
    for (const oldRes of existingActive) {
      if (!oldRes.serialUnitId || !desiredUnitIdSet.has(oldRes.serialUnitId)) {
        await this.release(oldRes.id);
      }
    }

    const stillActiveUnitIds = new Set(
      existingActive
        .filter((r) => r.serialUnitId && desiredUnitIdSet.has(r.serialUnitId))
        .map((r) => r.serialUnitId as number),
    );

    const createdReservations = [];
    for (const unit of units) {
      if (stillActiveUnitIds.has(unit.id)) {
        if (markSerialReserved && unit.status === "DI_GUDANG") {
          await this.prisma.main.serialUnit.update({
            where: { id: unit.id },
            data: { status: "RESERVED", ...(projectId ? { projectId } : {}) },
          });
        }
        continue;
      }

      const res = await this.prisma.main.stockReservation.create({
        data: {
          projectId,
          quotationId,
          invoiceId,
          purchaseRequestId,
          productId: unit.productId,
          serialUnitId: unit.id,
          qty: 1,
        },
      });
      createdReservations.push(res);

      if (markSerialReserved && unit.status === "DI_GUDANG") {
        await this.prisma.main.serialUnit.update({
          where: { id: unit.id },
          data: {
            status: "RESERVED",
            ...(projectId ? { projectId } : {}),
          },
        });
        await this.prisma.main.serialUnitHistory.create({
          data: {
            serialUnitId: unit.id,
            status: "RESERVED",
            warehouseId: unit.warehouseId,
            projectId: projectId ?? unit.projectId ?? null,
            note: `Reservasi untuk ${noteLabel}`,
            changedById: userId ?? undefined,
          },
        });
      }
    }

    return units;
  }
}
