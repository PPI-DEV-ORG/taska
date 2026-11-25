import * as React from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Panel, KpiCard, KpiRow } from "@/components/akuntra/basics";
import {
  Funnel,
  BarChart,
  HBarChart,
  WaveChart,
  LineChart,
  PieChart,
  ChartCard,
} from "@/components/akuntra/charts";
import { StatusBadge } from "@/components/akuntra/status-badge";
import {
  FolderKanban,
  TrendingUp,
  ClipboardCheck,
  Wallet,
  Activity,
  DollarSign,
  PieChart as PieIcon,
  Layers,
} from "lucide-react-native";
import { colors } from "@/tokens";
import { rupiah, rupiahShort } from "@/lib/format";
import { formatAuditAction } from "@/lib/audit-format";
import { ROLE_LABEL, type Role } from "@/constants/modules";
import { useApp } from "@/store/app-store";
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
  const role = user.role as Role;
  const { can } = useApp();
  // Pendapatan & piutang = laporan keuangan -> hanya peran dengan hak Buku Besar
  const seeFinance = can("accounting", "L");
  const pendingRequests = (data["purchase-requests"] ?? []).filter((r: any) =>
    ["Diajukan", "Cek stok"].includes(r.status),
  ).length;

  const pipelineVal = data.leads
    .filter((l: any) => l.status !== "Lost" && l.status !== "Won")
    .reduce((acc: number, l: any) => acc + (l.nilai || 0), 0);
  const totalLeadsCount = data.leads.length;
  const wonLeadsCount = data.leads.filter((l: any) => l.status === "Won").length;
  const winRate = totalLeadsCount > 0 ? Math.round((wonLeadsCount / totalLeadsCount) * 100) : 0;

  const activeProjects = data.projects.filter((p: any) => p.status === "Berjalan");
  const completedProjects = data.projects.filter((p: any) => p.status === "Selesai");
  const delayedProjects = data.projects.filter((p: any) => p.status === "Terlambat");
  const pendingProjects = data.projects.filter(
    (p: any) => p.status !== "Berjalan" && p.status !== "Selesai" && p.status !== "Terlambat",
  );

  const unpaidInv = data.invoices
    .filter((i: any) => i.status !== "Lunas")
    .reduce((acc: number, i: any) => acc + (i.total - i.terbayar), 0);
  const totalInvoiced = data.invoices.reduce((acc: number, i: any) => acc + (Number(i.total) || 0), 0);
  const totalPaid = data.invoices.reduce((acc: number, i: any) => acc + (Number(i.terbayar) || 0), 0);
  const collectionRate = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0;

  const pendingApprovals = approvals.filter((a: any) => a.status === "Menunggu");

  // 1. Funnel Konversi Prospek
  const funnelData = [
    { label: "Prospecting", value: data.leads.filter((l: any) => l.status === "Prospecting").length },
    { label: "Qualification", value: data.leads.filter((l: any) => l.status === "Qualification").length },
    { label: "Proposal", value: data.leads.filter((l: any) => l.status === "Proposal").length },
    { label: "Negotiation", value: data.leads.filter((l: any) => l.status === "Negotiation").length },
    { label: "Won", value: wonLeadsCount },
  ];

  // 2. Data Tren 6 Bulan (WaveChart & LineChart)
  const last6Months = getLastMonths(6);
  const cashFlowWaveData = last6Months.map(({ year, month, label }) => {
    let paid = 0;
    (data.invoices ?? []).forEach((inv: any) => {
      const dStr = inv.tanggal || inv.jatuhTempo;
      if (!dStr) return;
      const id = new Date(dStr);
      if (!isNaN(id.getTime()) && id.getFullYear() === year && id.getMonth() === month) {
        paid += Number(inv.terbayar) || 0;
      }
    });
    const pJt = paid / 1_000_000;
    return {
      label,
      value: pJt >= 10 ? Math.round(pJt) : Math.round(pJt * 10) / 10,
    };
  });

  // 3. Line Chart Data: Target vs Realisasi Penagihan 6 Bulan
  const salesPerformanceData = last6Months.map(({ year, month, label }) => {
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

  // 4. BarChart 4 Bulan Terakhir
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

  // 5. Pie / Donut Chart Status & Kesehatan Proyek
  const projectDonutData = [
    { label: "Berjalan", value: activeProjects.length, color: colors.primary },
    { label: "Selesai", value: completedProjects.length, color: colors.navy },
    { label: "Terlambat", value: delayedProjects.length, color: colors.danger },
    { label: "Tertunda / Lainnya", value: Math.max(0, pendingProjects.length), color: colors.warning },
  ].filter((p) => p.value > 0);

  // 6. Pie / Donut Chart Komposisi Pengeluaran Riil
  const expenseCatSums: Record<string, number> = {};
  let totalExpenses = 0;
  (data.expenses ?? []).forEach((e: any) => {
    if (e.status === "Ditolak") return;
    const cat = String(e.kategori || "Operasional").trim();
    const amt = Number(e.nominal) || 0;
    if (amt > 0) {
      expenseCatSums[cat] = (expenseCatSums[cat] || 0) + amt;
      totalExpenses += amt;
    }
  });

  const expensePieData = Object.keys(expenseCatSums).length > 0
    ? Object.keys(expenseCatSums)
        .sort((a, b) => (expenseCatSums[b] || 0) - (expenseCatSums[a] || 0))
        .slice(0, 5)
        .map((cat, idx) => ({
          label: cat,
          value: expenseCatSums[cat] || 0,
          color: [colors.primary, colors.navy, "#4DA3FF", "#F2B63C", "#A78BFA"][idx % 5],
        }))
    : [];

  const riskyProjects = data.projects.filter(
    (p: any) => p.status === "Terlambat" || p.pembayaran === "Belum lunas" || p.pembayaran === "Lunas sebagian",
  );

  return (
    <View className="gap-6">
      <DashboardGreeting name={user.name} roleTitle={ROLE_LABEL[role as Role] ?? user.role} />

      {/* Row 1: Top 4 KPI Cards Eksekutif */}
      <KpiRow>
        <KpiCard
          label="Proyek Berjalan"
          value={String(activeProjects.length)}
          hint={`${data.projects.length} total proyek terdaftar`}
          icon={FolderKanban}
          onPress={() => router.push("/projects")}
        />
        <KpiCard
          label="Active Pipeline"
          value={rupiahShort(pipelineVal)}
          hint={`Win Rate: ${winRate}%`}
          tone="info"
          icon={TrendingUp}
          onPress={() => router.push("/leads")}
        />
        <KpiCard
          label="Pending Approvals"
          value={String(pendingApprovals.length)}
          hint="Perlu verifikasi & keputusan"
          tone={pendingApprovals.length > 0 ? "danger" : undefined}
          icon={ClipboardCheck}
          onPress={() => router.push("/approvals")}
        />
        {seeFinance ? (
          <KpiCard
            label="Faktur Belum Lunas"
            value={rupiahShort(unpaidInv)}
            hint={`Kolektibilitas ${collectionRate}%`}
            tone="warning"
            icon={Wallet}
            onPress={() => router.push("/invoices")}
          />
        ) : (
          <KpiCard
            label="Permintaan Barang"
            value={String(pendingRequests)}
            hint="Menunggu diproses"
            tone="warning"
            icon={Wallet}
            onPress={() => router.push("/purchase-requests")}
          />
        )}
      </KpiRow>

      {/* Row 2: Wave Chart Tren Arus Kas & Donut Chart Kesehatan Proyek */}
      <View className={isMobile ? "gap-4" : "flex-row flex-wrap gap-4"}>
        {seeFinance ? (
          <ChartCard
            title="Tren Arus Kas Masuk (Cash Inflow)"
            subtitle="Realisasi penerimaan pembayaran faktur 6 bulan terakhir (Juta Rupiah)"
          >
            <WaveChart
              data={cashFlowWaveData}
              color={colors.primary}
              format={(n) => `${n} jt`}
              badgeText="Realisasi Kas Bulanan"
            />
          </ChartCard>
        ) : null}

        <ChartCard
          title="Distribusi Status Proyek"
          subtitle="Kondisi kesehatan portofolio proyek aktif & selesai"
        >
          {data.projects.length > 0 && projectDonutData.length > 0 ? (
            <PieChart
              data={projectDonutData}
              donut={true}
              centerValue={`${data.projects.length}`}
              centerLabel="Proyek"
              format={(n) => `${n}`}
            />
          ) : (
            <View className="py-10 items-center justify-center text-center">
              <FolderKanban size={32} className="text-muted-foreground/40 mb-2" />
              <Text className="text-xs font-semibold text-foreground">Belum Ada Proyek Terdaftar</Text>
              <Text className="text-[11px] text-muted-foreground mt-0.5">
                Total 0 proyek di database sistem.
              </Text>
            </View>
          )}
        </ChartCard>
      </View>

      {/* Row 3: Line Chart Performa Target & Donut Chart Pengeluaran */}
      <View className={isMobile ? "gap-4" : "flex-row flex-wrap gap-4"}>
        {seeFinance ? (
          <ChartCard
            title="Performa Penjualan & Realisasi Faktur"
            subtitle="Perbandingan Nilai Faktur Terbit vs Pembayaran Diterima (Juta Rp)"
          >
            <LineChart
              data={salesPerformanceData}
              series={[
                { name: "Faktur Terbit", color: colors.navy },
                { name: "Kas Diterima", color: colors.primary },
              ]}
              format={(n) => `${n} jt`}
            />
          </ChartCard>
        ) : null}

        <ChartCard
          title="Komposisi Pengeluaran Operasional"
          subtitle={seeFinance ? `Total biaya tercatat: ${rupiahShort(totalExpenses)}` : "Distribusi biaya per kategori"}
        >
          {totalExpenses > 0 && expensePieData.length > 0 ? (
            <PieChart
              data={expensePieData}
              donut={true}
              centerValue={rupiahShort(totalExpenses)}
              centerLabel="Pengeluaran"
              format={(n) => rupiahShort(n)}
            />
          ) : (
            <View className="py-10 items-center justify-center text-center">
              <Wallet size={32} className="text-muted-foreground/40 mb-2" />
              <Text className="text-xs font-semibold text-foreground">Belum Ada Catatan Biaya</Text>
              <Text className="text-[11px] text-muted-foreground mt-0.5">
                Total pengeluaran operasional di database saat ini Rp 0.
              </Text>
            </View>
          )}
        </ChartCard>
      </View>

      {/* Row 4: BarChart Pendapatan vs Faktur & Funnel Leads */}
      <View className={isMobile ? "gap-4" : "flex-row flex-wrap gap-4"}>
        <ChartCard title="Funnel Konversi Penjualan" subtitle="Pergerakan dari Prospecting ke Won">
          <Funnel data={funnelData} />
        </ChartCard>

        {seeFinance ? (
          <ChartCard title="Perbandingan Tagihan vs Terbayar" subtitle="Pola penagihan 4 bulan terakhir">
            <BarChart
              data={revenueBars}
              series={[
                { name: "Nilai Faktur", color: colors.navy },
                { name: "Terbayar", color: colors.primary },
              ]}
              format={(n) => `${n} jt`}
            />
          </ChartCard>
        ) : null}
      </View>

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

      {/* Risky Projects & Audit Log */}
      <View className={isMobile ? "gap-4" : "flex-row flex-wrap gap-4"}>
        <Panel
          title="Proyek Perhatian Khusus"
          subtitle="Terlambat atau belum lunas"
          className={isMobile ? "w-full" : "flex-1 min-w-[300px]"}
        >
          {riskyProjects.length > 0 ? (
            riskyProjects.slice(0, 3).map((p: any) => (
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
            ))
          ) : (
            <Text className="text-muted-foreground text-xs py-4 text-center">
              Seluruh proyek berjalan tepat waktu dan dalam kondisi baik.
            </Text>
          )}
        </Panel>

        <Panel
          title="Aktivitas Lintas Divisi"
          subtitle="Audit log sistem"
          className={isMobile ? "w-full" : "flex-1 min-w-[300px]"}
        >
          {(data["audit-log"] ?? []).slice(0, 4).map((al: any) => {
            const text = formatAuditAction(al.aksi, al.detail);
            return (
              <View key={al.id} className="border-border/60 border-b py-2.5 last:border-b-0">
                <Text className="text-sm">
                  <Text className="font-semibold text-foreground">{al.pengguna}</Text>{" "}
                  {text.charAt(0).toLowerCase() + text.slice(1)}
                </Text>
                <Text className="text-muted-foreground text-xs mt-0.5">{al.jenis} · {al.refId}</Text>
              </View>
            );
          })}
        </Panel>
      </View>
    </View>
  );
}

