import * as React from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { colors } from "@/tokens";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import {
  CalendarClock,
  X,
  CheckCircle2,
} from "lucide-react-native";
import type { MigrationSchedule, StorageProviderItem } from "./types";

export function ScheduleDialog({
  visible,
  onClose,
  onSuccess,
  providers,
  scheduleToEdit,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  providers: StorageProviderItem[];
  scheduleToEdit?: MigrationSchedule | null;
}) {
  return (
    <ScheduleDialogForm
      key={`${visible}-${scheduleToEdit?.id ?? "new"}-${providers.map((provider) => provider.id).join(",")}`}
      visible={visible}
      onClose={onClose}
      onSuccess={onSuccess}
      providers={providers}
      scheduleToEdit={scheduleToEdit}
    />
  );
}

function ScheduleDialogForm({
  visible,
  onClose,
  onSuccess,
  providers,
  scheduleToEdit,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  providers: StorageProviderItem[];
  scheduleToEdit?: MigrationSchedule | null;
}) {
  const { toast } = useApp();

  const local = providers.find((p) => p.type === "LOCAL") ?? providers[0];
  const nonLocal = providers.find((p) => p.id !== local?.id);
  const [name, setName] = React.useState(scheduleToEdit?.name || (scheduleToEdit ? "" : "Migrasi Rutin ke Penyimpanan Eksternal"));
  const [sourceId, setSourceId] = React.useState<number>(scheduleToEdit?.sourceProviderId ?? local?.id ?? 0);
  const [targetId, setTargetId] = React.useState<number>(scheduleToEdit?.targetProviderId ?? nonLocal?.id ?? 0);
  const [everyDays, setEveryDays] = React.useState<number>(scheduleToEdit?.everyDays || 3);
  const [runAtTime, setRunAtTime] = React.useState<string>(scheduleToEdit?.runAtTime || "02:00");
  const [olderThanDays, setOlderThanDays] = React.useState<string>(scheduleToEdit?.olderThanDays ? String(scheduleToEdit.olderThanDays) : "");
  const [enabled, setEnabled] = React.useState<boolean>(scheduleToEdit?.enabled ?? true);
  const [submitting, setSubmitting] = React.useState(false);

  const handleSave = async () => {
    if (!sourceId || !targetId) {
      toast("Pilih penyimpanan sumber dan tujuan", "danger");
      return;
    }
    if (sourceId === targetId) {
      toast("Penyimpanan sumber dan tujuan tidak boleh sama", "danger");
      return;
    }

    setSubmitting(true);
    try {
      if (scheduleToEdit) {
        await api.patch(`/file-management/schedules/${scheduleToEdit.id}`, {
          name: name.trim() || undefined,
          sourceProviderId: sourceId,
          targetProviderId: targetId,
          everyDays: Number(everyDays),
          runAtTime: runAtTime.trim() || "02:00",
          olderThanDays: olderThanDays ? Number(olderThanDays) : null,
          enabled,
        });
        toast("Jadwal migrasi otomatis berhasil diperbarui.", "success");
      } else {
        await api.post("/file-management/schedules", {
          name: name.trim() || undefined,
          sourceProviderId: sourceId,
          targetProviderId: targetId,
          everyDays: Number(everyDays),
          runAtTime: runAtTime.trim() || "02:00",
          olderThanDays: olderThanDays ? Number(olderThanDays) : undefined,
          enabled,
        });
        toast("Jadwal migrasi otomatis baru berhasil ditambahkan!", "success");
      }
      onSuccess();
      onClose();
    } catch (e) {
      toast((e as Error).message, "danger");
    } finally {
      setSubmitting(false);
    }
  };

  const PRESETS = [
    { days: 3, label: "3 Hari Sekali" },
    { days: 5, label: "5 Hari Sekali" },
    { days: 7, label: "1 Minggu Sekali" },
    { days: 14, label: "2 Minggu Sekali" },
    { days: 30, label: "1 Bulan Sekali" },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/60 p-2 sm:p-4">
        <View className="max-h-[90vh] w-[96vw] max-w-lg rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-2xl">
          {/* Header */}
          <View className="mb-4 flex-row items-center justify-between border-b border-border pb-3 pr-1">
            <View className="flex-1 min-w-0 mr-3 flex-row items-center gap-2.5">
              <View className="rounded-xl p-2 shrink-0" style={{ backgroundColor: `${colors.primary}1A` }}>
                <CalendarClock size={20} color={colors.primary} />
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-base font-bold text-foreground" numberOfLines={1}>
                  {scheduleToEdit ? "Edit Jadwal Migrasi" : "Jadwal Migrasi Otomatis"}
                </Text>
                <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                  Pindahkan berkas secara periodik sesuai interval
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={12} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted shrink-0">
              <X size={20} />
            </Pressable>
          </View>

          <ScrollView className="space-y-4" showsVerticalScrollIndicator={false}>
            {/* Nama Jadwal */}
            <View className="gap-1">
              <Text className="text-xs font-semibold text-foreground">Nama / Label Jadwal</Text>
              <Input
                placeholder="Contoh: Migrasi Otomatis ke MinIO"
                value={name}
                onChangeText={setName}
              />
            </View>

            {/* Sumber & Tujuan */}
            <View className="flex-row gap-2">
              <View className="flex-1 gap-1">
                <Text className="text-xs font-semibold text-foreground">Penyimpanan Sumber</Text>
                <View className="gap-1.5">
                  {providers.map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => setSourceId(p.id)}
                      className="rounded-lg border p-2"
                      style={{
                        borderColor: sourceId === p.id ? colors.primary : "transparent",
                        backgroundColor: sourceId === p.id ? `${colors.primary}14` : "rgba(0,0,0,0.03)",
                      }}
                    >
                      <Text className="text-xs font-medium text-foreground">{p.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View className="flex-1 gap-1">
                <Text className="text-xs font-semibold text-foreground">Penyimpanan Tujuan</Text>
                <View className="gap-1.5">
                  {providers
                    .filter((p) => p.id !== sourceId)
                    .map((p) => (
                      <Pressable
                        key={p.id}
                        onPress={() => setTargetId(p.id)}
                        className="rounded-lg border p-2"
                        style={{
                          borderColor: targetId === p.id ? colors.primary : "transparent",
                          backgroundColor: targetId === p.id ? `${colors.primary}14` : "rgba(0,0,0,0.03)",
                        }}
                      >
                        <Text className="text-xs font-medium text-foreground">{p.name}</Text>
                      </Pressable>
                    ))}
                </View>
              </View>
            </View>

            {/* Interval Waktu */}
            <View className="gap-1.5">
              <Text className="text-xs font-semibold text-foreground">Frekuensi / Interval Berulang</Text>
              <View className="flex-row flex-wrap gap-1.5">
                {PRESETS.map((item) => (
                  <Pressable
                    key={item.days}
                    onPress={() => setEveryDays(item.days)}
                    className="rounded-lg border px-2.5 py-1.5"
                    style={{
                      borderColor: everyDays === item.days ? colors.primary : "transparent",
                      backgroundColor: everyDays === item.days ? `${colors.primary}14` : "rgba(0,0,0,0.04)",
                    }}
                  >
                    <Text
                      className="text-xs font-semibold"
                      style={{ color: everyDays === item.days ? colors.primary : undefined }}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Jam Eksekusi (WIB) */}
            <View className="flex-row gap-2">
              <View className="flex-1 gap-1">
                <Text className="text-xs font-semibold text-foreground">Jam Eksekusi (WIB)</Text>
                <Input
                  placeholder="02:00"
                  value={runAtTime}
                  onChangeText={setRunAtTime}
                />
                <Text className="text-[10px] text-muted-foreground">Format 24 jam (misal 02:00)</Text>
              </View>

              <View className="flex-1 gap-1">
                <Text className="text-xs font-semibold text-foreground">Filter Umur Berkas</Text>
                <Input
                  placeholder="Opsional (misal: 3)"
                  value={olderThanDays}
                  onChangeText={setOlderThanDays}
                  keyboardType="numeric"
                />
                <Text className="text-[10px] text-muted-foreground">Hari lebih tua</Text>
              </View>
            </View>

            {/* Toggle Status Aktif */}
            <Pressable
              onPress={() => setEnabled(!enabled)}
              className="flex-row items-center gap-2.5 rounded-xl border border-border p-3"
            >
              <View
                className="h-4 w-4 rounded border items-center justify-center"
                style={{
                  backgroundColor: enabled ? colors.primary : "transparent",
                  borderColor: enabled ? colors.primary : "#94A3B8",
                }}
              >
                {enabled ? <CheckCircle2 size={12} color="#FFF" /> : null}
              </View>
              <View className="flex-1">
                <Text className="text-xs font-semibold text-foreground">Aktifkan Jadwal Ini</Text>
                <Text className="text-[11px] text-muted-foreground">
                  Scheduler akan mengeksekusi migrasi otomatis saat jam target tercapai.
                </Text>
              </View>
            </Pressable>
          </ScrollView>

          {/* Footer */}
          <View className="mt-4 flex-row justify-end gap-2 border-t border-border pt-3">
            <Button variant="ghost" size="sm" onPress={onClose} disabled={submitting}>
              <Text>Batal</Text>
            </Button>
            <Button
              size="sm"
              onPress={handleSave}
              disabled={submitting || !sourceId || !targetId}
              style={{ backgroundColor: colors.primary }}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text className="text-white font-semibold">Simpan Jadwal</Text>
              )}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}
