import * as React from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowDownToLine, ArrowUpFromLine, Plus } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { PageHeader } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { useApp } from "@/store/app-store";
import { rupiah, tanggal } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Row } from "@/constants/modules";

type PoType = "MASUK" | "KELUAR";
type Filter = "SEMUA" | PoType;

type PoItem = {
  key: string;
  type: PoType;
  module: "po-client" | "supplier-pos";
  id: string;
  number: string;
  /** Nomor dokumen internal bila beda dari nomor PO (mis. nomor SO untuk PO Masuk). */
  secondary?: string;
  party: string;
  total: number;
  date: string;
  status: string;
};

const TYPE_META: Record<PoType, { label: string; hint: string; tone: string; Icon: typeof ArrowDownToLine }> = {
  MASUK: {
    label: "PO Masuk",
    hint: "dari pelanggan",
    tone: "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
    Icon: ArrowDownToLine,
  },
  KELUAR: {
    label: "PO Keluar",
    hint: "ke pemasok",
    tone: "bg-sky-500/15 border-sky-500/40 text-sky-700 dark:text-sky-400",
    Icon: ArrowUpFromLine,
  },
};

const hasValue = (v: unknown) => v != null && String(v).trim() !== "" && String(v).trim() !== "-";

/**
 * Satu daftar PO: PO Masuk = pesanan pelanggan (Pesanan Penjualan yang punya nomor PO pelanggan),
 * PO Keluar = pesanan ke pemasok. Datanya tetap tinggal di modul masing-masing; layar ini hanya
 * menggabungkan tampilan + filter, jadi tidak ada salinan data.
 */
export default function PurchaseOrdersScreen() {
  const router = useRouter();
  const { data } = useApp();
  const [filter, setFilter] = React.useState<Filter>("SEMUA");
  const [query, setQuery] = React.useState("");

  const items: PoItem[] = React.useMemo(() => {
    const incoming: PoItem[] = ((data["po-client"] ?? []) as Row[])
      .filter((r) => hasValue(r.nomorPoClient))
      .map((r) => ({
        key: `in-${r.id}`,
        type: "MASUK" as const,
        module: "po-client" as const,
        id: String(r.id),
        number: String(r.nomorPoClient),
        secondary: hasValue(r.nomorSo) ? `SO ${r.nomorSo}` : undefined,
        party: String(r.customer ?? "-"),
        total: Number(r.total ?? r.nilai ?? 0),
        date: String(r.tanggal ?? ""),
        status: String(r.status ?? ""),
      }));
    const outgoing: PoItem[] = ((data["supplier-pos"] ?? []) as Row[]).map((r) => ({
      key: `out-${r.id}`,
      type: "KELUAR" as const,
      module: "supplier-pos" as const,
      id: String(r.id),
      number: String(r.nomor ?? ""),
      secondary: hasValue(r.request) ? `Request ${r.request}` : undefined,
      party: String(r.supplier ?? "-"),
      total: Number(r.total ?? 0),
      date: String(r.tanggal ?? ""),
      status: String(r.status ?? ""),
    }));
    return [...incoming, ...outgoing].sort((a, b) => b.date.localeCompare(a.date));
  }, [data]);

  const counts = React.useMemo(
    () => ({
      SEMUA: items.length,
      MASUK: items.filter((i) => i.type === "MASUK").length,
      KELUAR: items.filter((i) => i.type === "KELUAR").length,
    }),
    [items],
  );

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (filter === "SEMUA" || i.type === filter) &&
        (!q || `${i.number} ${i.secondary ?? ""} ${i.party} ${i.status}`.toLowerCase().includes(q)),
    );
  }, [items, filter, query]);

  const chips: { key: Filter; label: string }[] = [
    { key: "SEMUA", label: "Semua" },
    { key: "MASUK", label: "PO Masuk" },
    { key: "KELUAR", label: "PO Keluar" },
  ];

  return (
    <View className="gap-4">
      <PageHeader
        title="PO Masuk & Keluar"
        subtitle="PO Masuk dari pelanggan dan PO Keluar ke pemasok dalam satu daftar"
        action={
          <View className="flex-row gap-2">
            <Button size="sm" variant="outline" onPress={() => router.push("/po-client" as any)}>
              <Plus size={14} />
              <Text className="text-xs">Catat PO Masuk</Text>
            </Button>
            <Button size="sm" onPress={() => router.push("/supplier-pos" as any)}>
              <Plus size={14} color="#fff" />
              <Text className="text-xs font-semibold text-white">Buat PO Keluar</Text>
            </Button>
          </View>
        }
      />

      <View className="flex-row flex-wrap gap-2">
        {chips.map((c) => {
          const active = filter === c.key;
          return (
            <Pressable
              key={c.key}
              onPress={() => setFilter(c.key)}
              className={cn(
                "flex-row items-center gap-2 rounded-full border px-3.5 py-1.5",
                active ? "border-primary bg-primary" : "border-border bg-card",
              )}
            >
              <Text className={cn("text-sm font-semibold", active ? "text-white" : "text-foreground")}>{c.label}</Text>
              <View className={cn("rounded-full px-1.5", active ? "bg-white/25" : "bg-muted")}>
                <Text className={cn("text-[11px] font-bold", active ? "text-white" : "text-muted-foreground")}>
                  {counts[c.key]}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Input value={query} onChangeText={setQuery} placeholder="Cari nomor PO, pelanggan / pemasok, status..." />

      {visible.length === 0 ? (
        <View className="items-center rounded-xl border border-border bg-card p-8">
          <Text className="text-sm text-muted-foreground">
            {items.length === 0 ? "Belum ada PO." : "Tidak ada PO yang cocok dengan filter."}
          </Text>
        </View>
      ) : (
        <View className="gap-2.5">
          {visible.map((i) => {
            const meta = TYPE_META[i.type];
            return (
              <Pressable
                key={i.key}
                onPress={() => router.push(`/${i.module}/${i.id}` as any)}
                className="gap-2 rounded-xl border border-border bg-card p-4"
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="min-w-0 flex-1 gap-1">
                    <View className="flex-row flex-wrap items-center gap-2">
                      <View className={cn("flex-row items-center gap-1 rounded-full border px-2 py-0.5", meta.tone.split(" ").slice(0, 2).join(" "))}>
                        <meta.Icon size={11} />
                        <Text className={cn("text-[11px] font-bold", meta.tone.split(" ").slice(2).join(" "))}>
                          {meta.label}
                        </Text>
                      </View>
                      <Text className="text-[11px] text-muted-foreground">{meta.hint}</Text>
                    </View>
                    <Text className="text-base font-semibold" numberOfLines={1}>{i.number}</Text>
                    <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                      {i.party}
                      {i.secondary ? ` · ${i.secondary}` : ""}
                    </Text>
                  </View>
                  <View className="items-end gap-1.5">
                    <Text className="text-base font-bold">{rupiah(i.total)}</Text>
                    {i.status ? <StatusBadge status={i.status} /> : null}
                  </View>
                </View>
                {i.date ? <Text className="text-xs text-muted-foreground">{tanggal(i.date)}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
