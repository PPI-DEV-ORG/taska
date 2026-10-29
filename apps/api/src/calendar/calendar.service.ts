import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { CalendarEventDto, CalendarQuery, CalendarStatusDto } from "./dto.js";

export type CalendarItem = {
  key: string;
  eventNumber?: string | null;
  sourceModule: string;
  sourceId: number;
  title: string;
  subtitle?: string | null;
  category: string;
  start: string;
  end: string | null;
  occurrenceDate: string;
  isAllDay: boolean;
  status: string;
  priority: string;
  picId: number | null;
  picName: string | null;
  picRole?: string | null;
  routePath: string | null;
  isOverdue: boolean;
  editable: boolean;
  recurrence?: string;
  hasConflict?: boolean;
  conflictWith?: string | null;
};

const pad = (n: number, w: number) => String(n).padStart(w, "0");
const GLOBAL_ROLES = ["SUPER_ADMIN", "BOS", "ADMIN"];
const FINANCE_ROLES = ["FINANCE"];
const PROCUREMENT_ROLES = ["FINANCE", "PROCUREMENT"];
const SALES_ROLES = ["SALES", "PM"];

function normStatus(raw: unknown): string {
  const s = String(raw ?? "").toLowerCase();
  if (/(selesai|complete|done|paid|lunas|closed|sampai|diterima|won)/.test(s)) return "COMPLETED";
  if (/(batal|cancel|tolak|reject|lost|expired)/.test(s)) return "CANCELLED";
  if (/(progress|berjalan|jalan|dikerjakan|tested|dikirim|ready|preparation|sent|negotiation|proposal)/.test(s)) return "IN_PROGRESS";
  if (/(pending|tunda|blocked|menunggu|partial|cek_stok|diajukan)/.test(s)) return "PENDING";
  return "NOT_STARTED";
}

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

