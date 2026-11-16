import * as React from "react";
import { View, ScrollView, Pressable } from "react-native";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Lock,
  Package,
  PenLine,
  Plus,
  Receipt,
  RotateCcw,
  ShoppingCart,
  Trash2,
} from "lucide-react-native";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/taska/basics";
import {
  CustomerSelect,
  SearchableSelect,
  DatePicker,
  QuickAddCustomerDialog,
  formatThousands,
  ProductSelect,
  QuotationSelect,
  ProjectSelect,
} from "@/components/taska/dialogs";
import { FileUploader, type FileUploaderHandle } from "@/components/taska/file-uploader";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { rupiah } from "@/lib/format";
import {
  PPH_MODE_OPTIONS,
  calcItemPph,
  calcQuotationFinancials,
  distributeDiscountToPrices,
  pphModeToTipe,
  sumItemGross,
  type PphMode,
} from "@/modules/quotation/lib";
import { useKasBankAccounts } from "@/lib/use-kas-bank";
import type { Row } from "@/constants/modules";

export interface SoItemEntry {
  id: string;
  productId?: string;
  name: string;
  sku?: string;
  unit: string;
  hasSerial: boolean;
  qty: number;
  /** Qty di penawaran (batas atas bila SO dibuat dari penawaran). */
  maxQty?: number;
  price: number;
  itemType?: "JASA" | "BARANG";
  isNonInventory?: boolean;
  pphMode?: PphMode;
  tipePph?: string;
  /** SN yang sudah dipesan di penawaran (dibawa ke SO). */
  serialNumbers?: string[];
  serialUnitIds?: number[];
  /** Berasal dari penawaran -> harga dikunci. */
  fromQuotation?: boolean;
}

type PpnMode = "none" | "exclude" | "include";

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const plusDaysIso = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const toNum = (v: string) => Number(String(v).replace(/\D/g, "")) || 0;

/** Penawaran yang masih bisa dijadikan SO (bukan ditolak / kedaluwarsa / draf). */
const QUOTATION_OPEN = (q: Row) => {
  const st = String(q.status || "").toLowerCase();
  return !["ditolak", "kedaluwarsa", "draft"].includes(st);
};

const PPN_LABEL: Record<PpnMode, string> = {
  none: "Non PPN",
  exclude: "PPN 11% (ditambahkan)",
  include: "PPN 11% (sudah termasuk)",
};

/**
 * Ubah item penawaran -> item SO. Nama barang di penawaran ada di field `item` (bukan `nama`),
 * jasa ditandai `kind: "SERVICE"`. Diskon penawaran dibagi proporsional ke harga agar total SO = total penawaran.
 */
function itemsFromQuotation(q: Row): { items: SoItemEntry[]; discount: number } {
  const raw: any[] = Array.isArray(q.items) ? q.items : [];
  const discount = Math.min(sumItemGross(raw), Math.max(0, Number(q.discount ?? q.disc ?? 0)));
  // Harga net per baris: diskon item + diskon tambahan sudah dibagi ke harga (rumus bersama).
  const netPrices = distributeDiscountToPrices(raw, discount).map((it) => it.price);

  const items: SoItemEntry[] = raw.map((it, idx) => {
    const isJasa = it.kind === "SERVICE" || /^\[JASA\]/i.test(String(it.item || ""));
    const pphMode: PphMode = (it.pphMode as PphMode) || "none";
    const qty = Number(it.qty) || 1;
    return {
      id: `q-${q.id}-${idx}`,
      productId: it.productId != null ? String(it.productId) : undefined,
      name: String(it.item || it.nama || it.name || `Item ${idx + 1}`),
      sku: it.sku || undefined,
      unit: it.satuan || it.unit || (isJasa ? "paket" : "unit"),
      hasSerial: Boolean(it.hasSerial),
      qty,
      maxQty: qty,
      price: netPrices[idx] ?? 0,
      itemType: isJasa ? "JASA" : "BARANG",
      isNonInventory: isJasa || it.productId == null,
      pphMode,
      tipePph: it.tipePph || pphModeToTipe(pphMode),
      serialNumbers: Array.isArray(it.serialNumbers) ? it.serialNumbers : undefined,
      serialUnitIds: Array.isArray(it.serialUnitIds) ? it.serialUnitIds : undefined,
      fromQuotation: true,
    };
  });

  return { items, discount };
}

export function CreateSalesOrderDialog({
  open,
  onOpenChange,
  onSuccess,
  initialQuotationId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  initialQuotationId?: string | number;
}) {
  if (!open) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <CreateSalesOrderForm
        onClose={() => onOpenChange(false)}
        onSuccess={onSuccess}
        initialQuotationId={initialQuotationId}
      />
    </Dialog>
  );
}

function SectionTitle({ n, title, icon }: { n: number; title: string; icon: React.ReactNode }) {
  return (
    <View className="flex-row items-center gap-2">
      <View className="size-6 rounded-full bg-primary items-center justify-center">
        <Text className="text-[11px] font-bold text-primary-foreground">{n}</Text>
      </View>
      {icon}
      <Text className="text-sm font-bold text-foreground">{title}</Text>
    </View>
  );
}

