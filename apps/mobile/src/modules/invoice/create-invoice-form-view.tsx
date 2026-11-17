import { View, ScrollView, Platform } from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  QuickAddCustomerDialog,
  QuickAddSupplierDialog,
} from "@/components/taska/dialogs";
import { SerialItemPickerModal } from "@/components/taska/serial-item-picker";
import { rupiah } from "@/lib/format";
import { type QuotationItem } from "@/modules/quotation/types";
import { StepTitle } from "./invoice-step-title";
import type { InvoiceFormScope } from "./use-invoice-form";
import { InvoiceStep1 } from "./invoice-step-1";
import { InvoiceStep2 } from "./invoice-step-2";
import { InvoiceStep3 } from "./invoice-step-3";
import { InvoiceSummary } from "./invoice-summary";

export function CreateInvoiceFormView({ form }: { form: InvoiceFormScope }) {
  const {
    activeLead,
    activePo,
    activeQuotation,
    currentTotal,
    editItems,
    handleSubmit,
    isProforma,
    isSubmitting,
    items,
    mode,
    onClose,
    pickerOpen,
    quickCustomerOpen,
    quickSupplierOpen,
    selectedParentInvoice,
    setCustomCustomerName,
    setCustomSupplierName,
    setPickerOpen,
    setQuickCustomerOpen,
    setQuickSupplierOpen,
    setSelectedCustomerId,
    setSelectedSupplierId,
    sourceType,
    toast,
  } = form;

  return (
    <DialogContent
      className="w-[94vw] max-w-4xl max-h-[92vh]"
      style={Platform.select({
        web: { width: "min(94vw, 860px)", maxWidth: "860px" } as any,
      })}
    >
      <DialogHeader>
        <DialogTitle className="flex-row items-center gap-2">
          <Text className="text-base font-bold">
            {mode === "masuk"
              ? "Buat Faktur Masuk (Tagihan / Pembelian)"
              : sourceType === "direct_sale"
                ? "Faktur Penjualan Langsung"
                : isProforma
                  ? "Buat Proforma Invoice"
                  : "Buat Faktur Penagihan (Faktur Keluar)"}
          </Text>
          {mode === "masuk" ? (
            <Text className="text-xs font-semibold px-2 py-0.5 rounded bg-warning/15 text-warning">
              Invoice Masuk
            </Text>
          ) : sourceType === "direct_sale" ? (
            <Text className="text-xs font-semibold px-2 py-0.5 rounded bg-success/15 text-success">
              Penjualan Langsung
            </Text>
          ) : mode === "lanjut" && selectedParentInvoice ? (
            <Text className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
              Acuan:{" "}
              {selectedParentInvoice.nomor || selectedParentInvoice.number}
            </Text>
          ) : activePo ? (
            <Text className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
              SO: {activePo.nomorSo || activePo.nomor}
            </Text>
          ) : activeQuotation ? (
            <Text className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
              {activeQuotation.nomor}
            </Text>
          ) : activeLead ? (
            <Text className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
              Lead: {activeLead.nama}
            </Text>
          ) : null}
        </DialogTitle>
      </DialogHeader>

      <ScrollView
        className="max-h-[80vh] px-1"
        showsVerticalScrollIndicator={false}
      >
        <InvoiceStep1 form={form} />
        <StepTitle
          n={2}
          title="Rincian & nilai tagihan"
          hint="Cek tanggal, item, diskon, dan PPN. Ringkasan angka ada di bawah."
        />
        <View className="gap-3 mb-4">
          <InvoiceStep2 form={form} />
          <InvoiceStep3 form={form} />
        </View>
        <InvoiceSummary form={form} />
      </ScrollView>

      <DialogFooter className="flex-row flex-wrap items-center gap-2">
        <View className="flex-1 min-w-[160px]">
          <Text className="text-[11px] text-muted-foreground">
            {isProforma && mode !== "masuk"
              ? "Total proforma"
              : mode === "masuk"
                ? "Total tagihan masuk"
                : "Total tagihan invoice ini"}
          </Text>
          <Text className="text-base font-bold text-primary">
            {rupiah(currentTotal)}
          </Text>
        </View>
        <Button variant="outline" onPress={onClose}>
          <Text>Batal</Text>
        </Button>
        <Button onPress={handleSubmit} disabled={isSubmitting}>
          <Text>
            {isSubmitting
              ? "Menyimpan..."
              : mode === "masuk"
                ? "Simpan Faktur Masuk"
                : isProforma
                  ? "Simpan Proforma"
                  : "Terbitkan Invoice"}
          </Text>
        </Button>
      </DialogFooter>

      <SerialItemPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentQuotationId={activeQuotation?.id}
        existingItems={items}
        onAddItems={(newItems) => {
          const existingSnSet = new Set<string>();
          items.forEach((it) => {
            if (Array.isArray(it.serialNumbers))
              it.serialNumbers.forEach((s) =>
                existingSnSet.add(String(s).trim().toUpperCase()),
              );
            const snVal = String(it.item)
              .match(/\(SN:\s*([^\)]+)\)/i)?.[1]
              ?.trim();
            if (snVal) existingSnSet.add(snVal.toUpperCase());
          });
          const valid: QuotationItem[] = [];
          const duplicates: string[] = [];
          newItems.forEach((it) => {
            const snList: string[] = [];
            if (Array.isArray(it.serialNumbers))
              it.serialNumbers.forEach((s) =>
                snList.push(String(s).trim().toUpperCase()),
              );
            const snVal = String(it.item)
              .match(/\(SN:\s*([^\)]+)\)/i)?.[1]
              ?.trim();
            if (snVal) snList.push(snVal.toUpperCase());
            const hasDup = snList.some((s) => existingSnSet.has(s));
            if (hasDup) {
              duplicates.push(snList.join(", "));
            } else {
              snList.forEach((s) => existingSnSet.add(s));
              valid.push(it);
            }
          });
          if (duplicates.length > 0) {
            toast(
              `Barang/item dengan SN (${duplicates.join(", ")}) sudah ada di invoice`,
              "danger",
            );
          }
          if (valid.length > 0) {
            editItems([...items, ...valid]);
          }
        }}
      />

      <QuickAddCustomerDialog
        open={quickCustomerOpen}
        onOpenChange={setQuickCustomerOpen}
        onSuccess={(newCust) => {
          setSelectedCustomerId(String(newCust.id));
          setCustomCustomerName(newCust.nama);
        }}
      />

      <QuickAddSupplierDialog
        open={quickSupplierOpen}
        onOpenChange={setQuickSupplierOpen}
        onSuccess={(newSupp) => {
          setSelectedSupplierId(String(newSupp.id));
          setCustomSupplierName(newSupp.nama);
        }}
      />
    </DialogContent>
  );
}
