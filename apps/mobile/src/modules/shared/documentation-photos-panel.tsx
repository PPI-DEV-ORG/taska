import * as React from "react";
import { View, Pressable, Linking, Image } from "react-native";
import { CheckCircle2, FileDown, Trash2 } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/taska/basics";
import { FileUploader } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { api, apiBase, uploadFile, downloadDocumentationPdf } from "@/services/api";
import { colors } from "@/tokens";

type DocPhotoItem = {
  id: number;
  fileId: number;
  caption?: string | null;
  url: string;
  originalName: string;
};

export function DocumentationPhotosPanel({
  kind,
  entityId,
  title,
  subtitle,
}: {
  kind: "survey" | "project" | "delivery-note";
  entityId: string | number;
  title: string;
  subtitle: string;
}) {
  const { toast } = useApp();
  const [photos, setPhotos] = React.useState<DocPhotoItem[]>([]);
  const [caption, setCaption] = React.useState("");
  const [pdfBusy, setPdfBusy] = React.useState(false);

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

  async function handleAttachPhoto(file: { name: string; blob?: Blob; uri?: string }) {
    try {
      const payload =
        file.blob ?? (file.uri ? { uri: file.uri, name: file.name, type: "image/jpeg" } : null);
      const category = kind === "delivery-note" ? "surat-jalan" : kind === "survey" ? "survey" : "dokumentasi-proyek";
      const fileId = await uploadFile(payload, "foto", category);
      if (!fileId) {
        toast("Gagal mengunggah foto ke server", "danger");
        return;
      }
      await api("POST", `/documentation/photos?kind=${kind}`, {
        entityId: Number(entityId),
        fileId,
        caption: caption.trim() || file.name,
      });
      setCaption("");
      await loadPhotos();
      toast("Foto dokumentasi berhasil dilampirkan");
    } catch (e: any) {
      toast(e?.message || "Gagal melampirkan foto dokumentasi", "danger");
    }
  }

  async function handleRemovePhoto(id: number) {
    try {
      await api("DELETE", `/documentation/photos/${id}`);
      await loadPhotos();
      toast("Foto dokumentasi dihapus");
    } catch (e: any) {
      toast(e?.message || "Gagal menghapus foto", "danger");
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

  return (
    <Panel
      title={title}
      subtitle={subtitle}
      right={
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
      }
    >
      <View className="gap-3">
        {photos.length === 0 ? (
          <Text className="text-xs text-muted-foreground py-1">
            Belum ada foto dokumentasi terlampir pada dokumen ini.
          </Text>
        ) : (
          <View className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {photos.map((p, idx) => (
              <View
                key={p.id}
                className="bg-panel border-border/80 rounded-xl border p-3 flex-col justify-between gap-2"
              >
                <View className="flex-row items-center justify-between gap-1.5">
                  <View className="flex-row items-center gap-1.5 flex-1">
                    <CheckCircle2 size={14} color={colors.primary} />
                    <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
                      Foto #{idx + 1}
                    </Text>
                  </View>
                  <Pressable onPress={() => handleRemovePhoto(p.id)} hitSlop={8}>
                    <Trash2 size={13} color={colors.danger} />
                  </Pressable>
                </View>

                {(() => {
                  const rawUrl = p.url || (p.fileId ? `/files/${p.fileId}` : "");
                  const photoUrl = rawUrl.startsWith("http")
                    ? rawUrl
                    : rawUrl.startsWith("/api")
                    ? `${apiBase()}${rawUrl.slice(4)}`
                    : `${apiBase()}${rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`}`;

                  if (!photoUrl) return null;

                  return (
                    <Pressable
                      onPress={() => Linking.openURL(photoUrl).catch(() => {})}
                      className="h-28 w-full bg-muted/30 rounded-lg overflow-hidden border border-border/40 items-center justify-center cursor-pointer active:opacity-75"
                    >
                      <Image
                        source={{ uri: photoUrl }}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode="cover"
                      />
                    </Pressable>
                  );
                })()}

                <View className="gap-0.5">
                  <Text className="text-[10px] text-muted-foreground uppercase font-semibold">Deskripsi / Keterangan:</Text>
                  <Text className="text-xs font-medium text-foreground leading-snug">
                    {p.caption || p.originalName}
                  </Text>
                  <Text className="text-[10px] text-muted-foreground font-mono mt-0.5" numberOfLines={1}>
                    File: {p.originalName}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View className="bg-panel/60 border-border/60 rounded-xl border p-3.5 gap-2.5 pt-3">
          <Text className="text-xs font-bold text-foreground">
            Unggah Dokumentasi (1 Foto & 1 Keterangan Deskripsi)
          </Text>
          <View className="gap-1">
            <Text className="text-[11px] text-muted-foreground">Keterangan / Deskripsi Foto Lapangan</Text>
            <Input
              value={caption}
              onChangeText={setCaption}
              placeholder="Contoh: Kondisi fisik plafon / Jalur kabel server..."
            />
          </View>
          <FileUploader
            label="Pilih Foto Dokumentasi Lapangan (PNG / JPG)"
            kind="foto"
            onFilePicked={handleAttachPhoto}
          />
        </View>
      </View>
    </Panel>
  );
}
