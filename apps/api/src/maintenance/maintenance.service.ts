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
  MaintenanceActionItemDto,
  MaintenanceListQuery,
  MaintenanceReportDto,
  MaintenanceStatusDto,
} from "./dto.js";

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private get db(): any {
    return this.prisma.main;
  }

  private async generateMaintenanceNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1, 2);
    const prefix = `MTN-${year}${month}-`;

    const count = await this.db.maintenanceReport.count({
      where: {
        number: {
          startsWith: prefix,
        },
      },
    });

    return `${prefix}${pad(count + 1, 4)}`;
  }

  async list(q: MaintenanceListQuery, user: RequestUser) {
    const role = (user.role || "").toUpperCase();
    const isGlobal = ["SUPER_ADMIN", "BOS", "ADMIN", "PM", "FINANCE", "SALES", "TEKNISI", "SE"].includes(role);
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
      ...(q.maintenanceType ? { maintenanceType: q.maintenanceType } : {}),
      ...(q.projectId ? { projectId: q.projectId } : {}),
      ...(q.customerId ? { customerId: q.customerId } : {}),
      ...(q.leadId ? { leadId: q.leadId } : {}),
      ...(q.ownerId ? { ownerId: q.ownerId } : {}),
      ...(q.from || q.to
        ? {
            startDate: {
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
              { description: { contains: q.q } },
              { findings: { contains: q.q } },
              { customer: { name: { contains: q.q } } },
              { project: { name: { contains: q.q } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.db.maintenanceReport.findMany({
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
        orderBy: orderBy(q.sort, q.dir, ["startDate", "createdAt", "number"], "startDate"),
        ...pageSkip(q),
      }),
      this.db.maintenanceReport.count({ where }),
    ]);

    // Format expenses summary
    const enhancedItems = await Promise.all(
      items.map(async (item: any) => {
        const expenseSummary = await this.calculateExpenseSummary(item.id);
        return {
          ...item,
          totalBiaya: expenseSummary.total,
          expenseSummary,
        };
      })
    );

    return paginate(enhancedItems, total, q);
  }

  async get(id: number, user: RequestUser) {
    const report = await this.db.maintenanceReport.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, role: true, email: true } },
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
          orderBy: { createdAt: "desc" },
        },
        expenses: {
          include: {
            reporter: { select: { id: true, name: true } },
            category: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!report) throw new NotFoundException("Laporan Maintenance tidak ditemukan");

    const expenseSummary = await this.calculateExpenseSummary(id);

    return {
      ...report,
      expenseSummary,
      totalBiaya: expenseSummary.total,
    };
  }

  async create(dto: MaintenanceReportDto, user: RequestUser) {
    const number = await this.generateMaintenanceNumber();
    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    const endDate = dto.endDate ? new Date(dto.endDate) : null;

    let customerId = dto.customerId;
    let clientName = dto.clientName;

    // Resolve customer info if customerId given
    if (customerId) {
      const cust = await this.db.customer.findUnique({ where: { id: customerId } });
      if (cust && !clientName) {
        clientName = cust.name;
      }
    }

    // Resolve customer from project if projectId given but no customer
    if (dto.projectId && !customerId) {
      const prj = await this.db.project.findUnique({ where: { id: dto.projectId } });
      if (prj?.customerId) {
        customerId = prj.customerId;
      }
    }

    const report = await this.db.maintenanceReport.create({
      data: {
        number,
        title: dto.title || `Maintenance - ${clientName || "Klien"}`,
        maintenanceType: dto.maintenanceType || "Preventive",
        status: dto.status || "Scheduled",
        startDate,
        endDate,
        location: dto.location,
        clientName,
        clientContact: dto.clientContact,
        customerId,
        leadId: dto.leadId,
        projectId: dto.projectId,
        purpose: dto.purpose,
        description: dto.description,
        findings: dto.findings,
        actionsTaken: dto.actionsTaken,
        recommendations: dto.recommendations,
        conclusion: dto.conclusion,
        companyHeader: dto.companyHeader,
        logoFileId: dto.logoFileId,
        documentFileId: dto.documentFileId,
        ownerId: dto.ownerId || user.id,
        createdById: user.id,
        members: dto.memberUserIds?.length
          ? {
              create: [...new Set(dto.memberUserIds)].map((uid) => ({
                userId: uid,
              })),
            }
          : undefined,
      },
      include: {
        owner: { select: { id: true, name: true } },
        members: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    await this.audit.log({
      actor: user,
      action: "CREATE_MAINTENANCE_REPORT",
      entityType: "maintenanceReport",
      entityId: report.id,
      detail: `Membuat laporan maintenance ${report.number}: ${report.title}`,
    });

    this.notifications.dataChange("maintenance-reports", "create", report.id);

    return report;
  }

  async update(id: number, dto: MaintenanceReportDto, user: RequestUser) {
    const existing = await this.db.maintenanceReport.findUnique({
      where: { id },
      include: { members: true },
    });
    if (!existing) throw new NotFoundException("Laporan Maintenance tidak ditemukan");

    this.checkEditPermission(existing, user);

    const updateData: any = {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.maintenanceType !== undefined ? { maintenanceType: dto.maintenanceType } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.startDate !== undefined ? { startDate: new Date(dto.startDate) } : {}),
      ...(dto.endDate !== undefined ? { endDate: dto.endDate ? new Date(dto.endDate) : null } : {}),
      ...(dto.location !== undefined ? { location: dto.location } : {}),
      ...(dto.clientName !== undefined ? { clientName: dto.clientName } : {}),
      ...(dto.clientContact !== undefined ? { clientContact: dto.clientContact } : {}),
      ...(dto.customerId !== undefined ? { customerId: dto.customerId } : {}),
      ...(dto.leadId !== undefined ? { leadId: dto.leadId } : {}),
      ...(dto.projectId !== undefined ? { projectId: dto.projectId } : {}),
      ...(dto.purpose !== undefined ? { purpose: dto.purpose } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.findings !== undefined ? { findings: dto.findings } : {}),
      ...(dto.actionsTaken !== undefined ? { actionsTaken: dto.actionsTaken } : {}),
      ...(dto.recommendations !== undefined ? { recommendations: dto.recommendations } : {}),
      ...(dto.conclusion !== undefined ? { conclusion: dto.conclusion } : {}),
      ...(dto.companyHeader !== undefined ? { companyHeader: dto.companyHeader } : {}),
      ...(dto.logoFileId !== undefined ? { logoFileId: dto.logoFileId } : {}),
      ...(dto.documentFileId !== undefined ? { documentFileId: dto.documentFileId } : {}),
      ...(dto.ownerId !== undefined ? { ownerId: dto.ownerId } : {}),
    };

    if (dto.memberUserIds !== undefined) {
      await this.db.maintenanceMember.deleteMany({ where: { maintenanceReportId: id } });
      if (dto.memberUserIds?.length) {
        updateData.members = {
          create: [...new Set(dto.memberUserIds)].map((uid) => ({
            userId: uid,
          })),
        };
      }
    }

    const updated = await this.db.maintenanceReport.update({
      where: { id },
      data: updateData,
      include: {
        owner: { select: { id: true, name: true } },
        members: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    await this.audit.log({
      actor: user,
      action: "UPDATE_MAINTENANCE_REPORT",
      entityType: "maintenanceReport",
      entityId: id,
      detail: `Memperbarui laporan maintenance ${updated.number}`,
    });

    this.notifications.dataChange("maintenance-reports", "update", id);

    return updated;
  }

  async updateStatus(id: number, dto: MaintenanceStatusDto, user: RequestUser) {
    const existing = await this.db.maintenanceReport.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Laporan Maintenance tidak ditemukan");

    this.checkEditPermission(existing, user);

    const updated = await this.db.maintenanceReport.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.audit.log({
      actor: user,
      action: "UPDATE_MAINTENANCE_STATUS",
      entityType: "maintenanceReport",
      entityId: id,
      detail: `Mengubah status maintenance ${existing.number} menjadi ${dto.status}`,
    });

    this.notifications.dataChange("maintenance-reports", "update", id);

    return updated;
  }

  async remove(id: number, user: RequestUser) {
    const existing = await this.db.maintenanceReport.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Laporan Maintenance tidak ditemukan");

    const role = (user.role || "").toUpperCase();
    if (!["SUPER_ADMIN", "ADMIN", "BOS"].includes(role) && existing.createdById !== user.id) {
      throw new ForbiddenException("Anda tidak berhak menghapus laporan maintenance ini");
    }

    await this.db.maintenanceReport.delete({ where: { id } });

    await this.audit.log({
      actor: user,
      action: "DELETE_MAINTENANCE_REPORT",
      entityType: "maintenanceReport",
      entityId: id,
      detail: `Menghapus laporan maintenance ${existing.number}`,
    });
    this.notifications.dataChange("maintenance-reports", "delete", id);

    return { success: true };
  }

  // ────────────────────────────── Action Items (Tindak Lanjut) ──────────────────────────────

  async addActionItem(maintenanceReportId: number, dto: MaintenanceActionItemDto, user: RequestUser) {
    const report = await this.db.maintenanceReport.findUnique({ where: { id: maintenanceReportId } });
    if (!report) throw new NotFoundException("Laporan Maintenance tidak ditemukan");

    this.checkEditPermission(report, user);

    const action = await this.db.maintenanceActionItem.create({
      data: {
        maintenanceReportId,
        task: dto.task,
        assigneeId: dto.assigneeId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        status: dto.status || "Open",
        notes: dto.notes,
      },
    });
    this.notifications.dataChange("maintenance-reports", "update", maintenanceReportId);

    return action;
  }

  async updateActionItem(actionId: number, dto: Partial<MaintenanceActionItemDto>, user: RequestUser) {
    const action = await this.db.maintenanceActionItem.findUnique({
      where: { id: actionId },
      include: { maintenanceReport: true },
    });
    if (!action) throw new NotFoundException("Tindak lanjut tidak ditemukan");

    const updated = await this.db.maintenanceActionItem.update({
      where: { id: actionId },
      data: {
        ...(dto.task !== undefined ? { task: dto.task } : {}),
        ...(dto.assigneeId !== undefined ? { assigneeId: dto.assigneeId } : {}),
        ...(dto.dueDate !== undefined ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
    this.notifications.dataChange("maintenance-reports", "update", action.maintenanceReportId);

    return updated;
  }

  async deleteActionItem(actionId: number, user: RequestUser) {
    const action = await this.db.maintenanceActionItem.findUnique({
      where: { id: actionId },
      include: { maintenanceReport: true },
    });
    if (!action) throw new NotFoundException("Tindak lanjut tidak ditemukan");

    await this.db.maintenanceActionItem.delete({ where: { id: actionId } });
    this.notifications.dataChange("maintenance-reports", "update", action.maintenanceReportId);
    return { success: true };
  }

  // ────────────────────────────── Financial Summary ──────────────────────────────

  async calculateExpenseSummary(maintenanceReportId: number) {
    const expenses = await this.db.expense.findMany({
      where: {
        maintenanceReportId,
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
    if (["SUPER_ADMIN", "ADMIN", "BOS", "PM", "SALES", "TEKNISI"].includes(role)) return true;
    if (report.ownerId === user.id || report.createdById === user.id) return true;
    throw new ForbiddenException("Anda tidak memiliki izin mengedit laporan maintenance ini");
  }
}
