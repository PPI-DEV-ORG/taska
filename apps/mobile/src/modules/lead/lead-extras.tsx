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
  const { toast, data, addRow, patchRow, pushHistory, user, reload } = useApp();
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
    </>
  );
}
