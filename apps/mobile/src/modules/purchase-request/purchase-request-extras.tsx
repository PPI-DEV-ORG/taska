import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { CheckCircle2, AlertTriangle, Truck, PackageCheck, XCircle, Clock, Check, FileText, Plus, DollarSign, UploadCloud, ExternalLink } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Panel, FormField } from "@/components/taska/basics";
import { FileUploader } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { rupiah } from "@/lib/format";
import { type Row } from "@/constants/modules";
import { toEnum } from "@/services/adapters";
import { SearchableSelect, DatePicker } from "@/components/taska/dialogs";
import { StatusBadge } from "@/components/taska/status-badge";
import { Input } from "@/components/ui/input";

export function PurchaseRequestExtras({
  row,
  onRefresh,
}: {
  row: Row;
  onRefresh?: () => Promise<void> | void;
}) {
  const router = useRouter();
  const { user, data, addRow, patchRow, setStatus, decide, toast, reload } = useApp();
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");
  const [confirmSendOpen, setConfirmSendOpen] = React.useState(false);
  const [confirmReceiveOpen, setConfirmReceiveOpen] = React.useState(false);
  const [payModalOpen, setPayModalOpen] = React.useState(false);
  const [createPoOpen, setCreatePoOpen] = React.useState(false);
  const [poSupplierId, setPoSupplierId] = React.useState<string>("");
  const [poPaymentTerms, setPoPaymentTerms] = React.useState<string>("Utang / Tempo (Net 30)");
  const [poEta, setPoEta] = React.useState<string>("");
  const [poTotal, setPoTotal] = React.useState<string>("");
  const [paymentProofFileId, setPaymentProofFileId] = React.useState<number | null>(null);
  const [selectedFundingSource, setSelectedFundingSource] = React.useState<string>("1000.01");
  const [doFileId, setDoFileId] = React.useState<number | null>(null);
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
  const isRetailCash = procSource === "RETAIL" && payMethod === "KAS"; // Flow 2: Pembelian Ritel Tunai/Lunas (Stok atau Project)
  const isDebt = !isStockTake && payMethod !== "KAS";
  const isRetailDebt = (procSource === "RETAIL" || !procSource) && payMethod !== "KAS"; // Flow 3: Pembelian Ritel Tempo/Hutang (Stok atau Project)
  const isSupplierPo = procSource === "SUPPLIER"; // Flow 4: Pengadaan via PO Supplier Formal
  const isRetailOrPurchase = !isStockTake;

  // Raw status enum
  const effectiveRaw = (
    localStatus ||
    row.rawStatus ||
    (row.status ? toEnum("purchase-requests", row.status) : "DIAJUKAN") ||
    "DIAJUKAN"
  ).toUpperCase();

  const isDiajukan = effectiveRaw === "DIAJUKAN";
  const isCekStok = effectiveRaw === "CEK_STOK";
  const isDisetujui = effectiveRaw === "DISETUJUI";
  const isPaid =
    localStatus === "LUNAS" ||
    localStatus === "DIBAYAR" ||
    effectiveRaw === "DIBAYAR" ||
    row.status === "Lunas" ||
    row.status === "Dibayar" ||
    row.paymentStatus === "DIBAYAR" ||
    !!row.paymentProofFileId ||
    !!row.paymentProofFile ||
    String(row.otherNote || "").includes("[DIBAYAR");
  const isDikirim =
    effectiveRaw === "DIKIRIM" ||
    row.status === "Dikirim" ||
    localStatus === "DIKIRIM";
  const isDiterima =
    effectiveRaw === "DITERIMA" ||
    row.status === "Diterima" ||
    row.status === "Diterima (Belum Lunas)" ||
    row.status === "Lunas" ||
    (isDebt && isPaid);
  const isDitolak = effectiveRaw === "DITOLAK";

  const linkedPo = React.useMemo(() => {
    const prSuffix = String(row.nomor || "").replace(/^(?:PNJ|REQ|PR)\//i, "");
    const fromList = (data["supplier-pos"] ?? []).find(
      (sp: Row) =>
        (sp.requestId && String(sp.requestId) === String(row.id)) ||
        (row.nomor && sp.request && String(sp.request).toLowerCase() === String(row.nomor).toLowerCase()) ||
        (row.nomor && String(sp.nomor).includes(row.nomor)) ||
        (prSuffix && sp.nomor && String(sp.nomor).replace(/^(?:POD|PO-S|PO)\//i, "") === prSuffix) ||
        (Number(sp.total) === Number(row.estimasi) && sp.supplier && row.supplier && String(sp.supplier).toLowerCase() === String(row.supplier).toLowerCase()),
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
      };
    }
    return null;
  }, [data, row.id, row.nomor, row.supplierPOs, row.supplierPo, row.estimasi, row.supplier]);

  const isPoDibuat =
    effectiveRaw === "PO_DIBUAT" ||
    row.status === "PO dibuat" ||
    localStatus === "PO_DIBUAT" ||
    !!linkedPo;
  const isApproved =
    isDisetujui ||
    isPoDibuat ||
    isPaid ||
    isDikirim ||
    isDiterima ||
    row.approval?.status === "Disetujui";
  const isStockChecked = isCekStok || isApproved || isDikirim || isDiterima;
  const isDispatched =
    isDikirim ||
    isDiterima ||
    isPaid ||
    linkedPo?.shipmentStatus === "DIKIRIM" ||
    linkedPo?.shipmentStatus === "SAMPAI";

  const items: any[] = Array.isArray(row.items) ? row.items : [];
  const stockInfo: any[] = Array.isArray(row.stock) ? row.stock : [];
  const approval = row.approval;
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

  const linkedReceivings = React.useMemo(() => {
    return (data.receiving ?? []).filter(
      (rc: Row) =>
        (rc.requestId && String(rc.requestId) === String(row.id)) ||
        (linkedPo && String(rc.supplierPoId) === String(linkedPo.id)) ||
        (row.nomor && rc.requestNumber === row.nomor),
    );
  }, [data.receiving, row.id, linkedPo, row.nomor]);

  function handleOpenCreatePo() {
    const suppliersList = data.suppliers ?? [];
    const matchedSupplier = suppliersList.find(
      (s: Row) =>
        (row.supplierId && String(s.id) === String(row.supplierId)) ||
        (row.supplier && String(s.nama || s.name).toLowerCase() === String(row.supplier).toLowerCase())
    ) ?? suppliersList[0];

    setPoSupplierId(matchedSupplier?.id ? String(matchedSupplier.id) : "");
    setPoPaymentTerms(
      row.paymentMethod === "KAS"
        ? "Tunai / Kas"
        : row.paymentMethod === "NET14"
        ? "Net 14 Hari"
        : "Utang / Tempo (Net 30)"
    );
    const defaultEta = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0] || "";
    setPoEta(defaultEta);
    setPoTotal(String(row.estimasi || ""));
    setCreatePoOpen(true);
  }

  async function handleSubmitCreatePo() {
    const suppliersList = data.suppliers ?? [];
    const targetSupplier =
      suppliersList.find((s: Row) => String(s.id) === String(poSupplierId)) ??
      suppliersList.find((s: Row) => (s.nama || s.name) === poSupplierId) ??
      suppliersList[0];
    const supplierName = targetSupplier?.nama ?? targetSupplier?.name ?? row.supplier ?? "Supplier Utama";
    const supplierId = targetSupplier?.id ? Number(targetSupplier.id) : (row.supplierId ? Number(row.supplierId) : undefined);

    const reqItems = Array.isArray(row.items) && row.items.length
      ? row.items.map((i: any) => ({
          productId: i.productId || i.product?.id ? Number(i.productId || i.product?.id) : undefined,
          customName: i.customName || undefined,
          customUnit: i.customUnit || undefined,
          qty: Number(i.qty) || 1,
          price: Number(i.unitCost || i.estimatedPrice || i.price || (row.estimasi ? Math.round(row.estimasi / row.items.length) : 0)),
        }))
      : undefined;

    setLoading(true);
    try {
      const created = await addRow("supplier-pos", {
        supplier: supplierName,
        supplierId: supplierId,
        request: row.nomor,
        requestId: row.id != null ? Number(row.id) : undefined,
        projectId: row.projectId != null ? Number(row.projectId) : undefined,
        project: row.project,
        payment: poPaymentTerms,
        paymentTerms: poPaymentTerms,
        item: row.item || row.tujuan || "Barang Request",
        items: reqItems,
        total: Number(poTotal) || row.estimasi || 0,
        eta: poEta || undefined,
        status: isPaid ? "Lunas" : isDiterima ? "Sampai" : isDikirim ? "Dikirim" : "Menunggu persetujuan",
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
        toast(`PO Supplier untuk request ${row.nomor} berhasil dibuat dan terhubung!`);
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
      if (approval?.id && isPendingApproval) {
        try { await decide(approval.id, "Disetujui"); } catch {}
      }
      await setStatus("purchase-requests", row.id, "Disetujui");
      toast("Request barang berhasil disetujui");
      if (onRefresh) await onRefresh();
      await reload();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menyetujui request", "danger");
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
        try { await decide(approval.id, "Ditolak", rejectReason); } catch {}
      }
      await setStatus("purchase-requests", row.id, "Ditolak", rejectReason);
      setRejectOpen(false);
      setRejectReason("");
      toast("Request barang ditolak");
      if (onRefresh) await onRefresh();
      await reload();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menolak request", "danger");
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
    if (!paymentProofFileId) {
      toast("Unggah bukti pembayaran terlebih dahulu", "danger");
      return;
    }
    setLoading(true);
    try {
      setLocalStatus("LUNAS");
      await setStatus("purchase-requests", row.id, "Dibayar", undefined, {
        paymentProofFileId,
        fundingSource: selectedFundingSource,
        paymentStatus: "DIBAYAR",
      });
      if (linkedPo?.id) {
        try {
          await patchRow("supplier-pos", String(linkedPo.id), { status: "Lunas", isPaid: true });
        } catch {}
      }
      setPayModalOpen(false);
      toast("Request & PO berhasil ditandai Lunas. Hutang Usaha (210102) telah selesai dicatat di kas keluar!");
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
          ? "Barang PO Supplier ditandai dikirim. Status PO dan Request Barang telah disinkronkan!"
          : isRetailOrPurchase
          ? "Barang pengadaan ditandai dikirim. Data Penerimaan di Gudang otomatis dibuat!"
          : "Barang berhasil diserahkan/dikirim dari Gudang"
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
      setLocalStatus("DITERIMA");
      await setStatus("purchase-requests", row.id, "Diterima", undefined, doFileId ? { doFileId } : undefined);
      if (linkedPo?.id) {
        try {
          await patchRow("supplier-pos", String(linkedPo.id), {
            pengiriman: "Sampai",
            shipmentStatus: "SAMPAI",
            status: "DISETUJUI",
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
        { label: "Diserahkan", done: isDispatched, current: isDikirim },
        { label: "Diterima Proyek", done: isDiterima, current: isDiterima },
      ];
    }
    if (isRetailCash) {
      // Flow 2: Pembelian Ritel Tunai / Kas (Disetujui -> Dibayar Kas -> Dikirim -> Diterima)
      return [
        { label: "Diajukan", done: true, current: isDiajukan },
        { label: "Disetujui", done: isApproved, current: isDisetujui && !isPaid },
        { label: "Dibayar (Kas)", done: isPaid, current: effectiveRaw === "DIBAYAR" },
        { label: "Dikirim Toko", done: isDispatched, current: isDikirim },
        { label: "Diterima Gudang", done: isDiterima, current: isDiterima },
      ];
    }
    if (isRetailDebt) {
      // Flow 3: Pembelian Ritel Tempo / Hutang (Disetujui -> Dikirim -> Diterima Hutang -> Pelunasan)
      return [
        { label: "Diajukan", done: true, current: isDiajukan },
        { label: "Disetujui", done: isApproved, current: isDisetujui && !isDikirim && !isDiterima && !isPaid },
        { label: "Dikirim Toko", done: isDispatched, current: isDikirim },
        { label: "Diterima (Hutang)", done: isDiterima || isPaid, current: isDiterima && !isPaid },
        { label: "Lunas", done: isPaid, current: isPaid },
      ];
    }
    // Flow 4: Pengadaan via PO Supplier Formal
    return [
      { label: "Diajukan", done: true, current: isDiajukan },
      { label: "Disetujui", done: isApproved || isPoDibuat || isDispatched || isDiterima || isPaid, current: isDisetujui && !isPoDibuat && !isDispatched && !isDiterima && !isPaid },
      { label: "PO Dibuat", done: isPoDibuat || isDispatched || isDiterima || isPaid, current: isPoDibuat && !isDispatched && !isDiterima && !isPaid },
      { label: "Dikirim Supplier", done: isDispatched || isDiterima || isPaid, current: isDikirim && !isDiterima && !isPaid },
      { label: isPaid ? "Selesai (Lunas)" : "Diterima Gudang", done: isDiterima || isPaid, current: isDiterima || isPaid },
    ];
  }, [
    isStockTake,
    isRetailCash,
    isRetailDebt,
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
    linkedPo,
  ]);

  return (
    <>
      {/* ─── STATUS STEPPER / FLOW ─── */}
      <Panel title="Alur & Status Request" subtitle="Perkembangan tahapan proses barang dari pengajuan hingga diterima">
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
      </Panel>

      {/* ─── PROMINENT STATUS ALERT BANNER ─── */}
      {isDitolak ? (
        <View className="bg-destructive/15 border border-destructive/40 rounded-xl p-4 flex-row items-center gap-3">
          <XCircle size={22} color={colors.danger} />
          <View className="flex-1">
            <Text className="text-destructive font-bold text-base">Request Barang Ditolak</Text>
            <Text className="text-destructive/90 text-xs mt-0.5">
              Alasan: {row.rejectReason || "Request tidak dapat diproses oleh Gudang/Approver."}
            </Text>
          </View>
        </View>
      ) : isDiterima ? (
        isDebt && !isPaid ? (
          <View className="bg-amber-500/15 border border-amber-500/40 rounded-xl p-4 flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <View className="flex-row items-center gap-3 flex-1">
              <Clock size={22} color={colors.warning} />
              <View className="flex-1">
                <Text className="text-amber-800 dark:text-amber-400 font-bold text-base">
                  Barang Telah Diterima (Belum Lunas)
                </Text>
                <Text className="text-amber-900/90 dark:text-amber-300/80 text-xs mt-0.5">
                  Barang & nota bon tempo telah diterima di gudang (stok bertambah & tercatat Hutang Usaha 210102). Menunggu pelunasan hutang oleh Finance.
                </Text>
              </View>
            </View>
            {isFinance ? (
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
        ) : (
          <View className="bg-emerald-500/15 border border-emerald-500/40 rounded-xl p-4 flex-row items-center gap-3">
            <CheckCircle2 size={22} color="#10b981" />
            <View className="flex-1">
              <Text className="text-emerald-700 dark:text-emerald-400 font-bold text-base">
                {isStockTake ? "Barang Selesai Diterima di Proyek" : isDebt ? "Pengadaan Selesai & Lunas" : "Barang Selesai Diterima di Gudang"}
              </Text>
              <Text className="text-muted-foreground text-xs mt-0.5">
                {isStockTake
                  ? `Barang dari gudang telah diterima oleh tim proyek (${row.pemohon || "User"}). Seluruh unit serial terpasang di proyek.`
                  : isDebt
                  ? "Barang telah diterima di gudang dan hutang telah dilunasi sepenuhnya oleh Finance (Saldo Hutang Usaha 210102 Rp 0)."
                  : "Barang telah diterima di gudang, stok tercatat bertambah, dan proses pengadaan telah tuntas."}
              </Text>
            </View>
          </View>
        )
      ) : isPaid && isDebt ? (
        <View className="bg-emerald-500/15 border border-emerald-500/40 rounded-xl p-4 flex-row items-center gap-3">
          <CheckCircle2 size={22} color="#10b981" />
          <View className="flex-1">
            <Text className="text-emerald-700 dark:text-emerald-400 font-bold text-base">
              Pengadaan Selesai & Lunas
            </Text>
            <Text className="text-muted-foreground text-xs mt-0.5">
              Barang telah diterima di gudang dan hutang telah dilunasi sepenuhnya oleh Finance (Saldo Hutang Usaha 210102 Rp 0).
            </Text>
          </View>
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
                  : isRetailDebt
                  ? "Toko ritel telah mengirim barang bersama nota bon tempo. Data Penerimaan telah dibuat otomatis di Gudang."
                  : "Barang telah dibayar dan sedang dikirim. Data Penerimaan telah dibuat otomatis di Gudang. Petugas gudang dapat memverifikasi fisik & SN saat barang tiba."}
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
      ) : isRetailCash && (effectiveRaw === "DIBAYAR" || isPaid) ? (
        <View className="bg-emerald-500/15 border border-emerald-500/40 rounded-xl p-4 flex-row items-center gap-3">
          <CheckCircle2 size={22} color="#10b981" />
          <View className="flex-1">
            <Text className="text-emerald-700 dark:text-emerald-400 font-bold text-base">Telah Dibayar oleh Finance (Masuk Jurnal Kas)</Text>
            <Text className="text-muted-foreground text-xs mt-0.5">
              Bukti bayar telah diunggah & tercatat di akuntansi ({isProject ? "HPP Project 5101" : "Persediaan 1200"}). Menunggu Procurement menandai &quot;Barang Dikirim&quot; agar draf Penerimaan Gudang terbuat.
            </Text>
          </View>
        </View>
      ) : isRetailDebt && isPaid ? (
        <View className="bg-emerald-500/15 border border-emerald-500/40 rounded-xl p-4 flex-row items-center gap-3">
          <CheckCircle2 size={22} color="#10b981" />
          <View className="flex-1">
            <Text className="text-emerald-700 dark:text-emerald-400 font-bold text-base">Hutang Toko Ritel Telah Dilunasi</Text>
            <Text className="text-muted-foreground text-xs mt-0.5">
              Finance telah mengunggah bukti pelunasan nota tempo toko ritel. Kewajiban hutang telah tuntas di akuntansi.
            </Text>
          </View>
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
            <Text className="text-emerald-700 dark:text-emerald-400 font-bold text-base">Request Telah Disetujui</Text>
            <Text className="text-muted-foreground text-xs mt-0.5">
              {isStockTake
                ? "Permintaan telah disetujui. Petugas gudang dapat segera menyerahkan barang ke tim proyek."
                : isRetailCash
                ? "Request disetujui. Menunggu Finance melakukan pembayaran kas/transfer & mengunggah bukti transfer."
                : isRetailDebt
                ? "Pembelian tempo disetujui. Toko dapat segera mengirimkan barang dengan nota bon tempo."
                : "Request disetujui. Procurement dapat segera menerbitkan PO Supplier resmi."}
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
                  Buat Purchase Order (PO) resmi ke supplier untuk memesan barang ini. PO akan otomatis terhubung secara permanen dengan request ini.
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

      {/* ─── SKEMA AKUNTANSI & KETERKAITAN DOKUMEN (PO/SO & INVOICE) ─── */}
      <Panel
        title="Skema Akuntansi & Keterkaitan Dokumen"
        subtitle={
          isStockTake
            ? "Alokasi material internal: Persediaan Gudang (1200) → HPP Project (5101)"
            : isRetailCash
            ? "Pembelian Ritel Tunai: Kas Keluar (1000.01) langsung diakui saat dibayar"
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
                  ? "[5101] HPP Project (Bahan & Material Proyek)"
                  : "[1200] Persediaan Barang Dagang (Aset Lancar)"}
              </Text>
            </View>
            <View className="flex-row justify-between items-center">
              <Text className="text-xs text-muted-foreground">Pos KREDIT Akuntansi:</Text>
              <Text className="text-xs font-bold text-warning">
                {isStockTake
                  ? "[1200] Persediaan Barang Dagang (Stok Gudang Berkurang — Tanpa Kas/Utang)"
                  : isPaid
                  ? `${row.fundingSource === "1000.02" || /mandiri|bank/i.test(String(row.fundingSource || "")) ? "[1000.02] Bank Mandiri PT GMP" : "[1000.01] Kas Kecil / Tunai"} (Pelunasan: Saldo Hutang 210102 Rp 0)`
                  : isRetailCash
                  ? row.fundingSource === "1000.02" || /mandiri|bank/i.test(String(row.fundingSource || ""))
                    ? "[1000.02] Bank Mandiri PT GMP (Pengeluaran Transfer)"
                    : "[1000.01] Kas Kecil / Tunai (Pengeluaran Kas)"
                  : "[210102] Hutang Usaha (Nota Bon Toko / Supplier)"}
              </Text>
            </View>
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
                    Lihat PO / SO: {linkedPo.nomor}
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

            {/* Link Bukti Pembayaran Kas / Transfer */}
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
        subtitle="Mendukung barang dari Master Barang (Ber-SN / Non-SN) maupun barang Non-Master (Beli Ritel)"
      >
        {stockSummary.length === 0 ? (
          <View className="py-2">
            <Text className="text-sm font-semibold">{row.item || row.tujuan || "Barang Operasional"}</Text>
            <Text className="text-xs text-muted-foreground mt-1">Estimasi Biaya: Rp{Number(row.estimasi || 0).toLocaleString("id-ID")}</Text>
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
      {(isGudang || isProcurement || isFinance) ? (
        <Panel
          title="Tindakan Gudang, Pengadaan & Finance"
          subtitle="Tahapan aksi operasional sesuai jenis dan alur request barang"
        >
          <View className="flex-row flex-wrap items-center gap-2.5 pt-1">
            {/* 1. Persetujuan Request */}
            {(isApproved || isPoDibuat || isDispatched || isDiterima || isPaid) ? (
              <View className="bg-emerald-500/15 border border-emerald-500/30 rounded-md px-3 py-1.5 flex-row items-center gap-1.5">
                <CheckCircle2 size={15} color="#10b981" />
                <Text className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  ✓ Sudah Disetujui
                </Text>
              </View>
            ) : !isDitolak ? (
              ((isStockTake && (isGudang || isRequesterOrPM || isFinance)) ||
               (isRetailCash && isFinance) ||
               (isRetailDebt && (isFinance || isProcurement)) ||
               (isSupplierPo && (isProcurement || isFinance))) ? (
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onPress={handleApprove}
                  disabled={loading}
                >
                  <CheckCircle2 size={14} color="#fff" />
                  <Text className="text-xs font-semibold text-white">Setujui Request</Text>
                </Button>
              ) : null
            ) : null}

            {/* 2. Cek Stok Gudang (Khusus Flow 1: Ambil Stok Gudang untuk Proyek) */}
            {isStockTake && (
              isStockChecked ? (
                <View className="bg-sky-500/15 border border-sky-500/30 rounded-md px-3 py-1.5 flex-row items-center gap-1.5">
                  <CheckCircle2 size={15} color="#0284c7" />
                  <Text className="text-xs font-semibold text-sky-700 dark:text-sky-400">
                    ✓ Stok Telah Dicek
                  </Text>
                </View>
              ) : isGudang && !isDitolak ? (
                <Button
                  variant="outline"
                  size="sm"
                  onPress={handleMarkCheckStock}
                  disabled={loading}
                >
                  <Clock size={14} color={colors.text} />
                  <Text className="text-xs">Tandai Cek Stok Fisik</Text>
                </Button>
              ) : null
            )}

            {/* 3. Pembayaran Ritel Tunai (Flow 2: Bayar di Muka sebelum Kirim) */}
            {isRetailCash && (
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

            {/* 4. Pembayaran Ritel Tempo / Pelunasan Hutang (Flow 3) */}
            {isDebt && (
              isPaid ? (
                <View className="bg-emerald-500/15 border border-emerald-500/30 rounded-md px-3 py-1.5 flex-row items-center gap-1.5">
                  <CheckCircle2 size={15} color="#10b981" />
                  <Text className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    ✓ Hutang Telah Dilunasi (Lunas)
                  </Text>
                </View>
              ) : isFinance && !isDitolak ? (
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onPress={() => setPayModalOpen(true)}
                  disabled={loading}
                >
                  <DollarSign size={14} color="#fff" />
                  <Text className="text-xs font-semibold text-white">Unggah Bukti Bayar & Pelunasan Hutang</Text>
                </Button>
              ) : null
            )}

            {/* 5. Serahkan / Kirim Barang */}
            {isDispatched ? (
              <View className="bg-indigo-500/15 border border-indigo-500/30 rounded-md px-3 py-1.5 flex-row items-center gap-1.5">
                <Truck size={15} color="#6366f1" />
                <Text className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                  {isStockTake ? "✓ Barang Telah Diserahkan" : "✓ Pengadaan Sedang Dikirim"}
                </Text>
              </View>
            ) : !isDitolak ? (
              // Stock take: Gudang serahkan barang bila sudah approved
              (isStockTake && isApproved && isGudang) ? (
                <Button
                  size="sm"
                  onPress={() => setConfirmSendOpen(true)}
                  disabled={loading}
                >
                  <Truck size={14} color="#fff" />
                  <Text className="text-xs font-semibold">Serahkan Barang ke Proyek</Text>
                </Button>
              ) : // Retail Cash: Procurement kirim barang bila sudah dibayar
              (isRetailCash && isPaid && (isProcurement || isGudang)) ? (
                <Button
                  size="sm"
                  onPress={() => setConfirmSendOpen(true)}
                  disabled={loading}
                >
                  <Truck size={14} color="#fff" />
                  <Text className="text-xs font-semibold">Tandai Barang Dikirim (Auto Penerimaan)</Text>
                </Button>
              ) : // Retail Debt: Procurement kirim barang segera setelah approved (bayar tempo belakangan)
              (isRetailDebt && isApproved && (isProcurement || isGudang)) ? (
                <Button
                  size="sm"
                  onPress={() => setConfirmSendOpen(true)}
                  disabled={loading}
                >
                  <Truck size={14} color="#fff" />
                  <Text className="text-xs font-semibold">Tandai Barang Dikirim (Auto Penerimaan)</Text>
                </Button>
              ) : // Supplier PO: Tandai barang dikirim setelah PO dibuat / disetujui
              (isSupplierPo && (isPoDibuat || isApproved)) ? (
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
            {!isStockTake && !linkedPo && !isPoDibuat && !isDitolak && isApproved && (
              <Button size="sm" className="bg-primary hover:bg-primary/90" onPress={handleOpenCreatePo} disabled={loading}>
                <Plus size={14} color="#fff" />
                <Text className="text-xs font-semibold text-white">
                  Buat PO Supplier
                </Text>
              </Button>
            )}

            {/* 7. Tolak Request */}
            {isDitolak ? (
              <View className="bg-destructive/15 border border-destructive/30 rounded-md px-3 py-1.5 flex-row items-center gap-1.5">
                <XCircle size={15} color={colors.danger} />
                <Text className="text-xs font-semibold text-destructive">
                  ✗ Request Telah Ditolak
                </Text>
              </View>
            ) : !isDiterima && !isDispatched && !isPoDibuat ? (
              <Button
                variant="destructive"
                size="sm"
                onPress={() => setRejectOpen(true)}
                disabled={loading}
              >
                <XCircle size={14} color="#fff" />
                <Text className="text-xs font-semibold">Tolak Request</Text>
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
                ? "Status PO Supplier dan Request Barang akan berubah menjadi 'Dikirim'. Tim Gudang dapat bersiap mengecek fisik saat barang tiba."
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
            <FormField label="Dokumen Surat Jalan / Delivery Order (DO) / Foto Nota" hint="Lampirkan foto surat jalan DO atau bukti serah terima (opsional)">
              <FileUploader
                label="Unggah Dokumen DO / Nota"
                kind="dokumen"
                autoFlush={true}
                onUploaded={(id) => setDoFileId(id)}
              />
            </FormField>
          </View>
          <DialogFooter className="gap-2">
            <Button variant="outline" onPress={() => setConfirmReceiveOpen(false)} disabled={loading}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleConfirmReceive} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
              <PackageCheck size={14} color="#fff" />
              <Text className="text-white font-semibold">{loading ? "Memproses..." : "Ya, Barang Sudah Diterima"}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Unggah Bukti Bayar & Tandai Dibayar oleh Finance */}
      <Dialog open={payModalOpen} onOpenChange={setPayModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isRetailDebt ? "Pelunasan Hutang Pembelian Ritel" : "Pembayaran Kas / Tunai Pembelian Ritel"}
            </DialogTitle>
            <DialogDescription>
              {isRetailDebt
                ? "Silakan unggah bukti transfer/pelunasan nota toko. Pelunasan hutang ini akan dicatat di jurnal akuntansi (Debit: 210102 Hutang Usaha, Kredit: 1000.01 Kas/Bank)."
                : `Silakan unggah bukti transfer/struk pembayaran kas untuk menandai bahwa pembelian ini telah dibayar. Transaksi akan langsung tercatat di jurnal akuntansi (Kas Keluar: Kredit 1000.01 Kas, Debit ${isProject ? "5101 HPP Project" : "1200 Persediaan"}).`}
            </DialogDescription>
          </DialogHeader>
          <View className="py-2 gap-3">
            <FormField label="Pilih Sumber Dana (Akun Kas / Bank)" required hint="Akun kas/bank yang akan dikreditkan pada jurnal pengeluaran">
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

            <FormField label="Bukti Pembayaran / Struk Kas / Transfer" hint="Wajib dilampirkan sebagai bukti sah pencatatan kas keluar">
              <FileUploader
                label="Unggah Bukti Bayar"
                kind="dokumen"
                autoFlush={true}
                onUploaded={(id) => setPaymentProofFileId(id)}
              />
            </FormField>
          </View>
          <DialogFooter className="gap-2">
            <Button variant="outline" onPress={() => setPayModalOpen(false)} disabled={loading}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleMarkPaid} disabled={loading || !paymentProofFileId} className="bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 size={14} color="#fff" />
              <Text className="text-white font-semibold">{loading ? "Memproses..." : "Konfirmasi Pembayaran"}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Tolak Request */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tolak Request Barang</DialogTitle>
            <DialogDescription>
              Masukkan alasan penolakan agar pemohon dapat mengetahui kendala (misal: stok kosong, anggaran tidak disetujui, dll).
            </DialogDescription>
          </DialogHeader>
          <View className="py-2">
            <Textarea
              placeholder="Contoh: Stok barang kosong di seluruh gudang / perlu PO baru..."
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
              <Text className="text-white font-semibold">{loading ? "Memproses..." : "Tolak Request"}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Buat PO Supplier dari Request Barang */}
      <Dialog open={createPoOpen} onOpenChange={setCreatePoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Buat Purchase Order (PO) Supplier</DialogTitle>
            <DialogDescription>
              Relasi PO ke request {row.nomor} dan proyek akan otomatis terhubung secara permanen.
            </DialogDescription>
          </DialogHeader>

          <View className="py-2 gap-3">
            {/* Info Relasi Otomatis */}
            <View className="bg-panel/60 border border-border/80 rounded-xl p-3 gap-1">
              <View className="flex-row justify-between items-center">
                <Text className="text-xs text-muted-foreground">Request Asal:</Text>
                <Text className="text-xs font-semibold text-primary">{row.nomor}</Text>
              </View>
              <View className="flex-row justify-between items-center">
                <Text className="text-xs text-muted-foreground">Proyek / Alokasi:</Text>
                <Text className="text-xs font-semibold text-foreground">{row.project || "Stok Gudang"}</Text>
              </View>
              <View className="flex-row justify-between items-center">
                <Text className="text-xs text-muted-foreground">Barang Diminta:</Text>
                <Text className="text-xs font-semibold text-foreground flex-1 text-right ml-2" numberOfLines={1}>{row.item || row.tujuan || "-"}</Text>
              </View>
            </View>

            <FormField label="Pilih Supplier" required hint="Pemasok / vendor tujuan pemesanan">
              <SearchableSelect
                value={
                  (data.suppliers ?? []).find((s: Row) => String(s.id) === String(poSupplierId))?.nama ??
                  (data.suppliers ?? []).find((s: Row) => String(s.id) === String(poSupplierId))?.name ??
                  row.supplier ??
                  ""
                }
                options={(data.suppliers ?? []).map((s: Row) => s.nama ?? s.name ?? `Supplier #${s.id}`)}
                onChange={(val) => {
                  const found = (data.suppliers ?? []).find((s: Row) => (s.nama || s.name) === val);
                  if (found) setPoSupplierId(String(found.id));
                }}
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
                onChangeText={setPoTotal}
                keyboardType="numeric"
                placeholder="Contoh: 10000000"
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
    </>
  );
}
