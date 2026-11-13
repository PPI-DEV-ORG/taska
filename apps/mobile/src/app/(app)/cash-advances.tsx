import * as React from "react";
import { View, Pressable, ScrollView } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Plus, Wallet } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { EmptyState, PageHeader, Panel } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { useApp } from "@/store/app-store";
import { api } from "@/services/api";
import { colors } from "@/tokens";
import { rupiah, tanggal } from "@/lib/format";
import {
  CashAdvanceDetailDialog,
  CreateCashAdvanceDialog,
  PURPOSE_LABEL,
  STATUS_LABEL,
  useIsFinance,
  type CashAdvance,
  type CashAdvanceStatus,
} from "@/modules/cash-advance/cash-advance-dialogs";

type WalletRow = { employee: { id: number; name: string; role: string }; balance: number; pendingReport: number; available: number; activeCount: number };

const FILTERS: { key: "ALL" | CashAdvanceStatus | "AKTIF"; label: string; financeOnly?: boolean }[] = [
  { key: "AKTIF", label: "Perlu tindakan" },
  { key: "DIAJUKAN", label: "Menunggu persetujuan", financeOnly: true },
  { key: "DISETUJUI", label: "Menunggu pencairan", financeOnly: true },
  { key: "DICAIRKAN", label: "Belum dilaporkan" },
  { key: "DILAPORKAN", label: "Menunggu verifikasi" },
  { key: "SELESAI", label: "Selesai" },
  { key: "ALL", label: "Semua" },
];

