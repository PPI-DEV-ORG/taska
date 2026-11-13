import * as React from "react";
import { View, Pressable, ScrollView } from "react-native";
import {
  Package,
  Wrench,
  Check,
  Tag,
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FormField } from "@/components/taska/basics";
import { SearchableSelect, ProductSelect } from "@/components/taska/dialogs";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { rupiah, formatThousands } from "@/lib/format";
import {
  PPH_MODE_OPTIONS,
  pphModeToTipe,
  pphRateFor,
  type PphMode,
} from "@/modules/quotation/lib";
import { cn } from "@/lib/utils";
import type { Row } from "@/constants/modules";

interface ItemEditorDialogItem {
  id?: number | string | null;
  productId?: number | string | null;
  item?: string;
  name?: string;
  productName?: string;
  customName?: string;
  qty?: number | string;
  satuan?: string;
  unit?: string;
  customUnit?: string;
  harga?: number | string;
  price?: number | string;
  pphMode?: PphMode;
  sn?: string;
  serialNumbers?: string[];
  notes?: string;
  keterangan?: string;
  note?: string;
  itemType?: "BARANG" | "JASA";
  isNonInventory?: boolean;
  [key: string]: unknown;
}

interface ProductLike {
  id?: number | string | null;
  productId?: number | string | null;
  sku?: string;
  nama?: string;
  name?: string;
  satuan?: string;
  unit?: string;
  hargaBeli?: number | string;
  purchasePrice?: number | string;
  harga?: number | string;
  hargaJual?: number | string;
  price?: number | string;
  berSN?: boolean;
  hasSerial?: boolean;
  [key: string]: unknown;
}

interface SerialEntry {
  id?: number | string | null;
  productId?: number | string | null;
  produk?: string;
  sn?: string;
  rawStatus?: string;
  status?: string;
  [key: string]: unknown;
}

export interface ItemEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: ItemEditorDialogItem | null;
  initialItem?: ItemEditorDialogItem | null;
  itemIndex?: number | null;
  onSave: (savedItem: ItemEditorDialogItem, index?: number | null) => void | Promise<void>;
  title?: string;
  isBuyPrice?: boolean; // true for PO, false for SO / Penawaran / Invoice
  existingItems?: ItemEditorDialogItem[];
  /** Tampilkan input diskon per item (Rp / %). Dipakai di penawaran. */
  allowDiscount?: boolean;
}

const COMMON_UNITS = ["Unit", "Pcs", "Paket", "Titik", "Set", "Meter", "Roll", "Box"];

export function ItemEditorDialog(props: ItemEditorDialogProps) {
  const { open, onOpenChange, item: rawItem, initialItem, itemIndex } = props;
  const item = rawItem ?? initialItem;
  const key = open ? `${itemIndex ?? "new"}-${item?.productId ?? item?.id ?? item?.name ?? "item"}` : "closed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <ItemEditorInner key={key} {...props} /> : null}
    </Dialog>
  );
}

