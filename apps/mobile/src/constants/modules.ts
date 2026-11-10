import type { LucideIcon } from "lucide-react-native";
import {
  Archive,
  Boxes,
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  Database,
  FileCheck,
  FileText,
  LayoutDashboard,
  ListChecks,
  PackageCheck,
  Receipt,
  ScrollText,
  ShoppingCart,
  Target,
  Truck,
  TriangleAlert,
  UserCog,
  UserCheck,
  Wallet,
  FileSignature,
  Presentation,
  Handshake,
  CalendarDays,
} from "lucide-react-native";

export type Role =
  | "super_admin"
  | "admin"
  | "bos"
  | "sales"
  | "pm"
  | "teknisi"
  | "procurement"
  | "finance"
  | "gudang"
  | "se"
  | "hr"
  | (string & {});

export type ActionCode = "M" | "L" | "C" | "U" | "A" | "P" | "V" | "E";

export type RoleDef = {
  code: string;
  name: string;
  description?: string;
  isSystem?: boolean;
  permissions: Record<string, ActionCode[]>;
};

export const ALL_ACTION_CODES: ActionCode[] = ["M", "L", "C", "U", "A", "P", "V", "E"];

export const ALL_MODULE_KEYS = [
  "leads", "quotations", "surveys", "poc-reports", "visit-reports", "customers",
  "po-client", "projects", "tasks", "delivery-notes",
  "purchase-requests", "supplier-pos", "shipments", "receiving", "stock", "opname", "damage-reports", "suppliers", "warehouses", "products",
  "invoices", "expenses", "accounting", "reports",
  "hr",
  "dashboard", "calendar", "approvals", "master-data", "users", "archive", "audit-log",
] as const;

const ALL_PERMS = Object.fromEntries(ALL_MODULE_KEYS.map((k) => [k, [...ALL_ACTION_CODES]])) as Record<string, ActionCode[]>;

export const DEFAULT_SYSTEM_ROLES: RoleDef[] = [
  {
    code: "SUPER_ADMIN",
    name: "Super Admin",
    description: "Akses penuh ke seluruh modul, pengaturan sistem, dan manajemen peran",
    isSystem: true,
    permissions: ALL_PERMS,
  },
  {
    code: "ADMIN",
    name: "Admin",
    description: "Administrator operasional kantor dengan akses seluruh modul",
    isSystem: true,
    permissions: ALL_PERMS,
  },
  {
    code: "BOS",
    name: "Direktur / Bos",
    description: "Pimpinan perusahaan dengan akses persetujuan, laporan P&L, dan seluruh modul",
    isSystem: true,
    permissions: ALL_PERMS,
  },
  {
    code: "SALES",
    name: "Sales",
    description: "Tim penjualan: mengelola leads, survey, penawaran, SO, dan relasi customer",
    isSystem: true,
    permissions: {
      dashboard: ["M", "L"],
      calendar: ["M", "L", "C", "U"],
      leads: ["M", "L", "C", "U"],
      quotations: ["M", "L", "C", "U", "P", "E"],
      surveys: ["M", "L", "C", "U"],
      "poc-reports": ["M", "L", "C", "U"],
      "visit-reports": ["M", "L", "C", "U"],
      customers: ["M", "L", "C", "U"],
      "po-client": ["M", "L", "C", "U"],
      "delivery-notes": ["M", "L"],
      expenses: ["M", "L", "C", "U"],
      hr: ["M", "L", "C"],
      "master-data": ["M", "L"],
      // Akses lihat data saja (tanpa tampil di sidebar)
      products: ["L"],
      stock: ["L"],
      projects: ["L"],
      reports: ["L"],
    },
  },
  {
    code: "PM",
    name: "Project Manager",
    description: "Manajer proyek: mengelola jalannya proyek, tugas tim, P&L proyek, dan BAST",
    isSystem: true,
    permissions: {
      dashboard: ["M", "L"],
      calendar: ["M", "L", "C", "U"],
      projects: ["M", "L", "C", "U", "P", "E"],
      tasks: ["M", "L", "C", "U"],
      surveys: ["M", "L", "C", "U", "A"],
      "poc-reports": ["M", "L", "C", "U"],
      "visit-reports": ["M", "L", "C", "U"],
      "purchase-requests": ["M", "L", "C", "U"],
      "delivery-notes": ["M", "L", "C", "U"],
      expenses: ["M", "L", "C", "U"],
      hr: ["M", "L", "C"],
      // Akses lihat data saja
      quotations: ["L"],
      leads: ["L"],
      customers: ["L", "C", "U"],
      stock: ["L"],
      products: ["L"],
      reports: ["L"],
    },
  },
  {
    code: "TEKNISI",
    name: "Teknisi",
    description: "Tim teknis lapangan: eksekusi tugas proyek, survey lokasi, dan instalasi",
    isSystem: true,
    permissions: {
      dashboard: ["M", "L"],
      calendar: ["M", "L"],
      tasks: ["M", "L", "U"],
      projects: ["M", "L"],
      surveys: ["M", "L", "C", "U"],
      "poc-reports": ["M", "L", "C", "U"],
      "visit-reports": ["M", "L", "C", "U"],
      "purchase-requests": ["M", "L", "C"],
      "delivery-notes": ["M", "L"],
      expenses: ["M", "L", "C"],
      hr: ["M", "L", "C"],
      // Akses lihat data saja
      stock: ["L"],
      products: ["L"],
      warehouses: ["L"],
    },
  },
  {
    code: "PROCUREMENT",
    name: "Procurement / Purchasing",
    description: "Tim pengadaan: mengelola PR, PO Supplier, penerimaan barang, dan harga vendor",
    isSystem: true,
    permissions: {
      dashboard: ["M", "L"],
      calendar: ["M", "L"],
      approvals: ["M", "L", "V"],
      "purchase-requests": ["M", "L", "C", "U", "V"],
      "supplier-pos": ["M", "L", "C", "U", "A", "P", "E"],
      shipments: ["M", "L", "C", "U"],
      receiving: ["M", "L", "C", "U", "A"],
      stock: ["M", "L", "C", "U", "P"],
      opname: ["M", "L", "C", "U"],
      "damage-reports": ["M", "L", "C", "U"],
      suppliers: ["M", "L", "C", "U", "A"],
      warehouses: ["M", "L", "C", "U"],
      products: ["M", "L", "C", "U", "P"],
      "delivery-notes": ["M", "L", "C", "U"],
      expenses: ["M", "L", "C", "U"],
      hr: ["M", "L", "C"],
      "master-data": ["M", "L"],
      // Akses lihat data saja
      projects: ["L"],
      reports: ["L"],
    },
  },
  {
    code: "FINANCE",
    name: "Finance & Accounting",
    description: "Tim keuangan: mengelola invoice keluar/masuk, pembayaran, pengeluaran, COA, dan P&L",
    isSystem: true,
    permissions: {
      dashboard: ["M", "L"],
      calendar: ["M", "L"],
      approvals: ["M", "L", "V"],
      invoices: ["M", "L", "C", "U", "A", "P", "V", "E"],
      "po-client": ["M", "L", "C", "U", "P"],
      "purchase-requests": ["M", "L", "U", "V"],
      "supplier-pos": ["M", "L", "C", "U", "P", "E"],
      expenses: ["M", "L", "C", "U", "A", "P", "V", "E"],
      accounting: ["M", "L", "C", "U", "A", "P", "V", "E"],
      "delivery-notes": ["M", "L"],
      reports: ["M", "L", "P", "E"],
      hr: ["M", "L", "C", "U", "A", "P", "V", "E"],
      // Akses lihat data saja
      quotations: ["L", "P", "E"],
      projects: ["L", "P"],
      customers: ["L", "C", "U"],
      suppliers: ["L", "C", "U"],
      archive: ["L"],
    },
  },
  {
    code: "GUDANG",
    name: "Admin Gudang",
    description: "Tim logistik & gudang: mengelola stok, serial number, opname, penerimaan, dan surat jalan",
    isSystem: true,
    permissions: {
      dashboard: ["M", "L"],
      calendar: ["M", "L"],
      approvals: ["M", "L", "V"],
      stock: ["M", "L", "C", "U"],
      opname: ["M", "L", "C", "U", "A"],
      receiving: ["M", "L", "C", "U", "A"],
      "delivery-notes": ["M", "L", "C", "U"],
      "damage-reports": ["M", "L", "C", "U"],
      "purchase-requests": ["M", "L", "C", "U"],
      "supplier-pos": ["M", "L"],
      warehouses: ["M", "L", "C", "U"],
      products: ["M", "L", "C", "U"],
      hr: ["M", "L", "C"],
      "master-data": ["M", "L"],
    },
  },
  {
    code: "SE",
    name: "System Engineer / Presales",
    description: "Tim presales & solusi teknis: POC, demo, survey, dan pendampingan teknis",
    isSystem: true,
    permissions: {
      dashboard: ["M", "L"],
      calendar: ["M", "L"],
      "poc-reports": ["M", "L", "C", "U", "A"],
      "visit-reports": ["M", "L", "C", "U", "A"],
      surveys: ["M", "L", "C", "U"],
      projects: ["M", "L"],
      tasks: ["M", "L", "U"],
      "delivery-notes": ["M", "L"],
      expenses: ["M", "L", "C"],
      hr: ["M", "L", "C"],
      // Akses lihat data saja
      stock: ["L"],
      products: ["L"],
    },
  },
  {
    code: "HR",
    name: "HR / Personalia",
    description: "Tim SDM: mengelola data karyawan, rekap absensi, lembur, dan slip gaji (payroll)",
    isSystem: true,
    permissions: {
      dashboard: ["M", "L"],
      calendar: ["M", "L"],
      hr: ["M", "L", "C", "U", "A", "P", "V", "E"],
      users: ["M", "L", "C", "U"],
      expenses: ["M", "L", "C", "U"],
      "purchase-requests": ["M", "L", "C"],
      reports: ["M", "L"],
      "visit-reports": ["M", "L"],
      "poc-reports": ["M", "L"],
      // Akses lihat data saja
      customers: ["L"],
      suppliers: ["L"],
    },
  },
];

