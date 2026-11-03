import * as React from "react";
import { View, ScrollView, Platform, Pressable } from "react-native";
import { Upload, CheckCircle2, FileDown, Package, Trash2, Check } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FormField } from "@/components/taska/basics";
import { DatePicker, SearchableSelect, QuickAddCustomerDialog, QuickAddSupplierDialog } from "@/components/taska/dialogs";
import { StatusBadge } from "@/components/taska/status-badge";
import { SerialItemPickerModal } from "@/components/taska/serial-item-picker";
import { useApp } from "@/store/app-store";
import { api } from "@/services/api";
import { colors } from "@/tokens";
import { rupiah, formatThousands } from "@/lib/format";
import { type Row } from "@/constants/modules";
import { type QuotationItem } from "@/modules/quotation/types";
import { downloadQuotationTemplate, downloadQuotationPdf } from "@/modules/quotation/quotation-files";
import { QuotationPphField } from "@/modules/quotation/quotation-pph-field";
import { CHART_OF_ACCOUNTS, loadCustomCoa, loadDeletedCoaCodes } from "@/lib/accounting";
import {
  type PphMode,
  type PpnMode,
  PPN_MODE_OPTIONS,
  PPH_MODE_OPTIONS,
  getInitialPpnMode,
  ppnModeToTipe,
  pphRateFor,
  pphModeToTipe,
  calcItemPph,
} from "@/modules/quotation/lib";

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDefaultDueDateIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

function generateInvoiceNumber(
  isLanjut: boolean,
  currentScheme: "sekaligus" | "dp" | "termin",
  existingInvoices: Row[],
  totalInvoiceCount: number,
  allInvoices?: Row[],
): string {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");

  let maxSeq = 0;
  const prefix = `INV/${year}/${month}/`;
  for (const inv of (allInvoices || [])) {
    const num = String(inv.nomor || inv.number || "");
    if (num.startsWith(prefix)) {
      const parts = num.slice(prefix.length).split("/");
      const seq = parseInt(parts[0] ?? "", 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }
  const count = Math.max(maxSeq + 1, totalInvoiceCount + 1);
  const baseSeq = String(count).padStart(3, "0");

  if (isLanjut) {
    const nextTermNum = existingInvoices.length + 1;
    const lastInv = existingInvoices[existingInvoices.length - 1];
    if (lastInv?.nomor && lastInv.nomor.includes("/")) {
      const parts = lastInv.nomor.split("/");
      if (!isNaN(Number(parts[parts.length - 1]))) {
        parts[parts.length - 1] = String(nextTermNum);
        return parts.join("/");
      }
    }
    return `INV/${year}/${month}/${baseSeq}/${nextTermNum}`;
  }

  if (currentScheme === "dp" || currentScheme === "termin") {
    return `INV/${year}/${month}/${baseSeq}/1`;
  }
  return `INV/${year}/${month}/${baseSeq}`;
}

export function CreateInvoiceDialog({
  open,
  onOpenChange,
  initialQuotation,
  initialLead,
  initialPo,
  defaultDirectSale,
  defaultDirectPurchase,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuotation?: Row;
  initialLead?: Row;
  initialPo?: Row;
  defaultDirectSale?: boolean;
  defaultDirectPurchase?: boolean;
  onSuccess?: () => void;
}) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <CreateInvoiceForm
        key={`${open ? "open" : "closed"}-${initialPo?.id ?? "nopo"}-${initialQuotation?.id ?? "noq"}-${initialLead?.id ?? "nolead"}`}
        initialQuotation={initialQuotation}
        initialLead={initialLead}
        initialPo={initialPo}
        defaultDirectSale={defaultDirectSale}
        defaultDirectPurchase={defaultDirectPurchase}
        onClose={() => onOpenChange(false)}
        onSuccess={onSuccess}
      />
    </Dialog>
  );
}

type InvoiceSourceType = "direct_sale" | "direct_purchase" | "po" | "quotation" | "lead" | "customer";

