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

export function calcItemPph(item: { qty?: number; harga?: number; price?: number; pphMode?: PphMode }): number {
  const mode = item.pphMode || "none";
  if (mode === "none") return 0;
  const qty = Number(item.qty) || 0;
  const harga = Number(item.harga ?? item.price ?? 0);
  return Math.round(qty * harga * pphRateFor(mode));
}

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

  const itemPph = (items || []).reduce((acc: number, it: any) => acc + calcItemPph(it), 0);
  const pph = items && items.length > 0 ? itemPph : Math.round(dpp * pphRateFor(pphMode));
  const totalAfterDisc = Math.max(0, (isInclude ? netBeforeTax : netBeforeTax + ppn) - pph);

  return { totNum, discNum, dpp, ppn, pph, totalAfterDisc };
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