export function getDefaultRoleDef(code: string): RoleDef | undefined {
  const norm = String(code || "").toUpperCase().trim().replace(/[\s\-]+/g, "_");
  return DEFAULT_SYSTEM_ROLES.find((r) => r.code === norm);
}

export type CompanyProfile = {
  name: string;
  tagline: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  npwp: string;
  bankName: string;
  bankAccount: string;
  bankHolder: string;
  signatoryName: string;
  signatoryTitle: string;
  logoFileId: string;
  stampFileId: string;
};

export const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  name: "PT Samtek",
  tagline: "General Contractor, IT & Security System Integrator",
  address: "Bekasi, Jawa Barat",
  city: "Bekasi",
  phone: "",
  email: "",
  website: "",
  npwp: "",
  bankName: "",
  bankAccount: "",
  bankHolder: "",
  signatoryName: "Direktur Utama",
  signatoryTitle: "Direktur",
  logoFileId: "",
  stampFileId: "",
};

export const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin / Bos",
  bos: "Admin / Bos",
  sales: "Sales",
  pm: "Project Manager",
  teknisi: "Teknisi",
  procurement: "Procurement",
  finance: "Finance",
  gudang: "Gudang",
  se: "Software Engineer",
  hr: "HR",
};

export type Row = Record<string, any> & { id: string };

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  roleLabel: string;
  gudang: string;
  status: string;
  phone?: string;
  position?: string;
  avatarUrl?: string;
};

export type Notif = {
  id: string;
  jenis: "approval" | "stok" | "pengiriman" | "lead" | "tugas" | "surat";
  teks: string;
  waktu: string;
  baca: boolean;
  href: string;
  roles: Role[] | "all";
};

export type Fmt = "rupiah" | "date" | "status" | "pct" | "text" | "number" | "phone" | "email";
export type Col = { key: string; label: string; fmt?: Fmt; primary?: boolean; mobile?: boolean; flex?: number; width?: number | string };
export type Field = { label: string; key: string; fmt?: Fmt };
export type CreateField = {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "multiselect" | "date" | "textarea" | "password" | "file";
  options?: string[];
  required?: boolean;
  placeholder?: string;
  kind?: "foto" | "dokumen" | "video" | "semua";
  category?: string;
  defaultValue?: string;
};
export type ModuleAction = { label: string; toast: string; to?: (r: Row) => string; status?: string };

export type ModuleDef = {
  key: string;
  title: string;
  singular: string;
  icon: LucideIcon;
  idPrefix: string;
  columns: Col[];
  fields: Field[];
  statusKey: string;
  statuses: string[];
  titleOf: (r: Row) => string;
  subtitleOf?: (r: Row) => string;
  search: string[];
  createLabel?: string;
  createFields?: CreateField[];
  newHref?: string;
  createRoles?: Role[];
  defaults?: Record<string, any>;
  actions?: ModuleAction[];
  docs?: string[];
  emptyText: string;
  /** Status yang butuh konfirmasi karena tidak bisa dibatalkan. */
  confirmStatuses?: string[];
};

const ALL: Role[] = ["super_admin", "admin", "bos", "sales", "pm", "teknisi", "procurement", "finance", "gudang", "se", "hr"];

