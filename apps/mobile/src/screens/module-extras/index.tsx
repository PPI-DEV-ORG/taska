import * as React from "react";
import { View } from "react-native";
import { AlertTriangle } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Panel, Cell } from "@/components/taska/basics";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { tanggal } from "@/lib/format";
import { type Row } from "@/constants/modules";
import { Line } from "@/modules/shared/line";
import { SupplierExtras } from "./supplier-extras";
import { DamageReportExtras } from "./damage-report-extras";
import { ClientPoExtras } from "./client-po-extras";
import { LeadExtras } from "@/modules/lead/lead-extras";
import { QuotationExtras } from "@/modules/quotation/quotation-extras";
import { SurveyExtras } from "@/modules/survey/survey-extras";
import { PocExtras } from "@/modules/poc/poc-extras";
import { VisitExtras } from "@/modules/visits/visit-extras";
import { MaintenanceExtras } from "@/modules/maintenance/maintenance-extras";
import { ReceivingExtras } from "@/modules/receiving/receiving-extras";
import { DeliveryNotesExtras } from "@/modules/delivery-note/delivery-note-extras";
import { ProjectExtras } from "@/modules/project/project-extras";
import { InvoiceExtras } from "@/modules/invoice/invoice-extras";
import { SupplierPoExtras } from "@/modules/supplier-po/supplier-po-extras";
import { PurchaseRequestExtras } from "@/modules/purchase-request/purchase-request-extras";
import { CashAdvancePanel } from "@/modules/cash-advance/cash-advance-panel";

export function ModuleExtras(
  props: React.ComponentProps<typeof ModuleExtrasBody>,
) {
  return <ModuleExtrasBody {...props} />;
}

export function isPoPurchaseRow(row?: Row | null): boolean {
  if (!row) return false;
  if ((row as any).isSupplierPo) return true;
  if (row.docMode === "PO") return true;
  if (row.supplierId && (!row.customerId || row.customerId === "-"))
    return true;
  if (
    row.supplier &&
    row.supplier !== "-" &&
    (!row.customer ||
      row.customer === "-" ||
      String(row.customer).includes("(Supplier)"))
  ) {
    return true;
  }
  return false;
}

function ModuleExtrasBody({
  moduleKey,
  row,
  onRefresh,
  invoicePayOpen,
  onInvoicePayOpenChange,
  onEditInfo,
  editInfoOpen,
}: {
  moduleKey: string;
  row: Row;
  onRefresh?: () => Promise<void> | void;
  invoicePayOpen?: boolean;
  onInvoicePayOpenChange?: (open: boolean) => void;
  /** Survey: buka/tutup form ubah data umum. */
  onEditInfo?: () => void;
  editInfoOpen?: boolean;
}) {
  const { data } = useApp();

  if (moduleKey === "leads") {
    return <LeadExtras row={row} />;
  }

  if (moduleKey === "quotations") {
    return <QuotationExtras row={row} onRefresh={onRefresh} />;
  }

  if (moduleKey === "surveys") {
    return (
      <SurveyExtras
        row={row}
        onRefresh={onRefresh}
        onEditInfo={onEditInfo}
        editInfoOpen={editInfoOpen}
      />
    );
  }

  if (moduleKey === "poc-reports") {
    return <PocExtras row={row} onRefresh={onRefresh} />;
  }

  if (moduleKey === "visit-reports") {
    return <VisitExtras row={row} onRefresh={onRefresh} />;
  }

  if (moduleKey === "maintenance-reports") {
    return <MaintenanceExtras row={row} onRefresh={onRefresh} />;
  }

  if (moduleKey === "projects") {
    return <ProjectExtras row={row} />;
  }

  if (moduleKey === "po-client") {
    return <ClientPoExtras row={row} onRefresh={onRefresh} />;
  }

  if (moduleKey === "invoices") {
    return (
      <InvoiceExtras
        row={row}
        onRefresh={onRefresh}
        payOpen={invoicePayOpen}
        onPayOpenChange={onInvoicePayOpenChange}
      />
    );
  }

  if (moduleKey === "supplier-pos") {
    return <SupplierPoExtras row={row} onRefresh={onRefresh} />;
  }

  if (moduleKey === "purchase-requests") {
    return <PurchaseRequestExtras row={row} onRefresh={onRefresh} />;
  }

  if (moduleKey === "delivery-notes") {
    return (
      <>
        <CashAdvancePanel
          deliveryNoteId={Number(row.id)}
          purpose="PENGIRIMAN"
          defaultDescription={`Petty cash pengiriman ${row.nomor || ""}`.trim()}
          title="Petty Cash Pengiriman"
          subtitle="Alokasikan biaya kirim / ambil barang. Finance menyerahkan uang ke admin gudang / kurir yang ditugaskan."
        />
        <DeliveryNotesExtras row={row} onRefresh={onRefresh} />
      </>
    );
  }

  if (moduleKey === "expenses") {
    return row.nominal > 10_000_000 ? (
      <View className="bg-warning/15 flex-row items-center gap-2 rounded-xl p-3">
        <AlertTriangle size={16} color={colors.warning} />
        <Text className="text-warning flex-1 text-sm">
          Nominal besar. Perlu persetujuan Bos selain Finance.
        </Text>
      </View>
    ) : null;
  }

  if (moduleKey === "receiving") {
    return <ReceivingExtras row={row} />;
  }

  if (moduleKey === "damage-reports") {
    return <DamageReportExtras row={row} onRefresh={onRefresh} />;
  }

  if (moduleKey === "suppliers") {
    return <SupplierExtras row={row} onRefresh={onRefresh} />;
  }

  if (moduleKey === "customers") {
    const leads = (data.leads ?? []).filter(
      (l: Row) => l.perusahaan === row.nama,
    );
    return (
      <Panel title={`Lead milik customer ini (${leads.length})`}>
        {leads.length === 0 ? (
          <Text className="text-muted-foreground text-sm">
            Belum ada prospek.
          </Text>
        ) : (
          leads.map((l) => (
            <Line
              key={l.id}
              left={l.nama}
              sub={`Perkiraan closing ${tanggal(l.closing)}`}
              right={<Cell fmt="status" value={l.status} />}
            />
          ))
        )}
      </Panel>
    );
  }

  if (moduleKey === "opname") {
    const details = row._details ?? [];
    return (
      <Panel
        title={`Rincian Hitungan Fisik (${details.length} Produk)`}
        subtitle="Perbandingan stok sistem vs hitungan riil di gudang"
      >
        {details.length === 0 ? (
          <Text className="text-muted-foreground text-sm py-2">
            Belum ada rincian produk.
          </Text>
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
                    <Text
                      className="text-sm font-semibold text-foreground"
                      numberOfLines={1}
                    >
                      {productName}
                    </Text>
                    <Text className="text-muted-foreground text-xs mt-0.5">
                      {sku}Sistem: {d.systemQty}
                      {unit} · Fisik: {d.countedQty}
                      {unit}
                    </Text>
                    {d.note ? (
                      <Text className="text-muted-foreground text-[11px] italic mt-0.5">
                        Catatan: {d.note}
                      </Text>
                    ) : null}
                  </View>
                  <View className="items-end shrink-0">
                    {diff === 0 ? (
                      <Text className="text-success text-xs font-semibold">
                        Cocok (0)
                      </Text>
                    ) : diff < 0 ? (
                      <Text className="text-danger text-xs font-semibold">
                        {diff}
                        {unit}
                      </Text>
                    ) : (
                      <Text className="text-info text-xs font-semibold">
                        +{diff}
                        {unit}
                      </Text>
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
