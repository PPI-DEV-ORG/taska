import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Panel, KpiCard, KpiRow } from "@/components/taska/basics";
import { ChartCard } from "@/components/taska/charts";
import { HBarChart } from "@/components/taska/charts";
import { ClipboardCheck, AlertTriangle, Wallet, TrendingUp } from "lucide-react-native";
import { colors } from "@/tokens";
import { rupiah, rupiahShort } from "@/lib/format";
import { ROLE_LABEL, type Role } from "@/constants/modules";
import { DashboardGreeting } from "./dashboard-greeting";
import { ProjectOverviewCard } from "./project-overview-card";
import { QuickActionsCard } from "./quick-actions-card";

interface FinanceDashboardProps {
  user: any;
  data: any;
  approvals: any[];
  isMobile: boolean;
}

export function FinanceDashboard({ user, data, approvals, isMobile }: FinanceDashboardProps) {
  const router = useRouter();
  const role = user.role;

  const pendingApprovals = approvals.filter((a: any) => a.status === "Menunggu");
  const dueInvoices = data.invoices.filter((i: any) => i.status === "Terlambat").length;
  const totalPiutang = data.invoices
    .filter((i: any) => i.status !== "Lunas")
    .reduce((acc: number, i: any) => acc + (i.total - i.terbayar), 0);
  const pendingReimb = data.expenses.filter((e: any) => e.status === "Disetujui").length;

  const nowTime = new Date().getTime();
  let aging0_30 = 0;
  let aging31_60 = 0;
  let aging60Plus = 0;

  (data.invoices ?? []).forEach((inv: any) => {
    if (inv.status === "Lunas") return;
    const sisa = Math.max(0, (Number(inv.total) || 0) - (Number(inv.terbayar) || 0));
    if (sisa <= 0) return;

    const dateStr = inv.jatuhTempo || inv.tanggal;
    const dueTime = dateStr ? new Date(dateStr).getTime() : nowTime;
    const diffDays = Math.floor((nowTime - dueTime) / 86_400_000);

    if (diffDays <= 30) {
      aging0_30 += sisa;
    } else if (diffDays <= 60) {
      aging31_60 += sisa;
    } else {
      aging60Plus += sisa;
    }
  });

  const toJuta = (val: number) => {
    const j = val / 1_000_000;
    return j >= 10 ? Math.round(j) : Math.round(j * 10) / 10;
  };

  const agingData = [
    { label: "0–30 hari", value: toJuta(aging0_30), color: colors.success },
    { label: "31–60 hari", value: toJuta(aging31_60), color: colors.warning },
    { label: "60+ hari", value: toJuta(aging60Plus), color: colors.danger },
  ];

  const nowDate = new Date();
  const curYear = nowDate.getFullYear();
  const curMonth = nowDate.getMonth();

  const activeExpenses = (data.expenses ?? []).filter((e: any) => e.status !== "Ditolak");
  const thisMonthExpenses = activeExpenses.filter((e: any) => {
    if (!e.tanggal) return false;
    const d = new Date(e.tanggal);
    return !isNaN(d.getTime()) && d.getFullYear() === curYear && d.getMonth() === curMonth;
  });
  const expList = thisMonthExpenses.length > 0 ? thisMonthExpenses : activeExpenses;

  const catSums: Record<string, number> = {};
  let totalExp = 0;
  expList.forEach((e: any) => {
    const cat = String(e.kategori || "Lainnya").trim();
    const amt = Number(e.nominal) || 0;
    if (amt > 0) {
      catSums[cat] = (catSums[cat] || 0) + amt;
      totalExp += amt;
    }
  });

  const expCategories = Object.keys(catSums).length > 0
    ? Object.keys(catSums)
        .sort((a, b) => (catSums[b] || 0) - (catSums[a] || 0))
        .slice(0, 5)
        .map((cat) => {
          const amt = catSums[cat] || 0;
          const pct = totalExp > 0 ? Math.round((amt / totalExp) * 100) : 0;
          return {
            label: cat,
            value: pct,
            amount: amt,
            text: `${rupiah(amt)} (${pct}%)`,
          };
        })
    : ((data.expenseCategories?.length
        ? data.expenseCategories.map((c: any) => c.nama).filter(Boolean).slice(0, 4)
        : [
            "Transport & Bensin",
            "Perlengkapan",
            "Makan & Lembur",
            "Penginapan",
          ]
      ) as string[]
      ).map((label: string) => ({
        label,
        value: 0,
        amount: 0,
        text: "Rp 0 (0%)",
      }));

  return (
    <View className="gap-6">
      <DashboardGreeting name={user.name} roleTitle={ROLE_LABEL[role as Role] ?? user.role} />

      <KpiRow>
        <KpiCard
          label="Pending Approvals"
          value={String(pendingApprovals.length)}
          hint="PO & Biaya > 10jt"
          tone="danger"
          icon={ClipboardCheck}
          onPress={() => router.push("/approvals")}
        />
        <KpiCard
          label="Overdue Invoices"
          value={String(dueInvoices)}
          hint="Perlu penagihan segera"
          tone="warning"
          icon={AlertTriangle}
          onPress={() => router.push("/invoices")}
        />
        <KpiCard
          label="Total Piutang"
          value={rupiahShort(totalPiutang)}
          hint="Piutang aktif berjalan"
          icon={Wallet}
          onPress={() => router.push("/invoices")}
        />
        <KpiCard
          label="Ready Reimbursement"
          value={String(pendingReimb)}
          hint="Perlu upload bukti bayar"
          tone="info"
          icon={TrendingUp}
          onPress={() => router.push("/expenses")}
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
            title="Antrean Verifikasi Keuangan"
            subtitle="Persetujuan dokumen, reimbursement & pencocokan bukti"
            icon={ClipboardCheck}
          >
            <View className="gap-3">
              {pendingApprovals.slice(0, 2).map((a: any) => (
                <View key={a.id} className="bg-card border-border/70 rounded-xl border p-3.5 gap-2">
                  <Text className="text-sm font-bold text-foreground" numberOfLines={1}>{a.judul}</Text>
                  <Text className="text-muted-foreground text-xs">
                    {rupiah(a.nilai)} · Diajukan {a.pengaju} {a.nilai > 10_000_000 ? "· (Perlu Bos)" : ""}
                  </Text>
                  <Button size="sm" className="mt-1 h-8" onPress={() => router.push("/approvals")}>
                    <Text className="text-xs">Periksa & Putuskan</Text>
                  </Button>
                </View>
              ))}
              {pendingApprovals.length === 0 ? (
                <Text className="text-muted-foreground py-6 text-center text-xs">Tidak ada antrean persetujuan.</Text>
              ) : null}
            </View>
          </Panel>
        </View>
      </View>

      <QuickActionsCard role={role} />

      <View className="flex-row flex-wrap gap-4">
        <ChartCard title="Umur Piutang (Aging)" subtitle="Berdasarkan hari jatuh tempo (juta Rp)">
          <HBarChart data={agingData} format={(n) => `${n} jt`} />
        </ChartCard>
        <ChartCard title="Pengeluaran per Kategori" subtitle="Nominal & persentase biaya bulan ini">
          <HBarChart data={expCategories} format={(n, d) => d?.text ?? `${n}%`} />
        </ChartCard>
      </View>
    </View>
  );
}

