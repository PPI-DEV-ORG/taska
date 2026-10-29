import * as React from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { ExternalLink, Pencil, Trash2 } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/text";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField, Panel, Timeline } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { ConfirmDialog, DatePicker, MultiSelect, SearchableSelect } from "@/components/taska/dialogs";
import { useApp } from "@/store/app-store";
import { api } from "@/services/api";
import { tanggal } from "@/lib/format";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";
import {
  CATEGORY_META, MANUAL_CATEGORY_KEYS, PRIORITY_LABEL, RECURRENCE_LABEL, REMINDER_OPTIONS, STATUS_KEYS, STATUS_LABEL,
  statusLabel, toIsoWib, wibKey, wibTime, ymd, type CalItem,
} from "./types";
import { ScrollView } from "react-native-gesture-handler";

type Person = { id: number; name: string };

function usePeople(): Person[] {
  const { data } = useApp();
  return React.useMemo(
    () =>
      (data.users ?? [])
        .map((u: any) => ({ id: Number(u.id), name: String(u.name || u.nama || "") }))
        .filter((u: Person) => u.name && Number.isFinite(u.id)),
    [data.users],
  );
}

const byLabel = <T extends string>(map: Record<T, string>, label?: string) =>
  (Object.keys(map) as T[]).find((k) => map[k] === label);

// ─────────────────────────────── Form ───────────────────────────────