export const MODULES: Record<string, ModuleDef> = {
  leads: {
    key: "leads", title: "Leads", singular: "Lead", icon: Target, idPrefix: "L",
    columns: [
      { key: "nama", label: "Nama", primary: true, flex: 2 },
      { key: "jenisTransaksi", label: "Jenis" },
      { key: "perusahaan", label: "Customer", flex: 1.5 },
      { key: "sumber", label: "Sumber" },
      { key: "nilai", label: "Nilai", fmt: "rupiah" },
      { key: "peluang", label: "Peluang", fmt: "pct" },
      { key: "closing", label: "Closing", fmt: "date" },
      { key: "pemilik", label: "Pemilik" },
      { key: "status", label: "Status", fmt: "status", mobile: true },
    ],
    fields: [
      { label: "Customer", key: "perusahaan" }, { label: "Kontak", key: "kontak" },
      { label: "Jenis Transaksi", key: "jenisTransaksi" },
      { label: "Sumber", key: "sumber" }, { label: "Tipe client", key: "tipe" },
      { label: "Nilai perkiraan", key: "nilai", fmt: "rupiah" }, { label: "Peluang", key: "peluang", fmt: "pct" },
      { label: "Perkiraan closing", key: "closing", fmt: "date" }, { label: "Pemilik", key: "pemilik" },
      { label: "Catatan kebutuhan", key: "need" },
    ],
    statusKey: "status",
    statuses: ["Prospecting", "Qualification", "Proposal", "Negotiation", "Won", "Lost"],
    titleOf: (r) => r.nama, subtitleOf: (r) => r.perusahaan,
    search: ["nama", "perusahaan", "pemilik", "sumber", "jenisTransaksi"],
    createLabel: "Tambah lead",
    createFields: [
      { key: "nama", label: "Nama lead", type: "text", required: true, placeholder: "Contoh: CCTV Gudang Baru / Pengadaan Switch 24 Port" },
      { key: "jenisTransaksi", label: "Jenis Transaksi / Peluang", type: "select", options: ["Proyek (Instalasi & Jasa)", "Penjualan Barang (Perangkat / Retail)"], required: true },
      { key: "perusahaan", label: "Customer", type: "select", required: true, options: [] },
      { key: "sumber", label: "Sumber", type: "select", required: true, options: [] },
      { key: "tipe", label: "Tipe client", type: "select", options: ["End user", "Partner", "SI (Sistem Integrator)"] },
      { key: "kontak", label: "Nama kontak PIC", type: "text", placeholder: "Masukkan nama PIC" },
      { key: "nilai", label: "Nilai perkiraan (Rp)", type: "number" },
      { key: "peluang", label: "Peluang (%)", type: "number", placeholder: "20" },
      { key: "closing", label: "Target closing", type: "date" },
      { key: "need", label: "Catatan kebutuhan", type: "textarea", placeholder: "Ringkasan kebutuhan teknis atau rincian barang yang dicari" },
      { key: "dokumen", label: "Upload dokumen pendukung / brief (Opsional)", type: "file", required: false },
    ],
    defaults: { status: "Prospecting", jenisTransaksi: "Proyek (Instalasi & Jasa)", peluang: 20, sepi: 0, tipe: "End user", kontak: "-" },
    actions: [
      { label: "Download template penawaran", toast: "Template penawaran berhasil diunduh" },
      { label: "Minta survey", toast: "Permintaan survey dikirim ke PM" },
      { label: "Jadikan project", toast: "Project baru berhasil dibuat", to: () => "/leads" },
      { label: "Buat Sales Order (SO)", toast: "Sales Order berhasil dibuat", to: () => "/po-client" },
    ],
    docs: ["Dokumen pendukung / brief"],
    emptyText: "Belum ada lead. Tambah lead pertama untuk mulai melacak peluang.",
    confirmStatuses: ["Lost"],
  },
  quotations: {
    key: "quotations", title: "Penawaran", singular: "Penawaran", icon: FileText, idPrefix: "Q",
    columns: [
      { key: "nomor", label: "Nomor", primary: true, flex: 1.5 },
      { key: "customer", label: "Customer", flex: 1.5 },
      { key: "lead", label: "Lead Sumber", flex: 1.5 },
      { key: "total", label: "Total", fmt: "rupiah" },
      { key: "disc", label: "Disc", fmt: "rupiah" },
      { key: "ppn", label: "PPN (11%)", fmt: "rupiah" },
      { key: "totalAfterDisc", label: "Total Akhir", fmt: "rupiah" },
      { key: "fileStatus", label: "File Excel/PDF", flex: 1.2 },
      { key: "status", label: "Status", fmt: "status", mobile: true },
    ],
    fields: [
      { label: "Nomor Penawaran", key: "nomor" },
      { label: "Customer", key: "customer" },
      { label: "Lead Sumber", key: "lead" },
      { label: "Total Sebelum PPN/Disc", key: "total", fmt: "rupiah" },
      { label: "Diskon (Disc)", key: "disc", fmt: "rupiah" },
      { label: "PPN (11%)", key: "ppn", fmt: "rupiah" },
      { label: "Potongan PPh", key: "pph", fmt: "rupiah" },
      { label: "Skema PPh", key: "tipePph" },
      { label: "Total Setelah Diskon, PPN & PPh", key: "totalAfterDisc", fmt: "rupiah" },
      { label: "Versi Terakhir", key: "versi" },
      { label: "Berlaku Sampai", key: "berlaku", fmt: "date" },
      { label: "Dibuat", key: "dibuat", fmt: "date" },
      { label: "Sales Pemilik", key: "pemilik" },
    ],
    statusKey: "status",
    statuses: ["Not Yet", "Done", "Menunggu persetujuan", "Disetujui", "Terkirim", "Revisi", "Ditolak", "Kedaluwarsa"],
    titleOf: (r) => r.nomor, subtitleOf: (r) => `${r.customer} · ${r.lead}`,
    search: ["nomor", "customer", "lead"],
    createLabel: "Buat penawaran",
    createFields: [
      { key: "lead", label: "Lead sumber", type: "select", options: [] },
      { key: "customer", label: "Customer", type: "select", required: true, options: [] },
      { key: "nilai", label: "Nilai Penawaran (Rp)", type: "number", required: true },
      { key: "disc", label: "Diskon", type: "number" },
      { key: "berlaku", label: "Berlaku sampai", type: "date" },
      { key: "dokumen", label: "File penawaran (Excel / PDF)", type: "file" },
    ],
    defaults: { status: "Not Yet", versi: 1, lead: "-", total: 0, ppn: 0, disc: 0, pph: 0, pphMode: "none", tipePph: "Tanpa PPh", totalAfterDisc: 0, fileUploaded: false, tipePpn: "Exclude PPN (11%)" },
    actions: [
      { label: "Kirim ke customer", toast: "Penawaran ditandai terkirim", status: "Terkirim" },
      { label: "Buat invoice", toast: "Invoice disiapkan untuk penawaran ini" },
    ],
    docs: [],
    emptyText: "Belum ada penawaran. Penawaran otomatis dibuat saat lead masuk tahap Qualification.",
    confirmStatuses: ["Ditolak"],
  },
  surveys: {
    key: "surveys", title: "Survey", singular: "Survey", icon: ClipboardList, idPrefix: "SV",
    columns: [
      { key: "lead", label: "Kebutuhan", primary: true, flex: 2 },
      { key: "customer", label: "Customer", flex: 1.5 },
      { key: "lokasi", label: "Lokasi", flex: 2 },
      { key: "jadwal", label: "Jadwal", fmt: "date" },
      { key: "tim", label: "Tim", flex: 1.5 },
      { key: "status", label: "Status", fmt: "status", mobile: true },
    ],
    fields: [
      { label: "Lead terkait", key: "lead" },
      { label: "Project terkait", key: "project" },
      { label: "Customer", key: "customer" }, { label: "Lokasi", key: "lokasi" },
      { label: "Jadwal", key: "jadwal", fmt: "date" }, { label: "Tim survey", key: "tim" },
      { label: "Biaya survey", key: "biaya", fmt: "rupiah" },
    ],
    statusKey: "status",
    statuses: ["Diminta", "Dijadwalkan", "Berjalan", "Selesai", "Dibatalkan"],
    titleOf: (r) => r.lead, subtitleOf: (r) => r.customer,
    search: ["lead", "customer", "lokasi"],
    createLabel: "Minta survey",
    createFields: [
      { key: "lead", label: "Lead terkait", type: "select", required: true, options: [] },
      { key: "project", label: "Project terkait (Opsional)", type: "select", options: ["-"] },
      { key: "customer", label: "Customer", type: "select", required: true, options: [] },
      { key: "lokasi", label: "Lokasi", type: "text", required: true, placeholder: "Alamat atau titik lokasi survey" },
      { key: "jadwal", label: "Tanggal survey", type: "date", required: true },
      {
        key: "tim",
        label: "Tim survey (Pilih Karyawan / Staf)",
        type: "multiselect",
        required: true,
        options: [],
      },
      { key: "biaya", label: "Estimasi biaya survey (Rp)", type: "number" },
      { key: "need", label: "Catatan kebutuhan survey", type: "textarea", placeholder: "Hal yang perlu dicek di lokasi" },
    ],
    defaults: { status: "Diminta", biaya: 0 },
    actions: [{ label: "Laporkan biaya survey", toast: "Biaya survey dikirim ke Finance" }],
    docs: ["Foto atau video lokasi", "Catatan dan dokumen survey"],
    emptyText: "Belum ada survey. Minta survey bila kebutuhan client belum jelas.",
  },
  "po-client": {
    key: "po-client", title: "Sales Order (SO)", singular: "Sales Order", icon: FileCheck, idPrefix: "SO",
    columns: [
      { key: "nomor", label: "Nomor SO", primary: true, flex: 1.4 },
      { key: "nomorPoClient", label: "Nomor PO Client", flex: 1.3 },
      { key: "customer", label: "Customer", flex: 1.5 },
      { key: "penawaran", label: "Penawaran", flex: 1.3 },
      { key: "nilai", label: "Nilai Pesanan", fmt: "rupiah" },
      { key: "totalInvoice", label: "Total Invoice", fmt: "rupiah" },
      { key: "tanggal", label: "Tanggal", fmt: "date" },
      { key: "status", label: "Status", fmt: "status", mobile: true },
    ],
    fields: [
      { label: "Nomor SO", key: "nomor" },
      { label: "Nomor PO Client", key: "nomorPoClient" },
      { label: "Customer", key: "customer" },
      { label: "Lead terkait", key: "lead" },
      { label: "Penawaran asal", key: "penawaran" },
      { label: "Project terkait", key: "project" },
      { label: "Nilai Pesanan", key: "nilai", fmt: "rupiah" },
      { label: "Total Invoice", key: "totalInvoice", fmt: "rupiah" },
      { label: "Tanggal SO", key: "tanggal", fmt: "date" },
      { label: "Catatan", key: "catatan" },
    ],
    statusKey: "status", statuses: ["Pending", "Lunas sebagian", "Lunas"],
    titleOf: (r) => {
      if (r.nomor && r.nomorPoClient && r.nomorPoClient !== "-") {
        return `${r.nomor} · PO: ${r.nomorPoClient}`;
      }
      return r.nomor || r.nomorSo || "Sales Order";
    },
    subtitleOf: (r) => r.customer || "-",
    search: ["nomor", "nomorSo", "nomorPoClient", "customer", "penawaran"],
    createLabel: "Buat Sales Order (SO)",
    createFields: [
      { key: "nomorSo", label: "Nomor Sales Order / SO (Kosongkan untuk otomatis)", type: "text", placeholder: "Otomatis: SO/2026/10/001" },
      { key: "nomorPoClient", label: "Nomor PO Client (Opsional)", type: "text", placeholder: "Contoh: PO-CUST/088" },
      { key: "customer", label: "Customer", type: "select", required: true, options: [] },
      { key: "lead", label: "Lead terkait (Opsional)", type: "select", options: ["-"] },
      { key: "penawaran", label: "Penawaran asal (Opsional)", type: "select", options: ["-"] },
      { key: "project", label: "Project terkait (Opsional)", type: "select", options: ["-"] },
      { key: "nilai", label: "Nilai Pesanan (Rp)", type: "number", required: true },
      { key: "tanggal", label: "Tanggal Dokumen SO", type: "date", required: true },
      { key: "catatan", label: "Catatan Pesanan (Acuan Gudang & Pengiriman)", type: "textarea", placeholder: "Ketentuan termin, jadwal kirim, atau instruksi penyiapan barang" },
      { key: "fileId", label: "Upload File PO dari Customer (Opsional)", type: "file" },
      { key: "soFileId", label: "Upload File SO Terbitan Kita (Opsional)", type: "file" },
    ],
    defaults: { status: "Diterima", customer: "-", penawaran: "-", totalInvoice: 0 },
    docs: ["File Purchase Order (PO) dari Customer", "File Sales Order (SO) Terbitan Kita", "File Delivery Order (DO) yang Sudah Ditandatangani"],
    emptyText: "Belum ada Sales Order. Buat Sales Order (SO) setelah penawaran disetujui atau saat customer memesan.",
  },
  invoices: {
    key: "invoices", title: "Invoice dan pembayaran", singular: "Invoice", icon: Receipt, idPrefix: "INV",
    columns: [
      { key: "nomor", label: "Nomor", primary: true, flex: 1.5 },
      { key: "customer", label: "Customer", flex: 1.5 },
      { key: "jenis", label: "Jenis" },
      { key: "total", label: "Total", fmt: "rupiah" },
      { key: "terbayar", label: "Terbayar", fmt: "rupiah" },
      { key: "jatuhTempo", label: "Jatuh tempo", fmt: "date" },
      { key: "status", label: "Status", fmt: "status", mobile: true },
    ],
    fields: [
      { label: "Customer", key: "customer" },
      { label: "PO client", key: "po" },
      { label: "Penawaran terkait", key: "penawaran" },
      { label: "Project terkait", key: "project" },
      { label: "Jenis", key: "jenis" },
      { label: "Nilai (DPP)", key: "nilai", fmt: "rupiah" },
      { label: "PPN", key: "ppn", fmt: "rupiah" },
      { label: "Potongan PPh", key: "pph", fmt: "rupiah" },
      { label: "Skema PPh", key: "tipePph" },
      { label: "Total Bersih", key: "total", fmt: "rupiah" },
      { label: "Sudah dibayar", key: "terbayar", fmt: "rupiah" },
      { label: "Tanggal", key: "tanggal", fmt: "date" },
      { label: "Jatuh tempo", key: "jatuhTempo", fmt: "date" },
      { label: "Catatan", key: "catatan" },
    ],
    statusKey: "status",
    statuses: ["Belum lunas", "Belum dikirim", "Terkirim", "Dibayar sebagian", "Lunas", "Terlambat"],
    titleOf: (r) => r.nomor, subtitleOf: (r) => `${r.customer} · ${r.jenis}`,
    search: ["nomor", "customer", "po", "quotation", "lead", "project", "jenis", "status", "paymentNote"],
    createLabel: "Catat invoice",
    createFields: [
      { key: "nomor", label: "Nomor invoice (Kosongkan untuk otomatis)", type: "text", placeholder: "Contoh: INV/2026/10/001" },
      { key: "customer", label: "Customer", type: "select", required: true, options: [] },
      { key: "po", label: "PO client terkait (Opsional)", type: "select", options: ["-"] },
      { key: "penawaran", label: "Penawaran terkait (Opsional)", type: "select", options: ["-"] },
      { key: "project", label: "Project terkait (Opsional)", type: "select", options: ["-"] },
      { key: "jenis", label: "Jenis", type: "select", required: true, options: ["DP", "Termin", "Pelunasan"] },
      { key: "nilai", label: "Nilai sebelum PPN (Rp)", type: "number", required: true },
      { key: "tanggal", label: "Tanggal terbit", type: "date" },
      { key: "jatuhTempo", label: "Jatuh tempo", type: "date", required: true },
      { key: "dokumen", label: "File invoice (Opsional)", type: "file" },
    ],
    defaults: { status: "Belum dikirim", terbayar: 0, po: "-" },
    createRoles: ["finance", "super_admin", "admin", "bos"],
    actions: [
      { label: "Kirim ke customer", status: "Terkirim", toast: "Invoice terkirim ke customer" },
      { label: "Catat pembayaran", toast: "Pembayaran dicatat" },
    ],
    docs: [],
    emptyText: "Belum ada invoice. Upload invoice yang dibuat di luar aplikasi.",
  },
  projects: {
    key: "projects", title: "Project", singular: "Project", icon: Briefcase, idPrefix: "P",
    columns: [
      { key: "nama", label: "Project", primary: true, flex: 2 },
      { key: "jenis", label: "Jenis" },
      { key: "customer", label: "Customer", flex: 1.5 },
      { key: "progres", label: "Progres", fmt: "pct" },
      { key: "pembayaran", label: "Pembayaran", fmt: "status" },
      { key: "status", label: "Status", fmt: "status", mobile: true },
    ],
    fields: [],
    statusKey: "status", statuses: ["Berjalan", "Terlambat", "Selesai", "Ditunda"],
    titleOf: (r) => r.nama, subtitleOf: (r) => r.customer,
    search: ["nama", "customer", "jenis"],
    createLabel: "Buat project",
    createFields: [
      { key: "nama", label: "Nama project", type: "text", required: true, placeholder: "Contoh: Instalasi CCTV Gudang" },
      { key: "jenis", label: "Jenis", type: "select", required: true, options: ["Customer", "Product/R&D", "Internal", "Maintenance", "Support", "Lainnya"] },
      { key: "lead", label: "Lead terkait (Opsional)", type: "select", options: ["-"] },
      { key: "customer", label: "Customer", type: "select", options: ["-"] },
      { key: "pm", label: "Project Manager (PIC)", type: "select", options: [] },
      { key: "tim", label: "Tim pelaksana", type: "multiselect", options: [] },
      { key: "mulai", label: "Tanggal mulai", type: "date" },
      { key: "selesai", label: "Target selesai", type: "date", required: true },
      { key: "dokumen", label: "Dokumen PRD / SPK (Opsional)", type: "file" },
    ],
    defaults: { status: "Berjalan", progres: 0, pembayaran: "Belum lunas", tim: "-", barang: "Diminta" },
    emptyText: "Belum ada project yang kamu pegang.",
    confirmStatuses: ["Ditunda"],
  },
  "purchase-requests": {
    key: "purchase-requests", title: "Request barang", singular: "Request barang", icon: ShoppingCart, idPrefix: "RB",
    columns: [
      { key: "nomor", label: "Nomor", primary: true, flex: 1.3 },
      { key: "project", label: "Project", flex: 1.6 },
      { key: "sumberPengadaan", label: "Sumber", flex: 1.2 },
      { key: "metodePembayaran", label: "Pembayaran", flex: 1.1 },
      { key: "item", label: "Barang", flex: 2 },
      { key: "estimasi", label: "Estimasi", fmt: "rupiah" },
      { key: "tanggal", label: "Tanggal", fmt: "date" },
      { key: "jatuhTempo", label: "Jatuh tempo", fmt: "date" },
      { key: "status", label: "Status", fmt: "status", mobile: true },
    ],
    fields: [
      { label: "Tanggal", key: "tanggal", fmt: "date" },
      { label: "Jatuh tempo", key: "jatuhTempo", fmt: "date" },
      { label: "Pemohon", key: "pemohon" },
      { label: "Jenis biaya", key: "jenisBiaya" }, { label: "Project", key: "project" },
      { label: "Sumber pengadaan", key: "sumberPengadaan" }, { label: "Metode pembayaran", key: "metodePembayaran" },
      { label: "Alokasi akuntansi", key: "alokasiAkuntansi" },
      { label: "Barang", key: "item" }, { label: "Estimasi harga", key: "estimasi", fmt: "rupiah" },
      { label: "Tujuan", key: "tujuan" },
    ],
    statusKey: "status",
    statuses: ["Diajukan", "Cek stok", "Disetujui", "Dibayar", "PO dibuat", "Dikirim", "Diterima", "Diterima (Belum Lunas)", "Lunas"],
    titleOf: (r) => r.nomor, subtitleOf: (r) => r.item,
    search: ["nomor", "project", "item", "pemohon"],
    createLabel: "Buat request",
    newHref: "/purchase-requests/new",
    createFields: [
      { key: "jenisBiaya", label: "Jenis biaya", type: "select", required: true, options: ["Project", "Stok", "Internal", "Lainnya"] },
      { key: "project", label: "Project terkait", type: "select", options: ["-"] },
      { key: "tanggal", label: "Tanggal", type: "date" },
      { key: "jatuhTempo", label: "Jatuh tempo", type: "date" },
      { key: "tujuan", label: "Tujuan / kebutuhan", type: "textarea", required: true },
    ],
    createRoles: ["pm", "procurement", "finance", "gudang", "teknisi", "admin", "super_admin", "bos"],
    actions: [
      { label: "Teruskan ke Gudang", status: "Cek stok", toast: "Request diteruskan ke Gudang untuk cek ketersediaan stok" },
    ],
    docs: ["Bukti permintaan (WA, email, atau BOQ)", "Bukti Pembayaran / Transfer", "Surat Jalan / Delivery Order (DO)"],
    emptyText: "Belum ada request barang. Buat request untuk project atau stok.",
  },
  "supplier-pos": {
    key: "supplier-pos", title: "Purchase Order (PO)", singular: "Purchase Order", icon: Truck, idPrefix: "PO",
    columns: [
      { key: "nomor", label: "Nomor PO", primary: true, flex: 1.3 },
      { key: "nomorSoSupplier", label: "Nomor SO Supplier", flex: 1.3 },
      { key: "supplier", label: "Supplier", flex: 1.8 },
      { key: "item", label: "Barang", flex: 1.8 },
      { key: "total", label: "Total", fmt: "rupiah" },
      { key: "eta", label: "Perkiraan tiba", fmt: "date" },
      { key: "status", label: "Status", fmt: "status", mobile: true },
    ],
    fields: [
      { label: "Nomor PO", key: "nomor" },
      { label: "Nomor SO Supplier", key: "nomorSoSupplier" },
      { label: "Supplier", key: "supplier" },
      { label: "Pembuat PO", key: "pembuat" },
      { label: "Barang", key: "item" },
      { label: "Total", key: "total", fmt: "rupiah" },
      { label: "Tanggal PO", key: "tanggal", fmt: "date" },
      { label: "Perkiraan tiba", key: "eta", fmt: "date" },
      { label: "Persetujuan", key: "persetujuan", fmt: "status" },
      { label: "Pengiriman", key: "pengiriman", fmt: "status" },
    ],
    statusKey: "status",
    statuses: ["Menunggu persetujuan", "Disetujui", "Di Supplier", "Dikirim", "Sampai", "Sampai (Belum Lunas)", "Lunas", "Terlambat"],
    titleOf: (r) => `${r.nomor}${r.nomorSoSupplier && r.nomorSoSupplier !== "-" ? ` (SO: ${r.nomorSoSupplier})` : ""}`,
    subtitleOf: (r) => r.supplier,
    search: ["nomor", "nomorSoSupplier", "supplier", "item"],
    createLabel: "Buat Purchase Order (PO)",
    createFields: [
      { key: "nomor", label: "Nomor Purchase Order (PO) (Kosongkan untuk otomatis)", type: "text", placeholder: "Otomatis: PO/2026/10/001" },
      { key: "nomorSoSupplier", label: "Nomor Sales Order (SO) Supplier (Kosongkan jika belum ada)", type: "text", placeholder: "Contoh: SO/2026/10/001" },
      { key: "supplier", label: "Supplier", type: "select", required: true, options: [] },
      { key: "item", label: "Barang", type: "select", required: true, options: [] },
      { key: "total", label: "Total (Rp)", type: "number", required: true },
      { key: "tanggal", label: "Tanggal Dokumen", type: "date" },
      { key: "eta", label: "Perkiraan tiba", type: "date", required: true },
      { key: "payment", label: "Syarat pembayaran", type: "select", options: ["Tunai", "Net 14", "Net 30"] },
      { key: "fileId", label: "Upload File Purchase Order (PO) (Opsional)", type: "file" },
      { key: "soFileId", label: "Upload File Sales Order (SO) (Opsional)", type: "file" },
    ],
    defaults: { status: "Menunggu persetujuan", persetujuan: "Menunggu persetujuan", pengiriman: "Di Supplier", nomorSoSupplier: "-" },
    createRoles: ["procurement", "finance", "bos", "super_admin", "admin"],
    docs: ["File Purchase Order (PO) Terbitan Kita", "File Sales Order (SO) dari Supplier", "Bukti Delivery Order (DO) Supplier"],
    emptyText: "Belum ada PO pembelian ke supplier.",
  },
  receiving: {
    key: "receiving", title: "Penerimaan barang", singular: "Penerimaan", icon: PackageCheck, idPrefix: "RC",
    columns: [
      { key: "nomor", label: "Nomor", primary: true, flex: 1.3 },
      { key: "po", label: "PO", flex: 1.3 },
      { key: "supplier", label: "Supplier", flex: 2 },
      { key: "item", label: "Barang", flex: 2 },
      { key: "tanggal", label: "Tanggal", fmt: "date" },
      { key: "status", label: "Status", fmt: "status", mobile: true },
    ],
    fields: [
      { label: "PO supplier", key: "po" }, { label: "Supplier", key: "supplier" },
      { label: "Barang", key: "item" }, { label: "Tanggal", key: "tanggal", fmt: "date" },
      { label: "Penerima", key: "penerima" },
    ],
    statusKey: "status",
    statuses: ["Menunggu penerimaan", "Diterima sebagian", "Diterima"],
    titleOf: (r) => r.nomor, subtitleOf: (r) => r.supplier,
    search: ["nomor", "po", "supplier", "item"],
    createLabel: "Terima barang",
    newHref: "/receiving/new",
    createFields: [
      { key: "po", label: "PO supplier", type: "select", options: [] },
      { key: "warehouse", label: "Gudang penerima", type: "select", options: [] },
      { key: "tanggal", label: "Tanggal penerimaan", type: "date", required: true },
      { key: "conditionNote", label: "Catatan kondisi fisik", type: "textarea" },
    ],
    createRoles: ["gudang", "bos"],
    docs: ["File Delivery Order (DO) / Tanda Terima (Gambar / PDF)", "Foto kondisi barang"],
    emptyText: "Belum ada penerimaan barang.",
  },
  "delivery-notes": {
    key: "delivery-notes", title: "Surat jalan", singular: "Surat jalan", icon: FileSignature, idPrefix: "SJ",
    columns: [
      { key: "nomor", label: "Nomor", primary: true, flex: 1.4 },
      { key: "tujuan", label: "Tujuan", flex: 2 },
      { key: "alasan", label: "Alasan", flex: 2 },
      { key: "pembuat", label: "Pembuat" },
      { key: "tanggal", label: "Tanggal", fmt: "date" },
      { key: "status", label: "Status", fmt: "status", mobile: true },
    ],
    fields: [
      { label: "Tujuan", key: "tujuan" }, { label: "Alasan", key: "alasan" },
      { label: "Project", key: "project" },
      { label: "Sales Order (SO)", key: "soDisplay" },
      { label: "Invoice Terkait", key: "invoiceDisplay" },
      { label: "Tanggal", key: "tanggal", fmt: "date" },
      { label: "Pembawa", key: "pembuat" }, { label: "Barang", key: "barang" },
      { label: "Persetujuan", key: "persetujuan", fmt: "status" },
    ],
    statusKey: "status",
    statuses: ["Pending", "Dikirim", "Diterima", "Dibatalkan"],
    titleOf: (r) => r.nomor, subtitleOf: (r) => r.tujuan,
    search: ["nomor", "tujuan", "alasan", "pembuat"],
    createLabel: "Buat surat jalan",
    newHref: "/delivery-notes/new",
    createFields: [
      { key: "tujuan", label: "Lokasi tujuan", type: "text", required: true },
      { key: "alasan", label: "Alasan / keperluan", type: "textarea", required: true },
      { key: "project", label: "Project terkait", type: "select", options: ["-"] },
      { key: "tanggal", label: "Tanggal", type: "date", required: true },
      { key: "barang", label: "Barang yang dibawa", type: "text", placeholder: "Kosongkan atau '-' jika tanpa barang" },
    ],
    createRoles: ALL,
    actions: [{ label: "Upload dokumen / laporan hasil", toast: "Surat jalan & pengiriman berhasil diproses" }],
    docs: ["File DO / Surat Jalan Bertanda Tangan Kedua Pihak (Gambar / PDF)", "Laporan hasil dan dokumentasi"],
    emptyText: "Belum ada surat jalan. Buat surat jalan setiap kali keluar untuk urusan kerja.",
    confirmStatuses: ["Dibatalkan"],
  },
  expenses: {
    key: "expenses", title: "Pengeluaran", singular: "Pengeluaran", icon: Wallet, idPrefix: "EX",
    columns: [
      { key: "tanggal", label: "Tanggal", fmt: "date" },
      { key: "pelapor", label: "Pelapor" },
      { key: "kategori", label: "Kategori" },
      { key: "alasan", label: "Alasan", primary: true, flex: 2 },
      { key: "nominal", label: "Nominal", fmt: "rupiah" },
      { key: "status", label: "Status", fmt: "status", mobile: true },
    ],
    fields: [
      { label: "Tanggal", key: "tanggal", fmt: "date" }, { label: "Pelapor", key: "pelapor" },
      { label: "Kategori", key: "kategori" }, { label: "Nominal", key: "nominal", fmt: "rupiah" },
      { label: "Sumber Dana", key: "sumberDana" },
      { label: "Metode / Kas Bayar", key: "paymentMethod" },
      { label: "Project", key: "project" }, { label: "Survey", key: "survey" }, { label: "POC / Demo", key: "pocReport" }, { label: "Kunjungan / Meeting", key: "visitReport" },
      { label: "Alasan", key: "alasan" },
    ],
    statusKey: "status",
    statuses: ["Dilaporkan", "Disetujui", "Ditolak", "Dibayar"],
    titleOf: (r) => r.alasan, subtitleOf: (r) => `${r.pelapor} · ${r.kategori}`,
    search: ["alasan", "pelapor", "kategori", "project", "survey", "pocReport", "visitReport"],
    createLabel: "Catat pengeluaran",
    newHref: "/expenses/new",
    createFields: [
      { key: "nominal", label: "Nominal pengeluaran (Rp)", type: "number", required: true },
      { key: "kategori", label: "Kategori pengeluaran", type: "select", required: true, options: [] },
      { key: "sumberDana", label: "Sumber pendanaan", type: "select", options: ["Dana Perusahaan", "Talangan Pribadi (Reimbursement)"] },
      { key: "project", label: "Project terkait (opsional)", type: "select", options: ["-"] },
      { key: "survey", label: "Survey terkait (opsional)", type: "select", options: ["-"] },
      { key: "pocReport", label: "Kegiatan POC / Demo terkait (opsional)", type: "select", options: ["-"] },
      { key: "visitReport", label: "Kunjungan / Meeting terkait (opsional)", type: "select", options: ["-"] },
      { key: "tanggal", label: "Tanggal pengeluaran", type: "date", required: true },
      { key: "alasan", label: "Alasan / keperluan", type: "textarea", required: true },
      { key: "fileId", label: "Foto Nota Pembayaran", type: "file", kind: "foto", category: "foto-struk" },
    ],
    createRoles: ALL,
    docs: ["Foto nota", "Bukti transfer reimbursement"],
    emptyText: "Belum ada pengeluaran. Catat pengeluaran kerja kamu di sini.",
    confirmStatuses: ["Ditolak"],
  },
  "damage-reports": {
    key: "damage-reports", title: "Kerusakan & Retur Barang", singular: "Laporan kerusakan / retur", icon: TriangleAlert, idPrefix: "DR",
    columns: [
      { key: "produk", label: "Barang", primary: true, flex: 1.8 },
      { key: "sn", label: "SN Rusak / Retur", flex: 1.2 },
      { key: "snPengganti", label: "SN Pengganti", flex: 1.2 },
      { key: "jenis", label: "Jenis / Retur", fmt: "status" },
      { key: "po", label: "Ref PO / Inv", flex: 1.2 },
      { key: "tanggal", label: "Tanggal", fmt: "date" },
      { key: "status", label: "Status", fmt: "status", mobile: true },
    ],
    fields: [
      { label: "Barang", key: "produk" },
      { label: "SN Rusak / Retur", key: "sn" },
      { label: "SN / Unit Pengganti", key: "snPengganti" },
      { label: "Jenis / Kategori", key: "jenis" },
      { label: "Referensi PO / Invoice", key: "po" },
      { label: "Tanggal", key: "tanggal", fmt: "date" },
      { label: "Pelapor", key: "pelapor" },
      { label: "Keterangan", key: "keterangan" },
    ],
    statusKey: "status", statuses: ["Dilaporkan", "Diproses", "Selesai"],
    titleOf: (r) => r.produk, subtitleOf: (r) => `${r.jenis} · ${r.keterangan}`,
    search: ["produk", "sn", "po", "jenis", "keterangan"],
    createLabel: "Catat kerusakan / retur",
    createFields: [
      { key: "produk", label: "Barang", type: "select", required: true, options: [] },
      { key: "jenis", label: "Jenis laporan / retur", type: "select", required: true, options: ["Rusak", "Salah barang", "Kurang", "Retur Penjualan", "Retur Pembelian"] },
      { key: "qty", label: "Jumlah (Qty)", type: "number", placeholder: "1" },
      { key: "tanggal", label: "Tanggal kejadian / retur", type: "date" },
      { key: "po", label: "Nomor PO / Invoice terkait", type: "select", options: [] },
      { key: "keterangan", label: "Alasan / keterangan", type: "textarea", required: true },
      { key: "dokumen", label: "Foto bukti barang / retur (Opsional)", type: "file", kind: "foto", category: "laporan-kerusakan" },
    ],
    defaults: { status: "Dilaporkan" },
    docs: ["Foto barang bermasalah"],
    emptyText: "Belum ada laporan kerusakan atau retur barang.",
  },
  customers: {
    key: "customers", title: "Customer", singular: "Customer", icon: Building2, idPrefix: "C",
    columns: [
      { key: "nama", label: "Nama", primary: true, flex: 2 },
      { key: "kota", label: "Kota" },
      { key: "kontak", label: "Kontak", flex: 1.5 },
      { key: "email", label: "Email", flex: 1.5 },
      { key: "telepon", label: "Telepon" },
      { key: "status", label: "Status", fmt: "status", mobile: true },
    ],
    fields: [
      { label: "Kota", key: "kota" },
      { label: "Kontak PIC", key: "kontak" },
      { label: "Email", key: "email" },
      { label: "Telepon", key: "telepon" },
      { label: "Catatan Tambahan", key: "catatan" },
    ],
    statusKey: "status", statuses: ["Aktif", "Nonaktif"],
    titleOf: (r) => r.nama, subtitleOf: (r) => r.kota,
    search: ["nama", "kota", "kontak", "email", "catatan"],
    createLabel: "Tambah customer",
    createFields: [
      { key: "nama", label: "Nama perusahaan", type: "text", required: true },
      { key: "kota", label: "Kota", type: "text", required: true },
      { key: "kontak", label: "Nama kontak PIC", type: "text", required: true },
      { key: "email", label: "Email perusahaan / PIC", type: "text", placeholder: "contoh@perusahaan.com" },
      { key: "telepon", label: "Nomor telepon / WhatsApp", type: "text", placeholder: "0812-xxxx-xxxx" },
      { key: "catatan", label: "Catatan khusus customer", type: "textarea", placeholder: "Ketentuan pembayaran, lokasi pengiriman, preferensi teknis, dll." },
    ],
    defaults: { status: "Aktif", email: "-", catatan: "-" },
    emptyText: "Belum ada customer.",
  },
  suppliers: {
    key: "suppliers", title: "Supplier", singular: "Supplier", icon: Truck, idPrefix: "S",
    columns: [
      { key: "nama", label: "Nama", primary: true, flex: 2 },
      { key: "jenisUsaha", label: "Jenis Usaha", flex: 1 },
      { key: "tagSummary", label: "Tag Barang", flex: 2 },
      { key: "kota", label: "Kota" },
      { key: "kontak", label: "Kontak PIC" },
      { key: "payment", label: "Pembayaran" },
      { key: "status", label: "Status", fmt: "status", mobile: true },
    ],
    fields: [
      { label: "Jenis Usaha", key: "jenisUsaha" },
      { label: "Tag Barang", key: "tagSummary" },
      { label: "Kota", key: "kota" },
      { label: "Kontak PIC", key: "kontak" },
      { label: "Email", key: "email" },
      { label: "Telepon", key: "telepon" },
      { label: "Pembayaran", key: "payment" },
      { label: "Catatan", key: "catatan" },
    ],
    statusKey: "status", statuses: ["Aktif", "Nonaktif"],
    titleOf: (r) => r.nama, subtitleOf: (r) => `${r.jenisUsaha || "Non-PKP"} · ${r.kota || "-"}`,
    search: ["nama", "kota", "kontak", "tagSummary", "jenisUsaha"],
    createLabel: "Tambah supplier",
    createFields: [
      { key: "nama", label: "Nama supplier", type: "text", required: true },
      { key: "jenisUsaha", label: "Jenis Usaha (Perpajakan)", type: "select", options: ["PKP", "Non-PKP"], required: true },
      { key: "tagInput", label: "Tag Barang (Pisahkan koma, misal: HDD, SSD, RAM)", type: "text", placeholder: "Contoh: HDD: 500000, SSD, RAM" },
      { key: "kota", label: "Kota", type: "text", required: true },
      { key: "kontak", label: "Nama kontak PIC", type: "text", placeholder: "Contoh: Sales Support" },
      { key: "telepon", label: "Nomor telepon / WhatsApp", type: "text", placeholder: "021-xxxx / 0812-xxxx" },
      { key: "email", label: "Email supplier", type: "text", placeholder: "sales@supplier.co.id" },
      { key: "payment", label: "Syarat pembayaran", type: "select", options: ["Tunai", "Net 14", "Net 30"] },
      { key: "catatan", label: "Catatan supplier", type: "textarea" },
    ],
    defaults: { status: "Aktif", jenisUsaha: "Non-PKP" },
    createRoles: ["procurement", "admin", "bos", "super_admin"],
    emptyText: "Belum ada supplier.",
  },
  users: {
    key: "users", title: "Pengguna dan role", singular: "Pengguna", icon: UserCog, idPrefix: "U",
    columns: [
      { key: "name", label: "Nama", primary: true, flex: 1.5 },
      { key: "email", label: "Email", flex: 1.8 },
      { key: "phone", label: "Nomor Telepon", flex: 1.5 },
      { key: "roleLabel", label: "Role" },
      { key: "gudang", label: "Gudang", flex: 1.2 },
      { key: "status", label: "Status", fmt: "status", mobile: true },
    ],
    fields: [
      { label: "Email", key: "email" },
      { label: "Telepon", key: "phone" },
      { label: "Jabatan", key: "position" },
      { label: "Role", key: "roleLabel" },
      { label: "Gudang ditugaskan", key: "gudang" },
    ],
    statusKey: "status", statuses: ["Aktif", "Nonaktif"],
    titleOf: (r) => r.name, subtitleOf: (r) => r.email,
    search: ["name", "email", "roleLabel"],
    createLabel: "Tambah pengguna",
    createFields: [
      { key: "name", label: "Nama lengkap", type: "text", required: true, placeholder: "Masukkan nama lengkap" },
      { key: "email", label: "Email", type: "text", required: true, placeholder: "nama@taska.co.id" },
      { key: "password", label: "Kata sandi", type: "password", required: true, placeholder: "Masukkan kata sandi akun" },
      { key: "roleLabel", label: "Role", type: "select", required: true, options: ["Super Admin", "Admin / Bos", "HR", "Sales", "Project Manager", "Teknisi", "Procurement", "Finance", "Gudang", "Software Engineer"] },
      { key: "phone", label: "Nomor telepon", type: "text", placeholder: "0812-xxxx-xxxx" },
      { key: "position", label: "Jabatan", type: "text", placeholder: "Contoh: Senior Engineer" },
      { key: "gudang", label: "Gudang ditugaskan (Opsional)", type: "select", options: ["-"] },
    ],
    defaults: { status: "Aktif", gudang: "-" },
    actions: [{ label: "Alihkan tugas", toast: "Lead, project, dan tugas dialihkan ke orang lain" }],
    emptyText: "Belum ada pengguna.",
    confirmStatuses: ["Nonaktif"],
  },
  opname: {
    key: "opname", title: "Stok Opname", singular: "Opname", icon: ClipboardCheck, idPrefix: "OP",
    columns: [
      { key: "gudang", label: "Gudang", primary: true, flex: 1.5 },
      { key: "tanggal", label: "Tanggal", fmt: "date" },
      { key: "petugas", label: "Petugas", flex: 1.2 },
      { key: "selisih", label: "Total Selisih" },
      { key: "status", label: "Status", fmt: "status", mobile: true },
    ],
    fields: [
      { label: "Gudang", key: "gudang" },
      { label: "Tanggal", key: "tanggal", fmt: "date" },
      { label: "Petugas Pelaksana", key: "petugas" },
      { label: "Penjelasan Selisih & Alasan", key: "alasan" },
      { label: "Total Selisih Fisik", key: "selisih" },
    ],
    statusKey: "status",
    statuses: ["Draft", "Menunggu persetujuan", "Disetujui", "Ditolak"],
    titleOf: (r) => `Opname #${r.id} — ${r.gudang}`,
    subtitleOf: (r) => `${r.petugas} · ${r.tanggal}`,
    search: ["gudang", "petugas", "alasan"],
    emptyText: "Belum ada riwayat stok opname.",
  },
  "audit-log": {
    key: "audit-log", title: "Audit log", singular: "Log", icon: ScrollText, idPrefix: "AL",
    columns: [
      { key: "waktu", label: "Waktu", fmt: "date" },
      { key: "pengguna", label: "Pengguna" },
      { key: "aksi", label: "Aksi", primary: true, flex: 2.5 },
      { key: "jenis", label: "Jenis data" },
      { key: "refId", label: "ID" },
    ],
    fields: [], statusKey: "", statuses: [],
    titleOf: (r) => r.aksi, subtitleOf: (r) => r.pengguna,
    search: ["pengguna", "aksi", "jenis", "refId"],
    emptyText: "Belum ada aktivitas tercatat.",
  },
  "poc-reports": {
    key: "poc-reports",
    title: "Laporan POC / Demo",
    singular: "Laporan POC",
    icon: Presentation,
    idPrefix: "POC",
    columns: [
      { key: "nomor", label: "Nomor POC", primary: true, flex: 1.5 },
      { key: "judul", label: "Judul Kegiatan", flex: 2 },
      { key: "tipe", label: "Tipe POC" },
      { key: "tanggal", label: "Tanggal", fmt: "date" },
      { key: "klien", label: "Klien / Acara" },
      { key: "pemilik", label: "PIC / Owner" },
      { key: "status", label: "Status Alur", fmt: "status", mobile: true },
      { key: "hasilStatus", label: "Hasil Uji", fmt: "status" },
      { key: "biaya", label: "Biaya Aktual", fmt: "rupiah" },
    ],
    fields: [
      { label: "Nomor POC", key: "nomor" },
      { label: "Judul kegiatan", key: "judul" },
      { label: "Tipe POC", key: "tipe" },
      { label: "Tanggal pelaksanaan", key: "tanggal", fmt: "date" },
      { label: "Tanggal selesai", key: "tanggalSelesai", fmt: "date" },
      { label: "Lokasi", key: "lokasi" },
      { label: "Klien / Mitra", key: "klien" },
      { label: "Project terkait", key: "project" },
      { label: "Lead terkait", key: "lead" },
      { label: "PIC / Pemilik", key: "pemilik" },
      { label: "Tim bertugas", key: "tim" },
      { label: "Target & Kriteria", key: "targetCriteria" },
      { label: "Perangkat / Produk diuji", key: "productsTested" },
      { label: "Anggaran", key: "anggaran", fmt: "rupiah" },
      { label: "Biaya aktual", key: "biaya", fmt: "rupiah" },
      { label: "Deskripsi", key: "deskripsi" },
    ],
    statusKey: "status",
    statuses: ["Draft", "Planned", "Preparation", "Ready", "In Progress", "Completed", "On Hold", "Cancelled"],
    titleOf: (r) => r.judul || r.nomor,
    subtitleOf: (r) => r.klien || r.lokasi || "POC Report",
    search: ["nomor", "judul", "klien", "lokasi", "pemilik", "project"],
    createLabel: "Tambah Laporan POC",
    createFields: [
      { key: "judul", label: "Judul Kegiatan POC / Demo", type: "text", required: true, placeholder: "Contoh: Demo UNV AI Camera di Gedung Mandiri" },
      { key: "tipe", label: "Tipe POC", type: "select", options: ["Demo Klien", "Pameran / Expo", "Pengujian Internal"], required: true },
      { key: "tanggal", label: "Tanggal Mulai", type: "date", required: true },
      { key: "tanggalSelesai", label: "Tanggal Selesai (Opsional)", type: "date" },
      { key: "lokasi", label: "Lokasi Kegiatan", type: "text", placeholder: "Nama gedung, stand expo, alamat" },
      { key: "klien", label: "Nama Klien / Acara", type: "text", placeholder: "Contoh: PT Bank Mandiri / Expo Security 2026" },
      { key: "customer", label: "Pilih Customer Terdaftar (Opsional)", type: "select", options: ["-"] },
      { key: "lead", label: "Pilih Lead Terdaftar (Opsional)", type: "select", options: ["-"] },
      { key: "project", label: "Hubungkan ke Project (Opsional)", type: "select", options: [] },
      { key: "tim", label: "Anggota Tim POC (Pilih Karyawan / Staf)", type: "multiselect", options: [] },
      { key: "anggaran", label: "Anggaran Biaya (Rp)", type: "number", placeholder: "0" },
      { key: "targetCriteria", label: "Target & Kriteria Keberhasilan", type: "textarea", placeholder: "Parameter pengujian, fitur yang dites..." },
      { key: "productsTested", label: "Perangkat / Produk yang Diuji", type: "textarea", placeholder: "Daftar tipe kamera, NVR, software..." },
      { key: "deskripsi", label: "Deskripsi / Catatan Tambahan", type: "textarea" },
    ],
    createRoles: ["pm", "sales", "teknisi", "se"],
    emptyText: "Belum ada laporan POC.",
  },
  "visit-reports": {
    key: "visit-reports",
    title: "Laporan Kunjungan",
    singular: "Laporan Kunjungan",
    icon: Handshake,
    idPrefix: "VISIT",
    columns: [
      { key: "nomor", label: "Nomor Kunjungan", primary: true, flex: 1.5 },
      { key: "judul", label: "Nama Aktivitas", flex: 2 },
      { key: "tipe", label: "Jenis Aktivitas" },
      { key: "tanggal", label: "Tanggal", fmt: "date" },
      { key: "klien", label: "Klien / Instansi" },
      { key: "pemilik", label: "PIC / Owner" },
      { key: "status", label: "Status", fmt: "status", mobile: true },
      { key: "totalBiaya", label: "Total Biaya", fmt: "rupiah" },
    ],
    fields: [
      { label: "Nomor Kunjungan", key: "nomor" },
      { label: "Nama aktivitas", key: "judul" },
      { label: "Jenis aktivitas", key: "tipe" },
      { label: "Tanggal pelaksanaan", key: "tanggal", fmt: "date" },
      { label: "Waktu selesai", key: "tanggalSelesai", fmt: "date" },
      { label: "Lokasi", key: "lokasi" },
      { label: "Klien / Perusahaan", key: "klien" },
      { label: "Kontak / Peserta Klien", key: "kontakKlien" },
      { label: "Customer terdaftar", key: "customer" },
      { label: "Project terkait", key: "project" },
      { label: "Lead terkait", key: "lead" },
      { label: "PIC / Pemilik", key: "pemilik" },
      { label: "Tim hadir", key: "tim" },
      { label: "Tujuan kunjungan", key: "tujuan" },
      { label: "Total biaya", key: "totalBiaya", fmt: "rupiah" },
      { label: "Deskripsi", key: "deskripsi" },
    ],
    statusKey: "status",
    statuses: ["Planned", "Completed", "Cancelled"],
    titleOf: (r) => r.judul || r.nomor,
    subtitleOf: (r) => r.klien || r.lokasi || "Kunjungan Meeting",
    search: ["nomor", "judul", "klien", "lokasi", "pemilik", "project"],
    createLabel: "Tambah Laporan Kunjungan",
    createFields: [
      { key: "judul", label: "Nama / Judul Aktivitas", type: "text", required: true, placeholder: "Contoh: Diskusi Solusi CCTV di Kantor Klien" },
      { key: "tipe", label: "Jenis Aktivitas", type: "select", options: ["Product Introduction", "Product Presentation / Demo", "Business Meeting", "Project Coordination", "Negotiation", "Follow-up Meeting", "Other"], required: true },
      { key: "tanggal", label: "Tanggal Kunjungan", type: "date", required: true },
      { key: "tanggalSelesai", label: "Tanggal Selesai (Opsional)", type: "date" },
      { key: "klien", label: "Nama Klien / Instansi", type: "text", placeholder: "PT Contoh Sukses / Dinas Terkait" },
      { key: "kontakKlien", label: "Kontak / Peserta Pihak Klien", type: "text", placeholder: "Nama PIC atau staf klien" },
      { key: "lokasi", label: "Lokasi Kunjungan", type: "text", placeholder: "Alamat atau ruangan pertemuan" },
      { key: "customer", label: "Pilih Customer Terdaftar (Opsional)", type: "select", options: ["-"] },
      { key: "lead", label: "Pilih Lead Terdaftar (Opsional)", type: "select", options: ["-"] },
      { key: "project", label: "Hubungkan ke Project (Opsional)", type: "select", options: [] },
      { key: "tim", label: "Anggota Tim Hadir (Karyawan / Staf)", type: "multiselect", options: [] },
      { key: "tujuan", label: "Tujuan Kunjungan", type: "textarea", placeholder: "Maksud dan target utama pertemuan..." },
      { key: "deskripsi", label: "Deskripsi / Catatan Singkat", type: "textarea" },
    ],
    createRoles: ["pm", "sales", "teknisi", "se"],
    emptyText: "Belum ada riwayat kunjungan.",
  },
};

