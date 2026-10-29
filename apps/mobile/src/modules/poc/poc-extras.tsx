import * as React from "react";
import { View, Pressable } from "react-native";
import {
  Printer,
  Plus,
  Edit3,
  CheckCircle2,
  Circle,
  Trash2,
  CheckSquare,
  Settings,
  AlertTriangle,
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
import { FollowUpPanel } from "@/modules/shared/follow-up-panel";
import { useRouter } from "expo-router";

type ChecklistItem = {
  id: number;
  pocReportId: number;
  title: string;
  isDone: boolean;
  dueDate?: string | null;
  assigneeId?: number | null;
  notes?: string | null;
};

export function PocExtras({ row, onRefresh }: { row: Row; onRefresh?: () => void }) {
  const router = useRouter();
  const { data, user, toast, patchRow, setStatus, refreshModule } = useApp();

  const [pdfBusy, setPdfBusy] = React.useState(false);
  const [checklist, setChecklist] = React.useState<ChecklistItem[]>(() =>
    Array.isArray(row.checklists) ? row.checklists : []
  );

  // Checklist dialog
  const [addChecklistOpen, setAddChecklistOpen] = React.useState(false);
  const [newChecklistTitle, setNewChecklistTitle] = React.useState("");
  const [newChecklistNotes, setNewChecklistNotes] = React.useState("");
  const [newChecklistDate, setNewChecklistDate] = React.useState("");
  const [newChecklistAssignee, setNewChecklistAssignee] = React.useState("");

  const userOptions = React.useMemo(() => {
    return ["-", ...(data.users ?? []).map((u: Row) => String(u.nama || u.name))];
  }, [data.users]);

  const overlappingPocs = React.useMemo(() => {
    const myStart = String(row.mulai || row.startDate || "").slice(0, 10);
    const myEnd = String(row.selesai || row.endDate || myStart).slice(0, 10);
    if (!myStart) return [];
    return (data["poc-reports"] ?? []).filter((p: Row) => {
      if (String(p.id) === String(row.id)) return false;
      if (["Cancelled", "Failed", "Completed"].includes(String(p.status))) return false;
      const sameOwner =
        (row.ownerId && p.ownerId && String(row.ownerId) === String(p.ownerId)) ||
        (row.pemilik && p.pemilik && row.pemilik !== "-" && String(row.pemilik) === String(p.pemilik));
      if (!sameOwner) return false;
      const pStart = String(p.mulai || p.startDate || "").slice(0, 10);
      const pEnd = String(p.selesai || p.endDate || pStart).slice(0, 10);
      if (!pStart) return false;
      return myStart <= pEnd && myEnd >= pStart;
    });
  }, [data, row.id, row.mulai, row.startDate, row.selesai, row.endDate, row.ownerId, row.pemilik]);

  // Result & Evaluation dialog
  const [resultDialogOpen, setResultDialogOpen] = React.useState(false);
  const [execDate, setExecDate] = React.useState(row.actualExecutionDate || "");
  const [attendees, setAttendees] = React.useState(row.actualAttendees || "");
  const [activities, setActivities] = React.useState(row.activitiesDone || "");
  const [testResults, setTestResults] = React.useState(row.testResults || "");
  const [issues, setIssues] = React.useState(row.issuesFound || "");
  const [followUp, setFollowUp] = React.useState(row.followUpNeeded || "");
  const [conclusion, setConclusion] = React.useState(row.conclusion || "");
  const [recommendations, setRecommendations] = React.useState(row.recommendations || "");
  const [resultStatus, setResultStatus] = React.useState(row.resultStatus || "Pending Evaluation");

  // Header & Logo customization dialog
  const [headerDialogOpen, setHeaderDialogOpen] = React.useState(false);
  const [companyHeader, setCompanyHeader] = React.useState(row.companyHeader || "");
  const logoUploaderRef = React.useRef<FileUploaderHandle | null>(null);

  const reloadChecklist = React.useCallback(async () => {
    try {
      const res = await api<any>("GET", `/poc-reports/${row.id}`);
      if (Array.isArray(res?.checklists)) {
        setChecklist(res.checklists);
      }
    } catch {}
  }, [row.id]);

  React.useEffect(() => {
    let active = true;
    api<any>("GET", `/poc-reports/${row.id}`)
      .then((res) => {
        if (active && Array.isArray(res?.checklists)) {
          setChecklist(res.checklists);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [row.id]);

  // Expenses for this POC
  const pocExpenses = React.useMemo(() => {
    return (data.expenses ?? []).filter((e: Row) => {
      if (e.pocReportId && String(e.pocReportId) === String(row.id)) return true;
      if (e.pocReport && (String(e.pocReport).includes(row.nomor) || String(e.pocReport).includes(row.judul))) return true;
      return false;
    });
  }, [data.expenses, row.id, row.nomor, row.judul]);

  const validExpenses = React.useMemo(() => {
    return pocExpenses.filter((e) => e.status !== "Ditolak" && e.status !== "REJECTED");
  }, [pocExpenses]);

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

  const completedChecklistCount = checklist.filter((c) => c.isDone).length;
  const checklistPct = checklist.length > 0 ? Math.round((completedChecklistCount / checklist.length) * 100) : 0;

  async function handleToggleChecklist(item: ChecklistItem) {
    const nextState = !item.isDone;
    setChecklist((prev) =>
      prev.map((c) => (c.id === item.id ? { ...c, isDone: nextState } : c))
    );
    try {
      await api("POST", `/poc-reports/${row.id}/checklists/${item.id}/toggle`, { isDone: nextState });
      toast(nextState ? `"${item.title}" ditandai selesai` : `"${item.title}" ditandai belum selesai`);
    } catch {
      toast("Gagal mengubah status checklist", "danger");
      reloadChecklist();
    }
  }

  async function handleAddChecklist() {
    if (!newChecklistTitle.trim()) {
      toast("Judul persiapan checklist wajib diisi", "danger");
      return;
    }
    try {
      const assigneeUser = (data.users ?? []).find(
        (u: Row) => String(u.nama || u.name) === newChecklistAssignee
      );
      await api("POST", `/poc-reports/${row.id}/checklists`, {
        title: newChecklistTitle.trim(),
        notes: newChecklistNotes.trim() || undefined,
        dueDate: newChecklistDate || undefined,
        assigneeId: assigneeUser?.id ? Number(assigneeUser.id) : undefined,
      });
      toast("Item persiapan checklist berhasil ditambahkan");
      setNewChecklistTitle("");
      setNewChecklistNotes("");
      setNewChecklistDate("");
      setNewChecklistAssignee("");
      setAddChecklistOpen(false);
      reloadChecklist();
    } catch {
      toast("Gagal menambahkan checklist", "danger");
    }
  }

  async function handleDeleteChecklist(cid: number) {
    try {
      await api("DELETE", `/poc-reports/${row.id}/checklists/${cid}`);
      setChecklist((prev) => prev.filter((c) => c.id !== cid));
      toast("Item checklist dihapus");
    } catch {
      toast("Gagal menghapus item checklist", "danger");
    }
  }

  async function handleSaveResultReport() {
    try {
      await api("PATCH", `/poc-reports/${row.id}`, {
        actualExecutionDate: execDate || undefined,
        actualAttendees: attendees.trim() || undefined,
        activitiesDone: activities.trim() || undefined,
        testResults: testResults.trim() || undefined,
        issuesFound: issues.trim() || undefined,
        followUpNeeded: followUp.trim() || undefined,
        conclusion: conclusion.trim() || undefined,
        recommendations: recommendations.trim() || undefined,
        resultStatus,
      });

      patchRow("poc-reports", row.id, {
        actualExecutionDate: execDate,
        actualAttendees: attendees,
        activitiesDone: activities,
        testResults: testResults,
        issuesFound: issues,
        followUpNeeded: followUp,
        conclusion: conclusion,
        recommendations: recommendations,
        resultStatus,
        hasilStatus: resultStatus,
      });

      setResultDialogOpen(false);
      toast("Hasil evaluasi POC berhasil disimpan");
      if (onRefresh) onRefresh();
    } catch {
      toast("Gagal menyimpan hasil evaluasi", "danger");
    }
  }

  async function handleSaveHeaderCustomization() {
    let logoFileId = row.logoFileId;
    if (logoUploaderRef.current?.hasStaged()) {
      try {
        logoFileId = await logoUploaderRef.current.flush();
      } catch {}
    }

    try {
      await api("PATCH", `/poc-reports/${row.id}`, {
        companyHeader: companyHeader.trim() || undefined,
        logoFileId: logoFileId ? Number(logoFileId) : undefined,
      });

      patchRow("poc-reports", row.id, {
        companyHeader: companyHeader.trim(),
        logoFileId,
      });

      setHeaderDialogOpen(false);
      toast("Kustomisasi header laporan berhasil disimpan");
      if (onRefresh) onRefresh();
    } catch {
      toast("Gagal menyimpan kustomisasi header", "danger");
    }
  }

  async function handlePrintPdf() {
    setPdfBusy(true);
    try {
      const ok = await downloadDocumentationPdf("poc", row.id);
      if (!ok) {
        toast("Gagal mengunduh dokumen laporan POC", "danger");
      }
    } finally {
      setPdfBusy(false);
    }
  }

  async function handleQuickStatus(nextStatus: string) {
    await setStatus("poc-reports", row.id, nextStatus, `Alur status diubah ke ${nextStatus}`);
    patchRow("poc-reports", row.id, { status: nextStatus });
    if (onRefresh) onRefresh();
  }

  return (
    <View className="gap-6 mt-4">
      {overlappingPocs.length > 0 ? (
        <View className="bg-warning/15 border-warning/40 flex-row items-center gap-2 rounded-xl border p-3">
          <AlertTriangle size={16} color={colors.warning} />
          <Text className="text-warning flex-1 text-xs">
            Perhatian: Jadwal POC ini beririsan dengan {overlappingPocs.length} POC aktif lain milik PIC {row.pemilik} ({overlappingPocs.map((p: Row) => p.nomor || p.judul).join(", ")}).
          </Text>
        </View>
      ) : null}

      {/* ── Action & Status Banner ── */}
      <Panel>
        <View className="flex-row flex-wrap items-center justify-between gap-3">
          <View className="flex-row items-center gap-2 flex-wrap">
            <Text className="text-sm font-semibold">Status Alur:</Text>
            <StatusBadge status={row.status || "Draft"} />
            <Text className="text-sm font-semibold ml-2">Hasil Uji:</Text>
            <StatusBadge status={row.hasilStatus || row.resultStatus || "Pending Evaluation"} />
          </View>

          <View className="flex-row items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onPress={() => setHeaderDialogOpen(true)}
              className="gap-1.5"
            >
              <Settings size={15} color={colors.text} />
              <Text className="text-xs">Header & Logo PDF</Text>
            </Button>

            <Button
              size="sm"
              onPress={handlePrintPdf}
              disabled={pdfBusy}
              className="gap-1.5"
            >
              <Printer size={15} color={colors.background} />
              <Text className="text-xs font-semibold">
                {pdfBusy ? "Menyiapkan PDF..." : "Cetak Laporan Resmi (PDF)"}
              </Text>
            </Button>
          </View>
        </View>

        {/* Progression Status Flow */}
        <View className="mt-4 pt-3 border-t border-border flex-row items-center gap-1.5 flex-wrap">
          <Text className="text-xs text-muted-foreground mr-1">Alur Status:</Text>
          {["Draft", "Planned", "Preparation", "Ready", "In Progress", "Completed"].map((st, idx, arr) => {
            const isCurrent = (row.status || "Draft").toLowerCase() === st.toLowerCase();
            return (
              <React.Fragment key={st}>
                <View
                  className={`px-2.5 py-1 rounded-full border ${
                    isCurrent
                      ? "bg-primary/15 border-primary"
                      : "bg-muted/20 border-border"
                  }`}
                >
                  <Text
                    className={`text-xs ${
                      isCurrent
                        ? "font-semibold text-primary"
                        : "text-muted-foreground"
                    }`}
                  >
                    {st}
                  </Text>
                </View>
                {idx < arr.length - 1 ? (
                  <Text className="text-[11px] text-muted-foreground/60">→</Text>
                ) : null}
              </React.Fragment>
            );
          })}
        </View>
      </Panel>

      {/* ── Persiapan & Checklist POC (Phase 1) ── */}
      <Panel
        title={`Checklist Persiapan POC (${completedChecklistCount}/${checklist.length} Selesai - ${checklistPct}%)`}
        subtitle="Periksa kesiapan perangkat demo, materi presentasi, logistik, dan koordinasi"
        right={
          <Button
            size="sm"
            variant="outline"
            onPress={() => setAddChecklistOpen(true)}
            className="gap-1"
          >
            <Plus size={14} color={colors.text} />
            <Text className="text-xs font-medium">Tambah Checklist</Text>
          </Button>
        }
      >
        {checklist.length === 0 ? (
          <View className="py-6 items-center">
            <CheckSquare size={32} color={colors.muted} />
            <Text className="text-muted-foreground text-xs mt-2">
              Belum ada checklist persiapan. Klik &quot;Tambah Checklist&quot; untuk menyusun daftar persiapan.
            </Text>
          </View>
        ) : (
          <View className="gap-2">
            {checklist.map((item) => (
              <View
                key={item.id}
                className="flex-row items-center justify-between p-2.5 rounded-lg border border-border bg-card/40"
              >
                <Pressable
                  className="flex-row items-center gap-2.5 flex-1 pr-2"
                  onPress={() => handleToggleChecklist(item)}
                >
                  {item.isDone ? (
                    <CheckCircle2 size={18} color={colors.primary} />
                  ) : (
                    <Circle size={18} color={colors.muted} />
                  )}
                  <View className="flex-1">
                    <Text
                      className={`text-sm ${
                        item.isDone ? "line-through text-muted-foreground" : "font-medium"
                      }`}
                    >
                      {item.title}
                    </Text>
                    {item.assigneeId || item.dueDate || item.notes ? (
                      <Text className="text-xs text-muted-foreground mt-0.5">
                        {[
                          item.assigneeId
                            ? `PIC: ${(data.users ?? []).find((u: Row) => Number(u.id) === Number(item.assigneeId))?.nama || `#${item.assigneeId}`}`
                            : null,
                          item.dueDate ? `Target: ${tanggal(item.dueDate)}` : null,
                          item.notes ? item.notes : null,
                        ]
                          .filter(Boolean)
                          .join(" • ")}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => handleDeleteChecklist(item.id)}
                  className="p-1.5 opacity-60 hover:opacity-100"
                >
                  <Trash2 size={15} color={colors.danger} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </Panel>

      {/* ── Laporan Eksekusi & Evaluasi POC ── */}
      <Panel
        title="Hasil Eksekusi & Evaluasi POC"
        subtitle="Catat hasil pengujian teknis, temuan kendala, dan rekomendasi tindak lanjut"
        right={
          <Button
            size="sm"
            variant="outline"
            onPress={() => setResultDialogOpen(true)}
            className="gap-1"
          >
            <Edit3 size={14} color={colors.text} />
            <Text className="text-xs font-medium">Input Hasil & Evaluasi</Text>
          </Button>
        }
      >
        <View className="gap-3">
          <View className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <View className="p-3 bg-card/40 rounded-lg border border-border">
              <Text className="text-xs text-muted-foreground font-semibold">TANGGAL EKSEKUSI AKTUAL</Text>
              <Text className="text-sm font-medium mt-1">
                {row.actualExecutionDate ? tanggal(row.actualExecutionDate) : "-"}
              </Text>
            </View>
            <View className="p-3 bg-card/40 rounded-lg border border-border">
              <Text className="text-xs text-muted-foreground font-semibold">PESERTA / AUDIENS HADIR</Text>
              <Text className="text-sm font-medium mt-1">{row.actualAttendees || "-"}</Text>
            </View>
          </View>

          <View className="p-3 bg-card/40 rounded-lg border border-border">
            <Text className="text-xs text-muted-foreground font-semibold">AKTIVITAS YANG DILAKUKAN</Text>
            <Text className="text-sm mt-1 whitespace-pre-line">{row.activitiesDone || "-"}</Text>
          </View>

          <View className="p-3 bg-card/40 rounded-lg border border-border">
            <Text className="text-xs text-muted-foreground font-semibold">HASIL PENGUJIAN TEKNIS</Text>
            <Text className="text-sm mt-1 whitespace-pre-line">{row.testResults || "Belum ada catatan hasil uji."}</Text>
          </View>

          <View className="p-3 bg-card/40 rounded-lg border border-border">
            <Text className="text-xs text-muted-foreground font-semibold">KENDALA / TEMUAN DI LAPANGAN</Text>
            <Text className="text-sm mt-1 whitespace-pre-line">{row.issuesFound || "-"}</Text>
          </View>

          <View className="p-3 bg-card/40 rounded-lg border border-border">
            <Text className="text-xs text-muted-foreground font-semibold">TINDAK LANJUT YANG DIPERLUKAN</Text>
            <Text className="text-sm mt-1 whitespace-pre-line">{row.followUpNeeded || "-"}</Text>
          </View>

          <View className="p-3 bg-card/40 rounded-lg border border-border">
            <Text className="text-xs text-muted-foreground font-semibold">KESIMPULAN & REKOMENDASI</Text>
            <Text className="text-sm mt-1 whitespace-pre-line">
              {row.conclusion || row.recommendations
                ? `${row.conclusion || ""}${row.conclusion && row.recommendations ? "\n" : ""}${row.recommendations ? `Rekomendasi: ${row.recommendations}` : ""}`
                : "-"}
            </Text>
          </View>
        </View>
      </Panel>

      {/* ── Riwayat Follow-up & Event Mendatang (Sinkron Kalender) ── */}
      <FollowUpPanel
        moduleKey="poc-reports"
        entityId={row.id}
        initialFollowUps={row._followUps}
        subtitle="Catat aktivitas komunikasi & jadwal follow-up lanjutan hasil POC / Expo. Jadwal berikutnya otomatis tampil di Kalender."
        onUpdated={onRefresh}
      />

      {/* ── Biaya Operasional & Reimbursement (Phase 2 - Section H) ── */}
      <Panel
        title="Biaya Operasional & Reimbursement POC"
        subtitle="Tracking pengeluaran terhubung, pemisahan dana perusahaan vs talangan pribadi"
        right={
          <Button
            size="sm"
            onPress={() =>
              router.push({
                pathname: "/expenses/new",
                params: {
                  pocId: String(row.id),
                  poc: `POC ${row.nomor} - ${row.judul}`,
                  projectId: row.projectId ? String(row.projectId) : undefined,
                  project: row.project && row.project !== "-" ? String(row.project) : undefined,
                },
              } as any)
            }
            className="gap-1.5"
          >
            <Plus size={14} color={colors.background} />
            <Text className="text-xs font-semibold">+ Catat Biaya POC</Text>
          </Button>
        }
      >
        <View className="gap-4">
          <View className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <View className="p-3 rounded-lg bg-card/60 border border-border">
              <Text className="text-xs text-muted-foreground">Anggaran (Budget)</Text>
              <Text className="text-base font-bold mt-1">{rupiah(row.anggaran || row.budget || 0)}</Text>
            </View>
            <View className="p-3 rounded-lg bg-card/60 border border-border">
              <Text className="text-xs text-muted-foreground">Total Biaya Terpakai</Text>
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

          {/* Expense table */}
          {pocExpenses.length === 0 ? (
            <Text className="text-xs text-muted-foreground py-4 text-center">
              Belum ada pengeluaran yang dicatat untuk POC ini.
            </Text>
          ) : (
            <View className="divide-y divide-border border border-border rounded-lg overflow-hidden">
              {pocExpenses.map((e) => (
                <View key={e.id} className="p-3 flex-row items-center justify-between bg-card/30">
                  <View className="flex-1 pr-2">
                    <View className="flex-row items-center gap-2 flex-wrap">
                      <Text className="text-sm font-semibold">{e.alasan || e.description}</Text>
                      <StatusBadge status={e.status} />
                      <View
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          e.fundingSource === "TALANGAN_PRIBADI" || e.sumberDana?.includes("Talangan")
                            ? "bg-amber-500/15 text-amber-500"
                            : "bg-blue-500/15 text-blue-500"
                        }`}
                      >
                        <Text className="text-[10px]">
                          {e.fundingSource === "TALANGAN_PRIBADI" || e.sumberDana?.includes("Talangan")
                            ? "Talangan Pribadi"
                            : "Dana Kantor"}
                        </Text>
                      </View>
                      {!e.receiptFileId && (!Array.isArray(e.receiptFileIds) || e.receiptFileIds.length === 0) ? (
                        <View className="px-2 py-0.5 rounded bg-danger/15">
                          <Text className="text-[10px] text-danger font-semibold">Tanpa Bukti</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text className="text-xs text-muted-foreground mt-1">
                      {tanggal(e.tanggal || e.date)} • Pelapor: {e.pelapor || "Karyawan"} • Kategori: {e.kategori || "-"}
                    </Text>
                  </View>
                  <Text className="text-sm font-bold">{rupiah(e.nominal || e.amount || 0)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </Panel>

      {/* ── Dokumentasi Foto Lapangan (Phase 1) ── */}
      <DocumentationPhotosPanel
        kind="poc"
        entityId={row.id}
        title="Foto Dokumentasi Kegiatan POC / Expo"
        subtitle="Lampirkan foto saat demo teknis, stand pameran, audiens, dan bukti perangkat uji"
      />

      {/* ── Dialog Tambah Checklist ── */}
      <Dialog open={addChecklistOpen} onOpenChange={setAddChecklistOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Item Persiapan POC</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <View className="gap-1.5">
              <Text className="text-xs font-semibold">Item Persiapan</Text>
              <Input
                value={newChecklistTitle}
                onChangeText={setNewChecklistTitle}
                placeholder="Contoh: Bawa kabel converter HDMI & roll kabel listrik"
              />
            </View>
            <View className="gap-1.5">
              <Text className="text-xs font-semibold">Penanggung Jawab (Assignee)</Text>
              <SearchableSelect
                value={newChecklistAssignee}
                onChange={setNewChecklistAssignee}
                options={userOptions}
                placeholder="Pilih staf penanggung jawab"
              />
            </View>
            <View className="gap-1.5">
              <Text className="text-xs font-semibold">Target Tanggal Selesai (Opsional)</Text>
              <DatePicker
                value={newChecklistDate}
                onChange={setNewChecklistDate}
                placeholder="Pilih batas waktu persiapan"
              />
            </View>
            <View className="gap-1.5">
              <Text className="text-xs font-semibold">Catatan Tambahan (Opsional)</Text>
              <Input
                value={newChecklistNotes}
                onChangeText={setNewChecklistNotes}
                placeholder="Spesifikasi atau instruksi khusus"
              />
            </View>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setAddChecklistOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleAddChecklist}>
              <Text>Simpan Checklist</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Hasil & Evaluasi ── */}
      <Dialog open={resultDialogOpen} onOpenChange={setResultDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Input Hasil Eksekusi & Evaluasi POC</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2 max-h-[70vh] overflow-y-auto pr-1">
            <View className="grid grid-cols-2 gap-2">
              <View className="gap-1">
                <Text className="text-xs font-semibold">Tanggal Pelaksanaan Aktual</Text>
                <DatePicker value={execDate} onChange={setExecDate} />
              </View>
              <View className="gap-1">
                <Text className="text-xs font-semibold">Status Hasil Akhir</Text>
                <SearchableSelect
                  value={resultStatus}
                  onChange={setResultStatus}
                  options={["Pending Evaluation", "Success", "Partial Success", "Failed"]}
                  placeholder="Pilih hasil"
                />
              </View>
            </View>

            <View className="gap-1">
              <Text className="text-xs font-semibold">Peserta / Audiens Hadir</Text>
              <Input
                value={attendees}
                onChangeText={setAttendees}
                placeholder="Contoh: Pak Budi (IT Head), Tim Security 4 orang"
              />
            </View>

            <View className="gap-1">
              <Text className="text-xs font-semibold">Aktivitas yang Dilakukan</Text>
              <Textarea
                value={activities}
                onChangeText={setActivities}
                placeholder="Jelaskan demo fitur apa saja yang dipresentasikan..."
              />
            </View>

            <View className="gap-1">
              <Text className="text-xs font-semibold">Hasil Pengujian Teknis</Text>
              <Textarea
                value={testResults}
                onChangeText={setTestResults}
                placeholder="Akurasi pengenalan wajah, responsivitas stream, integrasi alarm..."
              />
            </View>

            <View className="gap-1">
              <Text className="text-xs font-semibold">Kendala / Isu yang Ditemukan</Text>
              <Textarea
                value={issues}
                onChangeText={setIssues}
                placeholder="Koneksi switch klien lambat, pencahayaan minim, dll..."
              />
            </View>

            <View className="gap-1">
              <Text className="text-xs font-semibold">Tindak Lanjut yang Diperlukan</Text>
              <Textarea
                value={followUp}
                onChangeText={setFollowUp}
                placeholder="Kirim penawaran harga, tes ulang setelah upgrade firmware..."
              />
            </View>

            <View className="gap-1">
              <Text className="text-xs font-semibold">Kesimpulan Akhir</Text>
              <Textarea
                value={conclusion}
                onChangeText={setConclusion}
                placeholder="Kesimpulan keseluruhan kegiatan..."
              />
            </View>

            <View className="gap-1">
              <Text className="text-xs font-semibold">Rekomendasi Teknis / Bisnis</Text>
              <Textarea
                value={recommendations}
                onChangeText={setRecommendations}
                placeholder="Rekomendasi konfigurasi, kapasitas server, atau langkah komersial berikutnya..."
              />
            </View>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setResultDialogOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSaveResultReport}>
              <Text>Simpan Hasil</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Kustomisasi Header & Logo PDF ── */}
      <Dialog open={headerDialogOpen} onOpenChange={setHeaderDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Kustomisasi Header & Logo PDF</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <Text className="text-xs text-muted-foreground">
              Ubah judul header perusahaan dan unggah logo khusus jika kegiatan POC atau expo ini bukan atas nama PT Ghina Multi Prima.
            </Text>

            <View className="gap-1">
              <Text className="text-xs font-semibold">Nama / Judul Header Perusahaan</Text>
              <Input
                value={companyHeader}
                onChangeText={setCompanyHeader}
                placeholder="Contoh: PT MITRA SOLUSI TEKNOLOGI / EVENT EXPO 2026"
              />
            </View>

            <View className="gap-1">
              <Text className="text-xs font-semibold">Logo Kustom untuk Header PDF</Text>
              <FileUploader
                label="Unggah File Logo (PNG/JPEG)"
                kind="foto"
                category="poc-logo"
                handleRef={(h) => { logoUploaderRef.current = h; }}
              />
            </View>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setHeaderDialogOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSaveHeaderCustomization}>
              <Text>Simpan Pengaturan Header</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  );
}

