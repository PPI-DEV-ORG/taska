import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { StockService } from "./stock.service.js";
import { ApprovalsService } from "../approvals/approvals.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import type { OpnameCreateDto, OpnameSubmitDto } from "./dto.js";
import type { PageQuery } from "../common/dto/page-query.js";

export type OpnameListQuery = PageQuery & { status?: string; warehouseId?: number };

@Injectable()
export class OpnameService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly approvals: ApprovalsService,
    private readonly notifications: NotificationsService,
  ) {
    this.approvals.onChange("OPNAME", (entityId, status) => this.onApproval(entityId, status));
  }

  private async onApproval(entityId: number, status: "MENUNGGU" | "DISETUJUI" | "DITOLAK") {
    const opname = await this.prisma.main.stockOpname.findUnique({
      where: { id: entityId },
      include: { details: true },
    });
    if (!opname || opname.status !== "MENUNGGU_PERSETUJUAN") return;

    if (status === "DITOLAK") {
      await this.prisma.main.stockOpname.update({
        where: { id: entityId },
        data: { status: "DITOLAK" },
      });
      return;
    }

    const date = new Date();
    for (const d of opname.details) {
      if (d.diff === 0) continue;
      await this.stock.applyMovement({
        date,
        type: d.diff > 0 ? "IN" : "OUT",
        category: "PENYESUAIAN_OPNAME",
        productId: d.productId,
        ...(d.diff > 0
          ? { toWarehouseId: opname.warehouseId }
          : { fromWarehouseId: opname.warehouseId }),
        qty: Math.abs(d.diff),
        reason: `${opname.reason ?? "Stok opname"} — selisih ${d.diff > 0 ? "+" : ""}${d.diff}`,
        createdById: opname.conductorId,
      });
    }
    await this.prisma.main.stockOpname.update({ where: { id: entityId }, data: { status: "DISETUJUI" } });
    await this.notifications.notify({
      roles: ["GUDANG"],
      kind: "STOK",
      text: `Penyesuaian opname #${opname.id} telah disetujui dan diterapkan`,
      href: `/stock/opnames/${opname.id}`,
    });
  }

  async create(dto: OpnameCreateDto, user: RequestUser) {
    const warehouse = await this.prisma.main.warehouse.findUnique({ where: { id: dto.warehouseId } });
    if (!warehouse) throw new NotFoundException("Gudang tidak ditemukan");
    if (!dto.details.length) throw new BadRequestException("Detail opname minimal 1 produk");
    const ids = dto.details.map((d) => d.productId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException("Ada produk ganda di detail opname");

    let conductorId = dto.conductorId ?? user.id;
    if (dto.conductorId && dto.conductorId !== user.id) {
      const conductor = await this.prisma.main.user.findUnique({ where: { id: dto.conductorId } });
      if (!conductor) throw new NotFoundException("Penanggung jawab opname tidak ditemukan");
      conductorId = dto.conductorId;
    }

    const created = await this.prisma.main.$transaction(async (tx) => {
      const opname = await tx.stockOpname.create({
        data: {
          warehouseId: dto.warehouseId,
          date: new Date(dto.date),
          conductorId,
          reason: dto.reason ?? null,
        },
      });
      const rows = [];
      for (const d of dto.details) {
        const balance = await tx.stockBalance.findUnique({
          where: { productId_warehouseId: { productId: d.productId, warehouseId: dto.warehouseId } },
        });
        const systemQty = balance?.qty ?? 0;
        rows.push(
          await tx.stockOpnameDetail.create({
            data: {
              opnameId: opname.id,
              productId: d.productId,
              systemQty,
              countedQty: d.countedQty,
              diff: d.countedQty - systemQty,
              note: d.note ?? null,
            },
          }),
        );
      }
      return { ...opname, details: rows };
    });
    return created;
  }

  async submit(id: number, dto: OpnameSubmitDto, user: RequestUser) {
    const opname = await this.prisma.main.stockOpname.findUnique({
      where: { id },
      include: { details: true, warehouse: { select: { name: true } } },
    });
    if (!opname) throw new NotFoundException("Opname tidak ditemukan");
    if (opname.status !== "DRAFT") throw new BadRequestException("Hanya opname DRAFT yang bisa diajukan");

    const hasDiff = opname.details.some((d) => d.diff !== 0);
    const reason = dto.reason ?? opname.reason;
    if (hasDiff && (!reason || reason.trim().length < 3)) {
      throw new BadRequestException("Selisih stok terdeteksi — alasan penyesuaian wajib diisi (min. 3 huruf)");
    }

    const amount = opname.details.reduce((s, d) => s + Math.abs(d.diff), 0);
    const updated = await this.prisma.main.stockOpname.update({
      where: { id },
      data: { status: "MENUNGGU_PERSETUJUAN", reason: reason ?? null },
    });
    await this.approvals.request({
      kind: "OPNAME",
      entityId: id,
      title: `Opname #${id} — ${opname.warehouse.name}`,
      amount,
      requestedBy: user,
      href: `/stock/opnames/${id}`,
    });
    return updated;
  }

  async list(q: OpnameListQuery) {
    const where = {
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.warehouseId ? { warehouseId: q.warehouseId } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.main.stockOpname.count({ where }),
      this.prisma.main.stockOpname.findMany({
        where,
        include: {
          warehouse: { select: { name: true } },
          conductor: { select: { name: true } },
          details: { include: { product: { select: { name: true, sku: true, unit: true } } } },
        },
        orderBy: { id: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
    ]);
    return { items: rows, total, page: q.page, limit: q.limit };
  }

  async get(id: number) {
    const opname = await this.prisma.main.stockOpname.findUnique({
      where: { id },
      include: {
        warehouse: { select: { name: true } },
        conductor: { select: { name: true } },
        details: { include: { product: { select: { name: true, sku: true, unit: true, minStock: true } } } },
      },
    });
    if (!opname) throw new NotFoundException("Opname tidak ditemukan");
    const approval = await this.approvals.getFor("OPNAME", id);
    return { ...opname, approval };
  }
}
