import * as React from "react";
import { View, TouchableOpacity, ScrollView, ActivityIndicator, TextInput } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect, UserSelect, DatePicker } from "@/components/taska/dialogs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { X, Plus, Edit, Calculator, Sparkles } from "lucide-react-native";
import { FaAsset, FaCategory, FaLocation } from "./types";
import { FaLocationSelect } from "./fa-location-select";
import { FaCategorySelect } from "./fa-category-select";
import { formatThousands } from "@/lib/format";
import { api } from "@/services/api";
import { useFaAccounts } from "./use-fa-accounts";

type Props = {
  visible: boolean;
  onClose: () => void;
  asset?: FaAsset | null;
  categories: FaCategory[];
  locations: FaLocation[];
  users: Array<{ id: number; name: string; department?: string }>;
  onSuccess: () => void;
};

export function AssetFormDialog(props: Props) {
  if (!props.visible) return null;
  const formKey = props.asset ? `edit-${props.asset.id}` : "create";
  return <AssetFormContent key={formKey} {...props} />;
}

function AssetFormContent({
  visible,
  onClose,
  asset,
  categories,
  locations,
  users,
  onSuccess,
}: Props) {
  const isEdit = Boolean(asset);

  const defaultCat = categories[0];
  const [name, setName] = React.useState(asset?.name || "");
  const [categoryId, setCategoryId] = React.useState<number | undefined>(
    asset?.categoryId ?? defaultCat?.id,
  );
  const selectedCat = React.useMemo(
    () => categories.find((c) => c.id === categoryId) || defaultCat,
    [categories, categoryId, defaultCat],
  );
  const [type, setType] = React.useState<"TANGIBLE" | "INTANGIBLE">(
    asset?.type || defaultCat?.type || "TANGIBLE",
  );
  const [brand, setBrand] = React.useState(asset?.brand || "");
  const [model, setModel] = React.useState(asset?.model || "");
  const [serialNumber, setSerialNumber] = React.useState(asset?.serialNumber || "");
  const [acquisitionDate, setAcquisitionDate] = React.useState(
    asset?.acquisitionDate
      ? new Date(asset.acquisitionDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  );
  const [inServiceDate, setInServiceDate] = React.useState(
    asset?.inServiceDate
      ? new Date(asset.inServiceDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  );
  const [acquisitionCost, setAcquisitionCost] = React.useState<number>(
    Number(asset?.acquisitionCost || 0),
  );
  const [residualValue, setResidualValue] = React.useState<number>(
    Number(asset?.residualValue || 0),
  );
  const [usefulLifeMonths, setUsefulLifeMonths] = React.useState<number>(
    Number(asset?.usefulLifeMonths || defaultCat?.defaultUsefulLifeMonths || 48),
  );
  const [depreciationMethod, setDepreciationMethod] = React.useState<string>(
    asset?.depreciationMethod || defaultCat?.depreciationMethod || "STRAIGHT_LINE",
  );
  const [locationId, setLocationId] = React.useState<number | undefined>(
    asset?.locationId || locations[0]?.id,
  );
  const [department, setDepartment] = React.useState(asset?.department || "");
  const [assignedUserId, setAssignedUserId] = React.useState<number | undefined>(
    asset?.assignedUserId || undefined,
  );
  const [warrantyExpiry, setWarrantyExpiry] = React.useState(
    asset?.warrantyExpiry
      ? new Date(asset.warrantyExpiry).toISOString().slice(0, 10)
      : "",
  );
  const [condition, setCondition] = React.useState<any>(asset?.condition || "GOOD");
  const [status, setStatus] = React.useState<any>(asset?.status || "REGISTERED");
  const [description, setDescription] = React.useState(asset?.description || "");
  const [creditAccountCode, setCreditAccountCode] = React.useState("1000.02");

  const { fundingOptions: dynamicFundingOptions } = useFaAccounts();
  const fundingAccountOptions = React.useMemo(() => {
    return dynamicFundingOptions.map((a) => ({
      value: a.code,
      label: a.label,
    }));
  }, [dynamicFundingOptions]);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  // Saat kategori diganti, isi default useful life & depreciation method
  const handleCategoryChange = (catId: number) => {
    setCategoryId(catId);
    const cat = (categories || []).find((c) => c.id === catId);
    if (cat) {
      setType(cat.type);
      setUsefulLifeMonths(cat.defaultUsefulLifeMonths || 48);
      setDepreciationMethod(cat.depreciationMethod || "STRAIGHT_LINE");
      if (Number(cat.defaultResidualRate) > 0 && acquisitionCost > 0) {
        setResidualValue(Math.round((acquisitionCost * Number(cat.defaultResidualRate)) / 100));
      }
    }
  };

  // Kalkulasi Preview Susut
  const depreciableAmount = Math.max(0, acquisitionCost - residualValue);
  const monthlyDep =
    usefulLifeMonths > 0 ? Math.floor(depreciableAmount / usefulLifeMonths) : 0;

  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeLocations = Array.isArray(locations) ? locations : [];
  const safeUsers = Array.isArray(users) ? users : [];

  const categoryOptions = React.useMemo(
    () => safeCategories.map((c) => ({ value: c.id, label: `${c.name} (${c.type})` })),
    [safeCategories],
  );

  const locationOptions = React.useMemo(
    () => [
      { value: 0, label: "-- Pilih Lokasi --" },
      ...safeLocations.map((l) => ({ value: l.id, label: l.name })),
    ],
    [safeLocations],
  );

  const userOptions = React.useMemo(
    () => [
      { value: 0, label: "-- Belum Ditugaskan (Pool) --" },
      ...safeUsers.map((u) => ({
        value: u.id,
        label: `${u.name}${u.department ? ` (${u.department})` : ""}`,
      })),
    ],
    [safeUsers],
  );

  const DEP_METHOD_OPTIONS = [
    { value: "STRAIGHT_LINE", label: "Garis Lurus (Straight Line)" },
    { value: "DECLINING_BALANCE", label: "Saldo Menurun (Declining)" },
    { value: "NONE", label: "Tidak Disusutkan (Tanah)" },
  ];

  const CONDITION_OPTIONS = [
    { value: "EXCELLENT", label: "Sangat Baik (A)" },
    { value: "GOOD", label: "Baik (B)" },
    { value: "FAIR", label: "Cukup (C)" },
    { value: "POOR", label: "Kurang (D)" },
    { value: "BROKEN", label: "Rusak (E)" },
  ];

  const STATUS_OPTIONS = [
    { value: "REGISTERED", label: "Terdaftar" },
    { value: "IN_SERVICE", label: "Siap Digunakan" },
    { value: "ASSIGNED", label: "Sedang Digunakan" },
    { value: "UNDER_MAINTENANCE", label: "Dalam Perbaikan" },
    { value: "IDLE", label: "Tidak Digunakan (Idle)" },
  ];

  if (!visible) return null;

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Nama aset wajib diisi.");
      return;
    }
    if (!categoryId) {
      setError("Kategori aset wajib dipilih.");
      return;
    }
    if (acquisitionCost <= 0) {
      setError("Nilai perolehan awal harus lebih dari 0.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const payload: any = {
        name,
        categoryId,
        type,
        brand,
        model,
        serialNumber,
        acquisitionDate,
        inServiceDate,
        acquisitionCost,
        residualValue,
        usefulLifeMonths,
        depreciationMethod,
        locationId,
        department,
        assignedUserId,
        warrantyExpiry: warrantyExpiry || undefined,
        condition,
        status,
        description,
        creditAccountCode,
      };

      if (isEdit && asset) {
        await api("PUT", `/fixed-assets/${asset.id}`, payload);
      } else {
        await api("POST", "/fixed-assets", payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Gagal menyimpan data aset.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={visible} onOpenChange={(op) => { if (!op) onClose(); }}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] gap-0 p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="flex-row items-center justify-between px-6 py-4 border-b border-border bg-muted/10">
          <View className="flex-row items-center gap-2">
            {isEdit ? <Edit size={20} className="text-primary" /> : <Plus size={20} className="text-primary" />}
            <DialogTitle className="font-bold text-base text-foreground">
              {isEdit ? `Edit Aset: ${asset?.assetCode}` : "Daftarkan Aset Tetap Baru"}
            </DialogTitle>
          </View>
        </DialogHeader>

        {/* Form Content */}
        <ScrollView className="p-6 max-h-[72vh]" showsVerticalScrollIndicator={false}>
            {error ? (
              <View className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg mb-4">
                <Text className="text-xs text-destructive">{error}</Text>
              </View>
            ) : null}

            {/* Bagian 1: Identitas Pokok Aset */}
            <View className="mb-4">
              <Text className="text-xs font-bold text-primary uppercase tracking-wider mb-2">
                1. Identitas Pokok Aset
              </Text>
              <View className="gap-3">
                <View>
                  <Text className="text-xs font-semibold text-foreground mb-1">Nama Aset *</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Contoh: Laptop ThinkPad T14 Gen 3 / Mobil Operasional Avanza"
                    className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                  />
                </View>

                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="text-xs font-semibold text-foreground mb-1">Kategori *</Text>
                    <FaCategorySelect
                      categoryId={categoryId}
                      categories={categories}
                      onChange={(cat) => {
                        if (cat) handleCategoryChange(cat.id);
                        else setCategoryId(undefined);
                      }}
                      className="h-10 rounded-lg bg-card border-border/80"
                    />
                  </View>

                  <View className="flex-1">
                    <Text className="text-xs font-semibold text-foreground mb-1">Merek (Brand)</Text>
                    <TextInput
                      value={brand}
                      onChangeText={setBrand}
                      placeholder="Lenovo / Toyota / Cisco / Informa"
                      className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                    />
                  </View>
                </View>

                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="text-xs font-semibold text-foreground mb-1">Model / Tipe</Text>
                    <TextInput
                      value={model}
                      onChangeText={setModel}
                      placeholder="T14 / G-AT / 2960X"
                      className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                    />
                  </View>

                  <View className="flex-1">
                    <Text className="text-xs font-semibold text-foreground mb-1">
                      Nomor Seri (Serial Number / Plat)
                    </Text>
                    <TextInput
                      value={serialNumber}
                      onChangeText={setSerialNumber}
                      placeholder="SN-XXXXX / B 1234 XYZ"
                      className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono"
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* Bagian 2: Nilai Finansial & Depresiasi */}
            <View className="mb-4 pt-3 border-t border-border">
              <Text className="text-xs font-bold text-primary uppercase tracking-wider mb-2">
                2. Nilai Finansial & Depresiasi (PRD Standar)
              </Text>
              <View className="gap-3">
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="text-xs font-semibold text-foreground mb-1">
                      Harga Perolehan (Rp) *
                    </Text>
                    <TextInput
                      value={acquisitionCost ? formatThousands(acquisitionCost) : ""}
                      onChangeText={(val: string) => {
                        const num = Number(val.replace(/\D/g, "")) || 0;
                        setAcquisitionCost(num);
                      }}
                      placeholder="Contoh: 15.000.000"
                      keyboardType="numeric"
                      className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground font-bold"
                    />
                  </View>

                  <View className="flex-1">
                    <Text className="text-xs font-semibold text-foreground mb-1">
                      Nilai Residu / Sisa (Rp)
                    </Text>
                    <TextInput
                      value={residualValue ? formatThousands(residualValue) : ""}
                      onChangeText={(val: string) => {
                        const num = Number(val.replace(/\D/g, "")) || 0;
                        setResidualValue(num);
                      }}
                      placeholder="0"
                      keyboardType="numeric"
                      className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                    />
                  </View>
                </View>

                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="text-xs font-semibold text-foreground mb-1">
                      Tanggal Perolehan *
                    </Text>
                    <DatePicker
                      value={acquisitionDate}
                      onChange={setAcquisitionDate}
                      placeholder="Pilih tanggal perolehan"
                    />
                  </View>

                  <View className="flex-1">
                    <Text className="text-xs font-semibold text-foreground mb-1">
                      Tanggal Siap Pakai (In-Service) *
                    </Text>
                    <DatePicker
                      value={inServiceDate}
                      onChange={setInServiceDate}
                      placeholder="Pilih tanggal siap pakai"
                    />
                  </View>
                </View>

                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="text-xs font-semibold text-foreground mb-1">
                      Masa Manfaat (Bulan) *
                    </Text>
                    <TextInput
                      value={usefulLifeMonths ? String(usefulLifeMonths) : ""}
                      onChangeText={(val: string) => setUsefulLifeMonths(Number(val.replace(/\D/g, "")) || 0)}
                      placeholder="48 (4 tahun)"
                      keyboardType="numeric"
                      className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                    />
                  </View>

                  <View className="flex-1">
                    <Text className="text-xs font-semibold text-foreground mb-1">
                      Metode Depresiasi
                    </Text>
                    <SearchableSelect
                      value={DEP_METHOD_OPTIONS.find((m) => m.value === depreciationMethod)?.label || ""}
                      options={DEP_METHOD_OPTIONS.map((m) => m.label)}
                      onChange={(val) => {
                        const found = DEP_METHOD_OPTIONS.find((m) => m.label === val);
                        if (found) setDepreciationMethod(found.value);
                      }}
                      placeholder="Pilih Metode"
                      className="h-10 rounded-lg bg-card border-border/80"
                    />
                  </View>
                </View>

                {/* Live Preview Depresiasi Box */}
                {depreciationMethod !== "NONE" && usefulLifeMonths > 0 ? (
                  <View className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <Calculator size={18} className="text-primary" />
                      <View>
                        <Text className="text-xs font-bold text-foreground">
                          Estimasi Penyusutan Bulanan:
                        </Text>
                        <Text className="text-[11px] text-muted-foreground">
                          (Rp {acquisitionCost.toLocaleString("id-ID")} - Rp{" "}
                          {residualValue.toLocaleString("id-ID")}) / {usefulLifeMonths} bln
                        </Text>
                      </View>
                    </View>
                    <Text className="text-sm font-bold text-primary">
                      Rp {monthlyDep.toLocaleString("id-ID")} / bln
                    </Text>
                  </View>
                ) : null}

                {/* Akun Kredit / Sumber Dana Pembelian */}
                {!isEdit && (
                  <View className="bg-muted/30 p-3 rounded-xl border border-border">
                    <Text className="text-xs font-semibold text-foreground mb-1">
                      Sumber Dana Perolehan (Kredit COA Kas/Bank/Modal)
                    </Text>
                    <SearchableSelect
                      value={
                        fundingAccountOptions.find((a) => a.value === creditAccountCode)?.label || creditAccountCode
                      }
                      options={fundingAccountOptions.map((a) => a.label)}
                      onChange={(val) => {
                        const found = fundingAccountOptions.find((a) => a.label === val);
                        if (found) setCreditAccountCode(found.value);
                      }}
                      placeholder="Pilih Akun Sumber Dana"
                      className="h-10 rounded-lg bg-card border-border/80"
                    />
                    <Text className="text-[11px] text-muted-foreground mt-1">
                      Posting jurnal otomatis ke COA: Debit Akun Aset Tetap ({selectedCat?.assetAccountCode || "1504"}) & Kredit {creditAccountCode}.
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Bagian 3: Lokasi, PIC & Penugasan */}
            <View className="mb-4 pt-3 border-t border-border">
              <Text className="text-xs font-bold text-primary uppercase tracking-wider mb-2">
                3. Lokasi & Tanggung Jawab (PIC)
              </Text>
              <View className="gap-3">
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="text-xs font-semibold text-foreground mb-1">
                      Lokasi Penempatan
                    </Text>
                    <FaLocationSelect
                      locationId={locationId}
                      locations={locations}
                      onChange={(loc) => {
                        setLocationId(loc?.id ?? undefined);
                      }}
                      className="h-10 rounded-lg bg-card border-border/80"
                    />
                  </View>

                  <View className="flex-1">
                    <Text className="text-xs font-semibold text-foreground mb-1">Departemen</Text>
                    <TextInput
                      value={department}
                      onChangeText={setDepartment}
                      placeholder="IT / Operasional / Marketing"
                      className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                    />
                  </View>
                </View>

                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="text-xs font-semibold text-foreground mb-1">
                      Karyawan Pemegang (PIC)
                    </Text>
                    <UserSelect
                      userId={assignedUserId}
                      value={
                        userOptions.find((u) => u.value === assignedUserId)?.label ||
                        (asset?.assignedUser?.name ?? "")
                      }
                      onChange={(u) => {
                        if (u?.id) {
                          const uId = Number(u.id);
                          setAssignedUserId(uId);
                          if (u.roleLabel && !department) {
                            setDepartment(u.roleLabel);
                          }
                        } else {
                          setAssignedUserId(undefined);
                        }
                      }}
                      placeholder="Cari & pilih PIC (Karyawan)..."
                      triggerClassName="h-10 rounded-lg bg-card border-border/80"
                    />
                  </View>

                  <View className="flex-1">
                    <Text className="text-xs font-semibold text-foreground mb-1">
                      Garansi Berakhir
                    </Text>
                    <DatePicker
                      value={warrantyExpiry}
                      onChange={setWarrantyExpiry}
                      placeholder="Pilih tanggal garansi"
                      clearable
                    />
                  </View>
                </View>

                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="text-xs font-semibold text-foreground mb-1">Kondisi Fisik</Text>
                    <SearchableSelect
                      value={CONDITION_OPTIONS.find((c) => c.value === condition)?.label || ""}
                      options={CONDITION_OPTIONS.map((c) => c.label)}
                      onChange={(val) => {
                        const found = CONDITION_OPTIONS.find((c) => c.label === val);
                        if (found) setCondition(found.value);
                      }}
                      placeholder="Pilih Kondisi"
                      className="h-10 rounded-lg bg-card border-border/80"
                    />
                  </View>

                  <View className="flex-1">
                    <Text className="text-xs font-semibold text-foreground mb-1">Status Operasional</Text>
                    <SearchableSelect
                      value={STATUS_OPTIONS.find((s) => s.value === status)?.label || ""}
                      options={STATUS_OPTIONS.map((s) => s.label)}
                      onChange={(val) => {
                        const found = STATUS_OPTIONS.find((s) => s.label === val);
                        if (found) setStatus(found.value);
                      }}
                      placeholder="Pilih Status"
                      className="h-10 rounded-lg bg-card border-border/80"
                    />
                  </View>
                </View>

                <View>
                  <Text className="text-xs font-semibold text-foreground mb-1">
                    Deskripsi / Catatan Tambahan
                  </Text>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Keterangan spesifikasi teknis, kondisi fisik, atau kelengkapan..."
                    multiline
                    numberOfLines={2}
                    className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                  />
                </View>
              </View>
            </View>
        </ScrollView>

        {/* Footer */}
        <DialogFooter className="flex-row items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
          <Button variant="outline" onPress={onClose} disabled={loading}>
            <Text>Batal</Text>
          </Button>
          <Button variant="default" onPress={handleSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text>{isEdit ? "Simpan Perubahan" : "Daftarkan Aset"}</Text>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