export type NavItem = { key: string; label: string; short?: string; href: string; icon: LucideIcon };

const N = {
  dashboard: { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  calendar: { key: "calendar", label: "Kalender Kerja", short: "Kalender", href: "/calendar", icon: CalendarDays },
  approvals: { key: "approvals", label: "Persetujuan", href: "/approvals", icon: CheckSquare },
  leads: { key: "leads", label: "Leads", href: "/leads", icon: Target },
  quotations: { key: "quotations", label: "Penawaran", href: "/quotations", icon: FileText },
  surveys: { key: "surveys", label: "Survey", href: "/surveys", icon: ClipboardList },
  pocReports: { key: "poc-reports", label: "Laporan POC & Demo", short: "POC", href: "/poc-reports", icon: Presentation },
  visitReports: { key: "visit-reports", label: "Laporan Kunjungan", short: "Kunjungan", href: "/visit-reports", icon: Handshake },
  customers: { key: "customers", label: "Customer", href: "/customers", icon: Building2 },
  projects: { key: "projects", label: "Project", href: "/projects", icon: Briefcase },
  myProjects: { key: "projects", label: "Project saya", short: "Project", href: "/projects", icon: Briefcase },
  tasks: { key: "tasks", label: "Tugas", href: "/tasks", icon: ListChecks },
  requests: { key: "purchase-requests", label: "Request barang", short: "Request", href: "/purchase-requests", icon: ShoppingCart },
  supplierPos: { key: "supplier-pos", label: "Purchase Order (PO)", short: "PO", href: "/supplier-pos", icon: Truck },
  shipments: { key: "shipments", label: "Pengiriman", href: "/shipments", icon: Truck },
  receiving: { key: "receiving", label: "Penerimaan", href: "/receiving", icon: PackageCheck },
  stock: { key: "stock", label: "Barang, Jasa & SN", short: "Stok", href: "/stock", icon: Boxes },
  stockView: { key: "stock", label: "Barang, Jasa & SN", short: "Stok", href: "/stock", icon: Boxes },
  invoices: { key: "invoices", label: "Invoice & Receipt", short: "Invoice", href: "/invoices", icon: Receipt },
  poClient: { key: "po-client", label: "Sales Order (SO)", short: "SO", href: "/po-client", icon: FileCheck },
  opname: { key: "opname", label: "Opname", href: "/opname", icon: ClipboardCheck },
  delivery: { key: "delivery-notes", label: "Delivery / Surat Jalan", short: "Delivery", href: "/delivery-notes", icon: FileSignature },
  expenses: { key: "expenses", label: "Pengeluaran", short: "Biaya", href: "/expenses", icon: Wallet },
  accounting: { key: "accounting", label: "Buku Besar & COA", short: "Akuntansi", href: "/accounting", icon: BookOpen },
  damage: { key: "damage-reports", label: "Kerusakan & Retur", short: "Retur", href: "/damage-reports", icon: TriangleAlert },
  reports: { key: "reports", label: "Laporan", href: "/reports", icon: BarChart3 },
  master: { key: "master-data", label: "Master data", href: "/master-data", icon: Database },
  users: { key: "users", label: "Pengguna", href: "/users", icon: UserCog },
  archive: { key: "archive", label: "Archive", href: "/archive", icon: Archive },
  hr: { key: "hr", label: "Absensi & Payroll", short: "HR", href: "/hr", icon: UserCheck },
  audit: { key: "audit-log", label: "Audit log", href: "/audit-log", icon: ScrollText },
} satisfies Record<string, NavItem>;

export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  super_admin: [
    N.dashboard, N.calendar, N.approvals, N.leads, N.quotations, N.surveys, N.pocReports, N.visitReports, N.customers,
    N.projects, N.tasks, N.requests, N.supplierPos, N.shipments, N.receiving,
    N.stock, N.opname, N.delivery, N.poClient, N.invoices, N.expenses,
    N.accounting, N.damage, N.reports, N.hr, N.master, N.users, N.archive, N.audit,
  ],
  admin: [N.dashboard, N.calendar, N.approvals, N.users, N.master, N.leads, N.quotations, N.poClient, N.delivery, N.surveys, N.pocReports, N.visitReports, N.projects, N.requests, N.supplierPos, N.invoices, N.accounting, N.hr, N.stock, N.damage, N.reports, N.archive, N.audit],
  bos: [N.dashboard, N.calendar, N.approvals, N.users, N.master, N.leads, N.quotations, N.poClient, N.delivery, N.surveys, N.pocReports, N.visitReports, N.projects, N.requests, N.supplierPos, N.invoices, N.accounting, N.hr, N.stock, N.damage, N.reports, N.archive, N.audit],
  sales: [N.dashboard, N.calendar, N.leads, N.quotations, N.poClient, N.delivery, N.surveys, N.pocReports, N.visitReports, N.customers, N.expenses, N.hr, N.master],
  pm: [N.dashboard, N.calendar, N.projects, N.surveys, N.pocReports, N.visitReports, N.requests, N.delivery, N.expenses, N.hr],
  teknisi: [N.dashboard, N.calendar, N.surveys, N.pocReports, N.visitReports, N.myProjects, N.tasks, N.requests, N.delivery, N.expenses, N.hr],
  procurement: [N.dashboard, N.calendar, N.approvals, N.requests, N.supplierPos, N.shipments, N.receiving, N.delivery, N.stockView, N.opname, N.damage, N.expenses, N.hr, N.master],
  finance: [N.dashboard, N.calendar, N.approvals, N.requests, N.supplierPos, N.invoices, N.poClient, N.delivery, N.accounting, N.expenses, N.reports, N.hr],
  gudang: [N.dashboard, N.calendar, N.approvals, N.requests, N.supplierPos, N.stock, N.receiving, N.delivery, N.opname, N.damage, N.hr, N.master],
  se: [N.dashboard, N.calendar, N.myProjects, N.tasks, N.surveys, N.pocReports, N.visitReports, N.delivery, N.expenses, N.hr],
  hr: [N.dashboard, N.calendar, N.hr, N.users, N.expenses, N.visitReports, N.pocReports, N.requests, N.reports],
};

