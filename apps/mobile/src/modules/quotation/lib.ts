import type { Row } from "@/constants/modules";

export type PpnMode = "exclude" | "include" | "none";

export type PphMode = "none" | "pph21" | "pph23" | "pph4_2" | "pph22";

export const PPN_MODE_OPTIONS: { id: PpnMode; label: string }[] = [
  { id: "exclude", label: "Exclude PPN (11%)" },
  { id: "include", label: "Include PPN" },
  { id: "none", label: "No PPN" },
];

export const PPH_MODE_OPTIONS: { id: PphMode; label: string; rate: number; desc: string }[] = [
  { id: "none", label: "Tanpa PPh", rate: 0, desc: "Tidak ada pemotongan PPh (0%)" },
  { id: "pph23", label: "PPh 23 (2%)", rate: 0.02, desc: "Jasa Teknik / IT / Instalasi Badan (2%)" },
  { id: "pph4_2", label: "PPh 4(2) (1.75%)", rate: 0.0175, desc: "Jasa Konstruksi / Renovasi (1.75%)" },
  { id: "pph21", label: "PPh 21 (2.5%)", rate: 0.025, desc: "Jasa Tenaga Ahli / Orang Pribadi (2.5%)" },
  { id: "pph22", label: "PPh 22 (1.5%)", rate: 0.015, desc: "Pembelian Instansi Pemerintah / BUMN (1.5%)" },
];

export function pphRateFor(mode: PphMode): number {
  const opt = PPH_MODE_OPTIONS.find((o) => o.id === mode);
  return opt ? opt.rate : 0;
}

export function getInitialPpnMode(row: Row | null | undefined): PpnMode {
  if (!row) return "exclude";
  if (row.tipePpn === "Include PPN (Sudah termasuk)" || row.ppnMode === "include" || String(row.tipePpn || "").toLowerCase().includes("include")) return "include";
  if (
    row.ppnMode === "exclude" ||
    String(row.tipePpn || "").toLowerCase().includes("exclude") ||
    Number(row.ppn || 0) > 0 ||
    (Number(row.total || 0) > Number(row.nilai || row.amount || 0) && Number(row.nilai || row.amount || 0) > 0)
  )
    return "exclude";
  if (
    row.tipePpn === "No PPN (Tanpa PPN)" ||
    row.ppnMode === "none" ||
    String(row.tipePpn || "").toLowerCase().includes("no") ||
    String(row.tipePpn || "").toLowerCase().includes("tanpa") ||
    (Number(row.ppn || 0) === 0 && ((row.disc ?? 0) > 0 || (row.total ?? 0) > 0 || (row.nilai ?? 0) > 0))
  )
    return "none";
  return "exclude";
}

export function ppnModeToTipe(mode: PpnMode): string {
  return mode === "exclude"
    ? "Exclude PPN (11%)"
    : mode === "include"
    ? "Include PPN (Sudah termasuk)"
    : "No PPN (Tanpa PPN)";
}

export function getInitialPphMode(row: Row | null | undefined): PphMode {
  if (!row) return "none";
  if (row.pphMode && row.pphMode !== "none") return row.pphMode as PphMode;
  if (row.tipePph && !String(row.tipePph).toLowerCase().includes("tanpa")) {
    const t = String(row.tipePph).toLowerCase();
    if (t.includes("23")) return "pph23";
    if (t.includes("4") || t.includes("konstruksi")) return "pph4_2";
    if (t.includes("21")) return "pph21";
    if (t.includes("22")) return "pph22";
  }
  if (Array.isArray(row.items)) {
    for (const it of row.items) {
      if (it.pphMode && it.pphMode !== "none") return it.pphMode as PphMode;
      if (it.tipePph && !String(it.tipePph).toLowerCase().includes("tanpa")) {
        const t = String(it.tipePph).toLowerCase();
        if (t.includes("23")) return "pph23";
        if (t.includes("4") || t.includes("konstruksi")) return "pph4_2";
        if (t.includes("21")) return "pph21";
        if (t.includes("22")) return "pph22";
      }
      if (Number(it.pph) > 0) return "pph23";
    }
  }
  return "none";
}

export function pphModeToTipe(mode: PphMode): string {
  const opt = PPH_MODE_OPTIONS.find((o) => o.id === mode);
  return opt ? opt.label : "Tanpa PPh";
}

// ── Diskon per item ─────────────────────────────────────────────────────────
// Item boleh punya diskon sendiri: `diskonPct` (persen) atau `diskon` (Rp untuk seluruh baris).
// Kolom diskon di header dokumen (penawaran/invoice) = TOTAL semua diskon (diskon item + diskon tambahan),
// sehingga rumus lama "total kotor − diskon" tetap berlaku di semua modul.

type DiscountableItem = { qty?: unknown; harga?: unknown; price?: unknown; diskon?: unknown; diskonPct?: unknown };

