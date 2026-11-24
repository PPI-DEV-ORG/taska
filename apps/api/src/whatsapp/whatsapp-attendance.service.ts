import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { WhatsappService } from "./whatsapp.service.js";
import {
  formatIndoDayDate,
  formatPersonWithRole,
  toWibDate,
  wibHm,
  wibYmd,
} from "./whatsapp-schedule.service.js";

const SETTINGS_KEY = "wa_attendance_notification_settings";

export interface WaAttendanceNotificationSettings {
  enabled: boolean;
  groupJids: string[];
  groupNames: Record<string, string>;
  recapEnabled: boolean;
  recapTime: string; // HH:mm WIB (misal 09:15)
  checkoutReminderEnabled: boolean;
  checkoutReminderTime: string; // HH:mm WIB (misal 17:15)
  workingDays: number[]; // 0=Minggu .. 6=Sabtu (default [1,2,3,4,5])
  excludedRoles: string[]; // role yang tidak dimasukkan ke daftar belum absen
}

export const DEFAULT_WA_ATTENDANCE_SETTINGS: WaAttendanceNotificationSettings = {
  enabled: false,
  groupJids: [],
  groupNames: {},
  recapEnabled: true,
  recapTime: "09:15",
  checkoutReminderEnabled: true,
  checkoutReminderTime: "17:15",
  workingDays: [1, 2, 3, 4, 5],
  excludedRoles: [],
};

export interface WaAttendancePresentItem {
  name: string;
  role?: string | null;
  checkInTime: string; // HH:mm WIB
  checkOutTime?: string | null; // HH:mm WIB
  locationStatus?: string | null;
  notes?: string | null;
  lateMinutes?: number | null;
}

export interface WaAttendanceAbsentItem {
  name: string;
  role?: string | null;
  status?: string | null; // IZIN, SAKIT, CUTI, atau belum absen
}

function normalizeTime(raw?: string | null, fallback = "09:15"): string {
  const s = String(raw ?? "").trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : fallback;
}

function locationTag(status?: string | null): string | null {
  switch ((status || "").toUpperCase()) {
    case "DI_KANTOR":
      return "Kantor";
    case "LUAR_KANTOR_DINAS":
      return "Lapangan";
    case "DI_LUAR_RADIUS":
      return "Remote/Luar Kantor";
    default:
      return null;
  }
}

export function formatAttendanceRecapMessage(
  dateYmd: string,
  present: WaAttendancePresentItem[],
  absent: WaAttendanceAbsentItem[],
): string {
  const dayLabel = formatIndoDayDate(dateYmd, true);
  const lines: string[] = [
    "*REKAP ABSENSI HARIAN*",
    `Tanggal: ${dayLabel}`,
    "",
    `*Sudah Hadir (${present.length}):*`,
  ];

  if (present.length === 0) {
    lines.push("- Belum ada personel yang melakukan Check-In.");
  } else {
    present.forEach((p, idx) => {
      const who = formatPersonWithRole(p.name, p.role) || p.name;
      const extras: string[] = [];
      const loc = locationTag(p.locationStatus);
      if (loc) extras.push(loc);
      if (p.lateMinutes && p.lateMinutes > 0) extras.push(`Telat ${p.lateMinutes}m`);
      if (p.notes) {
        const shortNote = p.notes.replace(/\s+/g, " ").trim().slice(0, 70);
        if (shortNote) extras.push(shortNote);
      }
      const suffix = extras.length ? ` · ${extras.join(" | ")}` : "";
      lines.push(`${idx + 1}. ${who} — ${p.checkInTime} WIB${suffix}`);
    });
  }

  lines.push("", `*Belum Absen (${absent.length}):*`);
  if (absent.length === 0) {
    lines.push("- Semua personel sudah melakukan absensi.");
  } else {
    absent.forEach((a, idx) => {
      const who = formatPersonWithRole(a.name, a.role) || a.name;
      const st = a.status && a.status !== "BELUM_ABSEN" ? ` (${a.status})` : "";
      lines.push(`${idx + 1}. ${who}${st}`);
    });
  }

  lines.push("", "_Rekap otomatis oleh Akuntra ERP_");
  return lines.join("\n");
}

export function formatCheckoutReminderMessage(
  dateYmd: string,
  pendingCheckout: WaAttendancePresentItem[],
): string {
  const dayLabel = formatIndoDayDate(dateYmd, true);
  const lines: string[] = [
    "*REMINDER TUTUP ABSEN (CHECK-OUT)*",
    `Tanggal: ${dayLabel}`,
    "",
  ];

  if (pendingCheckout.length === 0) {
    lines.push("Seluruh personel yang hadir hari ini sudah melakukan Check-Out. Terima kasih!");
  } else {
    lines.push(
      `Jam kerja telah berakhir. Mohon segera melakukan *Check-Out* di Akuntra ERP bagi personel berikut (${pendingCheckout.length}):`,
    );
    pendingCheckout.forEach((p, idx) => {
      const who = formatPersonWithRole(p.name, p.role) || p.name;
      lines.push(`${idx + 1}. ${who} — Masuk ${p.checkInTime} WIB`);
    });
  }

  lines.push("", "_Pengingat otomatis oleh Akuntra ERP_");
  return lines.join("\n");
}

