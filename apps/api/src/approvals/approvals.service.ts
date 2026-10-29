import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { SettingsService } from "../settings/settings.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { AuditService } from "../audit/audit.service.js";
import type { Approval, ApprovalKind, ApprovalStatus, ApprovalStep, Role } from "../generated/prisma/client.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";

type Group = { roles: Role[]; mode: "any" | "all" };

type ApprovalWithSteps = Approval & { steps: ApprovalStep[] };

/** Kelompok persetujuan per dokumen (PRD: tabel persetujuan per dokumen). */
function plan(kind: ApprovalKind, needsBos: boolean): Group[] {
  switch (kind) {
    case "PENERIMAAN":
      return [{ roles: ["GUDANG"], mode: "all" }, { roles: ["PROCUREMENT"], mode: "all" }];
    case "OPNAME":
      return [{ roles: ["PROCUREMENT"], mode: "all" }];
    case "PERMINTAAN_SURVEY":
      return [{ roles: ["PM", "BOS", "FINANCE"], mode: "any" }];
    case "SURAT_JALAN":
      return [{ roles: ["FINANCE", "BOS"], mode: "any" }];
    case "PURCHASE_REQUEST":
      return needsBos
        ? [{ roles: ["GUDANG", "PROCUREMENT", "FINANCE", "BOS"], mode: "any" }, { roles: ["BOS"], mode: "all" }]
        : [{ roles: ["GUDANG", "PROCUREMENT", "FINANCE", "BOS"], mode: "any" }];
    default:
      return needsBos
        ? [{ roles: ["FINANCE", "BOS"], mode: "any" }, { roles: ["BOS"], mode: "all" }]
        : [{ roles: ["FINANCE", "BOS"], mode: "any" }];
  }
}

/** Dokumen yang wajib juga disetujui Bos bila di atas ambang (PRD #5). */
const THRESHOLD_KINDS: ApprovalKind[] = [
  "PENAWARAN",
  "PURCHASE_REQUEST",
  "SUPPLIER_PO",
  "INVOICE_IN",
  "PENGELUARAN",
];

@Injectable()
export class ApprovalsService {
  private readonly listeners: Array<{
    kind: ApprovalKind;
    handler: (entityId: number, status: ApprovalStatus) => Promise<void> | void;
  }> = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  /** Daftarkan listener saat keputusan persetujuan berubah (dipakai modul fitur). */
  onChange(
    kind: ApprovalKind,
    handler: (entityId: number, status: ApprovalStatus) => Promise<void> | void,
  ): void {
    if (!this.listeners.some((l) => l.kind === kind && l.handler === handler)) {
      this.listeners.push({ kind, handler });
    }
  }

  private async fire(kind: ApprovalKind, entityId: number, status: ApprovalStatus): Promise<void> {
    for (const l of this.listeners) {
      if (l.kind !== kind) continue;
      try {
        await l.handler(entityId, status);
      } catch (e) {
        // listener tidak boleh menjatuhkan keputusan
        console.error(`listener approval ${kind} gagal:`, (e as Error).message);
      }
    }
  }

  private async needsBos(kind: ApprovalKind, amount: number, threshold?: number): Promise<boolean> {
    if (!THRESHOLD_KINDS.includes(kind)) return false;
    const thr = threshold !== undefined ? threshold : await this.settings.threshold();
    return amount >= thr;
  }

  private async evaluate(a: ApprovalWithSteps, threshold?: number): Promise<ApprovalStatus> {
    if (a.steps.some((s) => s.status === "DITOLAK")) return "DITOLAK";
    const groups = plan(a.kind, await this.needsBos(a.kind, Number(a.amount), threshold));
    for (const g of groups) {
      const steps = g.roles.map((r) => a.steps.find((s) => s.approverRole === r));
      if (g.mode === "any") {
        if (!steps.some((s) => s?.status === "DISETUJUI")) return "MENUNGGU";
      } else {
        if (!steps.every((s) => s?.status === "DISETUJUI")) return "MENUNGGU";
      }
    }
    return "DISETUJUI";
  }

