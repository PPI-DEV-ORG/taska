import * as React from "react";
import { ActivityIndicator, Modal, Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { colors } from "@/tokens";
import { api, apiOrigin } from "@/services/api";
import { useApp } from "@/store/app-store";
import {
  Share2,
  X,
  Copy,
  CheckCircle2,
  Lock,
  Clock,
  ExternalLink,
  Infinity as InfinityIcon,
} from "lucide-react-native";
import type { FileItem } from "./types";

const DURATION_OPTIONS = [
  { value: 1, label: "1 Hari" },
  { value: 3, label: "3 Hari" },
  { value: 7, label: "7 Hari" },
  { value: 30, label: "30 Hari" },
  { value: 0, label: "Selamanya" },
];

export function FileShareDialog({
  visible,
  onClose,
  file,
}: {
  visible: boolean;
  onClose: () => void;
  file?: FileItem | null;
}) {
  const { toast } = useApp();

  const [days, setDays] = React.useState<number>(3);
  const [permission, setPermission] = React.useState<"VIEW" | "DOWNLOAD">("VIEW");
  const [password, setPassword] = React.useState<string>("");
  const [oneTime, setOneTime] = React.useState<boolean>(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [createdShare, setCreatedShare] = React.useState<any | null>(null);
  const [wasVisible, setWasVisible] = React.useState(visible);

  if (visible && !wasVisible) {
    setWasVisible(true);
    setDays(3);
    setPermission("VIEW");
    setPassword("");
    setOneTime(false);
    setCreatedShare(null);
  } else if (!visible && wasVisible) {
    setWasVisible(false);
  }

  const handleCreate = async () => {
    if (!file) return;

    setSubmitting(true);
    try {
      // Jika days === 0, kirim "forever" agar berlaku permanen / selamanya
      const expires =
        days === 0
          ? "forever"
          : new Date(Date.now() + days * 86400 * 1000).toISOString();

      const res = await api.post<any>(`/file-management/files/${file.id}/shares`, {
        expiresAt: expires,
        permission,
        password: password.trim() || undefined,
        oneTime,
      });
      setCreatedShare(res);
      toast("Tautan berbagi berhasil dibuat!", "success");
    } catch (e) {
      toast((e as Error).message, "danger");
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    if (!text) return;
    let copied = false;

    // 1. Coba Modern Clipboard API (HTTPS / Localhost)
    if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch {
        copied = false;
      }
    }

    // 2. Fallback untuk HTTP IP LAN / Insecure Context / WebView
    if (!copied && typeof document !== "undefined") {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
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
      toast("Tautan berhasil disalin ke clipboard!", "success");
    } else {
      toast("Silakan salin tautan langsung dari kolom teks.", "info");
    }
  };

  const handleOpenLink = (url: string) => {
    if (typeof window !== "undefined") {
      window.open(url, "_blank");
    }
  };

  if (!file) return null;

  const fullShareUrl = createdShare
    ? `${apiOrigin()}${createdShare.shareUrl}`
    : "";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/60 p-4">
        <View className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
          {/* Header */}
          <View className="mb-4 flex-row items-center justify-between border-b border-border pb-3">
            <View className="flex-row items-center gap-2.5">
              <View className="rounded-xl p-2" style={{ backgroundColor: `${colors.primary}1A` }}>
                <Share2 size={20} color={colors.primary} />
              </View>
              <View className="flex-1 pr-2">
                <Text className="text-base font-bold text-foreground">Bagikan Berkas</Text>
                <Text className="text-xs text-muted-foreground" numberOfLines={1}>{file.displayName}</Text>
              </View>
            </View>
            <Pressable onPress={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
              <X size={18} />
            </Pressable>
          </View>

          {createdShare ? (
            /* Tampilan Sukses Tautan Terbuat */
            <View className="space-y-4">
              <View className="items-center justify-center rounded-xl bg-emerald-500/10 p-4 border border-emerald-500/20">
                <CheckCircle2 size={32} color="#10B981" />
                <Text className="mt-2 text-sm font-bold text-emerald-800">Tautan Berbagi Siap</Text>
                <Text className="text-[11px] text-emerald-700 text-center mt-1">
                  Kirimkan tautan lengkap ini kepada pihak yang berkepentingan.
                </Text>
              </View>

              <View className="gap-2 rounded-xl border border-border bg-muted/20 p-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-[10px] font-semibold uppercase text-muted-foreground">URL Lengkap Berbagi</Text>
                  <View className="flex-row items-center gap-1">
                    <Clock size={11} className="text-muted-foreground" />
                    <Text className="text-[10px] font-medium text-muted-foreground">
                      {createdShare.isForever || days === 0
                        ? "Berlaku Selamanya"
                        : `Berlaku ${days} hari`}
                    </Text>
                  </View>
                </View>

                {/* Box URL Lengkap */}
                <View className="flex-row items-center justify-between rounded-lg bg-background p-2 border border-border gap-2">
                  <Text
                    className="text-xs font-mono flex-1 text-foreground select-all break-all"
                    numberOfLines={2}
                    selectable
                  >
                    {fullShareUrl}
                  </Text>

                  <View className="flex-row items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => copyToClipboard(fullShareUrl)}
                      className="h-8 px-2.5 gap-1"
                    >
                      <Copy size={13} color={colors.primary} />
                      <Text className="text-xs font-semibold" style={{ color: colors.primary }}>Salin</Text>
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onPress={() => handleOpenLink(fullShareUrl)}
                      className="h-8 px-2"
                    >
                      <ExternalLink size={14} className="text-muted-foreground" />
                    </Button>
                  </View>
                </View>

                {/* Info Tambahan Proteksi */}
                <View className="flex-row flex-wrap gap-1.5 pt-1">
                  {createdShare.hasPassword ? (
                    <View className="flex-row items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 border border-amber-500/20">
                      <Lock size={10} color="#D97706" />
                      <Text className="text-[10px] text-amber-800 font-semibold">Dilindungi Kata Sandi</Text>
                    </View>
                  ) : null}
                  {createdShare.oneTime ? (
                    <View className="rounded bg-sky-500/10 px-2 py-0.5 border border-sky-500/20">
                      <Text className="text-[10px] text-sky-800 font-semibold">Sekali Pakai (Auto Hangus)</Text>
                    </View>
                  ) : null}
                  <View className="rounded bg-muted px-2 py-0.5">
                    <Text className="text-[10px] text-muted-foreground">
                      {createdShare.permission === "DOWNLOAD" ? "Izin Unduh" : "Hanya Pratinjau"}
                    </Text>
                  </View>
                </View>
              </View>

              <View className="mt-4 flex-row justify-end">
                <Button size="sm" onPress={onClose} style={{ backgroundColor: colors.primary }}>
                  <Text className="text-white font-semibold">Selesai</Text>
                </Button>
              </View>
            </View>
          ) : (
            /* Form Konfigurasi Tautan */
            <View className="space-y-4">
              {/* Durasi */}
              <View className="gap-1.5">
                <Text className="text-xs font-semibold text-foreground">Masa Berlaku Tautan</Text>
                <View className="flex-row gap-1.5 flex-wrap">
                  {DURATION_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.value}
                      onPress={() => setDays(opt.value)}
                      className="flex-1 min-w-[64px] items-center rounded-lg border py-2 px-1"
                      style={{
                        borderColor: days === opt.value ? colors.primary : "transparent",
                        backgroundColor: days === opt.value ? `${colors.primary}14` : "rgba(0,0,0,0.04)",
                      }}
                    >
                      <Text
                        className="text-xs font-semibold"
                        style={{ color: days === opt.value ? colors.primary : undefined }}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Izin Akses */}
              <View className="gap-1.5">
                <Text className="text-xs font-semibold text-foreground">Hak Akses Tautan</Text>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => setPermission("VIEW")}
                    className="flex-1 items-center rounded-lg border p-2.5"
                    style={{
                      borderColor: permission === "VIEW" ? colors.primary : "transparent",
                      backgroundColor: permission === "VIEW" ? `${colors.primary}14` : "rgba(0,0,0,0.04)",
                    }}
                  >
                    <Text
                      className="text-xs font-semibold"
                      style={{ color: permission === "VIEW" ? colors.primary : undefined }}
                    >
                      Hanya Pratinjau
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setPermission("DOWNLOAD")}
                    className="flex-1 items-center rounded-lg border p-2.5"
                    style={{
                      borderColor: permission === "DOWNLOAD" ? colors.primary : "transparent",
                      backgroundColor: permission === "DOWNLOAD" ? `${colors.primary}14` : "rgba(0,0,0,0.04)",
                    }}
                  >
                    <Text
                      className="text-xs font-semibold"
                      style={{ color: permission === "DOWNLOAD" ? colors.primary : undefined }}
                    >
                      Boleh Unduh
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Kata Sandi (Opsional) */}
              <View className="gap-1">
                <Text className="text-xs font-semibold text-foreground">
                  Kata Sandi Pengaman (Opsional)
                </Text>
                <Input
                  placeholder="Kosongkan jika bebas sandi"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              {/* Sekali Pakai */}
              <Pressable
                onPress={() => setOneTime(!oneTime)}
                className="flex-row items-center gap-2 rounded-xl border border-border p-2.5"
              >
                <View
                  className="h-4 w-4 rounded border items-center justify-center"
                  style={{
                    backgroundColor: oneTime ? colors.primary : "transparent",
                    borderColor: oneTime ? colors.primary : "#94A3B8",
                  }}
                >
                  {oneTime ? <CheckCircle2 size={12} color="#FFF" /> : null}
                </View>
                <Text className="text-xs text-foreground">
                  Tautan sekali pakai (hangus setelah dibuka pertama kali)
                </Text>
              </Pressable>

              {/* Footer */}
              <View className="mt-4 flex-row justify-end gap-2 border-t border-border pt-3">
                <Button variant="ghost" size="sm" onPress={onClose} disabled={submitting}>
                  <Text>Batal</Text>
                </Button>
                <Button
                  size="sm"
                  onPress={handleCreate}
                  disabled={submitting}
                  style={{ backgroundColor: colors.primary }}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text className="text-white font-semibold">Buat Tautan</Text>
                  )}
                </Button>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
