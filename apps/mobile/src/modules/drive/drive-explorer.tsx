import * as React from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { colors } from "@/tokens";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import { formatBytes } from "@/modules/file-management/file-ui";
import {
  Folder,
  FolderPlus,
  UploadCloud,
  Search,
  ChevronRight,
  Home,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Film,
  Music,
  Eye,
  Download,
  Pencil,
  FolderInput,
  Trash2,
  Shield,
  Lock,
  LayoutGrid,
  List,
  ArrowUpDown,
  RefreshCw,
  Share2,
} from "lucide-react-native";
import { DrivePreviewModal, downloadDriveFile } from "./drive-preview-modal";
import {
  DriveShareDialog,
  FolderAccessDialog,
  FolderFormDialog,
  MoveItemDialog,
  MultiUploadDialog,
  RenameFileDialog,
} from "./drive-dialogs";
import type {
  DriveBrowseResponse,
  DriveFileItem,
  DriveFolderItem,
} from "./types";

const FILE_TYPE_FILTERS = [
  { key: "all", label: "Semua" },
  { key: "pdf", label: "PDF" },
  { key: "excel", label: "Excel / CSV" },
  { key: "word", label: "Word" },
  { key: "image", label: "Gambar" },
  { key: "video", label: "Video" },
  { key: "text", label: "Teks" },
] as const;

function FileTypeIcon({ fileType, size = 20 }: { fileType: string; size?: number }) {
  switch (fileType) {
    case "pdf":
      return <FileText size={size} color="#DC2626" />;
    case "excel":
      return <FileSpreadsheet size={size} color="#059669" />;
    case "word":
      return <FileText size={size} color="#2563EB" />;
    case "image":
      return <ImageIcon size={size} color="#0891B2" />;
    case "video":
      return <Film size={size} color="#7C3AED" />;
    case "audio":
      return <Music size={size} color="#DB2777" />;
    default:
      return <FileText size={size} color="#64748B" />;
  }
}

