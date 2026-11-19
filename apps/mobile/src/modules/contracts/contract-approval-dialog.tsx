import * as React from "react";
import { ScrollView, TextInput, View } from "react-native";
import { CheckCircle2, ShieldCheck } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/taska/dialogs";
import { FormField } from "@/components/taska/basics";
import { colors } from "@/tokens";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import type { CtrContract } from "./types";
import { formatContractCurrency } from "./contract-utils";

type Props = {
  visible: boolean;
  contract: CtrContract | null;
  onClose: () => void;
  onSuccess: () => void;
};

const STAGE_OPTIONS = [
  { value: "DEPT_REVIEW", label: "Review Department Manager" },
  { value: "LEGAL_REVIEW", label: "Pemeriksaan Legal & Klausul" },
  { value: "FINANCE_REVIEW", label: "Review Nilai & Komitmen Finance" },
  { value: "DIRECTOR_APPROVAL", label: "Final Approval Manajemen / Direksi" },
];

const DECISION_OPTIONS = [
  { value: "APPROVED", label: "Approved — Setujui & Aktifkan Kontrak" },
  { value: "PENDING_REVIEW", label: "Pending Review — Teruskan ke Pemeriksaan" },
  { value: "PENDING_APPROVAL", label: "Pending Approval — Teruskan ke Approver Akhir" },
  { value: "REVISION_REQUIRED", label: "Revision Required — Minta Revisi Dokumen/Klausul" },
  { value: "REJECTED", label: "Rejected — Tolak Pengajuan Kontrak" },
  { value: "CANCELLED", label: "Cancelled — Batalkan Pengajuan" },
];

export function ContractApprovalDialog(props: Props) {
  if (!props.visible || !props.contract) return null;
  return <ApprovalContent key={props.contract.id} {...props} contract={props.contract} />;
}

function ApprovalContent({ contract, onClose, onSuccess }: Props & { contract: CtrContract }) {
  const { toast } = useApp();
  const [stage, setStage] = React.useState("DIRECTOR_APPROVAL");
  const [decision, setDecision] = React.useState("APPROVED");
  const [comments, setComments] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const mainDoc =
    (contract.documents ?? []).find((d) => d.documentCategory === "MAIN_CONTRACT") ??
    contract.documents?.[0];
  const latestVersion = mainDoc?.versions?.[0];

  async function submit() {
    setSaving(true);
    try {
      await api.post(`/contracts/${contract.id}/approvals`, {
        stage,
        decision,
        comments: comments.trim() || undefined,
        approvedDocumentVersionId: latestVersion?.id,
      });
      toast(`Keputusan approval (${decision}) berhasil disimpan`);
      onSuccess();
      onClose();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menyimpan keputusan approval", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Review & Approval Kontrak · {contract.contractNumber}</DialogTitle>
        </DialogHeader>
        <ScrollView className="max-h-[70vh]" contentContainerStyle={{ paddingBottom: 8 }}>
          <View className="gap-3">
            <View className="rounded-xl border border-border/80 bg-muted/20 p-3">
              <View className="flex-row items-center gap-2">
                <ShieldCheck size={16} color={colors.primary} />
                <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Ringkasan Kontrak & Referensi Versi Dokumen
                </Text>
              </View>
              <Text className="mt-1.5 text-sm font-semibold">{contract.title}</Text>
              <Text className="mt-0.5 text-xs text-muted-foreground">
                Pihak Terkait: {contract.counterpartyName} · Nilai:{" "}
                {formatContractCurrency(contract.contractValue, contract.currency)}
              </Text>
              {latestVersion ? (
                <Text className="mt-1 text-[11px] text-success">
                  ✓ Dokumen Referensi: {mainDoc?.documentTitle} (Versi v{latestVersion.versionNumber} —{" "}
                  {latestVersion.fileName}) akan dikunci saat disetujui.
                </Text>
              ) : (
                <Text className="mt-1 text-[11px] text-muted-foreground">
                  Belum ada file dokumen fisik yang diunggah pada kontrak ini.
                </Text>
              )}
            </View>

            <View className="flex-row flex-wrap gap-3">
              <View className="min-w-[220px] flex-1">
                <FormField label="Tahap Pemeriksaan (Stage)" required>
                  <SearchableSelect
                    value={STAGE_OPTIONS.find((s) => s.value === stage)?.label ?? stage}
                    options={STAGE_OPTIONS.map((s) => s.label)}
                    onChange={(label) => {
                      const found = STAGE_OPTIONS.find((s) => s.label === label);
                      if (found) setStage(found.value);
                    }}
                    className="h-11 rounded-lg border-border/80 bg-card"
                  />
                </FormField>
              </View>

              <View className="min-w-[240px] flex-1">
                <FormField label="Keputusan Approval" required>
                  <SearchableSelect
                    value={DECISION_OPTIONS.find((d) => d.value === decision)?.label ?? decision}
                    options={DECISION_OPTIONS.map((d) => d.label)}
                    onChange={(label) => {
                      const found = DECISION_OPTIONS.find((d) => d.label === label);
                      if (found) setDecision(found.value);
                    }}
                    className="h-11 rounded-lg border-border/80 bg-card"
                  />
                </FormField>
              </View>
            </View>

            <FormField label="Komentar / Catatan Evaluasi">
              <TextInput
                value={comments}
                onChangeText={setComments}
                multiline
                numberOfLines={3}
                placeholder="Catatan hasil review klausul, nilai finansial, atau instruksi revisi..."
                className="min-h-[82px] rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
              />
            </FormField>
          </View>
        </ScrollView>

        <DialogFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onPress={onClose} disabled={saving}>
            <Text className="text-xs">Batal</Text>
          </Button>
          <Button className="gap-1.5" onPress={submit} disabled={saving}>
            <CheckCircle2 size={14} color="#fff" />
            <Text className="text-xs text-white">
              {saving ? "Menyimpan..." : "Simpan Keputusan Approval"}
            </Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
