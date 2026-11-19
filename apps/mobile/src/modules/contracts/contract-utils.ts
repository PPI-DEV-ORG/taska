import { Platform, Share } from "react-native";
import { colors, type Tone } from "@/tokens";

export const CONTRACT_STATUS_OPTIONS = [
  { value: "", label: "Semua Status Kontrak" },
  { value: "ACTIVE", label: "Active (Berlaku)" },
  { value: "EXPIRING_SOON", label: "Expiring Soon (Segera Berakhir)" },
  { value: "RENEWAL_PENDING", label: "Renewal Pending (Proses Perpanjangan)" },
  { value: "EXPIRED", label: "Expired (Kedaluwarsa)" },
  { value: "TERMINATED", label: "Terminated (Dihentikan)" },
  { value: "RENEWED", label: "Renewed (Diperpanjang)" },
];

export const APPROVAL_STATUS_OPTIONS = [
  { value: "", label: "Semua Status Approval" },
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING_REVIEW", label: "Pending Review" },
  { value: "PENDING_APPROVAL", label: "Pending Approval" },
  { value: "APPROVED", label: "Approved (Disetujui)" },
  { value: "REVISION_REQUIRED", label: "Revision Required (Perlu Revisi)" },
  { value: "REJECTED", label: "Rejected (Ditolak)" },
  { value: "CANCELLED", label: "Cancelled (Dibatalkan)" },
];

export const COUNTERPARTY_TYPE_OPTIONS = [
  { value: "VENDOR", label: "Vendor / Supplier" },
  { value: "CUSTOMER", label: "Pelanggan / Klien" },
  { value: "THIRD_PARTY", label: "Pihak Ketiga / Mitra" },
  { value: "INTERNAL", label: "Internal / Karyawan" },
];

export const PAYMENT_FREQUENCY_OPTIONS = [
  { value: "ONE_TIME", label: "Sekali Bayar (One-Time)" },
  { value: "MONTHLY", label: "Bulanan (Monthly)" },
  { value: "QUARTERLY", label: "Triwulan (Quarterly)" },
  { value: "SEMI_ANNUAL", label: "Semesteran (Semi-Annual)" },
  { value: "ANNUAL", label: "Tahunan (Annual)" },
  { value: "MILESTONE", label: "Berdasarkan Termin / Milestone" },
  { value: "CUSTOM", label: "Custom" },
];

export const VALUE_TYPE_OPTIONS = [
  { value: "FIXED", label: "Fixed Contract Value" },
  { value: "MONTHLY_RECURRING", label: "Monthly Recurring Fee" },
  { value: "ANNUAL_RECURRING", label: "Annual Contract Value" },
  { value: "ONE_TIME", label: "One-Time Fee" },
  { value: "VARIABLE", label: "Variable Fee" },
  { value: "MILESTONE", label: "Milestone-Based Payment" },
];

export const DOCUMENT_CATEGORY_OPTIONS = [
  { value: "MAIN_CONTRACT", label: "Kontrak Utama" },
  { value: "PURCHASE_AGREEMENT", label: "Purchase Agreement" },
  { value: "SERVICE_AGREEMENT", label: "Service Agreement" },
  { value: "MOU", label: "Memorandum of Understanding (MoU)" },
  { value: "NDA", label: "Non-Disclosure Agreement (NDA)" },
  { value: "ADDENDUM", label: "Addendum / Amandemen" },
  { value: "QUOTATION", label: "Surat Penawaran" },
  { value: "BERITA_ACARA", label: "Berita Acara" },
  { value: "LEGALITY", label: "Dokumen Legalitas Pihak Terkait" },
  { value: "SUPPORTING", label: "Dokumen Pendukung Lainnya" },
];

export const DEPARTMENT_OPTIONS = [
  "IT & Infrastructure",
  "Procurement & Purchasing",
  "Finance & Accounting",
  "Operations & Technical",
  "Project Management",
  "Sales & Marketing",
  "HR & General Affairs",
  "Management / Direksi",
];

