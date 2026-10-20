import * as React from "react";
import { View, Image, Pressable, Linking } from "react-native";
import { CheckCircle2, Download, ExternalLink, Eye, Image as ImageIcon } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Panel } from "@/components/taska/basics";
import { ScanInput } from "@/components/taska/scan-input";
import { FileUploader } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { tanggal } from "@/lib/format";
import { apiBase } from "@/services/api";
import { type Row } from "@/constants/modules";
import { DocumentationPhotosPanel } from "@/modules/shared/documentation-photos-panel";
import { Line } from "@/modules/shared/line";

export function DeliveryNotesExtras({ row, onRefresh }: { row: Row; onRefresh?: () => Promise<void> | void }) {
  const { user, setStatus, patchRow, toast } = useApp();
  const [handoverOpen, setHandoverOpen] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [recipientName, setRecipientName] = React.useState(row.penerimaNama || "");
  const [recipientPhone, setRecipientPhone] = React.useState(row.penerimaKontak || "");
  const [recipientTitle, setRecipientTitle] = React.useState(row.penerimaJabatan || "PIC Lapangan / Security");
  const [previousRecipient, setPreviousRecipient] = React.useState({
    name: row.penerimaNama,
    phone: row.penerimaKontak,
    title: row.penerimaJabatan,
  });
  const [handoverNotes, setHandoverNotes] = React.useState("");
  const [handoverFileId, setHandoverFileId] = React.useState<number | null>(null);

  if (
    previousRecipient.name !== row.penerimaNama ||
    previousRecipient.phone !== row.penerimaKontak ||
    previousRecipient.title !== row.penerimaJabatan
  ) {
    setPreviousRecipient({
      name: row.penerimaNama,
      phone: row.penerimaKontak,
      title: row.penerimaJabatan,
    });
    if (row.penerimaNama) setRecipientName(row.penerimaNama);
    if (row.penerimaKontak) setRecipientPhone(row.penerimaKontak);
    if (row.penerimaJabatan) setRecipientTitle(row.penerimaJabatan);
  }

  const isDelivered = row.status === "Diterima" || row.status === "DITERIMA" || Boolean(row.penerimaNama) || Boolean(row.tanggalDiterima);

  async function handleCompleteHandover() {
    if (!recipientName.trim()) {
      toast("Nama penerima lapangan wajib diisi", "danger");
      return;
    }
    setSubmitting(true);
    try {
      await patchRow("delivery-notes", row.id, {
        penerimaNama: recipientName.trim(),
        penerimaKontak: recipientPhone.trim(),
        penerimaJabatan: recipientTitle.trim(),
        catatanSerahTerima: handoverNotes.trim(),
        tanggalDiterima: new Date().toISOString().slice(0, 10),
        status: "Diterima",
        ...(handoverFileId ? { scanFileId: handoverFileId, fileId: handoverFileId } : {}),
      });
      await setStatus("delivery-notes", row.id, "Diterima");
      setHandoverOpen(false);
      setHandoverFileId(null);
      toast("Tanda terima lapangan berhasil dicatat. Status surat jalan kini 'Diterima'");
      await onRefresh?.();
    } catch (err: any) {
      toast(err?.message || "Gagal mencatat tanda terima", "danger");
    } finally {
      setSubmitting(false);
    }
  }

  const hasGoods = row.withGoods !== undefined ? Boolean(row.withGoods) : (row.barang && row.barang !== "-");

  return (
    <>
      <Panel
        title="Barang yang Dibawa"
        subtitle={hasGoods ? "Surat jalan membawa barang fisik / unit ber-SN" : "Surat jalan penugasan tanpa barang"}
        right={
          (user?.role === "super_admin" || user?.role === "pm" || user?.role === "bos" || user?.role === "gudang") && !isDelivered ? (
            <Button
              variant="outline"
              size="sm"
              onPress={() => {
                const next = !hasGoods;
                patchRow("delivery-notes", row.id, {
                  withGoods: next,
                  barang: next ? (row.barang && row.barang !== "-" ? row.barang : "Membawa barang operasional") : "-",
                });
                toast(`Surat jalan diubah menjadi ${next ? "Membawa Barang" : "Tanpa Barang"}`);
              }}
            >
              <Text className="text-xs">{hasGoods ? "Ubah ke Tanpa Barang" : "Ubah ke Bawa Barang"}</Text>
            </Button>
          ) : undefined
        }
      >
        {!hasGoods ? (
          <Text className="text-muted-foreground text-sm">Surat jalan ini untuk penugasan tanpa barang.</Text>
        ) : (
          <>
            <Line left={row.barang && row.barang !== "-" ? row.barang : "Membawa barang operasional"} sub="Barang ber-SN wajib di-scan sebelum berangkat" />
            {user!.role === "super_admin" || user!.role === "gudang" || user!.role === "bos" ? (
              <View className="mt-3"><ScanInput existing={Array.isArray(row.snList) ? row.snList : []} /></View>
            ) : null}
          </>
        )}
      </Panel>

      <Panel
        title="Laporan Hasil Kunjungan & Serah Terima Lapangan"
        subtitle="Dokumentasi penerimaan barang di lokasi klien beserta tanda tangan atau foto bukti."
        right={
          !isDelivered && (user!.role === "super_admin" || user!.role === "teknisi" || user!.role === "pm" || user!.role === "bos") ? (
            <Button size="sm" onPress={() => setHandoverOpen(true)} className="flex-row items-center gap-1">
              <CheckCircle2 size={14} color={colors.background} />
              <Text className="text-xs">Catat Tanda Terima</Text>
            </Button>
          ) : undefined
        }
      >
        {isDelivered ? (
          <View className="bg-success/10 border-success/30 rounded-xl border p-3.5 gap-2.5">
            <View className="flex-row items-center gap-2">
              <CheckCircle2 size={16} color={colors.success} />
              <Text className="text-xs font-semibold text-success">Barang Berhasil Diserahterimakan</Text>
            </View>
            <View className="gap-1 mt-1">
              <Text className="text-xs text-foreground font-medium">Penerima: {row.penerimaNama || "PIC Lapangan"}</Text>
              <Text className="text-[11px] text-muted-foreground">Jabatan / Kontak: {row.penerimaJabatan || "-"} ({row.penerimaKontak || "-"})</Text>
              <Text className="text-[11px] text-muted-foreground">Waktu Diterima: {tanggal(row.tanggalDiterima || row.tanggal)}</Text>
              {row.catatanSerahTerima ? (
                <Text className="text-xs text-foreground mt-1 bg-card p-2 rounded border border-border/50">
                  Catatan: {row.catatanSerahTerima}
                </Text>
              ) : null}
            </View>

            {(row.scanFileId || row.fileId) ? (
              <View className="mt-2 pt-2.5 border-t border-success/20 gap-1.5">
                <Text className="text-[11px] text-muted-foreground font-medium">Foto Bukti Tanda Terima / Scan Surat Jalan:</Text>
                <View className="rounded-xl border border-border bg-panel overflow-hidden max-w-sm">
                  <Pressable onPress={() => setPreviewOpen(true)} className="relative group bg-muted/10 items-center justify-center">
                    <Image
                      source={{ uri: `${apiBase}/files/${row.scanFileId || row.fileId}` }}
                      style={{ width: "100%", height: 160 }}
                      resizeMode="contain"
                    />
                    <View className="absolute inset-0 bg-black/0 hover:bg-black/10 items-center justify-center transition-colors">
                      <View className="bg-black/60 rounded-full px-2.5 py-1 flex-row items-center gap-1 opacity-90">
                        <Eye size={12} color="#ffffff" />
                        <Text className="text-white text-[11px] font-medium">Klik perbesar</Text>
                      </View>
                    </View>
                  </Pressable>
                  <View className="flex-row items-center justify-between px-3 py-1.5 border-t border-border bg-panel/90">
                    <View className="flex-row items-center gap-1.5 flex-1 mr-2">
                      <ImageIcon size={13} color={colors.primary} />
                      <Text className="text-xs text-foreground truncate" numberOfLines={1}>
                        bukti-tanda-terima-{row.id}.jpg
                      </Text>
                    </View>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2"
                      onPress={() => {
                        const url = `${apiBase}/files/${row.scanFileId || row.fileId}`;
                        if (typeof window !== "undefined") window.open(url, "_blank");
                        else Linking.openURL(url).catch(() => {});
                      }}
                    >
                      <ExternalLink size={12} color={colors.textSecondary} className="mr-1" />
                      <Text className="text-[11px] text-muted-foreground">Buka</Text>
                    </Button>
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        ) : (
          <View className="gap-2">
            <Text className="text-xs text-muted-foreground leading-relaxed">
              Surat jalan sedang dalam perjalanan menuju lokasi: <b>{row.tujuan}</b>.
              Setelah teknisi menyerahkan barang kepada pihak klien, catat tanda terima untuk menyelesaikan surat jalan.
            </Text>
          </View>
        )}
      </Panel>

      <DocumentationPhotosPanel
        kind="delivery-note"
        entityId={row.id}
        title="Foto Bukti Serah Terima & Dokumentasi Surat Jalan"
        subtitle="Lampirkan foto penerimaan barang di lokasi tujuan dan unduh PDF kompilasi resmi."
      />

      {/* Modal Catat Tanda Terima Lapangan */}
      <Dialog open={handoverOpen} onOpenChange={setHandoverOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Catat Tanda Terima Lapangan</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <View className="gap-1">
              <Text className="text-xs text-muted-foreground font-medium">Nama Penerima di Lokasi</Text>
              <Input
                value={recipientName}
                onChangeText={setRecipientName}
                placeholder="Contoh: Bpk. Bambang Hartono"
              />
            </View>
            <View className="gap-1">
              <Text className="text-xs text-muted-foreground font-medium">Jabatan / Peran</Text>
              <Input
                value={recipientTitle}
                onChangeText={setRecipientTitle}
                placeholder="Contoh: Building Manager / Kepala Cabang"
              />
            </View>
            <View className="gap-1">
              <Text className="text-xs text-muted-foreground font-medium">No. Telepon / WhatsApp</Text>
              <Input
                value={recipientPhone}
                onChangeText={setRecipientPhone}
                placeholder="Contoh: 0812-3456-7890"
              />
            </View>
            <View className="gap-1">
              <Text className="text-xs text-muted-foreground font-medium">Catatan Kondisi Barang Saat Tiba</Text>
              <Textarea
                value={handoverNotes}
                onChangeText={setHandoverNotes}
                placeholder="Contoh: Barang diterima lengkap, kardus segel utuh, dititipkan ke ruang IT..."
                numberOfLines={2}
              />
            </View>
            <FileUploader
              label="Upload Foto Bukti Serah Terima / TTD Surat Jalan"
              kind="foto"
              category="surat-jalan"
              autoFlush
              onUploaded={(id) => setHandoverFileId(id)}
            />
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setHandoverOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleCompleteHandover} disabled={submitting}>
              <Text>{submitting ? "Menyimpan..." : "Tandai Diterima"}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {row.scanFileId || row.fileId ? (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[92vh]">
            <DialogHeader>
              <DialogTitle>Foto Bukti Serah Terima Lapangan</DialogTitle>
            </DialogHeader>
            <View className="items-center justify-center bg-black/5 rounded-xl overflow-hidden p-1 my-2">
              <Image
                source={{ uri: `${apiBase}/files/${row.scanFileId || row.fileId}` }}
                style={{ width: "100%", height: 380 }}
                resizeMode="contain"
              />
            </View>
            <DialogFooter className="flex-row items-center justify-between gap-2">
              <Text className="text-xs text-muted-foreground truncate flex-1" numberOfLines={1}>
                bukti-tanda-terima-{row.id}.jpg
              </Text>
              <Button
                size="sm"
                onPress={() => {
                  const url = `${apiBase}/files/${row.scanFileId || row.fileId}`;
                  if (typeof window !== "undefined") window.open(url, "_blank");
                  else Linking.openURL(url).catch(() => {});
                }}
              >
                <Download size={14} color={colors.background} className="mr-1.5" />
                <Text>Unduh / Buka File</Text>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
