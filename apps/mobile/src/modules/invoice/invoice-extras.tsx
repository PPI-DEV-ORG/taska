import * as React from "react";
import { View, Linking } from "react-native";
import { Plus, Send, FileSpreadsheet, FileText, Paperclip, ExternalLink, CheckCircle2, FileDown } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Panel, FormField } from "@/components/taska/basics";
import { DatePicker } from "@/components/taska/dialogs";
import { FileUploader } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { api, apiBase } from "@/services/api";
import { colors } from "@/tokens";
import { rupiah, formatThousands } from "@/lib/format";
import { buildEfakturCsv } from "@/lib/efaktur";
import { type Row } from "@/constants/modules";
import { Line } from "@/modules/shared/line";
import { downloadInvoiceExcel } from "@/modules/invoice/invoice-files";
import { InvoiceTemplateGenerator } from "@/modules/invoice/invoice-template-generator";
import { ConflictAndSwapBanner } from "@/components/taska/serial-item-picker";
import { type QuotationItem } from "@/modules/quotation/types";

export function InvoiceExtras({
  row,
  payOpen: externalPayOpen,
  onPayOpenChange: externalOnPayOpenChange,
}: {
  row: Row;
  payOpen?: boolean;
  onPayOpenChange?: (open: boolean) => void;
}) {
  const { user, toast, reload, data, patchRow, setStatus } = useApp();
  const rawStatusUpper = String(row.rawStatus || "").toUpperCase();
  const isSent = row.status !== "Belum dikirim" && row.status !== "Draft" && rawStatusUpper !== "DRAFT";
  const [isSending, setIsSending] = React.useState(false);
  const canManage = user?.role === "super_admin" || user?.role === "finance" || user?.role === "bos" || user?.role === "admin";

  async function handleSendInvoice() {
    setIsSending(true);
    try {
      await setStatus("invoices", String(row.id), "Terkirim");
      toast("Invoice berhasil dikirim ke customer");
      await reload();
    } catch (e: any) {
      toast(e?.message ?? "Gagal mengirim invoice", "danger");
    } finally {
      setIsSending(false);
    }
  }

  const sisa = Math.max(0, Number(row.total || 0) - Number(row.terbayar || 0));
  const [internalPayOpen, setInternalPayOpen] = React.useState(false);
  const isControlled = externalPayOpen !== undefined;
  const payOpen = isControlled ? externalPayOpen : internalPayOpen;

  const setPayOpen = React.useCallback(
    (open: boolean) => {
      if (isControlled) {
        externalOnPayOpenChange?.(open);
      } else {
        setInternalPayOpen(open);
      }
    },
    [isControlled, externalOnPayOpenChange]
  );

  const [payAmount, setPayAmount] = React.useState(formatThousands(sisa || row.total || 0));
  const [payDate, setPayDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [payMethod, setPayMethod] = React.useState<"TRANSFER" | "TUNAI" | "QRIS" | "LAINNYA">("TRANSFER");
  const [payRef, setPayRef] = React.useState("");
  const [payFileId, setPayFileId] = React.useState<number | null>(null);
  const [isSubmittingPay, setIsSubmittingPay] = React.useState(false);

  const payments: { id: string; amount: number; date: string; method: string; reference: string; fileId?: number | null }[] =
    Array.isArray(row._payments) ? row._payments : [];

  function openPayModal() {
    setPayAmount(formatThousands(Math.max(0, Number(row.total || 0) - Number(row.terbayar || 0))));
    setPayFileId(null);
    setPayOpen(true);
  }

  async function handleSavePayment() {
    const amt = Number(String(payAmount).replace(/\D/g, "")) || 0;
    if (amt <= 0) {
      toast("Nominal pembayaran harus lebih dari 0", "danger");
      return;
    }
    if (!payFileId) {
      toast("Bukti transfer / pembayaran wajib diunggah sebelum menyimpan", "danger");
      return;
    }
    setIsSubmittingPay(true);
    try {
      await api("POST", `/invoices/${row.id}/payments`, {
        amount: amt,
        date: payDate || new Date().toISOString().slice(0, 10),
        method: payMethod,
        reference: payRef.trim() || undefined,
        fileId: payFileId,
      });
      toast(`Pembayaran ${rupiah(amt)} berhasil dicatat`);
      setPayOpen(false);
      setPayRef("");
      setPayFileId(null);
      await reload();
    } catch (e: any) {
      toast(e?.message ?? "Gagal mencatat pembayaran", "danger");
    } finally {
      setIsSubmittingPay(false);
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

  function openFileUrl(fileId?: number | string | null) {
    if (!fileId) return;
    const url = `${apiBase()}/files/${fileId}`;
    if (typeof window !== "undefined") {
      window.open(url, "_blank");
    } else {
      Linking.openURL(url).catch(() => {});
    }
  }

  return (
    <>
      <ConflictAndSwapBanner row={row} />

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
            {canManage && !isSent && row.status !== "Batal" && row.status !== "Dibatalkan" ? (
              <Button size="sm" onPress={handleSendInvoice} disabled={isSending} className="flex-row items-center gap-1 bg-primary">
                <Send size={13} color="#fff" />
                <Text className="text-xs text-white font-semibold">{isSending ? "Mengirim..." : "Kirim ke Customer"}</Text>
              </Button>
            ) : null}
            {canManage && isSent && sisa > 0 && row.status !== "Batal" && row.status !== "Dibatalkan" ? (
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
        {row.fileId ? (
          <Line
            left="Dokumen Invoice"
            sub="File invoice yang diunggah / diekstrak"
            right={
              <Button
                variant="outline"
                size="sm"
                onPress={() => openFileUrl(row.fileId)}
                className="flex-row items-center gap-1.5 h-8 px-2.5"
              >
                <FileText size={13} color={colors.primary} />
                <Text className="text-xs text-primary font-semibold">Buka File Invoice</Text>
                <ExternalLink size={11} color={colors.primary} />
              </Button>
            }
          />
        ) : null}
      </Panel>

      <Panel
        title="File Excel Invoice — Download & Smart Upload (.xlsx)"
        subtitle="Download file Excel (.xlsx) invoice sesuai format, edit manual di Excel jika diperlukan, lalu upload kembali — sistem otomatis membaca tabel item, DPP, PPN, dan Total Invoice."
      >
        <View className="gap-3">
          <Line
            left="Status File Dokumen"
            right={
              row.fileId || row.fileUploaded ? (
                <View className="flex-row items-center gap-1.5">
                  <CheckCircle2 size={15} color={colors.primary} />
                  <Text className="text-xs font-semibold text-primary">File Terupload</Text>
                </View>
              ) : (
                <Text className="text-xs text-muted-foreground font-medium">Belum Ada File</Text>
              )
            }
          />
          {row.fileName ? (
            <Line left="Nama File Terakhir" right={<Text className="text-xs text-foreground font-mono">{row.fileName}</Text>} />
          ) : null}

          <View className="flex-row flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onPress={() => {
                downloadInvoiceExcel({ invoiceId: row.id });
                toast("File Excel invoice (.xlsx) sedang diunduh");
              }}
            >
              <FileDown size={15} color={colors.text} />
              <Text className="text-xs">Download File Excel (.xlsx) Saat Ini</Text>
            </Button>
          </View>

          <FileUploader
            label="Pilih atau Tarik File Excel (.xlsx) Invoice — Sistem Otomatis Baca Isi Tabel & Total"
            kind="dokumen"
            autoFlush
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            hint="Hanya file Excel (.xlsx) maksimal 15 MB"
            allowedExtensions={[".xlsx"]}
            onFilePicked={async (file) => {
              try {
                const formData = new FormData();
                formData.append("file", file as any);
                await api("POST", `/invoices/${row.id}/upload-excel`, undefined, { form: formData });
                await reload();
                toast("File Excel berhasil dibaca & diunggah! Nilai invoice & rincian item diperbarui.");
              } catch (e: any) {
                toast(e?.message || "Gagal memproses file Excel", "danger");
              }
            }}
          />
        </View>
      </Panel>

      <InvoiceTemplateGenerator
        key={`${row.id}-${row.nilai}-${row.total}-${(row.items ?? []).length}`}
        row={row}
        onUpdateInvoice={async (
          items: QuotationItem[],
          newAmount: number,
          meta?: {
            subject?: string;
            intro?: string;
            notesList?: string[];
            city?: string;
            kopText?: string;
            kopLogoUrl?: string;
            customerAddress?: string;
            signerName?: string;
            signerTitle?: string;
            dpLabel?: string;
            dpAmount?: number;
          },
          shouldDownload?: boolean,
        ) => {
          const newPpn = Math.round(newAmount * 0.11);
          const newTotal = newAmount + newPpn;
          await patchRow("invoices", row.id, {
            items,
            subject: meta?.subject,
            intro: meta?.intro,
            notesList: meta?.notesList,
            city: meta?.city,
            kopText: meta?.kopText,
            kopLogoUrl: meta?.kopLogoUrl,
            customerAddress: meta?.customerAddress,
            signerName: meta?.signerName,
            signerTitle: meta?.signerTitle,
            dpLabel: meta?.dpLabel,
            dpAmount: meta?.dpAmount,
            nilai: newAmount,
            amount: newAmount,
            ppn: newPpn,
            total: newTotal,
            fileUploaded: true,
            fileName: `Invoice-${row.nomor.replace(/\//g, "-")}.xlsx`,
          });
          if (shouldDownload) {
            downloadInvoiceExcel({ invoiceId: row.id });
            toast("Template invoice disimpan & file Excel (.xlsx) diunduh!");
          } else {
            toast("Template & rincian invoice berhasil disimpan!");
          }
        }}
      />

      <Panel title="Riwayat Pembayaran Masuk">
        {payments.length > 0 ? (
          payments.map((p) => (
            <Line
              key={p.id}
              left={`${p.method} · ${p.date}`}
              sub={p.reference && p.reference !== "-" ? `Ref: ${p.reference}` : "Pembayaran terverifikasi"}
              right={
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm font-semibold text-success">{rupiah(p.amount)}</Text>
                  {p.fileId ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={() => openFileUrl(p.fileId)}
                      className="flex-row items-center gap-1 h-7 px-2 hover:bg-panel"
                    >
                      <Paperclip size={12} color={colors.primary} />
                      <Text className="text-[11px] text-primary font-medium">Bukti Bayar</Text>
                    </Button>
                  ) : null}
                </View>
              }
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
              <Input
                value={payAmount}
                onChangeText={(v) => setPayAmount(formatThousands(v))}
                keyboardType="numeric"
              />
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
            <View>
              <FileUploader
                label="Upload Bukti Pembayaran / Transfer (Wajib - JPG / PNG / PDF)"
                kind="semua"
                category="foto-struk"
                autoFlush
                required
                onUploaded={(fId) => setPayFileId(fId)}
              />
              {payFileId ? (
                <Text className="text-[11px] text-success mt-1 font-medium">
                  ✓ Bukti pembayaran tersimpan (File ID: #{payFileId})
                </Text>
              ) : (
                <Text className="text-[11px] text-danger mt-1">
                  * Bukti pembayaran wajib diunggah sebelum menyimpan
                </Text>
              )}
            </View>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setPayOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSavePayment} disabled={isSubmittingPay || !payFileId}>
              <Text>{isSubmittingPay ? "Menyimpan..." : "Simpan Pembayaran"}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
