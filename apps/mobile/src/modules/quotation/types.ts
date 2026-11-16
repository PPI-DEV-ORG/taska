import type { PphMode } from "./lib";

export type QuotationItem = {
  id: string;
  item: string;
  qty: number;
  satuan: string;
  unit?: string;
  harga: number;
  price?: number;
  kind?: "GOODS" | "SERVICE";
  productId?: number;
  sku?: string;
  hasSerial?: boolean;
  serialUnitIds?: number[];
  serialNumbers?: string[];
  outOfStockAutoSwap?: boolean;
  pphMode?: PphMode;
  tipePph?: string;
  /** Diskon baris dalam Rupiah (untuk seluruh qty). */
  diskon?: number;
  /** Diskon baris dalam persen; bila diisi, `diskon` dihitung ulang dari harga terbaru. */
  diskonPct?: number;
};
