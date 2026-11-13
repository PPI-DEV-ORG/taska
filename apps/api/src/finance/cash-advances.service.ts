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
  splitSettlement,
} from "../accounting/cash-advance.rules.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import {
  ApproveCashAdvanceDto,
  CashAdvanceItemDto,
  CashAdvanceListQuery,
  CreateCashAdvanceDto,
  DisburseCashAdvanceDto,
  RejectCashAdvanceDto,
  SettleCashAdvanceDto,
  SubmitReportDto,
  UpdateCashAdvanceDto,
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
const dateOnly = (s?: string) => (s ? new Date(`${s.slice(0, 10)}T00:00:00.000Z`) : new Date());

/**
 * Uang jalan: karyawan mengajukan → Finance menyetujui → Finance mencairkan dari akun kas/bank (+ bukti)
 * → uang masuk "kantong" karyawan (Uang Muka Karyawan) → karyawan melaporkan biaya + foto nota
 * → Finance memverifikasi: biaya diakui, sisa dikembalikan / disimpan di kantong, kekurangan dibayar.
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
    if (!row) throw new NotFoundException("Uang jalan tidak ditemukan");
    return row;
  }

  private assertCanSee(row: { employeeId: number; requestedById: number }, user: RequestUser) {
    if (this.isFinance(user) || row.employeeId === user.id || row.requestedById === user.id) return;
    throw new ForbiddenException("Anda tidak punya akses ke uang jalan ini");
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

  // ─────────────── Kantong (saldo uang jalan) ───────────────

  /** Saldo kantong per karyawan = saldo Uang Muka Karyawan (uang yang masih dipegang karyawan). */
  private async walletBalances(employeeIds?: number[]) {
    const rows = await this.prisma.main.cashAdvance.findMany({
      where: {
        status: { in: ["DICAIRKAN", "DILAPORKAN", "SELESAI"] },
        ...(employeeIds ? { employeeId: { in: employeeIds } } : {}),
      },
      select: {
        employeeId: true,
        status: true,
        disbursedAmount: true,
        spentAmount: true,
        reimbursedAmount: true,
        returnedAmount: true,
        employee: { select: { id: true, name: true, role: true } },
        items: { select: { amount: true } },
      },
    });
    const map = new Map<number, { employee: { id: number; name: string; role: string }; balance: number; pendingReport: number; activeCount: number }>();
    for (const r of rows) {
      const w = map.get(r.employeeId) ?? { employee: r.employee as any, balance: 0, pendingReport: 0, activeCount: 0 };
      const disbursed = n(r.disbursedAmount);
      if (r.status === "SELESAI") {
        w.balance += disbursed - (n(r.spentAmount) - n(r.reimbursedAmount)) - n(r.returnedAmount);
      } else {
        w.balance += disbursed;
        w.pendingReport += r.items.reduce((s, it) => s + n(it.amount), 0);
        w.activeCount += 1;
      }
      map.set(r.employeeId, w);
    }
    return [...map.values()].map((w) => ({
      ...w,
      balance: Math.round(w.balance),
      pendingReport: Math.round(w.pendingReport),
      /** Saldo yang belum dipakai menurut laporan biaya yang sudah diinput. */
      available: Math.round(w.balance - w.pendingReport),
    }));
  }

  async wallet(user: RequestUser, employeeId?: number) {
    if (employeeId && employeeId !== user.id && !this.isFinance(user)) {
      throw new ForbiddenException("Hanya Finance yang boleh melihat kantong karyawan lain");
    }
    if (!employeeId && this.isFinance(user)) {
      const all = await this.walletBalances();
      const mine = all.find((w) => w.employee.id === user.id);
      return { mine: mine ?? null, employees: all.filter((w) => w.balance !== 0 || w.activeCount > 0).sort((a, b) => b.balance - a.balance) };
    }
    const id = employeeId ?? user.id;
    const [w] = await this.walletBalances([id]);
    return { mine: w ?? null, employees: [] };
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
    if (!employee) throw new BadRequestException("Karyawan penerima uang jalan tidak ditemukan");

    let projectId = dto.projectId ?? null;
    // Kas proyek: satu uang jalan = satu project, supaya biayanya masuk P&L project yang benar.
    if (dto.purpose === "PROJECT" && !projectId) {
      throw new BadRequestException("Pilih project untuk uang jalan / kas proyek ini");
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
        title: "Pengajuan Uang Jalan",
        text: `${user.name} mengajukan uang jalan ${number} Rp${Number(dto.amount).toLocaleString("id-ID")} untuk ${employee.name}`,
        href: `/cash-advances?id=${row.id}`,
      })
      .catch(() => {});
    this.notifications.dataChange("cash-advances", "create", row.id);
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
    return this.get(id, user);
  }

  async cancel(id: number, user: RequestUser) {
    const row = await this.load(id);
    if (!["DIAJUKAN", "DISETUJUI"].includes(row.status)) throw new BadRequestException("Uang jalan yang sudah dicairkan tidak bisa dibatalkan");
    if (row.requestedById !== user.id && !this.isFinance(user)) throw new ForbiddenException("Hanya pengaju atau Finance yang boleh membatalkan");
    await this.prisma.main.cashAdvance.update({ where: { id }, data: { status: "DIBATALKAN" } });
    await this.audit.log({ actor: user, action: "BATAL_UANG_JALAN", entityType: "cash-advance", entityId: id, detail: row.number });
    this.notifications.dataChange("cash-advances", "status", id);
    return this.get(id, user);
  }

  // ─────────────── Persetujuan (Finance) ───────────────

  async approve(id: number, dto: ApproveCashAdvanceDto, user: RequestUser) {
    const row = await this.load(id);
    if (row.status !== "DIAJUKAN") throw new BadRequestException(`Uang jalan berstatus ${row.status}, tidak bisa disetujui`);
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
        title: "Uang Jalan Disetujui",
        text: `Uang jalan ${row.number} disetujui Rp${approvedAmount.toLocaleString("id-ID")}. Menunggu pencairan dari Finance.`,
        href: `/cash-advances?id=${id}`,
      })
      .catch(() => {});
    this.notifications.dataChange("cash-advances", "status", id);
    return this.get(id, user);
  }

  async reject(id: number, dto: RejectCashAdvanceDto, user: RequestUser) {
    const row = await this.load(id);
    if (!["DIAJUKAN", "DISETUJUI"].includes(row.status)) throw new BadRequestException("Uang jalan yang sudah dicairkan tidak bisa ditolak");
    await this.prisma.main.cashAdvance.update({ where: { id }, data: { status: "DITOLAK", rejectReason: dto.reason.trim() } });
    await this.audit.log({ actor: user, action: "TOLAK_UANG_JALAN", entityType: "cash-advance", entityId: id, detail: `${row.number}: ${dto.reason}` });
    await this.notifications
      .notify({
        userIds: [...new Set([row.employeeId, row.requestedById])],
        kind: "APPROVAL",
        title: "Uang Jalan Ditolak",
        text: `Uang jalan ${row.number} ditolak: ${dto.reason}`,
        href: `/cash-advances?id=${id}`,
      })
      .catch(() => {});
    this.notifications.dataChange("cash-advances", "status", id);
    return this.get(id, user);
  }

  // ─────────────── Pencairan (Finance) ───────────────

  async disburse(id: number, dto: DisburseCashAdvanceDto, user: RequestUser) {
    const row = await this.load(id);
    if (row.status !== "DISETUJUI") throw new BadRequestException("Uang jalan harus disetujui dulu sebelum dicairkan");
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
      if (claimed.count === 0) throw new BadRequestException("Uang jalan sudah dicairkan");
      await this.posting.post(
        {
          sourceType: SOURCE,
          sourceId: id,
          event: "disbursed",
          source: "CASH_ADVANCE",
          date,
          memo: `Pencairan uang jalan ${row.number} ke ${employee.name}`,
          refNo: row.number,
          projectId: row.projectId,
          createdById: user.id,
          lines: buildCashAdvanceDisburseLines(
            { number: row.number, employeeId, employeeName: employee.name, projectId: row.projectId, amount, cashAccountCode: dto.accountCode },
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
        title: "Uang Jalan Sudah Dicairkan",
        text: `Uang jalan ${row.number} Rp${amount.toLocaleString("id-ID")} sudah diberikan. Simpan nota & laporkan biayanya setelah selesai.`,
        href: `/cash-advances?id=${id}`,
      })
      .catch(() => {});
    this.notifications.dataChange("cash-advances", "status", id);
    return this.get(id, user);
  }

  // ─────────────── Laporan biaya (karyawan) ───────────────

  private assertHolder(row: { employeeId: number }, user: RequestUser) {
    if (row.employeeId !== user.id && !this.isFinance(user)) throw new ForbiddenException("Hanya pemegang uang jalan atau Finance yang boleh melaporkan biaya");
  }

  async addItem(id: number, dto: CashAdvanceItemDto, user: RequestUser) {
    const row = await this.load(id);
    this.assertHolder(row, user);
    if (!["DICAIRKAN", "DILAPORKAN"].includes(row.status)) throw new BadRequestException("Biaya hanya bisa dilaporkan setelah uang jalan dicairkan dan sebelum diverifikasi");
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
    return this.get(id, user);
  }

  async removeItem(id: number, itemId: number, user: RequestUser) {
    const row = await this.load(id);
    this.assertHolder(row, user);
    if (!["DICAIRKAN", "DILAPORKAN"].includes(row.status)) throw new BadRequestException("Laporan yang sudah diverifikasi tidak bisa diubah");
    const res = await this.prisma.main.cashAdvanceItem.deleteMany({ where: { id: itemId, cashAdvanceId: id } });
    if (res.count === 0) throw new NotFoundException("Rincian biaya tidak ditemukan");
    this.notifications.dataChange("cash-advances", "update", id);
    return this.get(id, user);
  }

  async submitReport(id: number, dto: SubmitReportDto, user: RequestUser) {
    const row = await this.load(id);
    this.assertHolder(row, user);
    if (row.status !== "DICAIRKAN" && row.status !== "DILAPORKAN") throw new BadRequestException("Uang jalan belum dicairkan / sudah diverifikasi");
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
        title: "Laporan Uang Jalan",
        text: `${row.employee.name} melaporkan biaya uang jalan ${row.number}: Rp${spent.toLocaleString("id-ID")} dari Rp${n(row.disbursedAmount).toLocaleString("id-ID")}`,
        href: `/cash-advances?id=${id}`,
      })
      .catch(() => {});
    this.notifications.dataChange("cash-advances", "status", id);
    return this.get(id, user);
  }

  // ─────────────── Verifikasi & penyelesaian (Finance) ───────────────

  async settle(id: number, dto: SettleCashAdvanceDto, user: RequestUser) {
    const row = await this.load(id);
    if (row.status !== "DILAPORKAN") throw new BadRequestException("Hanya laporan uang jalan yang sudah dikirim karyawan yang bisa diverifikasi");
    const spent = row.items.reduce((s, it) => s + n(it.amount), 0);
    const disbursed = n(row.disbursedAmount);
    const leftoverAction = dto.leftoverAction ?? "RETURN";
    const shortageFrom = dto.shortageFrom ?? "CASH";

    const wallet = (await this.walletBalances([row.employeeId]))[0];
    // Saldo kantong DI LUAR uang jalan ini (uang jalan ini masih tercatat penuh sebagai saldo)
    const walletBefore = Math.max(0, (wallet?.balance ?? 0) - disbursed);
    const split = splitSettlement({ spent, disbursed, leftoverAction, shortageFrom, walletBalanceBefore: walletBefore });

    if (split.returned > 0 && !dto.returnAccountCode) throw new BadRequestException("Pilih akun kas/bank tujuan pengembalian sisa uang jalan");
    if (split.reimbursed > 0 && !dto.reimburseAccountCode) throw new BadRequestException("Pilih akun kas/bank untuk membayar kekurangan biaya ke karyawan");

    const mappings = await this.mapping.getAll();
    const settledAt = new Date();

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
      if (claimed.count === 0) throw new BadRequestException("Uang jalan sudah diverifikasi");

      if (spent > 0) {
        await this.posting.post(
          {
            sourceType: SOURCE,
            sourceId: id,
            event: "settled",
            source: "CASH_ADVANCE",
            date: settledAt,
            memo: `Pertanggungjawaban uang jalan ${row.number} (${row.employee.name})`,
            refNo: row.number,
            projectId: row.projectId,
            createdById: user.id,
            lines: buildCashAdvanceSettleLines(
              {
                number: row.number,
                employeeId: row.employeeId,
                employeeName: row.employee.name,
                projectId: row.projectId,
                expenses: row.items.map((it) => ({
                  accountCode: it.category?.coaAccount,
                  amount: n(it.amount),
                  description: it.description,
                  projectId: row.projectId,
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
            memo: `Pengembalian sisa uang jalan ${row.number} (${row.employee.name})`,
            refNo: row.number,
            projectId: row.projectId,
            createdById: user.id,
            lines: buildCashAdvanceReturnLines(
              { number: row.number, employeeId: row.employeeId, employeeName: row.employee.name, projectId: row.projectId, amount: split.returned, cashAccountCode: dto.returnAccountCode! },
              mappings,
            ),
          },
          tx,
        );
      }

      // Biaya juga dicatat sebagai Pengeluaran (status Dibayar, sumber Uang Jalan) agar muncul di
      // biaya survey / surat jalan / project & laporan pengeluaran. Jurnalnya sudah dibuat di atas.
      for (const it of row.items) {
        const files = Array.isArray(it.receiptFileIds) ? (it.receiptFileIds as number[]) : [];
        await tx.expense.create({
          data: {
            date: it.date,
            reporterId: row.employeeId,
            categoryId: it.categoryId,
            amount: it.amount,
            description: `${it.description} (uang jalan ${row.number})`,
            status: "DIBAYAR",
            projectId: row.projectId,
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
      detail: `${row.number}: biaya Rp${spent}, kembali Rp${split.returned}, kekurangan dibayar Rp${split.reimbursed}${split.keptInWallet > 0 ? `, disimpan di kantong Rp${split.keptInWallet}` : ""}`,
    });
    await this.notifications
      .notify({
        userIds: [row.employeeId],
        kind: "APPROVAL",
        title: "Laporan Uang Jalan Diverifikasi",
        text: `Laporan uang jalan ${row.number} sudah diverifikasi Finance.${split.keptInWallet > 0 ? ` Sisa Rp${split.keptInWallet.toLocaleString("id-ID")} tetap di kantong Anda.` : ""}`,
        href: `/cash-advances?id=${id}`,
      })
      .catch(() => {});
    this.notifications.dataChange("cash-advances", "status", id);
    this.notifications.dataChange("expenses", "create");
    return this.get(id, user);
  }
}
