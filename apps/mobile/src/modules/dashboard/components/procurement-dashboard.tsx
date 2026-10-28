import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Panel, KpiCard, KpiRow } from "@/components/taska/basics";
import { ChartCard , BarChart } from "@/components/taska/charts";
import { ShoppingCart, FileText, Truck, PackageCheck } from "lucide-react-native";
import { colors } from "@/tokens";
import { tanggal } from "@/lib/format";
import { ROLE_LABEL, type Role } from "@/constants/modules";
import { DashboardGreeting } from "./dashboard-greeting";
import { ProjectOverviewCard } from "./project-overview-card";
import { QuickActionsCard } from "./quick-actions-card";
import { getLastMonths } from "../types";

interface ProcurementDashboardProps {
  user: any;
  data: any;
  now: number;
  isMobile: boolean;
}

export function ProcurementDashboard({ user, data, now, isMobile }: ProcurementDashboardProps) {
  const router = useRouter();
  const role = user.role;

  const pendingReqs = data["purchase-requests"].filter((r: any) => r.status === "Diajukan" || r.status === "Cek stok").length;
  const activePos = data["supplier-pos"].filter((p: any) => p.status !== "Sampai").length;
  const onShipping = data["supplier-pos"].filter((p: any) => p.pengiriman === "Dikirim").length;
  const waitReceiving = data.receiving.filter((r: any) => r.status === "Menunggu penerimaan").length;

  const last12Months = getLastMonths(12);
  const purchasesByMonth = last12Months.map(({ year, month, label }) => {
    const sum = (data["supplier-pos"] ?? []).reduce((acc: number, p: any) => {
      if (p.status === "Ditolak" || p.status === "Dibatalkan") return acc;
      const dStr = p.tanggal || p.eta;
      if (!dStr) return acc;
      const pd = new Date(dStr);
      if (!isNaN(pd.getTime()) && pd.getFullYear() === year && pd.getMonth() === month) {
        return acc + (Number(p.total) || 0);
      }
      return acc;
    }, 0);
    const j = sum / 1_000_000;
    const val = j >= 10 ? Math.round(j) : Math.round(j * 10) / 10;
    return { label, values: [val] };
  });

  return (
    <View className="gap-6">
      <DashboardGreeting name={user.name} roleTitle={ROLE_LABEL[role as Role] ?? user.role} />

      <KpiRow>
        <KpiCard
          label="Pending Requests"
          value={String(pendingReqs)}
          hint="Cek stok sebelum beli"
          tone="warning"
          icon={ShoppingCart}
          onPress={() => router.push("/purchase-requests")}
        />
        <KpiCard
          label="Supplier POs"
          value={String(activePos)}
          hint="Pesanan aktif ke vendor"
          icon={FileText}
          onPress={() => router.push("/supplier-pos")}
        />
        <KpiCard
          label="In Transit"
          value={String(onShipping)}
          hint="Pengiriman vendor berjalan"
          icon={Truck}
          onPress={() => router.push("/supplier-pos")}
        />
        <KpiCard
          label="Receiving Ready"
          value={String(waitReceiving)}
          hint="Tiba di gudang"
          icon={PackageCheck}
          onPress={() => router.push("/receiving")}
        />
      </KpiRow>

      <View className={isMobile ? "gap-6" : "flex-row gap-6 items-start"}>
        <View className={isMobile ? "w-full" : "flex-[1.5]"}>
          <ProjectOverviewCard
            projects={data.projects.slice(0, 4)}
            disableNavigation
          />
        </View>

        <View className={isMobile ? "w-full" : "flex-1"}>
          <Panel
            title="Peringatan Pengadaan & Supplier"
            subtitle="Cek ketersediaan stok internal & status PO supplier"
            icon={PackageCheck}
          >
            <View className="gap-3">
              {data["purchase-requests"].filter((r: any) => r.status === "Cek stok" || r.status === "Diajukan").slice(0, 1).map((r: any) => (
                <View key={r.id} className="bg-card border-border/70 rounded-xl border p-3.5 gap-2">
                  <Text className="text-sm font-bold text-foreground" numberOfLines={1}>Cek Stok: {r.nomor || r.item || "Purchase Request"}</Text>
                  <Text className="text-muted-foreground text-xs" numberOfLines={2}>
                    {r.item || r.tujuan || "Material diajukan"}. Cek ketersediaan stok sebelum PO baru.
                  </Text>
                  <Button size="sm" className="mt-1 h-8" onPress={() => router.push("/stock")}>
                    <Text className="text-xs">Cek Ketersediaan Stok</Text>
                  </Button>
                </View>
              ))}
              {data["supplier-pos"].filter((p: any) => p.status !== "Sampai" && p.eta && new Date(p.eta).getTime() < now).slice(0, 1).map((p: any) => (
                <View key={p.id} className="bg-card border-border/70 rounded-xl border p-3.5 gap-2">
                  <Text className="text-sm font-bold text-foreground" numberOfLines={1}>PO Supplier Terlambat: {p.nomor}</Text>
                  <Text className="text-muted-foreground text-xs" numberOfLines={2}>
                    {p.supplier ? `${p.supplier} · ` : ""}Estimasi tiba {p.eta ? tanggal(p.eta) : "-"}.
                  </Text>
                  <Button variant="outline" size="sm" className="mt-1 h-8" onPress={() => router.push(`/supplier-pos/${p.id}` as any)}>
                    <Text className="text-xs">Update Status Pengiriman</Text>
                  </Button>
                </View>
              ))}
              {data["purchase-requests"].filter((r: any) => r.status === "Cek stok" || r.status === "Diajukan").length === 0 &&
              data["supplier-pos"].filter((p: any) => p.status !== "Sampai" && p.eta && new Date(p.eta).getTime() < now).length === 0 ? (
                <Text className="text-muted-foreground py-6 text-center text-xs">Tidak ada peringatan pengadaan saat ini.</Text>
              ) : null}
            </View>
          </Panel>
        </View>
      </View>

      <QuickActionsCard role={role} />

      <ChartCard title="Nilai Pembelian per Bulan" subtitle="Dalam jutaan Rupiah">
        <BarChart
          data={purchasesByMonth}
          series={[{ name: "Total PO Supplier", color: colors.primary }]}
          format={(n) => `${n} jt`}
        />
      </ChartCard>
    </View>
  );
}

