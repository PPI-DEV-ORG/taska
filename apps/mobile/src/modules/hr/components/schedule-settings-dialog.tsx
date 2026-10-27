import React from "react";
import { View, ActivityIndicator } from "react-native";
import { Text } from "@/components/ui/text";
import { FormField } from "@/components/taska/basics";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface ScheduleSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workStartTime: string;
  setWorkStartTime: (v: string) => void;
  workEndTime: string;
  setWorkEndTime: (v: string) => void;
  lateTolerance: string;
  setLateTolerance: (v: string) => void;
  breakStartTime: string;
  setBreakStartTime: (v: string) => void;
  breakEndTime: string;
  setBreakEndTime: (v: string) => void;
  otCalculationMode: "AFTER_HOURS" | "AFTER_WORK_END";
  setOtCalculationMode: (v: "AFTER_HOURS" | "AFTER_WORK_END") => void;
  otThresholdHours: string;
  setOtThresholdHours: (v: string) => void;
  otMinMinutes: string;
  setOtMinMinutes: (v: string) => void;
  savingSchedule: boolean;
  onSave: () => void;
}

export function ScheduleSettingsDialog({
  open,
  onOpenChange,
  workStartTime,
  setWorkStartTime,
  workEndTime,
  setWorkEndTime,
  lateTolerance,
  setLateTolerance,
  breakStartTime,
  setBreakStartTime,
  breakEndTime,
  setBreakEndTime,
  otCalculationMode,
  setOtCalculationMode,
  otThresholdHours,
  setOtThresholdHours,
  otMinMinutes,
  setOtMinMinutes,
  savingSchedule,
  onSave,
}: ScheduleSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Atur Jam Kerja & Aturan Lembur</DialogTitle>
        </DialogHeader>

        <View className="gap-4 py-2">
          <View className="bg-panel border border-border/80 rounded-xl p-3.5">
            <Text className="text-xs text-muted-foreground leading-relaxed">
              Pengaturan ini digunakan oleh sistem untuk menentukan status kehadiran harian, toleransi keterlambatan, jam istirahat, serta perhitungan jam lembur karyawan secara otomatis.
            </Text>
          </View>

          {/* Jam Masuk & Jam Pulang */}
          <View className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Jam Masuk Kerja (HH:mm)" required hint="Contoh: 08:00">
              <Input
                value={workStartTime}
                onChangeText={setWorkStartTime}
                placeholder="08:00"
              />
            </FormField>

            <FormField label="Jam Pulang Kerja (HH:mm)" required hint="Contoh: 17:00">
              <Input
                value={workEndTime}
                onChangeText={setWorkEndTime}
                placeholder="17:00"
              />
            </FormField>
          </View>

          {/* Toleransi Terlambat */}
          <FormField label="Toleransi Keterlambatan (Menit)" hint="Maksimal menit keterlambatan tanpa ditandai telat">
            <Input
              value={lateTolerance}
              onChangeText={setLateTolerance}
              keyboardType="numeric"
              placeholder="15"
            />
          </FormField>

          {/* Jam Istirahat */}
          <View className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Jam Istirahat Mulai (HH:mm)" hint="Contoh: 12:00">
              <Input
                value={breakStartTime}
                onChangeText={setBreakStartTime}
                placeholder="12:00"
              />
            </FormField>

            <FormField label="Jam Istirahat Selesai (HH:mm)" hint="Contoh: 13:00">
              <Input
                value={breakEndTime}
                onChangeText={setBreakEndTime}
                placeholder="13:00"
              />
            </FormField>
          </View>

          {/* Konfigurasi Lembur */}
          <View className="bg-card border-border/80 rounded-xl border p-4 shadow-sm gap-3">
            <Text className="text-sm font-bold text-foreground">Konfigurasi Perhitungan Lembur</Text>

            <FormField label="Mode Perhitungan Lembur">
              <View className="flex-row flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  variant={otCalculationMode === "AFTER_HOURS" ? "default" : "outline"}
                  onPress={() => setOtCalculationMode("AFTER_HOURS")}
                  className="h-9 px-3"
                >
                  <Text
                    className={`text-xs font-semibold ${
                      otCalculationMode === "AFTER_HOURS" ? "text-white" : "text-foreground"
                    }`}
                  >
                    Setelah Durasi Jam Kerja
                  </Text>
                </Button>
                <Button
                  size="sm"
                  variant={otCalculationMode === "AFTER_WORK_END" ? "default" : "outline"}
                  onPress={() => setOtCalculationMode("AFTER_WORK_END")}
                  className="h-9 px-3"
                >
                  <Text
                    className={`text-xs font-semibold ${
                      otCalculationMode === "AFTER_WORK_END" ? "text-white" : "text-foreground"
                    }`}
                  >
                    Setelah Jam Pulang Kerja
                  </Text>
                </Button>
              </View>
            </FormField>

            <View className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                label="Lembur Terhitung Setelah (Jam)"
                hint="Minimal total durasi kerja sebelum lembur dihitung (default: 8 jam)"
              >
                <Input
                  value={otThresholdHours}
                  onChangeText={setOtThresholdHours}
                  keyboardType="numeric"
                  placeholder="8"
                />
              </FormField>

              <FormField
                label="Minimal Durasi Lembur (Menit)"
                hint="Lembur di bawah durasi ini tidak dihitung (default: 30 menit)"
              >
                <Input
                  value={otMinMinutes}
                  onChangeText={setOtMinMinutes}
                  keyboardType="numeric"
                  placeholder="30"
                />
              </FormField>
            </View>
          </View>
        </View>

        <DialogFooter className="flex-row justify-end gap-2 pt-2">
          <Button variant="outline" onPress={() => onOpenChange(false)}>
            <Text className="text-xs font-semibold">Batal</Text>
          </Button>
          <Button onPress={onSave} disabled={savingSchedule}>
            {savingSchedule ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text className="text-xs font-bold text-white">Simpan Pengaturan</Text>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

