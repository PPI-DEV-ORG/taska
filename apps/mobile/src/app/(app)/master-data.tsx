import * as React from "react";
import { View, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Building2,
  Boxes,
  Database,
  Layers,
  MapPin,
  Plus,
  Radio,
  Truck,
  Warehouse,
  ChevronRight,
  FileSpreadsheet,
  Upload,
  Settings,
  HelpCircle,
  Receipt,
  PieChart,
  CheckCircle2,
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader, Panel, FormField } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { SearchableSelect } from "@/components/taska/dialogs";
import { FileUploader } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { DataTable } from "@/components/taska/data-table";
import { colors } from "@/tokens";
import { rupiah } from "@/lib/format";

type MasterKey =
  | "customer"
  | "supplier"
  | "barang"
  | "kategori-barang"
  | "gudang"
  | "sumber-lead"
  | "alasan-lost"
  | "kategori-pengeluaran"
  | "cost-center"
  | "pengaturan-sistem";

export default function MasterDataScreen() {
  const router = useRouter();
  const { data, user, addRow, toast } = useApp();
  const [selectedCategory, setSelectedCategory] = React.useState<MasterKey | null>(null);

  // Modal State untuk Kategori Produk (Gudang)
  const [kategoriOpen, setKategoriOpen] = React.useState(false);
  const [kategoriNama, setKategoriNama] = React.useState("");
  const [kategoriDesc, setKategoriDesc] = React.useState("");
  const [kategoriPrefix, setKategoriPrefix] = React.useState("");

  // Modal State untuk Barang (Gudang)
  const [barangOpen, setBarangOpen] = React.useState(false);
  const [barangNama, setBarangNama] = React.useState("");
  const [barangSku, setBarangSku] = React.useState("");
  const [barangKategori, setBarangKategori] = React.useState("IP Camera");
  const [barangSatuan, setBarangSatuan] = React.useState("unit");
  const [barangIsiUnit, setBarangIsiUnit] = React.useState("");
  const [barangGaransi, setBarangGaransi] = React.useState("2 tahun");
  const [barangSN, setBarangSN] = React.useState("Ya (Serial Number)");

  // Modal State untuk Gudang (Procurement)
  const [gudangOpen, setGudangOpen] = React.useState(false);
  const [gudangNama, setGudangNama] = React.useState("");
  const [gudangKota, setGudangKota] = React.useState("");
  const [gudangStaf, setGudangStaf] = React.useState("");

  // Modal State untuk Sumber Lead (Sales)
  const [leadSourceOpen, setLeadSourceOpen] = React.useState(false);
  const [leadSourceNama, setLeadSourceNama] = React.useState("");

  // Modal State untuk Alasan Lost (Sales)
  const [lostReasonOpen, setLostReasonOpen] = React.useState(false);
  const [lostReasonNama, setLostReasonNama] = React.useState("");

  // Modal State untuk Kategori Pengeluaran (Finance)
  const [expenseCatOpen, setExpenseCatOpen] = React.useState(false);
  const [expenseCatNama, setExpenseCatNama] = React.useState("");

  // Modal State untuk Cost Center (Finance)
  const [costCenterOpen, setCostCenterOpen] = React.useState(false);
  const [costCenterNama, setCostCenterNama] = React.useState("");
  const [costCenterKode, setCostCenterKode] = React.useState("");

  // Modal State untuk Pengaturan Sistem (Admin)
  const [thresholdInput, setThresholdInput] = React.useState("10000000");
  const [ppnInput, setPpnInput] = React.useState("11");

  // Modal State untuk Import Excel
  const [importOpen, setImportOpen] = React.useState(false);
  const [importTarget, setImportTarget] = React.useState("customer");
  const [importCount, setImportCount] = React.useState<number | null>(null);

  const canAddKategori = user?.role === "gudang" || user?.role === "bos" || user?.role === "admin";
  const canAddBarang = user?.role === "gudang" || user?.role === "bos" || user?.role === "admin";
  const canAddGudang = user?.role === "procurement" || user?.role === "bos" || user?.role === "admin";
  const canAddLeadSource = user?.role === "sales" || user?.role === "bos" || user?.role === "admin";
  const canAddLostReason = user?.role === "sales" || user?.role === "bos" || user?.role === "admin";
  const canAddExpenseCat = user?.role === "finance" || user?.role === "bos" || user?.role === "admin";
  const canAddCostCenter = user?.role === "finance" || user?.role === "bos" || user?.role === "admin";
  const canEditSettings = user?.role === "bos" || user?.role === "admin";

  function handleSaveKategori() {
    if (!kategoriNama.trim()) {
      toast("Nama kategori wajib diisi", "danger");
      return;
    }
    addRow("productCategories", {
      nama: kategoriNama.trim(),
      deskripsi: kategoriDesc.trim() || "-",
      prefix: (kategoriPrefix.trim() || "CAT").toUpperCase(),
      status: "Aktif",
    });
    setKategoriOpen(false);
    setKategoriNama("");
    setKategoriDesc("");
    setKategoriPrefix("");
    toast("Kategori produk berhasil ditambahkan");
  }

  function handleSaveBarang() {
    if (!barangNama.trim() || !barangSku.trim()) {
      toast("Nama barang dan SKU wajib diisi", "danger");
      return;
    }
    let satuanDisplay = barangSatuan;
    if (barangSatuan === "roll" && barangIsiUnit.trim()) {
      satuanDisplay = `roll (@${barangIsiUnit.trim()} m)`;
    } else if ((barangSatuan === "box" || barangSatuan === "pack" || barangSatuan === "set") && barangIsiUnit.trim()) {
      satuanDisplay = `${barangSatuan} (@${barangIsiUnit.trim()} pcs)`;
    }

    addRow("products", {
      nama: barangNama,
      sku: barangSku.toUpperCase(),
      kategori: barangKategori,
      satuan: satuanDisplay,
      isiPerUnit: barangIsiUnit ? Number(barangIsiUnit) : undefined,
      satuanDasar: barangSatuan,
      garansi: barangGaransi,
      berSN: barangSN.includes("Ya"),
    });
    setBarangOpen(false);
    setBarangNama("");
    setBarangSku("");
    setBarangIsiUnit("");
    toast("Master barang berhasil ditambahkan");
  }

  function handleSaveGudang() {
    if (!gudangNama.trim() || !gudangKota.trim()) {
      toast("Nama gudang dan kota wajib diisi", "danger");
      return;
    }
    addRow("warehouses", {
      nama: gudangNama,
      kota: gudangKota,
      staf: gudangStaf.trim() || "Belum ditugaskan",
      status: "Aktif",
    });
    setGudangOpen(false);
    setGudangNama("");
    setGudangKota("");
    setGudangStaf("");
    toast("Master gudang berhasil ditambahkan");
  }

  function handleSaveLeadSource() {
    if (!leadSourceNama.trim()) {
      toast("Nama kanal sumber lead wajib diisi", "danger");
      return;
    }
    addRow("leadSources", {
      nama: leadSourceNama.trim(),
      status: "Aktif",
    });
    setLeadSourceOpen(false);
    setLeadSourceNama("");
    toast("Kanal sumber lead berhasil ditambahkan");
  }

  function handleSaveLostReason() {
    if (!lostReasonNama.trim()) { toast("Alasan Lost wajib diisi", "danger"); return; }
    addRow("lostReasons", { nama: lostReasonNama.trim(), status: "Aktif" });
    setLostReasonOpen(false);
    setLostReasonNama("");
    toast("Master alasan Lost berhasil ditambahkan");
  }

  function handleSaveExpenseCat() {
    if (!expenseCatNama.trim()) { toast("Nama kategori pengeluaran wajib diisi", "danger"); return; }
    addRow("expenseCategories", { nama: expenseCatNama.trim(), status: "Aktif" });
    setExpenseCatOpen(false);
    setExpenseCatNama("");
    toast("Kategori pengeluaran berhasil ditambahkan");
  }

  function handleSaveCostCenter() {
    if (!costCenterNama.trim()) { toast("Nama cost center wajib diisi", "danger"); return; }
    addRow("costCenters", { nama: `${costCenterKode.trim() ? costCenterKode.trim() + " - " : ""}${costCenterNama.trim()}`, status: "Aktif" });
    setCostCenterOpen(false);
    setCostCenterNama("");
    setCostCenterKode("");
    toast("Cost center berhasil ditambahkan");
  }

  function handleSaveSettings() {
    toast("Pengaturan sistem & ambang batas persetujuan berhasil diperbarui!");
  }

  function handleExecuteImport() {
    if (!importCount) {
      toast("Silakan unggah berkas template CSV/Excel terlebih dahulu", "danger");
      return;
    }
    toast(`Berhasil mengimpor ${importCount} baris data ke master ${importTarget}!`);
    setImportOpen(false);
    setImportCount(null);
  }

  // Jika sedang melihat detail salah satu master data
  if (selectedCategory === "barang") {
    return (
      <View className="gap-5">
        <PageHeader
          back
          title="Master Produk & Barang"
          subtitle={`${data.products?.length || 0} barang terdaftar (Dikelola Gudang)`}
          action={
            <View className="flex-row gap-2">
              <Button variant="outline" size="sm" onPress={() => setSelectedCategory(null)}>
                <ArrowLeft size={15} color={colors.text} />
                <Text className="text-xs">Kembali</Text>
              </Button>
              {canAddBarang ? (
                <Button size="sm" onPress={() => setBarangOpen(true)}>
                  <Plus size={15} color={colors.background} />
                  <Text className="text-xs">Tambah Barang</Text>
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onPress={() => router.push("/stock")}>
                <Text className="text-xs">Lihat Stok Fisik</Text>
              </Button>
            </View>
          }
        />
        <DataTable
          columns={[
            { key: "nama", label: "Nama Produk / Barang", primary: true, flex: 1.8 },
            { key: "sku", label: "SKU", flex: 1 },
            { key: "kategori", label: "Kategori", flex: 1 },
            { key: "satuan", label: "Satuan", flex: 0.8 },
            { key: "garansi", label: "Garansi", flex: 1 },
            { key: "tipeSN", label: "Tipe SN", flex: 1 },
          ]}
          rows={(data.products || []).map((p) => ({
            ...p,
            tipeSN: p.berSN ? "Serial Number" : "Non-SN",
          }))}
          pageSize={8}
        />

        {/* Modal Tambah Barang (Gudang) */}
        <Dialog open={barangOpen} onOpenChange={setBarangOpen}>
          <DialogContent className="sm:max-w-xl md:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Tambah Master Barang & Produk</DialogTitle>
            </DialogHeader>
            <View className="gap-4">
              <FormField label="Nama Produk / Barang" required>
                <Input
                  value={barangNama}
                  onChangeText={setBarangNama}
                  placeholder="Contoh: Switch PoE 24 Port Managed"
                />
              </FormField>
              <FormField label="Kode SKU" required>
                <Input
                  value={barangSku}
                  onChangeText={setBarangSku}
                  placeholder="Contoh: SW-POE-24P"
                />
              </FormField>
              <FormField label="Kategori Produk" required>
                <SearchableSelect
                  value={barangKategori}
                  onChange={setBarangKategori}
                  options={(data.productCategories || []).map((c) => String(c.nama))}
                />
              </FormField>
              <FormField label="Unit Satuan" required>
                <SearchableSelect
                  value={barangSatuan}
                  onChange={setBarangSatuan}
                  options={["unit", "roll", "pcs", "box", "pack", "set"]}
                />
              </FormField>

              {barangSatuan === "roll" ? (
                <FormField label="Panjang per Roll (Meter)" required>
                  <Input
                    value={barangIsiUnit}
                    onChangeText={setBarangIsiUnit}
                    keyboardType="numeric"
                    placeholder="Contoh: 305 (untuk roll 305 meter)"
                  />
                </FormField>
              ) : ["box", "pack", "set","pcs"].includes(barangSatuan) ? (
                <FormField label={`Isi per ${barangSatuan.toUpperCase()} (Pcs / Unit)`}>
                  <Input
                    value={barangIsiUnit}
                    onChangeText={setBarangIsiUnit}
                    keyboardType="numeric"
                    placeholder="Contoh: 50 atau 100"
                  />
                </FormField>
              ) : null}
              <FormField label="Garansi Unit" required>
                <SearchableSelect
                  value={barangGaransi}
                  onChange={setBarangGaransi}
                  options={["1 tahun", "2 tahun", "3 tahun", "Tanpa garansi"]}
                />
              </FormField>
              <FormField label="Lacak Serial Number (SN)" required>
                <SearchableSelect
                  value={barangSN}
                  onChange={setBarangSN}
                  options={["Ya (Serial Number)", "Tidak (Non-SN / Curah)"]}
                />
              </FormField>
            </View>
            <DialogFooter>
              <Button variant="outline" onPress={() => setBarangOpen(false)}>
                <Text>Batal</Text>
              </Button>
              <Button onPress={handleSaveBarang}>
                <Text>Simpan Barang</Text>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </View>
    );
  }

  if (selectedCategory === "kategori-barang") {
    return (
      <View className="gap-5">
        <PageHeader
          back
          title="Master Kategori Produk"
          subtitle={`${data.productCategories?.length || 0} kelompok kategori barang & SKU prefix (Dikelola Gudang)`}
          action={
            <View className="flex-row gap-2">
              <Button variant="outline" size="sm" onPress={() => setSelectedCategory(null)}>
                <ArrowLeft size={15} color={colors.text} />
                <Text className="text-xs">Kembali</Text>
              </Button>
              {canAddKategori ? (
                <Button size="sm" onPress={() => setKategoriOpen(true)}>
                  <Plus size={15} color={colors.background} />
                  <Text className="text-xs">Tambah Kategori</Text>
                </Button>
              ) : null}
            </View>
          }
        />
        <DataTable
          columns={[
            { key: "nama", label: "Nama Kategori", primary: true, flex: 1.5 },
            { key: "prefix", label: "Prefix SKU", flex: 0.8 },
            { key: "deskripsi", label: "Deskripsi", flex: 2 },
            { key: "status", label: "Status", fmt: "status", flex: 0.8 },
          ]}
          rows={data.productCategories || []}
          pageSize={8}
        />

        {/* Modal Tambah Kategori (Gudang) */}
        <Dialog open={kategoriOpen} onOpenChange={setKategoriOpen}>
          <DialogContent className="sm:max-w-xl md:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Tambah Kategori Produk Baru</DialogTitle>
            </DialogHeader>
            <View className="gap-4">
              <FormField label="Nama Kategori Produk" required>
                <Input
                  value={kategoriNama}
                  onChangeText={setKategoriNama}
                  placeholder="Contoh: Sensor IoT & Smart Home"
                />
              </FormField>
              <FormField label="Prefix SKU (Singkatan Kode)" required>
                <Input
                  value={kategoriPrefix}
                  onChangeText={setKategoriPrefix}
                  placeholder="Contoh: IOT atau SNS"
                  autoCapitalize="characters"
                />
              </FormField>
              <FormField label="Deskripsi / Ruang Lingkup">
                <Input
                  value={kategoriDesc}
                  onChangeText={setKategoriDesc}
                  placeholder="Keterangan singkat kelompok produk ini"
                />
              </FormField>
            </View>
            <DialogFooter>
              <Button variant="outline" onPress={() => setKategoriOpen(false)}>
                <Text>Batal</Text>
              </Button>
              <Button onPress={handleSaveKategori}>
                <Text>Simpan Kategori</Text>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </View>
    );
  }

  if (selectedCategory === "gudang") {
    return (
      <View className="gap-5">
        <PageHeader
          back
          title="Daftar Gudang Perusahaan"
          subtitle={`${data.warehouses?.length || 0} lokasi gudang operasional (Dikelola Procurement)`}
          action={
            <View className="flex-row gap-2">
              <Button variant="outline" size="sm" onPress={() => setSelectedCategory(null)}>
                <ArrowLeft size={15} color={colors.text} />
                <Text className="text-xs">Kembali</Text>
              </Button>
              {canAddGudang ? (
                <Button size="sm" onPress={() => setGudangOpen(true)}>
                  <Plus size={15} color={colors.background} />
                  <Text className="text-xs">Tambah Gudang</Text>
                </Button>
              ) : null}
            </View>
          }
        />
        <DataTable
          columns={[
            { key: "nama", label: "Nama Gudang", primary: true, flex: 1.6 },
            { key: "kota", label: "Lokasi Kota", flex: 1.2 },
            { key: "staf", label: "Staf Penanggung Jawab", flex: 1.5 },
            { key: "status", label: "Status Operasional", fmt: "status", flex: 1 },
          ]}
          rows={data.warehouses || []}
          pageSize={8}
        />

        {/* Modal Tambah Gudang (Procurement) */}
        <Dialog open={gudangOpen} onOpenChange={setGudangOpen}>
          <DialogContent className="sm:max-w-xl md:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Tambah Gudang Operasional</DialogTitle>
            </DialogHeader>
            <View className="gap-4">
              <FormField label="Nama Gudang" required>
                <Input
                  value={gudangNama}
                  onChangeText={setGudangNama}
                  placeholder="Contoh: Gudang Transit Bandung"
                />
              </FormField>
              <FormField label="Lokasi Kota" required>
                <Input
                  value={gudangKota}
                  onChangeText={setGudangKota}
                  placeholder="Contoh: Bandung"
                />
              </FormField>
              <FormField label="Staf Penanggung Jawab">
                <Input
                  value={gudangStaf}
                  onChangeText={setGudangStaf}
                  placeholder="Nama staf gudang (opsional)"
                />
              </FormField>
            </View>
            <DialogFooter>
              <Button variant="outline" onPress={() => setGudangOpen(false)}>
                <Text>Batal</Text>
              </Button>
              <Button onPress={handleSaveGudang}>
                <Text>Simpan Gudang</Text>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </View>
    );
  }

  if (selectedCategory === "sumber-lead") {
    return (
      <View className="gap-5">
        <PageHeader
          back
          title="Sumber Kedatangan Lead"
          subtitle={`${data.leadSources?.length || 0} kanal akuisisi marketing (Dikelola Sales)`}
          action={
            <View className="flex-row gap-2">
              <Button variant="outline" size="sm" onPress={() => setSelectedCategory(null)}>
                <ArrowLeft size={15} color={colors.text} />
                <Text className="text-xs">Kembali</Text>
              </Button>
              {canAddLeadSource ? (
                <Button size="sm" onPress={() => setLeadSourceOpen(true)}>
                  <Plus size={15} color={colors.background} />
                  <Text className="text-xs">Tambah Sumber Lead</Text>
                </Button>
              ) : null}
            </View>
          }
        />
        <DataTable
          columns={[
            { key: "nama", label: "Kanal Sumber Lead", primary: true, flex: 2 },
            { key: "status", label: "Status", fmt: "status", flex: 1 },
          ]}
          rows={data.leadSources || []}
          pageSize={8}
        />

        {/* Modal Tambah Sumber Lead (Sales) */}
        <Dialog open={leadSourceOpen} onOpenChange={setLeadSourceOpen}>
          <DialogContent className="sm:max-w-xl md:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Tambah Kanal Sumber Lead</DialogTitle>
            </DialogHeader>
            <View className="gap-4">
              <FormField label="Nama Kanal / Sumber Lead" required>
                <Input
                  value={leadSourceNama}
                  onChangeText={setLeadSourceNama}
                  placeholder="Contoh: Webinar Cyber Security 2026"
                />
              </FormField>
            </View>
            <DialogFooter>
              <Button variant="outline" onPress={() => setLeadSourceOpen(false)}>
                <Text>Batal</Text>
              </Button>
              <Button onPress={handleSaveLeadSource}>
                <Text>Simpan Sumber Lead</Text>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </View>
    );
  }

  if (selectedCategory === "alasan-lost") {
    return (
      <View className="gap-5">
        <PageHeader
          back
          title="Master Alasan Lost (Gagal Deal)"
          subtitle={`${data.lostReasons?.length || 0} alasan rujukan saat lead gagal (Dikelola Sales)`}
          action={
            <View className="flex-row gap-2">
              <Button variant="outline" size="sm" onPress={() => setSelectedCategory(null)}>
                <ArrowLeft size={15} color={colors.text} />
                <Text className="text-xs">Kembali</Text>
              </Button>
              {canAddLostReason ? (
                <Button size="sm" onPress={() => setLostReasonOpen(true)}>
                  <Plus size={15} color={colors.background} />
                  <Text className="text-xs">Tambah Alasan Lost</Text>
                </Button>
              ) : null}
            </View>
          }
        />
        <DataTable
          columns={[
            { key: "nama", label: "Alasan Lost / Pembatalan", primary: true, flex: 2 },
            { key: "status", label: "Status", fmt: "status", flex: 1 },
          ]}
          rows={data.lostReasons || []}
          pageSize={8}
        />

        <Dialog open={lostReasonOpen} onOpenChange={setLostReasonOpen}>
          <DialogContent className="sm:max-w-xl md:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Tambah Master Alasan Lost</DialogTitle>
            </DialogHeader>
            <View className="gap-4">
              <FormField label="Nama Alasan Lost / Batal" required>
                <Input
                  value={lostReasonNama}
                  onChangeText={setLostReasonNama}
                  placeholder="Contoh: Anggaran Klien Dipangkas"
                />
              </FormField>
            </View>
            <DialogFooter>
              <Button variant="outline" onPress={() => setLostReasonOpen(false)}>
                <Text>Batal</Text>
              </Button>
              <Button onPress={handleSaveLostReason}>
                <Text>Simpan Alasan</Text>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </View>
    );
  }

  if (selectedCategory === "kategori-pengeluaran") {
    return (
      <View className="gap-5">
        <PageHeader
          back
          title="Master Kategori Pengeluaran & Biaya"
          subtitle={`${data.expenseCategories?.length || 0} pos biaya operasional (Dikelola Finance)`}
          action={
            <View className="flex-row gap-2">
              <Button variant="outline" size="sm" onPress={() => setSelectedCategory(null)}>
                <ArrowLeft size={15} color={colors.text} />
                <Text className="text-xs">Kembali</Text>
              </Button>
              {canAddExpenseCat ? (
                <Button size="sm" onPress={() => setExpenseCatOpen(true)}>
                  <Plus size={15} color={colors.background} />
                  <Text className="text-xs">Tambah Kategori Biaya</Text>
                </Button>
              ) : null}
            </View>
          }
        />
        <DataTable
          columns={[
            { key: "nama", label: "Pos Kategori Biaya", primary: true, flex: 2 },
            { key: "status", label: "Status", fmt: "status", flex: 1 },
          ]}
          rows={data.expenseCategories || []}
          pageSize={8}
        />

        <Dialog open={expenseCatOpen} onOpenChange={setExpenseCatOpen}>
          <DialogContent className="sm:max-w-xl md:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Tambah Kategori Pengeluaran</DialogTitle>
            </DialogHeader>
            <View className="gap-4">
              <FormField label="Nama Kategori Biaya" required>
                <Input
                  value={expenseCatNama}
                  onChangeText={setExpenseCatNama}
                  placeholder="Contoh: Tiket Pesawat & Perjalanan Jauh"
                />
              </FormField>
            </View>
            <DialogFooter>
              <Button variant="outline" onPress={() => setExpenseCatOpen(false)}>
                <Text>Batal</Text>
              </Button>
              <Button onPress={handleSaveExpenseCat}>
                <Text>Simpan Kategori</Text>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </View>
    );
  }

  if (selectedCategory === "cost-center") {
    return (
      <View className="gap-5">
        <PageHeader
          back
          title="Master Cost Center (Pusat Biaya)"
          subtitle={`${data.costCenters?.length || 0} pusat pembebanan anggaran (Dikelola Finance)`}
          action={
            <View className="flex-row gap-2">
              <Button variant="outline" size="sm" onPress={() => setSelectedCategory(null)}>
                <ArrowLeft size={15} color={colors.text} />
                <Text className="text-xs">Kembali</Text>
              </Button>
              {canAddCostCenter ? (
                <Button size="sm" onPress={() => setCostCenterOpen(true)}>
                  <Plus size={15} color={colors.background} />
                  <Text className="text-xs">Tambah Cost Center</Text>
                </Button>
              ) : null}
            </View>
          }
        />
        <DataTable
          columns={[
            { key: "nama", label: "Kode & Nama Cost Center", primary: true, flex: 2 },
            { key: "status", label: "Status", fmt: "status", flex: 1 },
          ]}
          rows={data.costCenters || []}
          pageSize={8}
        />

        <Dialog open={costCenterOpen} onOpenChange={setCostCenterOpen}>
          <DialogContent className="sm:max-w-xl md:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Tambah Cost Center</DialogTitle>
            </DialogHeader>
            <View className="gap-4">
              <FormField label="Kode Cost Center (Singkatan)">
                <Input
                  value={costCenterKode}
                  onChangeText={setCostCenterKode}
                  placeholder="Contoh: CC-RND"
                />
              </FormField>
              <FormField label="Nama Departemen / Beban" required>
                <Input
                  value={costCenterNama}
                  onChangeText={setCostCenterNama}
                  placeholder="Contoh: Riset & Pengembangan Produk"
                />
              </FormField>
            </View>
            <DialogFooter>
              <Button variant="outline" onPress={() => setCostCenterOpen(false)}>
                <Text>Batal</Text>
              </Button>
              <Button onPress={handleSaveCostCenter}>
                <Text>Simpan Cost Center</Text>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </View>
    );
  }

  if (selectedCategory === "pengaturan-sistem") {
    return (
      <View className="gap-5">
        <PageHeader
          back
          title="Pengaturan & Kebijakan Sistem"
          subtitle="Kebijakan global operasional ERP (Dikelola Administrator)"
          action={
            <Button variant="outline" size="sm" onPress={() => setSelectedCategory(null)}>
              <ArrowLeft size={15} color={colors.text} />
              <Text className="text-xs">Kembali</Text>
            </Button>
          }
        />
        <Panel
          title="Ambang Batas Persetujuan Bos (BOS Approval Threshold)"
          subtitle="Dokumen pembelian, penawaran, invoice, dan pengeluaran di atas nilai ini wajib disetujui Bos selain Finance."
        >
          <View className="gap-4">
            <View className="flex-row items-center gap-3">
              <Text className="text-sm font-semibold text-muted-foreground w-40">Nilai Ambang Batas (Rp):</Text>
              <View className="flex-1 max-w-sm">
                <Input
                  value={thresholdInput}
                  onChangeText={setThresholdInput}
                  keyboardType="numeric"
                  placeholder="10000000"
                />
              </View>
            </View>
            <Text className="text-xs text-primary font-mono">
              Format Aktif: {rupiah(Number(thresholdInput) || 10000000)}
            </Text>
          </View>
        </Panel>

        <Panel
          title="Tarif PPN Standar Nasional"
          subtitle="Tarif pajak pertambahan nilai yang dihitung otomatis pada Invoice dan Penawaran."
        >
          <View className="gap-4">
            <View className="flex-row items-center gap-3">
              <Text className="text-sm font-semibold text-muted-foreground w-40">Tarif PPN (%):</Text>
              <View className="flex-1 max-w-sm">
                <Input
                  value={ppnInput}
                  onChangeText={setPpnInput}
                  keyboardType="numeric"
                  placeholder="11"
                />
              </View>
            </View>
            <Text className="text-xs text-muted-foreground">
              Tarif saat ini: {ppnInput || "11"}%
            </Text>
          </View>
        </Panel>

        <Panel
          title="Format Penomoran Dokumen Otomatis"
          subtitle="Template kode penomoran yang di-generate otomatis oleh modul."
        >
          <View className="gap-2">
            <Text className="text-xs font-mono text-muted-foreground">Penawaran: PNW/YYYY/MM/XXX (Contoh: PNW/2026/10/001)</Text>
            <Text className="text-xs font-mono text-muted-foreground">PO Supplier: PO/YYYY/MM/XXX (Contoh: PO/2026/10/001)</Text>
            <Text className="text-xs font-mono text-muted-foreground">Surat Jalan: SJ/YYYY/MM/XXX (Contoh: SJ/2026/10/001)</Text>
          </View>
        </Panel>

        {canEditSettings ? (
          <Button onPress={handleSaveSettings} className="self-start">
            <Text>Simpan Perubahan Pengaturan</Text>
          </Button>
        ) : null}
      </View>
    );
  }

  // Grid/Cards Menu Awal Master Data dengan pembatasan hak akses role (PRD)
  const ALL_MASTER_CARDS = [
    {
      id: "customer" as MasterKey,
      title: "Master Customer",
      desc: "Data klien, perusahaan, kontak PIC, dan status keaktifan",
      count: `${data.customers.length} Klien`,
      icon: Building2,
      tag: "Dikelola Sales",
      roles: ["admin", "bos", "sales"],
      onPress: () => router.push("/customers"),
    },
    {
      id: "sumber-lead" as MasterKey,
      title: "Sumber Lead (Lead Source)",
      desc: "Kanal rujukan prospek (Website, Referral, Event, Distributor)",
      count: `${data.leadSources?.length || 0} Kanal`,
      icon: Radio,
      tag: "Dikelola Sales",
      roles: ["admin", "bos", "sales"],
      onPress: () => setSelectedCategory("sumber-lead"),
    },
    {
      id: "alasan-lost" as MasterKey,
      title: "Alasan Lost (Gagal Deal)",
      desc: "Daftar alasan wajib saat lead ditandai Lost (Harga, Kompetitor, Batal)",
      count: `${data.lostReasons?.length || 0} Alasan`,
      icon: HelpCircle,
      tag: "Dikelola Sales",
      roles: ["admin", "bos", "sales"],
      onPress: () => setSelectedCategory("alasan-lost"),
    },
    {
      id: "supplier" as MasterKey,
      title: "Master Supplier",
      desc: "Daftar vendor penyedia barang, syarat pembayaran & tempo",
      count: `${data.suppliers.length} Supplier`,
      icon: Truck,
      tag: "Dikelola Procurement",
      roles: ["admin", "bos", "procurement"],
      onPress: () => router.push("/suppliers"),
    },
    {
      id: "gudang" as MasterKey,
      title: "Daftar Gudang",
      desc: "Lokasi gudang fisik, kota, dan penanggung jawab inventori",
      count: `${data.warehouses?.length || 0} Gudang`,
      icon: Warehouse,
      tag: "Dikelola Admin & Procurement",
      roles: ["admin", "bos", "procurement"],
      onPress: () => setSelectedCategory("gudang"),
    },
    {
      id: "barang" as MasterKey,
      title: "Master Barang & Produk",
      desc: "Katalog master SKU, kategori, unit satuan, garansi & tipe SN",
      count: `${data.products?.length || 0} Barang`,
      icon: Boxes,
      tag: "Dikelola Gudang",
      roles: ["admin", "bos", "gudang"],
      onPress: () => setSelectedCategory("barang"),
    },
    {
      id: "kategori-barang" as MasterKey,
      title: "Master Kategori Produk",
      desc: "Klasifikasi kelompok produk, SKU prefix, dan deskripsi kategori",
      count: `${data.productCategories?.length || 0} Kategori`,
      icon: Layers,
      tag: "Dikelola Gudang",
      roles: ["admin", "bos", "gudang"],
      onPress: () => setSelectedCategory("kategori-barang"),
    },
    {
      id: "kategori-pengeluaran" as MasterKey,
      title: "Kategori Pengeluaran & Biaya",
      desc: "Pos klasifikasi biaya operasional (Bensin, Makan, Perlengkapan)",
      count: `${data.expenseCategories?.length || 0} Pos Biaya`,
      icon: Receipt,
      tag: "Dikelola Finance",
      roles: ["admin", "bos", "finance"],
      onPress: () => setSelectedCategory("kategori-pengeluaran"),
    },
    {
      id: "cost-center" as MasterKey,
      title: "Cost Center (Pusat Biaya)",
      desc: "Klasifikasi alokasi anggaran departemen dan project",
      count: `${data.costCenters?.length || 0} Cost Center`,
      icon: PieChart,
      tag: "Dikelola Finance",
      roles: ["admin", "bos", "finance"],
      onPress: () => setSelectedCategory("cost-center"),
    },
    {
      id: "pengaturan-sistem" as MasterKey,
      title: "Pengaturan Kebijakan ERP",
      desc: "Ambang batas persetujuan Bos, tarif PPN 11%, format penomoran",
      count: "Sistem",
      icon: Settings,
      tag: "Dikelola Admin / Bos",
      roles: ["admin", "bos"],
      onPress: () => setSelectedCategory("pengaturan-sistem"),
    },
  ];

  const visibleCards = ALL_MASTER_CARDS.filter((card) =>
    user ? card.roles.includes(user.role) : false
  );

  return (
    <View className="gap-6 w-full">
      <PageHeader
        title="Master Data"
        subtitle="Pilih kategori master data untuk melihat dan mengelola tabel rujukan sistem"
        action={
          <Button
            variant="outline"
            size="sm"
            onPress={() => setImportOpen(true)}
            className="flex-row items-center gap-1.5"
          >
            <FileSpreadsheet size={15} color={colors.success} />
            <Text className="text-xs">Import Excel / CSV</Text>
          </Button>
        }
      />

      <View className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
        {visibleCards.map((card) => {
          const Icon = card.icon;
          return (
            <Pressable
              key={card.id}
              onPress={card.onPress}
              className="bg-card hover:bg-panel border-border/80 active:bg-panel flex-col justify-between rounded-2xl border p-5 transition-colors shadow-sm min-h-[160px] gap-4"
            >
              <View className="flex-row items-start justify-between gap-3">
                <View className="bg-panel border-border/60 size-11 items-center justify-center rounded-xl border">
                  <Icon size={22} color={colors.primary} />
                </View>
                <View className="bg-panel rounded-full px-2.5 py-1 border border-border/60">
                  <Text className="text-[11px] font-semibold text-muted-foreground">{card.count}</Text>
                </View>
              </View>

              <View className="gap-1 flex-1">
                <Text className="text-base font-bold text-foreground">{card.title}</Text>
                <Text className="text-muted-foreground text-xs leading-relaxed">{card.desc}</Text>
              </View>

              <View className="flex-row items-center justify-between border-t border-border/40 pt-3">
                <Text className="text-[11px] font-medium text-text-secondary">{card.tag}</Text>
                <View className="flex-row items-center gap-1">
                  <Text className="text-primary text-xs font-semibold">Buka Tabel</Text>
                  <ChevronRight size={14} color={colors.primary} />
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Modal Import Data Excel / CSV (PRD Fase 1) */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-xl md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Data via Template Excel / CSV</DialogTitle>
          </DialogHeader>
          <View className="gap-4">
            <Text className="text-xs text-muted-foreground leading-relaxed">
              Sistem akan memvalidasi tiap baris data. Baris yang valid akan diimport ke master data, sedangkan baris gagal akan dilaporkan tanpa menggagalkan baris lainnya.
            </Text>

            <FormField label="Pilih Target Master Data" required>
              <SearchableSelect
                value={importTarget}
                onChange={(v) => setImportTarget(v)}
                options={[
                  "Customer (Data Klien & PIC)",
                  "Supplier (Vendor Penyedia)",
                  "Produk & SKU Barang",
                  "Gudang & Lokasi Inventori",
                  "Saldo Stok Awal & Serial Number",
                ]}
                placeholder="Pilih target master data"
              />
            </FormField>

            <View className="bg-panel/40 border-border/70 rounded-xl border p-3.5 gap-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-semibold">Template Contoh Excel ({importTarget})</Text>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => {
                    if (typeof window !== "undefined" && typeof document !== "undefined") {
                      const csvHeader =
                        importTarget.includes("Customer")
                          ? "nama,perusahaan,kontak,email,telepon,alamat,catatan\nPT Contoh Mitra,PT Contoh Mitra,Budi,budi@contoh.com,08123456789,Jakarta,Klien VIP"
                          : importTarget.includes("Supplier")
                          ? "nama,kontak,telepon,paymentTerms\nPT Hikvision,Sales Support,021-555666,Net 30"
                          : "sku,nama,kategori,satuan,berSN,garansi\nCAM-010,Dome Camera 4MP,IP Camera,unit,true,2 tahun";
                      const link = document.createElement("a");
                      link.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csvHeader);
                      link.download = `template-import-${importTarget.toLowerCase().slice(0, 8)}.csv`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      toast("Template file berhasil diunduh");
                    }
                  }}
                  className="flex-row items-center gap-1.5"
                >
                  <FileSpreadsheet size={13} color={colors.success} />
                  <Text className="text-xs">Unduh Template</Text>
                </Button>
              </View>
              <Text className="text-[11px] text-muted-foreground">
                Gunakan template resmi di atas untuk memastikan format kolom dan tipe data sesuai standar.
              </Text>
            </View>

            <FileUploader
              label="Unggah Berkas Excel (.xlsx) atau CSV"
              kind="dokumen"
              onChange={(count) => {
                setImportCount(count * 5); // Simulasi 5 baris per file
              }}
            />

            {importCount ? (
              <View className="bg-success/15 border-success/30 rounded-lg border p-3 flex-row items-center gap-2">
                <CheckCircle2 size={16} color={colors.success} />
                <Text className="text-success text-xs font-semibold">
                  Validasi selesai: {importCount} baris siap diimpor ke sistem (0 baris gagal).
                </Text>
              </View>
            ) : null}
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setImportOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleExecuteImport} disabled={!importCount}>
              <Text>Eksekusi Import Data</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  );
}
