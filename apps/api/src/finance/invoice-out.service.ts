import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { DocumentNumberService } from "../document-number/document-number.service.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip } from "../common/utils/query.js";
import type { InvoiceOut } from "../generated/prisma/client.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { InvoiceOutDto, PaymentDto } from "./dto.js";

import { UploadService } from "../upload/upload.service.js";

type StatusFilter = "DRAFT" | "SENT" | "PARTIAL" | "PAID" | "OVERDUE" | "BATAL";

@Injectable()
export class InvoiceOutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly docnum: DocumentNumberService,
    private readonly upload: UploadService,
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

  private async syncProjectPayment(projectId: number | null | undefined) {
    if (!projectId) return;
    const invoices = await this.prisma.main.invoiceOut.findMany({
      where: { projectId, status: { not: "BATAL" } },
      select: { total: true, paidAmount: true, status: true },
    });
    const allPaid =
      invoices.length > 0 &&
      invoices.every(
        (i) => (Number(i.paidAmount) >= Number(i.total) && Number(i.total) > 0) || i.status === "PAID",
      );
    await this.prisma.main.project
      .update({
        where: { id: projectId },
        data: { paymentStatus: allPaid ? "LUNAS" : "BELUM_LUNAS" },
      })
      .catch(() => {});
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
    user?: RequestUser,
  ) {
    let salesScope: any = {};
    if (user && user.role === "SALES") {
      const [auditLogs, salesLeads] = await Promise.all([
        this.prisma.main.auditLog.findMany({
          where: { actorId: user.id, entityType: "invoice-out", action: "BUAT_INVOICE_KELUAR" },
          select: { entityId: true },
        }),
        this.prisma.main.lead.findMany({
          where: { owner_id: user.id },
          select: { id: true, customerId: true },
        }),
      ]);

      const createdIds = auditLogs.map((a) => Number(a.entityId)).filter((n) => !isNaN(n));
      const customerIds = salesLeads.map((l) => l.customerId).filter(Boolean) as number[];

      salesScope = {
        OR: [
          ...(createdIds.length > 0 ? [{ id: { in: createdIds } }] : []),
          { description: { contains: `[by:${user.id}]` } },
          ...(customerIds.length > 0 ? [{ customerId: { in: customerIds } }] : []),
          {
            project: {
              OR: [
                { picId: user.id },
                { members: { some: { userId: user.id } } },
                { quotation: { lead: { owner_id: user.id } } },
                ...(customerIds.length > 0 ? [{ customerId: { in: customerIds } }] : []),
              ],
            },
          },
        ],
      };
    }

    const where = {
      ...this.where(q),
      ...salesScope,
    };
    const [rows, total] = await Promise.all([
      this.prisma.main.invoiceOut.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          clientPo: {
            select: {
              id: true,
              number: true,
              amount: true,
              quotationId: true,
              quotation: { select: { id: true, number: true } },
            },
          },
          project: {
            select: {
              id: true,
              name: true,
              quotationId: true,
              quotation: { select: { id: true, number: true } },
            },
          },
          payments: { orderBy: { date: "desc" } },
        },
        orderBy: orderBy(q.sort, q.dir, ["date", "dueDate", "createdAt"], "dueDate"),
        ...pageSkip(q),
      }),
      this.prisma.main.invoiceOut.count({ where }),
    ]);

    const invoiceIds = rows.map((r) => r.id);
    const metaSettings = await this.prisma.main.systemSetting.findMany({
      where: {
        key: { in: invoiceIds.map((id) => this.metaKey(id)) },
      },
    });
    const metaMap = new Map<number, any>();
    for (const s of metaSettings) {
      try {
        const id = Number(s.key.replace("invoice:meta:", ""));
        metaMap.set(id, JSON.parse(s.value));
      } catch {}
    }

    const items = await Promise.all(
      rows.map(async (r) => {
        const synced = await this.sync(r);
        const meta = metaMap.get(r.id) || {};
        const qId = meta.quotationId ?? r.clientPo?.quotationId ?? r.project?.quotationId ?? undefined;
        let qNum = meta.quotation ?? r.clientPo?.quotation?.number ?? r.project?.quotation?.number ?? undefined;
        if (!qNum && r.description) {
          const m = r.description.match(/(?:QUO|PNW)[-\w\/]+/i);
          if (m) qNum = m[0];
        }
        return {
          ...synced,
          quotationId: qId,
          quotation: qNum,
          discount: meta.discount,
        };
      }),
    );
    return paginate(items, total, q);
  }

  private metaKey(id: number) {
    return `invoice:meta:${id}`;
  }

  async getMeta(id: number): Promise<any> {
    try {
      const setting = await this.prisma.main.systemSetting.findUnique({
        where: { key: this.metaKey(id) },
      });
      if (setting?.value) {
        return JSON.parse(setting.value);
      }
    } catch {}
    return null;
  }

  async saveMeta(id: number, patch: any): Promise<any> {
    const existing = (await this.getMeta(id)) || {};
    const merged = { ...existing, ...patch };
    const key = this.metaKey(id);
    await this.prisma.main.systemSetting.upsert({
      where: { key },
      update: { value: JSON.stringify(merged) },
      create: { key, value: JSON.stringify(merged) },
    }).catch(() => {});
    return merged;
  }

  async get(id: number) {
    const row = await this.prisma.main.invoiceOut.findUnique({
      where: { id },
      include: {
        customer: true,
        clientPo: {
          include: {
            quotation: true,
          },
        },
        project: {
          include: {
            quotation: true,
          },
        },
        payments: { orderBy: { date: "desc" } },
      },
    });
    if (!row) throw new NotFoundException("Invoice tidak ditemukan");

    const meta = (await this.getMeta(id)) || {};
    let relatedQuote = row.clientPo?.quotation || row.project?.quotation;
    if (!relatedQuote && (meta.quotationId || row.description)) {
      try {
        const qId = meta.quotationId ? Number(meta.quotationId) : null;
        if (qId) {
          relatedQuote = await this.prisma.main.quotation.findUnique({ where: { id: qId } });
        } else {
          const match = (row.description || "").match(/(?:QUO|PNW)[-\w\/]+/i);
          if (match) {
            relatedQuote = await this.prisma.main.quotation.findFirst({
              where: { number: { contains: match[0] } },
            });
          }
        }
      } catch {}
    }

    let quoteMeta: any = null;
    if (relatedQuote) {
      try {
        const qSetting = await this.prisma.main.systemSetting.findFirst({
          where: { key: { in: [`quotation:meta:${relatedQuote.id}`, `quotation.meta.${relatedQuote.id}`] } },
        });
        if (qSetting?.value) quoteMeta = JSON.parse(qSetting.value);
      } catch {}
    }

    const file = row.fileId
      ? await this.prisma.main.file.findUnique({
          where: { id: row.fileId },
          select: { id: true, originalName: true, size: true, mimeType: true },
        })
      : null;

    const synced = await this.sync(row);
    return {
      ...synced,
      items: meta.items ?? quoteMeta?.items ?? [],
      discount: Number(meta.discount ?? quoteMeta?.discount ?? quoteMeta?.disc ?? relatedQuote?.discount ?? 0),
      quotationId: meta.quotationId ?? relatedQuote?.id ?? undefined,
      quotation: meta.quotation ?? relatedQuote?.number ?? (row.description ? row.description.match(/(?:QUO|PNW)[-\w\/]+/i)?.[0] : undefined),
      subject: meta.subject ?? quoteMeta?.subject ?? "INVOICE PENAGIHAN",
      intro: meta.intro ?? quoteMeta?.intro ?? "Bersama surat ini kami sampaikan invoice penagihan untuk pekerjaan berikut :",
      notesList: meta.notesList ?? meta.notes ?? [
        "Pembayaran dapat di Transfer ke:",
        "Bank : Bank Mandiri",
        "No. Rek : 1670011359410",
        "Nama : Ghina Multi Prima",
        "Alamat : Jl. Bintara Jaya VIII RT.008/RW.009",
        "Bekasi Barat Bintara Jaya Bekasi",
      ],
      dpLabel: meta.dpLabel ?? undefined,
      dpAmount: meta.dpAmount ?? undefined,
      city: meta.city ?? quoteMeta?.city ?? "Bekasi",
      kopText: meta.kopText ?? quoteMeta?.kopText ?? "",
      kopLogoUrl: meta.kopLogoUrl ?? quoteMeta?.kopLogoUrl ?? "",
      customerAddress: meta.customerAddress ?? quoteMeta?.customerAddress ?? row.customer?.address ?? "Di Tempat",
      signerName: meta.signerName ?? "Finance",
      signerTitle: meta.signerTitle ?? "Finance & Accounting",
      fileName: file?.originalName ?? `Invoice-${row.number.replace(/\//g, "-")}.xlsx`,
      fileUploaded: !!row.fileId,
    };
  }

  private assertFinanceOrAdmin(user: RequestUser, message = "Hanya tim Finance yang dapat melakukan tindakan ini") {
    if ((user.role || "").toLowerCase() === "sales") {
      throw new ForbiddenException(message);
    }
  }

  async create(dto: InvoiceOutDto, user: RequestUser) {
    const number = dto.number?.trim() || (await this.docnum.next("invoiceOut"));
    const dup = await this.prisma.main.invoiceOut.findFirst({ where: { number } });
    if (dup) throw new BadRequestException(`Nomor ${number} sudah dipakai`);

    const customer = dto.customerId
      ? await this.prisma.main.customer.findUnique({ where: { id: dto.customerId } })
      : await this.prisma.main.customer.findFirst();
    if (!customer) throw new NotFoundException("Customer tidak ditemukan");

    const amount = dto.amount ?? 0;
    const ppn = dto.ppn ?? 0;
    const total = dto.total ?? amount + ppn;
    const date = dto.date ? new Date(dto.date) : new Date();
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : new Date(Date.now() + 30 * 86400000);

    const desc = dto.description?.trim();
    const creatorTag = `[by:${user.id}]`;
    const description = desc ? (desc.includes(creatorTag) ? desc : `${desc} ${creatorTag}`) : creatorTag;

    const row = await this.prisma.main.invoiceOut.create({
      data: {
        number,
        clientPoId: dto.clientPoId,
        projectId: dto.projectId,
        customerId: customer.id,
        description,
        type: dto.type ?? "TERMIN",
        amount,
        ppn,
        total,
        paidAmount: dto.paidAmount ?? (dto.status === "PAID" ? total : 0),
        date,
        dueDate,
        status: dto.status ?? "DRAFT",
        fileId: dto.fileId,
      },
      include: { customer: true, clientPo: { select: { id: true, number: true, amount: true } } },
    });
    if (dto.fileId) {
      await this.prisma.main.file.update({
        where: { id: dto.fileId },
        data: { refType: "invoiceOut", refId: String(row.id) },
      }).catch(() => {});
    }

    if (
      dto.items !== undefined ||
      dto.discount !== undefined ||
      dto.quotationId !== undefined ||
      dto.quotation !== undefined ||
      dto.subject !== undefined ||
      dto.intro !== undefined ||
      dto.notesList !== undefined ||
      dto.city !== undefined ||
      dto.kopText !== undefined ||
      dto.kopLogoUrl !== undefined ||
      dto.customerAddress !== undefined ||
      dto.signerName !== undefined ||
      dto.signerTitle !== undefined ||
      dto.dpLabel !== undefined ||
      dto.dpAmount !== undefined
    ) {
      await this.saveMeta(row.id, {
        ...(dto.items !== undefined ? { items: dto.items } : {}),
        ...(dto.discount !== undefined ? { discount: dto.discount } : {}),
        ...(dto.quotationId !== undefined ? { quotationId: dto.quotationId } : {}),
        ...(dto.quotation !== undefined ? { quotation: dto.quotation } : {}),
        ...(dto.subject !== undefined ? { subject: dto.subject } : {}),
        ...(dto.intro !== undefined ? { intro: dto.intro } : {}),
        ...(dto.notesList !== undefined ? { notesList: dto.notesList } : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.kopText !== undefined ? { kopText: dto.kopText } : {}),
        ...(dto.kopLogoUrl !== undefined ? { kopLogoUrl: dto.kopLogoUrl } : {}),
        ...(dto.customerAddress !== undefined ? { customerAddress: dto.customerAddress } : {}),
        ...(dto.signerName !== undefined ? { signerName: dto.signerName } : {}),
        ...(dto.signerTitle !== undefined ? { signerTitle: dto.signerTitle } : {}),
        ...(dto.dpLabel !== undefined ? { dpLabel: dto.dpLabel } : {}),
        ...(dto.dpAmount !== undefined ? { dpAmount: dto.dpAmount } : {}),
      });
    }

    await this.audit.log({
      actor: user,
      action: "BUAT_INVOICE_KELUAR",
      entityType: "invoice-out",
      entityId: row.id,
      detail: `${number} total Rp${total} — ${customer.name}`,
    });
    await this.syncProjectPayment(row.projectId);
    const synced = await this.sync(row);
    const qNum = dto.quotation || (desc ? desc.match(/(?:QUO|PNW)[-\w\/]+/i)?.[0] : undefined);
    return {
      ...synced,
      quotationId: dto.quotationId,
      quotation: qNum,
      discount: dto.discount,
      items: dto.items,
    };
  }

  async update(id: number, dto: InvoiceOutDto, user: RequestUser) {
    const row = await this.prisma.main.invoiceOut.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Invoice tidak ditemukan");

    const amount = dto.amount ?? Number(row.amount);
    const ppn = dto.ppn ?? Number(row.ppn);
    const total = dto.total ?? (dto.amount !== undefined || dto.ppn !== undefined ? amount + ppn : Number(row.total));

    const updated = await this.prisma.main.invoiceOut.update({
      where: { id },
      data: {
        ...(dto.number ? { number: dto.number } : {}),
        clientPoId: dto.clientPoId !== undefined ? dto.clientPoId : row.clientPoId,
        projectId: dto.projectId !== undefined ? dto.projectId : row.projectId,
        customerId: dto.customerId ?? row.customerId,
        description: dto.description !== undefined ? dto.description : row.description,
        type: dto.type ?? row.type,
        amount,
        ppn,
        total,
        ...(dto.paidAmount !== undefined ? { paidAmount: dto.paidAmount } : dto.status === "PAID" ? { paidAmount: total } : {}),
        date: dto.date ? new Date(dto.date) : row.date,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : row.dueDate,
        ...(dto.status ? { status: dto.status } : {}),
        fileId: dto.fileId !== undefined ? dto.fileId : row.fileId,
      },
      include: { customer: true, clientPo: { select: { id: true, number: true, amount: true } } },
    });
    if (dto.fileId) {
      await this.prisma.main.file.update({
        where: { id: dto.fileId },
        data: { refType: "invoiceOut", refId: String(id) },
      }).catch(() => {});
    }

    if (
      dto.items !== undefined ||
      dto.discount !== undefined ||
      dto.quotationId !== undefined ||
      dto.subject !== undefined ||
      dto.intro !== undefined ||
      dto.notesList !== undefined ||
      dto.city !== undefined ||
      dto.kopText !== undefined ||
      dto.kopLogoUrl !== undefined ||
      dto.customerAddress !== undefined ||
      dto.signerName !== undefined ||
      dto.signerTitle !== undefined ||
      dto.dpLabel !== undefined ||
      dto.dpAmount !== undefined
    ) {
      await this.saveMeta(id, {
        ...(dto.items !== undefined ? { items: dto.items } : {}),
        ...(dto.discount !== undefined ? { discount: dto.discount } : {}),
        ...(dto.quotationId !== undefined ? { quotationId: dto.quotationId } : {}),
        ...(dto.subject !== undefined ? { subject: dto.subject } : {}),
        ...(dto.intro !== undefined ? { intro: dto.intro } : {}),
        ...(dto.notesList !== undefined ? { notesList: dto.notesList } : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.kopText !== undefined ? { kopText: dto.kopText } : {}),
        ...(dto.kopLogoUrl !== undefined ? { kopLogoUrl: dto.kopLogoUrl } : {}),
        ...(dto.customerAddress !== undefined ? { customerAddress: dto.customerAddress } : {}),
        ...(dto.signerName !== undefined ? { signerName: dto.signerName } : {}),
        ...(dto.signerTitle !== undefined ? { signerTitle: dto.signerTitle } : {}),
        ...(dto.dpLabel !== undefined ? { dpLabel: dto.dpLabel } : {}),
        ...(dto.dpAmount !== undefined ? { dpAmount: dto.dpAmount } : {}),
      });
    }

    await this.audit.log({
      actor: user,
      action: "UBAH_INVOICE_KELUAR",
      entityType: "invoice-out",
      entityId: id,
      detail: `${updated.number} → ${dto.status ?? updated.status}`,
    });
    await this.syncProjectPayment(updated.projectId);
    if (row.projectId && row.projectId !== updated.projectId) {
      await this.syncProjectPayment(row.projectId);
    }
    return this.get(id);
  }

  async addPayment(id: number, dto: PaymentDto, user: RequestUser) {
    this.assertFinanceOrAdmin(user, "Hanya tim Finance yang dapat mencatat pembayaran invoice");
    const row = await this.prisma.main.invoiceOut.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Invoice tidak ditemukan");
    if (row.status === "BATAL") throw new BadRequestException("Invoice dibatalkan");
    const paymentsBefore = await this.prisma.main.payment.findMany({ where: { invoiceOutId: id } });
    const paidBefore = paymentsBefore.reduce((s, p) => s + Number(p.amount), 0);
    if (paidBefore + Number(dto.amount) > Number(row.total) && Number(row.total) > 0) {
      throw new BadRequestException(
        `Total bayar melebihi tagihan invoice (sisa Rp${Number(row.total) - paidBefore})`,
      );
    }

    await this.prisma.main.payment.create({
      data: {
        invoiceOutId: id,
        amount: dto.amount,
        date: dto.date ? new Date(dto.date) : new Date(),
        method: dto.method ?? "TRANSFER",
        reference: dto.reference,
        fileId: dto.fileId,
        createdById: user.id,
      },
    });
    if (dto.fileId) {
      await this.prisma.main.file.update({
        where: { id: dto.fileId },
        data: { refType: "payment", refId: String(id) },
      }).catch(() => {});
    }

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
    await this.syncProjectPayment(row.projectId);
    return this.sync(updated);
  }

  async setStatus(id: number, status: string, user: RequestUser) {
    if ((user.role || "").toLowerCase() === "sales" && ["PAID", "BATAL"].includes(status)) {
      throw new ForbiddenException("Hanya tim Finance yang dapat menandai invoice Lunas atau Batal");
    }
    if (!["DRAFT", "SENT", "PARTIAL", "PAID", "OVERDUE", "BATAL"].includes(status)) {
      throw new BadRequestException(`Status tidak dikenal: ${status}`);
    }
    const row = await this.prisma.main.invoiceOut.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Invoice tidak ditemukan");
    const updated = await this.prisma.main.invoiceOut.update({
      where: { id },
      data: {
        status: status as never,
        ...(status === "PAID" ? { paidAmount: row.total } : {}),
        ...(status === "SENT" && Number(row.paidAmount) >= Number(row.total) ? { paidAmount: 0 } : {}),
      },
      include: { customer: true, clientPo: { select: { id: true, number: true, amount: true } } },
    });
    await this.audit.log({
      actor: user,
      action: "UBAH_STATUS_INVOICE",
      entityType: "invoice-out",
      entityId: id,
      detail: `${row.number}: ${row.status} → ${status}`,
    });
    await this.syncProjectPayment(row.projectId);
    return this.sync(updated);
  }

  async remove(id: number, user: RequestUser) {
    this.assertFinanceOrAdmin(user, "Hanya tim Finance yang dapat menghapus invoice");
    const row = await this.prisma.main.invoiceOut.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Invoice tidak ditemukan");
    await this.prisma.main.$transaction(async (tx) => {
      await tx.payment.deleteMany({ where: { invoiceOutId: id } });
      await tx.invoiceOut.delete({ where: { id } });
    });
    await this.audit.log({
      actor: user,
      action: "HAPUS_INVOICE_KELUAR",
      entityType: "invoice-out",
      entityId: id,
      detail: `${row.number} dihapus`,
    });
    await this.syncProjectPayment(row.projectId);
    return { id, deleted: true };
  }

  suggestNumber() {
    return this.docnum.suggest("invoiceOut");
  }

  /**
   * Ekspor Faktur Pajak Keluaran ke format CSV baku aplikasi e-Faktur Direktorat Jenderal Pajak (DJP).
   * Format sesuai petunjuk teknis DJP:
   * Record FK (Faktur Keluaran) & Record OF (Objek Faktur)
   */
  async exportEfakturCsv(query: {
    from?: string;
    to?: string;
    month?: number;
    year?: number;
    customerId?: number;
    invoiceId?: number;
    nsfpStart?: string;
  }): Promise<{ csv: string; filename: string }> {
    const where: any = {
      status: { not: "BATAL" },
      ...(query.invoiceId ? { id: Number(query.invoiceId) } : {}),
      ...(query.customerId ? { customerId: Number(query.customerId) } : {}),
      ...(query.from || query.to
        ? {
            date: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const invoices = await this.prisma.main.invoiceOut.findMany({
      where,
      include: {
        customer: true,
      },
      orderBy: { date: "asc" },
    });

    const header = [
      "FK,KD_JENIS_TRANSAKSI,FG_PENGGANTI,NOMOR_FAKTUR,MASA_PAJAK,TAHUN_PAJAK,TANGGAL_FAKTUR,NPWP,NAMA,ALAMAT_LENGKAP,JUMLAH_DPP,JUMLAH_PPN,JUMLAH_PPNBM,ID_KETERANGAN_TAMBAHAN,FG_UANG_MUKA,UANG_MUKA_DPP,UANG_MUKA_PPN,UANG_MUKA_PPNBM,REFERENSI,KODE_DOKUMEN_PENDUKUNG",
      "LT_NPWP,NAMA,ALAMAT_LENGKAP,NOMOR_TELEPON",
      "OF,KODE_OBJEK,NAMA,HARGA_SATUAN,JUMLAH_BARANG,HARGA_TOTAL,DISKON,DPP,PPN,TARIF_PPNBM,PPNBM",
    ];

    const lines: string[] = [header[0], header[2]];

    let currentNsfpNum = 1;
    let nsfpPrefix = "";
    if (query.nsfpStart) {
      const match = query.nsfpStart.match(/^(.*?)(\d{8})$/);
      if (match) {
        nsfpPrefix = match[1];
        currentNsfpNum = parseInt(match[2], 10);
      }
    }

    for (let i = 0; i < invoices.length; i++) {
      const inv = invoices[i];
      const d = new Date(inv.date);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = String(d.getFullYear());
      const tanggalFaktur = `${day}/${month}/${year}`;
      const masaPajak = String(d.getMonth() + 1);

      let noFaktur = "";
      if (nsfpPrefix) {
        noFaktur = `${nsfpPrefix}${String(currentNsfpNum++).padStart(8, "0")}`;
      } else {
        noFaktur = `010000${year.slice(-2)}${String(i + 1).padStart(8, "0")}`;
      }

      let npwp = "0000000000000000";
      const notes = inv.customer?.notes || "";
      const npwpMatch = notes.match(/npwp\s*[:=]?\s*([0-9.\-]+)/i);
      if (npwpMatch) {
        const cleaned = npwpMatch[1].replace(/\D/g, "");
        if (cleaned.length >= 15) {
          npwp = cleaned.slice(0, 16);
        }
      }

      const nama = (inv.customer?.name || "Customer").replace(/"/g, '""');
      const alamat = (inv.customer?.address || inv.customer?.city || "Indonesia").replace(/"/g, '""');
      const dpp = Math.round(Number(inv.amount));
      const ppn = Math.round(Number(inv.ppn) || dpp * 0.11);
      const isDp = inv.type === "DP";
      const referensi = inv.number.replace(/"/g, '""');

      // FK row
      lines.push(
        `"FK","01","0","${noFaktur}","${masaPajak}","${year}","${tanggalFaktur}","${npwp}","${nama}","${alamat}",${dpp},${ppn},0,"",${isDp ? 1 : 0},0,0,0,"${referensi}",""`,
      );

      // OF row
      const itemDesc = (inv.description || "Pengadaan Barang & Jasa").replace(/"/g, '""');
      lines.push(
        `"OF","000000","${itemDesc}",${dpp},1,${dpp},0,${dpp},${ppn},0,0`,
      );
    }

    const periodStr =
      query.year && query.month
        ? `${query.year}-${String(query.month).padStart(2, "0")}`
        : new Date().toISOString().slice(0, 10);
    const filename = `efaktur-pajak-keluaran-${periodStr}.csv`;
    return { csv: lines.join("\r\n"), filename };
  }

  async extractFile(buffer: Buffer, originalName?: string, user?: RequestUser) {
    const filename = originalName || "invoice.xlsx";
    let parsed: any = null;
    if (filename.toLowerCase().endsWith(".xlsx")) {
      const { parseQuotationXlsx } = await import("../crm/quotation-excel.js");
      parsed = await parseQuotationXlsx(buffer).catch(() => null);
    }
    let savedFileId: number | null = null;
    if (user) {
      const saved = await this.upload.saveNamed(buffer, "dokumen", filename, user, "invoiceExtract");
      savedFileId = saved?.id ?? null;
    }
    return {
      fileId: savedFileId,
      filename,
      items: parsed?.items ?? [],
      amount: parsed?.total ?? 0,
      ppn: parsed?.ppn ?? (parsed?.total ? Math.round(parsed.total * 0.11) : 0),
      discount: parsed?.discount ?? 0,
      total: parsed?.grandTotal ?? 0,
      subject: parsed?.subject ? parsed.subject.replace(/penawaran/gi, "Invoice") : "Invoice",
      notes: parsed?.notes?.join("\n") ?? "",
      customerName: parsed?.customerName,
    };
  }

  async uploadExcel(id: number, buffer: Buffer, originalName?: string, user?: RequestUser) {
    const row = await this.prisma.main.invoiceOut.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Invoice tidak ditemukan");
    const filename = originalName || `Invoice-${row.number.replace(/\//g, "-")}.xlsx`;
    const saved = await this.upload.saveNamed(buffer, "dokumen", filename, user!, "invoiceOut", String(id));

    let parsed: any = null;
    if (filename.toLowerCase().endsWith(".xlsx")) {
      const { parseQuotationXlsx } = await import("../crm/quotation-excel.js");
      parsed = await parseQuotationXlsx(buffer).catch(() => null);
    }

    const patchData: any = { fileId: saved.id };
    if (parsed && parsed.total > 0) {
      patchData.amount = parsed.total;
      patchData.ppn = parsed.ppn ?? Math.round(parsed.total * 0.11);
      patchData.total = parsed.grandTotal || (patchData.amount + patchData.ppn);
    }

    if (parsed) {
      await this.saveMeta(id, {
        items: parsed.items,
        notesList: parsed.notes,
        subject: parsed.subject ? parsed.subject.replace(/penawaran/gi, "Invoice") : undefined,
        customerAddress: parsed.customerAddress,
        city: parsed.city,
      });
    }

    await this.prisma.main.invoiceOut.update({
      where: { id },
      data: patchData,
    });
    return this.get(id);
  }

  private async resolveInvoiceExportContext(id: number) {
    const row = await this.prisma.main.invoiceOut.findUnique({
      where: { id },
      include: {
        customer: true,
        clientPo: { include: { quotation: true } },
        project: { include: { quotation: true } },
      },
    });
    if (!row) throw new NotFoundException("Invoice tidak ditemukan");

    const meta = (await this.getMeta(id)) || {};
    let relatedQuote = row.clientPo?.quotation || row.project?.quotation;
    if (!relatedQuote && (meta.quotationId || row.description)) {
      try {
        const qId = meta.quotationId ? Number(meta.quotationId) : null;
        if (qId) {
          relatedQuote = await this.prisma.main.quotation.findUnique({ where: { id: qId } });
        } else {
          const match = (row.description || "").match(/(?:QUO|PNW)[-\w\/]+/i);
          if (match) {
            relatedQuote = await this.prisma.main.quotation.findFirst({
              where: { number: { contains: match[0] } },
            });
          }
        }
      } catch {}
    }

    let quoteMeta: any = null;
    if (relatedQuote) {
      try {
        const qSetting = await this.prisma.main.systemSetting.findFirst({
          where: { key: { in: [`quotation:meta:${relatedQuote.id}`, `quotation.meta.${relatedQuote.id}`] } },
        });
        if (qSetting?.value) quoteMeta = JSON.parse(qSetting.value);
      } catch {}
    }

    const items = meta.items ?? quoteMeta?.items ?? [
      {
        id: "1",
        item: row.description?.replace(/\[by:\d+\]/g, "").trim() || "Pengadaan Barang & Jasa",
        qty: 1,
        satuan: "Lot",
        harga: Number(row.amount),
      },
    ];

    const discount = Number(meta.discount ?? quoteMeta?.discount ?? quoteMeta?.disc ?? relatedQuote?.discount ?? 0);
    const itemsGrossTotal = items.reduce((acc: number, it: any) => acc + (Number(it.qty) || 0) * (Number(it.harga) || 0), 0);
    const isDp = row.type === "DP" || /dp/i.test(String(row.description || ""));
    const isTermin = row.type === "TERMIN" || /termin/i.test(String(row.description || ""));
    const parsedPctMatch = String(row.description || "").match(/\((\d+)%\)/);
    const parsedPct = parsedPctMatch ? Number(parsedPctMatch[1]) : undefined;
    const quoteTot = Number(relatedQuote?.total || (itemsGrossTotal > 0 ? itemsGrossTotal : row.amount)) || 1;
    const dpPct = parsedPct || Math.round((Number(row.amount) / quoteTot) * 100) || 50;

    const dpLabel = meta.dpLabel ?? (isDp ? `DP (${dpPct}%)` : isTermin ? `Termin (${dpPct}%)` : undefined);
    const dpAmount = meta.dpAmount ?? (isDp || isTermin ? Number(row.total) : undefined);
    const notes = meta.notesList ?? meta.notes ?? [
      "Pembayaran dapat di Transfer ke:",
      "Bank : Bank Mandiri",
      "No. Rek : 1670011359410",
      "Nama : Ghina Multi Prima",
      "Alamat : Jl. Bintara Jaya VIII RT.008/RW.009",
      "Bekasi Barat Bintara Jaya Bekasi",
    ];

    return { row, meta, quoteMeta, items, discount, itemsGrossTotal, dpLabel, dpAmount, notes };
  }

  async exportExcel(id: number): Promise<{ buffer: Buffer; filename: string }> {
    const ctx = await this.resolveInvoiceExportContext(id);
    const { buildQuotationXlsx } = await import("../crm/quotation-excel.js");
    const buffer = await buildQuotationXlsx({
      quoteNo: ctx.row.number,
      date: ctx.row.date,
      city: ctx.meta.city || ctx.quoteMeta?.city || "Bekasi",
      customerName: ctx.row.customer?.name || "-",
      customerAddress: ctx.meta.customerAddress || ctx.quoteMeta?.customerAddress || ctx.row.customer?.address || "Di Tempat",
      leadName: ctx.row.project?.name || ctx.row.clientPo?.number || "Pekerjaan",
      kopText: ctx.meta.kopText || ctx.quoteMeta?.kopText,
      subject: ctx.meta.subject || "INVOICE PENAGIHAN",
      intro: ctx.meta.intro || "Bersama surat ini kami sampaikan invoice penagihan untuk pekerjaan berikut :",
      items: ctx.items,
      total: ctx.itemsGrossTotal > 0 ? ctx.itemsGrossTotal : Number(ctx.row.amount),
      discount: ctx.discount,
      ppn: Number(ctx.row.ppn),
      grandTotal: Number(ctx.row.total),
      dpLabel: ctx.dpLabel,
      dpAmount: ctx.dpAmount,
      notes: ctx.notes,
      signerName: ctx.meta.signerName || "Finance",
      signerTitle: ctx.meta.signerTitle || "Finance & Accounting",
    });

    const filename = `Invoice-${ctx.row.number.replace(/\//g, "-")}.xlsx`;
    return { buffer, filename };
  }

  async exportPdf(id: number): Promise<{ buffer: Buffer; filename: string }> {
    const ctx = await this.resolveInvoiceExportContext(id);
    const { buildQuotationPdf } = await import("../crm/quotation-excel.js");
    const buffer = await buildQuotationPdf({
      quoteNo: ctx.row.number,
      date: ctx.row.date,
      city: ctx.meta.city || ctx.quoteMeta?.city || "Bekasi",
      customerName: ctx.row.customer?.name || "-",
      customerAddress: ctx.meta.customerAddress || ctx.quoteMeta?.customerAddress || ctx.row.customer?.address || "Di Tempat",
      leadName: ctx.row.project?.name || ctx.row.clientPo?.number || "Pekerjaan",
      kopText: ctx.meta.kopText || ctx.quoteMeta?.kopText,
      kopLogoUrl: ctx.meta.kopLogoUrl || ctx.quoteMeta?.kopLogoUrl,
      subject: ctx.meta.subject || "INVOICE PENAGIHAN",
      intro: ctx.meta.intro || "Bersama surat ini kami sampaikan invoice penagihan untuk pekerjaan berikut :",
      items: ctx.items,
      total: ctx.itemsGrossTotal > 0 ? ctx.itemsGrossTotal : Number(ctx.row.amount),
      discount: ctx.discount,
      ppn: Number(ctx.row.ppn),
      grandTotal: Number(ctx.row.total),
      dpLabel: ctx.dpLabel,
      dpAmount: ctx.dpAmount,
      notes: ctx.notes,
      signerName: ctx.meta.signerName || "Finance",
      signerTitle: ctx.meta.signerTitle || "Finance & Accounting",
    });

    const filename = `Invoice-${ctx.row.number.replace(/\//g, "-")}.pdf`;
    return { buffer, filename };
  }
}
