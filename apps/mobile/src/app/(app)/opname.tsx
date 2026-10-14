import * as React from "react";
import { View, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { AlertTriangle, Check } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { PageHeader, Panel, Chip, FormField } from "@/components/taska/basics";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/store/app-store";
import { api } from "@/services/api";
import type { Row } from "@/constants/modules";
import { colors } from "@/tokens";

export default function StockOpnameScreen() {
  const router = useRouter();
  const { data, user, toast } = useApp();

  const products: Row[] = data.products ?? [];
  const warehouses: Row[] = data.warehouses ?? [];
  const stockSummary: any[] = data.stockSummary ?? [];

  const [selectedWarehouseId, setSelectedWarehouseId] = React.useState<string>(
    warehouses[1]?.id ?? warehouses[0]?.id ?? ""
  );
  const [counts, setCounts] = React.useState<Record<string, string>>({});
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const selectedWarehouse = warehouses.find((w) => w.id === selectedWarehouseId);

  function systemQtyOf(productId: string): number {
    const row = stockSummary.find(
      (s: any) => String(s.productId) === productId && String(s.warehouseId) === selectedWarehouseId
    );
    return Number(row?.saldo ?? 0);
  }

  function handleCountChange(pid: string, val: string) {
    setCounts((prev) => ({ ...prev, [pid]: val }));
  }

  let itemsCounted = 0;
  let itemsMatch = 0;
  let itemsDiff = 0;
  products.forEach((p) => {
    const systemQty = systemQtyOf(String(p.id));
    const physQtyStr = counts[String(p.id)];
    if (physQtyStr !== undefined) {
      itemsCounted++;
      const physQty = Number(physQtyStr) || 0;
      if (physQty === systemQty) itemsMatch++;
      else itemsDiff++;
    } else {
      itemsMatch++;
    }
  });

  async function submitOpname() {
    if (!selectedWarehouseId) {
      toast("Pilih gudang terlebih dahulu", "danger");
      return;
    }
    if (!reason.trim()) {
      toast("Alasan selisih wajib diisi", "danger");
      return;
    }
    const details = products
      .map((p) => {
        const pid = String(p.id);
        const physStr = counts[pid];
        if (physStr === undefined) return null;
        return { productId: Number(pid), countedQty: Number(physStr) || 0 };
      })
      .filter(Boolean) as { productId: number; countedQty: number }[];

    if (details.length === 0) {
      toast("Isi minimal satu hasil hitungan fisik", "danger");
      return;
    }

    setBusy(true);
    try {
      const created = await api<{ id: number }>("POST", "/opnames", {
        warehouseId: Number(selectedWarehouseId),
        date: new Date().toISOString().slice(0, 10),
        reason: reason.trim(),
        details,
      });
      if (created?.id) {
        await api("POST", `/opnames/${created.id}/submit`, {
          reason: reason.trim(),
        });
      }
      toast("Hasil opname diajukan untuk persetujuan Finance dan Bos");
      router.replace("/stock");
    } catch (e: any) {
      toast(e?.message ?? "Gagal mengajukan opname", "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="w-full gap-5">
      <PageHeader
        back
        title="Stok Opname"
        subtitle="Perhitungan fisik stok gudang dan pengajuan penyesuaian selisih"
        action={
          <View className="flex-row gap-2">
            {warehouses.map((w) => (
              <Chip
                key={w.id}
                label={String(w.nama)}
                active={selectedWarehouseId === w.id}
                onPress={() => setSelectedWarehouseId(String(w.id))}
              />
            ))}
          </View>
        }
      />

      <View className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <View className="bg-card border-border/80 rounded-2xl border p-4 shadow-sm">
          <Text className="text-muted-foreground text-xs font-medium">Gudang Terpilih</Text>
          <Text className="text-foreground text-lg md:text-xl font-bold mt-1" numberOfLines={1}>
            {selectedWarehouse ? String(selectedWarehouse.nama) : "-"}
          </Text>
          <Text className="text-muted-foreground text-[11px] mt-0.5">Petugas: {user?.name ?? "-"}</Text>
        </View>

        <View className="bg-card border-border/80 rounded-2xl border p-4 shadow-sm">
          <Text className="text-muted-foreground text-xs font-medium">Total Produk</Text>
          <Text className="text-foreground text-lg md:text-xl font-bold mt-1">
            {products.length} <Text className="text-xs font-normal text-muted-foreground">SKU</Text>
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

      <View className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <View className="lg:col-span-8 w-full">
          <Panel
            title={`Perhitungan Fisik: ${selectedWarehouse ? String(selectedWarehouse.nama) : "-"}`}
            subtitle="Masukkan hasil hitungan fisik riil di gudang. Selisih akan dikalkulasi otomatis."
          >
            <View className="gap-2">
              {products.map((p) => {
                const pid = String(p.id);
                const systemQty = systemQtyOf(pid);
                const physQtyStr = counts[pid] ?? String(systemQty);
                const physQty = Number(physQtyStr) || 0;
                const diff = physQty - systemQty;
                const satuan = String(p.satuan ?? "");

                return (
                  <View
                    key={pid}
                    className="border-border/60 flex-row items-center justify-between border-b py-3 last:border-b-0 hover:bg-panel/40 px-2 rounded-lg transition-colors gap-3"
                  >
                    <View className="flex-1 min-w-0">
                      <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                        {String(p.nama)}
                      </Text>
                      <Text className="text-muted-foreground text-xs mt-0.5" numberOfLines={1}>
                        SKU: {String(p.sku)} · Kategori: {String(p.kategori ?? "-")} · Sistem: {systemQty} {satuan}
                      </Text>
                    </View>

                    <View className="flex-row items-center gap-3 shrink-0">
                      <View className="w-24">
                        <Input
                          value={physQtyStr}
                          onChangeText={(v) => handleCountChange(pid, v.replace(/\D/g, ""))}
                          keyboardType="numeric"
                          className="h-10 text-center font-bold"
                        />
                      </View>
                      <View className="w-24 items-end">
                        {diff === 0 ? (
                          <Text className="text-success text-xs sm:text-sm font-semibold">Cocok (0)</Text>
                        ) : diff < 0 ? (
                          <Text className="text-danger text-xs sm:text-sm font-semibold">{diff} {satuan}</Text>
                        ) : (
                          <Text className="text-info text-xs sm:text-sm font-semibold">+{diff} {satuan}</Text>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
              {products.length === 0 ? (
                <Text className="text-muted-foreground text-sm py-6 text-center">Belum ada produk master.</Text>
              ) : null}
            </View>
          </Panel>
        </View>

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

          <Button size="lg" onPress={submitOpname} disabled={busy} className="w-full">
            <Check size={18} color={colors.background} />
            <Text>{busy ? "Mengajukan..." : "Ajukan Penyesuaian Opname"}</Text>
          </Button>
        </View>
      </View>
    </View>
  );
}
