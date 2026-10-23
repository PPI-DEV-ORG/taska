import * as React from "react";
import { View, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { AlertTriangle, Check, Plus, RefreshCw } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { PageHeader, Panel, Chip, FormField } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormDialog, SearchableSelect } from "@/components/taska/dialogs";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/store/app-store";
import { api } from "@/services/api";
import { MODULES, type Row } from "@/constants/modules";
import { colors } from "@/tokens";

export default function StockOpnameScreen() {
  const router = useRouter();
  const { data, user, toast, reload, refreshModule } = useApp();

  const products: Row[] = data.products ?? [];
  const warehouses: Row[] = data.warehouses ?? [];
  const stockSummary: any[] = data.stockSummary ?? [];
  const serials: Row[] = data.serials ?? [];
  const damageReports: Row[] = data["damage-reports"] ?? [];

  const [reportDamageOpen, setReportDamageOpen] = React.useState(false);
  const [replacementOpen, setReplacementOpen] = React.useState(false);
  const [oldSn, setOldSn] = React.useState("");
  const [newSn, setNewSn] = React.useState("");
  const [replaceReason, setReplaceReason] = React.useState("");
  const [replaceBusy, setReplaceBusy] = React.useState(false);

  async function handleReplacement() {
    if (!oldSn.trim() || !newSn.trim() || !replaceReason.trim()) {
      toast("SN lama, SN baru pengganti, dan alasan wajib diisi", "danger");
      return;
    }
    const cleanOld = (oldSn.split(" (")[0] ?? oldSn).trim();
    const unit = serials.find((s) => String(s.sn).toLowerCase() === cleanOld.toLowerCase());
    if (!unit) {
      toast(`SN lama "${cleanOld}" tidak ditemukan di daftar serial`, "danger");
      return;
    }
    setReplaceBusy(true);
    try {
      await api("POST", `/serials/${unit.id}/replace`, {
        newSn: newSn.trim(),
        reason: replaceReason.trim(),
      });
      toast(`Unit SN ${cleanOld} berhasil diganti dengan SN ${newSn.trim()} & stok gudang diperbarui`);
      setReplacementOpen(false);
      setOldSn("");
      setNewSn("");
      setReplaceReason("");
      if (refreshModule) {
        await Promise.all([
          refreshModule("serials"),
          refreshModule("damage-reports"),
          refreshModule("movements"),
          refreshModule("products"),
        ]);
      }
      await reload();
    } catch (e: any) {
      toast(e?.message ?? "Gagal memproses penggantian unit", "danger");
    } finally {
      setReplaceBusy(false);
    }
  }

  const [selectedWarehouseId, setSelectedWarehouseId] = React.useState<string>(
    warehouses[1]?.id ?? warehouses[0]?.id ?? ""
  );
  const [counts, setCounts] = React.useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("Semua");
  const [brandFilter, setBrandFilter] = React.useState("Semua");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const selectedWarehouse = warehouses.find((w) => w.id === selectedWarehouseId);

  const availableCategories = React.useMemo(() => {
    return ["Semua", ...Array.from(new Set(products.map((p) => p.kategori).filter(Boolean)))];
  }, [products]);

  const availableBrands = React.useMemo(() => {
    return ["Semua", ...Array.from(new Set(products.map((p) => p.merk || p.brand).filter(Boolean)))];
  }, [products]);

  const filteredProducts = React.useMemo(() => {
    return products.filter((p) => {
      const pBrand = String(p.merk || p.brand || "");
      const pCat = String(p.kategori || "");
      const matchCat = categoryFilter === "Semua" || pCat === categoryFilter;
      const matchBrand = brandFilter === "Semua" || pBrand === brandFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        String(p.nama).toLowerCase().includes(q) ||
        String(p.sku).toLowerCase().includes(q) ||
        pBrand.toLowerCase().includes(q);
      return matchCat && matchBrand && matchQuery;
    });
  }, [products, categoryFilter, brandFilter, searchQuery]);

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
        subtitle="Perhitungan fisik stok gudang, laporan barang rusak, pergantian unit SN, dan pengajuan penyesuaian selisih"
        action={
          <View className="flex-row flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onPress={() => setReportDamageOpen(true)}>
              <Plus size={14} color={colors.text} />
              <Text className="text-xs">Lapor Barang Rusak / Retur</Text>
            </Button>
            <Button size="sm" variant="outline" onPress={() => setReplacementOpen(true)}>
              <RefreshCw size={14} color={colors.text} />
              <Text className="text-xs">Pergantian Unit (SN Lama → Baru)</Text>
            </Button>
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
        <View className="lg:col-span-8 w-full gap-4">
          {/* Universal Filter: Kategori, Merk & Pencarian */}
          <Panel title="Filter Target Opname">
            <View className="gap-3">
              <Input
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Cari nama barang, SKU, atau merk..."
              />
              <View className="gap-2">
                <View className="flex-row items-center gap-2">
                  <Text className="text-xs font-semibold text-muted-foreground w-16">Kategori:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5 py-0.5">
                    {availableCategories.map((c) => (
                      <Button
                        key={c}
                        size="sm"
                        variant={categoryFilter === c ? "default" : "outline"}
                        onPress={() => setCategoryFilter(c)}
                        className="h-7 px-2.5 rounded-full"
                      >
                        <Text className="text-xs">{c}</Text>
                      </Button>
                    ))}
                  </ScrollView>
                </View>

                {availableBrands.length > 2 && (
                  <View className="flex-row items-center gap-2">
                    <Text className="text-xs font-semibold text-muted-foreground w-16">Merk:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5 py-0.5">
                      {availableBrands.map((b) => (
                        <Button
                          key={b}
                          size="sm"
                          variant={brandFilter === b ? "default" : "outline"}
                          onPress={() => setBrandFilter(b)}
                          className="h-7 px-2.5 rounded-full"
                        >
                          <Text className="text-xs">{b}</Text>
                        </Button>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>
          </Panel>

          <Panel
            title={`Perhitungan Fisik: ${selectedWarehouse ? String(selectedWarehouse.nama) : "-"}`}
            subtitle={`Menampilkan ${filteredProducts.length} dari ${products.length} barang di gudang`}
          >
            <View className="gap-2">
              {filteredProducts.map((p) => {
                const pid = String(p.id);
                const systemQty = systemQtyOf(pid);
                const physQtyStr = counts[pid] ?? String(systemQty);
                const physQty = Number(physQtyStr) || 0;
                const diff = physQty - systemQty;
                const satuan = String(p.satuan ?? "");
                const merk = p.merk || p.brand;

                return (
                  <View
                    key={pid}
                    className="border-border/60 flex-row items-center justify-between border-b py-3 last:border-b-0 hover:bg-panel/40 px-2 rounded-lg transition-colors gap-3"
                  >
                    <View className="flex-1 min-w-0">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                          {String(p.nama)}
                        </Text>
                        {merk ? (
                          <View className="bg-panel border-border/60 rounded px-1.5 py-0.5 border">
                            <Text className="text-[10px] font-medium text-muted-foreground">{merk}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text className="text-muted-foreground text-xs mt-0.5" numberOfLines={1}>
                        SKU: {String(p.sku)} · Kategori: {String(p.kategori ?? "-")} · {p.berSN ? "Serial Number" : "Curah"} · Sistem: {systemQty} {satuan}
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
              {filteredProducts.length === 0 ? (
                <Text className="text-muted-foreground text-sm py-6 text-center">Tidak ada produk yang cocok dengan filter.</Text>
              ) : null}
            </View>
          </Panel>
        </View>

        <View className="lg:col-span-4 w-full gap-4 lg:sticky lg:top-4">
          <Panel
            title="Laporan Barang Rusak & Pergantian Unit (SN)"
            subtitle="Temuan barang rusak, retur, dan riwayat pergantian SN (SN lama → SN baru)"
            right={
              <View className="flex-row gap-1.5">
                <Button size="sm" variant="outline" onPress={() => setReportDamageOpen(true)}>
                  <Plus size={13} color={colors.text} />
                  <Text className="text-xs">+ Lapor Rusak</Text>
                </Button>
                <Button size="sm" onPress={() => setReplacementOpen(true)}>
                  <RefreshCw size={13} color={colors.background} />
                  <Text className="text-xs text-primary-foreground">Ganti Unit SN</Text>
                </Button>
              </View>
            }
          >
            {damageReports.length === 0 ? (
              <Text className="text-muted-foreground text-xs py-2">
                Belum ada laporan barang rusak atau retur yang tercatat.
              </Text>
            ) : (
              <View className="gap-2">
                {damageReports.slice(0, 6).map((dr) => {
                  const hasReplacement = dr.snPengganti && dr.snPengganti !== "-";
                  return (
                    <View
                      key={dr.id}
                      className="bg-panel/50 border-border/70 rounded-xl border p-2.5 gap-1.5"
                    >
                      <View className="flex-row items-center justify-between gap-2">
                        <Text className="text-xs font-bold text-foreground flex-1" numberOfLines={1}>
                          {dr.produk}
                        </Text>
                        <StatusBadge status={dr.status || "Dilaporkan"} />
                      </View>
                      <View className="flex-row items-center flex-wrap gap-1.5">
                        <StatusBadge status={dr.jenis || "Rusak"} />
                        {dr.sn && dr.sn !== "-" ? (
                          <Text className="text-[11px] font-mono text-danger font-semibold">
                            SN Lama: {dr.sn}
                          </Text>
                        ) : (
                          <Text className="text-[11px] text-muted-foreground">Qty: {dr.qty || 1}</Text>
                        )}
                        {hasReplacement ? (
                          <Text className="text-[11px] font-mono text-emerald-500 font-bold">
                            → SN Baru: {dr.snPengganti}
                          </Text>
                        ) : null}
                      </View>
                      <View className="flex-row items-center justify-between mt-0.5">
                        <Text className="text-[11px] text-muted-foreground flex-1 mr-2" numberOfLines={1}>
                          {dr.keterangan || "-"}
                        </Text>
                        {!hasReplacement && dr.sn && dr.sn !== "-" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2"
                            onPress={() => {
                              setOldSn(String(dr.sn));
                              setReplaceReason(`Penggantian saat opname untuk ${dr.produk} (SN: ${dr.sn})`);
                              setReplacementOpen(true);
                            }}
                          >
                            <Text className="text-[10px] font-semibold">Terima Ganti SN</Text>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                            onPress={() => router.push(`/damage-reports/${dr.id}` as any)}
                          >
                            <Text className="text-[10px] text-primary">Detail</Text>
                          </Button>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </Panel>

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

      <FormDialog
        def={MODULES["damage-reports"]}
        open={reportDamageOpen}
        onOpenChange={setReportDamageOpen}
      />

      <Dialog open={replacementOpen} onOpenChange={setReplacementOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Pergantian Barang / Unit Ber-SN (SN Lama → SN Baru)</DialogTitle>
          </DialogHeader>
          <View className="gap-4 py-2">
            <Text className="text-muted-foreground text-xs leading-relaxed">
              Gunakan form ini saat menerima barang pengganti (contoh: kamera SN 299292 yang rusak/retur diganti dengan kamera baru SN 94949). Sistem otomatis mengubah SN lama menjadi DIGANTI, mendaftarkan SN baru sebagai DI GUDANG, dan menambah kembali stok tersedia (+1).
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
                  placeholder="Pilih SN yang rusak / diretur..."
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
            <FormField label="Alasan / Catatan Pergantian" required>
              <Textarea
                value={replaceReason}
                onChangeText={setReplaceReason}
                placeholder="Contoh: Unit pengganti klaim retur supplier untuk kamera rusak"
              />
            </FormField>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setReplacementOpen(false)} disabled={replaceBusy}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleReplacement} disabled={replaceBusy}>
              <Text>{replaceBusy ? "Memproses..." : "Simpan Pergantian & Tambah Stok"}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  );
}
