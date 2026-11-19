import * as React from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from "react-native";
import {
  AlertTriangle,
  ArrowUpCircle,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Database,
  Eye,
  FolderKanban,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wallet,
} from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PageHeader, Panel } from "@/components/akuntra/basics";
import { SearchableSelect } from "@/components/akuntra/dialogs";
import { colors } from "@/tokens";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import { hasUserPermission } from "@/constants/modules";
import { rupiah, tanggal } from "@/lib/format";
import type {
  SubBillingSchedule,
  SubCategory,
  SubProvider,
  SubSubscription,
  SubscriptionDashboard,
} from "./types";
import {
  BILLING_CYCLE_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  SUBSCRIPTION_STATUS_OPTIONS,
  cycleText,
  daysLabel,
  parseIso,
} from "./subscription-utils";
import {
  CycleBadge,
  EmptyRow,
  PaymentStatusBadge,
  SubscriptionStatusBadge,
  SubscriptionTabs,
} from "./subscription-ui";
import { SubscriptionMasterDialog } from "./subscription-master-dialog";
import { SubscriptionFormDialog } from "./subscription-form-dialog";
import { SubscriptionDetailDialog } from "./subscription-detail-dialog";
import { SubscriptionRenewalDialog } from "./subscription-renewal-dialog";
import { SubscriptionUpgradeDialog } from "./subscription-upgrade-dialog";
import { SubscriptionPaymentDialog } from "./subscription-payment-dialog";
import { SubscriptionCancellationDialog } from "./subscription-cancellation-dialog";
import { SubscriptionUsageDialog } from "./subscription-usage-dialog";
import { SubscriptionReportsPanel } from "./subscription-reports-panel";

const OPEN_STATUSES = [
  "ACTIVE",
  "RENEWAL_DUE",
  "RENEWAL_PENDING",
  "PENDING_APPROVAL",
  "SUSPENDED",
  "CANCELLATION_PENDING",
];

