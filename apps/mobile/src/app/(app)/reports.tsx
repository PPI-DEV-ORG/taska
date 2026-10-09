import * as React from "react";
import { View, ScrollView } from "react-native";
import { Download, FileSpreadsheet, FileText } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { PageHeader, Panel } from "@/components/taska/basics";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";

const REPORT_CARDS = [
  {
    title: "Laporan Penjualan & Pipeline",
    desc: "Rekap lead per tahap funnel, tingkat konversi, nilai pipeline, dan estimasi closing bulanan.",
    stat: "15 Leads · Rp 1,8 Miliar Pipeline",
  },
  {
    title: "Laporan Piutang & Invoice",
    desc: "Daftar invoice keluar per customer, analisa umur piutang (aging), status termin, dan denda keterlambatan.",
    stat: "8 Invoice · Rp 527 Juta Belum Lunas",
  },
  {
    title: "Laporan Saldo & Mutasi Stok Gudang",
    desc: "Pergerakan barang masuk, keluar ke project, transfer antar gudang, unit terpasang, dan selisih opname.",
    stat: "20 SKU · 3 Gudang Aktif",
  },
  {
    title: "Laporan Pengeluaran & Reimbursement",
    desc: "Rekap biaya operasional lapangan (bensin, makan, perlengkapan) per project dan cost center.",
    stat: "12 Pengeluaran · Rp 15,3 Juta Total",
  },
  {
    title: "Laporan Analisa Konversi Survey",
    desc: "Tingkat keberhasilan survey lapangan menjadi penawaran deal vs alasan Lost (harga, tidak ada kabar).",
    stat: "6 Survey · 66% Rasio Deal",
  },
  {
    title: "Laporan Realisasi Project",
    desc: "Progres fisik task, penggunaan material barang, status pembayaran termin, dan kesiapan serah terima BAST.",
    stat: "6 Project Berjalan",
  },
];

export default function ReportsScreen() {
  const { data, toast } = useApp();

  function generateCsv(title: string): string {
    const headerPrefix = `LAPORAN RESMI TASKA ERP - ${title.toUpperCase()}\nTanggal Ekspor: ${new Date().toISOString().slice(0, 10)}\n\n`;

    if (title.includes("Pipeline") || title.includes("Penjualan")) {
      const rows = (data.leads || []).map((l: any) =>
        `"${l.id}","${l.nama}","${l.perusahaan}","${l.sumber}","${l.nilai}","${l.peluang}%","${l.closing}","${l.pemilik}","${l.status}","${l.alasanLost || "-"}"`
      );
      return headerPrefix + "ID,Nama Proyek,Perusahaan,Sumber,Nilai (Rp),Peluang,Est Closing,PIC Sales,Status,Alasan Lost\n" + rows.join("\n");
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

    if (title.includes("Survey")) {
      const rows = (data.surveys || []).map((s: any) =>
        `"${s.id}","${s.lead}","${s.customer}","${s.lokasi}","${s.jadwal}","${s.tim}","${s.biaya}","${s.status}"`
      );
      return headerPrefix + "ID,Lead / Proyek,Customer,Lokasi,Jadwal,Tim Teknisi,Biaya Lapangan,Status\n" + rows.join("\n");
    }

    // Realisasi Project
    const rows = (data.projects || []).map((pr: any) =>
      `"${pr.id}","${pr.nama}","${pr.customer}","${pr.pm}","${pr.progres}%","${pr.status}","${pr.pembayaran}","${pr.barang}"`
    );
    return headerPrefix + "ID,Nama Proyek,Customer,PM,Progres,Status Proyek,Pembayaran,Status Barang\n" + rows.join("\n");
  }

  function download(title: string, format: string) {
    if (typeof window === "undefined" || typeof document === "undefined") {
      toast(`Mengunduh ${title} dalam format ${format}`);
      return;
    }

    const safeName = title.toLowerCase().replace(/[^a-z0-9]/g, "-");

    if (format.startsWith("Excel")) {
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
    } else if (format === "PDF") {
      window.print();
    } else {
      // Word (.doc format via HTML Blob)
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

  return (
    <View className="gap-5 w-full pb-8">
      <PageHeader
        title="Laporan Eksekutif & Operasional"
        subtitle="Unduh rekapitulasi data lengkap dalam format Excel, PDF, atau Word"
      />

      <View className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
        {REPORT_CARDS.map((rc) => (
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

            <View className="border-border border-t pt-3 flex-row gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onPress={() => download(rc.title, "Excel (.xlsx)")}
              >
                <FileSpreadsheet size={14} color={colors.success} />
                <Text className="text-xs">Excel</Text>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onPress={() => download(rc.title, "PDF")}
              >
                <FileText size={14} color={colors.danger} />
                <Text className="text-xs">PDF</Text>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onPress={() => download(rc.title, "Word (.docx)")}
              >
                <FileText size={14} color={colors.info} />
                <Text className="text-xs">Word</Text>
              </Button>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
