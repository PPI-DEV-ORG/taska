import * as React from "react";
import { View, Pressable, ScrollView, Platform, TextInput } from "react-native";
import { Search, ChevronDown, Check, FolderKanban, Plus } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/akuntra/dialogs";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import type { FaCategory, AssetType, DepreciationMethod } from "./types";

export interface FaCategorySelectProps {
  value?: string;
  categoryId?: number | null;
  categories?: FaCategory[];
  onChange: (category: FaCategory | null) => void;
  onRefresh?: () => void;
  placeholder?: string;
  error?: boolean;
  allowClear?: boolean;
  className?: string;
}

export function FaCategorySelect({
  value,
  categoryId,
  categories: propCategories,
  onChange,
  onRefresh,
  placeholder = "Cari & pilih kategori aset tetap...",
  error,
  allowClear = false,
  className,
}: FaCategorySelectProps) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [categories, setCategories] = React.useState<FaCategory[]>(propCategories || []);
  const [loading, setLoading] = React.useState(false);

  // Quick add form state
  const [showAdd, setShowAdd] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newType, setNewType] = React.useState<AssetType>("TANGIBLE");
  const [newMonths, setNewMonths] = React.useState(48);
  const [newMethod, setNewMethod] = React.useState<DepreciationMethod>("STRAIGHT_LINE");
  const [newAssetAcc, setNewAssetAcc] = React.useState("1504");
  const [newAccumAcc, setNewAccumAcc] = React.useState("1592");
  const [newExpenseAcc, setNewExpenseAcc] = React.useState("6101");
  const [addError, setAddError] = React.useState("");
  const [addLoading, setAddLoading] = React.useState(false);

  React.useEffect(() => {
    if (propCategories && propCategories.length > 0) {
      setCategories(propCategories);
    } else {
      fetchCategories();
    }
  }, [propCategories]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await api<any>("GET", "/fixed-assets/categories");
      const list = Array.isArray(res) ? res : (res?.data || []);
      setCategories(list);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  const selectedCategory = React.useMemo(() => {
    if (categoryId) {
      const match = categories.find((c) => c.id === categoryId);
      if (match) return match;
    }
    if (value && value !== "-") {
      const qVal = value.trim().toLowerCase();
      return (
        categories.find(
          (c) =>
            c.name.toLowerCase() === qVal ||
            String(c.id) === qVal ||
            c.code?.toLowerCase() === qVal,
        ) || null
      );
    }
    return null;
  }, [categories, categoryId, value]);

  const displayLabel = React.useMemo(() => {
    if (selectedCategory) {
      const typeLabel = selectedCategory.type === "TANGIBLE" ? "Berwujud" : "Tak Berwujud";
      const years = Math.round((selectedCategory.defaultUsefulLifeMonths / 12) * 10) / 10;
      return `${selectedCategory.name} (${typeLabel} · ${selectedCategory.defaultUsefulLifeMonths} bln / ${years} thn)`;
    }
    return value && value !== "-" ? value : "";
  }, [selectedCategory, value]);

  const filteredCategories = React.useMemo(() => {
    if (!q.trim()) return categories;
    const term = q.trim().toLowerCase();
    return categories.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const code = (c.code || "").toLowerCase();
      const type = (c.type || "").toLowerCase();
      const method = (c.depreciationMethod || "").toLowerCase();
      return (
        name.includes(term) ||
        code.includes(term) ||
        type.includes(term) ||
        method.includes(term)
      );
    });
  }, [categories, q]);

  const handleSelect = (cat: FaCategory | null) => {
    onChange(cat);
    setOpen(false);
  };

  const handleQuickAdd = async () => {
    if (!newName.trim()) {
      setAddError("Nama kategori wajib diisi.");
      return;
    }
    setAddLoading(true);
    setAddError("");
    try {
      const created = await api<FaCategory>("POST", "/fixed-assets/categories", {
        name: newName.trim(),
        type: newType,
        defaultUsefulLifeMonths: Number(newMonths) || 48,
        depreciationMethod: newMethod,
        assetAccountCode: newAssetAcc.trim() || undefined,
        accumDepAccountCode: newAccumAcc.trim() || undefined,
        depExpenseAccountCode: newExpenseAcc.trim() || undefined,
      });
      // reset
      setNewName("");
      setShowAdd(false);
      // refresh
      await fetchCategories();
      onRefresh?.();
      // select it
      onChange(created);
      setOpen(false);
    } catch (err: any) {
      setAddError(err?.message || "Gagal menambahkan kategori.");
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <>
      <Pressable
        onPress={() => {
          setQ("");
          setShowAdd(false);
          setOpen(true);
        }}
        className={cn(
          "bg-input border-border h-11 flex-row items-center justify-between rounded-lg border px-3 w-full",
          error && "border-danger",
          className,
        )}
      >
        <View className="flex-1 mr-2 flex-row items-center gap-2">
          <FolderKanban
            size={16}
            color={displayLabel ? colors.primary : colors.muted}
          />
          <Text
            className={cn(
              "text-base md:text-sm flex-1",
              !displayLabel && "text-muted-foreground",
            )}
            numberOfLines={1}
          >
            {displayLabel || placeholder}
          </Text>
        </View>
        <ChevronDown size={16} color={colors.muted} />
      </Pressable>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="w-[96vw] max-w-5xl max-h-[90vh] p-4 sm:p-6 z-[60]"
          style={Platform.select({
            web: { width: "min(96vw, 1020px)", maxWidth: "1020px" } as any,
          })}
        >
          <DialogHeader>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <FolderKanban size={20} color={colors.primary} />
                <DialogTitle>Pilih Kategori Aset Tetap</DialogTitle>
              </View>
              <Button
                variant={showAdd ? "outline" : "default"}
                size="sm"
                onPress={() => setShowAdd(!showAdd)}
                className="gap-1.5"
              >
                <Plus size={14} />
                <Text className="text-xs">{showAdd ? "Tutup Form" : "Tambah Kategori"}</Text>
              </Button>
            </View>
          </DialogHeader>

          {/* Inline Quick Add Form */}
          {showAdd && (
            <View className="bg-primary/5 p-4 rounded-xl border border-primary/20 gap-3 mt-3">
              <Text className="text-xs font-bold text-foreground">Tambah Kategori Baru</Text>
              {addError ? (
                <View className="bg-destructive/10 p-2 rounded border border-destructive/20">
                  <Text className="text-xs text-destructive">{addError}</Text>
                </View>
              ) : null}
              <View className="flex-row flex-wrap gap-2.5">
                <View className="flex-1 min-w-[200px]">
                  <Text className="text-xs font-semibold text-foreground mb-1">Nama Kategori *</Text>
                  <TextInput
                    value={newName}
                    onChangeText={setNewName}
                    placeholder="Contoh: Mesin & Peralatan Khusus"
                    className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                  />
                </View>
                <View className="w-36">
                  <Text className="text-xs font-semibold text-foreground mb-1">Tipe Aset</Text>
                  <SearchableSelect
                    value={newType === "TANGIBLE" ? "Berwujud (Tangible)" : "Tak Berwujud (Intangible)"}
                    options={["Berwujud (Tangible)", "Tak Berwujud (Intangible)"]}
                    onChange={(v) => setNewType(v.includes("Tak") ? "INTANGIBLE" : "TANGIBLE")}
                    className="h-10 rounded-lg bg-card border-border/80"
                  />
                </View>
                <View className="w-32">
                  <Text className="text-xs font-semibold text-foreground mb-1">Masa Manfaat (Bln)</Text>
                  <TextInput
                    value={String(newMonths)}
                    onChangeText={(v) => setNewMonths(Number(v.replace(/\D/g, "")) || 0)}
                    keyboardType="numeric"
                    placeholder="48"
                    className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                  />
                </View>
                <View className="w-44">
                  <Text className="text-xs font-semibold text-foreground mb-1">Metode Depresiasi</Text>
                  <SearchableSelect
                    value={
                      newMethod === "STRAIGHT_LINE"
                        ? "Garis Lurus"
                        : newMethod === "DECLINING_BALANCE"
                        ? "Saldo Menurun"
                        : "Tidak Disusutkan"
                    }
                    options={["Garis Lurus", "Saldo Menurun", "Tidak Disusutkan"]}
                    onChange={(v) => {
                      if (v.includes("Lurus")) setNewMethod("STRAIGHT_LINE");
                      else if (v.includes("Menurun")) setNewMethod("DECLINING_BALANCE");
                      else setNewMethod("NONE");
                    }}
                    className="h-10 rounded-lg bg-card border-border/80"
                  />
                </View>
              </View>
              <View className="flex-row justify-end gap-2 mt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => setShowAdd(false)}
                  disabled={addLoading}
                >
                  <Text className="text-xs">Batal</Text>
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onPress={handleQuickAdd}
                  disabled={addLoading}
                >
                  <Text className="text-xs">
                    {addLoading ? "Menyimpan..." : "Simpan & Pilih"}
                  </Text>
                </Button>
              </View>
            </View>
          )}

          {/* Search bar */}
          <View className="bg-input border-border h-10 flex-row items-center gap-2 rounded-lg border px-3 mt-3">
            <Search size={16} color={colors.muted} />
            <Input
              value={q}
              onChangeText={setQ}
              placeholder="Cari kategori berdasarkan nama, kode, tipe, atau metode..."
              autoFocus
              className="h-9 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent outline-none ring-0 web:focus-visible:ring-0 web:focus-visible:outline-none"
            />
          </View>

          {/* Table */}
          <View className="border border-border/80 rounded-xl overflow-hidden mt-3 bg-card flex-1">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ minWidth: "100%" }}
            >
              <View className="flex-1 min-w-[750px]">
                {/* Header */}
                <View className="flex-row items-center bg-muted/60 px-4 py-2.5 border-b border-border/70">
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/3 min-w-[200px]">
                    Nama Kategori & Kode
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-32 px-2 text-center">
                    Tipe Aset
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-36 px-2 text-center">
                    Masa Manfaat
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-40 px-2">
                    Metode Depresiasi
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-36 px-2">
                    Akun COA
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-20 px-2 text-center">
                    Total Aset
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-20 text-center">
                    Aksi
                  </Text>
                </View>

                {/* Rows */}
                <ScrollView
                  className="max-h-[48vh]"
                  contentContainerClassName="divide-y divide-border/40"
                >
                  {allowClear && (
                    <Pressable
                      onPress={() => handleSelect(null)}
                      className="p-3.5 hover:bg-muted/30 active:bg-muted/50 flex-row items-center justify-between"
                    >
                      <Text className="text-xs font-medium text-muted-foreground">
                        - Tanpa Kategori -
                      </Text>
                      {!categoryId && !value && (
                        <Check size={16} color={colors.primary} />
                      )}
                    </Pressable>
                  )}

                  {filteredCategories.length === 0 ? (
                    <View className="p-8 items-center justify-center">
                      <Text className="text-xs text-muted-foreground">
                        {loading
                          ? "Memuat data kategori..."
                          : "Tidak ada kategori aset yang cocok"}
                      </Text>
                    </View>
                  ) : (
                    filteredCategories.map((cat) => {
                      const isSelected =
                        selectedCategory?.id === cat.id || categoryId === cat.id;
                      const years =
                        Math.round((cat.defaultUsefulLifeMonths / 12) * 10) / 10;
                      return (
                        <Pressable
                          key={cat.id}
                          onPress={() => handleSelect(cat)}
                          className={cn(
                            "flex-row items-center px-4 py-3 hover:bg-muted/40 transition-colors",
                            isSelected && "bg-primary/5",
                          )}
                        >
                          <View className="w-1/3 min-w-[200px]">
                            <Text
                              className={cn(
                                "text-sm font-semibold text-foreground",
                                isSelected && "text-primary font-bold",
                              )}
                            >
                              {cat.name}
                            </Text>
                            {cat.code ? (
                              <Text className="text-[11px] text-muted-foreground">
                                Kode: {cat.code}
                              </Text>
                            ) : null}
                          </View>

                          <View className="w-32 px-2 items-center">
                            <View
                              className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-bold",
                                cat.type === "TANGIBLE"
                                  ? "bg-blue-500/10"
                                  : "bg-purple-500/10",
                              )}
                            >
                              <Text
                                className={cn(
                                  "text-[10px] font-bold",
                                  cat.type === "TANGIBLE"
                                    ? "text-blue-600"
                                    : "text-purple-600",
                                )}
                              >
                                {cat.type === "TANGIBLE"
                                  ? "Berwujud"
                                  : "Tak Berwujud"}
                              </Text>
                            </View>
                          </View>

                          <View className="w-36 px-2 items-center">
                            <Text className="text-xs font-semibold text-foreground">
                              {cat.defaultUsefulLifeMonths} Bulan
                            </Text>
                            <Text className="text-[11px] text-muted-foreground">
                              ({years} Tahun)
                            </Text>
                          </View>

                          <View className="w-40 px-2">
                            <Text className="text-xs text-foreground">
                              {cat.depreciationMethod === "STRAIGHT_LINE"
                                ? "Garis Lurus"
                                : cat.depreciationMethod === "DECLINING_BALANCE"
                                ? "Saldo Menurun"
                                : "Tidak Disusutkan"}
                            </Text>
                          </View>

                          <View className="w-36 px-2">
                            <Text className="text-[11px] text-muted-foreground">
                              {cat.assetAccountCode || "1500"} / {cat.accumDepAccountCode || "1590"}
                            </Text>
                          </View>

                          <View className="w-20 px-2 items-center">
                            <Text className="text-xs font-bold text-primary">
                              {cat._count?.assets ?? 0}
                            </Text>
                          </View>

                          <View className="w-20 items-center justify-center">
                            {isSelected ? (
                              <View className="bg-primary/10 rounded-full p-1">
                                <Check size={14} color={colors.primary} />
                              </View>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2.5"
                                onPress={() => handleSelect(cat)}
                              >
                                <Text className="text-[11px]">Pilih</Text>
                              </Button>
                            )}
                          </View>
                        </Pressable>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            </ScrollView>
          </View>
        </DialogContent>
      </Dialog>
    </>
  );
}
