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

  private async syncSurveyCost(surveyId: number | null | undefined) {
    if (!surveyId) return;
    try {
      const expenses = await this.prisma.main.expense.findMany({
        where: { surveyId, status: { not: "DITOLAK" } },
        select: { amount: true },
      });
      const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
      await this.prisma.main.survey.update({
        where: { id: surveyId },
        data: { cost: total },
      });
      this.notifications.dataChange("surveys", "update", surveyId);
    } catch {}
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
    const role = (user.role || "").toUpperCase();
    const scope =
      ["SUPER_ADMIN", "FINANCE", "BOS", "ADMIN"].includes(role) || q.surveyId || q.projectId
        ? {}
        : { reporterId: user.id };
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
          survey: { select: { id: true, location: true, lead: { select: { id: true, name: true } } } },
          deliveryNote: { select: { id: true, number: true } },
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
    if (!dto.projectId && !dto.surveyId && !dto.deliveryNoteId && !costCenterId) {
      const cc = await this.prisma.main.costCenter.findFirst();
      costCenterId = cc?.id;
    }

    const amount = dto.amount ?? 0;
    const description = dto.description || "Pengeluaran operasional";
    const date = dto.date ? new Date(dto.date) : new Date();

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

    await this.approvals.request({
      kind: "PENGELUARAN",
      entityId: row.id,
      title: `Pengeluaran ${row.project?.name ?? "harian"} — Rp${amount}`,
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
    const role = (user.role || "").toUpperCase();
    const canEditExpense = ["SUPER_ADMIN", "FINANCE", "BOS"].includes(role);
    if (!canEditExpense) {
      throw new BadRequestException("Hanya Finance dan Super Admin yang memiliki hak untuk mengubah data pengeluaran");
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
      },
    });

    if (updated.surveyId) {
      await this.syncSurveyCost(updated.surveyId);
    }
    if (row.surveyId && row.surveyId !== updated.surveyId) {
      await this.syncSurveyCost(row.surveyId);
    }

    await this.audit.log({
      actor: user,
      action: "UBAH_PENGELUARAN",
      entityType: "expense",
      entityId: id,
      detail: `Rp${updated.amount} — ${updated.description.slice(0, 120)}`,
    });
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

    if (dto.paidFileId) {
      await this.prisma.main.file.update({
        where: { id: dto.paidFileId },
        data: { refType: "expense-paid", refId: String(id) },
      }).catch(() => {});
    }

    const updated = await this.prisma.main.expense.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.reason ? { rejectReason: dto.reason } : {}),
        ...(dto.paidFileId ? { paidFileId: dto.paidFileId, paidAt: new Date() } : dto.status === "DIBAYAR" ? { paidAt: new Date() } : {}),
      },
      include: { reporter: { select: { id: true, name: true } } },
    });

    if (row.surveyId) {
      await this.syncSurveyCost(row.surveyId);
    }

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
    const pendingAppr = await this.approvals.getFor("PENGELUARAN", id);
    if (pendingAppr && pendingAppr.status === "MENUNGGU") {
      if (dto.status === "DISETUJUI" || dto.status === "DIBAYAR") {
        await this.approvals.decide(pendingAppr.id, user, true, dto.reason).catch(() => {});
      } else if (dto.status === "DITOLAK") {
        await this.approvals.decide(pendingAppr.id, user, false, dto.reason).catch(() => {});
      }
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
    await this.prisma.main.$transaction(async (tx) => {
      await tx.approval.deleteMany({ where: { kind: "PENGELUARAN", entityId: id } });
      await tx.expense.delete({ where: { id } });
    });
    if (row.surveyId) {
      await this.syncSurveyCost(row.surveyId);
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
    await this.notifications.notify({
      userIds: [row.reporterId],
      kind: "APPROVAL",
      text: `Pengeluaran #${entityId}: ${next.toLowerCase()}`,
      href: `/expenses/${entityId}`,
    });
    this.notifications.dataChange("expenses", "status", entityId);
  }

  /** Ringkasan untuk Finance: per project / per orang / per bulan. */
  async summary(user: RequestUser, from?: string, to?: string) {
    const role = (user.role || "").toUpperCase();
    const scope = ["SUPER_ADMIN", "FINANCE", "BOS", "ADMIN"].includes(role) ? {} : { reporterId: user.id };
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
