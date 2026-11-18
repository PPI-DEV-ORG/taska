import { Platform, Share } from "react-native";
import { colors, type Tone } from "@/tokens";

export const BILLING_CYCLE_OPTIONS = [
  { value: "MONTHLY", label: "Bulanan (Monthly)", months: 1 },
  { value: "QUARTERLY", label: "Triwulan (Quarterly)", months: 3 },
  { value: "SEMI_ANNUAL", label: "Semesteran (Semi-Annual)", months: 6 },
  { value: "ANNUAL", label: "Tahunan (Annual)", months: 12 },
  { value: "BIENNIAL", label: "Dua Tahunan (Biennial)", months: 24 },
  { value: "CUSTOM", label: "Custom", months: 12 },
] as const;

export const SUBSCRIPTION_STATUS_OPTIONS = [
  { value: "", label: "Semua Status" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "RENEWAL_DUE", label: "Segera Renewal" },
  { value: "RENEWAL_PENDING", label: "Menunggu Renewal" },
  { value: "PENDING_APPROVAL", label: "Menunggu Persetujuan" },
  { value: "SUSPENDED", label: "Ditangguhkan" },
  { value: "EXPIRED", label: "Kedaluwarsa" },
  { value: "CANCELLATION_PENDING", label: "Proses Pembatalan" },
  { value: "CANCELLED", label: "Dibatalkan" },
  { value: "DRAFT", label: "Draft" },
];

export const PAYMENT_STATUS_OPTIONS = [
  { value: "", label: "Semua Pembayaran" },
  { value: "UNPAID", label: "Belum dibayar" },
  { value: "PARTIALLY_PAID", label: "Dibayar sebagian" },
  { value: "PAID", label: "Lunas" },
  { value: "OVERDUE", label: "Terlambat" },
  { value: "CANCELLED", label: "Dibatalkan" },
  { value: "REFUNDED", label: "Refund" },
];

export const CYCLE_LABEL: Record<string, string> = {
  MONTHLY: "Bulanan",
  QUARTERLY: "Triwulan",
  SEMI_ANNUAL: "Semesteran",
  ANNUAL: "Tahunan",
  BIENNIAL: "Dua Tahunan",
  CUSTOM: "Custom",
};

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Menunggu Persetujuan",
  ACTIVE: "Aktif",
  RENEWAL_DUE: "Segera Renewal",
  RENEWAL_PENDING: "Menunggu Renewal",
  SUSPENDED: "Ditangguhkan",
  EXPIRED: "Kedaluwarsa",
  CANCELLATION_PENDING: "Proses Pembatalan",
  CANCELLED: "Dibatalkan",
};

export const PAYMENT_LABEL: Record<string, string> = {
  UNPAID: "Belum dibayar",
  PARTIALLY_PAID: "Dibayar sebagian",
  PAID: "Lunas",
  OVERDUE: "Terlambat",
  CANCELLED: "Dibatalkan",
  REFUNDED: "Refund",
};

export const DOCUMENT_TYPE_OPTIONS = [
  { value: "CONTRACT", label: "Kontrak / Perjanjian" },
  { value: "INVOICE", label: "Invoice" },
  { value: "RECEIPT", label: "Bukti Pembayaran" },
  { value: "LICENSE", label: "Lisensi / Sertifikat" },
  { value: "PROOF", label: "Dokumen Pendukung" },
  { value: "CONFIRMATION", label: "Konfirmasi Renewal" },
];

export const UTILIZATION_OPTIONS = [
  { value: "OPTIMAL", label: "Optimal" },
  { value: "UNDERUTILIZED", label: "Kurang optimal" },
  { value: "ACTIVE_BUT_UNUSED", label: "Aktif tetapi tidak dipakai" },
  { value: "OVER_CAPACITY", label: "Melebihi kapasitas" },
  { value: "PENDING_REVIEW", label: "Belum direview" },
];

export const CHANGE_TYPE_LABEL: Record<string, string> = {
  UPGRADE: "Upgrade",
  DOWNGRADE: "Downgrade",
  PRICE_ADJUSTMENT: "Penyesuaian Harga",
};

