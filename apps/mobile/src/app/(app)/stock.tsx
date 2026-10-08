import * as React from "react";
import { View, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  ArrowLeftRight,
  Boxes,
  Plus,
  RefreshCw,
  ScanLine,
  Search,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { PageHeader, Panel, Chip, EmptyState } from "@/components/taska/basics";
import { DataTable } from "@/components/taska/data-table";
import { StatusBadge } from "@/components/taska/status-badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FormField } from "@/components/taska/basics";
import { SearchableSelect } from "@/components/taska/dialogs";
import { ScanInput } from "@/components/taska/scan-input";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/store/app-store";
import {
  PRODUCTS,
  SERIALS,
  MOVEMENTS,
  RESERVATIONS,
  WAREHOUSES,
  STOCK_QTY,
  type Row,
} from "@/mock/data";
import { colors } from "@/tokens";
import { rupiah, tanggal } from "@/lib/format";

const TABS = [
  "Per Barang",
  "Per Gudang",
  "Per Serial Number",
  "Pergerakan Stok",
  "Reservasi Project",
] as const;

export default function StockScreen() {
  const router = useRouter();
  const { user, toast } = useApp();

  const [activeTab, setActiveTab] = React.useState<typeof TABS[number]>("Per Barang");
  const [selectedWarehouse, setSelectedWarehouse] = React.useState(WAREHOUSES[0]?.nama ?? "");
  const [snQuery, setSnQuery] = React.useState("");

  // Modals
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [replacementOpen, setReplacementOpen] = React.useState(false);
  const [scanModalOpen, setScanModalOpen] = React.useState(false);

  // Transfer state
  const [transferProd, setTransferProd] = React.useState(PRODUCTS[0]?.nama ?? "");
  const [transferFrom, setTransferFrom] = React.useState(WAREHOUSES[0]?.nama ?? "");
  const [transferTo, setTransferTo] = React.useState(WAREHOUSES[1]?.nama ?? WAREHOUSES[0]?.nama ?? "");
  const [transferQty, setTransferQty] = React.useState("5");

  // Unit pengganti state
  const [oldSn, setOldSn] = React.useState("");
  const [newSn, setNewSn] = React.useState("");
  const [replaceReason, setReplaceReason] = React.useState("");

  function handleTransfer() {
    setTransferOpen(false);
    toast(`Transfer ${transferQty} unit dari ${transferFrom} ke ${transferTo} diproses`);
  }

  function handleReplacement() {
    if (!oldSn || !newSn || !replaceReason.trim()) {
      toast("Semua field unit pengganti wajib diisi", "danger");
      return;
    }
    setReplacementOpen(false);
    toast(`Penggantian SN ${oldSn} dengan ${newSn} dicatat`);
    setOldSn("");
    setNewSn("");
    setReplaceReason("");
  }

  const filteredSerials = SERIALS.filter(
    (s) => !snQuery || s.sn.toLowerCase().includes(snQuery.toLowerCase()) || s.produk.toLowerCase().includes(snQuery.toLowerCase())
  );

  return (
    <View className="gap-5">
      <PageHeader
        title="Stok dan Serial Number"
        subtitle="Manajemen persediaan multi-gudang, penelusuran SN, dan mutasi barang"
        action={
          <View className="flex-row flex-wrap gap-2">
            <Button variant="outline" size="sm" onPress={() => setScanModalOpen(true)}>
              <ScanLine size={16} color={colors.text} />
              <Text>Scan SN</Text>
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

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {TABS.map((t) => (
          <Chip key={t} label={t} active={activeTab === t} onPress={() => setActiveTab(t)} />
        ))}
      </ScrollView>

      {/* Tab 1: Per Barang */}
      {activeTab === "Per Barang" && (
        <DataTable
          columns={[
            { key: "nama", label: "Nama Barang", primary: true, flex: 1.8 },
            { key: "sku", label: "SKU", flex: 1 },
            { key: "kategori", label: "Kategori", flex: 1 },
            { key: "totalDisplay", label: "Total Stok", flex: 1.2 },
            { key: "minDisplay", label: "Batas Min", flex: 1 },
            { key: "statusStok", label: "Status", fmt: "status", flex: 1 },
          ]}
          rows={PRODUCTS.map((p) => {
            const qtys = STOCK_QTY[p.id] || [0, 0, 0];
            const total = (qtys[0] ?? 0) + (qtys[1] ?? 0) + (qtys[2] ?? 0);
            return {
              ...p,
              totalDisplay: `${total} ${p.satuan}`,
              minDisplay: `${p.min} ${p.satuan}`,
              statusStok: total < p.min ? "Stok Menipis" : "Tersedia",
            };
          })}
          pageSize={8}
        />
      )}

      {/* Tab 2: Per Gudang */}
      {activeTab === "Per Gudang" && (
        <View className="gap-4">
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

          <DataTable
            columns={[
              { key: "nama", label: "Nama Barang", primary: true, flex: 1.8 },
              { key: "sku", label: "SKU", flex: 1 },
              { key: "kategori", label: "Kategori", flex: 1 },
              { key: "gudang", label: "Gudang", flex: 1.2 },
              { key: "saldo", label: "Saldo Akhir", flex: 1.2 },
            ]}
            rows={PRODUCTS.map((p) => {
              const wIdx = WAREHOUSES.findIndex((w) => w.nama === selectedWarehouse);
              const qty = (STOCK_QTY[p.id] || [0, 0, 0])[wIdx] || 0;
              return {
                ...p,
                gudang: selectedWarehouse,
                saldo: `${qty} ${p.satuan}`,
              };
            })}
            pageSize={8}
          />
        </View>
      )}

      {/* Tab 3: Per Serial Number */}
      {activeTab === "Per Serial Number" && (
        <View className="gap-4">
          <View className="bg-input border-border h-11 flex-row items-center gap-2 rounded-lg border px-3">
            <Search size={16} color={colors.muted} />
            <Input
              value={snQuery}
              onChangeText={setSnQuery}
              placeholder="Cari Serial Number atau nama produk"
              className="h-9 flex-1 border-0 bg-transparent px-0 shadow-none text-xs"
            />
          </View>

          <DataTable
            columns={[
              { key: "sn", label: "Serial Number", primary: true, flex: 1.5 },
              { key: "produk", label: "Produk", flex: 1.6 },
              { key: "gudang", label: "Lokasi Gudang", flex: 1.2 },
              { key: "project", label: "Alokasi Project", flex: 1.4 },
              { key: "garansi", label: "Masa Garansi", fmt: "date", flex: 1.2 },
              { key: "status", label: "Status Unit", fmt: "status", flex: 1 },
            ]}
            rows={filteredSerials}
            pageSize={8}
          />
        </View>
      )}

      {/* Tab 4: Pergerakan Stok */}
      {activeTab === "Pergerakan Stok" && (
        <DataTable
          columns={[
            { key: "produk", label: "Nama Barang", primary: true, flex: 1.8 },
            { key: "kategori", label: "Kategori", flex: 1 },
            { key: "gudang", label: "Gudang", flex: 1.2 },
            { key: "project", label: "Project", flex: 1.4 },
            { key: "qtyDisplay", label: "Jumlah", flex: 1 },
            { key: "tanggal", label: "Tanggal Mutasi", fmt: "date", flex: 1.2 },
            { key: "jenis", label: "Jenis Mutasi", fmt: "status", flex: 1 },
          ]}
          rows={MOVEMENTS.map((m) => ({
            ...m,
            qtyDisplay: `${m.qty} unit`,
          }))}
          pageSize={8}
        />
      )}

      {/* Tab 5: Reservasi Project */}
      {activeTab === "Reservasi Project" && (
        <DataTable
          columns={[
            { key: "produk", label: "Nama Barang", primary: true, flex: 1.8 },
            { key: "project", label: "Project Pemesan", flex: 1.6 },
            { key: "qtyDisplay", label: "Jumlah Ditahan", flex: 1.2 },
            { key: "status", label: "Status Alokasi", fmt: "status", flex: 1 },
          ]}
          rows={RESERVATIONS.map((r) => ({
            ...r,
            qtyDisplay: `${r.qty} unit`,
            status: "Reserved",
          }))}
          pageSize={8}
        />
      )}

      {/* Modal Transfer */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer Antar Gudang</DialogTitle>
          </DialogHeader>
          <View className="gap-4">
            <FormField label="Pilih Barang" required>
              <SearchableSelect
                value={transferProd}
                onChange={setTransferProd}
                options={PRODUCTS.map((p) => p.nama)}
              />
            </FormField>
            <FormField label="Gudang Asal" required>
              <SearchableSelect
                value={transferFrom}
                onChange={setTransferFrom}
                options={WAREHOUSES.map((w) => w.nama)}
              />
            </FormField>
            <FormField label="Gudang Tujuan" required>
              <SearchableSelect
                value={transferTo}
                onChange={setTransferTo}
                options={WAREHOUSES.map((w) => w.nama)}
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

      {/* Modal Unit Pengganti */}
      <Dialog open={replacementOpen} onOpenChange={setReplacementOpen}>
        <DialogContent className="sm:max-w-md">
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

      {/* Modal Scan */}
      <Dialog open={scanModalOpen} onOpenChange={setScanModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan Barcode & Validasi SN</DialogTitle>
          </DialogHeader>
          <ScanInput />
          <DialogFooter>
            <Button onPress={() => setScanModalOpen(false)}>
              <Text>Selesai</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  );
}
