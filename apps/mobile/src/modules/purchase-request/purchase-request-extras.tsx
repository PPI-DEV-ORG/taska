import * as React from "react";
import { View } from "react-native";
import { CheckCircle2, AlertTriangle, Truck, PackageCheck, XCircle, Clock, Check, ArrowRight } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Panel, FormField } from "@/components/taska/basics";
import { FileUploader } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { type Row } from "@/constants/modules";
import { toEnum } from "@/services/adapters";

export function PurchaseRequestExtras({
  row,
  onRefresh,
}: {
  row: Row;
  onRefresh?: () => Promise<void> | void;
}) {
  const { user, setStatus, decide, toast, reload } = useApp();
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");
  const [confirmSendOpen, setConfirmSendOpen] = React.useState(false);
  const [confirmReceiveOpen, setConfirmReceiveOpen] = React.useState(false);
  const [doFileId, setDoFileId] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [localStatus, setLocalStatus] = React.useState<string | null>(null);

  const role = user?.role ?? "";
  const isGudang = role === "gudang" || role === "super_admin" || role === "admin";
  const isProcurement = role === "procurement" || role === "super_admin" || role === "admin";
  const isRequesterOrPM =
    String(row.pemohonId) === String(user?.id) ||
    role === "pm" ||
    role === "super_admin" ||
    role === "admin";

  // Raw status enum
  const effectiveRaw = (
    localStatus ||
    row.rawStatus ||
    (row.status ? toEnum("purchase-requests", row.status) : "DIAJUKAN") ||
    "DIAJUKAN"
  ).toUpperCase();

  const isDiajukan = effectiveRaw === "DIAJUKAN";
  const isCekStok = effectiveRaw === "CEK_STOK";
  const isDisetujui = effectiveRaw === "DISETUJUI";
  const isDikirim = effectiveRaw === "DIKIRIM";
  const isDiterima = effectiveRaw === "DITERIMA";
  const isDitolak = effectiveRaw === "DITOLAK";

  const isApproved = isDisetujui || isDikirim || isDiterima || row.approval?.status === "Disetujui";
  const isStockChecked = isCekStok || isDisetujui || isDikirim || isDiterima;
  const isDispatched = isDikirim || isDiterima;

  const items: any[] = Array.isArray(row.items) ? row.items : [];
  const stockInfo: any[] = Array.isArray(row.stock) ? row.stock : [];
  const approval = row.approval;
  const isPendingApproval = approval?.status === "Menunggu" && !isApproved;

  // Check if all items have sufficient warehouse stock
  const stockSummary = React.useMemo(() => {
    return items.map((i) => {
      const match = stockInfo.find((s) => s.productId === i.productId);
      const available = match?.available ?? 0;
      const ordered = i.qty ?? 0;
      return {
        ...i,
        available,
        ordered,
        isEnough: available >= ordered,
      };
    });
  }, [items, stockInfo]);

  const allStockAvailable = stockSummary.length > 0 && stockSummary.every((s) => s.isEnough);

  async function handleApprove() {
    setLoading(true);
    try {
      setLocalStatus("DISETUJUI");
      if (approval?.id && isPendingApproval) {
        try { await decide(approval.id, "Disetujui"); } catch {}
      }
      await setStatus("purchase-requests", row.id, "Disetujui");
      toast("Request barang berhasil disetujui");
      if (onRefresh) await onRefresh();
      await reload();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menyetujui request", "danger");
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      toast("Alasan penolakan wajib diisi", "danger");
      return;
    }
    setLoading(true);
    try {
      setLocalStatus("DITOLAK");
      if (approval?.id && isPendingApproval) {
        try { await decide(approval.id, "Ditolak", rejectReason); } catch {}
      }
      await setStatus("purchase-requests", row.id, "Ditolak", rejectReason);
      setRejectOpen(false);
      setRejectReason("");
      toast("Request barang ditolak");
      if (onRefresh) await onRefresh();
      await reload();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menolak request", "danger");
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkCheckStock() {
    setLoading(true);
    try {
      setLocalStatus("CEK_STOK");
      await setStatus("purchase-requests", row.id, "Cek stok");
      toast("Status berhasil diubah ke Cek Stok");
      if (onRefresh) await onRefresh();
      await reload();
    } catch (e: any) {
      toast(e?.message ?? "Gagal memperbarui status", "danger");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendGoods() {
    setLoading(true);
    try {
      setLocalStatus("DIKIRIM");
      await setStatus("purchase-requests", row.id, "Dikirim");
      setConfirmSendOpen(false);
      toast("Barang berhasil diserahkan/dikirim dari Gudang");
      if (onRefresh) await onRefresh();
      await reload();
    } catch (e: any) {
      toast(e?.message ?? "Gagal memproses penyerahan barang", "danger");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmReceive() {
    setLoading(true);
    try {
      setLocalStatus("DITERIMA");
      await setStatus("purchase-requests", row.id, "Diterima", undefined, doFileId ? { doFileId } : undefined);
      setConfirmReceiveOpen(false);
      toast("Penerimaan barang telah dikonfirmasi");
      if (onRefresh) await onRefresh();
      await reload();
    } catch (e: any) {
      toast(e?.message ?? "Gagal mengonfirmasi penerimaan barang", "danger");
    } finally {
      setLoading(false);
    }
  }

  // Visual Stepper Stages
  const steps = [
    { label: "Diajukan", done: true, current: isDiajukan },
    { label: "Cek Stok", done: isStockChecked, current: isCekStok },
    { label: "Disetujui", done: isApproved, current: isDisetujui },
    { label: "Dikirim", done: isDispatched, current: isDikirim },
    { label: "Diterima", done: isDiterima, current: isDiterima },
  ];

  return (
    <>
      {/* ─── STATUS STEPPER / FLOW ─── */}
      <Panel title="Alur & Status Request" subtitle="Perkembangan tahapan proses barang dari pengajuan hingga diterima">
        <View className="flex-row items-center justify-between gap-1 py-1">
          {steps.map((st, idx) => {
            const isLast = idx === steps.length - 1;
            return (
              <React.Fragment key={st.label}>
                <View className="items-center flex-1">
                  <View
                    className={`h-7 w-7 rounded-full items-center justify-center ${
                      isDitolak
                        ? "bg-destructive/15 border border-destructive/40"
                        : st.done
                        ? "bg-emerald-600 border border-emerald-600"
                        : st.current
                        ? "bg-primary border border-primary"
                        : "bg-muted border border-border"
                    }`}
                  >
                    {isDitolak ? (
                      <XCircle size={14} color={colors.danger} />
                    ) : st.done ? (
                      <Check size={14} color="#fff" />
                    ) : (
                      <Text
                        className={`text-[10px] font-bold ${
                          st.current ? "text-white" : "text-muted-foreground"
                        }`}
                      >
                        {idx + 1}
                      </Text>
                    )}
                  </View>
                  <Text
                    className={`text-[11px] mt-1 text-center font-medium ${
                      st.current ? "text-primary font-bold" : st.done ? "text-foreground font-semibold" : "text-muted-foreground"
                    }`}
                    numberOfLines={1}
                  >
                    {st.label}
                  </Text>
                </View>
                {!isLast ? (
                  <View
                    className={`h-[2px] flex-1 -mt-3.5 ${
                      st.done && steps[idx + 1]?.done ? "bg-emerald-600" : "bg-border"
                    }`}
                  />
                ) : null}
              </React.Fragment>
            );
          })}
        </View>
      </Panel>

      {/* ─── PROMINENT STATUS ALERT BANNER ─── */}
      {isDitolak ? (
        <View className="bg-destructive/15 border border-destructive/40 rounded-xl p-4 flex-row items-center gap-3">
          <XCircle size={22} color={colors.danger} />
          <View className="flex-1">
            <Text className="text-destructive font-bold text-base">Request Barang Ditolak</Text>
            <Text className="text-destructive/90 text-xs mt-0.5">
              Alasan: {row.rejectReason || "Request tidak dapat diproses oleh Gudang/Approver."}
            </Text>
          </View>
        </View>
      ) : isDiterima ? (
        <View className="bg-emerald-500/15 border border-emerald-500/40 rounded-xl p-4 flex-row items-center gap-3">
          <CheckCircle2 size={22} color="#10b981" />
          <View className="flex-1">
            <Text className="text-emerald-700 dark:text-emerald-400 font-bold text-base">Barang Selesai Diterima</Text>
            <Text className="text-muted-foreground text-xs mt-0.5">
              Barang telah diterima oleh pemohon ({row.pemohon || "User"}). Seluruh proses permintaan telah tuntas.
            </Text>
          </View>
        </View>
      ) : isDikirim ? (
        <View className="bg-sky-500/15 border border-sky-500/40 rounded-xl p-4 flex-row items-center justify-between gap-3">
          <View className="flex-1 flex-row items-center gap-3">
            <Truck size={22} color="#0284c7" />
            <View className="flex-1">
              <Text className="text-sky-800 dark:text-sky-300 font-bold text-base">Barang Telah Diserahkan & Keluar Gudang</Text>
              <Text className="text-muted-foreground text-xs mt-0.5">
                Stok telah dipotong dari saldo gudang. Menunggu pemohon ({row.pemohon || "User"}) mengonfirmasi penerimaan.
              </Text>
            </View>
          </View>
          {isRequesterOrPM ? (
            <Button size="sm" onPress={() => setConfirmReceiveOpen(true)} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
              <PackageCheck size={14} color="#fff" />
              <Text className="text-xs font-semibold text-white">Konfirmasi Terima</Text>
            </Button>
          ) : null}
        </View>
      ) : isDisetujui ? (
        <View className="bg-emerald-500/15 border border-emerald-500/40 rounded-xl p-4 flex-row items-center gap-3">
          <CheckCircle2 size={22} color="#10b981" />
          <View className="flex-1">
            <Text className="text-emerald-700 dark:text-emerald-400 font-bold text-base">Request Telah Disetujui</Text>
            <Text className="text-muted-foreground text-xs mt-0.5">
              Request barang telah disetujui. Petugas gudang dapat segera menyerahkan/mengirimkan barang ke pemohon.
            </Text>
          </View>
        </View>
      ) : isCekStok ? (
        <View className="bg-amber-500/15 border border-amber-500/40 rounded-xl p-4 flex-row items-center gap-3">
          <Clock size={22} color={colors.warning} />
          <View className="flex-1">
            <Text className="text-amber-800 dark:text-amber-300 font-bold text-base">Sedang Pengecekan Stok Gudang</Text>
            <Text className="text-muted-foreground text-xs mt-0.5">
              Request sedang diperiksa ketersediaan barang fisiknya di gudang.
            </Text>
          </View>
        </View>
      ) : null}

      {/* ─── RINCIAN BARANG & KETERSEDIAAN STOK GUDANG ─── */}
      <Panel
        title={`Rincian Barang (${items.length || 1} Item)`}
        subtitle="Perbandingan jumlah kebutuhan vs ketersediaan fisik di gudang"
      >
        {stockSummary.length === 0 ? (
          <View className="py-2">
            <Text className="text-sm font-semibold">{row.item || row.tujuan || "Barang Operasional"}</Text>
            <Text className="text-xs text-muted-foreground mt-1">Estimasi Biaya: Rp{Number(row.estimasi || 0).toLocaleString("id-ID")}</Text>
          </View>
        ) : (
          <View className="gap-2.5">
            {stockSummary.map((item, idx) => {
              const productName = item.product?.name ?? `Produk #${item.productId}`;
              const sku = item.product?.sku ? `SKU: ${item.product.sku} · ` : "";
              const unit = item.product?.unit ? ` ${item.product.unit}` : "";
              let parsedSerials: string[] = [];
              if (item.serials) {
                try {
                  const arr = JSON.parse(item.serials);
                  if (Array.isArray(arr)) parsedSerials = arr.map(String);
                } catch {
                  parsedSerials = String(item.serials)
                    .split(",")
                    .map((s: string) => s.trim())
                    .filter(Boolean);
                }
              }
              return (
                <View
                  key={item.id ?? idx}
                  className="border-border/60 flex-row items-center justify-between border-b py-2.5 last:border-b-0"
                >
                  <View className="flex-1 min-w-0 pr-3">
                    <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                      {productName}
                    </Text>
                    <Text className="text-muted-foreground text-xs mt-0.5">
                      {sku}Diminta: <Text className="font-semibold text-foreground">{item.ordered}{unit}</Text>
                    </Text>
                    {parsedSerials.length > 0 ? (
                      <Text className="text-[11px] font-mono font-semibold text-primary mt-0.5">
                        SN: {parsedSerials.join(", ")}
                      </Text>
                    ) : null}
                  </View>
                  <View className="items-end shrink-0">
                    {item.isEnough ? (
                      <View className="bg-emerald-500/15 border border-emerald-500/30 rounded-md px-2.5 py-1">
                        <Text className="text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                          Stok Cukup (Tersedia {item.available}{unit})
                        </Text>
                      </View>
                    ) : (
                      <View className="bg-amber-500/15 border border-amber-500/30 rounded-md px-2.5 py-1">
                        <Text className="text-amber-700 dark:text-amber-400 text-xs font-semibold">
                          Kurang (Tersedia {item.available}{unit})
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Panel>

      {/* ─── TINDAKAN GUDANG & PENGADAAN (DENGAN PENANDA STATUS LENGKAP) ─── */}
      {(isGudang || isProcurement) ? (
        <Panel
          title="Tindakan Gudang & Pengadaan"
          subtitle="Proses persetujuan, pengecekan stok, dan penyerahan barang ke pemohon"
        >
          <View className="flex-row flex-wrap items-center gap-2.5 pt-1">
            {/* 1. Indikator / Tombol Persetujuan */}
            {isApproved ? (
              <View className="bg-emerald-500/15 border border-emerald-500/30 rounded-md px-3 py-1.5 flex-row items-center gap-1.5">
                <CheckCircle2 size={15} color="#10b981" />
                <Text className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  ✓ Sudah Disetujui
                </Text>
              </View>
            ) : !isDitolak ? (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                onPress={handleApprove}
                disabled={loading}
              >
                <CheckCircle2 size={14} color="#fff" />
                <Text className="text-xs font-semibold text-white">Setujui Request</Text>
              </Button>
            ) : null}

            {/* 2. Indikator / Tombol Cek Stok */}
            {isStockChecked ? (
              <View className="bg-sky-500/15 border border-sky-500/30 rounded-md px-3 py-1.5 flex-row items-center gap-1.5">
                <CheckCircle2 size={15} color="#0284c7" />
                <Text className="text-xs font-semibold text-sky-700 dark:text-sky-400">
                  ✓ Stok Telah Dicek
                </Text>
              </View>
            ) : !isDitolak ? (
              <Button
                variant="outline"
                size="sm"
                onPress={handleMarkCheckStock}
                disabled={loading}
              >
                <Clock size={14} color={colors.text} />
                <Text className="text-xs">Tandai Cek Stok</Text>
              </Button>
            ) : null}

            {/* 3. Indikator / Tombol Serahkan / Kirim Barang */}
            {isDispatched ? (
              <View className="bg-indigo-500/15 border border-indigo-500/30 rounded-md px-3 py-1.5 flex-row items-center gap-1.5">
                <Truck size={15} color="#6366f1" />
                <Text className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                  ✓ Barang Telah Diserahkan
                </Text>
              </View>
            ) : !isDitolak ? (
              <Button
                size="sm"
                onPress={() => setConfirmSendOpen(true)}
                disabled={loading}
              >
                <Truck size={14} color="#fff" />
                <Text className="text-xs font-semibold">Serahkan / Kirim Barang</Text>
              </Button>
            ) : null}

            {/* 4. Indikator / Tombol Tolak Request */}
            {isDitolak ? (
              <View className="bg-destructive/15 border border-destructive/30 rounded-md px-3 py-1.5 flex-row items-center gap-1.5">
                <XCircle size={15} color={colors.danger} />
                <Text className="text-xs font-semibold text-destructive">
                  ✗ Request Telah Ditolak
                </Text>
              </View>
            ) : !isDiterima && !isDispatched ? (
              <Button
                variant="destructive"
                size="sm"
                onPress={() => setRejectOpen(true)}
                disabled={loading}
              >
                <XCircle size={14} color="#fff" />
                <Text className="text-xs font-semibold">Tolak Request</Text>
              </Button>
            ) : null}
          </View>
        </Panel>
      ) : null}

      {/* Dialog Konfirmasi Serahkan Barang */}
      <Dialog open={confirmSendOpen} onOpenChange={setConfirmSendOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Serahkan Barang dari Gudang?</DialogTitle>
            <DialogDescription>
              Stok barang di gudang akan otomatis dipotong dan status berubah menjadi &quot;Dikirim&quot;. Notifikasi akan dikirim ke pemohon ({row.pemohon || "User"}) untuk konfirmasi penerimaan.
            </DialogDescription>
          </DialogHeader>
          {!allStockAvailable && stockSummary.length > 0 ? (
            <View className="bg-amber-500/15 border border-amber-500/30 rounded-xl p-3 flex-row items-center gap-2">
              <AlertTriangle size={16} color={colors.warning} />
              <Text className="text-xs text-amber-700 dark:text-amber-400 flex-1">
                Perhatian: Sebagian stok tercatat kurang di sistem. Anda tetap dapat menyerahkan bila ada stok fisik riil di gudang.
              </Text>
            </View>
          ) : null}
          <DialogFooter className="gap-2">
            <Button variant="outline" onPress={() => setConfirmSendOpen(false)} disabled={loading}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSendGoods} disabled={loading}>
              <Truck size={14} color="#fff" />
              <Text className="text-white font-semibold">{loading ? "Memproses..." : "Ya, Serahkan Barang"}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Konfirmasi Terima Barang */}
      <Dialog open={confirmReceiveOpen} onOpenChange={setConfirmReceiveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Konfirmasi Terima Barang</DialogTitle>
            <DialogDescription>
              Apakah seluruh barang yang diminta sudah Anda terima dalam kondisi baik di lokasi proyek?
            </DialogDescription>
          </DialogHeader>
          <View className="py-2 gap-3">
            <FormField label="Dokumen Surat Jalan / Delivery Order (DO) PDF" hint="Lampirkan dokumen atau foto bukti pengiriman DO ke proyek (opsional)">
              <FileUploader
                label="Unggah Dokumen DO"
                kind="dokumen"
                autoFlush={true}
                onUploaded={(id) => setDoFileId(id)}
              />
            </FormField>
          </View>
          <DialogFooter className="gap-2">
            <Button variant="outline" onPress={() => setConfirmReceiveOpen(false)} disabled={loading}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleConfirmReceive} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
              <PackageCheck size={14} color="#fff" />
              <Text className="text-white font-semibold">{loading ? "Memproses..." : "Ya, Barang Sudah Diterima"}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Tolak Request */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tolak Request Barang</DialogTitle>
            <DialogDescription>
              Masukkan alasan penolakan agar pemohon dapat mengetahui kendala (misal: stok kosong, anggaran tidak disetujui, dll).
            </DialogDescription>
          </DialogHeader>
          <View className="py-2">
            <Textarea
              placeholder="Contoh: Stok barang kosong di seluruh gudang / perlu PO baru..."
              value={rejectReason}
              onChangeText={setRejectReason}
              numberOfLines={3}
            />
          </View>
          <DialogFooter className="gap-2">
            <Button variant="outline" onPress={() => setRejectOpen(false)} disabled={loading}>
              <Text>Batal</Text>
            </Button>
            <Button variant="destructive" onPress={handleReject} disabled={loading}>
              <Text className="text-white font-semibold">{loading ? "Memproses..." : "Tolak Request"}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
