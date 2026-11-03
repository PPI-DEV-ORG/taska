import * as React from "react";
import { View } from "react-native";
import { Building2, Plus, User, Phone, MapPin, Mail, FileText } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { FormField } from "@/components/taska/basics";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { type Row } from "@/constants/modules";

export function QuickAddCustomerDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (newCustomer: Row) => void;
}) {
  const { addRow, toast } = useApp();
  const [nama, setNama] = React.useState("");
  const [kontak, setKontak] = React.useState("");
  const [telepon, setTelepon] = React.useState("");
  const [kota, setKota] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [catatan, setCatatan] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const resetForm = React.useCallback(() => {
    setNama("");
    setKontak("");
    setTelepon("");
    setKota("");
    setEmail("");
    setCatatan("");
    setError("");
    setLoading(false);
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  async function handleSave() {
    if (!nama.trim()) {
      setError("Nama customer / perusahaan wajib diisi.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const created = await addRow("customers", {
        nama: nama.trim(),
        kontak: kontak.trim() || nama.trim(),
        kota: kota.trim() || "-",
        telepon: telepon.trim() || "-",
        email: email.trim() || "-",
        catatan: catatan.trim() || "-",
        status: "Aktif",
      });

      if (created) {
        toast(`Customer "${created.nama || nama.trim()}" berhasil ditambahkan!`, "success");
        resetForm();
        onOpenChange(false);
        onSuccess?.(created);
      }
    } catch (err: any) {
      setError(err?.message || "Gagal menambahkan customer baru.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <View className="flex-row items-center gap-2">
            <View className="w-8 h-8 rounded-lg bg-primary/10 items-center justify-center">
              <Building2 size={18} color={colors.primary} />
            </View>
            <View className="flex-1">
              <DialogTitle>Tambah Customer Baru</DialogTitle>
              <DialogDescription>
                Customer akan langsung tersimpan di Master Data dan terpilih otomatis
              </DialogDescription>
            </View>
          </View>
        </DialogHeader>

        <View className="gap-3 py-1">
          <FormField label="Nama Customer / Perusahaan" required error={error}>
            <Input
              value={nama}
              onChangeText={(v) => { setNama(v); setError(""); }}
              placeholder="Contoh: PT Sumber Makmur Sentosa"
              autoFocus
            />
          </FormField>

          <View className="flex-row gap-2">
            <View className="flex-1">
              <FormField label="Nama Kontak PIC">
                <Input
                  value={kontak}
                  onChangeText={setKontak}
                  placeholder="Nama PIC / Kontak"
                />
              </FormField>
            </View>
            <View className="flex-1">
              <FormField label="Nomor Telepon / WA">
                <Input
                  value={telepon}
                  onChangeText={setTelepon}
                  placeholder="0812-xxxx-xxxx"
                  keyboardType="phone-pad"
                />
              </FormField>
            </View>
          </View>

          <View className="flex-row gap-2">
            <View className="flex-1">
              <FormField label="Kota">
                <Input
                  value={kota}
                  onChangeText={setKota}
                  placeholder="Contoh: Jakarta"
                />
              </FormField>
            </View>
            <View className="flex-1">
              <FormField label="Email (Opsional)">
                <Input
                  value={email}
                  onChangeText={setEmail}
                  placeholder="email@perusahaan.com"
                  keyboardType="email-address"
                />
              </FormField>
            </View>
          </View>

          <FormField label="Catatan / Alamat (Opsional)">
            <Textarea
              value={catatan}
              onChangeText={setCatatan}
              placeholder="Alamat kantor, lokasi proyek, atau catatan khusus..."
              className="min-h-[60px]"
            />
          </FormField>
        </View>

        <DialogFooter className="flex-row justify-end gap-2 pt-2">
          <Button variant="outline" onPress={() => { resetForm(); onOpenChange(false); }} disabled={loading}>
            <Text>Batal</Text>
          </Button>
          <Button onPress={handleSave} disabled={loading}>
            <Plus size={16} color={colors.background} />
            <Text>{loading ? "Menyimpan..." : "Simpan Customer"}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

