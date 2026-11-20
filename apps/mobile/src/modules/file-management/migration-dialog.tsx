import * as React from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { colors } from "@/tokens";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import {
  ArrowRightLeft,
  X,
  ShieldCheck,
  CheckCircle2,
  Folder,
  FolderOpen,
  Calendar,
} from "lucide-react-native";
import { formatBytes } from "./file-ui";
import type { StorageProviderItem } from "./types";

const SUBFOLDER_OPTIONS = [
  { key: "all", label: "Semua Folder (Semua Modul)" },
  { key: "penawaran", label: "Penawaran" },
  { key: "invoice", label: "Faktur & Tagihan" },
  { key: "surat-jalan", label: "Surat Jalan" },
  { key: "foto-struk", label: "Foto Struk & Biaya" },
  { key: "penerimaan", label: "Penerimaan Barang" },
  { key: "request-barang", label: "Permintaan Barang" },
  { key: "foto-dokumen", label: "Foto Dokumen" },
  { key: "dokumentasi-proyek", label: "Dokumentasi Proyek" },
  { key: "survey", label: "Laporan Survey" },
  { key: "laporan-kerusakan", label: "Laporan Kerusakan" },
  { key: "foto-profil", label: "Foto Profil" },
  { key: "video", label: "Video" },
  { key: "dokumen", label: "Dokumen Umum" },
  { key: "2026", label: "Arsip 2026" },
];

const AGE_FILTER_PRESETS = [
  { days: "", label: "Semua Umur" },
  { days: "3", label: "> 3 Hari" },
  { days: "7", label: "> 7 Hari" },
  { days: "14", label: "> 14 Hari" },
  { days: "30", label: "> 30 Hari" },
  { days: "90", label: "> 90 Hari" },
];

