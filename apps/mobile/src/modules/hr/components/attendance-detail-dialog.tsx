import React from "react";
import { View, ActivityIndicator } from "react-native";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface AttendanceDetailDialogProps {
  selectedAttendance: any;
  setSelectedAttendance: (att: any) => void;
  isSuperAdminOrBos: boolean;
  editAttOtHours: string;
  setEditAttOtHours: (v: string) => void;
  handleUpdateAttendanceRecord: () => void;
  savingAttDetail: boolean;
}

export function AttendanceDetailDialog({
  selectedAttendance,
  setSelectedAttendance,
  isSuperAdminOrBos,
  editAttOtHours,
  setEditAttOtHours,
  handleUpdateAttendanceRecord,
  savingAttDetail,
}: AttendanceDetailDialogProps) {
  return (
    <Dialog open={!!selectedAttendance} onOpenChange={(open) => { if (!open) setSelectedAttendance(null); }}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detail Presensi Karyawan</DialogTitle>
        </DialogHeader>

        {selectedAttendance && (
          <View className="gap-4 py-2">
            <View className="bg-panel border border-border/80 rounded-xl p-4 flex-row flex-wrap items-center justify-between gap-3">
              <View className="gap-0.5">
                <Text className="text-base font-bold text-foreground">
                  {selectedAttendance.user?.name || `Karyawan #${selectedAttendance.userId}`}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {selectedAttendance.user?.role || "-"} · {selectedAttendance.user?.email || "-"}
                </Text>
                <Text className="text-xs font-medium text-foreground mt-1">
                  Tanggal: {selectedAttendance.date ? String(selectedAttendance.date).slice(0, 10) : "-"}
                </Text>
              </View>

              <View
                className={`rounded-lg px-3 py-1.5 ${
                  selectedAttendance.status === "HADIR"
                    ? "bg-emerald-500/10 border border-emerald-500/30"
                    : selectedAttendance.status === "ALPHA"
                    ? "bg-red-500/10 border border-red-500/30"
                    : "bg-amber-500/10 border border-amber-500/30"
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    selectedAttendance.status === "HADIR"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : selectedAttendance.status === "ALPHA"
                      ? "text-red-600 dark:text-red-400"
                      : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  Status: {selectedAttendance.status}
                </Text>
              </View>
            </View>

            {/* KPI Boxes */}
            <View className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <View className="bg-card border-border/80 rounded-xl border p-3.5 shadow-sm">
                <Text className="text-muted-foreground text-xs font-medium">Jam Masuk (Check-In)</Text>
                <Text className="text-foreground text-lg font-bold mt-1">
                  {selectedAttendance.checkIn
                    ? new Date(selectedAttendance.checkIn).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "--:--"}
                </Text>
                <Text className="text-muted-foreground text-[11px] mt-0.5">
                  {selectedAttendance.checkIn
                    ? new Date(selectedAttendance.checkIn).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "Belum check-in"}
                </Text>
              </View>

              <View className="bg-card border-border/80 rounded-xl border p-3.5 shadow-sm">
                <Text className="text-muted-foreground text-xs font-medium">Jam Pulang (Check-Out)</Text>
                <Text className="text-foreground text-lg font-bold mt-1">
                  {selectedAttendance.checkOut
                    ? new Date(selectedAttendance.checkOut).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "--:--"}
                </Text>
                <Text className="text-muted-foreground text-[11px] mt-0.5">
                  {selectedAttendance.checkOut
                    ? new Date(selectedAttendance.checkOut).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "Belum check-out"}
                </Text>
              </View>

              <View className="bg-card border-border/80 rounded-xl border p-3.5 shadow-sm">
                <Text className="text-muted-foreground text-xs font-medium">Jam Lembur</Text>
                <Text className="text-primary text-lg font-bold mt-1">
                  {Number(selectedAttendance.overtimeHours) > 0 ? `${selectedAttendance.overtimeHours} Jam` : "0 Jam"}
                </Text>
                <Text className="text-muted-foreground text-[11px] mt-0.5">Dihitung otomatis</Text>
              </View>
            </View>

            {/* Catatan / Keterangan Lengkap */}
            <View className="bg-card border-border/80 rounded-xl border p-4 shadow-sm gap-2">
              <Text className="text-xs font-bold text-foreground">Catatan / Keterangan Lengkap</Text>
              <View className="rounded-lg bg-panel/60 border border-border/60 p-3.5 min-h-[90px]">
                <Text className="text-xs leading-relaxed text-foreground select-text">
                  {selectedAttendance.notes || "Tidak ada catatan untuk presensi ini."}
                </Text>
              </View>
            </View>

            {/* Atur Jam Lembur Khusus Super Admin & Bos */}
            {isSuperAdminOrBos && (
              <View className="bg-card border-border/80 rounded-xl border p-4 shadow-sm gap-3">
                <Text className="text-xs font-bold text-foreground">
                  Koreksi / Atur Jam Lembur (Super Admin & Bos)
                </Text>
                <View className="flex-row items-center gap-3">
                  <View className="flex-1">
                    <Input
                      value={editAttOtHours}
                      onChangeText={setEditAttOtHours}
                      keyboardType="numeric"
                      placeholder="0"
                    />
                  </View>
                  <Button
                    onPress={handleUpdateAttendanceRecord}
                    disabled={savingAttDetail}
                    className="h-10 px-4"
                  >
                    {savingAttDetail ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text className="text-xs font-bold text-white">Simpan Jam Lembur</Text>
                    )}
                  </Button>
                </View>
                <Text className="text-[11px] text-muted-foreground">
                  Super admin & Bos dapat mengubah jam lembur secara langsung untuk presensi ini.
                </Text>
              </View>
            )}
          </View>
        )}

        <DialogFooter className="flex-row justify-end pt-2">
          <Button variant="outline" onPress={() => setSelectedAttendance(null)}>
            <Text className="text-xs font-semibold">Tutup</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

