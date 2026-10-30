import * as React from "react";
import { View, ScrollView, Image, Pressable } from "react-native";
import { FileDown, Plus, Trash2, Edit3, Eye, Package } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Panel } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { SearchableSelect } from "@/components/taska/dialogs";
import { SerialItemPickerModal } from "@/components/taska/serial-item-picker";
import { colors } from "@/tokens";
import { rupiah, formatThousands } from "@/lib/format";
import { type Row } from "@/constants/modules";
import { type QuotationItem } from "@/modules/quotation/types";
import { QuotationPreviewModal } from "@/modules/quotation/quotation-preview-modal";
import { FileUploader } from "@/components/taska/file-uploader";
import { apiBase } from "@/services/api";
import { downloadInvoiceExcel, downloadInvoicePdf } from "@/modules/invoice/invoice-files";
import { useApp } from "@/store/app-store";
import {
  type PphMode,
  PPH_MODE_OPTIONS,
  pphRateFor,
  pphModeToTipe,
  calcItemPph,
} from "@/modules/quotation/lib";

export function InvoiceTemplateGenerator({
  row,
  onUpdateInvoice,
}: {
  row: Row;
  onUpdateInvoice: (
    items: QuotationItem[],
    newAmount: number,
    meta?: {
      subject?: string;
      intro?: string;
      notesList?: string[];
      city?: string;
      kopText?: string;
      kopLogoUrl?: string;
      customerAddress?: string;
      signerName?: string;
      signerTitle?: string;
      dpLabel?: string;
      dpAmount?: number;
    },
    shouldDownload?: boolean,
  ) => Promise<void> | void;
}) {
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [editItemsOpen, setEditItemsOpen] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const initialItems: QuotationItem[] = React.useMemo(() => {
    if (Array.isArray(row.items) && row.items.length > 0) return row.items;
    return [
      {
        id: "1",
        item: row.catatan || row.description || "Pengadaan Barang & Jasa",
        qty: 1,
        satuan: "Lot",
        harga: Number(row.nilai || row.amount || 0),
      },
    ];
  }, [row.items, row.catatan, row.description, row.nilai, row.amount]);

  const [items, setItems] = React.useState<QuotationItem[]>(initialItems);
  const [kopText, setKopText] = React.useState<string>(row.kopText || "");
  const [kopLogoUrl, setKopLogoUrl] = React.useState<string>((row as any).kopLogoUrl || "");
  const [city, setCity] = React.useState<string>(row.city || "Bekasi");
  const [customerAddress, setCustomerAddress] = React.useState<string>(row.customerAddress || "");
  const [subject, setSubject] = React.useState<string>(row.subject || `INVOICE PENAGIHAN (${row.nomor})`);
  const [intro, setIntro] = React.useState<string>(
    row.intro || "Bersama surat ini kami sampaikan invoice penagihan untuk pengadaan Barang & Jasa Instalasi :",
  );
  const [signerName, setSignerName] = React.useState<string>(row.signerName || "Finance");
  const [signerTitle, setSignerTitle] = React.useState<string>(row.signerTitle || "Finance & Accounting");

  const DEFAULT_INVOICE_NOTES = [
    "Pembayaran dapat di Transfer ke:",
    "Bank : Bank Mandiri",
    "No. Rek : 1670011359410",
    "Nama : Ghina Multi Prima",
    "Alamat : Jl. Bintara Jaya VIII RT.008/RW.009",
    "Bekasi Barat Bintara Jaya Bekasi",
  ];

  const [notesText, setNotesText] = React.useState<string>(
    Array.isArray(row.notesList) && row.notesList.length > 0
      ? row.notesList.join("\n")
      : DEFAULT_INVOICE_NOTES.join("\n"),
  );

  const { data, toast } = useApp();
  const products = (data.products ?? []) as any[];

  // New item inputs
  const [newItemName, setNewItemName] = React.useState("");
  const [newItemQty, setNewItemQty] = React.useState("1");
  const [newItemSatuan, setNewItemSatuan] = React.useState("Unit");
  const [newItemHarga, setNewItemHarga] = React.useState("");
  const [newItemPphMode, setNewItemPphMode] = React.useState<PphMode>("none");

  const handleSelectProduct = (val: string) => {
    const clean = (val.split(" (")[0] ?? val).trim();
    const found = products.find(
      (p) => `${p.nama} (${p.sku})` === val || p.nama === clean || p.sku === clean,
    );
    if (found) {
      setNewItemName(found.nama || clean);
      setNewItemSatuan(found.satuan || "Unit");
      const rawPrice = found.hargaBeli ?? found.purchasePrice ?? found.price ?? found.harga ?? 0;
      setNewItemHarga(rawPrice > 0 ? formatThousands(rawPrice) : "");
      if (found.type === "JASA") {
        setNewItemPphMode("pph23");
      }
    } else {
      setNewItemName(val);
    }
  };

  const itemsTotal = items.length > 0 ? items.reduce((acc, curr) => acc + curr.qty * curr.harga, 0) : Number(row.nilai || 0);
  const activeDiscount = Number(row.discount || row.disc || (row.meta as any)?.discount || 0);
  const effectiveDpp = Math.max(0, itemsTotal - activeDiscount);
  const isNoPpn = row.tipePpn === "No PPN (Tanpa PPN)" || row.ppnMode === "none" || (row.ppn === 0 && Number(row.total || 0) > 0);
  const activePpn = isNoPpn ? 0 : Math.round(effectiveDpp * 0.11);
  const itemsPph = items.reduce((acc, curr) => acc + calcItemPph(curr), 0);
  const activePph = items.length > 0 ? itemsPph : Number(row.pph || 0);
  const activeGrandTotal = Math.max(0, effectiveDpp + activePpn - activePph);

  const noteMatch = String(row.catatan || row.description || "").match(/\((\d+)%\)/);
  const parsedPct = noteMatch ? Number(noteMatch[1]) : undefined;
  const isDp =
    row.jenis === "DP" ||
    String(row.type || "").toUpperCase() === "DP" ||
    /dp/i.test(String(row.catatan || row.description || ""));
  const isTermin =
    row.jenis === "Termin" ||
    String(row.type || "").toUpperCase() === "TERMIN" ||
    /termin/i.test(String(row.catatan || row.description || ""));

  const defaultPct = parsedPct || (isTermin ? 30 : 50);
  const initialDpLabel =
    row.dpLabel ||
    (isDp
      ? `DP (${defaultPct}%)`
      : isTermin
      ? `Termin (${defaultPct}%)`
      : `DP (50%)`);

  const initialDpAmount =
    row.dpAmount !== undefined && row.dpAmount !== null
      ? Number(row.dpAmount)
      : Math.round(activeGrandTotal * (defaultPct / 100));

  const [dpLabel, setDpLabel] = React.useState<string>(initialDpLabel);
  const [dpAmount, setDpAmount] = React.useState<number>(initialDpAmount);
  const [showDpRow, setShowDpRow] = React.useState<boolean>(
    row.showDpRow !== undefined ? !!row.showDpRow : true,
  );

  const parsedNotes = notesText
    .split("\n")
    .map((s) => s.trim().replace(/^\d+\.\s*/, ""))
    .filter(Boolean);

  function addItem() {
    if (!newItemName.trim()) return;
    const m = newItemName.match(/\(SN:\s*([^\)]+)\)/i);
    const sn = m?.[1]?.trim() || null;
    if (sn) {
      const isDuplicate = items.some((it) => {
        if (Array.isArray(it.serialNumbers) && it.serialNumbers.some((s) => String(s).trim().toUpperCase() === sn.toUpperCase())) return true;
        const itM = String(it.item).match(/\(SN:\s*([^\)]+)\)/i);
        return itM?.[1]?.trim().toUpperCase() === sn.toUpperCase();
      });
      if (isDuplicate) {
        toast(`Barang/item dengan SN (${sn}) sudah ada di invoice!`, "danger");
        return;
      }
    }
    const q = Number(newItemQty) || 1;
    const h = Number(newItemHarga.replace(/\D/g, "")) || 0;
    const pphMode = newItemPphMode;
    const updated: QuotationItem[] = [
      ...items,
      {
        id: String(Date.now()),
        item: newItemName.trim(),
        qty: q,
        satuan: newItemSatuan.trim() || "Unit",
        harga: h,
        price: h,
        kind: newItemName.toLowerCase().includes("jasa") || newItemName.toLowerCase().includes("instalasi") ? "SERVICE" : "GOODS",
        pphMode,
        tipePph: pphModeToTipe(pphMode),
      },
    ];
    setItems(updated);
    setNewItemName("");
    setNewItemQty("1");
    setNewItemHarga("");
    setNewItemPphMode("none");
  }

  function updateItemField(id: string, patch: Partial<QuotationItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function removeItem(id: string) {
    setItems(items.filter((it) => it.id !== id));
  }

  async function handleSaveItems(shouldDownload = false) {
    const total = items.reduce((acc, curr) => acc + curr.qty * curr.harga, 0);
    await onUpdateInvoice(
      items,
      total,
      {
        subject,
        intro,
        notesList: parsedNotes,
        city,
        kopText,
        kopLogoUrl,
        customerAddress,
        signerName,
        signerTitle,
        dpLabel: showDpRow ? dpLabel : undefined,
        dpAmount: showDpRow ? dpAmount : undefined,
        pph: activePph,
      } as any,
      shouldDownload,
    );
    setEditItemsOpen(false);
  }

  return (
    <>
      <Panel
        title="Rincian Item & Generator Template Invoice (.xlsx / .pdf)"
        subtitle="Finance dapat mengubah seluruh isi template invoice (kop surat, tujuan, kota, notes, rincian item, dan penandatangan). File Excel & PDF akan otomatis tersinkronisasi."
      >
        <View className="gap-3">
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <View>
              <Text className="text-xs text-muted-foreground">Jumlah Item Terdaftar</Text>
              <Text className="text-sm font-semibold">
                {items.length} Baris Item · Total Item: {rupiah(itemsTotal)}
              </Text>
            </View>
            <View className="flex-row flex-wrap gap-2">
              <Button variant="outline" size="sm" onPress={() => setEditItemsOpen(true)}>
                <Edit3 size={14} color={colors.text} />
                <Text className="text-xs">Edit Template & Item</Text>
              </Button>
              <Button variant="outline" size="sm" onPress={() => setPreviewOpen(true)}>
                <Eye size={14} color={colors.text} />
                <Text className="text-xs">Preview Surat</Text>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onPress={() => {
                  downloadInvoicePdf({ invoiceId: row.id });
                }}
              >
                <FileDown size={14} color={colors.text} />
                <Text className="text-xs">Download PDF</Text>
              </Button>
              <Button
                size="sm"
                onPress={() => {
                  downloadInvoiceExcel({ invoiceId: row.id });
                }}
              >
                <FileDown size={14} color={colors.background} />
                <Text className="text-xs">Download Excel (.xlsx)</Text>
              </Button>
            </View>
          </View>

          {/* Tabel ringkas item yang ada sekarang */}
          {items.length > 0 ? (
            <View className="border-border/80 rounded-xl border overflow-hidden mt-1">
              <View className="bg-panel border-border/80 flex-row border-b py-2 px-3">
                <Text className="w-8 text-[11px] font-bold">No</Text>
                <Text className="flex-1 text-[11px] font-bold">Item / Deskripsi</Text>
                <Text className="w-16 text-[11px] font-bold text-center">QTY</Text>
                <Text className="w-24 text-[11px] font-bold text-right">Harga</Text>
                <Text className="w-28 text-[11px] font-bold text-right">Total</Text>
              </View>
              {items.map((it, idx) => (
                <View key={it.id || idx} className="border-border/50 flex-row items-center border-b py-2 px-3">
                  <Text className="w-8 text-xs text-muted-foreground">{idx + 1}</Text>
                  <View className="flex-1 pr-2">
                    <Text className="text-xs font-medium">{it.item}</Text>
                    <View className="flex-row flex-wrap items-center gap-1.5 mt-0.5">
                      {it.kind === "SERVICE" ? (
                        <Text className="text-[10px] text-muted-foreground">[Jasa / Non-Barang]</Text>
                      ) : it.sku ? (
                        <Text className="text-[10px] text-primary font-mono">[{it.sku}]</Text>
                      ) : null}
                      {Array.isArray(it.serialNumbers) && it.serialNumbers.length > 0 ? (
                        <Text className="text-[10px] font-mono font-semibold text-emerald-500">
                          SN Reserved: {it.serialNumbers.join(", ")}
                        </Text>
                      ) : null}
                      {it.outOfStockAutoSwap ? (
                        <Text className="text-[10px] font-bold text-rose-500">
                          [Konflik Stok SN - Menunggu PR Darurat]
                        </Text>
                      ) : null}
                      {calcItemPph(it) > 0 ? (
                        <Text className="text-[10px] text-danger font-medium">
                          [{pphModeToTipe(it.pphMode || "none")}: -{rupiah(calcItemPph(it))}]
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <Text className="w-16 text-xs text-center">
                    {it.qty} {it.satuan}
                  </Text>
                  <Text className="w-24 text-xs text-right">{rupiah(it.harga)}</Text>
                  <Text className="w-28 text-xs font-semibold text-primary text-right">{rupiah(it.qty * it.harga)}</Text>
                </View>
              ))}

              {/* Rincian Total */}
              <View className="bg-panel/40 p-3 gap-1 border-t border-border/50">
                <View className="flex-row justify-between">
                  <Text className="text-xs text-muted-foreground">Subtotal Item</Text>
                  <Text className="text-xs font-medium">{rupiah(itemsTotal)}</Text>
                </View>
                {activeDiscount > 0 && (
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-danger font-medium">Diskon</Text>
                    <Text className="text-xs font-semibold text-danger">-{rupiah(activeDiscount)}</Text>
                  </View>
                )}
                {activeDiscount > 0 && (
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-muted-foreground">Dasar Pengenaan Pajak (DPP)</Text>
                    <Text className="text-xs font-medium">{rupiah(effectiveDpp)}</Text>
                  </View>
                )}
                <View className="flex-row justify-between">
                  <Text className="text-xs text-muted-foreground">{isNoPpn ? "PPN (Tanpa PPN)" : "PPN (11%)"}</Text>
                  <Text className="text-xs font-medium">{rupiah(activePpn)}</Text>
                </View>
                {activePph > 0 ? (
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-amber-600 dark:text-amber-400">
                      Potongan {row.tipePph || "PPh"}:
                    </Text>
                    <Text className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                      -{rupiah(activePph)}
                    </Text>
                  </View>
                ) : null}
                <View className="flex-row justify-between pt-1 border-t border-border/30">
                  <Text className="text-xs font-bold">Grand Total (Net Ditagih)</Text>
                  <Text className="text-xs font-bold">{rupiah(activeGrandTotal)}</Text>
                </View>
                {showDpRow && dpLabel ? (
                  <View className="flex-row justify-between pt-1 border-t border-primary/20">
                    <Text className="text-xs font-bold text-primary">{dpLabel.endsWith(":") ? dpLabel : `${dpLabel}    :`}</Text>
                    <Text className="text-xs font-bold text-primary">{rupiah(dpAmount)}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : (
            <View className="bg-panel/60 border-border/60 rounded-xl border p-3">
              <Text className="text-xs text-muted-foreground">
                Belum ada rincian item per baris. Klik <b>Edit Template & Item</b> untuk mengubah kop surat, tujuan, item, dan ketentuan invoice di aplikasi.
              </Text>
            </View>
          )}
        </View>
      </Panel>

      {/* Modal Kelola Template & Item Invoice */}
      <Dialog open={editItemsOpen} onOpenChange={setEditItemsOpen}>
        <DialogContent className="sm:max-w-xl md:max-w-3xl max-h-[92vh]">
          <DialogHeader>
            <DialogTitle>Ubah Seluruh Template & Isi Invoice ({row.nomor})</DialogTitle>
          </DialogHeader>
          <ScrollView style={{ maxHeight: 540 }} contentContainerClassName="gap-4 pr-1">
            {/* 1. KOP SURAT & LOKASI */}
            <View className="bg-panel/70 border-border/70 rounded-xl border p-3.5 gap-3">
              <Text className="text-xs font-bold text-primary uppercase tracking-wide">1. Kop Surat & Lokasi</Text>
              <View className="gap-1.5">
                <Text className="text-xs font-semibold">Teks Kop Surat (Perusahaan / Alamat / Header)</Text>
                <Textarea
                  value={kopText}
                  onChangeText={setKopText}
                  placeholder="Contoh: PT GHINA MULTI PRIMA | CCTV & IT Solutions | Telp: 021-22843608 (Kosongkan jika memakai header default)"
                />
              </View>
              <View className="gap-1.5">
                <Text className="text-xs font-semibold">Gambar / Logo Kop Surat (PNG / JPG)</Text>
                <FileUploader
                  label="Pilih File Gambar Logo Kop Surat"
                  kind="foto"
                  category="kop-logo"
                  onUploaded={(fId) => {
                    setKopLogoUrl(`${apiBase()}/files/${fId}`);
                  }}
                  autoFlush
                />
                {kopLogoUrl ? (
                  <View className="flex-row items-center gap-2 mt-1 p-2 bg-card rounded-lg border border-border">
                    <Image source={{ uri: kopLogoUrl }} style={{ width: 80, height: 35, resizeMode: "contain" }} />
                    <Text className="text-xs text-muted-foreground flex-1" numberOfLines={1}>Logo kop surat aktif</Text>
                    <Button size="sm" variant="outline" onPress={() => setKopLogoUrl("")} className="h-7 px-2">
                      <Text className="text-[11px] text-danger">Hapus</Text>
                    </Button>
                  </View>
                ) : null}
              </View>
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Text className="text-xs font-semibold">Kota Dokumen</Text>
                  <Input value={city} onChangeText={setCity} placeholder="Bekasi" />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-semibold">Tujuan / Alamat Customer</Text>
                  <Input
                    value={customerAddress}
                    onChangeText={setCustomerAddress}
                    placeholder="Di Tempat (atau alamat customer)"
                  />
                </View>
              </View>
            </View>

            {/* 2. SUBJECT & PEMBUKA */}
            <View className="bg-panel/70 border-border/70 rounded-xl border p-3.5 gap-3">
              <Text className="text-xs font-bold text-primary uppercase tracking-wide">2. Subject & Teks Pembuka</Text>
              <View className="gap-1.5">
                <Text className="text-xs font-semibold">Subject Dokumen</Text>
                <Input value={subject} onChangeText={setSubject} placeholder="INVOICE PENAGIHAN" />
              </View>
              <View className="gap-1.5">
                <Text className="text-xs font-semibold">Teks Pembuka</Text>
                <Textarea
                  value={intro}
                  onChangeText={setIntro}
                  placeholder="Bersama surat ini kami sampaikan invoice penagihan untuk pengadaan Barang & Jasa Instalasi :"
                />
              </View>
            </View>

            {/* 3. RINCIAN ITEM */}
            <View className="bg-panel/70 border-border/70 rounded-xl border p-3.5 gap-3">
              <View className="flex-row items-center justify-between flex-wrap gap-2">
                <Text className="text-xs font-bold text-primary uppercase tracking-wide">3. Rincian Item / Tagihan</Text>
                <Button size="sm" onPress={() => setPickerOpen(true)}>
                  <Package size={14} color={colors.background} />
                  <Text className="text-xs">+ Pilih dari Stok & SN / Jasa</Text>
                </Button>
              </View>

              {items.map((it, idx) => (
                <View key={it.id || idx} className="bg-card rounded-lg border border-border/70 p-2.5 gap-2">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2 flex-wrap">
                      <Text className="text-xs font-bold text-muted-foreground">Item #{idx + 1}</Text>
                      {Array.isArray(it.serialNumbers) && it.serialNumbers.length > 0 ? (
                        <StatusBadge status={`SN Reserved: ${it.serialNumbers.join(", ")}`} />
                      ) : it.kind === "SERVICE" ? (
                        <StatusBadge status="Jasa / Non-Barang" />
                      ) : null}
                    </View>
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={() => removeItem(it.id)}
                      className="h-6 px-1.5 hover:bg-destructive/10"
                    >
                      <Trash2 size={13} color={colors.danger} />
                    </Button>
                  </View>
                  <Input
                    value={it.item}
                    onChangeText={(val) => updateItemField(it.id, { item: val })}
                    placeholder="Nama item / jasa / pekerjaan"
                  />
                  <View className="flex-row gap-2">
                    <View className="w-20">
                      <Input
                        value={String(it.qty)}
                        keyboardType="numeric"
                        onChangeText={(val) => updateItemField(it.id, { qty: Number(val) || 1 })}
                        placeholder="Qty"
                      />
                    </View>
                    <View className="w-24">
                      <Input
                        value={it.satuan}
                        onChangeText={(val) => updateItemField(it.id, { satuan: val })}
                        placeholder="Satuan"
                      />
                    </View>
                    <View className="flex-1">
                      <Input
                        value={it.harga ? formatThousands(it.harga) : ""}
                        keyboardType="numeric"
                        onChangeText={(val) =>
                          updateItemField(it.id, { harga: Number(val.replace(/\D/g, "")) || 0 })
                        }
                        placeholder="Harga Satuan"
                      />
                    </View>
                  </View>

                  {/* Selector PPh Per-Item */}
                  <View className="flex-row items-center gap-1 flex-wrap pt-1 border-t border-border/30">
                    <Text className="text-[10px] text-muted-foreground mr-1">Tarif PPh:</Text>
                    {PPH_MODE_OPTIONS.map((opt) => {
                      const active = (it.pphMode || "none") === opt.id;
                      return (
                        <Pressable
                          key={opt.id}
                          onPress={() => updateItemField(it.id, { pphMode: opt.id, tipePph: opt.label })}
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
                    {calcItemPph(it) > 0 ? (
                      <Text className="text-[10px] text-danger font-medium ml-1">
                        (Dipotong PPh: -{rupiah(calcItemPph(it))})
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}

              {/* Tambah baris baru */}
              <View className="border-t border-border/60 pt-3 gap-2">
                <Text className="text-xs font-semibold">Tambah Baris Item Baru</Text>
                {products.length > 0 && (
                  <View className="mb-1">
                    <SearchableSelect
                      value={newItemName ? (products.find((p) => p.nama === newItemName) ? `${newItemName} (${products.find((p) => p.nama === newItemName)?.sku})` : newItemName) : ""}
                      options={products.map((p) => `${p.nama} (${p.sku})`)}
                      onChange={handleSelectProduct}
                      placeholder="Pilih cepat dari Master Stok / Jasa..."
                    />
                  </View>
                )}
                <Input
                  value={newItemName}
                  onChangeText={setNewItemName}
                  placeholder="Ketik nama item/pekerjaan baru..."
                />
                <View className="flex-row gap-2 items-center">
                  <View className="w-16">
                    <Input
                      value={newItemQty}
                      keyboardType="numeric"
                      onChangeText={setNewItemQty}
                      placeholder="Qty"
                    />
                  </View>
                  <View className="w-20">
                    <Input
                      value={newItemSatuan}
                      onChangeText={setNewItemSatuan}
                      placeholder="Satuan"
                    />
                  </View>
                  <View className="flex-1">
                    <Input
                      value={newItemHarga}
                      keyboardType="numeric"
                      onChangeText={(v) => setNewItemHarga(formatThousands(v))}
                      placeholder="Harga Satuan"
                    />
                  </View>
                  <Button size="sm" onPress={addItem} className="h-9 px-3 flex-row items-center gap-1">
                    <Plus size={14} color={colors.background} />
                    <Text className="text-xs">Tambah</Text>
                  </Button>
                </View>

                {/* Selector PPh New Item */}
                <View className="flex-row items-center gap-1.5 flex-wrap pt-0.5">
                  <Text className="text-[10px] text-muted-foreground mr-1">Tarif PPh Item Baru:</Text>
                  {PPH_MODE_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.id}
                      onPress={() => setNewItemPphMode(opt.id)}
                      className={`px-1.5 py-0.5 rounded border ${
                        newItemPphMode === opt.id ? "bg-primary/10 border-primary" : "bg-muted/40 border-border/60"
                      }`}
                    >
                      <Text className={`text-[10px] ${newItemPphMode === opt.id ? "text-primary font-bold" : "text-muted-foreground"}`}>
                        {opt.id === "none" ? "Non-PPh" : opt.label.split(" ")[0]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            {/* 4. SKEMA DP / TERMIN */}
            <View className="bg-panel/70 border-border/70 rounded-xl border p-3.5 gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-bold text-primary uppercase tracking-wide">4. Baris DP / Termin</Text>
                <Button
                  size="sm"
                  variant={showDpRow ? "default" : "outline"}
                  onPress={() => setShowDpRow(!showDpRow)}
                  className="h-7 px-2.5"
                >
                  <Text className="text-[11px]">{showDpRow ? "Aktif (Tampil)" : "Nonaktif (Sembunyikan)"}</Text>
                </Button>
              </View>
              {showDpRow ? (
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <Text className="text-xs font-semibold">Label Baris (contoh: DP (50%))</Text>
                    <Input value={dpLabel} onChangeText={setDpLabel} placeholder="DP (50%)" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-semibold">Nominal DP / Termin (Rp)</Text>
                    <Input
                      value={dpAmount !== undefined ? formatThousands(dpAmount) : ""}
                      keyboardType="numeric"
                      onChangeText={(v) => setDpAmount(Number(v.replace(/\D/g, "")) || 0)}
                      placeholder="Nominal DP"
                    />
                  </View>
                </View>
              ) : null}
            </View>

            {/* 5. NOTES & KETENTUAN */}
            <View className="bg-panel/70 border-border/70 rounded-xl border p-3.5 gap-3">
              <Text className="text-xs font-bold text-primary uppercase tracking-wide">5. Notes & Ketentuan Pembayaran</Text>
              <Textarea
                value={notesText}
                onChangeText={setNotesText}
                placeholder="Tulis setiap baris catatan/ketentuan di baris baru..."
              />
              <Text className="text-[11px] text-muted-foreground">
                Setiap baris enter akan menjadi nomor urut catatan pada dokumen invoice.
              </Text>
            </View>

            {/* 6. PENANDATANGAN */}
            <View className="bg-panel/70 border-border/70 rounded-xl border p-3.5 gap-3">
              <Text className="text-xs font-bold text-primary uppercase tracking-wide">6. Penandatangan Invoice</Text>
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Text className="text-xs font-semibold">Nama Penandatangan</Text>
                  <Input value={signerName} onChangeText={setSignerName} placeholder="Finance" />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-semibold">Jabatan Penandatangan</Text>
                  <Input value={signerTitle} onChangeText={setSignerTitle} placeholder="Finance & Accounting" />
                </View>
              </View>
            </View>
          </ScrollView>

          <DialogFooter className="flex-row flex-wrap justify-between gap-2">
            <Button variant="outline" onPress={() => setEditItemsOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <View className="flex-row flex-wrap gap-2">
              <Button variant="outline" onPress={() => handleSaveItems(true)}>
                <FileDown size={14} color={colors.text} />
                <Text>Simpan & Download Excel</Text>
              </Button>
              <Button onPress={() => handleSaveItems(false)}>
                <Text>Simpan Template & Item</Text>
              </Button>
            </View>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <QuotationPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title="Preview File Invoice (Format Resmi Excel & PDF)"
        row={{ ...row, nomor: row.nomor }}
        items={items}
        itemsTotal={itemsTotal}
        calcPpn={activePpn}
        discNum={0}
        subject={subject}
        intro={intro}
        notesList={parsedNotes}
        city={city}
        kopText={kopText}
        kopLogoUrl={kopLogoUrl}
        customerAddress={customerAddress}
        signerName={signerName}
        signerTitle={signerTitle}
        dpLabel={showDpRow && dpLabel ? (dpLabel.endsWith(":") ? dpLabel : `${dpLabel}    :`) : undefined}
        dpAmount={showDpRow ? dpAmount : undefined}
        closingText="Sekian surat invoice penagihan ini kami sampaikan. Atas perhatian dan kerjasamanya kami ucapkan terima kasih."
        onDownloadPdf={() => downloadInvoicePdf({ invoiceId: row.id })}
        onDownloadExcel={() => downloadInvoiceExcel({ invoiceId: row.id })}
        onSave={() => handleSaveItems(false)}
      />

      <SerialItemPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentInvoiceId={row.id}
        existingItems={items}
        onAddItems={(newItems) => {
          const existingSnSet = new Set<string>();
          items.forEach((it) => {
            if (Array.isArray(it.serialNumbers)) it.serialNumbers.forEach((s) => existingSnSet.add(String(s).trim().toUpperCase()));
            const snVal = String(it.item).match(/\(SN:\s*([^\)]+)\)/i)?.[1]?.trim();
            if (snVal) existingSnSet.add(snVal.toUpperCase());
          });
          const valid: QuotationItem[] = [];
          const duplicates: string[] = [];
          newItems.forEach((it) => {
            const snList: string[] = [];
            if (Array.isArray(it.serialNumbers)) it.serialNumbers.forEach((s) => snList.push(String(s).trim().toUpperCase()));
            const snVal = String(it.item).match(/\(SN:\s*([^\)]+)\)/i)?.[1]?.trim();
            if (snVal) snList.push(snVal.toUpperCase());
            const hasDup = snList.some((s) => existingSnSet.has(s));
            if (hasDup) {
              duplicates.push(snList.join(", "));
            } else {
              snList.forEach((s) => existingSnSet.add(s));
              valid.push(it);
            }
          });
          if (duplicates.length > 0) {
            toast(`Barang/item dengan SN (${duplicates.join(", ")}) sudah ada di invoice`, "danger");
          }
          if (valid.length > 0) {
            setItems((prev) => [...prev, ...valid]);
          }
        }}
      />
    </>
  );
}

