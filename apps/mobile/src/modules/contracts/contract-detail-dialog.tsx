import * as React from "react";
import { Alert, Linking, Platform, ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import {
  Check,
  CheckCircle2,
  Download,
  FilePlus2,
  FileText,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DatePicker,
  MaintenanceSelect,
  PoClientSelect,
  ProjectSelect,
  PurchaseRequestSelect,
  QuotationSelect,
  SearchableSelect,
  SupplierPoSelect,
} from "@/components/taska/dialogs";
import { InvoiceSelect } from "@/components/taska/document-select";
import { FileUploader } from "@/components/taska/file-uploader";
import { colors } from "@/tokens";
import { api, apiBase } from "@/services/api";
import { hasUserPermission } from "@/constants/modules";
import { useApp } from "@/store/app-store";
import { formatThousands, tanggal, tanggalJam } from "@/lib/format";
import type { ContractMasterLookups, CtrContract, CtrDocument } from "./types";
import {
  DOCUMENT_CATEGORY_LABEL,
  DOCUMENT_CATEGORY_OPTIONS,
  PAYMENT_FREQUENCY_LABEL,
  expirationDaysLabel,
  formatContractCurrency,
  todayWibIso,
} from "./contract-utils";
import {
  ApprovalStatusBadge,
  ContractStatusBadge,
  ContractTabs,
  CounterpartyBadge,
  EmptyRow,
  InfoLine,
} from "./contract-ui";

type Props = {
  visible: boolean;
  contractId: number | null;
  lookups: ContractMasterLookups;
  onClose: () => void;
  onRefresh: () => void;
  onEdit: (ctr: CtrContract) => void;
  onOpenApproval: (ctr: CtrContract) => void;
  onOpenRenewal: (ctr: CtrContract) => void;
  onOpenAmendment: (ctr: CtrContract) => void;
  onOpenTermination: (ctr: CtrContract) => void;
};

function openFileUrl(rawUrl?: string | null) {
  if (!rawUrl) return;
  const baseUrl = apiBase();
  const full = rawUrl.startsWith("http")
    ? rawUrl
    : `${baseUrl.replace(/\/api\/?$/, "")}${rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`}`;
  void Linking.openURL(full);
}

export function ContractDetailDialog(props: Props) {
  if (!props.visible || !props.contractId) return null;
  return <DetailContent key={props.contractId} {...props} contractId={props.contractId} />;
}

function DetailContent({
  contractId,
  lookups,
  onClose,
  onRefresh,
  onEdit,
  onOpenApproval,
  onOpenRenewal,
  onOpenAmendment,
  onOpenTermination,
}: Props & { contractId: number }) {
  const { toast, user } = useApp();
  const [ctr, setCtr] = React.useState<CtrContract | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState("overview");

  // Upload dokumen baru
  const [docCategory, setDocCategory] = React.useState("MAIN_CONTRACT");
  const [docTitle, setDocTitle] = React.useState("");
  const [docNumber, setDocNumber] = React.useState("");
  const [docSignedDate, setDocSignedDate] = React.useState(todayWibIso());
  const [docConfidential, setDocConfidential] = React.useState(false);
  const [docFileUrl, setDocFileUrl] = React.useState("");
  const [docSummary, setDocSummary] = React.useState("");
  const [savingDoc, setSavingDoc] = React.useState(false);

  // Upload revisi versi dokumen
  const [revisionDocId, setRevisionDocId] = React.useState<number | null>(null);
  const [revisionFileUrl, setRevisionFileUrl] = React.useState("");
  const [revisionSummary, setRevisionSummary] = React.useState("");
  const [savingRevision, setSavingRevision] = React.useState(false);

  // Tambah jadwal bayar
  const [schedMilestone, setSchedMilestone] = React.useState("");
  const [schedDueDate, setSchedDueDate] = React.useState(todayWibIso());
  const [schedAmount, setSchedAmount] = React.useState("");
  const [savingSched, setSavingSched] = React.useState(false);

  // Tambah relasi ERP
  const [relModule, setRelModule] = React.useState("PURCHASE_ORDER");
  const [relEntityId, setRelEntityId] = React.useState<number | null>(null);
  const [relRefCode, setRelRefCode] = React.useState("");
  const [savingRel, setSavingRel] = React.useState(false);

  const canUpdate = hasUserPermission(user, "contracts", "U");
  const canDelete = hasUserPermission(user, "contracts", "A");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<CtrContract>(`/contracts/${contractId}`);
      setCtr(data);
    } catch (e: any) {
      toast(e?.message ?? "Gagal memuat detail kontrak", "danger");
    } finally {
      setLoading(false);
    }
  }, [contractId, toast]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function addDocument() {
    if (!ctr) return;
    if (!docTitle.trim()) {
      toast("Judul dokumen wajib diisi", "danger");
      return;
    }
    if (!docFileUrl.trim()) {
      toast("Unggah file dokumen terlebih dahulu", "danger");
      return;
    }
    setSavingDoc(true);
    try {
      await api.post(`/contracts/${ctr.id}/documents`, {
        documentTitle: docTitle.trim(),
        documentCategory: docCategory,
        documentNumber: docNumber.trim() || undefined,
        signedDate: docSignedDate || undefined,
        isConfidential: docConfidential,
        fileUrl: docFileUrl.trim(),
        changeSummary: docSummary.trim() || "Versi 1 diunggah",
      });
      toast("Dokumen kontrak berhasil ditambahkan");
      setDocTitle("");
      setDocNumber("");
      setDocFileUrl("");
      setDocSummary("");
      await load();
      onRefresh();
    } catch (e: any) {
      toast(e?.message ?? "Gagal mengunggah dokumen", "danger");
    } finally {
      setSavingDoc(false);
    }
  }

  async function addRevision(doc: CtrDocument) {
    if (!ctr) return;
    if (!revisionFileUrl.trim()) {
      toast("Unggah file revisi terlebih dahulu", "danger");
      return;
    }
    setSavingRevision(true);
    try {
      await api.post(`/contracts/${ctr.id}/documents/${doc.id}/versions`, {
        fileUrl: revisionFileUrl.trim(),
        changeSummary:
          revisionSummary.trim() || `Revisi versi v${doc.currentVersionNumber + 1}`,
      });
      toast(`Versi v${doc.currentVersionNumber + 1} berhasil disimpan tanpa menghapus versi lama`);
      setRevisionDocId(null);
      setRevisionFileUrl("");
      setRevisionSummary("");
      await load();
      onRefresh();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menyimpan versi revisi", "danger");
    } finally {
      setSavingRevision(false);
    }
  }

  async function deleteDocument(doc: CtrDocument) {
    if (!ctr) return;
    Alert.alert("Hapus Dokumen", `Hapus dokumen "${doc.documentTitle}"?`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/contracts/${ctr.id}/documents/${doc.id}`);
            toast("Dokumen berhasil dihapus");
            await load();
            onRefresh();
          } catch (e: any) {
            toast(e?.message ?? "Gagal menghapus dokumen", "danger");
          }
        },
      },
    ]);
  }

  async function addSchedule() {
    if (!ctr) return;
    const amt = Number(schedAmount.replace(/\D/g, "")) || 0;
    if (!schedMilestone.trim() || amt <= 0) {
      toast("Nama termin dan nominal harus diisi", "danger");
      return;
    }
    setSavingSched(true);
    try {
      await api.post(`/contracts/${ctr.id}/payment-schedules`, {
        milestoneName: schedMilestone.trim(),
        dueDate: schedDueDate,
        amount: amt,
        totalAmount: amt,
        paymentStatus: "PLANNED",
      });
      toast("Jadwal pembayaran ditambahkan");
      setSchedMilestone("");
      setSchedAmount("");
      await load();
      onRefresh();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menambah jadwal pembayaran", "danger");
    } finally {
      setSavingSched(false);
    }
  }

  async function updateScheduleStatus(scheduleId: number, status: string) {
    if (!ctr) return;
    try {
      await api.patch(`/contracts/${ctr.id}/payment-schedules/${scheduleId}`, {
        paymentStatus: status,
        ...(status === "PAID" ? { paidDate: todayWibIso() } : {}),
      });
      toast(`Status jadwal pembayaran diperbarui ke ${status}`);
      await load();
      onRefresh();
    } catch (e: any) {
      toast(e?.message ?? "Gagal memperbarui jadwal pembayaran", "danger");
    }
  }

  async function decideRenewalItem(renewalId: number, decision: "APPROVED" | "REJECTED") {
    if (!ctr) return;
    try {
      await api.post(`/contracts/${ctr.id}/renewals/${renewalId}/decision`, {
        decision,
        reviewComments:
          decision === "APPROVED"
            ? "Perpanjangan disetujui"
            : "Perpanjangan ditolak",
      });
      toast(`Renewal ${decision === "APPROVED" ? "disetujui" : "ditolak"}`);
      await load();
      onRefresh();
    } catch (e: any) {
      toast(e?.message ?? "Gagal memproses keputusan renewal", "danger");
    }
  }

  async function addErpRelation() {
    if (!ctr || !relModule || !relEntityId) return;
    setSavingRel(true);
    try {
      await api.post(`/contracts/${ctr.id}/relations`, {
        relatedModule: relModule,
        relatedId: Number(relEntityId),
        referenceCode: relRefCode,
      });
      toast("Relasi modul ERP berhasil ditautkan");
      setRelEntityId(null);
      setRelRefCode("");
      await load();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menautkan modul ERP", "danger");
    } finally {
      setSavingRel(false);
    }
  }

  async function removeErpRelation(relationId: number) {
    if (!ctr) return;
    try {
      await api.delete(`/contracts/${ctr.id}/relations/${relationId}`);
      toast("Tautan modul dilepas");
      await load();
    } catch (e: any) {
      toast(e?.message ?? "Gagal melepas tautan", "danger");
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
        <DialogHeader className="border-b border-border/70 px-5 py-4">
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <View className="flex-1 gap-1">
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className="font-mono text-sm font-bold text-primary">
                  {ctr?.contractNumber ?? "..."}
                </Text>
                {ctr ? <ContractStatusBadge status={ctr.status} /> : null}
                {ctr ? <ApprovalStatusBadge status={ctr.approvalStatus} /> : null}
                {ctr ? <CounterpartyBadge type={ctr.counterpartyType} /> : null}
              </View>
              <DialogTitle className="text-base">{ctr?.title ?? "Memuat Kontrak..."}</DialogTitle>
            </View>

            {ctr && canUpdate ? (
              <View className="flex-row flex-wrap items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  onPress={() => onEdit(ctr)}
                >
                  <Pencil size={12} color={colors.primary} />
                  <Text className="text-xs">Edit</Text>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  onPress={() => onOpenApproval(ctr)}
                >
                  <ShieldCheck size={12} color={colors.primary} />
                  <Text className="text-xs">Approval</Text>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  onPress={() => onOpenRenewal(ctr)}
                >
                  <RefreshCw size={12} color={colors.primary} />
                  <Text className="text-xs">Renewal</Text>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  onPress={() => onOpenAmendment(ctr)}
                >
                  <FilePlus2 size={12} color={colors.primary} />
                  <Text className="text-xs">Addendum</Text>
                </Button>
                {ctr.status !== "TERMINATED" ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 gap-1"
                    onPress={() => onOpenTermination(ctr)}
                  >
                    <XCircle size={12} color="#fff" />
                    <Text className="text-xs text-white">Terminasi</Text>
                  </Button>
                ) : null}
              </View>
            ) : null}
          </View>
        </DialogHeader>

        <View className="border-b border-border/60 px-5 py-2.5">
          <ContractTabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "overview", label: "Ringkasan" },
              {
                value: "services",
                label: "Layanan & SLA",
                count: (ctr?.services?.length ?? 0) + (ctr?.slas?.length ?? 0),
              },
              {
                value: "documents",
                label: "Dokumen & Versi",
                count: ctr?.documents?.length ?? 0,
              },
              {
                value: "financial",
                label: "Finansial & Jadwal Bayar",
                count: ctr?.paymentSchedules?.length ?? 0,
              },
              {
                value: "approval",
                label: "Approval & Renewal",
                count: (ctr?.approvals?.length ?? 0) + (ctr?.renewals?.length ?? 0),
              },
              {
                value: "amendments",
                label: "Addendum & Modul ERP",
                count: (ctr?.amendments?.length ?? 0) + (ctr?.relations?.length ?? 0),
              },
              {
                value: "audit",
                label: "Audit Trail",
                count: ctr?.auditLogs?.length ?? 0,
              },
            ]}
          />
        </View>

        <ScrollView className="max-h-[68vh] px-5 py-4">
          {!ctr || loading ? (
            <EmptyRow text="Memuat informasi lengkap kontrak..." />
          ) : (
            <View className="gap-4 pb-4">
              {/* TAB 1: OVERVIEW */}
              {tab === "overview" ? (
                <View className="gap-4">
                  <View className="flex-row flex-wrap gap-3 rounded-xl border border-border/80 bg-card p-4">
                    <InfoLine label="Kode Internal (Contract ID)" value={ctr.contractNumber} />
                    <InfoLine
                      label="Nomor Dokumen Resmi"
                      value={ctr.officialNumber || "Belum dicantumkan"}
                    />
                    <InfoLine label="Kategori Kontrak" value={ctr.typeName} />
                    <InfoLine label="Pihak Terkait (Counterparty)" value={ctr.counterpartyName} />
                    <InfoLine label="Departemen" value={ctr.department} />
                    <InfoLine
                      label="Contract Owner (PIC)"
                      value={ctr.ownerUser?.name || "-"}
                    />
                    <InfoLine label="Effective Date" value={tanggal(ctr.effectiveDate)} />
                    <InfoLine
                      label="Expiration Date"
                      value={`${tanggal(ctr.expirationDate)} (${expirationDaysLabel(ctr.daysToExpiration)})`}
                    />
                    <InfoLine
                      label="Renewal Date (Evaluasi)"
                      value={ctr.renewalDate ? tanggal(ctr.renewalDate) : "-"}
                    />
                    <InfoLine
                      label="Klausul Auto-Renewal"
                      value={ctr.isAutoRenewal ? "Ya (Tetap wajib approval)" : "Tidak"}
                    />
                    <InfoLine
                      label="Nilai Kontrak"
                      value={formatContractCurrency(ctr.contractValue, ctr.currency)}
                    />
                    <InfoLine
                      label="Frekuensi & Ketentuan Bayar"
                      value={`${PAYMENT_FREQUENCY_LABEL[ctr.paymentFrequency] ?? ctr.paymentFrequency} · ${ctr.paymentTerms || "-"}`}
                    />
                  </View>

                  {ctr.description ? (
                    <View className="rounded-xl border border-border/80 bg-card p-4">
                      <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Ringkasan Lingkup & Klausul Kontrak
                      </Text>
                      <Text className="mt-1.5 text-sm leading-relaxed">{ctr.description}</Text>
                    </View>
                  ) : null}

                  {ctr.termination ? (
                    <View className="rounded-xl border border-danger/40 bg-danger/5 p-4">
                      <Text className="text-xs font-bold uppercase tracking-wider text-danger">
                        Informasi Penghentian Kontrak (Terminated)
                      </Text>
                      <Text className="mt-1 text-sm font-semibold">
                        Efektif Dihentikan: {tanggal(ctr.termination.terminationDate)} · Penalti:{" "}
                        {formatContractCurrency(ctr.termination.penaltyAmount, ctr.currency)}
                      </Text>
                      <Text className="mt-1 text-xs">Alasan: {ctr.termination.reason}</Text>
                      {ctr.termination.remainingObligations ? (
                        <Text className="mt-1 text-xs text-muted-foreground">
                          Kewajiban Berjalan: {ctr.termination.remainingObligations}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}

                  {/* Pihak-Pihak Terlibat */}
                  <View className="rounded-xl border border-border/80 bg-card p-4">
                    <Text className="mb-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Pihak-Pihak yang Terlibat dalam Perjanjian
                    </Text>
                    <View className="gap-2">
                      {(ctr.parties ?? []).map((p, idx) => (
                        <View
                          key={p.id ?? idx}
                          className="flex-row flex-wrap items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
                        >
                          <View>
                            <Text className="text-xs font-bold">{p.name}</Text>
                            <Text className="text-[11px] text-muted-foreground">
                              {p.partyType} · {p.role || p.entityType}
                            </Text>
                          </View>
                          {p.picName || p.picPhone || p.picEmail ? (
                            <Text className="text-xs text-muted-foreground">
                              PIC: {[p.picName, p.picPhone, p.picEmail].filter(Boolean).join(" · ")}
                            </Text>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              ) : null}

              {/* TAB 2: SERVICES & SLA */}
              {tab === "services" ? (
                <View className="gap-4">
                  <View className="rounded-xl border border-border/80 bg-card p-4">
                    <Text className="mb-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Daftar Layanan & Lingkup Pekerjaan (Service Scope)
                    </Text>
                    {(ctr.services ?? []).length === 0 ? (
                      <EmptyRow text="Belum ada detail item layanan khusus pada kontrak ini" />
                    ) : (
                      <View className="gap-2.5">
                        {(ctr.services ?? []).map((s, i) => (
                          <View
                            key={s.id ?? i}
                            className="rounded-lg border border-border/70 bg-muted/20 p-3"
                          >
                            <View className="flex-row flex-wrap items-center justify-between gap-2">
                              <Text className="text-sm font-bold">{s.serviceName}</Text>
                              {s.serviceFee ? (
                                <Text className="text-xs font-semibold text-primary">
                                  {formatContractCurrency(s.serviceFee, ctr.currency)}
                                </Text>
                              ) : null}
                            </View>
                            {s.serviceScope ? (
                              <Text className="mt-1 text-xs text-muted-foreground">
                                Lingkup: {s.serviceScope}
                              </Text>
                            ) : null}
                            <View className="mt-1.5 flex-row flex-wrap gap-3">
                              {s.serviceLocation ? (
                                <Text className="text-[11px] text-muted-foreground">
                                  Lokasi: {s.serviceLocation}
                                </Text>
                              ) : null}
                              {s.servicePeriod ? (
                                <Text className="text-[11px] text-muted-foreground">
                                  Periode: {s.servicePeriod}
                                </Text>
                              ) : null}
                              {s.supportContact ? (
                                <Text className="text-[11px] text-muted-foreground">
                                  Support: {s.supportContact}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  <View className="rounded-xl border border-border/80 bg-card p-4">
                    <Text className="mb-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Target Service Level Agreement (SLA) & Klausul Penalti
                    </Text>
                    {(ctr.slas ?? []).length === 0 ? (
                      <EmptyRow text="Tidak ada target SLA khusus yang tercatat" />
                    ) : (
                      <View className="gap-2">
                        {(ctr.slas ?? []).map((sla, i) => (
                          <View
                            key={sla.id ?? i}
                            className="flex-row flex-wrap items-center justify-between rounded-lg border border-border/70 bg-muted/20 p-3"
                          >
                            <View className="flex-1 pr-3">
                              <Text className="text-xs font-bold">{sla.indicatorName}</Text>
                              {sla.penaltyDetails ? (
                                <Text className="mt-0.5 text-[11px] text-muted-foreground">
                                  Penalti: {sla.penaltyDetails}
                                </Text>
                              ) : null}
                            </View>
                            <View className="items-end">
                              <Text className="text-xs font-bold text-primary">
                                Target: {sla.targetMetric}
                              </Text>
                              <Text className="text-[11px] text-muted-foreground">
                                Jam Layanan: {sla.operationalHours || "8x5"}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              ) : null}

              {/* TAB 3: DOCUMENTS & VERSION CONTROL */}
              {tab === "documents" ? (
                <View className="gap-4">
                  {canUpdate ? (
                    <View className="gap-3 rounded-xl border border-border/80 bg-card p-4">
                      <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Unggah Dokumen Kontrak / Lampiran Baru
                      </Text>
                      <View className="flex-row flex-wrap gap-3">
                        <View className="min-w-[180px] flex-1">
                          <Text className="mb-1 text-[11px] text-muted-foreground">
                            Kategori Dokumen
                          </Text>
                          <SearchableSelect
                            value={
                              DOCUMENT_CATEGORY_OPTIONS.find((d) => d.value === docCategory)
                                ?.label ?? docCategory
                            }
                            options={DOCUMENT_CATEGORY_OPTIONS.map((d) => d.label)}
                            onChange={(label) => {
                              const found = DOCUMENT_CATEGORY_OPTIONS.find(
                                (d) => d.label === label,
                              );
                              if (found) setDocCategory(found.value);
                            }}
                            className="h-10 rounded-lg border-border/80 bg-card"
                          />
                        </View>
                        <View className="min-w-[200px] flex-[1.5]">
                          <Text className="mb-1 text-[11px] text-muted-foreground">
                            Judul Dokumen *
                          </Text>
                          <TextInput
                            value={docTitle}
                            onChangeText={setDocTitle}
                            placeholder="Mis. Perjanjian Induk / MoU / NDA / Berita Acara"
                            className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                          />
                        </View>
                        <View className="min-w-[160px] flex-1">
                          <Text className="mb-1 text-[11px] text-muted-foreground">
                            Tanggal Tanda Tangan
                          </Text>
                          <DatePicker value={docSignedDate} onChange={setDocSignedDate} />
                        </View>
                      </View>

                      <View className="flex-row flex-wrap items-center gap-3">
                        <View className="min-w-[200px] flex-1">
                          <TextInput
                            value={docSummary}
                            onChangeText={setDocSummary}
                            placeholder="Catatan versi / ringkasan dokumen..."
                            className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                          />
                        </View>
                        <TouchableOpacity
                          onPress={() => setDocConfidential(!docConfidential)}
                          className={`flex-row items-center gap-2 rounded-lg border px-3 py-2 ${
                            docConfidential
                              ? "border-warning/50 bg-warning/10"
                              : "border-border bg-background"
                          }`}
                        >
                          <View
                            className={`h-5 w-5 items-center justify-center rounded border ${
                              docConfidential
                                ? "border-warning bg-warning"
                                : "border-border bg-card"
                            }`}
                          >
                            {docConfidential ? <Check size={12} color="#fff" /> : null}
                          </View>
                          <Text className="text-xs font-semibold">Confidential</Text>
                        </TouchableOpacity>
                      </View>

                      <FileUploader
                        label="Pilih File Dokumen (PDF, DOCX, XLSX)"
                        kind="dokumen"
                        category="contract"
                        autoFlush
                        onUploaded={(fileId) => setDocFileUrl(`/api/upload/file/${fileId}`)}
                      />

                      {docFileUrl ? (
                        <Text className="text-xs font-semibold text-success">
                          ✓ File siap disimpan ({docFileUrl})
                        </Text>
                      ) : null}

                      <View className="flex-row justify-end">
                        <Button
                          size="sm"
                          className="gap-1.5"
                          onPress={addDocument}
                          disabled={savingDoc}
                        >
                          <Upload size={13} color="#fff" />
                          <Text className="text-xs text-white">
                            {savingDoc ? "Menyimpan..." : "Simpan Dokumen"}
                          </Text>
                        </Button>
                      </View>
                    </View>
                  ) : null}

                  {/* Daftar Dokumen & Riwayat Versi */}
                  {(ctr.documents ?? []).length === 0 ? (
                    <EmptyRow text="Belum ada dokumen kontrak yang diunggah" />
                  ) : (
                    <View className="gap-3">
                      {(ctr.documents ?? []).map((doc) => (
                        <View
                          key={doc.id}
                          className="gap-2.5 rounded-xl border border-border/80 bg-card p-4"
                        >
                          <View className="flex-row flex-wrap items-center justify-between gap-2">
                            <View className="flex-row items-center gap-2">
                              <FileText size={16} color={colors.primary} />
                              <View>
                                <View className="flex-row items-center gap-2">
                                  <Text className="text-sm font-bold">{doc.documentTitle}</Text>
                                  <View className="rounded bg-primary/15 px-2 py-0.5">
                                    <Text className="text-[10px] font-bold text-primary">
                                      v{doc.currentVersionNumber}
                                    </Text>
                                  </View>
                                  {doc.isConfidential ? (
                                    <View className="rounded bg-warning/20 px-2 py-0.5">
                                      <Text className="text-[10px] font-bold text-warning">
                                        CONFIDENTIAL
                                      </Text>
                                    </View>
                                  ) : null}
                                </View>
                                <Text className="text-xs text-muted-foreground">
                                  {DOCUMENT_CATEGORY_LABEL[doc.documentCategory] ??
                                    doc.documentCategory}{" "}
                                  {doc.signedDate ? `· TTD: ${tanggal(doc.signedDate)}` : ""}
                                </Text>
                              </View>
                            </View>

                            <View className="flex-row items-center gap-1.5">
                              {canUpdate ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1"
                                  onPress={() =>
                                    setRevisionDocId(revisionDocId === doc.id ? null : doc.id)
                                  }
                                >
                                  <Plus size={12} color={colors.primary} />
                                  <Text className="text-xs">
                                    Unggah Revisi (v{doc.currentVersionNumber + 1})
                                  </Text>
                                </Button>
                              ) : null}
                              {canDelete ? (
                                <TouchableOpacity
                                  onPress={() => deleteDocument(doc)}
                                  className="rounded-md border border-border p-2"
                                >
                                  <Trash2 size={13} color={colors.danger} />
                                </TouchableOpacity>
                              ) : null}
                            </View>
                          </View>

                          {/* Form Upload Revisi Baru tanpa menimpa versi lama (PRD 3.3 Rule 7) */}
                          {revisionDocId === doc.id ? (
                            <View className="gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
                              <Text className="text-xs font-bold text-primary">
                                Unggah Versi Revisi v{doc.currentVersionNumber + 1} (Versi
                                sebelumnya tetap tersimpan utuh)
                              </Text>
                              <TextInput
                                value={revisionSummary}
                                onChangeText={setRevisionSummary}
                                placeholder="Catatan revisi perubahan pada versi ini..."
                                className="h-9 rounded border border-border bg-background px-2.5 text-xs text-foreground"
                              />
                              <FileUploader
                                label="Pilih File Revisi Baru"
                                kind="dokumen"
                                category="contract"
                                autoFlush
                                onUploaded={(fileId) =>
                                  setRevisionFileUrl(`/api/upload/file/${fileId}`)
                                }
                              />
                              <View className="flex-row justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onPress={() => setRevisionDocId(null)}
                                >
                                  <Text className="text-xs">Batal</Text>
                                </Button>
                                <Button
                                  size="sm"
                                  onPress={() => addRevision(doc)}
                                  disabled={savingRevision}
                                >
                                  <Text className="text-xs text-white">
                                    {savingRevision
                                      ? "Menyimpan..."
                                      : `Simpan Versi v${doc.currentVersionNumber + 1}`}
                                  </Text>
                                </Button>
                              </View>
                            </View>
                          ) : null}

                          {/* Tabel Histori Versi Dokumen */}
                          <View className="gap-1.5 border-t border-border/60 pt-2">
                            {(doc.versions ?? []).map((ver) => (
                              <View
                                key={ver.id}
                                className="flex-row flex-wrap items-center justify-between rounded-lg bg-muted/30 px-3 py-2"
                              >
                                <View className="flex-1 pr-2">
                                  <View className="flex-row items-center gap-2">
                                    <Text className="font-mono text-xs font-bold">
                                      Versi v{ver.versionNumber}
                                    </Text>
                                    <Text className="text-xs font-medium">{ver.fileName}</Text>
                                    {ver.isLockedForApproval ? (
                                      <View className="flex-row items-center gap-1 rounded bg-success/15 px-1.5 py-0.5">
                                        <Lock size={10} color={colors.success} />
                                        <Text className="text-[10px] font-bold text-success">
                                          Versi Referensi Approval
                                        </Text>
                                      </View>
                                    ) : null}
                                  </View>
                                  <Text className="mt-0.5 text-[11px] text-muted-foreground">
                                    {ver.changeSummary || "Dokumen kontrak"} · Diunggah oleh{" "}
                                    {ver.uploadedByUser?.name || "Sistem"} ({tanggalJam(ver.createdAt)})
                                  </Text>
                                </View>

                                {ver.fileUrl ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 gap-1"
                                    onPress={() => openFileUrl(ver.fileUrl)}
                                  >
                                    <Download size={12} color={colors.primary} />
                                    <Text className="text-xs">Buka / Unduh</Text>
                                  </Button>
                                ) : (
                                  <Text className="text-xs text-warning">Akses Terbatas</Text>
                                )}
                              </View>
                            ))}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ) : null}

              {/* TAB 4: FINANCIAL & PAYMENT SCHEDULES */}
              {tab === "financial" ? (
                <View className="gap-4">
                  <View className="flex-row flex-wrap gap-3 rounded-xl border border-border/80 bg-card p-4">
                    <InfoLine
                      label="Jenis Nilai Kontrak"
                      value={ctr.financial?.valueType || "FIXED"}
                    />
                    <InfoLine
                      label="Nilai Dasar (DPP)"
                      value={formatContractCurrency(
                        ctr.financial?.baseAmount ?? ctr.contractValue,
                        ctr.currency,
                      )}
                    />
                    <InfoLine
                      label={`Pajak (${ctr.financial?.taxPercentage ?? 0}%)`}
                      value={formatContractCurrency(ctr.financial?.taxAmount ?? 0, ctr.currency)}
                    />
                    <InfoLine
                      label="Total Nilai Kontrak"
                      value={formatContractCurrency(
                        ctr.financial?.totalAmount ?? ctr.contractValue,
                        ctr.currency,
                      )}
                    />
                    <InfoLine
                      label="Down Payment (Uang Muka)"
                      value={formatContractCurrency(
                        ctr.financial?.downPaymentAmount ?? 0,
                        ctr.currency,
                      )}
                    />
                    <InfoLine
                      label="Retensi (Retention)"
                      value={formatContractCurrency(
                        ctr.financial?.retentionAmount ?? 0,
                        ctr.currency,
                      )}
                    />
                    <InfoLine
                      label="Cost Center"
                      value={ctr.financial?.costCenter || ctr.department}
                    />
                    <InfoLine
                      label="Referensi Proyek"
                      value={ctr.financial?.projectReference || "-"}
                    />
                  </View>

                  <View className="gap-3 rounded-xl border border-border/80 bg-card p-4">
                    <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Jadwal Pembayaran & Komitmen Finansial (PRD Bagian 6)
                    </Text>

                    {canUpdate ? (
                      <View className="flex-row flex-wrap items-end gap-2 rounded-lg border border-border/70 bg-muted/20 p-2.5">
                        <View className="min-w-[180px] flex-1">
                          <Text className="mb-1 text-[11px] text-muted-foreground">
                            Nama Termin / Milestone
                          </Text>
                          <TextInput
                            value={schedMilestone}
                            onChangeText={setSchedMilestone}
                            placeholder="Mis. Termin 1 (50%)"
                            className="h-9 rounded border border-border bg-background px-2.5 text-xs text-foreground"
                          />
                        </View>
                        <View className="w-[155px]">
                          <Text className="mb-1 text-[11px] text-muted-foreground">
                            Jatuh Tempo
                          </Text>
                          <DatePicker value={schedDueDate} onChange={setSchedDueDate} />
                        </View>
                        <View className="w-[150px]">
                          <Text className="mb-1 text-[11px] text-muted-foreground">
                            Nominal ({ctr.currency})
                          </Text>
                          <TextInput
                            value={formatThousands(schedAmount)}
                            onChangeText={(v) => setSchedAmount(v.replace(/\D/g, ""))}
                            keyboardType="numeric"
                            placeholder="0"
                            className="h-9 rounded border border-border bg-background px-2.5 text-xs text-foreground"
                          />
                        </View>
                        <Button
                          size="sm"
                          className="h-9 gap-1"
                          onPress={addSchedule}
                          disabled={savingSched}
                        >
                          <Plus size={13} color="#fff" />
                          <Text className="text-xs text-white">Tambah</Text>
                        </Button>
                      </View>
                    ) : null}

                    {(ctr.paymentSchedules ?? []).length === 0 ? (
                      <EmptyRow text="Belum ada jadwal termin pembayaran pada kontrak ini" />
                    ) : (
                      <View className="divide-y divide-border/50">
                        {(ctr.paymentSchedules ?? []).map((ps) => (
                          <View
                            key={ps.id ?? ps.scheduleNumber}
                            className="flex-row flex-wrap items-center justify-between gap-2 py-2.5"
                          >
                            <View className="flex-1">
                              <Text className="text-xs font-bold">
                                #{ps.scheduleNumber} · {ps.milestoneName}
                              </Text>
                              <Text className="text-[11px] text-muted-foreground">
                                Jatuh Tempo: {tanggal(ps.dueDate)}{" "}
                                {ps.paidDate ? `· Realisasi: ${tanggal(ps.paidDate)}` : ""}
                              </Text>
                            </View>
                            <View className="flex-row items-center gap-2">
                              <Text className="text-xs font-bold">
                                {formatContractCurrency(ps.totalAmount, ctr.currency)}
                              </Text>
                              <View className="rounded-full border border-border px-2 py-0.5">
                                <Text className="text-[10px] font-bold">{ps.paymentStatus}</Text>
                              </View>
                              {canUpdate && ps.id && ps.paymentStatus !== "PAID" ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2"
                                  onPress={() => updateScheduleStatus(ps.id!, "PAID")}
                                >
                                  <Text className="text-[10px]">Tandai Realisasi</Text>
                                </Button>
                              ) : null}
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              ) : null}

              {/* TAB 5: APPROVAL & RENEWAL HISTORY */}
              {tab === "approval" ? (
                <View className="gap-4">
                  <View className="rounded-xl border border-border/80 bg-card p-4">
                    <Text className="mb-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Riwayat Keputusan Approval Kontrak (PRD 5.2 - 5.3)
                    </Text>
                    {(ctr.approvals ?? []).length === 0 ? (
                      <EmptyRow text="Belum ada log pemeriksaan / approval" />
                    ) : (
                      <View className="gap-2">
                        {(ctr.approvals ?? []).map((app) => (
                          <View
                            key={app.id}
                            className="flex-row flex-wrap items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3"
                          >
                            <View className="flex-1 pr-2">
                              <View className="flex-row items-center gap-2">
                                <Text className="text-xs font-bold">{app.stage}</Text>
                                <ApprovalStatusBadge status={app.status} />
                              </View>
                              <Text className="mt-1 text-xs text-muted-foreground">
                                Oleh: {app.approverUser?.name || "Approver"} ·{" "}
                                {app.decisionTimestamp ? tanggalJam(app.decisionTimestamp) : "-"}
                              </Text>
                              {app.comments ? (
                                <Text className="mt-1 text-xs italic">&quot;{app.comments}&quot;</Text>
                              ) : null}
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  <View className="rounded-xl border border-border/80 bg-card p-4">
                    <Text className="mb-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Riwayat Perpanjangan Kontrak (Renewal History — PRD 3.5 & 15.4)
                    </Text>
                    {(ctr.renewals ?? []).length === 0 ? (
                      <EmptyRow text="Belum ada histori perpanjangan kontrak" />
                    ) : (
                      <View className="gap-2.5">
                        {(ctr.renewals ?? []).map((ren) => (
                          <View
                            key={ren.id}
                            className="flex-row flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/20 p-3"
                          >
                            <View className="flex-1 pr-2">
                              <View className="flex-row items-center gap-2">
                                <Text className="font-mono text-xs font-bold text-primary">
                                  {ren.renewalCode}
                                </Text>
                                <ApprovalStatusBadge status={ren.status} />
                              </View>
                              <Text className="mt-1 text-xs font-semibold">
                                Periode Baru: {tanggal(ren.proposedEffectiveDate)} s/d{" "}
                                {tanggal(ren.proposedExpirationDate)} · Nilai:{" "}
                                {formatContractCurrency(ren.proposedValue, ctr.currency)}
                              </Text>
                              <Text className="mt-0.5 text-xs text-muted-foreground">
                                Alasan: {ren.reason}
                              </Text>
                            </View>
                            {canUpdate && ren.status === "PENDING_REVIEW" ? (
                              <View className="flex-row gap-1.5">
                                <Button
                                  size="sm"
                                  className="h-8 gap-1"
                                  onPress={() => decideRenewalItem(ren.id, "APPROVED")}
                                >
                                  <CheckCircle2 size={12} color="#fff" />
                                  <Text className="text-xs text-white">Setujui Renewal</Text>
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-8"
                                  onPress={() => decideRenewalItem(ren.id, "REJECTED")}
                                >
                                  <Text className="text-xs text-white">Tolak</Text>
                                </Button>
                              </View>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              ) : null}

              {/* TAB 6: AMENDMENTS & ERP RELATIONS */}
              {tab === "amendments" ? (
                <View className="gap-4">
                  <View className="rounded-xl border border-border/80 bg-card p-4">
                    <Text className="mb-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Histori Addendum / Perubahan Kontrak
                    </Text>
                    {(ctr.amendments ?? []).length === 0 ? (
                      <EmptyRow text="Belum ada addendum kontrak yang tercatat" />
                    ) : (
                      <View className="gap-2">
                        {(ctr.amendments ?? []).map((amd) => (
                          <View
                            key={amd.id}
                            className="rounded-lg border border-border/70 bg-muted/20 p-3"
                          >
                            <View className="flex-row flex-wrap items-center justify-between">
                              <Text className="font-mono text-xs font-bold text-primary">
                                {amd.amendmentNumber}
                              </Text>
                              <Text className="text-xs text-muted-foreground">
                                {tanggal(amd.amendmentDate)}
                              </Text>
                            </View>
                            <Text className="mt-1 text-sm font-bold">{amd.title}</Text>
                            <Text className="mt-0.5 text-xs text-muted-foreground">
                              {amd.description}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  <View className="gap-3 rounded-xl border border-border/80 bg-card p-4">
                    <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Integrasi & Relasi Modul ERP (PRD Bagian 7)
                    </Text>

                    {canUpdate ? (
                      <View className="flex-row flex-wrap items-center gap-2">
                        <View className="w-[210px]">
                          <SearchableSelect
                            value={relModule}
                            options={[
                              "PURCHASE_ORDER",
                              "SALES_ORDER",
                              "PURCHASE_REQUEST",
                              "PROJECT",
                              "QUOTATION",
                              "INVOICE",
                              "WORK_ORDER",
                            ]}
                            onChange={(val) => {
                              setRelModule(val);
                              setRelEntityId(null);
                              setRelRefCode("");
                            }}
                            className="h-11 rounded-lg border-border/80 bg-card"
                          />
                        </View>
                        <View className="min-w-[260px] flex-1">
                          {relModule === "PURCHASE_ORDER" ? (
                            <SupplierPoSelect
                              value={relRefCode}
                              poId={relEntityId}
                              onChange={(po) => {
                                setRelEntityId(po ? Number(po.id) : null);
                                setRelRefCode(po ? String(po.nomor || po.number || `PO #${po.id}`) : "");
                              }}
                            />
                          ) : relModule === "SALES_ORDER" ? (
                            <PoClientSelect
                              value={relRefCode}
                              poId={relEntityId}
                              onChange={(so) => {
                                setRelEntityId(so ? Number(so.id) : null);
                                setRelRefCode(
                                  so ? String(so.soNumber || so.poClientNumber || so.nomor || `SO #${so.id}`) : "",
                                );
                              }}
                            />
                          ) : relModule === "PURCHASE_REQUEST" ? (
                            <PurchaseRequestSelect
                              value={relRefCode}
                              requestId={relEntityId}
                              onChange={(pr) => {
                                setRelEntityId(pr ? Number(pr.id) : null);
                                setRelRefCode(pr ? String(pr.nomor || pr.number || `PR #${pr.id}`) : "");
                              }}
                            />
                          ) : relModule === "PROJECT" ? (
                            <ProjectSelect
                              value={relRefCode}
                              projectId={relEntityId}
                              onChange={(p) => {
                                setRelEntityId(p ? Number(p.id) : null);
                                setRelRefCode(p ? String(p.nama || p.name || `PRJ #${p.id}`) : "");
                              }}
                            />
                          ) : relModule === "QUOTATION" ? (
                            <QuotationSelect
                              value={relRefCode}
                              quotationId={relEntityId}
                              onChange={(q) => {
                                setRelEntityId(q ? Number(q.id) : null);
                                setRelRefCode(q ? String(q.nomor || q.number || `PNW #${q.id}`) : "");
                              }}
                            />
                          ) : relModule === "INVOICE" ? (
                            <InvoiceSelect
                              value={relRefCode}
                              invoiceId={relEntityId}
                              onChange={(inv: any) => {
                                setRelEntityId(inv ? Number(inv.id) : null);
                                setRelRefCode(inv ? String(inv.nomor || inv.number || `INV #${inv.id}`) : "");
                              }}
                            />
                          ) : (
                            <MaintenanceSelect
                              value={relRefCode}
                              maintenanceId={relEntityId}
                              onChange={(m) => {
                                setRelEntityId(m ? Number(m.id) : null);
                                setRelRefCode(m ? String(m.nomor || m.number || `MNT #${m.id}`) : "");
                              }}
                            />
                          )}
                        </View>
                        <Button
                          size="sm"
                          className="h-11 gap-1"
                          onPress={addErpRelation}
                          disabled={savingRel || !relEntityId}
                        >
                          <Plus size={13} color="#fff" />
                          <Text className="text-xs text-white">Tautkan Modul</Text>
                        </Button>
                      </View>
                    ) : null}

                    {(ctr.relations ?? []).length === 0 ? (
                      <EmptyRow text="Belum ada modul ERP lain yang ditautkan" />
                    ) : (
                      <View className="gap-2">
                        {(ctr.relations ?? []).map((rel) => (
                          <View
                            key={rel.id}
                            className="flex-row items-center justify-between rounded-lg border border-border/70 bg-muted/20 px-3 py-2"
                          >
                            <View>
                              <Text className="text-xs font-bold">
                                [{rel.relatedModule}] {rel.referenceCode || `#${rel.relatedId}`}
                              </Text>
                              {rel.notes ? (
                                <Text className="text-[11px] text-muted-foreground">{rel.notes}</Text>
                              ) : null}
                            </View>
                            {canUpdate ? (
                              <TouchableOpacity
                                onPress={() => removeErpRelation(rel.id)}
                                className="rounded border border-border p-1.5"
                              >
                                <Trash2 size={12} color={colors.danger} />
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              ) : null}

              {/* TAB 7: AUDIT TRAIL */}
              {tab === "audit" ? (
                <View className="rounded-xl border border-border/80 bg-card p-4">
                  <Text className="mb-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Audit Trail Seluruh Aktivitas & Perubahan Kontrak (PRD 8.2 Rule 10)
                  </Text>
                  {(ctr.auditLogs ?? []).length === 0 ? (
                    <EmptyRow text="Belum ada log aktivitas" />
                  ) : (
                    <View className="divide-y divide-border/50">
                      {(ctr.auditLogs ?? []).map((log) => (
                        <View key={log.id} className="py-2.5">
                          <View className="flex-row flex-wrap items-center justify-between">
                            <Text className="font-mono text-xs font-bold text-primary">
                              {log.action}
                            </Text>
                            <Text className="text-[11px] text-muted-foreground">
                              { log.actorUser?.name || log.userName || "Sistem" } ·{" "}
                              {tanggalJam(log.createdAt)}
                            </Text>
                          </View>
                          {log.fieldChanged ? (
                            <Text className="mt-0.5 text-xs">
                              Field: {log.fieldChanged} ({log.oldValue || "-"} → {log.newValue || "-"})
                            </Text>
                          ) : log.newValue ? (
                            <Text className="mt-0.5 text-xs">{log.newValue}</Text>
                          ) : null}
                          {log.notes ? (
                            <Text className="mt-0.5 text-[11px] text-muted-foreground">
                              {log.notes}
                            </Text>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ) : null}
            </View>
          )}
        </ScrollView>
      </DialogContent>
    </Dialog>
  );
}
