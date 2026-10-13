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

// staged = file dipilih tapi belum diunggah ke server; di-flush saat Simpan.
export type StagedFile = {
  id: number; // id sementara (lokal) untuk key & remove
  name: string;
  size: string;
  uri?: string;
  blob?: Blob;
  kind: "foto" | "dokumen" | "video";
};

const LIMIT: Record<UploadKind, string> = {
  foto: "Foto png, jpg, jpeg maksimal 5 MB",
  dokumen: "Dokumen pdf, docx, xlsx maksimal 15 MB",
  video: "Video maksimal 25 MB (sekitar 5 menit)",
  semua: "Foto png/jpg/jpeg ≤ 5 MB · dokumen pdf/docx/xlsx ≤ 15 MB · video ≤ 25 MB",
};

const ACCEPT: Record<Exclude<UploadKind, "semua">, string> = {
  foto: "image/png,image/jpeg,image/webp",
  dokumen:
    ".xlsx,.xls,.pdf,.docx,.doc,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip",
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

export type FileUploaderHandle = {
  /** Unggah semua file yang masih staged ke server. Kembalikan fileId terakhir (atau null). */
  flush: () => Promise<number | null>;
  hasStaged: () => boolean;
};

type Props = {
  label: string;
  kind?: UploadKind;
  required?: boolean;
  onChange?: (n: number) => void;
  onFilePicked?: (file: { name: string; blob?: Blob; uri?: string }) => void | Promise<void>;
  multiple?: boolean;
  handleRef?: (h: FileUploaderHandle | null) => void;
  /** true = unggah langsung saat dipilih (konsumen tanpa tombol Simpan). default: staged sampai flush(). */
  autoFlush?: boolean;
};

export function FileUploader({
  label, kind = "semua", required, onChange, onFilePicked, multiple = false, handleRef, autoFlush = false,
}: Props) {
  const { toast, offline } = useApp();
  const [staged, setStaged] = React.useState<StagedFile[]>([]);
  const [busy, setBusy] = React.useState(false);
  const web = Platform.OS === "web";
  const prevLenRef = React.useRef(0);

  const target = toUploadKind(kind);

  async function flushOne(f: StagedFile): Promise<number | null> {
    const payload = f.blob ?? (f.uri ? { uri: f.uri, name: f.name, type: "application/octet-stream" } : null);
    return uploadFile(payload, f.kind);
  }

  // notify parent of staged count after commit (never during render — parent setState
  // would fire while this child is rendering and React throws).
  React.useEffect(() => {
    onChange?.(staged.length);
  }, [staged.length, onChange]);

  function stage(f: { name?: string; uri?: string; blob?: Blob; size?: number }) {
    const entry: StagedFile = {
      id: Date.now() + prevLenRef.current,
      name: f.name || "file",
      size: f.size ? fmtSize(f.size) : "",
      uri: f.uri,
      blob: f.blob,
      kind: target,
    };
    setStaged((prev) => {
      prevLenRef.current = prev.length + 1;
      return [...prev, entry];
    });
    if (onFilePicked) {
      void onFilePicked({ name: entry.name, blob: entry.blob, uri: entry.uri });
    } else if (autoFlush) {
      void flushOne(entry);
    }
  }

  function remove(id: number) {
    setStaged((prev) => prev.filter((f) => f.id !== id));
  }

  /** Unggah file staged ke server. Kembalikan fileId terakhir yang diunggah. */
  const flush = React.useCallback(async (): Promise<number | null> => {
    if (!staged.length) return null;
    setBusy(true);
    try {
      let lastId: number | null = null;
      for (const f of staged) {
        const id = await flushOne(f);
        if (id != null) lastId = id;
      }
      return lastId;
    } finally {
      setBusy(false);
    }
  }, [staged]);

  React.useEffect(() => {
    if (!handleRef) return;
    handleRef({
      flush,
      hasStaged: () => staged.length > 0,
    });
    return () => { handleRef(null); };
  }, [handleRef, flush, staged.length]);

  async function pickAndStage() {
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
        stage({
          uri: asset.uri,
          name: asset.fileName ?? asset.uri.split("/").pop() ?? "upload",
          size: asset.fileSize,
        });
      }
      toast(offline ? "File disimpan di perangkat, dikirim saat tersambung" : "File siap, akan diunggah saat disimpan");
    } finally {
      setBusy(false);
    }
  }

  function add() {
    void pickAndStage();
  }

  const webInputRef = React.useRef<HTMLInputElement | null>(null);
  function handleWebDrop(ev: React.DragEvent) {
    ev.preventDefault();
    const list = ev.dataTransfer?.files;
    if (!list?.length) return;
    stageWebFiles(Array.from(list));
  }

  function handleWebInput(ev: React.ChangeEvent<HTMLInputElement>) {
    const list = ev.target.files;
    if (!list?.length) return;
    stageWebFiles(Array.from(list));
    ev.target.value = "";
  }

  function stageWebFiles(list: File[]) {
    for (const f of list) {
      stage({ name: f.name, blob: f, size: f.size });
    }
    toast(offline ? "File disimpan di perangkat, dikirim saat tersambung" : "File siap, akan diunggah saat disimpan");
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
              <Text>{busy ? "Memproses..." : "Ambil foto / pilih file"}</Text>
            </Button>
            <Button variant="outline" onPress={add} disabled={busy}>
              <Paperclip size={16} color={colors.text} />
              <Text>Pilih file</Text>
            </Button>
          </View>
          <Text className="text-muted-foreground text-center text-[13px]">{LIMIT[kind]}</Text>
        </Pressable>
      )}
      {staged.map((f) => (
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
