export const DEFAULT_CONTRACT_TYPES = [
  {
    code: "VENDOR",
    name: "Vendor Contract",
    description: "Kontrak pembelian barang/jasa dan kerja sama dengan supplier/vendor",
    isSystem: true,
  },
  {
    code: "CUSTOMER",
    name: "Customer Contract",
    description: "Kontrak penjualan dan perjanjian kerja sama dengan pelanggan",
    isSystem: true,
  },
  {
    code: "SERVICE",
    name: "Service Agreement",
    description: "Perjanjian penyediaan layanan dan SLA (Service Level Agreement)",
    isSystem: true,
  },
  {
    code: "MAINTENANCE",
    name: "Maintenance Agreement",
    description: "Kontrak pemeliharaan perangkat, CCTV, server, dan dukungan teknis",
    isSystem: true,
  },
  {
    code: "RENTAL",
    name: "Rental Agreement",
    description: "Kontrak sewa kendaraan, gedung, kantor, atau peralatan",
    isSystem: true,
  },
  {
    code: "SOFTWARE_LICENSE",
    name: "Software License Agreement",
    description: "Kontrak lisensi software dan hak guna perangkat lunak",
    isSystem: true,
  },
  {
    code: "CLOUD_HOSTING",
    name: "Cloud & Hosting Agreement",
    description: "Perjanjian layanan VPS, Cloud Hosting, Email Hosting, dan infrastruktur",
    isSystem: true,
  },
  {
    code: "PARTNERSHIP",
    name: "Partnership Agreement",
    description: "Perjanjian kerja sama bisnis, kemitraan, dan distribusi",
    isSystem: true,
  },
  {
    code: "EMPLOYMENT",
    name: "Employment Agreement",
    description: "Perjanjian kerja karyawan, tenaga ahli, dan kontrak teknisi",
    isSystem: true,
  },
  {
    code: "NDA",
    name: "NDA (Non-Disclosure Agreement)",
    description: "Perjanjian kerahasiaan informasi bisnis dan teknis",
    isSystem: true,
  },
  {
    code: "PROJECT",
    name: "Project Contract",
    description: "Kontrak pelaksanaan proyek dan instalasi dengan pelanggan atau subkontraktor",
    isSystem: true,
  },
  {
    code: "OTHER",
    name: "Other",
    description: "Perjanjian dan kontrak operasional lainnya",
    isSystem: true,
  },
] as const;

export const DEFAULT_EXPIRATION_RULES = [
  { daysOffset: 90, triggerCode: "H-90", label: "H-90 — Informasi awal kontrak akan berakhir", targetRole: "PROCUREMENT" },
  { daysOffset: 60, triggerCode: "H-60", label: "H-60 — Persiapan evaluasi kontrak", targetRole: "PM" },
  { daysOffset: 30, triggerCode: "H-30", label: "H-30 — Permintaan keputusan renewal / terminasi", targetRole: "FINANCE" },
  { daysOffset: 14, triggerCode: "H-14", label: "H-14 — Follow-up approval perpanjangan kontrak", targetRole: "ADMIN" },
  { daysOffset: 7, triggerCode: "H-7", label: "H-7 — Pengingat mendesak sebelum kontrak berakhir", targetRole: "BOS" },
  { daysOffset: 1, triggerCode: "H-1", label: "H-1 — Pengingat terakhir masa berlaku kontrak", targetRole: "BOS" },
  { daysOffset: -1, triggerCode: "H+1", label: "H+1 — Kontrak sudah melewati tanggal berakhir", targetRole: "BOS" },
] as const;

export function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/**
 * Mengonversi input tanggal menjadi Date UTC murni (YYYY-MM-DDT00:00:00.000Z)
 * agar tidak pernah bergeser -1 hari pada server dengan timezone GMT+7 (Asia/Jakarta).
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
  // Gunakan tanggal WIB (UTC+7) jika string ISO memiliki komponen waktu
  const wib = new Date(parsed.getTime() + 7 * 3600_000);
  const y = wib.getUTCFullYear();
  const m = String(wib.getUTCMonth() + 1).padStart(2, "0");
  const d = String(wib.getUTCDate()).padStart(2, "0");
  return new Date(`${y}-${m}-${d}T00:00:00.000Z`);
}

/**
 * Menghasilkan tanggal hari ini menurut zona waktu WIB (Asia/Jakarta, UTC+7)
 * dalam bentuk Date UTC midnight (YYYY-MM-DDT00:00:00.000Z).
 */
export function todayWibDateOnly(now: Date = new Date()): Date {
  const wib = new Date(now.getTime() + 7 * 3600_000);
  const y = wib.getUTCFullYear();
  const m = String(wib.getUTCMonth() + 1).padStart(2, "0");
  const d = String(wib.getUTCDate()).padStart(2, "0");
  return new Date(`${y}-${m}-${d}T00:00:00.000Z`);
}

export function formatIsoDate(val?: Date | string | null): string | null {
  const d = dateOnly(val);
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export function addDaysUtc(val: Date | string, days: number): Date {
  const base = dateOnly(val) ?? todayWibDateOnly();
  return new Date(base.getTime() + days * 86_400_000);
}

export function daysUntilUtc(target: Date | string, asOf?: Date | string | null): number {
  const t = dateOnly(target);
  const ref = asOf ? dateOnly(asOf) ?? todayWibDateOnly() : todayWibDateOnly();
  if (!t) return 0;
  return Math.round((t.getTime() - ref.getTime()) / 86_400_000);
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

/**
 * Evaluasi status masa berlaku kontrak berdasarkan tanggal berakhir & tanggal renewal.
 * Sesuai PRD 3.4 & 8.2 Rule 9: Kontrak tidak boleh otomatis dianggap renewed tanpa proses approval.
 */
export function evaluateContractLifecycleStatus(params: {
  currentStatus: string;
  approvalStatus: string;
  expirationDate: Date | string;
  renewalDate?: Date | string | null;
  asOfDate?: Date | string;
}): string {
  const current = String(params.currentStatus || "ACTIVE").toUpperCase();
  if (["TERMINATED", "RENEWED", "RENEWAL_PENDING"].includes(current)) {
    return current;
  }
  const daysLeft = daysUntilUtc(params.expirationDate, params.asOfDate);
  if (daysLeft < 0) {
    return "EXPIRED";
  }
  if (params.renewalDate) {
    const daysToRenewal = daysUntilUtc(params.renewalDate, params.asOfDate);
    if (daysToRenewal <= 0) return "EXPIRING_SOON";
  }
  if (daysLeft <= 30) {
    return "EXPIRING_SOON";
  }
  return "ACTIVE";
}
