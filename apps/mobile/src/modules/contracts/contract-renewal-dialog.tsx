import * as React from "react";
import { ScrollView, TextInput, View } from "react-native";
import { RefreshCw } from "lucide-react-native";
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
import { formatThousands, tanggal } from "@/lib/format";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import type { CtrContract } from "./types";
import {
  addDaysIso,
  addMonthsIso,
  formatContractCurrency,
  todayWibIso,
} from "./contract-utils";

type Props = {
  visible: boolean;
  contract: CtrContract | null;
  onClose: () => void;
  onSuccess: () => void;
};

export function ContractRenewalDialog(props: Props) {
  if (!props.visible || !props.contract) return null;
  return <RenewalContent key={props.contract.id} {...props} contract={props.contract} />;
}

function RenewalContent({ contract, onClose, onSuccess }: Props & { contract: CtrContract }) {
  const { toast } = useApp();
  const prevStart = contract.effectiveDate ? String(contract.effectiveDate).slice(0, 10) : todayWibIso();
  const prevEnd = contract.expirationDate ? String(contract.expirationDate).slice(0, 10) : todayWibIso();
  const defaultNewStart = addDaysIso(prevEnd, 1);
  const defaultNewEnd = addDaysIso(addMonthsIso(defaultNewStart, 12), -1);

  const [proposedEffectiveDate, setProposedEffectiveDate] = React.useState(defaultNewStart);
  const [proposedExpirationDate, setProposedExpirationDate] = React.useState(defaultNewEnd);
  const [proposedValue, setProposedValue] = React.useState(
    String(Math.round(Number(contract.contractValue) || 0)),
  );
  const [reason, setReason] = React.useState("");
  const [mode, setMode] = React.useState<"APPROVE_NOW" | "PENDING_REVIEW">("APPROVE_NOW");
  const [reviewComments, setReviewComments] = React.useState("");
  const [addendumTitle, setAddendumTitle] = React.useState("");
  const [addendumFileUrl, setAddendumFileUrl] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const numericValue = Number(proposedValue.replace(/\D/g, "")) || 0;

  function handleStartChange(val: string) {
    setProposedEffectiveDate(val);
    setProposedExpirationDate(addDaysIso(addMonthsIso(val, 12), -1));
  }

  async function submit() {
    if (!proposedEffectiveDate || !proposedExpirationDate) {
      toast("Periode baru wajib diisi", "danger");
      return;
    }
    if (proposedExpirationDate <= proposedEffectiveDate) {
      toast("Tanggal berakhir baru harus setelah tanggal mulai", "danger");
      return;
    }
    if (!reason.trim()) {
      toast("Alasan evaluasi / perpanjangan kontrak wajib diisi", "danger");
      return;
    }

    setSaving(true);
    try {
      await api.post(`/contracts/${contract.id}/renewals`, {
        proposedEffectiveDate,
        proposedExpirationDate,
        proposedValue: numericValue,
        reason: reason.trim(),
        autoApprove: mode === "APPROVE_NOW",
        reviewComments: reviewComments.trim() || undefined,
        addendumTitle: addendumTitle.trim() || undefined,
        addendumFileUrl: addendumFileUrl.trim() || undefined,
      });
      toast(
        mode === "APPROVE_NOW"
          ? "Perpanjangan kontrak disetujui & histori periode baru tercatat"
          : "Pengajuan perpanjangan kontrak berhasil dikirim untuk direview",
      );
      onSuccess();
      onClose();
    } catch (e: any) {
      toast(e?.message ?? "Gagal memproses perpanjangan kontrak", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-3xl max-h-[92vh]">
        <DialogHeader>
          <DialogTitle>Perpanjangan Kontrak (Renewal) · {contract.contractNumber}</DialogTitle>
        </DialogHeader>
        <ScrollView className="max-h-[72vh]" contentContainerStyle={{ paddingBottom: 8 }}>
          <View className="gap-3">
            <View className="rounded-xl border border-border/80 bg-muted/20 p-3">
              <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Periode Kontrak Saat Ini
              </Text>
              <Text className="mt-1 text-sm font-semibold">
                {tanggal(prevStart)} s/d {tanggal(prevEnd)} ·{" "}
                {formatContractCurrency(contract.contractValue, contract.currency)}
              </Text>
              <Text className="mt-1 text-[11px] text-muted-foreground">
                Sesuai PRD 15.4, perpanjangan kontrak akan menyimpan histori periode lama, nilai lama, dan
                dokumen lama secara utuh tanpa menghapus data sebelumnya.
              </Text>
            </View>

            <View className="flex-row flex-wrap gap-3">
              <View className="min-w-[180px] flex-1">
                <FormField label="Tanggal Efektif Baru" required>
                  <DatePicker value={proposedEffectiveDate} onChange={handleStartChange} />
                </FormField>
              </View>
              <View className="min-w-[180px] flex-1">
                <FormField label="Tanggal Berakhir Baru" required>
                  <DatePicker value={proposedExpirationDate} onChange={setProposedExpirationDate} />
                </FormField>
              </View>
              <View className="min-w-[190px] flex-1">
                <FormField label={`Nilai Kontrak Baru (${contract.currency})`} required>
                  <TextInput
                    value={formatThousands(proposedValue)}
                    onChangeText={(txt) => setProposedValue(txt.replace(/\D/g, ""))}
                    keyboardType="numeric"
                    placeholder="0"
                    className="h-11 rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground"
                  />
                </FormField>
              </View>
            </View>

            <View className="flex-row flex-wrap gap-3">
              <View className="min-w-[240px] flex-1">
                <FormField label="Mode Pemrosesan Approval Renewal">
                  <SearchableSelect
                    value={
                      mode === "APPROVE_NOW"
                        ? "Setujui & Perbarui Masa Berlaku Sekarang"
                        : "Ajukan ke Antrean Review & Approval"
                    }
                    options={[
                      "Setujui & Perbarui Masa Berlaku Sekarang",
                      "Ajukan ke Antrean Review & Approval",
                    ]}
                    onChange={(val) =>
                      setMode(
                        val === "Setujui & Perbarui Masa Berlaku Sekarang"
                          ? "APPROVE_NOW"
                          : "PENDING_REVIEW",
                      )
                    }
                    className="h-11 rounded-lg border-border/80 bg-card"
                  />
                </FormField>
              </View>
              <View className="min-w-[220px] flex-1">
                <FormField label="Judul Draft Addendum / Kontrak Baru (Opsional)">
                  <TextInput
                    value={addendumTitle}
                    onChangeText={setAddendumTitle}
                    placeholder="Contoh: Addendum Perpanjangan Tahun ke-2"
                    className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                  />
                </FormField>
              </View>
            </View>

            <FormField label="Evaluasi Performa & Alasan Perpanjangan *" required>
              <TextInput
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={3}
                placeholder="Jelaskan hasil evaluasi vendor/layanan dan dasar pengajuan perpanjangan kontrak..."
                className="min-h-[76px] rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
              />
            </FormField>

            <FormField label="Catatan Review Finance / Legal (Opsional)">
              <TextInput
                value={reviewComments}
                onChangeText={setReviewComments}
                placeholder="Catatan komitmen pembayaran atau klausul tambahan..."
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              />
            </FormField>

            <FormField label="Upload Dokumen Addendum / Kontrak Baru (Opsional)">
              <FileUploader
                label="Pilih File PDF / DOCX Addendum Perpanjangan"
                kind="dokumen"
                category="contract"
                autoFlush
                onUploaded={(fileId) => setAddendumFileUrl(`/api/upload/file/${fileId}`)}
              />
              {addendumFileUrl ? (
                <Text className="mt-1 text-xs font-semibold text-success">
                  ✓ Dokumen addendum terlampir ({addendumFileUrl})
                </Text>
              ) : null}
            </FormField>
          </View>
        </ScrollView>

        <DialogFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onPress={onClose} disabled={saving}>
            <Text className="text-xs">Batal</Text>
          </Button>
          <Button className="gap-1.5" onPress={submit} disabled={saving}>
            <RefreshCw size={14} color="#fff" />
            <Text className="text-xs text-white">
              {saving ? "Memproses..." : "Simpan Perpanjangan Kontrak"}
            </Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
