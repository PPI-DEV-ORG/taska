import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { CircleCheck } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Chip, EmptyState, PageHeader } from "@/components/taska/basics";
import { ApprovalBar } from "@/components/taska/dialogs";
import { useApp } from "@/store/app-store";
import { DataTable, FilterBar } from "@/components/taska/data-table";
import { CAN_APPROVE } from "@/mock/modules";
import { colors } from "@/tokens";
import { rupiah } from "@/lib/format";
import type { Col } from "@/mock/modules";

const APPROVAL_COLUMNS: Col[] = [
  { key: "judul", label: "Dokumen / Pengajuan", primary: true, flex: 1.8 },
  { key: "jenis", label: "Jenis", flex: 1 },
  { key: "pengaju", label: "Pengaju", flex: 1.2 },
  { key: "nilai", label: "Nilai (Rp)", fmt: "rupiah", flex: 1.2 },
  { key: "waktuTunggu", label: "Waktu Tunggu", flex: 1 },
  { key: "status", label: "Status", fmt: "status", flex: 1 },
];

export default function ApprovalsScreen() {
  const router = useRouter();
  const { approvals, decide, user } = useApp();
  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState("");
  const pending = approvals.filter((a) => a.status === "Menunggu");
  const types = Array.from(new Set(pending.map((a) => a.jenis)));
  const s = q.trim().toLowerCase();
  const list = pending
    .filter((a) => !type || a.jenis === type)
    .filter((a) => !s || `${a.judul} ${a.pengaju} ${a.jenis}`.toLowerCase().includes(s))
    .map((a) => ({
      ...a,
      waktuTunggu: a.jam >= 24 ? `${Math.round(a.jam / 24)} hari` : `${a.jam} jam`,
    }));

  const can = CAN_APPROVE.includes(user!.role);

  return (
    <>
      <PageHeader title="Persetujuan" subtitle={`${pending.length} dokumen menunggu`} />
      <FilterBar
        search={q}
        onSearch={setQ}
        placeholder="Cari pengajuan, nama, atau jenis..."
        statuses={types}
        status={type}
        onStatus={setType}
      />
      {list.length === 0 ? (
        <EmptyState icon={CircleCheck} title="Semua sudah beres" text="Tidak ada dokumen yang menunggu persetujuan Anda." />
      ) : (
        <DataTable
          columns={APPROVAL_COLUMNS}
          rows={list}
          pageSize={8}
          onRowPress={(r) => router.push((r.module === "opname" ? "/opname" : `/${r.module}/${r.refId}`) as any)}
          renderActions={(r) => (
            <View className="flex-row items-center gap-1.5">
              {can ? (
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
                  onPress={() => router.push((r.module === "opname" ? "/opname" : `/${r.module}/${r.refId}`) as any)}
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
