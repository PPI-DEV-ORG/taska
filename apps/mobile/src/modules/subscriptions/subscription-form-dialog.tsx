import * as React from "react";
import { ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import { Plus, Trash2, X } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker, SearchableSelect, UserSelect } from "@/components/taska/dialogs";
import { FileUploader } from "@/components/taska/file-uploader";
import { FormField } from "@/components/taska/basics";
import { colors } from "@/tokens";
import { formatThousands } from "@/lib/format";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import { hasUserPermission } from "@/constants/modules";
import type { CostAllocation, SubCategory, SubProvider, SubSubscription } from "./types";
import { SubscriptionCategorySelect } from "./subscription-category-select";
import { SubscriptionProviderSelect } from "./subscription-provider-select";
import {
  BILLING_CYCLE_OPTIONS,
  CYCLE_LABEL,
  PAYMENT_STATUS_OPTIONS,
  SUBSCRIPTION_STATUS_OPTIONS,
  addMonthsIso,
  cycleEndDate,
  isoDate,
  mrcFor,
  todayIso,
} from "./subscription-utils";

type Props = {
  visible: boolean;
  onClose: () => void;
  subscription?: SubSubscription | null;
  categories: SubCategory[];
  providers: SubProvider[];
  onRefreshLookups: () => void;
  onSuccess: () => void;
};

type FormState = {
  serviceName: string;
  categoryId: number | null;
  providerId: number | null;
  accountIdentifier: string;
  serviceUrl: string;
  subscriptionPlan: string;
  billingCycle: string;
  startDate: string;
  expirationDate: string;
  nextRenewalDate: string;
  autoRenewal: boolean;
  currency: string;
  cost: string;
  tax: string;
  originalCurrency: string;
  originalAmount: string;
  exchangeRate: string;
  exchangeRateDate: string;
  idrEquivalent: string;
  department: string;
  picUserId: string;
  businessPurpose: string;
  status: string;
  paymentStatus: string;
  paymentInvoiceNumber: string;
  paymentDate: string;
  paymentAccountCode: string;
  paymentInvoiceFileUrl: string;
  paymentProofUrl: string;
  expenseAccountCode: string;
  prepaidAccountCode: string;
  notes: string;
  allocations: CostAllocation[];
};

const PAYMENT_ACCOUNT_OPTIONS = [
  { code: "1000.02", label: "1000.02 - Bank Mandiri PT GMP" },
  { code: "1000.01", label: "1000.01 - Kas Operasional" },
  { code: "1000.03", label: "1000.03 - Kas Kecil (Petty Cash)" },
  { code: "210102", label: "210102 - Account Payable (Hutang Usaha)" },
];

function defaultForm(): FormState {
  const start = todayIso();
  return {
    serviceName: "",
    categoryId: null,
    providerId: null,
    accountIdentifier: "",
    serviceUrl: "",
    subscriptionPlan: "",
    billingCycle: "ANNUAL",
    startDate: start,
    expirationDate: cycleEndDate(start, "ANNUAL"),
    nextRenewalDate: cycleEndDate(start, "ANNUAL"),
    autoRenewal: false,
    currency: "IDR",
    cost: "",
    tax: "",
    originalCurrency: "",
    originalAmount: "",
    exchangeRate: "",
    exchangeRateDate: "",
    idrEquivalent: "",
    department: "",
    picUserId: "",
    businessPurpose: "",
    status: "ACTIVE",
    paymentStatus: "UNPAID",
    paymentInvoiceNumber: "",
    paymentDate: start,
    paymentAccountCode: "1000.02",
    paymentInvoiceFileUrl: "",
    paymentProofUrl: "",
    expenseAccountCode: "6122",
    prepaidAccountCode: "1401",
    notes: "",
    allocations: [{ department: "", percentage: 100, allocatedAmount: 0 }],
  };
}

