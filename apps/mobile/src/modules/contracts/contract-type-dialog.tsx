import * as React from "react";
import { Platform, ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import { Pencil, Plus, Trash2 } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/taska/basics";
import { colors } from "@/tokens";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import type { CtrType } from "./types";
import { EmptyRow } from "./contract-ui";

type Props = {
  visible: boolean;
  onClose: () => void;
  types: CtrType[];
  onRefresh: () => void;
};

export function ContractTypeDialog({ visible, onClose, types, onRefresh }: Props) {
  const { toast } = useApp();
  const [editing, setEditing] = React.useState<CtrType | null>(null);
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  function resetForm() {
    setEditing(null);
    setCode("");
    setName("");
    setDescription("");
  }

  function startEdit(item: CtrType) {
    setEditing(item);
    setCode(item.code);
    setName(item.name);
    setDescription(item.description ?? "");
  }

  async function save() {
    if (!name.trim()) {
      toast("Nama kategori kontrak wajib diisi", "danger");
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await api.patch(`/contracts/types/${editing.id}`, {
          name: name.trim(),
          description: description.trim() || undefined,
        });
        toast("Kategori kontrak diperbarui");
      } else {
        await api.post("/contracts/types", {
          code: code.trim() || undefined,
          name: name.trim(),
          description: description.trim() || undefined,
        });
        toast("Kategori kontrak baru ditambahkan");
      }
      resetForm();
      onRefresh();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menyimpan kategori kontrak", "danger");
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: CtrType) {
    if (item.isSystem) {
      toast("Kategori bawaan sistem tidak dapat dihapus", "warning");
      return;
    }
    setBusy(true);
    try {
      await api.delete(`/contracts/types/${item.id}`);
      toast("Kategori kontrak dihapus");
      onRefresh();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menghapus kategori kontrak", "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={visible} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[90vh] w-[96vw] max-w-5xl p-0"
        style={Platform.select({
          web: { width: "min(96vw, 980px)", maxWidth: "980px" } as any,
        })}
      >
        <DialogHeader className="border-b border-border/70 px-5 py-4">
          <DialogTitle>Master Kategori Kontrak (Contract Types)</DialogTitle>
          <Text className="text-xs text-muted-foreground">
            Kelola 12 kategori kontrak bawaan PRD serta tambahkan kategori kontrak kustom perusahaan.
          </Text>
        </DialogHeader>

        <ScrollView className="max-h-[70vh] px-5 py-4">
          <View className="gap-4">
            <View className="gap-3 rounded-xl border border-border/80 bg-muted/20 p-3.5">
              <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {editing ? `Edit Kategori: ${editing.code}` : "Tambah Kategori Kontrak Baru"}
              </Text>
              <View className="flex-row flex-wrap gap-3">
                <View className="min-w-[140px] flex-1">
                  <FormField label="Kode Kategori (Opsional)">
                    <TextInput
                      value={code}
                      onChangeText={setCode}
                      editable={!editing}
                      placeholder="Mis. SLA_IT"
                      className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                    />
                  </FormField>
                </View>
                <View className="min-w-[220px] flex-[2]">
                  <FormField label="Nama Kategori *" required>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      placeholder="Contoh: Kontrak Sewa Kendaraan"
                      className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                    />
                  </FormField>
                </View>
              </View>
              <FormField label="Deskripsi / Cakupan">
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Keterangan singkat jenis kontrak ini..."
                  className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                />
              </FormField>
              <View className="flex-row justify-end gap-2">
                {editing ? (
                  <Button variant="outline" size="sm" onPress={resetForm} disabled={busy}>
                    <Text className="text-xs">Batal Edit</Text>
                  </Button>
                ) : null}
                <Button size="sm" className="gap-1.5" onPress={save} disabled={busy}>
                  <Plus size={14} color="#fff" />
                  <Text className="text-xs text-white">
                    {busy ? "Menyimpan..." : editing ? "Simpan Perubahan" : "Tambah Kategori"}
                  </Text>
                </Button>
              </View>
            </View>

            <View className="overflow-hidden rounded-xl border border-border/80 bg-card">
              <View className="flex-row items-center border-b border-border/70 bg-muted/60 px-3 py-2">
                <Text className="w-[130px] text-[11px] font-bold text-muted-foreground">Kode</Text>
                <Text className="flex-1 text-[11px] font-bold text-muted-foreground">Nama Kategori</Text>
                <Text className="flex-[1.5] text-[11px] font-bold text-muted-foreground">Deskripsi</Text>
                <Text className="w-[70px] text-center text-[11px] font-bold text-muted-foreground">Kontrak</Text>
                <Text className="w-[80px] text-right text-[11px] font-bold text-muted-foreground">Aksi</Text>
              </View>
              {types.length === 0 ? (
                <EmptyRow text="Belum ada kategori kontrak" />
              ) : (
                <View className="divide-y divide-border/40">
                  {types.map((item) => (
                    <View key={item.id} className="flex-row items-center px-3 py-2.5">
                      <View className="w-[130px] pr-2">
                        <Text className="font-mono text-xs font-bold text-primary">{item.code}</Text>
                      </View>
                      <View className="flex-1 pr-2">
                        <Text className="text-xs font-semibold">{item.name}</Text>
                      </View>
                      <View className="flex-[1.5] pr-2">
                        <Text className="text-xs text-muted-foreground" numberOfLines={2}>
                          {item.description || "-"}
                        </Text>
                      </View>
                      <View className="w-[70px] items-center">
                        <Text className="text-xs font-bold">{item._count?.contracts ?? 0}</Text>
                      </View>
                      <View className="w-[80px] flex-row justify-end gap-1.5">
                        <TouchableOpacity
                          onPress={() => startEdit(item)}
                          className="rounded-md border border-border p-1.5"
                        >
                          <Pencil size={13} color={colors.primary} />
                        </TouchableOpacity>
                        {!item.isSystem ? (
                          <TouchableOpacity
                            onPress={() => remove(item)}
                            className="rounded-md border border-border p-1.5"
                          >
                            <Trash2 size={13} color={colors.danger} />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        <DialogFooter className="border-t border-border/70 px-5 py-3">
          <Button variant="outline" size="sm" onPress={onClose}>
            <Text className="text-xs">Tutup</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
