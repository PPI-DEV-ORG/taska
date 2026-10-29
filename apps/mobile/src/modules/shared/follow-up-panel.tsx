import * as React from "react";
import { View, Pressable } from "react-native";
import {
  Plus,
  Phone,
  MessageSquare,
  Mail,
  Calendar,
  ArrowRight,
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Panel } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { DatePicker } from "@/components/taska/dialogs";
import { useApp } from "@/store/app-store";
import { api } from "@/services/api";
import { colors } from "@/tokens";
import { type Row } from "@/constants/modules";

type FollowUpPanelProps = {
  moduleKey: "leads" | "poc-reports" | "visit-reports";
  entityId: string | number;
  initialFollowUps?: any[];
  subtitle?: string;
  onUpdated?: () => void;
};

export function FollowUpPanel({
  moduleKey,
  entityId,
  initialFollowUps,
  subtitle = "Aktivitas komunikasi & tindak lanjut dengan klien. Jadwal follow-up berikutnya akan otomatis muncul di Kalender Kerja.",
  onUpdated,
}: FollowUpPanelProps) {
  const { data, addRow, patchRow, pushHistory, toast } = useApp();

  const [fuOpen, setFuOpen] = React.useState(false);
  const [fuMethod, setFuMethod] = React.useState<"Telepon" | "WhatsApp" | "Meeting" | "Email" | "Survey">("Telepon");
  const [fuDate, setFuDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [fuNote, setFuNote] = React.useState("");
  const [fuNextAction, setFuNextAction] = React.useState("");
  const [fuStatus, setFuStatus] = React.useState<"SELESAI" | "TERJADWAL">("SELESAI");
  const [selectedFu, setSelectedFu] = React.useState<any>(null);
  const [editFuStatus, setEditFuStatus] = React.useState<"SELESAI" | "TERJADWAL">("SELESAI");
  const [fetchedList, setFetchedList] = React.useState<any[] | null>(null);

  const queryParam =
    moduleKey === "leads"
      ? `leadId=${entityId}`
      : moduleKey === "poc-reports"
        ? `pocReportId=${entityId}`
        : `visitReportId=${entityId}`;

  const reloadFollowups = React.useCallback(async () => {
    try {
      const res = await api<any[]>("GET", `/follow-ups?${queryParam}`);
      if (Array.isArray(res)) {
        setFetchedList(res);
      }
    } catch {}
  }, [queryParam]);

  React.useEffect(() => {
    let active = true;

    const fetchFollowups = async () => {
      try {
        const res = await api<any[]>("GET", `/follow-ups?${queryParam}`);
        if (active && Array.isArray(res)) {
          setFetchedList(res);
        }
      } catch {}
    };

    void fetchFollowups();

    return () => {
      active = false;
    };
  }, [reloadFollowups]);

  const followups = React.useMemo(() => {
    const fromStore = (data.followups ?? [])
      .filter((f: Row) => {
        if (moduleKey === "leads") return String(f.leadId) === String(entityId);
        if (moduleKey === "poc-reports") return String(f.pocReportId) === String(entityId);
        if (moduleKey === "visit-reports") return String(f.visitReportId) === String(entityId);
        return false;
      })
      .map((f: Row) => ({
        id: String(f.id),
        method: String(f.metode || f.method || "Telepon"),
        note: String(f.catatan || f.notes || "-"),
        date: String(f.tanggal || f.date || ""),
        next: f.berikutnya || f.nextAction ? String(f.berikutnya || f.nextAction) : undefined,
        status: String(f.status || "SELESAI"),
      }));

    if (fromStore.length > 0) return fromStore;

    const rawSource =
      Array.isArray(fetchedList) && fetchedList.length > 0
        ? fetchedList
        : Array.isArray(initialFollowUps)
          ? initialFollowUps
          : [];

    return rawSource.map((f: any) => ({
      id: String(f.id),
      method: String(f.metode || f.method || "Telepon"),
      note: String(f.catatan || f.notes || "-"),
      date: f.date ? String(f.date).slice(0, 10) : String(f.tanggal || ""),
      next: f.nextDate
        ? String(f.nextDate).slice(0, 10)
        : f.berikutnya || f.nextAction
          ? String(f.berikutnya || f.nextAction)
          : undefined,
      status: String(f.status || "SELESAI"),
    }));
  }, [data.followups, moduleKey, entityId, fetchedList, initialFollowUps]);

  async function handleAddFollowup() {
    if (!fuNote.trim()) {
      toast("Catatan follow-up tidak boleh kosong", "danger");
      return;
    }

    const payload: Record<string, any> = {
      date: fuDate || new Date().toISOString().slice(0, 10),
      method: fuMethod,
      notes: fuNote.trim(),
      nextDate: fuNextAction || undefined,
      status: fuNextAction && fuStatus === "SELESAI" ? "TERJADWAL" : fuStatus,
    };

    if (moduleKey === "leads") payload.leadId = Number(entityId);
    if (moduleKey === "poc-reports") payload.pocReportId = Number(entityId);
    if (moduleKey === "visit-reports") payload.visitReportId = Number(entityId);

    const created = await addRow("followups", payload);
    if (created) {
      if (moduleKey === "leads") {
        patchRow("leads", String(entityId), { sepi: 0 });
      }
      pushHistory(
        moduleKey as any,
        String(entityId),
        `Follow-up (${fuMethod}): ${fuNote.trim()}${fuNextAction ? ` | Jadwal Berikutnya: ${fuNextAction}` : ""}`
      );
      setFuNote("");
      setFuNextAction("");
      setFuOpen(false);
      await reloadFollowups();
      onUpdated?.();
    }
  }

  return (
    <>
      <Panel
        title="Riwayat Tindak Lanjut (Follow-up) & Jadwal Mendatang"
        subtitle={subtitle}
        right={
          <Button size="sm" onPress={() => setFuOpen(true)} className="flex-row items-center gap-1">
            <Plus size={14} color={colors.background} />
            <Text className="text-xs">Catat Follow-up</Text>
          </Button>
        }
      >
        <View className="gap-2">
          {followups.length === 0 ? (
            <Text className="text-muted-foreground text-xs py-2">
              Belum ada riwayat follow-up tercatat. Klik &quot;Catat Follow-up&quot; untuk mencatat komunikasi atau menjadwalkan agenda follow-up mendatang di Kalender.
            </Text>
          ) : (
            followups.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  setSelectedFu(item);
                  setEditFuStatus(item.status === "TERJADWAL" ? "TERJADWAL" : "SELESAI");
                }}
                className="border-border border-b py-2.5 last:border-b-0 hover:bg-muted/30 active:opacity-75 transition-colors cursor-pointer"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View className="bg-primary/10 rounded-md p-1">
                      {item.method === "Telepon" ? <Phone size={13} color={colors.primary} /> : null}
                      {item.method === "WhatsApp" ? <MessageSquare size={13} color={colors.primary} /> : null}
                      {item.method === "Email" ? <Mail size={13} color={colors.primary} /> : null}
                      {!["Telepon", "WhatsApp", "Email"].includes(item.method) ? (
                        <Calendar size={13} color={colors.primary} />
                      ) : null}
                    </View>
                    <Text className="text-xs font-semibold text-foreground">{item.method}</Text>
                    <StatusBadge status={item.status} />
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-[11px] text-muted-foreground">{item.date}</Text>
                    <ArrowRight size={12} color={colors.textSecondary} />
                  </View>
                </View>
                <Text className="text-xs text-foreground mt-1 leading-relaxed" numberOfLines={2}>
                  {item.note}
                </Text>
                {item.next ? (
                  <View className="bg-panel/60 border-border/60 mt-1.5 flex-row items-center gap-1.5 rounded p-1.5 border">
                    <Calendar size={12} color={colors.info} />
                    <Text className="text-[11px] text-info">
                      Jadwal follow-up berikutnya (Sinkron Kalender): {item.next}
                    </Text>
                  </View>
                ) : null}
                <Text className="text-[10px] text-primary/70 mt-1 font-medium">
                  Klik untuk lihat isi pembahasan & ubah status
                </Text>
              </Pressable>
            ))
          )}
        </View>
      </Panel>

      {/* Modal Catat Follow-up */}
      <Dialog open={fuOpen} onOpenChange={setFuOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Catat Tindak Lanjut (Follow-up)</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <View className="gap-1.5">
              <Text className="text-xs text-muted-foreground font-medium">Tanggal Komunikasi / Aktivitas</Text>
              <DatePicker value={fuDate} onChange={setFuDate} placeholder="Pilih tanggal follow-up" />
            </View>

            <View className="gap-1.5">
              <Text className="text-xs text-muted-foreground font-medium">Metode Komunikasi</Text>
              <View className="flex-row flex-wrap gap-1.5">
                {(["Telepon", "WhatsApp", "Meeting", "Email", "Survey"] as const).map((m) => (
                  <Button
                    key={m}
                    size="sm"
                    variant={fuMethod === m ? "default" : "outline"}
                    onPress={() => setFuMethod(m)}
                    className="h-8 px-2.5"
                  >
                    <Text className="text-xs">{m}</Text>
                  </Button>
                ))}
              </View>
            </View>

            <View className="gap-1.5">
              <Text className="text-xs text-muted-foreground font-medium">Catatan / Ringkasan Pembicaraan</Text>
              <Textarea
                value={fuNote}
                onChangeText={setFuNote}
                placeholder="Contoh: Diskusi hasil uji coba / konfirmasi jadwal lanjutan / revisi penawaran..."
                numberOfLines={3}
              />
            </View>

            <View className="gap-1.5">
              <Text className="text-xs text-muted-foreground font-medium">
                Tanggal Follow-up Berikutnya / Event Mendatang (Muncul di Kalender)
              </Text>
              <DatePicker
                value={fuNextAction}
                onChange={(v) => {
                  setFuNextAction(v);
                  if (v) setFuStatus("TERJADWAL");
                }}
                placeholder="Pilih tanggal jadwal follow-up berikutnya"
              />
            </View>

            <View className="gap-1.5">
              <Text className="text-xs text-muted-foreground font-medium">Status Follow-up</Text>
              <View className="flex-row gap-2">
                {(["SELESAI", "TERJADWAL"] as const).map((st) => (
                  <Button
                    key={st}
                    size="sm"
                    variant={fuStatus === st ? "default" : "outline"}
                    onPress={() => setFuStatus(st)}
                    className="h-8 px-3"
                  >
                    <Text className="text-xs">{st === "SELESAI" ? "Selesai Dilakukan" : "Terjadwal"}</Text>
                  </Button>
                ))}
              </View>
            </View>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setFuOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleAddFollowup}>
              <Text>Simpan Follow-up</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Detail & Ubah Status Follow-up */}
      <Dialog
        open={!!selectedFu}
        onOpenChange={(open) => {
          if (!open) setSelectedFu(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detail Tindak Lanjut (Follow-up)</DialogTitle>
          </DialogHeader>
          {selectedFu ? (
            <View className="gap-3 py-2">
              <View className="flex-row items-center justify-between border-border border-b pb-2">
                <View className="flex-row items-center gap-2">
                  <Text className="text-xs font-semibold text-muted-foreground">Metode:</Text>
                  <Text className="text-xs font-bold text-foreground">{selectedFu.method}</Text>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-xs font-semibold text-muted-foreground">Tanggal:</Text>
                  <Text className="text-xs font-bold text-foreground">{selectedFu.date}</Text>
                </View>
              </View>

              <View className="gap-1.5">
                <Text className="text-xs font-semibold text-muted-foreground">Isi Pembahasan Terakhir</Text>
                <View className="bg-panel border-border/70 rounded-lg border p-3">
                  <Text className="text-xs text-foreground leading-relaxed">{selectedFu.note || "-"}</Text>
                </View>
              </View>

              {selectedFu.next ? (
                <View className="bg-panel/60 border-border/60 flex-row items-center gap-2 rounded-lg p-2.5 border">
                  <Calendar size={14} color={colors.info} />
                  <View>
                    <Text className="text-[10px] text-muted-foreground uppercase font-semibold">
                      Jadwal Tindak Lanjut Berikutnya (Kalender)
                    </Text>
                    <Text className="text-xs font-medium text-info">{selectedFu.next}</Text>
                  </View>
                </View>
              ) : null}

              <View className="gap-1.5 pt-1">
                <Text className="text-xs font-semibold text-muted-foreground">Status Follow-up</Text>
                <View className="flex-row gap-2">
                  {(["SELESAI", "TERJADWAL"] as const).map((st) => (
                    <Button
                      key={st}
                      size="sm"
                      variant={editFuStatus === st ? "default" : "outline"}
                      onPress={() => setEditFuStatus(st)}
                      className="flex-1 h-9"
                    >
                      <Text className="text-xs font-medium">{st === "SELESAI" ? "Selesai (Done)" : "Terjadwal"}</Text>
                    </Button>
                  ))}
                </View>
              </View>
            </View>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onPress={() => setSelectedFu(null)}>
              <Text>Tutup</Text>
            </Button>
            <Button
              onPress={async () => {
                if (!selectedFu) return;
                try {
                  await patchRow("followups", String(selectedFu.id), { status: editFuStatus });
                  await api("PATCH", `/follow-ups/${selectedFu.id}`, { status: editFuStatus }).catch(() => {});
                  pushHistory(
                    moduleKey as any,
                    String(entityId),
                    `Status follow-up (${selectedFu.method}) diubah menjadi ${editFuStatus}`
                  );
                  toast("Status follow-up berhasil diperbarui");
                  await reloadFollowups();
                  onUpdated?.();
                } catch {
                  toast("Gagal memperbarui status follow-up", "danger");
                } finally {
                  setSelectedFu(null);
                }
              }}
            >
              <Text>Simpan Status</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