export function EventFormDialog({
  open, onOpenChange, eventId, defaultDate, onSaved,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; eventId?: number | null; defaultDate?: string; onSaved: () => void;
}) {
  const { toast, user } = useApp();
  const people = usePeople();
  const names = people.map((p) => p.name);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [title, setTitle] = React.useState("");
  const [category, setCategory] = React.useState("MEETING");
  const [startDate, setStartDate] = React.useState("");
  const [startTime, setStartTime] = React.useState("09:00");
  const [endDate, setEndDate] = React.useState("");
  const [endTime, setEndTime] = React.useState("10:00");
  const [allDay, setAllDay] = React.useState(false);
  const [assignee, setAssignee] = React.useState("");
  const [attendees, setAttendees] = React.useState<string[]>([]);
  const [priority, setPriority] = React.useState("MEDIUM");
  const [status, setStatus] = React.useState("NOT_STARTED");
  const [recurrence, setRecurrence] = React.useState("NONE");
  const [until, setUntil] = React.useState("");
  const [reminder, setReminder] = React.useState<number | null>(null);
  const [description, setDescription] = React.useState("");

  const [prevFormKey, setPrevFormKey] = React.useState<string | null>(null);
  const currentFormKey = open ? `${eventId ?? "new"}-${defaultDate ?? ""}` : null;
  if (currentFormKey !== prevFormKey) {
    setPrevFormKey(currentFormKey);
    if (open) {
      if (eventId) {
        setLoading(true);
      } else {
        setLoading(false);
        setTitle("");
        setCategory("MEETING");
        setStartDate(defaultDate || ymd(new Date()));
        setStartTime("09:00");
        setEndDate("");
        setEndTime("10:00");
        setAllDay(false);
        setAssignee(user?.name ?? "");
        setAttendees([]);
        setPriority("MEDIUM");
        setStatus("NOT_STARTED");
        setRecurrence("NONE");
        setUntil("");
        setReminder(null);
        setDescription("");
      }
    }
  }

  React.useEffect(() => {
    if (!open || !eventId) return;
    let active = true;
    api<any>("GET", `/calendar/events/${eventId}`)
      .then((e) => {
        if (!active) return;
        setTitle(e.title ?? ""); setCategory(e.category ?? "MEETING");
        setStartDate(wibKey(e.startDate)); setStartTime(wibTime(e.startDate));
        setEndDate(e.endDate ? wibKey(e.endDate) : ""); setEndTime(e.endDate ? wibTime(e.endDate) : "10:00");
        setAllDay(!!e.isAllDay); setAssignee(e.assignee?.name ?? "");
        setAttendees((e.attendees ?? []).map((a: any) => a.user?.name).filter(Boolean));
        setPriority(e.priority ?? "MEDIUM"); setStatus(e.status ?? "NOT_STARTED");
        setRecurrence(e.recurrence ?? "NONE"); setUntil(e.recurrenceUntil ? wibKey(e.recurrenceUntil) : "");
        setReminder(e.reminderMinutes ?? null); setDescription(e.description ?? "");
      })
      .catch((err) => {
        if (active) toast(err?.message ?? "Gagal memuat agenda", "danger");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, eventId]);

  async function save() {
    if (title.trim().length < 2) return toast("Judul agenda wajib diisi", "danger");
    if (!startDate) return toast("Tanggal mulai wajib diisi", "danger");
    if (endDate && endDate < startDate) return toast("Tanggal selesai tidak boleh sebelum tanggal mulai", "danger");
    const body: any = {
      title: title.trim(),
      description: description.trim() || undefined,
      category, priority, recurrence,
      isAllDay: allDay,
      startDate: toIsoWib(startDate, allDay ? "00:00" : startTime),
      endDate: endDate ? toIsoWib(endDate, allDay ? "23:59" : endTime) : null,
      recurrenceUntil: recurrence !== "NONE" && until ? toIsoWib(until, "23:59") : null,
      reminderMinutes: reminder,
      assigneeId: people.find((p) => p.name === assignee)?.id ?? null,
      attendeeIds: attendees.map((n) => people.find((p) => p.name === n)?.id).filter((x): x is number => !!x),
    };
    if (eventId) body.status = status;
    setSaving(true);
    try {
      if (eventId) await api("PATCH", `/calendar/events/${eventId}`, body);
      else await api("POST", "/calendar/events", body);
      toast(eventId ? "Agenda diperbarui" : "Agenda dibuat");
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menyimpan agenda", "danger");
    } finally {
      setSaving(false);
    }
  }

  const catOptions = MANUAL_CATEGORY_KEYS.map((k) => CATEGORY_META[k]!.label);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader className="shrink-0 mb-1">
          <DialogTitle>{eventId ? "Edit Agenda" : "Buat Agenda"}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <Text className="text-muted-foreground py-6 text-center text-sm">Memuat...</Text>
        ) : (
          <ScrollView className="flex-1 -mx-2 px-2" contentContainerClassName="gap-3 py-1 pb-4" showsVerticalScrollIndicator>
            <FormField label="Judul Agenda" required>
              <Input value={title} onChangeText={setTitle} placeholder="Contoh: Follow-up penawaran PT Contoh" />
            </FormField>
            <FormField label="Kategori">
              <SearchableSelect
                value={CATEGORY_META[category]?.label}
                onChange={(v) => setCategory(MANUAL_CATEGORY_KEYS.find((k) => CATEGORY_META[k]!.label === v) ?? "MEETING")}
                options={catOptions}
                placeholder="Pilih kategori"
              />
            </FormField>
            <View className="flex-row gap-1.5">
              {[{ l: "Jam tertentu", v: false }, { l: "Sepanjang hari", v: true }].map((o) => (
                <Pressable
                  key={o.l}
                  onPress={() => setAllDay(o.v)}
                  className={cn("min-h-[36px] justify-center rounded-full border px-3", allDay === o.v ? "border-primary bg-primary/15" : "border-border bg-card")}
                >
                  <Text className={cn("text-sm", allDay === o.v ? "text-primary font-medium" : "text-text-secondary")}>{o.l}</Text>
                </Pressable>
              ))}
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1"><FormField label="Tanggal mulai" required><DatePicker value={startDate} onChange={setStartDate} /></FormField></View>
              {!allDay ? <View className="w-28"><FormField label="Jam mulai"><Input value={startTime} onChangeText={setStartTime} placeholder="09:00" /></FormField></View> : null}
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1"><FormField label="Tanggal selesai / deadline"><DatePicker value={endDate} onChange={setEndDate} clearable /></FormField></View>
              {!allDay ? <View className="w-28"><FormField label="Jam selesai"><Input value={endTime} onChangeText={setEndTime} placeholder="10:00" /></FormField></View> : null}
            </View>
            <FormField label="Penanggung jawab">
              <SearchableSelect value={assignee} onChange={setAssignee} options={names} placeholder="Pilih penanggung jawab" />
            </FormField>
            <FormField label="Peserta / pihak terkait">
              <MultiSelect values={attendees} onChange={setAttendees} options={names} placeholder="Pilih peserta" />
            </FormField>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <FormField label="Prioritas">
                  <SearchableSelect
                    value={PRIORITY_LABEL[priority]}
                    onChange={(v) => setPriority(byLabel(PRIORITY_LABEL, v) ?? "MEDIUM")}
                    options={Object.values(PRIORITY_LABEL)}
                  />
                </FormField>
              </View>
              {eventId ? (
                <View className="flex-1">
                  <FormField label="Status">
                    <SearchableSelect
                      value={STATUS_LABEL[status]}
                      onChange={(v) => setStatus(byLabel(STATUS_LABEL, v) ?? "NOT_STARTED")}
                      options={Object.values(STATUS_LABEL)}
                    />
                  </FormField>
                </View>
              ) : null}
            </View>
            <FormField label="Pengingat">
              <SearchableSelect
                value={REMINDER_OPTIONS.find((r) => r.value === reminder)?.label}
                onChange={(v) => setReminder(REMINDER_OPTIONS.find((r) => r.label === v)?.value ?? null)}
                options={REMINDER_OPTIONS.map((r) => r.label)}
              />
            </FormField>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <FormField label="Pengulangan">
                  <SearchableSelect
                    value={RECURRENCE_LABEL[recurrence]}
                    onChange={(v) => setRecurrence(byLabel(RECURRENCE_LABEL, v) ?? "NONE")}
                    options={Object.values(RECURRENCE_LABEL)}
                  />
                </FormField>
              </View>
              {recurrence !== "NONE" ? (
                <View className="flex-1"><FormField label="Berulang sampai"><DatePicker value={until} onChange={setUntil} clearable /></FormField></View>
              ) : null}
            </View>
            <FormField label="Deskripsi / catatan">
              <Textarea value={description} onChangeText={setDescription} numberOfLines={4} />
            </FormField>
          </ScrollView>
        )}
        <DialogFooter className="shrink-0 mt-2 pt-2">
          <Button variant="outline" onPress={() => onOpenChange(false)}><Text>Batal</Text></Button>
          <Button onPress={save} disabled={saving || loading}><Text>{saving ? "Menyimpan..." : "Simpan"}</Text></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────── Detail ───────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="flex-row gap-3">
      <Text className="text-muted-foreground w-28 text-xs">{label}</Text>
      <View className="flex-1">{typeof children === "string" ? <Text className="text-sm">{children}</Text> : children}</View>
    </View>
  );
}

