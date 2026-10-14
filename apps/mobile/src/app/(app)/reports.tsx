import * as React from "react";
import { View } from "react-native";
import { FileSpreadsheet, FileText } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { PageHeader } from "@/components/taska/basics";
import { useApp } from "@/store/app-store";
import { apiBase, getAccess } from "@/services/api";
import { rupiah } from "@/lib/format";
import { colors } from "@/tokens";

export default function ReportsScreen() {
  const { data, approvals, user, toast } = useApp();
  const canAccessFinancials = ["super_admin", "bos", "finance"].includes(user?.role || "");

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
    const unpaidVal = (data.invoices ?? []).reduce(
      (a, i) => a + Math.max(0, Number(i.total ?? 0) - Number(i.terbayar ?? 0)),
      0,
    );

    const totalRev = (data.invoices ?? [])
      .filter((i: any) => i.status !== "Batal" && i.status !== "BATAL")
      .reduce((a: number, i: any) => a + Number(i.nilai || i.amount || 0), 0);
    const totalPoCost = (data["supplier-pos"] ?? [])
      .filter((po: any) => po.status !== "DIBATALKAN" && po.status !== "Ditolak")
      .reduce((a: number, po: any) => a + Number(po.total || 0), 0);
    const totalExp = (data.expenses ?? [])
      .filter((e: any) => e.status !== "Ditolak")
      .reduce((a: number, e: any) => a + Number(e.nominal || 0), 0);
    const totalNetProfit = totalRev - (totalPoCost + totalExp);
    const pnlMargin = totalRev > 0 ? ((totalNetProfit / totalRev) * 100).toFixed(1) + "%" : "0%";

    const cards: Array<{
      type: string;
      title: string;
      desc: string;
      stat: string;
      isEfaktur?: boolean;
    }> = [];

    if (canAccessFinancials) {
      cards.push(
        {
          type: "profit-loss",
          title: "Laporan Untung-Rugi (P&L) Project & Overall",
          desc: "Kalkulasi laba-rugi project: pendapatan invoice, biaya PO supplier, biaya operasional, laba bersih, dan profit margin.",
          stat: `${projCount} Proyek · Laba Bersih: ${rupiah(totalNetProfit)} (${pnlMargin})`,
        },
        {
          type: "efaktur",
          title: "Export CSV E-Faktur DJP (Pajak Keluaran)",
          desc: "Ekspor data faktur pajak keluaran dari invoice klien sesuai format CSV resmi aplikasi e-Faktur Direktorat Jenderal Pajak (DJP).",
          stat: `${invCount} Invoice Siap Ekspor Pajak`,
          isEfaktur: true,
        },
      );
    }

    cards.push(
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
        type: "projects",
        title: "Laporan Realisasi Project",
        desc: "Daftar project beserta progres fisik, PIC, tenggat, dan status pembayaran.",
        stat: `${projCount} Project Terdaftar`,
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
        type: "expenses",
        title: "Laporan Pengeluaran & Reimbursement",
        desc: "Daftar pengeluaran per status, per kategori, per project, dan per cost center.",
        stat: `${expCount} Pengeluaran · ${rupiah(expVal)} Total`,
      },
      {
        type: "approvals",
        title: "Laporan Dokumen Menunggu Persetujuan",
        desc: "Daftar dokumen yang menunggu keputusan persetujuan Finance atau Bos.",
        stat: `${apprCount} Dokumen Menunggu Keputusan`,
      },
      {
        type: "invoices",
        title: "Laporan Piutang & Invoice Keluar",
        desc: "Daftar invoice keluar per customer, analisa umur piutang (aging), dan status termin.",
        stat: `${invCount} Invoice · ${rupiah(unpaidVal)} Belum Lunas`,
      },
    );

    return cards;
  }, [data, approvals, canAccessFinancials]);

  function generateCsv(title: string): string {
    const headerPrefix = `LAPORAN RESMI TASKA ERP - ${title.toUpperCase()}\nTanggal Ekspor: ${new Date().toISOString().slice(0, 10)}\n\n`;

    if (title.includes("Untung-Rugi") || title.includes("P&L")) {
      const rows = (data.projects || []).map((pr: any) => {
        const prInvoices = (data.invoices || []).filter(
          (i: any) => String(i.projectId) === String(pr.id) && i.status !== "Batal"
        );
        const rev = prInvoices.reduce((a: number, i: any) => a + Number(i.nilai || i.amount || 0), 0);
        const prPos = (data["supplier-pos"] || []).filter(
          (po: any) => String(po.projectId) === String(pr.id) && po.status !== "Ditolak" && po.status !== "DIBATALKAN"
        );
        const poCost = prPos.reduce((a: number, po: any) => a + Number(po.total || 0), 0);
        const prExp = (data.expenses || []).filter(
          (e: any) => String(e.projectId) === String(pr.id) && e.status !== "Ditolak"
        );
        const expCost = prExp.reduce((a: number, e: any) => a + Number(e.nominal || 0), 0);
        const net = rev - (poCost + expCost);
        const m = rev > 0 ? ((net / rev) * 100).toFixed(1) + "%" : "0%";
        return `"${pr.id}","${pr.nama}","${pr.customer}","${pr.pm}","${pr.status}","${rev}","${poCost}","${expCost}","${net}","${m}"`;
      });
      return headerPrefix + "ID,Nama Proyek,Customer,PIC PM,Status,Pendapatan Invoice (Rp),Biaya PO Supplier (Rp),Biaya Operasional (Rp),Laba Bersih (Rp),Margin (%)\n" + rows.join("\n");
    }

    if (title.includes("Pipeline") || title.includes("Leads")) {
      const rows = (data.leads || []).map((l: any) =>
        `"${l.id}","${l.nama}","${l.perusahaan}","${l.sumber}","${l.nilai}","${l.peluang}%","${l.closing}","${l.pemilik}","${l.status}","${l.alasanLost || "-"}"`
      );
      return headerPrefix + "ID,Nama Proyek,Perusahaan,Sumber,Nilai (Rp),Peluang,Est Closing,PIC Sales,Status,Alasan Lost\n" + rows.join("\n");
    }

    if (title.includes("Follow-up")) {
      const rows = (data.followups || []).map((f: any) =>
        `"${f.id}","${f.tanggal}","${f.lead}","${f.metode}","${f.catatan}","${f.berikutnya || "-"}","${f.status}"`
      );
      return headerPrefix + "ID,Tanggal,Lead,Metode,Catatan,Jadwal Berikutnya,Status\n" + rows.join("\n");
    }

    if (title.includes("Piutang") || title.includes("Invoice")) {
      const rows = (data.invoices || []).map((inv: any) =>
        `"${inv.nomor}","${inv.customer}","${inv.jenis}","${inv.total}","${inv.terbayar}","${inv.total - inv.terbayar}","${inv.jatuhTempo}","${inv.status}"`
      );
      return headerPrefix + "Nomor Invoice,Customer,Jenis Termin,Total Tagihan,Sudah Dibayar,Sisa Piutang,Jatuh Tempo,Status\n" + rows.join("\n");
    }

    if (title.includes("Stok") || title.includes("Gudang")) {
      const rows = (data.products || []).map((p: any) =>
        `"${p.sku}","${p.nama}","${p.kategori}","${p.satuan}","${p.hargaBeli}","${p.garansi}","${p.berSN ? "Ya" : "Tidak"}"`
      );
      return headerPrefix + "SKU,Nama Produk,Kategori,Satuan,Harga Beli (Rp),Masa Garansi,Serial Number (SN)\n" + rows.join("\n");
    }

    if (title.includes("Pengeluaran") || title.includes("Reimbursement")) {
      const rows = (data.expenses || []).map((e: any) =>
        `"${e.id}","${e.tanggal}","${e.pelapor}","${e.kategori}","${e.nominal}","${e.project}","${e.alasan}","${e.status}"`
      );
      return headerPrefix + "ID,Tanggal,Pelapor,Kategori,Nominal (Rp),Project Terkait,Keperluan,Status\n" + rows.join("\n");
    }

    if (title.includes("Surat Jalan")) {
      const rows = (data["delivery-notes"] || []).map((dn: any) =>
        `"${dn.nomor}","${dn.tanggal}","${dn.tujuan}","${dn.alasan}","${dn.project}","${dn.pembuat}","${dn.status}"`
      );
      return headerPrefix + "Nomor SJ,Tanggal,Tujuan,Alasan,Project,Pembuat,Status\n" + rows.join("\n");
    }

    if (title.includes("Persetujuan")) {
      const rows = (approvals || []).map((ap: any) =>
        `"${ap.id}","${ap.jenis}","${ap.judul}","${ap.pengaju}","${ap.nilai}","${ap.status}"`
      );
      return headerPrefix + "ID,Jenis,Judul,Pengaju,Nilai (Rp),Status\n" + rows.join("\n");
    }

    const rows = (data.projects || []).map((pr: any) =>
      `"${pr.id}","${pr.nama}","${pr.customer}","${pr.pm}","${pr.progres}%","${pr.status}","${pr.pembayaran}","${pr.barang}"`
    );
    return headerPrefix + "ID,Nama Proyek,Customer,PM,Progres,Status Proyek,Pembayaran,Status Barang\n" + rows.join("\n");
  }

  async function download(type: string, title: string, format: "xlsx" | "pdf" | "docx") {
    if (type === "profit-loss" && !canAccessFinancials) {
      toast("Akses ditolak: Laporan P&L hanya untuk Finance, Bos, dan Super Admin", "danger");
      return;
    }
    if (typeof window === "undefined" || typeof document === "undefined") {
      toast(`Mengunduh ${title} (${format.toUpperCase()})`);
      return;
    }

    const safeName = title.toLowerCase().replace(/[^a-z0-9]/g, "-");
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

    if (format === "xlsx") {
      const csvData = generateCsv(title);
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
      window.print();
    } else {
      const csvData = generateCsv(title);
      const htmlContent = `<html><head><meta charset="utf-8"><title>${title}</title></head><body><h2>PT GHINA MULTI PRIMA / TASKA ERP</h2><h3>${title}</h3><pre>${csvData}</pre></body></html>`;
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
      toast("Akses ditolak: Ekspor E-Faktur hanya untuk Finance, Bos, dan Super Admin", "danger");
      return;
    }
    if (typeof window === "undefined" || typeof document === "undefined") {
      toast("Mengunduh CSV E-Faktur DJP");
      return;
    }
    const token = getAccess();
    const url = `${apiBase()}/invoices/efaktur/export${token ? `?token=${encodeURIComponent(token)}` : ""}`;
    const link = document.createElement("a");
    link.href = url;
    link.download = `efaktur-pajak-keluaran-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast("File CSV E-Faktur DJP berhasil diunduh!");
  }

  return (
    <View className="gap-5 w-full pb-8">
      <PageHeader
        title="Laporan Eksekutif & Operasional"
        subtitle="Unduh rekapitulasi data lengkap dalam format Excel, PDF, atau Word"
      />

      <View className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
        {reportCards.map((rc) => (
          <View
            key={rc.title}
            className="bg-card border-border rounded-xl border p-5 justify-between gap-4 w-full"
          >
            <View className="gap-1.5">
              <Text className="text-base font-semibold">{rc.title}</Text>
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
    </View>
  );
}
