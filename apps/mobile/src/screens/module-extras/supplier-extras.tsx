import * as React from "react";
import { View } from "react-native";
import { Plus, Trash2 } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Panel, FormField } from "@/components/akuntra/basics";
import { StatusBadge } from "@/components/akuntra/status-badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { rupiah, formatThousands } from "@/lib/format";
import { type Row } from "@/constants/modules";

export function SupplierExtras({
  row,
  onRefresh,
}: {
  row: Row;
  onRefresh?: () => Promise<void> | void;
}) {
  const { patchRow, toast, reload } = useApp();
  const [tagModalOpen, setTagModalOpen] = React.useState(false);
  const [newTagName, setNewTagName] = React.useState("");
  const [newTagPrice, setNewTagPrice] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const tags: { id?: number; itemName: string; price?: number | null }[] =
    Array.isArray(row.tags) ? row.tags : [];
  const isPkp = row.taxStatus === "PKP" || row.jenisUsaha === "PKP";

  async function handleAddTag() {
    if (!newTagName.trim()) {
      toast("Nama tag barang wajib diisi", "danger");
      return;
    }
    setSaving(true);
    try {
      const updatedTags = [
        ...tags.map((t) => ({
          itemName: t.itemName,
          price: t.price ? Number(t.price) : undefined,
        })),
        {
          itemName: newTagName.trim(),
          price: newTagPrice.trim()
            ? Number(newTagPrice.replace(/\D/g, ""))
            : undefined,
        },
      ];
      await patchRow("suppliers", row.id, { tags: updatedTags });
      toast("Tag barang berhasil ditambahkan");
      setNewTagName("");
      setNewTagPrice("");
      setTagModalOpen(false);
      if (onRefresh) await onRefresh();
      await reload();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menambahkan tag barang", "danger");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTag(idx: number) {
    setSaving(true);
    try {
      const updatedTags = tags
        .filter((_, i) => i !== idx)
        .map((t) => ({
          itemName: t.itemName,
          price: t.price ? Number(t.price) : undefined,
        }));
      await patchRow("suppliers", row.id, { tags: updatedTags });
      toast("Tag barang dihapus");
      if (onRefresh) await onRefresh();
      await reload();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menghapus tag barang", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="gap-4">
      <Panel
        title="Status Perpajakan Pemasok"
        subtitle="Identifikasi kewajiban pajak PPN dan penerbitan faktur pajak"
      >
        <View className="flex-row items-center justify-between py-2">
          <View className="gap-1 flex-1 pr-4">
            <Text className="font-semibold text-sm">
              {isPkp
                ? "Pengusaha Kena Pajak (PKP)"
                : "Non-PKP (Bukan Pengusaha Kena Pajak)"}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {isPkp
                ? "Pemasok ini wajib menerbitkan Faktur Pajak PPN 11% untuk setiap transaksi pengadaan barang/jasa."
                : "Pemasok tidak mengenakan PPN dan tidak menerbitkan faktur pajak resmi."}
            </Text>
          </View>
          <StatusBadge status={isPkp ? "Disetujui" : "Draft"} />
        </View>
      </Panel>

      <Panel
        title={`Katalog Tag Barang (${tags.length})`}
        subtitle="Identifikasi jenis barang yang dijual untuk memudahkan pencarian Procurement"
        right={
          <Button
            size="sm"
            variant="outline"
            onPress={() => setTagModalOpen(true)}
          >
            <Plus size={14} color={colors.text} />
            <Text className="text-xs">Tambah Tag</Text>
          </Button>
        }
      >
        {tags.length === 0 ? (
          <Text className="text-xs text-muted-foreground py-2">
            Belum ada tag barang untuk supplier ini. Tambahkan tag (misal: HDD,
            SSD, Camera, RAM) agar Procurement dapat mencari supplier
            berdasarkan barang yang dibutuhkan.
          </Text>
        ) : (
          <View className="flex-row flex-wrap gap-2 py-2">
            {tags.map((t, idx) => (
              <View
                key={`${t.itemName}-${idx}`}
                className="flex-row items-center gap-2 bg-muted/60 border border-border px-3 py-1.5 rounded-xl"
              >
                <View>
                  <Text className="text-xs font-semibold">{t.itemName}</Text>
                  {t.price != null && Number(t.price) > 0 ? (
                    <Text className="text-[11px] text-muted-foreground">
                      {rupiah(Number(t.price))}
                    </Text>
                  ) : null}
                </View>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 rounded-full"
                  onPress={() => handleDeleteTag(idx)}
                >
                  <Trash2 size={12} color={colors.danger} />
                </Button>
              </View>
            ))}
          </View>
        )}
      </Panel>

      {/* Dialog Tambah Tag */}
      <Dialog open={tagModalOpen} onOpenChange={setTagModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Tag Barang Pemasok</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <FormField label="Nama Barang / Kategori Tag" required>
              <Input
                placeholder="Contoh: HDD, SSD, Camera, RAM"
                value={newTagName}
                onChangeText={setNewTagName}
              />
            </FormField>
            <FormField label="Harga Barang (Opsional / Referensi)">
              <Input
                placeholder="Contoh: 750.000"
                keyboardType="numeric"
                value={newTagPrice}
                onChangeText={(v) => setNewTagPrice(formatThousands(v))}
              />
            </FormField>
          </View>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onPress={() => setTagModalOpen(false)}
              disabled={saving}
            >
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleAddTag} disabled={saving}>
              <Text className="text-white font-semibold">
                {saving ? "Menyimpan..." : "Simpan Tag"}
              </Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  );
}
