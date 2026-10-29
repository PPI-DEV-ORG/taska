import * as React from "react";
import { View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { CircleCheck } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { EmptyState, PageHeader } from "@/components/taska/basics";
import { useApp } from "@/store/app-store";
import { DataTable, FilterBar } from "@/components/taska/data-table";
import { CAN_APPROVE, Row, type Col } from "@/constants/modules";
import { rupiah, compareDesc } from "@/lib/format";

const APPROVAL_COLUMNS: Col[] = [
  { key: "judul", label: "Dokumen / Pengajuan", primary: true, flex: 1.8 },
  { key: "jenis", label: "Jenis", flex: 1 },
  { key: "pengaju", label: "Pengaju", flex: 1.2 },
  { key: "displayNilai", label: "Nilai / Jumlah", flex: 1.2 },
  { key: "waktuTunggu", label: "Waktu Tunggu", flex: 1 },
  { key: "status", label: "Status", fmt: "status", flex: 1 },
];

export default function ApprovalsScreen() {
  const router = useRouter();
  const { approvals, refreshApprovals, decide, user, data } = useApp();
  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("Semua");

  useFocusEffect(
    React.useCallback(() => {
      void refreshApprovals();
    }, [refreshApprovals]),
  );

  const pendingCount = approvals.filter((a) => a.status === "Menunggu").length;
  const types = Array.from(new Set(approvals.map((a) => a.jenis)));
  const s = q.trim().toLowerCase();

  const list = approvals
    .map((a) => {
      let pengaju = a.pengaju;
      if (!pengaju || pengaju === "-") {
        const entity = (data[a.module] ?? []).find((r: Row) => String(r.id) === String(a.refId));
        if (entity) {
          pengaju =
            entity.pelapor ||
            entity.pembuat ||
            entity.creator ||
            entity.requester ||
            entity.sales ||
            entity.pj ||
            entity.pm ||
            "";
        }
      }
      return {
        ...a,
        pengaju: pengaju || "-",
        displayNilai: a.module === "opname" ? `${a.nilai} SKU selisih` : rupiah(a.nilai),
        waktuTunggu: a.jam >= 24 ? `${Math.round(a.jam / 24)} hari` : `${a.jam} jam`,
      };
    })
    .filter((a) => (statusFilter === "Semua" ? true : a.status === statusFilter))
    .filter((a) => !type || a.jenis === type)
    .filter((a) => !s || `${a.judul} ${a.pengaju} ${a.jenis} ${a.status}`.toLowerCase().includes(s))
    .sort(compareDesc);

  const can = CAN_APPROVE.includes(user!.role);

  return (
    <>
      <PageHeader
        title="Persetujuan"
        subtitle={`${pendingCount} menunggu | Total ${approvals.length} pengajuan`}
        onRefresh={refreshApprovals}
      />
      <View className="flex-row items-center gap-1.5 mb-2">
        {["Semua", "Menunggu", "Disetujui", "Ditolak"].map((st) => (
          <Button
            key={st}
            size="sm"
            variant={statusFilter === st ? "default" : "outline"}
            className="h-7 px-2.5 text-xs"
            onPress={() => setStatusFilter(st)}
          >
            <Text className="text-xs">
              {st === "Menunggu" && pendingCount > 0 ? `${st} (${pendingCount})` : st}
            </Text>
          </Button>
        ))}
      </View>
      <FilterBar
        search={q}
        onSearch={setQ}
        placeholder="Cari pengajuan, nama, atau jenis..."
        statuses={types}
        status={type}
        onStatus={setType}
      />
      {list.length === 0 ? (
        <EmptyState icon={CircleCheck} title="Tidak ada data" text="Tidak ada dokumen persetujuan yang cocok dengan filter." />
      ) : (
        <DataTable
          columns={APPROVAL_COLUMNS}
          rows={list}
          pageSize={8}
          onRowPress={(r) => router.push(`/${r.module}/${r.refId}` as any)}
          renderActions={(r) => (
            <View className="flex-row items-center gap-1.5">
              {r.status === "Disetujui" ? (
                <View className="bg-emerald-500/15 border border-emerald-500/30 rounded-md px-2 py-1">
                  <Text className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    ✓ Disetujui
                  </Text>
                </View>
              ) : r.status === "Ditolak" ? (
                <View className="bg-destructive/15 border border-destructive/30 rounded-md px-2 py-1">
                  <Text className="text-[11px] font-semibold text-destructive">
                    ✗ Ditolak
                  </Text>
                </View>
              ) : can ? (
                <>
                  <Button
                    size="sm"
                    className="h-7 px-2 bg-success hover:bg-success/90"
                    onPress={() => decide(r.id, "Disetujui")}
                  >
                    <Text className="text-[11px] font-bold text-white">Setujui</Text>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 border-danger/60"
                    onPress={() => decide(r.id, "Ditolak", "Ditolak dari tabel")}
                  >
                    <Text className="text-[11px] font-medium text-danger">Tolak</Text>
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onPress={() => router.push(`/${r.module}/${r.refId}` as any)}
                >
                  <Text className="text-primary text-[11px]">Buka</Text>
                </Button>
              )}
            </View>
          )}
        />
      )}
    </>
  );
}