  /** Buat atau perbarui pengajuan persetujuan sebuah dokumen. */
  async request(input: {
    kind: ApprovalKind;
    entityId: number;
    title: string;
    amount: number;
    requestedBy: RequestUser;
    href: string;
    /** Langkah peran yang dikonfirmasi pembuat (mis. penerimaan barang oleh Gudang). */
    confirmRoles?: Role[];
  }) {
    const roles = [
      ...new Set(plan(input.kind, await this.needsBos(input.kind, input.amount)).flatMap((g) => g.roles)),
    ];
    const confirm = new Set(input.confirmRoles ?? []);
    const stepData = roles.map((r) => ({
      approverRole: r,
      ...(confirm.has(r)
        ? { status: "DISETUJUI" as const, decidedById: input.requestedBy.id, decidedAt: new Date() }
        : {}),
    }));

    const approval = await this.prisma.main.approval.upsert({
      where: { kind_entityId: { kind: input.kind, entityId: input.entityId } },
      update: {
        title: input.title,
        amount: input.amount,
        status: "MENUNGGU",
        reason: null,
        requestedById: input.requestedBy.id,
        steps: { deleteMany: {}, create: stepData },
      },
      create: {
        kind: input.kind,
        entityId: input.entityId,
        title: input.title,
        amount: input.amount,
        requestedById: input.requestedBy.id,
        steps: { create: stepData },
      },
      include: { steps: true },
    });

    await this.notifications.notify({
      roles: roles.filter((r) => !confirm.has(r)),
      kind: "APPROVAL",
      text: `Menunggu persetujuan: ${input.title}`,
      href: input.href,
    });
    await this.audit.log({
      actor: input.requestedBy,
      action: "AJUKAN_PERSETUJUAN",
      entityType: "approval",
      entityId: approval.id,
      detail: `${input.kind} #${input.entityId} — ${input.title} Rp${input.amount}`,
    });

    const evaluated = await this.evaluate(approval);
    if (evaluated !== "MENUNGGU") {
      await this.prisma.main.approval.update({ where: { id: approval.id }, data: { status: evaluated } });
      await this.fire(input.kind, input.entityId, evaluated);
    }
    return approval;
  }

  private async resolveRequester(kind: ApprovalKind, entityId: number): Promise<{ id: number; name: string } | null> {
    try {
      if (kind === "PENGELUARAN") {
        const exp = await this.prisma.main.expense.findUnique({
          where: { id: entityId },
          include: { reporter: { select: { id: true, name: true } } },
        });
        if (exp?.reporter?.name) return exp.reporter;
      } else if (kind === "SUPPLIER_PO") {
        const po = await this.prisma.main.supplierPO.findUnique({
          where: { id: entityId },
          include: { creator: { select: { id: true, name: true } } },
        });
        if (po?.creator?.name) return po.creator;
      } else if (kind === "PURCHASE_REQUEST") {
        const pr = await this.prisma.main.purchaseRequest.findUnique({
          where: { id: entityId },
          include: { requester: { select: { id: true, name: true } } },
        });
        if (pr?.requester?.name) return pr.requester;
      } else if (kind === "PERMINTAAN_SURVEY") {
        const sv = await this.prisma.main.survey.findUnique({
          where: { id: entityId },
          include: { requester: { select: { id: true, name: true } } },
        });
        if (sv?.requester?.name) return sv.requester;
      } else if (kind === "PENAWARAN") {
        const q = await this.prisma.main.quotation.findUnique({
          where: { id: entityId },
          include: { owner: { select: { id: true, name: true } } },
        });
        if (q?.owner?.name) return q.owner;
      } else if (kind === "OPNAME") {
        const op = await this.prisma.main.stockOpname.findUnique({
          where: { id: entityId },
          include: { conductor: { select: { id: true, name: true } } },
        });
        if (op?.conductor?.name) return op.conductor;
      } else if (kind === "SURAT_JALAN") {
        const dn = await this.prisma.main.deliveryNote.findUnique({
          where: { id: entityId },
          include: { creator: { select: { id: true, name: true } } },
        });
        if (dn?.creator?.name) return dn.creator;
      } else if (kind === "PENERIMAAN") {
        const rc = await this.prisma.main.receiving.findUnique({
          where: { id: entityId },
          include: { receiver: { select: { id: true, name: true } } },
        });
        if (rc?.receiver?.name) return rc.receiver;
      }
    } catch {}
    return null;
  }

  async getFor(kind: ApprovalKind, entityId: number) {
    const approval = await this.prisma.main.approval.findUnique({
      where: { kind_entityId: { kind, entityId } },
      include: { steps: { orderBy: { id: "asc" } }, requested_by: { select: { id: true, name: true } } },
    });
    if (!approval) return null;
    let requester = (approval as any).requested_by;
    if (!requester || !requester.name) {
      requester = await this.resolveRequester(kind, entityId);
    }
    return {
      ...approval,
      requestedBy: requester,
      requested_by: requester,
      status: await this.evaluate(approval),
    };
  }

