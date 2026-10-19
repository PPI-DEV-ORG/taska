import { View } from "react-native";
import { AlertTriangle } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Panel, Cell } from "@/components/taska/basics";
import { useApp } from "@/store/app-store";
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
  const { user, data } = useApp();

  if (moduleKey === "leads") {
    return <LeadExtras row={row} />;
  }

  if (moduleKey === "quotations") {
    return <QuotationExtras row={row} />;
  }

  if (moduleKey === "surveys") {
    return <SurveyExtras row={row} />;
  }

  if (moduleKey === "projects") {
    return <ProjectExtras row={row} />;
  }

  if (moduleKey === "po-client") {
    const sisa = row.nilai - row.totalInvoice;
    return (
      <>
        {row.totalInvoice > row.nilai ? (
          <View className="bg-warning/15 flex-row items-center gap-2 rounded-xl p-3">
            <AlertTriangle size={16} color={colors.warning} />
            <Text className="text-warning flex-1 text-sm">Total invoice melebihi nilai PO sebesar {rupiah(-sisa)}. Ini hanya peringatan, data tetap tersimpan.</Text>
          </View>
        ) : null}
        <Panel title="Ringkasan PO">
          <Line left="Total PO" right={<Text className="text-sm font-medium">{rupiah(row.nilai)}</Text>} />
          <Line left="Total invoice" right={<Text className="text-sm font-medium">{rupiah(row.totalInvoice)}</Text>} />
          <Line left="Sisa" right={<Text className="text-sm font-medium">{rupiah(Math.max(0, sisa))}</Text>} />
        </Panel>
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
    return <DeliveryNotesExtras row={row} />;
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
