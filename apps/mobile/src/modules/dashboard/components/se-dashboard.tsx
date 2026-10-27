import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Panel, KpiCard, KpiRow } from "@/components/taska/basics";
import { FolderKanban, CheckCircle2, AlertTriangle, FileText } from "lucide-react-native";
import { tanggal } from "@/lib/format";
import { ROLE_LABEL } from "@/constants/modules";
import { DashboardGreeting } from "./dashboard-greeting";
import { ProjectOverviewCard } from "./project-overview-card";
import { QuickActionsCard } from "./quick-actions-card";

interface SeDashboardProps {
  user: any;
  data: any;
  isMobile: boolean;
}

export function SeDashboard({ user, data, isMobile }: SeDashboardProps) {
  const router = useRouter();
  const role = user.role;

  const myProjects = data.projects.filter((p: any) => p.tim.includes(user.name));
  const openTasks = data.tasks.filter((t: any) => t.pic === user.name && t.status !== "DONE");
  const blockedTasks = data.tasks.filter((t: any) => t.pic === user.name && t.status === "BLOCKED");

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
          label="Completed Tasks"
          value={String(data.tasks.filter((t: any) => t.pic === user.name && t.status === "DONE").length)}
          hint="Tugas telah selesai"
          icon={FileText}
          onPress={() => router.push("/tasks")}
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
              {openTasks.slice(0, 2).map((t: any) => (
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

