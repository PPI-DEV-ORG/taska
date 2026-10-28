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
import { computeFinancialStatements } from "@/lib/accounting";
import { useLocalSearchParams } from "expo-router";

import type { ReportTab, ReportCardItem, DownloadFormat } from "@/modules/reports/types";
import { downloadReport, downloadEfakturCsv } from "@/modules/reports/lib/export-helpers";
import { PnlTab } from "@/modules/reports/components/pnl-tab";
import { BalanceSheetTab } from "@/modules/reports/components/balance-sheet-tab";
import { CashFlowTab } from "@/modules/reports/components/cash-flow-tab";
import { JournalTab } from "@/modules/reports/components/journal-tab";
import { ReportCardsTab } from "@/modules/reports/components/report-cards-tab";

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

  const [reportDate, setReportDate] = React.useState("");

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

  const fin = React.useMemo(() => computeFinancialStatements(filteredData), [filteredData]);

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
          desc: "Laporan laba rugi akuntansi SAK: Pendapatan DPP, HPP PO Supplier, Laba Kotor, Rincian Beban Operasional (OPEX), dan Laba Bersih.",
          stat: `Pendapatan DPP: ${rupiah(fin.incomeStatement.revenueDpp)} · Laba Bersih: ${rupiah(fin.incomeStatement.netProfit)} (${fin.incomeStatement.netMarginPct}%)`,
          badge: "Keuangan & Pajak",
        },
        {
          type: "profit-loss",
          title: "Laporan Untung-Rugi (P&L) per Project",
          desc: "Evaluasi profitabilitas per proyek: tagihan invoice, biaya pengadaan PO supplier, biaya operasional lapangan, dan margin per proyek.",
          stat: `${fin.incomeStatement.projectRows.length} Proyek Dianalisis · Gross Margin: ${fin.incomeStatement.grossMarginPct}%`,
          badge: "Keuangan & Proyek",
        },
        {
          type: "balance-sheet",
          title: "Laporan Neraca (Balance Sheet)",
          desc: "Posisi keuangan perusahaan: Aset Lancar (Kas, Piutang, Persediaan) terhadap Kewajiban (Hutang PO, Reimbursement, PPN) dan Ekuitas.",
          stat: `Total Aset: ${rupiah(fin.balanceSheet.assets.totalAsetLancar)} · Status: ${fin.balanceSheet.isBalanced ? "SEIMBANG" : "Perlu Rekonsiliasi"}`,
          badge: "Legal & Neraca",
        },
        {
          type: "cash-flow",
          title: "Laporan Arus Kas (Cash Flow Statement)",
          desc: "Rekapitulasi aliran kas masuk dari pembayaran invoice pelanggan dan kas keluar untuk pelunasan PO supplier serta biaya operasional.",
          stat: `Kas Masuk: ${rupiah(fin.cashFlow.totalCashIn)} · Arus Kas Bersih: ${rupiah(fin.cashFlow.netCashFlow)}`,
          badge: "Likuiditas Kas",
        },
        {
          type: "general-journal",
          title: "Jurnal Umum & Buku Besar (General Journal)",
          desc: "Catatan pembukuan berpasangan (double-entry debit & kredit) otomatis atas seluruh transaksi invoice, PO supplier, dan pengeluaran.",
          stat: `${fin.journalLines.length} Baris Jurnal · Debit = Kredit: ${rupiah(fin.totalDebit)}`,
          badge: "Audit & Pembukuan",
        },
        {
          type: "efaktur",
          title: "Export CSV E-Faktur DJP (Pajak Keluaran)",
          desc: "Ekspor data faktur pajak keluaran dari invoice klien sesuai format CSV resmi aplikasi e-Faktur Direktorat Jenderal Pajak (DJP).",
          stat: `${invCount} Invoice Siap Ekspor · PPN Keluaran: ${rupiah(fin.incomeStatement.ppnKeluaran)}`,
          badge: "Pajak DJP",
          isEfaktur: true,
        },
      );
    }

    cards.push(
      {
        type: "invoices",
        title: "Laporan Piutang & Invoice Keluar",
        desc: "Daftar invoice keluar per customer, analisa umur piutang (aging), dan status termin pembayaran.",
        stat: `${invCount} Invoice · ${rupiah(unpaidVal)} Belum Lunas`,
      },
      {
        type: "expenses",
        title: "Laporan Pengeluaran & Reimbursement",
        desc: "Daftar pengeluaran per status, per kategori, per project, dan pelapor (Sales, Procurement, PM, Teknisi).",
        stat: `${expCount} Pengeluaran · ${rupiah(expVal)} Total`,
      },
      {
        type: "projects",
        title: "Laporan Realisasi Project",
        desc: "Daftar project beserta progres fisik, PIC, tenggat, dan status pembayaran.",
        stat: `${projCount} Project Terdaftar`,
      },
      {
        type: "leads",
        title: "Laporan Leads & Pipeline Penjualan",
        desc: "Daftar lead, tahap funnel, tingkat konversi, nilai pipeline, dan alasan Lost.",
        stat: `${leadsCount} Leads · ${rupiah(pipelineVal)} Pipeline`,
      },
      {
        type: "followups",
        title: "Laporan Follow-up Sales",
        desc: "Daftar follow-up yang terlambat dan jatuh tempo hari ini, per pemilik lead.",
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
        />
      )}
    </View>
  );
}
