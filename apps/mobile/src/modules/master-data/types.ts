export type MasterKey =
  | "customer"
  | "supplier"
  | "barang"
  | "kategori-barang"
  | "gudang"
  | "sumber-lead"
  | "alasan-lost"
  | "jenis-kunjungan"
  | "kategori-pengeluaran"
  | "cost-center"
  | "pengaturan-sistem";

export type DeleteTarget = {
  module: string;
  id: string;
  label: string;
  singular: string;
};

