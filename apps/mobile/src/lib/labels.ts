/**
 * Kamus istilah UI (satu pintu). Tujuan: bahasa konsisten (Indonesia) dan tidak ambigu.
 *
 * Aturan:
 *  - Satu konsep = satu istilah. Satu istilah = satu arti.
 *  - "Terkirim" = DOKUMEN sudah dikirim ke pihak lain (penawaran, faktur).
 *    "Dikirim"  = BARANG sudah dikirim (permintaan barang, PO, surat jalan).
 *    "Diterima" = barang sudah diterima di tujuan (Gudang / pemohon).
 *  - "Dibayar" = ada pembayaran; "Lunas" = tagihan terbayar penuh.
 *
 * Nilai data (label internal yang dibandingkan di banyak kode) TIDAK diubah; hanya tampilannya
 * lewat statusText(). Warna/ikon badge tetap memakai nilai internal.
 */

/** Label status internal -> teks tampilan. Yang tidak ada di sini tampil apa adanya. */
const STATUS_TEXT: Record<string, string> = {
  // Prospek (leads)
  Prospecting: "Prospek",
  Qualification: "Kualifikasi",
  Proposal: "Penawaran",
  Negotiation: "Negosiasi",
  Won: "Menang",
  Lost: "Kalah",
  // Penawaran
  "Not Yet": "Belum dibuat",
  Done: "Draf selesai",
  Draft: "Draf",
  // Laporan POC & kunjungan
  Planned: "Direncanakan",
  Preparation: "Persiapan",
  Ready: "Siap",
  "In Progress": "Berjalan",
  Completed: "Selesai",
  "On Hold": "Ditunda",
  Cancelled: "Dibatalkan",
  // Tugas
  TODO: "Belum dikerjakan",
  "IN PROGRESS": "Dikerjakan",
  PENDING: "Menunggu",
  TESTED: "Diuji",
  DONE: "Selesai",
  REJECTED: "Ditolak",
  BLOCKED: "Terhambat",
  // Pembayaran: satu istilah untuk "sebagian dibayar"
  "Lunas sebagian": "Dibayar sebagian",
  // Pengiriman PO ke pemasok: tiga nama untuk dua keadaan disatukan
  "Di Supplier": "Belum dikirim",
  "Dalam Perjalanan": "Dikirim",
  Sampai: "Diterima Gudang",
  "Sampai (Belum Lunas)": "Diterima (Belum Lunas)",
};

export function statusText(status: string | null | undefined): string {
  if (status == null) return "";
  return STATUS_TEXT[status] ?? status;
}

/**
 * Istilah modul / menu. Dipakai nav, judul halaman, dan tombol buat.
 * Satu konsep = satu nama di seluruh aplikasi.
 */
export const TERM = {
  dashboard: "Beranda",
  leads: "Prospek",
  lead: "Prospek",
  customer: "Pelanggan",
  customers: "Pelanggan",
  supplier: "Pemasok",
  suppliers: "Pemasok",
  project: "Proyek",
  projects: "Proyek",
  quotation: "Penawaran",
  salesOrder: "Pesanan Penjualan (SO)",
  salesInvoice: "Faktur Penjualan",
  purchaseRequest: "Permintaan Barang",
  purchaseOrder: "Pesanan Pembelian (PO)",
  /** PO dari pelanggan = Pesanan Penjualan yang punya nomor PO pelanggan. */
  poIn: "PO Masuk (dari pelanggan)",
  /** PO ke pemasok. */
  poOut: "PO Keluar (ke pemasok)",
  receiving: "Penerimaan Barang",
  supplierShipment: "Pengiriman dari Pemasok",
  deliveryNote: "Surat Jalan",
  supplierInvoice: "Faktur Pemasok",
  stockOpname: "Stok Opname",
  masterData: "Data Master",
  archive: "Arsip",
  auditLog: "Log Audit",
  users: "Pengguna",
  payroll: "Absensi & Penggajian",
} as const;
