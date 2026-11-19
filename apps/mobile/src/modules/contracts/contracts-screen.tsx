import * as React from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, TouchableOpacity, View } from "react-native";
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Database,
  Eye,
  FilePlus2,
  FileSignature,
  FolderKanban,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Wallet,
  XCircle,
} from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PageHeader, Panel } from "@/components/taska/basics";
import { SearchableSelect } from "@/components/taska/dialogs";
import { colors } from "@/tokens";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import { hasUserPermission } from "@/constants/modules";
import { rupiah, tanggal } from "@/lib/format";
import type {
  ContractDashboard,
  ContractMasterLookups,
  CtrContract,
} from "./types";
import {
  APPROVAL_STATUS_OPTIONS,
  CONTRACT_STATUS_OPTIONS,
  DEPARTMENT_OPTIONS,
  PAYMENT_FREQUENCY_LABEL,
  expirationDaysLabel,
  formatContractCurrency,
} from "./contract-utils";
import {
  ApprovalStatusBadge,
  ContractStatusBadge,
  ContractTabs,
  CounterpartyBadge,
  EmptyRow,
} from "./contract-ui";
import { ContractTypeDialog } from "./contract-type-dialog";
import { ContractFormDialog } from "./contract-form-dialog";
import { ContractDetailDialog } from "./contract-detail-dialog";
import { ContractApprovalDialog } from "./contract-approval-dialog";
import { ContractRenewalDialog } from "./contract-renewal-dialog";
import { ContractAmendmentDialog } from "./contract-amendment-dialog";
import { ContractTerminationDialog } from "./contract-termination-dialog";
import { ContractReportsPanel } from "./contract-reports-panel";

const EMPTY_LOOKUPS: ContractMasterLookups = {
  types: [],
  suppliers: [],
  customers: [],
  projects: [],
  subscriptions: [],
  assets: [],
  supplierPos: [],
  users: [],
  expirationRules: [],
};

function MetricCard({
  label,
  value,
  hint,
  color,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  hint: React.ReactNode;
  color: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
}) {
  return (
    <View className="min-w-[215px] flex-1 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
      <View className="flex-row items-start justify-between gap-2">
        <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </Text>
        <View className="rounded-lg p-1.5" style={{ backgroundColor: `${color}18` }}>
          <Icon size={14} color={color} />
        </View>
      </View>
      <Text className="mt-1 text-xl font-bold tracking-tight sm:text-2xl" style={{ color }}>
        {value}
      </Text>
      <Text className="mt-1 text-xs text-muted-foreground">{hint}</Text>
    </View>
  );
}

