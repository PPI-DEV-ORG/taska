/**
 * Saldo petty cash per karyawan (uang perusahaan yang sedang dipegang karyawan, akun Uang Muka Karyawan).
 *
 *   + saldo diisi Finance (ISI_SALDO) / petty cash yang dicairkan untuk survey, pengiriman, proyek
 *   - biaya yang sudah diverifikasi (laporan petty cash & Pengeluaran bersumber PETTY_CASH)
 *   - sisa yang dikembalikan ke kas (TARIK_SALDO / pengembalian saat penyelesaian)
 *
 * "Tersedia" = saldo dikurangi biaya yang sudah dicatat tapi belum diverifikasi Finance, supaya karyawan
 * tidak memakai uang yang sama dua kali.
 */
export const PETTY_CASH_SOURCE = "PETTY_CASH";

export type PettyCashWallet = {
  employee: { id: number; name: string; role: string };
  /** Saldo menurut pembukuan (sudah termasuk biaya yang diverifikasi). */
  balance: number;
  /** Biaya di dokumen petty cash yang belum diselesaikan Finance. */
  pendingReport: number;
  /** Pengeluaran PETTY_CASH yang menunggu verifikasi Finance. */
  pendingSpend: number;
  /** Dokumen petty cash (survey / pengiriman / proyek) yang masih berjalan. */
  activeCount: number;
  available: number;
};

const n = (v: unknown) => Number(v || 0);

export async function pettyCashWallets(db: any, employeeIds?: number[]): Promise<PettyCashWallet[]> {
  const [advances, expenses] = await Promise.all([
    db.cashAdvance.findMany({
      where: {
        status: { in: ["DICAIRKAN", "DILAPORKAN", "SELESAI"] },
        ...(employeeIds ? { employeeId: { in: employeeIds } } : {}),
      },
      select: {
        employeeId: true,
        status: true,
        disbursedAmount: true,
        spentAmount: true,
        reimbursedAmount: true,
        returnedAmount: true,
        employee: { select: { id: true, name: true, role: true } },
        items: { select: { amount: true } },
      },
    }),
    db.expense.findMany({
      where: {
        fundingSource: PETTY_CASH_SOURCE,
        status: { in: ["DILAPORKAN", "DISETUJUI", "DIBAYAR"] },
        cashAdvanceId: null,
        ...(employeeIds ? { reporterId: { in: employeeIds } } : {}),
      },
      select: { reporterId: true, status: true, amount: true, reporter: { select: { id: true, name: true, role: true } } },
    }),
  ]);

  const map = new Map<number, PettyCashWallet>();
  const get = (id: number, employee: any) => {
    let w = map.get(id);
    if (!w) {
      w = { employee, balance: 0, pendingReport: 0, pendingSpend: 0, activeCount: 0, available: 0 };
      map.set(id, w);
    }
    return w;
  };
  for (const r of advances) {
    const w = get(r.employeeId, r.employee);
    const disbursed = n(r.disbursedAmount);
    if (r.status === "SELESAI") {
      w.balance += disbursed - (n(r.spentAmount) - n(r.reimbursedAmount)) - n(r.returnedAmount);
    } else {
      w.balance += disbursed;
      w.pendingReport += (r.items ?? []).reduce((s: number, it: any) => s + n(it.amount), 0);
      w.activeCount += 1;
    }
  }
  for (const e of expenses) {
    const w = get(e.reporterId, e.reporter);
    if (e.status === "DIBAYAR") w.balance -= n(e.amount);
    else w.pendingSpend += n(e.amount);
  }
  return [...map.values()].map((w) => ({
    ...w,
    balance: Math.round(w.balance),
    pendingReport: Math.round(w.pendingReport),
    pendingSpend: Math.round(w.pendingSpend),
    available: Math.round(w.balance - w.pendingReport - w.pendingSpend),
  }));
}

export async function pettyCashAvailable(db: any, employeeId: number): Promise<number> {
  const [w] = await pettyCashWallets(db, [employeeId]);
  return w?.available ?? 0;
}