@Injectable()
export class WhatsappAttendanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsappAttendanceService.name);
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;

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
    setTimeout(() => {
      void this.tickScheduler();
    }, 25_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async getSettings(): Promise<WaAttendanceNotificationSettings> {
    try {
      const row = await this.db.systemSetting.findUnique({ where: { key: SETTINGS_KEY } });
      if (!row?.value) return { ...DEFAULT_WA_ATTENDANCE_SETTINGS };
      const parsed = JSON.parse(row.value);
      return {
        ...DEFAULT_WA_ATTENDANCE_SETTINGS,
        ...parsed,
        groupJids: Array.isArray(parsed.groupJids)
          ? parsed.groupJids.map(String).filter((x: string) => x.trim().length > 0)
          : [],
        groupNames: parsed.groupNames && typeof parsed.groupNames === "object" ? parsed.groupNames : {},
        recapTime: normalizeTime(parsed.recapTime, "09:15"),
        checkoutReminderTime: normalizeTime(parsed.checkoutReminderTime, "17:15"),
        workingDays:
          Array.isArray(parsed.workingDays) && parsed.workingDays.length > 0
            ? parsed.workingDays.map(Number).filter((d: number) => Number.isInteger(d) && d >= 0 && d <= 6)
            : [1, 2, 3, 4, 5],
        excludedRoles: Array.isArray(parsed.excludedRoles)
          ? parsed.excludedRoles.map((r: unknown) => String(r).toUpperCase())
          : [],
      };
    } catch {
      return { ...DEFAULT_WA_ATTENDANCE_SETTINGS };
    }
  }

  async saveSettings(
    patch: Partial<WaAttendanceNotificationSettings>,
  ): Promise<WaAttendanceNotificationSettings> {
    const current = await this.getSettings();
    const next: WaAttendanceNotificationSettings = {
      ...current,
      ...patch,
      groupJids:
        patch.groupJids !== undefined
          ? [...new Set(patch.groupJids.map((x) => String(x).trim()).filter(Boolean))]
          : current.groupJids,
      groupNames: patch.groupNames !== undefined ? patch.groupNames : current.groupNames,
      recapTime: patch.recapTime !== undefined ? normalizeTime(patch.recapTime, current.recapTime) : current.recapTime,
      checkoutReminderTime:
        patch.checkoutReminderTime !== undefined
          ? normalizeTime(patch.checkoutReminderTime, current.checkoutReminderTime)
          : current.checkoutReminderTime,
      workingDays:
        patch.workingDays !== undefined
          ? [...new Set(patch.workingDays.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
          : current.workingDays,
      excludedRoles:
        patch.excludedRoles !== undefined
          ? [...new Set(patch.excludedRoles.map((r) => String(r).trim().toUpperCase()).filter(Boolean))]
          : current.excludedRoles,
    };

    await this.db.systemSetting.upsert({
      where: { key: SETTINGS_KEY },
      create: {
        key: SETTINGS_KEY,
        value: JSON.stringify(next),
        description: "Pengaturan notifikasi rekap & reminder absensi ke WhatsApp Group",
      },
      update: { value: JSON.stringify(next) },
    });
    return next;
  }

  private async broadcastText(targetJids: string[], text: string) {
    const uniqueJids = [...new Set(targetJids.map((x) => x.trim()).filter(Boolean))];
    if (uniqueJids.length === 0) {
      throw new BadRequestException("Belum ada grup WhatsApp tujuan absensi yang dipilih");
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
        this.logger.warn(`Gagal kirim notifikasi absensi WA ke ${jid}: ${err?.message}`);
        failed.push(jid);
      }
    }
    return { sent, failed };
  }

  async collectTodayAttendance(dateYmd: string, excludedRoles: string[]) {
    const dateObj = new Date(`${dateYmd}T00:00:00.000Z`);
    const excludedSet = new Set(excludedRoles.map((r) => r.toUpperCase()));

    const [users, rows] = await Promise.all([
      this.db.user.findMany({
        where: { status: "AKTIF" },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      }),
      this.db.attendance.findMany({
        where: { date: dateObj },
        select: {
          userId: true,
          checkIn: true,
          checkOut: true,
          status: true,
          notes: true,
          checkInLocationStatus: true,
          lateMinutes: true,
          verificationStatus: true,
        },
      }),
    ]);

    const attByUser = new Map<number, any>();
    for (const r of rows) attByUser.set(r.userId, r);

    const present: WaAttendancePresentItem[] = [];
    const absent: WaAttendanceAbsentItem[] = [];
    const pendingCheckout: WaAttendancePresentItem[] = [];

    for (const u of users) {
      if (excludedSet.has(String(u.role || "").toUpperCase())) continue;
      const att = attByUser.get(u.id);
      if (att && att.checkIn && att.verificationStatus !== "DITOLAK") {
        const item: WaAttendancePresentItem = {
          name: u.name,
          role: u.role,
          checkInTime: wibHm(new Date(att.checkIn)),
          checkOutTime: att.checkOut ? wibHm(new Date(att.checkOut)) : null,
          locationStatus: att.checkInLocationStatus,
          notes: att.notes,
          lateMinutes: att.lateMinutes,
        };
        present.push(item);
        if (!att.checkOut) {
          pendingCheckout.push(item);
        }
      } else {
        absent.push({
          name: u.name,
          role: u.role,
          status: att?.status && att.status !== "HADIR" ? att.status : "BELUM_ABSEN",
        });
      }
    }

    present.sort((a, b) => a.checkInTime.localeCompare(b.checkInTime));
    pendingCheckout.sort((a, b) => a.checkInTime.localeCompare(b.checkInTime));
    return { present, absent, pendingCheckout };
  }

  async sendManual(type: "RECAP" | "CHECKOUT_REMINDER" | "TEST", overrideGroupJid?: string) {
    const settings = await this.getSettings();
    const targetJids = overrideGroupJid?.trim()
      ? [overrideGroupJid.trim()]
      : settings.groupJids;

    const now = new Date();
    const todayWib = wibYmd(now);

    if (type === "TEST") {
      const text =
        `*TES NOTIFIKASI ABSENSI AKUNTRA ERP*\n\n` +
        `Bot WhatsApp siap mengirimkan rekap kehadiran harian dan reminder tutup absen (Check-Out) ke grup ini.\n` +
        `Waktu tes: ${formatIndoDayDate(todayWib, true)}, ${wibHm(now)} WIB`;
      const res = await this.broadcastText(targetJids, text);
      return { ...res, type, preview: text };
    }

    const { present, absent, pendingCheckout } = await this.collectTodayAttendance(
      todayWib,
      settings.excludedRoles,
    );

    if (type === "RECAP") {
      const text = formatAttendanceRecapMessage(todayWib, present, absent);
      const res = await this.broadcastText(targetJids, text);
      return { ...res, type, presentCount: present.length, absentCount: absent.length, preview: text };
    }

    const text = formatCheckoutReminderMessage(todayWib, pendingCheckout);
    const res = await this.broadcastText(targetJids, text);
    return { ...res, type, pendingCount: pendingCheckout.length, preview: text };
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
      const currentDow = wib.getUTCDay();

      if (!settings.workingDays.includes(currentDow)) return;

      // 1. Rekap Kehadiran Harian
      if (settings.recapEnabled && currentHm >= settings.recapTime) {
        const lockKey = `wa_att_recap_sent_${todayWib}`;
        const existing = await this.db.systemSetting.findUnique({ where: { key: lockKey } });
        if (!existing) {
          await this.db.systemSetting.upsert({
            where: { key: lockKey },
            create: { key: lockKey, value: now.toISOString(), description: "Daily WA attendance recap sent" },
            update: {},
          });
          try {
            const { present, absent } = await this.collectTodayAttendance(todayWib, settings.excludedRoles);
            const text = formatAttendanceRecapMessage(todayWib, present, absent);
            await this.broadcastText(settings.groupJids, text);
            this.logger.log(`Rekap Absensi WA terkirim (Hadir: ${present.length}, Belum: ${absent.length})`);
          } catch (err: any) {
            await this.db.systemSetting.delete({ where: { key: lockKey } }).catch(() => undefined);
            this.logger.warn(`Gagal kirim rekap absensi WA: ${err?.message}`);
          }
        }
      }

      // 2. Reminder Tutup Absen (Check-Out)
      if (settings.checkoutReminderEnabled && currentHm >= settings.checkoutReminderTime) {
        const lockKey = `wa_att_checkout_sent_${todayWib}`;
        const existing = await this.db.systemSetting.findUnique({ where: { key: lockKey } });
        if (!existing) {
          await this.db.systemSetting.upsert({
            where: { key: lockKey },
            create: { key: lockKey, value: now.toISOString(), description: "Daily WA checkout reminder sent" },
            update: {},
          });
          try {
            const { pendingCheckout } = await this.collectTodayAttendance(todayWib, settings.excludedRoles);
            if (pendingCheckout.length > 0) {
              const text = formatCheckoutReminderMessage(todayWib, pendingCheckout);
              await this.broadcastText(settings.groupJids, text);
              this.logger.log(`Reminder Check-Out WA terkirim (${pendingCheckout.length} personel belum pulang)`);
            }
          } catch (err: any) {
            await this.db.systemSetting.delete({ where: { key: lockKey } }).catch(() => undefined);
            this.logger.warn(`Gagal kirim reminder Check-Out WA: ${err?.message}`);
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`Error pada scheduler WA absensi: ${err?.message}`);
    } finally {
      this.ticking = false;
    }
  }
}
