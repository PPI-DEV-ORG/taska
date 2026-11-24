import * as React from "react";
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, Switch, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { WebCameraModal, captureNativePhoto } from "@/components/akuntra/camera-capture-modal";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { colors } from "@/tokens";
import { api, apiBase, apiOrigin, getAccess } from "@/services/api";
import { useApp } from "@/store/app-store";
import { formatBytes } from "@/modules/file-management/file-ui";
import {
  Folder,
  FolderPlus,
  UploadCloud,
  X,
  FileText,
  Lock,
  Globe,
  Shield,
  Plus,
  Trash2,
  Check,
  Share2,
  Copy,
  Link2,
  Camera,
} from "lucide-react-native";
import type {
  DriveAccessEntry,
  DriveFileItem,
  DriveFolderItem,
  DrivePrincipals,
  DriveTreeFolder,
} from "./types";

const FOLDER_COLORS = [
  "#00C094",
  "#2563EB",
  "#7C3AED",
  "#D97706",
  "#DC2626",
  "#0891B2",
  "#64748B",
];

// ─────────────────────────────────────────────────────────────────────────────
// 1. Create / Edit Folder Dialog
// ─────────────────────────────────────────────────────────────────────────────
export function FolderFormDialog({
  visible,
  onClose,
  parentId,
  folderToEdit,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  parentId: number | null;
  folderToEdit?: DriveFolderItem | null;
  onSaved: () => void;
}) {
  const { toast } = useApp();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [color, setColor] = React.useState(FOLDER_COLORS[0]!);
  const [isRestricted, setIsRestricted] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      setName(folderToEdit?.name || "");
      setDescription(folderToEdit?.description || "");
      setColor(folderToEdit?.color || FOLDER_COLORS[0]!);
      setIsRestricted(folderToEdit ? Boolean(folderToEdit.isRestricted) : true);
    }, 0);
    return () => clearTimeout(t);
  }, [visible, folderToEdit]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast("Nama folder wajib diisi.", "danger");
      return;
    }
    setSaving(true);
    try {
      if (folderToEdit) {
        await api.patch(`/drive/folders/${folderToEdit.id}`, {
          name: name.trim(),
          description: description.trim(),
          color,
        });
        toast("Folder berhasil diperbarui.", "success");
      } else {
        await api.post("/drive/folders", {
          name: name.trim(),
          parentId,
          description: description.trim(),
          color,
          isRestricted,
        });
        toast(
          isRestricted
            ? "Folder privat berhasil dibuat. Atur akses folder jika ingin membagikan ke orang lain."
            : "Folder terbuka berhasil dibuat.",
          "success",
        );
      }
      onSaved();
      onClose();
    } catch (e) {
      toast((e as Error).message, "danger");
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <Dialog open={visible} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md bg-card p-5 gap-4">
        <View className="flex-row items-center gap-2.5 border-b border-border pb-3 pr-8">
          <View className="rounded-xl p-2" style={{ backgroundColor: `${color}22` }}>
            <FolderPlus size={18} color={color} />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-base font-bold text-foreground">
              {folderToEdit ? "Ubah Folder" : "Buat Folder Baru"}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {folderToEdit ? "Perbarui nama, keterangan, atau warna folder" : "Folder akan dibuat di lokasi saat ini"}
            </Text>
          </View>
        </View>

        <View className="gap-3">
          <View className="gap-1.5">
            <Text className="text-xs font-semibold text-foreground">Nama Folder *</Text>
            <Input
              value={name}
              onChangeText={setName}
              placeholder="Contoh: SOP Perusahaan, Template, Dokumentasi..."
              autoFocus
            />
          </View>

          <View className="gap-1.5">
            <Text className="text-xs font-semibold text-foreground">Keterangan (Opsional)</Text>
            <Input
              value={description}
              onChangeText={setDescription}
              placeholder="Deskripsi singkat isi folder"
            />
          </View>

          <View className="gap-1.5">
            <Text className="text-xs font-semibold text-foreground">Warna Folder</Text>
            <View className="flex-row flex-wrap gap-2">
              {FOLDER_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  className="h-7 w-7 rounded-full items-center justify-center border-2"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? "#0F172A" : "transparent",
                  }}
                >
                  {color === c && <Check size={14} color="#FFF" />}
                </Pressable>
              ))}
            </View>
          </View>

          {!folderToEdit && (
            <View className="flex-row items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 p-3">
              <View className="flex-1 min-w-0 flex-row items-center gap-2">
                {isRestricted ? (
                  <Lock size={16} color="#D97706" />
                ) : (
                  <Globe size={16} color={colors.primary} />
                )}
                <View className="flex-1 min-w-0">
                  <Text className="text-xs font-bold text-foreground">
                    {isRestricted ? "Privat (Hanya Saya)" : "Terbuka untuk Semua"}
                  </Text>
                  <Text className="text-[11px] text-muted-foreground">
                    {isRestricted
                      ? "Hanya kamu yang bisa lihat sampai akses dibagikan lewat tombol Akses."
                      : "Semua pengguna Dokumen Umum dapat langsung melihat folder ini."}
                  </Text>
                </View>
              </View>
              <Switch
                value={isRestricted}
                onValueChange={setIsRestricted}
                trackColor={{ false: "#CBD5E1", true: colors.primary }}
              />
            </View>
          )}
        </View>

        <View className="flex-row justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onPress={onClose} disabled={saving}>
            <Text className="text-xs font-semibold">Batal</Text>
          </Button>
          <Button
            size="sm"
            onPress={() => void handleSave()}
            disabled={saving}
            style={{ backgroundColor: colors.primary }}
          >
            <Text className="text-xs font-semibold text-white">
              {saving ? "Menyimpan..." : folderToEdit ? "Simpan Perubahan" : "Buat Folder"}
            </Text>
          </Button>
        </View>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Rename File Dialog
