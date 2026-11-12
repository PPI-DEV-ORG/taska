import * as React from "react";
import { View, Pressable, ScrollView } from "react-native";
import {
  Scale,
  TrendingUp,
  Wallet,
  BookOpen,
  FolderKanban,
} from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { PageHeader } from "@/components/taska/basics";
import { DatePicker } from "@/components/taska/dialogs";
import { useApp } from "@/store/app-store";
import { rupiah, tanggal } from "@/lib/format";
import { colors } from "@/tokens";
import {
  CHART_OF_ACCOUNTS,
  buildCoaTree,
  computeFinancialStatements,
  loadManualJournals,
  loadCustomCoa,
  loadDeletedCoaCodes,
  saveManualJournals,
  type ManualJournal,
  type CoaAccount,
} from "@/lib/accounting";
import { api } from "@/services/api";
import { useLocalSearchParams } from "expo-router";

import type { ReportTab, ReportCardItem, DownloadFormat } from "@/modules/reports/types";
import { downloadReport, downloadEfakturCsv, downloadEfakturMasukanCsv } from "@/modules/reports/lib/export-helpers";
import { PnlTab } from "@/modules/reports/components/pnl-tab";
import { BalanceSheetTab } from "@/modules/reports/components/balance-sheet-tab";
import { CashFlowTab } from "@/modules/reports/components/cash-flow-tab";
import { JournalTab } from "@/modules/reports/components/journal-tab";
import { ReportCardsTab } from "@/modules/reports/components/report-cards-tab";

