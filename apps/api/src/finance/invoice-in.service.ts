import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { DocumentNumberService } from "../document-number/document-number.service.js";
import { ApprovalsService } from "../approvals/approvals.service.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip } from "../common/utils/query.js";
import type { InvoiceIn } from "../generated/prisma/client.js";
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
    if (!dto.fileId) throw new BadRequestException("File invoice supplier wajib diunggah (bukti wajib)");

    const number = dto.number?.trim() || null;
    if (number) {
      const dup = await this.prisma.main.invoiceIn.findFirst({ where: { number } });
      if (dup) throw new BadRequestException(`Nomor ${number} sudah dipakai`);
    }

    const row = await this.prisma.main.invoiceIn.create({
      data: {
        number,
        supplierId: dto.supplierId,
        supplierPoId: dto.supplierPoId,
        amount: dto.amount,
        ppn: dto.ppn ?? 0,
        total: dto.total,
        dueDate: new Date(dto.dueDate),
        status: "UNPAID",
      },
      include: { supplier: true },
    });
    await this.prisma.main.file.update({
      where: { id: dto.fileId },
      data: { refType: "invoiceIn", refId: String(row.id) },
    });

    await this.approvals.request({
      kind: "INVOICE_IN",
      entityId: row.id,
      title: `Invoice supplier ${supplier.name}${number ? ` (${number})` : ""}`,
      amount: Number(dto.total),
      requestedBy: user,
      href: `/invoice-in/${row.id}`,
    });
    await this.audit.log({
      actor: user,
      action: "BUAT_INVOICE_MASUK",
      entityType: "invoice-in",
      entityId: row.id,
      detail: `total Rp${dto.total} — ${supplier.name}`,
    });
    return this.sync(row);
  }

  async update(id: number, dto: InvoiceInDto, user: RequestUser) {
    const row = await this.prisma.main.invoiceIn.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Invoice supplier tidak ditemukan");
    const updated = await this.prisma.main.invoiceIn.update({
      where: { id },
      data: {
        ...(dto.number ? { number: dto.number } : {}),
        supplierId: dto.supplierId,
        supplierPoId: dto.supplierPoId ?? row.supplierPoId,
        amount: dto.amount,
        ppn: dto.ppn ?? row.ppn,
        total: dto.total,
        dueDate: new Date(dto.dueDate),
      },
      include: { supplier: true },
    });
    if (dto.fileId) {
      await this.prisma.main.file.update({
        where: { id: dto.fileId },
        data: { refType: "invoiceIn", refId: String(id) },
      });
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

  async addPayment(id: number, dto: PaymentDto, user: RequestUser) {
    const row = await this.prisma.main.invoiceIn.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Invoice supplier tidak ditemukan");
    if (row.status === "BATAL") throw new BadRequestException("Invoice dibatalkan");
    if (!dto.fileId) throw new BadRequestException("Bukti transfer wajib diunggah");

    const approval = await this.approvals.getFor("INVOICE_IN", id);
    if (!approval || approval.status !== "DISETUJUI") {
      throw new BadRequestException("Invoice supplier harus disetujui Finance/Bos sebelum dibayar");
    }

    await this.prisma.main.payment.create({
      data: {
        invoiceInId: id,
        amount: dto.amount,
        date: new Date(dto.date),
        method: dto.method ?? "TRANSFER",
        reference: dto.reference,
        fileId: dto.fileId,
        createdById: user.id,
      },
    });
    await this.prisma.main.file.update({
      where: { id: dto.fileId },
      data: { refType: "payment", refId: `in-${id}` },
    });

    const payments = await this.prisma.main.payment.findMany({ where: { invoiceInId: id } });
    const paid = payments.reduce((s, p) => s + Number(p.amount), 0);
    const updated = await this.prisma.main.invoiceIn.update({
      where: { id },
      data: { paidAmount: paid, transferFileId: dto.fileId },
      include: { supplier: true, payments: { orderBy: { date: "desc" } } },
    });

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
