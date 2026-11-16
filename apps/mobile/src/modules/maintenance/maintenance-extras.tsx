import * as React from "react";
import { View, Pressable, ScrollView } from "react-native";
import {
  Printer,
  Plus,
  Edit3,
  CheckCircle2,
  Circle,
  Clock,
  Trash2,
  ListTodo,
  Settings,
  DollarSign,
  AlertCircle,
  Wrench,
  CalendarDays,
  BellRing,
  ArrowRight,
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Panel } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { DatePicker, UserSelect, UserMultiSelect, SearchableSelect } from "@/components/taska/dialogs";
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
  maintenanceReportId: number;
  task: string;
  assigneeId?: number | null;
  dueDate?: string | null;
  status: string;
  notes?: string | null;
};

function addMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function MaintenanceExtras({ row, onRefresh }: { row: Row; onRefresh?: () => void }) {
  const router = useRouter();
  const { data, user, toast, patchRow, setStatus, refreshModule, companyProfile } = useApp();
  const mtnRows = (data as any)["maintenance-reports"];

  const [pdfBusy, setPdfBusy] = React.useState(false);
  const [actions, setActions] = React.useState<ActionItem[]>(() =>
    Array.isArray(row.actions) ? row.actions : []
  );

  // Technical Report Dialog
  const [reportDialogOpen, setReportDialogOpen] = React.useState(false);
  const [findings, setFindings] = React.useState(row.findings || "");
  const [actionsTaken, setActionsTaken] = React.useState(row.actionsTaken || "");
  const [recommendations, setRecommendations] = React.useState(row.recommendations || "");
  const [conclusion, setConclusion] = React.useState(row.conclusion || "");

  // Unified Action Item / Reschedule Dialog
  const [addActionOpen, setAddActionOpen] = React.useState(false);
  const [actionTab, setActionTab] = React.useState<"task" | "reschedule">("task");

  // Mode 1: Task
  const [newActionTask, setNewActionTask] = React.useState("");
  const [newActionDueDate, setNewActionDueDate] = React.useState("");
  const [newActionNotes, setNewActionNotes] = React.useState("");
  const [newActionAssignee, setNewActionAssignee] = React.useState<string>("");

  // Mode 2: Reschedule / Next Maintenance
  const [rescheduleTitle, setRescheduleTitle] = React.useState(
    `Maintenance Rutin - ${row.klien || row.customer || row.judul || "Klien"}`
  );
  const [rescheduleType, setRescheduleType] = React.useState("Preventive");
  const [rescheduleDate, setRescheduleDate] = React.useState(() => addMonths(1));
  const [rescheduleMembers, setRescheduleMembers] = React.useState<string[]>(() => {
    if (row.tim && typeof row.tim === "string" && row.tim !== "-") {
      return row.tim.split(",").map((s: string) => s.trim()).filter(Boolean);
    }
    return user?.name ? [user.name] : [];
  });
  const [rescheduleNotes, setRescheduleNotes] = React.useState("");
  const [syncCalendar, setSyncCalendar] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  // Header & Logo customization dialog
  const [headerDialogOpen, setHeaderDialogOpen] = React.useState(false);
  const [companyHeader, setCompanyHeader] = React.useState(row.companyHeader || companyProfile.name || "");
  const logoUploaderRef = React.useRef<FileUploaderHandle | null>(null);

  const reloadMaintenance = React.useCallback(async () => {
    try {
      const res = await api<any>("GET", `/maintenance-reports/${row.id}`);
      if (Array.isArray(res?.actions)) {
        setActions(res.actions);
      }
    } catch {}
  }, [row.id]);

  React.useEffect(() => {
    let active = true;
    api<any>("GET", `/maintenance-reports/${row.id}`)
      .then((res) => {
        if (active && Array.isArray(res?.actions)) {
          setActions(res.actions);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [row.id, mtnRows]);

  // Expenses for this Maintenance Report
  const maintenanceExpenses = React.useMemo(() => {
    return (data.expenses ?? []).filter((e: Row) => {
      if (e.maintenanceReportId && String(e.maintenanceReportId) === String(row.id)) return true;
      if (e.maintenanceReport && (String(e.maintenanceReport).includes(row.nomor) || String(e.maintenanceReport).includes(row.judul))) return true;
      return false;
    });
  }, [data.expenses, row.id, row.nomor, row.judul]);

  const validExpenses = React.useMemo(() => {
    return maintenanceExpenses.filter((e) => e.status !== "Ditolak" && e.status !== "REJECTED");
  }, [maintenanceExpenses]);

  const totalBiayaAktual = React.useMemo(() => {
    return validExpenses.reduce((sum, e) => sum + (Number(e.nominal) || 0), 0);
  }, [validExpenses]);

  const companyCost = React.useMemo(() => {
    return validExpenses
      .filter((e) => e.fundingSource !== "TALANGAN_PRIBADI" && !String(e.sumberDana || "").includes("Talangan"))
      .reduce((sum, e) => sum + (Number(e.nominal) || 0), 0);
  }, [validExpenses]);

  const personalReimb = React.useMemo(() => {
    return validExpenses
      .filter((e) => e.fundingSource === "TALANGAN_PRIBADI" || String(e.sumberDana || "").includes("Talangan"))
      .reduce((sum, e) => sum + (Number(e.nominal) || 0), 0);
  }, [validExpenses]);

  const reimbPaid = React.useMemo(() => {
    return validExpenses
      .filter(
        (e) =>
          (e.fundingSource === "TALANGAN_PRIBADI" || String(e.sumberDana || "").includes("Talangan")) &&
          (e.status === "Dibayar" || e.reimbursementStatus === "PAID" || e.reimbursementStatus === "DIBAYAR")
      )
      .reduce((sum, e) => sum + (Number(e.nominal) || 0), 0);
  }, [validExpenses]);

  // Status Change Handlers
  async function handleSetStatus(newStatus: "Scheduled" | "In_Progress" | "Completed" | "Cancelled") {
    try {
      await setStatus("maintenance-reports", String(row.id), newStatus);
      toast(`Status maintenance berhasil diubah ke ${newStatus}`);
      reloadMaintenance();
      onRefresh?.();
    } catch {
      toast("Gagal mengubah status maintenance", "danger");
    }
  }

  // Save Technical Findings
  async function handleSaveTechnicalReport() {
    try {
      await patchRow("maintenance-reports", String(row.id), {
        findings,
        actionsTaken,
        recommendations,
        conclusion,
      });
      toast("Laporan teknis maintenance berhasil diperbarui");
      setReportDialogOpen(false);
      reloadMaintenance();
      onRefresh?.();
    } catch {
      toast("Gagal menyimpan laporan teknis", "danger");
    }
  }

  // Add Action Item or Reschedule Next Maintenance
  async function handleAddActionOrReschedule() {
    const allUsers = data.users || [];

    if (actionTab === "task") {
      if (!newActionTask.trim()) {
        toast("Deskripsi tugas tidak boleh kosong", "danger");
        return;
      }
      try {
        const assigneeObj = allUsers.find(
          (u) => (u.nama || u.name) === newActionAssignee
        );

        await api("POST", `/maintenance-reports/${row.id}/actions`, {
          task: newActionTask.trim(),
          assigneeId: assigneeObj?.id ? Number(assigneeObj.id) : undefined,
          dueDate: newActionDueDate || undefined,
          status: "Open",
          notes: newActionNotes.trim() || undefined,
        });

        toast("Tindak lanjut berhasil ditambahkan");
        setAddActionOpen(false);
        setNewActionTask("");
        setNewActionDueDate("");
        setNewActionNotes("");
        setNewActionAssignee("");
        reloadMaintenance();
      } catch {
        toast("Gagal menambahkan tindak lanjut", "danger");
      }
    } else {
      // Mode Reschedule: Buat Maintenance Berikutnya + Kalender + Notifikasi
      if (!rescheduleDate) {
        toast("Pilih tanggal pelaksanaan maintenance berikutnya", "danger");
        return;
      }

      setSubmitting(true);
      try {
        // Resolve member IDs
        const memberIds = rescheduleMembers
          .map((name) => allUsers.find((u) => (u.nama || u.name) === name)?.id)
          .filter(Boolean)
          .map(Number);

        const primaryPicId = memberIds[0] || row.ownerId || user?.id;

        // 1. Buat Laporan Maintenance baru (Status: Scheduled)
        const newReport = await api<any>("POST", "/maintenance-reports", {
          title: rescheduleTitle.trim() || `Maintenance Rutin - ${row.klien || "Klien"}`,
          maintenanceType: rescheduleType,
          status: "Scheduled",
          startDate: rescheduleDate,
          location: row.location || undefined,
          clientName: row.clientName || row.klien || undefined,
          clientContact: row.clientContact || row.kontakKlien || undefined,
          customerId: row.customerId ? Number(row.customerId) : undefined,
          leadId: row.leadId ? Number(row.leadId) : undefined,
          projectId: row.projectId ? Number(row.projectId) : undefined,
          purpose: `Maintenance berkala lanjutan dari ${row.nomor}. ${rescheduleNotes.trim()}`.trim(),
          description: rescheduleNotes.trim() || undefined,
          ownerId: primaryPicId,
          memberUserIds: memberIds,
        });

        // 2. Buat Agenda di Kalender Kerja dengan Reminder (1 hari sebelum & hari H)
        if (syncCalendar) {
          await api("POST", "/calendar/events", {
            title: `Jadwal Maintenance: ${rescheduleTitle.trim() || row.nomor}`,
            description: `Kunjungan maintenance berkala lanjutan dari ${row.nomor}. Lokasi: ${row.location || "-"}. Anggota tim: ${rescheduleMembers.join(", ") || "-"}. ${rescheduleNotes.trim()}`.trim(),
            category: "MAINTENANCE",
            status: "NOT_STARTED",
            priority: "MEDIUM",
            startDate: `${rescheduleDate}T09:00:00+07:00`,
            isAllDay: true,
            reminderMinutes: 1440, // 24 jam / 1 hari sebelum
            remindOnCreate: true, // Beritahu anggota saat jadwal dibuat
            assigneeId: primaryPicId,
            attendeeIds: memberIds,
            customerId: row.customerId ? Number(row.customerId) : undefined,
            projectId: row.projectId ? Number(row.projectId) : undefined,
          }).catch(() => {});
        }

        // 3. Catat di Action Items laporan saat ini sebagai bukti penjadwalan
        await api("POST", `/maintenance-reports/${row.id}/actions`, {
          task: `Jadwal Maintenance Berkala Berikutnya (${rescheduleDate})${newReport?.number ? ` [${newReport.number}]` : ""}`,
          assigneeId: primaryPicId,
          dueDate: rescheduleDate,
          status: "Open",
          notes: `Anggota Tim: ${rescheduleMembers.join(", ") || "-"}. Terdaftar di Kalender Kerja & diingatkan H-1.`,
        }).catch(() => {});

        // 4. Catat juga di Follow-up agar riwayat sinkron
        await api("POST", "/follow-ups", {
          maintenanceReportId: Number(row.id),
          date: new Date().toISOString().slice(0, 10),
          method: "MEETING",
          notes: `Maintenance selesai/aman. Dijadwalkan perawatan rutin berikutnya pada tanggal ${rescheduleDate}. Tim: ${rescheduleMembers.join(", ")}`,
          nextDate: rescheduleDate,
          status: "TERJADWAL",
        }).catch(() => {});

        toast("Jadwal maintenance baru berhasil dibuat & dimasukkan ke Kalender Kerja!");
        setAddActionOpen(false);
        refreshModule("maintenance-reports");
        refreshModule("calendar");
        reloadMaintenance();
        onRefresh?.();
      } catch (err: any) {
        toast(err?.message || "Gagal menjadwalkan maintenance berikutnya", "danger");
      } finally {
        setSubmitting(false);
      }
    }
  }

  // Toggle Action Item Status
  async function handleToggleAction(action: ActionItem) {
    if (!action?.id) return;
    const nextStatus = action.status === "Done" ? "Open" : "Done";
    try {
      await api("PATCH", `/maintenance-reports/${row.id}/actions/${action.id}`, {
        status: nextStatus,
      });
      setActions((prev) =>
        prev.map((a) => (a.id === action.id ? { ...a, status: nextStatus } : a))
      );
      toast(`Status tugas diubah ke ${nextStatus}`);
    } catch {
      toast("Gagal mengubah status tugas", "danger");
    }
  }

  // Delete Action Item
  async function handleDeleteAction(actionId: number) {
    try {
      await api("DELETE", `/maintenance-reports/${row.id}/actions/${actionId}`);
      setActions((prev) => prev.filter((a) => a.id !== actionId));
      toast("Tugas tindak lanjut dihapus");
    } catch {
      toast("Gagal menghapus tugas", "danger");
    }
  }

  // Save Header & Logo
  async function handleSaveHeader() {
    try {
      let logoId = row.logoFileId;
      if (logoUploaderRef.current?.hasStaged()) {
        try {
          const flushed = await logoUploaderRef.current.flush();
          if (flushed) logoId = flushed;
        } catch {}
      }
      await patchRow("maintenance-reports", String(row.id), {
        companyHeader,
        logoFileId: logoId,
      });
      toast("Kop & logo cetak PDF berhasil disimpan");
      setHeaderDialogOpen(false);
      reloadMaintenance();
      onRefresh?.();
    } catch {
      toast("Gagal menyimpan kop & logo", "danger");
    }
  }

  // Download PDF
  async function handleDownloadPdf() {
    setPdfBusy(true);
    try {
      await downloadDocumentationPdf("maintenance", row.id);
      toast("Dokumen PDF berhasil diunduh");
    } catch {
      toast("Gagal membuat dokumen PDF", "danger");
    } finally {
      setPdfBusy(false);
    }
  }

  const completedActions = actions.filter((a) => a.status === "Done").length;

  return (
    <View style={{ gap: 16 }}>
      {/* ─── Status & Action Bar ─── */}
      <Panel
        title="Alur & Status Aktivitas Maintenance"
        subtitle={`Nomor: ${row.nomor} · PIC Teknisi: ${row.pemilik || user?.name}`}
      >
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Status Saat Ini:</Text>
            <StatusBadge status={row.status || "Scheduled"} />
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {row.status === "Scheduled" && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-primary/40 bg-primary/5"
                onPress={() => handleSetStatus("In_Progress")}
              >
                <Wrench size={14} color={colors.primary} />
                <Text className="text-xs font-semibold text-primary">Mulai Pengerjaan</Text>
              </Button>
            )}

            {row.status !== "Completed" && (
              <Button
                size="sm"
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                onPress={() => handleSetStatus("Completed")}
              >
                <CheckCircle2 size={14} color="#fff" />
                <Text className="text-xs font-semibold text-white">Selesaikan Maintenance</Text>
              </Button>
            )}

            {row.status !== "Cancelled" && row.status !== "Completed" && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1 border-rose-300/50 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                onPress={() => handleSetStatus("Cancelled")}
              >
                <AlertCircle size={14} color={colors.danger} />
                <Text className="text-xs font-medium text-rose-600 dark:text-rose-400">Batalkan</Text>
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onPress={() => setHeaderDialogOpen(true)}
            >
              <Settings size={14} color={colors.mutedForeground} />
              <Text className="text-xs font-medium text-muted-foreground">Kop & Logo</Text>
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={pdfBusy}
              onPress={handleDownloadPdf}
            >
              <Printer size={14} color={colors.text} />
              <Text className="text-xs font-medium">
                {pdfBusy ? "Menyiapkan PDF..." : "Cetak Dokumen"}
              </Text>
            </Button>
          </View>
        </View>
      </Panel>

      {/* ─── Laporan Hasil & Temuan Lapangan ─── */}
      <Panel
        title="Hasil Pemeriksaan & Tindakan Maintenance"
        subtitle="Dokumentasi temuan kerusakan, tindakan perbaikan, penggantian komponen, dan rekomendasi teknis"
        right={
          <Button
            size="sm"
            variant="outline"
            onPress={() => {
              setFindings(row.findings || "");
              setActionsTaken(row.actionsTaken || "");
              setRecommendations(row.recommendations || "");
              setConclusion(row.conclusion || "");
              setReportDialogOpen(true);
            }}
            className="gap-1"
          >
            <Edit3 size={14} color={colors.text} />
            <Text className="text-xs font-medium">Edit Hasil Teknis</Text>
          </Button>
        }
      >
        <View style={{ gap: 14 }}>
          {/* Box 1: Temuan Masalah & Kondisi Awal */}
          <View className="rounded-lg border border-border/70 bg-card p-3.5">
            <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">
              1. Temuan Masalah & Kondisi Awal di Lapangan
            </Text>
            <Text className="text-sm text-foreground leading-relaxed">
              {row.findings || (
                <Text className="italic text-muted-foreground">
                  Belum ada catatan temuan masalah. Klik &apos;Edit Hasil Teknis&apos; untuk mengisi.
                </Text>
              )}
            </Text>
          </View>

          {/* Box 2: Tindakan & Perbaikan yang Dilakukan */}
          <View className="rounded-lg border border-border/70 bg-card p-3.5">
            <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">
              2. Tindakan / Perbaikan / Komponen yang Diganti
            </Text>
            <Text className="text-sm text-foreground leading-relaxed">
              {row.actionsTaken || (
                <Text className="italic text-muted-foreground">
                  Belum ada catatan tindakan perbaikan yang dilakukan.
                </Text>
              )}
            </Text>
          </View>

          {/* Grid 2 Kolom: Rekomendasi & Kesimpulan Akhir */}
          <View className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <View className="rounded-lg border border-border/70 bg-card p-3.5">
              <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">
                3. Rekomendasi Pemeliharaan Lanjutan
              </Text>
              <Text className="text-sm text-foreground leading-relaxed">
                {row.recommendations || (
                  <Text className="italic text-muted-foreground">
                    Tidak ada rekomendasi khusus.
                  </Text>
                )}
              </Text>
            </View>

            <View className="rounded-lg border border-border/70 bg-card p-3.5">
              <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">
                4. Kondisi Akhir Peralatan / Sistem
              </Text>
              <Text className="text-sm text-foreground leading-relaxed">
                {row.conclusion || (
                  <Text className="italic text-muted-foreground">
                    Belum ada kesimpulan kondisi operasional.
                  </Text>
                )}
              </Text>
            </View>
          </View>
        </View>
      </Panel>

      {/* ─── Rencana Tindak Lanjut & Jadwal Maintenance Berikutnya (Unified Section) ─── */}
      <Panel
        title={`Rencana Tindak Lanjut & Jadwal Maintenance (${completedActions}/${actions.length} Selesai)`}
        subtitle="Pencatatan tugas lanjutan teknis atau penjadwalan kunjungan maintenance berikutnya yang terhubung otomatis ke Kalender Kerja"
        right={
          <View className="flex-row items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onPress={() => {
                setActionTab("task");
                setAddActionOpen(true);
              }}
              className="gap-1"
            >
              <Plus size={14} color={colors.text} />
              <Text className="text-xs font-medium">Tambah Tugas</Text>
            </Button>
            <Button
              size="sm"
              onPress={() => {
                setActionTab("reschedule");
                setRescheduleDate(addMonths(1));
                setAddActionOpen(true);
              }}
              className="gap-1.5 bg-primary"
            >
              <CalendarDays size={14} color="#fff" />
              <Text className="text-xs font-semibold text-white">Jadwalkan Maintenance Ulang</Text>
            </Button>
          </View>
        }
      >
        {actions.length === 0 ? (
          <View className="py-6 items-center justify-center">
            <ListTodo size={32} color={colors.mutedForeground} className="mb-2 opacity-60" />
            <Text className="text-sm text-muted-foreground font-medium">
              Belum ada rencana tindak lanjut atau jadwal maintenance ulang.
            </Text>
            <Text className="text-xs text-muted-foreground mt-0.5">
              Klik &apos;Jadwalkan Maintenance Ulang&apos; untuk menjadwalkan kunjungan berkala (1 atau 3 bulan lagi) ke Kalender Kerja.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {actions.map((act, idx) => {
              const isDone = act?.status === "Done";
              const allUsers = data.users || [];
              const assignee = allUsers.find((u) => String(u.id) === String(act?.assigneeId));
              const assigneeName = assignee?.nama || assignee?.name;
              const taskText = String(act?.task || (act as any)?.title || (act as any)?.description || "-");
              const isNextMtn =
                taskText.toLowerCase().includes("jadwal maintenance") ||
                taskText.toLowerCase().includes("maintenance berikutnya");

              return (
                <View
                  key={act?.id ?? idx}
                  className={`flex-row items-start justify-between p-3 rounded-lg border transition-all ${
                    isDone
                      ? "bg-muted/20 border-border/50 opacity-70"
                      : isNextMtn
                      ? "bg-primary/5 border-primary/30 shadow-xs"
                      : "bg-card border-border/80 hover:border-primary/40 shadow-xs"
                  }`}
                >
                  <Pressable
                    onPress={() => handleToggleAction(act)}
                    className="flex-1 flex-row items-start gap-3"
                  >
                    <View className="mt-0.5">
                      {isDone ? (
                        <CheckCircle2 size={18} color={colors.primary} />
                      ) : (
                        <Circle size={18} color={isNextMtn ? colors.primary : colors.mutedForeground} />
                      )}
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View className="flex-row items-center gap-2 flex-wrap">
                        <Text
                          className={`text-sm font-semibold ${
                            isDone ? "line-through text-muted-foreground" : "text-foreground"
                          }`}
                        >
                          {taskText}
                        </Text>
                        {isNextMtn ? (
                          <View className="flex-row items-center gap-1 px-2 py-0.5 bg-primary/15 rounded text-[10px] text-primary font-bold">
                            <CalendarDays size={10} color={colors.primary} />
                            <Text className="text-[10px] font-bold text-primary">Agenda Kalender</Text>
                          </View>
                        ) : null}
                      </View>
                      <View className="flex-row flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {assigneeName ? (
                          <View className="flex-row items-center gap-1">
                            <Text className="text-xs text-muted-foreground font-medium">PIC / Tim:</Text>
                            <Text className="text-xs font-semibold text-foreground">{assigneeName}</Text>
                          </View>
                        ) : null}
                        {act?.dueDate ? (
                          <View className="flex-row items-center gap-1">
                            <Clock size={12} color={colors.mutedForeground} />
                            <Text className="text-xs text-muted-foreground">
                              Jadwal: {tanggal(act.dueDate)}
                            </Text>
                          </View>
                        ) : null}
                        {act?.notes ? (
                          <Text className="text-xs italic text-muted-foreground">
                            &quot;{act.notes}&quot;
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={() => act?.id && handleDeleteAction(act.id)}
                    className="p-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-500 ml-2"
                  >
                    <Trash2 size={14} color={colors.danger} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </Panel>

      {/* ─── Biaya & Pengeluaran Lapangan (Expenses & COA) ─── */}
      <Panel
        title="Biaya & Pengeluaran Maintenance Lapangan"
        subtitle="Pencatatan dana perusahaan serta klaim reimbursement dana talangan pribadi karyawan yang tercatat di pembukuan COA"
        right={
          <Button
            size="sm"
            onPress={() => {
              router.push({
                pathname: "/expenses/new",
                params: {
                  maintenanceReportId: String(row.id),
                  maintenanceId: String(row.id),
                  maintenance: `MTN ${row.nomor} - ${row.judul}`,
                  projectId: row.projectId ? String(row.projectId) : undefined,
                  project: row.project && row.project !== "-" ? String(row.project) : undefined,
                },
              });
            }}
            className="gap-1.5"
          >
            <Plus size={14} color="#fff" />
            <Text className="text-xs font-semibold text-white">Catat Pengeluaran</Text>
          </Button>
        }
      >
        <View style={{ gap: 14 }}>
          {/* Ringkasan Finansial */}
          <View className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <View className="rounded-xl border border-border/80 bg-card p-3.5">
              <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                Total Biaya Tercatat
              </Text>
              <Text className="text-lg font-black text-foreground mt-1">
                {rupiah(totalBiayaAktual)}
              </Text>
              <Text className="text-[11px] text-muted-foreground mt-0.5">
                {validExpenses.length} transaksi pengeluaran
              </Text>
            </View>

            <View className="rounded-xl border border-border/80 bg-card p-3.5">
              <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                Beban Perusahaan
              </Text>
              <Text className="text-lg font-black text-foreground mt-1">
                {rupiah(companyCost)}
              </Text>
              <Text className="text-[11px] text-muted-foreground mt-0.5">
                Kas operasional langsung
              </Text>
            </View>

            <View className="rounded-xl border border-border/80 bg-card p-3.5">
              <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                Talangan Karyawan
              </Text>
              <Text className="text-lg font-black text-primary mt-1">
                {rupiah(personalReimb)}
              </Text>
              <Text className="text-[11px] text-muted-foreground mt-0.5">
                Total klaim reimbursement
              </Text>
            </View>

            <View className="rounded-xl border border-border/80 bg-card p-3.5">
              <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                Reimbursement Cair
              </Text>
              <Text className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {rupiah(reimbPaid)}
              </Text>
              <Text className="text-[11px] text-muted-foreground mt-0.5">
                {reimbPaid >= personalReimb && personalReimb > 0 ? "Lunas" : "Sisa belum cair"}
              </Text>
            </View>
          </View>

          {/* Tabel Pengeluaran */}
          {maintenanceExpenses.length === 0 ? (
            <View className="py-6 items-center justify-center border border-dashed border-border/80 rounded-xl">
              <DollarSign size={32} color={colors.mutedForeground} className="mb-2 opacity-60" />
              <Text className="text-sm text-muted-foreground font-medium">
                Belum ada biaya pengeluaran yang dicatat untuk maintenance ini.
              </Text>
              <Text className="text-xs text-muted-foreground mt-0.5">
                Klik tombol &apos;Catat Pengeluaran&apos; untuk mencatat tiket, bensin, sparepart lokal, atau konsumsi.
              </Text>
            </View>
          ) : (
            <View className="border border-border/80 rounded-xl overflow-hidden bg-card">
              <View className="overflow-x-auto">
                <View className="min-w-[620px]">
                  <View className="flex-row items-center bg-muted/60 px-4 py-2.5 border-b border-border/70 text-xs font-bold text-muted-foreground">
                    <Text className="text-[11px] font-bold text-muted-foreground w-28">Tanggal</Text>
                    <Text className="text-[11px] font-bold text-muted-foreground flex-1 px-2">Keperluan & Kategori</Text>
                    <Text className="text-[11px] font-bold text-muted-foreground w-36 px-2">Sumber Dana</Text>
                    <Text className="text-[11px] font-bold text-muted-foreground w-28 text-right px-2">Nominal</Text>
                    <Text className="text-[11px] font-bold text-muted-foreground w-24 text-center">Status</Text>
                  </View>
                  <View className="divide-y divide-border/40">
                    {maintenanceExpenses.map((exp: Row) => (
                      <View key={exp.id} className="flex-row items-center px-4 py-3 hover:bg-muted/20">
                        <Text className="text-xs text-muted-foreground w-28">
                          {tanggal(exp.tanggal)}
                        </Text>
                        <View className="flex-1 px-2">
                          <Text className="text-xs font-semibold text-foreground">
                            {exp.alasan || exp.description || "Pengeluaran Maintenance"}
                          </Text>
                          <Text className="text-[11px] text-muted-foreground mt-0.5">
                            {exp.kategori || "Beban Operasional"} · Oleh: {exp.pelapor || "-"}
                          </Text>
                        </View>
                        <View className="w-36 px-2">
                          <Text className="text-xs text-foreground font-medium">
                            {exp.sumberDana || (exp.fundingSource === "TALANGAN_PRIBADI" ? "Talangan Pribadi" : "Dana Perusahaan")}
                          </Text>
                          {exp.reimbursementStatus ? (
                            <Text className="text-[10px] text-muted-foreground uppercase font-bold mt-0.5">
                              {exp.reimbursementStatus}
                            </Text>
                          ) : null}
                        </View>
                        <Text className="text-xs font-bold text-foreground w-28 text-right px-2">
                          {rupiah(exp.nominal)}
                        </Text>
                        <View className="w-24 items-center">
                          <StatusBadge status={exp.status} />
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>
      </Panel>

      {/* ─── Foto Dokumentasi Sebelum / Sesudah ─── */}
      <DocumentationPhotosPanel
        kind="maintenance"
        entityId={row.id}
        title="Dokumentasi Foto & Berita Acara Servis"
        subtitle="Upload foto kondisi fisik perangkat sebelum/sesudah servis, serta lampiran scan berita acara (BAST)"
      />

      {/* ─── Technical Findings Modal Dialog ─── */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent style={{ maxWidth: 650 }}>
          <DialogHeader>
            <DialogTitle>Update Laporan Teknis Maintenance</DialogTitle>
          </DialogHeader>

          <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: 14, paddingVertical: 10 }}>
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: "600" }}>1. Temuan Masalah di Lapangan</Text>
              <Textarea
                value={findings}
                onChangeText={setFindings}
                placeholder="Deskripsikan kondisi fisik, indikator kerusakan, atau hasil diagnosis awal..."
              />
            </View>

            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: "600" }}>2. Tindakan / Perbaikan / Komponen yang Diganti</Text>
              <Textarea
                value={actionsTaken}
                onChangeText={setActionsTaken}
                placeholder="Rincian perbaikan yang telah dilakukan tim teknisi di lokasi..."
              />
            </View>

            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: "600" }}>3. Rekomendasi Pemeliharaan Lanjutan</Text>
              <Textarea
                value={recommendations}
                onChangeText={setRecommendations}
                placeholder="Saran perawatan berkala atau sparepart yang perlu disiapkan..."
              />
            </View>

            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: "600" }}>4. Kesimpulan & Kondisi Akhir Peralatan</Text>
              <Textarea
                value={conclusion}
                onChangeText={setConclusion}
                placeholder="Contoh: Seluruh 16 unit kamera kembali online dan berfungsi normal."
              />
            </View>
          </ScrollView>

          <DialogFooter>
            <Button variant="outline" onPress={() => setReportDialogOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSaveTechnicalReport}>
              <Text style={{ color: "#fff" }}>Simpan Laporan Teknis</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Unified Action Item & Reschedule Dialog ─── */}
      <Dialog open={addActionOpen} onOpenChange={setAddActionOpen}>
        <DialogContent style={{ maxWidth: 560 }}>
          <DialogHeader>
            <DialogTitle>
              {actionTab === "reschedule"
                ? "Jadwalkan Maintenance Ulang / Berkala"
                : "Tambah Tugas Tindak Lanjut"}
            </DialogTitle>
          </DialogHeader>

          {/* Tab Selector */}
          <View className="flex-row items-center p-1 bg-muted/60 rounded-lg mt-2">
            <Pressable
              onPress={() => setActionTab("task")}
              className={`flex-1 py-1.5 rounded-md items-center justify-center transition-all ${
                actionTab === "task" ? "bg-card shadow-xs" : ""
              }`}
            >
              <Text className={`text-xs font-semibold ${actionTab === "task" ? "text-foreground" : "text-muted-foreground"}`}>
                Tugas / Action Item
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActionTab("reschedule")}
              className={`flex-1 py-1.5 rounded-md items-center justify-center transition-all ${
                actionTab === "reschedule" ? "bg-primary shadow-xs" : ""
              }`}
            >
              <Text className={`text-xs font-semibold ${actionTab === "reschedule" ? "text-white" : "text-muted-foreground"}`}>
                Jadwal Maintenance Ulang (+ Kalender)
              </Text>
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: 12, paddingVertical: 12 }}>
            {actionTab === "task" ? (
              <>
                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600" }}>Deskripsi Tugas *</Text>
                  <Textarea
                    value={newActionTask}
                    onChangeText={setNewActionTask}
                    placeholder="Contoh: Order unit power supply cadangan 12V 10A"
                  />
                </View>

                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600" }}>Penanggung Jawab (Assignee)</Text>
                  <UserSelect
                    value={newActionAssignee}
                    onChange={(u) => setNewActionAssignee(u?.name || u?.nama || "")}
                    placeholder="Pilih teknisi penanggung jawab..."
                    title="Pilih Penanggung Jawab Tindak Lanjut"
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
              </>
            ) : (
              <>
                {/* Mode Reschedule: Shortcut Durasi */}
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600" }}>Jadwalkan Dalam (Pilihan Cepat):</Text>
                  <View className="flex-row flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className={`h-8 px-2.5 text-xs ${rescheduleDate === addMonths(1) ? "border-primary bg-primary/10 text-primary font-bold" : ""}`}
                      onPress={() => setRescheduleDate(addMonths(1))}
                    >
                      <Text className="text-xs">1 Bulan Lagi</Text>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`h-8 px-2.5 text-xs ${rescheduleDate === addMonths(3) ? "border-primary bg-primary/10 text-primary font-bold" : ""}`}
                      onPress={() => setRescheduleDate(addMonths(3))}
                    >
                      <Text className="text-xs">3 Bulan (Kuartal)</Text>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`h-8 px-2.5 text-xs ${rescheduleDate === addMonths(6) ? "border-primary bg-primary/10 text-primary font-bold" : ""}`}
                      onPress={() => setRescheduleDate(addMonths(6))}
                    >
                      <Text className="text-xs">6 Bulan (Semester)</Text>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`h-8 px-2.5 text-xs ${rescheduleDate === addMonths(12) ? "border-primary bg-primary/10 text-primary font-bold" : ""}`}
                      onPress={() => setRescheduleDate(addMonths(12))}
                    >
                      <Text className="text-xs">1 Tahun Lagi</Text>
                    </Button>
                  </View>
                </View>

                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600" }}>Tanggal Kunjungan Maintenance *</Text>
                  <DatePicker
                    value={rescheduleDate}
                    onChange={setRescheduleDate}
                    placeholder="Pilih tanggal pelaksanaan"
                  />
                </View>

                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600" }}>Nama / Judul Pekerjaan *</Text>
                  <Input
                    value={rescheduleTitle}
                    onChangeText={setRescheduleTitle}
                    placeholder="Contoh: Maintenance Rutin Q1 - PT Ghina"
                  />
                </View>

                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600" }}>Jenis Maintenance</Text>
                  <SearchableSelect
                    value={rescheduleType}
                    onChange={setRescheduleType}
                    options={["Preventive", "Rutin", "Kalibrasi / Pengujian", "Corrective", "Emergency", "Lainnya"]}
                  />
                </View>

                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600" }}>Pilih Anggota Tim Teknisi yang Bertugas *</Text>
                  <UserMultiSelect
                    values={rescheduleMembers}
                    onChange={setRescheduleMembers}
                    placeholder="Pilih beberapa teknisi..."
                    title="Pilih Tim Teknisi Maintenance"
                  />
                  <Text className="text-[11px] text-muted-foreground mt-0.5">
                    Anggota yang dipilih akan otomatis dimasukkan sebagai pelaksana dan menerima notifikasi kalender.
                  </Text>
                </View>

                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600" }}>Catatan & Ruang Lingkup Perawatan</Text>
                  <Textarea
                    value={rescheduleNotes}
                    onChangeText={setRescheduleNotes}
                    placeholder="Contoh: Pembersihan debu switch, pengecekan tegangan adaptor, pembersihan lensa kamera..."
                  />
                </View>

                {/* Notifikasi Pengingat Kalender Alert */}
                <Pressable
                  onPress={() => setSyncCalendar(!syncCalendar)}
                  className="flex-row items-center gap-3 p-3 bg-muted/40 border border-border/80 rounded-lg mt-1"
                >
                  <View className="mt-0.5">
                    {syncCalendar ? (
                      <CheckCircle2 size={18} color={colors.primary} />
                    ) : (
                      <Circle size={18} color={colors.mutedForeground} />
                    )}
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-1.5">
                      <BellRing size={14} color={colors.primary} />
                      <Text className="text-xs font-bold text-foreground">
                        Integrasi Kalender Kerja & Pengingat Otomatis
                      </Text>
                    </View>
                    <Text className="text-[11px] text-muted-foreground mt-0.5">
                      Agenda akan muncul di Kalender Kerja dan sistem akan otomatis mengingatkan tim teknisi <Text className="font-semibold text-foreground">H-1 (sehari sebelum)</Text> dan <Text className="font-semibold text-foreground">pada hari H</Text>.
                    </Text>
                  </View>
                </Pressable>
              </>
            )}
          </ScrollView>

          <DialogFooter>
            <Button variant="outline" disabled={submitting} onPress={() => setAddActionOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button disabled={submitting} onPress={handleAddActionOrReschedule}>
              <Text style={{ color: "#fff" }}>
                {submitting
                  ? "Menyimpan..."
                  : actionTab === "reschedule"
                  ? "Jadwalkan Maintenance"
                  : "Simpan Tugas"}
              </Text>
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
                Ubah jika aktivitas maintenance mewakili brand atau entitas kemitraan lain.
              </Text>
            </View>

            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: "600" }}>Upload Logo Khusus (Opsional)</Text>
              <FileUploader
                label="Unggah File Logo (PNG/JPEG)"
                kind="foto"
                category="maintenance-logo"
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
