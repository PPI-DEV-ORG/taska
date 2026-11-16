import { round, type JournalLineSpec } from "./accounting.types.js";
import { projectCostAccount } from "./project-cost.rules.js";

/**
 * Jurnal petty cash (kasbon operasional karyawan).
 *
 *  Pencairan   : Dr Uang Muka Karyawan (1107)            Cr Kas/Bank yang dipilih Finance
 *  Penyelesaian: Dr Beban (per rincian biaya)            Cr Uang Muka Karyawan   (sebesar yang ditutup petty cash)
 *                                                        Cr Kas/Bank             (kelebihan biaya yang dibayar perusahaan)
 *  Sisa kembali: Dr Kas/Bank                             Cr Uang Muka Karyawan
 *
 * Saldo akun 1107 per karyawan = saldo petty cash karyawan tersebut.
 */

export type CashAdvanceParty = {
  employeeId: number;
  employeeName?: string;
  projectId?: number | null;
  number: string;
  /** Untuk apa petty cash ini dipakai, mis. "Survey PT ABC (Jl. Merdeka)" / "Proyek CCTV Gedung A". */
  usage?: string | null;
};

type UsageSource = {
  description?: string | null;
  survey?: { location?: string | null; lead?: { name?: string | null } | null } | null;
  project?: { name?: string | null } | null;
  deliveryNote?: { number?: string | null } | null;
};

/** Label keperluan petty cash untuk keterangan jurnal: survey / proyek / surat jalan, kalau tidak ada pakai uraiannya. */
export function pettyCashUsage(src: UsageSource): string {
  const clip = (v: string, max = 70) => (v.length > max ? `${v.slice(0, max - 1)}…` : v);
  if (src.survey) {
    const who = src.survey.lead?.name?.trim();
    const where = src.survey.location?.trim();
    return clip(`Survey ${[who, where ? `(${where})` : ""].filter(Boolean).join(" ") || "lokasi"}`);
  }
  if (src.project?.name) return clip(`Proyek ${src.project.name.trim()}`);
  if (src.deliveryNote?.number) return `Pengiriman ${src.deliveryNote.number}`;
  const d = src.description?.trim();
  return d ? clip(d) : "";
}

const forUsage = (u?: string | null) => (u ? ` untuk ${u}` : "");

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
      memo: `Petty cash ${adv.number}${forUsage(adv.usage)} — diserahkan ke ${who}`.slice(0, 191),
      partyType: "EMPLOYEE",
      partyId: adv.employeeId,
      projectId: adv.projectId ?? null,
    },
    {
      accountCode: adv.cashAccountCode || map.CASH_DEFAULT || "1000.02",
      debit: 0,
      credit: amount,
      memo: `Pencairan petty cash ${adv.number}${forUsage(adv.usage)} (${who})`.slice(0, 191),
      partyType: "EMPLOYEE",
      partyId: adv.employeeId,
      projectId: adv.projectId ?? null,
    },
  ];
}

export type SettleExpenseLine = { accountCode?: string | null; amount: number; description: string; projectId?: number | null };

/**
 * @param coveredByAdvance biaya yang ditutup dari uang muka karyawan (petty cash ini + saldo petty cash bila dipakai)
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
      accountCode: projectCostAccount(map, e.projectId ?? adv.projectId, e.accountCode || map.EXPENSE_DEFAULT || "6202"),
      debit: amount,
      credit: 0,
      memo: `${e.description}${forUsage(adv.usage)} — petty cash ${adv.number} (${who})`.slice(0, 191),
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
      memo: `Pertanggungjawaban petty cash ${adv.number}${forUsage(adv.usage)} (${who})`.slice(0, 191),
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
      memo: `Kekurangan petty cash ${adv.number}${forUsage(adv.usage)} dibayar ke ${who}`.slice(0, 191),
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
      memo: `Sisa petty cash ${adv.number}${forUsage(adv.usage)} dikembalikan ${who}`.slice(0, 191),
      partyType: "EMPLOYEE",
      partyId: adv.employeeId,
      projectId: adv.projectId ?? null,
    },
    {
      accountCode: advanceAccount(map),
      debit: 0,
      credit: amount,
      memo: `Pengembalian sisa petty cash ${adv.number}${forUsage(adv.usage)} (${who})`.slice(0, 191),
      partyType: "EMPLOYEE",
      partyId: adv.employeeId,
      projectId: adv.projectId ?? null,
    },
  ];
}

/**
 * Pembagian biaya saat penyelesaian.
 * @param spent     total biaya yang dilaporkan
 * @param disbursed petty cash yang dicairkan untuk dokumen ini
 * @param walletBalanceBefore saldo petty cash karyawan dari petty cash lain (sisa yang disimpan), boleh dipakai bila kurang
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

/**
 * Pemakaian saldo petty cash (Pengeluaran bersumber PETTY_CASH) setelah diverifikasi Finance:
 *   Dr Beban (kategori pengeluaran)   Cr Uang Muka Karyawan (saldo petty cash karyawan berkurang)
 * Tidak ada kas keluar: uangnya sudah di tangan karyawan sejak saldo diisi.
 */
export function buildPettyCashSpendLines(
  exp: {
    number: string;
    amount: number;
    employeeId: number;
    employeeName?: string;
    expenseAccountCode?: string | null;
    projectId?: number | null;
    description?: string | null;
    categoryName?: string | null;
    usage?: string | null;
  },
  map: Record<string, string>,
): JournalLineSpec[] {
  const amount = round(exp.amount);
  const who = exp.employeeName || "Karyawan";
  const what = exp.description ? `: ${exp.description}` : "";
  return [
    {
      accountCode: projectCostAccount(map, exp.projectId, exp.expenseAccountCode || map.EXPENSE_DEFAULT || "6202.07"),
      debit: amount,
      credit: 0,
      memo: `Beban ${exp.categoryName || "Operasional"}${what}${forUsage(exp.usage)} — petty cash ${who}`.slice(0, 191),
      partyType: "EMPLOYEE",
      partyId: exp.employeeId,
      projectId: exp.projectId ?? null,
    },
    {
      accountCode: advanceAccount(map),
      debit: 0,
      credit: amount,
      memo: `Pemakaian petty cash ${exp.number}${forUsage(exp.usage)}${exp.description && !exp.usage ? `: ${exp.description}` : ""} (${who})`.slice(0, 191),
      partyType: "EMPLOYEE",
      partyId: exp.employeeId,
      projectId: exp.projectId ?? null,
    },
  ];
}
