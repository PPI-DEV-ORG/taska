import { describe, it, expect } from "vitest";
import { PostingRules, withheldTax } from "./posting.rules.js";
import type { JournalLineSpec } from "./accounting.types.js";

const map: Record<string, string> = {
  CASH_DEFAULT: "1000.02",
  AR: "110302",
  AP: "210102",
  GRNI: "2108",
  VAT_OUT: "2100",
  VAT_IN: "1600",
  REVENUE_GOODS: "4000.01",
  REVENUE_SERVICE: "4000.02",
  ADV_SALES: "210202",
  PPH_PREPAID_CUSTOMER: "1105.01",
  PPH_PAYABLE_23: "2106",
  PPH_PAYABLE_4_2: "2104",
};

const sum = (lines: JournalLineSpec[], k: "debit" | "credit") => lines.reduce((s, l) => s + Number(l[k] || 0), 0);
const net = (lines: JournalLineSpec[], code: string) =>
  lines.filter((l) => l.accountCode === code).reduce((s, l) => s + Number(l.debit || 0) - Number(l.credit || 0), 0);

describe("PPh yang sudah dipotong dari total dokumen", () => {
  it("withheldTax hanya mengakui PPh bila konsisten dengan total", () => {
    expect(withheldTax({ dpp: 10_000_000, ppn: 1_100_000, total: 10_900_000, pph: 200_000 })).toBe(200_000);
    // Dokumen lama: pph tercatat tapi total belum dipotong -> jangan diakui (agar jurnal tidak berubah)
    expect(withheldTax({ dpp: 10_000_000, ppn: 1_100_000, total: 11_100_000, pph: 200_000 })).toBe(0);
  });

  it("E1: invoice jasa dengan PPh 23 -> pendapatan tetap DPP penuh, PPh jadi uang muka pajak, seimbang", () => {
    const lines = PostingRules.buildInvoiceOutLines(
      {
        id: 1, number: "INV/1", type: "PELUNASAN", customerId: 1,
        dpp: 10_000_000, ppn: 1_100_000, total: 10_900_000, pph: 200_000,
        items: [{ type: "SERVICE", amount: 10_000_000 }],
      },
      map,
    );
    expect(sum(lines, "debit")).toBe(sum(lines, "credit"));
    expect(net(lines, "110302")).toBe(10_900_000); // piutang = yang benar-benar akan dibayar customer
    expect(net(lines, "1105.01")).toBe(200_000);
    expect(net(lines, "4000.02")).toBe(-10_000_000);
    expect(net(lines, "2100")).toBe(-1_100_000);
  });

  it("E5: tagihan supplier dengan PPh dipotong -> seimbang (dulu selisih & gagal posting diam-diam)", () => {
    const lines = PostingRules.buildInvoiceInLines(
      { number: "BILL/1", supplierId: 3, dpp: 5_000_000, ppn: 550_000, total: 5_450_000, pph: 100_000, pphMode: "pph23", isExpense: true, expenseAccountCode: "6202.07" },
      map,
    );
    expect(sum(lines, "debit")).toBe(sum(lines, "credit"));
    expect(net(lines, "210102")).toBe(-5_450_000);
    expect(net(lines, "2106")).toBe(-100_000);
  });

  it("E5: PPh 4(2) masuk ke akun hutang PPh final", () => {
    const lines = PostingRules.buildInvoiceInLines(
      { number: "BILL/2", supplierId: 3, dpp: 1_000_000, ppn: 0, total: 975_000, pph: 25_000, pphMode: "pph4_2", isExpense: true },
      map,
    );
    expect(net(lines, "2104")).toBe(-25_000);
  });
});

describe("Pelepasan uang muka (DP) saat pelunasan", () => {
  it("E2b: Dr Uang Muka Penjualan, Cr Pendapatan barang/jasa", () => {
    const lines = PostingRules.buildDpReleaseLines(
      { number: "INV/3/PELUNASAN", customerId: 1, amount: 3_000_000, serviceAmount: 1_000_000 },
      map,
    );
    expect(sum(lines, "debit")).toBe(sum(lines, "credit"));
    expect(net(lines, "210202")).toBe(3_000_000);
    expect(net(lines, "4000.01")).toBe(-2_000_000);
    expect(net(lines, "4000.02")).toBe(-1_000_000);
  });

  it("siklus DP -> Pelunasan: saldo uang muka kembali nol & pendapatan = nilai kontrak", () => {
    const dp = PostingRules.buildCustomerDpLines({ number: "DP", customerId: 1, dpp: 3_000_000, ppn: 330_000, total: 3_330_000 }, map);
    const pel = PostingRules.buildInvoiceOutLines(
      { id: 2, number: "PEL", type: "PELUNASAN", customerId: 1, dpp: 7_000_000, ppn: 770_000, total: 7_770_000 },
      map,
    );
    const rel = PostingRules.buildDpReleaseLines({ number: "PEL", customerId: 1, amount: 3_000_000 }, map);
    const all = [...dp, ...pel, ...rel];
    expect(net(all, "210202")).toBe(0);
    expect(net(all, "4000.01")).toBe(-10_000_000);
    expect(net(all, "2100")).toBe(-1_100_000);
    expect(net(all, "110302")).toBe(11_100_000);
  });
});

describe("Kompensasi pembayaran di muka (anti kas keluar dobel)", () => {
  it("bayar di Request (Dr GRNI+PPN Cr Kas) lalu tagihan supplier datang -> kompensasi, kas keluar cuma sekali", () => {
    const receiving = PostingRules.buildReceivingLines({ number: "BPB/1", supplierId: 3, totalValue: 1_000_000 }, map);
    const prPaid: JournalLineSpec[] = [
      { accountCode: "2108", debit: 1_000_000 },
      { accountCode: "1600", debit: 110_000 },
      { accountCode: "1000.02", credit: 1_110_000 },
    ];
    const bill = PostingRules.buildInvoiceInLines({ number: "BILL/9", supplierId: 3, dpp: 1_000_000, ppn: 110_000, total: 1_110_000 }, map);
    const offset = PostingRules.buildPrepaidOffsetLines({ number: "BILL/9", amount: 1_110_000, vatReversal: 110_000, supplierId: 3 }, map);
    expect(sum(offset, "debit")).toBe(sum(offset, "credit"));

    const all = [...receiving, ...prPaid, ...bill, ...offset];
    expect(net(all, "1000.02")).toBe(-1_110_000); // kas keluar SEKALI
    expect(net(all, "210102")).toBe(0); // hutang lunas
    expect(net(all, "2108")).toBe(0); // GRNI bersih
    expect(net(all, "1600")).toBe(110_000); // PPN masukan tidak dobel
    expect(net(all, "1200")).toBe(1_000_000);
  });
});
