/**
 * Diskon per item (penawaran & invoice).
 *
 * Kolom `discount` di header dokumen = TOTAL diskon (diskon per item + diskon tambahan), sehingga rumus
 * "total kotor − diskon" tetap berlaku di semua modul. Item hanya membawa porsi diskonnya sendiri agar
 * dokumen bisa menampilkan nilai baris setelah diskon.
 */

/** Diskon baris dalam Rupiah: persen dihitung ulang dari qty × harga, dibatasi 0..nilai baris. */
export function itemLineDiscount(it: { qty?: unknown; harga?: unknown; diskon?: unknown; diskonPct?: unknown }): number {
  const gross = (Number(it.qty) || 0) * (Number(it.harga) || 0);
  const pct = Number(it.diskonPct) || 0;
  const raw = pct > 0 ? (gross * Math.min(100, pct)) / 100 : Number(it.diskon) || 0;
  return Math.max(0, Math.min(gross, Math.round(raw)));
}

/** Field diskon item yang disimpan (hanya bila bernilai). */
export function itemDiscountFields(it: any): { diskon?: number; diskonPct?: number } {
  const pct = Number(it?.diskonPct) || 0;
  const nominal = Number(it?.diskon) || 0;
  if (!(pct > 0) && !(nominal > 0)) return {};
  const diskon = itemLineDiscount({ qty: it.qty, harga: it.harga ?? it.price, diskon: nominal, diskonPct: pct });
  return { ...(pct > 0 ? { diskonPct: Math.min(100, pct) } : {}), diskon };
}

/** Total diskon per item pada daftar item. */
export function sumItemDiscounts(items: any[] | null | undefined): number {
  return (Array.isArray(items) ? items : []).reduce((s, it) => s + itemLineDiscount(it), 0);
}