function wibDateKey(d: Date): string {
  return new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

function parseExcluded(raw?: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
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

  private isFinanceOrTaxAuthorized(user: RequestUser) {
    const r = this.roleOf(user);
    return GLOBAL_ROLES.includes(r) || FINANCE_ROLES.includes(r);
  }

  private async nextNumber(): Promise<string> {
    const now = new Date();
    const prefix = `EVT-${now.getFullYear()}${pad(now.getMonth() + 1, 2)}-`;
    const last = await this.db.calendarEvent.findFirst({
      where: { number: { startsWith: prefix } },
      orderBy: { id: "desc" },
      select: { number: true },
    });
    const lastSeq = last?.number ? parseInt(String(last.number).split("-").pop() || "0", 10) : 0;
    return `${prefix}${pad((Number.isFinite(lastSeq) ? lastSeq : 0) + 1, 4)}`;
  }

  private resolveManualRoute(e: any): string | null {
    if (e.invoiceId) return `/invoices/${e.invoiceId}`;
    if (e.projectId) return `/projects/${e.projectId}`;
    if (e.leadId) return `/leads/${e.leadId}`;
    if (e.customerId) return `/customers/${e.customerId}`;
    if (e.supplierId) return `/suppliers/${e.supplierId}`;
    return null;
  }

  // ───────────────────────────── Aggregator ─────────────────────────────

  private followUpColsReady = false;
  private async ensureFollowUpCols() {
    if (this.followUpColsReady) return;
    await this.db.$executeRawUnsafe("ALTER TABLE `FollowUp` ADD COLUMN `pocReportId` INT NULL").catch(() => {});
    await this.db.$executeRawUnsafe("ALTER TABLE `FollowUp` ADD COLUMN `visitReportId` INT NULL").catch(() => {});
    this.followUpColsReady = true;
  }

  async list(q: CalendarQuery, user: RequestUser) {
    await this.ensureFollowUpCols();
    const role = this.roleOf(user);
    const isGlobal = this.isGlobal(user);
    const canSeeFinanceTax = this.isFinanceOrTaxAuthorized(user);
    const all = isGlobal && q.scope === "all";
    const includeTeam = all || q.scope === "team";
    const me = Number(user.id);
    const inMyProject = {
      OR: [{ picId: me }, { members: { some: { userId: me } } }],
    };
    const myProjectIds = all
      ? []
      : (
          await this.db.project.findMany({
            where: inMyProject,
            select: { id: true },
          })
        ).map((p: { id: number }) => p.id);

    const now = new Date();
    const rawFrom = q.from ? new Date(q.from) : new Date(now.getFullYear(), now.getMonth(), 1);
    // Jika filter overdue aktif, tarik item belum selesai hingga 1 tahun ke belakang agar tetap terlihat sampai diselesaikan (PRD 3.5 & 7.8).
    const from = q.overdue === "1"
      ? new Date(Math.min(rawFrom.getTime(), now.getTime() - 365 * 86400_000))
      : rawFrom;
    const to = q.to ? new Date(q.to) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const overdueOf = (ref: Date | null, status: string, allDay: boolean) => {
      if (!ref || status === "COMPLETED" || status === "CANCELLED") return false;
      return allDay ? ref.getTime() < todayStart : ref.getTime() < now.getTime();
    };

    const items: CalendarItem[] = [];

    const [
      manual,
      visits,
      visitActions,
      pocs,
      pocChecklists,
      surveys,
      projects,
      tasks,
      leads,
      followUps,
      quotations,
    ] = await Promise.all([
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
                      ...(includeTeam
                        ? [
                            { attendees: { some: { userId: me } } },
                            ...(myProjectIds.length ? [{ projectId: { in: myProjectIds } }] : []),
                          ]
                        : []),
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
        include: {
          assignee: { select: { id: true, name: true, role: true } },
          creator: { select: { id: true, name: true, role: true } },
          attendees: { select: { userId: true } },
        },
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
                      ...(includeTeam
                        ? [
                            { members: { some: { userId: me } } },
                            { project: inMyProject },
                          ]
                        : []),
                    ],
                  },
                ]),
            { date: { lte: to } },
            {
              OR: [{ endDate: { gte: from } }, { endDate: null, date: { gte: from } }],
            },
          ],
        },
        include: { owner: { select: { id: true, name: true, role: true } } },
      }),
      this.db.visitActionItem.findMany({
        where: {
          AND: [
            ...(all
              ? []
              : [
                  {
                    OR: [
                      { assigneeId: me },
                      ...(includeTeam
                        ? [
                            { visitReport: { ownerId: me } },
                            { visitReport: { members: { some: { userId: me } } } },
                            { visitReport: { project: inMyProject } },
                          ]
                        : []),
                    ],
                  },
                ]),
            { dueDate: { gte: from, lte: to } },
          ],
        },
        include: {
          visitReport: { select: { id: true, number: true, title: true, owner: { select: { id: true, name: true, role: true } } } },
        },
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
                      ...(includeTeam
                        ? [
                            { members: { some: { userId: me } } },
                            { project: inMyProject },
                          ]
                        : []),
                    ],
                  },
                ]),
            { date: { lte: to } },
            {
              OR: [{ endDate: { gte: from } }, { endDate: null, date: { gte: from } }],
            },
          ],
        },
        include: { owner: { select: { id: true, name: true, role: true } } },
      }),
      this.db.pocChecklist.findMany({
        where: {
          AND: [
            ...(all
              ? []
              : [
                  {
                    OR: [
                      { assigneeId: me },
                      ...(includeTeam
                        ? [
                            { pocReport: { ownerId: me } },
                            { pocReport: { members: { some: { userId: me } } } },
                            { pocReport: { project: inMyProject } },
                          ]
                        : []),
                    ],
                  },
                ]),
            { dueDate: { gte: from, lte: to } },
          ],
        },
        include: {
          pocReport: { select: { id: true, number: true, title: true, owner: { select: { id: true, name: true, role: true } } } },
        },
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
                      ...(includeTeam ? [{ members: { some: { userId: me } } }] : []),
                    ],
                  },
                ]),
            { scheduleAt: { gte: from, lte: to } },
          ],
        },
        include: {
          lead: { select: { name: true } },
          requester: { select: { id: true, name: true, role: true } },
        },
      }),
      this.db.project.findMany({
        where: {
          AND: [
            ...(all ? [] : [includeTeam ? inMyProject : { picId: me }]),
            {
              OR: [
                { startDate: { gte: from, lte: to } },
                { endDate: { gte: from, lte: to } },
              ],
            },
          ],
        },
        include: {
          pic: { select: { id: true, name: true, role: true } },
          customer: { select: { name: true } },
        },
      }),
      this.db.task.findMany({
        where: {
          AND: [
            ...(all
              ? []
              : includeTeam
                ? [{ OR: [{ assigneeId: me }, { project: inMyProject }] }]
                : [{ assigneeId: me }]),
            { dueDate: { gte: from, lte: to } },
          ],
        },
        include: {
          assignee: { select: { id: true, name: true, role: true } },
          project: { select: { id: true, name: true } },
        },
      }),
      this.db.lead.findMany({
        where: {
          AND: [
            ...(all ? [] : [{ owner_id: me }]),
            { targetClosing: { gte: from, lte: to } },
            { stage: { notIn: ["WON", "LOST"] } },
          ],
        },
        include: {
          owner: { select: { id: true, name: true, role: true } },
          customer: { select: { name: true } },
        },
      }),
      this.db.followUp.findMany({
        where: {
          AND: [
            ...(all
              ? []
              : [
                  {
                    OR: [
                      { createdById: me },
                      { lead: { owner_id: me } },
                      { pocReport: { ownerId: me } },
                      { visitReport: { ownerId: me } },
                      ...(includeTeam
                        ? [
                            { pocReport: { members: { some: { userId: me } } } },
                            { pocReport: { project: inMyProject } },
                            { visitReport: { members: { some: { userId: me } } } },
                            { visitReport: { project: inMyProject } },
                          ]
                        : []),
                    ],
                  },
                ]),
            {
              OR: [
                { date: { gte: from, lte: to } },
                { nextDate: { gte: from, lte: to } },
              ],
            },
          ],
        },
        include: {
          creator: { select: { id: true, name: true, role: true } },
          lead: { select: { id: true, name: true, owner: { select: { id: true, name: true, role: true } } } },
          quotation: { select: { id: true, number: true } },
          pocReport: { select: { id: true, number: true, title: true, owner: { select: { id: true, name: true, role: true } } } },
          visitReport: { select: { id: true, number: true, title: true, owner: { select: { id: true, name: true, role: true } } } },
        },
      }),
      this.db.quotation.findMany({
        where: {
          AND: [
            ...(all ? [] : [{ ownerId: me }]),
            { validUntil: { gte: from, lte: to } },
            { status: { in: ["SENT", "NEGOTIATION", "APPROVED", "PENDING_APPROVAL"] } },
          ],
        },
        include: {
          owner: { select: { id: true, name: true, role: true } },
          customer: { select: { name: true } },
          lead: { select: { name: true } },
        },
      }),
    ]);

    // 1. Manual events (+ ekspansi berulang & pengecualian tanggal tunggal)
    for (const e of manual) {
      const isAttendee = (e.attendees ?? []).some((a: any) => a.userId === me);
      // Proteksi informasi sensitif FINANCE / TAX (PRD 3.8 & 5)
      if (
        (e.category === "FINANCE" || e.category === "TAX") &&
        !canSeeFinanceTax &&
        e.creatorId !== me &&
        e.assigneeId !== me &&
        !isAttendee
      ) {
        continue;
      }
      const startMs = e.startDate.getTime();
      const durMs = e.endDate ? e.endDate.getTime() - startMs : 0;
      const canEdit = isGlobal || e.creatorId === me || e.assigneeId === me || (e.category === "TAX" && canSeeFinanceTax);
      const excluded = parseExcluded(e.excludedDates);
      const base = {
        eventNumber: e.number,
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
        picRole: e.assignee?.role ?? e.creator?.role ?? null,
        routePath: this.resolveManualRoute(e),
        editable: canEdit,
        recurrence: e.recurrence,
      };
      const push = (s: Date) => {
        const occKey = wibDateKey(s);
        if (excluded.has(occKey)) return;
        const en = e.endDate ? new Date(s.getTime() + durMs) : null;
        if (s.getTime() > to.getTime() || (en ?? s).getTime() < from.getTime()) return;
        items.push({
          ...base,
          key: `calendar-${e.id}-${occKey}`,
          occurrenceDate: occKey,
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

    // 2. Visit Reports & Visit Action Items
    for (const v of visits) {
      const status = normStatus(v.status);
      items.push({
        key: `visit-${v.id}`, sourceModule: "visit-reports", sourceId: v.id,
        title: v.title, subtitle: [v.number, v.clientName, v.location].filter(Boolean).join(" · "),
        category: "KUNJUNGAN", start: iso(v.date)!, end: iso(v.endDate),
        occurrenceDate: wibDateKey(v.date), isAllDay: true,
        status, priority: "MEDIUM", picId: v.owner?.id ?? null, picName: v.owner?.name ?? null,
        picRole: v.owner?.role ?? null,
        routePath: `/visit-reports/${v.id}`, isOverdue: overdueOf(v.endDate ?? v.date, status, true),
        editable: false,
      });
    }
    for (const va of visitActions) {
      if (!va.dueDate) continue;
      const status = normStatus(va.status);
      const owner = va.visitReport?.owner;
      items.push({
        key: `visit-action-${va.id}`, sourceModule: "visit-reports", sourceId: va.visitReportId,
        title: `Tindak lanjut kunjungan: ${va.task}`,
        subtitle: va.visitReport ? `${va.visitReport.number} · ${va.visitReport.title}` : va.notes ?? null,
        category: "KUNJUNGAN", start: iso(va.dueDate)!, end: null,
        occurrenceDate: wibDateKey(va.dueDate), isAllDay: true,
        status, priority: "MEDIUM", picId: va.assigneeId ?? owner?.id ?? null,
        picName: owner?.name ?? null, picRole: owner?.role ?? null,
        routePath: `/visit-reports/${va.visitReportId}`, isOverdue: overdueOf(va.dueDate, status, true),
        editable: false,
      });
    }

    // 3. POC Reports & POC Preparation Checklists
    for (const p of pocs) {
      const status = normStatus(p.status);
      items.push({
        key: `poc-${p.id}`, sourceModule: "poc-reports", sourceId: p.id,
        title: p.title, subtitle: [p.number, p.clientName, p.location].filter(Boolean).join(" · "),
        category: "POC", start: iso(p.date)!, end: iso(p.endDate),
        occurrenceDate: wibDateKey(p.date), isAllDay: true,
        status, priority: "MEDIUM", picId: p.owner?.id ?? null, picName: p.owner?.name ?? null,
        picRole: p.owner?.role ?? null,
        routePath: `/poc-reports/${p.id}`, isOverdue: overdueOf(p.endDate ?? p.date, status, true),
        editable: false,
      });
    }
    for (const pc of pocChecklists) {
      if (!pc.dueDate) continue;
      const status = pc.isDone ? "COMPLETED" : "NOT_STARTED";
      const owner = pc.pocReport?.owner;
      items.push({
        key: `poc-chk-${pc.id}`, sourceModule: "poc-reports", sourceId: pc.pocReportId,
        title: `Persiapan POC: ${pc.title}`,
        subtitle: pc.pocReport ? `${pc.pocReport.number} · ${pc.pocReport.title}` : pc.notes ?? null,
        category: "POC", start: iso(pc.dueDate)!, end: null,
        occurrenceDate: wibDateKey(pc.dueDate), isAllDay: true,
        status, priority: "MEDIUM", picId: pc.assigneeId ?? owner?.id ?? null,
        picName: owner?.name ?? null, picRole: owner?.role ?? null,
        routePath: `/poc-reports/${pc.pocReportId}`, isOverdue: overdueOf(pc.dueDate, status, true),
        editable: false,
      });
    }

    // 4. Surveys
    for (const s of surveys) {
      const status = normStatus(s.status);
      items.push({
        key: `survey-${s.id}`, sourceModule: "surveys", sourceId: s.id,
        title: `Survey: ${s.lead?.name ?? s.location}`, subtitle: s.location,
        category: "SURVEY", start: iso(s.scheduleAt)!, end: null,
        occurrenceDate: wibDateKey(s.scheduleAt), isAllDay: false,
        status, priority: "MEDIUM", picId: s.requester?.id ?? null, picName: s.requester?.name ?? null,
        picRole: s.requester?.role ?? null,
        routePath: `/surveys/${s.id}`, isOverdue: overdueOf(s.scheduleAt, status, false),
        editable: false,
      });
    }

    // 5. Sales & CRM: Leads target closing, Follow-ups, Quotations validUntil
    for (const l of leads) {
      if (!l.targetClosing) continue;
      const status = normStatus(l.stage);
      items.push({
        key: `lead-${l.id}`, sourceModule: "leads", sourceId: l.id,
        title: `Target closing lead: ${l.name}`, subtitle: l.customer?.name ?? l.contactName ?? null,
        category: "SALES", start: iso(l.targetClosing)!, end: null,
        occurrenceDate: wibDateKey(l.targetClosing), isAllDay: true,
        status, priority: l.probability >= 70 ? "HIGH" : "MEDIUM",
        picId: l.owner?.id ?? null, picName: l.owner?.name ?? null, picRole: l.owner?.role ?? null,
        routePath: `/leads/${l.id}`, isOverdue: overdueOf(l.targetClosing, status, true),
        editable: false,
      });
    }
    for (const f of followUps) {
      const owner = f.creator ?? f.pocReport?.owner ?? f.visitReport?.owner ?? f.lead?.owner;
      const isPoc = !!f.pocReportId;
      const isVisit = !!f.visitReportId;
      const isQuote = !isPoc && !isVisit && !!f.quotationId;
      const sourceModule = isPoc
        ? "poc-reports"
        : isVisit
          ? "visit-reports"
          : isQuote
            ? "quotations"
            : "leads";
      const sourceId = f.pocReportId ?? f.visitReportId ?? f.quotationId ?? f.leadId ?? f.id;
      const category = isPoc ? "POC" : isVisit ? "KUNJUNGAN" : "SALES";
      const route = isPoc
        ? `/poc-reports/${f.pocReportId}`
        : isVisit
          ? `/visit-reports/${f.visitReportId}`
          : isQuote
            ? `/quotations/${f.quotationId}`
            : f.leadId
              ? `/leads/${f.leadId}`
              : null;
      const refLabel = isPoc
        ? `POC ${f.pocReport?.number ?? ""} - ${f.pocReport?.title ?? ""}`
        : isVisit
          ? `Kunjungan ${f.visitReport?.number ?? ""} - ${f.visitReport?.title ?? ""}`
          : isQuote
            ? `Penawaran ${f.quotation?.number ?? ""}`
            : f.lead?.name ?? "Prospek";

      if (f.date && f.date >= from && f.date <= to) {
        const status = f.status === "TERJADWAL" ? "NOT_STARTED" : normStatus(f.status);
        items.push({
          key: `followup-${f.id}`,
          sourceModule,
          sourceId,
          title: `Follow-up ${refLabel} (${f.method})`,
          subtitle: f.notes,
          category,
          start: iso(f.date)!,
          end: null,
          occurrenceDate: wibDateKey(f.date),
          isAllDay: true,
          status,
          priority: "MEDIUM",
          picId: owner?.id ?? null,
          picName: owner?.name ?? null,
          picRole: owner?.role ?? null,
          routePath: route,
          isOverdue: overdueOf(f.date, status, true),
          editable: false,
        });
      }

      if (
        f.nextDate &&
        f.nextDate >= from &&
        f.nextDate <= to &&
        (!f.date || wibDateKey(f.nextDate) !== wibDateKey(f.date))
      ) {
        const nextStatus = "NOT_STARTED";
        items.push({
          key: `followup-${f.id}-next`,
          sourceModule,
          sourceId,
          title: `Jadwal Follow-up Berikutnya: ${refLabel} (${f.method})`,
          subtitle: f.notes ? `Tindak lanjut dari catatan: ${f.notes}` : null,
          category,
          start: iso(f.nextDate)!,
          end: null,
          occurrenceDate: wibDateKey(f.nextDate),
          isAllDay: true,
          status: nextStatus,
          priority: "HIGH",
          picId: owner?.id ?? null,
          picName: owner?.name ?? null,
          picRole: owner?.role ?? null,
          routePath: route,
          isOverdue: overdueOf(f.nextDate, nextStatus, true),
          editable: false,
        });
      }
    }
    for (const qt of quotations) {
      if (!qt.validUntil) continue;
      const status = normStatus(qt.status);
      items.push({
        key: `quote-${qt.id}`, sourceModule: "quotations", sourceId: qt.id,
        title: `Follow-up penawaran ${qt.number}`,
        subtitle: [qt.customer?.name ?? qt.lead?.name, `Berlaku s/d ${wibDateKey(qt.validUntil)}`].filter(Boolean).join(" · "),
        category: "SALES", start: iso(qt.validUntil)!, end: null,
        occurrenceDate: wibDateKey(qt.validUntil), isAllDay: true,
        status, priority: "MEDIUM",
        picId: qt.owner?.id ?? null, picName: qt.owner?.name ?? null, picRole: qt.owner?.role ?? null,
        routePath: `/quotations/${qt.id}`, isOverdue: overdueOf(qt.validUntil, status, true),
        editable: false,
      });
    }

    // 6. Projects (Kickoff & Deadline)
    for (const p of projects) {
      const status = normStatus(p.status === "TERLAMBAT" ? "berjalan" : p.status);
      const common = {
        sourceModule: "projects", sourceId: p.id, category: "PROJECT",
        subtitle: p.customer?.name ?? null, status, priority: "MEDIUM" as string,
        picId: p.pic?.id ?? null, picName: p.pic?.name ?? null, picRole: p.pic?.role ?? null,
        routePath: `/projects/${p.id}`, isAllDay: true, editable: false,
      };
      if (p.startDate >= from && p.startDate <= to) {
        items.push({ ...common, key: `project-${p.id}-start`, title: `Kickoff / Mulai project: ${p.name}`,
          occurrenceDate: wibDateKey(p.startDate), start: iso(p.startDate)!, end: null, isOverdue: false });
      }
      if (p.endDate && p.endDate >= from && p.endDate <= to) {
        items.push({ ...common, key: `project-${p.id}-end`, title: `Deadline project: ${p.name}`,
          occurrenceDate: wibDateKey(p.endDate), start: iso(p.endDate)!, end: null, isOverdue: overdueOf(p.endDate, status, true) });
      }
    }

    // 7. Tasks
    for (const t of tasks) {
      const status = t.status === "DONE" ? "COMPLETED"
        : t.status === "REJECTED" ? "CANCELLED"
        : t.status === "IN_PROGRESS" || t.status === "TESTED" ? "IN_PROGRESS"
        : t.status === "PENDING" || t.status === "BLOCKED" ? "PENDING" : "NOT_STARTED";
      items.push({
        key: `task-${t.id}`, sourceModule: "tasks", sourceId: t.id,
        title: t.name, subtitle: t.project?.name ?? null,
        category: "TASK", start: iso(t.dueDate)!, end: null,
        occurrenceDate: wibDateKey(t.dueDate), isAllDay: true,
        status, priority: PRIORITY_MAP[t.priority] ?? "MEDIUM",
        picId: t.assignee?.id ?? null, picName: t.assignee?.name ?? null, picRole: t.assignee?.role ?? null,
        routePath: "/tasks", isOverdue: overdueOf(t.dueDate, status, true), editable: false,
      });
    }

    // 8. Finance: Accounts Receivable (InvoiceOut) & Accounts Payable (InvoiceIn)
    if (all || FINANCE_ROLES.includes(role)) {
      const [invoicesOut, invoicesIn] = await Promise.all([
        this.db.invoiceOut.findMany({
          where: { dueDate: { gte: from, lte: to }, status: { notIn: ["PAID", "BATAL", "DRAFT"] } },
          include: { customer: { select: { name: true } } },
        }),
        this.db.invoiceIn.findMany({
          where: { dueDate: { gte: from, lte: to }, status: { notIn: ["PAID", "BATAL"] } },
          include: { supplier: { select: { name: true } }, supplierPo: { select: { id: true, number: true } } },
        }),
      ]);
      for (const i of invoicesOut) {
        items.push({
          key: `invoice-out-${i.id}`, sourceModule: "invoices", sourceId: i.id,
          title: `Jatuh tempo piutang invoice ${i.number}`, subtitle: i.customer?.name ?? null,
          category: "FINANCE", start: iso(i.dueDate)!, end: null,
          occurrenceDate: wibDateKey(i.dueDate), isAllDay: true,
          status: i.status === "PARTIAL" ? "PENDING" : "NOT_STARTED", priority: "HIGH",
          picId: null, picName: "Finance", picRole: "FINANCE",
          routePath: `/invoices/${i.id}`, isOverdue: overdueOf(i.dueDate, "NOT_STARTED", true),
          editable: false,
        });
      }
      for (const bill of invoicesIn) {
        items.push({
          key: `invoice-in-${bill.id}`, sourceModule: "supplier-pos", sourceId: bill.supplierPoId ?? bill.id,
          title: `Jatuh tempo tagihan supplier ${bill.number || bill.supplierPo?.number || `#${bill.id}`}`,
          subtitle: bill.supplier?.name ?? null,
          category: "FINANCE", start: iso(bill.dueDate)!, end: null,
          occurrenceDate: wibDateKey(bill.dueDate), isAllDay: true,
          status: bill.status === "PARTIAL" ? "PENDING" : "NOT_STARTED", priority: "HIGH",
          picId: null, picName: "Finance", picRole: "FINANCE",
          routePath: bill.supplierPoId ? `/supplier-pos/${bill.supplierPoId}` : "/accounting",
          isOverdue: overdueOf(bill.dueDate, "NOT_STARTED", true),
          editable: false,
        });
      }
    }

    // 9. Procurement: Supplier POs & Purchase Requests
    if (all || PROCUREMENT_ROLES.includes(role)) {
      const [pos, prs] = await Promise.all([
        this.db.supplierPO.findMany({
          where: {
            AND: [
              ...(all ? [] : [{ OR: [{ createdById: me }, { createdById: null }] }]),
              { eta: { gte: from, lte: to }, status: "DISETUJUI", shipmentStatus: { not: "SAMPAI" } },
            ],
          },
          include: { supplier: { select: { name: true } }, creator: { select: { id: true, name: true, role: true } } },
        }),
        this.db.purchaseRequest.findMany({
          where: {
            AND: [
              ...(all ? [] : [{ requesterId: me }]),
              { date: { gte: from, lte: to }, status: { in: ["DIAJUKAN", "CEK_STOK", "DISETUJUI"] } },
            ],
          },
          include: { requester: { select: { id: true, name: true, role: true } }, project: { select: { name: true } } },
        }),
      ]);
      for (const po of pos) {
        items.push({
          key: `po-${po.id}`, sourceModule: "supplier-pos", sourceId: po.id,
          title: `Perkiraan tiba PO ${po.number}`, subtitle: po.supplier?.name ?? null,
          category: "PROCUREMENT", start: iso(po.eta)!, end: null,
          occurrenceDate: wibDateKey(po.eta), isAllDay: true,
          status: normStatus(po.shipmentStatus), priority: "MEDIUM",
          picId: po.creator?.id ?? null, picName: po.creator?.name ?? "Procurement", picRole: po.creator?.role ?? "PROCUREMENT",
          routePath: `/supplier-pos/${po.id}`, isOverdue: overdueOf(po.eta, "NOT_STARTED", true),
          editable: false,
        });
      }
      for (const pr of prs) {
        items.push({
          key: `pr-${pr.id}`, sourceModule: "purchase-requests", sourceId: pr.id,
          title: `Follow-up request barang ${pr.number}`,
          subtitle: [pr.project?.name, pr.purpose].filter(Boolean).join(" · "),
          category: "PROCUREMENT", start: iso(pr.date)!, end: null,
          occurrenceDate: wibDateKey(pr.date), isAllDay: true,
          status: normStatus(pr.status), priority: "MEDIUM",
          picId: pr.requester?.id ?? null, picName: pr.requester?.name ?? null, picRole: pr.requester?.role ?? null,
          routePath: `/purchase-requests/${pr.id}`, isOverdue: false,
          editable: false,
        });
      }
    }

    // Deteksi bentrok jadwal (Schedule Conflict Detection — PRD 3.8 & Phase 3)
    const timedActive = items.filter(
      (i) => !i.isAllDay && i.picId && i.status !== "COMPLETED" && i.status !== "CANCELLED"
    );
    for (let i = 0; i < timedActive.length; i++) {
      const a = timedActive[i]!;
      const aStart = new Date(a.start).getTime();
      const aEnd = a.end ? new Date(a.end).getTime() : aStart + 3600_000;
      for (let j = i + 1; j < timedActive.length; j++) {
        const b = timedActive[j]!;
        if (a.picId !== b.picId || a.occurrenceDate !== b.occurrenceDate) continue;
        const bStart = new Date(b.start).getTime();
        const bEnd = b.end ? new Date(b.end).getTime() : bStart + 3600_000;
        if (aStart < bEnd && bStart < aEnd) {
          a.hasConflict = true;
          a.conflictWith = b.title;
          b.hasConflict = true;
          b.conflictWith = a.title;
        }
      }
    }

    // Filter
    const qs = (q.q ?? "").trim().toLowerCase();
    const cats = (q.category ?? "").split(",").filter(Boolean);
    const stats = (q.status ?? "").split(",").filter(Boolean);
    const teamFilter = (q.team ?? "").trim().toUpperCase();
    const filtered = items
      .filter((i) => !cats.length || cats.includes(i.category))
      .filter((i) => !stats.length || stats.includes(i.status))
      .filter((i) => !q.assigneeId || i.picId === q.assigneeId)
      .filter((i) => !teamFilter || (i.picRole || "").toUpperCase() === teamFilter)
      .filter((i) => q.overdue !== "1" || i.isOverdue)
      .filter((i) => !qs || `${i.title} ${i.subtitle ?? ""} ${i.picName ?? ""} ${i.eventNumber ?? ""}`.toLowerCase().includes(qs))
      .sort((a, b) => a.start.localeCompare(b.start));

    return { items: filtered, scope: all ? "all" : includeTeam ? "team" : "me", canViewAll: isGlobal };
  }

  onModuleInit() {
    // Scheduler ringan: cek pengingat jatuh tempo & overdue setiap menit
    this.timer = setInterval(() => void this.fireReminders().catch(() => undefined), 60_000);
    void this.fireReminders().catch(() => undefined);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private timer?: ReturnType<typeof setInterval>;

  private async fireReminders() {
    const now = new Date();
    // 1. Pengingat sebelum aktivitas / saat deadline (mendukung tunggal & berulang)
    const events = await this.db.calendarEvent.findMany({
      where: {
        reminderMinutes: { not: null },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      include: { attendees: true },
    });
    for (const e of events) {
      let targetStart: Date | null = null;
      if (e.recurrence === "NONE") {
        if (e.lastRemindedAt) continue;
        if (e.startDate.getTime() < now.getTime() - 3600_000) continue;
        targetStart = e.startDate;
      } else {
        // Cari kejadian berikutnya untuk seri berulang
        const excluded = parseExcluded(e.excludedDates);
        const until = e.recurrenceUntil ? new Date(e.recurrenceUntil).getTime() : now.getTime() + 14 * 86400_000;
        let cur = new Date(e.startDate);
        let guard = 0;
        while (cur.getTime() <= until && guard++ < 500) {
          const k = wibDateKey(cur);
          if (!excluded.has(k) && cur.getTime() >= now.getTime() - 3600_000) {
            targetStart = cur;
            break;
          }
          const next = new Date(cur);
          if (e.recurrence === "DAILY") next.setDate(next.getDate() + 1);
          else if (e.recurrence === "WEEKLY") next.setDate(next.getDate() + 7);
          else if (e.recurrence === "MONTHLY") next.setMonth(next.getMonth() + 1);
          else next.setFullYear(next.getFullYear() + 1);
          cur = next;
        }
        if (!targetStart) continue;
        // Cegah duplikasi pengingat pada kejadian yang sama
        if (e.lastRemindedAt && Math.abs(targetStart.getTime() - e.lastRemindedAt.getTime()) < 12 * 3600_000) {
          continue;
        }
      }

      if (!targetStart) continue;
      const due = targetStart.getTime() - (e.reminderMinutes ?? 0) * 60000;
      if (due > now.getTime()) continue;
      const claim = await this.db.calendarEvent.updateMany({
        where: { id: e.id, lastRemindedAt: e.lastRemindedAt ?? null },
        data: { lastRemindedAt: targetStart },
      });
      if (!claim.count) continue;
      const ids = new Set<number>([
        e.creatorId,
        ...(e.assigneeId ? [e.assigneeId] : []),
        ...e.attendees.map((a: any) => a.userId),
      ]);
      await this.notifications.notify({
        userIds: [...ids],
        kind: "TUGAS" as any,
        title: "Pengingat Agenda (WIB)",
        text: `Agenda "${e.title}" dijadwalkan pada ${new Date(targetStart.getTime() + 7 * 3600_000).toISOString().slice(0, 16).replace("T", " ")} WIB`,
        href: "/calendar",
      });
    }

    // 2. Peringatan aktivitas Overdue (PRD 3.7)
    const overdueEvents = await this.db.calendarEvent.findMany({
      where: {
        overdueNotifiedAt: null,
        recurrence: "NONE",
        status: { notIn: ["COMPLETED", "CANCELLED"] },
        startDate: { lt: new Date(now.getTime() - 3600_000) },
      },
      include: { attendees: true },
      take: 25,
    });
    for (const e of overdueEvents) {
      const ref = e.endDate ?? e.startDate;
      if (ref.getTime() >= now.getTime()) continue;
      const claim = await this.db.calendarEvent.updateMany({
        where: { id: e.id, overdueNotifiedAt: null },
        data: { overdueNotifiedAt: now },
      });
      if (!claim.count) continue;
      const ids = new Set<number>([
        e.creatorId,
        ...(e.assigneeId ? [e.assigneeId] : []),
        ...e.attendees.map((a: any) => a.userId),
      ]);
      await this.notifications.notify({
        userIds: [...ids],
        kind: "TUGAS" as any,
        title: "Peringatan Agenda Overdue",
        text: `Agenda "${e.title}" (${e.number}) telah melewati tenggat waktu dan belum diselesaikan.`,
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
    const project = ev.projectId
      ? await this.db.project.findUnique({
          where: { id: ev.projectId },
          select: { id: true, picId: true, members: { select: { userId: true } } },
        })
      : null;
    return { ...ev, project };
  }

  private canSee(ev: any, user: RequestUser) {
    const inProject =
      ev.project &&
      (ev.project.picId === user.id || (ev.project.members ?? []).some((m: any) => m.userId === user.id));
    if (
      (ev.category === "FINANCE" || ev.category === "TAX") &&
      !this.isFinanceOrTaxAuthorized(user) &&
      ev.creatorId !== user.id &&
      ev.assigneeId !== user.id &&
      !ev.attendees.some((a: any) => a.userId === user.id)
    ) {
      return false;
    }
    return (
      this.isGlobal(user) ||
      ev.creatorId === user.id ||
      ev.assigneeId === user.id ||
      ev.attendees.some((a: any) => a.userId === user.id) ||
      !!inProject ||
      (ev.category === "TAX" && this.isFinanceOrTaxAuthorized(user))
    );
  }

  private canEdit(ev: any, user: RequestUser) {
    return (
      this.isGlobal(user) ||
      ev.creatorId === user.id ||
      ev.assigneeId === user.id ||
      (ev.category === "TAX" && this.isFinanceOrTaxAuthorized(user))
    );
  }

  async get(id: number, user: RequestUser) {
    const ev = await this.load(id);
    if (!this.canSee(ev, user)) throw new ForbiddenException("Tidak punya akses ke agenda ini");
    return { ...ev, editable: this.canEdit(ev, user), routePath: this.resolveManualRoute(ev) };
  }

  async create(dto: CalendarEventDto, user: RequestUser) {
    if (!dto.title || !dto.startDate) throw new BadRequestException("Judul dan tanggal mulai wajib diisi");
    if (dto.category === "TAX" && !this.isFinanceOrTaxAuthorized(user)) {
      throw new ForbiddenException("Hanya Finance, Admin, Bos, atau Super Admin yang berwenang mengatur jadwal kewajiban pajak");
    }
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
        invoiceId: dto.invoiceId ?? null,
        supplierId: dto.supplierId ?? null,
        attendees: dto.attendeeIds?.length
          ? { create: [...new Set(dto.attendeeIds)].map((userId) => ({ userId })) }
          : undefined,
      },
    });
    await this.audit.log({
      actor: user, action: "BUAT_AGENDA", entityType: "calendarEvent", entityId: ev.id,
      detail: `Membuat agenda ${ev.number}: ${ev.title}`,
    });
    const notifyIds = [
      ...new Set(
        [
          ...(dto.remindOnCreate ? [user.id] : []),
          ev.assigneeId,
          ...(dto.attendeeIds ?? []),
        ].filter((x): x is number => !!x && (dto.remindOnCreate || x !== user.id))
      ),
    ];
    if (notifyIds.length) {
      void this.notifications.notify({
        userIds: notifyIds, kind: "TUGAS" as any, title: "Agenda Kerja Baru",
        text: `${user.name} menjadwalkan agenda "${ev.title}" (${ev.number})`, href: "/calendar",
      }).catch(() => undefined);
    }
    return this.get(ev.id, user);
  }

  private async excludeOccurrence(ev: any, occurrenceDate: string) {
    const set = parseExcluded(ev.excludedDates);
    set.add(occurrenceDate.slice(0, 10));
    await this.db.calendarEvent.update({
      where: { id: ev.id },
      data: { excludedDates: JSON.stringify([...set]) },
    });
  }

  async update(id: number, dto: CalendarEventDto, user: RequestUser) {
    const ev = await this.load(id);
    if (!this.canEdit(ev, user)) throw new ForbiddenException("Tidak punya akses mengubah agenda ini");

    // Jika mengedit 1 kejadian tunggal dari seri berulang (PRD 3.4)
    if (ev.recurrence !== "NONE" && dto.occurrenceMode === "single" && dto.occurrenceDate) {
      await this.excludeOccurrence(ev, dto.occurrenceDate);
      const created = await this.create(
        {
          title: dto.title ?? ev.title,
          description: dto.description !== undefined ? dto.description : ev.description ?? undefined,
          category: dto.category ?? ev.category,
          status: dto.status ?? ev.status,
          priority: dto.priority ?? ev.priority,
          startDate: dto.startDate ?? new Date(`${dto.occurrenceDate.slice(0, 10)}T09:00:00+07:00`).toISOString(),
          endDate: dto.endDate !== undefined ? dto.endDate : null,
          isAllDay: dto.isAllDay ?? ev.isAllDay,
          recurrence: "NONE",
          reminderMinutes: dto.reminderMinutes !== undefined ? dto.reminderMinutes : ev.reminderMinutes,
          assigneeId: dto.assigneeId !== undefined ? dto.assigneeId : ev.assigneeId,
          attendeeIds: dto.attendeeIds ?? ev.attendees.map((a: any) => a.userId),
          completionNote: dto.completionNote,
          customerId: dto.customerId !== undefined ? dto.customerId : ev.customerId,
          projectId: dto.projectId !== undefined ? dto.projectId : ev.projectId,
          leadId: dto.leadId !== undefined ? dto.leadId : ev.leadId,
          invoiceId: dto.invoiceId !== undefined ? dto.invoiceId : ev.invoiceId,
          supplierId: dto.supplierId !== undefined ? dto.supplierId : ev.supplierId,
        },
        user,
      );
      await this.audit.log({
        actor: user, action: "PISAH_KEJADIAN_BERULANG", entityType: "calendarEvent", entityId: id,
        detail: `Mengubah kejadian tanggal ${dto.occurrenceDate} dari seri ${ev.number} menjadi agenda tunggal ${created.number}`,
      });
      return created;
    }

    const data: any = {};
    for (const k of [
      "title", "description", "category", "status", "priority", "isAllDay",
      "recurrence", "reminderMinutes", "assigneeId", "completionNote",
      "customerId", "projectId", "leadId", "invoiceId", "supplierId",
    ] as const) {
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
    const note = dto.completionNote ?? dto.note;

    // Jika mengubah status / membatalkan 1 kejadian tunggal dari seri berulang (PRD 3.4)
    if (ev.recurrence !== "NONE" && dto.occurrenceMode === "single" && dto.occurrenceDate) {
      await this.excludeOccurrence(ev, dto.occurrenceDate);
      if (dto.status !== "CANCELLED") {
        const origTime = new Date(ev.startDate.getTime() + 7 * 3600_000).toISOString().slice(11, 16);
        const occStart = new Date(`${dto.occurrenceDate.slice(0, 10)}T${origTime}:00+07:00`);
        const durMs = ev.endDate ? ev.endDate.getTime() - ev.startDate.getTime() : 0;
        await this.create(
          {
            title: ev.title,
            description: ev.description ?? undefined,
            category: ev.category,
            status: dto.status,
            priority: ev.priority,
            startDate: occStart.toISOString(),
            endDate: durMs > 0 ? new Date(occStart.getTime() + durMs).toISOString() : null,
            isAllDay: ev.isAllDay,
            recurrence: "NONE",
            assigneeId: ev.assigneeId,
            attendeeIds: ev.attendees.map((a: any) => a.userId),
            completionNote: note,
            customerId: ev.customerId,
            projectId: ev.projectId,
            leadId: ev.leadId,
            invoiceId: ev.invoiceId,
            supplierId: ev.supplierId,
          },
          user,
        );
      }
      await this.audit.log({
        actor: user, action: "UPDATE_STATUS_KEJADIAN", entityType: "calendarEvent", entityId: id,
        detail: `Mengubah status kejadian ${dto.occurrenceDate} pada seri ${ev.number} menjadi ${dto.status}${note ? ` (${note})` : ""}`,
      });
      return this.get(id, user);
    }

    await this.db.calendarEvent.update({
      where: { id },
      data: { status: dto.status, ...(note !== undefined ? { completionNote: note } : {}) },
    });
    await this.audit.log({
      actor: user, action: "UPDATE_STATUS_AGENDA", entityType: "calendarEvent", entityId: id,
      detail: `Mengubah status agenda ${ev.number} menjadi ${dto.status}${note ? ` (${note})` : ""}`,
    });
    return this.get(id, user);
  }

  async remove(id: number, user: RequestUser, occurrenceDate?: string) {
    const ev = await this.load(id);
    if (!this.canEdit(ev, user)) throw new ForbiddenException("Tidak punya akses menghapus agenda ini");
    if (ev.recurrence !== "NONE" && occurrenceDate) {
      await this.excludeOccurrence(ev, occurrenceDate);
      await this.audit.log({
        actor: user, action: "HAPUS_KEJADIAN_BERULANG", entityType: "calendarEvent", entityId: id,
        detail: `Membatalkan/menghapus kejadian tanggal ${occurrenceDate} dari seri ${ev.number}`,
      });
      return { ok: true, excludedDate: occurrenceDate };
    }
    await this.db.calendarEvent.delete({ where: { id } });
    await this.audit.log({
      actor: user, action: "HAPUS_AGENDA", entityType: "calendarEvent", entityId: id,
      detail: `Menghapus agenda ${ev.number}: ${ev.title}`,
    });
    return { ok: true };
  }
}
