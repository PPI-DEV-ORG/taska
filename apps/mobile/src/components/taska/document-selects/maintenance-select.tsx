import * as React from "react";
import { View, Pressable, ScrollView, Platform } from "react-native";
import {
  Search,
  ChevronDown,
  Check,
  Wrench,
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

export interface MaintenanceSelectProps {
  value?: string;
  maintenanceId?: string | number | null;
  onChange: (maintenance: Row | null) => void;
  placeholder?: string;
  error?: boolean;
  allowClear?: boolean;
}

export function MaintenanceSelect({
  value,
  maintenanceId,
  onChange,
  placeholder = "Pilih laporan maintenance...",
  error,
  allowClear = true,
}: MaintenanceSelectProps) {
  const { data } = useApp();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  const maintenanceList: Row[] = React.useMemo(
    () => (data as any)["maintenance-reports"] ?? [],
    [data],
  );

  const selectedMaintenance = React.useMemo(() => {
    if (maintenanceId) {
      const match = maintenanceList.find(
        (m) => String(m.id) === String(maintenanceId),
      );
      if (match) return match;
    }
    if (value && value !== "-") {
      const qVal = value.trim().toLowerCase();
      return (
        maintenanceList.find((m) => {
          const opt =
            `MTN ${m.nomor || m.number || m.id} - ${m.judul || m.title || "Maintenance"}`.toLowerCase();
          const no = String(m.nomor || m.number || "").toLowerCase();
          return (
            opt === qVal ||
            no === qVal ||
            String(m.id) === qVal ||
            opt.includes(qVal)
          );
        }) || null
      );
    }
    return null;
  }, [maintenanceList, maintenanceId, value]);

  const displayLabel = React.useMemo(() => {
    if (selectedMaintenance) {
      return `MTN ${selectedMaintenance.nomor || selectedMaintenance.number || selectedMaintenance.id} - ${selectedMaintenance.judul || selectedMaintenance.title || "Maintenance"}`;
    }
    return value && value !== "-" ? value : "";
  }, [selectedMaintenance, value]);

  const filteredList = React.useMemo(() => {
    if (!q.trim()) return maintenanceList;
    const term = q.trim().toLowerCase();
    return maintenanceList.filter((m) => {
      const no = String(m.nomor || m.number || "").toLowerCase();
      const judul = String(m.judul || m.title || "").toLowerCase();
      const klien = String(m.klien || m.customer || "").toLowerCase();
      const tipe = String(m.tipe || m.maintenanceType || "").toLowerCase();
      return (
        no.includes(term) ||
        judul.includes(term) ||
        klien.includes(term) ||
        tipe.includes(term)
      );
    });
  }, [maintenanceList, q]);

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
          <Wrench
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
                <Wrench size={20} color={colors.primary} />
                <DialogTitle>Pilih Laporan Maintenance</DialogTitle>
              </View>
            </View>
          </DialogHeader>

          {/* Search bar */}
          <View className="bg-input border-border h-10 flex-row items-center gap-2 rounded-lg border px-3 mt-2">
            <Search size={16} color={colors.muted} />
            <Input
              value={q}
              onChangeText={setQ}
              placeholder="Cari nomor maintenance, judul, klien, atau jenis..."
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
                    Nomor & Judul Maintenance
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/4 min-w-[180px] px-2">
                    Klien / Lokasi
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
                        - Tanpa Maintenance (Kosongkan) -
                      </Text>
                      {!maintenanceId && !value && (
                        <Check size={16} color={colors.primary} />
                      )}
                    </Pressable>
                  )}

                  {filteredList.map((m) => {
                    const isSelected = selectedMaintenance?.id === m.id;
                    const no = m.nomor || m.number || `MTN #${m.id}`;
                    const judul = m.judul || m.title || "Laporan Maintenance";
                    const klien = m.klien || m.customer || "-";
                    const tgl = m.tanggal || m.startDate || m.createdAt || "";

                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => handleSelect(m)}
                        className={cn(
                          "p-3.5 hover:bg-primary/5 active:bg-primary/10 transition-colors flex-row items-center justify-between gap-2",
                          isSelected && "bg-primary/10",
                        )}
                      >
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

                        <View className="w-1/4 min-w-[180px] px-2">
                          <Text
                            className="text-xs font-semibold text-foreground"
                            numberOfLines={1}
                          >
                            {klien}
                          </Text>
                          {m.lokasi ? (
                            <View className="flex-row items-center gap-1 mt-0.5">
                              <MapPin size={10} color={colors.muted} />
                              <Text
                                className="text-[11px] text-muted-foreground"
                                numberOfLines={1}
                              >
                                {m.lokasi}
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        <View className="w-36 px-2">
                          <Text className="text-xs text-foreground font-medium">
                            {m.tipe || m.maintenanceType || "Preventive"}
                          </Text>
                          {tgl ? (
                            <Text className="text-[11px] text-muted-foreground mt-0.5">
                              {formatDate(tgl)}
                            </Text>
                          ) : null}
                        </View>

                        <View className="flex-1 min-w-[120px] px-2 items-center">
                          <StatusBadge status={m.status || "Scheduled"} />
                        </View>

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
                        Tidak ada data maintenance yang cocok dengan &quot;{q}
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
