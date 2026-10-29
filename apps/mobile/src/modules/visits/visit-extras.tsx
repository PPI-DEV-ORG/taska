import * as React from "react";
import { View, Pressable, ScrollView } from "react-native";
import {
  Printer,
  Plus,
  Edit3,
  CheckCircle2,
  Circle,
  CheckSquare,
  Clock,
  Trash2,
  ListTodo,
  Settings,
  FileText,
  DollarSign,
  AlertCircle,
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Panel } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { DatePicker, SearchableSelect } from "@/components/taska/dialogs";
import { FileUploader, type FileUploaderHandle } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { api, downloadDocumentationPdf } from "@/services/api";
import { colors } from "@/tokens";
import { rupiah, tanggal } from "@/lib/format";
import { type Row } from "@/constants/modules";
import { DocumentationPhotosPanel } from "@/modules/shared/documentation-photos-panel";
import { useRouter } from "expo-router";

type ActionItem = {
  id: number;
  visitReportId: number;
  task: string;
  assigneeId?: number | null;
  dueDate?: string | null;
  status: string;
  notes?: string | null;
};

export function VisitExtras({ row, onRefresh }: { row: Row; onRefresh?: () => void }) {
  const router = useRouter();
  const { data, user, toast, patchRow, setStatus, refreshModule } = useApp();

  const [pdfBusy, setPdfBusy] = React.useState(false);
  const [actions, setActions] = React.useState<ActionItem[]>(() =>
    Array.isArray(row.actions) ? row.actions : []
  );

  // MoM Dialog
  const [momDialogOpen, setMomDialogOpen] = React.useState(false);
  const [summary, setSummary] = React.useState(row.summary || "");
  const [clientNeeds, setClientNeeds] = React.useState(row.clientNeeds || "");
  const [productsIntroduced, setProductsIntroduced] = React.useState(row.productsIntroduced || "");
  const [clientFeedback, setClientFeedback] = React.useState(row.clientFeedback || "");
  const [agreements, setAgreements] = React.useState(row.agreements || "");
  const [potentialOpportunities, setPotentialOpportunities] = React.useState(row.potentialOpportunities || "");
  const [obstacles, setObstacles] = React.useState(row.obstacles || "");
  const [conclusion, setConclusion] = React.useState(row.conclusion || "");

  // Action item dialog
  const [addActionOpen, setAddActionOpen] = React.useState(false);
  const [newActionTask, setNewActionTask] = React.useState("");
  const [newActionDueDate, setNewActionDueDate] = React.useState("");
  const [newActionNotes, setNewActionNotes] = React.useState("");
  const [newActionAssignee, setNewActionAssignee] = React.useState<string>("");

  // Header & Logo customization dialog
  const [headerDialogOpen, setHeaderDialogOpen] = React.useState(false);
  const [companyHeader, setCompanyHeader] = React.useState(row.companyHeader || "");
  const logoUploaderRef = React.useRef<FileUploaderHandle | null>(null);

  const reloadVisit = React.useCallback(async () => {
    try {
      const res = await api<any>("GET", `/visit-reports/${row.id}`);
      if (Array.isArray(res?.actions)) {
        setActions(res.actions);
      }
    } catch {}
  }, [row.id]);

  React.useEffect(() => {
    let active = true;
    api<any>("GET", `/visit-reports/${row.id}`)
      .then((res) => {
        if (active && Array.isArray(res?.actions)) {
          setActions(res.actions);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [row.id]);

  // Expenses for this Visit
  const visitExpenses = React.useMemo(() => {
    return (data.expenses ?? []).filter((e: Row) => {
      if (e.visitReportId && String(e.visitReportId) === String(row.id)) return true;
      if (e.visitReport && (String(e.visitReport).includes(row.nomor) || String(e.visitReport).includes(row.judul))) return true;
      return false;
    });
  }, [data.expenses, row.id, row.nomor, row.judul]);

  const validExpenses = React.useMemo(() => {
    return visitExpenses.filter((e) => e.status !== "Ditolak" && e.status !== "REJECTED");
  }, [visitExpenses]);

  const totalBiayaAktual = React.useMemo(() => {
    return validExpenses.reduce((sum, e) => sum + (Number(e.nominal) || 0), 0);
  }, [validExpenses]);

  const companyCost = React.useMemo(() => {
    return validExpenses
      .filter((e) => e.fundingSource === "PERUSAHAAN" || !e.sumberDana?.includes("Talangan"))
      .reduce((sum, e) => sum + (Number(e.nominal) || 0), 0);
  }, [validExpenses]);

  const personalAdvanceCost = React.useMemo(() => {
    return validExpenses
      .filter((e) => e.fundingSource === "TALANGAN_PRIBADI" || e.sumberDana?.includes("Talangan"))
      .reduce((sum, e) => sum + (Number(e.nominal) || 0), 0);
  }, [validExpenses]);

  async function handleStatusTransition(nextStatus: string) {
    try {
      await setStatus("visit-reports", row.id, nextStatus);
      toast(`Status kunjungan berhasil diubah menjadi ${nextStatus}`, "success");
      onRefresh?.();
    } catch (err: any) {
      toast(err?.message || "Gagal mengubah status", "danger");
    }
  }

  async function handleSaveMoM() {
    try {
      await patchRow("visit-reports", row.id, {
        summary,
        clientNeeds,
        productsIntroduced,
        clientFeedback,
        agreements,
        potentialOpportunities,
        obstacles,
        conclusion,
      });
      toast("Hasil pertemuan & MoM berhasil disimpan", "success");
      setMomDialogOpen(false);
      onRefresh?.();
    } catch (err: any) {
      toast(err?.message || "Gagal menyimpan MoM", "danger");
    }
  }

  async function handleAddAction() {
    if (!newActionTask.trim()) {
      toast("Deskripsi tugas tindak lanjut wajib diisi", "danger");
      return;
    }
    try {
      const assigneeUser = data.users.find(
        (u) => String(u.nama || u.name) === newActionAssignee
      );
      await api("POST", `/visit-reports/${row.id}/actions`, {
        task: newActionTask.trim(),
        assigneeId: assigneeUser?.id ? Number(assigneeUser.id) : undefined,
        dueDate: newActionDueDate || undefined,
        notes: newActionNotes.trim() || undefined,
      });
      toast("Tindak lanjut berhasil ditambahkan", "success");
      setAddActionOpen(false);
      setNewActionTask("");
      setNewActionDueDate("");
      setNewActionNotes("");
      setNewActionAssignee("");
      await reloadVisit();
      onRefresh?.();
    } catch (err: any) {
      toast(err?.message || "Gagal menambahkan tindak lanjut", "danger");
    }
  }

  async function handleChangeActionStatus(item: ActionItem, nextStatus: string) {
    if (item.status === nextStatus) return;
    try {
      setActions((prev) =>
        prev.map((a) => (a.id === item.id ? { ...a, status: nextStatus } : a))
      );
      await api("PATCH", `/visit-reports/${row.id}/actions/${item.id}`, {
        status: nextStatus,
      });
      await reloadVisit();
      onRefresh?.();
    } catch (err: any) {
      toast(err?.message || "Gagal mengubah status tindak lanjut", "danger");
      await reloadVisit();
    }
  }

  async function handleDeleteAction(actionId: number) {
    try {
      await api("DELETE", `/visit-reports/${row.id}/actions/${actionId}`);
      toast("Tindak lanjut dihapus", "success");
      setActions((prev) => prev.filter((a) => a.id !== actionId));
      onRefresh?.();
    } catch (err: any) {
      toast(err?.message || "Gagal menghapus tindak lanjut", "danger");
    }
  }

  async function handleSaveHeader() {
    try {
      let logoFileId = row.logoFileId;
      if (logoUploaderRef.current?.hasStaged()) {
        try {
          logoFileId = await logoUploaderRef.current.flush();
        } catch {}
      }
      await patchRow("visit-reports", row.id, {
        companyHeader: companyHeader.trim() || null,
        logoFileId,
      });
      toast("Pengaturan kop dan logo berhasil diperbarui", "success");
      setHeaderDialogOpen(false);
      onRefresh?.();
    } catch (err: any) {
      toast(err?.message || "Gagal menyimpan kop laporan", "danger");
    }
  }

  async function handleDownloadPdf() {
    try {
      setPdfBusy(true);
      await downloadDocumentationPdf("visit", Number(row.id));
      toast("Laporan kunjungan PDF berhasil diekspor", "success");
    } catch (err: any) {
      toast(err?.message || "Gagal mengekspor PDF kunjungan", "danger");
    } finally {
      setPdfBusy(false);
    }
  }

  const userOptions = React.useMemo(() => {
    return ["-", ...data.users.map((u) => String(u.nama || u.name))];
  }, [data.users]);

  const completedActions = actions.filter((a) => a.status === "Done").length;

  return (
    <View style={{ gap: 16 }}>
      {/* ─── Status & Action Bar ─── */}
      <Panel
        title="Alur & Status Aktivitas Kunjungan"
        subtitle={`Nomor: ${row.nomor} · PIC: ${row.pemilik || user?.name}`}
      >
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Status Saat Ini:</Text>
            <StatusBadge status={row.status || "Planned"} />
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {row.status !== "Completed" && (
              <Button
                variant="outline"
                size="sm"
                onPress={() => handleStatusTransition("Completed")}
              >
                <CheckCircle2 size={14} color="#16a34a" />
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#16a34a" }}>Tandai Selesai</Text>
              </Button>
            )}

            {row.status !== "Cancelled" && (
              <Button
                variant="outline"
                size="sm"
                onPress={() => handleStatusTransition("Cancelled")}
              >
                <AlertCircle size={14} color="#dc2626" />
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#dc2626" }}>Batalkan</Text>
              </Button>
            )}

            {row.status !== "Planned" && (
              <Button
                variant="outline"
                size="sm"
                onPress={() => handleStatusTransition("Planned")}
              >
                <Clock size={14} color={colors.foreground} />
                <Text style={{ fontSize: 12, fontWeight: "600" }}>Reset ke Planned</Text>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onPress={() => setHeaderDialogOpen(true)}
            >
              <Settings size={14} color={colors.foreground} />
              <Text style={{ fontSize: 12, fontWeight: "600" }}>Kop & Logo PDF</Text>
            </Button>

            <Button
              size="sm"
              onPress={handleDownloadPdf}
              disabled={pdfBusy}
            >
              <Printer size={14} color="#fff" />
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#fff" }}>
                {pdfBusy ? "Membuat PDF..." : "Cetak PDF Resmi"}
              </Text>
            </Button>
          </View>
        </View>
      </Panel>

      {/* ─── Minutes of Meeting (MoM) & Hasil Diskusi ─── */}
      <Panel
        title="Minutes of Meeting (MoM) & Hasil Diskusi"
        subtitle="Dokumentasi ringkasan pembahasan, kebutuhan klien, masukan, dan keputusan rapat"
        right={
          <Button
            size="sm"
            variant="outline"
            onPress={() => {
              setSummary(row.summary || "");
              setClientNeeds(row.clientNeeds || "");
              setProductsIntroduced(row.productsIntroduced || "");
              setClientFeedback(row.clientFeedback || "");
              setAgreements(row.agreements || "");
              setPotentialOpportunities(row.potentialOpportunities || "");
              setObstacles(row.obstacles || "");
              setConclusion(row.conclusion || "");
              setMomDialogOpen(true);
            }}
            className="gap-1"
          >
            <Edit3 size={14} color={colors.text} />
            <Text className="text-xs font-medium">Edit / Lengkapi MoM</Text>
          </Button>
        }
      >
        <View className="gap-3">
          <View className="p-3 bg-card/40 rounded-lg border border-border">
            <Text className="text-xs text-muted-foreground font-semibold">RINGKASAN PEMBAHASAN</Text>
            <Text className="text-sm mt-1 whitespace-pre-line">
              {row.summary || "Belum ada ringkasan pembahasan yang dicatat."}
            </Text>
          </View>

          <View className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <View className="p-3 bg-card/40 rounded-lg border border-border">
              <Text className="text-xs text-muted-foreground font-semibold">KEBUTUHAN / PERMASALAHAN KLIEN</Text>
              <Text className="text-sm font-medium mt-1 whitespace-pre-line">{row.clientNeeds || "-"}</Text>
            </View>
            <View className="p-3 bg-card/40 rounded-lg border border-border">
              <Text className="text-xs text-muted-foreground font-semibold">PRODUK / SOLUSI YANG DIPERKENALKAN</Text>
              <Text className="text-sm font-medium mt-1 whitespace-pre-line">{row.productsIntroduced || "-"}</Text>
            </View>
          </View>

          <View className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <View className="p-3 bg-card/40 rounded-lg border border-border">
              <Text className="text-xs text-muted-foreground font-semibold">KESEPAKATAN & KEPUTUSAN</Text>
              <Text className="text-sm font-medium mt-1 whitespace-pre-line">{row.agreements || "-"}</Text>
            </View>
            <View className="p-3 bg-card/40 rounded-lg border border-border">
              <Text className="text-xs text-muted-foreground font-semibold">POTENSI PELUANG BISNIS</Text>
              <Text className="text-sm font-medium mt-1 whitespace-pre-line">{row.potentialOpportunities || "-"}</Text>
            </View>
          </View>

          <View className="p-3 bg-card/40 rounded-lg border border-border">
            <Text className="text-xs text-muted-foreground font-semibold">TANGGAPAN / MASUKAN KLIEN</Text>
            <Text className="text-sm mt-1 whitespace-pre-line">{row.clientFeedback || "-"}</Text>
          </View>

          <View className="p-3 bg-card/40 rounded-lg border border-border">
            <Text className="text-xs text-muted-foreground font-semibold">KENDALA / HAL YANG PERLU DIKLARIFIKASI</Text>
            <Text className="text-sm mt-1 whitespace-pre-line">{row.obstacles || "-"}</Text>
          </View>

          <View className="p-3 bg-card/40 rounded-lg border border-border">
            <Text className="text-xs text-muted-foreground font-semibold">KESIMPULAN AKHIR</Text>
            <Text className="text-sm mt-1 whitespace-pre-line">{row.conclusion || "-"}</Text>
          </View>
        </View>
      </Panel>

      {/* ─── Tindak Lanjut (Action Items) ─── */}
      <Panel
        title={`Rencana Tindak Lanjut (${completedActions}/${actions.length} Selesai)`}
        subtitle="Daftar pekerjaan lanjutan hasil pertemuan beserta penanggung jawab dan tenggat waktu"
        right={
          <Button
            size="sm"
            variant="outline"
            onPress={() => setAddActionOpen(true)}
            className="gap-1"
          >
            <Plus size={14} color={colors.text} />
            <Text className="text-xs font-medium">Tambah Tindak Lanjut</Text>
          </Button>
        }
      >
        {actions.length === 0 ? (
          <View className="py-6 items-center">
            <CheckSquare size={32} color={colors.muted} />
            <Text className="text-muted-foreground text-xs mt-2">
              Belum ada tindak lanjut. Klik &quot;Tambah Tindak Lanjut&quot; untuk memantau eksekusi hasil meeting.
            </Text>
          </View>
        ) : (
          <View className="gap-2">
            {actions.map((item, idx) => {
              const isDone = item.status === "Done";
              return (
                <View
                  key={item.id || idx}
                  className="flex-row flex-wrap items-center justify-between gap-2.5 p-3 rounded-lg border border-border bg-card/40"
                >
                  <View className="flex-1 min-w-[200px] pr-2">
                    <View className="flex-row items-center gap-2 flex-wrap">
                      <Text
                        className={`text-sm ${
                          isDone ? "line-through text-muted-foreground" : "font-medium"
                        }`}
                      >
                        {item.task}
                      </Text>
                      <StatusBadge status={item.status} />
                    </View>
                    {item.dueDate || item.notes ? (
                      <Text className="text-xs text-muted-foreground mt-0.5">
                        {[
                          item.dueDate ? `Target: ${tanggal(item.dueDate)}` : null,
                          item.notes ? `Catatan: ${item.notes}` : null,
                        ]
                          .filter(Boolean)
                          .join(" • ")}
                      </Text>
                    ) : null}
                  </View>

                  <View className="flex-row items-center gap-1.5">
                    <View className="flex-row items-center rounded-lg border border-border bg-muted/30 p-0.5">
                      {(["Open", "In Progress", "Done"] as const).map((st) => {
                        const active = item.status === st;
                        return (
                          <Pressable
                            key={st}
                            onPress={() => handleChangeActionStatus(item, st)}
                            className={`px-2.5 py-1 rounded-md ${
                              active ? "bg-primary" : "hover:bg-card"
                            }`}
                          >
                            <Text
                              className={`text-[11px] ${
                                active ? "font-semibold text-primary-foreground" : "text-muted-foreground"
                              }`}
                            >
                              {st}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <Pressable
                      onPress={() => handleDeleteAction(item.id)}
                      className="p-1.5 opacity-60 hover:opacity-100"
                    >
                      <Trash2 size={15} color={colors.danger} />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Panel>

      {/* ─── Biaya & Pengeluaran Kunjungan (Reimbursement) ─── */}
      <Panel
        title="Biaya & Pengeluaran Kunjungan"
        subtitle="Pencatatan dana perusahaan serta klaim reimbursement dana talangan pribadi karyawan"
        right={
          <Button
            size="sm"
            onPress={() => {
              router.push({
                pathname: "/expenses/new",
                params: {
                  visitReportId: String(row.id),
                  visitId: String(row.id),
                  visit: `VISIT ${row.nomor} - ${row.judul}`,
                  projectId: row.projectId ? String(row.projectId) : undefined,
                },
              } as any);
            }}
            className="gap-1.5"
          >
            <Plus size={14} color={colors.background} />
            <Text className="text-xs font-semibold">Catat Biaya Kunjungan</Text>
          </Button>
        }
      >
        <View className="gap-4">
          <View className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <View className="p-3 rounded-lg bg-card/60 border border-border">
              <Text className="text-xs text-muted-foreground">Total Biaya Lapangan</Text>
              <Text className="text-base font-bold mt-1 text-primary">{rupiah(totalBiayaAktual)}</Text>
            </View>
            <View className="p-3 rounded-lg bg-card/60 border border-border">
              <Text className="text-xs text-muted-foreground">Dana Perusahaan</Text>
              <Text className="text-base font-bold mt-1">{rupiah(companyCost)}</Text>
            </View>
            <View className="p-3 rounded-lg bg-card/60 border border-border">
              <Text className="text-xs text-muted-foreground">Talangan Pribadi (Klaim)</Text>
              <Text className="text-base font-bold mt-1 text-amber-500">{rupiah(personalAdvanceCost)}</Text>
            </View>
          </View>

          {visitExpenses.length === 0 ? (
            <Text className="text-xs text-muted-foreground py-4 text-center">
              Belum ada biaya tercatat untuk aktivitas kunjungan ini.
            </Text>
          ) : (
            <View className="divide-y divide-border border border-border rounded-lg overflow-hidden">
              {visitExpenses.map((exp: Row) => {
                const isPersonal =
                  exp.fundingSource === "TALANGAN_PRIBADI" ||
                  exp.sumberDana?.includes("Talangan");
                return (
                  <View key={exp.id} className="p-3 flex-row items-center justify-between bg-card/30">
                    <View className="flex-1 pr-2">
                      <View className="flex-row items-center gap-2 flex-wrap">
                        <Text className="text-sm font-semibold">{exp.alasan || exp.description}</Text>
                        <StatusBadge status={exp.status} />
                        <View
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            isPersonal
                              ? "bg-amber-500/15 text-amber-500"
                              : "bg-blue-500/15 text-blue-500"
                          }`}
                        >
                          <Text className="text-[10px]">
                            {isPersonal ? "Talangan Pribadi" : "Dana Kantor"}
                          </Text>
                        </View>
                      </View>
                      <Text className="text-xs text-muted-foreground mt-1">
                        {tanggal(exp.tanggal || exp.date)} • Pelapor: {exp.pelapor || "Karyawan"} • Kategori: {exp.kategori || "-"}
                      </Text>
                    </View>
                    <Text className="text-sm font-bold">{rupiah(exp.nominal || exp.amount || 0)}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </Panel>

      {/* ─── Galeri Dokumentasi Foto ─── */}
      <DocumentationPhotosPanel
        kind="visit"
        entityId={Number(row.id)}
        title="Dokumentasi Foto Kunjungan & Meeting"
      />

      {/* ─── MoM Edit Dialog ─── */}
      <Dialog open={momDialogOpen} onOpenChange={setMomDialogOpen}>
        <DialogContent style={{ maxWidth: 820, width: "95%" }}>
          <DialogHeader>
            <DialogTitle>Lengkapi Minutes of Meeting (MoM)</DialogTitle>
          </DialogHeader>

          <ScrollView
            style={{ maxHeight: 520 }}
            contentContainerStyle={{ gap: 14, paddingVertical: 10, paddingHorizontal: 4 }}
            showsVerticalScrollIndicator={true}
          >
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: "600" }}>Ringkasan Pembahasan Rapat</Text>
              <Textarea
                value={summary}
                onChangeText={setSummary}
                placeholder="Poin-poin utama diskusi, presentasi, dan materi yang dibahas..."
              />
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              <View style={{ flex: 1, minWidth: 280, gap: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: "600" }}>Kebutuhan & Masalah Klien</Text>
                <Textarea
                  value={clientNeeds}
                  onChangeText={setClientNeeds}
                  placeholder="Spesifikasi teknis, kendala sistem lama, problem yang ingin diselesaikan..."
                />
              </View>

              <View style={{ flex: 1, minWidth: 280, gap: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: "600" }}>Tanggapan & Pertanyaan Klien</Text>
                <Textarea
                  value={clientFeedback}
                  onChangeText={setClientFeedback}
                  placeholder="Feedback, keraguan teknis, pertanyaan lisensi, budget klien..."
                />
              </View>
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              <View style={{ flex: 1, minWidth: 280, gap: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: "600" }}>Produk & Solusi yang Ditawarkan</Text>
                <Input
                  value={productsIntroduced}
                  onChangeText={setProductsIntroduced}
                  placeholder="Contoh: UNV AI Camera, IP PBX Server, Managed Network Switch..."
                />
              </View>

              <View style={{ flex: 1, minWidth: 280, gap: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: "600" }}>Potensi Peluang Bisnis</Text>
                <Input
                  value={potentialOpportunities}
                  onChangeText={setPotentialOpportunities}
                  placeholder="Estimasi nilai proyek lanjutan, ekspansi cabang, atau repeat order..."
                />
              </View>
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              <View style={{ flex: 1, minWidth: 280, gap: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: "600" }}>Kesepakatan & Keputusan Meeting</Text>
                <Textarea
                  value={agreements}
                  onChangeText={setAgreements}
                  placeholder="Kesepakatan jadwal demo, estimasi pembuatan penawaran (Quotation)..."
                />
              </View>

              <View style={{ flex: 1, minWidth: 280, gap: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: "600" }}>Kendala / Hal Perlu Klarifikasi</Text>
                <Textarea
                  value={obstacles}
                  onChangeText={setObstacles}
                  placeholder="Hal yang belum terjawab atau membutuhkan konfirmasi prinsipal..."
                />
              </View>
            </View>

            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: "600" }}>Kesimpulan Pertemuan</Text>
              <Textarea
                value={conclusion}
                onChangeText={setConclusion}
                placeholder="Kesimpulan akhir dari kunjungan atau meeting..."
              />
            </View>
          </ScrollView>

          <DialogFooter>
            <Button variant="outline" onPress={() => setMomDialogOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSaveMoM}>
              <Text style={{ color: "#fff" }}>Simpan MoM</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Action Item Dialog ─── */}
      <Dialog open={addActionOpen} onOpenChange={setAddActionOpen}>
        <DialogContent style={{ maxWidth: 460 }}>
          <DialogHeader>
            <DialogTitle>Tambah Tindak Lanjut Meeting</DialogTitle>
          </DialogHeader>

          <View style={{ gap: 12, paddingVertical: 10 }}>
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: "600" }}>Deskripsi Tugas *</Text>
              <Textarea
                value={newActionTask}
                onChangeText={setNewActionTask}
                placeholder="Contoh: Kirim Quotation 16 Titik CCTV ke PIC Klien"
              />
            </View>

            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: "600" }}>Penanggung Jawab (Assignee)</Text>
              <SearchableSelect
                value={newActionAssignee}
                onChange={setNewActionAssignee}
                options={userOptions}
                placeholder="Pilih staf penanggung jawab"
              />
            </View>

            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: "600" }}>Target Penyelesaian (Due Date)</Text>
              <DatePicker
                value={newActionDueDate}
                onChange={setNewActionDueDate}
                placeholder="Pilih target tanggal"
              />
            </View>

            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: "600" }}>Catatan Tambahan</Text>
              <Input
                value={newActionNotes}
                onChangeText={setNewActionNotes}
                placeholder="Catatan pendukung tugas..."
              />
            </View>
          </View>

          <DialogFooter>
            <Button variant="outline" onPress={() => setAddActionOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleAddAction}>
              <Text style={{ color: "#fff" }}>Simpan Tugas</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Kop Surat & Logo Dialog ─── */}
      <Dialog open={headerDialogOpen} onOpenChange={setHeaderDialogOpen}>
        <DialogContent style={{ maxWidth: 440 }}>
          <DialogHeader>
            <DialogTitle>Pengaturan Kop & Logo Cetak PDF</DialogTitle>
          </DialogHeader>

          <View style={{ gap: 12, paddingVertical: 10 }}>
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: "600" }}>Nama Perusahaan / Kop Surat</Text>
              <Input
                value={companyHeader}
                onChangeText={setCompanyHeader}
                placeholder="Default: PT GHINA MULTI PRIMA (Dapat diubah)"
              />
              <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                Ubah jika aktivitas kunjungan mewakili brand atau entitas kemitraan lain.
              </Text>
            </View>

            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: "600" }}>Upload Logo Khusus (Opsional)</Text>
              <FileUploader
                label="Unggah File Logo (PNG/JPEG)"
                kind="foto"
                category="visit-logo"
                handleRef={(h) => {
                  logoUploaderRef.current = h;
                }}
              />
            </View>
          </View>

          <DialogFooter>
            <Button variant="outline" onPress={() => setHeaderDialogOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSaveHeader}>
              <Text style={{ color: "#fff" }}>Simpan Pengaturan</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  );
}

