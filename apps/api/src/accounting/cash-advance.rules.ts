import { round, type JournalLineSpec } from "./accounting.types.js";

/**
 * Jurnal uang jalan (kasbon operasional karyawan).
 *
 *  Pencairan   : Dr Uang Muka Karyawan (1107)            Cr Kas/Bank yang dipilih Finance
 *  Penyelesaian: Dr Beban (per rincian biaya)            Cr Uang Muka Karyawan   (sebesar yang ditutup uang jalan)
 *                                                        Cr Kas/Bank             (kelebihan biaya yang dibayar perusahaan)
 *  Sisa kembali: Dr Kas/Bank                             Cr Uang Muka Karyawan
 *
 * Saldo akun 1107 per karyawan = isi "kantong" uang jalan karyawan tersebut.
 */

export type CashAdvanceParty = { employeeId: number; employeeName?: string; projectId?: number | null; number: string };

const advanceAccount = (map: Record<string, string>) => map.EMPLOYEE_ADVANCE || "1107";

export function buildCashAdvanceDisburseLines(
  adv: CashAdvanceParty & { amount: number; cashAccountCode: string },
  map: Record<string, string>,
): JournalLineSpec[] {
  const amount = round(adv.amount);
  const who = adv.employeeName || "Karyawan";
  return [
    {
      accountCode: advanceAccount(map),
      debit: amount,
      credit: 0,
      memo: `Uang jalan ${adv.number} diserahkan ke ${who}`.slice(0, 255),
      partyType: "EMPLOYEE",
      partyId: adv.employeeId,
      projectId: adv.projectId ?? null,
    },
    {
      accountCode: adv.cashAccountCode || map.CASH_DEFAULT || "1000.02",
      debit: 0,
      credit: amount,
      memo: `Pencairan uang jalan ${adv.number} (${who})`.slice(0, 255),
      partyType: "EMPLOYEE",
      partyId: adv.employeeId,
      projectId: adv.projectId ?? null,
    },
  ];
}

export type SettleExpenseLine = { accountCode?: string | null; amount: number; description: string; projectId?: number | null };

/**
 * @param coveredByAdvance biaya yang ditutup dari uang muka karyawan (uang jalan ini + saldo kantong bila dipakai)
 * @param reimbursed       kelebihan biaya yang dibayar perusahaan ke karyawan dari kas/bank
 */
export function buildCashAdvanceSettleLines(
  adv: CashAdvanceParty & {
    expenses: SettleExpenseLine[];
    coveredByAdvance: number;
    reimbursed: number;
    reimburseAccountCode?: string | null;
  },
  map: Record<string, string>,
): JournalLineSpec[] {
  const who = adv.employeeName || "Karyawan";
  const lines: JournalLineSpec[] = [];
  for (const e of adv.expenses) {
    const amount = round(e.amount);
    if (amount <= 0) continue;
    lines.push({
      accountCode: e.accountCode || map.EXPENSE_DEFAULT || "6202",
      debit: amount,
      credit: 0,
      memo: `${e.description} — uang jalan ${adv.number} (${who})`.slice(0, 255),
      partyType: "EMPLOYEE",
      partyId: adv.employeeId,
      projectId: e.projectId ?? adv.projectId ?? null,
    });
  }
  const covered = round(adv.coveredByAdvance);
  if (covered > 0) {
    lines.push({
      accountCode: advanceAccount(map),
      debit: 0,
      credit: covered,
      memo: `Pertanggungjawaban uang jalan ${adv.number} (${who})`.slice(0, 255),
      partyType: "EMPLOYEE",
      partyId: adv.employeeId,
      projectId: adv.projectId ?? null,
    });
  }
  const reimbursed = round(adv.reimbursed);
  if (reimbursed > 0) {
    lines.push({
      accountCode: adv.reimburseAccountCode || map.CASH_DEFAULT || "1000.02",
      debit: 0,
      credit: reimbursed,
      memo: `Kekurangan uang jalan ${adv.number} dibayar ke ${who}`.slice(0, 255),
      partyType: "EMPLOYEE",
      partyId: adv.employeeId,
      projectId: adv.projectId ?? null,
    });
  }
  return lines;
}

export function buildCashAdvanceReturnLines(
  adv: CashAdvanceParty & { amount: number; cashAccountCode: string },
  map: Record<string, string>,
): JournalLineSpec[] {
  const amount = round(adv.amount);
  const who = adv.employeeName || "Karyawan";
  return [
    {
      accountCode: adv.cashAccountCode || map.CASH_DEFAULT || "1000.02",
      debit: amount,
      credit: 0,
      memo: `Sisa uang jalan ${adv.number} dikembalikan ${who}`.slice(0, 255),
      partyType: "EMPLOYEE",
      partyId: adv.employeeId,
      projectId: adv.projectId ?? null,
    },
    {
      accountCode: advanceAccount(map),
      debit: 0,
      credit: amount,
      memo: `Pengembalian sisa uang jalan ${adv.number} (${who})`.slice(0, 255),
      partyType: "EMPLOYEE",
      partyId: adv.employeeId,
      projectId: adv.projectId ?? null,
    },
  ];
}

/**
 * Pembagian biaya saat penyelesaian.
 * @param spent     total biaya yang dilaporkan
 * @param disbursed uang jalan yang dicairkan untuk dokumen ini
 * @param walletBalanceBefore saldo kantong karyawan dari uang jalan lain (sisa yang disimpan), boleh dipakai bila kurang
 */
export function splitSettlement(input: {
  spent: number;
  disbursed: number;
  leftoverAction: "RETURN" | "KEEP";
  shortageFrom: "CASH" | "WALLET";
  walletBalanceBefore: number;
}): { coveredByAdvance: number; reimbursed: number; returned: number; keptInWallet: number } {
  const spent = Math.max(0, round(input.spent));
  const disbursed = Math.max(0, round(input.disbursed));
  if (spent <= disbursed) {
    const leftover = disbursed - spent;
    return {
      coveredByAdvance: spent,
      reimbursed: 0,
      returned: input.leftoverAction === "RETURN" ? leftover : 0,
      keptInWallet: input.leftoverAction === "KEEP" ? leftover : 0,
    };
  }
  const shortage = spent - disbursed;
  const fromWallet = input.shortageFrom === "WALLET" ? Math.min(shortage, Math.max(0, round(input.walletBalanceBefore))) : 0;
  return { coveredByAdvance: disbursed + fromWallet, reimbursed: shortage - fromWallet, returned: 0, keptInWallet: fromWallet > 0 ? -fromWallet : 0 };
}
