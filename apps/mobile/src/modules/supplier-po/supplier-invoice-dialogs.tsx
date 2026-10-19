import * as React from "react";
import { View, Linking, Platform } from "react-native";
import {
  FileText,
  Download,
  Check,
  Calendar,
  CreditCard,
  Building,
  CheckCircle2,
  Clock,
  ExternalLink,
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { FormField } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { DatePicker, formatThousands } from "@/components/taska/dialogs";
import { FileUploader } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { api, apiBase } from "@/services/api";
import { colors } from "@/tokens";
import { rupiah } from "@/lib/format";
import { type Row } from "@/constants/modules";

export function openDownloadFile(fileId: number | string) {
  const url = `${apiBase}/files/${fileId}/download`;
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.open(url, "_blank");
  } else {
    void Linking.openURL(url);
  }
}

export function SupplierInvoiceDetailDialog({
  open,
  onOpenChange,
  invoice,
  onPayPress,
  canPay,
  onOpenPo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Row | null;
  onPayPress?: (invoice: Row) => void;
  canPay?: boolean;
  onOpenPo?: (supplierPoId: string | number) => void;
}) {
  if (!invoice) return null;

  const total = Number(invoice.total || 0);
  const paid = Number(invoice.terbayar || 0);
  const sisa = Math.max(0, total - paid);
  const lunas = paid >= total && total > 0;
  const payments: any[] = Array.isArray(invoice._payments) ? invoice._payments : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <View className="flex-row items-center justify-between pr-6">
            <DialogTitle className="text-base font-bold">
              Detail Invoice Masuk
            </DialogTitle>
            <StatusBadge status={lunas ? "Lunas" : invoice.status} />
          </View>
          <DialogDescription className="text-xs">
            Tagihan dari supplier atas pengadaan barang / jasa.
          </DialogDescription>
        </DialogHeader>

        <View className="gap-4 py-2">
          {/* Main Info Card */}
          <View className="bg-panel rounded-xl border border-border p-3.5 gap-2.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-muted-foreground">Nomor Invoice</Text>
              <Text className="text-xs font-semibold">{invoice.nomor || "-"}</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-muted-foreground">Supplier</Text>
              <Text className="text-xs font-medium">{invoice.supplier || invoice.customer || "-"}</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-muted-foreground">PO Supplier Terkait</Text>
              {onOpenPo && invoice.supplierPoId ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 flex-row items-center gap-1"
                  onPress={() => {
                    onOpenChange(false);
                    onOpenPo(invoice.supplierPoId);
                  }}
                >
                  <Text className="text-xs text-primary font-medium">{invoice.po || "Buka PO"}</Text>
                  <ExternalLink size={12} color={colors.primary} />
                </Button>
              ) : (
                <Text className="text-xs font-medium">{invoice.po || "-"}</Text>
              )}
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-muted-foreground">Tanggal Terbit</Text>
              <Text className="text-xs font-medium">{invoice.tanggal || "-"}</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-muted-foreground">Jatuh Tempo</Text>
              <Text className="text-xs font-medium">{invoice.jatuhTempo || "-"}</Text>
            </View>
          </View>

          {/* Financial Breakdown */}
          <View className="bg-card rounded-xl border border-border p-3.5 gap-2">
            <Text className="text-xs font-semibold text-foreground mb-1">Rincian Nominal</Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-muted-foreground">DPP (Sebelum PPN)</Text>
              <Text className="text-xs font-medium">{rupiah(invoice.nilai || 0)}</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-muted-foreground">PPN (11%)</Text>
              <Text className="text-xs font-medium">{rupiah(invoice.ppn || 0)}</Text>
            </View>
            <View className="h-px bg-border my-0.5" />
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-semibold">Total Tagihan</Text>
              <Text className="text-sm font-bold text-foreground">{rupiah(total)}</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-muted-foreground">Sudah Terbayar</Text>
              <Text className="text-xs font-semibold text-success">{rupiah(paid)}</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-muted-foreground">Sisa Pembayaran</Text>
              <Text className={`text-xs font-bold ${sisa > 0 ? "text-danger" : "text-muted-foreground"}`}>
                {rupiah(sisa)}
              </Text>
            </View>
          </View>

          {/* Lampiran File Tagihan */}
          <View className="gap-1.5">
            <Text className="text-xs font-semibold text-foreground">File Tagihan / Dokumen Supplier</Text>
            {invoice.fileId ? (
              <View className="flex-row items-center justify-between p-3 rounded-xl border border-border bg-panel">
                <View className="flex-row items-center gap-2.5 flex-1 mr-2">
                  <View className="w-8 h-8 rounded-lg bg-primary/10 items-center justify-center">
                    <FileText size={16} color={colors.primary} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-medium truncate" numberOfLines={1}>
                      {invoice.file?.originalName || `Invoice-${invoice.nomor || invoice.id}.pdf`}
                    </Text>
                    <Text className="text-[11px] text-muted-foreground">Dokumen asli supplier</Text>
                  </View>
                </View>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 flex-row items-center gap-1"
                  onPress={() => openDownloadFile(invoice.fileId)}
                >
                  <Download size={13} color={colors.text} />
                  <Text className="text-xs">Buka / Unduh</Text>
                </Button>
              </View>
            ) : (
              <Text className="text-xs text-muted-foreground italic bg-panel/50 p-2.5 rounded-lg border border-dashed border-border">
                Tidak ada dokumen file yang dilampirkan.
              </Text>
            )}
          </View>

          {/* Riwayat Pembayaran */}
          <View className="gap-2">
            <Text className="text-xs font-semibold text-foreground">Riwayat Pembayaran ke Supplier</Text>
            {payments.length === 0 ? (
              <Text className="text-xs text-muted-foreground italic bg-panel/50 p-2.5 rounded-lg border border-dashed border-border">
                Belum ada catatan pembayaran yang tercatat.
              </Text>
            ) : (
              payments.map((p, idx) => (
                <View key={p.id || idx} className="p-2.5 rounded-lg border border-border bg-panel flex-row items-center justify-between">
                  <View className="flex-1 mr-2">
                    <Text className="text-xs font-semibold">{rupiah(p.amount || 0)}</Text>
                    <Text className="text-[11px] text-muted-foreground mt-0.5">
                      {p.date} · {p.method || "TRANSFER"} {p.reference ? `(${p.reference})` : ""}
                    </Text>
                  </View>
                  {p.fileId ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 flex-row items-center gap-1"
                      onPress={() => openDownloadFile(p.fileId)}
                    >
                      <Download size={12} color={colors.primary} />
                      <Text className="text-xs text-primary">Bukti Transfer</Text>
                    </Button>
                  ) : null}
                </View>
              ))
            )}
          </View>
        </View>

        <DialogFooter className="flex-row items-center justify-end gap-2 pt-2">
          <Button variant="outline" onPress={() => onOpenChange(false)}>
            <Text>Tutup</Text>
          </Button>
          {!lunas && canPay && onPayPress ? (
            <Button
              onPress={() => {
                onOpenChange(false);
                onPayPress(invoice);
              }}
              className="bg-primary flex-row items-center gap-1"
            >
              <CreditCard size={15} color={colors.background} />
              <Text className="text-primary-foreground font-medium">Catat Pembayaran / Lunasi</Text>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SupplierInvoicePayForm({
  invoice,
  onOpenChange,
  onSuccess,
}: {
  invoice: Row;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const { toast, reload } = useApp();
  const total = Number(invoice.total || 0);
  const paid = Number(invoice.terbayar || 0);
  const sisa = Math.max(0, total - paid);

  const [amount, setAmount] = React.useState(() => formatThousands(String(sisa || 0)));
  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = React.useState<"TRANSFER" | "TUNAI" | "GIRO" | "LAINNYA">("TRANSFER");
  const [reference, setReference] = React.useState(() => `TRF-${invoice.nomor || invoice.id}`);
  const [fileId, setFileId] = React.useState<number | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit() {
    const numAmt = Number(String(amount).replace(/\D/g, "")) || 0;
    if (numAmt <= 0) {
      toast("Nominal pembayaran harus lebih dari 0", "danger");
      return;
    }
    if (numAmt > sisa) {
      toast(`Nominal pembayaran melebihi sisa tagihan (${rupiah(sisa)})`, "danger");
      return;
    }
    setSubmitting(true);
    try {
      const targetId = (invoice as any).rawId ?? String(invoice.id).replace(/^in-/, "");
      await api("POST", `/invoice-in/${targetId}/payments`, {
        amount: numAmt,
        date: date || new Date().toISOString().slice(0, 10),
        method,
        reference: reference.trim() || undefined,
        fileId: fileId ?? undefined,
      });
      toast(`Pembayaran supplier ${rupiah(numAmt)} berhasil dicatat`);
      onOpenChange(false);
      await reload();
      onSuccess?.();
    } catch (e: any) {
      toast(e?.message ?? "Gagal mencatat pembayaran supplier", "danger");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Catat Pembayaran ke Supplier</DialogTitle>
        <DialogDescription>
          Pelunasan tagihan invoice {invoice.nomor} ({invoice.supplier || invoice.customer || "Supplier"}).
        </DialogDescription>
      </DialogHeader>

      <View className="gap-3 py-2">
        {/* Sisa badge */}
        <View className="bg-panel rounded-xl border border-border p-3 flex-row items-center justify-between">
          <View>
            <Text className="text-xs text-muted-foreground">Total Tagihan</Text>
            <Text className="text-xs font-semibold">{rupiah(total)}</Text>
          </View>
          <View className="items-end">
            <Text className="text-xs text-muted-foreground">Sisa yang Belum Dibayar</Text>
            <Text className="text-sm font-bold text-danger">{rupiah(sisa)}</Text>
          </View>
        </View>

        <FormField label="Nominal Pembayaran (Rp)" required>
          <Input
            value={amount}
            onChangeText={(t) => setAmount(formatThousands(t))}
            keyboardType="numeric"
            placeholder="0"
          />
        </FormField>

        <FormField label="Tanggal Pembayaran" required>
          <DatePicker value={date} onChange={setDate} />
        </FormField>

        <FormField label="Metode Pembayaran">
          <View className="flex-row items-center gap-2">
            {(["TRANSFER", "TUNAI", "GIRO"] as const).map((m) => (
              <Button
                key={m}
                size="sm"
                variant={method === m ? "default" : "outline"}
                onPress={() => setMethod(m)}
                className="flex-1"
              >
                <Text className={method === m ? "text-primary-foreground text-xs" : "text-xs"}>{m}</Text>
              </Button>
            ))}
          </View>
        </FormField>

        <FormField label="Nomor Referensi / Catatan Transfer">
          <Input
            value={reference}
            onChangeText={setReference}
            placeholder="Contoh: TRF-BCA-987213"
          />
        </FormField>

        <FormField label="Bukti Transfer (Opsional)">
          <FileUploader
            label="Upload Foto / PDF Bukti Transfer Bank"
            kind="semua"
            category="invoice"
            autoFlush
            onUploaded={(id) => setFileId(id)}
          />
        </FormField>
      </View>

      <DialogFooter className="flex-row items-center justify-end gap-2 pt-2">
        <Button variant="outline" onPress={() => onOpenChange(false)} disabled={submitting}>
          <Text>Batal</Text>
        </Button>
        <Button onPress={handleSubmit} disabled={submitting} className="bg-primary flex-row items-center gap-1.5">
          <Check size={16} color={colors.background} />
          <Text className="text-primary-foreground font-medium">
            {submitting ? "Menyimpan..." : "Simpan Pembayaran"}
          </Text>
        </Button>
      </DialogFooter>
    </>
  );
}

export function SupplierInvoicePayDialog({
  open,
  onOpenChange,
  invoice,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Row | null;
  onSuccess?: () => void;
}) {
  if (!open || !invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <SupplierInvoicePayForm
          key={`${invoice.id}-${invoice.terbayar}`}
          invoice={invoice}
          onOpenChange={onOpenChange}
          onSuccess={onSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}

