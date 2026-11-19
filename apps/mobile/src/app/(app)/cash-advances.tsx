import * as React from "react";
import { View, Pressable, ScrollView } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { ChevronRight, ClipboardCheck, Plus, Receipt, Wallet } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { EmptyState, PageHeader, Panel } from "@/components/akuntra/basics";
import { StatusBadge } from "@/components/akuntra/status-badge";
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
import {
  SpendPettyCashDialog,
  TopUpPettyCashDialog,
  WalletEntries,
  WalletHistoryDialog,
  useWalletHistory,
  type PettyWallet,
} from "@/modules/cash-advance/petty-cash-wallet";

const FILTERS: { key: "ALL" | CashAdvanceStatus | "AKTIF"; label: string; financeOnly?: boolean }[] = [
  { key: "AKTIF", label: "Perlu tindakan" },
  { key: "DIAJUKAN", label: "Menunggu persetujuan", financeOnly: true },
  { key: "DISETUJUI", label: "Menunggu pencairan", financeOnly: true },
  { key: "DICAIRKAN", label: "Belum dilaporkan" },
  { key: "DILAPORKAN", label: "Menunggu verifikasi" },
  { key: "SELESAI", label: "Selesai" },
  { key: "ALL", label: "Semua" },
];

/** Isi / tarik saldo tercatat di mutasi, bukan di daftar pengajuan. */
const isWalletDoc = (r: CashAdvance) => r.purpose === "ISI_SALDO" || r.purpose === "TARIK_SALDO";

