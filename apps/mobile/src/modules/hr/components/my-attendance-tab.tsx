import React from "react";
import { View, ActivityIndicator } from "react-native";
import { Text } from "@/components/ui/text";
import { Clock, CheckCircle2 } from "lucide-react-native";
import { colors } from "@/tokens";
import { Panel, FormField } from "@/components/taska/basics";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface MyAttendanceTabProps {
  todayAtt: any;
  loadingToday: boolean;
  submittingAtt: boolean;
  checkInNote: string;
  setCheckInNote: (v: string) => void;
  checkOutNote: string;
  setCheckOutNote: (v: string) => void;
  handleCheckIn: () => void;
  handleCheckOut: () => void;
}

export function MyAttendanceTab({
  todayAtt,
  loadingToday,
  submittingAtt,
  checkInNote,
  setCheckInNote,
  checkOutNote,
  setCheckOutNote,
  handleCheckIn,
  handleCheckOut,
}: MyAttendanceTabProps) {
  return (
    <View className="gap-5 w-full">
      <Panel
        title="Presensi Kehadiran Hari Ini"
        subtitle={new Date().toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        right={
          <View className="rounded-full bg-primary/10 border border-primary/20 px-3 py-1">
            <Text className="text-xs font-semibold text-primary">
              Status: {todayAtt?.status || "Belum Absen"}
            </Text>
          </View>
        }
      >
        {loadingToday ? (
          <View className="py-8 items-center justify-center">
            <ActivityIndicator size="small" />
          </View>
        ) : (
          <View className="gap-4">
            {/* KPI Boxes */}
            <View className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
              <View className="bg-card border-border/80 rounded-2xl border p-4 shadow-sm">
                <Text className="text-muted-foreground text-xs font-medium">Jam Masuk (Check-In)</Text>
                <Text className="text-foreground text-lg md:text-xl font-bold mt-1">
                  {todayAtt?.checkIn
                    ? new Date(todayAtt.checkIn).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "--:--"}
                </Text>
                <Text className="text-muted-foreground text-[11px] mt-0.5">Waktu check-in sistem</Text>
              </View>

              <View className="bg-card border-border/80 rounded-2xl border p-4 shadow-sm">
                <Text className="text-muted-foreground text-xs font-medium">Jam Pulang (Check-Out)</Text>
                <Text className="text-foreground text-lg md:text-xl font-bold mt-1">
                  {todayAtt?.checkOut
                    ? new Date(todayAtt.checkOut).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "--:--"}
                </Text>
                <Text className="text-muted-foreground text-[11px] mt-0.5">Waktu selesai kerja</Text>
              </View>

              <View className="bg-card border-border/80 rounded-2xl border p-4 shadow-sm">
                <Text className="text-muted-foreground text-xs font-medium">Jam Lembur</Text>
                <Text className="text-primary text-lg md:text-xl font-bold mt-1">
                  {todayAtt?.overtimeHours ? `${todayAtt.overtimeHours} Jam` : "0 Jam"}
                </Text>
                <Text className="text-muted-foreground text-[11px] mt-0.5">Dihitung otomatis / input</Text>
              </View>
            </View>

            {/* Form Action */}
            {!todayAtt?.checkIn ? (
              <View className="rounded-xl border border-primary/20 bg-primary/5 p-4 gap-3">
                <FormField label="Catatan Check-In (Opsional)" hint="Lokasi kerja, dinas, atau informasi penting lainnya">
                  <Input
                    value={checkInNote}
                    onChangeText={setCheckInNote}
                    placeholder="Contoh: Kantor pusat, site project..."
                  />
                </FormField>
                <Button
                  disabled={submittingAtt}
                  onPress={handleCheckIn}
                  className="w-full gap-2 h-10"
                >
                  <Clock size={16} color="#FFFFFF" />
                  <Text className="text-sm font-bold text-white">
                    {submittingAtt ? "Memproses..." : "Absen Masuk Sekarang"}
                  </Text>
                </Button>
              </View>
            ) : !todayAtt?.checkOut ? (
              <View className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 gap-3">
                <FormField label="Catatan Check-Out & Laporan Hari Ini" hint="Ringkasan tugas atau kendala hari ini">
                  <Input
                    value={checkOutNote}
                    onChangeText={setCheckOutNote}
                    placeholder="Pekerjaan selesai, laporan serah terima..."
                  />
                </FormField>
                <Button
                  disabled={submittingAtt}
                  onPress={handleCheckOut}
                  className="w-full gap-2 h-10 bg-amber-600 hover:bg-amber-700"
                >
                  <CheckCircle2 size={16} color="#FFFFFF" />
                  <Text className="text-sm font-bold text-white">
                    {submittingAtt ? "Memproses..." : "Absen Pulang (Check-Out)"}
                  </Text>
                </Button>
              </View>
            ) : (
              <View className="flex-row items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <CheckCircle2 size={24} color={colors.success} />
                <View>
                  <Text className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    Presensi Hari Ini Telah Lengkap!
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Data kehadiran Anda hari ini telah tersimpan dalam sistem.
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}
      </Panel>
    </View>
  );
}

