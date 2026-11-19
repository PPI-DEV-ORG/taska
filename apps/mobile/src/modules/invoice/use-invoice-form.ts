import * as React from "react";
import { useApp } from "@/store/app-store";
import { api } from "@/services/api";
import { rupiah, formatThousands } from "@/lib/format";
import { type Row } from "@/constants/modules";
import { type QuotationItem } from "@/modules/quotation/types";
import {
  collectContinuableInvoices,
  invoiceAmount,
  invoicePaidAmount,
} from "@/modules/invoice/invoice-chain";
import {
  CHART_OF_ACCOUNTS,
  loadCustomCoa,
  loadDeletedCoaCodes,
} from "@/lib/accounting";
import {
  type PphMode,
  type PpnMode,
  getInitialPpnMode,
  getInitialPphMode,
  ppnModeToTipe,
  pphRateFor,
  pphModeToTipe,
  itemNet,
  recomputeHeaderDiscount,
  sumItemDiscounts,
  sumItemGross,
} from "@/modules/quotation/lib";
import {
  type InvoiceSourceType,
  generateInvoiceInNumber,
  generateInvoiceNumber,
  getDefaultDueDateIso,
  getTodayIso,
  soImpliedDiscount,
} from "./invoice-form-utils";

export type CreateInvoiceFormProps = {
  initialQuotation?: Row;
  initialLead?: Row;
  initialPo?: Row;
  defaultDirectSale?: boolean;
  defaultDirectPurchase?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export function useInvoiceForm({
  initialQuotation,
  initialLead,
  initialPo,
  defaultDirectSale,
  defaultDirectPurchase,
  onClose,
  onSuccess,
}: CreateInvoiceFormProps) {
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
      // Invoice milik SO ini dicari lewat clientPoId (bukan nomor yang muncul di teks catatan).
      const hasExisting = (data.invoices ?? []).some(
        (inv: Row) =>
          initialPo.id != null &&
          String(inv.clientPoId) === String(initialPo.id),
      );
      if (hasExisting) return "lanjut";
    }
    if (initialQuotation) {
      const qNum = String(initialQuotation.nomor || "").trim();
      const hasExisting = (data.invoices ?? []).some(
        (inv: Row) =>
          (initialQuotation.id &&
            String(inv.quotationId) === String(initialQuotation.id)) ||
          (qNum &&
            qNum !== "-" &&
            (inv.quotation === qNum ||
              String(inv.catatan || "").includes(qNum))),
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

  const [selectedQuotationId, setSelectedQuotationId] = React.useState<string>(
    () => {
      if (initialPo?.quotationId) return String(initialPo.quotationId);
      if (initialPo?.penawaran && initialPo.penawaran !== "-") {
        const match = (data.quotations ?? []).find(
          (q: Row) => q.nomor === initialPo.penawaran,
        );
        if (match) return String(match.id);
      }
      return initialQuotation?.id ? String(initialQuotation.id) : "";
    },
  );
  const [selectedPoId, setSelectedPoId] = React.useState<string>(() =>
    initialPo?.id ? String(initialPo.id) : "",
  );
  const [selectedLeadId, setSelectedLeadId] = React.useState<string>(() =>
    initialLead?.id ? String(initialLead.id) : "",
  );

  // Supplier & PO Supplier state for direct_purchase (Invoice Masuk Langsung)
  const [selectedSupplierId, setSelectedSupplierId] =
    React.useState<string>("");
  const [selectedSupplierPoId, setSelectedSupplierPoId] =
    React.useState<string>("");
  const [selectedParentInvoiceInId, setSelectedParentInvoiceInId] =
    React.useState<string>("");
  const [customSupplierName, setCustomSupplierName] =
    React.useState<string>("");
  const [purchaseCategoryCode, setPurchaseCategoryCode] =
    React.useState<string>("6202.01");

  const selectedParentInvoiceIn = React.useMemo(() => {
    if (!selectedParentInvoiceInId) return null;
    return (
      (data.invoiceIn ?? []).find(
        (inv: Row) => String(inv.id) === String(selectedParentInvoiceInId),
      ) || null
    );
  }, [data.invoiceIn, selectedParentInvoiceInId]);

  // Tagihan supplier dari PO: DPP & PPN mengacu angka PO (bukan dihitung ulang) supaya PPN tidak dobel / bergeser.
  const supplierPoRef = React.useMemo(() => {
    if (mode !== "masuk") return null;
    const poId =
      selectedSupplierPoId ||
      (selectedParentInvoiceIn?.supplierPoId
        ? String(selectedParentInvoiceIn.supplierPoId)
        : "");
    if (!poId) return null;
    const po = (data["supplier-pos"] ?? []).find(
      (p: Row) => String(p.id) === String(poId),
    );
    if (!po) return null;
    const dpp = Number(po.dpp || 0);
    const ppn = Number(po.ppn || 0);
    const poMode: PpnMode =
      po.ppnMode === "include" || po.ppnMode === "exclude"
        ? po.ppnMode
        : "none";
    return dpp > 0
      ? {
          nomor: String(po.nomor || po.number || ""),
          dpp,
          ppn: poMode === "none" ? 0 : ppn,
          mode: poMode,
        }
      : null;
  }, [mode, data, selectedSupplierPoId, selectedParentInvoiceIn]);

  const continuableInvoiceInOptions: { id: string; label: string; raw: Row }[] =
    React.useMemo(() => {
      return (data.invoiceIn ?? [])
        .filter((inv: Row) => {
          const st = String(inv.status || "").toUpperCase();
          if (st === "BATAL" || st === "DIBATALKAN") return false;
          const isPelunasan = /pelunasan/i.test(
            String(inv.jenis || inv.catatan || ""),
          );
          if (isPelunasan) return false;
          const isDpOrTermin =
            inv.type === "DP" ||
            inv.type === "TERMIN" ||
            /dp|termin/i.test(
              String(inv.jenis || inv.catatan || inv.nomor || ""),
            );
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
      {
        code: "6202.01",
        label: "Tagihan Listrik / PLN [6202.01 - Biaya Listrik]",
        category: "Tagihan Listrik",
      },
      {
        code: "6202.03",
        label:
          "Tagihan Internet / WiFi / Telepon [6202.03 - Biaya Telekomunikasi]",
        category: "Tagihan Internet & Telekomunikasi",
      },
      {
        code: "6202.02",
        label: "Tagihan Air / PDAM [6202.02 - Biaya Air]",
        category: "Tagihan Air / PDAM",
      },
      {
        code: "6203.01",
        label: "Sewa / Pemeliharaan Gedung & Kantor [6203.01]",
        category: "Pemeliharaan Gedung & Kantor",
      },
      {
        code: "6203.02",
        label: "Servis Kendaraan / BBM / Operasional Lapangan [6203.02]",
        category: "Operasional Kendaraan",
      },
      {
        code: "6202.06",
        label: "Pembelian ATK & Perlengkapan Kantor [6202.06]",
        category: "ATK & Perlengkapan Kantor",
      },
      {
        code: "6202.07",
        label: "Tagihan Jasa / Operasional Umum Lainnya [6202.07]",
        category: "Tagihan Operasional Lainnya",
      },
      {
        code: "1200",
        label: "Pembelian Barang Stok / Persediaan Gudang [1200]",
        category: "Tagihan Pemasok (Stok)",
      },
      {
        code: "5101",
        label: "Tagihan Subkon / Material Proyek [5101 - HPP Proyek]",
        category: "Tagihan Proyek",
      },
    ],
    [],
  );

  const sourceTypeOptions = React.useMemo(
    () => [
      {
        value: "po" as InvoiceSourceType,
        label: "PO Pelanggan / Pesanan Penjualan (SO)",
      },
      {
        value: "quotation" as InvoiceSourceType,
        label: "Penawaran (Quotation)",
      },
      {
        value: "direct_sale" as InvoiceSourceType,
        label: "Faktur Penjualan Langsung (Walk-in)",
      },
      { value: "lead" as InvoiceSourceType, label: "Prospek" },
      { value: "customer" as InvoiceSourceType, label: "Pelanggan Langsung" },
    ],
    [],
  );

  // Customer state
  const [customCustomerName, setCustomCustomerName] = React.useState<string>(
    () => {
      if (initialPo?.customer && initialPo.customer !== "-")
        return String(initialPo.customer);
      if (initialQuotation?.customer && initialQuotation.customer !== "-")
        return String(initialQuotation.customer);
      return "";
    },
  );
  const [selectedCustomerId, setSelectedCustomerId] = React.useState<string>(
    () => {
      if (initialPo?.customerId) return String(initialPo.customerId);
      if (initialPo?.customer && initialPo.customer !== "-") {
        const match = (data.customers ?? []).find(
          (c: Row) =>
            c.nama?.toLowerCase() ===
              String(initialPo.customer).toLowerCase() ||
            c.name?.toLowerCase() === String(initialPo.customer).toLowerCase(),
        );
        if (match) return String(match.id);
      }
      if (initialQuotation?.customerId)
        return String(initialQuotation.customerId);
      if (initialLead?.customerId) return String(initialLead.customerId);
      if (initialLead?.perusahaan || initialLead?.nama) {
        const match = (data.customers ?? []).find(
          (c: Row) =>
            c.nama?.toLowerCase() ===
            (initialLead.perusahaan || initialLead.nama)?.toLowerCase(),
        );
        if (match) return String(match.id);
      }
      return "";
    },
  );

  // Scheme - defaults to "sekaligus" (100% full invoice)
  const [scheme, setScheme] = React.useState<"sekaligus" | "dp" | "termin">(
    "sekaligus",
  );
  const [dpPercent, setDpPercent] = React.useState<string>("50");
  const [terminPercent, setTerminPercent] = React.useState<string>("30");

  // Continuation selection
  const [continuationType, setContinuationType] = React.useState<
    "termin" | "pelunasan"
  >("termin");

  // Invoice Fields
  const [tanggal, setTanggal] = React.useState<string>(getTodayIso);
  const [jatuhTempo, setJatuhTempo] =
    React.useState<string>(getDefaultDueDateIso);
  const [catatan, setCatatan] = React.useState<string>(() => {
    if (initialPo?.catatan) return initialPo.catatan;
    if (initialPo?.nomorSo || initialPo?.nomor)
      return `Invoice untuk Sales Order ${initialPo.nomorSo || initialPo.nomor}`;
    if (initialQuotation?.catatan) return initialQuotation.catatan;
    if (initialQuotation?.nomor)
      return `Invoice untuk Penawaran ${initialQuotation.nomor}`;
    if (initialLead?.nama) return `Invoice untuk Lead ${initialLead.nama}`;
    if (defaultDirectSale) return "Nota Penjualan Langsung (Walk-in)";
    if (defaultDirectPurchase) return "Faktur Pembelian Langsung";
    return "";
  });
  const [fileId, setFileId] = React.useState<number | null>(null);
  const [paymentFileId, setPaymentFileId] = React.useState<number | null>(null);

  // Payment Status (Belum Bayar vs Langsung Lunas)
  // Proforma invoice: penagihan awal, tidak dijurnal & tidak bisa dibayar sampai diterbitkan jadi invoice resmi
  const [isProforma, setIsProforma] = React.useState(false);
  const [showMoreOptions, setShowMoreOptions] = React.useState(false);
  const [paymentStatus, setPaymentStatus] = React.useState<"UNPAID" | "PAID">(
    () => {
      if (defaultDirectSale || defaultDirectPurchase || isInitialPoWalkin)
        return "PAID";
      return "UNPAID";
    },
  );
  const [paymentAccountCode, setPaymentAccountCode] =
    React.useState<string>("1000.02");
  const [paymentMethod, setPaymentMethod] = React.useState<
    "TRANSFER" | "TUNAI"
  >("TRANSFER");

  const kasBankOptions = React.useMemo(() => {
    const custom = loadCustomCoa();
    const deleted = new Set(loadDeletedCoaCodes());
    const merged: Record<string, { code: string; name: string }> = {};

    Object.values(CHART_OF_ACCOUNTS).forEach((acc) => {
      if (
        !deleted.has(acc.code) &&
        acc.category === "Aset Lancar" &&
        (acc.code === "1000.01" ||
          acc.code === "1000.02" ||
          acc.parentCode === "1000" ||
          acc.type === "cash/bank")
      ) {
        merged[acc.code] = { code: acc.code, name: acc.name };
      }
    });

    custom.forEach((acc) => {
      if (
        !deleted.has(acc.code) &&
        (acc.parentCode === "1000" ||
          acc.code.startsWith("1000.") ||
          acc.type === "cash/bank")
      ) {
        merged[acc.code] = { code: acc.code, name: acc.name };
      }
    });

    const list = Object.values(merged);
    if (list.length === 0) {
      return [
        {
          code: "1000.02",
          name: "Bank Mandiri PT GMP [1000.02]",
          rawName: "Bank Mandiri PT GMP",
        },
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

    return collectContinuableInvoices(
      allInvoices,
      quotations,
      projects,
      clientPoList,
    ).map(({ invoice: inv, chain }) => {
      const invNum = inv.nomor || inv.number || `INV #${inv.id}`;
      const cust = inv.customer || "-";
      const jenis =
        inv.jenis ||
        (String(inv.type || "").toUpperCase() === "DP" ? "DP" : "Invoice");
      const amountStr = rupiah(invoiceAmount(inv));
      const outstanding = Math.max(
        0,
        invoiceAmount(inv) - invoicePaidAmount(inv),
      );
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
    });
  }, [data.invoices, data.quotations, data.projects, clientPos]);

  const [selectedParentInvoiceId, setSelectedParentInvoiceId] =
    React.useState<string>(() => {
      if (initialPo) {
        const match = continuableInvoiceOptions.find(
          (o) => String(o.raw.clientPoId) === String(initialPo.id),
        );
        if (match) return match.id;
      }
      if (initialQuotation) {
        const match = continuableInvoiceOptions.find(
          (o) =>
            String(o.raw.quotationId) === String(initialQuotation.id) ||
            (initialQuotation.nomor &&
              initialQuotation.nomor !== "-" &&
              o.raw.quotation === initialQuotation.nomor),
        );
        if (match) return match.id;
      }
      return "";
    });

  const selectedParentInvoice = React.useMemo(() => {
    if (!selectedParentInvoiceId) return null;
    return (
      (data.invoices ?? []).find(
        (inv: Row) => String(inv.id) === String(selectedParentInvoiceId),
      ) || null
    );
  }, [data.invoices, selectedParentInvoiceId]);

  const selectedParentChain = React.useMemo(
    () =>
      continuableInvoiceOptions.find((o) => o.id === selectedParentInvoiceId)
        ?.chain ?? null,
    [continuableInvoiceOptions, selectedParentInvoiceId],
  );

  // Items
  const [items, setItems] = React.useState<QuotationItem[]>(() => {
    // If starting in lanjut mode, items should be empty so no physical items/cameras are selected!
    if (initialPo) {
      const hasExisting = (data.invoices ?? []).some(
        (inv: Row) => String(inv.clientPoId) === String(initialPo.id),
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
      const q = (data.quotations ?? []).find(
        (x: Row) => String(x.id) === String(initialPo.quotationId),
      );
      if (Array.isArray(q?.items) && q.items.length > 0) return q.items;
    }
    if (initialPo?.penawaran && initialPo.penawaran !== "-") {
      const q = (data.quotations ?? []).find(
        (x: Row) => x.nomor === initialPo.penawaran,
      );
      if (Array.isArray(q?.items) && q.items.length > 0) return q.items;
    }
    if (
      Array.isArray(initialQuotation?.items) &&
      initialQuotation.items.length > 0
    ) {
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
        return (
          (data.quotations ?? []).find(
            (q: Row) =>
              String(q.id) === String(selectedParentInvoice.quotationId),
          ) || null
        );
      }
      if (selectedParentInvoice.quotation) {
        return (
          (data.quotations ?? []).find(
            (q: Row) => q.nomor === selectedParentInvoice.quotation,
          ) || null
        );
      }
      return null;
    }
    if (selectedQuotationId) {
      return (
        (data.quotations ?? []).find(
          (q: Row) => String(q.id) === String(selectedQuotationId),
        ) || null
      );
    }
    if (selectedParentInvoice?.quotationId) {
      return (
        (data.quotations ?? []).find(
          (q: Row) =>
            String(q.id) === String(selectedParentInvoice.quotationId),
        ) || null
      );
    }
    if (selectedParentInvoice?.quotation) {
      return (
        (data.quotations ?? []).find(
          (q: Row) => q.nomor === selectedParentInvoice.quotation,
        ) || null
      );
    }
    return initialQuotation || null;
  }, [
    mode,
    data,
    selectedQuotationId,
    initialQuotation,
    selectedParentInvoice,
  ]);

  const activePo = React.useMemo(() => {
    if (mode === "lanjut") {
      if (!selectedParentInvoice) return null;
      if (selectedParentInvoice.clientPoId) {
        return (
          (data["po-client"] ?? []).find(
            (p: Row) =>
              String(p.id) === String(selectedParentInvoice.clientPoId),
          ) || null
        );
      }
      if (selectedParentInvoice.po) {
        return (
          (data["po-client"] ?? []).find(
            (p: Row) =>
              p.nomor === selectedParentInvoice.po ||
              p.nomorSo === selectedParentInvoice.po,
          ) || null
        );
      }
      return null;
    }
    if (selectedPoId) {
      return (
        (data["po-client"] ?? []).find(
          (p: Row) => String(p.id) === String(selectedPoId),
        ) ||
        initialPo ||
        null
      );
    }
    if (selectedParentInvoice?.clientPoId) {
      return (
        (data["po-client"] ?? []).find(
          (p: Row) => String(p.id) === String(selectedParentInvoice.clientPoId),
        ) || null
      );
    }
    if (selectedParentInvoice?.po) {
      return (
        (data["po-client"] ?? []).find(
          (p: Row) =>
            p.nomor === selectedParentInvoice.po ||
            p.nomorSo === selectedParentInvoice.po,
        ) || null
      );
    }
    return initialPo || null;
  }, [mode, data, selectedPoId, initialPo, selectedParentInvoice]);

  const activeLead = React.useMemo(() => {
    if (mode === "lanjut") {
      if (!selectedParentInvoice) return null;
      if (selectedParentInvoice.leadId) {
        return (
          (data.leads ?? []).find(
            (l: Row) => String(l.id) === String(selectedParentInvoice.leadId),
          ) || null
        );
      }
      return null;
    }
    if (selectedLeadId) {
      return (
        (data.leads ?? []).find(
          (l: Row) => String(l.id) === String(selectedLeadId),
        ) || null
      );
    }
    return initialLead || null;
  }, [mode, data, selectedLeadId, initialLead, selectedParentInvoice]);

  // Existing invoices related to active quotation, PO, Lead, or selected Parent Invoice
  const relatedExistingInvoices = React.useMemo(() => {
    if (mode === "masuk") {
      if (selectedParentInvoiceIn) {
        const parentId = String(selectedParentInvoiceIn.id);
        const suppPoId = selectedParentInvoiceIn.supplierPoId;
        const parentNum =
          selectedParentInvoiceIn.nomor || selectedParentInvoiceIn.number;
        const matchPrefix = parentNum
          ? String(parentNum).match(/^(INV-IN\/\d{4}\/\d{2}\/\d+)/i)?.[1]
          : null;

        return (data.invoiceIn ?? []).filter((inv: Row) => {
          const st = String(inv.status || "").toUpperCase();
          if (st === "BATAL" || st === "DIBATALKAN") return false;
          if (String(inv.id) === parentId) return true;
          if (suppPoId && String(inv.supplierPoId) === String(suppPoId))
            return true;
          if (
            matchPrefix &&
            String(inv.nomor || inv.number || "").startsWith(matchPrefix)
          )
            return true;
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
      const rootParentId = selectedParentInvoice.parentInvoiceId
        ? String(selectedParentInvoice.parentInvoiceId)
        : parentId;
      const parentNum =
        selectedParentInvoice.nomor || selectedParentInvoice.number;
      const matchPrefix = parentNum
        ? String(parentNum).match(/^(INV\/\d{4}\/\d{2}\/\d+)/i)?.[1]
        : null;

      const parentPoId = selectedParentInvoice.clientPoId;
      const parentQuoteId = selectedParentInvoice.quotationId;

      return (data.invoices ?? []).filter((inv: Row) => {
        const st = String(inv.status || "").toUpperCase();
        if (st === "BATAL" || st === "DIBATALKAN") return false;
        if (inv.isProforma) return false;

        // 1. Same ID
        if (String(inv.id) === parentId) return true;

        // 2. Parent / sibling chain linkage
        if (
          inv.parentInvoiceId &&
          (String(inv.parentInvoiceId) === parentId ||
            String(inv.parentInvoiceId) === rootParentId)
        )
          return true;
        if (String(inv.id) === rootParentId) return true;

        // 3. Same invoice base numbering prefix (e.g. INV/2026/11/005/1 and INV/2026/11/005/2)
        if (
          matchPrefix &&
          String(inv.nomor || inv.number || "").startsWith(matchPrefix)
        )
          return true;

        // 4. Same exact client PO / Quotation ID if defined on parent invoice
        if (parentPoId && String(inv.clientPoId) === String(parentPoId))
          return true;
        if (parentQuoteId && String(inv.quotationId) === String(parentQuoteId))
          return true;

        return false;
      });
    }

    const qNomor = activeQuotation?.nomor;
    const qId = activeQuotation?.id;
    const poId = activePo?.id;
    const leadId = activeLead?.id;
    const leadName = activeLead?.nama
      ? String(activeLead.nama).trim().toLowerCase()
      : "";

    return (data.invoices ?? []).filter((inv: Row) => {
      const st = String(inv.status || "").toUpperCase();
      if (st === "BATAL" || st === "DIBATALKAN") return false;
      if (inv.isProforma) return false;

      if (qId && String(inv.quotationId) === String(qId)) return true;
      if (qNomor && qNomor !== "-" && inv.quotation === qNomor) return true;
      if (poId && String(inv.clientPoId) === String(poId)) return true;
      if (leadId && String(inv.leadId) === String(leadId)) return true;
      return false;
    });
  }, [
    mode,
    selectedParentInvoice,
    selectedParentInvoiceIn,
    selectedSupplierPoId,
    data.invoices,
    data.invoiceIn,
    activeQuotation,
    activePo,
    activeLead,
  ]);

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

  /**
   * Diskon awal harus berpasangan dengan sumber harga item:
   * - Item dari Sales Order sudah harga net (diskon penawaran sudah dibagi ke harga) -> diskon penawaran TIDAK dipakai lagi.
   * - Item / nilai dari penawaran masih harga kotor -> pakai diskon penawaran (diskon per item + diskon tambahan).
   */
  const quotationDisc = React.useMemo(() => {
    const n = (v: unknown) => Number(String(v ?? 0).replace(/\D/g, "")) || 0;
    const linkedQuote =
      activeQuotation ||
      (data.quotations ?? []).find(
        (q: Row) => String(q.id) === String(activePo?.quotationId),
      ) ||
      null;
    const quoteDisc = n(linkedQuote?.disc ?? linkedQuote?.discount);
    const poHasItems =
      Array.isArray(activePo?.items) && activePo.items.length > 0;
    if (mode === "lanjut") {
      if (activeQuotation) return quoteDisc; // dasar kesepakatan = total penawaran (kotor)
      return poHasItems
        ? soImpliedDiscount(activePo)
        : n(selectedParentInvoice?.discount);
    }
    if (poHasItems) return soImpliedDiscount(activePo);
    if (
      activePo &&
      !(Array.isArray(linkedQuote?.items) && linkedQuote.items.length > 0)
    )
      return 0; // nilai SO sudah net
    return quoteDisc;
  }, [mode, activeQuotation, activePo, selectedParentInvoice, data.quotations]);

  // Total gross items / amount before discount
  const grossDealDpp = React.useMemo(() => {
    if (mode === "masuk") {
      // Tagihan dari PO: dasar = DPP PO (paling akurat, juga untuk lanjutan DP/termin)
      if (supplierPoRef)
        return supplierPoRef.mode === "include"
          ? supplierPoRef.dpp + supplierPoRef.ppn
          : supplierPoRef.dpp;
      if (selectedParentInvoiceIn) {
        const pctMatch = String(
          selectedParentInvoiceIn.catatan ||
            selectedParentInvoiceIn.notes ||
            selectedParentInvoiceIn.dpLabel ||
            "",
        ).match(/(\d+)%/);
        const pct = pctMatch ? Number(pctMatch[1]) : 0;
        if (pct > 0 && pct < 100 && selectedParentInvoiceIn.nilai) {
          return Math.round(
            (Number(selectedParentInvoiceIn.nilai) / pct) * 100,
          );
        }
        if (selectedParentInvoiceIn.nilai)
          return Number(selectedParentInvoiceIn.nilai);
      }
      if (items.length > 0) {
        return items.reduce(
          (acc, curr) =>
            acc +
            (Number(curr.qty) || 1) *
              (Number(curr.harga) || Number((curr as any).price) || 0),
          0,
        );
      }
      return Number(String(customDpp).replace(/\D/g, "")) || 0;
    }
    if (mode === "baru" && items.length > 0) {
      return items.reduce(
        (acc, curr) =>
          acc +
          (Number(curr.qty) || 1) *
            (Number(curr.harga) || Number((curr as any).price) || 0),
        0,
      );
    }
    if (activeQuotation?.total) return Number(activeQuotation.total);
    if (activeQuotation?.nilai) return Number(activeQuotation.nilai);
    if (
      activeQuotation?.items &&
      Array.isArray(activeQuotation.items) &&
      activeQuotation.items.length > 0
    ) {
      return activeQuotation.items.reduce(
        (acc: number, curr: any) =>
          acc +
          (Number(curr.qty) || 1) *
            (Number(curr.harga) || Number(curr.price) || 0),
        0,
      );
    }
    if (sourceType === "po" && activePo?.nilai) return Number(activePo.nilai);
    if (
      activePo?.items &&
      Array.isArray(activePo.items) &&
      activePo.items.length > 0
    ) {
      return activePo.items.reduce(
        (acc: number, curr: any) =>
          acc +
          (Number(curr.qty) || 1) *
            (Number(curr.harga) || Number(curr.price) || 0),
        0,
      );
    }
    if (selectedParentInvoice?.nilai) {
      const pctMatch = String(
        selectedParentInvoice.dpLabel ||
          selectedParentInvoice.catatan ||
          selectedParentInvoice.description ||
          "",
      ).match(/(\d+)%/);
      const pct = pctMatch ? Number(pctMatch[1]) : 0;
      if (pct > 0 && pct < 100) {
        return Math.round((Number(selectedParentInvoice.nilai) / pct) * 100);
      }
      return Number(selectedParentInvoice.nilai);
    }
    if (activeLead?.nilai) return Number(activeLead.nilai);
    return Number(String(customDpp).replace(/\D/g, "")) || 0;
  }, [
    items,
    mode,
    activeQuotation,
    activePo,
    activeLead,
    customDpp,
    selectedParentInvoice,
    sourceType,
    supplierPoRef,
    selectedParentInvoiceIn,
  ]);

  const [customDiscount, setCustomDiscount] = React.useState<string>(() =>
    quotationDisc > 0 ? formatThousands(quotationDisc) : "",
  );

  const [discPercent, setDiscPercent] = React.useState<string>(() => {
    const rawDisc = quotationDisc || 0;
    if (rawDisc > 0 && grossDealDpp > 0) {
      return String(Math.round((rawDisc / grossDealDpp) * 100 * 10) / 10);
    }
    return "";
  });
  const [showExtraDiscount, setShowExtraDiscount] = React.useState(false);
  const [quickCustomerOpen, setQuickCustomerOpen] = React.useState(false);
  const [quickSupplierOpen, setQuickSupplierOpen] = React.useState(false);
  const [showAllItems, setShowAllItems] = React.useState(false);
  const [selectedItemIndices, setSelectedItemIndices] = React.useState<
    number[]
  >([]);

  const effectiveDiscount =
    Number(String(customDiscount).replace(/\D/g, "")) || 0;
  const discPctLabel =
    effectiveDiscount > 0 && grossDealDpp > 0
      ? `(${Math.round((effectiveDiscount / grossDealDpp) * 1000) / 10}%)`
      : "";
  // Diskon penawaran yang sudah "masuk" ke harga item SO (harga net) -> kolom diskon disembunyikan.
  const linkedQuoteForDisc =
    activeQuotation ||
    (data.quotations ?? []).find(
      (q: Row) => String(q.id) === String(activePo?.quotationId),
    ) ||
    null;
  const discountAlreadyInSoPrices =
    mode === "baru" &&
    Array.isArray(activePo?.items) &&
    activePo.items.length > 0 &&
    items.length > 0 &&
    Number(linkedQuoteForDisc?.discount ?? linkedQuoteForDisc?.disc ?? 0) > 0 &&
    soImpliedDiscount(activePo) === 0;

  /** Ubah daftar item + sesuaikan diskon (diskon item yang dihapus ikut hilang, diskon tambahan tetap). */
  function editItems(next: QuotationItem[]) {
    if (sumItemDiscounts(items) > 0 || sumItemDiscounts(next) > 0) {
      const d = recomputeHeaderDiscount(effectiveDiscount, items, next);
      setCustomDiscount(d > 0 ? formatThousands(d) : "");
    }
    setItems(next);
  }

  // Deal DPP (total dasar setelah diskon)
  const dealDpp = React.useMemo(() => {
    return Math.max(0, grossDealDpp - effectiveDiscount);
  }, [grossDealDpp, effectiveDiscount]);

  const [ppnModeState, setPpnMode] = React.useState<PpnMode>(() => {
    if (initialPo?.ppnMode && initialPo.ppnMode !== "none")
      return initialPo.ppnMode as PpnMode;
    if (initialPo?.quotationId) {
      const q = (data.quotations ?? []).find(
        (x: Row) => String(x.id) === String(initialPo.quotationId),
      );
      if (q && (Number(initialPo.ppn || 0) > 0 || Number(q.ppn || 0) > 0))
        return getInitialPpnMode(q);
    }
    if (initialPo?.ppnMode) return initialPo.ppnMode as PpnMode;
    if (initialPo?.tipePpn) return getInitialPpnMode(initialPo);
    return getInitialPpnMode(initialQuotation);
  });
  // Tagihan supplier dari PO: mode PPN mengikuti PO (Exclude / Include / Tanpa PPN)
  const ppnMode: PpnMode = supplierPoRef ? supplierPoRef.mode : ppnModeState;
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

  /**
   * Kapan PPh penjualan dipotong:
   * - "bayar"  : invoice menagih penuh DPP + PPN; PPh dicatat saat pembayaran (bukti potong customer).
   * - "terbit" : total invoice langsung dikurangi PPh (DPP + PPN − PPh); PPh diakui saat invoice terbit.
   * Invoice lanjutan (termin/pelunasan) mengikuti cara invoice sebelumnya agar satu proyek konsisten.
   */
  const parentIsNetForm = React.useMemo(() => {
    const p: any = selectedParentInvoice;
    const pph = Number(p?.pph || 0);
    if (!p || pph <= 0) return false;
    return (
      Math.abs(
        Number(p.nilai || 0) + Number(p.ppn || 0) - pph - Number(p.total || 0),
      ) <= 2
    );
  }, [selectedParentInvoice]);
  type PphTiming = "bayar" | "terbit";
  // Pilihan manual hanya berlaku untuk konteks (mode + invoice induk) saat dipilih; ganti konteks -> kembali ke default.
  const pphTimingContext = `${mode}:${mode === "lanjut" ? String((selectedParentInvoice as any)?.id ?? "") : ""}`;
  const [pphTimingChoice, setPphTimingChoice] = React.useState<{
    ctx: string;
    value: PphTiming;
  } | null>(null);
  const defaultPphTiming: PphTiming =
    mode === "lanjut" && parentIsNetForm ? "terbit" : "bayar";
  const pphTiming: PphTiming =
    pphTimingChoice?.ctx === pphTimingContext
      ? pphTimingChoice.value
      : defaultPphTiming;
  const setPphTiming = (value: PphTiming) =>
    setPphTimingChoice({ ctx: pphTimingContext, value });
  const isPurchaseForm = mode === "masuk" || sourceType === "direct_purchase";

  const dealPph = React.useMemo(() => {
    const dealEffectiveDpp = isIncludePpn
      ? Math.round(dealDpp / 1.11)
      : dealDpp;
    const sourceItems =
      items.length > 0
        ? items
        : Array.isArray(activePo?.items) && activePo.items.length > 0
          ? activePo.items
          : Array.isArray(activeQuotation?.items) &&
              activeQuotation.items.length > 0
            ? activeQuotation.items
            : [];
    if (sourceItems.length > 0) {
      const netSum = sourceItems.reduce(
        (s: number, it: any) => s + itemNet(it),
        0,
      );
      const factor =
        netSum > 0
          ? dealEffectiveDpp / netSum
          : dealDpp > 0
            ? dealEffectiveDpp / dealDpp
            : 1;
      const sum = sourceItems.reduce((acc: number, it: any) => {
        const mode = (it?.pphMode || "none") as PphMode;
        if (mode === "none") return acc;
        return acc + Math.round(itemNet(it) * factor * pphRateFor(mode));
      }, 0);
      if (sum > 0) return sum;
    }
    if (Number(activePo?.pph) > 0) return Number(activePo?.pph);
    if (Number(activeQuotation?.pph) > 0) return Number(activeQuotation?.pph);
    const effRate = pphRateFor(pphMode);
    if (effRate > 0) {
      const serviceDpp = sourceItems.reduce((acc: number, it: any) => {
        const isJasa =
          (it as any).itemType === "JASA" ||
          !it.productId ||
          /^\[(JASA)\]/i.test(
            String((it as any).customName || it.name || it.item || ""),
          );
        return isJasa ? acc + itemNet(it) : acc;
      }, 0);
      if (serviceDpp > 0) {
        const netSum = sourceItems.reduce(
          (s: number, it: any) => s + itemNet(it),
          0,
        );
        const factor = netSum > 0 ? dealEffectiveDpp / netSum : 1;
        return Math.round(serviceDpp * factor * effRate);
      }
      return Math.round(dealEffectiveDpp * effRate);
    }
    return 0;
  }, [items, activePo, activeQuotation, pphMode, dealDpp, isIncludePpn]);

  const dealPpn = isNoPpn
    ? 0
    : isIncludePpn
      ? Math.max(0, dealDpp - Math.round(dealDpp / 1.11))
      : Math.round(dealDpp * 0.11);
  // Nilai tagihan = DPP + PPN; dikurangi PPh hanya bila PPh dipotong saat invoice terbit (atau tagihan supplier).
  const dealGross = isNoPpn || isIncludePpn ? dealDpp : dealDpp + dealPpn;
  const dealGrandTotal =
    (isPurchaseForm || pphTiming === "terbit") && dealPph < dealGross
      ? dealGross - dealPph
      : dealGross;
  const pphWithheldAtIssue = isPurchaseForm || pphTiming === "terbit";
  const pphTipeLabel = pphModeToTipe(
    pphMode !== "none"
      ? pphMode
      : (items.find((it: any) => it.pphMode && it.pphMode !== "none")
          ?.pphMode as PphMode) ||
          activePo?.pphMode ||
          "pph23",
  );
  const pphLineLabel = isPurchaseForm
    ? `Potongan ${pphTipeLabel} (kita potong dari supplier)`
    : pphWithheldAtIssue
      ? `Potongan ${pphTipeLabel} (dipotong di invoice)`
      : `${pphTipeLabel} dipotong customer saat bayar`;

  // Total already billed in DPP
  // Harus satuan yang sama dengan dealDpp: bila harga termasuk PPN, dealDpp = nilai termasuk PPN,
  // jadi yang sudah ditagih juga dihitung DPP + PPN (dulu hanya DPP -> sisa pelunasan kebesaran).
  const alreadyBilledDpp = React.useMemo(() => {
    return relatedExistingInvoices.reduce(
      (acc: number, inv: Row) =>
        acc +
        (Number(inv.nilai) || 0) +
        (isIncludePpn ? Number(inv.ppn) || 0 : 0),
      0,
    );
  }, [relatedExistingInvoices, isIncludePpn]);

  const remainingDpp = Math.max(0, dealDpp - alreadyBilledDpp);

  // Submitting & File extracting
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [pickerOpen, setPickerOpen] = React.useState<boolean>(false);

  // Select parent invoice handler (Mode Lanjut)
  function handleSelectParentInvoice(invoiceId: string) {
    setSelectedParentInvoiceId(invoiceId);
    const parent = (data.invoices ?? []).find(
      (inv: Row) => String(inv.id) === String(invoiceId),
    );
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
      matchedQuote =
        (data.quotations ?? []).find(
          (x: Row) => String(x.id) === String(parent.quotationId),
        ) || null;
    } else if (parent.quotation) {
      matchedQuote =
        (data.quotations ?? []).find(
          (x: Row) => x.nomor === parent.quotation,
        ) || null;
      setSelectedQuotationId(matchedQuote ? String(matchedQuote.id) : "");
    } else {
      setSelectedQuotationId("");
    }

    if (matchedQuote) {
      if (matchedQuote.tipePpn || matchedQuote.ppnMode)
        setPpnMode(getInitialPpnMode(matchedQuote));
      if (matchedQuote.pphMode) setPphMode(matchedQuote.pphMode as PphMode);
      if (matchedQuote.discount || matchedQuote.disc)
        setCustomDiscount(
          formatThousands(matchedQuote.discount || matchedQuote.disc),
        );
      if (matchedQuote.customerId)
        setSelectedCustomerId(String(matchedQuote.customerId));
    }

    if (parent.clientPoId) {
      setSelectedPoId(String(parent.clientPoId));
    } else if (parent.po) {
      const matchedPo = (data["po-client"] ?? []).find(
        (p: Row) => p.nomor === parent.po || p.nomorSo === parent.po,
      );
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
    const rootParentId = parent.parentInvoiceId
      ? String(parent.parentInvoiceId)
      : parentId;
    const parentNum = parent.nomor || parent.number;
    const matchPrefix = parentNum
      ? String(parentNum).match(/^(INV\/\d{4}\/\d{2}\/\d+)/i)?.[1]
      : null;
    const parentPoId = parent.clientPoId;
    const parentQuoteId = parent.quotationId;

    const siblings = (data.invoices ?? []).filter((inv: Row) => {
      const st = String(inv.status || "").toUpperCase();
      if (st === "BATAL" || st === "DIBATALKAN") return false;
      if (String(inv.id) === parentId) return true;
      if (
        inv.parentInvoiceId &&
        (String(inv.parentInvoiceId) === parentId ||
          String(inv.parentInvoiceId) === rootParentId)
      )
        return true;
      if (String(inv.id) === rootParentId) return true;
      if (
        matchPrefix &&
        String(inv.nomor || inv.number || "").startsWith(matchPrefix)
      )
        return true;
      if (parentPoId && String(inv.clientPoId) === String(parentPoId))
        return true;
      if (parentQuoteId && String(inv.quotationId) === String(parentQuoteId))
        return true;
      return false;
    });

    setNomor(
      generateInvoiceNumber(
        true,
        scheme,
        siblings,
        data.invoices?.length || 0,
        data.invoices,
      ),
    );
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
      if (
        !catatan ||
        catatan === "Nota Penjualan Langsung (Walk-in)" ||
        catatan.startsWith("Faktur untuk")
      ) {
        setCatatan("Tagihan Operasional / Faktur Masuk");
      }
    } else if (newMode === "lanjut") {
      if (sourceType === "direct_purchase") setSourceType("po");
      setItems([]);
      let candidateId = continuableInvoiceOptions.some(
        (o) => o.id === selectedParentInvoiceId,
      )
        ? selectedParentInvoiceId
        : "";
      if (!candidateId) {
        if (initialPo) {
          const match = continuableInvoiceOptions.find(
            (o) => String(o.raw.clientPoId) === String(initialPo.id),
          );
          if (match) candidateId = match.id;
        }
        if (!candidateId && initialQuotation) {
          const match = continuableInvoiceOptions.find(
            (o) =>
              String(o.raw.quotationId) === String(initialQuotation.id) ||
              (initialQuotation.nomor &&
                initialQuotation.nomor !== "-" &&
                o.raw.quotation === initialQuotation.nomor),
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
        const qd =
          Number(activeQuotation.discount ?? activeQuotation.disc ?? 0) || 0;
        setCustomDiscount(qd > 0 ? formatThousands(qd) : "");
      } else if (activePo?.items && Array.isArray(activePo.items)) {
        setItems(activePo.items);
        const sd = soImpliedDiscount(activePo);
        setCustomDiscount(sd > 0 ? formatThousands(sd) : "");
      }
      setNomor(
        generateInvoiceNumber(
          false,
          scheme,
          relatedExistingInvoices,
          data.invoices?.length || 0,
          data.invoices,
        ),
      );
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
    setNomor(
      generateInvoiceNumber(
        mode === "lanjut",
        newScheme,
        relatedExistingInvoices,
        data.invoices?.length || 0,
        data.invoices,
      ),
    );
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
      // Dasar persen = harga sebelum diskon (total kotor item penawaran)
      const baseGross =
        (Array.isArray(q.items) && q.items.length > 0
          ? sumItemGross(q.items)
          : 0) || Number(q.total || q.nilai || 0);
      if (baseGross > 0) {
        setDiscPercent(
          String(Math.round((rawDisc / baseGross) * 100 * 10) / 10),
        );
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
        if (
          linkedQ &&
          Array.isArray(linkedQ.items) &&
          linkedQ.items.length > 0
        ) {
          setItems(linkedQ.items);
        }
      } else if (match.nilai) {
        setCustomDpp(formatThousands(match.nilai));
      }
    } else {
      setItems([]);
    }
    const linkedQ = match.quotationId
      ? (data.quotations ?? []).find(
          (q: Row) => String(q.id) === String(match.quotationId),
        )
      : null;
    if (match.ppnMode && match.ppnMode !== "none") {
      setPpnMode(getInitialPpnMode(match));
    } else if (linkedQ && Number(linkedQ.ppn || 0) > 0) {
      setPpnMode(getInitialPpnMode(linkedQ));
    } else if (match.tipePpn || match.ppnMode) {
      setPpnMode(getInitialPpnMode(match));
    }
    const detectedPph =
      getInitialPphMode(match) !== "none"
        ? getInitialPphMode(match)
        : getInitialPphMode(linkedQ);
    if (detectedPph !== "none") {
      setPphMode(detectedPph);
    } else if (match.pphMode && match.pphMode !== "none") {
      setPphMode(match.pphMode as PphMode);
    }
    // Diskon mengikuti sumber item: item SO = harga net; item penawaran = harga kotor + diskon penawaran.
    let nextDisc = 0;
    let nextBase = 0;
    if (Array.isArray(match.items) && match.items.length > 0) {
      nextDisc =
        soImpliedDiscount(match) ||
        (linkedQ ? Number(linkedQ.discount ?? linkedQ.disc ?? 0) || 0 : 0);
      nextBase = sumItemGross(match.items);
    } else if (
      linkedQ &&
      Array.isArray(linkedQ.items) &&
      linkedQ.items.length > 0
    ) {
      nextDisc = Number(linkedQ.discount ?? linkedQ.disc ?? 0) || 0;
      nextBase = sumItemGross(linkedQ.items);
    }
    setCustomDiscount(nextDisc > 0 ? formatThousands(nextDisc) : "");
    setDiscPercent(
      nextDisc > 0 && nextBase > 0
        ? String(Math.round((nextDisc / nextBase) * 1000) / 10)
        : "",
    );
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
        (c: Row) =>
          c.nama?.toLowerCase() === (l.perusahaan || l.nama)?.toLowerCase(),
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
  const {
    currentDpp,
    currentBase,
    currentPpn,
    currentPph,
    currentTotal,
    pphCutAtIssue,
    calculatedPct,
  } = React.useMemo(() => {
    let dpp = 0;
    let pct = 100;

    if (mode === "masuk") {
      if (relatedExistingInvoices.length > 0) {
        if (continuationType === "pelunasan") {
          dpp = remainingDpp;
          pct = dealDpp > 0 ? Math.round((dpp / dealDpp) * 100) : 100;
        } else {
          pct =
            Number(terminPercent) ||
            (dealDpp > 0 ? Math.round((remainingDpp / dealDpp) * 100) : 30);
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
        pct =
          Number(terminPercent) ||
          (dealDpp > 0 ? Math.round((remainingDpp / dealDpp) * 100) : 30);
        dpp = Math.min(remainingDpp, Math.round(dealDpp * (pct / 100)));
      }
    }

    const rawBase = dpp;
    let effectiveDpp = isIncludePpn ? Math.round(rawBase / 1.11) : rawBase;
    let ppn = isNoPpn
      ? 0
      : isIncludePpn
        ? Math.max(0, rawBase - effectiveDpp)
        : Math.round(rawBase * 0.11);
    // Tagihan supplier dari PO: DPP & PPN diambil dari angka PO (proporsional untuk DP/termin, sisa PO untuk tagihan terakhir)
    let fromPo = false;
    if (
      mode === "masuk" &&
      supplierPoRef &&
      !isNoPpn &&
      supplierPoRef.ppn > 0
    ) {
      const billedDpp = relatedExistingInvoices.reduce(
        (s: number, inv: Row) => s + (Number(inv.nilai) || 0),
        0,
      );
      const billedPpn = relatedExistingInvoices.reduce(
        (s: number, inv: Row) => s + (Number(inv.ppn) || 0),
        0,
      );
      const isFinal = rawBase >= remainingDpp && remainingDpp > 0;
      if (isFinal) {
        effectiveDpp = Math.max(0, supplierPoRef.dpp - billedDpp);
        ppn = Math.max(0, supplierPoRef.ppn - billedPpn);
      } else if (isIncludePpn) {
        effectiveDpp = Math.round(
          (rawBase * supplierPoRef.dpp) /
            (supplierPoRef.dpp + supplierPoRef.ppn),
        );
        ppn = Math.max(0, rawBase - effectiveDpp);
      } else {
        ppn = Math.round((rawBase * supplierPoRef.ppn) / supplierPoRef.dpp);
      }
      fromPo = true;
    }

    // Cari porsi DPP Jasa yang terkena PPh dari item SO / penawaran
    const sourceItems =
      items.length > 0
        ? items
        : Array.isArray(activePo?.items) && activePo.items.length > 0
          ? activePo.items
          : Array.isArray(activeQuotation?.items) &&
              activeQuotation.items.length > 0
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
          /^\[(JASA)\]/i.test(
            String(it.customName || it.name || it.item || ""),
          );
        return isJasa
          ? acc + (Number(it.qty) || 1) * Number(it.harga ?? it.price ?? 0)
          : acc;
      }, 0);
    } else {
      const refPph = Number(activePo?.pph ?? activeQuotation?.pph ?? 0);
      const refPphMode = (activePo?.pphMode ??
        activeQuotation?.pphMode ??
        pphMode) as PphMode;
      if (refPph > 0 && refPphMode !== "none") {
        const rate = pphRateFor(refPphMode);
        if (rate > 0) totalServiceDpp = Math.round(refPph / rate);
      }
    }

    const effPphRate = pphRateFor(pphMode);
    const netItemsSum = items.reduce((s, it) => s + itemNet(it), 0);
    const dppFactor =
      netItemsSum > 0
        ? effectiveDpp / netItemsSum
        : rawBase > 0
          ? effectiveDpp / rawBase
          : 1;
    const itemPphSum = items.reduce((acc, it) => {
      const mode = (it.pphMode || "none") as PphMode;
      if (mode === "none") return acc;
      return acc + Math.round(itemNet(it) * dppFactor * pphRateFor(mode));
    }, 0);
    let pph = 0;
    if (itemPphSum > 0) {
      pph = itemPphSum;
    } else if (effPphRate > 0) {
      if (totalServiceDpp > 0) {
        const srcNetSum = sourceItems.reduce(
          (s: number, it: any) => s + itemNet(it),
          0,
        );
        const srcDppFactor = srcNetSum > 0 ? effectiveDpp / srcNetSum : 1;
        const invoiceServiceDpp = Math.min(
          effectiveDpp,
          Math.round(totalServiceDpp * srcDppFactor),
        );
        pph = Math.round(invoiceServiceDpp * effPphRate);
      } else {
        pph = Math.round(effectiveDpp * effPphRate);
      }
    }

    const gross = fromPo
      ? effectiveDpp + ppn
      : isIncludePpn
        ? rawBase
        : effectiveDpp + ppn;
    // Pembelian: kita yang memotong PPh supplier -> tagihan supplier selalu net.
    // Penjualan: sesuai pilihan "kapan PPh dipotong".
    const cutAtIssue =
      pph > 0 && pph < gross && (isPurchaseForm || pphTiming === "terbit");
    const total = cutAtIssue ? gross - pph : gross;
    return {
      currentDpp: effectiveDpp,
      // Nilai tagihan ini dalam satuan yang sama dengan dealDpp (termasuk PPN bila harga include PPN)
      currentBase: rawBase,
      currentPpn: ppn,
      currentPph: pph,
      currentTotal: total,
      pphCutAtIssue: cutAtIssue,
      calculatedPct: pct,
    };
  }, [
    mode,
    isPurchaseForm,
    pphTiming,
    scheme,
    dpPercent,
    terminPercent,
    dealDpp,
    continuationType,
    remainingDpp,
    isNoPpn,
    isIncludePpn,
    pphMode,
    items,
    activePo,
    activeQuotation,
    supplierPoRef,
    relatedExistingInvoices,
  ]);

  // Handle Submit
  async function handleSubmit() {
    if (!nomor.trim()) {
      toast("Nomor faktur wajib diisi", "danger");
      return;
    }
    if (currentDpp <= 0) {
      toast("Nilai tagihan faktur harus lebih dari 0", "danger");
      return;
    }

    const isPurchase = mode === "masuk" || sourceType === "direct_purchase";
    if (isPurchase && !fileId) {
      toast("File faktur / tagihan pemasok wajib diunggah", "danger");
      return;
    }
    const isPaidNow = !isProforma && paymentStatus === "PAID";
    if (isPurchase && isPaidNow && !paymentFileId) {
      toast(
        "Bukti pembayaran / transfer wajib diunggah untuk status Lunas",
        "danger",
      );
      return;
    }
    const supplierObj = (data.suppliers ?? []).find(
      (s: Row) => String(s.id) === String(selectedSupplierId),
    );
    const suppPoObj = (data["supplier-pos"] ?? []).find(
      (p: Row) => String(p.id) === String(selectedSupplierPoId),
    );
    const customerObj = (data.customers ?? []).find(
      (c: Row) => String(c.id) === String(selectedCustomerId),
    );

    const validCustStr = (v?: string | null) => (v && v !== "-" ? v : null);
    const custName = isPurchase
      ? customSupplierName ||
        supplierObj?.nama ||
        supplierObj?.name ||
        "Pemasok Pembelian Langsung"
      : validCustStr(customCustomerName) ||
        validCustStr(customerObj?.nama) ||
        (sourceType === "direct_sale"
          ? "Pelanggan Langsung (Walk-in)"
          : null) ||
        validCustStr(activeQuotation?.customer) ||
        validCustStr(activePo?.customer) ||
        validCustStr(activeLead?.perusahaan) ||
        validCustStr(activeLead?.nama) ||
        (sourceType === "direct_sale"
          ? "Pelanggan Langsung (Walk-in)"
          : "Pelanggan Umum");

    const invoiceType =
      mode === "lanjut" ||
      (mode === "masuk" && relatedExistingInvoices.length > 0)
        ? continuationType === "pelunasan" || remainingDpp - currentDpp <= 0
          ? "Pelunasan"
          : "Termin"
        : scheme === "dp"
          ? "DP"
          : scheme === "termin"
            ? "Termin"
            : "Pelunasan";

    const refTitle = isPurchase
      ? `Pembelian Langsung ${suppPoObj?.nomor || suppPoObj?.number || custName}`
      : sourceType === "direct_sale"
        ? `Penjualan Langsung (Walk-in)`
        : activeQuotation?.nomor ||
          activePo?.nomor ||
          activePo?.nomorSo ||
          (activeLead ? `Prospek ${activeLead.nama}` : "Invoice");

    const termDesc =
      mode === "lanjut" ||
      (mode === "masuk" && relatedExistingInvoices.length > 0)
        ? continuationType === "pelunasan"
          ? `Pelunasan (${calculatedPct}%) - ${refTitle}`
          : `Termin ${terminNumber} (${calculatedPct}%) - ${refTitle}`
        : scheme === "dp"
          ? `DP (${calculatedPct}%) - ${refTitle}`
          : scheme === "termin"
            ? `Termin 1 (${calculatedPct}%) - ${refTitle}`
            : `Pembayaran Penuh (100%) - ${refTitle}`;
    // Keterangan PPN ikut tertulis di setiap termin agar DP & pelunasan konsisten
    const ppnNote = isNoPpn
      ? ""
      : isIncludePpn
        ? " (Termasuk PPN 11%)"
        : " (Belum termasuk PPN 11%)";
    const termItemDesc = `${termDesc}${ppnNote}`;

    let fullCatatan = catatan.trim()
      ? `${termDesc}. ${catatan.trim()}`
      : termDesc;
    if (activeLead?.id && !fullCatatan.includes(`[lead:${activeLead.id}]`)) {
      fullCatatan += ` [lead:${activeLead.id}]`;
    }

    setIsSubmitting(true);
    const effectiveInvoicePphMode: PphMode =
      pphMode !== "none"
        ? pphMode
        : items.find((it: any) => it.pphMode && it.pphMode !== "none")
            ?.pphMode ||
          activePo?.pphMode ||
          (currentPph > 0 ? "pph23" : "none");
    try {
      if (isPurchase) {
        const selectedCatOpt =
          invoiceInCategoryOptions.find(
            (o) => o.code === purchaseCategoryCode,
          ) || invoiceInCategoryOptions[0]!;
        const accLabel =
          kasBankOptions.find((o) => o.code === paymentAccountCode)?.rawName ||
          paymentMethod;
        const createdIn = await addRow("invoiceIn", {
          nomor: nomor.trim() || undefined,
          supplierId: selectedSupplierId
            ? Number(selectedSupplierId)
            : undefined,
          supplier: custName,
          supplierPoId: selectedSupplierPoId
            ? Number(selectedSupplierPoId)
            : undefined,
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
          transferFileId:
            isPaidNow && paymentFileId ? paymentFileId : undefined,
        });

        if (createdIn) {
          toast(
            `Invoice Masuk ${nomor} (${selectedCatOpt.category}) berhasil disimpan${
              isPaidNow ? ` & langsung Lunas (${accLabel})` : ""
            }!`,
          );
          if (selectedSupplierPoId) {
            pushHistory(
              "supplier-pos",
              selectedSupplierPoId,
              `Invoice Masuk ${nomor} (${rupiah(currentTotal)}) dibuat`,
            );
          }
          onClose();
          await reload();
          await onSuccess?.();
        }
        return;
      }

      const created = await addRow("invoices", {
        // Proforma diberi nomor PI/... oleh server
        nomor: isProforma ? undefined : nomor.trim() || undefined,
        isProforma: isProforma || undefined,
        customer: custName,
        customerId: isPurchase
          ? undefined
          : selectedCustomerId ||
            (customerObj?.id ? String(customerObj.id) : undefined),
        supplierId: isPurchase
          ? selectedSupplierId
            ? Number(selectedSupplierId)
            : undefined
          : undefined,
        supplier: isPurchase ? custName : undefined,
        supplierPoId:
          isPurchase && selectedSupplierPoId
            ? Number(selectedSupplierPoId)
            : undefined,
        projectId:
          mode === "lanjut" && selectedParentInvoice?.projectId
            ? Number(selectedParentInvoice.projectId)
            : activeQuotation?.projectId
              ? Number(activeQuotation.projectId)
              : undefined,
        project:
          mode === "lanjut" && selectedParentInvoice?.project
            ? selectedParentInvoice.project
            : activeQuotation?.project || undefined,
        leadId: activeLead?.id ? String(activeLead.id) : undefined,
        lead: activeLead?.nama || undefined,
        quotationId: activeQuotation?.id
          ? String(activeQuotation.id)
          : mode === "lanjut" && selectedParentInvoice?.quotationId
            ? String(selectedParentInvoice.quotationId)
            : undefined,
        quotation:
          activeQuotation?.nomor ||
          (mode === "lanjut" ? selectedParentInvoice?.quotation : undefined) ||
          undefined,
        clientPoId: activePo?.id
          ? String(activePo.id)
          : mode === "lanjut" && selectedParentInvoice?.clientPoId
            ? String(selectedParentInvoice.clientPoId)
            : undefined,
        po: isPurchase
          ? suppPoObj?.nomor || suppPoObj?.number || undefined
          : activePo?.nomor ||
            activePo?.nomorSo ||
            activePo?.number ||
            (mode === "lanjut" ? selectedParentInvoice?.po : undefined) ||
            undefined,
        jenis: invoiceType,
        nilai: currentDpp,
        discount: mode === "lanjut" ? undefined : effectiveDiscount,
        tipePpn: ppnModeToTipe(ppnMode),
        ppnMode,
        ppn: currentPpn,
        pph: currentPph,
        pphMode: effectiveInvoicePphMode,
        tipePph: pphModeToTipe(effectiveInvoicePphMode),
        total: currentTotal,
        items:
          mode === "lanjut"
            ? [
                {
                  item: termItemDesc,
                  qty: 1,
                  satuan: "paket",
                  // Harga termasuk PPN -> nilai termin juga termasuk PPN (sama seperti DP dari item penawaran)
                  harga: isIncludePpn ? currentBase : currentDpp,
                  total: isIncludePpn ? currentBase : currentDpp,
                  isContinuation: true,
                  kind: "SERVICE",
                },
              ]
            : items.length > 0
              ? items
              : undefined,
        isContinuation: mode === "lanjut",
        parentInvoiceId:
          mode === "lanjut" && selectedParentInvoiceId
            ? Number(selectedParentInvoiceId)
            : undefined,
        dpLabel:
          calculatedPct < 100
            ? `${invoiceType} (${calculatedPct}%)`
            : undefined,
        dpAmount: calculatedPct < 100 ? currentDpp : undefined,
        subject: isPurchase
          ? `FAKTUR PEMBELIAN LANGSUNG - ${custName.toUpperCase()}`
          : activeQuotation?.subject ||
            `INVOICE PENAGIHAN - ${custName.toUpperCase()}`,
        intro: isPurchase
          ? "Faktur pembelian langsung barang/jasa dari pemasok :"
          : activeQuotation?.intro ||
            "Bersama surat ini kami sampaikan faktur penagihan untuk pekerjaan berikut :",
        notesList: activeQuotation?.notesList,
        city: activeQuotation?.city,
        kopText: activeQuotation?.kopText,
        kopLogoUrl: activeQuotation?.kopLogoUrl,
        customerAddress:
          activeQuotation?.customerAddress ||
          customerObj?.address ||
          customerObj?.alamat,
        tanggal,
        jatuhTempo: isPaidNow ? tanggal : jatuhTempo,
        status: isProforma ? "Terkirim" : isPaidNow ? "Lunas" : "Belum dikirim",
        terbayar: isPaidNow ? currentTotal : 0,
        catatan: isPaidNow
          ? `${fullCatatan} (${isPurchase ? "Pembelian Langsung - Lunas" : "Lunas Langsung"} - ${paymentMethod} [AKUN:${paymentAccountCode}])`
          : fullCatatan,
        fileId: fileId || undefined,
      });

      if (created) {
        if (
          isPaidNow &&
          created.id &&
          !String(created.id).startsWith("offline-") &&
          currentTotal > 0
        ) {
          // PPh dipotong saat bayar: customer transfer total − PPh, PPh (bukti potong) ikut melunasi tagihan.
          // PPh dipotong saat terbit: total invoice sudah net, cukup catat uang yang diterima.
          const pphCut =
            !isPurchase &&
            !pphCutAtIssue &&
            currentPph > 0 &&
            currentPph < currentTotal
              ? currentPph
              : 0;
          await api("POST", `/invoices/${created.id}/payments`, {
            amount: currentTotal - pphCut,
            pph23Amount: pphCut > 0 ? pphCut : undefined,
            date: tanggal,
            method: paymentMethod,
            reference: `LUNAS-${nomor.trim()} [${paymentAccountCode}]`,
            fileId: paymentFileId || undefined,
          }).catch(() => {});
        }
        const accLabel =
          kasBankOptions.find((o) => o.code === paymentAccountCode)?.rawName ||
          paymentMethod;
        toast(
          `Invoice ${nomor} (${invoiceType}) berhasil dibuat${
            isPaidNow ? ` & langsung Lunas (${accLabel})` : ""
          }!`,
        );
        if (isPurchase && selectedSupplierPoId) {
          pushHistory(
            "supplier-pos",
            selectedSupplierPoId,
            `Invoice Pembelian ${nomor} (${rupiah(currentTotal)}) dibuat`,
          );
        }
        if (activePo?.id) {
          pushHistory(
            "po-client",
            activePo.id,
            `Invoice ${nomor} (${rupiah(currentTotal)}) dibuat`,
          );
        }
        if (activeQuotation?.id) {
          pushHistory(
            "quotations",
            activeQuotation.id,
            `Invoice ${nomor} (${rupiah(currentTotal)}) dibuat`,
          );
        }
        if (activeLead?.id) {
          pushHistory(
            "leads",
            activeLead.id,
            `Invoice ${nomor} (${rupiah(currentTotal)}) dibuat langsung`,
          );
        }
        onClose();
        await reload();
        await onSuccess?.();
      }
    } catch (e: any) {
      toast(e?.message ?? "Gagal membuat faktur", "danger");
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    activeLead,
    activePo,
    activeQuotation,
    alreadyBilledDpp,
    calculatedPct,
    catatan,
    continuableInvoiceInOptions,
    continuableInvoiceOptions,
    continuationType,
    currentBase,
    currentDpp,
    currentPph,
    currentPpn,
    currentTotal,
    customCustomerName,
    customDiscount,
    customDpp,
    customSupplierName,
    data,
    dealDpp,
    dealGrandTotal,
    dealPph,
    dealPpn,
    discPctLabel,
    discPercent,
    discountAlreadyInSoPrices,
    dpPercent,
    editItems,
    effectiveDiscount,
    grossDealDpp,
    handleSelectLead,
    handleSelectParentInvoice,
    handleSelectPo,
    handleSelectQuotation,
    handleSubmit,
    handleSwitchMode,
    handleSwitchScheme,
    invoiceInCategoryOptions,
    isIncludePpn,
    isNoPpn,
    isProforma,
    isPurchaseForm,
    isSubmitting,
    items,
    jatuhTempo,
    kasBankOptions,
    linkedQuoteForDisc,
    mode,
    nomor,
    onClose,
    paymentAccountCode,
    paymentStatus,
    pickerOpen,
    pphCutAtIssue,
    pphLineLabel,
    pphTiming,
    pphTipeLabel,
    pphWithheldAtIssue,
    ppnMode,
    purchaseCategoryCode,
    quickCustomerOpen,
    quickSupplierOpen,
    relatedExistingInvoices,
    remainingDpp,
    scheme,
    selectedCustomerId,
    selectedItemIndices,
    selectedLeadId,
    selectedParentChain,
    selectedParentInvoice,
    selectedParentInvoiceId,
    selectedParentInvoiceInId,
    selectedPoId,
    selectedQuotationId,
    selectedSupplierId,
    selectedSupplierPoId,
    setCatatan,
    setContinuationType,
    setCustomCustomerName,
    setCustomDiscount,
    setCustomDpp,
    setCustomSupplierName,
    setDiscPercent,
    setDpPercent,
    setFileId,
    setIsProforma,
    setItems,
    setJatuhTempo,
    setNomor,
    setPaymentAccountCode,
    setPaymentFileId,
    setPaymentMethod,
    setPaymentStatus,
    setPickerOpen,
    setPphMode,
    setPphTiming,
    setPpnMode,
    setPurchaseCategoryCode,
    setQuickCustomerOpen,
    setQuickSupplierOpen,
    setScheme,
    setSelectedCustomerId,
    setSelectedItemIndices,
    setSelectedParentInvoiceInId,
    setSelectedSupplierId,
    setSelectedSupplierPoId,
    setShowAllItems,
    setShowExtraDiscount,
    setShowMoreOptions,
    setSourceType,
    setTanggal,
    setTerminPercent,
    showAllItems,
    showExtraDiscount,
    showMoreOptions,
    sourceType,
    sourceTypeOptions,
    supplierPoRef,
    tanggal,
    terminNumber,
    terminPercent,
    toast,
  };
}

export type InvoiceFormScope = ReturnType<typeof useInvoiceForm>;
