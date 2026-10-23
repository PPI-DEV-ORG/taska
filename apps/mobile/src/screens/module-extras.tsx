import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { AlertTriangle, CheckCircle2, ExternalLink, RefreshCw } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";
import { Panel, Cell, FormField } from "@/components/taska/basics";
import { SearchableSelect } from "@/components/taska/dialogs";
import { StatusBadge } from "@/components/taska/status-badge";
import { useApp } from "@/store/app-store";
import { api } from "@/services/api";
import { colors } from "@/tokens";
import { rupiah, tanggal } from "@/lib/format";
import { type Row } from "@/constants/modules";
import { Line } from "@/modules/shared/line";
import { LeadExtras } from "@/modules/lead/lead-extras";
import { QuotationExtras } from "@/modules/quotation/quotation-extras";
import { SurveyExtras } from "@/modules/survey/survey-extras";
import { ReceivingExtras } from "@/modules/receiving/receiving-extras";
import { DeliveryNotesExtras } from "@/modules/delivery-note/delivery-note-extras";
import { ProjectExtras } from "@/modules/project/project-extras";
import { InvoiceExtras } from "@/modules/invoice/invoice-extras";
import { SupplierPoExtras } from "@/modules/supplier-po/supplier-po-extras";
import { PurchaseRequestExtras } from "@/modules/purchase-request/purchase-request-extras";

// Re-export agar import lama dari "@/screens/module-extras" tetap valid.
export { downloadQuotationTemplate, downloadQuotationPdf } from "@/modules/quotation/quotation-files";
export { QuotationPreviewModal } from "@/modules/quotation/quotation-preview-modal";
export { QuotationTemplateGenerator } from "@/modules/quotation/quotation-template-generator";
export type { QuotationItem } from "@/modules/quotation/types";

