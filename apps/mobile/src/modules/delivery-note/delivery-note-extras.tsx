import * as React from "react";
import { View, Image, Pressable, Linking } from "react-native";
import { useRouter } from "expo-router";
import { CheckCircle2, Download, ExternalLink, Eye, FileText, Image as ImageIcon, Printer, ShoppingCart } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Panel } from "@/components/taska/basics";
import { FileUploader, type FileUploaderHandle } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { tanggal } from "@/lib/format";
import { apiBase } from "@/services/api";
import { type Row } from "@/constants/modules";
import { DocumentationPhotosPanel } from "@/modules/shared/documentation-photos-panel";
import { Line } from "@/modules/shared/line";
import { printOrderDocument } from "@/lib/order-print";

export function DeliveryNotesExtras({ row, onRefresh }: { row: Row; onRefresh?: () => Promise<void> | void }) {
  const router = useRouter();
  const { user, data, setStatus, patchRow, toast } = useApp();
  const [showAllItems, setShowAllItems] = React.useState(false);
  const [imgError, setImgError] = React.useState(false);
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
  const fileUploaderRef = React.useRef<FileUploaderHandle | null>(null);


  const poClientList = data["po-client"];
  const matchedSo = React.useMemo(() => {
    // Relasi lewat ID saja (dulu juga dicocokkan lewat teks alasan / proyek yang sama -> bisa salah SO).
    return (poClientList ?? []).find((so: Row) => row.clientPoId != null && String(so.id) === String(row.clientPoId));
  }, [poClientList, row.clientPoId]);

  const invoicesList = data["invoices"] || [];
  const matchedInvoice = React.useMemo(() => {
    return (invoicesList ?? []).find(
      (inv: Row) =>
        (row.invoiceId != null && String(inv.id) === String(row.invoiceId)) ||
        (!row.invoiceId && matchedSo?.id != null && String(inv.clientPoId) === String(matchedSo.id)),
    );
  }, [invoicesList, row.invoiceId, matchedSo]);

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
    let finalFid = handoverFileId;
    if (!finalFid && fileUploaderRef.current?.hasStaged()) {
      try {
        finalFid = await fileUploaderRef.current.flush();
      } catch {}
    }
    if (!finalFid && !row.scanFileId && !row.fileId && !row.signedFileId) {
      toast("Bukti tanda terima / scan surat jalan bertanda tangan wajib dilampirkan", "danger");
      return;
    }
    setSubmitting(true);
    try {
      const patchOk = await patchRow("delivery-notes", row.id, {
        penerimaNama: recipientName.trim(),
        penerimaKontak: recipientPhone.trim(),
        penerimaJabatan: recipientTitle.trim(),
        catatanSerahTerima: handoverNotes.trim(),
        tanggalDiterima: new Date().toISOString().slice(0, 10),
        status: "Diterima",
        ...(finalFid ? { scanFileId: finalFid, fileId: finalFid } : {}),
      });
      if (!patchOk) {
        return;
      }
      const statusOk = await setStatus("delivery-notes", row.id, "Diterima", undefined, finalFid ? { scanFileId: finalFid } : undefined);
      if (!statusOk) {
        return;
      }
      if (finalFid) {
        const matchedSo = (data["po-client"] ?? []).find(
          (so: Row) => row.clientPoId != null && String(so.id) === String(row.clientPoId),
        );
        if (matchedSo?.id) {
          await patchRow("po-client", matchedSo.id, { doFileId: finalFid }).catch(() => {});
        }
      }
      setHandoverOpen(false);
      setHandoverFileId(null);
      toast("Tanda terima & DO bertanda tangan kedua pihak berhasil disimpan");
      await onRefresh?.();
    } catch (err: any) {
      toast(err?.message || "Gagal mencatat tanda terima", "danger");
    } finally {
      setSubmitting(false);
    }
  }

  const hasGoods = row.withGoods !== undefined ? Boolean(row.withGoods) : (row.barang && row.barang !== "-");

  function handlePrintDo() {
    const printableItems =
      Array.isArray(row.items) && row.items.length > 0
        ? row.items.map((it: any) => ({
            name: it.product?.name || it.name || "Barang",
            qty: Number(it.qty) || 1,
            unit: it.product?.unit || it.unit || "Unit",
            sn: it.serials || undefined,
          }))
        : row.barang && row.barang !== "-"
          ? String(row.barang)
              .split(", ")
              .map((b: string) => ({ name: b, qty: 1, unit: "Unit" }))
          : [{ name: "Pengiriman Barang Operasional", qty: 1, unit: "Paket" }];

    printOrderDocument({
      docType: "DO",
      docNumber: row.nomor || `DO/${row.id}`,
      refNumber: row.alasan || undefined,
      date: row.tanggal,
      counterpartyLabel: "Tujuan / Penerima (Pelanggan)",
      counterpartyName: row.tujuan || "-",
      items: printableItems,
      notes: row.catatanSerahTerima || row.alasan || undefined,
      senderName: row.pembuat || "Gudang PT Samtek Mandiri",
      recipientName: row.penerimaNama || row.tujuan || "Penerima Barang",
    });
  }

  return (
    <>
      {matchedSo ? (
        <View className="p-3 bg-panel border border-border/80 rounded-xl flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2.5 flex-1 pr-2">
            <View className="size-8 rounded-lg bg-primary/10 items-center justify-center">
              <ShoppingCart size={16} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-bold text-foreground">
                Terkait Sales Order: {matchedSo.nomorSo || matchedSo.nomor || `SO #${matchedSo.id}`}
              </Text>
              <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                {matchedSo.customer || "Pelanggan"} · Nilai: Rp{(Number(matchedSo.nilai || matchedSo.amount || 0)).toLocaleString("id-ID")}
              </Text>
            </View>
          </View>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-3"
            onPress={() => router.push(`/po-client/${matchedSo.id}` as any)}
          >
            <Text className="text-xs">Buka SO</Text>
          </Button>
        </View>
      ) : null}

      {matchedInvoice ? (
        <View className="p-3 bg-panel border border-border/80 rounded-xl flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-2.5 flex-1 pr-2">
            <View className="size-8 rounded-lg bg-success/10 items-center justify-center">
              <FileText size={16} color={colors.success} />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-bold text-foreground">
                Terkait Invoice: {matchedInvoice.nomor || `INV #${matchedInvoice.id}`} ({matchedInvoice.status || "Status"})
              </Text>
              <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                {matchedInvoice.customer || "Customer"} · Total: Rp{(Number(matchedInvoice.total || matchedInvoice.nilai || 0)).toLocaleString("id-ID")}
              </Text>
            </View>
          </View>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-3"
            onPress={() => router.push(`/invoices/${matchedInvoice.id}` as any)}
          >
            <Text className="text-xs">Buka Invoice</Text>
          </Button>
        </View>
      ) : null}

      <Panel
        title="Barang yang Dibawa & Dokumen Delivery Order (DO)"
        subtitle={hasGoods ? "Surat jalan membawa barang fisik / unit ber-SN (Stok otomatis berkurang saat status Dikirim)" : "Surat jalan penugasan tanpa barang"}
        right={
          <View className="flex-row items-center gap-2 flex-wrap">
            {row.status !== "Dibatalkan" ? (
              <Button
                size="sm"
                variant="default"
                onPress={() => router.push(`/delivery-notes/new?id=${row.id}${matchedSo?.id ? `&soId=${matchedSo.id}` : ""}` as any)}
                className="flex-row items-center gap-1.5 bg-primary"
              >
                <Text className="text-xs text-primary-foreground font-semibold">Edit Surat Jalan & List Barang</Text>
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onPress={handlePrintDo}
              className="flex-row items-center gap-1"
            >
              <Printer size={13} color={colors.text} />
              <Text className="text-xs">Buat / Cetak PDF DO</Text>
            </Button>
            {(user?.role === "super_admin" || user?.role === "pm" || user?.role === "bos" || user?.role === "gudang" || user?.role === "finance" || user?.role === "procurement") && !isDelivered ? (
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
            ) : null}
          </View>
        }
      >
        {!hasGoods ? (
          <Text className="text-muted-foreground text-sm">Surat jalan ini untuk penugasan tanpa barang.</Text>
        ) : (
          <View className="gap-3">
            {Array.isArray(row.items) && row.items.length > 0 ? (
              <View className="gap-2">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Daftar Barang Surat Jalan ({row.items.length} item)
                  </Text>
                  {row.items.length > 10 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2"
                      onPress={() => setShowAllItems((v) => !v)}
                    >
                      <Text className="text-xs text-primary font-medium">
                        {showAllItems ? "Sembunyikan" : `Lihat Semua (${row.items.length})`}
                      </Text>
                    </Button>
                  )}
                </View>
                {(showAllItems ? row.items : row.items.slice(0, 10)).map((it: any, idx: number) => {
                  const prod = it.product;
                  const snText = Array.isArray(it.serials)
                    ? it.serials.filter(Boolean).join(", ")
                    : it.serials
                      ? String(it.serials).trim()
                      : "";
                  return (
                    <View
                      key={it.id ?? idx}
                      className="p-3 bg-panel/40 border border-border/70 rounded-xl flex-row items-center justify-between"
                    >
                      <View className="flex-1 pr-2">
                        <View className="flex-row items-center gap-2 flex-wrap">
                          <Text className="text-sm font-semibold text-foreground">
                            {prod?.name ?? it.name ?? it.note ?? "Barang"}
                          </Text>
                          {prod?.brand ? (
                            <View className="bg-panel border border-border/60 rounded px-1.5 py-0.5">
                              <Text className="text-[10px] font-medium text-muted-foreground">{prod.brand}</Text>
                            </View>
                          ) : null}
                          {snText ? (
                            <View className="bg-primary/10 border border-primary/30 rounded px-2 py-0.5">
                              <Text className="text-[11px] font-semibold text-primary">SN: {snText}</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text className="text-xs text-muted-foreground mt-0.5">
                          Tipe: {prod?.hasSerial ? "Lacak Serial Number (SN)" : "Barang Curah / Tanpa SN"}
                          {snText ? ` · Nomor Seri: ${snText}` : prod?.hasSerial ? " · Belum ada SN terinput" : ""}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-sm font-bold text-foreground">
                          {it.qty} {prod?.unit ?? "unit"}
                        </Text>
                      </View>
                    </View>
                  );
                })}
                {!showAllItems && row.items.length > 10 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-1 h-8"
                    onPress={() => setShowAllItems(true)}
                  >
                    <Text className="text-xs font-medium">
                      Lihat Semua ({row.items.length} barang)
                    </Text>
                  </Button>
                )}
              </View>
            ) : (
              <Line left={row.barang && row.barang !== "-" ? row.barang : "Membawa barang operasional"} sub="Daftar barang operasional surat jalan" />
            )}
          </View>
        )}
      </Panel>

      <Panel
        title="Laporan Hasil Kunjungan & Serah Terima Lapangan"
        subtitle="Dokumentasi penerimaan barang di lokasi klien beserta tanda tangan atau foto bukti."
        right={
          !isDelivered && (user!.role === "super_admin" || user!.role === "teknisi" || user!.role === "pm" || user!.role === "bos" || user!.role === "finance" || user!.role === "procurement") ? (
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

            {(row.scanFileId || row.fileId) ? (() => {
              const fileId = row.scanFileId || row.fileId;
              const scanFile = (row as any).scanFile;
              const mimeType = (row as any).scanFileMimeType || scanFile?.mimeType || "";
              const originalName = (row as any).scanFileName || scanFile?.originalName || "";
              const isPdf = mimeType === "application/pdf" || /\.pdf$/i.test(originalName);
              const isImage = !imgError && (mimeType.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(originalName) || (!isPdf && !mimeType));
              const displayName = originalName || (isPdf ? `surat-jalan-${row.nomor || row.id}.pdf` : `bukti-tanda-terima-${row.id}.jpg`);
              const fileUrl = `${apiBase()}/files/${fileId}`;

              const handleOpenFile = () => {
                if (typeof window !== "undefined") window.open(fileUrl, "_blank");
                else Linking.openURL(fileUrl).catch(() => {});
              };

              return (
                <View className="mt-2 pt-2.5 border-t border-success/20 gap-1.5">
                  <Text className="text-[11px] text-muted-foreground font-medium">Dokumen Bukti Tanda Terima / Scan Surat Jalan:</Text>
                  {isImage ? (
                    <View className="rounded-xl border border-border bg-panel overflow-hidden max-w-sm">
                      <Pressable onPress={() => setPreviewOpen(true)} className="relative group bg-muted/10 items-center justify-center">
                        <Image
                          source={{ uri: fileUrl }}
                          style={{ width: "100%", height: 160 }}
                          resizeMode="contain"
                          onError={() => setImgError(true)}
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
                            {displayName}
                          </Text>
                        </View>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2"
                          onPress={handleOpenFile}
                        >
                          <ExternalLink size={12} color={colors.textSecondary} className="mr-1" />
                          <Text className="text-[11px] text-muted-foreground">Buka</Text>
                        </Button>
                      </View>
                    </View>
                  ) : (
                    <View className="flex-row items-center justify-between p-3 rounded-xl border border-border bg-panel max-w-md">
                      <View className="flex-row items-center gap-3 flex-1 mr-3">
                        <View className="w-9 h-9 rounded-lg bg-primary/10 items-center justify-center shrink-0">
                          <FileText size={18} color={colors.primary} />
                        </View>
                        <View className="flex-1">
                          <Text className="text-xs font-medium text-foreground truncate" numberOfLines={1}>
                            {displayName}
                          </Text>
                          <Text className="text-[11px] text-muted-foreground mt-0.5">
                            Dokumen PDF Surat Jalan
                          </Text>
                        </View>
                      </View>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5"
                        onPress={handleOpenFile}
                      >
                        <ExternalLink size={12} color={colors.textSecondary} className="mr-1" />
                        <Text className="text-xs">Buka PDF</Text>
                      </Button>
                    </View>
                  )}
                </View>
              );
            })() : null}
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
              label="Upload DO / Surat Jalan yang Sudah Di-TTD Kedua Pihak (Wajib) *"
              kind="semua"
              accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp"
              allowedExtensions={["jpg", "jpeg", "png", "webp", "pdf"]}
              category="surat-jalan"
              handleRef={(h) => { fileUploaderRef.current = h; }}
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

      {row.scanFileId || row.fileId ? (() => {
        const fileId = row.scanFileId || row.fileId;
        const scanFile = (row as any).scanFile;
        const mimeType = (row as any).scanFileMimeType || scanFile?.mimeType || "";
        const originalName = (row as any).scanFileName || scanFile?.originalName || "";
        const isPdf = mimeType === "application/pdf" || /\.pdf$/i.test(originalName);
        const displayName = originalName || (isPdf ? `surat-jalan-${row.nomor || row.id}.pdf` : `bukti-tanda-terima-${row.id}.jpg`);
        const fileUrl = `${apiBase()}/files/${fileId}`;

        const handleOpenFile = () => {
          if (typeof window !== "undefined") window.open(fileUrl, "_blank");
          else Linking.openURL(fileUrl).catch(() => {});
        };

        return (
          <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogContent className="sm:max-w-2xl max-h-[92vh]">
              <DialogHeader>
                <DialogTitle>{isPdf ? "Dokumen Surat Jalan" : "Foto Bukti Serah Terima Lapangan"}</DialogTitle>
              </DialogHeader>
              <View className="items-center justify-center bg-black/5 rounded-xl overflow-hidden p-4 my-2">
                {isPdf ? (
                  <View className="items-center justify-center py-8 gap-3">
                    <FileText size={48} color={colors.primary} />
                    <Text className="text-sm font-semibold text-foreground text-center">{displayName}</Text>
                    <Text className="text-xs text-muted-foreground text-center">Format dokumen: PDF</Text>
                  </View>
                ) : (
                  <Image
                    source={{ uri: fileUrl }}
                    style={{ width: "100%", height: 380 }}
                    resizeMode="contain"
                  />
                )}
              </View>
              <DialogFooter className="flex-row items-center justify-between gap-2">
                <Text className="text-xs text-muted-foreground truncate flex-1" numberOfLines={1}>
                  {displayName}
                </Text>
                <Button
                  size="sm"
                  onPress={handleOpenFile}
                >
                  <Download size={14} color={colors.background} className="mr-1.5" />
                  <Text>{isPdf ? "Buka / Unduh PDF" : "Unduh / Buka File"}</Text>
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })() : null}
    </>
  );
}