function CreateSalesOrderForm({
  onClose,
  onSuccess,
  initialQuotationId,
}: {
  onClose: () => void;
  onSuccess?: () => void;
  initialQuotationId?: string | number;
}) {
  const { data, addRow, reload, toast, pushHistory, refreshModule } = useApp();
  const kasBankOptions = useKasBankAccounts();

  // ── Sumber SO ──
  const [source, setSource] = React.useState<"quotation" | "manual">("quotation");
  const [quotationId, setQuotationId] = React.useState<string>(initialQuotationId ? String(initialQuotationId) : "");
  const [quotationItems, setQuotationItems] = React.useState<SoItemEntry[]>([]);
  const [quotationDiscount, setQuotationDiscount] = React.useState(0);
  /** Isi penawaran asli (harga sebelum diskon) untuk menghitung angka yang persis sama dengan penawaran. */
  const [quotationSource, setQuotationSource] = React.useState<Row | null>(null);
  const [loadingQuotation, setLoadingQuotation] = React.useState(false);

  // ── Data SO ──
  const [customerId, setCustomerId] = React.useState("");
  const [customerName, setCustomerName] = React.useState("");
  const [quickCustomerOpen, setQuickCustomerOpen] = React.useState(false);
  const [projectId, setProjectId] = React.useState("");
  const [ppnMode, setPpnMode] = React.useState<PpnMode>("exclude");
  const [items, setItems] = React.useState<SoItemEntry[]>([]);

  const [nomorPoClient, setNomorPoClient] = React.useState("");
  const [tanggal, setTanggal] = React.useState(todayIso);
  const [eta, setEta] = React.useState(() => plusDaysIso(3));
  const [catatan, setCatatan] = React.useState("");
  const [manualNumberOpen, setManualNumberOpen] = React.useState(false);
  const [nomorSo, setNomorSo] = React.useState("");
  const [suggestedSoNumber, setSuggestedSoNumber] = React.useState("");
  const fileHandleRef = React.useRef<FileUploaderHandle | null>(null);

  // ── Tambah item manual ──
  const [adderOpen, setAdderOpen] = React.useState(false);
  const [itemMode, setItemMode] = React.useState<"master" | "custom">("master");
  const [selectedProductId, setSelectedProductId] = React.useState("");
  const [masterQty, setMasterQty] = React.useState("1");
  const [masterPrice, setMasterPrice] = React.useState("");
  const [customType, setCustomType] = React.useState<"JASA" | "NON_STOK">("JASA");
  const [customName, setCustomName] = React.useState("");
  const [customUnit, setCustomUnit] = React.useState("paket");
  const [customQty, setCustomQty] = React.useState("1");
  const [customPrice, setCustomPrice] = React.useState("");
  const [customPph, setCustomPph] = React.useState<PphMode>("pph23");

  // ── Pembayaran ──
  const [paymentFlow, setPaymentFlow] = React.useState<"REGULER" | "WALK_IN">("REGULER");
  const [walkinCoaAccount, setWalkinCoaAccount] = React.useState("1000.01");
  const walkinFileHandleRef = React.useRef<FileUploaderHandle | null>(null);

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    api<{ number?: string }>("GET", "/client-po/suggest-number")
      .then((res) => alive && res?.number && setSuggestedSoNumber(res.number))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const quotation: Row | null = React.useMemo(
    () => (quotationId ? (data.quotations ?? []).find((q: Row) => String(q.id) === String(quotationId)) ?? null : null),
    [data.quotations, quotationId],
  );

  /** SO lain yang sudah dibuat dari penawaran yang sama (cegah SO dobel). */
  const existingSos: Row[] = React.useMemo(
    () =>
      quotationId
        ? (data["po-client"] ?? []).filter(
            (so: Row) => String(so.quotationId) === String(quotationId) && !/batal/i.test(String(so.status || "")),
          )
        : [],
    [data, quotationId],
  );

  const applyQuotation = React.useCallback(
    async (q: Row) => {
      setLoadingQuotation(true);
      try {
        // Pastikan item lengkap (list kadang belum memuat item)
        let full: Row = q;
        if (!Array.isArray(q.items) || q.items.length === 0) {
          const res = await api<any>("GET", `/quotations/${q.id}`).catch(() => null);
          if (res && Array.isArray(res.items)) full = { ...q, items: res.items, discount: res.discount ?? q.discount };
        }
        const { items: qItems, discount } = itemsFromQuotation(full);
        setQuotationSource(full);
        setQuotationItems(qItems);
        setItems(qItems);
        setQuotationDiscount(discount);
        setPpnMode((q.ppnMode as PpnMode) || "exclude");
        setCustomerId(q.customerId ? String(q.customerId) : "");
        setCustomerName(q.customer && q.customer !== "-" ? String(q.customer) : "");
        const proj = (data.projects ?? []).find((p: Row) => String(p.quotationId) === String(q.id));
        setProjectId(proj ? String(proj.id) : "");
        if (!qItems.length) toast("Penawaran ini belum punya rincian barang. Tambahkan item secara manual.", "danger");
      } finally {
        setLoadingQuotation(false);
      }
    },
    [data.projects, toast],
  );

  // Penawaran awal (mis. dibuka dari halaman penawaran)
  const appliedInitial = React.useRef(false);
  React.useEffect(() => {
    if (appliedInitial.current || !quotation) return;
    appliedInitial.current = true;
    void applyQuotation(quotation);
  }, [quotation, applyQuotation]);

  function selectQuotation(q: Row | null) {
    if (!q) {
      setQuotationId("");
      setQuotationItems([]);
      setQuotationSource(null);
      setItems([]);
      setQuotationDiscount(0);
      setCustomerId("");
      setCustomerName("");
      setProjectId("");
      return;
    }
    appliedInitial.current = true;
    setQuotationId(String(q.id));
    void applyQuotation(q);
  }

  function switchSource(next: "quotation" | "manual") {
    if (next === source) return;
    setSource(next);
    setItems([]);
    setQuotationId("");
    setQuotationItems([]);
    setQuotationDiscount(0);
    setCustomerId("");
    setCustomerName("");
    setProjectId("");
    setPpnMode("exclude");
    setAdderOpen(next === "manual");
  }

  // ── Item ──
  const selectedProduct = React.useMemo(
    () => (selectedProductId ? (data.products ?? []).find((p: Row) => String(p.id) === selectedProductId) ?? null : null),
    [data.products, selectedProductId],
  );

  function stockOf(productId?: string): number | null {
    if (!productId) return null;
    const rows = (data.stockSummary ?? []).filter((s: any) => String(s.productId) === String(productId));
    if (!rows.length) return null;
    return rows.reduce((a: number, s: any) => a + Number(s.saldo ?? s.qty ?? s.stok ?? 0), 0);
  }

  function addMasterItem() {
    if (!selectedProduct) return toast("Pilih barang dari master dulu", "danger");
    const qty = toNum(masterQty);
    if (qty <= 0) return toast("Qty harus lebih dari 0", "danger");
    setItems((prev) => [
      ...prev,
      {
        id: `m-${Date.now()}`,
        productId: String(selectedProduct.id),
        name: selectedProduct.nama || selectedProduct.name || "Barang",
        sku: selectedProduct.sku || undefined,
        unit: selectedProduct.satuan || selectedProduct.unit || "unit",
        hasSerial: Boolean(selectedProduct.berSN ?? selectedProduct.hasSerial),
        qty,
        price: toNum(masterPrice),
        itemType: "BARANG",
        pphMode: "none",
        tipePph: "Tanpa PPh",
      },
    ]);
    setSelectedProductId("");
    setMasterQty("1");
    setMasterPrice("");
  }

  function addCustomItem() {
    const name = customName.trim();
    if (!name) return toast("Nama barang / jasa wajib diisi", "danger");
    const qty = toNum(customQty);
    if (qty <= 0) return toast("Qty harus lebih dari 0", "danger");
    const isJasa = customType === "JASA";
    const pph: PphMode = isJasa ? customPph : "none";
    setItems((prev) => [
      ...prev,
      {
        id: `c-${Date.now()}`,
        name,
        unit: customUnit.trim() || (isJasa ? "paket" : "unit"),
        hasSerial: false,
        qty,
        price: toNum(customPrice),
        itemType: isJasa ? "JASA" : "BARANG",
        isNonInventory: true,
        pphMode: pph,
        tipePph: pphModeToTipe(pph),
      },
    ]);
    setCustomName("");
    setCustomQty("1");
    setCustomPrice("");
  }

  function setQty(id: string, value: string) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        let qty = toNum(value);
        if (it.maxQty && qty > it.maxQty) qty = it.maxQty;
        return { ...it, qty };
      }),
    );
  }

  const itemsChanged =
    source === "quotation" &&
    (items.length !== quotationItems.length || items.some((it, i) => it.qty !== quotationItems[i]?.qty || it.id !== quotationItems[i]?.id));

  // ── Hitungan: rumus yang SAMA dengan penawaran (calcQuotationFinancials) ──
  // Selama item belum diubah, angka dihitung dari isi penawaran asli -> persis sama dengan penawaran.
  const fin =
    source === "quotation" && quotationSource && !itemsChanged
      ? calcQuotationFinancials(
          Number(quotationSource.total ?? quotationSource.nilai ?? 0),
          Number(quotationSource.discount ?? quotationSource.disc ?? 0),
          ppnMode,
          "none",
          Array.isArray(quotationSource.items) ? quotationSource.items : [],
        )
      : calcQuotationFinancials(
          items.reduce((s, it) => s + it.qty * it.price, 0),
          0,
          ppnMode,
          "none",
          items.map((it) => ({ qty: it.qty, harga: it.price, pphMode: it.pphMode })),
        );
  const dpp = fin.dpp;
  const ppnAmount = fin.ppn;
  const totalPph = fin.pph;
  /** Nilai SO = DPP + PPN. PPh dipotong customer saat membayar invoice, tidak mengurangi nilai SO. */
  const grandTotal = fin.totalAfterDisc;

  const lockedFromQuotation = source === "quotation" && !!quotation;
  const needsCustomerPick = lockedFromQuotation && !quotation?.customerId;
  const missing: string[] = [];
  if (source === "quotation" && !quotation) missing.push("pilih penawaran");
  if (!items.length || items.every((it) => it.qty <= 0)) missing.push("minimal 1 barang/jasa");
  if (paymentFlow === "REGULER" && !customerId) missing.push("customer");
  if (grandTotal <= 0 && items.length) missing.push("total lebih dari Rp 0");

  async function handleSubmit() {
    if (missing.length) {
      toast(`Lengkapi dulu: ${missing.join(", ")}`, "danger");
      return;
    }
    setIsSubmitting(true);
    try {
      let fileId: number | null = null;
      if (fileHandleRef.current?.hasStaged()) fileId = await fileHandleRef.current.flush();

      const lines = items.filter((it) => it.qty > 0);
      const itemsPayload = lines.map((it) => ({
        productId: it.productId ? Number(it.productId) : undefined,
        item: it.name,
        name: it.name,
        nama: it.name,
        customName: it.name,
        unit: it.unit,
        satuan: it.unit,
        customUnit: it.unit,
        qty: it.qty,
        price: it.price,
        harga: it.price,
        hasSerial: it.hasSerial,
        berSN: it.hasSerial,
        kind: it.itemType === "JASA" ? "SERVICE" : "GOODS",
        itemType: it.itemType ?? "BARANG",
        isNonInventory: it.isNonInventory ?? it.itemType === "JASA",
        pphMode: it.pphMode || "none",
        tipePph: it.tipePph || pphModeToTipe(it.pphMode || "none"),
        pph: calcItemPph(it),
        serialNumbers: it.serialNumbers,
        serialUnitIds: it.serialUnitIds,
      }));
      const firstPph = lines.find((it) => it.pphMode && it.pphMode !== "none");
      const number = (manualNumberOpen && nomorSo.trim()) || suggestedSoNumber || undefined;

      const created = await addRow("po-client", {
        nomor: number,
        nomorSo: number,
        nomorPoClient: nomorPoClient.trim() || undefined,
        docMode: "SO",
        customerId: customerId ? Number(customerId) : undefined,
        customer: customerName || undefined,
        quotationId: lockedFromQuotation ? Number(quotationId) : undefined,
        projectId: projectId ? Number(projectId) : undefined,
        tanggal,
        eta,
        nilai: dpp,
        ppn: ppnAmount,
        tipePpn: ppnMode === "none" ? "Non PPN" : ppnMode === "include" ? "PPN Included (11%)" : "Exclude PPN (11%)",
        ppnMode,
        pph: totalPph,
        tipePph: firstPph?.tipePph || "Tanpa PPh",
        pphMode: firstPph?.pphMode || "none",
        total: grandTotal,
        amount: grandTotal,
        catatan: catatan.trim() || undefined,
        notes: catatan.trim() || undefined,
        items: itemsPayload,
        fileId: fileId || undefined,
        paymentFlow,
      });
      if (!created) return;

      const soNo = created.nomor || number || "";
      if (paymentFlow === "WALK_IN" && created.id) {
        let proofId: number | null = null;
        if (walkinFileHandleRef.current?.hasStaged()) proofId = await walkinFileHandleRef.current.flush();
        await api("POST", `/client-po/${created.id}/direct-settlement`, {
          coaAccount: walkinCoaAccount,
          fileId: proofId || fileId || undefined,
          notes: `Penjualan langsung lunas SO ${soNo}`,
        }).catch((e) => toast(e?.message || "SO tersimpan, tapi pelunasan langsung gagal dicatat", "danger"));
        toast(`Sales Order ${soNo} tersimpan & langsung lunas`);
      } else {
        toast(`Sales Order ${soNo} berhasil diterbitkan`);
      }
      void pushHistory("po-client", String(created.id), `Sales Order ${soNo} diterbitkan senilai ${rupiah(grandTotal)} (${lines.length} item)`);
      void refreshModule("po-client");
      void refreshModule("quotations");
      if (paymentFlow === "WALK_IN") void refreshModule("invoices");
      void reload();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast(err?.message || "Gagal menerbitkan Sales Order", "danger");
    } finally {
      setIsSubmitting(false);
    }
  }

  const step = { source: 1, items: 2, detail: 3, pay: 4 };

  return (
    <DialogContent className="w-[96vw] sm:max-w-xl md:max-w-2xl lg:max-w-3xl p-0 overflow-hidden">
      <DialogHeader className="px-4 sm:px-5 py-3.5 border-b border-border bg-panel/60">
        <View className="flex-row items-center gap-2">
          <FileCheck size={18} color={colors.primary} />
          <DialogTitle className="text-base font-bold">Terbitkan Sales Order</DialogTitle>
        </View>
        <Text className="text-xs text-muted-foreground mt-0.5">
          Pilih penawaran yang disetujui customer — barang, harga, customer & pajak terisi otomatis.
        </Text>
      </DialogHeader>

      <ScrollView style={{ maxHeight: 620 }} contentContainerClassName="p-4 sm:p-5 gap-4">
        {/* ── 1. Sumber ── */}
        <View className="gap-3">
          <SectionTitle n={step.source} title="Dasar Sales Order" icon={<FileSpreadsheet size={15} color={colors.primary} />} />
          <View className="flex-row gap-2">
            {(
              [
                { v: "quotation", t: "Dari Penawaran", d: "Disarankan · semua data otomatis", I: FileSpreadsheet },
                { v: "manual", t: "Tanpa Penawaran", d: "Penjualan langsung / isi manual", I: PenLine },
              ] as const
            ).map((o) => {
              const active = source === o.v;
              return (
                <Pressable
                  key={o.v}
                  onPress={() => switchSource(o.v)}
                  className={`flex-1 rounded-xl border p-3 gap-1 ${active ? "bg-primary/10 border-primary" : "bg-card border-border"}`}
                >
                  <View className="flex-row items-center gap-1.5">
                    <o.I size={14} color={active ? colors.primary : colors.muted} />
                    <Text className={`text-sm font-bold ${active ? "text-primary" : "text-foreground"}`}>{o.t}</Text>
                  </View>
                  <Text className="text-[11px] text-muted-foreground">{o.d}</Text>
                </Pressable>
              );
            })}
          </View>

          {source === "quotation" ? (
            <View className="gap-2">
              <QuotationSelect
                quotationId={quotationId}
                allowClear
                filter={QUOTATION_OPEN}
                onChange={selectQuotation}
                placeholder="Cari nomor penawaran / nama customer..."
              />
              {loadingQuotation ? <Text className="text-xs text-muted-foreground">Memuat isi penawaran...</Text> : null}

              {quotation ? (
                <View className="rounded-xl border border-border bg-panel/60 p-3 gap-1.5">
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className="text-sm font-bold text-foreground">{quotation.nomor}</Text>
                    <Text className="text-[11px] font-semibold text-primary">{quotation.status}</Text>
                  </View>
                  <View className="flex-row flex-wrap gap-x-4 gap-y-1">
                    <Text className="text-xs text-muted-foreground">
                      Customer: <Text className="text-xs font-semibold text-foreground">{quotation.customer || quotation.lead || "-"}</Text>
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      Pajak: <Text className="text-xs font-semibold text-foreground">{PPN_LABEL[ppnMode]}</Text>
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      Nilai: <Text className="text-xs font-semibold text-foreground">{rupiah(Number(quotation.totalAfterDisc || 0))}</Text>
                      {!itemsChanged && quotationSource && Math.abs(Number(quotation.totalAfterDisc || 0) - grandTotal) <= 1 ? (
                        <Text className="text-[11px] text-success"> ✓ sama dengan SO</Text>
                      ) : null}
                    </Text>
                  </View>
                  {quotationDiscount > 0 ? (
                    <Text className="text-[11px] text-muted-foreground">
                      Diskon penawaran {rupiah(quotationDiscount)} sudah dibagi ke harga barang, jadi total SO sama dengan penawaran.
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {existingSos.length ? (
                <View className="flex-row items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                  <AlertTriangle size={16} color={colors.warning} />
                  <Text className="text-xs text-amber-800 dark:text-amber-300 flex-1">
                    Penawaran ini sudah punya Sales Order {existingSos.map((s) => s.nomor).join(", ")}. Lanjutkan hanya bila memang
                    pesanan terpisah (mis. pengiriman bertahap) — kurangi qty agar tidak dobel.
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Customer: otomatis dari penawaran; dipilih manual hanya bila perlu */}
          {source === "manual" || needsCustomerPick ? (
            <FormField
              label={paymentFlow === "WALK_IN" ? "Customer (opsional untuk penjualan langsung)" : "Customer"}
              required={paymentFlow === "REGULER"}
              hint={needsCustomerPick ? `Penawaran masih atas nama lead "${quotation?.lead || "-"}". Pilih / tambahkan customer-nya.` : undefined}
            >
              <CustomerSelect
                value={customerName}
                customerId={customerId}
                onChange={(c) => {
                  setCustomerName(c ? c.company || c.nama || c.name || "" : "");
                  setCustomerId(c ? String(c.id) : "");
                }}
                onAddNew={() => setQuickCustomerOpen(true)}
                addNewLabel="+ Tambah customer baru"
                placeholder="Pilih customer..."
                allowClear
              />
            </FormField>
          ) : null}
        </View>

        {/* ── 2. Barang & Jasa ── */}
        {source === "manual" || quotation ? (
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <SectionTitle n={step.items} title="Barang & Jasa" icon={<ShoppingCart size={15} color={colors.primary} />} />
              {itemsChanged ? (
                <Pressable onPress={() => setItems(quotationItems)} className="flex-row items-center gap-1">
                  <RotateCcw size={12} color={colors.primary} />
                  <Text className="text-xs font-semibold text-primary">Kembalikan sesuai penawaran</Text>
                </Pressable>
              ) : null}
            </View>
            {lockedFromQuotation ? (
              <View className="flex-row items-center gap-1.5">
                <Lock size={12} color={colors.muted} />
                <Text className="text-[11px] text-muted-foreground flex-1">
                  Harga dikunci sesuai penawaran. Qty boleh dikurangi untuk pesanan sebagian; item bisa dihapus.
                </Text>
              </View>
            ) : null}

            {items.length === 0 ? (
              <View className="p-5 rounded-xl border border-dashed border-border items-center gap-1">
                <Package size={22} color={colors.muted} />
                <Text className="text-xs text-muted-foreground text-center">Belum ada barang. Tambahkan lewat tombol di bawah.</Text>
              </View>
            ) : (
              <View className="rounded-xl border border-border overflow-hidden">
                {items.map((it, idx) => {
                  const stock = it.itemType !== "JASA" ? stockOf(it.productId) : null;
                  const short = stock != null && stock < it.qty;
                  return (
                    <View
                      key={it.id}
                      className={`flex-row items-center gap-3 px-3 py-2.5 ${idx > 0 ? "border-t border-border/70" : ""} ${it.qty === 0 ? "opacity-50" : ""}`}
                    >
                      <View className="flex-1 min-w-0 gap-0.5">
                        <Text className="text-sm font-semibold text-foreground" numberOfLines={2}>
                          {it.name}
                        </Text>
                        <View className="flex-row flex-wrap items-center gap-1.5">
                          <Text className="text-[11px] text-muted-foreground">
                            {rupiah(it.price)} / {it.unit}
                          </Text>
                          {it.itemType === "JASA" ? (
                            <Text className="text-[10px] font-semibold px-1.5 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400">Jasa</Text>
                          ) : null}
                          {it.pphMode && it.pphMode !== "none" ? (
                            <Text className="text-[10px] font-semibold px-1.5 rounded bg-danger/15 text-danger">{it.tipePph}</Text>
                          ) : null}
                          {it.serialNumbers?.length ? (
                            <Text className="text-[10px] font-semibold px-1.5 rounded bg-info/15 text-info">
                              SN dipesan: {it.serialNumbers.length}
                            </Text>
                          ) : null}
                          {short ? (
                            <Text className="text-[10px] font-semibold px-1.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400">
                              Stok gudang {stock}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      <View className="items-center">
                        <Input
                          value={String(it.qty)}
                          onChangeText={(v) => setQty(it.id, v)}
                          keyboardType="numeric"
                          className="w-16 h-9 text-center"
                        />
                        <Text className="text-[10px] text-muted-foreground mt-0.5">
                          {it.maxQty ? `maks ${it.maxQty}` : it.unit}
                        </Text>
                      </View>
                      <Text className="w-24 text-right text-sm font-bold font-mono text-foreground">{rupiah(it.qty * it.price)}</Text>
                      <Pressable
                        onPress={() => setItems((prev) => prev.filter((x) => x.id !== it.id))}
                        className="size-7 rounded-md bg-danger/10 items-center justify-center"
                      >
                        <Trash2 size={13} color={colors.danger} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Tambah item manual — terbuka otomatis untuk SO tanpa penawaran */}
            <Pressable onPress={() => setAdderOpen((v) => !v)} className="flex-row items-center gap-1.5 self-start">
              {adderOpen ? <ChevronUp size={14} color={colors.primary} /> : <Plus size={14} color={colors.primary} />}
              <Text className="text-xs font-semibold text-primary">
                {adderOpen ? "Tutup form tambah barang" : lockedFromQuotation ? "Tambah item di luar penawaran" : "Tambah barang / jasa"}
              </Text>
            </Pressable>

            {adderOpen ? (
              <View className="p-3 rounded-xl bg-panel border border-border gap-3">
                <View className="flex-row gap-2">
                  {(
                    [
                      { v: "master", t: "Barang dari master stok", I: Package },
                      { v: "custom", t: "Jasa / barang non-stok", I: Plus },
                    ] as const
                  ).map((o) => (
                    <Button key={o.v} size="sm" variant={itemMode === o.v ? "default" : "outline"} onPress={() => setItemMode(o.v)} className="h-8 px-3">
                      <o.I size={13} color={itemMode === o.v ? colors.background : colors.text} />
                      <Text className="text-xs">{o.t}</Text>
                    </Button>
                  ))}
                </View>

                {itemMode === "master" ? (
                  <View className="gap-2.5">
                    <ProductSelect
                      productId={selectedProductId}
                      onChange={(p) => {
                        setSelectedProductId(p ? String(p.id) : "");
                        const sell = Number(p?.hargaJual ?? p?.price ?? 0);
                        setMasterPrice(sell > 0 ? formatThousands(sell) : "");
                      }}
                      placeholder="Cari barang di master stok..."
                    />
                    <View className="flex-row gap-2 items-end">
                      <View className="w-20">
                        <FormField label="Qty">
                          <Input value={masterQty} onChangeText={(v) => setMasterQty(formatThousands(v))} keyboardType="numeric" />
                        </FormField>
                      </View>
                      <View className="flex-1">
                        <FormField label="Harga jual / satuan">
                          <Input value={masterPrice} onChangeText={(v) => setMasterPrice(formatThousands(v))} keyboardType="numeric" placeholder="0" />
                        </FormField>
                      </View>
                      <Button onPress={addMasterItem} className="h-11 px-4">
                        <Plus size={14} color={colors.background} />
                        <Text className="text-xs font-semibold">Tambah</Text>
                      </Button>
                    </View>
                  </View>
                ) : (
                  <View className="gap-2.5">
                    <View className="flex-row gap-2">
                      {(
                        [
                          { v: "JASA", t: "Jasa / pekerjaan" },
                          { v: "NON_STOK", t: "Barang non-stok" },
                        ] as const
                      ).map((o) => (
                        <Pressable
                          key={o.v}
                          onPress={() => {
                            setCustomType(o.v);
                            setCustomUnit(o.v === "JASA" ? "paket" : "unit");
                          }}
                          className={`px-3 py-1.5 rounded-full border ${customType === o.v ? "bg-primary/10 border-primary" : "border-border"}`}
                        >
                          <Text className={`text-xs ${customType === o.v ? "text-primary font-semibold" : "text-foreground"}`}>{o.t}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Input
                      value={customName}
                      onChangeText={setCustomName}
                      placeholder={customType === "JASA" ? "Contoh: Jasa instalasi & setting CCTV" : "Contoh: Kabel UTP patch cord 2m"}
                    />
                    <View className="flex-row gap-2 items-end">
                      <View className="w-20">
                        <FormField label="Qty">
                          <Input value={customQty} onChangeText={(v) => setCustomQty(formatThousands(v))} keyboardType="numeric" />
                        </FormField>
                      </View>
                      <View className="w-24">
                        <FormField label="Satuan">
                          <Input value={customUnit} onChangeText={setCustomUnit} />
                        </FormField>
                      </View>
                      <View className="flex-1">
                        <FormField label="Harga / satuan">
                          <Input value={customPrice} onChangeText={(v) => setCustomPrice(formatThousands(v))} keyboardType="numeric" placeholder="0" />
                        </FormField>
                      </View>
                    </View>
                    {customType === "JASA" ? (
                      <View className="flex-row flex-wrap items-center gap-1.5">
                        <Text className="text-xs text-muted-foreground mr-1">PPh dipotong customer:</Text>
                        {PPH_MODE_OPTIONS.map((o) => (
                          <Pressable
                            key={o.id}
                            onPress={() => setCustomPph(o.id)}
                            className={`px-2.5 py-1 rounded-full border ${customPph === o.id ? "bg-primary/10 border-primary" : "border-border"}`}
                          >
                            <Text className={`text-[11px] ${customPph === o.id ? "text-primary font-semibold" : "text-foreground"}`}>{o.label}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                    <Button onPress={addCustomItem} className="h-10 px-4 self-start">
                      <Plus size={14} color={colors.background} />
                      <Text className="text-xs font-semibold">Tambah ke SO</Text>
                    </Button>
                  </View>
                )}
              </View>
            ) : null}

            {/* Ringkasan nilai */}
            <View className="rounded-xl border border-border bg-card p-3 gap-1.5">
              {source === "manual" ? (
                <View className="flex-row flex-wrap items-center gap-1.5 pb-1.5 mb-0.5 border-b border-border/60">
                  <Text className="text-xs text-muted-foreground mr-1">Pajak:</Text>
                  {(Object.keys(PPN_LABEL) as PpnMode[]).map((m) => (
                    <Pressable
                      key={m}
                      onPress={() => setPpnMode(m)}
                      className={`px-2.5 py-1 rounded-full border ${ppnMode === m ? "bg-primary/10 border-primary" : "border-border"}`}
                    >
                      <Text className={`text-[11px] ${ppnMode === m ? "text-primary font-semibold" : "text-foreground"}`}>{PPN_LABEL[m]}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted-foreground">DPP</Text>
                <Text className="text-xs font-mono">{rupiah(dpp)}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted-foreground">{PPN_LABEL[ppnMode]}</Text>
                <Text className="text-xs font-mono">{rupiah(ppnAmount)}</Text>
              </View>
              <View className="flex-row justify-between items-center pt-1.5 border-t border-border/60">
                <Text className="text-sm font-bold">Total SO</Text>
                <Text className="text-base font-bold font-mono text-primary">{rupiah(grandTotal)}</Text>
              </View>
              {totalPph > 0 ? (
                <View className="pt-1.5 mt-0.5 border-t border-dashed border-border/60 gap-1">
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-muted-foreground">PPh dipotong customer saat bayar</Text>
                    <Text className="text-xs font-mono text-muted-foreground">{rupiah(totalPph)}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-muted-foreground">Estimasi transfer dari customer</Text>
                    <Text className="text-xs font-mono font-semibold">{rupiah(fin.netReceived)}</Text>
                  </View>
                  <Text className="text-[10px] text-muted-foreground">
                    Customer menyerahkan bukti potong PPh; Finance mencatatnya saat pelunasan invoice.
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* ── 3. Detail SO ── */}
        {source === "manual" || quotation ? (
          <View className="gap-3">
            <SectionTitle n={step.detail} title="Detail Pesanan" icon={<Building2 size={15} color={colors.primary} />} />
            <View className="flex-col sm:flex-row gap-3">
              <View className="flex-1">
                <FormField label="No. PO dari customer" hint="Isi bila customer mengirim PO resmi">
                  <Input value={nomorPoClient} onChangeText={setNomorPoClient} placeholder="Contoh: PO-CUST/102/2026" />
                </FormField>
              </View>
              <View className="flex-1">
                <FormField label="Proyek" hint={lockedFromQuotation && projectId ? "Otomatis dari penawaran" : "Opsional"}>
                  <ProjectSelect projectId={projectId} allowClear onChange={(p) => setProjectId(p ? String(p.id) : "")} placeholder="Tanpa proyek" />
                </FormField>
              </View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <FormField label="Tanggal SO" required>
                  <DatePicker value={tanggal} onChange={setTanggal} />
                </FormField>
              </View>
              <View className="flex-1">
                <FormField label="Perkiraan kirim">
                  <DatePicker value={eta} onChange={setEta} />
                </FormField>
              </View>
            </View>
            <FormField label="Dokumen PO / SPK customer" hint="Opsional · PDF / foto">
              <FileUploader
                handleRef={(h) => (fileHandleRef.current = h)}
                category="po-client"
                kind="dokumen"
                label="Unggah dokumen"
                allowedExtensions={["pdf", "png", "jpg", "jpeg"]}
              />
            </FormField>
            <FormField label="Catatan" hint="Opsional · instruksi kirim, termin, garansi">
              <Input value={catatan} onChangeText={setCatatan} placeholder="Contoh: kirim bertahap, garansi 1 tahun" />
            </FormField>
            <Pressable onPress={() => setManualNumberOpen((v) => !v)} className="flex-row items-center gap-1 self-start">
              {manualNumberOpen ? <ChevronUp size={12} color={colors.muted} /> : <ChevronDown size={12} color={colors.muted} />}
              <Text className="text-[11px] text-muted-foreground">
                Nomor SO: <Text className="text-[11px] font-semibold text-foreground">{(manualNumberOpen && nomorSo) || suggestedSoNumber || "otomatis"}</Text>
                {manualNumberOpen ? "" : " · ubah"}
              </Text>
            </Pressable>
            {manualNumberOpen ? (
              <Input value={nomorSo} onChangeText={setNomorSo} placeholder={suggestedSoNumber || "SO/2026/11/001"} />
            ) : null}
          </View>
        ) : null}

        {/* ── 4. Pembayaran ── */}
        {source === "manual" || quotation ? (
          <View className="gap-3">
            <SectionTitle n={step.pay} title="Pembayaran" icon={<Receipt size={15} color={colors.primary} />} />
            <View className="flex-row gap-2">
              {(
                [
                  { v: "REGULER", t: "Ditagih lewat faktur", d: "Tempo / DP / termin" },
                  { v: "WALK_IN", t: "Langsung lunas", d: "Bayar di tempat, faktur lunas otomatis" },
                ] as const
              ).map((o) => {
                const active = paymentFlow === o.v;
                return (
                  <Pressable
                    key={o.v}
                    onPress={() => setPaymentFlow(o.v)}
                    className={`flex-1 rounded-xl border p-3 ${active ? "bg-primary/10 border-primary" : "bg-card border-border"}`}
                  >
                    <Text className={`text-sm font-bold ${active ? "text-primary" : "text-foreground"}`}>{o.t}</Text>
                    <Text className="text-[11px] text-muted-foreground">{o.d}</Text>
                  </Pressable>
                );
              })}
            </View>
            {paymentFlow === "WALK_IN" ? (
              <View className="gap-3 p-3 rounded-xl bg-panel border border-border">
                <FormField label="Uang masuk ke" required>
                  <SearchableSelect
                    value={kasBankOptions.find((a) => a.code === walkinCoaAccount)?.name || walkinCoaAccount}
                    options={kasBankOptions.map((a) => a.name)}
                    onChange={(lbl) => {
                      const m = kasBankOptions.find((a) => a.name === lbl);
                      if (m) setWalkinCoaAccount(m.code);
                    }}
                    placeholder="Pilih kas / bank"
                  />
                </FormField>
                <FormField label="Bukti bayar" hint="Opsional · struk / bukti transfer">
                  <FileUploader
                    handleRef={(h) => (walkinFileHandleRef.current = h)}
                    category="invoices"
                    kind="semua"
                    label="Unggah bukti"
                    allowedExtensions={["pdf", "png", "jpg", "jpeg"]}
                  />
                </FormField>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <DialogFooter className="px-4 sm:px-5 py-3 border-t border-border bg-panel/60 flex-row items-center justify-between gap-3">
        <View className="flex-1 min-w-0">
          {missing.length ? (
            <Text className="text-[11px] text-muted-foreground" numberOfLines={2}>
              Belum lengkap: {missing.join(", ")}
            </Text>
          ) : (
            <View className="flex-row items-center gap-1.5">
              <CheckCircle2 size={13} color={colors.success} />
              <Text className="text-[11px] text-muted-foreground">Siap diterbitkan</Text>
            </View>
          )}
        </View>
        <Button variant="outline" onPress={onClose} disabled={isSubmitting}>
          <Text className="text-xs">Batal</Text>
        </Button>
        <Button onPress={handleSubmit} disabled={isSubmitting || missing.length > 0} className="px-4">
          <FileText size={14} color={colors.background} />
          <Text className="text-xs font-semibold text-background">
            {isSubmitting ? "Menyimpan..." : `Terbitkan SO · ${rupiah(grandTotal)}`}
          </Text>
        </Button>
      </DialogFooter>

      <QuickAddCustomerDialog
        open={quickCustomerOpen}
        onOpenChange={setQuickCustomerOpen}
        onSuccess={(c) => {
          if (c?.id) {
            setCustomerId(String(c.id));
            setCustomerName(c.nama || c.name || "");
          }
        }}
      />
    </DialogContent>
  );
}
