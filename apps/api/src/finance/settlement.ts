import { withheldTax } from "../accounting/posting.rules.js";

type InvoiceLike = {
  amount?: unknown;
  ppn?: unknown;
  total?: unknown;
  pph?: unknown;
  paidAmount?: unknown;
  status?: string | null;
};

/**
 * Nilai tagihan dalam bentuk bruto (DPP + PPN).
 * Invoice lama / "PPh dipotong saat terbit" menyimpan total = DPP + PPN − PPh, jadi PPh-nya ditambahkan kembali
 * supaya bisa dibandingkan dengan nilai kontrak (SO / penawaran) yang selalu DPP + PPN.
 */
export function invoiceGross(inv: InvoiceLike): number {
  const total = Number(inv.total) || 0;
  if (total <= 0) return 0;
  const withheld = withheldTax({ dpp: Number(inv.amount) || 0, ppn: Number(inv.ppn) || 0, total, pph: Number(inv.pph) || 0 });
  return Math.round(total + withheld);
}

/** Porsi tagihan bruto yang sudah terselesaikan (uang diterima + PPh yang dipotong customer). */
export function invoiceSettledGross(inv: InvoiceLike): number {
  const total = Number(inv.total) || 0;
  if (total <= 0) return 0;
  const paid = inv.status === "PAID" ? Math.max(total, Number(inv.paidAmount) || 0) : Number(inv.paidAmount) || 0;
  const ratio = Math.max(0, Math.min(1, paid / total));
  return Math.round(ratio * invoiceGross(inv));
}

export type ProjectPaymentStatus = "BELUM_LUNAS" | "LUNAS_SEBAGIAN" | "LUNAS";

/**
 * Status bayar project dibandingkan dengan NILAI KONTRAK, bukan hanya invoice yang sudah terbit.
 * Contoh: invoice DP 30% sudah dibayar, pelunasan belum ditagih -> LUNAS_SEBAGIAN (bukan LUNAS).
 *
 * @param contractValue nilai kontrak bruto (DPP + PPN) dari SO / penawaran; 0 bila tidak diketahui.
 */
export function computeProjectPaymentStatus(
  invoices: (InvoiceLike & { type?: string | null })[],
  contractValue: number,
): { status: ProjectPaymentStatus; paid: number; contract: number } {
  const active = invoices.filter((i) => i.status !== "BATAL");
  const invoiced = active.reduce((s, i) => s + invoiceGross(i), 0);
  const paid = active.reduce((s, i) => s + invoiceSettledGross(i), 0);
  const knownContract = contractValue > 0;
  const contract = Math.max(knownContract ? contractValue : 0, invoiced);

  if (paid <= 0) return { status: "BELUM_LUNAS", paid, contract };
  // Tanpa nilai kontrak, invoice yang semuanya DP belum bisa dianggap lunas (pelunasan belum terbit).
  const onlyDp = active.length > 0 && active.every((i) => i.type === "DP");
  const fullyPaid = contract > 0 && paid >= contract - 1 && !(onlyDp && !knownContract);
  return { status: fullyPaid ? "LUNAS" : "LUNAS_SEBAGIAN", paid, contract };
}

function pphRateForMode(mode?: string | null): number {
  const m = String(mode || "").toLowerCase();
  if (m === "pph23" || m.includes("23")) return 0.02;
  if (m === "pph4_2" || m.includes("4(2)") || m.includes("4_2")) return 0.0175;
  if (m === "pph21" || m.includes("21")) return 0.025;
  if (m === "pph22" || m.includes("22")) return 0.015;
  return 0;
}

function pphLabelForMode(mode?: string | null): string {
  const m = String(mode || "").toLowerCase();
  if (m === "pph23" || m.includes("23")) return "PPh 23 (2%)";
  if (m === "pph4_2" || m.includes("4(2)") || m.includes("4_2")) return "PPh 4(2) (1.75%)";
  if (m === "pph21" || m.includes("21")) return "PPh 21 (2.5%)";
  if (m === "pph22" || m.includes("22")) return "PPh 22 (1.5%)";
  return "Tanpa PPh";
}

function itemGrossVal(it: any): number {
  return (Number(it?.qty) || 1) * (Number(it?.harga ?? it?.price ?? 0) || 0);
}

function itemDiscVal(it: any): number {
  const gross = itemGrossVal(it);
  const pct = Number(it?.diskonPct) || 0;
  const raw = pct > 0 ? (gross * Math.min(100, pct)) / 100 : Number(it?.diskon) || 0;
  return Math.max(0, Math.min(gross, Math.round(raw)));
}

