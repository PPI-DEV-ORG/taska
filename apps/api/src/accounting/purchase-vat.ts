import { round } from "./accounting.types.js";

/**
 * PPN pembelian.
 * Harga di Request Barang / PO bisa "include" (sudah termasuk PPN 11%), "exclude" (PPN ditambahkan) atau "none".
 * Persediaan & HPP selalu dinilai SEBELUM PPN (DPP); PPN-nya masuk PPN Masukan (1600), bukan ke harga barang.
 */
export const PPN_RATE = 0.11;
export type PurchasePpnMode = "none" | "exclude" | "include";

export function purchasePpnMode(v: unknown): PurchasePpnMode {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "include" || s === "exclude" ? s : "none";
}

/** Harga satuan sebelum PPN. Harga "include" dibagi 1,11; selain itu harga sudah DPP. */
export function netUnitCost(price: number, mode: unknown): number {
  const p = Number(price) || 0;
  return purchasePpnMode(mode) === "include" ? p / (1 + PPN_RATE) : p;
}

/**
 * Pecah pembayaran pembelian menjadi kliring GRNI (= nilai barang sebelum PPN, sama dengan jurnal terima barang)
 * dan PPN Masukan.
 *   include : barang = Σ(harga) / 1,11, PPN = Σ(harga) − barang
 *   exclude : barang = Σ(harga),        PPN = dibayar − Σ(harga)  (atau nilai PPN yang tercatat)
 *   none    : tanpa PPN (selisih di atas Σ harga dari data lama tetap dianggap PPN)
 */
export function splitPurchasePayment(input: {
  /** Kas yang keluar. */
  paid: number;
  /** Σ qty × harga item (sesuai mode PPN dokumennya). */
  itemsSum: number;
  mode: unknown;
  /** Nilai PPN yang tercatat di dokumen (PO), bila ada. */
  ppn?: number | null;
}): { goods: number; vat: number } {
  const paid = round(Number(input.paid) || 0);
  const itemsSum = round(Number(input.itemsSum) || 0);
  const mode = purchasePpnMode(input.mode);
  const recorded = round(Number(input.ppn) || 0);
  let vat = 0;
  if (mode === "include") {
    vat = recorded > 0 ? recorded : itemsSum > 0 ? round(itemsSum - itemsSum / (1 + PPN_RATE)) : round(paid - paid / (1 + PPN_RATE));
  } else if (mode === "exclude") {
    vat = recorded > 0 ? recorded : itemsSum > 0 ? Math.max(0, paid - itemsSum) : round(paid - paid / (1 + PPN_RATE));
  } else if (itemsSum > 0 && paid > itemsSum) {
    vat = round(paid - itemsSum);
  }
  vat = Math.min(Math.max(0, vat), paid);
  return { goods: round(paid - vat), vat };
}

/** Perkiraan PPN atas nilai barang diterima (sebelum PPN), untuk keterangan jurnal. */
export function receivingPpnInfo(rec: { supplierPo?: { ppnMode?: unknown } | null; request?: { ppnMode?: unknown } | null }, netValue: number): number {
  const mode = purchasePpnMode(rec.supplierPo?.ppnMode ?? rec.request?.ppnMode);
  return mode === "none" ? 0 : round(Number(netValue) * PPN_RATE);
}

type ReceivingLike = {
  supplierPo?: { total?: unknown; ppnMode?: unknown; items?: Array<{ productId: number | null; price: unknown }> } | null;
  request?: { ppnMode?: unknown; items?: Array<{ productId: number | null; unitCost: unknown }> } | null;
  items?: Array<{ qtyReceived?: unknown }>;
};

/**
 * Harga pokok satuan (sebelum PPN) barang yang diterima, untuk jurnal Persediaan dan rata-rata harga produk.
 * Urutan: harga PO → harga request → harga beli/rata-rata produk → PO terakhir produk → total PO / qty.
 */
export async function receivingUnitCost(
  client: any,
  rec: ReceivingLike,
  item: { productId: number; product?: { purchasePrice?: unknown; avgCost?: unknown } | null },
): Promise<number> {
  const poMode = rec.supplierPo?.ppnMode ?? rec.request?.ppnMode;
  const poItem = rec.supplierPo?.items?.find((p) => p.productId === item.productId);
  if (poItem && Number(poItem.price) > 0) return netUnitCost(Number(poItem.price), poMode);

  const reqItem = rec.request?.items?.find((r) => r.productId === item.productId);
  if (reqItem && Number(reqItem.unitCost) > 0) return netUnitCost(Number(reqItem.unitCost), rec.request?.ppnMode);

  // Harga beli & rata-rata produk sudah disimpan sebelum PPN
  const own = Number(item.product?.purchasePrice ?? 0) || Number(item.product?.avgCost ?? 0);
  if (own > 0) return own;

  if (item.productId) {
    const lastPo = await client.supplierPOItem
      .findFirst({
        where: { productId: item.productId, price: { gt: 0 } },
        orderBy: { id: "desc" },
        select: { price: true, po: { select: { ppnMode: true, request: { select: { ppnMode: true } } } } },
      })
      .catch(() => null);
    if (lastPo && Number(lastPo.price) > 0) {
      return netUnitCost(Number(lastPo.price), lastPo.po?.ppnMode ?? lastPo.po?.request?.ppnMode);
    }
  }

  const poTotal = Number(rec.supplierPo?.total ?? 0);
  if (poTotal > 0) {
    const totalQty = (rec.items || []).reduce((s, it) => s + (Number(it.qtyReceived) || 1), 0) || 1;
    // Total PO sudah termasuk PPN baik include maupun exclude
    const mode = purchasePpnMode(poMode);
    return (mode === "none" ? poTotal : poTotal / (1 + PPN_RATE)) / totalQty;
  }
  return 0;
}
