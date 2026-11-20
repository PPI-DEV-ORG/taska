import * as React from "react";
import { View, Pressable, ScrollView, Platform } from "react-native";
import { Search, ChevronDown, Check, Package, Tag } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/services/api";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";
import { useBreakpoint } from "@/hooks/use-breakpoint";

export interface AssetRow {
  id: string | number;
  assetCode: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  location?: { id?: number; name?: string } | null;
  locationName?: string | null;
  department?: string | null;
  condition?: string | null;
  status?: string | null;
}

export interface AssetSelectProps {
  value?: string;
  assetId?: string | number | null;
  assets?: AssetRow[];
  onChange: (asset: AssetRow | null) => void;
  placeholder?: string;
  error?: boolean;
  allowClear?: boolean;
  triggerClassName?: string;
}

const CONDITION_COLORS: Record<string, { label: string; bg: string; text: string }> = {
  GOOD: { label: "Baik (Good)", bg: "#dcfce7", text: "#16a34a" },
  FAIR: { label: "Cukup (Fair)", bg: "#fef3c7", text: "#d97706" },
  UNDER_REPAIR: { label: "Servis (Under Repair)", bg: "#fed7aa", text: "#ea580c" },
  POOR: { label: "Buruk (Poor)", bg: "#fee2e2", text: "#dc2626" },
  DAMAGED: { label: "Rusak (Damaged)", bg: "#ef4444", text: "#ffffff" },
};

function ConditionBadge({ condition }: { condition?: string | null }) {
  const c = (condition || "GOOD").toUpperCase();
  const cfg = CONDITION_COLORS[c] ?? CONDITION_COLORS.GOOD!;
  return (
    <View
      className="self-start rounded-full border px-2 py-0.5"
      style={{ backgroundColor: cfg.bg, borderColor: `${cfg.text}33` }}
    >
      <Text className="text-[10px] font-semibold" style={{ color: cfg.text }}>
        {cfg.label}
      </Text>
    </View>
  );
}

