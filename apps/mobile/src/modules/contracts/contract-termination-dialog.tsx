import * as React from "react";
import { ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import { Check, XCircle } from "lucide-react-native";
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
import { FileUploader } from "@/components/akuntra/file-uploader";
import { FormField } from "@/components/akuntra/basics";
import { formatThousands } from "@/lib/format";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import type { CtrContract } from "./types";
import { todayWibIso } from "./contract-utils";

type Props = {
  visible: boolean;
  contract: CtrContract | null;
  onClose: () => void;
  onSuccess: () => void;
};

const TERMINATION_CHECKS = [
  { key: "settlement", label: "Penyelesaian tagihan & komitmen finansial berjalan telah diverifikasi" },
  { key: "handover", label: "Serah terima pekerjaan, aset sewa, atau akses sistem telah selesai" },
  { key: "nda", label: "Kewajiban kerahasiaan data (NDA) & pengembalian dokumen telah dikonfirmasi" },
  { key: "notice", label: "Surat pemberitahuan penghentian resmi kepada pihak terkait telah dikirim" },
];

export function ContractTerminationDialog(props: Props) {
  if (!props.visible || !props.contract) return null;
  return <TerminationContent key={props.contract.id} {...props} contract={props.contract} />;
}

function TerminationContent({ contract, onClose, onSuccess }: Props & { contract: CtrContract }) {
  const { toast } = useApp();
  const [terminationDate, setTerminationDate] = React.useState(todayWibIso());
  const [reason, setReason] = React.useState("");
  const [penaltyAmount, setPenaltyAmount] = React.useState("0");
  const [remainingObligations, setRemainingObligations] = React.useState("");
  const [checks, setChecks] = React.useState<Record<string, boolean>>({});
  const [beritaAcaraFileUrl, setBeritaAcaraFileUrl] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const allChecked = TERMINATION_CHECKS.every((c) => Boolean(checks[c.key]));

  function toggleCheck(key: string) {
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function submit() {
    if (!reason.trim()) {
      toast("Alasan penghentian kontrak wajib diisi", "danger");
      return;
    }
    setSaving(true);
    try {
      await api.post(`/contracts/${contract.id}/terminate`, {
        terminationDate,
        reason: reason.trim(),
        penaltyAmount: Number(penaltyAmount.replace(/\D/g, "")) || 0,
        remainingObligations: remainingObligations.trim() || undefined,
        checklistConfirmed: allChecked,
        beritaAcaraFileUrl: beritaAcaraFileUrl.trim() || undefined,
      });
      toast("Penghentian kontrak (Terminated) berhasil dicatat");
      onSuccess();
      onClose();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menghentikan kontrak", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-2xl max-h-[92vh]">
        <DialogHeader>
          <DialogTitle>Penghentian Kontrak (Termination) · {contract.contractNumber}</DialogTitle>
        </DialogHeader>
        <ScrollView className="max-h-[72vh]" contentContainerStyle={{ paddingBottom: 8 }}>
          <View className="gap-3">
            <View className="rounded-xl border border-warning/40 bg-warning/5 p-3">
              <Text className="text-xs font-bold">Penghentian Kontrak Aktif (PRD 5.6)</Text>
              <Text className="mt-1 text-[11px] text-muted-foreground">
                Kontrak yang dihentikan akan berstatus TERMINATED, pengingat kedaluwarsa dihentikan, namun
                seluruh histori dokumen dan komitmen tetap tersimpan untuk audit trail.
              </Text>
            </View>

            <View className="flex-row flex-wrap gap-3">
              <View className="min-w-[180px] flex-1">
                <FormField label="Tanggal Efektif Penghentian *" required>
                  <DatePicker value={terminationDate} onChange={setTerminationDate} />
                </FormField>
              </View>
              <View className="min-w-[180px] flex-1">
                <FormField label={`Penalti / Biaya Penghentian (${contract.currency})`}>
                  <TextInput
                    value={formatThousands(penaltyAmount)}
                    onChangeText={(txt) => setPenaltyAmount(txt.replace(/\D/g, ""))}
                    keyboardType="numeric"
                    placeholder="0"
                    className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                  />
                </FormField>
              </View>
            </View>

            <FormField label="Alasan Penghentian Kontrak *" required>
              <TextInput
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={3}
                placeholder="Contoh: Pekerjaan selesai lebih awal / pelanggaran SLA oleh vendor / restrukturisasi layanan..."
                className="min-h-[76px] rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
              />
            </FormField>

            <FormField label="Kewajiban yang Masih Berjalan (Remaining Obligations)">
              <TextInput
                value={remainingObligations}
                onChangeText={setRemainingObligations}
                multiline
                numberOfLines={2}
                placeholder="Contoh: Retensi pemeliharaan 5% selama 90 hari atau pelunasan invoice termin akhir..."
                className="min-h-[60px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </FormField>

            <View className="rounded-xl border border-border/80 bg-card p-3">
              <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Checklist Verifikasi Penghentian Kontrak
              </Text>
              <View className="gap-2">
                {TERMINATION_CHECKS.map((item) => {
                  const checked = Boolean(checks[item.key]);
                  return (
                    <TouchableOpacity
                      key={item.key}
                      onPress={() => toggleCheck(item.key)}
                      className={`flex-row items-center gap-2 rounded-lg border px-3 py-2 ${
                        checked ? "border-success/40 bg-success/10" : "border-border bg-background"
                      }`}
                    >
                      <View
                        className={`h-5 w-5 items-center justify-center rounded border ${
                          checked ? "border-success bg-success" : "border-border bg-card"
                        }`}
                      >
                        {checked ? <Check size={12} color="#fff" /> : null}
                      </View>
                      <Text className="flex-1 text-xs font-medium">{item.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <FormField label="Upload Dokumen Termination / Berita Acara Penghentian">
              <FileUploader
                label="Pilih File Berita Acara / Surat Terminasi"
                kind="dokumen"
                category="contract"
                autoFlush
                onUploaded={(fileId) => setBeritaAcaraFileUrl(`/api/upload/file/${fileId}`)}
              />
              {beritaAcaraFileUrl ? (
                <Text className="mt-1 text-xs font-semibold text-success">
                  ✓ Berita acara terlampir ({beritaAcaraFileUrl})
                </Text>
              ) : null}
            </FormField>
          </View>
        </ScrollView>

        <DialogFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onPress={onClose} disabled={saving}>
            <Text className="text-xs">Batal</Text>
          </Button>
          <Button variant="destructive" className="gap-1.5" onPress={submit} disabled={saving}>
            <XCircle size={14} color="#fff" />
            <Text className="text-xs text-white">
              {saving ? "Memproses..." : "Eksekusi Penghentian Kontrak"}
            </Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
