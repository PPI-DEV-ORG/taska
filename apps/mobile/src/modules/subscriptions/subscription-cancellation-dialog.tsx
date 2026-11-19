import * as React from "react";
import { ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import { Check } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/akuntra/dialogs";
import { FormField } from "@/components/akuntra/basics";
import { colors } from "@/tokens";
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

const CHECKS: Array<{ key: string; label: string }> = [
  { key: "isDataBackupConfirmed", label: "Backup data / konfigurasi selesai" },
  { key: "isServiceMigrationConfirmed", label: "Migrasi layanan ke platform lain selesai" },
  { key: "isDnsMigrationConfirmed", label: "Migrasi DNS / domain selesai" },
  { key: "isDependencyCheckConfirmed", label: "Dependency check (integrasi & akses) selesai" },
  { key: "isHandoverConfirmed", label: "Handover dokumentasi & akses selesai" },
  { key: "isTerminationConfirmed", label: "Konfirmasi terminasi ke provider selesai" },
];

export function SubscriptionCancellationDialog(props: Props) {
  if (!props.visible || !props.subscription) return null;
  return <CancellationContent key={props.subscription.id} {...props} subscription={props.subscription} />;
}

function CancellationContent({ subscription, onClose, onSuccess }: Props & { subscription: SubSubscription }) {
  const { toast } = useApp();
  const [reason, setReason] = React.useState("");
  const [effectiveDate, setEffectiveDate] = React.useState(
    subscription.expirationDate ? String(subscription.expirationDate).slice(0, 10) : todayIso(),
  );
  const [finalBillingDate, setFinalBillingDate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [checks, setChecks] = React.useState<Record<string, boolean>>({});
  const [saving, setSaving] = React.useState(false);

  function toggle(key: string) {
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function save() {
    if (!reason.trim()) {
      toast("Alasan pembatalan wajib diisi", "danger");
      return;
    }
    setSaving(true);
    try {
      await api.post(`/subscriptions/${subscription.id}/cancellation`, {
        reason: reason.trim(),
        effectiveCancellationDate: effectiveDate,
        finalBillingDate: finalBillingDate || undefined,
        notes: notes.trim() || undefined,
        ...checks,
      });
      toast("Permintaan pembatalan berhasil diajukan");
      onSuccess();
      onClose();
    } catch (e: any) {
      toast(e?.message ?? "Gagal mengajukan pembatalan", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-2xl max-h-[92vh]">
        <DialogHeader>
          <DialogTitle>Ajukan Pembatalan · {subscription.subscriptionCode}</DialogTitle>
        </DialogHeader>
        <ScrollView className="max-h-[74vh]" contentContainerStyle={{ paddingBottom: 8 }}>
          <View className="gap-3">
            <View className="rounded-xl border border-warning/40 bg-warning/5 p-3">
              <Text className="text-xs font-bold">Pembatalan memerlukan approval & verifikasi</Text>
              <Text className="mt-1 text-[11px] text-muted-foreground">
                Reminder renewal akan dihentikan setelah pembatalan dieksekusi. Semua checklist wajib
                dikonfirmasi sebelum eksekusi oleh approver.
              </Text>
            </View>

            <FormField label="Alasan Pembatalan" required>
              <TextInput
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={3}
                placeholder="Contoh: layanan digantikan oleh platform internal"
                className="min-h-[76px] rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
              />
            </FormField>

            <View className="flex-row flex-wrap gap-3">
              <View className="min-w-[180px] flex-1">
                <FormField label="Tanggal Efektif Pembatalan" required>
                  <DatePicker value={effectiveDate} onChange={setEffectiveDate} />
                </FormField>
              </View>
              <View className="min-w-[180px] flex-1">
                <FormField label="Tagihan Terakhir (opsional)">
                  <DatePicker value={finalBillingDate} onChange={setFinalBillingDate} clearable />
                </FormField>
              </View>
            </View>

            <View className="rounded-xl border border-border/80 bg-card p-3">
              <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Checklist Verifikasi Infrastruktur
              </Text>
              <View className="gap-2">
                {CHECKS.map((item) => {
                  const checked = Boolean(checks[item.key]);
                  return (
                    <TouchableOpacity
                      key={item.key}
                      onPress={() => toggle(item.key)}
                      className={`flex-row items-center gap-2 rounded-lg border px-3 py-2 ${
                        checked ? "border-success/40 bg-success/10" : "border-border bg-background"
                      }`}
                    >
                      <View
                        className={`h-5 w-5 items-center justify-center rounded border ${
                          checked ? "border-success bg-success" : "border-border bg-card"
                        }`}
                      >
                        {checked ? <Check size={13} color="#fff" /> : null}
                      </View>
                      <Text className="flex-1 text-xs">{item.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text className="mt-2 text-[11px] text-muted-foreground">
                Checklist boleh dilengkapi nanti; eksekusi pembatalan akan ditolak bila masih ada yang belum dicentang.
              </Text>
            </View>

            <FormField label="Catatan">
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Catatan tambahan untuk approver..."
                className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
              />
            </FormField>
          </View>
        </ScrollView>
        <DialogFooter className="flex-row justify-end gap-2">
          <Button variant="outline" size="sm" onPress={onClose} disabled={saving}>
            <Text className="text-xs">Batal</Text>
          </Button>
          <Button size="sm" onPress={save} disabled={saving}>
            <Text className="text-xs">{saving ? "Mengajukan..." : "Ajukan Pembatalan"}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
