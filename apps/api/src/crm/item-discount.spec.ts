import { describe, expect, it } from "vitest";
import { itemDiscountFields, itemLineDiscount, sumItemDiscounts } from "./item-discount.js";

describe("diskon per item", () => {
  it("persen dihitung dari qty × harga", () => {
    expect(itemLineDiscount({ qty: 2, harga: 1_000_000, diskonPct: 10 })).toBe(200_000);
  });

  it("nominal dibatasi tidak melebihi nilai baris", () => {
    expect(itemLineDiscount({ qty: 1, harga: 500_000, diskon: 900_000 })).toBe(500_000);
    expect(itemLineDiscount({ qty: 1, harga: 500_000, diskon: -5 })).toBe(0);
  });

  it("persen diutamakan dan nominal disimpan ulang sesuai qty terbaru", () => {
    expect(itemDiscountFields({ qty: 3, harga: 100_000, diskonPct: 5, diskon: 1 })).toEqual({ diskonPct: 5, diskon: 15_000 });
    expect(itemDiscountFields({ qty: 3, harga: 100_000 })).toEqual({});
  });

  it("total diskon item untuk memisahkan diskon tambahan di dokumen", () => {
    const items = [
      { qty: 2, harga: 1_000_000, diskonPct: 10 }, // 200.000
      { qty: 1, harga: 3_000_000, diskon: 300_000 }, // 300.000
      { qty: 5, harga: 50_000 }, // 0
    ];
    expect(sumItemDiscounts(items)).toBe(500_000);
    // Header discount 700.000 = 500.000 item + 200.000 diskon tambahan
    expect(700_000 - sumItemDiscounts(items)).toBe(200_000);
  });
});
