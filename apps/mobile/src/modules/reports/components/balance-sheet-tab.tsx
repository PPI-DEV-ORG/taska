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
                : `SELISIH ${rupiah(Math.abs(fin.balanceSheet.discrepancy ?? (fin.balanceSheet.assets.totalAsetLancar - fin.balanceSheet.totalPasiva)))}`}
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
              {Array.isArray(fin.balanceSheet.assets?.items) &&
              fin.balanceSheet.assets.items.filter((it: any) => Number(it.amount || 0) !== 0).length > 0 ? (
                fin.balanceSheet.assets.items
                  .filter((it: any) => Number(it.amount || 0) !== 0)
                  .map((it: any, idx: number) => (
                    <View
                      key={it.code}
                      className={`${idx > 0 ? "border-border/50 border-t pt-2" : ""} flex-row justify-between items-center py-1`}
                    >
                      <View className="gap-0.5">
                        <Text className="text-sm font-medium">[{it.code}] {it.name}</Text>
                        <Text className="text-xs text-text-secondary">{it.category}</Text>
                      </View>
                      <Text className="text-sm font-bold font-mono">
                        {rupiah(it.amount)}
                      </Text>
                    </View>
                  ))
              ) : (
                <>
                  <View className="flex-row justify-between items-center py-1">
                    <View className="gap-0.5">
                      <Text className="text-sm font-medium">[1000] Kas & Bank Operasional</Text>
                      <Text className="text-xs text-text-secondary">
                        Saldo kas dan rekening bank operasional terbayar
                      </Text>
                    </View>
                    <Text className="text-sm font-bold font-mono">
                      {rupiah(fin.balanceSheet.assets.kasDanBank)}
                    </Text>
                  </View>

                  <View className="border-border/50 border-t pt-2 flex-row justify-between items-center py-1">
                    <View className="gap-0.5">
                      <Text className="text-sm font-medium">
                        [1100] Piutang Usaha (Accounts Receivable)
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
                        [1200] Persediaan Barang Gudang (Inventory)
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
                          Kredit pajak PPh dipotong oleh pelanggan
                        </Text>
                      </View>
                      <Text className="text-sm font-bold font-mono text-warning">
                        {rupiah(fin.balanceSheet.assets.uangMukaPph)}
                      </Text>
                    </View>
                  ) : null}

                  {(fin.balanceSheet.assets.ppnMasukan || 0) > 0 ? (
                    <View className="border-border/50 border-t pt-2 flex-row justify-between items-center py-1">
                      <View className="gap-0.5">
                        <Text className="text-sm font-medium">
                          [1600] PPN Masukan (Kredit Pajak Masukan)
                        </Text>
                        <Text className="text-xs text-text-secondary">
                          Kredit pajak PPN 11% atas pembelian PO supplier & pengadaan
                        </Text>
                      </View>
                      <Text className="text-sm font-bold font-mono text-primary">
                        {rupiah(fin.balanceSheet.assets.ppnMasukan)}
                      </Text>
                    </View>
                  ) : null}
                </>
              )}
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
              {Array.isArray(fin.balanceSheet.liabilities?.items) &&
              fin.balanceSheet.liabilities.items.filter((it: any) => Number(it.amount || 0) !== 0).length > 0 ? (
                fin.balanceSheet.liabilities.items
                  .filter((it: any) => Number(it.amount || 0) !== 0)
                  .map((it: any, idx: number) => (
                    <View
                      key={it.code}
                      className={`${idx > 0 ? "border-border/50 border-t pt-2" : ""} flex-row justify-between items-center py-1`}
                    >
                      <View className="gap-0.5">
                        <Text className="text-sm text-text-secondary">[{it.code}] {it.name}</Text>
                      </View>
                      <Text className="text-sm font-mono">
                        {rupiah(it.amount)}
                      </Text>
                    </View>
                  ))
              ) : (
                <>
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
                      [2100] Hutang Pajak PPN Keluaran (11%)
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
                </>
              )}
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
              {Array.isArray(fin.balanceSheet.equity?.items) &&
              fin.balanceSheet.equity.items.filter((it: any) => Number(it.amount || 0) !== 0).length > 0 ? (
                fin.balanceSheet.equity.items
                  .filter((it: any) => Number(it.amount || 0) !== 0)
                  .map((it: any, idx: number) => (
                    <View
                      key={it.code}
                      className={`${idx > 0 ? "border-border/50 border-t pt-2" : ""} flex-row justify-between items-center py-1`}
                    >
                      <View className="gap-0.5">
                        <Text className="text-sm text-text-secondary">[{it.code}] {it.name}</Text>
                      </View>
                      <Text className="text-sm font-mono text-success">
                        {rupiah(it.amount)}
                      </Text>
                    </View>
                  ))
              ) : (
                <>
                  <View className="flex-row justify-between items-center py-1">
                    <Text className="text-sm text-text-secondary">
                      [3101] Modal Disetor / Modal Kerja
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
                </>
              )}
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

      {/* REKAPITULASI PPN DJP (SPT MASA PPN) */}
      {(() => {
        const ppnKeluaran = fin.balanceSheet.liabilities.hutangPpnKeluaran || 0;
        const ppnMasukan = fin.balanceSheet.assets.ppnMasukan || 0;
        const selisih = ppnKeluaran - ppnMasukan;
        return (
          <Panel
            title="Rekapitulasi PPN & Posisi Pajak DJP (SPT Masa PPN)"
            subtitle="Perhitungan kompensasi PPN Keluaran (Penjualan/Faktur) dikurangi PPN Masukan (Pembelian PO/Retail)"
          >
            <View className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <View className="bg-panel/50 border-border rounded-lg border p-3 gap-1">
                <Text className="text-xs text-text-secondary font-medium uppercase tracking-wider">
                  [2102] PPN Keluaran (Penjualan)
                </Text>
                <Text className="text-base font-bold font-mono text-warning">
                  {rupiah(ppnKeluaran)}
                </Text>
                <Text className="text-[11px] text-text-secondary">
                  Titipan PPN 11% dipungut dari klien atas invoice penjualan
                </Text>
              </View>

              <View className="bg-panel/50 border-border rounded-lg border p-3 gap-1">
                <Text className="text-xs text-text-secondary font-medium uppercase tracking-wider">
                  [1600] PPN Masukan (Pembelian)
                </Text>
                <Text className="text-base font-bold font-mono text-primary">
                  {rupiah(ppnMasukan)}
                </Text>
                <Text className="text-[11px] text-text-secondary">
                  Kredit pajak PPN 11% dibayar atas PO supplier & pengadaan barang
                </Text>
              </View>

              <View
                className={`rounded-lg border p-3 gap-1 ${
                  selisih > 0
                    ? "bg-warning/10 border-warning/40"
                    : selisih < 0
                    ? "bg-success/10 border-success/40"
                    : "bg-panel/50 border-border"
                }`}
              >
                <Text className="text-xs font-semibold uppercase tracking-wider">
                  {selisih > 0
                    ? "PPN Kurang Bayar (Setor Kas Negara)"
                    : selisih < 0
                    ? "PPN Lebih Bayar (Kompensasi)"
                    : "PPN Nihil"}
                </Text>
                <Text
                  className={`text-base font-bold font-mono ${
                    selisih > 0
                      ? "text-warning"
                      : selisih < 0
                      ? "text-success"
                      : "text-text-secondary"
                  }`}
                >
                  {rupiah(Math.abs(selisih))}
                </Text>
                <Text className="text-[11px] text-text-secondary">
                  {selisih > 0
                    ? "Kewajiban disetor ke kas negara sebelum pelaporan SPT Masa PPN"
                    : selisih < 0
                    ? "Saldo lebih bayar dapat dikompensasi ke masa pajak berikutnya"
                    : "Pajak masukan sama dengan pajak keluaran"}
                </Text>
              </View>
            </View>
          </Panel>
        );
      })()}
    </View>
  );
}