export function DriveExplorer({
  mode = "manager",
}: {
  /** manager = aksi penuh mengikuti RBAC & ACL folder; viewer = paksa hanya lihat/unduh */
  mode?: "viewer" | "manager";
}) {
  const { toast } = useApp();

  const [folderId, setFolderId] = React.useState<number | null>(null);
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [fileType, setFileType] = React.useState<string>("all");
  const [sortBy, setSortBy] = React.useState<"updatedAt" | "name" | "size">("updatedAt");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = React.useState<"list" | "grid">("list");

  const [data, setData] = React.useState<DriveBrowseResponse | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Dialog states
  const [previewFile, setPreviewFile] = React.useState<DriveFileItem | null>(null);
  const [folderFormOpen, setFolderFormOpen] = React.useState(false);
  const [folderToEdit, setFolderToEdit] = React.useState<DriveFolderItem | null>(null);
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [renameFile, setRenameFile] = React.useState<DriveFileItem | null>(null);
  const [moveTarget, setMoveTarget] = React.useState<
    { type: "folder"; data: DriveFolderItem } | { type: "file"; data: DriveFileItem } | null
  >(null);
  const [accessFolder, setAccessFolder] = React.useState<DriveFolderItem | null>(null);
  const [shareFile, setShareFile] = React.useState<DriveFileItem | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const loadBrowse = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (folderId !== null) params.append("folderId", String(folderId));
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (fileType && fileType !== "all") params.append("fileType", fileType);
      params.append("sortBy", sortBy);
      params.append("sortDir", sortDir);

      const res = await api.get<DriveBrowseResponse>(`/drive/browse?${params.toString()}`);
      setData(res);
    } catch (e) {
      toast((e as Error).message || "Gagal memuat Dokumen Umum.", "danger");
    } finally {
      setLoading(false);
    }
  }, [folderId, debouncedSearch, fileType, sortBy, sortDir, toast]);

  React.useEffect(() => {
    void Promise.resolve().then(() => loadBrowse());
  }, [loadBrowse]);

  const handleDeleteFolder = async (folder: DriveFolderItem) => {
    const ok =
      typeof confirm === "function"
        ? confirm(`Hapus folder "${folder.name}" beserta seluruh subfolder dan berkas di dalamnya?`)
        : true;
    if (!ok) return;
    try {
      await api.delete(`/drive/folders/${folder.id}`);
      toast(`Folder "${folder.name}" berhasil dihapus.`, "success");
      void loadBrowse();
    } catch (e) {
      toast((e as Error).message, "danger");
    }
  };

  const handleDeleteFile = async (file: DriveFileItem) => {
    const ok =
      typeof confirm === "function"
        ? confirm(`Hapus berkas "${file.name}"?`)
        : true;
    if (!ok) return;
    try {
      await api.delete(`/drive/files/${file.id}`);
      toast(`Berkas "${file.name}" berhasil dihapus.`, "success");
      void loadBrowse();
    } catch (e) {
      toast((e as Error).message, "danger");
    }
  };

  const cycleSort = () => {
    if (sortBy === "updatedAt") {
      setSortBy("name");
      setSortDir("asc");
    } else if (sortBy === "name") {
      setSortBy("size");
      setSortDir("desc");
    } else {
      setSortBy("updatedAt");
      setSortDir("desc");
    }
  };

  const sortLabel =
    sortBy === "name" ? "Nama A-Z" : sortBy === "size" ? "Ukuran" : "Terbaru";

  const isManagerMode = mode === "manager";
  const canCreateOrUpload = isManagerMode && Boolean(data?.permissions.canUpload);
  const currentFolderName = data?.currentFolder?.name || "Dokumen Umum";
  const folders = data?.folders ?? [];
  const files = data?.files ?? [];

  return (
    <View className="gap-4">
      {/* Top Toolbar: Breadcrumbs + Action Buttons */}
      <View className="rounded-2xl border border-border bg-card p-3.5 sm:p-4 gap-3">
        {/* Breadcrumb + Stats */}
        <View className="flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1 min-w-0">
            <View className="flex-row items-center gap-1">
              <Pressable
                onPress={() => setFolderId(null)}
                className={`flex-row items-center gap-1.5 rounded-lg px-2.5 py-1.5 ${
                  folderId === null ? "bg-primary/15" : "bg-muted/30"
                }`}
              >
                <Home size={14} color={folderId === null ? colors.primary : colors.mutedForeground} />
                <Text
                  className={`text-xs font-bold ${
                    folderId === null ? "text-primary" : "text-foreground"
                  }`}
                >
                  Dokumen Umum
                </Text>
              </Pressable>

              {(data?.breadcrumbs ?? []).map((crumb, idx, arr) => {
                const isLast = idx === arr.length - 1;
                return (
                  <React.Fragment key={crumb.id}>
                    <ChevronRight size={14} color={colors.mutedForeground} />
                    <Pressable
                      onPress={() => setFolderId(crumb.id)}
                      className={`rounded-lg px-2.5 py-1.5 ${
                        isLast ? "bg-primary/15" : "bg-muted/20"
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          isLast ? "text-primary font-bold" : "text-foreground"
                        }`}
                        numberOfLines={1}
                      >
                        {crumb.name}
                      </Text>
                    </Pressable>
                  </React.Fragment>
                );
              })}
            </View>
          </ScrollView>

          <View className="flex-row flex-wrap items-center gap-2 shrink-0">
            {data?.stats && (
              <View className="rounded-full bg-muted/40 border border-border/60 px-2.5 py-1">
                <Text className="text-[11px] font-medium text-muted-foreground">
                  {data.stats.totalFolders} folder • {data.stats.totalFiles} berkas •{" "}
                  {formatBytes(data.stats.totalBytes)}
                </Text>
              </View>
            )}

            {canCreateOrUpload && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => {
                    setFolderToEdit(null);
                    setFolderFormOpen(true);
                  }}
                  className="h-8 gap-1.5"
                >
                  <FolderPlus size={14} color={colors.primary} />
                  <Text className="text-xs font-semibold">Folder Baru</Text>
                </Button>
                <Button
                  size="sm"
                  onPress={() => setUploadOpen(true)}
                  className="h-8 gap-1.5"
                  style={{ backgroundColor: colors.primary }}
                >
                  <UploadCloud size={14} color="#FFF" />
                  <Text className="text-xs font-semibold text-white">Unggah Berkas</Text>
                </Button>
              </>
            )}
          </View>
        </View>

        {/* Search + Filter + Sort + View Toggle */}
        <View className="flex-col md:flex-row md:items-center gap-2.5">
          <View className="flex-1 min-w-0 flex-row items-center rounded-xl border border-border bg-background px-3 h-10 gap-2">
            <Search size={15} color={colors.mutedForeground} />
            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Cari nama folder atau berkas..."
              className="flex-1 border-0 bg-transparent h-9 px-0 text-xs"
            />
          </View>

          <View className="flex-row items-center gap-1.5 shrink-0">
            <Button size="sm" variant="outline" onPress={cycleSort} className="h-9 gap-1.5">
              <ArrowUpDown size={13} color={colors.mutedForeground} />
              <Text className="text-xs font-medium">{sortLabel}</Text>
            </Button>

            <View className="flex-row rounded-lg border border-border overflow-hidden">
              <Pressable
                onPress={() => setViewMode("list")}
                className={`p-2 ${viewMode === "list" ? "bg-primary/15" : "bg-card"}`}
              >
                <List size={15} color={viewMode === "list" ? colors.primary : colors.mutedForeground} />
              </Pressable>
              <Pressable
                onPress={() => setViewMode("grid")}
                className={`p-2 ${viewMode === "grid" ? "bg-primary/15" : "bg-card"}`}
              >
                <LayoutGrid size={15} color={viewMode === "grid" ? colors.primary : colors.mutedForeground} />
              </Pressable>
            </View>

            <Button size="sm" variant="outline" onPress={() => void loadBrowse()} className="h-9 px-2.5">
              <RefreshCw size={14} color={colors.mutedForeground} />
            </Button>
          </View>
        </View>

        {/* File Type Filter Chips */}
        <View className="flex-row flex-wrap items-center gap-1.5 w-full">
          {FILE_TYPE_FILTERS.map((f) => {
            const active = fileType === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFileType(f.key)}
                className={`rounded-full px-3 py-1 border ${
                  active ? "bg-primary border-primary" : "bg-muted/20 border-border"
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    active ? "text-white" : "text-muted-foreground"
                  }`}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Content Area */}
      {loading && !data ? (
        <View className="items-center justify-center py-16 rounded-2xl border border-border bg-card">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="mt-2.5 text-xs text-muted-foreground">Memuat Dokumen Umum...</Text>
        </View>
      ) : folders.length === 0 && files.length === 0 ? (
        <View className="items-center justify-center py-16 px-6 rounded-2xl border border-dashed border-border bg-card gap-2.5">
          <View className="rounded-2xl p-3.5 bg-muted/30">
            <Folder size={32} color={colors.mutedForeground} />
          </View>
          <Text className="text-sm font-bold text-foreground text-center">
            {debouncedSearch || fileType !== "all"
              ? "Tidak ada folder atau berkas yang cocok"
              : "Folder ini masih kosong"}
          </Text>
          <Text className="text-xs text-muted-foreground text-center max-w-sm">
            {debouncedSearch || fileType !== "all"
              ? "Coba ubah kata kunci pencarian atau pilih filter tipe dokumen lainnya."
              : canCreateOrUpload
                ? "Buat folder baru atau unggah beberapa berkas sekaligus untuk mulai mengelola Dokumen Umum."
                : "Belum ada dokumen yang dibagikan di lokasi ini."}
          </Text>
          {canCreateOrUpload && !debouncedSearch && fileType === "all" && (
            <View className="flex-row gap-2 mt-2">
              <Button
                size="sm"
                variant="outline"
                onPress={() => {
                  setFolderToEdit(null);
                  setFolderFormOpen(true);
                }}
                className="gap-1.5"
              >
                <FolderPlus size={14} color={colors.primary} />
                <Text className="text-xs font-semibold">Folder Baru</Text>
              </Button>
              <Button
                size="sm"
                onPress={() => setUploadOpen(true)}
                className="gap-1.5"
                style={{ backgroundColor: colors.primary }}
              >
                <UploadCloud size={14} color="#FFF" />
                <Text className="text-xs font-semibold text-white">Unggah Berkas</Text>
              </Button>
            </View>
          )}
        </View>
      ) : (
        <View className="gap-4">
          {/* Folders Section */}
          {folders.length > 0 && (
            <View className="gap-2.5">
              <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
                Folder ({folders.length})
              </Text>
              <View className={viewMode === "grid" ? "flex-row flex-wrap gap-3" : "gap-2"}>
                {folders.map((folder) => {
                  const accent = folder.color || colors.primary;
                  return (
                    <View
                      key={folder.id}
                      className={`rounded-2xl border border-border bg-card overflow-hidden ${
                        viewMode === "grid" ? "w-full sm:w-[48%] lg:w-[31.8%]" : "w-full"
                      }`}
                    >
                      <Pressable
                        onPress={() => setFolderId(folder.id)}
                        className="p-3.5 flex-row items-center justify-between gap-2.5"
                      >
                        <View className="flex-1 min-w-0 flex-row items-center gap-3">
                          <View
                            className="rounded-xl p-2.5 shrink-0"
                            style={{ backgroundColor: `${accent}1F` }}
                          >
                            <Folder size={20} color={accent} />
                          </View>
                          <View className="flex-1 min-w-0">
                            <View className="flex-row items-center gap-1.5">
                              <Text
                                className="text-sm font-bold text-foreground flex-shrink"
                                numberOfLines={1}
                              >
                                {folder.name}
                              </Text>
                              {folder.isRestricted && (
                                <View className="rounded-full bg-amber-500/15 px-1.5 py-0.5 flex-row items-center gap-0.5 shrink-0">
                                  <Lock size={10} color="#D97706" />
                                  <Text className="text-[10px] font-semibold text-amber-600">
                                    Terbatas
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                              {folder.subfolderCount} subfolder • {folder.fileCount} berkas
                              {folder.description ? ` • ${folder.description}` : ""}
                            </Text>
                          </View>
                        </View>
                        <ChevronRight size={16} color={colors.mutedForeground} />
                      </Pressable>

                      {isManagerMode &&
                        (folder.permissions.canEdit ||
                          folder.permissions.canDelete ||
                          folder.permissions.canManageAccess) && (
                          <View className="flex-row flex-wrap items-center justify-end gap-1 border-t border-border/60 bg-muted/15 px-3 py-1.5">
                            {folder.permissions.canManageAccess && (
                              <Pressable
                                onPress={() => setAccessFolder(folder)}
                                className="flex-row items-center gap-1 rounded-lg px-2 py-1"
                              >
                                <Shield size={12} color="#D97706" />
                                <Text className="text-[11px] font-semibold text-amber-600">Akses</Text>
                              </Pressable>
                            )}
                            {folder.permissions.canEdit && (
                              <>
                                <Pressable
                                  onPress={() => {
                                    setFolderToEdit(folder);
                                    setFolderFormOpen(true);
                                  }}
                                  className="flex-row items-center gap-1 rounded-lg px-2 py-1"
                                >
                                  <Pencil size={12} color={colors.mutedForeground} />
                                  <Text className="text-[11px] font-medium text-muted-foreground">
                                    Ubah
                                  </Text>
                                </Pressable>
                                <Pressable
                                  onPress={() => setMoveTarget({ type: "folder", data: folder })}
                                  className="flex-row items-center gap-1 rounded-lg px-2 py-1"
                                >
                                  <FolderInput size={12} color={colors.mutedForeground} />
                                  <Text className="text-[11px] font-medium text-muted-foreground">
                                    Pindah
                                  </Text>
                                </Pressable>
                              </>
                            )}
                            {folder.permissions.canDelete && (
                              <Pressable
                                onPress={() => void handleDeleteFolder(folder)}
                                className="flex-row items-center gap-1 rounded-lg px-2 py-1"
                              >
                                <Trash2 size={12} color="#EF4444" />
                                <Text className="text-[11px] font-medium text-destructive">Hapus</Text>
                              </Pressable>
                            )}
                          </View>
                        )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Files Section */}
          {files.length > 0 && (
            <View className="gap-2.5">
              <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
                Berkas ({files.length})
              </Text>
              <View className={viewMode === "grid" ? "flex-row flex-wrap gap-3" : "gap-2"}>
                {files.map((file) => (
                  <View
                    key={file.id}
                    className={`rounded-2xl border border-border bg-card overflow-hidden ${
                      viewMode === "grid" ? "w-full sm:w-[48%] lg:w-[31.8%]" : "w-full"
                    }`}
                  >
                    <Pressable
                      onPress={() => setPreviewFile(file)}
                      className="p-3.5 flex-row items-center justify-between gap-2.5"
                    >
                      <View className="flex-1 min-w-0 flex-row items-center gap-3">
                        <View className="rounded-xl p-2.5 bg-muted/35 shrink-0">
                          <FileTypeIcon fileType={file.fileType} size={20} />
                        </View>
                        <View className="flex-1 min-w-0">
                          <Text
                            className="text-sm font-semibold text-foreground"
                            numberOfLines={1}
                            ellipsizeMode="middle"
                          >
                            {file.name}
                          </Text>
                          <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                            {(file.extension || "file").toUpperCase()} • {formatBytes(file.size)} •{" "}
                            {file.uploader?.name || "Sistem"} •{" "}
                            {new Date(file.createdAt).toLocaleDateString("id-ID", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </Text>
                          {(debouncedSearch || fileType !== "all") && file.folderName && (
                            <Text className="text-[10px] text-primary font-medium mt-0.5" numberOfLines={1}>
                              Lokasi: {file.folderName}
                            </Text>
                          )}
                        </View>
                      </View>
                    </Pressable>

                    {/* Action Footer */}
                    <View className="flex-row flex-wrap items-center justify-end gap-1 border-t border-border/60 bg-muted/15 px-3 py-1.5">
                      <Pressable
                        onPress={() => setPreviewFile(file)}
                        className="flex-row items-center gap-1 rounded-lg px-2 py-1"
                      >
                        <Eye size={12} color={colors.primary} />
                        <Text className="text-[11px] font-semibold text-primary">Pratinjau</Text>
                      </Pressable>

                      {file.permissions.canDownload && (
                        <Pressable
                          onPress={() => void downloadDriveFile(file, toast)}
                          className="flex-row items-center gap-1 rounded-lg px-2 py-1"
                        >
                          <Download size={12} color={colors.mutedForeground} />
                          <Text className="text-[11px] font-medium text-foreground">Unduh</Text>
                        </Pressable>
                      )}

                      <Pressable
                        onPress={() => setShareFile(file)}
                        className="flex-row items-center gap-1 rounded-lg px-2 py-1"
                      >
                        <Share2 size={12} color={colors.mutedForeground} />
                        <Text className="text-[11px] font-medium text-foreground">Bagikan</Text>
                      </Pressable>

                      {isManagerMode && file.permissions.canEdit && (
                        <>
                          <Pressable
                            onPress={() => setRenameFile(file)}
                            className="flex-row items-center gap-1 rounded-lg px-2 py-1"
                          >
                            <Pencil size={12} color={colors.mutedForeground} />
                            <Text className="text-[11px] font-medium text-muted-foreground">Ubah</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => setMoveTarget({ type: "file", data: file })}
                            className="flex-row items-center gap-1 rounded-lg px-2 py-1"
                          >
                            <FolderInput size={12} color={colors.mutedForeground} />
                            <Text className="text-[11px] font-medium text-muted-foreground">Pindah</Text>
                          </Pressable>
                        </>
                      )}

                      {isManagerMode && file.permissions.canDelete && (
                        <Pressable
                          onPress={() => void handleDeleteFile(file)}
                          className="flex-row items-center gap-1 rounded-lg px-2 py-1"
                        >
                          <Trash2 size={12} color="#EF4444" />
                          <Text className="text-[11px] font-medium text-destructive">Hapus</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {/* Modals */}
      <DrivePreviewModal
        visible={Boolean(previewFile)}
        onClose={() => setPreviewFile(null)}
        file={previewFile}
      />

      <FolderFormDialog
        visible={folderFormOpen}
        onClose={() => setFolderFormOpen(false)}
        parentId={folderId}
        folderToEdit={folderToEdit}
        onSaved={() => void loadBrowse()}
      />

      <MultiUploadDialog
        visible={uploadOpen}
        onClose={() => setUploadOpen(false)}
        folderId={folderId}
        folderName={currentFolderName}
        onUploaded={() => void loadBrowse()}
      />

      <RenameFileDialog
        visible={Boolean(renameFile)}
        onClose={() => setRenameFile(null)}
        file={renameFile}
        onSaved={() => void loadBrowse()}
      />

      <MoveItemDialog
        visible={Boolean(moveTarget)}
        onClose={() => setMoveTarget(null)}
        item={moveTarget}
        onMoved={() => void loadBrowse()}
      />

      <FolderAccessDialog
        visible={Boolean(accessFolder)}
        onClose={() => setAccessFolder(null)}
        folder={accessFolder}
        onSaved={() => void loadBrowse()}
      />

      <DriveShareDialog
        visible={Boolean(shareFile)}
        onClose={() => setShareFile(null)}
        file={shareFile}
      />
    </View>
  );
}
