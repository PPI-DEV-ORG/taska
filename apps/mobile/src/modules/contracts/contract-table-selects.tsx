import * as React from "react";
import { Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import {
  Check,
  ChevronDown,
  CirclePlus,
  FolderKanban,
  Search,
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
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import type { CtrType } from "./types";

export function ContractTypeTableSelect({
  value,
  types,
  onChange,
  onRefresh,
  placeholder = "Cari & pilih kategori kontrak...",
}: {
  value?: number | null;
  types: CtrType[];
  onChange: (type: CtrType) => void;
  onRefresh?: () => void;
  placeholder?: string;
}) {
  const { toast } = useApp();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [showAdd, setShowAdd] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [newCode, setNewCode] = React.useState("");
  const [newName, setNewName] = React.useState("");
  const [newDesc, setNewDesc] = React.useState("");

  const selected = types.find((t) => t.id === value) ?? null;
  const filtered = types.filter((t) => {
    const text = `${t.code} ${t.name} ${t.description ?? ""}`.toLowerCase();
    return text.includes(q.toLowerCase());
  });

  async function quickAdd() {
    if (!newName.trim()) {
      toast("Nama kategori kontrak wajib diisi", "danger");
      return;
    }
    setSaving(true);
    try {
      const created = await api.post<CtrType>("/contracts/types", {
        code: newCode.trim() || undefined,
        name: newName.trim(),
        description: newDesc.trim() || undefined,
      });
      toast("Kategori kontrak berhasil ditambahkan");
      setNewCode("");
      setNewName("");
      setNewDesc("");
      setShowAdd(false);
      onRefresh?.();
      onChange(created);
      setOpen(false);
    } catch (e: any) {
      toast(e?.message ?? "Gagal menambah kategori kontrak", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className="h-11 flex-row items-center justify-between gap-2 rounded-lg border border-border/80 bg-card px-3"
      >
        <View className="flex-1 flex-row items-center gap-2">
          <FolderKanban size={15} color={selected ? colors.primary : colors.muted} />
          <Text
            className={cn(
              "flex-1 text-sm",
              selected ? "font-medium text-foreground" : "text-muted-foreground",
            )}
            numberOfLines={1}
          >
            {selected ? `${selected.name} · ${selected.code}` : placeholder}
          </Text>
        </View>
        <ChevronDown size={16} color={colors.muted} />
      </Pressable>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="w-[96vw] max-w-5xl lg:max-w-6xl max-h-[88vh] p-4 sm:p-6"
          style={Platform.select({
            web: { width: "min(96vw, 1100px)", maxWidth: "1100px" } as any,
          })}
        >
          <DialogHeader>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <FolderKanban size={20} color={colors.primary} />
                <DialogTitle>Pilih Kategori Kontrak (Contract Type)</DialogTitle>
              </View>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onPress={() => setShowAdd((v) => !v)}
              >
                <CirclePlus size={14} color={colors.primary} />
                <Text className="text-xs">+ Tambah Kategori Baru</Text>
              </Button>
            </View>
          </DialogHeader>

          {showAdd ? (
            <View className="mt-2 gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
              <Text className="text-xs font-bold">Tambah Kategori Kontrak Baru</Text>
              <View className="flex-row flex-wrap gap-2.5">
                <View className="w-36 gap-1">
                  <Text className="text-xs font-semibold">Kode</Text>
                  <TextInput
                    value={newCode}
                    onChangeText={(v) => setNewCode(v.toUpperCase())}
                    placeholder="SLA_IT"
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                  />
                </View>
                <View className="min-w-[220px] flex-1 gap-1">
                  <Text className="text-xs font-semibold">Nama Kategori *</Text>
                  <TextInput
                    value={newName}
                    onChangeText={setNewName}
                    placeholder="Contoh: Kontrak Sewa Peralatan"
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                  />
                </View>
                <View className="min-w-[240px] flex-1 gap-1">
                  <Text className="text-xs font-semibold">Deskripsi</Text>
                  <TextInput
                    value={newDesc}
                    onChangeText={setNewDesc}
                    placeholder="Keterangan singkat..."
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                  />
                </View>
              </View>
              <View className="flex-row justify-end gap-2">
                <Button variant="outline" size="sm" onPress={() => setShowAdd(false)} disabled={saving}>
                  <Text className="text-xs">Batal</Text>
                </Button>
                <Button size="sm" onPress={quickAdd} disabled={saving}>
                  <Text className="text-xs text-white">
                    {saving ? "Menyimpan..." : "Simpan & Pilih"}
                  </Text>
                </Button>
              </View>
            </View>
          ) : null}

          <View className="mt-2 h-10 flex-row items-center gap-2 rounded-lg border border-border bg-input px-3">
            <Search size={16} color={colors.muted} />
            <Input
              value={q}
              onChangeText={setQ}
              placeholder="Cari nama, kode, atau deskripsi kategori..."
              className="h-9 flex-1 border-0 bg-transparent px-0 shadow-none"
            />
          </View>

          <View className="mt-2 flex-1 overflow-hidden rounded-xl border border-border/80 bg-card">
            <View className="flex-row items-center border-b border-border/70 bg-muted/60 px-4 py-2.5">
              <Text className="w-[150px] text-[11px] font-bold text-muted-foreground">Kode</Text>
              <Text className="flex-1 text-[11px] font-bold text-muted-foreground">
                Kategori Kontrak
              </Text>
              <Text className="flex-[1.5] px-2 text-[11px] font-bold text-muted-foreground">
                Deskripsi
              </Text>
              <Text className="w-[80px] text-center text-[11px] font-bold text-muted-foreground">
                Kontrak
              </Text>
              <Text className="w-[90px] text-center text-[11px] font-bold text-muted-foreground">
                Aksi
              </Text>
            </View>
            <ScrollView
              className="max-h-[48vh]"
              contentContainerClassName="divide-y divide-border/40"
            >
              {filtered.length === 0 ? (
                <View className="items-center justify-center p-8">
                  <Text className="text-xs text-muted-foreground">
                    Tidak ada kategori kontrak yang cocok
                  </Text>
                </View>
              ) : (
                filtered.map((item) => {
                  const isSelected = item.id === value;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => {
                        onChange(item);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex-row items-center px-4 py-3",
                        isSelected && "bg-primary/5",
                      )}
                    >
                      <Text className="w-[150px] font-mono text-xs font-bold text-primary">
                        {item.code}
                      </Text>
                      <View className="flex-1 pr-2">
                        <Text
                          className={cn(
                            "text-sm font-semibold",
                            isSelected && "text-primary",
                          )}
                        >
                          {item.name}
                        </Text>
                      </View>
                      <View className="flex-[1.5] px-2">
                        <Text className="text-xs text-muted-foreground" numberOfLines={2}>
                          {item.description || "-"}
                        </Text>
                      </View>
                      <View className="w-[80px] items-center">
                        <Text className="text-xs font-bold text-primary">
                          {item._count?.contracts ?? 0}
                        </Text>
                      </View>
                      <View className="w-[90px] items-center">
                        {isSelected ? (
                          <View className="rounded-full bg-primary/10 p-1">
                            <Check size={14} color={colors.primary} />
                          </View>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-3"
                            onPress={() => {
                              onChange(item);
                              setOpen(false);
                            }}
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
        </DialogContent>
      </Dialog>
    </>
  );
}
