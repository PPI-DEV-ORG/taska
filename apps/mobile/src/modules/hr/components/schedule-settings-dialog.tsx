import React from "react";
import { View, ActivityIndicator, Pressable } from "react-native";
import { Text } from "@/components/ui/text";
import { MapPin, Check } from "lucide-react-native";
import { colors } from "@/tokens";
import { FormField } from "@/components/akuntra/basics";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { captureCurrentGps } from "@/utils/gps-location";
import { useApp } from "@/store/app-store";
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
  officeName: string;
  setOfficeName: (v: string) => void;
  officeLatitude: string;
  setOfficeLatitude: (v: string) => void;
  officeLongitude: string;
  setOfficeLongitude: (v: string) => void;
  officeRadiusMeters: string;
  setOfficeRadiusMeters: (v: string) => void;
  requirePhotoOnAttendance: boolean;
  setRequirePhotoOnAttendance: (v: boolean) => void;
  requireGpsOnAttendance: boolean;
  setRequireGpsOnAttendance: (v: boolean) => void;
  fieldRolesText: string;
  setFieldRolesText: (v: string) => void;
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
  officeName,
  setOfficeName,
  officeLatitude,
  setOfficeLatitude,
  officeLongitude,
  setOfficeLongitude,
  officeRadiusMeters,
  setOfficeRadiusMeters,
  requirePhotoOnAttendance,
  setRequirePhotoOnAttendance,
  requireGpsOnAttendance,
  setRequireGpsOnAttendance,
  fieldRolesText,
  setFieldRolesText,
  savingSchedule,
  onSave,
}: ScheduleSettingsDialogProps) {
  const { toast } = useApp();
  const [locating, setLocating] = React.useState(false);

  const handleUseCurrentLocation = async () => {
    try {
      setLocating(true);
      const snap = await captureCurrentGps();
      setOfficeLatitude(snap.latitude.toFixed(6));
      setOfficeLongitude(snap.longitude.toFixed(6));
      toast("Koordinat lokasi saat ini berhasil diisi sebagai lokasi kantor", "success");
    } catch (e: any) {
      toast(e?.message || "Gagal mengambil lokasi GPS saat ini", "danger");
    } finally {
      setLocating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-xl md:max-w-2xl max-h-[90vh] p-4 sm:p-6 overflow-y-auto">
        <DialogHeader className="pr-8">
          <DialogTitle>Atur Jam Kerja, Lokasi GPS & Lembur</DialogTitle>
        </DialogHeader>

        <View className="gap-4 py-2">
          <View className="bg-panel border border-border/80 rounded-xl p-3.5">
            <Text className="text-xs text-muted-foreground leading-relaxed">
              Pengaturan ini digunakan oleh sistem untuk menentukan status kehadiran harian, toleransi keterlambatan, validasi lokasi kantor (GPS geofence), kewajiban foto langsung, serta perhitungan lembur otomatis.
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

          {/* Lokasi Kantor & Validasi GPS / Foto */}
          <View className="bg-card border-border/80 rounded-xl border p-4 shadow-sm gap-3">
            <View className="flex-row items-center justify-between gap-2 flex-wrap">
              <Text className="text-sm font-bold text-foreground">
                Lokasi Kantor (Geofence GPS) & Foto Langsung
              </Text>
              <Button
                size="sm"
                variant="outline"
                disabled={locating}
                onPress={() => void handleUseCurrentLocation()}
                className="h-8 px-2.5 gap-1.5"
              >
                {locating ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <MapPin size={13} color={colors.primary} />
                )}
                <Text className="text-xs font-semibold text-primary">
                  Gunakan Lokasi Saya
                </Text>
              </Button>
            </View>

            <View className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Nama Lokasi Kantor">
                <Input
                  value={officeName}
                  onChangeText={setOfficeName}
                  placeholder="Kantor Pusat"
                />
              </FormField>

              <FormField label="Radius Area Kantor (Meter)" hint="Default: 150 meter">
                <Input
                  value={officeRadiusMeters}
                  onChangeText={setOfficeRadiusMeters}
                  keyboardType="numeric"
                  placeholder="150"
                />
              </FormField>
            </View>

            <View className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Latitude Kantor" hint="Kosongkan jika tanpa geofence">
                <Input
                  value={officeLatitude}
                  onChangeText={setOfficeLatitude}
                  placeholder="-6.200000"
                />
              </FormField>

              <FormField label="Longitude Kantor" hint="Kosongkan jika tanpa geofence">
                <Input
                  value={officeLongitude}
                  onChangeText={setOfficeLongitude}
                  placeholder="106.816666"
                />
              </FormField>
            </View>

            <FormField
              label="Role Lapangan / Dinas Luar (pisahkan dengan koma)"
              hint="Role ini diperbolehkan absen di luar radius kantor tanpa ditandai Perlu Verifikasi"
            >
              <Input
                value={fieldRolesText}
                onChangeText={setFieldRolesText}
                placeholder="teknisi, sales, driver, lapangan, super_admin, bos"
              />
            </FormField>

            <View className="gap-2 pt-1">
              <Pressable
                onPress={() => setRequirePhotoOnAttendance(!requirePhotoOnAttendance)}
                className="flex-row items-center gap-2.5"
              >
                <View
                  className={`w-5 h-5 rounded border items-center justify-center ${
                    requirePhotoOnAttendance ? "bg-primary border-primary" : "border-border bg-panel"
                  }`}
                >
                  {requirePhotoOnAttendance && <Check size={13} color="#FFFFFF" />}
                </View>
                <Text className="text-xs font-medium text-foreground">
                  Wajib foto langsung dari kamera saat Check-In & Check-Out
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setRequireGpsOnAttendance(!requireGpsOnAttendance)}
                className="flex-row items-center gap-2.5"
              >
                <View
                  className={`w-5 h-5 rounded border items-center justify-center ${
                    requireGpsOnAttendance ? "bg-primary border-primary" : "border-border bg-panel"
                  }`}
                >
                  {requireGpsOnAttendance && <Check size={13} color="#FFFFFF" />}
                </View>
                <Text className="text-xs font-medium text-foreground">
                  Wajib lokasi GPS aktif saat Check-In & Check-Out
                </Text>
              </Pressable>
            </View>
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