export default function CashAdvancesScreen() {
  const { user } = useApp();
  const isFinance = useIsFinance();
  const params = useLocalSearchParams<{ id?: string }>();
  const [rows, setRows] = React.useState<CashAdvance[]>([]);
  const [employees, setEmployees] = React.useState<PettyWallet[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [version, setVersion] = React.useState(0);
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]["key"]>("AKTIF");
  const [mineOnly, setMineOnly] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [spendOpen, setSpendOpen] = React.useState(false);
  const [showAllMine, setShowAllMine] = React.useState(false);
  const [topUp, setTopUp] = React.useState<{ mode: "isi" | "tarik"; employee: { id: number; name: string } | null; available?: number } | null>(null);
  const [historyOf, setHistoryOf] = React.useState<{ id: number; name: string } | null>(null);
  const [detailId, setDetailId] = React.useState<number | null>(params.id ? Number(params.id) : null);

  const mine = useWalletHistory(null, version);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [list, w] = await Promise.all([
        api<{ items: CashAdvance[] }>("GET", `/cash-advances${mineOnly ? "?mine=1" : ""}`),
        api<{ mine: PettyWallet | null; employees: PettyWallet[] }>("GET", "/cash-advances/wallet"),
      ]);
      setRows((list.items ?? []).filter((r) => !isWalletDoc(r)));
      setEmployees(w?.employees ?? []);
    } catch {
      /* toast ditangani api */
    } finally {
      setLoading(false);
      setVersion((v) => v + 1);
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

  const w = mine.wallet;
  const pending = (w?.pendingSpend ?? 0) + (w?.pendingReport ?? 0);
  // Antrean Finance: laporan karyawan yang menunggu verifikasi (survey / pengiriman / proyek / lainnya)
  const toVerify = isFinance ? rows.filter((r) => r.status === "DILAPORKAN") : [];

  return (
    <View className="flex-1">
      <PageHeader
        title="Petty Cash"
        subtitle="Saldo kas kecil yang dipegang tiap karyawan"
        onRefresh={load}
        action={
          isFinance ? (
            <Button size="sm" onPress={() => setTopUp({ mode: "isi", employee: null })} className="flex-row items-center gap-1.5">
              <Plus size={14} color="#fff" />
              <Text className="text-xs font-semibold text-white">Isi Saldo Karyawan</Text>
            </Button>
          ) : undefined
        }
      />
      <ScrollView contentContainerClassName="p-4 gap-4" showsVerticalScrollIndicator={false}>
        {/* ── Antrean verifikasi (Finance): satu ketukan langsung ke mode pemeriksaan ── */}
        {toVerify.length > 0 ? (
          <View className="rounded-2xl border border-warning/50 bg-warning/5 p-4 gap-2">
            <View className="flex-row items-center gap-2">
              <ClipboardCheck size={16} color={colors.warning} />
              <Text className="text-sm font-semibold text-foreground">Laporan menunggu verifikasi ({toVerify.length})</Text>
            </View>
            {toVerify.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => setDetailId(r.id)}
                className="flex-row items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 active:opacity-75"
              >
                <View className="flex-1 min-w-0">
                  <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                    {r.employee.name} · {PURPOSE_LABEL[r.purpose]}
                  </Text>
                  <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                    {r.number} · {r.items.length} nota · {rupiah(r.reportedTotal)} dari {rupiah(r.disbursedAmount ?? 0)}
                  </Text>
                </View>
                <View className="flex-row items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5">
                  <Text className="text-xs font-semibold text-white">Periksa</Text>
                  <ChevronRight size={14} color="#fff" />
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* ── Saldo saya ── */}
        <View className="rounded-2xl border border-primary/30 bg-primary/5 p-4 gap-3">
          <View className="gap-0.5">
            <View className="flex-row items-center gap-2">
              <Wallet size={16} color={colors.primary} />
              <Text className="text-sm font-semibold text-foreground">Saldo petty cash saya</Text>
            </View>
            <Text className="text-3xl font-bold text-primary">{rupiah(w?.available ?? 0)}</Text>
            <Text className="text-xs text-muted-foreground">
              {pending > 0
                ? `Saldo ${rupiah(w?.balance ?? 0)} · ${rupiah(pending)} menunggu verifikasi Finance`
                : "Siap dipakai. Catat setiap pemakaian beserta foto nota."}
            </Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            <Button size="sm" onPress={() => setSpendOpen(true)} disabled={(w?.available ?? 0) <= 0}>
              <Receipt size={14} color="#fff" />
              <Text className="text-xs font-semibold text-white">Catat Pemakaian</Text>
            </Button>
            <Button size="sm" variant="outline" onPress={() => setCreateOpen(true)}>
              <Plus size={14} color={colors.text} />
              <Text className="text-xs">Ajukan untuk Tugas</Text>
            </Button>
          </View>
          {(w?.available ?? 0) <= 0 ? (
            <Text className="text-[11px] text-muted-foreground">
              Saldo kosong. Minta Finance mengisi saldo, atau ajukan petty cash untuk tugas tertentu (survey, kirim barang, proyek).
            </Text>
          ) : null}
        </View>

        {/* ── Mutasi saya ── */}
        <Panel
          title="Mutasi saldo saya"
          right={
            mine.entries.length > 6 ? (
              <Pressable onPress={() => setShowAllMine((v) => !v)}>
                <Text className="text-xs font-semibold text-primary">{showAllMine ? "Ringkas" : "Lihat semua"}</Text>
              </Pressable>
            ) : undefined
          }
        >
          {mine.loading ? <Text className="text-xs text-muted-foreground">Memuat...</Text> : <WalletEntries entries={mine.entries} limit={showAllMine ? undefined : 6} />}
        </Panel>

        {/* ── Saldo karyawan (Finance) ── */}
        {isFinance ? (
          <Panel title="Saldo petty cash karyawan" subtitle="Isi saldo, tarik sisa, dan lihat mutasi tiap karyawan">
            {employees.length === 0 ? (
              <Text className="text-xs text-muted-foreground">Belum ada karyawan yang memegang petty cash. Tekan tombol Isi Saldo Karyawan di atas.</Text>
            ) : (
              <View>
                {employees.map((e, i) => (
                  <View key={e.employee.id} className={`flex-row flex-wrap items-center gap-2 py-2.5 ${i > 0 ? "border-t border-border/60" : ""}`}>
                    <Pressable className="flex-1 min-w-[150px]" onPress={() => setHistoryOf({ id: e.employee.id, name: e.employee.name })}>
                      <Text className="text-sm font-medium text-foreground">{e.employee.name}</Text>
                      <Text className="text-[11px] text-muted-foreground">
                        Tersedia {rupiah(e.available)}
                        {e.pendingSpend + e.pendingReport > 0 ? ` · ${rupiah(e.pendingSpend + e.pendingReport)} menunggu verifikasi` : ""}
                      </Text>
                    </Pressable>
                    <Text className="text-sm font-bold text-foreground min-w-[96px] text-right">{rupiah(e.balance)}</Text>
                    <View className="flex-row gap-1.5">
                      <Button size="sm" variant="outline" className="h-8" onPress={() => setTopUp({ mode: "isi", employee: { id: e.employee.id, name: e.employee.name } })}>
                        <Text className="text-xs">Isi</Text>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        disabled={e.available <= 0}
                        onPress={() => setTopUp({ mode: "tarik", employee: { id: e.employee.id, name: e.employee.name }, available: e.available })}
                      >
                        <Text className="text-xs">Tarik</Text>
                      </Button>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Panel>
        ) : null}

        {/* ── Pengajuan untuk tugas (survey / kirim barang / proyek) ── */}
        {rows.length > 0 || isFinance ? (
          <Panel title="Pengajuan petty cash untuk tugas" subtitle="Survey, kirim / ambil barang, dan kas proyek">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5 pb-3">
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

            {visible.length === 0 ? (
              <EmptyState title={loading ? "Memuat..." : "Tidak ada pengajuan"} text={loading ? "" : "Pengajuan petty cash untuk tugas akan tampil di sini."} />
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
                        {r.project ? ` · ${r.project.name}` : ""}
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
          </Panel>
        ) : null}
      </ScrollView>

      <SpendPettyCashDialog open={spendOpen} onOpenChange={setSpendOpen} available={w?.available ?? 0} onSaved={() => void load()} />
      <TopUpPettyCashDialog
        mode={topUp?.mode ?? null}
        employee={topUp?.employee}
        available={topUp?.available}
        onOpenChange={(v) => !v && setTopUp(null)}
        onSaved={() => void load()}
      />
      <WalletHistoryDialog employee={historyOf} onOpenChange={(v) => !v && setHistoryOf(null)} />
      <CreateCashAdvanceDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => void load()} />
      <CashAdvanceDetailDialog id={detailId} onOpenChange={(v) => !v && setDetailId(null)} onChanged={() => void load()} />
    </View>
  );
}
