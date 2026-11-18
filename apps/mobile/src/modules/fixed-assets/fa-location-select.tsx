import * as React from "react";
import { View, Pressable, ScrollView, Platform, TextInput } from "react-native";
import { Search, ChevronDown, Check, MapPin, Plus, Building2 } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import type { FaLocation } from "./types";

export interface FaLocationSelectProps {
  value?: string;
  locationId?: number | null;
  locations?: FaLocation[];
  onChange: (location: FaLocation | null) => void;
  onRefresh?: () => void;
  placeholder?: string;
  error?: boolean;
  allowClear?: boolean;
  className?: string;
}

export function FaLocationSelect({
  value,
  locationId,
  locations: propLocations,
  onChange,
  onRefresh,
  placeholder = "Cari & pilih lokasi penempatan...",
  error,
  allowClear = true,
  className,
}: FaLocationSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [locations, setLocations] = React.useState<FaLocation[]>(propLocations || []);
  const [loading, setLoading] = React.useState(false);

  // Quick add form state
  const [showAdd, setShowAdd] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newBuilding, setNewBuilding] = React.useState("");
  const [newFloor, setNewFloor] = React.useState("");
  const [newRoom, setNewRoom] = React.useState("");
  const [addError, setAddError] = React.useState("");
  const [addLoading, setAddLoading] = React.useState(false);

  // Sync prop locations
  React.useEffect(() => {
    if (propLocations && propLocations.length > 0) {
      setLocations(propLocations);
    } else {
      fetchLocations();
    }
  }, [propLocations]);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const res = await api<any>("GET", "/fixed-assets/locations");
      const list = Array.isArray(res) ? res : (res?.data || []);
      setLocations(list);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  const selectedLocation = React.useMemo(() => {
    if (locationId) {
      const match = locations.find((l) => l.id === locationId);
      if (match) return match;
    }
    if (value && value !== "-") {
      const qVal = value.trim().toLowerCase();
      return (
        locations.find(
          (l) =>
            l.name.toLowerCase() === qVal ||
            String(l.id) === qVal ||
            l.code?.toLowerCase() === qVal,
        ) || null
      );
    }
    return null;
  }, [locations, locationId, value]);

  const displayLabel = React.useMemo(() => {
    if (selectedLocation) {
      const parts = [
        selectedLocation.building ? `Gedung ${selectedLocation.building}` : "",
        selectedLocation.floor ? `Lt. ${selectedLocation.floor}` : "",
        selectedLocation.room ? `R. ${selectedLocation.room}` : "",
      ].filter(Boolean);
      return `${selectedLocation.name}${parts.length ? ` (${parts.join(", ")})` : ""}`;
    }
    return value && value !== "-" ? value : "";
  }, [selectedLocation, value]);

  const filteredLocations = React.useMemo(() => {
    if (!q.trim()) return locations;
    const term = q.trim().toLowerCase();
    return locations.filter((l) => {
      const name = (l.name || "").toLowerCase();
      const code = (l.code || "").toLowerCase();
      const building = (l.building || "").toLowerCase();
      const room = (l.room || "").toLowerCase();
      return (
        name.includes(term) ||
        code.includes(term) ||
        building.includes(term) ||
        room.includes(term)
      );
    });
  }, [locations, q]);

  const handleSelect = (loc: FaLocation | null) => {
    onChange(loc);
    setOpen(false);
  };

  const handleQuickAdd = async () => {
    if (!newName.trim()) {
      setAddError("Nama lokasi wajib diisi.");
      return;
    }
    setAddLoading(true);
    setAddError("");
    try {
      const created = await api<FaLocation>("POST", "/fixed-assets/locations", {
        name: newName.trim(),
        building: newBuilding.trim() || undefined,
        floor: newFloor.trim() || undefined,
        room: newRoom.trim() || undefined,
      });
      // reset
      setNewName("");
      setNewBuilding("");
      setNewFloor("");
      setNewRoom("");
      setShowAdd(false);
      // refresh
      await fetchLocations();
      onRefresh?.();
      // select it
      onChange(created);
      setOpen(false);
    } catch (err: any) {
      setAddError(err?.message || "Gagal menambahkan lokasi.");
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
          <MapPin
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
          className="w-[96vw] max-w-4xl max-h-[90vh] p-4 sm:p-6 z-[60]"
          style={Platform.select({
            web: { width: "min(96vw, 920px)", maxWidth: "920px" } as any,
          })}
        >
          <DialogHeader>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <MapPin size={20} color={colors.primary} />
                <DialogTitle>Pilih Lokasi Penempatan Aset Tetap</DialogTitle>
              </View>
              <Button
                variant={showAdd ? "outline" : "default"}
                size="sm"
                onPress={() => setShowAdd(!showAdd)}
                className="gap-1.5"
              >
                <Plus size={14} />
                <Text className="text-xs">{showAdd ? "Tutup Form" : "Tambah Lokasi"}</Text>
              </Button>
            </View>
          </DialogHeader>

          {/* Inline Quick Add Form */}
          {showAdd && (
            <View className="bg-primary/5 p-4 rounded-xl border border-primary/20 gap-3 mt-3">
              <Text className="text-xs font-bold text-foreground">Tambah Lokasi Baru</Text>
              {addError ? (
                <View className="bg-destructive/10 p-2 rounded border border-destructive/20">
                  <Text className="text-xs text-destructive">{addError}</Text>
                </View>
              ) : null}
              <View className="flex-row flex-wrap gap-2.5">
                <View className="flex-1 min-w-[200px]">
                  <Text className="text-xs font-semibold text-foreground mb-1">Nama Lokasi *</Text>
                  <TextInput
                    value={newName}
                    onChangeText={setNewName}
                    placeholder="Contoh: Ruang IT Server"
                    className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                  />
                </View>
                <View className="w-32">
                  <Text className="text-xs font-semibold text-foreground mb-1">Gedung / Area</Text>
                  <TextInput
                    value={newBuilding}
                    onChangeText={setNewBuilding}
                    placeholder="Gedung A"
                    className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                  />
                </View>
                <View className="w-24">
                  <Text className="text-xs font-semibold text-foreground mb-1">Lantai</Text>
                  <TextInput
                    value={newFloor}
                    onChangeText={setNewFloor}
                    placeholder="Lt. 2"
                    className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                  />
                </View>
                <View className="w-28">
                  <Text className="text-xs font-semibold text-foreground mb-1">Ruangan</Text>
                  <TextInput
                    value={newRoom}
                    onChangeText={setNewRoom}
                    placeholder="R. 204"
                    className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
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
              placeholder="Cari lokasi berdasarkan nama, kode, gedung, lantai, atau ruangan..."
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
              <View className="flex-1 min-w-[650px]">
                {/* Header */}
                <View className="flex-row items-center bg-muted/60 px-4 py-2.5 border-b border-border/70">
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/3 min-w-[200px]">
                    Nama Lokasi & Kode
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-36 px-2">
                    Gedung / Area
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-28 px-2 text-center">
                    Lantai
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-32 px-2">
                    Ruangan
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-24 px-2 text-center">
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
                        - Tanpa Lokasi / Belum Ditentukan -
                      </Text>
                      {!locationId && !value && (
                        <Check size={16} color={colors.primary} />
                      )}
                    </Pressable>
                  )}

                  {filteredLocations.length === 0 ? (
                    <View className="p-8 items-center justify-center">
                      <Text className="text-xs text-muted-foreground">
                        {loading
                          ? "Memuat data lokasi..."
                          : "Tidak ada lokasi penempatan yang cocok"}
                      </Text>
                    </View>
                  ) : (
                    filteredLocations.map((loc) => {
                      const isSelected =
                        selectedLocation?.id === loc.id || locationId === loc.id;
                      return (
                        <Pressable
                          key={loc.id}
                          onPress={() => handleSelect(loc)}
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
                              {loc.name}
                            </Text>
                            {loc.code ? (
                              <Text className="text-[11px] text-muted-foreground">
                                Kode: {loc.code}
                              </Text>
                            ) : null}
                          </View>

                          <View className="w-36 px-2">
                            <Text className="text-xs text-foreground">
                              {loc.building || "-"}
                            </Text>
                          </View>

                          <View className="w-28 px-2 items-center">
                            <Text className="text-xs text-foreground">
                              {loc.floor || "-"}
                            </Text>
                          </View>

                          <View className="w-32 px-2">
                            <Text className="text-xs text-foreground">
                              {loc.room || "-"}
                            </Text>
                          </View>

                          <View className="w-24 px-2 items-center">
                            <Text className="text-xs font-bold text-primary">
                              {loc._count?.assets ?? 0}
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
                                onPress={() => handleSelect(loc)}
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