function formatJournalDateTime(dateVal: any, createdAtVal?: any): string {
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

export default function ReportsScreen() {
  const { data, approvals, user, toast } = useApp();
  const roleLower = (user?.role || "").toLowerCase();
  const canAccessFinancials = ["super_admin", "admin", "bos", "finance"].includes(roleLower);
  const params = useLocalSearchParams<{ tab?: ReportTab }>();

  const [selectedTab, setSelectedTab] = React.useState<ReportTab>(
    canAccessFinancials ? "pnl" : "cards"
  );
  const activeTab = params.tab && canAccessFinancials
    ? (params.tab as ReportTab)
    : selectedTab;
  const setActiveTab = setSelectedTab;

  const [manualJournals, setManualJournals] = React.useState<ManualJournal[]>(() => loadManualJournals());
  const [customAccounts] = React.useState<CoaAccount[]>(() => loadCustomCoa());
  const [deletedCoaCodes] = React.useState<string[]>(() => loadDeletedCoaCodes());

  React.useEffect(() => {
    let active = true;
    api<{ items?: any[] }>("GET", "/manual-journals")
      .then((res) => {
        if (!active || !Array.isArray(res?.items) || res.items.length === 0) return;
        const dbJournals: ManualJournal[] = res.items.map((r: any) => ({
          id: String(r.id || r.journalNo),
          journalNo: r.journalNo,
          tanggal: r.date || r.tanggal,
          refNo: r.refNo || "-",
          keterangan: r.description || r.keterangan,
          project: r.project || "-",
          createdBy: r.createdBy || "Admin Finance",
          createdAt: r.createdAt,
          lines: typeof r.lines === "string" ? JSON.parse(r.lines) : r.lines,
        }));
        setManualJournals((prev) => {
          const map = new Map<string, ManualJournal>();
          prev.forEach((j) => map.set(j.journalNo || j.id, j));
          dbJournals.forEach((j) => map.set(j.journalNo || j.id, j));
          const merged = Array.from(map.values());
          saveManualJournals(merged);
          return merged;
        });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const [reportDate, setReportDate] = React.useState("");

  // Server-side accounting reports
  const [serverIncomeStatement, setServerIncomeStatement] = React.useState<any>(null);
  const [serverBalanceSheet, setServerBalanceSheet] = React.useState<any>(null);
  const [serverCashFlow, setServerCashFlow] = React.useState<any>(null);
  const [serverTrialBalance, setServerTrialBalance] = React.useState<any>(null);
  const [serverJournalLines, setServerJournalLines] = React.useState<any[] | null>(null);

  React.useEffect(() => {
    if (!canAccessFinancials) return;
    let active = true;

    const startDate = reportDate ? `${reportDate.slice(0, 7)}-01` : undefined;
    const endDate = reportDate ? reportDate.slice(0, 10) : undefined;

    const query = new URLSearchParams();
    if (startDate) query.set("startDate", startDate);
    if (endDate) query.set("endDate", endDate);
    const qStr = query.toString();

    void api<any>("GET", `/accounting/income-statement${qStr ? `?${qStr}` : ""}`)
      .then((res) => { if (active && res) setServerIncomeStatement(res); })
      .catch(() => {});

    void api<any>("GET", `/accounting/balance-sheet${endDate ? `?asOfDate=${endDate}` : ""}`)
      .then((res) => { if (active && res) setServerBalanceSheet(res); })
      .catch(() => {});

    void api<any>("GET", `/accounting/cash-flow${qStr ? `?${qStr}` : ""}`)
      .then((res) => { if (active && res) setServerCashFlow(res); })
      .catch(() => {});

    void api<any>("GET", `/accounting/trial-balance${endDate ? `?asOfDate=${endDate}` : ""}`)
      .then((res) => { if (active && res) setServerTrialBalance(res); })
      .catch(() => {});

    const jParams = new URLSearchParams();
    if (reportDate) {
      jParams.set("startDate", `${reportDate.slice(0, 10)}T00:00:00Z`);
      jParams.set("endDate", `${reportDate.slice(0, 10)}T23:59:59Z`);
    }
    jParams.set("limit", "150");
    const jStr = jParams.toString();
    void api<any>("GET", `/accounting/journals${jStr ? `?${jStr}` : ""}`)
      .then((res) => {
        if (!active || !Array.isArray(res?.items)) return;
        const mappedLines: any[] = [];
        res.items.forEach((entry: any) => {
          let entryRef = entry.refNo || "-";
          if (entry.sourceType === "Expense" && entry.sourceId && (!entryRef || /^\d+$/.test(entryRef))) {
            const expCode = `EXP-${String(entry.sourceId).padStart(3, "0")}`;
            entryRef = entry.event === "paid" || entry.source === "EXPENSE_PAYMENT" ? `${expCode}/PAY` : expCode;
          }
          (entry.lines || []).forEach((line: any) => {
            mappedLines.push({
              id: String(line.id),
              journalNo: entry.number || `JU-${entry.id}`,
              tanggal: formatJournalDateTime(entry.date, entry.createdAt),
              refNo: entryRef,
              sumber:
                entry.source === "EXPENSE"
                  ? "Pengeluaran (Expense)"
                  : entry.source === "EXPENSE_PAYMENT"
                  ? "Pelunasan Expense"
                  : entry.source === "DELIVERY"
                  ? "Pengiriman Barang"
                  : entry.source === "RECEIVING"
                  ? "Penerimaan Barang"
                  : entry.source === "RETAIL_PURCHASE" || entry.source === "PURCHASE_REQUEST"
                  ? "Pembelian Ritel"
                  : entry.source === "INVOICE_OUT"
                  ? "Faktur Pelanggan"
                  : entry.source === "INVOICE_OUT_PAYMENT"
                  ? "Pembayaran Faktur"
                  : entry.source === "INVOICE_IN"
                  ? "PO Pemasok"
                  : entry.source === "INVOICE_IN_PAYMENT"
                  ? "Pelunasan PO"
                  : entry.source === "MANUAL"
                  ? "Jurnal Manual"
                  : (entry.source || "Jurnal"),
              keterangan: line.memo || entry.memo || "-",
              project: line.projectId ? `Project #${line.projectId}` : entry.projectId ? `Project #${entry.projectId}` : "-",
              kodeAkun: line.accountCode,
              namaAkun: line.memo || line.accountCode,
              debit: Number(line.debit || 0),
              kredit: Number(line.credit || 0),
            });
          });
        });
        setServerJournalLines(mappedLines);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [canAccessFinancials, reportDate]);

  const filteredData = React.useMemo(() => {
    if (!reportDate) return data;
    const target = reportDate.slice(0, 10);
    const filterItems = (arr?: any[]) => {
      if (!arr) return [];
      return arr.filter((item) => {
        const cands = [item.tanggal, item.closing, item.jadwal, item.jatuhTempo, item.waktu, item.createdAt, item.date];
        return cands.some((c) => c && (String(c).startsWith(target) || String(c).includes(target)));
      });
    };
    return {
      ...data,
      invoices: filterItems(data.invoices),
      expenses: filterItems(data.expenses),
      "supplier-pos": filterItems(data["supplier-pos"]),
      "delivery-notes": filterItems(data["delivery-notes"]),
      leads: filterItems(data.leads),
      projects: data.projects,
    };
  }, [data, reportDate]);

  const fin = React.useMemo(() => {
    const localFin = computeFinancialStatements(filteredData, manualJournals, customAccounts, deletedCoaCodes);
    if (!serverIncomeStatement && !serverBalanceSheet && !serverCashFlow && !serverTrialBalance && !serverJournalLines) {
      return localFin;
    }

    // Merge server official double-entry data if available
    const merged = { ...localFin };

    const sumAccounts = (items: any[] = [], prefixes: string[]) => {
      if (Array.isArray(items) && items.length > 0) {
        return items
          .filter((i: any) => prefixes.some((p) => i.code === p || i.code.startsWith(`${p}.`)))
          .reduce((sum: number, i: any) => sum + Number(i.amount || 0), 0);
      }
      return (merged.coaBalances || [])
        .filter((a: any) => !a.isHeader && prefixes.some((p) => a.code === p || a.code.startsWith(`${p}.`)))
        .reduce((sum: number, a: any) => sum + Number(a.endingBalance || 0), 0);
    };

    if (serverIncomeStatement) {
      const revTotal = Number(serverIncomeStatement.revenue?.total || 0);
      const cogsTotal = Number(serverIncomeStatement.cogs?.total || 0);
      const opexTotal = Number(serverIncomeStatement.operatingExpense?.total || 0);
      const grossProfit = Number(serverIncomeStatement.grossProfit || (revTotal - cogsTotal));
      const netProfit = Number(serverIncomeStatement.netProfit || (grossProfit - opexTotal));
      const grossMarginPct = revTotal > 0 ? Number(((grossProfit / revTotal) * 100).toFixed(1)) : 0;
      const netMarginPct = revTotal > 0 ? Number(((netProfit / revTotal) * 100).toFixed(1)) : 0;

      const ppnKeluaran = sumAccounts(serverBalanceSheet?.liabilities?.items, ["2100", "2102"]);
      const revenueGross = revTotal + ppnKeluaran;

      const cogsProject = (serverIncomeStatement.cogs?.accounts || []).find((a: any) => a.code === "5101")?.amount ?? cogsTotal;
      const cogsRetail = (serverIncomeStatement.cogs?.accounts || []).find((a: any) => a.code === "5102")?.amount ?? 0;

      const opexByCategory = (serverIncomeStatement.operatingExpense?.accounts || [])
        .filter((a: any) => Number(a.amount || 0) > 0)
        .map((a: any) => ({
          kategori: a.name.replace(/^Biaya\s+/i, "").replace(/^Beban\s+/i, ""),
          nominal: Number(a.amount || 0),
          count: 1,
        }));

      merged.incomeStatement = {
        ...localFin.incomeStatement,
        revenueGross,
        revenueDpp: revTotal,
        ppnKeluaran,
        cogsProject,
        cogsRetail,
        cogsTotal,
        grossProfit,
        grossMarginPct,
        opexByCategory,
        opexTotal,
        netProfit,
        netMarginPct,
      };
    } else if (merged.coaBalances && merged.coaBalances.length > 0) {
      const coaRevenue = merged.coaBalances
        .filter((a: any) => !a.isHeader && (a.category === "Pendapatan" || a.category === "Pendapatan Diluar Usaha"))
        .reduce((s: number, a: any) => s + (Number(a.endingBalance) || 0), 0);
      const coaCogs = merged.coaBalances
        .filter((a: any) => !a.isHeader && a.category === "Beban Pokok (HPP)")
        .reduce((s: number, a: any) => s + (Number(a.endingBalance) || 0), 0);
      const coaOpex = merged.coaBalances
        .filter((a: any) => !a.isHeader && (a.category === "Beban Operasional" || a.category === "Beban Diluar Usaha"))
        .reduce((s: number, a: any) => s + (Number(a.endingBalance) || 0), 0);

      const grossProfit = coaRevenue - coaCogs;
      const netProfit = grossProfit - coaOpex;
      const grossMarginPct = coaRevenue > 0 ? Number(((grossProfit / coaRevenue) * 100).toFixed(1)) : 0;
      const netMarginPct = coaRevenue > 0 ? Number(((netProfit / coaRevenue) * 100).toFixed(1)) : 0;
      const ppnKeluaran = sumAccounts([], ["2100", "2102"]);

      merged.incomeStatement = {
        ...localFin.incomeStatement,
        revenueGross: coaRevenue + ppnKeluaran,
        revenueDpp: coaRevenue,
        ppnKeluaran,
        cogsProject: coaCogs,
        cogsRetail: 0,
        cogsTotal: coaCogs,
        grossProfit,
        grossMarginPct,
        opexByCategory: merged.coaBalances
          .filter((a: any) => !a.isHeader && (a.category === "Beban Operasional" || a.category === "Beban Diluar Usaha") && Number(a.endingBalance || 0) > 0)
          .map((a: any) => ({
            kategori: a.name.replace(/^Biaya\s+/i, "").replace(/^Beban\s+/i, ""),
            nominal: Number(a.endingBalance || 0),
            count: 1,
          })),
        opexTotal: coaOpex,
        netProfit,
        netMarginPct,
      };
    }

    if (serverBalanceSheet) {
      const assetsTotal = Number(serverBalanceSheet.assets?.total || 0);
      const liabTotal = Number(serverBalanceSheet.liabilities?.total || 0);
      const eqTotal = Number(serverBalanceSheet.equity?.total || 0);
      const totalPasiva = Number(serverBalanceSheet.totalLiabilitiesAndEquity || (liabTotal + eqTotal));
      const isBalanced = Boolean(serverBalanceSheet.isBalanced);

      const kasDanBank = sumAccounts(serverBalanceSheet.assets?.items, ["1000", "1101"]);
      const piutangUsaha = sumAccounts(serverBalanceSheet.assets?.items, ["1100", "1102", "110302", "110303"]);
      const persediaanBarang = sumAccounts(serverBalanceSheet.assets?.items, ["1200", "1103"]);
      const ppnMasukan = sumAccounts(serverBalanceSheet.assets?.items, ["1600", "1104"]);
      const uangMukaPph = sumAccounts(serverBalanceSheet.assets?.items, ["1105", "1106"]);

      const hutangSupplier = sumAccounts(serverBalanceSheet.liabilities?.items, ["2101", "210102"]);
      const hutangPpnKeluaran = sumAccounts(serverBalanceSheet.liabilities?.items, ["2100", "2102"]);
      const hutangReimbursement = sumAccounts(serverBalanceSheet.liabilities?.items, ["2103"]);

      const modalKerjaAwal = sumAccounts(serverBalanceSheet.equity?.items, ["3101", "310001", "3000"]);
      const labaBerjalan = sumAccounts(serverBalanceSheet.equity?.items, ["3102-AUTO", "3102"]);

      merged.balanceSheet = {
        ...localFin.balanceSheet,
        isBalanced,
        discrepancy: Math.abs(assetsTotal - totalPasiva),
        totalPasiva,
        assets: {
          ...localFin.balanceSheet.assets,
          items: serverBalanceSheet.assets?.items || [],
          totalAsetLancar: assetsTotal,
          kasDanBank,
          piutangUsaha,
          persediaanBarang,
          ppnMasukan,
          uangMukaPph,
        },
        liabilities: {
          ...localFin.balanceSheet.liabilities,
          items: serverBalanceSheet.liabilities?.items || [],
          totalKewajiban: liabTotal,
          hutangSupplier,
          hutangPpnKeluaran,
          hutangReimbursement,
        },
        equity: {
          ...localFin.balanceSheet.equity,
          items: serverBalanceSheet.equity?.items || [],
          modalKerjaAwal,
          labaBerjalan,
          totalEkuitas: eqTotal,
        },
      };
    } else if (merged.coaBalances && merged.coaBalances.length > 0) {
      const coaAssets = merged.coaBalances
        .filter((a: any) => !a.isHeader && a.category?.startsWith("Aset"))
        .reduce((s: number, a: any) => s + (Number(a.endingBalance) || 0), 0);
      const coaLiabilities = merged.coaBalances
        .filter((a: any) => !a.isHeader && a.category?.startsWith("Kewajiban"))
        .reduce((s: number, a: any) => s + (Number(a.endingBalance) || 0), 0);
      const coaEquity = merged.coaBalances
        .filter((a: any) => !a.isHeader && a.category === "Ekuitas")
        .reduce((s: number, a: any) => s + (Number(a.endingBalance) || 0), 0);

      const kasDanBank = sumAccounts([], ["1000", "1101"]);
      const piutangUsaha = sumAccounts([], ["1100", "1102", "110302", "110303"]);
      const persediaanBarang = sumAccounts([], ["1200", "1103"]);
      const ppnMasukan = sumAccounts([], ["1600", "1104"]);
      const uangMukaPph = sumAccounts([], ["1105", "1106"]);

      const hutangSupplier = sumAccounts([], ["2101", "210102"]);
      const hutangPpnKeluaran = sumAccounts([], ["2100", "2102"]);
      const hutangReimbursement = sumAccounts([], ["2103"]);

      const modalKerjaAwal = sumAccounts([], ["3101", "310001", "3000"]);
      const labaBerjalan = merged.incomeStatement?.netProfit || 0;
      const totalEkuitas = coaEquity + labaBerjalan;
      const totalPasiva = coaLiabilities + totalEkuitas;

      merged.balanceSheet = {
        ...localFin.balanceSheet,
        isBalanced: Math.abs(coaAssets - totalPasiva) < 1,
        discrepancy: Math.abs(coaAssets - totalPasiva),
        totalPasiva,
        assets: {
          ...localFin.balanceSheet.assets,
          items: merged.coaBalances
            .filter((a: any) => !a.isHeader && a.category?.startsWith("Aset") && Number(a.endingBalance || 0) !== 0)
            .map((a: any) => ({ code: a.code, name: a.name, category: a.category, amount: a.endingBalance })),
          totalAsetLancar: coaAssets,
          kasDanBank,
          piutangUsaha,
          persediaanBarang,
          ppnMasukan,
          uangMukaPph,
        },
        liabilities: {
          ...localFin.balanceSheet.liabilities,
          items: merged.coaBalances
            .filter((a: any) => !a.isHeader && a.category?.startsWith("Kewajiban") && Number(a.endingBalance || 0) !== 0)
            .map((a: any) => ({ code: a.code, name: a.name, category: a.category, amount: a.endingBalance })),
          totalKewajiban: coaLiabilities,
          hutangSupplier,
          hutangPpnKeluaran,
          hutangReimbursement,
        },
        equity: {
          ...localFin.balanceSheet.equity,
          items: merged.coaBalances
            .filter((a: any) => !a.isHeader && a.category === "Ekuitas")
            .map((a: any) => ({ code: a.code, name: a.name, category: a.category, amount: a.endingBalance })),
          modalKerjaAwal,
          labaBerjalan,
          totalEkuitas,
        },
      };
    }

    if (serverCashFlow) {
      const rawItems = serverCashFlow.items || [];
      const mappedItems = rawItems.map((item: any) => ({
        id: String(item.id),
        tanggal: item.date ? String(item.date).slice(0, 10) : item.tanggal || "-",
        refNo: item.refNo || "-",
        kategori: item.kategori || (item.source === "EXPENSE_PAYMENT" ? "Operasional" : item.source === "MANUAL" ? "Modal / Kas" : "Kas/Bank"),
        pihak: item.pihak || (item.accountName || "Kas/Bank"),
        keterangan: item.memo || item.keterangan || "-",
        masuk: Number(item.inflow ?? item.masuk ?? 0),
        keluar: Number(item.outflow ?? item.keluar ?? 0),
      }));

      const cashInCustomers = mappedItems.filter((i: any) => i.masuk > 0).reduce((s: number, i: any) => s + i.masuk, 0);
      const cashOutExpenses = mappedItems.filter((i: any) => i.keluar > 0 && (i.kategori.includes("Operasional") || (i.refNo && i.refNo.includes("EXP")))).reduce((s: number, i: any) => s + i.keluar, 0);
      const cashOutSuppliers = mappedItems.filter((i: any) => i.keluar > 0 && !i.kategori.includes("Operasional") && !(i.refNo && i.refNo.includes("EXP"))).reduce((s: number, i: any) => s + i.keluar, 0);

      merged.cashFlow = {
        cashInCustomers,
        cashOutSuppliers,
        cashOutExpenses,
        totalCashIn: Number(serverCashFlow.totalInflow || cashInCustomers),
        totalCashOut: Number(serverCashFlow.totalOutflow || (cashOutSuppliers + cashOutExpenses)),
        netCashFlow: Number(serverCashFlow.netCashFlow || 0),
        cashConversionRatePct: 0,
        items: mappedItems,
      };
    }

    if (serverJournalLines && serverJournalLines.length > 0) {
      merged.journalLines = serverJournalLines;
    }

    if (serverTrialBalance?.rows && Array.isArray(serverTrialBalance.rows)) {
      const coaMap: Record<string, CoaAccount> = { ...CHART_OF_ACCOUNTS };
      customAccounts.forEach((acc) => {
        coaMap[acc.code] = acc;
      });
      merged.coaBalances = buildCoaTree(coaMap, serverTrialBalance.rows, deletedCoaCodes);
      merged.totalDebit = Number(serverTrialBalance.grandTotalDebit || 0);
      merged.totalKredit = Number(serverTrialBalance.grandTotalCredit || 0);
      merged.isJournalBalanced = Boolean(serverTrialBalance.isBalanced);
    }

    return merged;
  }, [
    filteredData,
    manualJournals,
    customAccounts,
    deletedCoaCodes,
    serverIncomeStatement,
    serverBalanceSheet,
    serverCashFlow,
    serverTrialBalance,
    serverJournalLines,
  ]);

  const reportCards = React.useMemo(() => {
    const leadsCount = (data.leads ?? []).length;
    const pipelineVal = (data.leads ?? []).reduce((a, l) => a + Number(l.nilai ?? 0), 0);
    const fuCount = (data.followups ?? []).length;
    const projCount = (data.projects ?? []).length;
    const dnCount = (data["delivery-notes"] ?? []).length;
    const skuCount = (data.products ?? []).length;
    const whCount = (data.warehouses ?? []).length;
    const expCount = (data.expenses ?? []).length;
    const expVal = (data.expenses ?? []).reduce((a, e) => a + Number(e.nominal ?? 0), 0);
    const apprCount = (approvals ?? []).length;
    const invCount = (data.invoices ?? []).length;
    const unpaidVal = fin.balanceSheet.assets.piutangUsaha;

    const cards: ReportCardItem[] = [];

    if (canAccessFinancials) {
      cards.push(
        {
          type: "income-statement",
          title: "Laporan Laba Rugi Standar (Income Statement)",
          desc: "Laporan laba rugi akuntansi SAK: Pendapatan DPP, HPP PO Pemasok, Laba Kotor, Rincian Beban Operasional (OPEX), dan Laba Bersih.",
          stat: `Pendapatan DPP: ${rupiah(fin.incomeStatement.revenueDpp)} · Laba Bersih: ${rupiah(fin.incomeStatement.netProfit)} (${fin.incomeStatement.netMarginPct}%)`,
          badge: "Keuangan & Pajak",
        },
        {
          type: "profit-loss",
          title: "Laporan Untung-Rugi (P&L) per Proyek",
          desc: "Evaluasi profitabilitas per proyek: tagihan faktur, biaya pengadaan PO pemasok, biaya operasional lapangan, dan margin per proyek.",
          stat: `${fin.incomeStatement.projectRows.length} Proyek Dianalisis · Gross Margin: ${fin.incomeStatement.grossMarginPct}%`,
          badge: "Keuangan & Proyek",
        },
        {
          type: "balance-sheet",
          title: "Laporan Neraca (Balance Sheet)",
          desc: "Posisi keuangan perusahaan: Aset Lancar (Kas, Piutang, Persediaan, PPN Masukan) terhadap Kewajiban (Hutang PO, Reimbursement, PPN) dan Ekuitas.",
          stat: `Total Aset: ${rupiah(fin.balanceSheet.assets.totalAsetLancar)} · PPN Masukan: ${rupiah(fin.balanceSheet.assets.ppnMasukan || 0)} · Status: ${fin.balanceSheet.isBalanced ? "SEIMBANG" : "Perlu Rekonsiliasi"}`,
          badge: "Legal & Neraca",
        },
        {
          type: "cash-flow",
          title: "Laporan Arus Kas (Cash Flow Statement)",
          desc: "Rekapitulasi aliran kas masuk dari pembayaran faktur pelanggan dan kas keluar untuk pelunasan PO pemasok serta biaya operasional.",
          stat: `Kas Masuk: ${rupiah(fin.cashFlow.totalCashIn)} · Arus Kas Bersih: ${rupiah(fin.cashFlow.netCashFlow)}`,
          badge: "Likuiditas Kas",
        },
        {
          type: "general-journal",
          title: "Jurnal Umum & Buku Besar (General Journal)",
          desc: "Catatan pembukuan berpasangan (double-entry debit & kredit) otomatis atas seluruh transaksi faktur, PO pemasok, dan pengeluaran.",
          stat: `${fin.journalLines.length} Baris Jurnal · Debit = Kredit: ${rupiah(fin.totalDebit)}`,
          badge: "Audit & Pembukuan",
        },
        {
          type: "efaktur",
          title: "Export CSV E-Faktur DJP (Pajak Keluaran)",
          desc: "Ekspor data faktur pajak keluaran dari faktur pelanggan sesuai format CSV resmi aplikasi e-Faktur Direktorat Jenderal Pajak (DJP).",
          stat: `${invCount} Invoice Siap Ekspor · PPN Keluaran: ${rupiah(fin.incomeStatement.ppnKeluaran)}`,
          badge: "Pajak DJP",
          isEfaktur: true,
          efakturType: "keluaran",
        },
        {
          type: "efaktur-masukan",
          title: "Export CSV E-Faktur DJP (Pajak Masukan)",
          desc: "Ekspor data faktur pajak masukan dari PO pemasok & pengadaan barang untuk kredit pajak SPT Masa aplikasi e-Faktur DJP.",
          stat: `PPN Masukan: ${rupiah(fin.balanceSheet.assets.ppnMasukan || 0)} · Kredit Pajak Pembelian`,
          badge: "Pajak DJP",
          isEfaktur: true,
          efakturType: "masukan",
        },
      );
    }

    cards.push(
      {
        type: "invoices",
        title: "Laporan Piutang & Faktur Keluar",
        desc: "Daftar faktur keluar per pelanggan, analisa umur piutang (aging), dan status termin pembayaran.",
        stat: `${invCount} Invoice · ${rupiah(unpaidVal)} Belum Lunas`,
      },
      {
        type: "expenses",
        title: "Laporan Pengeluaran & Reimbursement",
        desc: "Daftar pengeluaran per status, per kategori, per proyek, dan pelapor (Sales, Procurement, PM, Teknisi).",
        stat: `${expCount} Pengeluaran · ${rupiah(expVal)} Total`,
      },
      {
        type: "projects",
        title: "Laporan Realisasi Proyek",
        desc: "Daftar proyek beserta progres fisik, PIC, tenggat, dan status pembayaran.",
        stat: `${projCount} Project Terdaftar`,
      },
      {
        type: "leads",
        title: "Laporan Prospek & Pipeline Penjualan",
        desc: "Daftar prospek, tahap funnel, tingkat konversi, nilai pipeline, dan alasan Kalah.",
        stat: `${leadsCount} Leads · ${rupiah(pipelineVal)} Pipeline`,
      },
      {
        type: "followups",
        title: "Laporan Follow-up Sales",
        desc: "Daftar follow-up yang terlambat dan jatuh tempo hari ini, per pemilik prospek.",
        stat: `${fuCount} Aktivitas Follow-up Tercatat`,
      },
      {
        type: "delivery-notes",
        title: "Laporan Surat Jalan & Pengiriman",
        desc: "Daftar surat jalan beserta status persetujuan, tujuan, dan bukti serah terima.",
        stat: `${dnCount} Surat Jalan`,
      },
      {
        type: "stock",
        title: "Laporan Saldo & Mutasi Stok Gudang",
        desc: "Saldo stok per produk per gudang dan daftar produk di bawah batas minimum.",
        stat: `${skuCount} SKU · ${whCount} Gudang Aktif`,
      },
      {
        type: "approvals",
        title: "Laporan Dokumen Menunggu Persetujuan",
        desc: "Daftar dokumen yang menunggu keputusan persetujuan Finance atau Bos.",
        stat: `${apprCount} Dokumen Menunggu Keputusan`,
      },
    );

    return cards;
  }, [data, approvals, canAccessFinancials, fin]);

  function handleDownload(type: string, title: string, format: DownloadFormat) {
    void downloadReport({
      type,
      title,
      format,
      fin,
      data,
      approvals,
      canAccessFinancials,
      toast,
    });
  }

  function handleDownloadEfaktur() {
    downloadEfakturCsv({
      data,
      canAccessFinancials,
      toast,
    });
  }

  function handleDownloadEfakturMasukan() {
    downloadEfakturMasukanCsv({
      data,
      canAccessFinancials,
      toast,
    });
  }

  return (
    <View className="gap-5 w-full pb-10">
      <PageHeader
        title="Pusat Akuntansi, Pajak & Laporan Eksekutif"
        subtitle={
          reportDate
            ? `Filter tanggal aktif: ${tanggal(reportDate)} (${reportDate})`
            : "Pembukuan Double-Entry SAK, Laba Rugi (P&L), Neraca, Arus Kas, Jurnal Umum, dan Rekap Operasional"
        }
        action={
          <DatePicker
            value={reportDate}
            onChange={setReportDate}
            placeholder="Filter tanggal laporan..."
            clearable
            className="h-10 min-w-[170px] max-w-[240px] rounded-xl bg-card border-border/80 shadow-sm px-3"
          />
        }
      />

      {canAccessFinancials && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="w-full">
          <View className="flex-row items-center gap-2 pb-1">
            {[
              { id: "pnl" as const, label: "Laba Rugi & P&L", icon: TrendingUp },
              { id: "balance-sheet" as const, label: "Neraca (Balance Sheet)", icon: Scale },
              { id: "cash-flow" as const, label: "Arus Kas (Cash Flow)", icon: Wallet },
              { id: "journal" as const, label: "Jurnal Umum & COA", icon: BookOpen },
              { id: "cards" as const, label: "Semua Unduhan Laporan", icon: FolderKanban },
            ].map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setActiveTab(t.id)}
                  className={
                    active
                      ? "bg-primary border-primary flex-row items-center gap-2 rounded-lg border px-4 py-2.5"
                      : "bg-card border-border flex-row items-center gap-2 rounded-lg border px-4 py-2.5"
                  }
                >
                  <Icon size={15} color={active ? colors.background : colors.textSecondary} />
                  <Text
                    className={
                      active
                        ? "text-background text-xs font-semibold"
                        : "text-text-secondary text-xs font-medium"
                    }
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}

      {canAccessFinancials && activeTab === "pnl" && (
        <PnlTab fin={fin} onDownload={handleDownload} />
      )}

      {canAccessFinancials && activeTab === "balance-sheet" && (
        <BalanceSheetTab fin={fin} onDownload={handleDownload} />
      )}

      {canAccessFinancials && activeTab === "cash-flow" && (
        <CashFlowTab fin={fin} onDownload={handleDownload} />
      )}

      {canAccessFinancials && activeTab === "journal" && (
        <JournalTab fin={fin} onDownload={handleDownload} />
      )}

      {(!canAccessFinancials || activeTab === "cards") && (
        <ReportCardsTab
          cards={reportCards}
          onDownload={handleDownload}
          onDownloadEfaktur={handleDownloadEfaktur}
          onDownloadEfakturMasukan={handleDownloadEfakturMasukan}
        />
      )}
    </View>
  );
}