// ─────────────────────────────────────────────────────────────────────────────
export function RenameFileDialog({
  visible,
  onClose,
  file,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  file: DriveFileItem | null;
  onSaved: () => void;
}) {
  const { toast } = useApp();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!visible || !file) return;
    const t = setTimeout(() => {
      setName(file.name);
      setDescription(file.description || "");
    }, 0);
    return () => clearTimeout(t);
  }, [visible, file]);

  const handleSave = async () => {
    if (!file || !name.trim()) {
      toast("Nama berkas tidak boleh kosong.", "danger");
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/drive/files/${file.id}`, {
        name: name.trim(),
        description: description.trim(),
      });
      toast("Berkas berhasil diperbarui.", "success");
      onSaved();
      onClose();
    } catch (e) {
      toast((e as Error).message, "danger");
    } finally {
      setSaving(false);
    }
  };

  if (!visible || !file) return null;

  return (
    <Dialog open={visible} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md bg-card p-5 gap-4">
        <View className="flex-row items-center gap-2.5 border-b border-border pb-3 pr-8">
          <View className="rounded-xl p-2 bg-primary/10">
            <FileText size={18} color={colors.primary} />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-base font-bold text-foreground">Ubah Nama & Keterangan</Text>
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {file.originalName}
            </Text>
          </View>
        </View>

        <View className="gap-3">
          <View className="gap-1.5">
            <Text className="text-xs font-semibold text-foreground">Nama Berkas *</Text>
            <Input value={name} onChangeText={setName} placeholder="Nama berkas" autoFocus />
          </View>
          <View className="gap-1.5">
            <Text className="text-xs font-semibold text-foreground">Keterangan (Opsional)</Text>
            <Input value={description} onChangeText={setDescription} placeholder="Catatan atau deskripsi berkas" />
          </View>
        </View>

        <View className="flex-row justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onPress={onClose} disabled={saving}>
            <Text className="text-xs font-semibold">Batal</Text>
          </Button>
          <Button
            size="sm"
            onPress={() => void handleSave()}
            disabled={saving}
            style={{ backgroundColor: colors.primary }}
          >
            <Text className="text-xs font-semibold text-white">
              {saving ? "Menyimpan..." : "Simpan"}
            </Text>
          </Button>
        </View>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Move Folder / File Dialog (Hierarchical Tree Picker)
// ─────────────────────────────────────────────────────────────────────────────
export function MoveItemDialog({
  visible,
  onClose,
  item,
  onMoved,
}: {
  visible: boolean;
  onClose: () => void;
  item: { type: "folder"; data: DriveFolderItem } | { type: "file"; data: DriveFileItem } | null;
  onMoved: () => void;
}) {
  const { toast } = useApp();
  const [folders, setFolders] = React.useState<DriveTreeFolder[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [moving, setMoving] = React.useState(false);

  React.useEffect(() => {
    if (!visible || !item) return;
    let alive = true;
    const run = async () => {
      setSelectedId(item.type === "folder" ? item.data.parentId : item.data.folderId);
      setLoading(true);
      try {
        const res = await api.get<DriveTreeFolder[]>("/drive/folders/tree");
        if (alive) setFolders(Array.isArray(res) ? res : []);
      } catch (e) {
        if (alive) toast((e as Error).message, "danger");
      } finally {
        if (alive) setLoading(false);
      }
    };
    void run();
    return () => {
      alive = false;
    };
  }, [visible, item, toast]);

  // Hitung descendant IDs jika memindahkan folder (agar tidak bisa dipindah ke anaknya sendiri)
  const blockedIds = React.useMemo(() => {
    const blocked = new Set<number>();
    if (item?.type !== "folder") return blocked;
    blocked.add(item.data.id);
    let added = true;
    while (added) {
      added = false;
      for (const f of folders) {
        if (f.parentId !== null && blocked.has(f.parentId) && !blocked.has(f.id)) {
          blocked.add(f.id);
          added = true;
        }
      }
    }
    return blocked;
  }, [item, folders]);

  // Susun daftar berjenjang (depth)
  const flatTree = React.useMemo(() => {
    const out: (DriveTreeFolder & { depth: number })[] = [];
    const visit = (parentId: number | null, depth: number) => {
      const children = folders
        .filter((f) => f.parentId === parentId)
        .sort((a, b) => a.name.localeCompare(b.name));
      for (const c of children) {
        out.push({ ...c, depth });
        visit(c.id, depth + 1);
      }
    };
    visit(null, 0);
    return out;
  }, [folders]);

  const handleMove = async () => {
    if (!item) return;
    setMoving(true);
    try {
      if (item.type === "folder") {
        await api.post(`/drive/folders/${item.data.id}/move`, { targetParentId: selectedId });
      } else {
        await api.post(`/drive/files/${item.data.id}/move`, { targetFolderId: selectedId });
      }
      toast(`${item.type === "folder" ? "Folder" : "Berkas"} berhasil dipindahkan.`, "success");
      onMoved();
      onClose();
    } catch (e) {
      toast((e as Error).message, "danger");
    } finally {
      setMoving(false);
    }
  };

  if (!visible || !item) return null;

  return (
    <Dialog open={visible} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md bg-card p-5 gap-4">
        <View className="border-b border-border pb-3 pr-8">
          <Text className="text-base font-bold text-foreground">
            Pindahkan {item.type === "folder" ? "Folder" : "Berkas"}
          </Text>
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            Pilih folder tujuan untuk &quot;{item.data.name}&quot;
          </Text>
        </View>

        {loading ? (
          <View className="py-10 items-center">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <ScrollView className="max-h-72 rounded-xl border border-border bg-muted/10 p-1.5">
            {/* Root option */}
            <Pressable
              onPress={() => setSelectedId(null)}
              className={`flex-row items-center gap-2 rounded-lg px-3 py-2.5 ${
                selectedId === null ? "bg-primary/15 border border-primary/40" : ""
              }`}
            >
              <Folder size={16} color={colors.primary} />
              <Text className="text-xs font-semibold text-foreground flex-1">
                Dokumen Umum (Root)
              </Text>
              {selectedId === null && <Check size={14} color={colors.primary} />}
            </Pressable>

            {flatTree.map((f) => {
              const disabled = blockedIds.has(f.id) || !f.canUpload;
              const isSelected = selectedId === f.id;
              return (
                <Pressable
                  key={f.id}
                  disabled={disabled}
                  onPress={() => setSelectedId(f.id)}
                  style={{ paddingLeft: 12 + f.depth * 18 }}
                  className={`flex-row items-center gap-2 rounded-lg pr-3 py-2 ${
                    isSelected ? "bg-primary/15 border border-primary/40" : ""
                  } ${disabled ? "opacity-40" : ""}`}
                >
                  <Folder size={15} color={f.color || "#64748B"} />
                  <Text className="text-xs text-foreground flex-1" numberOfLines={1}>
                    {f.name}
                  </Text>
                  {f.isRestricted && <Lock size={11} color="#D97706" />}
                  {isSelected && <Check size={14} color={colors.primary} />}
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <View className="flex-row justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onPress={onClose} disabled={moving}>
            <Text className="text-xs font-semibold">Batal</Text>
          </Button>
          <Button
            size="sm"
            onPress={() => void handleMove()}
            disabled={moving}
            style={{ backgroundColor: colors.primary }}
          >
            <Text className="text-xs font-semibold text-white">
              {moving ? "Memindahkan..." : "Pindahkan ke Sini"}
            </Text>
          </Button>
        </View>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Multiple File Upload Dialog (Web Drag & Drop + Multi-select, Native picker)
// ─────────────────────────────────────────────────────────────────────────────
type QueuedFile = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  webFile?: File;
  nativeUri?: string;
  previewUri?: string;
};

export function MultiUploadDialog({
  visible,
  onClose,
  folderId,
  folderName,
  onUploaded,
}: {
  visible: boolean;
  onClose: () => void;
  folderId: number | null;
  folderName: string;
  onUploaded: () => void;
}) {
  const { toast } = useApp();
  const [queue, setQueue] = React.useState<QueuedFile[]>([]);
  const [description, setDescription] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const [cameraOpen, setCameraOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    return () => {
      queue.forEach((q) => {
        if (q.previewUri?.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(q.previewUri);
          } catch {}
        }
      });
    };
  }, [queue]);

  React.useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      setQueue([]);
      setDescription("");
      setDragOver(false);
    }, 0);
    return () => clearTimeout(t);
  }, [visible]);

  const addWebFiles = (list: FileList | File[]) => {
    const arr = Array.from(list);
    const next: QueuedFile[] = arr.map((f, idx) => {
      const isImg = f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(f.name);
      let previewUri: string | undefined;
      if (isImg && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
        try {
          previewUri = URL.createObjectURL(f);
        } catch {}
      }
      return {
        id: `${Date.now()}-${idx}-${f.name}`,
        name: f.name,
        size: f.size,
        mimeType: f.type || "application/octet-stream",
        webFile: f,
        previewUri,
      };
    });
    setQueue((prev) => [...prev, ...next].slice(0, 20));
  };

  const handleCaptureNative = async () => {
    const photo = await captureNativePhoto(toast);
    if (!photo) return;
    setQueue((prev) =>
      [
        ...prev,
        {
          id: `${Date.now()}-${photo.name}`,
          name: photo.name,
          size: photo.size,
          mimeType: photo.mimeType,
          nativeUri: photo.uri,
          previewUri: photo.uri,
        },
      ].slice(0, 20),
    );
  };

  const handlePickNative = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsMultipleSelection: true,
        quality: 0.9,
      });
      if (res.canceled || !res.assets?.length) return;
      const next: QueuedFile[] = res.assets.map((a, idx) => ({
        id: `${Date.now()}-${idx}-${a.fileName || "media"}`,
        name: a.fileName || `media-${Date.now()}-${idx}.jpg`,
        size: a.fileSize || 0,
        mimeType: a.mimeType || "application/octet-stream",
        nativeUri: a.uri,
      }));
      setQueue((prev) => [...prev, ...next].slice(0, 20));
    } catch (e) {
      toast((e as Error).message || "Gagal memilih berkas.", "danger");
    }
  };

  const handleUpload = async () => {
    if (queue.length === 0) {
      toast("Pilih minimal satu berkas untuk diunggah.", "danger");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      if (folderId !== null) form.append("folderId", String(folderId));
      if (description.trim()) form.append("description", description.trim());

      for (const item of queue) {
        if (item.webFile) {
          form.append("files", item.webFile, item.name);
        } else if (item.nativeUri) {
          form.append("files", {
            uri: item.nativeUri,
            name: item.name,
            type: item.mimeType,
          } as any);
        }
      }

      const token = getAccess();
      const resp = await fetch(`${apiBase()}/drive/files/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(json?.message || `Gagal mengunggah (${resp.status})`);
      }

      const data = json?.data ?? json;
      const okCount = data?.uploadedCount ?? queue.length;
      const failCount = data?.failedCount ?? 0;

      if (failCount > 0) {
        toast(`${okCount} berkas berhasil diunggah, ${failCount} gagal.`, "warning");
      } else {
        toast(`${okCount} berkas berhasil diunggah ke ${folderName}.`, "success");
      }

      onUploaded();
      onClose();
    } catch (e) {
      toast((e as Error).message || "Gagal mengunggah berkas.", "danger");
    } finally {
      setUploading(false);
    }
  };

  if (!visible) return null;

  return (
    <Dialog open={visible} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg bg-card p-5 gap-4">
        <View className="flex-row items-center gap-2.5 border-b border-border pb-3 pr-8">
          <View className="rounded-xl p-2 bg-primary/10">
            <UploadCloud size={18} color={colors.primary} />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-base font-bold text-foreground">Unggah Berkas (Multiple Upload)</Text>
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              Tujuan: {folderName} • Maks 20 file sekaligus (50 MB/file)
            </Text>
          </View>
        </View>

        {/* Dropzone / Picker */}
        {Platform.OS === "web" ? (
          <View className="gap-2">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer?.files?.length) {
                  addWebFiles(e.dataTransfer.files);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? colors.primary : "#CBD5E1"}`,
                backgroundColor: dragOver ? `${colors.primary}12` : "transparent",
                borderRadius: 16,
                padding: "20px 16px",
                textAlign: "center",
                cursor: "pointer",
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files?.length) addWebFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <View className="items-center gap-2">
                <UploadCloud size={28} color={colors.primary} />
                <Text className="text-sm font-semibold text-foreground">
                  Seret & lepas berkas di sini, atau klik untuk memilih
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Mendukung PDF, Excel, Word, Gambar, Video, Teks, ZIP, dll
                </Text>
              </View>
            </div>
            <View className="flex-row flex-wrap gap-2">
              <Button variant="outline" size="sm" onPress={() => setCameraOpen(true)} className="gap-1.5">
                <Camera size={14} color={colors.primary} />
                <Text className="text-xs font-semibold">Ambil Foto (Kamera)</Text>
              </Button>
              <Button variant="outline" size="sm" onPress={() => fileInputRef.current?.click()} className="gap-1.5">
                <UploadCloud size={14} color={colors.text} />
                <Text className="text-xs font-medium">Pilih dari Galeri / Perangkat</Text>
              </Button>
            </View>
          </View>
        ) : (
          <View className="flex-row flex-wrap gap-2">
            <Button variant="outline" size="sm" onPress={() => void handleCaptureNative()} className="flex-1 gap-1.5">
              <Camera size={15} color={colors.primary} />
              <Text className="text-xs font-semibold">Ambil Foto (Kamera)</Text>
            </Button>
            <Button variant="outline" size="sm" onPress={() => void handlePickNative()} className="flex-1 gap-1.5">
              <UploadCloud size={15} color={colors.text} />
              <Text className="text-xs font-semibold">Pilih dari Galeri</Text>
            </Button>
          </View>
        )}

        {/* Queue list */}
        {queue.length > 0 && (
          <View className="gap-1.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-semibold text-foreground">
                Antrean Unggah ({queue.length} berkas)
              </Text>
              <Pressable onPress={() => setQueue([])}>
                <Text className="text-xs text-destructive font-semibold">Kosongkan</Text>
              </Pressable>
            </View>
            <ScrollView className="max-h-44 rounded-xl border border-border bg-muted/10 p-2">
              <View className="gap-1.5">
                {queue.map((item) => (
                  <View
                    key={item.id}
                    className="flex-row items-center justify-between gap-2 rounded-lg bg-card border border-border/60 px-2.5 py-2"
                  >
                    <View className="flex-1 min-w-0 flex-row items-center gap-2">
                      {item.previewUri ? (
                        <Image
                          source={{ uri: item.previewUri }}
                          style={{ width: 32, height: 32, borderRadius: 6 }}
                          resizeMode="cover"
                        />
                      ) : (
                        <FileText size={14} color={colors.primary} />
                      )}
                      <View className="flex-1 min-w-0">
                        <Text className="text-xs font-medium text-foreground" numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text className="text-[10px] text-muted-foreground">
                          {formatBytes(item.size)}
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      onPress={() => setQueue((prev) => prev.filter((q) => q.id !== item.id))}
                      className="p-1"
                    >
                      <X size={14} color={colors.mutedForeground} />
                    </Pressable>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        <View className="gap-1.5">
          <Text className="text-xs font-semibold text-foreground">Keterangan (Opsional)</Text>
          <Input
            value={description}
            onChangeText={setDescription}
            placeholder="Catatan singkat untuk berkas yang diunggah"
          />
        </View>

        <View className="flex-row justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onPress={onClose} disabled={uploading}>
            <Text className="text-xs font-semibold">Batal</Text>
          </Button>
          <Button
            size="sm"
            onPress={() => void handleUpload()}
            disabled={uploading || queue.length === 0}
            style={{ backgroundColor: colors.primary }}
          >
            <Text className="text-xs font-semibold text-white">
              {uploading ? "Mengunggah..." : `Unggah ${queue.length > 0 ? `(${queue.length})` : ""}`}
            </Text>
          </Button>
        </View>
      </DialogContent>
      <WebCameraModal
        visible={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(photo) => {
          if (photo.blob) addWebFiles([photo.blob]);
        }}
      />
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Folder Access Control (RBAC & User/Role Restriction) Dialog
// ─────────────────────────────────────────────────────────────────────────────
export function FolderAccessDialog({
  visible,
  onClose,
  folder,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  folder: DriveFolderItem | null;
  onSaved: () => void;
}) {
  const { toast } = useApp();
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [isRestricted, setIsRestricted] = React.useState(false);
  const [entries, setEntries] = React.useState<DriveAccessEntry[]>([]);
  const [principals, setPrincipals] = React.useState<DrivePrincipals>({ users: [], roles: [] });
  const [addType, setAddType] = React.useState<"ROLE" | "USER">("ROLE");
  const [selectedPrincipalId, setSelectedPrincipalId] = React.useState("");

  React.useEffect(() => {
    if (!visible || !folder) return;
    let alive = true;
    const run = async () => {
      setLoading(true);
      try {
        const [acc, princ] = await Promise.all([
          api.get<{ isRestricted: boolean; entries: DriveAccessEntry[] }>(`/drive/folders/${folder.id}/access`),
          api.get<DrivePrincipals>("/drive/access/principals"),
        ]);
        if (!alive) return;
        setIsRestricted(Boolean(acc.isRestricted));
        setEntries(Array.isArray(acc.entries) ? acc.entries : []);
        setPrincipals(princ || { users: [], roles: [] });
      } catch (e) {
        if (alive) toast((e as Error).message, "danger");
      } finally {
        if (alive) setLoading(false);
      }
    };
    void run();
    return () => {
      alive = false;
    };
  }, [visible, folder, toast]);

  const handleAddEntry = () => {
    if (!selectedPrincipalId) return;
    const exists = entries.some(
      (e) => e.principalType === addType && e.principalId === selectedPrincipalId,
    );
    if (exists) {
      toast("Pengguna/peran sudah ada di daftar.", "warning");
      return;
    }
    setEntries((prev) => [
      ...prev,
      {
        principalType: addType,
        principalId: selectedPrincipalId,
        canView: true,
        canDownload: true,
        canUpload: false,
        canEdit: false,
        canDelete: false,
      },
    ]);
    setSelectedPrincipalId("");
  };

  const toggleFlag = (
    idx: number,
    key: "canView" | "canUpload" | "canDownload" | "canEdit" | "canDelete",
  ) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, [key]: !e[key] } : e)),
    );
  };

  const getPrincipalLabel = (entry: DriveAccessEntry) => {
    if (entry.principalType === "ROLE") {
      const r = principals.roles.find((x) => x.code === entry.principalId);
      return r ? `Peran: ${r.name}` : `Peran: ${entry.principalId}`;
    }
    const u = principals.users.find((x) => String(x.id) === entry.principalId);
    return u ? `${u.name} (${u.role})` : `User #${entry.principalId}`;
  };

  const handleSave = async () => {
    if (!folder) return;
    setSaving(true);
    try {
      await api.put(`/drive/folders/${folder.id}/access`, {
        isRestricted,
        entries,
      });
      toast("Hak akses folder berhasil disimpan.", "success");
      onSaved();
      onClose();
    } catch (e) {
      toast((e as Error).message, "danger");
    } finally {
      setSaving(false);
    }
  };

  if (!visible || !folder) return null;

  return (
    <Dialog open={visible} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-xl bg-card p-5 gap-4">
        <View className="flex-row items-center gap-2.5 border-b border-border pb-3 pr-8">
          <View className="rounded-xl p-2 bg-amber-500/15">
            <Shield size={18} color="#D97706" />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-base font-bold text-foreground">Hak Akses Folder</Text>
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {folder.name}
            </Text>
          </View>
        </View>

        {loading ? (
          <View className="py-12 items-center">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <ScrollView className="max-h-[60vh]">
            <View className="gap-4">
              {/* Toggle restricted */}
              <View className="flex-row items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 p-3.5">
                <View className="flex-1 min-w-0 flex-row items-center gap-2.5">
                  {isRestricted ? (
                    <Lock size={18} color="#D97706" />
                  ) : (
                    <Globe size={18} color={colors.primary} />
                  )}
                  <View className="flex-1 min-w-0">
                    <Text className="text-xs font-bold text-foreground">
                      {isRestricted ? "Folder Terbatas (Khusus)" : "Terbuka Sesuai RBAC"}
                    </Text>
                    <Text className="text-[11px] text-muted-foreground">
                      {isRestricted
                        ? "Hanya admin & pengguna/peran di bawah yang bisa mengakses folder ini beserta subfoldernya."
                        : "Semua pengguna yang memiliki akses menu Dokumen Umum dapat melihat folder ini."}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isRestricted}
                  onValueChange={setIsRestricted}
                  trackColor={{ false: "#CBD5E1", true: colors.primary }}
                />
              </View>

              {/* Add role/user selector */}
              <View className="gap-2 rounded-xl border border-border p-3 bg-card">
                <Text className="text-xs font-bold text-foreground">
                  Tambah Izin Khusus (Peran / Pengguna)
                </Text>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => {
                      setAddType("ROLE");
                      setSelectedPrincipalId("");
                    }}
                    className={`rounded-lg px-3 py-1.5 border ${
                      addType === "ROLE" ? "bg-primary border-primary" : "border-border bg-muted/20"
                    }`}
                  >
                    <Text className={`text-xs font-semibold ${addType === "ROLE" ? "text-white" : "text-foreground"}`}>
                      Peran (Role)
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setAddType("USER");
                      setSelectedPrincipalId("");
                    }}
                    className={`rounded-lg px-3 py-1.5 border ${
                      addType === "USER" ? "bg-primary border-primary" : "border-border bg-muted/20"
                    }`}
                  >
                    <Text className={`text-xs font-semibold ${addType === "USER" ? "text-white" : "text-foreground"}`}>
                      Pengguna
                    </Text>
                  </Pressable>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-1.5 py-1">
                    {addType === "ROLE"
                      ? principals.roles.map((r) => (
                          <Pressable
                            key={r.code}
                            onPress={() => setSelectedPrincipalId(r.code)}
                            className={`rounded-full px-3 py-1 border ${
                              selectedPrincipalId === r.code
                                ? "bg-primary/15 border-primary"
                                : "border-border bg-muted/15"
                            }`}
                          >
                            <Text className="text-xs text-foreground">{r.name}</Text>
                          </Pressable>
                        ))
                      : principals.users.map((u) => (
                          <Pressable
                            key={u.id}
                            onPress={() => setSelectedPrincipalId(String(u.id))}
                            className={`rounded-full px-3 py-1 border ${
                              selectedPrincipalId === String(u.id)
                                ? "bg-primary/15 border-primary"
                                : "border-border bg-muted/15"
                            }`}
                          >
                            <Text className="text-xs text-foreground">{u.name}</Text>
                          </Pressable>
                        ))}
                  </View>
                </ScrollView>

                <View className="flex-row justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={handleAddEntry}
                    disabled={!selectedPrincipalId}
                    className="h-8 gap-1"
                  >
                    <Plus size={13} color={colors.primary} />
                    <Text className="text-xs font-semibold">Tambahkan ke Daftar</Text>
                  </Button>
                </View>
              </View>

              {/* Active ACL entries */}
              <View className="gap-2">
                <Text className="text-xs font-bold text-foreground">
                  Daftar Hak Akses ({entries.length})
                </Text>
                {entries.length === 0 ? (
                  <Text className="text-xs text-muted-foreground italic">
                    Belum ada izin khusus yang ditambahkan.
                  </Text>
                ) : (
                  entries.map((entry, idx) => (
                    <View
                      key={`${entry.principalType}-${entry.principalId}`}
                      className="rounded-xl border border-border p-3 bg-muted/10 gap-2"
                    >
                      <View className="flex-row items-center justify-between gap-2">
                        <Text className="text-xs font-bold text-foreground flex-1" numberOfLines={1}>
                          {getPrincipalLabel(entry)}
                        </Text>
                        <Pressable
                          onPress={() => setEntries((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1"
                        >
                          <Trash2 size={14} color="#EF4444" />
                        </Pressable>
                      </View>
                      <View className="flex-row flex-wrap gap-1.5">
                        {(
                          [
                            ["canView", "View"],
                            ["canDownload", "Download"],
                            ["canUpload", "Upload"],
                            ["canEdit", "Edit"],
                            ["canDelete", "Delete"],
                          ] as const
                        ).map(([k, label]) => (
                          <Pressable
                            key={k}
                            onPress={() => toggleFlag(idx, k)}
                            className={`rounded-lg px-2.5 py-1 border ${
                              entry[k]
                                ? "bg-primary/15 border-primary"
                                : "bg-card border-border"
                            }`}
                          >
                            <Text
                              className={`text-[11px] font-semibold ${
                                entry[k] ? "text-primary" : "text-muted-foreground"
                              }`}
                            >
                              {entry[k] ? "✓ " : ""}
                              {label}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          </ScrollView>
        )}

        <View className="flex-row justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onPress={onClose} disabled={saving}>
            <Text className="text-xs font-semibold">Batal</Text>
          </Button>
          <Button
            size="sm"
            onPress={() => void handleSave()}
            disabled={saving}
            style={{ backgroundColor: colors.primary }}
          >
            <Text className="text-xs font-semibold text-white">
              {saving ? "Menyimpan..." : "Simpan Hak Akses"}
            </Text>
          </Button>
        </View>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Share Link Dialog (Google Drive-style)
// ─────────────────────────────────────────────────────────────────────────────
const EXPIRY_OPTIONS = [
  { label: "1 Hari", days: 1 },
  { label: "7 Hari", days: 7 },
  { label: "30 Hari", days: 30 },
  { label: "Selamanya", days: 0 },
] as const;

export function DriveShareDialog({
  visible,
  onClose,
  file,
}: {
  visible: boolean;
  onClose: () => void;
  file: DriveFileItem | null;
}) {
  const { toast } = useApp();
  const [permission, setPermission] = React.useState<"VIEW" | "DOWNLOAD">("VIEW");
  const [expiresInDays, setExpiresInDays] = React.useState<number>(7);
  const [password, setPassword] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [generatedUrl, setGeneratedUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      setPermission("VIEW");
      setExpiresInDays(7);
      setPassword("");
      setGeneratedUrl(null);
    }, 0);
    return () => clearTimeout(t);
  }, [visible, file]);

  const handleGenerate = async () => {
    if (!file) return;
    setCreating(true);
    try {
      const res = await api.post<{ sharePath: string }>(`/drive/files/${file.id}/share-link`, {
        permission,
        expiresInDays: expiresInDays > 0 ? expiresInDays : null,
        password: password.trim() || undefined,
      });
      const fullUrl = `${apiOrigin()}${res.sharePath}`;
      setGeneratedUrl(fullUrl);
      toast("Tautan berbagi berhasil dibuat.", "success");
    } catch (e) {
      toast((e as Error).message || "Gagal membuat tautan berbagi.", "danger");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedUrl) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(generatedUrl);
        toast("Tautan disalin ke clipboard.", "success");
        return;
      }
      if (typeof document !== "undefined") {
        const ta = document.createElement("textarea");
        ta.value = generatedUrl;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        toast("Tautan disalin ke clipboard.", "success");
      }
    } catch {
      toast("Gagal menyalin tautan.", "danger");
    }
  };

  if (!visible || !file) return null;

  return (
    <Dialog open={visible} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md bg-card p-5 gap-4">
        <View className="flex-row items-center gap-2.5 border-b border-border pb-3 pr-8">
          <View className="rounded-xl p-2 bg-primary/10">
            <Share2 size={18} color={colors.primary} />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-base font-bold text-foreground">Bagikan Tautan Berkas</Text>
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {file.name}
            </Text>
          </View>
        </View>

        <View className="gap-3">
          <View className="gap-1.5">
            <Text className="text-xs font-semibold text-foreground">Izin Akses Tautan</Text>
            <View className="flex-row gap-2">
              {(["VIEW", "DOWNLOAD"] as const).map((p) => (
                <Pressable
                  key={p}
                  onPress={() => {
                    setPermission(p);
                    setGeneratedUrl(null);
                  }}
                  className={`flex-1 rounded-xl border px-3 py-2 items-center ${
                    permission === p ? "bg-primary/15 border-primary" : "bg-muted/15 border-border"
                  }`}
                >
                  <Text className={`text-xs font-semibold ${permission === p ? "text-primary" : "text-foreground"}`}>
                    {p === "VIEW" ? "Hanya Lihat (Pratinjau)" : "Boleh Unduh"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="gap-1.5">
            <Text className="text-xs font-semibold text-foreground">Masa Berlaku</Text>
            <View className="flex-row flex-wrap gap-1.5">
              {EXPIRY_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.days}
                  onPress={() => {
                    setExpiresInDays(opt.days);
                    setGeneratedUrl(null);
                  }}
                  className={`rounded-full px-3 py-1 border ${
                    expiresInDays === opt.days
                      ? "bg-primary border-primary"
                      : "bg-muted/15 border-border"
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      expiresInDays === opt.days ? "text-white" : "text-foreground"
                    }`}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="gap-1.5">
            <Text className="text-xs font-semibold text-foreground">Kata Sandi (Opsional)</Text>
            <Input
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                setGeneratedUrl(null);
              }}
              placeholder="Kosongkan jika tanpa kata sandi"
              secureTextEntry
            />
          </View>

          {generatedUrl && (
            <View className="rounded-xl border border-primary/30 bg-primary/5 p-3 gap-2">
              <View className="flex-row items-center gap-1.5">
                <Link2 size={14} color={colors.primary} />
                <Text className="text-xs font-bold text-primary">Tautan Siap Dibagikan</Text>
              </View>
              <Text className="text-[11px] font-mono text-foreground" selectable numberOfLines={2}>
                {generatedUrl}
              </Text>
              <Button
                size="sm"
                variant="outline"
                onPress={() => void handleCopy()}
                className="h-8 gap-1.5 self-start"
              >
                <Copy size={13} color={colors.primary} />
                <Text className="text-xs font-semibold text-primary">Salin Tautan</Text>
              </Button>
            </View>
          )}
        </View>

        <View className="flex-row justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onPress={onClose} disabled={creating}>
            <Text className="text-xs font-semibold">Tutup</Text>
          </Button>
          <Button
            size="sm"
            onPress={() => void handleGenerate()}
            disabled={creating}
            style={{ backgroundColor: colors.primary }}
          >
            <Text className="text-xs font-semibold text-white">
              {creating ? "Membuat..." : generatedUrl ? "Buat Ulang Tautan" : "Buat Tautan"}
            </Text>
          </Button>
        </View>
      </DialogContent>
    </Dialog>
  );
}
