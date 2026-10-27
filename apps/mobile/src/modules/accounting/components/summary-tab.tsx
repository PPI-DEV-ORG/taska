import * as React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/taska/basics";
import { ArrowRight } from "lucide-react-native";
import { colors } from "@/tokens";
import { rupiah } from "@/lib/format";

interface SummaryTabProps {
  fin: any;
  onNavigateToReports: (tab: string) => void;
}

export function SummaryTab({ fin, onNavigateToReports }: SummaryTabProps) {
  return (
    <View className="gap-5 w-full">
      <View className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Laba Rugi Mini Card */}
        <Panel
          title="Laporan Laba Rugi Operasional (P&L)"
          subtitle="Kinerja pendapatan DPP penjualan terhadap beban pokok dan biaya operasional"
          right={
            <Button
              size="sm"
              variant="outline"
              onPress={() => onNavigateToReports("pnl")}
              className="gap-1.5 h-8"
            >
              <Text className="text-xs">Buka Laporan P&L</Text>
              <ArrowRight size={13} color={colors.primary} />
            </Button>
          }
        >
          <View className="gap-2">
            <View className="flex-row justify-between py-1 border-b border-border/40">
              <Text className="text-xs text-muted-foreground">Pendapatan Proyek (DPP Bersih):</Text>
              <Text className="text-xs font-bold text-foreground">{rupiah(fin.incomeStatement.revenueDpp)}</Text>
            </View>
            <View className="flex-row justify-between py-1 border-b border-border/40">
              <Text className="text-xs text-muted-foreground">Beban Pokok Pengadaan (HPP):</Text>
              <Text className="text-xs font-semibold text-danger">- {rupiah(fin.incomeStatement.cogsTotal)}</Text>
            </View>
            <View className="flex-row justify-between py-1 border-b border-border/40">
              <Text className="text-xs font-bold text-foreground">Laba Kotor (Gross Profit):</Text>
              <Text className="text-xs font-bold text-success">{rupiah(fin.incomeStatement.grossProfit)} ({fin.incomeStatement.grossMarginPct}%)</Text>
            </View>
            <View className="flex-row justify-between py-1 border-b border-border/40">
              <Text className="text-xs text-muted-foreground">Beban Operasional & Lapangan (OPEX):</Text>
              <Text className="text-xs font-semibold text-danger">- {rupiah(fin.incomeStatement.opexTotal)}</Text>
            </View>
            <View className="flex-row justify-between pt-2 border-t border-border">
              <Text className="text-sm font-extrabold text-foreground">Laba Bersih Operasional (Net Profit):</Text>
              <Text className="text-sm font-extrabold text-primary">{rupiah(fin.incomeStatement.netProfit)} ({fin.incomeStatement.netMarginPct}%)</Text>
            </View>
          </View>
        </Panel>

        {/* Neraca Mini Card */}
        <Panel
          title="Posisi Keuangan & Neraca (Balance Sheet)"
          subtitle="Struktur aktiva lancar terhadap kewajiban jangka pendek dan ekuitas modal"
          right={
            <Button
              size="sm"
              variant="outline"
              onPress={() => onNavigateToReports("balance-sheet")}
              className="gap-1.5 h-8"
            >
              <Text className="text-xs">Buka Neraca Lengkap</Text>
              <ArrowRight size={13} color={colors.primary} />
            </Button>
          }
        >
          <View className="gap-2">
            <View className="flex-row justify-between py-1 border-b border-border/40">
              <Text className="text-xs text-muted-foreground">Total Aset Lancar (Kas, Piutang, Stok, PPh):</Text>
              <Text className="text-xs font-bold text-foreground">{rupiah(fin.balanceSheet.assets.totalAsetLancar)}</Text>
            </View>
            <View className="flex-row justify-between py-1 border-b border-border/40">
              <Text className="text-xs text-muted-foreground">Total Kewajiban (Hutang Supplier & PPN):</Text>
              <Text className="text-xs font-bold text-warning">{rupiah(fin.balanceSheet.liabilities.totalKewajiban)}</Text>
            </View>
            <View className="flex-row justify-between py-1 border-b border-border/40">
              <Text className="text-xs text-muted-foreground">Total Ekuitas (Modal Awal + Laba):</Text>
              <Text className="text-xs font-bold text-success">{rupiah(fin.balanceSheet.equity.totalEkuitas)}</Text>
            </View>
            <View className="flex-row justify-between pt-2 border-t border-border">
              <Text className="text-sm font-extrabold text-foreground">Total Pasiva (Kewajiban + Ekuitas):</Text>
              <Text className="text-sm font-extrabold text-primary">{rupiah(fin.balanceSheet.totalPasiva)}</Text>
            </View>
          </View>
        </Panel>
      </View>
    </View>
  );
}

