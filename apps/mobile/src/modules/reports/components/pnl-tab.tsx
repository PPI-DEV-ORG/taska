import * as React from "react";
import { View, ScrollView } from "react-native";
import { Text } from "@/components/ui/text";
import { Panel, KpiCard } from "@/components/taska/basics";
import { rupiah } from "@/lib/format";
import { Pill, ExportBar } from "./report-ui-helpers";
import type { DownloadFormat } from "../types";

interface PnlTabProps {
  fin: any;
  onDownload: (type: string, title: string, format: DownloadFormat) => void;
}

export function PnlTab({ fin, onDownload }: PnlTabProps) {
  return (
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
        right={<ExportBar type="income-statement" title="Laporan Laba Rugi Standar" onDownload={onDownload} />}
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
                [5101] HPP Project (Pengadaan Barang & Material Proyek)
              </Text>
              <Text className="text-sm font-mono text-danger">
                ({rupiah(fin.incomeStatement.cogsProject ?? fin.incomeStatement.cogsTotal)})
              </Text>
            </View>
            <View className="flex-row justify-between items-center py-1">
              <Text className="text-sm text-text-secondary">
                [5102] HPP Retail (Harga Pokok Penjualan Barang Stok)
              </Text>
              <Text className="text-sm font-mono text-danger">
                ({rupiah(fin.incomeStatement.cogsRetail ?? 0)})
              </Text>
            </View>
            <View className="border-border/60 border-t pt-1.5 flex-row justify-between items-center">
              <Text className="text-xs font-semibold text-muted-foreground">
                [5000] Total Beban Pokok Penjualan (HPP Project + HPP Retail)
              </Text>
              <Text className="text-xs font-bold font-mono text-danger">
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
            {fin.incomeStatement.opexByCategory.map((cat: any) => (
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
              <Text className="text-xs font-bold uppercase tracking-wider text-primary">
                LABA BERSIH OPERASIONAL (NET PROFIT)
              </Text>
              <Text className="text-xs text-text-secondary">
                Pendapatan DPP dikurangi HPP Pengadaan dan Biaya Operasional
              </Text>
            </View>
            <View className="items-end gap-0.5">
              <Text
                className={`text-xl font-bold font-mono ${
                  fin.incomeStatement.netProfit >= 0 ? "text-success" : "text-danger"
                }`}
              >
                {rupiah(fin.incomeStatement.netProfit)}
              </Text>
              <Text className="text-xs font-semibold text-text-secondary">
                Net Margin: {fin.incomeStatement.netMarginPct}%
              </Text>
            </View>
          </View>
        </View>
      </Panel>

      <Panel
        title="Laporan Untung-Rugi (P&L) per Project"
        subtitle="Analisis profitabilitas individual proyek: pendapatan DPP, PPN, kas masuk, piutang, HPP supplier, biaya operasional, dan margin"
        right={<ExportBar type="profit-loss" title="Laporan Untung-Rugi P&L per Project" onDownload={onDownload} />}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View className="min-w-[1080px] w-full gap-1">
            <View className="bg-panel border-border flex-row items-center border-b px-3 py-2.5 rounded-t-lg">
              <Text className="w-[170px] text-xs font-bold">Project</Text>
              <Text className="w-[150px] text-xs font-bold">Customer</Text>
              <Text className="w-[125px] text-xs font-bold text-right">Pendapatan DPP</Text>
              <Text className="w-[110px] text-xs font-bold text-right">Kas Diterima</Text>
              <Text className="w-[110px] text-xs font-bold text-right">Sisa Piutang</Text>
              <Text className="w-[120px] text-xs font-bold text-right">HPP PO Supplier</Text>
              <Text className="w-[115px] text-xs font-bold text-right">Biaya Lapangan</Text>
              <Text className="w-[125px] text-xs font-bold text-right">Laba Bersih</Text>
              <Text className="w-[75px] text-xs font-bold text-center">Margin</Text>
              <Text className="w-[95px] text-xs font-bold text-center">Status</Text>
            </View>
            {fin.incomeStatement.projectRows.map((r: any) => (
              <View
                key={r.project}
                className="border-border/60 flex-row items-center border-b px-3 py-2.5"
              >
                <Text className="w-[170px] text-xs font-semibold font-mono" numberOfLines={1}>
                  {r.project}
                </Text>
                <Text className="w-[150px] text-xs text-text-secondary" numberOfLines={1}>
                  {r.customer}
                </Text>
                <Text className="w-[125px] text-xs font-mono text-right">
                  {rupiah(r.revenueDpp)}
                </Text>
                <Text className="w-[110px] text-xs font-mono text-right text-success">
                  {rupiah(r.paidCashIn)}
                </Text>
                <Text className="w-[110px] text-xs font-mono text-right text-warning">
                  {rupiah(r.arOutstanding)}
                </Text>
                <Text className="w-[120px] text-xs font-mono text-right text-danger">
                  {rupiah(r.cogsPo)}
                </Text>
                <Text className="w-[115px] text-xs font-mono text-right text-text-secondary">
                  {rupiah(r.opexExpense)}
                </Text>
                <Text
                  className={`w-[125px] text-xs font-bold font-mono text-right ${
                    r.netProfit >= 0 ? "text-success" : "text-danger"
                  }`}
                >
                  {rupiah(r.netProfit)}
                </Text>
                <Text className="w-[75px] text-xs font-bold text-center">{r.marginPct}%</Text>
                <View className="w-[95px] items-center">
                  <Pill
                    label={r.statusKesehatan}
                    tone={
                      r.statusKesehatan === "SEHAT"
                        ? "success"
                        : r.statusKesehatan === "WASPADA"
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
  );
}

