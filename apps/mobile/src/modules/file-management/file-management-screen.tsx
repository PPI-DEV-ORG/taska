import * as React from "react";
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/akuntra/basics";
import { colors } from "@/tokens";
import { api, apiBase } from "@/services/api";
import { useApp } from "@/store/app-store";
import {
  HardDrive,
  Cloud,
  ArrowRightLeft,
  Search,
  Plus,
  RefreshCw,
  Folder,
  FolderOpen,
  ArrowLeft,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Server,
  Layers,
  CalendarClock,
  Clock,
  ShieldCheck,
  ChevronRight,
  Filter,
  Eye,
} from "lucide-react-native";
import {
  FileKindBadge,
  FileStatusBadge,
  FileTabs,
  MetricCard,
  ProviderTypeBadge,
  formatBytes,
} from "./file-ui";
import { ProviderFormDialog } from "./provider-form-dialog";
import { ProviderBrowseDialog } from "./provider-browse-dialog";
import { MigrationDialog } from "./migration-dialog";
import { ScheduleDialog } from "./schedule-dialog";
import { FileDetailModal } from "./file-detail-modal";
import { DriveExplorer } from "@/modules/drive/drive-explorer";
import type {
  FileItem,
  FileOverview,
  MigrationJob,
  MigrationSchedule,
  ServerStorage,
  StorageProviderItem,
} from "./types";

