/**
 * Aturan bisnis, kalkulasi KPI, generator kode, dan penanganan tanggal aman timezone
 * untuk Modul Maintenance Management (EAM / CMMS).
 */

export function round2(value: number | string | null | undefined): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/**
 * Mengonversi input tanggal menjadi Date UTC murni (YYYY-MM-DDT00:00:00.000Z)
 * agar tidak pernah bergeser -1 hari pada server dengan timezone Asia/Jakarta (GMT+7).
 */
export function dateOnly(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return null;
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, "0");
    const d = String(val.getUTCDate()).padStart(2, "0");
    return new Date(`${y}-${m}-${d}T00:00:00.000Z`);
  }
  const s = String(val).trim();
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
  }
  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return null;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return new Date(`${y}-${m}-${d}T00:00:00.000Z`);
}

/**
 * Mengembalikan tanggal hari ini (UTC midnight).
 */
export function todayUtc(): Date {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return new Date(`${y}-${m}-${d}T00:00:00.000Z`);
}

/**
 * Menambahkan interval hari/minggu/bulan/tahun ke tanggal dasar UTC.
 */
export function addInterval(baseDate: Date, value: number, unit: string): Date {
  const result = new Date(baseDate.getTime());
  const u = (unit || "MONTHS").toUpperCase();
  const val = Number(value) || 1;

  if (u === "DAYS" || u === "DAY") {
    result.setUTCDate(result.getUTCDate() + val);
  } else if (u === "WEEKS" || u === "WEEK") {
    result.setUTCDate(result.getUTCDate() + val * 7);
  } else if (u === "YEARS" || u === "YEAR") {
    result.setUTCFullYear(result.getUTCFullYear() + val);
  } else {
    // Default MONTHS
    result.setUTCMonth(result.getUTCMonth() + val);
  }

  const y = result.getUTCFullYear();
  const m = String(result.getUTCMonth() + 1).padStart(2, "0");
  const d = String(result.getUTCDate()).padStart(2, "0");
  return new Date(`${y}-${m}-${d}T00:00:00.000Z`);
}

/**
 * Menghasilkan daftar tanggal servis berkala berdasarkan horizon (1 Siklus, 3 Bulan, 6 Bulan, 1 Tahun).
 */
export function generateScheduleDates(
  startDate: Date,
  intervalValue: number,
  intervalUnit: string,
  horizon: string = "NEXT_CYCLE",
): Date[] {
  const dates: Date[] = [];
  const base = dateOnly(startDate) || todayUtc();
  const u = (intervalUnit || "MONTHS").toUpperCase();
  const val = Math.max(1, Number(intervalValue) || 1);

  if (horizon === "NEXT_CYCLE") {
    dates.push(addInterval(base, val, u));
    return dates;
  }

  let limitMonths = 12;
  if (horizon === "3_MONTHS") limitMonths = 3;
  else if (horizon === "6_MONTHS") limitMonths = 6;
  else if (horizon === "1_YEAR") limitMonths = 12;

  const endDate = new Date(base.getTime());
  endDate.setUTCMonth(endDate.getUTCMonth() + limitMonths);

  let current = addInterval(base, val, u);
  let guard = 0;
  while (current.getTime() <= endDate.getTime() && guard < 60) {
    dates.push(current);
    current = addInterval(current, val, u);
    guard++;
  }

  if (dates.length === 0) {
    dates.push(addInterval(base, val, u));
  }
  return dates;
}

/**
 * Parsing daftar hari pengingat (contoh input: "14,7,3,1" -> [14, 7, 3, 1])
 */
export function parseReminderLeadDays(raw?: string | null): number[] {
  if (!raw) return [7, 3, 1];
  return raw
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n) && n >= 0)
    .sort((a, b) => b - a);
}

/**
 * Generator nomor dokumen berurutan per tahun.
 */
export function formatSequence(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(5, "0")}`;
}

export const WORK_ORDER_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_FOR_PARTS",
  "WAITING_FOR_VENDOR",
  "COMPLETED",
  "VERIFIED",
  "CLOSED",
  "CANCELLED",
] as const;

export const WORK_ORDER_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export const MAINTENANCE_TYPES = ["PREVENTIVE", "CORRECTIVE"] as const;

export const MAINTENANCE_METHODS = [
  "CALENDAR_BASED",
  "USAGE_BASED",
  "CONDITION_BASED",
  "MANUAL",
] as const;

export const COST_COMPONENTS = [
  "SPARE_PART",
  "LABOR",
  "EXTERNAL_SERVICE",
  "TRANSPORTATION",
  "OTHER",
] as const;
