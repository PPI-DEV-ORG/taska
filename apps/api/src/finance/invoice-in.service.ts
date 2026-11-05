import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { DocumentNumberService } from "../document-number/document-number.service.js";
import { ApprovalsService } from "../approvals/approvals.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip } from "../common/utils/query.js";
import type { InvoiceIn, Role } from "../generated/prisma/client.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { InvoiceInDto, PaymentDto } from "./dto.js";

type StatusFilter = "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE" | "BATAL";

@Injectable()
export class InvoiceInService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly docnum: DocumentNumberService,
    private readonly approvals: ApprovalsService,
    private readonly notifications: NotificationsService,
  ) {}

  private compute(row: InvoiceIn): StatusFilter {
    if (row.status === "BATAL") return "BATAL";
    const total = Number(row.total);
    const paid = Number(row.paidAmount);
    if (paid >= total && total > 0) return "PAID";
    if (new Date(row.dueDate).getTime() < Date.now()) return "OVERDUE";
    if (paid > 0) return "PARTIAL";
    return "UNPAID";
  }

  private async sync(row: InvoiceIn) {
    const status = this.compute(row);
    if (status !== row.status) {
      await this.prisma.main.invoiceIn.update({ where: { id: row.id }, data: { status } });
    }
    return { ...row, status };
  }

  private async syncLinkedRequest(supplierPoId?: number | null, payFileId?: number | null) {
    if (!supplierPoId) return;
    try {
      const po = await this.prisma.main.supplierPO.findUnique({
        where: { id: supplierPoId },
        select: { id: true, requestId: true, shipmentStatus: true },
      });
      if (po?.requestId) {
        await this.prisma.main.purchaseRequest.updateMany({
          where: { id: po.requestId },
          data: {
            paymentStatus: "DIBAYAR",
            status: po.shipmentStatus === "SAMPAI" ? "DITERIMA" : undefined,
            ...(payFileId ? { paymentProofFileId: payFileId } : {}),
            otherNote: "[DIBAYAR DARI PO SUPPLIER]",
          },
        });
        this.notifications.dataChange("purchase-requests", "update", po.requestId);
        this.notifications.dataChange("purchase-requests", "status", po.requestId);
      }
    } catch (e) {
      console.warn("Gagal sinkron pelunasan ke purchase-request:", e);
    }
  }

  private where(q: PageQuery & { status?: string; supplierId?: number }) {
    return {
      ...(q.supplierId ? { supplierId: q.supplierId } : {}),
      ...(q.status === "OVERDUE"
        ? { status: { in: ["UNPAID", "PARTIAL"] as never }, dueDate: { lt: new Date() } }
        : q.status
          ? { status: q.status as never }
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
  }

  async list(q: PageQuery & { status?: string; supplierId?: number }) {
    const where = this.where(q);
    const [rows, total] = await Promise.all([
      this.prisma.main.invoiceIn.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          supplierPo: { select: { id: true, number: true } },
          payments: { orderBy: { date: "desc" } },
          _count: { select: { payments: true } },
        },
        orderBy: orderBy(q.sort, q.dir, ["dueDate", "createdAt"], "dueDate"),
        ...pageSkip(q),
      }),
      this.prisma.main.invoiceIn.count({ where }),
    ]);
    const items = await Promise.all(rows.map((r) => this.sync(r)));
    return paginate(items, total, q);
  }

  async get(id: number) {
    const row = await this.prisma.main.invoiceIn.findUnique({
      where: { id },
      include: { supplier: true, supplierPo: true, payments: { orderBy: { date: "desc" } } },
    });
    if (!row) throw new NotFoundException("Invoice supplier tidak ditemukan");
    const approval = await this.approvals.getFor("INVOICE_IN", id);
    return { ...(await this.sync(row)), approval };
  }

  async create(dto: InvoiceInDto, user: RequestUser) {
    const supplier = await this.prisma.main.supplier.findUnique({ where: { id: dto.supplierId } });
    if (!supplier) throw new NotFoundException("Supplier tidak ditemukan");
    const number = dto.number?.trim() || null;
    if (number) {
      const dup = await this.prisma.main.invoiceIn.findFirst({ where: { number } });
      if (dup) throw new BadRequestException(`Nomor ${number} sudah dipakai`);
    }

    const isPaid = !!dto.paid;
    const payFileId = dto.paymentFileId ?? dto.transferFileId;

    const row = await this.prisma.main.invoiceIn.create({
      data: {
        number,
        supplierId: dto.supplierId,
        supplierPoId: dto.supplierPoId,
        amount: dto.amount,
        ppn: dto.ppn ?? 0,
        total: dto.total,
        dueDate: new Date(dto.dueDate),
        status: isPaid ? "PAID" : "UNPAID",
        paidAmount: isPaid ? dto.total : 0,
        fileId: dto.fileId,
        transferFileId: payFileId,
      },
      include: { supplier: true },
    });
    if (dto.fileId) {
      await this.prisma.main.file.update({
        where: { id: dto.fileId },
        data: { refType: "invoiceIn", refId: String(row.id) },
      }).catch(() => {});
    }
    if (payFileId) {
      await this.prisma.main.file.update({
        where: { id: payFileId },
        data: { refType: "payment", refId: `in-${row.id}` },
      }).catch(() => {});
    }

    if (isPaid) {
      const finalReference = dto.coaAccount
        ? `[AKUN:${dto.coaAccount}] ${dto.paymentReference || `LUNAS-${number || row.id}`}`.trim()
        : (dto.paymentReference || `LUNAS-${number || row.id}`);

      await this.prisma.main.payment.create({
        data: {
          invoiceInId: row.id,
          amount: dto.total,
          date: dto.date ? new Date(dto.date) : new Date(),
          method: (dto.paymentMethod as any) ?? "TRANSFER",
          reference: finalReference,
          fileId: payFileId,
          createdById: user.id,
        },
      });
    }

    const approval = await this.approvals.request({
      kind: "INVOICE_IN",
      entityId: row.id,
      title: `Invoice supplier ${supplier.name}${number ? ` (${number})` : ""}`,
      amount: Number(dto.total),
      requestedBy: user,
      href: `/invoice-in/${row.id}`,
      confirmRoles: isPaid ? [user.role as Role] : undefined,
    });
    if (isPaid && approval.status === "MENUNGGU") {
      await this.prisma.main.approval.update({
        where: { id: approval.id },
        data: { status: "DISETUJUI" },
      }).catch(() => {});
      await this.prisma.main.approvalStep.updateMany({
        where: { approvalId: approval.id },
        data: { status: "DISETUJUI", decidedById: user.id, decidedAt: new Date() },
      }).catch(() => {});
    }

    if (isPaid) {
      await this.syncLinkedRequest(row.supplierPoId, payFileId);
    }

    await this.audit.log({
      actor: user,
      action: isPaid ? "BUAT_DAN_LUNASI_INVOICE_MASUK" : "BUAT_INVOICE_MASUK",
      entityType: "invoice-in",
      entityId: row.id,
      detail: `total Rp${dto.total} — ${supplier.name}${isPaid ? " (Langsung Lunas)" : ""}`,
    });
    return this.sync(row);
  }

  async update(id: number, dto: InvoiceInDto, user: RequestUser) {
    const row = await this.prisma.main.invoiceIn.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Invoice supplier tidak ditemukan");
    const updated = await this.prisma.main.invoiceIn.update({
      where: { id },
      data: {
        ...(dto.number !== undefined ? { number: dto.number } : {}),
        ...(dto.supplierId !== undefined ? { supplierId: dto.supplierId } : {}),
        ...(dto.supplierPoId !== undefined ? { supplierPoId: dto.supplierPoId } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.ppn !== undefined ? { ppn: dto.ppn } : {}),
        ...(dto.total !== undefined ? { total: dto.total } : {}),
        ...(dto.dueDate ? { dueDate: new Date(dto.dueDate) } : {}),
      },
      include: { supplier: true },
    });
    if (dto.fileId) {
      await this.prisma.main.file.update({
        where: { id: dto.fileId },
        data: { refType: "invoiceIn", refId: String(id) },
      }).catch(() => {});
    }

    await this.audit.log({
      actor: user,
      action: "UBAH_INVOICE_MASUK",
      entityType: "invoice-in",
      entityId: id,
      detail: updated.number ?? `invoice #${id}`,
    });
    return this.sync(updated);
  }

  async remove(id: number, user: RequestUser) {
    const row = await this.prisma.main.invoiceIn.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Invoice supplier tidak ditemukan");
    await this.prisma.main.payment.deleteMany({ where: { invoiceInId: id } });
    await this.prisma.main.approval.deleteMany({ where: { kind: "INVOICE_IN", entityId: id } });
    await this.prisma.main.invoiceIn.delete({ where: { id } });

    await this.audit.log({
      actor: user,
      action: "HAPUS_INVOICE_MASUK",
      entityType: "invoice-in",
      entityId: id,
      detail: row.number ?? `invoice #${id}`,
    });
    return { deleted: true, id };
  }

  async addPayment(id: number, dto: PaymentDto, user: RequestUser) {
    const row = await this.prisma.main.invoiceIn.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Invoice supplier tidak ditemukan");
    if (row.status === "BATAL") throw new BadRequestException("Invoice dibatalkan");
    const approval = await this.approvals.getFor("INVOICE_IN", id);
    if (approval && approval.status !== "DISETUJUI") {
      const allowedRoles = ["SUPER_ADMIN", "FINANCE", "BOS", "ADMIN", "PROCUREMENT"];
      if (allowedRoles.includes(user.role)) {
        await this.approvals.decide(approval.id, user, true, "Disetujui otomatis saat pembayaran dicatat").catch(() => {});
      } else {
        throw new BadRequestException("Invoice supplier harus disetujui Finance/Bos sebelum dibayar");
      }
    }
    const paymentsBefore = await this.prisma.main.payment.findMany({ where: { invoiceInId: id } });
    const paidBefore = paymentsBefore.reduce((s, p) => s + Number(p.amount), 0);
    if (paidBefore >= Number(row.total) && Number(row.total) > 0) {
      return this.sync(row);
    }
    if (paidBefore + Number(dto.amount) > Number(row.total)) {
      throw new BadRequestException(
        `Total bayar melebihi tagihan invoice supplier (sisa Rp${Number(row.total) - paidBefore})`,
      );
    }

    const finalReference = dto.coaAccount
      ? (dto.reference?.includes(`[AKUN:`) ? dto.reference : `[AKUN:${dto.coaAccount}] ${dto.reference || ""}`.trim())
      : dto.reference;

    await this.prisma.main.payment.create({
      data: {
        invoiceInId: id,
        amount: dto.amount,
        date: dto.date ? new Date(dto.date) : new Date(),
        method: dto.method ?? "TRANSFER",
        reference: finalReference,
        fileId: dto.fileId,
        createdById: user.id,
      },
    });
    if (dto.fileId) {
      await this.prisma.main.file.update({
        where: { id: dto.fileId },
        data: { refType: "payment", refId: `in-${id}` },
      }).catch(() => {});
    }

    const payments = await this.prisma.main.payment.findMany({ where: { invoiceInId: id } });
    const paid = payments.reduce((s, p) => s + Number(p.amount), 0);
    const updated = await this.prisma.main.invoiceIn.update({
      where: { id },
      data: { paidAmount: paid, ...(dto.fileId ? { transferFileId: dto.fileId } : {}) },
      include: { supplier: true, payments: { orderBy: { date: "desc" } } },
    });

    if (paid >= Number(row.total) && Number(row.total) > 0) {
      await this.syncLinkedRequest(row.supplierPoId, dto.fileId ?? row.transferFileId);
    }

    await this.audit.log({
      actor: user,
      action: "BAYAR_INVOICE_MASUK",
      entityType: "invoice-in",
      entityId: id,
      detail: `Rp${dto.amount} — ${row.supplierId ? `supplier #${row.supplierId}` : ""}`,
    });
    return this.sync(updated);
  }

  async setStatus(id: number, status: string, user: RequestUser) {
    if (!["UNPAID", "BATAL"].includes(status)) {
      throw new BadRequestException(`Status tidak dikenal: ${status}`);
    }
    const row = await this.prisma.main.invoiceIn.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Invoice supplier tidak ditemukan");
    const updated = await this.prisma.main.invoiceIn.update({ where: { id }, data: { status: status as never } });

    await this.audit.log({
      actor: user,
      action: "UBAH_STATUS_INVOICE_MASUK",
      entityType: "invoice-in",
      entityId: id,
      detail: `${row.status} → ${status}`,
    });
    return this.sync(updated);
  }

  suggestNumber() {
    return this.docnum.suggest("invoiceIn");
  }
}
