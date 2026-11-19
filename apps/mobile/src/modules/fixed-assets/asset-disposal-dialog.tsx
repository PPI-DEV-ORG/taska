import * as React from "react";
import { View, TouchableOpacity, ScrollView, ActivityIndicator, TextInput } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect, DatePicker } from "@/components/akuntra/dialogs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trash2, AlertTriangle, Calculator } from "lucide-react-native";
import { formatThousands } from "@/lib/format";
import { FaAsset } from "./types";
import { api } from "@/services/api";
import { useFaAccounts } from "./use-fa-accounts";

type Props = {
  visible: boolean;
  onClose: () => void;
  asset: FaAsset | null;
  onSuccess: () => void;
};

export function AssetDisposalDialog(props: Props) {
  if (!props.visible || !props.asset) return null;
  return <AssetDisposalContent key={props.asset.id} {...props} asset={props.asset} />;
}

function AssetDisposalContent({ visible, onClose, asset, onSuccess }: Props & { asset: FaAsset }) {
  const [disposalType, setDisposalType] = React.useState("SOLD");
  const [disposalDate, setDisposalDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [disposalPrice, setDisposalPrice] = React.useState<number>(0);
  const [buyerName, setBuyerName] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [cashAccountCode, setCashAccountCode] = React.useState("1000.02"); // Bank Mandiri
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const cost = Number(asset.acquisitionCost);
  const accumDep = Number(asset.accumulatedDepreciation);
  const bookValue = Number(asset.bookValue);
  const gainLoss = disposalPrice - bookValue;

  const DISPOSAL_TYPE_OPTIONS = [
    { value: "SOLD", label: "Dijual (Sold)" },
    { value: "SCRAPPED", label: "Afkir / Dihancurkan (Scrapped)" },
    { value: "DAMAGED", label: "Rusak Total (Damaged)" },
    { value: "LOST", label: "Hilang (Lost)" },
    { value: "DONATED", label: "Dihibahkan (Donated)" },
    { value: "WRITTEN_OFF", label: "Dihapusbukukan (Written Off)" },
  ];

  const { cashAccounts } = useFaAccounts();
  const cashAccountOptions = React.useMemo(() => {
    return cashAccounts.map((a) => ({
      value: a.code,
      label: a.label,
    }));
  }, [cashAccounts]);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError("Alasan pelepasan / penghapusan aset wajib diisi.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api("POST", `/fixed-assets/${asset.id}/dispose`, {
        disposalType,
        disposalDate,
        disposalPrice: disposalType === "SOLD" ? disposalPrice : 0,
        buyerName: disposalType === "SOLD" ? buyerName : undefined,
        reason,
        cashAccountCode: disposalType === "SOLD" ? cashAccountCode : undefined,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Gagal melakukan pelepasan aset.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={visible} onOpenChange={(op) => { if (!op) onClose(); }}>
      <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] gap-0 p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="flex-row items-center justify-between px-5 py-4 border-b border-border bg-destructive/5">
          <View className="flex-row items-center gap-2">
            <Trash2 size={20} className="text-destructive" />
            <DialogTitle className="font-bold text-base text-foreground">
              Pelepasan / Penghapusan Aset (Disposal)
            </DialogTitle>
          </View>
        </DialogHeader>

          {/* Form */}
          <ScrollView className="p-5 max-h-[75vh]" showsVerticalScrollIndicator={false}>
            {/* Warning Banner */}
            <View className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl flex-row gap-3 mb-4">
              <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
              <View className="flex-1">
                <Text className="text-xs font-semibold text-amber-900">
                  Tindakan Permanen Akuntansi
                </Text>
                <Text className="text-[11px] text-amber-800 leading-tight">
                  Pelepasan akan menghapus nilai perolehan dan akumulasi penyusutan dari neraca
                  keuangan dan memposting selisih laba/rugi ke jurnal umum secara otomatis.
                </Text>
              </View>
            </View>

            {/* Info Nilai Aset Saat Ini */}
            <View className="bg-muted/40 p-3.5 rounded-xl border border-border mb-4 gap-1.5">
              <Text className="text-xs font-bold text-foreground">
                {asset.assetCode} - {asset.name}
              </Text>
              <View className="flex-row justify-between text-xs">
                <Text className="text-muted-foreground">Harga Perolehan Awal:</Text>
                <Text className="font-medium text-foreground">
                  Rp {cost.toLocaleString("id-ID")}
                </Text>
              </View>
              <View className="flex-row justify-between text-xs">
                <Text className="text-muted-foreground">Akumulasi Penyusutan:</Text>
                <Text className="font-medium text-foreground">
                  Rp {accumDep.toLocaleString("id-ID")}
                </Text>
              </View>
              <View className="flex-row justify-between text-xs pt-1 border-t border-border">
                <Text className="font-semibold text-foreground">Nilai Buku Saat Ini (NBV):</Text>
                <Text className="font-bold text-foreground">
                  Rp {bookValue.toLocaleString("id-ID")}
                </Text>
              </View>
            </View>

            {error ? (
              <View className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg mb-4">
                <Text className="text-xs text-destructive">{error}</Text>
              </View>
            ) : null}

            {/* Jenis Pelepasan */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-foreground mb-1.5">
                Jenis Pelepasan (Disposal Type) *
              </Text>
              <SearchableSelect
                value={DISPOSAL_TYPE_OPTIONS.find((d) => d.value === disposalType)?.label || ""}
                options={DISPOSAL_TYPE_OPTIONS.map((d) => d.label)}
                onChange={(val) => {
                  const match = DISPOSAL_TYPE_OPTIONS.find((d) => d.label === val);
                  if (match) setDisposalType(match.value);
                }}
                placeholder="Pilih Jenis Pelepasan"
                className="h-10 rounded-lg bg-card border-border/80"
              />
            </View>

            {/* Tanggal Pelepasan */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-foreground mb-1.5">
                Tanggal Pelepasan *
              </Text>
              <DatePicker
                value={disposalDate}
                onChange={setDisposalDate}
                placeholder="Pilih tanggal pelepasan"
              />
            </View>

            {/* Jika Dijual (SOLD) */}
            {disposalType === "SOLD" ? (
              <View className="bg-primary/5 p-3.5 rounded-xl border border-primary/20 mb-4 gap-3">
                <View>
                  <Text className="text-xs font-semibold text-foreground mb-1">
                    Harga Jual Bersih (Rp) *
                  </Text>
                  <Input
                    value={disposalPrice ? formatThousands(disposalPrice) : ""}
                    onChangeText={(val: string) => setDisposalPrice(Number(val.replace(/\D/g, "")) || 0)}
                    placeholder="0"
                    keyboardType="numeric"
                    className="h-10 rounded-lg bg-card border-border/80 font-semibold"
                  />
                </View>

                <View>
                  <Text className="text-xs font-semibold text-foreground mb-1">
                    Akun Kas/Bank Penerima Hasil Jual
                  </Text>
                  <SearchableSelect
                    value={cashAccountOptions.find((a) => a.value === cashAccountCode)?.label || cashAccountCode}
                    options={cashAccountOptions.map((a) => a.label)}
                    onChange={(val) => {
                      const match = cashAccountOptions.find((a) => a.label === val);
                      if (match) setCashAccountCode(match.value);
                    }}
                    placeholder="Pilih Akun Kas/Bank"
                    className="h-10 rounded-lg bg-card border-border/80"
                  />
                </View>

                <View>
                  <Text className="text-xs font-semibold text-foreground mb-1">
                    Nama Pembeli / Pihak Ketiga
                  </Text>
                  <Input
                    value={buyerName}
                    onChangeText={setBuyerName}
                    placeholder="Nama vendor/perorangan pembeli"
                    className="h-10 rounded-lg bg-card border-border/80"
                  />
                </View>

                {/* Kalkulasi Laba / Rugi */}
                <View className="bg-background p-2.5 rounded-lg border border-border flex-row justify-between items-center">
                  <Text className="text-xs font-semibold text-foreground">
                    Kalkulasi Laba / (Rugi) Pelepasan:
                  </Text>
                  <Text
                    className={`text-sm font-bold ${
                      gainLoss >= 0 ? "text-emerald-600" : "text-destructive"
                    }`}
                  >
                    {gainLoss >= 0 ? "+ Rp " : "- Rp "}
                    {Math.abs(gainLoss).toLocaleString("id-ID")}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Alasan Pelepasan */}
            <View className="mb-2">
              <Text className="text-xs font-semibold text-foreground mb-1.5">
                Alasan Pelepasan / Keterangan *
              </Text>
              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder="Penjelasan penyebab aset dilepas atau dihapuskan..."
                multiline
                numberOfLines={3}
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              />
            </View>
          </ScrollView>

          {/* Footer */}
          <DialogFooter className="flex-row items-center justify-end gap-2 px-5 py-3.5 border-t border-border bg-muted/20">
            <Button variant="outline" onPress={onClose} disabled={loading}>
              <Text>Batal</Text>
            </Button>
            <Button variant="destructive" onPress={handleSubmit} disabled={loading}>
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white font-semibold">Konfirmasi Pelepasan Aset</Text>
              )}
            </Button>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