export default function CashAdvancesScreen() {
  const { user } = useApp();
  const isFinance = useIsFinance();
  const params = useLocalSearchParams<{ id?: string }>();
  const [rows, setRows] = React.useState<CashAdvance[]>([]);
  const [wallet, setWallet] = React.useState<{ mine: WalletRow | null; employees: WalletRow[] }>({ mine: null, employees: [] });
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]["key"]>("AKTIF");
  const [mineOnly, setMineOnly] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState<number | null>(params.id ? Number(params.id) : null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [list, w] = await Promise.all([
        api<{ items: CashAdvance[] }>("GET", `/cash-advances${mineOnly ? "?mine=1" : ""}`),
        api<{ mine: WalletRow | null; employees: WalletRow[] }>("GET", "/cash-advances/wallet"),
      ]);
      setRows(list.items ?? []);
      setWallet(w ?? { mine: null, employees: [] });
    } catch {
      /* toast ditangani api */
    } finally {
      setLoading(false);
    }
  }, [mineOnly]);

  useFocusEffect(
    React.useCallback(() => {
      void load();
    }, [load]),
  );

  // "Perlu tindakan": untuk Finance = menunggu persetujuan/pencairan/verifikasi; untuk karyawan = yang harus dilaporkan
  const visible = rows.filter((r) => {
    if (filter === "ALL") return true;
    if (filter === "AKTIF") {
      if (isFinance) return ["DIAJUKAN", "DISETUJUI", "DILAPORKAN"].includes(r.status) || (r.employeeId === Number(user?.id) && r.status === "DICAIRKAN");
      return ["DIAJUKAN", "DISETUJUI", "DICAIRKAN"].includes(r.status);
    }
    return r.status === filter;
  });

  const countFor = (key: (typeof FILTERS)[number]["key"]) =>
    key === "ALL" ? rows.length : key === "AKTIF" ? undefined : rows.filter((r) => r.status === key).length;

  return (
    <View className="flex-1">
      <PageHeader
        title="Uang Jalan"
        subtitle="Ajukan biaya survey / pengiriman barang, terima dari Finance, lalu laporkan pemakaiannya"
        onRefresh={load}
        action={
          <Button size="sm" onPress={() => setCreateOpen(true)} className="flex-row items-center gap-1.5">
            <Plus size={14} color="#fff" />
            <Text className="text-xs font-semibold text-white">Ajukan Uang Jalan</Text>
          </Button>
        }
      />
      <ScrollView contentContainerClassName="p-4 gap-4" showsVerticalScrollIndicator={false}>
        {/* Kantong saya */}
        <View className="rounded-xl border border-primary/30 bg-primary/5 p-4 gap-1">
          <View className="flex-row items-center gap-2">
            <Wallet size={16} color={colors.primary} />
            <Text className="text-sm font-bold text-foreground">Kantong uang jalan saya</Text>
          </View>
          <Text className="text-2xl font-bold text-primary">{rupiah(wallet.mine?.balance ?? 0)}</Text>
          <Text className="text-[11px] text-muted-foreground">
            {wallet.mine && wallet.mine.pendingReport > 0
              ? `Sudah dipakai (dilaporkan, menunggu verifikasi): ${rupiah(wallet.mine.pendingReport)} · sisa ${rupiah(wallet.mine.available)}`
              : "Uang jalan yang sudah diterima dari Finance dan belum diselesaikan laporannya."}
          </Text>
        </View>

        {/* Kantong karyawan (Finance) */}
        {isFinance && wallet.employees.length > 0 ? (
          <Panel title="Kantong uang jalan karyawan" subtitle="Saldo uang muka yang masih dipegang karyawan (akun 1107)">
            <View className="gap-1.5">
              {wallet.employees.map((w) => (
                <View key={w.employee.id} className="flex-row items-center justify-between py-1 border-b border-border/40">
                  <View className="flex-1">
                    <Text className="text-xs font-semibold text-foreground">{w.employee.name}</Text>
                    <Text className="text-[10px] text-muted-foreground">
                      {w.activeCount} uang jalan aktif{w.pendingReport > 0 ? ` · dilaporkan ${rupiah(w.pendingReport)}` : ""}
                    </Text>
                  </View>
                  <Text className="text-sm font-bold text-foreground">{rupiah(w.balance)}</Text>
                </View>
              ))}
            </View>
          </Panel>
        ) : null}

        {/* Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5">
          {FILTERS.filter((f) => !f.financeOnly || isFinance).map((f) => {
            const active = filter === f.key;
            const c = countFor(f.key);
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                className={`px-3 py-1.5 rounded-full border ${active ? "bg-primary border-primary" : "bg-background border-border"}`}
              >
                <Text className={`text-xs ${active ? "text-white font-semibold" : "text-foreground"}`}>
                  {f.label}
                  {c ? ` (${c})` : ""}
                </Text>
              </Pressable>
            );
          })}
          {isFinance ? (
            <Pressable
              onPress={() => setMineOnly((v) => !v)}
              accessibilityRole="switch"
              accessibilityState={{ checked: mineOnly }}
              className={`px-3 py-1.5 rounded-full border ${mineOnly ? "bg-foreground border-foreground" : "bg-background border-border"}`}
            >
              <Text className={`text-xs ${mineOnly ? "text-background font-semibold" : "text-foreground"}`}>Milik saya saja</Text>
            </Pressable>
          ) : null}
        </ScrollView>

        {/* Daftar */}
        {visible.length === 0 ? (
          <EmptyState
            title={loading ? "Memuat..." : "Belum ada uang jalan"}
            text={loading ? "" : "Ajukan uang jalan sebelum berangkat survey atau mengirim / mengambil barang."}
          />
        ) : (
          <View className="gap-2">
            {visible.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => setDetailId(r.id)}
                accessibilityRole="button"
                className="rounded-xl border border-border bg-card p-3 gap-1 active:opacity-80"
              >
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="text-sm font-bold text-foreground">{r.number}</Text>
                  <StatusBadge status={STATUS_LABEL[r.status]} />
                </View>
                <Text className="text-xs text-foreground" numberOfLines={2}>
                  {PURPOSE_LABEL[r.purpose]} — {r.description}
                </Text>
                <View className="flex-row flex-wrap items-center justify-between gap-2">
                  <Text className="text-[11px] text-muted-foreground">
                    {r.employee.name} · {tanggal(r.createdAt)}
                    {r.survey ? ` · Survey ${r.survey.lead?.name ?? r.survey.location}` : ""}
                    {r.deliveryNote ? ` · ${r.deliveryNote.number}` : ""}
                  </Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {rupiah(r.disbursedAmount ?? r.approvedAmount ?? r.amount)}
                    {["DICAIRKAN", "DILAPORKAN"].includes(r.status) && r.reportedTotal > 0 ? (
                      <Text className="text-[11px] text-muted-foreground"> · dipakai {rupiah(r.reportedTotal)}</Text>
                    ) : null}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <CreateCashAdvanceDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => void load()} />
      <CashAdvanceDetailDialog id={detailId} onOpenChange={(v) => !v && setDetailId(null)} onChanged={() => void load()} />
    </View>
  );
}
