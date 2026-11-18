import * as React from "react";
import { ScrollView, TextInput, View } from "react-native";
import { FilePlus2 } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/taska/dialogs";
import { FileUploader } from "@/components/taska/file-uploader";
import { FormField } from "@/components/taska/basics";
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

export function ContractAmendmentDialog(props: Props) {
  if (!props.visible || !props.contract) return null;
  return <AmendmentContent key={props.contract.id} {...props} contract={props.contract} />;
}

function AmendmentContent({ contract, onClose, onSuccess }: Props & { contract: CtrContract }) {
  const { toast } = useApp();
  const [amendmentNumber, setAmendmentNumber] = React.useState("");
  const [amendmentDate, setAmendmentDate] = React.useState(todayWibIso());
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [valueAdjustment, setValueAdjustment] = React.useState("0");
  const [newExpirationDate, setNewExpirationDate] = React.useState("");
  const [fileUrl, setFileUrl] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function submit() {
    if (!title.trim() || !description.trim()) {
      toast("Judul dan uraian perubahan addendum wajib diisi", "danger");
      return;
    }
    setSaving(true);
    try {
      const rawAdj = Number(valueAdjustment.replace(/[^\d-]/g, "")) || 0;
      await api.post(`/contracts/${contract.id}/amendments`, {
        amendmentNumber: amendmentNumber.trim() || undefined,
        amendmentDate,
        title: title.trim(),
        description: description.trim(),
        valueAdjustment: rawAdj,
        newExpirationDate: newExpirationDate || undefined,
        fileUrl: fileUrl.trim() || undefined,
      });
      toast("Addendum kontrak berhasil dicatat");
      onSuccess();
      onClose();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menyimpan addendum kontrak", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Catat Addendum Kontrak · {contract.contractNumber}</DialogTitle>
        </DialogHeader>
        <ScrollView className="max-h-[70vh]" contentContainerStyle={{ paddingBottom: 8 }}>
          <View className="gap-3">
            <View className="flex-row flex-wrap gap-3">
              <View className="min-w-[180px] flex-1">
                <FormField label="Nomor Addendum (Otomatis jika kosong)">
                  <TextInput
                    value={amendmentNumber}
                    onChangeText={setAmendmentNumber}
                    placeholder={`AMD/${contract.contractNumber}/01`}
                    className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                  />
                </FormField>
              </View>
              <View className="min-w-[180px] flex-1">
                <FormField label="Tanggal Addendum *" required>
                  <DatePicker value={amendmentDate} onChange={setAmendmentDate} />
                </FormField>
              </View>
            </View>

            <FormField label="Judul Addendum *" required>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Contoh: Penambahan Lingkup Layanan Maintenance Server Cabang"
                className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              />
            </FormField>

            <FormField label="Uraian Perubahan Klausul / Ketentuan *" required>
              <TextInput
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                placeholder="Rincian pasal atau ketentuan yang diubah melalui addendum ini..."
                className="min-h-[76px] rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
              />
            </FormField>

            <View className="flex-row flex-wrap gap-3">
              <View className="min-w-[180px] flex-1">
                <FormField label={`Selisih Perubahan Nilai (${contract.currency})`}>
                  <TextInput
                    value={formatThousands(valueAdjustment)}
                    onChangeText={(txt) => setValueAdjustment(txt.replace(/[^\d-]/g, ""))}
                    keyboardType="numeric"
                    placeholder="0"
                    className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                  />
                </FormField>
              </View>
              <View className="min-w-[180px] flex-1">
                <FormField label="Tanggal Berakhir Baru (Jika Berubah)">
                  <DatePicker
                    value={newExpirationDate}
                    onChange={setNewExpirationDate}
                    clearable
                    placeholder="Tidak berubah"
                  />
                </FormField>
              </View>
            </View>

            <FormField label="Upload Dokumen Addendum (PDF / DOCX)">
              <FileUploader
                label="Pilih File Dokumen Addendum"
                kind="dokumen"
                category="contract"
                autoFlush
                onUploaded={(fileId) => setFileUrl(`/api/upload/file/${fileId}`)}
              />
              {fileUrl ? (
                <Text className="mt-1 text-xs font-semibold text-success">
                  ✓ File addendum terlampir ({fileUrl})
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
            <FilePlus2 size={14} color="#fff" />
            <Text className="text-xs text-white">
              {saving ? "Menyimpan..." : "Simpan Addendum"}
            </Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