export function statusTone(status: string): Tone {
  switch (String(status || "").toUpperCase()) {
    case "ACTIVE":
      return "success";
    case "RENEWAL_DUE":
    case "RENEWAL_PENDING":
    case "PENDING_APPROVAL":
    case "CANCELLATION_PENDING":
      return "warning";
    case "EXPIRED":
    case "SUSPENDED":
    case "CANCELLED":
      return "danger";
    default:
      return "neutral";
  }
}

export function statusColor(status: string): string {
  const tone = statusTone(status);
  return tone === "success"
    ? colors.success
    : tone === "warning"
      ? colors.warning
      : tone === "danger"
        ? colors.danger
        : tone === "info"
          ? colors.info
          : colors.muted;
}

export function paymentTone(status: string): Tone {
  switch (String(status || "").toUpperCase()) {
    case "PAID":
      return "success";
    case "PARTIALLY_PAID":
    case "UNPAID":
      return "warning";
    case "OVERDUE":
    case "CANCELLED":
      return "danger";
    default:
      return "neutral";
  }
}

export function paymentColor(status: string): string {
  const tone = paymentTone(status);
  return tone === "success"
    ? colors.success
    : tone === "warning"
      ? colors.warning
      : tone === "danger"
        ? colors.danger
        : colors.muted;
}

export function todayIso(): string {
  const d = new Date();
  return isoDate(d);
}

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseIso(value?: string | null): Date {
  if (value && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [y, m, d] = value.slice(0, 10).split("-").map(Number);
    if (y && m && d) return new Date(y, m - 1, d);
  }
  return new Date();
}

export function addMonthsIso(value: string, months: number): string {
  const d = parseIso(value);
  const day = d.getDate();
  const next = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, last));
  return isoDate(next);
}

export function addDaysIso(value: string, days: number): string {
  const d = parseIso(value);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

export function cycleMonths(cycle: string): number {
  return BILLING_CYCLE_OPTIONS.find((x) => x.value === cycle)?.months ?? 12;
}

export function cycleEndDate(start: string, cycle: string): string {
  return addDaysIso(addMonthsIso(start, cycleMonths(cycle)), -1);
}

export function monthsBetweenIso(start?: string | null, end?: string | null): number {
  if (!start || !end) return cycleMonths("ANNUAL");
  const a = parseIso(start);
  const b = parseIso(end);
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() >= a.getDate()) months += 1;
  return Math.max(1, months);
}

export function mrcFor(cost: number, cycle: string, start?: string | null, end?: string | null): number {
  const months = cycle === "CUSTOM" ? monthsBetweenIso(start, end) : cycleMonths(cycle);
  return Math.round((Number(cost || 0) / months) * 100) / 100;
}

export function cycleText(cycle: string): string {
  return CYCLE_LABEL[cycle] ?? cycle;
}

export function daysLabel(days?: number | null): string {
  if (days == null) return "-";
  if (days < 0) return `Terlambat ${Math.abs(days)} hari`;
  if (days === 0) return "Hari ini";
  if (days <= 7) return `${days} hari lagi`;
  if (days <= 30) return `${days} hari lagi`;
  return `${days} hari lagi`;
}

export function formatCurrency(n?: number | null, currency = "IDR"): string {
  const value = Number(n ?? 0);
  if (currency !== "IDR") {
    return `${currency} ${value.toLocaleString("id-ID", { maximumFractionDigits: 2 })}`;
  }
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function exportSubscriptionCsv(
  filename: string,
  columns: Array<{ key: string; label: string; type?: string }>,
  rows: Record<string, any>[],
  notify: (message: string, tone?: any) => void,
): Promise<void> {
  const esc = (value: unknown) => {
    const text = value == null ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  const lines = [
    columns.map((c) => esc(c.label)).join(","),
    ...rows.map((row) =>
      columns
        .map((c) => {
          const value = row[c.key];
          if (c.type === "date" && value) return esc(String(value).slice(0, 10));
          if (typeof value === "boolean") return esc(value ? "Ya" : "Tidak");
          return esc(value);
        })
        .join(","),
    ),
  ];
  const csv = "\uFEFF" + lines.join("\n");
  const safeName = filename.replace(/[^a-zA-Z0-9_-]/g, "_");
  if (Platform.OS === "web") {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeName}-${todayIso()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify("Laporan berhasil diunduh (.csv)");
    return;
  }
  await Share.share({ title: filename, message: csv });
  notify("Laporan siap dibagikan (.csv)");
}
