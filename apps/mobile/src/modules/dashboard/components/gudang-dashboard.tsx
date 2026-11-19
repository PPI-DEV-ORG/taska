import * as React from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Panel, KpiCard, KpiRow } from "@/components/akuntra/basics";
import { PackageCheck, AlertTriangle, Truck, Boxes, ChevronRight } from "lucide-react-native";
import { ROLE_LABEL, type Role } from "@/constants/modules";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { DashboardGreeting } from "./dashboard-greeting";
import { QuickActionsCard } from "./quick-actions-card";

interface GudangDashboardProps {
  user: any;
  data: any;
  isMobile: boolean;
}

/**
 * Dashboard Gudang: hanya tugas pokok gudang — barang masuk, stok, barang keluar, dan serah barang stok ke proyek.
 * Tanpa persetujuan, pembelian, keuangan, maupun ringkasan proyek.
 */
export function GudangDashboard({ user, data, isMobile }: GudangDashboardProps) {
  const router = useRouter();
  const { refreshModule } = useApp();
  const role = user.role;

  // Permintaan ambil-stok (cek stok & serah barang) dimuat walau Gudang tidak punya menu Pembelian
  React.useEffect(() => {
    if (!data["purchase-requests"]) void refreshModule("purchase-requests").catch(() => {});
    // sekali saat dibuka
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const receivings: any[] = data.receiving ?? [];
  const deliveries: any[] = data["delivery-notes"] ?? [];
  const waitReceive = receivings.filter((r) => r.status !== "Diterima" && r.status !== "Ditolak");
  const stockTasks = (data["purchase-requests"] ?? []).filter(
    (r: any) =>
      String(r.procurementSource ?? "").toUpperCase() === "GUDANG" &&
      ["Diajukan", "Cek stok", "Disetujui"].includes(String(r.status)),
  );
  const lowStock = (data.products ?? []).filter((p: any) => {
    const cur = Number(p.stok ?? p.stock ?? 0);
    const min = Number(p.minStock ?? p.min ?? 5);
    return cur <= min;
  }).length;
  const outbound = deliveries.filter((sj) => sj.status === "Menunggu pengiriman" || sj.status === "Menunggu persetujuan");

  const taskLabel = (st: string) => (st === "Disetujui" ? "Siap diserahkan" : st === "Cek stok" ? "Sedang cek stok" : "Perlu cek stok");

  return (
    <View className="gap-6">
      <DashboardGreeting name={user.name} roleTitle={ROLE_LABEL[role as Role] ?? user.role} />

      <KpiRow>
        <KpiCard
          label="Barang Masuk"
          value={String(waitReceive.length)}
          hint="Menunggu diterima"
          icon={PackageCheck}
          onPress={() => router.push("/receiving")}
        />
        <KpiCard
          label="Serah Barang Stok"
          value={String(stockTasks.length)}
          hint="Permintaan proyek dari stok"
          tone="warning"
          icon={Boxes}
          onPress={stockTasks[0] ? () => router.push(`/purchase-requests/${stockTasks[0].id}` as any) : undefined}
        />
        <KpiCard
          label="Stok Menipis"
          value={String(lowStock)}
          hint="Di bawah batas aman"
          tone="danger"
          icon={AlertTriangle}
          onPress={() => router.push("/stock")}
        />
        <KpiCard
          label="Barang Keluar"
          value={String(outbound.length)}
          hint="Surat jalan menunggu"
          icon={Truck}
          onPress={() => router.push("/delivery-notes")}
        />
      </KpiRow>

      <View className={isMobile ? "gap-6" : "flex-row gap-6 items-start"}>
        {/* Serah barang dari stok (permintaan proyek yang diambil dari gudang) */}
        <View className={isMobile ? "w-full" : "flex-1"}>
          <Panel title="Serah Barang dari Stok" subtitle="Cek stok lalu serahkan barang ke tim proyek" icon={Boxes}>
            {stockTasks.length === 0 ? (
              <Text className="text-muted-foreground py-4 text-center text-xs">Tidak ada permintaan ambil stok saat ini.</Text>
            ) : (
              <View>
                {stockTasks.slice(0, 6).map((pr: any, i: number) => (
                  <Pressable
                    key={pr.id}
                    onPress={() => router.push(`/purchase-requests/${pr.id}` as any)}
                    className={`flex-row items-center gap-3 py-2.5 ${i > 0 ? "border-t border-border/60" : ""}`}
                  >
                    <View className="flex-1 min-w-0">
                      <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
                        {pr.nomor} · {pr.project && pr.project !== "-" ? pr.project : pr.pemohon || "Permintaan"}
                      </Text>
                      <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                        {pr.item || pr.tujuan || "Barang"}
                      </Text>
                    </View>
                    <View className={`rounded-full px-2 py-0.5 ${pr.status === "Disetujui" ? "bg-emerald-500/10" : "bg-amber-500/10"}`}>
                      <Text className={`text-[11px] font-semibold ${pr.status === "Disetujui" ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
                        {taskLabel(String(pr.status))}
                      </Text>
                    </View>
                    <ChevronRight size={16} color={colors.muted} />
                  </Pressable>
                ))}
              </View>
            )}
          </Panel>
        </View>

        {/* Antrean barang masuk & keluar */}
        <View className={isMobile ? "w-full" : "flex-1"}>
          <Panel title="Antrean Gudang" subtitle="Barang masuk & surat jalan keluar" icon={PackageCheck}>
            <View className="gap-3">
              {waitReceive.slice(0, 2).map((r: any) => (
                <View key={`rc-${r.id}`} className="bg-card border-border/70 rounded-xl border p-3.5 gap-2">
                  <Text className="text-sm font-bold text-foreground" numberOfLines={1}>Barang masuk: {r.nomor || r.supplier || "Inbound"}</Text>
                  <Text className="text-muted-foreground text-xs" numberOfLines={2}>
                    {r.supplier ? `Dari ${r.supplier} · ` : ""}{r.item || "Barang tiba di gudang"}.
                  </Text>
                  <Button size="sm" className="mt-1 h-8" onPress={() => router.push(`/receiving/new?receivingId=${r.id}` as any)}>
                    <Text className="text-xs">Terima & Scan Unit</Text>
                  </Button>
                </View>
              ))}
              {outbound.slice(0, 2).map((sj: any) => (
                <View key={`sj-${sj.id}`} className="bg-card border-border/70 rounded-xl border p-3.5 gap-2">
                  <Text className="text-sm font-bold text-foreground" numberOfLines={1}>Barang keluar: {sj.nomor}</Text>
                  <Text className="text-muted-foreground text-xs" numberOfLines={2}>
                    {sj.tujuan ? `Tujuan ${sj.tujuan} · ` : ""}{sj.barang || "Pengiriman barang"}.
                  </Text>
                  <Button variant="outline" size="sm" className="mt-1 h-8" onPress={() => router.push(`/delivery-notes/${sj.id}` as any)}>
                    <Text className="text-xs">Scan Keluar Barang</Text>
                  </Button>
                </View>
              ))}
              {waitReceive.length === 0 && outbound.length === 0 ? (
                <Text className="text-muted-foreground py-6 text-center text-xs">Tidak ada antrean barang masuk / keluar saat ini.</Text>
              ) : null}
            </View>
          </Panel>
        </View>
      </View>

      <QuickActionsCard role={role} />
    </View>
  );
}
