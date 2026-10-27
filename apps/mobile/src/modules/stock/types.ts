export const STOCK_TABS = [
  "List Barang & Jasa",
  "Per Gudang",
  "Per Serial Number",
  "Pergerakan Stok",
  "Reservasi Project",
] as const;

export type StockTab = typeof STOCK_TABS[number];

export type ItemKind = "BARANG_SN" | "BARANG_NON_SN" | "JASA";

export type DetailTarget = {
  type: "product" | "warehouse_product" | "serial" | "movement" | "reservation";
  data: any;
};

