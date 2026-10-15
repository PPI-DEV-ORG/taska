import * as React from "react";
import { View } from "react-native";
import { Plus, FileSpreadsheet } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Panel, FormField } from "@/components/taska/basics";
import { DatePicker } from "@/components/taska/dialogs";
import { FileUploader } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { api } from "@/services/api";
import { colors } from "@/tokens";
import { rupiah } from "@/lib/format";
import { buildEfakturCsv } from "@/lib/efaktur";
import { type Row } from "@/constants/modules";
import { Line } from "@/modules/shared/line";

export function InvoiceExtras({ row }: { row: Row }) {
  const { user, toast, reload, data } = useApp();
  const sisa = Math.max(0, Number(row.total || 0) - Number(row.terbayar || 0));
  const [payOpen, setPayOpen] = React.useState(false);
  const [payAmount, setPayAmount] = React.useState(String(sisa || row.total || 0));
  const [payDate, setPayDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [payMethod, setPayMethod] = React.useState<"TRANSFER" | "TUNAI" | "QRIS" | "LAINNYA">("TRANSFER");
  const [payRef, setPayRef] = React.useState("");
  const payments: { id: string; amount: number; date: string; method: string; reference: string }[] =
    Array.isArray(row._payments) ? row._payments : [];

  function openPayModal() {
    setPayAmount(String(Math.max(0, Number(row.total || 0) - Number(row.terbayar || 0))));
    setPayOpen(true);
  }

  async function handleSavePayment() {
    const amt = Number(String(payAmount).replace(/\D/g, "")) || 0;
    if (amt <= 0) {
      toast("Nominal pembayaran harus lebih dari 0", "danger");
      return;
    }
    try {
      await api("POST", `/invoices/${row.id}/payments`, {
        amount: amt,
        date: payDate || new Date().toISOString().slice(0, 10),
        method: payMethod,
        reference: payRef.trim() || undefined,
      });
      toast(`Pembayaran ${rupiah(amt)} berhasil dicatat`);
      setPayOpen(false);
      setPayRef("");
      await reload();
    } catch (e: any) {
      toast(e?.message ?? "Gagal mencatat pembayaran", "danger");
    }
  }

  const canExportEfaktur = ["super_admin", "bos", "finance"].includes(user?.role || "");

  function handleDownloadEfaktur() {
    if (!canExportEfaktur) {
      toast("Akses ditolak: Ekspor E-Faktur hanya untuk Finance, Bos, dan Super Admin", "danger");
      return;
    }
    if (typeof window === "undefined" || typeof document === "undefined") {
      toast("Mengunduh CSV E-Faktur DJP");
      return;
    }
    try {
      const csvContent = buildEfakturCsv([row], data.customers ?? []);
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `efaktur-${String(row.nomor || "inv").replace(/[^a-zA-Z0-9_-]/g, "_")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast(`CSV E-Faktur DJP untuk ${row.nomor} berhasil diunduh`);
    } catch (e: any) {
      toast(e?.message ?? "Gagal mengunduh CSV E-Faktur", "danger");
    }
  }

  return (
    <>
      <Panel
        title="Ringkasan Pembayaran Invoice"
        right={
          <View className="flex-row items-center gap-1.5">
            {canExportEfaktur ? (
              <Button variant="outline" size="sm" onPress={handleDownloadEfaktur} className="flex-row items-center gap-1">
                <FileSpreadsheet size={13} color={colors.success} />
                <Text className="text-xs">CSV E-Faktur</Text>
              </Button>
            ) : null}
            {(user?.role === "super_admin" || user?.role === "finance" || user?.role === "bos" || user?.role === "admin") && sisa > 0 ? (
              <Button variant="outline" size="sm" onPress={openPayModal} className="flex-row items-center gap-1">
                <Plus size={13} color={colors.text} />
                <Text className="text-xs">Catat Pembayaran</Text>
              </Button>
            ) : null}
          </View>
        }
      >
        <Line left="Nilai Sebelum PPN" right={<Text className="text-sm font-medium">{rupiah(row.nilai || 0)}</Text>} />
        <Line left="PPN (11%)" right={<Text className="text-sm font-medium">{rupiah(row.ppn || 0)}</Text>} />
        <Line left="Total Tagihan" right={<Text className="text-sm font-bold">{rupiah(row.total || 0)}</Text>} />
        <Line left="Sudah Dibayar" right={<Text className="text-success text-sm font-medium">{rupiah(row.terbayar || 0)}</Text>} />
        <Line left="Sisa Tagihan" right={<Text className="text-sm font-semibold">{rupiah(sisa)}</Text>} />
      </Panel>
      <Panel title="Riwayat Pembayaran Masuk">
        {payments.length > 0 ? (
          payments.map((p) => (
            <Line
              key={p.id}
              left={`${p.method} · ${p.date}`}
              sub={p.reference && p.reference !== "-" ? `Ref: ${p.reference}` : "Pembayaran terverifikasi"}
              right={<Text className="text-sm font-semibold text-success">{rupiah(p.amount)}</Text>}
            />
          ))
        ) : row.terbayar > 0 ? (
          <Line left="Transfer bank" sub="Bukti transfer tercatat" right={<Text className="text-sm">{rupiah(row.terbayar)}</Text>} />
        ) : (
          <Text className="text-muted-foreground text-sm">Belum ada pembayaran tercatat.</Text>
        )}
      </Panel>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Catat Pembayaran Invoice ({row.nomor})</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <FormField label="Nominal Pembayaran (Rp)" required>
              <Input value={payAmount} onChangeText={setPayAmount} keyboardType="numeric" />
            </FormField>
            <FormField label="Tanggal Pembayaran" required>
              <DatePicker value={payDate} onChange={setPayDate} placeholder="Pilih tanggal bayar" />
            </FormField>
            <FormField label="Metode Pembayaran" required>
              <View className="flex-row flex-wrap gap-1.5">
                {(["TRANSFER", "TUNAI", "QRIS", "LAINNYA"] as const).map((m) => (
                  <Button
                    key={m}
                    size="sm"
                    variant={payMethod === m ? "default" : "outline"}
                    onPress={() => setPayMethod(m)}
                    className="h-8 px-2.5"
                  >
                    <Text className="text-xs">{m}</Text>
                  </Button>
                ))}
              </View>
            </FormField>
            <FormField label="Nomor Referensi / Rekening">
              <Input value={payRef} onChangeText={setPayRef} placeholder="Contoh: TRF-BCA-992811" />
            </FormField>
            <FileUploader label="Upload Bukti Pembayaran (JPG / PDF)" kind="semua" category="foto-struk" autoFlush />
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setPayOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSavePayment}>
              <Text>Simpan Pembayaran</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
