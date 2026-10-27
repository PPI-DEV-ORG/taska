export type TabType =
  | "my-attendance"
  | "team-attendance"
  | "payroll"
  | "payroll-history"
  | "config";

export function formatRupiah(num: number | string | null | undefined): string {
  const n = typeof num === "number" ? num : Number(num) || 0;
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

export function formatPeriodLabel(period: string): string {
  if (!period) return "-";
  const [y, m] = period.split("-");
  if (!y || !m) return period;
  const monthNames = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  const mIdx = parseInt(m, 10) - 1;
  const name = monthNames[mIdx] || m;
  return `${name} ${y}`;
}

