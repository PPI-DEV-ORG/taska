export const BILLING_MONTHS: Record<string, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUAL: 6,
  ANNUAL: 12,
  BIENNIAL: 24,
  CUSTOM: 12,
};

export const REMINDER_OFFSETS: Record<string, number> = {
  "H-30": 30,
  "H-14": 14,
  "H-7": 7,
  "H-3": 3,
  "H-1": 1,
  "H+1": -1,
};

export function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function startOfDay(value: Date | string): Date {
  const d = new Date(value);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addMonths(value: Date | string, months: number): Date {
  const d = startOfDay(value);
  const day = d.getDate();
  const next = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next;
}

export function addDays(value: Date | string, days: number): Date {
  const d = startOfDay(value);
  d.setDate(d.getDate() + days);
  return d;
}

export function monthsBetween(start: Date | string, end: Date | string): number {
  const a = startOfDay(start);
  const b = startOfDay(end);
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() >= a.getDate()) months += 1;
  return Math.max(1, months);
}

export function resolveBillingMonths(
  cycle: string | null | undefined,
  start?: Date | string | null,
  end?: Date | string | null,
): number {
  if (cycle === "CUSTOM" && start && end) return monthsBetween(start, end);
  return BILLING_MONTHS[String(cycle ?? "ANNUAL").toUpperCase()] ?? 12;
}

export function computeMrcArc(
  cost: number,
  cycle: string | null | undefined,
  start?: Date | string | null,
  end?: Date | string | null,
): { months: number; mrc: number; arc: number } {
  const months = resolveBillingMonths(cycle, start, end);
  const mrc = round2(Number(cost || 0) / months);
  return { months, mrc, arc: round2(mrc * 12) };
}

export function addCycle(
  start: Date | string,
  cycle: string | null | undefined,
  customEnd?: Date | string | null,
): Date {
  if (cycle === "CUSTOM" && customEnd) return startOfDay(customEnd);
  return addDays(addMonths(start, resolveBillingMonths(cycle)), -1);
}

export function nextCode(prefix: string, year: number, lastCode?: string | null): string {
  const stem = `${prefix}-${year}-`;
  let seq = 1;
  if (lastCode && String(lastCode).startsWith(stem)) {
    const parsed = Number.parseInt(String(lastCode).slice(stem.length), 10);
    if (Number.isFinite(parsed)) seq = parsed + 1;
  }
  return `${stem}${String(seq).padStart(5, "0")}`;
}

export function normalizePercentages(
  allocations: Array<{ department: string; percentage: number; projectId?: number | null }> | undefined,
  fallbackDepartment: string,
): Array<{ department: string; percentage: number; projectId?: number | null }> {
  const cleaned = (allocations ?? [])
    .filter((row) => String(row.department ?? "").trim().length > 0)
    .map((row) => ({
      department: String(row.department).trim(),
      percentage: round2(Number(row.percentage) || 0),
      projectId: row.projectId ?? null,
    }));
  if (cleaned.length === 0) {
    return [{ department: fallbackDepartment, percentage: 100, projectId: null }];
  }
  return cleaned;
}

export function allocationTotal(
  allocations: Array<{ percentage: number }> | undefined,
): number {
  return round2((allocations ?? []).reduce((sum, row) => sum + (Number(row.percentage) || 0), 0));
}

export function buildPrepaidRows(
  start: Date | string,
  end: Date | string,
  totalAmount: number,
): Array<{ periodYear: number; periodMonth: number; allocationDate: Date; amount: number }> {
  const from = startOfDay(start);
  const to = startOfDay(end);
  const months = monthsBetween(from, to);
  const total = round2(Number(totalAmount) || 0);
  const base = round2(total / months);
  const rows: Array<{ periodYear: number; periodMonth: number; allocationDate: Date; amount: number }> = [];
  let allocated = 0;
  for (let i = 0; i < months; i += 1) {
    const date = addMonths(from, i);
    const amount = i === months - 1 ? round2(total - allocated) : base;
    allocated = round2(allocated + amount);
    rows.push({
      periodYear: date.getFullYear(),
      periodMonth: date.getMonth() + 1,
      allocationDate: date,
      amount,
    });
  }
  return rows;
}

export function reminderOffsetForDate(
  nextRenewalDate: Date | string,
  asOfDate: Date | string = new Date(),
): string | null {
  const renewal = startOfDay(nextRenewalDate).getTime();
  const today = startOfDay(asOfDate).getTime();
  const diff = Math.round((renewal - today) / 86_400_000);
  for (const [type, offset] of Object.entries(REMINDER_OFFSETS)) {
    if (diff === offset) return type;
  }
  return null;
}

export function daysUntil(value: Date | string, asOfDate: Date | string = new Date()): number {
  return Math.round(
    (startOfDay(value).getTime() - startOfDay(asOfDate).getTime()) / 86_400_000,
  );
}

export function formatPeriodLabel(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
