import * as React from "react";
import { View, ScrollView, Pressable, Platform } from "react-native";
import { FileDown, Package, Trash2, Check } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FormField } from "@/components/taska/basics";
import {
  DatePicker,
  SearchableSelect,
  QuickAddCustomerDialog,
  QuickAddSupplierDialog,
  SupplierSelect,
  PoClientSelect,
  QuotationSelect,
  LeadSelect,
  ContinuableInvoiceSelect,
} from "@/components/taska/dialogs";
import { FileUploader } from "@/components/taska/file-uploader";
import { StatusBadge } from "@/components/taska/status-badge";
import { SerialItemPickerModal } from "@/components/taska/serial-item-picker";
import { useApp } from "@/store/app-store";
import { api } from "@/services/api";
import { colors } from "@/tokens";
import { rupiah, formatThousands } from "@/lib/format";
import { type Row } from "@/constants/modules";
import { type QuotationItem } from "@/modules/quotation/types";
import { downloadQuotationTemplate, downloadQuotationPdf } from "@/modules/quotation/quotation-files";
import {
  collectContinuableInvoices,
  invoiceAmount,
  invoicePaidAmount,
} from "@/modules/invoice/invoice-chain";
import { CHART_OF_ACCOUNTS, loadCustomCoa, loadDeletedCoaCodes } from "@/lib/accounting";
import {
  type PphMode,
  type PpnMode,
  PPN_MODE_OPTIONS,
  PPH_MODE_OPTIONS,
  getInitialPpnMode,
  getInitialPphMode,
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

function generateInvoiceInNumber(
  scheme: "sekaligus" | "dp" | "termin",
  existingInvoices: Row[],
  totalInvoiceInCount: number,
  allInvoiceIn?: Row[],
  continuationType?: "termin" | "pelunasan",
): string {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");
  const prefix = `INV-IN/${year}/${month}/`;

  let maxSeq = 0;
  for (const inv of allInvoiceIn || []) {
    const num = String(inv.nomor || inv.number || "");
    if (num.startsWith(prefix)) {
      const parts = num.slice(prefix.length).split(/[/_-]/);
      const seq = parseInt(parts[0] ?? "", 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }
  const count = Math.max(maxSeq + 1, totalInvoiceInCount + 1);
  const baseSeq = String(count).padStart(3, "0");

  if (existingInvoices.length > 0) {
    const nextTermNum = existingInvoices.length + 1;
    const lastInv = existingInvoices[existingInvoices.length - 1];
    const lastNum = String(lastInv?.nomor || lastInv?.number || "");
    const matchPrefix = lastNum.match(/^(INV-IN\/\d{4}\/\d{2}\/\d+)/i)?.[1];
    const base = matchPrefix || `INV-IN/${year}/${month}/${baseSeq}`;
    if (continuationType === "pelunasan") {
      return `${base}/PELUNASAN`;
    }
    return `${base}/${nextTermNum}`;
  }

  if (scheme === "dp") {
    return `INV-IN/${year}/${month}/${baseSeq}/DP`;
  }
  if (scheme === "termin") {
    return `INV-IN/${year}/${month}/${baseSeq}/1`;
  }
  return `INV-IN/${year}/${month}/${baseSeq}`;
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

  // Mode: "baru" (Invoice Keluar Baru) vs "lanjut" (Lanjutkan Termin/DP) vs "masuk" (Invoice Masuk / Tagihan)
  const [mode, setMode] = React.useState<"baru" | "lanjut" | "masuk">(() => {
    if (defaultDirectPurchase) return "masuk";
    if (initialPo) {
      const poNum = String(initialPo.nomor || "").trim();
      const soNum = String(initialPo.nomorSo || "").trim();
      const hasExisting = (data.invoices ?? []).some(
        (inv: Row) =>
          (initialPo.id && String(inv.clientPoId) === String(initialPo.id)) ||
          (poNum && poNum !== "-" && (inv.po === poNum || String(inv.catatan || "").includes(poNum))) ||
          (soNum && soNum !== "-" && (inv.po === soNum || String(inv.catatan || "").includes(soNum))),
      );
      if (hasExisting) return "lanjut";
    }
    if (initialQuotation) {
      const qNum = String(initialQuotation.nomor || "").trim();
      const hasExisting = (data.invoices ?? []).some(
        (inv: Row) =>
          (initialQuotation.id && String(inv.quotationId) === String(initialQuotation.id)) ||
          (qNum && qNum !== "-" && (inv.quotation === qNum || String(inv.catatan || "").includes(qNum))),
      );
      if (hasExisting) return "lanjut";
    }
    return "baru";
  });

  // Source selection for Invoice Keluar: po, quotation, direct_sale, lead, or customer
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

  // Supplier & PO Supplier state for direct_purchase (Invoice Masuk Langsung)
  const [selectedSupplierId, setSelectedSupplierId] = React.useState<string>("");
  const [selectedSupplierPoId, setSelectedSupplierPoId] = React.useState<string>("");
  const [selectedParentInvoiceInId, setSelectedParentInvoiceInId] = React.useState<string>("");
  const [customSupplierName, setCustomSupplierName] = React.useState<string>("");
  const [purchaseCategoryCode, setPurchaseCategoryCode] = React.useState<string>("6202.01");

  const selectedParentInvoiceIn = React.useMemo(() => {
    if (!selectedParentInvoiceInId) return null;
    return (data.invoiceIn ?? []).find((inv: Row) => String(inv.id) === String(selectedParentInvoiceInId)) || null;
  }, [data.invoiceIn, selectedParentInvoiceInId]);

  const continuableInvoiceInOptions: { id: string; label: string; raw: Row }[] = React.useMemo(() => {
    return (data.invoiceIn ?? [])
      .filter((inv: Row) => {
        const st = String(inv.status || "").toUpperCase();
        if (st === "BATAL" || st === "DIBATALKAN") return false;
        const isPelunasan = /pelunasan/i.test(String(inv.jenis || inv.catatan || ""));
        if (isPelunasan) return false;
        const isDpOrTermin =
          inv.type === "DP" ||
          inv.type === "TERMIN" ||
          /dp|termin/i.test(String(inv.jenis || inv.catatan || inv.nomor || ""));
        return isDpOrTermin;
      })
      .map((inv: Row) => {
        const invNum = inv.nomor || inv.number || `INV-IN #${inv.id}`;
        const supp = inv.supplier || inv.customer || "-";
        const total = Number(inv.total ?? inv.nilai ?? 0);
        const termLabel = inv.jenis || (inv.type === "DP" ? "DP" : "Termin");
        return {
          id: String(inv.id),
          label: `${invNum} (${termLabel}) - ${supp} - ${rupiah(total)}`,
          raw: inv,
        };
      });
  }, [data.invoiceIn]);

  const invoiceInCategoryOptions = React.useMemo(
    () => [
      { code: "6202.01", label: "Tagihan Listrik / PLN [6202.01 - Biaya Listrik]", category: "Tagihan Listrik" },
      { code: "6202.03", label: "Tagihan Internet / WiFi / Telepon [6202.03 - Biaya Telekomunikasi]", category: "Tagihan Internet & Telekomunikasi" },
      { code: "6202.02", label: "Tagihan Air / PDAM [6202.02 - Biaya Air]", category: "Tagihan Air / PDAM" },
      { code: "6203.01", label: "Sewa / Pemeliharaan Gedung & Kantor [6203.01]", category: "Pemeliharaan Gedung & Kantor" },
      { code: "6203.02", label: "Servis Kendaraan / BBM / Operasional Lapangan [6203.02]", category: "Operasional Kendaraan" },
      { code: "6202.06", label: "Pembelian ATK & Perlengkapan Kantor [6202.06]", category: "ATK & Perlengkapan Kantor" },
      { code: "6202.07", label: "Tagihan Jasa / Operasional Umum Lainnya [6202.07]", category: "Tagihan Operasional Lainnya" },
      { code: "1200", label: "Pembelian Barang Stok / Persediaan Gudang [1200]", category: "Tagihan Supplier (Stok)" },
      { code: "5101", label: "Tagihan Subkon / Material Proyek [5101 - HPP Project]", category: "Tagihan Proyek" },
    ],
    []
  );

  const sourceTypeOptions = React.useMemo(
    () => [
      { value: "po" as InvoiceSourceType, label: "PO Client / Sales Order (SO)" },
      { value: "quotation" as InvoiceSourceType, label: "Penawaran (Quotation)" },
      { value: "direct_sale" as InvoiceSourceType, label: "Invoice Penjualan Langsung (Walk-in)" },
      { value: "lead" as InvoiceSourceType, label: "Lead / Prospek" },
      { value: "customer" as InvoiceSourceType, label: "Customer Langsung" },
    ],
    []
  );

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
  const [paymentFileId, setPaymentFileId] = React.useState<number | null>(null);

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

  // Kandidat untuk melanjutkan invoice: status rantai kontrak, bukan hanya
  // status invoice. Invoice DP/Termin yang sudah lunas tetap muncul selama
  // kontraknya masih punya sisa yang belum ditagih.
  const clientPos = data["po-client"];
  const continuableInvoiceOptions = React.useMemo(() => {
    const allInvoices = data.invoices ?? [];
    const quotations = data.quotations ?? [];
    const projects = data.projects ?? [];
    const clientPoList = clientPos ?? [];

    return collectContinuableInvoices(allInvoices, quotations, projects, clientPoList).map(
      ({ invoice: inv, chain }) => {
        const invNum = inv.nomor || inv.number || `INV #${inv.id}`;
        const cust = inv.customer || "-";
        const jenis = inv.jenis || (String(inv.type || "").toUpperCase() === "DP" ? "DP" : "Invoice");
        const amountStr = rupiah(invoiceAmount(inv));
        const outstanding = Math.max(0, invoiceAmount(inv) - invoicePaidAmount(inv));
        const remainingLabel =
          outstanding > 0
            ? ` · Sisa ${rupiah(outstanding)}`
            : chain.remainingToBill > 0
              ? ` · Sisa kontrak ${rupiah(chain.remainingToBill)}`
              : "";

        return {
          id: String(inv.id),
          label: `${invNum} — ${cust} — ${jenis} (${amountStr})${remainingLabel}`,
          nomor: invNum,
          customer: cust,
          raw: inv,
          chain,
        };
      },
    );
  }, [data.invoices, data.quotations, data.projects, clientPos]);

  const [selectedParentInvoiceId, setSelectedParentInvoiceId] = React.useState<string>(() => {
    if (initialPo) {
      const match = continuableInvoiceOptions.find(
        (o) =>
          String(o.raw.clientPoId) === String(initialPo.id) ||
          (initialPo.nomor && (o.raw.po === initialPo.nomor || o.raw.nomorSo === initialPo.nomor)) ||
          (initialPo.nomorSo && (o.raw.po === initialPo.nomorSo || o.raw.nomorSo === initialPo.nomorSo)),
      );
      if (match) return match.id;
    }
    if (initialQuotation) {
      const match = continuableInvoiceOptions.find(
        (o) =>
          String(o.raw.quotationId) === String(initialQuotation.id) ||
          (initialQuotation.nomor && initialQuotation.nomor !== "-" && o.raw.quotation === initialQuotation.nomor),
      );
      if (match) return match.id;
    }
    return "";
  });

  const selectedParentInvoice = React.useMemo(() => {
    if (!selectedParentInvoiceId) return null;
    return (data.invoices ?? []).find((inv: Row) => String(inv.id) === String(selectedParentInvoiceId)) || null;
  }, [data.invoices, selectedParentInvoiceId]);

  const selectedParentChain = React.useMemo(
    () => continuableInvoiceOptions.find((o) => o.id === selectedParentInvoiceId)?.chain ?? null,
    [continuableInvoiceOptions, selectedParentInvoiceId],
  );

  // Items
  const [items, setItems] = React.useState<QuotationItem[]>(() => {
    // If starting in lanjut mode, items should be empty so no physical items/cameras are selected!
    if (initialPo) {
      const hasExisting = (data.invoices ?? []).some(
        (inv: Row) =>
          String(inv.clientPoId) === String(initialPo.id) ||
          (initialPo.nomor && (inv.po === initialPo.nomor || String(inv.catatan || "").includes(initialPo.nomor))) ||
          (initialPo.nomorSo && (inv.po === initialPo.nomorSo || String(inv.catatan || "").includes(initialPo.nomorSo))),
      );
      if (hasExisting) return [];
    }
    if (initialQuotation) {
      const hasExisting = (data.invoices ?? []).some(
        (inv: Row) =>
          String(inv.quotationId) === String(initialQuotation.id) ||
          inv.quotation === initialQuotation.nomor ||
          String(inv.catatan || "").includes(initialQuotation.nomor),
      );
      if (hasExisting) return [];
    }
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
    if (mode === "lanjut") {
      if (!selectedParentInvoice) return null;
      if (selectedParentInvoice.quotationId) {
        return (data.quotations ?? []).find((q: Row) => String(q.id) === String(selectedParentInvoice.quotationId)) || null;
      }
      if (selectedParentInvoice.quotation) {
        return (data.quotations ?? []).find((q: Row) => q.nomor === selectedParentInvoice.quotation) || null;
      }
      return null;
    }
    if (selectedQuotationId) {
      return (data.quotations ?? []).find((q: Row) => String(q.id) === String(selectedQuotationId)) || null;
    }
    if (selectedParentInvoice?.quotationId) {
      return (data.quotations ?? []).find((q: Row) => String(q.id) === String(selectedParentInvoice.quotationId)) || null;
    }
    if (selectedParentInvoice?.quotation) {
      return (data.quotations ?? []).find((q: Row) => q.nomor === selectedParentInvoice.quotation) || null;
    }
    return initialQuotation || null;
  }, [mode, data, selectedQuotationId, initialQuotation, selectedParentInvoice]);

  const activePo = React.useMemo(() => {
    if (mode === "lanjut") {
      if (!selectedParentInvoice) return null;
      if (selectedParentInvoice.clientPoId) {
        return (data["po-client"] ?? []).find((p: Row) => String(p.id) === String(selectedParentInvoice.clientPoId)) || null;
      }
      if (selectedParentInvoice.po) {
        return (data["po-client"] ?? []).find((p: Row) => p.nomor === selectedParentInvoice.po || p.nomorSo === selectedParentInvoice.po) || null;
      }
      return null;
    }
    if (selectedPoId) {
      return (data["po-client"] ?? []).find((p: Row) => String(p.id) === String(selectedPoId)) || initialPo || null;
    }
    if (selectedParentInvoice?.clientPoId) {
      return (data["po-client"] ?? []).find((p: Row) => String(p.id) === String(selectedParentInvoice.clientPoId)) || null;
    }
    if (selectedParentInvoice?.po) {
      return (data["po-client"] ?? []).find((p: Row) => p.nomor === selectedParentInvoice.po || p.nomorSo === selectedParentInvoice.po) || null;
    }
    return initialPo || null;
  }, [mode, data, selectedPoId, initialPo, selectedParentInvoice]);

  const activeLead = React.useMemo(() => {
    if (mode === "lanjut") {
      if (!selectedParentInvoice) return null;
      if (selectedParentInvoice.leadId) {
        return (data.leads ?? []).find((l: Row) => String(l.id) === String(selectedParentInvoice.leadId)) || null;
      }
      return null;
    }
    if (selectedLeadId) {
      return (data.leads ?? []).find((l: Row) => String(l.id) === String(selectedLeadId)) || null;
    }
    return initialLead || null;
  }, [mode, data, selectedLeadId, initialLead, selectedParentInvoice]);

  // Existing invoices related to active quotation, PO, Lead, or selected Parent Invoice
  const relatedExistingInvoices = React.useMemo(() => {
    if (mode === "masuk") {
      if (selectedParentInvoiceIn) {
        const parentId = String(selectedParentInvoiceIn.id);
        const suppPoId = selectedParentInvoiceIn.supplierPoId;
        const parentNum = selectedParentInvoiceIn.nomor || selectedParentInvoiceIn.number;
        const matchPrefix = parentNum ? String(parentNum).match(/^(INV-IN\/\d{4}\/\d{2}\/\d+)/i)?.[1] : null;

        return (data.invoiceIn ?? []).filter((inv: Row) => {
          const st = String(inv.status || "").toUpperCase();
          if (st === "BATAL" || st === "DIBATALKAN") return false;
          if (String(inv.id) === parentId) return true;
          if (suppPoId && String(inv.supplierPoId) === String(suppPoId)) return true;
          if (matchPrefix && String(inv.nomor || inv.number || "").startsWith(matchPrefix)) return true;
          return false;
        });
      }
      if (selectedSupplierPoId) {
        return (data.invoiceIn ?? []).filter((inv: Row) => {
          const st = String(inv.status || "").toUpperCase();
          if (st === "BATAL" || st === "DIBATALKAN") return false;
          return String(inv.supplierPoId) === String(selectedSupplierPoId);
        });
      }
      return [];
    }

    if (mode === "lanjut") {
      if (!selectedParentInvoice) return [];
      const parentId = String(selectedParentInvoice.id);
      const rootParentId = selectedParentInvoice.parentInvoiceId ? String(selectedParentInvoice.parentInvoiceId) : parentId;
      const parentNum = selectedParentInvoice.nomor || selectedParentInvoice.number;
      const matchPrefix = parentNum ? String(parentNum).match(/^(INV\/\d{4}\/\d{2}\/\d+)/i)?.[1] : null;

      const parentPoId = selectedParentInvoice.clientPoId;
      const parentQuoteId = selectedParentInvoice.quotationId;

      return (data.invoices ?? []).filter((inv: Row) => {
        const st = String(inv.status || "").toUpperCase();
        if (st === "BATAL" || st === "DIBATALKAN") return false;

        // 1. Same ID
        if (String(inv.id) === parentId) return true;

        // 2. Parent / sibling chain linkage
        if (inv.parentInvoiceId && (String(inv.parentInvoiceId) === parentId || String(inv.parentInvoiceId) === rootParentId)) return true;
        if (String(inv.id) === rootParentId) return true;

        // 3. Same invoice base numbering prefix (e.g. INV/2026/11/005/1 and INV/2026/11/005/2)
        if (matchPrefix && String(inv.nomor || inv.number || "").startsWith(matchPrefix)) return true;

        // 4. Same exact client PO / Quotation ID if defined on parent invoice
        if (parentPoId && String(inv.clientPoId) === String(parentPoId)) return true;
        if (parentQuoteId && String(inv.quotationId) === String(parentQuoteId)) return true;

        return false;
      });
    }

    const qNomor = activeQuotation?.nomor;
    const qId = activeQuotation?.id;
    const poNum = activePo?.nomor || activePo?.number || activePo?.nomorSo;
    const poId = activePo?.id;
    const leadId = activeLead?.id;
    const leadName = activeLead?.nama ? String(activeLead.nama).trim().toLowerCase() : "";

    return (data.invoices ?? []).filter((inv: Row) => {
      const st = String(inv.status || "").toUpperCase();
      if (st === "BATAL" || st === "DIBATALKAN") return false;

      if (qId && String(inv.quotationId) === String(qId)) return true;
      if (qNomor && qNomor !== "-" && inv.quotation === qNomor) return true;
      if (poId && String(inv.clientPoId) === String(poId)) return true;
      if (poNum && poNum !== "-" && (inv.po === poNum || inv.nomorSo === poNum)) return true;
      if (leadId && String(inv.leadId) === String(leadId)) return true;
      return false;
    });
  }, [mode, selectedParentInvoice, selectedParentInvoiceIn, selectedSupplierPoId, data.invoices, data.invoiceIn, activeQuotation, activePo, activeLead]);

  // Invoice Number
  const [nomor, setNomor] = React.useState<string>(() => {
    if (defaultDirectPurchase) {
      return generateInvoiceInNumber(
        "sekaligus",
        [],
        data.invoiceIn?.length || 0,
        data.invoiceIn,
      );
    }
    return generateInvoiceNumber(
      mode === "lanjut",
      scheme,
      relatedExistingInvoices,
      data.invoices?.length || 0,
      data.invoices,
    );
  });

  const terminNumber = relatedExistingInvoices.length + 1;

  // Active quotation discount
  const quotationDisc = React.useMemo(() => {
    const rawDisc =
      activeQuotation?.disc ??
      activeQuotation?.discount ??
      activePo?.discount ??
      activePo?.disc ??
      selectedParentInvoice?.discount ??
      (data.quotations ?? []).find((q: Row) => String(q.id) === String(activePo?.quotationId))?.disc ??
      (data.quotations ?? []).find((q: Row) => String(q.id) === String(activePo?.quotationId))?.discount ??
      0;
    return Number(String(rawDisc).replace(/\D/g, "")) || 0;
  }, [activeQuotation, activePo, selectedParentInvoice, data.quotations]);

  // Total gross items / amount before discount
  const grossDealDpp = React.useMemo(() => {
    if (mode === "masuk") {
      if (selectedParentInvoiceIn) {
        const pctMatch = String(selectedParentInvoiceIn.catatan || selectedParentInvoiceIn.notes || selectedParentInvoiceIn.dpLabel || "").match(/(\d+)%/);
        const pct = pctMatch ? Number(pctMatch[1]) : 0;
        if (pct > 0 && pct < 100 && selectedParentInvoiceIn.nilai) {
          return Math.round((Number(selectedParentInvoiceIn.nilai) / pct) * 100);
        }
        if (selectedParentInvoiceIn.nilai) return Number(selectedParentInvoiceIn.nilai);
      }
      const suppPoObj = (data["supplier-pos"] ?? []).find((p: Row) => String(p.id) === String(selectedSupplierPoId));
      if (suppPoObj?.total || suppPoObj?.nilai || suppPoObj?.dpp) {
        return Number(suppPoObj.dpp || suppPoObj.total || suppPoObj.nilai);
      }
      if (items.length > 0) {
        return items.reduce((acc, curr) => acc + (Number(curr.qty) || 1) * (Number(curr.harga) || Number((curr as any).price) || 0), 0);
      }
      return Number(String(customDpp).replace(/\D/g, "")) || 0;
    }
    if (mode === "baru" && items.length > 0) {
      return items.reduce((acc, curr) => acc + (Number(curr.qty) || 1) * (Number(curr.harga) || Number((curr as any).price) || 0), 0);
    }
    if (activeQuotation?.total) return Number(activeQuotation.total);
    if (activeQuotation?.nilai) return Number(activeQuotation.nilai);
    if (activeQuotation?.items && Array.isArray(activeQuotation.items) && activeQuotation.items.length > 0) {
      return activeQuotation.items.reduce((acc: number, curr: any) => acc + (Number(curr.qty) || 1) * (Number(curr.harga) || Number(curr.price) || 0), 0);
    }
    if (sourceType === "po" && activePo?.nilai) return Number(activePo.nilai);
    if (activePo?.items && Array.isArray(activePo.items) && activePo.items.length > 0) {
      return activePo.items.reduce((acc: number, curr: any) => acc + (Number(curr.qty) || 1) * (Number(curr.harga) || Number(curr.price) || 0), 0);
    }
    if (selectedParentInvoice?.nilai) {
      const pctMatch = String(selectedParentInvoice.dpLabel || selectedParentInvoice.catatan || selectedParentInvoice.description || "").match(/(\d+)%/);
      const pct = pctMatch ? Number(pctMatch[1]) : 0;
      if (pct > 0 && pct < 100) {
        return Math.round((Number(selectedParentInvoice.nilai) / pct) * 100);
      }
      return Number(selectedParentInvoice.nilai);
    }
    if (activeLead?.nilai) return Number(activeLead.nilai);
    return Number(String(customDpp).replace(/\D/g, "")) || 0;
  }, [items, mode, activeQuotation, activePo, activeLead, customDpp, selectedParentInvoice, sourceType]);

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

  const [pphMode, setPphMode] = React.useState<PphMode>(() => {
    const poMode = getInitialPphMode(initialPo);
    if (poMode !== "none") return poMode;
    const qMode = getInitialPphMode(activeQuotation);
    if (qMode !== "none") return qMode;
    if (Array.isArray(initialPo?.items)) {
      for (const it of initialPo.items) {
        if (it.pphMode && it.pphMode !== "none") return it.pphMode as PphMode;
      }
    }
    return "none";
  });

  const dealPph = React.useMemo(() => {
    if (items.length > 0) {
      const sum = items.reduce((acc, it) => acc + calcItemPph(it), 0);
      if (sum > 0) return sum;
    }
    if (Array.isArray(activePo?.items) && activePo.items.length > 0) {
      const sum = activePo.items.reduce((acc: number, it: any) => acc + calcItemPph(it), 0);
      if (sum > 0) return sum;
    }
    if (Number(activePo?.pph) > 0) return Number(activePo?.pph);
    if (Number(activeQuotation?.pph) > 0) return Number(activeQuotation?.pph);
    const effRate = pphRateFor(pphMode);
    if (effRate > 0) {
      const sourceItems = items.length > 0 ? items : ((activePo?.items as any[]) || (activeQuotation?.items as any[]) || []);
      const serviceDpp = sourceItems.reduce((acc: number, it: any) => {
        const isJasa =
          (it as any).itemType === "JASA" ||
          !it.productId ||
          /^\[(JASA)\]/i.test(String((it as any).customName || it.name || it.item || ""));
        return isJasa ? acc + (Number(it.qty) || 1) * Number(it.harga ?? (it as any).price ?? 0) : acc;
      }, 0);
      if (serviceDpp > 0) return Math.round(serviceDpp * effRate);
      return Math.round(dealDpp * effRate);
    }
    return 0;
  }, [items, activePo, activeQuotation, pphMode, dealDpp]);

  const dealPpn = isNoPpn ? 0 : isIncludePpn ? Math.max(0, dealDpp - Math.round(dealDpp / 1.11)) : Math.round(dealDpp * 0.11);
  const dealGrandTotal = Math.max(0, (isNoPpn || isIncludePpn ? dealDpp : dealDpp + dealPpn) - dealPph);

  // Total already billed in DPP
  const alreadyBilledDpp = React.useMemo(() => {
    return relatedExistingInvoices.reduce((acc: number, inv: Row) => acc + (Number(inv.nilai) || 0), 0);
  }, [relatedExistingInvoices]);

  const remainingDpp = Math.max(0, dealDpp - alreadyBilledDpp);

  // Submitting & File extracting
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [pickerOpen, setPickerOpen] = React.useState<boolean>(false);

  // Select parent invoice handler (Mode Lanjut)
  function handleSelectParentInvoice(invoiceId: string) {
    setSelectedParentInvoiceId(invoiceId);
    const parent = (data.invoices ?? []).find((inv: Row) => String(inv.id) === String(invoiceId));
    if (!parent) return;

    if (parent.customerId) {
      setSelectedCustomerId(String(parent.customerId));
    } else {
      setSelectedCustomerId("");
    }
    if (parent.customer) {
      setCustomCustomerName(String(parent.customer));
    } else {
      setCustomCustomerName("");
    }

    let matchedQuote: Row | null = null;
    if (parent.quotationId) {
      setSelectedQuotationId(String(parent.quotationId));
      matchedQuote = (data.quotations ?? []).find((x: Row) => String(x.id) === String(parent.quotationId)) || null;
    } else if (parent.quotation) {
      matchedQuote = (data.quotations ?? []).find((x: Row) => x.nomor === parent.quotation) || null;
      setSelectedQuotationId(matchedQuote ? String(matchedQuote.id) : "");
    } else {
      setSelectedQuotationId("");
    }

    if (matchedQuote) {
      if (matchedQuote.tipePpn || matchedQuote.ppnMode) setPpnMode(getInitialPpnMode(matchedQuote));
      if (matchedQuote.pphMode) setPphMode(matchedQuote.pphMode as PphMode);
      if (matchedQuote.discount || matchedQuote.disc) setCustomDiscount(formatThousands(matchedQuote.discount || matchedQuote.disc));
      if (matchedQuote.customerId) setSelectedCustomerId(String(matchedQuote.customerId));
    }

    if (parent.clientPoId) {
      setSelectedPoId(String(parent.clientPoId));
    } else if (parent.po) {
      const matchedPo = (data["po-client"] ?? []).find((p: Row) => p.nomor === parent.po || p.nomorSo === parent.po);
      setSelectedPoId(matchedPo ? String(matchedPo.id) : "");
    } else {
      setSelectedPoId("");
    }

    if (parent.leadId) {
      setSelectedLeadId(String(parent.leadId));
    } else {
      setSelectedLeadId("");
    }

    if (parent.ppnMode) setPpnMode(parent.ppnMode as PpnMode);
    else if (parent.tipePpn) setPpnMode(getInitialPpnMode(parent));

    if (parent.pphMode) setPphMode(parent.pphMode as PphMode);
    if (parent.discount) setCustomDiscount(formatThousands(parent.discount));

    // Clear items in lanjut mode so no physical items/cameras are selected!
    setItems([]);

    // Calculate siblings specifically for this parent to get the correct next invoice number
    const parentId = String(parent.id);
    const rootParentId = parent.parentInvoiceId ? String(parent.parentInvoiceId) : parentId;
    const parentNum = parent.nomor || parent.number;
    const matchPrefix = parentNum ? String(parentNum).match(/^(INV\/\d{4}\/\d{2}\/\d+)/i)?.[1] : null;
    const parentPoId = parent.clientPoId;
    const parentQuoteId = parent.quotationId;

    const siblings = (data.invoices ?? []).filter((inv: Row) => {
      const st = String(inv.status || "").toUpperCase();
      if (st === "BATAL" || st === "DIBATALKAN") return false;
      if (String(inv.id) === parentId) return true;
      if (inv.parentInvoiceId && (String(inv.parentInvoiceId) === parentId || String(inv.parentInvoiceId) === rootParentId)) return true;
      if (String(inv.id) === rootParentId) return true;
      if (matchPrefix && String(inv.nomor || inv.number || "").startsWith(matchPrefix)) return true;
      if (parentPoId && String(inv.clientPoId) === String(parentPoId)) return true;
      if (parentQuoteId && String(inv.quotationId) === String(parentQuoteId)) return true;
      return false;
    });

    setNomor(generateInvoiceNumber(true, scheme, siblings, data.invoices?.length || 0, data.invoices));
  }

  // Switch mode handler
  function handleSwitchMode(newMode: "baru" | "lanjut" | "masuk") {
    setMode(newMode);
    if (newMode === "masuk") {
      setSourceType("direct_purchase");
      setScheme("sekaligus");
      setItems([]);
      setPaymentStatus("PAID");
      setNomor(
        generateInvoiceInNumber(
          "sekaligus",
          relatedExistingInvoices,
          data.invoiceIn?.length || 0,
          data.invoiceIn,
        ),
      );
      if (!catatan || catatan === "Nota Penjualan Langsung (Walk-in)" || catatan.startsWith("Invoice untuk")) {
        setCatatan("Tagihan Operasional / Invoice Masuk");
      }
    } else if (newMode === "lanjut") {
      if (sourceType === "direct_purchase") setSourceType("po");
      setItems([]);
      let candidateId = continuableInvoiceOptions.some((o) => o.id === selectedParentInvoiceId)
        ? selectedParentInvoiceId
        : "";
      if (!candidateId) {
        if (initialPo) {
          const match = continuableInvoiceOptions.find(
            (o) =>
              String(o.raw.clientPoId) === String(initialPo.id) ||
              (initialPo.nomor && (o.raw.po === initialPo.nomor || o.raw.nomorSo === initialPo.nomor)) ||
              (initialPo.nomorSo && (o.raw.po === initialPo.nomorSo || o.raw.nomorSo === initialPo.nomorSo))
          );
          if (match) candidateId = match.id;
        }
        if (!candidateId && initialQuotation) {
          const match = continuableInvoiceOptions.find(
            (o) =>
              String(o.raw.quotationId) === String(initialQuotation.id) ||
              (initialQuotation.nomor && initialQuotation.nomor !== "-" && o.raw.quotation === initialQuotation.nomor)
          );
          if (match) candidateId = match.id;
        }
      }
      if (candidateId) {
        handleSelectParentInvoice(candidateId);
      } else {
        setSelectedParentInvoiceId("");
      }
    } else {
      if (sourceType === "direct_purchase") setSourceType("po");
      if (activeQuotation?.items && Array.isArray(activeQuotation.items)) {
        setItems(activeQuotation.items);
      } else if (activePo?.items && Array.isArray(activePo.items)) {
        setItems(activePo.items);
      }
      setNomor(generateInvoiceNumber(false, scheme, relatedExistingInvoices, data.invoices?.length || 0, data.invoices));
    }
  }

  // Switch scheme handler
  function handleSwitchScheme(newScheme: "sekaligus" | "dp" | "termin") {
    setScheme(newScheme);
    if (mode === "masuk") {
      setNomor(
        generateInvoiceInNumber(
          newScheme,
          relatedExistingInvoices,
          data.invoiceIn?.length || 0,
          data.invoiceIn,
          continuationType,
        ),
      );
      return;
    }
    setNomor(generateInvoiceNumber(mode === "lanjut", newScheme, relatedExistingInvoices, data.invoices?.length || 0, data.invoices));
  }

  // Select quotation handler
  function handleSelectQuotation(q: Row | null) {
    if (!q) {
      setSelectedQuotationId("");
      return;
    }
    setSelectedQuotationId(String(q.id));
    if (q.customerId) setSelectedCustomerId(String(q.customerId));
    const detectedPph = getInitialPphMode(q);
    if (detectedPph !== "none") setPphMode(detectedPph);
    else if (q.pphMode) setPphMode(q.pphMode as PphMode);
    if (q.tipePpn || q.ppnMode) setPpnMode(getInitialPpnMode(q));
    if (mode === "baru") {
      if (Array.isArray(q.items) && q.items.length > 0) {
        setItems(q.items);
      } else if (q.nilai) {
        setCustomDpp(formatThousands(q.nilai));
      }
    } else {
      setItems([]);
    }

    const rawDisc = Number(q.discount ?? q.disc ?? 0);
    if (rawDisc > 0) {
      setCustomDiscount(formatThousands(rawDisc));
      const baseGross = Number(q.nilai || q.total || 0);
      if (baseGross > 0) {
        setDiscPercent(String(Math.round(((rawDisc / baseGross) * 100) * 10) / 10));
      } else {
        setDiscPercent("");
      }
    } else {
      setCustomDiscount("");
      setDiscPercent("");
    }

    if (q.catatan) {
      setCatatan(q.catatan);
    }
  }

  // Select PO / Sales Order handler
  function handleSelectPo(match: Row | null) {
    if (!match) {
      setSelectedPoId("");
      return;
    }
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
    if (mode === "baru") {
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
    } else {
      setItems([]);
    }
    if (match.tipePpn || match.ppnMode) {
      setPpnMode(getInitialPpnMode(match));
    }
    const detectedPph = getInitialPphMode(match);
    if (detectedPph !== "none") {
      setPphMode(detectedPph);
    } else if (match.pphMode && match.pphMode !== "none") {
      setPphMode(match.pphMode as PphMode);
    }
    if (match.discount || match.disc) {
      setCustomDiscount(formatThousands(match.discount || match.disc));
    }
  }

  // Select lead handler
  function handleSelectLead(l: Row | null) {
    if (!l) {
      setSelectedLeadId("");
      return;
    }
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

    if (mode === "masuk") {
      if (relatedExistingInvoices.length > 0) {
        if (continuationType === "pelunasan") {
          dpp = remainingDpp;
          pct = dealDpp > 0 ? Math.round((dpp / dealDpp) * 100) : 100;
        } else {
          pct = Number(terminPercent) || (dealDpp > 0 ? Math.round((remainingDpp / dealDpp) * 100) : 30);
          dpp = Math.min(remainingDpp, Math.round(dealDpp * (pct / 100)));
        }
      } else if (scheme === "dp") {
        pct = Number(dpPercent) || 50;
        dpp = Math.round(dealDpp * (pct / 100));
      } else if (scheme === "termin") {
        pct = Number(terminPercent) || 30;
        dpp = Math.round(dealDpp * (pct / 100));
      } else {
        pct = 100;
        dpp = dealDpp;
      }
    } else if (mode === "baru") {
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

    // Cari porsi DPP Jasa yang terkena PPh dari item SO / penawaran
    const sourceItems =
      items.length > 0
        ? items
        : Array.isArray(activePo?.items) && activePo.items.length > 0
        ? activePo.items
        : Array.isArray(activeQuotation?.items) && activeQuotation.items.length > 0
        ? activeQuotation.items
        : [];

    let totalServiceDpp = 0;
    if (sourceItems.length > 0) {
      totalServiceDpp = sourceItems.reduce((acc: number, it: any) => {
        const isJasa =
          !it.productId ||
          it.productId === null ||
          it.itemType === "JASA" ||
          (it.pphMode && it.pphMode !== "none") ||
          Number(it.pph) > 0 ||
          /^\[(JASA)\]/i.test(String(it.customName || it.name || it.item || ""));
        return isJasa ? acc + (Number(it.qty) || 1) * Number(it.harga ?? it.price ?? 0) : acc;
      }, 0);
    } else {
      const refPph = Number(activePo?.pph ?? activeQuotation?.pph ?? 0);
      const refPphMode = (activePo?.pphMode ?? activeQuotation?.pphMode ?? pphMode) as PphMode;
      if (refPph > 0 && refPphMode !== "none") {
        const rate = pphRateFor(refPphMode);
        if (rate > 0) totalServiceDpp = Math.round(refPph / rate);
      }
    }

    const effPphRate = pphRateFor(pphMode);
    const itemPphSum = items.reduce((acc, it) => acc + calcItemPph(it), 0);
    let pph = 0;
    if (itemPphSum > 0) {
      pph = pct === 100 ? itemPphSum : Math.round(itemPphSum * (pct / 100));
    } else if (effPphRate > 0) {
      if (totalServiceDpp > 0) {
        const invoiceServiceDpp = Math.min(effectiveDpp, Math.round(totalServiceDpp * (pct / 100)));
        pph = Math.round(invoiceServiceDpp * effPphRate);
      } else {
        pph = Math.round(effectiveDpp * effPphRate);
      }
    }

    const total = Math.max(0, (isIncludePpn ? rawBase : effectiveDpp + ppn) - pph);
    return { currentDpp: effectiveDpp, currentPpn: ppn, currentPph: pph, currentTotal: total, calculatedPct: pct };
  }, [mode, scheme, dpPercent, terminPercent, dealDpp, continuationType, remainingDpp, isNoPpn, isIncludePpn, pphMode, items, activePo, activeQuotation]);

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

    const isPurchase = mode === "masuk" || sourceType === "direct_purchase";
    const supplierObj = (data.suppliers ?? []).find((s: Row) => String(s.id) === String(selectedSupplierId));
    const suppPoObj = (data["supplier-pos"] ?? []).find((p: Row) => String(p.id) === String(selectedSupplierPoId));
    const customerObj = (data.customers ?? []).find((c: Row) => String(c.id) === String(selectedCustomerId));

    const validCustStr = (v?: string | null) => (v && v !== "-" ? v : null);
    const custName = isPurchase
      ? customSupplierName || supplierObj?.nama || supplierObj?.name || "Supplier Pembelian Langsung"
      : validCustStr(customCustomerName) ||
        validCustStr(customerObj?.nama) ||
        (sourceType === "direct_sale" ? "Pelanggan Langsung (Walk-in)" : null) ||
        validCustStr(activeQuotation?.customer) ||
        validCustStr(activePo?.customer) ||
        validCustStr(activeLead?.perusahaan) ||
        validCustStr(activeLead?.nama) ||
        (sourceType === "direct_sale" ? "Pelanggan Langsung (Walk-in)" : "Pelanggan Umum");

    const invoiceType =
      mode === "lanjut" || (mode === "masuk" && relatedExistingInvoices.length > 0)
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
      mode === "lanjut" || (mode === "masuk" && relatedExistingInvoices.length > 0)
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
    const effectiveInvoicePphMode: PphMode =
      pphMode !== "none"
        ? pphMode
        : items.find((it: any) => it.pphMode && it.pphMode !== "none")?.pphMode ||
          activePo?.pphMode ||
          (currentPph > 0 ? "pph23" : "none");
    try {
      if (isPurchase) {
        const selectedCatOpt =
          invoiceInCategoryOptions.find((o) => o.code === purchaseCategoryCode) ||
          invoiceInCategoryOptions[0]!;
        const accLabel =
          kasBankOptions.find((o) => o.code === paymentAccountCode)?.rawName || paymentMethod;
        const createdIn = await addRow("invoiceIn", {
          nomor: nomor.trim() || undefined,
          supplierId: selectedSupplierId ? Number(selectedSupplierId) : undefined,
          supplier: custName,
          supplierPoId: selectedSupplierPoId ? Number(selectedSupplierPoId) : undefined,
          po: suppPoObj?.nomor || suppPoObj?.number || undefined,
          category: selectedCatOpt.category,
          debitAccount: purchaseCategoryCode,
          type: invoiceType.toUpperCase(),
          jenis: invoiceType,
          dpLabel: scheme === "dp" ? `DP ${calculatedPct}%` : undefined,
          dpAmount: scheme === "dp" ? currentTotal : undefined,
          nilai: currentDpp,
          ppn: currentPpn,
          pph: currentPph,
          pphMode: effectiveInvoicePphMode,
          tipePph: pphModeToTipe(effectiveInvoicePphMode),
          total: currentTotal,
          tanggal,
          jatuhTempo: isPaidNow ? tanggal : jatuhTempo,
          status: isPaidNow ? "Lunas" : "Belum dibayar",
          terbayar: isPaidNow ? currentTotal : 0,
          paid: isPaidNow,
          paymentMethod,
          coaAccount: paymentAccountCode,
          paymentReference: isPaidNow
            ? `LUNAS-${nomor.trim()} [AKUN:${paymentAccountCode}]`
            : undefined,
          notes: isPaidNow
            ? `${fullCatatan} (Lunas via ${accLabel} [AKUN:${paymentAccountCode}])`
            : fullCatatan,
          catatan: isPaidNow
            ? `${fullCatatan} (Lunas via ${accLabel} [AKUN:${paymentAccountCode}])`
            : fullCatatan,
          items: items.length > 0 ? items : undefined,
          fileId: fileId || undefined,
          paymentFileId: isPaidNow && paymentFileId ? paymentFileId : undefined,
          transferFileId: isPaidNow && paymentFileId ? paymentFileId : undefined,
        });

        if (createdIn) {
          toast(
            `Invoice Masuk ${nomor} (${selectedCatOpt.category}) berhasil disimpan${
              isPaidNow ? ` & langsung Lunas (${accLabel})` : ""
            }!`
          );
          if (selectedSupplierPoId) {
            pushHistory(
              "supplier-pos",
              selectedSupplierPoId,
              `Invoice Masuk ${nomor} (${rupiah(currentTotal)}) dibuat`
            );
          }
          onClose();
          await reload();
          await onSuccess?.();
        }
        return;
      }

      const created = await addRow("invoices", {
        nomor: nomor.trim() || undefined,
        customer: custName,
        customerId: isPurchase ? undefined : (selectedCustomerId || (customerObj?.id ? String(customerObj.id) : undefined)),
        supplierId: isPurchase ? (selectedSupplierId ? Number(selectedSupplierId) : undefined) : undefined,
        supplier: isPurchase ? custName : undefined,
        supplierPoId: isPurchase && selectedSupplierPoId ? Number(selectedSupplierPoId) : undefined,
        projectId: mode === "lanjut" && selectedParentInvoice?.projectId
          ? Number(selectedParentInvoice.projectId)
          : (activeQuotation?.projectId ? Number(activeQuotation.projectId) : undefined),
        project: mode === "lanjut" && selectedParentInvoice?.project
          ? selectedParentInvoice.project
          : (activeQuotation?.project || undefined),
        leadId: activeLead?.id ? String(activeLead.id) : undefined,
        lead: activeLead?.nama || undefined,
        quotationId: activeQuotation?.id
          ? String(activeQuotation.id)
          : (mode === "lanjut" && selectedParentInvoice?.quotationId ? String(selectedParentInvoice.quotationId) : undefined),
        quotation: activeQuotation?.nomor || (mode === "lanjut" ? selectedParentInvoice?.quotation : undefined) || undefined,
        clientPoId: activePo?.id
          ? String(activePo.id)
          : (mode === "lanjut" && selectedParentInvoice?.clientPoId ? String(selectedParentInvoice.clientPoId) : undefined),
        po: isPurchase
          ? suppPoObj?.nomor || suppPoObj?.number || undefined
          : activePo?.nomor || activePo?.nomorSo || activePo?.number || (mode === "lanjut" ? selectedParentInvoice?.po : undefined) || undefined,
        jenis: invoiceType,
        nilai: currentDpp,
        discount: effectiveDiscount > 0 ? effectiveDiscount : undefined,
        tipePpn: ppnModeToTipe(ppnMode),
        ppnMode,
        ppn: currentPpn,
        pph: currentPph,
        pphMode: effectiveInvoicePphMode,
        tipePph: pphModeToTipe(effectiveInvoicePphMode),
        total: currentTotal,
        items: mode === "lanjut"
          ? [
              {
                item: termDesc,
                qty: 1,
                satuan: "paket",
                harga: currentDpp,
                total: currentDpp,
                isContinuation: true,
                kind: "SERVICE",
              },
            ]
          : items.length > 0 ? items : undefined,
        isContinuation: mode === "lanjut",
        parentInvoiceId: mode === "lanjut" && selectedParentInvoiceId ? Number(selectedParentInvoiceId) : undefined,
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
            fileId: paymentFileId || undefined,
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
              ? "Buat Invoice Masuk (Tagihan / Pembelian)"
              : sourceType === "direct_sale"
              ? "Invoice Penjualan Langsung"
              : "Buat Invoice Penagihan (Invoice Keluar)"}
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
              Acuan: {selectedParentInvoice.nomor || selectedParentInvoice.number}
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
        {/* Mode Switcher (3 Tab: Invoice Keluar Baru | Lanjutkan Termin / DP | Invoice Masuk) */}
        <View className="flex-row flex-wrap rounded-lg bg-panel p-1 border border-border mb-4 gap-1">
          <Button
            variant={mode === "baru" ? "default" : "ghost"}
            size="sm"
            onPress={() => handleSwitchMode("baru")}
            className="flex-1 min-w-[160px] h-8"
          >
            <Text className={`text-xs font-semibold ${mode === "baru" ? "text-primary-foreground" : "text-muted-foreground"}`}>
              Invoice Keluar Baru
            </Text>
          </Button>
          <Button
            variant={mode === "lanjut" ? "default" : "ghost"}
            size="sm"
            onPress={() => handleSwitchMode("lanjut")}
            className="flex-1 min-w-[160px] h-8"
          >
            <Text className={`text-xs font-semibold ${mode === "lanjut" ? "text-primary-foreground" : "text-muted-foreground"}`}>
              Lanjutkan Termin / DP
            </Text>
          </Button>
          <Button
            variant={mode === "masuk" ? "default" : "ghost"}
            size="sm"
            onPress={() => handleSwitchMode("masuk")}
            className="flex-1 min-w-[170px] h-8"
          >
            <Text className={`text-xs font-semibold ${mode === "masuk" ? "text-primary-foreground" : "text-muted-foreground"}`}>
              Invoice Masuk (Tagihan / Beli)
            </Text>
          </Button>
        </View>

        {/* Source Link Section or Continuation Invoice Selector or Invoice Masuk Section */}
        {mode === "masuk" ? (
          <View className="mb-4 gap-2.5 p-3.5 rounded-xl border border-warning/40 bg-warning/5">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-bold text-foreground">
                Detail Tagihan / Invoice Masuk (Listrik, Internet, Operasional, atau Supplier)
              </Text>
              <StatusBadge status="Invoice Masuk" />
            </View>

            <FormField
              label="Kategori Tagihan / Akun Beban (COA)"
              required
              hint="Otomatis dijurnal ke akun beban/persediaan terkait di Laporan & COA"
            >
              <SearchableSelect
                value={
                  invoiceInCategoryOptions.find((o) => o.code === purchaseCategoryCode)?.label ||
                  invoiceInCategoryOptions[0]?.label || ""
                }
                onChange={(val) => {
                  const found = invoiceInCategoryOptions.find((o) => o.label === val);
                  if (found) {
                    setPurchaseCategoryCode(found.code);
                    if (found.code === "6202.01") {
                      if (!customSupplierName || customSupplierName.includes("IndiHome") || customSupplierName.includes("PDAM")) {
                        setCustomSupplierName("PLN (Tagihan Listrik)");
                      }
                      setCatatan("Tagihan Listrik PLN");
                    } else if (found.code === "6202.03") {
                      if (!customSupplierName || customSupplierName.includes("PLN") || customSupplierName.includes("PDAM")) {
                        setCustomSupplierName("Telkom IndiHome (Internet)");
                      }
                      setCatatan("Tagihan Internet & Telekomunikasi");
                    } else if (found.code === "6202.02") {
                      if (!customSupplierName || customSupplierName.includes("PLN") || customSupplierName.includes("IndiHome")) {
                        setCustomSupplierName("PDAM (Tagihan Air)");
                      }
                      setCatatan("Tagihan Air PDAM");
                    }
                  }
                }}
                options={invoiceInCategoryOptions.map((o) => o.label)}
                placeholder="Pilih kategori tagihan / akun COA..."
              />
            </FormField>

            <FormField
              label="Pihak Penagih / Penyedia Layanan / Supplier"
              required
              hint="Pilih dari daftar supplier rekanan atau ketik manual nama penagih (misal: PLN, Telkom IndiHome, Biznet)"
            >
              <View className="gap-1.5">
                <SupplierSelect
                  supplierId={selectedSupplierId}
                  value={
                    customSupplierName ||
                    (data.suppliers ?? []).find((s: Row) => String(s.id) === String(selectedSupplierId))?.nama ||
                    (data.suppliers ?? []).find((s: Row) => String(s.id) === String(selectedSupplierId))?.name ||
                    ""
                  }
                  onChange={(val, match) => {
                    if (match) {
                      setCustomSupplierName(match.nama || match.name);
                      setSelectedSupplierId(String(match.id));
                    } else {
                      setCustomSupplierName(val === "-" ? "" : val);
                      setSelectedSupplierId("");
                    }
                  }}
                  onAddNew={() => setQuickSupplierOpen(true)}
                  addNewLabel="+ Tambah Supplier Baru"
                  placeholder="Pilih supplier rekanan..."
                />
                <Input
                  value={customSupplierName}
                  onChangeText={(val) => {
                    setCustomSupplierName(val);
                    const match = (data.suppliers ?? []).find((s: Row) => (s.nama || s.name) === val);
                    if (match) setSelectedSupplierId(String(match.id));
                    else setSelectedSupplierId("");
                  }}
                  placeholder="Atau ketik manual nama penagih (contoh: PLN, IndiHome, Toko ABC)..."
                />
              </View>
            </FormField>

            <FormField label="PO Supplier Terkait (Opsional — Kosongkan untuk Tagihan Listrik / Internet / Non-PO)">
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
                    setPurchaseCategoryCode(match.projectId || (match.project && match.project !== "-") ? "5101" : "1200");
                    if (match.supplierId) setSelectedSupplierId(String(match.supplierId));
                    if (match.supplier) setCustomSupplierName(match.supplier);
                    if (match.ppnMode === "exclude" || match.ppnMode === "include" || match.ppnMode === "none") {
                      setPpnMode(match.ppnMode as PpnMode);
                    }
                    if (Array.isArray(match.items) && match.items.length > 0) {
                      setItems(match.items);
                    } else if (match.dpp || match.total || match.nilai) {
                      setCustomDpp(formatThousands(match.dpp || match.total || match.nilai));
                    }
                    const poInvs = (data.invoiceIn ?? []).filter((inv: Row) => {
                      const st = String(inv.status || "").toUpperCase();
                      if (st === "BATAL" || st === "DIBATALKAN") return false;
                      return String(inv.supplierPoId) === String(match.id);
                    });
                    if (poInvs.length > 0) {
                      setScheme("termin");
                      setContinuationType("pelunasan");
                    } else {
                      const poTerms = String(match.paymentTerms || match.payment || "");
                      const dpMatch = poTerms.match(/DP\s*(\d+)%/i);
                      if (dpMatch) {
                        setScheme("dp");
                        setDpPercent(dpMatch[1] || "50");
                      }
                    }
                  }
                }}
                options={(data["supplier-pos"] ?? []).map(
                  (p: Row) => `${p.nomor || p.number} - ${p.supplier || "-"}`,
                )}
                placeholder="Kosongkan jika bukan dari PO Supplier..."
              />
            </FormField>

            {continuableInvoiceInOptions.length > 0 ? (
              <FormField label="Atau Lanjutkan dari Invoice Masuk DP / Termin Sebelumnya (Opsional)">
                <SearchableSelect
                  value={
                    continuableInvoiceInOptions.find((o: { id: string; label: string; raw: Row }) => o.id === selectedParentInvoiceInId)?.label || ""
                  }
                  onChange={(val) => {
                    const match = continuableInvoiceInOptions.find((o: { id: string; label: string; raw: Row }) => o.label === val);
                    if (match) {
                      setSelectedParentInvoiceInId(match.id);
                      const inv = match.raw;
                      if (inv.supplierId) setSelectedSupplierId(String(inv.supplierId));
                      if (inv.supplier) setCustomSupplierName(inv.supplier);
                      if (inv.supplierPoId) setSelectedSupplierPoId(String(inv.supplierPoId));
                      if (inv.debitAccount) setPurchaseCategoryCode(inv.debitAccount);
                      if (inv.category) {
                        const matchCat = invoiceInCategoryOptions.find((c) => c.category === inv.category);
                        if (matchCat) setPurchaseCategoryCode(matchCat.code);
                      }
                      setScheme("termin");
                      setContinuationType("pelunasan");
                    } else {
                      setSelectedParentInvoiceInId("");
                    }
                  }}
                  options={["-- Tidak ada (Invoice Baru) --", ...continuableInvoiceInOptions.map((o: { id: string; label: string; raw: Row }) => o.label)]}
                  placeholder="Pilih invoice DP / Termin sebelumnya..."
                />
              </FormField>
            ) : null}
          </View>
        ) : mode === "lanjut" ? (
          <View className="mb-4 p-3 rounded-xl bg-card border border-primary/30 gap-2.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-bold text-foreground">
                Lanjutkan Tagihan dari Invoice Sebelumnya
              </Text>
              <StatusBadge status="Lanjutan" />
            </View>
            <FormField label="Pilih Invoice DP / Termin Acuan" required hint="Cari & pilih invoice DP/Termin yang masih memiliki sisa tagihan atau sisa kontrak">
              {continuableInvoiceOptions.length === 0 ? (
                <View className="p-3 rounded-lg bg-panel border border-dashed border-border/80">
                  <Text className="text-xs text-muted-foreground text-center">
                    Tidak ada invoice DP / Termin aktif yang masih memiliki sisa tagihan atau sisa kontrak. Semua invoice sudah lunas atau dibatalkan.
                  </Text>
                </View>
              ) : (
                <ContinuableInvoiceSelect
                  invoiceId={selectedParentInvoiceId}
                  options={continuableInvoiceOptions}
                  onChange={(selectedId) => handleSelectParentInvoice(selectedId)}
                />
              )}
            </FormField>
            {selectedParentInvoice ? (
              <View className="gap-1 mt-1 p-2.5 rounded-lg bg-panel/70 border border-border/50 text-xs">
                <View className="flex-row justify-between">
                  <Text className="text-[11px] text-muted-foreground">Customer:</Text>
                  <Text className="text-[11px] font-semibold text-foreground">
                    {selectedParentInvoice.customer || customCustomerName || "-"}
                  </Text>
                </View>
                {(activeQuotation?.nomor || selectedParentInvoice.quotation) ? (
                  <View className="flex-row justify-between">
                    <Text className="text-[11px] text-muted-foreground">Penawaran:</Text>
                    <Text className="text-[11px] font-mono font-medium text-primary">
                      {activeQuotation?.nomor || selectedParentInvoice.quotation}
                    </Text>
                  </View>
                ) : null}
                {(activePo?.nomor || activePo?.nomorSo || selectedParentInvoice.po) ? (
                  <View className="flex-row justify-between">
                    <Text className="text-[11px] text-muted-foreground">PO / SO Client:</Text>
                    <Text className="text-[11px] font-mono font-medium text-primary">
                      {activePo?.nomor || activePo?.nomorSo || selectedParentInvoice.po}
                    </Text>
                  </View>
                ) : null}
                {selectedParentChain && selectedParentChain.remainingToBill > 0 ? (
                  <View className="flex-row justify-between">
                    <Text className="text-[11px] text-muted-foreground">Sisa kontrak:</Text>
                    <Text className="text-[11px] font-semibold text-warning">
                      {rupiah(selectedParentChain.remainingToBill)}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : (
          <View className="mb-4 gap-2">
            <FormField label="Tautkan Invoice Ke / Jenis Transaksi" required>
              <SearchableSelect
                value={
                  sourceTypeOptions.find((o) => o.value === sourceType)?.label ||
                  sourceTypeOptions[0]?.label ||
                  ""
                }
                onChange={(val) => {
                  const found = sourceTypeOptions.find((o) => o.label === val);
                  if (!found) return;
                  const nextType = found.value;
                  setSourceType(nextType);
                  if (nextType === "direct_sale") {
                    setScheme("sekaligus");
                    setPaymentStatus("PAID");
                    if (!catatan || catatan.startsWith("Invoice ") || catatan.startsWith("Tagihan ")) {
                      setCatatan("Nota Penjualan Langsung (Walk-in)");
                    }
                  } else if (nextType === "po") {
                    setScheme("sekaligus");
                  }
                }}
                options={sourceTypeOptions.map((o) => o.label)}
                placeholder="Pilih jenis transaksi invoice..."
              />
            </FormField>

            {sourceType === "direct_sale" ? (
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
                <QuotationSelect
                  quotationId={selectedQuotationId}
                  onChange={handleSelectQuotation}
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
                <PoClientSelect
                  poId={selectedPoId}
                  onChange={handleSelectPo}
                />
              </FormField>
            ) : sourceType === "lead" ? (
              <FormField label="Pilih Lead / Prospek Terkait" required>
                <LeadSelect
                  leadId={selectedLeadId}
                  onChange={handleSelectLead}
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
        )}

        {/* Mode: Lanjutkan Termin / DP Sebelumnya info banner */}
        {mode === "lanjut" || (mode === "masuk" && relatedExistingInvoices.length > 0) ? (
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
                    onPress={() => {
                      setContinuationType("termin");
                      if (mode === "masuk") {
                        setNomor(
                          generateInvoiceInNumber(
                            "termin",
                            relatedExistingInvoices,
                            data.invoiceIn?.length || 0,
                            data.invoiceIn,
                            "termin",
                          ),
                        );
                      }
                    }}
                    className="flex-1 h-8"
                  >
                    <Text className="text-xs">Termin {terminNumber}</Text>
                  </Button>
                  <Button
                    variant={continuationType === "pelunasan" ? "default" : "outline"}
                    size="sm"
                    onPress={() => {
                      setContinuationType("pelunasan");
                      if (mode === "masuk") {
                        setNomor(
                          generateInvoiceInNumber(
                            "termin",
                            relatedExistingInvoices,
                            data.invoiceIn?.length || 0,
                            data.invoiceIn,
                            "pelunasan",
                          ),
                        );
                      }
                    }}
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
        ) : (mode === "baru" || (mode === "masuk" && relatedExistingInvoices.length === 0)) ? (
          /* Mode Baru & Masuk Scheme */
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
        ) : null}

        {/* Form Fields */}
        <View className="gap-3 mb-4">
          <FormField
            label={
              mode === "masuk"
                ? "Nomor Invoice Masuk / No. Tagihan (Kosongkan untuk otomatis)"
                : "Nomor Invoice (Kosongkan untuk otomatis)"
            }
          >
            <Input
              value={nomor}
              onChangeText={setNomor}
              placeholder={mode === "masuk" ? "Contoh: INV-IN/2026/11/001 atau No. Tagihan PLN/IndiHome" : "Otomatis oleh sistem"}
            />
          </FormField>

          <View className="flex-row gap-2">
            <View className="flex-1">
              <FormField label={mode === "masuk" ? "Tanggal Tagihan" : "Tanggal Terbit"} required>
                <DatePicker value={tanggal} onChange={setTanggal} />
              </FormField>
            </View>
            <View className="flex-1">
              <FormField label="Jatuh Tempo" required>
                <DatePicker value={jatuhTempo} onChange={setJatuhTempo} />
              </FormField>
            </View>
          </View>

          {(mode === "baru" || mode === "masuk") && items.length === 0 ? (
            <FormField
              label={
                mode === "masuk"
                  ? "Nominal Tagihan / Nilai DPP (Rp)"
                  : "Nilai Kesepakatan / DPP Total (Rp)"
              }
              required
            >
              <Input
                value={customDpp}
                onChangeText={(v) => setCustomDpp(formatThousands(v))}
                keyboardType="numeric"
                placeholder="Rp 0"
              />
            </FormField>
          ) : null}

          {/* List Barang / Items Section (Only for Invoice Keluar, or if Invoice Masuk has PO items) */}
          {mode === "lanjut" || (mode === "masuk" && relatedExistingInvoices.length > 0) ? (
            <View className="p-4 rounded-xl border border-primary/20 bg-primary/5 gap-2.5">
              <View className="flex-row items-center gap-2">
                <Package size={16} color={colors.primary} />
                <Text className="text-xs font-bold text-primary">
                  {mode === "masuk" ? "Rincian Tagihan Kelanjutan PO / Pembelian" : "Barang & Unit SN Tidak Perlu Dipilih Ulang"}
                </Text>
              </View>
              <Text className="text-xs text-muted-foreground leading-relaxed">
                {mode === "masuk"
                  ? `Invoice lanjutan (${continuationType === "pelunasan" ? "Pelunasan" : `Termin ${terminNumber}`}) ini melanjutkan sisa tagihan dari invoice masuk sebelumnya tanpa perlu memasukkan ulang daftar barang.`
                  : `Seluruh barang dan unit Serial Number (SN) fisik telah tercatat & di-reserve pada invoice pertama (${selectedParentInvoice?.nomor || "DP / Termin 1"}). Invoice lanjutan (${continuationType === "pelunasan" ? "Pelunasan" : `Termin ${terminNumber}`}) ini hanya menagih sisa pembayaran tanpa mengambil unit SN baru dari gudang.`}
              </Text>
              {activeQuotation?.items && activeQuotation.items.length > 0 ? (
                <View className="mt-1 pt-2 border-t border-primary/10 flex-row items-center justify-between">
                  <Text className="text-[11px] text-muted-foreground">
                    Total barang dalam kontrak awal: {activeQuotation.items.length} item ({activeQuotation.items.reduce((acc: number, it: any) => acc + (Number(it.qty) || 1), 0)} unit)
                  </Text>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2"
                    onPress={() => setShowAllItems(!showAllItems)}
                  >
                    <Text className="text-[11px] text-primary font-medium">
                      {showAllItems ? "Sembunyikan Rincian" : "Lihat Rincian Kontrak"}
                    </Text>
                  </Button>
                </View>
              ) : null}
              {showAllItems && activeQuotation?.items ? (
                <View className="gap-1 mt-1 bg-background/80 p-2 rounded-lg border border-border/50">
                  {activeQuotation.items.map((it: any, i: number) => (
                    <View key={i} className="flex-row justify-between py-1 border-b border-border/30">
                      <Text className="text-[11px] text-foreground font-medium flex-1 mr-2">{it.item}</Text>
                      <Text className="text-[11px] text-muted-foreground">
                        {it.qty} {it.satuan || it.unit || "unit"} x {rupiah(it.harga || it.price || 0)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : mode === "masuk" ? (
            items.length > 0 ? (
              <View className="gap-2 p-3 rounded-xl border border-border bg-card">
                <View className="flex-row justify-between items-center">
                  <Text className="text-xs font-bold text-foreground">
                    Rincian Item dari PO Supplier ({items.length} Item)
                  </Text>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2"
                    onPress={() => setItems([])}
                  >
                    <Text className="text-xs text-danger">Hapus Rincian Item</Text>
                  </Button>
                </View>
                {items.map((it, idx) => {
                  const itemPrice = Number(it.harga || it.price || 0);
                  const sub = (Number(it.qty) || 1) * itemPrice;
                  return (
                    <View key={it.id || idx} className="flex-row justify-between py-1.5 border-b border-border/40">
                      <Text className="text-xs font-medium flex-1 mr-2">
                        {it.item} ({it.qty} {it.satuan || it.unit || "unit"} x {rupiah(itemPrice)})
                      </Text>
                      <Text className="text-xs font-semibold">{rupiah(sub)}</Text>
                    </View>
                  );
                })}
              </View>
            ) : null
          ) : (
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
                            <Text className="text-[10px] text-danger font-medium">{it.tipePph || "PPh"}: -{rupiah(itPph)}</Text>
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
                                if (opt.id !== "none") {
                                  setPphMode(opt.id);
                                }
                              }}
                              className={`px-2 py-0.5 rounded border ${
                                active
                                  ? "bg-primary/10 border-primary"
                                  : "bg-muted/40 border-border/60"
                              }`}
                            >
                              <Text className={`text-[10px] ${active ? "text-primary font-bold" : "text-muted-foreground"}`}>
                                {opt.id === "none" ? "Non-PPh" : opt.label}
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
        )}

          {/* Diskon Pemotongan (Persen & Nominal) */}
          {mode === "lanjut" ? (
            effectiveDiscount > 0 ? (
              <View className="p-3 rounded-xl bg-card border border-border flex-row items-center justify-between">
                <Text className="text-xs font-semibold text-foreground">Diskon Kontrak Awal</Text>
                <Text className="text-xs font-semibold text-danger">
                  - {rupiah(effectiveDiscount)} {discPercent ? `(${discPercent}%)` : ""}
                </Text>
              </View>
            ) : null
          ) : (
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
          )}

          {/* Status Pembayaran */}
          <View className="p-3 rounded-xl bg-panel border border-border gap-2">
            <FormField
              label={
                mode === "masuk"
                  ? "Status Pembayaran Tagihan Masuk"
                  : "Status Pembayaran Saat Terbit"
              }
            >
              <View className="flex-row gap-2">
                <Button
                  variant={paymentStatus === "UNPAID" ? "default" : "outline"}
                  size="sm"
                  onPress={() => setPaymentStatus("UNPAID")}
                  className="flex-1 h-8"
                >
                  <Text className="text-xs">
                    {mode === "masuk"
                      ? "Belum Dibayar (Hutang / Tempo)"
                      : "Belum Bayar (Tagihan / Tempo)"}
                  </Text>
                </Button>
                <Button
                  variant={paymentStatus === "PAID" ? "default" : "outline"}
                  size="sm"
                  onPress={() => setPaymentStatus("PAID")}
                  className="flex-1 h-8"
                >
                  <Text className="text-xs">
                    {mode === "masuk"
                      ? "Langsung Dibayar / Lunas (Kas / Bank)"
                      : "Langsung Lunas (Kas / Bank)"}
                  </Text>
                </Button>
              </View>
            </FormField>

            {paymentStatus === "PAID" ? (
              <View className="gap-2.5">
                <FormField
                  label={
                    mode === "masuk"
                      ? "Pilih Akun Kas / Bank Pembayaran (Sumber Dana)"
                      : "Pilih Akun Kas / Bank Penerimaan"
                  }
                  required
                  hint={
                    mode === "masuk"
                      ? "Pilih rekening bank atau kas kecil yang digunakan untuk membayar tagihan ini"
                      : "Pilih rekening bank atau kas kecil tempat pembayaran invoice ini masuk"
                  }
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

                <FormField
                  label="Upload Bukti Pembayaran / Transfer (Opsional)"
                  hint="Lampirkan foto / PDF bukti transfer bank atau struk pelunasan"
                >
                  <FileUploader
                    label="Pilih File Foto / PDF Bukti Pembayaran"
                    kind="semua"
                    category="invoice"
                    autoFlush
                    onUploaded={(id: number | null) => setPaymentFileId(id)}
                  />
                </FormField>
              </View>
            ) : null}
          </View>

          <FormField
            label={
              mode === "masuk"
                ? "Upload Dokumen Invoice Masuk / Tagihan (Opsional)"
                : "Upload Dokumen Pendukung Invoice (Opsional)"
            }
            hint={
              mode === "masuk"
                ? "Lampirkan file PDF / foto tagihan (misal: Tagihan PLN, IndiHome, atau Faktur Supplier)"
                : "Lampirkan dokumen pendukung bila ada"
            }
          >
            <FileUploader
              label={
                mode === "masuk"
                  ? "Pilih File PDF / Foto Tagihan Masuk"
                  : "Pilih File Dokumen Invoice"
              }
              kind="semua"
              category="invoice"
              autoFlush
              onUploaded={(id: number | null) => setFileId(id)}
            />
          </FormField>

          <FormField
            label={
              mode === "masuk"
                ? "Catatan / Keterangan Tagihan Masuk"
                : "Catatan / Keterangan Invoice"
            }
          >
            <Textarea
              value={catatan}
              onChangeText={setCatatan}
              placeholder={
                mode === "masuk"
                  ? "Contoh: Tagihan Internet IndiHome Bulan November 2026 / ID Pelanggan..."
                  : "Catatan tambahan untuk invoice ini..."
              }
            />
          </FormField>

          {/* Ketentuan PPN */}
          <View className="w-full sm:w-1/2 px-2 py-2">
            <FormField
              label={
                mode === "masuk"
                  ? "Ketentuan PPN Masukan (Pajak Pertambahan Nilai)"
                  : "Ketentuan PPN (Pajak Pertambahan Nilai)"
              }
            >
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
          {dealPph > 0 ? (
            <View className="flex-row justify-between">
              <Text className="text-xs text-amber-600 dark:text-amber-400">
                Potongan PPh Kesepakatan (
                {pphModeToTipe(
                  pphMode !== "none"
                    ? pphMode
                    : items.find((it: any) => it.pphMode && it.pphMode !== "none")?.pphMode ||
                      activePo?.pphMode ||
                      "pph23"
                )}
                ):
              </Text>
              <Text className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                -{rupiah(dealPph)}
              </Text>
            </View>
          ) : null}
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
                Potongan PPh (
                {pphModeToTipe(
                  pphMode !== "none"
                    ? pphMode
                    : items.find((it: any) => it.pphMode && it.pphMode !== "none")?.pphMode ||
                      activePo?.pphMode ||
                      "pph23"
                )}
                ):
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
          <Text>
            {isSubmitting
              ? "Menyimpan..."
              : mode === "masuk"
              ? "Simpan Invoice Masuk"
              : "Simpan & Buat Invoice"}
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