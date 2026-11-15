import * as React from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { PackageCheck, Truck } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import type { Row } from "@/constants/modules";

type Incoming = {
  key: string;
  title: string;
  sub: string;
  badge: string;
  href: string;
};

/**
 * "Barang dalam pengiriman" di atas tabel Penerimaan Barang:
 *   - draf penerimaan yang dibuat otomatis saat barang ditandai dikirim (status Menunggu / Diterima sebagian);
 *   - PO / permintaan yang sudah "Dikirim" tapi belum punya penerimaan (mis. data lama).
 * Gudang langsung melihat apa yang akan datang dan menerimanya dengan satu klik.
 */
export function IncomingShipments() {
  const router = useRouter();
  const { data, refreshModule, can } = useApp();

  // PO & permintaan dipakai untuk mendeteksi barang yang dikirim tapi belum punya penerimaan
  React.useEffect(() => {
    if (!data["supplier-pos"]) void refreshModule("supplier-pos").catch(() => {});
    if (!data["purchase-requests"]) void refreshModule("purchase-requests").catch(() => {});
    // sekali saat dibuka
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = React.useMemo<Incoming[]>(() => {
    const receivings: Row[] = data.receiving ?? [];
    const pos: Row[] = data["supplier-pos"] ?? [];
    const prs: Row[] = data["purchase-requests"] ?? [];
    const out: Incoming[] = [];

    const openDrafts = receivings.filter((r) => ["MENUNGGU", "DITERIMA_SEBAGIAN"].includes(String(r.rawStatus ?? "").toUpperCase()));
    for (const r of openDrafts) {
      const partial = String(r.rawStatus).toUpperCase() === "DITERIMA_SEBAGIAN";
      out.push({
        key: `rc-${r.id}`,
        title: `${r.po && r.po !== "-" ? r.po : r.request && r.request !== "-" ? r.request : r.nomor} · ${r.supplier || "Supplier"}`,
        sub: r.item && r.item !== "-" ? r.item : `Penerimaan ${r.nomor}`,
        badge: partial ? "Diterima sebagian" : "Dalam pengiriman",
        href: `/receiving/new?receivingId=${r.id}`,
      });
    }

    const hasReceiving = (poId?: string | null, reqId?: string | null) =>
      receivings.some(
        (rc) =>
          (poId && String(rc.supplierPoId ?? "") === String(poId)) || (reqId && String(rc.requestId ?? "") === String(reqId)),
      );

    for (const po of pos) {
      if (String(po.pengiriman ?? "") !== "Dikirim") continue;
      if (hasReceiving(String(po.id), po.requestId ? String(po.requestId) : null)) continue;
      out.push({
        key: `po-${po.id}`,
        title: `${po.nomor} · ${po.supplier || "Supplier"}`,
        sub: `${po.itemsSummary || po.item || "Barang PO"}${po.eta && po.eta !== "-" ? ` · perkiraan tiba ${po.eta}` : ""}`,
        badge: "Dalam pengiriman",
        href: `/receiving/new?poId=${po.id}`,
      });
    }

    for (const pr of prs) {
      if (String(pr.status ?? "") !== "Dikirim") continue;
      const src = String(pr.procurementSource ?? "").toUpperCase();
      if (src === "GUDANG") continue; // ambil stok gudang: tidak lewat penerimaan
      const prPo = pos.find((p) => String(p.requestId ?? "") === String(pr.id));
      if (prPo || hasReceiving(null, String(pr.id))) continue; // sudah tercakup PO / penerimaan
      out.push({
        key: `pr-${pr.id}`,
        title: `${pr.nomor} · ${pr.supplier && pr.supplier !== "-" ? pr.supplier : "Beli di toko"}`,
        sub: pr.item && pr.item !== "-" ? pr.item : pr.tujuan || "Barang permintaan",
        badge: "Dalam pengiriman",
        href: `/receiving/new?requestId=${pr.id}`,
      });
    }
    return out;
  }, [data]);

  if (!items.length) return null;
  const canReceive = can("receiving", "C") || can("receiving", "U");

  return (
    <View className="bg-card border-border/80 rounded-2xl border shadow-sm overflow-hidden mb-4">
      <View className="flex-row items-center gap-2.5 px-4 py-3 border-b border-border/60">
        <View className="size-8 rounded-lg bg-sky-500/10 items-center justify-center">
          <Truck size={18} color="#0284c7" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold">Barang dalam pengiriman ({items.length})</Text>
          <Text className="text-xs text-muted-foreground">Cek fisik barang saat tiba, lalu terima di sini</Text>
        </View>
      </View>
      {items.map((it, idx) => (
        <Pressable
          key={it.key}
          onPress={canReceive ? () => router.push(it.href as any) : undefined}
          className={`flex-row items-center gap-3 px-4 py-3 ${idx > 0 ? "border-t border-border/60" : ""}`}
        >
          <View className="flex-1 min-w-0">
            <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
              {it.title}
            </Text>
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {it.sub}
            </Text>
          </View>
          <View className="rounded-full bg-sky-500/10 px-2 py-0.5">
            <Text className="text-[11px] font-semibold text-sky-700 dark:text-sky-300">{it.badge}</Text>
          </View>
          {canReceive ? (
            <Button size="sm" onPress={() => router.push(it.href as any)}>
              <PackageCheck size={14} color={colors.background} />
              <Text className="text-xs font-semibold">Terima</Text>
            </Button>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}
