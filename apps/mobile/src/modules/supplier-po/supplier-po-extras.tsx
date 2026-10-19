import * as React from "react";
import { View } from "react-native";
import { CheckCircle2, Circle, Plus } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Panel, FormField } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { DatePicker } from "@/components/taska/dialogs";
import { FileUploader } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { api } from "@/services/api";
import { colors } from "@/tokens";
import { rupiah, tanggal } from "@/lib/format";
import { type Row } from "@/constants/modules";
import { Line } from "@/modules/shared/line";

import {
  SupplierInvoiceDetailDialog,
  SupplierInvoicePayDialog,
} from "@/modules/supplier-po/supplier-invoice-dialogs";

const PRICE_ROLES = ["super_admin", "procurement", "finance", "pm", "bos"];

export function SupplierPoExtras({ row }: { row: Row }) {
  const { user, patchRow, setStatus, addRow, toast, data, reload } = useApp();
  const steps = ["Di Supplier", "Dikirim", "Sampai"];
  const cur = steps.indexOf(row.pengiriman);
  const showPrice = PRICE_ROLES.includes(user!.role);

  const supplierInvoices: Row[] = (data.invoiceIn ?? []).filter(
    (inv: Row) => String(inv.supplierPoId) === String(row.id) || inv.po === row.nomor
  );

  const [invOpen, setInvOpen] = React.useState(false);
  const [invNumber, setInvNumber] = React.useState(`INV-SUP-${row.nomor || row.id}`);
  const [invAmount, setInvAmount] = React.useState(String(row.total || 0));
  const [invDate, setInvDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [invDue, setInvDue] = React.useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [invFileId, setInvFileId] = React.useState<number | null>(null);

  const [selectedDetailInv, setSelectedDetailInv] = React.useState<Row | null>(null);
  const [payTargetInv, setPayTargetInv] = React.useState<Row | null>(null);

  function go(s: string) {
    patchRow("supplier-pos", row.id, { pengiriman: s, status: s });
    setStatus("supplier-pos", row.id, s);
  }

  async function handleCreateInvoiceIn() {
    const amt = Number(String(invAmount).replace(/\D/g, "")) || 0;
    const ppn = Math.round(amt * 0.11);
    const created = await addRow("invoiceIn", {
      nomor: invNumber,
      supplierId: row.supplierId,
      supplier: row.supplier,
      supplierPoId: row.id,
      po: row.nomor,
      nilai: amt,
      ppn,
      total: amt + ppn,
      jatuhTempo: invDue,
      fileId: invFileId ?? undefined,
    });
    if (created) {
      setInvOpen(false);
      setInvFileId(null);
      await reload();
    }
  }

  const canPay = user?.role === "super_admin" || user?.role === "finance" || user?.role === "bos" || user?.role === "admin";

  return (
    <>
      <Panel title="Pengiriman dari supplier" subtitle="Status diubah manual oleh Procurement dengan bukti DO">
        {steps.map((s, i) => (
          <View key={s} className="flex-row items-center gap-3 py-2">
            {i <= cur ? <CheckCircle2 size={20} color={colors.success} /> : <Circle size={20} color={colors.border} />}
            <Text className={i <= cur ? "text-sm font-medium" : "text-muted-foreground text-sm"}>{s}</Text>
          </View>
        ))}
        {(user!.role === "super_admin" || user!.role === "procurement" || user!.role === "bos" || user!.role === "admin") && cur < 2 && steps[cur + 1] ? (
          <Button
            className="mt-2 self-start"
            variant="outline"
            onPress={() => {
              const nextStep = steps[cur + 1];
              if (nextStep) go(nextStep);
            }}
          >
            <Text>Tandai {steps[cur + 1]}</Text>
          </Button>
        ) : null}
      </Panel>
      <Panel title="Barang di PO ini">
        {Array.isArray(row.items) && row.items.length > 0 ? (
          row.items.map((it: any, idx: number) => {
            const prodName = it.product?.name || it.productName || it.name || it.product?.sku || `Barang #${idx + 1}`;
            const qtyText = `${it.qty || 1} ${it.product?.unit || it.unit || "Unit"}`;
            const itemTotal = Number(it.price ? it.price * (it.qty || 1) : 0);
            return (
              <Line
                key={it.id || idx}
                left={`${prodName} (${qtyText})`}
                right={
                  showPrice ? (
                    <Text className="text-sm font-semibold">
                      {itemTotal > 0 ? rupiah(itemTotal) : <Text className="text-muted-foreground text-xs font-normal">Harga beli tampil</Text>}
                    </Text>
                  ) : undefined
                }
              />
            );
          })
        ) : row.item && row.item !== "-" ? (
          String(row.item)
            .split(", ")
            .map((it) => (
              <Line
                key={it}
                left={it}
                right={showPrice ? <Text className="text-muted-foreground text-sm">Harga beli tampil</Text> : undefined}
              />
            ))
        ) : (
          <Text className="text-muted-foreground text-xs py-1">Belum ada rincian barang di PO ini.</Text>
        )}
        {showPrice ? (
          <Line left="Total harga beli" right={<Text className="text-sm font-bold text-primary">{rupiah(row.total)}</Text>} />
        ) : null}
        <Text className="text-muted-foreground mt-2 text-[13px]">Penerimaan sebagian diperbolehkan di Gudang.</Text>
      </Panel>

      {showPrice ? (
        <Panel
          title="Invoice Masuk & Pembayaran ke Supplier"
          subtitle="Tagihan dari supplier atas PO ini beserta status pelunasan oleh Finance."
          right={
            <Button size="sm" variant="outline" onPress={() => setInvOpen(true)} className="flex-row items-center gap-1">
              <Plus size={14} color={colors.text} />
              <Text className="text-xs">Catat Invoice Masuk</Text>
            </Button>
          }
        >
          {supplierInvoices.length === 0 ? (
            <Text className="text-muted-foreground text-xs py-1">Belum ada tagihan (Invoice Masuk) dari supplier untuk PO ini.</Text>
          ) : (
            supplierInvoices.map((inv) => {
              const lunas = Number(inv.terbayar || 0) >= Number(inv.total || 0) && Number(inv.total || 0) > 0;
              return (
                <Line
                  key={inv.id}
                  left={`${inv.nomor} · Jatuh tempo ${inv.jatuhTempo || "-"}`}
                  sub={`Dibayar: ${rupiah(inv.terbayar || 0)} dari ${rupiah(inv.total || 0)} (${inv.status})`}
                  right={
                    <View className="flex-row items-center gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 px-2" onPress={() => setSelectedDetailInv(inv)}>
                        <Text className="text-xs">Detail</Text>
                      </Button>
                      {!lunas && canPay ? (
                        <Button size="sm" className="h-7 px-2 bg-primary" onPress={() => setPayTargetInv(inv)}>
                          <Text className="text-xs text-primary-foreground font-medium">Lunasi</Text>
                        </Button>
                      ) : (
                        <StatusBadge status={lunas ? "Lunas" : inv.status} />
                      )}
                    </View>
                  }
                />
              );
            })
          )}
        </Panel>
      ) : null}

      <Dialog open={invOpen} onOpenChange={setInvOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Catat Invoice Masuk Supplier</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <FormField label="Nomor Invoice Supplier" required>
              <Input value={invNumber} onChangeText={setInvNumber} />
            </FormField>
            <FormField label="Nilai DPP Sebelum PPN (Rp)" required>
              <Input value={invAmount} onChangeText={setInvAmount} keyboardType="numeric" />
            </FormField>
            <FormField label="Tanggal Invoice" required>
              <DatePicker value={invDate} onChange={setInvDate} />
            </FormField>
            <FormField label="Jatuh Tempo" required>
              <DatePicker value={invDue} onChange={setInvDue} />
            </FormField>
            <FileUploader
              label="Upload File Invoice dari Supplier"
              kind="dokumen"
              category="invoice"
              autoFlush
              onUploaded={(fileId) => setInvFileId(fileId)}
            />
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setInvOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleCreateInvoiceIn}>
              <Text>Simpan Invoice Masuk</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SupplierInvoiceDetailDialog
        open={!!selectedDetailInv}
        onOpenChange={(v) => !v && setSelectedDetailInv(null)}
        invoice={selectedDetailInv}
        canPay={canPay}
        onPayPress={(inv) => setPayTargetInv(inv)}
      />

      <SupplierInvoicePayDialog
        open={!!payTargetInv}
        onOpenChange={(v) => !v && setPayTargetInv(null)}
        invoice={payTargetInv}
        onSuccess={() => {
          setSelectedDetailInv(null);
        }}
      />
    </>
  );
}
