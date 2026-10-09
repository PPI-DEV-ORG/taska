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
      return [{ roles: ["FINANCE"], mode: "all" }, { roles: ["BOS"], mode: "all" }];
    case "PERMINTAAN_SURVEY":
      return [{ roles: ["PM", "BOS"], mode: "any" }];
    case "SURAT_JALAN":
      return [{ roles: ["FINANCE", "BOS"], mode: "any" }];
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

  private async needsBos(kind: ApprovalKind, amount: number): Promise<boolean> {
    if (kind === "OPNAME") return true;
    if (!THRESHOLD_KINDS.includes(kind)) return false;
    return amount >= (await this.settings.threshold());
  }

  private async evaluate(a: ApprovalWithSteps): Promise<ApprovalStatus> {
    if (a.steps.some((s) => s.status === "DITOLAK")) return "DITOLAK";
    const groups = plan(a.kind, await this.needsBos(a.kind, Number(a.amount)));
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

  async getFor(kind: ApprovalKind, entityId: number) {
    const approval = await this.prisma.main.approval.findUnique({
      where: { kind_entityId: { kind, entityId } },
      include: { steps: { orderBy: { id: "asc" } } },
    });
    if (!approval) return null;
    return { ...approval, status: await this.evaluate(approval) };
  }

  async list(opts: { page: number; limit: number; status?: string; kind?: string; q?: string }) {
    const where = {
      ...(opts.status ? { status: opts.status as ApprovalStatus } : {}),
      ...(opts.kind ? { kind: opts.kind as ApprovalKind } : {}),
      ...(opts.q ? { title: { contains: opts.q } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.main.approval.findMany({
        where,
        include: { steps: true },
        orderBy: { createdAt: "desc" },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      this.prisma.main.approval.count({ where }),
    ]);
    const items = await Promise.all(
      rows.map(async (r) => ({ ...r, status: await this.evaluate(r) })),
    );
    return { items, total, page: opts.page, limit: opts.limit };
  }

  /** Antrean yang menunggu peran user (dashboard). */
  async pendingFor(user: RequestUser) {
    const rows = await this.prisma.main.approval.findMany({
      where: { status: "MENUNGGU" },
      include: { steps: true },
      orderBy: { createdAt: "asc" },
      take: 300,
    });

    const items: unknown[] = [];
    for (const r of rows) {
      if (r.requestedById === user.id) continue;
      const status = await this.evaluate(r);
      if (status !== "MENUNGGU") continue;
      const pendingSteps = r.steps.filter((s) => s.status === "MENUNGGU");
      const relevant =
        user.role === "ADMIN"
          ? pendingSteps
          : pendingSteps.filter((s) => s.approverRole === (user.role as Role));
      if (!relevant.length) continue;
      items.push({ ...r, status, pendingRoles: relevant.map((s) => s.approverRole) });
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
    if (approval.requestedById === user.id) {
      throw new ForbiddenException("Pembuat dokumen tidak boleh menyetujui dokumennya sendiri");
    }

    const pending = approval.steps.filter((s) => s.status === "MENUNGGU");
    let step =
      pending.find((s) => s.approverRole === (user.role as Role)) ??
      (user.role === "ADMIN" ? pending[0] : undefined);
    if (!step) throw new ForbiddenException(`Peran ${user.role} bukan penyetuju dokumen ini`);

    await this.prisma.main.approvalStep.update({
      where: { id: step.id },
      data: {
        status: approve ? "DISETUJUI" : "DITOLAK",
        decidedById: user.id,
        decidedAt: new Date(),
        reason: reason ?? null,
      },
    });

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
    return { id: approvalId, status };
  }
}
