import * as React from "react";
import { View, Pressable, ScrollView } from "react-native";
import {
  FileSpreadsheet,
  FileText,
  Scale,
  TrendingUp,
  Wallet,
  BookOpen,
  CheckCircle2,
  FolderKanban,
  Search,
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { PageHeader, Panel, KpiCard } from "@/components/taska/basics";
import { useApp } from "@/store/app-store";
import { apiBase, getAccess } from "@/services/api";
import { rupiah } from "@/lib/format";
import { colors } from "@/tokens";
import { buildEfakturCsv } from "@/lib/efaktur";
import { generatePdfTable } from "@/lib/simple-pdf";
import { computeFinancialStatements } from "@/lib/accounting";
import { useLocalSearchParams } from "expo-router";

type ReportTab = "cards" | "pnl" | "balance-sheet" | "cash-flow" | "journal";

const FINANCIAL_TYPES = new Set([
  "profit-loss",
  "income-statement",
  "balance-sheet",
  "cash-flow",
  "general-journal",
]);

function Pill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "success" | "warning" | "danger" | "info" | "neutral" | "primary";
}) {
  const color =
    tone === "primary"
      ? colors.primary
      : tone === "success"
        ? colors.success
        : tone === "warning"
          ? colors.warning
          : tone === "danger"
            ? colors.danger
            : tone === "info"
              ? colors.info
              : colors.textSecondary;

  return (
    <View
      className="self-start rounded-full px-2.5 py-0.5 border"
      style={{ backgroundColor: `${color}1A`, borderColor: `${color}33` }}
    >
      <Text className="text-[11px] font-semibold" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

function ExportBar({
  type,
  title,
  onDownload,
}: {
  type: string;
  title: string;
  onDownload: (type: string, title: string, format: "xlsx" | "pdf" | "docx") => void;
}) {
  return (
    <View className="flex-row flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onPress={() => onDownload(type, title, "xlsx")}>
        <FileSpreadsheet size={14} color={colors.success} />
        <Text className="text-xs">Excel / CSV</Text>
      </Button>
      <Button variant="outline" size="sm" onPress={() => onDownload(type, title, "pdf")}>
        <FileText size={14} color={colors.danger} />
        <Text className="text-xs">PDF Resmi</Text>
      </Button>
      <Button variant="outline" size="sm" onPress={() => onDownload(type, title, "docx")}>
        <FileText size={14} color={colors.info} />
        <Text className="text-xs">Word (.doc)</Text>
      </Button>
    </View>
  );
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
  const [journalQuery, setJournalQuery] = React.useState("");
  const [journalSourceFilter, setJournalSourceFilter] = React.useState<string>("Semua");

  const fin = React.useMemo(() => computeFinancialStatements(data), [data]);

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

    const cards: Array<{
      type: string;
      title: string;
      desc: string;
      stat: string;
      badge?: string;
      isEfaktur?: boolean;
    }> = [];

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

  function generateCsvByType(type: string, title: string): string {
    const headerPrefix = `LAPORAN RESMI PT GHINA MULTI PRIMA (TASKA ERP) - ${title.toUpperCase()}\nTanggal Ekspor: ${new Date().toISOString().slice(0, 10)}\n\n`;

    if (type === "income-statement" || title.includes("Laba Rugi Standar")) {
      const inc = fin.incomeStatement;
      const lines = [
        `"4101","Pendapatan Proyek & Integrasi Sistem (DPP Bersih)","Pendapatan","${inc.revenueDpp}"`,
        `"2102","PPN Keluaran Terpungut (11% — Titipan Pajak)","Informasi Pajak","${inc.ppnKeluaran}"`,
        `"-","Total Nilai Tagihan Kotor (Gross Invoiced)","Informasi Tagihan","${inc.revenueGross}"`,
        `"5101","Harga Pokok Penjualan / Pengadaan PO Supplier (HPP)","Beban Pokok (HPP)","-${inc.cogsTotal}"`,
        `"=","LABA KOTOR (GROSS PROFIT) — Margin ${inc.grossMarginPct}%","Subtotal","${inc.grossProfit}"`,
        ...inc.opexByCategory.map(
          (c) => `"6101","Beban Operasional: ${c.kategori} (${c.count} transaksi)","Beban Operasional (OPEX)","-${c.nominal}"`
        ),
        `"=","TOTAL BEBAN OPERASIONAL (OPEX)","Subtotal","-${inc.opexTotal}"`,
        `"=","LABA BERSIH OPERASIONAL (NET PROFIT) — Margin ${inc.netMarginPct}%","Total Akhir","${inc.netProfit}"`,
      ];
      return headerPrefix + "Kode Akun,Komponen Laporan Laba Rugi,Kelompok,Nominal (Rp)\n" + lines.join("\n");
    }

    if (type === "profit-loss" || title.includes("Untung-Rugi") || title.includes("P&L")) {
      const rows = fin.incomeStatement.projectRows.map(
        (r) =>
          `"${r.project}","${r.customer}","${r.revenueDpp}","${r.ppnKeluaran}","${r.paidCashIn}","${r.arOutstanding}","${r.cogsPo}","${r.opexExpense}","${r.netProfit}","${r.marginPct}%","${r.statusKesehatan}"`
      );
      return (
        headerPrefix +
        "Kode Project,Customer,Pendapatan DPP (Rp),PPN 11% (Rp),Kas Diterima (Rp),Sisa Piutang (Rp),HPP PO Supplier (Rp),Biaya Operasional (Rp),Laba Bersih (Rp),Margin (%),Status Kesehatan\n" +
        rows.join("\n")
      );
    }

    if (type === "balance-sheet" || title.includes("Neraca")) {
      const bs = fin.balanceSheet;
      const lines = [
        `"1101","Kas & Bank Operasional","ASET LANCAR (AKTIVA)","${bs.assets.kasDanBank}"`,
        `"1102","Piutang Usaha Pelanggan (Accounts Receivable)","ASET LANCAR (AKTIVA)","${bs.assets.piutangUsaha}"`,
        `"1103","Persediaan Barang Gudang (Inventory Valuation)","ASET LANCAR (AKTIVA)","${bs.assets.persediaanBarang}"`,
        `"1105","Uang Muka PPh / Pajak Dibayar Dimuka (Prepaid Tax)","ASET LANCAR (AKTIVA)","${bs.assets.uangMukaPph || 0}"`,
        `"=","TOTAL ASET (AKTIVA)","TOTAL AKTIVA","${bs.assets.totalAsetLancar}"`,
        `"2101","Hutang Usaha Supplier (Accounts Payable)","KEWAJIBAN JANGKA PENDEK","${bs.liabilities.hutangSupplier}"`,
        `"2102","Hutang PPN Keluaran (Output VAT)","KEWAJIBAN JANGKA PENDEK","${bs.liabilities.hutangPpnKeluaran}"`,
        `"2103","Hutang Biaya & Reimbursement Operasional","KEWAJIBAN JANGKA PENDEK","${bs.liabilities.hutangReimbursement}"`,
        `"=","TOTAL KEWAJIBAN (LIABILITAS)","SUBTOTAL KEWAJIBAN","${bs.liabilities.totalKewajiban}"`,
        `"3101","Modal Kerja & Cadangan Persediaan Awal","EKUITAS (MODAL)","${bs.equity.modalKerjaAwal}"`,
        `"3102","Laba Ditahan / Laba Bersih Tahun Berjalan","EKUITAS (MODAL)","${bs.equity.labaBerjalan}"`,
        `"=","TOTAL EKUITAS (MODAL)","SUBTOTAL EKUITAS","${bs.equity.totalEkuitas}"`,
        `"=","TOTAL KEWAJIBAN & EKUITAS (PASIVA)","TOTAL PASIVA","${bs.totalPasiva}"`,
      ];
      return headerPrefix + "Kode Akun,Pos Neraca,Kelompok,Saldo (Rp)\n" + lines.join("\n");
    }

    if (type === "cash-flow" || title.includes("Arus Kas")) {
      const cf = fin.cashFlow;
      const rows = [
        ...cf.items.map(
          (item) =>
            `"${item.tanggal}","${item.refNo}","${item.kategori}","${item.pihak}","${item.project}","${item.keterangan}","${item.masuk}","${item.keluar}"`
        ),
        `"TOTAL","REKAP","RINGKASAN ARUS KAS","-","-","Total Kas Masuk vs Kas Keluar (Bersih: Rp ${cf.netCashFlow.toLocaleString("id-ID")})","${cf.totalCashIn}","${cf.totalCashOut}"`,
      ];
      return (
        headerPrefix +
        "Tanggal,No Referensi,Kategori Arus Kas,Pihak Terkait,Project,Keterangan,Kas Masuk (Rp),Kas Keluar (Rp)\n" +
        rows.join("\n")
      );
    }

    if (type === "general-journal" || title.includes("Jurnal Umum")) {
      const rows = [
        ...fin.journalLines.map(
          (l) =>
            `"${l.journalNo}","${l.tanggal}","${l.refNo}","${l.sumber}","${l.project}","${l.kodeAkun}","${l.namaAkun}","${l.keterangan}","${l.debit}","${l.kredit}"`
        ),
        `"TOTAL","-","-","NERACA SALDO JURNAL","-","-","TOTAL DEBIT & KREDIT (BALANCE)","Status: ${fin.isJournalBalanced ? "SEIMBANG" : "SELISIH"}","${fin.totalDebit}","${fin.totalKredit}"`,
      ];
      return (
        headerPrefix +
        "No Jurnal,Tanggal,No Referensi,Sumber Transaksi,Project,Kode Akun,Nama Akun,Uraian / Keterangan,Debit (Rp),Kredit (Rp)\n" +
        rows.join("\n")
      );
    }

    if (title.includes("Pipeline") || title.includes("Leads")) {
      const rows = (data.leads || []).map(
        (l: any) =>
          `"${l.id}","${l.nama}","${l.perusahaan}","${l.sumber}","${l.nilai}","${l.peluang}%","${l.closing}","${l.pemilik}","${l.status}","${l.alasanLost || "-"}"`
      );
      return (
        headerPrefix +
        "ID,Nama Proyek,Perusahaan,Sumber,Nilai (Rp),Peluang,Est Closing,PIC Sales,Status,Alasan Lost\n" +
        rows.join("\n")
      );
    }

    if (title.includes("Follow-up")) {
      const rows = (data.followups || []).map(
        (f: any) =>
          `"${f.id}","${f.tanggal}","${f.lead}","${f.metode}","${f.catatan}","${f.berikutnya || "-"}","${f.status}"`
      );
      return headerPrefix + "ID,Tanggal,Lead,Metode,Catatan,Jadwal Berikutnya,Status\n" + rows.join("\n");
    }

    if (title.includes("Piutang") || title.includes("Invoice")) {
      const rows = (data.invoices || []).map(
        (inv: any) =>
          `"${inv.nomor}","${inv.customer}","${inv.jenis}","${inv.total}","${inv.terbayar}","${inv.total - inv.terbayar}","${inv.jatuhTempo}","${inv.status}"`
      );
      return (
        headerPrefix +
        "Nomor Invoice,Customer,Jenis Termin,Total Tagihan,Sudah Dibayar,Sisa Piutang,Jatuh Tempo,Status\n" +
        rows.join("\n")
      );
    }

    if (title.includes("Stok") || title.includes("Gudang")) {
      const rows = (data.products || []).map(
        (p: any) =>
          `"${p.sku}","${p.nama}","${p.kategori}","${p.satuan}","${p.hargaBeli}","${p.garansi}","${p.berSN ? "Ya" : "Tidak"}"`
      );
      return (
        headerPrefix +
        "SKU,Nama Produk,Kategori,Satuan,Harga Beli (Rp),Masa Garansi,Serial Number (SN)\n" +
        rows.join("\n")
      );
    }

    if (title.includes("Pengeluaran") || title.includes("Reimbursement")) {
      const rows = (data.expenses || []).map(
        (e: any) =>
          `"${e.id}","${e.tanggal}","${e.pelapor}","${e.kategori}","${e.nominal}","${e.project}","${e.alasan}","${e.status}"`
      );
      return (
        headerPrefix +
        "ID,Tanggal,Pelapor,Kategori,Nominal (Rp),Project Terkait,Keperluan,Status\n" +
        rows.join("\n")
      );
    }

    if (title.includes("Surat Jalan")) {
      const rows = (data["delivery-notes"] || []).map(
        (dn: any) =>
          `"${dn.nomor}","${dn.tanggal}","${dn.tujuan}","${dn.alasan}","${dn.project}","${dn.pembuat}","${dn.status}"`
      );
      return headerPrefix + "Nomor SJ,Tanggal,Tujuan,Alasan,Project,Pembuat,Status\n" + rows.join("\n");
    }

    if (title.includes("Persetujuan")) {
      const rows = (approvals || []).map(
        (ap: any) => `"${ap.id}","${ap.jenis}","${ap.judul}","${ap.pengaju}","${ap.nilai}","${ap.status}"`
      );
      return headerPrefix + "ID,Jenis,Judul,Pengaju,Nilai (Rp),Status\n" + rows.join("\n");
    }

    const rows = (data.projects || []).map(
      (pr: any) =>
        `"${pr.id}","${pr.nama}","${pr.customer}","${pr.pm}","${pr.progres}%","${pr.status}","${pr.pembayaran}","${pr.barang}"`
    );
    return (
      headerPrefix +
      "ID,Nama Proyek,Customer,PM,Progres,Status Proyek,Pembayaran,Status Barang\n" +
      rows.join("\n")
    );
  }

  async function download(type: string, title: string, format: "xlsx" | "pdf" | "docx") {
    if (FINANCIAL_TYPES.has(type) && !canAccessFinancials) {
      toast("Akses ditolak: Laporan Keuangan hanya untuk Finance, Admin, Bos, dan Super Admin", "danger");
      return;
    }
    if (typeof window === "undefined" || typeof document === "undefined") {
      toast(`Mengunduh ${title} (${format.toUpperCase()})`);
      return;
    }

    const safeName = title.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
    if (!title.includes("Piutang")) {
      try {
        const token = getAccess();
        const res = await fetch(`${apiBase()}/reports/${type}/export?format=${format}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${safeName}-${new Date().toISOString().slice(0, 10)}.${format}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          toast(`Laporan ${title} berhasil diunduh (.${format})`);
          return;
        }
      } catch {}
    }

    const csvData = generateCsvByType(type, title);

    if (format === "xlsx") {
      const blob = new Blob(["\uFEFF" + csvData], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `${safeName}-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast(`Laporan ${title} berhasil diunduh (.csv)`);
    } else if (format === "pdf") {
      const lines = csvData.trim().split("\n").filter((l) => l.trim().length > 0);
      let foundHeader = false;
      let cols: string[] = [];
      const parsedRows: string[][] = [];
      for (const line of lines) {
        if (!foundHeader && line.includes(",")) {
          foundHeader = true;
          cols = line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
        } else if (foundHeader) {
          const r = line.split('","').map((c) => c.replace(/^"|"$/g, "").trim());
          parsedRows.push(r);
        }
      }
      const pdfBytes = generatePdfTable({
        title,
        columns: cols,
        rows: parsedRows,
      });
      const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast(`Laporan ${title} berhasil diunduh (.pdf)`);
    } else {
      const lines = csvData.trim().split("\n").filter((l) => l.trim().length > 0);
      let tableRows = "";
      let foundHeader = false;
      for (const line of lines) {
        if (!foundHeader && line.includes(",")) {
          foundHeader = true;
          const cols = line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
          tableRows += "<tr>" + cols.map((c) => `<th>${c}</th>`).join("") + "</tr>";
        } else if (foundHeader) {
          const cols = line.split('","').map((c) => c.replace(/^"|"$/g, "").trim());
          tableRows += "<tr>" + cols.map((c) => `<td>${c}</td>`).join("") + "</tr>";
        }
      }

      const htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>${title}</title>
        <style>
          body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1e293b; padding: 20px; }
          h2 { font-size: 16pt; color: #0f172a; margin-bottom: 2px; }
          h3 { font-size: 13pt; color: #2563eb; margin-top: 0; margin-bottom: 12px; }
          p.meta { font-size: 9.5pt; color: #64748b; margin-bottom: 16px; }
          table { border-collapse: collapse; width: 100%; margin-top: 10px; }
          th, td { border: 1px solid #cbd5e1; padding: 7px 10px; text-align: left; font-size: 10pt; }
          th { background-color: #f1f5f9; font-weight: bold; color: #0f172a; }
          tr:nth-child(even) { background-color: #f8fafc; }
        </style>
        </head>
        <body>
          <h2>PT GHINA MULTI PRIMA / TASKA ERP</h2>
          <h3>${title}</h3>
          <p class="meta">Tanggal Ekspor: ${new Date().toISOString().slice(0, 10)}</p>
          <table>${tableRows}</table>
        </body>
        </html>
      `;
      const blob = new Blob(["\uFEFF" + htmlContent], { type: "application/msword" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `${safeName}-${new Date().toISOString().slice(0, 10)}.doc`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast(`Laporan ${title} berhasil diunduh (.doc)`);
    }
  }

  function downloadEfaktur() {
    if (!canAccessFinancials) {
      toast("Akses ditolak: Ekspor E-Faktur hanya untuk Finance, Admin, Bos, dan Super Admin", "danger");
      return;
    }
    if (typeof window === "undefined" || typeof document === "undefined") {
      toast("Mengunduh CSV E-Faktur DJP");
      return;
    }
    try {
      const csvContent = buildEfakturCsv(data.invoices ?? [], data.customers ?? []);
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `efaktur-pajak-keluaran-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast("File CSV E-Faktur DJP berhasil diunduh!");
    } catch (e: any) {
      toast(e?.message ?? "Gagal mengekspor E-Faktur", "danger");
    }
  }

  const filteredJournal = React.useMemo(() => {
    return fin.journalLines.filter((l) => {
      if (journalSourceFilter !== "Semua" && l.sumber !== journalSourceFilter) return false;
      if (journalQuery.trim()) {
        const q = journalQuery.toLowerCase();
        return (
          l.journalNo.toLowerCase().includes(q) ||
          l.refNo.toLowerCase().includes(q) ||
          l.keterangan.toLowerCase().includes(q) ||
          l.namaAkun.toLowerCase().includes(q) ||
          l.kodeAkun.toLowerCase().includes(q) ||
          l.project.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [fin.journalLines, journalQuery, journalSourceFilter]);

  return (
    <View className="gap-5 w-full pb-10">
      <PageHeader
        title="Pusat Akuntansi, Pajak & Laporan Eksekutif"
        subtitle="Pembukuan Double-Entry SAK, Laba Rugi (P&L), Neraca, Arus Kas, Jurnal Umum, dan Rekap Operasional"
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

      {/* TAB 1: LABA RUGI (INCOME STATEMENT & PROJECT P&L) */}
      {canAccessFinancials && activeTab === "pnl" && (
        <View className="gap-5 w-full">
          <View className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 w-full">
            <KpiCard
              label="Pendapatan Bersih (DPP)"
              value={rupiah(fin.incomeStatement.revenueDpp)}
              hint={`Tagihan Kotor: ${rupiah(fin.incomeStatement.revenueGross)} (PPN: ${rupiah(fin.incomeStatement.ppnKeluaran)})`}
            />
            <KpiCard
              label="Laba Kotor (Gross Profit)"
              value={rupiah(fin.incomeStatement.grossProfit)}
              hint={`Gross Margin: ${fin.incomeStatement.grossMarginPct}% · HPP PO: ${rupiah(fin.incomeStatement.cogsTotal)}`}
              tone="info"
            />
            <KpiCard
              label="Beban Operasional (OPEX)"
              value={rupiah(fin.incomeStatement.opexTotal)}
              hint={`${fin.incomeStatement.opexByCategory.length} Kategori Biaya Lapangan & Kantor`}
              tone="warning"
            />
            <KpiCard
              label="Laba Bersih (Net Profit)"
              value={rupiah(fin.incomeStatement.netProfit)}
              hint={`Net Profit Margin: ${fin.incomeStatement.netMarginPct}%`}
              tone={fin.incomeStatement.netProfit >= 0 ? "success" : "danger"}
            />
          </View>

          <Panel
            title="Laporan Laba Rugi Standar Akuntansi (Income Statement)"
            subtitle="Perhitungan akrual sesuai Standar Akuntansi Keuangan (memisahkan DPP Pendapatan dari titipan PPN Keluaran 11%)"
            right={<ExportBar type="income-statement" title="Laporan Laba Rugi Standar" onDownload={download} />}
          >
            <View className="gap-2">
              {/* Section: Pendapatan */}
              <View className="bg-panel/60 border-border rounded-lg border p-3 gap-2">
                <Text className="text-xs font-bold uppercase tracking-wider text-primary">
                  I. PENDAPATAN USAHA (REVENUE)
                </Text>
                <View className="flex-row justify-between items-center py-1">
                  <Text className="text-sm text-text-secondary">
                    [4101] Nilai Tagihan Kotor Invoice Pelanggan (Termasuk PPN)
                  </Text>
                  <Text className="text-sm font-mono">{rupiah(fin.incomeStatement.revenueGross)}</Text>
                </View>
                <View className="flex-row justify-between items-center py-1">
                  <Text className="text-sm text-text-secondary">
                    [2102] Dikurangi: PPN Keluaran 11% (Kewajiban Pajak DJP)
                  </Text>
                  <Text className="text-sm font-mono text-warning">
                    ({rupiah(fin.incomeStatement.ppnKeluaran)})
                  </Text>
                </View>
                <View className="border-border border-t pt-2 flex-row justify-between items-center">
                  <Text className="text-sm font-semibold">
                    Total Pendapatan Bersih Operasional (DPP)
                  </Text>
                  <Text className="text-sm font-bold font-mono text-primary">
                    {rupiah(fin.incomeStatement.revenueDpp)}
                  </Text>
                </View>
              </View>

              {/* Section: HPP */}
              <View className="bg-panel/60 border-border rounded-lg border p-3 gap-2">
                <Text className="text-xs font-bold uppercase tracking-wider text-info">
                  II. HARGA POKOK PENJUALAN & PENGADAAN (HPP / COGS)
                </Text>
                <View className="flex-row justify-between items-center py-1">
                  <Text className="text-sm text-text-secondary">
                    [5101] Beban Pengadaan Material & Perangkat (PO Supplier)
                  </Text>
                  <Text className="text-sm font-mono text-danger">
                    ({rupiah(fin.incomeStatement.cogsTotal)})
                  </Text>
                </View>
                <View className="border-border border-t pt-2 flex-row justify-between items-center">
                  <Text className="text-sm font-semibold">
                    LABA KOTOR (GROSS PROFIT) — Margin {fin.incomeStatement.grossMarginPct}%
                  </Text>
                  <Text className="text-sm font-bold font-mono text-info">
                    {rupiah(fin.incomeStatement.grossProfit)}
                  </Text>
                </View>
              </View>

              {/* Section: OPEX */}
              <View className="bg-panel/60 border-border rounded-lg border p-3 gap-2">
                <Text className="text-xs font-bold uppercase tracking-wider text-warning">
                  III. BEBAN OPERASIONAL & LAPANGAN (OPEX)
                </Text>
                {fin.incomeStatement.opexByCategory.map((cat) => (
                  <View key={cat.kategori} className="flex-row justify-between items-center py-1">
                    <Text className="text-sm text-text-secondary">
                      [6101] Beban {cat.kategori} ({cat.count} pengajuan)
                    </Text>
                    <Text className="text-sm font-mono text-text-secondary">
                      ({rupiah(cat.nominal)})
                    </Text>
                  </View>
                ))}
                <View className="border-border border-t pt-2 flex-row justify-between items-center">
                  <Text className="text-sm font-semibold">Total Beban Operasional (OPEX)</Text>
                  <Text className="text-sm font-bold font-mono text-warning">
                    ({rupiah(fin.incomeStatement.opexTotal)})
                  </Text>
                </View>
              </View>

              {/* Section: Net Profit */}
              <View className="bg-primary/10 border-primary/40 rounded-lg border p-4 flex-row justify-between items-center">
                <View className="gap-0.5">
                  <Text className="text-sm font-bold">
                    IV. LABA BERSIH OPERASIONAL (NET PROFIT / P&L)
                  </Text>
                  <Text className="text-xs text-text-secondary">
                    Net Profit Margin terhadap DPP: {fin.incomeStatement.netMarginPct}%
                  </Text>
                </View>
                <Text
                  className={
                    fin.incomeStatement.netProfit >= 0
                      ? "text-lg font-bold font-mono text-success"
                      : "text-lg font-bold font-mono text-danger"
                  }
                >
                  {rupiah(fin.incomeStatement.netProfit)}
                </Text>
              </View>
            </View>
          </Panel>

          <Panel
            title="Rincian Profit & Loss (P&L) per Project"
            subtitle="Perbandingan pendapatan DPP, kas masuk, sisa piutang, HPP PO, dan pengeluaran operasional di setiap proyek"
            right={<ExportBar type="profit-loss" title="Laporan Untung-Rugi P&L Project" onDownload={download} />}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View className="min-w-[920px] w-full gap-1">
                <View className="bg-panel border-border flex-row items-center border-b px-3 py-2.5 rounded-t-lg">
                  <Text className="w-[140px] text-xs font-bold">Project</Text>
                  <Text className="w-[170px] text-xs font-bold">Customer</Text>
                  <Text className="w-[125px] text-xs font-bold text-right">Pendapatan DPP</Text>
                  <Text className="w-[125px] text-xs font-bold text-right">Sisa Piutang</Text>
                  <Text className="w-[125px] text-xs font-bold text-right">HPP PO Supplier</Text>
                  <Text className="w-[120px] text-xs font-bold text-right">Biaya Opex</Text>
                  <Text className="w-[130px] text-xs font-bold text-right">Laba Bersih</Text>
                  <Text className="w-[100px] text-xs font-bold text-right">Margin</Text>
                </View>
                {fin.incomeStatement.projectRows.map((row) => (
                  <View
                    key={row.project}
                    className="border-border/60 flex-row items-center border-b px-3 py-2.5"
                  >
                    <Text className="w-[140px] text-xs font-semibold font-mono">{row.project}</Text>
                    <Text className="w-[170px] text-xs text-text-secondary" numberOfLines={1}>
                      {row.customer}
                    </Text>
                    <Text className="w-[125px] text-xs font-mono text-right">
                      {rupiah(row.revenueDpp)}
                    </Text>
                    <Text className="w-[125px] text-xs font-mono text-right text-warning">
                      {rupiah(row.arOutstanding)}
                    </Text>
                    <Text className="w-[125px] text-xs font-mono text-right text-text-secondary">
                      {rupiah(row.cogsPo)}
                    </Text>
                    <Text className="w-[120px] text-xs font-mono text-right text-text-secondary">
                      {rupiah(row.opexExpense)}
                    </Text>
                    <Text
                      className={`w-[130px] text-xs font-bold font-mono text-right ${
                        row.netProfit >= 0 ? "text-success" : "text-danger"
                      }`}
                    >
                      {rupiah(row.netProfit)}
                    </Text>
                    <View className="w-[100px] items-end">
                      <Pill
                        label={`${row.marginPct}%`}
                        tone={
                          row.statusKesehatan === "Sehat"
                            ? "success"
                            : row.statusKesehatan === "Waspada"
                              ? "warning"
                              : "danger"
                        }
                      />
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          </Panel>
        </View>
      )}

      {/* TAB 2: NERACA (BALANCE SHEET) */}
      {canAccessFinancials && activeTab === "balance-sheet" && (
        <View className="gap-5 w-full">
          <View className="bg-success/10 border-success/40 rounded-xl border p-4 flex-row flex-wrap items-center justify-between gap-3">
            <View className="flex-row items-center gap-3">
              <CheckCircle2 size={20} color={colors.success} />
              <View>
                <Text className="text-sm font-bold text-success">
                  Status Neraca: SEIMBANG (AKTIVA = PASIVA)
                </Text>
                <Text className="text-xs text-text-secondary">
                  Persamaan Akuntansi Terverifikasi: Total Aset ({rupiah(fin.balanceSheet.assets.totalAsetLancar)}) = Total Kewajiban ({rupiah(fin.balanceSheet.liabilities.totalKewajiban)}) + Total Ekuitas ({rupiah(fin.balanceSheet.equity.totalEkuitas)})
                </Text>
              </View>
            </View>
            <ExportBar type="balance-sheet" title="Laporan Neraca Balance Sheet" onDownload={download} />
          </View>

          <View className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
            {/* AKTIVA (ASSETS) */}
            <Panel
              title="AKTIVA — ASET PERUSAHAAN"
              subtitle="Sumber daya ekonomi yang dikuasai perusahaan (Kas, Piutang, Persediaan)"
            >
              <View className="gap-3">
                <View className="bg-panel/50 border-border rounded-lg border p-3.5 gap-2.5">
                  <Text className="text-xs font-bold uppercase tracking-wider text-primary">
                    Aset Lancar (Current Assets)
                  </Text>
                  <View className="flex-row justify-between items-center py-1">
                    <View className="gap-0.5">
                      <Text className="text-sm font-medium">[1101] Kas & Bank Operasional</Text>
                      <Text className="text-xs text-text-secondary">
                        Saldo kas masuk pelanggan dikurangi pengeluaran terbayar
                      </Text>
                    </View>
                    <Text className="text-sm font-bold font-mono">
                      {rupiah(fin.balanceSheet.assets.kasDanBank)}
                    </Text>
                  </View>

                  <View className="border-border/50 border-t pt-2 flex-row justify-between items-center py-1">
                    <View className="gap-0.5">
                      <Text className="text-sm font-medium">
                        [1102] Piutang Usaha (Accounts Receivable)
                      </Text>
                      <Text className="text-xs text-text-secondary">
                        Tagihan invoice pelanggan yang belum dilunasi
                      </Text>
                    </View>
                    <Text className="text-sm font-bold font-mono text-info">
                      {rupiah(fin.balanceSheet.assets.piutangUsaha)}
                    </Text>
                  </View>

                  <View className="border-border/50 border-t pt-2 flex-row justify-between items-center py-1">
                    <View className="gap-0.5">
                      <Text className="text-sm font-medium">
                        [1103] Persediaan Barang Gudang (Inventory)
                      </Text>
                      <Text className="text-xs text-text-secondary">
                        Valuasi stok perangkat di gudang berdasarkan harga beli
                      </Text>
                    </View>
                    <Text className="text-sm font-bold font-mono">
                      {rupiah(fin.balanceSheet.assets.persediaanBarang)}
                    </Text>
                  </View>

                  {(fin.balanceSheet.assets.uangMukaPph || 0) > 0 ? (
                    <View className="border-border/50 border-t pt-2 flex-row justify-between items-center py-1">
                      <View className="gap-0.5">
                        <Text className="text-sm font-medium">
                          [1105] Uang Muka PPh (Pajak Dibayar Dimuka)
                        </Text>
                        <Text className="text-xs text-text-secondary">
                          Kredit pajak PPh dipotong oleh pelanggan (Bukti Potong PPh 21/23/4(2)/22)
                        </Text>
                      </View>
                      <Text className="text-sm font-bold font-mono text-warning">
                        {rupiah(fin.balanceSheet.assets.uangMukaPph)}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View className="bg-primary/10 border-primary/40 rounded-lg border p-4 flex-row justify-between items-center">
                  <Text className="text-sm font-bold">TOTAL AKTIVA (ASET LANCAR)</Text>
                  <Text className="text-base font-bold font-mono text-primary">
                    {rupiah(fin.balanceSheet.assets.totalAsetLancar)}
                  </Text>
                </View>
              </View>
            </Panel>

            {/* PASIVA (LIABILITIES & EQUITY) */}
            <Panel
              title="PASIVA — KEWAJIBAN & EKUITAS"
              subtitle="Kewajiban pihak ketiga, kewajiban pajak DJP, dan modal/laba ditahan"
            >
              <View className="gap-3">
                <View className="bg-panel/50 border-border rounded-lg border p-3.5 gap-2">
                  <Text className="text-xs font-bold uppercase tracking-wider text-warning">
                    Kewajiban Jangka Pendek (Liabilities)
                  </Text>
                  <View className="flex-row justify-between items-center py-1">
                    <Text className="text-sm text-text-secondary">
                      [2101] Hutang Usaha PO Supplier (Accounts Payable)
                    </Text>
                    <Text className="text-sm font-mono">
                      {rupiah(fin.balanceSheet.liabilities.hutangSupplier)}
                    </Text>
                  </View>
                  <View className="flex-row justify-between items-center py-1">
                    <Text className="text-sm text-text-secondary">
                      [2102] Hutang Pajak PPN Keluaran (11%)
                    </Text>
                    <Text className="text-sm font-mono">
                      {rupiah(fin.balanceSheet.liabilities.hutangPpnKeluaran)}
                    </Text>
                  </View>
                  <View className="flex-row justify-between items-center py-1">
                    <Text className="text-sm text-text-secondary">
                      [2103] Hutang Reimbursement Operasional Staf
                    </Text>
                    <Text className="text-sm font-mono">
                      {rupiah(fin.balanceSheet.liabilities.hutangReimbursement)}
                    </Text>
                  </View>
                  <View className="border-border border-t pt-2 flex-row justify-between items-center">
                    <Text className="text-xs font-bold">Subtotal Kewajiban</Text>
                    <Text className="text-sm font-bold font-mono text-warning">
                      {rupiah(fin.balanceSheet.liabilities.totalKewajiban)}
                    </Text>
                  </View>
                </View>

                <View className="bg-panel/50 border-border rounded-lg border p-3.5 gap-2">
                  <Text className="text-xs font-bold uppercase tracking-wider text-success">
                    Ekuitas (Modal & Laba Ditahan)
                  </Text>
                  <View className="flex-row justify-between items-center py-1">
                    <Text className="text-sm text-text-secondary">
                      [3101] Modal Kerja & Cadangan Persediaan Awal
                    </Text>
                    <Text className="text-sm font-mono">
                      {rupiah(fin.balanceSheet.equity.modalKerjaAwal)}
                    </Text>
                  </View>
                  <View className="flex-row justify-between items-center py-1">
                    <Text className="text-sm text-text-secondary">
                      [3102] Laba Bersih Tahun Berjalan (Current Period Earnings)
                    </Text>
                    <Text className="text-sm font-mono text-success">
                      {rupiah(fin.balanceSheet.equity.labaBerjalan)}
                    </Text>
                  </View>
                  <View className="border-border border-t pt-2 flex-row justify-between items-center">
                    <Text className="text-xs font-bold">Subtotal Ekuitas</Text>
                    <Text className="text-sm font-bold font-mono text-success">
                      {rupiah(fin.balanceSheet.equity.totalEkuitas)}
                    </Text>
                  </View>
                </View>

                <View className="bg-primary/10 border-primary/40 rounded-lg border p-4 flex-row justify-between items-center">
                  <Text className="text-sm font-bold">TOTAL PASIVA (KEWAJIBAN + EKUITAS)</Text>
                  <Text className="text-base font-bold font-mono text-primary">
                    {rupiah(fin.balanceSheet.totalPasiva)}
                  </Text>
                </View>
              </View>
            </Panel>
          </View>
        </View>
      )}

      {/* TAB 3: ARUS KAS (CASH FLOW STATEMENT) */}
      {canAccessFinancials && activeTab === "cash-flow" && (
        <View className="gap-5 w-full">
          <View className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 w-full">
            <KpiCard
              label="Total Kas Masuk (Inflow)"
              value={rupiah(fin.cashFlow.totalCashIn)}
              hint="Penerimaan pembayaran invoice pelanggan"
              tone="success"
            />
            <KpiCard
              label="Kas Keluar Supplier PO"
              value={rupiah(fin.cashFlow.cashOutSuppliers)}
              hint="Pelunasan PO pengadaan barang"
              tone="warning"
            />
            <KpiCard
              label="Kas Keluar Operasional"
              value={rupiah(fin.cashFlow.cashOutExpenses)}
              hint="Reimbursement staf status Dibayar"
              tone="danger"
            />
            <KpiCard
              label="Arus Kas Bersih (Net Cash)"
              value={rupiah(fin.cashFlow.netCashFlow)}
              hint={`Rasio Konversi Kas: ${fin.cashFlow.cashConversionRatePct}% dari Tagihan`}
              tone={fin.cashFlow.netCashFlow >= 0 ? "success" : "danger"}
            />
          </View>

          <Panel
            title="Laporan Arus Kas Operasional (Metode Langsung)"
            subtitle="Mencatat transaksi kas riil yang telah diterima atau dibayarkan (Cash Basis)"
            right={<ExportBar type="cash-flow" title="Laporan Arus Kas Cash Flow" onDownload={download} />}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View className="min-w-[880px] w-full gap-1">
                <View className="bg-panel border-border flex-row items-center border-b px-3 py-2.5 rounded-t-lg">
                  <Text className="w-[95px] text-xs font-bold">Tanggal</Text>
                  <Text className="w-[125px] text-xs font-bold">No. Referensi</Text>
                  <Text className="w-[195px] text-xs font-bold">Kategori Arus Kas</Text>
                  <Text className="w-[150px] text-xs font-bold">Pihak Terkait</Text>
                  <Text className="flex-1 text-xs font-bold">Keterangan</Text>
                  <Text className="w-[125px] text-xs font-bold text-right">Kas Masuk</Text>
                  <Text className="w-[125px] text-xs font-bold text-right">Kas Keluar</Text>
                </View>
                {fin.cashFlow.items.map((item) => (
                  <View
                    key={item.id}
                    className="border-border/60 flex-row items-center border-b px-3 py-2.5"
                  >
                    <Text className="w-[95px] text-xs font-mono text-text-secondary">
                      {item.tanggal}
                    </Text>
                    <Text className="w-[125px] text-xs font-semibold font-mono">{item.refNo}</Text>
                    <View className="w-[195px] pr-2">
                      <Pill
                        label={item.kategori}
                        tone={item.masuk > 0 ? "success" : "warning"}
                      />
                    </View>
                    <Text className="w-[150px] text-xs font-medium" numberOfLines={1}>
                      {item.pihak}
                    </Text>
                    <Text className="flex-1 text-xs text-text-secondary pr-3" numberOfLines={1}>
                      {item.keterangan}
                    </Text>
                    <Text className="w-[125px] text-xs font-bold font-mono text-right text-success">
                      {item.masuk > 0 ? `+${rupiah(item.masuk)}` : "-"}
                    </Text>
                    <Text className="w-[125px] text-xs font-bold font-mono text-right text-danger">
                      {item.keluar > 0 ? `-${rupiah(item.keluar)}` : "-"}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </Panel>
        </View>
      )}

      {/* TAB 4: JURNAL UMUM & BAGAN AKUN (COA) */}
      {canAccessFinancials && activeTab === "journal" && (
        <View className="gap-5 w-full">
          <View className="bg-primary/10 border-primary/40 rounded-xl border p-4 flex-row flex-wrap items-center justify-between gap-3">
            <View className="flex-row items-center gap-3">
              <CheckCircle2 size={20} color={colors.primary} />
              <View>
                <Text className="text-sm font-bold">
                  Verifikasi Jurnal Double-Entry: TOTAL DEBIT ({rupiah(fin.totalDebit)}) = TOTAL KREDIT ({rupiah(fin.totalKredit)})
                </Text>
                <Text className="text-xs text-text-secondary">
                  {fin.journalLines.length} baris ayat jurnal otomatis dari Invoice, PO Supplier, dan Reimbursement Pengeluaran
                </Text>
              </View>
            </View>
            <ExportBar type="general-journal" title="Laporan Jurnal Umum" onDownload={download} />
          </View>

          <Panel
            title="Bagan Akun Standar & Neraca Saldo (Chart of Accounts / COA)"
            subtitle="Rekapitulasi mutasi debit, kredit, dan saldo akhir per kode akun akuntansi"
          >
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View className="min-w-[820px] w-full gap-1">
                <View className="bg-panel border-border flex-row items-center border-b px-3 py-2.5 rounded-t-lg">
                  <Text className="w-[80px] text-xs font-bold">Kode</Text>
                  <Text className="flex-1 text-xs font-bold">Nama Akun (COA)</Text>
                  <Text className="w-[160px] text-xs font-bold">Kategori</Text>
                  <Text className="w-[90px] text-xs font-bold text-center">Saldo Normal</Text>
                  <Text className="w-[130px] text-xs font-bold text-right">Mutasi Debit</Text>
                  <Text className="w-[130px] text-xs font-bold text-right">Mutasi Kredit</Text>
                  <Text className="w-[140px] text-xs font-bold text-right">Saldo Akhir</Text>
                </View>
                {fin.coaBalances.map((acc) => (
                  <View
                    key={acc.code}
                    className="border-border/60 flex-row items-center border-b px-3 py-2"
                  >
                    <Text className="w-[80px] text-xs font-bold font-mono text-primary">
                      {acc.code}
                    </Text>
                    <Text className="flex-1 text-xs font-medium">{acc.name}</Text>
                    <Text className="w-[160px] text-xs text-text-secondary">{acc.category}</Text>
                    <View className="w-[90px] items-center">
                      <Pill
                        label={acc.normalBalance}
                        tone={acc.normalBalance === "DEBIT" ? "info" : "primary"}
                      />
                    </View>
                    <Text className="w-[130px] text-xs font-mono text-right">
                      {rupiah(acc.totalDebit)}
                    </Text>
                    <Text className="w-[130px] text-xs font-mono text-right">
                      {rupiah(acc.totalKredit)}
                    </Text>
                    <Text className="w-[140px] text-xs font-bold font-mono text-right">
                      {rupiah(acc.endingBalance)}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </Panel>

          <Panel
            title="Buku Jurnal Umum (General Journal)"
            subtitle="Pencatatan kronologis ayat jurnal berpasangan (Debit & Kredit)"
          >
            <View className="gap-3">
              <View className="flex-row flex-wrap items-center justify-between gap-2">
                <View className="flex-row items-center gap-2 flex-1 min-w-[240px]">
                  <Search size={15} color={colors.textSecondary} />
                  <Input
                    value={journalQuery}
                    onChangeText={setJournalQuery}
                    placeholder="Cari nomor jurnal, referensi, akun, atau keterangan..."
                    className="flex-1 h-9 text-xs"
                  />
                </View>
                <View className="flex-row flex-wrap gap-1.5">
                  {[
                    "Semua",
                    "Invoice Client",
                    "Pembayaran Invoice",
                    "PO Supplier",
                    "Pengeluaran (Expense)",
                    "Pembayaran Expense",
                  ].map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setJournalSourceFilter(s)}
                      className={
                        journalSourceFilter === s
                          ? "bg-primary/20 border-primary rounded-md border px-2.5 py-1"
                          : "bg-panel border-border rounded-md border px-2.5 py-1"
                      }
                    >
                      <Text
                        className={
                          journalSourceFilter === s
                            ? "text-primary text-xs font-semibold"
                            : "text-text-secondary text-xs"
                        }
                      >
                        {s}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator>
                <View className="min-w-[960px] w-full gap-0.5">
                  <View className="bg-panel border-border flex-row items-center border-b px-3 py-2.5 rounded-t-lg">
                    <Text className="w-[85px] text-xs font-bold">No. Jurnal</Text>
                    <Text className="w-[90px] text-xs font-bold">Tanggal</Text>
                    <Text className="w-[125px] text-xs font-bold">Referensi</Text>
                    <Text className="w-[75px] text-xs font-bold">Akun</Text>
                    <Text className="w-[210px] text-xs font-bold">Nama Akun</Text>
                    <Text className="flex-1 text-xs font-bold">Uraian / Keterangan</Text>
                    <Text className="w-[125px] text-xs font-bold text-right">Debit (Rp)</Text>
                    <Text className="w-[125px] text-xs font-bold text-right">Kredit (Rp)</Text>
                  </View>
                  {filteredJournal.map((line) => {
                    const isCredit = line.kredit > 0 && line.debit === 0;
                    return (
                      <View
                        key={line.id}
                        className="border-border/50 flex-row items-center border-b px-3 py-2"
                      >
                        <Text className="w-[85px] text-xs font-mono text-text-secondary">
                          {line.journalNo}
                        </Text>
                        <Text className="w-[90px] text-xs font-mono text-text-secondary">
                          {line.tanggal}
                        </Text>
                        <Text className="w-[125px] text-xs font-semibold font-mono">
                          {line.refNo}
                        </Text>
                        <Text className="w-[75px] text-xs font-bold font-mono text-primary">
                          {line.kodeAkun}
                        </Text>
                        <Text
                          className={`w-[210px] text-xs font-medium ${isCredit ? "pl-4 text-text-secondary" : ""}`}
                          numberOfLines={1}
                        >
                          {line.namaAkun}
                        </Text>
                        <Text className="flex-1 text-xs text-text-secondary pr-3" numberOfLines={1}>
                          {line.keterangan}
                        </Text>
                        <Text className="w-[125px] text-xs font-mono text-right font-semibold">
                          {line.debit > 0 ? rupiah(line.debit) : "-"}
                        </Text>
                        <Text className="w-[125px] text-xs font-mono text-right font-semibold text-info">
                          {line.kredit > 0 ? rupiah(line.kredit) : "-"}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </Panel>
        </View>
      )}

      {/* TAB 5 (OR DEFAULT FOR NON-FINANCE): SEMUA KARTU UNDUHAN LAPORAN */}
      {(!canAccessFinancials || activeTab === "cards") && (
        <View className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
          {reportCards.map((rc) => (
            <View
              key={rc.title}
              className="bg-card border-border rounded-xl border p-5 justify-between gap-4 w-full"
            >
              <View className="gap-1.5">
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="text-base font-semibold flex-1">{rc.title}</Text>
                  {rc.badge ? <Pill label={rc.badge} tone="primary" /> : null}
                </View>
                <Text className="text-text-secondary text-sm">{rc.desc}</Text>
                <View className="bg-panel/40 border-border mt-2 rounded-lg border p-2.5">
                  <Text className="text-xs text-muted-foreground font-mono">{rc.stat}</Text>
                </View>
              </View>

              {rc.isEfaktur ? (
                <View className="border-border border-t pt-3 flex-row gap-2">
                  <Button
                    size="sm"
                    className="flex-1 flex-row items-center justify-center gap-2"
                    onPress={downloadEfaktur}
                  >
                    <FileSpreadsheet size={15} color={colors.background} />
                    <Text className="text-xs font-semibold">Download CSV E-Faktur DJP</Text>
                  </Button>
                </View>
              ) : (
                <View className="border-border border-t pt-3 flex-row gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onPress={() => download(rc.type, rc.title, "xlsx")}
                  >
                    <FileSpreadsheet size={14} color={colors.success} />
                    <Text className="text-xs">Excel</Text>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onPress={() => download(rc.type, rc.title, "pdf")}
                  >
                    <FileText size={14} color={colors.danger} />
                    <Text className="text-xs">PDF</Text>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onPress={() => download(rc.type, rc.title, "docx")}
                  >
                    <FileText size={14} color={colors.info} />
                    <Text className="text-xs">Word</Text>
                  </Button>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