export const CAN_APPROVE: Role[] = ["super_admin", "admin", "bos", "finance", "gudang", "procurement"];

const ALL_NAV_ORDERED: NavItem[] = [
  N.dashboard, N.calendar, N.approvals, N.leads, N.quotations, N.surveys, N.pocReports, N.visitReports, N.customers,
  N.projects, N.tasks, N.requests, N.supplierPos, N.shipments, N.receiving,
  N.stock, N.opname, N.delivery, N.poClient, N.invoices, N.expenses,
  N.accounting, N.damage, N.reports, N.hr, N.master, N.users, N.archive, N.audit,
];

const CLIENT_MODULE_ALIASES: Record<string, string[]> = {
  "po-client": ["po-client", "po_client", "sales-order"],
  "purchase-requests": ["purchase-requests", "requests"],
  "supplier-pos": ["supplier-pos", "supplier_pos", "shipments"],
  "delivery-notes": ["delivery-notes", "delivery"],
  "damage-reports": ["damage-reports", "damage"],
  "master-data": ["master-data", "master", "customers", "suppliers", "products", "warehouses"],
  "audit-log": ["audit-log", "audit"],
  "poc-reports": ["poc-reports", "poc_reports"],
  "visit-reports": ["visit-reports", "visit_reports"],
  stock: ["stock", "products", "serials", "movements", "warehouses"],
  shipments: ["shipments", "supplier-pos", "supplier_pos"],
};

