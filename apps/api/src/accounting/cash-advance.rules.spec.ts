import { describe, expect, it } from "vitest";
import {
  buildCashAdvanceDisburseLines,
  buildCashAdvanceReturnLines,
  buildCashAdvanceSettleLines,
  buildPettyCashSpendLines,
  pettyCashUsage,
  splitSettlement,
  cashAdvanceRemaining,
  reviewCashAdvanceItems,
} from "./cash-advance.rules.js";

const map = { EMPLOYEE_ADVANCE: "1107", CASH_DEFAULT: "1000.02", EXPENSE_DEFAULT: "6202" };
const sum = (lines: any[], acc: string, side: "debit" | "credit") =>
  lines.filter((l) => l.accountCode === acc).reduce((s, l) => s + Number(l[side] || 0), 0);
const balanced = (lines: any[]) =>
  lines.reduce((s, l) => s + Number(l.debit || 0), 0) === lines.reduce((s, l) => s + Number(l.credit || 0), 0);
const party = { number: "UJ/2026/11/001", employeeId: 7, employeeName: "Budi", projectId: 3 };

describe("uang jalan", () => {
  it("pencairan: kas berkurang, uang muka karyawan (kantong) bertambah", () => {
    const lines = buildCashAdvanceDisburseLines({ ...party, amount: 500_000, cashAccountCode: "1000.01" }, map);
    expect(balanced(lines)).toBe(true);
    expect(sum(lines, "1107", "debit")).toBe(500_000);
    expect(sum(lines, "1000.01", "credit")).toBe(500_000);
    expect(lines.every((l) => l.partyType === "EMPLOYEE" && l.partyId === 7)).toBe(true);
  });

  it("biaya lebih kecil dari uang jalan, sisa dikembalikan: kantong kembali 0", () => {
    const split = splitSettlement({ spent: 350_000, disbursed: 500_000, leftoverAction: "RETURN", shortageFrom: "CASH", walletBalanceBefore: 0 });
    expect(split).toEqual({ coveredByAdvance: 350_000, reimbursed: 0, returned: 150_000, keptInWallet: 0 });
    const settle = buildCashAdvanceSettleLines(
      { ...party, coveredByAdvance: split.coveredByAdvance, reimbursed: 0, expenses: [{ amount: 200_000, description: "Bensin" }, { amount: 150_000, description: "Tol", accountCode: "6203" }] },
      map,
    );
    const ret = buildCashAdvanceReturnLines({ ...party, amount: split.returned, cashAccountCode: "1000.01" }, map);
    expect(balanced(settle)).toBe(true);
    expect(balanced(ret)).toBe(true);
    // Petty cash project: semua biayanya HPP project (5103), bukan beban operasional
    expect(sum(settle, "5103", "debit")).toBe(350_000);
    expect(sum(settle, "6202", "debit") + sum(settle, "6203", "debit")).toBe(0);
    // Saldo 1107: +500.000 (cair) − 350.000 (biaya) − 150.000 (kembali) = 0
    expect(500_000 - sum(settle, "1107", "credit") - sum(ret, "1107", "credit")).toBe(0);
  });

  it("petty cash non-project: biaya tetap ke akun beban kategorinya", () => {
    const settle = buildCashAdvanceSettleLines(
      {
        ...party,
        projectId: null,
        coveredByAdvance: 350_000,
        reimbursed: 0,
        expenses: [{ amount: 200_000, description: "Bensin" }, { amount: 150_000, description: "Tol", accountCode: "6203" }],
      },
      map,
    );
    expect(sum(settle, "6202", "debit")).toBe(200_000);
    expect(sum(settle, "6203", "debit")).toBe(150_000);
    expect(sum(settle, "5103", "debit")).toBe(0);
  });

  it("pemakaian saldo petty cash untuk project → HPP project", () => {
    const lines = buildPettyCashSpendLines({ number: "EXP-001", amount: 75_000, employeeId: 7, projectId: 3, expenseAccountCode: "6202.07" }, map);
    expect(sum(lines, "5103", "debit")).toBe(75_000);
    expect(sum(lines, "1107", "credit")).toBe(75_000);
    const kantor = buildPettyCashSpendLines({ number: "EXP-002", amount: 50_000, employeeId: 7, expenseAccountCode: "6202.07" }, map);
    expect(sum(kantor, "6202.07", "debit")).toBe(50_000);
  });

  it("sisa disimpan di kantong: tidak ada pengembalian kas", () => {
    expect(splitSettlement({ spent: 100_000, disbursed: 300_000, leftoverAction: "KEEP", shortageFrom: "CASH", walletBalanceBefore: 0 })).toEqual({
      coveredByAdvance: 100_000,
      reimbursed: 0,
      returned: 0,
      keptInWallet: 200_000,
    });
  });

  it("biaya melebihi uang jalan: kekurangan dibayar dari kas", () => {
    const split = splitSettlement({ spent: 650_000, disbursed: 500_000, leftoverAction: "RETURN", shortageFrom: "CASH", walletBalanceBefore: 0 });
    expect(split).toEqual({ coveredByAdvance: 500_000, reimbursed: 150_000, returned: 0, keptInWallet: 0 });
    const lines = buildCashAdvanceSettleLines(
      { ...party, coveredByAdvance: split.coveredByAdvance, reimbursed: split.reimbursed, reimburseAccountCode: "1000.01", expenses: [{ amount: 650_000, description: "Sewa mobil" }] },
      map,
    );
    expect(balanced(lines)).toBe(true);
    expect(sum(lines, "1107", "credit")).toBe(500_000);
    expect(sum(lines, "1000.01", "credit")).toBe(150_000);
  });

  it("kekurangan dipotong dari saldo kantong sisa tugas sebelumnya (sebatas saldo)", () => {
    expect(splitSettlement({ spent: 650_000, disbursed: 500_000, leftoverAction: "RETURN", shortageFrom: "WALLET", walletBalanceBefore: 100_000 })).toEqual({
      coveredByAdvance: 600_000,
      reimbursed: 50_000,
      returned: 0,
      keptInWallet: -100_000,
    });
  });
});

