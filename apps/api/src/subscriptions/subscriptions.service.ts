import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { PostingService } from "../accounting/posting.service.js";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import {
  CancellationDecisionDto,
  CancellationRequestDto,
  ChangeSubscriptionPlanDto,
  CreateSubscriptionDto,
  PostPrepaidDto,
  PrepaidGenerateDto,
  RenewSubscriptionDto,
  RunRemindersDto,
  SubscriptionCategoryDto,
  SubscriptionDocumentDto,
  SubscriptionPaymentDto,
  SubscriptionProviderDto,
  SubscriptionQuery,
  SubscriptionReportQuery,
  UpdateSubscriptionDto,
  UsageReviewDto,
} from "./dto.js";
import {
  addCycle,
  addDays,
  allocationTotal,
  buildPrepaidRows,
  computeMrcArc,
  daysUntil,
  formatPeriodLabel,
  nextCode,
  normalizePercentages,
  reminderOffsetForDate,
  round2,
  startOfDay,
} from "./subscriptions.rules.js";

const ACTIVE_STATUSES = ["ACTIVE", "RENEWAL_DUE", "RENEWAL_PENDING"];
const OPEN_STATUSES = [
  ...ACTIVE_STATUSES,
  "DRAFT",
  "PENDING_APPROVAL",
  "SUSPENDED",
  "CANCELLATION_PENDING",
];
const DEFAULT_PREPAID_ACCOUNT = "1401";
const DEFAULT_EXPENSE_ACCOUNT = "6122";
const DEFAULT_FUNDING_ACCOUNT = "1000.02";
const DEFAULT_AP_ACCOUNT = "210102";
const VAT_IN_ACCOUNT = "1600";

function dateOnly(value?: string | Date | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return new Date(`${y}-${m}-${d}T00:00:00.000Z`);
  }
  const str = String(value).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return new Date(`${str}T00:00:00.000Z`);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dateStr = String(d.getDate()).padStart(2, "0");
  return new Date(`${y}-${m}-${dateStr}T00:00:00.000Z`);
}

