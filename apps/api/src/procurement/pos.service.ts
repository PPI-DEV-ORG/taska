import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { DocumentNumberService } from "../document-number/document-number.service.js";
import { ApprovalsService } from "../approvals/approvals.service.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip } from "../common/utils/query.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { PoDto, PoListQuery, ShipmentDto } from "./dto.js";

@Injectable()
export class PosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly docnum: DocumentNumberService,
    private readonly approvals: ApprovalsService,
  ) {
    this.approvals.onChange("SUPPLIER_PO", (entityId, status) => this.onApproval(entityId, status));
  }

  private async onApproval(entityId: number, status: "MENUNGGU" | "DISETUJUI" | "DITOLAK") {
    const row = await this.prisma.main.supplierPO.findUnique({ where: { id: entityId } });
    if (!row) return;
    if (row.status !== "MENUNGGU_PERSETUJUAN") return;

    if (status === "DISETUJUI") {
      const updated = await this.prisma.main.supplierPO.update({
        where: { id: entityId },
        data: { status: "DISETUJUI" },
      });
      if (row.requestId) {
        await this.prisma.main.purchaseRequest.updateMany({
          where: { id: row.requestId, status: { in: ["DIAJUKAN", "CEK_STOK", "DISETUJUI"] } },
          data: { status: "PO_DIBUAT" },
        });
      }
      await this.notifications.notify({
        userIds: [row.createdById].filter((v): v is number => !!v),
        kind: "STOK",
        text: `PO supplier ${row.number} disetujui — siap dikirim ke supplier`,
        href: `/procurement/po/${entityId}`,
      });
      if (updated.projectId) {
        const project = await this.prisma.main.project.findUnique({ where: { id: updated.projectId } });
        if (project) {
          await this.notifications.notify({
            userIds: [project.picId],
            kind: "STOK",
            text: `Pembelian langsung untuk project ${project.name} disetujui (${row.number})`,
            href: `/procurement/po/${entityId}`,
          });
        }
      }
    } else if (status === "DITOLAK") {
      await this.prisma.main.supplierPO.update({ where: { id: entityId }, data: { status: "DITOLAK" } });
    }
  }

  suggestNumber() {
    return this.docnum.suggest("pesanan");
  }

  async list(q: PoListQuery) {
    const where = {
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.shipmentStatus ? { shipmentStatus: q.shipmentStatus as never } : {}),
      ...(q.supplierId ? { supplierId: q.supplierId } : {}),
      ...(q.requestId ? { requestId: q.requestId } : {}),
      ...(q.projectId ? { projectId: q.projectId } : {}),
      ...(q.from || q.to
        ? { date: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } }
        : {}),
      ...(q.q
        ? {
            OR: [
              { number: { contains: q.q } },
              { supplier: { name: { contains: q.q } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.main.supplierPO.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          request: { select: { id: true, number: true, purpose: true } },
          project: { select: { id: true, name: true } },
          creator: { select: { id: true, name: true } },
          items: { include: { product: { select: { id: true, sku: true, name: true, unit: true, hasSerial: true } } } },
          _count: { select: { items: true, receivings: true } },
        },
        orderBy: orderBy(q.sort, q.dir, ["date", "createdAt"], "date"),
        ...pageSkip(q),
      }),
      this.prisma.main.supplierPO.count({ where }),
    ]);
    return paginate(items, total, q);
  }

  async get(id: number) {
    const row = await this.prisma.main.supplierPO.findUnique({
      where: { id },
      include: {
        supplier: true,
        creator: { select: { id: true, name: true } },
        request: { select: { id: true, number: true, purpose: true, status: true } },
        project: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, sku: true, name: true, unit: true, hasSerial: true } } } },
        receivings: { select: { id: true, number: true, status: true, date: true, warehouseId: true } },
        invoiceIns: { select: { id: true, number: true, status: true, total: true } },
      },
    });
    if (!row) throw new NotFoundException("PO supplier tidak ditemukan");
    const approval = await this.approvals.getFor("SUPPLIER_PO", id);
    return { ...row, approval };
  }

  async create(dto: PoDto, user: RequestUser) {
    const supplier = dto.supplierId
      ? await this.prisma.main.supplier.findUnique({ where: { id: dto.supplierId } })
      : await this.prisma.main.supplier.findFirst({ where: { status: "AKTIF" } });
    if (!supplier) throw new NotFoundException("Supplier tidak ditemukan");

    let projectId = dto.projectId;
    if (!projectId && dto.requestId) {
      const request = await this.prisma.main.purchaseRequest.findUnique({ where: { id: dto.requestId } });
      projectId = request?.projectId ?? undefined;
    }

    let items = dto.items ?? [];
    if (!items.length) {
      const firstProduct = await this.prisma.main.product.findFirst();
      if (firstProduct) {
        items = [{ productId: firstProduct.id, qty: 1, price: dto.total ?? 0 }];
      }
    }

    const number = dto.number?.trim() || (await this.docnum.next("pesanan"));
    await this.docnum.assertUnique(number, async (v) => !!(await this.prisma.main.supplierPO.findFirst({ where: { number: v } })));
    const total = dto.total ?? items.reduce((s, i) => s + i.qty * i.price, 0);

    const row = await this.prisma.main.supplierPO.create({
      data: {
        number,
        supplierId: supplier.id,
        requestId: dto.requestId,
        projectId,
        date: dto.date ? new Date(dto.date) : new Date(),
        eta: dto.eta ? new Date(dto.eta) : undefined,
        paymentTerms: dto.paymentTerms,
        total,
        status: (dto.status as any) ?? "MENUNGGU_PERSETUJUAN",
        shipmentStatus: dto.shipmentStatus ?? "DI_SUPPLIER",
        fileId: dto.fileId,
        doFileId: dto.doFileId,
        createdById: user.id,
        items: { create: items.map((i) => ({ productId: i.productId, qty: i.qty, price: i.price })) },
      },
      include: {
        supplier: true,
        request: { select: { id: true, number: true, purpose: true } },
        project: { select: { id: true, name: true } },
      },
    });
    if (dto.fileId) {
      await this.prisma.main.file.update({
        where: { id: dto.fileId },
        data: { refType: "supplier-po", refId: String(row.id) },
      }).catch(() => {});
    }

    await this.audit.log({
      actor: user,
      action: "BUAT_PO_SUPPLIER",
      entityType: "supplier-po",
      entityId: row.id,
      detail: `${number} — ${supplier.name} Rp${total}`,
    });
    await this.notifications.notify({
      roles: ["FINANCE"],
      kind: "APPROVAL",
      text: `PO supplier menunggu persetujuan: ${number} (Rp${total})`,
      href: `/procurement/po/${row.id}`,
    });
    await this.approvals.request({
      kind: "SUPPLIER_PO",
      entityId: row.id,
      title: `PO supplier ${number}`,
      amount: total,
      requestedBy: user,
      href: `/procurement/po/${row.id}`,
    });
    this.notifications.dataChange("supplier-pos", "create", row.id);
    return row;
  }

  async update(id: number, dto: PoDto, user: RequestUser) {
    const row = await this.prisma.main.supplierPO.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("PO supplier tidak ditemukan");

    if (Array.isArray(dto.items) && dto.items.length > 0) {
      await this.prisma.main.supplierPOItem.deleteMany({ where: { poId: id } });
      await this.prisma.main.supplierPOItem.createMany({
        data: dto.items.map((i) => ({
          poId: id,
          productId: i.productId,
          qty: i.qty,
          price: i.price,
        })),
      });
    }

    const updated = await this.prisma.main.supplierPO.update({
      where: { id },
      data: {
        ...(dto.number ? { number: dto.number } : {}),
        ...(dto.supplierId ? { supplierId: dto.supplierId } : {}),
        ...(dto.requestId !== undefined ? { requestId: dto.requestId } : {}),
        ...(dto.projectId !== undefined ? { projectId: dto.projectId } : {}),
        ...(dto.date ? { date: new Date(dto.date) } : {}),
        ...(dto.eta !== undefined ? { eta: dto.eta ? new Date(dto.eta) : null } : {}),
        ...(dto.paymentTerms !== undefined ? { paymentTerms: dto.paymentTerms } : {}),
        ...(dto.total !== undefined ? { total: dto.total } : {}),
        ...(dto.status ? { status: dto.status as any } : {}),
        ...(dto.shipmentStatus ? { shipmentStatus: dto.shipmentStatus } : {}),
        ...(dto.fileId !== undefined ? { fileId: dto.fileId } : {}),
        ...(dto.doFileId !== undefined ? { doFileId: dto.doFileId } : {}),
      },
      include: {
        supplier: true,
        request: { select: { id: true, number: true, purpose: true } },
        project: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, sku: true, name: true, unit: true, hasSerial: true } } } },
      },
    });
    this.notifications.dataChange("supplier-pos", "update", updated.id);
    return updated;
  }

  async setStatus(id: number, status: string, user: RequestUser) {
    const row = await this.prisma.main.supplierPO.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("PO supplier tidak ditemukan");
    const shipmentStatuses = ["BELUM_DIKIRIM", "DIKIRIM", "DALAM_PERJALANAN", "SAMPAI"];
    const data = shipmentStatuses.includes(status)
      ? { shipmentStatus: status as never, ...(status === "SAMPAI" ? { arrivedAt: new Date() } : {}) }
      : { status: status as never };
    const updated = await this.prisma.main.supplierPO.update({
      where: { id },
      data,
      include: { supplier: { select: { id: true, name: true } } },
    });
    this.notifications.dataChange("supplier-pos", "status", updated.id);
    return updated;
  }

  /** Tracking pengiriman diubah manual oleh Procurement (PRD). */
  async setShipment(id: number, dto: ShipmentDto, user: RequestUser) {
    const row = await this.prisma.main.supplierPO.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("PO supplier tidak ditemukan");
    if (dto.doFileId) {
      await this.prisma.main.file.update({
        where: { id: dto.doFileId },
        data: { refType: "supplier-po-do", refId: String(id) },
      }).catch(() => {});
    }

    const updated = await this.prisma.main.supplierPO.update({
      where: { id },
      data: {
        shipmentStatus: dto.shipmentStatus,
        ...(dto.doFileId ? { doFileId: dto.doFileId } : {}),
        ...(dto.shipmentStatus === "SAMPAI" ? { arrivedAt: new Date() } : {}),
      },
      include: { supplier: { select: { id: true, name: true } } },
    });
    await this.audit.log({
      actor: user,
      action: "UBAH_STATUS_PENGIRIMAN",
      entityType: "supplier-po",
      entityId: id,
      detail: `${row.number}: → ${dto.shipmentStatus}`,
    });
    if (dto.shipmentStatus !== row.shipmentStatus) {
      await this.notifications.notify({
        roles: ["GUDANG"],
        kind: "STOK",
        text: `Pengiriman ${row.number} (${updated.supplier.name}): ${dto.shipmentStatus}`,
        href: `/procurement/po/${id}`,
      });
    }
    this.notifications.dataChange("supplier-pos", "status", updated.id);
    return updated;
  }

  /** Procurement menyatakan siap ke PM setelah semua barang diterima. */
  async declareReady(id: number, user: RequestUser) {
    const row = await this.prisma.main.supplierPO.findUnique({
      where: { id },
      include: { items: true, project: true },
    });
    if (!row) throw new NotFoundException("PO supplier tidak ditemukan");
    await this.audit.log({
      actor: user,
      action: "NYATAKAN_SIAP",
      entityType: "supplier-po",
      entityId: id,
      detail: `${row.number} siap untuk project`,
    });
    const targets = [row.project?.picId].filter((v): v is number => !!v);
    if (targets.length) {
      await this.notifications.notify({
        userIds: targets,
        kind: "STOK",
        text: `Barang project siap: ${row.number}${row.project ? ` — ${row.project.name}` : ""}`,
        href: `/procurement/po/${id}`,
      });
    }
    this.notifications.dataChange("supplier-pos", "status", id);
    return { id, ready: true, notified: targets.length };
  }

  async cancel(id: number, user: RequestUser, reason?: string) {
    const row = await this.prisma.main.supplierPO.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("PO supplier tidak ditemukan");
    if (row.status === "DIBATALKAN") return row;
    const updated = await this.prisma.main.supplierPO.update({
      where: { id },
      data: { status: "DIBATALKAN" },
    });
    await this.audit.log({
      actor: user,
      action: "BATALKAN_PO_SUPPLIER",
      entityType: "supplier-po",
      entityId: id,
      detail: `${row.number}${reason ? ` — ${reason}` : ""}`,
    });
    this.notifications.dataChange("supplier-pos", "status", updated.id);
    return updated;
  }

  async remove(id: number, user: RequestUser) {
    const row = await this.prisma.main.supplierPO.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("PO supplier tidak ditemukan");
    await this.prisma.main.$transaction(async (tx) => {
      await tx.approval.deleteMany({ where: { kind: "SUPPLIER_PO", entityId: id } });
      await tx.supplierPOItem.deleteMany({ where: { poId: id } });
      await tx.supplierPO.delete({ where: { id } });
    });
    await this.audit.log({
      actor: user,
      action: "HAPUS_PO_SUPPLIER",
      entityType: "supplier-po",
      entityId: id,
      detail: `${row.number} dihapus`,
    });
    this.notifications.dataChange("supplier-pos", "delete", id);
    return { id, deleted: true };
  }
}
