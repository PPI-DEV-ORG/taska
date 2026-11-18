import * as React from "react";
import { Platform, View, Pressable, ScrollView, TextInput } from "react-native";
import { Search, ChevronDown, Check, CirclePlus, FolderKanban } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/taska/dialogs";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import type { SubCategory } from "./types";
import { BILLING_CYCLE_OPTIONS, CYCLE_LABEL } from "./subscription-utils";

export function SubscriptionCategorySelect({
  value,
  categories,
  onChange,
  onRefresh,
  canCreate = true,
  placeholder = "Cari & pilih kategori langganan...",
  error,
  className,
}: {
  value?: number | null;
  categories: SubCategory[];
  onChange: (category: SubCategory | null) => void;
  onRefresh?: () => void;
  canCreate?: boolean;
  placeholder?: string;
  error?: boolean;
  className?: string;
}) {
  const { toast } = useApp();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [showAdd, setShowAdd] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newCode, setNewCode] = React.useState("");
  const [newCycle, setNewCycle] = React.useState("ANNUAL");
  const [newExpense, setNewExpense] = React.useState("6122");
  const selected = categories.find((c) => c.id === value) ?? null;
  const filtered = categories.filter((c) => {
    const text = `${c.code} ${c.name} ${c.subcategory ?? ""}`.toLowerCase();
    return text.includes(q.toLowerCase());
  });

  function select(category: SubCategory | null) {
    onChange(category);
    setOpen(false);
    setQ("");
  }

  async function quickAdd() {
    if (!newName.trim()) {
      toast("Nama kategori wajib diisi", "danger");
      return;
    }
    setSaving(true);
    try {
      const created = await api.post<SubCategory>("/subscriptions/categories", {
        code: newCode.trim() || undefined,
        name: newName.trim(),
        defaultBillingCycle: newCycle,
        expenseAccountCode: newExpense || "6122",
        prepaidAccountCode: "1401",
      });
      toast("Kategori berhasil ditambahkan");
      setNewName("");
      setNewCode("");
      setShowAdd(false);
      onRefresh?.();
      onChange(created);
      setOpen(false);
    } catch (e: any) {
      toast(e?.message ?? "Gagal menambah kategori", "danger");
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
          <FolderKanban size={15} color={selected ? colors.primary : colors.muted} />
          <Text
            className={cn("flex-1 text-sm", selected ? "text-foreground font-medium" : "text-muted-foreground")}
            numberOfLines={1}
          >
            {selected ? `${selected.name} · ${selected.code}` : placeholder}
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
            <DialogTitle>Pilih Kategori Langganan</DialogTitle>
          </DialogHeader>

          <View className="mt-3 flex-row flex-wrap items-center gap-2">
            {canCreate ? (
              <Button variant="outline" size="sm" className="gap-1.5" onPress={() => setShowAdd((v) => !v)}>
                <CirclePlus size={14} color={colors.primary} />
                <Text className="text-xs">Kategori Baru</Text>
              </Button>
            ) : null}
          </View>

          {showAdd && canCreate ? (
            <View className="mt-3 gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <Text className="text-xs font-bold">Tambah Kategori Baru</Text>
              <View className="flex-row flex-wrap gap-2.5">
                <View className="min-w-[200px] flex-1 gap-1">
                  <Text className="text-xs font-semibold">Nama Kategori *</Text>
                  <TextInput
                    value={newName}
                    onChangeText={setNewName}
                    placeholder="Contoh: Domain & DNS"
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </View>
                <View className="w-28 gap-1">
                  <Text className="text-xs font-semibold">Kode</Text>
                  <TextInput
                    value={newCode}
                    onChangeText={(v) => setNewCode(v.toUpperCase())}
                    placeholder="DOM"
                    autoCapitalize="characters"
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </View>
                <View className="w-44 gap-1">
                  <Text className="text-xs font-semibold">Siklus Default</Text>
                  <SearchableSelect
                    value={CYCLE_LABEL[newCycle] ?? newCycle}
                    options={BILLING_CYCLE_OPTIONS.map((x) => x.label)}
                    onChange={(label) => {
                      const found = BILLING_CYCLE_OPTIONS.find((x) => x.label === label);
                      setNewCycle(found?.value ?? "ANNUAL");
                    }}
                    className="h-10 rounded-lg border-border/80 bg-card"
                  />
                </View>
                <View className="w-36 gap-1">
                  <Text className="text-xs font-semibold">Akun Beban</Text>
                  <TextInput
                    value={newExpense}
                    onChangeText={setNewExpense}
                    placeholder="6122"
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
              placeholder="Cari kategori berdasarkan nama, kode, atau subkategori..."
              autoFocus
              className="h-9 flex-1 border-0 bg-transparent px-0 shadow-none"
            />
          </View>

          <View className="mt-3 flex-1 overflow-hidden rounded-xl border border-border/80 bg-card">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: "100%" }}>
              <View className="min-w-[620px] flex-1">
                <View className="flex-row items-center border-b border-border/70 bg-muted/60 px-4 py-2.5">
                  <Text className="min-w-[220px] flex-1 text-[11px] font-bold text-muted-foreground">Kategori</Text>
                  <Text className="w-28 px-2 text-[11px] font-bold text-muted-foreground">Kode</Text>
                  <Text className="w-36 px-2 text-[11px] font-bold text-muted-foreground">Siklus Default</Text>
                  <Text className="w-32 px-2 text-[11px] font-bold text-muted-foreground">Akun Beban</Text>
                  <Text className="w-20 text-center text-[11px] font-bold text-muted-foreground">Dipakai</Text>
                  <Text className="w-16 text-center text-[11px] font-bold text-muted-foreground">Aksi</Text>
                </View>
                <ScrollView className="max-h-[45vh]" contentContainerClassName="divide-y divide-border/40">
                  {filtered.length === 0 ? (
                    <View className="items-center justify-center p-8">
                      <Text className="text-xs text-muted-foreground">Tidak ada kategori yang cocok</Text>
                    </View>
                  ) : (
                    filtered.map((category) => {
                      const isSelected = category.id === value;
                      return (
                        <Pressable
                          key={category.id}
                          onPress={() => select(category)}
                          className={cn("flex-row items-center px-4 py-3", isSelected && "bg-primary/5")}
                        >
                          <View className="min-w-[220px] flex-1 gap-0.5">
                            <Text className={cn("text-sm font-semibold", isSelected && "text-primary")}>
                              {category.name}
                            </Text>
                            <Text className="text-[11px] text-muted-foreground">
                              {category.subcategory || "Tanpa subkategori"}
                            </Text>
                          </View>
                          <Text className="w-28 px-2 text-xs font-medium text-muted-foreground">{category.code}</Text>
                          <Text className="w-36 px-2 text-xs">{CYCLE_LABEL[category.defaultBillingCycle] ?? category.defaultBillingCycle}</Text>
                          <Text className="w-32 px-2 text-xs">{category.expenseAccountCode}</Text>
                          <Text className="w-20 text-center text-xs font-bold text-primary">
                            {category._count?.subscriptions ?? 0}
                          </Text>
                          <View className="w-16 items-center">
                            {isSelected ? (
                              <View className="rounded-full bg-primary/10 p-1">
                                <Check size={14} color={colors.primary} />
                              </View>
                            ) : (
                              <Button variant="outline" size="sm" className="h-7 px-2.5" onPress={() => select(category)}>
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
