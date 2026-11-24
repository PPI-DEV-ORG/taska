import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { WhatsappService } from "./whatsapp.service.js";

const SETTINGS_KEY = "wa_schedule_notification_settings";
const WIB_OFFSET_MS = 7 * 3600_000;

export const DEFAULT_INCLUDED_CATEGORIES = [
  "MEETING",
  "SALES",
  "KUNJUNGAN",
  "MAINTENANCE",
  "POC",
  "SURVEY",
  "PROJECT",
  "TASK",
  "OPERATIONAL",
  "OTHER",
];

export interface WaScheduleNotificationSettings {
  enabled: boolean;
  groupJids: string[];
  groupNames: Record<string, string>;
  dailyEnabled: boolean;
  dailyTime: string; // HH:mm WIB
  dailyTarget: "TOMORROW" | "TODAY";
  weeklyEnabled: boolean;
  weeklyDay: number; // 0=Minggu, 1=Senin, ..., 6=Sabtu
  weeklyTime: string; // HH:mm WIB
  updateNotifyEnabled: boolean;
  updateNotifyOnCreate: boolean;
  updateNotifyOnUpdate: boolean;
  updateNotifyOnCancel: boolean;
  updateCooldownMinutes: number;
  includedCategories: string[];
  skipEmptyRecap: boolean;
}

export const DEFAULT_WA_SCHEDULE_SETTINGS: WaScheduleNotificationSettings = {
  enabled: false,
  groupJids: [],
  groupNames: {},
  dailyEnabled: true,
  dailyTime: "16:00",
  dailyTarget: "TOMORROW",
  weeklyEnabled: true,
  weeklyDay: 6, // Sabtu
  weeklyTime: "16:00",
  updateNotifyEnabled: true,
  updateNotifyOnCreate: true,
  updateNotifyOnUpdate: true,
  updateNotifyOnCancel: true,
  updateCooldownMinutes: 5,
  includedCategories: [...DEFAULT_INCLUDED_CATEGORIES],
  skipEmptyRecap: true,
};

export interface WaAgendaEntry {
  sourceModule: string;
  sourceId: number;
  category: string;
  title: string;
  startDate: Date;
  endDate: Date | null;
  isAllDay: boolean;
  pics: string[];
  companyName: string | null;
  contactPerson: string | null;
  location: string | null;
  notes: string | null;
}

const HARI_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  BOS: "Direktur",
  SALES: "Sales",
  PM: "PM",
  SE: "Presales/SE",
  TEKNISI: "Teknisi",
  FINANCE: "Finance",
  PROCUREMENT: "Procurement",
  GUDANG: "Gudang",
  HR: "HR",
};

export function formatPersonWithRole(name?: string | null, role?: string | null): string | null {
  const n = (name || "").trim();
  if (!n) return null;
  const r = (role || "").toUpperCase();
  const rl = ROLE_LABEL[r];
  return rl ? `${n} (${rl})` : n;
}

export function toWibDate(d: Date): Date {
  return new Date(d.getTime() + WIB_OFFSET_MS);
}

export function wibYmd(d: Date): string {
  return toWibDate(d).toISOString().slice(0, 10);
}

export function wibHm(d: Date): string {
  return toWibDate(d).toISOString().slice(11, 16);
}

export function formatIndoDayDate(ymdStr: string, includeYear = false): string {
  const [y, m, day] = ymdStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y || 2026, (m || 1) - 1, day || 1));
  const hari = HARI_ID[dt.getUTCDay()] ?? "";
  const bulan = BULAN_ID[dt.getUTCMonth()] ?? "";
  return includeYear ? `${hari}, ${day} ${bulan} ${y}` : `${hari}, ${day} ${bulan}`;
}

export function formatIndoPeriod(fromYmd: string, toYmd: string): string {
  const [y1, m1, d1] = fromYmd.split("-").map(Number);
  const [y2, m2, d2] = toYmd.split("-").map(Number);
  const b1 = BULAN_ID[(m1 || 1) - 1] ?? "";
  const b2 = BULAN_ID[(m2 || 1) - 1] ?? "";
  if (y1 === y2 && m1 === m2) {
    return `${d1} – ${d2} ${b1} ${y1}`;
  }
  if (y1 === y2) {
    return `${d1} ${b1} – ${d2} ${b2} ${y1}`;
  }
  return `${d1} ${b1} ${y1} – ${d2} ${b2} ${y2}`;
}

