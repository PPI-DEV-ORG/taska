import * as React from "react";
import { View, Linking, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { CheckCircle2, Circle, ExternalLink, PackageCheck, Plus, Printer, RotateCcw, Trash2, Check, Receipt, FileText, Edit2 } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Panel, FormField } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { statusText } from "@/lib/labels";
import { DatePicker, SearchableSelect, formatThousands } from "@/components/taska/dialogs";
import { FileUploader, FileUploaderHandle } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { api, apiBase } from "@/services/api";
import { colors } from "@/tokens";
import { rupiah, tanggal } from "@/lib/format";
import { type Row } from "@/constants/modules";
import { PPH_MODE_OPTIONS, pphRateFor, pphModeToTipe, type PphMode } from "@/modules/quotation/lib";
import { Line } from "@/modules/shared/line";
import { printOrderDocument } from "@/lib/order-print";
import { useKasBankAccounts } from "@/lib/use-kas-bank";
import { ItemEditorDialog } from "@/components/taska/item-editor-dialog";

import {
  SupplierInvoiceDetailDialog,
  SupplierInvoiceEditDialog,
  SupplierInvoicePayDialog,
} from "@/modules/supplier-po/supplier-invoice-dialogs";

export function SupplierPoExtras({ row, onRefresh }: { row: Row; onRefresh?: () => void }) {
  const router = useRouter();
  const { can, patchRow, setStatus, addRow, toast, data, reload, refreshModule } = useApp();
  const [showAllPoItems, setShowAllPoItems] = React.useState(false);
  const [selectedPoItemIndices, setSelectedPoItemIndices] = React.useState<number[]>([]);
  const [poItemModalOpen, setPoItemModalOpen] = React.useState(false);
  const [editingPoIndex, setEditingPoIndex] = React.useState<number | null>(null);

  const handleSavePoItem = async (savedItem: any) => {
    const currentItems = Array.isArray(row.items) && row.items.length > 0
      ? [...row.items]
      : row.item && row.item !== "-"
        ? String(row.item).split(", ").map((name: string) => ({ item: name, name, qty: 1, unit: "Unit", price: 0 }))
        : [];

    const normalized = {
      ...savedItem,
      item: savedItem.item || savedItem.name || savedItem.productName || "Barang",
      name: savedItem.name || savedItem.item || savedItem.productName || "Barang",
      productName: savedItem.productName || savedItem.name || savedItem.item || "Barang",
      qty: Number(savedItem.qty) || 1,
      price: Number(savedItem.price || savedItem.harga || 0),
      unit: savedItem.unit || savedItem.satuan || "Unit",
    };

    let updatedList: any[];
    if (editingPoIndex !== null && editingPoIndex >= 0 && editingPoIndex < currentItems.length) {
      updatedList = [...currentItems];
      updatedList[editingPoIndex] = { ...updatedList[editingPoIndex], ...normalized };
    } else {
      updatedList = [...currentItems, normalized];
    }

    const newTotal = updatedList.reduce((s: number, it: any) => s + Number(it.price ? it.price * (it.qty || 1) : 0), 0);
    const itemNamesStr = updatedList.map((it: any) => it.item || it.name || it.productName || it.customName).filter(Boolean).join(", ");

    await patchRow("supplier-pos", row.id, {
      items: updatedList,
      item: itemNamesStr || "-",
      total: newTotal,
      nilai: newTotal,
    });
    setPoItemModalOpen(false);
    setEditingPoIndex(null);
    await reload();
    onRefresh?.();
    toast(editingPoIndex !== null ? "Barang berhasil diperbarui" : "Barang berhasil ditambahkan");
  };

  const currentPoEditingItem = React.useMemo(() => {
    if (editingPoIndex === null) return null;
    if (Array.isArray(row.items) && row.items[editingPoIndex]) {
      return row.items[editingPoIndex];
    }
    if (row.item && row.item !== "-") {
      const sp = String(row.item).split(", ");
      if (sp[editingPoIndex]) {
        return { item: sp[editingPoIndex], name: sp[editingPoIndex], qty: 1, unit: "Unit", price: 0 };
      }
    }
    return null;
  }, [editingPoIndex, row.items, row.item]);

  const handleDeleteSelectedPoItems = async () => {
    if (selectedPoItemIndices.length === 0) return;
    const count = selectedPoItemIndices.length;
    if (Array.isArray(row.items) && row.items.length > 0) {
      const updated = row.items.filter((_: any, i: number) => !selectedPoItemIndices.includes(i));
      const newTotal = updated.reduce((s: number, it: any) => s + Number(it.price ? it.price * (it.qty || 1) : 0), 0);
      await patchRow("supplier-pos", row.id, {
        items: updated,
        total: newTotal,
        nilai: newTotal,
      });
    } else if (row.item && row.item !== "-") {
      const splitted = String(row.item).split(", ");
      const updated = splitted.filter((_: any, i: number) => !selectedPoItemIndices.includes(i));
      await patchRow("supplier-pos", row.id, {
        item: updated.length > 0 ? updated.join(", ") : "-",
      });
    }
    setSelectedPoItemIndices([]);
    await reload();
    onRefresh?.();
    toast(`${count} barang berhasil dihapus dari PO`);
  };

  const [currentShipment, setCurrentShipment] = React.useState<string>(() => row.pengiriman || "Di Supplier");
  const [previousShipmentProp, setPreviousShipmentProp] = React.useState(row.pengiriman);
  if (row.pengiriman !== previousShipmentProp) {
    setPreviousShipmentProp(row.pengiriman);
    if (row.pengiriman) setCurrentShipment(row.pengiriman);
  }

  const steps = ["Di Supplier", "Dikirim", "Sampai"];
  const cur =
    currentShipment === "Sampai"
      ? 2
      : currentShipment === "Dikirim" || currentShipment === "Dalam Perjalanan"
      ? 1
      : 0;
  // Hak akses dari Pengaturan Peran (RBAC), sama dengan pengecekan server. Tombol yang tidak boleh dipakai disembunyikan.
  const showPrice = can("supplier-pos", "P");
  const canPay = can("supplier-pos", "V"); // uang keluar ke supplier: Finance
  const canEditPo = can("supplier-pos", "U");
  const canRecordInvoice = can("supplier-pos", "C");
  const canShip = can("supplier-pos", "U") || can("shipments", "U");
  const canReceive = can("receiving", "C") || can("receiving", "U");
  const canRetur = can("damage-reports", "C");
  // Server mengunci isi PO setelah disetujui / dikirim (PO dari Request langsung disetujui).
  const itemsLocked = row.poStatus === "DISETUJUI" || (!!row.shipmentStatus && row.shipmentStatus !== "DI_SUPPLIER");
  const canEditItems = canEditPo && !itemsLocked;
  /** Sudah dibayar di muka (Request Barang dibayar / PO ditandai Lunas): tagihan supplier otomatis dikompensasi. */
  const isPrepaid = Boolean(row.requestPaid) || row.manualStatus === "LUNAS";

  /** Jatuh tempo default tagihan: dari Request Barang -> syarat bayar PO -> 30 hari. Tidak perlu dipilih ulang. */
  function defaultInvoiceDue(baseIso: string): string {
    if (row.requestDueDate) return String(row.requestDueDate);
    const terms = String(row.paymentTerms || "");
    const fixed = terms.match(/(\d{4}-\d{2}-\d{2})/);
    if (fixed?.[1]) return fixed[1];
    const net = terms.match(/net\s*(\d+)/i);
    const d = new Date(baseIso);
    d.setDate(d.getDate() + (net?.[1] ? Number(net[1]) : 30));
    return d.toISOString().slice(0, 10);
  }
  const defaultPayScheme = (): "TEMPO" | "LUNAS" =>
    !isPrepaid && canPay && String(row.paymentMethod || "").toUpperCase() === "KAS" ? "LUNAS" : "TEMPO";

  // Semua relasi dokumen lewat ID (supplierPoId / requestId), bukan mencocokkan teks nomor dokumen.
  const supplierInvoices: Row[] = (data.invoiceIn ?? []).filter(
    (inv: Row) => inv.supplierPoId != null && String(inv.supplierPoId) === String(row.id)
  );

  const linkedReceivings: Row[] = React.useMemo(() => {
    const list: Row[] = [];
    const seen = new Set<string>();

    const addRc = (rc: any) => {
      if (!rc || !rc.id) return;
      const key = String(rc.id);
      if (seen.has(key)) return;
      seen.add(key);
      list.push(rc);
    };

    (data.receiving ?? []).forEach((rc: Row) => {
      if (
        (rc.supplierPoId != null && String(rc.supplierPoId) === String(row.id)) ||
        (row.requestId && rc.requestId != null && String(rc.requestId) === String(row.requestId))
      ) {
        addRc(rc);
      }
    });

    if (Array.isArray(row.receivings)) {
      row.receivings.forEach((r: any) => {
        addRc({
          id: String(r.id),
          nomor: r.number || `RCV/${r.id}`,
          status: r.status,
          tanggal: r.date ? new Date(r.date).toISOString().slice(0, 10) : "-",
          item: row.item || "Barang PO",
          receiptFileId: r.receiptFileId,
          photoFileId: r.photoFileId,
        });
      });
    }

    return list;
  }, [data.receiving, row.id, row.requestId, row.receivings, row.item]);
  const primaryReceiving = linkedReceivings[0] ?? null;
  const recWithDo = linkedReceivings.find((rc: any) => rc.receiptFileId || rc.photoFileId || rc.fileId);
  const effectiveDoFileId = row.doFileId || recWithDo?.receiptFileId || recWithDo?.photoFileId || recWithDo?.fileId || null;

  const poItemsSubtotal = React.useMemo(() => {
    if (Array.isArray(row.items) && row.items.length > 0) {
      return row.items.reduce((s: number, it: any) => s + (Number(it.qty) || 1) * Number(it.price || 0), 0);
    }
    return Number(row.total || 0);
  }, [row.items, row.total]);

  const poTotalNum = Number(row.total || 0);
  const effectivePoPpnMode: "none" | "exclude" | "include" = React.useMemo(() => {
    if (row.ppnMode === "exclude" || row.ppnMode === "include" || row.ppnMode === "none") {
      return row.ppnMode;
    }
    if (poItemsSubtotal > 0 && poTotalNum > poItemsSubtotal && Math.abs(poTotalNum - Math.round(poItemsSubtotal * 1.11)) <= 5) {
      return "exclude";
    }
    return "none";
  }, [row.ppnMode, poItemsSubtotal, poTotalNum]);

  const effectivePoDpp = React.useMemo(() => {
    if (row.dpp != null && Number(row.dpp) > 0) return Number(row.dpp);
    if (effectivePoPpnMode === "exclude") {
      return poItemsSubtotal > 0 ? poItemsSubtotal : Math.round(poTotalNum / 1.11);
    }
    if (effectivePoPpnMode === "include") {
      return Math.round(poTotalNum / 1.11);
    }
    return poTotalNum;
  }, [row.dpp, effectivePoPpnMode, poItemsSubtotal, poTotalNum]);

  const effectivePoPpn = React.useMemo(() => {
    if (row.ppn != null && Number(row.ppn) > 0) return Number(row.ppn);
    if (effectivePoPpnMode === "exclude") {
      return Math.max(0, poTotalNum > effectivePoDpp ? poTotalNum - effectivePoDpp : Math.round(effectivePoDpp * 0.11));
    }
    if (effectivePoPpnMode === "include") {
      return Math.max(0, poTotalNum - effectivePoDpp);
    }
    return 0;
  }, [row.ppn, effectivePoPpnMode, poTotalNum, effectivePoDpp]);

  const effectivePoPphMode: PphMode = (row.pphMode as PphMode) || "none";
  const poJasaDpp = React.useMemo(() => {
    if (Array.isArray(row.items) && row.items.length > 0) {
      const nonProdItemsSum = row.items.reduce((s: number, it: any) => {
        const isJasa =
          !it.productId ||
          it.productId === null ||
          it.itemType === "JASA" ||
          (it.pphMode && it.pphMode !== "none") ||
          (Number(it.pph) > 0) ||
          /^\[(JASA)\]/i.test(String(it.customName || it.name || ""));
        return isJasa ? s + (Number(it.qty) || 1) * Number(it.price || 0) : s;
      }, 0);
      if (nonProdItemsSum > 0) return nonProdItemsSum;
    }
    if (row.pph != null && Number(row.pph) > 0 && effectivePoPphMode !== "none") {
      const rate = pphRateFor(effectivePoPphMode);
      if (rate > 0) return Math.round(Number(row.pph) / rate);
    }
    return 0;
  }, [row.items, row.pph, effectivePoPphMode]);

  const effectivePoPph = React.useMemo(() => {
    if (row.pph != null && Number(row.pph) > 0) return Number(row.pph);
    if (effectivePoPphMode !== "none") {
      return poJasaDpp > 0 ? Math.round(poJasaDpp * pphRateFor(effectivePoPphMode)) : 0;
    }
    return 0;
  }, [row.pph, effectivePoPphMode, poJasaDpp]);

  const effectivePoGrandTotal = React.useMemo(() => {
    if (effectivePoPpnMode === "exclude") {
      return Math.max(0, effectivePoDpp + effectivePoPpn - effectivePoPph);
    }
    return poTotalNum;
  }, [effectivePoPpnMode, effectivePoDpp, effectivePoPpn, effectivePoPph, poTotalNum]);

  const [invOpen, setInvOpen] = React.useState(false);
  const [invNumber, setInvNumber] = React.useState(`INV-SUP-${row.nomor || row.id}`);
  const [invAmount, setInvAmount] = React.useState(() =>
    formatThousands(String((effectivePoPpnMode === "include" ? effectivePoDpp + effectivePoPpn : effectivePoDpp) || 0))
  );
  const [invPpnMode, setInvPpnMode] = React.useState<"none" | "exclude" | "include">(() =>
    effectivePoPpnMode === "none" ? "none" : "exclude"
  );
  const [invPphMode, setInvPphMode] = React.useState<PphMode>(() => effectivePoPphMode);
  const [invJasaDpp, setInvJasaDpp] = React.useState<string>(() =>
    formatThousands(String(poJasaDpp || (effectivePoPph > 0 && effectivePoPphMode !== "none" ? Math.round(effectivePoPph / pphRateFor(effectivePoPphMode)) : 0)))
  );
  const [invDate, setInvDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [invDue, setInvDue] = React.useState(() => defaultInvoiceDue(new Date().toISOString().slice(0, 10)));
  const [invPaymentScheme, setInvPaymentScheme] = React.useState<"TEMPO" | "LUNAS">(defaultPayScheme);
  const [invPayMethod, setInvPayMethod] = React.useState<"TRANSFER" | "TUNAI">("TRANSFER");
  const [invCoaAccount, setInvCoaAccount] = React.useState<string>("1000.02");
  const [invFileId, setInvFileId] = React.useState<number | null>(null);
  const [invPayProofFileId, setInvPayProofFileId] = React.useState<number | null>(null);
  const invFileHandle = React.useRef<FileUploaderHandle | null>(null);
  const invPayProofHandle = React.useRef<FileUploaderHandle | null>(null);

  const poAlreadyBilledDpp = React.useMemo(() => {
    return supplierInvoices.reduce((acc, inv) => acc + (Number(inv.nilai ?? inv.amount ?? 0)), 0);
  }, [supplierInvoices]);
  const poAlreadyBilledPpn = React.useMemo(() => {
    return supplierInvoices.reduce((acc, inv) => acc + (Number(inv.ppn ?? 0)), 0);
  }, [supplierInvoices]);

  const poRemainingDpp = Math.max(0, effectivePoDpp - poAlreadyBilledDpp);
  // Nominal tagihan diisi dalam satuan yang sama dengan PO: include = termasuk PPN, exclude / tanpa PPN = DPP.
  const poIsInclude = effectivePoPpnMode === "include";
  const poBase = poIsInclude ? effectivePoDpp + effectivePoPpn : effectivePoDpp;
  const poAlreadyBilledBase = poIsInclude ? poAlreadyBilledDpp + poAlreadyBilledPpn : poAlreadyBilledDpp;
  const poRemainingBase = Math.max(0, poBase - poAlreadyBilledBase);

  const [invTagihanScheme, setInvTagihanScheme] = React.useState<"SEKALIGUS" | "DP" | "TERMIN" | "PELUNASAN">("SEKALIGUS");
  const [invDpPercent, setInvDpPercent] = React.useState<string>("50");
  const [invTerminPercent, setInvTerminPercent] = React.useState<string>("30");

  function handleOpenInvoiceModal() {
    setInvFileId(null);
    setInvPayProofFileId(null);
    setInvPphMode(effectivePoPphMode);
    setInvDue(defaultInvoiceDue(invDate));
    setInvPaymentScheme(defaultPayScheme());
    const defJasa =
      poJasaDpp > 0
        ? poJasaDpp
        : (effectivePoPph > 0 && effectivePoPphMode !== "none"
            ? Math.round(effectivePoPph / pphRateFor(effectivePoPphMode))
            : 0);
    setInvJasaDpp(defJasa > 0 ? formatThousands(String(defJasa)) : "");

    const terms = String(row.paymentTerms || row.payment || "");
    const dpMatch = terms.match(/DP\s*(\d+)%/i);

    if (supplierInvoices.length > 0) {
      setInvTagihanScheme("PELUNASAN");
      setInvAmount(formatThousands(String(poRemainingBase)));
      setInvNumber(`INV-SUP-${row.nomor || row.id}/PELUNASAN`);
    } else if (dpMatch) {
      const pct = dpMatch[1] || "50";
      setInvTagihanScheme("DP");
      setInvDpPercent(pct);
      const dpAmt = Math.round(poBase * (Number(pct) / 100));
      setInvAmount(formatThousands(String(dpAmt)));
      setInvNumber(`INV-SUP-${row.nomor || row.id}/DP`);
    } else {
      setInvTagihanScheme("SEKALIGUS");
      setInvAmount(formatThousands(String(poBase || 0)));
      setInvNumber(`INV-SUP-${row.nomor || row.id}`);
    }

    // Mode PPN tagihan = mode PPN PO
    setInvPpnMode(effectivePoPpnMode);
    setInvOpen(true);
  }

  function handleSwitchTagihanScheme(newScheme: "SEKALIGUS" | "DP" | "TERMIN" | "PELUNASAN", customPct?: string) {
    setInvTagihanScheme(newScheme);
    if (newScheme === "SEKALIGUS") {
      setInvAmount(formatThousands(String(poBase)));
      setInvNumber(`INV-SUP-${row.nomor || row.id}`);
    } else if (newScheme === "DP") {
      const pct = Number(customPct ?? invDpPercent) || 50;
      setInvAmount(formatThousands(String(Math.round(poBase * (pct / 100)))));
      setInvNumber(`INV-SUP-${row.nomor || row.id}/DP`);
    } else if (newScheme === "TERMIN") {
      const pct = Number(customPct ?? invTerminPercent) || 30;
      const termAmt = supplierInvoices.length > 0
        ? Math.min(poRemainingBase, Math.round(poBase * (pct / 100)))
        : Math.round(poBase * (pct / 100));
      setInvAmount(formatThousands(String(termAmt)));
      setInvNumber(`INV-SUP-${row.nomor || row.id}/${supplierInvoices.length + 1}`);
    } else if (newScheme === "PELUNASAN") {
      setInvAmount(formatThousands(String(poRemainingBase)));
      setInvNumber(`INV-SUP-${row.nomor || row.id}/PELUNASAN`);
    }
  }

  const kasBankOptions = useKasBankAccounts();

  const [selectedDetailInv, setSelectedDetailInv] = React.useState<Row | null>(null);
  const [editTargetInv, setEditTargetInv] = React.useState<Row | null>(null);
  const [payTargetInv, setPayTargetInv] = React.useState<Row | null>(null);

  const [returOpen, setReturOpen] = React.useState(false);
  const [returProduct, setReturProduct] = React.useState("");
  const [returSn, setReturSn] = React.useState("");
  const [returQty, setReturQty] = React.useState("1");
  const [returNote, setReturNote] = React.useState("");
  const [isSavingRetur, setIsSavingRetur] = React.useState(false);

  const purchaseReturns = React.useMemo(
    () => (data["damage-reports"] ?? []).filter((dr: Row) => dr.supplierPoId != null && String(dr.supplierPoId) === String(row.id)),
    [data, row.id],
  );

  async function handleSavePurchaseReturn() {
    if (!returProduct) {
      toast("Pilih barang yang diretur ke pemasok", "danger");
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
        supplierPoId: row.id,
        keterangan: returNote.trim(),
      });
      toast("Retur pembelian ke pemasok berhasil dicatat");
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

  async function go(s: string) {
    setCurrentShipment(s);
    try {
      // Satu panggilan: server memvalidasi urutan, ikut menandai Request Barang & menyiapkan draf Penerimaan Gudang.
      const ok = await setStatus("supplier-pos", String(row.id), s);
      if (!ok) {
        setCurrentShipment(row.pengiriman || "Di Supplier");
        return;
      }
      toast(`Pengiriman PO ditandai ${s}. Request Barang ikut diperbarui.`);
      void refreshModule("purchase-requests");
      await reload();
      onRefresh?.();
    } catch (e: any) {
      setCurrentShipment(row.pengiriman || "Di Supplier");
      toast(e?.message ?? "Gagal mengubah status pengiriman", "danger");
    }
  }

  const rawInvInput = Number(String(invAmount).replace(/\D/g, "")) || 0;
  const rawJasaInput = Number(String(invJasaDpp).replace(/\D/g, "")) || 0;
  // DPP & PPN mengacu angka PO: proporsional untuk DP/termin, sisa DPP & PPN PO untuk tagihan terakhir.
  const invFromPo = invPpnMode === effectivePoPpnMode && invPpnMode !== "none" && effectivePoPpn > 0 && effectivePoDpp > 0;
  const invIsFinal = rawInvInput >= poRemainingBase && poRemainingBase > 0;
  let calcInvDpp = invPpnMode === "include" ? Math.round(rawInvInput / 1.11) : rawInvInput;
  let calcInvPpn =
    invPpnMode === "none" ? 0 : invPpnMode === "include" ? Math.max(0, rawInvInput - calcInvDpp) : Math.round(rawInvInput * 0.11);
  if (invFromPo) {
    if (invIsFinal) {
      calcInvDpp = Math.max(0, effectivePoDpp - poAlreadyBilledDpp);
      calcInvPpn = Math.max(0, effectivePoPpn - poAlreadyBilledPpn);
    } else if (invPpnMode === "include") {
      calcInvDpp = Math.round((rawInvInput * effectivePoDpp) / (effectivePoDpp + effectivePoPpn));
      calcInvPpn = Math.max(0, rawInvInput - calcInvDpp);
    } else {
      calcInvPpn = Math.round((rawInvInput * effectivePoPpn) / effectivePoDpp);
    }
  }

  // PPh dihitung KHUSUS dari DPP Jasa
  const effJasaDpp = rawJasaInput > 0
    ? rawJasaInput
    : (poJasaDpp > 0 ? poJasaDpp : (effectivePoPph > 0 && effectivePoPphMode !== "none" ? Math.round(effectivePoPph / pphRateFor(effectivePoPphMode)) : 0));

  const calcInvPph =
    invPphMode === "none"
      ? 0
      : effJasaDpp > 0
        ? Math.round(effJasaDpp * pphRateFor(invPphMode))
        : (row.pph != null && Number(row.pph) > 0 && invPphMode === effectivePoPphMode)
          ? Number(row.pph)
          : 0;

  const calcInvTotal = Math.max(
    0,
    (invFromPo || invPpnMode !== "include" ? calcInvDpp + calcInvPpn : rawInvInput) - calcInvPph
  );

  async function handleCreateInvoiceIn() {
    let finalInvFileId = invFileId;
    if (invFileHandle.current?.hasStaged()) {
      try {
        finalInvFileId = await invFileHandle.current.flush();
      } catch {}
    }
    let finalPayProofId = invPayProofFileId;
    if (invPayProofHandle.current?.hasStaged()) {
      try {
        finalPayProofId = await invPayProofHandle.current.flush();
      } catch {}
    }

    if (!finalInvFileId) {
      toast("File faktur pemasok (Gambar / PDF) wajib diunggah", "danger");
      return;
    }

    const amt = calcInvDpp;
    const ppn = calcInvPpn;
    const pph = calcInvPph;
    const total = calcInvTotal;
    // "Langsung lunas" hanya untuk yang berhak membayar & bila belum dibayar di muka (yang prepaid dikompensasi server).
    const isLunas = invPaymentScheme === "LUNAS" && canPay && !isPrepaid;

    if (amt <= 0) {
      toast("Nominal tagihan harus lebih dari 0", "danger");
      return;
    }

    if (isLunas && !finalPayProofId) {
      toast("Bukti bayar / transfer (Gambar / PDF) wajib diunggah untuk status Lunas", "danger");
      return;
    }

    const invoiceType =
      invTagihanScheme === "DP"
        ? "DP"
        : invTagihanScheme === "TERMIN"
        ? "Termin"
        : invTagihanScheme === "PELUNASAN"
        ? "Pelunasan"
        : "Pelunasan";

    const termDesc =
      invTagihanScheme === "DP"
        ? `DP (${invDpPercent}%) - PO ${row.nomor || ""}`
        : invTagihanScheme === "TERMIN"
        ? `Termin ${supplierInvoices.length + 1} (${invTerminPercent}%) - PO ${row.nomor || ""}`
        : invTagihanScheme === "PELUNASAN" && supplierInvoices.length > 0
        ? `Pelunasan - PO ${row.nomor || ""}`
        : `Pembayaran Penuh - PO ${row.nomor || ""}`;

    const created = await addRow("invoiceIn", {
      nomor: invNumber,
      supplierId: row.supplierId,
      supplier: row.supplier,
      supplierPoId: row.id,
      po: row.nomor,
      type: invoiceType.toUpperCase(),
      jenis: invoiceType,
      dpLabel: invTagihanScheme === "DP" ? `DP ${invDpPercent}%` : undefined,
      dpAmount: invTagihanScheme === "DP" ? total : undefined,
      notes: termDesc,
      catatan: termDesc,
      nilai: amt,
      ppn,
      pph,
      pphMode: invPphMode,
      tipePph: pphModeToTipe(invPphMode),
      total,
      jatuhTempo: isLunas || isPrepaid ? invDate : invDue,
      fileId: finalInvFileId ?? undefined,
      transferFileId: finalPayProofId ?? undefined,
      paid: isLunas,
      paymentMethod: invPayMethod,
      coaAccount: invCoaAccount,
      paymentFileId: finalPayProofId ?? undefined,
      paymentReference: `[AKUN:${invCoaAccount}] LUNAS-${row.nomor || "PO"}`,
    });
    if (created) {
      if (isLunas) {
        toast("Faktur masuk & pelunasan langsung berhasil dicatat (Lunas)");
      } else if (isPrepaid) {
        toast("Faktur masuk dicatat & otomatis lunas lewat kompensasi pembayaran di muka (tanpa kas keluar lagi)");
      } else {
        toast("Faktur masuk (Tempo / Utang) berhasil dicatat");
      }
      setInvOpen(false);
      setInvFileId(null);
      setInvPayProofFileId(null);
      void refreshModule("invoiceIn");
      void refreshModule("supplier-pos");
      void refreshModule("purchase-requests");
      await reload();
    }
  }

  const canEdit = canEditPo;
  const hasPoFile = !!row.fileId;
  const hasSoFile = !!row.soFileId;
  const hasDoFile = !!effectiveDoFileId;

  return (
    <>
      <Panel
        title="Alur Keterkaitan Dokumen: PO Pembelian Kita ↔ Pesanan Penjualan (SO) Pemasok"
        subtitle="Sisi Pembelian (Procurement): Kita menerbitkan PO ke Pemasok, lalu Pemasok menerbitkan SO sebagai konfirmasi pesanan"
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
                      counterpartyLabel: "Pemasok (Penjual)",
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
              <View className="flex-row items-center gap-1.5">
                <StatusBadge status={hasDoFile ? "Bukti DO Terlampir" : row.pengiriman || "Di Supplier"} />
                {effectiveDoFileId ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 flex-row items-center gap-1"
                    onPress={() => {
                      const url = `${apiBase()}/files/${effectiveDoFileId}`;
                      if (typeof window !== "undefined") window.open(url, "_blank");
                      else Linking.openURL(url).catch(() => {});
                    }}
                  >
                    <ExternalLink size={12} color={colors.text} />
                    <Text className="text-[11px]">Buka File DO</Text>
                  </Button>
                ) : null}
                {primaryReceiving ? (
                  <Button
                    size="sm"
                    className="h-7 px-2.5 flex-row items-center gap-1 bg-emerald-600 hover:bg-emerald-700"
                    onPress={() => router.push(`/receiving/${primaryReceiving.id}` as any)}
                  >
                    <PackageCheck size={12} color="#fff" />
                    <Text className="text-[11px] font-semibold text-white">
                      Buka Penerimaan ({primaryReceiving.nomor})
                    </Text>
                  </Button>
                ) : canReceive && cur === 1 ? (
                  <Button
                    size="sm"
                    className="h-7 px-2.5 flex-row items-center gap-1"
                    onPress={() => router.push("/receiving/new" as any)}
                  >
                    <PackageCheck size={12} color="#fff" />
                    <Text className="text-[11px] text-white">Terima di Gudang & Upload DO</Text>
                  </Button>
                ) : null}
              </View>
            </View>
            {linkedReceivings.length > 0 ? (
              <View className="mt-1 gap-1">
                {linkedReceivings.map((rc: Row) => (
                  <Pressable
                    key={rc.id}
                    className="flex-row items-center justify-between bg-card/70 border border-border/60 rounded-lg px-2.5 py-1.5 hover:bg-card active:opacity-80"
                    onPress={() => router.push(`/receiving/${rc.id}` as any)}
                  >
                    <View className="flex-row items-center gap-2 flex-1">
                      <PackageCheck size={14} color={colors.primary} />
                      <Text className="text-xs text-foreground">
                        <Text className="font-semibold text-primary">{rc.nomor}</Text> · {rc.tanggal} · {rc.item}
                      </Text>
                    </View>
                    <Button size="sm" variant="ghost" className="h-6 px-2" onPress={() => router.push(`/receiving/${rc.id}` as any)}>
                      <Text className="text-[11px] text-primary font-semibold">Buka Data Penerimaan →</Text>
                    </Button>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text className="text-[11px] text-muted-foreground">
                Saat barang tiba di Gudang, petugas membuat Penerimaan dengan memilih PO ini, scan SN, dan upload File DO (Gambar/PDF) — otomatis ter-attach ke PO ini.
              </Text>
            )}
          </View>
        </View>
      </Panel>

      <Panel title="Pengiriman dari pemasok" subtitle="Procurement menandai Dikirim. Status Diterima Gudang terisi otomatis setelah Gudang mengonfirmasi di menu Penerimaan Barang.">
        {steps.map((s, i) => (
          <View key={s} className="flex-row items-center gap-3 py-2">
            {i <= cur ? <CheckCircle2 size={20} color={colors.success} /> : <Circle size={20} color={colors.border} />}
            <Text className={i <= cur ? "text-sm font-medium" : "text-muted-foreground text-sm"}>{statusText(s)}</Text>
          </View>
        ))}
        {canShip && row.poStatus === "DISETUJUI" && cur < 1 && steps[cur + 1] ? (
          <Button
            className="mt-2 self-start"
            variant="outline"
            onPress={() => {
              const nextStep = steps[cur + 1];
              if (nextStep) go(nextStep);
            }}
          >
            <Text>Tandai {statusText(steps[cur + 1] ?? "")}</Text>
          </Button>
        ) : null}
      </Panel>
      <Panel
        title={`Barang di PO ini (${Array.isArray(row.items) && row.items.length > 0 ? row.items.length : (row.item && row.item !== "-" ? String(row.item).split(", ").length : 0)})`}
        right={
          canEditItems ? (
          <View className="flex-row items-center gap-1.5 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 flex-row items-center gap-1"
              onPress={() => {
                setEditingPoIndex(null);
                setPoItemModalOpen(true);
              }}
            >
              <Plus size={12} color={colors.text} />
              <Text className="text-[11px]">Tambah Barang</Text>
            </Button>
            {selectedPoItemIndices.length > 0 && (
              <Button
                size="sm"
                className="h-7 px-2.5 flex-row items-center gap-1 bg-danger hover:bg-danger/90"
                onPress={handleDeleteSelectedPoItems}
              >
                <Trash2 size={12} color="#fff" />
                <Text className="text-[11px] text-white font-semibold">
                  Hapus ({selectedPoItemIndices.length})
                </Text>
              </Button>
            )}
            {((Array.isArray(row.items) && row.items.length > 0) || (row.item && row.item !== "-")) && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 flex-row items-center gap-1"
                onPress={() => {
                  const totalCount = Array.isArray(row.items) && row.items.length > 0
                    ? row.items.length
                    : String(row.item || "").split(", ").length;
                  if (selectedPoItemIndices.length === totalCount) {
                    setSelectedPoItemIndices([]);
                  } else {
                    setSelectedPoItemIndices(Array.from({ length: totalCount }, (_, i) => i));
                  }
                }}
              >
                <Text className="text-[11px]">
                  {selectedPoItemIndices.length > 0 && selectedPoItemIndices.length === (Array.isArray(row.items) ? row.items.length : String(row.item || "").split(", ").length)
                    ? "Batal Semua"
                    : "Pilih Semua"}
                </Text>
              </Button>
            )}
          </View>
          ) : undefined
        }
      >
        {Array.isArray(row.items) && row.items.length > 0 ? (
          <>
            {(showAllPoItems ? row.items : row.items.slice(0, 10)).map((it: any, idx: number) => {
              const prodName = it.product?.name || it.customName || it.productName || it.name || it.product?.sku || `Barang #${idx + 1}`;
              const qtyText = `${it.qty || 1} ${it.product?.unit || it.customUnit || it.unit || "Unit"}`;
              const itemTotal = Number(it.price ? it.price * (it.qty || 1) : 0);
              const isSelected = selectedPoItemIndices.includes(idx);
              return (
                <View
                  key={it.id || idx}
                  className={`flex-row items-center justify-between py-2 border-b border-border/40 last:border-b-0 px-2 rounded-lg ${
                    isSelected ? "bg-primary/10" : ""
                  }`}
                >
                  <View className="flex-row items-center gap-2 flex-1">
                    {canEditItems ? (
                    <Pressable
                      onPress={() => {
                        setSelectedPoItemIndices((prev) =>
                          prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
                        );
                      }}
                      hitSlop={6}
                      className="p-1"
                    >
                      <View
                        className={`w-4 h-4 rounded border items-center justify-center ${
                          isSelected ? "bg-primary border-primary" : "border-border/80 bg-background"
                        }`}
                      >
                        {isSelected && <Check size={11} color="#ffffff" />}
                      </View>
                    </Pressable>
                    ) : null}
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-foreground">{prodName}</Text>
                      <Text className="text-xs text-muted-foreground">{qtyText}</Text>
                    </View>
                  </View>
                  <View className="flex-row items-center gap-1.5 ml-2">
                    {showPrice ? (
                      <Text className="text-sm font-semibold">
                        {itemTotal > 0 ? rupiah(itemTotal) : <Text className="text-muted-foreground text-xs font-normal">Harga beli tampil</Text>}
                      </Text>
                    ) : null}
                    {canEditItems ? (
                    <>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      onPress={() => {
                        setEditingPoIndex(idx);
                        setPoItemModalOpen(true);
                      }}
                    >
                      <Edit2 size={13} color={colors.text} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      onPress={async () => {
                        const updated = row.items.filter((_: any, i: number) => i !== idx);
                        const newTotal = updated.reduce((s: number, it: any) => s + Number(it.price ? it.price * (it.qty || 1) : 0), 0);
                        const itemNamesStr = updated.map((it: any) => it.item || it.name || it.productName || it.customName).filter(Boolean).join(", ");
                        await patchRow("supplier-pos", row.id, {
                          items: updated,
                          item: itemNamesStr || "-",
                          total: newTotal,
                          nilai: newTotal,
                        });
                        await reload();
                        onRefresh?.();
                        toast("Barang berhasil dihapus dari PO");
                      }}
                    >
                      <Trash2 size={13} color={colors.danger} />
                    </Button>
                    </>
                    ) : null}
                  </View>
                </View>
              );
            })}
            {row.items.length > 10 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 border border-border/60 rounded-lg flex-row items-center justify-center gap-1.5 mt-2"
                onPress={() => setShowAllPoItems((v) => !v)}
              >
                <Text className="text-xs font-semibold text-primary">
                  {showAllPoItems ? "Sembunyikan" : `Lihat Semua (${row.items.length} item)`}
                </Text>
              </Button>
            )}
          </>
        ) : row.item && row.item !== "-" ? (
          (() => {
            const splitted = String(row.item).split(", ");
            return (
              <>
                {(showAllPoItems ? splitted : splitted.slice(0, 10)).map((it, idx) => {
                  const isSelected = selectedPoItemIndices.includes(idx);
                  return (
                    <View
                      key={it}
                      className={`flex-row items-center justify-between py-2 border-b border-border/40 last:border-b-0 px-2 rounded-lg ${
                        isSelected ? "bg-primary/10" : ""
                      }`}
                    >
                      <View className="flex-row items-center gap-2 flex-1">
                        {canEditItems ? (
                        <Pressable
                          onPress={() => {
                            setSelectedPoItemIndices((prev) =>
                              prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
                            );
                          }}
                          hitSlop={6}
                          className="p-1"
                        >
                          <View
                            className={`w-4 h-4 rounded border items-center justify-center ${
                              isSelected ? "bg-primary border-primary" : "border-border/80 bg-background"
                            }`}
                          >
                            {isSelected && <Check size={11} color="#ffffff" />}
                          </View>
                        </Pressable>
                        ) : null}
                        <Text className="text-sm font-medium text-foreground flex-1">{it}</Text>
                      </View>
                      <View className="flex-row items-center gap-1.5 ml-2">
                        {showPrice ? <Text className="text-muted-foreground text-sm">Harga beli tampil</Text> : null}
                        {canEditItems ? (
                        <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          onPress={() => {
                            setEditingPoIndex(idx);
                            setPoItemModalOpen(true);
                          }}
                        >
                          <Edit2 size={13} color={colors.text} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          onPress={async () => {
                            const updated = splitted.filter((_: any, i: number) => i !== idx);
                            await patchRow("supplier-pos", row.id, {
                              item: updated.length > 0 ? updated.join(", ") : "-",
                            });
                            await reload();
                            onRefresh?.();
                            toast("Barang berhasil dihapus dari PO");
                          }}
                        >
                          <Trash2 size={13} color={colors.danger} />
                        </Button>
                        </>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
                {splitted.length > 10 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 border border-border/60 rounded-lg flex-row items-center justify-center gap-1.5 mt-2"
                    onPress={() => setShowAllPoItems((v) => !v)}
                  >
                    <Text className="text-xs font-semibold text-primary">
                      {showAllPoItems ? "Sembunyikan" : `Lihat Semua (${splitted.length} item)`}
                    </Text>
                  </Button>
                )}
              </>
            );
          })()
        ) : (
          <Text className="text-muted-foreground text-xs py-1">Belum ada rincian barang di PO ini.</Text>
        )}
        {showPrice ? (
          <View className="mt-2 pt-2 border-t border-border/50 gap-1">
            {effectivePoPpnMode !== "none" ? (
              <>
                <View className="flex-row items-center justify-between py-0.5">
                  <Text className="text-xs text-muted-foreground">
                    {effectivePoPpnMode === "include" ? "DPP (Sebelum PPN 11%)" : "Subtotal Harga Barang (DPP)"}
                  </Text>
                  <Text className="text-xs font-medium text-foreground">{rupiah(effectivePoDpp)}</Text>
                </View>
                <View className="flex-row items-center justify-between py-0.5">
                  <Text className="text-xs text-muted-foreground">
                    PPN 11% ({effectivePoPpnMode === "include" ? "Include PPN" : "Exclude PPN +11%"})
                  </Text>
                  <Text className="text-xs font-medium text-foreground">{rupiah(effectivePoPpn)}</Text>
                </View>
              </>
            ) : (
              <View className="flex-row items-center justify-between py-0.5">
                <Text className="text-xs text-muted-foreground">Ketentuan Pajak</Text>
                <Text className="text-xs text-muted-foreground">Tanpa PPN (Non-PPN)</Text>
              </View>
            )}
            {effectivePoPph > 0 ? (
              <View className="flex-row items-center justify-between py-0.5">
                <Text className="text-xs text-danger font-medium">
                  Potongan {pphModeToTipe(effectivePoPphMode)}
                </Text>
                <Text className="text-xs font-medium text-danger">-{rupiah(effectivePoPph)}</Text>
              </View>
            ) : null}
            <Line
              left={
                effectivePoPpnMode === "exclude"
                  ? "Total harga beli (Termasuk PPN 11%)"
                  : effectivePoPpnMode === "include"
                    ? "Total harga beli (Include PPN 11%)"
                    : "Total harga beli"
              }
              right={<Text className="text-sm font-bold text-primary">{rupiah(effectivePoGrandTotal)}</Text>}
            />
          </View>
        ) : null}
        <Text className="text-muted-foreground mt-2 text-[13px]">Penerimaan sebagian diperbolehkan di Gudang.</Text>
      </Panel>

      {showPrice ? (
        <Panel
          title="Faktur Masuk & Pembayaran ke Pemasok"
          subtitle="Tagihan dari pemasok atas PO ini beserta status pelunasan oleh Finance."
          right={
            canRecordInvoice ? (
              <Button size="sm" variant="outline" onPress={handleOpenInvoiceModal} className="flex-row items-center gap-1">
                <Plus size={14} color={colors.text} />
                <Text className="text-xs">Catat Faktur Masuk</Text>
              </Button>
            ) : undefined
          }
        >
          {supplierInvoices.length === 0 ? (
            <Text className="text-muted-foreground text-xs py-1">Belum ada tagihan (Faktur Masuk) dari pemasok untuk PO ini.</Text>
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
        subtitle="Pengembalian barang rusak / salah kirim ke pemasok (mendukung pemilihan Serial Number unit)"
        right={
          canRetur ? (
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
          ) : undefined
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
                    placeholder="Pilih SN unit yang diretur ke pemasok..."
                  />
                </FormField>
              );
            })()}
            <FormField label="Jumlah Retur (Qty)" required>
              <Input value={returQty} onChangeText={setReturQty} keyboardType="numeric" />
            </FormField>
            <FormField label="Alasan Retur ke Pemasok" required>
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
        <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b border-border/60">
            <View className="flex-row items-center gap-2.5">
              <View className="w-8 h-8 rounded-lg bg-primary/10 items-center justify-center">
                <Receipt size={18} color={colors.primary} />
              </View>
              <View className="flex-1">
                <DialogTitle>Catat Faktur Masuk dari Pemasok</DialogTitle>
                <Text className="text-xs text-muted-foreground mt-0.5">
                  Catat tagihan invoice masuk dari supplier {row.supplier ? `(${row.supplier})` : ""} untuk PO {row.nomor}
                </Text>
              </View>
            </View>
          </DialogHeader>

          <ScrollView contentContainerClassName="p-4 gap-3.5" style={{ maxHeight: 560 }}>
            {/* Ringkasan Nilai PO & Syarat Pembayaran */}
            <View className="bg-card p-3 rounded-xl border border-border gap-1.5">
              <View className="flex-row justify-between items-center">
                <Text className="text-xs text-muted-foreground">
                  {poIsInclude ? "Nilai PO (Termasuk PPN):" : "Nilai Dasar PO (DPP):"}
                </Text>
                <Text className="text-xs font-bold text-foreground">{rupiah(poBase)}</Text>
              </View>
              {supplierInvoices.length > 0 ? (
                <>
                  <View className="flex-row justify-between items-center">
                    <Text className="text-xs text-muted-foreground">Sudah Ditagihkan ({supplierInvoices.length} invoice):</Text>
                    <Text className="text-xs font-semibold text-emerald-600">{rupiah(poAlreadyBilledBase)}</Text>
                  </View>
                  <View className="flex-row justify-between items-center pt-1 border-t border-border/60">
                    <Text className="text-xs font-bold text-foreground">
                      {poIsInclude ? "Sisa Belum Ditagih (Termasuk PPN):" : "Sisa Belum Ditagih (DPP):"}
                    </Text>
                    <Text className="text-xs font-bold text-primary">{rupiah(poRemainingBase)}</Text>
                  </View>
                </>
              ) : null}
              {row.paymentTerms ? (
                <View className="flex-row justify-between items-center pt-1 border-t border-border/40">
                  <Text className="text-[11px] text-muted-foreground">Syarat Pembayaran PO:</Text>
                  <Text className="text-[11px] font-semibold text-primary">{row.paymentTerms}</Text>
                </View>
              ) : null}
            </View>

            {/* Skema Tagihan: Sekaligus / DP / Termin / Pelunasan */}
            <FormField label="Skema Tagihan Faktur Ini" required>
              <View className="flex-row gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant={invTagihanScheme === "SEKALIGUS" ? "default" : "outline"}
                  onPress={() => handleSwitchTagihanScheme("SEKALIGUS")}
                  className="flex-1 min-w-[100px]"
                >
                  <Text className="text-xs font-semibold">Sekaligus (100%)</Text>
                </Button>
                <Button
                  size="sm"
                  variant={invTagihanScheme === "DP" ? "default" : "outline"}
                  onPress={() => handleSwitchTagihanScheme("DP")}
                  className="flex-1 min-w-[100px]"
                >
                  <Text className="text-xs font-semibold">DP (Uang Muka)</Text>
                </Button>
                <Button
                  size="sm"
                  variant={invTagihanScheme === "TERMIN" ? "default" : "outline"}
                  onPress={() => handleSwitchTagihanScheme("TERMIN")}
                  className="flex-1 min-w-[100px]"
                >
                  <Text className="text-xs font-semibold">Termin (Bertahap)</Text>
                </Button>
                {supplierInvoices.length > 0 ? (
                  <Button
                    size="sm"
                    variant={invTagihanScheme === "PELUNASAN" ? "default" : "outline"}
                    onPress={() => handleSwitchTagihanScheme("PELUNASAN")}
                    className="flex-1 min-w-[100px]"
                  >
                    <Text className="text-xs font-semibold">Pelunasan (Sisa)</Text>
                  </Button>
                ) : null}
              </View>
            </FormField>

            {invTagihanScheme === "DP" ? (
              <FormField label="Persentase DP (%)" required>
                <Input
                  value={invDpPercent}
                  onChangeText={(val) => {
                    const clean = val.replace(/\D/g, "");
                    setInvDpPercent(clean);
                    handleSwitchTagihanScheme("DP", clean);
                  }}
                  keyboardType="numeric"
                  placeholder="50"
                />
              </FormField>
            ) : invTagihanScheme === "TERMIN" ? (
              <FormField label={`Persentase Termin ${supplierInvoices.length + 1} (%)`} required>
                <Input
                  value={invTerminPercent}
                  onChangeText={(val) => {
                    const clean = val.replace(/\D/g, "");
                    setInvTerminPercent(clean);
                    handleSwitchTagihanScheme("TERMIN", clean);
                  }}
                  keyboardType="numeric"
                  placeholder="30"
                />
              </FormField>
            ) : null}

            {/* Status bayar: tidak ditanya ulang bila sudah jelas dari Request / hak akses */}
            {isPrepaid ? (
              <View className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex-row items-start gap-2">
                <CheckCircle2 size={16} color={colors.success} />
                <Text className="text-xs text-foreground flex-1">
                  Pembelian ini sudah dibayar di muka{row.request && row.request !== "-" ? ` (Request ${row.request})` : ""}. Faktur
                  ini otomatis tercatat lunas lewat kompensasi — tidak ada kas keluar lagi, tidak perlu isi jatuh tempo.
                </Text>
              </View>
            ) : canPay ? (
              <FormField label="Faktur ini sudah dibayar?" required>
                <View className="flex-row gap-2">
                  <Button
                    size="sm"
                    variant={invPaymentScheme === "TEMPO" ? "default" : "outline"}
                    onPress={() => setInvPaymentScheme("TEMPO")}
                    className="flex-1"
                  >
                    <Text className="text-xs font-semibold">Belum — bayar saat jatuh tempo</Text>
                  </Button>
                  <Button
                    size="sm"
                    variant={invPaymentScheme === "LUNAS" ? "default" : "outline"}
                    onPress={() => setInvPaymentScheme("LUNAS")}
                    className="flex-1"
                  >
                    <Text className="text-xs font-semibold">Sudah, bayar sekarang</Text>
                  </Button>
                </View>
              </FormField>
            ) : (
              <View className="bg-panel/60 border border-border/70 rounded-xl p-3 flex-row items-start gap-2">
                <FileText size={15} color={colors.text} />
                <Text className="text-xs text-muted-foreground flex-1">
                  Faktur dicatat sebagai tagihan (hutang). Pelunasannya dilakukan Finance dari halaman PO ini.
                </Text>
              </View>
            )}

            {/* Metode & Akun COA saat Langsung Lunas */}
            {invPaymentScheme === "LUNAS" && canPay && !isPrepaid ? (
              <View className="flex-row flex-wrap gap-3">
                <View className="flex-1 min-w-[240px]">
                  <FormField label="Metode Pembayaran Lunas">
                    <View className="flex-row gap-2">
                      <Button
                        size="sm"
                        variant={invPayMethod === "TRANSFER" ? "default" : "outline"}
                        onPress={() => {
                          setInvPayMethod("TRANSFER");
                          const firstBank = kasBankOptions.find(
                            (o) => o.code !== "1000.01" && !/kas/i.test(o.rawName)
                          );
                          if (firstBank) setInvCoaAccount(firstBank.code);
                        }}
                        className="flex-1"
                      >
                        <Text className="text-xs">Transfer Bank</Text>
                      </Button>
                      <Button
                        size="sm"
                        variant={invPayMethod === "TUNAI" ? "default" : "outline"}
                        onPress={() => {
                          setInvPayMethod("TUNAI");
                          const cashAcc = kasBankOptions.find(
                            (o) => o.code === "1000.01" || /kas/i.test(o.rawName)
                          );
                          if (cashAcc) setInvCoaAccount(cashAcc.code);
                        }}
                        className="flex-1"
                      >
                        <Text className="text-xs">Kas / Tunai</Text>
                      </Button>
                    </View>
                  </FormField>
                </View>

                <View className="flex-1 min-w-[240px]">
                  <FormField
                    label="Pilih Akun Kas / Bank (CoA) Sumber Bayar *"
                    hint="Rekening kas/bank yang dipotong (Kredit Kas/Bank)"
                  >
                    <SearchableSelect
                      value={
                        kasBankOptions.find((o) => o.code === invCoaAccount)?.name ||
                        kasBankOptions[0]?.name ||
                        ""
                      }
                      options={kasBankOptions.map((o) => o.name)}
                      onChange={(val) => {
                        const match = kasBankOptions.find((o) => o.name === val || val.includes(o.code));
                        if (match) {
                          setInvCoaAccount(match.code);
                          const isTunai = match.code === "1000.01" || /kas/i.test(match.rawName);
                          setInvPayMethod(isTunai ? "TUNAI" : "TRANSFER");
                        }
                      }}
                      placeholder="Pilih rekening kas / bank..."
                    />
                  </FormField>
                </View>
              </View>
            ) : null}

            {/* Nomor Invoice & Nilai DPP / Tagihan */}
            <View className="flex-row flex-wrap gap-3">
              <View className="flex-1 min-w-[240px]">
                <FormField label="Nomor Faktur Pemasok" required>
                  <Input value={invNumber} onChangeText={setInvNumber} placeholder="Contoh: INV-SUP/2026/001" />
                </FormField>
              </View>
              <View className="flex-1 min-w-[240px]">
                <FormField
                  label={
                    invPpnMode === "include"
                      ? "Nominal Tagihan (Sudah Termasuk PPN)"
                      : invPpnMode === "exclude"
                        ? "Nilai DPP Sebelum PPN (Rp)"
                        : "Nominal Tagihan (Tanpa PPN)"
                  }
                  required
                >
                  <Input
                    value={invAmount}
                    onChangeText={(val) => setInvAmount(formatThousands(val))}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </FormField>
              </View>
            </View>

            {/* Ketentuan PPN & PPh Ringkasan Nominal */}
            <View className="bg-panel rounded-xl border border-border p-3 gap-2.5">
              <View className="flex-row items-center justify-between flex-wrap gap-2">
                <Text className="text-xs font-semibold text-foreground">Ketentuan PPN Masukan (11%):</Text>
                <View className="flex-row gap-1.5">
                  {(
                    [
                      { id: "none", label: "Tanpa PPN" },
                      { id: "exclude", label: "Exclude (+11%)" },
                      { id: "include", label: "Include (11%)" },
                    ] as const
                  ).map((opt) => (
                    <Button
                      key={opt.id}
                      size="sm"
                      variant={invPpnMode === opt.id ? "default" : "outline"}
                      disabled={opt.id !== effectivePoPpnMode}
                      onPress={() => {
                        if (opt.id === "include" && invPpnMode !== "include") {
                          setInvAmount(formatThousands(String(calcInvDpp + calcInvPpn || rawInvInput)));
                        } else if (opt.id === "exclude" && invPpnMode === "include") {
                          setInvAmount(formatThousands(String(calcInvDpp || rawInvInput)));
                        }
                        setInvPpnMode(opt.id);
                      }}
                      className="h-7 px-2.5"
                    >
                      <Text className="text-[11px] font-semibold">{opt.label}</Text>
                    </Button>
                  ))}
                </View>
              </View>

              <View className="flex-row items-center justify-between flex-wrap gap-2 pt-2 border-t border-border/50">
                <View>
                  <Text className="text-xs font-semibold text-foreground">Pemotongan PPh (Jasa / Vendor):</Text>
                  <Text className="text-[10px] text-muted-foreground">
                    {PPH_MODE_OPTIONS.find((o) => o.id === invPphMode)?.desc}
                  </Text>
                </View>
                <View className="flex-row gap-1 flex-wrap">
                  {PPH_MODE_OPTIONS.map((opt) => (
                    <Button
                      key={opt.id}
                      size="sm"
                      variant={invPphMode === opt.id ? "default" : "outline"}
                      onPress={() => setInvPphMode(opt.id)}
                      className="h-7 px-2"
                    >
                      <Text className={`text-[11px] font-semibold ${opt.id === invPphMode ? "text-primary-foreground" : ""}`}>{opt.label}</Text>
                    </Button>
                  ))}
                </View>
              </View>

              {invPphMode !== "none" ? (
                <View className="bg-card/80 border border-border/80 rounded-lg p-2.5 flex-row items-center justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-xs font-semibold text-foreground">
                      Nilai Jasa Kena PPh (DPP Jasa):
                    </Text>
                    <Text className="text-[10px] text-muted-foreground">
                      PPh dipotong dari biaya jasa, bukan barang material fisik
                    </Text>
                  </View>
                  <View className="w-36">
                    <Input
                      value={invJasaDpp}
                      onChangeText={(v) => setInvJasaDpp(formatThousands(v))}
                      keyboardType="numeric"
                      placeholder="0"
                    />
                  </View>
                </View>
              ) : null}

              <View className="border-t border-border/60 pt-2 gap-1">
                <View className="flex-row justify-between">
                  <Text className="text-xs text-muted-foreground">DPP (Masuk Persediaan/HPP/Beban):</Text>
                  <Text className="text-xs font-semibold text-foreground">{rupiah(calcInvDpp)}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-xs text-muted-foreground">PPN Masukan 11% (Akun 1600):</Text>
                  <Text className="text-xs font-semibold text-foreground">{rupiah(calcInvPpn)}</Text>
                </View>
                {calcInvPph > 0 ? (
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-danger font-medium">
                      Potongan {pphModeToTipe(invPphMode)} ({pphRateFor(invPphMode) * 100}% dari Jasa {rupiah(effJasaDpp)}):
                    </Text>
                    <Text className="text-xs font-semibold text-danger">-{rupiah(calcInvPph)}</Text>
                  </View>
                ) : null}
                <View className="flex-row justify-between pt-1 border-t border-border/60 items-center">
                  <Text className="text-xs font-bold text-foreground">Total Tagihan Bersih (Hutang ke Pemasok):</Text>
                  <Text className="text-sm font-bold text-primary">{rupiah(calcInvTotal)}</Text>
                </View>
              </View>
            </View>

            {/* Tanggal Invoice & Jatuh Tempo */}
            <View className="flex-row flex-wrap gap-3">
              <View className="flex-1 min-w-[240px]">
                <FormField label="Tanggal Faktur *" hint="Tanggal terbit faktur pemasok">
                  <DatePicker value={invDate} onChange={setInvDate} />
                </FormField>
              </View>
              {invPaymentScheme === "TEMPO" && !isPrepaid ? (
                <View className="flex-1 min-w-[240px]">
                  <FormField
                    label="Jatuh Tempo *"
                    hint={
                      row.requestDueDate
                        ? `Otomatis dari Request ${row.request} — ubah hanya bila faktur supplier berbeda`
                        : row.paymentTerms
                        ? `Otomatis dari syarat bayar PO (${row.paymentTerms})`
                        : "Batas waktu pembayaran ke pemasok"
                    }
                  >
                    <DatePicker value={invDue} onChange={setInvDue} />
                  </FormField>
                </View>
              ) : null}
            </View>

            {/* Upload Files Berdampingan / Samping-sampingan */}
            <View className="flex-row flex-wrap gap-3 mt-1">
              <View className="flex-1 min-w-[260px]">
                <FileUploader
                  label="File Faktur Pemasok (Gambar/PDF) *"
                  kind="semua"
                  accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp"
                  category="invoice"
                  autoFlush
                  handleRef={(h) => {
                    invFileHandle.current = h;
                  }}
                  onUploaded={(fileId) => setInvFileId(fileId)}
                  hint="File tagihan faktur resmi dari pemasok"
                />
              </View>
              {invPaymentScheme === "LUNAS" && canPay && !isPrepaid ? (
                <View className="flex-1 min-w-[260px]">
                  <FileUploader
                    label="Bukti Bayar / Transfer (Gambar/PDF) *"
                    kind="semua"
                    accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp"
                    category="bukti-bayar-supplier"
                    autoFlush
                    handleRef={(h) => {
                      invPayProofHandle.current = h;
                    }}
                    onUploaded={(fileId) => setInvPayProofFileId(fileId)}
                    hint="Bukti transfer bank atau struk kas pelunasan"
                  />
                </View>
              ) : null}
            </View>
          </ScrollView>

          <DialogFooter className="p-3 border-t border-border/60 flex-row items-center justify-end gap-2 bg-muted/20">
            <Button variant="outline" size="sm" onPress={() => setInvOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button size="sm" onPress={handleCreateInvoiceIn}>
              <Text>{invPaymentScheme === "LUNAS" && canPay && !isPrepaid ? "Simpan & Tandai Lunas" : "Simpan Faktur Masuk"}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SupplierInvoiceDetailDialog
        open={!!selectedDetailInv}
        onOpenChange={(v) => !v && setSelectedDetailInv(null)}
        invoice={selectedDetailInv}
        canPay={canPay}
        canEdit={canEdit}
        onPayPress={(inv) => setPayTargetInv(inv)}
        onEditPress={(inv) => setEditTargetInv(inv)}
      />

      <SupplierInvoiceEditDialog
        open={!!editTargetInv}
        onOpenChange={(v) => !v && setEditTargetInv(null)}
        invoice={editTargetInv}
        onSuccess={() => {
          setSelectedDetailInv(null);
        }}
      />

      <SupplierInvoicePayDialog
        open={!!payTargetInv}
        onOpenChange={(v) => !v && setPayTargetInv(null)}
        invoice={payTargetInv}
        onSuccess={() => {
          setSelectedDetailInv(null);
        }}
      />

      <ItemEditorDialog
        open={poItemModalOpen}
        onOpenChange={(open) => {
          setPoItemModalOpen(open);
          if (!open) setEditingPoIndex(null);
        }}
        initialItem={currentPoEditingItem}
        isBuyPrice={true}
        title={editingPoIndex !== null ? "Edit Barang PO" : "Tambah Barang PO"}
        onSave={handleSavePoItem}
      />
    </>
  );
}
