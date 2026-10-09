import * as React from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Check, CheckSquare, Clock, ListChecks } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { PageHeader, Panel, Chip } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { useApp } from "@/store/app-store";
import { tanggal } from "@/lib/format";

import { FilterBar } from "@/components/taska/data-table";

export default function TasksScreen() {
  const router = useRouter();
  const { data, user, patchRow, toast } = useApp();

  const [q, setQ] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");

  const s = q.trim().toLowerCase();
  const tasks = data.tasks
    .filter((t) => !filterStatus || t.status === filterStatus)
    .filter((t) => !s || `${t.nama} ${t.project} ${t.pic}`.toLowerCase().includes(s));

  function toggleTask(id: string, currentStatus: string) {
    const next = currentStatus === "DONE" ? "IN PROGRESS" : "DONE";
    patchRow("tasks", id, { status: next });
    toast(`Tugas ditandai ${next}`);
  }

  return (
    <View className="gap-5">
      <PageHeader
        title="Daftar Tugas (Tasks)"
        subtitle="Pelacakan progres pekerjaan teknis dan software engineering"
      />

      <FilterBar
        search={q}
        onSearch={setQ}
        placeholder="Cari tugas, project, atau PIC..."
        statuses={["TODO", "IN PROGRESS", "BLOCKED", "DONE"]}
        status={filterStatus}
        onStatus={setFilterStatus}
      />

      <Panel title={`Tugas Terbuka (${tasks.length})`}>
        <View className="gap-2">
          {tasks.map((t) => (
            <View
              key={t.id}
              className={`border-border border-b py-3 last:border-b-0 ${
                t.parent ? "ml-6 pl-3 border-l-2 border-primary/40" : ""
              }`}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-sm font-semibold">{t.nama}</Text>
                  <Text className="text-text-secondary text-xs mt-0.5">
                    Project: {t.project} · PIC: {t.pic} · Tenggat: {tanggal(t.tenggat)}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <StatusBadge status={t.status} />
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => toggleTask(t.id, t.status)}
                  >
                    <Text className="text-xs">{t.status === "DONE" ? "Buka lagi" : "Tandai selesai"}</Text>
                  </Button>
                </View>
              </View>
            </View>
          ))}
        </View>
      </Panel>
    </View>
  );
}
