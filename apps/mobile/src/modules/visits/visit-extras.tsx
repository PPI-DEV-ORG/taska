import * as React from "react";
import { View, Pressable, ScrollView } from "react-native";
import {
  Printer,
  Plus,
  Edit3,
  CheckCircle2,
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

  async function handleToggleActionStatus(item: ActionItem) {
    const nextStatus = item.status === "Done" ? "Open" : item.status === "Open" ? "In Progress" : "Done";
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
      >
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            <Button
              variant="outline"
              size="sm"
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
            >
              <Edit3 size={14} color={colors.foreground} />
              <Text style={{ fontSize: 12, fontWeight: "600" }}>Edit / Lengkapi MoM</Text>
            </Button>
          </View>

          <View style={{ gap: 10 }}>
            <View style={{ backgroundColor: colors.muted + "20", padding: 12, borderRadius: 8, gap: 4 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase" }}>
                Ringkasan Pembahasan
              </Text>
              <Text style={{ fontSize: 13, color: colors.foreground, lineHeight: 18 }}>
                {row.summary || "Belum ada ringkasan pembahasan yang dicatat."}
              </Text>
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              <View style={{ flex: 1, minWidth: 260, backgroundColor: colors.muted + "15", padding: 12, borderRadius: 8, gap: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase" }}>
                  Kebutuhan / Permasalahan Klien
                </Text>
                <Text style={{ fontSize: 13, color: colors.foreground }}>
                  {row.clientNeeds || "-"}
                </Text>
              </View>

              <View style={{ flex: 1, minWidth: 260, backgroundColor: colors.muted + "15", padding: 12, borderRadius: 8, gap: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase" }}>
                  Produk / Solusi yang Diperkenalkan
                </Text>
                <Text style={{ fontSize: 13, color: colors.foreground }}>
                  {row.productsIntroduced || "-"}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              <View style={{ flex: 1, minWidth: 260, backgroundColor: colors.muted + "15", padding: 12, borderRadius: 8, gap: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase" }}>
                  Kesepakatan & Keputusan
                </Text>
                <Text style={{ fontSize: 13, color: colors.foreground }}>
                  {row.agreements || "-"}
                </Text>
              </View>

              <View style={{ flex: 1, minWidth: 260, backgroundColor: colors.muted + "15", padding: 12, borderRadius: 8, gap: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase" }}>
                  Potensi Peluang Bisnis
                </Text>
                <Text style={{ fontSize: 13, color: colors.foreground }}>
                  {row.potentialOpportunities || "-"}
                </Text>
              </View>
            </View>

            {Boolean(row.obstacles || row.conclusion || row.clientFeedback) ? (
              <View style={{ backgroundColor: colors.muted + "10", padding: 12, borderRadius: 8, gap: 8 }}>
                {row.clientFeedback ? (
                  <View style={{ gap: 2 }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground }}>TANGGAPAN / MASUKAN KLIEN:</Text>
                    <Text style={{ fontSize: 12, color: colors.foreground }}>{row.clientFeedback}</Text>
                  </View>
                ) : null}
                {row.obstacles ? (
                  <View style={{ gap: 2 }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#b45309" }}>KENDALA / HAL YANG PERLU DIKLARIFIKASI:</Text>
                    <Text style={{ fontSize: 12, color: colors.foreground }}>{row.obstacles}</Text>
                  </View>
                ) : null}
                {row.conclusion ? (
                  <View style={{ gap: 2 }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#15803d" }}>KESIMPULAN AKHIR:</Text>
                    <Text style={{ fontSize: 12, color: colors.foreground }}>{row.conclusion}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      </Panel>

      {/* ─── Tindak Lanjut (Action Items) ─── */}
      <Panel
        title={`Rencana Tindak Lanjut (${completedActions}/${actions.length} Selesai)`}
        subtitle="Daftar pekerjaan lanjutan hasil pertemuan beserta penanggung jawab dan tenggat waktu"
      >
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            <Button
              variant="outline"
              size="sm"
              onPress={() => setAddActionOpen(true)}
            >
              <Plus size={14} color={colors.foreground} />
              <Text style={{ fontSize: 12, fontWeight: "600" }}>Tambah Tindak Lanjut</Text>
            </Button>
          </View>

          {actions.length === 0 ? (
            <View style={{ padding: 20, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
                Belum ada tindak lanjut. Tambahkan pekerjaan lanjutan untuk memantau eksekusi hasil meeting.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {actions.map((item, idx) => {
                const isDone = item.status === "Done";
                const isProg = item.status === "In Progress";
                return (
                  <View
                    key={item.id || idx}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: 12,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: isDone ? "#86efac" : colors.border,
                      backgroundColor: isDone ? "#f0fdf4" : colors.card,
                      gap: 12,
                    }}
                  >
                    <Pressable
                      onPress={() => handleToggleActionStatus(item)}
                      style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 10 }}
                    >
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 6,
                          backgroundColor: isDone ? "#dcfce7" : isProg ? "#fef9c3" : "#f1f5f9",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: isDone ? "#166534" : isProg ? "#854d0e" : "#475569",
                          }}
                        >
                          {item.status}
                        </Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "600",
                            color: isDone ? colors.mutedForeground : colors.foreground,
                            textDecorationLine: isDone ? "line-through" : "none",
                          }}
                        >
                          {item.task}
                        </Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
                          {item.dueDate ? (
                            <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                              Target: {tanggal(item.dueDate)}
                            </Text>
                          ) : null}
                          {item.notes ? (
                            <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                              Catatan: {item.notes}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </Pressable>

                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={() => handleDeleteAction(item.id)}
                    >
                      <Trash2 size={14} color="#dc2626" />
                    </Button>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </Panel>

      {/* ─── Biaya & Pengeluaran Kunjungan (Reimbursement) ─── */}
      <Panel
        title="Biaya & Pengeluaran Kunjungan"
        subtitle="Pencatatan dana perusahaan serta klaim reimbursement dana talangan pribadi karyawan"
      >
        <View style={{ gap: 14 }}>
          {/* Summary Cards */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <View style={{ flex: 1, minWidth: 140, backgroundColor: colors.muted + "20", padding: 12, borderRadius: 8 }}>
              <Text style={{ fontSize: 11, color: colors.mutedForeground }}>Total Biaya Lapangan</Text>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground, marginTop: 4 }}>
                {rupiah(totalBiayaAktual)}
              </Text>
            </View>

            <View style={{ flex: 1, minWidth: 140, backgroundColor: "#eff6ff", padding: 12, borderRadius: 8 }}>
              <Text style={{ fontSize: 11, color: "#1e40af" }}>Dana Perusahaan</Text>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#1e3a8a", marginTop: 4 }}>
                {rupiah(companyCost)}
              </Text>
            </View>

            <View style={{ flex: 1, minWidth: 140, backgroundColor: "#fff7ed", padding: 12, borderRadius: 8 }}>
              <Text style={{ fontSize: 11, color: "#c2410c" }}>Talangan Pribadi (Reimburse)</Text>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#9a3412", marginTop: 4 }}>
                {rupiah(personalAdvanceCost)}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
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
                });
              }}
            >
              <Plus size={14} color="#fff" />
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#fff" }}>
                + Catat Biaya Kunjungan
              </Text>
            </Button>
          </View>

          {/* Expenses List */}
          {visitExpenses.length === 0 ? (
            <Text style={{ fontSize: 12, color: colors.mutedForeground, fontStyle: "italic", textAlign: "center", paddingVertical: 10 }}>
              Belum ada biaya tercatat untuk aktivitas kunjungan ini.
            </Text>
          ) : (
            <View style={{ gap: 8 }}>
              {visitExpenses.map((exp: Row) => {
                const isPersonal =
                  exp.fundingSource === "TALANGAN_PRIBADI" ||
                  exp.sumberDana?.includes("Talangan");
                return (
                  <View
                    key={exp.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: 10,
                      borderRadius: 6,
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <View style={{ gap: 2, flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: "600" }}>{exp.alasan || exp.description}</Text>
                      <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                        {exp.kategori} · {tanggal(exp.tanggal)} · Oleh: {exp.pelapor}
                      </Text>
                      <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
                        <View
                          style={{
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 4,
                            backgroundColor: isPersonal ? "#ffedd5" : "#dbeafe",
                          }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: "600", color: isPersonal ? "#9a3412" : "#1e40af" }}>
                            {isPersonal ? "Talangan Pribadi" : "Dana Kantor"}
                          </Text>
                        </View>
                        {isPersonal && exp.reimbursementStatus ? (
                          <View
                            style={{
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 4,
                              backgroundColor: "#f1f5f9",
                            }}
                          >
                            <Text style={{ fontSize: 10, color: "#475569" }}>
                              Reimburse: {exp.reimbursementStatus}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <Text style={{ fontSize: 13, fontWeight: "700" }}>
                        {rupiah(Number(exp.nominal) || 0)}
                      </Text>
                      <StatusBadge status={exp.status} />
                    </View>
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

