import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, Edit3, Layers, Plus } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader, FormField } from "@/components/taska/basics";
import { SearchableSelect, formatThousands } from "@/components/taska/dialogs";
import { DataTable } from "@/components/taska/data-table";
import { BatchSerialRegisterModal } from "@/components/taska/serial-item-picker";
import { colors } from "@/tokens";
import { rupiah } from "@/lib/format";
import type { MasterKey } from "../types";

interface MasterBarangViewProps {
  data: any;
  user: any;
  onBack: () => void;
  onSelectCategory: (cat: MasterKey) => void;
  addRow: (module: string, payload: any) => void;
  patchRow?: (module: string, id: string | number, payload: any) => Promise<any>;
  toast: (msg: string, type?: "success" | "danger" | "info" | "warning") => void;
  renderActions?: (row: any) => React.ReactNode;
}

export function MasterBarangView({
  data,
  user,
  onBack,
  onSelectCategory,
  addRow,
  patchRow,
  toast,
  renderActions,
}: MasterBarangViewProps) {
  const router = useRouter();
  const [barangOpen, setBarangOpen] = React.useState(false);
  const [barangNama, setBarangNama] = React.useState("");
  const [barangMerk, setBarangMerk] = React.useState("");
  const [barangDesc, setBarangDesc] = React.useState("");
  const [barangSku, setBarangSku] = React.useState("");
  const [barangKategori, setBarangKategori] = React.useState("IP Camera");
  const [barangSatuan, setBarangSatuan] = React.useState("unit");
  const [barangIsiUnit, setBarangIsiUnit] = React.useState("");
  const [barangHargaBeli, setBarangHargaBeli] = React.useState("");
  const [barangMinStok, setBarangMinStok] = React.useState("5");
  const [barangGaransi, setBarangGaransi] = React.useState("2 tahun");
  const [barangSN, setBarangSN] = React.useState("Ya (Serial Number)");
  const [batchSnOpen, setBatchSnOpen] = React.useState(false);

  // Edit Harga Dialog State
  const [editPriceOpen, setEditPriceOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<any>(null);
  const [editHargaVal, setEditHargaVal] = React.useState("");
  const [isSavingPrice, setIsSavingPrice] = React.useState(false);

  const isSuper = user?.role === "super_admin";
  const canAddBarang = isSuper || user?.role === "gudang" || user?.role === "bos" || user?.role === "admin" || user?.role === "procurement";
  const canEditPrice = isSuper || user?.role === "procurement" || user?.role === "finance" || user?.role === "pm" || user?.role === "bos" || user?.role === "admin" || user?.role === "gudang";

  function handleOpenEditPrice(product: any) {
    setEditingProduct(product);
    const currPrice = product.hargaBeli ?? product.purchasePrice ?? 0;
    setEditHargaVal(currPrice > 0 ? String(currPrice) : "");
    setEditPriceOpen(true);
  }

  async function handleSavePrice() {
    if (!editingProduct || !patchRow) return;
    setIsSavingPrice(true);
    try {
      const cleanPrice = Number(editHargaVal.replace(/\D/g, "")) || 0;
      await patchRow("products", editingProduct.id, {
        hargaBeli: cleanPrice,
        purchasePrice: cleanPrice,
      });
      toast(`Harga untuk "${editingProduct.nama || editingProduct.sku}" berhasil diperbarui`);
      setEditPriceOpen(false);
      setEditingProduct(null);
    } catch (err: any) {
      toast(err?.message || "Gagal mengubah harga", "danger");
    } finally {
      setIsSavingPrice(false);
    }
  }

  function handleSaveBarang() {
    if (!barangNama.trim() || !barangSku.trim()) {
      toast("Nama barang dan SKU wajib diisi", "danger");
      return;
    }
    let satuanDisplay = barangSatuan;
    if (barangSatuan === "roll" && barangIsiUnit.trim()) {
      satuanDisplay = `roll (@${barangIsiUnit.trim()} m)`;
    } else if ((barangSatuan === "box" || barangSatuan === "pack" || barangSatuan === "set") && barangIsiUnit.trim()) {
      satuanDisplay = `${barangSatuan} (@${barangIsiUnit.trim()} pcs)`;
    }

    const isJasa = barangSN.includes("Jasa");
    addRow("products", {
      nama: barangNama,
      sku: barangSku.toUpperCase(),
      type: isJasa ? "JASA" : "BARANG",
      jenisItem: isJasa ? "Jasa" : "Barang",
      merk: isJasa ? "-" : (barangMerk.trim() || undefined),
      brand: isJasa ? "-" : (barangMerk.trim() || undefined),
      deskripsi: barangDesc.trim() || undefined,
      description: barangDesc.trim() || undefined,
      kategori: barangKategori,
      satuan: satuanDisplay,
      isiPerUnit: barangIsiUnit ? Number(barangIsiUnit) : undefined,
      satuanDasar: barangSatuan,
      hargaBeli: Number(barangHargaBeli.replace(/\D/g, "")) || 0,
      min: isJasa ? 0 : (Number(barangMinStok) || 0),
      garansi: isJasa ? "Tanpa garansi" : barangGaransi,
      berSN: isJasa ? false : barangSN.includes("Ya"),
    });
    setBarangOpen(false);
    setBarangNama("");
    setBarangMerk("");
    setBarangDesc("");
    setBarangSku("");
    setBarangIsiUnit("");
    setBarangHargaBeli("");
    setBarangMinStok("5");
    toast("Master barang berhasil ditambahkan");
  }

  return (
    <View className="gap-5">
      <PageHeader
        back
        title="Master Barang & Jasa (SN / Non-SN)"
        subtitle={`${data.products?.length || 0} barang & jasa terdaftar (Dikelola Gudang)`}
        action={
          <View className="flex-row gap-2">
            <Button variant="outline" size="sm" onPress={onBack}>
              <ArrowLeft size={15} color={colors.text} />
              <Text className="text-xs">Kembali</Text>
            </Button>
            <Button variant="outline" size="sm" onPress={() => onSelectCategory("kategori-barang")}>
              <Layers size={14} color={colors.text} />
              <Text className="text-xs">Kategori Produk</Text>
            </Button>
            {canAddBarang ? (
              <>
                <Button variant="outline" size="sm" onPress={() => setBatchSnOpen(true)}>
                  <Plus size={15} color={colors.text} />
                  <Text className="text-xs">Daftar Unit per SN</Text>
                </Button>
                <Button size="sm" onPress={() => setBarangOpen(true)}>
                  <Plus size={15} color={colors.background} />
                  <Text className="text-xs">Tambah Barang / Jasa</Text>
                </Button>
              </>
            ) : null}
            <Button variant="outline" size="sm" onPress={() => router.push("/stock")}>
              <Text className="text-xs">Lihat Stok Fisik</Text>
            </Button>
          </View>
        }
      />
      <DataTable
        columns={[
          { key: "nama", label: "Nama Barang / Jasa", primary: true, flex: 1.8 },
          { key: "merk", label: "Merk / Brand", flex: 1 },
          { key: "sku", label: "SKU / Kode", flex: 1 },
          { key: "kategori", label: "Kategori", flex: 1 },
          { key: "satuan", label: "Satuan", flex: 0.8 },
          { key: "hargaDisplay", label: "Harga Beli", flex: 1.2 },
          { key: "garansi", label: "Garansi", flex: 1 },
          { key: "tipeSN", label: "Tipe Item", flex: 1.1 },
        ]}
        rows={(data.products || []).map((p: any) => {
          const rawPrice = Number(p.hargaBeli ?? p.purchasePrice ?? 0);
          return {
            ...p,
            merk: p.merk || p.brand || "-",
            hargaDisplay: rawPrice > 0 ? rupiah(rawPrice) : "-",
            tipeSN: p.type === "JASA" ? "Jasa (Non-Stok)" : p.berSN ? "Barang Ber-SN" : "Barang Non-SN",
          };
        })}
        pageSize={8}
        actionsWidth={canEditPrice ? 96 : canAddBarang ? 72 : 64}
        renderActions={(row: any) => (
          <View className="flex-row items-center gap-1">
            {canEditPrice ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg hover:bg-primary/10"
                onPress={() => handleOpenEditPrice(row)}
              >
                <Edit3 size={15} color={colors.primary} />
              </Button>
            ) : null}
            {renderActions ? renderActions(row) : null}
          </View>
        )}
      />

      {/* Modal Tambah Barang (Gudang) */}
      <Dialog open={barangOpen} onOpenChange={setBarangOpen}>
        <DialogContent className="sm:max-w-xl md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tambah Master Barang & Produk</DialogTitle>
          </DialogHeader>
          <View className="gap-4">
            <FormField label="Nama Produk / Barang" required>
              <Input
                value={barangNama}
                onChangeText={setBarangNama}
                placeholder="Contoh: Switch PoE 24 Port Managed"
              />
            </FormField>
            <FormField label="Merk / Brand (Pabrikan)">
              <Input
                value={barangMerk}
                onChangeText={setBarangMerk}
                placeholder="Contoh: Uniview, Hikvision, Belden, Ruijie"
              />
            </FormField>
            <FormField label="Kode SKU" required>
              <Input
                value={barangSku}
                onChangeText={setBarangSku}
                placeholder="Contoh: SW-POE-24P"
              />
            </FormField>
            <FormField label="Kategori Produk" required>
              <SearchableSelect
                value={barangKategori}
                onChange={setBarangKategori}
                options={(data.productCategories || []).map((c: any) => String(c.nama))}
              />
            </FormField>
            <FormField label="Unit Satuan" required>
              <SearchableSelect
                value={barangSatuan}
                onChange={setBarangSatuan}
                options={["unit", "roll", "pcs", "box", "pack", "set"]}
              />
            </FormField>

            {barangSatuan === "roll" ? (
              <FormField label="Panjang per Roll (Meter)" required>
                <Input
                  value={barangIsiUnit}
                  onChangeText={setBarangIsiUnit}
                  keyboardType="numeric"
                  placeholder="Contoh: 305 (untuk roll 305 meter)"
                />
              </FormField>
            ) : ["box", "pack", "set", "pcs"].includes(barangSatuan) ? (
              <FormField label={`Isi per ${barangSatuan.toUpperCase()} (Pcs / Unit)`}>
                <Input
                  value={barangIsiUnit}
                  onChangeText={setBarangIsiUnit}
                  keyboardType="numeric"
                  placeholder="Contoh: 50 atau 100"
                />
              </FormField>
            ) : null}
            <FormField label="Estimasi Harga Beli (Rp)">
              <Input
                value={barangHargaBeli ? formatThousands(barangHargaBeli) : ""}
                onChangeText={(v) => setBarangHargaBeli(v.replace(/\D/g, ""))}
                keyboardType="numeric"
                placeholder="Contoh: 1.200.000"
              />
            </FormField>
            <FormField label="Stok Minimum Peringatan">
              <Input
                value={barangMinStok}
                onChangeText={setBarangMinStok}
                keyboardType="numeric"
                placeholder="Contoh: 5"
              />
            </FormField>
            <FormField label="Garansi Unit" required>
              <SearchableSelect
                value={barangGaransi}
                onChange={setBarangGaransi}
                options={["1 tahun", "2 tahun", "3 tahun", "Tanpa garansi"]}
              />
            </FormField>
            <FormField label="Tipe Item (Barang Ber-SN / Non-SN / Jasa)" required>
              <SearchableSelect
                value={barangSN}
                onChange={setBarangSN}
                options={["Ya (Serial Number)", "Tidak (Non-SN / Curah)", "Jasa (Instalasi / Layanan Non-Stok)"]}
              />
            </FormField>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setBarangOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSaveBarang}>
              <Text>Simpan Barang</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Edit Harga Barang / Jasa */}
      <Dialog open={editPriceOpen} onOpenChange={setEditPriceOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Harga Barang / Jasa</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <View className="bg-muted/40 p-3 rounded-lg border border-border/60 gap-1">
              <Text className="text-xs text-muted-foreground">Item:</Text>
              <Text className="text-sm font-bold text-foreground">
                {editingProduct?.nama}
              </Text>
              <Text className="text-xs font-mono text-primary">
                SKU: {editingProduct?.sku} · Satuan: {editingProduct?.satuan}
              </Text>
            </View>

            <FormField label="Harga Beli / Standar (Rp)" required>
              <Input
                value={editHargaVal ? formatThousands(editHargaVal) : ""}
                onChangeText={(v) => setEditHargaVal(v.replace(/\D/g, ""))}
                keyboardType="numeric"
                placeholder="Contoh: 1.500.000"
                autoFocus
              />
            </FormField>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setEditPriceOpen(false)} disabled={isSavingPrice}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSavePrice} disabled={isSavingPrice}>
              <Text>{isSavingPrice ? "Menyimpan..." : "Simpan Harga"}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BatchSerialRegisterModal open={batchSnOpen} onClose={() => setBatchSnOpen(false)} />
    </View>
  );
}