export function wibDayRangeUtc(ymdStr: string): { fromUtc: Date; toUtc: Date } {
  const [y, m, d] = ymdStr.split("-").map(Number);
  const fromUtc = new Date(Date.UTC(y || 2026, (m || 1) - 1, d || 1) - WIB_OFFSET_MS);
  const toUtc = new Date(fromUtc.getTime() + 24 * 3600_000 - 1);
  return { fromUtc, toUtc };
}

export function addDaysYmd(ymdStr: string, days: number): string {
  const [y, m, d] = ymdStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y || 2026, (m || 1) - 1, (d || 1) + days));
  return dt.toISOString().slice(0, 10);
}

/** Menghitung Senin–Minggu minggu depan relatif terhadap tanggal WIB `baseYmd`. */
export function nextWeekRangeYmd(baseYmd: string): { fromYmd: string; toYmd: string } {
  const [y, m, d] = baseYmd.split("-").map(Number);
  const dt = new Date(Date.UTC(y || 2026, (m || 1) - 1, d || 1));
  const dow = dt.getUTCDay(); // 0=Min, 1=Sen, ..., 6=Sab
  const daysToNextMonday = dow === 0 ? 1 : 8 - dow;
  const fromYmd = addDaysYmd(baseYmd, daysToNextMonday);
  const toYmd = addDaysYmd(fromYmd, 6);
  return { fromYmd, toYmd };
}

function formatTimeLine(entry: WaAgendaEntry): string {
  if (entry.isAllDay) return "Sepanjang hari";
  const startHm = wibHm(entry.startDate);
  if (entry.endDate && wibYmd(entry.endDate) === wibYmd(entry.startDate)) {
    const endHm = wibHm(entry.endDate);
    if (endHm !== startHm) return `${startHm} – ${endHm} WIB`;
  }
  return `${startHm} WIB`;
}

function formatEntryLines(entry: WaAgendaEntry): string[] {
  const lines: string[] = [];
  lines.push(`   - Waktu: ${formatTimeLine(entry)}`);
  lines.push(`   - Agenda: ${entry.title}`);
  if (entry.pics.length > 0) {
    lines.push(`   - PIC: ${entry.pics.join(", ")}`);
  }
  if (entry.companyName) {
    lines.push(`   - Perusahaan: ${entry.companyName}`);
  }
  if (entry.contactPerson) {
    lines.push(`   - Contact Person: ${entry.contactPerson}`);
  }
  if (entry.location) {
    lines.push(`   - Lokasi: ${entry.location}`);
  }
  if (entry.notes) {
    const shortNote = entry.notes.replace(/\s+/g, " ").trim().slice(0, 180);
    if (shortNote) lines.push(`   - Keterangan: ${shortNote}`);
  }
  return lines;
}

export function formatRecapMessage(
  heading: string,
  periodLabel: string,
  entries: WaAgendaEntry[],
): string {
  const lines: string[] = [`*${heading}*`, "", `Periode: ${periodLabel}`];

  if (entries.length === 0) {
    lines.push("", "_Tidak ada agenda kegiatan terjadwal pada periode ini._");
    return lines.join("\n");
  }

  const sorted = [...entries].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  lines.push("");
  sorted.forEach((entry, idx) => {
    const dayHeader = formatIndoDayDate(wibYmd(entry.startDate));
    lines.push(`${idx + 1}. *${dayHeader}*`);
    lines.push(...formatEntryLines(entry));
    if (idx < sorted.length - 1) lines.push("");
  });

  lines.push("", "_Dikirim otomatis oleh Akuntra ERP_");
  return lines.join("\n");
}

export function formatEventUpdateMessage(
  action: "CREATED" | "UPDATED" | "CANCELLED",
  entry: WaAgendaEntry,
  actorName?: string | null,
): string {
  const badge =
    action === "CREATED"
      ? "JADWAL KEGIATAN BARU"
      : action === "CANCELLED"
        ? "JADWAL KEGIATAN DIBATALKAN"
        : "PERUBAHAN JADWAL KEGIATAN";

  const dayStr = formatIndoDayDate(wibYmd(entry.startDate), true);
  const lines: string[] = [
    `*${badge}*`,
    "",
    `*${dayStr}*`,
    ...formatEntryLines(entry),
  ];
  if (actorName) {
    lines.push("", `_Diperbarui oleh: ${actorName}_`);
  }
  return lines.join("\n");
}

