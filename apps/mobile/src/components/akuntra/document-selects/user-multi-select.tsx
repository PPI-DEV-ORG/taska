import * as React from "react";
import { View, Pressable, ScrollView, Platform } from "react-native";
import { Search, Users, ChevronDown, Check, X } from "lucide-react-native";
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
import { api } from "@/services/api";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import type { Row } from "@/constants/modules";

export interface UserMultiSelectProps {
  values?: string[] | string;
  onChange: (names: string[], selectedUsers?: Row[]) => void;
  placeholder?: string;
  error?: boolean;
  title?: string;
  triggerClassName?: string;
}

export function UserMultiSelect({
  values = [],
  onChange,
  placeholder = "Pilih anggota tim / peserta...",
  error,
  title,
  triggerClassName,
}: UserMultiSelectProps) {
  const { data } = useApp();
  const { isMobile } = useBreakpoint();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [fetchedUsers, setFetchedUsers] = React.useState<Row[]>([]);

  const normalizedValues = React.useMemo(() => {
    if (Array.isArray(values)) return values.filter(Boolean);
    if (typeof values === "string" && values.trim()) {
      return values
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }, [values]);

  const [selectedNames, setSelectedNames] = React.useState<string[]>(
    () => normalizedValues,
  );

  React.useEffect(() => {
    let active = true;
    const needsFetch =
      !data.users ||
      data.users.length === 0 ||
      data.users.every((u: any) => !u.email);
    if (needsFetch) {
      api<any>("GET", "/users/options")
        .then((res) => {
          if (!active) return;
          const items = Array.isArray(res) ? res : (res?.items ?? []);
          setFetchedUsers(
            items.map((u: any) => ({
              id: String(u.id),
              name: u.name,
              nama: u.name,
              email: u.email ?? "",
              roleLabel: u.position || u.roleLabel || u.role || "Staf",
              gudang: u.warehouseName ?? u.gudang ?? "-",
              status: u.status ?? "Aktif",
            })),
          );
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [data.users]);

  const userList: Row[] = React.useMemo(() => {
    if (
      data.users &&
      data.users.length > 0 &&
      !data.users.every((u: any) => !u.email)
    )
      return data.users;
    return fetchedUsers;
  }, [data.users, fetchedUsers]);

  const filteredList = React.useMemo(() => {
    if (!q.trim()) return userList;
    const term = q.trim().toLowerCase();
    return userList.filter((u) => {
      const name = String(u.name || u.nama || "").toLowerCase();
      const email = String(u.email || "").toLowerCase();
      const role = String(u.roleLabel || u.role || "").toLowerCase();
      const gudang = String(u.gudang || "").toLowerCase();
      return (
        name.includes(term) ||
        email.includes(term) ||
        role.includes(term) ||
        gudang.includes(term)
      );
    });
  }, [userList, q]);

  const cleanNorm = (s: string) =>
    s ? (s.split("(")[0] ?? "").trim().toLowerCase() : "";

  function isUserSelected(name: string) {
    return selectedNames.some((sn) => cleanNorm(sn) === cleanNorm(name));
  }

  function toggleUser(name: string) {
    setSelectedNames((prev) => {
      const exists = prev.some((n) => cleanNorm(n) === cleanNorm(name));
      if (exists) {
        return prev.filter((n) => cleanNorm(n) !== cleanNorm(name));
      }
      return [...prev, name];
    });
  }

  function handleSave() {
    const matchedUsers = userList.filter((u) => {
      const name = u.name || u.nama;
      return selectedNames.some((sn) => cleanNorm(sn) === cleanNorm(name));
    });
    onChange(selectedNames, matchedUsers);
    setOpen(false);
  }

  function removeTag(name: string) {
    const next = normalizedValues.filter(
      (n) => cleanNorm(n) !== cleanNorm(name),
    );
    onChange(next);
  }

  return (
    <>
      <Pressable
        onPress={() => {
          setSelectedNames(normalizedValues);
          setQ("");
          setOpen(true);
        }}
        className={cn(
          "bg-input border-border min-h-11 flex-row flex-wrap items-center justify-between rounded-lg border p-2 w-full gap-1.5",
          error && "border-danger",
          triggerClassName,
        )}
      >
        <View className="flex-1 flex-row flex-wrap items-center gap-1.5">
          <Users
            size={16}
            color={normalizedValues.length > 0 ? colors.primary : colors.muted}
          />
          {normalizedValues.length === 0 ? (
            <Text className="text-base md:text-sm text-muted-foreground">
              {placeholder}
            </Text>
          ) : (
            normalizedValues.map((name) => (
              <View
                key={name}
                className="bg-primary/15 border border-primary/30 rounded-md px-2 py-0.5 flex-row items-center gap-1"
              >
                <Text className="text-xs font-semibold text-primary">
                  {name}
                </Text>
                <Pressable
                  hitSlop={8}
                  onPress={(e) => {
                    e.stopPropagation();
                    removeTag(name);
                  }}
                >
                  <X size={12} color={colors.primary} />
                </Pressable>
              </View>
            ))
          )}
        </View>
        <ChevronDown size={16} color={colors.muted} />
      </Pressable>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="w-[96vw] max-w-5xl lg:max-w-6xl max-h-[90vh] p-4 sm:p-6"
          style={Platform.select({
            web: { width: "min(96vw, 1050px)", maxWidth: "1050px" } as any,
          })}
        >
          <DialogHeader className="pr-8">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Users size={20} color={colors.primary} />
                <DialogTitle>
                  {title ||
                    `Pilih Anggota Tim / Peserta (${selectedNames.length} dipilih)`}
                </DialogTitle>
              </View>
            </View>
          </DialogHeader>

          {/* Search bar & quick actions */}
          <View className="flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-2">
            <View className="bg-input border-border h-10 flex-row items-center gap-2 rounded-lg border px-3 flex-1">
              <Search size={16} color={colors.muted} />
              <Input
                value={q}
                onChangeText={setQ}
                placeholder="Cari berdasarkan nama, email, role, atau gudang..."
                autoFocus
                className="h-9 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent outline-none ring-0 web:focus-visible:ring-0 web:focus-visible:outline-none"
              />
            </View>
            <View className="flex-row items-center gap-1.5 self-end sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-2.5 sm:h-10 sm:px-3"
                onPress={() => {
                  const allNames = filteredList.map(
                    (u) => u.name || u.nama || `User #${u.id}`,
                  );
                  setSelectedNames(
                    Array.from(new Set([...selectedNames, ...allNames])),
                  );
                }}
              >
                <Text className="text-xs font-semibold">
                  Semua ({filteredList.length})
                </Text>
              </Button>
              {selectedNames.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 px-2.5 sm:h-10 sm:px-3"
                  onPress={() => setSelectedNames([])}
                >
                  <Text className="text-xs text-muted-foreground font-semibold">
                    Reset
                  </Text>
                </Button>
              )}
            </View>
          </View>

          {/* Cards for Mobile vs Table for Desktop */}
          {isMobile ? (
            <ScrollView
              className="max-h-[55vh] mt-3"
              contentContainerClassName="gap-2 pb-2"
              showsVerticalScrollIndicator={false}
            >
              {filteredList.map((u) => {
                const name = u.name || u.nama || `User #${u.id}`;
                const isSelected = isUserSelected(name);
                const email = u.email || "-";
                const role = u.roleLabel || u.role || "Staf";
                const gudang = u.gudang || "-";
                const status = u.status || "Aktif";

                return (
                  <Pressable
                    key={u.id}
                    onPress={() => toggleUser(name)}
                    className={cn(
                      "p-3 rounded-xl border border-border/80 bg-card gap-1.5 flex-row items-center justify-between active:scale-[0.99] transition-transform",
                      isSelected && "border-primary/60 bg-primary/[0.04]",
                    )}
                  >
                    <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
                      <View
                        className={cn(
                          "size-5 rounded border items-center justify-center shrink-0",
                          isSelected
                            ? "bg-primary border-primary"
                            : "border-border/80 bg-card",
                        )}
                      >
                        {isSelected && <Check size={12} color="#ffffff" />}
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text
                          className={cn(
                            "text-xs font-bold text-foreground",
                            isSelected && "text-primary",
                          )}
                          numberOfLines={1}
                        >
                          {name}
                        </Text>
                        <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                          {role} {gudang && gudang !== "-" ? `· ${gudang}` : ""}
                        </Text>
                      </View>
                    </View>
                    <StatusBadge status={status} />
                  </Pressable>
                );
              })}

              {filteredList.length === 0 && (
                <View className="p-8 items-center justify-center gap-2">
                  <Text className="text-sm font-semibold text-muted-foreground text-center">
                    Tidak ada data pengguna yang cocok dengan &quot;{q}&quot;
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
              <View className="flex-1 min-w-[650px]">
                {/* Header */}
                <View className="flex-row items-center bg-muted/60 px-4 py-2.5 border-b border-border/70 text-xs font-bold text-muted-foreground">
                  <Text className="text-[11px] font-bold text-muted-foreground w-12 text-center">
                    Pilih
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/3 min-w-[200px]">
                    Nama & Email
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/4 min-w-[150px] px-2">
                    Peran / Role
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-36 px-2">
                    Gudang / Cabang
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground flex-1 min-w-[100px] px-2 text-center">
                    Status
                  </Text>
                </View>

                {/* Rows */}
                <ScrollView
                  className="max-h-[45vh]"
                  contentContainerClassName="divide-y divide-border/40"
                >
                  {filteredList.map((u) => {
                    const name = u.name || u.nama || `User #${u.id}`;
                    const isSelected = isUserSelected(name);
                    const email = u.email || "-";
                    const role = u.roleLabel || u.role || "Staf";
                    const gudang = u.gudang || "-";
                    const status = u.status || "Aktif";

                    return (
                      <Pressable
                        key={u.id}
                        onPress={() => toggleUser(name)}
                        className={cn(
                          "p-3 hover:bg-primary/5 active:bg-primary/10 transition-colors flex-row items-center justify-between gap-2",
                          isSelected && "bg-primary/10",
                        )}
                      >
                        <View className="w-12 items-center justify-center">
                          <View
                            className={cn(
                              "size-4 rounded items-center justify-center border",
                              isSelected
                                ? "bg-primary border-primary"
                                : "border-muted-foreground/50 bg-transparent",
                            )}
                          >
                            {isSelected ? (
                              <Check size={11} color={colors.background} />
                            ) : null}
                          </View>
                        </View>

                        <View className="w-1/3 min-w-[200px]">
                          <Text
                            className={cn(
                              "text-xs font-bold text-foreground",
                              isSelected && "text-primary",
                            )}
                          >
                            {name}
                          </Text>
                          <Text className="text-[11px] text-muted-foreground">
                            {email}
                          </Text>
                        </View>

                        <View className="w-1/4 min-w-[150px] px-2">
                          <Text className="text-xs font-semibold text-foreground">
                            {role}
                          </Text>
                        </View>

                        <View className="w-36 px-2">
                          <Text className="text-xs text-foreground">
                            {gudang}
                          </Text>
                        </View>

                        <View className="flex-1 min-w-[100px] items-center px-2">
                          <StatusBadge status={status} />
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </ScrollView>
          </View>
        )}

          <View className="flex-row items-center justify-between mt-3 pt-2 border-t border-border/70">
            <Text className="text-xs text-muted-foreground">
              {selectedNames.length} anggota terpilih
            </Text>
            <View className="flex-row items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onPress={() => setOpen(false)}
              >
                <Text>Batal</Text>
              </Button>
              <Button size="sm" onPress={handleSave}>
                <Text>Terapkan Pilihan ({selectedNames.length})</Text>
              </Button>
            </View>
          </View>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ==========================================
// 12. CUSTOMER SELECT
// ==========================================