export const CONTRACT_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  EXPIRING_SOON: "Expiring Soon",
  RENEWAL_PENDING: "Renewal Pending",
  EXPIRED: "Expired",
  TERMINATED: "Terminated",
  RENEWED: "Renewed",
};

export const APPROVAL_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Pending Review",
  PENDING_APPROVAL: "Pending Approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  REVISION_REQUIRED: "Perlu Revisi",
  CANCELLED: "Cancelled",
};

export const DOCUMENT_CATEGORY_LABEL: Record<string, string> = {
  MAIN_CONTRACT: "Kontrak Utama",
  PURCHASE_AGREEMENT: "Purchase Agreement",
  SERVICE_AGREEMENT: "Service Agreement",
  MOU: "MoU",
  NDA: "NDA",
  ADDENDUM: "Addendum",
  QUOTATION: "Surat Penawaran",
  BERITA_ACARA: "Berita Acara",
  LEGALITY: "Legalitas",
  SUPPORTING: "Pendukung",
};

export const PAYMENT_FREQUENCY_LABEL: Record<string, string> = {
  ONE_TIME: "Sekali Bayar",
  MONTHLY: "Bulanan",
  QUARTERLY: "Triwulan",
  SEMI_ANNUAL: "Semesteran",
  ANNUAL: "Tahunan",
  MILESTONE: "Milestone / Termin",
  CUSTOM: "Custom",
};

export function contractStatusTone(status?: string | null): Tone {
  switch (String(status || "").toUpperCase()) {
    case "ACTIVE":
    case "RENEWED":
      return "success";
    case "EXPIRING_SOON":
    case "RENEWAL_PENDING":
      return "warning";
    case "EXPIRED":
    case "TERMINATED":
      return "danger";
    default:
      return "neutral";
  }
}

export function contractStatusColor(status?: string | null): string {
  const tone = contractStatusTone(status);
  return tone === "success"
    ? colors.success
    : tone === "warning"
      ? colors.warning
      : tone === "danger"
        ? colors.danger
        : colors.muted;
}

export function approvalStatusTone(status?: string | null): Tone {
  switch (String(status || "").toUpperCase()) {
    case "APPROVED":
      return "success";
    case "PENDING_REVIEW":
    case "PENDING_APPROVAL":
    case "REVISION_REQUIRED":
      return "warning";
    case "REJECTED":
    case "CANCELLED":
      return "danger";
    default:
      return "neutral";
  }
}

export function approvalStatusColor(status?: string | null): string {
  const tone = approvalStatusTone(status);
  return tone === "success"
    ? colors.success
    : tone === "warning"
      ? colors.warning
      : tone === "danger"
        ? colors.danger
        : colors.info;
}

export function todayWibIso(): string {
  const wib = new Date(Date.now() + 7 * 3600_000);
  return wib.toISOString().slice(0, 10);
}

export function addMonthsIso(iso: string, months: number): string {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return todayWibIso();
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const next = new Date(Date.UTC(year, month + months, 1));
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next.toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return todayWibIso();
  const dt = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function formatContractCurrency(amount?: number | null, currency = "IDR"): string {
  const val = Number(amount ?? 0);
  if (currency && currency !== "IDR") {
    return `${currency} ${val.toLocaleString("id-ID", { maximumFractionDigits: 2 })}`;
  }
  return `Rp ${Math.round(val).toLocaleString("id-ID")}`;
}

export function expirationDaysLabel(days?: number | null): string {
  if (days === null || days === undefined) return "-";
  if (days < 0) return `Lewat ${Math.abs(days)} hari`;
  if (days === 0) return "Berakhir hari ini";
  return `${days} hari lagi`;
}

export async function exportContractCsv(
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
          const val = row[c.key];
          if (c.type === "date" && val) return esc(String(val).slice(0, 10));
          return esc(val);
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
    link.download = `${safeName}-${todayWibIso()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify("Laporan kontrak berhasil diunduh (.csv)");
    return;
  }
  await Share.share({ title: filename, message: csv });
  notify("Laporan siap dibagikan (.csv)");
}
