import * as React from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FormField } from "@/components/taska/basics";
import { SearchableSelect } from "@/components/taska/dialogs";
import type { ItemKind } from "../types";

interface StockAddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: any[];
  onSave: (payload: any) => Promise<void>;
  toast: (msg: string, type?: "success" | "danger" | "info" | "warning") => void;
}

export function StockAddItemDialog({
  open,
  onOpenChange,
  categories,
  onSave,
  toast,
}: StockAddItemDialogProps) {
  const [newItemKind, setNewItemKind] = React.useState<ItemKind>("BARANG_SN");
  const [newItemName, setNewItemName] = React.useState("");
  const [newItemSku, setNewItemSku] = React.useState("");
  const [newItemBrand, setNewItemBrand] = React.useState("");
  const [newItemCategory, setNewItemCategory] = React.useState("");
  const [newItemUnit, setNewItemUnit] = React.useState("unit");
  const [newItemPrice, setNewItemPrice] = React.useState("");
  const [newItemMin, setNewItemMin] = React.useState("5");

  async function handleSaveNewItem() {
    if (!newItemName.trim() || !newItemSku.trim()) {
      toast("Nama barang/jasa dan kode SKU wajib diisi", "danger");
      return;
    }
    const isJasa = newItemKind === "JASA";
    const isSn = newItemKind === "BARANG_SN";
    await onSave({
      nama: newItemName.trim(),
      sku: newItemSku.trim().toUpperCase(),
      type: isJasa ? "JASA" : "BARANG",
      jenisItem: isJasa ? "Jasa" : "Barang",
      merk: isJasa ? "-" : (newItemBrand.trim() || undefined),
      kategori: newItemCategory || categories?.[0]?.nama || "Umum",
      satuan: newItemUnit || (isJasa ? "lot" : "unit"),
      hargaBeli: Number(String(newItemPrice).replace(/\D/g, "")) || 0,
      min: isJasa ? 0 : (Number(newItemMin) || 0),
      berSN: isSn,
    });
    onOpenChange(false);
    setNewItemName("");
    setNewItemSku("");
    setNewItemBrand("");
    setNewItemPrice("");
    toast(`${isJasa ? "Jasa" : isSn ? "Barang Ber-SN" : "Barang Non-SN"} berhasil ditambahkan`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah Barang (SN / Non-SN) atau Jasa</DialogTitle>
        </DialogHeader>
        <View className="gap-3 py-2">
          <FormField label="Jenis Item Persediaan / Katalog" required>
            <View className="flex-row flex-wrap gap-2">
              {([
                { key: "BARANG_SN", label: "Barang Ber-SN" },
                { key: "BARANG_NON_SN", label: "Barang Non-SN" },
                { key: "JASA", label: "Jasa (Instalasi / Layanan)" },
              ] as const).map((opt) => (
                <Button
                  key={opt.key}
                  size="sm"
                  variant={newItemKind === opt.key ? "default" : "outline"}
                  onPress={() => {
                    setNewItemKind(opt.key);
                    if (opt.key === "JASA") setNewItemUnit("lot");
                    else setNewItemUnit("unit");
                  }}
                >
                  <Text className="text-xs">{opt.label}</Text>
                </Button>
              ))}
            </View>
          </FormField>
          <FormField label={newItemKind === "JASA" ? "Nama Layanan / Jasa" : "Nama Barang"} required>
            <Input
              value={newItemName}
              onChangeText={setNewItemName}
              placeholder={newItemKind === "JASA" ? "Contoh: Jasa Instalasi & Setting Kamera CCTV" : "Contoh: Kamera IP UNV 4MP Outdoor"}
            />
          </FormField>
          <FormField label="Kode SKU / Kode Jasa" required>
            <Input
              value={newItemSku}
              onChangeText={setNewItemSku}
              placeholder={newItemKind === "JASA" ? "Contoh: JASA-INST-CCTV" : "Contoh: UNV-IPC2124"}
            />
          </FormField>
          {newItemKind !== "JASA" ? (
            <FormField label="Merk / Brand">
              <Input value={newItemBrand} onChangeText={setNewItemBrand} placeholder="Contoh: Uniview, Hikvision, Belden" />
            </FormField>
          ) : null}
          <FormField label="Kategori">
            <SearchableSelect
              value={newItemCategory}
              onChange={setNewItemCategory}
              options={(categories || []).map((c: any) => String(c.nama))}
              placeholder="Pilih kategori..."
            />
          </FormField>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <FormField label="Satuan">
                <SearchableSelect
                  value={newItemUnit}
                  onChange={setNewItemUnit}
                  options={newItemKind === "JASA" ? ["lot", "titik", "unit", "paket", "hari"] : ["unit", "pcs", "roll", "box", "pack", "set"]}
                />
              </FormField>
            </View>
            <View className="flex-1">
              <FormField label={newItemKind === "JASA" ? "Tarif Dasar Jasa (Rp)" : "Harga Beli / HPP (Rp)"}>
                <Input value={newItemPrice} onChangeText={setNewItemPrice} keyboardType="numeric" placeholder="0" />
              </FormField>
            </View>
          </View>
          {newItemKind !== "JASA" ? (
            <FormField label="Batas Stok Minimum">
              <Input value={newItemMin} onChangeText={setNewItemMin} keyboardType="numeric" placeholder="5" />
            </FormField>
          ) : null}
        </View>
        <DialogFooter>
          <Button variant="outline" onPress={() => onOpenChange(false)}>
            <Text>Batal</Text>
          </Button>
          <Button onPress={handleSaveNewItem}>
            <Text>Simpan ke Katalog</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

