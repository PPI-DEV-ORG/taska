import * as React from "react";
import { View, ScrollView } from "react-native";
import { Truck, User, Phone, MapPin, Mail, CreditCard, Tag } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { FormField } from "@/components/taska/basics";
import { SearchableSelect } from "@/components/taska/dialogs";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { api } from "@/services/api";
import { type Row } from "@/constants/modules";

const DEFAULT_PAYMENT_TERMS = [
  "Tunai",
  "Net 14",
  "Net 30",
  "Net 60",
  "COD",
  "DP 50%, Pelunasan 50%",
];

export function QuickAddSupplierDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (newSupplier: Row) => void;
}) {
  const { addRow, toast } = useApp();
  const [nama, setNama] = React.useState("");
  const [jenisUsaha, setJenisUsaha] = React.useState<"Non-PKP" | "PKP">("Non-PKP");
  const [tagInput, setTagInput] = React.useState("");
  const [kontak, setKontak] = React.useState("");
  const [telepon, setTelepon] = React.useState("");
  const [kota, setKota] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [payment, setPayment] = React.useState("Net 30");
  const [paymentOptions, setPaymentOptions] = React.useState<string[]>(DEFAULT_PAYMENT_TERMS);
  const [catatan, setCatatan] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  // Load custom payment terms options from settings if available
  React.useEffect(() => {
    if (!open) return;
    let isMounted = true;
    void (async () => {
      try {
        const res = await api<any[]>("GET", "/settings");
        if (Array.isArray(res) && isMounted) {
          const item = res.find((s) => s.key === "supplier.payment.terms");
          if (item?.value) {
            try {
              const parsed = JSON.parse(item.value);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setPaymentOptions(Array.from(new Set([...parsed, ...DEFAULT_PAYMENT_TERMS])));
              }
            } catch {}
          }
        }
      } catch {}
    })();
    return () => {
      isMounted = false;
    };
  }, [open]);

  const resetForm = React.useCallback(() => {
    setNama("");
    setJenisUsaha("Non-PKP");
    setTagInput("");
    setKontak("");
    setTelepon("");
    setKota("");
    setEmail("");
    setPayment("Net 30");
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
      setError("Nama supplier / vendor wajib diisi.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const created = await addRow("suppliers", {
        nama: nama.trim(),
        jenisUsaha,
        taxStatus: jenisUsaha === "PKP" ? "PKP" : "NON_PKP",
        tagInput: tagInput.trim() || undefined,
        kontak: kontak.trim() || "-",
        kota: kota.trim() || "-",
        telepon: telepon.trim() || "-",
        email: email.trim() || "-",
        payment: payment.trim() || "Net 30",
        catatan: catatan.trim() || "-",
        status: "Aktif",
      });

      if (created) {
        toast(`Supplier "${created.nama || nama.trim()}" berhasil ditambahkan!`, "success");
        resetForm();
        onOpenChange(false);
        onSuccess?.(created);
      }
    } catch (err: any) {
      setError(err?.message || "Gagal menambahkan supplier baru.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh]">
        <DialogHeader>
          <View className="flex-row items-center gap-2">
            <View className="w-8 h-8 rounded-lg bg-primary/10 items-center justify-center">
              <Truck size={18} color={colors.primary} />
            </View>
            <View className="flex-1">
              <DialogTitle>Tambah Supplier Baru</DialogTitle>
              <DialogDescription>
                Supplier akan langsung tersimpan di Master Data dan terpilih otomatis
              </DialogDescription>
            </View>
          </View>
        </DialogHeader>

        <ScrollView className="max-h-[60vh] py-1" showsVerticalScrollIndicator={false}>
          <View className="gap-3">
            <FormField label="Nama Supplier / Toko" required error={error}>
              <Input
                value={nama}
                onChangeText={(v) => { setNama(v); setError(""); }}
                placeholder="Contoh: CV Elektronika Jaya / Toko Makmur"
                autoFocus
              />
            </FormField>

            <View className="gap-1.5">
              <Text className="text-xs text-muted-foreground font-medium">Status Pajak (Jenis Usaha)</Text>
              <View className="flex-row gap-2">
                <Button
                  size="sm"
                  variant={jenisUsaha === "Non-PKP" ? "default" : "outline"}
                  className="flex-1 h-8"
                  onPress={() => setJenisUsaha("Non-PKP")}
                >
                  <Text className="text-xs">Non-PKP</Text>
                </Button>
                <Button
                  size="sm"
                  variant={jenisUsaha === "PKP" ? "default" : "outline"}
                  className="flex-1 h-8"
                  onPress={() => setJenisUsaha("PKP")}
                >
                  <Text className="text-xs">PKP (Faktur Pajak)</Text>
                </Button>
              </View>
            </View>

            <FormField
              label="Tags / Kategori Barang Supplier (Opsional)"
              hint="Contoh: Kabel, Baut, Switch, Aksesoris (pisahkan dengan koma)"
            >
              <View className="relative">
                <Input
                  value={tagInput}
                  onChangeText={setTagInput}
                  placeholder="Kabel, Konektor, Switch Hub, Server"
                  className="pl-8"
                />
                <View className="absolute left-2.5 top-3">
                  <Tag size={14} color={colors.textSecondary} />
                </View>
              </View>
            </FormField>

            <View className="flex-row gap-2">
              <View className="flex-1">
                <FormField label="Kontak PIC (Opsional)">
                  <View className="relative">
                    <Input
                      value={kontak}
                      onChangeText={setKontak}
                      placeholder="Sales Support"
                      className="pl-8"
                    />
                    <View className="absolute left-2.5 top-3">
                      <User size={14} color={colors.textSecondary} />
                    </View>
                  </View>
                </FormField>
              </View>
              <View className="flex-1">
                <FormField label="No. Telp / WA (Opsional)">
                  <View className="relative">
                    <Input
                      value={telepon}
                      onChangeText={setTelepon}
                      placeholder="0812..."
                      keyboardType="phone-pad"
                      className="pl-8"
                    />
                    <View className="absolute left-2.5 top-3">
                      <Phone size={14} color={colors.textSecondary} />
                    </View>
                  </View>
                </FormField>
              </View>
            </View>

            <View className="flex-row gap-2">
              <View className="flex-1">
                <FormField label="Kota (Opsional)">
                  <View className="relative">
                    <Input
                      value={kota}
                      onChangeText={setKota}
                      placeholder="Jakarta Barat"
                      className="pl-8"
                    />
                    <View className="absolute left-2.5 top-3">
                      <MapPin size={14} color={colors.textSecondary} />
                    </View>
                  </View>
                </FormField>
              </View>
              <View className="flex-1">
                <FormField label="Email (Opsional)">
                  <View className="relative">
                    <Input
                      value={email}
                      onChangeText={setEmail}
                      placeholder="sales@supplier.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      className="pl-8"
                    />
                    <View className="absolute left-2.5 top-3">
                      <Mail size={14} color={colors.textSecondary} />
                    </View>
                  </View>
                </FormField>
              </View>
            </View>

            <FormField label="Termin Pembayaran (Opsional)">
              <SearchableSelect
                value={payment}
                onChange={setPayment}
                options={paymentOptions}
                placeholder="Pilih syarat/termin pembayaran..."
              />
            </FormField>

            <FormField label="Catatan / Alamat Supplier (Opsional)">
              <View className="relative">
                <Textarea
                  value={catatan}
                  onChangeText={setCatatan}
                  placeholder="Catatan rekening, alamat gudang supplier, dll."
                  numberOfLines={2}
                />
              </View>
            </FormField>
          </View>
        </ScrollView>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onPress={() => { resetForm(); onOpenChange(false); }} disabled={loading}>
            <Text>Batal</Text>
          </Button>
          <Button onPress={handleSave} disabled={loading}>
            <Text>{loading ? "Menyimpan..." : "Simpan Supplier"}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

