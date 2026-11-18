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
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import type { SubSubscription } from "./types";
import { UTILIZATION_OPTIONS, todayIso } from "./subscription-utils";

type Props = {
  visible: boolean;
  subscription: SubSubscription | null;
  onClose: () => void;
  onSuccess: () => void;
};

export function SubscriptionUsageDialog(props: Props) {
  if (!props.visible || !props.subscription) return null;
  return <UsageContent key={props.subscription.id} {...props} subscription={props.subscription} />;
}

function UsageContent({ subscription, onClose, onSuccess }: Props & { subscription: SubSubscription }) {
  const { toast } = useApp();
  const latest = subscription.usageRecords?.[0];
  const [usersCount, setUsersCount] = React.useState(
    latest?.usersCount != null ? String(latest.usersCount) : "",
  );
  const [licensesCount, setLicensesCount] = React.useState(
    latest?.licensesCount != null ? String(latest.licensesCount) : "",
  );
  const [storageCapacity, setStorageCapacity] = React.useState(latest?.storageCapacity ?? "");
  const [serverSpecs, setServerSpecs] = React.useState(latest?.serverSpecs ?? "");
  const [utilizationStatus, setUtilizationStatus] = React.useState(
    latest?.utilizationStatus ?? "OPTIMAL",
  );
  const [notes, setNotes] = React.useState("");
  const [reviewDate, setReviewDate] = React.useState(
    latest?.lastReviewedDate ? String(latest.lastReviewedDate).slice(0, 10) : todayIso(),
  );
  const [saving, setSaving] = React.useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.post(`/subscriptions/${subscription.id}/usage`, {
        usersCount: usersCount ? Number(usersCount.replace(/\D/g, "")) : undefined,
        licensesCount: licensesCount ? Number(licensesCount.replace(/\D/g, "")) : undefined,
        storageCapacity: storageCapacity.trim() || undefined,
        serverSpecs: serverSpecs.trim() || undefined,
        utilizationStatus,
        evaluationNotes: notes.trim() || undefined,
        lastReviewedDate: reviewDate,
      });
      toast("Review utilisasi berhasil disimpan");
      onSuccess();
      onClose();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menyimpan review", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Review Utilisasi · {subscription.subscriptionCode}</DialogTitle>
        </DialogHeader>
        <ScrollView className="max-h-[70vh]" contentContainerStyle={{ paddingBottom: 8 }}>
          <View className="gap-3">
            <View className="rounded-xl border border-border/80 bg-muted/20 p-3">
              <Text className="text-sm font-semibold">{subscription.serviceName}</Text>
              <Text className="text-[11px] text-muted-foreground">
                {subscription.providerLabel ?? subscription.providerName ?? "-"} · {subscription.billingCycle}
              </Text>
            </View>

            <View className="flex-row flex-wrap gap-3">
              <View className="min-w-[150px] flex-1">
                <FormField label="Jumlah User Aktif">
                  <TextInput
                    value={usersCount}
                    onChangeText={setUsersCount}
                    keyboardType="numeric"
                    placeholder="0"
                    className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                  />
                </FormField>
              </View>
              <View className="min-w-[150px] flex-1">
                <FormField label="Jumlah Lisensi">
                  <TextInput
                    value={licensesCount}
                    onChangeText={setLicensesCount}
                    keyboardType="numeric"
                    placeholder="0"
                    className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                  />
                </FormField>
              </View>
              <View className="min-w-[180px] flex-1">
                <FormField label="Status Utilisasi">
                  <SearchableSelect
                    value={UTILIZATION_OPTIONS.find((x) => x.value === utilizationStatus)?.label ?? "Optimal"}
                    options={UTILIZATION_OPTIONS.map((x) => x.label)}
                    onChange={(label) => {
                      const found = UTILIZATION_OPTIONS.find((x) => x.label === label);
                      setUtilizationStatus(found?.value ?? "OPTIMAL");
                    }}
                    className="h-11 rounded-lg border-border/80 bg-card"
                  />
                </FormField>
              </View>
            </View>

            <View className="flex-row flex-wrap gap-3">
              <View className="min-w-[180px] flex-1">
                <FormField label="Kapasitas Storage">
                  <TextInput
                    value={storageCapacity}
                    onChangeText={setStorageCapacity}
                    placeholder="Contoh: 500 GB / 2 TB"
                    className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                  />
                </FormField>
              </View>
              <View className="min-w-[180px] flex-1">
                <FormField label="Spesifikasi Server">
                  <TextInput
                    value={serverSpecs}
                    onChangeText={setServerSpecs}
                    placeholder="4 vCPU, 16 GB RAM"
                    className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                  />
                </FormField>
              </View>
              <View className="min-w-[170px] flex-1">
                <FormField label="Tanggal Review">
                  <DatePicker value={reviewDate} onChange={setReviewDate} />
                </FormField>
              </View>
            </View>

            <FormField label="Catatan Evaluasi">
              <TextInput
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                placeholder="Contoh: hanya 4 dari 10 lisensi terpakai, pertimbangkan downgrade."
                className="min-h-[76px] rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
              />
            </FormField>
          </View>
        </ScrollView>
        <DialogFooter className="flex-row justify-end gap-2">
          <Button variant="outline" size="sm" onPress={onClose} disabled={saving}>
            <Text className="text-xs">Batal</Text>
          </Button>
          <Button size="sm" onPress={save} disabled={saving}>
            <Text className="text-xs">{saving ? "Menyimpan..." : "Simpan Review"}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
