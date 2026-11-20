import * as React from "react";
import { View, Pressable, ScrollView, Platform } from "react-native";
import {
  Search,
  ChevronDown,
  Check,
  Presentation,
  MapPin,
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
import { useBreakpoint } from "@/hooks/use-breakpoint";
import type { Row } from "@/constants/modules";
import { formatDate } from "./format-date";

export interface PocSelectProps {
  value?: string;
  pocId?: string | number | null;
  onChange: (poc: Row | null) => void;
  placeholder?: string;
  error?: boolean;
  allowClear?: boolean;
}

export function PocSelect({
  value,
  pocId,
  onChange,
  placeholder = "Pilih kegiatan POC / Demo...",
  error,
  allowClear = true,
}: PocSelectProps) {
  const { data } = useApp();
  const { isMobile } = useBreakpoint();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  const pocList: Row[] = React.useMemo(
    () => (data as any)["poc-reports"] ?? [],
    [data],
  );

  const selectedPoc = React.useMemo(() => {
    if (pocId) {
      const match = pocList.find((p) => String(p.id) === String(pocId));
      if (match) return match;
    }
    if (value && value !== "-") {
      const qVal = value.trim().toLowerCase();
      return (
        pocList.find((p) => {
          const opt =
            `POC ${p.nomor || p.number || p.id} - ${p.judul || p.title || "POC"}`.toLowerCase();
          const no = String(p.nomor || p.number || "").toLowerCase();
          return (
            opt === qVal ||
            no === qVal ||
            String(p.id) === qVal ||
            opt.includes(qVal)
          );
        }) || null
      );
    }
    return null;
  }, [pocList, pocId, value]);

  const displayLabel = React.useMemo(() => {
    if (selectedPoc) {
      return `POC ${selectedPoc.nomor || selectedPoc.number || selectedPoc.id} - ${selectedPoc.judul || selectedPoc.title || "POC"}`;
    }
    return value && value !== "-" ? value : "";
  }, [selectedPoc, value]);

  const filteredList = React.useMemo(() => {
    if (!q.trim()) return pocList;
    const term = q.trim().toLowerCase();
    return pocList.filter((p) => {
      const no = String(p.nomor || p.number || "").toLowerCase();
      const judul = String(p.judul || p.title || "").toLowerCase();
      const klien = String(p.klien || p.customer || "").toLowerCase();
      const tipe = String(p.tipe || "").toLowerCase();
      return (
        no.includes(term) ||
        judul.includes(term) ||
        klien.includes(term) ||
        tipe.includes(term)
      );
    });
  }, [pocList, q]);

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
          <Presentation
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
                <Presentation size={20} color={colors.primary} />
                <DialogTitle>Pilih Kegiatan POC / Demo</DialogTitle>
              </View>
            </View>
          </DialogHeader>

          {/* Search bar */}
          <View className="bg-input border-border h-10 flex-row items-center gap-2 rounded-lg border px-3 mt-2">
            <Search size={16} color={colors.muted} />
            <Input
              value={q}
              onChangeText={setQ}
              placeholder="Cari berdasarkan nomor POC, judul, klien, atau tipe..."
              autoFocus
              className="h-9 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent outline-none ring-0 web:focus-visible:ring-0 web:focus-visible:outline-none"
            />
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
                    - Tanpa POC (Kosongkan) -
                  </Text>
                  {!pocId && !value && (
                    <Check size={16} color={colors.primary} />
                  )}
                </Pressable>
              )}

              {filteredList.map((p) => {
                const isSelected = selectedPoc?.id === p.id;
                const no = p.nomor || p.nomorPoc || `POC-${p.id}`;
                const tgl = p.tanggal || p.createdAt || "";
                const klien = p.customer || p.klien || "-";

                return (
                  <Pressable
                    key={p.id}
                    onPress={() => handleSelect(p)}
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
                          {p.judul || p.title || no}
                        </Text>
                        <Text className="font-mono text-xs font-bold text-primary mt-0.5">
                          {no}
                        </Text>
                      </View>
                      <StatusBadge status={p.status || "Draf"} />
                    </View>

                    <View className="flex-row items-center justify-between border-t border-border/40 pt-2 mt-0.5">
                      <View className="flex-1 mr-2 min-w-0">
                        <View className="flex-row items-center gap-1">
                          <MapPin size={11} color={colors.muted} />
                          <Text className="text-xs font-medium text-foreground" numberOfLines={1}>
                            {klien} {p.tipe ? `· ${p.tipe}` : ""}
                          </Text>
                        </View>
                        {tgl ? (
                          <Text className="text-[11px] text-muted-foreground mt-0.5" numberOfLines={1}>
                            {formatDate(tgl)}
                          </Text>
                        ) : null}
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
                    Tidak ada data POC yang cocok dengan &quot;{q}&quot;
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
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/3 min-w-[220px]">
                    Nomor & Judul POC
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/4 min-w-[180px] px-2">
                    Klien / Acara
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-36 px-2">
                    Tipe & Tanggal
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
                        - Tanpa POC (Kosongkan) -
                      </Text>
                      {!pocId && !value && (
                        <Check size={16} color={colors.primary} />
                      )}
                    </Pressable>
                  )}

                  {filteredList.map((p) => {
                    const isSelected = selectedPoc?.id === p.id;
                    const no = p.nomor || p.number || `POC #${p.id}`;
                    const judul = p.judul || p.title || "Kegiatan POC";
                    const klien = p.klien || p.customer || "-";
                    const tgl = p.tanggal || p.createdAt || "";

                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => handleSelect(p)}
                        className={cn(
                          "p-3.5 hover:bg-primary/5 active:bg-primary/10 transition-colors flex-row items-center justify-between gap-2",
                          isSelected && "bg-primary/10",
                        )}
                      >
                        {/* Kolom 1: Nomor & Judul */}
                        <View className="w-1/3 min-w-[220px]">
                          <Text
                            className={cn(
                              "text-xs font-bold font-mono text-foreground",
                              isSelected && "text-primary",
                            )}
                          >
                            {no}
                          </Text>
                          <Text
                            className="text-[11px] text-muted-foreground mt-0.5"
                            numberOfLines={2}
                          >
                            {judul}
                          </Text>
                        </View>

                        {/* Kolom 2: Klien / Acara */}
                        <View className="w-1/4 min-w-[180px] px-2">
                          <Text
                            className="text-xs font-semibold text-foreground"
                            numberOfLines={1}
                          >
                            {klien}
                          </Text>
                          {p.lokasi ? (
                            <View className="flex-row items-center gap-1 mt-0.5">
                              <MapPin size={10} color={colors.muted} />
                              <Text
                                className="text-[11px] text-muted-foreground"
                                numberOfLines={1}
                              >
                                {p.lokasi}
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        {/* Kolom 3: Tipe & Tanggal */}
                        <View className="w-36 px-2">
                          <Text className="text-xs text-foreground font-medium">
                            {p.tipe || "Demo"}
                          </Text>
                          {tgl ? (
                            <Text className="text-[11px] text-muted-foreground mt-0.5">
                              {formatDate(tgl)}
                            </Text>
                          ) : null}
                        </View>

                        {/* Kolom 4: Status */}
                        <View className="flex-1 min-w-[120px] px-2 items-center">
                          <StatusBadge status={p.status || "Planned"} />
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
                        Tidak ada data POC yang cocok dengan &quot;{q}&quot;
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
// 8. VISIT SELECT
// ==========================================
