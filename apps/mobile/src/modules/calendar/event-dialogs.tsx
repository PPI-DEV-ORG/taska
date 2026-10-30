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
import { formatAuditAction } from "@/lib/audit-format";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";
import {
  CATEGORY_META, MANUAL_CATEGORY_KEYS, PRIORITY_LABEL, RECURRENCE_LABEL, REMINDER_OPTIONS, STATUS_LABEL,
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
  open, onOpenChange, eventId, defaultDate, occurrenceDate, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eventId?: number | null;
  defaultDate?: string;
  occurrenceDate?: string;
  onSaved: () => void;
}) {
  const { toast, user, data } = useApp();
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
  const [customReminderMin, setCustomReminderMin] = React.useState("45");
  const [remindOnCreate, setRemindOnCreate] = React.useState(true);
  const [description, setDescription] = React.useState("");
  const [completionNote, setCompletionNote] = React.useState("");
  const [occurrenceMode, setOccurrenceMode] = React.useState<"single" | "series">("series");
  const [customerLabel, setCustomerLabel] = React.useState("");
  const [projectLabel, setProjectLabel] = React.useState("");
  const [leadLabel, setLeadLabel] = React.useState("");
  const [invoiceLabel, setInvoiceLabel] = React.useState("");
  const [supplierLabel, setSupplierLabel] = React.useState("");

  const customerMap = React.useMemo(
    () => (data.customers ?? []).map((c: any) => ({ id: Number(c.id), label: String(c.company || c.name || "") })).filter((x: any) => x.label && Number.isFinite(x.id)),
    [data.customers],
  );
  const projectMap = React.useMemo(
    () => (data.projects ?? []).map((p: any) => ({ id: Number(p.id), label: `${p.code || `#${p.id}`} - ${p.name || p.nama || ""}` })).filter((x: any) => x.label && Number.isFinite(x.id)),
    [data.projects],
  );
  const leadMap = React.useMemo(
    () => (data.leads ?? []).map((l: any) => ({ id: Number(l.id), label: `${l.company || ""} (${l.pic || l.name || "-"})` })).filter((x: any) => x.label && Number.isFinite(x.id)),
    [data.leads],
  );
  const invoiceMap = React.useMemo(
    () => (data.invoices ?? []).map((iv: any) => ({ id: Number(iv.id), label: `${iv.number || iv.no || `#${iv.id}`} - ${iv.customer || ""}` })).filter((x: any) => x.label && Number.isFinite(x.id)),
    [data.invoices],
  );
  const supplierMap = React.useMemo(
    () => (data.suppliers ?? []).map((s: any) => ({ id: Number(s.id), label: String(s.name || s.nama || "") })).filter((x: any) => x.label && Number.isFinite(x.id)),
    [data.suppliers],
  );

  const [prevFormKey, setPrevFormKey] = React.useState<string | null>(null);
  const currentFormKey = open ? `${eventId ?? "new"}-${defaultDate ?? ""}-${occurrenceDate ?? ""}` : null;
  if (currentFormKey !== prevFormKey) {
    setPrevFormKey(currentFormKey);
    if (open) {
      if (eventId) {
        setLoading(true);
        setOccurrenceMode("series");
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
        setCustomReminderMin("45");
        setRemindOnCreate(true);
        setDescription("");
        setCompletionNote("");
        setOccurrenceMode("series");
        setCustomerLabel("");
        setProjectLabel("");
        setLeadLabel("");
        setInvoiceLabel("");
        setSupplierLabel("");
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
        setStartDate(occurrenceDate || wibKey(e.startDate)); setStartTime(wibTime(e.startDate));
        setEndDate(e.endDate ? wibKey(e.endDate) : ""); setEndTime(e.endDate ? wibTime(e.endDate) : "10:00");
        setAllDay(!!e.isAllDay); setAssignee(e.assignee?.name ?? "");
        setAttendees((e.attendees ?? []).map((a: any) => a.user?.name).filter(Boolean));
        setPriority(e.priority ?? "MEDIUM"); setStatus(e.status ?? "NOT_STARTED");
        setRecurrence(e.recurrence ?? "NONE"); setUntil(e.recurrenceUntil ? wibKey(e.recurrenceUntil) : "");
        const rm = e.reminderMinutes ?? null;
        const isPreset = REMINDER_OPTIONS.some((r) => r.value === rm && r.value !== -1);
        if (rm !== null && !isPreset) {
          setReminder(-1);
          setCustomReminderMin(String(rm));
        } else {
          setReminder(rm);
        }
        setDescription(e.description ?? "");
        setCompletionNote(e.completionNote ?? "");
        setCustomerLabel(customerMap.find((x) => x.id === e.customerId)?.label ?? "");
        setProjectLabel(projectMap.find((x) => x.id === e.projectId)?.label ?? "");
        setLeadLabel(leadMap.find((x) => x.id === e.leadId)?.label ?? "");
        setInvoiceLabel(invoiceMap.find((x) => x.id === e.invoiceId)?.label ?? "");
        setSupplierLabel(supplierMap.find((x) => x.id === e.supplierId)?.label ?? "");
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
  }, [open, eventId, occurrenceDate, customerMap, projectMap, leadMap, invoiceMap, supplierMap, toast]);

  async function save() {
    if (title.trim().length < 2) return toast("Judul agenda wajib diisi", "danger");
    if (!startDate) return toast("Tanggal mulai wajib diisi", "danger");
    if (endDate && endDate < startDate) return toast("Tanggal selesai tidak boleh sebelum tanggal mulai", "danger");
    const resolvedReminder =
      reminder === -1 ? Math.max(0, Number(customReminderMin) || 0) : reminder;
    const body: any = {
      title: title.trim(),
      description: description.trim() || undefined,
      completionNote: completionNote.trim() || undefined,
      category, priority, recurrence,
      isAllDay: allDay,
      startDate: toIsoWib(startDate, allDay ? "00:00" : startTime),
      endDate: endDate ? toIsoWib(endDate, allDay ? "23:59" : endTime) : null,
      recurrenceUntil: recurrence !== "NONE" && until ? toIsoWib(until, "23:59") : null,
      reminderMinutes: resolvedReminder,
      remindOnCreate,
      assigneeId: people.find((p) => p.name === assignee)?.id ?? null,
      attendeeIds: attendees.map((n) => people.find((p) => p.name === n)?.id).filter((x): x is number => !!x),
      customerId: customerMap.find((x) => x.label === customerLabel)?.id ?? null,
      projectId: projectMap.find((x) => x.label === projectLabel)?.id ?? null,
      leadId: leadMap.find((x) => x.label === leadLabel)?.id ?? null,
      invoiceId: invoiceMap.find((x) => x.label === invoiceLabel)?.id ?? null,
      supplierId: supplierMap.find((x) => x.label === supplierLabel)?.id ?? null,
    };
    if (eventId) {
      body.status = status;
      if (recurrence !== "NONE" && occurrenceDate) {
        body.occurrenceMode = occurrenceMode;
        body.occurrenceDate = occurrenceDate;
      }
    }
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
            {eventId && recurrence !== "NONE" && occurrenceDate ? (
              <View className="rounded-lg border border-border bg-panel/60 p-2.5 gap-1.5">
                <Text className="text-xs font-semibold text-foreground">Cakupan perubahan agenda berulang</Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {[
                    { k: "single" as const, l: `Hanya tanggal ini (${occurrenceDate})` },
                    { k: "series" as const, l: "Seluruh rangkaian berulang" },
                  ].map((o) => (
                    <Pressable
                      key={o.k}
                      onPress={() => setOccurrenceMode(o.k)}
                      className={cn(
                        "min-h-[32px] justify-center rounded-full border px-3",
                        occurrenceMode === o.k ? "border-primary bg-primary/15" : "border-border bg-card",
                      )}
                    >
                      <Text className={cn("text-xs", occurrenceMode === o.k ? "text-primary font-semibold" : "text-text-secondary")}>
                        {o.l}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
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
              {[{ l: "Jam tertentu (WIB)", v: false }, { l: "Sepanjang hari", v: true }].map((o) => (
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
              {!allDay ? <View className="w-28"><FormField label="Jam mulai (WIB)"><Input value={startTime} onChangeText={setStartTime} placeholder="09:00" /></FormField></View> : null}
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1"><FormField label="Tanggal selesai / deadline"><DatePicker value={endDate} onChange={setEndDate} clearable /></FormField></View>
              {!allDay ? <View className="w-28"><FormField label="Jam selesai (WIB)"><Input value={endTime} onChangeText={setEndTime} placeholder="10:00" /></FormField></View> : null}
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
            <View className="flex-row gap-3">
              <View className="flex-1">
                <FormField label="Pengingat sebelum jadwal">
                  <SearchableSelect
                    value={REMINDER_OPTIONS.find((r) => r.value === reminder)?.label}
                    onChange={(v) => setReminder(REMINDER_OPTIONS.find((r) => r.label === v)?.value ?? null)}
                    options={REMINDER_OPTIONS.map((r) => r.label)}
                  />
                </FormField>
              </View>
              {reminder === -1 ? (
                <View className="w-36">
                  <FormField label="Menit sebelum">
                    <Input value={customReminderMin} onChangeText={setCustomReminderMin} keyboardType="numeric" placeholder="45" />
                  </FormField>
                </View>
              ) : null}
            </View>
            {!eventId ? (
              <Pressable
                onPress={() => setRemindOnCreate((v) => !v)}
                className={cn(
                  "self-start min-h-[32px] justify-center rounded-full border px-3",
                  remindOnCreate ? "border-primary bg-primary/15" : "border-border bg-card",
                )}
              >
                <Text className={cn("text-xs", remindOnCreate ? "text-primary font-medium" : "text-text-secondary")}>
                  Notifikasi saat agenda dibuat: {remindOnCreate ? "Aktif" : "Nonaktif"}
                </Text>
              </Pressable>
            ) : null}
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
            <View className="border-t border-border/60 pt-2 gap-3">
              <Text className="text-xs font-semibold text-muted-foreground">Relasi Dokumen ERP (Opsional)</Text>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <FormField label="Customer">
                    <SearchableSelect value={customerLabel} onChange={(v) => setCustomerLabel(v === customerLabel ? "" : v)} options={customerMap.map((x) => x.label)} placeholder="Pilih customer" />
                  </FormField>
                </View>
                <View className="flex-1">
                  <FormField label="Project">
                    <SearchableSelect value={projectLabel} onChange={(v) => setProjectLabel(v === projectLabel ? "" : v)} options={projectMap.map((x) => x.label)} placeholder="Pilih project" />
                  </FormField>
                </View>
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <FormField label="Lead / Prospek">
                    <SearchableSelect value={leadLabel} onChange={(v) => setLeadLabel(v === leadLabel ? "" : v)} options={leadMap.map((x) => x.label)} placeholder="Pilih lead" />
                  </FormField>
                </View>
                <View className="flex-1">
                  <FormField label="Invoice">
                    <SearchableSelect value={invoiceLabel} onChange={(v) => setInvoiceLabel(v === invoiceLabel ? "" : v)} options={invoiceMap.map((x) => x.label)} placeholder="Pilih invoice" />
                  </FormField>
                </View>
              </View>
              <FormField label="Vendor / Supplier">
                <SearchableSelect value={supplierLabel} onChange={(v) => setSupplierLabel(v === supplierLabel ? "" : v)} options={supplierMap.map((x) => x.label)} placeholder="Pilih supplier" />
              </FormField>
            </View>
            <FormField label="Deskripsi / catatan">
              <Textarea value={description} onChangeText={setDescription} numberOfLines={3} />
            </FormField>
            {eventId || status === "COMPLETED" ? (
              <FormField label="Catatan penyelesaian (opsional)">
                <Textarea value={completionNote} onChangeText={setCompletionNote} numberOfLines={2} placeholder="Ringkasan hasil atau tindak lanjut..." />
              </FormField>
            ) : null}
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
  item: CalItem | null; onClose: () => void; onChanged: () => void; onEdit: (id: number, occurrenceDate?: string) => void;
}) {
  const router = useRouter();
  const { toast } = useApp();
  const [detail, setDetail] = React.useState<any>(null);
  const [history, setHistory] = React.useState<{ id: string; who: string; what: string; when: string }[]>([]);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [occurrenceMode, setOccurrenceMode] = React.useState<"single" | "series">("single");
  const [noteInput, setNoteInput] = React.useState("");
  const [showCompleteInput, setShowCompleteInput] = React.useState(false);
  const isManual = item?.sourceModule === "calendar";
  const isRecurring = !!(item?.recurrence && item.recurrence !== "NONE");

  const [prevItemKey, setPrevItemKey] = React.useState<string | null>(null);
  const currentItemKey = item?.key ?? null;
  if (currentItemKey !== prevItemKey) {
    setPrevItemKey(currentItemKey);
    setDetail(null);
    setHistory([]);
    setOccurrenceMode("single");
    setNoteInput("");
    setShowCompleteInput(false);
  }

  const sourceId = item?.sourceId;

  React.useEffect(() => {
    if (!sourceId || !isManual) return;
    let active = true;
    // Riwayat HANYA untuk agenda ini (entityType + entityId).
    api<any>("GET", `/calendar/events/${sourceId}`)
      .then((res) => {
        if (active) setDetail(res);
      })
      .catch(() => undefined);

    api<any[]>("GET", `/audit-logs/entity/calendarEvent/${sourceId}`)
      .then((rows) => {
        if (!active) return;
        setHistory(
          (rows ?? [])
            .filter((r) => String(r.entityId) === String(sourceId) && r.entityType === "calendarEvent")
            .map((r) => ({ id: `al-${r.id}`, who: r.actorName || "Sistem", what: formatAuditAction(r.action, r.detail), when: r.createdAt })),
        );
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [sourceId, isManual]);

  if (!item) return null;
  const meta = CATEGORY_META[item.category] ?? CATEGORY_META.OTHER!;
  const occDate = wibKey(item.start);

  async function setStatus(status: string, completionNote?: string) {
    try {
      await api("POST", `/calendar/events/${item!.sourceId}/status`, {
        status,
        completionNote: completionNote?.trim() || undefined,
        ...(isRecurring ? { occurrenceMode, occurrenceDate: occDate } : {}),
      });
      toast("Status agenda diperbarui");
      onChanged();
      onClose();
    } catch (e: any) {
      toast(e?.message ?? "Gagal mengubah status", "danger");
    }
  }

  async function remove() {
    try {
      const qs = isRecurring ? `?occurrenceMode=${occurrenceMode}&occurrenceDate=${encodeURIComponent(occDate)}` : "";
      await api("DELETE", `/calendar/events/${item!.sourceId}${qs}`);
      toast(isRecurring && occurrenceMode === "single" ? "Kejadian pada tanggal ini dihapus" : "Agenda dihapus");
      onChanged();
      onClose();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menghapus agenda", "danger");
    }
  }

  const when = item.isAllDay
    ? `${tanggal(item.start)}${item.end && wibKey(item.end) !== wibKey(item.start) ? ` - ${tanggal(item.end)}` : ""} (Sepanjang hari)`
    : `${tanggal(item.start)}, ${wibTime(item.start)}${item.end ? ` - ${wibTime(item.end)}` : ""} WIB`;

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
              {item.hasConflict ? (
                <View className="rounded-full bg-amber-500/15 px-2.5 py-0.5">
                  <Text className="text-[11px] font-semibold text-amber-700">
                    Bentrok jadwal{item.conflictWith ? `: ${item.conflictWith}` : ""}
                  </Text>
                </View>
              ) : null}
            </View>
            {(item.eventNumber || detail?.eventNumber) ? (
              <Row label="ID Agenda">{item.eventNumber || detail?.eventNumber}</Row>
            ) : null}
            <Row label="Jadwal">{when}</Row>
            <Row label="Penanggung jawab">{item.picName ?? "-"}</Row>
            <Row label="Prioritas">{PRIORITY_LABEL[item.priority] ?? item.priority}</Row>
            {isRecurring ? <Row label="Pengulangan">{RECURRENCE_LABEL[item.recurrence!] ?? item.recurrence}</Row> : null}
            {isManual && detail?.attendees?.length ? (
              <Row label="Peserta">{detail.attendees.map((a: any) => a.user?.name).filter(Boolean).join(", ")}</Row>
            ) : null}
            {item.subtitle ? <Row label="Keterangan">{item.subtitle}</Row> : null}
            {(item.completionNote || detail?.completionNote) ? (
              <Row label="Catatan selesai">{item.completionNote || detail?.completionNote}</Row>
            ) : null}

            {item.routePath ? (
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

            {isManual && item.editable && isRecurring ? (
              <View className="rounded-lg border border-border bg-panel/60 p-2.5 gap-1.5">
                <Text className="text-xs font-semibold text-foreground">Terapkan aksi pada agenda berulang:</Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {[
                    { k: "single" as const, l: `Hanya kejadian tanggal ini (${occDate})` },
                    { k: "series" as const, l: "Seluruh rangkaian berulang" },
                  ].map((o) => (
                    <Pressable
                      key={o.k}
                      onPress={() => setOccurrenceMode(o.k)}
                      className={cn(
                        "min-h-[30px] justify-center rounded-full border px-3",
                        occurrenceMode === o.k ? "border-primary bg-primary/15" : "border-border bg-card",
                      )}
                    >
                      <Text className={cn("text-xs", occurrenceMode === o.k ? "text-primary font-semibold" : "text-text-secondary")}>
                        {o.l}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {isManual && item.editable && showCompleteInput ? (
              <View className="rounded-lg border border-border bg-card p-3 gap-2">
                <Text className="text-xs font-semibold text-foreground">Catatan Penyelesaian (Opsional)</Text>
                <Textarea
                  value={noteInput}
                  onChangeText={setNoteInput}
                  numberOfLines={2}
                  placeholder="Tulis hasil kegiatan atau catatan penyelesaian..."
                />
                <View className="flex-row gap-2">
                  <Button size="sm" onPress={() => setStatus("COMPLETED", noteInput)}>
                    <Text className="text-xs">Simpan & Selesaikan</Text>
                  </Button>
                  <Button size="sm" variant="outline" onPress={() => setShowCompleteInput(false)}>
                    <Text className="text-xs">Batal</Text>
                  </Button>
                </View>
              </View>
            ) : null}

            {isManual && item.editable ? (
              <View className="flex-row flex-wrap gap-2">
                {item.status !== "COMPLETED" ? (
                  <Button size="sm" onPress={() => setShowCompleteInput(true)}><Text className="text-xs">Tandai selesai</Text></Button>
                ) : (
                  <Button size="sm" variant="outline" onPress={() => setStatus("IN_PROGRESS")}><Text className="text-xs">Buka lagi</Text></Button>
                )}
                {item.status !== "CANCELLED" ? (
                  <Button size="sm" variant="outline" onPress={() => setStatus("CANCELLED")}><Text className="text-xs">Batalkan</Text></Button>
                ) : null}
                <Button size="sm" variant="outline" onPress={() => { onClose(); onEdit(item.sourceId, occDate); }}>
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
        description={
          isRecurring && occurrenceMode === "single"
            ? `Hanya kejadian pada tanggal ${occDate} yang akan dihapus dari rangkaian.`
            : "Agenda akan dihapus permanen beserta seluruh rangkaiannya."
        }
        confirmLabel="Ya, hapus"
        destructive
        onConfirm={remove}
      />
    </>
  );
}