export function MigrationDialog({
  visible,
  onClose,
  onSuccess,
  providers,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  providers: StorageProviderItem[];
}) {
  const { toast } = useApp();

  const [selectedSourceId, setSelectedSourceId] = React.useState<number>(0);
  const [selectedTargetId, setSelectedTargetId] = React.useState<number>(0);
  const localProvider = providers.find((p) => p.type === "LOCAL") ?? providers[0];
  const sourceId = providers.some((p) => p.id === selectedSourceId)
    ? selectedSourceId
    : localProvider?.id ?? 0;
  const targetId = providers.some((p) => p.id === selectedTargetId && p.id !== sourceId)
    ? selectedTargetId
    : providers.find((p) => p.id !== sourceId)?.id ?? 0;

  const [selectedFolder, setSelectedFolder] = React.useState<string>("all");
  const [olderThanDays, setOlderThanDays] = React.useState<string>("");
  const [submitting, setSubmitting] = React.useState(false);

  // Live preview state
  const [preview, setPreview] = React.useState<{
    eligibleFilesCount: number;
    eligibleTotalBytes: number;
    excludedOrphansCount: number;
    sampleFiles: Array<{ id: number; name: string; size: number }>;
  } | null>(null);
  const [loadingPreview, setLoadingPreview] = React.useState(false);

  const handleClose = () => {
    setOlderThanDays("");
    setSelectedFolder("all");
    setPreview(null);
    onClose();
  };

  const fetchPreview = React.useCallback(async () => {
    if (!sourceId || !visible) return;
    setLoadingPreview(true);
    try {
      const params = new URLSearchParams();
      params.append("sourceProviderId", String(sourceId));
      if (targetId && targetId !== sourceId) params.append("targetProviderId", String(targetId));
      if (selectedFolder && selectedFolder !== "all") params.append("folder", selectedFolder);
      if (olderThanDays) params.append("olderThanDays", olderThanDays);

      const res = await api.get<any>(`/file-management/migrations/preview?${params.toString()}`);
      setPreview(res || {
        eligibleFilesCount: 0,
        eligibleTotalBytes: 0,
        excludedOrphansCount: 0,
        sampleFiles: [],
      });
    } catch {
      setPreview({
        eligibleFilesCount: 0,
        eligibleTotalBytes: 0,
        excludedOrphansCount: 0,
        sampleFiles: [],
      });
    } finally {
      setLoadingPreview(false);
    }
  }, [sourceId, targetId, selectedFolder, olderThanDays, visible]);

  React.useEffect(() => {
    if (visible && sourceId) {
      const timer = setTimeout(() => {
        fetchPreview();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [fetchPreview, visible, sourceId]);

  const handleStartMigration = async () => {
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
      await api.post("/file-management/migrations", {
        sourceProviderId: sourceId,
        targetProviderId: targetId,
        folder: selectedFolder !== "all" ? selectedFolder : undefined,
        olderThanDays: olderThanDays ? Number(olderThanDays) : undefined,
        includeOrphans: false, // Berkas lepas tidak ikut dimigrasikan
      });
      toast("Job migrasi telah dimulai di latar belakang!", "success");
      onSuccess();
      handleClose();
    } catch (e) {
      toast((e as Error).message, "danger");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View className="flex-1 items-center justify-center bg-black/60 p-2 sm:p-4">
        <View className="max-h-[92vh] w-[96vw] max-w-xl rounded-3xl border border-border bg-card p-4 sm:p-6 shadow-2xl">
          {/* Header - Tombol X diberikan ruang cukup agar tidak terpotong */}
          <View className="mb-4 flex-row items-center justify-between border-b border-border pb-3">
            <View className="flex-row items-center gap-2.5 flex-1 pr-3">
              <View className="rounded-xl p-2 shrink-0" style={{ backgroundColor: `${colors.primary}1A` }}>
                <ArrowRightLeft size={20} color={colors.primary} />
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-foreground" numberOfLines={1}>
                  Migrasi Berkas Sekarang
                </Text>
                <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                  Pindahkan berkas dari satu penyimpanan ke penyimpanan lainnya
                </Text>
              </View>
            </View>
            <Pressable
              onPress={handleClose}
              className="rounded-full p-2 text-muted-foreground hover:bg-muted shrink-0 ml-1 border border-border/40"
              accessibilityLabel="Tutup"
            >
              <X size={18} />
            </Pressable>
          </View>

          <ScrollView className="space-y-4" showsVerticalScrollIndicator={false}>
            {/* 1. Sumber */}
            <View className="gap-1.5">
              <Text className="text-xs font-semibold text-foreground">Penyimpanan Sumber</Text>
              <View className="flex-row flex-wrap gap-2">
                {providers.map((p) => {
                  const isSelected = sourceId === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => setSelectedSourceId(p.id)}
                      className="flex-1 min-w-[140px] rounded-xl border p-2.5"
                      style={{
                        borderColor: isSelected ? colors.primary : "#E2E8F0",
                        backgroundColor: isSelected ? `${colors.primary}14` : "transparent",
                      }}
                    >
                      <Text className="text-xs font-bold text-foreground">{p.name}</Text>
                      <Text className="text-[10px] text-muted-foreground">
                        {p.type} • {p.fileCount || 0} berkas
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 2. Tujuan */}
            <View className="gap-1.5">
              <Text className="text-xs font-semibold text-foreground">Penyimpanan Tujuan</Text>
              <View className="flex-row flex-wrap gap-2">
                {providers
                  .filter((p) => p.id !== sourceId)
                  .map((p) => {
                    const isSelected = targetId === p.id;
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => setSelectedTargetId(p.id)}
                        className="flex-1 min-w-[140px] rounded-xl border p-2.5"
                        style={{
                          borderColor: isSelected ? colors.primary : "#E2E8F0",
                          backgroundColor: isSelected ? `${colors.primary}14` : "transparent",
                        }}
                      >
                        <Text className="text-xs font-bold text-foreground">{p.name}</Text>
                        <Text className="text-[10px] text-muted-foreground">{p.type}</Text>
                      </Pressable>
                    );
                  })}
              </View>
            </View>

            {/* 3. Filter Folder (PILIHAN CHIPS - WRAPPING RAPI TIDAK TERPOTONG) */}
            <View className="gap-1.5">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-semibold text-foreground">Pilih Folder Target Migrasi</Text>
                <Text className="text-[10px] font-bold text-primary">
                  {SUBFOLDER_OPTIONS.find((s) => s.key === selectedFolder)?.label}
                </Text>
              </View>
              <View className="flex-row flex-wrap gap-1.5 py-1">
                {SUBFOLDER_OPTIONS.map((sf) => {
                  const isSelected = selectedFolder === sf.key;
                  return (
                    <Pressable
                      key={sf.key}
                      onPress={() => setSelectedFolder(sf.key)}
                      className="rounded-full px-3 py-1.5 border flex-row items-center gap-1.5"
                      style={{
                        backgroundColor: isSelected ? colors.primary : "transparent",
                        borderColor: isSelected ? colors.primary : "#E2E8F0",
                      }}
                    >
                      <Folder size={12} color={isSelected ? "#FFF" : colors.primary} />
                      <Text
                        className="text-xs font-semibold"
                        style={{ color: isSelected ? "#FFF" : "#475569" }}
                      >
                        {sf.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 4. Filter Umur Berkas (PRESET CLICKS - TIDAK HARUS DIKETIK) */}
            <View className="gap-1.5">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-semibold text-foreground">Filter Umur Berkas</Text>
                <Text className="text-[10px] text-muted-foreground">
                  {olderThanDays ? `Hanya berkas > ${olderThanDays} hari` : "Semua umur berkas"}
                </Text>
              </View>

              <View className="flex-row flex-wrap gap-1.5">
                {AGE_FILTER_PRESETS.map((preset) => {
                  const isSelected = olderThanDays === preset.days;
                  return (
                    <Pressable
                      key={preset.days}
                      onPress={() => setOlderThanDays(preset.days)}
                      className="rounded-lg px-2.5 py-1 border"
                      style={{
                        backgroundColor: isSelected ? `${colors.primary}1A` : "transparent",
                        borderColor: isSelected ? colors.primary : "#E2E8F0",
                      }}
                    >
                      <Text
                        className="text-xs font-semibold"
                        style={{ color: isSelected ? colors.primary : "#64748B" }}
                      >
                        {preset.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 5. PREVIEW LIVE FILTER YANG AKAN DIKIRIM */}
            <View className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-2.5">
              <View className="flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <View className="flex-row items-center gap-1.5 flex-1 min-w-0">
                  <CheckCircle2 size={16} color={colors.primary} />
                  <Text className="text-xs font-bold text-foreground flex-1" numberOfLines={1}>
                    Ringkasan Berkas yang Akan Dipindahkan
                  </Text>
                </View>
                {loadingPreview ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Pressable onPress={fetchPreview} className="self-end sm:self-auto py-0.5">
                    <Text className="text-[10px] text-primary font-bold">Refresh Preview</Text>
                  </Pressable>
                )}
              </View>

              <View className="space-y-1.5 text-xs">
                <View className="flex-row justify-between">
                  <Text className="text-xs text-muted-foreground">Rute Penyimpanan:</Text>
                  <Text className="text-xs font-semibold text-foreground">
                    {providers.find((p) => p.id === sourceId)?.name || "-"} → {providers.find((p) => p.id === targetId)?.name || "-"}
                  </Text>
                </View>

                <View className="flex-row justify-between">
                  <Text className="text-xs text-muted-foreground">Folder Target:</Text>
                  <Text className="text-xs font-semibold text-foreground">
                    {SUBFOLDER_OPTIONS.find((s) => s.key === selectedFolder)?.label || "Semua Folder"}
                  </Text>
                </View>

                <View className="flex-row justify-between">
                  <Text className="text-xs text-muted-foreground">Kriteria Umur:</Text>
                  <Text className="text-xs font-semibold text-foreground">
                    {olderThanDays ? `Lebih tua dari ${olderThanDays} hari` : "Semua umur berkas"}
                  </Text>
                </View>

                <View className="flex-row justify-between pt-1 border-t border-border/60">
                  <Text className="text-xs font-bold text-foreground">Estimasi Berkas Valid:</Text>
                  <Text className="text-xs font-black text-primary">
                    {loadingPreview
                      ? "Menghitung..."
                      : preview
                      ? `${preview.eligibleFilesCount} berkas (${formatBytes(preview.eligibleTotalBytes)})`
                      : "0 berkas (0 B)"}
                  </Text>
                </View>

                {preview && preview.excludedOrphansCount > 0 ? (
                  <Text className="text-[11px] text-amber-700">
                    • {preview.excludedOrphansCount} berkas lepas (standalone) dikecualikan (tetap di server lokal agar aman).
                  </Text>
                ) : null}

                {preview?.sampleFiles && preview.sampleFiles.length > 0 ? (
                  <View className="pt-1">
                    <Text className="text-[10px] text-muted-foreground mb-1">Contoh berkas yang masuk filter:</Text>
                    <View className="flex-row flex-wrap gap-1">
                      {preview.sampleFiles.map((sf: any) => (
                        <View key={sf.id} className="max-w-full rounded bg-background px-2 py-0.5 border border-border">
                          <Text className="text-[10px] text-foreground font-mono" numberOfLines={1} ellipsizeMode="middle">
                            {sf.name} ({formatBytes(sf.size)})
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Catatan Keamanan */}
            <View className="gap-2 rounded-xl border border-border/80 bg-muted/20 p-3.5">
              <View className="flex-row items-center gap-2">
                <ShieldCheck size={16} color="#10B981" />
                <Text className="text-xs font-bold text-foreground">Protokol Keamanan Data</Text>
              </View>
              <View className="gap-1 text-[11px] text-muted-foreground">
                <Text className="text-[11px] text-muted-foreground">
                  • Berkas diunggah ke target lalu diverifikasi ukuran dan checksum SHA-256 secara ketat.
                </Text>
                <Text className="text-[11px] text-muted-foreground">
                  • Berkas sumber <Text className="font-bold text-foreground">tidak langsung dihapus</Text> dan dipertahankan sampai Anda menjalankan &apos;Bersihkan Berkas Lokal&apos; atau melakukan Rollback.
                </Text>
                <Text className="text-[11px] text-muted-foreground">
                  • Berkas lepas (standalone) tidak ikut dipindahkan dan tetap di server lokal agar mudah diaudit.
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View className="mt-4 flex-row justify-end gap-2 border-t border-border pt-3">
            <Button variant="ghost" size="sm" onPress={handleClose} disabled={submitting}>
              <Text>Batal</Text>
            </Button>
            <Button
              size="sm"
              onPress={handleStartMigration}
              disabled={submitting || !sourceId || !targetId || (preview !== null && preview.eligibleFilesCount === 0)}
              style={{ backgroundColor: colors.primary }}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text className="text-white font-semibold">Mulai Migrasi</Text>
              )}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}
