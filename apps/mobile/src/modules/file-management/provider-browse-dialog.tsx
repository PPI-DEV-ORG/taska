import * as React from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { colors } from "@/tokens";
import { api } from "@/services/api";
import {
  Folder,
  FileText,
  ChevronRight,
  FolderOpen,
  X,
  HardDrive,
  RefreshCw,
} from "lucide-react-native";
import { formatBytes } from "./file-ui";
import type { BrowseEntry, StorageProviderItem } from "./types";

export function ProviderBrowseDialog({
  visible,
  onClose,
  provider,
}: {
  visible: boolean;
  onClose: () => void;
  provider?: StorageProviderItem | null;
}) {
  const [currentPath, setCurrentPath] = React.useState("");
  const [entries, setEntries] = React.useState<BrowseEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadEntries = React.useCallback(
    async (path: string) => {
      if (!provider) return;
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<BrowseEntry[]>(
          `/file-management/providers/${provider.id}/browse?path=${encodeURIComponent(path)}`,
        );
        setEntries(Array.isArray(res) ? res : []);
        setCurrentPath(path);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [provider],
  );

  React.useEffect(() => {
    if (visible && provider) {
      queueMicrotask(() => loadEntries(""));
    }
  }, [visible, provider, loadEntries]);

  const breadcrumbs = React.useMemo(() => {
    if (!currentPath) return [];
    return currentPath.split("/").filter(Boolean);
  }, [currentPath]);

  const navigateToBreadcrumb = (index: number) => {
    if (index < 0) {
      loadEntries("");
      return;
    }
    const target = breadcrumbs.slice(0, index + 1).join("/");
    loadEntries(target);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/60 p-4">
        <View className="max-h-[85vh] w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl">
          {/* Header */}
          <View className="mb-4 flex-row items-center justify-between border-b border-border pb-3">
            <View className="flex-row items-center gap-2.5">
              <View className="rounded-xl p-2" style={{ backgroundColor: `${colors.primary}1A` }}>
                <FolderOpen size={20} color={colors.primary} />
              </View>
              <View>
                <Text className="text-base font-bold text-foreground">
                  Jelajah Isi Penyimpanan
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {provider?.name} ({provider?.type})
                </Text>
              </View>
            </View>
            <View className="flex-row items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onPress={() => loadEntries(currentPath)}
                disabled={loading}
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </Button>
              <Pressable onPress={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
                <X size={18} />
              </Pressable>
            </View>
          </View>

          {/* Breadcrumbs */}
          <View className="mb-3 flex-row flex-wrap items-center gap-1 rounded-xl bg-muted/30 px-3 py-2 border border-border/70">
            <Pressable onPress={() => navigateToBreadcrumb(-1)} className="flex-row items-center gap-1">
              <HardDrive size={13} color={colors.primary} />
              <Text className="text-xs font-semibold" style={{ color: colors.primary }}>
                Root
              </Text>
            </Pressable>
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                <ChevronRight size={12} className="text-muted-foreground" />
                <Pressable onPress={() => navigateToBreadcrumb(idx)}>
                  <Text
                    className={`text-xs ${
                      idx === breadcrumbs.length - 1
                        ? "font-bold text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {crumb}
                  </Text>
                </Pressable>
              </React.Fragment>
            ))}
          </View>

          {/* Isi Folder */}
          <View className="flex-1 min-h-[300px] rounded-xl border border-border/60 bg-muted/10 p-2">
            {loading ? (
              <View className="flex-1 items-center justify-center py-12">
                <ActivityIndicator size="large" color={colors.primary} />
                <Text className="mt-2 text-xs text-muted-foreground">Membaca isi penyimpanan...</Text>
              </View>
            ) : error ? (
              <View className="flex-1 items-center justify-center p-6 text-center">
                <Text className="text-xs text-rose-600 font-medium">{error}</Text>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onPress={() => loadEntries(currentPath)}
                >
                  <Text>Coba Lagi</Text>
                </Button>
              </View>
            ) : entries.length === 0 ? (
              <View className="flex-1 items-center justify-center py-12">
                <Text className="text-xs text-muted-foreground">Folder ini kosong</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View className="divide-y divide-border/50">
                  {entries.map((item, index) => {
                    const isDir = item.type === "dir";
                    return (
                      <Pressable
                        key={index}
                        onPress={() => {
                          if (isDir) {
                            loadEntries(item.path);
                          }
                        }}
                        className="flex-row items-center justify-between rounded-lg p-2.5 hover:bg-muted/40"
                      >
                        <View className="flex-1 flex-row items-center gap-2.5">
                          {isDir ? (
                            <Folder size={18} color="#F59E0B" />
                          ) : (
                            <FileText size={18} color="#64748B" />
                          )}
                          <View className="flex-1">
                            <Text className={`text-xs ${isDir ? "font-bold text-foreground" : "text-foreground"}`}>
                              {item.name}
                            </Text>
                            {item.modifiedAt ? (
                              <Text className="text-[10px] text-muted-foreground">
                                {new Date(item.modifiedAt).toLocaleString("id-ID")}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                        {!isDir && item.size != null ? (
                          <Text className="text-xs font-mono text-muted-foreground">
                            {formatBytes(item.size)}
                          </Text>
                        ) : isDir ? (
                          <ChevronRight size={14} className="text-muted-foreground" />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </View>

          {/* Footer */}
          <View className="mt-4 flex-row justify-end">
            <Button variant="outline" size="sm" onPress={onClose}>
              <Text>Tutup</Text>
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}
