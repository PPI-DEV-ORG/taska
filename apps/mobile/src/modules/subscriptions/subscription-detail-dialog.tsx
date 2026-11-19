import * as React from "react";
import { Alert, Linking, ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import {
  ArrowUpCircle,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Download,
  FileText,
  Pencil,
  PlayCircle,
  Plus,
  Receipt,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Upload,
  Wallet,
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
import { SearchableSelect } from "@/components/akuntra/dialogs";
import { FileUploader, type FileUploaderHandle } from "@/components/akuntra/file-uploader";
import { colors } from "@/tokens";
import { api, apiBase } from "@/services/api";
import { hasUserPermission } from "@/constants/modules";
import { useApp } from "@/store/app-store";
import { rupiah, tanggal } from "@/lib/format";
import type { SubSubscription } from "./types";
import {
  PAYMENT_LABEL,
  STATUS_LABEL,
  CHANGE_TYPE_LABEL,
  DOCUMENT_TYPE_OPTIONS,
  UTILIZATION_OPTIONS,
  cycleText,
  daysLabel,
  formatCurrency,
  formatFileSize,
  todayIso,
} from "./subscription-utils";
import {
  CycleBadge,
  EmptyRow,
  InfoLine,
  PaymentStatusBadge,
  SubscriptionStatusBadge,
  SubscriptionTabs,
} from "./subscription-ui";

type Props = {
  visible: boolean;
  subscriptionId: number | null;
  onClose: () => void;
  onRefresh: () => void;
  onEdit: (sub: SubSubscription) => void;
  onRenew: (sub: SubSubscription) => void;
  onUpgrade: (sub: SubSubscription) => void;
  onPayment: (sub: SubSubscription) => void;
  onCancellation: (sub: SubSubscription) => void;
  onUsage: (sub: SubSubscription) => void;
};

function DetailTable({
  headers,
  widths,
  rows,
  empty,
}: {
  headers: string[];
  widths: string[];
  rows: React.ReactNode[][];
  empty: string;
}) {
  return (
    <View className="overflow-hidden rounded-xl border border-border/80 bg-card">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: "100%" }}>
        <View className="min-w-[700px] flex-1">
          <View className="flex-row items-center border-b border-border/70 bg-muted/60 px-3 py-2">
            {headers.map((header, index) => (
              <Text
                key={`${header}-${index}`}
                className={`${widths[index] ?? "flex-1"} text-[11px] font-bold text-muted-foreground`}
              >
                {header}
              </Text>
            ))}
          </View>
          {rows.length === 0 ? (
            <EmptyRow text={empty} />
          ) : (
            <View className="divide-y divide-border/40">
              {rows.map((row, rowIndex) => (
                <View key={rowIndex} className="flex-row items-center px-3 py-2.5">
                  {row.map((cell, cellIndex) => (
                    <View key={cellIndex} className={`${widths[cellIndex] ?? "flex-1"} pr-2`}>
                      {React.isValidElement(cell) ? cell : <Text className="text-xs">{cell as any}</Text>}
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

export function SubscriptionDetailDialog(props: Props) {
  if (!props.visible || !props.subscriptionId) return null;
  return <DetailContent key={props.subscriptionId} {...props} subscriptionId={props.subscriptionId} />;
}

function DetailContent({
  subscriptionId,
  onClose,
  onRefresh,
  onEdit,
  onRenew,
  onUpgrade,
  onPayment,
  onCancellation,
  onUsage,
}: Props & { subscriptionId: number }) {
  const { toast, user } = useApp();
  const [sub, setSub] = React.useState<SubSubscription | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState("info");
  const [posting, setPosting] = React.useState(false);
  const [prepaidPeriod, setPrepaidPeriod] = React.useState("");
  const [docTitle, setDocTitle] = React.useState("");
  const [docType, setDocType] = React.useState("CONTRACT");
  const [docUrl, setDocUrl] = React.useState("");
  const [uploaderKey, setUploaderKey] = React.useState(0);
  const uploaderRef = React.useRef<FileUploaderHandle | null>(null);
  const [savingDoc, setSavingDoc] = React.useState(false);
  const [busyAction, setBusyAction] = React.useState("");

  const canApprove = hasUserPermission(user, "subscriptions", "V");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<SubSubscription>(`/subscriptions/${subscriptionId}`);
      setSub(data);
      const unposted = (data.prepaidSchedules ?? []).filter((row) => !row.isPosted);
      if (unposted.length > 0) {
        const first = unposted[0]!;
        setPrepaidPeriod(`${first.periodYear}-${String(first.periodMonth).padStart(2, "0")}`);
      }
    } catch (e: any) {
      toast(e?.message ?? "Gagal memuat detail langganan", "danger");
    } finally {
      setLoading(false);
    }
  }, [subscriptionId, toast]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  async function runAction(key: string, fn: () => Promise<any>, successMessage: string) {
    setBusyAction(key);
    try {
      await fn();
      toast(successMessage);
      await load();
      onRefresh();
    } catch (e: any) {
      toast(e?.message ?? "Aksi gagal", "danger");
    } finally {
      setBusyAction("");
    }
  }

  async function generatePrepaid() {
    if (!sub) return;
    await runAction(
      "prepaid-generate",
      () => api.post(`/subscriptions/${sub.id}/prepaid/generate`, { totalAmount: Number(sub.cost) }),
      "Jadwal amortisasi berhasil dibuat",
    );
  }

  async function postPrepaid() {
    if (!sub) return;
    const [year, month] = prepaidPeriod.split("-").map(Number);
    if (!year || !month) {
      toast("Pilih periode amortisasi terlebih dahulu", "danger");
      return;
    }
    const scheduleIds = unpostedSchedules
      .filter(
        (row) =>
          `${row.periodYear}-${String(row.periodMonth).padStart(2, "0")}` === prepaidPeriod,
      )
      .map((row) => row.id);
    await runAction(
      "prepaid-post",
      () =>
        api.post("/subscriptions/prepaid/post-monthly", {
          periodYear: year,
          periodMonth: month,
          scheduleIds,
        }),
      `Amortisasi ${prepaidPeriod} berhasil diposting`,
    );
  }

  async function generateBillingDraft() {
    if (!sub) return;
    await runAction(
      "billing-generate",
      () => api.post(`/subscriptions/${sub.id}/billing-drafts/generate`, {}),
      "Draft beban berulang berhasil dibuat",
    );
  }

  async function confirmBillingDraft(draftId: number) {
    await runAction(
      `billing-confirm-${draftId}`,
      () => api.post(`/subscriptions/billing-drafts/${draftId}/confirm`, { postJournal: true }),
      "Draft berhasil dikonfirmasi dan dijurnal",
    );
  }

  async function runReminders() {
    await runAction(
      "reminders",
      () => api.post("/subscriptions/reminders/run", {}),
      "Reminder renewal dijalankan",
    );
  }

  async function addDocument() {
    if (!sub) return;
    if (!docTitle.trim()) {
      toast("Judul dokumen wajib diisi", "danger");
      return;
    }
    setSavingDoc(true);
    try {
      let fileUrl = docUrl.trim();
      if (!fileUrl) {
        const fileId = await uploaderRef.current?.flush();
        if (!fileId) {
          toast("Pilih file atau isi URL dokumen", "danger");
          return;
        }
        fileUrl = `/files/${fileId}`;
      }
      await api.post(`/subscriptions/${sub.id}/documents`, {
        title: docTitle.trim(),
        documentType: docType,
        fileUrl,
      });
      toast("Dokumen berhasil ditambahkan");
      setDocTitle("");
      setDocUrl("");
      setUploaderKey((key) => key + 1);
      await load();
      onRefresh();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menambah dokumen", "danger");
    } finally {
      setSavingDoc(false);
    }
  }

  async function removeDocument(documentId: number) {
    if (!sub) return;
    Alert.alert("Hapus Dokumen", "Dokumen akan dihapus dari langganan ini.", [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/subscriptions/${sub.id}/documents/${documentId}`);
            toast("Dokumen dihapus");
            await load();
            onRefresh();
          } catch (e: any) {
            toast(e?.message ?? "Gagal menghapus dokumen", "danger");
          }
        },
      },
    ]);
  }

  async function decideCancellation(requestId: number, status: "APPROVED" | "REJECTED" | "EXECUTED") {
    if (!sub) return;
    const request = sub.cancellationRequests?.find((r) => r.id === requestId);
    if (!request) return;
    if (status === "EXECUTED") {
      const checks = [
        request.isDataBackupConfirmed,
        request.isServiceMigrationConfirmed,
        request.isDnsMigrationConfirmed,
        request.isDependencyCheckConfirmed,
        request.isHandoverConfirmed,
        request.isTerminationConfirmed,
      ];
      if (checks.some((value) => !value)) {
        toast("Semua checklist verifikasi wajib dikonfirmasi sebelum eksekusi", "danger");
        return;
      }
    }
    const label =
      status === "APPROVED" ? "Setujui" : status === "REJECTED" ? "Tolak" : "Eksekusi";
    Alert.alert(
      `${label} Pembatalan`,
      `Yakin ingin ${label.toLowerCase()} permintaan pembatalan ${request.cancellationCode}?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: label,
          style: status === "REJECTED" ? "destructive" : "default",
          onPress: async () => {
            try {
              await api.post(`/subscriptions/${sub.id}/cancellation/${requestId}/decision`, {
                status,
              });
              toast(`Pembatalan ${status.toLowerCase()}`);
              await load();
              onRefresh();
            } catch (e: any) {
              toast(e?.message ?? "Gagal memproses pembatalan", "danger");
            }
          },
        },
      ],
    );
  }

  if (loading || !sub) {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="w-full max-w-5xl">
          <DialogHeader>
            <DialogTitle>Detail Langganan</DialogTitle>
          </DialogHeader>
          <View className="items-center justify-center gap-2 py-10">
            <RefreshCw size={20} color={colors.primary} />
            <Text className="text-sm text-muted-foreground">Memuat detail langganan...</Text>
          </View>
        </DialogContent>
      </Dialog>
    );
  }

  const payments = sub.paymentRecords ?? [];
  const periodStart = sub.startDate ? String(sub.startDate).slice(0, 10) : null;
  const currentPeriod = periodStart ? periodStart.slice(0, 7) : null;
  const paidTotal = payments
    .filter((p) => !["CANCELLED", "REFUNDED"].includes(p.paymentStatus))
    .filter(
      (p) =>
        !periodStart ||
        String(p.paymentDate ?? "").slice(0, 10) >= periodStart ||
        (currentPeriod != null && p.billingPeriod === currentPeriod),
    )
    .reduce((sum, p) => sum + Number(p.amount) + Number(p.tax), 0);
  const totalCost = Number(sub.cost) + Number(sub.tax);
  const outstanding = Math.max(0, totalCost - paidTotal);
  const unpostedSchedules = (sub.prepaidSchedules ?? []).filter((row) => !row.isPosted);
  const periodOptions = Array.from(
    new Set(
      (sub.prepaidSchedules ?? []).map(
        (row) => `${row.periodYear}-${String(row.periodMonth).padStart(2, "0")}`,
      ),
    ),
  );
  const pendingCancellation = (sub.cancellationRequests ?? []).find((r) => r.status === "PENDING");
  const latestUsage = (sub.usageRecords ?? [])[0];
  const allChecks = pendingCancellation
    ? [
        pendingCancellation.isDataBackupConfirmed,
        pendingCancellation.isServiceMigrationConfirmed,
        pendingCancellation.isDnsMigrationConfirmed,
        pendingCancellation.isDependencyCheckConfirmed,
        pendingCancellation.isHandoverConfirmed,
        pendingCancellation.isTerminationConfirmed,
      ].every(Boolean)
    : false;

  const tabs = [
    { value: "info", label: "Informasi" },
    { value: "renewal", label: "Renewal", count: sub.renewalHistory?.length ?? 0 },
    { value: "billing", label: "Keuangan", count: payments.length },
    { value: "documents", label: "Dokumen", count: sub.documents?.length ?? 0 },
    { value: "usage", label: "Utilisasi", count: sub.usageRecords?.length ?? 0 },
    { value: "cancellation", label: "Pembatalan", count: sub.cancellationRequests?.length ?? 0 },
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-6xl max-h-[92vh]">
        <DialogHeader>
          <DialogTitle>Detail Langganan</DialogTitle>
        </DialogHeader>

        <View className="gap-3 rounded-xl border border-border/70 bg-muted/20 p-3">
          <View className="flex-row flex-wrap items-start justify-between gap-3">
            <View className="min-w-[240px] flex-1 gap-1">
              <Text className="text-lg font-bold">{sub.serviceName}</Text>
              <Text className="text-xs text-muted-foreground">
                {sub.subscriptionCode} · {sub.providerLabel ?? sub.providerName ?? "-"} · {sub.categoryName ?? sub.category?.name ?? "-"}
              </Text>
              <View className="mt-1 flex-row flex-wrap items-center gap-2">
                <SubscriptionStatusBadge status={sub.status} />
                <PaymentStatusBadge status={sub.paymentStatus} />
                <CycleBadge cycle={sub.billingCycle} />
                {sub.nextRenewalDate ? (
                  <View className="rounded-full border border-border bg-card px-2.5 py-0.5">
                    <Text className="text-[11px] font-medium text-muted-foreground">
                      Renewal {tanggal(sub.nextRenewalDate)} · {daysLabel(sub.daysToRenewal)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View className="flex-row flex-wrap items-center gap-1.5">
              <Button variant="outline" size="sm" className="gap-1.5" onPress={() => onEdit(sub)}>
                <Pencil size={13} color={colors.primary} />
                <Text className="text-[11px]">Edit</Text>
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onPress={() => onRenew(sub)}>
                <CalendarClock size={13} color={colors.primary} />
                <Text className="text-[11px]">Renewal</Text>
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onPress={() => onUpgrade(sub)}>
                <ArrowUpCircle size={13} color={colors.primary} />
                <Text className="text-[11px]">Upgrade</Text>
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onPress={() => onPayment(sub)}>
                <Wallet size={13} color={colors.primary} />
                <Text className="text-[11px]">Pembayaran</Text>
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onPress={() => onUsage(sub)}>
                <PlayCircle size={13} color={colors.primary} />
                <Text className="text-[11px]">Review</Text>
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onPress={() => onCancellation(sub)}>
                <ShieldAlert size={13} color={colors.danger} />
                <Text className="text-[11px]">Batalkan</Text>
              </Button>
            </View>
          </View>
        </View>

        {sub.status === "RENEWAL_PENDING" || (sub.renewalHistory ?? []).some((r) => r.approvalStatus === "PENDING") ? (
          <View className="mb-2 flex-row items-center justify-between rounded-xl border border-warning/50 bg-warning/10 p-3">
            <View className="flex-1 pr-2">
              <Text className="text-xs font-bold text-warning-foreground">
                ⚡ Perpanjangan Menunggu Persetujuan
              </Text>
              <Text className="text-[11px] text-muted-foreground">
                Langganan ini memiliki perpanjangan yang menunggu ditinjau dan disetujui untuk siklus berikutnya.
              </Text>
            </View>
            <Button size="sm" onPress={() => onRenew(sub)} className="gap-1.5">
              <CalendarClock size={13} color="#FFFFFF" />
              <Text className="text-xs font-semibold text-white">Tinjau & Setujui</Text>
            </Button>
          </View>
        ) : null}

        <SubscriptionTabs tabs={tabs} value={tab} onChange={setTab} />

        <ScrollView className="max-h-[62vh]" contentContainerStyle={{ paddingBottom: 10 }}>
          {tab === "info" ? (
            <View className="gap-3">
              <View className="flex-row flex-wrap gap-3 rounded-xl border border-border/80 bg-card p-3">
                <InfoLine label="Kategori" value={sub.categoryName ?? sub.category?.name ?? "-"} />
                <InfoLine label="Subkategori" value={sub.category?.subcategory ?? "-"} />
                <InfoLine label="Provider" value={sub.providerLabel ?? sub.providerName ?? "-"} />
                <InfoLine label="ID Akun" value={sub.accountIdentifier ?? "-"} />
                <InfoLine label="Paket" value={sub.subscriptionPlan ?? "-"} />
                <InfoLine label="Siklus" value={cycleText(sub.billingCycle)} />
                <InfoLine label="Mulai" value={tanggal(sub.startDate)} />
                <InfoLine label="Berakhir" value={sub.expirationDate ? tanggal(sub.expirationDate) : "-"} />
                <InfoLine label="Next Renewal" value={sub.nextRenewalDate ? tanggal(sub.nextRenewalDate) : "-"} />
                <InfoLine label="Auto-renewal" value={sub.autoRenewal ? "Ya (atribut provider)" : "Tidak"} />
                <InfoLine label="Biaya" value={formatCurrency(sub.cost, sub.currency)} />
                <InfoLine label="Pajak" value={formatCurrency(sub.tax, sub.currency)} />
                <InfoLine label="MRC" value={rupiah(sub.mrc)} />
                <InfoLine label="ARC" value={rupiah(sub.arc)} />
                <InfoLine label="PIC" value={sub.picUser?.name ?? "-"} />
                <InfoLine label="Departemen" value={sub.department || "-"} />
                <InfoLine label="Status Layanan" value={STATUS_LABEL[sub.status] ?? sub.status} />
                <InfoLine label="Status Bayar" value={PAYMENT_LABEL[sub.paymentStatus] ?? sub.paymentStatus} />
                <InfoLine label="Akun Beban" value={sub.expenseAccountCode || sub.category?.expenseAccountCode || "6122"} />
                <InfoLine label="Akun Prepaid" value={sub.prepaidAccountCode || sub.category?.prepaidAccountCode || "1401"} />
              </View>

              <View className="grid gap-3 sm:grid-cols-2">
                <View className="rounded-xl border border-border/80 bg-card p-3">
                  <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Tujuan Bisnis</Text>
                  <Text className="text-sm leading-5">{sub.businessPurpose || "-"}</Text>
                </View>
                <View className="rounded-xl border border-border/80 bg-card p-3">
                  <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Catatan</Text>
                  <Text className="text-sm leading-5">{sub.notes || "-"}</Text>
                  {sub.serviceUrl ? (
                    <TouchableOpacity
                      className="mt-2"
                      onPress={() => Linking.openURL(sub.serviceUrl!).catch(() => null)}
                    >
                      <Text className="text-xs font-semibold text-primary">{sub.serviceUrl}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              <View className="rounded-xl border border-border/80 bg-card p-3">
                <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Alokasi Biaya</Text>
                <DetailTable
                  headers={["Departemen", "Persentase", "Nilai Alokasi"]}
                  widths={["flex-1", "w-28", "w-36"]}
                  rows={(sub.allocations ?? []).map((row) => [
                    row.department,
                    `${Number(row.percentage).toFixed(2)}%`,
                    rupiah(row.allocatedAmount),
                  ])}
                  empty="Belum ada alokasi biaya"
                />
              </View>
            </View>
          ) : null}

          {tab === "renewal" ? (
            <View className="gap-3">
              <View className="flex-row flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-card p-3">
                <Button size="sm" className="gap-1.5" onPress={() => onRenew(sub)}>
                  <CalendarClock size={14} color="#fff" />
                  <Text className="text-xs">Buat Renewal Baru</Text>
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onPress={() => onUpgrade(sub)}>
                  <ArrowUpCircle size={14} color={colors.primary} />
                  <Text className="text-xs">Upgrade / Downgrade</Text>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onPress={runReminders}
                  disabled={busyAction === "reminders"}
                >
                  <RefreshCw size={14} color={colors.primary} />
                  <Text className="text-xs">{busyAction === "reminders" ? "Menjalankan..." : "Jalankan Reminder"}</Text>
                </Button>
              </View>

              <View className="rounded-xl border border-border/80 bg-card p-3">
                <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Riwayat Renewal</Text>
                <DetailTable
                  headers={["Kode", "Periode Lama", "Periode Baru", "Biaya Lama", "Biaya Baru", "Invoice", "Status"]}
                  widths={["w-28", "w-32", "w-32", "w-28", "w-28", "w-32", "w-24"]}
                  rows={(sub.renewalHistory ?? []).map((row) => [
                    row.renewalCode,
                    `${tanggal(row.previousPeriodStart)} - ${tanggal(row.previousPeriodEnd)}`,
                    `${tanggal(row.newPeriodStart)} - ${tanggal(row.newPeriodEnd)}`,
                    rupiah(row.previousCost),
                    rupiah(row.renewalCost),
                    row.invoiceNumber ?? "-",
                    row.approvalStatus === "PENDING"
                      ? "Menunggu Persetujuan"
                      : row.approvalStatus === "APPROVED"
                        ? "Disetujui"
                        : row.approvalStatus === "REJECTED"
                          ? "Ditolak"
                          : row.approvalStatus,
                  ])}
                  empty="Belum ada riwayat renewal. Data periode sebelumnya tidak akan ditimpa."
                />
              </View>

              <View className="rounded-xl border border-border/80 bg-card p-3">
                <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Riwayat Perubahan Harga</Text>
                <DetailTable
                  headers={["Jenis", "Paket Lama", "Paket Baru", "Harga Lama", "Harga Baru", "Efektif", "Alasan"]}
                  widths={["w-28", "w-32", "w-32", "w-28", "w-28", "w-28", "flex-1"]}
                  rows={(sub.priceHistory ?? []).map((row) => [
                    CHANGE_TYPE_LABEL[row.changeType] ?? row.changeType,
                    row.previousPlan ?? "-",
                    row.newPlan,
                    rupiah(row.previousCost),
                    rupiah(row.newCost),
                    tanggal(row.effectiveDate),
                    row.changeReason,
                  ])}
                  empty="Belum ada perubahan harga"
                />
              </View>

              <View className="rounded-xl border border-border/80 bg-card p-3">
                <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Log Reminder</Text>
                <DetailTable
                  headers={["Tipe", "Penerima", "Pesan", "Channel", "Dikirim"]}
                  widths={["w-20", "w-28", "flex-1", "w-24", "w-32"]}
                  rows={(sub.reminderLogs ?? []).map((row) => [
                    row.reminderType,
                    row.recipientUserId ? `User #${row.recipientUserId}` : "Finance",
                    row.message,
                    row.channel,
                    tanggal(row.sentAt),
                  ])}
                  empty="Belum ada reminder terkirim"
                />
              </View>
            </View>
          ) : null}

          {tab === "billing" ? (
            <View className="gap-3">
              <View className="flex-row flex-wrap items-center gap-2">
                <View className="min-w-[130px] flex-1 rounded-xl border border-border/80 bg-card px-3 py-2">
                  <Text className="text-[11px] text-muted-foreground">Total Biaya</Text>
                  <Text className="text-sm font-bold">{rupiah(totalCost)}</Text>
                </View>
                <View className="min-w-[130px] flex-1 rounded-xl border border-border/80 bg-card px-3 py-2">
                  <Text className="text-[11px] text-muted-foreground">Sudah Dibayar</Text>
                  <Text className="text-sm font-bold text-success">{rupiah(paidTotal)}</Text>
                </View>
                <View className="min-w-[130px] flex-1 rounded-xl border border-border/80 bg-card px-3 py-2">
                  <Text className="text-[11px] text-muted-foreground">Sisa</Text>
                  <Text className="text-sm font-bold text-danger">{rupiah(outstanding)}</Text>
                </View>
                <Button size="sm" className="gap-1.5" onPress={() => onPayment(sub)}>
                  <Plus size={14} color="#fff" />
                  <Text className="text-xs">Catat Pembayaran</Text>
                </Button>
              </View>

              <View className="rounded-xl border border-border/80 bg-card p-3">
                <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Riwayat Pembayaran</Text>
                <DetailTable
                  headers={["Invoice", "Tanggal", "Periode", "Nominal", "Pajak", "Status", "Jurnal"]}
                  widths={["w-32", "w-28", "w-24", "w-28", "w-24", "w-24", "w-20"]}
                  rows={payments.map((row) => [
                    row.invoiceNumber ?? "-",
                    row.paymentDate ? tanggal(row.paymentDate) : "-",
                    row.billingPeriod ?? "-",
                    rupiah(row.amount),
                    rupiah(row.tax),
                    PAYMENT_LABEL[row.paymentStatus] ?? row.paymentStatus,
                    row.financeJournalId ? `#${row.financeJournalId}` : "-",
                  ])}
                  empty="Belum ada pembayaran tercatat"
                />
              </View>

              <View className="rounded-xl border border-border/80 bg-card p-3">
                <View className="mb-2 flex-row flex-wrap items-center justify-between gap-2">
                  <View>
                    <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Prepaid Expense Schedule</Text>
                    <Text className="text-[11px] text-muted-foreground">
                      {unpostedSchedules.length} jadwal belum diposting · total {rupiah(unpostedSchedules.reduce((s, x) => s + Number(x.amount), 0))}
                    </Text>
                  </View>
                  <View className="flex-row flex-wrap items-center gap-1.5">
                    <Button variant="outline" size="sm" onPress={generatePrepaid} disabled={busyAction === "prepaid-generate"}>
                      <Text className="text-[11px]">{busyAction === "prepaid-generate" ? "Membuat..." : "Generate Jadwal"}</Text>
                    </Button>
                    <View className="w-36">
                      <SearchableSelect
                        value={prepaidPeriod}
                        options={periodOptions}
                        onChange={setPrepaidPeriod}
                        placeholder="Pilih periode"
                        className="h-8 rounded-lg border-border/80 bg-card"
                      />
                    </View>
                    <Button
                      size="sm"
                      onPress={postPrepaid}
                      disabled={!prepaidPeriod || busyAction === "prepaid-post"}
                    >
                      <Text className="text-[11px]">{busyAction === "prepaid-post" ? "Posting..." : "Posting Jurnal"}</Text>
                    </Button>
                  </View>
                </View>
                <DetailTable
                  headers={["Periode", "Tanggal Alokasi", "Nilai", "Status", "Jurnal"]}
                  widths={["w-28", "w-36", "w-28", "w-24", "w-28"]}
                  rows={(sub.prepaidSchedules ?? []).map((row) => [
                    `${row.periodYear}-${String(row.periodMonth).padStart(2, "0")}`,
                    tanggal(row.allocationDate),
                    rupiah(row.amount),
                    row.isPosted ? "Posted" : "Belum",
                    row.journalNumber ?? "-",
                  ])}
                  empty="Belum ada jadwal amortisasi"
                />
              </View>

              <View className="rounded-xl border border-border/80 bg-card p-3">
                <View className="mb-2 flex-row flex-wrap items-center justify-between gap-2">
                  <View>
                    <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Draft Beban Berulang</Text>
                    <Text className="text-[11px] text-muted-foreground">
                      Draft dapat dikonfirmasi menjadi jurnal Dr Beban/Prepaid · Cr Hutang (210102).
                    </Text>
                  </View>
                  <Button variant="outline" size="sm" onPress={generateBillingDraft} disabled={busyAction === "billing-generate"}>
                    <Text className="text-[11px]">{busyAction === "billing-generate" ? "Membuat..." : "Buat Draft"}</Text>
                  </Button>
                </View>
                <DetailTable
                  headers={["Periode", "Jatuh Tempo", "Nominal", "Status", "Aksi"]}
                  widths={["w-28", "w-32", "w-28", "w-24", "w-32"]}
                  rows={(sub.billingSchedules ?? []).map((row) => [
                    row.periodLabel ?? "-",
                    tanggal(row.dueDate),
                    rupiah(row.amount),
                    row.status,
                    row.status === "POSTED" ? (
                      <Text className="text-[11px] text-success">Sudah dijurnal</Text>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onPress={() => confirmBillingDraft(row.id)}
                        disabled={busyAction === `billing-confirm-${row.id}`}
                      >
                        <Text className="text-[10px]">{busyAction === `billing-confirm-${row.id}` ? "..." : "Konfirmasi"}</Text>
                      </Button>
                    ),
                  ])}
                  empty="Belum ada draft beban berulang"
                />
              </View>
            </View>
          ) : null}

          {tab === "documents" ? (
            <View className="gap-3">
              <View className="rounded-xl border border-border/80 bg-card p-3">
                <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Tambah Dokumen</Text>
                <View className="flex-row flex-wrap gap-2">
                  <TextInput
                    value={docTitle}
                    onChangeText={setDocTitle}
                    placeholder="Judul dokumen"
                    className="min-w-[200px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                  <View className="w-48">
                    <SearchableSelect
                      value={DOCUMENT_TYPE_OPTIONS.find((x) => x.value === docType)?.label ?? "Kontrak / Perjanjian"}
                      options={DOCUMENT_TYPE_OPTIONS.map((x) => x.label)}
                      onChange={(label) => {
                        const found = DOCUMENT_TYPE_OPTIONS.find((x) => x.label === label);
                        setDocType(found?.value ?? "CONTRACT");
                      }}
                      className="h-9 rounded-lg border-border/80 bg-card"
                    />
                  </View>
                  <TextInput
                    value={docUrl}
                    onChangeText={setDocUrl}
                    placeholder="Atau URL dokumen (opsional)"
                    autoCapitalize="none"
                    className="min-w-[200px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </View>
                {!docUrl.trim() ? (
                  <View className="mt-2">
                    <FileUploader
                      key={uploaderKey}
                      label="Pilih file dokumen (maks. 15 MB)"
                      kind="dokumen"
                      category="subscription"
                      handleRef={(handle) => {
                        uploaderRef.current = handle;
                      }}
                    />
                  </View>
                ) : null}
                <View className="mt-2 flex-row justify-end">
                  <Button size="sm" onPress={addDocument} disabled={savingDoc}>
                    <Text className="text-xs">{savingDoc ? "Menyimpan..." : "Tambah Dokumen"}</Text>
                  </Button>
                </View>
              </View>

              <View className="rounded-xl border border-border/80 bg-card p-3">
                <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Dokumen Tersimpan</Text>
                <DetailTable
                  headers={["Judul", "Jenis", "Ukuran", "Diunggah Oleh", "Tanggal", "Aksi"]}
                  widths={["flex-1", "w-28", "w-20", "w-28", "w-28", "w-24"]}
                  rows={(sub.documents ?? []).map((row) => [
                    <TouchableOpacity
                      key={`${row.id}-title`}
                      onPress={() => {
                        const url = row.fileUrl.startsWith("http") ? row.fileUrl : `${apiBase()}${row.fileUrl}`;
                        Linking.openURL(url).catch(() => null);
                      }}
                      className="flex-row items-center gap-1.5"
                    >
                      <FileText size={13} color={colors.primary} />
                      <Text className="text-xs font-semibold text-primary">{row.title}</Text>
                    </TouchableOpacity>,
                    row.documentType,
                    formatFileSize(row.fileSize),
                    row.uploadedByUser?.name ?? "-",
                    tanggal(row.createdAt),
                    <View key={`${row.id}-actions`} className="flex-row items-center gap-1">
                      <TouchableOpacity
                        onPress={() => {
                          const url = row.fileUrl.startsWith("http") ? row.fileUrl : `${apiBase()}${row.fileUrl}`;
                          Linking.openURL(url).catch(() => null);
                        }}
                        className="rounded-md p-1.5"
                      >
                        <Download size={13} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => removeDocument(row.id)} className="rounded-md p-1.5">
                        <Trash2 size={13} color={colors.danger} />
                      </TouchableOpacity>
                    </View>,
                  ])}
                  empty="Belum ada dokumen"
                />
              </View>
            </View>
          ) : null}

          {tab === "usage" ? (
            <View className="gap-3">
              <View className="flex-row flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-card p-3">
                <View>
                  <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Evaluasi Utilisasi</Text>
                  <Text className="text-[11px] text-muted-foreground">
                    Review berkala untuk mendeteksi layanan aktif tetapi tidak terpakai.
                  </Text>
                </View>
                <Button size="sm" className="gap-1.5" onPress={() => onUsage(sub)}>
                  <PlayCircle size={14} color="#fff" />
                  <Text className="text-xs">Review Utilisasi</Text>
                </Button>
              </View>
              {latestUsage ? (
                <View className="flex-row flex-wrap gap-3 rounded-xl border border-border/80 bg-card p-3">
                  <InfoLine label="Status" value={UTILIZATION_OPTIONS.find((x) => x.value === latestUsage.utilizationStatus)?.label ?? latestUsage.utilizationStatus} />
                  <InfoLine label="Jumlah User" value={latestUsage.usersCount ?? "-"} />
                  <InfoLine label="Jumlah Lisensi" value={latestUsage.licensesCount ?? "-"} />
                  <InfoLine label="Kapasitas" value={latestUsage.storageCapacity ?? "-"} />
                  <InfoLine label="Spesifikasi" value={latestUsage.serverSpecs ?? "-"} />
                  <InfoLine label="Terakhir Review" value={latestUsage.lastReviewedDate ? tanggal(latestUsage.lastReviewedDate) : "-"} />
                  <InfoLine label="Direview Oleh" value={latestUsage.reviewedByUser?.name ?? "-"} />
                </View>
              ) : (
                <View className="rounded-xl border border-border/80 bg-card p-4">
                  <Text className="text-sm text-muted-foreground">Belum ada review utilisasi untuk langganan ini.</Text>
                </View>
              )}
              <View className="rounded-xl border border-border/80 bg-card p-3">
                <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Riwayat Review</Text>
                <DetailTable
                  headers={["Tanggal", "Status", "User", "Lisensi", "Kapasitas", "Catatan"]}
                  widths={["w-28", "w-32", "w-20", "w-20", "w-28", "flex-1"]}
                  rows={(sub.usageRecords ?? []).map((row) => [
                    row.lastReviewedDate ? tanggal(row.lastReviewedDate) : tanggal(row.createdAt),
                    UTILIZATION_OPTIONS.find((x) => x.value === row.utilizationStatus)?.label ?? row.utilizationStatus,
                    row.usersCount ?? "-",
                    row.licensesCount ?? "-",
                    row.storageCapacity ?? "-",
                    row.evaluationNotes ?? "-",
                  ])}
                  empty="Belum ada riwayat review"
                />
              </View>
            </View>
          ) : null}

          {tab === "cancellation" ? (
            <View className="gap-3">
              <View className="flex-row flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-card p-3">
                <View>
                  <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Permintaan Pembatalan</Text>
                  <Text className="text-[11px] text-muted-foreground">
                    Eksekusi hanya boleh dilakukan setelah seluruh checklist verifikasi terpenuhi.
                  </Text>
                </View>
                {!pendingCancellation && sub.status !== "CANCELLED" ? (
                  <Button variant="outline" size="sm" className="gap-1.5" onPress={() => onCancellation(sub)}>
                    <ShieldAlert size={14} color={colors.danger} />
                    <Text className="text-xs">Ajukan Pembatalan</Text>
                  </Button>
                ) : null}
              </View>

              {pendingCancellation ? (
                <View className="gap-3 rounded-xl border border-warning/40 bg-warning/5 p-3">
                  <View className="flex-row flex-wrap items-start justify-between gap-2">
                    <View>
                      <Text className="text-sm font-bold">{pendingCancellation.cancellationCode}</Text>
                      <Text className="text-xs text-muted-foreground">
                        Diajukan oleh {pendingCancellation.requestedByUser?.name ?? `User #${pendingCancellation.requestedByUserId}`} · efektif {tanggal(pendingCancellation.effectiveCancellationDate)}
                      </Text>
                      <Text className="mt-1 text-xs">{pendingCancellation.reason}</Text>
                    </View>
                    {canApprove ? (
                      <View className="flex-row flex-wrap items-center gap-1.5">
                        <Button size="sm" variant="outline" onPress={() => decideCancellation(pendingCancellation.id, "REJECTED")}>
                          <Text className="text-[11px]">Tolak</Text>
                        </Button>
                        <Button size="sm" variant="outline" onPress={() => decideCancellation(pendingCancellation.id, "APPROVED")}>
                          <Text className="text-[11px]">Setujui</Text>
                        </Button>
                        <Button
                          size="sm"
                          onPress={() => decideCancellation(pendingCancellation.id, "EXECUTED")}
                          disabled={!allChecks}
                        >
                          <Text className="text-[11px]">Eksekusi</Text>
                        </Button>
                      </View>
                    ) : null}
                  </View>
                  <View className="flex-row flex-wrap gap-2">
                    {[
                      ["Backup data selesai", pendingCancellation.isDataBackupConfirmed],
                      ["Migrasi layanan selesai", pendingCancellation.isServiceMigrationConfirmed],
                      ["Migrasi DNS selesai", pendingCancellation.isDnsMigrationConfirmed],
                      ["Dependency check selesai", pendingCancellation.isDependencyCheckConfirmed],
                      ["Handover selesai", pendingCancellation.isHandoverConfirmed],
                      ["Konfirmasi terminasi", pendingCancellation.isTerminationConfirmed],
                    ].map(([label, done]) => (
                      <View
                        key={String(label)}
                        className={`flex-row items-center gap-1.5 rounded-lg border px-2.5 py-1.5 ${done ? "border-success/40 bg-success/10" : "border-border bg-card"}`}
                      >
                        {done ? (
                          <CheckCircle2 size={13} color={colors.success} />
                        ) : (
                          <CircleAlert size={13} color={colors.muted} />
                        )}
                        <Text className="text-[11px]">{String(label)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <View className="rounded-xl border border-border/80 bg-card p-3">
                <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Riwayat Pembatalan</Text>
                <DetailTable
                  headers={["Kode", "Alasan", "Efektif", "Status", "Diajukan", "Disetujui"]}
                  widths={["w-28", "flex-1", "w-28", "w-24", "w-28", "w-28"]}
                  rows={(sub.cancellationRequests ?? []).map((row) => [
                    row.cancellationCode,
                    row.reason,
                    tanggal(row.effectiveCancellationDate),
                    row.status,
                    tanggal(row.createdAt),
                    row.approvedAt ? tanggal(row.approvedAt) : "-",
                  ])}
                  empty="Belum ada permintaan pembatalan"
                />
              </View>
            </View>
          ) : null}
        </ScrollView>
      </DialogContent>
    </Dialog>
  );
}