function ItemEditorInner({
  onOpenChange,
  item: rawItem,
  initialItem,
  itemIndex,
  onSave,
  title,
  isBuyPrice = false,
  existingItems = [],
  allowDiscount = false,
}: ItemEditorDialogProps) {
  const item = rawItem ?? initialItem;
  const { data, toast } = useApp();

  const isJasaInitial = item ? (item.itemType === "JASA" || item.isNonInventory || /^\[JASA\]/i.test(item.item || item.name || "")) : false;
  const rawPriceInitial = item ? (item.harga ?? item.price ?? 0) : 0;
  const snStrInitial = item
    ? (Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0
        ? item.serialNumbers.join(", ")
        : (item.sn || ""))
    : "";

  const [mode, setMode] = React.useState<"master" | "custom">(() => (item?.productId ? "master" : item ? "custom" : "master"));
  const [nonInvType, setNonInvType] = React.useState<"BARANG" | "JASA">(() => (isJasaInitial ? "JASA" : "BARANG"));
  const [selectedProductId, setSelectedProductId] = React.useState<string>(() => (item?.productId ? String(item.productId) : ""));
  const [name, setName] = React.useState(() => (item?.item || item?.name || item?.productName || item?.customName || ""));
  const [qty, setQty] = React.useState(() => (item?.qty != null ? String(item.qty) : "1"));
  const [unit, setUnit] = React.useState(() => (item?.satuan || item?.unit || item?.customUnit || "Unit"));
  const [price, setPrice] = React.useState(() => (Number(rawPriceInitial) > 0 ? formatThousands(Number(rawPriceInitial)) : ""));
  const [pphMode, setPphMode] = React.useState<PphMode>(() => ((item?.pphMode as PphMode) || "none"));
  const [sn, setSn] = React.useState(() => snStrInitial);
  const [notes, setNotes] = React.useState(() => (item?.notes || item?.keterangan || item?.note || ""));
  const [saving, setSaving] = React.useState(false);
  // Diskon per item: persen atau nominal Rp (untuk seluruh qty baris ini)
  const [discType, setDiscType] = React.useState<"percent" | "nominal">(() =>
    Number(item?.diskonPct) > 0 || !(Number(item?.diskon) > 0) ? "percent" : "nominal"
  );
  const [discInput, setDiscInput] = React.useState<string>(() => {
    if (Number(item?.diskonPct) > 0) return String(item?.diskonPct);
    if (Number(item?.diskon) > 0) return formatThousands(Number(item?.diskon));
    return "";
  });

  // Selected product object from master store
  const selectedProductObj = React.useMemo(() => {
    if (!selectedProductId) return null;
    return (data.products ?? []).find(
      (p: any) => String(p.id) === String(selectedProductId)
    );
  }, [data.products, selectedProductId]);

  // Available serial numbers for selected product
  const availableSerials = React.useMemo(() => {
    if (!selectedProductObj) return [];
    const isSer = selectedProductObj.berSN || selectedProductObj.hasSerial;
    if (!isSer) return [];

    return (data.serials ?? []).filter(
      (s: any) =>
        (String(s.productId) === String(selectedProductObj.id) ||
          s.produk === selectedProductObj.nama ||
          s.produk === selectedProductObj.name) &&
        (s.rawStatus === "DI_GUDANG" || s.status === "Di gudang" || s.status === "Tersedia")
    );
  }, [data.serials, selectedProductObj]);

  // Stock summary calculation
  const productStock = React.useMemo(() => {
    if (!selectedProductObj) return null;
    if (selectedProductObj.berSN || selectedProductObj.hasSerial) {
      return availableSerials.length;
    }
    const sum = (data.stockSummary ?? [])
      .filter((s: any) => String(s.productId) === String(selectedProductObj.id))
      .reduce((acc: number, cur: any) => acc + Number(cur.saldo ?? cur.qty ?? cur.stok ?? 0), 0);
    return sum;
  }, [selectedProductObj, availableSerials, data.stockSummary]);

  // When a master product is picked
  function handleSelectProduct(prod: Row | null) {
    if (!prod) {
      setSelectedProductId("");
      return;
    }
    setSelectedProductId(String(prod.id));
    setName(prod.nama || prod.name || "");
    if (prod.satuan || prod.unit) {
      setUnit(prod.satuan || prod.unit);
    }
    const refPrice = isBuyPrice
      ? (prod.hargaBeli ?? prod.purchasePrice ?? prod.harga ?? 0)
      : (prod.hargaJual ?? prod.price ?? prod.harga ?? 0);
    if (refPrice > 0) {
      setPrice(formatThousands(refPrice));
    }
  }

  // Financial preview calculation
  const parsedQty = Math.max(0.001, parseFloat(qty.replace(/,/g, ".")) || 1);
  const parsedPrice = parseFloat(String(price).replace(/\D/g, "")) || 0;
  const grossLine = parsedQty * parsedPrice;
  const discPct = allowDiscount && discType === "percent" ? Math.min(100, Math.max(0, parseFloat(discInput.replace(",", ".")) || 0)) : 0;
  const discAmount = !allowDiscount
    ? 0
    : discType === "percent"
    ? Math.round((grossLine * discPct) / 100)
    : Math.min(grossLine, Number(String(discInput).replace(/\D/g, "")) || 0);
  const subtotal = Math.max(0, grossLine - discAmount);
  const itemPphAmount = Math.round(subtotal * pphRateFor(pphMode));
  // Penjualan: PPh dipotong customer saat bayar -> tidak mengurangi nilai item. Pembelian: kita yang memotong.
  const totalNet = isBuyPrice ? Math.max(0, subtotal - itemPphAmount) : subtotal;

  // Submit save
  async function handleSave() {
    if (!name.trim()) {
      toast("Nama barang / jasa wajib diisi!", "danger");
      return;
    }
    if (parsedQty <= 0) {
      toast("Jumlah (Qty) harus lebih dari 0!", "danger");
      return;
    }

    // Check duplicate SN in existingItems if SN filled
    const cleanSn = sn.trim();
    if (cleanSn) {
      const isDuplicate = existingItems.some((it, i) => {
        if (itemIndex !== undefined && itemIndex !== null && i === itemIndex) return false;
        const existSn = it.sn || (Array.isArray(it.serialNumbers) ? it.serialNumbers.join(", ") : "");
        return existSn && existSn.trim().toUpperCase() === cleanSn.toUpperCase();
      });
      if (isDuplicate) {
        toast(`Serial number (${cleanSn}) sudah ada di daftar item lain!`, "danger");
        return;
      }
    }

    const isJasa = nonInvType === "JASA" || pphMode !== "none" || /^\[JASA\]/i.test(name.trim());
    const finalName = name.trim();

    const resultItem = {
      ...(item ? item : {}),
      id: item?.id ? String(item.id) : undefined,
      item: finalName,
      name: finalName,
      productName: finalName,
      productId: selectedProductId ? Number(selectedProductId) : (item?.productId || undefined),
      qty: parsedQty,
      satuan: unit.trim() || (isJasa ? "paket" : "Unit"),
      unit: unit.trim() || (isJasa ? "paket" : "Unit"),
      harga: parsedPrice,
      price: parsedPrice,
      subtotal,
      total: subtotal,
      ...(allowDiscount
        ? { diskon: discAmount > 0 ? discAmount : undefined, diskonPct: discPct > 0 ? discPct : undefined }
        : {}),
      sn: cleanSn || undefined,
      serialNumbers: cleanSn ? cleanSn.split(",").map((s: string) => s.trim()).filter(Boolean) : undefined,
      itemType: isJasa ? ("JASA" as const) : ("BARANG" as const),
      isNonInventory: isJasa,
      pphMode,
      tipePph: pphModeToTipe(pphMode),
      pph: itemPphAmount,
      notes: notes.trim() || undefined,
      note: notes.trim() || undefined,
      keterangan: notes.trim() || undefined,
    };

    setSaving(true);
    try {
      await onSave(resultItem, itemIndex);
      onOpenChange(false);
    } catch (e: any) {
      toast(e?.message || "Gagal menyimpan item", "danger");
    } finally {
      setSaving(false);
    }
  }

  const isEditing = itemIndex !== undefined && itemIndex !== null && itemIndex >= 0;
  const dialogHeading = title || (isEditing ? "Edit Rincian Barang / Jasa" : "Tambah Barang / Jasa");

  return (
    <DialogContent className="max-w-lg w-[94vw] sm:w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6">
      <DialogHeader>
        <DialogTitle>{dialogHeading}</DialogTitle>
      </DialogHeader>

        <View className="gap-3.5 py-1">
          {/* Tab Pilihan: Master Stok vs Item Manual */}
          <View className="flex-row items-center gap-1.5 p-1 bg-muted/50 rounded-xl border border-border/60">
            <Button
              size="sm"
              variant={mode === "master" ? "default" : "ghost"}
              onPress={() => setMode("master")}
              className="flex-1 h-8 rounded-lg flex-row items-center justify-center gap-1.5"
            >
              <Package size={13} color={mode === "master" ? "#fff" : colors.muted} />
              <Text className="text-xs font-semibold">Master Stok Gudang</Text>
            </Button>
            <Button
              size="sm"
              variant={mode === "custom" ? "default" : "ghost"}
              onPress={() => setMode("custom")}
              className="flex-1 h-8 rounded-lg flex-row items-center justify-center gap-1.5"
            >
              <Wrench size={13} color={mode === "custom" ? "#fff" : colors.muted} />
              <Text className="text-xs font-semibold">Item Manual / Jasa</Text>
            </Button>
          </View>

          {/* MODE 1: MASTER STOK */}
          {mode === "master" ? (
            <View className="gap-2.5">
              <FormField
                label="Pilih Produk dari Master Stok"
                hint="Katalog produk, kategori, dan ketersediaan stok riil gudang"
              >
                <ProductSelect
                  productId={selectedProductId}
                  onChange={handleSelectProduct}
                  placeholder="Ketik untuk mencari produk master..."
                  filterNonService={false}
                />
              </FormField>

              {/* Product Info Chip */}
              {selectedProductObj ? (
                <View className="bg-primary/5 border border-primary/20 rounded-xl p-3 gap-1.5">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-1.5">
                      <Tag size={13} color={colors.primary} />
                      <Text className="text-xs font-bold text-primary">
                        {selectedProductObj.sku ? `SKU: ${selectedProductObj.sku}` : "Produk Master"}
                      </Text>
                    </View>
                    {productStock !== null && (
                      <View className="flex-row items-center gap-1">
                        <Text className="text-[11px] text-muted-foreground">Stok:</Text>
                        <Text
                          className={cn(
                            "text-xs font-bold",
                            productStock > 0 ? "text-emerald-600" : "text-danger"
                          )}
                        >
                          {productStock} {selectedProductObj.satuan || selectedProductObj.unit || "Unit"}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-xs font-medium text-foreground">
                    {selectedProductObj.nama || selectedProductObj.name}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : (
            /* MODE 2: MANUAL / JASA */
            <View className="gap-2.5">
              <View className="gap-1.5">
                <Text className="text-xs font-medium text-muted-foreground">Kategori Item Manual:</Text>
                <View className="flex-row gap-2">
                  <Button
                    size="sm"
                    variant={nonInvType === "BARANG" ? "default" : "outline"}
                    onPress={() => {
                      setNonInvType("BARANG");
                      setUnit("Unit");
                    }}
                    className="flex-1 h-8 px-2.5"
                  >
                    <Text className="text-xs">Barang Non-Stok / Ritel</Text>
                  </Button>
                  <Button
                    size="sm"
                    variant={nonInvType === "JASA" ? "default" : "outline"}
                    onPress={() => {
                      setNonInvType("JASA");
                      setUnit("paket");
                      setPphMode("pph23");
                    }}
                    className="flex-1 h-8 px-2.5"
                  >
                    <Text className="text-xs">Jasa / Instalasi / Subkon</Text>
                  </Button>
                </View>
              </View>
            </View>
          )}

          {/* Nama Barang / Jasa */}
          <FormField label="Nama Barang / Jasa" required>
            <Input
              value={name}
              onChangeText={setName}
              placeholder="Contoh: Kamera Thermal Uniview / Jasa Instalasi CCTV"
            />
          </FormField>

          {/* Qty & Satuan */}
          <View className="flex-row gap-3">
            <View className="w-32">
              <FormField label="Jumlah (Qty)" required>
                <Input
                  value={qty}
                  onChangeText={setQty}
                  keyboardType="numeric"
                  placeholder="1"
                />
              </FormField>
            </View>
            <View className="flex-1">
              <FormField label="Satuan" required>
                <Input
                  value={unit}
                  onChangeText={setUnit}
                  placeholder="Unit, Pcs, Paket..."
                />
              </FormField>
            </View>
          </View>

          {/* Unit suggestion pills */}
          <View className="flex-row flex-wrap items-center gap-1.5 -mt-1.5">
            <Text className="text-[11px] text-muted-foreground mr-1">Pilihan:</Text>
            {COMMON_UNITS.map((u) => (
              <Pressable
                key={u}
                onPress={() => setUnit(u)}
                className={cn(
                  "px-2 py-0.5 rounded-md border text-[11px]",
                  unit.toLowerCase() === u.toLowerCase()
                    ? "bg-primary/15 border-primary text-primary font-semibold"
                    : "bg-panel border-border/80 text-muted-foreground hover:bg-muted"
                )}
              >
                <Text
                  className={cn(
                    "text-[11px]",
                    unit.toLowerCase() === u.toLowerCase()
                      ? "text-primary font-bold"
                      : "text-muted-foreground"
                  )}
                >
                  {u}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Harga Satuan (Rp) */}
          <FormField
            label={isBuyPrice ? "Harga Satuan Beli (Rp)" : "Harga Satuan Jual (Rp)"}
            hint={isBuyPrice ? "Harga acuan beli ke supplier" : "Harga jual per satuan barang/jasa"}
            required
          >
            <Input
              value={price ? formatThousands(price) : ""}
              onChangeText={(v) => setPrice(formatThousands(v))}
              keyboardType="numeric"
              placeholder="0"
            />
          </FormField>

          {/* Diskon per item (opsional) */}
          {allowDiscount ? (
            <View className="gap-1.5">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-medium text-foreground">Diskon Item Ini (Opsional)</Text>
                <View className="flex-row rounded-lg bg-panel p-0.5 border border-border">
                  {([
                    { id: "percent", label: "Persen (%)" },
                    { id: "nominal", label: "Nominal (Rp)" },
                  ] as const).map((opt) => {
                    const active = discType === opt.id;
                    return (
                      <Pressable
                        key={opt.id}
                        onPress={() => {
                          if (active) return;
                          // Konversi nilai yang sudah diisi agar tidak hilang saat ganti tipe
                          if (opt.id === "nominal") setDiscInput(discAmount > 0 ? formatThousands(discAmount) : "");
                          else setDiscInput(grossLine > 0 && discAmount > 0 ? String(Math.round((discAmount / grossLine) * 1000) / 10) : "");
                          setDiscType(opt.id);
                        }}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        className={cn("h-6 px-2.5 rounded-md items-center justify-center", active ? "bg-primary" : "")}
                      >
                        <Text className={cn("text-xs", active ? "text-primary-foreground font-semibold" : "text-muted-foreground")}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <Input
                value={discInput}
                onChangeText={(v) =>
                  setDiscInput(discType === "percent" ? v.replace(/[^\d.,]/g, "") : formatThousands(v))
                }
                keyboardType="numeric"
                placeholder={discType === "percent" ? "Contoh: 10" : "Contoh: 250.000"}
              />
              {discAmount > 0 ? (
                <Text className="text-[11px] text-muted-foreground">
                  {discType === "percent"
                    ? `Potongan ${rupiah(discAmount)} untuk ${parsedQty} ${unit}`
                    : `Setara ${grossLine > 0 ? Math.round((discAmount / grossLine) * 1000) / 10 : 0}% dari nilai baris`}
                </Text>
              ) : null}
            </View>
          ) : null}

          {/* PPh Barang / Jasa (Opsional) */}
          <FormField label="PPh Barang / Jasa (Opsional)" hint="Pilih pemotongan PPh jika ada">
            <SearchableSelect
              value={pphModeToTipe(pphMode)}
              options={PPH_MODE_OPTIONS.map((o) => o.label)}
              onChange={(lbl) => {
                const opt = PPH_MODE_OPTIONS.find((o) => o.label === lbl);
                setPphMode(opt?.id || "none");
              }}
              placeholder="Tanpa PPh"
            />
          </FormField>

          {/* Serial Number (SN) / Alokasi Unit */}
          <View className="gap-1.5">
            <FormField
              label="Serial Number (SN) / Alokasi Unit (Opsional)"
              hint="Masukkan SN atau pisahkan koma jika multi-unit"
            >
              <Input
                value={sn}
                onChangeText={setSn}
                placeholder="Contoh: SN12345678, SN12345679"
              />
            </FormField>

            {/* Quick Available SN Chips if Master has Serials */}
            {availableSerials.length > 0 ? (
              <View className="p-2 bg-muted/40 rounded-lg border border-border/60 gap-1.5">
                <Text className="text-[11px] font-semibold text-foreground">
                  Pilih Unit SN Tersedia di Gudang ({availableSerials.length} unit):
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-0.5">
                  <View className="flex-row items-center gap-1.5">
                    {availableSerials.slice(0, 15).map((s: any) => {
                      const curSns = sn.split(",").map((x) => x.trim().toLowerCase());
                      const isPicked = curSns.includes(String(s.sn).toLowerCase());
                      return (
                        <Pressable
                          key={s.id || s.sn}
                          onPress={() => {
                            if (isPicked) {
                              const remaining = sn
                                .split(",")
                                .map((x) => x.trim())
                                .filter((x) => x.toLowerCase() !== String(s.sn).toLowerCase());
                              setSn(remaining.join(", "));
                            } else {
                              const currentList = sn ? sn.split(",").map((x) => x.trim()) : [];
                              setSn([...currentList, String(s.sn)].join(", "));
                            }
                          }}
                          className={cn(
                            "px-2 py-1 rounded border flex-row items-center gap-1",
                            isPicked
                              ? "bg-primary border-primary"
                              : "bg-card border-border/70 hover:bg-muted"
                          )}
                        >
                          {isPicked && <Check size={11} color="#fff" />}
                          <Text
                            className={cn(
                              "text-[11px] font-mono",
                              isPicked ? "text-white font-bold" : "text-foreground"
                            )}
                          >
                            {s.sn}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            ) : null}
          </View>

          {/* Keterangan / Spesifikasi (Opsional) */}
          <FormField label="Keterangan / Spesifikasi Tambahan (Opsional)">
            <Input
              value={notes}
              onChangeText={setNotes}
              placeholder="Contoh: Garansi 2 tahun, bonus bracket wallmount"
            />
          </FormField>

          {/* Live Subtotal Card */}
          <View className="bg-card border border-border/80 rounded-xl p-3 gap-1.5 mt-1">
            <View className="flex-row justify-between items-center">
              <Text className="text-xs text-muted-foreground">Kuantitas & Harga Satuan:</Text>
              <Text className="text-xs font-medium text-foreground">
                {parsedQty} {unit} × {rupiah(parsedPrice)}
              </Text>
            </View>
            {discAmount > 0 ? (
              <View className="flex-row justify-between items-center">
                <Text className="text-xs text-danger font-medium">
                  Diskon item{discType === "percent" && discPct > 0 ? ` (${discPct}%)` : ""}:
                </Text>
                <Text className="text-xs font-semibold text-danger">-{rupiah(discAmount)}</Text>
              </View>
            ) : null}
            <View className="flex-row justify-between items-center">
              <Text className="text-xs text-muted-foreground">Subtotal DPP:</Text>
              <Text className="text-xs font-semibold text-foreground">{rupiah(subtotal)}</Text>
            </View>
            {itemPphAmount > 0 && (
              <View className="flex-row justify-between items-center">
                <Text className={cn("text-xs font-medium", isBuyPrice ? "text-danger" : "text-muted-foreground")}>
                  {isBuyPrice ? `Potongan ${pphModeToTipe(pphMode)}:` : `${pphModeToTipe(pphMode)} dipotong customer saat bayar:`}
                </Text>
                <Text className={cn("text-xs font-semibold", isBuyPrice ? "text-danger" : "text-muted-foreground")}>
                  {isBuyPrice ? "-" : ""}
                  {rupiah(itemPphAmount)}
                </Text>
              </View>
            )}
            <View className="flex-row justify-between items-center pt-1 border-t border-border/60 mt-0.5">
              <Text className="text-xs font-bold text-foreground">Total Nilai Item:</Text>
              <Text className="text-sm font-bold text-primary">{rupiah(totalNet)}</Text>
            </View>
          </View>
        </View>

        <DialogFooter className="flex-row items-center justify-end gap-2 pt-2 border-t border-border/60">
          <Button variant="outline" onPress={() => onOpenChange(false)} disabled={saving}>
            <Text>Batal</Text>
          </Button>
          <Button onPress={handleSave} disabled={saving}>
            <Text className="text-white font-semibold">
              {saving ? "Menyimpan..." : isEditing ? "Simpan Perubahan" : "Simpan Item"}
            </Text>
          </Button>
        </DialogFooter>
      </DialogContent>
  );
}