export function formatEventReminderMessage(
  entry: WaAgendaEntry,
  reminderMinutes?: number | null,
): string {
  const dayStr = formatIndoDayDate(wibYmd(entry.startDate), true);
  let leadLabel = "Segera berlangsung";
  if (typeof reminderMinutes === "number" && reminderMinutes > 0) {
    if (reminderMinutes >= 1440 && reminderMinutes % 1440 === 0) {
      leadLabel = `${reminderMinutes / 1440} hari lagi`;
    } else if (reminderMinutes >= 60 && reminderMinutes % 60 === 0) {
      leadLabel = `${reminderMinutes / 60} jam lagi`;
    } else {
      leadLabel = `${reminderMinutes} menit lagi`;
    }
  }
  const lines: string[] = [
    `*PENGINGAT JADWAL KEGIATAN* (${leadLabel})`,
    "",
    `*${dayStr}*`,
    ...formatEntryLines(entry),
    "",
    "_Pengingat otomatis dari Kalender Akuntra ERP_",
  ];
  return lines.join("\n");
}

function normalizeTime(raw?: string | null, fallback = "16:00"): string {
  const s = String(raw ?? "").trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : fallback;
}

/**
 * Mengonversi nomor HP Indonesia / internasional menjadi JID WhatsApp pribadi (`628xxxx@s.whatsapp.net`).
 * Mendukung input seperti `0812-3456-7890`, `+62 812 3456 7890`, atau `6281234567890@s.whatsapp.net`.
 */
export function normalizePhoneToWaJid(raw?: string | null): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (s.endsWith("@s.whatsapp.net") || s.endsWith("@g.us")) return s;
  let digits = s.replace(/\D+/g, "");
  if (digits.startsWith("0")) {
    digits = `62${digits.slice(1)}`;
  } else if (digits.startsWith("8")) {
    digits = `62${digits}`;
  }
  if (digits.length < 9 || digits.length > 16) return null;
  return `${digits}@s.whatsapp.net`;
}