let CLIENT_DYNAMIC_ROLES: RoleDef[] = [...DEFAULT_SYSTEM_ROLES];

export function setClientDynamicRoles(roles: RoleDef[]) {
  if (!Array.isArray(roles) || roles.length === 0) {
    CLIENT_DYNAMIC_ROLES = [...DEFAULT_SYSTEM_ROLES];
    return;
  }
  const byCode = new Map<string, RoleDef>();
  for (const def of DEFAULT_SYSTEM_ROLES) {
    byCode.set(def.code, { ...def });
  }
  for (const r of roles) {
    if (!r?.code) continue;
    const norm = r.code.toUpperCase();
    const existing = byCode.get(norm);
    const hasPerms = r.permissions && Object.keys(r.permissions).length > 0;
    
    // Normalisasi format array atau string ke ActionCode[]
    const normalizedPerms: Record<string, ActionCode[]> = {};
    const sourcePerms: Record<string, any> = (hasPerms ? r.permissions : existing?.permissions) || {};
    for (const [k, rawVal] of Object.entries(sourcePerms)) {
      const v: any = rawVal;
      if (Array.isArray(v)) {
        normalizedPerms[k] = v as ActionCode[];
      } else if (typeof v === "string" && v.length > 0) {
        normalizedPerms[k] = v
          .split("")
          .filter((c: string): c is ActionCode => ["M", "L", "C", "U", "A", "P", "V", "E"].includes(c));
      }
    }

    // Jika ada modul bawaan yang belum didefinisikan, isi dari default sistem
    if (existing?.permissions) {
      for (const [k, v] of Object.entries(existing.permissions)) {
        if (!normalizedPerms[k] || normalizedPerms[k].length === 0) {
          normalizedPerms[k] = [...v];
        }
      }
    }

    byCode.set(norm, {
      code: norm,
      name: r.name || existing?.name || norm,
      description: r.description ?? existing?.description ?? "",
      isSystem: existing?.isSystem ?? r.isSystem ?? false,
      permissions: normalizedPerms,
    });
  }
  CLIENT_DYNAMIC_ROLES = Array.from(byCode.values());
  const labelOptions: string[] = [];
  for (const r of CLIENT_DYNAMIC_ROLES) {
    const uiCode = r.code.toLowerCase();
    ROLE_LABEL[uiCode] = r.name;
    ROLE_LABEL[r.code] = r.name;
    if (!labelOptions.includes(r.name)) {
      labelOptions.push(r.name);
    }
  }
  const roleField = MODULES.users?.createFields?.find((f) => f.key === "roleLabel");
  if (roleField && labelOptions.length > 0) {
    roleField.options = labelOptions;
  }
}

