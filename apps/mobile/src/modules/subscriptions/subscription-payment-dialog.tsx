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
import { DatePicker, SearchableSelect } from "@/components/taska/dialogs";
import { FileUploader } from "@/components/taska/file-uploader";
import { FormField } from "@/components/taska/basics";
import { formatThousands, rupiah } from "@/lib/format";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import type { SubSubscription } from "./types";
import { todayIso } from "./subscription-utils";

type Props = {
  visible: boolean;
  subscription: SubSubscription | null;
  onClose: () => void;
  onSuccess: () => void;
};

export function SubscriptionPaymentDialog(props: Props) {
  if (!props.visible || !props.subscription) return null;
  return <PaymentContent key={props.subscription.id} {...props} subscription={props.subscription} />;
}

const PAYMENT_ACCOUNT_OPTIONS = [
  { code: "1000.02", label: "1000.02 - Bank Mandiri PT GMP", type: "CASH" },
  { code: "1000.01", label: "1000.01 - Kas Operasional", type: "CASH" },
  { code: "1000.03", label: "1000.03 - Kas Kecil (Petty Cash)", type: "CASH" },
  { code: "210102", label: "210102 - Account Payable (Hutang Usaha)", type: "AP" },
];

function PaymentContent({ subscription, onClose, onSuccess }: Props & { subscription: SubSubscription }) {
  const { toast } = useApp();
  const periodStart = subscription.startDate
    ? String(subscription.startDate).slice(0, 10)
    : null;
  const currentPeriod = periodStart ? periodStart.slice(0, 7) : null;
  const payments = (subscription.paymentRecords ?? []).filter(
    (p) =>
      !periodStart ||
      String(p.paymentDate ?? "").slice(0, 10) >= periodStart ||
      (currentPeriod != null && p.billingPeriod === currentPeriod),
  );
  const paidAmount = payments
    .filter((p) => !["CANCELLED", "REFUNDED"].includes(p.paymentStatus))
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const paidTax = payments
    .filter((p) => !["CANCELLED", "REFUNDED"].includes(p.paymentStatus))
    .reduce((sum, p) => sum + Number(p.tax), 0);
  const dueAmount = Math.max(0, Number(subscription.cost) - paidAmount);
  const dueTax = Math.max(0, Number(subscription.tax) - paidTax);
  const [amount, setAmount] = React.useState(String(Math.round(dueAmount || Number(subscription.cost) || 0)));
  const [tax, setTax] = React.useState(String(Math.round(dueTax || Number(subscription.tax) || 0)));
  const [invoiceNumber, setInvoiceNumber] = React.useState("");
  const [invoiceDate, setInvoiceDate] = React.useState(todayIso());
  const [dueDate, setDueDate] = React.useState(
    subscription.expirationDate ? String(subscription.expirationDate).slice(0, 10) : todayIso(),
  );
  const [paymentDate, setPaymentDate] = React.useState(todayIso());
  const [billingPeriod, setBillingPeriod] = React.useState(() => {
    if (subscription.startDate) return String(subscription.startDate).slice(0, 7);
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [notes, setNotes] = React.useState("");
  const [invoiceFileUrl, setInvoiceFileUrl] = React.useState("");
  const [proofUrl, setProofUrl] = React.useState("");
  const [postJournal, setPostJournal] = React.useState(true);
  const [fundingType, setFundingType] = React.useState("CASH");
  const [fundingAccount, setFundingAccount] = React.useState("1000.02");
  const [saving, setSaving] = React.useState(false);

  const amountNumber = Number(amount.replace(/\D/g, "")) || 0;
  const taxNumber = Number(tax.replace(/\D/g, "")) || 0;
  const isPrepaid = String(subscription.billingCycle).toUpperCase() !== "MONTHLY";
  const total = amountNumber + taxNumber;

  async function save() {
    if (amountNumber <= 0) {
      toast("Nominal pembayaran harus lebih dari 0", "danger");
      return;
    }
    if (fundingType !== "AP" && !proofUrl.trim()) {
      toast("Bukti pembayaran wajib diunggah untuk mencatat pembayaran lunas", "danger");
      return;
    }
    setSaving(true);
    const effectiveInvoiceNumber =
      invoiceNumber.trim() ||
      `INV/${subscription.subscriptionCode}/${billingPeriod.replace("-", "")}`;
    try {
      await api.post(`/subscriptions/${subscription.id}/payments`, {
        invoiceNumber: effectiveInvoiceNumber,
        invoiceDate,
        dueDate,
        paymentDate,
        billingPeriod,
        amount: amountNumber,
        tax: taxNumber,
        currency: subscription.currency || "IDR",
        paymentStatus: fundingType === "AP" ? "UNPAID" : "PAID",
        invoiceFileUrl: invoiceFileUrl.trim() || undefined,
        paymentProofUrl: proofUrl.trim() || undefined,
        notes: notes.trim() || undefined,
        postJournal,
        fundingType,
        fundingAccountCode: fundingAccount.trim() || undefined,
        prepaid: isPrepaid,
      });
      toast("Invoice Masuk berhasil dibuat & pembayaran tercatat ke COA");
      onSuccess();
      onClose();
    } catch (e: any) {
      toast(e?.message ?? "Gagal mencatat pembayaran", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-3xl max-h-[92vh]">
        <DialogHeader>
          <DialogTitle>Catat Pembayaran · {subscription.subscriptionCode}</DialogTitle>
        </DialogHeader>
        <ScrollView className="max-h-[74vh]" contentContainerStyle={{ paddingBottom: 8 }}>
          <View className="gap-3">
            <View className="flex-row flex-wrap gap-2">
              <View className="min-w-[140px] flex-1 rounded-xl border border-border/80 bg-card px-3 py-2">
                <Text className="text-[11px] text-muted-foreground">Total Tagihan</Text>
                <Text className="text-sm font-bold">{rupiah(Number(subscription.cost) + Number(subscription.tax))}</Text>
              </View>
              <View className="min-w-[140px] flex-1 rounded-xl border border-border/80 bg-card px-3 py-2">
                <Text className="text-[11px] text-muted-foreground">Sudah Dibayar</Text>
                <Text className="text-sm font-bold text-success">{rupiah(paidAmount + paidTax)}</Text>
              </View>
              <View className="min-w-[140px] flex-1 rounded-xl border border-border/80 bg-card px-3 py-2">
                <Text className="text-[11px] text-muted-foreground">Sisa</Text>
                <Text className="text-sm font-bold text-danger">{rupiah(dueAmount + dueTax)}</Text>
              </View>
            </View>

            <View className="flex-row flex-wrap gap-3">
              <View className="min-w-[170px] flex-1">
                <FormField label="Nominal (DPP)" required>
                  <TextInput
                    value={formatThousands(amount)}
                    onChangeText={(value) => setAmount(value.replace(/\D/g, ""))}
                    keyboardType="numeric"
                    className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                  />
                </FormField>
              </View>
              <View className="min-w-[150px] flex-1">
                <FormField label="Pajak / PPN">
                  <TextInput
                    value={formatThousands(tax)}
                    onChangeText={(value) => setTax(value.replace(/\D/g, ""))}
                    keyboardType="numeric"
                    className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                  />
                </FormField>
              </View>
              <View className="min-w-[160px] flex-1">
                <FormField label="Total Bayar">
                  <View className="h-11 justify-center rounded-lg border border-border bg-muted/30 px-3">
                    <Text className="text-sm font-bold text-primary">{rupiah(total)}</Text>
                  </View>
                </FormField>
              </View>
            </View>

            <View className="flex-row flex-wrap gap-3">
              <View className="min-w-[180px] flex-1">
                <FormField label="No. Invoice">
                  <TextInput
                    value={invoiceNumber}
                    onChangeText={setInvoiceNumber}
                    placeholder="INV-..."
                    className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                  />
                </FormField>
              </View>
              <View className="min-w-[160px] flex-1">
                <FormField label="Tanggal Invoice">
                  <DatePicker value={invoiceDate} onChange={setInvoiceDate} />
                </FormField>
              </View>
              <View className="min-w-[160px] flex-1">
                <FormField label="Jatuh Tempo">
                  <DatePicker value={dueDate} onChange={setDueDate} />
                </FormField>
              </View>
            </View>

            <View className="flex-row flex-wrap gap-3">
              <View className="min-w-[160px] flex-1">
                <FormField label="Tanggal Bayar">
                  <DatePicker value={paymentDate} onChange={setPaymentDate} />
                </FormField>
              </View>
              <View className="min-w-[160px] flex-1">
                <FormField label="Periode Tagihan">
                  <TextInput
                    value={billingPeriod}
                    onChangeText={setBillingPeriod}
                    placeholder="2026-11"
                    className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                  />
                </FormField>
              </View>
              <View className="min-w-[240px] flex-1">
                <FormField label="Akun Kas / Bank / Hutang">
                  <SearchableSelect
                    value={
                      PAYMENT_ACCOUNT_OPTIONS.find((a) => a.code === fundingAccount)?.label ??
                      fundingAccount
                    }
                    options={PAYMENT_ACCOUNT_OPTIONS.map((a) => a.label)}
                    onChange={(label) => {
                      const found = PAYMENT_ACCOUNT_OPTIONS.find((a) => a.label === label);
                      if (found) {
                        setFundingAccount(found.code);
                        setFundingType(found.type);
                      }
                    }}
                    className="h-11 rounded-lg border-border/80 bg-card"
                  />
                </FormField>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setPostJournal((value) => !value)}
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
                  Buat Invoice Masuk (Invoice In) & Posting Jurnal COA dari Invoice
                </Text>
                <Text className="text-[11px] text-muted-foreground">
                  {isPrepaid
                    ? `Invoice Masuk: Dr Prepaid ${subscription.prepaidAccountCode || "1401"} · Dr PPN Masukan 1600 · Cr ${fundingAccount}`
                    : `Invoice Masuk: Dr Beban ${subscription.expenseAccountCode || "6122"} · Dr PPN Masukan 1600 · Cr ${fundingAccount}`}
                </Text>
              </View>
            </TouchableOpacity>

            <View className="gap-3">
              <FormField label="Upload File Invoice Supplier (Opsional)">
                <FileUploader
                  label="Pilih File PDF / Foto Invoice Tagihan (Opsional)"
                  kind="semua"
                  category="subscription"
                  autoFlush
                  onUploaded={(fileId) => setInvoiceFileUrl(`/api/upload/file/${fileId}`)}
                />
                {invoiceFileUrl ? (
                  <Text className="mt-1.5 text-xs font-medium text-success">
                    ✓ File invoice terlampir ({invoiceFileUrl})
                  </Text>
                ) : null}
              </FormField>

              <FormField label="Upload Bukti Pembayaran *" required={fundingType !== "AP"}>
                <FileUploader
                  label="Pilih Foto / Dokumen Bukti Bayar (Wajib)"
                  kind="semua"
                  category="subscription"
                  autoFlush
                  onUploaded={(fileId) => setProofUrl(`/api/upload/file/${fileId}`)}
                />
                {proofUrl ? (
                  <Text className="mt-1.5 text-xs font-medium text-success">
                    ✓ Bukti pembayaran terlampir ({proofUrl})
                  </Text>
                ) : null}
              </FormField>

              <FormField label="Catatan">
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Catatan pembayaran..."
                  className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                />
              </FormField>
            </View>
          </View>
        </ScrollView>
        <DialogFooter className="flex-row justify-end gap-2">
          <Button variant="outline" size="sm" onPress={onClose} disabled={saving}>
            <Text className="text-xs">Batal</Text>
          </Button>
          <Button size="sm" onPress={save} disabled={saving}>
            <Text className="text-xs">{saving ? "Menyimpan..." : "Simpan Pembayaran"}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
