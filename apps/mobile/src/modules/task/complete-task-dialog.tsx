import * as React from "react";
import { View } from "react-native";
import { CheckCircle2 } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FileUploader, type FileUploaderHandle } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { type Row } from "@/constants/modules";

export function CompleteTaskDialog({
  task,
  open,
  onOpenChange,
  onCompleted,
}: {
  task: Row | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: (task: Row) => void;
}) {
  const { patchRow, setStatus, toast } = useApp();
  const [proofFileId, setProofFileId] = React.useState<number | null>(null);
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const fileUploaderRef = React.useRef<FileUploaderHandle | null>(null);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen && !open) {
      setProofFileId(null);
      setNote("");
    }
    onOpenChange(nextOpen);
  }

  if (!task) return null;

  async function handleComplete() {
    let finalFid = proofFileId;
    if (!finalFid && fileUploaderRef.current?.hasStaged()) {
      try {
        finalFid = await fileUploaderRef.current.flush();
      } catch {}
    }

    if (!finalFid && !task?.proofFileId && !task?.bastFileId && !task?.fileId) {
      toast("Bukti selesai tugas (foto/dokumen) wajib diunggah", "danger");
      return;
    }

    setSubmitting(true);
    try {
      const patchOk = await patchRow("tasks", task!.id, {
        status: "DONE",
        progres: 100,
        proofFileId: finalFid,
        fileId: finalFid,
      });
      if (!patchOk) return;

      const statusOk = await setStatus("tasks", task!.id, "DONE", note.trim() || undefined, finalFid ? { proofFileId: finalFid } : undefined);
      if (!statusOk) return;
      toast("Tugas berhasil diselesaikan dengan bukti!");
      onOpenChange(false);
      onCompleted?.({ ...task!, status: "DONE", progres: 100, proofFileId: finalFid, fileId: finalFid });
    } catch (err: any) {
      toast(err?.message || "Gagal menyelesaikan tugas", "danger");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex-row items-center gap-2">
            <CheckCircle2 size={18} className="text-primary" />
            <Text className="font-bold text-base">Selesaikan Tugas</Text>
          </DialogTitle>
          <DialogDescription>
            Tugas &quot;{task.nama}&quot; akan ditandai selesai (DONE 100%). Lampiran bukti penyelesaian pekerjaan wajib diunggah.
          </DialogDescription>
        </DialogHeader>

        <View className="gap-3 py-2">
          <FileUploader
            label="Upload Bukti Selesai (Foto / Dokumen / PDF) *"
            kind="semua"
            accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp"
            allowedExtensions={["jpg", "jpeg", "png", "webp", "pdf"]}
            category="task-proof"
            handleRef={(h) => { fileUploaderRef.current = h; }}
            autoFlush
            onUploaded={(id) => setProofFileId(id)}
          />

          <View className="gap-1">
            <Text className="text-xs text-muted-foreground font-medium">Catatan Penyelesaian (Opsional)</Text>
            <Textarea
              value={note}
              onChangeText={setNote}
              placeholder="Contoh: Pekerjaan selesai dites normal, dokumentasi terlampir..."
              numberOfLines={3}
            />
          </View>
        </View>

        <DialogFooter className="gap-2">
          <Button variant="outline" onPress={() => onOpenChange(false)} disabled={submitting}>
            <Text>Batal</Text>
          </Button>
          <Button onPress={handleComplete} disabled={submitting}>
            <Text className="text-white font-semibold">{submitting ? "Menyimpan..." : "Tandai Selesai"}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
