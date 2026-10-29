import { colors } from "@/tokens";

export type CalendarView = "month" | "week" | "day" | "agenda";

export type CalItem = {
  key: string;
  eventNumber?: string | null;
  sourceModule: string;
  sourceId: number;
  title: string;
  subtitle?: string | null;
  category: string;
  start: string;
  end: string | null;
  occurrenceDate?: string;
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
  completionNote?: string | null;
  hasConflict?: boolean;
  conflictWith?: string | null;
};

export const CATEGORY_META: Record<string, { label: string; color: string }> = {
  MEETING: { label: "Meeting", color: colors.info },
  SALES: { label: "Sales & CRM", color: "#38BDF8" },
  KUNJUNGAN: { label: "Kunjungan", color: "#2DD4BF" },
  POC: { label: "POC & Demo", color: "#A78BFA" },
  SURVEY: { label: "Survey", color: colors.warning },
  PROJECT: { label: "Project", color: colors.primary },
  TASK: { label: "Tugas", color: colors.success },
  FINANCE: { label: "Keuangan", color: colors.danger },
  TAX: { label: "Pajak", color: "#F472B6" },
  PROCUREMENT: { label: "Procurement", color: "#60A5FA" },
  OPERATIONAL: { label: "Operasional", color: "#94A3B8" },
  OTHER: { label: "Lainnya", color: "#9CA3AF" },
};

export const CATEGORY_KEYS = Object.keys(CATEGORY_META);
export const MANUAL_CATEGORY_KEYS = [
  "MEETING", "SALES", "KUNJUNGAN", "POC", "SURVEY", "PROJECT", "TASK",
  "FINANCE", "TAX", "PROCUREMENT", "OPERATIONAL", "OTHER",
];

export const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  PENDING: "Pending",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};
export const STATUS_KEYS = Object.keys(STATUS_LABEL);

export const PRIORITY_LABEL: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const RECURRENCE_LABEL: Record<string, string> = {
  NONE: "Tidak berulang",
  DAILY: "Harian (Daily)",
  WEEKLY: "Mingguan (Weekly)",
  MONTHLY: "Bulanan (Monthly)",
  YEARLY: "Tahunan (Yearly)",
};

export const REMINDER_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Tanpa pengingat", value: null },
  { label: "Pada tanggal deadline / saat acara", value: 0 },
  { label: "1 jam sebelum deadline", value: 60 },
  { label: "1 hari sebelum deadline", value: 1440 },
  { label: "3 hari sebelum deadline", value: 4320 },
  { label: "Interval khusus (Custom)", value: -1 },
];

export const TEAM_FILTER_OPTIONS: { label: string; code: string }[] = [
  { label: "Semua Tim", code: "" },
  { label: "Sales", code: "SALES" },
  { label: "Project Manager", code: "PM" },
  { label: "Teknisi", code: "TEKNISI" },
  { label: "Software Engineer", code: "SE" },
  { label: "Procurement", code: "PROCUREMENT" },
  { label: "Finance", code: "FINANCE" },
  { label: "Gudang", code: "GUDANG" },
  { label: "HR", code: "HR" },
];

export const HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
export const BULAN_PANJANG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const p2 = (n: number) => String(n).padStart(2, "0");

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Senin sebagai awal minggu. */
export function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7;
  return addDays(x, -dow);
}

/** Kunci tanggal WIB dari ISO (UTC). */
export function wibKey(iso: string): string {
  return new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

export function wibTime(iso: string): string {
  return new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(11, 16);
}

export function toIsoWib(dateStr: string, timeStr: string): string {
  const t = /^\d{2}:\d{2}$/.test(timeStr) ? timeStr : "00:00";
  return new Date(`${dateStr}T${t}:00+07:00`).toISOString();
}

/** Daftar tanggal yang dilewati item (untuk item multi-hari). */
export function daysOf(item: CalItem): string[] {
  const s = wibKey(item.start);
  const e = item.end ? wibKey(item.end) : s;
  if (e <= s) return [s];
  const out: string[] = [];
  let cur = parseYmd(s);
  const last = parseYmd(e);
  let guard = 0;
  while (cur <= last && guard++ < 62) {
    out.push(ymd(cur));
    cur = addDays(cur, 1);
  }
  return out;
}

export function groupByDay(items: CalItem[]): Record<string, CalItem[]> {
  const map: Record<string, CalItem[]> = {};
  for (const it of items) {
    for (const k of daysOf(it)) (map[k] ??= []).push(it);
  }
  for (const k of Object.keys(map)) map[k]!.sort((a, b) => a.start.localeCompare(b.start));
  return map;
}

export function statusLabel(it: { status: string; isOverdue: boolean }): string {
  return it.isOverdue ? "OVERDUE" : STATUS_LABEL[it.status] ?? it.status;
}
