import * as React from "react";
import { View } from "react-native";
import { CheckCircle2, RefreshCw } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/text";
import { Panel, FormField } from "@/components/taska/basics";
import { SearchableSelect } from "@/components/taska/dialogs";
import { StatusBadge } from "@/components/taska/status-badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApp } from "@/store/app-store";
import { api } from "@/services/api";
import { colors } from "@/tokens";
import { type Row } from "@/constants/modules";

export function DamageReportExtras({
  row,
  onRefresh,
}: {
  row: Row;
  onRefresh?: () => Promise<void> | void;
}) {
  const { data, toast, reload, refreshModule } = useApp();
  const [replaceOpen, setReplaceOpen] = React.useState(false);
  const [newSn, setNewSn] = React.useState("");
  const [replaceQty, setReplaceQty] = React.useState(String(row.qty || 1));
  const [warehouseName, setWarehouseName] = React.useState(
    String(data.warehouses?.[0]?.nama ?? ""),
  );
  const [reason, setReason] = React.useState(
    `Penggantian unit ${row.produk}${row.sn && row.sn !== "-" ? ` (SN lama: ${row.sn})` : ""}`,
  );
  const [busy, setBusy] = React.useState(false);

  const prodObj = (data.products ?? []).find(
    (p: any) => String(p.id) === String(row.productId) || p.nama === row.produk,
  );
  const isSerialProduct = !!(
    row.hasSerial ||
    prodObj?.berSN ||
    prodObj?.hasSerial ||
    (row.sn && row.sn !== "-")
  );
  const alreadyReplaced = row.snPengganti && row.snPengganti !== "-";

  async function handleReceiveReplacement() {
    if (isSerialProduct && !newSn.trim()) {
      toast(
        "Masukkan nomor Serial Number (SN) baru untuk unit pengganti",
        "danger",
      );
      return;
    }
    const wh =
      (data.warehouses ?? []).find((w: any) => w.nama === warehouseName) ??
      data.warehouses?.[0];
    setBusy(true);
    try {
      await api("POST", `/damages/${row.id}/replace`, {
        newSn: isSerialProduct ? newSn.trim() : undefined,
        qty: Number(replaceQty) || 1,
        warehouseId: wh?.id ? Number(wh.id) : undefined,
        reason: reason.trim() || `Penggantian unit dari laporan #${row.id}`,
      });
      toast(
        isSerialProduct
          ? `Unit pengganti SN ${newSn.trim()} berhasil diterima & stok bertambah +1`
          : `Barang pengganti (${replaceQty} unit) berhasil diterima ke stok gudang`,
      );
      setReplaceOpen(false);
      setNewSn("");
      if (refreshModule) {
        await Promise.all([
          refreshModule("damage-reports"),
          refreshModule("serials"),
          refreshModule("movements"),
          refreshModule("products"),
        ]);
      }
      await reload();
      if (onRefresh) await onRefresh();
    } catch (e: any) {
      toast(
        e?.message || "Gagal memproses penerimaan unit pengganti",
        "danger",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Panel
        title="Alur Penggantian Barang & Dampak Stok Gudang"
        subtitle="Status mutasi stok atas laporan kerusakan / retur dan penerimaan barang pengganti"
        right={
          !alreadyReplaced ? (
            <Button size="sm" onPress={() => setReplaceOpen(true)}>
              <RefreshCw size={14} color={colors.background} />
              <Text className="text-xs font-semibold text-primary-foreground">
                Terima Barang Pengganti
              </Text>
            </Button>
          ) : undefined
        }
      >
        <View className="gap-3">
          <View className="bg-panel/60 border-border/80 rounded-xl border p-3 gap-2">
            <View className="flex-row items-center justify-between flex-wrap gap-2">
              <Text className="text-xs font-semibold text-foreground">
                1. Saat Laporan Kerusakan / Retur Dicatat:
              </Text>
              <StatusBadge
                status={
                  row.sn && row.sn !== "-"
                    ? `SN Lama: ${row.sn}`
                    : `${row.qty || 1} Unit`
                }
              />
            </View>
            <Text className="text-xs text-muted-foreground leading-relaxed">
              • Status unit SN lama (
              {row.sn && row.sn !== "-" ? row.sn : "barang terkait"}) otomatis
              berubah menjadi{" "}
              <Text className="font-semibold text-danger">
                {row.jenis?.includes("Retur") ? "RETUR" : "RUSAK"}
              </Text>{" "}
              (atau{" "}
              <Text className="font-semibold text-foreground">DIGANTI</Text>{" "}
              setelah unit baru tiba).{"\n"}• Saldo stok bagus yang siap pakai
              di gudang otomatis{" "}
              <Text className="font-semibold text-danger">
                berkurang (-{row.qty || 1})
              </Text>{" "}
              agar tidak terpilih di Penawaran/Invoice baru.
            </Text>
          </View>

          <View className="bg-panel/60 border-border/80 rounded-xl border p-3 gap-2">
            <View className="flex-row items-center justify-between flex-wrap gap-2">
              <Text className="text-xs font-semibold text-foreground">
                2. Saat Barang Pengganti Diterima Kembali:
              </Text>
              {alreadyReplaced ? (
                <View className="flex-row items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                  <CheckCircle2 size={13} color="#10b981" />
                  <Text className="text-xs font-bold text-emerald-500">
                    Diganti dengan: {row.snPengganti}
                  </Text>
                </View>
              ) : (
                <StatusBadge status="Menunggu Unit Pengganti" />
              )}
            </View>
            <Text className="text-xs text-muted-foreground leading-relaxed">
              {alreadyReplaced
                ? `Unit pengganti (${row.snPengganti}) sudah diterima dan masuk ke stok gudang (+${row.qty || 1} tersedia) dengan status DI GUDANG, serta terhubung langsung dengan riwayat SN lama (${row.sn}).`
                : "Ketika unit pengganti dari pemasok/garansi tiba (misal SN baru), klik tombol 'Terima Barang Pengganti' di atas. Sistem otomatis mendaftarkan SN baru ke gudang, menambah kembali stok tersedia (+1), menautkan SN lama → SN baru, dan menutup laporan ini menjadi Selesai."}
            </Text>
          </View>
        </View>
      </Panel>

      <Dialog open={replaceOpen} onOpenChange={setReplaceOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Terima Barang / Unit Pengganti</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <View className="bg-panel border-border rounded-lg border p-3 gap-1">
              <Text className="text-xs text-muted-foreground">
                Barang yang Diganti:
              </Text>
              <Text className="text-sm font-bold text-foreground">
                {row.produk}
              </Text>
              {row.sn && row.sn !== "-" ? (
                <Text className="text-xs font-mono text-danger">
                  SN Lama (Rusak/Retur): {row.sn}
                </Text>
              ) : null}
            </View>

            {isSerialProduct ? (
              <FormField
                label="Serial Number (SN) Unit Pengganti Baru"
                required
              >
                <Input
                  value={newSn}
                  onChangeText={setNewSn}
                  placeholder="Contoh: 94949 / Scan barcode SN baru..."
                  autoCapitalize="characters"
                />
              </FormField>
            ) : (
              <FormField label="Jumlah (Qty) Pengganti Diterima" required>
                <Input
                  value={replaceQty}
                  onChangeText={setReplaceQty}
                  keyboardType="numeric"
                  placeholder="1"
                />
              </FormField>
            )}

            <FormField label="Gudang Penerima">
              <SearchableSelect
                value={
                  warehouseName || String(data.warehouses?.[0]?.nama ?? "")
                }
                onChange={setWarehouseName}
                options={(data.warehouses ?? []).map((w: any) =>
                  String(w.nama),
                )}
                placeholder="Pilih gudang..."
              />
            </FormField>

            <FormField label="Catatan / Alasan Penggantian" required>
              <Textarea
                value={reason}
                onChangeText={setReason}
                placeholder="Contoh: Unit pengganti klaim garansi / retur dari pemasok"
              />
            </FormField>
          </View>
          <DialogFooter>
            <Button
              variant="outline"
              onPress={() => setReplaceOpen(false)}
              disabled={busy}
            >
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleReceiveReplacement} disabled={busy}>
              <Text>{busy ? "Memproses..." : "Simpan & Tambah ke Stok"}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
