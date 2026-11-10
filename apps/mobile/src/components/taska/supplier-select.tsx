import * as React from "react";
import { View, Pressable, ScrollView, Platform } from "react-native";
import {
  Search,
  Building2,
  Check,
  Plus,
  Tag,
  CreditCard,
  MapPin,
  ChevronDown,
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
import { cn } from "@/lib/utils";
import type { Row } from "@/constants/modules";

export function getSupplierTagsText(s: any): string {
  if (!s) return "";
  if (s.tagSummary && typeof s.tagSummary === "string" && s.tagSummary.trim()) {
    return s.tagSummary.trim();
  }
  if (Array.isArray(s.tags) && s.tags.length > 0) {
    const arr = s.tags
      .map((t: any) => (typeof t === "string" ? t : t.itemName || t.nama || ""))
      .filter(Boolean);
    if (arr.length > 0) return arr.join(", ");
  }
  if (Array.isArray(s.itemTags) && s.itemTags.length > 0) {
    const arr = s.itemTags
      .map((t: any) => (typeof t === "string" ? t : t.itemName || t.nama || ""))
      .filter(Boolean);
    if (arr.length > 0) return arr.join(", ");
  }
  if (s.tagInput && typeof s.tagInput === "string") {
    return s.tagInput.trim();
  }
  return "";
}

export function formatSupplierLabel(s: any): string {
  if (!s) return "";
  const name = String(s.nama || s.name || "").trim();
  if (!name) return "";
  const tags = getSupplierTagsText(s);
  return tags ? `${name} - ${tags}` : name;
}

export function cleanSupplierName(raw: string): string {
  if (!raw) return "";
  // If formatted as "CV Jaya - Kabel, Baut" -> extract "CV Jaya"
  const parts = raw.split(" - ");
  return parts[0]?.trim() || raw.trim();
}

export function findSupplierMatch(suppliers: any[], queryOrValue: string): any | null {
  if (!queryOrValue || !suppliers || suppliers.length === 0) return null;
  const qClean = cleanSupplierName(queryOrValue).toLowerCase();
  const qRaw = queryOrValue.trim().toLowerCase();

  return (
    suppliers.find(
      (s: any) =>
        String(s.id) === queryOrValue ||
        formatSupplierLabel(s).toLowerCase() === qRaw ||
        String(s.nama || s.name || "").trim().toLowerCase() === qClean ||
        String(s.nama || s.name || "").trim().toLowerCase() === qRaw
    ) || null
  );
}

export interface SupplierSelectProps {
  value?: string;
  supplierId?: string | number | null;
  onChange: (selectedName: string, selectedSupplier?: Row | null) => void;
  placeholder?: string;
  error?: boolean;
  required?: boolean;
  onAddNew?: () => void;
  addNewLabel?: string;
  allowClear?: boolean;
}

export function SupplierSelect({
  value,
  supplierId,
  onChange,
  placeholder = "Pilih Pemasok...",
  error,
  onAddNew,
  addNewLabel = "+ Tambah Pemasok Baru",
  allowClear = true,
}: SupplierSelectProps) {
  const { data } = useApp();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  const suppliers: Row[] = React.useMemo(() => data.suppliers ?? [], [data.suppliers]);

  // Find currently selected supplier object
  const selectedSupplier = React.useMemo(() => {
    if (supplierId) {
      const byId = suppliers.find((s) => String(s.id) === String(supplierId));
      if (byId) return byId;
    }
    if (value && value !== "-") {
      return findSupplierMatch(suppliers, value);
    }
    return null;
  }, [suppliers, supplierId, value]);

  // Display text in trigger input
  const displayLabel = React.useMemo(() => {
    if (selectedSupplier) {
      return formatSupplierLabel(selectedSupplier);
    }
    if (value && value !== "-") {
      return value;
    }
    return "";
  }, [selectedSupplier, value]);

  // Filtered list
  const filteredList = React.useMemo(() => {
    if (!q.trim()) return suppliers;
    const term = q.trim().toLowerCase();
    return suppliers.filter((s) => {
      const name = String(s.nama || s.name || "").toLowerCase();
      const tags = getSupplierTagsText(s).toLowerCase();
      const city = String(s.kota || s.city || "").toLowerCase();
      const contact = String(s.kontak || s.pic || "").toLowerCase();
      const payment = String(s.payment || s.paymentTerms || "").toLowerCase();
      const tax = String(s.jenisUsaha || s.taxStatus || "").toLowerCase();
      return (
        name.includes(term) ||
        tags.includes(term) ||
        city.includes(term) ||
        contact.includes(term) ||
        payment.includes(term) ||
        tax.includes(term)
      );
    });
  }, [suppliers, q]);

  function handleSelect(s: Row | null) {
    if (!s) {
      onChange("-", null);
    } else {
      const formatted = formatSupplierLabel(s);
      onChange(formatted, s);
    }
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
            error && "border-danger"
          )}
        >
          <View className="flex-1 mr-2 flex-row items-center gap-2">
            <Building2 size={16} color={displayLabel ? colors.primary : colors.muted} />
            <Text
              className={cn("text-base md:text-sm flex-1", !displayLabel && "text-muted-foreground")}
              numberOfLines={1}
            >
              {displayLabel || placeholder}
            </Text>
          </View>
          <ChevronDown size={16} color={colors.muted} />
        </Pressable>

        {onAddNew ? (
          <Button
            variant="outline"
            size="icon"
            onPress={onAddNew}
            className="h-11 w-11 shrink-0 border-primary/40 bg-primary/10 hover:bg-primary/20 active:bg-primary/30"
          >
            <Plus size={18} color={colors.primary} />
          </Button>
        ) : null}
      </View>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="w-[96vw] max-w-5xl lg:max-w-6xl max-h-[90vh] p-4 sm:p-6"
          style={Platform.select({ web: { width: "min(96vw, 1150px)", maxWidth: "1150px" } as any })}
        >
          <DialogHeader>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Building2 size={20} color={colors.primary} />
                <DialogTitle>Pilih Pemasok / Vendor</DialogTitle>
              </View>
            </View>
          </DialogHeader>

          {/* Search bar & Quick Add Action */}
          <View className="flex-col sm:flex-row gap-2 mt-2">
            <View className="bg-input border-border h-10 flex-row items-center gap-2 rounded-lg border px-3 flex-1">
              <Search size={16} color={colors.muted} />
              <Input
                value={q}
                onChangeText={setQ}
                placeholder="Cari berdasarkan nama pemasok, barang/tag, kota, atau termin..."
                autoFocus
                className="h-9 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent outline-none ring-0 web:focus-visible:ring-0 web:focus-visible:outline-none"
              />
            </View>
            {onAddNew ? (
              <Button
                size="sm"
                variant="outline"
                className="border-primary/40 bg-primary/10 hover:bg-primary/20 h-10 flex-row items-center gap-1.5"
                onPress={() => {
                  setOpen(false);
                  onAddNew();
                }}
              >
                <Plus size={15} color={colors.primary} />
                <Text className="text-xs font-semibold text-primary">{addNewLabel}</Text>
              </Button>
            ) : null}
          </View>

          {/* Supplier Table / List View */}
          <View className="border border-border/80 rounded-xl overflow-hidden mt-3 bg-card flex-1">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: "100%" }}>
              <View className="flex-1 min-w-[760px]">
                {/* Table Header */}
                <View className="flex-row items-center bg-muted/60 px-4 py-2.5 border-b border-border/70 text-xs font-bold text-muted-foreground">
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/4 min-w-[180px]">Nama Pemasok & Kota</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/3 min-w-[220px] px-2">Tags / Kategori Barang</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-32 text-center">Status Pajak</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground flex-1 min-w-[140px] px-2">Syarat Pembayaran</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-20 text-center">Aksi</Text>
                </View>

                <ScrollView className="max-h-[50vh]" contentContainerClassName="divide-y divide-border/40">
                  {allowClear && (
                    <Pressable
                      onPress={() => handleSelect(null)}
                      className="p-3.5 hover:bg-muted/30 active:bg-muted/50 flex-row items-center justify-between"
                    >
                      <View className="flex-row items-center gap-2">
                        <Text className="text-xs font-medium text-muted-foreground">
                          - Tanpa Supplier / Beli Ritel Langsung -
                        </Text>
                      </View>
                      {(!value || value === "-") && <Check size={16} color={colors.primary} />}
                    </Pressable>
                  )}

                  {filteredList.map((s) => {
                    const isSelected = selectedSupplier?.id === s.id;
                    const isPkp = s.taxStatus === "PKP" || s.jenisUsaha === "PKP";
                    const tagsText = getSupplierTagsText(s);
                    const paymentTerm = s.payment || s.paymentTerms || s.syaratPembayaran || "Tempo (Net 30)";
                    const city = s.kota || s.city || "";
                    const pic = s.kontak || s.pic || "";

                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => handleSelect(s)}
                        className={cn(
                          "p-3.5 hover:bg-primary/5 active:bg-primary/10 transition-colors flex-row items-center justify-between gap-2",
                          isSelected && "bg-primary/10"
                        )}
                      >
                        {/* Kolom 1: Nama Supplier & Kota/Kontak */}
                        <View className="w-1/4 min-w-[180px]">
                          <View className="flex-row items-center gap-1.5 flex-wrap">
                            <Text className={cn("text-xs font-bold text-foreground", isSelected && "text-primary")}>
                              {s.nama || s.name || `Supplier #${s.id}`}
                            </Text>
                          </View>
                          <View className="flex-row items-center gap-2 mt-0.5">
                            {city ? (
                              <View className="flex-row items-center gap-1">
                                <MapPin size={10} color={colors.muted} />
                                <Text className="text-[11px] text-muted-foreground">{city}</Text>
                              </View>
                            ) : null}
                            {pic ? (
                              <Text className="text-[11px] text-muted-foreground">• PIC: {pic}</Text>
                            ) : null}
                          </View>
                        </View>

                        {/* Kolom 2: Tags / Kategori Barang */}
                        <View className="w-1/3 min-w-[220px] px-2">
                          {tagsText ? (
                            <View className="flex-row items-center gap-1 flex-wrap">
                              <Tag size={11} color={colors.primary} />
                              <Text className="text-[11px] font-medium text-foreground leading-tight">
                                {tagsText}
                              </Text>
                            </View>
                          ) : (
                            <Text className="text-[11px] text-muted-foreground italic">Belum ada tag barang</Text>
                          )}
                        </View>

                        {/* Kolom 3: Status Pajak (PKP / Non-PKP) */}
                        <View className="w-32 items-center">
                          <View
                            className={cn(
                              "px-2.5 py-0.5 rounded-full border self-center",
                              isPkp
                                ? "bg-primary/10 border-primary/40 text-primary"
                                : "bg-muted/50 border-border/80 text-muted-foreground"
                            )}
                          >
                            <Text
                              className={cn(
                                "text-[10px] font-bold",
                                isPkp ? "text-primary" : "text-muted-foreground"
                              )}
                            >
                              {isPkp ? "PKP (Faktur Pajak)" : "Non-PKP"}
                            </Text>
                          </View>
                        </View>

                        {/* Kolom 4: Syarat Pembayaran */}
                        <View className="flex-1 min-w-[140px] px-2">
                          <View className="flex-row items-center gap-1">
                            <CreditCard size={11} color={colors.muted} />
                            <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                              {paymentTerm}
                            </Text>
                          </View>
                        </View>

                        {/* Kolom 5: Aksi / Status Terpilih */}
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

                  {filteredList.length === 0 && (
                    <View className="p-8 items-center justify-center gap-2">
                      <Text className="text-sm font-semibold text-muted-foreground">
                        Tidak ada supplier yang cocok dengan &quot;{q}&quot;
                      </Text>
                      {onAddNew && (
                        <Button
                          size="sm"
                          variant="outline"
                          onPress={() => {
                            setOpen(false);
                            onAddNew();
                          }}
                          className="mt-1"
                        >
                          <Plus size={14} color={colors.primary} />
                          <Text className="text-xs text-primary font-semibold">Buat Supplier &quot;{q}&quot;</Text>
                        </Button>
                      )}
                    </View>
                  )}
                </ScrollView>
              </View>
            </ScrollView>
          </View>

          <DialogFooter className="mt-3 flex-row items-center justify-between">
            <Text className="text-xs text-muted-foreground">
              Total {suppliers.length} supplier rekanan terdaftar
            </Text>
            <Button size="sm" variant="ghost" onPress={() => setOpen(false)}>
              <Text className="text-xs">Tutup</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
