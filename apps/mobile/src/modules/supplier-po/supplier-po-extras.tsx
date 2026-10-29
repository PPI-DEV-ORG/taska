import * as React from "react";
import { View } from "react-native";
import { CheckCircle2, Circle, Plus, Printer, RotateCcw } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Panel, FormField } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { DatePicker, SearchableSelect } from "@/components/taska/dialogs";
import { FileUploader } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { api } from "@/services/api";
import { colors } from "@/tokens";
import { rupiah, tanggal } from "@/lib/format";
import { type Row } from "@/constants/modules";
import { Line } from "@/modules/shared/line";
import { printOrderDocument } from "@/lib/order-print";

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

  const [returOpen, setReturOpen] = React.useState(false);
  const [returProduct, setReturProduct] = React.useState("");
  const [returSn, setReturSn] = React.useState("");
  const [returQty, setReturQty] = React.useState("1");
  const [returNote, setReturNote] = React.useState("");
  const [isSavingRetur, setIsSavingRetur] = React.useState(false);

  const purchaseReturns = React.useMemo(() => {
    const poNo = String(row.nomor || "").toLowerCase();
    return (data["damage-reports"] ?? []).filter((dr: Row) => {
      const ref = String(dr.po || "").toLowerCase();
      return poNo && ref.includes(poNo);
    });
  }, [data, row.nomor]);

  async function handleSavePurchaseReturn() {
    if (!returProduct) {
      toast("Pilih barang yang diretur ke supplier", "danger");
      return;
    }
    if (!returNote.trim()) {
      toast("Alasan retur wajib diisi", "danger");
      return;
    }
    setIsSavingRetur(true);
    try {
      await addRow("damage-reports", {
        produk: returProduct,
        sn: returSn || "-",
        jenis: "Retur Pembelian",
        qty: Number(returQty) || 1,
        tanggal: new Date().toISOString().slice(0, 10),
        po: row.nomor,
        keterangan: returNote.trim(),
      });
      toast("Retur pembelian ke supplier berhasil dicatat");
      setReturOpen(false);
      setReturProduct("");
      setReturSn("");
      setReturQty("1");
      setReturNote("");
      await reload();
    } catch (e: any) {
      toast(e?.message ?? "Gagal mencatat retur pembelian", "danger");
    } finally {
      setIsSavingRetur(false);
    }
  }

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
  const hasPoFile = !!row.fileId;
  const hasSoFile = !!row.soFileId;
  const hasDoFile = !!row.doFileId;

  return (
    <>
      <Panel
        title="Alur Keterkaitan Dokumen: PO Pembelian Kita ↔ Sales Order (SO) Supplier"
        subtitle="Sisi Pembelian (Procurement): Kita menerbitkan PO ke Supplier, lalu Supplier menerbitkan SO sebagai konfirmasi pesanan"
      >
        <View className="gap-2.5">
          <View className="bg-panel/60 border-border/80 rounded-xl border p-3 gap-1.5">
            <View className="flex-row items-center justify-between flex-wrap gap-2">
              <Text className="text-xs font-bold text-foreground">
                1. Purchase Order (PO) — Dokumen Pemesanan ke Supplier
              </Text>
              <View className="flex-row items-center gap-1.5">
                <StatusBadge status={hasPoFile ? "File PO Terlampir" : "PO Aktif"} />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 flex-row items-center gap-1"
                  onPress={() =>
                    printOrderDocument({
                      docType: "PO",
                      docNumber: row.nomor || `PO-S/${row.id}`,
                      refNumber: row.nomorSoSupplier,
                      date: row.tanggal,
                      counterpartyLabel: "Supplier (Penjual)",
                      counterpartyName: row.supplier,
                      items: Array.isArray(row.items) && row.items.length > 0
                        ? row.items.map((it: any) => ({
                            name: it.product?.name || it.customName || it.productName || it.name || "Barang",
                            qty: Number(it.qty) || 1,
                            unit: it.product?.unit || it.customUnit || it.unit || "Unit",
                            price: Number(it.price) || 0,
                          }))
                        : [{ name: row.item || "Barang Pesanan", qty: 1, unit: "Paket", price: Number(row.total) || 0 }],
                      totalAmount: Number(row.total) || 0,
                    })
                  }
                >
                  <Printer size={12} color={colors.text} />
                  <Text className="text-[11px]">Buat / Cetak PDF PO</Text>
                </Button>
              </View>
            </View>
            <Text className="text-xs text-muted-foreground">
              Nomor PO: <Text className="font-semibold text-primary">{row.nomor || "-"}</Text> · Supplier:{" "}
              <Text className="font-semibold text-foreground">{row.supplier || "-"}</Text>
            </Text>
            <Text className="text-[11px] text-muted-foreground">
              Dokumen resmi pemesanan barang & kontrol anggaran. Anda dapat membuat/mencetak PDF PO atau mengunggah file PO di panel File & Bukti Pendukung.
            </Text>
          </View>

          <View className="bg-panel/60 border-border/80 rounded-xl border p-3 gap-1.5">
            <View className="flex-row items-center justify-between flex-wrap gap-2">
              <Text className="text-xs font-bold text-foreground">
                2. Sales Order (SO) — Dokumen Konfirmasi Pesanan
              </Text>
              <View className="flex-row items-center gap-1.5">
                <StatusBadge
                  status={
                    hasSoFile
                      ? "File SO Terlampir"
                      : row.nomorSoSupplier && row.nomorSoSupplier !== "-"
                        ? `SO: ${row.nomorSoSupplier}`
                        : "Menunggu SO"
                  }
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 flex-row items-center gap-1"
                  onPress={() =>
                    printOrderDocument({
                      docType: "SO",
                      docNumber: row.nomorSoSupplier && row.nomorSoSupplier !== "-" ? row.nomorSoSupplier : `SO-S/${row.id}`,
                      refNumber: row.nomor,
                      date: row.tanggal,
                      counterpartyLabel: "Supplier",
                      counterpartyName: row.supplier,
                      items: Array.isArray(row.items) && row.items.length > 0
                        ? row.items.map((it: any) => ({
                            name: it.product?.name || it.customName || it.productName || it.name || "Barang",
                            qty: Number(it.qty) || 1,
                            unit: it.product?.unit || it.customUnit || it.unit || "Unit",
                            price: Number(it.price) || 0,
                          }))
                        : [{ name: row.item || "Barang Pesanan", qty: 1, unit: "Paket", price: Number(row.total) || 0 }],
                      totalAmount: Number(row.total) || 0,
                    })
                  }
                >
                  <Printer size={12} color={colors.text} />
                  <Text className="text-[11px]">Buat / Cetak PDF SO</Text>
                </Button>
              </View>
            </View>
            <Text className="text-xs text-muted-foreground">
              Nomor SO:{" "}
              <Text className="font-semibold text-foreground">{row.nomorSoSupplier || "-"}</Text> · Estimasi Tiba (ETA):{" "}
              <Text className="font-semibold text-foreground">{row.eta || "-"}</Text>
            </Text>
            <Text className="text-[11px] text-muted-foreground">
              Dokumen konfirmasi bahwa pesanan diterima dan siap diproses menjadi Delivery Order (DO) & Invoice.
            </Text>
          </View>

          <View className="bg-panel/60 border-border/80 rounded-xl border p-3 gap-1.5">
            <View className="flex-row items-center justify-between flex-wrap gap-2">
              <Text className="text-xs font-bold text-foreground">
                3. Delivery Order (DO) & Penerimaan Gudang (Receiving)
              </Text>
              <StatusBadge status={hasDoFile ? "Bukti DO Terlampir" : row.pengiriman || "Di Supplier"} />
            </View>
            <Text className="text-[11px] text-muted-foreground">
              Unggah File PO Kita, File SO dari Supplier, dan Bukti DO pada panel <Text className="font-semibold text-foreground">File & Bukti Pendukung</Text> di atas.
            </Text>
          </View>
        </View>
      </Panel>

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
            const prodName = it.product?.name || it.customName || it.productName || it.name || it.product?.sku || `Barang #${idx + 1}`;
            const qtyText = `${it.qty || 1} ${it.product?.unit || it.customUnit || it.unit || "Unit"}`;
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

      <Panel
        title={`Retur Pembelian & Klaim ke Supplier (${purchaseReturns.length})`}
        subtitle="Pengembalian barang rusak / salah kirim ke supplier (mendukung pemilihan Serial Number unit)"
        right={
          <Button
            size="sm"
            variant="outline"
            onPress={() => {
              const firstPoItem = Array.isArray(row.items) && row.items.length > 0
                ? (row.items[0]?.product?.name || row.items[0]?.productName || row.items[0]?.name || "")
                : (row.item && row.item !== "-" ? String(row.item).split(",")[0]?.trim() || "" : "");
              if (firstPoItem) setReturProduct(firstPoItem);
              setReturOpen(true);
            }}
            className="flex-row items-center gap-1"
          >
            <RotateCcw size={13} color={colors.text} />
            <Text className="text-xs">Catat Retur Pembelian</Text>
          </Button>
        }
      >
        {purchaseReturns.length === 0 ? (
          <Text className="text-muted-foreground text-xs py-1">Belum ada retur pembelian untuk PO ini.</Text>
        ) : (
          purchaseReturns.map((rt: Row) => (
            <Line
              key={rt.id}
              left={`${rt.produk} × ${rt.qty || 1} (${rt.jenis})`}
              sub={`${rt.sn && rt.sn !== "-" ? `SN: ${rt.sn} · ` : ""}${rt.tanggal} · ${rt.keterangan}`}
              right={<StatusBadge status={rt.status || "Dilaporkan"} />}
            />
          ))
        )}
      </Panel>

      <Dialog open={returOpen} onOpenChange={setReturOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Catat Retur Pembelian ke Supplier ({row.nomor})</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <FormField label="Barang yang Diretur" required>
              <SearchableSelect
                value={returProduct}
                onChange={(v) => {
                  setReturProduct(v);
                  setReturSn("");
                }}
                options={Array.from(
                  new Set([
                    ...(Array.isArray(row.items)
                      ? row.items.map((it: any) => String(it.product?.name || it.productName || it.name || "")).filter(Boolean)
                      : []),
                    ...(data.products ?? []).filter((p: any) => p.type !== "JASA").map((p: any) => String(p.nama || "")).filter(Boolean),
                  ]),
                )}
                placeholder="Pilih barang dari PO atau master produk..."
              />
            </FormField>
            {(() => {
              const prodObj = (data.products ?? []).find((p: any) => p.nama === returProduct || p.name === returProduct);
              if (!prodObj?.berSN) return null;
              const snOpts = (data.serials ?? [])
                .filter((s: any) => String(s.productId) === String(prodObj.id) || s.produk === prodObj.nama)
                .map((s: any) => String(s.sn));
              return (
                <FormField label="Serial Number (SN) Unit yang Diretur">
                  <SearchableSelect
                    value={returSn}
                    onChange={(v) => {
                      setReturSn(v);
                      setReturQty("1");
                    }}
                    options={snOpts}
                    placeholder="Pilih SN unit yang diretur ke supplier..."
                  />
                </FormField>
              );
            })()}
            <FormField label="Jumlah Retur (Qty)" required>
              <Input value={returQty} onChangeText={setReturQty} keyboardType="numeric" />
            </FormField>
            <FormField label="Alasan Retur ke Supplier" required>
              <Input
                value={returNote}
                onChangeText={setReturNote}
                placeholder="Contoh: Cacat pabrik / lensa pecah saat diterima, minta tukar unit baru"
              />
            </FormField>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setReturOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSavePurchaseReturn} disabled={isSavingRetur}>
              <Text>{isSavingRetur ? "Menyimpan..." : "Simpan Retur Pembelian"}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
