import * as React from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { CheckCircle2, Circle, Truck } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { PageHeader, Panel } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
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
        title="Pengiriman dari Supplier"
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
              className="bg-card border-border rounded-xl border p-5 gap-3"
            >
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-base font-semibold">{p.nomor} · {p.supplier}</Text>
                  <Text className="text-text-secondary text-xs">{p.item}</Text>
                </View>
                <StatusBadge status={p.pengiriman} />
              </View>

              <View className="border-border border-t pt-3 flex-row items-center justify-between">
                <View className="flex-row items-center gap-4">
                  {steps.map((s, i) => (
                    <View key={s} className="flex-row items-center gap-1.5">
                      {i <= cur ? (
                        <CheckCircle2 size={16} color={colors.success} />
                      ) : (
                        <Circle size={16} color={colors.border} />
                      )}
                      <Text className={i <= cur ? "text-xs font-semibold text-text" : "text-xs text-muted-foreground"}>
                        {s}
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
