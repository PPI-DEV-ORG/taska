import * as React from "react";
import { ActivityIndicator, Modal, Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { colors } from "@/tokens";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import {
  Share2,
  X,
  Copy,
  CheckCircle2,
  Lock,
  Clock,
  ExternalLink,
} from "lucide-react-native";
import type { FileItem } from "./types";

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
      const expires = new Date(Date.now() + days * 86400 * 1000).toISOString();
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

  const copyToClipboard = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      const fullUrl = `${window.location.origin}${text}`;
      navigator.clipboard.writeText(fullUrl);
      toast("Tautan berhasil disalin ke clipboard!", "success");
    }
  };

  if (!file) return null;

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
              <View>
                <Text className="text-base font-bold text-foreground">Bagikan Berkas</Text>
                <Text className="text-xs text-muted-foreground">{file.displayName}</Text>
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
                  Kirimkan tautan acak terenkripsi ini kepada pihak yang berkepentingan.
                </Text>
              </View>

              <View className="gap-1.5 rounded-xl border border-border bg-muted/20 p-3">
                <Text className="text-[10px] font-semibold uppercase text-muted-foreground">URL Berbagi</Text>
                <View className="flex-row items-center justify-between rounded-lg bg-background p-2 border border-border">
                  <Text className="text-xs font-mono flex-1 text-foreground" numberOfLines={1}>
                    {createdShare.shareUrl}
                  </Text>
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => copyToClipboard(createdShare.shareUrl)}
                  >
                    <Copy size={14} />
                  </Button>
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
                <View className="flex-row gap-1.5">
                  {[1, 3, 7, 30].map((d) => (
                    <Pressable
                      key={d}
                      onPress={() => setDays(d)}
                      className="flex-1 items-center rounded-lg border py-2"
                      style={{
                        borderColor: days === d ? colors.primary : "transparent",
                        backgroundColor: days === d ? `${colors.primary}14` : "rgba(0,0,0,0.04)",
                      }}
                    >
                      <Text
                        className="text-xs font-semibold"
                        style={{ color: days === d ? colors.primary : undefined }}
                      >
                        {d} Hari
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
