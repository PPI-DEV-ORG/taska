import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  CheckCircle2,
  DownloadCloud,
  Edit2,
  ExternalLink,
  Package,
  Plus,
  Printer,
  RefreshCw,
  Trash2,
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";
import { Panel, Cell, FormField } from "@/components/taska/basics";
import { SearchableSelect } from "@/components/taska/dialogs";
import { StatusBadge } from "@/components/taska/status-badge";
import { useApp } from "@/store/app-store";
import { api } from "@/services/api";
import { colors } from "@/tokens";
import { rupiah, tanggal } from "@/lib/format";
import { type Row } from "@/constants/modules";
import { Line } from "@/modules/shared/line";
import { LeadExtras } from "@/modules/lead/lead-extras";
import { QuotationExtras } from "@/modules/quotation/quotation-extras";
import { SurveyExtras } from "@/modules/survey/survey-extras";
import { ReceivingExtras } from "@/modules/receiving/receiving-extras";
import { DeliveryNotesExtras } from "@/modules/delivery-note/delivery-note-extras";
import { ProjectExtras } from "@/modules/project/project-extras";
import { InvoiceExtras } from "@/modules/invoice/invoice-extras";
import { SupplierPoExtras } from "@/modules/supplier-po/supplier-po-extras";
import { PurchaseRequestExtras } from "@/modules/purchase-request/purchase-request-extras";
import { printOrderDocument } from "@/lib/order-print";
import { SerialItemPickerModal } from "@/components/taska/serial-item-picker";

// Re-export agar import lama dari "@/screens/module-extras" tetap valid.
export { downloadQuotationTemplate, downloadQuotationPdf } from "@/modules/quotation/quotation-files";
export { QuotationPreviewModal } from "@/modules/quotation/quotation-preview-modal";
export { QuotationTemplateGenerator } from "@/modules/quotation/quotation-template-generator";
export type { QuotationItem } from "@/modules/quotation/types";

