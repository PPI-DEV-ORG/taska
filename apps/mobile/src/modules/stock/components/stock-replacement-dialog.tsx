import * as React from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FormField } from "@/components/taska/basics";
import { SearchableSelect } from "@/components/taska/dialogs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/services/api";

interface StockReplacementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serials: any[];
  defaultOldSn?: string;
  onSuccess: () => Promise<void>;
  toast: (msg: string, type?: "success" | "danger" | "info" | "warning") => void;
}

export function StockReplacementDialog({
  open,
  onOpenChange,
  serials,
  defaultOldSn = "",
  onSuccess,
  toast,
}: StockReplacementDialogProps) {
  const [oldSn, setOldSn] = React.useState(defaultOldSn);
  const [newSn, setNewSn] = React.useState("");
  const [replaceReason, setReplaceReason] = React.useState("");

  React.useEffect(() => {
    if (defaultOldSn) {
      setOldSn(defaultOldSn);
    }
  }, [defaultOldSn]);

  async function handleReplacement() {
    if (!oldSn || !newSn || !replaceReason.trim()) {
      toast("Semua field unit pengganti wajib diisi", "danger");
      return;
    }
    const unit = serials.find((s) => String(s.sn) === oldSn.trim());
    if (!unit) {
      toast("SN lama tidak ditemukan", "danger");
      return;
    }
    try {
      await api("POST", `/serials/${unit.id}/replace`, {
        newSn: newSn.trim(),
        reason: replaceReason.trim(),
      });
      onOpenChange(false);
      toast(`Penggantian SN ${oldSn} dengan ${newSn} dicatat`);
      setOldSn("");
      setNewSn("");
      setReplaceReason("");
      await onSuccess();
    } catch (e: any) {
      toast(e?.message ?? "Gagal mengganti unit", "danger");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Penggantian Unit Rusak / Retur (SN Lama → SN Baru)</DialogTitle>
        </DialogHeader>
        <View className="gap-4">
          <Text className="text-text-secondary text-xs">
            Pilih atau ketik SN unit lama yang rusak/diretur dan masukkan SN unit baru penggantinya. Stok tersedia di gudang akan otomatis disesuaikan (+1 unit baru siap pakai) dan riwayat kedua SN saling terhubung.
          </Text>
          <FormField label="Pilih / Ketik Serial Number Lama (Rusak / Retur)" required>
            <View className="gap-1.5">
              <SearchableSelect
                value={oldSn}
                onChange={(v) => {
                  const clean = (v.split(" (")[0] ?? v).trim();
                  setOldSn(clean);
                }}
                options={serials
                  .filter((s) => s.rawStatus !== "DIGANTI" && s.status !== "Diganti")
                  .map((s) => `${s.sn} (${s.produk} · ${s.status || "Di gudang"})`)}
                placeholder="Pilih dari daftar SN terdaftar..."
              />
              <Input
                value={oldSn}
                onChangeText={setOldSn}
                placeholder="Atau ketik / scan SN lama (contoh: 299292)"
              />
            </View>
          </FormField>
          <FormField label="Serial Number Baru (Unit Pengganti)" required>
            <Input
              value={newSn}
              onChangeText={setNewSn}
              placeholder="Ketik / scan SN baru pengganti (contoh: 94949)"
            />
          </FormField>
          <FormField label="Alasan Penggantian Unit" required>
            <Textarea
              value={replaceReason}
              onChangeText={setReplaceReason}
              placeholder="Contoh: Unit pengganti klaim retur / garansi untuk kamera rusak"
            />
          </FormField>
        </View>
        <DialogFooter>
          <Button variant="outline" onPress={() => onOpenChange(false)}>
            <Text>Batal</Text>
          </Button>
          <Button onPress={handleReplacement}>
            <Text>Simpan Unit Pengganti</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