  private canRoleApprove(user: RequestUser | undefined, r: ApprovalWithSteps, evaluatedStatus: ApprovalStatus): boolean {
    if (!user) return true;
    if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") return true;
    if (r.requestedById === user.id) return false;

    if (r.kind === "OPNAME") {
      return user.role === "PROCUREMENT";
    }
    if (r.kind === "PENERIMAAN") {
      return user.role === "GUDANG" || user.role === "PROCUREMENT";
    }

    const pendingSteps = r.steps.filter((s) => s.status === "MENUNGGU");
    if (evaluatedStatus === "MENUNGGU") {
      return pendingSteps.some(
        (s) =>
          s.approverRole === (user.role as Role) ||
          (r.kind === "PERMINTAAN_SURVEY" &&
            (user.role === "FINANCE" || user.role === "BOS" || user.role === "PM")) ||
          (r.kind === "PURCHASE_REQUEST" &&
            (user.role === "GUDANG" || user.role === "PROCUREMENT" || user.role === "FINANCE" || user.role === "BOS")),
      );
    }

    return (
      r.steps.some((s) => s.approverRole === (user.role as Role)) ||
      (r.kind === "PERMINTAAN_SURVEY" &&
        (user.role === "FINANCE" || user.role === "BOS" || user.role === "PM")) ||
      (r.kind === "PURCHASE_REQUEST" &&
        (user.role === "GUDANG" || user.role === "PROCUREMENT" || user.role === "FINANCE" || user.role === "BOS"))
    );
  }

