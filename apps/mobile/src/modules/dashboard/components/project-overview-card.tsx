import * as React from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Panel, SegmentedProgress } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { FolderKanban, Calendar, Users } from "lucide-react-native";
import { colors } from "@/tokens";
import { tanggal } from "@/lib/format";

export function ProjectOverviewCard({
  projects,
  onViewAll,
  disableNavigation = false,
}: {
  projects: any[];
  onViewAll?: () => void;
  disableNavigation?: boolean;
}) {
  const router = useRouter();
  const activeOnly = projects.filter(
    (p) => p.status !== "Selesai" && p.status !== "SELESAI",
  );
  return (
    <Panel
      title="Project Overview"
      subtitle="Track progress along all active projects"
      icon={FolderKanban}
      right={
        !disableNavigation && onViewAll ? (
          <Button variant="ghost" size="sm" onPress={onViewAll}>
            <Text className="text-primary text-xs font-semibold">Lihat Semua</Text>
          </Button>
        ) : undefined
      }
      className="flex-1"
    >
      <View className="gap-3">
        {activeOnly.length === 0 ? (
          <Text className="text-muted-foreground text-xs py-4 text-center">
            Tidak ada project aktif yang sedang berjalan.
          </Text>
        ) : (
          activeOnly.slice(0, 4).map((p) => {
            const content = (
              <>
                <View className="flex-1 min-w-[180px]">
                  <Text className="text-sm font-bold text-foreground" numberOfLines={1}>{p.nama}</Text>
                  <View className="flex-row items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <View className="flex-row items-center gap-1">
                      <Calendar size={13} color={colors.muted} />
                      <Text className="text-muted-foreground text-xs">{tanggal(p.selesai)}</Text>
                    </View>
                    <View className="flex-row items-center gap-1">
                      <Users size={13} color={colors.muted} />
                      <Text className="text-muted-foreground text-xs">{p.pm}</Text>
                    </View>
                  </View>
                </View>

                <View className="flex-row items-center justify-between md:justify-end gap-4">
                  <StatusBadge status={p.status} />
                  <SegmentedProgress percent={Number(p.progres) || 0} />
                </View>
              </>
            );

            if (disableNavigation) {
              return (
                <View
                  key={p.id}
                  className="bg-card border-border/70 flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border p-4"
                >
                  {content}
                </View>
              );
            }

            return (
              <Pressable
                key={p.id}
                onPress={() => router.push(`/projects/${p.id}` as any)}
                className="bg-card hover:bg-panel border-border/70 flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border p-4 transition-colors"
              >
                {content}
              </Pressable>
            );
          })
        )}
      </View>
    </Panel>
  );
}

