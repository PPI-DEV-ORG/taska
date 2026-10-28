import * as React from "react";
import { View, Pressable, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Plus,
  Minus,
  Pencil,
  ShoppingCart,
  Trash2,
  Upload,
  FileSpreadsheet,
  RotateCcw,
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Text } from "@/components/ui/text";
import { PageHeader, Panel, Chip, EmptyState, InfoGrid, Timeline } from "@/components/taska/basics";
import { ConfirmDialog, FormDialog } from "@/components/taska/dialogs";
import { StatusBadge } from "@/components/taska/status-badge";
import { DocumentViewerList, DocumentViewerItem, resolveModuleDocs } from "@/components/taska/document-viewer";
import { useApp } from "@/store/app-store";
import { api } from "@/services/api";
import { adaptRow, toLabel } from "@/services/adapters";
import { MODULES, type Row } from "@/constants/modules";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";
import { rupiah, tanggal } from "@/lib/format";
import { ProjectExtras, useProjectExpenses } from "@/modules/project/project-extras";
import { TaskDetailDialog } from "@/modules/task/task-detail-dialog";

const TABS = [
  "Ringkasan",
  "Komersial & BOQ",
  "Tugas",
  "Barang",
  "Pengiriman",
  "Dokumen",
  "Biaya",
  "Riwayat",
] as const;

