import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { DocumentNumberService } from "../document-number/document-number.service.js";
import { ApprovalsService } from "../approvals/approvals.service.js";
import { StockService } from "../stock/stock.service.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip } from "../common/utils/query.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { RequestDto, RequestListQuery, RequestStatusDto } from "./dto.js";

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly docnum: DocumentNumberService,
    private readonly approvals: ApprovalsService,
    private readonly stock: StockService,
  ) {
    this.approvals.onChange("PURCHASE_REQUEST", (entityId, status) =>
      this.onApproval(entityId, status),
    );
  }

  private async onApproval(entityId: number, status: "MENUNGGU" | "DISETUJUI" | "DITOLAK") {
    const row = await this.prisma.main.purchaseRequest.findUnique({ where: { id: entityId } });
    if (!row) return;
    if (row.status !== "DIAJUKAN" && row.status !== "CEK_STOK") return;
    if (status === "DISETUJUI") {
      await this.prisma.main.purchaseRequest.update({
        where: { id: entityId },
        data: { status: "DISETUJUI" },
      });
    } else if (status === "DITOLAK") {
      await this.prisma.main.purchaseRequest.update({
        where: { id: entityId },
        data: { status: "DITOLAK" },
      });
    }
  }

  private scope(user: RequestUser) {
    if (["ADMIN", "BOS", "FINANCE", "PROCUREMENT"].includes(user.role)) return {};
    if (user.role === "PM") {
      return {
        OR: [
          { requesterId: user.id },
          { project: { picId: user.id } },
          { project: { members: { some: { userId: user.id } } } },
        ],
      };
    }
    return { requesterId: user.id };
  }

  async list(q: RequestListQuery, user: RequestUser) {
    const where = {
      ...this.scope(user),
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.costType ? { costType: q.costType } : {}),
      ...(q.projectId ? { projectId: q.projectId } : {}),
      ...(q.requesterId ? { requesterId: q.requesterId } : {}),
      ...(q.from || q.to
        ? { date: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } }
        : {}),
      ...(q.q
        ? {
            OR: [
              { number: { contains: q.q } },
              { purpose: { contains: q.q } },
              { requester: { name: { contains: q.q } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.main.purchaseRequest.findMany({
        where,
        include: {
          requester: { select: { id: true, name: true, role: true } },
          project: { select: { id: true, name: true } },
          task: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          items: { include: { product: { select: { id: true, sku: true, name: true, unit: true } } } },
          _count: { select: { supplierPOs: true } },
        },
        orderBy: orderBy(q.sort, q.dir, ["date", "createdAt"], "createdAt"),
        ...pageSkip(q),
      }),
      this.prisma.main.purchaseRequest.count({ where }),
    ]);
    return paginate(items, total, q);
  }

  async get(id: number, user: RequestUser) {
    const row = await this.prisma.main.purchaseRequest.findUnique({
      where: { id },
      include: {
        requester: { select: { id: true, name: true, role: true } },
        project: { select: { id: true, name: true, picId: true } },
        task: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, sku: true, name: true, unit: true } } } },
        supplierPOs: { select: { id: true, number: true, status: true, total: true } },
      },
    });
    if (!row) throw new NotFoundException("Request tidak ditemukan");
    const approval = await this.approvals.getFor("PURCHASE_REQUEST", id);
    const stock = await Promise.all(
      row.items.map(async (i) => ({
        productId: i.productId,
        ordered: i.qty,
        available: await this.stock.totalAvailable(i.productId),
      })),
    );
    return { ...row, approval, stock };
  }

  async create(dto: RequestDto, user: RequestUser) {
    if (dto.costType === "PROJECT" && !dto.projectId) {
      throw new BadRequestException("Cost type PROJECT wajib memilih project");
    }
    if (dto.costType === "LAINNYA" && !dto.otherNote?.trim()) {
      throw new BadRequestException("Cost type LAINNYA wajib diisi keterangannya");
    }
    if (!dto.evidenceFileId) {
      throw new BadRequestException("Bukti permintaan (WA, email, atau BOQ) wajib diunggah");
    }
    if (dto.projectId) {
      const project = await this.prisma.main.project.findUnique({ where: { id: dto.projectId } });
      if (!project) throw new NotFoundException("Project tidak ditemukan");
    }
    if (dto.taskId) {
      const task = await this.prisma.main.task.findUnique({ where: { id: dto.taskId } });
      if (!task || (dto.projectId && task.projectId !== dto.projectId)) {
        throw new BadRequestException("Task bukan milik project terpilih");
      }
    }
    if (dto.supplierId) {
      const supplier = await this.prisma.main.supplier.findUnique({ where: { id: dto.supplierId } });
      if (!supplier) throw new NotFoundException("Supplier tidak ditemukan");
    }
    for (const item of dto.items) {
      const product = await this.prisma.main.product.findUnique({ where: { id: item.productId } });
      if (!product) throw new NotFoundException(`Barang #${item.productId} tidak ditemukan`);
    }

    const number = await this.docnum.next("permintaan");
    const estimated = dto.items.reduce((s, i) => s + i.qty * (i.unitCost ?? 0), 0);

    const row = await this.prisma.main.purchaseRequest.create({
      data: {
        number,
        date: dto.date ? new Date(dto.date) : new Date(),
        requesterId: user.id,
        costType: dto.costType,
        projectId: dto.projectId,
        taskId: dto.taskId,
        supplierId: dto.supplierId,
        condition: dto.condition ?? "BARU",
        estimatedCost: estimated,
        purpose: dto.purpose,
        otherNote: dto.otherNote,
        evidenceFileId: dto.evidenceFileId,
        status: "DIAJUKAN",
        items: { create: dto.items.map((i) => ({ productId: i.productId, qty: i.qty, unitCost: i.unitCost ?? 0 })) },
      },
      include: { project: { select: { id: true, name: true } } },
    });
    await this.prisma.main.file.update({
      where: { id: dto.evidenceFileId },
      data: { refType: "purchase-request", refId: String(row.id) },
    });

    await this.audit.log({
      actor: user,
      action: "BUAT_REQUEST_BARANG",
      entityType: "purchase-request",
      entityId: row.id,
      detail: `${number} — ${dto.purpose} Rp${estimated}`,
    });
    await this.notifications.notify({
      roles: ["PROCUREMENT"],
      kind: "STOK",
      text: `Request barang baru: ${number} — ${dto.purpose}`,
      href: `/requests/${row.id}`,
    });
    await this.approvals.request({
      kind: "PURCHASE_REQUEST",
      entityId: row.id,
      title: `Request barang ${number}`,
      amount: estimated,
      requestedBy: user,
      href: `/requests/${row.id}`,
    });
    return row;
  }

  /** Procurement memproses request (cek stok, teruskan ke gudang, tolak). */
  async setStatus(id: number, dto: RequestStatusDto, user: RequestUser) {
    const row = await this.prisma.main.purchaseRequest.findUnique({
      where: { id },
      include: { items: true, project: { select: { id: true, name: true } } },
    });
    if (!row) throw new NotFoundException("Request tidak ditemukan");

    const allowed: Record<string, string[]> = {
      CEK_STOK: ["DIAJUKAN", "CEK_STOK", "DISETUJUI"],
      DIKIRIM: ["CEK_STOK", "DISETUJUI", "DIAJUKAN"],
      DITOLAK: ["DIAJUKAN", "CEK_STOK", "DISETUJUI"],
      DIBATALKAN: ["DIAJUKAN", "CEK_STOK", "DISETUJUI"],
      DITERIMA: ["PO_DIBUAT", "DIKIRIM", "DISETUJUI"],
      DISETUJUI: ["DIAJUKAN", "CEK_STOK"],
      PO_DIBUAT: ["CEK_STOK", "DISETUJUI", "DIAJUKAN"],
    };
    if (!allowed[dto.status]?.includes(row.status)) {
      throw new BadRequestException(`Status ${row.status} tidak bisa menjadi ${dto.status}`);
    }

    if (dto.status === "DIKIRIM") {
      for (const item of row.items) {
        const available = await this.stock.totalAvailable(item.productId);
        if (available < item.qty) {
          const product = await this.prisma.main.product.findUnique({ where: { id: item.productId } });
          throw new BadRequestException(
            `Stok ${product?.name} tidak cukup (${available} tersedia, dibutuhkan ${item.qty}) — buat PO ke supplier`,
          );
        }
      }
    }
    if (dto.status === "DITOLAK" && !dto.reason) {
      throw new BadRequestException("Alasan penolakan wajib diisi");
    }

    const updated = await this.prisma.main.purchaseRequest.update({
      where: { id },
      data: { status: dto.status as never, rejectReason: dto.reason ?? row.rejectReason },
      include: { project: { select: { id: true, name: true } } },
    });
    await this.audit.log({
      actor: user,
      action: "UBAH_STATUS_REQUEST",
      entityType: "purchase-request",
      entityId: id,
      detail: `${row.number}: ${row.status} → ${dto.status}${dto.reason ? ` — ${dto.reason}` : ""}`,
    });
    if (row.requesterId !== user.id) {
      await this.notifications.notify({
        userIds: [row.requesterId],
        kind: "STOK",
        text: `Request ${row.number}: ${row.status} → ${dto.status}${dto.reason ? ` (${dto.reason})` : ""}`,
        href: `/requests/${id}`,
      });
    }
    if (dto.status === "DIKIRIM" && row.project) {
      await this.notifications.notify({
        roles: ["GUDANG"],
        kind: "STOK",
        text: `Siapkan barang untuk ${row.project.name}: ${row.number}`,
        href: `/requests/${id}`,
      });
    }
    return updated;
  }

  suggestNumber() {
    return this.docnum.suggest("permintaan");
  }

  /** Ketersediaan stok per item (dipakai saat cek stok). */
  async checkStock(id: number) {
    const row = await this.prisma.main.purchaseRequest.findUnique({
      where: { id },
      include: { items: { include: { product: { select: { id: true, name: true, unit: true } } } } },
    });
    if (!row) throw new NotFoundException("Request tidak ditemukan");
    const items = await Promise.all(
      row.items.map(async (i) => {
        const available = await this.stock.totalAvailable(i.productId);
        return {
          productId: i.productId,
          name: i.product.name,
          unit: i.product.unit,
          ordered: i.qty,
          available,
          enough: available >= i.qty,
        };
      }),
    );
    return { requestId: id, number: row.number, items, allEnough: items.every((i) => i.enough) };
  }
}
