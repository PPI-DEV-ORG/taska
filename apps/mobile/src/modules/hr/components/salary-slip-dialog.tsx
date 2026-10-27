import React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatRupiah } from "../types";

interface SalarySlipDialogProps {
  selectedSlip: any;
  setSelectedSlip: (slip: any) => void;
  isFinanceOrAdmin: boolean;
  handlePaySlip: (id: string | number) => void;
}

export function SalarySlipDialog({
  selectedSlip,
  setSelectedSlip,
  isFinanceOrAdmin,
  handlePaySlip,
}: SalarySlipDialogProps) {
  return (
    <Dialog open={!!selectedSlip} onOpenChange={(open) => { if (!open) setSelectedSlip(null); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Detail Slip Gaji Karyawan</DialogTitle>
        </DialogHeader>

        {selectedSlip && (
          <View className="gap-3 py-2">
            <View className="bg-panel border border-border/80 rounded-lg p-3">
              <Text className="text-sm font-bold text-foreground">{selectedSlip.user?.name}</Text>
              <Text className="text-xs text-muted-foreground">
                Periode: {selectedSlip.period} · {selectedSlip.user?.role || "-"}
              </Text>
              <View className="mt-1 flex-row items-center gap-2">
                <View
                  className={`rounded px-2 py-0.5 ${
                    selectedSlip.status === "PAID"
                      ? "bg-emerald-500/10 border border-emerald-500/30"
                      : "bg-amber-500/10 border border-amber-500/30"
                  }`}
                >
                  <Text
                    className={`text-[10px] font-bold ${
                      selectedSlip.status === "PAID"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {selectedSlip.status === "PAID" ? "SUDAH DIBAYAR" : "DRAFT"}
                  </Text>
                </View>
                {selectedSlip.paidAt ? (
                  <Text className="text-[10px] text-muted-foreground">
                    Dibayar pada: {String(selectedSlip.paidAt).slice(0, 10)}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Penghasilan (Earnings) */}
            <View className="gap-1.5 rounded-lg border border-border bg-panel/40 p-3">
              <Text className="text-xs font-bold text-foreground mb-1">Rincian Penghasilan (Earnings)</Text>
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted-foreground">Gaji Pokok</Text>
                <Text className="text-xs font-medium text-foreground">
                  {formatRupiah(selectedSlip.basicSalary)}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted-foreground">Tunjangan Tetap</Text>
                <Text className="text-xs font-medium text-foreground">
                  {formatRupiah(selectedSlip.allowance)}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted-foreground">Upah Lembur</Text>
                <Text className="text-xs font-medium text-foreground">
                  {formatRupiah(selectedSlip.overtimePay)}
                </Text>
              </View>
              <View className="mt-1 border-t border-border pt-1 flex-row justify-between">
                <Text className="text-xs font-bold text-foreground">Total Penghasilan Bruto</Text>
                <Text className="text-xs font-bold text-foreground">
                  {formatRupiah(selectedSlip.grossSalary)}
                </Text>
              </View>
            </View>

            {/* Potongan (Deductions) */}
            <View className="gap-1.5 rounded-lg border border-border bg-panel/40 p-3">
              <Text className="text-xs font-bold text-foreground mb-1">Rincian Potongan (Deductions)</Text>
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted-foreground">Potongan Absensi (Alpha)</Text>
                <Text className="text-xs font-medium text-danger">
                  -{formatRupiah(selectedSlip.absentDeduct)}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted-foreground">Pajak Penghasilan (PPh 21 TER)</Text>
                <Text className="text-xs font-medium text-warning">
                  -{formatRupiah(selectedSlip.pph21)}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted-foreground">Iuran BPJS Karyawan (3%)</Text>
                <Text className="text-xs font-medium text-blue-500">
                  -{formatRupiah(selectedSlip.bpjs)}
                </Text>
              </View>
            </View>

            {/* Take Home Pay */}
            <View className="flex-row items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3.5">
              <Text className="text-xs font-bold text-foreground">GAJI BERSIH (TAKE HOME PAY)</Text>
              <Text className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                {formatRupiah(selectedSlip.netSalary)}
              </Text>
            </View>
          </View>
        )}

        <DialogFooter className="flex-row justify-between gap-2 pt-2">
          <Button variant="outline" onPress={() => setSelectedSlip(null)}>
            <Text className="text-xs font-semibold">Tutup</Text>
          </Button>

          {isFinanceOrAdmin && selectedSlip?.status !== "PAID" && (
            <Button
              onPress={() => handlePaySlip(selectedSlip.id)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Text className="text-xs font-bold text-white">Tandai Sudah Dibayar</Text>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

