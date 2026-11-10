import type { ModuleKey } from "./permissions.js";

/** Aksi hak akses. L = lihat, C = buat, U = ubah & hapus, A = setujui. */
export type ActionKey = "L" | "C" | "U" | "A";

export const ACTION_LABEL: Record<ActionKey, string> = {
  L: "Lihat",
  C: "Buat",
  U: "Ubah & hapus",
  A: "Setujui",
};

export type ModuleMeta = {
  key: ModuleKey;
  label: string;
  group: string;
  /** Aksi yang benar-benar dipakai sistem untuk modul ini (yang lain tidak berpengaruh, jadi tidak ditampilkan). */
  actions: ActionKey[];
  hint?: string;
};

const CRUD: ActionKey[] = ["L", "C", "U"];

/** Urutan di layar. */
export const MODULE_META: ModuleMeta[] = [
  // Penjualan
  { key: "leads", label: "Prospek", group: "Penjualan", actions: CRUD },
  { key: "quotations", label: "Penawaran", group: "Penjualan", actions: CRUD },
  { key: "financeOut", label: "Pesanan Penjualan & Faktur Penjualan", group: "Penjualan", actions: CRUD, hint: "Pesanan Penjualan (SO), faktur, dan pembayaran dari pelanggan" },
  { key: "surveys", label: "Survei", group: "Penjualan", actions: CRUD },
  { key: "customers", label: "Pelanggan", group: "Penjualan", actions: CRUD },
  { key: "pocReports", label: "Laporan POC & Demo", group: "Penjualan", actions: CRUD },
  { key: "visitReports", label: "Laporan Kunjungan", group: "Penjualan", actions: CRUD },
  // Pembelian & gudang
  { key: "requests", label: "Permintaan Barang", group: "Pembelian & Gudang", actions: CRUD },
  { key: "procurement", label: "Pesanan Pembelian (PO) & Pengiriman dari Pemasok", group: "Pembelian & Gudang", actions: CRUD },
  { key: "receiving", label: "Penerimaan Barang", group: "Pembelian & Gudang", actions: CRUD },
  { key: "stock", label: "Stok, Opname & Retur", group: "Pembelian & Gudang", actions: CRUD },
  { key: "delivery", label: "Surat Jalan", group: "Pembelian & Gudang", actions: CRUD },
  { key: "suppliers", label: "Pemasok", group: "Pembelian & Gudang", actions: CRUD },
  // Keuangan
  { key: "approvals", label: "Persetujuan", group: "Keuangan", actions: ["L", "A"], hint: "Lihat antrean dan menyetujui / menolak dokumen" },
  { key: "expenses", label: "Pengeluaran", group: "Keuangan", actions: CRUD },
  { key: "reports", label: "Laporan", group: "Keuangan", actions: ["L"] },
  // Proyek & tugas
  { key: "projects", label: "Proyek", group: "Proyek & Tugas", actions: CRUD },
  { key: "tasks", label: "Tugas", group: "Proyek & Tugas", actions: CRUD },
  // SDM
  { key: "attendance", label: "Absensi", group: "SDM", actions: CRUD, hint: "Karyawan selalu hanya melihat data absen miliknya" },
  { key: "payroll", label: "Penggajian", group: "SDM", actions: CRUD, hint: "Karyawan selalu hanya melihat slip miliknya" },
  // Data master
  { key: "products", label: "Barang & Jasa", group: "Data Master", actions: CRUD },
  { key: "productCategories", label: "Kategori Barang", group: "Data Master", actions: CRUD },
  { key: "warehouses", label: "Gudang", group: "Data Master", actions: CRUD },
  { key: "leadSources", label: "Sumber Prospek", group: "Data Master", actions: CRUD },
  { key: "lostReasons", label: "Alasan Kalah", group: "Data Master", actions: CRUD },
  { key: "expenseCategories", label: "Kategori Biaya", group: "Data Master", actions: CRUD },
  { key: "costCenters", label: "Pusat Biaya", group: "Data Master", actions: CRUD },
  // Sistem
  { key: "dashboard", label: "Beranda", group: "Sistem", actions: ["L"] },
  { key: "users", label: "Pengguna", group: "Sistem", actions: CRUD },
  { key: "settings", label: "Pengaturan", group: "Sistem", actions: CRUD },
  { key: "archive", label: "Arsip", group: "Sistem", actions: ["L", "U"] },
  { key: "audit", label: "Log Audit", group: "Sistem", actions: ["L"] },
];

export const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  BOS: "Bos",
  SALES: "Sales",
  PM: "Project Manager",
  TEKNISI: "Teknisi",
  PROCUREMENT: "Procurement",
  FINANCE: "Finance",
  GUDANG: "Gudang",
  SE: "Sales Engineer",
  HR: "HR",
};

/** Normalisasi string aksi: hanya LCUA, tanpa duplikat, urut tetap; C/U/A otomatis menyertakan L (tidak bisa ubah tanpa bisa lihat). */
export function normalizeActions(input: string, allowed?: ActionKey[]): string {
  const order: ActionKey[] = ["L", "C", "U", "A"];
  const wanted = new Set(
    String(input ?? "")
      .toUpperCase()
      .split("")
      .filter((c): c is ActionKey => (order as string[]).includes(c) && (!allowed || allowed.includes(c as ActionKey))),
  );
  if ((wanted.has("C") || wanted.has("U") || wanted.has("A")) && (!allowed || allowed.includes("L"))) wanted.add("L");
  return order.filter((a) => wanted.has(a)).join("");
}
