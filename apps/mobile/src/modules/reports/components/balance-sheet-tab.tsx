import * as React from "react";
import { View } from "react-native";
import { CheckCircle2, AlertTriangle } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Panel } from "@/components/taska/basics";
import { rupiah } from "@/lib/format";
import { colors } from "@/tokens";
import { ExportBar } from "./report-ui-helpers";
import type { DownloadFormat } from "../types";

interface BalanceSheetTabProps {
  fin: any;
  onDownload: (type: string, title: string, format: DownloadFormat) => void;
}

export function BalanceSheetTab({ fin, onDownload }: BalanceSheetTabProps) {
  return (
    <View className="gap-5 w-full">
      <View
        className={`${
          fin.balanceSheet.isBalanced
            ? "bg-success/10 border-success/40"
            : "bg-warning/10 border-warning/40"
        } rounded-xl border p-4 flex-row flex-wrap items-center justify-between gap-3`}
      >
        <View className="flex-row items-center gap-3">
          {fin.balanceSheet.isBalanced ? (
            <CheckCircle2 size={22} color={colors.success} />
          ) : (
            <AlertTriangle size={22} color={colors.warning} />
          )}
          <View>
            <Text className="text-sm font-bold">
              Status Keseimbangan Neraca:{" "}
              {fin.balanceSheet.isBalanced
                ? "SEIMBANG (BALANCED)"
                : `SELISIH ${rupiah(Math.abs(fin.balanceSheet.discrepancy))}`}
            </Text>
            <Text className="text-xs text-text-secondary">
              Total Aktiva ({rupiah(fin.balanceSheet.assets.totalAsetLancar)}) = Total Pasiva (
              {rupiah(fin.balanceSheet.totalPasiva)})
            </Text>
          </View>
        </View>
        <ExportBar type="balance-sheet" title="Laporan Neraca Balance Sheet" onDownload={onDownload} />
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
  );
}

