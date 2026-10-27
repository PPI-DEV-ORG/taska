import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Plus, RefreshCw } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/taska/status-badge";
import { rupiah } from "@/lib/format";
import { colors } from "@/tokens";
import type { DetailTarget } from "../types";

interface StockDetailDialogProps {
  selectedDetail: DetailTarget | null;
  onClose: () => void;
  stockSummary: any[];
  serials: any[];
  onOpenBatchSn: (productId: string) => void;
  onOpenReplacement: (sn: string) => void;
}

export function StockDetailDialog({
  selectedDetail,
  onClose,
  stockSummary,
  serials,
  onOpenBatchSn,
  onOpenReplacement,
}: StockDetailDialogProps) {
  const router = useRouter();

  return (
    <Dialog open={!!selectedDetail} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {selectedDetail?.type === "product" && "Detail Barang & Stok"}
            {selectedDetail?.type === "warehouse_product" && "Detail Stok Gudang"}
            {selectedDetail?.type === "serial" && "Detail Unit Serial Number"}
            {selectedDetail?.type === "movement" && "Detail Pergerakan Stok"}
            {selectedDetail?.type === "reservation" && "Detail Reservasi Project"}
          </DialogTitle>
        </DialogHeader>

        {selectedDetail?.type === "product" && (() => {
          const p = selectedDetail.data;
          const whBreakdown = stockSummary.filter((s) => String(s.productId) === String(p.id));
          const pSerials = serials.filter((s) => String(s.productId) === String(p.id));
          return (
            <View className="gap-4 py-2">
              <View className="flex-row items-center justify-between border-b border-border pb-3">
                <View className="flex-1 pr-2">
                  <Text className="text-base font-bold text-foreground">{p.nama}</Text>
                  <Text className="text-xs text-muted-foreground">SKU: {p.sku} • Kategori: {p.kategori}</Text>
                </View>
                <StatusBadge status={p.statusStok ?? "Tersedia"} />
              </View>

              <View className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <View className="bg-card border-border rounded-lg border p-3">
                  <Text className="text-[11px] text-muted-foreground">Total Stok</Text>
                  <Text className="text-base font-bold text-foreground">{p.totalDisplay ?? "0"}</Text>
                </View>
                <View className="bg-card border-border rounded-lg border p-3">
                  <Text className="text-[11px] text-muted-foreground">Batas Minimal</Text>
                  <Text className="text-base font-bold text-foreground">{p.minDisplay ?? "0"}</Text>
                </View>
                <View className="bg-card border-border rounded-lg border p-3">
                  <Text className="text-[11px] text-muted-foreground">Wajib SN</Text>
                  <Text className="text-base font-bold text-foreground">{p.berSN ? "Ya" : "Tidak"}</Text>
                </View>
                <View className="bg-card border-border rounded-lg border p-3">
                  <Text className="text-[11px] text-muted-foreground">Garansi</Text>
                  <Text className="text-base font-bold text-foreground">{p.garansi ? `${p.garansi} Bln` : "-"}</Text>
                </View>
              </View>

              {p.hargaBeli ? (
                <View className="bg-card border-border rounded-lg border p-3">
                  <Text className="text-[11px] text-muted-foreground">Estimasi Harga Beli / Modal</Text>
                  <Text className="text-sm font-semibold text-foreground">{rupiah(p.hargaBeli)}</Text>
                </View>
              ) : null}

              {/* Sebaran Stok per Gudang */}
              <View className="gap-2">
                <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sebaran Stok di Gudang</Text>
                {whBreakdown.length > 0 ? (
                  <View className="bg-card border-border divide-y divide-border rounded-lg border">
                    {whBreakdown.map((wh) => (
                      <View key={wh.warehouseId} className="flex-row items-center justify-between p-3">
                        <Text className="text-sm font-medium text-foreground">{wh.warehouseName}</Text>
                        <Text className="text-sm font-bold text-primary">{wh.saldo} {p.satuan ?? ""}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text className="text-xs italic text-muted-foreground">Belum ada rincian gudang.</Text>
                )}
              </View>

              {/* Unit Serial Number */}
              {p.berSN && (
                <View className="gap-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Daftar Unit per-SN ({pSerials.length} Unit)
                    </Text>
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => onOpenBatchSn(String(p.id))}
                    >
                      <Plus size={14} color={colors.text} />
                      <Text className="text-xs">+ Tambah Unit SN</Text>
                    </Button>
                  </View>
                  {pSerials.length > 0 ? (
                    <View className="bg-card border-border max-h-56 divide-y divide-border overflow-y-auto rounded-lg border">
                      {pSerials.map((s: any, idx: number) => (
                        <View key={s.id} className="flex-row items-center justify-between p-2.5">
                          <View className="flex-1 pr-2">
                            <Text className="font-mono text-xs font-semibold text-foreground">
                              #{idx + 1} • {s.sn}
                            </Text>
                            <Text className="text-[10px] text-muted-foreground">
                              Lokasi: {s.gudang} • {s.project && s.project !== "-" ? s.project : "Stok Bebas (Di Gudang)"}
                            </Text>
                          </View>
                          <StatusBadge status={s.status ?? "Tersedia"} />
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text className="text-xs italic text-muted-foreground">
                      Belum ada unit Serial Number terdaftar untuk produk ini. Klik &quot;+ Tambah Unit SN&quot; untuk mendaftarkan unit per-SN.
                    </Text>
                  )}
                </View>
              )}

              <View className="flex-row gap-2 pt-3 border-t border-border mt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onPress={() => {
                    onClose();
                    router.push("/opname");
                  }}
                >
                  <Text className="text-xs">Sesuaikan Stok (Opname)</Text>
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onPress={() => {
                    onClose();
                    router.push("/receiving/new" as any);
                  }}
                >
                  <Text className="text-xs">Terima Barang (PO)</Text>
                </Button>
              </View>
            </View>
          );
        })()}

        {selectedDetail?.type === "warehouse_product" && (() => {
          const wp = selectedDetail.data;
          const wpSerials = serials.filter(
            (s) => String(s.productId) === String(wp.id) && s.gudang === wp.gudang
          );
          return (
            <View className="gap-4 py-2">
              <View className="flex-row items-center justify-between border-b border-border pb-3">
                <View className="flex-1 pr-2">
                  <Text className="text-base font-bold text-foreground">{wp.nama}</Text>
                  <Text className="text-xs text-muted-foreground">Lokasi: {wp.gudang} • SKU: {wp.sku}</Text>
                </View>
                <StatusBadge status={wp.statusStok ?? "Tersedia"} />
              </View>

              <View className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <View className="bg-card border-border rounded-lg border p-3">
                  <Text className="text-[11px] text-muted-foreground">Saldo Akhir</Text>
                  <Text className="text-base font-bold text-primary">{wp.saldo}</Text>
                </View>
                <View className="bg-card border-border rounded-lg border p-3">
                  <Text className="text-[11px] text-muted-foreground">Barang Masuk</Text>
                  <Text className="text-base font-bold text-emerald-500">{wp.masukDisplay}</Text>
                </View>
                <View className="bg-card border-border rounded-lg border p-3">
                  <Text className="text-[11px] text-muted-foreground">Barang Keluar</Text>
                  <Text className="text-base font-bold text-amber-500">{wp.keluarDisplay}</Text>
                </View>
                <View className="bg-card border-border rounded-lg border p-3">
                  <Text className="text-[11px] text-muted-foreground">Transfer (In / Out)</Text>
                  <Text className="text-base font-bold text-foreground">{wp.transferInDisplay} / {wp.transferOutDisplay}</Text>
                </View>
              </View>

              {wpSerials.length > 0 && (
                <View className="gap-2">
                  <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Serial Number di Gudang Ini ({wpSerials.length})</Text>
                  <View className="bg-card border-border max-h-48 divide-y divide-border overflow-y-auto rounded-lg border">
                    {wpSerials.map((s) => (
                      <View key={s.id} className="flex-row items-center justify-between p-2.5">
                        <Text className="font-mono text-xs font-semibold text-foreground">{s.sn}</Text>
                        <StatusBadge status={s.status ?? "Tersedia"} />
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          );
        })()}

        {selectedDetail?.type === "serial" && (() => {
          const s = selectedDetail.data;
          return (
            <View className="gap-4 py-2">
              <View className="flex-row items-center justify-between border-b border-border pb-3">
                <View className="flex-1 pr-2">
                  <Text className="font-mono text-lg font-bold text-foreground">{s.sn}</Text>
                  <Text className="text-xs text-muted-foreground">{s.produk} ({s.sku})</Text>
                </View>
                <StatusBadge status={s.status ?? "Tersedia"} />
              </View>

              <View className="bg-card border-border space-y-2 rounded-lg border p-3">
                <View className="flex-row justify-between py-1 border-b border-border">
                  <Text className="text-xs text-muted-foreground">Lokasi Gudang</Text>
                  <Text className="text-xs font-semibold text-foreground">{s.gudang || "-"}</Text>
                </View>
                <View className="flex-row justify-between py-1 border-b border-border">
                  <Text className="text-xs text-muted-foreground">Alokasi Project</Text>
                  <Text className="text-xs font-semibold text-foreground">{s.project || "Bebas / Tidak dialokasikan"}</Text>
                </View>
                <View className="flex-row justify-between py-1 border-b border-border">
                  <Text className="text-xs text-muted-foreground">Mulai Garansi</Text>
                  <Text className="text-xs font-semibold text-foreground">{s.garansiMulai || "-"}</Text>
                </View>
                <View className="flex-row justify-between py-1 border-b border-border">
                  <Text className="text-xs text-muted-foreground">Garansi Berakhir</Text>
                  <Text className="text-xs font-semibold text-foreground">{s.garansiBerakhir || "-"}</Text>
                </View>
                {s.digantiDengan ? (
                  <View className="flex-row justify-between py-1">
                    <Text className="text-xs text-rose-500 font-semibold">Diganti Oleh SN</Text>
                    <Text className="font-mono text-xs font-bold text-rose-500">{s.digantiDengan}</Text>
                  </View>
                ) : null}
              </View>

              {(s.status === "Rusak" || s.status === "Retur" || s.rawStatus === "RUSAK" || s.rawStatus === "RETUR") && (
                <Button
                  className="w-full gap-2"
                  onPress={() => {
                    onClose();
                    onOpenReplacement(s.sn);
                  }}
                >
                  <RefreshCw size={14} color="#000" />
                  <Text>Proses Penggantian Unit Ini (Input SN Baru)</Text>
                </Button>
              )}
            </View>
          );
        })()}

        {selectedDetail?.type === "movement" && (() => {
          const m = selectedDetail.data;
          return (
            <View className="gap-4 py-2">
              <View className="flex-row items-center justify-between border-b border-border pb-3">
                <View className="flex-1 pr-2">
                  <Text className="text-base font-bold text-foreground">{m.produk}</Text>
                  <Text className="text-xs text-muted-foreground">Waktu: {m.waktu}</Text>
                </View>
                <StatusBadge status={m.jenis ?? "Mutasi"} />
              </View>

              <View className="bg-card border-border space-y-2 rounded-lg border p-3">
                <View className="flex-row justify-between py-1 border-b border-border">
                  <Text className="text-xs text-muted-foreground">Kategori Mutasi</Text>
                  <Text className="text-xs font-semibold text-foreground">{m.kategori || "-"}</Text>
                </View>
                <View className="flex-row justify-between py-1 border-b border-border">
                  <Text className="text-xs text-muted-foreground">Jumlah Barang</Text>
                  <Text className="text-xs font-bold text-primary">{m.qtyDisplay ?? `${m.qty} unit`}</Text>
                </View>
                <View className="flex-row justify-between py-1 border-b border-border">
                  <Text className="text-xs text-muted-foreground">Gudang</Text>
                  <Text className="text-xs font-semibold text-foreground">{m.gudang || "-"}</Text>
                </View>
                <View className="flex-row justify-between py-1 border-b border-border">
                  <Text className="text-xs text-muted-foreground">Project Terkait</Text>
                  <Text className="text-xs font-semibold text-foreground">{m.project || "-"}</Text>
                </View>
                <View className="flex-row justify-between py-1 border-b border-border">
                  <Text className="text-xs text-muted-foreground">Petugas / PIC</Text>
                  <Text className="text-xs font-semibold text-foreground">{m.oleh || "-"}</Text>
                </View>
                {m.sn ? (
                  <View className="flex-row justify-between py-1 border-b border-border">
                    <Text className="text-xs text-muted-foreground">Serial Number</Text>
                    <Text className="font-mono text-xs font-semibold text-foreground">{m.sn}</Text>
                  </View>
                ) : null}
                {m.catatan ? (
                  <View className="pt-1">
                    <Text className="text-[11px] text-muted-foreground">Catatan / Referensi:</Text>
                    <Text className="text-xs italic text-foreground mt-0.5">{m.catatan}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          );
        })()}

        {selectedDetail?.type === "reservation" && (() => {
          const r = selectedDetail.data;
          return (
            <View className="gap-4 py-2">
              <View className="flex-row items-center justify-between border-b border-border pb-3">
                <View className="flex-1 pr-2">
                  <Text className="text-base font-bold text-foreground">{r.produk}</Text>
                  <Text className="text-xs text-muted-foreground">SKU: {r.sku || "-"}</Text>
                </View>
                <StatusBadge status={r.status ?? "Reserved"} />
              </View>

              <View className="bg-card border-border space-y-2 rounded-lg border p-3">
                <View className="flex-row justify-between py-1 border-b border-border">
                  <Text className="text-xs text-muted-foreground">Project Pemesan</Text>
                  <Text className="text-xs font-bold text-foreground">{r.project}</Text>
                </View>
                <View className="flex-row justify-between py-1 border-b border-border">
                  <Text className="text-xs text-muted-foreground">Jumlah Ditahan</Text>
                  <Text className="text-xs font-bold text-primary">{r.qtyDisplay ?? `${r.qty} unit`}</Text>
                </View>
                {r.sn ? (
                  <View className="flex-row justify-between py-1 border-b border-border">
                    <Text className="text-xs text-muted-foreground">Serial Number Alokasi</Text>
                    <Text className="font-mono text-xs font-semibold text-foreground">{r.sn}</Text>
                  </View>
                ) : null}
                <View className="flex-row justify-between py-1">
                  <Text className="text-xs text-muted-foreground">Tanggal Reservasi</Text>
                  <Text className="text-xs font-semibold text-foreground">{r.tanggal || "-"}</Text>
                </View>
              </View>
            </View>
          );
        })()}

        <DialogFooter>
          <Button variant="outline" onPress={onClose}>
            <Text>Tutup</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