export function FileManagementScreen() {
  const { toast, user } = useApp();

  const [activeTab, setActiveTab] = React.useState<
    "overview" | "drive" | "files" | "orphans" | "providers" | "migration"
  >("overview");

  // State data
  const [overview, setOverview] = React.useState<FileOverview | null>(null);
  const [serverStorage, setServerStorage] = React.useState<ServerStorage | null>(null);
  const [files, setFiles] = React.useState<FileItem[]>([]);
  const [providers, setProviders] = React.useState<StorageProviderItem[]>([]);
  const [migrationJobs, setMigrationJobs] = React.useState<MigrationJob[]>([]);
  const [schedules, setSchedules] = React.useState<MigrationSchedule[]>([]);

  // Search & filters
  const [search, setSearch] = React.useState("");
  const [currentFolder, setCurrentFolder] = React.useState<string | null>(null);
  const [flatListView, setFlatListView] = React.useState<boolean>(false);
  const [selectedProviderId, setSelectedProviderId] = React.useState<number | undefined>();
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<number | undefined>();
  const [page, setPage] = React.useState(1);
  const [limit] = React.useState(25);
  const [totalFiles, setTotalFiles] = React.useState(0);

  // Loading & refresh states
  const [loading, setLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Dialogs
  const [providerFormOpen, setProviderFormOpen] = React.useState(false);
  const [providerToEdit, setProviderToEdit] = React.useState<StorageProviderItem | null>(null);

  const [browseOpen, setBrowseOpen] = React.useState(false);
  const [providerToBrowse, setProviderToBrowse] = React.useState<StorageProviderItem | null>(null);

  const [migrationOpen, setMigrationOpen] = React.useState(false);
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [scheduleToEdit, setScheduleToEdit] = React.useState<MigrationSchedule | null>(null);

  const [selectedFileId, setSelectedFileId] = React.useState<number | null>(null);
  const [detailModalOpen, setDetailModalOpen] = React.useState(false);

  // Selection for bulk orphan deletion
  const [selectedOrphanIds, setSelectedOrphanIds] = React.useState<number[]>([]);
  const [deletingOrphans, setDeletingOrphans] = React.useState(false);

  const loadData = React.useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setLoadError(null);
      try {
        const results = await Promise.allSettled([
          api.get<FileOverview>("/file-management/overview"),
          api.get<ServerStorage>("/file-management/server-storage"),
          api.get<StorageProviderItem[]>("/file-management/providers"),
          api.get<MigrationSchedule[]>("/file-management/schedules"),
          api.get<MigrationJob[]>("/file-management/migrations?limit=15"),
        ]);

        const [ovRes, srvRes, provsRes, schedsRes, jobsRes] = results;

        if (ovRes.status === "fulfilled") setOverview(ovRes.value);
        if (srvRes.status === "fulfilled") setServerStorage(srvRes.value);
        if (provsRes.status === "fulfilled") setProviders(Array.isArray(provsRes.value) ? provsRes.value : []);
        if (schedsRes.status === "fulfilled") setSchedules(Array.isArray(schedsRes.value) ? schedsRes.value : []);
        if (jobsRes.status === "fulfilled") setMigrationJobs(Array.isArray(jobsRes.value) ? jobsRes.value : []);

        const allFailed = results.every((r) => r.status === "rejected");
        if (allFailed) {
          const firstErr = (results[0] as PromiseRejectedResult).reason;
          const msg = (firstErr as Error)?.message || "Gagal memuat data file manajemen. Periksa koneksi internet.";
          setLoadError(msg);
          toast(msg, "danger");
        }
      } catch (e) {
        const msg = (e as Error).message || "Gagal memuat data.";
        setLoadError(msg);
        toast(msg, "danger");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [toast],
  );

  const loadFiles = React.useCallback(
    async (folderTarget: string | null = currentFolder, isOrphanOnly: boolean = activeTab === "orphans") => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search) params.append("search", search);
        if (folderTarget && folderTarget !== "all") params.append("folder", folderTarget);
        if (selectedProviderId) params.append("providerId", String(selectedProviderId));
        if (selectedCategoryId) params.append("categoryId", String(selectedCategoryId));
        if (isOrphanOnly) params.append("isOrphan", "true");
        params.append("page", String(page));
        params.append("limit", String(limit));

        const res = await api.get<{ items: FileItem[]; total: number }>(
          `/file-management/files?${params.toString()}`,
        );
        setFiles(res.items || []);
        setTotalFiles(res.total || 0);
      } catch (e) {
        toast((e as Error).message, "danger");
      } finally {
        setLoading(false);
      }
    },
    [currentFolder, activeTab, search, selectedProviderId, selectedCategoryId, page, limit, toast],
  );

  const handleFullRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([
        loadData(true),
        activeTab === "files" || activeTab === "orphans"
          ? loadFiles(currentFolder, activeTab === "orphans")
          : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [loadData, loadFiles, currentFolder, activeTab]);

  const handleOpenFolder = (folderKey: string) => {
    setCurrentFolder(folderKey);
    setFlatListView(false);
    setPage(1);
  };

  const handleBackToFolders = () => {
    setCurrentFolder(null);
    setFlatListView(false);
    setSearch("");
    setPage(1);
    setFiles([]);
  };

  const handleQuickPreview = (fileItem: FileItem) => {
    const url = `${apiBase()}/files/${fileItem.id}`;
    if (typeof window !== "undefined") {
      window.open(url, "_blank");
    } else {
      Linking.openURL(url).catch(() => {});
    }
  };

  const handleTabChange = (tab: "overview" | "drive" | "files" | "orphans" | "providers" | "migration") => {
    setActiveTab(tab);
    setCurrentFolder(null);
    setFlatListView(false);
    setSearch("");
    setPage(1);
    setFiles([]);
  };

  React.useEffect(() => {
    void Promise.resolve().then(() => loadData());
  }, [loadData]);

  React.useEffect(() => {
    if (activeTab === "files" || activeTab === "orphans") {
      if (currentFolder || flatListView || search.trim()) {
        void Promise.resolve().then(() => loadFiles(currentFolder, activeTab === "orphans"));
      }
    }
  }, [currentFolder, flatListView, search, page, activeTab, loadFiles]);

  const handleBulkDeleteOrphans = async () => {
    if (selectedOrphanIds.length === 0) return;
    if (!confirm(`Hapus ${selectedOrphanIds.length} berkas lepas terpilih secara permanen?`)) return;

    setDeletingOrphans(true);
    try {
      await api.post("/file-management/files/bulk-delete-orphans", { fileIds: selectedOrphanIds });
      toast(`Berhasil menghapus ${selectedOrphanIds.length} berkas lepas.`, "success");
      setSelectedOrphanIds([]);
      loadFiles(currentFolder, true);
      loadData();
    } catch (e) {
      toast((e as Error).message, "danger");
    } finally {
      setDeletingOrphans(false);
    }
  };

  const handleCleanupLocal = async (jobId: number) => {
    if (
      !confirm(
        "Sistem akan memverifikasi ulang bahwa seluruh berkas benar-benar ada di penyimpanan target sebelum menghapus berkas lokal. Lanjutkan pembersihan?",
      )
    ) {
      return;
    }
    try {
      const res = await api.post<any>(`/file-management/migrations/${jobId}/cleanup`, {});
      toast(res.message || "Pembersihan berkas lokal selesai.", "success");
      loadData();
    } catch (e) {
      toast((e as Error).message, "danger");
    }
  };

  const handleRollback = async (jobId: number) => {
    if (
      !confirm(
        "Kembalikan lokasi primer berkas ke penyimpanan sumber semula dan hapus berkas di target?",
      )
    ) {
      return;
    }
    try {
      const res = await api.post<any>(`/file-management/migrations/${jobId}/rollback`, {});
      toast(res.message || "Rollback berhasil.", "success");
      loadData();
    } catch (e) {
      toast((e as Error).message, "danger");
    }
  };

  const handleSetDefaultProvider = async (id: number) => {
    try {
      await api.post(`/file-management/providers/${id}/set-default`, {});
      toast("Penyimpanan default berhasil diubah.", "success");
      loadData();
    } catch (e) {
      toast((e as Error).message, "danger");
    }
  };

  const handleDeleteProvider = async (id: number) => {
    if (!confirm("Hapus konfigurasi penyimpanan ini?")) return;
    try {
      await api.delete(`/file-management/providers/${id}`);
      toast("Penyimpanan berhasil dihapus.", "success");
      loadData();
    } catch (e) {
      toast((e as Error).message, "danger");
    }
  };

  const TABS = [
    { value: "overview", label: "Ringkasan" },
    { value: "drive", label: "Dokumen Umum" },
    { value: "files", label: "Berkas ERP", count: overview?.totalFiles },
    { value: "orphans", label: "Berkas Lepas", count: overview?.orphanFiles },
    { value: "providers", label: "Penyimpanan Eksternal", count: providers.length },
    { value: "migration", label: "Migrasi & Jadwal", count: migrationJobs.length },
  ];

  return (
    <ScrollView
      className="flex-1 bg-background"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void handleFullRefresh()}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
    >
      <View className="mx-auto w-full max-w-7xl p-4 md:p-6 gap-5">
        {/* Header Modul */}
        <PageHeader
          title="Manajemen File (Core Storage)"
          subtitle="Pusat pengelolaan dokumen ERP, storage provider (S3 / NAS), dan migrasi berkas aman"
          onRefresh={handleFullRefresh}
          action={
            <>
              <Button
                variant="outline"
                size="sm"
                onPress={() => {
                  setProviderToEdit(null);
                  setProviderFormOpen(true);
                }}
                className="h-9 gap-1.5"
              >
                <Plus size={14} color={colors.primary} />
                <Text className="text-xs font-semibold">Sambungkan Storage</Text>
              </Button>
              <Button
                size="sm"
                onPress={() => setMigrationOpen(true)}
                className="h-9 gap-1.5"
                style={{ backgroundColor: colors.primary }}
              >
                <ArrowRightLeft size={14} color="#FFF" />
                <Text className="text-xs font-semibold text-white">Migrasi Berkas</Text>
              </Button>
            </>
          }
        />

        {/* Tab Navigasi */}
        <FileTabs
          tabs={TABS}
          value={activeTab}
          onChange={(tab) => {
            handleTabChange(tab as any);
          }}
        />

        {/* State Loading Awal saat membuka halaman */}
        {loading && !overview ? (
          <View className="items-center justify-center py-20 bg-card rounded-2xl border border-border space-y-2">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="mt-2 text-sm font-semibold text-foreground">
              Menghubungkan ke Server Storage...
            </Text>
            <Text className="text-xs text-muted-foreground text-center max-w-xs">
              Memuat ringkasan berkas, kapasitas penyimpanan, dan status provider
            </Text>
          </View>
        ) : loadError && !overview ? (
          <View className="items-center justify-center py-16 px-4 bg-destructive/5 rounded-2xl border border-destructive/20 text-center space-y-3">
            <AlertTriangle size={32} color="#EF4444" />
            <Text className="text-base font-bold text-foreground">
              Koneksi Lambat / Gagal Memuat Data
            </Text>
            <Text className="text-xs text-muted-foreground max-w-md text-center">
              {loadError}. Server mungkin sedang sibuk atau koneksi internet tidak stabil.
            </Text>
            <Button
              onPress={() => void handleFullRefresh()}
              className="gap-2 mt-2"
              style={{ backgroundColor: colors.primary }}
            >
              <RefreshCw size={14} color="#FFF" />
              <Text className="text-xs font-semibold text-white">Coba Muat Ulang</Text>
            </Button>
          </View>
        ) : null}

        {/* TAB 0: DOKUMEN UMUM (Company Shared Drive - Manager Mode) */}
        {activeTab === "drive" ? (
          <View className="gap-3">
            <View className="rounded-xl border border-primary/25 bg-primary/5 px-3.5 py-2.5 flex-row items-center gap-2">
              <ShieldCheck size={16} color={colors.primary} />
              <Text className="text-xs text-foreground flex-1">
                Ruang penyimpanan <Text className="font-bold">Dokumen Umum (Company Shared Drive)</Text> terpisah sepenuhnya dari berkas transaksi modul ERP (Invoice, PO, SO, DO, dll).
              </Text>
            </View>
            <DriveExplorer mode="manager" />
          </View>
        ) : null}

        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (overview || !loading) ? (
          <View className="gap-5">
            {/* KPI Cards */}
            <View className="flex-row flex-wrap gap-3">
              <MetricCard
                label="Total Dokumen"
                value={overview?.totalFiles ?? 0}
                hint={`${formatBytes(overview?.totalBytes)} total ukuran`}
                color={colors.primary}
                icon={HardDrive}
              />
              <MetricCard
                label="Penyimpanan Terhubung"
                value={providers.length}
                hint={`${providers.filter((p) => p.status === "ACTIVE").length} aktif, 1 default`}
                color="#8B5CF6"
                icon={Cloud}
              />
              <MetricCard
                label="Berkas Lepas"
                value={overview?.orphanFiles ?? 0}
                hint={`${formatBytes(overview?.orphanBytes)} mandiri / tanpa relasi data`}
                color="#F59E0B"
                icon={AlertTriangle}
              />
              <MetricCard
                label="Jadwal Otomatis"
                value={schedules.filter((s) => s.enabled).length}
                hint={`${schedules.length} total aturan migrasi`}
                color="#10B981"
                icon={CalendarClock}
              />
            </View>

            {/* Widget Kapasitas Server / Komputer Host */}
            {serverStorage ? (
              <View className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm gap-3">
                <View className="flex-row items-center justify-between gap-2">
                  <View className="flex-1 min-w-0 flex-row items-center gap-2">
                    <Server size={18} color={colors.primary} />
                    <Text className="flex-1 text-sm font-bold text-foreground" numberOfLines={1}>
                      Kapasitas Server Akuntra
                    </Text>
                  </View>
                  <Text className="shrink-0 text-xs font-mono text-muted-foreground">
                    {serverStorage.diskUsedPercent}% Digunakan
                  </Text>
                </View>

                {/* Progress bar */}
                <View className="h-3 w-full rounded-full bg-muted/60 overflow-hidden">
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, Math.max(0, serverStorage.diskUsedPercent))}%`,
                      backgroundColor:
                        serverStorage.diskUsedPercent > 85 ? "#EF4444" : colors.primary,
                    }}
                  />
                </View>

                <View className="flex-row flex-wrap justify-between gap-x-4 gap-y-1.5 pt-1">
                  <Text className="text-xs text-muted-foreground">
                    Terpakai: <Text className="font-semibold text-foreground">{formatBytes(serverStorage.diskUsed)}</Text>
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Tersedia: <Text className="font-semibold text-foreground">{formatBytes(serverStorage.diskFree)}</Text>
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Total Disk: <Text className="font-semibold text-foreground">{formatBytes(serverStorage.diskTotal)}</Text>
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Folder Uploads: <Text className="font-semibold text-foreground">{formatBytes(serverStorage.uploadsSizeBytes)}</Text>
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Distribusi Berkas Berdasarkan Sub-Folder Modul */}
            {overview?.subfolders && overview.subfolders.length > 0 ? (
              <View className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm gap-4">
                <View className="flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <View className="flex-1 min-w-0">
                    <Text className="text-sm font-bold text-foreground">
                      Distribusi Berkas per Modul (Sub-Folder Server)
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      Berkas fisik yang tersimpan di direktori upload server berdasarkan modul bisnis
                    </Text>
                  </View>
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={() => {
                      handleBackToFolders();
                      setFlatListView(true);
                      setActiveTab("files");
                    }}
                    className="self-start sm:self-auto"
                  >
                    <Text className="text-xs font-semibold text-primary">Lihat Semua</Text>
                  </Button>
                </View>

                <View className="flex-row flex-wrap gap-3">
                  {overview.subfolders.map((sf) => (
                    <Pressable
                      key={sf.folder}
                      onPress={() => {
                        handleOpenFolder(sf.folder);
                        setActiveTab("files");
                      }}
                      className="min-w-[140px] flex-1 overflow-hidden rounded-xl border border-border/80 bg-muted/10 p-3.5 gap-1.5 hover:border-primary/50"
                    >
                      <View className="flex-row items-center justify-between gap-1.5">
                        <View className="flex-1 min-w-0 flex-row items-center gap-1.5">
                          <View
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: sf.color || "#64748B" }}
                          />
                          <Text className="flex-1 text-xs font-bold text-foreground" numberOfLines={1}>
                            {sf.label}
                          </Text>
                        </View>
                        <ChevronRight size={12} color={colors.muted} />
                      </View>
                      <View className="flex-row items-baseline justify-between pt-1">
                        <Text className="text-base font-black text-foreground">
                          {sf.count} <Text className="text-[10px] font-normal text-muted-foreground">berkas</Text>
                        </Text>
                        <Text className="text-[11px] font-mono text-muted-foreground">
                          {formatBytes(sf.totalBytes)}
                        </Text>
                      </View>
                      <Text className="text-[10px] font-mono text-muted-foreground/70">
                        uploads/{sf.folder}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Daftar Provider & Status */}
            <View className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm gap-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-bold text-foreground">Kondisi Penyimpanan (Storage Providers)</Text>
              </View>

              <View className="gap-3 md:grid md:grid-cols-2">
                {providers.map((p) => (
                  <View
                    key={p.id}
                    className="rounded-xl border border-border/80 bg-muted/10 p-4 space-y-2.5"
                  >
                    <View className="flex-row items-start justify-between">
                      <View className="gap-1">
                        <View className="flex-row items-center gap-2">
                          <Text className="text-sm font-bold text-foreground">{p.name}</Text>
                          {p.isDefault ? (
                            <View className="rounded bg-primary/10 px-1.5 py-0.5" style={{ backgroundColor: `${colors.primary}1A` }}>
                              <Text className="text-[9px] font-bold" style={{ color: colors.primary }}>
                                DEFAULT
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <ProviderTypeBadge type={p.type} />
                      </View>

                      {p.health ? (
                        <View
                          className="flex-row items-center gap-1 rounded-full px-2 py-0.5 border"
                          style={{
                            backgroundColor: p.health.ok ? "#10B98114" : "#EF444414",
                            borderColor: p.health.ok ? "#10B98133" : "#EF444433",
                          }}
                        >
                          <View
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: p.health.ok ? "#10B981" : "#EF4444" }}
                          />
                          <Text
                            className="text-[10px] font-bold"
                            style={{ color: p.health.ok ? "#065F46" : "#991B1B" }}
                          >
                            {p.health.ok ? `${p.health.latencyMs}ms` : "Error"}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View className="flex-row items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
                      <Text className="text-[11px] text-muted-foreground">
                        {p.fileCount || 0} berkas aktif
                      </Text>
                      {p.health?.capacity?.total ? (
                        <Text className="text-[11px] font-mono text-muted-foreground">
                          {formatBytes(p.health.capacity.free)} bebas dari {formatBytes(p.health.capacity.total)}
                        </Text>
                      ) : (
                        <Text className="text-[11px] text-muted-foreground">{p.status}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : null}

        {/* TAB 2: SEMUA BERKAS & TAB 3: BERKAS LEPAS */}
        {activeTab === "files" || activeTab === "orphans" ? (
          <View className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm gap-4">
            {/* Tampilan 1: GRID FOLDER (Default ketika tidak sedang membuka isi folder) */}
            {!currentFolder && !flatListView && !search.trim() ? (
              <View className="gap-4">
                {/* Search Bar & Aksi Global */}
                <View className="flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <View className="w-full sm:flex-1 min-w-0 h-11 flex-row items-center gap-2 rounded-xl border border-border bg-background px-3">
                    <Search size={16} color={colors.muted} />
                    <Input
                      placeholder="Cari berkas secara global (nama, kode, deskripsi)..."
                      value={search}
                      onChangeText={setSearch}
                      className="h-9 flex-1 border-0 bg-transparent px-0 text-xs shadow-none"
                    />
                  </View>

                  <View className="flex-row flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={() => {
                        setFlatListView(true);
                        setPage(1);
                      }}
                      className="h-9 gap-1.5"
                    >
                      <Layers size={13} color={colors.primary} />
                      <Text className="text-xs font-semibold">Tampilkan Semua (List)</Text>
                    </Button>

                    {activeTab === "orphans" && selectedOrphanIds.length > 0 ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        onPress={handleBulkDeleteOrphans}
                        disabled={deletingOrphans}
                        className="h-9 gap-1"
                      >
                        <Trash2 size={12} />
                        <Text className="text-xs font-semibold text-white">
                          Hapus {selectedOrphanIds.length} Berkas
                        </Text>
                      </Button>
                    ) : null}
                  </View>
                </View>

                {/* Banner Khusus Tab Berkas Lepas */}
                {activeTab === "orphans" ? (
                  <View className="flex-row items-start gap-2.5 rounded-xl bg-amber-500/10 p-3.5 border border-amber-500/20">
                    <AlertTriangle size={18} color="#D97706" />
                    <View className="flex-1 min-w-0 gap-0.5">
                      <Text className="text-xs font-bold text-amber-800">Daftar Berkas Lepas (Standalone Files)</Text>
                      <Text className="text-[11px] text-amber-700">
                        Pilih folder modul di bawah untuk memeriksa berkas mandiri yang tidak terhubung ke data transaksi ERP.
                      </Text>
                    </View>
                  </View>
                ) : null}

                {/* Header Bagian Folder Grid */}
                <View className="flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1">
                  <View className="flex-1 min-w-0">
                    <Text className="text-sm font-bold text-foreground">
                      {activeTab === "orphans" ? "Direktori Berkas Lepas per Modul" : "Direktori Berkas per Modul ERP"}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      Klik salah satu folder di bawah untuk membuka dan mengelola berkas di dalamnya
                    </Text>
                  </View>
                </View>

                {/* Grid Folder */}
                {loading && !overview ? (
                  <View className="items-center justify-center py-16">
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text className="mt-2 text-xs text-muted-foreground">Memuat folder modul...</Text>
                  </View>
                ) : overview?.subfolders && overview.subfolders.length > 0 ? (
                  <View className="gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:gap-4">
                    {overview.subfolders.map((sf) => (
                      <Pressable
                        key={sf.folder}
                        onPress={() => handleOpenFolder(sf.folder)}
                        className="rounded-2xl border border-border/80 bg-background/60 p-4 gap-3 web:hover:border-primary web:hover:shadow-md web:transition-all web:cursor-pointer"
                      >
                        <View className="flex-row items-start justify-between">
                          <View
                            className="h-12 w-12 rounded-2xl items-center justify-center border"
                            style={{
                              backgroundColor: `${sf.color || colors.primary}18`,
                              borderColor: `${sf.color || colors.primary}33`,
                            }}
                          >
                            <Folder size={24} color={sf.color || colors.primary} />
                          </View>
                          <View
                            className="rounded-full px-2.5 py-0.5 border"
                            style={{
                              backgroundColor: `${sf.color || "#64748B"}12`,
                              borderColor: `${sf.color || "#64748B"}2A`,
                            }}
                          >
                            <Text
                              className="text-xs font-bold"
                              style={{ color: sf.color || "#64748B" }}
                            >
                              {sf.count} berkas
                            </Text>
                          </View>
                        </View>

                        <View className="space-y-1">
                          <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
                            {sf.label}
                          </Text>
                          <Text className="text-xs text-muted-foreground line-clamp-2" numberOfLines={2}>
                            {sf.description || `Folder penyimpanan modul ${sf.folder}`}
                          </Text>
                        </View>

                        <View className="flex-row items-center justify-between pt-2.5 border-t border-border/60">
                          <Text className="text-[11px] font-mono font-semibold text-muted-foreground">
                            {formatBytes(sf.totalBytes)}
                          </Text>
                          <View className="flex-row items-center gap-1">
                            <Text className="text-xs font-semibold" style={{ color: colors.primary }}>
                              Buka Folder
                            </Text>
                            <ChevronRight size={13} color={colors.primary} />
                          </View>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <View className="items-center justify-center py-16 text-center">
                    <Folder size={40} className="text-muted-foreground/30 mb-2" />
                    <Text className="text-sm font-semibold text-foreground">Tidak Ada Folder</Text>
                    <Text className="text-xs text-muted-foreground mt-1">
                      Belum ada sub-folder terdeteksi di dalam direktori uploads.
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              /* Tampilan 2: DAFTAR BERKAS DI DALAM FOLDER / HASIL CARI */
              <View className="gap-4">
                {/* Header Breadcrumb Navigasi */}
                <View className="flex-row flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/60">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={handleBackToFolders}
                      className="gap-1.5"
                    >
                      <ArrowLeft size={14} color={colors.primary} />
                      <Text className="text-xs font-semibold">Semua Folder</Text>
                    </Button>
                    <Text className="text-muted-foreground font-semibold">/</Text>
                    <View className="flex-row items-center gap-1.5">
                      <FolderOpen size={16} color={colors.primary} />
                      <Text className="text-sm font-bold text-foreground">
                        {currentFolder
                          ? overview?.subfolders?.find((s) => s.folder === currentFolder)?.label || currentFolder
                          : flatListView
                          ? "Semua Berkas (Daftar Penuh)"
                          : `Pencarian: "${search}"`}
                      </Text>
                      <View
                        className="rounded-full px-2 py-0.5 border"
                        style={{ backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}33` }}
                      >
                        <Text className="text-xs font-bold" style={{ color: colors.primary }}>
                          {totalFiles} berkas
                        </Text>
                      </View>
                    </View>
                  </View>

                  {activeTab === "orphans" && selectedOrphanIds.length > 0 ? (
                    <View className="flex-row items-center gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onPress={handleBulkDeleteOrphans}
                        disabled={deletingOrphans}
                        className="gap-1"
                      >
                        <Trash2 size={12} />
                        <Text className="text-xs font-semibold text-white">
                          Hapus {selectedOrphanIds.length} Berkas
                        </Text>
                      </Button>
                    </View>
                  ) : null}
                </View>

                {/* Search Bar di Dalam Folder */}
                <View className="h-11 flex-row items-center gap-2 rounded-xl border border-border bg-background px-3">
                  <Search size={16} color={colors.muted} />
                  <Input
                    placeholder={
                      currentFolder
                        ? `Cari berkas di dalam folder ${currentFolder}...`
                        : "Cari nama berkas, nomor kode, atau deskripsi..."
                    }
                    value={search}
                    onChangeText={setSearch}
                    className="h-9 flex-1 border-0 bg-transparent px-0 text-xs shadow-none"
                  />
                </View>

                {/* Tabel Berkas */}
                {loading ? (
                  <View className="items-center justify-center py-16">
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text className="mt-2 text-xs text-muted-foreground">Memuat data berkas...</Text>
                  </View>
                ) : files.length === 0 ? (
                  <View className="items-center justify-center py-16 text-center">
                    <HardDrive size={36} className="text-muted-foreground/40 mb-2" />
                    <Text className="text-sm font-semibold text-foreground">Tidak Ada Berkas Ditemukan</Text>
                    <Text className="text-xs text-muted-foreground mt-1">
                      {activeTab === "orphans"
                        ? "Bagus! Tidak ada berkas lepas di dalam folder ini."
                        : "Belum ada berkas yang cocok dengan filter atau kata kunci pencarian."}
                    </Text>
                  </View>
                ) : (
                  <View className="divide-y divide-border/60">
                    {files.map((item) => {
                      const isChecked = selectedOrphanIds.includes(item.id);
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => {
                            setSelectedFileId(item.id);
                            setDetailModalOpen(true);
                          }}
                          className="flex-row items-center justify-between p-3.5 rounded-xl hover:bg-muted/30 gap-3"
                        >
                          {activeTab === "orphans" ? (
                            <Pressable
                              onPress={() => {
                                setSelectedOrphanIds((prev) =>
                                  isChecked ? prev.filter((id) => id !== item.id) : [...prev, item.id],
                                );
                              }}
                              className="p-1"
                            >
                              <View
                                className="h-4 w-4 rounded border items-center justify-center"
                                style={{
                                  backgroundColor: isChecked ? colors.primary : "transparent",
                                  borderColor: isChecked ? colors.primary : "#94A3B8",
                                }}
                              >
                                {isChecked ? <CheckCircle2 size={12} color="#FFF" /> : null}
                              </View>
                            </Pressable>
                          ) : null}

                          <View className="flex-1 min-w-0 space-y-1">
                            <View className="flex-row flex-wrap items-center gap-2">
                              <FileKindBadge kind={item.kind} extension={item.extension} />
                              <Text className="text-xs font-bold text-foreground" numberOfLines={1}>
                                {item.displayName}
                              </Text>
                              <Text className="text-[10px] font-mono text-muted-foreground">
                                {item.fileCode}
                              </Text>
                              <View
                                className="rounded px-1.5 py-0.5 border"
                                style={{
                                  backgroundColor: `${item.subfolderColor || "#64748B"}14`,
                                  borderColor: `${item.subfolderColor || "#64748B"}33`,
                                }}
                              >
                                <Text
                                  className="text-[9px] font-semibold"
                                  style={{ color: item.subfolderColor || "#64748B" }}
                                >
                                  📁 {item.subfolderLabel || item.subfolder || "dokumen"}
                                </Text>
                              </View>
                            </View>

                            {/* Relasi Dokumen */}
                            <View className="flex-row flex-wrap items-center gap-1.5 pt-0.5">
                              {item.usedBy && item.usedBy.length > 0 ? (
                                item.usedBy.slice(0, 3).map((doc, dIdx) => (
                                  <View
                                    key={dIdx}
                                    className="rounded bg-muted/60 px-1.5 py-0.5 border border-border/40"
                                  >
                                    <Text className="text-[10px] text-foreground font-medium">
                                      {doc.label}
                                    </Text>
                                  </View>
                                ))
                              ) : (
                                <View className="rounded bg-amber-500/10 px-1.5 py-0.5 border border-amber-500/20">
                                  <Text className="text-[10px] text-amber-700 font-semibold">
                                    Berkas Lepas (Tanpa Dokumen)
                                  </Text>
                                </View>
                              )}
                              {item.usedBy && item.usedBy.length > 3 ? (
                                <Text className="text-[10px] text-muted-foreground">
                                  +{item.usedBy.length - 3} lainnya
                                </Text>
                              ) : null}
                            </View>
                          </View>

                          {/* Info Ukuran & Provider */}
                          <View className="items-end gap-1">
                            <Text className="text-xs font-bold font-mono text-foreground">
                              {formatBytes(item.size)}
                            </Text>
                            <ProviderTypeBadge type={item.provider?.type || "LOCAL"} />
                          </View>

                          <View className="flex-row items-center gap-1">
                            <Pressable
                              onPress={(e: any) => {
                                e?.stopPropagation?.();
                                handleQuickPreview(item);
                              }}
                              className="rounded-lg p-1.5 hover:bg-primary/10 border border-transparent hover:border-primary/20"
                            >
                              <Eye size={15} color={colors.primary} />
                            </Pressable>
                            <ChevronRight size={14} className="text-muted-foreground" />
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {/* Pagination Controls */}
                {totalFiles > 0 ? (
                  <View className="flex-row flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/60">
                    <Text className="text-xs text-muted-foreground">
                      Menampilkan <Text className="font-semibold text-foreground">{(page - 1) * limit + 1}</Text> -{" "}
                      <Text className="font-semibold text-foreground">{Math.min(page * limit, totalFiles)}</Text> dari{" "}
                      <Text className="font-semibold text-foreground">{totalFiles}</Text> berkas
                    </Text>

                    <View className="flex-row items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onPress={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        <Text className="text-xs">Sebelumnya</Text>
                      </Button>
                      <Text className="text-xs font-semibold text-foreground px-1">
                        Hal {page} / {Math.ceil(totalFiles / limit) || 1}
                      </Text>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= Math.ceil(totalFiles / limit)}
                        onPress={() => setPage((p) => p + 1)}
                      >
                        <Text className="text-xs">Selanjutnya</Text>
                      </Button>
                    </View>
                  </View>
                ) : null}
              </View>
            )}
          </View>
        ) : null}

        {/* TAB 4: PENYIMPANAN EKSTERNAL */}
        {activeTab === "providers" ? (
          <View className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
            <View className="flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <View className="flex-1 min-w-0">
                <Text className="text-sm font-bold text-foreground">Daftar Penyimpanan Terdaftar</Text>
                <Text className="text-xs text-muted-foreground">
                  Kelola koneksi MinIO, S3, NAS Mount, dan WebDAV kantor Anda
                </Text>
              </View>
              <Button
                size="sm"
                onPress={() => {
                  setProviderToEdit(null);
                  setProviderFormOpen(true);
                }}
                className="gap-1.5 self-start sm:self-auto"
                style={{ backgroundColor: colors.primary }}
              >
                <Plus size={14} color="#FFF" />
                <Text className="text-xs font-semibold text-white">Tambah Penyimpanan</Text>
              </Button>
            </View>

            <View className="divide-y divide-border/60">
              {providers.map((item) => (
                <View key={item.id} className="py-4 space-y-3">
                  <View className="flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <View className="flex-1 min-w-0 gap-1">
                      <View className="flex-row flex-wrap items-center gap-2">
                        <Text className="text-sm font-bold text-foreground">{item.name}</Text>
                        <ProviderTypeBadge type={item.type} isDefault={item.isDefault} />
                      </View>
                      <View className="w-full min-w-0 overflow-hidden">
                        <Text
                          className="text-xs font-mono text-muted-foreground break-all"
                          numberOfLines={2}
                          ellipsizeMode="middle"
                        >
                          {item.type === "S3"
                            ? `Bucket: ${item.config?.bucket || "-"} • Endpoint: ${item.config?.endpoint || "AWS S3"}`
                            : item.type === "NAS_MOUNT"
                            ? `Mount: ${item.config?.mountPath || "-"}`
                            : item.type === "WEBDAV"
                            ? `URL: ${item.config?.url || "-"}`
                            : "Filesystem Lokal Server"}
                        </Text>
                      </View>
                    </View>

                    {/* Status Health */}
                    {item.health ? (
                      <View
                        className="self-start sm:self-auto flex-row items-center gap-1.5 rounded-full px-2.5 py-1 border shrink-0"
                        style={{
                          backgroundColor: item.health.ok ? "#10B98114" : "#EF444414",
                          borderColor: item.health.ok ? "#10B98133" : "#EF444433",
                        }}
                      >
                        <View
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: item.health.ok ? "#10B981" : "#EF4444" }}
                        />
                        <Text
                          className="text-xs font-semibold"
                          style={{ color: item.health.ok ? "#065F46" : "#991B1B" }}
                        >
                          {item.health.ok ? `Online (${item.health.latencyMs}ms)` : "Offline"}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Actions Bar */}
                  <View className="flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border/40">
                    <Text className="text-xs text-muted-foreground">
                      Menyimpan: <Text className="font-semibold text-foreground">{item.fileCount || 0}</Text> berkas
                    </Text>

                    <View className="flex-row flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onPress={() => {
                          setProviderToBrowse(item);
                          setBrowseOpen(true);
                        }}
                        className="gap-1"
                      >
                        <FolderOpen size={13} />
                        <Text className="text-xs">Jelajah Isi</Text>
                      </Button>

                      {!item.isDefault ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onPress={() => handleSetDefaultProvider(item.id)}
                        >
                          <Text className="text-xs">Jadikan Default</Text>
                        </Button>
                      ) : null}

                      {item.type !== "LOCAL" ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onPress={() => {
                              setProviderToEdit(item);
                              setProviderFormOpen(true);
                            }}
                          >
                            <Text className="text-xs">Edit</Text>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onPress={() => handleDeleteProvider(item.id)}
                            className="text-rose-600"
                          >
                            <Trash2 size={13} color="#EF4444" />
                          </Button>
                        </>
                      ) : null}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* TAB 5: MIGRASI & JADWAL */}
        {activeTab === "migration" ? (
          <View className="space-y-6">
            {/* Header Migrasi */}
            <View className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
              <View className="flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <View className="flex-1 min-w-0">
                  <Text className="text-sm font-bold text-foreground">Jadwal Migrasi Otomatis</Text>
                  <Text className="text-xs text-muted-foreground">
                    Aturan periodik untuk memindahkan berkas secara rutin (misal setiap 3 hari atau 1 minggu)
                  </Text>
                </View>
                <Button
                  size="sm"
                  onPress={() => {
                    setScheduleToEdit(null);
                    setScheduleOpen(true);
                  }}
                  className="gap-1.5 self-start sm:self-auto"
                  style={{ backgroundColor: colors.primary }}
                >
                  <Plus size={14} color="#FFF" />
                  <Text className="text-xs font-semibold text-white">Tambah Jadwal</Text>
                </Button>
              </View>

              {schedules.length === 0 ? (
                <View className="items-center justify-center py-8 text-center bg-muted/10 rounded-xl border border-dashed border-border">
                  <CalendarClock size={28} className="text-muted-foreground/40 mb-1.5" />
                  <Text className="text-xs font-semibold text-foreground">Belum Ada Jadwal Otomatis</Text>
                  <Text className="text-[11px] text-muted-foreground">
                    Sesuai instruksi, tidak ada jadwal otomatis default. Anda bebas menentukan interval migrasi kapan saja.
                  </Text>
                </View>
              ) : (
                <View className="divide-y divide-border/60">
                  {schedules.map((sc) => (
                    <View key={sc.id} className="flex-col sm:flex-row sm:items-center justify-between gap-2 py-3">
                      <View className="flex-1 min-w-0 gap-0.5">
                        <View className="flex-row flex-wrap items-center gap-2">
                          <Text className="text-xs font-bold text-foreground">{sc.name}</Text>
                          <View
                            className="rounded-full px-2 py-0.5"
                            style={{ backgroundColor: sc.enabled ? "#10B98114" : "#EF444414" }}
                          >
                            <Text
                              className="text-[10px] font-bold"
                              style={{ color: sc.enabled ? "#065F46" : "#991B1B" }}
                            >
                              {sc.enabled ? "Aktif" : "Nonaktif"}
                            </Text>
                          </View>
                        </View>
                        <Text className="text-[11px] text-muted-foreground">
                          Setiap {sc.everyDays} hari sekali pukul {sc.runAtTime} WIB
                          {sc.nextRunAt ? ` • Jadwal berikutnya: ${new Date(sc.nextRunAt).toLocaleDateString("id-ID")}` : ""}
                        </Text>
                      </View>

                      <View className="flex-row gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onPress={() => {
                            setScheduleToEdit(sc);
                            setScheduleOpen(true);
                          }}
                        >
                          <Text className="text-xs">Ubah</Text>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onPress={async () => {
                            if (confirm("Hapus aturan jadwal ini?")) {
                              await api.delete(`/file-management/schedules/${sc.id}`);
                              toast("Jadwal dihapus", "success");
                              loadData();
                            }
                          }}
                        >
                          <Trash2 size={13} color="#EF4444" />
                        </Button>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Riwayat Pekerjaan Migrasi (Job History) */}
            <View className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm gap-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-bold text-foreground">Riwayat Aktivitas Migrasi</Text>
              </View>

              {migrationJobs.length === 0 ? (
                <View className="items-center justify-center py-8 text-center">
                  <Text className="text-xs text-muted-foreground">Belum ada riwayat migrasi yang dijalankan</Text>
                </View>
              ) : (
                <View className="divide-y divide-border/60">
                  {migrationJobs.map((job) => {
                    const isRunning = job.status === "RUNNING";
                    const isCompleted = job.status === "COMPLETED";
                    const hasPendingClean = isCompleted && job.cleanedFiles === 0 && job.processedFiles > 0;

                    return (
                      <View key={job.id} className="py-3.5 space-y-2">
                        <View className="flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                          <View className="flex-1 min-w-0 gap-0.5">
                            <View className="flex-row items-center gap-2">
                              <Text className="text-xs font-bold text-foreground">
                                Migrasi #{job.id} ({job.mode})
                              </Text>
                              <View
                                className="rounded-full px-2 py-0.5"
                                style={{
                                  backgroundColor: isCompleted
                                    ? "#10B98114"
                                    : isRunning
                                    ? `${colors.primary}1A`
                                    : "rgba(0,0,0,0.05)",
                                }}
                              >
                                <Text
                                  className="text-[10px] font-bold"
                                  style={{
                                    color: isCompleted ? "#065F46" : isRunning ? colors.primary : undefined,
                                  }}
                                >
                                  {job.status}
                                </Text>
                              </View>
                            </View>
                            <Text className="text-[11px] text-muted-foreground">
                              {new Date(job.createdAt).toLocaleString("id-ID")} • {job.processedFiles} dari {job.totalFiles} berkas berhasil dipindahkan
                            </Text>
                          </View>

                          {/* Action Pembersihan & Rollback */}
                          <View className="flex-row flex-wrap items-center gap-1.5 pt-1 sm:pt-0">
                            {hasPendingClean ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onPress={() => handleRollback(job.id)}
                                >
                                  <Text className="text-xs">Rollback</Text>
                                </Button>
                                <Button
                                  size="sm"
                                  onPress={() => handleCleanupLocal(job.id)}
                                  style={{ backgroundColor: colors.primary }}
                                >
                                  <Text className="text-xs font-semibold text-white">
                                    Bersihkan Berkas Lokal
                                  </Text>
                                </Button>
                              </>
                            ) : null}
                          </View>
                        </View>

                        {/* Progress Bar */}
                        <View className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                          <View
                            className="h-full rounded-full"
                            style={{
                              width: `${job.totalFiles > 0 ? (job.processedFiles / job.totalFiles) * 100 : 0}%`,
                              backgroundColor: colors.primary,
                            }}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        ) : null}
      </View>

      {/* Dialog Modals */}
      <ProviderFormDialog
        visible={providerFormOpen}
        onClose={() => setProviderFormOpen(false)}
        providerToEdit={providerToEdit}
        onSuccess={() => void handleFullRefresh()}
      />

      <ProviderBrowseDialog
        visible={browseOpen}
        onClose={() => setBrowseOpen(false)}
        provider={providerToBrowse}
      />

      <MigrationDialog
        visible={migrationOpen}
        onClose={() => setMigrationOpen(false)}
        providers={providers}
        onSuccess={() => void handleFullRefresh()}
      />

      <ScheduleDialog
        visible={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        providers={providers}
        scheduleToEdit={scheduleToEdit}
        onSuccess={() => void handleFullRefresh()}
      />

      <FileDetailModal
        visible={detailModalOpen}
        fileId={selectedFileId}
        onClose={() => setDetailModalOpen(false)}
        onFileUpdated={() => {
          void handleFullRefresh();
        }}
      />
    </ScrollView>
  );
}
