import type { LucideIcon } from "lucide-react-native";
import {
  Archive,
  Boxes,
  BarChart3,
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
  Wallet,
  FileSignature,
} from "lucide-react-native";
import type { Role, Row } from "@/mock/data";

export type Fmt = "rupiah" | "date" | "status" | "pct" | "text" | "number";
export type Col = { key: string; label: string; fmt?: Fmt; primary?: boolean; mobile?: boolean; flex?: number; width?: number | string };
export type Field = { label: string; key: string; fmt?: Fmt };
export type CreateField = {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "date" | "textarea";
  options?: string[];
  required?: boolean;
  placeholder?: string;
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

const ALL: Role[] = ["bos", "sales", "pm", "teknisi", "procurement", "finance", "gudang", "se"];

export const MODULES: Record<string, ModuleDef> = {
  leads: {
    key: "leads", title: "Leads", singular: "Lead", icon: Target, idPrefix: "L",
    columns: [
      { key: "nama", label: "Nama", primary: true, flex: 2 },
      { key: "perusahaan", label: "Perusahaan", flex: 1.5 },
      { key: "sumber", label: "Sumber" },
      { key: "nilai", label: "Nilai", fmt: "rupiah" },
      { key: "peluang", label: "Peluang", fmt: "pct" },
      { key: "closing", label: "Closing", fmt: "date" },
      { key: "pemilik", label: "Pemilik" },
      { key: "status", label: "Status", fmt: "status", mobile: true },
    ],
    fields: [
      { label: "Perusahaan", key: "perusahaan" }, { label: "Kontak", key: "kontak" },
      { label: "Sumber", key: "sumber" }, { label: "Tipe client", key: "tipe" },
      { label: "Nilai perkiraan", key: "nilai", fmt: "rupiah" }, { label: "Peluang", key: "peluang", fmt: "pct" },
      { label: "Perkiraan closing", key: "closing", fmt: "date" }, { label: "Pemilik", key: "pemilik" },
    ],
    statusKey: "status",
    statuses: ["Prospecting", "Qualification", "Proposal", "Negotiation", "Won", "Lost"],
    titleOf: (r) => r.nama, subtitleOf: (r) => r.perusahaan,
    search: ["nama", "perusahaan", "pemilik", "sumber"],
    createLabel: "Tambah lead",
    createFields: [
      { key: "nama", label: "Nama lead", type: "text", required: true, placeholder: "Contoh: CCTV Gudang Baru" },
      { key: "perusahaan", label: "Perusahaan", type: "select", required: true, options: ["PT Nusantara Jaya", "CV Karya Mandiri", "PT Bumi Sentosa", "PT Sinar Medan Teknik", "RS Harapan Sehat", "Hotel Grand Mahkota", "Sekolah Global Cendekia", "PT Logistik Prima"] },
      { key: "sumber", label: "Sumber", type: "select", required: true, options: ["Sosial media", "Website", "Cold call", "Referral", "Event", "Distributor", "Lainnya"] },
      { key: "nilai", label: "Nilai perkiraan (Rp)", type: "number" },
    ],
    defaults: { status: "Prospecting", peluang: 20, sepi: 0, tipe: "End user", kontak: "-", closing: "2026-11-30", pemilik: "Dewi Lestari" },
    actions: [
      { label: "Buat penawaran", toast: "Draf penawaran dibuat", to: () => "/quotations" },
      { label: "Minta survey", toast: "Permintaan survey dikirim ke PM" },
      { label: "Jadikan project", toast: "Project baru dibuat dari lead ini", to: () => "/projects" },
    ],
    docs: ["Catatan kebutuhan"],
    emptyText: "Belum ada lead. Tambah lead pertama untuk mulai melacak peluang.",
    confirmStatuses: ["Lost"],
  },
  quotations: {
    key: "quotations", title: "Penawaran", singular: "Penawaran", icon: FileText, idPrefix: "Q",
    columns: [
      { key: "nomor", label: "Nomor", primary: true, flex: 1.5 },
      { key: "customer", label: "Customer", flex: 1.5 },
      { key: "nilai", label: "Nilai", fmt: "rupiah" },
      { key: "versi", label: "Versi" },
      { key: "berlaku", label: "Berlaku s/d", fmt: "date" },
      { key: "status", label: "Status", fmt: "status", mobile: true },
    ],
    fields: [
      { label: "Customer", key: "customer" }, { label: "Lead", key: "lead" },
      { label: "Nilai", key: "nilai", fmt: "rupiah" }, { label: "Versi terakhir", key: "versi" },
      { label: "Berlaku sampai", key: "berlaku", fmt: "date" }, { label: "Dibuat", key: "dibuat", fmt: "date" },
      { label: "Pemilik", key: "pemilik" },
    ],
    statusKey: "status",
    statuses: ["Draft", "Menunggu persetujuan", "Disetujui", "Terkirim", "Revisi", "Ditolak", "Kedaluwarsa"],
    titleOf: (r) => r.nomor, subtitleOf: (r) => r.lead,
    search: ["nomor", "customer", "lead"],
    createLabel: "Buat penawaran",
    createFields: [
      { key: "nomor", label: "Nomor penawaran", type: "text", required: true, placeholder: "PNW/2026/10/004" },
      { key: "customer", label: "Customer", type: "select", required: true, options: ["PT Nusantara Jaya", "CV Karya Mandiri", "PT Bumi Sentosa", "RS Harapan Sehat", "Hotel Grand Mahkota"] },
      { key: "nilai", label: "Nilai (Rp)", type: "number", required: true },
      { key: "berlaku", label: "Berlaku sampai", type: "date", required: true },
    ],
    defaults: { status: "Draft", versi: 1, lead: "-", pemilik: "Dewi Lestari", dibuat: "2026-10-08" },
    actions: [{ label: "Kirim ke customer", toast: "Penawaran ditandai terkirim", status: "Terkirim" }],
    docs: ["File penawaran"],
    emptyText: "Belum ada penawaran. Buat penawaran dari lead yang sudah siap.",
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
      { label: "Customer", key: "customer" }, { label: "Lokasi", key: "lokasi" },
      { label: "Jadwal", key: "jadwal", fmt: "date" }, { label: "Tim survey", key: "tim" },
      { label: "Biaya survey", key: "biaya", fmt: "rupiah" },
    ],
    statusKey: "status",
    statuses: ["Diminta", "Dijadwalkan", "Berjalan", "Selesai"],
    titleOf: (r) => r.lead, subtitleOf: (r) => r.customer,
    search: ["lead", "customer", "lokasi"],
    createLabel: "Minta survey",
    createFields: [
      { key: "lead", label: "Kebutuhan / nama lead", type: "text", required: true },
      { key: "customer", label: "Customer", type: "select", required: true, options: ["PT Nusantara Jaya", "CV Karya Mandiri", "PT Bumi Sentosa", "RS Harapan Sehat", "Hotel Grand Mahkota", "Sekolah Global Cendekia", "PT Logistik Prima"] },
      { key: "lokasi", label: "Lokasi", type: "text", required: true },
      { key: "jadwal", label: "Tanggal survey", type: "date", required: true },
      { key: "tim", label: "Tim survey", type: "select", required: true, options: ["PM + Teknisi", "Teknisi saja", "SE saja"] },
    ],
    defaults: { status: "Diminta", biaya: 0 },
    actions: [{ label: "Laporkan biaya survey", toast: "Biaya survey dikirim ke Finance" }],
    docs: ["Foto atau video lokasi", "Catatan dan dokumen survey"],
    emptyText: "Belum ada survey. Minta survey bila kebutuhan client belum jelas.",
  },
  "po-client": {
    key: "po-client", title: "PO client", singular: "PO client", icon: FileCheck, idPrefix: "PO-C",
    columns: [
      { key: "nomor", label: "Nomor PO", primary: true, flex: 1.5 },
      { key: "customer", label: "Customer", flex: 1.5 },
      { key: "penawaran", label: "Penawaran", flex: 1.3 },
      { key: "nilai", label: "Nilai PO", fmt: "rupiah" },
      { key: "totalInvoice", label: "Total invoice", fmt: "rupiah" },
      { key: "tanggal", label: "Tanggal", fmt: "date" },
    ],
    fields: [
      { label: "Customer", key: "customer" }, { label: "Penawaran asal", key: "penawaran" },
      { label: "Nilai PO", key: "nilai", fmt: "rupiah" }, { label: "Total invoice", key: "totalInvoice", fmt: "rupiah" },
      { label: "Tanggal PO", key: "tanggal", fmt: "date" },
    ],
    statusKey: "status", statuses: ["Diterima"],
    titleOf: (r) => r.nomor, subtitleOf: (r) => r.customer,
    search: ["nomor", "customer", "penawaran"],
    createLabel: "Catat PO client",
    createFields: [
      { key: "nomor", label: "Nomor PO", type: "text", required: true },
      { key: "customer", label: "Customer", type: "select", required: true, options: ["PT Nusantara Jaya", "CV Karya Mandiri", "PT Bumi Sentosa", "RS Harapan Sehat", "Hotel Grand Mahkota"] },
      { key: "nilai", label: "Nilai PO (Rp)", type: "number", required: true },
      { key: "tanggal", label: "Tanggal PO", type: "date", required: true },
    ],
    defaults: { status: "Diterima", penawaran: "-", totalInvoice: 0 },
    docs: ["File PO dari client"],
    emptyText: "Belum ada PO client. Upload PO setelah penawaran disetujui client.",
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
      { label: "Customer", key: "customer" }, { label: "PO client", key: "po" }, { label: "Jenis", key: "jenis" },
      { label: "Nilai", key: "nilai", fmt: "rupiah" }, { label: "PPN 11%", key: "ppn", fmt: "rupiah" },
      { label: "Total", key: "total", fmt: "rupiah" }, { label: "Sudah dibayar", key: "terbayar", fmt: "rupiah" },
      { label: "Tanggal", key: "tanggal", fmt: "date" }, { label: "Jatuh tempo", key: "jatuhTempo", fmt: "date" },
    ],
    statusKey: "status",
    statuses: ["Belum dikirim", "Terkirim", "Dibayar sebagian", "Lunas", "Terlambat"],
    titleOf: (r) => r.nomor, subtitleOf: (r) => `${r.customer} · ${r.jenis}`,
    search: ["nomor", "customer", "po"],
    createLabel: "Catat invoice",
    createFields: [
      { key: "nomor", label: "Nomor invoice", type: "text", required: true },
      { key: "customer", label: "Customer", type: "select", required: true, options: ["PT Nusantara Jaya", "CV Karya Mandiri", "PT Bumi Sentosa", "RS Harapan Sehat", "Hotel Grand Mahkota"] },
      { key: "jenis", label: "Jenis", type: "select", required: true, options: ["DP", "Termin", "Pelunasan"] },
      { key: "nilai", label: "Nilai sebelum PPN (Rp)", type: "number", required: true },
      { key: "jatuhTempo", label: "Jatuh tempo", type: "date", required: true },
    ],
    defaults: { status: "Belum dikirim", terbayar: 0, po: "-", tanggal: "2026-10-08" },
    actions: [{ label: "Catat pembayaran", toast: "Pembayaran dicatat" }],
    docs: ["File invoice", "Bukti pembayaran"],
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
      { key: "nama", label: "Nama project", type: "text", required: true },
      { key: "jenis", label: "Jenis", type: "select", required: true, options: ["Customer", "Product/R&D", "Internal", "Maintenance", "Support", "Lainnya"] },
      { key: "customer", label: "Customer", type: "select", options: ["-", "PT Nusantara Jaya", "CV Karya Mandiri", "PT Bumi Sentosa", "RS Harapan Sehat", "Hotel Grand Mahkota"] },
      { key: "selesai", label: "Target selesai", type: "date", required: true },
    ],
    defaults: { status: "Berjalan", progres: 0, pembayaran: "Belum lunas", pm: "Budi Santoso", tim: "-", mulai: "2026-10-08", barang: "Diminta" },
    emptyText: "Belum ada project yang kamu pegang.",
    confirmStatuses: ["Ditunda"],
  },
  "purchase-requests": {
    key: "purchase-requests", title: "Request barang", singular: "Request barang", icon: ShoppingCart, idPrefix: "RB",
    columns: [
      { key: "nomor", label: "Nomor", primary: true, flex: 1.3 },
      { key: "project", label: "Project", flex: 2 },
      { key: "item", label: "Barang", flex: 2 },
      { key: "estimasi", label: "Estimasi", fmt: "rupiah" },
      { key: "tanggal", label: "Tanggal", fmt: "date" },
      { key: "status", label: "Status", fmt: "status", mobile: true },
    ],
    fields: [
      { label: "Tanggal", key: "tanggal", fmt: "date" }, { label: "Pemohon", key: "pemohon" },
      { label: "Jenis biaya", key: "jenisBiaya" }, { label: "Project", key: "project" },
      { label: "Barang", key: "item" }, { label: "Estimasi harga", key: "estimasi", fmt: "rupiah" },
      { label: "Tujuan", key: "tujuan" },
    ],
    statusKey: "status",
    statuses: ["Diajukan", "Cek stok", "Disetujui", "PO dibuat", "Dikirim", "Diterima"],
    titleOf: (r) => r.nomor, subtitleOf: (r) => r.item,
    search: ["nomor", "project", "item", "pemohon"],
    createLabel: "Buat request",
    newHref: "/purchase-requests/new",
    createRoles: ["pm", "procurement", "finance", "gudang", "bos"],
    actions: [
      { label: "Teruskan ke Gudang", toast: "Stok tersedia, request diteruskan ke Gudang tanpa PO" },
      { label: "Buat PO supplier", toast: "PO supplier dibuat, menunggu persetujuan", to: () => "/supplier-pos" },
    ],
    docs: ["Bukti permintaan (WA, email, atau BOQ)"],
    emptyText: "Belum ada request barang. Buat request untuk project atau stok.",
  },
  "supplier-pos": {
    key: "supplier-pos", title: "PO supplier", singular: "PO supplier", icon: Truck, idPrefix: "SP",
    columns: [
      { key: "nomor", label: "Nomor PO", primary: true, flex: 1.3 },
      { key: "supplier", label: "Supplier", flex: 2 },
      { key: "item", label: "Barang", flex: 2 },
      { key: "total", label: "Total", fmt: "rupiah" },
      { key: "eta", label: "Perkiraan tiba", fmt: "date" },
      { key: "status", label: "Status", fmt: "status", mobile: true },
    ],
    fields: [
      { label: "Supplier", key: "supplier" }, { label: "Barang", key: "item" },
      { label: "Total", key: "total", fmt: "rupiah" }, { label: "Tanggal PO", key: "tanggal", fmt: "date" },
      { label: "Perkiraan tiba", key: "eta", fmt: "date" }, { label: "Persetujuan", key: "persetujuan", fmt: "status" },
      { label: "Pengiriman", key: "pengiriman", fmt: "status" },
    ],
    statusKey: "status",
    statuses: ["Menunggu persetujuan", "Disetujui", "Di Supplier", "Dikirim", "Sampai", "Terlambat"],
    titleOf: (r) => r.nomor, subtitleOf: (r) => r.supplier,
    search: ["nomor", "supplier", "item"],
    createLabel: "Buat PO supplier",
    createFields: [
      { key: "nomor", label: "Nomor PO", type: "text", required: true },
      { key: "supplier", label: "Supplier", type: "select", required: true, options: ["PT Hikvision Distribusi Indonesia", "CV Kabel Nusantara", "PT Ubiquiti Mitra Network", "UD Sinar Teknik Surabaya"] },
      { key: "item", label: "Barang", type: "text", required: true },
      { key: "total", label: "Total (Rp)", type: "number", required: true },
      { key: "eta", label: "Perkiraan tiba", type: "date", required: true },
    ],
    defaults: { status: "Menunggu persetujuan", persetujuan: "Menunggu persetujuan", pengiriman: "Di Supplier", tanggal: "2026-10-08" },
    createRoles: ["procurement", "finance", "bos"],
    docs: ["File PO", "Bukti Delivery Order (DO)"],
    emptyText: "Belum ada PO supplier.",
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
    createRoles: ["gudang", "bos"],
    docs: ["Foto kondisi barang", "Tanda terima"],
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
      { label: "Project", key: "project" }, { label: "Tanggal", key: "tanggal", fmt: "date" },
      { label: "Pembawa", key: "pembuat" }, { label: "Barang", key: "barang" },
      { label: "Persetujuan", key: "persetujuan", fmt: "status" },
    ],
    statusKey: "status",
    statuses: ["Pending", "Dikirim", "Diterima", "Dibatalkan"],
    titleOf: (r) => r.nomor, subtitleOf: (r) => r.tujuan,
    search: ["nomor", "tujuan", "alasan", "pembuat"],
    createLabel: "Buat surat jalan",
    newHref: "/delivery-notes/new",
    createRoles: ALL,
    actions: [{ label: "Upload laporan hasil", toast: "Laporan hasil disimpan" }],
    docs: ["Scan surat bertanda tangan", "Laporan hasil dan dokumentasi"],
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
      { label: "Project", key: "project" }, { label: "Alasan", key: "alasan" },
    ],
    statusKey: "status",
    statuses: ["Dilaporkan", "Disetujui", "Ditolak", "Dibayar"],
    titleOf: (r) => r.alasan, subtitleOf: (r) => `${r.pelapor} · ${r.kategori}`,
    search: ["alasan", "pelapor", "kategori", "project"],
    createLabel: "Catat pengeluaran",
    newHref: "/expenses/new",
    createRoles: ALL,
    docs: ["Foto nota", "Bukti transfer reimbursement"],
    emptyText: "Belum ada pengeluaran. Catat pengeluaran kerja kamu di sini.",
    confirmStatuses: ["Ditolak"],
  },
  "damage-reports": {
    key: "damage-reports", title: "Laporan kerusakan", singular: "Laporan kerusakan", icon: TriangleAlert, idPrefix: "DR",
    columns: [
      { key: "produk", label: "Barang", primary: true, flex: 2 },
      { key: "jenis", label: "Jenis", fmt: "status" },
      { key: "po", label: "PO", flex: 1.3 },
      { key: "tanggal", label: "Tanggal", fmt: "date" },
      { key: "status", label: "Status", fmt: "status", mobile: true },
    ],
    fields: [
      { label: "Barang", key: "produk" }, { label: "Jenis", key: "jenis" }, { label: "PO", key: "po" },
      { label: "Tanggal", key: "tanggal", fmt: "date" }, { label: "Pelapor", key: "pelapor" },
      { label: "Keterangan", key: "keterangan" },
    ],
    statusKey: "status", statuses: ["Dilaporkan", "Diproses", "Selesai"],
    titleOf: (r) => r.produk, subtitleOf: (r) => r.keterangan,
    search: ["produk", "po", "keterangan"],
    createLabel: "Laporkan kerusakan",
    createFields: [
      { key: "produk", label: "Barang", type: "text", required: true },
      { key: "jenis", label: "Jenis masalah", type: "select", required: true, options: ["Rusak", "Salah barang", "Kurang"] },
      { key: "po", label: "Nomor PO", type: "text" },
      { key: "keterangan", label: "Keterangan", type: "textarea", required: true },
    ],
    defaults: { status: "Dilaporkan", pelapor: "Eko Saputra", tanggal: "2026-10-08" },
    docs: ["Foto barang bermasalah"],
    emptyText: "Belum ada laporan kerusakan. Semoga tetap kosong.",
  },
  customers: {
    key: "customers", title: "Customer", singular: "Customer", icon: Building2, idPrefix: "C",
    columns: [
      { key: "nama", label: "Nama", primary: true, flex: 2 },
      { key: "kota", label: "Kota" },
      { key: "kontak", label: "Kontak", flex: 1.5 },
      { key: "telepon", label: "Telepon" },
      { key: "status", label: "Status", fmt: "status", mobile: true },
    ],
    fields: [
      { label: "Kota", key: "kota" }, { label: "Kontak", key: "kontak" }, { label: "Telepon", key: "telepon" },
    ],
    statusKey: "status", statuses: ["Aktif", "Nonaktif"],
    titleOf: (r) => r.nama, subtitleOf: (r) => r.kota,
    search: ["nama", "kota", "kontak"],
    createLabel: "Tambah customer",
    createFields: [
      { key: "nama", label: "Nama perusahaan", type: "text", required: true },
      { key: "kota", label: "Kota", type: "text", required: true },
      { key: "kontak", label: "Nama kontak", type: "text", required: true },
      { key: "telepon", label: "Telepon", type: "text" },
    ],
    defaults: { status: "Aktif" },
    createRoles: ["bos"],
    emptyText: "Belum ada customer.",
  },
  suppliers: {
    key: "suppliers", title: "Supplier", singular: "Supplier", icon: Truck, idPrefix: "S",
    columns: [
      { key: "nama", label: "Nama", primary: true, flex: 2 },
      { key: "kota", label: "Kota" },
      { key: "payment", label: "Pembayaran" },
      { key: "status", label: "Status", fmt: "status", mobile: true },
    ],
    fields: [{ label: "Kota", key: "kota" }, { label: "Pembayaran", key: "payment" }],
    statusKey: "status", statuses: ["Aktif", "Nonaktif"],
    titleOf: (r) => r.nama, subtitleOf: (r) => r.kota,
    search: ["nama", "kota"],
    createLabel: "Tambah supplier",
    createFields: [
      { key: "nama", label: "Nama supplier", type: "text", required: true },
      { key: "kota", label: "Kota", type: "text", required: true },
      { key: "payment", label: "Pembayaran", type: "select", options: ["Tunai", "Net 14", "Net 30"] },
    ],
    defaults: { status: "Aktif" },
    emptyText: "Belum ada supplier.",
  },
  users: {
    key: "users", title: "Pengguna dan role", singular: "Pengguna", icon: UserCog, idPrefix: "U",
    columns: [
      { key: "name", label: "Nama", primary: true, flex: 1.5 },
      { key: "email", label: "Email", flex: 2 },
      { key: "roleLabel", label: "Role" },
      { key: "gudang", label: "Gudang", flex: 1.5 },
      { key: "status", label: "Status", fmt: "status", mobile: true },
    ],
    fields: [
      { label: "Email", key: "email" }, { label: "Role", key: "roleLabel" }, { label: "Gudang ditugaskan", key: "gudang" },
    ],
    statusKey: "status", statuses: ["Aktif", "Nonaktif"],
    titleOf: (r) => r.name, subtitleOf: (r) => r.email,
    search: ["name", "email", "roleLabel"],
    createLabel: "Tambah pengguna",
    createFields: [
      { key: "name", label: "Nama lengkap", type: "text", required: true },
      { key: "email", label: "Email", type: "text", required: true },
      { key: "roleLabel", label: "Role", type: "select", required: true, options: ["Admin / Bos", "Sales", "Project Manager", "Teknisi", "Procurement", "Finance", "Gudang", "Software Engineer"] },
    ],
    defaults: { status: "Aktif", gudang: "-" },
    actions: [{ label: "Alihkan tugas", toast: "Lead, project, dan tugas dialihkan ke orang lain" }],
    emptyText: "Belum ada pengguna.",
    confirmStatuses: ["Nonaktif"],
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
};