export function ContractsScreen({
  initialContractId,
  initialSearch,
}: {
  initialContractId?: string | number;
  initialSearch?: string;
} = {}) {
  const { user, toast } = useApp();

  const parsedInitialId = initialContractId ? Number(initialContractId) : null;
  const validInitialId =
    parsedInitialId !== null && Number.isInteger(parsedInitialId) && parsedInitialId > 0
      ? parsedInitialId
      : null;

  const [activeTab, setActiveTab] = React.useState("all");
  const [contracts, setContracts] = React.useState<CtrContract[]>([]);
  const [lookups, setLookups] = React.useState<ContractMasterLookups>(EMPTY_LOOKUPS);
  const [dashboard, setDashboard] = React.useState<ContractDashboard | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [reminderBusy, setReminderBusy] = React.useState(false);

  // Filters
  const [search, setSearch] = React.useState(initialSearch ?? "");
  const [filterTypeId, setFilterTypeId] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");
  const [filterApproval, setFilterApproval] = React.useState("");
  const [filterDepartment, setFilterDepartment] = React.useState("");

  // Dialog states
  const [showTypeDialog, setShowTypeDialog] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [editing, setEditing] = React.useState<CtrContract | null>(null);
  const [detailId, setDetailId] = React.useState<number | null>(validInitialId);
  const [showDetail, setShowDetail] = React.useState(validInitialId !== null);
  const [selected, setSelected] = React.useState<CtrContract | null>(null);
  const [showApproval, setShowApproval] = React.useState(false);
  const [showRenewal, setShowRenewal] = React.useState(false);
  const [showAmendment, setShowAmendment] = React.useState(false);
  const [showTermination, setShowTermination] = React.useState(false);

  const canCreate = hasUserPermission(user, "contracts", "C");
  const canUpdate = hasUserPermission(user, "contracts", "U");
  const canDelete = hasUserPermission(user, "contracts", "A");

  const fetchLookupsAndDashboard = React.useCallback(async () => {
    const [lookupRes, dashRes] = await Promise.allSettled([
      api.get<ContractMasterLookups>("/contracts/lookups"),
      api.get<ContractDashboard>("/contracts/dashboard"),
    ]);
    if (lookupRes.status === "fulfilled" && lookupRes.value) {
      setLookups(lookupRes.value);
    }
    if (dashRes.status === "fulfilled" && dashRes.value) {
      setDashboard(dashRes.value);
    }
  }, []);

  const fetchContracts = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (filterTypeId) params.set("typeId", filterTypeId);
      if (filterStatus) params.set("status", filterStatus);
      if (filterApproval) params.set("approvalStatus", filterApproval);
      if (filterDepartment) params.set("department", filterDepartment);
      if (["vendor", "customer", "service", "expiring", "approval"].includes(activeTab)) {
        params.set("tab", activeTab);
      }
      const qs = params.toString();
      const res = await api.get<{ data?: CtrContract[]; items?: CtrContract[] } | CtrContract[]>(
        `/contracts${qs ? `?${qs}` : ""}`,
      );
      const list = Array.isArray(res) ? res : res?.data ?? res?.items ?? [];
      setContracts(list);
    } catch (e: any) {
      toast(e?.message ?? "Gagal memuat daftar kontrak", "danger");
    } finally {
      setLoading(false);
    }
  }, [activeTab, filterApproval, filterDepartment, filterStatus, filterTypeId, search, toast]);

  const refreshAll = React.useCallback(() => {
    void fetchLookupsAndDashboard();
    void fetchContracts();
  }, [fetchContracts, fetchLookupsAndDashboard]);

  React.useEffect(() => {
    void Promise.resolve().then(fetchLookupsAndDashboard);
  }, [fetchLookupsAndDashboard]);

  React.useEffect(() => {
    void Promise.resolve().then(fetchContracts);
  }, [fetchContracts]);

  async function runReminders() {
    setReminderBusy(true);
    try {
      const res = await api.post<{ sentCount: number; asOfDate: string }>(
        "/contracts/reminders/run",
        {},
      );
      toast(`${res.sentCount} reminder kedaluwarsa kontrak diproses (${res.asOfDate})`);
      refreshAll();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menjalankan pengingat kontrak", "danger");
    } finally {
      setReminderBusy(false);
    }
  }

  function handleDeleteOrTerminate(ctr: CtrContract) {
    if (ctr.approvalStatus === "DRAFT" || ctr.approvalStatus === "CANCELLED") {
      Alert.alert(
        "Hapus Draft Kontrak",
        `Hapus permanen draft kontrak ${ctr.contractNumber} (${ctr.title})?`,
        [
          { text: "Batal", style: "cancel" },
          {
            text: "Hapus",
            style: "destructive",
            onPress: async () => {
              try {
                await api.delete(`/contracts/${ctr.id}`);
                toast("Draft kontrak berhasil dihapus");
                refreshAll();
              } catch (e: any) {
                toast(e?.message ?? "Gagal menghapus draft kontrak", "danger");
              }
            },
          },
        ],
      );
    } else {
      setSelected(ctr);
      setShowTermination(true);
    }
  }

  function resetFilters() {
    setSearch("");
    setFilterTypeId("");
    setFilterStatus("");
    setFilterApproval("");
    setFilterDepartment("");
  }

  const summary = dashboard?.summary;

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ paddingBottom: 36 }}>
      <View className="gap-4 p-4 sm:p-6">
        <PageHeader
          title="Manajemen Kontrak (Contract Management)"
          subtitle="Pusat penyimpanan kontrak vendor, pelanggan, Service Agreement (SLA), versi dokumen, approval & masa berlaku"
          onRefresh={refreshAll}
          action={
            <View className="flex-row flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onPress={() => setShowTypeDialog(true)}
              >
                <Database size={14} color={colors.primary} />
                <Text className="text-xs">Master Kategori</Text>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onPress={runReminders}
                disabled={reminderBusy}
              >
                <BellRing size={14} color={colors.primary} />
                <Text className="text-xs">
                  {reminderBusy ? "Memproses..." : "Cek Reminder (H-90 s/d H+1)"}
                </Text>
              </Button>
              {canCreate ? (
                <Button
                  size="sm"
                  className="gap-1.5"
                  onPress={() => {
                    setEditing(null);
                    setShowForm(true);
                  }}
                >
                  <Plus size={14} color="#fff" />
                  <Text className="text-xs text-white">+ Kontrak Baru</Text>
                </Button>
              ) : null}
            </View>
          }
        />

        {/* KPI Summary Cards (PRD 10.1) */}
        <View className="flex-row flex-wrap gap-3">
          <MetricCard
            label="Total & Kontrak Aktif"
            value={`${summary?.activeContracts ?? 0} Aktif`}
            hint={`Dari total ${summary?.totalContracts ?? 0} kontrak terdaftar`}
            color={colors.success}
            icon={FileSignature}
          />
          <MetricCard
            label="Total Nilai Kontrak Aktif"
            value={rupiah(summary?.totalActiveValue ?? 0)}
            hint={`Komitmen finansial: ${rupiah(summary?.totalFinancialCommitment ?? 0)}`}
            color={colors.primary}
            icon={Wallet}
          />
          <MetricCard
            label="Mendekati Expiration"
            value={`${summary?.expiringSoonContracts ?? 0} Kontrak`}
            hint={`${summary?.expiredContracts ?? 0} kontrak telah melewati masa berlaku`}
            color={colors.warning}
            icon={AlertTriangle}
          />
          <MetricCard
            label="Menunggu Approval"
            value={`${summary?.pendingApprovalContracts ?? 0} Kontrak`}
            hint="Dalam tahap pemeriksaan Dept / Legal / Finance / Direksi"
            color={colors.info}
            icon={ShieldCheck}
          />
          <MetricCard
            label="Menunggu Renewal"
            value={`${summary?.pendingRenewalContracts ?? 0} Kontrak`}
            hint={`${summary?.terminatedContracts ?? 0} kontrak telah dihentikan (Terminated)`}
            color={colors.primary}
            icon={CalendarClock}
          />
        </View>

        {/* Main Navigation Tabs */}
        <ContractTabs
          value={activeTab}
          onChange={setActiveTab}
          tabs={[
            { value: "all", label: "Semua Kontrak", count: summary?.totalContracts },
            { value: "vendor", label: "Vendor Contract" },
            { value: "customer", label: "Customer Contract" },
            { value: "service", label: "Service Agreement & SLA" },
            {
              value: "expiring",
              label: "Mendekati Kedaluwarsa",
              count: (summary?.expiringSoonContracts ?? 0) + (summary?.expiredContracts ?? 0),
            },
            {
              value: "approval",
              label: "Approval & Renewal",
              count: (summary?.pendingApprovalContracts ?? 0) + (summary?.pendingRenewalContracts ?? 0),
            },
            { value: "dashboard_breakdown", label: "Ringkasan Kategori & Vendor" },
            { value: "reports", label: "12 Laporan Analitik" },
          ]}
        />

        {/* TAB: REPORTS */}
        {activeTab === "reports" ? (
          <ContractReportsPanel types={lookups.types} onRefresh={refreshAll} />
        ) : activeTab === "dashboard_breakdown" ? (
          /* TAB: DASHBOARD BREAKDOWN (PRD 10.1) */
          <View className="gap-4">
            <View className="flex-row flex-wrap gap-4">
              <View className="min-w-[280px] flex-1 rounded-xl border border-border/80 bg-card p-4">
                <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Kontrak Berdasarkan Kategori
                </Text>
                {(dashboard?.byCategory ?? []).length === 0 ? (
                  <EmptyRow text="Belum ada data kategori" />
                ) : (
                  <View className="divide-y divide-border/40">
                    {(dashboard?.byCategory ?? []).map((item, idx) => (
                      <View
                        key={idx}
                        className="flex-row items-center justify-between py-2"
                      >
                        <View>
                          <Text className="text-xs font-bold">{item.category}</Text>
                          <Text className="text-[11px] text-muted-foreground">
                            {item.count} kontrak
                          </Text>
                        </View>
                        <Text className="text-xs font-bold text-primary">
                          {rupiah(item.totalValue)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View className="min-w-[280px] flex-1 rounded-xl border border-border/80 bg-card p-4">
                <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Kontrak Berdasarkan Vendor / Pihak Terkait
                </Text>
                {(dashboard?.byVendor ?? []).length === 0 ? (
                  <EmptyRow text="Belum ada data pihak terkait" />
                ) : (
                  <View className="divide-y divide-border/40">
                    {(dashboard?.byVendor ?? []).map((item, idx) => (
                      <View
                        key={idx}
                        className="flex-row items-center justify-between py-2"
                      >
                        <View>
                          <Text className="text-xs font-bold">{item.counterparty}</Text>
                          <Text className="text-[11px] text-muted-foreground">
                            {item.type} · {item.count} kontrak
                          </Text>
                        </View>
                        <Text className="text-xs font-bold text-primary">
                          {rupiah(item.totalValue)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View className="min-w-[280px] flex-1 rounded-xl border border-border/80 bg-card p-4">
                <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Kontrak Berdasarkan Departemen
                </Text>
                {(dashboard?.byDepartment ?? []).length === 0 ? (
                  <EmptyRow text="Belum ada data departemen" />
                ) : (
                  <View className="divide-y divide-border/40">
                    {(dashboard?.byDepartment ?? []).map((item, idx) => (
                      <View
                        key={idx}
                        className="flex-row items-center justify-between py-2"
                      >
                        <View>
                          <Text className="text-xs font-bold">{item.department}</Text>
                          <Text className="text-[11px] text-muted-foreground">
                            {item.count} kontrak
                          </Text>
                        </View>
                        <Text className="text-xs font-bold text-primary">
                          {rupiah(item.totalValue)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </View>
        ) : (
          /* TAB: CONTRACT REGISTRY TABLE */
          <Panel
            title="Daftar Registrasi Kontrak & Perjanjian"
            subtitle="Klik detail untuk melihat versi dokumen, SLA, komitmen pembayaran, riwayat approval, renewal & audit trail"
            icon={FolderKanban}
            right={
              <Button variant="outline" size="sm" className="gap-1.5" onPress={refreshAll}>
                <RefreshCw size={13} color={colors.primary} />
                <Text className="text-xs">Muat Ulang</Text>
              </Button>
            }
          >
            <View className="gap-3">
              {/* Filter Bar */}
              <View className="flex-row flex-wrap items-center gap-2">
                <View className="min-w-[220px] flex-[1.5]">
                  <View className="relative justify-center">
                    <Input
                      value={search}
                      onChangeText={setSearch}
                      placeholder="Cari Kode CTR, nomor resmi, judul, vendor/klien..."
                      className="pl-8"
                    />
                    <View className="absolute left-2.5">
                      <Search size={14} color={colors.muted} />
                    </View>
                  </View>
                </View>

                <View className="min-w-[170px] flex-1">
                  <SearchableSelect
                    value={
                      filterTypeId
                        ? lookups.types.find((t) => String(t.id) === filterTypeId)?.name ?? ""
                        : ""
                    }
                    options={lookups.types.map((t) => `${t.id} - ${t.name}`)}
                    onChange={(val) => setFilterTypeId(val ? val.split(" - ")[0] ?? "" : "")}
                    placeholder="Semua Kategori"
                    clearable
                    className="h-10 rounded-lg border-border/80 bg-card"
                  />
                </View>

                <View className="min-w-[160px] flex-1">
                  <SearchableSelect
                    value={
                      filterStatus
                        ? CONTRACT_STATUS_OPTIONS.find((s) => s.value === filterStatus)?.label ??
                          filterStatus
                        : ""
                    }
                    options={CONTRACT_STATUS_OPTIONS.filter((s) => s.value !== "").map(
                      (s) => s.label,
                    )}
                    onChange={(label) => {
                      const found = CONTRACT_STATUS_OPTIONS.find((s) => s.label === label);
                      setFilterStatus(found?.value ?? "");
                    }}
                    placeholder="Semua Status"
                    clearable
                    className="h-10 rounded-lg border-border/80 bg-card"
                  />
                </View>

                <View className="min-w-[160px] flex-1">
                  <SearchableSelect
                    value={
                      filterApproval
                        ? APPROVAL_STATUS_OPTIONS.find((s) => s.value === filterApproval)?.label ??
                          filterApproval
                        : ""
                    }
                    options={APPROVAL_STATUS_OPTIONS.filter((s) => s.value !== "").map(
                      (s) => s.label,
                    )}
                    onChange={(label) => {
                      const found = APPROVAL_STATUS_OPTIONS.find((s) => s.label === label);
                      setFilterApproval(found?.value ?? "");
                    }}
                    placeholder="Semua Approval"
                    clearable
                    className="h-10 rounded-lg border-border/80 bg-card"
                  />
                </View>

                <View className="min-w-[155px] flex-1">
                  <SearchableSelect
                    value={filterDepartment}
                    options={DEPARTMENT_OPTIONS}
                    onChange={setFilterDepartment}
                    placeholder="Semua Departemen"
                    clearable
                    className="h-10 rounded-lg border-border/80 bg-card"
                  />
                </View>

                {search || filterTypeId || filterStatus || filterApproval || filterDepartment ? (
                  <Button variant="outline" size="sm" onPress={resetFilters}>
                    <Text className="text-xs">Reset</Text>
                  </Button>
                ) : null}
              </View>

              {/* Table */}
              <View className="overflow-hidden rounded-xl border border-border/80 bg-card">
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ minWidth: "100%" }}
                >
                  <View className="min-w-[1060px] flex-1">
                    <View className="flex-row items-center border-b border-border/70 bg-muted/60 px-3.5 py-2.5">
                      <Text className="w-[140px] text-[11px] font-bold uppercase text-muted-foreground">
                        Kode CTR / Nomor
                      </Text>
                      <Text className="flex-[1.5] text-[11px] font-bold uppercase text-muted-foreground">
                        Judul & Kategori Kontrak
                      </Text>
                      <Text className="flex-[1.2] text-[11px] font-bold uppercase text-muted-foreground">
                        Pihak Terkait & Dept
                      </Text>
                      <Text className="w-[165px] text-[11px] font-bold uppercase text-muted-foreground">
                        Masa Berlaku
                      </Text>
                      <Text className="w-[145px] text-[11px] font-bold uppercase text-muted-foreground">
                        Nilai Kontrak
                      </Text>
                      <Text className="w-[130px] text-[11px] font-bold uppercase text-muted-foreground">
                        Status
                      </Text>
                      <Text className="w-[130px] text-[11px] font-bold uppercase text-muted-foreground">
                        Approval
                      </Text>
                      <Text className="w-[185px] text-right text-[11px] font-bold uppercase text-muted-foreground">
                        Aksi
                      </Text>
                    </View>

                    {loading ? (
                      <View className="items-center justify-center py-10">
                        <ActivityIndicator color={colors.primary} />
                      </View>
                    ) : contracts.length === 0 ? (
                      <EmptyRow text="Belum ada kontrak yang tercatat pada tampilan ini." />
                    ) : (
                      <View className="divide-y divide-border/40">
                        {contracts.map((ctr) => (
                          <Pressable
                            key={ctr.id}
                            onPress={() => {
                              setDetailId(ctr.id);
                              setShowDetail(true);
                            }}
                            className="flex-row items-center px-3.5 py-3 hover:bg-muted/20"
                          >
                            <View className="w-[140px] pr-2">
                              <Text className="font-mono text-xs font-bold text-primary">
                                {ctr.contractNumber}
                              </Text>
                              <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                                {ctr.officialNumber || "Internal"}
                              </Text>
                            </View>

                            <View className="flex-[1.5] pr-3">
                              <Text className="text-xs font-bold" numberOfLines={1}>
                                {ctr.title}
                              </Text>
                              <Text className="mt-0.5 text-[11px] text-muted-foreground">
                                {ctr.typeName} · Dokumen: {ctr._count?.documents ?? ctr.documents?.length ?? 0}
                              </Text>
                            </View>

                            <View className="flex-[1.2] pr-3">
                              <Text className="text-xs font-semibold" numberOfLines={1}>
                                {ctr.counterpartyName}
                              </Text>
                              <Text className="mt-0.5 text-[11px] text-muted-foreground">
                                {ctr.department} · PIC: {ctr.ownerUser?.name ?? "-"}
                              </Text>
                            </View>

                            <View className="w-[165px] pr-2">
                              <Text className="text-xs font-medium">
                                {tanggal(ctr.effectiveDate)} - {tanggal(ctr.expirationDate)}
                              </Text>
                              <Text
                                className="mt-0.5 text-[11px] font-semibold"
                                style={{
                                  color:
                                    ctr.daysToExpiration != null && ctr.daysToExpiration < 0
                                      ? colors.danger
                                      : ctr.daysToExpiration != null && ctr.daysToExpiration <= 30
                                        ? colors.warning
                                        : colors.muted,
                                }}
                              >
                                {expirationDaysLabel(ctr.daysToExpiration)}
                              </Text>
                            </View>

                            <View className="w-[145px] pr-2">
                              <Text className="text-xs font-bold">
                                {formatContractCurrency(ctr.contractValue, ctr.currency)}
                              </Text>
                              <Text className="text-[11px] text-muted-foreground">
                                {PAYMENT_FREQUENCY_LABEL[ctr.paymentFrequency] ??
                                  ctr.paymentFrequency}
                              </Text>
                            </View>

                            <View className="w-[130px] pr-2">
                              <ContractStatusBadge status={ctr.status} />
                            </View>

                            <View className="w-[130px] pr-2">
                              <ApprovalStatusBadge status={ctr.approvalStatus} />
                            </View>

                            <View className="w-[185px] flex-row items-center justify-end gap-1">
                              <Tooltip delayDuration={150}>
                                <TooltipTrigger
                                  onPress={(e) => {
                                    e.stopPropagation?.();
                                    setDetailId(ctr.id);
                                    setShowDetail(true);
                                  }}
                                  className="rounded-md border border-border p-1.5 hover:bg-muted/60"
                                >
                                  <Eye size={13} color={colors.primary} />
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <Text>Lihat Detail Kontrak</Text>
                                </TooltipContent>
                              </Tooltip>
                              {canUpdate ? (
                                <>
                                  <Tooltip delayDuration={150}>
                                    <TooltipTrigger
                                      onPress={(e) => {
                                        e.stopPropagation?.();
                                        setEditing(ctr);
                                        setShowForm(true);
                                      }}
                                      className="rounded-md border border-border p-1.5 hover:bg-muted/60"
                                    >
                                      <Pencil size={13} color={colors.primary} />
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <Text>Edit Kontrak</Text>
                                    </TooltipContent>
                                  </Tooltip>
                                  <Tooltip delayDuration={150}>
                                    <TooltipTrigger
                                      onPress={(e) => {
                                        e.stopPropagation?.();
                                        setSelected(ctr);
                                        setShowApproval(true);
                                      }}
                                      className="rounded-md border border-border p-1.5 hover:bg-muted/60"
                                    >
                                      <CheckCircle2 size={13} color={colors.success} />
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <Text>Review & Approval Kontrak</Text>
                                    </TooltipContent>
                                  </Tooltip>
                                  <Tooltip delayDuration={150}>
                                    <TooltipTrigger
                                      onPress={(e) => {
                                        e.stopPropagation?.();
                                        setSelected(ctr);
                                        setShowRenewal(true);
                                      }}
                                      className="rounded-md border border-border p-1.5 hover:bg-muted/60"
                                    >
                                      <RefreshCw size={13} color={colors.info} />
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <Text>Perpanjang Kontrak (Renewal)</Text>
                                    </TooltipContent>
                                  </Tooltip>
                                </>
                              ) : null}
                              {canDelete || canUpdate ? (
                                <Tooltip delayDuration={150}>
                                  <TooltipTrigger
                                    onPress={(e) => {
                                      e.stopPropagation?.();
                                      handleDeleteOrTerminate(ctr);
                                    }}
                                    className="rounded-md border border-border p-1.5 hover:bg-muted/60"
                                  >
                                    <Trash2 size={13} color={colors.danger} />
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    <Text>
                                      {ctr.approvalStatus === "DRAFT" ||
                                      ctr.approvalStatus === "CANCELLED"
                                        ? "Hapus Draft Kontrak"
                                        : "Hentikan Kontrak (Terminasi)"}
                                    </Text>
                                  </TooltipContent>
                                </Tooltip>
                              ) : null}
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
      </View>

      {/* Dialogs */}
      <ContractTypeDialog
        visible={showTypeDialog}
        onClose={() => setShowTypeDialog(false)}
        types={lookups.types}
        onRefresh={refreshAll}
      />

      <ContractFormDialog
        visible={showForm}
        onClose={() => {
          setShowForm(false);
          setEditing(null);
        }}
        contract={editing}
        lookups={lookups}
        onOpenTypeManager={() => setShowTypeDialog(true)}
        onRefreshLookups={fetchLookupsAndDashboard}
        onSuccess={refreshAll}
      />

      <ContractDetailDialog
        visible={showDetail}
        contractId={detailId}
        lookups={lookups}
        onClose={() => setShowDetail(false)}
        onRefresh={refreshAll}
        onEdit={(ctr) => {
          setShowDetail(false);
          setEditing(ctr);
          setShowForm(true);
        }}
        onOpenApproval={(ctr) => {
          setSelected(ctr);
          setShowApproval(true);
        }}
        onOpenRenewal={(ctr) => {
          setSelected(ctr);
          setShowRenewal(true);
        }}
        onOpenAmendment={(ctr) => {
          setSelected(ctr);
          setShowAmendment(true);
        }}
        onOpenTermination={(ctr) => {
          setSelected(ctr);
          setShowTermination(true);
        }}
      />

      <ContractApprovalDialog
        visible={showApproval}
        contract={selected}
        onClose={() => setShowApproval(false)}
        onSuccess={refreshAll}
      />

      <ContractRenewalDialog
        visible={showRenewal}
        contract={selected}
        onClose={() => setShowRenewal(false)}
        onSuccess={refreshAll}
      />

      <ContractAmendmentDialog
        visible={showAmendment}
        contract={selected}
        onClose={() => setShowAmendment(false)}
        onSuccess={refreshAll}
      />

      <ContractTerminationDialog
        visible={showTermination}
        contract={selected}
        onClose={() => setShowTermination(false)}
        onSuccess={refreshAll}
      />
    </ScrollView>
  );
}
