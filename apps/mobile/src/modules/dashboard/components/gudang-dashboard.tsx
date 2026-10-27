import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Panel, KpiCard, KpiRow } from "@/components/taska/basics";
import { PackageCheck, ShoppingCart, AlertTriangle, Truck } from "lucide-react-native";
import { ROLE_LABEL } from "@/constants/modules";
import { DashboardGreeting } from "./dashboard-greeting";
import { ProjectOverviewCard } from "./project-overview-card";
import { QuickActionsCard } from "./quick-actions-card";

interface GudangDashboardProps {
  user: any;
  data: any;
  isMobile: boolean;
}

export function GudangDashboard({ user, data, isMobile }: GudangDashboardProps) {
  const router = useRouter();
  const role = user.role;

  const waitReceive = data.receiving.filter((r: any) => r.status !== "Diterima").length;
  const pendingRequests = (data["purchase-requests"] ?? []).filter(
    (r: any) => r.status === "Diajukan" || r.status === "Cek stok" || r.status === "Disetujui",
  );
  const lowStock = (data.products ?? []).filter((p: any) => {
    const cur = Number(p.stok ?? p.stock ?? 0);
    const min = Number(p.minStock ?? p.min ?? 5);
    return cur <= min;
  }).length;
  const todaySJ = data["delivery-notes"].filter((sj: any) => sj.status === "Pending" || sj.status === "Menunggu persetujuan").length;

  return (
    <View className="gap-6">
      <DashboardGreeting name={user.name} roleTitle={ROLE_LABEL[role]} />

      <KpiRow>
        <KpiCard
          label="Inbound Receiving"
          value={String(waitReceive)}
          hint="Kiriman vendor tiba"
          icon={PackageCheck}
          onPress={() => router.push("/receiving")}
        />
        <KpiCard
          label="Request Barang"
          value={String(pendingRequests.length)}
          hint="Permintaan barang tim"
          tone="warning"
          icon={ShoppingCart}
          onPress={() => router.push("/purchase-requests")}
        />
        <KpiCard
          label="Low Stock Items"
          value={String(lowStock)}
          hint="Di bawah batas aman"
          tone="danger"
          icon={AlertTriangle}
          onPress={() => router.push("/stock")}
        />
        <KpiCard
          label="Outbound Delivery"
          value={String(todaySJ)}
          hint="Surat jalan keluar"
          icon={Truck}
          onPress={() => router.push("/delivery-notes")}
        />
      </KpiRow>

      <View className={isMobile ? "gap-6" : "flex-row gap-6 items-start"}>
        <View className={isMobile ? "w-full" : "flex-[1.5]"}>
          <ProjectOverviewCard
            projects={data.projects.slice(0, 4)}
            onViewAll={() => router.push("/projects")}
          />
        </View>

        <View className={isMobile ? "w-full" : "flex-1"}>
          <Panel
            title="Tindakan Gudang & Logistik"
            subtitle="Penerimaan barang, request barang, & surat jalan"
            icon={PackageCheck}
          >
            <View className="gap-3">
              {pendingRequests.slice(0, 1).map((pr: any) => (
                <View key={pr.id} className="bg-card border-border/70 rounded-xl border p-3.5 gap-2">
                  <Text className="text-sm font-bold text-foreground" numberOfLines={1}>Request Barang: {pr.nomor}</Text>
                  <Text className="text-muted-foreground text-xs" numberOfLines={2}>
                    {pr.pemohon ? `Oleh ${pr.pemohon} · ` : ""}{pr.item || pr.tujuan || "Permintaan barang"}.
                  </Text>
                  <Button size="sm" className="mt-1 h-8" onPress={() => router.push(`/purchase-requests/${pr.id}` as any)}>
                    <Text className="text-xs">Cek Stok & Serahkan</Text>
                  </Button>
                </View>
              ))}
              {data.receiving.filter((r: any) => r.status !== "Diterima").slice(0, 1).map((r: any) => (
                <View key={r.id} className="bg-card border-border/70 rounded-xl border p-3.5 gap-2">
                  <Text className="text-sm font-bold text-foreground" numberOfLines={1}>Penerimaan: {r.nomor || r.supplier || "Inbound"}</Text>
                  <Text className="text-muted-foreground text-xs" numberOfLines={2}>
                    {r.supplier ? `Dari ${r.supplier} · ` : ""}{r.item || "Barang tiba di gudang"}.
                  </Text>
                  <Button size="sm" className="mt-1 h-8" onPress={() => router.push(`/receiving/${r.id}` as any)}>
                    <Text className="text-xs">Terima & Scan Unit</Text>
                  </Button>
                </View>
              ))}
              {data["delivery-notes"].filter((sj: any) => sj.status === "Pending" || sj.status === "Menunggu persetujuan").slice(0, 1).map((sj: any) => (
                <View key={sj.id} className="bg-card border-border/70 rounded-xl border p-3.5 gap-2">
                  <Text className="text-sm font-bold text-foreground" numberOfLines={1}>Surat Jalan: {sj.nomor}</Text>
                  <Text className="text-muted-foreground text-xs" numberOfLines={2}>
                    {sj.tujuan ? `Tujuan ${sj.tujuan} · ` : ""}{sj.barang || "Pengiriman barang"}.
                  </Text>
                  <Button variant="outline" size="sm" className="mt-1 h-8" onPress={() => router.push(`/delivery-notes/${sj.id}` as any)}>
                    <Text className="text-xs">Scan Keluar Barang</Text>
                  </Button>
                </View>
              ))}
              {pendingRequests.length === 0 &&
              data.receiving.filter((r: any) => r.status !== "Diterima").length === 0 &&
              data["delivery-notes"].filter((sj: any) => sj.status === "Pending" || sj.status === "Menunggu persetujuan").length === 0 ? (
                <Text className="text-muted-foreground py-6 text-center text-xs">Tidak ada antrean logistik gudang saat ini.</Text>
              ) : null}
            </View>
          </Panel>
        </View>
      </View>

      <QuickActionsCard role={role} />
    </View>
  );
}

