import * as React from "react";
import { View, Image, Pressable, Linking } from "react-native";
import { useRouter } from "expo-router";
import { Check, CheckCircle2, Download, ExternalLink, Eye, FileText, Image as ImageIcon, MapPin, Printer, ShoppingCart, Truck, UserCheck, Warehouse } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Panel } from "@/components/akuntra/basics";
import { FileUploader, type FileUploaderHandle } from "@/components/akuntra/file-uploader";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { tanggal } from "@/lib/format";
import { apiBase, openDeliveryNotePdf } from "@/services/api";
import { type Row } from "@/constants/modules";
import { DocumentationPhotosPanel } from "@/modules/shared/documentation-photos-panel";
import { printOrderDocument } from "@/lib/order-print";
import { SenderFields, parseSender, senderPayload, validateSender, type SenderValue } from "./delivery-signers-form";

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
  const [senderVal, setSenderVal] = React.useState<SenderValue | null>(null);
  const [savingSender, setSavingSender] = React.useState(false);
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
        ? Object.values(
            // Diringkas per barang, tanpa rincian SN
            row.items.reduce((acc: Record<string, { name: string; qty: number; unit: string }>, it: any) => {
              const name = it.product?.name || it.name || it.note || "Barang";
              const g = acc[name] ?? { name, qty: 0, unit: it.product?.unit || it.unit || "Unit" };
              g.qty += Number(it.qty) || 1;
              acc[name] = g;
              return acc;
            }, {}),
          )
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

  const status = String(row.status || "Menunggu pengiriman");
  const cancelled = status === "Dibatalkan";
  const FLOW = ["Menunggu pengiriman", "Dikirim", "Diterima"] as const;
  const FLOW_LABEL = ["Disiapkan", "Dikirim", "Diterima"];
  const stepIdx = isDelivered ? 2 : Math.max(0, FLOW.indexOf(status as (typeof FLOW)[number]));
  const isMeRecipient = row.penerimaId != null && String(row.penerimaId) === String(user?.id);
  const canHandover =
    !isDelivered &&
    !cancelled &&
    (isMeRecipient || ["super_admin", "teknisi", "pm", "bos", "finance", "procurement", "admin", "gudang"].includes(String(user?.role)));
  const items: any[] = Array.isArray(row.items) ? row.items : [];
  const totalQty = items.reduce((a, it) => a + (Number(it.qty) || 0), 0);
  const nextHint = cancelled
    ? "Surat jalan dibatalkan."
    : isDelivered
    ? `Barang sudah diterima${row.penerimaNama ? ` oleh ${row.penerimaNama}` : ""}.`
    : status === "Dikirim"
    ? `Barang dalam perjalanan. ${row.penerimaNama || "Penerima"} menerima di lokasi lalu catat tanda terima + foto surat jalan yang sudah di-TTD.`
    : hasGoods
    ? "Gudang menyiapkan barang & SN, cetak surat jalan, lalu berangkat."
    : "Cetak surat jalan, lalu berangkat.";

  async function handlePrint(mode: "print" | "download") {
    const ok = await openDeliveryNotePdf(row.id, row.nomor, mode);
    if (!ok) {
      toast("PDF server tidak tersedia — memakai cetak cepat", "danger");
      handlePrintDo();
    }
  }

  const externalSender = !!row.pengirimEkspedisi && !row.pengirimId;
  const senderKind = externalSender ? (/gosend|gojek|grab|maxim|lalamove|spx|shopee/i.test(String(row.pengirimEkspedisi)) ? "Ojol" : "Ekspedisi") : "";

  async function saveSender() {
    if (!senderVal) return;
    const err = validateSender(senderVal);
    if (err) return toast(err, "danger");
    setSavingSender(true);
    try {
      const ok = await patchRow("delivery-notes", row.id, senderPayload(senderVal));
      if (ok) {
        toast("Pengirim diperbarui");
        setSenderVal(null);
        await onRefresh?.();
      }
    } finally {
      setSavingSender(false);
    }
  }

  const info: { icon: any; label: string; value: string; sub?: string; onEdit?: () => void }[] = [
    { icon: MapPin, label: "Kirim ke", value: row.tujuan || "-", sub: [row.project && row.project !== "-" ? `Proyek ${row.project}` : "", row.alasan].filter(Boolean).join(" · ") },
    {
      icon: UserCheck,
      label: "Diterima oleh",
      value: row.penerimaNama || "Belum ditentukan",
      sub: [row.penerimaJabatan, row.penerimaKontak].filter(Boolean).join(" · "),
    },
    {
      icon: Truck,
      label: "Dikirim oleh",
      value: row.pengirim || row.pembuat || "-",
      sub: [senderKind, row.kendaraan ? `${senderKind === "Ekspedisi" ? "Resi / plat" : "Plat"} ${row.kendaraan}` : ""].filter(Boolean).join(" · "),
      onEdit: cancelled ? undefined : () => setSenderVal(parseSender(row, null)),
    },
    { icon: Warehouse, label: "Dikeluarkan oleh", value: row.petugasGudang || "Petugas gudang (belum)", sub: row.gudang || "" },
  ];

  return (
    <>
      {/* Ringkasan + langkah berikutnya */}
      <Panel>
        <View className="gap-4">
          {!cancelled ? (
            <View className="flex-row items-center">
              {FLOW.map((f, i) => {
                const done = i < stepIdx || isDelivered;
                const current = i === stepIdx && !isDelivered;
                return (
                  <React.Fragment key={f}>
                    <View className="items-center" style={{ width: 76 }}>
                      <View className={`size-7 rounded-full items-center justify-center border ${done ? "bg-emerald-600 border-emerald-600" : current ? "bg-primary border-primary" : "bg-card border-border"}`}>
                        {done ? <Check size={14} color="#fff" /> : <Text className={`text-xs font-bold ${current ? "text-white" : "text-muted-foreground"}`}>{i + 1}</Text>}
                      </View>
                      <Text className={`text-[11px] mt-1 ${current ? "text-primary font-semibold" : "text-muted-foreground"}`}>{FLOW_LABEL[i]}</Text>
                    </View>
                    {i < FLOW.length - 1 ? <View className={`h-[2px] flex-1 -mt-4 ${i < stepIdx || isDelivered ? "bg-emerald-600" : "bg-border"}`} /> : null}
                  </React.Fragment>
                );
              })}
            </View>
          ) : null}

          <View className={`gap-3 rounded-xl px-3 py-2.5 ${cancelled ? "bg-destructive/10" : "bg-primary/5"}`}>
            <Text className="text-sm text-foreground">{nextHint}</Text>
            <View className="flex-row flex-wrap gap-2">
              <Button size="sm" onPress={() => void handlePrint("print")} className="flex-row items-center gap-1.5">
                <Printer size={14} color="#fff" />
                <Text className="text-xs font-semibold text-white">Cetak Surat Jalan</Text>
              </Button>
              <Button size="sm" variant="outline" onPress={() => void handlePrint("download")} className="flex-row items-center gap-1.5">
                <Download size={14} color={colors.text} />
                <Text className="text-xs">Unduh PDF</Text>
              </Button>
              {canHandover && status === "Dikirim" ? (
                <Button size="sm" variant="outline" onPress={() => setHandoverOpen(true)} className="flex-row items-center gap-1.5">
                  <CheckCircle2 size={14} color={colors.success} />
                  <Text className="text-xs">Catat diterima</Text>
                </Button>
              ) : null}
              {!isDelivered && !cancelled ? (
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => router.push(`/delivery-notes/new?id=${row.id}${matchedSo?.id ? `&soId=${matchedSo.id}` : ""}` as any)}
                >
                  <Text className="text-xs">{status === "Menunggu pengiriman" && hasGoods ? "Siapkan barang / ubah" : "Ubah"}</Text>
                </Button>
              ) : null}
            </View>
          </View>

          <View className="flex-row flex-wrap gap-x-4">
            {info.map((r) => (
              <View key={r.label} className="flex-row items-start gap-2.5 py-1.5 flex-1 min-w-[220px]">
                <r.icon size={15} color={colors.muted} style={{ marginTop: 2 }} />
                <View className="flex-1">
                  <Text className="text-[11px] text-muted-foreground">{r.label}</Text>
                  <Text className="text-sm text-foreground">{r.value}</Text>
                  {r.sub ? <Text className="text-[11px] text-muted-foreground">{r.sub}</Text> : null}
                </View>
                {r.onEdit ? (
                  <Pressable onPress={r.onEdit} className="self-center px-1">
                    <Text className="text-xs font-semibold text-primary">Ubah</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>

          {matchedSo || matchedInvoice ? (
            <View className="flex-row flex-wrap gap-2 pt-1 border-t border-border/60">
              {matchedSo ? (
                <Pressable onPress={() => router.push(`/po-client/${matchedSo.id}` as any)} className="flex-row items-center gap-1.5 rounded-full border border-border px-3 py-1.5">
                  <ShoppingCart size={12} color={colors.primary} />
                  <Text className="text-xs text-primary">SO {matchedSo.nomorSo || matchedSo.nomor || matchedSo.id}</Text>
                </Pressable>
              ) : null}
              {matchedInvoice ? (
                <Pressable onPress={() => router.push(`/invoices/${matchedInvoice.id}` as any)} className="flex-row items-center gap-1.5 rounded-full border border-border px-3 py-1.5">
                  <FileText size={12} color={colors.primary} />
                  <Text className="text-xs text-primary">Invoice {matchedInvoice.nomor || matchedInvoice.id}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </Panel>

      {/* Barang */}
      <Panel title={hasGoods ? `Barang (${items.length ? `${items.length} baris · ${totalQty} unit` : "belum diisi"})` : "Tanpa barang"}>
        {!hasGoods ? (
          <Text className="text-muted-foreground text-sm">Surat jalan penugasan (survey, meeting, instalasi) tanpa membawa barang.</Text>
        ) : items.length === 0 ? (
          <Text className="text-muted-foreground text-sm">{row.barang && row.barang !== "-" ? row.barang : "Daftar barang belum diisi — tekan Siapkan barang."}</Text>
        ) : (
          <View className="border border-border rounded-xl overflow-hidden">
            {(showAllItems ? items : items.slice(0, 8)).map((it: any, idx: number) => {
              const prod = it.product;
              const snText = Array.isArray(it.serials) ? it.serials.filter(Boolean).join(", ") : it.serials ? String(it.serials).trim() : "";
              return (
                <View key={it.id ?? idx} className={`px-3 py-2.5 flex-row items-center gap-3 ${idx > 0 ? "border-t border-border/60" : ""}`}>
                  <View className="flex-1">
                    <Text className="text-sm text-foreground" numberOfLines={1}>
                      {prod?.name ?? it.name ?? it.note ?? "Barang"}
                    </Text>
                    <Text className="text-[11px] text-muted-foreground" numberOfLines={2}>
                      {snText ? `SN: ${snText}` : prod?.hasSerial ? "SN belum diisi" : prod?.sku || "Tanpa SN"}
                    </Text>
                  </View>
                  <Text className="text-sm font-semibold text-foreground">
                    {it.qty} {prod?.unit ?? "unit"}
                  </Text>
                </View>
              );
            })}
            {items.length > 8 ? (
              <Pressable onPress={() => setShowAllItems((v) => !v)} className="py-2 items-center border-t border-border/60">
                <Text className="text-xs font-semibold text-primary">{showAllItems ? "Ringkas" : `Lihat semua (${items.length})`}</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </Panel>

      <Panel
        title="Serah Terima"
        subtitle="Bukti barang diterima di lokasi: nama penerima + foto surat jalan yang sudah ditandatangani"
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
              Belum diterima. Setelah barang diserahkan di {row.tujuan}, tekan &quot;Catat diterima&quot; di atas dan lampirkan foto surat jalan yang sudah ditandatangani penerima.
            </Text>
          </View>
        )}
      </Panel>

      <DocumentationPhotosPanel
        kind="delivery-note"
        entityId={row.id}
        title="Foto Pengiriman"
        subtitle="Foto barang & penerimaan di lokasi."
      />

      {/* Modal Ubah Pengirim */}
      <Dialog open={!!senderVal} onOpenChange={(v) => !v && setSenderVal(null)}>
        <DialogContent className="w-[94vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ubah Pengirim</DialogTitle>
          </DialogHeader>
          {senderVal ? (
            <View className="py-2">
              <SenderFields value={senderVal} onChange={setSenderVal} />
            </View>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onPress={() => setSenderVal(null)} disabled={savingSender}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={saveSender} disabled={savingSender}>
              <Text className="text-white font-semibold">{savingSender ? "Menyimpan..." : "Simpan"}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
