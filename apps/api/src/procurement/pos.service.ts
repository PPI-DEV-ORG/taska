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
    const supplier = await this.prisma.main.supplier.findUnique({ where: { id: dto.supplierId } });
    if (!supplier) throw new NotFoundException("Supplier tidak ditemukan");
    if (supplier.status !== "AKTIF") throw new BadRequestException("Supplier tidak aktif");

    if (dto.requestId) {
      const request = await this.prisma.main.purchaseRequest.findUnique({ where: { id: dto.requestId } });
      if (!request) throw new NotFoundException("Request tidak ditemukan");
      if (request.status === "DIBATALKAN" || request.status === "DITOLAK") {
        throw new BadRequestException("Request sudah dibatalkan/ditolak");
      }
    }
    let projectId = dto.projectId;
    if (!projectId && dto.requestId) {
      const request = await this.prisma.main.purchaseRequest.findUnique({ where: { id: dto.requestId } });
      projectId = request?.projectId ?? undefined;
    }
    if (projectId) {
      const project = await this.prisma.main.project.findUnique({ where: { id: projectId } });
      if (!project) throw new NotFoundException("Project tidak ditemukan");
    }

    for (const item of dto.items) {
      const product = await this.prisma.main.product.findUnique({ where: { id: item.productId } });
      if (!product) throw new NotFoundException(`Barang #${item.productId} tidak ditemukan`);
    }

    const number = dto.number?.trim() || (await this.docnum.next("pesanan"));
    await this.docnum.assertUnique(number, async (v) => !!(await this.prisma.main.supplierPO.findFirst({ where: { number: v } })));
    const total = dto.items.reduce((s, i) => s + i.qty * i.price, 0);

    const row = await this.prisma.main.supplierPO.create({
      data: {
        number,
        supplierId: dto.supplierId,
        requestId: dto.requestId,
        projectId,
        date: new Date(dto.date),
        eta: dto.eta ? new Date(dto.eta) : undefined,
        paymentTerms: dto.paymentTerms,
        total,
        status: "MENUNGGU_PERSETUJUAN",
        fileId: dto.fileId,
        doFileId: dto.doFileId,
        createdById: user.id,
        items: { create: dto.items.map((i) => ({ productId: i.productId, qty: i.qty, price: i.price })) },
      },
      include: { supplier: true },
    });
    await this.prisma.main.file.update({
      where: { id: dto.fileId },
      data: { refType: "supplier-po", refId: String(row.id) },
    });

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
    return row;
  }

  /** Tracking pengiriman diubah manual oleh Procurement (PRD). */
  async setShipment(id: number, dto: ShipmentDto, user: RequestUser) {
    const row = await this.prisma.main.supplierPO.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("PO supplier tidak ditemukan");
    if (row.status !== "DISETUJUI") throw new BadRequestException("PO harus disetujui dulu");
    if (dto.shipmentStatus === "DIKIRIM" && !dto.doFileId && !row.doFileId) {
      throw new BadRequestException("Bukti Delivery Order wajib diunggah saat status Dikirim");
    }
    if (dto.doFileId) {
      await this.prisma.main.file.update({
        where: { id: dto.doFileId },
        data: { refType: "supplier-po-do", refId: String(id) },
      });
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
    return updated;
  }

  /** Procurement menyatakan siap ke PM setelah semua barang diterima. */
  async declareReady(id: number, user: RequestUser) {
    const row = await this.prisma.main.supplierPO.findUnique({
      where: { id },
      include: { items: true, project: true },
    });
    if (!row) throw new NotFoundException("PO supplier tidak ditemukan");
    const notReady = row.items.filter((i) => i.receivedQty < i.qty);
    if (notReady.length) {
      throw new BadRequestException(`Masih ada barang belum diterima (${notReady.length} item)`);
    }
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
    return updated;
  }
}
