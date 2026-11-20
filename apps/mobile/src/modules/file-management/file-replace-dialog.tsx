import * as React from "react";
import { ActivityIndicator, Modal, Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { colors } from "@/tokens";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import {
  UploadCloud,
  X,
  FileCheck,
  AlertTriangle,
} from "lucide-react-native";
import type { FileItem } from "./types";

export function FileReplaceDialog({
  visible,
  onClose,
  onSuccess,
  file,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  file?: FileItem | null;
}) {
  const { toast } = useApp();
  const [selectedFile, setSelectedFile] = React.useState<any | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const handlePickFile = () => {
    // Pada web browser / web platform
    if (typeof document !== "undefined") {
      const input = document.createElement("input");
      input.type = "file";
      input.onchange = (e: any) => {
        const f = e.target?.files?.[0];
        if (f) {
          setSelectedFile(f);
        }
      };
      input.click();
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedFile) {
      toast("Pilih berkas pengganti terlebih dahulu", "danger");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      await api.put(`/file-management/files/${file.id}/replace`, formData);
      toast("Berkas berhasil diperbarui ke versi baru!", "success");
      onSuccess();
      onClose();
    } catch (e) {
      toast((e as Error).message, "danger");
    } finally {
      setSubmitting(false);
    }
  };

  if (!file) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/60 p-3 sm:p-4">
        <View className="w-[94vw] max-w-md rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-2xl">
          {/* Header */}
          <View className="mb-4 flex-row items-center justify-between border-b border-border pb-3 pr-1">
            <View className="flex-1 min-w-0 mr-3 flex-row items-center gap-2.5">
              <View className="rounded-xl p-2 shrink-0" style={{ backgroundColor: `${colors.primary}1A` }}>
                <UploadCloud size={20} color={colors.primary} />
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-base font-bold text-foreground" numberOfLines={1}>Ganti Berkas</Text>
                <Text className="text-xs text-muted-foreground" numberOfLines={1} ellipsizeMode="middle">{file.displayName}</Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={12} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted shrink-0">
              <X size={20} />
            </Pressable>
          </View>

          <View className="space-y-4">
            <View className="gap-2 rounded-xl border border-border/80 bg-muted/20 p-3">
              <View className="flex-row items-center gap-1.5">
                <FileCheck size={14} color={colors.primary} />
                <Text className="text-xs font-semibold text-foreground">Prinsip Versioning PRD</Text>
              </View>
              <Text className="text-[11px] text-muted-foreground">
                ID berkas tetap sama sehingga seluruh dokumen ({file.usedBy.length} relasi transaksi) tetap terhubung secara otomatis ke versi terbaru.
              </Text>
            </View>

            {/* Area Pilih Berkas */}
            <Pressable
              onPress={handlePickFile}
              className="items-center justify-center rounded-xl border-2 border-dashed border-border/90 bg-muted/10 p-6 hover:bg-muted/30"
            >
              <UploadCloud size={32} color={colors.primary} />
              <Text className="mt-2 text-xs font-bold text-foreground">
                {selectedFile ? selectedFile.name : "Klik untuk Memilih Berkas Pengganti"}
              </Text>
              {selectedFile ? (
                <Text className="text-[10px] text-muted-foreground">
                  Ukuran: {(selectedFile.size / 1024).toFixed(1)} KB
                </Text>
              ) : (
                <Text className="text-[10px] text-muted-foreground">PDF, Gambar, Excel, dsb</Text>
              )}
            </Pressable>
          </View>

          {/* Footer */}
          <View className="mt-6 flex-row justify-end gap-2 border-t border-border pt-3">
            <Button variant="ghost" size="sm" onPress={onClose} disabled={submitting}>
              <Text>Batal</Text>
            </Button>
            <Button
              size="sm"
              onPress={handleUpload}
              disabled={submitting || !selectedFile}
              style={{ backgroundColor: colors.primary }}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text className="text-white font-semibold">Unggah Versi Baru</Text>
              )}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}
