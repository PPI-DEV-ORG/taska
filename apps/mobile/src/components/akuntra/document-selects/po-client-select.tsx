import * as React from "react";
import { View, Pressable, ScrollView, Platform } from "react-native";
import {
  Search,
  FileText,
  ChevronDown,
  Check,
  Calendar,
  Briefcase,
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
import type { Row } from "@/constants/modules";
import { formatDate } from "./format-date";

export interface PoClientSelectProps {
  value?: string;
  poId?: string | number | null;
  onChange: (po: Row | null) => void;
  placeholder?: string;
  error?: boolean;
  allowClear?: boolean;
  excludeIds?: Iterable<string | number>;
}

export function PoClientSelect({
  value,
  poId,
  onChange,
  placeholder = "Cari & pilih PO pelanggan (Pesanan Penjualan)...",
  error,
  allowClear = true,
  excludeIds,
}: PoClientSelectProps) {
  const { data } = useApp();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  const excludedSet = React.useMemo(() => {
    const set = new Set<string>();
    for (const id of excludeIds ?? []) set.add(String(id));
    return set;
  }, [excludeIds]);

  const poClientData = data["po-client"];
  const poList: Row[] = React.useMemo(
    () =>
      (poClientData ?? []).filter((p: Row) => !excludedSet.has(String(p.id))),
    [poClientData, excludedSet],
  );

  const selectedPo = React.useMemo(() => {
    if (poId) {
      const match = poList.find((p) => String(p.id) === String(poId));
      if (match) return match;
    }
    if (value) {
      const selNo = value.split(" - ")[0]?.trim().toLowerCase();
      return (
        poList.find((p) => {
          const no = String(
            p.nomorSo || p.nomor || p.number || "",
          ).toLowerCase();
          return (
            no === selNo ||
            `${no} - ${p.customer || "-"}`.toLowerCase() === value.toLowerCase()
          );
        }) || null
      );
    }
    return null;
  }, [poList, poId, value]);

  const displayLabel = React.useMemo(() => {
    if (selectedPo) {
      const no =
        selectedPo.nomorSo ||
        selectedPo.nomor ||
        selectedPo.number ||
        `PO #${selectedPo.id}`;
      return `${no} - ${selectedPo.customer || "-"}`;
    }
    return value || "";
  }, [selectedPo, value]);

  const filteredList = React.useMemo(() => {
    if (!q.trim()) return poList;
    const term = q.trim().toLowerCase();
    return poList.filter((p) => {
      const no = String(p.nomorSo || p.nomor || p.number || "").toLowerCase();
      const cust = String(p.customer || "").toLowerCase();
      const proj = String(p.project || p.proyek || "").toLowerCase();
      const note = String(p.catatan || "").toLowerCase();
      return (
        no.includes(term) ||
        cust.includes(term) ||
        proj.includes(term) ||
        note.includes(term)
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
          <FileText
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
          <DialogHeader>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <FileText size={20} color={colors.primary} />
                <DialogTitle>
                  Pilih PO Pelanggan (Pesanan Penjualan)
                </DialogTitle>
              </View>
            </View>
          </DialogHeader>

          {/* Search bar */}
          <View className="bg-input border-border h-10 flex-row items-center gap-2 rounded-lg border px-3 mt-2">
            <Search size={16} color={colors.muted} />
            <Input
              value={q}
              onChangeText={setQ}
              placeholder="Cari berdasarkan nomor PO/SO, nama pelanggan, proyek, atau catatan..."
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
              <View className="flex-1 min-w-[880px]">
                {/* Header */}
                <View className="flex-row items-center bg-muted/60 px-4 py-2.5 border-b border-border/70 text-xs font-bold text-muted-foreground">
                  <Text className="text-[11px] font-bold text-muted-foreground flex-1 min-w-[180px]">
                    Nomor SO & Tanggal
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground flex-1 min-w-[180px] px-2">
                    Pelanggan & Proyek
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-36 shrink-0 text-right pr-3">
                    Total Nilai
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-48 shrink-0 pl-4 pr-2">
                    Status & Tagihan
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-20 shrink-0 text-center">
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
                        - Tanpa Sales Order (SO) -
                      </Text>
                      {!poId && !value && (
                        <Check size={16} color={colors.primary} />
                      )}
                    </Pressable>
                  )}

                  {filteredList.map((p) => {
                    const isSelected = selectedPo?.id === p.id;
                    const no =
                      p.nomorSo || p.nomor || p.number || `SO #${p.id}`;
                    const tgl = p.tanggal || p.createdAt || "";
                    const totalVal = Number(p.total || p.nilai || 0);
                    const totalInv = Number(p.totalInvoice || 0);
                    const sisa = Math.max(0, totalVal - totalInv);
                    const itemCount = Array.isArray(p.items)
                      ? p.items.length
                      : 0;

                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => handleSelect(p)}
                        className={cn(
                          "px-4 py-3.5 hover:bg-primary/5 active:bg-primary/10 transition-colors flex-row items-center",
                          isSelected && "bg-primary/10",
                        )}
                      >
                        {/* Kolom 1: Nomor SO & Tanggal */}
                        <View className="flex-1 min-w-[180px]">
                          <Text
                            className={cn(
                              "text-xs font-bold font-mono text-foreground",
                              isSelected && "text-primary",
                            )}
                            numberOfLines={1}
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
                          {itemCount > 0 ? (
                            <Text className="text-[10px] text-muted-foreground mt-0.5">
                              {itemCount} item barang/jasa
                            </Text>
                          ) : null}
                        </View>

                        {/* Kolom 2: Customer & Proyek */}
                        <View className="flex-1 min-w-[180px] px-2">
                          <Text
                            className="text-xs font-semibold text-foreground"
                            numberOfLines={1}
                          >
                            {p.customer || "-"}
                          </Text>
                          {p.project || p.proyek ? (
                            <View className="flex-row items-center gap-1 mt-0.5">
                              <Briefcase size={10} color={colors.muted} />
                              <Text
                                className="text-[11px] text-muted-foreground"
                                numberOfLines={1}
                              >
                                {p.project || p.proyek}
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        {/* Kolom 3: Total Nilai Pesanan */}
                        <View className="w-36 shrink-0 items-end pr-3">
                          <Text
                            className="w-full text-right text-xs font-bold text-foreground"
                            numberOfLines={1}
                          >
                            {rupiah(totalVal)}
                          </Text>
                          {p.ppnMode && p.ppnMode !== "none" ? (
                            <Text
                              className="w-full text-right text-[10px] text-primary"
                              numberOfLines={1}
                            >
                              {p.ppnMode === "include"
                                ? "Inc. PPN"
                                : "+ PPN 11%"}
                            </Text>
                          ) : null}
                        </View>

                        {/* Kolom 4: Status & Tagihan */}
                        <View className="w-48 shrink-0 pl-4 pr-2 items-start justify-center">
                          <StatusBadge
                            status={p.paymentStatus || p.status || "Aktif"}
                          />
                          {totalInv > 0 ? (
                            <Text
                              className="w-full text-[10px] text-muted-foreground mt-0.5"
                              numberOfLines={2}
                            >
                              Terbit: {rupiah(totalInv)}
                              {sisa > 0 ? `\nSisa: ${rupiah(sisa)}` : ""}
                            </Text>
                          ) : null}
                        </View>

                        {/* Kolom 5: Aksi */}
                        <View className="w-20 shrink-0 items-center">
                          {isSelected ? (
                            <View className="flex-row items-center gap-1 px-2 py-1 bg-primary/15 rounded-md">
                              <Check size={12} color={colors.primary} />
                              <Text className="text-[11px] font-bold text-primary">
                                Dipilih
                              </Text>
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
                        {q.trim()
                          ? `Tidak ada data PO Client yang cocok dengan "${q}"`
                          : "Tidak ada SO yang tersedia atau semua sudah memiliki Surat Jalan."}
                      </Text>
                    </View>
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

// ==========================================
// 2. QUOTATION (PENAWARAN) SELECT
// ==========================================
