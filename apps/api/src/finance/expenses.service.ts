import { can } from "../rbac/permissions.js";
import { PETTY_CASH_SOURCE, pettyCashAvailable } from "./petty-cash-wallet.js";
import { buildPettyCashSpendLines, pettyCashUsage } from "../accounting/cash-advance.rules.js";
import { projectIdForSurvey } from "../accounting/project-cost.rules.js";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { ApprovalsService } from "../approvals/approvals.service.js";
import { PostingService } from "../accounting/posting.service.js";
import { MappingService } from "../accounting/mapping.service.js";
import { PostingRules } from "../accounting/posting.rules.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip } from "../common/utils/query.js";
import type { ApprovalStatus } from "../generated/prisma/client.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { ExpenseDto, ExpenseStatusDto } from "./dto.js";

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly approvals: ApprovalsService,
    private readonly postingService: PostingService,
    private readonly mappingService: MappingService,
  ) {
    this.approvals.onChange("PENGELUARAN", (entityId, status) => this.onApproval(entityId, status));
  }

  private async syncSurveyCost(surveyId: number | null | undefined) {
    if (!surveyId) return;
    try {
      this.notifications.dataChange("surveys", "update", surveyId);
    } catch {}
  }

  private async syncPocCost(pocReportId: number | null | undefined) {
    if (!pocReportId) return;
    try {
      const expenses = await this.prisma.main.expense.findMany({
        where: { pocReportId, status: { not: "DITOLAK" } },
        select: { amount: true },
      });
      const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
      await this.prisma.main.pocReport.update({
        where: { id: pocReportId },
        data: { actualCost: total },
      });
      this.notifications.dataChange("poc-reports", "update", pocReportId);
    } catch {}
  }

  private async where(
    q: PageQuery & {
      status?: string;
      reporterId?: number;
      projectId?: number;
      surveyId?: number;
      deliveryNoteId?: number;
      pocReportId?: number;
      visitReportId?: number;
      maintenanceReportId?: number;
      fundingSource?: string;
      from?: string;
      to?: string;
    },
    user: RequestUser,
  ) {
    const role = (user.role || "").toUpperCase();
    const scope =
      ["SUPER_ADMIN", "FINANCE", "BOS", "ADMIN"].includes(role) ||
      q.surveyId ||
      // semua pengeluaran satu proyek hanya untuk pengelola proyek (PM / pimpinan); karyawan lain tetap miliknya sendiri
      (q.projectId && can(user.role, "projects", "U")) ||
      q.pocReportId ||
      q.visitReportId ||
      q.maintenanceReportId
        ? {}
        : { reporterId: user.id };
    return {
      ...scope,
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.reporterId ? { reporterId: q.reporterId } : {}),
      ...(q.projectId ? { projectId: q.projectId } : {}),
      ...(q.surveyId ? { surveyId: q.surveyId } : {}),
      ...(q.pocReportId ? { pocReportId: q.pocReportId } : {}),
      ...(q.visitReportId ? { visitReportId: q.visitReportId } : {}),
      ...(q.maintenanceReportId ? { maintenanceReportId: q.maintenanceReportId } : {}),
      ...(q.fundingSource ? { fundingSource: q.fundingSource } : {}),
      ...(q.deliveryNoteId ? { deliveryNoteId: q.deliveryNoteId } : {}),
      ...(q.from || q.to
        ? { date: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } }
        : {}),
      ...(q.q ? { OR: [{ description: { contains: q.q } }, { reporter: { name: { contains: q.q } } }] } : {}),
    };
  }

  async list(
    q: PageQuery & {
      status?: string;
      reporterId?: number;
      projectId?: number;
      surveyId?: number;
      deliveryNoteId?: number;
      from?: string;
      to?: string;
    },
    user: RequestUser,
  ) {
    const where = await this.where(q, user);
    const [items, total] = await Promise.all([
      this.prisma.main.expense.findMany({
        where,
        include: {
          reporter: { select: { id: true, name: true, role: true } },
          category: { select: { id: true, name: true } },
          costCenter: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
          survey: { select: { id: true, location: true, lead: { select: { id: true, name: true } } } },
          deliveryNote: { select: { id: true, number: true } },
          pocReport: { select: { id: true, number: true, title: true } },
          visitReport: { select: { id: true, number: true, title: true } },
          maintenanceReport: { select: { id: true, number: true, title: true } },
        },
        orderBy: orderBy(q.sort, q.dir, ["date", "createdAt"], "date"),
        ...pageSkip(q),
      }),
      this.prisma.main.expense.count({ where }),
    ]);

    // Ambil metadata file untuk receiptFileId dan paidFileId
    const fileIds = Array.from(
      new Set(
        items
          .flatMap((it) => [it.receiptFileId, it.paidFileId])
          .filter((id): id is number => typeof id === "number" && id > 0),
      ),
    );
    const files = fileIds.length
      ? await this.prisma.main.file.findMany({
          where: { id: { in: fileIds } },
          select: { id: true, originalName: true, mimeType: true, size: true },
        })
      : [];
    const fileMap = new Map(files.map((f) => [f.id, f]));

    const enriched = items.map((it) => ({
      ...it,
      receiptFile: it.receiptFileId ? fileMap.get(it.receiptFileId) ?? null : null,
      paidFile: it.paidFileId ? fileMap.get(it.paidFileId) ?? null : null,
    }));

    return paginate(enriched, total, q);
  }

  async get(id: number) {
    const row = await this.prisma.main.expense.findUnique({
      where: { id },
      include: {
        reporter: { select: { id: true, name: true, role: true } },
        category: true,
        costCenter: true,
        project: { select: { id: true, name: true } },
        survey: { select: { id: true, location: true, lead: { select: { id: true, name: true } } } },
        deliveryNote: { select: { id: true, number: true } },
        pocReport: { select: { id: true, number: true, title: true } },
        visitReport: { select: { id: true, number: true, title: true } },
        maintenanceReport: { select: { id: true, number: true, title: true } },
      },
    });
    if (!row) throw new NotFoundException("Pengeluaran tidak ditemukan");
    const [approval, receiptFile, paidFile] = await Promise.all([
      this.approvals.getFor("PENGELUARAN", id),
      row.receiptFileId
        ? this.prisma.main.file.findUnique({
            where: { id: row.receiptFileId },
            select: { id: true, originalName: true, mimeType: true, size: true },
          })
        : null,
      row.paidFileId
        ? this.prisma.main.file.findUnique({
            where: { id: row.paidFileId },
            select: { id: true, originalName: true, mimeType: true, size: true },
          })
        : null,
    ]);
    return { ...row, approval, receiptFile, paidFile };
  }

  async create(dto: ExpenseDto, user: RequestUser) {
    let costCenterId = dto.projectId ? undefined : dto.costCenterId;
    if (!dto.projectId && !dto.surveyId && !dto.deliveryNoteId && !dto.pocReportId && !dto.visitReportId && !dto.maintenanceReportId && !costCenterId) {
      const cc = await this.prisma.main.costCenter.findFirst();
      costCenterId = cc?.id;
    }

    const amount = dto.amount ?? 0;
    const description = dto.description || "Pengeluaran operasional";
    const date = dto.date ? new Date(dto.date) : new Date();
    const isPettyCash = dto.fundingSource === PETTY_CASH_SOURCE;
    if (isPettyCash) {
      const available = await pettyCashAvailable(this.prisma.main, user.id);
      if (Number(amount) > available) {
        throw new BadRequestException(
          `Saldo petty cash Anda tidak cukup (tersedia Rp${available.toLocaleString("id-ID")}). Minta Finance mengisi saldo terlebih dahulu.`,
        );
      }
    }

    const row = await this.prisma.main.expense.create({
      data: {
        date,
        reporterId: user.id,
        categoryId: dto.categoryId,
        amount,
        description,
        projectId: dto.projectId,
        surveyId: dto.surveyId,
        deliveryNoteId: dto.deliveryNoteId,
        pocReportId: dto.pocReportId,
        visitReportId: dto.visitReportId,
        maintenanceReportId: dto.maintenanceReportId,
        fundingSource: dto.fundingSource ?? "PERUSAHAAN",
        reimbursementStatus: dto.fundingSource === "TALANGAN_PRIBADI" ? (dto.reimbursementStatus ?? "DRAFT") : null,
        paymentMethod: dto.paymentMethod,
        approvedAmount: dto.approvedAmount,
        paidAmount: dto.paidAmount,
        receiptFileIds: dto.receiptFileIds,
        costCenterId,
        receiptFileId: dto.receiptFileId,
        paidFileId: dto.paidFileId,
        status: dto.status ?? "DILAPORKAN",
      },
      include: {
        reporter: { select: { id: true, name: true, role: true } },
        category: { select: { id: true, name: true } },
        costCenter: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        survey: { select: { id: true, location: true, lead: { select: { id: true, name: true } } } },
        pocReport: { select: { id: true, number: true, title: true } },
        visitReport: { select: { id: true, number: true, title: true } },
        maintenanceReport: { select: { id: true, number: true, title: true } },
      },
    });

    if (dto.receiptFileId) {
      await this.prisma.main.file.update({
        where: { id: dto.receiptFileId },
        data: { refType: "expense", refId: String(row.id) },
      }).catch(() => {});
    }

    if (dto.surveyId) {
      await this.syncSurveyCost(dto.surveyId);
    }
    if (dto.pocReportId) {
      await this.syncPocCost(dto.pocReportId);
    }

    await this.approvals.request({
      kind: "PENGELUARAN",
      entityId: row.id,
      title: `${isPettyCash ? "Pemakaian petty cash" : "Pengeluaran"} ${row.project?.name ?? "harian"} — Rp${amount}`,
      amount: Number(amount),
      requestedBy: user,
      href: `/expenses/${row.id}`,
    });

    await this.audit.log({
      actor: user,
      action: "BUAT_PENGELUARAN",
      entityType: "expense",
      entityId: row.id,
      detail: `Rp${amount} — ${description.slice(0, 120)}`,
    });
    this.notifications.dataChange("expenses", "create", row.id);
    const receiptFile = dto.receiptFileId
      ? await this.prisma.main.file.findUnique({
          where: { id: dto.receiptFileId },
          select: { id: true, originalName: true, mimeType: true, size: true },
        })
      : null;
    return { ...row, receiptFile, paidFile: null };
  }

  async update(id: number, dto: ExpenseDto, user: RequestUser) {
    const row = await this.prisma.main.expense.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Pengeluaran tidak ditemukan");
    if (row.cashAdvanceId) {
      throw new BadRequestException("Pengeluaran ini berasal dari laporan petty cash dan dikelola lewat menu Petty Cash.");
    }
    const role = (user.role || "").toUpperCase();
    const isReporter = !row.reporterId || row.reporterId === user.id;
    const canEditExpense =
      ["SUPER_ADMIN", "FINANCE", "BOS", "ADMIN"].includes(role) ||
      (["SALES", "PROCUREMENT", "PM", "TEKNISI", "SE"].includes(role) && isReporter && row.status !== "DIBAYAR");
    if (!canEditExpense) {
      throw new BadRequestException("Hanya Finance atau pelapor pengeluaran yang memiliki hak untuk mengubah data pengeluaran ini");
    }

    const nextSource = dto.fundingSource !== undefined ? dto.fundingSource : row.fundingSource;
    if (nextSource === PETTY_CASH_SOURCE && row.status === "DILAPORKAN") {
      const nextAmount = Number(dto.amount ?? row.amount);
      // saldo tersedia sudah dikurangi nilai lama pengeluaran ini (bila sebelumnya juga petty cash)
      const available =
        (await pettyCashAvailable(this.prisma.main, row.reporterId)) + (row.fundingSource === PETTY_CASH_SOURCE ? Number(row.amount) : 0);
      if (nextAmount > available) {
        throw new BadRequestException(`Saldo petty cash tidak cukup (tersedia Rp${available.toLocaleString("id-ID")})`);
      }
    }

    if (dto.receiptFileId && dto.receiptFileId !== row.receiptFileId) {
      await this.prisma.main.file.update({
        where: { id: dto.receiptFileId },
        data: { refType: "expense", refId: String(id) },
      }).catch(() => {});
    }
    if (dto.paidFileId && dto.paidFileId !== row.paidFileId) {
      await this.prisma.main.file.update({
        where: { id: dto.paidFileId },
        data: { refType: "expense-paid", refId: String(id) },
      }).catch(() => {});
    }

    const updated = await this.prisma.main.expense.update({
      where: { id },
      data: {
        date: dto.date ? new Date(dto.date) : row.date,
        categoryId: dto.categoryId !== undefined ? dto.categoryId : row.categoryId,
        amount: dto.amount ?? row.amount,
        description: dto.description ?? row.description,
        projectId: dto.projectId !== undefined ? dto.projectId : row.projectId,
        surveyId: dto.surveyId !== undefined ? dto.surveyId : row.surveyId,
        deliveryNoteId: dto.deliveryNoteId !== undefined ? dto.deliveryNoteId : row.deliveryNoteId,
        pocReportId: dto.pocReportId !== undefined ? dto.pocReportId : row.pocReportId,
        visitReportId: dto.visitReportId !== undefined ? dto.visitReportId : row.visitReportId,
        maintenanceReportId: dto.maintenanceReportId !== undefined ? dto.maintenanceReportId : row.maintenanceReportId,
        fundingSource: dto.fundingSource !== undefined ? dto.fundingSource : row.fundingSource,
        reimbursementStatus: dto.reimbursementStatus !== undefined ? dto.reimbursementStatus : row.reimbursementStatus,
        paymentMethod: dto.paymentMethod !== undefined ? dto.paymentMethod : row.paymentMethod,
        approvedAmount: dto.approvedAmount !== undefined ? dto.approvedAmount : row.approvedAmount,
        paidAmount: dto.paidAmount !== undefined ? dto.paidAmount : row.paidAmount,
        receiptFileIds: dto.receiptFileIds !== undefined ? dto.receiptFileIds : row.receiptFileIds,
        costCenterId: dto.costCenterId !== undefined ? dto.costCenterId : row.costCenterId,
        receiptFileId: dto.receiptFileId !== undefined ? dto.receiptFileId : row.receiptFileId,
        paidFileId: dto.paidFileId !== undefined ? dto.paidFileId : row.paidFileId,
        ...(dto.status ? { status: dto.status } : {}),
      },
      include: {
        reporter: { select: { id: true, name: true, role: true } },
        category: { select: { id: true, name: true } },
        costCenter: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        survey: { select: { id: true, location: true, lead: { select: { id: true, name: true } } } },
        pocReport: { select: { id: true, number: true, title: true } },
        visitReport: { select: { id: true, number: true, title: true } },
        maintenanceReport: { select: { id: true, number: true, title: true } },
      },
    });

    if (updated.surveyId) {
      await this.syncSurveyCost(updated.surveyId);
    }
    if (row.surveyId && row.surveyId !== updated.surveyId) {
      await this.syncSurveyCost(row.surveyId);
    }
    if (updated.pocReportId) {
      await this.syncPocCost(updated.pocReportId);
    }
    if (row.pocReportId && row.pocReportId !== updated.pocReportId) {
      await this.syncPocCost(row.pocReportId);
    }

    await this.audit.log({
      actor: user,
      action: "UBAH_PENGELUARAN",
      entityType: "expense",
      entityId: id,
      detail: `Rp${updated.amount} — ${updated.description.slice(0, 120)}`,
    });
    this.notifications.dataChange("expenses", "update", id);
    const [receiptFile, paidFile] = await Promise.all([
      updated.receiptFileId
        ? this.prisma.main.file.findUnique({
            where: { id: updated.receiptFileId },
            select: { id: true, originalName: true, mimeType: true, size: true },
          })
        : null,
      updated.paidFileId
        ? this.prisma.main.file.findUnique({
            where: { id: updated.paidFileId },
            select: { id: true, originalName: true, mimeType: true, size: true },
          })
        : null,
    ]);
    return { ...updated, receiptFile, paidFile };
  }

  async setStatus(id: number, dto: ExpenseStatusDto, user: RequestUser) {
    const row = await this.prisma.main.expense.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Pengeluaran tidak ditemukan");
    if (row.cashAdvanceId) {
      throw new BadRequestException("Pengeluaran ini berasal dari laporan petty cash dan dikelola lewat menu Petty Cash.");
    }

    if (dto.paidFileId) {
      await this.prisma.main.file.update({
        where: { id: dto.paidFileId },
        data: { refType: "expense-paid", refId: String(id) },
      }).catch(() => {});
    }

    // Pengeluaran yang sudah DIBAYAR tidak bisa dibayar ulang / dimundurkan (kas sudah keluar).
    if (row.status === "DIBAYAR") {
      if (dto.status !== "DIBAYAR") {
        throw new BadRequestException("Pengeluaran sudah dibayar dan tidak bisa diubah statusnya. Buat jurnal koreksi bila perlu.");
      }
      // Hanya melengkapi bukti bayar; tidak ada jurnal / kas keluar baru.
      const kept = await this.prisma.main.expense.update({
        where: { id },
        data: { ...(dto.paidFileId ? { paidFileId: dto.paidFileId } : {}) },
        include: { reporter: { select: { id: true, name: true } } },
      });
      return { ...kept, receiptFile: null, paidFile: null };
    }
    if (dto.status === "DIBAYAR" && row.status === "DITOLAK") {
      throw new BadRequestException("Pengeluaran yang ditolak tidak bisa dibayar");
    }
    // Pemakaian petty cash: uangnya sudah dipegang karyawan, jadi "disetujui" = langsung selesai (tanpa pembayaran lagi).
    const isPettyCash = row.fundingSource === PETTY_CASH_SOURCE;
    const effStatus = isPettyCash && (dto.status === "DISETUJUI" || dto.status === "DIBAYAR") ? "DIBAYAR" : dto.status;
    const isPaid = Boolean(effStatus === "DIBAYAR");
    const shouldReverse = row.status === "DISETUJUI" && (dto.status === "DITOLAK" || dto.status === "DILAPORKAN");

    // Bungkus pembalikan jurnal & update status dalam satu $transaction agar atomik (409 CLOSED membatalkan keduanya)
    const updated = await this.prisma.main.$transaction(async (tx) => {
      if (shouldReverse) {
        await this.postingService.reverseAllForSource(
          "Expense",
          id,
          `Pengeluaran ${dto.status === "DITOLAK" ? "ditolak" : "dikembalikan"}`,
          user.id,
          tx,
        );
      }
      return tx.expense.update({
        where: { id },
        data: {
          status: effStatus,
          ...(dto.reason ? { rejectReason: dto.reason } : {}),
          ...(dto.paidFileId ? { paidFileId: dto.paidFileId } : {}),
          ...(isPaid
            ? {
                paidAt: new Date(),
                paidById: user.id,
                paidAmount: row.amount,
                reimbursementStatus: row.fundingSource === "TALANGAN_PRIBADI" ? "DIBAYAR" : undefined,
                ...(isPettyCash ? { paidAccountCode: null } : {}),
              }
            : {}),
          ...(dto.paymentMethod ? { paymentMethod: dto.paymentMethod } : {}),
          ...(dto.fundingSource && !isPettyCash ? { fundingSource: dto.fundingSource } : {}),
          ...(dto.paidAccountCode && !isPettyCash ? { paidAccountCode: dto.paidAccountCode } : {}),
        },
        include: { reporter: { select: { id: true, name: true } } },
      });
    });

    if (row.surveyId) {
      await this.syncSurveyCost(row.surveyId);
    }
    if (row.pocReportId) {
      await this.syncPocCost(row.pocReportId);
    }

    await this.audit.log({
      actor: user,
      action: "UBAH_STATUS_PENGELUARAN",
      entityType: "expense",
      entityId: id,
      detail: `${row.status} → ${effStatus}${dto.reason ? ` (${dto.reason})` : ""}`,
    });
    await this.notifications.notify({
      userIds: [row.reporterId],
      kind: "APPROVAL",
      text: isPettyCash && effStatus === "DIBAYAR"
        ? `Pemakaian petty cash #${id} diverifikasi Finance. Saldo petty cash Anda berkurang Rp${Number(row.amount).toLocaleString("id-ID")}.`
        : `Pengeluaran #${id}: ${effStatus}${dto.reason ? ` — ${dto.reason}` : ""}`,
      href: `/expenses/${id}`,
    });
    const pendingAppr = await this.approvals.getFor("PENGELUARAN", id);
    if (pendingAppr && pendingAppr.status === "MENUNGGU") {
      if (effStatus === "DISETUJUI" || effStatus === "DIBAYAR") {
        await this.approvals.decide(pendingAppr.id, user, true, dto.reason).catch(() => {});
      } else if (dto.status === "DITOLAK") {
        await this.approvals.decide(pendingAppr.id, user, false, dto.reason).catch(() => {});
      }
    }

    // Biaya survey untuk prospek yang sudah menjadi project = biaya project (HPP project)
    if (!row.projectId && row.surveyId && (effStatus === "DISETUJUI" || effStatus === "DIBAYAR")) {
      const pid = await projectIdForSurvey(this.prisma.main, row.surveyId).catch(() => null);
      if (pid) {
        await this.prisma.main.expense.update({ where: { id }, data: { projectId: pid } });
        (row as any).projectId = pid;
      }
    }

    // Posting Akuntansi E8a / E8b: Biaya Operasional
    try {
      const mappings = await this.mappingService.getAll();
      const cat = row.categoryId
        ? await this.prisma.main.expenseCategory.findUnique({ where: { id: row.categoryId } })
        : null;
      const expenseCoa = cat?.coaAccount || undefined;
      const expCode = `EXP-${String(row.id).padStart(3, "0")}`;
      const who = updated.reporter?.name || undefined;
      const what = row.description || cat?.name || undefined;

      if (isPettyCash) {
        if (effStatus === "DIBAYAR") {
          // keperluan (survey / proyek / surat jalan) supaya buku besar Uang Muka Karyawan jelas dipakai untuk apa
          const usage = pettyCashUsage({
            survey: row.surveyId
              ? await this.prisma.main.survey.findUnique({ where: { id: row.surveyId }, select: { location: true, lead: { select: { name: true } } } })
              : null,
            project: row.projectId ? await this.prisma.main.project.findUnique({ where: { id: row.projectId }, select: { name: true } }) : null,
            deliveryNote: row.deliveryNoteId
              ? await this.prisma.main.deliveryNote.findUnique({ where: { id: row.deliveryNoteId }, select: { number: true } })
              : null,
          });
          // Dr Beban  Cr Uang Muka Karyawan (saldo petty cash berkurang) — tanpa kas keluar
          await this.postingService.post({
            sourceType: "Expense",
            sourceId: row.id,
            event: "approved",
            source: "EXPENSE",
            date: row.date,
            memo: `Pemakaian petty cash ${expCode} — ${what || "operasional"}${usage ? ` untuk ${usage}` : ""} (${who || "Karyawan"})`,
            refNo: expCode,
            projectId: row.projectId,
            createdById: user.id,
            lines: buildPettyCashSpendLines(
              {
                number: expCode,
                amount: Number(row.amount),
                employeeId: row.reporterId,
                employeeName: who,
                expenseAccountCode: expenseCoa,
                projectId: row.projectId,
                description: row.description,
                categoryName: cat?.name,
                usage,
              },
              mappings,
            ),
          });
        }
      } else if (effStatus === "DISETUJUI") {
        const aLines = PostingRules.buildExpenseApprovedLines(
          {
            id: row.id,
            number: expCode,
            amount: Number(row.amount),
            expenseAccountCode: expenseCoa,
            projectId: row.projectId,
            partyId: row.reporterId,
            description: row.description || undefined,
            reporterName: who,
            categoryName: cat?.name || undefined,
          },
          mappings,
        );
        await this.postingService.post({
          sourceType: "Expense",
          sourceId: row.id,
          event: "approved",
          source: "EXPENSE",
          date: row.date,
          memo: `Beban ${cat?.name || "Operasional"}${row.description ? `: ${row.description}` : ""} (${who || "Karyawan"})`,
          refNo: expCode,
          projectId: row.projectId,
          createdById: user.id,
          lines: aLines,
        });
      } else if (effStatus === "DIBAYAR") {
        // Jika belum ada jurnal pengakuan beban (misal langsung bypass DIBAYAR), catat dulu pengakuan bebannya
        const existingAccrual = await (this.prisma.main as any).journalEntry.findFirst({
          where: {
            sourceType: "Expense",
            sourceId: row.id,
            status: "POSTED",
            event: "approved",
          },
        });
        if (!existingAccrual) {
          const aLines = PostingRules.buildExpenseApprovedLines(
            {
              id: row.id,
              number: expCode,
              amount: Number(row.amount),
              expenseAccountCode: expenseCoa,
              projectId: row.projectId,
              partyId: row.reporterId,
              description: row.description || undefined,
              reporterName: who,
              categoryName: cat?.name || undefined,
            },
            mappings,
          );
          await this.postingService.post({
            sourceType: "Expense",
            sourceId: row.id,
            event: "approved",
            source: "EXPENSE",
            date: row.date,
            memo: `Beban ${cat?.name || "Operasional"}${row.description ? `: ${row.description}` : ""} (${who || "Karyawan"})`,
            refNo: expCode,
            projectId: row.projectId,
            createdById: user.id,
            lines: aLines,
          });
        }

        const payAccount = dto.paidAccountCode || mappings.CASH_DEFAULT || "1000.02";
        const pLines = PostingRules.buildExpensePaidLines(
          {
            id: row.id,
            number: `${expCode}/PAY`,
            amount: Number(row.amount),
            paidAccountCode: payAccount,
            projectId: row.projectId,
            partyId: row.reporterId,
            description: row.description || undefined,
            reporterName: who,
            categoryName: cat?.name || undefined,
          },
          mappings,
        );
        await this.postingService.post({
          sourceType: "Expense",
          sourceId: row.id,
          event: "paid",
          source: "EXPENSE_PAYMENT",
          date: new Date(),
          memo: `Pelunasan Biaya/Reimbursement ${expCode} kepada ${who || "Karyawan"}`,
          refNo: `${expCode}/PAY`,
          projectId: row.projectId,
          createdById: user.id,
          lines: pLines,
        });
      }
    } catch (err) {
      console.error("Posting expense error:", err);
    }

    this.notifications.dataChange("expenses", "status", updated.id);
    const [receiptFile, paidFile] = await Promise.all([
      updated.receiptFileId
        ? this.prisma.main.file.findUnique({
            where: { id: updated.receiptFileId },
            select: { id: true, originalName: true, mimeType: true, size: true },
          })
        : null,
      updated.paidFileId
        ? this.prisma.main.file.findUnique({
            where: { id: updated.paidFileId },
            select: { id: true, originalName: true, mimeType: true, size: true },
          })
        : null,
    ]);
    return { ...updated, receiptFile, paidFile };
  }

  async remove(id: number, user: RequestUser) {
    const row = await this.prisma.main.expense.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Pengeluaran tidak ditemukan");
    if (row.cashAdvanceId) {
      throw new BadRequestException("Pengeluaran ini berasal dari laporan petty cash dan dikelola lewat menu Petty Cash.");
    }
    if (row.status === "DIBAYAR") {
      throw new BadRequestException("Pengeluaran yang sudah dibayar tidak bisa dihapus (kas sudah keluar). Buat jurnal koreksi bila perlu.");
    }
    await this.prisma.main.$transaction(async (tx) => {
      // Beban yang sudah diakui (disetujui) dibalik dulu agar tidak tertinggal di buku besar
      await this.postingService.reverseAllForSource("Expense", id, "Pengeluaran dihapus", user.id, tx);
      await tx.approval.deleteMany({ where: { kind: "PENGELUARAN", entityId: id } });
      await tx.expense.delete({ where: { id } });
    });
    if (row.surveyId) {
      await this.syncSurveyCost(row.surveyId);
    }
    if (row.pocReportId) {
      await this.syncPocCost(row.pocReportId);
    }
    await this.audit.log({
      actor: user,
      action: "HAPUS_PENGELUARAN",
      entityType: "expense",
      entityId: id,
      detail: `Pengeluaran #${id} dihapus`,
    });
    this.notifications.dataChange("expenses", "delete", id);
    return { id, deleted: true };
  }

  private async onApproval(entityId: number, status: ApprovalStatus) {
    const row = await this.prisma.main.expense.findUnique({ where: { id: entityId } });
    if (!row || ["DISETUJUI", "DIBAYAR", "DITOLAK"].includes(row.status)) return;
    const next = status === "DISETUJUI" ? "DISETUJUI" : "DITOLAK";
    await this.prisma.main.expense.update({
      where: { id: entityId },
      data: { status: next, ...(next === "DITOLAK" ? { rejectReason: "Ditolak lewat persetujuan" } : {}) },
    });
    if (row.surveyId) {
      await this.syncSurveyCost(row.surveyId);
    }
    if (row.pocReportId) {
      await this.syncPocCost(row.pocReportId);
    }
    await this.notifications.notify({
      userIds: [row.reporterId],
      kind: "APPROVAL",
      text: `Pengeluaran #${entityId}: ${next.toLowerCase()}`,
      href: `/expenses/${entityId}`,
    });
    this.notifications.dataChange("expenses", "status", entityId);
  }

  /** Ringkasan untuk Finance: per project / per orang / per bulan (agregasi di DB). */
  async summary(user: RequestUser, from?: string, to?: string) {
    const role = (user.role || "").toUpperCase();
    const scope = ["SUPER_ADMIN", "FINANCE", "BOS", "ADMIN"].includes(role) ? {} : { reporterId: user.id };
    const where = {
      ...scope,
      ...(from || to ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
    };

    const [byStatus, projectGroups, personGroups, dateGroups] = await Promise.all([
      this.prisma.main.expense.groupBy({ by: ["status"], where, _sum: { amount: true } }),
      this.prisma.main.expense.groupBy({ by: ["projectId"], where, _sum: { amount: true } }),
      this.prisma.main.expense.groupBy({ by: ["reporterId"], where, _sum: { amount: true } }),
      this.prisma.main.expense.groupBy({ by: ["date"], where, _sum: { amount: true } }),
    ]);

    const projectIds = projectGroups.map((g) => g.projectId).filter((id): id is number => id != null);
    const reporterIds = personGroups.map((g) => g.reporterId);
    const [projects, reporters] = await Promise.all([
      projectIds.length
        ? this.prisma.main.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, name: true } })
        : Promise.resolve([]),
      reporterIds.length
        ? this.prisma.main.user.findMany({ where: { id: { in: reporterIds } }, select: { id: true, name: true } })
        : Promise.resolve([]),
    ]);
    const projName = new Map(projects.map((p) => [p.id, p.name]));
    const repName = new Map(reporters.map((u) => [u.id, u.name]));

    let total = 0;
    let approved = 0;
    let pending = 0;
    for (const s of byStatus) {
      const amt = Number(s._sum.amount ?? 0);
      total += amt;
      if (s.status === "DISETUJUI" || s.status === "DIBAYAR") approved += amt;
      if (s.status === "DILAPORKAN") pending += amt;
    }

    const byMonth = new Map<string, number>();
    for (const d of dateGroups) {
      const m = d.date.toISOString().slice(0, 7);
      byMonth.set(m, (byMonth.get(m) ?? 0) + Number(d._sum.amount ?? 0));
    }

    return {
      total,
      approved,
      pending,
      byProject: projectGroups.map((g) => ({
        name: g.projectId ? projName.get(g.projectId) ?? `Project #${g.projectId}` : "Tanpa project",
        amount: Number(g._sum.amount ?? 0),
      })),
      byPerson: personGroups.map((g) => ({
        name: repName.get(g.reporterId) ?? `User #${g.reporterId}`,
        amount: Number(g._sum.amount ?? 0),
      })),
      byMonth: [...byMonth].map(([month, amount]) => ({ month, amount })).sort((a, b) => a.month.localeCompare(b.month)),
    };
  }
}