export function getClientDynamicRoles(): RoleDef[] {
  return CLIENT_DYNAMIC_ROLES;
}

export function findRoleDefForUser(user: User | null | undefined): RoleDef | undefined {
  if (!user?.role) return undefined;
  const upper = String(user.role).toUpperCase();
  return CLIENT_DYNAMIC_ROLES.find(
    (r) => r.code.toUpperCase() === upper || r.name.toLowerCase() === String(user.roleLabel || "").toLowerCase(),
  );
}

export function hasUserPermission(
  user: User | null | undefined,
  moduleKey: string,
  action: ActionCode = "L",
): boolean {
  if (!user?.role) return false;
  const roleLower = String(user.role).toLowerCase();
  if (roleLower === "super_admin" || roleLower === "admin" || roleLower === "bos") return true;

  const dyn = findRoleDefForUser(user);
  if (dyn && dyn.permissions) {
    const candidates = CLIENT_MODULE_ALIASES[moduleKey] ?? [moduleKey];
    for (const key of candidates) {
      const acts: any = dyn.permissions[key];
      if (Array.isArray(acts)) {
        if (acts.includes(action)) return true;
        // Jika cek Lihat Data ('L') dan role punya Menu ('M'), otomatis boleh
        if (action === "L" && acts.includes("M")) return true;
      } else if (typeof acts === "string") {
        if (acts.includes(action)) return true;
        if (action === "L" && acts.includes("M")) return true;
      }
    }
    // Jika role dynamic sudah terdaftar dan dikelola hak aksesnya, keputusan dyn.permissions adalah absolut.
    return false;
  }

  // Fallback to static NAV_BY_ROLE / createRoles jika role belum memiliki konfigurasi dynamic
  if (action === "M" || action === "L") {
    const nav = NAV_BY_ROLE[roleLower] ?? [];
    return nav.some((n) => n.key === moduleKey);
  }
  if (action === "C" || action === "U") {
    const def = MODULES[moduleKey];
    if (def?.createRoles) return def.createRoles.includes(roleLower);
    const nav = NAV_BY_ROLE[roleLower] ?? [];
    return nav.some((n) => n.key === moduleKey);
  }
  if (action === "V") {
    return CAN_APPROVE.includes(roleLower);
  }
  if (action === "P") {
    return ["super_admin", "admin", "bos", "finance", "procurement", "sales", "pm"].includes(roleLower);
  }
  return false;
}

