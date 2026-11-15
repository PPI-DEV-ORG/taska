import { projectIdForSurvey } from "../accounting/project-cost.rules.js";
import { syncSurveyApprovalAmount } from "../crm/survey-approval.js";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { PostingService } from "../accounting/posting.service.js";
import { MappingService } from "../accounting/mapping.service.js";
import { DocumentNumberService } from "../document-number/document-number.service.js";
import {
  buildCashAdvanceDisburseLines,
  buildCashAdvanceReturnLines,
  buildCashAdvanceSettleLines,
  pettyCashUsage,
  splitSettlement,
} from "../accounting/cash-advance.rules.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { PETTY_CASH_SOURCE, pettyCashAvailable, pettyCashWallets } from "./petty-cash-wallet.js";
import {
  ApproveCashAdvanceDto,
  CashAdvanceItemDto,
  CashAdvanceListQuery,
  CreateCashAdvanceDto,
  DisburseCashAdvanceDto,
  RejectCashAdvanceDto,
  SettleCashAdvanceDto,
  SubmitReportDto,
  TopUpPettyCashDto,
  UpdateCashAdvanceDto,
  WithdrawPettyCashDto,
} from "./cash-advances.dto.js";

const FINANCE_ROLES = ["SUPER_ADMIN", "ADMIN", "BOS", "FINANCE"];
const SOURCE = "CashAdvance";

const include = {
  employee: { select: { id: true, name: true, role: true } },
  requestedBy: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
  disbursedBy: { select: { id: true, name: true } },
  settledBy: { select: { id: true, name: true } },
  survey: { select: { id: true, location: true, scheduleAt: true, lead: { select: { id: true, name: true } } } },
  deliveryNote: { select: { id: true, number: true } },
  project: { select: { id: true, name: true } },
  disburseFile: { select: { id: true, originalName: true, mimeType: true } },
  returnFile: { select: { id: true, originalName: true, mimeType: true } },
  items: { orderBy: { date: "asc" as const }, include: { category: { select: { id: true, name: true, coaAccount: true } } } },
} as const;

const n = (v: unknown) => Number(v || 0);
const usageSuffix = (row: Parameters<typeof pettyCashUsage>[0]) => {
  const u = pettyCashUsage(row);
  return u ? ` untuk ${u}` : "";
};
const dateOnly = (s?: string) => (s ? new Date(`${s.slice(0, 10)}T00:00:00.000Z`) : new Date());

/**
 * Petty cash: karyawan mengajukan → Finance menyetujui → Finance mencairkan dari akun kas/bank (+ bukti)
 * → uang masuk saldo petty cash karyawan (Uang Muka Karyawan) → karyawan melaporkan biaya + foto nota
 * → Finance memverifikasi: biaya diakui, sisa dikembalikan / disimpan di saldo petty cash, kekurangan dibayar.
 */
