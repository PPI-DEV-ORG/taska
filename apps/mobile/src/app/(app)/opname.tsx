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

  const totalItems = PRODUCTS.length;
  let itemsCounted = 0;
  let itemsMatch = 0;
  let itemsDiff = 0;

  PRODUCTS.forEach((p) => {
    const systemQty = (STOCK_QTY[p.id] || [0, 0, 0])[wIdx] || 0;
    const physQtyStr = counts[p.id];
    if (physQtyStr !== undefined) {
      itemsCounted++;
      const physQty = Number(physQtyStr) || 0;
      if (physQty === systemQty) itemsMatch++;
      else itemsDiff++;
    } else {
      itemsMatch++;
    }
  });

  return (
    <View className="w-full gap-5">
      <PageHeader
        back
        title="Stok Opname"
        subtitle="Perhitungan fisik stok gudang dan pengajuan penyesuaian selisih"
        action={
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
        }
      />

      {/* Summary KPI Cards */}
      <View className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <View className="bg-card border-border/80 rounded-2xl border p-4 shadow-sm">
          <Text className="text-muted-foreground text-xs font-medium">Gudang Terpilih</Text>
          <Text className="text-foreground text-lg md:text-xl font-bold mt-1" numberOfLines={1}>
            {selectedWarehouse}
          </Text>
          <Text className="text-muted-foreground text-[11px] mt-0.5">Petugas: {user?.name || "Eko Saputra"}</Text>
        </View>

        <View className="bg-card border-border/80 rounded-2xl border p-4 shadow-sm">
          <Text className="text-muted-foreground text-xs font-medium">Total Produk</Text>
          <Text className="text-foreground text-lg md:text-xl font-bold mt-1">
            {totalItems} <Text className="text-xs font-normal text-muted-foreground">SKU</Text>
          </Text>
          <Text className="text-muted-foreground text-[11px] mt-0.5">Terdaftar di gudang</Text>
        </View>

        <View className="bg-card border-border/80 rounded-2xl border p-4 shadow-sm">
          <Text className="text-muted-foreground text-xs font-medium">Stok Cocok</Text>
          <Text className="text-success text-lg md:text-xl font-bold mt-1">
            {itemsMatch} <Text className="text-xs font-normal text-muted-foreground">SKU</Text>
          </Text>
          <Text className="text-success/80 text-[11px] mt-0.5">Fisik sesuai sistem</Text>
        </View>

        <View className="bg-card border-border/80 rounded-2xl border p-4 shadow-sm">
          <Text className="text-muted-foreground text-xs font-medium">Ada Selisih</Text>
          <Text className="text-danger text-lg md:text-xl font-bold mt-1">
            {itemsDiff} <Text className="text-xs font-normal text-muted-foreground">SKU</Text>
          </Text>
          <Text className="text-danger/80 text-[11px] mt-0.5">Memerlukan penyesuaian</Text>
        </View>
      </View>

      {/* Main Grid: Left side table/list of products, Right side notes & submit */}
      <View className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Kolom Kiri: Tabel Perhitungan Fisik */}
        <View className="lg:col-span-8 w-full">
          <Panel
            title={`Perhitungan Fisik: ${selectedWarehouse}`}
            subtitle="Masukkan hasil hitungan fisik riil di gudang. Selisih akan dikalkulasi otomatis."
          >
            <View className="gap-2">
              {PRODUCTS.map((p) => {
                const systemQty = (STOCK_QTY[p.id] || [0, 0, 0])[wIdx] || 0;
                const physQtyStr = counts[p.id] ?? String(systemQty);
                const physQty = Number(physQtyStr) || 0;
                const diff = physQty - systemQty;

                return (
                  <View
                    key={p.id}
                    className="border-border/60 flex-row items-center justify-between border-b py-3 last:border-b-0 hover:bg-panel/40 px-2 rounded-lg transition-colors gap-3"
                  >
                    <View className="flex-1 min-w-0">
                      <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                        {p.nama}
                      </Text>
                      <Text className="text-muted-foreground text-xs mt-0.5" numberOfLines={1}>
                        SKU: {p.sku} · Kategori: {p.kategori} · Sistem: {systemQty} {p.satuan}
                      </Text>
                    </View>

                    <View className="flex-row items-center gap-3 shrink-0">
                      <View className="w-24">
                        <Input
                          value={physQtyStr}
                          onChangeText={(v) => handleCountChange(p.id, v.replace(/\D/g, ""))}
                          keyboardType="numeric"
                          className="h-10 text-center font-bold"
                        />
                      </View>
                      <View className="w-24 items-end">
                        {diff === 0 ? (
                          <Text className="text-success text-xs sm:text-sm font-semibold">Cocok (0)</Text>
                        ) : diff < 0 ? (
                          <Text className="text-danger text-xs sm:text-sm font-semibold">{diff} {p.satuan}</Text>
                        ) : (
                          <Text className="text-info text-xs sm:text-sm font-semibold">+{diff} {p.satuan}</Text>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </Panel>
        </View>

        {/* Kolom Kanan: Catatan & Tombol Pengajuan */}
        <View className="lg:col-span-4 w-full gap-4 lg:sticky lg:top-4">
          <Panel title="Alasan Selisih & Catatan Opname">
            <FormField
              label="Penjelasan Selisih Fisik"
              required
              hint="Wajib menyertakan alasan untuk persetujuan Finance dan Bos"
            >
              <Textarea
                value={reason}
                onChangeText={setReason}
                placeholder="Jelaskan temuan penyebab perbedaan stok fisik dengan sistem"
                numberOfLines={4}
              />
            </FormField>
          </Panel>

          <View className="bg-warning/15 border border-warning/30 flex-row items-start gap-3 rounded-xl p-4">
            <AlertTriangle size={20} color={colors.warning} className="shrink-0 mt-0.5" />
            <Text className="text-warning text-xs leading-relaxed flex-1">
              Penyesuaian stok opname wajib disetujui bersama oleh Finance dan Bos sebelum saldo sistem dimutasi.
            </Text>
          </View>

          <Button size="lg" onPress={submitOpname} className="w-full">
            <Check size={18} color={colors.background} />
            <Text>Ajukan Penyesuaian Opname</Text>
          </Button>
        </View>
      </View>
    </View>
  );
}