  async list(opts: { page: number; limit: number; status?: string; kind?: string; q?: string; user?: RequestUser }) {
    const where = {
      ...(opts.status ? { status: opts.status as ApprovalStatus } : {}),
      ...(opts.kind ? { kind: opts.kind as ApprovalKind } : {}),
      ...(opts.q ? { title: { contains: opts.q } } : {}),
    };
    const [rows, threshold] = await Promise.all([
      this.prisma.main.approval.findMany({
        where,
        include: { steps: true, requested_by: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      this.settings.threshold(),
    ]);
    const mapped = await Promise.all(
      rows.map(async (r) => {
        let requester = (r as any).requested_by;
        if (!requester || !requester.name) {
          requester = await this.resolveRequester(r.kind, r.entityId);
        }
        const status = await this.evaluate(r, threshold);
        const canApprove = this.canRoleApprove(opts.user, r, status);
        return {
          ...r,
          requestedBy: requester,
          requested_by: requester,
          status,
          canApprove,
        };
      }),
    );
    const shouldFilterByRole =
      opts.user &&
      opts.user.role !== "SUPER_ADMIN" &&
      opts.user.role !== "ADMIN" &&
      opts.user.role !== "BOS";
    const items = shouldFilterByRole ? mapped.filter((item) => item.canApprove) : mapped;
    return { items, total: items.length, page: opts.page, limit: opts.limit };
  }

  /** Antrean yang menunggu peran user (dashboard). */
  async pendingFor(user: RequestUser) {
    if (user.role === "TEKNISI" || user.role === "SE" || user.role === "SALES") {
      return { items: [], total: 0 };
    }

    const [rows, threshold] = await Promise.all([
      this.prisma.main.approval.findMany({
        where: { status: "MENUNGGU" },
        include: { steps: true, requested_by: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
        take: 300,
      }),
      this.settings.threshold(),
    ]);

    const items: unknown[] = [];
    for (const r of rows) {
      if (user.role !== "SUPER_ADMIN" && r.requestedById === user.id) continue;
      const status = await this.evaluate(r, threshold);
      if (status !== "MENUNGGU") continue;
      if (!this.canRoleApprove(user, r, status)) continue;
      const pendingSteps = r.steps.filter((s) => s.status === "MENUNGGU");
      const relevant =
        user.role === "SUPER_ADMIN" || user.role === "ADMIN"
          ? pendingSteps
          : pendingSteps.filter(
              (s) =>
                s.approverRole === (user.role as Role) ||
                (r.kind === "OPNAME" && user.role === "PROCUREMENT") ||
                (r.kind === "PERMINTAAN_SURVEY" &&
                  (user.role === "FINANCE" || user.role === "BOS" || user.role === "PM")) ||
                (r.kind === "PURCHASE_REQUEST" &&
                  (user.role === "GUDANG" || user.role === "PROCUREMENT" || user.role === "FINANCE" || user.role === "BOS")),
            );
      if (!relevant.length) continue;
      let requester = (r as any).requested_by;
      if (!requester || !requester.name) {
        requester = await this.resolveRequester(r.kind, r.entityId);
        if (requester?.id && requester.id !== r.requestedById) {
          this.prisma.main.approval.update({
            where: { id: r.id },
            data: { requestedById: requester.id },
          }).catch(() => {});
        }
      }
      items.push({
        ...r,
        requestedBy: requester,
        requested_by: requester,
        status,
        canApprove: true,
        pendingRoles: relevant.map((s) => s.approverRole),
      });
    }
    return { items, total: items.length };
  }

  async decide(approvalId: number, user: RequestUser, approve: boolean, reason?: string) {
    const approval = await this.prisma.main.approval.findUnique({
      where: { id: approvalId },
      include: { steps: true },
    });
    if (!approval) throw new NotFoundException("Dokumen tidak ditemukan");

    if (approval.status !== "MENUNGGU") throw new ConflictException("Dokumen sudah diputuskan");
    if (user.role !== "SUPER_ADMIN" && approval.requestedById === user.id) {
      throw new ForbiddenException("Pembuat dokumen tidak boleh menyetujui dokumennya sendiri");
    }
    if (
      approval.kind === "OPNAME" &&
      user.role !== "PROCUREMENT" &&
      user.role !== "SUPER_ADMIN" &&
      user.role !== "ADMIN"
    ) {
      throw new ForbiddenException("Opname hanya dapat disetujui oleh Procurement");
    }

    const pending = approval.steps.filter((s) => s.status === "MENUNGGU");
    let step =
      pending.find((s) => s.approverRole === (user.role as Role)) ??
      (user.role === "SUPER_ADMIN" || user.role === "ADMIN" ? pending[0] : undefined);
    if (!step && approval.kind === "OPNAME" && user.role === "PROCUREMENT") {
      step = pending[0];
    }
    if (
      !step &&
      approval.kind === "PERMINTAAN_SURVEY" &&
      (user.role === "FINANCE" || user.role === "BOS" || user.role === "PM")
    ) {
      step = pending[0];
    }
    if (
      !step &&
      approval.kind === "PURCHASE_REQUEST" &&
      (user.role === "GUDANG" || user.role === "PROCUREMENT" || user.role === "FINANCE" || user.role === "BOS")
    ) {
      step = pending[0];
    }
    if (!step) throw new ForbiddenException(`Peran ${user.role} bukan penyetuju dokumen ini`);

    if (approval.kind === "OPNAME") {
      await this.prisma.main.approvalStep.updateMany({
        where: { approvalId, status: "MENUNGGU" },
        data: {
          approverRole: "PROCUREMENT",
          status: approve ? "DISETUJUI" : "DITOLAK",
          decidedById: user.id,
          decidedAt: new Date(),
          reason: reason ?? null,
        },
      });
    } else {
      await this.prisma.main.approvalStep.update({
        where: { id: step.id },
        data: {
          status: approve ? "DISETUJUI" : "DITOLAK",
          decidedById: user.id,
          decidedAt: new Date(),
          reason: reason ?? null,
        },
      });
    }

    const updated = (await this.prisma.main.approval.findUnique({
      where: { id: approvalId },
      include: { steps: true },
    })) as ApprovalWithSteps;
    const status = await this.evaluate(updated);

    await this.prisma.main.approval.update({
      where: { id: approvalId },
      data: { status, reason: approve ? null : (reason ?? null) },
    });

    await this.audit.log({
      actor: user,
      action: approve ? "SETUJUI" : "TOLAK",
      entityType: "approval",
      entityId: approvalId,
      detail: `${approval.kind} #${approval.entityId} ${approval.title}${reason ? ` — ${reason}` : ""}`,
    });

    const entityModuleMap: Record<string, string> = {
      PENAWARAN: "quotations",
      PENGELUARAN: "expenses",
      SUPPLIER_PO: "supplier-pos",
      PURCHASE_REQUEST: "purchase-requests",
      PERMINTAAN_SURVEY: "surveys",
      OPNAME: "opname",
      SURAT_JALAN: "delivery-notes",
      PENERIMAAN: "receiving",
    };
    const targetModule = entityModuleMap[approval.kind];
    if (targetModule) {
      await this.audit.log({
        actor: user,
        action: approve ? "DISETUJUI" : "DITOLAK",
        entityType: targetModule,
        entityId: approval.entityId,
        detail: `Persetujuan ${approve ? "disetujui" : "ditolak"} oleh ${user.name}${reason ? ` (${reason})` : ""}`,
      });
    }

    await this.notifications.notify({
      userIds: [approval.requestedById],
      kind: "APPROVAL",
      text: `${approval.title}: ${approve ? "disetujui" : "ditolak"} oleh ${user.name}${reason ? ` (${reason})` : ""}`,
      href: "/approvals",
    });

    if (status === "MENUNGGU") {
      const pendingRoles = [
        ...new Set(updated.steps.filter((s) => s.status === "MENUNGGU").map((s) => s.approverRole)),
      ];
      if (pendingRoles.length) {
        await this.notifications.notify({
          roles: pendingRoles,
          kind: "APPROVAL",
          text: `Menunggu persetujuan lanjutan: ${approval.title}`,
          href: "/approvals",
        });
      }
    }

    await this.fire(approval.kind, approval.entityId, status);
    this.notifications.dataChange("approvals", "status", approvalId);
    return { id: approvalId, status };
  }
}