@Injectable()
export class CashAdvancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly posting: PostingService,
    private readonly mapping: MappingService,
    private readonly docnum: DocumentNumberService,
  ) {}

  private isFinance(user: RequestUser) {
    return FINANCE_ROLES.includes((user.role || "").toUpperCase());
  }

  private async load(id: number) {
    const row = await this.prisma.main.cashAdvance.findUnique({ where: { id }, include });
    if (!row) throw new NotFoundException("Petty cash tidak ditemukan");
    return row;
  }

  private assertCanSee(row: { employeeId: number; requestedById: number }, user: RequestUser) {
    if (this.isFinance(user) || row.employeeId === user.id || row.requestedById === user.id) return;
    throw new ForbiddenException("Anda tidak punya akses ke petty cash ini");
  }

  /** Bentuk respons: tambah ringkasan angka agar UI tidak menghitung sendiri. */
  private shape(row: Awaited<ReturnType<CashAdvancesService["load"]>>) {
    const spent = row.items.reduce((s, it) => s + n(it.amount), 0);
    const disbursed = n(row.disbursedAmount);
    const settled = row.status === "SELESAI";
    return {
      ...row,
      amount: n(row.amount),
      approvedAmount: row.approvedAmount == null ? null : n(row.approvedAmount),
      disbursedAmount: row.disbursedAmount == null ? null : disbursed,
      spentAmount: settled ? n(row.spentAmount) : spent,
      returnedAmount: n(row.returnedAmount),
      reimbursedAmount: n(row.reimbursedAmount),
      items: row.items.map((it) => ({ ...it, amount: n(it.amount), receiptFileIds: Array.isArray(it.receiptFileIds) ? it.receiptFileIds : [] })),
      reportedTotal: spent,
      /** Sisa uang di tangan karyawan untuk dokumen ini (belum diselesaikan = dicairkan − biaya dilaporkan). */
      remaining: settled ? Math.max(0, disbursed - (n(row.spentAmount) - n(row.reimbursedAmount)) - n(row.returnedAmount)) : Math.max(0, disbursed - spent),
      shortage: Math.max(0, spent - disbursed),
    };
  }

  /** Nilai persetujuan survey mengikuti petty cash survey-nya (bukan Rp 0). */
  private async syncSurvey(cashAdvanceId: number) {
    const r = await this.prisma.main.cashAdvance.findUnique({ where: { id: cashAdvanceId }, select: { surveyId: true } }).catch(() => null);
    await syncSurveyApprovalAmount(this.prisma.main, r?.surveyId);
  }

  // ─────────────── Saldo petty cash ───────────────

  /** Saldo petty cash per karyawan = saldo Uang Muka Karyawan (uang yang masih dipegang karyawan). */
  private async walletBalances(employeeIds?: number[]) {
    return pettyCashWallets(this.prisma.main, employeeIds);
  }

  async wallet(user: RequestUser, employeeId?: number) {
    if (employeeId && employeeId !== user.id && !this.isFinance(user)) {
      throw new ForbiddenException("Hanya Finance yang boleh melihat petty cash karyawan lain");
    }
    if (!employeeId && this.isFinance(user)) {
      const all = await this.walletBalances();
      const mine = all.find((w) => w.employee.id === user.id);
      return {
        mine: mine ?? null,
        employees: all
          .filter((w) => w.balance !== 0 || w.activeCount > 0 || w.pendingSpend > 0)
          .sort((a, b) => b.balance - a.balance),
      };
    }
    const id = employeeId ?? user.id;
    const [w] = await this.walletBalances([id]);
    return { mine: w ?? null, employees: [] };
  }

  /** Mutasi saldo petty cash satu karyawan: isi saldo, petty cash tugas, pemakaian, dan pengembalian. */
  async walletHistory(user: RequestUser, employeeId?: number) {
    const id = employeeId ?? user.id;
    if (id !== user.id && !this.isFinance(user)) {
      throw new ForbiddenException("Hanya Finance yang boleh melihat petty cash karyawan lain");
    }
    const [advances, expenses] = await Promise.all([
      this.prisma.main.cashAdvance.findMany({
        where: { employeeId: id, status: { in: ["DICAIRKAN", "DILAPORKAN", "SELESAI"] } },
        select: {
          id: true, number: true, purpose: true, description: true, status: true, disbursedAt: true, settledAt: true,
          disbursedAmount: true, spentAmount: true, reimbursedAmount: true, returnedAmount: true,
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      this.prisma.main.expense.findMany({
        where: { reporterId: id, fundingSource: PETTY_CASH_SOURCE, cashAdvanceId: null, status: { not: "DITOLAK" } },
        select: { id: true, date: true, amount: true, description: true, status: true, category: { select: { name: true } }, project: { select: { name: true } } },
        orderBy: { date: "desc" },
        take: 200,
      }),
    ]);
    type Entry = { key: string; date: Date | null; kind: string; title: string; amount: number; status: string; ref: string; href?: string };
    const out: Entry[] = [];
    for (const a of advances) {
      if (a.purpose === "TARIK_SALDO") {
        out.push({ key: `ca-${a.id}`, date: a.settledAt, kind: "TARIK", title: a.description || "Pengembalian ke kas", amount: -n(a.returnedAmount), status: "Selesai", ref: a.number });
        continue;
      }
      out.push({
        key: `ca-${a.id}`,
        date: a.disbursedAt,
        kind: a.purpose === "ISI_SALDO" ? "ISI" : "TUGAS",
        title: a.description || (a.purpose === "ISI_SALDO" ? "Isi saldo petty cash" : "Petty cash"),
        amount: n(a.disbursedAmount),
        status: a.purpose === "ISI_SALDO" ? "Masuk" : a.status === "SELESAI" ? "Selesai" : "Berjalan",
        ref: a.number,
      });
      if (a.purpose !== "ISI_SALDO" && a.status === "SELESAI") {
        const used = n(a.spentAmount) - n(a.reimbursedAmount);
        if (used > 0) out.push({ key: `cas-${a.id}`, date: a.settledAt, kind: "PAKAI", title: `Biaya ${a.number}`, amount: -used, status: "Diverifikasi", ref: a.number });
        if (n(a.returnedAmount) > 0) out.push({ key: `car-${a.id}`, date: a.settledAt, kind: "TARIK", title: `Sisa ${a.number} dikembalikan`, amount: -n(a.returnedAmount), status: "Selesai", ref: a.number });
      }
    }
    for (const e of expenses) {
      out.push({
        key: `exp-${e.id}`,
        date: e.date,
        kind: "PAKAI",
        title: [e.category?.name, e.description].filter(Boolean).join(" — ") || "Pemakaian petty cash",
        amount: -n(e.amount),
        status: e.status === "DIBAYAR" ? "Diverifikasi" : "Menunggu verifikasi",
        ref: `EXP-${String(e.id).padStart(3, "0")}${e.project?.name ? ` · ${e.project.name}` : ""}`,
        href: `/expenses/${e.id}`,
      });
    }
    out.sort((a, b) => (b.date ? new Date(b.date).getTime() : 0) - (a.date ? new Date(a.date).getTime() : 0));
    const [wallet] = await this.walletBalances([id]);
    return { wallet: wallet ?? null, entries: out };
  }

  /** Validasi akun kas/bank sumber/tujuan dana. */
  private async assertCashAccount(code: string) {
    const account = await this.prisma.main.coaAccount.findUnique({ where: { code }, select: { code: true, isCash: true, isPostable: true, status: true } });
    if (!account || !account.isPostable || account.status !== "AKTIF") throw new BadRequestException("Akun kas/bank tidak valid");
    if (!account.isCash) throw new BadRequestException("Pilih akun Kas / Bank");
  }

  /**
   * Finance mengisi saldo petty cash karyawan secara langsung (seperti top-up dompet):
   *   Dr Uang Muka Karyawan (saldo petty cash karyawan)   Cr Kas / Bank
   */
  async topUp(dto: TopUpPettyCashDto, user: RequestUser) {
    if (!this.isFinance(user)) throw new ForbiddenException("Hanya Finance yang boleh mengisi saldo petty cash");
    await this.assertCashAccount(dto.accountCode);
    const employee = await this.prisma.main.user.findUnique({ where: { id: dto.employeeId }, select: { id: true, name: true } });
    if (!employee) throw new BadRequestException("Karyawan tidak ditemukan");
    const amount = Math.round(dto.amount);
    const date = dateOnly(dto.date);
    const number = await this.docnum.next("uangJalan");
    const mappings = await this.mapping.getAll();
    const description = dto.description?.trim() || `Isi saldo petty cash ${employee.name}`;
    const now = new Date();

    const row = await this.prisma.main.$transaction(async (tx) => {
      const created = await tx.cashAdvance.create({
        data: {
          number,
          purpose: "ISI_SALDO",
          description,
          employeeId: employee.id,
          requestedById: user.id,
          amount,
          status: "SELESAI",
          approvedAmount: amount,
          approvedById: user.id,
          approvedAt: now,
          disbursedAmount: amount,
          disbursedAt: date,
          disburseAccountCode: dto.accountCode,
          disburseMethod: dto.method ?? "TRANSFER",
          disburseFileId: dto.fileId ?? null,
          disbursedById: user.id,
          settledAt: now,
          settledById: user.id,
          spentAmount: 0,
          returnedAmount: 0,
          reimbursedAmount: 0,
        },
      });
      await this.posting.post(
        {
          sourceType: SOURCE,
          sourceId: created.id,
          event: "disbursed",
          source: "CASH_ADVANCE",
          date,
          memo: `Isi saldo petty cash ${number} ke ${employee.name}${dto.description?.trim() ? ` untuk ${dto.description.trim()}` : ""}`,
          refNo: number,
          createdById: user.id,
          lines: buildCashAdvanceDisburseLines(
            { number, employeeId: employee.id, employeeName: employee.name, usage: dto.description?.trim() || null, amount, cashAccountCode: dto.accountCode },
            mappings,
          ),
        },
        tx,
      );
      return created;
    });
    if (dto.fileId) {
      await this.prisma.main.file.update({ where: { id: dto.fileId }, data: { refType: "cash-advance", refId: String(row.id) } }).catch(() => {});
    }
    await this.audit.log({ actor: user, action: "ISI_SALDO_PETTY_CASH", entityType: "cash-advance", entityId: row.id, detail: `${number} Rp${amount} ke ${employee.name} dari ${dto.accountCode}` });
    await this.notifications
      .notify({
        userIds: [employee.id],
        kind: "APPROVAL",
        title: "Saldo Petty Cash Bertambah",
        text: `Saldo petty cash Anda bertambah Rp${amount.toLocaleString("id-ID")} dari Finance. Catat setiap pemakaian + foto nota di menu Petty Cash.`,
        href: "/cash-advances",
      })
      .catch(() => {});
    this.notifications.dataChange("cash-advances", "create", row.id);
    await this.syncSurvey(row.id);
    return this.get(row.id, user);
  }

  /**
   * Sisa saldo petty cash dikembalikan karyawan ke kas:
   *   Dr Kas / Bank   Cr Uang Muka Karyawan
   */
  async withdraw(dto: WithdrawPettyCashDto, user: RequestUser) {
    if (!this.isFinance(user)) throw new ForbiddenException("Hanya Finance yang boleh menarik saldo petty cash");
    await this.assertCashAccount(dto.accountCode);
    const employee = await this.prisma.main.user.findUnique({ where: { id: dto.employeeId }, select: { id: true, name: true } });
    if (!employee) throw new BadRequestException("Karyawan tidak ditemukan");
    const amount = Math.round(dto.amount);
    const available = await pettyCashAvailable(this.prisma.main, employee.id);
    if (amount > available) {
      throw new BadRequestException(`Saldo petty cash ${employee.name} yang tersedia hanya Rp${available.toLocaleString("id-ID")}`);
    }
    const date = dateOnly(dto.date);
    const number = await this.docnum.next("uangJalan");
    const mappings = await this.mapping.getAll();
    const description = dto.description?.trim() || `Pengembalian saldo petty cash ${employee.name}`;
    const now = new Date();

    const row = await this.prisma.main.$transaction(async (tx) => {
      const created = await tx.cashAdvance.create({
        data: {
          number,
          purpose: "TARIK_SALDO",
          description,
          employeeId: employee.id,
          requestedById: user.id,
          amount,
          status: "SELESAI",
          approvedAmount: amount,
          approvedById: user.id,
          approvedAt: now,
          disbursedAmount: 0,
          disbursedById: user.id,
          settledAt: now,
          settledById: user.id,
          spentAmount: 0,
          reimbursedAmount: 0,
          returnedAmount: amount,
          returnAccountCode: dto.accountCode,
          returnFileId: dto.fileId ?? null,
        },
      });
      await this.posting.post(
        {
          sourceType: SOURCE,
          sourceId: created.id,
          event: "returned",
          source: "CASH_ADVANCE",
          date,
          memo: `Pengembalian saldo petty cash ${number} dari ${employee.name}${dto.description?.trim() ? ` (${dto.description.trim()})` : ""}`,
          refNo: number,
          createdById: user.id,
          lines: buildCashAdvanceReturnLines(
            { number, employeeId: employee.id, employeeName: employee.name, usage: dto.description?.trim() || null, amount, cashAccountCode: dto.accountCode },
            mappings,
          ),
        },
        tx,
      );
      return created;
    });
    if (dto.fileId) {
      await this.prisma.main.file.update({ where: { id: dto.fileId }, data: { refType: "cash-advance", refId: String(row.id) } }).catch(() => {});
    }
    await this.audit.log({ actor: user, action: "TARIK_SALDO_PETTY_CASH", entityType: "cash-advance", entityId: row.id, detail: `${number} Rp${amount} dari ${employee.name} ke ${dto.accountCode}` });
    await this.notifications
      .notify({
        userIds: [employee.id],
        kind: "APPROVAL",
        title: "Saldo Petty Cash Dikembalikan",
        text: `Rp${amount.toLocaleString("id-ID")} dari saldo petty cash Anda sudah dicatat kembali ke kas perusahaan.`,
        href: "/cash-advances",
      })
      .catch(() => {});
    this.notifications.dataChange("cash-advances", "create", row.id);
    await this.syncSurvey(row.id);
    return this.get(row.id, user);
  }

  // ─────────────── Daftar & detail ───────────────

  async list(q: CashAdvanceListQuery, user: RequestUser) {
    const mineOnly = q.mine === "1" || !this.isFinance(user);
    const rows = await this.prisma.main.cashAdvance.findMany({
      where: {
        ...(mineOnly ? { OR: [{ employeeId: user.id }, { requestedById: user.id }] } : {}),
        ...(q.status ? { status: q.status } : {}),
        ...(q.employeeId ? { employeeId: q.employeeId } : {}),
        ...(q.surveyId ? { surveyId: q.surveyId } : {}),
        ...(q.deliveryNoteId ? { deliveryNoteId: q.deliveryNoteId } : {}),
        ...(q.projectId ? { projectId: q.projectId } : {}),
      },
      include,
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    return { items: rows.map((r) => this.shape(r)), total: rows.length };
  }

  async get(id: number, user: RequestUser) {
    const row = await this.load(id);
    this.assertCanSee(row, user);
    return this.shape(row);
  }

  // ─────────────── Pengajuan ───────────────

  async create(dto: CreateCashAdvanceDto, user: RequestUser) {
    const employeeId = dto.employeeId ?? user.id;
    const employee = await this.prisma.main.user.findUnique({ where: { id: employeeId }, select: { id: true, name: true, status: true } });
    if (!employee) throw new BadRequestException("Karyawan penerima petty cash tidak ditemukan");

    let projectId = dto.projectId ?? null;
    // Kas proyek: satu petty cash = satu project, supaya biayanya masuk P&L project yang benar.
    if (dto.purpose === "PROJECT" && !projectId) {
      throw new BadRequestException("Pilih project untuk petty cash / kas proyek ini");
    }
    if (projectId) {
      const pj = await this.prisma.main.project.findUnique({ where: { id: projectId }, select: { id: true } });
      if (!pj) throw new BadRequestException("Project tidak ditemukan");
    }
    if (dto.surveyId) {
      const sv = await this.prisma.main.survey.findUnique({ where: { id: dto.surveyId }, select: { id: true } });
      if (!sv) throw new BadRequestException("Survey tidak ditemukan");
    }
    if (dto.deliveryNoteId) {
      const dn = await this.prisma.main.deliveryNote.findUnique({
        where: { id: dto.deliveryNoteId },
        select: { id: true, locations: { select: { projectId: true }, take: 1 } },
      });
      if (!dn) throw new BadRequestException("Surat jalan tidak ditemukan");
      projectId = projectId ?? dn.locations[0]?.projectId ?? null;
    }

    const number = await this.docnum.next("uangJalan");
    const row = await this.prisma.main.cashAdvance.create({
      data: {
        number,
        purpose: dto.purpose,
        description: dto.description.trim(),
        amount: dto.amount,
        employeeId,
        requestedById: user.id,
        surveyId: dto.surveyId ?? null,
        deliveryNoteId: dto.deliveryNoteId ?? null,
        projectId,
        neededDate: dto.neededDate ? dateOnly(dto.neededDate) : null,
      },
      include,
    });

    await this.audit.log({ actor: user, action: "AJUKAN_UANG_JALAN", entityType: "cash-advance", entityId: row.id, detail: `${number} Rp${dto.amount} — ${employee.name}` });
    await this.notifications
      .notify({
        roles: ["FINANCE"],
        kind: "APPROVAL",
        title: "Pengajuan Petty Cash",
        text: `${user.name} mengajukan petty cash ${number} Rp${Number(dto.amount).toLocaleString("id-ID")} untuk ${employee.name}`,
        href: `/cash-advances?id=${row.id}`,
      })
      .catch(() => {});
    this.notifications.dataChange("cash-advances", "create", row.id);
    await this.syncSurvey(row.id);
    return this.shape(row);
  }

  async update(id: number, dto: UpdateCashAdvanceDto, user: RequestUser) {
    const row = await this.load(id);
    if (row.status !== "DIAJUKAN") throw new BadRequestException("Hanya pengajuan yang belum diproses yang bisa diubah");
    if (row.requestedById !== user.id && !this.isFinance(user)) throw new ForbiddenException("Hanya pengaju atau Finance yang boleh mengubah");
    await this.prisma.main.cashAdvance.update({
      where: { id },
      data: {
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.employeeId !== undefined ? { employeeId: dto.employeeId } : {}),
        ...(dto.neededDate !== undefined ? { neededDate: dto.neededDate ? dateOnly(dto.neededDate) : null } : {}),
      },
    });
    this.notifications.dataChange("cash-advances", "update", id);
    await this.syncSurvey(id);
    return this.get(id, user);
  }

  async cancel(id: number, user: RequestUser) {
    const row = await this.load(id);
    if (!["DIAJUKAN", "DISETUJUI"].includes(row.status)) throw new BadRequestException("Petty cash yang sudah dicairkan tidak bisa dibatalkan");
    if (row.requestedById !== user.id && !this.isFinance(user)) throw new ForbiddenException("Hanya pengaju atau Finance yang boleh membatalkan");
    await this.prisma.main.cashAdvance.update({ where: { id }, data: { status: "DIBATALKAN" } });
    await this.audit.log({ actor: user, action: "BATAL_UANG_JALAN", entityType: "cash-advance", entityId: id, detail: row.number });
    this.notifications.dataChange("cash-advances", "status", id);
    await this.syncSurvey(id);
    return this.get(id, user);
  }

  // ─────────────── Persetujuan (Finance) ───────────────

  async approve(id: number, dto: ApproveCashAdvanceDto, user: RequestUser) {
    const row = await this.load(id);
    if (row.status !== "DIAJUKAN") throw new BadRequestException(`Petty cash berstatus ${row.status}, tidak bisa disetujui`);
    const approvedAmount = dto.approvedAmount ?? n(row.amount);
    await this.prisma.main.cashAdvance.update({
      where: { id },
      data: { status: "DISETUJUI", approvedAmount, approvedById: user.id, approvedAt: new Date(), rejectReason: null },
    });
    await this.audit.log({ actor: user, action: "SETUJUI_UANG_JALAN", entityType: "cash-advance", entityId: id, detail: `${row.number} Rp${approvedAmount}` });
    await this.notifications
      .notify({
        userIds: [...new Set([row.employeeId, row.requestedById])],
        kind: "APPROVAL",
        title: "Petty Cash Disetujui",
        text: `Petty cash ${row.number} disetujui Rp${approvedAmount.toLocaleString("id-ID")}. Menunggu pencairan dari Finance.`,
        href: `/cash-advances?id=${id}`,
      })
      .catch(() => {});
    this.notifications.dataChange("cash-advances", "status", id);
    await this.syncSurvey(id);
    return this.get(id, user);
  }

  async reject(id: number, dto: RejectCashAdvanceDto, user: RequestUser) {
    const row = await this.load(id);
    if (!["DIAJUKAN", "DISETUJUI"].includes(row.status)) throw new BadRequestException("Petty cash yang sudah dicairkan tidak bisa ditolak");
    await this.prisma.main.cashAdvance.update({ where: { id }, data: { status: "DITOLAK", rejectReason: dto.reason.trim() } });
    await this.audit.log({ actor: user, action: "TOLAK_UANG_JALAN", entityType: "cash-advance", entityId: id, detail: `${row.number}: ${dto.reason}` });
    await this.notifications
      .notify({
        userIds: [...new Set([row.employeeId, row.requestedById])],
        kind: "APPROVAL",
        title: "Petty Cash Ditolak",
        text: `Petty cash ${row.number} ditolak: ${dto.reason}`,
        href: `/cash-advances?id=${id}`,
      })
      .catch(() => {});
    this.notifications.dataChange("cash-advances", "status", id);
    await this.syncSurvey(id);
    return this.get(id, user);
  }

  // ─────────────── Pencairan (Finance) ───────────────

  async disburse(id: number, dto: DisburseCashAdvanceDto, user: RequestUser) {
    const row = await this.load(id);
    if (row.status !== "DISETUJUI") throw new BadRequestException("Petty cash harus disetujui dulu sebelum dicairkan");
    const amount = dto.amount ?? n(row.approvedAmount ?? row.amount);
    if (!(amount > 0)) throw new BadRequestException("Nominal pencairan harus lebih dari 0");
    const account = await this.prisma.main.coaAccount.findUnique({ where: { code: dto.accountCode }, select: { code: true, isCash: true, isPostable: true, status: true } });
    if (!account || !account.isPostable || account.status !== "AKTIF") throw new BadRequestException("Akun kas/bank sumber dana tidak valid");
    if (!account.isCash) throw new BadRequestException("Sumber dana harus akun Kas / Bank");

    const employeeId = dto.employeeId ?? row.employeeId;
    const employee = await this.prisma.main.user.findUnique({ where: { id: employeeId }, select: { id: true, name: true } });
    if (!employee) throw new BadRequestException("Karyawan penerima tidak ditemukan");
    const date = dateOnly(dto.date);
    const mappings = await this.mapping.getAll();

    await this.prisma.main.$transaction(async (tx) => {
      // Klaim status secara atomik agar dua klik / dua perangkat tidak mencairkan dua kali.
      const claimed = await tx.cashAdvance.updateMany({
        where: { id, status: "DISETUJUI" },
        data: {
          status: "DICAIRKAN",
          disbursedAmount: amount,
          disbursedAt: date,
          disburseAccountCode: dto.accountCode,
          disburseMethod: dto.method ?? "TRANSFER",
          disburseFileId: dto.fileId ?? null,
          disbursedById: user.id,
          employeeId,
        },
      });
      if (claimed.count === 0) throw new BadRequestException("Petty cash sudah dicairkan");
      await this.posting.post(
        {
          sourceType: SOURCE,
          sourceId: id,
          event: "disbursed",
          source: "CASH_ADVANCE",
          date,
          memo: `Pencairan petty cash ${row.number}${usageSuffix(row)} ke ${employee.name}`,
          refNo: row.number,
          projectId: row.projectId,
          createdById: user.id,
          lines: buildCashAdvanceDisburseLines(
            { number: row.number, employeeId, employeeName: employee.name, projectId: row.projectId, usage: pettyCashUsage(row), amount, cashAccountCode: dto.accountCode },
            mappings,
          ),
        },
        tx,
      );
    });
    if (dto.fileId) {
      await this.prisma.main.file.update({ where: { id: dto.fileId }, data: { refType: "cash-advance", refId: String(id) } }).catch(() => {});
    }
    await this.audit.log({ actor: user, action: "CAIRKAN_UANG_JALAN", entityType: "cash-advance", entityId: id, detail: `${row.number} Rp${amount} dari ${dto.accountCode} ke ${employee.name}` });
    await this.notifications
      .notify({
        userIds: [employeeId],
        kind: "APPROVAL",
        title: "Petty Cash Sudah Dicairkan",
        text: `Petty cash ${row.number} Rp${amount.toLocaleString("id-ID")} sudah diberikan. Simpan nota & laporkan biayanya setelah selesai.`,
        href: `/cash-advances?id=${id}`,
      })
      .catch(() => {});
    this.notifications.dataChange("cash-advances", "status", id);
    await this.syncSurvey(id);
    return this.get(id, user);
  }

  // ─────────────── Laporan biaya (karyawan) ───────────────

  private assertHolder(row: { employeeId: number }, user: RequestUser) {
    if (row.employeeId !== user.id && !this.isFinance(user)) throw new ForbiddenException("Hanya pemegang petty cash atau Finance yang boleh melaporkan biaya");
  }

  async addItem(id: number, dto: CashAdvanceItemDto, user: RequestUser) {
    const row = await this.load(id);
    this.assertHolder(row, user);
    if (!["DICAIRKAN", "DILAPORKAN"].includes(row.status)) throw new BadRequestException("Biaya hanya bisa dilaporkan setelah petty cash dicairkan dan sebelum diverifikasi");
    const item = await this.prisma.main.cashAdvanceItem.create({
      data: {
        cashAdvanceId: id,
        date: dateOnly(dto.date),
        description: dto.description.trim(),
        amount: dto.amount,
        categoryId: dto.categoryId ?? null,
        receiptFileIds: dto.receiptFileIds?.length ? dto.receiptFileIds : undefined,
      },
    });
    if (dto.receiptFileIds?.length) {
      await this.prisma.main.file
        .updateMany({ where: { id: { in: dto.receiptFileIds } }, data: { refType: "cash-advance-item", refId: String(item.id) } })
        .catch(() => {});
    }
    this.notifications.dataChange("cash-advances", "update", id);
    await this.syncSurvey(id);
    return this.get(id, user);
  }

  async removeItem(id: number, itemId: number, user: RequestUser) {
    const row = await this.load(id);
    this.assertHolder(row, user);
    if (!["DICAIRKAN", "DILAPORKAN"].includes(row.status)) throw new BadRequestException("Laporan yang sudah diverifikasi tidak bisa diubah");
    const res = await this.prisma.main.cashAdvanceItem.deleteMany({ where: { id: itemId, cashAdvanceId: id } });
    if (res.count === 0) throw new NotFoundException("Rincian biaya tidak ditemukan");
    this.notifications.dataChange("cash-advances", "update", id);
    await this.syncSurvey(id);
    return this.get(id, user);
  }

  async submitReport(id: number, dto: SubmitReportDto, user: RequestUser) {
    const row = await this.load(id);
    this.assertHolder(row, user);
    if (row.status !== "DICAIRKAN" && row.status !== "DILAPORKAN") throw new BadRequestException("Petty cash belum dicairkan / sudah diverifikasi");
    const missingReceipt = row.items.filter((it) => !Array.isArray(it.receiptFileIds) || it.receiptFileIds.length === 0);
    if (row.items.length > 0 && missingReceipt.length === row.items.length) {
      throw new BadRequestException("Lampirkan minimal satu foto nota / bukti biaya");
    }
    await this.prisma.main.cashAdvance.update({
      where: { id },
      data: { status: "DILAPORKAN", reportedAt: new Date(), reportNote: dto.note?.trim() || null },
    });
    const spent = row.items.reduce((s, it) => s + n(it.amount), 0);
    await this.audit.log({ actor: user, action: "LAPOR_UANG_JALAN", entityType: "cash-advance", entityId: id, detail: `${row.number} biaya Rp${spent}` });
    await this.notifications
      .notify({
        roles: ["FINANCE"],
        kind: "APPROVAL",
        title: "Laporan Petty Cash",
        text: `${row.employee.name} melaporkan biaya petty cash ${row.number}: Rp${spent.toLocaleString("id-ID")} dari Rp${n(row.disbursedAmount).toLocaleString("id-ID")}`,
        href: `/cash-advances?id=${id}`,
      })
      .catch(() => {});
    this.notifications.dataChange("cash-advances", "status", id);
    await this.syncSurvey(id);
    return this.get(id, user);
  }

  // ─────────────── Verifikasi & penyelesaian (Finance) ───────────────

  async settle(id: number, dto: SettleCashAdvanceDto, user: RequestUser) {
    const row = await this.load(id);
    if (row.status !== "DILAPORKAN") throw new BadRequestException("Hanya laporan petty cash yang sudah dikirim karyawan yang bisa diverifikasi");
    const spent = row.items.reduce((s, it) => s + n(it.amount), 0);
    const disbursed = n(row.disbursedAmount);
    const leftoverAction = dto.leftoverAction ?? "RETURN";
    const shortageFrom = dto.shortageFrom ?? "CASH";

    const wallet = (await this.walletBalances([row.employeeId]))[0];
    // Saldo petty cash DI LUAR dokumen ini (dokumen ini masih tercatat penuh sebagai saldo)
    // dikurangi biaya lain yang sudah dicatat tapi belum diverifikasi (supaya uang yang sama tidak terpakai dua kali)
    const walletBefore = Math.max(
      0,
      (wallet?.balance ?? 0) - disbursed - ((wallet?.pendingReport ?? 0) - spent) - (wallet?.pendingSpend ?? 0),
    );
    const split = splitSettlement({ spent, disbursed, leftoverAction, shortageFrom, walletBalanceBefore: walletBefore });

    if (split.returned > 0 && !dto.returnAccountCode) throw new BadRequestException("Pilih akun kas/bank tujuan pengembalian sisa petty cash");
    if (split.reimbursed > 0 && !dto.reimburseAccountCode) throw new BadRequestException("Pilih akun kas/bank untuk membayar kekurangan biaya ke karyawan");

    const mappings = await this.mapping.getAll();
    const settledAt = new Date();
    // Biaya survey untuk prospek yang sudah menjadi project = biaya project (HPP project)
    const costProjectId = row.projectId ?? (await projectIdForSurvey(this.prisma.main, row.surveyId).catch(() => null));

    await this.prisma.main.$transaction(async (tx) => {
      const claimed = await tx.cashAdvance.updateMany({
        where: { id, status: "DILAPORKAN" },
        data: {
          status: "SELESAI",
          settledAt,
          settledById: user.id,
          spentAmount: spent,
          returnedAmount: split.returned,
          returnAccountCode: split.returned > 0 ? dto.returnAccountCode : null,
          returnFileId: split.returned > 0 ? dto.returnFileId ?? null : null,
          reimbursedAmount: split.reimbursed,
        },
      });
      if (claimed.count === 0) throw new BadRequestException("Petty cash sudah diverifikasi");

      if (spent > 0) {
        await this.posting.post(
          {
            sourceType: SOURCE,
            sourceId: id,
            event: "settled",
            source: "CASH_ADVANCE",
            date: settledAt,
            memo: `Pertanggungjawaban petty cash ${row.number}${usageSuffix(row)} (${row.employee.name})`,
            refNo: row.number,
            projectId: costProjectId,
            createdById: user.id,
            lines: buildCashAdvanceSettleLines(
              {
                number: row.number,
                employeeId: row.employeeId,
                employeeName: row.employee.name,
                projectId: costProjectId,
                usage: pettyCashUsage(row),
                expenses: row.items.map((it) => ({
                  accountCode: it.category?.coaAccount,
                  amount: n(it.amount),
                  description: it.description,
                  projectId: costProjectId,
                })),
                coveredByAdvance: split.coveredByAdvance,
                reimbursed: split.reimbursed,
                reimburseAccountCode: dto.reimburseAccountCode,
              },
              mappings,
            ),
          },
          tx,
        );
      }
      if (split.returned > 0) {
        await this.posting.post(
          {
            sourceType: SOURCE,
            sourceId: id,
            event: "returned",
            source: "CASH_ADVANCE",
            date: settledAt,
            memo: `Pengembalian sisa petty cash ${row.number}${usageSuffix(row)} (${row.employee.name})`,
            refNo: row.number,
            projectId: costProjectId,
            createdById: user.id,
            lines: buildCashAdvanceReturnLines(
              { number: row.number, employeeId: row.employeeId, employeeName: row.employee.name, projectId: costProjectId, usage: pettyCashUsage(row), amount: split.returned, cashAccountCode: dto.returnAccountCode! },
              mappings,
            ),
          },
          tx,
        );
      }

      // Biaya juga dicatat sebagai Pengeluaran (status Dibayar, sumber Petty Cash) agar muncul di
      // biaya survey / surat jalan / project & laporan pengeluaran. Jurnalnya sudah dibuat di atas.
      for (const it of row.items) {
        const files = Array.isArray(it.receiptFileIds) ? (it.receiptFileIds as number[]) : [];
        await tx.expense.create({
          data: {
            date: it.date,
            reporterId: row.employeeId,
            categoryId: it.categoryId,
            amount: it.amount,
            description: `${it.description} (petty cash ${row.number})`,
            status: "DIBAYAR",
            projectId: costProjectId,
            surveyId: row.surveyId,
            deliveryNoteId: row.deliveryNoteId,
            receiptFileId: files[0] ?? null,
            receiptFileIds: files.length ? files.join(",") : null,
            fundingSource: "UANG_JALAN",
            paidAt: settledAt,
            paidById: user.id,
            paidAmount: it.amount,
            approvedAmount: it.amount,
            cashAdvanceId: id,
          },
        });
      }
    });

    if (dto.returnFileId && split.returned > 0) {
      await this.prisma.main.file.update({ where: { id: dto.returnFileId }, data: { refType: "cash-advance", refId: String(id) } }).catch(() => {});
    }
    await this.audit.log({
      actor: user,
      action: "SELESAI_UANG_JALAN",
      entityType: "cash-advance",
      entityId: id,
      detail: `${row.number}: biaya Rp${spent}, kembali Rp${split.returned}, kekurangan dibayar Rp${split.reimbursed}${split.keptInWallet > 0 ? `, disimpan di saldo petty cash Rp${split.keptInWallet}` : ""}`,
    });
    await this.notifications
      .notify({
        userIds: [row.employeeId],
        kind: "APPROVAL",
        title: "Laporan Petty Cash Diverifikasi",
        text: `Laporan petty cash ${row.number} sudah diverifikasi Finance.${split.keptInWallet > 0 ? ` Sisa Rp${split.keptInWallet.toLocaleString("id-ID")} tetap di saldo petty cash Anda.` : ""}`,
        href: `/cash-advances?id=${id}`,
      })
      .catch(() => {});
    this.notifications.dataChange("cash-advances", "status", id);
    await this.syncSurvey(id);
    this.notifications.dataChange("expenses", "create");
    return this.get(id, user);
  }
}
