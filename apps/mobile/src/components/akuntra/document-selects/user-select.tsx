import * as React from "react";
import { View, Pressable, ScrollView, Platform } from "react-native";
import { Search, ChevronDown, Check, UserCog } from "lucide-react-native";
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
import type { Row } from "@/constants/modules";

export interface UserSelectProps {
  value?: string;
  userId?: string | number | null;
  onChange: (user: Row | null) => void;
  placeholder?: string;
  error?: boolean;
  allowClear?: boolean;
  title?: string;
  triggerClassName?: string;
}

export function UserSelect({
  value,
  userId,
  onChange,
  placeholder = "Cari & pilih penanggung jawab...",
  error,
  allowClear = true,
  title,
  triggerClassName,
}: UserSelectProps) {
  const { data } = useApp();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [fetchedUsers, setFetchedUsers] = React.useState<Row[]>([]);

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

  const selectedUser = React.useMemo(() => {
    if (userId) {
      const match = userList.find((u) => String(u.id) === String(userId));
      if (match) return match;
    }
    if (value && value !== "-") {
      const qVal = value.trim().toLowerCase();
      const parts = value.split(" - ");
      const idPart = parts.length > 1 ? (parts[0]?.trim() ?? null) : null;
      const afterId = parts.length > 1 ? parts.slice(1).join(" - ") : value;
      const cleanName = (afterId.split("(")[0] ?? "").trim().toLowerCase();

      return (
        userList.find((u) => {
          if (idPart && String(u.id) === idPart) return true;
          const name = String(u.name || u.nama || "").toLowerCase();
          return (
            name === qVal ||
            name === cleanName ||
            String(u.id) === qVal ||
            String(u.email || "").toLowerCase() === qVal
          );
        }) || null
      );
    }
    return null;
  }, [userList, userId, value]);

  const displayLabel = React.useMemo(() => {
    if (selectedUser) {
      const roleStr =
        selectedUser.roleLabel || selectedUser.role
          ? ` (${selectedUser.roleLabel || selectedUser.role})`
          : "";
      return `${selectedUser.name || selectedUser.nama}${roleStr}`;
    }
    return value && value !== "-" ? value : "";
  }, [selectedUser, value]);

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
          triggerClassName,
        )}
      >
        <View className="flex-1 mr-2 flex-row items-center gap-2">
          <UserCog
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
            web: { width: "min(96vw, 1050px)", maxWidth: "1050px" } as any,
          })}
        >
          <DialogHeader>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <UserCog size={20} color={colors.primary} />
                <DialogTitle>
                  {title || "Pilih Penanggung Jawab / User"}
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
              placeholder="Cari berdasarkan nama pengguna, email, role, atau gudang..."
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
                <View className="flex-row items-center bg-muted/60 px-4 py-2.5 border-b border-border/70 text-xs font-bold text-muted-foreground">
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
                        - Tanpa Penanggung Jawab -
                      </Text>
                      {!userId && !value && (
                        <Check size={16} color={colors.primary} />
                      )}
                    </Pressable>
                  )}

                  {filteredList.map((u) => {
                    const isSelected = selectedUser?.id === u.id;
                    const name = u.name || u.nama || `User #${u.id}`;
                    const email = u.email || "-";
                    const role = u.roleLabel || u.role || "Staf";
                    const gudang = u.gudang || "-";
                    const status = u.status || "Aktif";

                    return (
                      <Pressable
                        key={u.id}
                        onPress={() => handleSelect(u)}
                        className={cn(
                          "p-3.5 hover:bg-primary/5 active:bg-primary/10 transition-colors flex-row items-center justify-between gap-2",
                          isSelected && "bg-primary/10",
                        )}
                      >
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
                        Tidak ada data pengguna yang cocok dengan &quot;{q}
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
// 11. USER MULTI SELECT (ANGGOTA TIM / PESERTA)
// ==========================================
