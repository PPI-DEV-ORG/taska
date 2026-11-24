import * as React from "react";
import { ActivityIndicator, Image, Linking, Platform, Pressable, ScrollView, View } from "react-native";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { colors } from "@/tokens";
import { api, apiBase, getAccess } from "@/services/api";
import { useApp } from "@/store/app-store";
import { formatBytes } from "@/modules/file-management/file-ui";
import {
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Film,
  Image as ImageIcon,
  Music,
  Copy,
  User,
  Calendar,
  Folder,
  AlertCircle,
} from "lucide-react-native";
import type { DriveFileItem, DrivePreviewPayload } from "./types";

export async function downloadDriveFile(file: DriveFileItem, toast: (msg: string, tone?: any) => void) {
  try {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const token = getAccess();
      const res = await fetch(`${apiBase()}/drive/files/${file.id}/content?download=1`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Gagal mengunduh (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name || file.originalName || `file-${file.id}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } else {
      const { token } = await api.post<{ token: string }>(`/drive/files/${file.id}/download-token`, {
        mode: "attachment",
      });
      const url = `${apiBase()}/drive/files/${file.id}/signed?token=${encodeURIComponent(token)}`;
      await Linking.openURL(url);
    }
  } catch (e) {
    toast((e as Error).message || "Gagal mengunduh berkas.", "danger");
  }
}

export function DrivePreviewModal({
  visible,
  onClose,
  file,
}: {
  visible: boolean;
  onClose: () => void;
  file: DriveFileItem | null;
}) {
  const { toast } = useApp();
  const [loading, setLoading] = React.useState(false);
  const [preview, setPreview] = React.useState<DrivePreviewPayload | null>(null);
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null);
  const [activeSheet, setActiveSheet] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [downloading, setDownloading] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    let createdObjectUrl: string | null = null;

    const load = async () => {
      if (!visible || !file) return;
      setLoading(true);
      setError(null);
      setPreview(null);
      setBlobUrl(null);
      setActiveSheet(0);

      try {
        const res = await api.get<DrivePreviewPayload>(`/drive/files/${file.id}/preview`);
        if (!alive) return;
        setPreview(res);

        if (
          Platform.OS === "web" &&
          typeof window !== "undefined" &&
          (res.kind === "image" || res.kind === "pdf" || res.kind === "video" || res.kind === "audio")
        ) {
          const token = getAccess();
          const resp = await fetch(`${apiBase()}/drive/files/${file.id}/content`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (!resp.ok) throw new Error(`Gagal memuat pratinjau (${resp.status})`);
          const blob = await resp.blob();
          if (!alive) return;
          createdObjectUrl = URL.createObjectURL(blob);
          setBlobUrl(createdObjectUrl);
        }
      } catch (e) {
        if (!alive) return;
        setError((e as Error).message || "Gagal memuat pratinjau berkas.");
      } finally {
        if (alive) setLoading(false);
      }
    };

    void load();

    return () => {
      alive = false;
      if (createdObjectUrl) {
        URL.revokeObjectURL(createdObjectUrl);
      }
    };
  }, [visible, file]);

  const handleOpenExternal = async () => {
    if (!file) return;
    try {
      if (Platform.OS === "web" && blobUrl) {
        window.open(blobUrl, "_blank");
        return;
      }
      const { token } = await api.post<{ token: string }>(`/drive/files/${file.id}/download-token`, {
        mode: "inline",
      });
      const url = `${apiBase()}/drive/files/${file.id}/signed?token=${encodeURIComponent(token)}`;
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.open(url, "_blank");
      } else {
        await Linking.openURL(url);
      }
    } catch (e) {
      toast((e as Error).message || "Gagal membuka berkas.", "danger");
    }
  };

  const handleDownload = async () => {
    if (!file) return;
    setDownloading(true);
    try {
      await downloadDriveFile(file, toast);
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyText = async (content: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
        toast("Isi teks disalin ke clipboard.", "success");
      }
    } catch {
      toast("Gagal menyalin teks.", "danger");
    }
  };

  if (!visible || !file) return null;

  const iconEl =
    file.fileType === "excel" ? (
      <FileSpreadsheet size={20} color="#059669" />
    ) : file.fileType === "image" ? (
      <ImageIcon size={20} color="#2563EB" />
    ) : file.fileType === "video" ? (
      <Film size={20} color="#7C3AED" />
    ) : file.fileType === "audio" ? (
      <Music size={20} color="#DB2777" />
    ) : (
      <FileText size={20} color={colors.primary} />
    );

  const authHeader = getAccess() ? { Authorization: `Bearer ${getAccess()}` } : undefined;
  const nativeContentUri = `${apiBase()}/drive/files/${file.id}/content`;

  return (
    <Dialog open={visible} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-4xl bg-card p-4 sm:p-6 gap-0">
        {/* Header */}
        <View className="mb-3 flex-row items-center justify-between gap-2 border-b border-border pb-3 pr-8">
          <View className="flex-1 min-w-0 flex-row items-center gap-2.5">
            <View className="rounded-xl p-2 bg-muted/40 shrink-0">{iconEl}</View>
            <View className="flex-1 min-w-0">
              <Text className="text-base font-bold text-foreground" numberOfLines={1} ellipsizeMode="middle">
                {file.name}
              </Text>
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                {(file.extension || "file").toUpperCase()} • {formatBytes(file.size)}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center gap-1.5 shrink-0">
            {file.permissions.canDownload && (
              <Button
                size="sm"
                onPress={() => void handleDownload()}
                disabled={downloading}
                className="h-8 gap-1.5"
                style={{ backgroundColor: colors.primary }}
              >
                <Download size={13} color="#FFF" />
                <Text className="text-xs font-semibold text-white">
                  {downloading ? "Mengunduh..." : "Unduh"}
                </Text>
              </Button>
            )}
          </View>
        </View>

        {/* Metadata bar */}
        <View className="mb-3 flex-row flex-wrap items-center gap-3 rounded-xl bg-muted/25 border border-border/60 px-3 py-2">
          <View className="flex-row items-center gap-1.5">
            <Folder size={13} color={colors.mutedForeground} />
            <Text className="text-xs text-muted-foreground">{file.folderName || "Dokumen Umum"}</Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <User size={13} color={colors.mutedForeground} />
            <Text className="text-xs text-muted-foreground">{file.uploader?.name || "Sistem"}</Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <Calendar size={13} color={colors.mutedForeground} />
            <Text className="text-xs text-muted-foreground">
              {new Date(file.createdAt).toLocaleString("id-ID", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
        </View>

        {/* Preview Area */}
        <ScrollView className="max-h-[65vh]" showsVerticalScrollIndicator={true}>
          {loading ? (
            <View className="items-center justify-center py-16">
              <ActivityIndicator size="large" color={colors.primary} />
              <Text className="mt-2.5 text-xs text-muted-foreground">Memuat pratinjau berkas...</Text>
            </View>
          ) : error ? (
            <View className="items-center justify-center py-12 px-4 gap-2 rounded-2xl border border-destructive/30 bg-destructive/5">
              <AlertCircle size={28} color="#EF4444" />
              <Text className="text-sm font-semibold text-foreground text-center">{error}</Text>
            </View>
          ) : !preview ? null : preview.kind === "image" ? (
            <View className="rounded-2xl border border-border overflow-hidden bg-muted/20 items-center justify-center p-2">
              {Platform.OS === "web" && blobUrl ? (
                <img
                  src={blobUrl}
                  alt={file.name}
                  style={{ maxWidth: "100%", maxHeight: "56vh", objectFit: "contain", borderRadius: 10 }}
                />
              ) : (
                <Image
                  source={{ uri: nativeContentUri, headers: authHeader }}
                  style={{ width: "100%", height: 340 }}
                  resizeMode="contain"
                />
              )}
              <View className="mt-2 flex-row justify-end w-full">
                <Button size="sm" variant="outline" onPress={() => void handleOpenExternal()} className="gap-1.5">
                  <ExternalLink size={13} color={colors.primary} />
                  <Text className="text-xs font-semibold">Buka Ukuran Penuh</Text>
                </Button>
              </View>
            </View>
          ) : preview.kind === "pdf" ? (
            <View className="rounded-2xl border border-border overflow-hidden bg-card">
              <View className="flex-row items-center justify-between px-3 py-2 bg-muted/30 border-b border-border/60">
                <Text className="text-xs font-bold text-foreground">Pratinjau PDF</Text>
                <Button size="sm" variant="ghost" onPress={() => void handleOpenExternal()} className="h-7 gap-1 px-2">
                  <ExternalLink size={12} color={colors.primary} />
                  <Text className="text-[11px] font-semibold text-primary">Buka di Tab Baru</Text>
                </Button>
              </View>
              {Platform.OS === "web" && blobUrl ? (
                <iframe
                  src={blobUrl}
                  title={file.name}
                  style={{ width: "100%", height: "58vh", border: "none" }}
                />
              ) : (
                <View className="p-8 items-center justify-center gap-3">
                  <FileText size={36} color="#EF4444" />
                  <Text className="text-xs text-muted-foreground text-center">
                    Dokumen PDF siap dibuka di viewer perangkat.
                  </Text>
                  <Button size="sm" onPress={() => void handleOpenExternal()} className="gap-1.5">
                    <ExternalLink size={13} color="#FFF" />
                    <Text className="text-xs text-white font-semibold">Buka PDF</Text>
                  </Button>
                </View>
              )}
            </View>
          ) : preview.kind === "video" ? (
            <View className="rounded-2xl border border-border overflow-hidden bg-black/95 items-center justify-center p-2">
              {Platform.OS === "web" && blobUrl ? (
                <video
                  src={blobUrl}
                  controls
                  style={{ width: "100%", maxHeight: "55vh", borderRadius: 10 }}
                />
              ) : (
                <View className="p-8 items-center gap-3">
                  <Film size={36} color="#FFF" />
                  <Button size="sm" onPress={() => void handleOpenExternal()}>
                    <Text className="text-xs text-white font-semibold">Putar Video</Text>
                  </Button>
                </View>
              )}
            </View>
          ) : preview.kind === "audio" ? (
            <View className="rounded-2xl border border-border bg-muted/20 p-6 items-center gap-3">
              <Music size={36} color={colors.primary} />
              {Platform.OS === "web" && blobUrl ? (
                <audio src={blobUrl} controls style={{ width: "100%" }} />
              ) : (
                <Button size="sm" onPress={() => void handleOpenExternal()}>
                  <Text className="text-xs text-white font-semibold">Putar Audio</Text>
                </Button>
              )}
            </View>
          ) : preview.kind === "spreadsheet" ? (
            <View className="rounded-2xl border border-border overflow-hidden bg-card">
              {/* Sheet selector */}
              <View className="flex-row flex-wrap items-center justify-between gap-2 px-3 py-2 bg-muted/30 border-b border-border/60">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row items-center gap-1.5">
                    {preview.sheets.map((s, idx) => (
                      <Pressable
                        key={`${s.name}-${idx}`}
                        onPress={() => setActiveSheet(idx)}
                        className={`rounded-lg px-2.5 py-1 border ${
                          activeSheet === idx
                            ? "bg-primary border-primary"
                            : "bg-card border-border"
                        }`}
                      >
                        <Text
                          className={`text-xs font-semibold ${
                            activeSheet === idx ? "text-white" : "text-foreground"
                          }`}
                        >
                          {s.name} ({s.totalRows})
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
                {preview.sheets[activeSheet]?.truncated && (
                  <Text className="text-[11px] text-amber-600 font-medium">
                    Menampilkan 200 baris pertama dari {preview.sheets[activeSheet]?.totalRows} baris
                  </Text>
                )}
              </View>
              {preview.sheets[activeSheet]?.rows.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                  <View className="p-2">
                    {preview.sheets[activeSheet]!.rows.map((row, rIdx) => (
                      <View
                        key={rIdx}
                        className={`flex-row border-b border-border/50 ${
                          rIdx === 0 ? "bg-muted/40" : rIdx % 2 === 0 ? "bg-muted/10" : "bg-card"
                        }`}
                      >
                        <View className="w-10 px-2 py-1.5 border-r border-border/50 items-end justify-center">
                          <Text className="text-[10px] font-mono text-muted-foreground">{rIdx + 1}</Text>
                        </View>
                        {row.map((cell, cIdx) => (
                          <View
                            key={cIdx}
                            className="w-40 px-2.5 py-1.5 border-r border-border/40 justify-center"
                          >
                            <Text
                              className={`text-xs ${rIdx === 0 ? "font-bold text-foreground" : "text-foreground/90"}`}
                              numberOfLines={3}
                            >
                              {cell || ""}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              ) : (
                <View className="p-8 items-center">
                  <Text className="text-xs text-muted-foreground">Sheet kosong.</Text>
                </View>
              )}
            </View>
          ) : preview.kind === "docx" ? (
            <View className="rounded-2xl border border-border bg-card p-4 sm:p-6 gap-3">
              {preview.blocks.length === 0 ? (
                <Text className="text-xs text-muted-foreground text-center py-6">
                  Dokumen tidak memiliki teks yang dapat ditampilkan.
                </Text>
              ) : (
                preview.blocks.map((block, idx) => {
                  if (block.type === "heading") {
                    const cls =
                      block.level === 1
                        ? "text-lg font-bold text-foreground mt-2"
                        : block.level === 2
                          ? "text-base font-bold text-foreground mt-1.5"
                          : "text-sm font-bold text-foreground mt-1";
                    return (
                      <Text key={idx} className={cls}>
                        {block.text}
                      </Text>
                    );
                  }
                  if (block.type === "table") {
                    return (
                      <ScrollView key={idx} horizontal showsHorizontalScrollIndicator={true}>
                        <View className="rounded-lg border border-border overflow-hidden my-1">
                          {block.rows.map((row, rIdx) => (
                            <View
                              key={rIdx}
                              className={`flex-row border-b border-border/60 ${rIdx === 0 ? "bg-muted/40" : "bg-card"}`}
                            >
                              {row.map((cell, cIdx) => (
                                <View key={cIdx} className="w-44 px-2.5 py-1.5 border-r border-border/40">
                                  <Text className={`text-xs ${rIdx === 0 ? "font-bold" : ""}`}>
                                    {cell}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          ))}
                        </View>
                      </ScrollView>
                    );
                  }
                  return (
                    <Text key={idx} className="text-xs sm:text-sm leading-5 text-foreground/90">
                      {block.text}
                    </Text>
                  );
                })
              )}
            </View>
          ) : preview.kind === "text" ? (
            <View className="rounded-2xl border border-border overflow-hidden bg-muted/15">
              <View className="flex-row items-center justify-between px-3 py-2 bg-muted/30 border-b border-border/60">
                <Text className="text-xs font-semibold text-muted-foreground">
                  Teks / Kode {preview.truncated ? "(dipotong di 300 KB pertama)" : ""}
                </Text>
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() => void handleCopyText(preview.content)}
                  className="h-7 gap-1 px-2"
                >
                  <Copy size={12} color={colors.primary} />
                  <Text className="text-[11px] font-semibold text-primary">Salin</Text>
                </Button>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <View className="p-3.5">
                  <Text className="font-mono text-xs text-foreground leading-5">
                    {preview.content}
                  </Text>
                </View>
              </ScrollView>
            </View>
          ) : (
            <View className="rounded-2xl border border-border bg-muted/20 p-8 items-center gap-3">
              <FileText size={36} color={colors.mutedForeground} />
              <Text className="text-sm font-semibold text-foreground text-center">
                Pratinjau tidak tersedia
              </Text>
              <Text className="text-xs text-muted-foreground text-center max-w-md">
                {preview.reason}
              </Text>
              {file.permissions.canDownload && (
                <Button size="sm" onPress={() => void handleDownload()} className="gap-1.5 mt-1">
                  <Download size={13} color="#FFF" />
                  <Text className="text-xs font-semibold text-white">Unduh Berkas</Text>
                </Button>
              )}
            </View>
          )}
        </ScrollView>

        {file.description ? (
          <View className="mt-3 rounded-xl bg-muted/20 border border-border/60 p-3">
            <Text className="text-[11px] font-semibold text-muted-foreground mb-0.5">Keterangan</Text>
            <Text className="text-xs text-foreground">{file.description}</Text>
          </View>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
