import { describe, expect, it } from "vitest";
import { computeProjectPaymentStatus, invoiceGross, invoiceSettledGross } from "./settlement.js";

// Kontrak 100 jt DPP + PPN 11 jt = 111 jt
const CONTRACT = 111_000_000;

describe("status bayar project", () => {
  it("DP 30% sudah dibayar, pelunasan belum terbit -> Lunas sebagian (bukan Lunas)", () => {
    const dp = { type: "DP", amount: 30_000_000, ppn: 3_300_000, total: 33_300_000, paidAmount: 33_300_000, status: "PAID" };
    expect(computeProjectPaymentStatus([dp], CONTRACT).status).toBe("LUNAS_SEBAGIAN");
  });

  it("belum ada pembayaran -> Belum lunas", () => {
    const dp = { type: "DP", amount: 30_000_000, ppn: 3_300_000, total: 33_300_000, paidAmount: 0, status: "SENT" };
    expect(computeProjectPaymentStatus([dp], CONTRACT).status).toBe("BELUM_LUNAS");
  });

  it("DP + pelunasan dibayar penuh -> Lunas", () => {
    const dp = { type: "DP", amount: 30_000_000, ppn: 3_300_000, total: 33_300_000, paidAmount: 33_300_000, status: "PAID" };
    const pl = { type: "PELUNASAN", amount: 70_000_000, ppn: 7_700_000, total: 77_700_000, paidAmount: 77_700_000, status: "PAID" };
    expect(computeProjectPaymentStatus([dp, pl], CONTRACT).status).toBe("LUNAS");
  });

  it("invoice lama yang totalnya sudah dikurangi PPh dihitung bruto -> tetap Lunas", () => {
    // DPP 100jt, PPN 11jt, PPh 23 2jt dipotong di invoice: total 109jt, dibayar 109jt
    const inv = { type: "PELUNASAN", amount: 100_000_000, ppn: 11_000_000, pph: 2_000_000, total: 109_000_000, paidAmount: 109_000_000, status: "PAID" };
    expect(invoiceGross(inv)).toBe(111_000_000);
    expect(invoiceSettledGross(inv)).toBe(111_000_000);
    expect(computeProjectPaymentStatus([inv], CONTRACT).status).toBe("LUNAS");
  });

  it("tanpa nilai kontrak, invoice yang semuanya DP tidak dianggap lunas", () => {
    const dp = { type: "DP", amount: 30_000_000, ppn: 3_300_000, total: 33_300_000, paidAmount: 33_300_000, status: "PAID" };
    expect(computeProjectPaymentStatus([dp], 0).status).toBe("LUNAS_SEBAGIAN");
  });

  it("invoice batal diabaikan", () => {
    const batal = { type: "PELUNASAN", amount: 100_000_000, ppn: 11_000_000, total: 111_000_000, paidAmount: 0, status: "BATAL" };
    const dp = { type: "DP", amount: 30_000_000, ppn: 3_300_000, total: 33_300_000, paidAmount: 10_000_000, status: "PARTIAL" };
    expect(computeProjectPaymentStatus([batal, dp], CONTRACT).status).toBe("LUNAS_SEBAGIAN");
  });
});
