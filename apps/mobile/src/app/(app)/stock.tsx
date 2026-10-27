import * as React from "react";
import { View, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowLeftRight,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { BatchSerialRegisterModal } from "@/components/taska/serial-item-picker";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { PageHeader, Chip } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { useApp } from "@/store/app-store";
import { compareDesc } from "@/lib/format";
import type { Row } from "@/constants/modules";
import { colors } from "@/tokens";

import { STOCK_TABS, type StockTab, type DetailTarget } from "@/modules/stock/types";
import { StockProductsTab } from "@/modules/stock/components/stock-products-tab";
import { StockWarehouseTab } from "@/modules/stock/components/stock-warehouse-tab";
import { StockSerialTab } from "@/modules/stock/components/stock-serial-tab";
import { StockMovementTab } from "@/modules/stock/components/stock-movement-tab";
import { StockReservationTab } from "@/modules/stock/components/stock-reservation-tab";
import { StockDetailDialog } from "@/modules/stock/components/stock-detail-dialog";
import { StockTransferDialog } from "@/modules/stock/components/stock-transfer-dialog";
import { StockReplacementDialog } from "@/modules/stock/components/stock-replacement-dialog";
import { StockAddItemDialog } from "@/modules/stock/components/stock-add-item-dialog";

export default function StockScreen() {
  const router = useRouter();
  const { user, data, toast, reload, refreshModule, addRow } = useApp();
  const canManageCatalog = ["super_admin", "admin", "bos", "gudang", "procurement", "finance"].includes(user?.role ?? "");
  const canManageStock = ["super_admin", "admin", "bos", "gudang", "procurement", "finance", "pm", "sales"].includes(user?.role ?? "");

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

  const [activeTab, setActiveTab] = React.useState<StockTab>("List Barang & Jasa");
  const [itemFilter, setItemFilter] = React.useState<"all" | "sn" | "non-sn" | "jasa">("all");
  const [selectedWarehouse, setSelectedWarehouse] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");

  const [addItemOpen, setAddItemOpen] = React.useState(false);
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [replacementOpen, setReplacementOpen] = React.useState(false);
  const [replacementDefaultSn, setReplacementDefaultSn] = React.useState("");
  const [batchSnOpen, setBatchSnOpen] = React.useState(false);
  const [batchSnDefaultProductId, setBatchSnDefaultProductId] = React.useState<string>("");
  const [selectedDetail, setSelectedDetail] = React.useState<DetailTarget | null>(null);

  const activeWarehouse = selectedWarehouse || String(warehouses[0]?.nama ?? "");
  const selectedWarehouseRow = warehouses.find((w) => w.nama === activeWarehouse) ?? warehouses[0];

  function saldoOfProduct(productId: string): number {
    const fromSummary = stockSummary
      .filter((s: any) => String(s.productId) === productId)
      .reduce((a: number, s: any) => a + Number(s.saldo ?? 0), 0);
    if (fromSummary > 0) return fromSummary;

    const prod = products.find((p) => String(p.id) === productId);
    if (prod?.berSN) {
      const activeSnCount = serials.filter(
        (s) =>
          (String(s.productId) === productId || (s.sku && prod.sku && s.sku === prod.sku)) &&
          (s.rawStatus === "DI_GUDANG" || s.status === "Di gudang" || !s.rawStatus || s.status === "Tersedia"),
      ).length;
      if (activeSnCount > 0) return activeSnCount;
    }
    return fromSummary;
  }

  function summaryOfProductWarehouse(productId: string, warehouseId: string) {
    return stockSummary.find(
      (s: any) => String(s.productId) === productId && String(s.warehouseId) === warehouseId
    );
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

  return (
    <View className="gap-4">
      <PageHeader
        title="Persediaan Gudang — List Barang, Jasa & SN"
        subtitle="Manajemen daftar barang (Ber-SN & Non-SN), katalog jasa, stok multi-gudang, dan stok opname"
        action={
          <View className="flex-row flex-wrap gap-2">
            {canManageCatalog ? (
              <Button
                variant="outline"
                size="sm"
                onPress={() => setAddItemOpen(true)}
              >
                <Plus size={16} color={colors.text} />
                <Text>Tambah Barang / Jasa</Text>
              </Button>
            ) : null}
            {canManageStock ? (
              <>
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
                <Button variant="outline" size="sm" onPress={() => {
                  setReplacementDefaultSn("");
                  setReplacementOpen(true);
                }}>
                  <RefreshCw size={16} color={colors.text} />
                  <Text>Unit Pengganti</Text>
                </Button>
                <Button size="sm" onPress={() => router.push("/opname")}>
                  <Text>Stok Opname</Text>
                </Button>
              </>
            ) : null}
          </View>
        }
      />

      {/* Universal Search Bar */}
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
        {STOCK_TABS.map((t) => (
          <Chip key={t} label={t} active={activeTab === t} onPress={() => setActiveTab(t)} />
        ))}
      </ScrollView>

      {activeTab === "List Barang & Jasa" && (
        <StockProductsTab
          products={products}
          filteredProducts={filteredProducts}
          itemFilter={itemFilter}
          setItemFilter={setItemFilter}
          saldoOfProduct={saldoOfProduct}
          onSelectDetail={(target) => setSelectedDetail(target)}
        />
      )}

      {activeTab === "Per Gudang" && (
        <StockWarehouseTab
          warehouses={warehouses}
          filteredProducts={filteredProducts}
          selectedWarehouse={selectedWarehouse}
          setSelectedWarehouse={setSelectedWarehouse}
          selectedWarehouseRow={selectedWarehouseRow}
          summaryOfProductWarehouse={summaryOfProductWarehouse}
          saldoOfProduct={saldoOfProduct}
          onSelectDetail={(target) => setSelectedDetail(target)}
        />
      )}

      {activeTab === "Per Serial Number" && (
        <StockSerialTab
          filteredSerials={filteredSerials}
          onSelectDetail={(target) => setSelectedDetail(target)}
        />
      )}

      {activeTab === "Pergerakan Stok" && (
        <StockMovementTab
          filteredMovements={filteredMovements}
          onSelectDetail={(target) => setSelectedDetail(target)}
        />
      )}

      {activeTab === "Reservasi Project" && (
        <StockReservationTab
          filteredReservations={filteredReservations}
          onSelectDetail={(target) => setSelectedDetail(target)}
        />
      )}

      <StockTransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        products={products}
        warehouses={warehouses}
        onSuccess={reload}
        toast={toast}
      />

      <StockReplacementDialog
        open={replacementOpen}
        onOpenChange={setReplacementOpen}
        serials={serials}
        defaultOldSn={replacementDefaultSn}
        onSuccess={reload}
        toast={toast}
      />

      <StockAddItemDialog
        open={addItemOpen}
        onOpenChange={setAddItemOpen}
        categories={data.productCategories || []}
        onSave={async (payload) => {
          await addRow("products", payload);
        }}
        toast={toast}
      />

      <StockDetailDialog
        selectedDetail={selectedDetail}
        onClose={() => setSelectedDetail(null)}
        stockSummary={stockSummary}
        serials={serials}
        onOpenBatchSn={(prodId) => {
          setBatchSnDefaultProductId(prodId);
          setBatchSnOpen(true);
        }}
        onOpenReplacement={(sn) => {
          setReplacementDefaultSn(sn);
          setReplacementOpen(true);
        }}
      />

      <BatchSerialRegisterModal
        open={batchSnOpen}
        onClose={() => setBatchSnOpen(false)}
        defaultProductId={batchSnDefaultProductId}
      />
    </View>
  );
}
