import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { ApprovalsService } from "../approvals/approvals.service.js";
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
  ) {
    this.approvals.onChange("PENGELUARAN", (entityId, status) => this.onApproval(entityId, status));
  }

  private async where(
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
    const scope = ["FINANCE", "BOS", "ADMIN"].includes(user.role) ? {} : { reporterId: user.id };
    return {
      ...scope,
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.reporterId ? { reporterId: q.reporterId } : {}),
      ...(q.projectId ? { projectId: q.projectId } : {}),
      ...(q.surveyId ? { surveyId: q.surveyId } : {}),
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
          survey: { select: { id: true, location: true } },
          deliveryNote: { select: { id: true, number: true } },
        },
        orderBy: orderBy(q.sort, q.dir, ["date", "createdAt"], "date"),
        ...pageSkip(q),
      }),
      this.prisma.main.expense.count({ where }),
    ]);
    return paginate(items, total, q);
  }

  async get(id: number) {
    const row = await this.prisma.main.expense.findUnique({
      where: { id },
      include: {
        reporter: { select: { id: true, name: true, role: true } },
        category: true,
        costCenter: true,
        project: { select: { id: true, name: true } },
        survey: { select: { id: true, location: true } },
        deliveryNote: { select: { id: true, number: true } },
      },
    });
    if (!row) throw new NotFoundException("Pengeluaran tidak ditemukan");
    const approval = await this.approvals.getFor("PENGELUARAN", id);
    return { ...row, approval };
  }

  async create(dto: ExpenseDto, user: RequestUser) {
    if (!dto.receiptFileId) throw new BadRequestException("Nota pengeluaran wajib diunggah (bukti wajib)");
    if (dto.projectId && dto.costCenterId) {
      throw new BadRequestException("Pengeluaran hanya tertaut ke satu sumber biaya");
    }
    if (!dto.projectId && !dto.surveyId && !dto.deliveryNoteId && !dto.costCenterId) {
      throw new BadRequestException("Pengeluaran wajib tertaut ke project, survey, surat jalan, atau cost center");
    }

    const row = await this.prisma.main.expense.create({
      data: {
        date: new Date(dto.date),
        reporterId: user.id,
        categoryId: dto.categoryId,
        amount: dto.amount,
        description: dto.description,
        projectId: dto.projectId,
        surveyId: dto.surveyId,
        deliveryNoteId: dto.deliveryNoteId,
        costCenterId: dto.costCenterId,
        receiptFileId: dto.receiptFileId,
        paidFileId: dto.paidFileId,
        status: "DILAPORKAN",
      },
      include: { reporter: { select: { id: true, name: true } }, project: { select: { name: true } } },
    });

    await this.prisma.main.file.update({
      where: { id: dto.receiptFileId },
      data: { refType: "expense", refId: String(row.id) },
    });

    await this.approvals.request({
      kind: "PENGELUARAN",
      entityId: row.id,
      title: `Pengeluaran ${row.project?.name ?? "harian"} — Rp${dto.amount}`,
      amount: Number(dto.amount),
      requestedBy: user,
      href: `/expenses/${row.id}`,
    });

    await this.audit.log({
      actor: user,
      action: "BUAT_PENGELUARAN",
      entityType: "expense",
      entityId: row.id,
      detail: `Rp${dto.amount} — ${dto.description.slice(0, 120)}`,
    });
    return row;
  }

  async update(id: number, dto: ExpenseDto, user: RequestUser) {
    const row = await this.prisma.main.expense.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Pengeluaran tidak ditemukan");
    if (row.reporterId !== user.id && !["ADMIN", "FINANCE", "BOS"].includes(user.role)) {
      throw new BadRequestException("Hanya pelapor atau Finance/Admin yang boleh mengubahnya");
    }
    if (["DISETUJUI", "DIBAYAR"].includes(row.status) && user.role !== "ADMIN") {
      throw new BadRequestException("Pengeluaran sudah disetujui dan tidak bisa diubah");
    }

    const updated = await this.prisma.main.expense.update({
      where: { id },
      data: {
        date: new Date(dto.date),
        categoryId: dto.categoryId ?? row.categoryId,
        amount: dto.amount,
        description: dto.description,
        projectId: dto.projectId ?? row.projectId,
        surveyId: dto.surveyId ?? row.surveyId,
        deliveryNoteId: dto.deliveryNoteId ?? row.deliveryNoteId,
        costCenterId: dto.costCenterId ?? row.costCenterId,
        receiptFileId: dto.receiptFileId ?? row.receiptFileId,
      },
      include: { reporter: { select: { id: true, name: true } } },
    });

    await this.approvals.request({
      kind: "PENGELUARAN",
      entityId: id,
      title: `Pengeluaran #${id} — Rp${dto.amount}`,
      amount: Number(dto.amount),
      requestedBy: user,
      href: `/expenses/${id}`,
    });
    await this.audit.log({
      actor: user,
      action: "UBAH_PENGELUARAN",
      entityType: "expense",
      entityId: id,
      detail: `Rp${dto.amount} — ${dto.description.slice(0, 120)}`,
    });
    return updated;
  }

  /**
   * Perubahan status manual (PRD #2): Ditolak dibuat dari persetujuan,
   * Dibayar hanya setelah disetujui + ada bukti transfer.
   */
  async setStatus(id: number, dto: ExpenseStatusDto, user: RequestUser) {
    const row = await this.prisma.main.expense.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Pengeluaran tidak ditemukan");

    if (dto.status === "DITOLAK") {
      if (!["FINANCE", "BOS", "ADMIN"].includes(user.role)) {
        throw new BadRequestException("Hanya Finance atau Bos yang boleh menolak");
      }
      if (!dto.reason) throw new BadRequestException("Alasan penolakan wajib diisi");
    } else if (dto.status === "DISETUJUI") {
      const approval = await this.approvals.getFor("PENGELUARAN", id);
      if (!approval || approval.status !== "DISETUJUI") {
        throw new BadRequestException("Pengeluaran harus disetujui lewat menu persetujuan");
      }
    } else if (dto.status === "DIBAYAR") {
      if (!["FINANCE", "ADMIN"].includes(user.role)) {
        throw new BadRequestException("Hanya Finance yang menandai pembayaran");
      }
      const approval = await this.approvals.getFor("PENGELUARAN", id);
      if (!approval || approval.status !== "DISETUJUI") {
        throw new BadRequestException("Pengeluaran harus disetujui sebelum dibayar");
      }
      if (!dto.paidFileId) throw new BadRequestException("Bukti transfer wajib diunggah");
      await this.prisma.main.file.update({
        where: { id: dto.paidFileId },
        data: { refType: "expense-paid", refId: String(id) },
      });
    } else if (dto.status === "DILAPORKAN" && !["FINANCE", "ADMIN"].includes(user.role)) {
      throw new BadRequestException("Hanya Finance atau Admin");
    }

    const updated = await this.prisma.main.expense.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.reason ? { rejectReason: dto.reason } : {}),
        ...(dto.paidFileId ? { paidFileId: dto.paidFileId, paidAt: new Date() } : {}),
      },
      include: { reporter: { select: { id: true, name: true } } },
    });

    await this.audit.log({
      actor: user,
      action: "UBAH_STATUS_PENGELUARAN",
      entityType: "expense",
      entityId: id,
      detail: `${row.status} → ${dto.status}${dto.reason ? ` (${dto.reason})` : ""}`,
    });
    await this.notifications.notify({
      userIds: [row.reporterId],
      kind: "APPROVAL",
      text: `Pengeluaran #${id}: ${dto.status}${dto.reason ? ` — ${dto.reason}` : ""}`,
      href: `/expenses/${id}`,
    });
    return updated;
  }

  private async onApproval(entityId: number, status: ApprovalStatus) {
    const row = await this.prisma.main.expense.findUnique({ where: { id: entityId } });
    if (!row || ["DISETUJUI", "DIBAYAR", "DITOLAK"].includes(row.status)) return;
    const next = status === "DISETUJUI" ? "DISETUJUI" : "DITOLAK";
    await this.prisma.main.expense.update({
      where: { id: entityId },
      data: { status: next, ...(next === "DITOLAK" ? { rejectReason: "Ditolak lewat persetujuan" } : {}) },
    });
    await this.notifications.notify({
      userIds: [row.reporterId],
      kind: "APPROVAL",
      text: `Pengeluaran #${entityId}: ${next.toLowerCase()}`,
      href: `/expenses/${entityId}`,
    });
  }

  /** Ringkasan untuk Finance: per project / per orang / per bulan. */
  async summary(user: RequestUser, from?: string, to?: string) {
    const scope = ["FINANCE", "BOS", "ADMIN"].includes(user.role) ? {} : { reporterId: user.id };
    const rows = await this.prisma.main.expense.findMany({
      where: {
        ...scope,
        ...(from || to ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
      },
      select: {
        amount: true,
        status: true,
        projectId: true,
        reporterId: true,
        date: true,
        reporter: { select: { name: true } },
        project: { select: { name: true } },
      },
    });

    const byProject = new Map<string, number>();
    const byPerson = new Map<string, number>();
    const byMonth = new Map<string, number>();
    for (const r of rows) {
      const amount = Number(r.amount);
      const p = r.project?.name ?? "Tanpa project";
      byProject.set(p, (byProject.get(p) ?? 0) + amount);
      byPerson.set(r.reporter.name, (byPerson.get(r.reporter.name) ?? 0) + amount);
      const m = r.date.toISOString().slice(0, 7);
      byMonth.set(m, (byMonth.get(m) ?? 0) + amount);
    }

    return {
      total: rows.reduce((s, r) => s + Number(r.amount), 0),
      approved: rows.filter((r) => ["DISETUJUI", "DIBAYAR"].includes(r.status)).reduce((s, r) => s + Number(r.amount), 0),
      pending: rows.filter((r) => r.status === "DILAPORKAN").reduce((s, r) => s + Number(r.amount), 0),
      byProject: [...byProject].map(([name, amount]) => ({ name, amount })),
      byPerson: [...byPerson].map(([name, amount]) => ({ name, amount })),
      byMonth: [...byMonth].map(([month, amount]) => ({ month, amount })).sort((a, b) => a.month.localeCompare(b.month)),
    };
  }
}