export function AssetSelect({
  value,
  assetId,
  assets,
  onChange,
  placeholder = "Cari & pilih aset (Fixed Assets)...",
  error,
  allowClear = true,
  triggerClassName,
}: AssetSelectProps) {
  const { isMobile } = useBreakpoint();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [fetchedAssets, setFetchedAssets] = React.useState<AssetRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    if (!assets || assets.length === 0) {
      Promise.resolve().then(() => {
        if (active) setLoading(true);
      });
      api<any>("GET", "/fixed-assets/assets")
        .then((res) => {
          if (!active) return;
          const items = Array.isArray(res) ? res : res?.items || res?.data || [];
          setFetchedAssets(items);
        })
        .catch(() => {
          // Fallback to maintenance lookups if fixed-assets/assets endpoint differs
          api<any>("GET", "/maintenance/lookups")
            .then((lRes) => {
              if (!active) return;
              const items = lRes?.assets || lRes?.data?.assets || [];
              setFetchedAssets(items);
            })
            .catch(() => {});
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [assets]);

  const assetList: AssetRow[] = React.useMemo(() => {
    if (assets && assets.length > 0) return assets;
    return fetchedAssets;
  }, [assets, fetchedAssets]);

  const selectedAsset = React.useMemo(() => {
    if (assetId) {
      const match = assetList.find((a) => String(a.id) === String(assetId));
      if (match) return match;
    }
    if (value && value !== "-") {
      const qVal = value.trim().toLowerCase();
      return (
        assetList.find((a) => {
          const code = String(a.assetCode || "").toLowerCase();
          const name = String(a.name || "").toLowerCase();
          return code === qVal || name === qVal || `${code} - ${name}`.toLowerCase() === qVal;
        }) ?? null
      );
    }
    return null;
  }, [assetId, value, assetList]);

  const filteredList = React.useMemo(() => {
    if (!q.trim()) return assetList;
    const query = q.toLowerCase();
    return assetList.filter((a) => {
      const code = String(a.assetCode || "").toLowerCase();
      const name = String(a.name || "").toLowerCase();
      const brand = String(a.brand || "").toLowerCase();
      const model = String(a.model || "").toLowerCase();
      const loc = String(a.location?.name || a.locationName || "").toLowerCase();
      const dept = String(a.department || "").toLowerCase();
      return (
        code.includes(query) ||
        name.includes(query) ||
        brand.includes(query) ||
        model.includes(query) ||
        loc.includes(query) ||
        dept.includes(query)
      );
    });
  }, [assetList, q]);

  const handleSelect = (a: AssetRow | null) => {
    onChange(a);
    setOpen(false);
  };

  const displayText = selectedAsset
    ? `${selectedAsset.assetCode} - ${selectedAsset.name}`
    : value || placeholder;

  return (
    <>
      <Pressable
        onPress={() => {
          setQ("");
          setOpen(true);
        }}
        className={cn(
          "h-10 px-3 flex-row items-center justify-between gap-2 rounded-lg border border-border/80 bg-card active:bg-muted/40 transition-colors",
          error && "border-destructive ring-1 ring-destructive",
          triggerClassName,
        )}
      >
        <View className="flex-1 flex-row items-center gap-2 overflow-hidden">
          <Tag size={15} color={selectedAsset ? colors.primary : colors.muted} />
          <Text
            numberOfLines={1}
            className={cn(
              "text-xs truncate",
              selectedAsset || (value && value !== "-")
                ? "font-semibold text-foreground"
                : "text-muted-foreground",
            )}
          >
            {displayText}
          </Text>
        </View>
        <ChevronDown size={14} color={colors.muted} />
      </Pressable>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="w-[96vw] max-w-4xl max-h-[90vh] p-0 flex flex-col"
          style={Platform.select({
            web: { width: "min(96vw, 900px)", maxWidth: "900px" } as any,
          })}
        >
          <DialogHeader className="border-b border-border/70 px-4 sm:px-6 py-4 pr-10">
            <View className="flex-row items-center gap-3">
              <View className="rounded-lg p-2" style={{ backgroundColor: `${colors.primary}18` }}>
                <Package size={18} color={colors.primary} />
              </View>
              <View className="flex-1 min-w-0">
                <DialogTitle>Pilih Aset (Fixed Assets)</DialogTitle>
                <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                  Cari aset operasional berdasarkan kode, nama, atau lokasi
                </Text>
              </View>
            </View>
          </DialogHeader>

          {/* Search Bar */}
          <View className="p-3 sm:p-4 border-b border-border/70 bg-muted/20">
            <View className="flex-row items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
              <Search size={16} color={colors.muted} />
              <Input
                value={q}
                onChangeText={setQ}
                placeholder="Cari kode aset, nama, merk, model, lokasi, departemen..."
                autoFocus
                className="h-8 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent outline-none ring-0 web:focus-visible:ring-0 web:focus-visible:outline-none"
              />
            </View>
          </View>

          {/* Cards for Mobile vs Table for Desktop */}
          {isMobile ? (
            <ScrollView
              className="max-h-[60vh] p-3"
              contentContainerClassName="gap-2.5 pb-2"
              showsVerticalScrollIndicator={false}
            >
              {allowClear && (
                <Pressable
                  onPress={() => handleSelect(null)}
                  className="p-3 rounded-xl border border-dashed border-border bg-card/50 flex-row items-center justify-between"
                >
                  <Text className="text-xs font-medium text-muted-foreground">
                    - Tanpa Aset Terpilih -
                  </Text>
                  {!assetId && !value && (
                    <Check size={16} color={colors.primary} />
                  )}
                </Pressable>
              )}

              {filteredList.map((a) => {
                const isSelected = String(selectedAsset?.id) === String(a.id);
                const locName = a.location?.name || a.locationName || "-";
                const spec = [a.brand, a.model].filter(Boolean).join(" · ") || a.serialNumber || "-";

                return (
                  <Pressable
                    key={a.id}
                    onPress={() => handleSelect(a)}
                    className={cn(
                      "p-3.5 rounded-xl border border-border/80 bg-card gap-2 active:scale-[0.99] transition-transform",
                      isSelected && "border-primary/60 bg-primary/[0.04]",
                    )}
                  >
                    <View className="flex-row items-start justify-between gap-2">
                      <View className="flex-1 min-w-0">
                        <Text
                          className={cn(
                            "text-sm font-bold text-foreground",
                            isSelected && "text-primary",
                          )}
                          numberOfLines={1}
                        >
                          {a.name}
                        </Text>
                        <Text className="font-mono text-xs font-bold text-primary mt-0.5">
                          {a.assetCode}
                        </Text>
                      </View>
                      <ConditionBadge condition={a.condition} />
                    </View>

                    {spec !== "-" && (
                      <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                        {spec}
                      </Text>
                    )}

                    <View className="flex-row items-center justify-between border-t border-border/40 pt-2 mt-0.5">
                      <View className="flex-1 mr-2 min-w-0">
                        <Text className="text-xs font-medium text-foreground" numberOfLines={1}>
                          {locName} {a.department ? `· ${a.department}` : ""}
                        </Text>
                      </View>

                      {isSelected ? (
                        <View className="size-7 rounded-full bg-primary/20 items-center justify-center shrink-0">
                          <Check size={14} color={colors.primary} />
                        </View>
                      ) : (
                        <View className="px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                          <Text className="text-[11px] font-semibold text-primary">Pilih</Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              })}

              {filteredList.length === 0 && (
                <View className="p-8 items-center justify-center gap-2">
                  <Text className="text-sm font-semibold text-muted-foreground text-center">
                    {loading ? "Memuat daftar aset..." : `Tidak ada aset yang cocok dengan "${q}"`}
                  </Text>
                </View>
              )}
            </ScrollView>
          ) : (
            <View className="flex-1 overflow-hidden p-4">
              <View className="border border-border/80 rounded-xl overflow-hidden bg-card flex-1">
                <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ minWidth: "100%" }}
              >
                <View className="flex-1 min-w-[760px]">
                  {/* Table Header */}
                  <View className="flex-row items-center bg-muted/60 px-4 py-2.5 border-b border-border/70">
                    <Text className="text-[11px] font-bold text-muted-foreground w-[160px]">
                      Kode Aset
                    </Text>
                    <Text className="text-[11px] font-bold text-muted-foreground flex-1 min-w-[200px]">
                      Nama & Spesifikasi
                    </Text>
                    <Text className="text-[11px] font-bold text-muted-foreground w-[160px] px-2">
                      Lokasi & Dept
                    </Text>
                    <Text className="text-[11px] font-bold text-muted-foreground w-[130px] px-2">
                      Kondisi
                    </Text>
                    <Text className="text-[11px] font-bold text-muted-foreground w-[80px] text-center">
                      Aksi
                    </Text>
                  </View>

                  {/* Table Rows */}
                  <ScrollView
                    className="max-h-[50vh]"
                    contentContainerClassName="divide-y divide-border/40"
                  >
                    {allowClear && (
                      <Pressable
                        onPress={() => handleSelect(null)}
                        className="p-3.5 hover:bg-muted/30 active:bg-muted/50 flex-row items-center justify-between"
                      >
                        <Text className="text-xs font-medium text-muted-foreground">
                          - Tanpa Aset Terpilih -
                        </Text>
                        {!assetId && !value && (
                          <Check size={16} color={colors.primary} />
                        )}
                      </Pressable>
                    )}

                    {filteredList.map((a) => {
                      const isSelected = String(selectedAsset?.id) === String(a.id);
                      const locName = a.location?.name || a.locationName || "-";
                      const spec = [a.brand, a.model].filter(Boolean).join(" · ") || a.serialNumber || "-";

                      return (
                        <Pressable
                          key={a.id}
                          onPress={() => handleSelect(a)}
                          className={cn(
                            "p-3.5 hover:bg-primary/5 active:bg-primary/10 transition-colors flex-row items-center justify-between gap-2",
                            isSelected && "bg-primary/10",
                          )}
                        >
                          <View className="w-[160px]">
                            <Text
                              className={cn(
                                "font-mono text-xs font-bold text-primary",
                                isSelected && "underline",
                              )}
                            >
                              {a.assetCode}
                            </Text>
                          </View>

                          <View className="flex-1 min-w-[200px] pr-2">
                            <Text
                              className={cn(
                                "text-xs font-bold text-foreground",
                                isSelected && "text-primary",
                              )}
                            >
                              {a.name}
                            </Text>
                            <Text className="text-[11px] text-muted-foreground">
                              {spec}
                            </Text>
                          </View>

                          <View className="w-[160px] px-2">
                            <Text className="text-xs font-medium text-foreground">
                              {locName}
                            </Text>
                            <Text className="text-[11px] text-muted-foreground">
                              {a.department || "-"}
                            </Text>
                          </View>

                          <View className="w-[130px] px-2">
                            <ConditionBadge condition={a.condition} />
                          </View>

                          <View className="w-[80px] items-center justify-center">
                            {isSelected ? (
                              <View className="size-7 rounded-full bg-primary/20 items-center justify-center">
                                <Check size={14} color={colors.primary} />
                              </View>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2.5"
                              >
                                <Text className="text-[11px] font-semibold text-muted-foreground">
                                  Pilih
                                </Text>
                              </Button>
                            )}
                          </View>
                        </Pressable>
                      );
                    })}

                    {filteredList.length === 0 && (
                      <View className="p-8 items-center justify-center gap-2">
                        <Text className="text-sm font-semibold text-muted-foreground">
                          {loading ? "Memuat daftar aset..." : `Tidak ada aset yang cocok dengan "${q}"`}
                        </Text>
                      </View>
                    )}
                  </ScrollView>
                </View>
              </ScrollView>
            </View>
          </View>
        )}
        </DialogContent>
      </Dialog>
    </>
  );
}
