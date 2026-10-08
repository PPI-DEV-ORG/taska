import * as React from "react";
import { View, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { AlertTriangle, Check, CheckCircle2 } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { PageHeader, Panel, Chip, FormField } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/store/app-store";
import { PRODUCTS, WAREHOUSES, STOCK_QTY } from "@/mock/data";
import { colors } from "@/tokens";

export default function StockOpnameScreen() {
  const router = useRouter();
  const { data, user, addRow, toast } = useApp();

  const [selectedWarehouse, setSelectedWarehouse] = React.useState(WAREHOUSES[1]?.nama ?? WAREHOUSES[0]?.nama ?? ""); // default Gudang Bekasi
  const [counts, setCounts] = React.useState<Record<string, string>>({
    "PR-01": "5", // Sistem 6 -> selisih -1
    "PR-02": "4", // Sistem 4 -> selisih 0
    "PR-07": "4", // Sistem 6 -> selisih -2
  });
  const [reason, setReason] = React.useState("Barang rusak di rak bawah & selisih pencatatan mutasi transfer");

  const wIdx = WAREHOUSES.findIndex((w) => w.nama === selectedWarehouse);

  function handleCountChange(pid: string, val: string) {
    setCounts((prev) => ({ ...prev, [pid]: val }));
  }

  function submitOpname() {
    addRow("opname", {
      nomor: `OP/2026/10/${Math.floor(Math.random() * 800) + 100}`,
      tanggal: "2026-10-08",
      gudang: selectedWarehouse,
      petugas: user?.name || "Eko Saputra",
      selisih: -3,
      status: "Menunggu persetujuan",
      alasan: reason,
    });
    toast("Hasil opname diajukan untuk persetujuan Finance dan Bos");
    router.replace("/stock");
  }

  return (
    <View className="max-w-3xl self-center w-full gap-5">
      <PageHeader
        back
        title="Stok Opname"
        subtitle="Perhitungan fisik stok gudang dan pengajuan penyesuaian selisih"
      />

      <View className="flex-row gap-2">
        {WAREHOUSES.map((w) => (
          <Chip
            key={w.id}
            label={w.nama}
            active={selectedWarehouse === w.nama}
            onPress={() => setSelectedWarehouse(w.nama)}
          />
        ))}
      </View>

      <Panel
        title={`Perhitungan Fisik: ${selectedWarehouse}`}
        subtitle="Masukkan hasil hitungan fisik riil di gudang. Selisih akan dikalkulasi otomatis."
      >
        <View className="gap-3">
          {PRODUCTS.slice(0, 8).map((p) => {
            const systemQty = (STOCK_QTY[p.id] || [0, 0, 0])[wIdx] || 0;
            const physQtyStr = counts[p.id] ?? String(systemQty);
            const physQty = Number(physQtyStr) || 0;
            const diff = physQty - systemQty;

            return (
              <View key={p.id} className="border-border border-b py-3 last:border-b-0">
                <View className="flex-row items-center justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-sm font-semibold">{p.nama}</Text>
                    <Text className="text-muted-foreground text-xs">SKU: {p.sku} · Sistem: {systemQty} {p.satuan}</Text>
                  </View>
                  <View className="flex-row items-center gap-3">
                    <View className="w-24">
                      <Input
                        value={physQtyStr}
                        onChangeText={(v) => handleCountChange(p.id, v.replace(/\D/g, ""))}
                        keyboardType="numeric"
                        className="h-10 text-center font-bold"
                      />
                    </View>
                    <View className="w-20 items-end">
                      {diff === 0 ? (
                        <Text className="text-success text-sm font-semibold">Cocok (0)</Text>
                      ) : diff < 0 ? (
                        <Text className="text-danger text-sm font-semibold">{diff} {p.satuan}</Text>
                      ) : (
                        <Text className="text-info text-sm font-semibold">+{diff} {p.satuan}</Text>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </Panel>

      <Panel title="Alasan Selisih & Catatan Opname">
        <FormField label="Penjelasan Selisih Fisik" required hint="Wajib menyertakan alasan untuk persetujuan Finance dan Bos">
          <Textarea
            value={reason}
            onChangeText={setReason}
            placeholder="Jelaskan temuan penyebab perbedaan stok fisik dengan sistem"
          />
        </FormField>
      </Panel>

      <View className="bg-warning/15 flex-row items-center gap-2 rounded-xl p-3">
        <AlertTriangle size={18} color={colors.warning} />
        <Text className="text-warning text-xs flex-1">
          Penyesuaian stok opname wajib disetujui bersama oleh Finance dan Bos sebelum saldo sistem dimutasi.
        </Text>
      </View>

      <Button size="lg" onPress={submitOpname}>
        <Check size={18} color={colors.background} />
        <Text>Ajukan Penyesuaian Opname</Text>
      </Button>
    </View>
  );
}
