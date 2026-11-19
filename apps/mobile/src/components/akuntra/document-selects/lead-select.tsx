import * as React from "react";
import { View, Pressable, ScrollView, Platform } from "react-native";
import {
  Search,
  Users,
  ChevronDown,
  Check,
  Building2,
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

export interface LeadSelectProps {
  value?: string;
  leadId?: string | number | null;
  onChange: (lead: Row | null) => void;
  placeholder?: string;
  error?: boolean;
  allowClear?: boolean;
}

export function LeadSelect({
  value,
  leadId,
  onChange,
  placeholder = "Cari & pilih prospek...",
  error,
  allowClear = false,
}: LeadSelectProps) {
  const { data } = useApp();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  const leads: Row[] = React.useMemo(() => data.leads ?? [], [data.leads]);

  const selectedLead = React.useMemo(() => {
    if (leadId) {
      const match = leads.find((l) => String(l.id) === String(leadId));
      if (match) return match;
    }
    if (value && value !== "-") {
      const selName = (value.split(" · ")[0] ?? value.split(" - ")[0] ?? value)
        .trim()
        .toLowerCase();
      return (
        leads.find((l) => {
          const nama = String(l.nama || "").toLowerCase();
          return (
            nama === selName ||
            `${nama} - ${l.perusahaan || l.customer || "-"}`.toLowerCase() ===
              value.toLowerCase()
          );
        }) || null
      );
    }
    return null;
  }, [leads, leadId, value]);

  const displayLabel = React.useMemo(() => {
    if (selectedLead) {
      return `${selectedLead.nama} - ${selectedLead.perusahaan || selectedLead.customer || "-"}`;
    }
    return value && value !== "-" ? value : "";
  }, [selectedLead, value]);

  const filteredList = React.useMemo(() => {
    if (!q.trim()) return leads;
    const term = q.trim().toLowerCase();
    return leads.filter((l) => {
      const nama = String(l.nama || "").toLowerCase();
      const pers = String(l.perusahaan || l.customer || "").toLowerCase();
      const need = String(l.kebutuhan || l.need || "").toLowerCase();
      const telp = String(l.telepon || l.phone || "").toLowerCase();
      return (
        nama.includes(term) ||
        pers.includes(term) ||
        need.includes(term) ||
        telp.includes(term)
      );
    });
  }, [leads, q]);

  function handleSelect(lead: Row | null) {
    onChange(lead);
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
          <Users
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
                <Users size={20} color={colors.primary} />
                <DialogTitle>Pilih Prospek</DialogTitle>
              </View>
            </View>
          </DialogHeader>

          {/* Search bar */}
          <View className="bg-input border-border h-10 flex-row items-center gap-2 rounded-lg border px-3 mt-2">
            <Search size={16} color={colors.muted} />
            <Input
              value={q}
              onChangeText={setQ}
              placeholder="Cari berdasarkan nama prospek, perusahaan, telepon, atau kebutuhan..."
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
                    Nama Prospek & Kontak
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/4 min-w-[180px] px-2">
                    Perusahaan / Pelanggan
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground flex-1 min-w-[200px] px-2">
                    Kebutuhan / Prospek
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-28 px-2 text-center">
                    Tahapan / Status
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
                        - Tanpa Lead / Kosongkan -
                      </Text>
                      {!leadId && !value && (
                        <Check size={16} color={colors.primary} />
                      )}
                    </Pressable>
                  )}
                  {filteredList.map((lead) => {
                    const isSelected = selectedLead?.id === lead.id;
                    const telp = lead.telepon || lead.phone || "";
                    const email = lead.email || "";
                    const pers = lead.perusahaan || lead.customer || "-";
                    const need = lead.kebutuhan || lead.need || "-";

                    return (
                      <Pressable
                        key={lead.id}
                        onPress={() => handleSelect(lead)}
                        className={cn(
                          "p-3.5 hover:bg-primary/5 active:bg-primary/10 transition-colors flex-row items-center justify-between gap-2",
                          isSelected && "bg-primary/10",
                        )}
                      >
                        {/* Kolom 1: Nama Lead & Kontak */}
                        <View className="w-1/4 min-w-[180px]">
                          <Text
                            className={cn(
                              "text-xs font-bold text-foreground",
                              isSelected && "text-primary",
                            )}
                          >
                            {lead.nama || `Lead #${lead.id}`}
                          </Text>
                          {telp ? (
                            <Text className="text-[11px] text-muted-foreground mt-0.5">
                              {telp}
                            </Text>
                          ) : null}
                          {email ? (
                            <Text
                              className="text-[10px] text-muted-foreground"
                              numberOfLines={1}
                            >
                              {email}
                            </Text>
                          ) : null}
                        </View>

                        {/* Kolom 2: Perusahaan / Customer */}
                        <View className="w-1/4 min-w-[180px] px-2">
                          <View className="flex-row items-center gap-1.5">
                            <Building2 size={12} color={colors.muted} />
                            <Text
                              className="text-xs font-semibold text-foreground"
                              numberOfLines={1}
                            >
                              {pers}
                            </Text>
                          </View>
                          {lead.kota ? (
                            <Text className="text-[11px] text-muted-foreground mt-0.5">
                              {lead.kota}
                            </Text>
                          ) : null}
                        </View>

                        {/* Kolom 3: Kebutuhan / Prospek */}
                        <View className="flex-1 min-w-[200px] px-2">
                          <Text
                            className="text-xs text-foreground"
                            numberOfLines={2}
                          >
                            {need}
                          </Text>
                        </View>

                        {/* Kolom 4: Tahapan / Status */}
                        <View className="w-28 px-2 items-center">
                          <StatusBadge
                            status={lead.status || lead.stage || "Baru"}
                          />
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
                        Tidak ada lead / prospek yang cocok dengan &quot;{q}
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
// 4. CONTINUABLE INVOICE (LANJUTKAN TERMIN / DP) SELECT
// ==========================================
