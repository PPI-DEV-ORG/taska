import * as React from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, View } from "react-native";
import {
  AlertCircle,
  Bell,
  Check,
  CheckCircle2,
  MessageSquare,
  Power,
  RefreshCw,
  Send,
  Users,
} from "lucide-react-native";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { api } from "@/services/api";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app-store";
import { CATEGORY_META, MANUAL_CATEGORY_KEYS } from "@/modules/calendar/types";

type WaGroupOption = {
  id: string;
  subject: string;
  participantCount: number;
};

type WaScheduleSettings = {
  enabled: boolean;
  groupJids: string[];
  groupNames: Record<string, string>;
  dailyEnabled: boolean;
  dailyTime: string;
  dailyTarget: "TOMORROW" | "TODAY";
  weeklyEnabled: boolean;
  weeklyDay: number;
  weeklyTime: string;
  updateNotifyEnabled: boolean;
  updateNotifyOnCreate: boolean;
  updateNotifyOnUpdate: boolean;
  updateNotifyOnCancel: boolean;
  updateCooldownMinutes: number;
  includedCategories: string[];
  skipEmptyRecap: boolean;
};

const DEFAULT_SETTINGS: WaScheduleSettings = {
  enabled: false,
  groupJids: [],
  groupNames: {},
  dailyEnabled: true,
  dailyTime: "16:00",
  dailyTarget: "TOMORROW",
  weeklyEnabled: true,
  weeklyDay: 6,
  weeklyTime: "16:00",
  updateNotifyEnabled: true,
  updateNotifyOnCreate: true,
  updateNotifyOnUpdate: true,
  updateNotifyOnCancel: true,
  updateCooldownMinutes: 5,
  includedCategories: [
    "MEETING", "SALES", "KUNJUNGAN", "MAINTENANCE", "POC",
    "SURVEY", "PROJECT", "TASK", "OPERATIONAL", "OTHER",
  ],
  skipEmptyRecap: true,
};

const DAYS_OF_WEEK = [
  { value: 0, label: "Minggu" },
  { value: 1, label: "Senin" },
  { value: 2, label: "Selasa" },
  { value: 3, label: "Rabu" },
  { value: 4, label: "Kamis" },
  { value: 5, label: "Jumat" },
  { value: 6, label: "Sabtu" },
];

function TogglePill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        "min-h-[32px] flex-row items-center gap-1.5 rounded-full border px-3 py-1",
        active ? "border-emerald-500/60 bg-emerald-500/15" : "border-border bg-card",
      )}
    >
      {active ? <Check size={12} color="#10b981" /> : null}
      <Text className={cn("text-xs", active ? "font-semibold text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
        {label}
      </Text>
    </Pressable>
  );
}

