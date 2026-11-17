import * as React from "react";
import { View, Pressable, ScrollView, Platform } from "react-native";
import {
  Search,
  FileSpreadsheet,
  ChevronDown,
  Check,
  Calendar,
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
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/taska/status-badge";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";
import { rupiah } from "@/lib/format";
import type { Row } from "@/constants/modules";
import { formatDate } from "./format-date";

export interface QuotationSelectProps {
  value?: string;
  quotationId?: string | number | null;
  onChange: (quotation: Row | null) => void;
  placeholder?: string;
  error?: boolean;
  allowClear?: boolean;
  /** Batasi penawaran yang bisa dipilih (mis. hanya yang masih berlaku). */
  filter?: (quotation: Row) => boolean;
}

export function QuotationSelect({
  value,
  quotationId,
  onChange,
  placeholder = "Cari & pilih dokumen penawaran...",
  error,
  allowClear = false,
  filter,
}: QuotationSelectProps) {
  const { data } = useApp();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  const allQuotations: Row[] = React.useMemo(
    () => data.quotations ?? [],
    [data.quotations],
  );
  const quotations: Row[] = React.useMemo(
    () => (filter ? allQuotations.filter(filter) : allQuotations),
    [allQuotations, filter],
  );

  const selectedQuotation = React.useMemo(() => {
    if (quotationId) {
      const match = quotations.find(
        (it) => String(it.id) === String(quotationId),
      );
      if (match) return match;
    }
    if (value && value !== "-") {
      const selNo = value.split(" - ")[0]?.trim().toLowerCase();
      return (
        quotations.find((it) => {
          const no = String(it.nomor || "").toLowerCase();
          return (
            no === selNo ||
            `${no} - ${it.customer || "-"} - ${it.lead || "-"}`.toLowerCase() ===
              value.toLowerCase()
          );
        }) || null
      );
    }
    return null;
  }, [quotations, quotationId, value]);

  const displayLabel = React.useMemo(() => {
    if (selectedQuotation) {
      return `${selectedQuotation.nomor} - ${selectedQuotation.customer || "-"} - ${selectedQuotation.lead || "-"}`;
    }
    return value && value !== "-" ? value : "";
  }, [selectedQuotation, value]);

  const filteredList = React.useMemo(() => {
    if (!q.trim()) return quotations;
    const term = q.trim().toLowerCase();
    return quotations.filter((item) => {
      const no = String(item.nomor || "").toLowerCase();
      const cust = String(item.customer || "").toLowerCase();
      const lead = String(item.lead || "").toLowerCase();
      return no.includes(term) || cust.includes(term) || lead.includes(term);
    });
  }, [quotations, q]);

  function handleSelect(item: Row | null) {
    onChange(item);
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
          <FileSpreadsheet
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
                <FileSpreadsheet size={20} color={colors.primary} />
                <DialogTitle>Pilih Dokumen Penawaran (Quotation)</DialogTitle>
              </View>
            </View>
          </DialogHeader>

          {/* Search bar */}
          <View className="bg-input border-border h-10 flex-row items-center gap-2 rounded-lg border px-3 mt-2">
            <Search size={16} color={colors.muted} />
            <Input
              value={q}
              onChangeText={setQ}
              placeholder="Cari berdasarkan nomor penawaran, nama pelanggan, atau prospek..."
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
              <View className="flex-1 min-w-[760px]">
                {/* Header */}
                <View className="flex-row items-center bg-muted/60 px-4 py-2.5 border-b border-border/70 text-xs font-bold text-muted-foreground">
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/4 min-w-[180px]">
                    Nomor Penawaran & Versi
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/3 min-w-[220px] px-2">
                    Pelanggan & Prospek
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-36 text-right px-2">
                    Total Nilai Penawaran
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground flex-1 min-w-[120px] px-2 text-center">
                    Status
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
                        - Tanpa Penawaran (Buat Manual / Kosongkan) -
                      </Text>
                      {!quotationId && !value && (
                        <Check size={16} color={colors.primary} />
                      )}
                    </Pressable>
                  )}
                  {filteredList.map((item) => {
                    const isSelected = selectedQuotation?.id === item.id;
                    const no = item.nomor || `Quotation #${item.id}`;
                    const versi = item.versi ? `v${item.versi}` : "v1";
                    const tgl = item.tanggal || item.createdAt || "";
                    const totalVal = Number(
                      item.totalAfterDisc || item.total || item.nilai || 0,
                    );
                    const itemCount = Array.isArray(item.items)
                      ? item.items.length
                      : 0;

                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => handleSelect(item)}
                        className={cn(
                          "p-3.5 hover:bg-primary/5 active:bg-primary/10 transition-colors flex-row items-center justify-between gap-2",
                          isSelected && "bg-primary/10",
                        )}
                      >
                        {/* Kolom 1: Nomor & Versi */}
                        <View className="w-1/4 min-w-[180px]">
                          <View className="flex-row items-center gap-1.5 flex-wrap">
                            <Text
                              className={cn(
                                "text-xs font-bold font-mono text-foreground",
                                isSelected && "text-primary",
                              )}
                            >
                              {no}
                            </Text>
                            <View className="px-1.5 py-0.2 rounded bg-muted border border-border/80">
                              <Text className="text-[10px] font-semibold text-muted-foreground">
                                {versi}
                              </Text>
                            </View>
                          </View>
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

                        {/* Kolom 2: Customer & Lead */}
                        <View className="w-1/3 min-w-[220px] px-2">
                          <Text
                            className="text-xs font-semibold text-foreground"
                            numberOfLines={1}
                          >
                            {item.customer || "-"}
                          </Text>
                          {item.lead ? (
                            <View className="flex-row items-center gap-1 mt-0.5">
                              <Tag size={10} color={colors.muted} />
                              <Text
                                className="text-[11px] text-muted-foreground"
                                numberOfLines={1}
                              >
                                Prospek: {item.lead}
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        {/* Kolom 3: Total Nilai Penawaran */}
                        <View className="w-36 items-end px-2">
                          <Text className="text-xs font-bold text-foreground">
                            {rupiah(totalVal)}
                          </Text>
                          {item.ppnMode && item.ppnMode !== "none" ? (
                            <Text className="text-[10px] text-primary">
                              {item.ppnMode === "include"
                                ? "Inc. PPN"
                                : "+ PPN 11%"}
                            </Text>
                          ) : null}
                        </View>

                        {/* Kolom 4: Status */}
                        <View className="flex-1 min-w-[120px] px-2 items-center">
                          <StatusBadge status={item.status || "Aktif"} />
                        </View>

                        {/* Kolom 5: Aksi */}
                        <View className="w-20 items-center">
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
                        Tidak ada penawaran yang cocok dengan &quot;{q}&quot;
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
// 3. LEAD (PROSPEK) SELECT
// ==========================================
