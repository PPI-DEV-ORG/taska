import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Text } from "@/components/ui/text";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";
import {
  FileText,
  Image,
  Video,
  FileCode,
  HardDrive,
  Cloud,
  Server,
  FolderSync,
} from "lucide-react-native";

export function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return `${val.toFixed(val >= 100 || i === 0 ? 0 : 1)} ${sizes[i]}`;
}

export function FileKindBadge({ kind, extension }: { kind?: string; extension?: string | null }) {
  let Icon = FileText;
  let bg = "bg-blue-500/10 text-blue-600 border-blue-500/20";
  const k = (kind || "").toUpperCase();

  if (k === "FOTO" || ["jpg", "jpeg", "png", "webp"].includes(extension || "")) {
    Icon = Image;
    bg = "bg-amber-500/10 text-amber-600 border-amber-500/20";
  } else if (k === "VIDEO" || ["mp4", "mkv"].includes(extension || "")) {
    Icon = Video;
    bg = "bg-rose-500/10 text-rose-600 border-rose-500/20";
  } else if (["zip", "rar", "tar"].includes(extension || "")) {
    Icon = FileCode;
    bg = "bg-purple-500/10 text-purple-600 border-purple-500/20";
  }

  return (
    <View className={cn("flex-row items-center gap-1 rounded-md border px-2 py-0.5", bg)}>
      <Icon size={12} />
      <Text className="text-[10px] font-semibold uppercase">{extension ? extension.toUpperCase() : k}</Text>
    </View>
  );
}

export function FileStatusBadge({ status }: { status: string }) {
  let color = "#10B981";
  let label = "Tersedia";

  if (status === "PENDING_DELETION" || status === "ARCHIVED") {
    color = "#F59E0B";
    label = status === "ARCHIVED" ? "Diarsipkan" : "Tempat Sampah";
  } else if (status === "DELETED") {
    color = "#EF4444";
    label = "Dihapus";
  } else if (status === "UPLOADING") {
    color = "#3B82F6";
    label = "Mengunggah";
  }

  return (
    <View
      className="self-start rounded-full border px-2 py-0.5"
      style={{ backgroundColor: `${color}1A`, borderColor: `${color}33` }}
    >
      <Text className="text-[10px] font-semibold" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

export function ProviderTypeBadge({ type, isDefault }: { type: string; isDefault?: boolean }) {
  let Icon = Server;
  let color = "#10B981";
  let name = type;

  if (type === "S3") {
    Icon = Cloud;
    color = "#8B5CF6";
    name = "S3 / MinIO";
  } else if (type === "WEBDAV") {
    Icon = FolderSync;
    color = "#0284C7";
    name = "WebDAV NAS";
  } else if (type === "NAS_MOUNT") {
    Icon = HardDrive;
    color = "#059669";
    name = "NAS Mount";
  } else if (type === "LOCAL") {
    name = "Server Lokal";
  }

  return (
    <View className="flex-row items-center gap-1">
      <View
        className="flex-row items-center gap-1 rounded-md border px-2 py-0.5"
        style={{ backgroundColor: `${color}1A`, borderColor: `${color}33` }}
      >
        <Icon size={11} color={color} />
        <Text className="text-[10px] font-semibold" style={{ color }}>
          {name}
        </Text>
      </View>
      {isDefault ? (
        <View className="rounded bg-primary/10 px-1.5 py-0.5" style={{ backgroundColor: `${colors.primary}1A` }}>
          <Text className="text-[9px] font-bold" style={{ color: colors.primary }}>
            DEFAULT
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export type TabItem = {
  value: string;
  label: string;
  count?: number;
};

export function FileTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: TabItem[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View className="flex-row gap-1 rounded-xl border border-border/70 bg-card p-1">
        {tabs.map((tab) => {
          const active = tab.value === value;
          return (
            <Pressable
              key={tab.value}
              onPress={() => onChange(tab.value)}
              className="min-h-[34px] flex-row items-center gap-1.5 rounded-lg px-3"
              style={{
                backgroundColor: active ? colors.primary : "transparent",
              }}
            >
              <Text
                className={cn(
                  "text-xs font-semibold",
                  active ? "text-white" : "text-muted-foreground",
                )}
              >
                {tab.label}
              </Text>
              {tab.count != null ? (
                <View
                  className="rounded-full px-1.5 py-0.5"
                  style={{
                    backgroundColor: active ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.06)",
                  }}
                >
                  <Text
                    className={cn(
                      "text-[10px] font-bold",
                      active ? "text-white" : "text-muted-foreground",
                    )}
                  >
                    {tab.count}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  color,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  color: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
}) {
  return (
    <View className="min-w-[210px] flex-1 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
      <View className="flex-row items-start justify-between gap-2">
        <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </Text>
        <View className="rounded-lg p-1.5" style={{ backgroundColor: `${color}18` }}>
          <Icon size={14} color={color} />
        </View>
      </View>
      <Text className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</Text>
      {hint ? <Text className="mt-1 text-xs text-muted-foreground">{hint}</Text> : null}
    </View>
  );
}