export function EventDetailDialog({
  item, onClose, onChanged, onEdit,
}: {
  item: CalItem | null; onClose: () => void; onChanged: () => void; onEdit: (id: number) => void;
}) {
  const router = useRouter();
  const { toast } = useApp();
  const [detail, setDetail] = React.useState<any>(null);
  const [history, setHistory] = React.useState<{ id: string; who: string; what: string; when: string }[]>([]);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const isManual = item?.sourceModule === "calendar";

  const [prevItemKey, setPrevItemKey] = React.useState<string | null>(null);
  const currentItemKey = item?.key ?? null;
  if (currentItemKey !== prevItemKey) {
    setPrevItemKey(currentItemKey);
    setDetail(null);
    setHistory([]);
  }

  React.useEffect(() => {
    if (!item || !isManual) return;
    let active = true;
    // Riwayat HANYA untuk agenda ini (entityType + entityId).
    api<any>("GET", `/calendar/events/${item.sourceId}`)
      .then((res) => {
        if (active) setDetail(res);
      })
      .catch(() => undefined);

    api<any[]>("GET", `/audit-logs/entity/calendarEvent/${item.sourceId}`)
      .then((rows) => {
        if (!active) return;
        setHistory(
          (rows ?? [])
            .filter((r) => String(r.entityId) === String(item.sourceId) && r.entityType === "calendarEvent")
            .map((r) => ({ id: `al-${r.id}`, who: r.actorName || "Sistem", what: r.detail || r.action, when: r.createdAt })),
        );
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [item?.sourceId, isManual]);

  if (!item) return null;
  const meta = CATEGORY_META[item.category] ?? CATEGORY_META.OTHER!;

  async function setStatus(status: string) {
    try {
      await api("POST", `/calendar/events/${item!.sourceId}/status`, { status });
      toast("Status agenda diperbarui");
      onChanged();
      onClose();
    } catch (e: any) {
      toast(e?.message ?? "Gagal mengubah status", "danger");
    }
  }

  async function remove() {
    try {
      await api("DELETE", `/calendar/events/${item!.sourceId}`);
      toast("Agenda dihapus");
      onChanged();
      onClose();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menghapus agenda", "danger");
    }
  }

  const when = item.isAllDay || !isManual
    ? `${tanggal(item.start)}${item.end && wibKey(item.end) !== wibKey(item.start) ? ` - ${tanggal(item.end)}` : ""}`
    : `${tanggal(item.start)}, ${wibTime(item.start)}${item.end ? ` - ${wibTime(item.end)}` : ""}`;

  return (
    <>
      <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{item.title}</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-1">
            <View className="flex-row flex-wrap items-center gap-2">
              <View className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: `${meta.color}1F` }}>
                <Text className="text-[11px] font-semibold" style={{ color: meta.color }}>{meta.label}</Text>
              </View>
              <StatusBadge status={statusLabel(item)} />
            </View>
            <Row label="Jadwal">{when}</Row>
            <Row label="Penanggung jawab">{item.picName ?? "-"}</Row>
            <Row label="Prioritas">{PRIORITY_LABEL[item.priority] ?? item.priority}</Row>
            {item.recurrence && item.recurrence !== "NONE" ? <Row label="Pengulangan">{RECURRENCE_LABEL[item.recurrence] ?? item.recurrence}</Row> : null}
            {isManual && detail?.attendees?.length ? (
              <Row label="Peserta">{detail.attendees.map((a: any) => a.user?.name).filter(Boolean).join(", ")}</Row>
            ) : null}
            {item.subtitle ? <Row label="Keterangan">{item.subtitle}</Row> : null}
            {isManual && detail?.completionNote ? <Row label="Catatan selesai">{detail.completionNote}</Row> : null}

            {!isManual && item.routePath ? (
              <Button variant="outline" className="self-start" onPress={() => { onClose(); router.push(item.routePath as any); }}>
                <ExternalLink size={14} color={colors.text} />
                <Text>Buka dokumen terkait</Text>
              </Button>
            ) : null}
            {!isManual ? (
              <Text className="text-muted-foreground text-xs">
                Jadwal ini bersumber dari modul terkait. Perubahan tanggal & status dilakukan di dokumen sumber.
              </Text>
            ) : null}

            {isManual && item.editable ? (
              <View className="flex-row flex-wrap gap-2">
                {item.status !== "COMPLETED" ? (
                  <Button size="sm" onPress={() => setStatus("COMPLETED")}><Text className="text-xs">Tandai selesai</Text></Button>
                ) : (
                  <Button size="sm" variant="outline" onPress={() => setStatus("IN_PROGRESS")}><Text className="text-xs">Buka lagi</Text></Button>
                )}
                {item.status !== "CANCELLED" ? (
                  <Button size="sm" variant="outline" onPress={() => setStatus("CANCELLED")}><Text className="text-xs">Batalkan</Text></Button>
                ) : null}
                <Button size="sm" variant="outline" onPress={() => { onClose(); onEdit(item.sourceId); }}>
                  <Pencil size={13} color={colors.text} /><Text className="text-xs">Edit</Text>
                </Button>
                <Button size="sm" variant="outline" onPress={() => setConfirmDelete(true)}>
                  <Trash2 size={13} color={colors.danger} /><Text className="text-xs text-danger">Hapus</Text>
                </Button>
              </View>
            ) : null}

            {isManual ? (
              <Panel title="Riwayat">
                {history.length ? <Timeline items={history} /> : <Text className="text-muted-foreground text-xs">Belum ada riwayat.</Text>}
              </Panel>
            ) : null}
          </View>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Hapus agenda?"
        description="Agenda akan dihapus permanen. Seri berulang ikut terhapus."
        confirmLabel="Ya, hapus"
        destructive
        onConfirm={remove}
      />
    </>
  );
}

