import * as React from "react";
import { Image, View, ActivityIndicator } from "react-native";
import { MessageSquare, RefreshCw, Power, CheckCircle2, AlertCircle } from "lucide-react-native";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { api } from "@/services/api";
import { colors } from "@/tokens";
import { useApp } from "@/store/app-store";

export function WhatsappDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useApp();
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState<"DISCONNECTED" | "CONNECTING" | "SCAN_QR" | "CONNECTED">("DISCONNECTED");
  const [qr, setQr] = React.useState<string | null>(null);
  const [connectedPhone, setConnectedPhone] = React.useState<string | null>(null);
  const [connectedName, setConnectedName] = React.useState<string | null>(null);

  const fetchStatus = React.useCallback(async () => {
    try {
      const res = await api<{
        status: "DISCONNECTED" | "CONNECTING" | "SCAN_QR" | "CONNECTED";
        qr: string | null;
        connectedPhone: string | null;
        connectedName: string | null;
      }>("GET", "/whatsapp/status");
      setStatus(res.status);
      setQr(res.qr);
      setConnectedPhone(res.connectedPhone);
      setConnectedName(res.connectedName);
    } catch {
      setStatus("DISCONNECTED");
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const timeout = setTimeout(() => {
      void fetchStatus();
    }, 0);
    const interval = setInterval(() => {
      void fetchStatus();
    }, 3000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [open, fetchStatus]);

  async function handleRestart() {
    setLoading(true);
    try {
      await api("POST", "/whatsapp/restart");
      toast("Koneksi WhatsApp sedang dimuat ulang...");
      await fetchStatus();
    } catch (err: any) {
      toast(err?.message || "Gagal memuat ulang koneksi", "danger");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoading(true);
    try {
      await api("POST", "/whatsapp/logout");
      toast("Berhasil memutuskan sesi WhatsApp", "warning");
      await fetchStatus();
    } catch (err: any) {
      toast(err?.message || "Gagal logout WhatsApp", "danger");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <View className="flex-row items-center gap-2">
            <MessageSquare size={20} color="#22c55e" />
            <DialogTitle>Koneksi WhatsApp Bot Teknisi</DialogTitle>
          </View>
        </DialogHeader>

        <View className="gap-4 py-2">
          {/* Status Badge */}
          <View className="flex-row items-center justify-between rounded-lg border border-border bg-card p-3">
            <View>
              <Text className="text-xs text-muted-foreground">Status Bot</Text>
              <Text className="text-sm font-bold text-foreground">
                {status === "CONNECTED" && "Terhubung (Online)"}
                {status === "SCAN_QR" && "Menunggu Scan QR"}
                {status === "CONNECTING" && "Menghubungkan..."}
                {status === "DISCONNECTED" && "Terputus (Offline)"}
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              {status === "CONNECTED" ? (
                <CheckCircle2 size={16} color="#22c55e" />
              ) : status === "SCAN_QR" || status === "CONNECTING" ? (
                <ActivityIndicator size="small" color="#eab308" />
              ) : (
                <AlertCircle size={16} color="#ef4444" />
              )}
            </View>
          </View>

          {/* Connected State */}
          {status === "CONNECTED" && (
            <View className="items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
              <Text className="text-center text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                Bot Aktif & Siap Menerima Laporan Foto
              </Text>
              <Text className="text-xs text-muted-foreground">
                Akun: <Text className="font-bold text-foreground">{connectedName || "Bot"}</Text> ({connectedPhone || "-"})
              </Text>
              <Text className="text-center text-[11px] text-muted-foreground mt-1">
                Teknisi yang mengirim foto/laporan ke nomor ini akan otomatis diidentifikasi dan laporannya di-attach ke ERP.
              </Text>
            </View>
          )}

          {/* QR Code State */}
          {(status === "SCAN_QR" || (!connectedPhone && qr)) && qr && (
            <View className="items-center gap-3 rounded-lg border border-border bg-card p-4">
              <Text className="text-center text-xs font-medium text-foreground">
                Scan QR Code ini menggunakan aplikasi WhatsApp di HP Kantor:
              </Text>
              <View className="bg-white p-3 rounded-xl border border-zinc-300 shadow-sm">
                <Image source={{ uri: qr }} style={{ width: 200, height: 200 }} resizeMode="contain" />
              </View>
              <Text className="text-center text-[11px] text-muted-foreground">
                Buka WhatsApp &gt; Perangkat Tertaut &gt; Tautkan Perangkat. QR berganti otomatis.
              </Text>
            </View>
          )}

          {/* Connecting State */}
          {status === "CONNECTING" && !qr && (
            <View className="items-center gap-2 py-8">
              <ActivityIndicator size="large" color={colors.primary} />
              <Text className="text-xs text-muted-foreground">Menyiapkan koneksi WhatsApp Baileys...</Text>
            </View>
          )}
        </View>

        <DialogFooter className="flex-row items-center justify-between gap-2">
          {status === "CONNECTED" ? (
            <Button variant="outline" size="sm" disabled={loading} onPress={handleLogout} className="border-rose-500/30 gap-1.5">
              <Power size={14} color="#ef4444" />
              <Text className="text-rose-500">Putuskan Sesi</Text>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled={loading} onPress={handleRestart} className="gap-1.5">
              <RefreshCw size={14} color={colors.foreground} />
              <Text>Muat Ulang QR</Text>
            </Button>
          )}

          <Button size="sm" onPress={() => onOpenChange(false)}>
            <Text>Tutup</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

