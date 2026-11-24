import * as React from "react";
import { Image, Platform, Pressable, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Camera, Eye, FileText, Image as ImageIcon, Paperclip, Trash2, Upload } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { uploadFile } from "@/services/api";
import { WebCameraModal, captureNativePhoto } from "./camera-capture-modal";

export type UploadKind = "foto" | "dokumen" | "video" | "semua";

export const MAX_FILE_SIZE_BYTES: Record<"foto" | "dokumen" | "video", number> = {
  foto: 5 * 1024 * 1024,      // 5 MB
  dokumen: 15 * 1024 * 1024,  // 15 MB
  video: 25 * 1024 * 1024,    // 25 MB
};

export const DEFAULT_ALLOWED_EXTENSIONS: Record<UploadKind, string[]> = {
  foto: ["png", "jpg", "jpeg", "webp", "gif", "heic", "heif"],
  dokumen: [
    "pdf", "docx", "doc", "xlsx", "xls", "csv", "md", "markdown", "txt", "zip",
    "png", "jpg", "jpeg", "webp"
  ],
  video: ["mp4", "mkv", "mov", "avi"],
  semua: [
    "png", "jpg", "jpeg", "webp", "gif", "heic", "heif",
    "pdf", "docx", "doc", "xlsx", "xls", "csv", "md", "markdown", "txt", "zip",
    "mp4", "mkv", "mov", "avi"
  ],
};

// staged = file dipilih tapi belum diunggah ke server; di-flush saat Simpan.
export type StagedFile = {
  id: number; // id sementara (lokal) untuk key & remove
  name: string;
  size: string;
  uri?: string;
  blob?: Blob;
  previewUri?: string;
  kind: "foto" | "dokumen" | "video";
};

const LIMIT: Record<UploadKind, string> = {
  foto: "Foto png, jpg, jpeg, webp maksimal 5 MB",
  dokumen: "Dokumen pdf, docx, md, txt, xlsx maksimal 15 MB",
  video: "Video maksimal 25 MB (sekitar 5 menit)",
  semua: "Foto ≤ 5 MB · dokumen (pdf, docx, md, txt, xlsx) ≤ 15 MB · video ≤ 25 MB",
};

const ACCEPT: Record<Exclude<UploadKind, "semua">, string> = {
  foto: "image/*,image/png,image/jpeg,image/webp,.jpg,.jpeg,.png,.webp,.heic,.heif",
  dokumen:
    ".pdf,.docx,.doc,.xlsx,.xls,.csv,.md,.markdown,.txt,.zip,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/markdown,text/plain,application/zip,image/*",
  video: "video/*,video/mp4,video/x-matroska,video/quicktime",
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
  category?: string;
  required?: boolean;
  onChange?: (n: number) => void;
  onFilePicked?: (file: { name: string; blob?: Blob; uri?: string }) => void | Promise<void>;
  onUploaded?: (fileId: number, file: StagedFile) => void | Promise<void>;
  multiple?: boolean;
  handleRef?: (h: FileUploaderHandle | null) => void;
  /** true = unggah langsung saat dipilih (konsumen tanpa tombol Simpan). default: staged sampai flush(). */
  autoFlush?: boolean;
  accept?: string;
  hint?: string;
  allowedExtensions?: string[];
  maxSizeBytes?: number;
};

