import * as React from "react";
import { Platform, View, Pressable, ScrollView, TextInput } from "react-native";
import { Search, ChevronDown, Check, CirclePlus, Globe, Mail } from "lucide-react-native";
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
import { useApp } from "@/store/app-store";
import type { SubProvider } from "./types";

export function SubscriptionProviderSelect({
  value,
  providers,
  onChange,
  onRefresh,
  canCreate = true,
  placeholder = "Cari & pilih provider...",
  error,
  allowClear = false,
  className,
}: {
  value?: number | null;
  providers: SubProvider[];
  onChange: (provider: SubProvider | null) => void;
  onRefresh?: () => void;
  canCreate?: boolean;
  placeholder?: string;
  error?: boolean;
  allowClear?: boolean;
  className?: string;
}) {
  const { toast } = useApp();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [showAdd, setShowAdd] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newWebsite, setNewWebsite] = React.useState("");
  const [newEmail, setNewEmail] = React.useState("");
  const selected = providers.find((p) => p.id === value) ?? null;
  const filtered = providers.filter((p) => {
    const text = `${p.code} ${p.name} ${p.supportEmail ?? ""} ${p.website ?? ""}`.toLowerCase();
    return text.includes(q.toLowerCase());
  });

  function select(provider: SubProvider | null) {
    onChange(provider);
    setOpen(false);
    setQ("");
  }

  async function quickAdd() {
    if (!newName.trim()) {
      toast("Nama provider wajib diisi", "danger");
      return;
    }
    setSaving(true);
    try {
      const created = await api.post<SubProvider>("/subscriptions/providers", {
        name: newName.trim(),
        website: newWebsite.trim() || undefined,
        supportEmail: newEmail.trim() || undefined,
      });
      toast("Provider berhasil ditambahkan");
      setNewName("");
      setNewWebsite("");
      setNewEmail("");
      setShowAdd(false);
      onRefresh?.();
      onChange(created);
      setOpen(false);
    } catch (e: any) {
      toast(e?.message ?? "Gagal menambah provider", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className={cn(
          "h-11 flex-row items-center justify-between gap-2 rounded-lg border border-border/80 bg-card px-3",
          error && "border-danger",
          className,
        )}
      >
        <View className="flex-1 flex-row items-center gap-2">
          <Globe size={15} color={selected ? colors.primary : colors.muted} />
          <Text
            className={cn("flex-1 text-sm", selected ? "text-foreground font-medium" : "text-muted-foreground")}
            numberOfLines={1}
          >
            {selected ? `${selected.name}${selected.code ? ` · ${selected.code}` : ""}` : placeholder}
          </Text>
        </View>
        <ChevronDown size={16} color={colors.muted} />
      </Pressable>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="w-[96vw] max-w-5xl lg:max-w-6xl max-h-[88vh]"
          style={Platform.select({
            web: { width: "min(96vw, 1050px)", maxWidth: "1050px" } as any,
          })}
        >
          <DialogHeader>
            <DialogTitle>Pilih Provider Langganan</DialogTitle>
          </DialogHeader>

          <View className="mt-3 flex-row flex-wrap items-center gap-2">
            {canCreate ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onPress={() => setShowAdd((v) => !v)}
              >
                <CirclePlus size={14} color={colors.primary} />
                <Text className="text-xs">Provider Baru</Text>
              </Button>
            ) : null}
            {allowClear ? (
              <Button variant="ghost" size="sm" onPress={() => select(null)}>
                <Text className="text-xs">Tanpa Provider</Text>
              </Button>
            ) : null}
          </View>

          {showAdd && canCreate ? (
            <View className="mt-3 gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <Text className="text-xs font-bold">Tambah Provider Baru</Text>
              <View className="flex-row flex-wrap gap-2.5">
                <View className="min-w-[220px] flex-1 gap-1">
                  <Text className="text-xs font-semibold">Nama Provider *</Text>
                  <TextInput
                    value={newName}
                    onChangeText={setNewName}
                    placeholder="Contoh: Amazon Web Services"
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </View>
                <View className="min-w-[180px] flex-1 gap-1">
                  <Text className="text-xs font-semibold">Website</Text>
                  <TextInput
                    value={newWebsite}
                    onChangeText={setNewWebsite}
                    placeholder="https://..."
                    autoCapitalize="none"
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </View>
                <View className="min-w-[180px] flex-1 gap-1">
                  <Text className="text-xs font-semibold">Email Support</Text>
                  <TextInput
                    value={newEmail}
                    onChangeText={setNewEmail}
                    placeholder="support@provider.com"
                    autoCapitalize="none"
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </View>
              </View>
              <View className="flex-row justify-end gap-2">
                <Button variant="outline" size="sm" onPress={() => setShowAdd(false)} disabled={saving}>
                  <Text className="text-xs">Batal</Text>
                </Button>
                <Button size="sm" onPress={quickAdd} disabled={saving}>
                  <Text className="text-xs">{saving ? "Menyimpan..." : "Simpan & Pilih"}</Text>
                </Button>
              </View>
            </View>
          ) : null}

          <View className="mt-3 h-10 flex-row items-center gap-2 rounded-lg border border-border bg-input px-3">
            <Search size={16} color={colors.muted} />
            <Input
              value={q}
              onChangeText={setQ}
              placeholder="Cari nama, kode, website, atau email..."
              autoFocus
              className="h-9 flex-1 border-0 bg-transparent px-0 shadow-none"
            />
          </View>

          <View className="mt-3 flex-1 overflow-hidden rounded-xl border border-border/80 bg-card">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: "100%" }}>
              <View className="min-w-[640px] flex-1">
                <View className="flex-row items-center border-b border-border/70 bg-muted/60 px-4 py-2.5">
                  <Text className="w-24 text-[11px] font-bold text-muted-foreground">Kode</Text>
                  <Text className="min-w-[200px] flex-1 text-[11px] font-bold text-muted-foreground">Provider</Text>
                  <Text className="w-52 px-2 text-[11px] font-bold text-muted-foreground">Kontak</Text>
                  <Text className="w-20 text-center text-[11px] font-bold text-muted-foreground">Langganan</Text>
                  <Text className="w-16 text-center text-[11px] font-bold text-muted-foreground">Aksi</Text>
                </View>
                <ScrollView className="max-h-[45vh]" contentContainerClassName="divide-y divide-border/40">
                  {filtered.length === 0 ? (
                    <View className="items-center justify-center p-8">
                      <Text className="text-xs text-muted-foreground">Tidak ada provider yang cocok</Text>
                    </View>
                  ) : (
                    filtered.map((provider) => {
                      const isSelected = provider.id === value;
                      return (
                        <Pressable
                          key={provider.id}
                          onPress={() => select(provider)}
                          className={cn("flex-row items-center px-4 py-3", isSelected && "bg-primary/5")}
                        >
                          <Text className="w-24 text-xs font-semibold text-muted-foreground">{provider.code}</Text>
                          <View className="min-w-[200px] flex-1 gap-0.5">
                            <Text className={cn("text-sm font-semibold", isSelected && "text-primary")}>
                              {provider.name}
                            </Text>
                            {provider.website ? (
                              <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                                {provider.website}
                              </Text>
                            ) : null}
                          </View>
                          <View className="w-52 gap-0.5 px-2">
                            {provider.supportEmail ? (
                              <View className="flex-row items-center gap-1">
                                <Mail size={11} color={colors.muted} />
                                <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                                  {provider.supportEmail}
                                </Text>
                              </View>
                            ) : (
                              <Text className="text-[11px] text-muted-foreground">-</Text>
                            )}
                            {provider.supportPhone ? (
                              <Text className="text-[11px] text-muted-foreground">{provider.supportPhone}</Text>
                            ) : null}
                          </View>
                          <View className="w-20 items-center">
                            <Text className="text-xs font-bold text-primary">{provider._count?.subscriptions ?? 0}</Text>
                          </View>
                          <View className="w-16 items-center">
                            {isSelected ? (
                              <View className="rounded-full bg-primary/10 p-1">
                                <Check size={14} color={colors.primary} />
                              </View>
                            ) : (
                              <Button variant="outline" size="sm" className="h-7 px-2.5" onPress={() => select(provider)}>
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
