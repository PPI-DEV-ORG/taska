import * as React from "react";
import { Platform, ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import { Check, Plus, Settings2, Trash2 } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CustomerSelect,
  DatePicker,
  MaintenanceSelect,
  PoClientSelect,
  ProjectSelect,
  PurchaseRequestSelect,
  QuickAddCustomerDialog,
  QuickAddSupplierDialog,
  QuotationSelect,
  SearchableSelect,
  SupplierPoSelect,
  SupplierSelect,
  UserSelect,
} from "@/components/akuntra/dialogs";
import { InvoiceSelect } from "@/components/akuntra/document-select";
import { FileUploader } from "@/components/akuntra/file-uploader";
import { FormField } from "@/components/akuntra/basics";
import { SubscriptionProviderSelect } from "@/modules/subscriptions/subscription-provider-select";
import type { SubProvider } from "@/modules/subscriptions/types";
import { colors } from "@/tokens";
import { formatThousands } from "@/lib/format";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import type {
  ContractMasterLookups,
  CtrContract,
  CtrPaymentSchedule,
  CtrService,
  CtrSla,
} from "./types";
import {
  APPROVAL_STATUS_OPTIONS,
  CONTRACT_STATUS_OPTIONS,
  COUNTERPARTY_TYPE_OPTIONS,
  DEPARTMENT_OPTIONS,
  DOCUMENT_CATEGORY_OPTIONS,
  PAYMENT_FREQUENCY_OPTIONS,
  VALUE_TYPE_OPTIONS,
  addDaysIso,
  addMonthsIso,
  formatContractCurrency,
  todayWibIso,
} from "./contract-utils";
import { ContractTypeTableSelect } from "./contract-table-selects";

type Props = {
  visible: boolean;
  onClose: () => void;
  contract?: CtrContract | null;
  lookups: ContractMasterLookups;
  onOpenTypeManager: () => void;
  onRefreshLookups?: () => void;
  onSuccess: () => void;
};

const TAX_PRESET_OPTIONS = [
  { label: "Tanpa Pajak (0%)", rate: 0 },
  { label: "PPN 11%", rate: 11 },
  { label: "PPN 12%", rate: 12 },
];

const ERP_LINK_MODULE_OPTIONS = [
  { value: "", label: "Tidak Ada Tautan" },
  { value: "PURCHASE_ORDER", label: "PO Supplier (Purchase Order)" },
  { value: "SALES_ORDER", label: "Sales Order (SO Pelanggan)" },
  { value: "PURCHASE_REQUEST", label: "Request Barang (PR)" },
  { value: "QUOTATION", label: "Penawaran (Quotation)" },
  { value: "INVOICE", label: "Invoice / Tagihan" },
  { value: "WORK_ORDER", label: "Laporan Maintenance" },
];

export function ContractFormDialog(props: Props) {
  if (!props.visible) return null;
  return <FormContent key={props.contract?.id ?? "new"} {...props} />;
}

