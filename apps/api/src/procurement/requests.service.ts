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
    const costType = dto.costType ?? "STOK";
    let projectId = dto.projectId;
    if (costType === "PROJECT" && !projectId) {
      const firstProj = await this.prisma.main.project.findFirst();
      projectId = firstProj?.id;
    }
    const purpose = dto.purpose || "Kebutuhan operasional";
    const otherNote = costType === "LAINNYA" && !dto.otherNote?.trim() ? purpose : dto.otherNote;

    let items = dto.items ?? [];
    if (!items.length) {
      const firstProduct = await this.prisma.main.product.findFirst();
      if (firstProduct) {
        items = [{ productId: firstProduct.id, qty: 1, unitCost: 0 }];
      }
    }

    const number = await this.docnum.next("permintaan");
    const estimated = items.reduce((s, i) => s + i.qty * (i.unitCost ?? 0), 0);

    const row = await this.prisma.main.purchaseRequest.create({
      data: {
        number,
        date: dto.date ? new Date(dto.date) : new Date(),
        requesterId: user.id,
        costType,
        projectId,
        taskId: dto.taskId,
        supplierId: dto.supplierId,
        condition: dto.condition ?? "BARU",
        estimatedCost: estimated,
        purpose,
        otherNote,
        evidenceFileId: dto.evidenceFileId,
        status: (dto.status as any) ?? "DIAJUKAN",
        items: { create: items.map((i) => ({ productId: i.productId, qty: i.qty, unitCost: i.unitCost ?? 0 })) },
      },
      include: {
        requester: { select: { id: true, name: true, role: true } },
        project: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, sku: true, name: true, unit: true } } } },
      },
    });
    if (dto.evidenceFileId) {
      await this.prisma.main.file.update({
        where: { id: dto.evidenceFileId },
        data: { refType: "purchase-request", refId: String(row.id) },
      }).catch(() => {});
    }

    await this.audit.log({
      actor: user,
      action: "BUAT_REQUEST_BARANG",
      entityType: "purchase-request",
      entityId: row.id,
      detail: `${number} — ${purpose} Rp${estimated}`,
    });
    await this.notifications.notify({
      roles: ["PROCUREMENT"],
      kind: "STOK",
      text: `Request barang baru: ${number} — ${purpose}`,
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

  async update(id: number, dto: RequestDto, user: RequestUser) {
    const row = await this.prisma.main.purchaseRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Request tidak ditemukan");

    const updated = await this.prisma.main.purchaseRequest.update({
      where: { id },
      data: {
        ...(dto.date ? { date: new Date(dto.date) } : {}),
        ...(dto.costType ? { costType: dto.costType } : {}),
        ...(dto.projectId !== undefined ? { projectId: dto.projectId } : {}),
        ...(dto.taskId !== undefined ? { taskId: dto.taskId } : {}),
        ...(dto.supplierId !== undefined ? { supplierId: dto.supplierId } : {}),
        ...(dto.condition ? { condition: dto.condition } : {}),
        ...(dto.purpose !== undefined ? { purpose: dto.purpose } : {}),
        ...(dto.otherNote !== undefined ? { otherNote: dto.otherNote } : {}),
        ...(dto.evidenceFileId !== undefined ? { evidenceFileId: dto.evidenceFileId } : {}),
        ...(dto.status ? { status: dto.status as any } : {}),
        ...(dto.items?.length
          ? {
              estimatedCost: dto.items.reduce((s, i) => s + i.qty * (i.unitCost ?? 0), 0),
              items: {
                deleteMany: {},
                create: dto.items.map((i) => ({ productId: i.productId, qty: i.qty, unitCost: i.unitCost ?? 0 })),
              },
            }
          : {}),
      },
      include: {
        requester: { select: { id: true, name: true, role: true } },
        project: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, sku: true, name: true, unit: true } } } },
      },
    });
    return updated;
  }

  /** Procurement memproses request (cek stok, teruskan ke gudang, tolak). */
  async setStatus(id: number, dto: RequestStatusDto, user: RequestUser) {
    const row = await this.prisma.main.purchaseRequest.findUnique({
      where: { id },
      include: { items: true, project: { select: { id: true, name: true } } },
    });
    if (!row) throw new NotFoundException("Request tidak ditemukan");

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

  async remove(id: number, user: RequestUser) {
    const row = await this.prisma.main.purchaseRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Request tidak ditemukan");
    await this.prisma.main.$transaction(async (tx) => {
      await tx.approval.deleteMany({ where: { kind: "PURCHASE_REQUEST", entityId: id } });
      await tx.purchaseRequestItem.deleteMany({ where: { requestId: id } });
      await tx.purchaseRequest.delete({ where: { id } });
    });
    await this.audit.log({
      actor: user,
      action: "HAPUS_REQUEST_BARANG",
      entityType: "purchase-request",
      entityId: id,
      detail: `${row.number} dihapus`,
    });
    return { id, deleted: true };
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
