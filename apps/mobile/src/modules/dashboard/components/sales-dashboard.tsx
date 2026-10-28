import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Panel, KpiCard, KpiRow } from "@/components/taska/basics";
import { ChartCard , HBarChart } from "@/components/taska/charts";
import { FolderKanban, TrendingUp, FileText, Clock } from "lucide-react-native";
import { colors } from "@/tokens";
import { rupiah, tanggal } from "@/lib/format";
import { ROLE_LABEL, type Role } from "@/constants/modules";
import { DashboardGreeting } from "./dashboard-greeting";
import { ProjectOverviewCard } from "./project-overview-card";
import { QuickActionsCard } from "./quick-actions-card";

interface SalesDashboardProps {
  user: any;
  data: any;
  isMobile: boolean;
}

export function SalesDashboard({ user, data, isMobile }: SalesDashboardProps) {
  const router = useRouter();
  const role = user.role;

  const newLeads = data.leads.filter((l: any) => l.status === "Prospecting").length;
  const activeLeads = data.leads.filter((l: any) => l.status !== "Won" && l.status !== "Lost").length;
  const sentQuotes = data.quotations.filter((q: any) => q.status === "Terkirim").length;
  const wonThisMonth = data.leads.filter((l: any) => l.status === "Won").length;

  const idleLeads = data.leads.filter((l: any) => l.sepi > 7 && l.status !== "Lost" && l.status !== "Won");
  const expiringQuotes = data.quotations.filter((q: any) => q.status === "Terkirim");

  const sourceCounts: Record<string, number> = {};
  (data.leads ?? []).forEach((l: any) => {
    const src = String(l.sumber || "").trim();
    if (src && src !== "-") {
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    }
  });

  const sources = Object.keys(sourceCounts).length > 0
    ? Object.keys(sourceCounts)
        .sort((a, b) => (sourceCounts[b] || 0) - (sourceCounts[a] || 0))
        .slice(0, 6)
        .map((label) => ({
          label,
          value: sourceCounts[label] || 0,
        }))
    : ((data.leadSources?.length
        ? data.leadSources.map((s: any) => s.nama).filter(Boolean).slice(0, 6)
        : ["Referral", "Sosial media", "Website", "Event", "Distributor", "Cold call"]
      ) as string[]
      ).map((label: string) => ({
        label,
        value: 0,
      }));

  const lostCounts: Record<string, number> = {};
  (data.leads ?? []).forEach((l: any) => {
    if (l.status === "Lost" || l.alasanLost) {
      const reason = String(l.alasanLost || "").trim();
      if (reason && reason !== "-") {
        lostCounts[reason] = (lostCounts[reason] || 0) + 1;
      }
    }
  });

  const lostReasons = Object.keys(lostCounts).length > 0
    ? Object.keys(lostCounts)
        .sort((a, b) => (lostCounts[b] || 0) - (lostCounts[a] || 0))
        .slice(0, 5)
        .map((label, idx) => ({
          label,
          value: lostCounts[label] || 0,
          color: idx === 0 ? colors.danger : idx === 1 ? colors.warning : colors.info,
        }))
    : ((data.lostReasons?.length
        ? data.lostReasons.map((r: any) => r.nama).filter(Boolean).slice(0, 3)
        : ["Belum ada follow-up", "Client tidak ada kabar", "Harga tidak cocok"]
      ) as string[]
      ).map((label: string, idx: number) => ({
        label,
        value: 0,
        color: idx === 0 ? colors.danger : colors.warning,
      }));

  return (
    <View className="gap-6">
      <DashboardGreeting name={user.name} roleTitle={ROLE_LABEL[role as Role] ?? user.role} />

      <KpiRow>
        <KpiCard
          label="Active Leads"
          value={String(activeLeads)}
          hint="Sedang di-follow up"
          icon={TrendingUp}
          onPress={() => router.push("/leads")}
        />
        <KpiCard
          label="New Inquiries"
          value={String(newLeads)}
          hint="Tahap Prospecting"
          icon={FolderKanban}
          onPress={() => router.push("/leads")}
        />
        <KpiCard
          label="Sent Quotations"
          value={String(sentQuotes)}
          hint="Menunggu respon client"
          icon={FileText}
          onPress={() => router.push("/quotations")}
        />
        <KpiCard
          label="Won Deals"
          value={String(wonThisMonth)}
          hint="Target bulan ini"
          tone="success"
          icon={TrendingUp}
          onPress={() => router.push("/leads")}
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
            title="Tindak Lanjut Mendesak"
            subtitle="Lead prospek yang belum dihubungi atau sudah lama idle"
            icon={Clock}
          >
            <View className="gap-3">
              {idleLeads.slice(0, 2).map((l: any) => (
                <View key={l.id} className="bg-card border-border/70 rounded-xl border p-3.5 gap-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-bold text-foreground flex-1 pr-2" numberOfLines={1}>{l.nama}</Text>
                    <View className="bg-warning/15 rounded px-1.5 py-0.5">
                      <Text className="text-warning text-[10px] font-bold">Idle {l.sepi} Hari</Text>
                    </View>
                  </View>
                  <Text className="text-muted-foreground text-xs">
                    {l.perusahaan} · Potensi: {rupiah(l.nilai)}
                  </Text>
                  <Button size="sm" className="mt-1 h-8" onPress={() => router.push(`/leads/${l.id}` as any)}>
                    <Text className="text-xs">Follow Up Sekarang</Text>
                  </Button>
                </View>
              ))}
              {expiringQuotes.slice(0, 1).map((q: any) => (
                <View key={q.id} className="bg-card border-border/70 rounded-xl border p-3.5 gap-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-bold text-foreground flex-1 pr-2" numberOfLines={1}>{q.nomor}</Text>
                    <View className="bg-info/15 rounded px-1.5 py-0.5">
                      <Text className="text-info text-[10px] font-bold">Quotation</Text>
                    </View>
                  </View>
                  <Text className="text-muted-foreground text-xs">
                    {q.customer} · Berlaku s/d {tanggal(q.berlaku)}
                  </Text>
                  <Button variant="outline" size="sm" className="mt-1 h-8" onPress={() => router.push(`/quotations/${q.id}` as any)}>
                    <Text className="text-xs">Cek Status Penawaran</Text>
                  </Button>
                </View>
              ))}
            </View>
          </Panel>
        </View>
      </View>

      <QuickActionsCard role={role} />

      <View className="flex-row flex-wrap gap-4">
        <ChartCard title="Lead per Sumber" subtitle="Asal kedatangan leads">
          <HBarChart data={sources} />
        </ChartCard>
        <ChartCard title="Alasan Lost" subtitle="Analisa penyebab lead batal">
          <HBarChart data={lostReasons} />
        </ChartCard>
      </View>
    </View>
  );
}

