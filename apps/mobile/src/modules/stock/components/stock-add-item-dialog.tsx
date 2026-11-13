import * as React from "react";
import { ScrollView, Switch, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FormField } from "@/components/taska/basics";
import { SearchableSelect } from "@/components/taska/dialogs";
import { formatThousands, rupiah } from "@/lib/format";
import { colors } from "@/tokens";
import type { ItemKind } from "../types";

interface StockAddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: any[];
  warehouses: any[];
  onSave: (payload: any) => Promise<void>;
  toast: (msg: string, type?: "success" | "danger" | "info" | "warning") => void;
}

export function StockAddItemDialog({
  open,
  onOpenChange,
  categories,
  warehouses,
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
  const [newItemSellPrice, setNewItemSellPrice] = React.useState("");
  const [newItemMin, setNewItemMin] = React.useState("5");
  const [initialStockEnabled, setInitialStockEnabled] = React.useState(false);
  const [initialWarehouse, setInitialWarehouse] = React.useState("");
  const [initialQty, setInitialQty] = React.useState("0");
  const [initialSerials, setInitialSerials] = React.useState("");

  const isJasa = newItemKind === "JASA";
  const isSn = newItemKind === "BARANG_SN";
  const initialStockQty = Math.max(0, Math.floor(Number(String(initialQty).replace(/\D/g, "")) || 0));
  const initialCost = Number(String(newItemPrice).replace(/\D/g, "")) || 0;
  const initialTotalValue = initialStockQty * initialCost;
  const parsedInitialSerials = React.useMemo(
    () => initialSerials.split(/[\n,;]+/).map((sn) => sn.trim()).filter(Boolean),
    [initialSerials],
  );
  const serialCountMismatch =
    initialStockEnabled &&
    isSn &&
    initialStockQty > 0 &&
    parsedInitialSerials.length !== initialStockQty;

  async function handleSaveNewItem() {
    if (!newItemName.trim() || !newItemSku.trim()) {
      toast("Nama barang/jasa dan kode SKU wajib diisi", "danger");
      return;
    }

    const initialStock = initialStockEnabled && !isJasa ? initialStockQty : 0;
    const warehouseRow = initialStock > 0
      ? (warehouses || []).find((w: any) => String(w.nama) === initialWarehouse)
      : undefined;

    if (initialStock > 0) {
      if (!warehouseRow) {
        toast("Gudang penyimpanan stok awal wajib dipilih", "danger");
        return;
      }
      if (initialCost <= 0) {
        toast("Harga modal / harga beli per unit wajib lebih dari 0", "danger");
        return;
      }
      if (isSn) {
        if (parsedInitialSerials.length !== initialStock) {
          toast(
            `Jumlah SN (${parsedInitialSerials.length}) harus sama dengan qty stok awal (${initialStock})`,
            "danger",
          );
          return;
        }
        if (new Set(parsedInitialSerials).size !== parsedInitialSerials.length) {
          toast("Serial number tidak boleh duplikat", "danger");
          return;
        }
      }
    }

    try {
      await onSave({
        nama: newItemName.trim(),
        sku: newItemSku.trim().toUpperCase(),
        type: isJasa ? "JASA" : "BARANG",
        jenisItem: isJasa ? "Jasa" : "Barang",
        merk: isJasa ? "-" : (newItemBrand.trim() || undefined),
        kategori: newItemCategory || categories?.[0]?.nama || "Umum",
        satuan: newItemUnit || (isJasa ? "lot" : "unit"),
        hargaBeli: Number(String(newItemPrice).replace(/\D/g, "")) || 0,
        hargaJual: Number(String(newItemSellPrice).replace(/\D/g, "")) || 0,
        min: isJasa ? 0 : (Number(newItemMin) || 0),
        berSN: isSn,
        ...(initialStock > 0
          ? {
              initialStock,
              warehouseId: Number(warehouseRow?.id),
              ...(isSn ? { serialNumbers: parsedInitialSerials } : {}),
            }
          : {}),
      });
    } catch {
      return;
    }
    onOpenChange(false);
    setNewItemName("");
    setNewItemSku("");
    setNewItemBrand("");
    setNewItemPrice("");
    setNewItemSellPrice("");
    setInitialStockEnabled(false);
    setInitialWarehouse("");
    setInitialQty("0");
    setInitialSerials("");
    toast(
      `${isJasa ? "Jasa" : isSn ? "Barang Ber-SN" : "Barang Non-SN"} berhasil ditambahkan${
        initialStock > 0 ? ` dengan stok awal ${initialStock} ${newItemUnit}` : ""
      }`,
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Tambah Barang (SN / Non-SN) atau Jasa</DialogTitle>
        </DialogHeader>
        <ScrollView
          className="max-h-[62vh] pr-1"
          contentContainerClassName="gap-3 py-2"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
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
                    if (opt.key === "JASA") {
                      setNewItemUnit("lot");
                      setInitialStockEnabled(false);
                    } else {
                      setNewItemUnit("unit");
                    }
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
            {!(initialStockEnabled && !isJasa) ? (
              <View className="flex-1">
                <FormField label={newItemKind === "JASA" ? "Tarif Dasar Jasa (Rp)" : "Harga Beli / HPP (Rp)"}>
                  <Input
                    value={newItemPrice ? formatThousands(newItemPrice) : ""}
                    onChangeText={(value) => setNewItemPrice(formatThousands(value))}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </FormField>
              </View>
            ) : null}
          </View>

          {!isJasa ? (
            <View className="border-border bg-input/20 gap-3 rounded-xl border p-3">
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-foreground text-sm font-semibold">Input Saldo Awal Gudang (Opsional)</Text>
                  <Text className="text-muted-foreground mt-0.5 text-[11px]">
                    Catat stok fisik awal sekaligus posting jurnal persediaan otomatis.
                  </Text>
                </View>
                <Switch
                  value={initialStockEnabled}
                  onValueChange={(value) => {
                    setInitialStockEnabled(value);
                    if (value && !initialWarehouse) {
                      const first = warehouses?.[0];
                      if (first?.nama) setInitialWarehouse(String(first.nama));
                    }
                  }}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={initialStockEnabled ? "#FFFFFF" : colors.muted}
                  ios_backgroundColor={colors.border}
                  {...({
                    // React Native Web memakai prop ini; tanpa ini thumb aktif memakai hijau bawaan.
                    activeThumbColor: "#FFFFFF",
                    activeTrackColor: colors.primary,
                  } as any)}
                />
              </View>

              {initialStockEnabled ? (
                <>
                  <FormField label="Gudang Penyimpanan" required>
                    <SearchableSelect
                      value={initialWarehouse}
                      onChange={setInitialWarehouse}
                      options={(warehouses || []).map((w: any) => String(w.nama))}
                      placeholder="Pilih gudang..."
                    />
                  </FormField>

                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <FormField label="Qty Saldo Awal" required>
                        <Input
                          value={initialQty}
                          onChangeText={setInitialQty}
                          keyboardType="numeric"
                          placeholder="0"
                        />
                      </FormField>
                    </View>
                    <View className="flex-1">
                      <FormField label="Harga Modal / Unit (Rp)" required>
                        <Input
                          value={newItemPrice ? formatThousands(newItemPrice) : ""}
                          onChangeText={(value) => setNewItemPrice(formatThousands(value))}
                          keyboardType="numeric"
                          placeholder="0"
                        />
                      </FormField>
                    </View>
                  </View>

                  {isSn ? (
                    <FormField
                      label={`Serial Number (${parsedInitialSerials.length}/${initialStockQty})`}
                      required
                      hint="Pisahkan dengan koma atau baris baru. Jumlah SN harus sama dengan qty saldo awal."
                      error={
                        serialCountMismatch
                          ? `Jumlah SN belum sesuai: ${parsedInitialSerials.length} dari ${initialStockQty} unit.`
                          : undefined
                      }
                    >
                      <Textarea
                        value={initialSerials}
                        onChangeText={setInitialSerials}
                        placeholder={"SN001\nSN002"}
                        numberOfLines={4}
                      />
                    </FormField>
                  ) : null}

                  <View className="bg-background/60 border-border rounded-lg border p-3">
                    <View className="flex-row items-center justify-between gap-3">
                      <Text className="text-muted-foreground text-xs">Total nilai saldo awal</Text>
                      <Text className="text-foreground text-sm font-semibold">{rupiah(initialTotalValue)}</Text>
                    </View>
                    <Text className="text-muted-foreground mt-1 text-[11px]">
                      Nilai ini otomatis dijurnal ke COA Persediaan (Dr) dan Ekuitas Saldo Awal (Cr).
                    </Text>
                    {initialStockQty > 0 && initialCost <= 0 ? (
                      <Text className="text-danger mt-1 text-[11px]">
                        Harga beli/modal wajib lebih dari 0 agar jurnal memiliki nilai.
                      </Text>
                    ) : null}
                  </View>
                </>
              ) : null}
            </View>
          ) : null}

          <FormField label={newItemKind === "JASA" ? "Harga Jual Jasa (Rp)" : "Harga Jual Produk (Rp)"} hint="Harga acuan default saat dimasukkan ke Penawaran / SO">
            <Input
              value={newItemSellPrice ? formatThousands(newItemSellPrice) : ""}
              onChangeText={(value) => setNewItemSellPrice(formatThousands(value))}
              keyboardType="numeric"
              placeholder="Contoh: 1.500.000"
            />
          </FormField>
          {newItemKind !== "JASA" ? (
            <FormField label="Batas Stok Minimum">
              <Input value={newItemMin} onChangeText={setNewItemMin} keyboardType="numeric" placeholder="5" />
            </FormField>
          ) : null}
        </ScrollView>
        <DialogFooter className="pt-1">
          <Button variant="outline" onPress={() => onOpenChange(false)}>
            <Text>Batal</Text>
          </Button>
          <Button onPress={handleSaveNewItem} disabled={serialCountMismatch}>
            <Text>Simpan ke Katalog</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

