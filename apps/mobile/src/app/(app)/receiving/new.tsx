import * as React from "react";
import { View, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Check, PackageCheck, Plus, Trash2, Box, Barcode, Layers, Store } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/text";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader, Panel, FormField } from "@/components/taska/basics";
import { DatePicker, SearchableSelect } from "@/components/taska/dialogs";
import { FileUploader, type FileUploaderHandle } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import type { Row } from "@/constants/modules";

interface ReceivingLineItem {
  id: string;
  productId: number;
  qty: number;
  serials: string[];
  snInput: string;
  notes: string;
}

export default function NewReceivingScreen() {
  const router = useRouter();
  const { data, user, addRow, patchRow, toast } = useApp();

  const pos = data["supplier-pos"] || [];
  const warehouses = data.warehouses || [];
  const products: Row[] = data.products || [];
  const categories = data.productCategories || [];

  function getPoLineItems(poNumber: string): ReceivingLineItem[] | null {
    const selected = pos.find((p) => p.nomor === poNumber);
    const poItems = (selected as any)?._items || (selected as any)?.items || [];
    if (!Array.isArray(poItems) || poItems.length === 0) return null;
    return poItems.map((pi: any, idx: number) => {
      const matchedProd = products.find((p) => Number(p.id) === Number(pi.productId));
      return {
        id: `po-item-${idx}`,
        productId: Number(pi.productId) || Number(matchedProd?.id) || 1,
        qty: Number(pi.qty) || 1,
        serials: [],
        snInput: "",
        notes: "",
      };
    });
  }

  const [sourceType, setSourceType] = React.useState<"PO" | "DIRECT">("PO");
  const [selectedPo, setSelectedPo] = React.useState(pos[0]?.nomor || "");
  const [directSupplier, setDirectSupplier] = React.useState("");
  const [selectedGudang, setSelectedGudang] = React.useState(warehouses[0]?.nama || "Gudang Utama Jakarta");
  const [tanggalTerima, setTanggalTerima] = React.useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = React.useState("");
  const fileHandle = React.useRef<FileUploaderHandle | null>(null);

  // Line items state
  const [items, setItems] = React.useState<ReceivingLineItem[]>(() => getPoLineItems(pos[0]?.nomor || "") || [
    {
      id: "item-1",
      productId: Number(products[0]?.id) || 1,
      qty: 1,
      serials: [],
      snInput: "",
      notes: "",
    },
  ]);

  // Modal Tambah Produk Baru ke Master
  const [newProductOpen, setNewProductOpen] = React.useState(false);
  const [newNama, setNewNama] = React.useState("");
  const [newMerk, setNewMerk] = React.useState("");
  const [newSku, setNewSku] = React.useState("");
  const [newKategori, setNewKategori] = React.useState(categories[0]?.nama ? String(categories[0].nama) : "Kamera CCTV");
  const [newSatuan, setNewSatuan] = React.useState("unit");
  const [newHasSerial, setNewHasSerial] = React.useState(true);
  const [newHargaBeli, setNewHargaBeli] = React.useState("");

  // Modal Tambah Kategori Baru Cepat
  const [newCatOpen, setNewCatOpen] = React.useState(false);
  const [quickCatNama, setQuickCatNama] = React.useState("");
  const [quickCatPrefix, setQuickCatPrefix] = React.useState("");

  function handleSaveQuickCategory() {
    if (!quickCatNama.trim()) {
      toast("Nama kategori wajib diisi", "danger");
      return;
    }
    const catName = quickCatNama.trim();
    addRow("productCategories", {
      nama: catName,
      status: "Aktif",
    });
    setNewKategori(catName);
    setNewCatOpen(false);
    setQuickCatNama("");
    setQuickCatPrefix("");
    toast(`Kategori ${catName} berhasil ditambahkan`);
  }

  const po = pos.find((p) => p.nomor === selectedPo);

  function handleAddItem() {
    const nextProd = products[0];
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        productId: Number(nextProd?.id) || 1,
        qty: 1,
        serials: [],
        snInput: "",
        notes: "",
      },
    ]);
  }

  function handleRemoveItem(id: string) {
    if (items.length <= 1) {
      toast("Minimal 1 item penerimaan barang", "danger");
      return;
    }
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function handleUpdateItem(id: string, patch: Partial<ReceivingLineItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  async function handleSaveNewProduct() {
    if (!newNama.trim() || !newSku.trim()) {
      toast("Nama produk dan SKU wajib diisi", "danger");
      return;
    }
    const cat = categories.find((c) => String(c.nama) === newKategori);
    const createdSku = newSku.trim().toUpperCase();
    const createdProd = {
      nama: newNama.trim(),
      sku: createdSku,
      merk: newMerk.trim() || undefined,
      brand: newMerk.trim() || undefined,
      kategori: newKategori,
      categoryId: cat?.id ? Number(cat.id) : undefined,
      satuan: newSatuan,
      unit: newSatuan,
      berSN: newHasSerial,
      hasSerial: newHasSerial,
      hargaBeli: Number(newHargaBeli.replace(/\D/g, "")) || 0,
      min: 5,
    };

    addRow("products", createdProd);
    setNewProductOpen(false);
    toast(`Produk ${newNama} berhasil ditambahkan ke master`);

    // Reset modal fields
    setNewNama("");
    setNewMerk("");
    setNewSku("");
    setNewHargaBeli("");
  }

  async function submit() {
    if (sourceType === "PO" && !selectedPo) {
      toast("Pilih PO Supplier terlebih dahulu", "danger");
      return;
    }
    if (sourceType === "DIRECT" && !directSupplier.trim()) {
      toast("Isi nama supplier / toko penerimaan langsung", "danger");
      return;
    }
    if (items.length === 0) {
      toast("Pilih minimal 1 barang untuk diterima", "danger");
      return;
    }

    // Validate SN for serialized items
    for (const line of items) {
      const prod = products.find((p) => Number(p.id) === line.productId);
      if (prod?.berSN) {
        const rawSns = line.serials.length > 0
          ? line.serials
          : line.snInput
              .split(/[\n,;]+/)
              .map((s) => s.trim().toUpperCase())
              .filter(Boolean);
        if (rawSns.length === 0) {
          toast(`Masukkan Serial Number untuk produk ${prod.nama}`, "danger");
          return;
        }
      }
    }

    const fileId = (await fileHandle.current?.flush()) ?? undefined;
    const wh = warehouses.find((w) => w.nama === selectedGudang);

    const payloadItems = items.map((line) => {
      const prod = products.find((p) => Number(p.id) === line.productId);
      const sns = line.serials.length > 0
        ? line.serials
        : line.snInput
            .split(/[\n,;]+/)
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean);

      return {
        productId: line.productId,
        qtyReceived: line.qty,
        serials: prod?.berSN && sns.length > 0 ? sns.join(",") : undefined,
        note: line.notes || undefined,
      };
    });

    const itemsSummary = items
      .map((line) => {
        const prod = products.find((p) => Number(p.id) === line.productId);
        const satuan = prod?.satuan || "unit";
        return `${prod?.nama || "Produk"} x ${line.qty} ${satuan}`;
      })
      .join(", ");

    const row = {
      nomor: `TB/${new Date().getFullYear()}/${Math.floor(Math.random() * 800) + 100}`,
      po: sourceType === "PO" ? selectedPo : "-",
      supplierPoId: sourceType === "PO" && po?.id ? Number(po.id) : undefined,
      supplierName: sourceType === "DIRECT" ? directSupplier.trim() : (po?.supplier || "-"),
      supplier: sourceType === "DIRECT" ? directSupplier.trim() : (po?.supplier || "-"),
      gudang: selectedGudang,
      warehouseId: wh?.id ? Number(wh.id) : undefined,
      item: itemsSummary,
      items: payloadItems,
      tanggal: tanggalTerima,
      penerima: user?.name || "Petugas Gudang",
      status: "Diterima",
      catatan: notes,
      fileId,
      receiptFileId: fileId,
      photoFileId: fileId,
    };

    await addRow("receiving", row);
    if (sourceType === "PO" && po?.id) {
      await patchRow("supplier-pos", String(po.id), {
        ...(fileId ? { doFileId: fileId } : {}),
        pengiriman: "Sampai",
        status: "Sampai",
      }).catch(() => {});
    }
    toast("Penerimaan barang berhasil disimpan, stok bertambah & DO terhubung ke PO");
    router.replace("/stock");
  }

  return (
    <View className="max-w-3xl self-center w-full gap-5 pb-12">
      <PageHeader
        back
        title="Penerimaan Barang (Gudang)"
        subtitle="Verifikasi fisik barang tiba, update stok otomatis, dan catat Serial Number"
      />

      {/* Panel 1: Sumber & Pengirim Barang */}
      <Panel title="Sumber Kedatangan Barang">
        <View className="gap-4">
          <View className="flex-row gap-2">
            <Button
              size="sm"
              variant={sourceType === "PO" ? "default" : "outline"}
              onPress={() => setSourceType("PO")}
              className="flex-1"
            >
              <PackageCheck size={16} color={sourceType === "PO" ? colors.background : colors.text} />
              <Text>Dari PO Supplier</Text>
            </Button>
            <Button
              size="sm"
              variant={sourceType === "DIRECT" ? "default" : "outline"}
              onPress={() => setSourceType("DIRECT")}
              className="flex-1"
            >
              <Store size={16} color={sourceType === "DIRECT" ? colors.background : colors.text} />
              <Text>Penerimaan Langsung (Tanpa PO)</Text>
            </Button>
          </View>

          {sourceType === "PO" ? (
            <FormField label="Pilih PO Supplier" required>
              <SearchableSelect
                value={selectedPo}
                onChange={(value) => {
                  setSelectedPo(value);
                  const poItems = getPoLineItems(value);
                  if (poItems) setItems(poItems);
                }}
                options={pos.map((p) => p.nomor)}
                placeholder="Pilih nomor PO"
              />
            </FormField>
          ) : (
            <FormField label="Nama Supplier / Toko / Vendor" required>
              <Input
                value={directSupplier}
                onChangeText={setDirectSupplier}
                placeholder="Contoh: PT Hikvision Pratama / Toko Listrik Glodok"
              />
            </FormField>
          )}

          {sourceType === "PO" && po && (
            <View className="bg-panel/50 border-border rounded-xl border p-3.5 gap-1.5">
              <Text className="text-text-secondary text-xs">Informasi PO Supplier:</Text>
              <Text className="text-sm font-semibold">{po.supplier}</Text>
              <Text className="text-muted-foreground text-xs">Barang PO: {po.item || "-"}</Text>
            </View>
          )}

          <View className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="Gudang Penerima" required>
              <SearchableSelect
                value={selectedGudang}
                onChange={setSelectedGudang}
                options={warehouses.map((w) => String(w.nama))}
                placeholder="Pilih gudang penerima"
              />
            </FormField>

            <FormField label="Tanggal Penerimaan" required>
              <DatePicker
                value={tanggalTerima}
                onChange={setTanggalTerima}
                placeholder="Pilih tanggal terima"
              />
            </FormField>
          </View>

          <FormField label="Catatan Kondisi Fisik / Nomor DO Supplier">
            <Input
              value={notes}
              onChangeText={setNotes}
              placeholder="Contoh: No DO DO-2026/089, kardus utuh, segel baik"
            />
          </FormField>
        </View>
      </Panel>

      {/* Panel 2: Rincian Produk yang Tiba */}
      <Panel
        title={`Rincian Barang yang Diterima (${items.length} Barang)`}
        subtitle="Pilih produk dari master data atau tambahkan produk baru secara instan"
        right={
          <View className="flex-row gap-2">
            <Button size="sm" variant="outline" onPress={() => setNewProductOpen(true)}>
              <Plus size={14} color={colors.text} />
              <Text className="text-xs">+ Produk Baru</Text>
            </Button>
            <Button size="sm" onPress={handleAddItem}>
              <Plus size={14} color={colors.background} />
              <Text className="text-xs">Tambah Baris</Text>
            </Button>
          </View>
        }
      >
        <View className="gap-4">
          {items.map((line, idx) => {
            const prod = products.find((p) => Number(p.id) === line.productId);
            const isSerial = !!prod?.berSN;
            const satuan = prod?.satuan || "unit";

            return (
              <View
                key={line.id}
                className="bg-card border-border/80 rounded-2xl border p-4 gap-3.5 shadow-sm"
              >
                <View className="flex-row items-center justify-between pb-2 border-b border-border/50">
                  <View className="flex-row items-center gap-2">
                    <View className="size-6 rounded-full bg-primary/10 items-center justify-center">
                      <Text className="text-xs font-bold text-primary">{idx + 1}</Text>
                    </View>
                    <Text className="text-sm font-bold text-foreground">
                      {prod?.nama || "Pilih Produk"}
                    </Text>
                    {prod?.merk ? (
                      <View className="bg-panel border-border/60 rounded px-1.5 py-0.5 border">
                        <Text className="text-[10px] font-medium text-muted-foreground">{prod.merk}</Text>
                      </View>
                    ) : null}
                  </View>

                  {items.length > 1 && (
                    <Pressable
                      onPress={() => handleRemoveItem(line.id)}
                      hitSlop={8}
                      className="size-7 items-center justify-center rounded-lg hover:bg-danger/10"
                    >
                      <Trash2 size={15} color={colors.danger} />
                    </Pressable>
                  )}
                </View>

                {/* Pilih Produk & Jumlah */}
                <View className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <View className="md:col-span-2">
                    <FormField label="Pilih Produk Master" required>
                      <SearchableSelect
                        value={prod?.nama ? String(prod.nama) : ""}
                        onChange={(name) => {
                          const found = products.find((p) => p.nama === name);
                          if (found) handleUpdateItem(line.id, { productId: Number(found.id) });
                        }}
                        options={products.map((p) => String(p.nama))}
                        placeholder="Cari nama produk / SKU"
                      />
                    </FormField>
                  </View>

                  <FormField label={`Jumlah (${satuan})`} required>
                    <Input
                      value={String(line.qty)}
                      onChangeText={(v) => handleUpdateItem(line.id, { qty: Math.max(1, Number(v.replace(/\D/g, "")) || 1) })}
                      keyboardType="numeric"
                      placeholder="1"
                    />
                  </FormField>
                </View>

                {/* Serial Number atau Badge Curah */}
                {isSerial ? (
                  <View className="bg-panel/40 border-border/70 rounded-xl border p-3 gap-2">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-1.5">
                        <Barcode size={15} color={colors.primary} />
                        <Text className="text-xs font-semibold text-foreground">
                          Serial Number (Wajib diisi {line.qty} SN)
                        </Text>
                      </View>
                      <Text className="text-[11px] text-muted-foreground">Pisahkan dengan koma atau baris baru</Text>
                    </View>
                    <Textarea
                      value={line.snInput}
                      onChangeText={(v) => handleUpdateItem(line.id, { snInput: v })}
                      placeholder={`Contoh: SN-${prod?.sku || "DEV"}-001\nSN-${prod?.sku || "DEV"}-002`}
                      numberOfLines={2}
                    />
                  </View>
                ) : (
                  <View className="bg-success/10 border-success/30 rounded-xl border p-3 flex-row items-center gap-2">
                    <Box size={16} color={colors.success} />
                    <Text className="text-xs text-success font-medium">
                      Barang Curah / Kolektif: Tidak memerlukan SN. Stok akan dicatat sebanyak {line.qty} {satuan}.
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </Panel>

      {/* Panel 3: File DO & Foto Dokumentasi */}
      <Panel title="File Delivery Order (DO) & Foto Dokumentasi">
        <FileUploader
          label="Upload File DO / Surat Jalan Supplier & Bukti Fisik (Gambar / PDF)"
          kind="semua"
          accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp"
          allowedExtensions={["jpg", "jpeg", "png", "webp", "pdf"]}
          hint="Mendukung Gambar (JPG, PNG, WEBP) atau Dokumen PDF. File DO otomatis ter-attach ke Penerimaan & PO Supplier."
          category="penerimaan"
          handleRef={(h) => { fileHandle.current = h; }}
        />
      </Panel>

      {/* Tombol Simpan */}
      <Button size="lg" onPress={submit} className="h-12">
        <Check size={18} color={colors.background} />
        <Text className="font-bold">Simpan Penerimaan & Masukkan ke Stok</Text>
      </Button>

      {/* Modal Quick Add Product */}
      <Dialog open={newProductOpen} onOpenChange={setNewProductOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah Produk Baru ke Master Data</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <FormField label="Nama Produk / Barang" required>
              <Input
                value={newNama}
                onChangeText={setNewNama}
                placeholder="Contoh: IP Camera 4MP Bullet UNV"
              />
            </FormField>

            <View className="grid grid-cols-2 gap-3">
              <FormField label="Merk / Brand (Pabrikan)">
                <Input
                  value={newMerk}
                  onChangeText={setNewMerk}
                  placeholder="Contoh: Uniview, Belden"
                />
              </FormField>

              <FormField label="Kode SKU" required>
                <Input
                  value={newSku}
                  onChangeText={setNewSku}
                  placeholder="Contoh: CAM-UNV-4K"
                />
              </FormField>
            </View>

            <View className="grid grid-cols-2 gap-3">
              <View className="gap-1.5">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-medium text-foreground">Kategori Produk *</Text>
                  <Pressable onPress={() => setNewCatOpen(true)} hitSlop={6}>
                    <Text className="text-[11px] font-semibold text-primary">+ Kategori</Text>
                  </Pressable>
                </View>
                <SearchableSelect
                  value={newKategori}
                  onChange={setNewKategori}
                  options={categories.map((c) => String(c.nama))}
                />
              </View>

              <FormField label="Unit Satuan" required>
                <SearchableSelect
                  value={newSatuan}
                  onChange={setNewSatuan}
                  options={["unit", "roll", "meter", "box", "pcs", "pack", "set"]}
                />
              </FormField>
            </View>

            <FormField label="Lacak Serial Number (SN)" required>
              <View className="flex-row gap-2">
                <Button
                  size="sm"
                  variant={newHasSerial ? "default" : "outline"}
                  onPress={() => setNewHasSerial(true)}
                  className="flex-1"
                >
                  <Text>Ya (Ada SN)</Text>
                </Button>
                <Button
                  size="sm"
                  variant={!newHasSerial ? "default" : "outline"}
                  onPress={() => setNewHasSerial(false)}
                  className="flex-1"
                >
                  <Text>Tidak (Barang Curah/Kabel)</Text>
                </Button>
              </View>
            </FormField>

            <FormField label="Estimasi Harga Beli (Rp)">
              <Input
                value={newHargaBeli}
                onChangeText={(v) => setNewHargaBeli(v.replace(/\D/g, ""))}
                keyboardType="numeric"
                placeholder="Contoh: 750000"
              />
            </FormField>
          </View>

          <DialogFooter>
            <Button variant="outline" onPress={() => setNewProductOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSaveNewProduct}>
              <Text>Simpan ke Master</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Quick Add Category */}
      <Dialog open={newCatOpen} onOpenChange={setNewCatOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Kategori Produk Baru</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <FormField label="Nama Kategori Produk" required>
              <Input
                value={quickCatNama}
                onChangeText={setQuickCatNama}
                placeholder="Contoh: Switch & Networking"
              />
            </FormField>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setNewCatOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSaveQuickCategory}>
              <Text>Simpan Kategori</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  );
}