function itemNetVal(it: any): number {
  return itemGrossVal(it) - itemDiscVal(it);
}

/**
 * Turunkan rincian DPP, PPN (Include/Exclude/None), Diskon, PPh proporsional, dan item dari Quotation
 * agar SO dan Invoice yang dibuat dari Penawaran selalu memiliki perhitungan pajak & diskon yang identik.
 */
export function deriveQuotationTaxBreakdown(quote: any, existingItems?: any[]) {
  const qItems: any[] = Array.isArray(quote?.items) ? quote.items : [];
  const curItems: any[] = Array.isArray(existingItems) && existingItems.length > 0 ? existingItems : qItems;

  const mergedItems = curItems.map((it: any, idx: number) => {
    const qMatch =
      qItems.find(
        (qi: any) =>
          (it.productId && qi.productId && Number(it.productId) === Number(qi.productId)) ||
          String(qi.item || qi.name || "").trim().toLowerCase() === String(it.item || it.name || "").trim().toLowerCase(),
      ) ?? qItems[idx];

    if (!qMatch) return it;
    const origPrice = Number(qMatch.harga ?? qMatch.price ?? it.harga ?? it.price ?? 0);
    return {
      ...qMatch,
      ...it,
      harga: origPrice,
      price: origPrice,
      ...(Number(qMatch.diskon) > 0 && !Number(it.diskon) ? { diskon: Number(qMatch.diskon) } : {}),
      ...(Number(qMatch.diskonPct) > 0 && !Number(it.diskonPct) ? { diskonPct: Number(qMatch.diskonPct) } : {}),
      ...(qMatch.pphMode && (!it.pphMode || it.pphMode === "none") ? { pphMode: qMatch.pphMode } : {}),
      ...(qMatch.tipePph && (!it.tipePph || it.tipePph === "Tanpa PPh") ? { tipePph: qMatch.tipePph } : {}),
    };
  });

  const itemsGrossSum = mergedItems.reduce((s, it) => s + itemGrossVal(it), 0);
  const totNum = Number(quote?.total || 0) || itemsGrossSum;
  const discNum = Number(quote?.discount || 0);
  const netBeforeTax = Math.max(0, totNum - discNum);
  const rawPpn = Number(quote?.ppn || 0);
  const grandTotal = Number(quote?.grandTotal || 0);

  let ppnMode: "include" | "exclude" | "none" = "none";
  if (rawPpn > 0) {
    if (netBeforeTax > 0 && Math.abs(grandTotal - netBeforeTax) <= 2) {
      ppnMode = "include";
    } else {
      ppnMode = "exclude";
    }
  }

  const dpp = ppnMode === "include" ? Math.round(netBeforeTax / 1.11) : netBeforeTax;
  const ppn = ppnMode === "none" ? 0 : ppnMode === "include" ? Math.max(0, netBeforeTax - dpp) : rawPpn || Math.round(netBeforeTax * 0.11);
  const tipePpn =
    ppnMode === "include"
      ? "Include PPN (Sudah termasuk)"
      : ppnMode === "exclude"
        ? "Exclude PPN (11%)"
        : "No PPN (Tanpa PPN)";
  const total = dpp + ppn;

  const netItemsSum = mergedItems.reduce((s, it) => s + itemNetVal(it), 0);
  const dppFactor = netItemsSum > 0 ? dpp / netItemsSum : totNum > 0 ? dpp / totNum : 0;

  let firstPphMode: string | null = quote?.pphMode && quote.pphMode !== "none" ? String(quote.pphMode) : null;
  const computedItemPph = mergedItems.reduce((acc, it) => {
    const mode = it?.pphMode && it.pphMode !== "none" ? String(it.pphMode) : null;
    if (!mode) return acc;
    if (!firstPphMode) firstPphMode = mode;
    const base = (netItemsSum > 0 ? itemNetVal(it) : itemGrossVal(it)) * dppFactor;
    return acc + Math.round(base * pphRateForMode(mode));
  }, 0);

  const pphMode = firstPphMode || "none";
  const tipePph = quote?.tipePph && quote.tipePph !== "Tanpa PPh" ? String(quote.tipePph) : pphLabelForMode(pphMode);
  const quotePph = Number(quote?.pph || 0);
  const pph = computedItemPph > 0 ? computedItemPph : quotePph > 0 ? quotePph : Math.round(dpp * pphRateForMode(pphMode));

  return {
    totNum,
    discount: discNum,
    dpp,
    ppn,
    ppnMode,
    tipePpn,
    pph,
    pphMode,
    tipePph,
    total,
    netReceived: Math.max(0, total - pph),
    items: mergedItems,
  };
}
