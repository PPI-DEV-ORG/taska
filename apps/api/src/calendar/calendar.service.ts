import { ForbiddenException, Injectable, NotFoundException, BadRequestException, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { CalendarEventDto, CalendarQuery, CalendarStatusDto } from "./dto.js";

export type CalendarItem = {
  key: string;
  sourceModule: string;
  sourceId: number;
  title: string;
  subtitle?: string | null;
  category: string;
  start: string;
  end: string | null;
  isAllDay: boolean;
  status: string;
  priority: string;
  picId: number | null;
  picName: string | null;
  routePath: string | null;
  isOverdue: boolean;
  editable: boolean;
  recurrence?: string;
};

const pad = (n: number, w: number) => String(n).padStart(w, "0");
const GLOBAL_ROLES = ["SUPER_ADMIN", "BOS", "ADMIN"];
const FINANCE_ROLES = ["FINANCE"];
const PROCUREMENT_ROLES = ["FINANCE", "PROCUREMENT"];

function normStatus(raw: unknown): string {
  const s = String(raw ?? "").toLowerCase();
  if (/(selesai|complete|done|paid|lunas|closed|sampai|diterima)/.test(s)) return "COMPLETED";
  if (/(batal|cancel|tolak|reject|lost)/.test(s)) return "CANCELLED";
  if (/(progress|berjalan|jalan|dikerjakan|tested|dikirim)/.test(s)) return "IN_PROGRESS";
  if (/(pending|tunda|blocked|menunggu|partial)/.test(s)) return "PENDING";
  return "NOT_STARTED";
}

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

const PRIORITY_MAP: Record<string, string> = {
  RENDAH: "LOW", SEDANG: "MEDIUM", TINGGI: "HIGH", URGENT: "URGENT",
};

@Injectable()
export class CalendarService implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private get db(): any {
    return this.prisma.main;
  }

  private roleOf(user: RequestUser) {
    return (user.role || "").toUpperCase();
  }

  private isGlobal(user: RequestUser) {
    return GLOBAL_ROLES.includes(this.roleOf(user));
  }

  private async nextNumber(): Promise<string> {
    const now = new Date();
    const prefix = `EVT-${now.getFullYear()}${pad(now.getMonth() + 1, 2)}-`;
    const count = await this.db.calendarEvent.count({ where: { number: { startsWith: prefix } } });
    return `${prefix}${pad(count + 1, 4)}`;
  }

  // ───────────────────────────── Aggregator ─────────────────────────────

  async list(q: CalendarQuery, user: RequestUser) {
    const role = this.roleOf(user);
    const isGlobal = this.isGlobal(user);
    // Non BOS/SUPER_ADMIN/ADMIN selalu dipaksa ke agenda sendiri.
    const all = isGlobal && q.scope === "all";
    const me = Number(user.id);

    const now = new Date();
    const from = q.from ? new Date(q.from) : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = q.to ? new Date(q.to) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const overdueOf = (ref: Date | null, status: string, allDay: boolean) => {
      if (!ref || status === "COMPLETED" || status === "CANCELLED") return false;
      return allDay ? ref.getTime() < todayStart : ref.getTime() < now.getTime();
    };

    const items: CalendarItem[] = [];

    const [manual, visits, pocs, surveys, projects, tasks] = await Promise.all([
      this.db.calendarEvent.findMany({
        where: {
          AND: [
            ...(all
              ? []
              : [
                  {
                    OR: [
                      { creatorId: me },
                      { assigneeId: me },
                      { attendees: { some: { userId: me } } },
                    ],
                  },
                ]),
            { startDate: { lte: to } },
            {
              OR: [
                { recurrence: { not: "NONE" } },
                { endDate: { gte: from } },
                { endDate: null, startDate: { gte: from } },
              ],
            },
          ],
        },
        include: { assignee: { select: { id: true, name: true } }, creator: { select: { id: true, name: true } } },
      }),
      this.db.visitReport.findMany({
        where: {
          AND: [
            ...(all
              ? []
              : [
                  {
                    OR: [
                      { ownerId: me },
                      { createdById: me },
                      { members: { some: { userId: me } } },
                    ],
                  },
                ]),
            { date: { lte: to } },
            {
              OR: [{ endDate: { gte: from } }, { endDate: null, date: { gte: from } }],
            },
          ],
        },
        include: { owner: { select: { id: true, name: true } } },
      }),
      this.db.pocReport.findMany({
        where: {
          AND: [
            ...(all
              ? []
              : [
                  {
                    OR: [
                      { ownerId: me },
                      { createdById: me },
                      { members: { some: { userId: me } } },
                    ],
                  },
                ]),
            { date: { lte: to } },
            {
              OR: [{ endDate: { gte: from } }, { endDate: null, date: { gte: from } }],
            },
          ],
        },
        include: { owner: { select: { id: true, name: true } } },
      }),
      this.db.survey.findMany({
        where: {
          AND: [
            ...(all
              ? []
              : [
                  {
                    OR: [
                      { requestedById: me },
                      { members: { some: { userId: me } } },
                    ],
                  },
                ]),
            { scheduleAt: { gte: from, lte: to } },
          ],
        },
        include: { lead: { select: { name: true } }, requester: { select: { id: true, name: true } } },
      }),
      this.db.project.findMany({
        where: {
          AND: [
            ...(all
              ? []
              : [
                  {
                    OR: [
                      { picId: me },
                      { members: { some: { userId: me } } },
                    ],
                  },
                ]),
            {
              OR: [
                { startDate: { gte: from, lte: to } },
                { endDate: { gte: from, lte: to } },
              ],
            },
          ],
        },
        include: { pic: { select: { id: true, name: true } }, customer: { select: { name: true } } },
      }),
      this.db.task.findMany({
        where: {
          AND: [
            ...(all ? [] : [{ assigneeId: me }]),
            { dueDate: { gte: from, lte: to } },
          ],
        },
        include: {
          assignee: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
        },
      }),
    ]);

    // Manual events (+ ekspansi berulang)
    for (const e of manual) {
      const startMs = e.startDate.getTime();
      const durMs = e.endDate ? e.endDate.getTime() - startMs : 0;
      const canEdit = isGlobal || e.creatorId === me || e.assigneeId === me;
      const base = {
        sourceModule: "calendar",
        sourceId: e.id,
        title: e.title,
        subtitle: e.description ?? null,
        category: e.category,
        isAllDay: e.isAllDay,
        status: e.status,
        priority: e.priority,
        picId: e.assignee?.id ?? e.creator?.id ?? null,
        picName: e.assignee?.name ?? e.creator?.name ?? null,
        routePath: null,
        editable: canEdit,
        recurrence: e.recurrence,
      };
      const push = (s: Date) => {
        const en = e.endDate ? new Date(s.getTime() + durMs) : null;
        if (s.getTime() > to.getTime() || (en ?? s).getTime() < from.getTime()) return;
        items.push({
          ...base,
          key: `calendar-${e.id}-${s.toISOString()}`,
          start: s.toISOString(),
          end: en ? en.toISOString() : null,
          isOverdue: overdueOf(en ?? s, e.status, e.isAllDay),
        });
      };
      if (e.recurrence === "NONE") {
        push(e.startDate);
      } else {
        const until = e.recurrenceUntil ? new Date(e.recurrenceUntil) : to;
        const limit = Math.min(until.getTime(), to.getTime());
        let cur = new Date(e.startDate);
        let guard = 0;
        while (cur.getTime() <= limit && guard++ < 800) {
          push(cur);
          const next = new Date(cur);
          if (e.recurrence === "DAILY") next.setDate(next.getDate() + 1);
          else if (e.recurrence === "WEEKLY") next.setDate(next.getDate() + 7);
          else if (e.recurrence === "MONTHLY") next.setMonth(next.getMonth() + 1);
          else next.setFullYear(next.getFullYear() + 1);
          cur = next;
        }
      }
    }

    for (const v of visits) {
      const status = normStatus(v.status);
      items.push({
        key: `visit-${v.id}`, sourceModule: "visit-reports", sourceId: v.id,
        title: v.title, subtitle: [v.number, v.clientName, v.location].filter(Boolean).join(" · "),
        category: "KUNJUNGAN", start: iso(v.date)!, end: iso(v.endDate), isAllDay: true,
        status, priority: "MEDIUM", picId: v.owner?.id ?? null, picName: v.owner?.name ?? null,
        routePath: `/visit-reports/${v.id}`, isOverdue: overdueOf(v.endDate ?? v.date, status, true),
        editable: false,
      });
    }

    for (const p of pocs) {
      const status = normStatus(p.status);
      items.push({
        key: `poc-${p.id}`, sourceModule: "poc-reports", sourceId: p.id,
        title: p.title, subtitle: [p.number, p.clientName, p.location].filter(Boolean).join(" · "),
        category: "POC", start: iso(p.date)!, end: iso(p.endDate), isAllDay: true,
        status, priority: "MEDIUM", picId: p.owner?.id ?? null, picName: p.owner?.name ?? null,
        routePath: `/poc-reports/${p.id}`, isOverdue: overdueOf(p.endDate ?? p.date, status, true),
        editable: false,
      });
    }

    for (const s of surveys) {
      const status = normStatus(s.status);
      items.push({
        key: `survey-${s.id}`, sourceModule: "surveys", sourceId: s.id,
        title: `Survey: ${s.lead?.name ?? s.location}`, subtitle: s.location,
        category: "SURVEY", start: iso(s.scheduleAt)!, end: null, isAllDay: false,
        status, priority: "MEDIUM", picId: s.requester?.id ?? null, picName: s.requester?.name ?? null,
        routePath: `/surveys/${s.id}`, isOverdue: overdueOf(s.scheduleAt, status, false),
        editable: false,
      });
    }

    for (const p of projects) {
      const status = normStatus(p.status === "TERLAMBAT" ? "berjalan" : p.status);
      const common = {
        sourceModule: "projects", sourceId: p.id, category: "PROJECT",
        subtitle: p.customer?.name ?? null, status, priority: "MEDIUM" as string,
        picId: p.pic?.id ?? null, picName: p.pic?.name ?? null,
        routePath: `/projects/${p.id}`, isAllDay: true, editable: false,
      };
      if (p.startDate >= from && p.startDate <= to) {
        items.push({ ...common, key: `project-${p.id}-start`, title: `Mulai project: ${p.name}`,
          start: iso(p.startDate)!, end: null, isOverdue: false });
      }
      if (p.endDate && p.endDate >= from && p.endDate <= to) {
        items.push({ ...common, key: `project-${p.id}-end`, title: `Deadline project: ${p.name}`,
          start: iso(p.endDate)!, end: null, isOverdue: overdueOf(p.endDate, status, true) });
      }
    }

    for (const t of tasks) {
      const status = t.status === "DONE" ? "COMPLETED"
        : t.status === "REJECTED" ? "CANCELLED"
        : t.status === "IN_PROGRESS" || t.status === "TESTED" ? "IN_PROGRESS"
        : t.status === "PENDING" || t.status === "BLOCKED" ? "PENDING" : "NOT_STARTED";
      items.push({
        key: `task-${t.id}`, sourceModule: "tasks", sourceId: t.id,
        title: t.name, subtitle: t.project?.name ?? null,
        category: "TASK", start: iso(t.dueDate)!, end: null, isAllDay: true,
        status, priority: PRIORITY_MAP[t.priority] ?? "MEDIUM",
        picId: t.assignee?.id ?? null, picName: t.assignee?.name ?? null,
        routePath: "/tasks", isOverdue: overdueOf(t.dueDate, status, true), editable: false,
      });
    }

    // Keuangan & Procurement: tampil penuh saat "Semua tim" (all) atau sesuai penanggung jawab terkait
    if (all || FINANCE_ROLES.includes(role)) {
      const invoices = await this.db.invoiceOut.findMany({
        where: { dueDate: { gte: from, lte: to }, status: { notIn: ["PAID", "BATAL", "DRAFT"] } },
        include: { customer: { select: { name: true } } },
      });
      for (const i of invoices) {
        items.push({
          key: `invoice-${i.id}`, sourceModule: "invoices", sourceId: i.id,
          title: `Jatuh tempo invoice ${i.number}`, subtitle: i.customer?.name ?? null,
          category: "FINANCE", start: iso(i.dueDate)!, end: null, isAllDay: true,
          status: "NOT_STARTED", priority: "HIGH", picId: null, picName: null,
          routePath: `/invoices/${i.id}`, isOverdue: overdueOf(i.dueDate, "NOT_STARTED", true),
          editable: false,
        });
      }
    }
    if (all || PROCUREMENT_ROLES.includes(role)) {
      const pos = await this.db.supplierPO.findMany({
        where: {
          AND: [
            ...(all ? [] : [{ OR: [{ createdById: me }, { createdById: null }] }]),
            { eta: { gte: from, lte: to }, status: "DISETUJUI", shipmentStatus: { not: "SAMPAI" } },
          ],
        },
        include: { supplier: { select: { name: true } } },
      });
      for (const po of pos) {
        items.push({
          key: `po-${po.id}`, sourceModule: "supplier-pos", sourceId: po.id,
          title: `Perkiraan tiba PO ${po.number}`, subtitle: po.supplier?.name ?? null,
          category: "PROCUREMENT", start: iso(po.eta)!, end: null, isAllDay: true,
          status: "NOT_STARTED", priority: "MEDIUM", picId: po.createdById ?? null, picName: null,
          routePath: `/supplier-pos/${po.id}`, isOverdue: overdueOf(po.eta, "NOT_STARTED", true),
          editable: false,
        });
      }
    }

    // Filter
    const qs = (q.q ?? "").trim().toLowerCase();
    const cats = (q.category ?? "").split(",").filter(Boolean);
    const stats = (q.status ?? "").split(",").filter(Boolean);
    const filtered = items
      .filter((i) => !cats.length || cats.includes(i.category))
      .filter((i) => !stats.length || stats.includes(i.status))
      .filter((i) => !q.assigneeId || i.picId === q.assigneeId)
      .filter((i) => q.overdue !== "1" || i.isOverdue)
      .filter((i) => !qs || `${i.title} ${i.subtitle ?? ""} ${i.picName ?? ""}`.toLowerCase().includes(qs))
      .sort((a, b) => a.start.localeCompare(b.start));

    return { items: filtered, scope: all ? "all" : "me", canViewAll: isGlobal };
  }

  onModuleInit() {
    // Scheduler ringan: cek pengingat jatuh tempo setiap menit, tanpa perlu ada yang membuka kalender.
    this.timer = setInterval(() => void this.fireReminders().catch(() => undefined), 60_000);
    void this.fireReminders().catch(() => undefined);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private timer?: ReturnType<typeof setInterval>;

  private async fireReminders() {
    const now = new Date();
    const events = await this.db.calendarEvent.findMany({
      where: {
        reminderMinutes: { not: null },
        lastRemindedAt: null,
        recurrence: "NONE",
        status: { notIn: ["COMPLETED", "CANCELLED"] },
        startDate: { gte: new Date(now.getTime() - 3600_000) },
      },
      include: { attendees: true },
    });
    for (const e of events) {
      const due = e.startDate.getTime() - (e.reminderMinutes ?? 0) * 60000;
      if (due > now.getTime()) continue;
      const claim = await this.db.calendarEvent.updateMany({
        where: { id: e.id, lastRemindedAt: null },
        data: { lastRemindedAt: now },
      });
      if (!claim.count) continue;
      const ids = new Set<number>([e.creatorId, ...(e.assigneeId ? [e.assigneeId] : []), ...e.attendees.map((a: any) => a.userId)]);
      await this.notifications.notify({
        userIds: [...ids],
        kind: "TUGAS" as any,
        title: "Pengingat Agenda",
        text: `Agenda "${e.title}" akan dimulai ${e.startDate.toISOString().slice(0, 16).replace("T", " ")}`,
        href: "/calendar",
      });
    }
  }

  // ───────────────────────────── CRUD agenda manual ─────────────────────────────

  private async load(id: number) {
    const ev = await this.db.calendarEvent.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
        attendees: { include: { user: { select: { id: true, name: true, role: true } } } },
      },
    });
    if (!ev) throw new NotFoundException("Agenda tidak ditemukan");
    return ev;
  }

  private canSee(ev: any, user: RequestUser) {
    return (
      this.isGlobal(user) ||
      ev.creatorId === user.id ||
      ev.assigneeId === user.id ||
      ev.attendees.some((a: any) => a.userId === user.id)
    );
  }

  private canEdit(ev: any, user: RequestUser) {
    return this.isGlobal(user) || ev.creatorId === user.id || ev.assigneeId === user.id;
  }

  async get(id: number, user: RequestUser) {
    const ev = await this.load(id);
    if (!this.canSee(ev, user)) throw new ForbiddenException("Tidak punya akses ke agenda ini");
    return { ...ev, editable: this.canEdit(ev, user) };
  }

  async create(dto: CalendarEventDto, user: RequestUser) {
    if (!dto.title || !dto.startDate) throw new BadRequestException("Judul dan tanggal mulai wajib diisi");
    const start = new Date(dto.startDate);
    const end = dto.endDate ? new Date(dto.endDate) : null;
    if (end && end < start) throw new BadRequestException("Tanggal selesai tidak boleh sebelum tanggal mulai");
    const ev = await this.db.calendarEvent.create({
      data: {
        number: await this.nextNumber(),
        title: dto.title,
        description: dto.description ?? null,
        category: dto.category ?? "MEETING",
        status: dto.status ?? "NOT_STARTED",
        priority: dto.priority ?? "MEDIUM",
        startDate: start,
        endDate: end,
        isAllDay: dto.isAllDay ?? false,
        recurrence: dto.recurrence ?? "NONE",
        recurrenceUntil: dto.recurrenceUntil ? new Date(dto.recurrenceUntil) : null,
        reminderMinutes: dto.reminderMinutes ?? null,
        creatorId: user.id,
        assigneeId: dto.assigneeId ?? user.id,
        customerId: dto.customerId ?? null,
        projectId: dto.projectId ?? null,
        leadId: dto.leadId ?? null,
        attendees: dto.attendeeIds?.length
          ? { create: [...new Set(dto.attendeeIds)].map((userId) => ({ userId })) }
          : undefined,
      },
    });
    await this.audit.log({
      actor: user, action: "BUAT_AGENDA", entityType: "calendarEvent", entityId: ev.id,
      detail: `Membuat agenda ${ev.number}: ${ev.title}`,
    });
    const notify = [...new Set([ev.assigneeId, ...(dto.attendeeIds ?? [])].filter((x): x is number => !!x && x !== user.id))];
    if (notify.length) {
      void this.notifications.notify({
        userIds: notify, kind: "TUGAS" as any, title: "Agenda Baru",
        text: `${user.name} menambahkan agenda: ${ev.title}`, href: "/calendar",
      }).catch(() => undefined);
    }
    return this.get(ev.id, user);
  }

  async update(id: number, dto: CalendarEventDto, user: RequestUser) {
    const ev = await this.load(id);
    if (!this.canEdit(ev, user)) throw new ForbiddenException("Tidak punya akses mengubah agenda ini");
    const data: any = {};
    for (const k of ["title", "description", "category", "status", "priority", "isAllDay", "recurrence", "reminderMinutes", "assigneeId", "completionNote", "customerId", "projectId", "leadId"] as const) {
      if ((dto as any)[k] !== undefined) data[k] = (dto as any)[k];
    }
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) data.endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (dto.recurrenceUntil !== undefined) data.recurrenceUntil = dto.recurrenceUntil ? new Date(dto.recurrenceUntil) : null;
    if (data.startDate || data.reminderMinutes !== undefined) data.lastRemindedAt = null;
    const s = data.startDate ?? ev.startDate;
    const e = data.endDate === undefined ? ev.endDate : data.endDate;
    if (e && e < s) throw new BadRequestException("Tanggal selesai tidak boleh sebelum tanggal mulai");
    await this.db.calendarEvent.update({ where: { id }, data });
    if (dto.attendeeIds) {
      await this.db.calendarAttendee.deleteMany({ where: { eventId: id } });
      const ids = [...new Set(dto.attendeeIds)];
      if (ids.length) await this.db.calendarAttendee.createMany({ data: ids.map((userId) => ({ eventId: id, userId })) });
    }
    await this.audit.log({
      actor: user, action: "UPDATE_AGENDA", entityType: "calendarEvent", entityId: id,
      detail: `Memperbarui agenda ${ev.number}`,
    });
    return this.get(id, user);
  }

  async updateStatus(id: number, dto: CalendarStatusDto, user: RequestUser) {
    const ev = await this.load(id);
    if (!this.canEdit(ev, user)) throw new ForbiddenException("Tidak punya akses mengubah agenda ini");
    await this.db.calendarEvent.update({
      where: { id },
      data: { status: dto.status, ...(dto.note ? { completionNote: dto.note } : {}) },
    });
    await this.audit.log({
      actor: user, action: "UPDATE_STATUS_AGENDA", entityType: "calendarEvent", entityId: id,
      detail: `Mengubah status agenda ${ev.number} menjadi ${dto.status}`,
    });
    return this.get(id, user);
  }

  async remove(id: number, user: RequestUser) {
    const ev = await this.load(id);
    if (!this.canEdit(ev, user)) throw new ForbiddenException("Tidak punya akses menghapus agenda ini");
    await this.db.calendarEvent.delete({ where: { id } });
    await this.audit.log({
      actor: user, action: "HAPUS_AGENDA", entityType: "calendarEvent", entityId: id,
      detail: `Menghapus agenda ${ev.number}: ${ev.title}`,
    });
    return { ok: true };
  }
}

