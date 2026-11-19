import * as React from "react";
import { View, Pressable, ScrollView, Platform } from "react-native";
import {
  Search,
  Package,
  Check,
  Tag,
  DollarSign,
  Layers,
  ChevronDown,
  Warehouse,
  AlertTriangle,
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
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { rupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Row } from "@/constants/modules";

export interface ProductSelectProps {
  value?: string;
  productId?: string | number | null;
  onChange?: (selectedProduct: Row | null) => void;
  placeholder?: string;
  error?: boolean;
  required?: boolean;
  filterNonService?: boolean;
  categoryFilter?: string;
  triggerClassName?: string;
  multiple?: boolean;
  selectedNames?: string[];
  onToggleMultiple?: (selectedProduct: Row) => void;
}

export function ProductSelect({
  value,
  productId,
  onChange,
  placeholder = "Pilih Produk dari Master Stok...",
  error,
  filterNonService = true,
  categoryFilter,
  triggerClassName,
  multiple = false,
  selectedNames,
  onToggleMultiple,
}: ProductSelectProps) {
  const { data } = useApp();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [selectedCat, setSelectedCat] = React.useState<string>(categoryFilter || "ALL");

  const products: Row[] = React.useMemo(() => {
    let list = (data.products ?? []) as Row[];
    if (filterNonService) {
      list = list.filter((p: any) => p.type !== "JASA" && p.jenisItem !== "Jasa");
    }
    return list;
  }, [data.products, filterNonService]);

  const serials = React.useMemo(() => (data.serials ?? []) as any[], [data.serials]);
  const stockSummary = React.useMemo(() => (data.stockSummary ?? []) as any[], [data.stockSummary]);

  // Categories list for filter pills
  const categories = React.useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      const cat = p.kategori || p.category || (p as any).categoryName;
      if (cat && typeof cat === "string" && cat.trim()) {
        set.add(cat.trim());
      }
    });
    return Array.from(set);
  }, [products]);

  // Stock calculation helper
  const getProductAvailableStock = React.useCallback(
    (p: Row): number => {
      if (p.berSN || (p as any).hasSerial) {
        return serials.filter(
          (s: any) =>
            (String(s.productId) === String(p.id) ||
              (p.nama && s.produk === p.nama) ||
              (p.name && s.produk === p.name)) &&
            (s.rawStatus === "DI_GUDANG" || s.status === "Di gudang")
        ).length;
      }
      const sum = stockSummary
        .filter((s: any) => String(s.productId) === String(p.id))
        .reduce((acc: number, cur: any) => acc + Number(cur.saldo ?? cur.qty ?? cur.stok ?? 0), 0);
      if (sum > 0) return sum;
      return Number(p.stok ?? p.stock ?? (p as any).tersedia ?? 0);
    },
    [serials, stockSummary]
  );

  // Selected product object
  const selectedProduct = React.useMemo(() => {
    if (productId != null && productId !== "") {
      const byId = products.find((p) => String(p.id) === String(productId));
      if (byId) return byId;
    }
    if (value && value !== "-") {
      const valClean = value.trim().toLowerCase();
      return (
        products.find(
          (p) =>
            `${p.nama || p.name} (${p.sku || "-"})`.toLowerCase() === valClean ||
            String(p.nama || p.name || "").trim().toLowerCase() === valClean ||
            String(p.sku || "").trim().toLowerCase() === valClean
        ) || null
      );
    }
    return null;
  }, [products, productId, value]);

  // Display label on trigger
  const displayLabel = React.useMemo(() => {
    if (multiple) {
      const count = selectedNames?.length || 0;
      if (count > 0) return `${count} barang master dipilih`;
      return "";
    }
    if (selectedProduct) {
      const stock = getProductAvailableStock(selectedProduct);
      const unit = selectedProduct.satuan || selectedProduct.unit || "unit";
      return `${selectedProduct.nama || selectedProduct.name} (${selectedProduct.sku || "-"}) · Stok: ${stock} ${unit}`;
    }
    if (value && value !== "-") return value;
    return "";
  }, [multiple, selectedNames, selectedProduct, value, getProductAvailableStock]);

  // Filtered products list
  const filteredProducts = React.useMemo(() => {
    let list = products;
    if (selectedCat !== "ALL") {
      list = list.filter((p) => {
        const cat = p.kategori || p.category || (p as any).categoryName;
        return cat === selectedCat;
      });
    }
    if (!q.trim()) return list;
    const term = q.trim().toLowerCase();
    return list.filter((p) => {
      const name = String(p.nama || p.name || "").toLowerCase();
      const sku = String(p.sku || "").toLowerCase();
      const cat = String(p.kategori || p.category || "").toLowerCase();
      const brand = String(p.brand || (p as any).merk || "").toLowerCase();
      return name.includes(term) || sku.includes(term) || cat.includes(term) || brand.includes(term);
    });
  }, [products, q, selectedCat]);

  function handleSelect(p: Row | null) {
    if (multiple && onToggleMultiple && p) {
      onToggleMultiple(p);
      return;
    }
    onChange?.(p);
    setOpen(false);
  }

  return (
    <>
      <View className="flex-row items-center gap-1.5 w-full">
        <Pressable
          onPress={() => {
            setQ("");
            setOpen(true);
          }}
          className={cn(
            "bg-input border-border h-11 flex-row items-center justify-between rounded-lg border px-3 flex-1",
            error && "border-danger",
            triggerClassName
          )}
        >
          <View className="flex-1 mr-2 flex-row items-center gap-2">
            <Package size={16} color={selectedProduct ? colors.primary : colors.muted} />
            <Text
              className={cn("text-base md:text-sm flex-1", !displayLabel && "text-muted-foreground")}
              numberOfLines={1}
            >
              {displayLabel || placeholder}
            </Text>
          </View>
          <ChevronDown size={16} color={colors.muted} />
        </Pressable>
      </View>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="w-[96vw] max-w-5xl lg:max-w-6xl max-h-[92vh] p-4 sm:p-6"
          style={Platform.select({ web: { width: "min(96vw, 1150px)", maxWidth: "1150px" } as any })}
        >
          <DialogHeader>
            <View className="flex-row items-center gap-2">
              <Package size={20} color={colors.primary} />
              <DialogTitle>Katalog Master Stok Produk</DialogTitle>
            </View>
          </DialogHeader>

          {/* Search bar & Category Filter */}
          <View className="gap-2.5 mt-2">
            <View className="bg-input border-border h-10 flex-row items-center gap-2 rounded-lg border px-3">
              <Search size={16} color={colors.muted} />
              <Input
                value={q}
                onChangeText={setQ}
                placeholder="Cari nama produk, SKU, brand/merek, atau kategori..."
                autoFocus
                className="h-9 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent outline-none ring-0 web:focus-visible:ring-0 web:focus-visible:outline-none"
              />
            </View>

            {categories.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-1.5 py-0.5">
                <Pressable
                  onPress={() => setSelectedCat("ALL")}
                  className={cn(
                    "px-3 py-1 rounded-full border text-xs font-semibold",
                    selectedCat === "ALL"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/40 border-border/80 text-muted-foreground"
                  )}
                >
                  <Text className={cn("text-xs", selectedCat === "ALL" ? "text-white font-bold" : "text-muted-foreground")}>
                    Semua ({products.length})
                  </Text>
                </Pressable>
                {categories.map((cat) => {
                  const count = products.filter((p) => (p.kategori || p.category) === cat).length;
                  const active = selectedCat === cat;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => setSelectedCat(cat)}
                      className={cn(
                        "px-3 py-1 rounded-full border text-xs font-semibold",
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/40 border-border/80 text-muted-foreground"
                      )}
                    >
                      <Text className={cn("text-xs", active ? "text-white font-bold" : "text-muted-foreground")}>
                        {cat} ({count})
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* Product Master Table */}
          <View className="border border-border/80 rounded-xl overflow-hidden mt-2 bg-card flex-1">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: "100%" }}>
              <View className="flex-1 min-w-[760px]">
                {/* Table Header */}
                <View className="flex-row items-center bg-muted/60 px-4 py-2.5 border-b border-border/70 text-xs font-bold text-muted-foreground">
                  <Text className="text-[11px] font-bold text-muted-foreground flex-1 min-w-[220px]">Nama Produk & SKU</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-40 px-2">Kategori / Tipe</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-28 text-center px-1">Stok Gudang</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-36 text-right px-2">Harga Jual (Rp)</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-36 text-right px-2">Harga Beli / HPP</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-20 text-center">Aksi</Text>
                </View>

                <ScrollView className="max-h-[52vh]" contentContainerClassName="divide-y divide-border/40">
                  {filteredProducts.map((p) => {
                    const isSelected = multiple
                      ? (selectedNames ?? []).includes(String(p.nama || p.name))
                      : selectedProduct?.id === p.id;
                    const stock = getProductAvailableStock(p);
                    const unit = p.satuan || p.unit || "unit";
                    const isHasSerial = Boolean(p.berSN ?? (p as any).hasSerial);
                    const sellPrice = Number(p.price ?? p.hargaJual ?? p.harga ?? 0);
                    const buyPrice = Number(p.hargaBeli ?? p.purchasePrice ?? 0);
                    const cat = p.kategori || p.category || (p as any).categoryName || "-";

                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => handleSelect(p)}
                        className={cn(
                          "p-3.5 hover:bg-primary/5 active:bg-primary/10 transition-colors flex-row items-center justify-between",
                          isSelected && "bg-primary/10"
                        )}
                      >
                        {/* Kolom 1: Nama Produk & SKU */}
                        <View className="flex-1 min-w-[220px] pr-2">
                          <Text className={cn("text-xs font-bold text-foreground", isSelected && "text-primary")}>
                            {p.nama || p.name}
                          </Text>
                          <View className="flex-row items-center gap-1.5 mt-0.5">
                            <Text className="text-[11px] font-mono text-muted-foreground">
                              {p.sku || "-"}
                            </Text>
                            {isHasSerial ? (
                              <View className="px-1.5 py-0.2 rounded bg-primary/10 border border-primary/30">
                                <Text className="text-[9px] font-semibold text-primary">Ber-SN</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>

                        {/* Kolom 2: Kategori */}
                        <View className="w-40 px-2">
                          <View className="flex-row items-center gap-1">
                            <Tag size={10} color={colors.muted} />
                            <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                              {cat}
                            </Text>
                          </View>
                        </View>

                        {/* Kolom 3: Stok Gudang */}
                        <View className="w-28 items-center px-1">
                          <View
                            className={cn(
                              "px-2.5 py-0.5 rounded-full border flex-row items-center gap-1",
                              stock > 0
                                ? "bg-emerald-500/10 border-emerald-500/30"
                                : "bg-danger/10 border-danger/30"
                            )}
                          >
                            <Warehouse size={10} color={stock > 0 ? colors.success : colors.danger} />
                            <Text
                              className={cn(
                                "text-[10px] font-bold",
                                stock > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-danger"
                              )}
                            >
                              {stock} {unit}
                            </Text>
                          </View>
                        </View>

                        {/* Kolom 4: Harga Jual */}
                        <View className="w-36 text-right px-2 items-end">
                          <Text className="text-xs font-semibold text-foreground">
                            {rupiah(sellPrice)}
                          </Text>
                          <Text className="text-[10px] text-muted-foreground">/ {unit}</Text>
                        </View>

                        {/* Kolom 5: Harga Beli / HPP */}
                        <View className="w-36 text-right px-2 items-end">
                          <Text className="text-xs font-medium text-muted-foreground">
                            {buyPrice > 0 ? rupiah(buyPrice) : "-"}
                          </Text>
                        </View>

                        {/* Kolom 6: Aksi */}
                        <View className="w-20 items-center">
                          {isSelected ? (
                            <View className="flex-row items-center gap-1 px-2 py-1 bg-primary/15 rounded-md">
                              <Check size={12} color={colors.primary} />
                              <Text className="text-[11px] font-bold text-primary">Dipilih</Text>
                            </View>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-7 px-2.5">
                              <Text className="text-[11px] font-semibold text-muted-foreground">Pilih</Text>
                            </Button>
                          )}
                        </View>
                      </Pressable>
                    );
                  })}

                  {filteredProducts.length === 0 && (
                    <View className="p-8 items-center justify-center gap-2">
                      <Text className="text-sm font-semibold text-muted-foreground">
                        Tidak ada produk yang cocok dengan &quot;{q}&quot;
                      </Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            </ScrollView>
          </View>

          <DialogFooter className="mt-3 flex-row items-center justify-between">
            <Text className="text-xs text-muted-foreground">
              {multiple && (selectedNames?.length || 0) > 0
                ? `${selectedNames?.length} barang dipilih · Total ${products.length} di Master Stok`
                : `Total ${products.length} produk di Master Stok`}
            </Text>
            <Button
              size="sm"
              variant={multiple && (selectedNames?.length || 0) > 0 ? "default" : "ghost"}
              onPress={() => setOpen(false)}
            >
              <Text className={cn("text-xs", multiple && (selectedNames?.length || 0) > 0 && "text-white font-semibold")}>
                {multiple && (selectedNames?.length || 0) > 0 ? "Selesai" : "Tutup"}
              </Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