export function canUserApprove(user: User | null | undefined): boolean {
  if (!user?.role) return false;
  const roleLower = String(user.role).toLowerCase();
  if (CAN_APPROVE.includes(roleLower)) return true;
  const dyn = findRoleDefForUser(user);
  if (dyn) {
    const appr: any = dyn.permissions?.approvals;
    if (Array.isArray(appr) && (appr.includes("L") || appr.includes("V") || appr.includes("M"))) return true;
    if (typeof appr === "string" && (appr.includes("L") || appr.includes("V") || appr.includes("M"))) return true;
    return Object.values(dyn.permissions ?? {}).some(
      (acts: any) => (Array.isArray(acts) && acts.includes("V")) || (typeof acts === "string" && acts.includes("V")),
    );
  }
  return false;
}

export function getNavForUser(user: User | null | undefined): NavItem[] {
  if (!user?.role) return NAV_BY_ROLE.sales;
  const roleLower = String(user.role).toLowerCase();
  if (roleLower === "super_admin" || roleLower === "admin" || roleLower === "bos") {
    return NAV_BY_ROLE[roleLower] ?? ALL_NAV_ORDERED;
  }

  const dyn = findRoleDefForUser(user);
  if (dyn && dyn.permissions && Object.keys(dyn.permissions).length > 0) {
    const filtered = ALL_NAV_ORDERED.filter((item) => {
      if (item.key === "dashboard" || item.key === "calendar") {
        return hasUserPermission(user, item.key, "M") || hasUserPermission(user, item.key, "L");
      }
      return hasUserPermission(user, item.key, "M");
    });
    if (filtered.length > 0) return filtered;
  }

  return NAV_BY_ROLE[roleLower] ?? [N.dashboard, N.calendar];
}

