import * as React from "react";
import { View, Pressable, Linking, Image, Platform, ScrollView } from "react-native";
import {
  CheckCircle2,
  FileDown,
  Trash2,
  Upload,
  FileText,
  Camera,
  Eye,
  ExternalLink,
  X,
  Plus,
  Image as ImageIcon,
  Check,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/akuntra/basics";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WebCameraModal } from "@/components/akuntra/camera-capture-modal";
import { useApp } from "@/store/app-store";
import { api, apiBase, uploadFile, downloadDocumentationPdf } from "@/services/api";
import { colors } from "@/tokens";

export type DocPhotoItem = {
  id: number;
  fileId: number;
  caption?: string | null;
  url: string;
  originalName: string;
  mimeType?: string;
  size?: number;
  createdAt?: string;
};

type StagedItem = {
  id: string;
  name: string;
  size?: number;
  blob?: Blob;
  uri?: string;
  isPdf: boolean;
  previewUri?: string;
  caption: string;
};

function formatBytes(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPdf(item: { mimeType?: string; originalName?: string; name?: string }): boolean {
  if (item.mimeType === "application/pdf") return true;
  const name = (item.originalName || item.name || "").toLowerCase();
  return name.endsWith(".pdf");
}

export function DocumentationPhotosPanel({
  kind,
  entityId,
  title,
  subtitle,
}: {
  kind: "survey" | "project" | "delivery-note" | "poc" | "visit" | "maintenance";
  entityId: string | number;
  title: string;
  subtitle?: string;
}) {
  const { toast } = useApp();
  const [photos, setPhotos] = React.useState<DocPhotoItem[]>([]);
  const [pdfBusy, setPdfBusy] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"all" | "photo" | "pdf">("all");

  // Staged files for batch upload
  const [stagedItems, setStagedItems] = React.useState<StagedItem[]>([]);
  const [commonCaption, setCommonCaption] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState("");

  // Preview dialog for images
  const [previewPhoto, setPreviewPhoto] = React.useState<DocPhotoItem | null>(null);
  const [webCameraOpen, setWebCameraOpen] = React.useState(false);

  const web = Platform.OS === "web";
  const fileInputImagesRef = React.useRef<HTMLInputElement | null>(null);
  const fileInputPdfsRef = React.useRef<HTMLInputElement | null>(null);

  const category =
    kind === "delivery-note"
      ? "surat-jalan"
      : kind === "survey"
      ? "survey"
      : kind === "poc"
      ? "poc-dokumen"
      : kind === "visit"
      ? "visit-dokumen"
      : kind === "maintenance"
      ? "maintenance-dokumen"
      : "dokumentasi-proyek";

  const loadPhotos = React.useCallback(async () => {
    try {
      const res = await api<{ items: DocPhotoItem[] }>(
        "GET",
        `/documentation/photos?kind=${kind}&entityId=${entityId}`,
      );
      if (Array.isArray(res?.items)) {
        setPhotos(res.items);
      }
    } catch {}
  }, [kind, entityId]);

  React.useEffect(() => {
    let active = true;
    api<{ items: DocPhotoItem[] }>(
      "GET",
      `/documentation/photos?kind=${kind}&entityId=${entityId}`,
    )
      .then((res) => {
        if (active && Array.isArray(res?.items)) {
          setPhotos(res.items);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [kind, entityId]);

  // Clean up object URLs when unmounting
  React.useEffect(() => {
    return () => {
      stagedItems.forEach((it) => {
        if (it.previewUri && it.previewUri.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(it.previewUri);
          } catch {}
        }
      });
    };
  }, [stagedItems]);

  function addWebFiles(fileList: File[]) {
    const newItems: StagedItem[] = [];
    for (const f of fileList) {
      const ext = (f.name.split(".").pop() || "").toLowerCase();
      const pdf = ext === "pdf" || f.type === "application/pdf";
      const isImg = ["png", "jpg", "jpeg", "webp", "gif", "heic"].includes(ext) || f.type.startsWith("image/");

      if (!pdf && !isImg) {
        toast(`File "${f.name}" bukan format gambar atau PDF yang didukung.`, "danger");
        continue;
      }

      let previewUri: string | undefined;
      if (isImg && typeof URL !== "undefined" && URL.createObjectURL) {
        try {
          previewUri = URL.createObjectURL(f);
        } catch {}
      }

      newItems.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: f.name,
        size: f.size,
        blob: f,
        isPdf: pdf,
        previewUri,
        caption: "",
      });
    }

    if (newItems.length > 0) {
      setStagedItems((prev) => [...prev, ...newItems]);
      toast(`${newItems.length} berkas siap diunggah. Silakan beri keterangan jika diperlukan.`);
    }
  }

  async function pickNativeImages() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast("Izin akses galeri diperlukan untuk memilih foto", "danger");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (result.canceled) return;

    const newItems: StagedItem[] = result.assets.map((asset) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: asset.fileName || asset.uri.split("/").pop() || "foto.jpg",
      size: asset.fileSize,
      uri: asset.uri,
      previewUri: asset.uri,
      isPdf: false,
      caption: "",
    }));

    if (newItems.length > 0) {
      setStagedItems((prev) => [...prev, ...newItems]);
      toast(`${newItems.length} foto siap diunggah.`);
    }
  }

  async function captureNativeCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      toast("Izin kamera diperlukan untuk mengambil foto", "danger");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const newItem: StagedItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: asset.fileName || `Kamera_${Date.now()}.jpg`,
      size: asset.fileSize,
      uri: asset.uri,
      previewUri: asset.uri,
      isPdf: false,
      caption: "",
    };
    setStagedItems((prev) => [...prev, newItem]);
  }

  function removeStagedItem(id: string) {
    setStagedItems((prev) => {
      const target = prev.find((it) => it.id === id);
      if (target?.previewUri && target.previewUri.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(target.previewUri);
        } catch {}
      }
      return prev.filter((it) => it.id !== id);
    });
  }

  function clearAllStaged() {
    stagedItems.forEach((it) => {
      if (it.previewUri && it.previewUri.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(it.previewUri);
        } catch {}
      }
    });
    setStagedItems([]);
    setCommonCaption("");
  }

  async function handleUploadAll() {
    if (stagedItems.length === 0) return;
    setUploading(true);
    let successCount = 0;
    const attachedItems: Array<{ fileId: number; caption?: string }> = [];

    try {
      for (const [i, item] of stagedItems.entries()) {
        setUploadProgress(`Mengunggah berkas ${i + 1} dari ${stagedItems.length}... (${item.name})`);
        const payload = item.blob ?? (item.uri ? { uri: item.uri, name: item.name, type: item.isPdf ? "application/pdf" : "image/jpeg" } : null);
        const fileKind = item.isPdf ? "dokumen" : "foto";
        const fileId = await uploadFile(payload, fileKind, category);
        if (fileId) {
          attachedItems.push({
            fileId,
            caption: item.caption.trim() || commonCaption.trim() || item.name,
          });
          successCount++;
        }
      }

      if (attachedItems.length > 0) {
        setUploadProgress("Melampirkan berkas ke laporan...");
        await api("POST", `/documentation/photos?kind=${kind}`, {
          entityId: Number(entityId),
          items: attachedItems,
        });
        toast(`${successCount} berkas barang bukti berhasil disimpan`, "success");
        clearAllStaged();
        await loadPhotos();
      }
    } catch (e: any) {
      toast(e?.message || "Gagal mengunggah berkas barang bukti", "danger");
    } finally {
      setUploading(false);
      setUploadProgress("");
    }
  }

  async function handleRemovePhoto(id: number) {
    try {
      await api("DELETE", `/documentation/photos/${id}`);
      await loadPhotos();
      toast("Berkas barang bukti dihapus");
    } catch (e: any) {
      toast(e?.message || "Gagal menghapus berkas", "danger");
    }
  }

  async function handleDownloadPdf() {
    setPdfBusy(true);
    try {
      const ok = await downloadDocumentationPdf(kind, entityId);
      if (ok) {
        toast("PDF kompilasi dokumentasi berhasil diunduh");
      } else {
        toast("Gagal mengunduh PDF kompilasi", "danger");
      }
    } catch (e: any) {
      toast(e?.message || "Gagal mengunduh PDF kompilasi", "danger");
    } finally {
      setPdfBusy(false);
    }
  }

  function resolveFileUrl(p: DocPhotoItem) {
    const rawUrl = p.url || (p.fileId ? `/files/${p.fileId}` : "");
    return rawUrl.startsWith("http")
      ? rawUrl
      : rawUrl.startsWith("/api")
      ? `${apiBase()}${rawUrl.slice(4)}`
      : `${apiBase()}${rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`}`;
  }

  const pdfCount = photos.filter(isPdf).length;
  const photoCount = photos.length - pdfCount;

  const filteredPhotos = React.useMemo(() => {
    if (activeTab === "photo") return photos.filter((p) => !isPdf(p));
    if (activeTab === "pdf") return photos.filter(isPdf);
    return photos;
  }, [photos, activeTab]);

  return (
    <Panel
      title={title}
      subtitle={subtitle || "Unggah multiple foto kegiatan lapangan dan dokumen bukti PDF (BAST, scan tanda tangan)"}
      right={
        <View className="flex-row items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onPress={handleDownloadPdf}
            disabled={pdfBusy}
            className="flex-row items-center gap-1.5"
          >
            <FileDown size={14} color={colors.text} />
            <Text className="text-xs">{pdfBusy ? "Membuat PDF..." : "Unduh PDF Kompilasi"}</Text>
          </Button>
        </View>
      }
    >
      <View className="gap-4">
        {/* Filter Bar */}
        {photos.length > 0 ? (
          <View className="flex-row flex-wrap items-center gap-2 border-b border-border/50 pb-2.5">
            <Pressable
              onPress={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex-row items-center gap-1.5 border ${
                activeTab === "all"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-panel text-muted-foreground border-border/60 hover:bg-panel/80"
              }`}
            >
              <Text className={`text-xs font-semibold ${activeTab === "all" ? "text-white" : "text-foreground"}`}>
                Semua Bukti ({photos.length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("photo")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex-row items-center gap-1.5 border ${
                activeTab === "photo"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-panel text-muted-foreground border-border/60 hover:bg-panel/80"
              }`}
            >
              <ImageIcon size={13} color={activeTab === "photo" ? "#fff" : colors.primary} />
              <Text className={`text-xs font-semibold ${activeTab === "photo" ? "text-white" : "text-foreground"}`}>
                Foto ({photoCount})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("pdf")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex-row items-center gap-1.5 border ${
                activeTab === "pdf"
                  ? "bg-danger text-white border-danger"
                  : "bg-panel text-muted-foreground border-border/60 hover:bg-panel/80"
              }`}
            >
              <FileText size={13} color={activeTab === "pdf" ? "#fff" : colors.danger} />
              <Text className={`text-xs font-semibold ${activeTab === "pdf" ? "text-white" : "text-foreground"}`}>
                Dokumen PDF ({pdfCount})
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Gallery / List of Attached Evidence */}
        {filteredPhotos.length === 0 ? (
          <View className="py-2">
            <Text className="text-xs text-muted-foreground">
              {photos.length === 0
                ? "Belum ada berkas dokumentasi atau barang bukti terlampir. Pilih multiple foto atau dokumen PDF di bawah."
                : "Tidak ada berkas yang sesuai dengan filter."}
            </Text>
          </View>
        ) : (
          <View className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredPhotos.map((p, idx) => {
              const itemIsPdf = isPdf(p);
              const fileUrl = resolveFileUrl(p);

              if (itemIsPdf) {
                return (
                  <View
                    key={p.id}
                    className="bg-panel border-border/80 rounded-xl border p-3 flex-col justify-between gap-2.5 shadow-sm"
                  >
                    <View className="flex-row items-center justify-between gap-1.5">
                      <View className="flex-row items-center gap-1.5 flex-1 min-w-0">
                        <View className="size-6 rounded bg-danger/15 items-center justify-center">
                          <FileText size={13} color={colors.danger} />
                        </View>
                        <Text className="text-xs font-bold text-foreground" numberOfLines={1}>
                          Dokumen PDF #{idx + 1}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => handleRemovePhoto(p.id)}
                        hitSlop={8}
                        className="hover:opacity-70 p-1"
                      >
                        <Trash2 size={13} color={colors.danger} />
                      </Pressable>
                    </View>

                    <Pressable
                      onPress={() => Linking.openURL(fileUrl).catch(() => {})}
                      className="bg-card/70 border border-border/60 rounded-lg p-3 flex-col items-center justify-center gap-1.5 cursor-pointer hover:bg-card active:opacity-80"
                    >
                      <View className="size-11 rounded-full bg-danger/10 items-center justify-center">
                        <FileText size={22} color={colors.danger} />
                      </View>
                      <Text className="text-xs font-semibold text-foreground text-center" numberOfLines={2}>
                        {p.originalName}
                      </Text>
                      <Text className="text-[11px] text-muted-foreground font-mono">
                        {formatBytes(p.size) || "PDF Dokumen"}
                      </Text>
                      <View className="mt-1 flex-row items-center gap-1 bg-primary/10 px-2 py-0.5 rounded">
                        <ExternalLink size={11} color={colors.primary} />
                        <Text className="text-[10px] font-semibold text-primary">Buka / Unduh PDF</Text>
                      </View>
                    </Pressable>

                    <View className="gap-0.5">
                      <Text className="text-[10px] text-muted-foreground uppercase font-semibold">Keterangan Dokumen:</Text>
                      <Text className="text-xs font-medium text-foreground leading-snug">
                        {p.caption || p.originalName}
                      </Text>
                    </View>
                  </View>
                );
              }

              return (
                <View
                  key={p.id}
                  className="bg-panel border-border/80 rounded-xl border p-3 flex-col justify-between gap-2 shadow-sm"
                >
                  <View className="flex-row items-center justify-between gap-1.5">
                    <View className="flex-row items-center gap-1.5 flex-1 min-w-0">
                      <CheckCircle2 size={14} color={colors.primary} />
                      <Text className="text-xs font-bold text-foreground" numberOfLines={1}>
                        Foto #{idx + 1}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => handleRemovePhoto(p.id)}
                      hitSlop={8}
                      className="hover:opacity-70 p-1"
                    >
                      <Trash2 size={13} color={colors.danger} />
                    </Pressable>
                  </View>

                  <Pressable
                    onPress={() => setPreviewPhoto(p)}
                    className="h-32 w-full bg-muted/30 rounded-lg overflow-hidden border border-border/40 items-center justify-center cursor-pointer active:opacity-75 relative group"
                  >
                    <Image
                      source={{ uri: fileUrl }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                    <View className="absolute bottom-1 right-1 bg-black/60 px-1.5 py-0.5 rounded flex-row items-center gap-1">
                      <Eye size={10} color="#fff" />
                      <Text className="text-[9px] text-white font-medium">Lihat</Text>
                    </View>
                  </Pressable>

                  <View className="gap-0.5">
                    <Text className="text-[10px] text-muted-foreground uppercase font-semibold">Deskripsi / Keterangan:</Text>
                    <Text className="text-xs font-medium text-foreground leading-snug">
                      {p.caption || p.originalName}
                    </Text>
                    <Text className="text-[10px] text-muted-foreground font-mono mt-0.5" numberOfLines={1}>
                      {p.originalName} {p.size ? `· ${formatBytes(p.size)}` : ""}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Staged Files Queue (Multiple Selection Preview & Captions) ── */}
        {stagedItems.length > 0 ? (
          <View className="bg-primary/5 border-primary/30 rounded-xl border p-4 gap-3">
            <View className="flex-row items-center justify-between flex-wrap gap-2">
              <View className="flex-row items-center gap-2">
                <View className="size-6 rounded-full bg-primary items-center justify-center">
                  <Text className="text-white text-xs font-bold">{stagedItems.length}</Text>
                </View>
                <Text className="text-sm font-bold text-foreground">
                  Berkas Siap Diunggah ({stagedItems.filter((i) => !i.isPdf).length} Foto, {stagedItems.filter((i) => i.isPdf).length} PDF)
                </Text>
              </View>

              <View className="flex-row items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onPress={clearAllStaged}
                  disabled={uploading}
                >
                  <Text className="text-xs">Batal Semua</Text>
                </Button>
                <Button
                  size="sm"
                  onPress={handleUploadAll}
                  disabled={uploading}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Upload size={14} color="#fff" className="mr-1.5" />
                  <Text className="text-xs text-white font-semibold">
                    {uploading ? (uploadProgress || "Mengunggah...") : `Unggah ${stagedItems.length} Berkas Sekarang`}
                  </Text>
                </Button>
              </View>
            </View>

            {/* Common caption field */}
            <View className="gap-1 bg-card/60 p-2.5 rounded-lg border border-border/50">
              <Text className="text-xs font-semibold text-foreground">
                Keterangan Bersama (Opsional)
              </Text>
              <Input
                value={commonCaption}
                onChangeText={setCommonCaption}
                placeholder="Contoh: Dokumentasi kegiatan pengujian teknis lapangan"
                editable={!uploading}
                className="bg-background text-xs"
              />
              <Text className="text-[11px] text-muted-foreground">
                Keterangan ini otomatis digunakan untuk berkas yang keterangan khususnya dikosongkan.
              </Text>
            </View>

            {/* List of staged files with thumbnail & custom captions */}
            <View className="gap-2 max-h-80 overflow-y-auto pr-1">
              {stagedItems.map((item, i) => (
                <View
                  key={item.id}
                  className="bg-card border-border/80 rounded-lg border p-2.5 flex-row items-center gap-3"
                >
                  {item.isPdf ? (
                    <View className="size-12 rounded-lg bg-danger/10 border border-danger/30 items-center justify-center shrink-0">
                      <FileText size={20} color={colors.danger} />
                      <Text className="text-[9px] font-bold text-danger">PDF</Text>
                    </View>
                  ) : item.previewUri ? (
                    <View className="size-12 rounded-lg overflow-hidden border border-border/60 shrink-0 bg-muted/40">
                      <Image
                        source={{ uri: item.previewUri }}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode="cover"
                      />
                    </View>
                  ) : (
                    <View className="size-12 rounded-lg bg-primary/10 items-center justify-center shrink-0">
                      <ImageIcon size={20} color={colors.primary} />
                    </View>
                  )}

                  <View className="flex-1 min-w-0 gap-1">
                    <View className="flex-row items-center justify-between gap-1">
                      <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
                        #{i + 1}. {item.name}
                      </Text>
                      <Text className="text-[10px] text-muted-foreground shrink-0 font-mono">
                        {formatBytes(item.size)}
                      </Text>
                    </View>

                    <Input
                      value={item.caption}
                      onChangeText={(val) => {
                        setStagedItems((prev) =>
                          prev.map((it) => (it.id === item.id ? { ...it, caption: val } : it)),
                        );
                      }}
                      placeholder={item.isPdf ? "Keterangan dokumen ini (mis. BAST, Berita Acara)..." : "Keterangan foto ini..."}
                      editable={!uploading}
                      className="h-8 py-1 px-2.5 text-xs bg-background"
                    />
                  </View>

                  <Pressable
                    onPress={() => removeStagedItem(item.id)}
                    disabled={uploading}
                    hitSlop={8}
                    className="size-8 items-center justify-center rounded-lg hover:bg-danger/10"
                  >
                    <Trash2 size={14} color={colors.danger} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* ── Upload Area (Multiple Images & PDF) ── */}
        <View className="bg-panel/70 border-border/70 rounded-xl border p-4 gap-3 overflow-hidden">
          <View className="flex-col gap-2.5 w-full">
            <View className="w-full gap-0.5">
              <Text className="text-xs font-bold text-foreground">
                Tambah Barang Bukti (Foto & Dokumen PDF)
              </Text>
              <Text className="text-[11px] text-muted-foreground leading-relaxed">
                Pilih beberapa foto sekaligus atau upload scan dokumen PDF (BAST / berita acara).
              </Text>
            </View>

            {/* Hidden web file inputs */}
            {web ? (
              <>
                <input
                  ref={fileInputImagesRef}
                  type="file"
                  multiple
                  accept="image/*,.png,.jpg,.jpeg,.webp,.heic,.heif"
                  onChange={(e) => {
                    const list = e.target.files;
                    if (list?.length) addWebFiles(Array.from(list));
                    e.target.value = "";
                  }}
                  className="hidden"
                />
                <input
                  ref={fileInputPdfsRef}
                  type="file"
                  multiple
                  accept="application/pdf,.pdf"
                  onChange={(e) => {
                    const list = e.target.files;
                    if (list?.length) addWebFiles(Array.from(list));
                    e.target.value = "";
                  }}
                  className="hidden"
                />
              </>
            ) : null}

            {/* Quick Picker Buttons */}
            <View className="flex-row flex-wrap items-center gap-2 w-full">
              {web ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => setWebCameraOpen(true)}
                    className="flex-row items-center gap-1.5 border-primary/40 bg-primary/5 hover:bg-primary/10"
                  >
                    <Camera size={14} color={colors.primary} />
                    <Text className="text-xs font-semibold text-primary">Ambil Foto (Kamera)</Text>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => fileInputImagesRef.current?.click()}
                    className="flex-row items-center gap-1.5"
                  >
                    <ImageIcon size={14} color={colors.text} />
                    <Text className="text-xs font-semibold">Pilih dari Galeri</Text>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => fileInputPdfsRef.current?.click()}
                    className="flex-row items-center gap-1.5 border-danger/40 bg-danger/5 hover:bg-danger/10"
                  >
                    <FileText size={14} color={colors.danger} />
                    <Text className="text-xs font-semibold text-danger">Upload PDF Bukti</Text>
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={pickNativeImages}
                    className="flex-row items-center gap-1.5 border-primary/40 bg-primary/5"
                  >
                    <ImageIcon size={14} color={colors.primary} />
                    <Text className="text-xs font-semibold text-primary">Pilih Banyak Foto</Text>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onPress={captureNativeCamera}
                    className="flex-row items-center gap-1.5"
                  >
                    <Camera size={14} color={colors.text} />
                    <Text className="text-xs">Ambil Kamera</Text>
                  </Button>
                </>
              )}
            </View>
          </View>

          {/* Web Drag & Drop Dropzone */}
          {web ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const list = e.dataTransfer?.files;
                if (list?.length) addWebFiles(Array.from(list));
              }}
              onClick={() => fileInputImagesRef.current?.click()}
              className="border-border/80 bg-background/50 hover:bg-background/80 items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 cursor-pointer transition-colors"
            >
              <View className="size-10 rounded-full bg-primary/10 items-center justify-center">
                <Upload size={20} color={colors.primary} />
              </View>
              <View className="items-center gap-1">
                <Text className="text-sm font-semibold text-foreground text-center">
                  Tarik berkas foto atau dokumen PDF ke sini, atau klik untuk memilih
                </Text>
                <Text className="text-xs text-muted-foreground text-center">
                  Mendukung pemilihan banyak foto sekaligus (PNG, JPG, WEBP) & Dokumen PDF (hingga 15 MB)
                </Text>
              </View>
            </div>
          ) : null}
        </View>
      </View>

      {/* ── Modal Kamera Langsung (Web) ── */}
      <WebCameraModal
        visible={webCameraOpen}
        onClose={() => setWebCameraOpen(false)}
        onCapture={(photo) => {
          if (photo.blob) addWebFiles([photo.blob]);
        }}
      />

      {/* ── Dialog Preview Foto Penuh ── */}
      <Dialog open={!!previewPhoto} onOpenChange={(op) => { if (!op) setPreviewPhoto(null); }}>
        <DialogContent className="max-w-2xl p-4 gap-3">
          <DialogHeader>
            <DialogTitle>{previewPhoto?.caption || previewPhoto?.originalName || "Pratinjau Foto Dokumentasi"}</DialogTitle>
          </DialogHeader>

          {previewPhoto ? (
            <View className="gap-3">
              <View className="w-full h-80 sm:h-96 bg-black/5 rounded-xl overflow-hidden border border-border/60 items-center justify-center">
                <Image
                  source={{ uri: resolveFileUrl(previewPhoto) }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="contain"
                />
              </View>

              <View className="flex-row items-center justify-between gap-2 border-t border-border/50 pt-2">
                <View className="flex-1 min-w-0">
                  <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
                    {previewPhoto.originalName}
                  </Text>
                  {previewPhoto.caption ? (
                    <Text className="text-xs text-muted-foreground mt-0.5">
                      {previewPhoto.caption}
                    </Text>
                  ) : null}
                </View>

                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => Linking.openURL(resolveFileUrl(previewPhoto)).catch(() => {})}
                  className="flex-row items-center gap-1.5"
                >
                  <ExternalLink size={13} color={colors.text} />
                  <Text className="text-xs">Buka Resolusi Penuh</Text>
                </Button>
              </View>
            </View>
          ) : null}
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
