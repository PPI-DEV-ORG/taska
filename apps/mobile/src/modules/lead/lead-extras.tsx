import * as React from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  ChevronRight,
  Download,
  Edit3,
  Phone,
  MessageSquare,
  Mail,
  Calendar,
  UserCheck,
  Check,
  Plus,
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Panel } from "@/components/akuntra/basics";
import { StatusBadge } from "@/components/akuntra/status-badge";
import { DatePicker } from "@/components/akuntra/dialogs";
import { CreateQuotationDialog } from "@/modules/quotation/create-quotation-dialog";
import { downloadQuotationTemplate } from "@/modules/quotation/quotation-files";
import { useApp } from "@/store/app-store";
import { api } from "@/services/api";
import { colors } from "@/tokens";
import { rupiah } from "@/lib/format";
import { type Row } from "@/constants/modules";
import {
  calcQuotationFinancials,
  getInitialPphMode,
  getInitialPpnMode,
  pphModeToTipe,
  ppnModeToTipe,
} from "@/modules/quotation/lib";

type FuMethod = "Telepon" | "WhatsApp" | "Meeting" | "Email" | "Survey";
type FuStatus = "SELESAI" | "TERJADWAL";

const str = (v: any): string =>
  typeof v === "string" ? v : v && typeof v === "object" ? String(v.name ?? v.nama ?? v.label ?? "") : v != null ? String(v) : "";

/** Satu baris dokumen terkait (penawaran / SO / proyek / faktur) yang bisa diketuk untuk membuka detailnya. */
function DocRow({ title, meta, status, onPress }: { title: string; meta?: string; status?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-lg border border-border/80 bg-panel px-3 py-2.5 active:opacity-75"
    >
      <View className="flex-1 min-w-0">
        <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>{title}</Text>
        {meta ? <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>{meta}</Text> : null}
      </View>
      {status ? <StatusBadge status={status} /> : null}
      <ChevronRight size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

function AddButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Button size="sm" onPress={onPress} className="flex-row items-center gap-1">
      <Plus size={14} color={colors.background} />
      <Text className="text-xs">{label}</Text>
    </Button>
  );
}

const METHOD_ICON: Record<string, typeof Phone> = { Telepon: Phone, WhatsApp: MessageSquare, Email: Mail };

