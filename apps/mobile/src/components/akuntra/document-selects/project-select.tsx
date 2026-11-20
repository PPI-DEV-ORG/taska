import * as React from "react";
import { View, Pressable, ScrollView, Platform } from "react-native";
import {
  Search,
  ChevronDown,
  Check,
  Building2,
  Tag,
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
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";
import { rupiah } from "@/lib/format";
import type { Row } from "@/constants/modules";

export interface ProjectSelectProps {
  value?: string;
  projectId?: string | number | null;
  onChange: (project: Row | null) => void;
  placeholder?: string;
  error?: boolean;
  allowClear?: boolean;
}

export function ProjectSelect({
  value,
  projectId,
  onChange,
  placeholder = "Pilih alokasi proyek jika ada...",
  error,
  allowClear = true,
}: ProjectSelectProps) {
  const { isMobile } = useBreakpoint();
  const { data } = useApp();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  const projects: Row[] = React.useMemo(
    () => data.projects ?? [],
    [data.projects],
  );

  const selectedProject = React.useMemo(() => {
    if (projectId) {
      const match = projects.find((p) => String(p.id) === String(projectId));
      if (match) return match;
    }
    if (value && value !== "-") {
      const qVal = value.trim().toLowerCase();
      return (
        projects.find((p) => {
          const name = String(p.nama || p.name || "").toLowerCase();
          const cust = String(p.customer || "").toLowerCase();
          return (
            name === qVal ||
            `${name} (${cust})`.toLowerCase() === qVal ||
            String(p.id) === qVal
          );
        }) || null
      );
    }
    return null;
  }, [projects, projectId, value]);

  const displayLabel = React.useMemo(() => {
    if (selectedProject) {
      const cust = selectedProject.customer
        ? ` (${selectedProject.customer})`
        : "";
      return `${selectedProject.nama || selectedProject.name || `Proyek #${selectedProject.id}`}${cust}`;
    }
    return value && value !== "-" ? value : "";
  }, [selectedProject, value]);

  const filteredList = React.useMemo(() => {
    if (!q.trim()) return projects;
    const term = q.trim().toLowerCase();
    return projects.filter((p) => {
      const name = String(p.nama || p.name || "").toLowerCase();
      const cust = String(p.customer || "").toLowerCase();
      const jenis = String(p.jenis || "").toLowerCase();
      const status = String(p.status || "").toLowerCase();
      return (
        name.includes(term) ||
        cust.includes(term) ||
        jenis.includes(term) ||
        status.includes(term)
      );
    });
  }, [projects, q]);

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
          <Briefcase
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
                <Briefcase size={20} color={colors.primary} />
                <DialogTitle>Pilih Alokasi Proyek</DialogTitle>
              </View>
            </View>
          </DialogHeader>

          {/* Search bar */}
          <View className="bg-input border-border h-10 flex-row items-center gap-2 rounded-lg border px-3 mt-2">
            <Search size={16} color={colors.muted} />
            <Input
              value={q}
              onChangeText={setQ}
              placeholder="Cari berdasarkan nama proyek, pelanggan, atau jenis proyek..."
              autoFocus
              className="h-9 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent outline-none ring-0 web:focus-visible:ring-0 web:focus-visible:outline-none"
            />
          </View>

          {/* Table */}
          {isMobile ? (
            /* Mobile Card View */
            <ScrollView className="max-h-[58vh] mt-3" contentContainerClassName="gap-2 pb-2">
              {allowClear && (
                <Pressable
                  onPress={() => handleSelect(null)}
                  className={cn(
                    "p-3 rounded-xl border border-dashed border-border/80 flex-row items-center justify-between",
                    !projectId && !value ? "bg-primary/10 border-primary" : "bg-card hover:bg-muted/30"
                  )}
                >
                  <Text className="text-xs font-semibold text-muted-foreground">
                    - Tanpa Alokasi Proyek (Non-Proyek / Umum) -
                  </Text>
                  {!projectId && !value && <Check size={16} color={colors.primary} />}
                </Pressable>
              )}

              {filteredList.map((p) => {
                const isSelected = selectedProject?.id === p.id;
                const name = p.nama || p.name || `Proyek #${p.id}`;
                const jenis = p.jenis || "Proyek";
                const cust = p.customer || p.klien || "-";
                const totalVal = Number(p.nilai || p.total || p.budget || 0);
                const progres = p.progres != null ? `${p.progres}%` : "-";

                return (
                  <Pressable
                    key={p.id}
                    onPress={() => handleSelect(p)}
                    className={cn(
                      "p-3.5 rounded-xl border border-border/80 bg-card active:bg-panel transition-colors gap-2 shadow-xs",
                      isSelected ? "border-primary bg-primary/5" : ""
                    )}
                  >
                    <View className="flex-row items-start justify-between gap-2">
                      <View className="flex-1">
                        <Text className={cn("text-sm font-bold", isSelected ? "text-primary" : "text-foreground")}>
                          {name}
                        </Text>
                        <View className="flex-row items-center gap-1.5 mt-0.5">
                          <Tag size={10} color={colors.muted} />
                          <Text className="text-[11px] text-muted-foreground">{jenis}</Text>
                        </View>
                      </View>
                      <StatusBadge status={p.status || "Berjalan"} />
                    </View>

                    <View className="flex-row items-center justify-between border-t border-border/40 pt-2 mt-0.5">
                      <View className="flex-1 mr-2">
                        <Text className="text-xs font-medium text-foreground" numberOfLines={1}>
                          Klien: <Text className="font-semibold">{cust}</Text>
                        </Text>
                        <View className="flex-row items-center gap-2 mt-0.5">
                          {totalVal > 0 ? (
                            <Text className="text-[11px] font-semibold text-primary">
                              {rupiah(totalVal)}
                            </Text>
                          ) : null}
                          <Text className="text-[10px] text-muted-foreground">
                            Progres: {progres}
                          </Text>
                        </View>
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
                    Tidak ada proyek yang cocok dengan &quot;{q}&quot;
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
                      Nama Proyek & Jenis
                    </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/4 min-w-[180px] px-2">
                    Pelanggan
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-36 text-right px-2">
                    Nilai Kontrak
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground flex-1 min-w-[140px] px-2 text-center">
                    Progres & Status
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
                        - Tanpa Alokasi Proyek (Non-Proyek / Umum) -
                      </Text>
                      {!projectId && !value && (
                        <Check size={16} color={colors.primary} />
                      )}
                    </Pressable>
                  )}

                  {filteredList.map((p) => {
                    const isSelected = selectedProject?.id === p.id;
                    const name = p.nama || p.name || `Proyek #${p.id}`;
                    const jenis = p.jenis || "Proyek";
                    const cust = p.customer || p.klien || "-";
                    const totalVal = Number(
                      p.nilai || p.total || p.budget || 0,
                    );
                    const progres = p.progres != null ? `${p.progres}%` : "-";

                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => handleSelect(p)}
                        className={cn(
                          "p-3.5 hover:bg-primary/5 active:bg-primary/10 transition-colors flex-row items-center justify-between gap-2",
                          isSelected && "bg-primary/10",
                        )}
                      >
                        {/* Kolom 1: Nama Proyek & Jenis */}
                        <View className="w-1/3 min-w-[220px]">
                          <Text
                            className={cn(
                              "text-xs font-bold text-foreground",
                              isSelected && "text-primary",
                            )}
                          >
                            {name}
                          </Text>
                          <View className="flex-row items-center gap-1 mt-0.5">
                            <Tag size={10} color={colors.muted} />
                            <Text className="text-[11px] text-muted-foreground">
                              {jenis}
                            </Text>
                          </View>
                        </View>

                        {/* Kolom 2: Customer / Klien */}
                        <View className="w-1/4 min-w-[180px] px-2">
                          <View className="flex-row items-center gap-1.5">
                            <Building2 size={12} color={colors.muted} />
                            <Text
                              className="text-xs font-semibold text-foreground"
                              numberOfLines={1}
                            >
                              {cust}
                            </Text>
                          </View>
                        </View>

                        {/* Kolom 3: Nilai Kontrak */}
                        <View className="w-36 items-end px-2">
                          <Text className="text-xs font-bold text-foreground">
                            {totalVal > 0 ? rupiah(totalVal) : "-"}
                          </Text>
                        </View>

                        {/* Kolom 4: Progres & Status */}
                        <View className="flex-1 min-w-[140px] px-2 items-center">
                          <StatusBadge status={p.status || "Berjalan"} />
                          <Text className="text-[10px] text-muted-foreground mt-0.5">
                            Progres: {progres}
                          </Text>
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
                        Tidak ada proyek yang cocok dengan &quot;{q}&quot;
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
// 6. SURVEY SELECT
// ==========================================
