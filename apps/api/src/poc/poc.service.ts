import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { paginate } from "../common/dto/page-query.js";
import { orderBy, pageSkip } from "../common/utils/query.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { PocChecklistDto, PocListQuery, PocReportDto, PocStatusDto } from "./dto.js";

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

@Injectable()
export class PocService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private get db(): any {
    return this.prisma.main;
  }

  private async generatePocNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1, 2);
    const prefix = `POC-${year}${month}-`;

    const count = await this.db.pocReport.count({
      where: {
        number: {
          startsWith: prefix,
        },
      },
    });

    return `${prefix}${pad(count + 1, 4)}`;
  }

  async list(q: PocListQuery, user: RequestUser) {
    const role = (user.role || "").toUpperCase();
    const scope =
      ["SUPER_ADMIN", "BOS", "ADMIN", "PM", "FINANCE", "SALES"].includes(role)
        ? {}
        : ["TEKNISI", "SE"].includes(role)
          ? {
              OR: [
                { ownerId: user.id },
                { createdById: user.id },
                { members: { some: { userId: user.id } } },
              ],
            }
          : { ownerId: user.id };

    const where = {
      ...scope,
      ...(q.status ? { status: q.status } : {}),
      ...(q.resultStatus ? { resultStatus: q.resultStatus } : {}),
      ...(q.type ? { type: q.type } : {}),
      ...(q.projectId ? { projectId: q.projectId } : {}),
      ...(q.customerId ? { customerId: q.customerId } : {}),
      ...(q.from || q.to
        ? {
            date: {
              ...(q.from ? { gte: new Date(q.from) } : {}),
              ...(q.to ? { lte: new Date(q.to) } : {}),
            },
          }
        : {}),
      ...(q.q
        ? {
            OR: [
              { number: { contains: q.q } },
              { title: { contains: q.q } },
              { location: { contains: q.q } },
              { clientName: { contains: q.q } },
              { customer: { name: { contains: q.q } } },
              { project: { name: { contains: q.q } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.db.pocReport.findMany({
        where,
        include: {
          owner: { select: { id: true, name: true, role: true } },
          customer: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
          lead: { select: { id: true, name: true } },
          members: {
            include: {
              user: { select: { id: true, name: true, role: true } },
            },
          },
          _count: {
            select: {
              checklists: true,
              expenses: true,
            },
          },
        },
        orderBy: orderBy(q.sort, q.dir, ["date", "number", "title", "createdAt"], "date"),
        ...pageSkip(q),
      }),
      this.db.pocReport.count({ where }),
    ]);

    return paginate(items, total, q);
  }

  async get(id: number) {
    const poc = await this.db.pocReport.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, role: true, email: true } },
        customer: { select: { id: true, name: true, address: true, phone: true } },
        project: { select: { id: true, name: true, status: true } },
        lead: { select: { id: true, name: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, role: true, email: true } },
          },
        },
        checklists: {
          orderBy: { id: "asc" },
        },
        followUps: {
          include: {
            creator: { select: { id: true, name: true } },
          },
          orderBy: { date: "desc" },
        },
        expenses: {
          include: {
            category: { select: { id: true, name: true } },
            reporter: { select: { id: true, name: true } },
          },
          orderBy: { date: "desc" },
        },
      },
    });

    if (!poc) {
      throw new NotFoundException("Laporan POC tidak ditemukan");
    }

    // Expense stats breakdown
    const validExpenses = (poc.expenses || []).filter((e: { status: string }) => e.status !== "REJECTED");
    const companyCost = validExpenses
      .filter((e: { fundingSource?: string }) => e.fundingSource === "PERUSAHAAN")
      .reduce((sum: number, e: { amount: unknown }) => sum + Number(e.amount), 0);
    const personalAdvanceCost = validExpenses
      .filter((e: { fundingSource?: string }) => e.fundingSource === "TALANGAN_PRIBADI")
      .reduce((sum: number, e: { amount: unknown }) => sum + Number(e.amount), 0);

    const reimbursementStats = {
      submitted: validExpenses
        .filter(
          (e: { fundingSource?: string; reimbursementStatus?: string | null }) =>
            e.fundingSource === "TALANGAN_PRIBADI" && e.reimbursementStatus === "SUBMITTED",
        )
        .reduce((sum: number, e: { amount: unknown }) => sum + Number(e.amount), 0),
      approved: validExpenses
        .filter(
          (e: { fundingSource?: string; reimbursementStatus?: string | null }) =>
            e.fundingSource === "TALANGAN_PRIBADI" && e.reimbursementStatus === "APPROVED",
        )
        .reduce(
          (sum: number, e: { approvedAmount?: unknown; amount: unknown }) =>
            sum + Number(e.approvedAmount ?? e.amount),
          0,
        ),
      paid: validExpenses
        .filter(
          (e: { fundingSource?: string; reimbursementStatus?: string | null }) =>
            e.fundingSource === "TALANGAN_PRIBADI" && e.reimbursementStatus === "PAID",
        )
        .reduce(
          (sum: number, e: { paidAmount?: unknown; amount: unknown }) =>
            sum + Number(e.paidAmount ?? e.amount),
          0,
        ),
    };

    return {
      ...poc,
      financeSummary: {
        budget: Number(poc.budget),
        actualCost: Number(poc.actualCost),
        companyCost,
        personalAdvanceCost,
        reimbursementStats,
      },
    };
  }

  async create(dto: PocReportDto, user: RequestUser) {
    if (!dto.title || dto.title.trim().length < 3) {
      throw new BadRequestException("Judul kegiatan POC wajib diisi (minimal 3 karakter)");
    }
    const number = await this.generatePocNumber();
    const { memberUserIds, date, endDate, actualExecutionDate, budget, ...data } = dto;

    const row = await this.db.pocReport.create({
      data: {
        ...data,
        title: dto.title,
        number,
        date: date ? new Date(date) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
        actualExecutionDate: actualExecutionDate ? new Date(actualExecutionDate) : null,
        budget: budget ?? 0,
        ownerId: user.id,
        createdById: user.id,
        members: memberUserIds?.length
          ? {
              create: memberUserIds.map((userId) => ({ userId })),
            }
          : undefined,
      },
      include: {
        owner: { select: { id: true, name: true } },
        members: { include: { user: { select: { id: true, name: true, role: true } } } },
      },
    });

    await this.audit.log({
      actor: user,
      action: "BUAT_LAPORAN_POC",
      entityType: "pocReport",
      entityId: row.id,
      detail: `${row.number} — ${row.title}`,
    });

    return row;
  }

  async update(id: number, dto: PocReportDto, user: RequestUser) {
    const existing = await this.db.pocReport.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Laporan POC tidak ditemukan");

    const { memberUserIds, date, endDate, actualExecutionDate, budget, ...data } = dto;

    const updatePayload: Record<string, unknown> = {
      ...data,
      ...(date ? { date: new Date(date) } : {}),
      ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
      ...(actualExecutionDate !== undefined
        ? { actualExecutionDate: actualExecutionDate ? new Date(actualExecutionDate) : null }
        : {}),
      ...(budget !== undefined ? { budget } : {}),
    };

    if (memberUserIds !== undefined) {
      await this.db.pocMember.deleteMany({ where: { pocReportId: id } });
      if (memberUserIds.length) {
        await this.db.pocMember.createMany({
          data: memberUserIds.map((userId) => ({ pocReportId: id, userId })),
          skipDuplicates: true,
        });
      }
    }

    const row = await this.db.pocReport.update({
      where: { id },
      data: updatePayload as never,
      include: {
        owner: { select: { id: true, name: true } },
        members: { include: { user: { select: { id: true, name: true, role: true } } } },
      },
    });

    await this.audit.log({
      actor: user,
      action: "UPDATE_LAPORAN_POC",
      entityType: "pocReport",
      entityId: id,
      detail: `${row.number} — ${row.title}`,
    });

    return row;
  }

  async setStatus(id: number, dto: PocStatusDto, user: RequestUser) {
    const existing = await this.db.pocReport.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Laporan POC tidak ditemukan");

    const row = await this.db.pocReport.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.resultStatus !== undefined ? { resultStatus: dto.resultStatus } : {}),
      },
    });

    const noteText = dto.note || dto.notes ? ` — Catatan: ${dto.note || dto.notes}` : "";

    await this.audit.log({
      actor: user,
      action: "UPDATE_STATUS_POC",
      entityType: "pocReport",
      entityId: id,
      detail: `${row.number} — Status: ${row.status}, Hasil: ${row.resultStatus ?? "-"}${noteText}`,
    });

    return row;
  }

  async delete(id: number, user: RequestUser) {
    const existing = await this.db.pocReport.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Laporan POC tidak ditemukan");

    await this.db.pocReport.delete({ where: { id } });

    await this.audit.log({
      actor: user,
      action: "HAPUS_LAPORAN_POC",
      entityType: "pocReport",
      entityId: id,
      detail: `${existing.number} — ${existing.title}`,
    });

    return { deleted: true, id };
  }

  // Checklist methods
  async addChecklist(pocId: number, dto: PocChecklistDto, user: RequestUser) {
    const poc = await this.db.pocReport.findUnique({ where: { id: pocId } });
    if (!poc) throw new NotFoundException("Laporan POC tidak ditemukan");

    const item = await this.db.pocChecklist.create({
      data: {
        pocReportId: pocId,
        title: dto.title,
        isDone: dto.isDone ?? false,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        assigneeId: dto.assigneeId ?? null,
        notes: dto.notes ?? null,
      },
    });

    return item;
  }

  async updateChecklist(
    pocId: number,
    checklistId: number,
    dto: PocChecklistDto,
    user: RequestUser,
  ) {
    const item = await this.db.pocChecklist.findFirst({
      where: { id: checklistId, pocReportId: pocId },
    });
    if (!item) throw new NotFoundException("Item checklist tidak ditemukan");

    const updated = await this.db.pocChecklist.update({
      where: { id: checklistId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.isDone !== undefined ? { isDone: dto.isDone } : {}),
        ...(dto.dueDate !== undefined ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null } : {}),
        ...(dto.assigneeId !== undefined ? { assigneeId: dto.assigneeId } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });

    return updated;
  }

  async toggleChecklist(
    pocId: number,
    checklistId: number,
    isDone: boolean,
    user: RequestUser,
  ) {
    const item = await this.db.pocChecklist.findFirst({
      where: { id: checklistId, pocReportId: pocId },
    });
    if (!item) throw new NotFoundException("Item checklist tidak ditemukan");

    return this.db.pocChecklist.update({
      where: { id: checklistId },
      data: { isDone },
    });
  }

  async deleteChecklist(pocId: number, checklistId: number, user: RequestUser) {
    const item = await this.db.pocChecklist.findFirst({
      where: { id: checklistId, pocReportId: pocId },
    });
    if (!item) throw new NotFoundException("Item checklist tidak ditemukan");

    await this.db.pocChecklist.delete({ where: { id: checklistId } });
    return { deleted: true, id: checklistId };
  }
}

