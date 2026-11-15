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
  ChevronDown,
  ChevronRight,
  ChevronUp,
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
import { useKasBankAccounts } from "@/lib/use-kas-bank";

export function PurchaseRequestExtras({
  row,
  onRefresh,
}: {
  row: Row;
  onRefresh?: () => Promise<void> | void;
}) {
  const router = useRouter();
  const { user, can, data, addRow, setStatus, decide, toast, reload, approvals } = useApp();
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");
  const [confirmSendOpen, setConfirmSendOpen] = React.useState(false);
  const [confirmReceiveOpen, setConfirmReceiveOpen] = React.useState(false);
  const [payModalOpen, setPayModalOpen] = React.useState(false);
  const [createPoOpen, setCreatePoOpen] = React.useState(false);
  const [quickSupplierOpen, setQuickSupplierOpen] = React.useState(false);
  const [poSupplierId, setPoSupplierId] = React.useState<string>("");
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

  // Hak akses: mengikuti Pengaturan Peran (RBAC) & aturan server (purchase-flow.ts), bukan nama peran.
  // Tombol yang tidak boleh dipakai disembunyikan, supaya tidak ada klik yang berujung pesan "ditolak".
  const role = user?.role ?? "";
  const isAdmin = role === "super_admin" || role === "admin";
  const isRequester = String(row.pemohonId) === String(user?.id);
  const isGudang = role === "gudang" || isAdmin; // serah barang stok gudang (server: peran Gudang)
  const canCheckStock = isGudang || role === "procurement";
  const canPay = can("purchase-requests", "V"); // bayar request = hak "Setujui" Request Barang
  const canApprove = can("purchase-requests", "V");
  const canCreatePo = can("supplier-pos", "C");
  const canShip = can("supplier-pos", "U") || can("shipments", "U");
  const canReceive = can("receiving", "C") || can("receiving", "U");
  const canConfirmHandover = isRequester || isGudang;
  const showAccounting = can("accounting", "L") || can("supplier-pos", "P");
  const kasBankOptions = useKasBankAccounts();

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
  /** Pembelian lewat PO supplier (ritel & ambil stok tidak memakai PO — server menolak). */
  const isSupplierFlow = !isStockTake && procSource !== "RETAIL";

  // Raw status enum
  const effectiveRaw = (
    localStatus ||
    row.rawStatus ||
    (row.status ? toEnum("purchase-requests", row.status) : "DIAJUKAN") ||
    "DIAJUKAN"
  ).toUpperCase();

  const linkedPo = React.useMemo(() => {
    // Relasi lewat ID (requestId), bukan mencocokkan potongan nomor dokumen.
    const fromList = (data["supplier-pos"] ?? []).find(
      (sp: Row) => sp.requestId != null && String(sp.requestId) === String(row.id),
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
  }, [data, row.id, row.supplierPOs, row.supplierPo, row.supplier]);

  const linkedPos = React.useMemo(() => {
    const list = data["supplier-pos"] ?? [];
    const matched = list.filter((sp: Row) => sp.requestId != null && String(sp.requestId) === String(row.id));
    if (matched.length > 0) return matched;
    if (linkedPo) return [linkedPo];
    return [];
  }, [data, row.id, linkedPo]);

  const linkedReceivings = React.useMemo(() => {
    return (data.receiving ?? []).filter((rc: Row) => {
      if (rc.requestId && String(rc.requestId) === String(row.id)) return true;
      return linkedPos.some((p: Row) => rc.supplierPoId != null && String(rc.supplierPoId) === String(p.id));
    });
  }, [data.receiving, row.id, linkedPos]);

  /**
   * Tagihan supplier aktif untuk PO request ini. Bila ada, pembayaran HANYA lewat tagihan itu di halaman PO
   * (server juga menolak bayar di sini) — satu pembelian, satu tempat bayar, tidak ada kas keluar dobel.
   */
  const linkedBills = React.useMemo(() => {
    const poIds = new Set(linkedPos.map((p: Row) => String(p.id)));
    if (!poIds.size) return [] as Row[];
    return (data.invoiceIn ?? []).filter(
      (inv: Row) => inv.supplierPoId != null && poIds.has(String(inv.supplierPoId)) && inv.status !== "Batal",
    );
  }, [linkedPos, data.invoiceIn]);
  const billPo = linkedBills.length
    ? linkedPos.find((p: Row) => String(p.id) === String(linkedBills[0]!.supplierPoId)) ?? linkedPo
    : null;

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
      const invs = (data.invoiceIn ?? []).filter((inv: Row) => String(inv.supplierPoId) === String(p.id));
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

  const isProjectConsumableRequest =
    isProject &&
    (Boolean(row.isProjectConsumable) || (items.length > 0 && items.every((it: any) => Boolean(it.isConsumable))));

  function handleOpenCreatePo() {
    const suppliersList = data.suppliers ?? [];
    // Supplier diambil dari Request Barang bila sudah dipilih di sana; tidak menebak supplier pertama.
    const matchedSupplier = suppliersList.find(
      (s: Row) =>
        (row.supplierId && String(s.id) === String(row.supplierId)) ||
        (row.supplier && String(s.nama || s.name).toLowerCase() === String(row.supplier).toLowerCase()),
    );

    setPoSupplierId(matchedSupplier?.id ? String(matchedSupplier.id) : "");
    const defaultEta = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0] || "";
    setPoEta(defaultEta);
    setPoTotal(row.estimasi ? formatThousands(row.estimasi) : "");
    setCreatePoOpen(true);
  }

  async function handleSubmitCreatePo() {
    const suppliersList = data.suppliers ?? [];
    const targetSupplier =
      suppliersList.find((s: Row) => String(s.id) === String(poSupplierId)) ??
      suppliersList.find((s: Row) => (s.nama || s.name) === poSupplierId);
    const supplierName = targetSupplier?.nama ?? targetSupplier?.name ?? row.supplier ?? undefined;
    const supplierId = targetSupplier?.id ? Number(targetSupplier.id) : row.supplierId ? Number(row.supplierId) : undefined;
    if (!supplierId) {
      toast("Pilih supplier tujuan PO terlebih dahulu", "danger");
      return;
    }

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
          : "none";
      const poDppVal = prPpnMode === "none" ? targetTotal : Math.round(targetTotal / 1.11);
      const poPpnVal = prPpnMode === "none" ? 0 : Math.max(0, targetTotal - poDppVal);

      const created = await addRow("supplier-pos", {
        supplier: supplierName,
        supplierId: supplierId,
        request: row.nomor,
        requestId: row.id != null ? Number(row.id) : undefined,
        projectId: row.projectId != null ? Number(row.projectId) : undefined,
        project: row.project,
        // Syarat bayar tidak dikirim: server mengambilnya dari Request (cara bayar + jatuh tempo).
        item: row.item || row.tujuan || "Barang Permintaan",
        items: reqItems,
        total: targetTotal,
        dpp: poDppVal,
        ppn: poPpnVal,
        ppnMode: prPpnMode,
        eta: poEta || undefined,
      });
      if (created) {
        // Status request otomatis jadi "PO dibuat" di server; PO dari request langsung berstatus disetujui.
        setCreatePoOpen(false);
        setLocalStatus("PO_DIBUAT");
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
    // Persetujuan selalu lewat data Persetujuan (server menolak ubah status "Disetujui" secara langsung).
    if (!approval?.id) {
      toast("Data persetujuan request ini belum ada. Buka menu Persetujuan.", "danger");
      return;
    }
    setLoading(true);
    try {
      await decide(approval.id, "Disetujui");
      setLocalStatus("DISETUJUI");
      toast("Permintaan barang disetujui");
      if (onRefresh) await onRefresh();
      await reload();
    } catch (e: any) {
      setLocalStatus(null);
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
    if (!approval?.id) {
      toast("Data persetujuan request ini belum ada. Buka menu Persetujuan.", "danger");
      return;
    }
    setLoading(true);
    try {
      await decide(approval.id, "Ditolak", rejectReason);
      setLocalStatus("DITOLAK");
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
      const isProjectConsumableRequest =
        isProject &&
        (Boolean(row.isProjectConsumable) || (items.length > 0 && items.every((it: any) => Boolean(it.isConsumable))));
      const nextStatus = isProjectConsumableRequest ? "Diterima" : (isDebt ? "Lunas" : "Dibayar");
      setLocalStatus(isProjectConsumableRequest ? "DITERIMA" : (isDebt ? "LUNAS" : "DIBAYAR"));
      const ok = await setStatus("purchase-requests", row.id, nextStatus, undefined, {
        paymentProofFileId: finalProofId,
        fundingSource: selectedFundingSource,
        paymentAccountCode: selectedFundingSource,
        paymentStatus: "DIBAYAR",
      });
      // Pesan penolakan (mis. sudah ada tagihan supplier / sudah dibayar) sudah ditampilkan oleh setStatus.
      if (!ok) {
        setLocalStatus(null);
        return;
      }
      // Catatan: PO tidak lagi ditandai "Lunas" terpisah dari sini. Server sudah mencatat satu jurnal kas
      // untuk pembelian ini; tagihan supplier yang datang belakangan otomatis dikompensasi (tanpa kas keluar lagi).
      setPayModalOpen(false);
      setPaymentProofFileId(null);
      setPayProofHasFile(false);
      payProofHandle.current = null;
      toast(
        isProjectConsumableRequest
          ? "Pembayaran dikonfirmasi! Material khusus project otomatis ditambahkan ke Barang Tambahan Project dan pengadaan selesai."
          : isDebt
          ? "Pelunasan pembelian dicatat. Tagihan supplier yang masuk nanti untuk PO ini otomatis dikompensasi, tidak perlu dibayar lagi."
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
      // Server ikut menandai PO terkait "Dikirim" & menyiapkan draf Penerimaan Gudang — cukup satu panggilan.
      const ok = await setStatus("purchase-requests", row.id, "Dikirim");
      if (!ok) return;
      setLocalStatus("DIKIRIM");
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
      // Hanya untuk serah-terima stok gudang ke proyek. Barang pembelian diterima lewat menu Penerimaan Barang.
      const ok = await setStatus("purchase-requests", row.id, "Diterima", undefined, finalDoId ? { doFileId: finalDoId } : undefined);
      if (!ok) return;
      setLocalStatus("DITERIMA");
      setConfirmReceiveOpen(false);
      toast("Penerimaan barang di proyek telah dikonfirmasi");
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
    if (isProjectConsumableRequest) {
      return [
        { label: "Diajukan", done: true, current: isDiajukan },
        { label: "Disetujui", done: isApproved, current: isDisetujui && !isDiterima },
        { label: "Dibayar Kas", done: isDiterima || isPaid, current: isApproved && !isDiterima },
        { label: "Masuk Proyek (Diterima)", done: isDiterima, current: isDiterima },
      ];
    }
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

  // ── Ringkasan status: satu kalimat yang mudah dipahami ──
  const statusInfo: { tone: "danger" | "success" | "warning" | "info" | "neutral"; title: string; desc: string } = isDitolak
    ? { tone: "danger", title: "Permintaan ditolak", desc: `Alasan: ${row.rejectReason || "-"}` }
    : isDiterima && (isPaid || isProjectConsumableRequest || isStockTake)
    ? {
        tone: "success",
        title: "Selesai",
        desc: isStockTake
          ? "Barang dari gudang sudah diterima tim proyek."
          : isProjectConsumableRequest
          ? "Material sudah dibayar dan masuk ke kebutuhan proyek."
          : "Barang sudah diterima dan pembayaran lunas.",
      }
    : isDiterima
    ? {
        tone: "warning",
        title: "Barang diterima, belum lunas",
        desc: `Menunggu pelunasan oleh Finance${row.jatuhTempo && row.jatuhTempo !== "-" ? ` (jatuh tempo ${row.jatuhTempo})` : ""}.`,
      }
    : isDikirim
    ? {
        tone: "info",
        title: isStockTake ? "Barang sudah diserahkan" : "Barang sedang dikirim",
        desc: isStockTake
          ? `Menunggu ${row.pemohon || "pemohon"} mengonfirmasi barang diterima.`
          : "Gudang akan mengecek barang lalu mencatat penerimaan.",
      }
    : isPoDibuat
    ? {
        tone: "info",
        title: `PO ${linkedPo?.nomor ?? ""} sudah dibuat`.replace("  ", " "),
        desc: isDebt || isPaid ? "Menunggu supplier mengirim barang." : "Menunggu Finance membayar sebelum barang dikirim.",
      }
    : isDisetujui
    ? {
        tone: "success",
        title: "Disetujui",
        desc: isStockTake
          ? "Gudang bisa menyerahkan barang ke proyek."
          : isCash
          ? "Menunggu Finance membayar."
          : isSupplierFlow
          ? "Procurement bisa membuat PO ke supplier."
          : "Toko bisa mengirim barang dengan nota tempo.",
      }
    : isCekStok
    ? { tone: "warning", title: "Gudang sedang cek stok", desc: "Ketersediaan barang di gudang sedang diperiksa." }
    : { tone: "neutral", title: "Menunggu persetujuan", desc: "Permintaan sedang menunggu persetujuan Finance." };

  const toneBox: Record<typeof statusInfo.tone, string> = {
    danger: "bg-destructive/10 border-destructive/30",
    success: "bg-emerald-500/10 border-emerald-500/30",
    warning: "bg-amber-500/10 border-amber-500/30",
    info: "bg-sky-500/10 border-sky-500/30",
    neutral: "bg-muted/60 border-border",
  };
  const toneText: Record<typeof statusInfo.tone, string> = {
    danger: "text-destructive",
    success: "text-emerald-700 dark:text-emerald-400",
    warning: "text-amber-700 dark:text-amber-400",
    info: "text-sky-700 dark:text-sky-300",
    neutral: "text-foreground",
  };
  const ToneIcon =
    statusInfo.tone === "danger"
      ? XCircle
      : statusInfo.tone === "success"
      ? CheckCircle2
      : statusInfo.tone === "info"
      ? Truck
      : Clock;
  const toneColor =
    statusInfo.tone === "danger"
      ? colors.danger
      : statusInfo.tone === "success"
      ? "#10b981"
      : statusInfo.tone === "info"
      ? "#0284c7"
      : statusInfo.tone === "warning"
      ? colors.warning
      : colors.muted;

  // ── Total barang ──
  const itemsSubtotal = stockSummary.reduce((s, it) => s + Number(it.ordered || 0) * Number(it.unitCost || 0), 0);
  const ppnModeRow = row.ppnMode === "include" || row.ppnMode === "exclude" ? row.ppnMode : "none";
  const totalDpp = ppnModeRow === "include" ? Math.round(itemsSubtotal / 1.11) : itemsSubtotal;
  const totalPpn = ppnModeRow === "none" ? 0 : ppnModeRow === "include" ? itemsSubtotal - totalDpp : Math.round(itemsSubtotal * 0.11);
  const grandTotal = ppnModeRow === "exclude" ? itemsSubtotal + totalPpn : itemsSubtotal;

  const sourceLabel = isStockTake
    ? "Ambil dari stok gudang"
    : procSource === "RETAIL"
    ? `Beli di toko · ${isCash ? "tunai" : "tempo"}`
    : `Lewat PO supplier · ${isCash ? "tunai" : "tempo"}`;

  const [showAccountingDetail, setShowAccountingDetail] = React.useState(false);
  const hasLinkedDocs = linkedPos.length > 0 || linkedReceivings.length > 0 || linkedBills.length > 0;

  return (
    <>
      {/* ─── 1. STATUS & LANGKAH BERIKUTNYA ─── */}
      <Panel title="Status">
        <View className="gap-4">
          {/* Tahapan */}
          <View className="flex-row items-start">
            {steps.map((st, idx) => {
              const isLast = idx === steps.length - 1;
              const dotClass = isDitolak
                ? "bg-destructive/15 border-destructive/40"
                : st.done
                ? "bg-emerald-600 border-emerald-600"
                : st.current
                ? "bg-primary border-primary"
                : "bg-card border-border";
              return (
                <React.Fragment key={st.label}>
                  <View className="items-center" style={{ width: 64 }}>
                    <View className={`h-6 w-6 rounded-full items-center justify-center border ${dotClass}`}>
                      {isDitolak ? (
                        <XCircle size={12} color={colors.danger} />
                      ) : st.done ? (
                        <Check size={12} color="#fff" />
                      ) : (
                        <Text className={`text-[10px] font-bold ${st.current ? "text-white" : "text-muted-foreground"}`}>{idx + 1}</Text>
                      )}
                    </View>
                    <Text
                      className={`text-[10px] mt-1 text-center leading-tight ${
                        st.current ? "text-primary font-bold" : st.done ? "text-foreground" : "text-muted-foreground"
                      }`}
                      numberOfLines={2}
                    >
                      {st.label}
                    </Text>
                  </View>
                  {!isLast ? (
                    <View className={`h-[2px] flex-1 mt-3 ${st.done && steps[idx + 1]?.done ? "bg-emerald-600" : "bg-border"}`} />
                  ) : null}
                </React.Fragment>
              );
            })}
          </View>

          {/* Keadaan saat ini */}
          <View className={`flex-row items-start gap-3 rounded-xl border p-3 ${toneBox[statusInfo.tone]}`}>
            <ToneIcon size={18} color={toneColor} />
            <View className="flex-1">
              <Text className={`text-sm font-semibold ${toneText[statusInfo.tone]}`}>{statusInfo.title}</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">{statusInfo.desc}</Text>
            </View>
          </View>

          {/* Langkah berikutnya */}
          <View className="gap-2">
            <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Langkah berikutnya</Text>
            {(() => {
              const actions: React.ReactNode[] = [];
              if (!isDitolak) {
                if (isPendingApproval && canApprove && approval?.id) {
                  actions.push(
                    <Button key="approve" size="sm" className="bg-emerald-600" onPress={handleApprove} disabled={loading}>
                      <CheckCircle2 size={14} color="#fff" />
                      <Text className="text-xs font-semibold text-white">Setujui</Text>
                    </Button>,
                    <Button key="reject" variant="outline" size="sm" onPress={() => setRejectOpen(true)} disabled={loading}>
                      <XCircle size={14} color={colors.danger} />
                      <Text className="text-xs font-semibold text-destructive">Tolak</Text>
                    </Button>,
                  );
                }
                if (isStockTake && isDiajukan && canCheckStock) {
                  actions.push(
                    <Button key="cek" variant="outline" size="sm" onPress={handleMarkCheckStock} disabled={loading}>
                      <Clock size={14} color={colors.text} />
                      <Text className="text-xs">Tandai sedang cek stok</Text>
                    </Button>,
                  );
                }
                if (isSupplierFlow && !linkedPo && canCreatePo && isApproved) {
                  actions.push(
                    <Button key="po" size="sm" onPress={handleOpenCreatePo} disabled={loading}>
                      <Plus size={14} color="#fff" />
                      <Text className="text-xs font-semibold text-white">Buat PO Supplier</Text>
                    </Button>,
                  );
                }
                // Pembayaran: satu tempat. Bila sudah ada tagihan supplier, bayar di tagihan itu.
                const payDue = !isStockTake && !isPaid && (isCash ? isApproved : isDiterima);
                if (payDue && canPay) {
                  actions.push(
                    billPo ? (
                      <Button key="bill" size="sm" variant="outline" onPress={() => router.push(`/supplier-pos/${billPo.id}` as any)}>
                        <FileText size={14} color={colors.text} />
                        <Text className="text-xs">Bayar lewat tagihan di PO {billPo.nomor}</Text>
                      </Button>
                    ) : (
                      <Button key="pay" size="sm" className="bg-emerald-600" onPress={() => setPayModalOpen(true)} disabled={loading}>
                        <DollarSign size={14} color="#fff" />
                        <Text className="text-xs font-semibold text-white">{isCash ? "Bayar" : "Lunasi"}</Text>
                      </Button>
                    ),
                  );
                }
                if (isStockTake && isApproved && !isDispatched && isGudang) {
                  actions.push(
                    <Button key="handover" size="sm" onPress={() => setConfirmSendOpen(true)} disabled={loading}>
                      <Truck size={14} color="#fff" />
                      <Text className="text-xs font-semibold text-white">Serahkan barang ke proyek</Text>
                    </Button>,
                  );
                }
                const shipReady =
                  !isStockTake &&
                  !isProjectConsumableRequest &&
                  !isDispatched &&
                  (isSupplierFlow ? isPoDibuat && (isDebt || isPaid) : isCash ? isPaid : isApproved);
                if (shipReady && canShip) {
                  actions.push(
                    <Button key="ship" size="sm" onPress={() => setConfirmSendOpen(true)} disabled={loading}>
                      <Truck size={14} color="#fff" />
                      <Text className="text-xs font-semibold text-white">Tandai barang dikirim</Text>
                    </Button>,
                  );
                }
                if (isStockTake && isDikirim && !isDiterima && canConfirmHandover) {
                  actions.push(
                    <Button key="handover-ok" size="sm" className="bg-emerald-600" onPress={() => setConfirmReceiveOpen(true)} disabled={loading}>
                      <PackageCheck size={14} color="#fff" />
                      <Text className="text-xs font-semibold text-white">Konfirmasi barang diterima</Text>
                    </Button>,
                  );
                }
                if (!isStockTake && !isProjectConsumableRequest && isDispatched && !isDiterima && canReceive) {
                  const rc = linkedReceivings[0];
                  actions.push(
                    <Button
                      key="receive"
                      size="sm"
                      className="bg-emerald-600"
                      onPress={() => router.push((rc ? `/receiving/${rc.id}` : "/receiving/new") as any)}
                    >
                      <PackageCheck size={14} color="#fff" />
                      <Text className="text-xs font-semibold text-white">{rc ? `Terima barang (${rc.nomor})` : "Terima barang di gudang"}</Text>
                    </Button>,
                  );
                }
              }

              if (actions.length) return <View className="flex-row flex-wrap items-center gap-2">{actions}</View>;

              const waiting = isDitolak
                ? "Tidak ada langkah lagi."
                : isPendingApproval || isDiajukan || isCekStok
                ? isStockTake && isDiajukan
                  ? "Menunggu Gudang cek stok, lalu persetujuan Finance."
                  : "Menunggu persetujuan Finance."
                : isStockTake
                ? !isDispatched
                  ? "Menunggu Gudang menyerahkan barang."
                  : !isDiterima
                  ? `Menunggu ${row.pemohon || "pemohon"} mengonfirmasi barang diterima.`
                  : "Selesai."
                : isCash && !isPaid
                ? "Menunggu Finance membayar."
                : isSupplierFlow && !isPoDibuat
                ? "Menunggu Procurement membuat PO."
                : !isDispatched && !isProjectConsumableRequest
                ? "Menunggu Procurement menandai barang dikirim."
                : !isDiterima && !isProjectConsumableRequest
                ? "Menunggu Gudang menerima barang."
                : !isPaid
                ? billPo
                  ? `Menunggu Finance melunasi tagihan di PO ${billPo.nomor}.`
                  : "Menunggu Finance melunasi."
                : "Selesai.";
              return (
                <View className="flex-row items-center gap-2">
                  <Clock size={14} color={colors.muted} />
                  <Text className="text-xs text-muted-foreground flex-1">{waiting}</Text>
                </View>
              );
            })()}
          </View>
        </View>
      </Panel>

      {/* ─── 2. BARANG ─── */}
      <Panel title="Barang" subtitle={`${items.length || 1} item · ${sourceLabel}`}>
        {stockSummary.length === 0 ? (
          <View className="gap-1">
            <Text className="text-sm font-semibold">{row.item || row.tujuan || "Barang operasional"}</Text>
            <Text className="text-xs text-muted-foreground">Estimasi biaya {rupiah(Number(row.estimasi || 0))}</Text>
          </View>
        ) : (
          <View>
            {stockSummary.map((item, idx) => {
              const productName = item.product?.name || item.customName || `Barang #${idx + 1}`;
              const unit = item.product?.unit || item.customUnit || "";
              const unitCost = Number(item.unitCost || 0);
              const lineTotal = unitCost * Number(item.ordered || 0);
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
                  className={`flex-row items-start justify-between gap-3 py-3 ${idx > 0 ? "border-t border-border/60" : ""}`}
                >
                  <View className="flex-1 min-w-0">
                    <Text className="text-sm font-medium text-foreground" numberOfLines={2}>
                      {productName}
                    </Text>
                    <Text className="text-xs text-muted-foreground mt-0.5">
                      {item.ordered} {unit}
                      {unitCost > 0 ? ` × ${rupiah(unitCost)}` : ""}
                      {item.product?.sku ? ` · ${item.product.sku}` : ""}
                    </Text>
                    {parsedSerials.length > 0 ? (
                      <Text className="text-[11px] font-mono text-muted-foreground mt-0.5">SN: {parsedSerials.join(", ")}</Text>
                    ) : null}
                  </View>
                  <View className="items-end gap-1 shrink-0">
                    {lineTotal > 0 ? <Text className="text-sm font-semibold text-foreground">{rupiah(lineTotal)}</Text> : null}
                    {item.isCustom ? (
                      <Text className="text-[11px] text-muted-foreground">Non-master</Text>
                    ) : (
                      <Text className={`text-[11px] font-medium ${item.isEnough ? "text-emerald-600" : "text-amber-600"}`}>
                        Stok gudang {item.available}
                        {item.isEnough ? "" : " (kurang)"}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}

            {itemsSubtotal > 0 ? (
              <View className="border-t border-border pt-3 mt-1 gap-1">
                {ppnModeRow !== "none" ? (
                  <>
                    <View className="flex-row justify-between">
                      <Text className="text-xs text-muted-foreground">DPP</Text>
                      <Text className="text-xs text-foreground">{rupiah(totalDpp)}</Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-xs text-muted-foreground">
                        PPN 11%{ppnModeRow === "include" ? " (sudah termasuk)" : ""}
                      </Text>
                      <Text className="text-xs text-foreground">{rupiah(totalPpn)}</Text>
                    </View>
                  </>
                ) : null}
                <View className="flex-row justify-between pt-0.5">
                  <Text className="text-sm font-semibold text-foreground">Total</Text>
                  <Text className="text-sm font-bold text-foreground">{rupiah(grandTotal)}</Text>
                </View>
              </View>
            ) : null}
          </View>
        )}
      </Panel>

      {/* ─── 3. DOKUMEN TERKAIT ─── */}
      {hasLinkedDocs || (isSupplierFlow && !isDitolak) ? (
        <Panel title="Dokumen terkait">
          {!hasLinkedDocs ? (
            <Text className="text-xs text-muted-foreground">
              {isApproved ? "Belum ada PO supplier." : "PO supplier dibuat setelah permintaan disetujui."}
            </Text>
          ) : (
            <View>
              {[
                ...linkedPos.map((p: Row) => ({
                  key: `po-${p.id}`,
                  icon: FileText,
                  title: `PO ${p.nomor}`,
                  sub: `${p.supplier || row.supplier || "-"} · ${rupiah(Number(p.total || 0))}`,
                  status: p.status,
                  href: `/supplier-pos/${p.id}`,
                })),
                ...linkedReceivings.map((rc: Row) => ({
                  key: `rc-${rc.id}`,
                  icon: PackageCheck,
                  title: `Penerimaan ${rc.nomor}`,
                  sub: rc.tanggal ? `Tanggal ${rc.tanggal}` : "Penerimaan gudang",
                  status: rc.status,
                  href: `/receiving/${rc.id}`,
                })),
                ...linkedBills.map((inv: Row) => ({
                  key: `inv-${inv.id}`,
                  icon: DollarSign,
                  title: `Tagihan ${inv.nomor || "supplier"}`,
                  sub: rupiah(Number(inv.total || 0)),
                  status: inv.status,
                  href: inv.supplierPoId ? `/supplier-pos/${inv.supplierPoId}` : null,
                })),
              ].map((d, idx) => {
                const Icon = d.icon;
                return (
                  <Pressable
                    key={d.key}
                    onPress={d.href ? () => router.push(d.href as any) : undefined}
                    className={`flex-row items-center gap-3 py-2.5 ${idx > 0 ? "border-t border-border/60" : ""}`}
                  >
                    <View className="size-8 rounded-lg bg-primary/10 items-center justify-center">
                      <Icon size={16} color={colors.primary} />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
                        {d.title}
                      </Text>
                      <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                        {d.sub}
                      </Text>
                    </View>
                    {d.status ? <StatusBadge status={String(d.status)} /> : null}
                    {d.href ? <ChevronRight size={16} color={colors.muted} /> : null}
                  </Pressable>
                );
              })}
            </View>
          )}
        </Panel>
      ) : null}

      {/* ─── 4. AKUNTANSI (dilipat, hanya untuk yang berhak) ─── */}
      {showAccounting ? (
        <View className="bg-card border-border/80 rounded-2xl border overflow-hidden">
          <Pressable onPress={() => setShowAccountingDetail((v) => !v)} className="flex-row items-center justify-between px-4 py-3">
            <Text className="text-sm font-medium text-foreground">Skema akuntansi</Text>
            {showAccountingDetail ? <ChevronUp size={16} color={colors.muted} /> : <ChevronDown size={16} color={colors.muted} />}
          </Pressable>
          {showAccountingDetail ? (
            <View className="border-t border-border/60 px-4 py-3 gap-2">
              {[
                ["Debit", isProject ? "5101 HPP Proyek" : "1200 Persediaan Barang"],
                [
                  "Kredit",
                  isStockTake
                    ? "1200 Persediaan (stok gudang berkurang)"
                    : isPaid || isRetailCash
                    ? `${row.paymentAccountCode || row.fundingSource || "1000.01"} Kas / Bank`
                    : "210102 Hutang Usaha",
                ],
                ...(ppnModeRow !== "none"
                  ? [["PPN", `${ppnModeRow === "include" ? "Sudah termasuk" : "Ditambahkan"} 11% → 1600 PPN Masukan`]]
                  : []),
              ].map(([k, v]) => (
                <View key={k} className="flex-row justify-between gap-3">
                  <Text className="text-xs text-muted-foreground">{k}</Text>
                  <Text className="text-xs font-medium text-foreground flex-1 text-right">{v}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
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
            <View className="bg-panel/60 border border-border/80 rounded-xl p-3 gap-1">
              <View className="flex-row justify-between items-center">
                <Text className="text-xs text-muted-foreground">Nilai pembelian</Text>
                <Text className="text-xs font-bold text-foreground">
                  {rupiah(Number(linkedPo?.total || row.estimasi || 0))}
                </Text>
              </View>
              {isDebt && row.jatuhTempo && row.jatuhTempo !== "-" ? (
                <View className="flex-row justify-between items-center">
                  <Text className="text-xs text-muted-foreground">Jatuh tempo (dari Request)</Text>
                  <Text className="text-xs font-semibold text-amber-700 dark:text-amber-400">{row.jatuhTempo}</Text>
                </View>
              ) : null}
            </View>
            <FormField label="Dibayar dari (Kas / Bank)" required>
              <SearchableSelect
                value={kasBankOptions.find((o) => o.code === selectedFundingSource)?.name || kasBankOptions[0]?.name || ""}
                options={kasBankOptions.map((o) => o.name)}
                onChange={(val) => {
                  const match = kasBankOptions.find((o) => o.name === val || val.includes(o.code));
                  if (match) setSelectedFundingSource(match.code);
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
              Proyek, barang, cara bayar & jatuh tempo diambil otomatis dari permintaan {row.nomor}. Cukup pilih supplier & cek total.
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
                <Text className="text-xs text-muted-foreground">Cara Bayar:</Text>
                <Text className="text-xs font-semibold text-foreground">
                  {isCash
                    ? "Tunai — Finance bayar dulu"
                    : `Tempo${row.jatuhTempo && row.jatuhTempo !== "-" ? ` s/d ${row.jatuhTempo}` : ""}`}
                </Text>
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
                  } else {
                    setPoSupplierId("");
                  }
                }}
                onAddNew={() => setQuickSupplierOpen(true)}
                addNewLabel="+ Tambah Supplier Baru"
                placeholder="Pilih supplier..."
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
