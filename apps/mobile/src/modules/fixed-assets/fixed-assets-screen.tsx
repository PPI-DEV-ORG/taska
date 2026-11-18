import * as React from "react";
import { View, TouchableOpacity, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/taska/basics";
import { SearchableSelect } from "@/components/taska/dialogs";
import { colors } from "@/tokens";
import {
  Boxes,
  Plus,
  Search,
  Filter,
  QrCode,
  UserCheck,
  ArrowRightLeft,
  Trash2,
  Eye,
  Edit,
  FolderKanban,
  Calculator,
  ClipboardCheck,
  Download,
  AlertTriangle,
  ShieldCheck,
  TrendingDown,
  RefreshCw,
} from "lucide-react-native";
import {
  FaAsset,
  FaCategory,
  FaLocation,
  CONDITION_COLORS,
  STATUS_COLORS,
} from "./types";
import { AssetFormDialog } from "./asset-form-dialog";
import { AssetQrDialog } from "./asset-qr-dialog";
import { AssetAssignmentDialog } from "./asset-assignment-dialog";
import { AssetTransferDialog } from "./asset-transfer-dialog";
import { AssetDisposalDialog } from "./asset-disposal-dialog";
import { AssetDetailModal } from "./asset-detail-modal";
import { CategoriesLocationsDialog } from "./categories-locations-dialog";
import { AssetDepreciationPanel } from "./asset-depreciation-panel";
import { AssetAuditPanel } from "./asset-audit-panel";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";

export function FixedAssetsScreen({
  initialAssetId,
}: {
  initialAssetId?: string | number;
} = {}) {
  const { user } = useApp();

  const [activeTab, setActiveTab] = React.useState<"registry" | "depreciation" | "audit">(
    "registry",
  );

  const [assets, setAssets] = React.useState<FaAsset[]>([]);
  const [categories, setCategories] = React.useState<FaCategory[]>([]);
  const [locations, setLocations] = React.useState<FaLocation[]>([]);
  const [users, setUsers] = React.useState<Array<{ id: number; name: string; department?: string }>>([]);

  const [dashboard, setDashboard] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);

  // Filters
  const [search, setSearch] = React.useState("");
  const [filterCategory, setFilterCategory] = React.useState<string>("");
  const [filterLocation, setFilterLocation] = React.useState<string>("");
  const [filterStatus, setFilterStatus] = React.useState<string>("");
  const [filterCondition, setFilterCondition] = React.useState<string>("");

  // Dialog states
  const [showForm, setShowForm] = React.useState(false);
  const [selectedAssetForEdit, setSelectedAssetForEdit] = React.useState<FaAsset | null>(null);

  const initialNum = initialAssetId ? Number(initialAssetId) : null;
  const validInitialId =
    initialNum !== null && !isNaN(initialNum) && Number.isInteger(initialNum)
      ? initialNum
      : null;

  const [showDetail, setShowDetail] = React.useState(Boolean(validInitialId));
  const [selectedAssetId, setSelectedAssetId] = React.useState<number | null>(validInitialId);

  React.useEffect(() => {
    if (initialAssetId && !validInitialId) {
      let active = true;
      api("GET", `/fixed-assets/${initialAssetId}`)
        .then((res: any) => {
          if (active && res?.id) {
            setSelectedAssetId(res.id);
            setShowDetail(true);
          }
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }
  }, [initialAssetId, validInitialId]);

  const [showQr, setShowQr] = React.useState(false);
  const [selectedAssetForQr, setSelectedAssetForQr] = React.useState<FaAsset | null>(null);

  const [showAssign, setShowAssign] = React.useState(false);
  const [selectedAssetForAssign, setSelectedAssetForAssign] = React.useState<FaAsset | null>(null);

  const [showTransfer, setShowTransfer] = React.useState(false);
  const [selectedAssetForTransfer, setSelectedAssetForTransfer] = React.useState<FaAsset | null>(
    null,
  );

  const [showDisposal, setShowDisposal] = React.useState(false);
  const [selectedAssetForDisposal, setSelectedAssetForDisposal] = React.useState<FaAsset | null>(
    null,
  );

  const [showCatLoc, setShowCatLoc] = React.useState(false);

  // Fetch Master Data
  const fetchLookups = React.useCallback(async () => {
    try {
      const [cats, locs, usrs, dash] = await Promise.allSettled([
        api<FaCategory[]>("GET", "/fixed-assets/categories"),
        api<FaLocation[]>("GET", "/fixed-assets/locations"),
        api<any[]>("GET", "/users/options"),
        api<any>("GET", "/fixed-assets/dashboard"),
      ]);

      if (cats.status === "fulfilled" && Array.isArray(cats.value)) {
        setCategories(cats.value);
      }
      if (locs.status === "fulfilled" && Array.isArray(locs.value)) {
        setLocations(locs.value);
      }
      if (usrs.status === "fulfilled") {
        const uList = Array.isArray(usrs.value)
          ? usrs.value
          : Array.isArray((usrs.value as any)?.data)
          ? (usrs.value as any).data
          : [];
        setUsers(uList);
      }
      if (dash.status === "fulfilled" && dash.value) {
        setDashboard(dash.value);
      }
    } catch (err) {
      console.error("Gagal mengambil data master:", err);
    }
  }, []);

  // Fetch Asset List
  const fetchAssets = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append("q", search.trim());
      if (filterCategory) params.append("categoryId", filterCategory);
      if (filterLocation) params.append("locationId", filterLocation);
      if (filterStatus) params.append("status", filterStatus);
      if (filterCondition) params.append("condition", filterCondition);
      params.append("limit", "200");

      const res: any = await api("GET", `/fixed-assets?${params.toString()}`);
      setAssets(res?.data || []);
    } catch (err) {
      console.error("Gagal mengambil daftar aset:", err);
    } finally {
      setLoading(false);
    }
  }, [search, filterCategory, filterLocation, filterStatus, filterCondition]);

  React.useEffect(() => {
    let active = true;
    Promise.all([
      api<FaCategory[]>("GET", "/fixed-assets/categories"),
      api<FaLocation[]>("GET", "/fixed-assets/locations"),
      api<any[]>("GET", "/users?limit=200"),
      api<any>("GET", "/fixed-assets/dashboard"),
    ])
      .then(([cats, locs, usrs, dash]) => {
        if (!active) return;
        setCategories(cats || []);
        setLocations(locs || []);
        setUsers((usrs as any)?.data || usrs || []);
        setDashboard(dash || null);
      })
      .catch((err) => {
        console.error("Gagal mengambil data master:", err);
      });
    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (search.trim()) params.append("q", search.trim());
    if (filterCategory) params.append("categoryId", filterCategory);
    if (filterLocation) params.append("locationId", filterLocation);
    if (filterStatus) params.append("status", filterStatus);
    if (filterCondition) params.append("condition", filterCondition);
    params.append("limit", "200");

    api<any>("GET", `/fixed-assets?${params.toString()}`)
      .then((res) => {
        if (active) setAssets(res?.data || []);
      })
      .catch((err) => {
        console.error("Gagal mengambil daftar aset:", err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [search, filterCategory, filterLocation, filterStatus, filterCondition]);

  const overview = dashboard?.overview || {
    totalAssets: assets.length,
    activeAssets: assets.length,
    totalCost: assets.reduce((acc, a) => acc + Number(a.acquisitionCost || 0), 0),
    totalAccumDep: assets.reduce((acc, a) => acc + Number(a.accumulatedDepreciation || 0), 0),
    totalNetBookValue: assets.reduce((acc, a) => acc + Number(a.bookValue || 0), 0),
  };

  const attention = dashboard?.attentionCards || {
    warrantyExpiringSoon: 0,
    underMaintenance: 0,
    unassigned: 0,
    damaged: 0,
  };

  const categoryFilterOptions = React.useMemo(
    () => [
      { value: "", label: "Semua Kategori" },
      ...(Array.isArray(categories) ? categories : []).map((c) => ({ value: String(c.id), label: c.name })),
    ],
    [categories],
  );

  const locationFilterOptions = React.useMemo(
    () => [
      { value: "", label: "Semua Lokasi" },
      ...(Array.isArray(locations) ? locations : []).map((l) => ({ value: String(l.id), label: l.name })),
    ],
    [locations],
  );

  const STATUS_FILTER_OPTIONS = [
    { value: "", label: "Semua Status" },
    { value: "REGISTERED", label: "Terdaftar" },
    { value: "IN_SERVICE", label: "Siap Pakai" },
    { value: "ASSIGNED", label: "Sedang Digunakan" },
    { value: "UNDER_MAINTENANCE", label: "Dalam Perbaikan" },
    { value: "IDLE", label: "Tidak Digunakan" },
    { value: "DAMAGED", label: "Rusak" },
    { value: "DISPOSED", label: "Dilepas / Dijual" },
    { value: "WRITTEN_OFF", label: "Dihapusbukukan" },
  ];

  const CONDITION_FILTER_OPTIONS = [
    { value: "", label: "Semua Kondisi" },
    { value: "EXCELLENT", label: "Sangat Baik (A)" },
    { value: "GOOD", label: "Baik (B)" },
    { value: "FAIR", label: "Cukup (C)" },
    { value: "POOR", label: "Kurang (D)" },
    { value: "BROKEN", label: "Rusak (E)" },
  ];

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingBottom: 64 }}>
      <View className="gap-5 w-full">
        {/* Page Header */}
        <PageHeader
          title="Aset Tetap (Fixed Asset)"
          subtitle="Siklus hidup aset internal perusahaan, inventaris fisik, nilai buku & depresiasi"
          showRefresh={true}
          onRefresh={fetchLookups}
          action={
            <View className="flex-row items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onPress={() => setShowCatLoc(true)}
                className="gap-2 border-border/80 h-9 px-3 rounded-xl"
              >
                <FolderKanban size={14} color={colors.text} />
                <Text className="text-xs font-semibold">Kategori & Lokasi</Text>
              </Button>

              <Button
                size="sm"
                onPress={() => {
                  setSelectedAssetForEdit(null);
                  setShowForm(true);
                }}
                className="gap-1.5 h-9 px-3 rounded-xl"
              >
                <Plus size={14} color="#FFFFFF" />
                <Text className="text-xs font-semibold text-white">Daftarkan Aset Baru</Text>
              </Button>
            </View>
          }
        />

        {/* Top 4 KPI Metric Cards */}
        <View className="flex-row gap-3.5 flex-wrap w-full">
          <View className="flex-1 min-w-[220px] bg-card border border-border/80 p-4 rounded-2xl shadow-sm">
            <Text className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Total Nilai Perolehan
            </Text>
            <Text className="text-xl sm:text-2xl font-bold text-foreground mt-1 tracking-tight">
              Rp {Number(overview.totalCost || 0).toLocaleString("id-ID")}
            </Text>
            <Text className="text-xs text-muted-foreground mt-1">
              {overview.activeAssets} Aset aktif operasional
            </Text>
          </View>

          <View className="flex-1 min-w-[220px] bg-card border border-border/80 p-4 rounded-2xl shadow-sm">
            <Text className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">
              Akumulasi Penyusutan
            </Text>
            <Text className="text-xl sm:text-2xl font-bold text-amber-600 mt-1 tracking-tight">
              Rp {Number(overview.totalAccumDep || 0).toLocaleString("id-ID")}
            </Text>
            <Text className="text-xs text-muted-foreground mt-1">
              Terkait akun beban{" "}
              <Text className="font-mono font-bold text-primary">6101</Text>
            </Text>
          </View>

          <View className="flex-1 min-w-[220px] bg-card border border-border/80 p-4 rounded-2xl shadow-sm">
            <Text className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">
              Nilai Buku Bersih (NBV)
            </Text>
            <Text className="text-xl sm:text-2xl font-bold text-emerald-600 mt-1 tracking-tight">
              Rp {Number(overview.totalNetBookValue || 0).toLocaleString("id-ID")}
            </Text>
            <Text className="text-xs text-muted-foreground mt-1">
              Saldo bersih neraca aset tetap
            </Text>
          </View>

          <View className="flex-1 min-w-[220px] bg-card border border-border/80 p-4 rounded-2xl shadow-sm">
            <Text className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Perhatian Khusus
            </Text>
            <View className="flex-row gap-2 mt-1.5 flex-wrap">
              {attention.underMaintenance > 0 && (
                <View className="bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/30">
                  <Text className="text-[10px] font-bold text-amber-600">
                    {attention.underMaintenance} Servis
                  </Text>
                </View>
              )}
              {attention.damaged > 0 && (
                <View className="bg-red-500/10 px-2 py-0.5 rounded-lg border border-red-500/30">
                  <Text className="text-[10px] font-bold text-destructive">
                    {attention.damaged} Rusak
                  </Text>
                </View>
              )}
              {attention.unassigned > 0 && (
                <View className="bg-muted px-2 py-0.5 rounded-lg border border-border">
                  <Text className="text-[10px] font-medium text-muted-foreground">
                    {attention.unassigned} Tanpa PIC
                  </Text>
                </View>
              )}
            </View>
            <Text className="text-xs text-muted-foreground mt-1">
              {attention.warrantyExpiringSoon} garansi segera berakhir
            </Text>
          </View>
        </View>

        {/* Main Screen Navigation Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="w-full">
          <View className="bg-panel border-border/80 flex-row items-center rounded-2xl border p-1.5 gap-1.5">
            {[
              { id: "registry", label: "Semua Aset (Asset Registry)", icon: Boxes, count: assets.length },
              { id: "depreciation", label: "Depresiasi & Jurnal Bulanan", icon: Calculator, count: null },
              { id: "audit", label: "Audit Fisik & Opname (QR)", icon: ClipboardCheck, count: null },
            ].map((t) => {
              const active = activeTab === t.id;
              const IconComp = t.icon;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setActiveTab(t.id as any)}
                  className={`flex-row items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                    active ? "bg-primary shadow-sm" : "hover:bg-card/60"
                  }`}
                >
                  <IconComp size={15} color={active ? "#FFFFFF" : colors.textSecondary} />
                  <Text
                    className={`text-xs font-semibold ${
                      active ? "text-white" : "text-muted-foreground"
                    }`}
                  >
                    {t.label}
                  </Text>
                  {t.count !== null && (
                    <View
                      className={`rounded-full px-1.5 py-0.2 min-w-[18px] items-center justify-center ${
                        active ? "bg-white/20" : "bg-panel border border-border/60"
                      }`}
                    >
                      <Text
                        className={`text-[10px] font-bold ${
                          active ? "text-white" : "text-muted-foreground"
                        }`}
                      >
                        {t.count}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* TAB 1: ASSET REGISTRY (MAIN TABLE & FILTERS) */}
        {activeTab === "registry" && (
          <View className="gap-4 w-full">
            {/* Filter Bar */}
            <View className="bg-card rounded-2xl border border-border/80 p-3.5 flex-row gap-2.5 items-center flex-wrap shadow-sm w-full">
              {/* Search Input */}
              <View className="flex-1 min-w-[200px] flex-row items-center bg-card border border-border/80 rounded-xl px-3 h-10 shadow-sm">
                <Search size={15} color={colors.textSecondary} />
                <Input
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Cari kode aset, nama, SN, merek, PIC..."
                  className="flex-1 h-8 text-xs border-0 bg-transparent px-2 shadow-none"
                />
              </View>

              {/* Filter Category */}
              <View className="w-full sm:w-44">
                <SearchableSelect
                  value={categoryFilterOptions.find((o) => o.value === filterCategory)?.label || ""}
                  options={categoryFilterOptions.map((o) => o.label)}
                  onChange={(lbl) => {
                    const match = categoryFilterOptions.find((o) => o.label === lbl);
                    setFilterCategory(match ? match.value : "");
                  }}
                  placeholder="Semua Kategori"
                  clearable
                  className="h-10 rounded-xl bg-card border-border/80 shadow-sm px-3"
                />
              </View>

              {/* Filter Location */}
              <View className="w-full sm:w-44">
                <SearchableSelect
                  value={locationFilterOptions.find((o) => o.value === filterLocation)?.label || ""}
                  options={locationFilterOptions.map((o) => o.label)}
                  onChange={(lbl) => {
                    const match = locationFilterOptions.find((o) => o.label === lbl);
                    setFilterLocation(match ? match.value : "");
                  }}
                  placeholder="Semua Lokasi"
                  clearable
                  className="h-10 rounded-xl bg-card border-border/80 shadow-sm px-3"
                />
              </View>

              {/* Filter Status */}
              <View className="w-full sm:w-40">
                <SearchableSelect
                  value={STATUS_FILTER_OPTIONS.find((o) => o.value === filterStatus)?.label || ""}
                  options={STATUS_FILTER_OPTIONS.map((o) => o.label)}
                  onChange={(lbl) => {
                    const match = STATUS_FILTER_OPTIONS.find((o) => o.label === lbl);
                    setFilterStatus(match ? match.value : "");
                  }}
                  placeholder="Semua Status"
                  clearable
                  className="h-10 rounded-xl bg-card border-border/80 shadow-sm px-3"
                />
              </View>

              {/* Filter Condition */}
              <View className="w-full sm:w-40">
                <SearchableSelect
                  value={CONDITION_FILTER_OPTIONS.find((o) => o.value === filterCondition)?.label || ""}
                  options={CONDITION_FILTER_OPTIONS.map((o) => o.label)}
                  onChange={(lbl) => {
                    const match = CONDITION_FILTER_OPTIONS.find((o) => o.label === lbl);
                    setFilterCondition(match ? match.value : "");
                  }}
                  placeholder="Semua Kondisi"
                  clearable
                  className="h-10 rounded-xl bg-card border-border/80 shadow-sm px-3"
                />
              </View>

              <Button
                size="sm"
                variant="ghost"
                onPress={fetchAssets}
                className="h-10 w-10 p-0 rounded-xl border border-border/80 hover:bg-panel"
              >
                <RefreshCw size={14} color={colors.textSecondary} className={loading ? "animate-spin" : ""} />
              </Button>
            </View>

            {/* Table Container */}
            <View className="bg-card rounded-2xl border border-border/80 overflow-hidden shadow-sm">
              {loading ? (
                <View className="py-20 items-center justify-center">
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text className="text-xs text-muted-foreground mt-2">Memuat daftar aset...</Text>
                </View>
              ) : assets.length === 0 ? (
                <View className="py-16 items-center justify-center px-4">
                  <Boxes size={44} color={colors.muted} />
                  <Text className="text-base font-bold text-foreground mt-3">Belum Ada Aset Tetap</Text>
                  <Text className="text-xs text-muted-foreground text-center mt-1 max-w-sm">
                    Daftarkan aset perusahaan (laptop, mobil, server, meja) untuk melacak lokasi, PIC,
                    dan depresiasinya.
                  </Text>
                  <Button
                    size="sm"
                    onPress={() => {
                      setSelectedAssetForEdit(null);
                      setShowForm(true);
                    }}
                    className="mt-4 gap-1.5 h-9 px-4 rounded-xl"
                  >
                    <Plus size={14} color="#FFFFFF" />
                    <Text className="text-xs font-semibold text-white">Daftarkan Aset Pertama</Text>
                  </Button>
                </View>
              ) : (
                <View className="overflow-x-auto">
                  {/* Table Header */}
                  <View className="flex-row bg-muted/40 px-5 py-3 border-b border-border/80">
                    <Text className="w-36 text-xs font-semibold text-muted-foreground">Kode Aset</Text>
                    <Text className="flex-1 text-xs font-semibold text-muted-foreground min-w-[200px]">
                      Nama & Spesifikasi Aset
                    </Text>
                    <Text className="w-36 text-xs font-semibold text-muted-foreground">Kategori</Text>
                    <Text className="w-36 text-xs font-semibold text-muted-foreground">Lokasi</Text>
                    <Text className="w-36 text-xs font-semibold text-muted-foreground">PIC / Penanggung Jawab</Text>
                    <Text className="w-32 text-xs font-semibold text-muted-foreground text-right">
                      Harga Perolehan
                    </Text>
                    <Text className="w-32 text-xs font-semibold text-muted-foreground text-right">
                      Nilai Buku (NBV)
                    </Text>
                    <Text className="w-24 text-xs font-semibold text-muted-foreground text-center">
                      Kondisi
                    </Text>
                    <Text className="w-28 text-xs font-semibold text-muted-foreground text-center">
                      Status
                    </Text>
                    <Text className="w-44 text-xs font-semibold text-muted-foreground text-center">
                      Aksi
                    </Text>
                </View>

                {/* Table Rows */}
                {(Array.isArray(assets) ? assets : []).map((asset) => {
                  const condBadge = CONDITION_COLORS[asset.condition];
                  const statBadge = STATUS_COLORS[asset.status];

                  return (
                    <View
                      key={asset.id}
                      className="flex-row px-5 py-3 border-b border-border/50 items-center hover:bg-muted/10 transition-colors"
                    >
                      {/* Kode Aset */}
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedAssetId(asset.id);
                          setShowDetail(true);
                        }}
                        className="w-36"
                      >
                        <Text className="text-xs font-mono font-bold text-primary hover:underline">
                          {asset.assetCode}
                        </Text>
                        <Text className="text-[10px] text-muted-foreground">{asset.acquisitionDate}</Text>
                      </TouchableOpacity>

                      {/* Nama & Spesifikasi */}
                      <View className="flex-1 min-w-[200px] pr-2">
                        <Text className="text-xs font-bold text-foreground" numberOfLines={1}>
                          {asset.name}
                        </Text>
                        <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                          {asset.brand || "-"} {asset.model ? `· ${asset.model}` : ""}{" "}
                          {asset.serialNumber ? `· SN: ${asset.serialNumber}` : ""}
                        </Text>
                      </View>

                      {/* Kategori */}
                      <Text className="w-36 text-xs text-foreground" numberOfLines={1}>
                        {asset.category?.name || "-"}
                      </Text>

                      {/* Lokasi */}
                      <Text className="w-36 text-xs text-muted-foreground" numberOfLines={1}>
                        {asset.location?.name || "-"}
                      </Text>

                      {/* PIC */}
                      <Text className="w-36 text-xs font-medium text-foreground" numberOfLines={1}>
                        {asset.assignedUser?.name || (
                          <Text className="text-muted-foreground italic">Belum Ada PIC</Text>
                        )}
                      </Text>

                      {/* Harga Perolehan */}
                      <Text className="w-32 text-xs font-medium text-foreground text-right">
                        Rp {Number(asset.acquisitionCost).toLocaleString("id-ID")}
                      </Text>

                      {/* Nilai Buku (NBV) */}
                      <Text className="w-32 text-xs font-bold text-foreground text-right">
                        Rp {Number(asset.bookValue).toLocaleString("id-ID")}
                      </Text>

                      {/* Kondisi */}
                      <View className="w-24 items-center">
                        {condBadge ? (
                          <View
                            className="px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: condBadge.bg }}
                          >
                            <Text
                              className="text-[9px] font-bold"
                              style={{ color: condBadge.text }}
                            >
                              {condBadge.label.split(" ")[0]}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Status */}
                      <View className="w-28 items-center">
                        {statBadge ? (
                          <View
                            className="px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: statBadge.bg }}
                          >
                            <Text
                              className="text-[9px] font-bold"
                              style={{ color: statBadge.text }}
                            >
                              {statBadge.label}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Aksi Per Baris */}
                      <View className="w-44 flex-row items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-1.5 h-8 w-8 rounded-lg"
                          onPress={() => {
                            setSelectedAssetId(asset.id);
                            setShowDetail(true);
                          }}
                        >
                          <Eye size={14} className="text-muted-foreground" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-1.5 h-8 w-8 rounded-lg"
                          onPress={() => {
                            setSelectedAssetForEdit(asset);
                            setShowForm(true);
                          }}
                        >
                          <Edit size={14} className="text-foreground" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-1.5 h-8 w-8 rounded-lg"
                          onPress={() => {
                            setSelectedAssetForQr(asset);
                            setShowQr(true);
                          }}
                        >
                          <QrCode size={14} className="text-primary" />
                        </Button>

                        {asset.status !== "DISPOSED" && asset.status !== "WRITTEN_OFF" ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="p-1.5 h-8 w-8 rounded-lg"
                              onPress={() => {
                                setSelectedAssetForAssign(asset);
                                setShowAssign(true);
                              }}
                            >
                              <UserCheck size={14} className="text-foreground" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="p-1.5 h-8 w-8 rounded-lg"
                              onPress={() => {
                                setSelectedAssetForTransfer(asset);
                                setShowTransfer(true);
                              }}
                            >
                              <ArrowRightLeft size={14} className="text-foreground" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="p-1.5 h-8 w-8 rounded-lg"
                              onPress={() => {
                                setSelectedAssetForDisposal(asset);
                                setShowDisposal(true);
                              }}
                            >
                              <Trash2 size={14} className="text-destructive" />
                            </Button>
                          </>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      )}

      {/* TAB 2: DEPRESIASI & JURNAL BULANAN */}
      {activeTab === "depreciation" && (
        <AssetDepreciationPanel
          onDepreciationPosted={() => {
            fetchAssets();
            fetchLookups();
          }}
        />
      )}

      {/* TAB 3: AUDIT FISIK & OPNAME (QR) */}
      {activeTab === "audit" && <AssetAuditPanel locations={locations} />}

      {/* DIALOGS */}
      {showForm && (
        <AssetFormDialog
          visible={showForm}
          onClose={() => setShowForm(false)}
          asset={selectedAssetForEdit}
          categories={categories}
          locations={locations}
          users={users}
          onSuccess={() => {
            fetchAssets();
            fetchLookups();
          }}
        />
      )}

      {showDetail && selectedAssetId && (
        <AssetDetailModal
          visible={showDetail}
          onClose={() => {
            setShowDetail(false);
            setSelectedAssetId(null);
          }}
          assetId={selectedAssetId}
          onOpenQr={(a) => {
            setSelectedAssetForQr(a);
            setShowQr(true);
          }}
          onOpenAssign={(a) => {
            setSelectedAssetForAssign(a);
            setShowAssign(true);
          }}
          onOpenTransfer={(a) => {
            setSelectedAssetForTransfer(a);
            setShowTransfer(true);
          }}
          onOpenDisposal={(a) => {
            setSelectedAssetForDisposal(a);
            setShowDisposal(true);
          }}
          onOpenEdit={(a) => {
            setSelectedAssetForEdit(a);
            setShowDetail(false);
            setShowForm(true);
          }}
        />
      )}

      {showQr && selectedAssetForQr && (
        <AssetQrDialog
          visible={showQr}
          onClose={() => {
            setShowQr(false);
            setSelectedAssetForQr(null);
          }}
          asset={selectedAssetForQr}
        />
      )}

      {showAssign && selectedAssetForAssign && (
        <AssetAssignmentDialog
          visible={showAssign}
          onClose={() => {
            setShowAssign(false);
            setSelectedAssetForAssign(null);
          }}
          asset={selectedAssetForAssign}
          users={users}
          locations={locations}
          onSuccess={() => {
            fetchAssets();
            fetchLookups();
          }}
        />
      )}

      {showTransfer && selectedAssetForTransfer && (
        <AssetTransferDialog
          visible={showTransfer}
          onClose={() => {
            setShowTransfer(false);
            setSelectedAssetForTransfer(null);
          }}
          asset={selectedAssetForTransfer}
          users={users}
          locations={locations}
          onSuccess={() => {
            fetchAssets();
            fetchLookups();
          }}
        />
      )}

      {showDisposal && selectedAssetForDisposal && (
        <AssetDisposalDialog
          visible={showDisposal}
          onClose={() => {
            setShowDisposal(false);
            setSelectedAssetForDisposal(null);
          }}
          asset={selectedAssetForDisposal}
          onSuccess={() => {
            fetchAssets();
            fetchLookups();
          }}
        />
      )}

      {showCatLoc && (
        <CategoriesLocationsDialog
          visible={showCatLoc}
          onClose={() => setShowCatLoc(false)}
          categories={categories}
          locations={locations}
          onRefresh={fetchLookups}
        />
      )}
      </View>
    </ScrollView>
  );
}
