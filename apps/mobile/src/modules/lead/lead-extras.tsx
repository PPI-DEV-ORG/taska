import * as React from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  ArrowRight,
  Plus,
  Edit3,
  Phone,
  MessageSquare,
  Mail,
  Calendar,
  UserCheck,
  Check,
  Receipt,
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Panel } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { DatePicker } from "@/components/taska/dialogs";
import { CreateInvoiceDialog } from "@/modules/invoice/create-invoice-dialog";
import { useApp } from "@/store/app-store";
import { api } from "@/services/api";
import { colors } from "@/tokens";
import { rupiah } from "@/lib/format";
import { type Row } from "@/constants/modules";
import { Line } from "@/modules/shared/line";

export function LeadExtras({ row }: { row: Row }) {
  const router = useRouter();
  const { toast, data, addRow, patchRow, setStatus, pushHistory, user, reload, refreshModule, createQuotationFromLead } = useApp();
  
  const leadQuotations = React.useMemo(() => {
    return (data.quotations ?? []).filter(
      (q: Row) =>
        (q.leadId && String(q.leadId) === String(row.id)) ||
        (q.lead && row.nama && q.lead.trim().toLowerCase() === row.nama.trim().toLowerCase())
    );
  }, [data.quotations, row.id, row.nama]);

  const quotation =
    leadQuotations[0] ||
    (data.quotations ?? []).find(
      (q) =>
        (q.leadId && String(q.leadId) === String(row.id)) ||
        (q.lead && q.lead.toLowerCase() === row.nama.toLowerCase())
    );

  const relProjects = React.useMemo(() => {
    const qIds = new Set(leadQuotations.map((q) => String(q.id)));
    return (data.projects ?? []).filter(
      (p: Row) =>
        (p.leadId && String(p.leadId) === String(row.id)) ||
        (p.lead && row.nama && p.lead.trim().toLowerCase() === row.nama.trim().toLowerCase()) ||
        (p.quotationId && qIds.has(String(p.quotationId)))
    );
  }, [data.projects, row.id, row.nama, leadQuotations]);

  const leadInvoices = React.useMemo(() => {
    const qIds = new Set(leadQuotations.map((q) => String(q.id)));
    const qNums = new Set(
      leadQuotations.map((q) => String(q.nomor || "").trim().toLowerCase()).filter(Boolean)
    );
    const pIds = new Set(relProjects.map((p) => String(p.id)));
    const leadName = String(row.nama || "").trim().toLowerCase();

    return (data.invoices ?? []).filter((inv: Row) => {
      if (inv.leadId && String(inv.leadId) === String(row.id)) return true;
      if (inv.lead && leadName && String(inv.lead).trim().toLowerCase() === leadName) return true;
      if (inv.quotationId && qIds.has(String(inv.quotationId))) return true;
      if (inv.quotation && qNums.has(String(inv.quotation).trim().toLowerCase())) return true;
      if (inv.projectId && pIds.has(String(inv.projectId))) return true;
      const cat = String(inv.catatan || inv.description || "").toLowerCase();
      if (String(inv.catatan || "").includes(`[lead:${row.id}]`)) return true;
      if (leadName && cat.includes(leadName)) return true;
      for (const qNum of qNums) {
        if (cat.includes(qNum)) return true;
      }
      return false;
    });
  }, [data.invoices, leadQuotations, relProjects, row.nama]);

  const [invoiceModalOpen, setInvoiceModalOpen] = React.useState(false);
  const isQualify = ["Qualification", "Proposal", "Negotiation", "Won"].includes(row.status);
  const lostReasons: string[] = (data.lostReasons ?? []).map((r: Row) => String(r.nama)).filter(Boolean);

  // Follow-up state
  const [fuOpen, setFuOpen] = React.useState(false);
  const [fuMethod, setFuMethod] = React.useState<"Telepon" | "WhatsApp" | "Meeting" | "Email" | "Survey">("Telepon");
  const [fuDate, setFuDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [fuNote, setFuNote] = React.useState("");
  const [fuNextAction, setFuNextAction] = React.useState("");
  const [fuStatus, setFuStatus] = React.useState<"SELESAI" | "TERJADWAL">("SELESAI");
  const [selectedFu, setSelectedFu] = React.useState<any>(null);
  const [editFuStatus, setEditFuStatus] = React.useState<"SELESAI" | "TERJADWAL">("SELESAI");

  const apiFollowups = React.useMemo(() => {
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
    if (Array.isArray(row._followUps) && row._followUps.length > 0) {
      return row._followUps.map((f: any) => ({
        id: String(f.id),
        method: String(f.method || "Telepon"),
        note: String(f.notes || "-"),
        date: String(f.date || ""),
        next: f.nextAction ? String(f.nextAction) : undefined,
        status: String(f.status || "SELESAI"),
      }));
    }
    return [];
  }, [data.followups, row.id, row._followUps]);

  // Reassign Sales state
  const [reassignOpen, setReassignOpen] = React.useState(false);
  const [newOwner, setNewOwner] = React.useState(row.pemilik || "");
  const [reassignReason, setReassignReason] = React.useState("");

  // Edit Lost Reason state
  const [lostReasonOpen, setLostReasonOpen] = React.useState(false);
  const [selectedLostReason, setSelectedLostReason] = React.useState(row.alasanLost || lostReasons[0]);

  const salesUsers: Row[] = (data.users ?? []).filter((u: Row) =>
    ["super_admin", "sales", "pm", "bos", "admin"].includes(String(u.role)),
  );

  async function handleAddFollowup() {
    if (!fuNote.trim()) {
      toast("Catatan follow-up tidak boleh kosong", "danger");
      return;
    }
    const created = await addRow("followups", {
      leadId: row.id,
      date: fuDate || new Date().toISOString().slice(0, 10),
      method: fuMethod,
      notes: fuNote.trim(),
      nextDate: fuNextAction || undefined,
      status: fuStatus,
    });
    if (created) {
      patchRow("leads", row.id, { sepi: 0 });
      pushHistory("leads", row.id, `Follow-up (${fuMethod}): ${fuNote.trim()}${fuNextAction ? ` | Next: ${fuNextAction}` : ""}`);
      setFuNote("");
      setFuNextAction("");
      setFuOpen(false);
    }
  }

  function handleReassign() {
    if (!newOwner) return;
    patchRow("leads", row.id, { pemilik: newOwner });
    pushHistory("leads", row.id, `Kepemilikan dialihkan ke ${newOwner}${reassignReason ? ` (${reassignReason})` : ""}`);
    toast(`Lead berhasil dialihkan kepada ${newOwner}`);
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
    const custName = row.perusahaan || row.customer || "Klien";
    const projName = row.nama
      ? row.nama.toLowerCase().startsWith("project")
        ? row.nama
        : `Project ${row.nama}`
      : `Project ${custName}`;
    await addRow("projects", {
      nama: projName,
      customer: custName,
      perusahaan: custName,
      customerId: row.customerId,
      quotationId: quotation?.id ? Number(quotation.id) : undefined,
      penawaran: quotation?.nomor,
      lead: row.nama,
      leadId: row.id,
      jenis: "Customer",
      pm: data.users?.find((u: any) => u.role === "pm")?.nama || "Dimas Prasetyo",
      mulai: new Date().toISOString().slice(0, 10),
      selesai: row.targetSelesai || row.closing || new Date().toISOString().slice(0, 10),
      status: "Berjalan",
    });
    toast("Project baru berhasil dibuat");
    router.push("/leads");
  }

  return (
    <>
      {row.status === "Won" || relProjects.length > 0 ? (
        <Panel
          title="Project Terkait"
          subtitle="Prospek yang berhasil (Won) dapat langsung dilanjutkan ke pengerjaan Project."
          right={
            <Button size="sm" onPress={handleCreateProject} className="flex-row items-center gap-1">
              <Plus size={14} color={colors.background} />
              <Text className="text-xs">Jadikan Project</Text>
            </Button>
          }
        >
          {(() => {
            if (relProjects.length === 0) {
              return (
                <Text className="py-2 text-xs text-muted-foreground">
                  Lead ini berstatus Won. Klik tombol &quot;Jadikan Project&quot; untuk membuat project baru.
                </Text>
              );
            }
            return (
              <View className="gap-2">
                {relProjects.map((proj: Row) => (
                  <View key={proj.id} className="flex-row items-center justify-between p-2.5 rounded-lg bg-panel border border-border/80">
                    <View className="flex-1 mr-2">
                      <Text className="text-xs font-bold text-foreground">{proj.nama}</Text>
                      <Text className="text-[11px] text-muted-foreground">
                        PM: {proj.pm || "-"} · Status: {proj.status || "Berjalan"}
                      </Text>
                    </View>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2.5"
                      onPress={() => router.push(`/projects/${proj.id}` as any)}
                    >
                      <Text className="text-xs">Buka Project</Text>
                    </Button>
                  </View>
                ))}
              </View>
            );
          })()}
        </Panel>
      ) : null}

      <Panel
        title="PIC & Kepemilikan Lead"
        subtitle="Setiap lead memiliki PIC Sales yang bertanggung jawab mengawal pipeline."
        right={
          (user?.role === "super_admin" || user?.role === "bos" || user?.role === "admin" || user?.role === "sales") ? (
            <Button size="sm" variant="outline" onPress={() => setReassignOpen(true)}>
              <UserCheck size={14} color={colors.text} />
              <Text className="text-xs">Alihkan PIC</Text>
            </Button>
          ) : undefined
        }
      >
        <Line left="Sales Penanggung Jawab" right={<Text className="font-semibold text-primary">{row.pemilik || "-"}</Text>} />
        <Line left="Tipe Pelanggan" right={<Text className="font-medium">{row.tipe || "End user"}</Text>} />
        <Line left="Kontak Person Klien" right={<Text className="text-muted-foreground">{row.kontak || "-"}</Text>} />
      </Panel>

      {row.status === "Lost" ? (
        <Panel
          title="Alasan Lost"
          subtitle="Analisis penyebab kegagalan peluang untuk evaluasi sales."
          right={
            !["bos", "admin"].includes(user?.role || "") ? (
              <Button size="sm" variant="outline" onPress={() => setLostReasonOpen(true)}>
                <Edit3 size={13} color={colors.text} />
                <Text className="text-xs">Ubah Alasan</Text>
              </Button>
            ) : undefined
          }
        >
          <Text className="text-danger font-medium text-sm">{row.alasanLost || "Belum ada alasan tercatat"}</Text>
        </Panel>
      ) : null}

      {row.sepi > 7 && row.status !== "Won" && row.status !== "Lost" ? (
        <View className="bg-warning/15 border-warning/40 flex-row items-center gap-2 rounded-xl border p-3">
          <AlertTriangle size={16} color={colors.warning} />
          <Text className="text-warning flex-1 text-sm">
            Belum ada tindak lanjut selama {row.sepi} hari. Segera hubungi customer untuk mencegah lead dingin!
          </Text>
        </View>
      ) : null}

      <Panel
        title="Riwayat Tindak Lanjut (Follow-up)"
        subtitle="Aktivitas komunikasi sales dengan calon pelanggan. Otomatis me-reset masa sepi."
        right={
          <Button size="sm" onPress={() => setFuOpen(true)} className="flex-row items-center gap-1">
            <Plus size={14} color={colors.background} />
            <Text className="text-xs">Catat Follow-up</Text>
          </Button>
        }
      >
        <View className="gap-2">
          {apiFollowups.length === 0 ? (
            <Text className="text-muted-foreground text-xs py-2">Belum ada riwayat follow-up tercatat.</Text>
          ) : (
            apiFollowups.map((item) => (
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
                      {!["Telepon", "WhatsApp", "Email"].includes(item.method) ? <Calendar size={13} color={colors.primary} /> : null}
                    </View>
                    <Text className="text-xs font-semibold text-foreground">{item.method}</Text>
                    <StatusBadge status={item.status} />
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-[11px] text-muted-foreground">{item.date}</Text>
                    <ArrowRight size={12} color={colors.textSecondary} />
                  </View>
                </View>
                <Text className="text-xs text-foreground mt-1 leading-relaxed" numberOfLines={2}>{item.note}</Text>
                {item.next ? (
                  <View className="bg-panel/60 border-border/60 mt-1.5 flex-row items-center gap-1.5 rounded p-1.5 border">
                    <Calendar size={12} color={colors.info} />
                    <Text className="text-[11px] text-info">Jadwal follow-up berikutnya: {item.next}</Text>
                  </View>
                ) : null}
                <Text className="text-[10px] text-primary/70 mt-1 font-medium">Klik untuk lihat isi pembahasan & ubah status</Text>
              </Pressable>
            ))
          )}
        </View>
      </Panel>

      {/* Panel Penawaran Terkait */}
      <Panel
        title="Penawaran Terkait"
        subtitle="Daftar penawaran harga yang terhubung dengan lead ini."
        right={
          <Button
            size="sm"
            onPress={async () => {
              try {
                const created = await createQuotationFromLead(row);
                if (created?.id) {
                  toast("Penawaran berhasil dibuat!");
                  router.push(`/quotations/${created.id}` as any);
                }
              } catch (e: any) {
                toast(e?.message || "Gagal membuat penawaran", "danger");
              }
            }}
            className="flex-row items-center gap-1"
          >
            <Plus size={14} color={colors.background} />
            <Text className="text-xs">Buat Penawaran</Text>
          </Button>
        }
      >
        {leadQuotations.length > 0 ? (
          <View className="gap-2.5">
            {leadQuotations.map((q: Row) => (
              <View key={q.id} className="bg-card border border-border/80 rounded-xl p-3 gap-2">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <FileText size={16} color={colors.primary} />
                    <Text className="text-sm font-bold text-foreground">{q.nomor || `Q-${q.id}`}</Text>
                  </View>
                  <StatusBadge status={q.status || "Draf"} />
                </View>

                <View className="flex-row items-center justify-between pt-1">
                  <View>
                    <Text className="text-[11px] text-muted-foreground">Total Penawaran</Text>
                    <Text className="text-xs font-semibold text-foreground">
                      {rupiah(q.totalAfterDisc || q.total || q.nilai || 0)}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-[11px] text-muted-foreground">Tanggal</Text>
                    <Text className="text-xs font-semibold text-foreground">
                      {q.tanggal || "-"}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center justify-end gap-2 pt-1 border-t border-border/40 mt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2.5"
                    onPress={() => router.push(`/quotations/${q.id}` as any)}
                  >
                    <FileText size={13} color={colors.text} />
                    <Text className="text-xs ml-1">Buka Penawaran</Text>
                    <ArrowRight size={13} color={colors.text} className="ml-1" />
                  </Button>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View className="gap-2.5 py-1">
            <Text className="text-xs text-muted-foreground leading-relaxed">
              Belum ada penawaran untuk prospek ini. Buat penawaran untuk mengisi rincian produk, harga, dan mengelola dokumen penawaran.
            </Text>
            <Button
              size="sm"
              onPress={async () => {
                try {
                  const created = await createQuotationFromLead(row);
                  if (created?.id) {
                    toast("Penawaran berhasil dibuat!");
                    router.push(`/quotations/${created.id}` as any);
                  }
                } catch (e: any) {
                  toast(e?.message || "Gagal membuat penawaran", "danger");
                }
              }}
              className="self-start flex-row items-center gap-1.5"
            >
              <Plus size={14} color={colors.background} />
              <Text className="text-xs font-semibold">Buat Penawaran</Text>
            </Button>
          </View>
        )}
      </Panel>

      {/* Panel Invoice Terkait */}
      <Panel
        title="Invoice Terkait"
        subtitle="Kelola tagihan pembayaran untuk prospek atau penawaran ini."
        right={
          <Button
            size="sm"
            onPress={() => setInvoiceModalOpen(true)}
            className="flex-row items-center gap-1"
          >
            <Plus size={14} color={colors.background} />
            <Text className="text-xs">Buat Invoice</Text>
          </Button>
        }
      >
        {leadInvoices.length > 0 ? (
          <View className="gap-2.5">
            {leadInvoices.map((inv: Row) => {
              const isPaid = inv.status === "Lunas";
              return (
                <View
                  key={inv.id}
                  className="bg-card border border-border/80 rounded-xl p-3 gap-2"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <Receipt size={16} color={colors.primary} />
                      <Text className="text-sm font-bold text-foreground">{inv.nomor}</Text>
                    </View>
                    <StatusBadge status={inv.status || "Belum dikirim"} />
                  </View>

                  <View className="flex-row items-center justify-between pt-1">
                    <View>
                      <Text className="text-[11px] text-muted-foreground">Total Tagihan</Text>
                      <Text className="text-xs font-semibold text-foreground">{rupiah(inv.total || inv.nilai || 0)}</Text>
                    </View>
                    <View>
                      <Text className="text-[11px] text-muted-foreground">Terbayar</Text>
                      <Text className={`text-xs font-semibold ${isPaid ? "text-success" : "text-foreground"}`}>
                        {rupiah(inv.terbayar || 0)}
                      </Text>
                    </View>
                    <View>
                      <Text className="text-[11px] text-muted-foreground">Jatuh Tempo</Text>
                      <Text className="text-xs font-semibold text-foreground">{inv.jatuhTempo || "-"}</Text>
                    </View>
                  </View>

                  <View className="flex-row items-center justify-end gap-2 pt-1 border-t border-border/40 mt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2.5"
                      onPress={() => router.push(`/invoices/${inv.id}` as any)}
                    >
                      <Text className="text-xs">Buka Detail</Text>
                    </Button>
                    {!isPaid ? (
                      <Button
                        size="sm"
                        className="h-8 px-2.5 bg-success"
                        onPress={async () => {
                          try {
                            await setStatus("invoices", String(inv.id), "Lunas");
                            toast(`Invoice ${inv.nomor} berhasil dilunasi!`);
                          } catch {
                            toast("Gagal mengubah status invoice", "danger");
                          }
                        }}
                      >
                        <Check size={13} color="#ffffff" />
                        <Text className="text-xs text-white font-medium ml-1">Jadikan Lunas</Text>
                      </Button>
                    ) : (
                      <View className="flex-row items-center gap-1 px-2 py-1 bg-success/15 rounded-md">
                        <CheckCircle2 size={13} color={colors.success} />
                        <Text className="text-xs text-success font-semibold">Lunas</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View className="gap-2.5 py-1">
            <Text className="text-xs text-muted-foreground leading-relaxed">
              Belum ada invoice yang dibuat untuk lead ini. Klik tombol &quot;Buat Invoice&quot; untuk membuat tagihan langsung atau dari penawaran terkait.
            </Text>
            <Button
              size="sm"
              onPress={() => setInvoiceModalOpen(true)}
              className="self-start flex-row items-center gap-1.5"
            >
              <Plus size={14} color={colors.background} />
              <Text className="text-xs font-semibold">Buat Invoice</Text>
            </Button>
          </View>
        )}
      </Panel>

      {/* Modal Catat Follow-up */}
      <Dialog open={fuOpen} onOpenChange={setFuOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Catat Tindak Lanjut (Follow-up)</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <View className="gap-1.5">
              <Text className="text-xs text-muted-foreground font-medium">Tanggal Komunikasi</Text>
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
                placeholder="Contoh: Diskusi kebutuhan 16 titik kamera di gudang utama, customer meminta estimasi diskon 5%..."
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
                placeholder="Pilih tanggal jadwal berikutnya"
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
      <Dialog open={!!selectedFu} onOpenChange={(open) => { if (!open) setSelectedFu(null); }}>
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
                  <Text className="text-xs text-foreground leading-relaxed">
                    {selectedFu.note || "-"}
                  </Text>
                </View>
              </View>

              {selectedFu.next ? (
                <View className="bg-panel/60 border-border/60 flex-row items-center gap-2 rounded-lg p-2.5 border">
                  <Calendar size={14} color={colors.info} />
                  <View>
                    <Text className="text-[10px] text-muted-foreground uppercase font-semibold">Jadwal Tindak Lanjut Berikutnya</Text>
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
                  pushHistory("leads", row.id, `Status follow-up (${selectedFu.method}) diubah menjadi ${editFuStatus}`);
                  toast("Status follow-up berhasil diperbarui");
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

      {/* Modal Reassign Kepemilikan Sales */}
      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alihkan PIC Sales</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <Text className="text-xs text-muted-foreground">
              Pindahkan tanggung jawab lead ini ke sales lain. Semua riwayat follow-up dan penawaran akan tetap utuh.
            </Text>
            <View className="gap-1.5">
              <Text className="text-xs text-muted-foreground font-medium">Pilih Sales Baru</Text>
              <View className="gap-1">
                {salesUsers.map((u) => (
                  <Pressable
                    key={u.id}
                    onPress={() => setNewOwner(u.name)}
                    className={`border rounded-lg p-2.5 flex-row items-center justify-between ${
                      newOwner === u.name ? "bg-primary/10 border-primary" : "border-border"
                    }`}
                  >
                    <View>
                      <Text className="text-xs font-semibold">{u.name}</Text>
                      <Text className="text-[11px] text-muted-foreground">{u.role.toUpperCase()} · {u.email}</Text>
                    </View>
                    {newOwner === u.name ? <Check size={16} color={colors.primary} /> : null}
                  </Pressable>
                ))}
              </View>
            </View>

            <View className="gap-1.5">
              <Text className="text-xs text-muted-foreground font-medium">Alasan Pengalihan (Opsional)</Text>
              <Input
                value={reassignReason}
                onChangeText={setReassignReason}
                placeholder="Contoh: Cuti tahunan / pembagian wilayah"
              />
            </View>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setReassignOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleReassign}>
              <Text>Simpan Perubahan</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Ubah Alasan Lost */}
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
                className={`border rounded-lg p-2.5 flex-row items-center justify-between ${
                  selectedLostReason === r ? "bg-danger/10 border-danger" : "border-border"
                }`}
              >
                <Text className="text-xs flex-1 pr-2">{r}</Text>
                {selectedLostReason === r ? <Check size={16} color={colors.danger} /> : null}
              </Pressable>
            ))}
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setLostReasonOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSaveLostReason}>
              <Text>Simpan</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Buat Invoice dari Lead */}
      <CreateInvoiceDialog
        open={invoiceModalOpen}
        onOpenChange={setInvoiceModalOpen}
        initialQuotation={quotation}
        initialLead={row}
        onSuccess={async () => {
          await refreshModule("invoices");
        }}
      />

    </>
  );
}