function daysUntil(value?: string | null): number | null {
  if (!value) return null;
  const due = parseIso(value);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

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
    <View className="min-w-[220px] flex-1 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
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

export function SubscriptionsScreen({
  initialSubscriptionId,
  initialSearch,
}: {
  initialSubscriptionId?: string | number;
  initialSearch?: string;
} = {}) {
  const { user, toast } = useApp();

  const initialId = initialSubscriptionId ? Number(initialSubscriptionId) : null;
  const validInitialId =
    initialId !== null && Number.isInteger(initialId) && initialId > 0 ? initialId : null;

  const [activeTab, setActiveTab] = React.useState("registry");
  const [subscriptions, setSubscriptions] = React.useState<SubSubscription[]>([]);
  const [categories, setCategories] = React.useState<SubCategory[]>([]);
  const [providers, setProviders] = React.useState<SubProvider[]>([]);
  const [dashboard, setDashboard] = React.useState<SubscriptionDashboard | null>(null);
  const [drafts, setDrafts] = React.useState<SubBillingSchedule[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [draftsLoading, setDraftsLoading] = React.useState(false);
  const [busyDraft, setBusyDraft] = React.useState<number | null>(null);

  const [search, setSearch] = React.useState(initialSearch ?? "");
  const [filterCategory, setFilterCategory] = React.useState("");
  const [filterProvider, setFilterProvider] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");
  const [filterPayment, setFilterPayment] = React.useState("");
  const [filterCycle, setFilterCycle] = React.useState("");
  const [filterDepartment, setFilterDepartment] = React.useState("");
  const [renewalWindow, setRenewalWindow] = React.useState("30");
  const [reminderBusy, setReminderBusy] = React.useState(false);

  const [showMaster, setShowMaster] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [editing, setEditing] = React.useState<SubSubscription | null>(null);
  const [detailId, setDetailId] = React.useState<number | null>(validInitialId);
  const [showDetail, setShowDetail] = React.useState(validInitialId !== null);
  const [selected, setSelected] = React.useState<SubSubscription | null>(null);
  const [showRenewal, setShowRenewal] = React.useState(false);
  const [showUpgrade, setShowUpgrade] = React.useState(false);
  const [showPayment, setShowPayment] = React.useState(false);
  const [showCancellation, setShowCancellation] = React.useState(false);
  const [showUsage, setShowUsage] = React.useState(false);

  const canCreate = hasUserPermission(user, "subscriptions", "C");
  const canUpdate = hasUserPermission(user, "subscriptions", "U");
  const canDelete = hasUserPermission(user, "subscriptions", "A");

  const fetchLookups = React.useCallback(async () => {
    const [catResult, provResult, dashResult, draftResult] = await Promise.allSettled([
      api.get<SubCategory[]>("/subscriptions/categories"),
      api.get<SubProvider[]>("/subscriptions/providers"),
      api.get<SubscriptionDashboard>("/subscriptions/dashboard"),
      api.get<{ items?: SubBillingSchedule[]; data?: SubBillingSchedule[] }>(
        "/subscriptions/billing-drafts",
      ),
    ]);
    if (catResult.status === "fulfilled" && Array.isArray(catResult.value)) {
      setCategories(catResult.value);
    }
    if (provResult.status === "fulfilled" && Array.isArray(provResult.value)) {
      setProviders(provResult.value);
    }
    if (dashResult.status === "fulfilled" && dashResult.value) {
      setDashboard(dashResult.value);
    }
    if (draftResult.status === "fulfilled" && draftResult.value) {
      setDrafts(draftResult.value.items ?? draftResult.value.data ?? []);
    }
  }, []);

  const fetchSubscriptions = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (filterCategory) params.set("categoryId", filterCategory);
      if (filterProvider) params.set("providerId", filterProvider);
      if (filterStatus) params.set("status", filterStatus);
      if (filterPayment) params.set("paymentStatus", filterPayment);
      if (filterCycle) params.set("billingCycle", filterCycle);
      if (filterDepartment.trim()) params.set("department", filterDepartment.trim());
      params.set("limit", "200");
      const result = await api.get<{ items?: SubSubscription[]; data?: SubSubscription[] }>(
        `/subscriptions?${params.toString()}`,
      );
      setSubscriptions(result.items ?? result.data ?? []);
    } catch (e: any) {
      toast(e?.message ?? "Gagal memuat daftar langganan", "danger");
    } finally {
      setLoading(false);
    }
  }, [
    filterCategory,
    filterCycle,
    filterDepartment,
    filterPayment,
    filterProvider,
    filterStatus,
    search,
    toast,
  ]);

  const refreshAll = React.useCallback(async () => {
    await Promise.all([fetchSubscriptions(), fetchLookups()]);
  }, [fetchLookups, fetchSubscriptions]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      void fetchLookups();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchLookups]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      void fetchSubscriptions();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchSubscriptions]);

  const overview = dashboard?.overview ?? {
    totalActiveSubscriptions: subscriptions.filter((sub) => sub.status === "ACTIVE").length,
    totalMonthlyRecurringCost: subscriptions.reduce((sum, sub) => sum + Number(sub.mrc || 0), 0),
    totalAnnualRecurringCost: subscriptions.reduce((sum, sub) => sum + Number(sub.arc || 0), 0),
    upcomingRenewals: subscriptions.filter((sub) => {
      const days = daysUntil(sub.nextRenewalDate);
      return days != null && days >= 0 && days <= 30;
    }).length,
    overduePayments: subscriptions.filter((sub) => sub.paymentStatus === "OVERDUE").length,
    expiredSubscriptions: subscriptions.filter((sub) => sub.status === "EXPIRED").length,
    pendingCancellation: subscriptions.filter((sub) => sub.status === "CANCELLATION_PENDING").length,
    underReview: subscriptions.filter((sub) =>
      ["PENDING_APPROVAL", "RENEWAL_PENDING"].includes(sub.status),
    ).length,
  };

  const upcoming = React.useMemo(() => {
    const limit = renewalWindow === "all" ? Number.POSITIVE_INFINITY : Number(renewalWindow);
    return subscriptions
      .filter((sub) => {
        if (!sub.nextRenewalDate || sub.status === "CANCELLED") return false;
        const days = daysUntil(sub.nextRenewalDate);
        return days != null && days <= limit;
      })
      .sort((a, b) => {
        const aTime = a.nextRenewalDate ? new Date(a.nextRenewalDate).getTime() : 0;
        const bTime = b.nextRenewalDate ? new Date(b.nextRenewalDate).getTime() : 0;
        return aTime - bTime;
      });
  }, [renewalWindow, subscriptions]);

  const categoryOptions = React.useMemo(
    () => [
      { value: "", label: "Semua Kategori" },
      ...categories.map((category) => ({ value: String(category.id), label: category.name })),
    ],
    [categories],
  );
  const providerOptions = React.useMemo(
    () => [
      { value: "", label: "Semua Provider" },
      ...providers.map((provider) => ({ value: String(provider.id), label: provider.name })),
    ],
    [providers],
  );

  function openDetail(sub: SubSubscription) {
    setDetailId(sub.id);
    setShowDetail(true);
  }

  function openEdit(sub: SubSubscription | null) {
    setEditing(sub);
    setShowForm(true);
  }

  function openRenewal(sub: SubSubscription) {
    setSelected(sub);
    setShowRenewal(true);
  }

  function openUpgrade(sub: SubSubscription) {
    setSelected(sub);
    setShowUpgrade(true);
  }

  async function openPayment(sub: SubSubscription) {
    if (Array.isArray(sub.paymentRecords)) {
      setSelected(sub);
      setShowPayment(true);
      return;
    }
    try {
      const full = await api.get<SubSubscription>(`/subscriptions/${sub.id}`);
      setSelected(full);
      setShowPayment(true);
    } catch (e: any) {
      toast(e?.message ?? "Gagal memuat data pembayaran langganan", "danger");
    }
  }

  async function openCancellation(sub: SubSubscription) {
    if (sub.cancellationRequests) {
      setSelected(sub);
      setShowCancellation(true);
      return;
    }
    try {
      const full = await api.get<SubSubscription>(`/subscriptions/${sub.id}`);
      setSelected(full);
      setShowCancellation(true);
    } catch {
      setSelected(sub);
      setShowCancellation(true);
    }
  }

  function openUsage(sub: SubSubscription) {
    setSelected(sub);
    setShowUsage(true);
  }

  function deleteSubscription(sub: SubSubscription) {
    void openCancellation(sub);
  }

  async function confirmDraft(draft: SubBillingSchedule) {
    setBusyDraft(draft.id);
    try {
      await api.post(`/subscriptions/billing-drafts/${draft.id}/confirm`, { postJournal: true });
      toast("Draft beban berhasil dikonfirmasi dan dijurnal");
      await refreshAll();
    } catch (e: any) {
      toast(e?.message ?? "Gagal mengonfirmasi draft", "danger");
    } finally {
      setBusyDraft(null);
    }
  }

  async function runReminders() {
    setReminderBusy(true);
    try {
      const result = await api.post<{ createdCount: number; asOfDate: string }>(
        "/subscriptions/reminders/run",
        {},
      );
      toast(`${result.createdCount} reminder renewal dibuat untuk ${result.asOfDate}`);
      await fetchLookups();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menjalankan reminder", "danger");
    } finally {
      setReminderBusy(false);
    }
  }

  const tabs = [
    { value: "registry", label: "Registry Langganan", count: subscriptions.length },
    { value: "renewal", label: "Renewal & Reminder", count: upcoming.length },
    { value: "drafts", label: "Draft Beban Berulang", count: drafts.length },
    { value: "reports", label: "Laporan" },
  ];

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16, paddingBottom: 64 }}
    >
      <View className="w-full gap-5">
        <PageHeader
          title="Manajemen Langganan (Subscription)"
          subtitle="Domain, hosting, VPS, software, SaaS, lisensi, API & layanan berulang lainnya"
          showRefresh
          onRefresh={refreshAll}
          action={
            <View className="flex-row flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-2 rounded-xl border-border/80 px-3"
                onPress={() => setShowMaster(true)}
              >
                <FolderKanban size={14} color={colors.text} />
                <Text className="text-xs font-semibold">Master Kategori & Provider</Text>
              </Button>
              {canCreate ? (
                <Button
                  size="sm"
                  className="h-9 gap-1.5 rounded-xl px-3"
                  onPress={() => openEdit(null)}
                >
                  <Plus size={14} color="#FFFFFF" />
                  <Text className="text-xs font-semibold text-white">Daftarkan Langganan</Text>
                </Button>
              ) : null}
            </View>
          }
        />

        <View className="w-full flex-row flex-wrap gap-3.5">
          <MetricCard
            label="Langganan Aktif"
            value={overview.totalActiveSubscriptions}
            hint={`${overview.upcomingRenewals} renewal dalam 30 hari`}
            color={colors.success}
            icon={CheckCircle2}
          />
          <MetricCard
            label="Monthly Recurring Cost"
            value={rupiah(overview.totalMonthlyRecurringCost)}
            hint={`ARC ${rupiah(overview.totalAnnualRecurringCost)} / tahun`}
            color={colors.primary}
            icon={Wallet}
          />
          <MetricCard
            label="Perlu Perhatian"
            value={overview.underReview + overview.pendingCancellation}
            hint={`${overview.underReview} review · ${overview.pendingCancellation} pembatalan`}
            color={colors.warning}
            icon={AlertTriangle}
          />
          <MetricCard
            label="Overdue / Expired"
            value={`${overview.overduePayments} / ${overview.expiredSubscriptions}`}
            hint="Pembayaran terlambat / langganan kedaluwarsa"
            color={colors.danger}
            icon={CalendarClock}
          />
        </View>

        <SubscriptionTabs
          tabs={tabs}
          value={activeTab}
          onChange={setActiveTab}
        />

        {activeTab === "registry" ? (
          <View className="w-full gap-4">
            <View className="w-full flex-row flex-wrap items-center gap-2.5 rounded-2xl border border-border/80 bg-card p-3.5 shadow-sm">
              <View className="flex min-w-[220px] flex-1 flex-row items-center rounded-xl border border-border/80 bg-card px-3 shadow-sm">
                <Search size={15} color={colors.textSecondary} />
                <Input
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Cari kode SUB, layanan, provider, akun, departemen..."
                  className="h-9 flex-1 border-0 bg-transparent px-2 text-xs shadow-none"
                />
              </View>

              <View className="w-full sm:w-44">
                <SearchableSelect
                  value={categoryOptions.find((o) => o.value === filterCategory)?.label ?? ""}
                  options={categoryOptions.map((o) => o.label)}
                  onChange={(label) => {
                    const match = categoryOptions.find((o) => o.label === label);
                    setFilterCategory(match?.value ?? "");
                  }}
                  placeholder="Semua Kategori"
                  clearable
                  className="h-10 rounded-xl border-border/80 bg-card px-3 shadow-sm"
                />
              </View>

              <View className="w-full sm:w-44">
                <SearchableSelect
                  value={providerOptions.find((o) => o.value === filterProvider)?.label ?? ""}
                  options={providerOptions.map((o) => o.label)}
                  onChange={(label) => {
                    const match = providerOptions.find((o) => o.label === label);
                    setFilterProvider(match?.value ?? "");
                  }}
                  placeholder="Semua Provider"
                  clearable
                  className="h-10 rounded-xl border-border/80 bg-card px-3 shadow-sm"
                />
              </View>

              <View className="w-full sm:w-40">
                <SearchableSelect
                  value={
                    SUBSCRIPTION_STATUS_OPTIONS.find((o) => o.value === filterStatus)?.label ??
                    "Semua Status"
                  }
                  options={SUBSCRIPTION_STATUS_OPTIONS.map((o) => o.label)}
                  onChange={(label) => {
                    const match = SUBSCRIPTION_STATUS_OPTIONS.find((o) => o.label === label);
                    setFilterStatus(match?.value ?? "");
                  }}
                  placeholder="Semua Status"
                  clearable
                  className="h-10 rounded-xl border-border/80 bg-card px-3 shadow-sm"
                />
              </View>

              <View className="w-full sm:w-40">
                <SearchableSelect
                  value={BILLING_CYCLE_OPTIONS.find((o) => o.value === filterCycle)?.label ?? ""}
                  options={BILLING_CYCLE_OPTIONS.map((o) => o.label)}
                  onChange={(label) => {
                    const match = BILLING_CYCLE_OPTIONS.find((o) => o.label === label);
                    setFilterCycle(match?.value ?? "");
                  }}
                  placeholder="Semua Siklus"
                  clearable
                  className="h-10 rounded-xl border-border/80 bg-card px-3 shadow-sm"
                />
              </View>

              <View className="w-full sm:w-40">
                <SearchableSelect
                  value={PAYMENT_STATUS_OPTIONS.find((o) => o.value === filterPayment)?.label ?? ""}
                  options={PAYMENT_STATUS_OPTIONS.map((o) => o.label)}
                  onChange={(label) => {
                    const match = PAYMENT_STATUS_OPTIONS.find((o) => o.label === label);
                    setFilterPayment(match?.value ?? "");
                  }}
                  placeholder="Semua Pembayaran"
                  clearable
                  className="h-10 rounded-xl border-border/80 bg-card px-3 shadow-sm"
                />
              </View>

              <View className="w-full sm:w-40">
                <Input
                  value={filterDepartment}
                  onChangeText={setFilterDepartment}
                  placeholder="Departemen"
                  className="h-10 rounded-xl border-border/80 bg-card px-3 text-xs shadow-sm"
                />
              </View>

              <Button
                size="sm"
                variant="ghost"
                onPress={refreshAll}
                className="h-10 w-10 rounded-xl border border-border/80 p-0 hover:bg-panel"
              >
                <RefreshCw
                  size={14}
                  color={colors.textSecondary}
                  className={loading ? "animate-spin" : ""}
                />
              </Button>
            </View>

            <View className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
              {loading ? (
                <View className="items-center justify-center py-20">
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text className="mt-2 text-xs text-muted-foreground">
                    Memuat daftar langganan...
                  </Text>
                </View>
              ) : subscriptions.length === 0 ? (
                <View className="items-center justify-center px-4 py-16">
                  <Database size={44} color={colors.muted} />
                  <Text className="mt-3 text-base font-bold text-foreground">
                    Belum Ada Langganan
                  </Text>
                  <Text className="mt-1 max-w-sm text-center text-xs text-muted-foreground">
                    Daftarkan domain, hosting, VPS, software, atau layanan SaaS agar renewal,
                    pembayaran, dan biaya berulang terpantau.
                  </Text>
                  {canCreate ? (
                    <Button
                      size="sm"
                      onPress={() => openEdit(null)}
                      className="mt-4 h-9 gap-1.5 rounded-xl px-4"
                    >
                      <Plus size={14} color="#FFFFFF" />
                      <Text className="text-xs font-semibold text-white">
                        Daftarkan Langganan Pertama
                      </Text>
                    </Button>
                  ) : null}
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="w-full"
                  contentContainerStyle={{ minWidth: "100%" }}
                >
                  <View className="w-full min-w-[1120px]">
                    <View className="flex-row items-center border-b border-border/80 bg-muted/40 px-4 py-3">
                      <Text className="w-36 px-2 text-xs font-semibold text-muted-foreground">
                        Kode SUB
                      </Text>
                      <Text className="min-w-[220px] flex-1 px-3 text-xs font-semibold text-muted-foreground">
                        Layanan & Provider
                      </Text>
                      <Text className="w-36 px-2 text-xs font-semibold text-muted-foreground">
                        Kategori
                      </Text>
                      <Text className="w-24 px-2 text-center text-xs font-semibold text-muted-foreground">
                        Siklus
                      </Text>
                      <Text className="w-40 px-3 text-right text-xs font-semibold text-muted-foreground">
                        Biaya / MRC
                      </Text>
                      <Text className="w-36 px-4 text-xs font-semibold text-muted-foreground">
                        Renewal
                      </Text>
                      <Text className="w-32 px-2 text-center text-xs font-semibold text-muted-foreground">
                        Status
                      </Text>
                      <Text className="w-40 px-2 text-center text-xs font-semibold text-muted-foreground">
                        Aksi
                      </Text>
                    </View>

                    {subscriptions.map((sub) => {
                      const days = daysUntil(sub.nextRenewalDate);
                      return (
                        <View
                          key={sub.id}
                          className="flex-row items-center border-b border-border/50 px-4 py-3 transition-colors hover:bg-muted/10"
                        >
                          <Pressable onPress={() => openDetail(sub)} className="w-36 px-2">
                            <Text className="font-mono text-xs font-bold text-primary hover:underline">
                              {sub.subscriptionCode}
                            </Text>
                            <Text className="text-[10px] text-muted-foreground">
                              {sub.category?.code ?? "-"}
                            </Text>
                          </Pressable>

                          <View className="min-w-[220px] flex-1 px-3">
                            <Text className="text-xs font-bold text-foreground" numberOfLines={1}>
                              {sub.serviceName}
                            </Text>
                            <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                              {sub.providerLabel ?? sub.providerName ?? sub.provider?.name ?? "-"}
                              {sub.subscriptionPlan ? ` · ${sub.subscriptionPlan}` : ""}
                              {sub.accountIdentifier ? ` · ${sub.accountIdentifier}` : ""}
                            </Text>
                          </View>

                          <View className="w-36 px-2">
                            <Text className="text-xs text-foreground" numberOfLines={1}>
                              {sub.categoryName ?? sub.category?.name ?? "-"}
                            </Text>
                          </View>

                          <View className="w-24 px-2 items-center">
                            <CycleBadge cycle={sub.billingCycle} />
                          </View>

                          <View className="w-40 px-3 items-end">
                            <Text className="text-xs font-bold text-foreground">
                              {rupiah(sub.cost)}
                            </Text>
                            <Text className="text-[10px] text-muted-foreground">
                              MRC {rupiah(sub.mrc)}
                            </Text>
                          </View>

                          <View className="w-36 px-4">
                            <Text className="text-xs font-medium">
                              {sub.nextRenewalDate ? tanggal(sub.nextRenewalDate) : "-"}
                            </Text>
                            {days != null ? (
                              <Text
                                className="text-[10px]"
                                style={{
                                  color:
                                    days < 0
                                      ? colors.danger
                                      : days <= 7
                                        ? colors.warning
                                        : colors.muted,
                                }}
                              >
                                {daysLabel(days)}
                              </Text>
                            ) : null}
                          </View>

                          <View className="w-32 px-2 items-center gap-1">
                            <SubscriptionStatusBadge status={sub.status} />
                            <PaymentStatusBadge status={sub.paymentStatus} />
                          </View>

                          <View className="w-40 px-2 flex-row items-center justify-center gap-1">
                            <Tooltip delayDuration={150}>
                              <TooltipTrigger
                                className="h-8 w-8 items-center justify-center rounded-lg p-1.5 hover:bg-accent"
                                onPress={() => openDetail(sub)}
                              >
                                <Eye size={14} className="text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <Text>Lihat Detail Langganan</Text>
                              </TooltipContent>
                            </Tooltip>
                            {canUpdate ? (
                              <Tooltip delayDuration={150}>
                                <TooltipTrigger
                                  className="h-8 w-8 items-center justify-center rounded-lg p-1.5 hover:bg-accent"
                                  onPress={() => openEdit(sub)}
                                >
                                  <Pencil size={14} className="text-foreground" />
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <Text>Edit Langganan</Text>
                                </TooltipContent>
                              </Tooltip>
                            ) : null}
                            {canUpdate ? (
                              <Tooltip delayDuration={150}>
                                <TooltipTrigger
                                  className="h-8 w-8 items-center justify-center rounded-lg p-1.5 hover:bg-accent"
                                  onPress={() => openRenewal(sub)}
                                >
                                  <RefreshCw size={14} className="text-primary" />
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <Text>Perpanjang Langganan (Renewal)</Text>
                                </TooltipContent>
                              </Tooltip>
                            ) : null}
                            {canCreate ? (
                              <Tooltip delayDuration={150}>
                                <TooltipTrigger
                                  className="h-8 w-8 items-center justify-center rounded-lg p-1.5 hover:bg-accent"
                                  onPress={() => openPayment(sub)}
                                >
                                  <Wallet size={14} className="text-success" />
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <Text>Catat Pembayaran</Text>
                                </TooltipContent>
                              </Tooltip>
                            ) : null}
                            {canDelete ? (
                              <Tooltip delayDuration={150}>
                                <TooltipTrigger
                                  className="h-8 w-8 items-center justify-center rounded-lg p-1.5 hover:bg-accent"
                                  onPress={() => deleteSubscription(sub)}
                                >
                                  <Trash2 size={14} className="text-destructive" />
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <Text>Ajukan Pembatalan Langganan</Text>
                                </TooltipContent>
                              </Tooltip>
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        ) : null}

        {activeTab === "renewal" ? (
          <View className="gap-4">
            <View className="flex-row flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/80 bg-card p-3.5 shadow-sm">
              <View className="min-w-[200px] flex-1">
                <Text className="text-sm font-bold">Renewal & Reminder</Text>
                <Text className="text-[11px] text-muted-foreground">
                  Renewal tidak otomatis; keputusan dilakukan manual. Reminder dikirim ke PIC atau
                  Finance.
                </Text>
              </View>
              <View className="flex-row flex-wrap items-center gap-2">
                <View className="w-40">
                  <SearchableSelect
                    value={
                      {
                        "30": "30 hari",
                        "60": "60 hari",
                        "90": "90 hari",
                        "180": "180 hari",
                        all: "Semua",
                      }[renewalWindow] ?? "30 hari"
                    }
                    options={["30 hari", "60 hari", "90 hari", "180 hari", "Semua"]}
                    onChange={(label) => {
                      const next =
                        label === "Semua"
                          ? "all"
                          : label.startsWith("60")
                            ? "60"
                            : label.startsWith("90")
                              ? "90"
                              : label.startsWith("180")
                                ? "180"
                                : "30";
                      setRenewalWindow(next);
                    }}
                    className="h-10 rounded-xl border-border/80 bg-card px-3 shadow-sm"
                  />
                </View>
                {canUpdate ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-10 gap-1.5 rounded-xl"
                    onPress={runReminders}
                    disabled={reminderBusy}
                  >
                    <BellRing size={14} color={colors.primary} />
                    <Text className="text-xs">
                      {reminderBusy ? "Menjalankan..." : "Jalankan Reminder"}
                    </Text>
                  </Button>
                ) : null}
              </View>
            </View>

            {upcoming.length === 0 ? (
              <Panel>
                <EmptyRow text="Tidak ada renewal pada rentang waktu ini." />
              </Panel>
            ) : (
              <View className="w-full flex-row flex-wrap gap-3">
                {upcoming.map((sub) => {
                  const days = daysUntil(sub.nextRenewalDate);
                  const urgent = days != null && days <= 7;
                  return (
                    <View
                      key={sub.id}
                      className="min-w-[300px] flex-1 gap-3 rounded-2xl border bg-card p-4 shadow-sm"
                      style={{ borderColor: urgent ? `${colors.warning}66` : undefined }}
                    >
                      <View className="flex-row items-start justify-between gap-2">
                        <View className="min-w-0 flex-1">
                          <Text className="font-mono text-[10px] font-bold text-primary">
                            {sub.subscriptionCode}
                          </Text>
                          <Text className="text-sm font-bold" numberOfLines={1}>
                            {sub.serviceName}
                          </Text>
                          <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                            {sub.providerLabel ?? sub.providerName ?? sub.provider?.name ?? "-"} ·{" "}
                            {sub.categoryName ?? sub.category?.name ?? "-"}
                          </Text>
                        </View>
                        <SubscriptionStatusBadge status={sub.status} />
                      </View>

                      <View className="flex-row flex-wrap gap-2">
                        <View className="min-w-[110px] flex-1 rounded-lg border border-border/70 bg-muted/20 px-2.5 py-2">
                          <Text className="text-[10px] uppercase text-muted-foreground">
                            Renewal
                          </Text>
                          <Text className="text-xs font-semibold">
                            {sub.nextRenewalDate ? tanggal(sub.nextRenewalDate) : "-"}
                          </Text>
                          <Text
                            className="text-[10px]"
                            style={{
                              color: urgent ? colors.warning : colors.muted,
                            }}
                          >
                            {daysLabel(days)}
                          </Text>
                        </View>
                        <View className="min-w-[110px] flex-1 rounded-lg border border-border/70 bg-muted/20 px-2.5 py-2">
                          <Text className="text-[10px] uppercase text-muted-foreground">Biaya</Text>
                          <Text className="text-xs font-semibold">{rupiah(sub.cost)}</Text>
                          <Text className="text-[10px] text-muted-foreground">
                            {cycleText(sub.billingCycle)} · MRC {rupiah(sub.mrc)}
                          </Text>
                        </View>
                        <View className="min-w-[110px] flex-1 rounded-lg border border-border/70 bg-muted/20 px-2.5 py-2">
                          <Text className="text-[10px] uppercase text-muted-foreground">
                            Pembayaran
                          </Text>
                          <View className="mt-0.5">
                            <PaymentStatusBadge status={sub.paymentStatus} />
                          </View>
                        </View>
                      </View>

                      <View className="flex-row flex-wrap items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 flex-1 gap-1.5"
                          onPress={() => openDetail(sub)}
                        >
                          <Eye size={13} color={colors.primary} />
                          <Text className="text-[11px]">Detail</Text>
                        </Button>
                        {canUpdate ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 flex-1 gap-1.5"
                            onPress={() => openRenewal(sub)}
                          >
                            <RefreshCw size={13} color={colors.primary} />
                            <Text className="text-[11px]">Renew</Text>
                          </Button>
                        ) : null}
                        {canUpdate ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5"
                            onPress={() => openUpgrade(sub)}
                          >
                            <ArrowUpCircle size={13} color={colors.primary} />
                            <Text className="text-[11px]">Upgrade</Text>
                          </Button>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}

        {activeTab === "drafts" ? (
          <View className="gap-4">
            <View className="flex-row flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/80 bg-card p-3.5 shadow-sm">
              <View className="min-w-[220px] flex-1">
                <Text className="text-sm font-bold">Draft Beban Berulang</Text>
                <Text className="text-[11px] text-muted-foreground">
                  Draft dari langganan non-bulanan/tagihan berikutnya. Konfirmasi membuat jurnal Dr
                  Beban/Prepaid · Cr Hutang (210102).
                </Text>
              </View>
              <Button
                size="sm"
                variant="outline"
                className="h-9 gap-1.5 rounded-xl"
                onPress={async () => {
                  setDraftsLoading(true);
                  await fetchLookups();
                  setDraftsLoading(false);
                }}
                disabled={draftsLoading}
              >
                <RefreshCw size={13} color={colors.primary} />
                <Text className="text-xs">{draftsLoading ? "Memuat..." : "Muat Draft"}</Text>
              </Button>
            </View>

            <View className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
              {drafts.length === 0 ? (
                <EmptyRow text="Belum ada draft beban berulang. Buat dari detail langganan." />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="min-w-[760px]">
                    <View className="flex-row border-b border-border/80 bg-muted/40 px-5 py-3">
                      <Text className="w-32 text-xs font-semibold text-muted-foreground">
                        Jatuh Tempo
                      </Text>
                      <Text className="min-w-[240px] flex-1 text-xs font-semibold text-muted-foreground">
                        Langganan
                      </Text>
                      <Text className="w-32 text-xs font-semibold text-muted-foreground">
                        Periode
                      </Text>
                      <Text className="w-32 text-right text-xs font-semibold text-muted-foreground">
                        Nominal
                      </Text>
                      <Text className="w-24 text-center text-xs font-semibold text-muted-foreground">
                        Status
                      </Text>
                      <Text className="w-32 text-center text-xs font-semibold text-muted-foreground">
                        Aksi
                      </Text>
                    </View>
                    {drafts.map((draft) => (
                      <View
                        key={draft.id}
                        className="flex-row items-center border-b border-border/50 px-5 py-3"
                      >
                        <Text className="w-32 text-xs">{tanggal(draft.dueDate)}</Text>
                        <View className="min-w-[240px] flex-1 pr-2">
                          <Text className="text-xs font-bold">
                            {draft.subscription?.serviceName ?? "-"}
                          </Text>
                          <Text className="font-mono text-[10px] text-muted-foreground">
                            {draft.subscription?.subscriptionCode ?? "-"}
                          </Text>
                        </View>
                        <Text className="w-32 text-xs">{draft.periodLabel ?? "-"}</Text>
                        <Text className="w-32 pr-2 text-right text-xs font-bold">
                          {rupiah(draft.amount)}
                        </Text>
                        <View className="w-24 items-center">
                          <View className="rounded-full border border-border bg-muted/30 px-2 py-0.5">
                            <Text className="text-[10px] font-semibold text-muted-foreground">
                              {draft.status}
                            </Text>
                          </View>
                        </View>
                        <View className="w-32 items-center">
                          {draft.status === "POSTED" ? (
                            <Text className="text-[10px] text-success">Sudah dijurnal</Text>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8"
                              onPress={() => confirmDraft(draft)}
                              disabled={busyDraft === draft.id}
                            >
                              <Text className="text-[10px]">
                                {busyDraft === draft.id ? "..." : "Konfirmasi"}
                              </Text>
                            </Button>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        ) : null}

        {activeTab === "reports" ? (
          <SubscriptionReportsPanel
            categories={categories}
            providers={providers}
            onRefresh={refreshAll}
          />
        ) : null}
      </View>

      {showMaster ? (
        <SubscriptionMasterDialog
          visible={showMaster}
          onClose={() => setShowMaster(false)}
          categories={categories}
          providers={providers}
          onChanged={fetchLookups}
          canCreate={canCreate}
          canUpdate={canUpdate}
          canDelete={canDelete}
        />
      ) : null}

      {showForm ? (
        <SubscriptionFormDialog
          visible={showForm}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          subscription={editing}
          categories={categories}
          providers={providers}
          onRefreshLookups={fetchLookups}
          onSuccess={refreshAll}
        />
      ) : null}

      {showDetail && detailId ? (
        <SubscriptionDetailDialog
          visible={showDetail}
          subscriptionId={detailId}
          onClose={() => {
            setShowDetail(false);
            setDetailId(null);
          }}
          onRefresh={refreshAll}
          onEdit={(sub) => {
            setShowDetail(false);
            openEdit(sub);
          }}
          onRenew={(sub) => {
            setShowDetail(false);
            openRenewal(sub);
          }}
          onUpgrade={(sub) => {
            setShowDetail(false);
            openUpgrade(sub);
          }}
          onPayment={(sub) => {
            setShowDetail(false);
            openPayment(sub);
          }}
          onCancellation={(sub) => {
            setShowDetail(false);
            openCancellation(sub);
          }}
          onUsage={(sub) => {
            setShowDetail(false);
            openUsage(sub);
          }}
        />
      ) : null}

      {showRenewal && selected ? (
        <SubscriptionRenewalDialog
          visible={showRenewal}
          subscription={selected}
          onClose={() => setShowRenewal(false)}
          onSuccess={refreshAll}
        />
      ) : null}

      {showUpgrade && selected ? (
        <SubscriptionUpgradeDialog
          visible={showUpgrade}
          subscription={selected}
          onClose={() => setShowUpgrade(false)}
          onSuccess={refreshAll}
        />
      ) : null}

      {showPayment && selected ? (
        <SubscriptionPaymentDialog
          visible={showPayment}
          subscription={selected}
          onClose={() => setShowPayment(false)}
          onSuccess={refreshAll}
        />
      ) : null}

      {showCancellation && selected ? (
        <SubscriptionCancellationDialog
          visible={showCancellation}
          subscription={selected}
          onClose={() => setShowCancellation(false)}
          onSuccess={refreshAll}
        />
      ) : null}

      {showUsage && selected ? (
        <SubscriptionUsageDialog
          visible={showUsage}
          subscription={selected}
          onClose={() => setShowUsage(false)}
          onSuccess={refreshAll}
        />
      ) : null}
    </ScrollView>
  );
}
