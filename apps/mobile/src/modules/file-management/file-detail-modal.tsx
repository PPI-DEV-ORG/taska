import * as React from "react";
import { ActivityIndicator, Image, Linking, Platform, Pressable, ScrollView, View } from "react-native";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { colors } from "@/tokens";
import { api, apiBase, authFileUrl } from "@/services/api";
import { useApp } from "@/store/app-store";
import {
  FileText,
  Download,
  Share2,
  Trash2,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Copy,
  ExternalLink,
  Layers,
  HardDrive,
  Info,
  Eye,
} from "lucide-react-native";
import { FileKindBadge, FileStatusBadge, ProviderTypeBadge, formatBytes } from "./file-ui";
import { FileReplaceDialog } from "./file-replace-dialog";
import { FileShareDialog } from "./file-share-dialog";
import type { FileItem } from "./types";

export function FileDetailModal({
  visible,
  onClose,
  fileId,
  onFileUpdated,
}: {
  visible: boolean;
  onClose: () => void;
  fileId?: number | null;
  onFileUpdated: () => void;
}) {
  const { toast, user } = useApp();

  const [file, setFile] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(false);

  const [replaceOpen, setReplaceOpen] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [cleaningLocal, setCleaningLocal] = React.useState(false);

  const handleCleanupLocalCopy = async () => {
    if (!file) return;
    if (
      !confirm(
        "Hapus salinan fisik berkas di server lokal untuk menghemat kapasitas disk? Berkas utama di NAS tetap aman dan dokumen ERP tetap terhubung.",
      )
    ) {
      return;
    }
    setCleaningLocal(true);
    try {
      const res = await api.post<any>(`/file-management/files/${file.id}/cleanup-local`, {});
      toast(res.message || "Salinan lokal berhasil dibersihkan.", "success");
      await loadDetail();
      onFileUpdated();
    } catch (e) {
      toast((e as Error).message, "danger");
    } finally {
      setCleaningLocal(false);
    }
  };

  const loadDetail = React.useCallback(async () => {
    if (!fileId) return;
    setLoading(true);
    try {
      const res = await api.get<any>(`/file-management/files/${fileId}`);
      setFile(res);
    } catch (e) {
      toast((e as Error).message, "danger");
      onClose();
    } finally {
      setLoading(false);
    }
  }, [fileId, toast, onClose]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (visible && fileId) {
        void loadDetail();
      } else {
        setFile(null);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [visible, fileId, loadDetail]);

  const copyChecksum = async () => {
    if (!file?.checksumSha256) return;
    let copied = false;
    if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(file.checksumSha256);
        copied = true;
      } catch {
        copied = false;
      }
    }
    if (!copied && typeof document !== "undefined") {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = file.checksumSha256;
        textArea.style.position = "fixed";
        textArea.style.top = "-9999px";
        textArea.style.left = "-9999px";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        copied = document.execCommand("copy");
        document.body.removeChild(textArea);
      } catch {
        copied = false;
      }
    }
    if (copied) {
      toast("Checksum SHA-256 disalin ke clipboard", "success");
    }
  };

  const handleOpenPreview = () => {
    if (!file) return;
    const url = authFileUrl(file.id);
    if (typeof window !== "undefined") {
      window.open(url, "_blank");
    } else {
      Linking.openURL(url).catch(() => {});
    }
  };

  const handleDownload = () => {
    if (!file) return;
    const url = authFileUrl(file.id);
    if (typeof window !== "undefined") {
      const a = document.createElement("a");
      a.href = url;
      a.download = file.originalName || file.displayName || `file-${file.id}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      Linking.openURL(url).catch(() => {});
    }
  };

  const handleDelete = async () => {
    if (!file) return;

    const inUse = file.usedBy && file.usedBy.length > 0;
    const isSuperAdmin = (user?.role || "").toUpperCase() === "SUPER_ADMIN";

    if (inUse && !isSuperAdmin) {
      toast("File yang masih digunakan oleh dokumen transaksi tidak dapat dihapus.", "danger");
      return;
    }

    const force = inUse && isSuperAdmin;
    if (
      !confirm(
        force
          ? `File ini masih terhubung ke ${file.usedBy.length} dokumen. Super Admin yakin ingin menghapus secara paksa (force delete)?`
          : "Pindahkan berkas ini ke tempat sampah?",
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      await api.delete(`/file-management/files/${file.id}?force=${force}`);
      toast("Berkas berhasil dipindahkan ke tempat sampah.", "success");
      onFileUpdated();
      onClose();
    } catch (e) {
      toast((e as Error).message, "danger");
    } finally {
      setDeleting(false);
    }
  };

  if (!visible) return null;

  return (
    <>
      <Dialog open={visible} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="sm:max-w-2xl bg-card p-4 sm:p-6 gap-0">
          {/* Header */}
          <View className="mb-4 flex-row items-center justify-between border-b border-border pb-3 pr-8">
            <View className="flex-1 min-w-0 flex-row items-center gap-2.5">
              <View className="rounded-xl p-2 shrink-0" style={{ backgroundColor: `${colors.primary}1A` }}>
                <FileText size={20} color={colors.primary} />
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-base font-bold text-foreground" numberOfLines={1} ellipsizeMode="middle">
                  {file?.displayName || "Detail Berkas"}
                </Text>
                <Text className="text-xs font-mono text-muted-foreground" numberOfLines={1}>
                  {file?.fileCode}
                </Text>
              </View>
            </View>
          </View>

          {loading || !file ? (
            <View className="items-center justify-center py-16">
              <ActivityIndicator size="large" color={colors.primary} />
              <Text className="mt-2 text-xs text-muted-foreground">Memuat informasi berkas...</Text>
            </View>
          ) : (
            <ScrollView className="flex-1 space-y-4" showsVerticalScrollIndicator={false}>
              {/* Ringkasan Status & Penyimpanan */}
              <View className="flex-row flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/20 p-3 border border-border/70">
                <View className="flex-row items-center gap-2">
                  <FileKindBadge kind={file.kind} extension={file.extension} />
                  <FileStatusBadge status={file.status} />
                  <ProviderTypeBadge
                    type={file.primaryLocation?.provider?.type || "LOCAL"}
                    isDefault={file.primaryLocation?.provider?.isDefault}
                  />
                </View>
                <Text className="text-xs font-bold text-foreground">
                  {formatBytes(file.size)}
                </Text>
              </View>

              {/* Pratinjau / Preview Berkas Interaktif */}
              {(() => {
                const fileUrl = authFileUrl(file.id);
                const ext = (file.extension || file.displayName?.split(".").pop() || "").toLowerCase();
                const isImage = file.kind === "FOTO" || ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext);
                const isPdf = ext === "pdf" || file.mimeType === "application/pdf";
                const isVideo = file.kind === "VIDEO" || ["mp4", "webm", "mkv"].includes(ext);

                if (isImage) {
                  return (
                    <View className="rounded-2xl border border-border overflow-hidden bg-muted/20 items-center justify-center p-2 relative">
                      <Image
                        source={{ uri: fileUrl }}
                        style={{ width: "100%", height: 220 }}
                        resizeMode="contain"
                      />
                      <View className="absolute bottom-3 right-3 flex-row gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onPress={handleOpenPreview}
                          className="gap-1.5 shadow-md bg-background/90"
                        >
                          <Eye size={13} color={colors.primary} />
                          <Text className="text-xs font-semibold">Buka Gambar Penuh</Text>
                        </Button>
                      </View>
                    </View>
                  );
                }

                if (isPdf) {
                  return (
                    <View className="rounded-2xl border border-border overflow-hidden bg-card">
                      <View className="flex-row items-center justify-between px-3.5 py-2 bg-muted/30 border-b border-border/60">
                        <View className="flex-row items-center gap-1.5">
                          <FileText size={15} color="#EF4444" />
                          <Text className="text-xs font-bold text-foreground">Pratinjau Dokumen PDF</Text>
                        </View>
                        <Button
                          size="sm"
                          variant="ghost"
                          onPress={handleOpenPreview}
                          className="gap-1 h-7 px-2"
                        >
                          <ExternalLink size={12} color={colors.primary} />
                          <Text className="text-[11px] font-semibold text-primary">Buka di Tab Baru</Text>
                        </Button>
                      </View>
                      {Platform.OS === "web" ? (
                        <iframe
                          src={fileUrl}
                          title={file.displayName}
                          style={{ width: "100%", height: "260px", border: "none" }}
                        />
                      ) : (
                        <View className="p-4 items-center justify-center space-y-2">
                          <Text className="text-xs text-muted-foreground">Pratinjau dokumen PDF siap dibuka</Text>
                          <Button size="sm" onPress={handleOpenPreview} className="gap-1.5">
                            <Eye size={13} color="#FFF" />
                            <Text className="text-xs text-white font-semibold">Buka PDF</Text>
                          </Button>
                        </View>
                      )}
                    </View>
                  );
                }

                if (isVideo) {
                  return (
                    <View className="rounded-2xl border border-border overflow-hidden bg-black/90 items-center justify-center p-1">
                      {Platform.OS === "web" ? (
                        <video
                          src={fileUrl}
                          controls
                          style={{ width: "100%", maxHeight: "240px", borderRadius: "12px" }}
                        />
                      ) : (
                        <View className="p-4 items-center justify-center space-y-2">
                          <Text className="text-xs text-white">Video Dokumentasi</Text>
                          <Button size="sm" onPress={handleOpenPreview} className="gap-1.5">
                            <Eye size={13} color="#FFF" />
                            <Text className="text-xs text-white font-semibold">Putar Video</Text>
                          </Button>
                        </View>
                      )}
                    </View>
                  );
                }

                return (
                  <View className="rounded-2xl border border-border p-3.5 bg-muted/20 flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <View className="flex-row items-center gap-2.5 flex-1 min-w-0 pr-2">
                      <View className="rounded-xl p-2 bg-primary/10 shrink-0">
                        <FileText size={22} color={colors.primary} />
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text className="text-xs font-bold text-foreground" numberOfLines={1} ellipsizeMode="middle">
                          {file.displayName}
                        </Text>
                        <Text className="text-[11px] text-muted-foreground">
                          {file.mimeType || "Berkas Dokumen"} • {formatBytes(file.size)}
                        </Text>
                      </View>
                    </View>
                    <Button size="sm" variant="outline" onPress={handleOpenPreview} className="gap-1.5 self-start sm:self-auto">
                      <ExternalLink size={13} color={colors.primary} />
                      <Text className="text-xs font-semibold">Buka / Pratinjau</Text>
                    </Button>
                  </View>
                );
              })()}

              {/* Data Dokumen / Transaksi Terhubung */}
              <View className="gap-2 rounded-xl border border-border p-3.5">
                <Text className="text-xs font-bold text-foreground">
                  Dokumen & Transaksi Terhubung ({file.usedBy?.length || 0})
                </Text>

                {file.usedBy && file.usedBy.length > 0 ? (
                  <View className="flex-row flex-wrap gap-1.5">
                    {file.usedBy.map((doc: any, idx: number) => (
                      <View
                        key={idx}
                        className="flex-row items-center gap-1.5 rounded-lg border border-border/80 bg-muted/40 px-2.5 py-1"
                      >
                        <Text className="text-[11px] font-semibold text-foreground">
                          {doc.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View className="flex-row items-center gap-2 rounded-lg bg-amber-500/10 p-2.5 border border-amber-500/20">
                    <AlertTriangle size={16} color="#D97706" />
                    <View className="flex-1">
                      <Text className="text-xs font-bold text-amber-800">Berkas Lepas (Standalone File)</Text>
                      <Text className="text-[11px] text-amber-700">
                        Berkas ini tidak terhubung ke transaksi manapun (mandiri). Berkas lepas aman untuk dibersihkan atau ditautkan kembali.
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Lokasi Fisik Penyimpanan */}
              <View className="gap-2 rounded-xl border border-border p-3.5">
                <Text className="text-xs font-bold text-foreground">Lokasi Fisik Berkas</Text>
                <View className="gap-1.5 text-xs text-muted-foreground">
                  <View className="flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                    <Text className="text-xs text-muted-foreground">Penyimpanan Primer:</Text>
                    <View className="flex-row items-center gap-1.5">
                      <Text className="text-xs font-bold text-foreground">
                        {file.primaryLocation?.provider?.name || "Server Lokal"}
                      </Text>
                      <View className="rounded bg-emerald-500/10 px-1.5 py-0.2">
                        <Text className="text-[10px] font-bold text-emerald-700">Aktif</Text>
                      </View>
                    </View>
                  </View>
                  <View className="flex-col sm:flex-row sm:justify-between gap-1">
                    <Text className="text-xs text-muted-foreground">Object Key / Path:</Text>
                    <Text className="text-xs font-mono text-foreground break-all" numberOfLines={2} ellipsizeMode="middle">
                      {file.primaryLocation?.storageKey || file.path}
                    </Text>
                  </View>
                  <View className="flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                    <Text className="text-xs text-muted-foreground">Integritas Checksum:</Text>
                    <View className="flex-row items-center gap-1 min-w-0">
                      <Text className="text-[11px] font-mono text-foreground flex-1 sm:flex-initial sm:max-w-[200px]" numberOfLines={1} ellipsizeMode="middle">
                        {file.checksumSha256 || "Belum di-hash"}
                      </Text>
                      {file.checksumSha256 ? (
                        <Pressable onPress={copyChecksum} className="p-0.5 shrink-0">
                          <Copy size={12} color={colors.primary} />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>

                  {/* Fallback Salinan Cadangan Lokal Pasca-Migrasi */}
                  {(() => {
                    const localFallback = file.locations?.find(
                      (l: any) =>
                        !l.isPrimary &&
                        (l.provider?.type === "LOCAL" || l.replicaStatus === "PENDING_CLEANUP") &&
                        l.replicaStatus !== "CLEANED",
                    );
                    if (!localFallback) return null;
                    return (
                      <View className="mt-2 pt-2 border-t border-border/60 flex-row items-center justify-between bg-muted/20 p-2.5 rounded-lg">
                        <View className="flex-1 pr-2">
                          <View className="flex-row items-center gap-1.5">
                            <Text className="text-xs font-bold text-foreground">Cadangan Lokal (Fallback):</Text>
                            <View className="rounded bg-amber-500/10 px-1.5 py-0.2">
                              <Text className="text-[10px] font-semibold text-amber-700">Aktif Jika NAS Offline</Text>
                            </View>
                          </View>
                          <Text className="text-[11px] text-muted-foreground mt-0.5 font-mono" numberOfLines={1}>
                            {localFallback.storageKey}
                          </Text>
                        </View>
                        <Button
                          size="sm"
                          variant="outline"
                          onPress={handleCleanupLocalCopy}
                          disabled={cleaningLocal}
                          className="h-7 px-2 border-amber-600/40"
                        >
                          <Text className="text-[11px] font-semibold text-amber-700">
                            {cleaningLocal ? "Membersihkan..." : "Bersihkan Lokal"}
                          </Text>
                        </Button>
                      </View>
                    );
                  })()}
                </View>
              </View>

              {/* Riwayat Versi (Versioning) */}
              <View className="gap-2 rounded-xl border border-border p-3.5">
                <Text className="text-xs font-bold text-foreground">
                  Riwayat Versi Dokumen ({file.versions?.length || 1})
                </Text>
                <View className="divide-y divide-border/60">
                  {file.versions?.map((v: any) => (
                    <View key={v.id} className="flex-row items-center justify-between py-2">
                      <View className="flex-row items-center gap-2">
                        <View
                          className="rounded-full px-2 py-0.5"
                          style={{
                            backgroundColor: v.status === "CURRENT" ? `${colors.primary}1A` : "rgba(0,0,0,0.05)",
                          }}
                        >
                          <Text
                            className="text-[10px] font-bold"
                            style={{ color: v.status === "CURRENT" ? colors.primary : undefined }}
                          >
                            v{v.versionNumber} {v.status === "CURRENT" ? "(Aktif)" : ""}
                          </Text>
                        </View>
                        <Text className="text-xs text-foreground">{v.fileName}</Text>
                      </View>
                      <Text className="text-[11px] font-mono text-muted-foreground">
                        {formatBytes(v.fileSize)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
          )}

          {/* Footer Actions */}
          <View className="mt-4 flex-row flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <Button
              variant="destructive"
              size="sm"
              onPress={handleDelete}
              disabled={deleting}
              className="gap-1.5 h-9"
            >
              <Trash2 size={14} />
              <Text className="text-xs text-white font-medium">Hapus</Text>
            </Button>

            <View className="flex-row flex-wrap items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onPress={() => setShareOpen(true)}
                className="gap-1.5 h-9 px-2.5"
              >
                <Share2 size={13} />
                <Text className="text-xs font-medium">Bagikan</Text>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onPress={() => setReplaceOpen(true)}
                className="gap-1.5 h-9 px-2.5"
              >
                <UploadCloud size={13} />
                <Text className="text-xs font-medium">Ganti</Text>
              </Button>

              <Button
                size="sm"
                onPress={handleOpenPreview}
                className="gap-1.5 h-9 px-2.5"
                style={{ backgroundColor: colors.primary }}
              >
                <Eye size={13} color="#FFF" />
                <Text className="text-xs text-white font-semibold">Lihat</Text>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onPress={handleDownload}
                className="gap-1.5 h-9 px-2.5"
              >
                <Download size={13} color={colors.primary} />
                <Text className="text-xs font-semibold">Unduh</Text>
              </Button>
            </View>
          </View>
        </DialogContent>
      </Dialog>

      {/* Modal Ganti Berkas */}
      <FileReplaceDialog
        visible={replaceOpen}
        onClose={() => setReplaceOpen(false)}
        file={file}
        onSuccess={() => {
          loadDetail();
          onFileUpdated();
        }}
      />

      {/* Modal Share Link */}
      <FileShareDialog
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        file={file}
      />
    </>
  );
}
