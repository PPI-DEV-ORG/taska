import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { DocumentNumberService } from "../document-number/document-number.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { ApprovalsService } from "../approvals/approvals.service.js";
import { ReservationsService } from "../stock/reservations.service.js";
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
    private readonly reservations: ReservationsService,
    private readonly notifications: NotificationsService,
    private readonly approvals: ApprovalsService,
  ) {}

  /** Status dihitung dari pembayaran + jatuh tempo (PRD: Unpaid/Partial/Paid/Overdue otomatis). */
  private compute(row: InvoiceOut): StatusFilter {
    if (row.status === "BATAL") return "BATAL";
    if (row.status === "DRAFT") return "DRAFT";
    const total = Number(row.total);
    const paid = Number(row.paidAmount);
    if (row.status === "PAID" || (paid >= total && total > 0)) return "PAID";
    if (paid > 0) return "PARTIAL";
    const past = new Date(row.dueDate).getTime() < Date.now();
    if (past) return "OVERDUE";
    return "SENT";
  }

  private async sync(row: InvoiceOut): Promise<InvoiceOut & { status: StatusFilter; warning?: string }> {
    let status = this.compute(row);
    if (status !== "PAID" && (row.type === "DP" || row.type === "TERMIN")) {
      const match = row.number.match(/^(INV\/\d{4}\/\d{2}\/\d+)(?:\/(\d+))?$/i);
      const basePrefix = match ? match[1] : null;
      const termNum = match?.[2] ? Number(match[2]) : 1;
      if (basePrefix || row.projectId) {
        const paidSubsequent = await this.prisma.main.invoiceOut.findFirst({
          where: {
            id: { not: row.id },
            status: "PAID",
            OR: [
              ...(basePrefix ? [{ number: { startsWith: basePrefix } }] : []),
              ...(row.projectId ? [{ projectId: row.projectId }] : []),
            ],
            type: { in: ["PELUNASAN", "TERMIN"] },
          },
        });
        if (paidSubsequent) {
          const subMatch = paidSubsequent.number.match(/\/(\d+)$/);
          const subTermNum = subMatch ? Number(subMatch[1]) : 1;
          if (paidSubsequent.type === "PELUNASAN" || subTermNum > termNum || /pelunasan/i.test(paidSubsequent.description || "")) {
            status = "PAID";
            if (Number(row.paidAmount) < Number(row.total)) {
              await this.prisma.main.invoiceOut.update({
                where: { id: row.id },
                data: { status: "PAID", paidAmount: row.total },
              });
              return { ...row, status: "PAID", paidAmount: row.total, ...(await this.warningFor(row)) };
            }
          }
        }
      }
    }
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
              { clientPo: { number: { contains: q.q } } },
              { clientPo: { quotation: { number: { contains: q.q } } } },
              { clientPo: { quotation: { lead: { name: { contains: q.q } } } } },
              { project: { name: { contains: q.q } } },
              { project: { quotation: { number: { contains: q.q } } } },
              { project: { quotation: { lead: { name: { contains: q.q } } } } },
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
          ...(salesLeads.length > 0 ? salesLeads.map((l) => ({ description: { contains: `[lead:${l.id}]` } })) : []),
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
              quotation: {
                select: {
                  id: true,
                  number: true,
                  lead: { select: { id: true, name: true } },
                },
              },
            },
          },
          project: {
            select: {
              id: true,
              name: true,
              quotationId: true,
              quotation: {
                select: {
                  id: true,
                  number: true,
                  lead: { select: { id: true, name: true } },
                },
              },
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
          items: Array.isArray(meta.items) ? meta.items : undefined,
          stockConflictFlag: Boolean(meta.stockConflictFlag),
          stockConflictMessage: meta.stockConflictMessage ?? null,
          autoSwapLogs: Array.isArray(meta.autoSwapLogs) ? meta.autoSwapLogs : [],
          emergencyPrId: meta.emergencyPrId ?? null,
          emergencyPrNumber: meta.emergencyPrNumber ?? null,
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
      stockConflictFlag: Boolean(meta.stockConflictFlag),
      stockConflictMessage: meta.stockConflictMessage ?? null,
      autoSwapLogs: Array.isArray(meta.autoSwapLogs) ? meta.autoSwapLogs : [],
      emergencyPrId: meta.emergencyPrId ?? null,
      emergencyPrNumber: meta.emergencyPrNumber ?? null,
    };
  }

  private normalizeInvoiceItems(rawItems: any[]): any[] {
    if (!Array.isArray(rawItems)) return [];
    return rawItems
      .filter((it) => String(it?.item ?? "").trim().length > 0)
      .map((it, idx) => {
        const serialNumbers = Array.isArray(it.serialNumbers)
          ? it.serialNumbers.map((s: any) => String(s ?? "").trim()).filter(Boolean)
          : [];
        const serialUnitIds = Array.isArray(it.serialUnitIds)
          ? it.serialUnitIds.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n) && n > 0)
          : [];
        const hasSn = Boolean(it.hasSerial || serialNumbers.length > 0 || serialUnitIds.length > 0);
        const kind: "GOODS" | "SERVICE" =
          it.kind === "SERVICE"
            ? "SERVICE"
            : it.kind === "GOODS" || it.productId || it.sku || hasSn
              ? "GOODS"
              : "SERVICE";
        return {
          id: String(it.id ?? idx + 1),
          item: String(it.item ?? "").trim(),
          qty: Number(it.qty) || (serialNumbers.length > 0 ? serialNumbers.length : 1),
          satuan: String(it.satuan || "Unit").trim(),
          harga: Number(it.harga) || 0,
          kind,
          ...(it.productId ? { productId: Number(it.productId) } : {}),
          ...(it.sku ? { sku: String(it.sku) } : {}),
          ...(hasSn ? { hasSerial: true } : {}),
          ...(serialUnitIds.length > 0 ? { serialUnitIds } : {}),
          ...(serialNumbers.length > 0 ? { serialNumbers } : {}),
          ...(it.outOfStockAutoSwap ? { outOfStockAutoSwap: true } : {}),
        };
      });
  }

  private async resolveRelatedQuotationAndMeta(params: {
    quotationId?: number | null;
    quotationNumber?: string | null;
    clientPoId?: number | null;
    projectId?: number | null;
    description?: string | null;
  }): Promise<{ quotationId?: number; quotationNumber?: string; quoteMeta?: any }> {
    let qId = params.quotationId ? Number(params.quotationId) : undefined;
    let qNum = params.quotationNumber || undefined;

    if (!qId && params.clientPoId) {
      const po = await this.prisma.main.clientPO.findUnique({
        where: { id: params.clientPoId },
        include: { quotation: true },
      });
      if (po?.quotationId) qId = po.quotationId;
      if (po?.quotation?.number) qNum = po.quotation.number;
    }
    if (!qId && params.projectId) {
      const proj = await this.prisma.main.project.findUnique({
        where: { id: params.projectId },
        include: { quotation: true },
      });
      if (proj?.quotationId) qId = proj.quotationId;
      if (proj?.quotation?.number) qNum = proj.quotation.number;
    }
    if (!qId && (qNum || params.description)) {
      const candidateNum = qNum || params.description?.match(/(?:QUO|PNW)[-\w\/]+/i)?.[0];
      if (candidateNum) {
        const qRow = await this.prisma.main.quotation.findFirst({
          where: { number: { contains: candidateNum } },
        });
        if (qRow) {
          qId = qRow.id;
          qNum = qRow.number;
        }
      }
    } else if (qId && !qNum) {
      const qRow = await this.prisma.main.quotation.findUnique({ where: { id: qId } });
      if (qRow) qNum = qRow.number;
    }

    let quoteMeta: any = null;
    if (qId) {
      try {
        const qSetting = await this.prisma.main.systemSetting.findFirst({
          where: { key: { in: [`quotation.meta.${qId}`, `quotation:meta:${qId}`] } },
        });
        if (qSetting?.value) quoteMeta = JSON.parse(qSetting.value);
      } catch {}
    }

    return { quotationId: qId, quotationNumber: qNum, quoteMeta };
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
    const leadTag = dto.leadId ? `[lead:${dto.leadId}]` : "";
    let description = desc ? (desc.includes(creatorTag) ? desc : `${desc} ${creatorTag}`) : creatorTag;
    if (leadTag && !description.includes(leadTag)) {
      description = `${description} ${leadTag}`;
    }

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

    const relatedInfo = await this.resolveRelatedQuotationAndMeta({
      quotationId: dto.quotationId,
      quotationNumber: dto.quotation,
      clientPoId: dto.clientPoId,
      projectId: dto.projectId,
      description,
    });

    // Jika dto.items tidak dikirim atau hanya berisi teks referensi penawaran, tarik daftar barang & SN asli dari Penawaran
    let resolvedItems = this.normalizeInvoiceItems(dto.items ?? []);
    const quoteItems = this.normalizeInvoiceItems(relatedInfo.quoteMeta?.items ?? []);
    const isJustQuotationReference =
      resolvedItems.length === 1 &&
      quoteItems.length > 0 &&
      !resolvedItems[0].productId &&
      (!resolvedItems[0].serialNumbers || resolvedItems[0].serialNumbers.length === 0) &&
      /(?:penawaran|quo|pnw)/i.test(resolvedItems[0].item);

    if ((resolvedItems.length === 0 || isJustQuotationReference) && quoteItems.length > 0) {
      resolvedItems = quoteItems;
    }

    const effectiveQuotationId = dto.quotationId ?? relatedInfo.quotationId;
    const effectiveQuotationNum = dto.quotation ?? relatedInfo.quotationNumber;

    if (
      resolvedItems.length > 0 ||
      dto.items !== undefined ||
      dto.discount !== undefined ||
      effectiveQuotationId !== undefined ||
      effectiveQuotationNum !== undefined ||
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
        ...(resolvedItems.length > 0 || dto.items !== undefined ? { items: resolvedItems } : {}),
        ...(dto.discount !== undefined
          ? { discount: dto.discount }
          : relatedInfo.quoteMeta?.discount !== undefined
            ? { discount: relatedInfo.quoteMeta.discount }
            : {}),
        ...(effectiveQuotationId !== undefined ? { quotationId: effectiveQuotationId } : {}),
        ...(effectiveQuotationNum !== undefined ? { quotation: effectiveQuotationNum } : {}),
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

    // Reserve SN untuk invoice ini & cek apakah ada SN yang sudah terkunci oleh Invoice Lunas lain
    if (resolvedItems.length > 0) {
      await this.checkAndSwapAgainstAlreadyPaidInvoices(row, resolvedItems, user).catch(() => {});
      const latestMeta = (await this.getMeta(row.id)) || {};
      const finalItems = Array.isArray(latestMeta.items) ? latestMeta.items : resolvedItems;
      await this.reservations
        .syncDocumentReservations({
          invoiceId: row.id,
          quotationId: effectiveQuotationId ?? null,
          projectId: row.projectId ?? null,
          noteLabel: `Invoice ${row.number}`,
          userId: user.id,
          markSerialReserved: true,
          items: finalItems,
        })
        .catch(() => {});
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
    if (synced.status === "PAID") {
      await this.syncRelatedInvoicesOnPaid(synced, user);
    }
    await this.notifications
      .notify({
        roles: ["FINANCE", "BOS", "SALES"],
        kind: "APPROVAL",
        title: "Invoice Penjualan Baru",
        text: `Invoice ${number} dibuat untuk ${customer.name} senilai Rp${Number(total).toLocaleString("id-ID")}`,
        href: `/invoices/${row.id}`,
      })
      .catch(() => {});
    this.notifications.dataChange("invoices", "create", row.id);
    const finalMeta = (await this.getMeta(row.id)) || {};
    return {
      ...synced,
      quotationId: effectiveQuotationId,
      quotation: effectiveQuotationNum,
      discount: finalMeta.discount ?? dto.discount,
      items: finalMeta.items ?? resolvedItems,
      stockConflictFlag: Boolean(finalMeta.stockConflictFlag),
      stockConflictMessage: finalMeta.stockConflictMessage ?? null,
      autoSwapLogs: finalMeta.autoSwapLogs ?? [],
      emergencyPrId: finalMeta.emergencyPrId ?? null,
      emergencyPrNumber: finalMeta.emergencyPrNumber ?? null,
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

    const normalizedItems = dto.items !== undefined ? this.normalizeInvoiceItems(dto.items) : undefined;
    const allConflictsResolved =
      normalizedItems !== undefined &&
      normalizedItems.every((it) => !it.outOfStockAutoSwap && (!it.hasSerial || (it.serialNumbers?.length ?? 0) >= (it.qty || 1)));

    if (
      normalizedItems !== undefined ||
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
        ...(normalizedItems !== undefined ? { items: normalizedItems } : {}),
        ...(allConflictsResolved ? { stockConflictFlag: false, stockConflictMessage: null } : {}),
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

    if (dto.status === "BATAL") {
      await this.reservations.releaseForDocument({ invoiceId: id }).catch(() => {});
    } else if (normalizedItems !== undefined) {
      await this.reservations
        .syncDocumentReservations({
          invoiceId: id,
          quotationId: dto.quotationId ?? null,
          projectId: updated.projectId ?? null,
          noteLabel: `Invoice ${updated.number}`,
          userId: user.id,
          markSerialReserved: true,
          items: normalizedItems,
        })
        .catch(() => {});
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
    if (dto.status === "PAID" || (dto.paidAmount !== undefined && Number(dto.paidAmount) >= total)) {
      await this.syncRelatedInvoicesOnPaid(updated, user);
    }
    return this.get(id);
  }

  private async findSiblingInvoices(row: InvoiceOut): Promise<InvoiceOut[]> {
    const meta = (await this.getMeta(row.id)) || {};
    let qId = meta.quotationId ? Number(meta.quotationId) : null;
    if (!qId && row.clientPoId) {
      const po = await this.prisma.main.clientPO.findUnique({
        where: { id: row.clientPoId },
        select: { quotationId: true },
      });
      if (po?.quotationId) qId = po.quotationId;
    }
    if (!qId && row.projectId) {
      const proj = await this.prisma.main.project.findUnique({
        where: { id: row.projectId },
        select: { quotationId: true },
      });
      if (proj?.quotationId) qId = proj.quotationId;
    }

    const match = row.number.match(/^(INV\/\d{4}\/\d{2}\/\d+)(?:\/\d+)?$/i);
    const basePrefix = match ? match[1] : null;

    const whereOr: any[] = [];
    if (row.projectId) whereOr.push({ projectId: row.projectId });
    if (row.clientPoId) whereOr.push({ clientPoId: row.clientPoId });
    if (basePrefix) whereOr.push({ number: { startsWith: basePrefix } });

    if (whereOr.length === 0 && !qId) return [];

    const candidates = await this.prisma.main.invoiceOut.findMany({
      where: {
        id: { not: row.id },
        status: { not: "BATAL" },
        ...(whereOr.length > 0 ? { OR: whereOr } : {}),
      },
    });

    if (qId) {
      const candidateIds = new Set(candidates.map((c) => c.id));
      const allSettings = await this.prisma.main.systemSetting.findMany({
        where: {
          key: { startsWith: "invoice:meta:" },
          value: { contains: `"quotationId":${qId}` },
        },
      });
      for (const s of allSettings) {
        const sid = Number(s.key.replace("invoice:meta:", ""));
        if (sid && sid !== row.id && !candidateIds.has(sid)) {
          const inv = await this.prisma.main.invoiceOut.findUnique({ where: { id: sid } });
          if (inv && inv.status !== "BATAL") {
            candidates.push(inv);
            candidateIds.add(inv.id);
          }
        }
      }
    }

    return candidates;
  }

  private async syncRelatedInvoicesOnPaid(invoice: InvoiceOut, user: RequestUser) {
    const isPelunasan =
      invoice.type === "PELUNASAN" ||
      /pelunasan/i.test(invoice.description || "");

    const matchSuffix = invoice.number.match(/\/(\d+)$/);
    const termNum = matchSuffix ? Number(matchSuffix[1]) : 1;
    const isSubsequent = termNum > 1;

    // Settle prior siblings if this is a pelunasan, subsequent installment, or final payment
    if (isPelunasan || isSubsequent) {
      const siblings = await this.findSiblingInvoices(invoice);
      for (const sib of siblings) {
        const sibMatch = sib.number.match(/\/(\d+)$/);
        const sibTermNum = sibMatch ? Number(sibMatch[1]) : 1;

        if (isPelunasan || sibTermNum < termNum) {
          if (sib.status !== "PAID" || Number(sib.paidAmount) < Number(sib.total)) {
            const sisa = Number(sib.total) - Number(sib.paidAmount);
            if (sisa > 0) {
              await this.prisma.main.payment.create({
                data: {
                  invoiceOutId: sib.id,
                  amount: sisa,
                  date: new Date(),
                  method: "TRANSFER",
                  reference: `Auto-settle via pelunasan ${invoice.number}`,
                  createdById: user.id,
                },
              }).catch(() => {});
            }
            await this.prisma.main.invoiceOut.update({
              where: { id: sib.id },
              data: {
                status: "PAID",
                paidAmount: sib.total,
              },
            });
            await this.audit.log({
              actor: user,
              action: "UBAH_STATUS_INVOICE",
              entityType: "invoice-out",
              entityId: sib.id,
              detail: `${sib.number}: otomatis LUNAS karena invoice ${invoice.number} telah lunas`,
            });
          }
        }
      }
    }

    // Lock SN pada invoice lunas ini & auto-swap FIFO pada penawaran/invoice lain yang belum dibayar
    await this.lockAndAutoSwapOnPaid(invoice, user).catch(() => {});
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
    const isNowPaid = paid >= Number(row.total) && Number(row.total) > 0;
    const updated = await this.prisma.main.invoiceOut.update({
      where: { id },
      data: {
        paidAmount: paid,
        ...(isNowPaid ? { status: "PAID" } : {}),
      },
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
    if (isNowPaid) {
      await this.syncRelatedInvoicesOnPaid(updated, user);
    }
    await this.notifications
      .notify({
        roles: ["FINANCE", "BOS", "SALES", "PM"],
        kind: "APPROVAL",
        title: isNowPaid ? "Invoice Lunas" : "Pembayaran Invoice Diterima",
        text: isNowPaid
          ? `Invoice ${row.number} telah LUNAS (total Rp${Number(paid).toLocaleString("id-ID")})`
          : `Pembayaran Rp${Number(dto.amount).toLocaleString("id-ID")} diterima untuk Invoice ${row.number}`,
        href: `/invoices/${id}`,
      })
      .catch(() => {});
    this.notifications.dataChange("invoices", "update", id);
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
    if (status === "BATAL") {
      await this.reservations.releaseForDocument({ invoiceId: id }).catch(() => {});
    }
    if (status === "PAID") {
      await this.syncRelatedInvoicesOnPaid(updated, user);
    }
    return this.sync(updated);
  }

  async remove(id: number, user: RequestUser) {
    this.assertFinanceOrAdmin(user, "Hanya tim Finance yang dapat menghapus invoice");
    const row = await this.prisma.main.invoiceOut.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Invoice tidak ditemukan");
    await this.reservations.releaseForDocument({ invoiceId: id }).catch(() => {});
    await this.prisma.main.$transaction(async (tx) => {
      await tx.payment.deleteMany({ where: { invoiceOutId: id } });
      await tx.systemSetting.deleteMany({ where: { key: this.metaKey(id) } });
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

  /**
   * Saat Invoice baru dibuat dari Penawaran, cek apakah ada SN di dalamnya yang sudah terkunci oleh Invoice Lunas lain.
   * Jika ada, langsung jalankan auto-swap FIFO (atau flag + buat PR Darurat bila stok habis).
   */
  private async checkAndSwapAgainstAlreadyPaidInvoices(
    invoice: InvoiceOut,
    items: any[],
    user: RequestUser,
  ) {
    const requestedSns = new Set<string>();
    const requestedIds = new Set<number>();
    for (const it of items ?? []) {
      for (const sn of it.serialNumbers ?? []) {
        if (sn) requestedSns.add(String(sn).trim());
      }
      for (const id of it.serialUnitIds ?? []) {
        if (Number(id) > 0) requestedIds.add(Number(id));
      }
    }
    if (requestedSns.size === 0 && requestedIds.size === 0) return;

    const siblings = await this.findSiblingInvoices(invoice);
    const siblingIds = new Set<number>([invoice.id, ...siblings.map((s) => s.id)]);

    // Cari reservasi aktif milik invoice LAIN yang sudah PAID atau unit yang sudah TERPASANG/DIKIRIM
    const units = await this.prisma.main.serialUnit.findMany({
      where: {
        OR: [
          ...(requestedIds.size > 0 ? [{ id: { in: Array.from(requestedIds) } }] : []),
          ...(requestedSns.size > 0 ? [{ sn: { in: Array.from(requestedSns) } }] : []),
        ],
      },
      include: {
        product: { select: { id: true, name: true, sku: true, unit: true } },
        reservations: {
          where: { releasedAt: null },
          include: {
            invoice: { select: { id: true, number: true, status: true } },
          },
        },
      },
    });

    const lockedSns = new Map<string, { unitId: number; sn: string; productId: number; productName: string; unitLabel: string; lockedByInvoice: string }>();
    for (const u of units) {
      const paidRes = u.reservations.find(
        (r) => r.invoice && !siblingIds.has(r.invoice.id) && r.invoice.status === "PAID",
      );
      if (paidRes?.invoice) {
        lockedSns.set(u.sn, {
          unitId: u.id,
          sn: u.sn,
          productId: u.productId,
          productName: u.product.name,
          unitLabel: u.product.unit || "Unit",
          lockedByInvoice: paidRes.invoice.number,
        });
      } else if (u.status === "TERPASANG" || u.status === "DIKIRIM" || u.status === "RUSAK") {
        lockedSns.set(u.sn, {
          unitId: u.id,
          sn: u.sn,
          productId: u.productId,
          productName: u.product.name,
          unitLabel: u.product.unit || "Unit",
          lockedByInvoice: `Status ${u.status}`,
        });
      }
    }

    if (lockedSns.size === 0) return;

    await this.swapCollidingItemsForDocument({
      docType: "INVOICE",
      docId: invoice.id,
      docNumber: invoice.number,
      projectId: invoice.projectId,
      items,
      lockedSns,
      usedReplacementUnitIds: new Set<number>(),
      user,
    });
  }

  /**
   * Engine Anti-Tabrakan & Auto-Swap FIFO saat sebuah Invoice dinyatakan LUNAS (PAID):
   * 1. Mengunci seluruh SN yang ada pada Invoice Lunas ini.
   * 2. Mencari seluruh Invoice lain yang belum lunas (DRAFT/SENT/PARTIAL/OVERDUE) dan Penawaran aktif lain
   *    yang memakai SN yang sama (baik diinput satuan maupun banyak sekaligus).
   * 3. Mengganti otomatis SN yang tabrakan dengan SN lain dari model/produk yang sama secara FIFO (status DI_GUDANG).
   * 4. Bila stok SN pengganti habis (0), memberi flag konflik pada Invoice/Penawaran tersebut dan otomatis membuat Purchase Request (PR) Darurat.
   */
  private async lockAndAutoSwapOnPaid(paidInvoice: InvoiceOut, user: RequestUser) {
    const paidMeta = (await this.getMeta(paidInvoice.id)) || {};
    const siblings = await this.findSiblingInvoices(paidInvoice);
    const siblingIds = new Set<number>([paidInvoice.id, ...siblings.map((s) => s.id)]);

    const relatedInfo = await this.resolveRelatedQuotationAndMeta({
      quotationId: paidMeta.quotationId,
      quotationNumber: paidMeta.quotation,
      clientPoId: paidInvoice.clientPoId,
      projectId: paidInvoice.projectId,
      description: paidInvoice.description,
    });
    const paidQuoteId = relatedInfo.quotationId;

    let paidItems: any[] = Array.isArray(paidMeta.items) && paidMeta.items.length > 0
      ? paidMeta.items
      : Array.isArray(relatedInfo.quoteMeta?.items)
        ? relatedInfo.quoteMeta.items
        : [];

    if (paidItems.length === 0) {
      for (const sib of siblings) {
        const sibMeta = (await this.getMeta(sib.id)) || {};
        if (Array.isArray(sibMeta.items) && sibMeta.items.length > 0) {
          paidItems = sibMeta.items;
          break;
        }
      }
    }

    // Pastikan reservasi SN untuk invoice yang lunas ini tercatat & terkunci
    const lockedUnits = await this.reservations.syncDocumentReservations({
      invoiceId: paidInvoice.id,
      quotationId: paidQuoteId ?? null,
      projectId: paidInvoice.projectId ?? null,
      noteLabel: `Invoice Lunas ${paidInvoice.number}`,
      userId: user.id,
      markSerialReserved: true,
      items: paidItems,
    });

    if (lockedUnits.length === 0) return;

    const productIds = Array.from(new Set(lockedUnits.map((u) => u.productId)));
    const products = await this.prisma.main.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, sku: true, unit: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const lockedSns = new Map<
      string,
      { unitId: number; sn: string; productId: number; productName: string; unitLabel: string; lockedByInvoice: string }
    >();
    for (const u of lockedUnits) {
      const prod = productMap.get(u.productId);
      lockedSns.set(u.sn, {
        unitId: u.id,
        sn: u.sn,
        productId: u.productId,
        productName: prod?.name || `Produk #${u.productId}`,
        unitLabel: prod?.unit || "Unit",
        lockedByInvoice: paidInvoice.number,
      });
    }

    const usedReplacementUnitIds = new Set<number>(lockedUnits.map((u) => u.id));

    // 1. Cek semua Invoice lain yang belum lunas (bukan sibling dari invoice ini)
    const unpaidInvoices = await this.prisma.main.invoiceOut.findMany({
      where: {
        id: { notIn: Array.from(siblingIds) },
        status: { notIn: ["PAID", "BATAL"] },
      },
    });

    for (const otherInv of unpaidInvoices) {
      const otherMeta = (await this.getMeta(otherInv.id)) || {};
      const otherItems: any[] = Array.isArray(otherMeta.items) ? otherMeta.items : [];
      if (otherItems.length === 0) continue;

      const hasCollision = otherItems.some((it) => {
        const sns: string[] = Array.isArray(it.serialNumbers) ? it.serialNumbers : [];
        const ids: number[] = Array.isArray(it.serialUnitIds) ? it.serialUnitIds.map(Number) : [];
        return (
          sns.some((sn) => lockedSns.has(String(sn).trim())) ||
          ids.some((id) => Array.from(lockedSns.values()).some((l) => l.unitId === id))
        );
      });

      if (!hasCollision) continue;

      await this.swapCollidingItemsForDocument({
        docType: "INVOICE",
        docId: otherInv.id,
        docNumber: otherInv.number,
        projectId: otherInv.projectId,
        items: otherItems,
        lockedSns,
        usedReplacementUnitIds,
        user,
      });
    }

    // 2. Cek semua Penawaran (Quotation) lain yang masih aktif (bukan penawaran milik invoice lunas ini)
    const allQuotationSettings = await this.prisma.main.systemSetting.findMany({
      where: { key: { startsWith: "quotation.meta." } },
    });

    for (const qSetting of allQuotationSettings) {
      const qId = Number(qSetting.key.replace("quotation.meta.", ""));
      if (!Number.isFinite(qId) || qId <= 0 || qId === paidQuoteId) continue;

      let qMeta: any = null;
      try {
        qMeta = JSON.parse(qSetting.value);
      } catch {
        continue;
      }
      const qItems: any[] = Array.isArray(qMeta?.items) ? qMeta.items : [];
      if (qItems.length === 0) continue;

      const hasCollision = qItems.some((it) => {
        const sns: string[] = Array.isArray(it.serialNumbers) ? it.serialNumbers : [];
        const ids: number[] = Array.isArray(it.serialUnitIds) ? it.serialUnitIds.map(Number) : [];
        return (
          sns.some((sn) => lockedSns.has(String(sn).trim())) ||
          ids.some((id) => Array.from(lockedSns.values()).some((l) => l.unitId === id))
        );
      });
      if (!hasCollision) continue;

      const qRow = await this.prisma.main.quotation.findUnique({ where: { id: qId } });
      if (!qRow || qRow.status === "REJECTED" || qRow.status === "EXPIRED") continue;

      await this.swapCollidingItemsForDocument({
        docType: "QUOTATION",
        docId: qRow.id,
        docNumber: qRow.number,
        projectId: null,
        items: qItems,
        lockedSns,
        usedReplacementUnitIds,
        user,
      });
    }
  }

  private async swapCollidingItemsForDocument(params: {
    docType: "INVOICE" | "QUOTATION";
    docId: number;
    docNumber: string;
    projectId?: number | null;
    items: any[];
    lockedSns: Map<
      string,
      { unitId: number; sn: string; productId: number; productName: string; unitLabel: string; lockedByInvoice: string }
    >;
    usedReplacementUnitIds: Set<number>;
    user: RequestUser;
  }) {
    const { docType, docId, docNumber, projectId, items, lockedSns, usedReplacementUnitIds, user } = params;
    const lockedById = new Map(Array.from(lockedSns.values()).map((v) => [v.unitId, v]));

    const updatedItems = JSON.parse(JSON.stringify(items)) as any[];
    const swapLogs: Array<{
      date: string;
      productId: number;
      productName: string;
      oldSn: string;
      newSn: string | null;
      triggeredByInvoice: string;
    }> = [];
    const shortageByProduct = new Map<
      number,
      { productId: number; productName: string; unitLabel: string; missingQty: number; oldSns: string[]; triggeredBy: string }
    >();

    for (const it of updatedItems) {
      const sns: string[] = Array.isArray(it.serialNumbers)
        ? it.serialNumbers.map((s: any) => String(s ?? "").trim()).filter(Boolean)
        : [];
      const ids: number[] = Array.isArray(it.serialUnitIds)
        ? it.serialUnitIds.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n) && n > 0)
        : [];

      if (sns.length === 0 && ids.length === 0) continue;

      const newSns: string[] = [];
      const newIds: number[] = [];
      const count = Math.max(sns.length, ids.length);

      for (let i = 0; i < count; i++) {
        const snVal = sns[i];
        const idVal = ids[i];
        const lockedInfo = (snVal && lockedSns.get(snVal)) || (idVal && lockedById.get(idVal));

        if (!lockedInfo) {
          if (snVal) newSns.push(snVal);
          if (idVal) newIds.push(idVal);
          continue;
        }

        // Cari SN pengganti yang statusnya DI_GUDANG secara FIFO (id ASC)
        const replacement = await this.prisma.main.serialUnit.findFirst({
          where: {
            productId: lockedInfo.productId,
            status: "DI_GUDANG",
            id: { notIn: Array.from(usedReplacementUnitIds) },
          },
          orderBy: { id: "asc" },
        });

        if (replacement) {
          usedReplacementUnitIds.add(replacement.id);
          newSns.push(replacement.sn);
          newIds.push(replacement.id);
          if (typeof it.item === "string" && it.item.includes(lockedInfo.sn)) {
            it.item = it.item.replaceAll(lockedInfo.sn, replacement.sn);
          }
          swapLogs.push({
            date: new Date().toISOString(),
            productId: lockedInfo.productId,
            productName: lockedInfo.productName,
            oldSn: lockedInfo.sn,
            newSn: replacement.sn,
            triggeredByInvoice: lockedInfo.lockedByInvoice,
          });
        } else {
          // Stok habis untuk model ini!
          it.outOfStockAutoSwap = true;
          if (typeof it.item === "string" && !it.item.includes("[STOK SN HABIS")) {
            it.item = `${it.item.replace(lockedInfo.sn, `${lockedInfo.sn} [TERPAKAI]`)} [STOK SN HABIS - PR DARURAT]`;
          }
          swapLogs.push({
            date: new Date().toISOString(),
            productId: lockedInfo.productId,
            productName: lockedInfo.productName,
            oldSn: lockedInfo.sn,
            newSn: null,
            triggeredByInvoice: lockedInfo.lockedByInvoice,
          });
          const curShortage = shortageByProduct.get(lockedInfo.productId) ?? {
            productId: lockedInfo.productId,
            productName: lockedInfo.productName,
            unitLabel: lockedInfo.unitLabel,
            missingQty: 0,
            oldSns: [],
            triggeredBy: lockedInfo.lockedByInvoice,
          };
          curShortage.missingQty += 1;
          curShortage.oldSns.push(lockedInfo.sn);
          shortageByProduct.set(lockedInfo.productId, curShortage);
        }
      }

      it.serialNumbers = newSns;
      it.serialUnitIds = newIds;
    }

    if (swapLogs.length === 0) return;

    // Jika ada kekurangan stok SN, buat Purchase Request (PR) Darurat otomatis ke Procurement & Flag dokumen
    let emergencyPr: { id: number; number: string } | null = null;
    if (shortageByProduct.size > 0) {
      const prNumber = await this.docnum.next("permintaan");
      const shortageList = Array.from(shortageByProduct.values());
      const detailSummary = shortageList
        .map((s) => `${s.productName} (${s.missingQty} ${s.unitLabel}, eks SN: ${s.oldSns.join(", ")})`)
        .join("; ");

      const createdPr = await this.prisma.main.purchaseRequest.create({
        data: {
          number: prNumber,
          date: new Date(),
          costType: "STOK",
          purpose: `[AUTO-PR DARURAT] Kekurangan stok SN pada ${docType === "INVOICE" ? "Invoice" : "Penawaran"} ${docNumber}`,
          otherNote: `[AUTO-PR DARURAT] Kekurangan stok SN pada ${docType === "INVOICE" ? "Invoice" : "Penawaran"} ${docNumber} karena SN sebelumnya telah terkunci di Invoice Lunas (${shortageList[0]?.triggeredBy}). Detail: ${detailSummary}`,
          projectId: projectId ?? null,
          requesterId: user.id,
          status: "DIAJUKAN",
          items: {
            create: shortageList.map((s) => ({
              productId: s.productId,
              qty: s.missingQty,
              unitCost: 0,
            })),
          },
        },
      });
      emergencyPr = { id: createdPr.id, number: createdPr.number };

      await this.approvals
        .request({
          kind: "PURCHASE_REQUEST",
          entityId: createdPr.id,
          title: `[DARURAT] Purchase Request ${createdPr.number} — Konflik Stok SN ${docNumber}`,
          amount: 0,
          requestedBy: user,
          href: "/purchase-requests",
        })
        .catch(() => {});
    }

    const swappedSuccessCount = swapLogs.filter((l) => l.newSn !== null).length;
    const missingCount = swapLogs.filter((l) => l.newSn === null).length;

    const conflictMessage =
      missingCount > 0
        ? `Stok SN habis untuk ${missingCount} unit (SN sebelumnya telah dibayar di Invoice ${swapLogs[0]?.triggeredByInvoice}). Otomatis dibuat PR Darurat ${emergencyPr?.number ?? ""} ke Procurement.`
        : null;

    if (docType === "INVOICE") {
      const existingMeta = (await this.getMeta(docId)) || {};
      const prevLogs = Array.isArray(existingMeta.autoSwapLogs) ? existingMeta.autoSwapLogs : [];
      await this.saveMeta(docId, {
        items: updatedItems,
        stockConflictFlag: missingCount > 0,
        stockConflictMessage: conflictMessage,
        autoSwapLogs: [...swapLogs, ...prevLogs].slice(0, 50),
        ...(emergencyPr ? { emergencyPrId: emergencyPr.id, emergencyPrNumber: emergencyPr.number } : {}),
      });

      await this.reservations
        .syncDocumentReservations({
          invoiceId: docId,
          projectId: projectId ?? null,
          noteLabel: `Auto-Swap FIFO Invoice ${docNumber}`,
          userId: user.id,
          markSerialReserved: true,
          items: updatedItems,
        })
        .catch(() => {});

      await this.audit.log({
        actor: user,
        action: missingCount > 0 ? "KONFLIK_STOK_SN_INVOICE" : "AUTO_SWAP_SN_INVOICE",
        entityType: "invoice-out",
        entityId: docId,
        detail:
          missingCount > 0
            ? `${docNumber}: ${missingCount} SN kehabisan stok saat auto-swap → PR Darurat ${emergencyPr?.number}`
            : `${docNumber}: ${swappedSuccessCount} SN otomatis diganti (FIFO) karena SN lama lunas di invoice lain`,
      });

      await this.notifications
        .notify({
          roles: ["FINANCE", "SALES", "GUDANG", "PROCUREMENT"],
          kind: "STOK",
          text:
            missingCount > 0
              ? `⚠️ [FLAG INVOICE ${docNumber}] Stok SN habis saat auto-swap! PR Darurat ${emergencyPr?.number} telah dibuat otomatis.`
              : `🔄 [Auto-Swap SN FIFO] ${swappedSuccessCount} unit SN pada Invoice ${docNumber} telah diganti otomatis ke SN baru karena SN sebelumnya telah dibayar di invoice lain.`,
          href: "/invoices",
        })
        .catch(() => {});
    } else {
      // QUOTATION
      const key = `quotation.meta.${docId}`;
      const setting = await this.prisma.main.systemSetting.findUnique({ where: { key } });
      let qMeta: any = {};
      try {
        if (setting?.value) qMeta = JSON.parse(setting.value);
      } catch {}
      const prevLogs = Array.isArray(qMeta.autoSwapLogs) ? qMeta.autoSwapLogs : [];
      const mergedQMeta = {
        ...qMeta,
        items: updatedItems,
        stockConflictFlag: missingCount > 0,
        stockConflictMessage: conflictMessage,
        autoSwapLogs: [...swapLogs, ...prevLogs].slice(0, 50),
        ...(emergencyPr ? { emergencyPrId: emergencyPr.id, emergencyPrNumber: emergencyPr.number } : {}),
      };
      await this.prisma.main.systemSetting
        .upsert({
          where: { key },
          update: { value: JSON.stringify(mergedQMeta) },
          create: { key, value: JSON.stringify(mergedQMeta) },
        })
        .catch(() => {});

      await this.reservations
        .syncDocumentReservations({
          quotationId: docId,
          noteLabel: `Auto-Swap FIFO Penawaran ${docNumber}`,
          userId: user.id,
          markSerialReserved: false,
          items: updatedItems,
        })
        .catch(() => {});

      await this.notifications
        .notify({
          roles: ["SALES", "FINANCE", "GUDANG", "PROCUREMENT"],
          kind: "STOK",
          text:
            missingCount > 0
              ? `⚠️ [FLAG PENAWARAN ${docNumber}] Stok SN habis saat auto-swap! PR Darurat ${emergencyPr?.number} telah dibuat otomatis.`
              : `🔄 [Auto-Swap SN FIFO] ${swappedSuccessCount} unit SN pada Penawaran ${docNumber} otomatis diganti ke SN baru karena SN sebelumnya telah dibayar di invoice lain.`,
          href: "/quotations",
        })
        .catch(() => {});
    }
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
