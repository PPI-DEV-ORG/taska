export type MasterKey =
  | "customer"
  | "supplier"
  | "barang"
  | "kategori-barang"
  | "gudang"
  | "sumber-lead"
  | "alasan-lost"
  | "jenis-transaksi"
  | "jenis-kunjungan"
  | "kategori-pengeluaran"
  | "cost-center"
  | "kategori-aset"
  | "lokasi-aset"
  | "pengaturan-sistem";

export type DeleteTarget = {
  module: string;
  id: string;
  label: string;
  singular: string;
};

