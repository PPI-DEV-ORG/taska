import { existsSync } from "node:fs";
import { resolve } from "node:path";

let cachedUploadRoots: string[] | null = null;
let lastRootsCheck = 0;

export function getUploadRoots(): string[] {
  const now = Date.now();
  if (cachedUploadRoots && now - lastRootsCheck < 60_000) {
    return cachedUploadRoots;
  }
  const roots: string[] = [];
  const envUpload = process.env.UPLOAD_DIR || "./uploads";
  roots.push(resolve(process.cwd(), envUpload));
  roots.push(resolve(process.cwd(), "apps/api/uploads"));
  roots.push(resolve(process.cwd(), "uploads"));
  roots.push(resolve(process.cwd(), "../uploads"));
  roots.push(resolve(process.cwd(), "../../uploads"));
  cachedUploadRoots = Array.from(new Set(roots)).filter((r) => existsSync(r));
  lastRootsCheck = now;
  return cachedUploadRoots;
}

/**
 * Normalisasi path berkas relatif terhadap direktori upload
 */
export function normalizeRelativeUploadPath(filePath: string): string {
  if (!filePath) return "";
  let clean = filePath.replace(/\\/g, "/").trim().replace(/^\/+/, "");
  if (clean.toLowerCase().startsWith("uploads/")) {
    clean = clean.slice("uploads/".length);
  }
  return clean;
}

/**
 * Cek apakah berkas ada secara fisik di dalam folder uploads server
 */
export function isLocalFileInUploadDir(filePath: string): boolean {
  if (!filePath || filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return false;
  }
  const clean = normalizeRelativeUploadPath(filePath);
  if (!clean) return false;

  const roots = getUploadRoots();
  for (const root of roots) {
    if (existsSync(resolve(root, clean))) return true;
    if (existsSync(resolve(root, filePath))) return true;
  }
  return false;
}

/**
 * Ambil nama sub-folder dari relative path (misal "penawaran/..." -> "penawaran")
 */
export function getSubfolderFromPath(filePath: string): string {
  if (!filePath) return "dokumen";
  const clean = normalizeRelativeUploadPath(filePath);
  const parts = clean.split("/");
  if (parts.length > 1 && parts[0]) {
    return parts[0].toLowerCase();
  }
  return "dokumen";
}

export const SUBFOLDER_METADATA: Record<
  string,
  { label: string; module: string; color: string; description: string }
> = {
  penawaran: {
    label: "Penawaran (Quotation)",
    module: "quotations",
    color: "#2563EB",
    description: "Surat penawaran harga & lampiran penawaran klien",
  },
  invoice: {
    label: "Faktur & Tagihan (Invoice)",
    module: "invoices",
    color: "#059669",
    description: "Faktur penjualan, faktur pembelian & bukti potong pajak",
  },
  "surat-jalan": {
    label: "Surat Jalan (Delivery)",
    module: "delivery-notes",
    color: "#D97706",
    description: "Scan surat jalan & berita acara serah terima pengiriman",
  },
  "foto-struk": {
    label: "Foto Struk & Biaya",
    module: "expenses",
    color: "#DC2626",
    description: "Foto struk pengeluaran kas, bon, & reimburse operasional",
  },
  penerimaan: {
    label: "Penerimaan Barang (Receiving)",
    module: "receiving",
    color: "#7C3AED",
    description: "Bukti penerimaan barang gudang & surat jalan vendor",
  },
  "request-barang": {
    label: "Permintaan Barang (PR)",
    module: "purchase-requests",
    color: "#DB2777",
    description: "Lampiran purchase request, penawaran vendor & spek barang",
  },
  "foto-dokumen": {
    label: "Foto Dokumen",
    module: "documentation",
    color: "#0891B2",
    description: "Arsip foto fisik dokumen operasional & bukti fisik transaksi",
  },
  "dokumentasi-proyek": {
    label: "Dokumentasi Proyek",
    module: "projects",
    color: "#4F46E5",
    description: "Foto progres proyek lapangan, BAST, & BAHP",
  },
  survey: {
    label: "Laporan Survey",
    module: "surveys",
    color: "#4B5563",
    description: "Foto survey lokasi, denah teknis, & hasil inspeksi awal",
  },
  "laporan-kerusakan": {
    label: "Laporan Kerusakan",
    module: "damage-reports",
    color: "#EA580C",
    description: "Foto kendala barang retur, klaim garansi, & kerusakan",
  },
  "foto-profil": {
    label: "Foto Profil Pengguna",
    module: "users",
    color: "#16A34A",
    description: "Avatar & foto profil staf / karyawan sistem",
  },
  video: {
    label: "Video Dokumentasi",
    module: "documentation",
    color: "#9333EA",
    description: "Rekaman video inspeksi mesin, tutorial, atau dokumentasi",
  },
  dokumen: {
    label: "Dokumen Umum",
    module: "documents",
    color: "#64748B",
    description: "Dokumen umum perusahaan, template, & arsip administrasi",
  },
  "2026": {
    label: "Arsip 2026",
    module: "archive",
    color: "#475569",
    description: "Berkas dan lampiran historis tahun anggaran 2026",
  },
};