function optionalString(value?: string | null): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postingService: PostingService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private db(): any {
    return this.prisma.main as any;
  }

  // ───────────────────────────── Master: kategori ─────────────────────────────

  async listCategories() {
    return this.db().subCategory.findMany({
      orderBy: { code: "asc" },
      include: { _count: { select: { subscriptions: true } } },
    });
  }

  async createCategory(dto: SubscriptionCategoryDto) {
    let code = optionalString(dto.code);
    if (!code) {
      const count = await this.db().subCategory.count();
      code = `CAT-${String(count + 1).padStart(3, "0")}`;
    }
    try {
      return await this.db().subCategory.create({
        data: {
          code,
          name: dto.name.trim(),
          subcategory: optionalString(dto.subcategory),
          defaultBillingCycle: dto.defaultBillingCycle || "ANNUAL",
          expenseAccountCode: optionalString(dto.expenseAccountCode) || DEFAULT_EXPENSE_ACCOUNT,
          prepaidAccountCode: optionalString(dto.prepaidAccountCode) || DEFAULT_PREPAID_ACCOUNT,
          isActive: dto.isActive ?? true,
        },
      });
    } catch (err: any) {
      if (err?.code === "P2002") throw new ConflictException(`Kode kategori ${code} sudah dipakai.`);
      throw err;
    }
  }

  async updateCategory(id: number, dto: Partial<SubscriptionCategoryDto>) {
    const existing = await this.db().subCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Kategori langganan #${id} tidak ditemukan.`);
    return this.db().subCategory.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code || existing.code } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.subcategory !== undefined ? { subcategory: optionalString(dto.subcategory) } : {}),
        ...(dto.defaultBillingCycle !== undefined
          ? { defaultBillingCycle: dto.defaultBillingCycle }
          : {}),
        ...(dto.expenseAccountCode !== undefined
          ? { expenseAccountCode: dto.expenseAccountCode || existing.expenseAccountCode }
          : {}),
        ...(dto.prepaidAccountCode !== undefined
          ? { prepaidAccountCode: dto.prepaidAccountCode || existing.prepaidAccountCode }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async deleteCategory(id: number) {
    const existing = await this.db().subCategory.findUnique({
      where: { id },
      include: { _count: { select: { subscriptions: true } } },
    });
    if (!existing) throw new NotFoundException(`Kategori langganan #${id} tidak ditemukan.`);
    if (Number(existing._count?.subscriptions || 0) > 0) {
      throw new ConflictException(
        `Kategori '${existing.name}' masih dipakai oleh ${existing._count.subscriptions} langganan.`,
      );
    }
    return this.db().subCategory.delete({ where: { id } });
  }

  // ───────────────────────────── Master: provider ─────────────────────────────

  async listProviders() {
    return this.db().subProvider.findMany({
      orderBy: { code: "asc" },
      include: { _count: { select: { subscriptions: true } } },
    });
  }

  async createProvider(dto: SubscriptionProviderDto) {
    let code = optionalString(dto.code);
    if (!code) {
      const count = await this.db().subProvider.count();
      code = `PRV-${String(count + 1).padStart(3, "0")}`;
    }
    try {
      return await this.db().subProvider.create({
        data: {
          code,
          name: dto.name.trim(),
          website: optionalString(dto.website),
          supportEmail: optionalString(dto.supportEmail),
          supportPhone: optionalString(dto.supportPhone),
          loginPortalUrl: optionalString(dto.loginPortalUrl),
          accountRepresentative: optionalString(dto.accountRepresentative),
          isSeeded: dto.isSeeded ?? false,
        },
      });
    } catch (err: any) {
      if (err?.code === "P2002") throw new ConflictException(`Kode provider ${code} sudah dipakai.`);
      throw err;
    }
  }

  async updateProvider(id: number, dto: Partial<SubscriptionProviderDto>) {
    const existing = await this.db().subProvider.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Provider #${id} tidak ditemukan.`);
    return this.db().subProvider.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code || existing.code } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.website !== undefined ? { website: optionalString(dto.website) } : {}),
        ...(dto.supportEmail !== undefined
          ? { supportEmail: optionalString(dto.supportEmail) }
          : {}),
        ...(dto.supportPhone !== undefined
          ? { supportPhone: optionalString(dto.supportPhone) }
          : {}),
        ...(dto.loginPortalUrl !== undefined
          ? { loginPortalUrl: optionalString(dto.loginPortalUrl) }
          : {}),
        ...(dto.accountRepresentative !== undefined
          ? { accountRepresentative: optionalString(dto.accountRepresentative) }
          : {}),
      },
    });
  }

  async deleteProvider(id: number) {
    const existing = await this.db().subProvider.findUnique({
      where: { id },
      include: { _count: { select: { subscriptions: true } } },
    });
    if (!existing) throw new NotFoundException(`Provider #${id} tidak ditemukan.`);
    if (Number(existing._count?.subscriptions || 0) > 0) {
      throw new ConflictException(
        `Provider '${existing.name}' masih dipakai oleh ${existing._count.subscriptions} langganan.`,
      );
    }
    return this.db().subProvider.delete({ where: { id } });
  }

  // ───────────────────────────── Helpers ─────────────────────────────

  private async generateCode(prefix: "SUB" | "REN" | "CAN"): Promise<string> {
    const year = new Date().getFullYear();
    if (prefix === "SUB") {
      const last = await this.db().subSubscription.findFirst({
        where: { subscriptionCode: { startsWith: `SUB-${year}-` } },
        orderBy: { subscriptionCode: "desc" },
        select: { subscriptionCode: true },
      });
      return nextCode(prefix, year, last?.subscriptionCode);
    }
    if (prefix === "REN") {
      const last = await this.db().subRenewalHistory.findFirst({
        where: { renewalCode: { startsWith: `REN-${year}-` } },
        orderBy: { renewalCode: "desc" },
        select: { renewalCode: true },
      });
      return nextCode(prefix, year, last?.renewalCode);
    }
    const last = await this.db().subCancellationRequest.findFirst({
      where: { cancellationCode: { startsWith: `CAN-${year}-` } },
      orderBy: { cancellationCode: "desc" },
      select: { cancellationCode: true },
    });
    return nextCode(prefix, year, last?.cancellationCode);
  }

  private async userMap(ids: Array<number | null | undefined>) {
    const unique = Array.from(
      new Set(ids.filter((id): id is number => Number.isFinite(Number(id)))),
    );
    if (!unique.length) return new Map<number, any>();
    const users = await this.db().user.findMany({
      where: { id: { in: unique } },
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
        position: true,
        role: true,
      },
    });
    return new Map<number, any>(users.map((user: any) => [user.id, user]));
  }

  private async enrich<T extends Record<string, any>>(rows: T[]): Promise<any[]> {
    const users = await this.userMap(
      rows.flatMap((row) => [
        row.picUserId,
        ...(row.cancellationRequests ?? []).flatMap((c: any) => [
          c.requestedByUserId,
          c.approvedByUserId,
        ]),
        ...(row.renewalHistory ?? []).map((r: any) => r.approvedByUserId),
        ...(row.priceHistory ?? []).map((r: any) => r.approvedByUserId),
        ...(row.usageRecords ?? []).map((r: any) => r.reviewedByUserId),
        ...(row.paymentRecords ?? []).map((r: any) => r.createdById),
        ...(row.documents ?? []).map((r: any) => r.uploadedByUserId),
        ...(row.reminderLogs ?? []).map((r: any) => r.recipientUserId),
      ]),
    );
    const userName = (id: any) => (id ? users.get(Number(id)) ?? null : null);
    return rows.map((row) => ({
      ...row,
      categoryName: row.category?.name ?? null,
      providerLabel: row.provider?.name ?? row.providerName ?? null,
      picUser: row.picUserId ? users.get(Number(row.picUserId)) ?? null : null,
      daysToRenewal: row.nextRenewalDate ? daysUntil(row.nextRenewalDate) : null,
      renewalHistory: (row.renewalHistory ?? []).map((r: any) => ({
        ...r,
        approvedByUser: userName(r.approvedByUserId),
      })),
      priceHistory: (row.priceHistory ?? []).map((r: any) => ({
        ...r,
        approvedByUser: userName(r.approvedByUserId),
      })),
      usageRecords: (row.usageRecords ?? []).map((r: any) => ({
        ...r,
        reviewedByUser: userName(r.reviewedByUserId),
      })),
      paymentRecords: (row.paymentRecords ?? []).map((r: any) => ({
        ...r,
        createdByUser: userName(r.createdById),
      })),
      documents: (row.documents ?? []).map((r: any) => ({
        ...r,
        uploadedByUser: userName(r.uploadedByUserId),
      })),
      reminderLogs: (row.reminderLogs ?? []).map((r: any) => ({
        ...r,
        recipientUser: userName(r.recipientUserId),
      })),
      cancellationRequests: (row.cancellationRequests ?? []).map((c: any) => ({
        ...c,
        requestedByUser: users.get(Number(c.requestedByUserId)) ?? null,
        approvedByUser: c.approvedByUserId
          ? users.get(Number(c.approvedByUserId)) ?? null
          : null,
      })),
    }));
  }

  private computeIdentity(dto: {
    cost: number;
    billingCycle?: string;
    startDate?: Date | string | null;
    expirationDate?: Date | string | null;
  }) {
    return computeMrcArc(dto.cost, dto.billingCycle, dto.startDate, dto.expirationDate);
  }

  private normalizeAllocations(
    allocations: CreateSubscriptionDto["allocations"],
    department: string,
    cost: number,
  ) {
    const normalized = normalizePercentages(allocations, department);
    const total = allocationTotal(normalized);
    if (Math.abs(total - 100) > 0.01) {
      throw new BadRequestException(
        `Total alokasi biaya harus tepat 100%. Saat ini ${total.toFixed(2)}%.`,
      );
    }
    return normalized.map((row) => ({
      department: row.department,
      projectId: row.projectId ?? null,
      percentage: row.percentage,
      allocatedAmount: round2((Number(cost) || 0) * (row.percentage / 100)),
    }));
  }

  private rebuildAllocations(existing: any, cost: number, department: string) {
    const source = Array.isArray(existing.allocations) && existing.allocations.length > 0
      ? existing.allocations
      : [{ department, percentage: 100, projectId: null }];
    return source.map((row: any) => ({
      department: String(row.department ?? department).trim() || department,
      projectId: row.projectId ?? null,
      percentage: round2(asNumber(row.percentage, 100)),
      allocatedAmount: round2((Number(cost) || 0) * (asNumber(row.percentage, 100) / 100)),
    }));
  }

  private async generatePrepaidScheduleInternal(
    subscriptionId: number,
    options: {
      totalAmount?: number;
      startDate?: Date | string | null;
      endDate?: Date | string | null;
      replaceUnposted?: boolean;
    } = {},
  ) {
    const sub = await this.db().subSubscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) throw new NotFoundException(`Langganan #${subscriptionId} tidak ditemukan.`);
    const start = options.startDate ?? sub.startDate;
    const end =
      options.endDate ??
      sub.expirationDate ??
      addCycle(sub.startDate, sub.billingCycle, sub.expirationDate);
    const total =
      options.totalAmount !== undefined ? Number(options.totalAmount) : Number(sub.cost || 0);
    if (!start || !end || total <= 0) {
      return { created: 0, total: 0, rows: [] };
    }
    const rows = buildPrepaidRows(start, end, total);
    if (options.replaceUnposted !== false) {
      await this.db().subPrepaidSchedule.deleteMany({
        where: { subscriptionId, isPosted: false },
      });
    }
    let created = 0;
    for (const row of rows) {
      try {
        await this.db().subPrepaidSchedule.create({
          data: {
            subscriptionId,
            periodYear: row.periodYear,
            periodMonth: row.periodMonth,
            allocationDate: row.allocationDate,
            amount: row.amount,
          },
        });
        created += 1;
      } catch (err: any) {
        if (err?.code !== "P2002") throw err;
      }
    }
    return { created, total: round2(total), rows };
  }

  // ───────────────────────────── Dashboard & registry ─────────────────────────────

  async getDashboard() {
    const subscriptions = await this.db().subSubscription.findMany({
      include: {
        category: { select: { id: true, name: true, code: true } },
        provider: { select: { id: true, name: true, code: true } },
      },
      orderBy: { id: "desc" },
    });
    const today = startOfDay(new Date());
    const in30 = addDays(today, 30);
    let totalMrc = 0;
    let totalArc = 0;
    let totalActive = 0;
    let upcomingRenewals = 0;
    let overduePayments = 0;
    let expired = 0;
    let pendingCancellation = 0;
    let underReview = 0;
    const byCategory: Record<string, { count: number; mrc: number }> = {};
    const byProvider: Record<string, { count: number; mrc: number }> = {};
    const byDepartment: Record<string, { count: number; mrc: number }> = {};

    for (const sub of subscriptions) {
      if (sub.status === "CANCELLED") continue;
      const mrc = asNumber(sub.mrc);
      if (ACTIVE_STATUSES.includes(String(sub.status))) {
        totalActive += 1;
        totalMrc += mrc;
        totalArc += asNumber(sub.arc);
        const catKey = sub.category?.name || "Lainnya";
        byCategory[catKey] = byCategory[catKey] || { count: 0, mrc: 0 };
        byCategory[catKey]!.count += 1;
        byCategory[catKey]!.mrc = round2(byCategory[catKey]!.mrc + mrc);
        const provKey = sub.provider?.name || sub.providerName || "Tanpa Provider";
        byProvider[provKey] = byProvider[provKey] || { count: 0, mrc: 0 };
        byProvider[provKey]!.count += 1;
        byProvider[provKey]!.mrc = round2(byProvider[provKey]!.mrc + mrc);
        const deptKey = sub.department || "Tanpa Departemen";
        byDepartment[deptKey] = byDepartment[deptKey] || { count: 0, mrc: 0 };
        byDepartment[deptKey]!.count += 1;
        byDepartment[deptKey]!.mrc = round2(byDepartment[deptKey]!.mrc + mrc);

        if (sub.nextRenewalDate) {
          const renewal = startOfDay(sub.nextRenewalDate);
          if (renewal >= today && renewal <= in30) upcomingRenewals += 1;
        }
      }
      if (sub.status === "CANCELLATION_PENDING") pendingCancellation += 1;
      if (sub.status === "EXPIRED") expired += 1;
      if (sub.paymentStatus === "OVERDUE") overduePayments += 1;
      if (sub.status === "PENDING_APPROVAL" || sub.status === "RENEWAL_PENDING") {
        underReview += 1;
      }
    }

    const upcoming = subscriptions
      .filter(
        (sub: any) =>
          sub.nextRenewalDate &&
          OPEN_STATUSES.includes(String(sub.status)) &&
          startOfDay(sub.nextRenewalDate) >= today,
      )
      .sort(
        (a: any, b: any) =>
          startOfDay(a.nextRenewalDate).getTime() - startOfDay(b.nextRenewalDate).getTime(),
      )
      .slice(0, 10)
      .map((sub: any) => ({
        ...sub,
        categoryName: sub.category?.name ?? null,
        providerLabel: sub.provider?.name ?? sub.providerName ?? null,
        daysToRenewal: daysUntil(sub.nextRenewalDate),
      }));

    const recentPayments = await this.db().subPaymentRecord.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        subscription: { select: { subscriptionCode: true, serviceName: true } },
      },
    });

    return {
      overview: {
        totalActiveSubscriptions: totalActive,
        totalMonthlyRecurringCost: round2(totalMrc),
        totalAnnualRecurringCost: round2(totalArc),
        upcomingRenewals,
        overduePayments,
        expiredSubscriptions: expired,
        pendingCancellation,
        underReview,
      },
      breakdowns: {
        byCategory: Object.entries(byCategory).map(([name, value]) => ({ name, ...value })),
        byProvider: Object.entries(byProvider).map(([name, value]) => ({ name, ...value })),
        byDepartment: Object.entries(byDepartment).map(([name, value]) => ({ name, ...value })),
      },
      upcomingRenewals: upcoming,
      recentPayments,
    };
  }

  async list(query: SubscriptionQuery) {
    const page = Math.max(1, asNumber(query.page, 1));
    const limit = Math.min(200, Math.max(1, asNumber(query.limit, 20)));
    const skip = (page - 1) * limit;
    const q = optionalString(query.q);
    const where: any = {};
    if (q) {
      where.OR = [
        { subscriptionCode: { contains: q } },
        { serviceName: { contains: q } },
        { providerName: { contains: q } },
        { accountIdentifier: { contains: q } },
        { department: { contains: q } },
        { provider: { name: { contains: q } } },
        { category: { name: { contains: q } } },
      ];
    }
    if (query.categoryId) where.categoryId = Number(query.categoryId);
    if (query.providerId) where.providerId = Number(query.providerId);
    if (query.status) where.status = query.status;
    if (query.paymentStatus) where.paymentStatus = query.paymentStatus;
    if (query.billingCycle) where.billingCycle = query.billingCycle;
    if (query.department) where.department = query.department;
    if (query.picUserId) where.picUserId = Number(query.picUserId);
    if (query.currency) where.currency = query.currency;
    if (query.from || query.to) {
      where.nextRenewalDate = {
        ...(query.from ? { gte: dateOnly(query.from) } : {}),
        ...(query.to ? { lte: dateOnly(query.to) } : {}),
      };
    }
    if (query.dueInDays) {
      const days = Number(query.dueInDays);
      if (Number.isFinite(days)) {
        const today = startOfDay(new Date());
        where.nextRenewalDate = {
          gte: today,
          lte: addDays(today, Math.max(0, days)),
        };
      }
    }
    const [total, rows] = await Promise.all([
      this.db().subSubscription.count({ where }),
      this.db().subSubscription.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ nextRenewalDate: "asc" }, { id: "desc" }],
        include: {
          category: true,
          provider: true,
          allocations: true,
          cancellationRequests: { orderBy: { id: "desc" }, take: 1 },
          _count: {
            select: {
              paymentRecords: true,
              renewalHistory: true,
              documents: true,
              prepaidSchedules: true,
            },
          },
        },
      }),
    ]);
    const items = await this.enrich(rows);
    return {
      items,
      data: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async get(id: number) {
    const row = await this.db().subSubscription.findUnique({
      where: { id },
      include: {
        category: true,
        provider: true,
        allocations: { orderBy: { id: "asc" } },
        renewalHistory: { orderBy: { id: "desc" } },
        priceHistory: { orderBy: { id: "desc" } },
        usageRecords: { orderBy: { id: "desc" } },
        paymentRecords: { orderBy: { id: "desc" } },
        prepaidSchedules: { orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }] },
        billingSchedules: { orderBy: { dueDate: "asc" } },
        cancellationRequests: { orderBy: { id: "desc" } },
        documents: { orderBy: { id: "desc" } },
        reminderLogs: { orderBy: { id: "desc" }, take: 30 },
      },
    });
    if (!row) throw new NotFoundException(`Langganan #${id} tidak ditemukan.`);
    const [enriched] = await this.enrich([row]);
    const users = await this.userMap([
      ...(row.renewalHistory ?? []).map((h: any) => h.approvedByUserId),
      ...(row.priceHistory ?? []).map((h: any) => h.approvedByUserId),
      ...(row.usageRecords ?? []).map((h: any) => h.reviewedByUserId),
      ...(row.paymentRecords ?? []).map((h: any) => h.createdById),
      ...(row.documents ?? []).map((h: any) => h.uploadedByUserId),
    ]);
    return {
      ...enriched,
      renewalHistory: (row.renewalHistory ?? []).map((h: any) => ({
        ...h,
        approvedByUser: h.approvedByUserId ? users.get(Number(h.approvedByUserId)) ?? null : null,
      })),
      priceHistory: (row.priceHistory ?? []).map((h: any) => ({
        ...h,
        approvedByUser: h.approvedByUserId ? users.get(Number(h.approvedByUserId)) ?? null : null,
      })),
      usageRecords: (row.usageRecords ?? []).map((h: any) => ({
        ...h,
        reviewedByUser: h.reviewedByUserId
          ? users.get(Number(h.reviewedByUserId)) ?? null
          : null,
      })),
      paymentRecords: (row.paymentRecords ?? []).map((h: any) => ({
        ...h,
        createdByUser: h.createdById ? users.get(Number(h.createdById)) ?? null : null,
      })),
      documents: (row.documents ?? []).map((h: any) => ({
        ...h,
        uploadedByUser: h.uploadedByUserId
          ? users.get(Number(h.uploadedByUserId)) ?? null
          : null,
      })),
    };
  }

  async create(dto: CreateSubscriptionDto, user?: RequestUser) {
    const category = await this.db().subCategory.findUnique({
      where: { id: Number(dto.categoryId) },
    });
    if (!category) throw new BadRequestException("Kategori langganan tidak ditemukan.");

    let provider: any = null;
    if (Number(dto.providerId) > 0) {
      provider = await this.db().subProvider.findUnique({
        where: { id: Number(dto.providerId) },
      });
      if (!provider) throw new BadRequestException("Provider langganan tidak ditemukan.");
    }
    const providerName = provider?.name ?? optionalString(dto.providerName);
    if (!providerName) throw new BadRequestException("Provider langganan wajib dipilih.");

    const startDate = dateOnly(dto.startDate);
    if (!startDate) throw new BadRequestException("Tanggal mulai wajib diisi.");
    const billingCycle = dto.billingCycle || category.defaultBillingCycle || "ANNUAL";
    const expirationDate =
      dateOnly(dto.expirationDate) ?? addCycle(startDate, billingCycle);
    if (expirationDate < startDate) {
      throw new BadRequestException("Tanggal berakhir harus setelah tanggal mulai.");
    }
    const nextRenewalDate = dateOnly(dto.nextRenewalDate) ?? expirationDate;
    const cost = round2(asNumber(dto.cost));
    const tax = round2(asNumber(dto.tax));
    const { mrc, arc } = this.computeIdentity({
      cost,
      billingCycle,
      startDate,
      expirationDate,
    });
    const allocations = this.normalizeAllocations(
      dto.allocations,
      dto.department,
      cost,
    );
    const subscriptionCode = await this.generateCode("SUB");

    const created = await this.db().$transaction(async (tx: any) => {
      const subscription = await tx.subSubscription.create({
        data: {
          subscriptionCode,
          serviceName: dto.serviceName.trim(),
          categoryId: category.id,
          providerId: provider?.id ?? null,
          providerName,
          accountIdentifier: optionalString(dto.accountIdentifier),
          serviceUrl: optionalString(dto.serviceUrl),
          subscriptionPlan: optionalString(dto.subscriptionPlan),
          billingCycle,
          startDate,
          expirationDate,
          nextRenewalDate,
          autoRenewal: dto.autoRenewal ?? false,
          currency: dto.currency || "IDR",
          cost,
          tax,
          originalCurrency: optionalString(dto.originalCurrency),
          originalAmount:
            dto.originalAmount !== undefined ? asNumber(dto.originalAmount) : null,
          exchangeRate: dto.exchangeRate !== undefined ? asNumber(dto.exchangeRate) : null,
          exchangeRateDate: dateOnly(dto.exchangeRateDate),
          idrEquivalent:
            dto.idrEquivalent !== undefined
              ? asNumber(dto.idrEquivalent)
              : dto.currency && dto.currency !== "IDR"
                ? round2(asNumber(dto.originalAmount) * asNumber(dto.exchangeRate, 1))
                : cost,
          mrc,
          arc,
          department: dto.department.trim(),
          picUserId: Number(dto.picUserId) > 0 ? Number(dto.picUserId) : null,
          businessPurpose: dto.businessPurpose.trim(),
          status: dto.status || "ACTIVE",
          paymentStatus: dto.paymentStatus || "UNPAID",
          expenseAccountCode:
            optionalString(dto.expenseAccountCode) || category.expenseAccountCode,
          prepaidAccountCode:
            optionalString(dto.prepaidAccountCode) || category.prepaidAccountCode,
          notes: optionalString(dto.notes),
          createdById: user?.id ?? null,
          allocations: { create: allocations },
        },
        include: { allocations: true, category: true, provider: true },
      });
      return subscription;
    });

    if (String(billingCycle).toUpperCase() !== "MONTHLY") {
      await this.generatePrepaidScheduleInternal(created.id, {
        totalAmount: cost,
        startDate,
        endDate: expirationDate,
      }).catch(() => null);
    }

    if (created.paymentStatus === "PAID") {
      const paymentDate = dateOnly(dto.paymentDate) ?? startDate;
      const invoiceNumber =
        optionalString(dto.paymentInvoiceNumber) ||
        `INV/${created.subscriptionCode}/${formatPeriodLabel(paymentDate)}`;
      const fundingAccount =
        optionalString(dto.paymentAccountCode) || DEFAULT_FUNDING_ACCOUNT;
      const isPrepaid = String(billingCycle).toUpperCase() !== "MONTHLY";
      const debitAccount = isPrepaid
        ? created.prepaidAccountCode || category.prepaidAccountCode || DEFAULT_PREPAID_ACCOUNT
        : created.expenseAccountCode || category.expenseAccountCode || DEFAULT_EXPENSE_ACCOUNT;

      const payment = await this.db().subPaymentRecord.create({
        data: {
          subscriptionId: created.id,
          invoiceNumber,
          invoiceDate: startDate,
          dueDate: expirationDate,
          paymentDate,
          billingPeriod: formatPeriodLabel(startDate),
          amount: cost,
          tax,
          currency: created.currency || "IDR",
          paymentStatus: "PAID",
          paymentProofUrl: optionalString(dto.paymentProofUrl),
          createdById: user?.id ?? null,
        },
      });

      const total = round2(cost + tax);
      const lines: Array<{ accountCode: string; debit: number; credit: number; memo: string }> = [
        {
          accountCode: debitAccount,
          debit: cost,
          credit: 0,
          memo: `${isPrepaid ? "Biaya dibayar di muka" : "Beban"} ${created.serviceName}`,
        },
      ];
      if (tax > 0) {
        lines.push({
          accountCode: VAT_IN_ACCOUNT,
          debit: tax,
          credit: 0,
          memo: `PPN masukan ${created.subscriptionCode}`,
        });
      }
      lines.push({
        accountCode: fundingAccount,
        debit: 0,
        credit: total,
        memo: `Pembayaran ${created.subscriptionCode} · ${created.serviceName}`,
      });

      try {
        const journal = await this.postingService.post({
          date: paymentDate,
          source: "SUBSCRIPTION",
          sourceType: "SubPaymentRecord",
          sourceId: payment.id,
          event: "PAYMENT",
          refNo: created.subscriptionCode,
          memo: `Pembayaran langganan ${created.subscriptionCode} · ${created.serviceName} (${invoiceNumber})`,
          createdById: user?.id ?? null,
          lines,
        });
        if (journal?.id) {
          await this.db().subPaymentRecord.update({
            where: { id: payment.id },
            data: { financeJournalId: journal.id },
          });
        }
      } catch (err) {
        console.error("Gagal posting jurnal saat create subscription PAID:", err);
      }
    }

    await this.audit.log({
      actor: user,
      action: "SUBSCRIPTION_CREATE",
      entityType: "subscriptions",
      entityId: created.id,
      detail: `${created.subscriptionCode} · ${created.serviceName}`,
    });
    this.notifications.dataChange("subscriptions", "create", created.id);
    return this.get(created.id);
  }

  async update(id: number, dto: UpdateSubscriptionDto, user?: RequestUser) {
    const existing = await this.get(id);
    const categoryId = dto.categoryId !== undefined ? Number(dto.categoryId) : existing.categoryId;
    const category = await this.db().subCategory.findUnique({ where: { id: categoryId } });
    if (!category) throw new BadRequestException("Kategori langganan tidak ditemukan.");

    let providerId = existing.providerId;
    if (dto.providerId !== undefined) {
      const nextId = Number(dto.providerId);
      providerId = nextId > 0 ? nextId : null;
    }
    let providerName = dto.providerName !== undefined ? optionalString(dto.providerName) : existing.providerName;
    if (providerId) {
      const provider = await this.db().subProvider.findUnique({ where: { id: providerId } });
      if (!provider) throw new BadRequestException("Provider langganan tidak ditemukan.");
      providerName = provider.name;
    }
    if (!providerName) throw new BadRequestException("Provider langganan wajib dipilih.");

    const startDate = dateOnly(dto.startDate) ?? existing.startDate;
    const billingCycle = dto.billingCycle ?? existing.billingCycle;
    const expirationDate =
      dto.expirationDate !== undefined
        ? dateOnly(dto.expirationDate)
        : existing.expirationDate;
    if (expirationDate && expirationDate < startDate) {
      throw new BadRequestException("Tanggal berakhir harus setelah tanggal mulai.");
    }
    const nextRenewalDate =
      dto.nextRenewalDate !== undefined
        ? dateOnly(dto.nextRenewalDate)
        : existing.nextRenewalDate;
    const cost = dto.cost !== undefined ? round2(asNumber(dto.cost)) : asNumber(existing.cost);
    const tax = dto.tax !== undefined ? round2(asNumber(dto.tax)) : asNumber(existing.tax);
    const { mrc, arc } = this.computeIdentity({
      cost,
      billingCycle,
      startDate,
      expirationDate,
    });
    const department = dto.department !== undefined ? dto.department : existing.department;
    const allocations =
      dto.allocations !== undefined
        ? this.normalizeAllocations(dto.allocations, department, cost)
        : this.rebuildAllocations(existing, cost, department);

    const updated = await this.db().$transaction(async (tx: any) => {
      if (allocations) {
        await tx.subCostAllocation.deleteMany({ where: { subscriptionId: id } });
        await tx.subCostAllocation.createMany({
          data: allocations.map((row: any) => ({ ...row, subscriptionId: id })),
        });
      }
      return tx.subSubscription.update({
        where: { id },
        data: {
          ...(dto.serviceName !== undefined ? { serviceName: dto.serviceName.trim() } : {}),
          categoryId,
          providerId,
          providerName,
          ...(dto.accountIdentifier !== undefined
            ? { accountIdentifier: optionalString(dto.accountIdentifier) }
            : {}),
          ...(dto.serviceUrl !== undefined ? { serviceUrl: optionalString(dto.serviceUrl) } : {}),
          ...(dto.subscriptionPlan !== undefined
            ? { subscriptionPlan: optionalString(dto.subscriptionPlan) }
            : {}),
          billingCycle,
          startDate,
          expirationDate,
          nextRenewalDate,
          ...(dto.autoRenewal !== undefined ? { autoRenewal: dto.autoRenewal } : {}),
          ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
          cost,
          tax,
          ...(dto.originalCurrency !== undefined
            ? { originalCurrency: optionalString(dto.originalCurrency) }
            : {}),
          ...(dto.originalAmount !== undefined
            ? { originalAmount: asNumber(dto.originalAmount) }
            : {}),
          ...(dto.exchangeRate !== undefined
            ? { exchangeRate: asNumber(dto.exchangeRate) }
            : {}),
          ...(dto.exchangeRateDate !== undefined
            ? { exchangeRateDate: dateOnly(dto.exchangeRateDate) }
            : {}),
          ...(dto.idrEquivalent !== undefined
            ? { idrEquivalent: asNumber(dto.idrEquivalent) }
            : {}),
          mrc,
          arc,
          department,
          ...(dto.picUserId !== undefined
            ? { picUserId: Number(dto.picUserId) > 0 ? Number(dto.picUserId) : null }
            : {}),
          ...(dto.businessPurpose !== undefined
            ? { businessPurpose: dto.businessPurpose }
            : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.paymentStatus !== undefined ? { paymentStatus: dto.paymentStatus } : {}),
          ...(dto.expenseAccountCode !== undefined
            ? { expenseAccountCode: optionalString(dto.expenseAccountCode) }
            : {}),
          ...(dto.prepaidAccountCode !== undefined
            ? { prepaidAccountCode: optionalString(dto.prepaidAccountCode) }
            : {}),
          ...(dto.notes !== undefined ? { notes: optionalString(dto.notes) } : {}),
        },
      });
    });

    await this.audit.log({
      actor: user,
      action: "SUBSCRIPTION_UPDATE",
      entityType: "subscriptions",
      entityId: updated.id,
      detail: updated.subscriptionCode,
    });
    this.notifications.dataChange("subscriptions", "update", updated.id);
    return this.get(updated.id);
  }

  async remove(id: number, user?: RequestUser) {
    const existing = await this.get(id);
    if (existing.status === "ACTIVE" && existing.paymentRecords?.length) {
      throw new ConflictException(
        "Langganan aktif yang sudah memiliki pembayaran tidak dapat dihapus. Gunakan pembatalan.",
      );
    }
    await this.db().subSubscription.delete({ where: { id } });
    await this.audit.log({
      actor: user,
      action: "SUBSCRIPTION_DELETE",
      entityType: "subscriptions",
      entityId: id,
      detail: existing.subscriptionCode,
    });
    this.notifications.dataChange("subscriptions", "delete", id);
    return { success: true };
  }

  // ───────────────────────────── Renewal & perubahan paket ─────────────────────────────

  async renew(id: number, dto: RenewSubscriptionDto, user?: RequestUser) {
    const existing = await this.get(id);
    if (existing.status === "CANCELLED") {
      throw new BadRequestException("Langganan yang sudah dibatalkan tidak dapat diperpanjang.");
    }
    const newStart = dateOnly(dto.newPeriodStart);
    const newEnd = dateOnly(dto.newPeriodEnd);
    if (!newStart || !newEnd) throw new BadRequestException("Periode baru tidak valid.");
    if (newEnd < newStart) {
      throw new BadRequestException("Tanggal akhir periode baru harus setelah tanggal mulai.");
    }
    const previousPeriodStart = dateOnly(existing.startDate) ?? newStart;
    const previousPeriodEnd =
      dateOnly(existing.expirationDate) ??
      addCycle(existing.startDate, existing.billingCycle, existing.expirationDate);
    const renewalCost = round2(asNumber(dto.renewalCost));
    const renewalTax =
      dto.renewalTax !== undefined ? round2(asNumber(dto.renewalTax)) : asNumber(existing.tax);
    const { mrc, arc } = this.computeIdentity({
      cost: renewalCost,
      billingCycle: existing.billingCycle,
      startDate: newStart,
      expirationDate: newEnd,
    });
    const renewalCode = await this.generateCode("REN");
    const approvalStatus = dto.approvalStatus || "APPROVED";
    const statusAfter = approvalStatus === "PENDING" ? "RENEWAL_PENDING" : "ACTIVE";

    await this.db().$transaction(async (tx: any) => {
      await tx.subRenewalHistory.create({
        data: {
          renewalCode,
          subscriptionId: id,
          previousPeriodStart,
          previousPeriodEnd,
          newPeriodStart: newStart,
          newPeriodEnd: newEnd,
          previousCost: asNumber(existing.cost),
          renewalCost,
          invoiceNumber: optionalString(dto.invoiceNumber),
          approvalStatus,
          approvedByUserId: approvalStatus === "APPROVED" ? user?.id ?? null : null,
          approvedAt: approvalStatus === "APPROVED" ? new Date() : null,
          notes: optionalString(dto.notes),
          createdById: user?.id ?? null,
        },
      });
      await tx.subSubscription.update({
        where: { id },
        data: {
          startDate: newStart,
          cost: renewalCost,
          tax: renewalTax,
          mrc,
          arc,
          expirationDate: newEnd,
          nextRenewalDate: newEnd,
          status: statusAfter,
          paymentStatus: "UNPAID",
        },
      });
      const allocations = this.rebuildAllocations(
        existing,
        renewalCost,
        existing.department,
      );
      await tx.subCostAllocation.deleteMany({ where: { subscriptionId: id } });
      await tx.subCostAllocation.createMany({
        data: allocations.map((row: any) => ({ ...row, subscriptionId: id })),
      });
    });

    await this.audit.log({
      actor: user,
      action: "SUBSCRIPTION_RENEW",
      entityType: "subscriptions",
      entityId: id,
      detail: `${renewalCode} · ${formatPeriodLabel(newStart)} s/d ${formatPeriodLabel(newEnd)}`,
    });
    this.notifications.dataChange("subscriptions", "update", id);
    return this.get(id);
  }

  async changePlan(id: number, dto: ChangeSubscriptionPlanDto, user?: RequestUser) {
    const existing = await this.get(id);
    if (existing.status === "CANCELLED") {
      throw new BadRequestException("Langganan yang sudah dibatalkan tidak dapat diubah paketnya.");
    }
    const newCost = round2(asNumber(dto.newCost));
    const { mrc, arc } = this.computeIdentity({
      cost: newCost,
      billingCycle: existing.billingCycle,
      startDate: existing.startDate,
      expirationDate: existing.expirationDate,
    });
    const effectiveDate = dateOnly(dto.effectiveDate);
    if (!effectiveDate) throw new BadRequestException("Tanggal efektif tidak valid.");

    await this.db().$transaction(async (tx: any) => {
      await tx.subPriceHistory.create({
        data: {
          subscriptionId: id,
          changeType: dto.changeType,
          previousPlan: existing.subscriptionPlan ?? null,
          newPlan: dto.newPlan.trim(),
          previousCost: asNumber(existing.cost),
          newCost,
          effectiveDate,
          changeReason: dto.changeReason.trim(),
          approvedByUserId: dto.approvedByUserId ?? user?.id ?? null,
          createdById: user?.id ?? null,
        },
      });
      await tx.subSubscription.update({
        where: { id },
        data: {
          subscriptionPlan: dto.newPlan.trim(),
          cost: newCost,
          mrc,
          arc,
          ...(existing.status === "RENEWAL_PENDING" ? { status: "ACTIVE" } : {}),
        },
      });
      const allocations = this.rebuildAllocations(
        existing,
        newCost,
        existing.department,
      );
      await tx.subCostAllocation.deleteMany({ where: { subscriptionId: id } });
      await tx.subCostAllocation.createMany({
        data: allocations.map((row: any) => ({ ...row, subscriptionId: id })),
      });
    });

    await this.audit.log({
      actor: user,
      action: `SUBSCRIPTION_${dto.changeType}`,
      entityType: "subscriptions",
      entityId: id,
      detail: `${existing.subscriptionCode} · ${dto.newPlan} · Rp${newCost.toLocaleString("id-ID")}`,
    });
    this.notifications.dataChange("subscriptions", "update", id);
    return this.get(id);
  }

  // ───────────────────────────── Pembayaran & jurnal ─────────────────────────────

  async recordPayment(id: number, dto: SubscriptionPaymentDto, user?: RequestUser) {
    const existing = await this.get(id);
    const amount = round2(asNumber(dto.amount));
    const tax = round2(asNumber(dto.tax));
    if (amount <= 0) throw new BadRequestException("Nominal pembayaran harus lebih dari 0.");
    const paymentDate = dateOnly(dto.paymentDate) ?? dateOnly(new Date())!;
    const isPrepaid =
      dto.prepaid ?? String(existing.billingCycle).toUpperCase() !== "MONTHLY";
    const payment = await this.db().subPaymentRecord.create({
      data: {
        subscriptionId: id,
        invoiceNumber: optionalString(dto.invoiceNumber),
        invoiceDate: dateOnly(dto.invoiceDate),
        dueDate: dateOnly(dto.dueDate) ?? existing.expirationDate,
        paymentDate,
        billingPeriod: optionalString(dto.billingPeriod),
        amount,
        tax,
        currency: dto.currency || existing.currency || "IDR",
        paymentStatus: dto.paymentStatus || "PAID",
        financeJournalId: dto.financeJournalId ?? null,
        paymentProofUrl: optionalString(dto.paymentProofUrl),
        notes: optionalString(dto.notes),
        createdById: user?.id ?? null,
      },
    });

    let journal: any = null;
    if (dto.postJournal) {
      const expenseAccount =
        existing.expenseAccountCode ||
        existing.category?.expenseAccountCode ||
        DEFAULT_EXPENSE_ACCOUNT;
      const debitAccount = isPrepaid
        ? existing.prepaidAccountCode ||
          existing.category?.prepaidAccountCode ||
          DEFAULT_PREPAID_ACCOUNT
        : expenseAccount;
      const fundingAccount =
        dto.fundingType === "AP"
          ? optionalString(dto.fundingAccountCode) || DEFAULT_AP_ACCOUNT
          : optionalString(dto.fundingAccountCode) || DEFAULT_FUNDING_ACCOUNT;
      const total = round2(amount + tax);
      const lines: Array<{ accountCode: string; debit: number; credit: number; memo: string }> = [
        {
          accountCode: debitAccount,
          debit: amount,
          credit: 0,
          memo: `${isPrepaid ? "Biaya dibayar di muka" : "Beban"} ${existing.serviceName}`,
        },
      ];
      if (tax > 0) {
        lines.push({
          accountCode: VAT_IN_ACCOUNT,
          debit: tax,
          credit: 0,
          memo: `PPN masukan ${existing.subscriptionCode}`,
        });
      }
      lines.push({
        accountCode: fundingAccount,
        debit: 0,
        credit: total,
        memo: `Pembayaran ${existing.subscriptionCode} · ${existing.serviceName}`,
      });
      try {
        journal = await this.postingService.post({
          date: paymentDate,
          source: "SUBSCRIPTION",
          sourceType: "SubPaymentRecord",
          sourceId: payment.id,
          event: "PAYMENT",
          refNo: existing.subscriptionCode,
          memo: `Pembayaran langganan ${existing.subscriptionCode} · ${existing.serviceName}`,
          createdById: user?.id ?? null,
          lines,
        });
      } catch (err) {
        await this.db().subPaymentRecord.delete({ where: { id: payment.id } }).catch(() => null);
        throw err;
      }
      if (journal?.id) {
        await this.db().subPaymentRecord.update({
          where: { id: payment.id },
          data: { financeJournalId: journal.id },
        });
      }
    }

    if (isPrepaid) {
      await this.generatePrepaidScheduleInternal(id, {
        totalAmount: amount,
        startDate: existing.startDate,
        endDate: existing.expirationDate,
        replaceUnposted: false,
      }).catch(() => null);
    }

    const periodStart = dateOnly(existing.startDate);
    const periodEnd = dateOnly(existing.expirationDate);
    const currentPeriod = periodStart ? formatPeriodLabel(periodStart) : null;
    const periodFilters: any[] = [];
    if (periodStart || periodEnd) {
      periodFilters.push({
        paymentDate: {
          ...(periodStart ? { gte: periodStart } : {}),
          ...(periodEnd ? { lte: periodEnd } : {}),
        },
      });
    }
    if (currentPeriod) periodFilters.push({ billingPeriod: currentPeriod });
    const payments = await this.db().subPaymentRecord.findMany({
      where: {
        subscriptionId: id,
        paymentStatus: { notIn: ["CANCELLED", "REFUNDED"] },
        ...(periodFilters.length ? { OR: periodFilters } : {}),
      },
    });
    const paid = round2(
      payments.reduce(
        (sum: number, row: any) => sum + asNumber(row.amount) + asNumber(row.tax),
        0,
      ),
    );
    const dueTotal = round2(asNumber(existing.cost) + asNumber(existing.tax));
    const paymentStatus =
      paid >= dueTotal - 0.01 ? "PAID" : paid > 0 ? "PARTIALLY_PAID" : "UNPAID";
    await this.db().subSubscription.update({
      where: { id },
      data: { paymentStatus },
    });

    await this.audit.log({
      actor: user,
      action: "SUBSCRIPTION_PAYMENT",
      entityType: "subscriptions",
      entityId: id,
      detail: `${existing.subscriptionCode} · Rp${(amount + tax).toLocaleString("id-ID")}${journal?.number ? ` · ${journal.number}` : ""}`,
    });
    this.notifications.dataChange("subscriptions", "update", id);
    return this.get(id);
  }

  async generatePrepaidSchedule(id: number, dto: PrepaidGenerateDto, user?: RequestUser) {
    const result = await this.generatePrepaidScheduleInternal(id, {
      totalAmount: dto.totalAmount,
      startDate: dto.startDate ? dateOnly(dto.startDate) : undefined,
      endDate: dto.endDate ? dateOnly(dto.endDate) : undefined,
    });
    await this.audit.log({
      actor: user,
      action: "SUBSCRIPTION_PREPAID_GENERATE",
      entityType: "subscriptions",
      entityId: id,
      detail: `${result.created} jadwal · total Rp${result.total.toLocaleString("id-ID")}`,
    });
    return { ...result, subscription: await this.get(id) };
  }

  async postPrepaid(dto: PostPrepaidDto, user?: RequestUser) {
    const where: any = {
      periodYear: Number(dto.periodYear),
      periodMonth: Number(dto.periodMonth),
      isPosted: false,
    };
    if (dto.scheduleIds?.length) where.id = { in: dto.scheduleIds.map(Number) };
    const schedules = await this.db().subPrepaidSchedule.findMany({
      where,
      include: {
        subscription: { include: { category: true } },
      },
    });
    if (!schedules.length) {
      return {
        message: `Tidak ada jadwal amortisasi yang belum diposting untuk ${dto.periodYear}-${String(dto.periodMonth).padStart(2, "0")}.`,
        postedCount: 0,
        totalAmount: 0,
        errors: [],
      };
    }
    let postedCount = 0;
    let totalAmount = 0;
    const errors: Array<{ scheduleId: number; message: string }> = [];
    for (const schedule of schedules) {
      const sub = schedule.subscription;
      const expenseAccount =
        sub.expenseAccountCode ||
        sub.category?.expenseAccountCode ||
        DEFAULT_EXPENSE_ACCOUNT;
      const prepaidAccount =
        sub.prepaidAccountCode ||
        sub.category?.prepaidAccountCode ||
        DEFAULT_PREPAID_ACCOUNT;
      const amount = round2(asNumber(schedule.amount));
      if (amount <= 0) continue;
      try {
        const journal = await this.postingService.post({
          date: schedule.allocationDate,
          source: "SUBSCRIPTION_AMORTIZATION",
          sourceType: "SubPrepaidSchedule",
          sourceId: schedule.id,
          event: `AMORT-${schedule.periodYear}-${schedule.periodMonth}`,
          refNo: sub.subscriptionCode,
          memo: `Amortisasi biaya dibayar di muka ${sub.subscriptionCode} · ${sub.serviceName} (${schedule.periodYear}/${String(schedule.periodMonth).padStart(2, "0")})`,
          createdById: user?.id ?? null,
          lines: [
            {
              accountCode: expenseAccount,
              debit: amount,
              credit: 0,
              memo: `Beban langganan ${sub.serviceName}`,
            },
            {
              accountCode: prepaidAccount,
              debit: 0,
              credit: amount,
              memo: `Amortisasi prepaid ${sub.subscriptionCode}`,
            },
          ],
        });
        await this.db().subPrepaidSchedule.update({
          where: { id: schedule.id },
          data: {
            isPosted: true,
            journalNumber: journal?.number ?? null,
            journalEntryId: journal?.id ?? null,
            postedAt: new Date(),
            postedById: user?.id ?? null,
          },
        });
        postedCount += 1;
        totalAmount = round2(totalAmount + amount);
      } catch (err: any) {
        errors.push({
          scheduleId: schedule.id,
          message: String(err?.message ?? err),
        });
      }
    }
    await this.audit.log({
      actor: user,
      action: "SUBSCRIPTION_PREPAID_POST",
      entityType: "subscriptions",
      entityId: 0,
      detail: `Periode ${dto.periodYear}-${dto.periodMonth}: ${postedCount} jadwal · Rp${totalAmount.toLocaleString("id-ID")}`,
    });
    this.notifications.dataChange("subscriptions", "update");
    return {
      message: `Berhasil memposting ${postedCount} amortisasi periode ${dto.periodYear}-${String(dto.periodMonth).padStart(2, "0")}.`,
      postedCount,
      totalAmount,
      errors,
    };
  }

  // ───────────────────────────── Recurring expense draft ─────────────────────────────

  async listBillingDrafts(query: SubscriptionQuery) {
    const where: any = {};
    if (query.q) {
      where.subscription = {
        OR: [
          { subscriptionCode: { contains: query.q } },
          { serviceName: { contains: query.q } },
        ],
      };
    }
    if (query.status) where.status = query.status;
    const [rows, total] = await Promise.all([
      this.db().subBillingSchedule.findMany({
        where,
        orderBy: { dueDate: "asc" },
        include: {
          subscription: {
            include: { category: true, provider: true },
          },
        },
      }),
      this.db().subBillingSchedule.count({ where }),
    ]);
    return { items: rows, data: rows, total, page: 1, limit: rows.length };
  }

  async generateBillingDraft(id: number, user?: RequestUser) {
    const sub = await this.get(id);
    const dueDate =
      dateOnly(sub.nextRenewalDate) ??
      dateOnly(sub.expirationDate) ??
      addCycle(sub.startDate, sub.billingCycle);
    const existing = await this.db().subBillingSchedule.findFirst({
      where: { subscriptionId: id, dueDate },
    });
    if (existing) return existing;
    const draft = await this.db().subBillingSchedule.create({
      data: {
        subscriptionId: id,
        dueDate,
        periodLabel: formatPeriodLabel(dueDate),
        amount: round2(asNumber(sub.cost) + asNumber(sub.tax)),
        status: "DRAFT",
      },
    });
    await this.audit.log({
      actor: user,
      action: "SUBSCRIPTION_BILLING_DRAFT",
      entityType: "subscriptions",
      entityId: id,
      detail: `${sub.subscriptionCode} · ${formatPeriodLabel(dueDate)}`,
    });
    return draft;
  }

  async confirmBillingDraft(
    draftId: number,
    options: { postJournal?: boolean },
    user?: RequestUser,
  ) {
    const draft = await this.db().subBillingSchedule.findUnique({
      where: { id: draftId },
      include: { subscription: { include: { category: true } } },
    });
    if (!draft) throw new NotFoundException(`Draft penagihan #${draftId} tidak ditemukan.`);
    if (draft.status === "POSTED") return draft;
    const sub = draft.subscription;
    let journal: any = null;
    if (options.postJournal) {
      const isPrepaid = String(sub.billingCycle).toUpperCase() !== "MONTHLY";
      const debitAccount = isPrepaid
        ? sub.prepaidAccountCode || sub.category?.prepaidAccountCode || DEFAULT_PREPAID_ACCOUNT
        : sub.expenseAccountCode || sub.category?.expenseAccountCode || DEFAULT_EXPENSE_ACCOUNT;
      const amount = round2(asNumber(draft.amount));
      journal = await this.postingService.post({
        date: draft.dueDate,
        source: "SUBSCRIPTION_BILLING",
        sourceType: "SubBillingSchedule",
        sourceId: draft.id,
        event: `BILLING-${formatPeriodLabel(draft.dueDate)}`,
        refNo: sub.subscriptionCode,
        memo: `Tagihan langganan ${sub.subscriptionCode} · ${sub.serviceName} (${draft.periodLabel ?? formatPeriodLabel(draft.dueDate)})`,
        createdById: user?.id ?? null,
        lines: [
          {
            accountCode: debitAccount,
            debit: amount,
            credit: 0,
            memo: `${isPrepaid ? "Biaya dibayar di muka" : "Beban"} ${sub.serviceName}`,
          },
          {
            accountCode: DEFAULT_AP_ACCOUNT,
            debit: 0,
            credit: amount,
            memo: `Hutang provider ${sub.providerName ?? sub.subscriptionCode}`,
          },
        ],
      });
    }
    const updated = await this.db().subBillingSchedule.update({
      where: { id: draft.id },
      data: {
        status: journal ? "POSTED" : "CONFIRMED",
        journalEntryId: journal?.id ?? draft.journalEntryId ?? null,
        confirmedAt: new Date(),
        confirmedById: user?.id ?? null,
      },
    });
    await this.audit.log({
      actor: user,
      action: "SUBSCRIPTION_BILLING_CONFIRM",
      entityType: "subscriptions",
      entityId: sub.id,
      detail: `${sub.subscriptionCode} · ${draft.periodLabel ?? formatPeriodLabel(draft.dueDate)}${journal?.number ? ` · ${journal.number}` : ""}`,
    });
    return updated;
  }

  // ───────────────────────────── Pembatalan & utilisasi ─────────────────────────────

  async requestCancellation(id: number, dto: CancellationRequestDto, user?: RequestUser) {
    const existing = await this.get(id);
    if (existing.status === "CANCELLED") {
      throw new BadRequestException("Langganan sudah dibatalkan.");
    }
    const pending = await this.db().subCancellationRequest.findFirst({
      where: { subscriptionId: id, status: "PENDING" },
    });
    if (pending) throw new ConflictException("Sudah ada permintaan pembatalan yang menunggu.");
    const effectiveDate = dateOnly(dto.effectiveCancellationDate);
    if (!effectiveDate) throw new BadRequestException("Tanggal pembatalan tidak valid.");
    const cancellationCode = await this.generateCode("CAN");
    const request = await this.db().$transaction(async (tx: any) => {
      const created = await tx.subCancellationRequest.create({
        data: {
          subscriptionId: id,
          cancellationCode,
          reason: dto.reason.trim(),
          requestedByUserId: user?.id ?? 0,
          effectiveCancellationDate: effectiveDate,
          finalBillingDate: dateOnly(dto.finalBillingDate),
          isDataBackupConfirmed: dto.isDataBackupConfirmed ?? false,
          isServiceMigrationConfirmed: dto.isServiceMigrationConfirmed ?? false,
          isDnsMigrationConfirmed: dto.isDnsMigrationConfirmed ?? false,
          isDependencyCheckConfirmed: dto.isDependencyCheckConfirmed ?? false,
          isHandoverConfirmed: dto.isHandoverConfirmed ?? false,
          isTerminationConfirmed: dto.isTerminationConfirmed ?? false,
          status: "PENDING",
          notes: optionalString(dto.notes),
        },
      });
      await tx.subSubscription.update({
        where: { id },
        data: { status: "CANCELLATION_PENDING" },
      });
      return created;
    });
    await this.audit.log({
      actor: user,
      action: "SUBSCRIPTION_CANCEL_REQUEST",
      entityType: "subscriptions",
      entityId: id,
      detail: `${cancellationCode} · ${existing.subscriptionCode}`,
    });
    this.notifications.dataChange("subscriptions", "update", id);
    return { request, subscription: await this.get(id) };
  }

  async decideCancellation(
    id: number,
    cancellationId: number,
    dto: CancellationDecisionDto,
    user?: RequestUser,
  ) {
    const existing = await this.get(id);
    const request = await this.db().subCancellationRequest.findFirst({
      where: { id: cancellationId, subscriptionId: id },
    });
    if (!request) throw new NotFoundException("Permintaan pembatalan tidak ditemukan.");
    if (request.status === "EXECUTED" || request.status === "REJECTED") {
      throw new BadRequestException(`Permintaan pembatalan sudah ${request.status}.`);
    }
    if (dto.status === "EXECUTED") {
      const checks = [
        request.isDataBackupConfirmed,
        request.isServiceMigrationConfirmed,
        request.isDnsMigrationConfirmed,
        request.isDependencyCheckConfirmed,
        request.isHandoverConfirmed,
        request.isTerminationConfirmed,
      ];
      if (checks.some((value: boolean) => !value)) {
        throw new BadRequestException(
          "Semua checklist verifikasi infrastruktur wajib dikonfirmasi sebelum eksekusi pembatalan.",
        );
      }
    }
    await this.db().$transaction(async (tx: any) => {
      await tx.subCancellationRequest.update({
        where: { id: cancellationId },
        data: {
          status: dto.status,
          notes: optionalString(dto.notes) ?? request.notes,
          approvedByUserId:
            dto.status === "APPROVED" || dto.status === "EXECUTED"
              ? user?.id ?? null
              : null,
          approvedAt: dto.status === "APPROVED" ? new Date() : request.approvedAt,
          executedAt: dto.status === "EXECUTED" ? new Date() : request.executedAt,
        },
      });
      const status =
        dto.status === "EXECUTED"
          ? "CANCELLED"
          : dto.status === "REJECTED"
            ? "ACTIVE"
            : "CANCELLATION_PENDING";
      await tx.subSubscription.update({ where: { id }, data: { status } });
    });
    await this.audit.log({
      actor: user,
      action: `SUBSCRIPTION_CANCEL_${dto.status}`,
      entityType: "subscriptions",
      entityId: id,
      detail: `${request.cancellationCode} · ${existing.subscriptionCode}`,
    });
    this.notifications.dataChange("subscriptions", "update", id);
    return this.get(id);
  }

  async reviewUsage(id: number, dto: UsageReviewDto, user?: RequestUser) {
    const existing = await this.get(id);
    await this.db().subUsageRecord.create({
      data: {
        subscriptionId: id,
        usersCount: dto.usersCount ?? null,
        licensesCount: dto.licensesCount ?? null,
        storageCapacity: optionalString(dto.storageCapacity),
        serverSpecs: optionalString(dto.serverSpecs),
        utilizationStatus: dto.utilizationStatus || "OPTIMAL",
        evaluationNotes: optionalString(dto.evaluationNotes),
        lastReviewedDate: dateOnly(dto.lastReviewedDate) ?? startOfDay(new Date()),
        reviewedByUserId: user?.id ?? null,
      },
    });
    await this.audit.log({
      actor: user,
      action: "SUBSCRIPTION_USAGE_REVIEW",
      entityType: "subscriptions",
      entityId: id,
      detail: `${existing.subscriptionCode} · ${dto.utilizationStatus || "OPTIMAL"}`,
    });
    return this.get(id);
  }

  // ───────────────────────────── Dokumen ─────────────────────────────

  async addDocument(id: number, dto: SubscriptionDocumentDto, user?: RequestUser) {
    const existing = await this.get(id);
    const document = await this.db().subDocument.create({
      data: {
        subscriptionId: id,
        title: dto.title.trim(),
        documentType: dto.documentType,
        fileUrl: dto.fileUrl.trim(),
        fileSize: dto.fileSize ?? null,
        mimeType: optionalString(dto.mimeType),
        uploadedByUserId: user?.id ?? null,
      },
    });
    await this.audit.log({
      actor: user,
      action: "SUBSCRIPTION_DOCUMENT_ADD",
      entityType: "subscriptions",
      entityId: id,
      detail: `${existing.subscriptionCode} · ${dto.title}`,
    });
    return document;
  }

  async removeDocument(id: number, documentId: number, user?: RequestUser) {
    const existing = await this.get(id);
    const document = await this.db().subDocument.findFirst({
      where: { id: documentId, subscriptionId: id },
    });
    if (!document) throw new NotFoundException("Dokumen langganan tidak ditemukan.");
    await this.db().subDocument.delete({ where: { id: documentId } });
    await this.audit.log({
      actor: user,
      action: "SUBSCRIPTION_DOCUMENT_DELETE",
      entityType: "subscriptions",
      entityId: id,
      detail: `${existing.subscriptionCode} · ${document.title}`,
    });
    return { success: true };
  }

  // ───────────────────────────── Reminder engine ─────────────────────────────

  async runReminders(dto: RunRemindersDto, user?: RequestUser) {
    const asOf = dateOnly(dto.asOfDate) ?? startOfDay(new Date());
    const from = addDays(asOf, -1);
    const to = addDays(asOf, 31);
    const subscriptions = await this.db().subSubscription.findMany({
      where: {
        nextRenewalDate: { gte: from, lte: to },
        status: { in: [...ACTIVE_STATUSES, "SUSPENDED"] },
      },
      include: { category: true, provider: true },
    });
    const created: any[] = [];
    for (const sub of subscriptions) {
      if (!sub.nextRenewalDate) continue;
      const type = reminderOffsetForDate(sub.nextRenewalDate, asOf);
      if (!type) continue;
      const already = await this.db().subReminderLog.findFirst({
        where: {
          subscriptionId: sub.id,
          reminderType: type,
          sentAt: { gte: asOf },
        },
      });
      if (already) continue;
      const label =
        type === "H+1"
          ? "LAYANAN SUDAH MELEWATI TANGGAL PERPANJANGAN"
          : `Perpanjangan dalam ${type.replace("H-", "")} hari`;
      const message = `${label}: ${sub.subscriptionCode} · ${sub.serviceName} · ${sub.nextRenewalDate.toISOString().slice(0, 10)}${sub.providerName ? ` · ${sub.providerName}` : ""}`;
      const log = await this.db().subReminderLog.create({
        data: {
          subscriptionId: sub.id,
          reminderType: type,
          recipientUserId: sub.picUserId ?? null,
          message,
          channel: "SYSTEM",
        },
      });
      await this.notifications
        .notify({
          userIds: sub.picUserId ? [sub.picUserId] : undefined,
          roles: sub.picUserId ? undefined : (["FINANCE"] as any),
          kind: "LAINNYA" as any,
          title: "Pengingat Perpanjangan Langganan",
          text: message,
          href: `/subscriptions/${sub.id}`,
        })
        .catch(() => null);
      created.push(log);
    }
    await this.audit.log({
      actor: user,
      action: "SUBSCRIPTION_REMINDER_RUN",
      entityType: "subscriptions",
      entityId: 0,
      detail: `${created.length} reminder per ${asOf.toISOString().slice(0, 10)}`,
    });
    return {
      asOfDate: asOf.toISOString().slice(0, 10),
      createdCount: created.length,
      reminders: created,
    };
  }

  // ───────────────────────────── Laporan ─────────────────────────────

  private reportWhere(query: SubscriptionReportQuery, includeDateFilter = true) {
    const where: any = {};
    if (query.categoryId) where.categoryId = Number(query.categoryId);
    if (query.providerId) where.providerId = Number(query.providerId);
    if (query.department) where.department = query.department;
    if (query.status) where.status = query.status;
    if (query.currency) where.currency = query.currency;
    if (includeDateFilter && (query.from || query.to)) {
      where.startDate = {
        ...(query.from ? { gte: dateOnly(query.from) } : {}),
        ...(query.to ? { lte: dateOnly(query.to) } : {}),
      };
    }
    return where;
  }

  private async reportSubscriptions(query: SubscriptionReportQuery) {
    return this.db().subSubscription.findMany({
      where: this.reportWhere(query),
      include: {
        category: true,
        provider: true,
        allocations: true,
        paymentRecords: { orderBy: { paymentDate: "desc" }, take: 1 },
      },
      orderBy: { subscriptionCode: "asc" },
    });
  }

  async report(type: string, query: SubscriptionReportQuery) {
    const reportType = String(type || "register").toLowerCase();
    const generatedAt = new Date().toISOString();
    const subs = await this.reportSubscriptions(query);
    let columns: Array<{ key: string; label: string; type?: string }> = [];
    let rows: any[] = [];
    let summary: Record<string, any> = {};

    if (reportType === "register") {
      columns = [
        { key: "subscriptionCode", label: "Kode SUB" },
        { key: "serviceName", label: "Layanan" },
        { key: "categoryName", label: "Kategori" },
        { key: "providerName", label: "Provider" },
        { key: "billingCycle", label: "Siklus" },
        { key: "cost", label: "Biaya", type: "currency" },
        { key: "mrc", label: "MRC", type: "currency" },
        { key: "startDate", label: "Mulai", type: "date" },
        { key: "nextRenewalDate", label: "Renewal", type: "date" },
        { key: "department", label: "Departemen" },
        { key: "status", label: "Status" },
        { key: "paymentStatus", label: "Bayar" },
      ];
      rows = subs.map((sub: any) => ({
        ...sub,
        categoryName: sub.category?.name ?? "-",
        providerName: sub.provider?.name ?? sub.providerName ?? "-",
      }));
      summary = {
        totalSubscriptions: rows.length,
        totalCost: round2(subs.reduce((s: number, x: any) => s + asNumber(x.cost), 0)),
        totalMrc: round2(subs.reduce((s: number, x: any) => s + asNumber(x.mrc), 0)),
        totalArc: round2(subs.reduce((s: number, x: any) => s + asNumber(x.arc), 0)),
      };
    } else if (reportType === "mrc" || reportType === "arc") {
      const key = reportType === "mrc" ? "mrc" : "arc";
      columns = [
        { key: "subscriptionCode", label: "Kode SUB" },
        { key: "serviceName", label: "Layanan" },
        { key: "billingCycle", label: "Siklus" },
        { key: "cost", label: "Biaya", type: "currency" },
        { key: "mrc", label: "MRC", type: "currency" },
        { key: "arc", label: "ARC", type: "currency" },
        { key: "department", label: "Departemen" },
      ];
      rows = subs
        .filter((x: any) => ACTIVE_STATUSES.includes(String(x.status)))
        .map((sub: any) => ({
          subscriptionCode: sub.subscriptionCode,
          serviceName: sub.serviceName,
          billingCycle: sub.billingCycle,
          cost: asNumber(sub.cost),
          mrc: asNumber(sub.mrc),
          arc: asNumber(sub.arc),
          department: sub.department,
        }));
      summary = {
        totalRows: rows.length,
        totalMrc: round2(rows.reduce((s, x) => s + x.mrc, 0)),
        totalArc: round2(rows.reduce((s, x) => s + x.arc, 0)),
        totalCost: round2(rows.reduce((s, x) => s + x.cost, 0)),
        column: key,
      };
    } else if (reportType === "department") {
      const map = new Map<string, { department: string; subscriptions: number; mrc: number; allocated: number }>();
      for (const sub of subs) {
        const allocations = sub.allocations?.length
          ? sub.allocations
          : [{ department: sub.department, allocatedAmount: asNumber(sub.mrc), percentage: 100 }];
        for (const row of allocations) {
          const key = row.department || "Tanpa Departemen";
          const current = map.get(key) ?? { department: key, subscriptions: 0, mrc: 0, allocated: 0 };
          current.subscriptions += 1;
          current.mrc = round2(current.mrc + asNumber(sub.mrc) * (asNumber(row.percentage) / 100));
          current.allocated = round2(current.allocated + asNumber(row.allocatedAmount));
          map.set(key, current);
        }
      }
      columns = [
        { key: "department", label: "Departemen" },
        { key: "subscriptions", label: "Jumlah Langganan", type: "number" },
        { key: "mrc", label: "MRC Alokasi", type: "currency" },
        { key: "allocated", label: "Nilai Alokasi", type: "currency" },
      ];
      rows = [...map.values()].sort((a, b) => b.mrc - a.mrc);
      summary = { totalRows: rows.length, totalMrc: round2(rows.reduce((s, x) => s + x.mrc, 0)) };
    } else if (reportType === "provider" || reportType === "category") {
      const isProvider = reportType === "provider";
      const map = new Map<string, { name: string; subscriptions: number; mrc: number; arc: number }>();
      for (const sub of subs) {
        const name = isProvider
          ? sub.provider?.name ?? sub.providerName ?? "Tanpa Provider"
          : sub.category?.name ?? "Tanpa Kategori";
        const current = map.get(name) ?? { name, subscriptions: 0, mrc: 0, arc: 0 };
        current.subscriptions += 1;
        current.mrc = round2(current.mrc + asNumber(sub.mrc));
        current.arc = round2(current.arc + asNumber(sub.arc));
        map.set(name, current);
      }
      columns = [
        { key: "name", label: isProvider ? "Provider" : "Kategori" },
        { key: "subscriptions", label: "Jumlah", type: "number" },
        { key: "mrc", label: "MRC", type: "currency" },
        { key: "arc", label: "ARC", type: "currency" },
      ];
      rows = [...map.values()].sort((a, b) => b.mrc - a.mrc);
      summary = { totalRows: rows.length, totalMrc: round2(rows.reduce((s, x) => s + x.mrc, 0)) };
    } else if (reportType === "renewal-forecast") {
      const map = new Map<string, { period: string; count: number; amount: number }>();
      const now = startOfDay(new Date());
      for (const sub of subs) {
        if (!sub.nextRenewalDate) continue;
        const due = startOfDay(sub.nextRenewalDate);
        if (due < now) continue;
        const period = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}`;
        const current = map.get(period) ?? { period, count: 0, amount: 0 };
        current.count += 1;
        current.amount = round2(current.amount + asNumber(sub.cost) + asNumber(sub.tax));
        map.set(period, current);
      }
      columns = [
        { key: "period", label: "Periode" },
        { key: "count", label: "Jumlah Renewal", type: "number" },
        { key: "amount", label: "Proyeksi Biaya", type: "currency" },
      ];
      rows = [...map.values()].sort((a, b) => a.period.localeCompare(b.period)).slice(0, 12);
      summary = { totalRows: rows.length, totalAmount: round2(rows.reduce((s, x) => s + x.amount, 0)) };
    } else if (reportType === "payment-history") {
      const payments = await this.db().subPaymentRecord.findMany({
        where: {
          ...(query.from || query.to
            ? {
                paymentDate: {
                  ...(query.from ? { gte: dateOnly(query.from) } : {}),
                  ...(query.to ? { lte: dateOnly(query.to) } : {}),
                },
              }
            : {}),
          subscription: this.reportWhere(query, false),
        },
        include: {
          subscription: { include: { category: true, provider: true } },
        },
        orderBy: { paymentDate: "desc" },
      });
      columns = [
        { key: "subscriptionCode", label: "Kode SUB" },
        { key: "serviceName", label: "Layanan" },
        { key: "invoiceNumber", label: "No. Invoice" },
        { key: "paymentDate", label: "Tanggal Bayar", type: "date" },
        { key: "billingPeriod", label: "Periode" },
        { key: "amount", label: "Nominal", type: "currency" },
        { key: "tax", label: "Pajak", type: "currency" },
        { key: "paymentStatus", label: "Status" },
        { key: "financeJournalId", label: "Jurnal ID" },
      ];
      rows = payments.map((row: any) => ({
        ...row,
        subscriptionCode: row.subscription?.subscriptionCode,
        serviceName: row.subscription?.serviceName,
      }));
      summary = {
        totalRows: rows.length,
        totalAmount: round2(rows.reduce((s, x) => s + asNumber(x.amount) + asNumber(x.tax), 0)),
      };
    } else if (reportType === "price-change") {
      const history = await this.db().subPriceHistory.findMany({
        where: {
          ...(query.from || query.to
            ? {
                effectiveDate: {
                  ...(query.from ? { gte: dateOnly(query.from) } : {}),
                  ...(query.to ? { lte: dateOnly(query.to) } : {}),
                },
              }
            : {}),
          subscription: this.reportWhere(query, false),
        },
        include: { subscription: true },
        orderBy: { effectiveDate: "desc" },
      });
      columns = [
        { key: "subscriptionCode", label: "Kode SUB" },
        { key: "serviceName", label: "Layanan" },
        { key: "changeType", label: "Jenis" },
        { key: "previousPlan", label: "Paket Lama" },
        { key: "newPlan", label: "Paket Baru" },
        { key: "previousCost", label: "Biaya Lama", type: "currency" },
        { key: "newCost", label: "Biaya Baru", type: "currency" },
        { key: "effectiveDate", label: "Efektif", type: "date" },
        { key: "changeReason", label: "Alasan" },
      ];
      rows = history.map((row: any) => ({
        ...row,
        subscriptionCode: row.subscription?.subscriptionCode,
        serviceName: row.subscription?.serviceName,
      }));
      summary = { totalRows: rows.length };
    } else if (reportType === "prepaid") {
      const schedules = await this.db().subPrepaidSchedule.findMany({
        where: {
          ...(query.from || query.to
            ? {
                allocationDate: {
                  ...(query.from ? { gte: dateOnly(query.from) } : {}),
                  ...(query.to ? { lte: dateOnly(query.to) } : {}),
                },
              }
            : {}),
          subscription: this.reportWhere(query, false),
        },
        include: { subscription: true },
        orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
      });
      columns = [
        { key: "subscriptionCode", label: "Kode SUB" },
        { key: "serviceName", label: "Layanan" },
        { key: "periodYear", label: "Tahun", type: "number" },
        { key: "periodMonth", label: "Bulan", type: "number" },
        { key: "allocationDate", label: "Tanggal Alokasi", type: "date" },
        { key: "amount", label: "Nilai Amortisasi", type: "currency" },
        { key: "isPosted", label: "Sudah Posting", type: "boolean" },
        { key: "journalNumber", label: "No. Jurnal" },
      ];
      rows = schedules.map((row: any) => ({
        ...row,
        subscriptionCode: row.subscription?.subscriptionCode,
        serviceName: row.subscription?.serviceName,
      }));
      const totalAmount = round2(rows.reduce((s, x) => s + asNumber(x.amount), 0));
      const postedAmount = round2(
        rows.filter((x) => x.isPosted).reduce((s, x) => s + asNumber(x.amount), 0),
      );
      summary = {
        totalRows: rows.length,
        totalAmount,
        postedAmount,
        unpostedAmount: round2(totalAmount - postedAmount),
      };
    } else if (reportType === "cancellation") {
      const requests = await this.db().subCancellationRequest.findMany({
        where: { subscription: this.reportWhere(query, false) },
        include: { subscription: true },
        orderBy: { createdAt: "desc" },
      });
      columns = [
        { key: "cancellationCode", label: "Kode Pembatalan" },
        { key: "subscriptionCode", label: "Kode SUB" },
        { key: "serviceName", label: "Layanan" },
        { key: "reason", label: "Alasan" },
        { key: "effectiveCancellationDate", label: "Tanggal Efektif", type: "date" },
        { key: "status", label: "Status" },
        { key: "createdAt", label: "Diajukan", type: "date" },
      ];
      rows = requests.map((row: any) => ({
        ...row,
        subscriptionCode: row.subscription?.subscriptionCode,
        serviceName: row.subscription?.serviceName,
      }));
      summary = { totalRows: rows.length };
    } else if (reportType === "utilization") {
      const usage = await this.db().subUsageRecord.findMany({
        where: { subscription: this.reportWhere(query, false) },
        include: { subscription: true },
        orderBy: { id: "desc" },
      });
      const latest = new Map<number, any>();
      for (const row of usage) {
        if (!latest.has(row.subscriptionId)) latest.set(row.subscriptionId, row);
      }
      for (const sub of subs as any[]) {
        if (!latest.has(sub.id)) {
          latest.set(sub.id, {
            subscriptionId: sub.id,
            subscription: sub,
            utilizationStatus: "PENDING_REVIEW",
            usersCount: null,
            licensesCount: null,
            lastReviewedDate: null,
            evaluationNotes: "Belum pernah direview",
          });
        }
      }
      columns = [
        { key: "subscriptionCode", label: "Kode SUB" },
        { key: "serviceName", label: "Layanan" },
        { key: "utilizationStatus", label: "Utilisasi" },
        { key: "usersCount", label: "Jumlah User", type: "number" },
        { key: "licensesCount", label: "Jumlah Lisensi", type: "number" },
        { key: "storageCapacity", label: "Kapasitas" },
        { key: "serverSpecs", label: "Spesifikasi" },
        { key: "lastReviewedDate", label: "Terakhir Review", type: "date" },
        { key: "evaluationNotes", label: "Catatan" },
      ];
      rows = [...latest.values()].map((row: any) => ({
        ...row,
        subscriptionCode: row.subscription?.subscriptionCode,
        serviceName: row.subscription?.serviceName,
      }));
      summary = {
        totalRows: rows.length,
        pendingReview: rows.filter((x) => x.utilizationStatus === "PENDING_REVIEW").length,
        activeButUnused: rows.filter((x) => x.utilizationStatus === "ACTIVE_BUT_UNUSED").length,
      };
    } else {
      throw new BadRequestException(`Jenis laporan '${type}' tidak dikenal.`);
    }

    return { type: reportType, generatedAt, columns, rows, summary };
  }

  /** Data event kalender perpanjangan untuk CalendarService. */
  async calendarRenewals(from: Date, to: Date) {
    const rows = await this.db().subSubscription.findMany({
      where: {
        nextRenewalDate: { gte: from, lte: to },
        status: { in: [...ACTIVE_STATUSES, "CANCELLATION_PENDING", "EXPIRED"] },
      },
      include: { provider: true, category: true },
      orderBy: { nextRenewalDate: "asc" },
    });
    const users = await this.userMap(rows.map((row: any) => row.picUserId));
    return rows.map((row: any) => ({
      ...row,
      picName: row.picUserId ? users.get(Number(row.picUserId))?.name ?? null : null,
    }));
  }
}