export function WhatsappDialog({
  open,
  onOpenChange,
  initialTab = "connection",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialTab?: "connection" | "schedule";
}) {
  const { toast } = useApp();
  const [tab, setTab] = React.useState<"connection" | "schedule">(initialTab);
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState<"DISCONNECTED" | "CONNECTING" | "SCAN_QR" | "CONNECTED">("DISCONNECTED");
  const [qr, setQr] = React.useState<string | null>(null);
  const [connectedPhone, setConnectedPhone] = React.useState<string | null>(null);
  const [connectedName, setConnectedName] = React.useState<string | null>(null);

  // Schedule notification state
  const [settings, setSettings] = React.useState<WaScheduleSettings>(DEFAULT_SETTINGS);
  const [loadingSettings, setLoadingSettings] = React.useState(false);
  const [savingSettings, setSavingSettings] = React.useState(false);
  const [sendingType, setSendingType] = React.useState<"TEST" | "DAILY" | "WEEKLY" | null>(null);
  const [groups, setGroups] = React.useState<WaGroupOption[]>([]);
  const [loadingGroups, setLoadingGroups] = React.useState(false);
  const [manualGroupJid, setManualGroupJid] = React.useState("");

  const [prevOpen, setPrevOpen] = React.useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setTab(initialTab);
  }

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

  const fetchGroups = React.useCallback(async () => {
    setLoadingGroups(true);
    try {
      const res = await api<{ connected: boolean; groups: WaGroupOption[] }>("GET", "/whatsapp/groups");
      setGroups(res.groups ?? []);
    } catch {
      setGroups([]);
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  const fetchSettings = React.useCallback(async () => {
    setLoadingSettings(true);
    try {
      const res = await api<WaScheduleSettings>("GET", "/whatsapp/schedule-notification/settings");
      setSettings({ ...DEFAULT_SETTINGS, ...res });
    } catch {
      // ignore
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const timeout = setTimeout(() => {
      void fetchStatus();
      void fetchSettings();
      void fetchGroups();
    }, 0);
    const interval = setInterval(() => {
      void fetchStatus();
    }, 4000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [open, fetchStatus, fetchSettings, fetchGroups]);

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

  function toggleGroup(g: WaGroupOption) {
    setSettings((prev) => {
      const exists = prev.groupJids.includes(g.id);
      const groupJids = exists
        ? prev.groupJids.filter((x) => x !== g.id)
        : [...prev.groupJids, g.id];
      const groupNames = { ...prev.groupNames, [g.id]: g.subject };
      return { ...prev, groupJids, groupNames };
    });
  }

  function addManualGroup() {
    const raw = manualGroupJid.trim();
    if (!raw) return;
    const jid = raw.endsWith("@g.us") ? raw : `${raw}@g.us`;
    setSettings((prev) => ({
      ...prev,
      groupJids: prev.groupJids.includes(jid) ? prev.groupJids : [...prev.groupJids, jid],
    }));
    setManualGroupJid("");
  }

  function toggleCategory(cat: string) {
    setSettings((prev) => {
      const has = prev.includedCategories.includes(cat);
      const includedCategories = has
        ? prev.includedCategories.filter((c) => c !== cat)
        : [...prev.includedCategories, cat];
      return { ...prev, includedCategories };
    });
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    try {
      const saved = await api<WaScheduleSettings>("PATCH", "/whatsapp/schedule-notification/settings", settings);
      setSettings({ ...DEFAULT_SETTINGS, ...saved });
      toast("Pengaturan notifikasi grup WA berhasil disimpan");
    } catch (err: any) {
      toast(err?.message || "Gagal menyimpan pengaturan notifikasi WA", "danger");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleSendNow(type: "TEST" | "DAILY" | "WEEKLY") {
    if (settings.groupJids.length === 0) {
      toast("Pilih minimal 1 grup WhatsApp tujuan terlebih dahulu", "warning");
      return;
    }
    setSendingType(type);
    try {
      // Pastikan perubahan grup terbaru tersimpan sebelum kirim
      await api("PATCH", "/whatsapp/schedule-notification/settings", settings);
      const res = await api<{ sent: number; failed: string[]; count?: number }>(
        "POST",
        "/whatsapp/schedule-notification/send-now",
        { type },
      );
      if (res.sent > 0) {
        const label = type === "TEST" ? "Pesan tes" : type === "DAILY" ? `Rekap harian (${res.count ?? 0} agenda)` : `Rekap mingguan (${res.count ?? 0} agenda)`;
        toast(`${label} terkirim ke ${res.sent} grup WhatsApp`);
      } else {
        toast("Gagal mengirim pesan ke grup WhatsApp", "danger");
      }
    } catch (err: any) {
      toast(err?.message || "Gagal mengirim notifikasi WA", "danger");
    } finally {
      setSendingType(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <View className="flex-row items-center gap-2">
            <MessageSquare size={20} color="#22c55e" />
            <DialogTitle>WhatsApp Bot & Notifikasi Grup</DialogTitle>
          </View>
        </DialogHeader>

        {/* Tab Switcher */}
        <View className="flex-row gap-2 border-b border-border pb-2">
          <Pressable
            onPress={() => setTab("connection")}
            className={cn(
              "flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border py-2",
              tab === "connection" ? "border-primary bg-primary/10" : "border-border bg-card",
            )}
          >
            <MessageSquare size={14} color={tab === "connection" ? colors.primary : colors.muted} />
            <Text className={cn("text-xs font-semibold", tab === "connection" ? "text-primary" : "text-muted-foreground")}>
              Koneksi Bot
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTab("schedule")}
            className={cn(
              "flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border py-2",
              tab === "schedule" ? "border-primary bg-primary/10" : "border-border bg-card",
            )}
          >
            <Bell size={14} color={tab === "schedule" ? colors.primary : colors.muted} />
            <Text className={cn("text-xs font-semibold", tab === "schedule" ? "text-primary" : "text-muted-foreground")}>
              Notifikasi Grup Jadwal
            </Text>
          </Pressable>
        </View>

        {tab === "connection" ? (
          <View className="gap-4 py-2">
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

            {status === "CONNECTED" && (
              <View className="items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
                <Text className="text-center text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  Bot Aktif — Laporan Teknisi & Notifikasi Grup Siap
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Akun: <Text className="font-bold text-foreground">{connectedName || "Bot"}</Text> ({connectedPhone || "-"})
                </Text>
                <Text className="text-center text-[11px] text-muted-foreground mt-1">
                  Bot dapat menerima laporan foto teknisi via chat pribadi dan mengirim rekap jadwal kegiatan ke WhatsApp Group.
                </Text>
              </View>
            )}

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

            {status === "CONNECTING" && !qr && (
              <View className="items-center gap-2 py-8">
                <ActivityIndicator size="large" color={colors.primary} />
                <Text className="text-xs text-muted-foreground">Menyiapkan koneksi WhatsApp Baileys...</Text>
              </View>
            )}
          </View>
        ) : (
          <ScrollView className="max-h-[60vh] -mx-1 px-1" contentContainerClassName="gap-3 py-2">
            {loadingSettings ? (
              <View className="items-center py-6">
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : (
              <>
                {/* Master Enable */}
                <View className="flex-row items-center justify-between rounded-lg border border-border bg-card p-3">
                  <View className="flex-1 pr-2">
                    <Text className="text-xs font-semibold text-foreground">Aktifkan Notifikasi Jadwal ke Grup WA</Text>
                    <Text className="text-[11px] text-muted-foreground">
                      Kirim rekap harian, mingguan, dan perubahan jadwal kegiatan ke grup pilihan.
                    </Text>
                  </View>
                  <TogglePill
                    label={settings.enabled ? "Aktif" : "Nonaktif"}
                    active={settings.enabled}
                    onPress={() => setSettings((p) => ({ ...p, enabled: !p.enabled }))}
                  />
                </View>

                {/* Grup Tujuan */}
                <View className="rounded-lg border border-border bg-card p-3 gap-2">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-1.5">
                      <Users size={14} color={colors.primary} />
                      <Text className="text-xs font-semibold text-foreground">Grup WhatsApp Tujuan ({settings.groupJids.length})</Text>
                    </View>
                    <Button variant="outline" size="sm" onPress={fetchGroups} disabled={loadingGroups}>
                      <RefreshCw size={12} color={colors.foreground} />
                      <Text className="text-[11px]">{loadingGroups ? "Memuat..." : "Muat Grup"}</Text>
                    </Button>
                  </View>

                  {status !== "CONNECTED" ? (
                    <Text className="text-[11px] text-amber-600">
                      Bot WhatsApp belum terhubung. Hubungkan bot di tab Koneksi Bot untuk mengambil daftar grup otomatis.
                    </Text>
                  ) : groups.length === 0 ? (
                    <Text className="text-[11px] text-muted-foreground">
                      Belum ada grup terdeteksi. Pastikan nomor bot sudah dimasukkan ke grup WhatsApp lalu klik Muat Grup.
                    </Text>
                  ) : (
                    <View className="gap-1.5 max-h-36">
                      {groups.map((g) => {
                        const selected = settings.groupJids.includes(g.id);
                        return (
                          <Pressable
                            key={g.id}
                            onPress={() => toggleGroup(g)}
                            className={cn(
                              "flex-row items-center justify-between rounded-md border px-2.5 py-2",
                              selected ? "border-emerald-500/60 bg-emerald-500/10" : "border-border bg-background",
                            )}
                          >
                            <View className="flex-1 pr-2">
                              <Text className="text-xs font-medium text-foreground" numberOfLines={1}>{g.subject}</Text>
                              <Text className="text-[10px] text-muted-foreground">{g.participantCount} anggota · {g.id}</Text>
                            </View>
                            {selected ? <CheckCircle2 size={16} color="#10b981" /> : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  )}

                  {/* Manual JID fallback */}
                  <View className="flex-row items-center gap-2 pt-1">
                    <Input
                      value={manualGroupJid}
                      onChangeText={setManualGroupJid}
                      placeholder="Atau masukkan Group ID (contoh: 120363xxxx@g.us)"
                      className="h-8 flex-1 text-xs"
                    />
                    <Button size="sm" variant="outline" onPress={addManualGroup}>
                      <Text className="text-xs">Tambah</Text>
                    </Button>
                  </View>
                </View>

                {/* Daily Schedule */}
                <View className="rounded-lg border border-border bg-card p-3 gap-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-semibold text-foreground">1. Rekap Harian (Daily Schedule)</Text>
                    <TogglePill
                      label={settings.dailyEnabled ? "Aktif" : "Nonaktif"}
                      active={settings.dailyEnabled}
                      onPress={() => setSettings((p) => ({ ...p, dailyEnabled: !p.dailyEnabled }))}
                    />
                  </View>
                  {settings.dailyEnabled ? (
                    <View className="flex-row flex-wrap items-center gap-2">
                      <View className="w-28">
                        <Text className="text-[11px] text-muted-foreground mb-1">Jam Kirim (WIB)</Text>
                        <Input
                          value={settings.dailyTime}
                          onChangeText={(v) => setSettings((p) => ({ ...p, dailyTime: v }))}
                          placeholder="16:00"
                          className="h-8 text-xs"
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-[11px] text-muted-foreground mb-1">Agenda yang Dikirim</Text>
                        <View className="flex-row gap-1.5">
                          <TogglePill
                            label="Besok"
                            active={settings.dailyTarget === "TOMORROW"}
                            onPress={() => setSettings((p) => ({ ...p, dailyTarget: "TOMORROW" }))}
                          />
                          <TogglePill
                            label="Hari Ini"
                            active={settings.dailyTarget === "TODAY"}
                            onPress={() => setSettings((p) => ({ ...p, dailyTarget: "TODAY" }))}
                          />
                        </View>
                      </View>
                    </View>
                  ) : null}
                </View>

                {/* Weekly Schedule */}
                <View className="rounded-lg border border-border bg-card p-3 gap-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-semibold text-foreground">2. Rekap Mingguan (Weekly Schedule)</Text>
                    <TogglePill
                      label={settings.weeklyEnabled ? "Aktif" : "Nonaktif"}
                      active={settings.weeklyEnabled}
                      onPress={() => setSettings((p) => ({ ...p, weeklyEnabled: !p.weeklyEnabled }))}
                    />
                  </View>
                  {settings.weeklyEnabled ? (
                    <View className="gap-2">
                      <View>
                        <Text className="text-[11px] text-muted-foreground mb-1">Hari Pengiriman (untuk agenda minggu depan)</Text>
                        <View className="flex-row flex-wrap gap-1.5">
                          {DAYS_OF_WEEK.map((d) => (
                            <TogglePill
                              key={d.value}
                              label={d.label}
                              active={settings.weeklyDay === d.value}
                              onPress={() => setSettings((p) => ({ ...p, weeklyDay: d.value }))}
                            />
                          ))}
                        </View>
                      </View>
                      <View className="w-28">
                        <Text className="text-[11px] text-muted-foreground mb-1">Jam Kirim (WIB)</Text>
                        <Input
                          value={settings.weeklyTime}
                          onChangeText={(v) => setSettings((p) => ({ ...p, weeklyTime: v }))}
                          placeholder="16:00"
                          className="h-8 text-xs"
                        />
                      </View>
                    </View>
                  ) : null}
                </View>

                {/* Schedule Update Notification */}
                <View className="rounded-lg border border-border bg-card p-3 gap-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-semibold text-foreground">3. Notifikasi Perubahan Jadwal</Text>
                    <TogglePill
                      label={settings.updateNotifyEnabled ? "Aktif" : "Nonaktif"}
                      active={settings.updateNotifyEnabled}
                      onPress={() => setSettings((p) => ({ ...p, updateNotifyEnabled: !p.updateNotifyEnabled }))}
                    />
                  </View>
                  {settings.updateNotifyEnabled ? (
                    <View className="gap-2">
                      <View className="flex-row flex-wrap gap-1.5">
                        <TogglePill
                          label="Saat Tambah"
                          active={settings.updateNotifyOnCreate}
                          onPress={() => setSettings((p) => ({ ...p, updateNotifyOnCreate: !p.updateNotifyOnCreate }))}
                        />
                        <TogglePill
                          label="Saat Ubah"
                          active={settings.updateNotifyOnUpdate}
                          onPress={() => setSettings((p) => ({ ...p, updateNotifyOnUpdate: !p.updateNotifyOnUpdate }))}
                        />
                        <TogglePill
                          label="Saat Batal/Hapus"
                          active={settings.updateNotifyOnCancel}
                          onPress={() => setSettings((p) => ({ ...p, updateNotifyOnCancel: !p.updateNotifyOnCancel }))}
                        />
                      </View>
                      <View className="flex-row items-center gap-2">
                        <Text className="text-[11px] text-muted-foreground">Jeda anti-spam edit (menit):</Text>
                        <Input
                          value={String(settings.updateCooldownMinutes)}
                          onChangeText={(v) => setSettings((p) => ({ ...p, updateCooldownMinutes: Number(v.replace(/\D/g, "")) || 0 }))}
                          keyboardType="numeric"
                          className="h-8 w-16 text-xs text-center"
                        />
                      </View>
                    </View>
                  ) : null}
                </View>

                {/* Categories */}
                <View className="rounded-lg border border-border bg-card p-3 gap-2">
                  <Text className="text-xs font-semibold text-foreground">Kategori Agenda yang Dikirim ke Grup</Text>
                  <View className="flex-row flex-wrap gap-1.5">
                    {MANUAL_CATEGORY_KEYS.map((k) => (
                      <TogglePill
                        key={k}
                        label={CATEGORY_META[k]?.label || k}
                        active={settings.includedCategories.includes(k)}
                        onPress={() => toggleCategory(k)}
                      />
                    ))}
                  </View>
                  <View className="pt-1">
                    <TogglePill
                      label="Lewati rekap otomatis jika tidak ada agenda"
                      active={settings.skipEmptyRecap}
                      onPress={() => setSettings((p) => ({ ...p, skipEmptyRecap: !p.skipEmptyRecap }))}
                    />
                  </View>
                </View>

                {/* Manual Send Actions */}
                <View className="rounded-lg border border-border bg-panel/50 p-3 gap-2">
                  <Text className="text-xs font-semibold text-foreground">Kirim Manual / Tes</Text>
                  <View className="flex-row flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={sendingType !== null || status !== "CONNECTED"}
                      onPress={() => handleSendNow("TEST")}
                      className="gap-1.5"
                    >
                      <Send size={12} color={colors.foreground} />
                      <Text className="text-xs">{sendingType === "TEST" ? "Mengirim..." : "Kirim Tes"}</Text>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={sendingType !== null || status !== "CONNECTED"}
                      onPress={() => handleSendNow("DAILY")}
                      className="gap-1.5"
                    >
                      <Send size={12} color={colors.foreground} />
                      <Text className="text-xs">{sendingType === "DAILY" ? "Mengirim..." : "Rekap Harian"}</Text>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={sendingType !== null || status !== "CONNECTED"}
                      onPress={() => handleSendNow("WEEKLY")}
                      className="gap-1.5"
                    >
                      <Send size={12} color={colors.foreground} />
                      <Text className="text-xs">{sendingType === "WEEKLY" ? "Mengirim..." : "Rekap Mingguan"}</Text>
                    </Button>
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        )}

        <DialogFooter className="flex-row items-center justify-between gap-2 pt-2">
          {tab === "connection" ? (
            status === "CONNECTED" ? (
              <Button variant="outline" size="sm" disabled={loading} onPress={handleLogout} className="border-rose-500/30 gap-1.5">
                <Power size={14} color="#ef4444" />
                <Text className="text-rose-500">Putuskan Sesi</Text>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled={loading} onPress={handleRestart} className="gap-1.5">
                <RefreshCw size={14} color={colors.foreground} />
                <Text>Muat Ulang QR</Text>
              </Button>
            )
          ) : (
            <Button size="sm" disabled={savingSettings} onPress={handleSaveSettings}>
              <Text>{savingSettings ? "Menyimpan..." : "Simpan Pengaturan"}</Text>
            </Button>
          )}

          <Button variant="outline" size="sm" onPress={() => onOpenChange(false)}>
            <Text>Tutup</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
