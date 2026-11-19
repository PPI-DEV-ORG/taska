import React from "react";
import { View, ScrollView, ActivityIndicator } from "react-native";
import { Text } from "@/components/ui/text";
import { RefreshCw, DollarSign } from "lucide-react-native";
import { DatePicker } from "@/components/akuntra/dialogs";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "../types";

interface PayrollTabProps {
  totalGross: number;
  totalPph21: number;
  totalBpjs: number;
  totalNet: number;
  payrollPeriod: string;
  setPayrollPeriod: (v: string) => void;
  fetchSlips: () => void;
  loadingSlips: boolean;
  isFinanceOrAdmin: boolean;
  handleGenerateSlips: () => void;
  slips: any[];
  setSelectedSlip: (slip: any) => void;
  handlePaySlip: (id: string | number) => void;
  /** Bayar semua slip DRAFT periode ini. */
  onPayAll?: () => void;
}

export function PayrollTab({
  totalGross,
  totalPph21,
  totalBpjs,
  totalNet,
  payrollPeriod,
  setPayrollPeriod,
  fetchSlips,
  loadingSlips,
  isFinanceOrAdmin,
  handleGenerateSlips,
  slips,
  setSelectedSlip,
  handlePaySlip,
  onPayAll,
}: PayrollTabProps) {
  const companyBpjs = slips.reduce((s, r) => s + Number(r.bpjsCompany || 0), 0);
  const drafts = slips.filter((r) => r.status !== "PAID");
  const draftNet = drafts.reduce((s, r) => s + Number(r.netSalary || 0), 0);
  return (
    <View className="gap-4 w-full">
      {/* KPI Cards Finansial */}
      <View className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
        <View className="bg-card border-border/80 rounded-2xl border p-4 shadow-sm">
          <Text className="text-muted-foreground text-xs font-medium">Total Gaji Bruto</Text>
          <Text className="text-foreground text-lg md:text-xl font-bold mt-1">{formatRupiah(totalGross)}</Text>
          <Text className="text-muted-foreground text-[11px] mt-0.5">Gaji pokok + tunjangan + lembur</Text>
        </View>

        <View className="bg-card border-border/80 rounded-2xl border p-4 shadow-sm">
          <Text className="text-muted-foreground text-xs font-medium">Potongan Pajak PPh 21</Text>
          <Text className="text-warning text-lg md:text-xl font-bold mt-1">{formatRupiah(totalPph21)}</Text>
          <Text className="text-muted-foreground text-[11px] mt-0.5">Kewajiban PPh 21 (TER / tarif)</Text>
        </View>

        <View className="bg-card border-border/80 rounded-2xl border p-4 shadow-sm">
          <Text className="text-muted-foreground text-xs font-medium">BPJS</Text>
          <Text className="text-blue-500 text-lg md:text-xl font-bold mt-1">{formatRupiah(totalBpjs + companyBpjs)}</Text>
          <Text className="text-muted-foreground text-[11px] mt-0.5">
            Karyawan {formatRupiah(totalBpjs)} · perusahaan {formatRupiah(companyBpjs)}
          </Text>
        </View>

        <View className="bg-card border-border/80 rounded-2xl border p-4 shadow-sm">
          <Text className="text-muted-foreground text-xs font-medium">Total Bersih Disalurkan</Text>
          <Text className="text-success text-lg md:text-xl font-bold mt-1">{formatRupiah(totalNet)}</Text>
          <Text className="text-muted-foreground text-[11px] mt-0.5">Net transfer rekening karyawan</Text>
        </View>
      </View>

      {/* Filter Bar */}
      <View className="bg-card border-border/80 rounded-2xl border p-4 flex-row flex-wrap items-center justify-between gap-3 shadow-sm">
        <View className="flex-row items-center flex-wrap gap-2">
          <View className="w-52 sm:w-60">
            <DatePicker
              value={payrollPeriod ? (payrollPeriod.length === 7 ? `${payrollPeriod}-01` : payrollPeriod) : ""}
              onChange={(d) => {
                if (d) {
                  setPayrollPeriod(d.slice(0, 7));
                }
              }}
              formatLabel={(iso) => `Periode: ${iso.slice(0, 7)}`}
              placeholder="Pilih Periode..."
              className="h-9 rounded-lg bg-panel border-border/80 text-xs px-2.5"
            />
          </View>

          <Button size="sm" variant="outline" onPress={fetchSlips} className="gap-1.5 h-9 px-3">
            <RefreshCw size={13} className={loadingSlips ? "animate-spin" : ""} />
            <Text className="text-xs font-medium">Muat</Text>
          </Button>
        </View>

        {isFinanceOrAdmin && (
          <View className="flex-row flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onPress={handleGenerateSlips} className="gap-2 h-9 px-3.5">
              <DollarSign size={14} />
              <Text className="text-xs font-semibold">{slips.length ? "Hitung ulang gaji" : "Hitung gaji periode ini"}</Text>
            </Button>
            {drafts.length && onPayAll ? (
              <Button size="sm" onPress={onPayAll} className="h-9 px-3.5 bg-emerald-600">
                <Text className="text-xs font-bold text-white">
                  Bayar semua ({drafts.length}) · {formatRupiah(draftNet)}
                </Text>
              </Button>
            ) : null}
          </View>
        )}
      </View>

      {/* Table Container Selaras DataTable */}
      <View className="bg-card border-border/80 w-full overflow-hidden rounded-2xl border shadow-sm">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ minWidth: "100%", width: "100%" }}
          className="w-full"
        >
          <View className="w-full flex-1 min-w-full">
            <View className="border-border/70 bg-card/60 flex-row items-center border-b px-4 py-3.5 w-full">
              <Text style={{ flex: 1.8, minWidth: 160 }} className="text-muted-foreground text-xs font-semibold tracking-wider">Karyawan</Text>
              <Text style={{ flex: 1.2, minWidth: 130 }} className="text-muted-foreground text-xs font-semibold tracking-wider">Presensi</Text>
              <Text style={{ flex: 1.1, minWidth: 110 }} className="text-muted-foreground text-xs font-semibold tracking-wider text-right">Gaji Pokok</Text>
              <Text style={{ flex: 1.1, minWidth: 100 }} className="text-muted-foreground text-xs font-semibold tracking-wider text-right">Tunjangan</Text>
              <Text style={{ flex: 1, minWidth: 90 }} className="text-muted-foreground text-xs font-semibold tracking-wider text-right">Lembur</Text>
              <Text style={{ flex: 1.2, minWidth: 110 }} className="text-muted-foreground text-xs font-semibold tracking-wider text-right">Gross</Text>
              <Text style={{ flex: 1, minWidth: 90 }} className="text-muted-foreground text-xs font-semibold tracking-wider text-right text-warning">PPh 21</Text>
              <Text style={{ flex: 1, minWidth: 90 }} className="text-muted-foreground text-xs font-semibold tracking-wider text-right text-blue-500">BPJS</Text>
              <Text style={{ flex: 1.3, minWidth: 120 }} className="text-muted-foreground text-xs font-semibold tracking-wider text-right text-success">Net Gaji</Text>
              <Text style={{ flex: 0.9, minWidth: 90 }} className="text-muted-foreground text-xs font-semibold tracking-wider text-center">Status</Text>
              <Text style={{ width: 120 }} className="text-muted-foreground text-xs font-semibold tracking-wider text-right">Aksi</Text>
            </View>

            {loadingSlips ? (
              <View className="py-12 items-center justify-center">
                <ActivityIndicator size="small" />
              </View>
            ) : slips.length === 0 ? (
              <View className="py-12 items-center justify-center">
                <Text className="text-xs text-muted-foreground">
                  Belum ada slip gaji periode {payrollPeriod}. Isi gaji karyawan di tab Data Karyawan, lalu tekan &quot;Hitung gaji periode ini&quot;.
                </Text>
              </View>
            ) : (
              slips.map((row) => (
                <View
                  key={row.id}
                  className="border-border/60 hover:bg-panel/40 flex-row items-center border-b px-4 py-3.5 transition-colors w-full"
                >
                  <View style={{ flex: 1.8, minWidth: 160 }} className="pr-3">
                    <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                      {row.user?.name || `Karyawan #${row.userId}`}
                    </Text>
                    <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
                      {row.user?.role || "-"}
                    </Text>
                  </View>
                  <Text style={{ flex: 1.2, minWidth: 130 }} className="text-xs text-muted-foreground">
                    {row.presentDays} Hdr · {row.absentDays} Alph · {row.lateCount} Tlt
                  </Text>
                  <Text style={{ flex: 1.1, minWidth: 110 }} className="text-xs text-right text-foreground">
                    {formatRupiah(row.basicSalary)}
                  </Text>
                  <Text style={{ flex: 1.1, minWidth: 100 }} className="text-xs text-right text-foreground">
                    {formatRupiah(row.allowance)}
                  </Text>
                  <Text style={{ flex: 1, minWidth: 90 }} className="text-xs text-right text-foreground">
                    {formatRupiah(row.overtimePay)}
                  </Text>
                  <Text style={{ flex: 1.2, minWidth: 110 }} className="text-xs font-bold text-right text-foreground">
                    {formatRupiah(row.grossSalary)}
                  </Text>
                  <Text style={{ flex: 1, minWidth: 90 }} className="text-xs text-right text-warning font-semibold">
                    {formatRupiah(row.pph21)}
                  </Text>
                  <Text style={{ flex: 1, minWidth: 90 }} className="text-xs text-right text-blue-500 font-semibold">
                    {formatRupiah(row.bpjs)}
                  </Text>
                  <Text style={{ flex: 1.3, minWidth: 120 }} className="text-sm font-bold text-right text-success">
                    {formatRupiah(row.netSalary)}
                  </Text>
                  <View style={{ flex: 0.9, minWidth: 90 }} className="items-center">
                    <View
                      className={`rounded px-2.5 py-1 ${
                        row.status === "PAID"
                          ? "bg-emerald-500/10 border border-emerald-500/30"
                          : "bg-amber-500/10 border border-amber-500/30"
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          row.status === "PAID"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {row.status === "PAID" ? "DIBAYAR" : "DRAFT"}
                      </Text>
                    </View>
                  </View>
                  <View style={{ width: 120 }} className="flex-row items-center justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => setSelectedSlip(row)}
                      className="h-8 px-2.5"
                    >
                      <Text className="text-xs font-medium text-foreground">Detail</Text>
                    </Button>
                    {isFinanceOrAdmin && row.status !== "PAID" && (
                      <Button
                        size="sm"
                        onPress={() => handlePaySlip(row.id)}
                        className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Text className="text-xs font-bold text-white">Bayar</Text>
                      </Button>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

