import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { round } from "./accounting.types.js";
import { computeProjectPnl } from "../projects/project-pnl.js";

function parseStartDate(d?: string | Date): Date | undefined {
  if (!d) return undefined;
  if (d instanceof Date) return isNaN(d.getTime()) ? undefined : d;
  const s = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T00:00:00.000Z`);
  }
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}

function parseEndDate(d?: string | Date): Date | undefined {
  if (!d) return undefined;
  if (d instanceof Date) return isNaN(d.getTime()) ? undefined : d;
  const s = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T23:59:59.999Z`);
  }
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}

function formatEntryDateTime(dateVal: any, createdAtVal?: any): string {
  const dSource = createdAtVal ? new Date(createdAtVal) : dateVal ? new Date(dateVal) : null;
  if (!dSource || isNaN(dSource.getTime())) {
    return dateVal ? String(dateVal).slice(0, 10) : "-";
  }
  let yyyy = dSource.getFullYear();
  let mm = String(dSource.getMonth() + 1).padStart(2, "0");
  let dd = String(dSource.getDate()).padStart(2, "0");
  if (dateVal) {
    const dDate = new Date(dateVal);
    if (!isNaN(dDate.getTime())) {
      yyyy = dDate.getFullYear();
      mm = String(dDate.getMonth() + 1).padStart(2, "0");
      dd = String(dDate.getDate()).padStart(2, "0");
    }
  }
  const hh = String(dSource.getHours()).padStart(2, "0");
  const min = String(dSource.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

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

    const start = parseStartDate(params.startDate);
    const end = parseEndDate(params.endDate);
    if (start || end) {
      where.entry.date = {};
      if (start) where.entry.date.gte = start;
      if (end) where.entry.date.lte = end;
    }

    const lines = await (this.prisma.main as any).journalLine.findMany({
      where,
      include: {
        entry: true,
        account: true,
      },
      orderBy: [
        { entry: { date: "asc" } },
        { entry: { createdAt: "asc" } },
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

        const ev = l.entry.event;
        // Hanya jurnal pengakuan / pembayaran biaya biasa; reklasifikasi HPP & pemakaian petty cash memakai memo tersimpan
        if (exp && (!ev || ev === "approved" || ev === "paid") && exp.fundingSource !== "PETTY_CASH") {
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
              : `${exp.projectId ? "HPP project" : "Beban"} ${kategori}${deskripsi} (${pelapor})`;
          }
        }
      }
      return {
        id: l.id,
        entryId: l.entryId,
        entryNumber: l.entry.number,
        date: l.entry.date,
        createdAt: l.entry.createdAt,
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
    const asOf = parseEndDate(params.asOfDate);

    const accounts = await (this.prisma.main as any).coaAccount.findMany({
      where: { status: "AKTIF" },
      orderBy: { code: "asc" },
    });

    const lines = await (this.prisma.main as any).journalLine.findMany({
      where: {
        entry: {
          status: "POSTED",
          ...(asOf ? { date: { lte: asOf } } : {}),
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
      asOfDate: asOf || new Date(),
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
  async getIncomeStatement(params: { startDate?: string | Date; endDate?: string | Date }) {
    const start = parseStartDate(params.startDate);
    const end = parseEndDate(params.endDate);
    const dateFilter = start || end ? { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } : undefined;

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

    const [lines, ppnLines, projects] = await Promise.all([
      (this.prisma.main as any).journalLine.findMany({
        where: {
          entry: {
            status: "POSTED",
            ...(dateFilter ? { date: dateFilter } : {}),
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
      }),
      (this.prisma.main as any).journalLine.findMany({
        where: {
          accountCode: { in: ["2100", "2102"] },
          entry: {
            status: "POSTED",
            ...(dateFilter ? { date: dateFilter } : {}),
          },
        },
        select: {
          debit: true,
          credit: true,
        },
      }),
      this.prisma.main.project.findMany({
        where: dateFilter ? { startDate: dateFilter } : {},
        include: {
          customer: { select: { name: true } },
          pic: { select: { name: true } },
          invoices: {
            where: { status: { not: "BATAL" }, isProforma: false },
            select: { amount: true, ppn: true, pph: true, total: true, paidAmount: true, status: true },
          },
        },
        orderBy: { startDate: "desc" },
      }),
    ]);

    const ppnKeluaran = Math.max(
      0,
      round(ppnLines.reduce((s: number, l: any) => s + Number(l.credit || 0) - Number(l.debit || 0), 0)),
    );

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

      if (amount === 0) continue;

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

    const projectRows = await Promise.all(
      projects.map(async (p) => {
        const pnl = await computeProjectPnl(this.prisma.main, p.id).catch(() => null);
        const validInvs = p.invoices || [];
        const invPpn = round(validInvs.reduce((s, i) => s + Number(i.ppn || 0), 0));
        const invGross = round(validInvs.reduce((s, i) => s + Number(i.total || 0), 0));
        const paidCashIn = round(
          validInvs.reduce((s, i) => {
            const tot = Number(i.total || 0);
            const paid = Number(i.paidAmount || 0);
            return s + (i.status === "PAID" ? Math.max(paid, tot) : Math.min(tot || paid, paid));
          }, 0),
        );
        const arOutstanding = Math.max(0, round(invGross - paidCashIn));
        const revenueDpp = pnl ? pnl.revenue : round(validInvs.reduce((s, i) => s + Number(i.amount || 0), 0));
        const cogsPo = pnl ? round(pnl.hppGoods + pnl.directPurchases) : 0;
        const opexExpense = pnl ? round(pnl.expenses) : 0;
        const projGrossProfit = round(revenueDpp - cogsPo);
        const projNetProfit = pnl ? pnl.netProfit : round(revenueDpp - cogsPo - opexExpense);
        const marginPct = pnl ? pnl.marginPct : revenueDpp > 0 ? Number(((projNetProfit / revenueDpp) * 100).toFixed(1)) : 0;
        const statusKesehatan = projNetProfit < 0 ? "RUGI" : marginPct >= 15 ? "SEHAT" : "WASPADA";

        return {
          id: p.id,
          project: p.name,
          customer: p.customer?.name || "-",
          pic: p.pic?.name || "-",
          status: p.status,
          revenueGross: invGross || revenueDpp + invPpn,
          revenueDpp,
          ppnKeluaran: invPpn,
          paidCashIn,
          arOutstanding,
          hppGoods: pnl?.hppGoods ?? 0,
          directPurchases: pnl?.directPurchases ?? 0,
          cogsPo,
          opexExpense,
          hppTotal: pnl?.hppTotal ?? (cogsPo + opexExpense),
          grossProfit: projGrossProfit,
          netProfit: projNetProfit,
          marginPct,
          statusKesehatan,
        };
      }),
    );

    return {
      period: { startDate: start || null, endDate: end || new Date() },
      revenue: categories.revenue,
      ppnKeluaran,
      revenueGross: round(categories.revenue.total + ppnKeluaran),
      cogs: categories.cogs,
      grossProfit,
      operatingExpense: categories.operatingExpense,
      operatingProfit,
      otherRevenue: categories.otherRevenue,
      otherExpense: categories.otherExpense,
      netProfit,
      projectRows,
    };
  }

  /**
   * Laporan Neraca (Balance Sheet)
   */
  async getBalanceSheet(params: { asOfDate?: string | Date }) {
    const asOf = parseEndDate(params.asOfDate);

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
          ...(asOf ? { date: { lte: asOf } } : {}),
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

      if (amount === 0) continue;

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
      asOfDate: asOf || new Date(),
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
  async getCashFlow(params: { startDate?: string | Date; endDate?: string | Date }) {
    const start = parseStartDate(params.startDate);
    const end = parseEndDate(params.endDate);
    const dateFilter = start || end ? { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } : undefined;

    const cashAccounts = await (this.prisma.main as any).coaAccount.findMany({
      where: { isCash: true, status: "AKTIF" },
      select: { code: true, name: true },
    });
    const cashCodes = new Set<string>(cashAccounts.map((a: any) => a.code));

    const [cashLines, customers, suppliers, users, projects, expenses, invoicesOut, purchaseRequests] = await Promise.all([
      (this.prisma.main as any).journalLine.findMany({
        where: {
          accountCode: { in: Array.from(cashCodes) },
          entry: {
            status: "POSTED",
            ...(dateFilter ? { date: dateFilter } : {}),
          },
        },
        include: {
          entry: true,
          account: true,
        },
        orderBy: [{ entry: { date: "desc" } }, { entry: { createdAt: "desc" } }, { id: "desc" }],
      }),
      this.prisma.main.customer.findMany({ select: { id: true, name: true } }).catch(() => []),
      this.prisma.main.supplier.findMany({ select: { id: true, name: true } }).catch(() => []),
      this.prisma.main.user.findMany({ select: { id: true, name: true } }).catch(() => []),
      this.prisma.main.project.findMany({ select: { id: true, name: true } }).catch(() => []),
      this.prisma.main.expense
        .findMany({
          include: {
            reporter: { select: { name: true } },
            category: { select: { name: true } },
            project: { select: { name: true } },
          },
        })
        .catch(() => []),
      this.prisma.main.invoiceOut
        .findMany({
          select: {
            id: true,
            number: true,
            customer: { select: { name: true } },
            project: { select: { name: true } },
          },
        })
        .catch(() => []),
      this.prisma.main.purchaseRequest
        .findMany({
          select: {
            id: true,
            number: true,
            supplier: { select: { name: true } },
            requester: { select: { name: true } },
            project: { select: { name: true } },
          },
        })
        .catch(() => []),
    ]);

    const customerMap = new Map(customers.map((c) => [c.id, c.name]));
    const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));
    const userMap = new Map(users.map((u) => [u.id, u.name]));
    const projectMap = new Map(projects.map((p) => [p.id, p.name]));
    const expenseMap = new Map(expenses.map((e) => [e.id, e]));
    const invoiceOutByIdMap = new Map(invoicesOut.map((inv) => [inv.id, inv]));
    const invoiceOutByNumMap = new Map(invoicesOut.map((inv) => [inv.number, inv]));
    const prByIdMap = new Map(purchaseRequests.map((pr) => [pr.id, pr]));
    const prByNumMap = new Map(purchaseRequests.map((pr) => [pr.number, pr]));

    let totalInflow = 0;
    let totalOutflow = 0;
    let cashInCustomers = 0;
    let cashOutSuppliers = 0;
    let cashOutExpenses = 0;

    const items = cashLines.map((l: any) => {
      const debit = Number(l.debit);
      const credit = Number(l.credit);
      totalInflow = round(totalInflow + debit);
      totalOutflow = round(totalOutflow + credit);

      const src = String(l.entry.source || "").toUpperCase();
      const srcType = String(l.entry.sourceType || "");
      const memoText = l.memo || l.entry.memo || "-";
      let refText = l.entry.refNo || l.entry.number || "-";
      const projId = l.projectId ?? l.entry.projectId;
      let projectName = projId ? projectMap.get(Number(projId)) || `Project #${projId}` : "-";

      let pihak = l.account?.name || "Kas/Bank";
      if (l.partyType === "CUSTOMER") {
        if (l.partyId) {
          pihak = customerMap.get(Number(l.partyId)) || `Pelanggan #${l.partyId}`;
        } else {
          const cleanRef = String(refText).replace(/\/PAY$/i, "");
          const inv =
            (l.entry.sourceId ? invoiceOutByIdMap.get(Number(l.entry.sourceId)) : undefined) ||
            invoiceOutByNumMap.get(cleanRef);
          pihak = inv?.customer?.name || "Pelanggan Walk-in / Umum";
          if (inv?.project?.name && projectName === "-") projectName = inv.project.name;
        }
      } else if (l.partyType === "SUPPLIER") {
        if (l.partyId) {
          pihak = supplierMap.get(Number(l.partyId)) || `Pemasok #${l.partyId}`;
        } else {
          pihak = "Pemasok / Vendor";
        }
      } else if (l.partyType === "EMPLOYEE" && l.partyId) {
        pihak = userMap.get(Number(l.partyId)) || `Karyawan #${l.partyId}`;
      }

      if (srcType === "Expense" && l.entry.sourceId) {
        const exp = expenseMap.get(Number(l.entry.sourceId));
        const expCode = `EXP-${String(l.entry.sourceId).padStart(3, "0")}`;
        refText = l.entry.event === "paid" || src === "EXPENSE_PAYMENT" ? `${expCode}/PAY` : expCode;
        if (exp?.reporter?.name) pihak = exp.reporter.name;
        if (exp?.project?.name && projectName === "-") projectName = exp.project.name;
      } else if (srcType === "PurchaseRequest" || src === "RETAIL_PURCHASE" || src === "PURCHASE_REQUEST") {
        const cleanRef = String(refText).replace(/\/PAY$/i, "");
        const pr =
          (l.entry.sourceId ? prByIdMap.get(Number(l.entry.sourceId)) : undefined) ||
          prByNumMap.get(cleanRef);
        if (pr) {
          pihak = pr.supplier?.name || pr.requester?.name || "Pembelian Ritel / Toko";
          if (pr.project?.name && projectName === "-") projectName = pr.project.name;
        } else if (pihak === (l.account?.name || "Kas/Bank")) {
          pihak = "Pembelian Ritel / Toko";
        }
      } else if ((src === "INVOICE_OUT_PAYMENT" || src === "INVOICE_OUT" || srcType === "InvoiceOut") && pihak === (l.account?.name || "Kas/Bank")) {
        const cleanRef = String(refText).replace(/\/PAY$/i, "");
        const inv =
          (l.entry.sourceId ? invoiceOutByIdMap.get(Number(l.entry.sourceId)) : undefined) ||
          invoiceOutByNumMap.get(cleanRef);
        pihak = inv?.customer?.name || "Pelanggan Walk-in / Umum";
        if (inv?.project?.name && projectName === "-") projectName = inv.project.name;
      }

      let kategori = "Kas/Bank";
      const isCustomerInflow =
        debit > 0 &&
        (src === "INVOICE_OUT_PAYMENT" ||
          src === "INVOICE_OUT" ||
          srcType === "InvoiceOut" ||
          l.partyType === "CUSTOMER");
      const isSupplierOutflow =
        credit > 0 &&
        (src === "INVOICE_IN_PAYMENT" ||
          src === "INVOICE_IN" ||
          src === "PURCHASE_REQUEST" ||
          src === "RETAIL_PURCHASE" ||
          srcType === "InvoiceIn" ||
          srcType === "SupplierPO" ||
          srcType === "PurchaseRequest" ||
          l.partyType === "SUPPLIER");
      const isExpenseOutflow =
        credit > 0 &&
        (src === "EXPENSE_PAYMENT" ||
          src === "EXPENSE" ||
          src === "CASH_ADVANCE" ||
          src === "PAYROLL" ||
          srcType === "Expense" ||
          srcType === "CashAdvance" ||
          srcType === "Payroll");

      if (debit > 0) {
        if (isCustomerInflow) {
          kategori = "Penerimaan Pelanggan";
          cashInCustomers = round(cashInCustomers + debit);
        } else if (src === "CASH_ADVANCE" || srcType === "CashAdvance") {
          kategori = "Pengembalian Petty Cash";
        } else if (src === "MANUAL") {
          kategori = "Modal / Kas Masuk";
        } else {
          kategori = "Kas Masuk Operasional";
          cashInCustomers = round(cashInCustomers + debit);
        }
      } else if (credit > 0) {
        if (isSupplierOutflow) {
          kategori = "Pelunasan Pemasok PO";
          cashOutSuppliers = round(cashOutSuppliers + credit);
        } else if (isExpenseOutflow) {
          kategori = src === "PAYROLL" || srcType === "Payroll" ? "Payroll & Gaji" : "Biaya Operasional";
          cashOutExpenses = round(cashOutExpenses + credit);
        } else if (src === "MANUAL") {
          kategori = "Penarikan / Kas Keluar";
          cashOutExpenses = round(cashOutExpenses + credit);
        } else {
          kategori = "Kas Keluar Operasional";
          cashOutExpenses = round(cashOutExpenses + credit);
        }
      }

      return {
        id: l.id,
        date: l.entry.date,
        createdAt: l.entry.createdAt,
        tanggal: formatEntryDateTime(l.entry.date, l.entry.createdAt),
        journalNumber: l.entry.number,
        refNo: refText,
        accountCode: l.accountCode,
        accountName: l.account?.name || "",
        kategori,
        pihak,
        project: projectName,
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
      period: { startDate: start || null, endDate: end || new Date() },
      cashInCustomers,
      cashOutSuppliers,
      cashOutExpenses,
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