export type NavItem = { key: string; label: string; short?: string; href: string; icon: LucideIcon };

const N = {
  dashboard: { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  approvals: { key: "approvals", label: "Persetujuan", href: "/approvals", icon: CheckSquare },
  leads: { key: "leads", label: "Leads", href: "/leads", icon: Target },
  quotations: { key: "quotations", label: "Penawaran", href: "/quotations", icon: FileText },
  surveys: { key: "surveys", label: "Survey", href: "/surveys", icon: ClipboardList },
  customers: { key: "customers", label: "Customer", href: "/customers", icon: Building2 },
  projects: { key: "projects", label: "Project", href: "/projects", icon: Briefcase },
  myProjects: { key: "projects", label: "Project saya", short: "Project", href: "/projects", icon: Briefcase },
  tasks: { key: "tasks", label: "Tugas", href: "/tasks", icon: ListChecks },
  requests: { key: "purchase-requests", label: "Request barang", short: "Request", href: "/purchase-requests", icon: ShoppingCart },
  supplierPos: { key: "supplier-pos", label: "PO supplier", short: "PO", href: "/supplier-pos", icon: Truck },
  shipments: { key: "shipments", label: "Pengiriman", href: "/shipments", icon: Truck },
  receiving: { key: "receiving", label: "Penerimaan", href: "/receiving", icon: PackageCheck },
  stock: { key: "stock", label: "Stok dan SN", short: "Stok", href: "/stock", icon: Boxes },
  stockView: { key: "stock", label: "Stok (lihat)", short: "Stok", href: "/stock", icon: Boxes },
  invoices: { key: "invoices", label: "Invoice dan pembayaran", short: "Invoice", href: "/invoices", icon: Receipt },
  poClient: { key: "po-client", label: "PO client", href: "/po-client", icon: FileCheck },
  opname: { key: "opname", label: "Opname", href: "/opname", icon: ClipboardCheck },
  delivery: { key: "delivery-notes", label: "Surat jalan", short: "Surat jalan", href: "/delivery-notes", icon: FileSignature },
  expenses: { key: "expenses", label: "Pengeluaran", short: "Biaya", href: "/expenses", icon: Wallet },
  damage: { key: "damage-reports", label: "Laporan kerusakan", short: "Kerusakan", href: "/damage-reports", icon: TriangleAlert },
  reports: { key: "reports", label: "Laporan", href: "/reports", icon: BarChart3 },
  master: { key: "master-data", label: "Master data", href: "/master-data", icon: Database },
  users: { key: "users", label: "Pengguna", href: "/users", icon: UserCog },
  archive: { key: "archive", label: "Archive", href: "/archive", icon: Archive },
  audit: { key: "audit-log", label: "Audit log", href: "/audit-log", icon: ScrollText },
} satisfies Record<string, NavItem>;

export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  bos: [N.dashboard, N.approvals, N.leads, N.projects, N.invoices, N.stock, N.reports, N.master, N.users, N.archive, N.audit],
  sales: [N.dashboard, N.leads, N.quotations, N.surveys, N.customers],
  pm: [N.dashboard, N.projects, N.surveys, N.requests, N.delivery, N.expenses],
  teknisi: [N.dashboard, N.surveys, N.myProjects, N.delivery, N.expenses],
  procurement: [N.dashboard, N.requests, N.supplierPos, N.shipments, N.receiving, N.stockView],
  finance: [N.dashboard, N.approvals, N.invoices, N.quotations, N.poClient, N.expenses, N.opname],
  gudang: [N.dashboard, N.stock, N.receiving, N.delivery, N.opname, N.damage],
  se: [N.dashboard, N.myProjects, N.tasks, N.surveys, N.delivery, N.expenses],
};

export const CAN_APPROVE: Role[] = ["bos", "finance"];
