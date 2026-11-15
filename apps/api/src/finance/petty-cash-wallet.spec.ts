import { describe, expect, it } from "vitest";
import { pettyCashWallets } from "./petty-cash-wallet.js";
import { buildCashAdvanceDisburseLines, buildCashAdvanceReturnLines, buildPettyCashSpendLines } from "../accounting/cash-advance.rules.js";

const emp = { id: 7, name: "Budi", role: "SALES" };
const map = { EMPLOYEE_ADVANCE: "1107", CASH_DEFAULT: "1000.02", EXPENSE_DEFAULT: "6202" };

function fakeDb(advances: any[], expenses: any[]) {
  return {
    cashAdvance: { findMany: async () => advances.map((a) => ({ employee: emp, items: [], employeeId: emp.id, ...a })) },
    expense: { findMany: async () => expenses.map((e) => ({ reporter: emp, reporterId: emp.id, ...e })) },
  };
}

describe("saldo petty cash per karyawan", () => {
  it("isi saldo, pemakaian, tarik saldo, dan pemakaian menunggu verifikasi", async () => {
    const db = fakeDb(
      [
        // Finance isi saldo 1.000.000
        { purpose: "ISI_SALDO", status: "SELESAI", disbursedAmount: 1_000_000, spentAmount: 0, reimbursedAmount: 0, returnedAmount: 0 },
        // Sisa 100.000 dikembalikan ke kas
        { purpose: "TARIK_SALDO", status: "SELESAI", disbursedAmount: 0, spentAmount: 0, reimbursedAmount: 0, returnedAmount: 100_000 },
        // Petty cash survey 300.000 masih berjalan, biaya dicatat 120.000
        { purpose: "SURVEY", status: "DICAIRKAN", disbursedAmount: 300_000, items: [{ amount: 120_000 }] },
      ],
      [
        { status: "DIBAYAR", amount: 250_000 }, // diverifikasi -> saldo berkurang
        { status: "DILAPORKAN", amount: 50_000 }, // menunggu verifikasi -> belum boleh dipakai lagi
      ],
    );
    const [w] = await pettyCashWallets(db);
    expect(w!.balance).toBe(1_000_000 - 100_000 + 300_000 - 250_000); // 950.000
    expect(w!.pendingReport).toBe(120_000);
    expect(w!.pendingSpend).toBe(50_000);
    expect(w!.available).toBe(950_000 - 120_000 - 50_000);
    expect(w!.activeCount).toBe(1); // isi/tarik saldo tidak dihitung sebagai tugas berjalan
  });

  it("jurnal: isi saldo, pemakaian, dan tarik saldo membuat akun 1107 karyawan sama dengan saldonya", () => {
    const party = { number: "PC/2026/11/001", employeeId: 7, employeeName: "Budi" };
    const lines = [
      ...buildCashAdvanceDisburseLines({ ...party, amount: 1_000_000, cashAccountCode: "1000.01" }, map),
      ...buildPettyCashSpendLines({ number: "EXP-001", amount: 250_000, employeeId: 7, employeeName: "Budi", expenseAccountCode: "6202.03" }, map),
      ...buildCashAdvanceReturnLines({ ...party, amount: 100_000, cashAccountCode: "1000.01" }, map),
    ];
    const net = (acc: string) => lines.filter((l) => l.accountCode === acc).reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
    expect(net("1107")).toBe(650_000);
    expect(net("6202.03")).toBe(250_000);
    expect(net("1000.01")).toBe(-900_000);
    expect(lines.filter((l) => l.accountCode === "1107").every((l) => l.partyId === 7)).toBe(true);
    const debit = lines.reduce((s, l) => s + Number(l.debit), 0);
    const credit = lines.reduce((s, l) => s + Number(l.credit), 0);
    expect(debit).toBe(credit);
  });
});
