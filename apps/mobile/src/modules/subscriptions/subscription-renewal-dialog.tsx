import * as React from "react";
import { ScrollView, TextInput, View } from "react-native";
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
import { FormField } from "@/components/taska/basics";
import { formatThousands, rupiah, tanggal } from "@/lib/format";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import type { SubSubscription } from "./types";
import {
  addDaysIso,
  addMonthsIso,
  cycleMonths,
  mrcFor,
  parseIso,
  todayIso,
} from "./subscription-utils";

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
  const prevStart = subscription.startDate ? String(subscription.startDate).slice(0, 10) : todayIso();
  const prevEnd = subscription.expirationDate
    ? String(subscription.expirationDate).slice(0, 10)
    : addDaysIso(addMonthsIso(prevStart, cycleMonths(subscription.billingCycle)), -1);
  const defaultStart = addDaysIso(prevEnd, 1);
  const defaultEnd = addDaysIso(addMonthsIso(defaultStart, cycleMonths(subscription.billingCycle)), -1);
  const [newStart, setNewStart] = React.useState(defaultStart);
  const [newEnd, setNewEnd] = React.useState(defaultEnd);
  const [cost, setCost] = React.useState(String(Math.round(Number(subscription.cost) || 0)));
  const [tax, setTax] = React.useState(String(Math.round(Number(subscription.tax) || 0)));
  const [invoiceNumber, setInvoiceNumber] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [approvalStatus, setApprovalStatus] = React.useState("APPROVED");
  const [saving, setSaving] = React.useState(false);

  const costNumber = Number(cost.replace(/\D/g, "")) || 0;
  const taxNumber = Number(tax.replace(/\D/g, "")) || 0;
  const newMrc = mrcFor(costNumber, subscription.billingCycle, newStart, newEnd);

  function handleStart(value: string) {
    setNewStart(value);
    setNewEnd(addDaysIso(addMonthsIso(value, cycleMonths(subscription.billingCycle)), -1));
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
      });
      toast("Renewal berhasil dicatat");
      onSuccess();
      onClose();
    } catch (e: any) {
      toast(e?.message ?? "Gagal mencatat renewal", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Renewal Langganan · {subscription.subscriptionCode}</DialogTitle>
        </DialogHeader>
        <ScrollView className="max-h-[70vh]" contentContainerStyle={{ paddingBottom: 8 }}>
          <View className="gap-3">
            <View className="rounded-xl border border-border/80 bg-muted/20 p-3">
              <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Periode Saat Ini
              </Text>
              <Text className="text-sm">
                {tanggal(prevStart)} s/d {tanggal(prevEnd)} · {rupiah(subscription.cost)}
              </Text>
              <Text className="mt-1 text-[11px] text-muted-foreground">
                Data periode sebelumnya akan disimpan sebagai histori dan tidak ditimpa.
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
                  <DatePicker value={newEnd} onChange={setNewEnd} />
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

            <View className="rounded-xl border border-border/80 bg-card p-3">
              <Text className="text-[11px] text-muted-foreground">
                Perbandingan biaya: lama {rupiah(subscription.cost)} → baru {rupiah(costNumber)} (
                {costNumber >= Number(subscription.cost) ? "+" : ""}
                {rupiah(costNumber - Number(subscription.cost))})
              </Text>
            </View>
          </View>
        </ScrollView>
        <DialogFooter className="flex-row justify-end gap-2">
          <Button variant="outline" size="sm" onPress={onClose} disabled={saving}>
            <Text className="text-xs">Batal</Text>
          </Button>
          <Button size="sm" onPress={save} disabled={saving}>
            <Text className="text-xs">{saving ? "Menyimpan..." : "Simpan Renewal"}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