function FormContent({
  onClose,
  contract,
  lookups,
  onOpenTypeManager,
  onRefreshLookups,
  onSuccess,
}: Props) {
  const { toast, user } = useApp();
  const isEdit = Boolean(contract?.id);
  const startDefault = todayWibIso();
  const endDefault = addDaysIso(addMonthsIso(startDefault, 12), -1);
  const renewalDefault = addDaysIso(endDefault, -30);

  const [title, setTitle] = React.useState(contract?.title ?? "");
  const [officialNumber, setOfficialNumber] = React.useState(contract?.officialNumber ?? "");
  const [typeId, setTypeId] = React.useState<number | null>(
    contract?.typeId ?? lookups.types[0]?.id ?? null,
  );
  const [department, setDepartment] = React.useState(
    contract?.department ?? (user as any)?.department ?? "IT & Infrastructure",
  );
  const [contractOwnerId, setContractOwnerId] = React.useState(
    contract?.contractOwnerId ? String(contract.contractOwnerId) : user?.id ? String(user.id) : "",
  );

  // Counterparty
  const [counterpartyType, setCounterpartyType] = React.useState(
    contract?.counterpartyType ?? "VENDOR",
  );
  const [counterpartyId, setCounterpartyId] = React.useState<number | null>(
    contract?.counterpartyId ?? null,
  );
  const [counterpartyName, setCounterpartyName] = React.useState(
    contract?.counterpartyName ?? "",
  );
  const secondParty = (contract?.parties ?? []).find((p) => p.partyType === "SECOND_PARTY");
  const [picName, setPicName] = React.useState(secondParty?.picName ?? "");
  const [picPhone, setPicPhone] = React.useState(secondParty?.picPhone ?? "");
  const [picEmail, setPicEmail] = React.useState(secondParty?.picEmail ?? "");

  const [quickSupplierOpen, setQuickSupplierOpen] = React.useState(false);
  const [quickCustomerOpen, setQuickCustomerOpen] = React.useState(false);

  // Dates & Status
  const [effectiveDate, setEffectiveDate] = React.useState(
    contract?.effectiveDate ? String(contract.effectiveDate).slice(0, 10) : startDefault,
  );
  const [expirationDate, setExpirationDate] = React.useState(
    contract?.expirationDate ? String(contract.expirationDate).slice(0, 10) : endDefault,
  );
  const [renewalDate, setRenewalDate] = React.useState(
    contract?.renewalDate ? String(contract.renewalDate).slice(0, 10) : renewalDefault,
  );
  const [isAutoRenewal, setIsAutoRenewal] = React.useState(Boolean(contract?.isAutoRenewal));
  const [status, setStatus] = React.useState(contract?.status ?? "ACTIVE");
  const [approvalStatus, setApprovalStatus] = React.useState(
    contract?.approvalStatus ?? "APPROVED",
  );
  const [description, setDescription] = React.useState(contract?.description ?? "");

  // Financial
  const [valueType, setValueType] = React.useState(
    contract?.financial?.valueType ?? "FIXED",
  );
  const [currency, setCurrency] = React.useState(contract?.currency ?? "IDR");
  const initialBase =
    contract?.financial?.baseAmount !== undefined
      ? Math.round(Number(contract.financial.baseAmount))
      : contract?.contractValue !== undefined
        ? Math.round(Number(contract.contractValue))
        : 0;
  const [baseAmount, setBaseAmount] = React.useState(initialBase > 0 ? String(initialBase) : "");
  const [taxPercentage, setTaxPercentage] = React.useState(
    String(Number(contract?.financial?.taxPercentage ?? 0)),
  );
  const [paymentFrequency, setPaymentFrequency] = React.useState(
    contract?.paymentFrequency ?? "ONE_TIME",
  );
  const [paymentTerms, setPaymentTerms] = React.useState(contract?.paymentTerms ?? "Net 30 Hari");
  const [downPaymentAmount, setDownPaymentAmount] = React.useState(
    contract?.financial?.downPaymentAmount
      ? String(Math.round(Number(contract.financial.downPaymentAmount)))
      : "0",
  );
  const [retentionAmount, setRetentionAmount] = React.useState(
    contract?.financial?.retentionAmount
      ? String(Math.round(Number(contract.financial.retentionAmount)))
      : "0",
  );
  const [penaltyTerms, setPenaltyTerms] = React.useState(
    contract?.financial?.penaltyTerms ?? "",
  );
  const [costCenter, setCostCenter] = React.useState(
    contract?.financial?.costCenter ?? contract?.department ?? "IT & Infrastructure",
  );
  const [projectReference, setProjectReference] = React.useState(
    contract?.financial?.projectReference ?? "",
  );
  const [projectId, setProjectId] = React.useState<number | null>(null);

  // Payment Schedules
  const [schedules, setSchedules] = React.useState<CtrPaymentSchedule[]>(
    contract?.paymentSchedules && contract.paymentSchedules.length > 0
      ? contract.paymentSchedules.map((ps) => ({
          ...ps,
          dueDate: String(ps.dueDate).slice(0, 10),
          paidDate: ps.paidDate ? String(ps.paidDate).slice(0, 10) : null,
        }))
      : [],
  );

  // Services & SLA
  const [services, setServices] = React.useState<CtrService[]>(
    contract?.services && contract.services.length > 0 ? contract.services : [],
  );
  const [slas, setSlas] = React.useState<CtrSla[]>(
    contract?.slas && contract.slas.length > 0 ? contract.slas : [],
  );

  // Initial Document (Create Mode Only)
  const [initialDocumentCategory, setInitialDocumentCategory] = React.useState("MAIN_CONTRACT");
  const [initialDocumentTitle, setInitialDocumentTitle] = React.useState("");
  const [initialDocumentConfidential, setInitialDocumentConfidential] = React.useState(false);
  const [initialDocumentSignedDate, setInitialDocumentSignedDate] = React.useState(startDefault);
  const [initialDocumentSignedByFirst, setInitialDocumentSignedByFirst] = React.useState("");
  const [initialDocumentSignedBySecond, setInitialDocumentSignedBySecond] = React.useState("");
  const [initialDocumentUrl, setInitialDocumentUrl] = React.useState("");

  // Linked ERP module using existing Akuntra selects
  const [linkedModule, setLinkedModule] = React.useState("");
  const [linkedEntityId, setLinkedEntityId] = React.useState<number | null>(null);
  const [linkedRefCode, setLinkedRefCode] = React.useState("");

  const [saving, setSaving] = React.useState(false);

  const effectiveTypeId = typeId ?? lookups.types[0]?.id ?? null;

  const numericBase = Number(baseAmount.replace(/\D/g, "")) || 0;
  const numericTaxPct = Number(taxPercentage) || 0;
  const computedTaxAmount = Math.round(numericBase * (numericTaxPct / 100));
  const computedTotalValue = numericBase + computedTaxAmount;

  function handleEffectiveChange(val: string) {
    setEffectiveDate(val);
    if (!isEdit) {
      const nextExp = addDaysIso(addMonthsIso(val, 12), -1);
      setExpirationDate(nextExp);
      setRenewalDate(addDaysIso(nextExp, -30));
    }
  }

  function handleExpirationChange(val: string) {
    setExpirationDate(val);
    setRenewalDate(addDaysIso(val, -30));
  }

  function addServiceRow() {
    setServices((prev) => [
      ...prev,
      {
        serviceName: "",
        serviceScope: "",
        servicePeriod: "12 Bulan",
        serviceLocation: "Kantor Pusat / On-Site",
        supportContact: "",
        serviceFee: 0,
        penaltyClause: "",
      },
    ]);
  }

  function updateServiceRow(idx: number, patch: Partial<CtrService>) {
    setServices((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }

  function removeServiceRow(idx: number) {
    setServices((prev) => prev.filter((_, i) => i !== idx));
  }

  function addSlaRow() {
    setSlas((prev) => [
      ...prev,
      {
        indicatorName: "Response Time — Critical Issue",
        targetMetric: "< 2 Jam",
        responseHours: 2,
        resolutionHours: 8,
        operationalHours: "24/7",
        penaltyDetails: "",
      },
    ]);
  }

  function updateSlaRow(idx: number, patch: Partial<CtrSla>) {
    setSlas((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }

  function removeSlaRow(idx: number) {
    setSlas((prev) => prev.filter((_, i) => i !== idx));
  }

  function addScheduleRow() {
    setSchedules((prev) => [
      ...prev,
      {
        scheduleNumber: prev.length + 1,
        milestoneName: `Termin Pembayaran #${prev.length + 1}`,
        dueDate: effectiveDate || todayWibIso(),
        amount: numericBase,
        taxAmount: computedTaxAmount,
        totalAmount: computedTotalValue,
        paymentStatus: "PLANNED",
        invoiceReference: "",
      },
    ]);
  }

  function updateScheduleRow(idx: number, patch: Partial<CtrPaymentSchedule>) {
    setSchedules((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        const next = { ...row, ...patch };
        next.totalAmount = (Number(next.amount) || 0) + (Number(next.taxAmount) || 0);
        return next;
      }),
    );
  }

  function removeScheduleRow(idx: number) {
    setSchedules((prev) => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    if (!title.trim()) {
      toast("Judul kontrak (Contract Title) wajib diisi", "danger");
      return;
    }
    if (!effectiveTypeId) {
      toast("Pilih kategori kontrak terlebih dahulu", "danger");
      return;
    }
    if (!counterpartyName.trim()) {
      toast("Pilih atau isi nama pihak terkait (Vendor / Customer / Mitra)", "danger");
      return;
    }
    if (!effectiveDate || !expirationDate) {
      toast("Tanggal mulai dan tanggal berakhir kontrak wajib diisi", "danger");
      return;
    }
    if (expirationDate < effectiveDate) {
      toast("Tanggal berakhir tidak boleh sebelum tanggal mulai", "danger");
      return;
    }

    setSaving(true);
    try {
      const cleanServices = services
        .filter((s) => s.serviceName.trim().length > 0)
        .map((s) => ({
          serviceName: s.serviceName.trim(),
          serviceScope: s.serviceScope || undefined,
          servicePeriod: s.servicePeriod || undefined,
          serviceLocation: s.serviceLocation || undefined,
          supportContact: s.supportContact || undefined,
          serviceFee: Number(s.serviceFee) || 0,
          penaltyClause: s.penaltyClause || undefined,
        }));

      const cleanSlas = slas
        .filter((s) => s.indicatorName.trim().length > 0)
        .map((s) => ({
          indicatorName: s.indicatorName.trim(),
          targetMetric: s.targetMetric.trim() || "Sesuai Kontrak",
          responseHours: s.responseHours ? Number(s.responseHours) : undefined,
          resolutionHours: s.resolutionHours ? Number(s.resolutionHours) : undefined,
          operationalHours: s.operationalHours || "8x5",
          penaltyDetails: s.penaltyDetails || undefined,
        }));

      const cleanSchedules = schedules
        .filter((s) => s.milestoneName.trim().length > 0)
        .map((s, idx) => ({
          scheduleNumber: idx + 1,
          milestoneName: s.milestoneName.trim(),
          dueDate: s.dueDate,
          amount: Number(s.amount) || 0,
          taxAmount: Number(s.taxAmount) || 0,
          totalAmount: (Number(s.amount) || 0) + (Number(s.taxAmount) || 0),
          paymentStatus: s.paymentStatus || "PLANNED",
          invoiceReference: s.invoiceReference || undefined,
        }));

      const parties = [
        {
          partyType: "FIRST_PARTY",
          entityType: "INTERNAL_COMPANY",
          name: "PT Samtek / Perusahaan Internal",
          role: "Pihak Pertama",
        },
        {
          partyType: "SECOND_PARTY",
          entityType:
            counterpartyType === "CUSTOMER"
              ? "CUSTOMER"
              : counterpartyType === "VENDOR"
                ? "SUPPLIER"
                : "OTHER",
          entityId: counterpartyId ?? undefined,
          name: counterpartyName.trim(),
          role:
            counterpartyType === "CUSTOMER"
              ? "Pelanggan / Klien"
              : counterpartyType === "INTERNAL"
                ? "Karyawan / Internal"
                : "Vendor / Penyedia Layanan",
          picName: picName.trim() || undefined,
          picPhone: picPhone.trim() || undefined,
          picEmail: picEmail.trim() || undefined,
        },
      ];

      const relations =
        linkedModule && linkedEntityId
          ? [
              {
                relatedModule: linkedModule,
                relatedId: linkedEntityId,
                referenceCode: linkedRefCode,
                notes: "Tautan modul ERP",
              },
            ]
          : undefined;

      const payload: Record<string, any> = {
        officialNumber: officialNumber.trim() || undefined,
        title: title.trim(),
        typeId: effectiveTypeId,
        counterpartyType,
        counterpartyId: counterpartyId ?? undefined,
        counterpartyName: counterpartyName.trim(),
        effectiveDate,
        expirationDate,
        renewalDate: renewalDate || undefined,
        isAutoRenewal,
        currency,
        contractValue: computedTotalValue,
        contractOwnerId: contractOwnerId ? Number(contractOwnerId) : undefined,
        department: department.trim() || "Umum",
        paymentTerms: paymentTerms.trim() || undefined,
        paymentFrequency,
        status,
        approvalStatus,
        description: description.trim() || undefined,
        parties,
        services: cleanServices,
        slas: cleanSlas,
        paymentSchedules: cleanSchedules,
        financial: {
          valueType,
          currency,
          baseAmount: numericBase,
          taxPercentage: numericTaxPct,
          taxAmount: computedTaxAmount,
          totalAmount: computedTotalValue,
          downPaymentAmount: Number(downPaymentAmount.replace(/\D/g, "")) || 0,
          retentionAmount: Number(retentionAmount.replace(/\D/g, "")) || 0,
          penaltyTerms: penaltyTerms.trim() || undefined,
          costCenter: costCenter.trim() || department.trim(),
          projectReference: projectReference.trim() || undefined,
        },
        ...(relations ? { relations } : {}),
      };

      if (!isEdit && initialDocumentUrl.trim()) {
        payload.initialDocumentCategory = initialDocumentCategory;
        payload.initialDocumentTitle =
          initialDocumentTitle.trim() || `Dokumen Utama — ${title.trim()}`;
        payload.initialDocumentUrl = initialDocumentUrl.trim();
        payload.initialDocumentConfidential = initialDocumentConfidential;
        payload.initialDocumentSignedDate = initialDocumentSignedDate || effectiveDate;
        payload.initialDocumentSignedByFirst = initialDocumentSignedByFirst.trim() || undefined;
        payload.initialDocumentSignedBySecond = initialDocumentSignedBySecond.trim() || undefined;
      }

      if (isEdit && contract) {
        await api.patch(`/contracts/${contract.id}`, payload);
        toast("Perubahan kontrak berhasil disimpan");
      } else {
        await api.post("/contracts", payload);
        toast("Kontrak baru berhasil didaftarkan");
      }

      onSuccess();
      onClose();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menyimpan kontrak", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="w-[96vw] max-w-6xl max-h-[93vh] p-0"
        style={Platform.select({
          web: { width: "min(96vw, 1180px)", maxWidth: "1180px" } as any,
        })}
      >
        <DialogHeader className="border-b border-border/70 px-6 py-4">
          <DialogTitle>
            {isEdit
              ? `Edit Kontrak · ${contract?.contractNumber}`
              : "Registrasi Kontrak & Perjanjian Baru"}
          </DialogTitle>
          <Text className="text-xs text-muted-foreground">
            Nomor ID internal (CTR-YYYY-XXXXX) dibuat otomatis dan terpisah dari nomor dokumen resmi eksternal.
          </Text>
        </DialogHeader>

        <ScrollView className="max-h-[75vh] px-6 py-4">
          <View className="gap-4 pb-4">
            {/* 1. IDENTITAS & KATEGORI KONTRAK */}
            <View className="gap-3.5 rounded-xl border border-border/70 bg-muted/20 p-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  1. Identitas & Kategori Kontrak
                </Text>
                <TouchableOpacity
                  onPress={onOpenTypeManager}
                  className="flex-row items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1"
                >
                  <Settings2 size={12} color={colors.primary} />
                  <Text className="text-[11px] font-semibold text-primary">Kelola Master Kategori</Text>
                </TouchableOpacity>
              </View>

              <View className="flex-row flex-wrap gap-3">
                <View className="min-w-[280px] flex-[1.6]">
                  <FormField label="Judul / Nama Kontrak (Contract Title)" required>
                    <TextInput
                      value={title}
                      onChangeText={setTitle}
                      placeholder="Contoh: Perjanjian Maintenance Perangkat CCTV & Server"
                      className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                    />
                  </FormField>
                </View>
                <View className="min-w-[260px] flex-1">
                  <FormField label="Kategori Kontrak (Contract Type)" required>
                    <ContractTypeTableSelect
                      value={effectiveTypeId}
                      types={lookups.types}
                      onChange={(t) => setTypeId(t.id)}
                      onRefresh={onRefreshLookups}
                    />
                  </FormField>
                </View>
              </View>

              <View className="flex-row flex-wrap gap-3">
                <View className="min-w-[220px] flex-1">
                  <FormField label="Nomor Dokumen Resmi (Contract Number)">
                    <TextInput
                      value={officialNumber}
                      onChangeText={setOfficialNumber}
                      placeholder="Nomor surat perjanjian vendor/klien..."
                      className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                    />
                  </FormField>
                </View>
                <View className="min-w-[220px] flex-1">
                  <FormField label="Departemen Terkait" required>
                    <SearchableSelect
                      value={department}
                      options={DEPARTMENT_OPTIONS}
                      onChange={(val) => {
                        setDepartment(val);
                        if (!costCenter) setCostCenter(val);
                      }}
                      placeholder="Pilih departemen"
                      className="h-11 rounded-lg border-border/80 bg-card"
                    />
                  </FormField>
                </View>
                <View className="min-w-[220px] flex-1">
                  <FormField label="Contract Owner (PIC Internal)">
                    <UserSelect
                      userId={contractOwnerId || null}
                      value={contractOwnerId || ""}
                      onChange={(selectedUser: any) =>
                        setContractOwnerId(selectedUser?.id ? String(selectedUser.id) : "")
                      }
                      placeholder="Pilih PIC internal"
                    />
                  </FormField>
                </View>
              </View>
            </View>

            {/* 2. PIHAK TERKAIT (COUNTERPARTY — KOMPONEN SELECT BAWAAN AKUNTRA) */}
            <View className="gap-3.5 rounded-xl border border-border/70 bg-muted/20 p-4">
              <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                2. Pihak Terkait (Counterparty — Referensi Master Data ERP)
              </Text>

              <View className="flex-row flex-wrap gap-3">
                <View className="min-w-[210px] flex-1">
                  <FormField label="Jenis Pihak Terkait" required>
                    <SearchableSelect
                      value={
                        COUNTERPARTY_TYPE_OPTIONS.find((c) => c.value === counterpartyType)?.label ??
                        counterpartyType
                      }
                      options={COUNTERPARTY_TYPE_OPTIONS.map((c) => c.label)}
                      onChange={(label) => {
                        const found = COUNTERPARTY_TYPE_OPTIONS.find((c) => c.label === label);
                        if (found) {
                          setCounterpartyType(found.value);
                          setCounterpartyId(null);
                          setCounterpartyName("");
                        }
                      }}
                      className="h-11 rounded-lg border-border/80 bg-card"
                    />
                  </FormField>
                </View>

                {counterpartyType === "VENDOR" ? (
                  <View className="min-w-[280px] flex-[1.5]">
                    <FormField label="Pilih Pemasok / Vendor (Master Supplier)">
                      <SupplierSelect
                        value={counterpartyName}
                        supplierId={counterpartyId}
                        onAddNew={() => setQuickSupplierOpen(true)}
                        onChange={(selectedName, selectedSupplier) => {
                          setCounterpartyName(selectedName);
                          if (selectedSupplier) {
                            setCounterpartyId(Number(selectedSupplier.id) || null);
                            if (selectedSupplier.pic || selectedSupplier.kontak) {
                              setPicName(String(selectedSupplier.pic || selectedSupplier.kontak));
                            }
                            if (selectedSupplier.phone || selectedSupplier.telepon) {
                              setPicPhone(String(selectedSupplier.phone || selectedSupplier.telepon));
                            }
                            if (selectedSupplier.email) {
                              setPicEmail(String(selectedSupplier.email));
                            }
                          }
                        }}
                      />
                    </FormField>
                  </View>
                ) : null}

                {counterpartyType === "CUSTOMER" ? (
                  <View className="min-w-[280px] flex-[1.5]">
                    <FormField label="Pilih Customer / Pelanggan (Master Customer)">
                      <CustomerSelect
                        value={counterpartyName}
                        customerId={counterpartyId}
                        onAddNew={() => setQuickCustomerOpen(true)}
                        onChange={(cust) => {
                          if (!cust) {
                            setCounterpartyId(null);
                            setCounterpartyName("");
                            return;
                          }
                          setCounterpartyId(Number(cust.id) || null);
                          setCounterpartyName(String(cust.company || cust.nama || cust.name || ""));
                          if (cust.pic || cust.kontak) setPicName(String(cust.pic || cust.kontak));
                          if (cust.phone || cust.telepon) setPicPhone(String(cust.phone || cust.telepon));
                          if (cust.email) setPicEmail(String(cust.email));
                        }}
                      />
                    </FormField>
                  </View>
                ) : null}

                {counterpartyType === "INTERNAL" ? (
                  <View className="min-w-[280px] flex-[1.5]">
                    <FormField label="Pilih Karyawan / Internal">
                      <UserSelect
                        value={counterpartyName}
                        userId={counterpartyId}
                        onChange={(emp) => {
                          if (!emp) {
                            setCounterpartyId(null);
                            setCounterpartyName("");
                            return;
                          }
                          setCounterpartyId(Number(emp.id) || null);
                          setCounterpartyName(String(emp.nama || emp.name || ""));
                          setPicName(String(emp.nama || emp.name || ""));
                          if (emp.email) setPicEmail(String(emp.email));
                          if (emp.telepon || emp.phone) setPicPhone(String(emp.telepon || emp.phone));
                        }}
                        placeholder="Pilih karyawan internal..."
                      />
                    </FormField>
                  </View>
                ) : null}

                {counterpartyType === "THIRD_PARTY" ? (
                  <View className="min-w-[280px] flex-[1.5]">
                    <FormField label="Pilih Provider / Pihak Ketiga">
                      <SubscriptionProviderSelect
                        value={counterpartyId}
                        providers={(lookups.providers ?? []) as unknown as SubProvider[]}
                        onRefresh={onRefreshLookups}
                        onChange={(prov) => {
                          if (!prov) {
                            setCounterpartyId(null);
                            return;
                          }
                          setCounterpartyId(prov.id);
                          setCounterpartyName(prov.name);
                          if (prov.accountRepresentative) setPicName(prov.accountRepresentative);
                          if (prov.supportPhone) setPicPhone(prov.supportPhone);
                          if (prov.supportEmail) setPicEmail(prov.supportEmail);
                        }}
                      />
                    </FormField>
                  </View>
                ) : null}

                <View className="min-w-[250px] flex-[1.3]">
                  <FormField label="Nama Resmi Pihak Terkait" required>
                    <TextInput
                      value={counterpartyName}
                      onChangeText={setCounterpartyName}
                      placeholder="Nama perusahaan atau pihak kedua..."
                      className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                    />
                  </FormField>
                </View>
              </View>

              <View className="flex-row flex-wrap gap-3">
                <View className="min-w-[220px] flex-1">
                  <FormField label="Nama PIC Eksternal">
                    <TextInput
                      value={picName}
                      onChangeText={setPicName}
                      placeholder="Nama perwakilan vendor/klien"
                      className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                    />
                  </FormField>
                </View>
                <View className="min-w-[220px] flex-1">
                  <FormField label="No. Telepon / WhatsApp">
                    <TextInput
                      value={picPhone}
                      onChangeText={setPicPhone}
                      placeholder="0812..."
                      className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                    />
                  </FormField>
                </View>
                <View className="min-w-[220px] flex-1">
                  <FormField label="Email Kontak / Support">
                    <TextInput
                      value={picEmail}
                      onChangeText={setPicEmail}
                      placeholder="legal@vendor.com"
                      autoCapitalize="none"
                      className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                    />
                  </FormField>
                </View>
              </View>
            </View>

            {/* 3. MASA BERLAKU, REMINDER & STATUS */}
            <View className="gap-3.5 rounded-xl border border-border/70 bg-muted/20 p-4">
              <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                3. Masa Berlaku, Tanggal Evaluasi Renewal & Status
              </Text>

              <View className="flex-row flex-wrap gap-3">
                <View className="min-w-[220px] flex-1">
                  <FormField label="Effective Date (Mulai Berlaku)" required>
                    <DatePicker value={effectiveDate} onChange={handleEffectiveChange} />
                  </FormField>
                </View>
                <View className="min-w-[220px] flex-1">
                  <FormField label="Expiration Date (Berakhir)" required>
                    <DatePicker value={expirationDate} onChange={handleExpirationChange} />
                  </FormField>
                </View>
                <View className="min-w-[220px] flex-1">
                  <FormField label="Renewal Date (Mulai Evaluasi)">
                    <DatePicker
                      value={renewalDate}
                      onChange={setRenewalDate}
                      clearable
                      placeholder="H-30 sebelum berakhir"
                    />
                  </FormField>
                </View>
              </View>

              <View className="flex-row flex-wrap items-end gap-3">
                <View className="min-w-[220px] flex-1">
                  <FormField label="Status Kontrak">
                    <SearchableSelect
                      value={
                        CONTRACT_STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status
                      }
                      options={CONTRACT_STATUS_OPTIONS.filter((s) => s.value !== "").map(
                        (s) => s.label,
                      )}
                      onChange={(label) => {
                        const found = CONTRACT_STATUS_OPTIONS.find((s) => s.label === label);
                        if (found) setStatus(found.value);
                      }}
                      className="h-11 rounded-lg border-border/80 bg-card"
                    />
                  </FormField>
                </View>
                <View className="min-w-[220px] flex-1">
                  <FormField label="Status Approval">
                    <SearchableSelect
                      value={
                        APPROVAL_STATUS_OPTIONS.find((s) => s.value === approvalStatus)?.label ??
                        approvalStatus
                      }
                      options={APPROVAL_STATUS_OPTIONS.filter((s) => s.value !== "").map(
                        (s) => s.label,
                      )}
                      onChange={(label) => {
                        const found = APPROVAL_STATUS_OPTIONS.find((s) => s.label === label);
                        if (found) setApprovalStatus(found.value);
                      }}
                      className="h-11 rounded-lg border-border/80 bg-card"
                    />
                  </FormField>
                </View>
                <View className="min-w-[240px] flex-1">
                  <FormField label="Klausul Auto-Renewal">
                    <TouchableOpacity
                      onPress={() => setIsAutoRenewal(!isAutoRenewal)}
                      className={`h-11 flex-row items-center gap-2.5 rounded-lg border px-3 ${
                        isAutoRenewal
                          ? "border-primary/50 bg-primary/10"
                          : "border-border bg-card"
                      }`}
                    >
                      <View
                        className={`h-5 w-5 items-center justify-center rounded border ${
                          isAutoRenewal ? "border-primary bg-primary" : "border-border bg-background"
                        }`}
                      >
                        {isAutoRenewal ? <Check size={12} color="#fff" /> : null}
                      </View>
                      <Text className="flex-1 text-xs font-semibold" numberOfLines={1}>
                        Klausul Auto-Renewal (Wajib Approval)
                      </Text>
                    </TouchableOpacity>
                  </FormField>
                </View>
              </View>
            </View>

            {/* 4. NILAI KONTRAK, PAJAK & KOMITMEN FINANSIAL */}
            <View className="gap-3.5 rounded-xl border border-border/70 bg-muted/20 p-4">
              <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                4. Nilai Kontrak, Perlakuan Pajak & Komitmen Finansial
              </Text>

              <View className="flex-row flex-wrap gap-3">
                <View className="min-w-[210px] flex-1">
                  <FormField label="Jenis Nilai Kontrak">
                    <SearchableSelect
                      value={VALUE_TYPE_OPTIONS.find((v) => v.value === valueType)?.label ?? valueType}
                      options={VALUE_TYPE_OPTIONS.map((v) => v.label)}
                      onChange={(label) => {
                        const found = VALUE_TYPE_OPTIONS.find((v) => v.label === label);
                        if (found) setValueType(found.value);
                      }}
                      className="h-11 rounded-lg border-border/80 bg-card"
                    />
                  </FormField>
                </View>
                <View className="w-[130px]">
                  <FormField label="Mata Uang">
                    <SearchableSelect
                      value={currency}
                      options={["IDR", "USD", "SGD", "EUR"]}
                      onChange={setCurrency}
                      className="h-11 rounded-lg border-border/80 bg-card"
                    />
                  </FormField>
                </View>
                <View className="min-w-[210px] flex-1">
                  <FormField label="Nilai Dasar / DPP" required>
                    <TextInput
                      value={formatThousands(baseAmount)}
                      onChangeText={(txt) => setBaseAmount(txt.replace(/\D/g, ""))}
                      keyboardType="numeric"
                      placeholder="0"
                      className="h-11 rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground"
                    />
                  </FormField>
                </View>
                <View className="min-w-[190px] flex-1">
                  <FormField label="Perlakuan Pajak (PPN)">
                    <SearchableSelect
                      value={
                        TAX_PRESET_OPTIONS.find((t) => t.rate === numericTaxPct)?.label ??
                        `PPN ${numericTaxPct}%`
                      }
                      options={TAX_PRESET_OPTIONS.map((t) => t.label)}
                      onChange={(label) => {
                        const found = TAX_PRESET_OPTIONS.find((t) => t.label === label);
                        if (found) setTaxPercentage(String(found.rate));
                      }}
                      className="h-11 rounded-lg border-border/80 bg-card"
                    />
                  </FormField>
                </View>
              </View>

              <View className="flex-row flex-wrap items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
                <Text className="text-xs text-muted-foreground">
                  DPP: {formatContractCurrency(numericBase, currency)} + Pajak ({numericTaxPct}%):{" "}
                  {formatContractCurrency(computedTaxAmount, currency)}
                </Text>
                <Text className="text-sm font-bold text-primary">
                  Total Nilai Kontrak: {formatContractCurrency(computedTotalValue, currency)}
                </Text>
              </View>

              <View className="flex-row flex-wrap gap-3">
                <View className="min-w-[200px] flex-1">
                  <FormField label="Frekuensi Pembayaran">
                    <SearchableSelect
                      value={
                        PAYMENT_FREQUENCY_OPTIONS.find((f) => f.value === paymentFrequency)?.label ??
                        paymentFrequency
                      }
                      options={PAYMENT_FREQUENCY_OPTIONS.map((f) => f.label)}
                      onChange={(label) => {
                        const found = PAYMENT_FREQUENCY_OPTIONS.find((f) => f.label === label);
                        if (found) setPaymentFrequency(found.value);
                      }}
                      className="h-11 rounded-lg border-border/80 bg-card"
                    />
                  </FormField>
                </View>
                <View className="min-w-[200px] flex-1">
                  <FormField label="Ketentuan Pembayaran">
                    <TextInput
                      value={paymentTerms}
                      onChangeText={setPaymentTerms}
                      placeholder="Mis. Net 30 Hari / Termin 50%-50%"
                      className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                    />
                  </FormField>
                </View>
                <View className="min-w-[180px] flex-1">
                  <FormField label="Down Payment (Uang Muka)">
                    <TextInput
                      value={formatThousands(downPaymentAmount)}
                      onChangeText={(txt) => setDownPaymentAmount(txt.replace(/\D/g, ""))}
                      keyboardType="numeric"
                      placeholder="0"
                      className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                    />
                  </FormField>
                </View>
                <View className="min-w-[180px] flex-1">
                  <FormField label="Retensi (Retention)">
                    <TextInput
                      value={formatThousands(retentionAmount)}
                      onChangeText={(txt) => setRetentionAmount(txt.replace(/\D/g, ""))}
                      keyboardType="numeric"
                      placeholder="0"
                      className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                    />
                  </FormField>
                </View>
              </View>

              <View className="flex-row flex-wrap gap-3">
                <View className="min-w-[200px] flex-1">
                  <FormField label="Cost Center (Pusat Biaya)">
                    <TextInput
                      value={costCenter}
                      onChangeText={setCostCenter}
                      placeholder="Departemen / Cost Center"
                      className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                    />
                  </FormField>
                </View>
                <View className="min-w-[250px] flex-[1.3]">
                  <FormField label="Referensi Proyek (Project Reference)">
                    <ProjectSelect
                      value={projectReference}
                      projectId={projectId}
                      onChange={(proj) => {
                        if (!proj) {
                          setProjectId(null);
                          setProjectReference("");
                          return;
                        }
                        setProjectId(Number(proj.id) || null);
                        setProjectReference(String(proj.nama || proj.name || `Proyek #${proj.id}`));
                      }}
                    />
                  </FormField>
                </View>
              </View>

              {/* Tautkan Modul ERP Lain dengan Komponen Select Bawaan */}
              <View className="flex-row flex-wrap gap-3">
                <View className="min-w-[220px] flex-1">
                  <FormField label="Tautkan ke Modul ERP Lain (Opsional)">
                    <SearchableSelect
                      value={
                        ERP_LINK_MODULE_OPTIONS.find((m) => m.value === linkedModule)?.label ??
                        "Tidak Ada Tautan"
                      }
                      options={ERP_LINK_MODULE_OPTIONS.map((m) => m.label)}
                      onChange={(label) => {
                        const found = ERP_LINK_MODULE_OPTIONS.find((m) => m.label === label);
                        setLinkedModule(found?.value ?? "");
                        setLinkedEntityId(null);
                        setLinkedRefCode("");
                      }}
                      className="h-11 rounded-lg border-border/80 bg-card"
                    />
                  </FormField>
                </View>

                {linkedModule === "PURCHASE_ORDER" ? (
                  <View className="min-w-[280px] flex-[1.5]">
                    <FormField label="Pilih PO Supplier">
                      <SupplierPoSelect
                        value={linkedRefCode}
                        poId={linkedEntityId}
                        onChange={(po) => {
                          if (!po) {
                            setLinkedEntityId(null);
                            setLinkedRefCode("");
                            return;
                          }
                          setLinkedEntityId(Number(po.id) || null);
                          setLinkedRefCode(String(po.nomor || po.number || `PO #${po.id}`));
                        }}
                      />
                    </FormField>
                  </View>
                ) : null}

                {linkedModule === "SALES_ORDER" ? (
                  <View className="min-w-[280px] flex-[1.5]">
                    <FormField label="Pilih Sales Order (SO Pelanggan)">
                      <PoClientSelect
                        value={linkedRefCode}
                        poId={linkedEntityId}
                        onChange={(so) => {
                          if (!so) {
                            setLinkedEntityId(null);
                            setLinkedRefCode("");
                            return;
                          }
                          setLinkedEntityId(Number(so.id) || null);
                          setLinkedRefCode(String(so.soNumber || so.poClientNumber || so.nomor || `SO #${so.id}`));
                        }}
                      />
                    </FormField>
                  </View>
                ) : null}

                {linkedModule === "PURCHASE_REQUEST" ? (
                  <View className="min-w-[280px] flex-[1.5]">
                    <FormField label="Pilih Request Barang (PR)">
                      <PurchaseRequestSelect
                        value={linkedRefCode}
                        requestId={linkedEntityId}
                        onChange={(pr) => {
                          if (!pr) {
                            setLinkedEntityId(null);
                            setLinkedRefCode("");
                            return;
                          }
                          setLinkedEntityId(Number(pr.id) || null);
                          setLinkedRefCode(String(pr.nomor || pr.number || `PR #${pr.id}`));
                        }}
                      />
                    </FormField>
                  </View>
                ) : null}

                {linkedModule === "QUOTATION" ? (
                  <View className="min-w-[280px] flex-[1.5]">
                    <FormField label="Pilih Penawaran (Quotation)">
                      <QuotationSelect
                        value={linkedRefCode}
                        quotationId={linkedEntityId}
                        onChange={(q) => {
                          if (!q) {
                            setLinkedEntityId(null);
                            setLinkedRefCode("");
                            return;
                          }
                          setLinkedEntityId(Number(q.id) || null);
                          setLinkedRefCode(String(q.nomor || q.number || `PNW #${q.id}`));
                        }}
                      />
                    </FormField>
                  </View>
                ) : null}

                {linkedModule === "INVOICE" ? (
                  <View className="min-w-[280px] flex-[1.5]">
                    <FormField label="Pilih Invoice">
                      <InvoiceSelect
                        value={linkedRefCode}
                        invoiceId={linkedEntityId}
                        onChange={(inv: any) => {
                          if (!inv) {
                            setLinkedEntityId(null);
                            setLinkedRefCode("");
                            return;
                          }
                          setLinkedEntityId(Number(inv.id) || null);
                          setLinkedRefCode(String(inv.nomor || inv.number || `INV #${inv.id}`));
                        }}
                      />
                    </FormField>
                  </View>
                ) : null}

                {linkedModule === "WORK_ORDER" ? (
                  <View className="min-w-[280px] flex-[1.5]">
                    <FormField label="Pilih Laporan Maintenance">
                      <MaintenanceSelect
                        value={linkedRefCode}
                        maintenanceId={linkedEntityId}
                        onChange={(m) => {
                          if (!m) {
                            setLinkedEntityId(null);
                            setLinkedRefCode("");
                            return;
                          }
                          setLinkedEntityId(Number(m.id) || null);
                          setLinkedRefCode(String(m.nomor || m.number || `MNT #${m.id}`));
                        }}
                      />
                    </FormField>
                  </View>
                ) : null}
              </View>

              {/* Jadwal Pembayaran */}
              <View className="mt-1 gap-2.5 border-t border-border/60 pt-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-semibold text-muted-foreground">
                    Jadwal Pembayaran / Milestone Komitmen ({schedules.length})
                  </Text>
                  <Button variant="outline" size="sm" className="h-8 gap-1" onPress={addScheduleRow}>
                    <Plus size={12} color={colors.primary} />
                    <Text className="text-[11px]">Tambah Jadwal Bayar</Text>
                  </Button>
                </View>
                {schedules.map((row, idx) => (
                  <View
                    key={idx}
                    className="flex-row flex-wrap items-center gap-2.5 rounded-lg border border-border/70 bg-card p-2.5"
                  >
                    <TextInput
                      value={row.milestoneName}
                      onChangeText={(v) => updateScheduleRow(idx, { milestoneName: v })}
                      placeholder="Nama Termin / Milestone"
                      className="min-w-[200px] flex-1 h-10 rounded-lg border border-border bg-background px-3 text-xs text-foreground"
                    />
                    <View className="w-[180px]">
                      <DatePicker
                        value={row.dueDate}
                        onChange={(v) => updateScheduleRow(idx, { dueDate: v })}
                      />
                    </View>
                    <TextInput
                      value={formatThousands(String(Math.round(Number(row.amount) || 0)))}
                      onChangeText={(v) =>
                        updateScheduleRow(idx, { amount: Number(v.replace(/\D/g, "")) || 0 })
                      }
                      keyboardType="numeric"
                      placeholder="Nominal"
                      className="w-[160px] h-10 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground"
                    />
                    <TouchableOpacity
                      onPress={() => removeScheduleRow(idx)}
                      className="h-10 w-10 items-center justify-center rounded-lg border border-border"
                    >
                      <Trash2 size={14} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>

            {/* 5. LINGKUP LAYANAN & SLA (PRD 3.2) */}
            <View className="gap-3.5 rounded-xl border border-border/70 bg-muted/20 p-4">
              <View className="flex-row flex-wrap items-center justify-between gap-2">
                <View>
                  <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    5. Daftar Layanan (Service Scope) & Ketentuan SLA
                  </Text>
                  <Text className="text-[11px] text-muted-foreground">
                    Satu kontrak dapat mencakup beberapa item layanan (Preventive, Corrective, Support, dsb.)
                  </Text>
                </View>
                <View className="flex-row gap-2">
                  <Button variant="outline" size="sm" className="h-8 gap-1" onPress={addServiceRow}>
                    <Plus size={12} color={colors.primary} />
                    <Text className="text-[11px]">Tambah Layanan</Text>
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 gap-1" onPress={addSlaRow}>
                    <Plus size={12} color={colors.primary} />
                    <Text className="text-[11px]">Tambah Target SLA</Text>
                  </Button>
                </View>
              </View>

              {services.map((svc, idx) => (
                <View
                  key={idx}
                  className="gap-2.5 rounded-lg border border-border/70 bg-card p-3"
                >
                  <View className="flex-row flex-wrap items-center gap-2.5">
                    <TextInput
                      value={svc.serviceName}
                      onChangeText={(v) => updateServiceRow(idx, { serviceName: v })}
                      placeholder="Nama Layanan (Mis: Preventive Maintenance CCTV)"
                      className="min-w-[220px] flex-1 h-10 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground"
                    />
                    <TextInput
                      value={svc.serviceLocation ?? ""}
                      onChangeText={(v) => updateServiceRow(idx, { serviceLocation: v })}
                      placeholder="Lokasi Layanan"
                      className="min-w-[160px] flex-1 h-10 rounded-lg border border-border bg-background px-3 text-xs text-foreground"
                    />
                    <TextInput
                      value={svc.supportContact ?? ""}
                      onChangeText={(v) => updateServiceRow(idx, { supportContact: v })}
                      placeholder="Kontak Support"
                      className="min-w-[160px] flex-1 h-10 rounded-lg border border-border bg-background px-3 text-xs text-foreground"
                    />
                    <TouchableOpacity
                      onPress={() => removeServiceRow(idx)}
                      className="h-10 w-10 items-center justify-center rounded-lg border border-border"
                    >
                      <Trash2 size={14} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    value={svc.serviceScope ?? ""}
                    onChangeText={(v) => updateServiceRow(idx, { serviceScope: v })}
                    placeholder="Lingkup pekerjaan, jadwal kunjungan, atau ketentuan garansi perangkat..."
                    className="h-10 rounded-lg border border-border bg-background px-3 text-xs text-foreground"
                  />
                </View>
              ))}

              {slas.map((sla, idx) => (
                <View
                  key={idx}
                  className="flex-row flex-wrap items-center gap-2.5 rounded-lg border border-border/70 bg-card p-3"
                >
                  <TextInput
                    value={sla.indicatorName}
                    onChangeText={(v) => updateSlaRow(idx, { indicatorName: v })}
                    placeholder="Indikator SLA (Mis: Response Time)"
                    className="min-w-[180px] flex-1 h-10 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground"
                  />
                  <TextInput
                    value={sla.targetMetric}
                    onChangeText={(v) => updateSlaRow(idx, { targetMetric: v })}
                    placeholder="Target (Mis: < 2 Jam / 99.9%)"
                    className="min-w-[140px] flex-1 h-10 rounded-lg border border-border bg-background px-3 text-xs text-foreground"
                  />
                  <TextInput
                    value={sla.operationalHours ?? ""}
                    onChangeText={(v) => updateSlaRow(idx, { operationalHours: v })}
                    placeholder="Jam Layanan (24/7)"
                    className="w-[130px] h-10 rounded-lg border border-border bg-background px-3 text-xs text-foreground"
                  />
                  <TextInput
                    value={sla.penaltyDetails ?? ""}
                    onChangeText={(v) => updateSlaRow(idx, { penaltyDetails: v })}
                    placeholder="Klausul Penalti jika SLA meleset"
                    className="min-w-[180px] flex-1 h-10 rounded-lg border border-border bg-background px-3 text-xs text-foreground"
                  />
                  <TouchableOpacity
                    onPress={() => removeSlaRow(idx)}
                    className="h-10 w-10 items-center justify-center rounded-lg border border-border"
                  >
                    <Trash2 size={14} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}

              <FormField label="Ringkasan Kontrak / Klausul Penting & Ketentuan Penalti">
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                  placeholder="Ringkasan lingkup perjanjian, hak & kewajiban utama, atau catatan klausul..."
                  className="min-h-[76px] rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                />
              </FormField>
            </View>

            {/* 6. UPLOAD DOKUMEN AWAL (SAAT PEMBUATAN KONTRAK BARU) */}
            {!isEdit ? (
              <View className="gap-3.5 rounded-xl border border-border/70 bg-muted/20 p-4">
                <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  6. Dokumen Kontrak Utama (Versi 1)
                </Text>

                <View className="flex-row flex-wrap gap-3">
                  <View className="min-w-[220px] flex-1">
                    <FormField label="Kategori Dokumen">
                      <SearchableSelect
                        value={
                          DOCUMENT_CATEGORY_OPTIONS.find(
                            (d) => d.value === initialDocumentCategory,
                          )?.label ?? initialDocumentCategory
                        }
                        options={DOCUMENT_CATEGORY_OPTIONS.map((d) => d.label)}
                        onChange={(label) => {
                          const found = DOCUMENT_CATEGORY_OPTIONS.find((d) => d.label === label);
                          if (found) setInitialDocumentCategory(found.value);
                        }}
                        className="h-11 rounded-lg border-border/80 bg-card"
                      />
                    </FormField>
                  </View>
                  <View className="min-w-[240px] flex-[1.4]">
                    <FormField label="Judul Dokumen (Opsional)">
                      <TextInput
                        value={initialDocumentTitle}
                        onChangeText={setInitialDocumentTitle}
                        placeholder="Otomatis mengikuti judul kontrak jika dikosongkan"
                        className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                      />
                    </FormField>
                  </View>
                  <View className="min-w-[200px] flex-1">
                    <FormField label="Tanggal Penandatanganan">
                      <DatePicker
                        value={initialDocumentSignedDate}
                        onChange={setInitialDocumentSignedDate}
                      />
                    </FormField>
                  </View>
                </View>

                <View className="flex-row flex-wrap items-end gap-3">
                  <View className="min-w-[220px] flex-1">
                    <FormField label="Penandatangan Pihak Pertama">
                      <TextInput
                        value={initialDocumentSignedByFirst}
                        onChangeText={setInitialDocumentSignedByFirst}
                        placeholder="Nama Direksi / Kuasa Perusahaan"
                        className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                      />
                    </FormField>
                  </View>
                  <View className="min-w-[220px] flex-1">
                    <FormField label="Penandatangan Pihak Kedua">
                      <TextInput
                        value={initialDocumentSignedBySecond}
                        onChangeText={setInitialDocumentSignedBySecond}
                        placeholder="Nama Direksi / Perwakilan Vendor/Klien"
                        className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                      />
                    </FormField>
                  </View>
                  <View className="min-w-[220px] flex-1">
                    <FormField label="Kerahasiaan Dokumen">
                      <TouchableOpacity
                        onPress={() => setInitialDocumentConfidential(!initialDocumentConfidential)}
                        className={`h-11 flex-row items-center gap-2.5 rounded-lg border px-3 ${
                          initialDocumentConfidential
                            ? "border-warning/50 bg-warning/10"
                            : "border-border bg-card"
                        }`}
                      >
                        <View
                          className={`h-5 w-5 items-center justify-center rounded border ${
                            initialDocumentConfidential
                              ? "border-warning bg-warning"
                              : "border-border bg-background"
                          }`}
                        >
                          {initialDocumentConfidential ? <Check size={12} color="#fff" /> : null}
                        </View>
                        <Text className="flex-1 text-xs font-semibold" numberOfLines={1}>
                          Dokumen Bersifat Confidential
                        </Text>
                      </TouchableOpacity>
                    </FormField>
                  </View>
                </View>

                <FormField label="Upload File Dokumen Kontrak (PDF, DOCX, XLSX)">
                  <FileUploader
                    label="Pilih File Dokumen Kontrak"
                    kind="dokumen"
                    category="contract"
                    autoFlush
                    onUploaded={(fileId) => setInitialDocumentUrl(`/api/upload/file/${fileId}`)}
                  />
                  {initialDocumentUrl ? (
                    <Text className="mt-1.5 text-xs font-semibold text-success">
                      ✓ Dokumen berhasil diunggah ({initialDocumentUrl})
                    </Text>
                  ) : null}
                </FormField>
              </View>
            ) : null}
          </View>
        </ScrollView>

        <DialogFooter className="border-t border-border/70 px-6 py-3 flex-row justify-end gap-2">
          <Button variant="outline" onPress={onClose} disabled={saving}>
            <Text className="text-xs">Batal</Text>
          </Button>
          <Button onPress={save} disabled={saving}>
            <Text className="text-xs text-white">
              {saving ? "Menyimpan..." : isEdit ? "Simpan Perubahan Kontrak" : "Simpan & Daftarkan Kontrak"}
            </Text>
          </Button>
        </DialogFooter>

        <QuickAddSupplierDialog
          open={quickSupplierOpen}
          onOpenChange={setQuickSupplierOpen}
          onSuccess={(newSupp) => {
            setCounterpartyName(String(newSupp.name || newSupp.nama || ""));
            if (newSupp.id) setCounterpartyId(Number(newSupp.id));
            if (newSupp.pic || newSupp.kontak) setPicName(String(newSupp.pic || newSupp.kontak));
            if (newSupp.phone || newSupp.telepon) setPicPhone(String(newSupp.phone || newSupp.telepon));
            if (newSupp.email) setPicEmail(String(newSupp.email));
          }}
        />

        <QuickAddCustomerDialog
          open={quickCustomerOpen}
          onOpenChange={setQuickCustomerOpen}
          onSuccess={(newCust) => {
            setCounterpartyName(String(newCust.company || newCust.name || newCust.nama || ""));
            if (newCust.id) setCounterpartyId(Number(newCust.id));
            if (newCust.pic || newCust.kontak) setPicName(String(newCust.pic || newCust.kontak));
            if (newCust.phone || newCust.telepon) setPicPhone(String(newCust.phone || newCust.telepon));
            if (newCust.email) setPicEmail(String(newCust.email));
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
