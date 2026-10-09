import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { DocumentNumberService } from "../document-number/document-number.service.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip } from "../common/utils/query.js";
import type { InvoiceOut } from "../generated/prisma/client.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { InvoiceOutDto, PaymentDto } from "./dto.js";

type StatusFilter = "DRAFT" | "SENT" | "PARTIAL" | "PAID" | "OVERDUE" | "BATAL";

@Injectable()
export class InvoiceOutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly docnum: DocumentNumberService,
  ) {}

  /** Status dihitung dari pembayaran + jatuh tempo (PRD: Unpaid/Partial/Paid/Overdue otomatis). */
  private compute(row: InvoiceOut): StatusFilter {
    if (row.status === "BATAL") return "BATAL";
    if (row.status === "DRAFT") return "DRAFT";
    const total = Number(row.total);
    const paid = Number(row.paidAmount);
    if (paid >= total && total > 0) return "PAID";
    const past = new Date(row.dueDate).getTime() < Date.now();
    if (past) return "OVERDUE";
    if (paid > 0) return "PARTIAL";
    return "SENT";
  }

  private async sync(row: InvoiceOut): Promise<InvoiceOut & { status: StatusFilter; warning?: string }> {
    const status = this.compute(row);
    if (status !== row.status) {
      await this.prisma.main.invoiceOut.update({ where: { id: row.id }, data: { status } });
    }
    return { ...row, status, ...(await this.warningFor(row)) };
  }

  private async warningFor(row: InvoiceOut): Promise<{ warning?: string }> {
    if (!row.clientPoId) return {};
    const po = await this.prisma.main.clientPO.findUnique({ where: { id: row.clientPoId } });
    if (!po) return {};
    const invoices = await this.prisma.main.invoiceOut.findMany({
      where: { clientPoId: row.clientPoId, status: { not: "BATAL" } },
      select: { total: true },
    });
    const sum = invoices.reduce((s, i) => s + Number(i.total), 0);
    if (sum > Number(po.amount)) {
      return { warning: `Total invoice Rp${sum} melebihi nilai PO client Rp${po.amount}` };
    }
    return {};
  }

  private where(
    q: PageQuery & { status?: string; customerId?: number; projectId?: number; clientPoId?: number; from?: string; to?: string },
  ) {
    const today = new Date();
    return {
      ...(q.customerId ? { customerId: q.customerId } : {}),
      ...(q.projectId ? { projectId: q.projectId } : {}),
      ...(q.clientPoId ? { clientPoId: q.clientPoId } : {}),
      ...(q.status === "OVERDUE"
        ? {
            status: { in: ["SENT", "PARTIAL"] as never },
            dueDate: { lt: today },
          }
        : q.status
          ? { status: q.status as never }
          : {}),
      ...(q.from || q.to
        ? { date: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } }
        : {}),
      ...(q.q
        ? {
            OR: [
              { number: { contains: q.q } },
              { description: { contains: q.q } },
              { customer: { name: { contains: q.q } } },
            ],
          }
        : {}),
    };
  }

  async list(
    q: PageQuery & { status?: string; customerId?: number; projectId?: number; clientPoId?: number; from?: string; to?: string },
  ) {
    const where = this.where(q);
    const [rows, total] = await Promise.all([
      this.prisma.main.invoiceOut.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          clientPo: { select: { id: true, number: true, amount: true } },
          project: { select: { id: true, name: true } },
        },
        orderBy: orderBy(q.sort, q.dir, ["date", "dueDate", "createdAt"], "dueDate"),
        ...pageSkip(q),
      }),
      this.prisma.main.invoiceOut.count({ where }),
    ]);
    const items = await Promise.all(rows.map((r) => this.sync(r)));
    return paginate(items, total, q);
  }

  async get(id: number) {
    const row = await this.prisma.main.invoiceOut.findUnique({
      where: { id },
      include: {
        customer: true,
        clientPo: true,
        project: { select: { id: true, name: true } },
        payments: { orderBy: { date: "desc" } },
      },
    });
    if (!row) throw new NotFoundException("Invoice tidak ditemukan");
    return this.sync(row);
  }

  async create(dto: InvoiceOutDto, user: RequestUser) {
    const number = dto.number?.trim() || (await this.docnum.next("invoiceOut"));
    const dup = await this.prisma.main.invoiceOut.findFirst({ where: { number } });
    if (dup) throw new BadRequestException(`Nomor ${number} sudah dipakai`);
    if (!dto.fileId) throw new BadRequestException("File invoice wajib diunggah (bukti wajib)");

    const customer = await this.prisma.main.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer) throw new NotFoundException("Customer tidak ditemukan");

    const row = await this.prisma.main.invoiceOut.create({
      data: {
        number,
        clientPoId: dto.clientPoId,
        projectId: dto.projectId,
        customerId: dto.customerId,
        description: dto.description,
        type: dto.type ?? "TERMIN",
        amount: dto.amount,
        ppn: dto.ppn ?? 0,
        total: dto.total,
        date: new Date(dto.date),
        dueDate: new Date(dto.dueDate),
        status: dto.status ?? "DRAFT",
      },
      include: { customer: true },
    });
    await this.prisma.main.file.update({
      where: { id: dto.fileId },
      data: { refType: "invoiceOut", refId: String(row.id) },
    });
    await this.audit.log({
      actor: user,
      action: "BUAT_INVOICE_KELUAR",
      entityType: "invoice-out",
      entityId: row.id,
      detail: `${number} total Rp${dto.total} — ${customer.name}`,
    });
    return this.sync(row);
  }

  async update(id: number, dto: InvoiceOutDto, user: RequestUser) {
    const row = await this.prisma.main.invoiceOut.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Invoice tidak ditemukan");

    const updated = await this.prisma.main.invoiceOut.update({
      where: { id },
      data: {
        ...(dto.number ? { number: dto.number } : {}),
        clientPoId: dto.clientPoId ?? row.clientPoId,
        projectId: dto.projectId ?? row.projectId,
        customerId: dto.customerId,
        description: dto.description ?? row.description,
        type: dto.type ?? row.type,
        amount: dto.amount,
        ppn: dto.ppn ?? row.ppn,
        total: dto.total,
        date: new Date(dto.date),
        dueDate: new Date(dto.dueDate),
        ...(dto.status ? { status: dto.status } : {}),
      },
      include: { customer: true },
    });
    if (dto.fileId) {
      await this.prisma.main.file.update({
        where: { id: dto.fileId },
        data: { refType: "invoiceOut", refId: String(id) },
      });
    }
    await this.audit.log({
      actor: user,
      action: "UBAH_INVOICE_KELUAR",
      entityType: "invoice-out",
      entityId: id,
      detail: `${updated.number} → ${dto.status ?? updated.status}`,
    });
    return this.sync(updated);
  }

  async addPayment(id: number, dto: PaymentDto, user: RequestUser) {
    const row = await this.prisma.main.invoiceOut.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Invoice tidak ditemukan");
    if (row.status === "BATAL") throw new BadRequestException("Invoice dibatalkan");
    if (!dto.fileId) throw new BadRequestException("Bukti pembayaran wajib diunggah");

    await this.prisma.main.payment.create({
      data: {
        invoiceOutId: id,
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
      data: { refType: "payment", refId: String(id) },
    });

    const payments = await this.prisma.main.payment.findMany({ where: { invoiceOutId: id } });
    const paid = payments.reduce((s, p) => s + Number(p.amount), 0);
    const updated = await this.prisma.main.invoiceOut.update({
      where: { id },
      data: { paidAmount: paid },
      include: { customer: true, payments: { orderBy: { date: "desc" } } },
    });

    await this.audit.log({
      actor: user,
      action: "BAYAR_INVOICE_KELUAR",
      entityType: "invoice-out",
      entityId: id,
      detail: `Rp${dto.amount} (${row.number}) total bayar Rp${paid}`,
    });
    return this.sync(updated);
  }

  async setStatus(id: number, status: string, user: RequestUser) {
    if (!["DRAFT", "SENT", "BATAL"].includes(status)) {
      throw new BadRequestException(`Status tidak dikenal: ${status}`);
    }
    const row = await this.prisma.main.invoiceOut.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Invoice tidak ditemukan");
    if (status === "BATAL" || status === "SENT") {
      const file = await this.prisma.main.file.findFirst({
        where: { refType: "invoiceOut", refId: String(id) },
      });
      if (!file) throw new BadRequestException("File invoice wajib ada sebelum status berubah");
    }
    const updated = await this.prisma.main.invoiceOut.update({ where: { id }, data: { status: status as never } });
    await this.audit.log({
      actor: user,
      action: "UBAH_STATUS_INVOICE",
      entityType: "invoice-out",
      entityId: id,
      detail: `${row.number}: ${row.status} → ${status}`,
    });
    return this.sync(updated);
  }

  suggestNumber() {
    return this.docnum.suggest("invoiceOut");
  }
}