function formFromRow(row: SubSubscription): FormState {
  return {
    serviceName: row.serviceName ?? "",
    categoryId: row.categoryId ?? null,
    providerId: row.providerId ?? null,
    accountIdentifier: row.accountIdentifier ?? "",
    serviceUrl: row.serviceUrl ?? "",
    subscriptionPlan: row.subscriptionPlan ?? "",
    billingCycle: row.billingCycle ?? "ANNUAL",
    startDate: row.startDate ? String(row.startDate).slice(0, 10) : todayIso(),
    expirationDate: row.expirationDate ? String(row.expirationDate).slice(0, 10) : "",
    nextRenewalDate: row.nextRenewalDate ? String(row.nextRenewalDate).slice(0, 10) : "",
    autoRenewal: Boolean(row.autoRenewal),
    currency: row.currency ?? "IDR",
    cost: row.cost != null ? String(Math.round(Number(row.cost))) : "",
    tax: row.tax != null ? String(Math.round(Number(row.tax))) : "",
    originalCurrency: row.originalCurrency ?? "",
    originalAmount: row.originalAmount != null ? String(row.originalAmount) : "",
    exchangeRate: row.exchangeRate != null ? String(row.exchangeRate) : "",
    exchangeRateDate: row.exchangeRateDate ? String(row.exchangeRateDate).slice(0, 10) : "",
    idrEquivalent: row.idrEquivalent != null ? String(Math.round(Number(row.idrEquivalent))) : "",
    department: row.department ?? "",
    picUserId: row.picUserId ? String(row.picUserId) : "",
    businessPurpose: row.businessPurpose ?? "",
    status: row.status ?? "ACTIVE",
    paymentStatus: row.paymentStatus ?? "UNPAID",
    paymentInvoiceNumber: "",
    paymentDate: row.startDate ? String(row.startDate).slice(0, 10) : todayIso(),
    paymentAccountCode: "1000.02",
    paymentInvoiceFileUrl: "",
    paymentProofUrl: "",
    expenseAccountCode: row.expenseAccountCode ?? row.category?.expenseAccountCode ?? "6122",
    prepaidAccountCode: row.prepaidAccountCode ?? row.category?.prepaidAccountCode ?? "1401",
    notes: row.notes ?? "",
    allocations:
      row.allocations && row.allocations.length > 0
        ? row.allocations.map((a) => ({
            department: a.department,
            percentage: Number(a.percentage) || 0,
            allocatedAmount: Number(a.allocatedAmount) || 0,
            projectId: a.projectId ?? null,
          }))
        : [{ department: row.department ?? "", percentage: 100, allocatedAmount: Number(row.cost) || 0 }],
  };
}

export function SubscriptionFormDialog(props: Props) {
  if (!props.visible) return null;
  return <FormContent key={props.subscription?.id ?? "create"} {...props} />;
}

