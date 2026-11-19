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
import { DatePicker, SearchableSelect } from "@/components/akuntra/dialogs";
import { FormField } from "@/components/akuntra/basics";
import { formatThousands, rupiah, tanggal } from "@/lib/format";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import type { SubSubscription } from "./types";
import { CHANGE_TYPE_LABEL, mrcFor, todayIso } from "./subscription-utils";

type Props = {
  visible: boolean;
  subscription: SubSubscription | null;
  onClose: () => void;
  onSuccess: () => void;
};

export function SubscriptionUpgradeDialog(props: Props) {
  if (!props.visible || !props.subscription) return null;
  return <UpgradeContent key={props.subscription.id} {...props} subscription={props.subscription} />;
}

function UpgradeContent({ subscription, onClose, onSuccess }: Props & { subscription: SubSubscription }) {
  const { toast } = useApp();
  const [changeType, setChangeType] = React.useState("UPGRADE");
  const [newPlan, setNewPlan] = React.useState(subscription.subscriptionPlan ?? "");
  const [newCost, setNewCost] = React.useState(String(Math.round(Number(subscription.cost) || 0)));
  const [effectiveDate, setEffectiveDate] = React.useState(todayIso());
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const costNumber = Number(newCost.replace(/\D/g, "")) || 0;
  const mrc = mrcFor(costNumber, subscription.billingCycle, subscription.startDate, subscription.expirationDate);

  async function save() {
    if (!newPlan.trim()) {
      toast("Nama paket baru wajib diisi", "danger");
      return;
    }
    if (costNumber <= 0) {
      toast("Biaya baru harus lebih dari 0", "danger");
      return;
    }
    if (!reason.trim()) {
      toast("Alasan perubahan wajib diisi", "danger");
      return;
    }
    setSaving(true);
    try {
      await api.post(`/subscriptions/${subscription.id}/change-plan`, {
        changeType,
        newPlan: newPlan.trim(),
        newCost: costNumber,
        effectiveDate,
        changeReason: reason.trim(),
      });
      toast("Perubahan paket berhasil dicatat");
      onSuccess();
      onClose();
    } catch (e: any) {
      toast(e?.message ?? "Gagal mengubah paket", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Upgrade / Downgrade · {subscription.subscriptionCode}</DialogTitle>
        </DialogHeader>
        <ScrollView className="max-h-[70vh]" contentContainerStyle={{ paddingBottom: 8 }}>
          <View className="gap-3">
            <View className="rounded-xl border border-border/80 bg-muted/20 p-3">
              <Text className="text-[11px] uppercase tracking-wide text-muted-foreground">Paket Saat Ini</Text>
              <Text className="text-sm font-semibold">{subscription.subscriptionPlan ?? "-"}</Text>
              <Text className="mt-1 text-xs text-muted-foreground">
                {rupiah(subscription.cost)} / {subscription.billingCycle} · mulai {tanggal(subscription.startDate)}
              </Text>
            </View>

            <View className="flex-row flex-wrap gap-3">
              <View className="min-w-[170px] flex-1">
                <FormField label="Jenis Perubahan" required>
                  <SearchableSelect
                    value={CHANGE_TYPE_LABEL[changeType] ?? "Upgrade"}
                    options={Object.values(CHANGE_TYPE_LABEL)}
                    onChange={(label) => {
                      const found = Object.entries(CHANGE_TYPE_LABEL).find(([, value]) => value === label);
                      setChangeType(found?.[0] ?? "UPGRADE");
                    }}
                    className="h-11 rounded-lg border-border/80 bg-card"
                  />
                </FormField>
              </View>
              <View className="min-w-[180px] flex-1">
                <FormField label="Tanggal Efektif" required>
                  <DatePicker value={effectiveDate} onChange={setEffectiveDate} />
                </FormField>
              </View>
            </View>

            <View className="flex-row flex-wrap gap-3">
              <View className="min-w-[200px] flex-1">
                <FormField label="Paket / Plan Baru" required>
                  <TextInput
                    value={newPlan}
                    onChangeText={setNewPlan}
                    placeholder="Business, Pro, Enterprise..."
                    className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                  />
                </FormField>
              </View>
              <View className="min-w-[180px] flex-1">
                <FormField label="Biaya Baru" required>
                  <TextInput
                    value={formatThousands(newCost)}
                    onChangeText={(value) => setNewCost(value.replace(/\D/g, ""))}
                    keyboardType="numeric"
                    className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                  />
                </FormField>
              </View>
              <View className="min-w-[180px] flex-1">
                <FormField label="MRC Baru">
                  <View className="h-11 justify-center rounded-lg border border-border bg-muted/30 px-3">
                    <Text className="text-sm font-semibold text-primary">{rupiah(mrc)} / bulan</Text>
                  </View>
                </FormField>
              </View>
            </View>

            <FormField label="Alasan Perubahan" required>
              <TextInput
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={3}
                placeholder="Contoh: peningkatan kapasitas pengguna dari 10 menjadi 25 user"
                className="min-h-[76px] rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
              />
            </FormField>

            <View className="rounded-xl border border-border/80 bg-card p-3">
              <Text className="text-[11px] text-muted-foreground">
                Selisih biaya: {rupiah(Number(subscription.cost))} → {rupiah(costNumber)} (
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
            <Text className="text-xs">{saving ? "Menyimpan..." : "Simpan Perubahan"}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
