import * as React from "react";
import { View, Linking, Platform, ScrollView } from "react-native";
import {
  FileText,
  Download,
  Check,
  CreditCard,
  ExternalLink,
  Pencil,
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { DatePicker, formatThousands, SearchableSelect } from "@/components/taska/dialogs";
import { FileUploader, type FileUploaderHandle } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { api, apiBase } from "@/services/api";
import { adaptRow } from "@/services/adapters";
import { getKasBankAccounts } from "@/lib/accounting";
import { colors } from "@/tokens";
import { rupiah } from "@/lib/format";
import { type Row } from "@/constants/modules";

export function openDownloadFile(fileId: number | string) {
  const url = `${apiBase()}/files/${fileId}`;
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
  onEditPress,
  canPay,
  canEdit = true,
  onOpenPo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Row | null;
  onPayPress?: (invoice: Row) => void;
  onEditPress?: (invoice: Row) => void;
  canPay?: boolean;
  canEdit?: boolean;
  onOpenPo?: (supplierPoId: string | number) => void;
}) {
  const { data } = useApp();
  const [freshInvoice, setFreshInvoice] = React.useState<Row | null>(null);

  const rawId = React.useMemo(() => {
    if (!invoice) return "";
    return String((invoice as any).rawId ?? String(invoice.id).replace(/^in-/, ""));
  }, [invoice]);

  const liveFromStore = React.useMemo(() => {
    if (!rawId) return null;
    return (data.invoiceIn ?? []).find(
      (r: Row) => String((r as any).rawId ?? String(r.id).replace(/^in-/, "")) === rawId
    ) || null;
  }, [data.invoiceIn, rawId]);

  React.useEffect(() => {
    if (!open || !rawId || String(rawId).startsWith("offline-")) {
      return;
    }
    let active = true;
    api<any>("GET", `/invoice-in/${rawId}`)
      .then((res) => {
        if (active && res) {
          setFreshInvoice(adaptRow("invoiceIn", res));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [open, rawId]);

  if (!invoice) return null;

  const displayInvoice: Row = {
    ...invoice,
    ...(liveFromStore || {}),
    ...(freshInvoice || {}),
    id: invoice.id,
    rawId,
  };

  const total = Number(displayInvoice.total || 0);
  const paid = Number(displayInvoice.terbayar || 0);
  const sisa = Math.max(0, total - paid);
  const lunas = paid >= total && total > 0;
  const payments: any[] = Array.isArray(displayInvoice._payments) ? displayInvoice._payments : [];
  const effectiveTransferFileId =
    displayInvoice.transferFileId || payments.find((p) => p.fileId)?.fileId || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[94vw] max-w-2xl max-h-[88vh] overflow-y-auto"
        style={Platform.select({
          web: { width: "min(94vw, 680px)", maxWidth: "680px" } as any,
        })}
      >
        <DialogHeader>
          <View className="flex-row items-center justify-between pr-6">
            <DialogTitle className="text-base font-bold">
              Detail Invoice Masuk
            </DialogTitle>
            <StatusBadge status={lunas ? "Lunas" : displayInvoice.status} />
          </View>
          <DialogDescription className="text-xs">
            Detail tagihan / invoice masuk beserta dokumen tagihan dan bukti pembayaran.
          </DialogDescription>
        </DialogHeader>

        <View className="gap-4 py-2">
          {/* Main Info Card */}
          <View className="bg-panel rounded-xl border border-border p-3.5 gap-2.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-muted-foreground">Nomor Invoice</Text>
              <Text className="text-xs font-semibold">{displayInvoice.nomor || "-"}</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-muted-foreground">Supplier / Penagih</Text>
              <Text className="text-xs font-medium">{displayInvoice.supplier || displayInvoice.customer || "-"}</Text>
            </View>
            {displayInvoice.category || displayInvoice.jenis ? (
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-muted-foreground">Kategori Tagihan</Text>
                <Text className="text-xs font-semibold text-primary">
                  {displayInvoice.category || displayInvoice.jenis}
                  {displayInvoice.debitAccount ? ` [${displayInvoice.debitAccount}]` : ""}
                </Text>
              </View>
            ) : null}
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-muted-foreground">PO Supplier Terkait</Text>
              {onOpenPo && displayInvoice.supplierPoId ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 flex-row items-center gap-1"
                  onPress={() => {
                    onOpenChange(false);
                    onOpenPo(displayInvoice.supplierPoId);
                  }}
                >
                  <Text className="text-xs text-primary font-medium">{displayInvoice.po || "Buka PO"}</Text>
                  <ExternalLink size={12} color={colors.primary} />
                </Button>
              ) : (
                <Text className="text-xs font-medium">{displayInvoice.po || "-"}</Text>
              )}
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-muted-foreground">Tanggal Terbit</Text>
              <Text className="text-xs font-medium">{displayInvoice.tanggal || "-"}</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-muted-foreground">Jatuh Tempo</Text>
              <Text className="text-xs font-medium">{displayInvoice.jatuhTempo || "-"}</Text>
            </View>
          </View>

          {/* Financial Breakdown */}
          <View className="bg-card rounded-xl border border-border p-3.5 gap-2">
            <Text className="text-xs font-semibold text-foreground mb-1">Rincian Nominal</Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-muted-foreground">DPP (Sebelum PPN)</Text>
              <Text className="text-xs font-medium">{rupiah(displayInvoice.nilai || 0)}</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-muted-foreground">PPN (11%)</Text>
              <Text className="text-xs font-medium">{rupiah(displayInvoice.ppn || 0)}</Text>
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
            <Text className="text-xs font-semibold text-foreground">File Dokumen Tagihan / Invoice Masuk</Text>
            {displayInvoice.fileId ? (
              <View className="flex-row items-center justify-between p-3 rounded-xl border border-border bg-panel">
                <View className="flex-row items-center gap-2.5 flex-1 mr-2">
                  <View className="w-8 h-8 rounded-lg bg-primary/10 items-center justify-center">
                    <FileText size={16} color={colors.primary} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-medium truncate" numberOfLines={1}>
                      {displayInvoice.file?.originalName || `Tagihan-${displayInvoice.nomor || displayInvoice.id}.pdf`}
                    </Text>
                    <Text className="text-[11px] text-muted-foreground">Dokumen tagihan / invoice masuk</Text>
                  </View>
                </View>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 flex-row items-center gap-1"
                  onPress={() => openDownloadFile(displayInvoice.fileId)}
                >
                  <Download size={13} color={colors.text} />
                  <Text className="text-xs">Buka / Unduh</Text>
                </Button>
              </View>
            ) : (
              <Text className="text-xs text-muted-foreground italic bg-panel/50 p-2.5 rounded-lg border border-dashed border-border">
                Tidak ada dokumen file tagihan yang dilampirkan.
              </Text>
            )}
          </View>

          {/* Bukti Pembayaran / Transfer */}
          <View className="gap-1.5">
            <Text className="text-xs font-semibold text-foreground">Bukti Pembayaran / Transfer</Text>
            {effectiveTransferFileId ? (
              <View className="flex-row items-center justify-between p-3 rounded-xl border border-border bg-panel">
                <View className="flex-row items-center gap-2.5 flex-1 mr-2">
                  <View className="w-8 h-8 rounded-lg bg-success/10 items-center justify-center">
                    <FileText size={16} color={colors.success} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-medium truncate" numberOfLines={1}>
                      {(displayInvoice as any).transferFile?.originalName || `Bukti-Bayar-${displayInvoice.nomor || displayInvoice.id}`}
                    </Text>
                    <Text className="text-[11px] text-muted-foreground">Bukti pelunasan / transfer tagihan masuk</Text>
                  </View>
                </View>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 flex-row items-center gap-1"
                  onPress={() => openDownloadFile(effectiveTransferFileId)}
                >
                  <Download size={13} color={colors.text} />
                  <Text className="text-xs">Buka / Unduh</Text>
                </Button>
              </View>
            ) : (
              <Text className="text-xs text-muted-foreground italic bg-panel/50 p-2.5 rounded-lg border border-dashed border-border">
                Belum ada bukti pembayaran yang dilampirkan.
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
                  {p.fileId || effectiveTransferFileId ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 flex-row items-center gap-1"
                      onPress={() => openDownloadFile(p.fileId || effectiveTransferFileId)}
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
          {canEdit && onEditPress ? (
            <Button
              variant="outline"
              onPress={() => {
                onOpenChange(false);
                onEditPress(displayInvoice);
              }}
              className="flex-row items-center gap-1.5"
            >
              <Pencil size={14} color={colors.text} />
              <Text className="font-medium">Edit Invoice Masuk</Text>
            </Button>
          ) : null}
          {!lunas && canPay && onPayPress ? (
            <Button
              onPress={() => {
                onOpenChange(false);
                onPayPress(displayInvoice);
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

const INVOICE_IN_CATEGORY_OPTIONS = [
  { code: "6202.01", label: "Tagihan Listrik / PLN [6202.01 - Biaya Listrik]", category: "Tagihan Listrik" },
  { code: "6202.03", label: "Tagihan Internet / WiFi / Telepon [6202.03 - Biaya Telekomunikasi]", category: "Tagihan Internet & Telekomunikasi" },
  { code: "6202.02", label: "Tagihan Air / PDAM [6202.02 - Biaya Air]", category: "Tagihan Air / PDAM" },
  { code: "6203.01", label: "Sewa / Pemeliharaan Gedung & Kantor [6203.01]", category: "Pemeliharaan Gedung & Kantor" },
  { code: "6203.02", label: "Servis Kendaraan / BBM / Operasional Lapangan [6203.02]", category: "Operasional Kendaraan" },
  { code: "6202.06", label: "Pembelian ATK & Perlengkapan Kantor [6202.06]", category: "ATK & Perlengkapan Kantor" },
  { code: "6202.07", label: "Tagihan Jasa / Operasional Umum Lainnya [6202.07]", category: "Tagihan Operasional Lainnya" },
  { code: "1200", label: "Pembelian Barang Stok / Persediaan Gudang [1200]", category: "Tagihan Supplier (Stok)" },
  { code: "5101", label: "Tagihan Subkon / Material Proyek [5101 - HPP Project]", category: "Tagihan Proyek" },
];

function SupplierInvoiceEditForm({
  invoice,
  onOpenChange,
  onSuccess,
}: {
  invoice: Row;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const { data, patchRow, toast, reload } = useApp();

  const [nomor, setNomor] = React.useState<string>(() => String(invoice.nomor || ""));
  const [supplierName, setSupplierName] = React.useState<string>(() =>
    String(invoice.supplier || String(invoice.customer || "").replace(/\s*\([^)]*\)\s*$/, "") || "")
  );
  const [selectedSupplierId, setSelectedSupplierId] = React.useState<string>(() =>
    invoice.supplierId ? String(invoice.supplierId) : ""
  );
  const [selectedSupplierPoId, setSelectedSupplierPoId] = React.useState<string>(() =>
    invoice.supplierPoId ? String(invoice.supplierPoId) : ""
  );
  const [categoryCode, setCategoryCode] = React.useState<string>(() => {
    if (invoice.debitAccount && INVOICE_IN_CATEGORY_OPTIONS.some((o) => o.code === invoice.debitAccount)) {
      return String(invoice.debitAccount);
    }
    const foundByCat = INVOICE_IN_CATEGORY_OPTIONS.find(
      (o) => o.category.toLowerCase() === String(invoice.category || invoice.jenis || "").toLowerCase()
    );
    if (foundByCat) return foundByCat.code;
    return invoice.supplierPoId ? "1200" : "6202.01";
  });
  const [tanggal, setTanggal] = React.useState<string>(() =>
    invoice.tanggal && /^\d{4}-\d{2}-\d{2}/.test(String(invoice.tanggal))
      ? String(invoice.tanggal).slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  );
  const [jatuhTempo, setJatuhTempo] = React.useState<string>(() =>
    invoice.jatuhTempo && /^\d{4}-\d{2}-\d{2}/.test(String(invoice.jatuhTempo))
      ? String(invoice.jatuhTempo).slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  );
  const [dppStr, setDppStr] = React.useState<string>(() =>
    formatThousands(String(invoice.nilai || invoice.total || 0))
  );
  const [ppnMode, setPpnMode] = React.useState<"none" | "exclude" | "include">(() => {
    const ppnNum = Number(invoice.ppn || 0);
    return ppnNum > 0 ? "exclude" : "none";
  });
  const [catatan, setCatatan] = React.useState<string>(() => String(invoice.catatan || ""));
  const [fileId, setFileId] = React.useState<number | null>(() =>
    invoice.fileId ? Number(invoice.fileId) : null
  );
  const [transferFileId, setTransferFileId] = React.useState<number | null>(() => {
    const paymentFile = Array.isArray(invoice._payments)
      ? invoice._payments.find((p: any) => p.fileId)?.fileId
      : null;
    const rawTf = invoice.transferFileId || paymentFile;
    return rawTf ? Number(rawTf) : null;
  });
  const docUploaderRef = React.useRef<FileUploaderHandle | null>(null);
  const payUploaderRef = React.useRef<FileUploaderHandle | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const rawBase = Number(String(dppStr).replace(/\D/g, "")) || 0;
  const effectiveDpp = ppnMode === "include" ? Math.round(rawBase / 1.11) : rawBase;
  const effectivePpn =
    ppnMode === "none"
      ? 0
      : ppnMode === "include"
      ? Math.max(0, rawBase - effectiveDpp)
      : Math.round(rawBase * 0.11);
  const effectiveTotal = ppnMode === "include" ? rawBase : effectiveDpp + effectivePpn;

  async function handleSave() {
    if (!nomor.trim()) {
      toast("Nomor invoice masuk wajib diisi", "danger");
      return;
    }
    if (effectiveDpp <= 0) {
      toast("Nominal tagihan harus lebih dari 0", "danger");
      return;
    }
    setSubmitting(true);
    try {
      let finalFileId = fileId;
      if (docUploaderRef.current?.hasStaged()) {
        const flushedDoc = await docUploaderRef.current.flush();
        if (flushedDoc) finalFileId = Number(flushedDoc);
      }
      let finalTransferFileId = transferFileId;
      if (payUploaderRef.current?.hasStaged()) {
        const flushedPay = await payUploaderRef.current.flush();
        if (flushedPay) finalTransferFileId = Number(flushedPay);
      }

      const targetId = String((invoice as any).rawId ?? String(invoice.id).replace(/^in-/, ""));
      const selectedCatOpt =
        INVOICE_IN_CATEGORY_OPTIONS.find((o) => o.code === categoryCode) ||
        INVOICE_IN_CATEGORY_OPTIONS[0]!;

      await api("PATCH", `/invoice-in/${targetId}`, {
        number: nomor.trim(),
        supplierName: supplierName.trim() || "Supplier / Vendor",
        supplierId: selectedSupplierId ? Number(selectedSupplierId) : undefined,
        supplierPoId: selectedSupplierPoId ? Number(selectedSupplierPoId) : undefined,
        category: selectedCatOpt.category,
        debitAccount: categoryCode,
        date: tanggal,
        dueDate: jatuhTempo,
        amount: effectiveDpp,
        ppn: effectivePpn,
        total: effectiveTotal,
        notes: catatan.trim(),
        fileId: finalFileId ?? undefined,
        transferFileId: finalTransferFileId ?? undefined,
        paymentFileId: finalTransferFileId ?? undefined,
      });

      await reload();
      toast(`Invoice Masuk ${nomor.trim()} berhasil diperbarui`);
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menyimpan perubahan invoice masuk", "danger");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit Invoice Masuk</DialogTitle>
        <DialogDescription>
          Perbarui informasi tagihan masuk, kategori COA, nominal PPN, atau dokumen lampiran.
        </DialogDescription>
      </DialogHeader>

      <ScrollView className="max-h-[75vh] pr-1">
        <View className="gap-3 py-2">
          <FormField label="Kategori Tagihan / Akun Beban (COA)" required>
            <SearchableSelect
              value={
                INVOICE_IN_CATEGORY_OPTIONS.find((o) => o.code === categoryCode)?.label ||
                INVOICE_IN_CATEGORY_OPTIONS[0]!.label
              }
              onChange={(val) => {
                const found = INVOICE_IN_CATEGORY_OPTIONS.find((o) => o.label === val);
                if (found) setCategoryCode(found.code);
              }}
              options={INVOICE_IN_CATEGORY_OPTIONS.map((o) => o.label)}
              placeholder="Pilih kategori tagihan / akun COA..."
            />
          </FormField>

          <FormField label="Pihak Penagih / Penyedia Layanan / Supplier" required>
            <View className="gap-1.5">
              <SearchableSelect
                value={supplierName}
                onChange={(val) => {
                  setSupplierName(val);
                  const match = (data.suppliers ?? []).find((s: Row) => (s.nama || s.name) === val);
                  if (match) setSelectedSupplierId(String(match.id));
                  else setSelectedSupplierId("");
                }}
                options={Array.from(
                  new Set([
                    supplierName,
                    "PLN (Tagihan Listrik)",
                    "Telkom IndiHome (Internet)",
                    "Biznet Networks (Internet)",
                    "PDAM (Tagihan Air)",
                    "Pengelola Gedung / Sewa Kantor",
                    ...(data.suppliers ?? []).map((s: Row) => s.nama || s.name),
                  ])
                ).filter(Boolean)}
                placeholder="Pilih penyedia tagihan / supplier..."
              />
              <Input
                value={supplierName}
                onChangeText={(val) => {
                  setSupplierName(val);
                  const match = (data.suppliers ?? []).find((s: Row) => (s.nama || s.name) === val);
                  if (match) setSelectedSupplierId(String(match.id));
                  else setSelectedSupplierId("");
                }}
                placeholder="Ketik manual nama penagih (contoh: PLN, IndiHome)..."
              />
            </View>
          </FormField>

          <FormField label="Nomor Invoice Masuk / No. Tagihan" required>
            <Input value={nomor} onChangeText={setNomor} placeholder="Nomor invoice masuk" />
          </FormField>

          <View className="flex-row gap-2">
            <View className="flex-1">
              <FormField label="Tanggal Tagihan" required>
                <DatePicker value={tanggal} onChange={setTanggal} />
              </FormField>
            </View>
            <View className="flex-1">
              <FormField label="Jatuh Tempo" required>
                <DatePicker value={jatuhTempo} onChange={setJatuhTempo} />
              </FormField>
            </View>
          </View>

          <FormField label="Nominal Tagihan / Nilai Dasar (Rp)" required>
            <Input
              value={dppStr}
              onChangeText={(v) => setDppStr(formatThousands(v))}
              keyboardType="numeric"
              placeholder="0"
            />
          </FormField>

          <FormField label="Ketentuan PPN Masukan">
            <View className="flex-row flex-wrap gap-1.5">
              {(
                [
                  { id: "none", label: "Tanpa PPN (0%)" },
                  { id: "exclude", label: "+ PPN 11% (Exclude)" },
                  { id: "include", label: "Termasuk PPN 11% (Include)" },
                ] as const
              ).map((opt) => (
                <Button
                  key={opt.id}
                  size="sm"
                  variant={ppnMode === opt.id ? "default" : "outline"}
                  onPress={() => setPpnMode(opt.id)}
                  className="h-8 px-2.5"
                >
                  <Text className="text-xs">{opt.label}</Text>
                </Button>
              ))}
            </View>
          </FormField>

          <View className="bg-panel rounded-xl border border-border p-3 gap-1">
            <View className="flex-row justify-between">
              <Text className="text-xs text-muted-foreground">DPP (Sebelum PPN):</Text>
              <Text className="text-xs font-medium">{rupiah(effectiveDpp)}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-xs text-muted-foreground">PPN Masukan (11%):</Text>
              <Text className="text-xs font-medium">{rupiah(effectivePpn)}</Text>
            </View>
            <View className="flex-row justify-between pt-1 border-t border-border">
              <Text className="text-xs font-bold">Total Tagihan:</Text>
              <Text className="text-sm font-bold text-primary">{rupiah(effectiveTotal)}</Text>
            </View>
          </View>

          <FormField label="Upload / Ganti Dokumen Tagihan Masuk (Opsional)">
            {fileId ? (
              <View className="mb-2 flex-row items-center justify-between p-2.5 rounded-lg border border-primary/30 bg-primary/10">
                <View className="flex-row items-center gap-2 flex-1 mr-2">
                  <FileText size={15} color={colors.primary} />
                  <Text className="text-xs font-medium text-foreground" numberOfLines={1}>
                    {invoice.file?.originalName && Number(invoice.fileId) === Number(fileId)
                      ? `Terlampir: ${invoice.file.originalName}`
                      : `✓ Dokumen tagihan siap disimpan (File #${fileId})`}
                  </Text>
                </View>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 flex-row items-center gap-1"
                  onPress={() => openDownloadFile(fileId)}
                >
                  <ExternalLink size={12} color={colors.primary} />
                  <Text className="text-[11px] text-primary font-semibold">Lihat File</Text>
                </Button>
              </View>
            ) : null}
            <FileUploader
              label={fileId ? "Ganti File PDF / Foto Tagihan Masuk" : "Pilih File PDF / Foto Tagihan Masuk"}
              kind="semua"
              category="invoice"
              autoFlush
              handleRef={(h) => { docUploaderRef.current = h; }}
              onUploaded={(id: number | null) => setFileId(id)}
            />
          </FormField>

          <FormField label="Upload / Ganti Bukti Pembayaran (Opsional)">
            {transferFileId ? (
              <View className="mb-2 flex-row items-center justify-between p-2.5 rounded-lg border border-success/30 bg-success/10">
                <View className="flex-row items-center gap-2 flex-1 mr-2">
                  <FileText size={15} color={colors.success} />
                  <Text className="text-xs font-medium text-foreground" numberOfLines={1}>
                    {(invoice as any).transferFile?.originalName && Number(invoice.transferFileId) === Number(transferFileId)
                      ? `Terlampir: ${(invoice as any).transferFile.originalName}`
                      : `✓ Bukti pembayaran siap disimpan (File #${transferFileId})`}
                  </Text>
                </View>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 flex-row items-center gap-1"
                  onPress={() => openDownloadFile(transferFileId)}
                >
                  <ExternalLink size={12} color={colors.success} />
                  <Text className="text-[11px] text-success font-semibold">Lihat Bukti</Text>
                </Button>
              </View>
            ) : null}
            <FileUploader
              label={transferFileId ? "Ganti File Foto / PDF Bukti Pembayaran" : "Pilih File Foto / PDF Bukti Pembayaran"}
              kind="semua"
              category="invoice"
              autoFlush
              handleRef={(h) => { payUploaderRef.current = h; }}
              onUploaded={(id: number | null) => setTransferFileId(id)}
            />
          </FormField>

          <FormField label="Catatan / Keterangan Tagihan">
            <Textarea
              value={catatan}
              onChangeText={setCatatan}
              placeholder="Catatan tagihan masuk..."
            />
          </FormField>
        </View>
      </ScrollView>

      <DialogFooter className="flex-row items-center justify-end gap-2 pt-2">
        <Button variant="outline" onPress={() => onOpenChange(false)} disabled={submitting}>
          <Text>Batal</Text>
        </Button>
        <Button onPress={handleSave} disabled={submitting} className="bg-primary flex-row items-center gap-1.5">
          <Check size={16} color={colors.background} />
          <Text className="text-primary-foreground font-medium">
            {submitting ? "Menyimpan..." : "Simpan Perubahan"}
          </Text>
        </Button>
      </DialogFooter>
    </>
  );
}

export function SupplierInvoiceEditDialog({
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
      <DialogContent
        className="w-[94vw] max-w-4xl max-h-[92vh]"
        style={Platform.select({
          web: { width: "min(94vw, 820px)", maxWidth: "820px" } as any,
        })}
      >
        <SupplierInvoiceEditForm
          key={`${invoice.id}-${invoice.nomor}-${invoice.total}`}
          invoice={invoice}
          onOpenChange={onOpenChange}
          onSuccess={onSuccess}
        />
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
  const [coaAccount, setCoaAccount] = React.useState<string>("1000.02");
  const [reference, setReference] = React.useState(() => `TRF-${invoice.nomor || invoice.id}`);
  const [fileId, setFileId] = React.useState<number | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const kasBankOptions = React.useMemo(() => getKasBankAccounts(), []);

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
        reference: `[AKUN:${coaAccount}] ${reference.trim()}`,
        coaAccount,
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
                onPress={() => {
                  setMethod(m);
                  if (m === "TUNAI") {
                    const cashAcc = kasBankOptions.find((o) => o.code === "1000.01" || /kas/i.test(o.rawName));
                    if (cashAcc) setCoaAccount(cashAcc.code);
                  } else {
                    const firstBank = kasBankOptions.find((o) => o.code !== "1000.01" && !/kas/i.test(o.rawName));
                    if (firstBank) setCoaAccount(firstBank.code);
                  }
                }}
                className="flex-1"
              >
                <Text className={method === m ? "text-primary-foreground text-xs" : "text-xs"}>{m}</Text>
              </Button>
            ))}
          </View>
        </FormField>

        <FormField
          label="Pilih Akun Kas / Bank (CoA) Sumber Bayar"
          required
          hint="Rekening kas atau bank yang dipotong untuk pembayaran ini"
        >
          <SearchableSelect
            value={
              kasBankOptions.find((o) => o.code === coaAccount)?.name ||
              kasBankOptions[0]?.name ||
              ""
            }
            options={kasBankOptions.map((o) => o.name)}
            onChange={(val) => {
              const match = kasBankOptions.find((o) => o.name === val || val.includes(o.code));
              if (match) {
                setCoaAccount(match.code);
                const isTunai = match.code === "1000.01" || /kas/i.test(match.rawName);
                setMethod(isTunai ? "TUNAI" : "TRANSFER");
              }
            }}
            placeholder="Pilih rekening kas / bank..."
          />
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
      <DialogContent
        className="w-[94vw] max-w-2xl max-h-[90vh]"
        style={Platform.select({
          web: { width: "min(94vw, 640px)", maxWidth: "640px" } as any,
        })}
      >
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

