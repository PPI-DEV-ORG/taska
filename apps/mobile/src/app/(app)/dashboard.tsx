import * as React from "react";
import { View, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Command,
  FileSignature,
  FileText,
  FolderKanban,
  PackageCheck,
  Plus,
  ScanLine,
  Send,
  ShoppingCart,
  TrendingUp,
  Truck,
  Upload,
  Users,
  Wallet,
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import {
  PageHeader,
  KpiCard,
  KpiRow,
  Panel,
  SegmentedProgress,
  QuickActionButton,
} from "@/components/taska/basics";
import { BarChart, HBarChart, Funnel, ChartCard } from "@/components/taska/charts";
import { StatusBadge } from "@/components/taska/status-badge";
import { useApp } from "@/store/app-store";
import { ROLE_LABEL } from "@/mock/data";
import { rupiah, rupiahShort, tanggal } from "@/lib/format";
import { colors } from "@/tokens";
import { useBreakpoint } from "@/hooks/use-breakpoint";

function DashboardGreeting({ name, roleTitle }: { name: string; roleTitle: string }) {
  return (
    <View className="mb-2">
      <Text className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground">
        Welcome back, {name}.
      </Text>
      <Text className="text-muted-foreground text-sm md:text-base mt-1">
        Here&apos;s what happening with your projects today ({roleTitle}).
      </Text>
    </View>
  );
}

function ProjectOverviewCard({
  projects,
  onViewAll,
}: {
  projects: any[];
  onViewAll: () => void;
}) {
  const router = useRouter();
  return (
    <Panel
      title="Project Overview"
      subtitle="Track progress along all active projects"
      icon={FolderKanban}
      right={
        <Button variant="ghost" size="sm" onPress={onViewAll}>
          <Text className="text-primary text-xs font-semibold">Lihat Semua</Text>
        </Button>
      }
      className="flex-1"
    >
      <View className="gap-3">
        {projects.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => router.push(`/projects/${p.id}` as any)}
            className="bg-card hover:bg-panel border-border/70 flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border p-4 transition-colors"
          >
            <View className="flex-1 min-w-[180px]">
              <Text className="text-sm font-bold text-foreground" numberOfLines={1}>{p.nama}</Text>
              <View className="flex-row items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                <View className="flex-row items-center gap-1">
                  <Calendar size={13} color={colors.muted} />
                  <Text className="text-muted-foreground text-xs">{tanggal(p.selesai)}</Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <Users size={13} color={colors.muted} />
                  <Text className="text-muted-foreground text-xs">{p.pm}</Text>
                </View>
              </View>
            </View>

            <View className="flex-row items-center justify-between md:justify-end gap-4">
              <StatusBadge status={p.status} />
              <SegmentedProgress percent={p.progres ?? 60} />
            </View>
          </Pressable>
        ))}
      </View>
    </Panel>
  );
}

