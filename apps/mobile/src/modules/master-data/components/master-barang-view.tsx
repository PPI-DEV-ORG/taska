import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, Layers, Plus } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader, FormField } from "@/components/taska/basics";
import { SearchableSelect, formatThousands } from "@/components/taska/dialogs";
import { DataTable } from "@/components/taska/data-table";
import { BatchSerialRegisterModal } from "@/components/taska/serial-item-picker";
import { colors } from "@/tokens";
import type { MasterKey } from "../types";

interface MasterBarangViewProps {
  data: any;
  user: any;
  onBack: () => void;
  onSelectCategory: (cat: MasterKey) => void;
  addRow: (module: string, payload: any) => void;
  toast: (msg: string, type?: "success" | "danger" | "info" | "warning") => void;
  renderActions?: (row: any) => React.ReactNode;
}

export function MasterBarangView({
  data,
  user,
  onBack,
  onSelectCategory,
  addRow,
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

  const isSuper = user?.role === "super_admin";
  const canAddBarang = isSuper || user?.role === "gudang" || user?.role === "bos" || user?.role === "admin" || user?.role === "procurement";

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
          { key: "garansi", label: "Garansi", flex: 1 },
          { key: "tipeSN", label: "Tipe Item", flex: 1.1 },
        ]}
        rows={(data.products || []).map((p: any) => ({
          ...p,
          merk: p.merk || p.brand || "-",
          tipeSN: p.type === "JASA" ? "Jasa (Non-Stok)" : p.berSN ? "Barang Ber-SN" : "Barang Non-SN",
        }))}
        pageSize={8}
        actionsWidth={canAddBarang ? 72 : 64}
        renderActions={renderActions}
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
      <BatchSerialRegisterModal open={batchSnOpen} onClose={() => setBatchSnOpen(false)} />
    </View>
  );
}