function FormContent({
  onClose,
  subscription,
  categories,
  providers,
  onRefreshLookups,
  onSuccess,
}: Props) {
  const { toast, user } = useApp();
  const canCreate = hasUserPermission(user, "subscriptions", "C");
  const [form, setForm] = React.useState<FormState>(() =>
    subscription ? formFromRow(subscription) : defaultForm(),
  );
  const [taxMode, setTaxMode] = React.useState<"11" | "12" | "0" | "custom">(() => {
    if (!subscription) return "11";
    const c = Number(subscription.cost) || 0;
    const t = Number(subscription.tax) || 0;
    if (t === 0) return "0";
    if (c > 0 && Math.abs(t - Math.round(c * 0.11)) <= 1) return "11";
    if (c > 0 && Math.abs(t - Math.round(c * 0.12)) <= 1) return "12";
    return "custom";
  });
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const handleCostChange = (val: string) => {
    const digits = val.replace(/\D/g, "");
    const num = Number(digits) || 0;
    let nextTax = form.tax;
    if (taxMode === "11") {
      nextTax = num > 0 ? String(Math.round(num * 0.11)) : "";
    } else if (taxMode === "12") {
      nextTax = num > 0 ? String(Math.round(num * 0.12)) : "";
    } else if (taxMode === "0") {
      nextTax = "0";
    }
    setForm((prev) => ({
      ...prev,
      cost: digits,
      tax: nextTax,
      allocations: prev.allocations.map((a) => ({
        ...a,
        allocatedAmount: Math.round((Number(a.percentage || 0) / 100) * num),
      })),
    }));
    setErrors((prev) => ({ ...prev, cost: "" }));
  };

  const applyTaxRate = (rate: "11" | "12" | "0" | "custom") => {
    setTaxMode(rate);
    const num = Number(form.cost) || 0;
    if (rate === "0") {
      set("tax", "0");
    } else if (rate === "11") {
      set("tax", num > 0 ? String(Math.round(num * 0.11)) : "");
    } else if (rate === "12") {
      set("tax", num > 0 ? String(Math.round(num * 0.12)) : "");
    }
  };

  const selectedCategory = categories.find((c) => c.id === form.categoryId) ?? null;
  const selectedProvider = providers.find((p) => p.id === form.providerId) ?? null;
  const costNumber = Number(form.cost.replace(/\D/g, "")) || 0;
  const taxNumber = Number(form.tax.replace(/\D/g, "")) || 0;
  const mrc = mrcFor(costNumber, form.billingCycle, form.startDate, form.expirationDate);
  const allocationSum = form.allocations.reduce(
    (sum, row) => sum + (Number(row.percentage) || 0),
    0,
  );

  function handleCategory(category: SubCategory | null) {
    setForm((prev) => ({
      ...prev,
      categoryId: category?.id ?? null,
      billingCycle: category?.defaultBillingCycle ?? prev.billingCycle,
      expenseAccountCode: category?.expenseAccountCode ?? prev.expenseAccountCode,
      prepaidAccountCode: category?.prepaidAccountCode ?? prev.prepaidAccountCode,
    }));
    setErrors((prev) => ({ ...prev, categoryId: "" }));
  }

  function handleProvider(provider: SubProvider | null) {
    set("providerId", provider?.id ?? null);
  }

  function handleStartDate(value: string) {
    setForm((prev) => {
      const autoEnd = cycleEndDate(value, prev.billingCycle);
      const shouldSyncEnd = !prev.expirationDate || prev.expirationDate === cycleEndDate(prev.startDate, prev.billingCycle);
      const shouldSyncRenewal = !prev.nextRenewalDate || prev.nextRenewalDate === prev.expirationDate;
      return {
        ...prev,
        startDate: value,
        expirationDate: shouldSyncEnd ? autoEnd : prev.expirationDate,
        nextRenewalDate: shouldSyncRenewal ? autoEnd : prev.nextRenewalDate,
      };
    });
  }

  function handleCycle(value: string) {
    setForm((prev) => {
      const autoEnd = cycleEndDate(prev.startDate, value);
      return {
        ...prev,
        billingCycle: value,
        expirationDate: autoEnd,
        nextRenewalDate: autoEnd,
      };
    });
  }

  function setAllocation(index: number, patch: Partial<CostAllocation>) {
    setForm((prev) => ({
      ...prev,
      allocations: prev.allocations.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  }

  function addAllocation() {
    setForm((prev) => ({
      ...prev,
      allocations: [
        ...prev.allocations,
        { department: "", percentage: 0, allocatedAmount: 0 },
      ],
    }));
  }

  function removeAllocation(index: number) {
    setForm((prev) => ({
      ...prev,
      allocations: prev.allocations.filter((_, i) => i !== index),
    }));
  }

  function buildPayload() {
    const allocations = form.allocations
      .filter((a) => a.department.trim())
      .map((a) => ({
        department: a.department.trim(),
        percentage: Number(a.percentage) || 0,
        projectId: a.projectId ?? undefined,
      }));
    return {
      serviceName: form.serviceName.trim(),
      categoryId: form.categoryId,
      providerId: form.providerId ?? undefined,
      accountIdentifier: form.accountIdentifier.trim() || undefined,
      serviceUrl: form.serviceUrl.trim() || undefined,
      subscriptionPlan: form.subscriptionPlan.trim() || undefined,
      billingCycle: form.billingCycle,
      startDate: form.startDate,
      expirationDate: form.expirationDate || undefined,
      nextRenewalDate: form.nextRenewalDate || form.expirationDate || undefined,
      autoRenewal: form.autoRenewal,
      currency: form.currency || "IDR",
      cost: costNumber,
      tax: taxNumber,
      originalCurrency: form.originalCurrency.trim() || undefined,
      originalAmount: form.originalAmount ? Number(form.originalAmount.replace(/[^\d.]/g, "")) : undefined,
      exchangeRate: form.exchangeRate ? Number(form.exchangeRate.replace(/[^\d.]/g, "")) : undefined,
      exchangeRateDate: form.exchangeRateDate || undefined,
      idrEquivalent: form.idrEquivalent ? Number(form.idrEquivalent.replace(/\D/g, "")) : undefined,
      department: form.department.trim(),
      picUserId: form.picUserId ? Number(form.picUserId) : undefined,
      businessPurpose: form.businessPurpose.trim(),
      status: form.status,
      paymentStatus: form.paymentStatus,
      paymentInvoiceNumber: subscription?.id ? undefined : (form.paymentInvoiceNumber.trim() || undefined),
      paymentDate: subscription?.id ? undefined : (form.paymentDate || undefined),
      paymentAccountCode: subscription?.id ? undefined : (form.paymentAccountCode || undefined),
      paymentInvoiceFileUrl: subscription?.id ? undefined : (form.paymentInvoiceFileUrl || undefined),
      paymentProofUrl: subscription?.id ? undefined : (form.paymentProofUrl || undefined),
      expenseAccountCode: form.expenseAccountCode.trim() || undefined,
      prepaidAccountCode: form.prepaidAccountCode.trim() || undefined,
      notes: form.notes.trim() || undefined,
      allocations,
    };
  }

  async function save() {
    const nextErrors: Record<string, string> = {};
    if (!form.serviceName.trim()) nextErrors.serviceName = "Nama layanan wajib diisi.";
    if (!form.categoryId) nextErrors.categoryId = "Kategori wajib dipilih.";
    if (!form.providerId) nextErrors.providerId = "Provider wajib dipilih.";
    if (!form.startDate) nextErrors.startDate = "Tanggal mulai wajib diisi.";
    if (!form.department.trim()) nextErrors.department = "Departemen wajib diisi.";
    if (!form.businessPurpose.trim()) nextErrors.businessPurpose = "Tujuan bisnis wajib diisi.";
    if (costNumber <= 0) nextErrors.cost = "Biaya harus lebih dari 0.";
    if (Math.abs(allocationSum - 100) > 0.01) {
      nextErrors.allocations = `Total alokasi harus 100%. Saat ini ${allocationSum.toFixed(2)}%.`;
    }
    if (!subscription?.id && form.paymentStatus === "PAID" && form.paymentAccountCode !== "210102" && !form.paymentProofUrl.trim()) {
      toast("Bukti pembayaran wajib diunggah untuk status PAID (Lunas)", "danger");
      return;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast("Lengkapi data yang wajib diisi", "danger");
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (subscription?.id) {
        await api.patch(`/subscriptions/${subscription.id}`, payload);
        toast("Langganan berhasil diperbarui");
      } else {
        await api.post("/subscriptions", payload);
        toast("Langganan berhasil dibuat");
      }
      onSuccess();
      onClose();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menyimpan langganan", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-5xl max-h-[92vh]">
        <DialogHeader>
          <DialogTitle>
            {subscription ? `Edit Langganan · ${subscription.subscriptionCode}` : "Daftarkan Langganan Baru"}
          </DialogTitle>
        </DialogHeader>

        <ScrollView className="max-h-[72vh]" contentContainerStyle={{ paddingBottom: 8 }}>
          <View className="gap-4">
            <View className="rounded-xl border border-border/70 bg-muted/20 p-3">
              <Text className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                1. Identitas Layanan
              </Text>
              <View className="flex-row flex-wrap gap-3">
                <View className="min-w-[240px] flex-1">
                  <FormField label="Nama Layanan" required error={errors.serviceName}>
                    <TextInput
                      value={form.serviceName}
                      onChangeText={(value) => set("serviceName", value)}
                      placeholder="Contoh: AWS EC2 Production, Domain samtek.co.id"
                      className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                    />
                  </FormField>
                </View>
                <View className="min-w-[220px] flex-1">
                  <FormField label="Kategori" required error={errors.categoryId}>
                    <SubscriptionCategorySelect
                      value={form.categoryId}
                      categories={categories}
                      onChange={handleCategory}
                      onRefresh={onRefreshLookups}
                      canCreate={canCreate}
                      error={Boolean(errors.categoryId)}
                    />
                  </FormField>
                </View>
                <View className="min-w-[220px] flex-1">
                  <FormField label="Provider / Vendor" required error={errors.providerId}>
                    <SubscriptionProviderSelect
                      value={form.providerId}
                      providers={providers}
                      onChange={handleProvider}
                      onRefresh={onRefreshLookups}
                      canCreate={canCreate}
                      error={Boolean(errors.providerId)}
                    />
                  </FormField>
                </View>
              </View>

              <View className="mt-3 flex-row flex-wrap gap-3">
                <View className="min-w-[200px] flex-1">
                  <FormField label="ID Akun / Akun Layanan">
                    <TextInput
                      value={form.accountIdentifier}
                      onChangeText={(value) => set("accountIdentifier", value)}
                      placeholder="Contoh: 1234-5678-9012 / account@email.com"
                      className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                    />
                  </FormField>
                </View>
                <View className="min-w-[200px] flex-1">
                  <FormField label="URL Layanan">
                    <TextInput
                      value={form.serviceUrl}
                      onChangeText={(value) => set("serviceUrl", value)}
                      placeholder="https://console.aws.amazon.com"
                      autoCapitalize="none"
                      className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                    />
                  </FormField>
                </View>
                <View className="min-w-[180px] flex-1">
                  <FormField label="Paket / Plan">
                    <TextInput
                      value={form.subscriptionPlan}
                      onChangeText={(value) => set("subscriptionPlan", value)}
                      placeholder="Business, Pro, Standard..."
                      className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                    />
                  </FormField>
                </View>
              </View>
            </View>

            <View className="rounded-xl border border-border/70 bg-muted/20 p-3">
              <Text className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                2. Siklus & Periode
              </Text>
              <View className="flex-row flex-wrap gap-3">
                <View className="min-w-[200px] flex-1">
                  <FormField label="Billing Cycle" required>
                    <SearchableSelect
                      value={CYCLE_LABEL[form.billingCycle] ?? form.billingCycle}
                      options={BILLING_CYCLE_OPTIONS.map((x) => x.label)}
                      onChange={(label) => {
                        const found = BILLING_CYCLE_OPTIONS.find((x) => x.label === label);
                        handleCycle(found?.value ?? "ANNUAL");
                      }}
                      className="h-11 rounded-lg border-border/80 bg-card"
                    />
                  </FormField>
                </View>
                <View className="min-w-[180px] flex-1">
                  <FormField label="Tanggal Mulai" required error={errors.startDate}>
                    <DatePicker
                      value={form.startDate}
                      onChange={handleStartDate}
                      className={errors.startDate ? "border-danger" : undefined}
                    />
                  </FormField>
                </View>
                <View className="min-w-[180px] flex-1">
                  <FormField label="Berakhir Pada">
                    <DatePicker
                      value={form.expirationDate}
                      onChange={(value) => set("expirationDate", value)}
                    />
                  </FormField>
                </View>
                <View className="min-w-[180px] flex-1">
                  <FormField label="Next Renewal">
                    <DatePicker
                      value={form.nextRenewalDate}
                      onChange={(value) => set("nextRenewalDate", value)}
                    />
                  </FormField>
                </View>
              </View>
              <View className="mt-3 flex-row flex-wrap items-center gap-3">
                <TouchableOpacity
                  onPress={() => set("autoRenewal", !form.autoRenewal)}
                  className="flex-row items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
                >
                  <View
                    className={`h-5 w-5 items-center justify-center rounded border ${
                      form.autoRenewal ? "border-primary bg-primary" : "border-border bg-background"
                    }`}
                  >
                    {form.autoRenewal ? <Text className="text-[11px] font-bold text-white">✓</Text> : null}
                  </View>
                  <Text className="text-xs">Auto-renewal di provider (atribut, bukan perpanjangan otomatis)</Text>
                </TouchableOpacity>
                <Text className="text-[11px] text-muted-foreground">
                  Sistem tidak akan memperpanjang otomatis tanpa keputusan & approval.
                </Text>
              </View>
            </View>

            <View className="rounded-xl border border-border/70 bg-muted/20 p-3">
              <View className="mb-3 flex-row flex-wrap items-center justify-between gap-2">
                <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  3. Biaya, Pajak & Kurs
                </Text>
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-[11px] font-semibold text-muted-foreground">Opsi Pajak:</Text>
                  {[
                    { id: "0", label: "0% (Non-PPN)" },
                    { id: "11", label: "PPN 11%" },
                    { id: "12", label: "PPN 12%" },
                    { id: "custom", label: "Kustom" },
                  ].map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() => applyTaxRate(t.id as any)}
                      className={`rounded-md border px-2 py-0.5 ${
                        taxMode === t.id
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card"
                      }`}
                    >
                      <Text
                        className={`text-[10px] font-bold ${
                          taxMode === t.id ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View className="flex-row flex-wrap gap-3">
                <View className="min-w-[150px] flex-1">
                  <FormField label="Mata Uang">
                    <SearchableSelect
                      value={form.currency}
                      options={["IDR", "USD", "SGD", "EUR", "AUD", "JPY"]}
                      onChange={(value) => set("currency", value)}
                      className="h-11 rounded-lg border-border/80 bg-card"
                    />
                  </FormField>
                </View>
                <View className="min-w-[180px] flex-1">
                  <FormField label="Biaya (Cost) *" required error={errors.cost}>
                    <TextInput
                      value={formatThousands(form.cost)}
                      onChangeText={handleCostChange}
                      keyboardType="numeric"
                      placeholder="0"
                      className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                    />
                  </FormField>
                </View>
                <View className="min-w-[150px] flex-1">
                  <FormField label={`Pajak / VAT ${taxMode !== "custom" && taxMode !== "0" ? `(${taxMode}%)` : ""}`}>
                    <TextInput
                      value={formatThousands(form.tax)}
                      onChangeText={(value) => {
                        setTaxMode("custom");
                        set("tax", value.replace(/\D/g, ""));
                      }}
                      keyboardType="numeric"
                      placeholder="0"
                      className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                    />
                  </FormField>
                </View>
                <View className="min-w-[180px] flex-1">
                  <FormField label="MRC (otomatis)">
                    <View className="h-11 justify-center rounded-lg border border-border bg-muted/30 px-3">
                      <Text className="text-sm font-semibold text-primary">
                        Rp {mrc.toLocaleString("id-ID")} / bulan
                      </Text>
                    </View>
                  </FormField>
                </View>
              </View>

              <View className="mt-2.5 flex-row items-center justify-between rounded-lg border border-border/70 bg-card px-3 py-2">
                <Text className="text-xs text-muted-foreground">Total Tagihan (Biaya + Pajak):</Text>
                <Text className="text-sm font-bold text-foreground">
                  Rp {(costNumber + taxNumber).toLocaleString("id-ID")}
                </Text>
              </View>
              {form.currency !== "IDR" ? (
                <View className="mt-3 flex-row flex-wrap gap-3">
                  <View className="min-w-[150px] flex-1">
                    <FormField label="Mata Uang Asli">
                      <TextInput
                        value={form.originalCurrency}
                        onChangeText={(value) => set("originalCurrency", value.toUpperCase())}
                        placeholder={form.currency}
                        className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                      />
                    </FormField>
                  </View>
                  <View className="min-w-[180px] flex-1">
                    <FormField label="Nominal Asli">
                      <TextInput
                        value={form.originalAmount}
                        onChangeText={(value) => set("originalAmount", value)}
                        keyboardType="numeric"
                        placeholder="0.00"
                        className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                      />
                    </FormField>
                  </View>
                  <View className="min-w-[150px] flex-1">
                    <FormField label="Kurs">
                      <TextInput
                        value={form.exchangeRate}
                        onChangeText={(value) => set("exchangeRate", value)}
                        keyboardType="numeric"
                        placeholder="16.000"
                        className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                      />
                    </FormField>
                  </View>
                  <View className="min-w-[170px] flex-1">
                    <FormField label="Tanggal Kurs">
                      <DatePicker
                        value={form.exchangeRateDate}
                        onChange={(value) => set("exchangeRateDate", value)}
                      />
                    </FormField>
                  </View>
                </View>
              ) : null}
            </View>

            <View className="rounded-xl border border-border/70 bg-muted/20 p-3">
              <Text className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                4. PIC, Departemen & Alokasi Biaya
              </Text>
              <View className="flex-row flex-wrap gap-3">
                <View className="min-w-[200px] flex-1">
                  <FormField label="Departemen" required error={errors.department}>
                    <TextInput
                      value={form.department}
                      onChangeText={(value) => {
                        set("department", value);
                        setForm((prev) => ({
                          ...prev,
                          department: value,
                          allocations:
                            prev.allocations.length === 1 && !prev.allocations[0]?.department
                              ? [{ ...prev.allocations[0]!, department: value }]
                              : prev.allocations,
                        }));
                      }}
                      placeholder="Finance, IT, Marketing..."
                      className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                    />
                  </FormField>
                </View>
                <View className="min-w-[220px] flex-1">
                  <FormField label="PIC Langganan">
                    <UserSelect
                      userId={form.picUserId || null}
                      value={form.picUserId || ""}
                      onChange={(user: any) => set("picUserId", user?.id ? String(user.id) : "")}
                      placeholder="Pilih penanggung jawab..."
                    />
                  </FormField>
                </View>
              </View>

              <View className="mt-3">
                <FormField
                  label="Tujuan Bisnis"
                  required
                  error={errors.businessPurpose}
                  hint="Jelaskan fungsi layanan ini untuk operasional perusahaan."
                >
                  <TextInput
                    value={form.businessPurpose}
                    onChangeText={(value) => set("businessPurpose", value)}
                    multiline
                    numberOfLines={3}
                    placeholder="Contoh: Hosting aplikasi produksi dan database pelanggan"
                    className="min-h-[76px] rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                  />
                </FormField>
              </View>

              <View className="mt-3 rounded-lg border border-border/70 bg-card p-3">
                <View className="flex-row flex-wrap items-center justify-between gap-2">
                  <View>
                    <Text className="text-xs font-bold">Alokasi Biaya per Departemen</Text>
                    <Text className="text-[11px] text-muted-foreground">
                      Total persentase harus 100%. Biaya dialokasikan proporsional.
                    </Text>
                  </View>
                  <Button variant="outline" size="sm" className="gap-1.5" onPress={addAllocation}>
                    <Plus size={13} color={colors.primary} />
                    <Text className="text-[11px]">Tambah Baris</Text>
                  </Button>
                </View>
                <View className="mt-2 gap-2">
                  {form.allocations.map((row, index) => (
                    <View key={index} className="flex-row flex-wrap items-center gap-2">
                      <TextInput
                        value={row.department}
                        onChangeText={(value) => setAllocation(index, { department: value })}
                        placeholder="Departemen"
                        className="min-w-[180px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                      />
                      <View className="w-28 flex-row items-center gap-1 rounded-lg border border-border bg-background px-2">
                        <TextInput
                          value={String(row.percentage ?? "")}
                          onChangeText={(value) =>
                            setAllocation(index, { percentage: Number(value.replace(/[^\d.]/g, "")) || 0 })
                          }
                          keyboardType="numeric"
                          className="h-9 flex-1 text-sm text-foreground"
                        />
                        <Text className="text-xs text-muted-foreground">%</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => removeAllocation(index)}
                        disabled={form.allocations.length <= 1}
                        className="rounded-md border border-border p-2"
                      >
                        <Trash2 size={14} color={form.allocations.length <= 1 ? colors.muted : colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
                <View className="mt-2 flex-row items-center justify-between">
                  <Text className="text-[11px] text-muted-foreground">
                    Total: {allocationSum.toFixed(2)}%
                  </Text>
                  <Text
                    className="text-[11px] font-semibold"
                    style={{ color: Math.abs(allocationSum - 100) <= 0.01 ? colors.success : colors.danger }}
                  >
                    {Math.abs(allocationSum - 100) <= 0.01 ? "Alokasi valid" : "Harus 100%"}
                  </Text>
                </View>
                {errors.allocations ? (
                  <Text className="mt-1 text-[11px] text-danger">{errors.allocations}</Text>
                ) : null}
              </View>
            </View>

            <View className="rounded-xl border border-border/70 bg-muted/20 p-3">
              <Text className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                5. Status & Akun Akuntansi
              </Text>
              <View className="flex-row flex-wrap gap-3">
                <View className="min-w-[180px] flex-1">
                  <FormField label="Status Layanan">
                    <SearchableSelect
                      value={form.status}
                      options={SUBSCRIPTION_STATUS_OPTIONS.filter((x) => x.value).map((x) => x.label)}
                      onChange={(label) => {
                        const found = SUBSCRIPTION_STATUS_OPTIONS.find((x) => x.label === label);
                        set("status", found?.value ?? "ACTIVE");
                      }}
                      className="h-11 rounded-lg border-border/80 bg-card"
                    />
                  </FormField>
                </View>
                <View className="min-w-[180px] flex-1">
                  <FormField label="Status Pembayaran">
                    <SearchableSelect
                      value={form.paymentStatus}
                      options={PAYMENT_STATUS_OPTIONS.filter((x) => x.value).map((x) => x.label)}
                      onChange={(label) => {
                        const found = PAYMENT_STATUS_OPTIONS.find((x) => x.label === label);
                        set("paymentStatus", found?.value ?? "UNPAID");
                      }}
                      className="h-11 rounded-lg border-border/80 bg-card"
                    />
                  </FormField>
                </View>
                <View className="w-32">
                  <FormField label="Akun Beban">
                    <TextInput
                      value={form.expenseAccountCode}
                      onChangeText={(value) => set("expenseAccountCode", value)}
                      placeholder="6122"
                      className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                    />
                  </FormField>
                </View>
                <View className="w-32">
                  <FormField label="Akun Prepaid">
                    <TextInput
                      value={form.prepaidAccountCode}
                      onChangeText={(value) => set("prepaidAccountCode", value)}
                      placeholder="1401"
                      className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                    />
                  </FormField>
                </View>
              </View>

              {!subscription && form.paymentStatus === "PAID" && (
                <View className="mt-4 gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3.5">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-bold uppercase tracking-wide text-primary">
                      Detail Pembayaran Lunas & Jurnal COA
                    </Text>
                    <View className="rounded-full bg-primary/20 px-2 py-0.5">
                      <Text className="text-[10px] font-bold text-primary">Auto-Post Jurnal</Text>
                    </View>
                  </View>
                  <Text className="text-[11px] text-muted-foreground">
                    Data pembayaran dan bukti akan dicatat ke Riwayat Pembayaran, membuat referensi invoice, serta langsung menjurnal ke Buku Besar COA (Debit Beban/Prepaid + PPN, Kredit Kas/Bank).
                  </Text>

                  <View className="flex-row flex-wrap gap-3">
                    <View className="min-w-[180px] flex-1">
                      <FormField label="No. Invoice Vendor">
                        <TextInput
                          value={form.paymentInvoiceNumber}
                          onChangeText={(value) => set("paymentInvoiceNumber", value)}
                          placeholder="Contoh: INV-2026-001 (opsional)"
                          className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                        />
                      </FormField>
                    </View>
                    <View className="min-w-[160px] flex-1">
                      <FormField label="Tanggal Bayar">
                        <DatePicker
                          value={form.paymentDate}
                          onChange={(value) => set("paymentDate", value)}
                        />
                      </FormField>
                    </View>
                    <View className="min-w-[200px] flex-1">
                      <FormField label="Akun Kas / Bank (Kredit)">
                        <SearchableSelect
                          value={
                            PAYMENT_ACCOUNT_OPTIONS.find((a) => a.code === form.paymentAccountCode)?.label ??
                            form.paymentAccountCode
                          }
                          options={PAYMENT_ACCOUNT_OPTIONS.map((a) => a.label)}
                          onChange={(label) => {
                            const found = PAYMENT_ACCOUNT_OPTIONS.find((a) => a.label === label);
                            if (found) set("paymentAccountCode", found.code);
                          }}
                          className="h-11 rounded-lg border-border/80 bg-card"
                        />
                      </FormField>
                    </View>
                  </View>

                  <View className="gap-3">
                    <FormField label="Upload File Invoice Supplier (Opsional)">
                      <FileUploader
                        label="Pilih File PDF / Foto Invoice Tagihan (Opsional)"
                        kind="semua"
                        category="subscription"
                        autoFlush
                        onUploaded={(fileId) => set("paymentInvoiceFileUrl", `/api/upload/file/${fileId}`)}
                      />
                      {form.paymentInvoiceFileUrl ? (
                        <Text className="mt-1.5 text-xs font-medium text-success">
                          ✓ File invoice terlampir ({form.paymentInvoiceFileUrl})
                        </Text>
                      ) : null}
                    </FormField>

                    <FormField label="Upload Bukti Pembayaran *" required={form.paymentAccountCode !== "210102"}>
                      <FileUploader
                        label="Pilih Foto / Dokumen Bukti Bayar (Wajib)"
                        kind="semua"
                        category="subscription"
                        autoFlush
                        onUploaded={(fileId) => set("paymentProofUrl", `/api/upload/file/${fileId}`)}
                      />
                      {form.paymentProofUrl ? (
                        <Text className="mt-1.5 text-xs font-medium text-success">
                          ✓ Bukti terlampir ({form.paymentProofUrl})
                        </Text>
                      ) : null}
                    </FormField>
                  </View>
                </View>
              )}

              <View className="mt-3">
                <FormField label="Catatan">
                  <TextInput
                    value={form.notes}
                    onChangeText={(value) => set("notes", value)}
                    multiline
                    numberOfLines={2}
                    placeholder="Catatan internal, syarat pembayaran, atau info kontrak..."
                    className="min-h-[60px] rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                  />
                </FormField>
              </View>
            </View>
          </View>
        </ScrollView>

        <DialogFooter className="mt-2 flex-row justify-end gap-2">
          <Button variant="outline" size="sm" onPress={onClose} disabled={saving}>
            <Text className="text-xs">Batal</Text>
          </Button>
          <Button size="sm" onPress={save} disabled={saving}>
            <Text className="text-xs">{saving ? "Menyimpan..." : subscription ? "Simpan Perubahan" : "Daftarkan Langganan"}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
