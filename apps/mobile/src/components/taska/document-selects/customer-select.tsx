import * as React from "react";
import { View, Pressable, ScrollView, Platform } from "react-native";
import { Search, ChevronDown, Check, Building2 } from "lucide-react-native";
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
import { api } from "@/services/api";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";
import type { Row } from "@/constants/modules";

export interface CustomerSelectProps {
  value?: string;
  customerId?: string | number | null;
  onChange: (customer: Row | null) => void;
  placeholder?: string;
  error?: boolean;
  allowClear?: boolean;
  onAddNew?: () => void;
  addNewLabel?: string;
}

export function CustomerSelect({
  value,
  customerId,
  onChange,
  placeholder = "Cari & pilih customer / pelanggan...",
  error,
  allowClear = true,
  onAddNew,
  addNewLabel = "+ Tambah Customer Baru",
}: CustomerSelectProps) {
  const { data } = useApp();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [fetchedCustomers, setFetchedCustomers] = React.useState<Row[]>([]);

  React.useEffect(() => {
    let active = true;
    if (!data.customers || data.customers.length === 0) {
      api<any>("GET", "/customers")
        .then((res) => {
          if (!active) return;
          const items = Array.isArray(res) ? res : (res?.items ?? []);
          setFetchedCustomers(
            items.map((c: any) => ({
              id: String(c.id),
              name: c.name ?? "",
              nama: c.name ?? c.nama ?? c.company ?? "",
              company: c.company ?? c.name ?? "",
              kontak: c.pic ?? c.kontak ?? "-",
              pic: c.pic ?? c.kontak ?? "-",
              email: c.email ?? "",
              telepon: c.phone ?? c.telepon ?? "",
              phone: c.phone ?? c.telepon ?? "",
              kota: c.city ?? c.kota ?? "-",
              city: c.city ?? c.kota ?? "-",
              status:
                c.status === "AKTIF" || c.status === "Aktif"
                  ? "Aktif"
                  : c.status || "Aktif",
            })),
          );
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [data.customers]);

  const customerList: Row[] = React.useMemo(() => {
    if (data.customers && data.customers.length > 0) return data.customers;
    return fetchedCustomers;
  }, [data.customers, fetchedCustomers]);

  const selectedCustomer = React.useMemo(() => {
    if (customerId) {
      const match = customerList.find(
        (c) => String(c.id) === String(customerId),
      );
      if (match) return match;
    }
    if (value && value !== "-") {
      const qVal = value.trim().toLowerCase();
      return (
        customerList.find((c) => {
          const comp = String(c.company || "").toLowerCase();
          const nm = String(c.nama || c.name || "").toLowerCase();
          return (
            comp === qVal ||
            nm === qVal ||
            `${nm} (${comp})`.toLowerCase() === qVal ||
            String(c.id) === qVal
          );
        }) || null
      );
    }
    return null;
  }, [customerList, customerId, value]);

  const displayLabel = React.useMemo(() => {
    if (selectedCustomer) {
      const name =
        selectedCustomer.company ||
        selectedCustomer.nama ||
        selectedCustomer.name;
      const pic = selectedCustomer.kontak || selectedCustomer.pic;
      return pic && pic !== "-" ? `${name} (${pic})` : name;
    }
    return value && value !== "-" ? value : "";
  }, [selectedCustomer, value]);

  const filteredList = React.useMemo(() => {
    if (!q.trim()) return customerList;
    const term = q.trim().toLowerCase();
    return customerList.filter((c) => {
      const comp = String(c.company || "").toLowerCase();
      const nm = String(c.nama || c.name || "").toLowerCase();
      const pic = String(c.kontak || c.pic || "").toLowerCase();
      const kota = String(c.kota || c.city || "").toLowerCase();
      const telp = String(c.telepon || c.phone || "").toLowerCase();
      const email = String(c.email || "").toLowerCase();
      return (
        comp.includes(term) ||
        nm.includes(term) ||
        pic.includes(term) ||
        kota.includes(term) ||
        telp.includes(term) ||
        email.includes(term)
      );
    });
  }, [customerList, q]);

  function handleSelect(customer: Row | null) {
    onChange(customer);
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
          <Building2
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
            web: { width: "min(96vw, 1100px)", maxWidth: "1100px" } as any,
          })}
        >
          <DialogHeader>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Building2 size={20} color={colors.primary} />
                <DialogTitle>Pilih Customer / Pelanggan</DialogTitle>
              </View>
              {onAddNew ? (
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => {
                    setOpen(false);
                    onAddNew();
                  }}
                  className="flex-row items-center gap-1.5"
                >
                  <Text className="text-xs font-semibold text-primary">
                    {addNewLabel}
                  </Text>
                </Button>
              ) : null}
            </View>
          </DialogHeader>

          {/* Search bar */}
          <View className="bg-input border-border h-10 flex-row items-center gap-2 rounded-lg border px-3 mt-2">
            <Search size={16} color={colors.muted} />
            <Input
              value={q}
              onChangeText={setQ}
              placeholder="Cari berdasarkan nama customer, PIC/kontak, kota, email, telepon..."
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
              <View className="flex-1 min-w-[700px]">
                {/* Header */}
                <View className="flex-row items-center bg-muted/60 px-4 py-2.5 border-b border-border/70 text-xs font-bold text-muted-foreground">
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/3 min-w-[220px]">
                    Nama Pelanggan / Perusahaan
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/4 min-w-[150px] px-2">
                    Kontak / PIC
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-36 px-2">
                    Kota / Wilayah
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground flex-1 min-w-[100px] px-2 text-center">
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
                        - Tanpa Customer / Kosongkan -
                      </Text>
                      {!customerId && !value && (
                        <Check size={16} color={colors.primary} />
                      )}
                    </Pressable>
                  )}

                  {filteredList.map((c) => {
                    const isSelected = selectedCustomer?.id === c.id;
                    const name =
                      c.company || c.nama || c.name || `Customer #${c.id}`;
                    const pic = c.kontak || c.pic || "-";
                    const kota = c.kota || c.city || "-";
                    const telp = c.telepon || c.phone || "";
                    const email = c.email || "";
                    const status = c.status || "Aktif";

                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => handleSelect(c)}
                        className={cn(
                          "p-3.5 hover:bg-primary/5 active:bg-primary/10 transition-colors flex-row items-center justify-between gap-2",
                          isSelected && "bg-primary/10",
                        )}
                      >
                        <View className="w-1/3 min-w-[220px]">
                          <Text
                            className={cn(
                              "text-xs font-bold text-foreground",
                              isSelected && "text-primary",
                            )}
                          >
                            {name}
                          </Text>
                          {telp || email ? (
                            <Text className="text-[11px] text-muted-foreground mt-0.5">
                              {[telp, email].filter(Boolean).join(" · ")}
                            </Text>
                          ) : null}
                        </View>

                        <View className="w-1/4 min-w-[150px] px-2">
                          <Text className="text-xs font-semibold text-foreground">
                            {pic}
                          </Text>
                        </View>

                        <View className="w-36 px-2">
                          <Text className="text-xs text-foreground">
                            {kota}
                          </Text>
                        </View>

                        <View className="flex-1 min-w-[100px] items-center px-2">
                          <StatusBadge status={status} />
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
                        Tidak ada data customer yang cocok dengan &quot;{q}
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
// 13. SUPPLIER PO (PURCHASE ORDER) SELECT
// ==========================================
