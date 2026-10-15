import * as React from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  ArrowRight,
  FileDown,
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
import { FileUploader } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { api, uploadQuotationExcel } from "@/services/api";
import { colors } from "@/tokens";
import { rupiah } from "@/lib/format";
import { type Row } from "@/constants/modules";
import { Line } from "@/modules/shared/line";
import { downloadQuotationTemplate } from "@/modules/quotation/quotation-files";

export function LeadExtras({ row }: { row: Row }) {
  const router = useRouter();
  const { toast, data, addRow, patchRow, setStatus, pushHistory, user, reload } = useApp();
  const quotation = (data.quotations ?? []).find(
    (q) => (q.leadId && String(q.leadId) === String(row.id)) || (q.lead && q.lead.toLowerCase() === row.nama.toLowerCase())
  );
  const isQualify = ["Qualification", "Proposal", "Negotiation", "Won"].includes(row.status);
  const lostReasons: string[] = (data.lostReasons ?? []).map((r: Row) => String(r.nama)).filter(Boolean);

  // Follow-up state
  const [fuOpen, setFuOpen] = React.useState(false);
  const [fuMethod, setFuMethod] = React.useState<"Telepon" | "WhatsApp" | "Meeting" | "Email" | "Survey">("Telepon");
  const [fuDate, setFuDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [fuNote, setFuNote] = React.useState("");
  const [fuNextAction, setFuNextAction] = React.useState("");
  const [fuStatus, setFuStatus] = React.useState<"SELESAI" | "JADWAL">("SELESAI");
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

  // Related Project & Invoices
  const relatedProject = React.useMemo(() => {
    return (data.projects ?? []).find(
      (p: Row) =>
        (quotation && p.quotationId && String(p.quotationId) === String(quotation.id)) ||
        (row.customerId && p.customerId && String(p.customerId) === String(row.customerId)) ||
        (p.customer && row.perusahaan && p.customer.trim().toLowerCase() === row.perusahaan.trim().toLowerCase()) ||
        (p.nama && row.nama && p.nama.toLowerCase().includes(row.nama.toLowerCase()))
    );
  }, [data.projects, quotation, row.customerId, row.perusahaan, row.nama]);

  const leadInvoices = React.useMemo(() => {
    const custName = (row.perusahaan || row.customer || "").trim().toLowerCase();
    const projId = relatedProject ? String(relatedProject.id) : null;
    const projName = relatedProject ? String(relatedProject.nama).trim().toLowerCase() : null;

    return (data.invoices ?? []).filter((inv: Row) => {
      if (row.customerId && inv.customerId && String(inv.customerId) === String(row.customerId)) return true;
      if (projId && inv.projectId && String(inv.projectId) === projId) return true;
      if (projName && inv.project && String(inv.project).trim().toLowerCase() === projName) return true;
      if (custName && inv.customer && String(inv.customer).trim().toLowerCase() === custName) return true;
      return false;
    });
  }, [data.invoices, row.customerId, row.perusahaan, row.customer, relatedProject]);

  const dealAmount = React.useMemo(() => {
    const raw = quotation?.totalAfterDisc || quotation?.total || row.nilai || 0;
    return typeof raw === "number" ? raw : Number(String(raw).replace(/\D/g, "")) || 0;
  }, [quotation, row.nilai]);

  // Invoice creation modal state
  const [invModalOpen, setInvModalOpen] = React.useState(false);
  const [invNomor, setInvNomor] = React.useState("");
  const [invType, setInvType] = React.useState<"Termin" | "DP" | "Pelunasan">("Termin");
  const [invAmount, setInvAmount] = React.useState("");
  const [invIncludePpn, setInvIncludePpn] = React.useState(true);
  const [invDueDate, setInvDueDate] = React.useState("");
  const [selectedProjectId, setSelectedProjectId] = React.useState("AUTO_PROJECT");
  const [isSubmittingInv, setIsSubmittingInv] = React.useState(false);

  function openInvoiceModal() {
    setInvAmount(String(dealAmount || ""));
    setSelectedProjectId(relatedProject ? String(relatedProject.id) : "AUTO_PROJECT");
    setInvDueDate(new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10));
    setInvModalOpen(true);
  }

  async function handleCreateInvoice() {
    const rawVal = Number(String(invAmount).replace(/\D/g, "")) || 0;
    if (rawVal <= 0) {
      toast("Nilai tagihan harus lebih dari 0", "danger");
      return;
    }
    const ppn = invIncludePpn ? Math.round(rawVal * 0.11) : 0;
    const total = rawVal + ppn;
    const custName = row.perusahaan || row.customer || "Klien";

    setIsSubmittingInv(true);
    try {
      let targetProjectId = selectedProjectId;
      let targetProjectName = "";

      if (targetProjectId === "AUTO_PROJECT" || !targetProjectId) {
        if (relatedProject) {
          targetProjectId = String(relatedProject.id);
          targetProjectName = relatedProject.nama;
        } else {
          const createdProj = await addRow("projects", {
            nama: `Project ${row.nama || custName}`,
            customer: custName,
            perusahaan: custName,
            customerId: row.customerId,
            jenis: "Customer",
            pm: (data.users ?? []).find((u: Row) => u.role === "pm")?.nama || "Dimas Prasetyo",
            mulai: new Date().toISOString().slice(0, 10),
            selesai: row.targetSelesai || row.closing || new Date().toISOString().slice(0, 10),
            status: "Berjalan",
          });
          if (createdProj) {
            targetProjectId = String(createdProj.id);
            targetProjectName = createdProj.nama;
          }
        }
      } else {
        const found = (data.projects ?? []).find((p: Row) => String(p.id) === String(targetProjectId));
        if (found) targetProjectName = found.nama;
      }

      const nextNomor =
        invNomor.trim() ||
        `INV/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, "0")}/${String(row.id).padStart(3, "0")}`;

      const created = await addRow("invoices", {
        nomor: nextNomor,
        customer: custName,
        customerId: row.customerId,
        project: targetProjectName,
        projectId: targetProjectId && targetProjectId !== "AUTO_PROJECT" ? targetProjectId : undefined,
        jenis: invType,
        nilai: rawVal,
        ppn,
        total,
        tanggal: new Date().toISOString().slice(0, 10),
        jatuhTempo: invDueDate,
        status: "Belum dikirim",
      });

      if (created) {
        toast(`Invoice ${nextNomor} berhasil dibuat & masuk daftar invoice!`);
        pushHistory("leads", row.id, `Invoice dibuat: ${nextNomor} (${rupiah(total)})`);
        setInvModalOpen(false);
        setInvNomor("");
      }
    } catch (e: any) {
      toast(e?.message ?? "Gagal membuat invoice", "danger");
    } finally {
      setIsSubmittingInv(false);
    }
  }

  return (
    <>
      {isQualify ? (
        <Panel
          title="Penawaran untuk Lead Ini"
          subtitle="Saat lead masuk tahap Qualification, penawaran otomatis disiapkan dengan nomor ter-generate & ter-link ke Lead."
        >
          {quotation ? (
            <View className="gap-3">
              <Line left="Nomor Penawaran" right={<Text className="text-primary font-bold">{quotation.nomor}</Text>} />
              <Line left="TOTAL (Sebelum PPN & Disc)" right={<Text className="font-semibold">{rupiah(quotation.total || quotation.nilai || 0)}</Text>} />
              <Line left="DISC (Diskon)" right={<Text className="text-danger font-semibold">- {rupiah(quotation.disc || 0)}</Text>} />
              <Line
                left={quotation.tipePpn?.includes("Include") ? "PPN (Sudah Termasuk)" : quotation.tipePpn?.includes("No") ? "PPN (Tanpa PPN)" : "PPN (11%)"}
                right={
                  <Text className="font-semibold">
                    {quotation.tipePpn?.includes("Include")
                      ? "Included"
                      : quotation.tipePpn?.includes("No")
                      ? "Rp 0"
                      : rupiah(quotation.ppn ?? Math.round(Math.max(0, (quotation.total || quotation.nilai || 0) - (quotation.disc || 0)) * 0.11))}
                  </Text>
                }
              />
              <Line
                left="TOTAL AFTER DISC (Grand Total)"
                right={<Text className="text-primary font-bold">{rupiah(quotation.totalAfterDisc || quotation.nilai || 0)}</Text>}
              />
              <Line left="Status Penawaran" right={<StatusBadge status={quotation.status || "Not Yet"} />} />
              <Line
                left="File Excel Penawaran"
                right={
                  quotation.fileUploaded ? (
                    <View className="flex-row items-center gap-1.5">
                      <CheckCircle2 size={14} color={colors.primary} />
                      <Text className="text-xs text-primary font-semibold">
                        {quotation.fileName || `Penawaran-${(quotation.nomor || "penawaran").replace(/\//g, "-")}.xlsx`}
                      </Text>
                    </View>
                  ) : (
                    <Text className="text-xs text-muted-foreground font-medium">Belum Diupload</Text>
                  )
                }
              />

              <FileUploader
                label="Upload File Excel Penawaran (.xlsx) — Sistem Otomatis Membaca Tabel & Nilai"
                kind="dokumen"
                autoFlush
                onFilePicked={async (file) => {
                  try {
                    await uploadQuotationExcel(quotation.id, file);
                    await reload();
                    toast("File Excel penawaran berhasil dibaca & disinkronkan ke Lead!");
                  } catch (e: any) {
                    toast(e?.message || "Gagal membaca file Excel", "danger");
                  }
                }}
              />

              <View className="flex-row flex-wrap items-center gap-2 mt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => {
                    downloadQuotationTemplate({
                      quotationId: quotation.id,
                      leadId: row.id,
                      customer: row.perusahaan,
                      lead: row.nama,
                      nomor: quotation.nomor,
                      signer: row.pemilik,
                    });
                    toast("File Excel penawaran (.xlsx) sedang diunduh");
                  }}
                  className="flex-row items-center gap-1.5"
                >
                  <FileDown size={15} color={colors.text} />
                  <Text className="text-xs">Download Excel (.xlsx)</Text>
                </Button>
                <Button
                  size="sm"
                  onPress={() => router.push(`/quotations/${quotation.id}` as any)}
                  className="flex-row items-center gap-1.5"
                >
                  <FileText size={15} color={colors.background} />
                  <Text className="text-xs">Buka & Kelola Penawaran ({quotation.nomor})</Text>
                  <ArrowRight size={14} color={colors.background} />
                </Button>
              </View>
            </View>
          ) : (
            <View className="gap-3">
              <Text className="text-xs text-muted-foreground leading-relaxed">
                Lead sudah masuk tahap kualifikasi. Silakan unduh template Excel penawaran (.xlsx) untuk diisi secara manual, atau buka modul Penawaran.
              </Text>
              <Button
                size="sm"
                variant="outline"
                onPress={() => {
                  downloadQuotationTemplate({
                    leadId: row.id,
                    customer: row.perusahaan,
                    lead: row.nama,
                    signer: row.pemilik,
                  });
                  toast("Template Excel penawaran (.xlsx) sedang diunduh");
                }}
                className="self-start flex-row items-center gap-1.5"
              >
                <FileDown size={15} color={colors.text} />
                <Text className="text-xs">Download Template Excel (.xlsx)</Text>
              </Button>
            </View>
          )}
        </Panel>
      ) : null}

      {/* Panel Invoice & Penagihan */}
      <Panel
        title="Invoice & Penagihan"
        subtitle="Kelola tagihan pembayaran untuk lead ini. Status pembayaran project akan otomatis sinkron."
        right={
          <Button
            size="sm"
            onPress={openInvoiceModal}
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
                      <Text className="text-[11px] text-muted-foreground">Project</Text>
                      <Text className="text-xs font-semibold text-primary" numberOfLines={1}>
                        {inv.project || relatedProject?.nama || "-"}
                      </Text>
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
                            toast(`Invoice ${inv.nomor} berhasil dilunasi & status Project tersinkronkan!`);
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
          <View className="gap-2 py-2">
            <Text className="text-xs text-muted-foreground leading-relaxed">
              Belum ada invoice yang dibuat untuk lead ini. Anda dapat membuat invoice langsung di sini. Setelah invoice lunas, status pembayaran project terkait akan otomatis berubah menjadi LUNAS.
            </Text>
            <Button
              size="sm"
              variant="outline"
              onPress={openInvoiceModal}
              className="self-start flex-row items-center gap-1.5 mt-1"
            >
              <Receipt size={14} color={colors.text} />
              <Text className="text-xs">Buat Invoice untuk Lead Ini</Text>
            </Button>
          </View>
        )}
      </Panel>

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
              <Text className="text-xs text-muted-foreground font-medium">Tanggal Follow-up Berikutnya (Opsional)</Text>
              <DatePicker value={fuNextAction} onChange={setFuNextAction} placeholder="Pilih tanggal jadwal berikutnya" />
            </View>

            <View className="gap-1.5">
              <Text className="text-xs text-muted-foreground font-medium">Status Follow-up</Text>
              <View className="flex-row gap-2">
                {(["SELESAI", "JADWAL"] as const).map((st) => (
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
      <Dialog open={invModalOpen} onOpenChange={setInvModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Buat Invoice untuk Lead Ini</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <View className="gap-1">
              <Text className="text-xs font-semibold text-muted-foreground">Nomor Invoice</Text>
              <Input
                value={invNomor}
                onChangeText={setInvNomor}
                placeholder="Otomatis ter-generate jika dikosongkan"
              />
            </View>

            <View className="gap-1">
              <Text className="text-xs font-semibold text-muted-foreground">Pelanggan / Perusahaan</Text>
              <Input
                value={row.perusahaan || row.customer || ""}
                editable={false}
                className="bg-muted/40"
              />
            </View>

            <View className="gap-1">
              <Text className="text-xs font-semibold text-muted-foreground">Project Terkait</Text>
              <View className="gap-1.5">
                <Pressable
                  onPress={() => setSelectedProjectId(relatedProject ? String(relatedProject.id) : "AUTO_PROJECT")}
                  className={`border rounded-lg p-2.5 flex-row items-center justify-between ${
                    selectedProjectId === (relatedProject ? String(relatedProject.id) : "AUTO_PROJECT")
                      ? "bg-primary/10 border-primary"
                      : "border-border"
                  }`}
                >
                  <View className="flex-1 pr-2">
                    <Text className="text-xs font-semibold">
                      {relatedProject
                        ? `Project Terkait: ${relatedProject.nama}`
                        : `Buat Project Otomatis (Project ${row.nama || row.perusahaan})`}
                    </Text>
                    <Text className="text-[11px] text-muted-foreground">
                      {relatedProject
                        ? `Status pembayaran project: ${relatedProject.pembayaran || "Belum lunas"}`
                        : "Project baru akan dibuat & pembayaran project otomatis LUNAS saat invoice lunas"}
                    </Text>
                  </View>
                  {selectedProjectId === (relatedProject ? String(relatedProject.id) : "AUTO_PROJECT") ? (
                    <Check size={16} color={colors.primary} />
                  ) : null}
                </Pressable>

                {(data.projects ?? [])
                  .filter((p: Row) => !relatedProject || String(p.id) !== String(relatedProject.id))
                  .slice(0, 3)
                  .map((p: Row) => (
                    <Pressable
                      key={p.id}
                      onPress={() => setSelectedProjectId(String(p.id))}
                      className={`border rounded-lg p-2 flex-row items-center justify-between ${
                        selectedProjectId === String(p.id) ? "bg-primary/10 border-primary" : "border-border"
                      }`}
                    >
                      <View className="flex-1 pr-2">
                        <Text className="text-xs font-medium">{p.nama}</Text>
                        <Text className="text-[10px] text-muted-foreground">{p.customer} · {p.pembayaran || "Belum lunas"}</Text>
                      </View>
                      {selectedProjectId === String(p.id) ? <Check size={14} color={colors.primary} /> : null}
                    </Pressable>
                  ))}
              </View>
            </View>

            <View className="gap-1">
              <Text className="text-xs font-semibold text-muted-foreground">Jenis Tagihan</Text>
              <View className="flex-row gap-2">
                {(["Termin", "DP", "Pelunasan"] as const).map((t) => (
                  <Button
                    key={t}
                    size="sm"
                    variant={invType === t ? "default" : "outline"}
                    onPress={() => setInvType(t)}
                    className="flex-1 h-8"
                  >
                    <Text className="text-xs">{t}</Text>
                  </Button>
                ))}
              </View>
            </View>

            <View className="gap-1">
              <Text className="text-xs font-semibold text-muted-foreground">Nilai Tagihan Sebelum PPN (Rp)</Text>
              <Input
                value={invAmount}
                onChangeText={setInvAmount}
                keyboardType="numeric"
                placeholder="Contoh: 15000000"
              />
            </View>

            <View className="flex-row items-center justify-between p-2.5 rounded-lg bg-panel border border-border">
              <View>
                <Text className="text-xs font-semibold text-foreground">PPN 11%</Text>
                <Text className="text-[11px] text-muted-foreground">
                  {invIncludePpn
                    ? `+ ${rupiah(Math.round((Number(String(invAmount).replace(/\D/g, "")) || 0) * 0.11))}`
                    : "Tanpa PPN (Rp 0)"}
                </Text>
              </View>
              <Button
                variant={invIncludePpn ? "default" : "outline"}
                size="sm"
                onPress={() => setInvIncludePpn(!invIncludePpn)}
                className="h-8"
              >
                <Text className="text-xs">{invIncludePpn ? "Pakai PPN (11%)" : "Tanpa PPN"}</Text>
              </Button>
            </View>

            <View className="flex-row items-center justify-between px-1">
              <Text className="text-xs font-semibold text-muted-foreground">Total Tagihan Invoice:</Text>
              <Text className="text-sm font-bold text-primary">
                {rupiah(
                  (Number(String(invAmount).replace(/\D/g, "")) || 0) +
                  (invIncludePpn ? Math.round((Number(String(invAmount).replace(/\D/g, "")) || 0) * 0.11) : 0)
                )}
              </Text>
            </View>

            <View className="gap-1">
              <Text className="text-xs font-semibold text-muted-foreground">Jatuh Tempo Pembayaran</Text>
              <DatePicker value={invDueDate} onChange={setInvDueDate} placeholder="Pilih Jatuh Tempo" />
            </View>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setInvModalOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleCreateInvoice} disabled={isSubmittingInv}>
              <Text>{isSubmittingInv ? "Menyimpan..." : "Simpan & Buat Invoice"}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
