import * as React from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { colors } from "@/tokens";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import {
  ArrowRightLeft,
  ShieldCheck,
  CheckCircle2,
  Folder,
  FolderOpen,
  HardDrive,
  Check,
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
  { key: "absensi", label: "Foto Absensi" },
  { key: "foto-profil", label: "Foto Profil" },
  { key: "video", label: "Video" },
  { key: "dokumen", label: "Dokumen ERP Lainnya" },
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

type MigrationMode = "erp" | "drive";

type DriveFolderOption = {
  id: number;
  name: string;
  parentId: number | null;
  pathLabel: string;
  fileCount: number;
};

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

  const [mode, setMode] = React.useState<MigrationMode>("erp");
  const [selectedSourceId, setSelectedSourceId] = React.useState<number>(0);
  const [selectedTargetId, setSelectedTargetId] = React.useState<number>(0);
  const localProvider = providers.find((p) => p.type === "LOCAL") ?? providers[0];
  const sourceId = providers.some((p) => p.id === selectedSourceId)
    ? selectedSourceId
    : localProvider?.id ?? 0;
  const targetId = providers.some((p) => p.id === selectedTargetId && p.id !== sourceId)
    ? selectedTargetId
    : providers.find((p) => p.id !== sourceId)?.id ?? 0;

  // ERP mode state
  const [selectedFolder, setSelectedFolder] = React.useState<string>("all");

  // Drive mode state
  const [selectedDriveFolder, setSelectedDriveFolder] = React.useState<string>("all");
  const [includeSubfolders, setIncludeSubfolders] = React.useState<boolean>(true);
  const [deleteSourceAfterVerify, setDeleteSourceAfterVerify] = React.useState<boolean>(false);

  // Shared filter
  const [olderThanDays, setOlderThanDays] = React.useState<string>("");
  const [submitting, setSubmitting] = React.useState(false);

  // Live preview state (ERP)
  const [preview, setPreview] = React.useState<{
    eligibleFilesCount: number;
    eligibleTotalBytes: number;
    excludedOrphansCount: number;
    sampleFiles: Array<{ id: number; name: string; size: number }>;
  } | null>(null);

  // Live preview state (Drive)
  const [drivePreview, setDrivePreview] = React.useState<{
    eligibleFilesCount: number;
    eligibleTotalBytes: number;
    rootFileCount: number;
    folders: DriveFolderOption[];
    sampleFiles: Array<{ id: number; name: string; size: number; folderPath?: string }>;
  } | null>(null);

  const [loadingPreview, setLoadingPreview] = React.useState(false);

  const handleClose = () => {
    setOlderThanDays("");
    setSelectedFolder("all");
    setSelectedDriveFolder("all");
    setIncludeSubfolders(true);
    setDeleteSourceAfterVerify(false);
    setPreview(null);
    setDrivePreview(null);
    onClose();
  };

  const fetchPreview = React.useCallback(async () => {
    if (!sourceId || !visible) return;
    setLoadingPreview(true);
    try {
      if (mode === "erp") {
        const params = new URLSearchParams();
        params.append("sourceProviderId", String(sourceId));
        if (targetId && targetId !== sourceId) params.append("targetProviderId", String(targetId));
        if (selectedFolder && selectedFolder !== "all") params.append("folder", selectedFolder);
        if (olderThanDays) params.append("olderThanDays", olderThanDays);

        const res = await api.get<any>(`/file-management/migrations/preview?${params.toString()}`);
        setPreview(
          res || {
            eligibleFilesCount: 0,
            eligibleTotalBytes: 0,
            excludedOrphansCount: 0,
            sampleFiles: [],
          },
        );
      } else {
        const params = new URLSearchParams();
        params.append("sourceProviderId", String(sourceId));
        if (targetId && targetId !== sourceId) params.append("targetProviderId", String(targetId));
        if (selectedDriveFolder) params.append("folderId", selectedDriveFolder);
        params.append("includeSubfolders", includeSubfolders ? "true" : "false");
        if (olderThanDays) params.append("olderThanDays", olderThanDays);

        const res = await api.get<any>(
          `/file-management/migrations/drive/preview?${params.toString()}`,
        );
        setDrivePreview(
          res || {
            eligibleFilesCount: 0,
            eligibleTotalBytes: 0,
            rootFileCount: 0,
            folders: [],
            sampleFiles: [],
          },
        );
      }
    } catch {
      if (mode === "erp") {
        setPreview({
          eligibleFilesCount: 0,
          eligibleTotalBytes: 0,
          excludedOrphansCount: 0,
          sampleFiles: [],
        });
      } else {
        setDrivePreview({
          eligibleFilesCount: 0,
          eligibleTotalBytes: 0,
          rootFileCount: 0,
          folders: [],
          sampleFiles: [],
        });
      }
    } finally {
      setLoadingPreview(false);
    }
  }, [
    mode,
    sourceId,
    targetId,
    selectedFolder,
    selectedDriveFolder,
    includeSubfolders,
    olderThanDays,
    visible,
  ]);

  React.useEffect(() => {
    if (visible && sourceId) {
      const timer = setTimeout(() => {
        void fetchPreview();
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
      if (mode === "erp") {
        await api.post("/file-management/migrations", {
          sourceProviderId: sourceId,
          targetProviderId: targetId,
          folder: selectedFolder !== "all" ? selectedFolder : undefined,
          olderThanDays: olderThanDays ? Number(olderThanDays) : undefined,
          includeOrphans: false,
        });
        toast("Job migrasi berkas ERP telah dimulai di latar belakang!", "success");
      } else {
        const res = await api.post<any>("/file-management/migrations/drive", {
          sourceProviderId: sourceId,
          targetProviderId: targetId,
          folderId: selectedDriveFolder,
          includeSubfolders,
          olderThanDays: olderThanDays ? Number(olderThanDays) : undefined,
          deleteSourceAfterVerify,
        });
        const migrated = res?.migratedFiles ?? 0;
        const failed = res?.failedFiles ?? 0;
        if (failed > 0) {
          toast(
            `Migrasi Dokumen Umum selesai sebagian: ${migrated} berhasil, ${failed} gagal.`,
            "warning",
          );
        } else {
          toast(
            `Berhasil memigrasikan ${migrated} berkas Dokumen Umum (${formatBytes(res?.totalBytes || 0)})!`,
            "success",
          );
        }
      }
      onSuccess();
      handleClose();
    } catch (e) {
      toast((e as Error).message, "danger");
    } finally {
      setSubmitting(false);
    }
  };

  const activeCount =
    mode === "erp" ? preview?.eligibleFilesCount ?? 0 : drivePreview?.eligibleFilesCount ?? 0;
  const activeBytes =
    mode === "erp" ? preview?.eligibleTotalBytes ?? 0 : drivePreview?.eligibleTotalBytes ?? 0;
  const activeSamples =
    mode === "erp" ? preview?.sampleFiles ?? [] : drivePreview?.sampleFiles ?? [];

  const activeDriveFolderLabel = React.useMemo(() => {
    if (selectedDriveFolder === "all") return "Semua Folder Dokumen Umum";
    if (selectedDriveFolder === "root") return "Root (Tanpa Folder)";
    const found = drivePreview?.folders.find((f) => String(f.id) === selectedDriveFolder);
    return found ? found.pathLabel : "Folder Terpilih";
  }, [selectedDriveFolder, drivePreview?.folders]);

  return (
    <Dialog open={visible} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="sm:max-w-xl bg-card p-4 sm:p-6 gap-0 max-h-[92vh]">
        {/* Header */}
        <View className="mb-3 flex-row items-center justify-between border-b border-border pb-3 pr-8">
          <View className="flex-row items-center gap-2.5 flex-1">
            <View className="rounded-xl p-2 shrink-0" style={{ backgroundColor: `${colors.primary}1A` }}>
              <ArrowRightLeft size={20} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-foreground" numberOfLines={1}>
                Migrasi Berkas Sekarang
              </Text>
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                Pindahkan berkas ERP atau Dokumen Umum antar penyimpanan
              </Text>
            </View>
          </View>
        </View>

        {/* Mode Switcher: Berkas ERP vs Dokumen Umum (Drive) */}
        <View className="mb-3 flex-row rounded-xl bg-muted/40 p-1 border border-border/70">
          <Pressable
            onPress={() => setMode("erp")}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg py-2 px-3"
            style={{
              backgroundColor: mode === "erp" ? colors.primary : "transparent",
            }}
          >
            <HardDrive size={14} color={mode === "erp" ? "#FFFFFF" : "#64748B"} />
            <Text
              className="text-xs font-bold"
              style={{ color: mode === "erp" ? "#FFFFFF" : "#64748B" }}
            >
              Berkas ERP
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode("drive")}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg py-2 px-3"
            style={{
              backgroundColor: mode === "drive" ? colors.primary : "transparent",
            }}
          >
            <FolderOpen size={14} color={mode === "drive" ? "#FFFFFF" : "#64748B"} />
            <Text
              className="text-xs font-bold"
              style={{ color: mode === "drive" ? "#FFFFFF" : "#64748B" }}
            >
              Dokumen Umum (Drive)
            </Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 space-y-4" showsVerticalScrollIndicator={false}>
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
                      {p.type}
                      {mode === "erp" ? ` • ${p.fileCount || 0} berkas ERP` : ""}
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

          {/* 3. Filter Folder (ERP vs Dokumen Umum Drive) */}
          {mode === "erp" ? (
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
          ) : (
            <View className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-semibold text-foreground">
                  Pilih Folder Dokumen Umum (Shared Drive)
                </Text>
                <Text className="text-[10px] font-bold text-primary" numberOfLines={1}>
                  {activeDriveFolderLabel}
                </Text>
              </View>

              <View className="flex-row flex-wrap gap-1.5 py-1">
                {/* Semua Folder Drive */}
                <Pressable
                  onPress={() => setSelectedDriveFolder("all")}
                  className="rounded-full px-3 py-1.5 border flex-row items-center gap-1.5"
                  style={{
                    backgroundColor: selectedDriveFolder === "all" ? colors.primary : "transparent",
                    borderColor: selectedDriveFolder === "all" ? colors.primary : "#E2E8F0",
                  }}
                >
                  <FolderOpen
                    size={12}
                    color={selectedDriveFolder === "all" ? "#FFF" : colors.primary}
                  />
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: selectedDriveFolder === "all" ? "#FFF" : "#475569" }}
                  >
                    Semua Folder Dokumen Umum
                  </Text>
                </Pressable>

                {/* Root only */}
                {(drivePreview?.rootFileCount ?? 0) > 0 && (
                  <Pressable
                    onPress={() => setSelectedDriveFolder("root")}
                    className="rounded-full px-3 py-1.5 border flex-row items-center gap-1.5"
                    style={{
                      backgroundColor: selectedDriveFolder === "root" ? colors.primary : "transparent",
                      borderColor: selectedDriveFolder === "root" ? colors.primary : "#E2E8F0",
                    }}
                  >
                    <Folder
                      size={12}
                      color={selectedDriveFolder === "root" ? "#FFF" : colors.primary}
                    />
                    <Text
                      className="text-xs font-semibold"
                      style={{ color: selectedDriveFolder === "root" ? "#FFF" : "#475569" }}
                    >
                      Root ({drivePreview?.rootFileCount})
                    </Text>
                  </Pressable>
                )}

                {/* Daftar folder dinamis dari DriveFolder */}
                {(drivePreview?.folders ?? []).map((folder) => {
                  const key = String(folder.id);
                  const isSelected = selectedDriveFolder === key;
                  return (
                    <Pressable
                      key={folder.id}
                      onPress={() => setSelectedDriveFolder(key)}
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
                        {folder.pathLabel} ({folder.fileCount})
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Opsi Subfolder & Hapus Sumber */}
              <View className="gap-2 pt-1">
                {selectedDriveFolder !== "all" && selectedDriveFolder !== "root" && (
                  <Pressable
                    onPress={() => setIncludeSubfolders((prev) => !prev)}
                    className="flex-row items-center gap-2"
                  >
                    <View
                      className={`w-4 h-4 rounded border items-center justify-center ${
                        includeSubfolders ? "bg-primary border-primary" : "border-border bg-background"
                      }`}
                    >
                      {includeSubfolders && <Check size={11} color="#FFFFFF" />}
                    </View>
                    <Text className="text-xs text-foreground">
                      Sertakan seluruh subfolder di dalam folder terpilih
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  onPress={() => setDeleteSourceAfterVerify((prev) => !prev)}
                  className="flex-row items-center gap-2"
                >
                  <View
                    className={`w-4 h-4 rounded border items-center justify-center ${
                      deleteSourceAfterVerify ? "bg-primary border-primary" : "border-border bg-background"
                    }`}
                  >
                    {deleteSourceAfterVerify && <Check size={11} color="#FFFFFF" />}
                  </View>
                  <Text className="text-xs text-foreground">
                    Hapus salinan dari penyimpanan sumber setelah verifikasi berhasil
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* 4. Filter Umur Berkas */}
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
                <Pressable onPress={() => void fetchPreview()} className="self-end sm:self-auto py-0.5">
                  <Text className="text-[10px] text-primary font-bold">Refresh Preview</Text>
                </Pressable>
              )}
            </View>

            <View className="space-y-1.5 text-xs">
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted-foreground">Cakupan:</Text>
                <Text className="text-xs font-semibold text-foreground">
                  {mode === "erp" ? "Berkas ERP" : "Dokumen Umum (Shared Drive)"}
                </Text>
              </View>

              <View className="flex-row justify-between">
                <Text className="text-xs text-muted-foreground">Rute Penyimpanan:</Text>
                <Text className="text-xs font-semibold text-foreground">
                  {providers.find((p) => p.id === sourceId)?.name || "-"} →{" "}
                  {providers.find((p) => p.id === targetId)?.name || "-"}
                </Text>
              </View>

              <View className="flex-row justify-between">
                <Text className="text-xs text-muted-foreground">Folder Target:</Text>
                <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
                  {mode === "erp"
                    ? SUBFOLDER_OPTIONS.find((s) => s.key === selectedFolder)?.label || "Semua Folder"
                    : activeDriveFolderLabel}
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
                    : `${activeCount} berkas (${formatBytes(activeBytes)})`}
                </Text>
              </View>

              {mode === "erp" && preview && preview.excludedOrphansCount > 0 ? (
                <Text className="text-[11px] text-amber-700">
                  • {preview.excludedOrphansCount} berkas lepas (standalone) dikecualikan (tetap di server lokal agar aman).
                </Text>
              ) : null}

              {activeSamples.length > 0 ? (
                <View className="pt-1">
                  <Text className="text-[10px] text-muted-foreground mb-1">
                    Contoh berkas yang masuk filter:
                  </Text>
                  <View className="flex-row flex-wrap gap-1">
                    {activeSamples.map((sf: any) => (
                      <View
                        key={sf.id}
                        className="max-w-full rounded bg-background px-2 py-0.5 border border-border"
                      >
                        <Text
                          className="text-[10px] text-foreground font-mono"
                          numberOfLines={1}
                          ellipsizeMode="middle"
                        >
                          {sf.folderPath ? `[${sf.folderPath}] ` : ""}
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
                {mode === "erp"
                  ? "• Berkas sumber tidak langsung dihapus dan dipertahankan sampai Anda menjalankan 'Bersihkan Berkas Lokal' atau melakukan Rollback."
                  : "• Struktur folder, hak akses privat/berbagi, dan share link Dokumen Umum tetap utuh saat berpindah penyimpanan."}
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
            onPress={() => void handleStartMigration()}
            disabled={submitting || !sourceId || !targetId || activeCount === 0}
            style={{ backgroundColor: colors.primary }}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text className="text-white font-semibold">
                {mode === "erp" ? "Mulai Migrasi" : "Migrasi Dokumen Umum"}
              </Text>
            )}
          </Button>
        </View>
      </DialogContent>
    </Dialog>
  );
}