function QuickActionsCard({ role }: { role: string }) {
  const router = useRouter();
  return (
    <Panel
      title="Quick Actions"
      subtitle="Common Tasks and Workflows"
      icon={Command}
    >
      <View className="flex-row flex-wrap gap-3 py-1 w-full">
        {role === "bos" || role === "sales" ? (
          <QuickActionButton
            label="Buat Lead Baru"
            icon={Plus}
            shortcut="⌘L"
            className="flex-1 min-w-[170px]"
            onPress={() => router.push("/leads")}
          />
        ) : null}
        {role === "bos" || role === "pm" || role === "teknisi" ? (
          <QuickActionButton
            label="Request Barang"
            icon={ShoppingCart}
            shortcut="⌘R"
            className="flex-1 min-w-[170px]"
            onPress={() => router.push("/purchase-requests/new" as any)}
          />
        ) : null}
        {role === "gudang" || role === "teknisi" ? (
          <QuickActionButton
            label="Scan Serial Number"
            icon={ScanLine}
            shortcut="⌘S"
            className="flex-1 min-w-[170px]"
            onPress={() => router.push("/stock")}
          />
        ) : null}
        {role === "bos" || role === "finance" ? (
          <QuickActionButton
            label="Buat Invoice"
            icon={FileText}
            shortcut="⌘I"
            className="flex-1 min-w-[170px]"
            onPress={() => router.push("/invoices")}
          />
        ) : null}
        {role === "teknisi" || role === "gudang" || role === "pm" ? (
          <QuickActionButton
            label="Buat Surat Jalan"
            icon={Truck}
            shortcut="⌘J"
            className="flex-1 min-w-[170px]"
            onPress={() => router.push("/delivery-notes/new" as any)}
          />
        ) : null}
        {role === "finance" || role === "bos" ? (
          <QuickActionButton
            label="Approval Center"
            icon={ClipboardCheck}
            shortcut="⌘A"
            className="flex-1 min-w-[170px]"
            onPress={() => router.push("/approvals")}
          />
        ) : null}
        <QuickActionButton
          label="Lihat Stok Gudang"
          icon={Boxes}
          shortcut="⌘G"
          className="flex-1 min-w-[170px]"
          onPress={() => router.push("/stock")}
        />
      </View>
    </Panel>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user, data, approvals, decide } = useApp();
  const { isMobile } = useBreakpoint();

  if (!user) return null;

  const role = user.role;

  // 1. ADMIN / BOS
  if (role === "bos") {
    const pipelineVal = data.leads
      .filter((l) => l.status !== "Lost" && l.status !== "Won")
      .reduce((acc, l) => acc + (l.nilai || 0), 0);
    const activeProjects = data.projects.filter((p) => p.status === "Berjalan");
    const unpaidInv = data.invoices
      .filter((i) => i.status !== "Lunas")
      .reduce((acc, i) => acc + (i.total - i.terbayar), 0);
    const pendingApprovals = approvals.filter((a) => a.status === "Menunggu");

    const funnelData = [
      { label: "Prospecting", value: data.leads.filter((l) => l.status === "Prospecting").length },
      { label: "Qualification", value: data.leads.filter((l) => l.status === "Qualification").length },
      { label: "Proposal", value: data.leads.filter((l) => l.status === "Proposal").length },
      { label: "Negotiation", value: data.leads.filter((l) => l.status === "Negotiation").length },
      { label: "Won", value: data.leads.filter((l) => l.status === "Won").length },
    ];

    const revenueBars = [
      { label: "Jul", values: [180, 160] },
      { label: "Agu", values: [240, 210] },
      { label: "Sep", values: [310, 280] },
      { label: "Okt", values: [270, 190] },
    ];

    const riskyProjects = data.projects.filter(
      (p) => p.status === "Terlambat" || p.pembayaran === "Belum lunas"
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
                {pendingApprovals.slice(0, 3).map((a) => (
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
            {riskyProjects.slice(0, 3).map((p) => (
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
            {data["audit-log"].slice(0, 4).map((al) => (
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

  // 2. SALES
  if (role === "sales") {
    const newLeads = data.leads.filter((l) => l.status === "Prospecting").length;
    const activeLeads = data.leads.filter((l) => l.status !== "Won" && l.status !== "Lost").length;
    const sentQuotes = data.quotations.filter((q) => q.status === "Terkirim").length;
    const wonThisMonth = data.leads.filter((l) => l.status === "Won").length;

    const idleLeads = data.leads.filter((l) => l.sepi > 7 && l.status !== "Lost" && l.status !== "Won");
    const expiringQuotes = data.quotations.filter((q) => q.status === "Terkirim");

    const sources = [
      { label: "Referral", value: 4 },
      { label: "Sosial media", value: 3 },
      { label: "Website", value: 2 },
      { label: "Event", value: 2 },
      { label: "Distributor", value: 2 },
      { label: "Cold call", value: 2 },
    ];

    const lostReasons = [
      { label: "Belum ada follow-up", value: 1, color: colors.danger },
      { label: "Client tidak ada kabar", value: 1, color: colors.danger },
      { label: "Harga tidak cocok", value: 0, color: colors.warning },
    ];

    return (
      <View className="gap-6">
        <DashboardGreeting name={user.name} roleTitle={ROLE_LABEL[role]} />

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
                {idleLeads.slice(0, 2).map((l) => (
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
                {expiringQuotes.slice(0, 1).map((q) => (
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

  // 3. PROJECT MANAGER (PM)
  if (role === "pm") {
    const myProjects = data.projects.filter((p) => p.pm === user.name);
    const activeSurveys = data.surveys.filter((s) => s.status === "Berjalan" || s.status === "Dijadwalkan").length;
    const pendingReqs = data["purchase-requests"].filter((r) => r.status === "Diajukan" || r.status === "Cek stok").length;
    const delayedTasks = data.tasks.filter((t) => t.status === "BLOCKED").length;

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
                <View className="bg-card border-border/70 rounded-xl border p-3.5 gap-2">
                  <Text className="text-sm font-bold text-foreground">Lead Won Siap Jadi Project</Text>
                  <Text className="text-muted-foreground text-xs">
                    Access Control Hotel Grand Mahkota sudah bayar DP dan siap dialokasikan tim lapangan.
                  </Text>
                  <Button size="sm" className="mt-1 h-8" onPress={() => router.push("/projects")}>
                    <Text className="text-xs">Buka & Setup Project</Text>
                  </Button>
                </View>
                <View className="bg-card border-border/70 rounded-xl border p-3.5 gap-2">
                  <Text className="text-sm font-bold text-foreground">Kekurangan Material Lapangan</Text>
                  <Text className="text-muted-foreground text-xs">
                    Kekurangan 6x Reader Fingerprint di Project Hotel. Ajukan request sekarang.
                  </Text>
                  <Button variant="outline" size="sm" className="mt-1 h-8" onPress={() => router.push("/purchase-requests/new" as any)}>
                    <Text className="text-xs">Buat Request Barang</Text>
                  </Button>
                </View>
              </View>
            </Panel>
          </View>
        </View>

        <QuickActionsCard role={role} />
      </View>
    );
  }

  // 4. TEKNISI
  if (role === "teknisi") {
    const todayTasks = data.tasks.filter((t) => t.pic === user.name && t.status !== "DONE");
    const mySurveys = data.surveys.filter((s) => s.tim.includes(user.name));
    const activeSJ = data["delivery-notes"].filter((sj) => sj.pembuat === user.name && sj.status === "Dikirim");

    return (
      <View className="gap-6">
        <DashboardGreeting name={user.name} roleTitle={ROLE_LABEL[role]} />

        <KpiRow>
          <KpiCard
            label="Tugas Hari Ini"
            value={String(todayTasks.length)}
            hint="Target penyelesaian"
            icon={CheckCircle2}
          />
          <KpiCard
            label="Survey Terjadwal"
            value={String(mySurveys.length)}
            hint="Lokasi luar kantor"
            icon={Calendar}
            onPress={() => router.push("/surveys")}
          />
          <KpiCard
            label="Surat Jalan Aktif"
            value={String(activeSJ.length)}
            hint="Material dalam perjalanan"
            icon={Truck}
            onPress={() => router.push("/delivery-notes")}
          />
          <KpiCard
            label="Material Ready"
            value="3 Unit"
            hint="Siap pasang"
            icon={Boxes}
          />
        </KpiRow>

        <View className={isMobile ? "gap-6" : "flex-row gap-6 items-start"}>
          <View className={isMobile ? "w-full" : "flex-[1.5]"}>
            <Panel
              title="Daftar Tugas Lapangan"
              subtitle="Pekerjaan instalasi & maintenance aktif"
              icon={FolderKanban}
            >
              <View className="gap-3">
                {todayTasks.map((t) => (
                  <View key={t.id} className="bg-card border-border/70 rounded-xl border p-4 gap-2">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm font-bold text-foreground flex-1 pr-2">{t.nama}</Text>
                      <StatusBadge status={t.status} />
                    </View>
                    <Text className="text-muted-foreground text-xs">
                      Project: {t.project} · Tenggat: {tanggal(t.tenggat)}
                    </Text>
                    <View className="flex-row gap-2 mt-2">
                      <Button size="sm" className="flex-1 h-8" onPress={() => router.push(`/projects/${t.project}` as any)}>
                        <Text className="text-xs">Mulai Kerja</Text>
                      </Button>
                      <Button variant="outline" size="sm" className="h-8" onPress={() => router.push("/expenses/new" as any)}>
                        <Text className="text-xs">Catat Bensin/Makan</Text>
                      </Button>
                    </View>
                  </View>
                ))}
                {todayTasks.length === 0 ? (
                  <Text className="text-muted-foreground py-6 text-center text-xs">Semua tugas lapangan selesai.</Text>
                ) : null}
              </View>
            </Panel>
          </View>

          <View className={isMobile ? "w-full" : "flex-1"}>
            <Panel
              title="Panduan & Tindakan Lapangan"
              subtitle="Kelengkapan dokumen BAST dan bukti operasional"
              icon={ClipboardCheck}
            >
              <View className="gap-3">
                <View className="bg-card border-border/70 rounded-xl border p-3.5 gap-2">
                  <Text className="text-sm font-bold text-foreground">Serah Terima & BAST</Text>
                  <Text className="text-muted-foreground text-xs">
                    Pastikan foto dokumentasi unit terpasang dan minta tanda tangan client saat selesai.
                  </Text>
                  <Button size="sm" className="mt-1 h-8" onPress={() => router.push("/delivery-notes/new" as any)}>
                    <Text className="text-xs">Buat Surat Jalan</Text>
                  </Button>
                </View>
                <View className="bg-card border-border/70 rounded-xl border p-3.5 gap-2">
                  <Text className="text-sm font-bold text-foreground">Reimbursement Operasional</Text>
                  <Text className="text-muted-foreground text-xs">
                    Simpan struk parkir/bensin fisik dan foto langsung lewat formulir pengeluaran.
                  </Text>
                  <Button variant="outline" size="sm" className="mt-1 h-8" onPress={() => router.push("/expenses/new" as any)}>
                    <Text className="text-xs">Klaim Pengeluaran</Text>
                  </Button>
                </View>
              </View>
            </Panel>
          </View>
        </View>

        <QuickActionsCard role={role} />
      </View>
    );
  }

  // 5. PROCUREMENT
  if (role === "procurement") {
    const pendingReqs = data["purchase-requests"].filter((r) => r.status === "Diajukan" || r.status === "Cek stok").length;
    const activePos = data["supplier-pos"].filter((p) => p.status !== "Sampai").length;
    const onShipping = data["supplier-pos"].filter((p) => p.pengiriman === "Dikirim").length;
    const waitReceiving = data.receiving.filter((r) => r.status === "Menunggu penerimaan").length;

    const purchasesByMonth = [
      { label: "Jul", values: [45] },
      { label: "Agu", values: [88] },
      { label: "Sep", values: [62] },
      { label: "Okt", values: [145] },
    ];

    return (
      <View className="gap-6">
        <DashboardGreeting name={user.name} roleTitle={ROLE_LABEL[role]} />

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
              onViewAll={() => router.push("/projects")}
            />
          </View>

          <View className={isMobile ? "w-full" : "flex-1"}>
            <Panel
              title="Peringatan Pengadaan & Supplier"
              subtitle="Cek ketersediaan stok internal & status PO supplier"
              icon={PackageCheck}
            >
              <View className="gap-3">
                <View className="bg-card border-border/70 rounded-xl border p-3.5 gap-2">
                  <Text className="text-sm font-bold text-foreground">Cek Stok: Reader Fingerprint</Text>
                  <Text className="text-muted-foreground text-xs">
                    RB/2026/10/011 diajukan untuk 6 unit. Cek ketersediaan di Gudang Bekasi sebelum PO baru.
                  </Text>
                  <Button size="sm" className="mt-1 h-8" onPress={() => router.push("/stock")}>
                    <Text className="text-xs">Cek Ketersediaan Stok</Text>
                  </Button>
                </View>
                <View className="bg-card border-border/70 rounded-xl border p-3.5 gap-2">
                  <Text className="text-sm font-bold text-foreground">PO Supplier Terlambat</Text>
                  <Text className="text-muted-foreground text-xs">
                    PO/2026/09/031 (PT Hikvision) terlambat 3 hari dari estimasi tiba di Gudang Jakarta.
                  </Text>
                  <Button variant="outline" size="sm" className="mt-1 h-8" onPress={() => router.push("/supplier-pos/SP-003" as any)}>
                    <Text className="text-xs">Update Status Pengiriman</Text>
                  </Button>
                </View>
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

  // 6. FINANCE
  if (role === "finance") {
    const pendingApprovals = approvals.filter((a) => a.status === "Menunggu");
    const dueInvoices = data.invoices.filter((i) => i.status === "Terlambat").length;
    const totalPiutang = data.invoices
      .filter((i) => i.status !== "Lunas")
      .reduce((acc, i) => acc + (i.total - i.terbayar), 0);
    const pendingReimb = data.expenses.filter((e) => e.status === "Disetujui").length;

    const agingData = [
      { label: "0–30 hari", value: 180, color: colors.success },
      { label: "31–60 hari", value: 120, color: colors.warning },
      { label: "60+ hari", value: 227, color: colors.danger },
    ];

    const expCategories = [
      { label: "Transport & Bensin", value: 45 },
      { label: "Perlengkapan", value: 85 },
      { label: "Makan & Lembur", value: 20 },
      { label: "Penginapan", value: 30 },
    ];

    return (
      <View className="gap-6">
        <DashboardGreeting name={user.name} roleTitle={ROLE_LABEL[role]} />

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
                {pendingApprovals.slice(0, 2).map((a) => (
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
          <ChartCard title="Pengeluaran per Kategori" subtitle="Persentase biaya bulan ini">
            <HBarChart data={expCategories} format={(n) => `${n}%`} />
          </ChartCard>
        </View>
      </View>
    );
  }

  // 7. GUDANG
  if (role === "gudang") {
    const waitReceive = data.receiving.filter((r) => r.status !== "Diterima").length;
    const lowStock = 2;
    const todaySJ = data["delivery-notes"].filter((sj) => sj.status === "Pending").length;
    const opnameDiff = 3;

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
            tone="warning"
            icon={Truck}
            onPress={() => router.push("/delivery-notes")}
          />
          <KpiCard
            label="Opname Discrepancy"
            value={`-${opnameDiff}`}
            hint="Selisih fisik vs sistem"
            tone="warning"
            icon={Boxes}
            onPress={() => router.push("/opname")}
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
              subtitle="Penerimaan barang dan verifikasi Serial Number"
              icon={PackageCheck}
            >
              <View className="gap-3">
                <View className="bg-card border-border/70 rounded-xl border p-3.5 gap-2">
                  <Text className="text-sm font-bold text-foreground">Kiriman Tiba: Switch PoE</Text>
                  <Text className="text-muted-foreground text-xs">
                    TB/2026/10/004 dari Hikvision tiba di Gudang Jakarta. Siap scan barcode SN.
                  </Text>
                  <Button size="sm" className="mt-1 h-8" onPress={() => router.push("/receiving/new" as any)}>
                    <Text className="text-xs">Terima & Scan Unit</Text>
                  </Button>
                </View>
                <View className="bg-card border-border/70 rounded-xl border p-3.5 gap-2">
                  <Text className="text-sm font-bold text-foreground">Surat Jalan Keluar Pending</Text>
                  <Text className="text-muted-foreground text-xs">
                    SJ/2026/10/031 pending: Teknisi membawa 4x Reader Fingerprint ke lokasi.
                  </Text>
                  <Button variant="outline" size="sm" className="mt-1 h-8" onPress={() => router.push("/delivery-notes/SJ-001" as any)}>
                    <Text className="text-xs">Scan Keluar Barang</Text>
                  </Button>
                </View>
              </View>
            </Panel>
          </View>
        </View>

        <QuickActionsCard role={role} />
      </View>
    );
  }

  // 8. SOFTWARE ENGINEER (SE)
  if (role === "se") {
    const myProjects = data.projects.filter((p) => p.tim.includes(user.name));
    const openTasks = data.tasks.filter((t) => t.pic === user.name && t.status !== "DONE");
    const blockedTasks = data.tasks.filter((t) => t.pic === user.name && t.status === "BLOCKED");

    return (
      <View className="gap-6">
        <DashboardGreeting name={user.name} roleTitle={ROLE_LABEL[role]} />

        <KpiRow>
          <KpiCard
            label="Internal Projects"
            value={String(myProjects.length)}
            hint="R&D dan integrasi sistem"
            icon={FolderKanban}
            onPress={() => router.push("/projects")}
          />
          <KpiCard
            label="Open Issues"
            value={String(openTasks.length)}
            hint="Tugas sprint berjalan"
            icon={CheckCircle2}
            onPress={() => router.push("/tasks")}
          />
          <KpiCard
            label="Blocked Issues"
            value={String(blockedTasks.length)}
            hint="Perlu koordinasi PIC"
            tone="danger"
            icon={AlertTriangle}
            onPress={() => router.push("/tasks")}
          />
          <KpiCard
            label="PRD Documents"
            value="2 Specs"
            hint="Spesifikasi teknis siap"
            icon={FileText}
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
              title="Prioritas Sprint & Bug Teknis"
              subtitle="Code reviews & deliverable sprint aktif"
              icon={CheckCircle2}
            >
              <View className="gap-3">
                {openTasks.slice(0, 2).map((t) => (
                  <View key={t.id} className="bg-card border-border/70 rounded-xl border p-3.5 gap-2">
                    <Text className="text-sm font-bold text-foreground" numberOfLines={1}>{t.nama}</Text>
                    <Text className="text-muted-foreground text-xs">
                      Tenggat: {tanggal(t.tenggat)} · Status: {t.status}
                    </Text>
                    <Button size="sm" className="mt-1 h-8" onPress={() => router.push(`/projects/${t.project}` as any)}>
                      <Text className="text-xs">Tandai Selesai</Text>
                    </Button>
                  </View>
                ))}
              </View>
            </Panel>
          </View>
        </View>

        <QuickActionsCard role={role} />
      </View>
    );
  }

  return null;
}