@Injectable()
export class WhatsappScheduleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsappScheduleService.name);
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;
  /** Cooldown map untuk mencegah spam saat 1 agenda diedit berkali-kali. */
  private readonly updateCooldownMap = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly wa: WhatsappService,
  ) {}

  private get db(): any {
    return this.prisma.main;
  }

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.tickScheduler();
    }, 60_000);
    // Jalankan cek awal 20 detik setelah boot (memberi waktu socket WA tersambung)
    setTimeout(() => {
      void this.tickScheduler();
    }, 20_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async getSettings(): Promise<WaScheduleNotificationSettings> {
    try {
      const row = await this.db.systemSetting.findUnique({ where: { key: SETTINGS_KEY } });
      if (!row?.value) return { ...DEFAULT_WA_SCHEDULE_SETTINGS };
      const parsed = JSON.parse(row.value);
      return {
        ...DEFAULT_WA_SCHEDULE_SETTINGS,
        ...parsed,
        groupJids: Array.isArray(parsed.groupJids)
          ? parsed.groupJids.map(String).filter((x: string) => x.trim().length > 0)
          : [],
        groupNames: parsed.groupNames && typeof parsed.groupNames === "object" ? parsed.groupNames : {},
        includedCategories: Array.isArray(parsed.includedCategories) && parsed.includedCategories.length > 0
          ? parsed.includedCategories.map(String)
          : [...DEFAULT_INCLUDED_CATEGORIES],
        dailyTime: normalizeTime(parsed.dailyTime, "16:00"),
        weeklyTime: normalizeTime(parsed.weeklyTime, "16:00"),
        weeklyDay: Number.isInteger(parsed.weeklyDay) && parsed.weeklyDay >= 0 && parsed.weeklyDay <= 6
          ? parsed.weeklyDay
          : 6,
        updateCooldownMinutes: Math.max(0, Math.min(120, Number(parsed.updateCooldownMinutes ?? 5) || 0)),
      };
    } catch {
      return { ...DEFAULT_WA_SCHEDULE_SETTINGS };
    }
  }

  async saveSettings(patch: Partial<WaScheduleNotificationSettings>): Promise<WaScheduleNotificationSettings> {
    const current = await this.getSettings();
    const next: WaScheduleNotificationSettings = {
      ...current,
      ...patch,
      groupJids: patch.groupJids !== undefined
        ? [...new Set(patch.groupJids.map((x) => String(x).trim()).filter(Boolean))]
        : current.groupJids,
      groupNames: patch.groupNames !== undefined ? patch.groupNames : current.groupNames,
      dailyTime: patch.dailyTime !== undefined ? normalizeTime(patch.dailyTime, current.dailyTime) : current.dailyTime,
      weeklyTime: patch.weeklyTime !== undefined ? normalizeTime(patch.weeklyTime, current.weeklyTime) : current.weeklyTime,
      weeklyDay: patch.weeklyDay !== undefined
        ? Math.max(0, Math.min(6, Math.round(Number(patch.weeklyDay))))
        : current.weeklyDay,
      updateCooldownMinutes: patch.updateCooldownMinutes !== undefined
        ? Math.max(0, Math.min(120, Math.round(Number(patch.updateCooldownMinutes) || 0)))
        : current.updateCooldownMinutes,
      includedCategories: patch.includedCategories !== undefined
        ? [...new Set(patch.includedCategories.map((x) => String(x).trim().toUpperCase()).filter(Boolean))]
        : current.includedCategories,
    };

    await this.db.systemSetting.upsert({
      where: { key: SETTINGS_KEY },
      create: {
        key: SETTINGS_KEY,
        value: JSON.stringify(next),
        description: "Pengaturan notifikasi jadwal kegiatan ke WhatsApp Group",
      },
      update: {
        value: JSON.stringify(next),
      },
    });
    return next;
  }

  private async broadcastText(targetJids: string[], text: string): Promise<{ sent: number; failed: string[] }> {
    const uniqueJids = [...new Set(targetJids.map((x) => x.trim()).filter(Boolean))];
    if (uniqueJids.length === 0) {
      throw new BadRequestException("Belum ada grup WhatsApp tujuan yang dipilih");
    }
    if (!this.wa.isConnected()) {
      throw new BadRequestException("Bot WhatsApp belum terhubung. Silakan scan QR terlebih dahulu.");
    }
    let sent = 0;
    const failed: string[] = [];
    for (const jid of uniqueJids) {
      try {
        await this.wa.sendMessage(jid, text);
        sent += 1;
      } catch (err: any) {
        this.logger.warn(`Gagal kirim pesan WA ke ${jid}: ${err?.message}`);
        failed.push(jid);
      }
    }
    return { sent, failed };
  }

  private mapCalendarEventToEntry(ev: any): WaAgendaEntry {
    const pics: string[] = [];
    const mainPic = formatPersonWithRole(ev.assignee?.name, ev.assignee?.role);
    if (mainPic) pics.push(mainPic);
    for (const a of ev.attendees ?? []) {
      const label = formatPersonWithRole(a.user?.name, a.user?.role);
      if (label && !pics.includes(label)) pics.push(label);
    }
    if (pics.length === 0) {
      const creatorPic = formatPersonWithRole(ev.creator?.name, ev.creator?.role);
      if (creatorPic) pics.push(creatorPic);
    }

    const companyName =
      (ev.companyName || "").trim() ||
      ev.customer?.company ||
      ev.customer?.name ||
      ev.lead?.company ||
      ev.supplier?.name ||
      null;

    const contactPerson =
      (ev.contactPerson || "").trim() ||
      ev.customer?.pic ||
      ev.lead?.pic ||
      null;

    const location = (ev.location || "").trim() || ev.customer?.address || null;

    return {
      sourceModule: "calendar",
      sourceId: ev.id,
      category: String(ev.category || "MEETING"),
      title: String(ev.title || "Agenda"),
      startDate: new Date(ev.startDate),
      endDate: ev.endDate ? new Date(ev.endDate) : null,
      isAllDay: !!ev.isAllDay,
      pics,
      companyName: companyName ? String(companyName) : null,
      contactPerson: contactPerson ? String(contactPerson) : null,
      location: location ? String(location) : null,
      notes: ev.description ? String(ev.description) : null,
    };
  }

  async collectAgendaEntries(
    fromUtc: Date,
    toUtc: Date,
    includedCategories: string[],
  ): Promise<WaAgendaEntry[]> {
    const catSet = new Set(includedCategories.map((c) => c.toUpperCase()));
    const entries: WaAgendaEntry[] = [];

    const [calEvents, visits, maintenances, pocs, surveys] = await Promise.all([
      this.db.calendarEvent.findMany({
        where: {
          status: { notIn: ["CANCELLED", "COMPLETED"] },
          startDate: { gte: fromUtc, lte: toUtc },
        },
        include: {
          creator: { select: { name: true, role: true } },
          assignee: { select: { name: true, role: true } },
          attendees: { include: { user: { select: { name: true, role: true } } } },
          customer: { select: { name: true, company: true, pic: true, address: true } },
          lead: { select: { company: true, pic: true } },
          supplier: { select: { name: true } },
        },
        orderBy: { startDate: "asc" },
      }),
      catSet.has("KUNJUNGAN")
        ? this.db.visitReport.findMany({
            where: {
              date: { gte: fromUtc, lte: toUtc },
              status: { notIn: ["Cancelled", "Batal", "Completed", "Selesai"] },
            },
            include: {
              owner: { select: { name: true, role: true } },
              members: { include: { user: { select: { name: true, role: true } } } },
              customer: { select: { name: true, company: true, pic: true, address: true } },
              lead: { select: { company: true, pic: true } },
            },
            orderBy: { date: "asc" },
          })
        : [],
      catSet.has("MAINTENANCE")
        ? this.db.maintenanceReport.findMany({
            where: {
              startDate: { gte: fromUtc, lte: toUtc },
              status: { notIn: ["Cancelled", "Batal", "Completed", "Selesai"] },
            },
            include: {
              owner: { select: { name: true, role: true } },
              members: { include: { user: { select: { name: true, role: true } } } },
              customer: { select: { name: true, company: true, pic: true, address: true } },
              lead: { select: { company: true, pic: true } },
            },
            orderBy: { startDate: "asc" },
          })
        : [],
      catSet.has("POC")
        ? this.db.pocReport.findMany({
            where: {
              date: { gte: fromUtc, lte: toUtc },
              status: { notIn: ["Cancelled", "Batal", "Completed", "Selesai"] },
            },
            include: {
              owner: { select: { name: true, role: true } },
              members: { include: { user: { select: { name: true, role: true } } } },
              customer: { select: { name: true, company: true, pic: true, address: true } },
              lead: { select: { company: true, pic: true } },
            },
            orderBy: { date: "asc" },
          })
        : [],
      catSet.has("SURVEY")
        ? this.db.survey.findMany({
            where: {
              scheduleAt: { gte: fromUtc, lte: toUtc },
              status: { notIn: ["DITOLAK", "SELESAI"] },
            },
            include: {
              requester: { select: { name: true, role: true } },
              members: { include: { user: { select: { name: true, role: true } } } },
              lead: { select: { company: true, pic: true } },
            },
            orderBy: { scheduleAt: "asc" },
          })
        : [],
    ]);

    for (const ev of calEvents) {
      if (!catSet.has(String(ev.category || "").toUpperCase())) continue;
      entries.push(this.mapCalendarEventToEntry(ev));
    }

    for (const v of visits) {
      const pics: string[] = [];
      const o = formatPersonWithRole(v.owner?.name, v.owner?.role);
      if (o) pics.push(o);
      for (const m of v.members ?? []) {
        const l = formatPersonWithRole(m.user?.name, m.user?.role);
        if (l && !pics.includes(l)) pics.push(l);
      }
      entries.push({
        sourceModule: "visits",
        sourceId: v.id,
        category: "KUNJUNGAN",
        title: v.title || "Kunjungan / Visit",
        startDate: new Date(v.date),
        endDate: v.endDate ? new Date(v.endDate) : null,
        isAllDay: true,
        pics,
        companyName: v.clientName || v.customer?.company || v.customer?.name || v.lead?.company || null,
        contactPerson: v.clientContact || v.customer?.pic || v.lead?.pic || null,
        location: v.location || v.customer?.address || null,
        notes: v.purpose || v.description || null,
      });
    }

    for (const m of maintenances) {
      const pics: string[] = [];
      const o = formatPersonWithRole(m.owner?.name, m.owner?.role);
      if (o) pics.push(o);
      for (const mem of m.members ?? []) {
        const l = formatPersonWithRole(mem.user?.name, mem.user?.role);
        if (l && !pics.includes(l)) pics.push(l);
      }
      entries.push({
        sourceModule: "maintenance",
        sourceId: m.id,
        category: "MAINTENANCE",
        title: m.title || "Maintenance",
        startDate: new Date(m.startDate),
        endDate: m.endDate ? new Date(m.endDate) : null,
        isAllDay: true,
        pics,
        companyName: m.clientName || m.customer?.company || m.customer?.name || m.lead?.company || null,
        contactPerson: m.clientContact || m.customer?.pic || m.lead?.pic || null,
        location: m.location || m.customer?.address || null,
        notes: m.purpose || m.description || null,
      });
    }

    for (const p of pocs) {
      const pics: string[] = [];
      const o = formatPersonWithRole(p.owner?.name, p.owner?.role);
      if (o) pics.push(o);
      for (const mem of p.members ?? []) {
        const l = formatPersonWithRole(mem.user?.name, mem.user?.role);
        if (l && !pics.includes(l)) pics.push(l);
      }
      entries.push({
        sourceModule: "poc",
        sourceId: p.id,
        category: "POC",
        title: p.title || "POC / Demo",
        startDate: new Date(p.date),
        endDate: p.endDate ? new Date(p.endDate) : null,
        isAllDay: true,
        pics,
        companyName: p.clientName || p.customer?.company || p.customer?.name || p.lead?.company || null,
        contactPerson: p.customer?.pic || p.lead?.pic || null,
        location: p.location || p.customer?.address || null,
        notes: p.description || null,
      });
    }

    for (const s of surveys) {
      if (!s.scheduleAt) continue;
      const pics: string[] = [];
      for (const mem of s.members ?? []) {
        const l = formatPersonWithRole(mem.user?.name, mem.user?.role);
        if (l && !pics.includes(l)) pics.push(l);
      }
      if (pics.length === 0) {
        const req = formatPersonWithRole(s.requester?.name, s.requester?.role);
        if (req) pics.push(req);
      }
      entries.push({
        sourceModule: "survey",
        sourceId: s.id,
        category: "SURVEY",
        title: s.need ? `Survey: ${s.need}` : "Survey Lokasi",
        startDate: new Date(s.scheduleAt),
        endDate: null,
        isAllDay: false,
        pics,
        companyName: s.lead?.company || null,
        contactPerson: s.lead?.pic || null,
        location: s.location || null,
        notes: s.notes || null,
      });
    }

    return entries.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }

  private async loadCalendarEventForWa(eventId: number) {
    return this.db.calendarEvent.findUnique({
      where: { id: eventId },
      include: {
        creator: { select: { name: true, role: true, phone: true } },
        assignee: { select: { name: true, role: true, phone: true } },
        attendees: { include: { user: { select: { name: true, role: true, phone: true } } } },
        customer: { select: { name: true, company: true, pic: true, address: true } },
        lead: { select: { company: true, pic: true } },
        supplier: { select: { name: true } },
      },
    });
  }

  private resolveEventTargetJids(
    ev: any,
    settings: WaScheduleNotificationSettings,
    overrideTargetJid?: string,
    includeGlobalGroupFallback = false,
  ): string[] {
    if (overrideTargetJid?.trim()) {
      const normalized = normalizePhoneToWaJid(overrideTargetJid);
      return normalized ? [normalized] : [overrideTargetJid.trim()];
    }

    const targets: string[] = [];
    const targetType = String(ev.whatsappTargetType || "GROUP").toUpperCase();
    const wantsGroup = targetType === "GROUP" || targetType === "BOTH";
    const wantsPersonal = targetType === "PERSONAL" || targetType === "BOTH";

    if (wantsGroup || includeGlobalGroupFallback) {
      if (ev.whatsappGroupJid) {
        targets.push(String(ev.whatsappGroupJid).trim());
      } else {
        targets.push(...settings.groupJids);
      }
    }

    if (wantsPersonal) {
      const explicitRaw = String(ev.whatsappPhone ?? "").trim();
      if (explicitRaw) {
        for (const part of explicitRaw.split(/[,;\n]+/)) {
          const jid = normalizePhoneToWaJid(part);
          if (jid) targets.push(jid);
        }
      } else {
        const candidatePhones = [
          ev.assignee?.phone,
          ev.creator?.phone,
          ...((ev.attendees ?? []).map((a: any) => a.user?.phone)),
        ];
        for (const p of candidatePhones) {
          const jid = normalizePhoneToWaJid(p);
          if (jid) targets.push(jid);
        }
      }
    }

    return [...new Set(targets.filter(Boolean))];
  }

  /**
   * Dipanggil oleh CalendarService saat agenda dibuat, diperbarui, atau dibatalkan.
   * Mengirim ke grup WA dan/atau WA pribadi jika:
   * - Event memiliki `notifyWhatsapp = true`, ATAU
   * - Pengaturan global `enabled && updateNotifyEnabled` aktif & kategori termasuk `includedCategories`.
   */
  async notifyCalendarEventChange(
    action: "CREATED" | "UPDATED" | "CANCELLED",
    eventId: number,
    actorName?: string | null,
    snapshot?: any,
  ): Promise<void> {
    try {
      if (!this.wa.isConnected()) return;
      const settings = await this.getSettings();
      const ev = snapshot ?? (await this.loadCalendarEventForWa(eventId));
      if (!ev) return;

      const forceEventWa = !!ev.notifyWhatsapp;
      const globalAllows =
        settings.enabled &&
        settings.updateNotifyEnabled &&
        settings.includedCategories.includes(String(ev.category || "").toUpperCase()) &&
        ((action === "CREATED" && settings.updateNotifyOnCreate) ||
          (action === "UPDATED" && settings.updateNotifyOnUpdate) ||
          (action === "CANCELLED" && settings.updateNotifyOnCancel));

      if (!forceEventWa && !globalAllows) return;

      // Anti-spam cooldown untuk action UPDATED
      if (action === "UPDATED" && settings.updateCooldownMinutes > 0) {
        const key = `ev-${ev.id}`;
        const lastMs = this.updateCooldownMap.get(key) ?? 0;
        const nowMs = Date.now();
        if (nowMs - lastMs < settings.updateCooldownMinutes * 60_000) {
          return;
        }
        this.updateCooldownMap.set(key, nowMs);
      }

      const targetJids = forceEventWa
        ? this.resolveEventTargetJids(ev, settings, undefined, globalAllows)
        : settings.groupJids;
      if (targetJids.length === 0) return;

      const entry = this.mapCalendarEventToEntry(ev);
      const message = formatEventUpdateMessage(action, entry, actorName);
      await this.broadcastText(targetJids, message);
    } catch (err: any) {
      this.logger.warn(`Gagal mengirim notifikasi update jadwal WA (#${eventId}): ${err?.message}`);
    }
  }

  /**
   * Dipanggil oleh scheduler pengingat CalendarService ketika `event.notifyWhatsapp = true`
   * dan waktu pengingat sebelum acara tercapai.
   */
  async sendEventReminder(eventId: number, targetStart?: Date): Promise<boolean> {
    try {
      if (!this.wa.isConnected()) return false;
      const settings = await this.getSettings();
      const ev = await this.loadCalendarEventForWa(eventId);
      if (!ev || !ev.notifyWhatsapp) return false;

      const targetJids = this.resolveEventTargetJids(ev, settings);
      if (targetJids.length === 0) return false;

      const entry = this.mapCalendarEventToEntry(ev);
      if (targetStart) entry.startDate = targetStart;
      const message = formatEventReminderMessage(entry, ev.reminderMinutes);
      const res = await this.broadcastText(targetJids, message);
      return res.sent > 0;
    } catch (err: any) {
      this.logger.warn(`Gagal mengirim pengingat WA untuk agenda #${eventId}: ${err?.message}`);
      return false;
    }
  }

  async sendSingleEventNow(eventId: number, overrideGroupJid?: string) {
    const settings = await this.getSettings();
    const ev = await this.loadCalendarEventForWa(eventId);
    if (!ev) throw new BadRequestException("Agenda tidak ditemukan");

    const targetJids = this.resolveEventTargetJids(ev, settings, overrideGroupJid);
    if (targetJids.length === 0) {
      throw new BadRequestException(
        String(ev.whatsappTargetType || "").toUpperCase() === "PERSONAL"
          ? "Nomor WhatsApp pribadi belum diisi dan tidak ditemukan di profil PIC/peserta"
          : "Belum ada tujuan WhatsApp (grup atau nomor pribadi) yang dikonfigurasi",
      );
    }

    const entry = this.mapCalendarEventToEntry(ev);
    const message = formatEventReminderMessage(entry, null);
    const res = await this.broadcastText(targetJids, message);
    return { ...res, message };
  }

  async sendManual(type: "TEST" | "DAILY" | "WEEKLY", overrideGroupJid?: string) {
    const settings = await this.getSettings();
    const targetJids = overrideGroupJid?.trim()
      ? [overrideGroupJid.trim()]
      : settings.groupJids;

    const now = new Date();
    const todayWib = wibYmd(now);

    if (type === "TEST") {
      const text =
        `*TES NOTIFIKASI GRUP AKUNTRA ERP*\n\n` +
        `Bot WhatsApp berhasil terhubung dan siap mengirimkan rekap jadwal kegiatan ke grup ini.\n` +
        `Waktu tes: ${formatIndoDayDate(todayWib, true)}, ${wibHm(now)} WIB`;
      const res = await this.broadcastText(targetJids, text);
      return { ...res, type, preview: text };
    }

    if (type === "DAILY") {
      const targetYmd = settings.dailyTarget === "TODAY" ? todayWib : addDaysYmd(todayWib, 1);
      const { fromUtc, toUtc } = wibDayRangeUtc(targetYmd);
      const entries = await this.collectAgendaEntries(fromUtc, toUtc, settings.includedCategories);
      const heading = settings.dailyTarget === "TODAY" ? "AGENDA KEGIATAN HARI INI" : "AGENDA KEGIATAN BESOK";
      const text = formatRecapMessage(heading, formatIndoDayDate(targetYmd, true), entries);
      const res = await this.broadcastText(targetJids, text);
      return { ...res, type, count: entries.length, preview: text };
    }

    // WEEKLY
    const { fromYmd, toYmd } = nextWeekRangeYmd(todayWib);
    const { fromUtc } = wibDayRangeUtc(fromYmd);
    const { toUtc } = wibDayRangeUtc(toYmd);
    const entries = await this.collectAgendaEntries(fromUtc, toUtc, settings.includedCategories);
    const text = formatRecapMessage("AGENDA KEGIATAN MINGGU DEPAN", formatIndoPeriod(fromYmd, toYmd), entries);
    const res = await this.broadcastText(targetJids, text);
    return { ...res, type, count: entries.length, preview: text };
  }

  private async tickScheduler() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      if (!this.wa.isConnected()) return;
      const settings = await this.getSettings();
      if (!settings.enabled || settings.groupJids.length === 0) return;

      const now = new Date();
      const wib = toWibDate(now);
      const todayWib = wib.toISOString().slice(0, 10);
      const currentHm = wib.toISOString().slice(11, 16);
      const currentDow = wib.getUTCDay(); // 0=Minggu .. 6=Sabtu

      // 1. Daily Schedule
      if (settings.dailyEnabled && currentHm >= settings.dailyTime) {
        const lockKey = `wa_sched_daily_sent_${todayWib}`;
        const existing = await this.db.systemSetting.findUnique({ where: { key: lockKey } });
        if (!existing) {
          await this.db.systemSetting.upsert({
            where: { key: lockKey },
            create: { key: lockKey, value: now.toISOString(), description: "Daily WA recap sent" },
            update: {},
          });
          try {
            const targetYmd = settings.dailyTarget === "TODAY" ? todayWib : addDaysYmd(todayWib, 1);
            const { fromUtc, toUtc } = wibDayRangeUtc(targetYmd);
            const entries = await this.collectAgendaEntries(fromUtc, toUtc, settings.includedCategories);
            if (!settings.skipEmptyRecap || entries.length > 0) {
              const heading = settings.dailyTarget === "TODAY" ? "AGENDA KEGIATAN HARI INI" : "AGENDA KEGIATAN BESOK";
              const text = formatRecapMessage(heading, formatIndoDayDate(targetYmd, true), entries);
              await this.broadcastText(settings.groupJids, text);
              this.logger.log(`Rekap WA Harian terkirim (${entries.length} agenda)`);
            }
          } catch (err: any) {
            await this.db.systemSetting.delete({ where: { key: lockKey } }).catch(() => undefined);
            this.logger.warn(`Gagal kirim rekap WA Harian: ${err?.message}`);
          }
        }
      }

      // 2. Weekly Schedule
      if (settings.weeklyEnabled && currentDow === settings.weeklyDay && currentHm >= settings.weeklyTime) {
        const lockKey = `wa_sched_weekly_sent_${todayWib}`;
        const existing = await this.db.systemSetting.findUnique({ where: { key: lockKey } });
        if (!existing) {
          await this.db.systemSetting.upsert({
            where: { key: lockKey },
            create: { key: lockKey, value: now.toISOString(), description: "Weekly WA recap sent" },
            update: {},
          });
          try {
            const { fromYmd, toYmd } = nextWeekRangeYmd(todayWib);
            const { fromUtc } = wibDayRangeUtc(fromYmd);
            const { toUtc } = wibDayRangeUtc(toYmd);
            const entries = await this.collectAgendaEntries(fromUtc, toUtc, settings.includedCategories);
            if (!settings.skipEmptyRecap || entries.length > 0) {
              const text = formatRecapMessage(
                "AGENDA KEGIATAN MINGGU DEPAN",
                formatIndoPeriod(fromYmd, toYmd),
                entries,
              );
              await this.broadcastText(settings.groupJids, text);
              this.logger.log(`Rekap WA Mingguan terkirim (${entries.length} agenda)`);
            }
          } catch (err: any) {
            await this.db.systemSetting.delete({ where: { key: lockKey } }).catch(() => undefined);
            this.logger.warn(`Gagal kirim rekap WA Mingguan: ${err?.message}`);
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`Error pada scheduler WA jadwal: ${err?.message}`);
    } finally {
      this.ticking = false;
    }
  }
}
