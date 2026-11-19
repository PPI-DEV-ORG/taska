import * as React from "react";
import { View, Pressable, ScrollView, Platform } from "react-native";
import {
  Search,
  ChevronDown,
  Check,
  Calendar,
  Clock,
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
import type { Row } from "@/constants/modules";
import { formatDate } from "./format-date";

export interface DraftReceivingSelectProps {
  value?: string;
  receivingId?: string | number | null;
  receivings?: Row[];
  onChange: (receiving: Row | null) => void;
  placeholder?: string;
  error?: boolean;
  allowClear?: boolean;
}

export function DraftReceivingSelect({
  value,
  receivingId,
  receivings,
  onChange,
  placeholder = "Pilih data penerimaan yang sedang menunggu...",
  error,
  allowClear = true,
}: DraftReceivingSelectProps) {
  const { data } = useApp();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  const recList: Row[] = React.useMemo(() => {
    return receivings ?? (data.receiving as Row[]) ?? [];
  }, [receivings, data.receiving]);

  const selectedRec = React.useMemo(() => {
    if (receivingId) {
      const match = recList.find((r) => String(r.id) === String(receivingId));
      if (match) return match;
    }
    if (value) {
      const sel = value.trim().toLowerCase();
      return (
        recList.find((r) => {
          const no = String(r.nomor || r.number || `#${r.id}`).toLowerCase();
          const supp = String(r.supplier || r.supplierName || "").toLowerCase();
          return no === sel || `${no} — ${supp}`.toLowerCase().includes(sel);
        }) || null
      );
    }
    return null;
  }, [recList, receivingId, value]);

  const displayLabel = React.useMemo(() => {
    if (selectedRec) {
      const no =
        selectedRec.nomor || selectedRec.number || `#${selectedRec.id}`;
      return `${no} — ${selectedRec.supplier || selectedRec.supplierName || "Supplier"}`;
    }
    return value || "";
  }, [selectedRec, value]);

  const filteredList = React.useMemo(() => {
    if (!q.trim()) return recList;
    const term = q.trim().toLowerCase();
    return recList.filter((r) => {
      const no = String(r.nomor || r.number || `#${r.id}`).toLowerCase();
      const supp = String(r.supplier || r.supplierName || "").toLowerCase();
      const refReq = String(r.requestNumber || r.requestId || "").toLowerCase();
      const refPo = String(r.po || r.supplierPoId || "").toLowerCase();
      const it = String(r.item || "").toLowerCase();
      return (
        no.includes(term) ||
        supp.includes(term) ||
        refReq.includes(term) ||
        refPo.includes(term) ||
        it.includes(term)
      );
    });
  }, [recList, q]);

  function handleSelect(r: Row | null) {
    onChange(r);
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
          <Clock
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
                <Clock size={20} color={colors.primary} />
                <DialogTitle>
                  Pilih Data Penerimaan yang Sedang Menunggu
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
              placeholder="Cari nomor penerimaan, supplier, ref request/PO, atau barang..."
              autoFocus
              className="h-9 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent outline-none ring-0 web:focus-visible:ring-0 web:focus-visible:outline-none"
            />
            {q ? (
              <Pressable onPress={() => setQ("")} className="p-1">
                <X size={16} color={colors.muted} />
              </Pressable>
            ) : null}
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
                    Nomor Penerimaan & Tanggal
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/4 min-w-[180px] px-2">
                    Supplier & Ref Dokumen
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground flex-1 min-w-[200px] px-2">
                    Ringkasan Barang
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-28 px-2 text-center">
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
                        - Kosongkan Pilihan Draft -
                      </Text>
                      {!receivingId && !value && (
                        <Check size={16} color={colors.primary} />
                      )}
                    </Pressable>
                  )}

                  {filteredList.map((rec) => {
                    const isSelected =
                      (selectedRec &&
                        String(selectedRec.id) === String(rec.id)) ||
                      (value &&
                        String(rec.nomor || "").toLowerCase() ===
                          value.toLowerCase());
                    const no = rec.nomor || rec.number || `#${rec.id}`;
                    const supp = rec.supplier || rec.supplierName || "-";
                    const refDoc =
                      [
                        rec.requestNumber ? `PR: ${rec.requestNumber}` : null,
                        rec.po ? `PO: ${rec.po}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "-";
                    const tgl = rec.tanggal || rec.date;
                    const st = rec.status || "Menunggu";

                    return (
                      <Pressable
                        key={rec.id}
                        onPress={() => handleSelect(rec)}
                        className={cn(
                          "p-3.5 hover:bg-primary/5 active:bg-primary/10 transition-colors flex-row items-center justify-between gap-2",
                          isSelected && "bg-primary/10",
                        )}
                      >
                        {/* Kolom 1: Nomor & Tanggal */}
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
                        </View>

                        {/* Kolom 2: Supplier & Ref */}
                        <View className="w-1/4 min-w-[180px] px-2">
                          <Text
                            className="text-xs font-semibold text-foreground"
                            numberOfLines={1}
                          >
                            {supp}
                          </Text>
                          <Text
                            className="text-[11px] text-muted-foreground mt-0.5"
                            numberOfLines={1}
                          >
                            {refDoc}
                          </Text>
                        </View>

                        {/* Kolom 3: Barang */}
                        <View className="flex-1 min-w-[200px] px-2">
                          <Text
                            className="text-xs text-foreground"
                            numberOfLines={2}
                          >
                            {rec.item || "-"}
                          </Text>
                        </View>

                        {/* Kolom 4: Status */}
                        <View className="w-28 px-2 items-center">
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
                        Tidak ada data penerimaan yang cocok dengan &quot;{q}
                        &quot;
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
// 10. MAINTENANCE SELECT
// ==========================================
