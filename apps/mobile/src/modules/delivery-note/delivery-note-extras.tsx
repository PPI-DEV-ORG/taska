import * as React from "react";
import { View } from "react-native";
import { CheckCircle2 } from "lucide-react-native";
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
import { type Row } from "@/constants/modules";
import { DocumentationPhotosPanel } from "@/modules/shared/documentation-photos-panel";
import { Line } from "@/modules/shared/line";

export function DeliveryNotesExtras({ row }: { row: Row }) {
  const { user, setStatus, patchRow, toast } = useApp();
  const [handoverOpen, setHandoverOpen] = React.useState(false);
  const [recipientName, setRecipientName] = React.useState(row.penerimaNama || "");
  const [recipientPhone, setRecipientPhone] = React.useState(row.penerimaKontak || "");
  const [recipientTitle, setRecipientTitle] = React.useState(row.penerimaJabatan || "PIC Lapangan / Security");
  const [handoverNotes, setHandoverNotes] = React.useState("");

  const isDelivered = row.status === "Diterima";

  function handleCompleteHandover() {
    if (!recipientName.trim()) {
      toast("Nama penerima lapangan wajib diisi", "danger");
      return;
    }
    patchRow("delivery-notes", row.id, {
      penerimaNama: recipientName.trim(),
      penerimaKontak: recipientPhone.trim(),
      penerimaJabatan: recipientTitle.trim(),
      catatanSerahTerima: handoverNotes.trim(),
      tanggalDiterima: new Date().toISOString().slice(0, 10),
      status: "Diterima",
    });
    setStatus("delivery-notes", row.id, "Diterima");
    setHandoverOpen(false);
    toast("Tanda terima lapangan berhasil dicatat. Status surat jalan kini 'Diterima'");
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
          <View className="bg-success/10 border-success/30 rounded-xl border p-3.5 gap-2">
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
            <FileUploader label="Upload Foto Bukti Serah Terima / TTD Surat Jalan" kind="foto" category="surat-jalan" autoFlush />
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setHandoverOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleCompleteHandover}>
              <Text>Tandai Diterima</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
