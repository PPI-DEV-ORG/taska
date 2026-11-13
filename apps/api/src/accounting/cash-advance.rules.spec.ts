import { describe, expect, it } from "vitest";
import {
  buildCashAdvanceDisburseLines,
  buildCashAdvanceReturnLines,
  buildCashAdvanceSettleLines,
  splitSettlement,
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
    expect(sum(settle, "6202", "debit") + sum(settle, "6203", "debit")).toBe(350_000);
    // Saldo 1107: +500.000 (cair) − 350.000 (biaya) − 150.000 (kembali) = 0
    expect(500_000 - sum(settle, "1107", "credit") - sum(ret, "1107", "credit")).toBe(0);
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
