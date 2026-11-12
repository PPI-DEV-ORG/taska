import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { round } from "./accounting.types.js";

@Injectable()
export class AccountingReportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Buku Besar (General Ledger) per Akun atau Semua Akun
   */
  async getGeneralLedger(params: {
    startDate?: string | Date;
    endDate?: string | Date;
    accountCode?: string;
  }) {
    const where: any = {
      entry: {
        status: "POSTED",
      },
    };

    if (params.accountCode) {
      const allAccs = await (this.prisma.main as any).coaAccount.findMany({
        select: { code: true, parentCode: true },
      });
      const targetCodes = new Set<string>();
      targetCodes.add(params.accountCode);

      const collectChildren = (pCode: string) => {
        for (const a of allAccs) {
          if (a.parentCode === pCode || a.code.startsWith(`${pCode}.`)) {
            if (!targetCodes.has(a.code)) {
              targetCodes.add(a.code);
              collectChildren(a.code);
            }
          }
        }
      };
      collectChildren(params.accountCode);
      where.accountCode = { in: Array.from(targetCodes) };
    }

    if (params.startDate || params.endDate) {
      where.entry.date = {};
      if (params.startDate) where.entry.date.gte = new Date(params.startDate);
      if (params.endDate) where.entry.date.lte = new Date(params.endDate);
    }

    const lines = await (this.prisma.main as any).journalLine.findMany({
      where,
      include: {
        entry: true,
        account: true,
      },
      orderBy: [
        { entry: { date: "asc" } },
        { entryId: "asc" },
        { lineNo: "asc" },
      ],
    });

    const expenseIds = Array.from(
      new Set(
        lines
          .filter((l: any) => l.entry?.sourceType === "Expense" && l.entry?.sourceId)
          .map((l: any) => l.entry.sourceId)
      )
    ) as number[];

    const expMap = new Map<number, any>();
    if (expenseIds.length > 0) {
      const exps = await (this.prisma.main as any).expense.findMany({
        where: { id: { in: expenseIds } },
        include: {
          reporter: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
        },
      });
      exps.forEach((e: any) => expMap.set(e.id, e));
    }

    return lines.map((l: any) => {
      let memo = l.memo;
      let refNo = l.entry.refNo;
      if (l.entry?.sourceType === "Expense" && l.entry?.sourceId) {
        const exp = expMap.get(l.entry.sourceId);
        const expCode = `EXP-${String(l.entry.sourceId).padStart(3, "0")}`;
        const isPay = l.entry.event === "paid" || l.entry.source === "EXPENSE_PAYMENT";

        if (!refNo || /^\d+$/.test(refNo)) {
          refNo = isPay ? `${expCode}/PAY` : expCode;
        }

        if (exp) {
          const pelapor = exp.reporter?.name || "Karyawan";
          const kategori = exp.category?.name || "Operasional";
          const deskripsi = exp.description ? `: ${exp.description}` : "";

          if (isPay) {
            memo = l.accountCode === "2103"
              ? `Pelunasan Biaya/Reimbursement ${expCode} kepada ${pelapor}`
              : `Pengeluaran Kas/Bank ${kategori} (${pelapor})${exp.description ? ` (${exp.description})` : ""}`;
          } else {
            memo = l.accountCode === "2103"
              ? `Kewajiban Biaya/Reimbursement ${kategori} — ${pelapor}`
              : `Beban ${kategori}${deskripsi} (${pelapor})`;
          }
        }
      }
      return {
        id: l.id,
        entryId: l.entryId,
        entryNumber: l.entry.number,
        date: l.entry.date,
        accountCode: l.accountCode,
        accountName: l.account?.name || "",
        debit: Number(l.debit),
        credit: Number(l.credit),
        memo,
        refNo,
        source: l.entry?.source,
        sourceType: l.entry?.sourceType,
        sourceId: l.entry?.sourceId,
        partyType: l.partyType,
        partyId: l.partyId,
        projectId: l.projectId,
      };
    });
  }

  /**
   * Neraca Saldo (Trial Balance)
   */
  async getTrialBalance(params: { asOfDate?: string | Date }) {
    const asOf = params.asOfDate ? new Date(params.asOfDate) : new Date();

    const accounts = await (this.prisma.main as any).coaAccount.findMany({
      where: { status: "AKTIF" },
      orderBy: { code: "asc" },
    });

    const lines = await (this.prisma.main as any).journalLine.findMany({
      where: {
        entry: {
          status: "POSTED",
          date: { lte: asOf },
        },
      },
      select: {
        accountCode: true,
        debit: true,
        credit: true,
      },
    });

    const sumMap = new Map<string, { totalDebit: number; totalCredit: number }>();
    for (const l of lines) {
      const cur = sumMap.get(l.accountCode) || { totalDebit: 0, totalCredit: 0 };
      cur.totalDebit = round(cur.totalDebit + Number(l.debit));
      cur.totalCredit = round(cur.totalCredit + Number(l.credit));
      sumMap.set(l.accountCode, cur);
    }

    let grandTotalDebit = 0;
    let grandTotalCredit = 0;

    const rows = accounts.map((acc: any) => {
      const sums = sumMap.get(acc.code) || { totalDebit: 0, totalCredit: 0 };
      const net = round(sums.totalDebit - sums.totalCredit);
      let balanceDebit = 0;
      let balanceCredit = 0;

      if (acc.normalBalance === "DEBIT") {
        if (net >= 0) balanceDebit = net;
        else balanceCredit = Math.abs(net);
      } else {
        if (net <= 0) balanceCredit = Math.abs(net);
        else balanceDebit = net;
      }

      grandTotalDebit = round(grandTotalDebit + balanceDebit);
      grandTotalCredit = round(grandTotalCredit + balanceCredit);

      return {
        code: acc.code,
        name: acc.name,
        category: acc.category,
        normalBalance: acc.normalBalance,
        totalDebit: sums.totalDebit,
        totalCredit: sums.totalCredit,
        balanceDebit,
        balanceCredit,
      };
    });

    return {
      asOfDate: asOf,
      rows,
      grandTotalDebit,
      grandTotalCredit,
      isBalanced: grandTotalDebit === grandTotalCredit,
      difference: round(grandTotalDebit - grandTotalCredit),
    };
  }

  /**
   * Laporan Laba Rugi (Income Statement)
   */
  async getIncomeStatement(params: { startDate: string | Date; endDate: string | Date }) {
    const start = new Date(params.startDate);
    const end = new Date(params.endDate);

    const accounts = await (this.prisma.main as any).coaAccount.findMany({
      where: {
        status: "AKTIF",
        category: {
          in: [
            "Pendapatan",
            "Beban Pokok (HPP)",
            "Beban Operasional",
            "Pendapatan Diluar Usaha",
            "Beban Diluar Usaha",
          ],
        },
      },
      orderBy: { code: "asc" },
    });

    const lines = await (this.prisma.main as any).journalLine.findMany({
      where: {
        entry: {
          status: "POSTED",
          date: { gte: start, lte: end },
        },
        account: {
          category: {
            in: [
              "Pendapatan",
              "Beban Pokok (HPP)",
              "Beban Operasional",
              "Pendapatan Diluar Usaha",
              "Beban Diluar Usaha",
            ],
          },
        },
      },
      select: {
        accountCode: true,
        debit: true,
        credit: true,
      },
    });

    const sumMap = new Map<string, number>();
    for (const l of lines) {
      const cur = sumMap.get(l.accountCode) || 0;
      sumMap.set(l.accountCode, round(cur + Number(l.debit) - Number(l.credit)));
    }

    const categories: Record<string, { accounts: any[]; total: number }> = {
      revenue: { accounts: [], total: 0 },
      cogs: { accounts: [], total: 0 },
      operatingExpense: { accounts: [], total: 0 },
      otherRevenue: { accounts: [], total: 0 },
      otherExpense: { accounts: [], total: 0 },
    };

    for (const acc of accounts) {
      const net = sumMap.get(acc.code) || 0;
      let amount = 0;
      if (acc.normalBalance === "KREDIT") {
        amount = round(-net);
      } else {
        amount = round(net);
      }

      if (amount === 0 && !acc.isPostable) continue;

      const item = { code: acc.code, name: acc.name, amount };

      if (acc.category === "Pendapatan") {
        categories.revenue.accounts.push(item);
        categories.revenue.total = round(categories.revenue.total + amount);
      } else if (acc.category === "Beban Pokok (HPP)") {
        categories.cogs.accounts.push(item);
        categories.cogs.total = round(categories.cogs.total + amount);
      } else if (acc.category === "Beban Operasional") {
        categories.operatingExpense.accounts.push(item);
        categories.operatingExpense.total = round(categories.operatingExpense.total + amount);
      } else if (acc.category === "Pendapatan Diluar Usaha") {
        categories.otherRevenue.accounts.push(item);
        categories.otherRevenue.total = round(categories.otherRevenue.total + amount);
      } else if (acc.category === "Beban Diluar Usaha") {
        categories.otherExpense.accounts.push(item);
        categories.otherExpense.total = round(categories.otherExpense.total + amount);
      }
    }

    const grossProfit = round(categories.revenue.total - categories.cogs.total);
    const operatingProfit = round(grossProfit - categories.operatingExpense.total);
    const netProfit = round(
      operatingProfit + categories.otherRevenue.total - categories.otherExpense.total,
    );

    return {
      period: { startDate: start, endDate: end },
      revenue: categories.revenue,
      cogs: categories.cogs,
      grossProfit,
      operatingExpense: categories.operatingExpense,
      operatingProfit,
      otherRevenue: categories.otherRevenue,
      otherExpense: categories.otherExpense,
      netProfit,
    };
  }

  /**
   * Laporan Neraca (Balance Sheet)
   */
  async getBalanceSheet(params: { asOfDate?: string | Date }) {
    const asOf = params.asOfDate ? new Date(params.asOfDate) : new Date();

    const accounts = await (this.prisma.main as any).coaAccount.findMany({
      where: {
        status: "AKTIF",
        category: {
          in: [
            "Aset Lancar",
            "Aset Tetap",
            "Aset Lainnya",
            "Kewajiban Jangka Pendek",
            "Kewajiban Jangka Panjang",
            "Ekuitas",
          ],
        },
      },
      orderBy: { code: "asc" },
    });

    const lines = await (this.prisma.main as any).journalLine.findMany({
      where: {
        entry: {
          status: "POSTED",
          date: { lte: asOf },
        },
      },
      include: {
        account: true,
      },
    });

    const sumMap = new Map<string, number>();
    let plNet = 0;

    for (const l of lines) {
      const cat = l.account?.category;
      const net = round(Number(l.debit) - Number(l.credit));

      if (
        cat === "Pendapatan" ||
        cat === "Pendapatan Diluar Usaha"
      ) {
        plNet = round(plNet - net);
      } else if (
        cat === "Beban Pokok (HPP)" ||
        cat === "Beban Operasional" ||
        cat === "Beban Diluar Usaha"
      ) {
        plNet = round(plNet - net);
      } else {
        const cur = sumMap.get(l.accountCode) || 0;
        sumMap.set(l.accountCode, round(cur + net));
      }
    }

    const assets: any[] = [];
    let totalAssets = 0;

    const liabilities: any[] = [];
    let totalLiabilities = 0;

    const equity: any[] = [];
    let totalEquity = 0;

    for (const acc of accounts) {
      const net = sumMap.get(acc.code) || 0;
      let amount = 0;
      if (acc.normalBalance === "DEBIT") {
        amount = round(net);
      } else {
        amount = round(-net);
      }

      if (amount === 0 && !acc.isPostable) continue;

      const item = { code: acc.code, name: acc.name, category: acc.category, amount };

      if (acc.category.startsWith("Aset")) {
        assets.push(item);
        totalAssets = round(totalAssets + amount);
      } else if (acc.category.startsWith("Kewajiban")) {
        liabilities.push(item);
        totalLiabilities = round(totalLiabilities + amount);
      } else if (acc.category === "Ekuitas") {
        equity.push(item);
        totalEquity = round(totalEquity + amount);
      }
    }

    if (plNet !== 0) {
      equity.push({
        code: "3102-AUTO",
        name: "Laba Bersih Berjalan (Otomatis)",
        category: "Ekuitas",
        amount: plNet,
      });
      totalEquity = round(totalEquity + plNet);
    }

    const totalLiabilitiesAndEquity = round(totalLiabilities + totalEquity);

    return {
      asOfDate: asOf,
      assets: { items: assets, total: totalAssets },
      liabilities: { items: liabilities, total: totalLiabilities },
      equity: { items: equity, total: totalEquity },
      totalLiabilitiesAndEquity,
      isBalanced: totalAssets === totalLiabilitiesAndEquity,
      difference: round(totalAssets - totalLiabilitiesAndEquity),
    };
  }

  /**
   * Arus Kas (Cash Flow Statement - Metode Langsung)
   * Membaca langsung mutasi akun isCash=true dari JournalLine
   */
  async getCashFlow(params: { startDate: string | Date; endDate: string | Date }) {
    const start = new Date(params.startDate);
    const end = new Date(params.endDate);

    const cashAccounts = await (this.prisma.main as any).coaAccount.findMany({
      where: { isCash: true, status: "AKTIF" },
      select: { code: true, name: true },
    });
    const cashCodes = new Set<string>(cashAccounts.map((a: any) => a.code));

    const cashLines = await (this.prisma.main as any).journalLine.findMany({
      where: {
        accountCode: { in: Array.from(cashCodes) },
        entry: {
          status: "POSTED",
          date: { gte: start, lte: end },
        },
      },
      include: {
        entry: true,
        account: true,
      },
      orderBy: [{ entry: { date: "asc" } }, { id: "asc" }],
    });

    let totalInflow = 0;
    let totalOutflow = 0;
    const items = cashLines.map((l: any) => {
      const debit = Number(l.debit);
      const credit = Number(l.credit);
      totalInflow = round(totalInflow + debit);
      totalOutflow = round(totalOutflow + credit);
      const memoText = l.memo || l.entry.memo || "-";
      let refText = l.entry.refNo || "-";
      let pihak = l.partyType ? `${l.partyType} #${l.partyId}` : (l.entry.sourceType || "Perusahaan");
      if (l.entry.sourceType === "Expense" && l.entry.sourceId) {
        const expCode = `EXP-${String(l.entry.sourceId).padStart(3, "0")}`;
        refText = l.entry.event === "paid" || l.entry.source === "EXPENSE_PAYMENT" ? `${expCode}/PAY` : expCode;
      }
      return {
        id: l.id,
        date: l.entry.date,
        tanggal: l.entry.date ? String(l.entry.date).slice(0, 10) : "-",
        journalNumber: l.entry.number,
        refNo: refText,
        accountCode: l.accountCode,
        accountName: l.account?.name || "",
        kategori: l.entry.source === "EXPENSE_PAYMENT" ? "Operasional" : l.entry.source === "MANUAL" ? "Modal / Kas" : (l.entry.source || "Kas/Bank"),
        pihak,
        keterangan: memoText,
        memo: memoText,
        masuk: debit,
        keluar: credit,
        inflow: debit,
        outflow: credit,
        source: l.entry.source,
      };
    });

    const netCashFlow = round(totalInflow - totalOutflow);

    return {
      period: { startDate: start, endDate: end },
      totalInflow,
      totalOutflow,
      netCashFlow,
      items,
    };
  }

  /**
   * Rekonsiliasi Persediaan: Akun 1200 vs Nilai Fisik Stok Gudang
   */
  async reconcileInventory() {
    const lines = await (this.prisma.main as any).journalLine.findMany({
      where: {
        accountCode: "1200",
        entry: { status: "POSTED" },
      },
      select: { debit: true, credit: true },
    });
    const ledgerInventory = lines.reduce(
      (sum: number, l: any) => round(sum + Number(l.debit) - Number(l.credit)),
      0,
    );

    const products = await (this.prisma.main as any).product.findMany({
      where: { status: "AKTIF" },
    });
    const balances = await (this.prisma.main as any).stockBalance.findMany();
    const balanceMap = new Map<number, number>();
    for (const b of balances) {
      const cur = balanceMap.get(b.productId) || 0;
      balanceMap.set(b.productId, cur + Number(b.qty || 0));
    }

    let physicalInventory = 0;
    for (const p of products) {
      const totalQty = balanceMap.get(p.id) || 0;
      const avgCost = Number(p.avgCost || p.purchasePrice || 0);
      physicalInventory = round(physicalInventory + totalQty * avgCost);
    }

    const diff = round(ledgerInventory - physicalInventory);
    return {
      ledgerInventory,
      physicalInventory,
      difference: diff,
      isReconciled: Math.abs(diff) <= 100,
    };
  }
}
