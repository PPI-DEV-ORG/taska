import React from "react";
import { View, ScrollView, ActivityIndicator } from "react-native";
import { Text } from "@/components/ui/text";
import { RefreshCw, Edit2 } from "lucide-react-native";
import { colors } from "@/tokens";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "../types";

interface PayrollConfigTabProps {
  loadingConfigs: boolean;
  configs: any[];
  fetchConfigs: () => void;
  onEditConfig: (config: any) => void;
}

export function PayrollConfigTab({
  loadingConfigs,
  configs,
  fetchConfigs,
  onEditConfig,
}: PayrollConfigTabProps) {
  return (
    <View className="gap-4 w-full">
      <View className="bg-card border-border/80 rounded-2xl border p-4 flex-row flex-wrap items-center justify-between gap-3 shadow-sm">
        <View>
          <Text className="text-sm font-bold text-foreground">Master Pengaturan Gaji Karyawan</Text>
          <Text className="text-xs text-muted-foreground">
            Konfigurasi gaji pokok, tunjangan rutin, status PTKP untuk perhitungan PPh 21, dan status NPWP.
          </Text>
        </View>
        <Button size="sm" variant="outline" onPress={fetchConfigs} className="gap-1.5 h-9 px-3">
          <RefreshCw size={13} className={loadingConfigs ? "animate-spin" : ""} />
          <Text className="text-xs font-medium">Refresh</Text>
        </Button>
      </View>

      {/* Table Container Selaras DataTable */}
      <View className="bg-card border-border/80 w-full overflow-hidden rounded-2xl border shadow-sm">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ minWidth: "100%", width: "100%" }}
          className="w-full"
        >
          <View className="w-full flex-1 min-w-full">
            <View className="border-border/70 bg-card/60 flex-row items-center border-b px-4 py-3.5 w-full">
              <Text style={{ flex: 2.2, minWidth: 200 }} className="text-muted-foreground text-xs font-semibold tracking-wider">Karyawan</Text>
              <Text style={{ flex: 1.2, minWidth: 120 }} className="text-muted-foreground text-xs font-semibold tracking-wider text-right">Gaji Pokok</Text>
              <Text style={{ flex: 1.2, minWidth: 120 }} className="text-muted-foreground text-xs font-semibold tracking-wider text-right">Tunjangan Tetap</Text>
              <Text style={{ flex: 0.8, minWidth: 80 }} className="text-muted-foreground text-xs font-semibold tracking-wider text-center">PTKP</Text>
              <Text style={{ flex: 0.8, minWidth: 80 }} className="text-muted-foreground text-xs font-semibold tracking-wider text-center">NPWP</Text>
              <Text style={{ flex: 1.3, minWidth: 130 }} className="text-muted-foreground text-xs font-semibold tracking-wider text-center">Tarif PPh 21 Khusus</Text>
              <Text style={{ width: 90 }} className="text-muted-foreground text-xs font-semibold tracking-wider text-right">Aksi</Text>
            </View>

            {loadingConfigs ? (
              <View className="py-12 items-center justify-center">
                <ActivityIndicator size="small" />
              </View>
            ) : (
              configs.map((c) => (
                <View
                  key={c.userId}
                  className="border-border/60 hover:bg-panel/40 flex-row items-center border-b px-4 py-3.5 transition-colors w-full"
                >
                  <View style={{ flex: 2.2, minWidth: 200 }} className="pr-3">
                    <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>{c.user?.name}</Text>
                    <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
                      {c.user?.role} · {c.user?.email}
                    </Text>
                  </View>
                  <Text style={{ flex: 1.2, minWidth: 120 }} className="text-xs text-right text-foreground">
                    {formatRupiah(c.basicSalary)}
                  </Text>
                  <Text style={{ flex: 1.2, minWidth: 120 }} className="text-xs text-right text-foreground">
                    {formatRupiah(c.allowance)}
                  </Text>
                  <Text style={{ flex: 0.8, minWidth: 80 }} className="text-xs text-center text-foreground">{c.ptkp}</Text>
                  <Text style={{ flex: 0.8, minWidth: 80 }} className="text-xs text-center text-foreground">
                    {c.hasNpwp ? "Punya" : "Tidak"}
                  </Text>
                  <Text style={{ flex: 1.3, minWidth: 130 }} className="text-xs text-center text-foreground">
                    {c.pph21Rate ? `${c.pph21Rate}%` : "Otomatis (TER)"}
                  </Text>
                  <View style={{ width: 90 }} className="items-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => onEditConfig(c)}
                      className="h-8 px-2.5 gap-1.5"
                    >
                      <Edit2 size={12} color={colors.text} />
                      <Text className="text-xs font-medium text-foreground">Ubah</Text>
                    </Button>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

