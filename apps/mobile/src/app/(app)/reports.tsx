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
  const { toast } = useApp();

  function download(title: string, format: string) {
    toast(`Mengunduh ${title} dalam format ${format}`);
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
