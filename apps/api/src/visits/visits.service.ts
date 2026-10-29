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
import {
  VisitActionItemDto,
  VisitListQuery,
  VisitReportDto,
  VisitStatusDto,
} from "./dto.js";

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

@Injectable()
export class VisitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private get db(): any {
    return this.prisma.main;
  }

  private async generateVisitNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1, 2);
    const prefix = `VISIT-${year}${month}-`;

    const count = await this.db.visitReport.count({
      where: {
        number: {
          startsWith: prefix,
        },
      },
    });

    return `${prefix}${pad(count + 1, 4)}`;
  }

  async list(q: VisitListQuery, user: RequestUser) {
    const role = (user.role || "").toUpperCase();
    const isGlobal = ["SUPER_ADMIN", "BOS", "ADMIN", "PM", "FINANCE", "SALES"].includes(role);
    const scope = isGlobal
      ? {}
      : {
          OR: [
            { ownerId: user.id },
            { createdById: user.id },
            { members: { some: { userId: user.id } } },
          ],
        };

    const where: any = {
      ...scope,
      ...(q.status ? { status: q.status } : {}),
      ...(q.activityTypeId ? { activityTypeId: q.activityTypeId } : {}),
      ...(q.projectId ? { projectId: q.projectId } : {}),
      ...(q.customerId ? { customerId: q.customerId } : {}),
      ...(q.leadId ? { leadId: q.leadId } : {}),
      ...(q.ownerId ? { ownerId: q.ownerId } : {}),
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
              { clientContact: { contains: q.q } },
              { summary: { contains: q.q } },
              { customer: { name: { contains: q.q } } },
              { project: { name: { contains: q.q } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.db.visitReport.findMany({
        where,
        include: {
          owner: { select: { id: true, name: true, role: true } },
          activityType: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
          lead: { select: { id: true, name: true } },
          members: {
            include: {
              user: { select: { id: true, name: true, role: true } },
            },
          },
          actions: {
            select: { id: true, status: true },
          },
          _count: {
            select: {
              actions: true,
              expenses: true,
            },
          },
        },
        orderBy: orderBy(q.sort, q.dir, ["date", "createdAt", "number"], "date"),
        ...pageSkip(q),
      }),
      this.db.visitReport.count({ where }),
    ]);

    return paginate(items, total, q);
  }

  async get(id: number, user: RequestUser) {
    const report = await this.db.visitReport.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, role: true, email: true } },
        activityType: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, phone: true, email: true, address: true } },
        project: { select: { id: true, name: true, status: true } },
        lead: { select: { id: true, name: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, role: true, email: true } },
          },
        },
        actions: {
          orderBy: { createdAt: "asc" },
        },
        followUps: {
          include: {
            creator: { select: { id: true, name: true } },
          },
          orderBy: { date: "desc" },
        },
        expenses: {
          include: {
            reporter: { select: { id: true, name: true } },
            category: { select: { id: true, name: true } },
          },
          orderBy: { date: "desc" },
        },
      },
    });

    if (!report) throw new NotFoundException("Laporan Kunjungan tidak ditemukan");

    // Check view permission
    const role = (user.role || "").toUpperCase();
    const isGlobal = ["SUPER_ADMIN", "BOS", "ADMIN", "PM", "FINANCE", "SALES"].includes(role);
    if (!isGlobal) {
      const isMember = report.members.some((m: any) => m.userId === user.id);
      if (report.ownerId !== user.id && report.createdById !== user.id && !isMember) {
        throw new ForbiddenException("Anda tidak memiliki akses ke laporan kunjungan ini");
      }
    }

    const expenseSummary = await this.calculateExpenseSummary(id);

    return {
      ...report,
      expenseSummary,
    };
  }

  async create(dto: VisitReportDto, user: RequestUser) {
    const number = await this.generateVisitNumber();
    const ownerId = dto.ownerId || user.id;

    // Optional activity type resolution
    let activityTypeName = dto.activityTypeName;
    if (dto.activityTypeId && !activityTypeName) {
      const act = await this.db.visitActivityType.findUnique({ where: { id: dto.activityTypeId } });
      if (act) activityTypeName = act.name;
    }

    const report = await this.db.visitReport.create({
      data: {
        number,
        title: dto.title || `Kunjungan - ${dto.clientName || "Klien"}`,
        activityTypeId: dto.activityTypeId,
        activityTypeName,
        status: dto.status || "Planned",
        date: dto.date ? new Date(dto.date) : new Date(),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        location: dto.location,
        clientName: dto.clientName,
        clientContact: dto.clientContact,
        customerId: dto.customerId,
        leadId: dto.leadId,
        projectId: dto.projectId,
        purpose: dto.purpose,
        description: dto.description,
        summary: dto.summary,
        clientNeeds: dto.clientNeeds,
        productsIntroduced: dto.productsIntroduced,
        clientFeedback: dto.clientFeedback,
        agreements: dto.agreements,
        potentialOpportunities: dto.potentialOpportunities,
        obstacles: dto.obstacles,
        conclusion: dto.conclusion,
        companyHeader: dto.companyHeader,
        logoFileId: dto.logoFileId,
        documentFileId: dto.documentFileId,
        ownerId,
        createdById: user.id,
      },
    });

    // Add members
    if (dto.memberUserIds && Array.isArray(dto.memberUserIds) && dto.memberUserIds.length > 0) {
      const uniqueIds = Array.from(new Set(dto.memberUserIds));
      await this.db.visitMember.createMany({
        data: uniqueIds.map((userId) => ({
          visitReportId: report.id,
          userId,
        })),
        skipDuplicates: true,
      });
    }

    await this.audit.log({
      actor: user,
      action: "BUAT_LAPORAN_KUNJUNGAN",
      entityType: "visitReport",
      entityId: report.id,
      detail: `Membuat laporan kunjungan ${report.number}: ${report.title}`,
    });

    return this.get(report.id, user);
  }

  async update(id: number, dto: VisitReportDto, user: RequestUser) {
    const existing = await this.db.visitReport.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Laporan Kunjungan tidak ditemukan");

    this.checkEditPermission(existing, user);

    let activityTypeName = dto.activityTypeName;
    if (dto.activityTypeId && !activityTypeName) {
      const act = await this.db.visitActivityType.findUnique({ where: { id: dto.activityTypeId } });
      if (act) activityTypeName = act.name;
    }

    await this.db.visitReport.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.activityTypeId !== undefined ? { activityTypeId: dto.activityTypeId } : {}),
        ...(activityTypeName !== undefined ? { activityTypeName } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.date !== undefined ? { date: dto.date ? new Date(dto.date) : existing.date } : {}),
        ...(dto.endDate !== undefined ? { endDate: dto.endDate ? new Date(dto.endDate) : null } : {}),
        ...(dto.location !== undefined ? { location: dto.location } : {}),
        ...(dto.clientName !== undefined ? { clientName: dto.clientName } : {}),
        ...(dto.clientContact !== undefined ? { clientContact: dto.clientContact } : {}),
        ...(dto.customerId !== undefined ? { customerId: dto.customerId } : {}),
        ...(dto.leadId !== undefined ? { leadId: dto.leadId } : {}),
        ...(dto.projectId !== undefined ? { projectId: dto.projectId } : {}),
        ...(dto.purpose !== undefined ? { purpose: dto.purpose } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.summary !== undefined ? { summary: dto.summary } : {}),
        ...(dto.clientNeeds !== undefined ? { clientNeeds: dto.clientNeeds } : {}),
        ...(dto.productsIntroduced !== undefined ? { productsIntroduced: dto.productsIntroduced } : {}),
        ...(dto.clientFeedback !== undefined ? { clientFeedback: dto.clientFeedback } : {}),
        ...(dto.agreements !== undefined ? { agreements: dto.agreements } : {}),
        ...(dto.potentialOpportunities !== undefined ? { potentialOpportunities: dto.potentialOpportunities } : {}),
        ...(dto.obstacles !== undefined ? { obstacles: dto.obstacles } : {}),
        ...(dto.conclusion !== undefined ? { conclusion: dto.conclusion } : {}),
        ...(dto.companyHeader !== undefined ? { companyHeader: dto.companyHeader } : {}),
        ...(dto.logoFileId !== undefined ? { logoFileId: dto.logoFileId } : {}),
        ...(dto.documentFileId !== undefined ? { documentFileId: dto.documentFileId } : {}),
        ...(dto.ownerId !== undefined ? { ownerId: dto.ownerId } : {}),
      },
    });

    if (dto.memberUserIds && Array.isArray(dto.memberUserIds)) {
      await this.db.visitMember.deleteMany({ where: { visitReportId: id } });
      const uniqueIds = Array.from(new Set(dto.memberUserIds));
      if (uniqueIds.length > 0) {
        await this.db.visitMember.createMany({
          data: uniqueIds.map((userId) => ({
            visitReportId: id,
            userId,
          })),
          skipDuplicates: true,
        });
      }
    }

    await this.audit.log({
      actor: user,
      action: "UPDATE_LAPORAN_KUNJUNGAN",
      entityType: "visitReport",
      entityId: id,
      detail: `Memperbarui laporan kunjungan ${existing.number}`,
    });

    return this.get(id, user);
  }

  async updateStatus(id: number, dto: VisitStatusDto, user: RequestUser) {
    const existing = await this.db.visitReport.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Laporan Kunjungan tidak ditemukan");

    this.checkEditPermission(existing, user);

    const updated = await this.db.visitReport.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.audit.log({
      actor: user,
      action: "UPDATE_STATUS_KUNJUNGAN",
      entityType: "visitReport",
      entityId: id,
      detail: `Mengubah status kunjungan ${existing.number} menjadi ${dto.status}`,
    });

    return updated;
  }

  async remove(id: number, user: RequestUser) {
    const existing = await this.db.visitReport.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Laporan Kunjungan tidak ditemukan");

    const role = (user.role || "").toUpperCase();
    if (!["SUPER_ADMIN", "ADMIN", "BOS"].includes(role) && existing.createdById !== user.id) {
      throw new ForbiddenException("Anda tidak berhak menghapus laporan kunjungan ini");
    }

    await this.db.visitReport.delete({ where: { id } });

    await this.audit.log({
      actor: user,
      action: "DELETE_VISIT_REPORT",
      entityType: "visitReport",
      entityId: id,
      detail: `Menghapus laporan kunjungan ${existing.number}`,
    });

    return { success: true };
  }

  // ────────────────────────────── Action Items (Tindak Lanjut) ──────────────────────────────

  async addActionItem(visitReportId: number, dto: VisitActionItemDto, user: RequestUser) {
    const visit = await this.db.visitReport.findUnique({ where: { id: visitReportId } });
    if (!visit) throw new NotFoundException("Laporan Kunjungan tidak ditemukan");

    this.checkEditPermission(visit, user);

    const action = await this.db.visitActionItem.create({
      data: {
        visitReportId,
        task: dto.task,
        assigneeId: dto.assigneeId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        status: dto.status || "Open",
        notes: dto.notes,
      },
    });

    return action;
  }

  async updateActionItem(actionId: number, dto: Partial<VisitActionItemDto>, user: RequestUser) {
    const action = await this.db.visitActionItem.findUnique({
      where: { id: actionId },
      include: { visitReport: true },
    });
    if (!action) throw new NotFoundException("Tindak lanjut tidak ditemukan");

    const updated = await this.db.visitActionItem.update({
      where: { id: actionId },
      data: {
        ...(dto.task !== undefined ? { task: dto.task } : {}),
        ...(dto.assigneeId !== undefined ? { assigneeId: dto.assigneeId } : {}),
        ...(dto.dueDate !== undefined ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });

    return updated;
  }

  async deleteActionItem(actionId: number, user: RequestUser) {
    const action = await this.db.visitActionItem.findUnique({
      where: { id: actionId },
      include: { visitReport: true },
    });
    if (!action) throw new NotFoundException("Tindak lanjut tidak ditemukan");

    await this.db.visitActionItem.delete({ where: { id: actionId } });
    return { success: true };
  }

  // ────────────────────────────── Financial Summary ──────────────────────────────

  async calculateExpenseSummary(visitReportId: number) {
    const expenses = await this.db.expense.findMany({
      where: {
        visitReportId,
        status: { not: "DITOLAK" },
      },
      select: {
        id: true,
        amount: true,
        fundingSource: true,
        reimbursementStatus: true,
        status: true,
      },
    });

    let total = 0;
    let companyTotal = 0;
    let personalTotal = 0;
    let reimbSubmitted = 0;
    let reimbApproved = 0;
    let reimbPaid = 0;

    for (const exp of expenses) {
      const amt = Number(exp.amount) || 0;
      total += amt;

      const isPersonal =
        exp.fundingSource === "TALANGAN_PRIBADI" ||
        exp.fundingSource === "PERSONAL_ADVANCE" ||
        /talangan|reimburse/i.test(exp.fundingSource || "");

      if (isPersonal) {
        personalTotal += amt;
        const rStatus = (exp.reimbursementStatus || "").toUpperCase();
        if (rStatus === "PAID" || rStatus === "DIBAYAR") {
          reimbPaid += amt;
        } else if (rStatus === "APPROVED" || rStatus === "DISETUJUI") {
          reimbApproved += amt;
        } else {
          reimbSubmitted += amt;
        }
      } else {
        companyTotal += amt;
      }
    }

    return {
      total,
      companyTotal,
      personalTotal,
      reimbursement: {
        submitted: reimbSubmitted,
        approved: reimbApproved,
        paid: reimbPaid,
      },
    };
  }

  private checkEditPermission(report: any, user: RequestUser) {
    const role = (user.role || "").toUpperCase();
    if (["SUPER_ADMIN", "ADMIN", "BOS", "PM"].includes(role)) return true;
    if (report.ownerId === user.id || report.createdById === user.id) return true;
    throw new ForbiddenException("Anda tidak memiliki izin mengedit laporan kunjungan ini");
  }
}

