import * as React from "react";
import { Platform, Pressable, View } from "react-native";
import { Camera, FileText, Paperclip, Trash2, Upload } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";

export type UploadKind = "foto" | "dokumen" | "video" | "semua";

const LIMIT: Record<UploadKind, string> = {
  foto: "Foto png, jpg, jpeg maksimal 5 MB",
  dokumen: "Dokumen pdf, docx, xlsx maksimal 15 MB",
  video: "Video maksimal 25 MB (sekitar 5 menit)",
  semua: "Foto png/jpg/jpeg ≤ 5 MB · dokumen pdf/docx/xlsx ≤ 15 MB · video ≤ 25 MB",
};
const SAMPLE: Record<UploadKind, [string, string]> = {
  foto: ["foto-lokasi-0810.jpg", "1,8 MB"],
  dokumen: ["dokumen-pendukung.pdf", "2,4 MB"],
  video: ["video-pekerjaan.mp4", "18,2 MB"],
  semua: ["lampiran-0810.pdf", "1,2 MB"],
};

export function FileUploader({
  label, kind = "semua", required, onChange,
}: { label: string; kind?: UploadKind; required?: boolean; onChange?: (n: number) => void }) {
  const { toast, offline } = useApp();
  const [files, setFiles] = React.useState<{ id: number; name: string; size: string }[]>([]);
  const web = Platform.OS === "web";
  function add() {
    const [name, size] = SAMPLE[kind];
    const next = [...files, { id: Date.now(), name: files.length ? name.replace(".", `-${files.length + 1}.`) : name, size }];
    setFiles(next);
    onChange?.(next.length);
    toast(offline ? "File disimpan di perangkat, dikirim saat tersambung" : "File ditambahkan", offline ? "info" : "success");
  }
  function remove(id: number) {
    const next = files.filter((f) => f.id !== id);
    setFiles(next);
    onChange?.(next.length);
  }
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium">
        {label}
        {required ? <Text className="text-danger text-sm"> *</Text> : null}
      </Text>
      <Pressable
        onPress={web ? add : undefined}
        className="border-border bg-panel/40 items-center gap-2 rounded-xl border border-dashed px-4 py-5"
      >
        <Upload size={20} color={colors.muted} />
        {web ? (
          <Text className="text-text-secondary text-center text-sm">Tarik file ke sini atau klik untuk memilih</Text>
        ) : (
          <View className="flex-row flex-wrap justify-center gap-2">
            <Button variant="outline" onPress={add}><Camera size={16} color={colors.text} /><Text>Ambil foto</Text></Button>
            <Button variant="outline" onPress={add}><Paperclip size={16} color={colors.text} /><Text>Pilih file</Text></Button>
          </View>
        )}
        <Text className="text-muted-foreground text-center text-[13px]">{LIMIT[kind]}</Text>
      </Pressable>
      {files.map((f) => (
        <View key={f.id} className="bg-card border-border flex-row items-center gap-3 rounded-lg border p-3">
          <View className="bg-panel size-10 items-center justify-center rounded-md"><FileText size={18} color={colors.textSecondary} /></View>
          <View className="flex-1">
            <Text className="text-sm font-medium" numberOfLines={1}>{f.name}</Text>
            <Text className="text-muted-foreground text-[13px]">{f.size}</Text>
          </View>
          <Pressable onPress={() => remove(f.id)} hitSlop={10} className="size-10 items-center justify-center"><Trash2 size={16} color={colors.muted} /></Pressable>
        </View>
      ))}
    </View>
  );
}
