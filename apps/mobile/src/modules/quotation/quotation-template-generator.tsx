import * as React from "react";
import { View, ScrollView, Image } from "react-native";
import { FileDown, Plus, Trash2, Edit3, Eye } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Panel } from "@/components/taska/basics";
import { colors } from "@/tokens";
import { rupiah, formatThousands } from "@/lib/format";
import { type Row } from "@/constants/modules";
import { type QuotationItem } from "@/modules/quotation/types";
import { downloadQuotationTemplate, downloadQuotationPdf } from "@/modules/quotation/quotation-files";
import { QuotationPreviewModal } from "@/modules/quotation/quotation-preview-modal";
import { FileUploader } from "@/components/taska/file-uploader";
import { apiBase } from "@/services/api";

export function QuotationTemplateGenerator({
  row,
  totNum,
  calcPpn,
  calcTotalAfterDisc,
  discNum,
  onUpdateItems,
}: {
  row: Row;
  totNum: number;
  calcPpn: number;
  calcTotalAfterDisc: number;
  discNum: number;
  onUpdateItems: (
    items: QuotationItem[],
    newTotal: number,
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
    },
    shouldDownload?: boolean,
    asVersion?: boolean,
  ) => Promise<void> | void;
}) {
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [editItemsOpen, setEditItemsOpen] = React.useState(false);

  const [items, setItems] = React.useState<QuotationItem[]>(row.items && row.items.length ? row.items : []);
  const [kopText, setKopText] = React.useState<string>(row.kopText || "");
  const [kopLogoUrl, setKopLogoUrl] = React.useState<string>((row as any).kopLogoUrl || "");
  const [city, setCity] = React.useState<string>(row.city || "Bekasi");
  const [customerAddress, setCustomerAddress] = React.useState<string>(row.customerAddress || "");
  const [subject, setSubject] = React.useState<string>(
    row.subject || `Penawaran Pengadaan Barang & Jasa Instalasi (${row.lead || "-"})`,
  );
  const [intro, setIntro] = React.useState<string>(
    row.intro || "Sesuai permintaan Bapak / Ibu sebelumnya, berikut penawaran dari kami terkait pengadaan Barang & Jasa Instalasi :",
  );
  const [signerName, setSignerName] = React.useState<string>(row.signerName || row.pemilik || "");
  const [signerTitle, setSignerTitle] = React.useState<string>(row.signerTitle || "Sales Engineer");
  const [notesText, setNotesText] = React.useState<string>(
    Array.isArray(row.notesList) && row.notesList.length > 0
      ? row.notesList.join("\n")
      : [
          "Penawaran ini berlaku 1 bulan",
          "Penambahan material/jasa dikenakan harga sesuai nilai jual material/jasa tersebut",
          "Garansi perangkat 1 Tahun Harddisk dan PSU 6 Bulan Instalasi 3 Bulan",
        ].join("\n"),
  );

  // New item inputs
  const [newItemName, setNewItemName] = React.useState("");
  const [newItemQty, setNewItemQty] = React.useState("1");
  const [newItemSatuan, setNewItemSatuan] = React.useState("Unit");
  const [newItemHarga, setNewItemHarga] = React.useState("");

  const itemsTotal = items.length > 0 ? items.reduce((acc, curr) => acc + curr.qty * curr.harga, 0) : totNum;
  const isIncludePpn = row.tipePpn === "Include PPN (Sudah termasuk)" || row.ppnMode === "include";
  const isNoPpn = row.tipePpn === "No PPN (Tanpa PPN)" || row.ppnMode === "none" || (row.ppn === 0 && (row.disc > 0 || (row.total || 0) > 0));
  const netBeforeTax = Math.max(0, itemsTotal - discNum);
  const activePpn = isNoPpn || isIncludePpn ? 0 : Math.round(netBeforeTax * 0.11);
  const activeGrandTotal = isNoPpn || isIncludePpn ? netBeforeTax : netBeforeTax + activePpn;
  const parsedNotes = notesText
    .split("\n")
    .map((s) => s.trim().replace(/^\d+\.\s*/, ""))
    .filter(Boolean);

  function addItem() {
    if (!newItemName.trim()) return;
    const q = Number(newItemQty) || 1;
    const h = Number(newItemHarga.replace(/\D/g, "")) || 0;
    const updated = [
      ...items,
      { id: String(Date.now()), item: newItemName.trim(), qty: q, satuan: newItemSatuan.trim() || "Unit", harga: h },
    ];
    setItems(updated);
    setNewItemName("");
    setNewItemQty("1");
    setNewItemHarga("");
  }

  function updateItemField(id: string, patch: Partial<QuotationItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function removeItem(id: string) {
    setItems(items.filter((it) => it.id !== id));
  }

  async function handleSaveItems(shouldDownload = false, asVersion = false) {
    const total = items.reduce((acc, curr) => acc + curr.qty * curr.harga, 0);
    await onUpdateItems(
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
      },
      shouldDownload,
      asVersion,
    );
    setEditItemsOpen(false);
  }

  return (
    <>
      <Panel
        title="Rincian Item & Generator Template Penawaran (.xlsx / .pdf)"
        subtitle="Sales dapat mengubah seluruh isi template penawaran (kop surat, tujuan, kota, notes, item, dan penandatangan). File Excel & PDF akan otomatis tersinkronisasi."
      >
        <View className="gap-3">
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <View>
              <Text className="text-xs text-muted-foreground">Jumlah Item / Jasa Terdaftar</Text>
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
                  downloadQuotationPdf({
                    quotationId: row.id,
                    customer: row.customer,
                    lead: row.lead,
                    nomor: row.nomor,
                    signer: signerName || row.pemilik,
                  });
                }}
              >
                <FileDown size={14} color={colors.text} />
                <Text className="text-xs">Download PDF</Text>
              </Button>
              <Button
                size="sm"
                onPress={() => {
                  downloadQuotationTemplate({
                    quotationId: row.id,
                    customer: row.customer,
                    lead: row.lead,
                    nomor: row.nomor,
                    signer: signerName || row.pemilik,
                  });
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
                <Text className="flex-1 text-[11px] font-bold">Item / Jasa</Text>
                <Text className="w-16 text-[11px] font-bold text-center">QTY</Text>
                <Text className="w-24 text-[11px] font-bold text-right">Harga</Text>
                <Text className="w-28 text-[11px] font-bold text-right">Total</Text>
              </View>
              {items.map((it, idx) => (
                <View key={it.id || idx} className="border-border/50 flex-row items-center border-b py-2 px-3">
                  <Text className="w-8 text-xs text-muted-foreground">{idx + 1}</Text>
                  <Text className="flex-1 text-xs font-medium">{it.item}</Text>
                  <Text className="w-16 text-xs text-center">
                    {it.qty} {it.satuan}
                  </Text>
                  <Text className="w-24 text-xs text-right">{rupiah(it.harga)}</Text>
                  <Text className="w-28 text-xs font-semibold text-primary text-right">{rupiah(it.qty * it.harga)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View className="bg-panel/60 border-border/60 rounded-xl border p-3">
              <Text className="text-xs text-muted-foreground">
                Belum ada rincian item per baris. Klik <b>Edit Template & Item</b> untuk mengubah kop surat, tujuan, item, dan ketentuan penawaran di aplikasi.
              </Text>
            </View>
          )}
        </View>
      </Panel>

      {/* Modal Kelola Template & Item Penawaran */}
      <Dialog open={editItemsOpen} onOpenChange={setEditItemsOpen}>
        <DialogContent className="sm:max-w-xl md:max-w-3xl max-h-[92vh]">
          <DialogHeader>
            <DialogTitle>Ubah Seluruh Template & Isi Penawaran</DialogTitle>
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
              <Text className="text-xs font-bold text-primary uppercase tracking-wide">2. Perihal & Kalimat Pembuka</Text>
              <View className="gap-1.5">
                <Text className="text-xs font-semibold">Subject / Perihal Surat</Text>
                <Input
                  value={subject}
                  onChangeText={setSubject}
                  placeholder="Penawaran Pengadaan Barang & Jasa Instalasi"
                />
              </View>
              <View className="gap-1.5">
                <Text className="text-xs font-semibold">Kalimat Pembuka (Intro)</Text>
                <Textarea
                  value={intro}
                  onChangeText={setIntro}
                  placeholder="Sesuai permintaan Bapak / Ibu sebelumnya, berikut penawaran dari kami terkait pengadaan Barang & Jasa Instalasi :"
                />
              </View>
            </View>

            {/* 3. ITEM & JASA */}
            <View className="bg-panel/70 border-border/70 rounded-xl border p-3.5 gap-3">
              <Text className="text-xs font-bold text-primary uppercase tracking-wide">3. Rincian Item / Jasa</Text>
              <View className="bg-card border-border/80 rounded-xl border p-3 gap-2">
                <Text className="text-xs font-semibold">Tambah Baris Item / Jasa Baru</Text>
                <View className="flex-row flex-wrap gap-2">
                  <View className="flex-1 min-w-[180px]">
                    <Input
                      value={newItemName}
                      onChangeText={setNewItemName}
                      placeholder="Nama item / jasa (misal: HDD 1TB Surveillance)"
                    />
                  </View>
                  <View className="w-16">
                    <Input value={newItemQty} onChangeText={setNewItemQty} keyboardType="numeric" placeholder="Qty" />
                  </View>
                  <View className="w-20">
                    <Input value={newItemSatuan} onChangeText={setNewItemSatuan} placeholder="Unit/Lot" />
                  </View>
                  <View className="flex-1 min-w-[140px]">
                    <Input
                      value={newItemHarga}
                      onChangeText={(v) => setNewItemHarga(formatThousands(v))}
                      keyboardType="numeric"
                      placeholder="Harga Satuan (Rp)"
                    />
                  </View>
                  <Button size="sm" onPress={addItem} className="self-end">
                    <Plus size={15} color={colors.background} />
                    <Text className="text-xs">Tambah</Text>
                  </Button>
                </View>
              </View>

              <View className="gap-2">
                <Text className="text-xs font-semibold">Daftar Item ({items.length} Baris)</Text>
                {items.map((it, idx) => (
                  <View
                    key={it.id || idx}
                    className="bg-card border-border/60 flex-row flex-wrap items-center gap-2 rounded-lg border p-2.5"
                  >
                    <Text className="w-5 text-xs font-semibold">{idx + 1}.</Text>
                    <View className="flex-1 min-w-[150px]">
                      <Input
                        value={it.item}
                        onChangeText={(v) => updateItemField(it.id, { item: v })}
                        placeholder="Nama Item"
                      />
                    </View>
                    <View className="w-16">
                      <Input
                        value={String(it.qty)}
                        onChangeText={(v) => updateItemField(it.id, { qty: Number(v.replace(/\D/g, "")) || 0 })}
                        keyboardType="numeric"
                        placeholder="Qty"
                      />
                    </View>
                    <View className="w-20">
                      <Input
                        value={it.satuan}
                        onChangeText={(v) => updateItemField(it.id, { satuan: v })}
                        placeholder="Satuan"
                      />
                    </View>
                    <View className="w-28">
                      <Input
                        value={it.harga ? formatThousands(it.harga) : ""}
                        onChangeText={(v) => updateItemField(it.id, { harga: Number(v.replace(/\D/g, "")) || 0 })}
                        keyboardType="numeric"
                        placeholder="Harga"
                      />
                    </View>
                    <Text className="w-24 text-xs font-semibold text-primary text-right">
                      {rupiah(it.qty * it.harga)}
                    </Text>
                    <Button variant="ghost" size="sm" onPress={() => removeItem(it.id)}>
                      <Trash2 size={14} color={colors.danger} />
                    </Button>
                  </View>
                ))}
              </View>
            </View>

            {/* 4. NOTES & SYARAT KETENTUAN */}
            <View className="bg-panel/70 border-border/70 rounded-xl border p-3.5 gap-2">
              <Text className="text-xs font-bold text-primary uppercase tracking-wide">4. Notes / Syarat & Ketentuan</Text>
              <Text className="text-[11px] text-muted-foreground">Tuliskan tiap poin per baris baru (1 baris = 1 poin nomor otomatis di surat penawaran).</Text>
              <Textarea
                value={notesText}
                onChangeText={setNotesText}
                placeholder="Penawaran ini berlaku 1 bulan&#10;Penambahan material/jasa dikenakan harga sesuai nilai jual...&#10;Garansi perangkat 1 Tahun..."
              />
            </View>

            {/* 5. TTD & PENANDATANGAN */}
            <View className="bg-panel/70 border-border/70 rounded-xl border p-3.5 gap-2.5">
              <Text className="text-xs font-bold text-primary uppercase tracking-wide">5. Penandatangan (TTD)</Text>
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Text className="text-xs font-semibold">Nama Penandatangan (Sales / PIC)</Text>
                  <Input
                    value={signerName}
                    onChangeText={setSignerName}
                    placeholder="Nama Sales"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-semibold">Jabatan / Gelar</Text>
                  <Input
                    value={signerTitle}
                    onChangeText={setSignerTitle}
                    placeholder="Sales Engineer / Account Manager"
                  />
                </View>
              </View>
            </View>

            {/* KALKULASI */}
            <View className="bg-panel border-border/50 gap-1 rounded-lg border p-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-muted-foreground">SUBTOTAL ITEM:</Text>
                <Text className="text-xs font-semibold">{rupiah(itemsTotal)}</Text>
              </View>
              {discNum > 0 ? (
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs text-muted-foreground">DISC:</Text>
                  <Text className="text-xs font-semibold text-danger">- {rupiah(discNum)}</Text>
                </View>
              ) : null}
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-muted-foreground">
                  {isIncludePpn ? "PPN (Sudah Termasuk):" : isNoPpn ? "PPN (Tanpa PPN):" : "PPN (11%):"}
                </Text>
                <Text className="text-xs font-semibold">
                  {isIncludePpn ? "Included" : isNoPpn ? "Rp 0" : rupiah(activePpn)}
                </Text>
              </View>
              <View className="flex-row items-center justify-between pt-1 border-t border-border/50">
                <Text className="text-xs font-bold">GRAND TOTAL:</Text>
                <Text className="text-sm font-bold text-primary">
                  {rupiah(activeGrandTotal)}
                </Text>
              </View>
            </View>
          </ScrollView>
          <DialogFooter className="flex-row flex-wrap gap-2">
            <Button variant="outline" onPress={() => setEditItemsOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button variant="outline" onPress={() => handleSaveItems(false, false)}>
              <Text>Simpan Template & Data</Text>
            </Button>
            <Button variant="outline" onPress={() => handleSaveItems(false, true)} className="flex-row items-center gap-1.5">
              <Plus size={14} color={colors.text} />
              <Text>Simpan & Jadikan Versi Baru</Text>
            </Button>
            <Button onPress={() => handleSaveItems(true, false)} className="flex-row items-center gap-1.5">
              <FileDown size={15} color={colors.background} />
              <Text>Simpan & Download Excel (.xlsx)</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Preview Template Resmi */}
      <QuotationPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        row={row}
        items={items}
        calcPpn={activePpn}
        discNum={discNum}
        itemsTotal={itemsTotal}
        subject={subject}
        intro={intro}
        notesList={parsedNotes}
        city={city}
        kopText={kopText}
        kopLogoUrl={kopLogoUrl}
        customerAddress={customerAddress}
        signerName={signerName}
        signerTitle={signerTitle}
        onSave={async () => {
          await onUpdateItems(
            items,
            itemsTotal,
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
            },
            true,
          );
          setPreviewOpen(false);
        }}
      />
    </>
  );
}
