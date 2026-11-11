import * as React from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import {
  CheckCircle2,
  AlertTriangle,
  Truck,
  PackageCheck,
  XCircle,
  Clock,
  Check,
  FileText,
  Plus,
  DollarSign,
  ExternalLink,
  Calendar,
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Panel, FormField } from "@/components/taska/basics";
import { FileUploader, type FileUploaderHandle } from "@/components/taska/file-uploader";
import {
  SearchableSelect,
  DatePicker,
  QuickAddSupplierDialog,
  SupplierSelect,
} from "@/components/taska/dialogs";
import { StatusBadge } from "@/components/taska/status-badge";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { rupiah, formatThousands } from "@/lib/format";
import { type Row } from "@/constants/modules";
import { toEnum } from "@/services/adapters";

export function PurchaseRequestExtras({
  row,
  onRefresh,
}: {
  row: Row;
  onRefresh?: () => Promise<void> | void;
}) {
  const router = useRouter();
  const { user, data, addRow, patchRow, setStatus, decide, toast, reload, approvals } = useApp();
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");
  const [confirmSendOpen, setConfirmSendOpen] = React.useState(false);
  const [confirmReceiveOpen, setConfirmReceiveOpen] = React.useState(false);
  const [payModalOpen, setPayModalOpen] = React.useState(false);
  const [createPoOpen, setCreatePoOpen] = React.useState(false);
  const [quickSupplierOpen, setQuickSupplierOpen] = React.useState(false);
  const [poSupplierId, setPoSupplierId] = React.useState<string>("");
  const [poPaymentTerms, setPoPaymentTerms] = React.useState<string>("Utang / Tempo (Net 30)");
  const [poEta, setPoEta] = React.useState<string>("");
  const [poTotal, setPoTotal] = React.useState<string>("");
  const [paymentProofFileId, setPaymentProofFileId] = React.useState<number | null>(null);
  const [payProofHasFile, setPayProofHasFile] = React.useState(false);
  const payProofHandle = React.useRef<FileUploaderHandle | null>(null);
  const [selectedFundingSource, setSelectedFundingSource] = React.useState<string>("1000.01");
  const [doFileId, setDoFileId] = React.useState<number | null>(null);
  const doFileHandle = React.useRef<FileUploaderHandle | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [localStatus, setLocalStatus] = React.useState<string | null>(null);

  const role = user?.role ?? "";
  const isGudang = role === "gudang" || role === "super_admin" || role === "admin";
  const isProcurement = role === "procurement" || role === "super_admin" || role === "admin";
  const isFinance = role === "finance" || role === "bos" || role === "super_admin" || role === "admin";
  const isRequesterOrPM =
    String(row.pemohonId) === String(user?.id) ||
    role === "pm" ||
    role === "super_admin" ||
    role === "admin";

  const procSource = String(row.procurementSource || "").toUpperCase();
  const payMethod = String(row.paymentMethod || "").toUpperCase();
  const costType = String(row.costType || "").toUpperCase();
  const isProject = costType === "PROJECT" || !!(row.projectId || (row.project && row.project !== "-"));

  // 4 Kategori Alur Dokumen:
  const isStockTake = procSource === "GUDANG"; // Flow 1: Ambil Stok Gudang untuk Project
  const isCash =
    payMethod === "KAS" ||
    payMethod === "TUNAI" ||
    payMethod === "CASH" ||
    payMethod.includes("KAS") ||
    payMethod.includes("TUNAI");
  const isDebt = !isStockTake && !isCash;
  const isRetailCash = procSource === "RETAIL" && isCash; // Flow 2: Pembelian Ritel Tunai/Lunas
  const isRetailDebt = (procSource === "RETAIL" || !procSource) && !isStockTake && isDebt; // Flow 3: Pembelian Ritel Tempo
  const isSupplierPo = procSource === "SUPPLIER" || (!procSource && !isStockTake); // Flow 4: Pengadaan via PO Supplier
  const isRetailOrPurchase = !isStockTake;

  // Raw status enum
  const effectiveRaw = (
    localStatus ||
    row.rawStatus ||
    (row.status ? toEnum("purchase-requests", row.status) : "DIAJUKAN") ||
    "DIAJUKAN"
  ).toUpperCase();

  const linkedPo = React.useMemo(() => {
    const prSuffix = String(row.nomor || "").replace(/^(?:PNJ|REQ|PR)\//i, "");
    const fromList = (data["supplier-pos"] ?? []).find(
      (sp: Row) =>
        (sp.requestId && String(sp.requestId) === String(row.id)) ||
        (row.nomor && sp.request && String(sp.request).toLowerCase() === String(row.nomor).toLowerCase()) ||
        (row.nomor && String(sp.nomor).includes(row.nomor)) ||
        (prSuffix && sp.nomor && String(sp.nomor).replace(/^(?:POD|PO-S|PO)\//i, "") === prSuffix),
    );
    if (fromList) return fromList;
    if (Array.isArray(row.supplierPOs) && row.supplierPOs.length > 0) {
      const p = row.supplierPOs[0];
      return {
        id: String(p.id),
        nomor: p.number || `PO/${p.id}`,
        status: p.status,
        shipmentStatus: p.shipmentStatus,
        total: p.total,
        supplier: p.supplier?.name || row.supplier || "-",
        isPaid: p.isPaid,
        invoiceIns: p.invoiceIns,
      };
    }
    if (row.supplierPo) {
      return {
        id: String(row.supplierPo.id),
        nomor: row.supplierPo.number || `PO/${row.supplierPo.id}`,
        status: row.supplierPo.status,
        shipmentStatus: row.supplierPo.shipmentStatus,
        total: row.supplierPo.total,
        supplier: row.supplierPo.supplier?.name || row.supplier || "-",
        isPaid: row.supplierPo.isPaid,
        invoiceIns: row.supplierPo.invoiceIns,
      };
    }
    return null;
  }, [data, row.id, row.nomor, row.supplierPOs, row.supplierPo, row.supplier]);

  const linkedPos = React.useMemo(() => {
    const list = data["supplier-pos"] ?? [];
    const prSuffix = String(row.nomor || "").replace(/^(?:PNJ|REQ|PR)\//i, "");
    const matched = list.filter(
      (sp: Row) =>
        (sp.requestId && String(sp.requestId) === String(row.id)) ||
        (row.nomor && sp.request && String(sp.request).toLowerCase() === String(row.nomor).toLowerCase()) ||
        (row.nomor && String(sp.nomor).includes(row.nomor)) ||
        (prSuffix && sp.nomor && String(sp.nomor).replace(/^(?:POD|PO-S|PO)\//i, "") === prSuffix),
    );
    if (matched.length > 0) return matched;
    if (linkedPo) return [linkedPo];
    return [];
  }, [data, row.id, row.nomor, linkedPo]);

  const linkedReceivings = React.useMemo(() => {
    return (data.receiving ?? []).filter((rc: Row) => {
      if (rc.requestId && String(rc.requestId) === String(row.id)) return true;
      if (row.nomor && (rc.requestNumber === row.nomor || rc.request === row.nomor)) return true;
      if (
        linkedPos.some(
          (p: Row) =>
            String(rc.supplierPoId) === String(p.id) ||
            (p.nomor && (rc.poNumber === p.nomor || rc.po === p.nomor)),
        )
      ) {
        return true;
      }
      return false;
    });
  }, [data.receiving, row.id, linkedPos, row.nomor]);

  const hasConfirmedReceiving = React.useMemo(() => {
    return linkedReceivings.some(
      (rc: Row) =>
        String(rc.rawStatus || rc.status).toUpperCase() === "DITERIMA" ||
        String(rc.status || "").toLowerCase() === "diterima",
    );
  }, [linkedReceivings]);

  const isPoPaid = React.useMemo(() => {
    if (Boolean(row.isPaid) || String(row.paymentStatus || "").toUpperCase() === "DIBAYAR") return true;
    if (linkedPos.length === 0) return false;
    return linkedPos.some((p: Row) => {
      const poSt = String(p.status || "").toUpperCase();
      const poPaySt = String(p.paymentStatus || "").toUpperCase();
      if (
        p.isPaid ||
        poSt === "LUNAS" ||
        poSt === "DIBAYAR" ||
        poPaySt === "LUNAS" ||
        poPaySt === "DIBAYAR"
      ) {
        return true;
      }
      const invs = (data.invoiceIn ?? []).filter(
        (inv: Row) =>
          String(inv.supplierPoId) === String(p.id) ||
          (p.nomor && inv.po === p.nomor),
      );
      if (
        invs.some(
          (inv: Row) =>
            inv.status === "PAID" ||
            inv.status === "Lunas" ||
            (Number(inv.paidAmount || 0) >= Number(inv.total || 0) && Number(inv.total || 0) > 0),
        )
      ) {
        return true;
      }
      if (
        Array.isArray(p.invoiceIns) &&
        p.invoiceIns.some(
          (inv: any) =>
            inv.status === "PAID" ||
            (Number(inv.paidAmount || 0) >= Number(inv.total || 0) && Number(inv.total || 0) > 0),
        )
      ) {
        return true;
      }
      return false;
    });
  }, [row.isPaid, row.paymentStatus, linkedPos, data.invoiceIn]);

  const isDiajukan = effectiveRaw === "DIAJUKAN";
  const isCekStok = effectiveRaw === "CEK_STOK";
  const isDisetujui = effectiveRaw === "DISETUJUI";
  const isPoDibuat =
    effectiveRaw === "PO_DIBUAT" ||
    row.status === "PO dibuat" ||
    localStatus === "PO_DIBUAT" ||
    linkedPos.length > 0;

  const isDiterima =
    effectiveRaw === "DITERIMA" ||
    row.status === "Diterima" ||
    hasConfirmedReceiving ||
    (isDebt && isPoPaid && hasConfirmedReceiving);

  const isDikirim =
    effectiveRaw === "DIKIRIM" ||
    row.status === "Dikirim" ||
    localStatus === "DIKIRIM" ||
    linkedPos.some((p: Row) => {
      const s = String(p.shipmentStatus || p.pengiriman || p.status || "").toLowerCase();
      return s === "dikirim" || s === "sampai" || s === "diterima" || s === "lunas";
    });

  const isDispatched = isDikirim || isDiterima || hasConfirmedReceiving;

  const isPaid =
    isPoPaid ||
    localStatus === "LUNAS" ||
    localStatus === "DIBAYAR" ||
    effectiveRaw === "DIBAYAR" ||
    row.status === "Lunas" ||
    row.status === "Dibayar" ||
    String(row.paymentStatus || "").toUpperCase() === "DIBAYAR" ||
    !!row.paymentProofFileId;

  const isDitolak = effectiveRaw === "DITOLAK";

  const isApproved =
    isDisetujui ||
    isPoDibuat ||
    isPaid ||
    isDispatched ||
    isDiterima ||
    row.approval?.status === "Disetujui";

  const isStockChecked = isCekStok || isApproved || isDispatched || isDiterima;

  const items: any[] = React.useMemo(() => (Array.isArray(row.items) ? row.items : []), [row.items]);
  const stockInfo: any[] = React.useMemo(() => (Array.isArray(row.stock) ? row.stock : []), [row.stock]);
  const approval =
    row.approval ??
    approvals.find(
      (a) =>
        a.module === "purchase-requests" &&
        String(a.refId) === String(row.id),
    );
  const isPendingApproval = approval?.status === "Menunggu" && !isApproved;

  // Check if all items have sufficient warehouse stock
  const stockSummary = React.useMemo(() => {
    return items.map((i) => {
      const isCustom = !i.productId && !!i.customName;
      const match = i.productId ? stockInfo.find((s) => s.productId === i.productId) : undefined;
      const available = match?.available ?? 0;
      const ordered = i.qty ?? 0;
      return {
        ...i,
        isCustom,
        available,
        ordered,
        isEnough: isCustom ? false : available >= ordered,
      };
    });
  }, [items, stockInfo]);

  const linkedInvoices = React.useMemo(() => {
    if (!linkedPo) return [];
    return (data.invoiceIn ?? []).filter(
      (inv: Row) => String(inv.supplierPoId) === String(linkedPo.id) || inv.po === linkedPo.nomor,
    );
  }, [data.invoiceIn, linkedPo]);

  function handleOpenCreatePo() {
    const suppliersList = data.suppliers ?? [];
    const matchedSupplier =
      suppliersList.find(
        (s: Row) =>
          (row.supplierId && String(s.id) === String(row.supplierId)) ||
          (row.supplier && String(s.nama || s.name).toLowerCase() === String(row.supplier).toLowerCase()),
      ) ?? suppliersList[0];

    setPoSupplierId(matchedSupplier?.id ? String(matchedSupplier.id) : "");
    setPoPaymentTerms(
      row.paymentMethod === "KAS"
        ? "Tunai / Kas"
        : row.paymentMethod === "NET14"
        ? "Utang / Tempo (Net 14)"
        : "Utang / Tempo (Net 30)",
    );
    const defaultEta = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0] || "";
    setPoEta(defaultEta);
    setPoTotal(row.estimasi ? formatThousands(row.estimasi) : "");
    setCreatePoOpen(true);
  }

  async function handleSubmitCreatePo() {
    const suppliersList = data.suppliers ?? [];
    const targetSupplier =
      suppliersList.find((s: Row) => String(s.id) === String(poSupplierId)) ??
      suppliersList.find((s: Row) => (s.nama || s.name) === poSupplierId) ??
      suppliersList[0];
    const supplierName = targetSupplier?.nama ?? targetSupplier?.name ?? row.supplier ?? "Supplier Utama";
    const supplierId = targetSupplier?.id ? Number(targetSupplier.id) : row.supplierId ? Number(row.supplierId) : undefined;

    const reqItems = Array.isArray(row.items) && row.items.length
      ? row.items.map((i: any) => ({
          productId: i.productId || i.product?.id ? Number(i.productId || i.product?.id) : undefined,
          customName: i.customName || undefined,
          customUnit: i.customUnit || undefined,
          qty: Number(i.qty) || 1,
          price: Number(
            i.unitCost ||
              i.estimatedPrice ||
              i.price ||
              (row.estimasi ? Math.round(row.estimasi / row.items.length) : 0),
          ),
        }))
      : undefined;

    setLoading(true);
    try {
      const cleanPoTotal = Number(String(poTotal).replace(/\./g, "").replace(/,/g, ".")) || 0;
      const targetTotal = cleanPoTotal || row.estimasi || 0;
      const prPpnMode: "none" | "exclude" | "include" =
        row.ppnMode === "exclude" || row.ppnMode === "include"
          ? row.ppnMode
          : ((row.otherNote?.match(/\[PPN:([^\]]+)\]/)?.[1] as any) || "none");
      const poDppVal = prPpnMode === "none" ? targetTotal : Math.round(targetTotal / 1.11);
      const poPpnVal = prPpnMode === "none" ? 0 : Math.max(0, targetTotal - poDppVal);

      const created = await addRow("supplier-pos", {
        supplier: supplierName,
        supplierId: supplierId,
        request: row.nomor,
        requestId: row.id != null ? Number(row.id) : undefined,
        projectId: row.projectId != null ? Number(row.projectId) : undefined,
        project: row.project,
        payment: poPaymentTerms,
        paymentTerms: poPaymentTerms,
        item: row.item || row.tujuan || "Barang Permintaan",
        items: reqItems,
        total: targetTotal,
        dpp: poDppVal,
        ppn: poPpnVal,
        ppnMode: prPpnMode,
        eta: poEta || undefined,
        status: isPaid
          ? "Lunas"
          : isDiterima
          ? "Sampai"
          : isDikirim
          ? "Dikirim"
          : isApproved
          ? "Disetujui"
          : "Menunggu persetujuan",
      });
      if (created) {
        setCreatePoOpen(false);
        setLocalStatus("PO_DIBUAT");
        const curStatus = String(row.status || "").toLowerCase();
        if (!["diterima", "lunas", "dikirim"].includes(curStatus)) {
          try {
            await setStatus("purchase-requests", row.id, "PO dibuat");
          } catch {}
        }
        toast(`PO Supplier untuk permintaan ${row.nomor} berhasil dibuat dan terhubung!`);
        if (onRefresh) await onRefresh();
        await reload();
      }
    } catch (e: any) {
      toast(e?.message ?? "Gagal membuat PO Supplier", "danger");
    } finally {
      setLoading(false);
    }
  }

  const allStockAvailable = stockSummary.length > 0 && stockSummary.every((s) => s.isEnough);

  async function handleApprove() {
    setLoading(true);
    try {
      setLocalStatus("DISETUJUI");
      const apprv =
        approval ??
        approvals.find(
          (a) =>
            a.module === "purchase-requests" &&
            String(a.refId) === String(row.id),
        );
      if (apprv?.id && (apprv.status === "Menunggu" || isPendingApproval)) {
        try {
          await decide(apprv.id, "Disetujui");
        } catch {}
      }
      await setStatus("purchase-requests", row.id, "Disetujui");
      toast("Permintaan barang berhasil disetujui");
      if (onRefresh) await onRefresh();
      await reload();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menyetujui permintaan", "danger");
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      toast("Alasan penolakan wajib diisi", "danger");
      return;
    }
    setLoading(true);
    try {
      setLocalStatus("DITOLAK");
      if (approval?.id && isPendingApproval) {
        try {
          await decide(approval.id, "Ditolak", rejectReason);
        } catch {}
      }
      await setStatus("purchase-requests", row.id, "Ditolak", rejectReason);
      setRejectOpen(false);
      setRejectReason("");
      toast("Permintaan barang ditolak");
      if (onRefresh) await onRefresh();
      await reload();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menolak permintaan", "danger");
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkCheckStock() {
    setLoading(true);
    try {
      setLocalStatus("CEK_STOK");
      await setStatus("purchase-requests", row.id, "Cek stok");
      toast("Status berhasil diubah ke Cek Stok");
      if (onRefresh) await onRefresh();
      await reload();
    } catch (e: any) {
      toast(e?.message ?? "Gagal memperbarui status", "danger");
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkPaid() {
    if (!payProofHasFile && !paymentProofFileId) {
      toast("Pilih bukti pembayaran terlebih dahulu", "danger");
      return;
    }
    setLoading(true);
    try {
      let finalProofId = paymentProofFileId;
      if (payProofHandle.current?.hasStaged()) {
        finalProofId = await payProofHandle.current.flush();
        if (!finalProofId) {
          toast("Gagal mengunggah bukti pembayaran", "danger");
          setLoading(false);
          return;
        }
      }
      const nextStatus = isDebt ? "Lunas" : "Dibayar";
      setLocalStatus(isDebt ? "LUNAS" : "DIBAYAR");
      await setStatus("purchase-requests", row.id, nextStatus, undefined, {
        paymentProofFileId: finalProofId,
        fundingSource: selectedFundingSource,
        paymentAccountCode: selectedFundingSource,
        paymentStatus: "DIBAYAR",
      });
      if (linkedPo?.id) {
        try {
          await patchRow("supplier-pos", String(linkedPo.id), { status: "Lunas", isPaid: true });
        } catch {}
      }
      setPayModalOpen(false);
      setPaymentProofFileId(null);
      setPayProofHasFile(false);
      payProofHandle.current = null;
      toast(
        isDebt
          ? "Permintaan & PO berhasil ditandai Lunas. Hutang Usaha (210102) telah selesai dicatat di kas keluar!"
          : "Pembayaran kas berhasil dicatat. Status permintaan menjadi Dibayar. Procurement dapat menandai barang dikirim.",
      );
      if (onRefresh) await onRefresh();
      await reload();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menandai pembayaran", "danger");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendGoods() {
    setLoading(true);
    try {
      setLocalStatus("DIKIRIM");
      await setStatus("purchase-requests", row.id, "Dikirim");
      if (linkedPo?.id) {
        try {
          await patchRow("supplier-pos", String(linkedPo.id), {
            pengiriman: "Dikirim",
            shipmentStatus: "DIKIRIM",
            status: "DISETUJUI",
          });
          await setStatus("supplier-pos", String(linkedPo.id), "Dikirim");
        } catch {}
      }
      setConfirmSendOpen(false);
      toast(
        isSupplierPo
          ? "Barang PO Supplier ditandai dikirim. Status PO dan Permintaan Barang telah disinkronkan!"
          : isRetailOrPurchase
          ? "Barang pengadaan ditandai dikirim. Data Penerimaan di Gudang otomatis dibuat!"
          : "Barang berhasil diserahkan/dikirim dari Gudang",
      );
      if (onRefresh) await onRefresh();
      await reload();
    } catch (e: any) {
      toast(e?.message ?? "Gagal memproses penyerahan barang", "danger");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmReceive() {
    setLoading(true);
    try {
      let finalDoId = doFileId;
      if (doFileHandle.current?.hasStaged()) {
        finalDoId = await doFileHandle.current.flush();
      }
      setLocalStatus("DITERIMA");
      await setStatus("purchase-requests", row.id, "Diterima", undefined, finalDoId ? { doFileId: finalDoId } : undefined);
      if (linkedPo?.id) {
        try {
          await patchRow("supplier-pos", String(linkedPo.id), {
            pengiriman: "Sampai",
            shipmentStatus: "SAMPAI",
            status: isPoPaid ? "Lunas" : "DISETUJUI",
          });
          await setStatus("supplier-pos", String(linkedPo.id), "Sampai");
        } catch {}
      }
      setConfirmReceiveOpen(false);
      toast("Penerimaan barang telah dikonfirmasi dan status PO telah disinkronkan!");
      if (onRefresh) await onRefresh();
      await reload();
    } catch (e: any) {
      toast(e?.message ?? "Gagal mengonfirmasi penerimaan barang", "danger");
    } finally {
      setLoading(false);
    }
  }

  // Visual Stepper Stages per Jenis & Flow Request
  const steps = React.useMemo(() => {
    if (isStockTake) {
      // Flow 1: Ambil Stok Gudang untuk Project
      return [
        { label: "Diajukan", done: true, current: isDiajukan },
        { label: "Cek Stok", done: isStockChecked, current: isCekStok },
        { label: "Disetujui", done: isApproved, current: isDisetujui && !isDispatched && !isDiterima },
        { label: "Diserahkan", done: isDispatched, current: isDikirim && !isDiterima },
        { label: "Diterima Proyek", done: isDiterima, current: isDiterima },
      ];
    }
    if (isRetailCash) {
      // Flow 2: Pembelian Ritel Tunai / Kas (Disetujui -> Dibayar Kas -> Dikirim -> Diterima)
      return [
        { label: "Diajukan", done: true, current: isDiajukan },
        { label: "Disetujui", done: isApproved, current: isDisetujui && !isPaid && !isDispatched && !isDiterima },
        { label: "Dibayar (Kas)", done: isPaid, current: (effectiveRaw === "DIBAYAR" || isPaid) && !isDispatched && !isDiterima },
        { label: "Dikirim Toko", done: isDispatched, current: isDikirim && !isDiterima },
        { label: "Diterima Gudang", done: isDiterima, current: isDiterima },
      ];
    }
    if (isRetailDebt) {
      // Flow 3: Pembelian Ritel Tempo / Hutang (Disetujui -> Dikirim -> Diterima Hutang -> Pelunasan)
      return [
        { label: "Diajukan", done: true, current: isDiajukan },
        { label: "Disetujui", done: isApproved, current: isDisetujui && !isDikirim && !isDiterima && !isPaid },
        { label: "Dikirim Toko", done: isDispatched, current: isDikirim && !isDiterima && !isPaid },
        { label: "Diterima (Hutang)", done: isDiterima || isPaid, current: false },
        { label: "Lunas", done: isPaid, current: isDiterima && !isPaid },
      ];
    }
    // Flow 4: Pengadaan via PO Supplier Formal (Tunai)
    if (isSupplierPo && !isDebt) {
      return [
        { label: "Diajukan", done: true, current: isDiajukan },
        { label: "Disetujui", done: isApproved, current: isDisetujui && !isPaid && !isDispatched && !isDiterima },
        { label: "Dibayar (Kas)", done: isPaid, current: (effectiveRaw === "DIBAYAR" || isPaid) && !isDispatched && !isDiterima },
        { label: "Dikirim Supplier", done: isDispatched, current: isDikirim && !isDiterima },
        { label: "Diterima Gudang", done: isDiterima, current: isDiterima },
      ];
    }
    // Flow 5: Pengadaan via PO Supplier Formal (Tempo / Utang)
    return [
      { label: "Diajukan", done: true, current: isDiajukan },
      {
        label: "Disetujui",
        done: isApproved,
        current: isDisetujui && !isPoDibuat && !isDispatched && !isDiterima && !isPaid,
      },
      {
        label: "PO Pemasok",
        done: isPoDibuat || isDispatched || isDiterima || isPaid,
        current: isPoDibuat && !isDispatched && !isDiterima && !isPaid,
      },
      {
        label: "Dikirim Supplier",
        done: isDispatched || isDiterima || isPaid,
        current: isDikirim && !isDiterima && !isPaid,
      },
      {
        label: "Diterima (Gudang)",
        done: isDiterima || isPaid,
        current: false,
      },
      {
        label: "Lunas",
        done: isPaid,
        current: isDiterima && !isPaid,
      },
    ];
  }, [
    isStockTake,
    isRetailCash,
    isRetailDebt,
    isDebt,
    isSupplierPo,
    isDiajukan,
    isStockChecked,
    isCekStok,
    isApproved,
    isDisetujui,
    isPoDibuat,
    isDispatched,
    isDikirim,
    isDiterima,
    isPaid,
    effectiveRaw,
  ]);

  return (
    <>
      {/* ─── STATUS STEPPER / FLOW ─── */}
      <Panel title="Alur Pembelian" subtitle="Perkembangan tahapan proses barang dari pengajuan hingga diterima dan lunas">
        <View className="flex-row items-center justify-between gap-1 py-1">
          {steps.map((st, idx) => {
            const isLast = idx === steps.length - 1;
            return (
              <React.Fragment key={st.label}>
                <View className="items-center flex-1">
                  <View
                    className={`h-7 w-7 rounded-full items-center justify-center ${
                      isDitolak
                        ? "bg-destructive/15 border border-destructive/40"
                        : st.done
                        ? "bg-emerald-600 border border-emerald-600"
                        : st.current
                        ? "bg-primary border border-primary"
                        : "bg-muted border border-border"
                    }`}
                  >
                    {isDitolak ? (
                      <XCircle size={14} color={colors.danger} />
                    ) : st.done ? (
                      <Check size={14} color="#fff" />
                    ) : (
                      <Text
                        className={`text-[10px] font-bold ${
                          st.current ? "text-white" : "text-muted-foreground"
                        }`}
                      >
                        {idx + 1}
                      </Text>
                    )}
                  </View>
                  <Text
                    className={`text-[11px] mt-1 text-center font-medium ${
                      st.current ? "text-primary font-bold" : st.done ? "text-foreground font-semibold" : "text-muted-foreground"
                    }`}
                    numberOfLines={1}
                  >
                    {st.label}
                  </Text>
                </View>
                {!isLast ? (
                  <View
                    className={`h-[2px] flex-1 -mt-3.5 ${
                      st.done && steps[idx + 1]?.done ? "bg-emerald-600" : "bg-border"
                    }`}
                  />
                ) : null}
              </React.Fragment>
            );
          })}
        </View>
        {(row.dueDate || row.jatuhTempo) && (row.dueDate !== "-" && row.jatuhTempo !== "-") ? (
          <View className="mt-3 pt-2.5 border-t border-border/60 flex-row flex-wrap items-center justify-between gap-2">
            <View className="flex-row items-center gap-1.5">
              <Calendar size={14} color={colors.warning} />
              <Text className="text-xs text-muted-foreground font-medium">Jatuh Tempo Pembayaran:</Text>
              <Text className="text-xs font-bold text-amber-700 dark:text-amber-400">
                {row.jatuhTempo || row.dueDate}
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Clock size={13} color={colors.muted} />
              <Text className="text-[11px] text-muted-foreground">
                Metode: {row.metodePembayaran || "Tempo / Utang"}
              </Text>
            </View>
          </View>
        ) : null}
      </Panel>

      {/* ─── PROMINENT STATUS ALERT BANNER ─── */}
      {isDitolak ? (
        <View className="bg-destructive/15 border border-destructive/40 rounded-xl p-4 flex-row items-center gap-3">
          <XCircle size={22} color={colors.danger} />
          <View className="flex-1">
            <Text className="text-destructive font-bold text-base">Permintaan Barang Ditolak</Text>
            <Text className="text-destructive/90 text-xs mt-0.5">
              Alasan: {row.rejectReason || "Permintaan tidak dapat diproses oleh Gudang/Approver."}
            </Text>
          </View>
        </View>
      ) : isDiterima && isPaid ? (
        <View className="bg-emerald-500/15 border border-emerald-500/40 rounded-xl p-4 flex-row items-center gap-3">
          <CheckCircle2 size={22} color="#10b981" />
          <View className="flex-1">
            <Text className="text-emerald-700 dark:text-emerald-400 font-bold text-base">
              Pengadaan Selesai & Lunas
            </Text>
            <Text className="text-muted-foreground text-xs mt-0.5">
              Seluruh barang telah diterima di gudang/proyek dan pembayaran telah dilunasi sepenuhnya (Lunas).
            </Text>
          </View>
        </View>
      ) : isDiterima && !isPaid ? (
        <View className="bg-amber-500/15 border border-amber-500/40 rounded-xl p-4 flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <View className="flex-row items-center gap-3 flex-1">
            <Clock size={22} color={colors.warning} />
            <View className="flex-1">
              <Text className="text-amber-800 dark:text-amber-400 font-bold text-base">
                Barang Telah Diterima (Belum Lunas)
              </Text>
              <Text className="text-amber-900/90 dark:text-amber-300/80 text-xs mt-0.5">
                Barang fisik telah diterima di gudang (stok tercatat & tercatat Hutang Usaha). Menunggu pelunasan hutang oleh Finance.
              </Text>
              {row.dueDate || row.jatuhTempo ? (
                <View className="mt-1.5 flex-row items-center gap-1.5 bg-amber-500/20 px-2 py-0.5 rounded self-start">
                  <Calendar size={13} color={colors.warning} />
                  <Text className="text-xs font-semibold text-amber-950 dark:text-amber-200">
                    Jatuh Tempo: {row.dueDate || row.jatuhTempo}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          {linkedPo ? (
            <Button
              size="sm"
              variant="outline"
              className="mt-2 sm:mt-0"
              onPress={() => router.push(`/supplier-pos/${linkedPo.id}` as any)}
            >
              <FileText size={14} color={colors.text} />
              <Text className="text-xs">Buka PO {linkedPo.nomor}</Text>
            </Button>
          ) : isFinance ? (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 mt-2 sm:mt-0"
              onPress={() => setPayModalOpen(true)}
              disabled={loading}
            >
              <DollarSign size={14} color="#fff" />
              <Text className="text-xs font-semibold text-white">Unggah Bukti Bayar / Pelunasan</Text>
            </Button>
          ) : null}
        </View>
      ) : isDikirim ? (
        <View className="bg-sky-500/15 border border-sky-500/40 rounded-xl p-4 flex-row items-center justify-between gap-3">
          <View className="flex-1 flex-row items-center gap-3">
            <Truck size={22} color="#0284c7" />
            <View className="flex-1">
              <Text className="text-sky-800 dark:text-sky-300 font-bold text-base">
                {isStockTake
                  ? "Barang Telah Diserahkan & Keluar Gudang"
                  : isRetailDebt
                  ? "Barang Sedang Dikirim dari Toko Ritel (Nota Tempo)"
                  : "Barang Pengadaan Sedang Dikirim ke Gudang"}
              </Text>
              <Text className="text-muted-foreground text-xs mt-0.5">
                {isStockTake
                  ? `Stok telah dipotong dari saldo gudang (Keluar Proyek). Menunggu tim proyek (${row.pemohon || "User"}) mengonfirmasi penerimaan.`
                  : "Barang sedang dikirim. Petugas gudang dapat memverifikasi fisik & SN saat barang tiba."}
              </Text>
            </View>
          </View>
          {isRequesterOrPM || isGudang ? (
            <Button size="sm" onPress={() => setConfirmReceiveOpen(true)} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
              <PackageCheck size={14} color="#fff" />
              <Text className="text-xs font-semibold text-white">Konfirmasi Terima</Text>
            </Button>
          ) : null}
        </View>
      ) : isPoDibuat ? (
        <View className="bg-sky-500/15 border border-sky-500/40 rounded-xl p-4 flex-row items-center justify-between gap-3">
          <View className="flex-1 flex-row items-center gap-3">
            <Truck size={22} color="#0284c7" />
            <View className="flex-1">
              <Text className="text-sky-800 dark:text-sky-300 font-bold text-base">
                PO Supplier Telah Diterbitkan {linkedPo?.nomor ? `(${linkedPo.nomor})` : ""}
              </Text>
              <Text className="text-muted-foreground text-xs mt-0.5">
                PO pembelian ke supplier telah berhasil diterbitkan. Setelah supplier mengirim barang, klik &quot;Tandai Barang Dikirim&quot; agar status terupdate dan draf penerimaan otomatis siap di Gudang.
              </Text>
            </View>
          </View>
          <Button
            size="sm"
            onPress={() => setConfirmSendOpen(true)}
            disabled={loading}
            className="bg-sky-600 hover:bg-sky-700"
          >
            <Truck size={14} color="#fff" />
            <Text className="text-xs font-semibold text-white">Tandai Barang Dikirim</Text>
          </Button>
        </View>
      ) : isDisetujui ? (
        <View className="bg-emerald-500/15 border border-emerald-500/40 rounded-xl p-4 flex-row items-center gap-3">
          <CheckCircle2 size={22} color="#10b981" />
          <View className="flex-1">
            <Text className="text-emerald-700 dark:text-emerald-400 font-bold text-base">Permintaan Telah Disetujui</Text>
            <Text className="text-muted-foreground text-xs mt-0.5">
              {isStockTake
                ? "Permintaan telah disetujui. Petugas gudang dapat segera menyerahkan barang ke tim proyek."
                : isRetailCash
                ? "Permintaan disetujui. Menunggu Finance melakukan pembayaran kas/transfer & mengunggah bukti transfer."
                : isRetailDebt
                ? "Pembelian tempo disetujui. Toko dapat segera mengirimkan barang dengan nota bon tempo."
                : "Permintaan disetujui. Procurement dapat segera menerbitkan PO Supplier resmi."}
            </Text>
          </View>
        </View>
      ) : isCekStok ? (
        <View className="bg-amber-500/15 border border-amber-500/40 rounded-xl p-4 flex-row items-center gap-3">
          <Clock size={22} color={colors.warning} />
          <View className="flex-1">
            <Text className="text-amber-800 dark:text-amber-300 font-bold text-base">Sedang Pengecekan Stok Gudang</Text>
            <Text className="text-muted-foreground text-xs mt-0.5">
              Petugas gudang sedang memeriksa ketersediaan fisik barang dan unit serial number di gudang.
            </Text>
          </View>
        </View>
      ) : null}

      {/* ─── PURCHASE ORDER (PO) SUPPLIER SHORTCUT & DETAIL ─── */}
      {!isStockTake && (
        <Panel
          title="Purchase Order (PO) Supplier"
          subtitle={
            linkedPo
              ? `Terhubung dengan ${linkedPo.nomor}`
              : "Penerbitan PO resmi ke supplier/vendor untuk pengadaan barang ini"
          }
        >
          {linkedPo ? (
            <View className="bg-panel/50 border border-border/80 rounded-xl p-3.5 gap-2.5">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <FileText size={18} color={colors.primary} />
                  <Text className="font-bold text-base text-foreground">
                    {linkedPo.nomor}
                  </Text>
                </View>
                <StatusBadge status={linkedPo.status || "Menunggu persetujuan"} />
              </View>

              <View className="flex-row flex-wrap items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50 gap-2">
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-xs text-muted-foreground">Supplier:</Text>
                  <Text className="text-xs font-semibold text-foreground">
                    {linkedPo.supplier || row.supplier || "-"}
                  </Text>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-xs text-muted-foreground">Total Nilai PO:</Text>
                  <Text className="text-xs font-bold text-primary">
                    Rp {Number(linkedPo.total || row.estimasi || 0).toLocaleString("id-ID")}
                  </Text>
                </View>
              </View>

              <View className="flex-row flex-wrap items-center gap-2 pt-2">
                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary/90"
                  onPress={() => router.push(`/supplier-pos/${linkedPo.id}` as any)}
                >
                  <ExternalLink size={14} color="#fff" />
                  <Text className="text-xs font-semibold text-white">
                    Buka Detail PO Supplier
                  </Text>
                </Button>
                {linkedInvoices.length > 0 ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => router.push(`/invoices` as any)}
                  >
                    <FileText size={14} color={colors.text} />
                    <Text className="text-xs">
                      Invoice Masuk ({linkedInvoices.length}): {linkedInvoices[0]?.nomor}
                    </Text>
                  </Button>
                ) : null}
                {linkedReceivings[0] ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => router.push(`/receiving/${linkedReceivings[0]?.id}` as any)}
                  >
                    <PackageCheck size={14} color={colors.success} />
                    <Text className="text-xs font-semibold text-emerald-600">
                      Penerimaan Gudang: {linkedReceivings[0]?.nomor}
                    </Text>
                  </Button>
                ) : null}
              </View>
            </View>
          ) : (
            <View className="bg-panel/50 border border-dashed border-border/90 rounded-xl p-4 gap-3 items-start sm:flex-row sm:items-center sm:justify-between">
              <View className="flex-1 gap-1">
                <Text className="font-semibold text-foreground text-sm">
                  Belum Ada PO Supplier Terbit
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Buat Purchase Order (PO) resmi ke supplier untuk memesan barang ini. PO akan otomatis terhubung secara permanen dengan permintaan ini.
                </Text>
              </View>
              {!isDitolak ? (
                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary/90"
                  onPress={handleOpenCreatePo}
                  disabled={loading}
                >
                  <Plus size={15} color="#fff" />
                  <Text className="text-xs font-semibold text-white">
                    + Buat PO Supplier
                  </Text>
                </Button>
              ) : null}
            </View>
          )}
        </Panel>
      )}

      {/* ─── SKEMA AKUNTANSI & KETERKAITAN DOKUMEN ─── */}
      <Panel
        title="Skema Akuntansi & Keterkaitan Dokumen"
        subtitle={
          isStockTake
            ? "Alokasi material internal: Persediaan Gudang (1200) → HPP Proyek (5101)"
            : isRetailCash
            ? "Pembelian Ritel Tunai: Kas Keluar langsung diakui saat dibayar"
            : isRetailDebt
            ? "Pembelian Ritel Tempo: Hutang Usaha (210102) saat terima barang, dilunasi saat jatuh tempo"
            : "Pengadaan Supplier: Terhubung ke PO Supplier resmi & Faktur/Invoice Masuk"
        }
      >
        <View className="gap-2.5">
          <View className="bg-panel/50 border-border/70 rounded-xl border p-3 gap-1.5">
            <View className="flex-row justify-between items-center">
              <Text className="text-xs text-muted-foreground">Jenis / Sumber Alur:</Text>
              <Text className="text-xs font-bold text-foreground">
                {isStockTake
                  ? "Ambil Stok Gudang untuk Proyek"
                  : isRetailCash
                  ? "Beli Ritel / Toko (Tunai / Lunas)"
                  : isRetailDebt
                  ? "Beli Ritel / Toko (Utang / Tempo)"
                  : "Pengadaan via PO Supplier Resmi"}
              </Text>
            </View>
            <View className="flex-row justify-between items-center">
              <Text className="text-xs text-muted-foreground">Metode Pembayaran:</Text>
              <Text className="text-xs font-bold text-foreground">
                {isStockTake
                  ? "Non-Tunai (Transfer Material Internal Gudang)"
                  : isRetailCash
                  ? "Kas / Tunai (Dibayar Dimuka)"
                  : isRetailDebt
                  ? "Utang / Tempo (Nota Bon Toko)"
                  : "Tempo / PO & Invoice Masuk"}
              </Text>
            </View>
            <View className="flex-row justify-between items-center">
              <Text className="text-xs text-muted-foreground">Pos DEBIT Akuntansi:</Text>
              <Text className="text-xs font-bold text-primary">
                {isProject
                  ? "[5101] HPP Proyek (Bahan & Material Proyek)"
                  : "[1200] Persediaan Barang Dagang (Aset Lancar)"}
              </Text>
            </View>
            <View className="flex-row justify-between items-center">
              <Text className="text-xs text-muted-foreground">Pos KREDIT Akuntansi:</Text>
              <Text className="text-xs font-bold text-warning">
                {isStockTake
                  ? "[1200] Persediaan Barang Dagang (Stok Gudang Berkurang — Tanpa Kas/Utang)"
                  : isPaid
                  ? `${row.paymentAccountCode || row.fundingSource || "1000.01"} (Pelunasan: Saldo Hutang 210102 Rp 0)`
                  : isRetailCash
                  ? `${row.paymentAccountCode || row.fundingSource || "1000.01"} (Pengeluaran Kas/Bank)`
                  : "[210102] Hutang Usaha (Nota Bon Toko / Supplier)"}
              </Text>
            </View>
            {row.ppnMode && row.ppnMode !== "none" ? (
              <View className="flex-row justify-between items-center">
                <Text className="text-xs text-muted-foreground">Skema Pajak (PPN):</Text>
                <Text className="text-xs font-bold text-primary">
                  {row.ppnMode === "include" ? "PPN Included (Sudah termasuk 11%)" : "PPN (11% Ditambahkan)"}
                </Text>
              </View>
            ) : null}
          </View>

          <View className="flex-row flex-wrap items-center justify-between gap-2 pt-1">
            {linkedPo ? (
              <View className="flex-row flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => router.push(`/supplier-pos/${linkedPo.id}` as any)}
                >
                  <FileText size={14} color={colors.primary} />
                  <Text className="text-xs font-semibold text-primary">
                    Lihat PO: {linkedPo.nomor}
                  </Text>
                </Button>
                {linkedInvoices.length > 0 ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => router.push(`/invoices` as any)}
                  >
                    <FileText size={14} color={colors.text} />
                    <Text className="text-xs">
                      Invoice Masuk ({linkedInvoices.length}): {linkedInvoices[0]?.nomor}
                    </Text>
                  </Button>
                ) : null}
                {linkedReceivings[0] ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => router.push(`/receiving/${linkedReceivings[0]?.id}` as any)}
                  >
                    <PackageCheck size={14} color={colors.success} />
                    <Text className="text-xs font-semibold text-emerald-600">
                      Penerimaan Gudang: {linkedReceivings[0]?.nomor}
                    </Text>
                  </Button>
                ) : null}
              </View>
            ) : isSupplierPo && (isProcurement || isGudang) && !isDitolak ? (
              <Button size="sm" variant="outline" onPress={handleOpenCreatePo} disabled={loading}>
                <Plus size={14} color={colors.primary} />
                <Text className="text-xs font-semibold text-primary">
                  Buat PO Supplier
                </Text>
              </Button>
            ) : null}

            {/* Link Bukti Pembayaran */}
            {row.paymentProofFileId || row.paymentProofFile ? (
              <View className="flex-row items-center gap-1.5 bg-card border-border/70 border rounded-lg px-2.5 py-1">
                <CheckCircle2 size={13} color={colors.success} />
                <Text className="text-xs font-semibold text-foreground">
                  Bukti Bayar Terlampir
                </Text>
              </View>
            ) : null}

            {/* Link Bukti Surat Jalan DO */}
            {row.doFileId ? (
              <View className="flex-row items-center gap-1.5 bg-card border-border/70 border rounded-lg px-2.5 py-1">
                <FileText size={13} color={colors.primary} />
                <Text className="text-xs font-semibold text-foreground">
                  Surat Jalan DO Terlampir
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Panel>

      {/* ─── RINCIAN BARANG & KETERSEDIAAN STOK GUDANG ─── */}
      <Panel
        title={`Rincian Barang (${items.length || 1} Item)`}
        subtitle="Mendukung barang dari Master Barang maupun barang Non-Master (Beli Ritel)"
      >
        {stockSummary.length === 0 ? (
          <View className="py-2">
            <Text className="text-sm font-semibold">{row.item || row.tujuan || "Barang Operasional"}</Text>
            <Text className="text-xs text-muted-foreground mt-1">
              Estimasi Biaya: Rp{Number(row.estimasi || 0).toLocaleString("id-ID")}
            </Text>
          </View>
        ) : (
          <View className="gap-2.5">
            {stockSummary.map((item, idx) => {
              const productName = item.product?.name || item.customName || `Barang #${idx + 1}`;
              const sku = item.product?.sku ? `SKU: ${item.product.sku} · ` : item.isCustom ? "Non-Master (Ritel) · " : "";
              const unit = item.product?.unit || item.customUnit ? ` ${item.product?.unit || item.customUnit}` : "";
              const unitCost = Number(item.unitCost || 0);
              let parsedSerials: string[] = [];
              if (item.serials) {
                try {
                  const arr = JSON.parse(item.serials);
                  if (Array.isArray(arr)) parsedSerials = arr.map(String);
                } catch {
                  parsedSerials = String(item.serials)
                    .split(",")
                    .map((s: string) => s.trim())
                    .filter(Boolean);
                }
              }
              return (
                <View
                  key={item.id ?? idx}
                  className="border-border/60 flex-row items-center justify-between border-b py-2.5 last:border-b-0"
                >
                  <View className="flex-1 min-w-0 pr-3">
                    <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                      {productName}
                    </Text>
                    <Text className="text-muted-foreground text-xs mt-0.5">
                      {sku}Diminta: <Text className="font-semibold text-foreground">{item.ordered}{unit}</Text>
                      {unitCost > 0 ? ` · @ ${rupiah(unitCost)}` : ""}
                    </Text>
                    {parsedSerials.length > 0 ? (
                      <Text className="text-[11px] font-mono font-semibold text-primary mt-0.5">
                        SN: {parsedSerials.join(", ")}
                      </Text>
                    ) : null}
                  </View>
                  <View className="items-end shrink-0">
                    {item.isCustom ? (
                      <View className="bg-info/15 border border-info/30 rounded-md px-2.5 py-1">
                        <Text className="text-info text-xs font-semibold">
                          Beli Ritel / Non-Master
                        </Text>
                      </View>
                    ) : item.isEnough ? (
                      <View className="bg-emerald-500/15 border border-emerald-500/30 rounded-md px-2.5 py-1">
                        <Text className="text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                          Stok Cukup (Tersedia {item.available}{unit})
                        </Text>
                      </View>
                    ) : (
                      <View className="bg-amber-500/15 border border-amber-500/30 rounded-md px-2.5 py-1">
                        <Text className="text-amber-700 dark:text-amber-400 text-xs font-semibold">
                          Kurang (Tersedia {item.available}{unit})
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Panel>

      {/* ─── TINDAKAN GUDANG, PENGADAAN & FINANCE ─── */}
      {isGudang || isProcurement || isFinance ? (
        <Panel
          title="Tindakan Gudang, Pengadaan & Finance"
          subtitle="Tahapan aksi operasional sesuai alur dan status dokumen"
        >
          <View className="flex-row flex-wrap items-center gap-2.5 pt-1">
            {/* 1. Persetujuan Request */}
            {isApproved || isPoDibuat || isDispatched || isDiterima || isPaid ? (
              <View className="bg-emerald-500/15 border border-emerald-500/30 rounded-md px-3 py-1.5 flex-row items-center gap-1.5">
                <CheckCircle2 size={15} color="#10b981" />
                <Text className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  ✓ Sudah Disetujui
                </Text>
              </View>
            ) : !isDitolak ? (
              (isStockTake && (isGudang || isRequesterOrPM || isFinance)) ||
              (isRetailCash && isFinance) ||
              (isRetailDebt && (isFinance || isProcurement)) ||
              (isSupplierPo && (isProcurement || isFinance)) ? (
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onPress={handleApprove}
                  disabled={loading}
                >
                  <CheckCircle2 size={14} color="#fff" />
                  <Text className="text-xs font-semibold text-white">Setujui Permintaan</Text>
                </Button>
              ) : null
            ) : null}

            {/* 2. Cek Stok Gudang */}
            {isStockTake &&
              (isStockChecked ? (
                <View className="bg-sky-500/15 border border-sky-500/30 rounded-md px-3 py-1.5 flex-row items-center gap-1.5">
                  <CheckCircle2 size={15} color="#0284c7" />
                  <Text className="text-xs font-semibold text-sky-700 dark:text-sky-400">
                    ✓ Stok Telah Dicek
                  </Text>
                </View>
              ) : isGudang && !isDitolak ? (
                <Button variant="outline" size="sm" onPress={handleMarkCheckStock} disabled={loading}>
                  <Clock size={14} color={colors.text} />
                  <Text className="text-xs">Tandai Cek Stok Fisik</Text>
                </Button>
              ) : null)}

            {/* 3. Pembayaran Tunai / Kas (Bayar di Muka sebelum Kirim) */}
            {!isStockTake && !isDebt && (
              isPaid ? (
                <View className="bg-emerald-500/15 border border-emerald-500/30 rounded-md px-3 py-1.5 flex-row items-center gap-1.5">
                  <CheckCircle2 size={15} color="#10b981" />
                  <Text className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    ✓ Sudah Dibayar Kas
                  </Text>
                </View>
              ) : isApproved && isFinance && !isDitolak ? (
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onPress={() => setPayModalOpen(true)}
                  disabled={loading}
                >
                  <DollarSign size={14} color="#fff" />
                  <Text className="text-xs font-semibold text-white">Bayar Kas & Unggah Bukti</Text>
                </Button>
              ) : null
            )}

            {/* 4. Pembayaran Tempo / Pelunasan Hutang (Bayar setelah Barang Sampai) */}
            {isDebt && (
              isPaid ? (
                <View className="bg-emerald-500/15 border border-emerald-500/30 rounded-md px-3 py-1.5 flex-row items-center gap-1.5">
                  <CheckCircle2 size={15} color="#10b981" />
                  <Text className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    ✓ Tagihan Telah Dilunasi (Lunas)
                  </Text>
                </View>
              ) : isDiterima && isFinance && !isDitolak ? (
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onPress={() => setPayModalOpen(true)}
                  disabled={loading}
                >
                  <DollarSign size={14} color="#fff" />
                  <Text className="text-xs font-semibold text-white">Unggah Bukti Bayar & Pelunasan</Text>
                </Button>
              ) : null
            )}

            {/* 5. Serahkan / Kirim Barang */}
            {isDispatched ? (
              <View className="bg-indigo-500/15 border border-indigo-500/30 rounded-md px-3 py-1.5 flex-row items-center gap-1.5">
                <Truck size={15} color="#6366f1" />
                <Text className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                  {isStockTake ? "✓ Barang Telah Diserahkan" : "✓ Pengadaan Sedang / Sudah Dikirim"}
                </Text>
              </View>
            ) : !isDitolak ? (
              isStockTake && isApproved && isGudang ? (
                <Button size="sm" onPress={() => setConfirmSendOpen(true)} disabled={loading}>
                  <Truck size={14} color="#fff" />
                  <Text className="text-xs font-semibold">Serahkan Barang ke Proyek</Text>
                </Button>
              ) : isRetailCash && isPaid && (isProcurement || isGudang) ? (
                <Button
                  size="sm"
                  onPress={() => setConfirmSendOpen(true)}
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <Truck size={14} color="#fff" />
                  <Text className="text-xs font-semibold text-white">Tandai Barang Dikirim</Text>
                </Button>
              ) : isRetailDebt && isApproved && (isProcurement || isGudang) ? (
                <Button
                  size="sm"
                  onPress={() => setConfirmSendOpen(true)}
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <Truck size={14} color="#fff" />
                  <Text className="text-xs font-semibold text-white">Tandai Barang Dikirim</Text>
                </Button>
              ) : isSupplierPo && (isDebt ? isPoDibuat || isApproved : isPaid) && (isProcurement || isGudang) ? (
                <Button
                  size="sm"
                  className="bg-sky-600 hover:bg-sky-700"
                  onPress={() => setConfirmSendOpen(true)}
                  disabled={loading}
                >
                  <Truck size={14} color="#fff" />
                  <Text className="text-xs font-semibold text-white">Tandai Barang Dikirim</Text>
                </Button>
              ) : null
            ) : null}

            {/* Konfirmasi Penerimaan Barang di Gudang */}
            {isDispatched && !isDiterima && !isDitolak ? (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                onPress={() => setConfirmReceiveOpen(true)}
                disabled={loading}
              >
                <PackageCheck size={14} color="#fff" />
                <Text className="text-xs font-semibold text-white">Konfirmasi Terima Barang</Text>
              </Button>
            ) : null}

            {/* 6. Terbitkan PO Supplier Formal */}
            {isSupplierPo && !linkedPo && !isPoDibuat && !isDitolak && isApproved && (
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90"
                onPress={handleOpenCreatePo}
                disabled={loading}
              >
                <Plus size={14} color="#fff" />
                <Text className="text-xs font-semibold text-white">Buat PO Supplier</Text>
              </Button>
            )}

            {/* 7. Tolak Permintaan */}
            {isDitolak ? (
              <View className="bg-destructive/15 border border-destructive/30 rounded-md px-3 py-1.5 flex-row items-center gap-1.5">
                <XCircle size={15} color={colors.danger} />
                <Text className="text-xs font-semibold text-destructive">
                  ✗ Permintaan Telah Ditolak
                </Text>
              </View>
            ) : !isDiterima && !isDispatched && !isPoDibuat && !isPaid ? (
              <Button variant="destructive" size="sm" onPress={() => setRejectOpen(true)} disabled={loading}>
                <XCircle size={14} color="#fff" />
                <Text className="text-xs font-semibold">Tolak Permintaan</Text>
              </Button>
            ) : null}
          </View>
        </Panel>
      ) : null}

      {/* Dialog Konfirmasi Serahkan / Kirim Barang */}
      <Dialog open={confirmSendOpen} onOpenChange={setConfirmSendOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isStockTake ? "Serahkan Barang ke Tim Proyek?" : "Tandai Barang Sedang Dikirim ke Gudang?"}
            </DialogTitle>
            <DialogDescription>
              {isStockTake
                ? `Stok barang di gudang akan otomatis dipotong dan dialokasikan ke proyek ${row.project || ""}. Notifikasi akan dikirim ke pemohon (${row.pemohon || "User"}) untuk konfirmasi penerimaan di lokasi.`
                : isSupplierPo
                ? "Status PO Supplier dan Permintaan Barang akan berubah menjadi 'Dikirim'. Tim Gudang dapat bersiap mengecek fisik saat barang tiba."
                : "Status akan berubah menjadi 'Dikirim' dan data Penerimaan di Gudang akan otomatis dibuat. Petugas Gudang dapat mengecek fisik barang dan mencatat SN saat barang tiba."}
            </DialogDescription>
          </DialogHeader>
          {isStockTake && !allStockAvailable && stockSummary.length > 0 ? (
            <View className="bg-amber-500/15 border border-amber-500/30 rounded-xl p-3 flex-row items-center gap-2">
              <AlertTriangle size={16} color={colors.warning} />
              <Text className="text-xs text-amber-700 dark:text-amber-400 flex-1">
                Perhatian: Sebagian stok tercatat kurang di sistem. Anda tetap dapat menyerahkan bila ada stok fisik riil di gudang.
              </Text>
            </View>
          ) : null}
          <DialogFooter className="gap-2">
            <Button variant="outline" onPress={() => setConfirmSendOpen(false)} disabled={loading}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSendGoods} disabled={loading}>
              <Truck size={14} color="#fff" />
              <Text className="text-white font-semibold">
                {loading ? "Memproses..." : isStockTake ? "Ya, Serahkan Barang" : "Ya, Tandai Dikirim"}
              </Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Konfirmasi Terima Barang */}
      <Dialog open={confirmReceiveOpen} onOpenChange={setConfirmReceiveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isStockTake ? "Konfirmasi Terima Barang di Proyek" : "Konfirmasi Terima Barang di Gudang"}
            </DialogTitle>
            <DialogDescription>
              {isStockTake
                ? "Apakah seluruh barang yang diminta sudah Anda terima dalam kondisi baik di lokasi proyek?"
                : "Apakah barang fisik dari toko/supplier sudah diterima di gudang dalam kondisi baik?"}
            </DialogDescription>
          </DialogHeader>
          <View className="py-2 gap-3">
            <FormField
              label="Dokumen Surat Jalan / Delivery Order (DO) / Foto Nota"
              hint="Lampirkan foto surat jalan DO, dokumen PDF, atau bukti serah terima (opsional)"
            >
              <FileUploader
                label="Unggah Dokumen DO / Nota (Foto atau PDF)"
                kind="semua"
                accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp"
                allowedExtensions={["jpg", "jpeg", "png", "webp", "pdf"]}
                category="purchase-request-do"
                hint="Mendukung foto/gambar (JPG, PNG) atau dokumen (PDF)"
                handleRef={(h) => { doFileHandle.current = h; }}
              />
            </FormField>
          </View>
          <DialogFooter className="gap-2">
            <Button variant="outline" onPress={() => setConfirmReceiveOpen(false)} disabled={loading}>
              <Text>Batal</Text>
            </Button>
            <Button
              onPress={handleConfirmReceive}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <PackageCheck size={14} color="#fff" />
              <Text className="text-white font-semibold">
                {loading ? "Memproses..." : "Ya, Barang Sudah Diterima"}
              </Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Unggah Bukti Bayar & Tandai Dibayar oleh Finance */}
      <Dialog open={payModalOpen} onOpenChange={setPayModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isDebt ? "Pelunasan Tagihan Pembelian (Tempo)" : "Pembayaran Kas / Tunai Pembelian"}
            </DialogTitle>
            <DialogDescription>
              {isDebt
                ? "Silakan unggah bukti transfer/pelunasan. Pelunasan tagihan ini akan dicatat di jurnal akuntansi kas keluar."
                : `Silakan unggah bukti transfer/struk pembayaran kas untuk menandai bahwa pembelian ini telah dibayar.`}
            </DialogDescription>
          </DialogHeader>
          <View className="py-2 gap-3">
            <FormField
              label="Pilih Sumber Dana (Akun Kas / Bank)"
              required
              hint="Akun kas/bank yang akan dikreditkan pada jurnal pengeluaran"
            >
              <SearchableSelect
                value={
                  selectedFundingSource === "1000.02"
                    ? "Bank Mandiri PT GMP [1000.02]"
                    : "Kas Kecil / Tunai [1000.01]"
                }
                options={[
                  "Kas Kecil / Tunai [1000.01]",
                  "Bank Mandiri PT GMP [1000.02]",
                ]}
                onChange={(val) => {
                  if (val.includes("1000.02") || val.includes("Mandiri")) {
                    setSelectedFundingSource("1000.02");
                  } else {
                    setSelectedFundingSource("1000.01");
                  }
                }}
                placeholder="Pilih rekening kas / bank..."
              />
            </FormField>

            <FormField
              label="Bukti Pembayaran / Struk Kas / Transfer"
              hint="Wajib dilampirkan sebagai bukti sah pencatatan kas keluar"
            >
              <FileUploader
                label="Unggah Bukti Bayar (Foto atau PDF)"
                kind="semua"
                accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp"
                allowedExtensions={["jpg", "jpeg", "png", "webp", "pdf"]}
                category="bukti-bayar"
                hint="Mendukung foto/screenshot bukti transfer (JPG, PNG) atau dokumen (PDF)"
                handleRef={(h) => { payProofHandle.current = h; }}
                onChange={(c) => setPayProofHasFile(c > 0)}
              />
            </FormField>
          </View>
          <DialogFooter className="gap-2">
            <Button variant="outline" onPress={() => setPayModalOpen(false)} disabled={loading}>
              <Text>Batal</Text>
            </Button>
            <Button
              onPress={handleMarkPaid}
              disabled={loading || (!payProofHasFile && !paymentProofFileId)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <CheckCircle2 size={14} color="#fff" />
              <Text className="text-white font-semibold">
                {loading ? "Memproses..." : "Konfirmasi Pembayaran"}
              </Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Tolak Permintaan */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tolak Permintaan Barang</DialogTitle>
            <DialogDescription>
              Masukkan alasan penolakan agar pemohon dapat mengetahui kendala (misal: stok kosong, anggaran tidak disetujui, dll).
            </DialogDescription>
          </DialogHeader>
          <View className="py-2">
            <Textarea
              placeholder="Contoh: Stok barang kosong di seluruh gudang / perlu penyesuaian anggaran..."
              value={rejectReason}
              onChangeText={setRejectReason}
              numberOfLines={3}
            />
          </View>
          <DialogFooter className="gap-2">
            <Button variant="outline" onPress={() => setRejectOpen(false)} disabled={loading}>
              <Text>Batal</Text>
            </Button>
            <Button variant="destructive" onPress={handleReject} disabled={loading}>
              <Text className="text-white font-semibold">
                {loading ? "Memproses..." : "Tolak Permintaan"}
              </Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Buat PO Supplier dari Permintaan Barang */}
      <Dialog open={createPoOpen} onOpenChange={setCreatePoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Buat Purchase Order (PO) Supplier</DialogTitle>
            <DialogDescription>
              Relasi PO ke permintaan {row.nomor} dan proyek akan otomatis terhubung secara permanen.
            </DialogDescription>
          </DialogHeader>

          <View className="py-2 gap-3">
            {/* Info Relasi Otomatis */}
            <View className="bg-panel/60 border border-border/80 rounded-xl p-3 gap-1">
              <View className="flex-row justify-between items-center">
                <Text className="text-xs text-muted-foreground">Permintaan Asal:</Text>
                <Text className="text-xs font-semibold text-primary">{row.nomor}</Text>
              </View>
              <View className="flex-row justify-between items-center">
                <Text className="text-xs text-muted-foreground">Proyek / Alokasi:</Text>
                <Text className="text-xs font-semibold text-foreground">{row.project || "Stok Gudang"}</Text>
              </View>
              <View className="flex-row justify-between items-center">
                <Text className="text-xs text-muted-foreground">Barang Diminta:</Text>
                <Text
                  className="text-xs font-semibold text-foreground flex-1 text-right ml-2"
                  numberOfLines={1}
                >
                  {row.item || row.tujuan || "-"}
                </Text>
              </View>
            </View>

            <FormField label="Pilih Supplier" required hint="Pemasok / vendor tujuan pemesanan">
              <SupplierSelect
                supplierId={poSupplierId}
                value={
                  (data.suppliers ?? []).find((s: Row) => String(s.id) === String(poSupplierId))?.nama ??
                  (data.suppliers ?? []).find((s: Row) => String(s.id) === String(poSupplierId))?.name ??
                  row.supplier ??
                  ""
                }
                onChange={(val, match) => {
                  if (match) {
                    setPoSupplierId(String(match.id));
                    if (match.payment || match.paymentTerms) {
                      setPoPaymentTerms(match.payment || match.paymentTerms);
                    }
                  } else {
                    setPoSupplierId("");
                  }
                }}
                onAddNew={() => setQuickSupplierOpen(true)}
                addNewLabel="+ Tambah Supplier Baru"
                placeholder="Pilih supplier..."
              />
            </FormField>

            <FormField label="Syarat Pembayaran" required hint="Termin pembayaran ke supplier">
              <SearchableSelect
                value={poPaymentTerms}
                options={[
                  "Utang / Tempo (Net 30)",
                  "Utang / Tempo (Net 14)",
                  "Tunai / Kas",
                  "Termin DP & Pelunasan",
                ]}
                onChange={setPoPaymentTerms}
                placeholder="Pilih syarat pembayaran..."
              />
            </FormField>

            <FormField label="Perkiraan Tiba (ETA)" hint="Tanggal perkiraan pengiriman barang sampai di gudang/lokasi">
              <DatePicker
                value={poEta}
                onChange={setPoEta}
                placeholder="Pilih tanggal tiba..."
              />
            </FormField>

            <FormField label="Total Nilai PO (Rp)" required hint="Nominal tagihan estimasi PO">
              <Input
                value={poTotal}
                onChangeText={(v) => setPoTotal(formatThousands(v))}
                keyboardType="numeric"
                placeholder="Contoh: 10.000.000"
              />
            </FormField>
          </View>

          <DialogFooter className="gap-2">
            <Button variant="outline" onPress={() => setCreatePoOpen(false)} disabled={loading}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSubmitCreatePo} disabled={loading} className="bg-primary">
              <Check size={14} color="#fff" />
              <Text className="text-white font-semibold">
                {loading ? "Menyimpan..." : "Simpan & Buat PO"}
              </Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickAddSupplierDialog
        open={quickSupplierOpen}
        onOpenChange={setQuickSupplierOpen}
        onSuccess={(newSupp) => {
          setPoSupplierId(String(newSupp.id));
        }}
      />
    </>
  );
}