type TabKey = typeof TABS[number];

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, user, addRow, setStatus, patchRow, deleteRow, history, loadHistory, toast, reload, refreshModule } = useApp();

  const [activeTab, setActiveTab] = React.useState<TabKey>("Ringkasan");
  const [taskModalOpen, setTaskModalOpen] = React.useState(false);
  const [reqModalOpen, setReqModalOpen] = React.useState(false);
  const [returnModalOpen, setReturnModalOpen] = React.useState(false);
  const [editProjectOpen, setEditProjectOpen] = React.useState(false);
  const [deleteProjectOpen, setDeleteProjectOpen] = React.useState(false);
  const [requirements, setRequirements] = React.useState<any[]>([]);
  const [detailTask, setDetailTask] = React.useState<Row | null>(null);

  React.useEffect(() => {
    if (id) {
      void loadHistory("projects", id);
    }
  }, [id, loadHistory]);

  const storeProject = data.projects.find((p) => String(p.id) === String(id));
  const [remoteDetail, setRemoteDetail] = React.useState<Row | null>(null);
  React.useEffect(() => {
    if (!id) return;
    let active = true;
    api<any>("GET", `/projects/${id}`)
      .then((raw) => {
        if (active && raw) setRemoteDetail(adaptRow("projects", raw));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id, storeProject?.boqFileId, storeProject?.progres, storeProject?.status, storeProject?.bastFileId]);
  const baseProject = storeProject ?? remoteDetail;
  const project = baseProject
    ? {
        ...baseProject,
        ...(remoteDetail ?? {}),
        nama: String(remoteDetail?.nama || baseProject.nama || remoteDetail?.name || baseProject.name || ""),
        name: String(remoteDetail?.name || baseProject.name || remoteDetail?.nama || baseProject.nama || ""),
        status: remoteDetail?.status || baseProject.status || (baseProject.status ? toLabel("projects", baseProject.status) : "Berjalan"),
        pembayaran: remoteDetail?.pembayaran || baseProject.pembayaran || (baseProject.paymentStatus ? toLabel("paymentStatus", baseProject.paymentStatus) : "Belum lunas"),
        paymentStatus: remoteDetail?.paymentStatus || baseProject.paymentStatus || remoteDetail?.pembayaran || baseProject.pembayaran || "Belum lunas",
        jenis: remoteDetail?.jenis || baseProject.jenis || (baseProject.type ? toLabel("projectType", baseProject.type) : "Customer"),
        type: remoteDetail?.type || baseProject.type || remoteDetail?.jenis || baseProject.jenis || "CUSTOMER",
        customer: typeof (remoteDetail?.customer ?? baseProject.customer) === "object"
          ? ((remoteDetail?.customer ?? baseProject.customer)?.name || (remoteDetail?.customer ?? baseProject.customer)?.nama || "-")
          : String(remoteDetail?.customer || baseProject.customer || "-"),
        progres: (remoteDetail?.status === "Selesai" || baseProject.status === "Selesai" || String(remoteDetail?.status || baseProject.status).toUpperCase() === "SELESAI")
          ? 100
          : (remoteDetail?.progres ?? baseProject.progres ?? remoteDetail?.progress ?? baseProject.progress ?? 0),
        progress: (remoteDetail?.status === "Selesai" || baseProject.status === "Selesai" || String(remoteDetail?.status || baseProject.status).toUpperCase() === "SELESAI")
          ? 100
          : (remoteDetail?.progress ?? baseProject.progress ?? remoteDetail?.progres ?? baseProject.progres ?? 0),
        quotationId: remoteDetail?.quotationId ?? baseProject.quotationId ?? remoteDetail?.quotationid ?? baseProject.quotationid ?? (remoteDetail?.quotation?.id ? String(remoteDetail.quotation.id) : (baseProject.quotation?.id ? String(baseProject.quotation.id) : null)),
        quotationid: remoteDetail?.quotationid ?? baseProject.quotationid ?? remoteDetail?.quotationId ?? baseProject.quotationId ?? (remoteDetail?.quotation?.id ? String(remoteDetail.quotation.id) : (baseProject.quotation?.id ? String(baseProject.quotation.id) : null)),
        stages: remoteDetail?.stages ?? baseProject.stages ?? null,
        boqFile: remoteDetail?.boqFile ?? baseProject.boqFile ?? null,
      }
    : undefined;
  const currentProgress = project
    ? (project.status === "Selesai" || String(project.status).toUpperCase() === "SELESAI" ? 100 : (Number(project.progres ?? project.progress) || 0))
    : 0;
  const [liveProgress, setLiveProgress] = React.useState<number>(currentProgress);
  const [prevProgress, setPrevProgress] = React.useState<number>(currentProgress);
  const [savingProgress, setSavingProgress] = React.useState(false);

  if (prevProgress !== currentProgress) {
    setPrevProgress(currentProgress);
    setLiveProgress(currentProgress);
  }

  const loadRequirements = React.useCallback(async () => {
    if (!id) return;
    try {
      const res = await api<any>("GET", `/projects/${id}/requirements`);
      const list = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
      setRequirements(list);
    } catch {}
  }, [id]);

  React.useEffect(() => {
    if (!id) return;
    let active = true;
    api<any>("GET", `/projects/${id}/requirements`)
      .then((res) => {
        if (!active) return;
        const list = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
        setRequirements(list);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id]);

  const projectExpenses = useProjectExpenses(project?.id, project?.nama);

  if (!project) {
    return (
      <EmptyState
        title="Project tidak ditemukan"
        text="Data project tidak tersedia atau telah dihapus."
        actionLabel="Kembali ke daftar project"
        onAction={() => router.replace("/projects")}
      />
    );
  }

  const pName = project.nama || project.name || "";
  const tasks = data.tasks.filter(
    (t) =>
      String(t.projectId) === String(project.id) ||
      String(t.project) === String(project.id) ||
      (pName && t.project === pName)
  );
  const expenses = data.expenses.filter(
    (e) => (pName && e.project === pName) || String(e.projectId) === String(project.id)
  );
  const deliveryNotes = data["delivery-notes"].filter(
    (dn) => (pName && dn.project === pName) || String(dn.projectId) === String(project.id)
  );
  const projectRequests = (data["purchase-requests"] ?? []).filter(
    (pr: any) =>
      String(pr.projectId) === String(project.id) ||
      (pName && pr.project === pName) ||
      String(pr.project) === String(project.id)
  );

  const canViewFinancials = ["super_admin", "bos", "finance"].includes(user?.role || "");

  const projectInvoices = (data.invoices ?? []).filter(
    (i: any) =>
      (String(i.projectId) === String(project.id) || (pName && i.project === pName)) &&
      i.status !== "Batal" &&
      i.status !== "BATAL"
  );
  const revenue = projectInvoices.reduce((sum: number, i: any) => sum + Number(i.nilai || i.amount || 0), 0);

  const projectPos = (data["supplier-pos"] ?? []).filter(
    (po: any) =>
      (String(po.projectId) === String(project.id) || (pName && po.project === pName)) &&
      po.status !== "Ditolak" &&
      po.status !== "DIBATALKAN"
  );
  const poCost = projectPos.reduce((sum: number, po: any) => sum + Number(po.total || 0), 0);

  const expenseCost = projectExpenses.reduce((sum: number, e: any) => sum + Number(e.nominal || 0), 0);
  const totalCost = poCost + expenseCost;
  const netProfit = revenue - totalCost;
  const marginPct = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : "0.0";

  function downloadProjectPnl() {
    if (!canViewFinancials) {
      toast("Akses ditolak: Hanya untuk Finance, Bos, dan Super Admin", "danger");
      return;
    }
    const header = `LAPORAN UNTUNG-RUGI (P&L) PROYEK\nNama Proyek: ${project?.nama || project?.name || ""}\nCustomer: ${project?.customer || "-"}\nTanggal Cetak: ${new Date().toISOString().slice(0, 10)}\n\n`;
    const summary = [
      `KOMPONEN KEUANGAN,NOMINAL (RP),KETERANGAN`,
      `Pendapatan DPP Invoice,${revenue},"${projectInvoices.length} invoice tercatat"`,
      
      `Biaya PO Supplier (Material),${poCost},"${projectPos.length} purchase order"`,
      `Biaya Operasional & Reimburse,${expenseCost},"${projectExpenses.length} transaksi"`,
      `Total Biaya & Beban,${totalCost},""`,
      `Laba Bersih Proyek,${netProfit},"Margin ${marginPct}%"`,
    ].join("\n");
    const blob = new Blob(["\uFEFF" + header + summary], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pnl-${(project?.nama || project?.name || "proyek").toLowerCase().replace(/[^a-z0-9]/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast("Laporan Untung-Rugi (P&L) proyek berhasil diunduh");
  }

  const isLunas = project.pembayaran === "Lunas" || String(project.paymentStatus).toUpperCase() === "LUNAS";
  const hasProgressChanged = liveProgress !== currentProgress;

  function toggleTask(taskId: string, currentStatus: string) {
    const next = currentStatus === "DONE" ? "IN PROGRESS" : "DONE";
    patchRow("tasks", taskId, { status: next });
    toast(`Status tugas diubah ke ${next}`);
  }

  function markCompleted() {
    if (!project) return;
    setStatus("projects", project.id, "Selesai");
    patchRow("projects", project.id, { status: "Selesai", progres: 100 });
    toast("Project ditandai selesai (progres otomatis 100%)");
  }

  async function saveProgress() {
    if (!project || !hasProgressChanged) return;
    setSavingProgress(true);
    try {
      const clamped = Math.max(0, Math.min(100, Math.round(liveProgress)));
      const nextStatus = clamped === 100 ? "Selesai" : project.status === "Selesai" ? "Berjalan" : project.status;
      await patchRow("projects", project.id, { progres: clamped, status: nextStatus });
      if (clamped === 100) {
        await setStatus("projects", project.id, "Selesai");
      }
      toast(`Progres project berhasil disimpan: ${clamped}%${clamped === 100 ? " (Status Selesai)" : ""}`);
    } finally {
      setSavingProgress(false);
    }
  }

  function resetProgress() {
    setLiveProgress(currentProgress);
  }

  return (
    <View className="gap-5">
      <PageHeader
        back
        title={project.nama}
        subtitle={`${project.jenis} · Customer: ${project.customer}`}
        status={project.status}
        onRefresh={loadRequirements}
        action={
          <View className="flex-row flex-wrap items-center gap-2">
            {!isLunas ? (
              <View className="bg-warning/15 flex-row items-center gap-1.5 rounded-full px-3 py-1">
                <AlertTriangle size={14} color={colors.warning} />
                <Text className="text-warning text-xs font-medium">Belum lunas (Handover dicatat)</Text>
              </View>
            ) : null}
            {canViewFinancials ? (
              <Button size="sm" variant="outline" onPress={downloadProjectPnl} className="flex-row items-center gap-1.5">
                <FileSpreadsheet size={14} color={colors.success} />
                <Text>Laporan Untung-Rugi (P&L)</Text>
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onPress={() => setEditProjectOpen(true)}>
              <Pencil size={14} color={colors.text} />
              <Text>Ubah</Text>
            </Button>
            <Button size="sm" variant="outline" onPress={() => setDeleteProjectOpen(true)}>
              <Trash2 size={14} color={colors.danger} />
              <Text className="text-danger">Hapus</Text>
            </Button>
            {project.status !== "Selesai" && (user?.role === "super_admin" || user?.role === "pm" || user?.role === "bos" || user?.role === "admin") ? (
              <Button size="sm" onPress={markCompleted}>
                <Text>Selesaikan Project</Text>
              </Button>
            ) : null}
          </View>
        }
      />

      {/* Tabs Menu */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {TABS.map((tab) => (
          <Chip
            key={tab}
            label={tab}
            active={activeTab === tab}
            onPress={() => setActiveTab(tab)}
          />
        ))}
      </ScrollView>

      {/* Tab 1: Ringkasan */}
      {activeTab === "Ringkasan" && (
        <View className="gap-4">
          <Panel title="Informasi Project">
            <InfoGrid
              fields={[
                { label: "Project Manager (PIC)", key: "pm" },
                { label: "Tim Lapangan (SE / Teknisi)", key: "tim" },
                { label: "Penawaran Terkait", key: "penawaran" },
                { label: "Lead CRM Terkait", key: "lead" },
                { label: "Tanggal Mulai", key: "mulai", fmt: "date" },
                { label: "Target Selesai", key: "selesai", fmt: "date" },
                { label: "Status Logistik Barang", key: "barang" },
                { label: "Status Pembayaran", key: "pembayaran" },
                { label: "Progres Pekerjaan", key: "progres", fmt: "pct" },
              ]}
              row={{
                ...project,
                progres: project.status === "Selesai" ? 100 : (project.progres ?? 0),
              }}
            />

            <View className="mt-4 pt-3 border-t border-border/70 gap-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <Text className="text-xs font-semibold text-foreground">Progres Proyek</Text>
                  {hasProgressChanged ? (
                    <View className="bg-primary/10 border border-primary/30 px-2 py-0.5 rounded-full">
                      <Text className="text-[10px] font-medium text-primary">Belum disimpan</Text>
                    </View>
                  ) : null}
                </View>
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-sm font-bold text-primary">{liveProgress}%</Text>
                  {liveProgress === 100 ? (
                    <View className="bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      <Text className="text-[10px] font-bold text-emerald-500">Selesai</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Slider Progres dengan Handle & Tombol Plus/Minus di kedua ujung */}
              <View className="flex-row items-center gap-2.5">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8 rounded-lg shrink-0 border-border/80 hover:bg-panel active:bg-panel"
                  disabled={liveProgress <= 0}
                  onPress={() => setLiveProgress((prev) => Math.max(0, prev - 1))}
                  accessibilityLabel="Turunkan progres 1%"
                >
                  <Minus size={14} color={liveProgress <= 0 ? colors.muted : colors.text} />
                </Button>

                <Slider
                  value={liveProgress}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(val) => setLiveProgress(val)}
                />

                <Button
                  variant="outline"
                  size="icon"
                  className="size-8 rounded-lg shrink-0 border-border/80 hover:bg-panel active:bg-panel"
                  disabled={liveProgress >= 100}
                  onPress={() => setLiveProgress((prev) => Math.min(100, prev + 1))}
                  accessibilityLabel="Naikkan progres 1%"
                >
                  <Plus size={14} color={liveProgress >= 100 ? colors.muted : colors.text} />
                </Button>
              </View>

              {/* Preset Nilai & Tombol Simpan */}
              <View className="flex-row flex-wrap items-center justify-between gap-2">
                <View className="flex-row flex-wrap gap-1.5 items-center">
                  {[10, 25, 50, 75, 100].map((pct) => (
                    <Button
                      key={pct}
                      size="sm"
                      variant={liveProgress === pct ? "default" : "outline"}
                      className="h-8 px-3"
                      onPress={() => setLiveProgress(pct)}
                    >
                      <Text className="text-xs">{pct === 100 ? "100% (Selesai)" : `${pct}%`}</Text>
                    </Button>
                  ))}
                </View>

                <View className="flex-row items-center gap-2">
                  {hasProgressChanged && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-3"
                      onPress={resetProgress}
                      disabled={savingProgress}
                    >
                      <Text className="text-xs">Batal</Text>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant={hasProgressChanged ? "default" : "outline"}
                    className={cn(
                      "h-8 px-3 flex-row items-center gap-1.5",
                      !hasProgressChanged && "opacity-50"
                    )}
                    onPress={saveProgress}
                    disabled={!hasProgressChanged || savingProgress}
                  >
                    <Check size={14} color={hasProgressChanged ? colors.background : colors.muted} />
                    <Text className={cn("text-xs font-bold", hasProgressChanged ? "text-primary-foreground" : "text-muted-foreground")}>
                      {savingProgress ? "Menyimpan..." : "Simpan Progres"}
                    </Text>
                  </Button>
                </View>
              </View>
            </View>
          </Panel>

          <ProjectExtras row={project} />

          <Panel title="Handover & Serah Terima Dokumen">
            <Text className="text-text-secondary text-sm">
              Handover dilakukan setelah invoice lunas. Sistem mencatat dokumen serah terima (BAST/BAHP) tanpa memblokir penutupan project bila ada kesepakatan internal.
            </Text>
            <View className="mt-4">
              <DocumentViewerItem
                item={resolveModuleDocs("projects", "Berita Acara Serah Terima (BAST)", project)}
              />
            </View>
          </Panel>

          {canViewFinancials ? (
            <Panel
              title="Analisa Untung-Rugi (P&L Project)"
              subtitle="Ringkasan margin laba bersih proyek berdasarkan realisasi tagihan invoice dan pengeluaran beban riil."
              right={
                <Button size="sm" variant="outline" onPress={downloadProjectPnl} className="flex-row items-center gap-1.5">
                  <FileSpreadsheet size={13} color={colors.success} />
                  <Text className="text-xs">Download CSV P&L</Text>
                </Button>
              }
            >
              <View className="divide-y divide-border/60">
                <View className="flex-row items-center justify-between py-2">
                  <View>
                    <Text className="text-sm">Pendapatan Proyek (DPP Invoice)</Text>
                    <Text className="text-xs text-muted-foreground">{projectInvoices.length} invoice tercatat</Text>
                  </View>
                  <Text className="text-sm font-semibold">{rupiah(revenue)}</Text>
                </View>
                <View className="flex-row items-center justify-between py-2">
                  <View>
                    <Text className="text-sm">Biaya PO Supplier (Material)</Text>
                    <Text className="text-xs text-muted-foreground">{projectPos.length} purchase order</Text>
                  </View>
                  <Text className="text-sm font-semibold text-danger">{rupiah(poCost)}</Text>
                </View>
                <View className="flex-row items-center justify-between py-2">
                  <View>
                    <Text className="text-sm">Biaya Operasional & Reimburse</Text>
                    <Text className="text-xs text-muted-foreground">{projectExpenses.length} transaksi operasional</Text>
                  </View>
                  <Text className="text-sm font-semibold text-danger">{rupiah(expenseCost)}</Text>
                </View>
                <View className="flex-row items-center justify-between py-2">
                  <Text className="text-sm font-medium">Total Beban & Biaya</Text>
                  <Text className="text-sm font-bold text-danger">{rupiah(totalCost)}</Text>
                </View>
                <View className="flex-row items-center justify-between py-2.5 bg-panel/50 px-2 rounded-lg mt-1">
                  <View>
                    <Text className="text-sm font-bold">Laba Bersih Proyek (Net Profit)</Text>
                    <Text className="text-xs text-muted-foreground">Margin Keuntungan: {marginPct}%</Text>
                  </View>
                  <Text className={`text-base font-bold ${netProfit >= 0 ? "text-success" : "text-danger"}`}>
                    {rupiah(netProfit)}
                  </Text>
                </View>
              </View>
            </Panel>
          ) : null}
        </View>
      )}

      {/* Tab: Komersial & BOQ */}
      {activeTab === "Komersial & BOQ" && (
        <View className="gap-4">
          <ProjectExtras row={project} />
        </View>
      )}

      {/* Tab 2: Tugas Bertingkat */}
      {activeTab === "Tugas" && (
        <View className="gap-4">
          <Panel
            title="Daftar Tugas Bertingkat"
            subtitle="Tugas induk dan sub-tugas project"
            right={
              <View className="flex-row gap-2">
                <Button size="sm" onPress={() => setTaskModalOpen(true)}>
                  <Plus size={14} color={colors.background} />
                  <Text className="text-xs">Tambah Tugas</Text>
                </Button>
                <Button size="sm" variant="outline" onPress={() => router.push("/purchase-requests/new" as any)}>
                  <ShoppingCart size={14} color={colors.text} />
                  <Text className="text-xs">Request Barang</Text>
                </Button>
              </View>
            }
          >
            {tasks.length === 0 ? (
              <Text className="text-muted-foreground py-4 text-center text-sm">Belum ada tugas untuk project ini.</Text>
            ) : (
              tasks.map((t) => (
                <View
                  key={t.id}
                  className={`border-border border-b py-3 last:border-b-0 ${
                    t.parent ? "ml-6 pl-3 border-l-2 border-primary/40" : ""
                  }`}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 pr-3">
                      <Text className="text-sm font-semibold">{t.nama || t.name}</Text>
                      {t.deskripsi ? (
                        <Text className="text-muted-foreground text-xs mt-0.5" numberOfLines={2}>
                          {t.deskripsi}
                        </Text>
                      ) : null}
                      <Text className="text-text-secondary text-xs mt-1">
                        PIC: {t.pic} · Tenggat: {tanggal(t.tenggat)}
                        {t.perluBarang ? " · (Perlu pembelian barang)" : ""}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <StatusBadge status={t.status} />
                      <Button variant="outline" size="sm" onPress={() => setDetailTask(t)}>
                        <Text className="text-xs">Detail / Edit</Text>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onPress={() => toggleTask(t.id, t.status)}
                      >
                        <Text className="text-xs">{t.status === "DONE" ? "Buka lagi" : "Selesai"}</Text>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onPress={() => void deleteRow("tasks", t.id)}
                      >
                        <Trash2 size={14} color={colors.danger} />
                      </Button>
                    </View>
                  </View>
                </View>
              ))
            )}
          </Panel>
          <TaskDetailDialog
            task={detailTask ? ((data.tasks ?? []).find((t: Row) => String(t.id) === String(detailTask.id)) ?? detailTask) : null}
            open={!!detailTask}
            onOpenChange={(v) => !v && setDetailTask(null)}
            onSaved={(updated) => setDetailTask(updated)}
          />
        </View>
      )}

      {/* Tab 3: Kebutuhan Barang & Reservasi */}
      {activeTab === "Barang" && (
        <View className="gap-4">
          <Panel
            title="Kebutuhan Barang Project"
            subtitle="Sistem otomatis mengecek stok, menahan (reserve) yang tersedia, dan mengajukan kekurangan ke Procurement"
            right={
              <View className="flex-row flex-wrap gap-2">
                {project.quotationId ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={async () => {
                      try {
                        const res = await api<any>("POST", `/projects/${project.id}/sync-quotation`, {
                          quotationId: Number(project.quotationId),
                        });
                        await loadRequirements();
                        await refreshModule("projects");
                        toast(
                          res?.imported > 0
                            ? `${res.imported} item berhasil ditarik dari Penawaran`
                            : "Semua barang penawaran sudah ada di kebutuhan proyek",
                        );
                      } catch (e: any) {
                        toast(e?.message ?? "Gagal menarik barang dari penawaran", "danger");
                      }
                    }}
                  >
                    <Text className="text-xs">Tarik dari Penawaran</Text>
                  </Button>
                ) : null}
                <Button size="sm" onPress={() => setReqModalOpen(true)}>
                  <Plus size={14} color={colors.background} />
                  <Text className="text-xs">Isi Kebutuhan Barang</Text>
                </Button>
                <Button size="sm" variant="outline" onPress={() => router.push("/purchase-requests/new" as any)}>
                  <Text className="text-xs">Request Manual</Text>
                </Button>
                <Button size="sm" variant="outline" onPress={() => setReturnModalOpen(true)}>
                  <RotateCcw size={14} color={colors.text} />
                  <Text className="text-xs">Retur Sisa Barang</Text>
                </Button>
              </View>
            }
          >
            {requirements.length === 0 ? (
              <Text className="text-muted-foreground py-4 text-center text-sm">
                Belum ada kebutuhan barang untuk project ini. Klik &quot;Isi Kebutuhan Barang&quot; untuk menambahkan.
              </Text>
            ) : (
              requirements.map((r: any) => (
                <View key={r.id} className="border-border flex-row items-center justify-between border-b py-3 last:border-b-0">
                  <View className="flex-1 pr-3">
                    <View className="flex-row justify-between">
                      <Text className="text-sm font-medium">{r.product?.name ?? "Barang"}</Text>
                      <Text className="text-sm font-semibold">
                        Dibutuhkan: {r.neededQty ?? r.qty} {r.product?.unit ?? "unit"}
                      </Text>
                    </View>
                    <Text className={Number(r.shortageQty) > 0 ? "text-warning text-xs mt-0.5" : "text-success text-xs mt-0.5"}>
                      Tersedia & Di-reserve: {r.reservedQty} {r.product?.unit ?? "unit"}
                      {Number(r.shortageQty) > 0
                        ? ` · Kekurangan: ${r.shortageQty} ${r.product?.unit ?? "unit"} (Otomatis masuk Request Procurement)`
                        : " (Stok aman, siap pasang)"}
                    </Text>
                  </View>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onPress={async () => {
                      try {
                        await api("DELETE", `/projects/${project.id}/requirements/${r.id}`);
                        await loadRequirements();
                        await refreshModule("projects");
                        toast("Kebutuhan barang & request berhasil dihapus");
                      } catch (e: any) {
                        toast(e?.message ?? "Gagal menghapus", "danger");
                      }
                    }}
                  >
                    <Trash2 size={14} color={colors.danger} />
                  </Button>
                </View>
              ))
            )}
          </Panel>

          {/* Panel 2: Daftar Request Barang / Pengadaan Project */}
          <Panel
            title={`Request Barang Project (${projectRequests.length})`}
            subtitle="Daftar pengajuan permintaan barang ke Gudang / Pengadaan terkait project ini"
            right={
              <Button
                size="sm"
                variant="outline"
                onPress={() => router.push({ pathname: "/purchase-requests/new", params: { projectId: project.id } } as any)}
              >
                <Plus size={14} color={colors.text} />
                <Text className="text-xs">Buat Request</Text>
              </Button>
            }
          >
            {projectRequests.length === 0 ? (
              <Text className="text-muted-foreground py-4 text-center text-sm">
                Belum ada request barang yang diajukan untuk project ini.
              </Text>
            ) : (
              projectRequests.map((pr: any) => (
                <View
                  key={pr.id}
                  className="border-border flex-row items-center justify-between border-b py-3 last:border-b-0"
                >
                  <Pressable
                    onPress={() => router.push(`/purchase-requests/${pr.id}` as any)}
                    className="flex-1 pr-3"
                  >
                    <View className="flex-row items-center gap-2">
                      <Text className="text-sm font-semibold">{pr.nomor}</Text>
                      <StatusBadge status={pr.status} />
                    </View>
                    <Text className="text-foreground text-xs mt-1" numberOfLines={1}>
                      {pr.item || pr.tujuan || "Barang Operasional"}
                    </Text>
                    <Text className="text-muted-foreground text-[11px] mt-0.5">
                      Pemohon: {pr.pemohon || "-"} · {pr.tanggal || "-"}
                    </Text>
                  </Pressable>
                  <View className="flex-row items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-lg hover:bg-danger/10"
                      onPress={async () => {
                        const isDiajukan = pr.status === "Diajukan" || pr.status === "DIAJUKAN";
                        if (!isDiajukan) {
                          toast("Request sudah berjalan tidak bisa hapus request", "danger");
                          return;
                        }
                        try {
                          await api("DELETE", `/requests/${pr.id}`);
                          await refreshModule("purchase-requests");
                          await loadRequirements();
                          toast("Request barang berhasil dihapus");
                        } catch (err: any) {
                          toast(err?.message ?? "Gagal menghapus request", "danger");
                        }
                      }}
                    >
                      <Trash2 size={15} color={colors.danger} />
                    </Button>
                    <Pressable
                      onPress={() => router.push(`/purchase-requests/${pr.id}` as any)}
                      className="p-1"
                    >
                      <ChevronRight size={16} color={colors.muted} />
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </Panel>
        </View>
      )}

      {/* Tab 4: Pengiriman & Surat Jalan */}
      {activeTab === "Pengiriman" && (
        <View className="gap-4">
          <Panel
            title="Surat Jalan & Pengiriman Lapangan"
            right={
              <Button size="sm" variant="outline" onPress={() => router.push("/delivery-notes/new" as any)}>
                <Text>Buat Surat Jalan</Text>
              </Button>
            }
          >
            {deliveryNotes.length === 0 ? (
              <Text className="text-muted-foreground py-4 text-center text-sm">Belum ada surat jalan untuk project ini.</Text>
            ) : (
              deliveryNotes.map((dn) => (
                <Pressable
                  key={dn.id}
                  onPress={() => router.push(`/delivery-notes/${dn.id}` as any)}
                  className="border-border flex-row items-center justify-between border-b py-3 last:border-b-0"
                >
                  <View className="flex-1 pr-2">
                    <Text className="text-sm font-semibold">{dn.nomor}</Text>
                    <Text className="text-text-secondary text-xs">{dn.alasan} · Pembawa: {dn.pembuat}</Text>
                  </View>
                  <StatusBadge status={dn.status} />
                </Pressable>
              ))
            )}
          </Panel>
        </View>
      )}

      {/* Tab 5: Dokumen (PRD, BAST, DO) */}
      {activeTab === "Dokumen" && (
        <View className="gap-4">
          <Panel title="File & Lampiran Dokumen Project">
            <DocumentViewerList
              moduleKey="projects"
              docs={[
                "Dokumen PRD & Spesifikasi Teknis",
                "Berita Acara Hasil Pekerjaan (BAHP)",
                "Berita Acara Serah Terima (BAST)",
                "Delivery Order (DO) / Surat Jalan Bertandatangan",
              ]}
              row={project}
              onUploadFile={async (fieldKey, fileId, item) => {
                try {
                  await patchRow("projects", project.id, { [fieldKey]: fileId });
                  toast(`${item.label} berhasil diperbarui`);
                } catch (err: any) {
                  toast(err?.message || "Gagal memperbarui file", "danger");
                }
              }}
            />
          </Panel>
        </View>
      )}

      {/* Tab 6: Biaya & Pengeluaran Lapangan */}
      {activeTab === "Biaya" && (
        <View className="gap-4">
          {canViewFinancials ? (
            <Panel
              title="Ringkasan Margin Laba-Rugi Project"
              right={
                <Button size="sm" variant="outline" onPress={downloadProjectPnl} className="flex-row items-center gap-1.5">
                  <FileSpreadsheet size={13} color={colors.success} />
                  <Text className="text-xs">Download CSV P&L</Text>
                </Button>
              }
            >
              <View className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <View className="p-3 bg-panel/60 border border-border/80 rounded-lg">
                  <Text className="text-xs text-muted-foreground">Pendapatan DPP</Text>
                  <Text className="text-sm font-semibold text-foreground mt-0.5">{rupiah(revenue)}</Text>
                </View>
                <View className="p-3 bg-panel/60 border border-border/80 rounded-lg">
                  <Text className="text-xs text-muted-foreground">Biaya PO Supplier</Text>
                  <Text className="text-sm font-semibold text-danger mt-0.5">{rupiah(poCost)}</Text>
                </View>
                <View className="p-3 bg-panel/60 border border-border/80 rounded-lg">
                  <Text className="text-xs text-muted-foreground">Operasional/Biaya</Text>
                  <Text className="text-sm font-semibold text-danger mt-0.5">{rupiah(expenseCost)}</Text>
                </View>
                <View className="p-3 bg-panel/60 border border-border/80 rounded-lg">
                  <Text className="text-xs text-muted-foreground">Laba Bersih ({marginPct}%)</Text>
                  <Text className={`text-sm font-bold mt-0.5 ${netProfit >= 0 ? "text-success" : "text-danger"}`}>{rupiah(netProfit)}</Text>
                </View>
              </View>
            </Panel>
          ) : null}

          <Panel
            title="Pengeluaran Lapangan Project"
            subtitle="Bensin, makan, transport, perlengkapan teknisi"
            right={
              <Button size="sm" variant="outline" onPress={() => router.push("/expenses/new" as any)}>
                <Text>Catat Pengeluaran</Text>
              </Button>
            }
          >
            {expenses.length === 0 ? (
              <Text className="text-muted-foreground py-4 text-center text-sm">Belum ada pengeluaran yang dicatat untuk project ini.</Text>
            ) : (
              expenses.map((e) => (
                <View key={e.id} className="border-border flex-row items-center justify-between border-b py-2.5 last:border-b-0">
                  <View className="flex-1 pr-2">
                    <Text className="text-sm font-medium">{e.alasan}</Text>
                    <Text className="text-muted-foreground text-xs">{e.pelapor} · {e.kategori} · {tanggal(e.tanggal)}</Text>
                  </View>
                  <View className="items-end gap-1">
                    <Text className="text-sm font-semibold">{rupiah(e.nominal)}</Text>
                    <StatusBadge status={e.status} />
                  </View>
                </View>
              ))
            )}
          </Panel>
        </View>
      )}

      {/* Tab 7: Riwayat Timeline */}
      {activeTab === "Riwayat" && (
        <Panel title="Riwayat Aktivitas Project">
          <Timeline items={history("projects", project.id)} />
        </Panel>
      )}

      {/* Dialogs & Modals */}
      <FormDialog
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
        title="Tambah Tugas Project"
        fields={[
          { key: "nama", label: "Nama Tugas", type: "text", required: true, placeholder: "Contoh: Penarikan kabel lantai 2" },
          { key: "deskripsi", label: "Deskripsi Tugas", type: "textarea", placeholder: "Detail instruksi / spesifikasi pengerjaan tugas" },
          {
            key: "parentTask",
            label: "Sub-tugas dari (Opsional)",
            type: "select",
            options: ["(Tugas Utama)", ...tasks.filter((t) => !t.parent).map((t) => String(t.nama || t.name)).filter(Boolean)],
          },
          { key: "pic", label: "PIC Tugas", type: "select", required: true, placeholder: "Pilih PIC" },
          { key: "tenggat", label: "Tenggat Waktu", type: "date" },
          { key: "perluBarang", label: "Perlu Pembelian Barang?", type: "select", options: ["Tidak", "Ya"] },
        ]}
        submitLabel="Simpan Tugas"
        onSubmit={(v) => {
          const parentRow =
            v.parentTask && v.parentTask !== "(Tugas Utama)"
              ? tasks.find((t) => (t.nama || t.name) === v.parentTask)
              : undefined;
          addRow("tasks", {
            projectId: project.id,
            project: project.nama || project.name,
            parentId: parentRow?.id,
            nama: v.nama,
            deskripsi: v.deskripsi || undefined,
            pic: v.pic,
            tenggat: v.tenggat || new Date().toISOString().slice(0, 10),
            perluBarang: v.perluBarang === "Ya",
            status: "TODO",
          });
        }}
      />

      <FormDialog
        open={reqModalOpen}
        onOpenChange={setReqModalOpen}
        title="Tambah Kebutuhan Barang Project"
        fields={[
          {
            key: "produk",
            label: "Pilih Barang / Perangkat",
            type: "select",
            required: true,
            options: (data.products ?? []).map((p) => String(p.nama || p.name)).filter(Boolean),
          },
          { key: "qty", label: "Jumlah yang Dibutuhkan", type: "number", required: true, placeholder: "Contoh: 4" },
        ]}
        submitLabel="Cek Stok & Simpan"
        onSubmit={async (v) => {
          const prod = (data.products ?? []).find((p) => (p.nama || p.name) === v.produk);
          if (!prod) return;
          try {
            const res = await api<any>("POST", `/projects/${project.id}/requirements`, {
              productId: Number(prod.id),
              qty: Math.max(1, Math.round(Number(v.qty) || 1)),
            });
            await loadRequirements();
            toast(
              res?.purchaseRequestCreated
                ? "Stok tersedia di-reserve & kekurangan otomatis dibuatkan Request ke Procurement"
                : "Kebutuhan barang dicatat & stok di-reserve",
            );
          } catch (e: any) {
            toast(e?.message ?? "Gagal menyimpan kebutuhan barang", "danger");
          }
        }}
      />

      <FormDialog
        open={returnModalOpen}
        onOpenChange={setReturnModalOpen}
        title="Retur Sisa Material ke Gudang"
        fields={[
          {
            key: "produk",
            label: "Pilih Barang yang Diretur",
            type: "select",
            required: true,
            options: requirements.length > 0
              ? requirements.map((r) => String(r.product?.name ?? r.produk ?? "Barang"))
              : (data.products ?? []).map((p) => String(p.nama || p.name)).filter(Boolean),
          },
          {
            key: "qty",
            label: "Jumlah Sisa yang Dikembalikan",
            type: "number",
            required: true,
            placeholder: "Contoh: 1",
          },
          {
            key: "gudang",
            label: "Gudang Tujuan Pengembalian",
            type: "select",
            required: true,
            options: (data.warehouses ?? []).map((w) => String(w.nama || w.name)),
          },
          {
            key: "catatan",
            label: "Keterangan Retur (Opsional)",
            type: "text",
            placeholder: "Contoh: Sisa instalasi kabel 1 roll tidak terpakai",
          },
        ]}
        submitLabel="Kembalikan ke Gudang"
        onSubmit={async (v) => {
          const prod = (data.products ?? []).find((p) => (p.nama || p.name) === v.produk);
          const wh = (data.warehouses ?? []).find((w) => (w.nama || w.name) === v.gudang) ?? data.warehouses?.[0];
          if (!prod) return;
          try {
            await api("POST", `/projects/${project.id}/return-materials`, {
              warehouseId: wh?.id ? Number(wh.id) : 1,
              items: [
                {
                  productId: Number(prod.id),
                  qty: Math.max(1, Math.round(Number(v.qty) || 1)),
                  note: v.catatan || undefined,
                },
              ],
              reason: v.catatan || `Retur sisa material proyek ${project.nama}`,
            });
            await loadRequirements();
            toast(`Sisa material ${prod.nama} berhasil diretur ke gudang`);
          } catch (e: any) {
            toast(e?.message ?? "Gagal memproses retur barang", "danger");
          }
        }}
      />

      <FormDialog
        open={editProjectOpen}
        onOpenChange={setEditProjectOpen}
        def={MODULES.projects}
        title="Ubah Project"
        fields={[
          ...(MODULES.projects?.createFields || []),
          { key: "progres", label: "Progres Pekerjaan (%)", type: "number", placeholder: "Contoh: 100" },
          { key: "status", label: "Status Project", type: "select", options: ["Berjalan", "Terlambat", "Selesai", "Ditunda"] },
        ]}
        initialRow={{
          ...project,
          progres: project.status === "Selesai" ? "100" : String(project.progres ?? 0),
        }}
        mode="edit"
        submitLabel="Simpan Perubahan"
        onSubmit={(patch) => patchRow("projects", project.id, patch)}
      />

      <ConfirmDialog
        open={deleteProjectOpen}
        onOpenChange={setDeleteProjectOpen}
        title="Hapus project ini?"
        description="Project yang dihapus tidak dapat dikembalikan."
        confirmLabel="Ya, hapus"
        destructive
        onConfirm={() => {
          void deleteRow("projects", project.id).then((ok) => {
            if (ok) router.replace("/projects");
          });
        }}
      />
    </View>
  );
}
