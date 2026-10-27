import * as React from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Panel, KpiCard, KpiRow, ChartCard, StatusBadge } from "@/components/taska/basics";
import { Funnel, BarChart } from "@/components/taska/charts";
import { FolderKanban, TrendingUp, ClipboardCheck, Wallet } from "lucide-react-native";
import { colors } from "@/tokens";
import { rupiah, rupiahShort } from "@/lib/format";
import { ROLE_LABEL } from "@/constants/modules";
import { DashboardGreeting } from "./dashboard-greeting";
import { ProjectOverviewCard } from "./project-overview-card";
import { QuickActionsCard } from "./quick-actions-card";
import { getLastMonths } from "../types";

interface ExecutiveDashboardProps {
  user: any;
  data: any;
  approvals: any[];
  decide: (id: string, decision: "Disetujui" | "Ditolak") => void;
  isMobile: boolean;
}

export function ExecutiveDashboard({
  user,
  data,
  approvals,
  decide,
  isMobile,
}: ExecutiveDashboardProps) {
  const router = useRouter();
  const role = user.role;

  const pipelineVal = data.leads
    .filter((l: any) => l.status !== "Lost" && l.status !== "Won")
    .reduce((acc: number, l: any) => acc + (l.nilai || 0), 0);
  const activeProjects = data.projects.filter((p: any) => p.status === "Berjalan");
  const unpaidInv = data.invoices
    .filter((i: any) => i.status !== "Lunas")
    .reduce((acc: number, i: any) => acc + (i.total - i.terbayar), 0);
  const pendingApprovals = approvals.filter((a: any) => a.status === "Menunggu");

  const funnelData = [
    { label: "Prospecting", value: data.leads.filter((l: any) => l.status === "Prospecting").length },
    { label: "Qualification", value: data.leads.filter((l: any) => l.status === "Qualification").length },
    { label: "Proposal", value: data.leads.filter((l: any) => l.status === "Proposal").length },
    { label: "Negotiation", value: data.leads.filter((l: any) => l.status === "Negotiation").length },
    { label: "Won", value: data.leads.filter((l: any) => l.status === "Won").length },
  ];

  const last4Months = getLastMonths(4);
  const revenueBars = last4Months.map(({ year, month, label }) => {
    let billed = 0;
    let paid = 0;
    (data.invoices ?? []).forEach((inv: any) => {
      const dStr = inv.tanggal || inv.jatuhTempo;
      if (!dStr) return;
      const id = new Date(dStr);
      if (!isNaN(id.getTime()) && id.getFullYear() === year && id.getMonth() === month) {
        billed += Number(inv.total) || 0;
        paid += Number(inv.terbayar) || 0;
      }
    });
    const bJt = billed / 1_000_000;
    const pJt = paid / 1_000_000;
    return {
      label,
      values: [
        bJt >= 10 ? Math.round(bJt) : Math.round(bJt * 10) / 10,
        pJt >= 10 ? Math.round(pJt) : Math.round(pJt * 10) / 10,
      ],
    };
  });

  const riskyProjects = data.projects.filter(
    (p: any) => p.status === "Terlambat" || p.pembayaran === "Belum lunas"
  );

  return (
    <View className="gap-6">
      <DashboardGreeting name={user.name} roleTitle={ROLE_LABEL[role]} />

      {/* Top 4 KPI Cards */}
      <KpiRow>
        <KpiCard
          label="Active Projects"
          value={String(activeProjects.length)}
          hint="+2 from last month"
          icon={FolderKanban}
          onPress={() => router.push("/projects")}
        />
        <KpiCard
          label="Active Pipeline"
          value={rupiahShort(pipelineVal)}
          hint="+15% conversion pace"
          icon={TrendingUp}
          onPress={() => router.push("/leads")}
        />
        <KpiCard
          label="Pending Approvals"
          value={String(pendingApprovals.length)}
          hint="Perlu tindakan segera"
          tone="danger"
          icon={ClipboardCheck}
          onPress={() => router.push("/approvals")}
        />
        <KpiCard
          label="Unpaid Invoices"
          value={rupiahShort(unpaidInv)}
          hint="Outstanding balance"
          tone="warning"
          icon={Wallet}
          onPress={() => router.push("/invoices")}
        />
      </KpiRow>

      {/* Main Grid: Project Overview & Antrean Persetujuan */}
      <View className={isMobile ? "gap-6" : "flex-row gap-6 items-start"}>
        <View className={isMobile ? "w-full" : "flex-[1.5]"}>
          <ProjectOverviewCard
            projects={activeProjects.slice(0, 4)}
            onViewAll={() => router.push("/projects")}
          />
        </View>

        <View className={isMobile ? "w-full" : "flex-1"}>
          <Panel
            title="Antrean Persetujuan"
            subtitle="PO, pengeluaran & surat jalan butuh approval Anda"
            icon={ClipboardCheck}
            right={
              <Button variant="ghost" size="sm" onPress={() => router.push("/approvals")}>
                <Text className="text-primary text-xs font-semibold">Semua ({pendingApprovals.length})</Text>
              </Button>
            }
          >
            <View className="gap-3">
              {pendingApprovals.slice(0, 3).map((a: any) => (
                <View
                  key={a.id}
                  className="bg-card border-border/70 rounded-xl border p-3.5 gap-2"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-bold text-foreground flex-1 pr-2" numberOfLines={1}>{a.judul}</Text>
                    <View className="bg-primary/10 rounded px-1.5 py-0.5">
                      <Text className="text-primary text-[10px] font-bold">{a.jenis}</Text>
                    </View>
                  </View>
                  <Text className="text-muted-foreground text-xs">
                    Diajukan oleh {a.pengaju} · Nilai: {rupiah(a.nilai)}
                  </Text>
                  <View className="flex-row gap-2 mt-1">
                    <Button size="sm" className="flex-1 h-8" onPress={() => decide(a.id, "Disetujui")}>
                      <Text className="text-xs">Setujui</Text>
                    </Button>
                    <Button variant="outline" size="sm" className="h-8" onPress={() => decide(a.id, "Ditolak")}>
                      <Text className="text-xs">Tolak</Text>
                    </Button>
                  </View>
                </View>
              ))}
              {pendingApprovals.length === 0 ? (
                <Text className="text-muted-foreground py-4 text-center text-xs">
                  Semua rekomendasi dan persetujuan telah selesai diproses.
                </Text>
              ) : null}
            </View>
          </Panel>
        </View>
      </View>

      {/* Quick Actions Row */}
      <QuickActionsCard role={role} />

      {/* Charts & Analytics */}
      <View className="flex-row flex-wrap gap-4">
        <ChartCard title="Funnel Lead" subtitle="Pergerakan dari Prospecting ke Won">
          <Funnel data={funnelData} />
        </ChartCard>
        <ChartCard title="Pendapatan vs Invoice Terbayar" subtitle="Dalam jutaan Rupiah">
          <BarChart
            data={revenueBars}
            series={[
              { name: "Nilai Invoice", color: colors.info },
              { name: "Terbayar", color: colors.success },
            ]}
            format={(n) => `${n} jt`}
          />
        </ChartCard>
      </View>

      {/* Risky Projects & Audit Log */}
      <View className="flex-row flex-wrap gap-4">
        <Panel title="Project Berisiko" subtitle="Terlambat atau belum lunas" className="flex-1 min-w-[300px]">
          {riskyProjects.slice(0, 3).map((p: any) => (
            <Pressable
              key={p.id}
              onPress={() => router.push(`/projects/${p.id}` as any)}
              className="border-border/60 flex-row items-center justify-between border-b py-3 last:border-b-0"
            >
              <View className="flex-1 pr-2">
                <Text className="text-sm font-semibold">{p.nama}</Text>
                <Text className="text-muted-foreground text-xs mt-0.5">{p.customer}</Text>
              </View>
              <View className="items-end gap-1">
                <StatusBadge status={p.status} />
                <Text className="text-warning text-xs font-medium">{p.pembayaran}</Text>
              </View>
            </Pressable>
          ))}
        </Panel>

        <Panel title="Aktivitas Lintas Divisi" subtitle="Audit log sistem" className="flex-1 min-w-[300px]">
          {data["audit-log"].slice(0, 4).map((al: any) => (
            <View key={al.id} className="border-border/60 border-b py-2.5 last:border-b-0">
              <Text className="text-sm">
                <Text className="font-semibold text-foreground">{al.pengguna}</Text> {al.aksi.toLowerCase()}
              </Text>
              <Text className="text-muted-foreground text-xs mt-0.5">{al.jenis} · {al.refId}</Text>
            </View>
          ))}
        </Panel>
      </View>
    </View>
  );
}