function DamageReportExtras({ row, onRefresh }: { row: Row; onRefresh?: () => Promise<void> | void }) {
  const { data, toast, reload, refreshModule } = useApp();
  const [replaceOpen, setReplaceOpen] = React.useState(false);
  const [newSn, setNewSn] = React.useState("");
  const [replaceQty, setReplaceQty] = React.useState(String(row.qty || 1));
  const [warehouseName, setWarehouseName] = React.useState(String(data.warehouses?.[0]?.nama ?? ""));
  const [reason, setReason] = React.useState(`Penggantian unit ${row.produk}${row.sn && row.sn !== "-" ? ` (SN lama: ${row.sn})` : ""}`);
  const [busy, setBusy] = React.useState(false);

  const prodObj = (data.products ?? []).find(
    (p: any) => String(p.id) === String(row.productId) || p.nama === row.produk,
  );
  const isSerialProduct = !!(row.hasSerial || prodObj?.berSN || prodObj?.hasSerial || (row.sn && row.sn !== "-"));
  const alreadyReplaced = row.snPengganti && row.snPengganti !== "-";

  async function handleReceiveReplacement() {
    if (isSerialProduct && !newSn.trim()) {
      toast("Masukkan nomor Serial Number (SN) baru untuk unit pengganti", "danger");
      return;
    }
    const wh = (data.warehouses ?? []).find((w: any) => w.nama === warehouseName) ?? data.warehouses?.[0];
    setBusy(true);
    try {
      await api("POST", `/damages/${row.id}/replace`, {
        newSn: isSerialProduct ? newSn.trim() : undefined,
        qty: Number(replaceQty) || 1,
        warehouseId: wh?.id ? Number(wh.id) : undefined,
        reason: reason.trim() || `Penggantian unit dari laporan #${row.id}`,
      });
      toast(
        isSerialProduct
          ? `Unit pengganti SN ${newSn.trim()} berhasil diterima & stok bertambah +1`
          : `Barang pengganti (${replaceQty} unit) berhasil diterima ke stok gudang`,
      );
      setReplaceOpen(false);
      setNewSn("");
      if (refreshModule) {
        await Promise.all([
          refreshModule("damage-reports"),
          refreshModule("serials"),
          refreshModule("movements"),
          refreshModule("products"),
        ]);
      }
      await reload();
      if (onRefresh) await onRefresh();
    } catch (e: any) {
      toast(e?.message || "Gagal memproses penerimaan unit pengganti", "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Panel
        title="Alur Penggantian Barang & Dampak Stok Gudang"
        subtitle="Status mutasi stok atas laporan kerusakan / retur dan penerimaan barang pengganti"
        right={
          !alreadyReplaced ? (
            <Button size="sm" onPress={() => setReplaceOpen(true)}>
              <RefreshCw size={14} color={colors.background} />
              <Text className="text-xs font-semibold text-primary-foreground">Terima Barang Pengganti</Text>
            </Button>
          ) : undefined
        }
      >
        <View className="gap-3">
          <View className="bg-panel/60 border-border/80 rounded-xl border p-3 gap-2">
            <View className="flex-row items-center justify-between flex-wrap gap-2">
              <Text className="text-xs font-semibold text-foreground">
                1. Saat Laporan Kerusakan / Retur Dicatat:
              </Text>
              <StatusBadge status={row.sn && row.sn !== "-" ? `SN Lama: ${row.sn}` : `${row.qty || 1} Unit`} />
            </View>
            <Text className="text-xs text-muted-foreground leading-relaxed">
              • Status unit SN lama ({row.sn && row.sn !== "-" ? row.sn : "barang terkait"}) otomatis berubah menjadi{" "}
              <Text className="font-semibold text-danger">{row.jenis?.includes("Retur") ? "RETUR" : "RUSAK"}</Text>{" "}
              (atau <Text className="font-semibold text-foreground">DIGANTI</Text> setelah unit baru tiba).{"\n"}
              • Saldo stok bagus yang siap pakai di gudang otomatis <Text className="font-semibold text-danger">berkurang (-{row.qty || 1})</Text> agar tidak terpilih di Penawaran/Invoice baru.
            </Text>
          </View>

          <View className="bg-panel/60 border-border/80 rounded-xl border p-3 gap-2">
            <View className="flex-row items-center justify-between flex-wrap gap-2">
              <Text className="text-xs font-semibold text-foreground">
                2. Saat Barang Pengganti Diterima Kembali:
              </Text>
              {alreadyReplaced ? (
                <View className="flex-row items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                  <CheckCircle2 size={13} color="#10b981" />
                  <Text className="text-xs font-bold text-emerald-500">
                    Diganti dengan: {row.snPengganti}
                  </Text>
                </View>
              ) : (
                <StatusBadge status="Menunggu Unit Pengganti" />
              )}
            </View>
            <Text className="text-xs text-muted-foreground leading-relaxed">
              {alreadyReplaced
                ? `Unit pengganti (${row.snPengganti}) sudah diterima dan masuk ke stok gudang (+${row.qty || 1} tersedia) dengan status DI GUDANG, serta terhubung langsung dengan riwayat SN lama (${row.sn}).`
                : "Ketika unit pengganti dari supplier/garansi tiba (misal SN baru), klik tombol 'Terima Barang Pengganti' di atas. Sistem otomatis mendaftarkan SN baru ke gudang, menambah kembali stok tersedia (+1), menautkan SN lama → SN baru, dan menutup laporan ini menjadi Selesai."}
            </Text>
          </View>
        </View>
      </Panel>

      <Dialog open={replaceOpen} onOpenChange={setReplaceOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Terima Barang / Unit Pengganti</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <View className="bg-panel border-border rounded-lg border p-3 gap-1">
              <Text className="text-xs text-muted-foreground">Barang yang Diganti:</Text>
              <Text className="text-sm font-bold text-foreground">{row.produk}</Text>
              {row.sn && row.sn !== "-" ? (
                <Text className="text-xs font-mono text-danger">SN Lama (Rusak/Retur): {row.sn}</Text>
              ) : null}
            </View>

            {isSerialProduct ? (
              <FormField label="Serial Number (SN) Unit Pengganti Baru" required>
                <Input
                  value={newSn}
                  onChangeText={setNewSn}
                  placeholder="Contoh: 94949 / Scan barcode SN baru..."
                  autoCapitalize="characters"
                />
              </FormField>
            ) : (
              <FormField label="Jumlah (Qty) Pengganti Diterima" required>
                <Input
                  value={replaceQty}
                  onChangeText={setReplaceQty}
                  keyboardType="numeric"
                  placeholder="1"
                />
              </FormField>
            )}

            <FormField label="Gudang Penerima">
              <SearchableSelect
                value={warehouseName || String(data.warehouses?.[0]?.nama ?? "")}
                onChange={setWarehouseName}
                options={(data.warehouses ?? []).map((w: any) => String(w.nama))}
                placeholder="Pilih gudang..."
              />
            </FormField>

            <FormField label="Catatan / Alasan Penggantian" required>
              <Textarea
                value={reason}
                onChangeText={setReason}
                placeholder="Contoh: Unit pengganti klaim garansi / retur dari supplier"
              />
            </FormField>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setReplaceOpen(false)} disabled={busy}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleReceiveReplacement} disabled={busy}>
              <Text>{busy ? "Memproses..." : "Simpan & Tambah ke Stok"}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ClientPoExtras({ row, onRefresh }: { row: Row; onRefresh?: () => Promise<void> | void }) {
  const router = useRouter();
  const { data, patchRow, toast } = useApp();

  const cleanQuoNum = String(row.penawaran || "").split(" - ")[0]?.trim().toLowerCase();
  const linkedQuotation = (data.quotations ?? []).find(
    (q: Row) =>
      (row.quotationId && String(q.id) === String(row.quotationId)) ||
      (cleanQuoNum && cleanQuoNum !== "-" && String(q.nomor || "").toLowerCase() === cleanQuoNum),
  );
  const quoItems: any[] = Array.isArray(linkedQuotation?.items) ? linkedQuotation.items : [];

  const linkedInvoices = (data.invoices ?? []).filter(
    (inv: Row) =>
      inv.direction !== "in" &&
      ((inv.clientPoId && String(inv.clientPoId) === String(row.id)) ||
        (inv.po && inv.po !== "-" && (
          String(inv.po).toLowerCase() === String(row.nomor || "").toLowerCase() ||
          String(inv.po).toLowerCase() === String(row.nomorPoClient || "").toLowerCase() ||
          String(inv.po).toLowerCase() === String(row.nomorSo || "").toLowerCase()
        )) ||
        (linkedQuotation && String(inv.quotationId) === String(linkedQuotation.id))),
  );

  const invWithItems = linkedInvoices.find((inv: any) => Array.isArray(inv.items) && inv.items.length > 0);
  const invoiceItems: any[] = invWithItems ? invWithItems.items : [];

  const currentItems: any[] = Array.isArray(row.items) && row.items.length > 0
    ? row.items
    : (quoItems.length > 0 ? quoItems : (invoiceItems.length > 0 ? invoiceItems : []));

  const getItemName = (it: any) => it.item || it.name || it.nama || it.productName || "Barang / Jasa";
  const getItemQty = (it: any) => Number(it.qty) || 1;
  const getItemUnit = (it: any) => it.satuan || it.unit || "Unit";
  const getItemPrice = (it: any) => Number(it.harga ?? it.price ?? 0);
  const getItemSn = (it: any) =>
    it.sn ||
    (Array.isArray(it.serialNumbers)
      ? it.serialNumbers.join(", ")
      : typeof it.serialNumbers === "string"
        ? it.serialNumbers
        : "");

  const itemsTotal = currentItems.reduce((acc, it) => acc + getItemQty(it) * getItemPrice(it), 0);

  // Dialog state
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [itemDialogOpen, setItemDialogOpen] = React.useState(false);
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [itemName, setItemName] = React.useState("");
  const [itemQty, setItemQty] = React.useState("1");
  const [itemSatuan, setItemSatuan] = React.useState("Unit");
  const [itemHarga, setItemHarga] = React.useState("0");
  const [itemSn, setItemSn] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const saveItems = async (newItems: any[], updateAmount = true) => {
    setSaving(true);
    try {
      const patchPayload: Record<string, any> = { items: newItems };
      if (updateAmount) {
        const sum = newItems.reduce((acc, it) => acc + getItemQty(it) * getItemPrice(it), 0);
        if (sum > 0) {
          patchPayload.nilai = sum;
          patchPayload.amount = sum;
        }
      }
      await patchRow("po-client", row.id, patchPayload);
      await onRefresh?.();
      toast("Daftar barang / jasa berhasil diperbarui");
    } catch (err: any) {
      toast(`Gagal menyimpan: ${err?.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  const openAddItem = () => {
    setEditingIndex(null);
    setItemName("");
    setItemQty("1");
    setItemSatuan("Unit");
    setItemHarga("0");
    setItemSn("");
    setItemDialogOpen(true);
  };

  const openEditItem = (idx: number) => {
    const target = currentItems[idx];
    setEditingIndex(idx);
    setItemName(getItemName(target));
    setItemQty(String(getItemQty(target)));
    setItemSatuan(getItemUnit(target));
    setItemHarga(String(getItemPrice(target)));
    setItemSn(getItemSn(target));
    setItemDialogOpen(true);
  };

  const handleSaveItem = async () => {
    if (!itemName.trim()) {
      toast("Nama barang / jasa wajib diisi");
      return;
    }
    const qty = parseFloat(itemQty) || 1;
    const harga = parseFloat(itemHarga) || 0;
    const newItemObj = {
      item: itemName.trim(),
      qty,
      satuan: itemSatuan.trim() || "Unit",
      harga,
      sn: itemSn.trim() || undefined,
    };

    const updated = [...currentItems];
    if (editingIndex !== null && editingIndex >= 0 && editingIndex < updated.length) {
      updated[editingIndex] = newItemObj;
    } else {
      updated.push(newItemObj);
    }

    setItemDialogOpen(false);
    await saveItems(updated, true);
  };

  const handleDeleteItem = async (idx: number) => {
    const updated = currentItems.filter((_, i) => i !== idx);
    await saveItems(updated, true);
  };

  const pullFromQuotation = async () => {
    if (!quoItems.length) {
      toast("Penawaran terkait tidak memiliki item");
      return;
    }
    await saveItems(quoItems, true);
  };

  const pullFromInvoice = async () => {
    if (!invoiceItems.length) {
      toast("Invoice terkait tidak memiliki item");
      return;
    }
    await saveItems(invoiceItems, true);
  };

  const sisa = row.nilai - row.totalInvoice;
  const linkedProjects = (data.projects ?? []).filter(
    (p: Row) =>
      (linkedQuotation && String(p.quotationId) === String(linkedQuotation.id)) ||
      (row.customer && p.customer === row.customer),
  );
  const linkedDeliveryNotes = (data["delivery-notes"] ?? []).filter(
    (dn: Row) =>
      linkedProjects.some((p: Row) => String(dn.projectId) === String(p.id) || dn.project === p.nama) ||
      (row.customer && String(dn.tujuan || "").toLowerCase().includes(String(row.customer).toLowerCase())),
  );

  const isPoActive = row.nomorPoClient && row.nomorPoClient !== "-";
  const isSoActive = row.nomorSo && row.nomorSo !== "-";
  const hasPoFile = !!(row.fileId || row.file?.id);
  const hasSoFile = !!(row.soFileId || row.soFile?.id);

  return (
    <>
      {row.totalInvoice > row.nilai ? (
        <View className="bg-warning/15 flex-row items-center gap-2 rounded-xl p-3">
          <AlertTriangle size={16} color={colors.warning} />
          <Text className="text-warning flex-1 text-sm">
            Total invoice melebihi nilai Sales Order / PO sebesar {rupiah(-sisa)}. Ini hanya peringatan, data tetap tersimpan.
          </Text>
        </View>
      ) : null}

      <Panel
        title="Alur Keterkaitan Dokumen: PO Customer ↔ Sales Order (SO) Kita"
        subtitle="Sisi Penjualan (Sales) & Pembelian (Procurement): Dokumen PO dan SO saling melengkapi alur pengadaan & penagihan"
        right={
          linkedQuotation ? (
            <Button size="sm" variant="outline" onPress={() => router.push(`/quotations/${linkedQuotation.id}` as any)}>
              <ExternalLink size={13} color={colors.text} />
              <Text className="text-xs">Penawaran ({linkedQuotation.nomor})</Text>
            </Button>
          ) : undefined
        }
      >
        <View className="gap-2.5">
          <View className="bg-panel/60 border-border/80 rounded-xl border p-3 gap-1.5">
            <View className="flex-row items-center justify-between flex-wrap gap-2">
              <Text className="text-xs font-bold text-foreground">
                1. Purchase Order (PO) — Dokumen Pemesanan
              </Text>
              <View className="flex-row items-center gap-1.5">
                <StatusBadge status={hasPoFile ? "File PO Terlampir" : isPoActive ? "PO Aktif" : "Belum Ada PO"} />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 flex-row items-center gap-1"
                  onPress={() =>
                    printOrderDocument({
                      docType: "PO",
                      docNumber: row.nomorPoClient && row.nomorPoClient !== "-" ? row.nomorPoClient : (row.nomor || `PO/${row.id}`),
                      refNumber: row.nomorSo && row.nomorSo !== "-" ? row.nomorSo : undefined,
                      date: row.tanggal,
                      counterpartyLabel: row.customer && row.customer !== "-" ? "Customer" : row.supplier && row.supplier !== "-" ? "Supplier" : "Pihak Terkait",
                      counterpartyName: row.customer && row.customer !== "-" ? row.customer : row.supplier && row.supplier !== "-" ? row.supplier : "-",
                      items: currentItems,
                      totalAmount: Number(row.nilai) || 0,
                      notes: row.catatan,
                    })
                  }
                >
                  <Printer size={12} color={colors.text} />
                  <Text className="text-[11px]">Buat / Cetak PDF PO</Text>
                </Button>
              </View>
            </View>
            <Text className="text-xs text-muted-foreground">
              Nomor PO: <Text className="font-semibold text-foreground">{row.nomorPoClient || row.nomor || "-"}</Text> · Pihak:{" "}
              <Text className="font-semibold text-foreground">{row.customer && row.customer !== "-" ? row.customer : row.supplier && row.supplier !== "-" ? row.supplier : "-"}</Text>
            </Text>
            <Text className="text-[11px] text-muted-foreground">
              Dokumen resmi pemesanan barang/jasa. Anda dapat membuat/mencetak PDF PO atau mengunggah file PO di panel File & Bukti Pendukung.
            </Text>
          </View>

          <View className="bg-panel/60 border-border/80 rounded-xl border p-3 gap-1.5">
            <View className="flex-row items-center justify-between flex-wrap gap-2">
              <Text className="text-xs font-bold text-foreground">
                2. Sales Order (SO) — Dokumen Konfirmasi Pesanan
              </Text>
              <View className="flex-row items-center gap-1.5">
                <StatusBadge status={hasSoFile ? "File SO Terlampir" : isSoActive ? "SO Aktif" : "Belum Ada SO"} />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 flex-row items-center gap-1"
                  onPress={() =>
                    printOrderDocument({
                      docType: "SO",
                      docNumber: row.nomorSo && row.nomorSo !== "-" ? row.nomorSo : (row.nomor || `SO/${row.id}`),
                      refNumber: row.nomorPoClient && row.nomorPoClient !== "-" ? row.nomorPoClient : undefined,
                      date: row.tanggal,
                      counterpartyLabel: row.customer && row.customer !== "-" ? "Customer (Pembeli)" : row.supplier && row.supplier !== "-" ? "Supplier" : "Pihak Terkait",
                      counterpartyName: row.customer && row.customer !== "-" ? row.customer : row.supplier && row.supplier !== "-" ? row.supplier : "-",
                      items: currentItems,
                      totalAmount: Number(row.nilai) || 0,
                      notes: row.catatan,
                    })
                  }
                >
                  <Printer size={12} color={colors.text} />
                  <Text className="text-[11px]">Buat / Cetak PDF SO</Text>
                </Button>
              </View>
            </View>
            <Text className="text-xs text-muted-foreground">
              Nomor SO: <Text className="font-semibold text-primary">{row.nomorSo || "-"}</Text> · Tanggal:{" "}
              <Text className="font-semibold text-foreground">{row.tanggal || "-"}</Text>
            </Text>
            <Text className="text-[11px] text-muted-foreground">
              Konfirmasi kesanggupan pemenuhan pesanan sekaligus acuan kerja Gudang untuk mencetak Delivery Order (Surat Jalan) & Finance untuk menerbitkan Invoice.
            </Text>
          </View>
        </View>

        <View className="mt-3 pt-2 border-t border-border/60">
          <Line left="Total Nilai Pesanan (PO / SO)" right={<Text className="text-sm font-semibold">{rupiah(row.nilai)}</Text>} />
          <Line left="Total Faktur / Invoice Terbit" right={<Text className="text-sm font-medium">{rupiah(row.totalInvoice)}</Text>} />
          <Line left="Sisa Belum Ditagih" right={<Text className="text-sm font-medium text-primary">{rupiah(Math.max(0, sisa))}</Text>} />
        </View>
      </Panel>

      <Panel
        title={`Daftar Barang & Jasa (${currentItems.length})`}
        subtitle="Rincian pesanan yang tertera pada dokumen PO & Sales Order (SO)"
        right={
          <View className="flex-row items-center gap-1.5 flex-wrap">
            {quoItems.length > 0 ? (
              <Button size="sm" variant="outline" className="h-7 px-2 flex-row items-center gap-1" onPress={pullFromQuotation}>
                <DownloadCloud size={12} color={colors.text} />
                <Text className="text-[11px]">Tarik dari Penawaran</Text>
              </Button>
            ) : null}
            {invoiceItems.length > 0 ? (
              <Button size="sm" variant="outline" className="h-7 px-2 flex-row items-center gap-1" onPress={pullFromInvoice}>
                <DownloadCloud size={12} color={colors.text} />
                <Text className="text-[11px]">Tarik dari Invoice</Text>
              </Button>
            ) : null}
            <Button size="sm" variant="outline" className="h-7 px-2 flex-row items-center gap-1" onPress={openAddItem}>
              <Plus size={12} color={colors.text} />
              <Text className="text-[11px]">Ketik Manual</Text>
            </Button>
            <Button size="sm" className="h-7 px-2 flex-row items-center gap-1" onPress={() => setPickerOpen(true)}>
              <Package size={12} color="#fff" />
              <Text className="text-[11px] text-white">Pilih dari Stok / Jasa</Text>
            </Button>
          </View>
        }
      >
        {currentItems.length === 0 ? (
          <View className="py-6 items-center justify-center gap-2">
            <Package size={30} color={colors.muted} />
            <Text className="text-muted-foreground text-xs text-center max-w-sm">
              Belum ada rincian barang/jasa. Anda dapat memilih barang dari stok & SN, mengetik manual, atau menarik dari Penawaran/Invoice terkait.
            </Text>
            <View className="flex-row items-center gap-2 mt-2">
              <Button size="sm" variant="outline" className="h-8 px-3 flex-row items-center gap-1.5" onPress={openAddItem}>
                <Plus size={13} color={colors.text} />
                <Text className="text-xs">Ketik Manual</Text>
              </Button>
              <Button size="sm" className="h-8 px-3 flex-row items-center gap-1.5" onPress={() => setPickerOpen(true)}>
                <Package size={13} color="#fff" />
                <Text className="text-xs text-white">Pilih dari Stok / Jasa</Text>
              </Button>
            </View>
          </View>
        ) : (
          <View className="gap-2">
            {currentItems.map((it, idx) => {
              const name = getItemName(it);
              const qty = getItemQty(it);
              const unit = getItemUnit(it);
              const price = getItemPrice(it);
              const sub = qty * price;
              const sn = getItemSn(it);

              return (
                <View
                  key={idx}
                  className="flex-row items-center justify-between p-2.5 rounded-lg border border-border/70 bg-card/50 gap-2"
                >
                  <View className="flex-1 min-w-0">
                    <View className="flex-row items-center gap-1.5 flex-wrap">
                      <Text className="text-xs font-semibold text-foreground">{name}</Text>
                      <View className="bg-primary/10 px-1.5 py-0.5 rounded">
                        <Text className="text-[10px] font-bold text-primary">
                          {qty} {unit}
                        </Text>
                      </View>
                    </View>
                    {sn ? (
                      <Text className="text-[11px] text-muted-foreground mt-0.5">SN: {sn}</Text>
                    ) : null}
                    <Text className="text-[11px] text-muted-foreground mt-0.5">
                      {price > 0 ? `${rupiah(price)} / ${unit}` : "Harga belum ditentukan"}
                    </Text>
                  </View>

                  <View className="shrink-0 items-end gap-1">
                    <Text className="text-xs font-bold text-foreground">
                      {sub > 0 ? rupiah(sub) : "-"}
                    </Text>
                    <View className="flex-row items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 items-center justify-center"
                        onPress={() => openEditItem(idx)}
                      >
                        <Edit2 size={12} color={colors.text} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 items-center justify-center"
                        onPress={() => handleDeleteItem(idx)}
                      >
                        <Trash2 size={12} color={colors.danger} />
                      </Button>
                    </View>
                  </View>
                </View>
              );
            })}

            <View className="mt-2 pt-2 border-t border-border/60 flex-row justify-between items-center">
              <Text className="text-xs font-semibold text-foreground">Total Rincian Item</Text>
              <Text className="text-xs font-bold text-primary">{rupiah(itemsTotal)}</Text>
            </View>
          </View>
        )}
      </Panel>

      <Panel
        title={`Delivery Order (DO) / Surat Jalan Terkait (${linkedDeliveryNotes.length})`}
        subtitle="Tindak lanjut SO oleh tim Gudang/Teknisi untuk pengiriman barang ke customer"
        right={
          <Button size="sm" variant="outline" onPress={() => router.push("/delivery-notes" as any)}>
            <Text className="text-xs">Kelola Surat Jalan</Text>
          </Button>
        }
      >
        {linkedDeliveryNotes.length === 0 ? (
          <Text className="text-muted-foreground text-sm py-1">Belum ada Delivery Order (Surat Jalan) untuk SO ini.</Text>
        ) : (
          linkedDeliveryNotes.map((dn: Row) => (
            <Line
              key={dn.id}
              left={`${dn.nomor} · ${dn.tujuan || row.customer}`}
              sub={`Tanggal ${dn.tanggal} · Barang: ${dn.barang || "-"}`}
              right={
                <View className="flex-row items-center gap-2">
                  <Cell fmt="status" value={dn.status} />
                  <Button size="sm" variant="outline" onPress={() => router.push(`/delivery-notes/${dn.id}` as any)}>
                    <Text className="text-xs">Buka DO</Text>
                  </Button>
                </View>
              }
            />
          ))
        )}
      </Panel>

      <Panel
        title={`Faktur Penjualan / Invoice Terkait (${linkedInvoices.length})`}
        subtitle="Penagihan pembayaran oleh Finance berdasarkan SO & PO Customer"
        right={
          <Button size="sm" variant="outline" onPress={() => router.push("/invoices" as any)}>
            <Text className="text-xs">Kelola Invoice</Text>
          </Button>
        }
      >
        {linkedInvoices.length === 0 ? (
          <Text className="text-muted-foreground text-sm py-1">Belum ada invoice untuk Sales Order / PO ini.</Text>
        ) : (
          linkedInvoices.map((inv: Row) => (
            <Line
              key={inv.id}
              left={`${inv.nomor} (${inv.jenis})`}
              sub={`Total ${rupiah(inv.total)} · Terbayar ${rupiah(inv.terbayar)}`}
              right={
                <View className="flex-row items-center gap-2">
                  <Cell fmt="status" value={inv.status} />
                  <Button size="sm" variant="outline" onPress={() => router.push(`/invoices/${inv.id}` as any)}>
                    <Text className="text-xs">Buka</Text>
                  </Button>
                </View>
              }
            />
          ))
        )}
      </Panel>

      {linkedProjects.length > 0 ? (
        <Panel title={`Project Terkait (${linkedProjects.length})`}>
          {linkedProjects.map((proj: Row) => (
            <Line
              key={proj.id}
              left={proj.nama}
              sub={`PIC: ${proj.pm || "-"} · Progres ${proj.progres ?? 0}%`}
              right={
                <View className="flex-row items-center gap-2">
                  <Cell fmt="status" value={proj.status} />
                  <Button size="sm" variant="outline" onPress={() => router.push(`/projects/${proj.id}` as any)}>
                    <Text className="text-xs">Buka Project</Text>
                  </Button>
                </View>
              }
            />
          ))}
        </Panel>
      ) : null}

      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-md w-[92vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>
              {editingIndex !== null ? "Edit Barang / Jasa" : "Tambah Barang / Jasa"}
            </DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <FormField label="Nama Barang / Jasa" required>
              <Input
                value={itemName}
                onChangeText={setItemName}
                placeholder="Contoh: Router Mikrotik RB750Gr3"
              />
            </FormField>

            <View className="flex-row gap-2">
              <View className="flex-1">
                <FormField label="Jumlah (Qty)" required>
                  <Input
                    value={itemQty}
                    onChangeText={setItemQty}
                    keyboardType="numeric"
                    placeholder="1"
                  />
                </FormField>
              </View>
              <View className="flex-1">
                <FormField label="Satuan">
                  <Input
                    value={itemSatuan}
                    onChangeText={setItemSatuan}
                    placeholder="Unit, Pcs, dll"
                  />
                </FormField>
              </View>
            </View>

            <FormField label="Harga Satuan (Rp)">
              <Input
                value={itemHarga}
                onChangeText={setItemHarga}
                keyboardType="numeric"
                placeholder="0"
              />
            </FormField>

            <FormField label="Serial Number (SN) / Keterangan (Opsional)">
              <Input
                value={itemSn}
                onChangeText={setItemSn}
                placeholder="SN12345678 / Keterangan spesifikasi"
              />
            </FormField>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setItemDialogOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSaveItem} disabled={saving}>
              <Text className="text-white">{saving ? "Menyimpan..." : "Simpan Item"}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SerialItemPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentQuotationId={row.quotationId ?? undefined}
        onAddItems={async (newItems) => {
          setPickerOpen(false);
          const updated = [...currentItems, ...newItems];
          await saveItems(updated, true);
        }}
      />
    </>
  );
}

export function ModuleExtras({
  moduleKey,
  row,
  onRefresh,
  invoicePayOpen,
  onInvoicePayOpenChange,
}: {
  moduleKey: string;
  row: Row;
  onRefresh?: () => Promise<void> | void;
  invoicePayOpen?: boolean;
  onInvoicePayOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const { user, data } = useApp();

  if (moduleKey === "leads") {
    return <LeadExtras row={row} />;
  }

  if (moduleKey === "quotations") {
    return <QuotationExtras row={row} onRefresh={onRefresh} />;
  }

  if (moduleKey === "surveys") {
    return <SurveyExtras row={row} />;
  }

  if (moduleKey === "projects") {
    return <ProjectExtras row={row} />;
  }

  if (moduleKey === "po-client") {
    return <ClientPoExtras row={row} onRefresh={onRefresh} />;
  }

  if (moduleKey === "invoices") {
    return (
      <InvoiceExtras
        row={row}
        payOpen={invoicePayOpen}
        onPayOpenChange={onInvoicePayOpenChange}
      />
    );
  }

  if (moduleKey === "supplier-pos") {
    return <SupplierPoExtras row={row} />;
  }

  if (moduleKey === "purchase-requests") {
    return <PurchaseRequestExtras row={row} onRefresh={onRefresh} />;
  }

  if (moduleKey === "delivery-notes") {
    return <DeliveryNotesExtras row={row} onRefresh={onRefresh} />;
  }

  if (moduleKey === "expenses") {
    return row.nominal > 10_000_000 ? (
      <View className="bg-warning/15 flex-row items-center gap-2 rounded-xl p-3">
        <AlertTriangle size={16} color={colors.warning} />
        <Text className="text-warning flex-1 text-sm">Nominal besar. Perlu persetujuan Bos selain Finance.</Text>
      </View>
    ) : null;
  }

  if (moduleKey === "receiving") {
    return <ReceivingExtras row={row} />;
  }

  if (moduleKey === "damage-reports") {
    return <DamageReportExtras row={row} onRefresh={onRefresh} />;
  }

  if (moduleKey === "customers") {
    const leads = (data.leads ?? []).filter((l: Row) => l.perusahaan === row.nama);
    return (
      <Panel title={`Lead milik customer ini (${leads.length})`}>
        {leads.length === 0 ? <Text className="text-muted-foreground text-sm">Belum ada lead.</Text> : leads.map((l) => (
          <Line key={l.id} left={l.nama} sub={`Perkiraan closing ${tanggal(l.closing)}`} right={<Cell fmt="status" value={l.status} />} />
        ))}
      </Panel>
    );
  }

  if (moduleKey === "opname") {
    const details = row._details ?? [];
    return (
      <Panel title={`Rincian Hitungan Fisik (${details.length} Produk)`} subtitle="Perbandingan stok sistem vs hitungan riil di gudang">
        {details.length === 0 ? (
          <Text className="text-muted-foreground text-sm py-2">Belum ada rincian produk.</Text>
        ) : (
          <View className="gap-2">
            {details.map((d: any, idx: number) => {
              const productName = d.product?.name ?? `Produk #${d.productId}`;
              const sku = d.product?.sku ? `SKU: ${d.product.sku} · ` : "";
              const unit = d.product?.unit ? ` ${d.product.unit}` : "";
              const diff = Number(d.diff ?? 0);
              return (
                <View
                  key={d.id ?? idx}
                  className="border-border/60 flex-row items-center justify-between border-b py-3 last:border-b-0"
                >
                  <View className="flex-1 min-w-0 pr-3">
                    <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                      {productName}
                    </Text>
                    <Text className="text-muted-foreground text-xs mt-0.5">
                      {sku}Sistem: {d.systemQty}{unit} · Fisik: {d.countedQty}{unit}
                    </Text>
                    {d.note ? (
                      <Text className="text-muted-foreground text-[11px] italic mt-0.5">Catatan: {d.note}</Text>
                    ) : null}
                  </View>
                  <View className="items-end shrink-0">
                    {diff === 0 ? (
                      <Text className="text-success text-xs font-semibold">Cocok (0)</Text>
                    ) : diff < 0 ? (
                      <Text className="text-danger text-xs font-semibold">{diff}{unit}</Text>
                    ) : (
                      <Text className="text-info text-xs font-semibold">+{diff}{unit}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Panel>
    );
  }

  return null;
}
