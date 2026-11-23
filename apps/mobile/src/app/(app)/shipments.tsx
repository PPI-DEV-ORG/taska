import * as React from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { CheckCircle2, Circle, Truck } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { PageHeader, Panel } from "@/components/akuntra/basics";
import { StatusBadge } from "@/components/akuntra/status-badge";
import { statusText } from "@/lib/labels";
import { useApp } from "@/store/app-store";
import { tanggal } from "@/lib/format";
import { colors } from "@/tokens";

export default function ShipmentsScreen() {
  const router = useRouter();
  const { data } = useApp();

  const pos = data["supplier-pos"];

  return (
    <View className="gap-5">
      <PageHeader
        title="Pengiriman dari Pemasok"
        subtitle="Tracking status pengiriman logistik vendor & bukti Delivery Order (DO)"
      />

      <View className="gap-4">
        {pos.map((p) => {
          const steps = ["Di Supplier", "Dikirim", "Sampai"];
          const cur = steps.indexOf(p.pengiriman);

          return (
            <Pressable
              key={p.id}
              onPress={() => router.push(`/supplier-pos/${p.id}` as any)}
              className="bg-card border-border overflow-hidden rounded-xl border p-4 sm:p-5 gap-3"
            >
              <View className="flex-row items-start justify-between gap-2.5">
                <View className="flex-1 min-w-0 gap-0.5">
                  <Text className="text-sm sm:text-base font-semibold">{p.nomor} · {p.supplier}</Text>
                  <Text className="text-text-secondary text-xs">{p.item}</Text>
                </View>
                <View className="shrink-0">
                  <StatusBadge status={p.pengiriman} />
                </View>
              </View>

              <View className="border-border border-t pt-3 flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                <View className="flex-row flex-wrap items-center gap-3 sm:gap-4">
                  {steps.map((s, i) => (
                    <View key={s} className="flex-row items-center gap-1.5">
                      {i <= cur ? (
                        <CheckCircle2 size={15} color={colors.success} />
                      ) : (
                        <Circle size={15} color={colors.border} />
                      )}
                      <Text className={i <= cur ? "text-xs font-semibold text-text" : "text-xs text-muted-foreground"}>
                        {statusText(s)}
                      </Text>
                    </View>
                  ))}
                </View>

                <Text className="text-text-secondary text-xs">
                  Estimasi tiba: {tanggal(p.eta)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
