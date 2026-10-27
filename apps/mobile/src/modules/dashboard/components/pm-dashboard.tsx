import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Panel, KpiCard, KpiRow } from "@/components/taska/basics";
import { FolderKanban, Calendar, ShoppingCart, AlertTriangle } from "lucide-react-native";
import { rupiah } from "@/lib/format";
import { ROLE_LABEL } from "@/constants/modules";
import { DashboardGreeting } from "./dashboard-greeting";
import { ProjectOverviewCard } from "./project-overview-card";
import { QuickActionsCard } from "./quick-actions-card";

interface PmDashboardProps {
  user: any;
  data: any;
  isMobile: boolean;
}

export function PmDashboard({ user, data, isMobile }: PmDashboardProps) {
  const router = useRouter();
  const role = user.role;

  const myProjects = data.projects.filter((p: any) => p.pm === user.name);
  const activeSurveys = data.surveys.filter((s: any) => s.status === "Berjalan" || s.status === "Dijadwalkan").length;
  const pendingReqs = data["purchase-requests"].filter((r: any) => r.status === "Diajukan" || r.status === "Cek stok").length;
  const delayedTasks = data.tasks.filter((t: any) => t.status === "BLOCKED").length;

  return (
    <View className="gap-6">
      <DashboardGreeting name={user.name} roleTitle={ROLE_LABEL[role]} />

      <KpiRow>
        <KpiCard
          label="My Projects"
          value={String(myProjects.length)}
          hint="Aktif di bawah PIC Anda"
          icon={FolderKanban}
          onPress={() => router.push("/projects")}
        />
        <KpiCard
          label="Field Surveys"
          value={String(activeSurveys)}
          hint="Jadwal survey lokasi"
          icon={Calendar}
          onPress={() => router.push("/surveys")}
        />
        <KpiCard
          label="Pending Requests"
          value={String(pendingReqs)}
          hint="Material butuh approval"
          tone="warning"
          icon={ShoppingCart}
          onPress={() => router.push("/purchase-requests")}
        />
        <KpiCard
          label="Blocked Tasks"
          value={String(delayedTasks)}
          hint="Perlu tindakan segera"
          tone="danger"
          icon={AlertTriangle}
          onPress={() => router.push("/projects")}
        />
      </KpiRow>

      <View className={isMobile ? "gap-6" : "flex-row gap-6 items-start"}>
        <View className={isMobile ? "w-full" : "flex-[1.5]"}>
          <ProjectOverviewCard
            projects={myProjects.length > 0 ? myProjects : data.projects.slice(0, 4)}
            onViewAll={() => router.push("/projects")}
          />
        </View>

        <View className={isMobile ? "w-full" : "flex-1"}>
          <Panel
            title="Peringatan & Kebutuhan Project"
            subtitle="Material lapangan dan kesiapan implementasi"
            icon={AlertTriangle}
          >
            <View className="gap-3">
              {data.leads.filter((l: any) => l.status === "Won").slice(0, 1).map((l: any) => (
                <View key={l.id} className="bg-card border-border/70 rounded-xl border p-3.5 gap-2">
                  <Text className="text-sm font-bold text-foreground" numberOfLines={1}>Lead Won Siap Project: {l.nama}</Text>
                  <Text className="text-muted-foreground text-xs" numberOfLines={2}>
                    {l.perusahaan} · Potensi: {rupiah(l.nilai)}. Siap dialokasikan tim lapangan.
                  </Text>
                  <Button size="sm" className="mt-1 h-8" onPress={() => router.push("/projects")}>
                    <Text className="text-xs">Buka & Setup Project</Text>
                  </Button>
                </View>
              ))}
              {data["purchase-requests"].filter((r: any) => r.status === "Diajukan" || r.status === "Cek stok").slice(0, 1).map((r: any) => (
                <View key={r.id} className="bg-card border-border/70 rounded-xl border p-3.5 gap-2">
                  <Text className="text-sm font-bold text-foreground" numberOfLines={1}>Permintaan Material: {r.nomor || r.item || "Request"}</Text>
                  <Text className="text-muted-foreground text-xs" numberOfLines={2}>
                    {r.project ? `Project: ${r.project} · ` : ""}{r.item || r.tujuan || "Material dibutuhkan"}.
                  </Text>
                  <Button variant="outline" size="sm" className="mt-1 h-8" onPress={() => router.push("/purchase-requests")}>
                    <Text className="text-xs">Periksa Request Barang</Text>
                  </Button>
                </View>
              ))}
              {data.leads.filter((l: any) => l.status === "Won").length === 0 && data["purchase-requests"].filter((r: any) => r.status === "Diajukan" || r.status === "Cek stok").length === 0 ? (
                <Text className="text-muted-foreground py-6 text-center text-xs">Tidak ada kebutuhan mendesak project saat ini.</Text>
              ) : null}
            </View>
          </Panel>
        </View>
      </View>

      <QuickActionsCard role={role} />
    </View>
  );
}

