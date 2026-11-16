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
