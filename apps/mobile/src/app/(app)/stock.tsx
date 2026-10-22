import * as React from "react";
import { View, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowLeftRight,
  ArrowRight,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { BatchSerialRegisterModal } from "@/components/taska/serial-item-picker";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { PageHeader, Chip, FormField } from "@/components/taska/basics";
import { DataTable } from "@/components/taska/data-table";
import { StatusBadge } from "@/components/taska/status-badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/taska/dialogs";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/store/app-store";
import { api } from "@/services/api";
import { rupiah, compareDesc } from "@/lib/format";
import type { Row } from "@/constants/modules";
import { colors } from "@/tokens";

const TABS = [
  "List Barang & Jasa",
  "Per Gudang",
  "Per Serial Number",
  "Pergerakan Stok",
  "Reservasi Project",
] as const;

export default function StockScreen() {
  const router = useRouter();
  const { data, toast, reload, refreshModule, addRow } = useApp();

  const hasFetchedRef = React.useRef(false);
  React.useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    if (refreshModule) {
      void Promise.all([
        refreshModule("products"),
        refreshModule("warehouses"),
        refreshModule("serials"),
        refreshModule("movements"),
        refreshModule("reservations"),
      ]);
    }
  }, [refreshModule]);

  const products: Row[] = data.products ?? [];
  const warehouses: Row[] = data.warehouses ?? [];
  const serials: Row[] = data.serials ?? [];
  const movements: Row[] = data.movements ?? [];
  const reservations: Row[] = data.reservations ?? [];
  const stockSummary: any[] = data.stockSummary ?? [];

  const [activeTab, setActiveTab] = React.useState<typeof TABS[number]>("List Barang & Jasa");
  const [itemFilter, setItemFilter] = React.useState<"all" | "sn" | "non-sn" | "jasa">("all");
  const [selectedWarehouse, setSelectedWarehouse] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");

  const [addItemOpen, setAddItemOpen] = React.useState(false);
  const [newItemKind, setNewItemKind] = React.useState<"BARANG_SN" | "BARANG_NON_SN" | "JASA">("BARANG_SN");
  const [newItemName, setNewItemName] = React.useState("");
  const [newItemSku, setNewItemSku] = React.useState("");
  const [newItemBrand, setNewItemBrand] = React.useState("");
  const [newItemCategory, setNewItemCategory] = React.useState("");
  const [newItemUnit, setNewItemUnit] = React.useState("unit");
  const [newItemPrice, setNewItemPrice] = React.useState("");
  const [newItemMin, setNewItemMin] = React.useState("5");

  async function handleSaveNewItem() {
    if (!newItemName.trim() || !newItemSku.trim()) {
      toast("Nama barang/jasa dan kode SKU wajib diisi", "danger");
      return;
    }
    const isJasa = newItemKind === "JASA";
    const isSn = newItemKind === "BARANG_SN";
    await addRow("products", {
      nama: newItemName.trim(),
      sku: newItemSku.trim().toUpperCase(),
      type: isJasa ? "JASA" : "BARANG",
      jenisItem: isJasa ? "Jasa" : "Barang",
      merk: isJasa ? "-" : (newItemBrand.trim() || undefined),
      kategori: newItemCategory || data.productCategories?.[0]?.nama || "Umum",
      satuan: newItemUnit || (isJasa ? "lot" : "unit"),
      hargaBeli: Number(String(newItemPrice).replace(/\D/g, "")) || 0,
      min: isJasa ? 0 : (Number(newItemMin) || 0),
      berSN: isSn,
    });
    setAddItemOpen(false);
    setNewItemName("");
    setNewItemSku("");
    setNewItemBrand("");
    setNewItemPrice("");
    toast(`${isJasa ? "Jasa" : isSn ? "Barang Ber-SN" : "Barang Non-SN"} berhasil ditambahkan`);
  }

  const [transferOpen, setTransferOpen] = React.useState(false);
  const [replacementOpen, setReplacementOpen] = React.useState(false);
  const [batchSnOpen, setBatchSnOpen] = React.useState(false);
  const [batchSnDefaultProductId, setBatchSnDefaultProductId] = React.useState<string>("");

  const [transferProd, setTransferProd] = React.useState("");
  const [transferFrom, setTransferFrom] = React.useState("");
  const [transferTo, setTransferTo] = React.useState("");
  const [transferQty, setTransferQty] = React.useState("5");

  const [oldSn, setOldSn] = React.useState("");
  const [newSn, setNewSn] = React.useState("");
  const [replaceReason, setReplaceReason] = React.useState("");

  const activeWarehouse = selectedWarehouse || String(warehouses[0]?.nama ?? "");
  const activeTransferProd = transferProd || String(products[0]?.nama ?? "");
  const activeTransferFrom = transferFrom || String(warehouses[0]?.nama ?? "");
  const activeTransferTo = transferTo || String(warehouses[1]?.nama ?? warehouses[0]?.nama ?? "");

  const selectedWarehouseRow = warehouses.find((w) => w.nama === activeWarehouse) ?? warehouses[0];

  function saldoOfProduct(productId: string): number {
    return stockSummary
      .filter((s: any) => String(s.productId) === productId)
      .reduce((a: number, s: any) => a + Number(s.saldo ?? 0), 0);
  }

  function summaryOfProductWarehouse(productId: string, warehouseId: string) {
    return stockSummary.find(
      (s: any) => String(s.productId) === productId && String(s.warehouseId) === warehouseId
    );
  }

  async function handleTransfer() {
    const prod = products.find((p) => p.nama === activeTransferProd);
    const from = warehouses.find((w) => w.nama === activeTransferFrom);
    const to = warehouses.find((w) => w.nama === activeTransferTo);
    if (!prod || !from || !to) {
      toast("Lengkapi barang, gudang asal, dan tujuan", "danger");
      return;
    }
    try {
      await api("POST", "/movements/transfer", {
        productId: Number(prod.id),
        fromWarehouseId: Number(from.id),
        toWarehouseId: Number(to.id),
        qty: Number(transferQty) || 1,
      });
      setTransferOpen(false);
      toast(`Transfer ${transferQty} unit dari ${activeTransferFrom} ke ${activeTransferTo} diproses`);
      await reload();
    } catch (e: any) {
      toast(e?.message ?? "Gagal transfer", "danger");
    }
  }

  async function handleReplacement() {
    if (!oldSn || !newSn || !replaceReason.trim()) {
      toast("Semua field unit pengganti wajib diisi", "danger");
      return;
    }
    const unit = serials.find((s) => String(s.sn) === oldSn.trim());
    if (!unit) {
      toast("SN lama tidak ditemukan", "danger");
      return;
    }
    try {
      await api("POST", `/serials/${unit.id}/replace`, {
        newSn: newSn.trim(),
        reason: replaceReason.trim(),
      });
      setReplacementOpen(false);
      toast(`Penggantian SN ${oldSn} dengan ${newSn} dicatat`);
      setOldSn("");
      setNewSn("");
      setReplaceReason("");
      await reload();
    } catch (e: any) {
      toast(e?.message ?? "Gagal mengganti unit", "danger");
    }
  }

  const filteredProducts = React.useMemo(() => {
    let list = !searchQuery.trim()
      ? products
      : products.filter(
          (p) =>
            String(p.nama ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            String(p.sku ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            String(p.kategori ?? "").toLowerCase().includes(searchQuery.toLowerCase())
        );
    if (itemFilter === "sn") {
      list = list.filter((p) => p.type !== "JASA" && !!p.berSN);
    } else if (itemFilter === "non-sn") {
      list = list.filter((p) => p.type !== "JASA" && !p.berSN);
    } else if (itemFilter === "jasa") {
      list = list.filter((p) => p.type === "JASA" || p.jenisItem === "Jasa");
    }
    return [...list].sort(compareDesc);
  }, [products, searchQuery, itemFilter]);

  const filteredSerials = React.useMemo(() => {
    const list = !searchQuery.trim()
      ? serials
      : serials.filter(
          (s) =>
            String(s.sn ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            String(s.produk ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            String(s.gudang ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            String(s.project ?? "").toLowerCase().includes(searchQuery.toLowerCase())
        );
    return [...list].sort(compareDesc);
  }, [serials, searchQuery]);

  const filteredMovements = React.useMemo(() => {
    const list = !searchQuery.trim()
      ? movements
      : movements.filter(
          (m) =>
            String(m.produk ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            String(m.kategori ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            String(m.gudang ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            String(m.project ?? "").toLowerCase().includes(searchQuery.toLowerCase())
        );
    return [...list].sort(compareDesc);
  }, [movements, searchQuery]);

  const filteredReservations = React.useMemo(() => {
    const list = !searchQuery.trim()
      ? reservations
      : reservations.filter(
          (r) =>
            String(r.produk ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            String(r.project ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            String(r.sn ?? "").toLowerCase().includes(searchQuery.toLowerCase())
        );
    return [...list].sort(compareDesc);
  }, [reservations, searchQuery]);

  const matchedSerial = React.useMemo(() => {
    if (!searchQuery.trim()) return null;
    const clean = searchQuery.trim().toUpperCase();
    return serials.find((s) => String(s.sn).toUpperCase() === clean);
  }, [serials, searchQuery]);

  const [selectedDetail, setSelectedDetail] = React.useState<{
    type: "product" | "warehouse_product" | "serial" | "movement" | "reservation";
    data: any;
  } | null>(null);

  return (
    <View className="gap-4">
      <PageHeader
        title="Persediaan Gudang — List Barang, Jasa & SN"
        subtitle="Manajemen daftar barang (Ber-SN & Non-SN), katalog jasa, stok multi-gudang, dan stok opname"
        action={
          <View className="flex-row flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onPress={() => setAddItemOpen(true)}
            >
              <Plus size={16} color={colors.text} />
              <Text>Tambah Barang / Jasa</Text>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onPress={() => {
                setBatchSnDefaultProductId("");
                setBatchSnOpen(true);
              }}
            >
              <Plus size={16} color={colors.text} />
              <Text>Tambah Barang per SN</Text>
            </Button>
            <Button variant="outline" size="sm" onPress={() => setTransferOpen(true)}>
              <ArrowLeftRight size={16} color={colors.text} />
              <Text>Transfer Gudang</Text>
            </Button>
            <Button variant="outline" size="sm" onPress={() => setReplacementOpen(true)}>
              <RefreshCw size={16} color={colors.text} />
              <Text>Unit Pengganti</Text>
            </Button>
            <Button size="sm" onPress={() => router.push("/opname")}>
              <Text>Stok Opname</Text>
            </Button>
          </View>
        }
      />

      {/* Universal Search Bar di Halaman Stok */}
      <View className="bg-input border-border h-11 flex-row items-center gap-2 rounded-xl border px-3">
        <Search size={16} color={colors.muted} />
        <Input
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Cari nama barang, kode SKU, kategori, atau scan barcode / Serial Number (SN)..."
          className="h-10 flex-1 border-0 bg-transparent px-0 shadow-none text-xs focus-visible:ring-0 focus-visible:ring-offset-0 focus:ring-0 focus:outline-none focus:border-transparent outline-none ring-0 web:focus-visible:ring-0 web:focus-visible:outline-none web:outline-none"
          style={{ outline: "none", outlineStyle: "none", boxShadow: "none" } as any}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery ? (
          <Pressable onPress={() => setSearchQuery("")} hitSlop={8} className="p-1">
            <X size={15} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      {/* Quick Match jika barcode/SN cocok */}
      {matchedSerial && (
        <Pressable
          onPress={() => setSelectedDetail({ type: "serial", data: matchedSerial })}
          className="bg-card border-primary/40 hover:bg-panel flex-row items-center justify-between p-3 rounded-xl border gap-2 shadow-sm"
        >
          <View className="flex-row items-center gap-2 flex-1">
            <Search size={16} color={colors.primary} />
            <Text className="text-xs font-medium text-foreground">
              Unit SN Ditemukan: <Text className="font-mono font-bold text-primary">{matchedSerial.sn}</Text> — {matchedSerial.produk} ({matchedSerial.gudang})
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <StatusBadge status={matchedSerial.status ?? "Tersedia"} />
            <Text className="text-xs text-primary font-semibold">Buka Detail Unit →</Text>
          </View>
        </Pressable>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {TABS.map((t) => (
          <Chip key={t} label={t} active={activeTab === t} onPress={() => setActiveTab(t)} />
        ))}
      </ScrollView>

      {activeTab === "List Barang & Jasa" && (
        <View className="gap-3">
          <View className="flex-row flex-wrap items-center gap-2">
            <Chip
              label={`Semua (${products.length})`}
              active={itemFilter === "all"}
              onPress={() => setItemFilter("all")}
            />
            <Chip
              label={`Barang Ber-SN (${products.filter((p) => p.type !== "JASA" && p.berSN).length})`}
              active={itemFilter === "sn"}
              onPress={() => setItemFilter("sn")}
            />
            <Chip
              label={`Barang Non-SN (${products.filter((p) => p.type !== "JASA" && !p.berSN).length})`}
              active={itemFilter === "non-sn"}
              onPress={() => setItemFilter("non-sn")}
            />
            <Chip
              label={`Jasa (${products.filter((p) => p.type === "JASA").length})`}
              active={itemFilter === "jasa"}
              onPress={() => setItemFilter("jasa")}
            />
          </View>
          <DataTable
            columns={[
              { key: "nama", label: "Nama Barang / Jasa", primary: true, flex: 1.8 },
              { key: "sku", label: "SKU / Kode", flex: 1 },
              { key: "tipeDisplay", label: "Tipe Item", flex: 1.1 },
              { key: "kategori", label: "Kategori", flex: 1 },
              { key: "totalDisplay", label: "Total Stok / Tarif", flex: 1.2 },
              { key: "minDisplay", label: "Batas Min", flex: 0.9 },
              { key: "statusStok", label: "Status", fmt: "status", flex: 1 },
            ]}
            rows={filteredProducts.map((p) => {
              const isJasa = p.type === "JASA" || p.jenisItem === "Jasa";
              const total = saldoOfProduct(String(p.id));
              const satuan = String(p.satuan ?? "");
              return {
                ...p,
                tipeDisplay: isJasa ? "Jasa" : p.berSN ? "Barang Ber-SN" : "Barang Non-SN",
                totalDisplay: isJasa ? `${rupiah(p.hargaBeli || 0)} / ${satuan || "lot"}` : `${total} ${satuan}`,
                minDisplay: isJasa ? "-" : `${p.min ?? 0} ${satuan}`,
                statusStok: isJasa ? "Aktif" : total < Number(p.min ?? 0) ? "Stok Menipis" : "Tersedia",
              };
            })}
            pageSize={8}
            onRowPress={(p) => setSelectedDetail({ type: "product", data: p })}
          />
        </View>
      )}

      {activeTab === "Per Gudang" && (
        <View className="gap-4">
          <View className="flex-row flex-wrap gap-2">
            {warehouses.map((w) => (
              <Chip
                key={w.id}
                label={String(w.nama)}
                active={(selectedWarehouse || warehouses[0]?.nama) === w.nama}
                onPress={() => setSelectedWarehouse(String(w.nama))}
              />
            ))}
          </View>

          <DataTable
            columns={[
              { key: "nama", label: "Nama Barang", primary: true, flex: 1.8 },
              { key: "merkDisplay", label: "Merk", flex: 0.9 },
              { key: "sku", label: "SKU", flex: 1 },
              { key: "tipeSN", label: "Tipe", flex: 0.9 },
              { key: "masukDisplay", label: "Masuk", flex: 0.9 },
              { key: "keluarDisplay", label: "Keluar", flex: 0.9 },
              { key: "transferInDisplay", label: "Transfer Masuk", flex: 1.1 },
              { key: "transferOutDisplay", label: "Transfer Keluar", flex: 1.1 },
              { key: "saldo", label: "Saldo Akhir", flex: 1.1 },
              { key: "statusStok", label: "Status", fmt: "status", flex: 1 },
            ]}
            rows={filteredProducts.map((p) => {
              const sRow = summaryOfProductWarehouse(String(p.id), String(selectedWarehouseRow?.id ?? ""));
              const qty = Number(sRow?.saldo ?? 0);
              const total = saldoOfProduct(String(p.id));
              return {
                ...p,
                merkDisplay: p.merk || p.brand || "-",
                tipeSN: p.berSN ? "Serial" : "Curah",
                gudang: selectedWarehouseRow?.nama ?? selectedWarehouse,
                masukDisplay: `${sRow?.masuk ?? 0}`,
                keluarDisplay: `${sRow?.keluar ?? 0}`,
                transferInDisplay: `${sRow?.transferMasuk ?? 0}`,
                transferOutDisplay: `${sRow?.transferKeluar ?? 0}`,
                saldo: `${qty} ${p.satuan ?? ""}`,
                statusStok: total < Number(p.min ?? 0) ? "Stok Menipis" : "Tersedia",
              };
            })}
            pageSize={8}
            onRowPress={(wp) => setSelectedDetail({ type: "warehouse_product", data: wp })}
          />
        </View>
      )}

      {activeTab === "Per Serial Number" && (
        <DataTable
          columns={[
            { key: "sn", label: "Serial Number", primary: true, flex: 1.5 },
            { key: "produk", label: "Produk", flex: 1.6 },
            { key: "gudang", label: "Lokasi Gudang", flex: 1.2 },
            { key: "project", label: "Alokasi Project", flex: 1.4 },
            { key: "garansiDisplay", label: "Masa Garansi", flex: 1.2 },
            { key: "status", label: "Status Unit", fmt: "status", flex: 1 },
          ]}
          rows={filteredSerials.map((s) => ({
            ...s,
            garansiDisplay: s.garansiBerakhir || s.garansiMulai || "-",
          }))}
          pageSize={8}
          onRowPress={(s) => setSelectedDetail({ type: "serial", data: s })}
        />
      )}

      {activeTab === "Pergerakan Stok" && (
        <DataTable
          columns={[
            { key: "produk", label: "Nama Barang", primary: true, flex: 1.8 },
            { key: "kategori", label: "Kategori Mutasi", flex: 1.3 },
            { key: "gudang", label: "Gudang", flex: 1.2 },
            { key: "project", label: "Project", flex: 1.3 },
            { key: "qtyDisplay", label: "Jumlah", flex: 0.9 },
            { key: "waktu", label: "Tanggal Mutasi", flex: 1.2 },
            { key: "jenis", label: "Jenis Mutasi", fmt: "status", flex: 1 },
          ]}
          rows={filteredMovements.map((m) => ({
            ...m,
            qtyDisplay: `${m.qty ?? 0} unit`,
          }))}
          pageSize={8}
          onRowPress={(m) => setSelectedDetail({ type: "movement", data: m })}
        />
      )}

      {activeTab === "Reservasi Project" && (
        <DataTable
          columns={[
            { key: "produk", label: "Nama Barang", primary: true, flex: 1.8 },
            { key: "project", label: "Project Pemesan", flex: 1.6 },
            { key: "sn", label: "Serial Number", flex: 1.2 },
            { key: "qtyDisplay", label: "Jumlah Ditahan", flex: 1.1 },
            { key: "status", label: "Status Alokasi", fmt: "status", flex: 1 },
          ]}
          rows={filteredReservations.map((r) => ({
            ...r,
            qtyDisplay: `${r.qty ?? 0} unit`,
            status: r.status === "Dirilis" ? "Selesai" : "Reserved",
          }))}
          pageSize={8}
          onRowPress={(r) => setSelectedDetail({ type: "reservation", data: r })}
        />
      )}

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="sm:max-w-xl md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transfer Antar Gudang</DialogTitle>
          </DialogHeader>
          <View className="gap-4">
            <FormField label="Pilih Barang" required>
              <SearchableSelect
                value={activeTransferProd}
                onChange={setTransferProd}
                options={products.map((p) => String(p.nama))}
              />
            </FormField>
            <FormField label="Gudang Asal" required>
              <SearchableSelect
                value={activeTransferFrom}
                onChange={setTransferFrom}
                options={warehouses.map((w) => String(w.nama))}
              />
            </FormField>
            <FormField label="Gudang Tujuan" required>
              <SearchableSelect
                value={activeTransferTo}
                onChange={setTransferTo}
                options={warehouses.map((w) => String(w.nama))}
              />
            </FormField>
            <FormField label="Jumlah Transfer" required>
              <Input
                value={transferQty}
                onChangeText={setTransferQty}
                keyboardType="numeric"
              />
            </FormField>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setTransferOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleTransfer}>
              <Text>Kirim Transfer</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={replacementOpen} onOpenChange={setReplacementOpen}>
        <DialogContent className="sm:max-w-xl md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Penggantian Unit Rusak</DialogTitle>
          </DialogHeader>
          <View className="gap-4">
            <Text className="text-text-secondary text-xs">
              Hubungkan SN unit lama yang bermasalah dengan SN unit baru pengganti. Wajib menyertakan alasan.
            </Text>
            <FormField label="Serial Number Lama (Rusak)" required>
              <Input
                value={oldSn}
                onChangeText={setOldSn}
                placeholder="Contoh: SN-PR01-2601"
              />
            </FormField>
            <FormField label="Serial Number Baru (Pengganti)" required>
              <Input
                value={newSn}
                onChangeText={setNewSn}
                placeholder="Contoh: SN-PR01-2688"
              />
            </FormField>
            <FormField label="Alasan Penggantian Unit" required>
              <Textarea
                value={replaceReason}
                onChangeText={setReplaceReason}
                placeholder="Contoh: Port LAN mati total setelah disambar petir"
              />
            </FormField>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setReplacementOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleReplacement}>
              <Text>Simpan Unit Pengganti</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Detail Data Baris */}
      <Dialog open={!!selectedDetail} onOpenChange={(v) => !v && setSelectedDetail(null)}>
        <DialogContent className="sm:max-w-xl md:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedDetail?.type === "product" && "Detail Barang & Stok"}
              {selectedDetail?.type === "warehouse_product" && "Detail Stok Gudang"}
              {selectedDetail?.type === "serial" && "Detail Unit Serial Number"}
              {selectedDetail?.type === "movement" && "Detail Pergerakan Stok"}
              {selectedDetail?.type === "reservation" && "Detail Reservasi Project"}
            </DialogTitle>
          </DialogHeader>

          {selectedDetail?.type === "product" && (() => {
            const p = selectedDetail.data;
            const whBreakdown = stockSummary.filter((s) => String(s.productId) === String(p.id));
            const pSerials = serials.filter((s) => String(s.productId) === String(p.id));
            return (
              <View className="gap-4 py-2">
                <View className="flex-row items-center justify-between border-b border-border pb-3">
                  <View className="flex-1 pr-2">
                    <Text className="text-base font-bold text-foreground">{p.nama}</Text>
                    <Text className="text-xs text-muted-foreground">SKU: {p.sku} • Kategori: {p.kategori}</Text>
                  </View>
                  <StatusBadge status={p.statusStok ?? "Tersedia"} />
                </View>

                <View className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <View className="bg-card border-border rounded-lg border p-3">
                    <Text className="text-[11px] text-muted-foreground">Total Stok</Text>
                    <Text className="text-base font-bold text-foreground">{p.totalDisplay ?? "0"}</Text>
                  </View>
                  <View className="bg-card border-border rounded-lg border p-3">
                    <Text className="text-[11px] text-muted-foreground">Batas Minimal</Text>
                    <Text className="text-base font-bold text-foreground">{p.minDisplay ?? "0"}</Text>
                  </View>
                  <View className="bg-card border-border rounded-lg border p-3">
                    <Text className="text-[11px] text-muted-foreground">Wajib SN</Text>
                    <Text className="text-base font-bold text-foreground">{p.berSN ? "Ya" : "Tidak"}</Text>
                  </View>
                  <View className="bg-card border-border rounded-lg border p-3">
                    <Text className="text-[11px] text-muted-foreground">Garansi</Text>
                    <Text className="text-base font-bold text-foreground">{p.garansi ? `${p.garansi} Bln` : "-"}</Text>
                  </View>
                </View>

                {p.hargaBeli ? (
                  <View className="bg-card border-border rounded-lg border p-3">
                    <Text className="text-[11px] text-muted-foreground">Estimasi Harga Beli / Modal</Text>
                    <Text className="text-sm font-semibold text-foreground">{rupiah(p.hargaBeli)}</Text>
                  </View>
                ) : null}

                {/* Sebaran Stok per Gudang */}
                <View className="gap-2">
                  <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sebaran Stok di Gudang</Text>
                  {whBreakdown.length > 0 ? (
                    <View className="bg-card border-border divide-y divide-border rounded-lg border">
                      {whBreakdown.map((wh) => (
                        <View key={wh.warehouseId} className="flex-row items-center justify-between p-3">
                          <Text className="text-sm font-medium text-foreground">{wh.warehouseName}</Text>
                          <Text className="text-sm font-bold text-primary">{wh.saldo} {p.satuan ?? ""}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text className="text-xs italic text-muted-foreground">Belum ada rincian gudang.</Text>
                  )}
                </View>

                {/* Unit Serial Number */}
                {p.berSN && (
                  <View className="gap-2">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Daftar Unit per-SN ({pSerials.length} Unit)
                      </Text>
                      <Button
                        size="sm"
                        variant="outline"
                        onPress={() => {
                          setBatchSnDefaultProductId(String(p.id));
                          setBatchSnOpen(true);
                        }}
                      >
                        <Plus size={14} color={colors.text} />
                        <Text className="text-xs">+ Tambah Unit SN</Text>
                      </Button>
                    </View>
                    {pSerials.length > 0 ? (
                      <View className="bg-card border-border max-h-56 divide-y divide-border overflow-y-auto rounded-lg border">
                        {pSerials.map((s, idx) => (
                          <View key={s.id} className="flex-row items-center justify-between p-2.5">
                            <View className="flex-1 pr-2">
                              <Text className="font-mono text-xs font-semibold text-foreground">
                                #{idx + 1} • {s.sn}
                              </Text>
                              <Text className="text-[10px] text-muted-foreground">
                                Lokasi: {s.gudang} • {s.project && s.project !== "-" ? s.project : "Stok Bebas (Di Gudang)"}
                              </Text>
                            </View>
                            <StatusBadge status={s.status ?? "Tersedia"} />
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text className="text-xs italic text-muted-foreground">
                        Belum ada unit Serial Number terdaftar untuk produk ini. Klik &quot;+ Tambah Unit SN&quot; untuk mendaftarkan unit per-SN.
                      </Text>
                    )}
                  </View>
                )}

                <View className="flex-row gap-2 pt-3 border-t border-border mt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onPress={() => {
                      setSelectedDetail(null);
                      router.push("/opname");
                    }}
                  >
                    <Text className="text-xs">Sesuaikan Stok (Opname)</Text>
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onPress={() => {
                      setSelectedDetail(null);
                      router.push("/receiving/new" as any);
                    }}
                  >
                    <Text className="text-xs">Terima Barang (PO)</Text>
                  </Button>
                </View>
              </View>
            );
          })()}

          {selectedDetail?.type === "warehouse_product" && (() => {
            const wp = selectedDetail.data;
            const wpSerials = serials.filter(
              (s) => String(s.productId) === String(wp.id) && s.gudang === wp.gudang
            );
            return (
              <View className="gap-4 py-2">
                <View className="flex-row items-center justify-between border-b border-border pb-3">
                  <View className="flex-1 pr-2">
                    <Text className="text-base font-bold text-foreground">{wp.nama}</Text>
                    <Text className="text-xs text-muted-foreground">Lokasi: {wp.gudang} • SKU: {wp.sku}</Text>
                  </View>
                  <StatusBadge status={wp.statusStok ?? "Tersedia"} />
                </View>

                <View className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <View className="bg-card border-border rounded-lg border p-3">
                    <Text className="text-[11px] text-muted-foreground">Saldo Akhir</Text>
                    <Text className="text-base font-bold text-primary">{wp.saldo}</Text>
                  </View>
                  <View className="bg-card border-border rounded-lg border p-3">
                    <Text className="text-[11px] text-muted-foreground">Barang Masuk</Text>
                    <Text className="text-base font-bold text-emerald-500">{wp.masukDisplay}</Text>
                  </View>
                  <View className="bg-card border-border rounded-lg border p-3">
                    <Text className="text-[11px] text-muted-foreground">Barang Keluar</Text>
                    <Text className="text-base font-bold text-amber-500">{wp.keluarDisplay}</Text>
                  </View>
                  <View className="bg-card border-border rounded-lg border p-3">
                    <Text className="text-[11px] text-muted-foreground">Transfer (In / Out)</Text>
                    <Text className="text-base font-bold text-foreground">{wp.transferInDisplay} / {wp.transferOutDisplay}</Text>
                  </View>
                </View>

                {wpSerials.length > 0 && (
                  <View className="gap-2">
                    <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Serial Number di Gudang Ini ({wpSerials.length})</Text>
                    <View className="bg-card border-border max-h-48 divide-y divide-border overflow-y-auto rounded-lg border">
                      {wpSerials.map((s) => (
                        <View key={s.id} className="flex-row items-center justify-between p-2.5">
                          <Text className="font-mono text-xs font-semibold text-foreground">{s.sn}</Text>
                          <StatusBadge status={s.status ?? "Tersedia"} />
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            );
          })()}

          {selectedDetail?.type === "serial" && (() => {
            const s = selectedDetail.data;
            return (
              <View className="gap-4 py-2">
                <View className="flex-row items-center justify-between border-b border-border pb-3">
                  <View className="flex-1 pr-2">
                    <Text className="font-mono text-lg font-bold text-foreground">{s.sn}</Text>
                    <Text className="text-xs text-muted-foreground">{s.produk} ({s.sku})</Text>
                  </View>
                  <StatusBadge status={s.status ?? "Tersedia"} />
                </View>

                <View className="bg-card border-border space-y-2 rounded-lg border p-3">
                  <View className="flex-row justify-between py-1 border-b border-border">
                    <Text className="text-xs text-muted-foreground">Lokasi Gudang</Text>
                    <Text className="text-xs font-semibold text-foreground">{s.gudang || "-"}</Text>
                  </View>
                  <View className="flex-row justify-between py-1 border-b border-border">
                    <Text className="text-xs text-muted-foreground">Alokasi Project</Text>
                    <Text className="text-xs font-semibold text-foreground">{s.project || "Bebas / Tidak dialokasikan"}</Text>
                  </View>
                  <View className="flex-row justify-between py-1 border-b border-border">
                    <Text className="text-xs text-muted-foreground">Mulai Garansi</Text>
                    <Text className="text-xs font-semibold text-foreground">{s.garansiMulai || "-"}</Text>
                  </View>
                  <View className="flex-row justify-between py-1 border-b border-border">
                    <Text className="text-xs text-muted-foreground">Garansi Berakhir</Text>
                    <Text className="text-xs font-semibold text-foreground">{s.garansiBerakhir || "-"}</Text>
                  </View>
                  {s.digantiDengan ? (
                    <View className="flex-row justify-between py-1">
                      <Text className="text-xs text-rose-500 font-semibold">Diganti Oleh SN</Text>
                      <Text className="font-mono text-xs font-bold text-rose-500">{s.digantiDengan}</Text>
                    </View>
                  ) : null}
                </View>

                {s.status === "Rusak" && (
                  <Button
                    className="w-full gap-2"
                    onPress={() => {
                      setOldSn(s.sn);
                      setSelectedDetail(null);
                      setReplacementOpen(true);
                    }}
                  >
                    <RefreshCw size={14} color="#000" />
                    <Text>Proses Penggantian Unit Ini</Text>
                  </Button>
                )}
              </View>
            );
          })()}

          {selectedDetail?.type === "movement" && (() => {
            const m = selectedDetail.data;
            return (
              <View className="gap-4 py-2">
                <View className="flex-row items-center justify-between border-b border-border pb-3">
                  <View className="flex-1 pr-2">
                    <Text className="text-base font-bold text-foreground">{m.produk}</Text>
                    <Text className="text-xs text-muted-foreground">Waktu: {m.waktu}</Text>
                  </View>
                  <StatusBadge status={m.jenis ?? "Mutasi"} />
                </View>

                <View className="bg-card border-border space-y-2 rounded-lg border p-3">
                  <View className="flex-row justify-between py-1 border-b border-border">
                    <Text className="text-xs text-muted-foreground">Kategori Mutasi</Text>
                    <Text className="text-xs font-semibold text-foreground">{m.kategori || "-"}</Text>
                  </View>
                  <View className="flex-row justify-between py-1 border-b border-border">
                    <Text className="text-xs text-muted-foreground">Jumlah Barang</Text>
                    <Text className="text-xs font-bold text-primary">{m.qtyDisplay ?? `${m.qty} unit`}</Text>
                  </View>
                  <View className="flex-row justify-between py-1 border-b border-border">
                    <Text className="text-xs text-muted-foreground">Gudang</Text>
                    <Text className="text-xs font-semibold text-foreground">{m.gudang || "-"}</Text>
                  </View>
                  <View className="flex-row justify-between py-1 border-b border-border">
                    <Text className="text-xs text-muted-foreground">Project Terkait</Text>
                    <Text className="text-xs font-semibold text-foreground">{m.project || "-"}</Text>
                  </View>
                  <View className="flex-row justify-between py-1 border-b border-border">
                    <Text className="text-xs text-muted-foreground">Petugas / PIC</Text>
                    <Text className="text-xs font-semibold text-foreground">{m.oleh || "-"}</Text>
                  </View>
                  {m.sn ? (
                    <View className="flex-row justify-between py-1 border-b border-border">
                      <Text className="text-xs text-muted-foreground">Serial Number</Text>
                      <Text className="font-mono text-xs font-semibold text-foreground">{m.sn}</Text>
                    </View>
                  ) : null}
                  {m.catatan ? (
                    <View className="pt-1">
                      <Text className="text-[11px] text-muted-foreground">Catatan / Referensi:</Text>
                      <Text className="text-xs italic text-foreground mt-0.5">{m.catatan}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })()}

          {selectedDetail?.type === "reservation" && (() => {
            const r = selectedDetail.data;
            return (
              <View className="gap-4 py-2">
                <View className="flex-row items-center justify-between border-b border-border pb-3">
                  <View className="flex-1 pr-2">
                    <Text className="text-base font-bold text-foreground">{r.produk}</Text>
                    <Text className="text-xs text-muted-foreground">SKU: {r.sku || "-"}</Text>
                  </View>
                  <StatusBadge status={r.status ?? "Reserved"} />
                </View>

                <View className="bg-card border-border space-y-2 rounded-lg border p-3">
                  <View className="flex-row justify-between py-1 border-b border-border">
                    <Text className="text-xs text-muted-foreground">Project Pemesan</Text>
                    <Text className="text-xs font-bold text-foreground">{r.project}</Text>
                  </View>
                  <View className="flex-row justify-between py-1 border-b border-border">
                    <Text className="text-xs text-muted-foreground">Jumlah Ditahan</Text>
                    <Text className="text-xs font-bold text-primary">{r.qtyDisplay ?? `${r.qty} unit`}</Text>
                  </View>
                  {r.sn ? (
                    <View className="flex-row justify-between py-1 border-b border-border">
                      <Text className="text-xs text-muted-foreground">Serial Number Alokasi</Text>
                      <Text className="font-mono text-xs font-semibold text-foreground">{r.sn}</Text>
                    </View>
                  ) : null}
                  <View className="flex-row justify-between py-1">
                    <Text className="text-xs text-muted-foreground">Tanggal Reservasi</Text>
                    <Text className="text-xs font-semibold text-foreground">{r.tanggal || "-"}</Text>
                  </View>
                </View>
              </View>
            );
          })()}

          <DialogFooter>
            <Button variant="outline" onPress={() => setSelectedDetail(null)}>
              <Text>Tutup</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BatchSerialRegisterModal
        open={batchSnOpen}
        onClose={() => setBatchSnOpen(false)}
        defaultProductId={batchSnDefaultProductId}
      />

      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah Barang (SN / Non-SN) atau Jasa</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <FormField label="Jenis Item Persediaan / Katalog" required>
              <View className="flex-row flex-wrap gap-2">
                {([
                  { key: "BARANG_SN", label: "Barang Ber-SN" },
                  { key: "BARANG_NON_SN", label: "Barang Non-SN" },
                  { key: "JASA", label: "Jasa (Instalasi / Layanan)" },
                ] as const).map((opt) => (
                  <Button
                    key={opt.key}
                    size="sm"
                    variant={newItemKind === opt.key ? "default" : "outline"}
                    onPress={() => {
                      setNewItemKind(opt.key);
                      if (opt.key === "JASA") setNewItemUnit("lot");
                      else setNewItemUnit("unit");
                    }}
                  >
                    <Text className="text-xs">{opt.label}</Text>
                  </Button>
                ))}
              </View>
            </FormField>
            <FormField label={newItemKind === "JASA" ? "Nama Layanan / Jasa" : "Nama Barang"} required>
              <Input
                value={newItemName}
                onChangeText={setNewItemName}
                placeholder={newItemKind === "JASA" ? "Contoh: Jasa Instalasi & Setting Kamera CCTV" : "Contoh: Kamera IP UNV 4MP Outdoor"}
              />
            </FormField>
            <FormField label="Kode SKU / Kode Jasa" required>
              <Input
                value={newItemSku}
                onChangeText={setNewItemSku}
                placeholder={newItemKind === "JASA" ? "Contoh: JASA-INST-CCTV" : "Contoh: UNV-IPC2124"}
              />
            </FormField>
            {newItemKind !== "JASA" ? (
              <FormField label="Merk / Brand">
                <Input value={newItemBrand} onChangeText={setNewItemBrand} placeholder="Contoh: Uniview, Hikvision, Belden" />
              </FormField>
            ) : null}
            <FormField label="Kategori">
              <SearchableSelect
                value={newItemCategory}
                onChange={setNewItemCategory}
                options={(data.productCategories || []).map((c: any) => String(c.nama))}
                placeholder="Pilih kategori..."
              />
            </FormField>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <FormField label="Satuan">
                  <SearchableSelect
                    value={newItemUnit}
                    onChange={setNewItemUnit}
                    options={newItemKind === "JASA" ? ["lot", "titik", "unit", "paket", "hari"] : ["unit", "pcs", "roll", "box", "pack", "set"]}
                  />
                </FormField>
              </View>
              <View className="flex-1">
                <FormField label={newItemKind === "JASA" ? "Tarif Dasar Jasa (Rp)" : "Harga Beli / HPP (Rp)"}>
                  <Input value={newItemPrice} onChangeText={setNewItemPrice} keyboardType="numeric" placeholder="0" />
                </FormField>
              </View>
            </View>
            {newItemKind !== "JASA" ? (
              <FormField label="Batas Stok Minimum">
                <Input value={newItemMin} onChangeText={setNewItemMin} keyboardType="numeric" placeholder="5" />
              </FormField>
            ) : null}
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setAddItemOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSaveNewItem}>
              <Text>Simpan ke Katalog</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  );
}
