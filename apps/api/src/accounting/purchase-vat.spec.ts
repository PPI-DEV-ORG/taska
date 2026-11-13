import { describe, expect, it } from "vitest";
import { netUnitCost, receivingUnitCost, splitPurchasePayment } from "./purchase-vat.js";
import { PostingRules } from "./posting.rules.js";

const noDb = { supplierPOItem: { findFirst: async () => null } };

describe("PPN pembelian", () => {
  it("harga include PPN: persediaan dinilai sebelum PPN", async () => {
    expect(netUnitCost(111_000, "include")).toBeCloseTo(100_000);
    expect(netUnitCost(100_000, "exclude")).toBe(100_000);
    expect(netUnitCost(100_000, "none")).toBe(100_000);

    const rec = {
      request: { ppnMode: "include", items: [{ productId: 5, unitCost: 1_110_000 }] },
      items: [{ qtyReceived: 2 }],
    };
    const cost = await receivingUnitCost(noDb, rec, { productId: 5 });
    expect(Math.round(cost * 2)).toBe(2_000_000);
  });

  it("harga PO ikut mode PPN PO (fallback ke request)", async () => {
    const rec = {
      supplierPo: { ppnMode: null, total: 2_220_000, items: [{ productId: 5, price: 1_110_000 }] },
      request: { ppnMode: "include", items: [] },
    };
    expect(Math.round(await receivingUnitCost(noDb, rec, { productId: 5 }))).toBe(1_000_000);
    const recEx = { supplierPo: { ppnMode: "exclude", items: [{ productId: 5, price: 1_000_000 }] } };
    expect(await receivingUnitCost(noDb, recEx, { productId: 5 })).toBe(1_000_000);
  });

  it("bayar request include PPN: GRNI = nilai barang, sisanya PPN Masukan", () => {
    expect(splitPurchasePayment({ paid: 2_220_000, itemsSum: 2_220_000, mode: "include" })).toEqual({ goods: 2_000_000, vat: 220_000 });
    expect(splitPurchasePayment({ paid: 2_220_000, itemsSum: 2_000_000, mode: "exclude" })).toEqual({ goods: 2_000_000, vat: 220_000 });
    expect(splitPurchasePayment({ paid: 2_000_000, itemsSum: 2_000_000, mode: "none" })).toEqual({ goods: 2_000_000, vat: 0 });
    // PO dengan nilai PPN tercatat
    expect(splitPurchasePayment({ paid: 2_220_000, itemsSum: 2_000_000, mode: "exclude", ppn: 220_000 })).toEqual({ goods: 2_000_000, vat: 220_000 });
  });

  it("terima barang + bayar (include PPN): GRNI nol, PPN tidak masuk persediaan", () => {
    const map = { INVENTORY: "1200", GRNI: "2108", VAT_IN: "1600" };
    const recLines = PostingRules.buildReceivingLines({ number: "BPB/1", supplierId: 1, totalValue: Math.round(2 * netUnitCost(1_110_000, "include")) }, map);
    const split = splitPurchasePayment({ paid: 2_220_000, itemsSum: 2_220_000, mode: "include" });
    const net = (acc: string) =>
      recLines.filter((l) => l.accountCode === acc).reduce((s, l) => s + Number(l.debit || 0) - Number(l.credit || 0), 0) +
      (acc === "2108" ? split.goods : 0);
    expect(net("1200")).toBe(2_000_000);
    expect(net("2108")).toBe(0);
    expect(split.vat).toBe(220_000);
  });
});

describe("keterangan PPN di jurnal terima barang", () => {
  it("menyebut PPN yang dicatat belakangan, nilai jurnal tetap sebelum PPN", async () => {
    const { receivingPpnInfo } = await import("./purchase-vat.js");
    const ppn = receivingPpnInfo({ request: { ppnMode: "include" } }, 94_594_595);
    expect(ppn).toBe(10_405_405);
    expect(receivingPpnInfo({ supplierPo: { ppnMode: "none" } }, 1_000_000)).toBe(0);
    const lines = PostingRules.buildReceivingLines({ number: "BPB/1", supplierId: 1, totalValue: 94_594_595, ppn }, {});
    expect(lines[0].debit).toBe(94_594_595);
    expect(lines[0].memo).toContain("PPN 10.405.405 dicatat saat tagihan/bayar");
  });
});
