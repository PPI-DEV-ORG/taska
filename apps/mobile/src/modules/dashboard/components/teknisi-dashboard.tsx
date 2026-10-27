import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Panel, KpiCard, KpiRow, StatusBadge } from "@/components/taska/basics";
import { CheckCircle2, Calendar, Truck, Boxes, FolderKanban, ClipboardCheck } from "lucide-react-native";
import { tanggal } from "@/lib/format";
import { ROLE_LABEL } from "@/constants/modules";
import { DashboardGreeting } from "./dashboard-greeting";
import { QuickActionsCard } from "./quick-actions-card";

interface TeknisiDashboardProps {
  user: any;
  data: any;
  isMobile: boolean;
}

export function TeknisiDashboard({ user, data, isMobile }: TeknisiDashboardProps) {
  const router = useRouter();
  const role = user.role;

  const todayTasks = data.tasks.filter((t: any) => t.pic === user.name && t.status !== "DONE");
  const mySurveys = data.surveys.filter((s: any) => s.tim.includes(user.name));
  const activeSJ = data["delivery-notes"].filter((sj: any) => sj.pembuat === user.name && sj.status === "Dikirim");

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
          value={`${data.receiving.filter((r: any) => r.status === "Diterima").length} Batch`}
          hint="Siap pasang"
          icon={Boxes}
          onPress={() => router.push("/receiving")}
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
              {todayTasks.map((t: any) => (
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