export function LeadExtras({ row }: { row: Row }) {
  const router = useRouter();
  const { toast, data, addRow, patchRow, pushHistory, reload, refreshModule, can, user } = useApp();

  // ---- Status & hak akses ----
  const isWon = row.status === "Won";
  const isLost = row.status === "Lost";
  const isOpen = !isWon && !isLost;
  const isPenjualanBarang = /barang|retail|perangkat/i.test(String(row.jenisTransaksi || ""));

  const canEditLead = can("leads", "U");
  const canSeeQuotes = can("quotations", "L");
  const canCreateQuote = can("quotations", "C");
  const canSeeSo = can("po-client", "L");
  const canCreateSo = can("po-client", "C");
  const canSeeProjects = can("projects", "L");
  // Jadikan proyek: yang punya hak Buat Proyek, atau PIC prospek ini sendiri (Sales)
  const isLeadOwner = !!user?.id && String(row.ownerId ?? "") === String(user.id);
  const canCreateProject = can("projects", "C") || (isLeadOwner && can("leads", "U"));
  const canSeeInvoices = can("invoices", "L");
  const canSeeSurveys = can("surveys", "L") || can("surveys", "C");

  // Data survey dibutuhkan untuk menentukan apakah "Minta survey" boleh tampil (satu survey aktif per lead).
  React.useEffect(() => {
    if (canSeeSurveys && !data.surveys) void refreshModule("surveys").catch(() => {});
  }, [canSeeSurveys, data.surveys, refreshModule]);

  const leadSurveys = React.useMemo(
    () => (data.surveys ?? []).filter((s: Row) => String(s.leadId) === String(row.id)),
    [data.surveys, row.id],
  );
  const activeSurvey = leadSurveys.find((s: Row) => !["Selesai", "Dibatalkan"].includes(String(s.status)));

  // ---- Dokumen terkait ----
  const leadQuotations = React.useMemo(
    () => (data.quotations ?? []).filter((q: Row) => q.leadId && String(q.leadId) === String(row.id)),
    [data.quotations, row.id],
  );
  const quoteIds = React.useMemo(() => new Set(leadQuotations.map((q) => String(q.id))), [leadQuotations]);
  const quoteNums = React.useMemo(
    () => new Set(leadQuotations.map((q) => String(q.nomor || "").trim().toLowerCase()).filter(Boolean)),
    [leadQuotations],
  );

  const relProjects = React.useMemo(
    () =>
      (data.projects ?? []).filter(
        (p: Row) =>
          (p.leadId && String(p.leadId) === String(row.id)) || (p.quotationId && quoteIds.has(String(p.quotationId))),
      ),
    [data.projects, row.id, quoteIds],
  );

  const leadSos = React.useMemo(
    () =>
      (data["po-client"] ?? []).filter((so: Row) => {
        if (so.leadId && String(so.leadId) === String(row.id)) return true;
        if (so.quotationId && quoteIds.has(String(so.quotationId))) return true;
        const quoPrefix = (String(so.penawaran || "").split(" - ")[0] || "").trim().toLowerCase();
        if (quoPrefix && quoteNums.has(quoPrefix)) return true;
        return String(so.catatan || "").toLowerCase().includes(`[lead:${row.id}]`);
      }),
    [data, row.id, quoteIds, quoteNums],
  );

  const leadInvoices = React.useMemo(() => {
    const pIds = new Set(relProjects.map((p) => String(p.id)));
    return (data.invoices ?? []).filter((inv: Row) => {
      if (inv.leadId && String(inv.leadId) === String(row.id)) return true;
      if (inv.quotationId && quoteIds.has(String(inv.quotationId))) return true;
      if (inv.quotation && quoteNums.has(String(inv.quotation).trim().toLowerCase())) return true;
      if (inv.projectId && pIds.has(String(inv.projectId))) return true;
      return String(inv.catatan || inv.description || "").includes(`[lead:${row.id}]`);
    });
  }, [data.invoices, quoteIds, quoteNums, relProjects, row.id]);

  const followups = React.useMemo(() => {
    const fromStore = (data.followups ?? [])
      .filter((f: Row) => String(f.leadId) === String(row.id))
      .map((f: Row) => ({
        id: String(f.id),
        method: String(f.metode || f.method || "Telepon"),
        note: String(f.catatan || f.notes || "-"),
        date: String(f.tanggal || f.date || ""),
        next: f.berikutnya || f.nextAction ? String(f.berikutnya || f.nextAction) : undefined,
        status: String(f.status || "SELESAI"),
      }));
    if (fromStore.length > 0) return fromStore;
    return (Array.isArray(row._followUps) ? row._followUps : []).map((f: any) => ({
      id: String(f.id),
      method: String(f.method || "Telepon"),
      note: String(f.notes || "-"),
      date: String(f.date || ""),
      next: f.nextAction ? String(f.nextAction) : undefined,
      status: String(f.status || "SELESAI"),
    }));
  }, [data.followups, row.id, row._followUps]);

  // Lanjutan setelah Won: penjualan barang -> SO, proyek -> Project
  const showSo = canSeeSo && (leadSos.length > 0 || (isWon && isPenjualanBarang));
  const showProjects = canSeeProjects && (relProjects.length > 0 || (isWon && !isPenjualanBarang));

  // ---- Dialog state ----
  const [quoteOpen, setQuoteOpen] = React.useState(false);
  const [fuOpen, setFuOpen] = React.useState(false);
  const [fuMethod, setFuMethod] = React.useState<FuMethod>("Telepon");
  const [fuDate, setFuDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [fuNote, setFuNote] = React.useState("");
  const [fuNext, setFuNext] = React.useState("");
  const [selectedFu, setSelectedFu] = React.useState<(typeof followups)[number] | null>(null);
  const [editFuStatus, setEditFuStatus] = React.useState<FuStatus>("SELESAI");
  const [reassignOpen, setReassignOpen] = React.useState(false);
  const [newOwner, setNewOwner] = React.useState(row.pemilik || "");
  const [reassignReason, setReassignReason] = React.useState("");
  const lostReasons: string[] = (data.lostReasons ?? []).map((r: Row) => String(r.nama)).filter(Boolean);
  const [lostReasonOpen, setLostReasonOpen] = React.useState(false);
  const [selectedLostReason, setSelectedLostReason] = React.useState(row.alasanLost || lostReasons[0]);
  const [busy, setBusy] = React.useState(false);

  const salesUsers: Row[] = (data.users ?? []).filter((u: Row) =>
    ["super_admin", "sales", "pm", "bos", "admin"].includes(String(u.role)),
  );

  // ---- Aksi ----
  async function handleAddFollowup() {
    if (!fuNote.trim()) return toast("Catatan follow-up wajib diisi", "danger");
    const created = await addRow("followups", {
      leadId: row.id,
      date: fuNext || fuDate,
      method: fuMethod,
      notes: fuNote.trim(),
      nextDate: fuNext || undefined,
      status: fuNext ? "TERJADWAL" : "SELESAI",
    });
    if (!created) return;
    patchRow("leads", row.id, { sepi: 0 });
    pushHistory("leads", row.id, `Follow-up (${fuMethod}): ${fuNote.trim()}${fuNext ? ` | Berikutnya: ${fuNext}` : ""}`);
    setFuNote("");
    setFuNext("");
    setFuOpen(false);
  }

  async function handleSaveFuStatus() {
    if (!selectedFu) return;
    const ok = await patchRow("followups", selectedFu.id, { status: editFuStatus });
    if (ok) {
      pushHistory("leads", row.id, `Status follow-up (${selectedFu.method}) diubah menjadi ${editFuStatus}`);
      toast("Status follow-up diperbarui");
    }
    setSelectedFu(null);
  }

  function handleReassign() {
    if (!newOwner) return;
    patchRow("leads", row.id, { pemilik: newOwner });
    pushHistory("leads", row.id, `PIC dialihkan ke ${newOwner}${reassignReason ? ` (${reassignReason})` : ""}`);
    toast(`Lead dialihkan ke ${newOwner}`);
    setReassignOpen(false);
    setReassignReason("");
  }

  function handleSaveLostReason() {
    patchRow("leads", row.id, { alasanLost: selectedLostReason });
    pushHistory("leads", row.id, `Alasan Lost diperbarui: ${selectedLostReason}`);
    toast("Alasan Lost diperbarui");
    setLostReasonOpen(false);
  }

  async function handleCreateProject() {
    setBusy(true);
    try {
      // Endpoint khusus prospek Won: PIC prospek (Sales) boleh walau tanpa hak Buat Proyek.
      // Server memakai penawaran terbaru prospek ini & menunjuk PM sebagai PIC proyek (PM mendapat notifikasi).
      const created = await api<{ id: number }>("POST", `/projects/from-lead/${row.id}`, {});
      if (!created?.id) return;
      await reload();
      toast("Proyek berhasil dibuat. PM sudah diberi tahu.");
      router.push(`/projects/${created.id}` as any);
    } catch (err: any) {
      toast(err?.message || "Gagal membuat proyek", "danger");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateSo() {
    setBusy(true);
    try {
      const quo = leadQuotations.find((q: any) => q.status === "Disetujui" || q.status === "Won") || leadQuotations[0];
      const quoItems = Array.isArray(quo?.items) ? quo.items : [];
      const ppnMode = quo ? getInitialPpnMode(quo) : "none";
      const pphMode = quo ? getInitialPphMode(quo) : "none";
      const fin = quo
        ? calcQuotationFinancials(quo.nilai ?? quo.total ?? 0, quo.disc ?? quo.discount ?? 0, ppnMode, pphMode, quoItems)
        : null;
      const dpp = fin ? fin.dpp : Number(row.nilai || 0);
      const custName = row.perusahaan || quo?.customer || "-";

      const created = await addRow("po-client", {
        customer: custName,
        customerId: row.customerId ? Number(row.customerId) : quo?.customerId ? Number(quo.customerId) : undefined,
        penawaran: quo?.nomor ? `${quo.nomor} - ${custName}` : "-",
        quotationId: quo?.id ? Number(quo.id) : undefined,
        nilai: dpp,
        amount: dpp,
        ...(fin
          ? {
              discount: fin.discNum,
              ppn: fin.ppn,
              ppnMode,
              tipePpn: ppnModeToTipe(ppnMode),
              pph: fin.pph,
              pphMode,
              tipePph: quo?.tipePph || pphModeToTipe(pphMode),
              total: fin.totalAfterDisc,
            }
          : {}),
        tanggal: new Date().toISOString().slice(0, 10),
        leadId: Number(row.id),
        catatan: `[lead:${row.id}] Dibuat dari Lead: ${row.nama}${row.need ? ` — ${row.need}` : ""}`,
        items: quoItems,
        docMode: "SO",
      });
      if (!created?.id) return;
      await reload();
      toast("Sales Order berhasil dibuat");
      router.push(`/po-client/${created.id}` as any);
    } catch (err: any) {
      toast(err?.message || "Gagal membuat Sales Order", "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Peringatan lead dingin */}
      {isOpen && row.sepi > 7 ? (
        <View className="bg-warning/15 border-warning/40 flex-row items-center gap-2 rounded-xl border p-3">
          <AlertTriangle size={16} color={colors.warning} />
          <Text className="text-warning flex-1 text-sm">
            {row.sepi} hari tanpa follow-up. Segera hubungi customer.
          </Text>
        </View>
      ) : null}

      {/* PIC Sales — hanya tampil bila user boleh mengalihkan (nama PIC sudah ada di Informasi) */}
      {canEditLead && !isLost ? (
        <View className="flex-row items-center justify-between gap-3 rounded-xl border border-border/80 bg-card px-4 py-3">
          <View className="flex-1 min-w-0">
            <Text className="text-xs text-muted-foreground">PIC Sales</Text>
            <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>{row.pemilik || "-"}</Text>
          </View>
          <Button size="sm" variant="outline" onPress={() => setReassignOpen(true)}>
            <UserCheck size={14} color={colors.text} />
            <Text className="text-xs">Alihkan</Text>
          </Button>
        </View>
      ) : null}

      {/* Alasan Lost */}
      {isLost ? (
        <Panel
          title="Alasan Lost"
          right={
            canEditLead && lostReasons.length > 0 ? (
              <Button size="sm" variant="outline" onPress={() => setLostReasonOpen(true)}>
                <Edit3 size={13} color={colors.text} />
                <Text className="text-xs">Ubah</Text>
              </Button>
            ) : undefined
          }
        >
          <Text className="text-danger font-medium text-sm">{row.alasanLost || "Belum ada alasan tercatat"}</Text>
        </Panel>
      ) : null}

      {/* Lanjutan setelah Won */}
      {showSo ? (
        <Panel
          title={`Sales Order (${leadSos.length})`}
          right={isWon && canCreateSo && leadSos.length === 0 ? <AddButton label="Buat SO" onPress={() => !busy && handleCreateSo()} /> : undefined}
        >
          {leadSos.length === 0 ? (
            <Text className="text-xs text-muted-foreground">
              Belum ada SO. Data customer & barang dari penawaran akan disalin otomatis.
            </Text>
          ) : (
            <View className="gap-2">
              {leadSos.map((so: Row) => (
                <DocRow
                  key={so.id}
                  title={so.nomorSo && so.nomorSo !== "-" ? so.nomorSo : so.nomor || `SO #${so.id}`}
                  meta={`${rupiah(so.nilai || 0)} · ${so.tanggal || "-"}`}
                  status={so.status || "Diterima"}
                  onPress={() => router.push(`/po-client/${so.id}` as any)}
                />
              ))}
            </View>
          )}
        </Panel>
      ) : null}

      {showProjects ? (
        <Panel
          title={`Proyek (${relProjects.length})`}
          right={isWon && canCreateProject && relProjects.length === 0 ? <AddButton label="Jadikan Proyek" onPress={() => !busy && handleCreateProject()} /> : undefined}
        >
          {relProjects.length === 0 ? (
            <Text className="text-xs text-muted-foreground">Lead sudah Won. Buat proyek untuk mulai pengerjaan.</Text>
          ) : (
            <View className="gap-2">
              {relProjects.map((p: Row, idx: number) => {
                const pid = String(typeof p.id === "object" && p.id ? (p.id as any).id : p.id ?? idx);
                return (
                  <DocRow
                    key={`proj-${pid}`}
                    title={str(p.nama) || str(p.name) || `Project #${pid}`}
                    meta={`PM: ${str(p.pm) || "-"}`}
                    status={str(p.status) || "Berjalan"}
                    onPress={() => router.push(`/projects/${pid}` as any)}
                  />
                );
              })}
            </View>
          )}
        </Panel>
      ) : null}

      {/* Survey — permintaan baru lewat tombol "Minta survey" di header, hanya bila tidak ada survey aktif */}
      {canSeeSurveys && leadSurveys.length > 0 ? (
        <Panel title={`Survey (${leadSurveys.length})`}>
          {activeSurvey && isOpen ? (
            <Text className="text-xs text-muted-foreground mb-2">
              Survey ulang bisa diminta setelah survey yang berjalan selesai atau dibatalkan.
            </Text>
          ) : null}
          <View className="gap-2">
            {leadSurveys.map((s: Row) => (
              <DocRow
                key={s.id}
                title={`Survey #${s.id}`}
                meta={[s.jadwal || "Belum dijadwalkan", s.tim].filter(Boolean).join(" · ")}
                status={s.status}
                onPress={() => router.push(`/surveys/${s.id}` as any)}
              />
            ))}
          </View>
        </Panel>
      ) : null}

      {/* Penawaran */}
      {canSeeQuotes ? (
        <Panel
          title={`Penawaran (${leadQuotations.length})`}
          right={
            canCreateQuote && !isLost ? (
              <View className="flex-row items-center gap-2">
                {isOpen ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => {
                      downloadQuotationTemplate({ leadId: row.id, customer: row.perusahaan, lead: row.nama, signer: row.pemilik });
                      toast("Template penawaran (.xlsx) diunduh");
                    }}
                  >
                    <Download size={14} color={colors.text} />
                    <Text className="text-xs">Template</Text>
                  </Button>
                ) : null}
                <AddButton label="Buat Penawaran" onPress={() => setQuoteOpen(true)} />
              </View>
            ) : undefined
          }
        >
          {leadQuotations.length === 0 ? (
            <Text className="text-xs text-muted-foreground">Belum ada penawaran untuk prospek ini.</Text>
          ) : (
            <View className="gap-2">
              {leadQuotations.map((q: Row) => (
                <DocRow
                  key={q.id}
                  title={q.nomor || `Q-${q.id}`}
                  meta={`${rupiah(q.totalAfterDisc || q.total || q.nilai || 0)} · ${q.tanggal || "-"}`}
                  status={q.status || "Draf"}
                  onPress={() => router.push(`/quotations/${q.id}` as any)}
                />
              ))}
            </View>
          )}
        </Panel>
      ) : null}

      {/* Faktur — hanya daftar; pembuatan & pelunasan dilakukan di menu Faktur */}
      {canSeeInvoices && leadInvoices.length > 0 ? (
        <Panel title={`Faktur (${leadInvoices.length})`}>
          <View className="gap-2">
            {leadInvoices.map((inv: Row) => (
              <DocRow
                key={inv.id}
                title={inv.nomor || `INV #${inv.id}`}
                meta={`${rupiah(inv.total || inv.nilai || 0)} · terbayar ${rupiah(inv.terbayar || 0)}`}
                status={inv.status || "Belum dikirim"}
                onPress={() => router.push(`/invoices/${inv.id}` as any)}
              />
            ))}
          </View>
        </Panel>
      ) : null}

      {/* Follow-up */}
      <Panel
        title={`Follow-up (${followups.length})`}
        right={canEditLead && isOpen ? <AddButton label="Catat" onPress={() => setFuOpen(true)} /> : undefined}
      >
        {followups.length === 0 ? (
          <Text className="text-xs text-muted-foreground">Belum ada follow-up.</Text>
        ) : (
          <View>
            {followups.map((item) => {
              const Icon = METHOD_ICON[item.method] ?? Calendar;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setSelectedFu(item);
                    setEditFuStatus(item.status === "TERJADWAL" ? "TERJADWAL" : "SELESAI");
                  }}
                  className="border-border border-b py-2.5 last:border-b-0 active:opacity-75"
                >
                  <View className="flex-row items-center justify-between gap-2">
                    <View className="flex-row items-center gap-2">
                      <Icon size={14} color={colors.primary} />
                      <Text className="text-xs font-semibold text-foreground">{item.method}</Text>
                      <StatusBadge status={item.status} />
                    </View>
                    <Text className="text-xs text-muted-foreground">{item.date}</Text>
                  </View>
                  <Text className="text-xs text-foreground mt-1" numberOfLines={2}>{item.note}</Text>
                  {item.next ? <Text className="text-xs text-info mt-1">Berikutnya: {item.next}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        )}
      </Panel>

      {/* Dialog: catat follow-up */}
      <Dialog open={fuOpen} onOpenChange={setFuOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Catat Follow-up</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <View className="flex-row flex-wrap gap-1.5">
              {(["Telepon", "WhatsApp", "Meeting", "Email", "Survey"] as const).map((m) => (
                <Button key={m} size="sm" variant={fuMethod === m ? "default" : "outline"} onPress={() => setFuMethod(m)} className="h-8 px-2.5">
                  <Text className="text-xs">{m}</Text>
                </Button>
              ))}
            </View>
            <View className="gap-1.5">
              <Text className="text-xs text-muted-foreground font-medium">Tanggal</Text>
              <DatePicker value={fuDate} onChange={setFuDate} placeholder="Pilih tanggal" />
            </View>
            <View className="gap-1.5">
              <Text className="text-xs text-muted-foreground font-medium">Catatan</Text>
              <Textarea value={fuNote} onChangeText={setFuNote} placeholder="Ringkasan pembicaraan dengan customer" numberOfLines={3} />
            </View>
            <View className="gap-1.5">
              <Text className="text-xs text-muted-foreground font-medium">Jadwal berikutnya (opsional, masuk kalender)</Text>
              <DatePicker value={fuNext} onChange={setFuNext} placeholder="Pilih tanggal" />
            </View>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setFuOpen(false)}><Text>Batal</Text></Button>
            <Button onPress={handleAddFollowup}><Text>Simpan</Text></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: detail follow-up */}
      <Dialog open={!!selectedFu} onOpenChange={(open) => { if (!open) setSelectedFu(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedFu ? `${selectedFu.method} · ${selectedFu.date}` : "Follow-up"}</DialogTitle>
          </DialogHeader>
          {selectedFu ? (
            <View className="gap-3 py-2">
              <View className="bg-panel border-border/70 rounded-lg border p-3">
                <Text className="text-sm text-foreground leading-relaxed">{selectedFu.note || "-"}</Text>
              </View>
              {selectedFu.next ? <Text className="text-xs text-info">Jadwal berikutnya: {selectedFu.next}</Text> : null}
              {canEditLead ? (
                <View className="flex-row gap-2">
                  {(["SELESAI", "TERJADWAL"] as const).map((st) => (
                    <Button key={st} size="sm" variant={editFuStatus === st ? "default" : "outline"} onPress={() => setEditFuStatus(st)} className="flex-1 h-9">
                      <Text className="text-xs">{st === "SELESAI" ? "Selesai" : "Terjadwal"}</Text>
                    </Button>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onPress={() => setSelectedFu(null)}><Text>Tutup</Text></Button>
            {canEditLead ? <Button onPress={handleSaveFuStatus}><Text>Simpan</Text></Button> : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: alihkan PIC */}
      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alihkan PIC Sales</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <View className="gap-1">
              {salesUsers.map((u) => (
                <Pressable
                  key={u.id}
                  onPress={() => setNewOwner(u.name)}
                  className={`border rounded-lg p-2.5 flex-row items-center justify-between ${newOwner === u.name ? "bg-primary/10 border-primary" : "border-border"}`}
                >
                  <View>
                    <Text className="text-xs font-semibold">{u.name}</Text>
                    <Text className="text-xs text-muted-foreground">{String(u.role).toUpperCase()}</Text>
                  </View>
                  {newOwner === u.name ? <Check size={16} color={colors.primary} /> : null}
                </Pressable>
              ))}
            </View>
            <Input value={reassignReason} onChangeText={setReassignReason} placeholder="Alasan (opsional)" />
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setReassignOpen(false)}><Text>Batal</Text></Button>
            <Button onPress={handleReassign}><Text>Simpan</Text></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: ubah alasan Lost */}
      <Dialog open={lostReasonOpen} onOpenChange={setLostReasonOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ubah Alasan Lost</DialogTitle>
          </DialogHeader>
          <View className="gap-2 py-2">
            {lostReasons.map((r) => (
              <Pressable
                key={r}
                onPress={() => setSelectedLostReason(r)}
                className={`border rounded-lg p-2.5 flex-row items-center justify-between ${selectedLostReason === r ? "bg-danger/10 border-danger" : "border-border"}`}
              >
                <Text className="text-xs flex-1 pr-2">{r}</Text>
                {selectedLostReason === r ? <Check size={16} color={colors.danger} /> : null}
              </Pressable>
            ))}
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setLostReasonOpen(false)}><Text>Batal</Text></Button>
            <Button onPress={handleSaveLostReason}><Text>Simpan</Text></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {canCreateQuote ? <CreateQuotationDialog open={quoteOpen} onOpenChange={setQuoteOpen} defaultLead={row} /> : null}
    </>
  );
}
