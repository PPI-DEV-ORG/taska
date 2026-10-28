import * as React from "react";
import { View, Linking } from "react-native";
import { Plus, Send, FileSpreadsheet, FileText, Paperclip, ExternalLink, CheckCircle2, FileDown, Printer, RotateCcw, Trash2 } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Panel, FormField } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { DatePicker, SearchableSelect } from "@/components/taska/dialogs";
import { FileUploader } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { api, apiBase, uploadFile } from "@/services/api";
import { colors } from "@/tokens";
import { rupiah, formatThousands } from "@/lib/format";
import { buildEfakturCsv } from "@/lib/efaktur";
import { type Row } from "@/constants/modules";
import { Line } from "@/modules/shared/line";
import { downloadInvoiceExcel } from "@/modules/invoice/invoice-files";
import { InvoiceTemplateGenerator } from "@/modules/invoice/invoice-template-generator";
import { ConflictAndSwapBanner, SerialItemPickerModal } from "@/components/taska/serial-item-picker";
import { type QuotationItem } from "@/modules/quotation/types";
import { calcItemPph, PPH_MODE_OPTIONS, pphModeToTipe, type PphMode } from "@/modules/quotation/lib";

export function InvoiceExtras({
  row,
  payOpen: externalPayOpen,
  onPayOpenChange: externalOnPayOpenChange,
}: {
  row: Row;
  payOpen?: boolean;
  onPayOpenChange?: (open: boolean) => void;
}) {
  const { user, toast, reload, data, patchRow, setStatus, addRow } = useApp();
  const [receiptPreview, setReceiptPreview] = React.useState<{
    id: string;
    amount: number;
    date: string;
    method: string;
    reference: string;
    fileId?: number | null;
    idx: number;
  } | null>(null);
  const [returOpen, setReturOpen] = React.useState(false);
  const [returProduct, setReturProduct] = React.useState("");
  const [returSn, setReturSn] = React.useState("");
  const [returQty, setReturQty] = React.useState("1");
  const [returNote, setReturNote] = React.useState("");
  const [isSavingRetur, setIsSavingRetur] = React.useState(false);

  const [pickerOpen, setPickerOpen] = React.useState(false);
  const items: QuotationItem[] = Array.isArray(row.items) ? row.items : [];

  async function handleAddItems(newItems: QuotationItem[]) {
    const existingSnSet = new Set<string>();
    items.forEach((it) => {
      if (Array.isArray(it.serialNumbers)) it.serialNumbers.forEach((s) => existingSnSet.add(String(s).trim().toUpperCase()));
      const snVal = String(it.item).match(/\(SN:\s*([^\)]+)\)/i)?.[1]?.trim();
      if (snVal) existingSnSet.add(snVal.toUpperCase());
    });
    const valid: QuotationItem[] = [];
    newItems.forEach((it) => {
      const snList: string[] = [];
      if (Array.isArray(it.serialNumbers)) it.serialNumbers.forEach((s) => snList.push(String(s).trim().toUpperCase()));
      const snVal = String(it.item).match(/\(SN:\s*([^\)]+)\)/i)?.[1]?.trim();
      if (snVal) snList.push(snVal.toUpperCase());
      const hasDup = snList.some((s) => existingSnSet.has(s));
      if (!hasDup) {
        snList.forEach((s) => existingSnSet.add(s));
        valid.push(it);
      }
    });

    const updated = [...items, ...valid];
    const newAmount = updated.reduce((s, it) => s + (Number(it.qty || 1) * Number(it.price || it.harga || 0)), 0);
    const isInclude = row.ppnMode === "include" || String(row.tipePpn || "").includes("Include");
    const isNoPpn = row.ppnMode === "none" || String(row.tipePpn || "").includes("No");
    const dpp = isInclude ? Math.round(newAmount / 1.11) : newAmount;
    const ppn = isNoPpn ? 0 : isInclude ? Math.max(0, newAmount - dpp) : Math.round(newAmount * 0.11);
    const pph = updated.reduce((s, it) => s + calcItemPph(it), 0);
    const total = Math.max(0, (isInclude ? newAmount : dpp + ppn) - pph);

    await patchRow("invoices", row.id, {
      items: updated,
      nilai: dpp,
      amount: dpp,
      ppn,
      pph,
      total,
    });
    await reload();
    toast(`Berhasil menambahkan ${valid.length} barang ke invoice! Stok ter-reserve.`);
  }

  async function handleDeleteItem(idx: number) {
    const updated = items.filter((_, i) => i !== idx);
    const newAmount = updated.reduce((s, it) => s + (Number(it.qty || 1) * Number(it.price || it.harga || 0)), 0);
    const isInclude = row.ppnMode === "include" || String(row.tipePpn || "").includes("Include");
    const isNoPpn = row.ppnMode === "none" || String(row.tipePpn || "").includes("No");
    const dpp = isInclude ? Math.round(newAmount / 1.11) : newAmount;
    const ppn = isNoPpn ? 0 : isInclude ? Math.max(0, newAmount - dpp) : Math.round(newAmount * 0.11);
    const pph = updated.reduce((s, it) => s + calcItemPph(it), 0);
    const total = Math.max(0, (isInclude ? newAmount : dpp + ppn) - pph);

    await patchRow("invoices", row.id, {
      items: updated,
      nilai: dpp,
      amount: dpp,
      ppn,
      pph,
      total,
    });
    await reload();
    toast("Barang berhasil dihapus dari invoice");
  }

  async function handleUpdateItemPph(idx: number, newPphMode: PphMode) {
    const updated = items.map((it, i) =>
      i === idx ? { ...it, pphMode: newPphMode, tipePph: pphModeToTipe(newPphMode) } : it
    );
    const newAmount = updated.reduce((s, it) => s + (Number(it.qty || 1) * Number(it.price || it.harga || 0)), 0);
    const isInclude = row.ppnMode === "include" || String(row.tipePpn || "").includes("Include");
    const isNoPpn = row.ppnMode === "none" || String(row.tipePpn || "").includes("No");
    const dpp = isInclude ? Math.round(newAmount / 1.11) : newAmount;
    const ppn = isNoPpn ? 0 : isInclude ? Math.max(0, newAmount - dpp) : Math.round(newAmount * 0.11);
    const pph = updated.reduce((s, it) => s + calcItemPph(it), 0);
    const total = Math.max(0, (isInclude ? newAmount : dpp + ppn) - pph);

    await patchRow("invoices", row.id, {
      items: updated,
      nilai: dpp,
      amount: dpp,
      ppn,
      pph,
      total,
    });
    await reload();
  }

  const salesReturns = React.useMemo(() => {
    const invNo = String(row.nomor || "").toLowerCase();
    const poNo = String(row.po || "").toLowerCase();
    return (data["damage-reports"] ?? []).filter((dr: Row) => {
      const ref = String(dr.po || "").toLowerCase();
      return (
        (dr.kategoriLaporan === "Retur Penjualan" || dr.jenis === "Retur Penjualan") &&
        ((invNo && ref.includes(invNo)) || (poNo && poNo !== "-" && ref.includes(poNo)))
      );
    });
  }, [data, row.nomor, row.po]);

  async function handleSaveSalesReturn() {
    if (!returProduct) {
      toast("Pilih barang yang diretur", "danger");
      return;
    }
    if (!returNote.trim()) {
      toast("Alasan retur wajib diisi", "danger");
      return;
    }
    setIsSavingRetur(true);
    try {
      await addRow("damage-reports", {
        produk: returProduct,
        sn: returSn || "-",
        jenis: "Retur Penjualan",
        qty: Number(returQty) || 1,
        tanggal: new Date().toISOString().slice(0, 10),
        po: row.nomor,
        keterangan: returNote.trim(),
      });
      toast("Retur penjualan berhasil dicatat dan stok/SN diperbarui");
      setReturOpen(false);
      setReturProduct("");
      setReturSn("");
      setReturQty("1");
      setReturNote("");
      await reload();
    } catch (e: any) {
      toast(e?.message ?? "Gagal mencatat retur penjualan", "danger");
    } finally {
      setIsSavingRetur(false);
    }
  }
  const rawStatusUpper = String(row.rawStatus || "").toUpperCase();
  const isSent = row.status !== "Belum dikirim" && row.status !== "Draft" && rawStatusUpper !== "DRAFT";
  const [isSending, setIsSending] = React.useState(false);
  const canManage = user?.role === "super_admin" || user?.role === "finance" || user?.role === "bos" || user?.role === "admin";

  async function handleSendInvoice() {
    setIsSending(true);
    try {
      await setStatus("invoices", String(row.id), "Terkirim");
      toast("Invoice berhasil dikirim ke customer");
      await reload();
    } catch (e: any) {
      toast(e?.message ?? "Gagal mengirim invoice", "danger");
    } finally {
      setIsSending(false);
    }
  }

  const sisa = Math.max(0, Number(row.total || 0) - Number(row.terbayar || 0));
  const [internalPayOpen, setInternalPayOpen] = React.useState(false);
  const isControlled = externalPayOpen !== undefined;
  const payOpen = isControlled ? externalPayOpen : internalPayOpen;

  const setPayOpen = React.useCallback(
    (open: boolean) => {
      if (isControlled) {
        externalOnPayOpenChange?.(open);
      } else {
        setInternalPayOpen(open);
      }
    },
    [isControlled, externalOnPayOpenChange]
  );

  const [payAmount, setPayAmount] = React.useState(formatThousands(sisa || row.total || 0));
  const [payDate, setPayDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [payMethod, setPayMethod] = React.useState<"TRANSFER" | "TUNAI" | "QRIS" | "LAINNYA">("TRANSFER");
  const [payRef, setPayRef] = React.useState("");
  const [payFileId, setPayFileId] = React.useState<number | null>(null);
  const [isSubmittingPay, setIsSubmittingPay] = React.useState(false);

  const payments: { id: string; amount: number; date: string; method: string; reference: string; fileId?: number | null }[] =
    Array.isArray(row._payments) ? row._payments : [];

  function openPayModal() {
    setPayAmount(formatThousands(Math.max(0, Number(row.total || 0) - Number(row.terbayar || 0))));
    setPayFileId(null);
    setPayOpen(true);
  }

  async function handleSavePayment() {
    const amt = Number(String(payAmount).replace(/\D/g, "")) || 0;
    if (amt <= 0) {
      toast("Nominal pembayaran harus lebih dari 0", "danger");
      return;
    }
    if (!payFileId) {
      toast("Bukti transfer / pembayaran wajib diunggah sebelum menyimpan", "danger");
      return;
    }
    setIsSubmittingPay(true);
    try {
      await api("POST", `/invoices/${row.id}/payments`, {
        amount: amt,
        date: payDate || new Date().toISOString().slice(0, 10),
        method: payMethod,
        reference: payRef.trim() || undefined,
        fileId: payFileId,
      });
      toast(`Pembayaran ${rupiah(amt)} berhasil dicatat`);
      setPayOpen(false);
      setPayRef("");
      setPayFileId(null);
      await reload();
    } catch (e: any) {
      toast(e?.message ?? "Gagal mencatat pembayaran", "danger");
    } finally {
      setIsSubmittingPay(false);
    }
  }

  const canExportEfaktur = ["super_admin", "bos", "finance"].includes(user?.role || "");

  function handleDownloadEfaktur() {
    if (!canExportEfaktur) {
      toast("Akses ditolak: Ekspor E-Faktur hanya untuk Finance, Bos, dan Super Admin", "danger");
      return;
    }
    if (typeof window === "undefined" || typeof document === "undefined") {
      toast("Mengunduh CSV E-Faktur DJP");
      return;
    }
    try {
      const csvContent = buildEfakturCsv([row], data.customers ?? []);
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `efaktur-${String(row.nomor || "inv").replace(/[^a-zA-Z0-9_-]/g, "_")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast(`CSV E-Faktur DJP untuk ${row.nomor} berhasil diunduh`);
    } catch (e: any) {
      toast(e?.message ?? "Gagal mengunduh CSV E-Faktur", "danger");
    }
  }

  function openFileUrl(fileId?: number | string | null) {
    if (!fileId) return;
    const url = `${apiBase()}/files/${fileId}`;
    if (typeof window !== "undefined") {
      window.open(url, "_blank");
    } else {
      Linking.openURL(url).catch(() => {});
    }
  }

  return (
    <>
      <ConflictAndSwapBanner row={row} />

      <Panel
        title="Ringkasan Pembayaran Invoice"
        right={
          <View className="flex-row items-center gap-1.5">
            {canExportEfaktur ? (
              <Button variant="outline" size="sm" onPress={handleDownloadEfaktur} className="flex-row items-center gap-1">
                <FileSpreadsheet size={13} color={colors.success} />
                <Text className="text-xs">CSV E-Faktur</Text>
              </Button>
            ) : null}
            {canManage && !isSent && row.status !== "Batal" && row.status !== "Dibatalkan" ? (
              <Button size="sm" onPress={handleSendInvoice} disabled={isSending} className="flex-row items-center gap-1 bg-primary">
                <Send size={13} color="#fff" />
                <Text className="text-xs text-white font-semibold">{isSending ? "Mengirim..." : "Kirim ke Customer"}</Text>
              </Button>
            ) : null}
            {canManage && isSent && sisa > 0 && row.status !== "Batal" && row.status !== "Dibatalkan" ? (
              <Button variant="outline" size="sm" onPress={openPayModal} className="flex-row items-center gap-1">
                <Plus size={13} color={colors.text} />
                <Text className="text-xs">Catat Pembayaran</Text>
              </Button>
            ) : null}
          </View>
        }
      >
        {row.ppnMode === "include" || String(row.tipePpn || "").includes("Include") ? (
          <>
            <Line
              left="Harga Sebelum PPN (DPP)"
              right={<Text className="text-sm font-medium">{rupiah(Math.round(((Number(row.total) || 0) + (Number(row.pph) || 0)) / 1.11) || Math.round((Number(row.nilai) || 0) / 1.11))}</Text>}
            />
            <Line
              left="PPN 11% (Termasuk)"
              right={<Text className="text-sm font-semibold text-primary">{rupiah(Number(row.ppn) || Math.max(0, ((Number(row.total) || 0) + (Number(row.pph) || 0)) - Math.round(((Number(row.total) || 0) + (Number(row.pph) || 0)) / 1.11)))}</Text>}
            />
            {Number(row.pph || 0) > 0 ? (
              <Line
                left={`Pemotongan ${row.tipePph || "PPh"}`}
                right={<Text className="text-sm font-semibold text-danger">- {rupiah(row.pph || 0)}</Text>}
              />
            ) : null}
            <Line left="Total Tagihan (Inc. PPN)" right={<Text className="text-sm font-bold text-primary">{rupiah(row.total || 0)}</Text>} />
          </>
        ) : (
          <>
            <Line left="Nilai Sebelum PPN" right={<Text className="text-sm font-medium">{rupiah(row.nilai || 0)}</Text>} />
            <Line
              left={row.ppnMode === "none" || String(row.tipePpn || "").includes("No") || String(row.tipePpn || "").includes("Tanpa") ? "PPN (Tanpa PPN)" : "PPN (11%)"}
              right={<Text className="text-sm font-medium">{rupiah(row.ppn || 0)}</Text>}
            />
            {Number(row.pph || 0) > 0 ? (
              <Line
                left={`Pemotongan ${row.tipePph || "PPh"}`}
                right={<Text className="text-sm font-semibold text-danger">- {rupiah(row.pph || 0)}</Text>}
              />
            ) : null}
            <Line left="Total Tagihan" right={<Text className="text-sm font-bold">{rupiah(row.total || 0)}</Text>} />
          </>
        )}
        <Line left="Sudah Dibayar" right={<Text className="text-success text-sm font-medium">{rupiah(row.terbayar || 0)}</Text>} />
        <Line left="Sisa Tagihan" right={<Text className="text-sm font-semibold">{rupiah(sisa)}</Text>} />
        {row.fileId ? (
          <Line
            left="Dokumen Invoice"
            sub="File invoice yang diunggah / diekstrak"
            right={
              <Button
                variant="outline"
                size="sm"
                onPress={() => openFileUrl(row.fileId)}
                className="flex-row items-center gap-1.5 h-8 px-2.5"
              >
                <FileText size={13} color={colors.primary} />
                <Text className="text-xs text-primary font-semibold">Buka File Invoice</Text>
                <ExternalLink size={11} color={colors.primary} />
              </Button>
            }
          />
        ) : null}
      </Panel>

      {/* Panel Daftar & Alokasi Barang Terpakai */}
      <Panel
        title="Daftar & Alokasi Barang Terpakai"
        subtitle="Tracking stok barang dan alokasi yang dipakai pada invoice ini agar stok gudang tetap akurat."
        right={
          <Button
            size="sm"
            onPress={() => setPickerOpen(true)}
            className="flex-row items-center gap-1"
          >
            <Plus size={14} color={colors.background} />
            <Text className="text-xs">Tambah Barang</Text>
          </Button>
        }
      >
        <ConflictAndSwapBanner row={row} />

        {items.length > 0 ? (
          <View className="gap-2 pt-1">
            <View className="border border-border/80 rounded-xl overflow-hidden bg-card">
              <View className="flex-row bg-muted/60 p-2.5 border-b border-border/70">
                <Text className="text-[11px] font-bold text-muted-foreground w-8">No</Text>
                <Text className="text-[11px] font-bold text-muted-foreground flex-1">Nama Barang / SKU</Text>
                <Text className="text-[11px] font-bold text-muted-foreground w-16 text-center">Qty</Text>
                <Text className="text-[11px] font-bold text-muted-foreground w-28 text-right">Harga (Rp)</Text>
                <Text className="text-[11px] font-bold text-muted-foreground w-28 text-right">Subtotal (Rp)</Text>
                <Text className="text-[11px] font-bold text-muted-foreground w-12 text-center">Aksi</Text>
              </View>
              {items.map((it, idx) => {
                const sub = (Number(it.qty) || 1) * (Number(it.price) || 0);
                const snText = Array.isArray(it.serialNumbers) && it.serialNumbers.length > 0
                  ? it.serialNumbers.join(", ")
                  : (String(it.item).match(/\(SN:\s*([^\)]+)\)/i)?.[1] || null);

                const itemPph = calcItemPph(it);
                return (
                  <View key={it.id || idx} className="p-2.5 border-b border-border/40 last:border-b-0 gap-1.5">
                    <View className="flex-row items-center">
                      <Text className="text-xs text-muted-foreground w-8 font-mono">{idx + 1}</Text>
                      <View className="flex-1 mr-2">
                        <Text className="text-xs font-semibold text-foreground">{it.item}</Text>
                        {snText ? (
                          <Text className="text-[10px] text-primary font-mono mt-0.5">SN: {snText}</Text>
                        ) : null}
                      </View>
                      <Text className="text-xs text-foreground w-16 text-center">{it.qty} {it.unit || "unit"}</Text>
                      <Text className="text-xs text-foreground w-28 text-right">{rupiah(it.price || 0)}</Text>
                      <View className="w-28 items-end">
                        <Text className="text-xs font-semibold text-foreground">{rupiah(sub)}</Text>
                        {itemPph > 0 ? (
                          <Text className="text-[10px] text-danger font-medium">PPh: -{rupiah(itemPph)}</Text>
                        ) : null}
                      </View>
                      <View className="w-12 items-center">
                        <Button size="icon" variant="ghost" className="size-7" onPress={() => handleDeleteItem(idx)}>
                          <Trash2 size={13} color={colors.danger} />
                        </Button>
                      </View>
                    </View>

                    {/* Selector PPh Per-Item */}
                    <View className="flex-row items-center gap-1 flex-wrap pl-8">
                      <Text className="text-[10px] text-muted-foreground mr-1">Tarif PPh:</Text>
                      {PPH_MODE_OPTIONS.map((opt) => {
                        const active = (it.pphMode || "none") === opt.id;
                        return (
                          <Pressable
                            key={opt.id}
                            onPress={() => handleUpdateItemPph(idx, opt.id)}
                            className={`px-1.5 py-0.5 rounded border ${
                              active ? "bg-primary/10 border-primary" : "bg-muted/40 border-border/60"
                            }`}
                          >
                            <Text className={`text-[9px] ${active ? "text-primary font-bold" : "text-muted-foreground"}`}>
                              {opt.id === "none" ? "Non-PPh" : opt.label.split(" ")[0]}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View className="p-4 rounded-xl border border-dashed border-border/80 items-center justify-center gap-2">
            <Text className="text-xs text-muted-foreground">Belum ada barang yang dialokasikan ke invoice ini.</Text>
            <Button size="sm" variant="outline" onPress={() => setPickerOpen(true)} className="flex-row items-center gap-1.5">
              <Plus size={14} color={colors.text} />
              <Text className="text-xs">Pilih dari Stok Gudang</Text>
            </Button>
          </View>
        )}
      </Panel>

      <SerialItemPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentQuotationId={row.quotationId ? Number(row.quotationId) : undefined}
        existingItems={items}
        onAddItems={handleAddItems}
      />

      {/* Dokumen Faktur Manual */}
      <Panel
        title="Dokumen Faktur Manual"
        subtitle="Upload dokumen file invoice / penagihan manual (.pdf / .xlsx / dokumen) untuk dilampirkan ke invoice ini."
      >
        <FileUploader
          label="Pilih atau Tarik File Invoice Manual (PDF / Excel)"
          kind="dokumen"
          category="invoice"
          autoFlush
          onFilePicked={async (file) => {
            try {
              const uploadedId = await uploadFile(file, "dokumen", "invoice", { refType: "invoice", refId: row.id });
              if (!uploadedId) throw new Error("Gagal mengunggah file ke server");
              await patchRow("invoices", row.id, {
                fileUploaded: true,
                fileName: file.name,
                fileId: uploadedId,
              });
              await reload();
              toast(`File "${file.name}" berhasil diunggah!`);
            } catch (e: any) {
              toast(e?.message || "Gagal mengunggah file", "danger");
            }
          }}
        />
      </Panel>

      <Panel title="Receipt / Bukti Pembayaran Masuk" subtitle="Riwayat pembayaran customer & cetak kwitansi resmi (Receipt)">
        {payments.length > 0 ? (
          payments.map((p, idx) => (
            <Line
              key={p.id}
              left={`KW/${p.reference && p.reference !== "-" ? p.reference : `${row.nomor}/${idx + 1}`} · ${p.method}`}
              sub={`Tanggal: ${p.date}${p.reference && p.reference !== "-" ? ` · Ref: ${p.reference}` : ""}`}
              right={
                <View className="flex-row items-center gap-1.5 flex-wrap">
                  <Text className="text-sm font-semibold text-success mr-1">{rupiah(p.amount)}</Text>
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => setReceiptPreview({ ...p, idx })}
                    className="flex-row items-center gap-1 h-7 px-2"
                  >
                    <Printer size={12} color={colors.text} />
                    <Text className="text-[11px] font-medium">Receipt / Kwitansi</Text>
                  </Button>
                  {p.fileId ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={() => openFileUrl(p.fileId)}
                      className="flex-row items-center gap-1 h-7 px-2 hover:bg-panel"
                    >
                      <Paperclip size={12} color={colors.primary} />
                      <Text className="text-[11px] text-primary font-medium">Bukti Transfer</Text>
                    </Button>
                  ) : null}
                </View>
              }
            />
          ))
        ) : row.terbayar > 0 ? (
          <Line
            left={`KW/${row.nomor}/1 · Transfer`}
            sub="Bukti pembayaran tercatat"
            right={
              <View className="flex-row items-center gap-2">
                <Text className="text-sm font-semibold text-success">{rupiah(row.terbayar)}</Text>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() =>
                    setReceiptPreview({
                      id: "1",
                      amount: Number(row.terbayar) || 0,
                      date: row.tanggal || new Date().toISOString().slice(0, 10),
                      method: "TRANSFER",
                      reference: row.nomor,
                      idx: 0,
                    })
                  }
                  className="flex-row items-center gap-1 h-7 px-2"
                >
                  <Printer size={12} color={colors.text} />
                  <Text className="text-[11px] font-medium">Receipt / Kwitansi</Text>
                </Button>
              </View>
            }
          />
        ) : (
          <Text className="text-muted-foreground text-sm">Belum ada pembayaran / receipt tercatat.</Text>
        )}
      </Panel>

      <Panel
        title={`Retur Penjualan (${salesReturns.length})`}
        subtitle="Pencatatan pengembalian barang dari customer (otomatis memperbarui status SN & mutasi stok retur)"
        right={
          <Button
            size="sm"
            variant="outline"
            onPress={() => {
              const firstItem = (row.items ?? []).find((it: any) => it.productId || it.name);
              if (firstItem) {
                setReturProduct(firstItem.name || "");
                setReturSn(firstItem.serialNumber || firstItem.sn || "");
              }
              setReturOpen(true);
            }}
            className="flex-row items-center gap-1"
          >
            <RotateCcw size={13} color={colors.text} />
            <Text className="text-xs">Catat Retur Penjualan</Text>
          </Button>
        }
      >
        {salesReturns.length === 0 ? (
          <Text className="text-muted-foreground text-sm">Belum ada retur penjualan pada invoice ini.</Text>
        ) : (
          salesReturns.map((rt: Row) => (
            <Line
              key={rt.id}
              left={`${rt.produk} × ${rt.qty || 1}`}
              sub={`${rt.sn && rt.sn !== "-" ? `SN: ${rt.sn} · ` : ""}${rt.tanggal} · ${rt.keterangan}`}
              right={<StatusBadge status={rt.status || "Dilaporkan"} />}
            />
          ))
        )}
      </Panel>

      <Dialog open={!!receiptPreview} onOpenChange={(v) => !v && setReceiptPreview(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Receipt / Bukti Pembayaran Resmi</DialogTitle>
          </DialogHeader>
          {receiptPreview ? (
            <View className="border-border bg-panel/50 gap-2.5 rounded-xl border p-4">
              <View className="border-border/60 flex-row items-center justify-between border-b pb-2.5">
                <View>
                  <Text className="text-base font-bold text-foreground">KWITANSI / OFFICIAL RECEIPT</Text>
                  <Text className="text-muted-foreground text-xs">
                    No: KW/{receiptPreview.reference && receiptPreview.reference !== "-" ? receiptPreview.reference : `${row.nomor}/${receiptPreview.idx + 1}`}
                  </Text>
                </View>
                <StatusBadge status="Lunas" />
              </View>
              <Line left="Telah Terima Dari" right={<Text className="text-sm font-semibold">{row.customer}</Text>} />
              <Line left="Untuk Pembayaran" right={<Text className="text-sm font-medium">Faktur {row.nomor} ({row.jenis})</Text>} />
              <Line left="Tanggal Pembayaran" right={<Text className="text-sm">{receiptPreview.date}</Text>} />
              <Line left="Metode & Referensi" right={<Text className="text-sm">{receiptPreview.method} ({receiptPreview.reference || "-"})</Text>} />
              <View className="bg-primary/10 border-primary/30 mt-1 flex-row items-center justify-between rounded-lg border p-3">
                <Text className="text-xs font-semibold text-primary">JUMLAH DITERIMA</Text>
                <Text className="text-lg font-bold text-primary">{rupiah(receiptPreview.amount)}</Text>
              </View>
            </View>
          ) : null}
          <DialogFooter>
            {receiptPreview?.fileId ? (
              <Button variant="outline" onPress={() => openFileUrl(receiptPreview.fileId)}>
                <Paperclip size={14} color={colors.primary} />
                <Text>Buka Lampiran Transfer</Text>
              </Button>
            ) : null}
            <Button
              onPress={() => {
                if (typeof window !== "undefined" && typeof window.print === "function") {
                  window.print();
                } else {
                  toast("Kwitansi siap dicetak");
                }
              }}
            >
              <Printer size={14} color={colors.background} />
              <Text>Cetak Kwitansi</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={returOpen} onOpenChange={setReturOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Catat Retur Penjualan ({row.nomor})</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <FormField label="Barang yang Diretur" required>
              <SearchableSelect
                value={returProduct}
                onChange={(v) => {
                  setReturProduct(v);
                  const matchedInvItem = (row.items ?? []).find((it: any) => (it.name || it.nama) === v && (it.serialNumber || it.sn));
                  setReturSn(matchedInvItem ? (matchedInvItem.serialNumber || matchedInvItem.sn) : "");
                }}
                options={Array.from(
                  new Set([
                    ...(row.items ?? []).map((it: any) => String(it.name || it.nama || "")).filter(Boolean),
                    ...(data.products ?? []).filter((p: any) => p.type !== "JASA").map((p: any) => String(p.nama || "")).filter(Boolean),
                  ]),
                )}
                placeholder="Pilih barang dari invoice atau master produk..."
              />
            </FormField>
            {(() => {
              const prodObj = (data.products ?? []).find((p: any) => p.nama === returProduct || p.name === returProduct);
              const invSnList = (row.items ?? [])
                .filter((it: any) => (it.name || it.nama) === returProduct && (it.serialNumber || it.sn))
                .map((it: any) => String(it.serialNumber || it.sn));
              const masterSnList = prodObj
                ? (data.serials ?? [])
                    .filter((s: any) => String(s.productId) === String(prodObj.id) || s.produk === prodObj.nama)
                    .map((s: any) => String(s.sn))
                : [];
              const snOpts = Array.from(new Set([...invSnList, ...masterSnList])).filter(Boolean);
              if (!prodObj?.berSN && snOpts.length === 0) return null;
              return (
                <FormField label="Serial Number (SN) Barang Retur">
                  <SearchableSelect
                    value={returSn}
                    onChange={(v) => {
                      setReturSn(v);
                      setReturQty("1");
                    }}
                    options={snOpts}
                    placeholder="Pilih SN unit yang diretur..."
                  />
                </FormField>
              );
            })()}
            <FormField label="Jumlah Retur (Qty)" required>
              <Input value={returQty} onChangeText={setReturQty} keyboardType="numeric" />
            </FormField>
            <FormField label="Alasan Retur Penjualan" required>
              <Input
                value={returNote}
                onChangeText={setReturNote}
                placeholder="Contoh: Unit kamera mati total saat instalasi / tukar unit baru"
              />
            </FormField>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setReturOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSaveSalesReturn} disabled={isSavingRetur}>
              <Text>{isSavingRetur ? "Menyimpan..." : "Simpan Retur Penjualan"}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Catat Pembayaran Invoice ({row.nomor})</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <FormField label="Nominal Pembayaran (Rp)" required>
              <Input
                value={payAmount}
                onChangeText={(v) => setPayAmount(formatThousands(v))}
                keyboardType="numeric"
              />
            </FormField>
            <FormField label="Tanggal Pembayaran" required>
              <DatePicker value={payDate} onChange={setPayDate} placeholder="Pilih tanggal bayar" />
            </FormField>
            <FormField label="Metode Pembayaran" required>
              <View className="flex-row flex-wrap gap-1.5">
                {(["TRANSFER", "TUNAI", "QRIS", "LAINNYA"] as const).map((m) => (
                  <Button
                    key={m}
                    size="sm"
                    variant={payMethod === m ? "default" : "outline"}
                    onPress={() => setPayMethod(m)}
                    className="h-8 px-2.5"
                  >
                    <Text className="text-xs">{m}</Text>
                  </Button>
                ))}
              </View>
            </FormField>
            <FormField label="Nomor Referensi / Rekening">
              <Input value={payRef} onChangeText={setPayRef} placeholder="Contoh: TRF-BCA-992811" />
            </FormField>
            <View>
              <FileUploader
                label="Upload Bukti Pembayaran / Transfer (Wajib - JPG / PNG / PDF)"
                kind="semua"
                category="foto-struk"
                autoFlush
                required
                onUploaded={(fId) => setPayFileId(fId)}
              />
              {payFileId ? (
                <Text className="text-[11px] text-success mt-1 font-medium">
                  ✓ Bukti pembayaran tersimpan (File ID: #{payFileId})
                </Text>
              ) : (
                <Text className="text-[11px] text-danger mt-1">
                  * Bukti pembayaran wajib diunggah sebelum menyimpan
                </Text>
              )}
            </View>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setPayOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSavePayment} disabled={isSubmittingPay || !payFileId}>
              <Text>{isSubmittingPay ? "Menyimpan..." : "Simpan Pembayaran"}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
