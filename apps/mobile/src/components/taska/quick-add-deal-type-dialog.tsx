import * as React from "react";
import { View } from "react-native";
import { Briefcase } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { FormField } from "@/components/taska/basics";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { type Row } from "@/constants/modules";

export function QuickAddDealTypeDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (newDealType: Row) => void;
}) {
  const { addRow, toast } = useApp();
  const [nama, setNama] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const resetForm = React.useCallback(() => {
    setNama("");
    setError("");
    setLoading(false);
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  async function handleSave() {
    if (!nama.trim()) {
      setError("Nama jenis transaksi / peluang wajib diisi");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload = {
        nama: nama.trim(),
        status: "Aktif",
      };

      const created = await addRow("dealTypes", payload);
      toast(`Jenis transaksi "${nama.trim()}" berhasil ditambahkan`, "success");
      onSuccess?.(created || ({ id: String(Date.now()), nama: nama.trim(), status: "Aktif" } as Row));
      handleOpenChange(false);
    } catch (err: any) {
      setError(err?.message || "Gagal menyimpan jenis transaksi baru");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <View className="flex-row items-center gap-2 mb-1">
            <View className="size-8 rounded-lg bg-primary/10 items-center justify-center">
              <Briefcase size={16} color={colors.primary} />
            </View>
            <DialogTitle>Tambah Jenis Transaksi / Peluang</DialogTitle>
          </View>
          <DialogDescription>
            Tambahkan jenis transaksi prospek baru ke master data. Opsi ini akan otomatis tersimpan dan dapat dipilih untuk seluruh prospek.
          </DialogDescription>
        </DialogHeader>

        <View className="gap-3 py-2">
          {error ? (
            <View className="p-2.5 rounded-lg bg-danger/10 border border-danger/30">
              <Text className="text-xs text-danger font-medium">{error}</Text>
            </View>
          ) : null}

          <FormField label="Nama Jenis Transaksi / Peluang" required>
            <Input
              value={nama}
              onChangeText={(text) => {
                setNama(text);
                if (error) setError("");
              }}
              placeholder="Contoh: Jasa Pemeliharaan / AMC, Sewa Perangkat, Pengadaan IT"
              autoFocus
            />
          </FormField>
        </View>

        <DialogFooter>
          <Button variant="outline" onPress={() => handleOpenChange(false)} disabled={loading}>
            <Text>Batal</Text>
          </Button>
          <Button onPress={handleSave} disabled={loading}>
            <Text>{loading ? "Menyimpan..." : "Simpan Jenis Transaksi"}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