function CreateInvoiceForm({
  initialQuotation,
  initialLead,
  initialPo,
  defaultDirectSale,
  defaultDirectPurchase,
  onClose,
  onSuccess,
}: {
  initialQuotation?: Row;
  initialLead?: Row;
  initialPo?: Row;
  defaultDirectSale?: boolean;
  defaultDirectPurchase?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { data, toast, reload, addRow, pushHistory } = useApp();

  const isInitialPoWalkin = React.useMemo(() => {
    if (!initialPo) return false;
    const cat = String(initialPo.catatan || "").toLowerCase();
    const cust = String(initialPo.customer || "").toLowerCase();
    return (
      cat.includes("walk-in") ||
      cat.includes("langsung") ||
      cust.includes("walk-in") ||
      cust.includes("langsung") ||
      (initialPo as any).paymentTerms === "WALK_IN"
    );
  }, [initialPo]);

  // Mode: "baru" vs "lanjut"
  const [mode, setMode] = React.useState<"baru" | "lanjut">(() => {
    if (initialPo) {
      const hasExisting = (data.invoices ?? []).some(
        (inv: Row) =>
          String(inv.clientPoId) === String(initialPo.id) ||
          (initialPo.nomor && (inv.po === initialPo.nomor || String(inv.catatan || "").includes(initialPo.nomor))) ||
          (initialPo.nomorSo && (inv.po === initialPo.nomorSo || String(inv.catatan || "").includes(initialPo.nomorSo))),
      );
      if (hasExisting) return "lanjut";
    }
    if (initialQuotation) {
      const hasExisting = (data.invoices ?? []).some(
        (inv: Row) =>
          String(inv.quotationId) === String(initialQuotation.id) ||
          inv.quotation === initialQuotation.nomor ||
          String(inv.catatan || "").includes(initialQuotation.nomor),
      );
      if (hasExisting) return "lanjut";
    }
    return "baru";
  });

  // Source selection: direct_sale, direct_purchase, quotation, po, lead, or customer
  const [sourceType, setSourceType] = React.useState<InvoiceSourceType>(() => {
    if (defaultDirectPurchase) return "direct_purchase";
    if (defaultDirectSale) return "direct_sale";
    if (initialPo) return "po";
    if (initialQuotation) return "quotation";
    if (initialLead) return "lead";
    return "po";
  });

  const [selectedQuotationId, setSelectedQuotationId] = React.useState<string>(() => {
    if (initialPo?.quotationId) return String(initialPo.quotationId);
    if (initialPo?.penawaran && initialPo.penawaran !== "-") {
      const match = (data.quotations ?? []).find((q: Row) => q.nomor === initialPo.penawaran);
      if (match) return String(match.id);
    }
    return initialQuotation?.id ? String(initialQuotation.id) : "";
  });
  const [selectedPoId, setSelectedPoId] = React.useState<string>(() =>
    initialPo?.id ? String(initialPo.id) : "",
  );
  const [selectedLeadId, setSelectedLeadId] = React.useState<string>(() =>
    initialLead?.id ? String(initialLead.id) : "",
  );

  // Supplier & PO Supplier state for direct_purchase
  const [selectedSupplierId, setSelectedSupplierId] = React.useState<string>("");
  const [selectedSupplierPoId, setSelectedSupplierPoId] = React.useState<string>("");
  const [customSupplierName, setCustomSupplierName] = React.useState<string>("");

  // Customer state
  const [customCustomerName, setCustomCustomerName] = React.useState<string>(() => {
    if (initialPo?.customer && initialPo.customer !== "-") return String(initialPo.customer);
    if (initialQuotation?.customer && initialQuotation.customer !== "-") return String(initialQuotation.customer);
    return "";
  });
  const [selectedCustomerId, setSelectedCustomerId] = React.useState<string>(() => {
    if (initialPo?.customerId) return String(initialPo.customerId);
    if (initialPo?.customer && initialPo.customer !== "-") {
      const match = (data.customers ?? []).find(
        (c: Row) =>
          c.nama?.toLowerCase() === String(initialPo.customer).toLowerCase() ||
          c.name?.toLowerCase() === String(initialPo.customer).toLowerCase(),
      );
      if (match) return String(match.id);
    }
    if (initialQuotation?.customerId) return String(initialQuotation.customerId);
    if (initialLead?.customerId) return String(initialLead.customerId);
    if (initialLead?.perusahaan || initialLead?.nama) {
      const match = (data.customers ?? []).find(
        (c: Row) =>
          c.nama?.toLowerCase() === (initialLead.perusahaan || initialLead.nama)?.toLowerCase(),
      );
      if (match) return String(match.id);
    }
    return "";
  });

  // Scheme - defaults to "sekaligus" (100% full invoice)
  const [scheme, setScheme] = React.useState<"sekaligus" | "dp" | "termin">("sekaligus");
  const [dpPercent, setDpPercent] = React.useState<string>("50");
  const [terminPercent, setTerminPercent] = React.useState<string>("30");

  // Continuation selection
  const [continuationType, setContinuationType] = React.useState<"termin" | "pelunasan">("termin");

  // Invoice Fields
  const [tanggal, setTanggal] = React.useState<string>(getTodayIso);
  const [jatuhTempo, setJatuhTempo] = React.useState<string>(getDefaultDueDateIso);
  const [catatan, setCatatan] = React.useState<string>(() => {
    if (initialPo?.catatan) return initialPo.catatan;
    if (initialPo?.nomorSo || initialPo?.nomor) return `Invoice untuk Sales Order ${initialPo.nomorSo || initialPo.nomor}`;
    if (initialQuotation?.catatan) return initialQuotation.catatan;
    if (initialQuotation?.nomor) return `Invoice untuk Penawaran ${initialQuotation.nomor}`;
    if (initialLead?.nama) return `Invoice untuk Lead ${initialLead.nama}`;
    if (defaultDirectSale) return "Nota Penjualan Langsung (Walk-in)";
    if (defaultDirectPurchase) return "Invoice Pembelian Langsung";
    return "";
  });
  const [fileId, setFileId] = React.useState<number | null>(null);
  const [fileName, setFileName] = React.useState<string>("");

  // Payment Status (Belum Bayar vs Langsung Lunas)
  const [paymentStatus, setPaymentStatus] = React.useState<"UNPAID" | "PAID">(() => {
    if (defaultDirectSale || defaultDirectPurchase || isInitialPoWalkin) return "PAID";
    return "UNPAID";
  });
  const [paymentAccountCode, setPaymentAccountCode] = React.useState<string>("1000.02");
  const [paymentMethod, setPaymentMethod] = React.useState<"TRANSFER" | "TUNAI">("TRANSFER");

  const kasBankOptions = React.useMemo(() => {
    const custom = loadCustomCoa();
    const deleted = new Set(loadDeletedCoaCodes());
    const merged: Record<string, { code: string; name: string }> = {};

    Object.values(CHART_OF_ACCOUNTS).forEach((acc) => {
      if (
        !deleted.has(acc.code) &&
        acc.category === "Aset Lancar" &&
        (acc.code === "1000.01" || acc.code === "1000.02" || acc.parentCode === "1000" || acc.type === "cash/bank")
      ) {
        merged[acc.code] = { code: acc.code, name: acc.name };
      }
    });

    custom.forEach((acc) => {
      if (
        !deleted.has(acc.code) &&
        (acc.parentCode === "1000" || acc.code.startsWith("1000.") || acc.type === "cash/bank")
      ) {
        merged[acc.code] = { code: acc.code, name: acc.name };
      }
    });

    const list = Object.values(merged);
    if (list.length === 0) {
      return [
        { code: "1000.02", name: "Bank Mandiri PT GMP [1000.02]", rawName: "Bank Mandiri PT GMP" },
        { code: "1000.01", name: "Kas Kecil [1000.01]", rawName: "Kas Kecil" },
      ];
    }
    return list.map((a) => ({
      code: a.code,
      name: `${a.name} [${a.code}]`,
      rawName: a.name,
    }));
  }, []);

  // Items
  const [items, setItems] = React.useState<QuotationItem[]>(() => {
    if (Array.isArray(initialPo?.items) && initialPo.items.length > 0) {
      return initialPo.items;
    }
    if (initialPo?.quotationId) {
      const q = (data.quotations ?? []).find((x: Row) => String(x.id) === String(initialPo.quotationId));
      if (Array.isArray(q?.items) && q.items.length > 0) return q.items;
    }
    if (initialPo?.penawaran && initialPo.penawaran !== "-") {
      const q = (data.quotations ?? []).find((x: Row) => x.nomor === initialPo.penawaran);
      if (Array.isArray(q?.items) && q.items.length > 0) return q.items;
    }
    if (Array.isArray(initialQuotation?.items) && initialQuotation.items.length > 0) {
      return initialQuotation.items;
    }
    if (Array.isArray(initialLead?.items) && initialLead.items.length > 0) {
      return initialLead.items;
    }
    return [];
  });
  const [customDpp, setCustomDpp] = React.useState<string>(() => {
    if (!initialPo?.items?.length && initialPo?.nilai) {
      return formatThousands(initialPo.nilai);
    }
    if (!initialQuotation?.items?.length && initialQuotation?.nilai) {
      return formatThousands(initialQuotation.nilai);
    }
    if (!initialQuotation && initialLead?.nilai) {
      return formatThousands(initialLead.nilai);
    }
    return "";
  });

  // Active quotation & PO & Lead objects
  const activeQuotation = React.useMemo(() => {
    if (selectedQuotationId) {
      return (data.quotations ?? []).find((q: Row) => String(q.id) === String(selectedQuotationId)) || null;
    }
    return initialQuotation || null;
  }, [data, selectedQuotationId, initialQuotation]);

  const activePo = React.useMemo(() => {
    if (selectedPoId) {
      return (data["po-client"] ?? []).find((p: Row) => String(p.id) === String(selectedPoId)) || initialPo || null;
    }
    return initialPo || null;
  }, [data, selectedPoId, initialPo]);

  const activeLead = React.useMemo(() => {
    if (selectedLeadId) {
      return (data.leads ?? []).find((l: Row) => String(l.id) === String(selectedLeadId)) || null;
    }
    return initialLead || null;
  }, [data, selectedLeadId, initialLead]);

  // Existing invoices related to active quotation, PO, or Lead
  const relatedExistingInvoices = React.useMemo(() => {
    const qNomor = activeQuotation?.nomor;
    const qId = activeQuotation?.id;
    const poNum = activePo?.nomor || activePo?.number || activePo?.nomorSo;
    const poId = activePo?.id;
    const leadId = activeLead?.id;
    const leadName = activeLead?.nama ? String(activeLead.nama).trim().toLowerCase() : "";

    return (data.invoices ?? []).filter((inv: Row) => {
      if (qId && (String(inv.quotationId) === String(qId) || (qNomor && String(inv.catatan || "").includes(qNomor)))) return true;
      if (qNomor && (inv.quotation === qNomor || String(inv.po || "").includes(qNomor))) return true;
      if (poId && String(inv.clientPoId) === String(poId)) return true;
      if (poNum && (inv.po === poNum || String(inv.catatan || "").includes(poNum))) return true;
      if (leadId && (String(inv.leadId) === String(leadId) || String(inv.catatan || "").includes(`[lead:${leadId}]`))) return true;
      if (leadName && String(inv.catatan || "").toLowerCase().includes(leadName)) return true;
      return false;
    });
  }, [data, activeQuotation, activePo, activeLead]);

  // Invoice Number
  const [nomor, setNomor] = React.useState<string>(() =>
    generateInvoiceNumber(
      mode === "lanjut",
      scheme,
      relatedExistingInvoices,
      data.invoices?.length || 0,
      data.invoices,
    ),
  );

  const terminNumber = relatedExistingInvoices.length + 1;

  // Active quotation discount
  const quotationDisc = React.useMemo(() => {
    const rawDisc =
      activeQuotation?.disc ??
      activeQuotation?.discount ??
      activePo?.discount ??
      activePo?.disc ??
      (data.quotations ?? []).find((q: Row) => String(q.id) === String(activePo?.quotationId))?.disc ??
      (data.quotations ?? []).find((q: Row) => String(q.id) === String(activePo?.quotationId))?.discount ??
      0;
    return Number(String(rawDisc).replace(/\D/g, "")) || 0;
  }, [activeQuotation, activePo, data.quotations]);

  // Total gross items / amount before discount
  const grossDealDpp = React.useMemo(() => {
    if (items.length > 0) {
      return items.reduce((acc, curr) => acc + (Number(curr.qty) || 1) * (Number(curr.harga) || Number((curr as any).price) || 0), 0);
    }
    if (sourceType === "po" && activePo?.nilai) return Number(activePo.nilai);
    if (activeQuotation?.total) return Number(activeQuotation.total);
    if (activeQuotation?.nilai) return Number(activeQuotation.nilai);
    if (activeLead?.nilai) return Number(activeLead.nilai);
    return Number(String(customDpp).replace(/\D/g, "")) || 0;
  }, [items, sourceType, activePo, activeQuotation, activeLead, customDpp]);

  const [customDiscount, setCustomDiscount] = React.useState<string>(() =>
    quotationDisc > 0 ? formatThousands(quotationDisc) : "",
  );

  const [discPercent, setDiscPercent] = React.useState<string>(() => {
    const rawDisc = quotationDisc || 0;
    const base = Number(activePo?.nilai || activeQuotation?.total || activeQuotation?.nilai || 0);
    if (rawDisc > 0 && base > 0) {
      return String(Math.round((rawDisc / base) * 100 * 10) / 10);
    }
    return "";
  });
  const [quickCustomerOpen, setQuickCustomerOpen] = React.useState(false);
  const [quickSupplierOpen, setQuickSupplierOpen] = React.useState(false);
  const [showAllItems, setShowAllItems] = React.useState(false);
  const [selectedItemIndices, setSelectedItemIndices] = React.useState<number[]>([]);

  const effectiveDiscount = Number(String(customDiscount).replace(/\D/g, "")) || 0;

  // Deal DPP (total dasar setelah diskon)
  const dealDpp = React.useMemo(() => {
    return Math.max(0, grossDealDpp - effectiveDiscount);
  }, [grossDealDpp, effectiveDiscount]);

  const [ppnMode, setPpnMode] = React.useState<PpnMode>(() => {
    if (initialPo?.ppnMode) return initialPo.ppnMode as PpnMode;
    if (initialPo?.tipePpn) return getInitialPpnMode(initialPo);
    if (initialPo?.quotationId) {
      const q = (data.quotations ?? []).find((x: Row) => String(x.id) === String(initialPo.quotationId));
      if (q) return getInitialPpnMode(q);
    }
    return getInitialPpnMode(initialQuotation);
  });
  const isNoPpn = ppnMode === "none";
  const isIncludePpn = ppnMode === "include";

  const dealPpn = isNoPpn ? 0 : isIncludePpn ? Math.max(0, dealDpp - Math.round(dealDpp / 1.11)) : Math.round(dealDpp * 0.11);
  const dealGrandTotal = isNoPpn || isIncludePpn ? dealDpp : dealDpp + dealPpn;

  // Total already billed in DPP
  const alreadyBilledDpp = React.useMemo(() => {
    return relatedExistingInvoices.reduce((acc: number, inv: Row) => acc + (Number(inv.nilai) || 0), 0);
  }, [relatedExistingInvoices]);

  const remainingDpp = Math.max(0, dealDpp - alreadyBilledDpp);

  // Submitting & File extracting
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [isExtracting, setIsExtracting] = React.useState<boolean>(false);
  const [pickerOpen, setPickerOpen] = React.useState<boolean>(false);
  const [pphMode, setPphMode] = React.useState<PphMode>(() => (activeQuotation?.pphMode as PphMode) || "none");
  const fileInputRef = React.useRef<any>(null);

  // Switch mode handler
  function handleSwitchMode(newMode: "baru" | "lanjut") {
    setMode(newMode);
    setNomor(generateInvoiceNumber(newMode === "lanjut", scheme, relatedExistingInvoices, data.invoices?.length || 0, data.invoices));
  }

  // Switch scheme handler
  function handleSwitchScheme(newScheme: "sekaligus" | "dp" | "termin") {
    setScheme(newScheme);
    setNomor(generateInvoiceNumber(mode === "lanjut", newScheme, relatedExistingInvoices, data.invoices?.length || 0, data.invoices));
  }

  // Select quotation handler
  function handleSelectQuotation(q: Row) {
    setSelectedQuotationId(String(q.id));
    if (q.customerId) setSelectedCustomerId(String(q.customerId));
    if (q.pphMode) setPphMode(q.pphMode as PphMode);
    if (q.tipePpn || q.ppnMode) setPpnMode(getInitialPpnMode(q));
    if (Array.isArray(q.items) && q.items.length > 0) {
      setItems(q.items);
    } else if (q.nilai) {
      setCustomDpp(formatThousands(q.nilai));
    }
    if (q.catatan) {
      setCatatan(q.catatan);
    }
  }

  // Select lead handler
  function handleSelectLead(l: Row) {
    setSelectedLeadId(String(l.id));
    if (l.customerId) {
      setSelectedCustomerId(String(l.customerId));
    } else {
      const match = (data.customers ?? []).find(
        (c: Row) => c.nama?.toLowerCase() === (l.perusahaan || l.nama)?.toLowerCase(),
      );
      if (match) setSelectedCustomerId(String(match.id));
    }
    if (l.nilai && !customDpp) {
      setCustomDpp(formatThousands(l.nilai));
    }
    if (l.nama && !catatan) {
      setCatatan(`Invoice untuk Lead ${l.nama}`);
    }
  }

  // Calculate current invoice DPP, PPN 11%, PPh, and Total
  const { currentDpp, currentPpn, currentPph, currentTotal, calculatedPct } = React.useMemo(() => {
    let dpp = 0;
    let pct = 100;

    if (mode === "baru") {
      if (scheme === "dp") {
        pct = Number(dpPercent) || 50;
        dpp = Math.round(dealDpp * (pct / 100));
      } else if (scheme === "termin") {
        pct = Number(terminPercent) || 30;
        dpp = Math.round(dealDpp * (pct / 100));
      } else {
        pct = 100;
        dpp = dealDpp;
      }
    } else {
      if (continuationType === "pelunasan") {
        dpp = remainingDpp;
        pct = dealDpp > 0 ? Math.round((dpp / dealDpp) * 100) : 100;
      } else {
        pct = Number(terminPercent) || (dealDpp > 0 ? Math.round((remainingDpp / dealDpp) * 100) : 30);
        dpp = Math.min(remainingDpp, Math.round(dealDpp * (pct / 100)));
      }
    }

    const rawBase = dpp;
    const effectiveDpp = isIncludePpn ? Math.round(rawBase / 1.11) : rawBase;
    const ppn = isNoPpn ? 0 : isIncludePpn ? Math.max(0, rawBase - effectiveDpp) : Math.round(rawBase * 0.11);
    const itemPphSum = items.reduce((acc, it) => acc + calcItemPph(it), 0);
    const pph = items.length > 0 ? itemPphSum : Math.round(effectiveDpp * pphRateFor(pphMode));
    const total = Math.max(0, (isIncludePpn ? rawBase : effectiveDpp + ppn) - pph);
    return { currentDpp: effectiveDpp, currentPpn: ppn, currentPph: pph, currentTotal: total, calculatedPct: pct };
  }, [mode, scheme, dpPercent, terminPercent, dealDpp, continuationType, remainingDpp, isNoPpn, isIncludePpn, pphMode, items]);

  // Handle file extraction
  async function handleExtractFile(file: any) {
    if (!file) return;
    setIsExtracting(true);
    try {
      const fd = new FormData();
      if (Platform.OS === "web") {
        fd.append("file", file);
      } else {
        fd.append("file", {
          uri: file.uri,
          name: file.name || "invoice.xlsx",
          type: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        } as any);
      }

      const res = await api<any>("POST", "/invoices/extract-file", undefined, { form: fd });
      if (res) {
        if (res.fileId) setFileId(res.fileId);
        if (res.filename) setFileName(res.filename);
        if (res.items && Array.isArray(res.items) && res.items.length > 0) {
          setItems(res.items);
        } else if (res.amount) {
          setCustomDpp(formatThousands(res.amount));
        }
        if (res.notes) setCatatan(res.notes);
        if (res.customerName) {
          const matchCust = (data.customers ?? []).find(
            (c: Row) => c.nama?.toLowerCase() === res.customerName?.toLowerCase(),
          );
          if (matchCust) setSelectedCustomerId(String(matchCust.id));
        }
        toast("Data file invoice berhasil diekstrak");
      }
    } catch (e: any) {
      toast(e?.message ?? "Gagal mengekstrak file invoice", "danger");
    } finally {
      setIsExtracting(false);
    }
  }

  // Handle Submit
  async function handleSubmit() {
    if (!nomor.trim()) {
      toast("Nomor invoice wajib diisi", "danger");
      return;
    }
    if (currentDpp <= 0) {
      toast("Nilai tagihan invoice harus lebih dari 0", "danger");
      return;
    }

    const isPurchase = sourceType === "direct_purchase";
    const supplierObj = (data.suppliers ?? []).find((s: Row) => String(s.id) === String(selectedSupplierId));
    const suppPoObj = (data["supplier-pos"] ?? []).find((p: Row) => String(p.id) === String(selectedSupplierPoId));
    const customerObj = (data.customers ?? []).find((c: Row) => String(c.id) === String(selectedCustomerId));

    const custName = isPurchase
      ? customSupplierName || supplierObj?.nama || supplierObj?.name || "Supplier Pembelian Langsung"
      : customCustomerName ||
        customerObj?.nama ||
        (sourceType === "direct_sale" ? "Pelanggan Langsung (Walk-in)" : null) ||
        activeQuotation?.customer ||
        activePo?.customer ||
        activeLead?.perusahaan ||
        activeLead?.nama ||
        "Pelanggan Langsung (Walk-in)";

    const invoiceType =
      mode === "lanjut"
        ? continuationType === "pelunasan" || remainingDpp - currentDpp <= 0
          ? "Pelunasan"
          : "Termin"
        : scheme === "dp"
        ? "DP"
        : scheme === "termin"
        ? "Termin"
        : "Pelunasan";

    const refTitle =
      isPurchase
        ? `Pembelian Langsung ${suppPoObj?.nomor || suppPoObj?.number || custName}`
        : sourceType === "direct_sale"
        ? `Penjualan Langsung (Walk-in)`
        : activeQuotation?.nomor ||
          activePo?.nomor ||
          activePo?.nomorSo ||
          (activeLead ? `Lead ${activeLead.nama}` : "Invoice");

    const termDesc =
      mode === "lanjut"
        ? continuationType === "pelunasan"
          ? `Pelunasan (${calculatedPct}%) - ${refTitle}`
          : `Termin ${terminNumber} (${calculatedPct}%) - ${refTitle}`
        : scheme === "dp"
        ? `DP (${calculatedPct}%) - ${refTitle}`
        : scheme === "termin"
        ? `Termin 1 (${calculatedPct}%) - ${refTitle}`
        : `Pembayaran Penuh (100%) - ${refTitle}`;

    let fullCatatan = catatan.trim() ? `${termDesc}. ${catatan.trim()}` : termDesc;
    if (activeLead?.id && !fullCatatan.includes(`[lead:${activeLead.id}]`)) {
      fullCatatan += ` [lead:${activeLead.id}]`;
    }

    setIsSubmitting(true);
    const isPaidNow = paymentStatus === "PAID";
    try {
      const created = await addRow("invoices", {
        nomor: nomor.trim() || undefined,
        customer: custName,
        customerId: isPurchase ? undefined : (selectedCustomerId || (customerObj?.id ? String(customerObj.id) : undefined)),
        supplierId: isPurchase ? (selectedSupplierId ? Number(selectedSupplierId) : undefined) : undefined,
        supplier: isPurchase ? custName : undefined,
        supplierPoId: isPurchase && selectedSupplierPoId ? Number(selectedSupplierPoId) : undefined,
        leadId: activeLead?.id ? String(activeLead.id) : undefined,
        lead: activeLead?.nama || undefined,
        quotationId: activeQuotation?.id ? String(activeQuotation.id) : undefined,
        quotation: activeQuotation?.nomor || undefined,
        clientPoId: activePo?.id ? String(activePo.id) : undefined,
        po: isPurchase
          ? suppPoObj?.nomor || suppPoObj?.number || undefined
          : activePo?.nomor || activePo?.nomorSo || activePo?.number || undefined,
        jenis: invoiceType,
        nilai: currentDpp,
        discount: effectiveDiscount > 0 ? effectiveDiscount : undefined,
        tipePpn: ppnModeToTipe(ppnMode),
        ppnMode,
        ppn: currentPpn,
        pph: currentPph,
        pphMode,
        tipePph: pphModeToTipe(pphMode),
        total: currentTotal,
        items: items.length > 0 ? items : undefined,
        dpLabel: calculatedPct < 100 ? `${invoiceType} (${calculatedPct}%)` : undefined,
        dpAmount: calculatedPct < 100 ? currentDpp : undefined,
        subject: isPurchase
          ? `FAKTUR PEMBELIAN LANGSUNG - ${custName.toUpperCase()}`
          : activeQuotation?.subject || `INVOICE PENAGIHAN - ${custName.toUpperCase()}`,
        intro: isPurchase
          ? "Faktur pembelian langsung barang/jasa dari supplier :"
          : activeQuotation?.intro || "Bersama surat ini kami sampaikan invoice penagihan untuk pekerjaan berikut :",
        notesList: activeQuotation?.notesList,
        city: activeQuotation?.city,
        kopText: activeQuotation?.kopText,
        kopLogoUrl: activeQuotation?.kopLogoUrl,
        customerAddress: activeQuotation?.customerAddress || customerObj?.address || customerObj?.alamat,
        tanggal,
        jatuhTempo: isPaidNow ? tanggal : jatuhTempo,
        status: isPaidNow ? "Lunas" : "Belum dikirim",
        terbayar: isPaidNow ? currentTotal : 0,
        catatan: isPaidNow
          ? `${fullCatatan} (${isPurchase ? "Pembelian Langsung - Lunas" : "Lunas Langsung"} - ${paymentMethod} [AKUN:${paymentAccountCode}])`
          : fullCatatan,
        fileId: fileId || undefined,
      });

      if (created) {
        if (isPaidNow && created.id && !String(created.id).startsWith("offline-") && currentTotal > 0) {
          await api("POST", `/invoices/${created.id}/payments`, {
            amount: currentTotal,
            date: tanggal,
            method: paymentMethod,
            reference: `LUNAS-${nomor.trim()} [${paymentAccountCode}]`,
          }).catch(() => {});
        }
        const accLabel = kasBankOptions.find((o) => o.code === paymentAccountCode)?.rawName || paymentMethod;
        toast(
          `Invoice ${nomor} (${invoiceType}) berhasil dibuat${
            isPaidNow ? ` & langsung Lunas (${accLabel})` : ""
          }!`
        );
        if (isPurchase && selectedSupplierPoId) {
          pushHistory("supplier-pos", selectedSupplierPoId, `Invoice Pembelian ${nomor} (${rupiah(currentTotal)}) dibuat`);
        }
        if (activePo?.id) {
          pushHistory("po-client", activePo.id, `Invoice ${nomor} (${rupiah(currentTotal)}) dibuat`);
        }
        if (activeQuotation?.id) {
          pushHistory("quotations", activeQuotation.id, `Invoice ${nomor} (${rupiah(currentTotal)}) dibuat`);
        }
        if (activeLead?.id) {
          pushHistory("leads", activeLead.id, `Invoice ${nomor} (${rupiah(currentTotal)}) dibuat langsung`);
        }
        onClose();
        await reload();
        await onSuccess?.();
      }
    } catch (e: any) {
      toast(e?.message ?? "Gagal membuat invoice", "danger");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <DialogContent className="w-[96vw] max-w-4xl max-h-[92vh]">
      <DialogHeader>
        <DialogTitle className="flex-row items-center gap-2">
          <Text className="text-base font-bold">
            {sourceType === "direct_purchase"
              ? "Faktur Pembelian Langsung"
              : sourceType === "direct_sale"
              ? "Invoice Penjualan Langsung"
              : "Buat Invoice Penagihan"}
          </Text>
          {sourceType === "direct_sale" ? (
            <Text className="text-xs font-semibold px-2 py-0.5 rounded bg-success/15 text-success">
              Penjualan Langsung
            </Text>
          ) : sourceType === "direct_purchase" ? (
            <Text className="text-xs font-semibold px-2 py-0.5 rounded bg-warning/15 text-warning">
              Pembelian Langsung
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

      <ScrollView className="max-h-[80vh] px-1" showsVerticalScrollIndicator={false}>
        {/* Mode Switcher */}
        <View className="flex-row rounded-lg bg-panel p-1 border border-border mb-4">
          <Button
            variant={mode === "baru" ? "default" : "ghost"}
            size="sm"
            onPress={() => handleSwitchMode("baru")}
            className="flex-1 h-8"
          >
            <Text className={`text-xs font-semibold ${mode === "baru" ? "text-primary-foreground" : "text-muted-foreground"}`}>
              Invoice Baru (Mulai Awal / DP / Penuh)
            </Text>
          </Button>
          <Button
            variant={mode === "lanjut" ? "default" : "ghost"}
            size="sm"
            onPress={() => handleSwitchMode("lanjut")}
            className="flex-1 h-8"
          >
            <Text className={`text-xs font-semibold ${mode === "lanjut" ? "text-primary-foreground" : "text-muted-foreground"}`}>
              Lanjutkan Termin / DP Sebelumnya
            </Text>
          </Button>
        </View>

        {/* Section: Extract from File */}
        <View className="mb-4 p-3 rounded-xl border border-dashed border-border bg-card/60">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 mr-2">
              <Text className="text-xs font-semibold text-foreground">Ekstrak Data dari File Excel / PDF</Text>
              <Text className="text-[11px] text-muted-foreground">
                Upload file invoice/penawaran (.xlsx / .pdf) untuk mengisi otomatis barang & total.
              </Text>
            </View>
            {Platform.OS === "web" ? (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx,.xls,.pdf"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleExtractFile(f);
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => fileInputRef.current?.click()}
                  disabled={isExtracting}
                  className="flex-row items-center gap-1.5 h-8"
                >
                  <Upload size={13} color={colors.primary} />
                  <Text className="text-xs font-semibold text-primary">
                    {isExtracting ? "Mengekstrak..." : "Upload & Ekstrak"}
                  </Text>
                </Button>
              </>
            ) : null}
          </View>
          {fileName ? (
            <View className="flex-row items-center gap-1.5 mt-2 bg-success/10 px-2 py-1 rounded">
              <CheckCircle2 size={13} color={colors.success} />
              <Text className="text-[11px] text-success font-medium flex-1" numberOfLines={1}>
                File terlampir: {fileName}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Source Link Section */}
        <View className="mb-4 gap-2">
          <FormField label="Tautkan Invoice Ke / Jenis Transaksi" required>
            <View className="flex-row flex-wrap gap-1.5">
              <Button
                variant={sourceType === "direct_sale" ? "default" : "outline"}
                size="sm"
                onPress={() => {
                  setSourceType("direct_sale");
                  setScheme("sekaligus");
                  setPaymentStatus("PAID");
                  if (!catatan) setCatatan("Nota Penjualan Langsung (Walk-in)");
                }}
                className="flex-1 min-w-[125px] h-8 px-2"
              >
                <Text className="text-xs font-semibold">Invoice Langsung</Text>
              </Button>
              <Button
                variant={sourceType === "direct_purchase" ? "default" : "outline"}
                size="sm"
                onPress={() => {
                  setSourceType("direct_purchase");
                  setScheme("sekaligus");
                  setPaymentStatus("PAID");
                  if (!catatan) setCatatan("Invoice Pembelian Langsung");
                }}
                className="flex-1 min-w-[140px] h-8 px-2"
              >
                <Text className="text-xs font-semibold">Pembelian Langsung</Text>
              </Button>
              <Button
                variant={sourceType === "po" ? "default" : "outline"}
                size="sm"
                onPress={() => {
                  setSourceType("po");
                  setScheme("sekaligus");
                }}
                className="flex-1 min-w-[120px] h-8 px-2"
              >
                <Text className="text-xs font-semibold">PO Client (SO)</Text>
              </Button>
              <Button
                variant={sourceType === "quotation" ? "default" : "outline"}
                size="sm"
                onPress={() => setSourceType("quotation")}
                className="flex-1 min-w-[95px] h-8 px-2"
              >
                <Text className="text-xs font-semibold">Penawaran</Text>
              </Button>
              <Button
                variant={sourceType === "lead" ? "default" : "outline"}
                size="sm"
                onPress={() => setSourceType("lead")}
                className="flex-1 min-w-[95px] h-8 px-2"
              >
                <Text className="text-xs font-semibold">Lead / Prospek</Text>
              </Button>
              <Button
                variant={sourceType === "customer" ? "default" : "outline"}
                size="sm"
                onPress={() => setSourceType("customer")}
                className="flex-1 min-w-[85px] h-8 px-2"
              >
                <Text className="text-xs font-semibold">Customer</Text>
              </Button>
            </View>
          </FormField>

          {sourceType === "direct_purchase" ? (
            <View className="gap-2 p-2.5 rounded-lg border border-border bg-card/60">
              <FormField label="Pilih Supplier / Tempat Pembelian Langsung" required>
                <SearchableSelect
                  value={
                    customSupplierName ||
                    (data.suppliers ?? []).find((s: Row) => String(s.id) === String(selectedSupplierId))?.nama ||
                    (data.suppliers ?? []).find((s: Row) => String(s.id) === String(selectedSupplierId))?.name ||
                    ""
                  }
                  onChange={(val) => {
                    setCustomSupplierName(val);
                    const match = (data.suppliers ?? []).find((s: Row) => (s.nama || s.name) === val);
                    if (match) setSelectedSupplierId(String(match.id));
                    else setSelectedSupplierId("");
                  }}
                  onAddNew={() => setQuickSupplierOpen(true)}
                  addNewLabel="+ Tambah Supplier Baru"
                  options={Array.from(new Set([customSupplierName, ...(data.suppliers ?? []).map((s: Row) => s.nama || s.name)])).filter(Boolean)}
                  placeholder="Cari & pilih supplier..."
                />
              </FormField>

              <FormField label="PO Supplier Terkait (Opsional)">
                <SearchableSelect
                  value={
                    (data["supplier-pos"] ?? []).find((p: Row) => String(p.id) === String(selectedSupplierPoId))?.nomor ||
                    (data["supplier-pos"] ?? []).find((p: Row) => String(p.id) === String(selectedSupplierPoId))?.number ||
                    ""
                  }
                  onChange={(val) => {
                    const selNo = val.split(" - ")[0]?.trim() || val;
                    const match = (data["supplier-pos"] ?? []).find(
                      (p: Row) => (p.nomor || p.number) === selNo,
                    );
                    if (match) {
                      setSelectedSupplierPoId(String(match.id));
                      if (match.supplierId) setSelectedSupplierId(String(match.supplierId));
                      if (match.supplier) setCustomSupplierName(match.supplier);
                      if (Array.isArray(match.items) && match.items.length > 0) {
                        setItems(match.items);
                      } else if (match.total || match.nilai) {
                        setCustomDpp(formatThousands(match.total || match.nilai));
                      }
                    }
                  }}
                  options={(data["supplier-pos"] ?? []).map(
                    (p: Row) => `${p.nomor || p.number} - ${p.supplier || "-"}`,
                  )}
                  placeholder="Pilih PO Supplier jika ada..."
                />
              </FormField>
            </View>
          ) : sourceType === "direct_sale" ? (
            <View className="gap-2 p-2.5 rounded-lg border border-border bg-card/60">
              <FormField label="Customer (Opsional: Kosongkan untuk Pelanggan Langsung / Walk-in)">
                <SearchableSelect
                  value={
                    customCustomerName ||
                    (data.customers ?? []).find((c: Row) => String(c.id) === String(selectedCustomerId))?.nama ||
                    ""
                  }
                  onAddNew={() => setQuickCustomerOpen(true)}
                  addNewLabel="+ Tambah Customer Baru"
                  onChange={(val) => {
                    setCustomCustomerName(val);
                    const match = (data.customers ?? []).find((c: Row) => c.nama === val);
                    if (match) setSelectedCustomerId(String(match.id));
                    else setSelectedCustomerId("");
                  }}
                  options={Array.from(new Set([customCustomerName, "Pelanggan Langsung (Walk-in)", ...(data.customers ?? []).map((c: Row) => c.nama)])).filter(Boolean)}
                  placeholder="Pelanggan Langsung (Walk-in) / Cari customer..."
                />
              </FormField>
            </View>
          ) : sourceType === "quotation" ? (
            <FormField label="Pilih Penawaran Terkait" required>
              <SearchableSelect
                value={
                  activeQuotation
                    ? `${activeQuotation.nomor} - ${activeQuotation.customer || "-"} - ${activeQuotation.lead || "-"}`
                    : ""
                }
                onChange={(val) => {
                  const selNo = val.split(" - ")[0]?.trim() || val;
                  const match = (data.quotations ?? []).find((q: Row) => q.nomor === selNo);
                  if (match) handleSelectQuotation(match);
                }}
                options={(data.quotations ?? []).map(
                  (q: Row) => `${q.nomor} - ${q.customer || "-"} - ${q.lead || "-"}`,
                )}
                placeholder="Cari & pilih penawaran..."
              />
              {activeQuotation ? (
                <View className="flex-row flex-wrap items-center gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => {
                      downloadQuotationPdf({
                        quotationId: activeQuotation.id,
                        customer: activeQuotation.customer,
                        lead: activeQuotation.lead,
                        nomor: activeQuotation.nomor,
                        signer: activeQuotation.pemilik,
                      });
                      toast("File PDF penawaran sedang diunduh");
                    }}
                    className="h-8 px-2.5 flex-row items-center gap-1.5"
                  >
                    <FileDown size={13} color={colors.text} />
                    <Text className="text-xs">Download PDF Penawaran</Text>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => {
                      downloadQuotationTemplate({
                        quotationId: activeQuotation.id,
                        customer: activeQuotation.customer,
                        lead: activeQuotation.lead,
                        nomor: activeQuotation.nomor,
                        signer: activeQuotation.pemilik,
                      });
                      toast("File Excel penawaran (.xlsx) sedang diunduh");
                    }}
                    className="h-8 px-2.5 flex-row items-center gap-1.5"
                  >
                    <FileDown size={13} color={colors.text} />
                    <Text className="text-xs">Download Excel Penawaran (.xlsx)</Text>
                  </Button>
                </View>
              ) : null}
            </FormField>
          ) : sourceType === "po" ? (
            <FormField label="Pilih PO Client (Sales Order) Terkait" required>
              <SearchableSelect
                value={
                  activePo
                    ? `${activePo.nomorSo || activePo.nomor || activePo.number} - ${activePo.customer || "-"}`
                    : ""
                }
                onChange={(val) => {
                  const selNo = val.split(" - ")[0]?.trim() || val;
                  const match = (data["po-client"] ?? []).find(
                    (p: Row) => (p.nomorSo || p.nomor || p.number) === selNo,
                  );
                  if (match) {
                    setSelectedPoId(String(match.id));
                    if (match.customer && match.customer !== "-") {
                      setCustomCustomerName(match.customer);
                    }
                    if (match.customerId) setSelectedCustomerId(String(match.customerId));
                    if (match.customer && match.customer !== "-") {
                      const cMatch = (data.customers ?? []).find(
                        (c: Row) =>
                          c.nama?.toLowerCase() === String(match.customer).toLowerCase() ||
                          c.name?.toLowerCase() === String(match.customer).toLowerCase(),
                      );
                      if (cMatch) setSelectedCustomerId(String(cMatch.id));
                    }
                    if (Array.isArray(match.items) && match.items.length > 0) {
                      setItems(match.items);
                    } else if (match.quotationId) {
                      setSelectedQuotationId(String(match.quotationId));
                      const linkedQ = (data.quotations ?? []).find(
                        (q: Row) => String(q.id) === String(match.quotationId),
                      );
                      if (linkedQ && Array.isArray(linkedQ.items) && linkedQ.items.length > 0) {
                        setItems(linkedQ.items);
                      }
                    } else if (match.nilai) {
                      setCustomDpp(formatThousands(match.nilai));
                    }
                    if (match.tipePpn || match.ppnMode) {
                      setPpnMode(getInitialPpnMode(match));
                    }
                    if (match.discount || match.disc) {
                      setCustomDiscount(formatThousands(match.discount || match.disc));
                    }
                  }
                }}
                options={(data["po-client"] ?? []).map(
                  (p: Row) => `${p.nomorSo || p.nomor || p.number} - ${p.customer || "-"}`,
                )}
                placeholder="Cari & pilih PO client..."
              />
            </FormField>
          ) : sourceType === "lead" ? (
            <FormField label="Pilih Lead / Prospek Terkait" required>
              <SearchableSelect
                value={
                  activeLead
                    ? `${activeLead.nama} - ${activeLead.perusahaan || activeLead.customer || "-"}`
                    : ""
                }
                onChange={(val) => {
                  const selName = val.split(" - ")[0]?.trim() || val;
                  const match = (data.leads ?? []).find(
                    (l: Row) => l.nama === selName || `${l.nama} - ${l.perusahaan || l.customer || "-"}` === val,
                  );
                  if (match) handleSelectLead(match);
                }}
                options={(data.leads ?? []).map(
                  (l: Row) => `${l.nama} - ${l.perusahaan || l.customer || "-"}`,
                )}
                placeholder="Cari & pilih lead / prospek..."
              />
            </FormField>
          ) : null}

          {sourceType !== "direct_purchase" && sourceType !== "direct_sale" ? (
            <FormField label="Customer" required>
              <SearchableSelect
                value={
                  customCustomerName ||
                  (data.customers ?? []).find((c: Row) => String(c.id) === String(selectedCustomerId))?.nama || ""
                }
                onAddNew={() => setQuickCustomerOpen(true)}
                addNewLabel="+ Tambah Customer Baru"
                onChange={(val) => {
                  setCustomCustomerName(val);
                  const match = (data.customers ?? []).find((c: Row) => c.nama === val);
                  if (match) setSelectedCustomerId(String(match.id));
                  else setSelectedCustomerId("");
                }}
                options={Array.from(new Set([customCustomerName, ...(data.customers ?? []).map((c: Row) => c.nama)])).filter(Boolean)}
                placeholder="Cari & pilih customer..."
              />
            </FormField>
          ) : null}
        </View>

        {/* Mode: Lanjutkan Termin / DP Sebelumnya info banner */}
        {mode === "lanjut" ? (
          <View className="mb-4 p-3 rounded-xl bg-panel border border-border gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-bold text-foreground">Riwayat Tagihan Sebelumnya</Text>
              <Text className="text-xs font-semibold text-primary">
                {relatedExistingInvoices.length} Invoice Tercatat
              </Text>
            </View>

            <View className="gap-1 my-1">
              {relatedExistingInvoices.map((inv: Row) => (
                <View key={inv.id} className="flex-row justify-between items-center text-xs py-1 border-b border-border/40">
                  <Text className="text-xs font-mono font-medium">{inv.nomor} ({inv.jenis})</Text>
                  <Text className="text-xs font-semibold">{rupiah(inv.nilai)}</Text>
                </View>
              ))}
            </View>

            <View className="bg-card p-2 rounded-lg gap-1 border border-border">
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted-foreground">Total Nilai Dasar (DPP):</Text>
                <Text className="text-xs font-bold">{rupiah(dealDpp)}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted-foreground">Sudah Ditagihkan:</Text>
                <Text className="text-xs font-semibold text-success">{rupiah(alreadyBilledDpp)}</Text>
              </View>
              <View className="flex-row justify-between pt-1 border-t border-border">
                <Text className="text-xs font-bold text-foreground">Sisa Belum Ditagih (DPP):</Text>
                <Text className="text-xs font-bold text-primary">{rupiah(remainingDpp)}</Text>
              </View>
            </View>

            <View className="mt-2">
              <FormField label="Pilih Jenis Lanjutan" required>
                <View className="flex-row gap-2">
                  <Button
                    variant={continuationType === "termin" ? "default" : "outline"}
                    size="sm"
                    onPress={() => setContinuationType("termin")}
                    className="flex-1 h-8"
                  >
                    <Text className="text-xs">Termin {terminNumber}</Text>
                  </Button>
                  <Button
                    variant={continuationType === "pelunasan" ? "default" : "outline"}
                    size="sm"
                    onPress={() => setContinuationType("pelunasan")}
                    className="flex-1 h-8"
                  >
                    <Text className="text-xs">Pelunasan (Sisa {rupiah(remainingDpp)})</Text>
                  </Button>
                </View>
              </FormField>
              {continuationType === "termin" ? (
                <View className="mt-2">
                  <FormField label={`Persentase Termin ${terminNumber} (%)`} required>
                    <Input
                      value={terminPercent}
                      onChangeText={setTerminPercent}
                      keyboardType="numeric"
                      placeholder="Contoh: 30"
                    />
                  </FormField>
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          /* Mode Baru Scheme */
          <View className="mb-4 p-3 rounded-xl bg-panel border border-border gap-2">
            <FormField label="Skema Pembayaran" required>
              <View className="flex-row gap-2">
                <Button
                  variant={scheme === "termin" ? "default" : "outline"}
                  size="sm"
                  onPress={() => handleSwitchScheme("termin")}
                  className="flex-1 h-8"
                >
                  <Text className="text-xs">Termin (Bertahap)</Text>
                </Button>
                <Button
                  variant={scheme === "dp" ? "default" : "outline"}
                  size="sm"
                  onPress={() => handleSwitchScheme("dp")}
                  className="flex-1 h-8"
                >
                  <Text className="text-xs">DP (Uang Muka)</Text>
                </Button>
                <Button
                  variant={scheme === "sekaligus" ? "default" : "outline"}
                  size="sm"
                  onPress={() => handleSwitchScheme("sekaligus")}
                  className="flex-1 h-8"
                >
                  <Text className="text-xs">Sekaligus (100%)</Text>
                </Button>
              </View>
            </FormField>

            {scheme === "dp" ? (
              <FormField label="Persentase DP (%)" required>
                <Input
                  value={dpPercent}
                  onChangeText={setDpPercent}
                  keyboardType="numeric"
                  placeholder="50"
                />
              </FormField>
            ) : scheme === "termin" ? (
              <FormField label="Persentase Termin 1 (%)" required>
                <Input
                  value={terminPercent}
                  onChangeText={setTerminPercent}
                  keyboardType="numeric"
                  placeholder="30"
                />
              </FormField>
            ) : null}
          </View>
        )}

        {/* Form Fields */}
        <View className="gap-3 mb-4">
          <FormField label="Nomor Invoice (Kosongkan untuk otomatis)">
            <Input value={nomor} onChangeText={setNomor} placeholder="Otomatis oleh sistem" />
          </FormField>

          <View className="flex-row gap-2">
            <View className="flex-1">
              <FormField label="Tanggal Terbit" required>
                <DatePicker value={tanggal} onChange={setTanggal} />
              </FormField>
            </View>
            <View className="flex-1">
              <FormField label="Jatuh Tempo" required>
                <DatePicker value={jatuhTempo} onChange={setJatuhTempo} />
              </FormField>
            </View>
          </View>

          {items.length === 0 ? (
            <FormField label="Nilai Kesepakatan / DPP Total (Rp)" required>
              <Input
                value={customDpp}
                onChangeText={(v) => setCustomDpp(formatThousands(v))}
                keyboardType="numeric"
                placeholder="Rp 0"
              />
            </FormField>
          ) : null}

          {/* List Barang / Items Table */}
          <View className="gap-2 p-3 rounded-xl border border-border bg-card">
            <View className="flex-row justify-between items-center flex-wrap gap-2">
              <View>
                <Text className="text-xs font-bold text-foreground">
                  Daftar Barang & Jasa dari Penawaran / Stok ({items.length} Item)
                </Text>
                <Text className="text-[11px] text-muted-foreground">
                  Barang ber-SN pada daftar ini otomatis di-reserve untuk Invoice ini.
                </Text>
              </View>
              <View className="flex-row items-center gap-1.5 flex-wrap">
                {selectedItemIndices.length > 0 && (
                  <Button
                    size="sm"
                    className="h-7 px-2.5 bg-danger flex-row items-center gap-1"
                    onPress={() => {
                      setItems((prev) => prev.filter((_, i) => !selectedItemIndices.includes(i)));
                      setSelectedItemIndices([]);
                    }}
                  >
                    <Trash2 size={12} color="#fff" />
                    <Text className="text-xs text-white font-semibold">
                      Hapus ({selectedItemIndices.length})
                    </Text>
                  </Button>
                )}
                {items.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2"
                    onPress={() => {
                      if (selectedItemIndices.length === items.length) {
                        setSelectedItemIndices([]);
                      } else {
                        setSelectedItemIndices(items.map((_, i) => i));
                      }
                    }}
                  >
                    <Text className="text-xs">
                      {selectedItemIndices.length === items.length ? "Batal Semua" : "Pilih Semua"}
                    </Text>
                  </Button>
                )}
                <Button size="sm" variant="outline" onPress={() => setPickerOpen(true)}>
                  <Package size={13} color={colors.primary} />
                  <Text className="text-xs text-primary font-semibold">+ Pilih Stok & SN / Jasa</Text>
                </Button>
              </View>
            </View>
            {items.length > 0 ? (
              <View className="gap-2 mt-1">
                {(showAllItems ? items : items.slice(0, 10)).map((it, idx) => {
                  const itPph = calcItemPph(it);
                  const itemPrice = Number(it.harga || it.price || 0);
                  const sub = (Number(it.qty) || 1) * itemPrice;
                  const isSelected = selectedItemIndices.includes(idx);
                  return (
                    <View
                      key={it.id || idx}
                      className={`py-2 px-2 rounded-lg border-b border-border/40 gap-1.5 ${isSelected ? "bg-primary/10" : ""}`}
                    >
                      <View className="flex-row justify-between items-center gap-2">
                        <Pressable
                          onPress={() => {
                            setSelectedItemIndices((prev) =>
                              prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
                            );
                          }}
                          hitSlop={6}
                          className="mr-1"
                        >
                          <View
                            className={`w-4 h-4 rounded border items-center justify-center ${
                              isSelected ? "bg-primary border-primary" : "border-border/80 bg-background"
                            }`}
                          >
                            {isSelected && <Check size={11} color="#ffffff" />}
                          </View>
                        </Pressable>
                        <View className="flex-1 mr-1">
                          <Text className="text-xs font-medium">{it.item}</Text>
                          <View className="flex-row flex-wrap items-center gap-1.5 mt-0.5">
                            <Text className="text-[10px] text-muted-foreground">
                              {it.qty} {it.satuan || it.unit || "unit"} x {rupiah(itemPrice)}
                            </Text>
                            {Array.isArray(it.serialNumbers) && it.serialNumbers.length > 0 ? (
                              <StatusBadge status={`Reserve SN: ${it.serialNumbers.join(", ")}`} />
                            ) : it.kind === "SERVICE" ? (
                              <StatusBadge status="Jasa / Non-Barang" />
                            ) : null}
                          </View>
                        </View>
                        <View className="items-end gap-0.5">
                          <Text className="text-xs font-semibold">{rupiah(sub)}</Text>
                          {itPph > 0 ? (
                            <Text className="text-[10px] text-danger font-medium">PPh: -{rupiah(itPph)}</Text>
                          ) : null}
                        </View>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5"
                          onPress={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          <Trash2 size={13} color={colors.danger} />
                        </Button>
                      </View>

                      {/* Selector PPh Per-Item */}
                      <View className="flex-row items-center gap-1 flex-wrap">
                        <Text className="text-[10px] text-muted-foreground mr-1">PPh Item:</Text>
                        {PPH_MODE_OPTIONS.map((opt) => {
                          const active = (it.pphMode || "none") === opt.id;
                          return (
                            <Pressable
                              key={opt.id}
                              onPress={() => {
                                setItems((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, pphMode: opt.id, tipePph: opt.label } : item
                                  )
                                );
                              }}
                              className={`px-2 py-0.5 rounded border ${
                                active
                                  ? "bg-primary/10 border-primary"
                                  : "bg-muted/40 border-border/60"
                              }`}
                            >
                              <Text className={`text-[10px] ${active ? "text-primary font-bold" : "text-muted-foreground"}`}>
                                {opt.id === "none" ? "Non-PPh" : opt.label.split(" ")[0]}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
                {items.length > 10 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 border border-border/60 rounded-lg flex-row items-center justify-center gap-1.5 mt-1"
                    onPress={() => setShowAllItems((v) => !v)}
                  >
                    <Text className="text-xs font-semibold text-primary">
                      {showAllItems ? "Sembunyikan" : `Lihat Semua (${items.length} item)`}
                    </Text>
                  </Button>
                )}
                <View className="flex-row justify-between pt-1">
                  <Text className="text-xs font-semibold text-muted-foreground">Subtotal Rincian Barang:</Text>
                  <Text className="text-xs font-bold text-primary">{rupiah(grossDealDpp)}</Text>
                </View>
              </View>
            ) : (
              <Text className="text-xs text-muted-foreground italic">
                Belum ada rincian barang/jasa. Pilih penawaran yang memiliki item atau klik &quot;+ Pilih Stok &amp; SN / Jasa&quot;.
              </Text>
            )}
          </View>

          {/* Diskon Pemotongan (Persen & Nominal) */}
          <View className="p-3 rounded-xl bg-card border border-border gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-semibold text-foreground">Diskon Pemotongan</Text>
              {effectiveDiscount > 0 ? (
                <Text className="text-xs font-semibold text-danger">
                  - {rupiah(effectiveDiscount)} {discPercent ? `(${discPercent}%)` : ""}
                </Text>
              ) : null}
            </View>
            <View className="flex-row items-center gap-2">
              <View className="w-28 sm:w-36">
                <FormField label="Diskon (%)">
                  <Input
                    value={discPercent}
                    onChangeText={(p) => {
                      const clean = p.replace(/[^0-9.]/g, "");
                      setDiscPercent(clean);
                      const pct = Number(clean) || 0;
                      if (grossDealDpp > 0) {
                        const calculated = Math.round(grossDealDpp * (pct / 100));
                        setCustomDiscount(calculated > 0 ? formatThousands(calculated) : "");
                      }
                    }}
                    keyboardType="numeric"
                    placeholder="0%"
                  />
                </FormField>
              </View>
              <View className="flex-1">
                <FormField label="Diskon Nominal (Rp)">
                  <Input
                    value={customDiscount}
                    onChangeText={(v) => {
                      setCustomDiscount(formatThousands(v));
                      const nom = Number(String(v).replace(/\D/g, "")) || 0;
                      if (grossDealDpp > 0 && nom > 0) {
                        const pct = Math.round((nom / grossDealDpp) * 100 * 10) / 10;
                        setDiscPercent(String(pct));
                      } else {
                        setDiscPercent("");
                      }
                    }}
                    keyboardType="numeric"
                    placeholder="0 (Contoh: 100.000)"
                  />
                </FormField>
              </View>
            </View>
          </View>

          {/* Status Pembayaran */}
          <View className="p-3 rounded-xl bg-panel border border-border gap-2">
            <FormField label="Status Pembayaran Saat Terbit">
              <View className="flex-row gap-2">
                <Button
                  variant={paymentStatus === "UNPAID" ? "default" : "outline"}
                  size="sm"
                  onPress={() => setPaymentStatus("UNPAID")}
                  className="flex-1 h-8"
                >
                  <Text className="text-xs">Belum Bayar (Tagihan / Tempo)</Text>
                </Button>
                <Button
                  variant={paymentStatus === "PAID" ? "default" : "outline"}
                  size="sm"
                  onPress={() => setPaymentStatus("PAID")}
                  className="flex-1 h-8"
                >
                  <Text className="text-xs">Langsung Lunas (Kas / Bank)</Text>
                </Button>
              </View>
            </FormField>

            {paymentStatus === "PAID" ? (
              <FormField
                label="Pilih Akun Kas / Bank Penerimaan"
                required
                hint="Pilih rekening bank atau kas kecil tempat pembayaran invoice ini masuk"
              >
                <SearchableSelect
                  value={
                    kasBankOptions.find((o) => o.code === paymentAccountCode)?.name ||
                    kasBankOptions[0]?.name ||
                    ""
                  }
                  options={kasBankOptions.map((o) => o.name)}
                  onChange={(val) => {
                    const match = kasBankOptions.find((o) => o.name === val || val.includes(o.code));
                    if (match) {
                      setPaymentAccountCode(match.code);
                      const isTunai = match.code === "1000.01" || /kas/i.test(match.rawName);
                      setPaymentMethod(isTunai ? "TUNAI" : "TRANSFER");
                    }
                  }}
                  placeholder="Pilih rekening kas / bank..."
                />
              </FormField>
            ) : null}
          </View>

          <FormField label="Catatan / Keterangan Invoice">
            <Textarea
              value={catatan}
              onChangeText={setCatatan}
              placeholder="Catatan tambahan untuk invoice ini..."
            />
          </FormField>

          {/* Ketentuan PPN */}
          <View className="w-full sm:w-1/2 px-2 py-2">
            <FormField label="Ketentuan PPN (Pajak Pertambahan Nilai)">
              <View className="gap-2">
                <View className="flex-row flex-wrap gap-1.5">
                  {PPN_MODE_OPTIONS.map((opt) => (
                    <Button
                      key={opt.id}
                      size="sm"
                      variant={ppnMode === opt.id ? "default" : "outline"}
                      onPress={() => setPpnMode(opt.id)}
                      className="h-9 px-3"
                    >
                      <Text className="text-xs">{opt.label}</Text>
                    </Button>
                  ))}
                </View>
                <View className="bg-card border-border/50 gap-1 rounded-lg border p-2.5">
                  <Text className="text-[11px] text-muted-foreground">
                    {ppnMode === "exclude"
                      ? "PPN 11% ditambahkan di luar nilai dasar (DPP)."
                      : ppnMode === "include"
                      ? "Nilai dasar sudah termasuk PPN 11%."
                      : "Transaksi ini tanpa PPN (0%)."}
                  </Text>
                  {ppnMode === "include" ? (
                    <View className="mt-1 gap-0.5">
                      <Text className="text-xs text-foreground">
                        DPP (Sebelum PPN): {rupiah(currentDpp)}
                      </Text>
                      <Text className="text-xs font-semibold text-primary">
                        PPN 11% Termasuk: {rupiah(currentPpn)}
                      </Text>
                    </View>
                  ) : currentPpn > 0 ? (
                    <Text className="text-xs font-semibold text-primary">
                      PPN 11%: +{rupiah(currentPpn)}
                    </Text>
                  ) : null}
                </View>
              </View>
            </FormField>
          </View>

          {/* PPh Selector */}
          <QuotationPphField
            mode={pphMode}
            onChange={setPphMode}
            pph={currentPph}
          />
        </View>

        {/* Grand Total Summary Box */}
        <View className="p-3.5 rounded-xl bg-card border border-border gap-1.5 mb-2">
          {effectiveDiscount > 0 ? (
            <>
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted-foreground">Subtotal Item / Gross:</Text>
                <Text className="text-xs font-medium">{rupiah(grossDealDpp)}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs text-danger font-medium">Diskon Pemotongan:</Text>
                <Text className="text-xs font-semibold text-danger">- {rupiah(effectiveDiscount)}</Text>
              </View>
            </>
          ) : null}
          <View className="flex-row justify-between">
            <Text className="text-xs text-muted-foreground">Total Dasar (DPP):</Text>
            <Text className="text-xs font-medium">{rupiah(dealDpp)}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-xs text-muted-foreground">
              {isNoPpn ? "PPN (Tanpa PPN):" : isIncludePpn ? "PPN (Termasuk):" : "PPN (11%):"}
            </Text>
            <Text className="text-xs font-medium">{rupiah(dealPpn)}</Text>
          </View>
          <View className="flex-row justify-between pb-1.5 border-b border-border">
            <Text className="text-xs font-semibold text-foreground">Grand Total Kesepakatan:</Text>
            <Text className="text-xs font-bold text-foreground">{rupiah(dealGrandTotal)}</Text>
          </View>

          {/* Current Invoice Tagihan Breakdown */}
          <View className="flex-row justify-between pt-1">
            <Text className="text-xs font-bold text-primary">
              Tagihan Invoice Ini ({calculatedPct}%):
            </Text>
            <Text className="text-xs font-bold text-primary">{rupiah(currentDpp)}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-xs text-muted-foreground">
              {isNoPpn ? "PPN Tagihan (Tanpa PPN):" : isIncludePpn ? "PPN Tagihan Ini (11% Termasuk):" : "PPN Tagihan Ini (11%):"}
            </Text>
            <Text className="text-xs font-medium">{rupiah(currentPpn)}</Text>
          </View>
          {currentPph > 0 ? (
            <View className="flex-row justify-between">
              <Text className="text-xs text-amber-600 dark:text-amber-400">
                Potongan PPh ({pphModeToTipe(pphMode)}):
              </Text>
              <Text className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                -{rupiah(currentPph)}
              </Text>
            </View>
          ) : null}
          <View className="flex-row justify-between pt-1 border-t border-border">
            <Text className="text-sm font-bold text-foreground">Total Tagihan Bersih Invoice Ini:</Text>
            <Text className="text-sm font-bold text-primary">{rupiah(currentTotal)}</Text>
          </View>

          {dealDpp - currentDpp > 0 ? (
            <View className="flex-row justify-between pt-1 border-t border-dashed border-border">
              <Text className="text-xs text-muted-foreground">Sisa yang Belum Ditagih:</Text>
              <Text className="text-xs font-semibold text-amber-600">
                {rupiah(Math.max(0, dealDpp - (alreadyBilledDpp + currentDpp)))}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <DialogFooter>
        <Button variant="outline" onPress={onClose}>
          <Text>Batal</Text>
        </Button>
        <Button onPress={handleSubmit} disabled={isSubmitting}>
          <Text>{isSubmitting ? "Menyimpan..." : "Simpan & Buat Invoice"}</Text>
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
            if (Array.isArray(it.serialNumbers)) it.serialNumbers.forEach((s) => existingSnSet.add(String(s).trim().toUpperCase()));
            const snVal = String(it.item).match(/\(SN:\s*([^\)]+)\)/i)?.[1]?.trim();
            if (snVal) existingSnSet.add(snVal.toUpperCase());
          });
          const valid: QuotationItem[] = [];
          const duplicates: string[] = [];
          newItems.forEach((it) => {
            const snList: string[] = [];
            if (Array.isArray(it.serialNumbers)) it.serialNumbers.forEach((s) => snList.push(String(s).trim().toUpperCase()));
            const snVal = String(it.item).match(/\(SN:\s*([^\)]+)\)/i)?.[1]?.trim();
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
            toast(`Barang/item dengan SN (${duplicates.join(", ")}) sudah ada di invoice`, "danger");
          }
          if (valid.length > 0) {
            setItems((prev) => [...prev, ...valid]);
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