function DamageReportExtras({ row, onRefresh }: { row: Row; onRefresh?: () => Promise<void> | void }) {
  const { data, toast, reload, refreshModule } = useApp();
  const [replaceOpen, setReplaceOpen] = React.useState(false);
  const [newSn, setNewSn] = React.useState("");
  const [replaceQty, setReplaceQty] = React.useState(String(row.qty || 1));
  const [warehouseName, setWarehouseName] = React.useState(String(data.warehouses?.[0]?.nama ?? ""));
  const [reason, setReason] = React.useState(`Penggantian unit ${row.produk}${row.sn && row.sn !== "-" ? ` (SN lama: ${row.sn})` : ""}`);
  const [busy, setBusy] = React.useState(false);

  const prodObj = (data.products ?? []).find(
    (p: any) => String(p.id) === String(row.productId) || p.nama === row.produk,
  );
  const isSerialProduct = !!(row.hasSerial || prodObj?.berSN || prodObj?.hasSerial || (row.sn && row.sn !== "-"));
  const alreadyReplaced = row.snPengganti && row.snPengganti !== "-";

  async function handleReceiveReplacement() {
    if (isSerialProduct && !newSn.trim()) {
      toast("Masukkan nomor Serial Number (SN) baru untuk unit pengganti", "danger");
      return;
    }
    const wh = (data.warehouses ?? []).find((w: any) => w.nama === warehouseName) ?? data.warehouses?.[0];
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
      toast(e?.message || "Gagal memproses penerimaan unit pengganti", "danger");
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
              <Text className="text-xs font-semibold text-primary-foreground">Terima Barang Pengganti</Text>
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
              <StatusBadge status={row.sn && row.sn !== "-" ? `SN Lama: ${row.sn}` : `${row.qty || 1} Unit`} />
            </View>
            <Text className="text-xs text-muted-foreground leading-relaxed">
              • Status unit SN lama ({row.sn && row.sn !== "-" ? row.sn : "barang terkait"}) otomatis berubah menjadi{" "}
              <Text className="font-semibold text-danger">{row.jenis?.includes("Retur") ? "RETUR" : "RUSAK"}</Text>{" "}
              (atau <Text className="font-semibold text-foreground">DIGANTI</Text> setelah unit baru tiba).{"\n"}
              • Saldo stok bagus yang siap pakai di gudang otomatis <Text className="font-semibold text-danger">berkurang (-{row.qty || 1})</Text> agar tidak terpilih di Penawaran/Invoice baru.
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
                : "Ketika unit pengganti dari supplier/garansi tiba (misal SN baru), klik tombol 'Terima Barang Pengganti' di atas. Sistem otomatis mendaftarkan SN baru ke gudang, menambah kembali stok tersedia (+1), menautkan SN lama → SN baru, dan menutup laporan ini menjadi Selesai."}
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
              <Text className="text-xs text-muted-foreground">Barang yang Diganti:</Text>
              <Text className="text-sm font-bold text-foreground">{row.produk}</Text>
              {row.sn && row.sn !== "-" ? (
                <Text className="text-xs font-mono text-danger">SN Lama (Rusak/Retur): {row.sn}</Text>
              ) : null}
            </View>

            {isSerialProduct ? (
              <FormField label="Serial Number (SN) Unit Pengganti Baru" required>
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
                value={warehouseName || String(data.warehouses?.[0]?.nama ?? "")}
                onChange={setWarehouseName}
                options={(data.warehouses ?? []).map((w: any) => String(w.nama))}
                placeholder="Pilih gudang..."
              />
            </FormField>

            <FormField label="Catatan / Alasan Penggantian" required>
              <Textarea
                value={reason}
                onChangeText={setReason}
                placeholder="Contoh: Unit pengganti klaim garansi / retur dari supplier"
              />
            </FormField>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setReplaceOpen(false)} disabled={busy}>
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

export function ModuleExtras({
  moduleKey,
  row,
  onRefresh,
  invoicePayOpen,
  onInvoicePayOpenChange,
}: {
  moduleKey: string;
  row: Row;
  onRefresh?: () => Promise<void> | void;
  invoicePayOpen?: boolean;
  onInvoicePayOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const { user, data } = useApp();

  if (moduleKey === "leads") {
    return <LeadExtras row={row} />;
  }

  if (moduleKey === "quotations") {
    return <QuotationExtras row={row} onRefresh={onRefresh} />;
  }

  if (moduleKey === "surveys") {
    return <SurveyExtras row={row} />;
  }

  if (moduleKey === "projects") {
    return <ProjectExtras row={row} />;
  }

  if (moduleKey === "po-client") {
    const sisa = row.nilai - row.totalInvoice;
    const cleanQuoNum = String(row.penawaran || "").split(" - ")[0]?.trim().toLowerCase();
    const linkedQuotation = (data.quotations ?? []).find(
      (q: Row) =>
        (row.quotationId && String(q.id) === String(row.quotationId)) ||
        (cleanQuoNum && cleanQuoNum !== "-" && String(q.nomor || "").toLowerCase() === cleanQuoNum),
    );
    const quoItems: any[] = Array.isArray(linkedQuotation?.items) ? linkedQuotation.items : [];
    const linkedInvoices = (data.invoices ?? []).filter(
      (inv: Row) =>
        inv.direction !== "in" &&
        ((inv.clientPoId && String(inv.clientPoId) === String(row.id)) ||
          (inv.po && inv.po !== "-" && String(inv.po).toLowerCase() === String(row.nomor || "").toLowerCase()) ||
          (linkedQuotation && String(inv.quotationId) === String(linkedQuotation.id))),
    );
    const linkedProjects = (data.projects ?? []).filter(
      (p: Row) =>
        (linkedQuotation && String(p.quotationId) === String(linkedQuotation.id)) ||
        (row.customer && p.customer === row.customer),
    );

    return (
      <>
        {row.totalInvoice > row.nilai ? (
          <View className="bg-warning/15 flex-row items-center gap-2 rounded-xl p-3">
            <AlertTriangle size={16} color={colors.warning} />
            <Text className="text-warning flex-1 text-sm">
              Total invoice melebihi nilai Sales Order / PO sebesar {rupiah(-sisa)}. Ini hanya peringatan, data tetap tersimpan.
            </Text>
          </View>
        ) : null}

        <Panel
          title="Ringkasan Sales Order / PO Client"
          right={
            linkedQuotation ? (
              <Button size="sm" variant="outline" onPress={() => router.push(`/quotations/${linkedQuotation.id}` as any)}>
                <ExternalLink size={13} color={colors.text} />
                <Text className="text-xs">Buka Penawaran ({linkedQuotation.nomor})</Text>
              </Button>
            ) : undefined
          }
        >
          <Line left="Total Nilai SO / PO" right={<Text className="text-sm font-semibold">{rupiah(row.nilai)}</Text>} />
          <Line left="Total Faktur / Invoice" right={<Text className="text-sm font-medium">{rupiah(row.totalInvoice)}</Text>} />
          <Line left="Sisa Belum Ditagih" right={<Text className="text-sm font-medium text-primary">{rupiah(Math.max(0, sisa))}</Text>} />
        </Panel>

        <Panel
          title={`Rincian Barang, Jasa & SN (${quoItems.length} item)`}
          subtitle={linkedQuotation ? `Diambil dari Penawaran ${linkedQuotation.nomor}` : "Daftar item pesanan client"}
        >
          {quoItems.length === 0 ? (
            <Text className="text-muted-foreground text-sm py-1">
              Belum ada rincian item dari penawaran terkait.
            </Text>
          ) : (
            <View className="gap-2">
              {quoItems.map((it: any, idx: number) => {
                const sn = it.serialNumber || it.sn || null;
                const isCustom = it.itemType === "CUSTOM" || (!it.productId && !sn);
                return (
                  <View key={it.id ?? idx} className="border-border/60 flex-row items-center justify-between border-b py-2.5 last:border-b-0">
                    <View className="flex-1 min-w-0 pr-3">
                      <View className="flex-row items-center gap-1.5 flex-wrap">
                        <Text className="text-sm font-semibold text-foreground">{it.name || it.nama || "Item"}</Text>
                        <StatusBadge
                          status={sn ? `SN: ${sn}` : isCustom ? "Jasa / Teks" : "Barang Non-SN"}
                        />
                      </View>
                      <Text className="text-muted-foreground text-xs mt-0.5">
                        {it.qty || 1} {it.unit || "Unit"} × {rupiah(Number(it.price) || 0)}
                      </Text>
                    </View>
                    <Text className="text-sm font-semibold text-foreground">
                      {rupiah((Number(it.qty) || 1) * (Number(it.price) || 0))}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </Panel>

        <Panel
          title={`Faktur Penjualan / Invoice Terkait (${linkedInvoices.length})`}
          right={
            <Button size="sm" variant="outline" onPress={() => router.push("/invoices" as any)}>
              <Text className="text-xs">Kelola Invoice</Text>
            </Button>
          }
        >
          {linkedInvoices.length === 0 ? (
            <Text className="text-muted-foreground text-sm py-1">Belum ada invoice untuk Sales Order / PO ini.</Text>
          ) : (
            linkedInvoices.map((inv: Row) => (
              <Line
                key={inv.id}
                left={`${inv.nomor} (${inv.jenis})`}
                sub={`Total ${rupiah(inv.total)} · Terbayar ${rupiah(inv.terbayar)}`}
                right={
                  <View className="flex-row items-center gap-2">
                    <Cell fmt="status" value={inv.status} />
                    <Button size="sm" variant="outline" onPress={() => router.push(`/invoices/${inv.id}` as any)}>
                      <Text className="text-xs">Buka</Text>
                    </Button>
                  </View>
                }
              />
            ))
          )}
        </Panel>

        {linkedProjects.length > 0 ? (
          <Panel title={`Project Terkait (${linkedProjects.length})`}>
            {linkedProjects.map((proj: Row) => (
              <Line
                key={proj.id}
                left={proj.nama}
                sub={`PIC: ${proj.pm || "-"} · Progres ${proj.progres ?? 0}%`}
                right={
                  <View className="flex-row items-center gap-2">
                    <Cell fmt="status" value={proj.status} />
                    <Button size="sm" variant="outline" onPress={() => router.push(`/projects/${proj.id}` as any)}>
                      <Text className="text-xs">Buka Project</Text>
                    </Button>
                  </View>
                }
              />
            ))}
          </Panel>
        ) : null}
      </>
    );
  }

  if (moduleKey === "invoices") {
    return (
      <InvoiceExtras
        row={row}
        payOpen={invoicePayOpen}
        onPayOpenChange={onInvoicePayOpenChange}
      />
    );
  }

  if (moduleKey === "supplier-pos") {
    return <SupplierPoExtras row={row} />;
  }

  if (moduleKey === "purchase-requests") {
    return <PurchaseRequestExtras row={row} onRefresh={onRefresh} />;
  }

  if (moduleKey === "delivery-notes") {
    return <DeliveryNotesExtras row={row} onRefresh={onRefresh} />;
  }

  if (moduleKey === "expenses") {
    return row.nominal > 10_000_000 ? (
      <View className="bg-warning/15 flex-row items-center gap-2 rounded-xl p-3">
        <AlertTriangle size={16} color={colors.warning} />
        <Text className="text-warning flex-1 text-sm">Nominal besar. Perlu persetujuan Bos selain Finance.</Text>
      </View>
    ) : null;
  }

  if (moduleKey === "receiving") {
    return <ReceivingExtras row={row} />;
  }

  if (moduleKey === "damage-reports") {
    return <DamageReportExtras row={row} onRefresh={onRefresh} />;
  }

  if (moduleKey === "customers") {
    const leads = (data.leads ?? []).filter((l: Row) => l.perusahaan === row.nama);
    return (
      <Panel title={`Lead milik customer ini (${leads.length})`}>
        {leads.length === 0 ? <Text className="text-muted-foreground text-sm">Belum ada lead.</Text> : leads.map((l) => (
          <Line key={l.id} left={l.nama} sub={`Perkiraan closing ${tanggal(l.closing)}`} right={<Cell fmt="status" value={l.status} />} />
        ))}
      </Panel>
    );
  }

  if (moduleKey === "opname") {
    const details = row._details ?? [];
    return (
      <Panel title={`Rincian Hitungan Fisik (${details.length} Produk)`} subtitle="Perbandingan stok sistem vs hitungan riil di gudang">
        {details.length === 0 ? (
          <Text className="text-muted-foreground text-sm py-2">Belum ada rincian produk.</Text>
        ) : (
          <View className="gap-2">
            {details.map((d: any, idx: number) => {
              const productName = d.product?.name ?? `Produk #${d.productId}`;
              const sku = d.product?.sku ? `SKU: ${d.product.sku} · ` : "";
              const unit = d.product?.unit ? ` ${d.product.unit}` : "";
              const diff = Number(d.diff ?? 0);
              return (
                <View
                  key={d.id ?? idx}
                  className="border-border/60 flex-row items-center justify-between border-b py-3 last:border-b-0"
                >
                  <View className="flex-1 min-w-0 pr-3">
                    <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                      {productName}
                    </Text>
                    <Text className="text-muted-foreground text-xs mt-0.5">
                      {sku}Sistem: {d.systemQty}{unit} · Fisik: {d.countedQty}{unit}
                    </Text>
                    {d.note ? (
                      <Text className="text-muted-foreground text-[11px] italic mt-0.5">Catatan: {d.note}</Text>
                    ) : null}
                  </View>
                  <View className="items-end shrink-0">
                    {diff === 0 ? (
                      <Text className="text-success text-xs font-semibold">Cocok (0)</Text>
                    ) : diff < 0 ? (
                      <Text className="text-danger text-xs font-semibold">{diff}{unit}</Text>
                    ) : (
                      <Text className="text-info text-xs font-semibold">+{diff}{unit}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Panel>
    );
  }

  return null;
}
