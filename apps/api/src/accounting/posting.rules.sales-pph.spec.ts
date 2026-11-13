import { describe, expect, it } from "vitest";
import { PostingRules, withheldTax } from "./posting.rules.js";

/**
 * PPh penjualan dipotong CUSTOMER saat membayar.
 * Invoice baru: total = DPP + PPN; PPh baru diakui saat pembayaran (bukti potong).
 * Invoice lama: total = DPP + PPN − PPh; PPh sudah diakui saat terbit.
 * Keduanya harus menghasilkan saldo akhir yang sama: kas + PPh dibayar dimuka = DPP + PPN, piutang 0.
 */
const map = { AR: "110302", PPH_PREPAID_CUSTOMER: "1105.01", CASH_DEFAULT: "1000.02", PPN_OUT: "2102", REVENUE_SERVICE: "4000.02" };
const sum = (lines: any[], acc: string, side: "debit" | "credit") =>
  lines.filter((l) => l.accountCode === acc).reduce((s, l) => s + Number(l[side] || 0), 0);

// Jasa DPP 10.000.000, PPN 1.100.000, PPh 23 2% = 200.000
const dpp = 10_000_000;
const ppn = 1_100_000;
const pph = 200_000;

describe("PPh penjualan dipotong customer", () => {
  it("invoice baru (total = DPP + PPN): tidak ada PPh saat terbit, piutang penuh", () => {
    expect(withheldTax({ dpp, ppn, total: dpp + ppn, pph })).toBe(0);
    const lines = PostingRules.buildInvoiceOutLines(
      { id: 1, number: "INV/1", type: "FULL", customerId: 1, dpp, ppn, total: dpp + ppn, pph, items: [{ type: "SERVICE", amount: dpp }] },
      map,
    );
    expect(sum(lines, "110302", "debit")).toBe(dpp + ppn);
    expect(sum(lines, "1105.01", "debit")).toBe(0);
  });

  it("pembayaran invoice baru: transfer (total − PPh) + PPh dipotong melunasi piutang penuh", () => {
    const lines = PostingRules.buildCustomerPaymentLines(
      { id: 9, sourceType: "INVOICE_OUT", sourceId: 1, amount: dpp + ppn - pph, accountCode: "1000.02", pph23Amount: pph },
      map,
    );
    expect(sum(lines, "1000.02", "debit")).toBe(dpp + ppn - pph);
    expect(sum(lines, "1105.01", "debit")).toBe(pph);
    expect(sum(lines, "110302", "credit")).toBe(dpp + ppn);
  });

  it("invoice lama (total sudah dikurangi PPh): PPh diakui saat terbit, tidak di pembayaran", () => {
    expect(withheldTax({ dpp, ppn, total: dpp + ppn - pph, pph })).toBe(pph);
    const lines = PostingRules.buildInvoiceOutLines(
      { id: 2, number: "INV/2", type: "FULL", customerId: 1, dpp, ppn, total: dpp + ppn - pph, pph, items: [{ type: "SERVICE", amount: dpp }] },
      map,
    );
    expect(sum(lines, "110302", "debit")).toBe(dpp + ppn - pph);
    expect(sum(lines, "1105.01", "debit")).toBe(pph);
  });
});
