import * as React from "react";
import { View, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeftRight, RefreshCw, ScanLine, Search } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { PageHeader, Chip, FormField } from "@/components/taska/basics";
import { DataTable } from "@/components/taska/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/taska/dialogs";
import { ScanInput } from "@/components/taska/scan-input";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/store/app-store";
import { api } from "@/services/api";
import type { Row } from "@/constants/modules";
import { colors } from "@/tokens";

const TABS = [
  "Per Barang",
  "Per Gudang",
  "Per Serial Number",
  "Pergerakan Stok",
  "Reservasi Project",
] as const;

export default function StockScreen() {
  const router = useRouter();
  const { data, toast, reload } = useApp();

  const products: Row[] = data.products ?? [];
  const warehouses: Row[] = data.warehouses ?? [];
  const serials: Row[] = data.serials ?? [];
  const movements: Row[] = data.movements ?? [];
  const reservations: Row[] = data.reservations ?? [];
  const stockSummary: any[] = data.stockSummary ?? [];

  const [activeTab, setActiveTab] = React.useState<typeof TABS[number]>("Per Barang");
  const [selectedWarehouse, setSelectedWarehouse] = React.useState("");
  const [snQuery, setSnQuery] = React.useState("");

  const [transferOpen, setTransferOpen] = React.useState(false);
  const [replacementOpen, setReplacementOpen] = React.useState(false);
  const [scanModalOpen, setScanModalOpen] = React.useState(false);

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

  const filteredSerials = serials.filter(
    (s) =>
      !snQuery ||
      String(s.sn).toLowerCase().includes(snQuery.toLowerCase()) ||
      String(s.produk).toLowerCase().includes(snQuery.toLowerCase())
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {TABS.map((t) => (
          <Chip key={t} label={t} active={activeTab === t} onPress={() => setActiveTab(t)} />
        ))}
      </ScrollView>

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
          rows={products.map((p) => {
            const total = saldoOfProduct(String(p.id));
            const satuan = String(p.satuan ?? "");
            return {
              ...p,
              totalDisplay: `${total} ${satuan}`,
              minDisplay: `${p.min ?? 0} ${satuan}`,
              statusStok: total < Number(p.min ?? 0) ? "Stok Menipis" : "Tersedia",
            };
          })}
          pageSize={8}
        />
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
              { key: "sku", label: "SKU", flex: 1 },
              { key: "masukDisplay", label: "Masuk", flex: 0.9 },
              { key: "keluarDisplay", label: "Keluar", flex: 0.9 },
              { key: "transferInDisplay", label: "Transfer Masuk", flex: 1.1 },
              { key: "transferOutDisplay", label: "Transfer Keluar", flex: 1.1 },
              { key: "saldo", label: "Saldo Akhir", flex: 1.1 },
              { key: "statusStok", label: "Status", fmt: "status", flex: 1 },
            ]}
            rows={products.map((p) => {
              const sRow = summaryOfProductWarehouse(String(p.id), String(selectedWarehouseRow?.id ?? ""));
              const qty = Number(sRow?.saldo ?? 0);
              const total = saldoOfProduct(String(p.id));
              return {
                ...p,
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
          />
        </View>
      )}

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
              { key: "garansiDisplay", label: "Masa Garansi", flex: 1.2 },
              { key: "status", label: "Status Unit", fmt: "status", flex: 1 },
            ]}
            rows={filteredSerials.map((s) => ({
              ...s,
              garansiDisplay: s.garansiBerakhir || s.garansiMulai || "-",
            }))}
            pageSize={8}
          />
        </View>
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
          rows={movements.map((m) => ({
            ...m,
            qtyDisplay: `${m.qty ?? 0} unit`,
          }))}
          pageSize={8}
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
          rows={reservations.map((r) => ({
            ...r,
            qtyDisplay: `${r.qty ?? 0} unit`,
            status: r.status === "Dirilis" ? "Selesai" : "Reserved",
          }))}
          pageSize={8}
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

      <Dialog open={scanModalOpen} onOpenChange={setScanModalOpen}>
        <DialogContent className="sm:max-w-xl md:max-w-2xl">
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