describe("keperluan petty cash di keterangan jurnal", () => {
  it("survey: nama prospek + lokasi", () => {
    expect(pettyCashUsage({ survey: { location: "Subang", lead: { name: "CCTV Pak Ujang" } } })).toBe("Survey CCTV Pak Ujang (Subang)");
  });
  it("proyek / surat jalan / uraian", () => {
    expect(pettyCashUsage({ project: { name: "Gedung A" } })).toBe("Proyek Gedung A");
    expect(pettyCashUsage({ deliveryNote: { number: "SJ/001" } })).toBe("Pengiriman SJ/001");
    expect(pettyCashUsage({ description: "Operasional kantor" })).toBe("Operasional kantor");
    expect(pettyCashUsage({})).toBe("");
  });
  it("memo akun 1107 memuat keperluannya", () => {
    const lines = buildCashAdvanceDisburseLines({ ...party, usage: "Survey PT ABC (Bandung)", amount: 100_000, cashAccountCode: "1000.02" }, map);
    expect(lines[0]!.memo).toContain("untuk Survey PT ABC (Bandung)");
    expect(lines.every((l) => String(l.memo).length <= 191)).toBe(true);
  });
});

describe("sisa petty cash untuk biaya baru", () => {
  it("sisa = dicairkan - total rincian, tidak pernah negatif", () => {
    expect(cashAdvanceRemaining(500_000, [100_000, 150_000])).toBe(250_000);
    expect(cashAdvanceRemaining(500_000, [300_000, 300_000])).toBe(0);
    expect(cashAdvanceRemaining(null, [])).toBe(0);
  });
});

describe("verifikasi petty cash per nota", () => {
  const items = [
    { id: 1, amount: 100_000 },
    { id: 2, amount: 50_000 },
    { id: 3, amount: 30_000 },
  ];

  it("tanpa keputusan: semua nota sah penuh", () => {
    const r = reviewCashAdvanceItems(items);
    expect(r.error).toBeUndefined();
    expect(r.approvedTotal).toBe(180_000);
    expect(r.reviews.every((x) => x.status === "SAH")).toBe(true);
  });

  it("ditolak & disesuaikan mengurangi total sah", () => {
    const r = reviewCashAdvanceItems(items, [
      { id: 2, status: "DITOLAK", reason: "Nota pribadi" },
      { id: 1, approvedAmount: 80_000, reason: "Melebihi harga wajar" },
    ]);
    expect(r.error).toBeUndefined();
    expect(r.approvedTotal).toBe(110_000);
    expect(r.reviews.find((x) => x.id === 2)).toMatchObject({ status: "DITOLAK", approvedAmount: 0, rejectReason: "Nota pribadi" });
    expect(r.reviews.find((x) => x.id === 1)).toMatchObject({ status: "SAH", approvedAmount: 80_000 });
  });

  it("menolak keputusan tidak valid", () => {
    expect(reviewCashAdvanceItems(items, [{ id: 2, status: "DITOLAK" }]).error).toMatch(/Alasan/);
    expect(reviewCashAdvanceItems(items, [{ id: 1, approvedAmount: 90_000 }]).error).toMatch(/Alasan/);
    expect(reviewCashAdvanceItems(items, [{ id: 1, approvedAmount: 120_000, reason: "x" }]).error).toMatch(/Nominal sah/);
    expect(reviewCashAdvanceItems(items, [{ id: 99, status: "DITOLAK", reason: "x" }]).error).toMatch(/bukan bagian/);
  });
});