export function FileUploader({
  label, kind = "semua", category, required, onChange, onFilePicked, onUploaded, multiple = false, handleRef, autoFlush = false,
  accept: acceptProp, hint: hintProp, allowedExtensions, maxSizeBytes,
}: Props) {
  const { toast, offline } = useApp();
  const [staged, setStaged] = React.useState<StagedFile[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [cameraOpen, setCameraOpen] = React.useState(false);
  const [previewItem, setPreviewItem] = React.useState<StagedFile | null>(null);
  const web = Platform.OS === "web";
  const prevLenRef = React.useRef(0);

  const target = toUploadKind(kind);

  // Apakah uploader ini mengizinkan gambar (sehingga tombol Kamera Langsung relevan)
  const allowsPhoto = React.useMemo(() => {
    if (kind === "video") return false;
    if (allowedExtensions && allowedExtensions.length > 0) {
      const exts = allowedExtensions.map((e) => e.replace(/^\./, "").toLowerCase());
      return exts.some((e) => ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(e));
    }
    return true;
  }, [kind, allowedExtensions]);

  // Bersihkan blob preview URL saat unmount
  React.useEffect(() => {
    return () => {
      staged.forEach((it) => {
        if (it.previewUri?.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(it.previewUri);
          } catch {}
        }
      });
    };
  }, [staged]);

  async function flushOne(f: StagedFile): Promise<number | null> {
    try {
      const payload = f.blob ?? (f.uri ? { uri: f.uri, name: f.name, type: "application/octet-stream" } : null);
      return await uploadFile(payload, f.kind, category);
    } catch (e: any) {
      toast(e?.message || "Gagal mengunggah file", "danger");
      throw e;
    }
  }

  // notify parent of staged count after commit (never during render — parent setState
  // would fire while this child is rendering and React throws).
  React.useEffect(() => {
    onChange?.(staged.length);
  }, [staged.length, onChange]);

  function stage(f: { name?: string; uri?: string; blob?: Blob; size?: number }): boolean {
    const fileName = f.name || "file";
    const ext = (fileName.split(".").pop() || "").toLowerCase();

    const allowed = allowedExtensions && allowedExtensions.length > 0
      ? allowedExtensions.map((e) => e.replace(/^\./, "").toLowerCase())
      : DEFAULT_ALLOWED_EXTENSIONS[kind];

    if (allowed && allowed.length > 0) {
      const match = allowed.includes(ext);
      if (!match) {
        toast(`Format file (.${ext || "unknown"}) tidak didukung. Hanya file ${allowed.map((e) => `.${e}`).join(", ")} yang diperbolehkan.`, "danger");
        return false;
      }
    }

    const isImg = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) || f.blob?.type?.startsWith("image/");
    const isVid = ["mp4", "mkv", "mov"].includes(ext) || f.blob?.type?.startsWith("video/");
    const detectedKind: "foto" | "dokumen" | "video" = isImg ? "foto" : isVid ? "video" : target;

    const maxBytes = maxSizeBytes ?? MAX_FILE_SIZE_BYTES[detectedKind];
    const byteSize = f.size ?? f.blob?.size;
    if (typeof byteSize === "number" && byteSize > maxBytes) {
      const maxMb = (maxBytes / (1024 * 1024)).toFixed(0);
      const actualMb = (byteSize / (1024 * 1024)).toFixed(1);
      toast(`Ukuran file (${actualMb} MB) melebihi batas maksimal ${maxMb} MB. File tidak dapat diunggah.`, "danger");
      return false;
    }

    let previewUri: string | undefined;
    if (isImg) {
      if (f.blob && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
        try {
          previewUri = URL.createObjectURL(f.blob);
        } catch {}
      } else if (f.uri) {
        previewUri = f.uri;
      }
    }

    const entry: StagedFile = {
      id: Date.now() + prevLenRef.current,
      name: fileName,
      size: byteSize ? fmtSize(byteSize) : "",
      uri: f.uri,
      blob: f.blob,
      previewUri,
      kind: detectedKind,
    };
    setStaged((prev) => {
      prevLenRef.current = prev.length + 1;
      return [...prev, entry];
    });
    if (onFilePicked) {
      void onFilePicked({ name: entry.name, blob: entry.blob, uri: entry.uri });
    }
    if (autoFlush) {
      setBusy(true);
      void flushOne(entry)
        .then((fileId) => {
          if (fileId != null) onUploaded?.(fileId, entry);
        })
        .finally(() => {
          setBusy(false);
        });
    }
    return true;
  }

  function remove(id: number) {
    setStaged((prev) => {
      const targetItem = prev.find((f) => f.id === id);
      if (targetItem?.previewUri?.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(targetItem.previewUri);
        } catch {}
      }
      return prev.filter((f) => f.id !== id);
    });
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
      let anyStaged = false;
      for (const asset of result.assets) {
        if (
          stage({
            uri: asset.uri,
            name: asset.fileName ?? asset.uri.split("/").pop() ?? "upload",
            size: asset.fileSize,
          })
        ) {
          anyStaged = true;
        }
      }
      if (anyStaged && !autoFlush) {
        toast(offline ? "File disimpan di perangkat, dikirim saat tersambung" : "File siap, akan diunggah saat disimpan");
      }
    } finally {
      setBusy(false);
    }
  }

  async function takePhotoNative() {
    setBusy(true);
    try {
      const photo = await captureNativePhoto(toast);
      if (!photo) return;
      const ok = stage({ uri: photo.uri, name: photo.name, size: photo.size });
      if (ok && !autoFlush) {
        toast(offline ? "Foto disimpan di perangkat, dikirim saat tersambung" : "Foto kamera siap, akan diunggah saat disimpan");
      }
    } finally {
      setBusy(false);
    }
  }

  function add() {
    void pickAndStage();
  }

  function openCamera() {
    if (web) {
      setCameraOpen(true);
    } else {
      void takePhotoNative();
    }
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
    let anyStaged = false;
    for (const f of list) {
      if (stage({ name: f.name, blob: f, size: f.size })) {
        anyStaged = true;
      }
    }
    if (anyStaged && !autoFlush) {
      toast(offline ? "File disimpan di perangkat, dikirim saat tersambung" : "File siap, akan diunggah saat disimpan");
    }
  }

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium">
        {label}
        {required ? <Text className="text-danger text-sm"> *</Text> : null}
      </Text>
      {web ? (
        <View className="gap-2">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleWebDrop}
            onClick={() => webInputRef.current?.click()}
            className="border-border bg-panel/40 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-5 cursor-pointer"
          >
            <Upload size={20} color={colors.muted} />
            <Text className="text-text-secondary text-center text-sm">Tarik file ke sini atau klik untuk memilih dari galeri/perangkat</Text>
            <input
              ref={(el) => { webInputRef.current = el; }}
              type="file"
              multiple={multiple}
              accept={acceptProp ?? (kind === "semua" ? undefined : ACCEPT[toUploadKind(kind)])}
              onChange={handleWebInput}
              className="hidden"
            />
            <Text className="text-muted-foreground text-center text-[13px]">{hintProp ?? LIMIT[kind]}</Text>
          </div>
          {allowsPhoto ? (
            <View className="flex-row flex-wrap gap-2">
              <Button variant="outline" size="sm" onPress={openCamera} disabled={busy} className="gap-1.5">
                <Camera size={15} color={colors.primary} />
                <Text className="text-xs font-semibold">Ambil Foto (Kamera)</Text>
              </Button>
              <Button variant="outline" size="sm" onPress={() => webInputRef.current?.click()} disabled={busy} className="gap-1.5">
                <ImageIcon size={15} color={colors.text} />
                <Text className="text-xs font-medium">Pilih dari Galeri / File</Text>
              </Button>
            </View>
          ) : null}
        </View>
      ) : (
        <View className="border-border bg-panel/40 items-center gap-2 rounded-xl border border-dashed px-4 py-5">
          <Upload size={20} color={colors.muted} />
          <View className="flex-row flex-wrap justify-center gap-2">
            {allowsPhoto ? (
              <Button variant="outline" size="sm" onPress={openCamera} disabled={busy} className="gap-1.5">
                <Camera size={15} color={colors.primary} />
                <Text className="text-xs font-semibold">{busy ? "Memproses..." : "Ambil Foto (Kamera)"}</Text>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onPress={add} disabled={busy} className="gap-1.5">
              <Paperclip size={15} color={colors.text} />
              <Text className="text-xs font-medium">Pilih dari Galeri</Text>
            </Button>
          </View>
          <Text className="text-muted-foreground text-center text-[13px]">{hintProp ?? LIMIT[kind]}</Text>
        </View>
      )}
      {staged.map((f) => (
        <View key={f.id} className="bg-card border-border flex-row items-center gap-3 rounded-lg border p-2.5">
          {f.previewUri ? (
            <Pressable
              onPress={() => setPreviewItem(f)}
              className="size-12 rounded-md overflow-hidden border border-border bg-panel shrink-0 relative"
            >
              <Image source={{ uri: f.previewUri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            </Pressable>
          ) : (
            <View className="bg-panel size-10 items-center justify-center rounded-md shrink-0">
              <FileText size={18} color={colors.textSecondary} />
            </View>
          )}
          <View className="flex-1 min-w-0">
            <Text className="text-sm font-medium" numberOfLines={1}>{f.name}</Text>
            <Text className="text-muted-foreground text-[12px]">{f.size || "siap dikirim"}</Text>
          </View>
          {f.previewUri ? (
            <Pressable onPress={() => setPreviewItem(f)} hitSlop={8} className="size-9 items-center justify-center rounded-lg bg-primary/10">
              <Eye size={15} color={colors.primary} />
            </Pressable>
          ) : null}
          <Pressable onPress={() => remove(f.id)} hitSlop={10} className="size-9 items-center justify-center">
            <Trash2 size={16} color={colors.muted} />
          </Pressable>
        </View>
      ))}

      {/* Modal Kamera Langsung (Web) */}
      <WebCameraModal
        visible={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(photo) => {
          const ok = stage({ name: photo.name, blob: photo.blob, size: photo.size });
          if (ok && !autoFlush) {
            toast(offline ? "Foto disimpan di perangkat, dikirim saat tersambung" : "Foto kamera siap, akan diunggah saat disimpan");
          }
        }}
      />

      {/* Modal Pratinjau Gambar Sebelum Upload */}
      <Dialog open={Boolean(previewItem)} onOpenChange={(open) => { if (!open) setPreviewItem(null); }}>
        <DialogContent className="sm:max-w-lg bg-card p-4 gap-3">
          <DialogHeader>
            <DialogTitle>{previewItem?.name || "Pratinjau Gambar"}</DialogTitle>
          </DialogHeader>
          {previewItem?.previewUri ? (
            <View className="w-full h-80 bg-black/5 rounded-xl overflow-hidden border border-border items-center justify-center">
              <Image
                source={{ uri: previewItem.previewUri }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
              />
            </View>
          ) : null}
        </DialogContent>
      </Dialog>
    </View>
  );
}