/** qty × harga (sebelum diskon). */
export function itemGross(it: DiscountableItem | null | undefined): number {
  if (!it) return 0;
  return (Number(it.qty) || 0) * (Number(it.harga ?? it.price ?? 0) || 0);
}

/** Diskon baris item dalam Rupiah (persen dihitung ulang dari harga terbaru), dibatasi 0..nilai baris. */
export function itemDiscount(it: DiscountableItem | null | undefined): number {
  if (!it) return 0;
  const gross = itemGross(it);
  const pct = Number(it.diskonPct) || 0;
  const raw = pct > 0 ? (gross * Math.min(100, pct)) / 100 : Number(it.diskon) || 0;
  return Math.max(0, Math.min(gross, Math.round(raw)));
}

/** Nilai baris setelah diskon item. */
export function itemNet(it: DiscountableItem | null | undefined): number {
  return itemGross(it) - itemDiscount(it);
}

export function sumItemGross(items: DiscountableItem[] | null | undefined): number {
  return (items || []).reduce((s, it) => s + itemGross(it), 0);
}

export function sumItemDiscounts(items: DiscountableItem[] | null | undefined): number {
  return (items || []).reduce((s, it) => s + itemDiscount(it), 0);
}

/** Diskon tambahan (di luar diskon per item) yang terkandung dalam diskon header. */
export function extraDiscountOf(headerDiscount: unknown, items: DiscountableItem[] | null | undefined): number {
  return Math.max(0, Math.round((Number(headerDiscount) || 0) - sumItemDiscounts(items)));
}

/**
 * Diskon header baru setelah item berubah: diskon tambahan dipertahankan, diskon item dihitung ulang.
 * Dipakai setiap kali item penawaran / invoice ditambah, diubah, atau dihapus.
 */
export function recomputeHeaderDiscount(
  oldHeaderDiscount: unknown,
  oldItems: DiscountableItem[] | null | undefined,
  newItems: DiscountableItem[] | null | undefined,
): number {
  const extra = extraDiscountOf(oldHeaderDiscount, oldItems);
  return Math.min(sumItemGross(newItems), extra + sumItemDiscounts(newItems));
}

/**
 * Item penawaran -> item dengan HARGA NET (dipakai Sales Order).
 * Diskon per item dipotong dari barisnya sendiri; diskon tambahan dibagi proporsional ke nilai bersih tiap baris.
 * Sisa pembulatan ditaruh di item terakhir ber-qty 1 agar total persis = total kotor − diskon header.
 */
export function distributeDiscountToPrices<T extends DiscountableItem>(
  items: T[],
  headerDiscount: unknown,
): (Omit<T, "diskon" | "diskonPct"> & { harga: number; price: number; qty: number })[] {
  const gross = sumItemGross(items);
  const discount = Math.min(gross, Math.max(0, Number(headerDiscount) || 0));
  const netSum = items.reduce((s, it) => s + itemNet(it), 0);
  const extra = extraDiscountOf(discount, items);
  const factor = netSum > 0 && extra > 0 ? Math.max(0, (netSum - extra) / netSum) : 1;

  const out = items.map((it) => {
    const qty = Number(it.qty) || 1;
    const price = Math.round((itemNet({ ...it, qty }) * factor) / qty);
    const { diskon: _d, diskonPct: _p, ...rest } = it as any;
    return { ...rest, qty, harga: price, price };
  });
  if (discount > 0) {
    const diff = Math.round(gross - discount) - out.reduce((s, it) => s + it.qty * it.price, 0);
    const last = [...out].reverse().find((it) => it.qty === 1);
    if (diff !== 0 && last) {
      last.price += diff;
      last.harga = last.price;
    }
  }
  return out;
}

export function calcItemPph(item: { qty?: number; harga?: number; price?: number; pphMode?: PphMode; diskon?: number; diskonPct?: number }): number {
  const mode = item.pphMode || "none";
  if (mode === "none") return 0;
  return Math.round(itemNet(item) * pphRateFor(mode));
}

/**
 * SATU-SATUNYA rumus nilai dokumen penjualan (penawaran, Sales Order, invoice dari penawaran).
 *
 *   DPP   = (total harga − diskon), dikurangi PPN bila harga sudah termasuk PPN
 *   PPN   = 11% × DPP
 *   Total = DPP + PPN                      <- nilai dokumen / tagihan ke customer
 *   PPh   = tarif × porsi DPP item jasa    <- DIPOTONG CUSTOMER saat membayar (bukti potong),
 *                                             TIDAK mengurangi nilai dokumen
 *   Estimasi transfer dari customer = Total − PPh
 */
