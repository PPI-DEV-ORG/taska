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
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader, Panel, FormField } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { SearchableSelect } from "@/components/taska/dialogs";
import { useApp } from "@/store/app-store";
import { DataTable } from "@/components/taska/data-table";
import { colors } from "@/tokens";

type MasterKey = "customer" | "supplier" | "barang" | "kategori-barang" | "gudang" | "sumber-lead";

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

  const canAddKategori = user?.role === "gudang";
  const canAddBarang = user?.role === "gudang";
  const canAddGudang = user?.role === "procurement";
  const canAddLeadSource = user?.role === "sales";

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

  // Grid/Cards Menu Awal Master Data dengan pembatasan hak akses role (PRD)
  const ALL_MASTER_CARDS = [
    {
      id: "customer" as MasterKey,
      title: "Master Customer",
      desc: "Data klien, perusahaan, kontak PIC, dan status keaktifan",
      count: `${data.customers.length} Klien`,
      icon: Building2,
      tag: "Dikelola Sales",
      roles: ["bos", "sales"],
      onPress: () => router.push("/customers"),
    },
    {
      id: "sumber-lead" as MasterKey,
      title: "Sumber Lead (Lead Source)",
      desc: "Kanal rujukan prospek (Website, Referral, Event, Distributor)",
      count: `${data.leadSources?.length || 0} Kanal`,
      icon: Radio,
      tag: "Dikelola Sales",
      roles: ["bos", "sales"],
      onPress: () => setSelectedCategory("sumber-lead"),
    },
    {
      id: "supplier" as MasterKey,
      title: "Master Supplier",
      desc: "Daftar vendor penyedia barang, syarat pembayaran & tempo",
      count: `${data.suppliers.length} Supplier`,
      icon: Truck,
      tag: "Dikelola Procurement",
      roles: ["bos", "procurement"],
      onPress: () => router.push("/suppliers"),
    },
    {
      id: "gudang" as MasterKey,
      title: "Daftar Gudang",
      desc: "Lokasi gudang fisik, kota, dan penanggung jawab inventori",
      count: `${data.warehouses?.length || 0} Gudang`,
      icon: Warehouse,
      tag: "Dikelola Procurement",
      roles: ["bos", "procurement"],
      onPress: () => setSelectedCategory("gudang"),
    },
    {
      id: "barang" as MasterKey,
      title: "Master Barang & Produk",
      desc: "Katalog master SKU, kategori, unit satuan, garansi & tipe SN",
      count: `${data.products?.length || 0} Barang`,
      icon: Boxes,
      tag: "Dikelola Gudang",
      roles: ["bos", "gudang"],
      onPress: () => setSelectedCategory("barang"),
    },
    {
      id: "kategori-barang" as MasterKey,
      title: "Master Kategori Produk",
      desc: "Klasifikasi kelompok produk, SKU prefix, dan deskripsi kategori",
      count: `${data.productCategories?.length || 0} Kategori`,
      icon: Layers,
      tag: "Dikelola Gudang",
      roles: ["bos", "gudang"],
      onPress: () => setSelectedCategory("kategori-barang"),
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
    </View>
  );
}
