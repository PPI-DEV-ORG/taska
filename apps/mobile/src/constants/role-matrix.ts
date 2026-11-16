/**
 * MATRIKS HAK AKSES STANDAR PER PERAN — satu-satunya sumber izin default.
 *
 * File ini HARUS identik di:
 *   apps/api/src/rbac/role-matrix.ts
 *   apps/mobile/src/constants/role-matrix.ts
 * (dicek otomatis oleh apps/api/src/rbac/role-matrix.spec.ts). Ubah keduanya bersamaan.
 *
 * Kode aksi:
 *   M = tampil di menu   L = lihat data      C = buat          U = ubah
 *   A = hapus / batal    P = harga & laba    V = setujui       E = ekspor / cetak
 *
 * "L" tanpa "M" = data boleh dipakai di pilihan form (dropdown), tapi menunya tidak tampil.
 * Pembatasan "hanya data milik sendiri" (mis. pengeluaran, absensi, slip gaji) tetap diatur di masing-masing modul.
 *
 * Prinsip v3 — tiap peran hanya memegang tugas pokoknya:
 *   - Laporan keuangan (laba rugi, neraca, arus kas, jurnal, pajak) = modul "accounting": hanya Finance, Bos & Super Admin.
 *   - Kelola absensi & gaji (modul "hr" selain absen sendiri) hanya HR & Finance.
 *   - Menu "Laporan" untuk peran lain hanya berisi laporan operasional bidangnya (prospek, proyek, stok, surat jalan).
 *   - v4: Gudang tidak memegang menu PO Keluar / Pengiriman Pemasok — barang yang dikirim muncul di Penerimaan Barang.
 *   - v5: Gudang tanpa Persetujuan, Pembelian, Keuangan & Proyek. Tetap: pengeluaran & petty cash miliknya sendiri.
 *
 * Menaikkan versi ini membuat server menerapkan ulang matriks standar ke peran bawaan sekali saat start
 * (peran kustom tidak disentuh) — lihat SettingsService.upgradeRoleMatrix.
 */

export const ROLE_MATRIX_VERSION = 6;

export const ROLE_MODULE_KEYS = [
  "leads", "quotations", "surveys", "poc-reports", "visit-reports", "maintenance-reports", "customers", "po-client",
  "projects", "tasks", "delivery-notes",
  "purchase-requests", "supplier-pos", "shipments", "receiving", "stock", "opname", "damage-reports",
  "suppliers", "warehouses", "products",
  "invoices", "expenses", "accounting", "reports",
  "hr",
  "dashboard", "calendar", "approvals", "master-data", "users", "archive", "audit-log",
] as const;

const FULL = "MLCUAPVE";

/** Hak dasar semua karyawan: dashboard, kalender, ajukan pengeluaran, absen & lihat slip sendiri, pilih rekan/produk/customer di form. */
const EMPLOYEE: Record<string, string> = {
  dashboard: "ML",
  calendar: "MLCUA",
  expenses: "MLCU",
  hr: "MLC",
  users: "L",
  products: "L",
  customers: "L",
};

const all = (actions: string) => Object.fromEntries(ROLE_MODULE_KEYS.map((k) => [k, actions]));