export function calcQuotationFinancials(
  nilaiRaw: unknown,
  discRaw: unknown,
  ppnMode: PpnMode,
  pphMode: PphMode = "none",
  items: any[] = []
) {
  const totNum = Number(String(nilaiRaw).replace(/\D/g, "")) || 0;
  const discNum = Number(String(discRaw).replace(/\D/g, "")) || 0;
  const netBeforeTax = Math.max(0, totNum - discNum);

  const isInclude = ppnMode === "include";
  const dpp = isInclude ? Math.round(netBeforeTax / 1.11) : netBeforeTax;
  const ppn = ppnMode === "none" ? 0 : isInclude ? Math.max(0, netBeforeTax - dpp) : Math.round(netBeforeTax * 0.11);

  // Dasar PPh = porsi DPP dari item (setelah diskon item & diskon tambahan, tanpa PPN) — bukan harga kotor.
  const netItemsSum = (items || []).reduce((s: number, it: any) => s + itemNet(it), 0);
  const dppFactor = netItemsSum > 0 ? dpp / netItemsSum : totNum > 0 ? dpp / totNum : 0;
  const itemPph = (items || []).reduce((acc: number, it: any) => {
    const mode = (it?.pphMode || "none") as PphMode;
    if (mode === "none") return acc;
    const base = (netItemsSum > 0 ? itemNet(it) : itemGross(it)) * dppFactor;
    return acc + Math.round(base * pphRateFor(mode));
  }, 0);
  const pph = items && items.length > 0 ? itemPph : Math.round(dpp * pphRateFor(pphMode));
  const totalAfterDisc = dpp + ppn;
  const netReceived = Math.max(0, totalAfterDisc - pph);

  return { totNum, discNum, dpp, ppn, pph, totalAfterDisc, netReceived };
}

export function isServiceItem(it: any): boolean {
  if (!it) return false;
  const name = String(it.item || it.name || it.title || "").trim().toLowerCase();
  const unit = String(it.unit || it.satuan || "").trim().toLowerCase();
  const code = String(it.kodeAkun || it.accountCode || "").trim();
  if (it.tipe === "JASA" || it.type === "SERVICE" || it.type === "JASA" || it.itemType === "JASA" || it.kind === "SERVICE") return true;
  if (name.startsWith("[jasa]") || name.startsWith("jasa ") || name.includes("ongkos kirim") || name.includes("ongkir")) return true;
  if (name.includes("instalasi") || name.includes("pemasangan") || name.includes("setting") || name.includes("konfigurasi") || name.includes("maintenance") || name.includes("training") || name.includes("transportasi")) return true;
  if (unit === "paket" || unit === "ls" || unit === "lot" || unit === "titik" || unit === "jam" || unit === "hari") return true;
  if (code === "4000.02" || code === "5103") return true;
  return false;
}

export function getItemAvailableStock(
  item: any,
  products: any[] = [],
  serials: any[] = [],
  stockSummary: any[] = []
): { availableStock: number; isService: boolean; isOutOfStock: boolean; matchedProduct: any } {
  if (isServiceItem(item)) {
    return { availableStock: 999999, isService: true, isOutOfStock: false, matchedProduct: null };
  }

  const rawName = String(item.item || item.name || item.title || "").trim();
  const cleanName = rawName.replace(/\(SN:[^)]+\)/i, "").trim().toLowerCase();
  const prodId = item.productId ? String(item.productId) : null;

  const matched = (products || []).find((p) => {
    if (prodId && String(p.id) === prodId) return true;
    const pName = String(p.nama || p.name || "").trim().toLowerCase();
    const pSku = String(p.sku || "").trim().toLowerCase();
    return (cleanName && pName === cleanName) || (cleanName && pSku && pSku === cleanName);
  });

  if (!matched && !prodId) {
    // Jika tidak terdaftar di master produk sama sekali, anggap non-stok/kustom
    return { availableStock: 0, isService: false, isOutOfStock: false, matchedProduct: null };
  }

  const p = matched || { id: prodId };
  let stock = 0;

  if (p.berSN || p.hasSerial) {
    stock = (serials || []).filter(
      (s: any) =>
        (String(s.productId) === String(p.id) || (p.nama && s.produk === p.nama) || (p.name && s.produk === p.name)) &&
        (s.rawStatus === "DI_GUDANG" || s.status === "Di gudang")
    ).length;
  } else {
    const sum = (stockSummary || [])
      .filter((s: any) => String(s.productId) === String(p.id))
      .reduce((acc: number, cur: any) => acc + Number(cur.saldo ?? cur.qty ?? cur.stok ?? 0), 0);
    if (sum > 0) {
      stock = sum;
    } else {
      stock = Number(p.stok ?? p.stock ?? p.tersedia ?? 0);
    }
  }

  const reqQty = Number(item.qty) || 1;
  const isOutOfStock = stock < reqQty;

  return { availableStock: stock, isService: false, isOutOfStock, matchedProduct: p };
}
