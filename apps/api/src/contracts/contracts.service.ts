import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import {
  ContractAmendmentDto,
  ContractApprovalDecisionDto,
  ContractDocumentDto,
  ContractDocumentVersionDto,
  ContractPaymentScheduleInputDto,
  ContractQuery,
  ContractRelationInputDto,
  ContractRenewalDecisionDto,
  ContractRenewalRequestDto,
  ContractReportQuery,
  ContractTerminationDto,
  ContractTypeDto,
  CreateContractDto,
  RunContractRemindersDto,
  UpdateContractDto,
} from "./dto.js";
import {
  addDaysUtc,
  dateOnly,
  daysUntilUtc,
  DEFAULT_CONTRACT_TYPES,
  DEFAULT_EXPIRATION_RULES,
  evaluateContractLifecycleStatus,
  formatIsoDate,
  nextCode,
  round2,
  todayWibDateOnly,
} from "./contracts.rules.js";

const ACTIVE_CONTRACT_STATUSES = ["ACTIVE", "EXPIRING_SOON", "RENEWAL_PENDING"];
const PRIVILEGED_DOC_ROLES = ["SUPER_ADMIN", "BOS", "ADMIN", "FINANCE", "PROCUREMENT"];

function optionalString(value?: string | null): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

@Injectable()
export class ContractsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private db(): any {
    return this.prisma.main as any;
  }

  async onModuleInit() {
    try {
      await this.seedDefaults();
    } catch {
      // Abaikan jika tabel belum siap saat bootstrap awal
    }
  }

  async seedDefaults() {
    for (const item of DEFAULT_CONTRACT_TYPES) {
      await this.db().ctrType.upsert({
        where: { code: item.code },
        update: {},
        create: {
          code: item.code,
          name: item.name,
          description: item.description,
          isActive: true,
          isSystem: item.isSystem,
        },
      });
    }

    const existingRules = await this.db().ctrExpirationRule.count();
    if (existingRules === 0) {
      for (const r of DEFAULT_EXPIRATION_RULES) {
        await this.db().ctrExpirationRule.create({
          data: {
            typeId: null,
            daysOffset: r.daysOffset,
            label: r.label,
            targetRole: r.targetRole,
            notifyOwner: true,
            isActive: true,
          },
        });
      }
    }
  }

  // ───────────────────────────── Master Contract Types & Lookups ─────────────────────────────

  async listTypes() {
    await this.seedDefaults();
    return this.db().ctrType.findMany({
      orderBy: [{ isSystem: "desc" }, { id: "asc" }],
      include: { _count: { select: { contracts: true } } },
    });
  }

  async createType(dto: ContractTypeDto) {
    let code = optionalString(dto.code)?.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    if (!code) {
      const count = await this.db().ctrType.count();
      code = `TYPE_${String(count + 1).padStart(3, "0")}`;
    }
    try {
      return await this.db().ctrType.create({
        data: {
          code,
          name: dto.name.trim(),
          description: optionalString(dto.description),
          isActive: dto.isActive ?? true,
          isSystem: false,
        },
      });
    } catch (err: any) {
      if (err?.code === "P2002") {
        throw new ConflictException(`Kode kategori kontrak ${code} sudah digunakan.`);
      }
      throw err;
    }
  }

  async updateType(id: number, dto: Partial<ContractTypeDto>) {
    const existing = await this.db().ctrType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Kategori kontrak #${id} tidak ditemukan.`);
    return this.db().ctrType.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: optionalString(dto.description) } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async deleteType(id: number) {
    const existing = await this.db().ctrType.findUnique({
      where: { id },
      include: { _count: { select: { contracts: true } } },
    });
    if (!existing) throw new NotFoundException(`Kategori kontrak #${id} tidak ditemukan.`);
    if (Number(existing._count?.contracts || 0) > 0) {
      throw new ConflictException(
        `Kategori '${existing.name}' masih digunakan oleh ${existing._count.contracts} kontrak.`,
      );
    }
    if (existing.isSystem) {
      throw new BadRequestException(`Kategori bawaan sistem '${existing.name}' tidak dapat dihapus.`);
    }
    return this.db().ctrType.delete({ where: { id } });
  }

  async listExpirationRules() {
    await this.seedDefaults();
    return this.db().ctrExpirationRule.findMany({
      include: { type: { select: { id: true, code: true, name: true } } },
      orderBy: { daysOffset: "desc" },
    });
  }

  async getMasterLookups() {
    await this.seedDefaults();
    const [types, suppliers, customers, projects, subscriptions, assets, supplierPos, users, rules] =
      await Promise.all([
        this.db().ctrType.findMany({
          where: { isActive: true },
          orderBy: { id: "asc" },
        }),
        this.db().supplier.findMany({
          select: { id: true, code: true, name: true, contactName: true, phone: true, email: true, address: true },
          orderBy: { name: "asc" },
          take: 250,
        }),
        this.db().customer.findMany({
          select: { id: true, code: true, name: true, company: true, contactName: true, phone: true, email: true, address: true },
          orderBy: { name: "asc" },
          take: 250,
        }),
        this.db().project.findMany({
          select: { id: true, number: true, name: true, status: true },
          orderBy: { id: "desc" },
          take: 150,
        }),
        this.db().subSubscription.findMany({
          select: { id: true, subscriptionCode: true, serviceName: true, providerName: true, status: true },
          orderBy: { id: "desc" },
          take: 150,
        }),
        this.db().faAsset.findMany({
          select: { id: true, assetCode: true, name: true, status: true },
          orderBy: { id: "desc" },
          take: 150,
        }),
        this.db().supplierPO.findMany({
          select: { id: true, number: true, status: true, supplier: { select: { name: true } } },
          orderBy: { id: "desc" },
          take: 150,
        }),
        this.db().user.findMany({
          where: { status: "AKTIF" },
          select: { id: true, name: true, email: true, role: true, department: true, position: true },
          orderBy: { name: "asc" },
        }),
        this.db().ctrExpirationRule.findMany({
          where: { isActive: true },
          orderBy: { daysOffset: "desc" },
        }),
      ]);

    return {
      types,
      suppliers,
      customers,
      projects,
      subscriptions,
      assets,
      supplierPos,
      users,
      expirationRules: rules,
    };
  }

  // ───────────────────────────── Helpers ─────────────────────────────

  private async generateContractCode(): Promise<string> {
    const year = todayWibDateOnly().getUTCFullYear();
    const last = await this.db().ctrContract.findFirst({
      where: { contractNumber: { startsWith: `CTR-${year}-` } },
      orderBy: { contractNumber: "desc" },
      select: { contractNumber: true },
    });
    return nextCode("CTR", year, last?.contractNumber);
  }

  private async generateRenewalCode(): Promise<string> {
    const year = todayWibDateOnly().getUTCFullYear();
    const last = await this.db().ctrRenewal.findFirst({
      where: { renewalCode: { startsWith: `REN-CTR-${year}-` } },
      orderBy: { renewalCode: "desc" },
      select: { renewalCode: true },
    });
    return nextCode("REN-CTR", year, last?.renewalCode);
  }

  private async userMap(ids: Array<number | null | undefined>) {
    const unique = Array.from(
      new Set(ids.filter((id): id is number => Number.isFinite(Number(id)) && Number(id) > 0)),
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
    return new Map<number, any>(users.map((u: any) => [u.id, u]));
  }

  private canViewConfidential(contract: any, user?: RequestUser | null): boolean {
    if (!user) return true;
    const role = String(user.role || "").toUpperCase();
    if (PRIVILEGED_DOC_ROLES.includes(role)) return true;
    if (contract.contractOwnerId && Number(contract.contractOwnerId) === Number(user.id)) return true;
    if (contract.createdById && Number(contract.createdById) === Number(user.id)) return true;
    return false;
  }

  private async enrichContracts(rows: any[], user?: RequestUser | null): Promise<any[]> {
    const users = await this.userMap(
      rows.flatMap((row) => [
        row.contractOwnerId,
        row.createdById,
        ...(row.documents ?? []).flatMap((d: any) =>
          (d.versions ?? []).map((v: any) => v.uploadedById),
        ),
        ...(row.approvals ?? []).map((a: any) => a.approverId),
        ...(row.renewals ?? []).flatMap((r: any) => [r.submittedById, r.reviewedById]),
        ...(row.amendments ?? []).map((a: any) => a.approvedById),
        row.termination?.approvedById,
        ...(row.auditLogs ?? []).map((l: any) => l.userId),
      ]),
    );
    const getUser = (id: any) => (id ? users.get(Number(id)) ?? null : null);
    const today = todayWibDateOnly();

    return rows.map((row) => {
      const daysToExpiration = row.expirationDate ? daysUntilUtc(row.expirationDate, today) : null;
      const daysToRenewal = row.renewalDate ? daysUntilUtc(row.renewalDate, today) : null;
      const computedStatus = evaluateContractLifecycleStatus({
        currentStatus: row.status,
        approvalStatus: row.approvalStatus,
        expirationDate: row.expirationDate,
        renewalDate: row.renewalDate,
        asOfDate: today,
      });
      const canAccessConfidential = this.canViewConfidential(row, user);

      const schedules = row.paymentSchedules ?? [];
      const paidCommitment = round2(
        schedules
          .filter((s: any) => s.paymentStatus === "PAID")
          .reduce((sum: number, s: any) => sum + asNumber(s.totalAmount || s.amount), 0),
      );
      const remainingCommitment = round2(
        schedules
          .filter((s: any) => s.paymentStatus !== "PAID" && s.paymentStatus !== "CANCELLED")
          .reduce((sum: number, s: any) => sum + asNumber(s.totalAmount || s.amount), 0),
      );

      return {
        ...row,
        status: computedStatus,
        typeName: row.type?.name ?? "Kontrak",
        typeCode: row.type?.code ?? "OTHER",
        ownerUser: getUser(row.contractOwnerId),
        createdByUser: getUser(row.createdById),
        daysToExpiration,
        daysToRenewal,
        paidCommitment,
        remainingCommitment,
        canAccessConfidential,
        documents: (row.documents ?? []).map((doc: any) => {
          const restricted = Boolean(doc.isConfidential) && !canAccessConfidential;
          return {
            ...doc,
            restricted,
            versions: (doc.versions ?? []).map((ver: any) => ({
              ...ver,
              fileUrl: restricted ? null : ver.fileUrl,
              uploadedByUser: getUser(ver.uploadedById),
            })),
          };
        }),
        approvals: (row.approvals ?? []).map((app: any) => ({
          ...app,
          approverUser: getUser(app.approverId),
        })),
        renewals: (row.renewals ?? []).map((ren: any) => ({
          ...ren,
          submittedByUser: getUser(ren.submittedById),
          reviewedByUser: getUser(ren.reviewedById),
        })),
        amendments: (row.amendments ?? []).map((amd: any) => ({
          ...amd,
          approvedByUser: getUser(amd.approvedById),
        })),
        termination: row.termination
          ? {
              ...row.termination,
              approvedByUser: getUser(row.termination.approvedById),
            }
          : null,
        auditLogs: (row.auditLogs ?? []).map((log: any) => ({
          ...log,
          actorUser: getUser(log.userId),
        })),
      };
    });
  }

  private async logContractAudit(params: {
    contractId: number;
    action: string;
    user?: RequestUser | null;
    fieldChanged?: string | null;
    oldValue?: string | null;
    newValue?: string | null;
    notes?: string | null;
  }) {
    await this.db().ctrAuditLog.create({
      data: {
        contractId: params.contractId,
        action: params.action,
        userId: params.user?.id ?? null,
        userName: params.user?.name ?? null,
        fieldChanged: params.fieldChanged ?? null,
        oldValue: params.oldValue ?? null,
        newValue: params.newValue ?? null,
        notes: params.notes ?? null,
      },
    });
  }

  // ───────────────────────────── Dashboard (PRD 10.1) ─────────────────────────────

  async getDashboard(user?: RequestUser | null) {
    await this.seedDefaults();
    const rawContracts = await this.db().ctrContract.findMany({
      include: {
        type: true,
        paymentSchedules: true,
        financial: true,
      },
      orderBy: { id: "desc" },
    });

    const contracts = await this.enrichContracts(rawContracts, user);
    const today = todayWibDateOnly();

    let totalContracts = contracts.length;
    let activeContracts = 0;
    let expiringSoonContracts = 0;
    let expiredContracts = 0;
    let pendingApprovalContracts = 0;
    let pendingRenewalContracts = 0;
    let terminatedContracts = 0;
    let totalActiveValue = 0;
    let totalFinancialCommitment = 0;

    const byCategoryMap: Record<string, { category: string; count: number; totalValue: number }> = {};
    const byVendorMap: Record<string, { counterparty: string; type: string; count: number; totalValue: number }> = {};
    const byDepartmentMap: Record<string, { department: string; count: number; totalValue: number }> = {};

    for (const c of contracts) {
      const val = asNumber(c.contractValue);
      const st = String(c.status).toUpperCase();
      const appSt = String(c.approvalStatus).toUpperCase();

      if (st === "ACTIVE" || st === "EXPIRING_SOON" || st === "RENEWAL_PENDING") {
        activeContracts += 1;
        totalActiveValue = round2(totalActiveValue + val);
      }
      if (st === "EXPIRING_SOON" || (c.daysToExpiration !== null && c.daysToExpiration >= 0 && c.daysToExpiration <= 30 && st !== "TERMINATED")) {
        expiringSoonContracts += 1;
      }
      if (st === "EXPIRED") {
        expiredContracts += 1;
      }
      if (st === "TERMINATED") {
        terminatedContracts += 1;
      }
      if (["PENDING_REVIEW", "PENDING_APPROVAL", "REVISION_REQUIRED"].includes(appSt)) {
        pendingApprovalContracts += 1;
      }
      if (st === "RENEWAL_PENDING") {
        pendingRenewalContracts += 1;
      }

      // Komitmen finansial aktif
      if (st !== "TERMINATED" && appSt !== "CANCELLED") {
        const schedules = c.paymentSchedules ?? [];
        if (schedules.length > 0) {
          for (const s of schedules) {
            if (s.paymentStatus !== "CANCELLED") {
              totalFinancialCommitment = round2(
                totalFinancialCommitment + asNumber(s.totalAmount || s.amount),
              );
            }
          }
        } else {
          totalFinancialCommitment = round2(totalFinancialCommitment + val);
        }
      }

      // Breakdown per Kategori
      const catName = c.typeName || "Lainnya";
      if (!byCategoryMap[catName]) {
        byCategoryMap[catName] = { category: catName, count: 0, totalValue: 0 };
      }
      byCategoryMap[catName]!.count += 1;
      byCategoryMap[catName]!.totalValue = round2(byCategoryMap[catName]!.totalValue + val);

      // Breakdown per Vendor / Pihak Terkait
      const cpName = c.counterpartyName || "Tanpa Pihak";
      if (!byVendorMap[cpName]) {
        byVendorMap[cpName] = {
          counterparty: cpName,
          type: c.counterpartyType || "VENDOR",
          count: 0,
          totalValue: 0,
        };
      }
      byVendorMap[cpName]!.count += 1;
      byVendorMap[cpName]!.totalValue = round2(byVendorMap[cpName]!.totalValue + val);

      // Breakdown per Departemen
      const deptName = c.department || "Umum";
      if (!byDepartmentMap[deptName]) {
        byDepartmentMap[deptName] = { department: deptName, count: 0, totalValue: 0 };
      }
      byDepartmentMap[deptName]!.count += 1;
      byDepartmentMap[deptName]!.totalValue = round2(byDepartmentMap[deptName]!.totalValue + val);
    }

    const upcomingExpirations = contracts
      .filter(
        (c) =>
          c.status !== "TERMINATED" &&
          c.daysToExpiration !== null &&
          c.daysToExpiration >= -7 &&
          c.daysToExpiration <= 90,
      )
      .sort((a, b) => (a.daysToExpiration ?? 999) - (b.daysToExpiration ?? 999))
      .slice(0, 12);

    const pendingApprovalsList = contracts
      .filter((c) => ["DRAFT", "PENDING_REVIEW", "PENDING_APPROVAL", "REVISION_REQUIRED"].includes(c.approvalStatus))
      .slice(0, 10);

    const upcomingPayments = contracts
      .flatMap((c) =>
        (c.paymentSchedules ?? [])
          .filter((s: any) => s.paymentStatus === "PLANNED" || s.paymentStatus === "INVOICED" || s.paymentStatus === "OVERDUE")
          .map((s: any) => ({
            ...s,
            contractId: c.id,
            contractNumber: c.contractNumber,
            contractTitle: c.title,
            counterpartyName: c.counterpartyName,
            daysUntilDue: daysUntilUtc(s.dueDate, today),
          })),
      )
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
      .slice(0, 10);

    return {
      summary: {
        totalContracts,
        activeContracts,
        expiringSoonContracts,
        expiredContracts,
        pendingApprovalContracts,
        pendingRenewalContracts,
        terminatedContracts,
        totalActiveValue,
        totalFinancialCommitment,
      },
      byCategory: Object.values(byCategoryMap).sort((a, b) => b.totalValue - a.totalValue),
      byVendor: Object.values(byVendorMap).sort((a, b) => b.totalValue - a.totalValue),
      byDepartment: Object.values(byDepartmentMap).sort((a, b) => b.totalValue - a.totalValue),
      upcomingExpirations,
      pendingApprovalsList,
      upcomingPayments,
    };
  }

  // ───────────────────────────── Contract Registry (List & Detail) ─────────────────────────────

  async list(query: ContractQuery, user?: RequestUser | null) {
    await this.seedDefaults();
    const where: any = {};

    if (query.typeId) where.typeId = Number(query.typeId);
    if (query.typeCode) {
      where.type = { code: String(query.typeCode).toUpperCase() };
    }
    if (query.counterpartyType) {
      where.counterpartyType = String(query.counterpartyType).toUpperCase();
    }
    if (query.counterpartyId) {
      where.counterpartyId = Number(query.counterpartyId);
    }
    if (query.department) {
      where.department = String(query.department);
    }
    if (query.ownerId) {
      where.contractOwnerId = Number(query.ownerId);
    }
    if (query.approvalStatus) {
      where.approvalStatus = String(query.approvalStatus).toUpperCase();
    }
    if (query.dateFrom || query.dateTo) {
      where.expirationDate = {};
      if (query.dateFrom) where.expirationDate.gte = dateOnly(query.dateFrom);
      if (query.dateTo) where.expirationDate.lte = dateOnly(query.dateTo);
    }

    const q = optionalString(query.q);
    if (q) {
      where.OR = [
        { contractNumber: { contains: q } },
        { officialNumber: { contains: q } },
        { title: { contains: q } },
        { counterpartyName: { contains: q } },
        { department: { contains: q } },
        { description: { contains: q } },
      ];
    }

    const rows = await this.db().ctrContract.findMany({
      where,
      include: {
        type: true,
        parties: true,
        documents: {
          include: {
            versions: { orderBy: { versionNumber: "desc" } },
          },
          orderBy: { id: "desc" },
        },
        services: {
          include: { slas: true },
        },
        slas: true,
        terms: true,
        financial: true,
        paymentSchedules: { orderBy: { scheduleNumber: "asc" } },
        renewals: { orderBy: { renewalNumber: "desc" } },
        approvals: { orderBy: { id: "desc" } },
        amendments: { orderBy: { amendmentDate: "desc" } },
        termination: true,
        relations: true,
        _count: {
          select: {
            documents: true,
            services: true,
            slas: true,
            paymentSchedules: true,
            renewals: true,
            amendments: true,
          },
        },
      },
      orderBy: { id: "desc" },
    });

    let enriched = await this.enrichContracts(rows, user);

    // Filter berdasarkan status hasil kalkulasi atau tab aktif
    if (query.status) {
      const targetStatus = String(query.status).toUpperCase();
      enriched = enriched.filter((c) => c.status === targetStatus);
    }

    if (query.tab) {
      const tab = String(query.tab).toLowerCase();
      if (tab === "vendor") {
        enriched = enriched.filter((c) => c.counterpartyType === "VENDOR" || c.typeCode === "VENDOR");
      } else if (tab === "customer") {
        enriched = enriched.filter((c) => c.counterpartyType === "CUSTOMER" || c.typeCode === "CUSTOMER" || c.typeCode === "PROJECT");
      } else if (tab === "service" || tab === "sla") {
        enriched = enriched.filter(
          (c) =>
            ["SERVICE", "MAINTENANCE", "CLOUD_HOSTING", "SOFTWARE_LICENSE"].includes(c.typeCode) ||
            (c.services ?? []).length > 0 ||
            (c.slas ?? []).length > 0,
        );
      } else if (tab === "expiring") {
        enriched = enriched.filter(
          (c) =>
            c.status === "EXPIRING_SOON" ||
            c.status === "EXPIRED" ||
            (c.daysToExpiration !== null && c.daysToExpiration <= 60 && c.status !== "TERMINATED"),
        );
      } else if (tab === "approval") {
        enriched = enriched.filter((c) =>
          ["DRAFT", "PENDING_REVIEW", "PENDING_APPROVAL", "REVISION_REQUIRED"].includes(c.approvalStatus) ||
          c.status === "RENEWAL_PENDING",
        );
      }
    }

    return {
      data: enriched,
      total: enriched.length,
    };
  }

  async get(id: number, user?: RequestUser | null) {
    const row = await this.db().ctrContract.findUnique({
      where: { id },
      include: {
        type: true,
        parties: { orderBy: { id: "asc" } },
        documents: {
          include: {
            versions: { orderBy: { versionNumber: "desc" } },
          },
          orderBy: { id: "desc" },
        },
        services: {
          include: { slas: true },
          orderBy: { id: "asc" },
        },
        slas: { orderBy: { id: "asc" } },
        terms: { orderBy: { id: "asc" } },
        financial: true,
        paymentSchedules: { orderBy: { scheduleNumber: "asc" } },
        renewals: { orderBy: { renewalNumber: "desc" } },
        approvals: { orderBy: { id: "desc" } },
        notifications: { orderBy: { sentAt: "desc" }, take: 30 },
        amendments: { orderBy: { amendmentDate: "desc" } },
        termination: true,
        relations: { orderBy: { id: "desc" } },
        auditLogs: { orderBy: { createdAt: "desc" }, take: 100 },
      },
    });
    if (!row) throw new NotFoundException(`Kontrak #${id} tidak ditemukan.`);
    const [enriched] = await this.enrichContracts([row], user);
    return enriched;
  }

  // ───────────────────────────── Create & Update Contract ─────────────────────────────

  async create(dto: CreateContractDto, user: RequestUser) {
    const type = await this.db().ctrType.findUnique({ where: { id: Number(dto.typeId) } });
    if (!type) throw new BadRequestException(`Kategori kontrak #${dto.typeId} tidak ditemukan.`);

    const effectiveDate = dateOnly(dto.effectiveDate);
    const expirationDate = dateOnly(dto.expirationDate);
    if (!effectiveDate || !expirationDate) {
      throw new BadRequestException("Tanggal mulai berlaku (Effective Date) dan berakhir (Expiration Date) wajib diisi.");
    }
    if (expirationDate.getTime() < effectiveDate.getTime()) {
      throw new BadRequestException("Tanggal berakhir tidak boleh lebih awal dari tanggal mulai berlaku.");
    }

    const renewalDate = dto.renewalDate
      ? dateOnly(dto.renewalDate)
      : addDaysUtc(expirationDate, -30);

    const contractNumber = await this.generateContractCode();
    const contractValue = round2(asNumber(dto.contractValue));
    const currency = optionalString(dto.currency) || "IDR";
    const counterpartyType = optionalString(dto.counterpartyType)?.toUpperCase() || "VENDOR";
    const counterpartyName = dto.counterpartyName.trim();
    const approvalStatus = optionalString(dto.approvalStatus)?.toUpperCase() || "DRAFT";

    const initialLifecycleStatus = evaluateContractLifecycleStatus({
      currentStatus: optionalString(dto.status)?.toUpperCase() || "ACTIVE",
      approvalStatus,
      expirationDate,
      renewalDate,
    });

    // Pastikan minimal pihak terkait tercatat (PRD 8.2 Rule 3)
    const inputParties = Array.isArray(dto.parties) && dto.parties.length > 0
      ? dto.parties
      : [
          {
            partyType: "FIRST_PARTY",
            entityType: "INTERNAL_COMPANY",
            name: "PT Samtek / Perusahaan Internal",
            role: "Pihak Pertama",
          },
          {
            partyType: "SECOND_PARTY",
            entityType: counterpartyType === "CUSTOMER" ? "CUSTOMER" : counterpartyType === "VENDOR" ? "SUPPLIER" : "OTHER",
            entityId: dto.counterpartyId ?? undefined,
            name: counterpartyName,
            role: counterpartyType === "CUSTOMER" ? "Pelanggan / Klien" : "Vendor / Penyedia Layanan",
          },
        ];

    const finInput = dto.financial;
    const baseAmount = finInput?.baseAmount !== undefined ? round2(asNumber(finInput.baseAmount)) : contractValue;
    const taxPercentage = finInput?.taxPercentage !== undefined ? round2(asNumber(finInput.taxPercentage)) : 0;
    const taxAmount =
      finInput?.taxAmount !== undefined
        ? round2(asNumber(finInput.taxAmount))
        : round2(baseAmount * (taxPercentage / 100));
    const totalAmount =
      finInput?.totalAmount !== undefined && asNumber(finInput.totalAmount) > 0
        ? round2(asNumber(finInput.totalAmount))
        : round2(baseAmount + taxAmount);

    const created = await this.db().ctrContract.create({
      data: {
        contractNumber,
        officialNumber: optionalString(dto.officialNumber),
        title: dto.title.trim(),
        typeId: type.id,
        counterpartyType,
        counterpartyId: dto.counterpartyId ? Number(dto.counterpartyId) : null,
        counterpartyName,
        effectiveDate,
        expirationDate,
        renewalDate,
        isAutoRenewal: Boolean(dto.isAutoRenewal),
        currency,
        contractValue,
        contractOwnerId: dto.contractOwnerId ? Number(dto.contractOwnerId) : user?.id ?? null,
        department: dto.department.trim(),
        paymentTerms: optionalString(dto.paymentTerms),
        paymentFrequency: optionalString(dto.paymentFrequency)?.toUpperCase() || "ONE_TIME",
        status: initialLifecycleStatus,
        approvalStatus,
        description: optionalString(dto.description),
        createdById: user?.id ?? null,
        parties: {
          create: inputParties.map((p) => ({
            partyType: optionalString(p.partyType) || "SECOND_PARTY",
            entityType: optionalString(p.entityType) || "OTHER",
            entityId: p.entityId ? Number(p.entityId) : null,
            name: p.name.trim(),
            role: optionalString(p.role),
            address: optionalString(p.address),
            picName: optionalString(p.picName),
            picEmail: optionalString(p.picEmail),
            picPhone: optionalString(p.picPhone),
          })),
        },
        services:
          dto.services && dto.services.length > 0
            ? {
                create: dto.services.map((s) => ({
                  serviceName: s.serviceName.trim(),
                  serviceScope: optionalString(s.serviceScope),
                  servicePeriod: optionalString(s.servicePeriod),
                  serviceLocation: optionalString(s.serviceLocation),
                  supportContact: optionalString(s.supportContact),
                  serviceFee: s.serviceFee !== undefined ? round2(asNumber(s.serviceFee)) : null,
                  penaltyClause: optionalString(s.penaltyClause),
                  renewalTerms: optionalString(s.renewalTerms),
                })),
              }
            : undefined,
        slas:
          dto.slas && dto.slas.length > 0
            ? {
                create: dto.slas.map((sla) => ({
                  indicatorName: sla.indicatorName.trim(),
                  targetMetric: sla.targetMetric.trim(),
                  responseHours: sla.responseHours !== undefined ? round2(asNumber(sla.responseHours)) : null,
                  resolutionHours: sla.resolutionHours !== undefined ? round2(asNumber(sla.resolutionHours)) : null,
                  penaltyDetails: optionalString(sla.penaltyDetails),
                  operationalHours: optionalString(sla.operationalHours) || "8x5",
                })),
              }
            : undefined,
        terms:
          dto.terms && dto.terms.length > 0
            ? {
                create: dto.terms.map((t) => ({
                  termType: optionalString(t.termType)?.toUpperCase() || "GENERAL",
                  clauseNumber: optionalString(t.clauseNumber),
                  title: t.title.trim(),
                  content: t.content.trim(),
                })),
              }
            : undefined,
        financial: {
          create: {
            valueType: optionalString(finInput?.valueType)?.toUpperCase() || "FIXED",
            currency: optionalString(finInput?.currency) || currency,
            baseAmount,
            taxPercentage,
            taxAmount,
            totalAmount,
            downPaymentAmount: round2(asNumber(finInput?.downPaymentAmount)),
            retentionAmount: round2(asNumber(finInput?.retentionAmount)),
            retentionPeriodDays: finInput?.retentionPeriodDays ? Number(finInput.retentionPeriodDays) : null,
            penaltyTerms: optionalString(finInput?.penaltyTerms),
            costCenter: optionalString(finInput?.costCenter) || dto.department.trim(),
            projectReference: optionalString(finInput?.projectReference),
            notes: optionalString(finInput?.notes),
          },
        },
        paymentSchedules:
          dto.paymentSchedules && dto.paymentSchedules.length > 0
            ? {
                create: dto.paymentSchedules.map((ps, idx) => {
                  const amt = round2(asNumber(ps.amount));
                  const tx = round2(asNumber(ps.taxAmount));
                  return {
                    scheduleNumber: ps.scheduleNumber ? Number(ps.scheduleNumber) : idx + 1,
                    milestoneName: ps.milestoneName.trim(),
                    dueDate: dateOnly(ps.dueDate) ?? effectiveDate,
                    amount: amt,
                    taxAmount: tx,
                    totalAmount: ps.totalAmount !== undefined ? round2(asNumber(ps.totalAmount)) : round2(amt + tx),
                    paymentStatus: optionalString(ps.paymentStatus)?.toUpperCase() || "PLANNED",
                    invoiceReference: optionalString(ps.invoiceReference),
                    paidDate: ps.paidDate ? dateOnly(ps.paidDate) : null,
                    notes: optionalString(ps.notes),
                  };
                }),
              }
            : undefined,
        relations:
          dto.relations && dto.relations.length > 0
            ? {
                create: dto.relations.map((rel) => ({
                  relatedModule: rel.relatedModule.trim().toUpperCase(),
                  relatedId: Number(rel.relatedId),
                  referenceCode: optionalString(rel.referenceCode),
                  notes: optionalString(rel.notes),
                })),
              }
            : undefined,
      },
    });

    // Buat relasi otomatis ke Supplier / Customer jika ada counterpartyId
    if (dto.counterpartyId && (counterpartyType === "VENDOR" || counterpartyType === "CUSTOMER")) {
      const modName = counterpartyType === "VENDOR" ? "SUPPLIER" : "CUSTOMER";
      const hasRel = (dto.relations ?? []).some(
        (r) => r.relatedModule.toUpperCase() === modName && Number(r.relatedId) === Number(dto.counterpartyId),
      );
      if (!hasRel) {
        await this.db().ctrRelation.create({
          data: {
            contractId: created.id,
            relatedModule: modName,
            relatedId: Number(dto.counterpartyId),
            referenceCode: counterpartyName,
            notes: `Relasi pihak terkait (${counterpartyType})`,
          },
        });
      }
    }

    // Jika mengunggah dokumen awal saat registrasi kontrak
    if (optionalString(dto.initialDocumentUrl)) {
      const docUrl = String(dto.initialDocumentUrl).trim();
      const docTitle = optionalString(dto.initialDocumentTitle) || `Dokumen Utama — ${dto.title.trim()}`;
      const docFileName = optionalString(dto.initialDocumentFileName) || docUrl.split("/").pop() || "contract.pdf";
      await this.db().ctrDocument.create({
        data: {
          contractId: created.id,
          documentCategory: optionalString(dto.initialDocumentCategory)?.toUpperCase() || "MAIN_CONTRACT",
          documentTitle: docTitle,
          documentNumber: optionalString(dto.initialDocumentNumber) || optionalString(dto.officialNumber),
          isConfidential: Boolean(dto.initialDocumentConfidential),
          signedDate: dto.initialDocumentSignedDate ? dateOnly(dto.initialDocumentSignedDate) : effectiveDate,
          signedByFirstParty: optionalString(dto.initialDocumentSignedByFirst),
          signedBySecondParty: optionalString(dto.initialDocumentSignedBySecond),
          currentVersionNumber: 1,
          versions: {
            create: {
              versionNumber: 1,
              fileUrl: docUrl,
              fileName: docFileName,
              fileSize: dto.initialDocumentFileSize ? Number(dto.initialDocumentFileSize) : null,
              mimeType: optionalString(dto.initialDocumentMimeType) || "application/pdf",
              changeSummary: "Versi awal dokumen kontrak saat registrasi",
              isLockedForApproval: approvalStatus === "APPROVED",
              uploadedById: user?.id ?? null,
            },
          },
        },
      });
    }

    // Catat log approval jika langsung diajukan atau disetujui
    if (approvalStatus !== "DRAFT") {
      await this.db().ctrApproval.create({
        data: {
          contractId: created.id,
          stage: approvalStatus === "APPROVED" ? "DIRECTOR_APPROVAL" : "DEPT_REVIEW",
          sequence: 1,
          status: approvalStatus === "APPROVED" ? "APPROVED" : "PENDING",
          approverId: approvalStatus === "APPROVED" ? user?.id ?? null : null,
          approverRole: user?.role ?? null,
          decisionTimestamp: approvalStatus === "APPROVED" ? new Date() : null,
          comments:
            approvalStatus === "APPROVED"
              ? "Disetujui langsung saat pembuatan kontrak"
              : "Menunggu pemeriksaan & persetujuan kontrak",
        },
      });
    }

    await this.logContractAudit({
      contractId: created.id,
      action: "CREATED",
      user,
      newValue: `${created.contractNumber} — ${created.title} (${currency} ${contractValue.toLocaleString("id-ID")})`,
      notes: `Kontrak baru dibuat dengan pihak ${counterpartyName}`,
    });

    await this.audit.log({
      actor: user,
      action: "CREATE_CONTRACT",
      entityType: "contract",
      entityId: created.id,
      detail: `Membuat kontrak ${created.contractNumber} (${created.title})`,
    });

    return this.get(created.id, user);
  }

  async update(id: number, dto: UpdateContractDto, user: RequestUser) {
    const existing = await this.db().ctrContract.findUnique({
      where: { id },
      include: { financial: true },
    });
    if (!existing) throw new NotFoundException(`Kontrak #${id} tidak ditemukan.`);

    const effectiveDate = dto.effectiveDate !== undefined ? dateOnly(dto.effectiveDate) : existing.effectiveDate;
    const expirationDate = dto.expirationDate !== undefined ? dateOnly(dto.expirationDate) : existing.expirationDate;
    if (effectiveDate && expirationDate && expirationDate.getTime() < effectiveDate.getTime()) {
      throw new BadRequestException("Tanggal berakhir tidak boleh lebih awal dari tanggal mulai berlaku.");
    }
    const renewalDate =
      dto.renewalDate !== undefined
        ? dto.renewalDate
          ? dateOnly(dto.renewalDate)
          : null
        : existing.renewalDate;

    const newContractValue =
      dto.contractValue !== undefined ? round2(asNumber(dto.contractValue)) : asNumber(existing.contractValue);

    // PRD 8.2 Rule 5: Perubahan nilai dan masa berlaku harus tercatat di audit trail
    if (dto.contractValue !== undefined && Math.abs(newContractValue - asNumber(existing.contractValue)) > 0.01) {
      await this.logContractAudit({
        contractId: id,
        action: "UPDATED",
        user,
        fieldChanged: "contractValue",
        oldValue: String(existing.contractValue),
        newValue: String(newContractValue),
        notes: "Perubahan nilai kontrak",
      });
    }

    if (
      dto.expirationDate !== undefined &&
      formatIsoDate(expirationDate) !== formatIsoDate(existing.expirationDate)
    ) {
      await this.logContractAudit({
        contractId: id,
        action: "UPDATED",
        user,
        fieldChanged: "expirationDate",
        oldValue: formatIsoDate(existing.expirationDate),
        newValue: formatIsoDate(expirationDate),
        notes: "Perubahan tanggal berakhir kontrak",
      });
    }

    await this.db().ctrContract.update({
      where: { id },
      data: {
        ...(dto.officialNumber !== undefined ? { officialNumber: optionalString(dto.officialNumber) } : {}),
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.typeId !== undefined ? { typeId: Number(dto.typeId) } : {}),
        ...(dto.counterpartyType !== undefined
          ? { counterpartyType: dto.counterpartyType.trim().toUpperCase() }
          : {}),
        ...(dto.counterpartyId !== undefined
          ? { counterpartyId: dto.counterpartyId ? Number(dto.counterpartyId) : null }
          : {}),
        ...(dto.counterpartyName !== undefined ? { counterpartyName: dto.counterpartyName.trim() } : {}),
        ...(effectiveDate ? { effectiveDate } : {}),
        ...(expirationDate ? { expirationDate } : {}),
        ...(dto.renewalDate !== undefined ? { renewalDate } : {}),
        ...(dto.isAutoRenewal !== undefined ? { isAutoRenewal: Boolean(dto.isAutoRenewal) } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency.trim() } : {}),
        ...(dto.contractValue !== undefined ? { contractValue: newContractValue } : {}),
        ...(dto.contractOwnerId !== undefined
          ? { contractOwnerId: dto.contractOwnerId ? Number(dto.contractOwnerId) : null }
          : {}),
        ...(dto.department !== undefined ? { department: dto.department.trim() } : {}),
        ...(dto.paymentTerms !== undefined ? { paymentTerms: optionalString(dto.paymentTerms) } : {}),
        ...(dto.paymentFrequency !== undefined
          ? { paymentFrequency: dto.paymentFrequency.trim().toUpperCase() }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status.trim().toUpperCase() } : {}),
        ...(dto.approvalStatus !== undefined
          ? { approvalStatus: dto.approvalStatus.trim().toUpperCase() }
          : {}),
        ...(dto.description !== undefined ? { description: optionalString(dto.description) } : {}),
      },
    });

    if (dto.financial) {
      const f = dto.financial;
      const baseAmt = f.baseAmount !== undefined ? round2(asNumber(f.baseAmount)) : newContractValue;
      const taxPct = f.taxPercentage !== undefined ? round2(asNumber(f.taxPercentage)) : asNumber(existing.financial?.taxPercentage);
      const taxAmt = f.taxAmount !== undefined ? round2(asNumber(f.taxAmount)) : round2(baseAmt * (taxPct / 100));
      const totAmt = f.totalAmount !== undefined && asNumber(f.totalAmount) > 0 ? round2(asNumber(f.totalAmount)) : round2(baseAmt + taxAmt);

      await this.db().ctrFinancial.upsert({
        where: { contractId: id },
        create: {
          contractId: id,
          valueType: optionalString(f.valueType)?.toUpperCase() || "FIXED",
          currency: optionalString(f.currency) || existing.currency,
          baseAmount: baseAmt,
          taxPercentage: taxPct,
          taxAmount: taxAmt,
          totalAmount: totAmt,
          downPaymentAmount: round2(asNumber(f.downPaymentAmount)),
          retentionAmount: round2(asNumber(f.retentionAmount)),
          retentionPeriodDays: f.retentionPeriodDays ? Number(f.retentionPeriodDays) : null,
          penaltyTerms: optionalString(f.penaltyTerms),
          costCenter: optionalString(f.costCenter),
          projectReference: optionalString(f.projectReference),
          notes: optionalString(f.notes),
        },
        update: {
          ...(f.valueType !== undefined ? { valueType: f.valueType.toUpperCase() } : {}),
          ...(f.currency !== undefined ? { currency: f.currency } : {}),
          baseAmount: baseAmt,
          taxPercentage: taxPct,
          taxAmount: taxAmt,
          totalAmount: totAmt,
          ...(f.downPaymentAmount !== undefined ? { downPaymentAmount: round2(asNumber(f.downPaymentAmount)) } : {}),
          ...(f.retentionAmount !== undefined ? { retentionAmount: round2(asNumber(f.retentionAmount)) } : {}),
          ...(f.retentionPeriodDays !== undefined
            ? { retentionPeriodDays: f.retentionPeriodDays ? Number(f.retentionPeriodDays) : null }
            : {}),
          ...(f.penaltyTerms !== undefined ? { penaltyTerms: optionalString(f.penaltyTerms) } : {}),
          ...(f.costCenter !== undefined ? { costCenter: optionalString(f.costCenter) } : {}),
          ...(f.projectReference !== undefined ? { projectReference: optionalString(f.projectReference) } : {}),
          ...(f.notes !== undefined ? { notes: optionalString(f.notes) } : {}),
        },
      });
    }

    if (Array.isArray(dto.parties) && dto.parties.length > 0) {
      await this.db().ctrParty.deleteMany({ where: { contractId: id } });
      for (const p of dto.parties) {
        await this.db().ctrParty.create({
          data: {
            contractId: id,
            partyType: optionalString(p.partyType) || "SECOND_PARTY",
            entityType: optionalString(p.entityType) || "OTHER",
            entityId: p.entityId ? Number(p.entityId) : null,
            name: p.name.trim(),
            role: optionalString(p.role),
            address: optionalString(p.address),
            picName: optionalString(p.picName),
            picEmail: optionalString(p.picEmail),
            picPhone: optionalString(p.picPhone),
          },
        });
      }
    }

    if (Array.isArray(dto.services)) {
      await this.db().ctrService.deleteMany({ where: { contractId: id } });
      for (const s of dto.services) {
        await this.db().ctrService.create({
          data: {
            contractId: id,
            serviceName: s.serviceName.trim(),
            serviceScope: optionalString(s.serviceScope),
            servicePeriod: optionalString(s.servicePeriod),
            serviceLocation: optionalString(s.serviceLocation),
            supportContact: optionalString(s.supportContact),
            serviceFee: s.serviceFee !== undefined ? round2(asNumber(s.serviceFee)) : null,
            penaltyClause: optionalString(s.penaltyClause),
            renewalTerms: optionalString(s.renewalTerms),
          },
        });
      }
    }

    if (Array.isArray(dto.slas)) {
      await this.db().ctrSla.deleteMany({ where: { contractId: id } });
      for (const sla of dto.slas) {
        await this.db().ctrSla.create({
          data: {
            contractId: id,
            indicatorName: sla.indicatorName.trim(),
            targetMetric: sla.targetMetric.trim(),
            responseHours: sla.responseHours !== undefined ? round2(asNumber(sla.responseHours)) : null,
            resolutionHours: sla.resolutionHours !== undefined ? round2(asNumber(sla.resolutionHours)) : null,
            penaltyDetails: optionalString(sla.penaltyDetails),
            operationalHours: optionalString(sla.operationalHours) || "8x5",
          },
        });
      }
    }

    if (Array.isArray(dto.terms)) {
      await this.db().ctrTerm.deleteMany({ where: { contractId: id } });
      for (const t of dto.terms) {
        await this.db().ctrTerm.create({
          data: {
            contractId: id,
            termType: optionalString(t.termType)?.toUpperCase() || "GENERAL",
            clauseNumber: optionalString(t.clauseNumber),
            title: t.title.trim(),
            content: t.content.trim(),
          },
        });
      }
    }

    if (Array.isArray(dto.paymentSchedules)) {
      await this.db().ctrPaymentSchedule.deleteMany({ where: { contractId: id } });
      for (let i = 0; i < dto.paymentSchedules.length; i++) {
        const ps = dto.paymentSchedules[i]!;
        const amt = round2(asNumber(ps.amount));
        const tx = round2(asNumber(ps.taxAmount));
        await this.db().ctrPaymentSchedule.create({
          data: {
            contractId: id,
            scheduleNumber: ps.scheduleNumber ? Number(ps.scheduleNumber) : i + 1,
            milestoneName: ps.milestoneName.trim(),
            dueDate: dateOnly(ps.dueDate) ?? effectiveDate ?? todayWibDateOnly(),
            amount: amt,
            taxAmount: tx,
            totalAmount: ps.totalAmount !== undefined ? round2(asNumber(ps.totalAmount)) : round2(amt + tx),
            paymentStatus: optionalString(ps.paymentStatus)?.toUpperCase() || "PLANNED",
            invoiceReference: optionalString(ps.invoiceReference),
            paidDate: ps.paidDate ? dateOnly(ps.paidDate) : null,
            notes: optionalString(ps.notes),
          },
        });
      }
    }

    await this.logContractAudit({
      contractId: id,
      action: "UPDATED",
      user,
      notes: "Data kontrak diperbarui",
    });

    return this.get(id, user);
  }

  async remove(id: number, user: RequestUser) {
    const existing = await this.db().ctrContract.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Kontrak #${id} tidak ditemukan.`);

    // PRD 8.2 Rule 4: Kontrak yang sudah aktif tidak boleh dihapus permanen
    if (
      existing.approvalStatus === "APPROVED" ||
      (existing.status === "ACTIVE" && existing.approvalStatus !== "DRAFT" && existing.approvalStatus !== "CANCELLED")
    ) {
      throw new BadRequestException(
        "Sesuai aturan perusahaan (PRD 8.2), kontrak yang sudah aktif/disetujui tidak boleh dihapus permanen. Gunakan fitur Penghentian Kontrak (Terminasi).",
      );
    }

    await this.db().ctrContract.delete({ where: { id } });
    await this.audit.log({
      actor: user,
      action: "DELETE_CONTRACT",
      entityType: "contract",
      entityId: id,
      detail: `Menghapus draft kontrak ${existing.contractNumber}`,
    });
    return { deleted: true, id };
  }

  // ───────────────────────────── Approval Workflow (PRD 3.5 & 5.2-5.3) ─────────────────────────────

  async decideApproval(id: number, dto: ContractApprovalDecisionDto, user: RequestUser) {
    const contract = await this.db().ctrContract.findUnique({
      where: { id },
      include: {
        documents: {
          include: { versions: { orderBy: { versionNumber: "desc" } } },
        },
      },
    });
    if (!contract) throw new NotFoundException(`Kontrak #${id} tidak ditemukan.`);

    const decision = dto.decision.toUpperCase();
    const stage = optionalString(dto.stage)?.toUpperCase() || "DIRECTOR_APPROVAL";

    // Cari versi dokumen terbaru untuk dikunci jika disetujui (PRD 8.2 Rule 7)
    let lockedVersionId: number | null = dto.approvedDocumentVersionId
      ? Number(dto.approvedDocumentVersionId)
      : null;

    if (!lockedVersionId && contract.documents?.length > 0) {
      const mainDoc =
        contract.documents.find((d: any) => d.documentCategory === "MAIN_CONTRACT") ??
        contract.documents[0];
      const latestVer = mainDoc?.versions?.[0];
      if (latestVer) lockedVersionId = latestVer.id;
    }

    if (decision === "APPROVED" && lockedVersionId) {
      await this.db().ctrDocumentVersion.update({
        where: { id: lockedVersionId },
        data: { isLockedForApproval: true },
      });
    }

    const countApprovals = await this.db().ctrApproval.count({ where: { contractId: id } });
    await this.db().ctrApproval.create({
      data: {
        contractId: id,
        stage,
        sequence: countApprovals + 1,
        status: decision,
        approverId: user?.id ?? null,
        approverRole: user?.role ?? null,
        decisionTimestamp: new Date(),
        comments: optionalString(dto.comments),
        approvedDocumentVersionId: lockedVersionId,
      },
    });

    const newContractStatus =
      decision === "APPROVED"
        ? evaluateContractLifecycleStatus({
            currentStatus: "ACTIVE",
            approvalStatus: "APPROVED",
            expirationDate: contract.expirationDate,
            renewalDate: contract.renewalDate,
          })
        : contract.status;

    await this.db().ctrContract.update({
      where: { id },
      data: {
        approvalStatus: decision,
        status: newContractStatus,
      },
    });

    await this.logContractAudit({
      contractId: id,
      action: `APPROVAL_${decision}`,
      user,
      fieldChanged: "approvalStatus",
      oldValue: contract.approvalStatus,
      newValue: decision,
      notes: optionalString(dto.comments) || `Tahap ${stage}: ${decision}`,
    });

    if (contract.contractOwnerId) {
      await this.notifications.notify({
        userIds: [Number(contract.contractOwnerId)],
        kind: "APPROVAL" as any,
        title: `Status Approval Kontrak ${contract.contractNumber}`,
        text: `Kontrak "${contract.title}" diperbarui menjadi ${decision}${dto.comments ? `: ${dto.comments}` : ""}.`,
        href: "/contracts",
      });
    }

    return this.get(id, user);
  }

  // ───────────────────────────── Document & Version Control (PRD 3.3) ─────────────────────────────

  async addDocument(contractId: number, dto: ContractDocumentDto, user: RequestUser) {
    const contract = await this.db().ctrContract.findUnique({ where: { id: contractId } });
    if (!contract) throw new NotFoundException(`Kontrak #${contractId} tidak ditemukan.`);

    const fileUrl = dto.fileUrl.trim();
    const fileName = optionalString(dto.fileName) || fileUrl.split("/").pop() || "document.pdf";

    const doc = await this.db().ctrDocument.create({
      data: {
        contractId,
        documentCategory: optionalString(dto.documentCategory)?.toUpperCase() || "SUPPORTING",
        documentTitle: dto.documentTitle.trim(),
        documentNumber: optionalString(dto.documentNumber),
        isConfidential: Boolean(dto.isConfidential),
        signedDate: dto.signedDate ? dateOnly(dto.signedDate) : null,
        signedByFirstParty: optionalString(dto.signedByFirstParty),
        signedBySecondParty: optionalString(dto.signedBySecondParty),
        currentVersionNumber: 1,
        versions: {
          create: {
            versionNumber: 1,
            fileId: dto.fileId ? Number(dto.fileId) : null,
            fileUrl,
            fileName,
            fileSize: dto.fileSize ? Number(dto.fileSize) : null,
            mimeType: optionalString(dto.mimeType) || "application/pdf",
            changeSummary: optionalString(dto.changeSummary) || "Dokumen versi 1 diunggah",
            isLockedForApproval: false,
            uploadedById: user?.id ?? null,
          },
        },
      },
    });

    await this.logContractAudit({
      contractId,
      action: "DOCUMENT_UPLOADED",
      user,
      newValue: `${doc.documentTitle} (v1)`,
      notes: `Mengunggah dokumen kategori ${doc.documentCategory}`,
    });

    return this.get(contractId, user);
  }

  async addDocumentVersion(
    contractId: number,
    documentId: number,
    dto: ContractDocumentVersionDto,
    user: RequestUser,
  ) {
    const doc = await this.db().ctrDocument.findFirst({
      where: { id: documentId, contractId },
      include: { versions: { orderBy: { versionNumber: "desc" } } },
    });
    if (!doc) throw new NotFoundException(`Dokumen kontrak #${documentId} tidak ditemukan.`);

    // PRD 3.3 Rule 7: Menyimpan dokumen hasil revisi tanpa menghapus versi sebelumnya
    const nextVersion = Number(doc.currentVersionNumber || 1) + 1;
    const fileUrl = dto.fileUrl.trim();
    const fileName = optionalString(dto.fileName) || fileUrl.split("/").pop() || `v${nextVersion}.pdf`;

    await this.db().ctrDocumentVersion.create({
      data: {
        documentId,
        versionNumber: nextVersion,
        fileId: dto.fileId ? Number(dto.fileId) : null,
        fileUrl,
        fileName,
        fileSize: dto.fileSize ? Number(dto.fileSize) : null,
        mimeType: optionalString(dto.mimeType) || "application/pdf",
        changeSummary: optionalString(dto.changeSummary) || `Revisi dokumen versi v${nextVersion}`,
        isLockedForApproval: false,
        uploadedById: user?.id ?? null,
      },
    });

    await this.db().ctrDocument.update({
      where: { id: documentId },
      data: { currentVersionNumber: nextVersion },
    });

    await this.logContractAudit({
      contractId,
      action: "VERSION_ADDED",
      user,
      fieldChanged: doc.documentTitle,
      oldValue: `v${doc.currentVersionNumber}`,
      newValue: `v${nextVersion}`,
      notes: optionalString(dto.changeSummary) || `Menambahkan revisi v${nextVersion}`,
    });

    return this.get(contractId, user);
  }

  async removeDocument(contractId: number, documentId: number, user: RequestUser) {
    const doc = await this.db().ctrDocument.findFirst({
      where: { id: documentId, contractId },
      include: { versions: true },
    });
    if (!doc) throw new NotFoundException(`Dokumen #${documentId} tidak ditemukan.`);

    const hasLocked = (doc.versions ?? []).some((v: any) => v.isLockedForApproval);
    if (hasLocked) {
      throw new BadRequestException(
        "Dokumen yang memiliki versi terkunci sebagai referensi approval tidak dapat dihapus (PRD 8.2 Rule 7). Silakan unggah revisi versi baru.",
      );
    }

    await this.db().ctrDocument.delete({ where: { id: documentId } });
    await this.logContractAudit({
      contractId,
      action: "DOCUMENT_REMOVED",
      user,
      oldValue: doc.documentTitle,
      notes: "Menghapus dokumen pendukung kontrak",
    });

    return this.get(contractId, user);
  }

  // ───────────────────────────── Renewal Workflow (PRD 3.5 & 5.5 & 15.4) ─────────────────────────────

  async requestRenewal(contractId: number, dto: ContractRenewalRequestDto, user: RequestUser) {
    const contract = await this.db().ctrContract.findUnique({
      where: { id: contractId },
      include: { renewals: true },
    });
    if (!contract) throw new NotFoundException(`Kontrak #${contractId} tidak ditemukan.`);

    const proposedEffectiveDate = dateOnly(dto.proposedEffectiveDate);
    const proposedExpirationDate = dateOnly(dto.proposedExpirationDate);
    if (!proposedEffectiveDate || !proposedExpirationDate) {
      throw new BadRequestException("Periode tanggal efektif dan berakhir baru wajib diisi.");
    }
    if (proposedExpirationDate.getTime() <= proposedEffectiveDate.getTime()) {
      throw new BadRequestException("Tanggal berakhir perpanjangan harus setelah tanggal mulai perpanjangan.");
    }

    const renewalNumber = (contract.renewals?.length || 0) + 1;
    const renewalCode = await this.generateRenewalCode();
    const proposedValue = round2(asNumber(dto.proposedValue));
    const previousValue = round2(asNumber(contract.contractValue));
    const submissionDate = dto.submissionDate ? dateOnly(dto.submissionDate) ?? todayWibDateOnly() : todayWibDateOnly();

    let draftAddendumDocId: number | null = null;
    if (optionalString(dto.addendumFileUrl)) {
      const fileUrl = String(dto.addendumFileUrl).trim();
      const doc = await this.db().ctrDocument.create({
        data: {
          contractId,
          documentCategory: "ADDENDUM",
          documentTitle: optionalString(dto.addendumTitle) || `Addendum Perpanjangan #${renewalNumber}`,
          currentVersionNumber: 1,
          versions: {
            create: {
              versionNumber: 1,
              fileUrl,
              fileName: optionalString(dto.addendumFileName) || fileUrl.split("/").pop() || "addendum.pdf",
              changeSummary: `Dokumen perpanjangan ${renewalCode}`,
              uploadedById: user?.id ?? null,
            },
          },
        },
      });
      draftAddendumDocId = doc.id;
    }

    const autoApprove = Boolean(dto.autoApprove);
    const renewal = await this.db().ctrRenewal.create({
      data: {
        contractId,
        renewalNumber,
        renewalCode,
        submissionDate,
        proposedEffectiveDate,
        proposedExpirationDate,
        previousValue,
        proposedValue,
        reason: dto.reason.trim(),
        status: autoApprove ? "APPROVED" : "PENDING_REVIEW",
        submittedById: user?.id ?? null,
        reviewedById: autoApprove ? user?.id ?? null : null,
        reviewedAt: autoApprove ? new Date() : null,
        reviewComments: optionalString(dto.reviewComments),
        draftAddendumDocId,
      },
    });

    if (autoApprove) {
      await this.applyApprovedRenewal(contract, renewal, user);
    } else {
      await this.db().ctrContract.update({
        where: { id: contractId },
        data: { status: "RENEWAL_PENDING" },
      });
      await this.logContractAudit({
        contractId,
        action: "RENEWAL_SUBMITTED",
        user,
        oldValue: `${formatIsoDate(contract.effectiveDate)} s/d ${formatIsoDate(contract.expirationDate)}`,
        newValue: `${formatIsoDate(proposedEffectiveDate)} s/d ${formatIsoDate(proposedExpirationDate)} (${contract.currency} ${proposedValue.toLocaleString("id-ID")})`,
        notes: `Pengajuan renewal ${renewalCode}: ${dto.reason.trim()}`,
      });
    }

    return this.get(contractId, user);
  }

  async decideRenewal(
    contractId: number,
    renewalId: number,
    dto: ContractRenewalDecisionDto,
    user: RequestUser,
  ) {
    const contract = await this.db().ctrContract.findUnique({ where: { id: contractId } });
    if (!contract) throw new NotFoundException(`Kontrak #${contractId} tidak ditemukan.`);

    const renewal = await this.db().ctrRenewal.findFirst({
      where: { id: renewalId, contractId },
    });
    if (!renewal) throw new NotFoundException(`Pengajuan renewal #${renewalId} tidak ditemukan.`);

    const decision = dto.decision.toUpperCase();
    const updatedRenewal = await this.db().ctrRenewal.update({
      where: { id: renewalId },
      data: {
        status: decision,
        reviewedById: user?.id ?? null,
        reviewedAt: new Date(),
        reviewComments: optionalString(dto.reviewComments),
      },
    });

    if (decision === "APPROVED") {
      await this.applyApprovedRenewal(contract, updatedRenewal, user);
    } else {
      const fallbackStatus = evaluateContractLifecycleStatus({
        currentStatus: "ACTIVE",
        approvalStatus: contract.approvalStatus,
        expirationDate: contract.expirationDate,
        renewalDate: contract.renewalDate,
      });
      await this.db().ctrContract.update({
        where: { id: contractId },
        data: { status: fallbackStatus },
      });
      await this.logContractAudit({
        contractId,
        action: `RENEWAL_${decision}`,
        user,
        notes: optionalString(dto.reviewComments) || `Renewal ${renewal.renewalCode} ${decision}`,
      });
    }

    return this.get(contractId, user);
  }

  private async applyApprovedRenewal(contract: any, renewal: any, user: RequestUser) {
    // PRD 15.4: Contract Renewal tidak menghapus histori; simpan periode lama di histori amendment/renewal dan perbarui masa berlaku aktif
    const oldPeriod = `${formatIsoDate(contract.effectiveDate)} s/d ${formatIsoDate(contract.expirationDate)}`;
    const newPeriod = `${formatIsoDate(renewal.proposedEffectiveDate)} s/d ${formatIsoDate(renewal.proposedExpirationDate)}`;
    const newRenewalDate = addDaysUtc(renewal.proposedExpirationDate, -30);

    await this.db().ctrAmendment.create({
      data: {
        contractId: contract.id,
        amendmentNumber: `AMD/${contract.contractNumber}/REN-${String(renewal.renewalNumber).padStart(2, "0")}`,
        amendmentDate: todayWibDateOnly(),
        title: `Perpanjangan Kontrak Periode #${renewal.renewalNumber} (${renewal.renewalCode})`,
        description: `Perpanjangan masa berlaku dari (${oldPeriod}) menjadi (${newPeriod}). Alasan: ${renewal.reason}`,
        valueAdjustment: round2(asNumber(renewal.proposedValue) - asNumber(contract.contractValue)),
        newEffectiveDate: renewal.proposedEffectiveDate,
        newExpirationDate: renewal.proposedExpirationDate,
        documentId: renewal.draftAddendumDocId ?? null,
        approvedById: user?.id ?? null,
      },
    });

    await this.db().ctrContract.update({
      where: { id: contract.id },
      data: {
        effectiveDate: renewal.proposedEffectiveDate,
        expirationDate: renewal.proposedExpirationDate,
        renewalDate: newRenewalDate,
        contractValue: renewal.proposedValue,
        status: "ACTIVE",
        approvalStatus: "APPROVED",
      },
    });

    await this.logContractAudit({
      contractId: contract.id,
      action: "RENEWED",
      user,
      fieldChanged: "expirationDate & contractValue",
      oldValue: `${oldPeriod} | ${contract.contractValue}`,
      newValue: `${newPeriod} | ${renewal.proposedValue}`,
      notes: `Perpanjangan ${renewal.renewalCode} disetujui`,
    });
  }

  // ───────────────────────────── Amendments / Addendum (PRD 3.3 & 14) ─────────────────────────────

  async addAmendment(contractId: number, dto: ContractAmendmentDto, user: RequestUser) {
    const contract = await this.db().ctrContract.findUnique({
      where: { id: contractId },
      include: { amendments: true },
    });
    if (!contract) throw new NotFoundException(`Kontrak #${contractId} tidak ditemukan.`);

    const seq = (contract.amendments?.length || 0) + 1;
    const amendmentNumber =
      optionalString(dto.amendmentNumber) ||
      `AMD/${contract.contractNumber}/${String(seq).padStart(2, "0")}`;
    const amendmentDate = dateOnly(dto.amendmentDate) ?? todayWibDateOnly();
    const valueAdjustment = round2(asNumber(dto.valueAdjustment));
    const newEffectiveDate = dto.newEffectiveDate ? dateOnly(dto.newEffectiveDate) : null;
    const newExpirationDate = dto.newExpirationDate ? dateOnly(dto.newExpirationDate) : null;

    let docId: number | null = null;
    if (optionalString(dto.fileUrl)) {
      const fileUrl = String(dto.fileUrl).trim();
      const doc = await this.db().ctrDocument.create({
        data: {
          contractId,
          documentCategory: "ADDENDUM",
          documentTitle: `${amendmentNumber} — ${dto.title.trim()}`,
          documentNumber: amendmentNumber,
          signedDate: amendmentDate,
          currentVersionNumber: 1,
          versions: {
            create: {
              versionNumber: 1,
              fileUrl,
              fileName: optionalString(dto.fileName) || fileUrl.split("/").pop() || "addendum.pdf",
              changeSummary: dto.description.trim(),
              isLockedForApproval: true,
              uploadedById: user?.id ?? null,
            },
          },
        },
      });
      docId = doc.id;
    }

    await this.db().ctrAmendment.create({
      data: {
        contractId,
        amendmentNumber,
        amendmentDate,
        title: dto.title.trim(),
        description: dto.description.trim(),
        valueAdjustment,
        newEffectiveDate,
        newExpirationDate,
        documentId: docId,
        approvedById: user?.id ?? null,
      },
    });

    const updatedContractValue = round2(asNumber(contract.contractValue) + valueAdjustment);
    await this.db().ctrContract.update({
      where: { id: contractId },
      data: {
        ...(Math.abs(valueAdjustment) > 0.001 ? { contractValue: updatedContractValue } : {}),
        ...(newEffectiveDate ? { effectiveDate: newEffectiveDate } : {}),
        ...(newExpirationDate
          ? {
              expirationDate: newExpirationDate,
              renewalDate: addDaysUtc(newExpirationDate, -30),
            }
          : {}),
      },
    });

    await this.logContractAudit({
      contractId,
      action: "AMENDED",
      user,
      newValue: `${amendmentNumber}: ${dto.title.trim()}`,
      notes: dto.description.trim(),
    });

    return this.get(contractId, user);
  }

  // ───────────────────────────── Contract Termination (PRD 5.6) ─────────────────────────────

  async terminate(contractId: number, dto: ContractTerminationDto, user: RequestUser) {
    const contract = await this.db().ctrContract.findUnique({ where: { id: contractId } });
    if (!contract) throw new NotFoundException(`Kontrak #${contractId} tidak ditemukan.`);

    const terminationDate = dateOnly(dto.terminationDate) ?? todayWibDateOnly();
    const penaltyAmount = round2(asNumber(dto.penaltyAmount));

    let beritaAcaraDocId: number | null = null;
    if (optionalString(dto.beritaAcaraFileUrl)) {
      const fileUrl = String(dto.beritaAcaraFileUrl).trim();
      const doc = await this.db().ctrDocument.create({
        data: {
          contractId,
          documentCategory: "BERITA_ACARA",
          documentTitle: `Berita Acara Penghentian Kontrak — ${contract.contractNumber}`,
          signedDate: terminationDate,
          currentVersionNumber: 1,
          versions: {
            create: {
              versionNumber: 1,
              fileUrl,
              fileName: optionalString(dto.beritaAcaraFileName) || fileUrl.split("/").pop() || "ba-terminasi.pdf",
              changeSummary: `Berita acara terminasi kontrak: ${dto.reason.trim()}`,
              isLockedForApproval: true,
              uploadedById: user?.id ?? null,
            },
          },
        },
      });
      beritaAcaraDocId = doc.id;
    }

    await this.db().ctrTermination.upsert({
      where: { contractId },
      create: {
        contractId,
        terminationDate,
        reason: dto.reason.trim(),
        penaltyAmount,
        remainingObligations: optionalString(dto.remainingObligations),
        checklistConfirmed: Boolean(dto.checklistConfirmed),
        beritaAcaraDocId,
        approvedById: user?.id ?? null,
        status: "APPROVED",
      },
      update: {
        terminationDate,
        reason: dto.reason.trim(),
        penaltyAmount,
        remainingObligations: optionalString(dto.remainingObligations),
        checklistConfirmed: Boolean(dto.checklistConfirmed),
        ...(beritaAcaraDocId ? { beritaAcaraDocId } : {}),
        approvedById: user?.id ?? null,
        status: "APPROVED",
      },
    });

    await this.db().ctrContract.update({
      where: { id: contractId },
      data: { status: "TERMINATED" },
    });

    await this.logContractAudit({
      contractId,
      action: "TERMINATED",
      user,
      oldValue: contract.status,
      newValue: "TERMINATED",
      notes: `Penghentian kontrak efektif ${formatIsoDate(terminationDate)}. Alasan: ${dto.reason.trim()}`,
    });

    return this.get(contractId, user);
  }

  // ───────────────────────────── Payment Schedules & ERP Relations ─────────────────────────────

  async addPaymentSchedule(
    contractId: number,
    dto: ContractPaymentScheduleInputDto,
    user: RequestUser,
  ) {
    const contract = await this.db().ctrContract.findUnique({
      where: { id: contractId },
      include: { paymentSchedules: true },
    });
    if (!contract) throw new NotFoundException(`Kontrak #${contractId} tidak ditemukan.`);

    const seq = dto.scheduleNumber ? Number(dto.scheduleNumber) : (contract.paymentSchedules?.length || 0) + 1;
    const amt = round2(asNumber(dto.amount));
    const tx = round2(asNumber(dto.taxAmount));
    const tot = dto.totalAmount !== undefined ? round2(asNumber(dto.totalAmount)) : round2(amt + tx);

    await this.db().ctrPaymentSchedule.create({
      data: {
        contractId,
        scheduleNumber: seq,
        milestoneName: dto.milestoneName.trim(),
        dueDate: dateOnly(dto.dueDate) ?? todayWibDateOnly(),
        amount: amt,
        taxAmount: tx,
        totalAmount: tot,
        paymentStatus: optionalString(dto.paymentStatus)?.toUpperCase() || "PLANNED",
        invoiceReference: optionalString(dto.invoiceReference),
        paidDate: dto.paidDate ? dateOnly(dto.paidDate) : null,
        notes: optionalString(dto.notes),
      },
    });

    await this.logContractAudit({
      contractId,
      action: "PAYMENT_SCHEDULE_ADDED",
      user,
      newValue: `${dto.milestoneName.trim()} (${tot.toLocaleString("id-ID")})`,
    });

    return this.get(contractId, user);
  }

  async updatePaymentSchedule(
    contractId: number,
    scheduleId: number,
    dto: Partial<ContractPaymentScheduleInputDto>,
    user: RequestUser,
  ) {
    const sched = await this.db().ctrPaymentSchedule.findFirst({
      where: { id: scheduleId, contractId },
    });
    if (!sched) throw new NotFoundException(`Jadwal pembayaran #${scheduleId} tidak ditemukan.`);

    const amt = dto.amount !== undefined ? round2(asNumber(dto.amount)) : asNumber(sched.amount);
    const tx = dto.taxAmount !== undefined ? round2(asNumber(dto.taxAmount)) : asNumber(sched.taxAmount);
    const tot = dto.totalAmount !== undefined ? round2(asNumber(dto.totalAmount)) : round2(amt + tx);

    await this.db().ctrPaymentSchedule.update({
      where: { id: scheduleId },
      data: {
        ...(dto.milestoneName !== undefined ? { milestoneName: dto.milestoneName.trim() } : {}),
        ...(dto.dueDate !== undefined ? { dueDate: dateOnly(dto.dueDate) ?? sched.dueDate } : {}),
        amount: amt,
        taxAmount: tx,
        totalAmount: tot,
        ...(dto.paymentStatus !== undefined ? { paymentStatus: dto.paymentStatus.toUpperCase() } : {}),
        ...(dto.invoiceReference !== undefined ? { invoiceReference: optionalString(dto.invoiceReference) } : {}),
        ...(dto.paidDate !== undefined ? { paidDate: dto.paidDate ? dateOnly(dto.paidDate) : null } : {}),
        ...(dto.notes !== undefined ? { notes: optionalString(dto.notes) } : {}),
      },
    });

    await this.logContractAudit({
      contractId,
      action: "PAYMENT_SCHEDULE_UPDATED",
      user,
      newValue: `${sched.milestoneName} -> ${dto.paymentStatus ?? sched.paymentStatus}`,
    });

    return this.get(contractId, user);
  }

  async addRelation(contractId: number, dto: ContractRelationInputDto, user: RequestUser) {
    const contract = await this.db().ctrContract.findUnique({ where: { id: contractId } });
    if (!contract) throw new NotFoundException(`Kontrak #${contractId} tidak ditemukan.`);

    await this.db().ctrRelation.create({
      data: {
        contractId,
        relatedModule: dto.relatedModule.trim().toUpperCase(),
        relatedId: Number(dto.relatedId),
        referenceCode: optionalString(dto.referenceCode),
        notes: optionalString(dto.notes),
      },
    });

    await this.logContractAudit({
      contractId,
      action: "RELATION_ADDED",
      user,
      newValue: `${dto.relatedModule.toUpperCase()} #${dto.relatedId} (${dto.referenceCode ?? "-"})`,
    });

    return this.get(contractId, user);
  }

  async removeRelation(contractId: number, relationId: number, user: RequestUser) {
    await this.db().ctrRelation.deleteMany({
      where: { id: relationId, contractId },
    });
    return this.get(contractId, user);
  }

  // ───────────────────────────── Expiration Reminders & Calendar Integration ─────────────────────────────

  async runReminders(dto: RunContractRemindersDto, user?: RequestUser | null) {
    const asOf = dto?.asOfDate ? dateOnly(dto.asOfDate) ?? todayWibDateOnly() : todayWibDateOnly();
    const rules = await this.listExpirationRules();
    const contracts = await this.db().ctrContract.findMany({
      where: {
        status: { notIn: ["TERMINATED"] },
      },
      include: { type: true },
    });

    const sentNotifications: any[] = [];

    for (const c of contracts) {
      const daysLeft = daysUntilUtc(c.expirationDate, asOf);
      const nextStatus = evaluateContractLifecycleStatus({
        currentStatus: c.status,
        approvalStatus: c.approvalStatus,
        expirationDate: c.expirationDate,
        renewalDate: c.renewalDate,
        asOfDate: asOf,
      });

      if (nextStatus !== c.status) {
        await this.db().ctrContract.update({
          where: { id: c.id },
          data: { status: nextStatus },
        });
      }

      // Cek kecocokan dengan rule H-90, H-60, H-30, H-14, H-7, H-1, H+1
      const matchedRule = rules.find(
        (r: any) =>
          r.isActive &&
          (!r.typeId || Number(r.typeId) === Number(c.typeId)) &&
          Number(r.daysOffset) === daysLeft,
      );

      // Juga dukung peringatan jika kontrak berada dalam <= 30 hari dan belum pernah diingatkan untuk periode H-30
      const triggerPeriod = matchedRule
        ? matchedRule.daysOffset >= 0
          ? `H-${matchedRule.daysOffset}`
          : `H+${Math.abs(matchedRule.daysOffset)}`
        : daysLeft < 0
          ? "H+1"
          : daysLeft <= 7
            ? "H-7"
            : daysLeft <= 14
              ? "H-14"
              : daysLeft <= 30
                ? "H-30"
                : null;

      if (!triggerPeriod) continue;

      // PRD 8.2 Rule 8: Reminder tidak boleh terkirim berulang tanpa kontrol duplikasi
      const alreadySent = await this.db().ctrNotification.findFirst({
        where: {
          contractId: c.id,
          triggerPeriod,
        },
      });
      if (alreadySent) continue;

      const msg =
        daysLeft < 0
          ? `Kontrak ${c.contractNumber} (${c.title}) dengan ${c.counterpartyName} telah melewati tanggal berakhir (${formatIsoDate(c.expirationDate)}).`
          : `Pengingat ${triggerPeriod}: Kontrak ${c.contractNumber} (${c.title}) dengan ${c.counterpartyName} akan berakhir dalam ${daysLeft} hari (${formatIsoDate(c.expirationDate)}).`;

      const rec = await this.db().ctrNotification.create({
        data: {
          contractId: c.id,
          notificationType: daysLeft < 0 ? "EXPIRED" : "EXPIRATION_REMINDER",
          triggerPeriod,
          recipientUserId: c.contractOwnerId ?? user?.id ?? null,
          channel: "IN_APP",
          message: msg,
          deliveryStatus: "DELIVERED",
        },
      });

      if (c.contractOwnerId) {
        await this.notifications.notify({
          userIds: [Number(c.contractOwnerId)],
          kind: "LAINNYA" as any,
          title: `Reminder Kontrak ${triggerPeriod}: ${c.contractNumber}`,
          text: msg,
          href: "/contracts",
        });
      }

      sentNotifications.push(rec);
    }

    return {
      asOfDate: formatIsoDate(asOf),
      checkedCount: contracts.length,
      sentCount: sentNotifications.length,
      notifications: sentNotifications,
    };
  }

  async calendarExpirations(from: Date, to: Date) {
    const rows = await this.db().ctrContract.findMany({
      where: {
        status: { notIn: ["TERMINATED"] },
        OR: [
          { expirationDate: { gte: from, lte: to } },
          { renewalDate: { gte: from, lte: to } },
        ],
      },
      include: {
        type: { select: { name: true, code: true } },
      },
      orderBy: { expirationDate: "asc" },
    });

    const users = await this.userMap(rows.map((r: any) => r.contractOwnerId));
    return rows.map((r: any) => ({
      ...r,
      ownerName: r.contractOwnerId ? users.get(Number(r.contractOwnerId))?.name ?? null : null,
    }));
  }

  // ───────────────────────────── 12 Analytical Reports (PRD 10.2) ─────────────────────────────

  async report(reportType: string, query: ContractReportQuery, user?: RequestUser | null) {
    const where: any = {};
    if (query.typeId) where.typeId = Number(query.typeId);
    if (query.department) where.department = String(query.department);
    if (query.ownerId) where.contractOwnerId = Number(query.ownerId);
    if (query.approvalStatus) where.approvalStatus = String(query.approvalStatus).toUpperCase();
    if (query.counterpartyName) {
      where.counterpartyName = { contains: String(query.counterpartyName).trim() };
    }
    if (query.dateFrom || query.dateTo) {
      where.effectiveDate = {};
      if (query.dateFrom) where.effectiveDate.gte = dateOnly(query.dateFrom);
      if (query.dateTo) where.effectiveDate.lte = dateOnly(query.dateTo);
    }

    const raw = await this.db().ctrContract.findMany({
      where,
      include: {
        type: true,
        documents: { include: { versions: { orderBy: { versionNumber: "desc" } } } },
        services: true,
        slas: true,
        financial: true,
        paymentSchedules: { orderBy: { scheduleNumber: "asc" } },
        renewals: { orderBy: { renewalNumber: "desc" } },
        approvals: { orderBy: { id: "desc" } },
        amendments: { orderBy: { amendmentDate: "desc" } },
        termination: true,
      },
      orderBy: { id: "desc" },
    });

    let contracts = await this.enrichContracts(raw, user);
    if (query.status) {
      const st = String(query.status).toUpperCase();
      contracts = contracts.filter((c) => c.status === st);
    }

    const key = String(reportType || "register").toLowerCase();

    // 1. Contract Register
    if (key === "register") {
      const rows = contracts.map((c) => ({
        contractNumber: c.contractNumber,
        officialNumber: c.officialNumber || "-",
        title: c.title,
        category: c.typeName,
        counterpartyType: c.counterpartyType,
        counterpartyName: c.counterpartyName,
        department: c.department,
        ownerName: c.ownerUser?.name || "-",
        effectiveDate: formatIsoDate(c.effectiveDate),
        expirationDate: formatIsoDate(c.expirationDate),
        currency: c.currency,
        contractValue: asNumber(c.contractValue),
        status: c.status,
        approvalStatus: c.approvalStatus,
      }));
      return {
        reportType: key,
        title: "1. Contract Register",
        totalRows: rows.length,
        totalValue: round2(rows.reduce((s, r) => s + r.contractValue, 0)),
        rows,
      };
    }

    // 2. Active Contract Report
    if (key === "active") {
      const filtered = contracts.filter((c) => ACTIVE_CONTRACT_STATUSES.includes(c.status));
      const rows = filtered.map((c) => ({
        contractNumber: c.contractNumber,
        title: c.title,
        category: c.typeName,
        counterpartyName: c.counterpartyName,
        department: c.department,
        ownerName: c.ownerUser?.name || "-",
        effectiveDate: formatIsoDate(c.effectiveDate),
        expirationDate: formatIsoDate(c.expirationDate),
        daysRemaining: c.daysToExpiration,
        contractValue: asNumber(c.contractValue),
        status: c.status,
      }));
      return {
        reportType: key,
        title: "2. Active Contract Report",
        totalRows: rows.length,
        totalValue: round2(rows.reduce((s, r) => s + r.contractValue, 0)),
        rows,
      };
    }

    // 3. Expired Contract Report
    if (key === "expired") {
      const filtered = contracts.filter((c) => c.status === "EXPIRED" || (c.daysToExpiration !== null && c.daysToExpiration < 0));
      const rows = filtered.map((c) => ({
        contractNumber: c.contractNumber,
        title: c.title,
        category: c.typeName,
        counterpartyName: c.counterpartyName,
        department: c.department,
        ownerName: c.ownerUser?.name || "-",
        expirationDate: formatIsoDate(c.expirationDate),
        daysOverdue: Math.abs(c.daysToExpiration ?? 0),
        contractValue: asNumber(c.contractValue),
        status: c.status,
      }));
      return {
        reportType: key,
        title: "3. Expired Contract Report",
        totalRows: rows.length,
        totalValue: round2(rows.reduce((s, r) => s + r.contractValue, 0)),
        rows,
      };
    }

    // 4. Upcoming Expiration Report
    if (key === "upcoming-expiration") {
      const filtered = contracts
        .filter(
          (c) =>
            c.status !== "TERMINATED" &&
            c.daysToExpiration !== null &&
            c.daysToExpiration >= 0 &&
            c.daysToExpiration <= 90,
        )
        .sort((a, b) => (a.daysToExpiration ?? 999) - (b.daysToExpiration ?? 999));
      const rows = filtered.map((c) => ({
        contractNumber: c.contractNumber,
        title: c.title,
        category: c.typeName,
        counterpartyName: c.counterpartyName,
        department: c.department,
        ownerName: c.ownerUser?.name || "-",
        renewalDate: formatIsoDate(c.renewalDate),
        expirationDate: formatIsoDate(c.expirationDate),
        daysLeft: c.daysToExpiration,
        isAutoRenewal: c.isAutoRenewal ? "Ya" : "Tidak",
        contractValue: asNumber(c.contractValue),
      }));
      return {
        reportType: key,
        title: "4. Upcoming Expiration Report",
        totalRows: rows.length,
        totalValue: round2(rows.reduce((s, r) => s + r.contractValue, 0)),
        rows,
      };
    }

    // 5. Renewal Approval Report
    if (key === "renewal-approval") {
      const rows = contracts.flatMap((c) =>
        (c.renewals ?? []).map((r: any) => ({
          renewalCode: r.renewalCode,
          contractNumber: c.contractNumber,
          title: c.title,
          counterpartyName: c.counterpartyName,
          submissionDate: formatIsoDate(r.submissionDate),
          proposedPeriod: `${formatIsoDate(r.proposedEffectiveDate)} s/d ${formatIsoDate(r.proposedExpirationDate)}`,
          previousValue: asNumber(r.previousValue),
          proposedValue: asNumber(r.proposedValue),
          status: r.status,
          submittedBy: r.submittedByUser?.name || "-",
          reviewedBy: r.reviewedByUser?.name || "-",
          reason: r.reason,
        })),
      );
      return {
        reportType: key,
        title: "5. Renewal Approval Report",
        totalRows: rows.length,
        totalValue: round2(rows.reduce((s, r) => s + r.proposedValue, 0)),
        rows,
      };
    }

    // 6. Contract Value Report
    if (key === "contract-value") {
      const rows = contracts.map((c) => ({
        contractNumber: c.contractNumber,
        title: c.title,
        category: c.typeName,
        counterpartyName: c.counterpartyName,
        valueType: c.financial?.valueType || "FIXED",
        paymentFrequency: c.paymentFrequency,
        currency: c.currency,
        baseAmount: asNumber(c.financial?.baseAmount ?? c.contractValue),
        taxAmount: asNumber(c.financial?.taxAmount ?? 0),
        totalAmount: asNumber(c.financial?.totalAmount ?? c.contractValue),
        downPayment: asNumber(c.financial?.downPaymentAmount ?? 0),
        retention: asNumber(c.financial?.retentionAmount ?? 0),
        costCenter: c.financial?.costCenter || c.department,
      }));
      return {
        reportType: key,
        title: "6. Contract Value Report",
        totalRows: rows.length,
        totalValue: round2(rows.reduce((s, r) => s + r.totalAmount, 0)),
        rows,
      };
    }

    // 7. Vendor Contract Report
    if (key === "vendor") {
      const filtered = contracts.filter((c) => c.counterpartyType === "VENDOR" || c.typeCode === "VENDOR");
      const rows = filtered.map((c) => ({
        contractNumber: c.contractNumber,
        officialNumber: c.officialNumber || "-",
        vendorName: c.counterpartyName,
        title: c.title,
        category: c.typeName,
        department: c.department,
        effectiveDate: formatIsoDate(c.effectiveDate),
        expirationDate: formatIsoDate(c.expirationDate),
        paymentTerms: c.paymentTerms || "-",
        contractValue: asNumber(c.contractValue),
        status: c.status,
      }));
      return {
        reportType: key,
        title: "7. Vendor Contract Report",
        totalRows: rows.length,
        totalValue: round2(rows.reduce((s, r) => s + r.contractValue, 0)),
        rows,
      };
    }

    // 8. Service Agreement Report
    if (key === "service-agreement") {
      const filtered = contracts.filter(
        (c) =>
          ["SERVICE", "MAINTENANCE", "CLOUD_HOSTING", "SOFTWARE_LICENSE"].includes(c.typeCode) ||
          (c.services ?? []).length > 0 ||
          (c.slas ?? []).length > 0,
      );
      const rows = filtered.map((c) => ({
        contractNumber: c.contractNumber,
        title: c.title,
        providerName: c.counterpartyName,
        category: c.typeName,
        servicesCount: (c.services ?? []).length,
        serviceNames: (c.services ?? []).map((s: any) => s.serviceName).join(", ") || c.title,
        slaIndicators: (c.slas ?? []).map((s: any) => `${s.indicatorName}: ${s.targetMetric}`).join("; ") || "Standar",
        effectiveDate: formatIsoDate(c.effectiveDate),
        expirationDate: formatIsoDate(c.expirationDate),
        contractValue: asNumber(c.contractValue),
        status: c.status,
      }));
      return {
        reportType: key,
        title: "8. Service Agreement & SLA Report",
        totalRows: rows.length,
        totalValue: round2(rows.reduce((s, r) => s + r.contractValue, 0)),
        rows,
      };
    }

    // 9. Contract Document Register
    if (key === "documents") {
      const rows = contracts.flatMap((c) =>
        (c.documents ?? []).map((d: any) => {
          const latest = d.versions?.[0];
          return {
            contractNumber: c.contractNumber,
            contractTitle: c.title,
            counterpartyName: c.counterpartyName,
            documentTitle: d.documentTitle,
            documentCategory: d.documentCategory,
            documentNumber: d.documentNumber || "-",
            currentVersion: `v${d.currentVersionNumber}`,
            isConfidential: d.isConfidential ? "Confidential" : "Internal",
            isLocked: latest?.isLockedForApproval ? "Terkunci (Approved)" : "Draft",
            signedDate: formatIsoDate(d.signedDate) || "-",
            uploadedBy: latest?.uploadedByUser?.name || "-",
          };
        }),
      );
      return {
        reportType: key,
        title: "9. Contract Document Register",
        totalRows: rows.length,
        totalValue: 0,
        rows,
      };
    }

    // 10. Contract Amendment History
    if (key === "amendments") {
      const rows = contracts.flatMap((c) =>
        (c.amendments ?? []).map((a: any) => ({
          amendmentNumber: a.amendmentNumber,
          amendmentDate: formatIsoDate(a.amendmentDate),
          contractNumber: c.contractNumber,
          contractTitle: c.title,
          counterpartyName: c.counterpartyName,
          amendmentTitle: a.title,
          description: a.description,
          valueAdjustment: asNumber(a.valueAdjustment),
          newExpirationDate: formatIsoDate(a.newExpirationDate) || "-",
          approvedBy: a.approvedByUser?.name || "-",
        })),
      );
      return {
        reportType: key,
        title: "10. Contract Amendment History",
        totalRows: rows.length,
        totalValue: round2(rows.reduce((s, r) => s + r.valueAdjustment, 0)),
        rows,
      };
    }

    // 11. Contract Payment Commitment Report
    if (key === "payment-commitments") {
      const rows = contracts.flatMap((c) =>
        (c.paymentSchedules ?? []).map((ps: any) => ({
          contractNumber: c.contractNumber,
          contractTitle: c.title,
          counterpartyName: c.counterpartyName,
          department: c.department,
          scheduleNumber: ps.scheduleNumber,
          milestoneName: ps.milestoneName,
          dueDate: formatIsoDate(ps.dueDate),
          amount: asNumber(ps.amount),
          taxAmount: asNumber(ps.taxAmount),
          totalAmount: asNumber(ps.totalAmount),
          paymentStatus: ps.paymentStatus,
          invoiceReference: ps.invoiceReference || "-",
          paidDate: formatIsoDate(ps.paidDate) || "-",
        })),
      );
      return {
        reportType: key,
        title: "11. Contract Payment Commitment Report",
        totalRows: rows.length,
        totalValue: round2(rows.reduce((s, r) => s + r.totalAmount, 0)),
        rows,
      };
    }

    // 12. Contract by Department Report
    const deptGroup: Record<
      string,
      {
        department: string;
        totalContracts: number;
        activeContracts: number;
        expiringSoon: number;
        expired: number;
        totalValue: number;
      }
    > = {};

    for (const c of contracts) {
      const dept = c.department || "Umum";
      if (!deptGroup[dept]) {
        deptGroup[dept] = {
          department: dept,
          totalContracts: 0,
          activeContracts: 0,
          expiringSoon: 0,
          expired: 0,
          totalValue: 0,
        };
      }
      const g = deptGroup[dept]!;
      g.totalContracts += 1;
      if (ACTIVE_CONTRACT_STATUSES.includes(c.status)) g.activeContracts += 1;
      if (c.status === "EXPIRING_SOON") g.expiringSoon += 1;
      if (c.status === "EXPIRED") g.expired += 1;
      g.totalValue = round2(g.totalValue + asNumber(c.contractValue));
    }

    const rows = Object.values(deptGroup).sort((a, b) => b.totalValue - a.totalValue);
    return {
      reportType: "by-department",
      title: "12. Contract by Department Report",
      totalRows: rows.length,
      totalValue: round2(rows.reduce((s, r) => s + r.totalValue, 0)),
      rows,
    };
  }
}
