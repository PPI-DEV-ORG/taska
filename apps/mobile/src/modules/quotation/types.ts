export type QuotationItem = {
  id: string;
  item: string;
  qty: number;
  satuan: string;
  harga: number;
  kind?: "GOODS" | "SERVICE";
  productId?: number;
  sku?: string;
  hasSerial?: boolean;
  serialUnitIds?: number[];
  serialNumbers?: string[];
  outOfStockAutoSwap?: boolean;
};
