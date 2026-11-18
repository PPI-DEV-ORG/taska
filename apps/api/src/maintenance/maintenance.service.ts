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
  dateOnly,
  todayUtc,
  addInterval,
  generateScheduleDates,
  parseReminderLeadDays,
  formatSequence,
  round2,
} from "./maintenance.rules.js";
import {
  MaintenanceActionItemDto,
  MaintenanceListQuery,
  MaintenanceReportDto,
  MaintenanceStatusDto,
  CreateMaintCategoryDto,
  UpdateMaintCategoryDto,
  CreateMaintChecklistDto,
  UpdateMaintChecklistDto,
  CreateMaintVendorDto,
  UpdateMaintVendorDto,
  CreateMaintPlanDto,
  UpdateMaintPlanDto,
  GenerateSchedulesDto,
  RescheduleScheduleDto,
  CreateMaintRequestDto,
  UpdateMaintRequestDto,
  InitialInspectRequestDto,
  CreateMaintWorkOrderDto,
  UpdateMaintWorkOrderDto,
  AssignWorkOrderDto,
  UpdateWorkOrderStatusDto,
  AddWorkOrderTaskDto,
  UpdateWorkOrderTaskDto,
  UpdateWorkOrderChecklistDto,
  AddWorkOrderMaterialDto,
  AddWorkOrderLaborDto,
  AddWorkOrderCostDto,
  RecordWorkOrderDowntimeDto,
  AddWorkOrderAttachmentDto,
  VerifyWorkOrderDto,
  CloseWorkOrderDto,
  EvaluateCapitalizationDto,
  MaintQueryDto,
  MaintReportQueryDto,
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

  // ────────────────────────────── Number Generators ──────────────────────────────

  private async generateMaintenanceNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1, 2);
    const prefix = `MTN-${year}${month}-`;
    const count = await this.db.maintenanceReport.count({
      where: { number: { startsWith: prefix } },
    });
    return `${prefix}${pad(count + 1, 4)}`;
  }

  private async generateWorkOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `WO-${year}-`;
    const count = await this.db.maintWorkOrder.count({
      where: { workOrderNumber: { startsWith: prefix } },
    });
    return formatSequence("WO", year, count + 1);
  }

  private async generateRequestNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `REQ-${year}-`;
    const count = await this.db.maintRequest.count({
      where: { requestNumber: { startsWith: prefix } },
    });
    return formatSequence("REQ", year, count + 1);
  }

  private async generateScheduleNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `SCH-${year}-`;
    const count = await this.db.maintSchedule.count({
      where: { scheduleNumber: { startsWith: prefix } },
    });
    return formatSequence("SCH", year, count + 1);
  }

  private async generatePlanNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PLN-${year}-`;
    const count = await this.db.maintPlan.count({
      where: { planNumber: { startsWith: prefix } },
    });
    return formatSequence("PLN", year, count + 1);
  }

  // ────────────────────────────── Master Data: Categories ──────────────────────────────

  async listCategories() {
    return this.db.maintCategory.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { plans: true, checklists: true } },
      },
    });
  }

  async createCategory(dto: CreateMaintCategoryDto, user: RequestUser) {
    const existing = await this.db.maintCategory.findUnique({ where: { code: dto.code } });
    if (existing) throw new BadRequestException(`Kategori dengan kode ${dto.code} sudah ada`);

    return this.db.maintCategory.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description || null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
  }

  async updateCategory(id: number, dto: UpdateMaintCategoryDto, user: RequestUser) {
    return this.db.maintCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async deleteCategory(id: number, user: RequestUser) {
    const category = await this.db.maintCategory.findUnique({
      where: { id },
      include: {
        _count: { select: { plans: true, checklists: true } },
      },
    });
    if (!category) throw new NotFoundException("Kategori tidak ditemukan");
    if (category._count.plans > 0 || category._count.checklists > 0) {
      return this.db.maintCategory.update({
        where: { id },
        data: { isActive: false },
      });
    }
    return this.db.maintCategory.delete({ where: { id } });
  }

  // ────────────────────────────── Master Data: Checklists ──────────────────────────────

  async listChecklists(categoryId?: number) {
    return this.db.maintChecklist.findMany({
      where: {
        ...(categoryId ? { categoryId } : {}),
      },
      orderBy: { name: "asc" },
      include: {
        category: true,
        items: { orderBy: { sequence: "asc" } },
        _count: { select: { plans: true } },
      },
    });
  }

  async getChecklist(id: number) {
    const item = await this.db.maintChecklist.findUnique({
      where: { id },
      include: {
        category: true,
        items: { orderBy: { sequence: "asc" } },
      },
    });
    if (!item) throw new NotFoundException("Checklist tidak ditemukan");
    return item;
  }

  async createChecklist(dto: CreateMaintChecklistDto, user: RequestUser) {
    const existing = await this.db.maintChecklist.findUnique({ where: { code: dto.code } });
    if (existing) throw new BadRequestException(`Checklist dengan kode ${dto.code} sudah ada`);

    return this.db.maintChecklist.create({
      data: {
        code: dto.code,
        name: dto.name,
        categoryId: dto.categoryId,
        description: dto.description || null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        items: dto.items && dto.items.length > 0
          ? {
              create: dto.items.map((it, idx) => ({
                itemText: it.itemText,
                standardCondition: it.standardCondition || null,
                sequence: it.sequence ?? idx + 1,
                isRequired: it.isRequired !== undefined ? it.isRequired : true,
              })),
            }
          : undefined,
      },
      include: { items: true },
    });
  }

  async updateChecklist(id: number, dto: UpdateMaintChecklistDto, user: RequestUser) {
    if (dto.items && Array.isArray(dto.items)) {
      await this.db.maintChecklistItem.deleteMany({ where: { checklistId: id } });
      await this.db.maintChecklistItem.createMany({
        data: dto.items.map((it, idx) => ({
          checklistId: id,
          itemText: it.itemText,
          standardCondition: it.standardCondition || null,
          sequence: it.sequence ?? idx + 1,
          isRequired: it.isRequired !== undefined ? it.isRequired : true,
        })),
      });
    }

    return this.db.maintChecklist.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: { items: { orderBy: { sequence: "asc" } } },
    });
  }

  async deleteChecklist(id: number, user: RequestUser) {
    const checklist = await this.db.maintChecklist.findUnique({
      where: { id },
      include: {
        _count: { select: { plans: true } },
      },
    });
    if (!checklist) throw new NotFoundException("Checklist tidak ditemukan");
    if (checklist._count.plans > 0) {
      return this.db.maintChecklist.update({
        where: { id },
        data: { isActive: false },
      });
    }
    await this.db.maintChecklistItem.deleteMany({ where: { checklistId: id } });
    return this.db.maintChecklist.delete({ where: { id } });
  }

  // ────────────────────────────── Master Data: Vendors ──────────────────────────────

  async listVendors() {
    return this.db.maintVendor.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { costs: true } },
      },
    });
  }

  async createVendor(dto: CreateMaintVendorDto, user: RequestUser) {
    const existing = await this.db.maintVendor.findUnique({ where: { code: dto.code } });
    if (existing) throw new BadRequestException(`Vendor dengan kode ${dto.code} sudah ada`);

    return this.db.maintVendor.create({
      data: {
        code: dto.code,
        name: dto.name,
        contactPerson: dto.contactPerson || null,
        phone: dto.phone || null,
        email: dto.email || null,
        address: dto.address || null,
        specialization: dto.specialization || null,
        rating: dto.rating !== undefined ? dto.rating : 5.0,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
  }

  async updateVendor(id: number, dto: UpdateMaintVendorDto, user: RequestUser) {
    return this.db.maintVendor.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.contactPerson !== undefined ? { contactPerson: dto.contactPerson } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.specialization !== undefined ? { specialization: dto.specialization } : {}),
        ...(dto.rating !== undefined ? { rating: dto.rating } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async deleteVendor(id: number, user: RequestUser) {
    const vendor = await this.db.maintVendor.findUnique({
      where: { id },
      include: {
        _count: { select: { costs: true } },
      },
    });
    if (!vendor) throw new NotFoundException("Vendor tidak ditemukan");
    if (vendor._count.costs > 0) {
      return this.db.maintVendor.update({
        where: { id },
        data: { isActive: false },
      });
    }
    return this.db.maintVendor.delete({ where: { id } });
  }

  // ────────────────────────────── Preventive: Plans ──────────────────────────────

  async listPlans(q: MaintQueryDto) {
    const where: any = {
      ...(q.status === "ACTIVE" ? { isActive: true } : q.status === "INACTIVE" ? { isActive: false } : {}),
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.q
        ? {
            OR: [
              { planNumber: { contains: q.q } },
              { title: { contains: q.q } },
              { description: { contains: q.q } },
              { category: { name: { contains: q.q } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.db.maintPlan.findMany({
        where,
        include: {
          category: true,
          checklist: true,
          picUser: { select: { id: true, name: true } },
          assets: {
            include: {
              asset: {
                select: { id: true, assetCode: true, name: true, location: true, department: true },
              },
            },
          },
          _count: { select: { schedules: true } },
        },
        orderBy: { id: "desc" },
        ...pageSkip(q),
      }),
      this.db.maintPlan.count({ where }),
    ]);

    return paginate(items, total, q);
  }

  async getPlan(id: number) {
    const plan = await this.db.maintPlan.findUnique({
      where: { id },
      include: {
        category: true,
        checklist: { include: { items: { orderBy: { sequence: "asc" } } } },
        picUser: { select: { id: true, name: true, email: true } },
        assets: {
          include: {
            asset: {
              select: {
                id: true,
                assetCode: true,
                name: true,
                brand: true,
                model: true,
                serialNumber: true,
                location: true,
                department: true,
                condition: true,
                status: true,
              },
            },
          },
        },
        schedules: {
          orderBy: { scheduledDate: "asc" },
          take: 20,
          include: { assignedUser: { select: { id: true, name: true } } },
        },
      },
    });
    if (!plan) throw new NotFoundException("Rencana maintenance tidak ditemukan");
    return plan;
  }

  async createPlan(dto: CreateMaintPlanDto, user: RequestUser) {
    const planNumber = await this.generatePlanNumber();
    const plan = await this.db.maintPlan.create({
      data: {
        planNumber,
        title: dto.title,
        categoryId: dto.categoryId,
        method: dto.method || "CALENDAR_BASED",
        intervalValue: dto.intervalValue || 1,
        intervalUnit: dto.intervalUnit || "MONTHS",
        checklistId: dto.checklistId || null,
        picUserId: dto.picUserId || null,
        autoGenerate: dto.autoGenerate !== undefined ? dto.autoGenerate : true,
        generationHorizon: dto.generationHorizon || "NEXT_CYCLE",
        reminderLeadDays: dto.reminderLeadDays || "7,3,1",
        description: dto.description || null,
        isActive: true,
        createdById: user.id,
      },
    });

    // Hubungkan aset
    const assetIds = Array.isArray(dto.assetIds) ? dto.assetIds : [];
    if (assetIds.length > 0) {
      await this.db.maintPlanAsset.createMany({
        data: assetIds.map((aId) => ({
          planId: plan.id,
          assetId: aId,
          nextServiceDate: addInterval(todayUtc(), plan.intervalValue, plan.intervalUnit),
        })),
        skipDuplicates: true,
      });

      // Auto generate schedule jika diaktifkan
      if (plan.autoGenerate) {
        await this.generateSchedulesForPlan(
          plan.id,
          { horizon: plan.generationHorizon, assetIds },
          user,
        );
      }
    }

    return this.getPlan(plan.id);
  }

  async updatePlan(id: number, dto: UpdateMaintPlanDto, user: RequestUser) {
    await this.db.maintPlan.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.method !== undefined ? { method: dto.method } : {}),
        ...(dto.intervalValue !== undefined ? { intervalValue: dto.intervalValue } : {}),
        ...(dto.intervalUnit !== undefined ? { intervalUnit: dto.intervalUnit } : {}),
        ...(dto.checklistId !== undefined ? { checklistId: dto.checklistId } : {}),
        ...(dto.picUserId !== undefined ? { picUserId: dto.picUserId } : {}),
        ...(dto.autoGenerate !== undefined ? { autoGenerate: dto.autoGenerate } : {}),
        ...(dto.generationHorizon !== undefined ? { generationHorizon: dto.generationHorizon } : {}),
        ...(dto.reminderLeadDays !== undefined ? { reminderLeadDays: dto.reminderLeadDays } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    if (Array.isArray(dto.assetIds)) {
      await this.db.maintPlanAsset.deleteMany({ where: { planId: id } });
      if (dto.assetIds.length > 0) {
        const plan = await this.db.maintPlan.findUnique({ where: { id } });
        await this.db.maintPlanAsset.createMany({
          data: dto.assetIds.map((aId) => ({
            planId: id,
            assetId: aId,
            nextServiceDate: addInterval(todayUtc(), plan.intervalValue, plan.intervalUnit),
          })),
        });
      }
    }

    return this.getPlan(id);
  }

  async deletePlan(id: number, user: RequestUser) {
    const plan = await this.db.maintPlan.findUnique({
      where: { id },
      include: {
        _count: { select: { schedules: true } },
      },
    });
    if (!plan) throw new NotFoundException("Rencana servis tidak ditemukan");
    if (plan._count.schedules > 0) {
      return this.db.maintPlan.update({
        where: { id },
        data: { isActive: false },
      });
    }
    await this.db.maintPlanAsset.deleteMany({ where: { planId: id } });
    return this.db.maintPlan.delete({ where: { id } });
  }

  async generateSchedulesForPlan(planId: number, dto: GenerateSchedulesDto, user: RequestUser) {
    const plan = await this.db.maintPlan.findUnique({
      where: { id: planId },
      include: { assets: true },
    });
    if (!plan) throw new NotFoundException("Plan tidak ditemukan");

    const horizon = dto.horizon || plan.generationHorizon || "NEXT_CYCLE";
    const targetAssetIds = dto.assetIds && dto.assetIds.length > 0
      ? dto.assetIds
      : plan.assets.map((pa: any) => pa.assetId);

    const createdSchedules: any[] = [];
    const baseDate = todayUtc();

    for (const aId of targetAssetIds) {
      const dates = generateScheduleDates(baseDate, plan.intervalValue, plan.intervalUnit, horizon);
      for (const d of dates) {
        // Cek apakah jadwal sudah ada pada tanggal tersebut untuk aset ini
        const exists = await this.db.maintSchedule.findFirst({
          where: {
            planId,
            assetId: aId,
            scheduledDate: d,
            status: { not: "CANCELLED" },
          },
        });
        if (!exists) {
          const scheduleNumber = await this.generateScheduleNumber();
          const sch = await this.db.maintSchedule.create({
            data: {
              scheduleNumber,
              planId,
              assetId: aId,
              scheduledDate: d,
              maintenanceType: "PREVENTIVE",
              priority: "MEDIUM",
              assignedUserId: plan.picUserId || null,
              status: "SCHEDULED",
              createdById: user.id,
            },
          });
          createdSchedules.push(sch);
        }
      }

      // Update nextServiceDate di MaintPlanAsset
      const nextDate = dates[0] || addInterval(baseDate, plan.intervalValue, plan.intervalUnit);
      await this.db.maintPlanAsset.updateMany({
        where: { planId, assetId: aId },
        data: { nextServiceDate: nextDate },
      });
    }

    return {
      success: true,
      generatedCount: createdSchedules.length,
      schedules: createdSchedules,
    };
  }

  // ────────────────────────────── Service Schedules ──────────────────────────────

  async listSchedules(q: MaintQueryDto) {
    const today = todayUtc();

    // Auto mark overdue untuk jadwal yang lewat hari ini tapi masih SCHEDULED
    await this.db.maintSchedule.updateMany({
      where: {
        status: "SCHEDULED",
        scheduledDate: { lt: today },
      },
      data: { status: "OVERDUE" },
    });

    const where: any = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.priority ? { priority: q.priority } : {}),
      ...(q.maintenanceType ? { maintenanceType: q.maintenanceType } : {}),
      ...(q.assetId ? { assetId: q.assetId } : {}),
      ...(q.assignedToUserId ? { assignedUserId: q.assignedToUserId } : {}),
      ...(q.from || q.to
        ? {
            scheduledDate: {
              ...(q.from ? { gte: dateOnly(q.from)! } : {}),
              ...(q.to ? { lte: dateOnly(q.to)! } : {}),
            },
          }
        : {}),
      ...(q.q
        ? {
            OR: [
              { scheduleNumber: { contains: q.q } },
              { asset: { name: { contains: q.q } } },
              { asset: { assetCode: { contains: q.q } } },
              { plan: { title: { contains: q.q } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.db.maintSchedule.findMany({
        where,
        include: {
          asset: {
            select: {
              id: true,
              assetCode: true,
              name: true,
              brand: true,
              model: true,
              serialNumber: true,
              location: true,
              department: true,
              condition: true,
            },
          },
          plan: { select: { id: true, planNumber: true, title: true, checklistId: true } },
          assignedUser: { select: { id: true, name: true, email: true } },
          workOrders: {
            select: { id: true, workOrderNumber: true, status: true, totalCost: true },
          },
        },
        orderBy: { scheduledDate: "asc" },
        ...pageSkip(q),
      }),
      this.db.maintSchedule.count({ where }),
    ]);

    return paginate(items, total, q);
  }

  async reschedule(id: number, dto: RescheduleScheduleDto, user: RequestUser) {
    const sch = await this.db.maintSchedule.findUnique({ where: { id } });
    if (!sch) throw new NotFoundException("Jadwal tidak ditemukan");

    const newDate = dateOnly(dto.newDate);
    if (!newDate) throw new BadRequestException("Tanggal baru tidak valid");

    return this.db.maintSchedule.update({
      where: { id },
      data: {
        rescheduledFromDate: sch.scheduledDate,
        scheduledDate: newDate,
        rescheduleReason: dto.reason,
        rescheduledByUserId: user.id,
        status: newDate < todayUtc() ? "OVERDUE" : "SCHEDULED",
      },
    });
  }

  async deleteSchedule(id: number, user: RequestUser) {
    const sch = await this.db.maintSchedule.findUnique({ where: { id } });
    if (!sch) throw new NotFoundException("Jadwal tidak ditemukan");
    if (sch.status === "COMPLETED") {
      throw new BadRequestException("Jadwal servis yang telah selesai tidak dapat dihapus");
    }
    return this.db.maintSchedule.delete({ where: { id } });
  }

  // ────────────────────────────── Corrective: Requests ──────────────────────────────

  async listRequests(q: MaintQueryDto, user: RequestUser) {
    const where: any = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.priority ? { urgency: q.priority } : {}),
      ...(q.assetId ? { assetId: q.assetId } : {}),
      ...(q.from || q.to
        ? {
            requestDate: {
              ...(q.from ? { gte: dateOnly(q.from)! } : {}),
              ...(q.to ? { lte: dateOnly(q.to)! } : {}),
            },
          }
        : {}),
      ...(q.q
        ? {
            OR: [
              { requestNumber: { contains: q.q } },
              { problemDescription: { contains: q.q } },
              { asset: { name: { contains: q.q } } },
              { asset: { assetCode: { contains: q.q } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.db.maintRequest.findMany({
        where,
        include: {
          asset: {
            select: {
              id: true,
              assetCode: true,
              name: true,
              brand: true,
              model: true,
              location: true,
              department: true,
              condition: true,
            },
          },
          reporterUser: { select: { id: true, name: true } },
          inspectedByUser: { select: { id: true, name: true } },
          attachments: true,
          workOrders: {
            select: { id: true, workOrderNumber: true, status: true },
          },
        },
        orderBy: { id: "desc" },
        ...pageSkip(q),
      }),
      this.db.maintRequest.count({ where }),
    ]);

    return paginate(items, total, q);
  }

  async getRequest(id: number) {
    const req = await this.db.maintRequest.findUnique({
      where: { id },
      include: {
        asset: true,
        reporterUser: { select: { id: true, name: true, email: true } },
        inspectedByUser: { select: { id: true, name: true } },
        attachments: true,
        workOrders: true,
      },
    });
    if (!req) throw new NotFoundException("Permintaan perbaikan tidak ditemukan");
    return req;
  }

  async createRequest(dto: CreateMaintRequestDto, user: RequestUser) {
    const requestNumber = await this.generateRequestNumber();
    const req = await this.db.maintRequest.create({
      data: {
        requestNumber,
        assetId: dto.assetId,
        reporterUserId: user.id,
        requestDate: dateOnly(dto.requestDate) || todayUtc(),
        problemDescription: dto.problemDescription,
        urgency: dto.urgency || "MEDIUM",
        status: "PENDING_APPROVAL",
        createdById: user.id,
      },
    });

    if (dto.attachments && dto.attachments.length > 0) {
      await this.db.maintAttachment.createMany({
        data: dto.attachments.map((att) => ({
          requestId: req.id,
          fileUrl: att.fileUrl,
          fileId: att.fileId || null,
          title: att.title || "Foto/Bukti Kerusakan",
          documentType: "BEFORE_PHOTO",
          uploadedById: user.id,
        })),
      });
    }

    return this.getRequest(req.id);
  }

  async initialInspectRequest(id: number, dto: InitialInspectRequestDto, user: RequestUser) {
    const req = await this.db.maintRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException("Permintaan perbaikan tidak ditemukan");

    const decision = dto.decision || "APPROVED";
    const status = decision === "APPROVED" ? "APPROVED" : "REJECTED";

    return this.db.maintRequest.update({
      where: { id },
      data: {
        initialInspectionNotes: dto.initialInspectionNotes,
        inspectedByUserId: user.id,
        inspectedAt: new Date(),
        status,
        rejectionReason: decision === "REJECTED" ? dto.rejectionReason || "Ditolak saat inspeksi awal" : null,
      },
    });
  }

  async convertRequestToWorkOrder(id: number, user: RequestUser) {
    const req = await this.db.maintRequest.findUnique({
      where: { id },
      include: { asset: true, attachments: true },
    });
    if (!req) throw new NotFoundException("Permintaan perbaikan tidak ditemukan");
    if (req.status === "WORK_ORDER_CREATED" && req.workOrderId) {
      return this.getWorkOrder(req.workOrderId);
    }

    const workOrderNumber = await this.generateWorkOrderNumber();
    const wo = await this.db.maintWorkOrder.create({
      data: {
        workOrderNumber,
        assetId: req.assetId,
        maintenanceType: "CORRECTIVE",
        priority: req.urgency || "MEDIUM",
        problemDescription: req.problemDescription,
        workInstruction: req.initialInspectionNotes || "Lakukan perbaikan sesuai hasil inspeksi awal.",
        status: "APPROVED",
        requestId: req.id,
        createdById: user.id,
      },
    });

    // Hubungkan foto attachment dari request ke WO
    if (req.attachments && req.attachments.length > 0) {
      await this.db.maintAttachment.createMany({
        data: req.attachments.map((att: any) => ({
          workOrderId: wo.id,
          fileUrl: att.fileUrl,
          fileId: att.fileId,
          title: att.title,
          documentType: "BEFORE_PHOTO",
          uploadedById: user.id,
        })),
      });
    }

    await this.db.maintRequest.update({
      where: { id },
      data: { status: "WORK_ORDER_CREATED", workOrderId: wo.id },
    });

    return this.getWorkOrder(wo.id);
  }

  async updateRequest(id: number, dto: UpdateMaintRequestDto, user: RequestUser) {
    const req = await this.db.maintRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException("Permintaan perbaikan tidak ditemukan");
    return this.db.maintRequest.update({
      where: { id },
      data: {
        ...(dto.assetId !== undefined ? { assetId: dto.assetId } : {}),
        ...(dto.requestDate !== undefined ? { requestDate: dateOnly(dto.requestDate) } : {}),
        ...(dto.problemDescription !== undefined ? { problemDescription: dto.problemDescription } : {}),
        ...(dto.urgency !== undefined ? { urgency: dto.urgency } : {}),
      },
    });
  }

  async deleteRequest(id: number, user: RequestUser) {
    const req = await this.db.maintRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException("Permintaan perbaikan tidak ditemukan");
    if (!["PENDING_APPROVAL", "REJECTED"].includes(req.status)) {
      throw new BadRequestException("Hanya permintaan yang belum diproses atau ditolak yang dapat dihapus");
    }
    await this.db.maintAttachment.deleteMany({ where: { requestId: id } });
    return this.db.maintRequest.delete({ where: { id } });
  }

  // ────────────────────────────── Work Orders (Core EAM) ──────────────────────────────

  async listWorkOrders(q: MaintQueryDto) {
    const where: any = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.priority ? { priority: q.priority } : {}),
      ...(q.maintenanceType ? { maintenanceType: q.maintenanceType } : {}),
      ...(q.assetId ? { assetId: q.assetId } : {}),
      ...(q.assignedToUserId ? { assignedToUserId: q.assignedToUserId } : {}),
      ...(q.from || q.to
        ? {
            createdAt: {
              ...(q.from ? { gte: dateOnly(q.from)! } : {}),
              ...(q.to ? { lte: dateOnly(q.to)! } : {}),
            },
          }
        : {}),
      ...(q.q
        ? {
            OR: [
              { workOrderNumber: { contains: q.q } },
              { problemDescription: { contains: q.q } },
              { workInstruction: { contains: q.q } },
              { asset: { name: { contains: q.q } } },
              { asset: { assetCode: { contains: q.q } } },
              { assignedToUser: { name: { contains: q.q } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.db.maintWorkOrder.findMany({
        where,
        include: {
          asset: {
            select: {
              id: true,
              assetCode: true,
              name: true,
              brand: true,
              model: true,
              location: true,
              department: true,
              condition: true,
              status: true,
            },
          },
          assignedToUser: { select: { id: true, name: true, email: true } },
          verifiedByUser: { select: { id: true, name: true } },
          request: { select: { id: true, requestNumber: true } },
          schedule: { select: { id: true, scheduleNumber: true } },
          _count: {
            select: { tasks: true, checklists: true, materials: true, costs: true },
          },
        },
        orderBy: { id: "desc" },
        ...pageSkip(q),
      }),
      this.db.maintWorkOrder.count({ where }),
    ]);

    return paginate(items, total, q);
  }

  async getWorkOrder(id: number) {
    const wo = await this.db.maintWorkOrder.findUnique({
      where: { id },
      include: {
        asset: {
          include: {
            category: true,
            location: true,
            assignedUser: { select: { id: true, name: true } },
          },
        },
        assignedToUser: { select: { id: true, name: true, email: true, role: true } },
        verifiedByUser: { select: { id: true, name: true } },
        closedByUser: { select: { id: true, name: true } },
        request: true,
        schedule: true,
        tasks: { orderBy: { sequence: "asc" } },
        checklists: { orderBy: { id: "asc" } },
        materials: { include: { product: true } },
        labor: { include: { technicianUser: { select: { id: true, name: true } } } },
        costs: { include: { vendor: true }, orderBy: { incurredDate: "desc" } },
        histories: true,
        downtimes: true,
        attachments: true,
      },
    });
    if (!wo) throw new NotFoundException("Work Order tidak ditemukan");
    return wo;
  }

  async createWorkOrder(dto: CreateMaintWorkOrderDto, user: RequestUser) {
    const workOrderNumber = await this.generateWorkOrderNumber();

    const wo = await this.db.maintWorkOrder.create({
      data: {
        workOrderNumber,
        assetId: dto.assetId,
        maintenanceType: dto.maintenanceType || "PREVENTIVE",
        priority: dto.priority || "MEDIUM",
        problemDescription: dto.problemDescription,
        workInstruction: dto.workInstruction || null,
        assignedToUserId: dto.assignedToUserId || null,
        plannedStartDate: dateOnly(dto.plannedStartDate),
        plannedFinishDate: dateOnly(dto.plannedFinishDate),
        status: dto.assignedToUserId ? "ASSIGNED" : "DRAFT",
        requestId: dto.requestId || null,
        scheduleId: dto.scheduleId || null,
        createdById: user.id,
      },
    });

    // Jika disediakan checklist template, populate checklist aktualnya
    if (dto.checklistId) {
      const template = await this.db.maintChecklist.findUnique({
        where: { id: dto.checklistId },
        include: { items: { orderBy: { sequence: "asc" } } },
      });
      if (template && template.items.length > 0) {
        await this.db.maintWorkOrderChecklist.createMany({
          data: template.items.map((it: any) => ({
            workOrderId: wo.id,
            checklistItemId: it.id,
            itemText: it.itemText,
            conditionBefore: it.standardCondition || null,
            status: "PASS",
          })),
        });
      }
    }

    return this.getWorkOrder(wo.id);
  }

  async deleteWorkOrder(id: number, user: RequestUser) {
    const wo = await this.db.maintWorkOrder.findUnique({ where: { id } });
    if (!wo) throw new NotFoundException("Work Order tidak ditemukan");
    if (!["DRAFT", "CANCELLED"].includes(wo.status)) {
      throw new BadRequestException("Hanya Work Order berstatus DRAFT atau CANCELLED yang dapat dihapus");
    }
    await this.db.maintWorkOrderTask.deleteMany({ where: { workOrderId: id } });
    await this.db.maintWorkOrderChecklist.deleteMany({ where: { workOrderId: id } });
    await this.db.maintMaterial.deleteMany({ where: { workOrderId: id } });
    await this.db.maintLabor.deleteMany({ where: { workOrderId: id } });
    await this.db.maintCost.deleteMany({ where: { workOrderId: id } });
    await this.db.maintDowntime.deleteMany({ where: { workOrderId: id } });
    await this.db.maintAttachment.deleteMany({ where: { workOrderId: id } });
    return this.db.maintWorkOrder.delete({ where: { id } });
  }

  async updateWorkOrder(id: number, dto: UpdateMaintWorkOrderDto, user: RequestUser) {
    const wo = await this.db.maintWorkOrder.findUnique({ where: { id } });
    if (!wo) throw new NotFoundException("Work Order tidak ditemukan");

    return this.db.maintWorkOrder.update({
      where: { id },
      data: {
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.problemDescription !== undefined ? { problemDescription: dto.problemDescription } : {}),
        ...(dto.workInstruction !== undefined ? { workInstruction: dto.workInstruction } : {}),
        ...(dto.assignedToUserId !== undefined ? { assignedToUserId: dto.assignedToUserId } : {}),
        ...(dto.plannedStartDate !== undefined ? { plannedStartDate: dateOnly(dto.plannedStartDate) } : {}),
        ...(dto.plannedFinishDate !== undefined ? { plannedFinishDate: dateOnly(dto.plannedFinishDate) } : {}),
        ...(dto.actualStartDate !== undefined ? { actualStartDate: new Date(dto.actualStartDate) } : {}),
        ...(dto.actualFinishDate !== undefined ? { actualFinishDate: new Date(dto.actualFinishDate) } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.workResult !== undefined ? { workResult: dto.workResult } : {}),
        ...(dto.rootCause !== undefined ? { rootCause: dto.rootCause } : {}),
        ...(dto.correctiveAction !== undefined ? { correctiveAction: dto.correctiveAction } : {}),
      },
    });
  }

  async assignWorkOrder(id: number, dto: AssignWorkOrderDto, user: RequestUser) {
    return this.db.maintWorkOrder.update({
      where: { id },
      data: {
        assignedToUserId: dto.assignedToUserId,
        status: "ASSIGNED",
        ...(dto.workInstruction ? { workInstruction: dto.workInstruction } : {}),
      },
    });
  }

  async updateWorkOrderStatus(id: number, dto: UpdateWorkOrderStatusDto, user: RequestUser) {
    const wo = await this.db.maintWorkOrder.findUnique({
      where: { id },
      include: { asset: true },
    });
    if (!wo) throw new NotFoundException("Work Order tidak ditemukan");

    const newStatus = dto.status.toUpperCase();
    const dataUpdate: any = { status: newStatus };

    if (newStatus === "IN_PROGRESS") {
      if (!wo.actualStartDate) dataUpdate.actualStartDate = new Date();
      // Sinkronisasi kondisi operasional aset ke UNDER_REPAIR (status akuntansi tetap ACTIVE)
      await this.db.faAsset.update({
        where: { id: wo.assetId },
        data: { condition: "UNDER_REPAIR" },
      });
    } else if (newStatus === "COMPLETED") {
      if (!wo.actualFinishDate) dataUpdate.actualFinishDate = new Date();
    } else if (newStatus === "CLOSED") {
      if (wo.status !== "VERIFIED" && wo.status !== "COMPLETED") {
        throw new BadRequestException("Work Order harus diverifikasi terlebih dahulu sebelum ditutup");
      }
      return this.closeWorkOrder(id, {}, user);
    }

    return this.db.maintWorkOrder.update({
      where: { id },
      data: dataUpdate,
    });
  }

  async verifyWorkOrder(id: number, dto: VerifyWorkOrderDto, user: RequestUser) {
    const wo = await this.db.maintWorkOrder.findUnique({ where: { id } });
    if (!wo) throw new NotFoundException("Work Order tidak ditemukan");

    return this.db.maintWorkOrder.update({
      where: { id },
      data: {
        status: "VERIFIED",
        verificationNotes: dto.verificationNotes,
        verifiedByUserId: user.id,
        verifiedAt: new Date(),
      },
    });
  }

  async closeWorkOrder(id: number, dto: CloseWorkOrderDto, user: RequestUser) {
    const wo = await this.db.maintWorkOrder.findUnique({
      where: { id },
      include: {
        asset: true,
        costs: true,
        materials: true,
        downtimes: true,
        attachments: true,
      },
    });
    if (!wo) throw new NotFoundException("Work Order tidak ditemukan");

    const finalCondition = dto.finalAssetStatus || "GOOD";
    const closedAt = new Date();

    // 1. Update WO status ke CLOSED
    const updatedWo = await this.db.maintWorkOrder.update({
      where: { id },
      data: {
        status: "CLOSED",
        closedByUserId: user.id,
        closedAt,
        ...(dto.closingNotes ? { workResult: dto.closingNotes } : {}),
      },
    });

    // 2. Kembalikan kondisi operasional aset di fa_assets
    await this.db.faAsset.update({
      where: { id: wo.assetId },
      data: { condition: finalCondition },
    });

    // 3. Rekam ke maintenance_history
    const sparePartsSummary = wo.materials
      .map((m: any) => `${m.sparePartName} (${m.quantity} ${m.unit})`)
      .join(", ");

    const photoBefore = wo.attachments.find((a: any) => a.documentType === "BEFORE_PHOTO")?.fileUrl || null;
    const photoAfter = wo.attachments.find((a: any) => a.documentType === "AFTER_PHOTO")?.fileUrl || null;

    const downtimeHours = wo.downtimes.reduce(
      (sum: number, dt: any) => sum + (Number(dt.durationHours) || 0),
      0,
    );

    await this.db.maintHistory.create({
      data: {
        assetId: wo.assetId,
        workOrderId: wo.id,
        maintenanceDate: dateOnly(wo.actualFinishDate || closedAt)!,
        maintenanceType: wo.maintenanceType,
        problemDescription: wo.problemDescription,
        rootCause: wo.rootCause || null,
        correctiveAction: wo.correctiveAction || wo.workResult || null,
        sparePartsSummary: sparePartsSummary || null,
        technicianOrVendor: wo.assignedToUserId ? `User #${wo.assignedToUserId}` : "Internal Team",
        totalCost: wo.totalCost,
        assetDowntimeHours: downtimeHours,
        photoBeforeUrl: photoBefore,
        photoAfterUrl: photoAfter,
        finalAssetStatus: finalCondition,
      },
    });

    // 4. Hubungkan ke fa_asset_maintenance_refs
    await this.db.faAssetMaintenanceRef.create({
      data: {
        assetId: wo.assetId,
        serviceDate: dateOnly(wo.actualFinishDate || closedAt)!,
        description: `WO #${wo.workOrderNumber}: ${wo.problemDescription}`,
        cost: wo.totalCost,
        isCapitalized: wo.isCapitalized,
        vendorName: "Maintenance Management",
      },
    });

    // 5. Jika terkait schedule, tandai COMPLETED
    if (wo.scheduleId) {
      await this.db.maintSchedule.update({
        where: { id: wo.scheduleId },
        data: { status: "COMPLETED" },
      });
    }

    return updatedWo;
  }

  // ────────────────────────────── WO Sub-resources ──────────────────────────────

  async recalculateWorkOrderCosts(workOrderId: number) {
    const [materials, labor, costs] = await Promise.all([
      this.db.maintMaterial.findMany({ where: { workOrderId } }),
      this.db.maintLabor.findMany({ where: { workOrderId } }),
      this.db.maintCost.findMany({ where: { workOrderId } }),
    ]);

    let totalMaterial = 0;
    for (const m of materials) totalMaterial += Number(m.totalCost) || 0;

    let totalLabor = 0;
    for (const l of labor) totalLabor += Number(l.laborCost) || 0;

    let totalExternal = 0;
    let totalTransport = 0;
    let totalOther = 0;

    for (const c of costs) {
      const amt = Number(c.amount) || 0;
      if (c.costComponent === "EXTERNAL_SERVICE") totalExternal += amt;
      else if (c.costComponent === "TRANSPORTATION") totalTransport += amt;
      else if (c.costComponent === "OTHER") totalOther += amt;
      else if (c.costComponent === "SPARE_PART") totalMaterial += amt;
      else if (c.costComponent === "LABOR") totalLabor += amt;
    }

    const totalCost = totalMaterial + totalLabor + totalExternal + totalTransport + totalOther;

    return this.db.maintWorkOrder.update({
      where: { id: workOrderId },
      data: {
        totalSparePartCost: totalMaterial,
        totalLaborCost: totalLabor,
        totalExternalServiceCost: totalExternal,
        totalTransportationCost: totalTransport,
        totalOtherCost: totalOther,
        totalCost,
      },
    });
  }

  // Tasks
  async addTask(workOrderId: number, dto: AddWorkOrderTaskDto) {
    const task = await this.db.maintWorkOrderTask.create({
      data: {
        workOrderId,
        taskName: dto.taskName,
        instruction: dto.instruction || null,
        sequence: dto.sequence || 1,
      },
    });
    return task;
  }

  async updateTask(taskId: number, dto: UpdateWorkOrderTaskDto, user: RequestUser) {
    return this.db.maintWorkOrderTask.update({
      where: { id: taskId },
      data: {
        ...(dto.taskName !== undefined ? { taskName: dto.taskName } : {}),
        ...(dto.instruction !== undefined ? { instruction: dto.instruction } : {}),
        ...(dto.isCompleted !== undefined
          ? {
              isCompleted: dto.isCompleted,
              completedAt: dto.isCompleted ? new Date() : null,
              completedByUserId: dto.isCompleted ? user.id : null,
            }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
  }

  async deleteTask(taskId: number) {
    return this.db.maintWorkOrderTask.delete({ where: { id: taskId } });
  }

  // Checklists
  async updateWorkOrderChecklist(checklistId: number, dto: UpdateWorkOrderChecklistDto, user: RequestUser) {
    return this.db.maintWorkOrderChecklist.update({
      where: { id: checklistId },
      data: {
        ...(dto.conditionBefore !== undefined ? { conditionBefore: dto.conditionBefore } : {}),
        ...(dto.conditionAfter !== undefined ? { conditionAfter: dto.conditionAfter } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        checkedByUserId: user.id,
        checkedAt: new Date(),
      },
    });
  }

  // Materials
  async addMaterial(workOrderId: number, dto: AddWorkOrderMaterialDto) {
    const totalCost = Number(dto.quantity) * Number(dto.unitCost);
    const mat = await this.db.maintMaterial.create({
      data: {
        workOrderId,
        productId: dto.productId || null,
        sparePartName: dto.sparePartName,
        partNumber: dto.partNumber || null,
        quantity: dto.quantity,
        unit: dto.unit || "PCS",
        unitCost: dto.unitCost,
        totalCost,
        source: dto.source || "WAREHOUSE",
        warehouseId: dto.warehouseId || null,
        notes: dto.notes || null,
      },
    });

    await this.recalculateWorkOrderCosts(workOrderId);
    return mat;
  }

  async deleteMaterial(materialId: number) {
    const mat = await this.db.maintMaterial.findUnique({ where: { id: materialId } });
    if (!mat) throw new NotFoundException("Material tidak ditemukan");

    await this.db.maintMaterial.delete({ where: { id: materialId } });
    await this.recalculateWorkOrderCosts(mat.workOrderId);
    return { success: true };
  }

  // Labor
  async addLabor(workOrderId: number, dto: AddWorkOrderLaborDto) {
    const laborCost = Number(dto.hoursSpent) * Number(dto.hourlyRate);
    const lab = await this.db.maintLabor.create({
      data: {
        workOrderId,
        technicianUserId: dto.technicianUserId || null,
        technicianName: dto.technicianName,
        hoursSpent: dto.hoursSpent,
        hourlyRate: dto.hourlyRate,
        laborCost,
        workDescription: dto.workDescription || null,
        loggedDate: dateOnly(dto.loggedDate) || todayUtc(),
      },
    });

    await this.recalculateWorkOrderCosts(workOrderId);
    return lab;
  }

  async deleteLabor(laborId: number) {
    const lab = await this.db.maintLabor.findUnique({ where: { id: laborId } });
    if (!lab) throw new NotFoundException("Labor log tidak ditemukan");

    await this.db.maintLabor.delete({ where: { id: laborId } });
    await this.recalculateWorkOrderCosts(lab.workOrderId);
    return { success: true };
  }

  // Costs
  async addCost(workOrderId: number, dto: AddWorkOrderCostDto) {
    const cost = await this.db.maintCost.create({
      data: {
        workOrderId,
        costComponent: dto.costComponent,
        description: dto.description,
        amount: dto.amount,
        sourceTransactionType: dto.sourceTransactionType || "MANUAL",
        sourceTransactionRef: dto.sourceTransactionRef || null,
        isCapitalized: dto.isCapitalized || false,
        coaCode: dto.coaCode || null,
        vendorId: dto.vendorId || null,
        incurredDate: dateOnly(dto.incurredDate) || todayUtc(),
      },
    });

    await this.recalculateWorkOrderCosts(workOrderId);
    return cost;
  }

  async deleteCost(costId: number) {
    const cost = await this.db.maintCost.findUnique({ where: { id: costId } });
    if (!cost) throw new NotFoundException("Biaya tidak ditemukan");

    await this.db.maintCost.delete({ where: { id: costId } });
    await this.recalculateWorkOrderCosts(cost.workOrderId);
    return { success: true };
  }

  // Downtime
  async recordDowntime(workOrderId: number, dto: RecordWorkOrderDowntimeDto) {
    const start = new Date(dto.downtimeStart);
    const end = dto.downtimeEnd ? new Date(dto.downtimeEnd) : null;
    let durationHours = 0;
    if (end) {
      durationHours = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
    }

    const wo = await this.db.maintWorkOrder.findUnique({ where: { id: workOrderId } });
    if (!wo) throw new NotFoundException("Work Order tidak ditemukan");

    return this.db.maintDowntime.create({
      data: {
        workOrderId,
        assetId: wo.assetId,
        downtimeStart: start,
        downtimeEnd: end,
        durationHours: round2(durationHours),
        cause: dto.cause,
        operationalImpact: dto.operationalImpact || "FULL_STOP",
        status: end ? "RESOLVED" : "RECORDED",
      },
    });
  }

  // Attachments
  async addAttachment(workOrderId: number, dto: AddWorkOrderAttachmentDto, user: RequestUser) {
    return this.db.maintAttachment.create({
      data: {
        workOrderId,
        fileUrl: dto.fileUrl,
        fileId: dto.fileId || null,
        documentType: dto.documentType || "REPORT",
        title: dto.title,
        notes: dto.notes || null,
        uploadedById: user.id,
      },
    });
  }

  async deleteAttachment(attachmentId: number) {
    return this.db.maintAttachment.delete({ where: { id: attachmentId } });
  }

  // Capitalization
  async evaluateCapitalization(workOrderId: number, dto: EvaluateCapitalizationDto, user: RequestUser) {
    const wo = await this.db.maintWorkOrder.findUnique({
      where: { id: workOrderId },
      include: { asset: true },
    });
    if (!wo) throw new NotFoundException("Work Order tidak ditemukan");

    if (dto.approved) {
      // Tambahkan nilai perolehan pada aset dan catat ke FaAssetLedger
      const addCost = Number(wo.totalCost);
      const newCost = Number(wo.asset.acquisitionCost) + addCost;
      const newBookValue = Number(wo.asset.bookValue) + addCost;

      await this.db.faAsset.update({
        where: { id: wo.assetId },
        data: {
          acquisitionCost: newCost,
          bookValue: newBookValue,
        },
      });

      await this.db.faAssetLedger.create({
        data: {
          assetId: wo.assetId,
          transactionType: "REVALUATION",
          transactionDate: todayUtc(),
          referenceType: "WORK_ORDER",
          referenceId: wo.id,
          description: `Kapitalisasi perbaikan WO #${wo.workOrderNumber}: ${wo.problemDescription}`,
          debit: addCost,
          credit: 0,
          endingBookValue: newBookValue,
          notes: dto.notes || "Disetujui untuk dikapitalisasi",
          createdById: user.id,
        },
      });
    }

    return this.db.maintWorkOrder.update({
      where: { id: workOrderId },
      data: {
        isCapitalized: dto.approved,
        capitalizationStatus: dto.approved ? "APPROVED" : "REJECTED",
      },
    });
  }

  // ────────────────────────────── Asset History & Downtime ──────────────────────────────

  async listAssetHistory(assetId: number) {
    return this.db.maintHistory.findMany({
      where: { assetId },
      orderBy: { maintenanceDate: "desc" },
      include: {
        workOrder: { select: { id: true, workOrderNumber: true } },
      },
    });
  }

  async listAssetDowntimes(assetId: number) {
    return this.db.maintDowntime.findMany({
      where: { assetId },
      orderBy: { downtimeStart: "desc" },
      include: {
        workOrder: { select: { id: true, workOrderNumber: true } },
      },
    });
  }

  // ────────────────────────────── Dashboard & 10 Reports ──────────────────────────────

  async getDashboard() {
    const today = todayUtc();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalAssets,
      assetsNeedingMaintenance,
      dueCount,
      overdueCount,
      openWos,
      inProgressWos,
      completedWos,
      monthlyCorrectiveCount,
      monthlyCosts,
      topAssetsByCost,
    ] = await Promise.all([
      this.db.faAsset.count({ where: { status: { not: "DISPOSED" } } }),
      this.db.faAsset.count({ where: { condition: { in: ["UNDER_REPAIR", "POOR", "DAMAGED"] } } }),
      this.db.maintSchedule.count({
        where: {
          status: "SCHEDULED",
          scheduledDate: { gte: today, lte: addInterval(today, 7, "DAYS") },
        },
      }),
      this.db.maintSchedule.count({ where: { status: "OVERDUE" } }),
      this.db.maintWorkOrder.count({ where: { status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "ASSIGNED"] } } }),
      this.db.maintWorkOrder.count({ where: { status: { in: ["IN_PROGRESS", "WAITING_FOR_PARTS", "WAITING_FOR_VENDOR"] } } }),
      this.db.maintWorkOrder.count({ where: { status: { in: ["COMPLETED", "VERIFIED", "CLOSED"] } } }),
      this.db.maintWorkOrder.count({
        where: {
          maintenanceType: "CORRECTIVE",
          createdAt: { gte: startOfMonth },
        },
      }),
      this.db.maintWorkOrder.aggregate({
        _sum: { totalCost: true },
        where: { createdAt: { gte: startOfMonth } },
      }),
      this.db.maintHistory.groupBy({
        by: ["assetId"],
        _sum: { totalCost: true },
        _count: { id: true },
        orderBy: { _sum: { totalCost: "desc" } },
        take: 5,
      }),
    ]);

    // Format top assets
    const topAssetsFormatted = await Promise.all(
      topAssetsByCost.map(async (item: any) => {
        const asset = await this.db.faAsset.findUnique({
          where: { id: item.assetId },
          select: { id: true, assetCode: true, name: true, department: true },
        });
        return {
          asset,
          totalCost: Number(item._sum.totalCost) || 0,
          serviceCount: item._count.id,
        };
      }),
    );

    // KPI Metrics: PM Compliance, MTTR, MTBF
    const [pmCompleted, pmTotalDue, correctiveWos, downtimes] = await Promise.all([
      this.db.maintSchedule.count({
        where: { maintenanceType: "PREVENTIVE", status: "COMPLETED" },
      }),
      this.db.maintSchedule.count({
        where: { maintenanceType: "PREVENTIVE", scheduledDate: { lte: today } },
      }),
      this.db.maintWorkOrder.findMany({
        where: {
          maintenanceType: "CORRECTIVE",
          actualStartDate: { not: null },
          actualFinishDate: { not: null },
        },
        select: { actualStartDate: true, actualFinishDate: true },
      }),
      this.db.maintDowntime.aggregate({
        _sum: { durationHours: true },
        _count: { id: true },
      }),
    ]);

    const pmCompliance = pmTotalDue > 0 ? round2((pmCompleted / pmTotalDue) * 100) : 100;

    let totalRepairHours = 0;
    for (const c of correctiveWos) {
      if (c.actualStartDate && c.actualFinishDate) {
        totalRepairHours += Math.max(0, (c.actualFinishDate.getTime() - c.actualStartDate.getTime()) / (1000 * 3600));
      }
    }
    const mttrHours = correctiveWos.length > 0 ? round2(totalRepairHours / correctiveWos.length) : 0;
    const totalDowntimeHours = Number(downtimes._sum.durationHours) || 0;
    const failureCount = Number(downtimes._count.id) || correctiveWos.length || 1;
    const operatingHoursEstimate = 365 * 24; // Estimasi jam operasi tahunan
    const mtbfHours = round2(operatingHoursEstimate / failureCount);

    return {
      kpi: {
        totalAssets,
        assetsNeedingMaintenance,
        dueCount,
        overdueCount,
        openWos,
        inProgressWos,
        completedWos,
        monthlyCorrectiveCount,
        monthlyTotalCost: Number(monthlyCosts._sum.totalCost) || 0,
        pmCompliance,
        mttrHours,
        mtbfHours,
        totalDowntimeHours,
      },
      topAssetsByCost: topAssetsFormatted,
    };
  }

  async getReports(query: MaintReportQueryDto) {
    const reportType = query.reportType || "work_orders";
    const fromDate = query.from ? dateOnly(query.from)! : null;
    const toDate = query.to ? dateOnly(query.to)! : null;

    if (reportType === "pm_schedule") {
      const data = await this.db.maintSchedule.findMany({
        where: {
          maintenanceType: "PREVENTIVE",
          ...(fromDate || toDate
            ? {
                scheduledDate: {
                  ...(fromDate ? { gte: fromDate } : {}),
                  ...(toDate ? { lte: toDate } : {}),
                },
              }
            : {}),
          ...(query.assetId ? { assetId: query.assetId } : {}),
        },
        include: {
          asset: { select: { id: true, assetCode: true, name: true, department: true } },
          plan: { select: { planNumber: true, title: true, intervalValue: true, intervalUnit: true } },
          assignedUser: { select: { name: true } },
        },
        orderBy: { scheduledDate: "asc" },
      });
      return { reportType, count: data.length, data };
    }

    if (reportType === "corrective") {
      const data = await this.db.maintRequest.findMany({
        where: {
          ...(fromDate || toDate
            ? {
                requestDate: {
                  ...(fromDate ? { gte: fromDate } : {}),
                  ...(toDate ? { lte: toDate } : {}),
                },
              }
            : {}),
          ...(query.assetId ? { assetId: query.assetId } : {}),
        },
        include: {
          asset: { select: { id: true, assetCode: true, name: true, department: true } },
          reporterUser: { select: { name: true } },
          inspectedByUser: { select: { name: true } },
        },
        orderBy: { requestDate: "desc" },
      });
      return { reportType, count: data.length, data };
    }

    if (reportType === "cost_per_asset") {
      const assets = await this.db.faAsset.findMany({
        where: {
          status: { not: "DISPOSED" },
          ...(query.assetId ? { id: query.assetId } : {}),
          ...(query.categoryId ? { categoryId: query.categoryId } : {}),
          ...(query.department ? { department: query.department } : {}),
        },
        include: {
          category: { select: { name: true } },
          maintenanceWorkOrders: {
            where: {
              status: "CLOSED",
              ...(fromDate || toDate
                ? {
                    closedAt: {
                      ...(fromDate ? { gte: fromDate } : {}),
                      ...(toDate ? { lte: toDate } : {}),
                    },
                  }
                : {}),
            },
            select: {
              totalSparePartCost: true,
              totalLaborCost: true,
              totalExternalServiceCost: true,
              totalTransportationCost: true,
              totalOtherCost: true,
              totalCost: true,
            },
          },
        },
      });

      const data = assets.map((a: any) => {
        let spare = 0, labor = 0, external = 0, transport = 0, other = 0, total = 0;
        for (const wo of a.maintenanceWorkOrders) {
          spare += Number(wo.totalSparePartCost) || 0;
          labor += Number(wo.totalLaborCost) || 0;
          external += Number(wo.totalExternalServiceCost) || 0;
          transport += Number(wo.totalTransportationCost) || 0;
          other += Number(wo.totalOtherCost) || 0;
          total += Number(wo.totalCost) || 0;
        }
        return {
          assetId: a.id,
          assetCode: a.assetCode,
          name: a.name,
          categoryName: a.category?.name || "-",
          department: a.department || "-",
          sparePartCost: spare,
          laborCost: labor,
          externalServiceCost: external,
          transportationCost: transport,
          otherCost: other,
          totalCost: total,
          woCount: a.maintenanceWorkOrders.length,
        };
      });

      return { reportType, count: data.length, data };
    }

    if (reportType === "cost_per_department") {
      const assets = await this.db.faAsset.findMany({
        include: {
          maintenanceWorkOrders: {
            where: { status: "CLOSED" },
            select: { totalCost: true, totalSparePartCost: true, totalLaborCost: true, totalExternalServiceCost: true },
          },
        },
      });

      const deptMap: Record<string, any> = {};
      for (const a of assets) {
        const dept = a.department || "Unassigned";
        if (!deptMap[dept]) {
          deptMap[dept] = { department: dept, assetCount: 0, spareParts: 0, labor: 0, external: 0, totalCost: 0, woCount: 0 };
        }
        deptMap[dept].assetCount += 1;
        for (const wo of a.maintenanceWorkOrders) {
          deptMap[dept].spareParts += Number(wo.totalSparePartCost) || 0;
          deptMap[dept].labor += Number(wo.totalLaborCost) || 0;
          deptMap[dept].external += Number(wo.totalExternalServiceCost) || 0;
          deptMap[dept].totalCost += Number(wo.totalCost) || 0;
          deptMap[dept].woCount += 1;
        }
      }

      const data = Object.values(deptMap);
      return { reportType, count: data.length, data };
    }

    if (reportType === "spare_parts") {
      const materials = await this.db.maintMaterial.findMany({
        where: {
          ...(fromDate || toDate
            ? {
                createdAt: {
                  ...(fromDate ? { gte: fromDate } : {}),
                  ...(toDate ? { lte: toDate } : {}),
                },
              }
            : {}),
        },
        include: {
          workOrder: { select: { workOrderNumber: true, asset: { select: { assetCode: true, name: true } } } },
        },
        orderBy: { createdAt: "desc" },
      });
      return { reportType, count: materials.length, data: materials };
    }

    if (reportType === "vendor_service") {
      const vendors = await this.db.maintVendor.findMany({
        include: {
          costs: {
            select: { amount: true, incurredDate: true, description: true },
          },
        },
      });

      const data = vendors.map((v: any) => {
        const totalAmount = v.costs.reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0);
        return {
          id: v.id,
          code: v.code,
          name: v.name,
          contactPerson: v.contactPerson,
          phone: v.phone,
          specialization: v.specialization,
          rating: v.rating,
          serviceCount: v.costs.length,
          totalCost: totalAmount,
        };
      });
      return { reportType, count: data.length, data };
    }

    if (reportType === "asset_downtime") {
      const data = await this.db.maintDowntime.findMany({
        include: {
          asset: { select: { id: true, assetCode: true, name: true, department: true } },
          workOrder: { select: { id: true, workOrderNumber: true } },
        },
        orderBy: { downtimeStart: "desc" },
      });
      return { reportType, count: data.length, data };
    }

    if (reportType === "overdue_maintenance") {
      const data = await this.db.maintSchedule.findMany({
        where: { status: "OVERDUE" },
        include: {
          asset: { select: { id: true, assetCode: true, name: true, department: true } },
          plan: { select: { planNumber: true, title: true } },
          assignedUser: { select: { name: true } },
        },
        orderBy: { scheduledDate: "asc" },
      });
      return { reportType, count: data.length, data };
    }

    // Default: work_orders
    const data = await this.db.maintWorkOrder.findMany({
      where: {
        ...(fromDate || toDate
          ? {
              createdAt: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
        ...(query.assetId ? { assetId: query.assetId } : {}),
      },
      include: {
        asset: { select: { id: true, assetCode: true, name: true, department: true } },
        assignedToUser: { select: { name: true } },
        verifiedByUser: { select: { name: true } },
      },
      orderBy: { id: "desc" },
    });
    return { reportType: "work_orders", count: data.length, data };
  }

  // ────────────────────────────── Lookups ──────────────────────────────

  async getLookups() {
    const [assets, categories, checklists, vendors, users, products] = await Promise.all([
      this.db.faAsset.findMany({
        where: { status: { not: "DISPOSED" } },
        select: {
          id: true,
          assetCode: true,
          name: true,
          brand: true,
          model: true,
          serialNumber: true,
          location: { select: { id: true, name: true } },
          department: true,
          condition: true,
          status: true,
        },
        orderBy: { name: "asc" },
      }),
      this.db.maintCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      this.db.maintChecklist.findMany({
        where: { isActive: true },
        include: { items: { orderBy: { sequence: "asc" } } },
        orderBy: { name: "asc" },
      }),
      this.db.maintVendor.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      this.db.user.findMany({
        where: { status: "AKTIF" },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      }),
      this.db.product.findMany({
        where: { status: "AKTIF" },
        select: { id: true, sku: true, name: true, unit: true, purchasePrice: true },
        take: 100,
        orderBy: { name: "asc" },
      }),
    ]);

    return { assets, categories, checklists, vendors, users, products };
  }

  // ────────────────────────────── Calendar Feed ──────────────────────────────

  async calendarSchedules(from?: string | Date, to?: string | Date) {
    const fromDate = from ? (from instanceof Date ? from : dateOnly(from)!) : todayUtc();
    const toDate = to ? (to instanceof Date ? to : dateOnly(to)!) : addInterval(todayUtc(), 60, "DAYS");

    const schedules = await this.db.maintSchedule.findMany({
      where: {
        scheduledDate: { gte: fromDate, lte: toDate },
        status: { not: "CANCELLED" },
      },
      include: {
        asset: { select: { id: true, assetCode: true, name: true, location: true } },
        assignedUser: { select: { id: true, name: true } },
        plan: { select: { title: true } },
      },
    });

    return schedules.map((s: any) => ({
      id: `maint-sch-${s.id}`,
      scheduleId: s.id,
      title: `[Maintenance] ${s.asset?.name || s.asset?.assetCode} (${s.plan?.title || s.maintenanceType})`,
      date: s.scheduledDate.toISOString().slice(0, 10),
      status: s.status,
      priority: s.priority,
      category: "MAINTENANCE",
      assignedTo: s.assignedUser?.name || null,
    }));
  }

  // ────────────────────────────── Legacy Maintenance Reports (Preserved) ──────────────────────────────

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
          customer: { select: { id: true, name: true } },
          lead: { select: { id: true, name: true, contactName: true } },
          project: { select: { id: true, name: true } },
          owner: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true } },
          members: { include: { user: { select: { id: true, name: true, role: true } } } },
          actions: { include: { assignee: { select: { id: true, name: true } } } },
          _count: { select: { expenses: true, followUps: true } },
        },
        orderBy: { startDate: "desc" },
        ...pageSkip(q),
      }),
      this.db.maintenanceReport.count({ where }),
    ]);

    return paginate(items, total, q);
  }

  async detail(id: number, user: RequestUser) {
    const report = await this.db.maintenanceReport.findUnique({
      where: { id },
      include: {
        customer: true,
        lead: true,
        project: true,
        owner: { select: { id: true, name: true, email: true, phone: true } },
        createdBy: { select: { id: true, name: true } },
        members: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
        actions: {
          include: { assignee: { select: { id: true, name: true } } },
          orderBy: { id: "asc" },
        },
        expenses: {
          include: {
            reporter: { select: { id: true, name: true } },
            payer: { select: { id: true, name: true } },
            project: { select: { id: true, name: true } },
          },
          orderBy: { tanggal: "desc" },
        },
        followUps: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { date: "desc" },
        },
        logoFile: true,
        documentFile: true,
      },
    });

    if (!report) throw new NotFoundException("Laporan maintenance tidak ditemukan");
    return report;
  }

  async create(dto: MaintenanceReportDto, user: RequestUser) {
    const number = await this.generateMaintenanceNumber();
    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();

    const report = await this.db.maintenanceReport.create({
      data: {
        number,
        title: dto.title || `Maintenance ${number}`,
        maintenanceType: dto.maintenanceType || "Preventive",
        status: dto.status || "Scheduled",
        startDate,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        location: dto.location || null,
        clientName: dto.clientName || null,
        clientContact: dto.clientContact || null,
        customerId: dto.customerId || null,
        leadId: dto.leadId || null,
        projectId: dto.projectId || null,
        purpose: dto.purpose || null,
        description: dto.description || null,
        findings: dto.findings || null,
        actionsTaken: dto.actionsTaken || null,
        recommendations: dto.recommendations || null,
        conclusion: dto.conclusion || null,
        companyHeader: dto.companyHeader || null,
        logoFileId: dto.logoFileId || null,
        documentFileId: dto.documentFileId || null,
        ownerId: dto.ownerId || user.id,
        createdById: user.id,
        members: dto.memberIds?.length
          ? {
              create: dto.memberIds.map((userId) => ({ userId })),
            }
          : undefined,
      },
      include: {
        members: { include: { user: { select: { id: true, name: true } } } },
        owner: { select: { id: true, name: true } },
      },
    });

    this.notifications.dataChange("maintenance-reports", "create", report.id);
    return report;
  }

  async update(id: number, dto: MaintenanceReportDto, user: RequestUser) {
    const report = await this.db.maintenanceReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException("Laporan maintenance tidak ditemukan");
    this.checkEditPermission(report, user);

    if (dto.memberIds) {
      await this.db.maintenanceMember.deleteMany({ where: { maintenanceReportId: id } });
      if (dto.memberIds.length > 0) {
        await this.db.maintenanceMember.createMany({
          data: dto.memberIds.map((userId) => ({
            maintenanceReportId: id,
            userId,
          })),
        });
      }
    }

    const updated = await this.db.maintenanceReport.update({
      where: { id },
      data: {
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
      },
      include: {
        members: { include: { user: { select: { id: true, name: true } } } },
        owner: { select: { id: true, name: true } },
      },
    });

    this.notifications.dataChange("maintenance-reports", "update", id);
    return updated;
  }

  async updateStatus(id: number, dto: MaintenanceStatusDto, user: RequestUser) {
    const report = await this.db.maintenanceReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException("Laporan maintenance tidak ditemukan");
    this.checkEditPermission(report, user);

    const updated = await this.db.maintenanceReport.update({
      where: { id },
      data: { status: dto.status },
    });

    this.notifications.dataChange("maintenance-reports", "update", id);
    return updated;
  }

  async delete(id: number, user: RequestUser) {
    const report = await this.db.maintenanceReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException("Laporan maintenance tidak ditemukan");
    this.checkEditPermission(report, user);

    await this.db.maintenanceReport.delete({ where: { id } });
    this.notifications.dataChange("maintenance-reports", "delete", id);
    return { success: true };
  }

  async addActionItem(maintenanceReportId: number, dto: MaintenanceActionItemDto, user: RequestUser) {
    const report = await this.db.maintenanceReport.findUnique({ where: { id: maintenanceReportId } });
    if (!report) throw new NotFoundException("Laporan maintenance tidak ditemukan");

    const action = await this.db.maintenanceActionItem.create({
      data: {
        maintenanceReportId,
        task: dto.task,
        assigneeId: dto.assigneeId || null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        status: dto.status || "Open",
        notes: dto.notes || null,
      },
      include: { assignee: { select: { id: true, name: true } } },
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
