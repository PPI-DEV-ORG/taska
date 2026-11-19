import * as React from "react";
import { View, Pressable, ScrollView, Platform } from "react-native";
import {
  Search,
  ChevronDown,
  Check,
  Handshake,
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
import { StatusBadge } from "@/components/taska/status-badge";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";
import type { Row } from "@/constants/modules";
import { formatDate } from "./format-date";

export interface VisitSelectProps {
  value?: string;
  visitId?: string | number | null;
  onChange: (visit: Row | null) => void;
  placeholder?: string;
  error?: boolean;
  allowClear?: boolean;
}

export function VisitSelect({
  value,
  visitId,
  onChange,
  placeholder = "Pilih kunjungan / meeting...",
  error,
  allowClear = true,
}: VisitSelectProps) {
  const { data } = useApp();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  const visitList: Row[] = React.useMemo(
    () => (data as any)["visit-reports"] ?? [],
    [data],
  );

  const selectedVisit = React.useMemo(() => {
    if (visitId) {
      const match = visitList.find((v) => String(v.id) === String(visitId));
      if (match) return match;
    }
    if (value && value !== "-") {
      const qVal = value.trim().toLowerCase();
      return (
        visitList.find((v) => {
          const opt =
            `VISIT ${v.nomor || v.number || v.id} - ${v.judul || v.title || "Meeting"}`.toLowerCase();
          const no = String(v.nomor || v.number || "").toLowerCase();
          return (
            opt === qVal ||
            no === qVal ||
            String(v.id) === qVal ||
            opt.includes(qVal)
          );
        }) || null
      );
    }
    return null;
  }, [visitList, visitId, value]);

  const displayLabel = React.useMemo(() => {
    if (selectedVisit) {
      return `VISIT ${selectedVisit.nomor || selectedVisit.number || selectedVisit.id} - ${selectedVisit.judul || selectedVisit.title || "Meeting"}`;
    }
    return value && value !== "-" ? value : "";
  }, [selectedVisit, value]);

  const filteredList = React.useMemo(() => {
    if (!q.trim()) return visitList;
    const term = q.trim().toLowerCase();
    return visitList.filter((v) => {
      const no = String(v.nomor || v.number || "").toLowerCase();
      const judul = String(v.judul || v.title || "").toLowerCase();
      const klien = String(v.klien || v.customer || "").toLowerCase();
      const tipe = String(v.tipe || "").toLowerCase();
      return (
        no.includes(term) ||
        judul.includes(term) ||
        klien.includes(term) ||
        tipe.includes(term)
      );
    });
  }, [visitList, q]);

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
          <Handshake
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
                <Handshake size={20} color={colors.primary} />
                <DialogTitle>Pilih Kunjungan / Meeting</DialogTitle>
              </View>
            </View>
          </DialogHeader>

          {/* Search bar */}
          <View className="bg-input border-border h-10 flex-row items-center gap-2 rounded-lg border px-3 mt-2">
            <Search size={16} color={colors.muted} />
            <Input
              value={q}
              onChangeText={setQ}
              placeholder="Cari berdasarkan nomor visit, judul, klien, atau tipe..."
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
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/3 min-w-[220px]">
                    Nomor & Aktivitas Visit
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/4 min-w-[180px] px-2">
                    Klien / Instansi
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-36 px-2">
                    Jenis & Tanggal
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
                        - Tanpa Kunjungan (Kosongkan) -
                      </Text>
                      {!visitId && !value && (
                        <Check size={16} color={colors.primary} />
                      )}
                    </Pressable>
                  )}

                  {filteredList.map((v) => {
                    const isSelected = selectedVisit?.id === v.id;
                    const no = v.nomor || v.number || `VISIT #${v.id}`;
                    const judul = v.judul || v.title || "Aktivitas Kunjungan";
                    const klien = v.klien || v.customer || "-";
                    const tgl = v.tanggal || v.createdAt || "";

                    return (
                      <Pressable
                        key={v.id}
                        onPress={() => handleSelect(v)}
                        className={cn(
                          "p-3.5 hover:bg-primary/5 active:bg-primary/10 transition-colors flex-row items-center justify-between gap-2",
                          isSelected && "bg-primary/10",
                        )}
                      >
                        {/* Kolom 1: Nomor & Aktivitas */}
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

                        {/* Kolom 2: Klien / Instansi */}
                        <View className="w-1/4 min-w-[180px] px-2">
                          <Text
                            className="text-xs font-semibold text-foreground"
                            numberOfLines={1}
                          >
                            {klien}
                          </Text>
                          {v.lokasi ? (
                            <View className="flex-row items-center gap-1 mt-0.5">
                              <MapPin size={10} color={colors.muted} />
                              <Text
                                className="text-[11px] text-muted-foreground"
                                numberOfLines={1}
                              >
                                {v.lokasi}
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        {/* Kolom 3: Jenis & Tanggal */}
                        <View className="w-36 px-2">
                          <Text className="text-xs text-foreground font-medium">
                            {v.tipe || "Meeting"}
                          </Text>
                          {tgl ? (
                            <Text className="text-[11px] text-muted-foreground mt-0.5">
                              {formatDate(tgl)}
                            </Text>
                          ) : null}
                        </View>

                        {/* Kolom 4: Status */}
                        <View className="flex-1 min-w-[120px] px-2 items-center">
                          <StatusBadge status={v.status || "Planned"} />
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
                        Tidak ada data kunjungan yang cocok dengan &quot;{q}
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
// 10. USER SELECT (PENANGGUNG JAWAB)
// ==========================================
