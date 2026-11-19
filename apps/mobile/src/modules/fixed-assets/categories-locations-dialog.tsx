import * as React from "react";
import { View, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/akuntra/dialogs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Edit, FolderKanban, MapPin } from "lucide-react-native";
import { FaCategory, FaLocation } from "./types";
import { api } from "@/services/api";
import { useFaAccounts } from "./use-fa-accounts";

type Props = {
  visible: boolean;
  onClose: () => void;
  categories: FaCategory[];
  locations: FaLocation[];
  onRefresh: () => void;
};

export function CategoriesLocationsDialog({
  visible,
  onClose,
  categories,
  locations,
  onRefresh,
}: Props) {
  const [tab, setTab] = React.useState<"categories" | "locations">("categories");

  // Form Kategori State
  const [catName, setCatName] = React.useState("");
  const [catType, setCatType] = React.useState("TANGIBLE");
  const [catMonths, setCatMonths] = React.useState(48);
  const [catMethod, setCatMethod] = React.useState("STRAIGHT_LINE");
  const [catAssetAcc, setCatAssetAcc] = React.useState("1504");
  const [catAccumAcc, setCatAccumAcc] = React.useState("1592");
  const [catExpenseAcc, setCatExpenseAcc] = React.useState("6101");
  const [catDesc, setCatDesc] = React.useState("");

  // Form Lokasi State
  const [locName, setLocName] = React.useState("");
  const [locBuilding, setLocBuilding] = React.useState("");
  const [locFloor, setLocFloor] = React.useState("");
  const [locRoom, setLocRoom] = React.useState("");

  const { assetAccounts, accumDepAccounts, depExpenseAccounts } = useFaAccounts();

  const assetAccountOptions = React.useMemo(() => {
    return assetAccounts.map((a) => ({ value: a.code, label: a.label }));
  }, [assetAccounts]);

  const accumAccountOptions = React.useMemo(() => {
    return accumDepAccounts.map((a) => ({ value: a.code, label: a.label }));
  }, [accumDepAccounts]);

  const expenseAccountOptions = React.useMemo(() => {
    return depExpenseAccounts.map((a) => ({ value: a.code, label: a.label }));
  }, [depExpenseAccounts]);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [showAddCat, setShowAddCat] = React.useState(false);
  const [showAddLoc, setShowAddLoc] = React.useState(false);
  const [editingCatId, setEditingCatId] = React.useState<number | null>(null);
  const [editingLocId, setEditingLocId] = React.useState<number | null>(null);

  if (!visible) return null;

  const handleOpenAddCat = () => {
    setEditingCatId(null);
    setCatName("");
    setCatType("TANGIBLE");
    setCatMonths(48);
    setCatMethod("STRAIGHT_LINE");
    setCatAssetAcc("1504");
    setCatAccumAcc("1592");
    setCatExpenseAcc("6101");
    setCatDesc("");
    setShowAddCat(true);
  };

  const handleEditCategory = (c: FaCategory) => {
    setEditingCatId(c.id);
    setCatName(c.name);
    setCatType(c.type);
    setCatMonths(c.defaultUsefulLifeMonths || 48);
    setCatMethod(c.depreciationMethod || "STRAIGHT_LINE");
    setCatAssetAcc(c.assetAccountCode || "1504");
    setCatAccumAcc(c.accumDepAccountCode || "1592");
    setCatExpenseAcc(c.depExpenseAccountCode || "6101");
    setCatDesc(c.description || "");
    setShowAddCat(true);
  };

  const handleOpenAddLoc = () => {
    setEditingLocId(null);
    setLocName("");
    setLocBuilding("");
    setLocFloor("");
    setLocRoom("");
    setShowAddLoc(true);
  };

  const handleEditLocation = (loc: FaLocation) => {
    setEditingLocId(loc.id);
    setLocName(loc.name);
    setLocBuilding(loc.building || "");
    setLocFloor(loc.floor || "");
    setLocRoom(loc.room || "");
    setShowAddLoc(true);
  };

  const handleDeleteCategory = async (c: FaCategory) => {
    if (Number(c._count?.assets || 0) > 0) {
      setError(`Kategori "${c.name}" tidak dapat dihapus karena masih memiliki ${c._count?.assets} aset terdaftar.`);
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api("DELETE", `/fixed-assets/categories/${c.id}`);
      onRefresh();
    } catch (err: any) {
      setError(err?.message || "Gagal menghapus kategori.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLocation = async (loc: FaLocation) => {
    if (Number(loc._count?.assets || 0) > 0) {
      setError(`Lokasi "${loc.name}" tidak dapat dihapus karena masih memiliki ${loc._count?.assets} aset terdaftar.`);
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api("DELETE", `/fixed-assets/locations/${loc.id}`);
      onRefresh();
    } catch (err: any) {
      setError(err?.message || "Gagal menghapus lokasi.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCategory = async () => {
    if (!catName.trim()) {
      setError("Nama kategori wajib diisi.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const payload = {
        name: catName,
        type: catType,
        defaultUsefulLifeMonths: Number(catMonths),
        depreciationMethod: catMethod,
        assetAccountCode: catAssetAcc,
        accumDepAccountCode: catAccumAcc,
        depExpenseAccountCode: catExpenseAcc,
        description: catDesc,
      };

      if (editingCatId) {
        await api("PUT", `/fixed-assets/categories/${editingCatId}`, payload);
      } else {
        await api("POST", "/fixed-assets/categories", payload);
      }
      setCatName("");
      setCatDesc("");
      setEditingCatId(null);
      setShowAddCat(false);
      onRefresh();
    } catch (err: any) {
      setError(err?.message || "Gagal menyimpan kategori.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLocation = async () => {
    if (!locName.trim()) {
      setError("Nama lokasi wajib diisi.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const payload = {
        name: locName,
        building: locBuilding,
        floor: locFloor,
        room: locRoom,
      };

      if (editingLocId) {
        await api("PUT", `/fixed-assets/locations/${editingLocId}`, payload);
      } else {
        await api("POST", "/fixed-assets/locations", payload);
      }
      setLocName("");
      setLocBuilding("");
      setLocFloor("");
      setLocRoom("");
      setEditingLocId(null);
      setShowAddLoc(false);
      onRefresh();
    } catch (err: any) {
      setError(err?.message || "Gagal menyimpan lokasi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={visible} onOpenChange={(op) => { if (!op) onClose(); }}>
      <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] gap-0 p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="flex-row items-center justify-between px-6 py-4 border-b border-border bg-muted/10">
          <View className="flex-row items-center gap-2">
            <FolderKanban size={20} className="text-primary" />
            <DialogTitle className="font-bold text-base text-foreground">
              Pengaturan Kategori & Lokasi Aset
            </DialogTitle>
          </View>
        </DialogHeader>

          {/* Sub Navigation */}
          <View className="flex-row border-b border-border bg-muted/20 px-6 gap-6">
            <TouchableOpacity
              onPress={() => {
                setTab("categories");
                setError("");
              }}
              className={`py-3 border-b-2 flex-row items-center gap-2 ${
                tab === "categories" ? "border-primary" : "border-transparent"
              }`}
            >
              <FolderKanban size={16} className={tab === "categories" ? "text-primary" : "text-muted-foreground"} />
              <Text
                className={`text-xs font-bold ${
                  tab === "categories" ? "text-primary" : "text-muted-foreground"
                }`}
              >
                Kategori Aset ({categories.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setTab("locations");
                setError("");
              }}
              className={`py-3 border-b-2 flex-row items-center gap-2 ${
                tab === "locations" ? "border-primary" : "border-transparent"
              }`}
            >
              <MapPin size={16} className={tab === "locations" ? "text-primary" : "text-muted-foreground"} />
              <Text
                className={`text-xs font-bold ${
                  tab === "locations" ? "text-primary" : "text-muted-foreground"
                }`}
              >
                Lokasi & Ruangan ({locations.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView className="p-6 max-h-[65vh]" showsVerticalScrollIndicator={false}>
            {error ? (
              <View className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg mb-4">
                <Text className="text-xs text-destructive">{error}</Text>
              </View>
            ) : null}

            {/* TAB 1: KATEGORI ASET */}
            {tab === "categories" && (
              <View className="gap-4">
                <View className="flex-row justify-between items-center">
                  <Text className="text-xs text-muted-foreground">
                    Konfigurasi masa manfaat default dan pemetaan akun buku besar (COA).
                  </Text>
                  <Button
                    size="sm"
                    variant={showAddCat ? "outline" : "default"}
                    onPress={() => {
                      if (showAddCat) setShowAddCat(false);
                      else handleOpenAddCat();
                    }}
                    className="gap-1.5"
                  >
                    <Plus size={14} />
                    <Text className="text-xs">{showAddCat ? "Tutup Form" : "Tambah Kategori"}</Text>
                  </Button>
                </View>

                {/* Form Tambah/Edit Kategori */}
                {showAddCat && (
                  <View className="bg-primary/5 p-4 rounded-xl border border-primary/20 gap-3">
                    <Text className="text-xs font-bold text-foreground">
                      {editingCatId ? "Edit Kategori Aset Tetap" : "Tambah Kategori Baru"}
                    </Text>
                    <View className="flex-row gap-3">
                      <View className="flex-1">
                        <Text className="text-xs font-semibold text-foreground mb-1">Nama Kategori *</Text>
                        <TextInput
                          value={catName}
                          onChangeText={setCatName}
                          placeholder="Contoh: Server & Networking"
                          className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                        />
                      </View>
                      <View className="w-48">
                        <Text className="text-xs font-semibold text-foreground mb-1">Jenis Aset</Text>
                        <SearchableSelect
                          value={catType === "TANGIBLE" ? "Berwujud (Tangible)" : "Tak Berwujud (Intangible)"}
                          options={["Berwujud (Tangible)", "Tak Berwujud (Intangible)"]}
                          onChange={(val) => setCatType(val.startsWith("Berwujud") ? "TANGIBLE" : "INTANGIBLE")}
                          placeholder="Pilih Jenis"
                          className="h-10 rounded-lg bg-card border-border/80"
                        />
                      </View>
                    </View>

                    <View className="flex-row gap-3">
                      <View className="flex-1">
                        <Text className="text-xs font-semibold text-foreground mb-1">
                          Default Masa Manfaat (Bulan)
                        </Text>
                        <TextInput
                          value={String(catMonths)}
                          onChangeText={(v) => setCatMonths(Number(v.replace(/\D/g, "")) || 0)}
                          placeholder="48"
                          keyboardType="numeric"
                          className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs font-semibold text-foreground mb-1">
                          Metode Depresiasi
                        </Text>
                        <SearchableSelect
                          value={
                            catMethod === "STRAIGHT_LINE"
                              ? "Garis Lurus"
                              : catMethod === "DECLINING_BALANCE"
                              ? "Saldo Menurun"
                              : "Tidak Disusutkan"
                          }
                          options={["Garis Lurus", "Saldo Menurun", "Tidak Disusutkan"]}
                          onChange={(val) =>
                            setCatMethod(
                              val === "Garis Lurus"
                                ? "STRAIGHT_LINE"
                                : val === "Saldo Menurun"
                                ? "DECLINING_BALANCE"
                                : "NONE",
                            )
                          }
                          placeholder="Pilih Metode"
                          className="h-10 rounded-lg bg-card border-border/80"
                        />
                      </View>
                    </View>

                    <View className="flex-row gap-3">
                      <View className="flex-1">
                        <Text className="text-xs font-semibold text-foreground mb-1">
                          Akun Aset (COA)
                        </Text>
                        <SearchableSelect
                          value={assetAccountOptions.find((a) => a.value === catAssetAcc)?.label || catAssetAcc}
                          options={assetAccountOptions.map((a) => a.label)}
                          onChange={(val) => {
                            const found = assetAccountOptions.find((a) => a.label === val);
                            if (found) setCatAssetAcc(found.value);
                          }}
                          placeholder="Pilih Akun Aset"
                          className="h-10 rounded-lg bg-card border-border/80"
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs font-semibold text-foreground mb-1">
                          Akun Akumulasi Susut
                        </Text>
                        <SearchableSelect
                          value={accumAccountOptions.find((a) => a.value === catAccumAcc)?.label || catAccumAcc}
                          options={accumAccountOptions.map((a) => a.label)}
                          onChange={(val) => {
                            const found = accumAccountOptions.find((a) => a.label === val);
                            if (found) setCatAccumAcc(found.value);
                          }}
                          placeholder="Pilih Akun Akumulasi"
                          className="h-10 rounded-lg bg-card border-border/80"
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs font-semibold text-foreground mb-1">
                          Akun Beban Susut
                        </Text>
                        <SearchableSelect
                          value={expenseAccountOptions.find((a) => a.value === catExpenseAcc)?.label || catExpenseAcc}
                          options={expenseAccountOptions.map((a) => a.label)}
                          onChange={(val) => {
                            const found = expenseAccountOptions.find((a) => a.label === val);
                            if (found) setCatExpenseAcc(found.value);
                          }}
                          placeholder="Pilih Beban Susut"
                          className="h-10 rounded-lg bg-card border-border/80"
                        />
                      </View>
                    </View>

                    <View className="flex-row justify-end gap-2 mt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onPress={() => setShowAddCat(false)}
                        disabled={loading}
                      >
                        <Text className="text-xs">Batal</Text>
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        onPress={handleSaveCategory}
                        disabled={loading}
                      >
                        {loading ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text className="text-xs">
                            {editingCatId ? "Simpan Perubahan" : "Simpan Kategori"}
                          </Text>
                        )}
                      </Button>
                    </View>
                  </View>
                )}

                {/* List Kategori */}
                <View className="bg-background rounded-xl border border-border overflow-hidden">
                  <View className="flex-row bg-muted/40 px-4 py-2.5 border-b border-border items-center">
                    <Text className="w-20 text-xs font-bold text-muted-foreground">Kode</Text>
                    <Text className="flex-1 text-xs font-bold text-muted-foreground">Nama Kategori</Text>
                    <Text className="w-24 text-xs font-bold text-muted-foreground text-center">Jenis</Text>
                    <Text className="w-20 text-xs font-bold text-muted-foreground text-center">Manfaat</Text>
                    <Text className="w-28 text-xs font-bold text-muted-foreground text-center">Mapping COA</Text>
                    <Text className="w-16 text-xs font-bold text-muted-foreground text-center">Aset</Text>
                    <Text className="w-20 text-xs font-bold text-muted-foreground text-center">Aksi</Text>
                  </View>
                  {(categories || []).map((c) => (
                    <View
                      key={c.id}
                      className="flex-row px-4 py-2.5 border-b border-border/50 items-center hover:bg-muted/10"
                    >
                      <Text className="w-20 text-xs font-mono font-bold text-primary">{c.code}</Text>
                      <View className="flex-1 pr-2">
                        <Text className="text-xs font-bold text-foreground">{c.name}</Text>
                        {c.description ? (
                          <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                            {c.description}
                          </Text>
                        ) : null}
                      </View>
                      <Text className="w-24 text-xs text-muted-foreground text-center">{c.type}</Text>
                      <Text className="w-20 text-xs text-foreground text-center font-medium">
                        {c.defaultUsefulLifeMonths} bln
                      </Text>
                      <Text className="w-28 text-xs font-mono text-muted-foreground text-center">
                        {c.assetAccountCode || "-"}/{c.accumDepAccountCode || "-"}/
                        {c.depExpenseAccountCode || "-"}
                      </Text>
                      <Text className="w-16 text-xs font-bold text-primary text-center">
                        {c._count?.assets || 0}
                      </Text>
                      <View className="w-20 flex-row items-center justify-center gap-1">
                        <TouchableOpacity
                          onPress={() => handleEditCategory(c)}
                          className="p-1 rounded hover:bg-muted"
                        >
                          <Edit size={14} className="text-foreground" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteCategory(c)}
                          className="p-1 rounded hover:bg-destructive/10"
                        >
                          <Trash2 size={14} className="text-destructive" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* TAB 2: LOKASI & RUANGAN */}
            {tab === "locations" && (
              <View className="gap-4">
                <View className="flex-row justify-between items-center">
                  <Text className="text-xs text-muted-foreground">
                    Daftar gedung, lantai, dan ruangan penempatan fisik aset.
                  </Text>
                  <Button
                    size="sm"
                    variant={showAddLoc ? "outline" : "default"}
                    onPress={() => {
                      if (showAddLoc) setShowAddLoc(false);
                      else handleOpenAddLoc();
                    }}
                    className="gap-1.5"
                  >
                    <Plus size={14} />
                    <Text className="text-xs">{showAddLoc ? "Tutup Form" : "Tambah Lokasi"}</Text>
                  </Button>
                </View>

                {/* Form Tambah/Edit Lokasi */}
                {showAddLoc && (
                  <View className="bg-primary/5 p-4 rounded-xl border border-primary/20 gap-3">
                    <Text className="text-xs font-bold text-foreground">
                      {editingLocId ? "Edit Lokasi Penempatan Aset" : "Tambah Lokasi Baru"}
                    </Text>
                    <View className="flex-row gap-3">
                      <View className="flex-1">
                        <Text className="text-xs font-semibold text-foreground mb-1">Nama Lokasi *</Text>
                        <TextInput
                          value={locName}
                          onChangeText={setLocName}
                          placeholder="Ruang Server / Ruang Marketing / Gudang Utama"
                          className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs font-semibold text-foreground mb-1">Nama Gedung</Text>
                        <TextInput
                          value={locBuilding}
                          onChangeText={setLocBuilding}
                          placeholder="Kantor Pusat / Gudang Cikupa"
                          className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                        />
                      </View>
                    </View>

                    <View className="flex-row gap-3">
                      <View className="w-32">
                        <Text className="text-xs font-semibold text-foreground mb-1">Lantai</Text>
                        <TextInput
                          value={locFloor}
                          onChangeText={setLocFloor}
                          placeholder="1 / 2 / 3"
                          className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs font-semibold text-foreground mb-1">Ruangan</Text>
                        <TextInput
                          value={locRoom}
                          onChangeText={setLocRoom}
                          placeholder="Room 201 / Server Lab"
                          className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                        />
                      </View>
                    </View>

                    <View className="flex-row justify-end gap-2 mt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onPress={() => setShowAddLoc(false)}
                        disabled={loading}
                      >
                        <Text className="text-xs">Batal</Text>
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        onPress={handleSaveLocation}
                        disabled={loading}
                      >
                        {loading ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text className="text-xs">
                            {editingLocId ? "Simpan Perubahan" : "Simpan Lokasi"}
                          </Text>
                        )}
                      </Button>
                    </View>
                  </View>
                )}

                {/* List Lokasi */}
                <View className="bg-background rounded-xl border border-border overflow-hidden">
                  <View className="flex-row bg-muted/40 px-4 py-2.5 border-b border-border items-center">
                    <Text className="w-24 text-xs font-bold text-muted-foreground">Kode</Text>
                    <Text className="flex-1 text-xs font-bold text-muted-foreground">Nama Lokasi</Text>
                    <Text className="w-32 text-xs font-bold text-muted-foreground">Gedung</Text>
                    <Text className="w-16 text-xs font-bold text-muted-foreground text-center">Lantai</Text>
                    <Text className="w-32 text-xs font-bold text-muted-foreground">Ruangan</Text>
                    <Text className="w-16 text-xs font-bold text-muted-foreground text-center">Aset</Text>
                    <Text className="w-20 text-xs font-bold text-muted-foreground text-center">Aksi</Text>
                  </View>
                  {(locations || []).map((loc) => (
                    <View
                      key={loc.id}
                      className="flex-row px-4 py-2.5 border-b border-border/50 items-center hover:bg-muted/10"
                    >
                      <Text className="w-24 text-xs font-mono font-bold text-primary">{loc.code}</Text>
                      <Text className="flex-1 text-xs font-bold text-foreground pr-2">{loc.name}</Text>
                      <Text className="w-32 text-xs text-muted-foreground">{loc.building || "-"}</Text>
                      <Text className="w-16 text-xs text-muted-foreground text-center font-mono">
                        {loc.floor || "-"}
                      </Text>
                      <Text className="w-32 text-xs text-muted-foreground">{loc.room || "-"}</Text>
                      <Text className="w-16 text-xs font-bold text-primary text-center">
                        {loc._count?.assets || 0}
                      </Text>
                      <View className="w-20 flex-row items-center justify-center gap-1">
                        <TouchableOpacity
                          onPress={() => handleEditLocation(loc)}
                          className="p-1 rounded hover:bg-muted"
                        >
                          <Edit size={14} className="text-foreground" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteLocation(loc)}
                          className="p-1 rounded hover:bg-destructive/10"
                        >
                          <Trash2 size={14} className="text-destructive" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <DialogFooter className="flex-row justify-end px-6 py-3 border-t border-border bg-muted/20">
            <Button variant="outline" onPress={onClose}>
              <Text>Tutup</Text>
            </Button>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
