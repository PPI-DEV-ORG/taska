import * as React from "react";
import { View, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Plus, Trash2, CreditCard, Check } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { colors } from "@/tokens";
import { api } from "@/services/api";
import { MODULES } from "@/constants/modules";
import { useApp } from "@/store/app-store";

const DEFAULT_TERMS = ["Tunai", "Net 14", "Net 30", "Net 60"];
const PRESET_SUGGESTIONS = ["Tunai", "COD", "Net 7", "Net 14", "Net 30", "Net 45", "Net 60", "Net 90", "DP 50%, Pelunasan 50%"];

interface SupplierPaymentTermsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (terms: string[]) => void;
}

export function SupplierPaymentTermsDialog({
  open,
  onOpenChange,
  onSaved,
}: SupplierPaymentTermsDialogProps) {
  const { toast } = useApp();
  const [terms, setTerms] = React.useState<string[]>(DEFAULT_TERMS);
  const [newTermInput, setNewTermInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Load existing settings on open
  React.useEffect(() => {
    if (!open) return;
    let isMounted = true;
    setLoading(true);
    void (async () => {
      try {
        const res = await api<any[]>("GET", "/settings");
        if (Array.isArray(res)) {
          const item = res.find((s) => s.key === "supplier.payment.terms");
          if (item?.value) {
            try {
              const parsed = JSON.parse(item.value);
              if (Array.isArray(parsed) && parsed.length > 0 && isMounted) {
                setTerms(parsed);
                return;
              }
            } catch {}
          }
        }
        // Fallback from module definition
        const existingField = MODULES.suppliers?.createFields?.find((f) => f.key === "payment");
        if (existingField?.options && existingField.options.length > 0 && isMounted) {
          setTerms(existingField.options);
        }
      } catch (err) {
        console.warn("Error loading payment terms:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [open]);

  const handleAddTerm = (termToAdd?: string) => {
    const val = (termToAdd ?? newTermInput).trim();
    if (!val) return;
    if (terms.map((t) => t.toLowerCase()).includes(val.toLowerCase())) {
      toast("Syarat pembayaran tersebut sudah ada di daftar", "warning");
      return;
    }
    setTerms([...terms, val]);
    if (!termToAdd) setNewTermInput("");
  };

  const handleRemoveTerm = (index: number) => {
    if (terms.length <= 1) {
      toast("Minimal harus ada 1 syarat pembayaran", "danger");
      return;
    }
    setTerms(terms.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (terms.length === 0) {
      toast("Minimal harus ada 1 syarat pembayaran", "danger");
      return;
    }
    setSaving(true);
    try {
      await api("PUT", "/settings/supplier.payment.terms", {
        value: JSON.stringify(terms),
        description: "Daftar opsi syarat pembayaran supplier",
      });

      // Update module definitions in memory
      const suppPayment = MODULES.suppliers?.createFields?.find((f) => f.key === "payment");
      if (suppPayment) suppPayment.options = terms;
      const poPayment = MODULES["supplier-pos"]?.createFields?.find((f) => f.key === "payment");
      if (poPayment) poPayment.options = terms;

      toast("Syarat pembayaran supplier berhasil disimpan", "success");
      if (onSaved) onSaved(terms);
      onOpenChange(false);
    } catch (e: any) {
      toast(e?.message ?? "Gagal menyimpan syarat pembayaran", "danger");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <View className="flex-row items-center gap-2.5">
            <View className="p-2 bg-primary/10 rounded-xl">
              <CreditCard size={18} color={colors.primary} />
            </View>
            <DialogTitle>Atur Syarat Pembayaran Supplier</DialogTitle>
          </View>
          <DialogDescription>
            Kelola opsi termin/syarat pembayaran yang dapat dipilih saat mendaftarkan Supplier maupun membuat PO Pembelian.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <View className="py-8 items-center justify-center">
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : (
          <View className="gap-4 py-2">
            {/* Input Tambah Baru */}
            <View className="gap-1.5">
              <Text className="text-xs font-semibold text-foreground">Tambah Syarat Pembayaran Baru:</Text>
              <View className="flex-row items-center gap-2">
                <Input
                  value={newTermInput}
                  onChangeText={setNewTermInput}
                  placeholder="Contoh: Net 45, COD, atau DP 30%"
                  className="flex-1 h-10 text-xs"
                  onSubmitEditing={() => handleAddTerm()}
                />
                <Button size="sm" onPress={() => handleAddTerm()} className="h-10 px-3 gap-1">
                  <Plus size={14} color={colors.background} />
                  <Text className="text-xs font-bold text-white">Tambah</Text>
                </Button>
              </View>
            </View>

            {/* Rekomendasi Cepat */}
            <View className="gap-1.5">
              <Text className="text-[11px] text-muted-foreground font-medium">Saran Cepat:</Text>
              <View className="flex-row flex-wrap gap-1.5">
                {PRESET_SUGGESTIONS.filter((s) => !terms.includes(s)).slice(0, 5).map((preset) => (
                  <Pressable
                    key={preset}
                    onPress={() => handleAddTerm(preset)}
                    className="bg-panel border border-border/70 hover:border-primary/50 rounded-lg px-2.5 py-1 flex-row items-center gap-1 active:bg-panel/80"
                  >
                    <Plus size={11} color={colors.muted} />
                    <Text className="text-xs text-foreground font-medium">{preset}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* List Aktif */}
            <View className="gap-1.5">
              <Text className="text-xs font-semibold text-foreground">
                Daftar Syarat Pembayaran Aktif ({terms.length}):
              </Text>
              <ScrollView className="max-h-56 border border-border/80 rounded-xl bg-panel/30 p-2">
                <View className="gap-1.5">
                  {terms.map((term, idx) => (
                    <View
                      key={term}
                      className="flex-row items-center justify-between p-2.5 bg-card border border-border/60 rounded-lg"
                    >
                      <View className="flex-row items-center gap-2">
                        <Check size={14} color={colors.success} />
                        <Text className="text-xs font-semibold text-foreground">{term}</Text>
                      </View>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 rounded-md hover:bg-danger/10"
                        onPress={() => handleRemoveTerm(idx)}
                      >
                        <Trash2 size={13} color={colors.danger} />
                      </Button>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        )}

        <DialogFooter className="flex-row justify-end gap-2 pt-2">
          <Button variant="outline" onPress={() => onOpenChange(false)}>
            <Text className="text-xs font-semibold">Batal</Text>
          </Button>
          <Button onPress={handleSave} disabled={saving || loading}>
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text className="text-xs font-bold text-white">Simpan Perubahan</Text>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

