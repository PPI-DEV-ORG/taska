import * as React from "react";
import { Platform, Pressable, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Camera, FileText, Paperclip, Trash2, Upload } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { uploadFile } from "@/services/api";

export type UploadKind = "foto" | "dokumen" | "video" | "semua";

const LIMIT: Record<UploadKind, string> = {
  foto: "Foto png, jpg, jpeg maksimal 5 MB",
  dokumen: "Dokumen pdf, docx, xlsx maksimal 15 MB",
  video: "Video maksimal 25 MB (sekitar 5 menit)",
  semua: "Foto png/jpg/jpeg ≤ 5 MB · dokumen pdf/docx/xlsx ≤ 15 MB · video ≤ 25 MB",
};

const ACCEPT: Record<Exclude<UploadKind, "semua">, string> = {
  foto: "image/png,image/jpeg,image/webp",
  dokumen: "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip",
  video: "video/mp4,video/x-matroska",
};

function toUploadKind(kind: UploadKind): "foto" | "dokumen" | "video" {
  return kind === "semua" ? "dokumen" : kind;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type PickedFile = { uri?: string; name?: string; type?: string; size?: number };

export function FileUploader({
  label, kind = "semua", required, onChange, multiple = false,
}: { label: string; kind?: UploadKind; required?: boolean; onChange?: (n: number) => void; multiple?: boolean }) {
  const { toast, offline } = useApp();
  const [files, setFiles] = React.useState<{ id: number; name: string; size: string; uri?: string }[]>([]);
  const [busy, setBusy] = React.useState(false);
  const web = Platform.OS === "web";
  const [prevFiles, setPrevFiles] = React.useState(files);

  if (files !== prevFiles) {
    setPrevFiles(files);
    onChange?.(files.length);
  }

  function pushLocal(f: PickedFile) {
    setFiles((prev) => [...prev, {
      id: Date.now() + prev.length,
      name: f.name || "file",
      size: f.size ? fmtSize(f.size) : "",
      uri: f.uri,
    }]);
  }

  function remove(id: number) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  async function pickAndUpload() {
    const target = toUploadKind(kind);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast("Izin akses galeri diperlukan untuk memilih file", "danger");
      return;
    }
    const pickerOpts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: multiple,
      quality: 0.8,
    };
    if (kind === "foto") pickerOpts.mediaTypes = ["images"];
    if (kind === "video") pickerOpts.mediaTypes = ["videos"];
    const result = await ImagePicker.launchImageLibraryAsync(pickerOpts);
    if (result.canceled) return;

    setBusy(true);
    try {
      for (const asset of result.assets) {
        const file: PickedFile = {
          uri: asset.uri,
          name: asset.fileName ?? asset.uri.split("/").pop() ?? "upload",
          type: asset.mimeType,
          size: asset.fileSize,
        };
        if (offline) {
          toast("File disimpan di perangkat, dikirim saat tersambung", "info");
          pushLocal(file);
          continue;
        }
        const id = await uploadFile(file, target);
        if (id != null) {
          setFiles((prev) => [...prev, {
            id,
            name: file.name || `file-${id}`,
            size: file.size ? fmtSize(file.size) : "",
            uri: file.uri,
          }]);
        }
      }
      toast(offline ? "File disimpan di perangkat, dikirim saat tersambung" : "File diunggah");
    } catch (e: any) {
      toast(e?.message ?? "Gagal mengunggah file", "danger");
    } finally {
      setBusy(false);
    }
  }

  function add() {
    void pickAndUpload();
  }

  const webInputRef = React.useRef<HTMLInputElement | null>(null);
  function handleWebDrop(ev: React.DragEvent) {
    ev.preventDefault();
    const list = ev.dataTransfer?.files;
    if (!list?.length) return;
    uploadWebFiles(Array.from(list));
  }

  function handleWebInput(ev: React.ChangeEvent<HTMLInputElement>) {
    const list = ev.target.files;
    if (!list?.length) return;
    uploadWebFiles(Array.from(list));
    ev.target.value = "";
  }

  function uploadWebFiles(list: File[]) {
    setBusy(true);
    void (async () => {
      try {
        for (const f of list) {
          const id = await uploadFile(f, toUploadKind(kind));
          if (id != null) {
            setFiles((prev) => [...prev, { id, name: f.name, size: fmtSize(f.size) }]);
          }
        }
        toast("File diunggah");
      } catch (e: any) {
        toast(e?.message ?? "Gagal mengunggah file", "danger");
      } finally {
        setBusy(false);
      }
    })();
  }

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium">
        {label}
        {required ? <Text className="text-danger text-sm"> *</Text> : null}
      </Text>
      {web ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleWebDrop}
          onClick={() => webInputRef.current?.click()}
          className="border-border bg-panel/40 items-center gap-2 rounded-xl border border-dashed px-4 py-5 cursor-pointer"
        >
          <Upload size={20} color={colors.muted} />
          <Text className="text-text-secondary text-center text-sm">Tarik file ke sini atau klik untuk memilih</Text>
          <input
            ref={(el) => { webInputRef.current = el; }}
            type="file"
            multiple={multiple}
            accept={kind === "semua" ? undefined : ACCEPT[toUploadKind(kind)]}
            onChange={handleWebInput}
            className="hidden"
          />
          <Text className="text-muted-foreground text-center text-[13px]">{LIMIT[kind]}</Text>
        </div>
      ) : (
        <Pressable
          onPress={add}
          className="border-border bg-panel/40 items-center gap-2 rounded-xl border border-dashed px-4 py-5"
        >
          <Upload size={20} color={colors.muted} />
          <View className="flex-row flex-wrap justify-center gap-2">
            <Button variant="outline" onPress={add} disabled={busy}>
              <Camera size={16} color={colors.text} />
              <Text>{busy ? "Mengunggah..." : "Ambil foto / pilih file"}</Text>
            </Button>
            <Button variant="outline" onPress={add} disabled={busy}>
              <Paperclip size={16} color={colors.text} />
              <Text>Pilih file</Text>
            </Button>
          </View>
          <Text className="text-muted-foreground text-center text-[13px]">{LIMIT[kind]}</Text>
        </Pressable>
      )}
      {files.map((f) => (
        <View key={f.id} className="bg-card border-border flex-row items-center gap-3 rounded-lg border p-3">
          <View className="bg-panel size-10 items-center justify-center rounded-md"><FileText size={18} color={colors.textSecondary} /></View>
          <View className="flex-1">
            <Text className="text-sm font-medium" numberOfLines={1}>{f.name}</Text>
            <Text className="text-muted-foreground text-[13px]">{f.size || "siap dikirim"}</Text>
          </View>
          <Pressable onPress={() => remove(f.id)} hitSlop={10} className="size-10 items-center justify-center"><Trash2 size={16} color={colors.muted} /></Pressable>
        </View>
      ))}
    </View>
  );
}