export const STANDARD_ROLES: Record<string, { name: string; description: string; permissions: Record<string, string> }> = {
  SUPER_ADMIN: {
    name: "Super Admin",
    description: "Akses penuh ke seluruh modul, pengaturan sistem, dan manajemen peran",
    permissions: all(FULL),
  },
  ADMIN: {
    name: "Admin",
    description: "Administrator operasional kantor: seluruh modul operasional, tanpa buku besar / laporan keuangan & penggajian",
    permissions: {
      ...all(FULL),
      accounting: "", // laporan keuangan & jurnal hanya Finance / Bos
      hr: "MLC", // absen sendiri; kelola absensi & gaji oleh HR / Finance
      reports: "MLE", // laporan operasional saja
    },
  },
  BOS: {
    name: "Direktur / Bos",
    description: "Pimpinan perusahaan: persetujuan akhir, laporan laba/rugi, dan seluruh modul",
    permissions: all(FULL),
  },

  SALES: {
    name: "Sales",
    description: "Leads, penawaran, permintaan survey, Sales Order, invoice penagihan, customer & kunjungan",
    permissions: {
      ...EMPLOYEE,
      leads: "MLCUAE",
      quotations: "MLCUAPE",
      surveys: "MLCU",
      "poc-reports": "MLCU",
      "visit-reports": "MLCUE",
      "maintenance-reports": FULL,
      customers: "MLCUA",
      "po-client": "MLCUE",
      invoices: "MLCUE", // buat & kirim tagihan; catat bayar / lunas / batal tetap Finance
      "delivery-notes": "ML",
      "damage-reports": "MLC", // retur / klaim dari customer
      projects: "L",
      stock: "L",
      suppliers: "L",
      reports: "ML",
      "master-data": "ML", // sumber lead, alasan kalah
    },
  },

  PM: {
    name: "Project Manager",
    description: "Kelola project, tugas tim, kebutuhan material & surat jalan project (tanpa harga jual / laba-rugi)",
    permissions: {
      ...EMPLOYEE,
      projects: "MLCUE", // tanpa P: harga jual, nilai kontrak & laba-rugi hanya Finance / pimpinan
      tasks: "MLCUA",
      surveys: "MLCUV", // menyetujui permintaan survey
      "poc-reports": "MLCU",
      "visit-reports": "MLCU",
      "maintenance-reports": FULL,
      "purchase-requests": "MLCU",
      "delivery-notes": "MLCU",
      "damage-reports": "MLC",
      approvals: "MLV",
      leads: "L",
      quotations: "L", // lihat penawaran yang terkait project
      "po-client": "L",
      invoices: "L", // status tagihan project (tanpa menu Faktur)
      customers: "L",
      stock: "ML",
      products: "L",
      warehouses: "L",
      suppliers: "L",
      receiving: "L",
      reports: "ML", // laporan proyek
    },
  },

  TEKNISI: {
    name: "Teknisi",
    description: "Kerjakan tugas & survey lapangan, minta material, konfirmasi barang terpasang, lapor kerusakan",
    permissions: {
      ...EMPLOYEE,
      tasks: "MLU",
      projects: "ML",
      surveys: "MLCU",
      "poc-reports": "MLCU",
      "visit-reports": "MLCU",
      "maintenance-reports": FULL,
      "purchase-requests": "MLC",
      "delivery-notes": "MLU",
      "damage-reports": "MLC",
      stock: "L",
      warehouses: "L",
    },
  },

  SE: {
    name: "System Engineer / Presales",
    description: "POC & demo, kunjungan teknis, survey, dukungan teknis penawaran & project",
    permissions: {
      ...EMPLOYEE,
      "poc-reports": "MLCUAE",
      "visit-reports": "MLCUE",
      "maintenance-reports": "MLCUAE",
      surveys: "MLCU",
      leads: "ML",
      quotations: "ML",
      projects: "ML",
      tasks: "MLU",
      "purchase-requests": "MLC",
      "delivery-notes": "ML",
      "damage-reports": "MLC",
      stock: "L",
    },
  },

  PROCUREMENT: {
    name: "Procurement / Purchasing",
    description: "Proses request barang, PO supplier & tagihannya, pengiriman PO, penerimaan, harga beli & vendor",
    permissions: {
      ...EMPLOYEE,
      "purchase-requests": "MLCU",
      "supplier-pos": "MLCUAPE",
      shipments: "MLCU",
      receiving: "MLCUV", // persetujuan penerimaan tahap 2
      stock: "MLCUP",
      opname: "MLCUV",
      "damage-reports": "MLCUV",
      suppliers: "MLCUAE",
      products: "MLCUAP",
      warehouses: "MLCU",
      "delivery-notes": "ML",
      "maintenance-reports": "ML",
      approvals: "MLV",
      "master-data": "ML",
      projects: "L",
      quotations: "L",
      "po-client": "L",
      reports: "ML", // laporan stok & surat jalan
    },
  },

  FINANCE: {
    name: "Finance & Accounting",
    description: "Invoice & pembayaran, tagihan supplier, pengeluaran, akuntansi, payroll, persetujuan keuangan",
    permissions: {
      ...EMPLOYEE,
      invoices: FULL,
      accounting: FULL,
      expenses: FULL,
      hr: FULL, // payroll & slip gaji
      "po-client": "MLCUAPE",
      quotations: "MLPVE",
      "purchase-requests": "MLUV", // setujui & bayar request
      "supplier-pos": "MLCUPVE", // setujui PO, bayar tagihan supplier
      "delivery-notes": "MLV",
      opname: "MLV",
      "damage-reports": "MLV",
      surveys: "MLV",
      "maintenance-reports": "ML",
      receiving: "ML",
      shipments: "L",
      stock: "MLP",
      products: "LP",
      projects: "MLP",
      customers: "MLCU",
      suppliers: "MLCU",
      leads: "L",
      approvals: "MLV",
      reports: "MLPE",
      archive: "ML",
      "master-data": "MLCU", // kategori biaya, cost center
    },
  },

  GUDANG: {
    name: "Admin Gudang",
    description: "Stok & serial number, penerimaan barang, surat jalan, opname, kerusakan, serah barang request",
    permissions: {
      ...EMPLOYEE,
      stock: "MLCU",
      opname: "MLCU",
      receiving: "MLCU", // konfirmasi fisik barang; persetujuan oleh Procurement
      "delivery-notes": "MLCU",
      "damage-reports": "MLCU",
      // Tanpa menu Pembelian. Lihat & ubah tetap perlu untuk cek stok & serah barang stok ke proyek
      // (tugas Gudang — tampil di dashboard Gudang), bukan untuk membuat permintaan pembelian.
      "purchase-requests": "LU",
      "supplier-pos": "L", // data PO untuk penerimaan (tanpa menu PO Keluar)
      shipments: "L", // barang yang dikirim tampil di Penerimaan Barang
      warehouses: "MLCU",
      products: "MLCU", // tanpa harga beli / laba
      approvals: "", // tanpa akses Persetujuan
      "master-data": "ML",
      projects: "L", // hanya untuk pilihan proyek tujuan surat jalan (tanpa menu / ringkasan proyek)
      "po-client": "L", // pilih SO saat membuat surat jalan
      invoices: "", // tanpa akses Keuangan
      suppliers: "L",
      reports: "ML", // laporan stok & surat jalan
    },
  },

  HR: {
    name: "HR / Personalia",
    description: "Data karyawan & akun, absensi, lembur, dan payroll",
    permissions: {
      ...EMPLOYEE,
      hr: FULL,
      users: "MLCU",
      "purchase-requests": "MLC",
      "maintenance-reports": "ML",
      projects: "L",
    },
  },
};
