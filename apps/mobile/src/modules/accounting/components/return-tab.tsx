import * as React from "react";
import { View, ScrollView, TextInput, Pressable } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Panel, KpiCard } from "@/components/taska/basics";
import { rupiah } from "@/lib/format";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import { RotateCcw, ArrowDownLeft, ArrowUpRight, CheckCircle2 } from "lucide-react-native";
import { colors } from "@/tokens";

interface ReturnTabProps {
  onRefreshParent?: () => void;
}

export function ReturnTab({ onRefreshParent }: ReturnTabProps) {
  const { toast } = useApp();
  const [returnType, setReturnType] = React.useState<"SALES" | "PURCHASE">("SALES");
  const [number, setNumber] = React.useState("");
  const [refInv, setRefInv] = React.useState("");
  const [dppStr, setDppStr] = React.useState("");
  const [ppnStr, setPpnStr] = React.useState("");
  const [costStr, setCostStr] = React.useState("");
  const [isCashRefund, setIsCashRefund] = React.useState(false);
  const [paidAccountCode, setPaidAccountCode] = React.useState("1000.02");
  const [memo, setMemo] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    const prefix = returnType === "SALES" ? "RET-SALES" : "RET-PURCHASE";
    setNumber(`${prefix}/${new Date().getFullYear()}/${Date.now().toString().slice(-4)}`);
  }, [returnType]);

  const dpp = parseFloat(dppStr.replace(/\D/g, "") || "0");
  const ppn = parseFloat(ppnStr.replace(/\D/g, "") || "0");
  const cost = parseFloat(costStr.replace(/\D/g, "") || "0");
  const total = dpp + ppn;

  const handleSubmit = async () => {
    if (dpp <= 0) {
      toast("DPP nilai retur harus lebih besar dari 0.", "danger");
      return;
    }
    setSubmitting(true);
    try {
      if (returnType === "SALES") {
        await api("POST", "/accounting/returns/sales", {
          number: number.trim(),
          dpp,
          ppn,
          total,
          costTotal: cost,
          isCashRefund,
          paidAccountCode: isCashRefund ? paidAccountCode : undefined,
          memo: memo.trim() || `Retur Penjualan #${number} (Ref: ${refInv || "-"})`,
        });
        toast(`Retur Penjualan #${number} berhasil diposting. Piutang & Pendapatan disesuaikan.`, "success");
      } else {
        await api("POST", "/accounting/returns/purchase", {
          number: number.trim(),
          dpp,
          ppn,
          total,
          isCashRefund,
          paidAccountCode: isCashRefund ? paidAccountCode : undefined,
          memo: memo.trim() || `Retur Pembelian #${number} (Ref: ${refInv || "-"})`,
        });
        toast(`Retur Pembelian #${number} berhasil diposting. Hutang & Persediaan disesuaikan.`, "success");
      }

      setDppStr("");
      setPpnStr("");
      setCostStr("");
      setMemo("");
      setRefInv("");
      const prefix = returnType === "SALES" ? "RET-SALES" : "RET-PURCHASE";
      setNumber(`${prefix}/${new Date().getFullYear()}/${Date.now().toString().slice(-4)}`);
      onRefreshParent?.();
    } catch (e: any) {
      toast(e?.message || "Gagal mencatat retur barang", "danger");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="gap-5 w-full">
      {/* Type Switcher */}
      <View className="bg-panel border border-border/80 rounded-2xl p-1.5 flex-row items-center gap-2 max-w-md">
        <Pressable
          onPress={() => setReturnType("SALES")}
          className={`flex-1 flex-row items-center justify-center gap-2 py-2 rounded-xl transition-all ${
            returnType === "SALES" ? "bg-primary shadow-sm" : "hover:bg-card/50"
          }`}
        >
          <ArrowDownLeft size={15} color={returnType === "SALES" ? "#FFFFFF" : colors.textSecondary} />
          <Text className={`text-xs font-semibold ${returnType === "SALES" ? "text-white" : "text-muted-foreground"}`}>
            Retur Penjualan (Customer)
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setReturnType("PURCHASE")}
          className={`flex-1 flex-row items-center justify-center gap-2 py-2 rounded-xl transition-all ${
            returnType === "PURCHASE" ? "bg-primary shadow-sm" : "hover:bg-card/50"
          }`}
        >
          <ArrowUpRight size={15} color={returnType === "PURCHASE" ? "#FFFFFF" : colors.textSecondary} />
          <Text className={`text-xs font-semibold ${returnType === "PURCHASE" ? "text-white" : "text-muted-foreground"}`}>
            Retur Pembelian (Vendor)
          </Text>
        </Pressable>
      </View>

      <Panel
        title={returnType === "SALES" ? "Pencatatan Retur Penjualan (Sales Return)" : "Pencatatan Retur Pembelian (Purchase Return)"}
        subtitle={
          returnType === "SALES"
            ? "Mencatat pengembalian barang dari pelanggan. Sistem membalik pendapatan (4000.01), PPN Keluaran (2100), memotong Piutang Usaha (110302) atau Kas, serta memulihkan Persediaan (1200) & HPP (5102/5101)."
            : "Mencatat pengembalian barang ke supplier. Sistem memotong Hutang Usaha (210102) atau menerima Kas Refund, membalik Persediaan (1200) dan PPN Masukan (1600)."
        }
      >
        <View className="gap-4">
          <View className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <View>
              <Text className="text-xs font-semibold text-foreground mb-1">Nomor Dokumen Retur *</Text>
              <TextInput
                value={number}
                onChangeText={setNumber}
                placeholder="Nomor retur"
                className="bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground font-mono"
              />
            </View>

            <View>
              <Text className="text-xs font-semibold text-foreground mb-1">Referensi Faktur / PO Asli</Text>
              <TextInput
                value={refInv}
                onChangeText={setRefInv}
                placeholder="Contoh: INV/2026/11/001 atau PO/2026/11/008"
                className="bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground font-mono"
              />
            </View>
          </View>

          <View className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <View>
              <Text className="text-xs font-semibold text-foreground mb-1">Nilai DPP Retur (Rp) *</Text>
              <TextInput
                value={dppStr}
                onChangeText={setDppStr}
                keyboardType="numeric"
                placeholder="0"
                className="bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground font-mono"
              />
            </View>

            <View>
              <Text className="text-xs font-semibold text-foreground mb-1">PPN Retur (Rp)</Text>
              <TextInput
                value={ppnStr}
                onChangeText={setPpnStr}
                keyboardType="numeric"
                placeholder="0 (atau 11% DPP)"
                className="bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground font-mono"
              />
            </View>

            <View>
              <Text className="text-xs font-semibold text-foreground mb-1">
                {returnType === "SALES" ? "Nilai HPP / Persediaan Pulih (Rp)" : "Total Pengurangan (Rp)"}
              </Text>
              <TextInput
                value={returnType === "SALES" ? costStr : rupiah(total)}
                onChangeText={returnType === "SALES" ? setCostStr : undefined}
                editable={returnType === "SALES"}
                keyboardType="numeric"
                placeholder={returnType === "SALES" ? "Nilai harga pokok pemulihan stok" : ""}
                className="bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground font-mono"
              />
            </View>
          </View>

          {/* Opsi Pelunasan */}
          <View className="p-3.5 bg-panel/60 border border-border/80 rounded-xl gap-2.5">
            <Text className="text-xs font-bold text-foreground">Metode Penyelesaian Retur:</Text>
            <View className="flex-row items-center gap-4">
              <Pressable
                onPress={() => setIsCashRefund(false)}
                className={`flex-row items-center gap-2 px-3 py-1.5 rounded-lg border ${
                  !isCashRefund ? "bg-primary/10 border-primary" : "border-border/60"
                }`}
              >
                <View className={`w-3.5 h-3.5 rounded-full border items-center justify-center ${!isCashRefund ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                  {!isCashRefund && <View className="w-1.5 h-1.5 rounded-full bg-white" />}
                </View>
                <Text className="text-xs text-foreground">
                  {returnType === "SALES" ? "Potong Piutang Pelanggan (AR)" : "Potong Hutang Pemasok (AP)"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setIsCashRefund(true)}
                className={`flex-row items-center gap-2 px-3 py-1.5 rounded-lg border ${
                  isCashRefund ? "bg-primary/10 border-primary" : "border-border/60"
                }`}
              >
                <View className={`w-3.5 h-3.5 rounded-full border items-center justify-center ${isCashRefund ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                  {isCashRefund && <View className="w-1.5 h-1.5 rounded-full bg-white" />}
                </View>
                <Text className="text-xs text-foreground">
                  {returnType === "SALES" ? "Refund Tunai / Transfer Kas" : "Penerimaan Refund Kas Masuk"}
                </Text>
              </Pressable>
            </View>

            {isCashRefund && (
              <View className="pt-2 flex-row items-center gap-2">
                <Text className="text-xs text-muted-foreground">Rekening Kas/Bank:</Text>
                <View className="bg-card border border-border px-2.5 py-1 rounded-lg">
                  <Text className="text-xs font-mono text-foreground">[1000.02] Bank Mandiri PT GMP</Text>
                </View>
              </View>
            )}
          </View>

          <View>
            <Text className="text-xs font-semibold text-foreground mb-1">Catatan / Alasan Retur</Text>
            <TextInput
              value={memo}
              onChangeText={setMemo}
              placeholder="Contoh: Barang cacat fisik / salah spesifikasi unit"
              className="bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground"
            />
          </View>

          <View className="flex-row justify-end pt-2">
            <Button onPress={handleSubmit} disabled={submitting} className="h-9 px-5 gap-1.5">
              <CheckCircle2 size={14} color="#FFFFFF" />
              <Text className="text-xs font-semibold text-white">
                {submitting ? "Memposting Jurnal..." : "Posting Retur ke Buku Besar"}
              </Text>
            </Button>
          </View>
        </View>
      </Panel>
    </View>
  );
}