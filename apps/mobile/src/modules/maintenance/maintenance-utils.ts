import { Platform } from "react-native";

export function formatRupiah(value: number | string | null | undefined): string {
  const num = Math.round(Number(value) || 0);
  return `Rp ${num.toLocaleString("id-ID")}`;
}

export function formatDate(val?: string | Date | null): string {
  if (!val) return "-";
  try {
    const s = typeof val === "string" ? val : val.toISOString();
    const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = match[1];
      const monthIndex = parseInt(match[2]!, 10) - 1;
      const day = match[3];
      const months = [
        "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
        "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
      ];
      return `${day} ${months[monthIndex]} ${year}`;
    }
    const d = new Date(val);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "-";
  }
}

export function formatDateTime(val?: string | Date | null): string {
  if (!val) return "-";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

export const WO_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  DRAFT: { label: "Draft", bg: "#f5f5f4", text: "#57534e" },
  PENDING_APPROVAL: { label: "Menunggu Persetujuan", bg: "#fef3c7", text: "#d97706" },
  APPROVED: { label: "Disetujui", bg: "#dcfce7", text: "#16a34a" },
  ASSIGNED: { label: "Ditugaskan", bg: "#ffedd5", text: "#ea580c" },
  IN_PROGRESS: { label: "Dikerjakan", bg: "#fed7aa", text: "#ea580c" },
  WAITING_FOR_PARTS: { label: "Menunggu Spare Part", bg: "#fef9c3", text: "#ca8a04" },
  WAITING_FOR_VENDOR: { label: "Menunggu Vendor", bg: "#f3e8ff", text: "#9333ea" },
  COMPLETED: { label: "Selesai", bg: "#ccfbf1", text: "#0d9488" },
  VERIFIED: { label: "Terverifikasi", bg: "#dcfce7", text: "#16a34a" },
  CLOSED: { label: "Ditutup", bg: "#f5f5f4", text: "#44403c" },
  CANCELLED: { label: "Dibatalkan", bg: "#fee2e2", text: "#dc2626" },
};

export const PRIORITY_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  LOW: { label: "Rendah", bg: "#f5f5f4", text: "#57534e" },
  MEDIUM: { label: "Sedang", bg: "#ffedd5", text: "#ea580c" },
  HIGH: { label: "Tinggi", bg: "#fed7aa", text: "#c2410c" },
  CRITICAL: { label: "Kritis", bg: "#fee2e2", text: "#dc2626" },
};

export const SCHEDULE_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  SCHEDULED: { label: "Terjadwal", bg: "#ffedd5", text: "#ea580c" },
  COMPLETED: { label: "Selesai", bg: "#dcfce7", text: "#16a34a" },
  OVERDUE: { label: "Terlambat (Overdue)", bg: "#fee2e2", text: "#dc2626" },
  CANCELLED: { label: "Dibatalkan", bg: "#f5f5f4", text: "#78716c" },
};

export const ASSET_CONDITION_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  GOOD: { label: "Baik (Good)", bg: "#dcfce7", text: "#16a34a" },
  FAIR: { label: "Cukup (Fair)", bg: "#fef3c7", text: "#d97706" },
  UNDER_REPAIR: { label: "Dalam Servis (Under Repair)", bg: "#fed7aa", text: "#ea580c" },
  POOR: { label: "Buruk (Poor)", bg: "#fee2e2", text: "#dc2626" },
  DAMAGED: { label: "Rusak (Damaged)", bg: "#ef4444", text: "#ffffff" },
};

/**
 * Ekspor data ke format CSV dan trigger download di browser web.
 */
export function exportMaintenanceReportCsv(
  filename: string,
  columns: { header: string; key: string }[],
  data: any[],
) {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    return;
  }

  const headerRow = columns.map((c) => `"${c.header.replace(/"/g, '""')}"`).join(",");
  const dataRows = data.map((row) =>
    columns
      .map((c) => {
        const val = row[c.key];
        if (val === null || val === undefined) return '""';
        return `"${String(val).replace(/"/g, '""')}"`;
      })
      .join(","),
  );

  const csvContent = [headerRow, ...dataRows].join("\r\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
