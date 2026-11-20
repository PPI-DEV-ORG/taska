import * as React from "react";
import { View, Pressable, ScrollView, Platform } from "react-native";
import {
  Search,
  ChevronDown,
  Check,
  Calendar,
  PackageCheck,
  X,
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/akuntra/status-badge";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";
import { rupiah } from "@/lib/format";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import type { Row } from "@/constants/modules";
import { formatDate } from "./format-date";

export interface SupplierPoSelectProps {
  value?: string;
  poId?: string | number | null;
  pos?: Row[];
  onChange: (po: Row | null) => void;
  placeholder?: string;
  error?: boolean;
  allowClear?: boolean;
}

export function SupplierPoSelect({
  value,
  poId,
  pos,
  onChange,
  placeholder = "Pilih PO supplier...",
  error,
  allowClear = true,
}: SupplierPoSelectProps) {
  const { data } = useApp();
  const { isMobile } = useBreakpoint();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  const supplierPosData = data["supplier-pos"];
  const poList: Row[] = React.useMemo(() => {
    return pos ?? (supplierPosData as Row[]) ?? [];
  }, [pos, supplierPosData]);

  const selectedPo = React.useMemo(() => {
    if (poId) {
      const match = poList.find((p) => String(p.id) === String(poId));
      if (match) return match;
    }
    if (value) {
      const sel = value.trim().toLowerCase();
      return (
        poList.find((p) => {
          const no = String(p.nomor || p.number || p.code || "").toLowerCase();
          return (
            no === sel ||
            `${no} - ${p.supplier || ""}`.toLowerCase().includes(sel)
          );
        }) || null
      );
    }
    return null;
  }, [poList, poId, value]);

  const displayLabel = React.useMemo(() => {
    if (selectedPo) {
      const no = selectedPo.nomor || selectedPo.number || `#${selectedPo.id}`;
      return `${no} — ${selectedPo.supplier || "Supplier"}`;
    }
    return value || "";
  }, [selectedPo, value]);

  const filteredList = React.useMemo(() => {
    if (!q.trim()) return poList;
    const term = q.trim().toLowerCase();
    return poList.filter((p) => {
      const no = String(p.nomor || p.number || p.code || "").toLowerCase();
      const supp = String(p.supplier || "").toLowerCase();
      const req = String(p.request || p.requestId || "").toLowerCase();
      const it = String(p.item || "").toLowerCase();
      return (
        no.includes(term) ||
        supp.includes(term) ||
        req.includes(term) ||
        it.includes(term)
      );
    });
  }, [poList, q]);

  function handleSelect(p: Row | null) {
    onChange(p);
    setOpen(false);
  }

  return (
    <>
      <Pressable
        onPress={() => {
          setQ("");
          setOpen(true);
        }}
        className={cn(
          "bg-input border-border h-11 flex-row items-center justify-between rounded-lg border px-3 w-full",
          error && "border-danger",
        )}
      >
        <View className="flex-1 mr-2 flex-row items-center gap-2">
          <PackageCheck
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
          className="w-[96vw] max-w-5xl lg:max-w-6xl max-h-[90vh] p-4 sm:p-6"
          style={Platform.select({
            web: { width: "min(96vw, 1150px)", maxWidth: "1150px" } as any,
          })}
        >
          <DialogHeader className="pr-8">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <PackageCheck size={20} color={colors.primary} />
                <DialogTitle>Pilih PO Supplier</DialogTitle>
              </View>
            </View>
          </DialogHeader>

          {/* Search bar */}
          <View className="bg-input border-border h-10 flex-row items-center gap-2 rounded-lg border px-3 mt-2">
            <Search size={16} color={colors.muted} />
            <Input
              value={q}
              onChangeText={setQ}
              placeholder="Cari nomor PO, nama supplier, ref request, atau barang..."
              autoFocus
              className="h-9 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent outline-none ring-0 web:focus-visible:ring-0 web:focus-visible:outline-none"
            />
            {q ? (
              <Pressable onPress={() => setQ("")} className="p-1">
                <X size={16} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>

          {/* Cards for Mobile vs Table for Desktop */}
          {isMobile ? (
            <ScrollView
              className="max-h-[60vh] mt-3"
              contentContainerClassName="gap-2.5 pb-2"
              showsVerticalScrollIndicator={false}
            >
              {allowClear && (
                <Pressable
                  onPress={() => handleSelect(null)}
                  className="p-3 rounded-xl border border-dashed border-border bg-card/50 flex-row items-center justify-between"
                >
                  <Text className="text-xs font-medium text-muted-foreground">
                    - Tanpa PO Supplier (Kosongkan) -
                  </Text>
                  {!poId && !value && (
                    <Check size={16} color={colors.primary} />
                  )}
                </Pressable>
              )}

              {filteredList.map((po) => {
                const isSelected = selectedPo?.id === po.id;
                const no = po.nomorPo || po.nomor || `PO #${po.id}`;
                const tgl = po.tanggal || po.createdAt || "";
                const totalVal = Number(po.total || po.totalBiaya || po.nilai || 0);
                const st = po.statusPengiriman || po.status || "Aktif";

                return (
                  <Pressable
                    key={po.id}
                    onPress={() => handleSelect(po)}
                    className={cn(
                      "p-3.5 rounded-xl border border-border/80 bg-card gap-2 active:scale-[0.99] transition-transform",
                      isSelected && "border-primary/60 bg-primary/[0.04]",
                    )}
                  >
                    <View className="flex-row items-start justify-between gap-2">
                      <View className="flex-1 min-w-0">
                        <Text
                          className={cn(
                            "text-sm font-bold font-mono text-foreground",
                            isSelected && "text-primary",
                          )}
                          numberOfLines={1}
                        >
                          {no}
                        </Text>
                        {tgl ? (
                          <View className="flex-row items-center gap-1 mt-0.5">
                            <Calendar size={10} color={colors.muted} />
                            <Text className="text-[11px] text-muted-foreground">{formatDate(tgl)}</Text>
                          </View>
                        ) : null}
                      </View>
                      <StatusBadge status={st} />
                    </View>

                    <View className="flex-row items-center justify-between border-t border-border/40 pt-2 mt-0.5">
                      <View className="flex-1 mr-2 min-w-0">
                        <Text className="text-xs font-medium text-foreground" numberOfLines={1}>
                          {po.supplier || po.vendor || "-"}
                        </Text>
                        {totalVal > 0 && (
                          <Text className="text-[11px] font-bold text-primary mt-0.5">
                            {rupiah(totalVal)}
                          </Text>
                        )}
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
                    Tidak ada data PO Supplier yang cocok dengan &quot;{q}&quot;
                  </Text>
                </View>
              )}
            </ScrollView>
          ) : (
            <View className="border border-border/80 rounded-xl overflow-hidden mt-3 bg-card flex-1">
              <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ minWidth: "100%" }}
            >
              <View className="flex-1 min-w-[760px]">
                {/* Header */}
                <View className="flex-row items-center bg-muted/60 px-4 py-2.5 border-b border-border/70 text-xs font-bold text-muted-foreground">
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/4 min-w-[180px]">
                    Nomor PO & Tanggal
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/4 min-w-[180px] px-2">
                    Supplier & Barang
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-32 text-right px-2">
                    Total Nilai
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground flex-1 min-w-[120px] px-2 text-center">
                    Status / Pengiriman
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-20 text-center">
                    Aksi
                  </Text>
                </View>

                {/* Rows */}
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
                        - Kosongkan Pilihan PO -
                      </Text>
                      {!poId && !value && (
                        <Check size={16} color={colors.primary} />
                      )}
                    </Pressable>
                  )}

                  {filteredList.map((po) => {
                    const isSelected =
                      (selectedPo && String(selectedPo.id) === String(po.id)) ||
                      (value &&
                        String(po.nomor || "").toLowerCase() ===
                          value.toLowerCase());
                    const no = po.nomor || po.number || `#${po.id}`;
                    const supp = po.supplier || "Supplier";
                    const tgl = po.date || po.tanggal;
                    const tot = Number(
                      po.total || po.grandTotal || po.nominal || 0,
                    );
                    const st = po.status || po.pengiriman || "Draft";

                    return (
                      <Pressable
                        key={po.id}
                        onPress={() => handleSelect(po)}
                        className={cn(
                          "p-3.5 hover:bg-primary/5 active:bg-primary/10 transition-colors flex-row items-center justify-between gap-2",
                          isSelected && "bg-primary/10",
                        )}
                      >
                        {/* Kolom 1: Nomor PO & Tanggal */}
                        <View className="w-1/4 min-w-[180px]">
                          <Text
                            className={cn(
                              "text-xs font-bold font-mono text-foreground",
                              isSelected && "text-primary",
                            )}
                          >
                            {no}
                          </Text>
                          {tgl ? (
                            <View className="flex-row items-center gap-1 mt-0.5">
                              <Calendar size={10} color={colors.muted} />
                              <Text className="text-[11px] text-muted-foreground">
                                {formatDate(tgl)}
                              </Text>
                            </View>
                          ) : null}
                          {po.request ? (
                            <Text className="text-[10px] text-muted-foreground mt-0.5">
                              Ref: {po.request}
                            </Text>
                          ) : null}
                        </View>

                        {/* Kolom 2: Supplier & Barang */}
                        <View className="w-1/4 min-w-[180px] px-2">
                          <Text
                            className="text-xs font-semibold text-foreground"
                            numberOfLines={1}
                          >
                            {supp}
                          </Text>
                          {po.item ? (
                            <Text
                              className="text-[11px] text-muted-foreground mt-0.5"
                              numberOfLines={1}
                            >
                              {po.item}
                            </Text>
                          ) : null}
                        </View>

                        {/* Kolom 3: Total Nilai */}
                        <View className="w-32 px-2 items-end">
                          <Text className="text-xs font-semibold text-foreground">
                            {tot > 0 ? rupiah(tot) : "-"}
                          </Text>
                        </View>

                        {/* Kolom 4: Status */}
                        <View className="flex-1 min-w-[120px] px-2 items-center">
                          <StatusBadge status={st} />
                        </View>

                        {/* Kolom 5: Aksi */}
                        <View className="w-20 items-center justify-center">
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
                        Tidak ada data PO Supplier yang cocok dengan &quot;{q}
                        &quot;
                      </Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            </ScrollView>
          </View>
        )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ==========================================
// 14. PURCHASE REQUEST SELECT
// ==========================================
