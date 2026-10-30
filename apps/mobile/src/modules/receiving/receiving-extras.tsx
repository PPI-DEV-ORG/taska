import * as React from "react";
import { View, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { AlertTriangle, ShieldAlert, CheckCircle, PackageCheck, ExternalLink, Barcode } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Panel, FormField } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { FileUploader, type FileUploaderHandle } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { type Row } from "@/constants/modules";
import { Line } from "@/modules/shared/line";

export function ReceivingExtras({ row }: { row: Row }) {
  const router = useRouter();
  const { data, addRow, patchRow, toast } = useApp();
  const [issueOpen, setIssueOpen] = React.useState(false);
  const [issueType, setIssueType] = React.useState<"Rusak Fisik" | "Cacat Fungsi" | "Salah Tipe" | "Kurang Kuantitas">("Rusak Fisik");
  const [issueItem, setIssueItem] = React.useState<string>(row.item ? (String(row.item).split(",")[0] ?? "") : "");
  const [issueQty, setIssueQty] = React.useState("1");
  const [issueNotes, setIssueNotes] = React.useState("");
  const [issueSolusi, setIssueSolusi] = React.useState("Retur Tukar Baru ke Supplier");
  const [issueFileId, setIssueFileId] = React.useState<number | null>(null);

  // State untuk Dialog Penerimaan Barang Cepat
  const [processOpen, setProcessOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [processNotes, setProcessNotes] = React.useState(row.conditionNote ? String(row.conditionNote) : "");
  const receiveFileHandle = React.useRef<FileUploaderHandle | null>(null);

  const isPending =
    row.status === "Menunggu penerimaan" ||
    row.status === "Menunggu" ||
    row.rawStatus === "MENUNGGU" ||
    String(row.status || "").toLowerCase().includes("menunggu");

  // Inisialisasi item penerimaan dari row.items
  const [receiveItems, setReceiveItems] = React.useState<
    {
      productId: number;
      name: string;
      sku: string;
      unit: string;
      hasSerial: boolean;
      qty: number;
      snInput: string;
      serials: string[];
    }[]
  >(() => {
    if (Array.isArray(row.items) && row.items.length > 0) {
      return row.items.map((it: any, idx: number) => {
        const pName = it.product?.name || it.productName || it.name || `Item #${idx + 1}`;
        const pSku = it.product?.sku || it.sku || "";
        const pUnit = it.product?.unit || "unit";
        const hasSn = it.hasSerial !== undefined
          ? !!it.hasSerial
          : (it.product?.hasSerial !== undefined
            ? !!it.product.hasSerial
            : (it.berSN !== undefined ? !!it.berSN : true));
        const q = it.qtyReceived ?? it.qtyGood ?? it.qtyOrdered ?? 1;
        const initialSns = it.serials ? String(it.serials).split(",").map((s: string) => s.trim()).filter(Boolean) : [];
        return {
          productId: Number(it.productId) || 1,
          name: pName,
          sku: pSku,
          unit: pUnit,
          hasSerial: hasSn,
          qty: q,
          snInput: initialSns.join("\n"),
          serials: initialSns,
        };
      });
    }
    return [
      {
        productId: 1,
        name: row.item ? String(row.item).split(",")[0] || "Barang" : "Barang",
        sku: "",
        unit: "unit",
        hasSerial: false,
        qty: 1,
        snInput: "",
        serials: [],
      },
    ];
  });

  const [issueList, setIssueList] = React.useState<
    {
      id: string;
      type: string;
      item: string;
      qty: number;
      notes: string;
      solusi: string;
      status: string;
    }[]
  >([
    ...(row.hasIssue
      ? [
          {
            id: "DR-01",
            type: "Rusak Fisik",
            item: (String(row.item).split(",")[0] ?? "Perangkat") as string,
            qty: 1,
            notes: "Casing penyok saat unboxing dari ekspedisi",
            solusi: "Retur Tukar Baru ke Supplier",
            status: "Diproses Supplier",
          },
        ]
      : []),
  ]);

  async function handleConfirmReceive() {
    setIsSubmitting(true);
    try {
      // Validasi SN jika ada produk ber-SN: jumlah SN yang dimasukkan harus sama persis dengan kuantitas (qty)
      for (const item of receiveItems) {
        if (item.hasSerial) {
          const sns = item.snInput
            .split(/[\n,;]+/)
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean);
          if (sns.length === 0) {
            toast(`Serial Number untuk ${item.name} wajib diisi (${item.qty} unit)`, "danger");
            setIsSubmitting(false);
            return;
          }
          if (sns.length !== item.qty) {
            toast(
              `Jumlah Serial Number (${sns.length} SN) tidak sesuai dengan Qty penerimaan (${item.qty} unit) untuk produk ${item.name}`,
              "danger"
            );
            setIsSubmitting(false);
            return;
          }
        }
      }

      const uploadedFileId = (await receiveFileHandle.current?.flush()) ?? undefined;
      const effectiveFileId = uploadedFileId ?? (row.fileId ? Number(row.fileId) : undefined);

      const payloadItems = receiveItems.map((it) => {
        const sns = it.snInput
          .split(/[\n,;]+/)
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean);
        return {
          productId: it.productId,
          qtyReceived: it.qty,
          qtyOrdered: it.qty,
          serials: it.hasSerial && sns.length > 0 ? sns.join(",") : undefined,
        };
      });

      await patchRow("receiving", row.id, {
        status: "DITERIMA",
        conditionNote: processNotes || row.conditionNote,
        items: payloadItems,
        ...(effectiveFileId ? { fileId: effectiveFileId, receiptFileId: effectiveFileId, photoFileId: effectiveFileId } : {}),
      });

      // Update Purchase Request jika ada relasi
      const rawReqId = row.requestId || row.requestNumber;
      const targetReq = (data["purchase-requests"] ?? []).find(
        (r: Row) => String(r.id) === String(rawReqId) || r.nomor === rawReqId
      );
      const effReqId = targetReq?.id ?? (rawReqId && !isNaN(Number(rawReqId)) ? rawReqId : null);
      if (effReqId) {
        await patchRow("purchase-requests", String(effReqId), {
          status: "DITERIMA",
          ...(effectiveFileId ? { doFileId: effectiveFileId } : {}),
        }).catch(() => {});
      }

      // Update Supplier PO jika ada relasi
      if (row.supplierPoId && String(row.supplierPoId) !== "-") {
        await patchRow("supplier-pos", String(row.supplierPoId), {
          status: "Sampai",
          pengiriman: "Sampai",
          ...(effectiveFileId ? { doFileId: effectiveFileId } : {}),
        }).catch(() => {});
      }

      setProcessOpen(false);
      toast("Penerimaan barang berhasil diproses! Stok gudang telah bertambah.");
    } catch (err: any) {
      toast(err?.message || "Gagal memproses penerimaan barang", "danger");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSaveIssue() {
    if (!issueNotes.trim()) {
      toast("Keterangan masalah wajib diisi", "danger");
      return;
    }
    const qNum = Number(issueQty) || 1;
    const itemStr = issueItem.trim() || (String(row.item).split(",")[0] ?? "Perangkat");
    const newIssue = {
      id: `DR-${Date.now()}`,
      type: issueType,
      item: itemStr,
      qty: qNum,
      notes: issueNotes.trim(),
      solusi: issueSolusi,
      status: "Menunggu Tindakan Supplier",
    };
    setIssueList([newIssue, ...issueList]);
    addRow("damage-reports", {
      produk: issueItem,
      jenis: issueType,
      po: row.po,
      pelapor: row.penerima || "-",
      status: "Dilaporkan",
      keterangan: `${issueNotes.trim()} (${issueSolusi})`,
      fileId: issueFileId || undefined,
    });
    patchRow("receiving", row.id, { hasIssue: true });
    setIssueOpen(false);
    setIssueNotes("");
    setIssueFileId(null);
    toast("Issue Report berhasil dicatat & diteruskan ke Procurement");
  }

  return (
    <>
      {/* Banner / Card Tindakan Penerimaan jika masih menunggu */}
      {isPending && (
        <View className="bg-warning/10 border-warning/40 rounded-2xl border p-4 gap-3">
          <View className="flex-row items-center gap-2.5">
            <View className="size-9 rounded-xl bg-warning/20 items-center justify-center">
              <PackageCheck size={20} color={colors.warning} />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-foreground">Penerimaan Menunggu Diproses Gudang</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">
                Barang fisik telah tiba / dalam pengiriman. Verifikasi barang, periksa kuantitas, input Serial Number, dan konfirmasi penerimaan agar stok bertambah.
              </Text>
            </View>
          </View>

          <View className="flex-row flex-wrap gap-2 pt-2 border-t border-warning/20">
            <Button
              size="sm"
              onPress={() => setProcessOpen(true)}
              className="flex-1 min-w-[140px] bg-warning hover:bg-warning/90"
            >
              <CheckCircle size={15} color={colors.background} />
              <Text className="text-xs font-bold text-background">Terima Barang Sekarang</Text>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onPress={() => router.push(`/receiving/new?receivingId=${row.id}`)}
              className="flex-1 min-w-[140px]"
            >
              <ExternalLink size={14} color={colors.text} />
              <Text className="text-xs">Buka di Halaman Lengkap</Text>
            </Button>
          </View>
        </View>
      )}

      <Panel title="Rincian Penerimaan Barang">
        <Line left="Barang Diterima" right={<Text className="font-semibold">{row.item}</Text>} />
        <Line left="Nomor PO Supplier" right={<Text className="text-text-secondary">{row.po}</Text>} />
        {row.requestNumber && row.requestNumber !== "-" && (
          <Line left="Ref Request Barang" right={<Text className="text-primary font-medium">{row.requestNumber}</Text>} />
        )}
        <Line left="Supplier" right={<Text className="text-text-secondary">{row.supplier}</Text>} />
        <Line left="Petugas Penerima" right={<Text className="text-text-secondary">{row.penerima}</Text>} />
        <Line left="Status Penerimaan" right={<StatusBadge status={row.status} />} />
        {row.conditionNote ? <Line left="Catatan Kondisi" right={<Text className="text-text-secondary">{row.conditionNote}</Text>} /> : null}

        {Array.isArray(row.items) && row.items.length > 0 && (
          <View className="mt-3 pt-3 border-t border-border/60 gap-2">
            <Text className="text-xs font-bold text-foreground">Daftar Item & Serial Number Fisik</Text>
            {row.items.map((it: any, idx: number) => {
              const pName = it.product?.name || it.productName || it.name || `Item #${idx + 1}`;
              const pSku = it.product?.sku || it.sku || "";
              const pUnit = it.product?.unit || "";
              const q = it.qtyReceived ?? it.qtyGood ?? it.qtyOrdered ?? 1;
              const serials = it.serials ? String(it.serials).split(",").filter(Boolean) : [];

              return (
                <View key={idx} className="bg-panel/40 border-border/70 rounded-xl border p-2.5 gap-1.5">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-bold text-foreground">
                      {pName} {pSku ? `(${pSku})` : ""}
                    </Text>
                    <Text className="text-xs font-semibold text-primary">{q} {pUnit}</Text>
                  </View>
                  {serials.length > 0 && (
                    <View className="flex-row flex-wrap gap-1 mt-1">
                      {serials.map((sn: string, sidx: number) => (
                        <View key={sidx} className="bg-card border-border/60 rounded px-1.5 py-0.5 border">
                          <Text className="text-[10px] font-mono text-muted-foreground">{sn.trim()}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </Panel>

      <Panel
        title="Pelaporan Barang Bermasalah (Issue Report)"
        subtitle="Laporkan jika ada barang rusak, cacat fungsi, salah tipe barang, atau jumlah kurang dari PO."
        right={
          <Button size="sm" variant="outline" onPress={() => setIssueOpen(true)} className="flex-row items-center gap-1">
            <ShieldAlert size={14} color={colors.danger} />
            <Text className="text-xs text-danger font-medium">Lapor Masalah</Text>
          </Button>
        }
      >
        {issueList.length === 0 ? (
          <Text className="text-muted-foreground text-xs leading-relaxed py-1">
            Tidak ada laporan barang bermasalah untuk penerimaan ini. Semua unit dalam kondisi baik dan sesuai pesanan.
          </Text>
        ) : (
          <View className="gap-2.5">
            {issueList.map((issue) => (
              <View key={issue.id} className="bg-panel border-border/80 rounded-xl border p-3 gap-2">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <AlertTriangle size={15} color={colors.danger} />
                    <Text className="text-xs font-semibold text-danger">{issue.type}</Text>
                    <Text className="text-xs text-muted-foreground">({issue.qty} unit)</Text>
                  </View>
                  <StatusBadge status={issue.status} />
                </View>
                <Text className="text-xs font-medium text-foreground">{issue.item}</Text>
                <Text className="text-xs text-muted-foreground leading-relaxed">{issue.notes}</Text>
                <View className="bg-card border-border/50 rounded-md p-1.5 border">
                  <Text className="text-[11px] text-primary">Rekomendasi tindakan: {issue.solusi}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </Panel>

      {/* Modal Proses Penerimaan Barang Langsung */}
      <Dialog open={processOpen} onOpenChange={setProcessOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Verifikasi & Terima Barang Fisik</DialogTitle>
          </DialogHeader>
          <ScrollView className="max-h-[70vh] gap-3 py-2">
            <View className="bg-card border-border/70 rounded-xl border p-3 gap-1">
              <Text className="text-xs text-muted-foreground">Dokumen Penerimaan:</Text>
              <Text className="text-sm font-bold text-foreground">{row.nomor || "Penerimaan Baru"}</Text>
              <Text className="text-xs text-muted-foreground">Supplier / Toko: {row.supplier || "-"}</Text>
              {row.requestNumber && row.requestNumber !== "-" && (
                <Text className="text-xs text-primary font-medium">Ref Request: {row.requestNumber}</Text>
              )}
            </View>

            <View className="gap-2.5">
              <Text className="text-xs font-bold text-foreground">Daftar Barang yang Diterima:</Text>
              {receiveItems.map((it, idx) => (
                <View key={idx} className="bg-panel border-border/80 rounded-xl border p-3 gap-2">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-xs font-bold text-foreground">{it.name}</Text>
                      {it.sku ? <Text className="text-[11px] text-muted-foreground">SKU: {it.sku}</Text> : null}
                    </View>
                    <View className="w-24">
                      <Input
                        value={String(it.qty)}
                        onChangeText={(v) => {
                          const nVal = Math.max(1, Number(v.replace(/\D/g, "")) || 1);
                          setReceiveItems((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, qty: nVal } : item))
                          );
                        }}
                        keyboardType="numeric"
                        placeholder="Qty"
                      />
                    </View>
                  </View>

                  {/* Toggle atau input Serial Number */}
                  <View className="bg-card border-border/60 rounded-lg p-2.5 gap-2 border">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-1.5">
                        <Barcode size={14} color={it.hasSerial ? colors.primary : colors.muted} />
                        <Text className="text-[11px] font-semibold text-foreground">
                          {it.hasSerial ? `Serial Number (${it.qty} unit wajib):` : "Barang Curah (Tanpa Serial Number)"}
                        </Text>
                      </View>
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() =>
                          setReceiveItems((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, hasSerial: !item.hasSerial } : item))
                          )
                        }
                        className="h-6 px-2"
                      >
                        <Text className="text-[10px] text-primary">
                          {it.hasSerial ? "Ubah ke Non-SN" : "Aktifkan Input SN"}
                        </Text>
                      </Button>
                    </View>
                    {it.hasSerial ? (
                      <View className="gap-1">
                        <Textarea
                          value={it.snInput}
                          onChangeText={(v) =>
                            setReceiveItems((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, snInput: v } : item))
                            )
                          }
                          placeholder="Masukkan SN dipisah koma atau baris baru..."
                          numberOfLines={2}
                        />
                        {(() => {
                          const count = it.snInput.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean).length;
                          const isMatch = count === it.qty;
                          return (
                            <View className="flex-row items-center justify-between">
                              <Text
                                className={`text-[10px] ${
                                  isMatch ? "text-success font-medium" : "text-amber-500 font-semibold"
                                }`}
                              >
                                {isMatch
                                  ? `✓ ${count} dari ${it.qty} SN dimasukkan (Pas)`
                                  : `Perhatian: ${count} dari ${it.qty} SN dimasukkan (${count < it.qty ? "Kurang" : "Kelebihan"} ${Math.abs(count - it.qty)} SN)`}
                              </Text>
                            </View>
                          );
                        })()}
                      </View>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>

            <FormField label="Catatan Kondisi Fisik / No. Surat Jalan DO">
              <Input
                value={processNotes}
                onChangeText={setProcessNotes}
                placeholder="Contoh: Barang lengkap & utuh sesuai DO #12345"
              />
            </FormField>

            <FileUploader
              label="Upload Foto DO / Surat Jalan / Bukti Fisik"
              kind="semua"
              accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp"
              allowedExtensions={["jpg", "jpeg", "png", "webp", "pdf"]}
              category="penerimaan"
              handleRef={(h) => { receiveFileHandle.current = h; }}
            />
          </ScrollView>

          <DialogFooter>
            <Button variant="outline" onPress={() => setProcessOpen(false)} disabled={isSubmitting}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleConfirmReceive} disabled={isSubmitting}>
              <Text>{isSubmitting ? "Memproses..." : "Konfirmasi Terima & Masuk Stok"}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Lapor Barang Bermasalah */}
      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Lapor Barang Bermasalah (Issue Report)</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <View className="gap-1.5">
              <Text className="text-xs text-muted-foreground font-medium">Jenis Masalah</Text>
              <View className="flex-row flex-wrap gap-1.5">
                {(["Rusak Fisik", "Cacat Fungsi", "Salah Tipe", "Kurang Kuantitas"] as const).map((t) => (
                  <Button
                    key={t}
                    size="sm"
                    variant={issueType === t ? "default" : "outline"}
                    onPress={() => setIssueType(t)}
                    className="h-8 px-2.5"
                  >
                    <Text className="text-xs">{t}</Text>
                  </Button>
                ))}
              </View>
            </View>

            <View className="gap-1">
              <Text className="text-xs text-muted-foreground">Nama Item / Produk</Text>
              <Input value={issueItem} onChangeText={setIssueItem} placeholder="Nama barang" />
            </View>

            <View className="gap-1">
              <Text className="text-xs text-muted-foreground">Kuantitas Bermasalah (Unit / Qty)</Text>
              <Input value={issueQty} onChangeText={setIssueQty} placeholder="1" keyboardType="numeric" />
            </View>

            <View className="gap-1">
              <Text className="text-xs text-muted-foreground">Keterangan Detail Masalah</Text>
              <Textarea
                value={issueNotes}
                onChangeText={setIssueNotes}
                placeholder="Jelaskan kondisi barang saat unboxing atau testing..."
                numberOfLines={3}
              />
            </View>

            <View className="gap-1">
              <Text className="text-xs text-muted-foreground">Tindakan yang Diminta (Rekomendasi)</Text>
              <Input
                value={issueSolusi}
                onChangeText={setIssueSolusi}
                placeholder="Contoh: Retur Tukar Baru / Potong Invoice"
              />
            </View>

            <FileUploader
              label="Upload Foto Bukti Kerusakan / Serial Number"
              kind="foto"
              category="laporan-kerusakan"
              autoFlush
              onUploaded={(id) => setIssueFileId(id)}
            />
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setIssueOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSaveIssue}>
              <Text>Kirim Laporan</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
