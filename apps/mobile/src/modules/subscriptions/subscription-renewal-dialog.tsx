import * as React from "react";
import { ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker, SearchableSelect } from "@/components/akuntra/dialogs";
import { FileUploader } from "@/components/akuntra/file-uploader";
import { FormField } from "@/components/akuntra/basics";
import { formatThousands, rupiah, tanggal } from "@/lib/format";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import type { SubSubscription } from "./types";
import {
  addDaysIso,
  addMonthsIso,
  cycleMonths,
  mrcFor,
  todayIso,
} from "./subscription-utils";

import { useSubscriptionAccounts } from "./use-subscription-accounts";

type Props = {
  visible: boolean;
  subscription: SubSubscription | null;
  onClose: () => void;
  onSuccess: () => void;
};

export function SubscriptionRenewalDialog(props: Props) {
  if (!props.visible || !props.subscription) return null;
  return <RenewalContent key={props.subscription.id} {...props} subscription={props.subscription} />;
}

function RenewalContent({ subscription, onClose, onSuccess }: Props & { subscription: SubSubscription }) {
  const { toast } = useApp();
  const { cashAccounts } = useSubscriptionAccounts();

  const cashOptions = React.useMemo(() => {
    return cashAccounts.map((c) => ({ code: c.code, label: c.label }));
  }, [cashAccounts]);

  const pendingRenewal = React.useMemo(() => {
    return (subscription.renewalHistory ?? []).find((r) => r.approvalStatus === "PENDING");
  }, [subscription]);

  const prevStart = subscription.startDate ? String(subscription.startDate).slice(0, 10) : todayIso();
  const prevEnd = subscription.expirationDate
    ? String(subscription.expirationDate).slice(0, 10)
    : addDaysIso(addMonthsIso(prevStart, cycleMonths(subscription.billingCycle)), -1);

  const defaultStart = pendingRenewal?.newPeriodStart
    ? String(pendingRenewal.newPeriodStart).slice(0, 10)
    : addDaysIso(prevEnd, 1);
  const defaultEnd = pendingRenewal?.newPeriodEnd
    ? String(pendingRenewal.newPeriodEnd).slice(0, 10)
    : addDaysIso(addMonthsIso(defaultStart, cycleMonths(subscription.billingCycle)), -1);

  const initialCost = pendingRenewal
    ? String(Math.round(Number(pendingRenewal.renewalCost) || 0))
    : String(Math.round(Number(subscription.cost) || 0));

  const [newStart, setNewStart] = React.useState(defaultStart);
  const [newEnd, setNewEnd] = React.useState(defaultEnd);
  const [cost, setCost] = React.useState(initialCost);
  const [tax, setTax] = React.useState(String(Math.round(Number(subscription.tax) || 0)));
  const [invoiceNumber, setInvoiceNumber] = React.useState(pendingRenewal?.invoiceNumber ?? "");
  const [notes, setNotes] = React.useState(pendingRenewal?.notes ?? "");
  const [approvalStatus, setApprovalStatus] = React.useState(
    pendingRenewal ? "APPROVED" : "APPROVED",
  );

  // Opsi pembayaran langsung dalam renewal
  const [paymentOption, setPaymentOption] = React.useState<"PAID_NOW" | "RECORD_AP" | "PAY_LATER">("PAID_NOW");
  const [paymentDate, setPaymentDate] = React.useState(todayIso());
  const [paymentDueDate, setPaymentDueDate] = React.useState(defaultEnd);
  const [fundingAccount, setFundingAccount] = React.useState("1000.02");
  const [proofUrl, setProofUrl] = React.useState("");
  const [invoiceFileUrl, setInvoiceFileUrl] = React.useState("");
  const [postJournal, setPostJournal] = React.useState(true);

  const [saving, setSaving] = React.useState(false);

  const costNumber = Number(cost.replace(/\D/g, "")) || 0;
  const taxNumber = Number(tax.replace(/\D/g, "")) || 0;
  const newMrc = mrcFor(costNumber, subscription.billingCycle, newStart, newEnd);
  const isPrepaid = String(subscription.billingCycle).toUpperCase() !== "MONTHLY";

  function handleStart(value: string) {
    setNewStart(value);
    const calculatedEnd = addDaysIso(addMonthsIso(value, cycleMonths(subscription.billingCycle)), -1);
    setNewEnd(calculatedEnd);
    setPaymentDueDate(calculatedEnd);
  }

  async function save() {
    if (!newStart || !newEnd) {
      toast("Periode baru wajib diisi", "danger");
      return;
    }
    if (newEnd < newStart) {
      toast("Tanggal akhir harus setelah tanggal mulai", "danger");
      return;
    }
    if (costNumber <= 0) {
      toast("Biaya renewal harus lebih dari 0", "danger");
      return;
    }

    if (approvalStatus === "APPROVED" && paymentOption === "PAID_NOW" && !proofUrl.trim()) {
      toast("Bukti pembayaran wajib diunggah untuk mencatat pembayaran lunas", "danger");
      return;
    }

    setSaving(true);
    try {
      await api.post(`/subscriptions/${subscription.id}/renew`, {
        newPeriodStart: newStart,
        newPeriodEnd: newEnd,
        renewalCost: costNumber,
        renewalTax: taxNumber,
        invoiceNumber: invoiceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        approvalStatus,
        paymentOption: approvalStatus === "APPROVED" ? paymentOption : "PAY_LATER",
        paymentDate: paymentOption === "PAID_NOW" ? paymentDate : undefined,
        paymentDueDate: paymentOption === "RECORD_AP" ? paymentDueDate : undefined,
        fundingType: paymentOption === "RECORD_AP" ? "AP" : "CASH",
        fundingAccountCode: paymentOption === "RECORD_AP" ? "210102" : fundingAccount,
        paymentProofUrl: paymentOption === "PAID_NOW" ? proofUrl.trim() || undefined : undefined,
        invoiceFileUrl: invoiceFileUrl.trim() || undefined,
        postJournal,
      });

      if (approvalStatus === "APPROVED" && paymentOption === "PAID_NOW") {
        toast("Renewal disetujui & pembayaran lunas berhasil dicatat");
      } else if (approvalStatus === "APPROVED" && paymentOption === "RECORD_AP") {
        toast("Renewal disetujui & dicatat sebagai hutang (AP)");
      } else if (approvalStatus === "APPROVED") {
        toast("Renewal disetujui. Tagihan dicatat Belum Dibayar (UNPAID)");
      } else {
        toast("Draf renewal berhasil disimpan (Menunggu Persetujuan)");
      }

      onSuccess();
      onClose();
    } catch (e: any) {
      toast(e?.message ?? "Gagal memproses renewal", "danger");
    } finally {
      setSaving(false);
    }
  }

  async function reject() {
    setSaving(true);
    try {
      await api.post(`/subscriptions/${subscription.id}/reject-renewal`, {
        reason: "Ditolak oleh pengguna",
      });
      toast("Perpanjangan berhasil ditolak");
      onSuccess();
      onClose();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menolak perpanjangan", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-3xl max-h-[92vh]">
        <DialogHeader>
          <DialogTitle>Renewal Langganan · {subscription.subscriptionCode}</DialogTitle>
        </DialogHeader>
        <ScrollView className="max-h-[74vh]" contentContainerStyle={{ paddingBottom: 16 }}>
          <View className="gap-3">
            {pendingRenewal ? (
              <View className="rounded-xl border border-warning/40 bg-warning/10 p-3">
                <Text className="text-xs font-bold text-warning-foreground">
                  ⚡ Ada Perpanjangan Otomatis yang Menunggu Persetujuan ({pendingRenewal.renewalCode})
                </Text>
                <Text className="mt-1 text-xs text-muted-foreground">
                  Draf perpanjangan telah dibuat otomatis oleh sistem. Anda dapat menyesuaikan periode, biaya, dan memilih metode pembayaran sebelum menyetujuinya.
                </Text>
              </View>
            ) : null}

            <View className="rounded-xl border border-border/80 bg-muted/20 p-3">
              <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Periode Saat Ini
              </Text>
              <Text className="text-sm font-semibold">
                {tanggal(prevStart)} s/d {tanggal(prevEnd)} · {rupiah(subscription.cost)}
              </Text>
              <Text className="mt-1 text-[11px] text-muted-foreground">
                Data periode sebelumnya akan disimpan sebagai riwayat dan tidak ditimpa.
              </Text>
            </View>

            <View className="flex-row flex-wrap gap-3">
              <View className="min-w-[180px] flex-1">
                <FormField label="Periode Baru Mulai" required>
                  <DatePicker value={newStart} onChange={handleStart} />
                </FormField>
              </View>
              <View className="min-w-[180px] flex-1">
                <FormField label="Periode Baru Berakhir" required>
                  <DatePicker value={newEnd} onChange={(val) => { setNewEnd(val); setPaymentDueDate(val); }} />
                </FormField>
              </View>
              <View className="min-w-[170px] flex-1">
                <FormField label="Status Approval">
                  <SearchableSelect
                    value={approvalStatus === "PENDING" ? "Menunggu Persetujuan" : "Disetujui"}
                    options={["Disetujui", "Menunggu Persetujuan"]}
                    onChange={(value) => setApprovalStatus(value === "Disetujui" ? "APPROVED" : "PENDING")}
                    className="h-11 rounded-lg border-border/80 bg-card"
                  />
                </FormField>
              </View>
            </View>

            <View className="flex-row flex-wrap gap-3">
              <View className="min-w-[180px] flex-1">
                <FormField label="Biaya Renewal" required>
                  <TextInput
                    value={formatThousands(cost)}
                    onChangeText={(value) => setCost(value.replace(/\D/g, ""))}
                    keyboardType="numeric"
                    className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                  />
                </FormField>
              </View>
              <View className="min-w-[160px] flex-1">
                <FormField label="Pajak">
                  <TextInput
                    value={formatThousands(tax)}
                    onChangeText={(value) => setTax(value.replace(/\D/g, ""))}
                    keyboardType="numeric"
                    className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                  />
                </FormField>
              </View>
              <View className="min-w-[180px] flex-1">
                <FormField label="MRC Baru">
                  <View className="h-11 justify-center rounded-lg border border-border bg-muted/30 px-3">
                    <Text className="text-sm font-semibold text-primary">{rupiah(newMrc)} / bulan</Text>
                  </View>
                </FormField>
              </View>
            </View>

            <View className="flex-row flex-wrap gap-3">
              <View className="min-w-[200px] flex-1">
                <FormField label="No. Invoice / Tagihan">
                  <TextInput
                    value={invoiceNumber}
                    onChangeText={setInvoiceNumber}
                    placeholder="INV-..."
                    className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                  />
                </FormField>
              </View>
              <View className="min-w-[240px] flex-1">
                <FormField label="Catatan">
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Catatan renewal, negosiasi harga, dll."
                    className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                  />
                </FormField>
              </View>
            </View>

            {/* SEKSI INTEGRASI PEMBAYARAN */}
            {approvalStatus === "APPROVED" ? (
              <View className="mt-2 rounded-xl border border-border/90 bg-muted/10 p-3.5 gap-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-bold uppercase tracking-wide text-foreground">
                    💳 Pembayaran Tagihan Renewal
                  </Text>
                  <Text className="text-xs font-bold text-primary">
                    Total: {rupiah(costNumber + taxNumber)}
                  </Text>
                </View>

                {/* PILIHAN METODE */}
                <View className="flex-row flex-wrap gap-2">
                  <TouchableOpacity
                    onPress={() => setPaymentOption("PAID_NOW")}
                    className={`flex-1 min-w-[130px] rounded-lg border px-3 py-2 items-center justify-center ${
                      paymentOption === "PAID_NOW"
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card"
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        paymentOption === "PAID_NOW" ? "text-primary font-bold" : "text-foreground"
                      }`}
                    >
                      Bayar Sekarang (Lunas)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setPaymentOption("RECORD_AP")}
                    className={`flex-1 min-w-[130px] rounded-lg border px-3 py-2 items-center justify-center ${
                      paymentOption === "RECORD_AP"
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card"
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        paymentOption === "RECORD_AP" ? "text-primary font-bold" : "text-foreground"
                      }`}
                    >
                      Catat Hutang (AP)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setPaymentOption("PAY_LATER")}
                    className={`flex-1 min-w-[130px] rounded-lg border px-3 py-2 items-center justify-center ${
                      paymentOption === "PAY_LATER"
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card"
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        paymentOption === "PAY_LATER" ? "text-primary font-bold" : "text-foreground"
                      }`}
                    >
                      Bayar Nanti (Unpaid)
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* FORM DETAIL PEMBAYARAN BERDASARKAN OPSI */}
                {paymentOption === "PAID_NOW" ? (
                  <View className="gap-3 pt-1">
                    <View className="flex-row flex-wrap gap-3">
                      <View className="min-w-[180px] flex-1">
                        <FormField label="Tanggal Pembayaran" required>
                          <DatePicker value={paymentDate} onChange={setPaymentDate} />
                        </FormField>
                      </View>
                      <View className="min-w-[220px] flex-1">
                        <FormField label="Akun Sumber Dana (Kas / Bank)" required>
                          <SearchableSelect
                            value={cashOptions.find((a) => a.code === fundingAccount)?.label ?? fundingAccount}
                            options={cashOptions.map((a) => a.label)}
                            onChange={(label) => {
                              const found = cashOptions.find((a) => a.label === label);
                              if (found) setFundingAccount(found.code);
                            }}
                            className="h-11 rounded-lg border-border/80 bg-card"
                          />
                        </FormField>
                      </View>
                    </View>

                    <FormField label="Upload Bukti Pembayaran *" required>
                      <FileUploader
                        label="Pilih Foto / Dokumen Bukti Bayar (Wajib)"
                        kind="semua"
                        category="subscription"
                        autoFlush
                        onUploaded={(fileId) => setProofUrl(`/api/upload/file/${fileId}`)}
                      />
                      {proofUrl ? (
                        <Text className="mt-1 text-[11px] font-medium text-success">
                          ✓ Bukti bayar terlampir
                        </Text>
                      ) : null}
                    </FormField>
                  </View>
                ) : null}

                {paymentOption === "RECORD_AP" ? (
                  <View className="gap-3 pt-1">
                    <View className="flex-row flex-wrap gap-3">
                      <View className="min-w-[180px] flex-1">
                        <FormField label="Tanggal Jatuh Tempo" required>
                          <DatePicker value={paymentDueDate} onChange={setPaymentDueDate} />
                        </FormField>
                      </View>
                      <View className="min-w-[220px] flex-1">
                        <FormField label="Akun Hutang">
                          <View className="h-11 justify-center rounded-lg border border-border bg-muted/30 px-3">
                            <Text className="text-xs font-medium">210102 - Account Payable (Hutang Usaha)</Text>
                          </View>
                        </FormField>
                      </View>
                    </View>
                  </View>
                ) : null}

                {paymentOption === "PAY_LATER" ? (
                  <View className="rounded-lg border border-dashed border-border/90 bg-background/50 p-3">
                    <Text className="text-xs text-muted-foreground">
                      Tagihan renewal akan dicatat dengan status <Text className="font-bold text-danger">Belum Dibayar (UNPAID)</Text>. Anda dapat mencatat pelunasan kapan saja melalui tombol &quot;Catat Pembayaran&quot; di daftar langganan.
                    </Text>
                  </View>
                ) : null}

                {paymentOption !== "PAY_LATER" ? (
                  <View className="gap-3">
                    <FormField label="Upload File Invoice / Tagihan Supplier (Opsional)">
                      <FileUploader
                        label="Pilih File PDF / Foto Invoice Tagihan (Opsional)"
                        kind="semua"
                        category="subscription"
                        autoFlush
                        onUploaded={(fileId) => setInvoiceFileUrl(`/api/upload/file/${fileId}`)}
                      />
                      {invoiceFileUrl ? (
                        <Text className="mt-1 text-[11px] font-medium text-success">
                          ✓ File invoice terlampir
                        </Text>
                      ) : null}
                    </FormField>

                    <TouchableOpacity
                      onPress={() => setPostJournal((val) => !val)}
                      className="flex-row items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5"
                    >
                      <View
                        className={`h-5 w-5 items-center justify-center rounded border ${
                          postJournal ? "border-primary bg-primary" : "border-border bg-background"
                        }`}
                      >
                        {postJournal ? <Text className="text-[11px] font-bold text-white">✓</Text> : null}
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs font-semibold">
                          Buat Invoice Masuk & Posting Jurnal COA
                        </Text>
                        <Text className="text-[11px] text-muted-foreground">
                          {isPrepaid
                            ? `Otomatis buat Invoice Masuk: Dr Beban Dibayar Dimuka · Cr ${paymentOption === "RECORD_AP" ? "Hutang Usaha (210102)" : fundingAccount}`
                            : `Otomatis buat Invoice Masuk: Dr Biaya Operasional · Cr ${paymentOption === "RECORD_AP" ? "Hutang Usaha (210102)" : fundingAccount}`}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ) : null}

            <View className="rounded-xl border border-border/80 bg-card p-3">
              <Text className="text-[11px] text-muted-foreground">
                Perbandingan biaya: lama {rupiah(subscription.cost)} → baru {rupiah(costNumber)} (
                {costNumber >= Number(subscription.cost) ? "+" : ""}
                {rupiah(costNumber - Number(subscription.cost))})
              </Text>
            </View>
          </View>
        </ScrollView>
        <DialogFooter className="flex-row justify-between items-center gap-2">
          <View>
            {pendingRenewal ? (
              <Button variant="outline" size="sm" onPress={reject} disabled={saving} className="border-danger/40">
                <Text className="text-xs text-danger font-medium">Tolak Renewal</Text>
              </Button>
            ) : null}
          </View>
          <View className="flex-row gap-2">
            <Button variant="outline" size="sm" onPress={onClose} disabled={saving}>
              <Text className="text-xs">Batal</Text>
            </Button>
            <Button size="sm" onPress={save} disabled={saving}>
              <Text className="text-xs">{saving ? "Menyimpan..." : "Simpan Renewal"}</Text>
            </Button>
          </View>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
