import * as React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react-native";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { TodayAgendaCard } from "./today-agenda-card";

export function DashboardGreeting({ name, roleTitle }: { name: string; roleTitle: string }) {
  const { reload, toast } = useApp();
  const [refreshing, setRefreshing] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await reload();
      setRefreshKey((k) => k + 1);
      toast("Data diperbarui");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <View className="gap-4">
      <View className="mb-1 flex-row flex-wrap items-center justify-between gap-3">
        <View className="flex-1 min-w-[200px]">
          <Text className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground">
            Welcome back, {name}.
          </Text>
          <Text className="text-muted-foreground text-sm md:text-base mt-1">
            Here&apos;s what happening with your projects today ({roleTitle}).
          </Text>
        </View>
        <Button variant="outline" size="sm" disabled={refreshing} onPress={handleRefresh}>
          <RefreshCw size={15} color={colors.text} />
          <Text>{refreshing ? "Memuat..." : "Refresh"}</Text>
        </Button>
      </View>
      <TodayAgendaCard refreshKey={refreshKey} />
    </View>
  );
}

