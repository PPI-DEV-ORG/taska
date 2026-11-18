import * as React from "react";
import { ScrollView, TextInput, TouchableOpacity, View } from "react-native";
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
import { DatePicker, SearchableSelect, UserSelect } from "@/components/taska/dialogs";
import { FileUploader } from "@/components/taska/file-uploader";
import { FormField } from "@/components/taska/basics";
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

type Props = {
  visible: boolean;
  onClose: () => void;
  contract?: CtrContract | null;
  lookups: ContractMasterLookups;
  onOpenTypeManager: () => void;
  onSuccess: () => void;
};

const TAX_PRESET_OPTIONS = [
  { label: "Tanpa Pajak (0%)", rate: 0 },
  { label: "PPN 11%", rate: 11 },
  { label: "PPN 12%", rate: 12 },
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
    contract?.department ?? user?.department ?? "IT & Infrastructure",
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
    contract?.financial?.costCenter ?? contract?.department ?? "",
  );
  const [projectReference, setProjectReference] = React.useState(
    contract?.financial?.projectReference ?? "",
  );

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

  // Linked ERP module (Optional quick link during creation)
  const [linkedModule, setLinkedModule] = React.useState("");
  const [linkedEntityId, setLinkedEntityId] = React.useState<number | null>(null);
  const [linkedRefCode, setLinkedRefCode] = React.useState("");

  const [saving, setSaving] = React.useState(false);

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

  function selectVendor(label: string) {
    const found = lookups.suppliers.find((s) => `${s.code} - ${s.name}` === label || s.name === label);
    if (found) {
      setCounterpartyId(found.id);
      setCounterpartyName(found.name);
      if (found.contactName) setPicName(found.contactName);
      if (found.phone) setPicPhone(found.phone);
      if (found.email) setPicEmail(found.email);
    }
  }

  function selectCustomer(label: string) {
    const found = lookups.customers.find(
      (c) => `${c.code} - ${c.company || c.name}` === label || c.name === label,
    );
    if (found) {
      setCounterpartyId(found.id);
      setCounterpartyName(found.company || found.name);
      if (found.contactName) setPicName(found.contactName);
      if (found.phone) setPicPhone(found.phone);
      if (found.email) setPicEmail(found.email);
    }
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
    if (!typeId) {
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
          role: counterpartyType === "CUSTOMER" ? "Pelanggan / Klien" : "Vendor / Penyedia Layanan",
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
        typeId,
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

  const selectedTypeObj = lookups.types.find((t) => t.id === typeId);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[96vw] max-w-4xl max-h-[93vh] p-0">
        <DialogHeader className="border-b border-border/70 px-5 py-4">
          <DialogTitle>
            {isEdit
              ? `Edit Kontrak · ${contract?.contractNumber}`
              : "Registrasi Kontrak & Perjanjian Baru"}
          </DialogTitle>
          <Text className="text-xs text-muted-foreground">
            Nomor ID internal (CTR-YYYY-XXXXX) dibuat otomatis dan terpisah dari nomor dokumen resmi eksternal.
          </Text>
        </DialogHeader>

        <ScrollView className="max-h-[75vh] px-5 py-4">
          <View className="gap-4 pb-4">
            {/* 1. IDENTITAS & KATEGORI KONTRAK */}
            <View className="gap-3 rounded-xl border border-border/80 bg-card p-3.5">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  1. Identitas & Kategori Kontrak
                </Text>
                <TouchableOpacity
                  onPress={onOpenTypeManager}
                  className="flex-row items-center gap-1 rounded-md border border-border px-2 py-1"
                >
                  <Settings2 size={12} color={colors.primary} />
                  <Text className="text-[11px] font-semibold text-primary">Kelola Kategori</Text>
                </TouchableOpacity>
              </View>

              <View className="flex-row flex-wrap gap-3">
                <View className="min-w-[240px] flex-[1.5]">
                  <FormField label="Judul / Nama Kontrak (Contract Title) *" required>
                    <TextInput
                      value={title}
                      onChangeText={setTitle}
                      placeholder="Contoh: Perjanjian Maintenance Perangkat CCTV & Server"
                      className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                    />
                  </FormField>
                </View>
                <View className="min-w-[200px] flex-1">
                  <FormField label="Kategori Kontrak (Contract Type) *" required>
                    <SearchableSelect
                      value={selectedTypeObj ? `${selectedTypeObj.code} - ${selectedTypeObj.name}` : ""}
                      options={lookups.types.map((t) => `${t.code} - ${t.name}`)}
                      onChange={(label) => {
                        const found = lookups.types.find((t) => `${t.code} - ${t.name}` === label);
                        if (found) setTypeId(found.id);
                      }}
                      placeholder="Pilih kategori kontrak"
                      className="h-11 rounded-lg border-border/80 bg-card"
                    />
                  </FormField>
                </View>
              </View>

              <View className="flex-row flex-wrap gap-3">
                <View className="min-w-[180px] flex-1">
                  <FormField label="Nomor Dokumen Resmi (Contract Number)">
                    <TextInput
                      value={officialNumber}
                      onChangeText={setOfficialNumber}
                      placeholder="Nomor surat perjanjian vendor/klien..."
                      className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                    />
                  </FormField>
                </View>
                <View className="min-w-[180px] flex-1">
                  <FormField label="Departemen Terkait *" required>
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
                <View className="min-w-[200px] flex-1">
                  <FormField label="Contract Owner (PIC Internal)">
                    <UserSelect
                      value={contractOwnerId}
                      onChange={setContractOwnerId}
                      placeholder="Pilih PIC internal"
                    />
                  </FormField>
                </View>
              </View>
            </View>

            {/* 2. PIHAK TERKAIT (COUNTERPARTY) */}
            <View className="gap-3 rounded-xl border border-border/80 bg-card p-3.5">
              <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                2. Pihak Terkait (Counterparty — Referensi Master Data ERP)
              </Text>

              <View className="flex-row flex-wrap gap-3">
                <View className="min-w-[180px] flex-1">
                  <FormField label="Jenis Pihak Terkait *" required>
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
                        }
                      }}
                      className="h-11 rounded-lg border-border/80 bg-card"
                    />
                  </FormField>
                </View>

                {counterpartyType === "VENDOR" ? (
                  <View className="min-w-[240px] flex-[1.5]">
                    <FormField label="Pilih dari Master Vendor / Supplier ERP">
                      <SearchableSelect
                        value={
                          counterpartyId
                            ? lookups.suppliers.find((s) => s.id === counterpartyId)
                              ? `${lookups.suppliers.find((s) => s.id === counterpartyId)!.code} - ${lookups.suppliers.find((s) => s.id === counterpartyId)!.name}`
                              : counterpartyName
                            : ""
                        }
                        options={lookups.suppliers.map((s) => `${s.code} - ${s.name}`)}
                        onChange={selectVendor}
                        placeholder="Cari & pilih supplier terdaftar..."
                        clearable
                        className="h-11 rounded-lg border-border/80 bg-card"
                      />
                    </FormField>
                  </View>
                ) : null}

                {counterpartyType === "CUSTOMER" ? (
                  <View className="min-w-[240px] flex-[1.5]">
                    <FormField label="Pilih dari Master Pelanggan / Customer ERP">
                      <SearchableSelect
                        value={
                          counterpartyId
                            ? lookups.customers.find((c) => c.id === counterpartyId)
                              ? `${lookups.customers.find((c) => c.id === counterpartyId)!.code} - ${lookups.customers.find((c) => c.id === counterpartyId)!.company || lookups.customers.find((c) => c.id === counterpartyId)!.name}`
                              : counterpartyName
                            : ""
                        }
                        options={lookups.customers.map(
                          (c) => `${c.code} - ${c.company || c.name}`,
                        )}
                        onChange={selectCustomer}
                        placeholder="Cari & pilih pelanggan terdaftar..."
                        clearable
                        className="h-11 rounded-lg border-border/80 bg-card"
                      />
                    </FormField>
                  </View>
                ) : null}

                <View className="min-w-[220px] flex-[1.5]">
                  <FormField label="Nama Resmi Pihak Terkait (Vendor / Klien / Mitra) *" required>
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
                <View className="min-w-[180px] flex-1">
                  <FormField label="Nama PIC Eksternal">
                    <TextInput
                      value={picName}
                      onChangeText={setPicName}
                      placeholder="Nama perwakilan vendor/klien"
                      className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                    />
                  </FormField>
                </View>
                <View className="min-w-[180px] flex-1">
                  <FormField label="No. Telepon / WhatsApp Support">
                    <TextInput
                      value={picPhone}
                      onChangeText={setPicPhone}
                      placeholder="0812..."
                      className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                    />
                  </FormField>
                </View>
                <View className="min-w-[180px] flex-1">
                  <FormField label="Email Kontak / Support">
                    <TextInput
                      value={picEmail}
                      onChangeText={setPicEmail}
                      placeholder="legal@vendor.com"
                      autoCapitalize="none"
                      className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                    />
                  </FormField>
                </View>
              </View>
            </View>

            {/* 3. MASA BERLAKU, REMINDER & STATUS */}
            <View className="gap-3 rounded-xl border border-border/80 bg-card p-3.5">
              <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                3. Masa Berlaku, Tanggal Evaluasi Renewal & Status
              </Text>

              <View className="flex-row flex-wrap gap-3">
                <View className="min-w-[170px] flex-1">
                  <FormField label="Effective Date (Mulai Berlaku) *" required>
                    <DatePicker value={effectiveDate} onChange={handleEffectiveChange} />
                  </FormField>
                </View>
                <View className="min-w-[170px] flex-1">
                  <FormField label="Expiration Date (Tanggal Berakhir) *" required>
                    <DatePicker value={expirationDate} onChange={handleExpirationChange} />
                  </FormField>
                </View>
                <View className="min-w-[170px] flex-1">
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

              <View className="flex-row flex-wrap items-center gap-3">
                <View className="min-w-[180px] flex-1">
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
                <View className="min-w-[180px] flex-1">
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
                <View className="min-w-[220px] flex-1 pt-4">
                  <TouchableOpacity
                    onPress={() => setIsAutoRenewal(!isAutoRenewal)}
                    className={`flex-row items-center gap-2 rounded-lg border px-3 py-2.5 ${
                      isAutoRenewal
                        ? "border-primary/50 bg-primary/10"
                        : "border-border bg-background"
                    }`}
                  >
                    <View
                      className={`h-5 w-5 items-center justify-center rounded border ${
                        isAutoRenewal ? "border-primary bg-primary" : "border-border bg-card"
                      }`}
                    >
                      {isAutoRenewal ? <Check size={12} color="#fff" /> : null}
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs font-semibold">Memiliki Klausul Auto-Renewal</Text>
                      <Text className="text-[10px] text-muted-foreground">
                        Tetap memerlukan persetujuan internal sebelum perpanjangan
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* 4. NILAI KONTRAK, PAJAK & KOMITMEN FINANSIAL */}
            <View className="gap-3 rounded-xl border border-border/80 bg-card p-3.5">
              <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                4. Nilai Kontrak, Perlakuan Pajak & Komitmen Finansial
              </Text>

              <View className="flex-row flex-wrap gap-3">
                <View className="min-w-[180px] flex-1">
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
                <View className="min-w-[110px] w-[120px]">
                  <FormField label="Mata Uang">
                    <SearchableSelect
                      value={currency}
                      options={["IDR", "USD", "SGD", "EUR"]}
                      onChange={setCurrency}
                      className="h-11 rounded-lg border-border/80 bg-card"
                    />
                  </FormField>
                </View>
                <View className="min-w-[180px] flex-1">
                  <FormField label="Nilai Dasar / DPP *" required>
                    <TextInput
                      value={formatThousands(baseAmount)}
                      onChangeText={(txt) => setBaseAmount(txt.replace(/\D/g, ""))}
                      keyboardType="numeric"
                      placeholder="0"
                      className="h-11 rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground"
                    />
                  </FormField>
                </View>
                <View className="min-w-[160px] flex-1">
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

              <View className="flex-row flex-wrap items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3.5 py-2.5">
                <Text className="text-xs text-muted-foreground">
                  DPP: {formatContractCurrency(numericBase, currency)} + Pajak ({numericTaxPct}%):{" "}
                  {formatContractCurrency(computedTaxAmount, currency)}
                </Text>
                <Text className="text-sm font-bold text-primary">
                  Total Nilai Kontrak: {formatContractCurrency(computedTotalValue, currency)}
                </Text>
              </View>

              <View className="flex-row flex-wrap gap-3">
                <View className="min-w-[170px] flex-1">
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
                      className="h-10 rounded-lg border-border/80 bg-card"
                    />
                  </FormField>
                </View>
                <View className="min-w-[170px] flex-1">
                  <FormField label="Ketentuan Pembayaran (Payment Terms)">
                    <TextInput
                      value={paymentTerms}
                      onChangeText={setPaymentTerms}
                      placeholder="Mis. Net 30 Hari / Termin 50%-50%"
                      className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                    />
                  </FormField>
                </View>
                <View className="min-w-[150px] flex-1">
                  <FormField label="Down Payment (Uang Muka)">
                    <TextInput
                      value={formatThousands(downPaymentAmount)}
                      onChangeText={(txt) => setDownPaymentAmount(txt.replace(/\D/g, ""))}
                      keyboardType="numeric"
                      placeholder="0"
                      className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                    />
                  </FormField>
                </View>
                <View className="min-w-[150px] flex-1">
                  <FormField label="Retensi (Retention)">
                    <TextInput
                      value={formatThousands(retentionAmount)}
                      onChangeText={(txt) => setRetentionAmount(txt.replace(/\D/g, ""))}
                      keyboardType="numeric"
                      placeholder="0"
                      className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                    />
                  </FormField>
                </View>
              </View>

              <View className="flex-row flex-wrap gap-3">
                <View className="min-w-[180px] flex-1">
                  <FormField label="Cost Center (Pusat Biaya)">
                    <TextInput
                      value={costCenter}
                      onChangeText={setCostCenter}
                      placeholder="Departemen / Cost Center"
                      className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                    />
                  </FormField>
                </View>
                <View className="min-w-[200px] flex-1">
                  <FormField label="Referensi Proyek (Project Reference)">
                    <SearchableSelect
                      value={projectReference}
                      options={lookups.projects.map((p) => `${p.number} - ${p.name}`)}
                      onChange={setProjectReference}
                      placeholder="Pilih proyek terkait (opsional)"
                      clearable
                      className="h-10 rounded-lg border-border/80 bg-card"
                    />
                  </FormField>
                </View>
                <View className="min-w-[200px] flex-1">
                  <FormField label="Tautkan Modul ERP Lain (Opsional)">
                    <SearchableSelect
                      value={linkedRefCode}
                      options={[
                        ...lookups.subscriptions.map(
                          (s) => `SUBSCRIPTION:${s.id}:${s.subscriptionCode} - ${s.serviceName}`,
                        ),
                        ...lookups.supplierPos.map(
                          (po) => `PURCHASE_ORDER:${po.id}:${po.number} (${po.supplier?.name ?? "PO"})`,
                        ),
                        ...lookups.assets.map(
                          (a) => `FIXED_ASSET:${a.id}:${a.assetCode} - ${a.name}`,
                        ),
                      ]}
                      onChange={(val) => {
                        if (!val) {
                          setLinkedModule("");
                          setLinkedEntityId(null);
                          setLinkedRefCode("");
                          return;
                        }
                        const [mod, idStr, ...rest] = val.split(":");
                        setLinkedModule(mod ?? "");
                        setLinkedEntityId(Number(idStr) || null);
                        setLinkedRefCode(rest.join(":"));
                      }}
                      placeholder="Pilih Subscription / PO / Aset..."
                      clearable
                      className="h-10 rounded-lg border-border/80 bg-card"
                    />
                  </FormField>
                </View>
              </View>

              {/* Jadwal Pembayaran */}
              <View className="mt-1 gap-2 border-t border-border/60 pt-3">
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
                    className="flex-row flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-muted/20 p-2"
                  >
                    <TextInput
                      value={row.milestoneName}
                      onChangeText={(v) => updateScheduleRow(idx, { milestoneName: v })}
                      placeholder="Nama Termin / Milestone"
                      className="min-w-[160px] flex-1 h-9 rounded border border-border bg-background px-2.5 text-xs text-foreground"
                    />
                    <View className="w-[150px]">
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
                      className="w-[130px] h-9 rounded border border-border bg-background px-2.5 text-xs text-foreground"
                    />
                    <TouchableOpacity
                      onPress={() => removeScheduleRow(idx)}
                      className="rounded border border-border p-2"
                    >
                      <Trash2 size={13} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>

            {/* 5. LINGKUP LAYANAN & SLA (PRD 3.2) */}
            <View className="gap-3 rounded-xl border border-border/80 bg-card p-3.5">
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
                  className="gap-2 rounded-lg border border-border/70 bg-muted/20 p-2.5"
                >
                  <View className="flex-row flex-wrap items-center gap-2">
                    <TextInput
                      value={svc.serviceName}
                      onChangeText={(v) => updateServiceRow(idx, { serviceName: v })}
                      placeholder="Nama Layanan (Mis: Preventive Maintenance CCTV)"
                      className="min-w-[200px] flex-1 h-9 rounded border border-border bg-background px-2.5 text-xs font-semibold text-foreground"
                    />
                    <TextInput
                      value={svc.serviceLocation ?? ""}
                      onChangeText={(v) => updateServiceRow(idx, { serviceLocation: v })}
                      placeholder="Lokasi Layanan"
                      className="min-w-[140px] flex-1 h-9 rounded border border-border bg-background px-2.5 text-xs text-foreground"
                    />
                    <TextInput
                      value={svc.supportContact ?? ""}
                      onChangeText={(v) => updateServiceRow(idx, { supportContact: v })}
                      placeholder="Kontak Support"
                      className="min-w-[140px] flex-1 h-9 rounded border border-border bg-background px-2.5 text-xs text-foreground"
                    />
                    <TouchableOpacity
                      onPress={() => removeServiceRow(idx)}
                      className="rounded border border-border p-2"
                    >
                      <Trash2 size={13} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    value={svc.serviceScope ?? ""}
                    onChangeText={(v) => updateServiceRow(idx, { serviceScope: v })}
                    placeholder="Lingkup pekerjaan, jadwal kunjungan, atau ketentuan garansi perangkat..."
                    className="h-9 rounded border border-border bg-background px-2.5 text-xs text-foreground"
                  />
                </View>
              ))}

              {slas.map((sla, idx) => (
                <View
                  key={idx}
                  className="flex-row flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-muted/20 p-2.5"
                >
                  <TextInput
                    value={sla.indicatorName}
                    onChangeText={(v) => updateSlaRow(idx, { indicatorName: v })}
                    placeholder="Indikator SLA (Mis: Response Time)"
                    className="min-w-[170px] flex-1 h-9 rounded border border-border bg-background px-2.5 text-xs font-semibold text-foreground"
                  />
                  <TextInput
                    value={sla.targetMetric}
                    onChangeText={(v) => updateSlaRow(idx, { targetMetric: v })}
                    placeholder="Target (Mis: < 2 Jam / 99.9%)"
                    className="min-w-[130px] flex-1 h-9 rounded border border-border bg-background px-2.5 text-xs text-foreground"
                  />
                  <TextInput
                    value={sla.operationalHours ?? ""}
                    onChangeText={(v) => updateSlaRow(idx, { operationalHours: v })}
                    placeholder="Jam Layanan (24/7 atau 8x5)"
                    className="w-[110px] h-9 rounded border border-border bg-background px-2.5 text-xs text-foreground"
                  />
                  <TextInput
                    value={sla.penaltyDetails ?? ""}
                    onChangeText={(v) => updateSlaRow(idx, { penaltyDetails: v })}
                    placeholder="Klausul Penalti jika SLA meleset"
                    className="min-w-[160px] flex-1 h-9 rounded border border-border bg-background px-2.5 text-xs text-foreground"
                  />
                  <TouchableOpacity
                    onPress={() => removeSlaRow(idx)}
                    className="rounded border border-border p-2"
                  >
                    <Trash2 size={13} color={colors.danger} />
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
                  className="min-h-[72px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </FormField>
            </View>

            {/* 6. UPLOAD DOKUMEN AWAL (SAAT PEMBUATAN KONTRAK BARU) */}
            {!isEdit ? (
              <View className="gap-3 rounded-xl border border-border/80 bg-card p-3.5">
                <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  6. Dokumen Kontrak Utama (Versi 1)
                </Text>

                <View className="flex-row flex-wrap gap-3">
                  <View className="min-w-[200px] flex-1">
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
                        className="h-10 rounded-lg border-border/80 bg-card"
                      />
                    </FormField>
                  </View>
                  <View className="min-w-[220px] flex-[1.5]">
                    <FormField label="Judul Dokumen (Opsional)">
                      <TextInput
                        value={initialDocumentTitle}
                        onChangeText={setInitialDocumentTitle}
                        placeholder="Otomatis mengikuti judul kontrak jika dikosongkan"
                        className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                      />
                    </FormField>
                  </View>
                  <View className="min-w-[160px] flex-1">
                    <FormField label="Tanggal Penandatanganan">
                      <DatePicker
                        value={initialDocumentSignedDate}
                        onChange={setInitialDocumentSignedDate}
                      />
                    </FormField>
                  </View>
                </View>

                <View className="flex-row flex-wrap items-center gap-3">
                  <View className="min-w-[180px] flex-1">
                    <FormField label="Penandatangan Pihak Pertama">
                      <TextInput
                        value={initialDocumentSignedByFirst}
                        onChangeText={setInitialDocumentSignedByFirst}
                        placeholder="Nama Direksi / Kuasa Perusahaan"
                        className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                      />
                    </FormField>
                  </View>
                  <View className="min-w-[180px] flex-1">
                    <FormField label="Penandatangan Pihak Kedua">
                      <TextInput
                        value={initialDocumentSignedBySecond}
                        onChangeText={setInitialDocumentSignedBySecond}
                        placeholder="Nama Direksi / Perwakilan Vendor/Klien"
                        className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                      />
                    </FormField>
                  </View>
                  <View className="min-w-[200px] flex-1 pt-4">
                    <TouchableOpacity
                      onPress={() => setInitialDocumentConfidential(!initialDocumentConfidential)}
                      className={`flex-row items-center gap-2 rounded-lg border px-3 py-2 ${
                        initialDocumentConfidential
                          ? "border-warning/50 bg-warning/10"
                          : "border-border bg-background"
                      }`}
                    >
                      <View
                        className={`h-5 w-5 items-center justify-center rounded border ${
                          initialDocumentConfidential
                            ? "border-warning bg-warning"
                            : "border-border bg-card"
                        }`}
                      >
                        {initialDocumentConfidential ? <Check size={12} color="#fff" /> : null}
                      </View>
                      <Text className="text-xs font-semibold">Dokumen Bersifat Confidential</Text>
                    </TouchableOpacity>
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

        <DialogFooter className="border-t border-border/70 px-5 py-3 flex-row justify-end gap-2">
          <Button variant="outline" onPress={onClose} disabled={saving}>
            <Text className="text-xs">Batal</Text>
          </Button>
          <Button onPress={save} disabled={saving}>
            <Text className="text-xs text-white">
              {saving ? "Menyimpan..." : isEdit ? "Simpan Perubahan Kontrak" : "Simpan & Daftarkan Kontrak"}
            </Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
