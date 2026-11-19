import * as React from "react";
import { View, ScrollView, Pressable, RefreshControl, Platform, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Wrench,
  Plus,
  Search,
  Calendar,
  AlertTriangle,
  History,
  BarChart3,
  Layers,
  CheckCircle2,
  Clock,
  CalendarDays,
  FileText,
  RotateCcw,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react-native";
import { PageHeader, Panel } from "@/components/taska/basics";
import { colors } from "@/tokens";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import {
  WorkOrderStatusBadge,
  PriorityBadge,
  ScheduleStatusBadge,
  AssetConditionBadge,
  MetricCard,
  MaintenanceTabs,
  EmptyRow,
} from "./components/maintenance-ui";
import { WorkOrderFormDialog } from "./components/work-order-form-dialog";
import { WorkOrderDetailDialog } from "./components/work-order-detail-dialog";
import { MaintenancePlanDialog } from "./components/maintenance-plan-dialog";
import {
  MaintenanceRequestDialog,
  InitialInspectionDialog,
} from "./components/maintenance-request-dialog";
import { MaintenanceRescheduleDialog } from "./components/maintenance-reschedule-dialog";
import { MaintenanceMasterDialog } from "./components/maintenance-master-dialog";
import { MaintenanceReportsPanel } from "./components/maintenance-reports-panel";
import { formatRupiah, formatDate } from "./maintenance-utils";
import type {
  MaintWorkOrder,
  MaintPlan,
  MaintSchedule,
  MaintRequest,
  MaintLookups,
  MaintDashboardData,
  MaintHistory,
} from "./types";

export function MaintenanceScreen() {
  const { toast } = useApp();
  const router = useRouter();

  const [activeTab, setActiveTab] = React.useState<
    "work-orders" | "schedules" | "plans" | "requests" | "history" | "reports" | "field-reports"
  >("work-orders");

  // Data states
  const [loading, setLoading] = React.useState(true);
  const [dashboard, setDashboard] = React.useState<MaintDashboardData | null>(null);
  const [workOrders, setWorkOrders] = React.useState<MaintWorkOrder[]>([]);
  const [schedules, setSchedules] = React.useState<MaintSchedule[]>([]);
  const [requests, setRequests] = React.useState<MaintRequest[]>([]);
  const [plans, setPlans] = React.useState<MaintPlan[]>([]);
  const [historyItems, setHistoryItems] = React.useState<MaintHistory[]>([]);
  const [fieldReports, setFieldReports] = React.useState<any[]>([]);
  const [lookups, setLookups] = React.useState<MaintLookups>({
    assets: [],
    categories: [],
    checklists: [],
    vendors: [],
    users: [],
    products: [],
  });

  // Filters
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");

  // Dialog states
  const [showWoForm, setShowWoForm] = React.useState(false);
  const [editingWo, setEditingWo] = React.useState<MaintWorkOrder | null>(null);

  const [selectedWo, setSelectedWo] = React.useState<MaintWorkOrder | null>(null);
  const [showWoDetail, setShowWoDetail] = React.useState(false);

  const [showPlanDialog, setShowPlanDialog] = React.useState(false);
  const [editingPlan, setEditingPlan] = React.useState<MaintPlan | null>(null);

  const [showRequestDialog, setShowRequestDialog] = React.useState(false);

  const [inspectingRequest, setInspectingRequest] = React.useState<MaintRequest | null>(null);
  const [showInspectDialog, setShowInspectDialog] = React.useState(false);

  const [reschedulingSchedule, setReschedulingSchedule] = React.useState<MaintSchedule | null>(null);
  const [showRescheduleDialog, setShowRescheduleDialog] = React.useState(false);

  const [showMasterDialog, setShowMasterDialog] = React.useState(false);

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [
        dashRes,
        woRes,
        schRes,
        reqRes,
        planRes,
        lookupsRes,
        legacyRes,
      ]: any[] = await Promise.all([
        api.get("/maintenance/dashboard").catch(() => null),
        api.get("/maintenance/work-orders").catch(() => []),
        api.get("/maintenance/schedules").catch(() => []),
        api.get("/maintenance/requests").catch(() => []),
        api.get("/maintenance/plans").catch(() => []),
        api.get("/maintenance/lookups").catch(() => ({})),
        api.get("/maintenance-reports").catch(() => ({ data: [] })),
      ]);

      if (dashRes) setDashboard(dashRes?.data || dashRes);
      setWorkOrders(Array.isArray(woRes?.data) ? woRes.data : Array.isArray(woRes) ? woRes : []);
      setSchedules(Array.isArray(schRes?.data) ? schRes.data : Array.isArray(schRes) ? schRes : []);
      setRequests(Array.isArray(reqRes?.data) ? reqRes.data : Array.isArray(reqRes) ? reqRes : []);
      setPlans(Array.isArray(planRes?.data) ? planRes.data : Array.isArray(planRes) ? planRes : []);

      const l = lookupsRes?.data || lookupsRes || {};
      setLookups({
        assets: l.assets || [],
        categories: l.categories || [],
        checklists: l.checklists || [],
        vendors: l.vendors || [],
        users: l.users || [],
        products: l.products || [],
      });

      const leg = legacyRes?.data || (Array.isArray(legacyRes) ? legacyRes : []);
      setFieldReports(leg);
    } catch (e: any) {
      toast(e?.message || "Gagal memuat data maintenance", "danger");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void Promise.resolve().then(loadData);
  }, [loadData]);

  // Work Order actions
  const handleCreateWo = async (payload: any) => {
    if (editingWo) {
      await api.patch(`/maintenance/work-orders/${editingWo.id}`, payload);
      toast("Work Order berhasil diperbarui", "success");
    } else {
      await api.post("/maintenance/work-orders", payload);
      toast("Work Order berhasil dibuat", "success");
    }
    loadData();
  };

  const handleDeleteWo = async (wo: MaintWorkOrder) => {
    const doDelete = async () => {
      try {
        await api.delete(`/maintenance/work-orders/${wo.id}`);
        toast("Work Order berhasil dihapus", "success");
        loadData();
      } catch (e: any) {
        toast(e?.message || "Gagal menghapus Work Order", "danger");
      }
    };

    if (Platform.OS === "web") {
      if (confirm(`Hapus Work Order #${wo.workOrderNumber}?`)) doDelete();
    } else {
      Alert.alert("Hapus Work Order", `Hapus Work Order #${wo.workOrderNumber}?`, [
        { text: "Batal", style: "cancel" },
        { text: "Hapus", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const handleOpenWoDetail = async (wo: MaintWorkOrder) => {
    try {
      const res: any = await api.get(`/maintenance/work-orders/${wo.id}`);
      setSelectedWo(res?.data || res);
      setShowWoDetail(true);
    } catch {
      setSelectedWo(wo);
      setShowWoDetail(true);
    }
  };

  const handleUpdateWoStatus = async (id: number, status: string, notes?: string) => {
    await api.patch(`/maintenance/work-orders/${id}/status`, { status, notes });
    toast(`Status WO diperbarui ke ${status}`, "success");
    const updated: any = await api.get(`/maintenance/work-orders/${id}`);
    setSelectedWo(updated?.data || updated);
    loadData();
  };

  const handleAddTask = async (id: number, task: any) => {
    await api.post(`/maintenance/work-orders/${id}/tasks`, task);
    const updated: any = await api.get(`/maintenance/work-orders/${id}`);
    setSelectedWo(updated?.data || updated);
  };

  const handleUpdateTask = async (taskId: number, data: any) => {
    if (!selectedWo) return;
    await api.patch(`/maintenance/work-orders/${selectedWo.id}/tasks/${taskId}`, data);
    const updated: any = await api.get(`/maintenance/work-orders/${selectedWo.id}`);
    setSelectedWo(updated?.data || updated);
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!selectedWo) return;
    await api.delete(`/maintenance/work-orders/${selectedWo.id}/tasks/${taskId}`);
    const updated: any = await api.get(`/maintenance/work-orders/${selectedWo.id}`);
    setSelectedWo(updated?.data || updated);
  };

  const handleUpdateChecklist = async (checklistId: number, data: any) => {
    if (!selectedWo) return;
    await api.patch(`/maintenance/work-orders/${selectedWo.id}/checklists/${checklistId}`, data);
    const updated: any = await api.get(`/maintenance/work-orders/${selectedWo.id}`);
    setSelectedWo(updated?.data || updated);
  };

  const handleAddMaterial = async (id: number, material: any) => {
    await api.post(`/maintenance/work-orders/${id}/materials`, material);
    const updated: any = await api.get(`/maintenance/work-orders/${id}`);
    setSelectedWo(updated?.data || updated);
    loadData();
  };

  const handleDeleteMaterial = async (materialId: number) => {
    if (!selectedWo) return;
    await api.delete(`/maintenance/work-orders/${selectedWo.id}/materials/${materialId}`);
    const updated: any = await api.get(`/maintenance/work-orders/${selectedWo.id}`);
    setSelectedWo(updated?.data || updated);
    loadData();
  };

  const handleAddLabor = async (id: number, labor: any) => {
    await api.post(`/maintenance/work-orders/${id}/labor`, labor);
    const updated: any = await api.get(`/maintenance/work-orders/${id}`);
    setSelectedWo(updated?.data || updated);
    loadData();
  };

  const handleDeleteLabor = async (laborId: number) => {
    if (!selectedWo) return;
    await api.delete(`/maintenance/work-orders/${selectedWo.id}/labor/${laborId}`);
    const updated: any = await api.get(`/maintenance/work-orders/${selectedWo.id}`);
    setSelectedWo(updated?.data || updated);
    loadData();
  };

  const handleAddCost = async (id: number, cost: any) => {
    await api.post(`/maintenance/work-orders/${id}/costs`, cost);
    const updated: any = await api.get(`/maintenance/work-orders/${id}`);
    setSelectedWo(updated?.data || updated);
    loadData();
  };

  const handleDeleteCost = async (costId: number) => {
    if (!selectedWo) return;
    await api.delete(`/maintenance/work-orders/${selectedWo.id}/costs/${costId}`);
    const updated: any = await api.get(`/maintenance/work-orders/${selectedWo.id}`);
    setSelectedWo(updated?.data || updated);
    loadData();
  };

  const handleRecordDowntime = async (id: number, downtime: any) => {
    await api.post(`/maintenance/work-orders/${id}/downtime`, downtime);
    const updated: any = await api.get(`/maintenance/work-orders/${id}`);
    setSelectedWo(updated?.data || updated);
    loadData();
  };

  const handleAddAttachment = async (id: number, attachment: any) => {
    await api.post(`/maintenance/work-orders/${id}/attachments`, attachment);
    const updated: any = await api.get(`/maintenance/work-orders/${id}`);
    setSelectedWo(updated?.data || updated);
  };

  const handleVerify = async (id: number, verificationNotes: string) => {
    await api.post(`/maintenance/work-orders/${id}/verify`, { verificationNotes });
    toast("Work Order berhasil diverifikasi oleh supervisor", "success");
    const updated: any = await api.get(`/maintenance/work-orders/${id}`);
    setSelectedWo(updated?.data || updated);
    loadData();
  };

  const handleCloseWo = async (id: number, finalAssetStatus: string, notes?: string) => {
    await api.post(`/maintenance/work-orders/${id}/close`, { finalAssetStatus, closingNotes: notes });
    toast("Work Order resmi ditutup dan dicatat ke histori aset", "success");
    loadData();
  };

  const handleEvaluateCapitalization = async (id: number, approved: boolean, notes?: string) => {
    await api.post(`/maintenance/work-orders/${id}/capitalize`, { approved, notes });
    toast(approved ? "Kapitalisasi disetujui (nilai buku bertambah)" : "Kapitalisasi dibatalkan", "success");
    const updated: any = await api.get(`/maintenance/work-orders/${id}`);
    setSelectedWo(updated?.data || updated);
    loadData();
  };

  // Plan actions
  const handleSavePlan = async (payload: any) => {
    if (editingPlan) {
      await api.patch(`/maintenance/plans/${editingPlan.id}`, payload);
      toast("Rencana maintenance diperbarui", "success");
    } else {
      await api.post("/maintenance/plans", payload);
      toast("Rencana maintenance baru berhasil disimpan", "success");
    }
    loadData();
  };

  const handleDeletePlan = async (plan: MaintPlan) => {
    const doDelete = async () => {
      try {
        await api.delete(`/maintenance/plans/${plan.id}`);
        toast("Rencana servis berhasil dihapus", "success");
        loadData();
      } catch (e: any) {
        toast(e?.message || "Gagal menghapus rencana servis", "danger");
      }
    };

    if (Platform.OS === "web") {
      if (confirm(`Hapus rencana servis "${plan.title}"?`)) doDelete();
    } else {
      Alert.alert("Hapus Rencana Servis", `Hapus "${plan.title}"?`, [
        { text: "Batal", style: "cancel" },
        { text: "Hapus", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const handleGenerateSchedules = async (plan: MaintPlan) => {
    try {
      await api.post(`/maintenance/plans/${plan.id}/generate-schedules`, {});
      toast(`Jadwal servis untuk "${plan.title}" berhasil di-generate!`, "success");
      loadData();
    } catch (e: any) {
      toast(e?.message || "Gagal membuat jadwal servis", "danger");
    }
  };

  // Request actions
  const handleSaveRequest = async (payload: any) => {
    await api.post("/maintenance/requests", payload);
    toast("Laporan kerusakan berhasil dikirim", "success");
    loadData();
  };

  const handleDeleteRequest = async (req: MaintRequest) => {
    const doDelete = async () => {
      try {
        await api.delete(`/maintenance/requests/${req.id}`);
        toast("Laporan kerusakan berhasil dihapus", "success");
        loadData();
      } catch (e: any) {
        toast(e?.message || "Gagal menghapus laporan kerusakan", "danger");
      }
    };

    if (Platform.OS === "web") {
      if (confirm(`Hapus laporan kerusakan #${req.requestNumber}?`)) doDelete();
    } else {
      Alert.alert("Hapus Laporan", `Hapus #${req.requestNumber}?`, [
        { text: "Batal", style: "cancel" },
        { text: "Hapus", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const handleInspectRequest = async (
    id: number,
    notes: string,
    decision: "APPROVED" | "REJECTED",
    reason?: string,
  ) => {
    await api.post(`/maintenance/requests/${id}/inspect`, {
      initialInspectionNotes: notes,
      decision,
      rejectionReason: reason,
    });
    toast(decision === "APPROVED" ? "Inspeksi disetujui" : "Permintaan ditolak", "success");
    loadData();
  };

  const handleCreateWoFromRequest = async (id: number) => {
    await api.post(`/maintenance/requests/${id}/create-work-order`, {});
    toast("Work Order perbaikan berhasil dibuat otomatis", "success");
    loadData();
  };

  // Schedule actions
  const handleReschedule = async (id: number, newDate: string, reason: string) => {
    await api.post(`/maintenance/schedules/${id}/reschedule`, { newDate, reason });
    toast("Jadwal servis berhasil diperbarui", "success");
    loadData();
  };

  const handleDeleteSchedule = async (sch: MaintSchedule) => {
    const doDelete = async () => {
      try {
        await api.delete(`/maintenance/schedules/${sch.id}`);
        toast("Jadwal servis berhasil dibatalkan / dihapus", "success");
        loadData();
      } catch (e: any) {
        toast(e?.message || "Gagal menghapus jadwal servis", "danger");
      }
    };

    if (Platform.OS === "web") {
      if (confirm(`Hapus jadwal #${sch.scheduleNumber}?`)) doDelete();
    } else {
      Alert.alert("Hapus Jadwal", `Hapus #${sch.scheduleNumber}?`, [
        { text: "Batal", style: "cancel" },
        { text: "Hapus", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  // Filtered Work Orders
  const filteredWorkOrders = workOrders.filter((wo) => {
    if (statusFilter !== "ALL" && wo.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchWo = wo.workOrderNumber.toLowerCase().includes(q);
      const matchAsset = wo.asset?.name?.toLowerCase().includes(q) || wo.asset?.assetCode?.toLowerCase().includes(q);
      const matchProb = wo.problemDescription?.toLowerCase().includes(q);
      return matchWo || matchAsset || matchProb;
    }
    return true;
  });

  const activeWoCount = workOrders.filter(
    (w) => !["COMPLETED", "VERIFIED", "CLOSED", "CANCELLED"].includes(w.status),
  ).length;

  const overdueScheduleCount = schedules.filter((s) => s.status === "OVERDUE").length;
  const pendingRequestCount = requests.filter((r) => r.status === "PENDING_APPROVAL").length;

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingBottom: 36 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
    >
      <View className="gap-4 p-4 sm:p-6">
        <PageHeader
          title="Maintenance Management (EAM)"
          subtitle="Manajemen pemeliharaan, servis berkala, perbaikan aset operasional & Work Order"
          onRefresh={loadData}
          action={
            <View className="flex-row flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onPress={() => setShowMasterDialog(true)}
              >
                <Layers size={14} color={colors.primary} />
                <Text className="text-xs">Master Data</Text>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onPress={() => {
                  setEditingPlan(null);
                  setShowPlanDialog(true);
                }}
              >
                <CalendarDays size={14} color={colors.primary} />
                <Text className="text-xs">+ Rencana Servis</Text>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onPress={() => setShowRequestDialog(true)}
              >
                <AlertTriangle size={14} color={colors.warning} />
                <Text className="text-xs">+ Lapor Kerusakan</Text>
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onPress={() => {
                  setEditingWo(null);
                  setShowWoForm(true);
                }}
              >
                <Plus size={14} color="#fff" />
                <Text className="text-xs text-white">+ Buat Work Order</Text>
              </Button>
            </View>
          }
        />

        {/* KPI Dashboard Cards */}
        <View className="flex-row flex-wrap gap-3">
          <MetricCard
            label="Work Order Aktif"
            value={`${activeWoCount} WO`}
            hint={`Total ${workOrders.length} Work Order tercatat`}
            color={colors.primary}
            icon={Wrench}
            onPress={() => setActiveTab("work-orders")}
          />
          <MetricCard
            label="PM Compliance Rate"
            value={`${dashboard?.kpi?.pmCompliance ?? 100}%`}
            hint="Kepatuhan jadwal servis preventif"
            color={colors.success}
            icon={CheckCircle2}
            onPress={() => setActiveTab("schedules")}
          />
          <MetricCard
            label="Jadwal Overdue"
            value={`${overdueScheduleCount} Servis`}
            hint={`${schedules.length} jadwal servis terdaftar`}
            color={colors.warning}
            icon={Clock}
            onPress={() => setActiveTab("schedules")}
          />
          <MetricCard
            label="Laporan Kerusakan"
            value={`${pendingRequestCount} Laporan`}
            hint="Menunggu inspeksi dan approval WO"
            color={colors.danger}
            icon={AlertTriangle}
            onPress={() => setActiveTab("requests")}
          />
          <MetricCard
            label="Total Biaya Servis"
            value={formatRupiah(dashboard?.kpi?.monthlyTotalCost ?? 0)}
            hint="Akumulasi biaya suku cadang & jasa"
            color={colors.primary}
            icon={RotateCcw}
            onPress={() => setActiveTab("reports")}
          />
        </View>

        {/* Main Navigation Tabs */}
        <MaintenanceTabs
          value={activeTab}
          onChange={(val) => setActiveTab(val as any)}
          tabs={[
            { value: "work-orders", label: "Work Orders", count: workOrders.length, icon: Wrench },
            { value: "schedules", label: "Jadwal & Kalender", count: schedules.length, icon: Calendar },
            { value: "plans", label: "Rencana Servis (PM)", count: plans.length, icon: CalendarDays },
            { value: "requests", label: "Laporan Kerusakan", count: requests.length, icon: AlertTriangle },
            { value: "history", label: "Histori & Downtime", count: lookups.assets.length, icon: History },
            { value: "reports", label: "10 Laporan & KPI", icon: BarChart3 },
            { value: "field-reports", label: "Laporan Lapangan & Proyek", count: fieldReports.length, icon: FileText },
          ]}
        />

        {/* 1. WORK ORDERS TAB */}
        {activeTab === "work-orders" && (
          <Panel
            title="Daftar Work Order Pemeliharaan"
            subtitle="Kelola tiket perbaikan, penugasan teknisi, pengerjaan checklist, dan realisasi biaya"
            icon={Wrench}
            right={
              <Button variant="outline" size="sm" className="gap-1.5" onPress={loadData}>
                <RotateCcw size={13} color={colors.primary} />
                <Text className="text-xs">Muat Ulang</Text>
              </Button>
            }
          >
            <View className="gap-3">
              {/* Filter Bar */}
              <View className="flex-row flex-wrap items-center gap-2">
                <View className="min-w-[240px] flex-1">
                  <View className="relative justify-center">
                    <Input
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder="Cari nomor WO, nama aset, atau deskripsi..."
                      className="pl-8"
                    />
                    <View className="absolute left-2.5">
                      <Search size={14} color={colors.muted} />
                    </View>
                  </View>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-1">
                    {[
                      { value: "ALL", label: "Semua Status" },
                      { value: "DRAFT", label: "Draft" },
                      { value: "PENDING_APPROVAL", label: "Menunggu Approval" },
                      { value: "APPROVED", label: "Disetujui" },
                      { value: "ASSIGNED", label: "Ditugaskan" },
                      { value: "IN_PROGRESS", label: "Dikerjakan" },
                      { value: "COMPLETED", label: "Selesai" },
                      { value: "VERIFIED", label: "Terverifikasi" },
                      { value: "CLOSED", label: "Ditutup" },
                    ].map((st) => {
                      const active = statusFilter === st.value;
                      return (
                        <Pressable
                          key={st.value}
                          onPress={() => setStatusFilter(st.value)}
                          className={`rounded-lg px-2.5 py-1.5 ${
                            active ? "bg-primary" : "bg-muted/40 hover:bg-muted"
                          }`}
                        >
                          <Text
                            className={`text-xs font-semibold ${
                              active ? "text-white" : "text-muted-foreground"
                            }`}
                          >
                            {st.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>

              {/* Work Orders Table */}
              <View className="overflow-hidden rounded-xl border border-border/80 bg-card">
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ minWidth: "100%" }}
                >
                  <View className="min-w-[1060px] flex-1">
                    <View className="flex-row items-center border-b border-border/70 bg-muted/60 px-3.5 py-2.5">
                      <Text className="w-[140px] text-[11px] font-bold uppercase text-muted-foreground">
                        Nomor WO
                      </Text>
                      <Text className="flex-[1.5] text-[11px] font-bold uppercase text-muted-foreground">
                        Aset & Masalah
                      </Text>
                      <Text className="flex-[1.2] text-[11px] font-bold uppercase text-muted-foreground">
                        PIC & Lokasi
                      </Text>
                      <Text className="w-[165px] text-[11px] font-bold uppercase text-muted-foreground">
                        Rencana Pengerjaan
                      </Text>
                      <Text className="w-[130px] text-[11px] font-bold uppercase text-muted-foreground">
                        Total Biaya
                      </Text>
                      <Text className="w-[130px] text-[11px] font-bold uppercase text-muted-foreground">
                        Status
                      </Text>
                      <Text className="w-[110px] text-[11px] font-bold uppercase text-muted-foreground">
                        Prioritas
                      </Text>
                      <Text className="w-[140px] text-right text-[11px] font-bold uppercase text-muted-foreground">
                        Aksi
                      </Text>
                    </View>

                    {filteredWorkOrders.length === 0 ? (
                      <EmptyRow text="Tidak ada Work Order yang sesuai filter pencarian." />
                    ) : (
                      <View className="divide-y divide-border/40">
                        {filteredWorkOrders.map((wo) => (
                          <Pressable
                            key={wo.id}
                            onPress={() => handleOpenWoDetail(wo)}
                            className="flex-row items-center px-3.5 py-3 hover:bg-muted/20"
                          >
                            <View className="w-[140px] pr-2">
                              <Text className="font-mono text-xs font-bold text-primary">
                                #{wo.workOrderNumber}
                              </Text>
                              <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                                {wo.maintenanceType}
                              </Text>
                            </View>

                            <View className="flex-[1.5] pr-3">
                              <Text className="text-xs font-bold text-foreground" numberOfLines={1}>
                                {wo.asset?.name || "Aset"}
                              </Text>
                              <Text className="mt-0.5 text-[11px] text-muted-foreground" numberOfLines={1}>
                                {wo.asset?.assetCode} · {wo.problemDescription}
                              </Text>
                            </View>

                            <View className="flex-[1.2] pr-3">
                              <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
                                {wo.assignedToUser?.name || "Belum Ditugaskan"}
                              </Text>
                              <Text className="mt-0.5 text-[11px] text-muted-foreground" numberOfLines={1}>
                                {wo.asset?.location?.name || "-"}
                              </Text>
                            </View>

                            <View className="w-[165px] pr-2">
                              <Text className="text-xs font-medium text-foreground">
                                {formatDate(wo.plannedStartDate)}
                              </Text>
                              <Text className="text-[11px] text-muted-foreground">
                                s/d {formatDate(wo.plannedFinishDate)}
                              </Text>
                            </View>

                            <View className="w-[130px] pr-2">
                              <Text className="text-xs font-bold text-primary">
                                {formatRupiah(wo.totalCost)}
                              </Text>
                            </View>

                            <View className="w-[130px] pr-2">
                              <WorkOrderStatusBadge status={wo.status} />
                            </View>

                            <View className="w-[110px] pr-2">
                              <PriorityBadge priority={wo.priority} />
                            </View>

                            <View className="w-[140px] flex-row items-center justify-end gap-1.5">
                              <Tooltip delayDuration={150}>
                                <TooltipTrigger
                                  onPress={() => handleOpenWoDetail(wo)}
                                  className="rounded-md border border-border p-1.5 hover:bg-muted/60"
                                >
                                  <Eye size={13} color={colors.primary} />
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <Text>Lihat Detail WO</Text>
                                </TooltipContent>
                              </Tooltip>

                              {wo.status === "DRAFT" ? (
                                <Tooltip delayDuration={150}>
                                  <TooltipTrigger
                                    onPress={(e) => {
                                      e.stopPropagation?.();
                                      setEditingWo(wo);
                                      setShowWoForm(true);
                                    }}
                                    className="rounded-md border border-border p-1.5 hover:bg-muted/60"
                                  >
                                    <Pencil size={13} color={colors.primary} />
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    <Text>Edit Work Order</Text>
                                  </TooltipContent>
                                </Tooltip>
                              ) : null}

                              {(wo.status === "DRAFT" || wo.status === "CANCELLED") && (
                                <Tooltip delayDuration={150}>
                                  <TooltipTrigger
                                    onPress={(e) => {
                                      e.stopPropagation?.();
                                      handleDeleteWo(wo);
                                    }}
                                    className="rounded-md border border-destructive/30 bg-destructive/10 p-1.5 hover:bg-destructive/20"
                                  >
                                    <Trash2 size={13} color="#dc2626" />
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    <Text>Hapus Work Order</Text>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </View>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                </ScrollView>
              </View>
            </View>
          </Panel>
        )}

        {/* 2. SCHEDULES & CALENDAR TAB */}
        {activeTab === "schedules" && (
          <Panel
            title="Jadwal Servis Berkala Aset (Preventive Maintenance)"
            subtitle="Kalender dan jadwal jatuh tempo servis rutin aset operasional"
            icon={Calendar}
            right={
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onPress={() => {
                  setEditingPlan(null);
                  setShowPlanDialog(true);
                }}
              >
                <Plus size={14} color={colors.primary} />
                <Text className="text-xs">+ Rencana Servis</Text>
              </Button>
            }
          >
            <View className="overflow-hidden rounded-xl border border-border/80 bg-card">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ minWidth: "100%" }}
              >
                <View className="min-w-[1060px] flex-1">
                  <View className="flex-row items-center border-b border-border/70 bg-muted/60 px-3.5 py-2.5">
                    <Text className="w-[140px] text-[11px] font-bold uppercase text-muted-foreground">
                      Nomor Jadwal
                    </Text>
                    <Text className="flex-[1.5] text-[11px] font-bold uppercase text-muted-foreground">
                      Rencana & Aset
                    </Text>
                    <Text className="flex-[1.2] text-[11px] font-bold uppercase text-muted-foreground">
                      Lokasi & PIC
                    </Text>
                    <Text className="w-[165px] text-[11px] font-bold uppercase text-muted-foreground">
                      Jatuh Tempo Servis
                    </Text>
                    <Text className="w-[130px] text-[11px] font-bold uppercase text-muted-foreground">
                      Status
                    </Text>
                    <Text className="w-[110px] text-[11px] font-bold uppercase text-muted-foreground">
                      Prioritas
                    </Text>
                    <Text className="w-[160px] text-right text-[11px] font-bold uppercase text-muted-foreground">
                      Aksi
                    </Text>
                  </View>

                  {schedules.length === 0 ? (
                    <EmptyRow text="Belum ada jadwal servis yang terdaftar." />
                  ) : (
                    <View className="divide-y divide-border/40">
                      {schedules.map((sch) => (
                        <View
                          key={sch.id}
                          className="flex-row items-center px-3.5 py-3 hover:bg-muted/20"
                        >
                          <View className="w-[140px] pr-2">
                            <Text className="font-mono text-xs font-bold text-primary">
                              {sch.scheduleNumber}
                            </Text>
                            <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                              {sch.maintenanceType || "PREVENTIVE"}
                            </Text>
                          </View>

                          <View className="flex-[1.5] pr-3">
                            <Text className="text-xs font-bold text-foreground" numberOfLines={1}>
                              {sch.asset?.name || "Aset"}
                            </Text>
                            <Text className="mt-0.5 text-[11px] text-muted-foreground" numberOfLines={1}>
                              {sch.asset?.assetCode} · {sch.plan?.title || "Preventive Maintenance"}
                            </Text>
                          </View>

                          <View className="flex-[1.2] pr-3">
                            <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
                              {sch.assignedUser?.name || "Belum Ditugaskan"}
                            </Text>
                            <Text className="mt-0.5 text-[11px] text-muted-foreground" numberOfLines={1}>
                              {sch.asset?.location?.name || "-"}
                            </Text>
                          </View>

                          <View className="w-[165px] pr-2">
                            <Text className="text-xs font-bold text-foreground">
                              {formatDate(sch.scheduledDate)}
                            </Text>
                            {sch.rescheduleReason && (
                              <Text className="mt-0.5 text-[11px] text-amber-600 italic" numberOfLines={1}>
                                Rescheduled: {sch.rescheduleReason}
                              </Text>
                            )}
                          </View>

                          <View className="w-[130px] pr-2">
                            <ScheduleStatusBadge status={sch.status} />
                          </View>

                          <View className="w-[110px] pr-2">
                            <PriorityBadge priority={sch.priority} />
                          </View>

                          <View className="w-[160px] flex-row items-center justify-end gap-1.5">
                            <Tooltip delayDuration={150}>
                              <TooltipTrigger
                                onPress={() => {
                                  setReschedulingSchedule(sch);
                                  setShowRescheduleDialog(true);
                                }}
                                className="rounded-md border border-border p-1.5 hover:bg-muted/60"
                              >
                                <RotateCcw size={13} color={colors.primary} />
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <Text>Reschedule Tanggal</Text>
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip delayDuration={150}>
                              <TooltipTrigger
                                onPress={() => {
                                  setEditingWo(null);
                                  setShowWoForm(true);
                                }}
                                className="rounded-md border border-primary/40 bg-primary/10 p-1.5 hover:bg-primary/20"
                              >
                                <Wrench size={13} color={colors.primary} />
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <Text>Buat Work Order</Text>
                              </TooltipContent>
                            </Tooltip>

                            {sch.status !== "COMPLETED" && (
                              <Tooltip delayDuration={150}>
                                <TooltipTrigger
                                  onPress={() => handleDeleteSchedule(sch)}
                                  className="rounded-md border border-destructive/30 bg-destructive/10 p-1.5 hover:bg-destructive/20"
                                >
                                  <Trash2 size={13} color="#dc2626" />
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <Text>Batalkan / Hapus Jadwal</Text>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </ScrollView>
            </View>
          </Panel>
        )}

        {/* 3. PLANS TAB (MASTER RENCANA SERVIS PREVENTIF) */}
        {activeTab === "plans" && (
          <Panel
            title="Master Rencana Servis Preventif (PM Plans)"
            subtitle="Konfigurasi jadwal pemeliharaan berkala, interval waktu (Bulan/Tahun/KM), template checklist SOP, horizon & auto-schedule"
            icon={CalendarDays}
            right={
              <Button
                size="sm"
                className="gap-1.5"
                onPress={() => {
                  setEditingPlan(null);
                  setShowPlanDialog(true);
                }}
              >
                <Plus size={14} color="#fff" />
                <Text className="text-xs text-white">+ Buat Rencana Servis</Text>
              </Button>
            }
          >
            <View className="overflow-hidden rounded-xl border border-border/80 bg-card">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ minWidth: "100%" }}
              >
                <View className="min-w-[1100px] flex-1">
                  <View className="flex-row items-center border-b border-border/70 bg-muted/60 px-3.5 py-2.5">
                    <Text className="w-[140px] text-[11px] font-bold uppercase text-muted-foreground">
                      Nomor Rencana
                    </Text>
                    <Text className="flex-[1.6] text-[11px] font-bold uppercase text-muted-foreground">
                      Judul & Kategori
                    </Text>
                    <Text className="flex-[1.2] text-[11px] font-bold uppercase text-muted-foreground">
                      Metode & Interval
                    </Text>
                    <Text className="w-[160px] text-[11px] font-bold uppercase text-muted-foreground">
                      Checklist SOP
                    </Text>
                    <Text className="w-[130px] text-[11px] font-bold uppercase text-muted-foreground">
                      Aset Terpasang
                    </Text>
                    <Text className="w-[140px] text-[11px] font-bold uppercase text-muted-foreground">
                      Auto-Generate
                    </Text>
                    <Text className="w-[160px] text-right text-[11px] font-bold uppercase text-muted-foreground">
                      Aksi
                    </Text>
                  </View>

                  {plans.length === 0 ? (
                    <EmptyRow text="Belum ada rencana servis preventif terdaftar." />
                  ) : (
                    <View className="divide-y divide-border/40">
                      {plans.map((pln) => (
                        <View
                          key={pln.id}
                          className="flex-row items-center px-3.5 py-3 hover:bg-muted/20"
                        >
                          <View className="w-[140px] pr-2">
                            <Text className="font-mono text-xs font-bold text-primary">
                              {pln.planNumber}
                            </Text>
                            <Text className="text-[11px] text-muted-foreground">
                              PIC: {pln.picUser?.name || "General"}
                            </Text>
                          </View>

                          <View className="flex-[1.6] pr-3">
                            <Text className="text-xs font-bold text-foreground">
                              {pln.title}
                            </Text>
                            <Text className="mt-0.5 text-[11px] text-muted-foreground">
                              {pln.category?.name || "Kategori Umum"}
                            </Text>
                          </View>

                          <View className="flex-[1.2] pr-3">
                            <View className="self-start rounded-full border border-border bg-muted/40 px-2 py-0.5">
                              <Text className="text-[10px] font-semibold text-foreground">
                                {pln.method}
                              </Text>
                            </View>
                            <Text className="mt-0.5 text-[11px] text-muted-foreground">
                              Setiap {pln.intervalValue} {pln.intervalUnit}
                            </Text>
                          </View>

                          <View className="w-[160px] pr-2">
                            <Text className="text-xs font-medium text-foreground" numberOfLines={1}>
                              {pln.checklist?.name || "-"}
                            </Text>
                            <Text className="text-[11px] text-muted-foreground">
                              {pln.checklist?.items?.length || 0} item pemeriksaan
                            </Text>
                          </View>

                          <View className="w-[130px] pr-2">
                            <Text className="text-xs font-semibold text-foreground">
                              {pln.assets?.length || 0} Aset
                            </Text>
                          </View>

                          <View className="w-[140px] pr-2">
                            <View
                              className={`self-start rounded-full border px-2 py-0.5 ${
                                pln.autoGenerate
                                  ? "bg-emerald-500/10 border-emerald-500/30"
                                  : "bg-muted/50 border-border"
                              }`}
                            >
                              <Text className={`text-[10px] font-semibold ${pln.autoGenerate ? "text-emerald-600" : "text-muted-foreground"}`}>
                                {pln.autoGenerate ? `Aktif (${pln.generationHorizon || "1 Siklus"})` : "Manual"}
                              </Text>
                            </View>
                          </View>

                          <View className="w-[160px] flex-row items-center justify-end gap-1.5">
                            <Tooltip delayDuration={150}>
                              <TooltipTrigger
                                onPress={() => handleGenerateSchedules(pln)}
                                className="rounded-md border border-primary/40 bg-primary/10 p-1.5 hover:bg-primary/20"
                              >
                                <RotateCcw size={13} color={colors.primary} />
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <Text>Generate Jadwal Servis</Text>
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip delayDuration={150}>
                              <TooltipTrigger
                                onPress={() => {
                                  setEditingPlan(pln);
                                  setShowPlanDialog(true);
                                }}
                                className="rounded-md border border-border p-1.5 hover:bg-muted/60"
                              >
                                <Pencil size={13} color={colors.primary} />
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <Text>Edit Rencana</Text>
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip delayDuration={150}>
                              <TooltipTrigger
                                onPress={() => handleDeletePlan(pln)}
                                className="rounded-md border border-destructive/30 bg-destructive/10 p-1.5 hover:bg-destructive/20"
                              >
                                <Trash2 size={13} color="#dc2626" />
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <Text>Hapus Rencana</Text>
                              </TooltipContent>
                            </Tooltip>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </ScrollView>
            </View>
          </Panel>
        )}

        {/* 4. REQUESTS TAB (CORRECTIVE) */}
        {activeTab === "requests" && (
          <Panel
            title="Permintaan & Laporan Kerusakan Aset (Corrective Maintenance)"
            subtitle="Daftar laporan kerusakan dari staf/operator untuk diinspeksi supervisor dan dibuatkan Work Order"
            icon={AlertTriangle}
            right={
              <Button
                size="sm"
                className="gap-1.5"
                onPress={() => setShowRequestDialog(true)}
              >
                <Plus size={14} color="#fff" />
                <Text className="text-xs text-white">+ Lapor Kerusakan</Text>
              </Button>
            }
          >
            <View className="overflow-hidden rounded-xl border border-border/80 bg-card">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ minWidth: "100%" }}
              >
                <View className="min-w-[1060px] flex-1">
                  <View className="flex-row items-center border-b border-border/70 bg-muted/60 px-3.5 py-2.5">
                    <Text className="w-[140px] text-[11px] font-bold uppercase text-muted-foreground">
                      Nomor Laporan
                    </Text>
                    <Text className="flex-[1.5] text-[11px] font-bold uppercase text-muted-foreground">
                      Aset & Kerusakan
                    </Text>
                    <Text className="flex-[1.2] text-[11px] font-bold uppercase text-muted-foreground">
                      Pelapor & Lokasi
                    </Text>
                    <Text className="w-[150px] text-[11px] font-bold uppercase text-muted-foreground">
                      Tanggal Lapor
                    </Text>
                    <Text className="w-[130px] text-[11px] font-bold uppercase text-muted-foreground">
                      Status
                    </Text>
                    <Text className="w-[110px] text-[11px] font-bold uppercase text-muted-foreground">
                      Urgensi
                    </Text>
                    <Text className="w-[160px] text-right text-[11px] font-bold uppercase text-muted-foreground">
                      Aksi
                    </Text>
                  </View>

                  {requests.length === 0 ? (
                    <EmptyRow text="Belum ada laporan kerusakan yang masuk." />
                  ) : (
                    <View className="divide-y divide-border/40">
                      {requests.map((req) => (
                        <View
                          key={req.id}
                          className="flex-row items-center px-3.5 py-3 hover:bg-muted/20"
                        >
                          <View className="w-[140px] pr-2">
                            <Text className="font-mono text-xs font-bold text-primary">
                              #{req.requestNumber}
                            </Text>
                          </View>

                          <View className="flex-[1.5] pr-3">
                            <Text className="text-xs font-bold text-foreground" numberOfLines={1}>
                              {req.asset?.name || "Aset"}
                            </Text>
                            <Text className="mt-0.5 text-[11px] text-muted-foreground" numberOfLines={1}>
                              {req.asset?.assetCode} · {req.problemDescription}
                            </Text>
                          </View>

                          <View className="flex-[1.2] pr-3">
                            <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
                              {req.reporterUser?.name || "Staf"}
                            </Text>
                            <Text className="mt-0.5 text-[11px] text-muted-foreground" numberOfLines={1}>
                              {req.asset?.location?.name || "-"}
                            </Text>
                          </View>

                          <View className="w-[150px] pr-2">
                            <Text className="text-xs font-medium text-foreground">
                              {formatDate(req.requestDate)}
                            </Text>
                          </View>

                          <View className="w-[130px] pr-2">
                            <View
                              className={`self-start rounded-full border px-2.5 py-0.5 ${
                                req.status === "APPROVED" || req.status === "WORK_ORDER_CREATED"
                                  ? "bg-emerald-500/10 border-emerald-500/30"
                                  : req.status === "REJECTED"
                                    ? "bg-destructive/10 border-destructive/30"
                                    : "bg-amber-500/10 border-amber-500/30"
                              }`}
                            >
                              <Text
                                className={`text-[11px] font-semibold ${
                                  req.status === "APPROVED" || req.status === "WORK_ORDER_CREATED"
                                    ? "text-emerald-600"
                                    : req.status === "REJECTED"
                                      ? "text-destructive"
                                      : "text-amber-600"
                                }`}
                              >
                                {req.status}
                              </Text>
                            </View>
                          </View>

                          <View className="w-[110px] pr-2">
                            <PriorityBadge priority={req.urgency} />
                          </View>

                          <View className="w-[160px] flex-row items-center justify-end gap-1.5">
                            {req.status === "PENDING_APPROVAL" ? (
                              <Tooltip delayDuration={150}>
                                <TooltipTrigger
                                  onPress={() => {
                                    setInspectingRequest(req);
                                    setShowInspectDialog(true);
                                  }}
                                  className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-1.5 hover:bg-emerald-500/20"
                                >
                                  <CheckCircle2 size={13} color="#059669" />
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <Text>Inspeksi & Buat WO</Text>
                                </TooltipContent>
                              </Tooltip>
                            ) : null}

                            {(req.status === "PENDING_APPROVAL" || req.status === "REJECTED") && (
                              <Tooltip delayDuration={150}>
                                <TooltipTrigger
                                  onPress={() => handleDeleteRequest(req)}
                                  className="rounded-md border border-destructive/30 bg-destructive/10 p-1.5 hover:bg-destructive/20"
                                >
                                  <Trash2 size={13} color="#dc2626" />
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <Text>Hapus Laporan</Text>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </ScrollView>
            </View>
          </Panel>
        )}

        {/* 5. ASSET HISTORY TAB */}
        {activeTab === "history" && (
          <Panel
            title="Histori Perawatan & Kondisi Aset Operasional"
            subtitle="Monitoring kondisi operasional aset (GOOD, UNDER_REPAIR, FAIR, DAMAGED) dan riwayat servis"
            icon={History}
          >
            <View className="overflow-hidden rounded-xl border border-border/80 bg-card">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ minWidth: "100%" }}
              >
                <View className="min-w-[960px] flex-1">
                  <View className="flex-row items-center border-b border-border/70 bg-muted/60 px-3.5 py-2.5">
                    <Text className="w-[150px] text-[11px] font-bold uppercase text-muted-foreground">
                      Kode Aset
                    </Text>
                    <Text className="flex-[1.5] text-[11px] font-bold uppercase text-muted-foreground">
                      Nama & Spesifikasi Aset
                    </Text>
                    <Text className="flex-[1.2] text-[11px] font-bold uppercase text-muted-foreground">
                      Lokasi & Departemen
                    </Text>
                    <Text className="w-[160px] text-[11px] font-bold uppercase text-muted-foreground">
                      Kondisi Operasional
                    </Text>
                  </View>

                  {lookups.assets.length === 0 ? (
                    <EmptyRow text="Belum ada aset terdaftar di Fixed Assets." />
                  ) : (
                    <View className="divide-y divide-border/40">
                      {lookups.assets.map((ast) => (
                        <View
                          key={ast.id}
                          className="flex-row items-center px-3.5 py-3 hover:bg-muted/20"
                        >
                          <View className="w-[150px] pr-2">
                            <Text className="font-mono text-xs font-bold text-primary">
                              {ast.assetCode}
                            </Text>
                          </View>
                          <View className="flex-[1.5] pr-3">
                            <Text className="text-xs font-bold text-foreground">
                              {ast.name}
                            </Text>
                            <Text className="text-[11px] text-muted-foreground">
                              Brand: {ast.brand || "-"} · Model: {ast.model || "-"} · SN: {ast.serialNumber || "-"}
                            </Text>
                          </View>
                          <View className="flex-[1.2] pr-3">
                            <Text className="text-xs text-foreground">
                              {ast.location?.name || "-"}
                            </Text>
                            <Text className="text-[11px] text-muted-foreground">
                              Dept: {ast.department || "-"}
                            </Text>
                          </View>
                          <View className="w-[160px]">
                            <AssetConditionBadge condition={ast.condition} />
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </ScrollView>
            </View>
          </Panel>
        )}

        {/* 6. 10 REPORTS TAB */}
        {activeTab === "reports" && <MaintenanceReportsPanel lookups={lookups} />}

        {/* 7. LEGACY FIELD REPORTS TAB */}
        {activeTab === "field-reports" && (
          <Panel
            title="Laporan Servis & Pemeliharaan Lapangan (Proyek & Klien)"
            subtitle="Histori servis kunjungan teknisi untuk proyek dan customer eksternal"
            icon={FileText}
            right={
              <Button
                size="sm"
                className="gap-1.5"
                onPress={() => router.push("/maintenance-reports")}
              >
                <Plus size={14} color="#fff" />
                <Text className="text-xs text-white">+ Tambah Laporan Maintenance</Text>
              </Button>
            }
          >
            <View className="gap-3">
              <View className="rounded-xl border border-border/70 bg-muted/40 p-3.5 gap-1">
                <Text className="text-xs font-bold text-foreground">
                  Laporan Servis & Pemeliharaan Proyek Lapangan (Legacy)
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Tab ini menyimpan seluruh catatan laporan servis kunjungan lapangan untuk klien dan proyek luar perusahaan yang sudah tercatat sebelumnya.
                </Text>
              </View>

              {fieldReports.length === 0 ? (
                <EmptyRow text="Belum ada laporan servis lapangan." />
              ) : (
                <View className="gap-2.5">
                  {fieldReports.map((rpt: any) => (
                    <Pressable
                      key={rpt.id}
                      onPress={() => router.push(`/maintenance-reports/${rpt.id}`)}
                      className="rounded-xl border border-border/80 bg-card p-3.5 gap-1.5 hover:border-primary/50 transition-all"
                    >
                      <View className="flex-row justify-between items-start">
                        <Text className="text-sm font-bold text-foreground">
                          {rpt.number} - {rpt.title}
                        </Text>
                        <Text className="text-xs font-semibold text-primary">
                          {rpt.status}
                        </Text>
                      </View>
                      <Text className="text-xs text-muted-foreground">
                        Klien: {rpt.clientName || rpt.customer?.name || "-"} · Tanggal: {formatDate(rpt.startDate)}
                      </Text>
                      {rpt.findings && (
                        <Text className="text-xs text-muted-foreground" numberOfLines={2}>
                          Temuan: {rpt.findings}
                        </Text>
                      )}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </Panel>
        )}
      </View>

      {/* Modals */}
      <WorkOrderFormDialog
        visible={showWoForm}
        onClose={() => setShowWoForm(false)}
        initialData={editingWo}
        lookups={lookups}
        onSubmit={handleCreateWo}
      />

      <WorkOrderDetailDialog
        visible={showWoDetail}
        onClose={() => setShowWoDetail(false)}
        workOrder={selectedWo}
        lookups={lookups}
        onUpdateStatus={handleUpdateWoStatus}
        onAddTask={handleAddTask}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
        onUpdateChecklist={handleUpdateChecklist}
        onAddMaterial={handleAddMaterial}
        onDeleteMaterial={handleDeleteMaterial}
        onAddLabor={handleAddLabor}
        onDeleteLabor={handleDeleteLabor}
        onAddCost={handleAddCost}
        onDeleteCost={handleDeleteCost}
        onRecordDowntime={handleRecordDowntime}
        onAddAttachment={handleAddAttachment}
        onVerify={handleVerify}
        onCloseWo={handleCloseWo}
        onEvaluateCapitalization={handleEvaluateCapitalization}
        onRefresh={() => {
          if (selectedWo) handleOpenWoDetail(selectedWo);
          loadData();
        }}
      />

      <MaintenancePlanDialog
        visible={showPlanDialog}
        onClose={() => setShowPlanDialog(false)}
        initialData={editingPlan}
        lookups={lookups}
        onSubmit={handleSavePlan}
      />

      <MaintenanceRequestDialog
        visible={showRequestDialog}
        onClose={() => setShowRequestDialog(false)}
        lookups={lookups}
        onSubmit={handleSaveRequest}
      />

      <InitialInspectionDialog
        visible={showInspectDialog}
        onClose={() => setShowInspectDialog(false)}
        request={inspectingRequest}
        onInspect={handleInspectRequest}
        onCreateWo={handleCreateWoFromRequest}
      />

      <MaintenanceRescheduleDialog
        visible={showRescheduleDialog}
        onClose={() => setShowRescheduleDialog(false)}
        schedule={reschedulingSchedule}
        onReschedule={handleReschedule}
      />

      <MaintenanceMasterDialog
        visible={showMasterDialog}
        onClose={() => setShowMasterDialog(false)}
        categories={lookups.categories}
        checklists={lookups.checklists}
        vendors={lookups.vendors}
        onCreateCategory={async (c) => {
          await api.post("/maintenance/categories", c);
          toast("Kategori berhasil ditambahkan", "success");
        }}
        onUpdateCategory={async (id, c) => {
          await api.patch(`/maintenance/categories/${id}`, c);
          toast("Kategori berhasil diperbarui", "success");
        }}
        onDeleteCategory={async (id) => {
          await api.delete(`/maintenance/categories/${id}`);
          toast("Kategori berhasil dihapus", "success");
        }}
        onCreateChecklist={async (chk) => {
          await api.post("/maintenance/checklists", chk);
          toast("Checklist berhasil ditambahkan", "success");
        }}
        onUpdateChecklist={async (id, chk) => {
          await api.patch(`/maintenance/checklists/${id}`, chk);
          toast("Checklist berhasil diperbarui", "success");
        }}
        onDeleteChecklist={async (id) => {
          await api.delete(`/maintenance/checklists/${id}`);
          toast("Checklist berhasil dihapus", "success");
        }}
        onCreateVendor={async (v) => {
          await api.post("/maintenance/vendors", v);
          toast("Vendor berhasil ditambahkan", "success");
        }}
        onUpdateVendor={async (id, v) => {
          await api.patch(`/maintenance/vendors/${id}`, v);
          toast("Vendor berhasil diperbarui", "success");
        }}
        onDeleteVendor={async (id) => {
          await api.delete(`/maintenance/vendors/${id}`);
          toast("Vendor berhasil dihapus", "success");
        }}
        onRefresh={loadData}
      />
    </ScrollView>
  );
}
