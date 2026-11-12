import * as React from "react";
import { View, ScrollView } from "react-native";
import { Text } from "@/components/ui/text";
import { Panel, KpiCard } from "@/components/taska/basics";
import { rupiah } from "@/lib/format";
import { Pill, ExportBar } from "./report-ui-helpers";
import type { DownloadFormat } from "../types";

interface CashFlowTabProps {
  fin: any;
  onDownload: (type: string, title: string, format: DownloadFormat) => void;
}

export function CashFlowTab({ fin, onDownload }: CashFlowTabProps) {
  const cf = fin?.cashFlow ?? {
    totalCashIn: 0,
    cashOutSuppliers: 0,
    cashOutExpenses: 0,
    netCashFlow: 0,
    cashConversionRatePct: 0,
    items: [],
  };
  const netCash = Number(cf.netCashFlow) || 0;
  const convRate = Number(cf.cashConversionRatePct) || 0;

  return (
    <View className="gap-5 w-full">
      <View className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 w-full">
        <KpiCard
          label="Total Kas Masuk (Inflow)"
          value={rupiah(cf.totalCashIn)}
          hint="Penerimaan pembayaran faktur pelanggan"
          tone="success"
        />
        <KpiCard
          label="Kas Keluar Pemasok PO"
          value={rupiah(cf.cashOutSuppliers)}
          hint="Pelunasan PO pengadaan barang"
          tone="warning"
        />
        <KpiCard
          label="Kas Keluar Operasional"
          value={rupiah(cf.cashOutExpenses)}
          hint="Reimbursement staf status Dibayar"
          tone="danger"
        />
        <KpiCard
          label="Arus Kas Bersih (Net Cash)"
          value={rupiah(netCash)}
          hint={`Rasio Konversi Kas: ${convRate}% dari Tagihan`}
          tone={netCash >= 0 ? "success" : "danger"}
        />
      </View>

      <Panel
        title="Laporan Arus Kas Operasional (Metode Langsung)"
        subtitle="Mencatat transaksi kas riil yang telah diterima atau dibayarkan (Cash Basis)"
        right={<ExportBar type="cash-flow" title="Laporan Arus Kas Cash Flow" onDownload={onDownload} />}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          contentContainerStyle={{ minWidth: "100%" }}
          className="w-full"
        >
          <View className="min-w-full w-full gap-1">
            <View className="bg-panel border-border flex-row items-center border-b px-4 py-2.5 rounded-t-lg w-full">
              <Text className="w-[110px] text-xs font-bold">Tanggal</Text>
              <Text className="w-[140px] text-xs font-bold">No. Referensi</Text>
              <Text className="w-[160px] text-xs font-bold">Kategori Arus Kas</Text>
              <Text className="w-[180px] text-xs font-bold">Pihak Terkait</Text>
              <Text className="flex-1 min-w-[200px] text-xs font-bold">Keterangan</Text>
              <Text className="w-[140px] text-xs font-bold text-right pr-2">Kas Masuk</Text>
              <Text className="w-[140px] text-xs font-bold text-right pr-2">Kas Keluar</Text>
            </View>
            {(cf.items || []).map((item: any) => (
              <View
                key={item.id}
                className="border-border/60 flex-row items-center border-b px-4 py-2.5 hover:bg-panel/40 w-full"
              >
                <Text className="w-[110px] text-xs font-mono text-text-secondary">
                  {item.tanggal}
                </Text>
                <Text className="w-[140px] text-xs font-semibold font-mono" numberOfLines={1}>
                  {item.refNo}
                </Text>
                <View className="w-[160px] pr-2">
                  <Pill
                    label={item.kategori}
                    tone={item.masuk > 0 ? "success" : "warning"}
                  />
                </View>
                <Text className="w-[180px] text-xs font-medium" numberOfLines={1}>
                  {item.pihak}
                </Text>
                <Text className="flex-1 min-w-[200px] text-xs text-text-secondary pr-3" numberOfLines={1}>
                  {item.keterangan}
                </Text>
                <Text className="w-[140px] text-xs font-bold font-mono text-right text-success pr-2">
                  {item.masuk > 0 ? `+${rupiah(item.masuk)}` : "-"}
                </Text>
                <Text className="w-[140px] text-xs font-bold font-mono text-right text-danger pr-2">
                  {item.keluar > 0 ? `-${rupiah(item.keluar)}` : "-"}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </Panel>
    </View>
  );
}

