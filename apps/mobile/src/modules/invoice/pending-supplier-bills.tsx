import * as React from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronDown, ChevronUp, FileClock } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { rupiah } from "@/lib/format";
import type { Row } from "@/constants/modules";

/**
 * "Tagihan supplier belum dicatat": setiap PO yang sudah disetujui otomatis muncul di sini sampai tagihannya
 * dicatat penuh (DPP tagihan = DPP PO). Bukan tagihan sungguhan — tagihan baru dibuat (dan dijurnal) saat
 * faktur dari supplier diterima, supaya hutang & PPN Masukan tidak tercatat sebelum ada fakturnya.
 */
export function PendingSupplierBills() {
  const router = useRouter();
  const { data, can, refreshModule } = useApp();
  const [showAll, setShowAll] = React.useState(false);
  const canRecord = can("supplier-bills", "C");

  React.useEffect(() => {
    if (!data["supplier-pos"]) void refreshModule("supplier-pos").catch(() => {});
    // sekali saat dibuka
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pending = React.useMemo(() => {
    const bills: Row[] = (data.invoiceIn ?? []).filter((inv: Row) => !["Batal", "BATAL", "Dibatalkan"].includes(String(inv.status)));
    return ((data["supplier-pos"] ?? []) as Row[])
      .filter((po) => String(po.poStatus ?? "").toUpperCase() === "DISETUJUI")
      .map((po) => {
        const poDpp = Number(po.dpp ?? 0) || Number(po.total ?? 0);
        const billed = bills
          .filter((inv) => inv.supplierPoId != null && String(inv.supplierPoId) === String(po.id))
          .reduce((s, inv) => s + Number(inv.nilai ?? inv.amount ?? 0), 0);
        return { po, poDpp, billed, remaining: Math.max(0, poDpp - billed) };
      })
      .filter((x) => x.poDpp > 0 && x.remaining > 1)
      .sort((a, b) => String(b.po.tanggal ?? "").localeCompare(String(a.po.tanggal ?? "")));
  }, [data]);

  if (!pending.length) return null;
  const shown = showAll ? pending : pending.slice(0, 5);

  return (
    <View className="bg-card border-amber-500/40 rounded-2xl border overflow-hidden mb-4">
      <View className="flex-row items-center gap-2.5 px-4 py-3 border-b border-border/60 bg-amber-500/5">
        <View className="size-8 rounded-lg bg-amber-500/15 items-center justify-center">
          <FileClock size={18} color={colors.warning} />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold">Tagihan supplier belum dicatat ({pending.length})</Text>
          <Text className="text-xs text-muted-foreground">PO sudah terbit — catat tagihannya saat faktur dari supplier diterima</Text>
        </View>
      </View>
      {shown.map(({ po, poDpp, billed, remaining }, idx) => (
        <View key={po.id} className={`flex-row flex-wrap items-center gap-3 px-4 py-3 ${idx > 0 ? "border-t border-border/60" : ""}`}>
          <Pressable className="flex-1 min-w-[180px]" onPress={() => router.push(`/supplier-pos/${po.id}` as any)}>
            <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
              {po.nomor} · {po.supplier || "Supplier"}
            </Text>
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {billed > 0 ? `Sudah ditagih ${rupiah(billed)} · sisa ${rupiah(remaining)} (DPP)` : `Nilai PO ${rupiah(Number(po.total ?? poDpp))}`}
              {po.pengiriman ? ` · ${po.pengiriman}` : ""}
            </Text>
          </Pressable>
          {canRecord ? (
            <Button size="sm" onPress={() => router.push(`/supplier-pos/${po.id}?catatTagihan=1` as any)}>
              <Text className="text-xs font-semibold text-white">Catat tagihan</Text>
            </Button>
          ) : null}
        </View>
      ))}
      {pending.length > 5 ? (
        <Pressable onPress={() => setShowAll((v) => !v)} className="flex-row items-center justify-center gap-1 py-2 border-t border-border/60">
          {showAll ? <ChevronUp size={14} color={colors.primary} /> : <ChevronDown size={14} color={colors.primary} />}
          <Text className="text-xs font-semibold text-primary">{showAll ? "Ringkas" : `Lihat semua (${pending.length})`}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
