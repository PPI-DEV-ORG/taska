import * as React from "react";
import { View, ScrollView, Pressable, Image } from "react-native";
import { useRouter } from "expo-router";
import { Printer, Plus, Check, CheckCircle2, Circle, ExternalLink, RefreshCw, Package, Edit2, Trash2, FileCheck, FileText, Upload } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Panel, Cell } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { CreateInvoiceDialog } from "@/modules/invoice/create-invoice-dialog";
import { RecordClientPoDialog } from "@/modules/project/record-client-po-dialog";
import { SerialItemPickerModal } from "@/components/taska/serial-item-picker";
import { useApp } from "@/store/app-store";
import { api, apiBase, downloadDocumentationPdf } from "@/services/api";
import { FileUploader, type FileUploaderHandle } from "@/components/taska/file-uploader";
import { colors } from "@/tokens";
import { rupiah, formatThousands, tanggal } from "@/lib/format";
import { type Row } from "@/constants/modules";
import { DocumentationPhotosPanel } from "@/modules/shared/documentation-photos-panel";
import { Line } from "@/modules/shared/line";
import { DocumentViewerItem, resolveModuleDocs } from "@/components/taska/document-viewer";
import { adaptRows } from "@/services/adapters";

/**
 * Biaya operasional yang dikaitkan ke project, diambil langsung dari server per projectId
 * (tidak bergantung pada scope list role / limit store) lalu digabung dengan data store.
 */
export function useProjectExpenses(projectId: string | number | undefined, projectName?: string): Row[] {
  const { data } = useApp();
  const [remote, setRemote] = React.useState<Row[]>([]);
  const storeCount = (data.expenses ?? []).length;
  React.useEffect(() => {
    if (!projectId) return;
    let active = true;
    api<any>("GET", `/expenses?projectId=${projectId}&limit=200`)
      .then((res) => {
        if (active) setRemote(adaptRows("expenses", Array.isArray(res?.items) ? res.items : []));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [projectId, storeCount]);
  return React.useMemo(() => {
    const map = new Map<string, Row>();
    for (const e of data.expenses ?? []) {
      if (String(e.projectId) === String(projectId) || (projectName && e.project === projectName)) map.set(String(e.id), e);
    }
    for (const e of remote) map.set(String(e.id), e);
    return Array.from(map.values()).filter((e) => e.status !== "Ditolak");
  }, [data.expenses, remote, projectId, projectName]);
}

const PPH_OPTIONS = [
  { id: "none", label: "Non-PPh" },
  { id: "pph21", label: "PPh 21 (0.5%)" },
  { id: "pph23", label: "PPh 23 (2%)" },
  { id: "pph4_2", label: "PPh 4(2) (1.75%)" },
  { id: "pph22", label: "PPh 22 (1.5%)" },
];

export function ProjectExtras({ row }: { row: Row }) {
  const router = useRouter();
  const { toast, data, reload, user, patchRow } = useApp();
  const products: Row[] = data.products ?? [];
  const serials: Row[] = data.serials ?? [];
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [createInvOpen, setCreateInvOpen] = React.useState(false);
  const [isSyncingBoq, setIsSyncingBoq] = React.useState(false);
  const [customBoqOpen, setCustomBoqOpen] = React.useState(false);
  const [customBoqName, setCustomBoqName] = React.useState("");
  const [customBoqCostPrice, setCustomBoqCostPrice] = React.useState("");
  const [customBoqPrice, setCustomBoqPrice] = React.useState("");
  const [customBoqUnit, setCustomBoqUnit] = React.useState("pcs");
  const [customBoqQty, setCustomBoqQty] = React.useState("1");
  const [customBoqPphMode, setCustomBoqPphMode] = React.useState("none");
  const [bastOpen, setBastOpen] = React.useState(false);
  const [bastMode, setBastMode] = React.useState<"generate" | "upload">("generate");
  const [bastNumber, setBastNumber] = React.useState("");
  const [bastDate, setBastDate] = React.useState("");
  const [bastP1Company, setBastP1Company] = React.useState("PT GHINA MULTI PRIMA");
  const [bastP1Name, setBastP1Name] = React.useState("");
  const [bastP1Title, setBastP1Title] = React.useState("Project Manager");
  const [bastLogoFileId, setBastLogoFileId] = React.useState<number | null>(null);
  const [bastP2Company, setBastP2Company] = React.useState("");
  const [bastP2Name, setBastP2Name] = React.useState("");
  const [bastP2Title, setBastP2Title] = React.useState("Penanggung Jawab Proyek");
  const [bastStatement, setBastStatement] = React.useState("");
  const [bastNotes, setBastNotes] = React.useState("");
  const [bastItems, setBastItems] = React.useState<{ name: string; qty: number; unit: string }[]>([]);
  const [isGeneratingBast, setIsGeneratingBast] = React.useState(false);
  const bastUploaderRef = React.useRef<FileUploaderHandle | null>(null);
  const bastLogoUploaderRef = React.useRef<FileUploaderHandle | null>(null);

  const [requirements, setRequirements] = React.useState<
    {
      id: string;
      productId?: string;
      produk: string;
      sku?: string;
      kategori?: string;
      neededQty: number;
      reservedQty: number;
      shortageQty: number;
      costPrice: number;
      unitPrice: number;
      unit?: string;
      pphMode?: string;
      status: string;
      isExtra?: boolean;
      serials?: string[];
    }[]
  >([]);

  // Edit BOQ Requirement state
  const [editReqOpen, setEditReqOpen] = React.useState(false);
  const [editingReq, setEditingReq] = React.useState<any>(null);
  const [editReqName, setEditReqName] = React.useState("");
  const [editReqQty, setEditReqQty] = React.useState("1");
  const [editReqUnit, setEditReqUnit] = React.useState("unit");
  const [editReqCostPrice, setEditReqCostPrice] = React.useState("");
  const [editReqPrice, setEditReqPrice] = React.useState("");
  const [editReqPphMode, setEditReqPphMode] = React.useState("none");

  // Edit BOQ Service state
  const [editServiceOpen, setEditServiceOpen] = React.useState(false);
  const [editingServiceIdx, setEditingServiceIdx] = React.useState<number | null>(null);
  const [editServiceName, setEditServiceName] = React.useState("");
  const [editServiceQty, setEditServiceQty] = React.useState("1");
  const [editServiceUnit, setEditServiceUnit] = React.useState("Lot");
  const [editServicePrice, setEditServicePrice] = React.useState("");
  const [editServicePphMode, setEditServicePphMode] = React.useState("none");

  const normalizedRole = String(user?.role || "").toLowerCase().replace(/[\s-]/g, "_");
  const canViewBoqPricing = ["super_admin", "superadmin", "bos", "finance", "admin"].includes(normalizedRole);
  const canViewFinancials = ["super_admin", "superadmin", "bos", "finance", "pm", "sales", "admin"].includes(normalizedRole);

  const [quotationDetail, setQuotationDetail] = React.useState<any>(null);
  const [recordClientPoOpen, setRecordClientPoOpen] = React.useState(false);

  const linkedQuotation = React.useMemo(() => {
    const cleanQuoNum = String(row.penawaran || "").split(" - ")[0]?.trim().toLowerCase();
    return (data.quotations ?? []).find(
      (q: Row) =>
        (row.quotationId && String(q.id) === String(row.quotationId)) ||
        (cleanQuoNum && cleanQuoNum !== "-" && String(q.nomor || "").toLowerCase() === cleanQuoNum) ||
        (row.leadId && String(q.leadId) === String(row.leadId)),
    );
  }, [data.quotations, row.quotationId, row.penawaran, row.leadId]);

  const activeQuotation = quotationDetail || linkedQuotation;

  React.useEffect(() => {
    const qId = row.quotationId || linkedQuotation?.id;
    if (!qId) return;
    let active = true;
    api<any>("GET", `/quotations/${qId}`)
      .then((res) => {
        if (active && res) {
          setQuotationDetail(res);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [row.quotationId, linkedQuotation?.id]);

  const linkedSurveys = React.useMemo(() => {
    return (data.surveys ?? []).filter(
      (s: Row) =>
        (row.leadId && String(s.leadId) === String(row.leadId)) ||
        (linkedQuotation?.leadId && String(s.leadId) === String(linkedQuotation.leadId)),
    );
  }, [data.surveys, row.leadId, linkedQuotation]);

  const linkedClientPos = React.useMemo(() => {
    return (data["po-client"] ?? []).filter(
      (po: Row) =>
        (po.projectId && String(po.projectId) === String(row.id)) ||
        (po.catatan && String(po.catatan).includes(`[project:${row.id}]`)) ||
        (linkedQuotation && String(po.quotationId) === String(linkedQuotation.id)) ||
        (row.quotationId && String(po.quotationId) === String(row.quotationId)) ||
        (linkedQuotation?.nomor && String(po.penawaran || "").toLowerCase().includes(String(linkedQuotation.nomor).toLowerCase())),
    );
  }, [data, linkedQuotation, row.id, row.quotationId]);

  const rawProjectInvoices = Array.isArray(row._invoices) ? row._invoices : [];
  const projectInvoices = React.useMemo(() => {
    const list = [...(data.invoices || [])];
    const map = new Map<string, any>();

    for (const inv of list) {
      if (inv.direction === "in" || inv.status === "Batal") continue;
      const isMatched =
        (row.id && String(inv.projectId) === String(row.id)) ||
        (inv.project && inv.project === row.nama) ||
        (linkedQuotation && (String(inv.quotationId) === String(linkedQuotation.id) || (inv.quotation && inv.quotation === linkedQuotation.nomor))) ||
        (row.leadId && String(inv.leadId) === String(row.leadId)) ||
        (inv.catatan && String(inv.catatan).includes(`[project:${row.id}]`));

      if (isMatched) {
        map.set(String(inv.id), inv);
      }
    }
    for (const inv of rawProjectInvoices) {
      if (!map.has(String(inv.id))) {
        map.set(String(inv.id), {
          id: String(inv.id),
          nomor: inv.number,
          total: Number(inv.total || 0),
          nilai: Number(inv.total || 0),
          terbayar: Number(inv.paidAmount || 0),
          status: inv.status === "PAID" ? "Lunas" : inv.status,
          jatuhTempo: inv.dueDate,
        });
      }
    }
    return Array.from(map.values());
  }, [data.invoices, row.id, row.nama, row.leadId, linkedQuotation, rawProjectInvoices]);

  const isAllInvoicesPaid =
    row.pembayaran === "Lunas" ||
    row.paymentStatus === "LUNAS" ||
    (projectInvoices.length > 0 &&
      projectInvoices.every((i: any) => i.status === "Lunas" || Number(i.terbayar) >= Number(i.total)));

  const revenueFromInvoices = projectInvoices.reduce((sum: number, i: any) => sum + Number(i.nilai || i.amount || 0), 0);
  const revenueFromQuote = Number(linkedQuotation?.totalAfterDisc || linkedQuotation?.nilai || 0);
  const revenue = revenueFromInvoices > 0 ? revenueFromInvoices : revenueFromQuote;
  const projectPos = (data["supplier-pos"] || []).filter(
    (po: any) => String(po.projectId) === String(row.id) && po.status !== "Ditolak" && po.status !== "DIBATALKAN"
  );
  const poCost = projectPos.reduce((sum: number, po: any) => sum + Number(po.total || 0), 0);
  const projectExpenses = useProjectExpenses(row.id, row.nama);
  const expenseCost = projectExpenses.reduce((sum: number, e: any) => sum + Number(e.nominal || 0), 0);
  const extraItemsCost = requirements
    .filter((r) => r.isExtra)
    .reduce((sum, r) => sum + r.neededQty * (r.costPrice || r.unitPrice || 0), 0);
  const contractItemsCost = requirements
    .filter((r) => !r.isExtra)
    .reduce((sum, r) => sum + r.neededQty * (r.costPrice || 0), 0);
  const totalCost = poCost > 0 ? (poCost + expenseCost + extraItemsCost) : (contractItemsCost + expenseCost + extraItemsCost);
  const netProfit = revenue - totalCost;
  const marginPct = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : "0.0";

  const mapRequirements = React.useCallback((res: any[]) => {
    return res.map((r: any) => {
      const needed = Number(r.neededQty ?? r.qty ?? 0);
      const reserved = Number(r.reservedQty ?? 0);
      const shortage = Number(r.shortageQty ?? Math.max(0, needed - reserved));
      const costPrice = Number(r.costPrice ?? r.product?.purchasePrice ?? 0);
      const matchedProd = (data.products || []).find((p: any) => String(p.id) === String(r.product?.id));
      const fallbackCost = Number(matchedProd?.hargaBeli ?? matchedProd?.purchasePrice ?? 0);
      const effectiveCost = costPrice > 0 ? costPrice : fallbackCost;
      let parsedSerials: string[] = [];
      if (r.serials) {
        try {
          const arr = JSON.parse(r.serials);
          if (Array.isArray(arr)) parsedSerials = arr.map(String);
        } catch {
          parsedSerials = String(r.serials)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        }
      }
      const desc = r.product?.description || "";
      const pphMatch = desc.match(/PPH:([^;]+)/);
      const sellMatch = desc.match(/SELL:([^;]+)/);

      const allQuoItems: any[] =
        Array.isArray(activeQuotation?.items) && activeQuotation.items.length > 0
          ? activeQuotation.items
          : Array.isArray(linkedQuotation?.items)
          ? linkedQuotation.items
          : [];

      const matchedQuoItem = allQuoItems.find((qi: any) => {
        if (qi.productId && r.product?.id && String(qi.productId) === String(r.product.id)) {
          return true;
        }
        if (
          qi.sku &&
          r.product?.sku &&
          String(qi.sku).trim().toLowerCase() === String(r.product.sku).trim().toLowerCase()
        ) {
          return true;
        }
        const cleanQi = String(qi.item || qi.name || qi.nama || "")
          .replace(/\s*\(SN:.*?\)/gi, "")
          .replace(/\s*\[SN:.*?\]/gi, "")
          .replace(/\s*\(SKU-.*?\)/gi, "")
          .replace(/\s*#\d+/g, "")
          .trim()
          .toLowerCase();
        const cleanProd = String(r.product?.name || r.produk || "").trim().toLowerCase();
        if (cleanQi && cleanProd) {
          if (cleanQi === cleanProd) return true;
          if (cleanQi.includes(cleanProd) || cleanProd.includes(cleanQi)) return true;
        }
        return false;
      });

      const isExtra = r.isExtra !== undefined ? Boolean(r.isExtra) : !matchedQuoItem;
      const sellingPrice = sellMatch ? Number(sellMatch[1]) : Number(matchedQuoItem?.harga || matchedQuoItem?.price || effectiveCost);
      const pphMode = pphMatch ? pphMatch[1] : (matchedQuoItem?.pphMode || "none");
      return {
        id: String(r.id),
        productId: r.product?.id != null ? String(r.product.id) : undefined,
        produk: r.product?.name ?? "Barang",
        sku: r.product?.sku ?? "",
        kategori: r.product?.category?.name ?? "",
        unit: r.product?.unit || "unit",
        pphMode,
        neededQty: needed,
        reservedQty: reserved,
        shortageQty: shortage,
        costPrice: effectiveCost,
        unitPrice: sellingPrice,
        isExtra,
        serials: parsedSerials,
        status:
          shortage > 0
            ? `Reserved ${reserved} · Kurang ${shortage} (Masuk PR Procurement)`
            : `Tersedia & Di-reserve (${reserved})`,
      };
    });
  }, [activeQuotation, linkedQuotation, data.products]);

  const loadRequirements = React.useCallback(async () => {
    try {
      const res = await api<any>("GET", `/projects/${row.id}/requirements`);
      const list = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
      setRequirements(mapRequirements(list));
    } catch {}
  }, [row.id, mapRequirements]);

  React.useEffect(() => {
    let active = true;
    api<any>("GET", `/projects/${row.id}/requirements`)
      .then((res) => {
        if (!active) return;
        const list = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
        setRequirements(mapRequirements(list));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [row.id, mapRequirements]);

  async function handleAddBoqFromPicker(pickedItems: any[]) {
    try {
      let count = 0;
      for (const it of pickedItems) {
        const prod = products.find(
          (p) =>
            (it.productId && String(p.id) === String(it.productId)) ||
            String(p.nama || "").toLowerCase() === String(it.item || "").toLowerCase(),
        );
        const q = Number(it.qty) || 1;
        const buyPrice = Number(prod?.hargaBeli ?? prod?.purchasePrice ?? it.harga ?? 0);
        const sellPrice = Number(it.price ?? it.harga ?? buyPrice);
        await api("POST", `/projects/${row.id}/requirements`, {
          productId: prod ? Number(prod.id) : (it.productId ? Number(it.productId) : undefined),
          name: !prod && !it.productId ? it.item : undefined,
          unit: it.unit || it.satuan || prod?.unit || "unit",
          costPrice: buyPrice,
          price: buyPrice,
          sellingPrice: sellPrice,
          qty: q,
          serials: Array.isArray(it.serialNumbers) && it.serialNumbers.length > 0 ? it.serialNumbers : undefined,
        });
        count++;
      }
      await loadRequirements();
      await reload();
      setPickerOpen(false);
      toast(`${count} item barang / SN berhasil dialokasikan ke BOQ Project!`);
    } catch (e: any) {
      toast(e?.message ?? "Gagal menambahkan item ke BOQ", "danger");
    }
  }

  async function handleAddCustomBoq() {
    if (!customBoqName.trim()) {
      toast("Nama item kustom wajib diisi", "danger");
      return;
    }
    const q = Math.max(1, Math.round(Number(customBoqQty) || 1));
    const costPriceNum = Number(customBoqCostPrice.replace(/\D/g, "")) || 0;
    const priceNum = Number(customBoqPrice.replace(/\D/g, "")) || costPriceNum;
    try {
      await api("POST", `/projects/${row.id}/requirements`, {
        name: customBoqName.trim(),
        unit: customBoqUnit.trim() || "pcs",
        costPrice: costPriceNum,
        price: costPriceNum,
        sellingPrice: priceNum,
        qty: q,
        pphMode: customBoqPphMode,
      });
      await loadRequirements();
      await reload();
      setCustomBoqName("");
      setCustomBoqCostPrice("");
      setCustomBoqPrice("");
      setCustomBoqQty("1");
      setCustomBoqPphMode("none");
      setCustomBoqOpen(false);
      toast(`Item BOQ kustom "${customBoqName}" x${q} berhasil ditambahkan ke Project`);
    } catch (e: any) {
      toast(e?.message ?? "Gagal menyimpan item kustom", "danger");
    }
  }

  async function handleSyncBoqFromQuotation() {
    const q = activeQuotation || linkedQuotation;
    if (!q) {
      toast("Belum ada penawaran yang terhubung ke project ini", "danger");
      return;
    }
    setIsSyncingBoq(true);
    try {
      const targetQId = Number(q.id);
      let res: any;
      if (targetQId) {
        res = await api<any>("POST", `/projects/${row.id}/sync-quotation`, { quotationId: targetQId }).catch(() => null);
      }
      if (!res || !res.imported) {
        // Fallback: sync manual items dari quotation bila API sync-quotation tidak mengembalikan hasil
        const itemsToSync: any[] = Array.isArray(q.items) ? q.items : [];
        for (const it of itemsToSync) {
          const prod = products.find(
            (p) =>
              (it.productId && String(p.id) === String(it.productId)) ||
              (it.sku && p.sku && String(p.sku).trim().toLowerCase() === String(it.sku).trim().toLowerCase()) ||
              String(p.nama || "").toLowerCase() === String(it.name || it.nama || it.item || "").replace(/\s*\(SN:.*$/i, "").trim().toLowerCase(),
          );
          if (!prod || prod.type === "JASA") continue;
          const sn = it.serialNumber || it.sn;
          await api("POST", `/projects/${row.id}/requirements`, {
            productId: Number(prod.id),
            qty: sn ? 1 : Math.max(1, Number(it.qty) || 1),
            serials: sn ? [String(sn)] : undefined,
            pphMode: it.pphMode,
          }).catch(() => {});
        }
      }
      await loadRequirements();
      await reload();
      toast(`BOQ dari Penawaran ${q.nomor || q.number || ""} berhasil disinkronkan ke Project`);
    } catch (e: any) {
      toast(e?.message ?? "Gagal menyinkronkan BOQ dari penawaran", "danger");
    } finally {
      setIsSyncingBoq(false);
    }
  }

  function openEditRequirement(m: any) {
    setEditingReq(m);
    setEditReqName(m.produk || "");
    setEditReqQty(String(m.neededQty || 1));
    setEditReqUnit(m.unit || "unit");
    setEditReqCostPrice(m.costPrice ? formatThousands(m.costPrice) : "");
    setEditReqPrice(m.unitPrice ? formatThousands(m.unitPrice) : "");
    setEditReqPphMode(m.pphMode || "none");
    setEditReqOpen(true);
  }

  async function handleSaveEditRequirement() {
    if (!editingReq) return;
    const q = Math.max(1, Math.round(Number(editReqQty) || 1));
    const costPriceNum = Number(String(editReqCostPrice).replace(/\D/g, "")) || 0;
    const priceNum = Number(String(editReqPrice).replace(/\D/g, "")) || costPriceNum;
    try {
      await api("PUT", `/projects/${row.id}/requirements/${editingReq.id}`, {
        name: editReqName.trim() || undefined,
        qty: q,
        unit: editReqUnit.trim() || "unit",
        costPrice: costPriceNum,
        price: costPriceNum,
        sellingPrice: priceNum,
        pphMode: editReqPphMode,
      });
      await loadRequirements();
      await reload();
      setEditReqOpen(false);
      setEditingReq(null);
      toast("Item BOQ berhasil diperbarui");
    } catch (e: any) {
      toast(e?.message ?? "Gagal memperbarui item BOQ", "danger");
    }
  }

  async function handleDeleteRequirement(m: any) {
    try {
      await api("DELETE", `/projects/${row.id}/requirements/${m.id}`);
      await loadRequirements();
      await reload();
      toast(`Item "${m.produk}" berhasil dihapus dari BOQ`);
    } catch (e: any) {
      toast(e?.message ?? "Gagal menghapus item BOQ", "danger");
    }
  }


  async function handleSaveEditService() {
    if (editingServiceIdx === null || !linkedQuotation) return;
    const qItems = [...(Array.isArray(linkedQuotation.items) ? linkedQuotation.items : [])];
    const targetService = quoServices[editingServiceIdx];
    if (!targetService) return;
    const realIdx = qItems.findIndex(
      (it) => it === targetService || (it.item === targetService.item && it.id === targetService.id)
    );
    if (realIdx === -1) return;

    const q = Math.max(1, Math.round(Number(editServiceQty) || 1));
    const priceNum = Number(String(editServicePrice).replace(/\D/g, "")) || 0;

    qItems[realIdx] = {
      ...qItems[realIdx],
      item: editServiceName.trim() || qItems[realIdx].item,
      name: editServiceName.trim() || qItems[realIdx].name,
      qty: q,
      unit: editServiceUnit.trim() || qItems[realIdx].unit || "Lot",
      satuan: editServiceUnit.trim() || qItems[realIdx].satuan || "Lot",
      price: priceNum,
      harga: priceNum,
      pphMode: editServicePphMode,
    };

    try {
      await patchRow("quotations", linkedQuotation.id, { items: qItems });
      await reload();
      setEditServiceOpen(false);
      setEditingServiceIdx(null);
      toast("Jasa BOQ berhasil diperbarui");
    } catch (e: any) {
      toast(e?.message ?? "Gagal memperbarui jasa BOQ", "danger");
    }
  }


  const prevBastOpenRef = React.useRef(false);
  React.useEffect(() => {
    if (bastOpen && !prevBastOpenRef.current) {
      const todayStr = new Date().toISOString().slice(0, 10);
      setBastNumber(`BAST-P${row.id}-${todayStr.replace(/-/g, "")}`);
      setBastDate(todayStr);
      setBastP1Company("PT GHINA MULTI PRIMA");
      setBastP1Name(row.pm || user?.name || "Project Manager");
      setBastP1Title("Project Manager");
      setBastP2Company(row.customer || "Customer");
      setBastP2Name(row.picClient || "Penanggung Jawab Proyek");
      setBastP2Title("Penanggung Jawab Proyek");
      setBastStatement(
        "Dengan ini kedua belah pihak menyatakan bahwa seluruh pekerjaan pengadaan, instalasi, dan integrasi perangkat untuk proyek di atas telah diselesaikan dengan baik, telah diuji coba secara bersama-sama, dan dinyatakan berfungsi normal sesuai spesifikasi teknis yang disepakati."
      );
      setBastNotes(
        "Garansi pemeliharaan dan perangkat berlaku sesuai ketentuan kontrak yang disepakati kedua belah pihak."
      );
      const initialItems = requirements.length > 0
        ? requirements.map((r) => ({
            name: r.produk || "Barang / Material",
            qty: Number(r.neededQty || 1),
            unit: r.unit || "unit",
          }))
        : [
            {
              name: `Pekerjaan ${row.nama || "Proyek"}`,
              qty: 1,
              unit: "Lot",
            },
          ];
      setBastItems(initialItems);
      setBastMode("generate");

      api<any>("GET", `/settings/project.bast.${row.id}`)
        .then((res) => {
          const val = res?.value;
          if (val) {
            if (val.party1Company) setBastP1Company(val.party1Company);
            if (val.party1Name) setBastP1Name(val.party1Name);
            if (val.party1Title) setBastP1Title(val.party1Title);
            if (val.logoFileId) setBastLogoFileId(Number(val.logoFileId));
          }
        })
        .catch(() => {});
    }
    prevBastOpenRef.current = bastOpen;
  }, [bastOpen]);

  async function handleGenerateBast() {
    setIsGeneratingBast(true);
    try {
      let logoFileId = bastLogoFileId;
      if (bastLogoUploaderRef.current?.hasStaged()) {
        try {
          const flushed = await bastLogoUploaderRef.current.flush();
          if (flushed) logoFileId = Number(flushed);
        } catch {}
      }

      const res = await api<any>("POST", `/projects/${row.id}/generate-bast`, {
        number: bastNumber.trim(),
        date: bastDate,
        party1Company: bastP1Company.trim() || "PT GHINA MULTI PRIMA",
        party1Name: bastP1Name.trim(),
        party1Title: bastP1Title.trim(),
        party2Company: bastP2Company.trim(),
        party2Name: bastP2Name.trim(),
        party2Title: bastP2Title.trim(),
        statement: bastStatement.trim(),
        items: bastItems.filter((it) => it.name.trim()).map((it) => ({
          name: it.name.trim(),
          qty: Math.max(1, Number(it.qty) || 1),
          unit: it.unit?.trim() || "unit",
        })),
        notes: bastNotes.trim(),
        logoFileId: logoFileId ? Number(logoFileId) : undefined,
      });
      if (res?.fileId) {
        toast("Dokumen BAST resmi berhasil dibuat & tersimpan di Tab Dokumen!");
        setBastOpen(false);
        if (typeof window !== "undefined") {
          window.open(`${apiBase()}/files/${res.fileId}`, "_blank");
        }
        await reload();
      }
    } catch (err: any) {
      toast(err?.message || "Gagal meng-generate BAST", "danger");
    } finally {
      setIsGeneratingBast(false);
    }
  }

  async function handleSaveManualBast() {
    setIsGeneratingBast(true);
    try {
      const fileId = await bastUploaderRef.current?.flush();
      if (!fileId) {
        toast("Silakan pilih/unggah file dokumen BAST terlebih dahulu", "danger");
        return;
      }
      await patchRow("projects", row.id, { bastFileId: fileId });
      toast("Dokumen BAST manual berhasil disimpan & terhubung ke Tab Dokumen!");
      setBastOpen(false);
      await reload();
    } catch (err: any) {
      toast(err?.message || "Gagal menyimpan dokumen BAST", "danger");
    } finally {
      setIsGeneratingBast(false);
    }
  }

  async function handlePrintBast() {
    const ok = await downloadDocumentationPdf("project", row.id);
    if (ok) {
      toast("PDF Laporan Dokumentasi Project berhasil diunduh");
      return;
    }
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  const qItems: any[] =
    Array.isArray(activeQuotation?.items) && activeQuotation.items.length > 0
      ? activeQuotation.items
      : Array.isArray(linkedQuotation?.items)
      ? linkedQuotation.items
      : [];
  const quoServices = qItems.filter(
    (it: any) => it.itemType === "CUSTOM" || (!it.productId && !it.serialNumber && !it.sn) || it.kind === "SERVICE"
  );

  const contractRequirements = React.useMemo(() => requirements.filter((m) => !m.isExtra), [requirements]);
  const extraRequirements = React.useMemo(() => requirements.filter((m) => m.isExtra), [requirements]);

  const boqTotalValue = React.useMemo(() => {
    const matVal = contractRequirements.reduce((acc, m) => acc + m.neededQty * (m.unitPrice || 0), 0);
    const svcVal = quoServices.reduce((acc, s) => acc + (Number(s.qty) || 1) * (Number(s.price || s.harga) || 0), 0);
    return matVal + svcVal;
  }, [contractRequirements, quoServices]);

  const extraTotalValue = React.useMemo(() => {
    return extraRequirements.reduce((acc, m) => acc + m.neededQty * (m.unitPrice || 0), 0);
  }, [extraRequirements]);

  // Sumber kebenaran: tahapan dari server (sama untuk semua role); fallback ke hitungan lokal.
  const st = (row as any).stages as
    | { boq: boolean; survey: boolean; penawaran: boolean; po: boolean; progress: boolean; invoice: boolean; bast: boolean; counts: Record<string, number> }
    | null
    | undefined;
  const flowSteps = [
    { key: "boq", label: "1. BOQ", done: st ? st.boq : !!row.boqFileId || requirements.length > 0 || quoServices.length > 0, sub: row.boqFileId ? "Dokumen BOQ terunggah" : `${st?.counts.requirements ?? requirements.length + quoServices.length} item` },
    { key: "survey", label: "2. Survey (Opsional)", done: st ? st.survey : linkedSurveys.length > 0, sub: (st?.counts.surveys ?? linkedSurveys.length) > 0 ? `${st?.counts.surveys ?? linkedSurveys.length} survey` : "Opsional" },
    { key: "penawaran", label: "3. Penawaran Project", done: st ? st.penawaran : !!linkedQuotation, sub: linkedQuotation?.nomor || (st?.penawaran ? "Tertaut" : "Belum ada") },
    { key: "po", label: "4. PO Project", done: st ? st.po : linkedClientPos.length > 0 || projectPos.length > 0, sub: `${st?.counts.clientPos ?? linkedClientPos.length} SO · ${st?.counts.supplierPos ?? projectPos.length} PO` },
    { key: "progress", label: "5. Progress Project", done: st ? st.progress : Number(row.progres || 0) > 0, sub: `${row.progres ?? 0}%` },
    { key: "invoice", label: "6. Invoice Project", done: st ? st.invoice : projectInvoices.length > 0, sub: `${st?.counts.invoices ?? projectInvoices.length} invoice` },
    { key: "bast", label: "7. Penyelesaian / BAST", done: st ? st.bast : row.status === "Selesai" || !!row.bastFileId, sub: row.status === "Selesai" ? "Selesai" : "Menunggu" },
  ];

  return (
    <>
      <Panel
        title="Alur Terpadu Project (End-to-End)"
        subtitle="Pantau kelengkapan 7 tahapan project mulai dari BOQ, Survey, Penawaran, PO, Progress, Invoice, hingga BAST"
      >
        <View className="flex-row flex-wrap gap-2">
          {flowSteps.map((st) => (
            <View
              key={st.key}
              className={`border rounded-xl px-2.5 py-2 sm:px-3 sm:py-2 flex-row items-center gap-2 flex-1 min-w-[140px] sm:flex-initial ${
                st.done ? "border-success/40 bg-success/10" : "border-border bg-panel/50"
              }`}
            >
              {st.done ? (
                <CheckCircle2 size={15} color={colors.success} className="shrink-0" />
              ) : (
                <Circle size={15} color={colors.muted} className="shrink-0" />
              )}
              <View className="flex-1 min-w-0">
                <Text className="text-xs font-semibold text-foreground">{st.label}</Text>
                <Text className="text-[11px] text-muted-foreground">{st.sub}</Text>
              </View>
            </View>
          ))}
        </View>
      </Panel>

      {/* 1. BOQ Kontrak Awal dari Penawaran Resmi (Read-Only) */}
      <Panel
        title="1. BOQ (Bill of Quantities) & Reservasi Material Project"
        subtitle="Daftar seluruh kebutuhan barang serta jasa instalasi dari penawaran resmi (Read-Only)."
        right={
          activeQuotation || linkedQuotation ? (
            <Button
              size="sm"
              variant="outline"
              onPress={handleSyncBoqFromQuotation}
              disabled={isSyncingBoq}
              className="flex-row items-center gap-1"
            >
              <RefreshCw size={13} color={colors.primary} />
              <Text className="text-xs text-primary font-semibold">
                {isSyncingBoq ? "Menyinkronkan..." : "Sinkron BOQ dari Penawaran"}
              </Text>
            </Button>
          ) : undefined
        }
      >
        <View className="gap-2">
          <DocumentViewerItem
            item={resolveModuleDocs("projects", "Dokumen BOQ (Excel / PDF)", row)}
            canUpload
            onUploadFile={async (fieldKey, fileId) => {
              await patchRow("projects", row.id, { [fieldKey]: fileId });
              toast("Dokumen BOQ berhasil diunggah");
            }}
          />
          {contractRequirements.length === 0 && quoServices.length === 0 ? (
            <Text className="text-muted-foreground text-xs py-2">
              Belum ada item BOQ kontrak untuk project ini. Klik &quot;Sinkron BOQ dari Penawaran&quot;.
            </Text>
          ) : (
            <>
              {contractRequirements.map((m) => (
                <Line
                  key={m.id}
                  left={m.produk}
                  sub={`${m.sku ? `SKU: ${m.sku} · ` : ""}${m.kategori ? `Kategori: ${m.kategori} · ` : ""}${m.pphMode && m.pphMode !== "none" ? `PPh: ${m.pphMode.toUpperCase()} · ` : ""}${m.status}`}
                  right={
                    <View className="items-end">
                      <Text className="font-semibold text-sm">{m.neededQty} {m.unit || "unit"}</Text>
                      {canViewBoqPricing && m.unitPrice > 0 ? (
                        <Text className="text-muted-foreground text-[11px]">{rupiah(m.neededQty * m.unitPrice)}</Text>
                      ) : null}
                    </View>
                  }
                />
              ))}
              {quoServices.map((sv: any, idx: number) => (
                <Line
                  key={`svc-${idx}`}
                  left={`${sv.name || sv.nama || sv.item || "Jasa Instalasi"} (Jasa / Pekerjaan)`}
                  sub={`Dari Penawaran ${linkedQuotation?.nomor || ""} · ${sv.qty || 1} ${sv.unit || sv.satuan || "Lot"}${sv.pphMode && sv.pphMode !== "none" ? ` · PPh: ${sv.pphMode.toUpperCase()}` : ""}`}
                  right={
                    <View className="items-end">
                      <Text className="font-semibold text-sm">{sv.qty || 1} {sv.unit || sv.satuan || "Lot"}</Text>
                      {canViewBoqPricing ? (
                        <Text className="text-muted-foreground text-[11px]">{rupiah((Number(sv.qty) || 1) * (Number(sv.price || sv.harga) || 0))}</Text>
                      ) : null}
                    </View>
                  }
                />
              ))}
              {canViewBoqPricing && boqTotalValue > 0 ? (
                <Line
                  left="Total Estimasi Nilai BOQ Kontrak Awal"
                  right={<Text className="text-sm font-bold text-primary">{rupiah(boqTotalValue)}</Text>}
                />
              ) : null}
            </>
          )}
        </View>
      </Panel>

      {/* 1.B Barang & Jasa Tambahan di Luar BOQ Awal */}
      <Panel
        title="Barang & Jasa Tambahan (Di Luar BOQ Awal)"
        subtitle="Daftar material, barang ritel, dan jasa tambahan yang diajukan di luar penawaran kontrak awal. Beban modal masuk ke P&L project."
        right={
          <Button
            size="sm"
            variant="default"
            onPress={() => setPickerOpen(true)}
            className="flex-row items-center gap-1 bg-primary"
          >
            <Package size={14} color="#fff" />
            <Text className="text-xs text-white font-medium">+ Pilih Stok & Jasa</Text>
          </Button>
        }
      >
        <View className="gap-2">
          {extraRequirements.length === 0 ? (
            <Text className="text-muted-foreground text-xs py-2">
              Belum ada barang atau jasa tambahan di luar BOQ awal untuk project ini.
            </Text>
          ) : (
            <>
              {extraRequirements.map((m) => (
                <Line
                  key={m.id}
                  left={`${m.produk} · Tambahan`}
                  sub={`${m.sku ? `SKU: ${m.sku} · ` : ""}${m.kategori ? `Kategori: ${m.kategori} · ` : ""}${m.pphMode && m.pphMode !== "none" ? `PPh: ${m.pphMode.toUpperCase()} · ` : ""}${m.status}`}
                  right={
                    <View className="flex-row items-center gap-3">
                      <View className="items-end">
                        <Text className="font-semibold text-sm">{m.neededQty} {m.unit || "unit"}</Text>
                        {canViewBoqPricing && (m.costPrice > 0 || m.unitPrice > 0) ? (
                          <Text className="text-muted-foreground text-[11px]">
                            {m.costPrice > 0 ? `Modal: ${rupiah(m.neededQty * m.costPrice)}` : rupiah(m.neededQty * m.unitPrice)}
                          </Text>
                        ) : null}
                      </View>
                      <View className="flex-row items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          onPress={() => openEditRequirement(m)}
                        >
                          <Edit2 size={13} color={colors.text} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          onPress={() => handleDeleteRequirement(m)}
                        >
                          <Trash2 size={13} color={colors.danger} />
                        </Button>
                      </View>
                    </View>
                  }
                />
              ))}
              {canViewBoqPricing && (extraTotalValue > 0 || extraItemsCost > 0) ? (
                <Line
                  left="Total Beban Modal Barang Tambahan"
                  right={<Text className="text-sm font-bold text-amber-600 dark:text-amber-400">{rupiah(extraItemsCost > 0 ? extraItemsCost : extraTotalValue)}</Text>}
                />
              ) : null}
            </>
          )}
        </View>
      </Panel>

      <Panel
        title="2–6. Dokumen Komersial Project (Survey, Penawaran, PO & Invoice Project)"
        subtitle="Integrasi dokumen komersial project dalam satu tampilan terpadu"
        right={
          canViewFinancials ? (
            <Button size="sm" onPress={() => setCreateInvOpen(true)} className="flex-row items-center gap-1 bg-primary">
              <Plus size={13} color={colors.background} />
              <Text className="text-xs text-primary-foreground font-semibold">Buat Invoice Project</Text>
            </Button>
          ) : undefined
        }
      >
        <Line
          left="Survey Lokasi (Opsional)"
          sub={
            linkedSurveys.length > 0
              ? linkedSurveys.map((s: Row) => `${s.lokasi || s.lead} (${s.status})`).join(", ")
              : "Tidak ada / belum ada survey lokasi untuk project ini"
          }
          right={
            linkedSurveys[0] ? (
              <Button size="sm" variant="outline" onPress={() => router.push(`/surveys/${linkedSurveys[0]!.id}` as any)}>
                <ExternalLink size={12} color={colors.text} />
                <Text className="text-xs">Buka Survey</Text>
              </Button>
            ) : (
              <StatusBadge status="Opsional" />
            )
          }
        />

        <Line
          left="Penawaran Project (Quotation)"
          sub={
            linkedQuotation
              ? `${linkedQuotation.nomor} · Nilai: ${rupiah(linkedQuotation.totalAfterDisc || linkedQuotation.nilai || 0)} (${linkedQuotation.status})`
              : "Belum ada penawaran yang ditautkan"
          }
          right={
            linkedQuotation ? (
              <Button size="sm" variant="outline" onPress={() => router.push(`/quotations/${linkedQuotation.id}` as any)}>
                <ExternalLink size={12} color={colors.text} />
                <Text className="text-xs">Buka Penawaran</Text>
              </Button>
            ) : (
              <Button size="sm" variant="outline" onPress={() => router.push("/quotations" as any)}>
                <Text className="text-xs">Lihat Penawaran</Text>
              </Button>
            )
          }
        />

        <Line
          left="PO Project — Sales Order / PO Client"
          sub={
            linkedClientPos.length > 0
              ? linkedClientPos.map((po: Row) => `${po.nomor} (${rupiah(po.nilai)})`).join(", ")
              : "Belum ada PO Client tercatat"
          }
          right={
            linkedClientPos[0] ? (
              <View className="flex-row items-center gap-1.5">
                <Button size="sm" variant="outline" onPress={() => router.push(`/po-client/${linkedClientPos[0]!.id}` as any)}>
                  <ExternalLink size={12} color={colors.text} />
                  <Text className="text-xs">Buka SO / PO Client</Text>
                </Button>
                <Button size="sm" variant="outline" onPress={() => setRecordClientPoOpen(true)}>
                  <Plus size={12} color={colors.text} />
                  <Text className="text-xs">Catat PO</Text>
                </Button>
              </View>
            ) : (
              <Button size="sm" variant="outline" onPress={() => setRecordClientPoOpen(true)}>
                <Text className="text-xs">Catat PO Client</Text>
              </Button>
            )
          }
        />

        <Line
          left="PO Project — Pengadaan ke Supplier"
          sub={
            projectPos.length > 0
              ? projectPos.map((po: Row) => `${po.nomor} · ${po.supplier} (${po.status})`).join(", ")
              : "Belum ada PO Supplier untuk project ini"
          }
          right={
            projectPos[0] ? (
              <Button size="sm" variant="outline" onPress={() => router.push(`/supplier-pos/${projectPos[0]!.id}` as any)}>
                <ExternalLink size={12} color={colors.text} />
                <Text className="text-xs">Buka PO Supplier</Text>
              </Button>
            ) : (
              <StatusBadge status="0 PO Supplier" />
            )
          }
        />

        <View className="mt-2 pt-2 border-t border-border/60 gap-1">
          <Text className="text-xs font-semibold text-foreground mb-1">
            Daftar Invoice Project ({projectInvoices.length})
          </Text>
          {projectInvoices.length === 0 ? (
            <Text className="text-muted-foreground text-xs">Belum ada invoice yang diterbitkan untuk project ini.</Text>
          ) : (
            projectInvoices.map((inv: any) => (
              <Line
                key={inv.id}
                left={`${inv.nomor} (${inv.jenis})`}
                sub={`Total ${rupiah(inv.total)} · Terbayar ${rupiah(inv.terbayar)}`}
                right={
                  <View className="flex-row items-center gap-2">
                    <Cell fmt="status" value={inv.status} />
                    <Button size="sm" variant="outline" onPress={() => router.push(`/invoices/${inv.id}` as any)}>
                      <Text className="text-xs">Buka</Text>
                    </Button>
                  </View>
                }
              />
            ))
          )}
        </View>
      </Panel>

      <DocumentationPhotosPanel
        kind="project"
        entityId={row.id}
        title="Dokumentasi Foto Instalasi & Progress Project"
        subtitle="Galeri foto pemasangan perangkat di lapangan yang terkompilasi ke laporan PDF."
      />

      <Panel
        title="Berita Acara Serah Terima (BAST)"
        subtitle="Dokumen legal serah terima pekerjaan selesai kepada klien."
        right={
          <Button size="sm" variant="outline" onPress={() => setBastOpen(true)} className="flex-row items-center gap-1.5">
            <Printer size={14} color={colors.text} />
            <Text className="text-xs">Generate Draf BAST</Text>
          </Button>
        }
      >
        <Line left="Status Pekerjaan Fisik" right={<StatusBadge status={row.status || "Berjalan"} />} />
        <Line left="Status Pembayaran Termin" right={<StatusBadge status={isAllInvoicesPaid ? "Lunas" : row.pembayaran || "Belum lunas"} />} />
        <Text className="text-xs text-muted-foreground mt-2 leading-relaxed">
          Setelah seluruh item pekerjaan diuji coba dan disetujui klien, cetak draf BAST resmi untuk ditandatangani kedua belah pihak.
        </Text>
      </Panel>

      {canViewFinancials ? (
        <Panel
          title="Analisa Untung-Rugi (P&L Project)"
          subtitle="Ringkasan margin laba bersih proyek berdasarkan realisasi tagihan dan pengeluaran beban riil"
          right={
            <Button
              size="sm"
              onPress={() =>
                router.push({
                  pathname: "/expenses/new",
                  params: { projectId: String(row.id), project: String(row.nama) },
                } as any)
              }
              className="gap-1.5"
            >
              <Plus size={14} color={colors.background} />
              <Text className="text-xs font-semibold">+ Catat Biaya Project</Text>
            </Button>
          }
        >
          <View className="gap-4">
            <View className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <View className="p-3 rounded-lg bg-card/60 border border-border">
                <Text className="text-xs text-muted-foreground">Pendapatan (DPP Invoice)</Text>
                <Text className="text-base font-bold mt-1 text-foreground">{rupiah(revenue)}</Text>
                <Text className="text-[10px] text-muted-foreground mt-0.5">{projectInvoices.length} invoice terbit</Text>
              </View>
              <View className="p-3 rounded-lg bg-card/60 border border-border">
                <Text className="text-xs text-muted-foreground">Beban PO Supplier</Text>
                <Text className="text-base font-bold mt-1 text-danger">{rupiah(poCost)}</Text>
                <Text className="text-[10px] text-muted-foreground mt-0.5">{projectPos.length} purchase order</Text>
              </View>
              <View className="p-3 rounded-lg bg-card/60 border border-border">
                <Text className="text-xs text-muted-foreground">Beban Tambahan (Di Luar BOQ)</Text>
                <Text className="text-base font-bold mt-1 text-rose-500">{rupiah(extraItemsCost)}</Text>
                <Text className="text-[10px] text-muted-foreground mt-0.5">{extraRequirements.length} item tambahan</Text>
              </View>
              <View className="p-3 rounded-lg bg-card/60 border border-border">
                <Text className="text-xs text-muted-foreground">Biaya Operasional & Reimburse</Text>
                <Text className="text-base font-bold mt-1 text-amber-500">{rupiah(expenseCost)}</Text>
                <Text className="text-[10px] text-muted-foreground mt-0.5">{projectExpenses.length} transaksi</Text>
              </View>
              <View className="p-3 rounded-lg bg-card/60 border border-border">
                <Text className="text-xs text-muted-foreground">Laba Bersih ({marginPct}%)</Text>
                <Text className={`text-base font-bold mt-1 ${netProfit >= 0 ? "text-success" : "text-danger"}`}>
                  {rupiah(netProfit)}
                </Text>
                <Text className="text-[10px] text-muted-foreground mt-0.5">Total Beban: {rupiah(totalCost)}</Text>
              </View>
            </View>

            {/* Rincian Material & Jasa Tambahan di Luar BOQ */}
            <View className="gap-2 pt-2 border-t border-border mt-1">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-semibold text-foreground">
                  Rincian Material & Jasa Tambahan di Luar BOQ ({extraRequirements.length} item)
                </Text>
                {extraItemsCost > 0 ? (
                  <Text className="text-xs font-bold text-rose-500">
                    Total Beban: {rupiah(extraItemsCost)}
                  </Text>
                ) : null}
              </View>
              {extraRequirements.length === 0 ? (
                <Text className="text-xs text-muted-foreground py-2">
                  Belum ada barang atau jasa tambahan di luar BOQ untuk project ini.
                </Text>
              ) : (
                <View className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                  {extraRequirements.map((it) => {
                    const itemExpense = it.neededQty * (it.costPrice || it.unitPrice || 0);
                    return (
                      <View key={it.id} className="p-3 flex-row items-center justify-between bg-card/30">
                        <View className="flex-1 pr-2">
                          <View className="flex-row items-center gap-2 flex-wrap">
                            <Text className="text-sm font-semibold text-foreground">
                              {it.produk}
                            </Text>
                            <View className="bg-amber-500/15 border border-amber-500/30 rounded px-1.5 py-0.5">
                              <Text className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                Di Luar BOQ Awal
                              </Text>
                            </View>
                          </View>
                          <Text className="text-xs text-muted-foreground mt-1">
                            {it.neededQty} {it.unit || "unit"} {it.costPrice > 0 ? `• Modal: ${rupiah(it.costPrice)} / ${it.unit || "unit"}` : ""}
                            {it.sku ? ` • SKU: ${it.sku}` : ""}
                          </Text>
                        </View>
                        <Text className="text-sm font-bold text-rose-500">
                          {rupiah(itemExpense)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Rincian Operasional & Reimbursement */}
            <View className="gap-2 pt-2 border-t border-border mt-1">
              <Text className="text-xs font-semibold text-foreground">
                Rincian Biaya Operasional & Reimbursement ({projectExpenses.length} pengeluaran)
              </Text>
              {projectExpenses.length === 0 ? (
                <Text className="text-xs text-muted-foreground py-2">
                  Belum ada pengeluaran operasional yang dicatat untuk project ini.
                </Text>
              ) : (
                <View className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                  {projectExpenses.map((exp: Row) => {
                    const isTalangan = exp.fundingSource === "TALANGAN_PRIBADI" || exp.sumberDana?.includes("Talangan");
                    return (
                      <View key={exp.id} className="p-3 flex-row items-center justify-between bg-card/30">
                        <View className="flex-1 pr-2">
                          <View className="flex-row items-center gap-2 flex-wrap">
                            <Text className="text-sm font-semibold text-foreground">
                              {exp.alasan || exp.description || exp.kategori}
                            </Text>
                            <StatusBadge status={exp.status} />
                            <View
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                isTalangan
                                  ? "bg-amber-500/15 text-amber-500"
                                  : "bg-blue-500/15 text-blue-500"
                              }`}
                            >
                              <Text className="text-[10px]">
                                {isTalangan ? "Talangan Pribadi" : "Dana Kantor"}
                              </Text>
                            </View>
                          </View>
                          <Text className="text-xs text-muted-foreground mt-1">
                            {tanggal(exp.tanggal || exp.date)} • Pelapor: {exp.pelapor || "Teknisi"} • Kategori: {exp.kategori || "-"}
                          </Text>
                        </View>
                        <Text className="text-sm font-bold text-foreground">{rupiah(exp.nominal || exp.amount || 0)}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        </Panel>
      ) : null}

      {/* Modal Pilih Stok & SN / Jasa (SerialItemPickerModal sama dengan Penawaran & Invoice) */}
      <SerialItemPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentProjectId={row.id}
        currentQuotationId={linkedQuotation?.id}
        allowedInvoiceIds={projectInvoices.map((i: any) => String(i.id || i.nomor))}
        onAddItems={handleAddBoqFromPicker}
      />

      {/* Modal Tambah Item Kustom BOQ (Non-Inventory) */}
      <Dialog open={customBoqOpen} onOpenChange={setCustomBoqOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Item BOQ Kustom (Non-Inventory)</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <View className="gap-1">
              <Text className="text-xs text-muted-foreground font-medium">Nama Item Kustom (Bebas)</Text>
              <Input
                value={customBoqName}
                onChangeText={setCustomBoqName}
                placeholder="Contoh: Pipa PVC pelindung kabel 20mm"
              />
            </View>

            <View className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <View className="gap-1">
                <Text className="text-xs text-muted-foreground font-medium">Harga Modal / Beli (Rp)</Text>
                <Input
                  value={customBoqCostPrice ? formatThousands(customBoqCostPrice) : ""}
                  onChangeText={(v) => setCustomBoqCostPrice(formatThousands(v))}
                  keyboardType="numeric"
                  placeholder="Contoh: 15.000"
                />
              </View>
              <View className="gap-1">
                <Text className="text-xs text-muted-foreground font-medium">Harga Jual ke Klien (Rp)</Text>
                <Input
                  value={customBoqPrice ? formatThousands(customBoqPrice) : ""}
                  onChangeText={(v) => setCustomBoqPrice(formatThousands(v))}
                  keyboardType="numeric"
                  placeholder="Contoh: 25.000"
                />
              </View>
            </View>

            <View className="flex-row gap-2">
              <View className="flex-1 gap-1">
                <Text className="text-xs text-muted-foreground font-medium">Jumlah yang Dibutuhkan (Qty)</Text>
                <Input
                  value={customBoqQty}
                  onChangeText={setCustomBoqQty}
                  placeholder="1"
                  keyboardType="numeric"
                />
              </View>
              <View className="w-28 gap-1">
                <Text className="text-xs text-muted-foreground font-medium">Satuan</Text>
                <Input
                  value={customBoqUnit}
                  onChangeText={setCustomBoqUnit}
                  placeholder="pcs / batang"
                />
              </View>
            </View>

            <View className="gap-1.5 pt-1">
              <Text className="text-xs text-muted-foreground font-medium">Tarif Pajak PPh Item</Text>
              <View className="flex-row items-center gap-1.5 flex-wrap">
                {PPH_OPTIONS.map((opt) => {
                  const active = customBoqPphMode === opt.id;
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => setCustomBoqPphMode(opt.id)}
                      className={`px-2 py-1 rounded-md border ${
                        active ? "bg-primary/10 border-primary" : "bg-muted/40 border-border/60"
                      }`}
                    >
                      <Text className={`text-xs ${active ? "text-primary font-bold" : "text-muted-foreground"}`}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setCustomBoqOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleAddCustomBoq}>
              <Text>Simpan ke BOQ</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Edit Item BOQ Requirement */}
      <Dialog open={editReqOpen} onOpenChange={setEditReqOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Item BOQ Material</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <View className="gap-1">
              <Text className="text-xs text-muted-foreground font-medium">Nama Item</Text>
              <Input
                value={editReqName}
                onChangeText={setEditReqName}
                placeholder="Nama item / perangkat"
              />
            </View>

            <View className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <View className="gap-1">
                <Text className="text-xs text-muted-foreground font-medium">Harga Modal / Beli (Rp)</Text>
                <Input
                  value={editReqCostPrice ? formatThousands(editReqCostPrice) : ""}
                  onChangeText={(v) => setEditReqCostPrice(formatThousands(v))}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </View>
              <View className="gap-1">
                <Text className="text-xs text-muted-foreground font-medium">Harga Jual ke Klien (Rp)</Text>
                <Input
                  value={editReqPrice ? formatThousands(editReqPrice) : ""}
                  onChangeText={(v) => setEditReqPrice(formatThousands(v))}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </View>
            </View>

            <View className="flex-row gap-2">
              <View className="flex-1 gap-1">
                <Text className="text-xs text-muted-foreground font-medium">Jumlah yang Dibutuhkan (Qty)</Text>
                <Input
                  value={editReqQty}
                  onChangeText={setEditReqQty}
                  placeholder="1"
                  keyboardType="numeric"
                />
              </View>
              <View className="w-28 gap-1">
                <Text className="text-xs text-muted-foreground font-medium">Satuan</Text>
                <Input
                  value={editReqUnit}
                  onChangeText={setEditReqUnit}
                  placeholder="unit / pcs"
                />
              </View>
            </View>

            <View className="gap-1.5 pt-1">
              <Text className="text-xs text-muted-foreground font-medium">Tarif Pajak PPh Item</Text>
              <View className="flex-row items-center gap-1.5 flex-wrap">
                {PPH_OPTIONS.map((opt) => {
                  const active = editReqPphMode === opt.id;
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => setEditReqPphMode(opt.id)}
                      className={`px-2 py-1 rounded-md border ${
                        active ? "bg-primary/10 border-primary" : "bg-muted/40 border-border/60"
                      }`}
                    >
                      <Text className={`text-xs ${active ? "text-primary font-bold" : "text-muted-foreground"}`}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setEditReqOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSaveEditRequirement}>
              <Text>Simpan Perubahan</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Edit Item BOQ Jasa */}
      <Dialog open={editServiceOpen} onOpenChange={setEditServiceOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Jasa / Pekerjaan BOQ</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <View className="gap-1">
              <Text className="text-xs text-muted-foreground font-medium">Deskripsi Jasa / Pekerjaan</Text>
              <Input
                value={editServiceName}
                onChangeText={setEditServiceName}
                placeholder="Contoh: Jasa Instalasi & Setting CCTV"
              />
            </View>

            <View className="flex-row gap-2">
              <View className="flex-1 gap-1">
                <Text className="text-xs text-muted-foreground font-medium">Harga / Biaya Jasa (Rp)</Text>
                <Input
                  value={editServicePrice ? formatThousands(editServicePrice) : ""}
                  onChangeText={(v) => setEditServicePrice(formatThousands(v))}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </View>
              <View className="w-24 gap-1">
                <Text className="text-xs text-muted-foreground font-medium">Satuan</Text>
                <Input
                  value={editServiceUnit}
                  onChangeText={setEditServiceUnit}
                  placeholder="Lot / Titik"
                />
              </View>
            </View>

            <View className="gap-1">
              <Text className="text-xs text-muted-foreground font-medium">Qty</Text>
              <Input
                value={editServiceQty}
                onChangeText={setEditServiceQty}
                placeholder="1"
                keyboardType="numeric"
              />
            </View>

            <View className="gap-1.5 pt-1">
              <Text className="text-xs text-muted-foreground font-medium">Tarif Pajak PPh Jasa</Text>
              <View className="flex-row items-center gap-1.5 flex-wrap">
                {PPH_OPTIONS.map((opt) => {
                  const active = editServicePphMode === opt.id;
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => setEditServicePphMode(opt.id)}
                      className={`px-2 py-1 rounded-md border ${
                        active ? "bg-primary/10 border-primary" : "bg-muted/40 border-border/60"
                      }`}
                    >
                      <Text className={`text-xs ${active ? "text-primary font-bold" : "text-muted-foreground"}`}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setEditServiceOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSaveEditService}>
              <Text>Simpan Perubahan</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Buat & Edit Draf BAST / Upload Manual */}
      <Dialog open={bastOpen} onOpenChange={setBastOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[92vh]">
          <DialogHeader>
            <DialogTitle>Berita Acara Serah Terima (BAST)</DialogTitle>
          </DialogHeader>

          {/* Tab Pilihan: Buat Draf (Edit Isi) vs Upload Manual */}
          <View className="flex-row p-1 bg-muted/40 rounded-lg gap-1">
            <Button
              size="sm"
              variant={bastMode === "generate" ? "default" : "ghost"}
              className="flex-1 h-8"
              onPress={() => setBastMode("generate")}
            >
              <FileText size={13} className="mr-1.5" />
              <Text className="text-xs font-semibold">Buat Draf BAST (Edit Isi)</Text>
            </Button>
            <Button
              size="sm"
              variant={bastMode === "upload" ? "default" : "ghost"}
              className="flex-1 h-8"
              onPress={() => setBastMode("upload")}
            >
              <Upload size={13} className="mr-1.5" />
              <Text className="text-xs font-semibold">Upload File Manual</Text>
            </Button>
          </View>

          {bastMode === "generate" ? (
            <ScrollView className="py-2 gap-4 max-h-[68vh]">
              {/* Form Pengaturan Dokumen BAST */}
              <View className="bg-card border border-border rounded-xl p-3.5 gap-3">
                <Text className="font-semibold text-xs text-foreground">Data & Konfigurasi Dokumen BAST</Text>
                
                <View className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <View className="gap-1">
                    <Text className="text-[11px] text-muted-foreground font-medium">Nomor Dokumen BAST</Text>
                    <Input
                      value={bastNumber}
                      onChangeText={setBastNumber}
                      placeholder="Contoh: BAST/2026/11/001"
                      className="h-8 text-xs"
                    />
                  </View>
                  <View className="gap-1">
                    <Text className="text-[11px] text-muted-foreground font-medium">Tanggal Dokumen (YYYY-MM-DD)</Text>
                    <Input
                      value={bastDate}
                      onChangeText={setBastDate}
                      placeholder="2026-11-03"
                      className="h-8 text-xs"
                    />
                  </View>
                </View>

                {/* Pihak Pertama (Penyedia) & Logo Header */}
                <View className="space-y-2 pt-1 border-t border-border/60">
                  <View className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    <View className="gap-1">
                      <Text className="text-[11px] text-muted-foreground font-medium">Nama Perusahaan Kita (Header)</Text>
                      <Input
                        value={bastP1Company}
                        onChangeText={setBastP1Company}
                        placeholder="PT GHINA MULTI PRIMA"
                        className="h-8 text-xs"
                      />
                    </View>
                    <View className="gap-1">
                      <Text className="text-[11px] text-muted-foreground font-medium">PIC Pihak Pertama</Text>
                      <Input
                        value={bastP1Name}
                        onChangeText={setBastP1Name}
                        placeholder="Nama Project Manager"
                        className="h-8 text-xs"
                      />
                    </View>
                    <View className="gap-1">
                      <Text className="text-[11px] text-muted-foreground font-medium">Jabatan Pihak Pertama</Text>
                      <Input
                        value={bastP1Title}
                        onChangeText={setBastP1Title}
                        placeholder="Project Manager"
                        className="h-8 text-xs"
                      />
                    </View>
                  </View>

                  <View className="gap-1.5 pt-1">
                    <Text className="text-[11px] text-muted-foreground font-medium">Logo Perusahaan (Kiri Header BAST)</Text>
                    {bastLogoFileId ? (
                      <View className="flex-row items-center gap-3 p-2 bg-muted/40 rounded-lg border border-border">
                        <Image
                          source={{ uri: `${apiBase()}/files/${bastLogoFileId}` }}
                          style={{ width: 64, height: 40 }}
                          resizeMode="contain"
                        />
                        <View className="flex-1">
                          <Text className="text-xs font-medium">Logo Perusahaan Aktif</Text>
                          <Text className="text-[10px] text-muted-foreground">ID File: {bastLogoFileId}</Text>
                        </View>
                        <Button
                          size="sm"
                          variant="ghost"
                          onPress={() => setBastLogoFileId(null)}
                          className="h-7 px-2"
                        >
                          <Trash2 size={13} color={colors.danger} />
                          <Text className="text-xs text-destructive ml-1">Hapus</Text>
                        </Button>
                      </View>
                    ) : null}
                    <FileUploader
                      label={bastLogoFileId ? "Ganti Logo Perusahaan (PNG/JPG)" : "Unggah Logo Perusahaan (PNG/JPG)"}
                      kind="foto"
                      category="bast-logo"
                      handleRef={(h) => {
                        bastLogoUploaderRef.current = h;
                      }}
                      onUploaded={(fId) => {
                        if (fId) setBastLogoFileId(Number(fId));
                      }}
                    />
                  </View>
                </View>

                {/* Pihak Kedua (Klien) */}
                <View className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1 border-t border-border/60">
                  <View className="gap-1">
                    <Text className="text-[11px] text-muted-foreground font-medium">Nama Perusahaan Klien</Text>
                    <Input
                      value={bastP2Company}
                      onChangeText={setBastP2Company}
                      placeholder="Nama Klien"
                      className="h-8 text-xs"
                    />
                  </View>
                  <View className="gap-1">
                    <Text className="text-[11px] text-muted-foreground font-medium">Nama PIC Klien</Text>
                    <Input
                      value={bastP2Name}
                      onChangeText={setBastP2Name}
                      placeholder="Nama Penanggung Jawab"
                      className="h-8 text-xs"
                    />
                  </View>
                  <View className="gap-1">
                    <Text className="text-[11px] text-muted-foreground font-medium">Jabatan PIC Klien</Text>
                    <Input
                      value={bastP2Title}
                      onChangeText={setBastP2Title}
                      placeholder="Penanggung Jawab Proyek"
                      className="h-8 text-xs"
                    />
                  </View>
                </View>

                {/* Pernyataan Serah Terima */}
                <View className="gap-1 pt-1 border-t border-border/60">
                  <Text className="text-[11px] text-muted-foreground font-medium">Isi Pernyataan Serah Terima</Text>
                  <Input
                    value={bastStatement}
                    onChangeText={setBastStatement}
                    multiline
                    numberOfLines={3}
                    placeholder="Teks pernyataan serah terima..."
                    className="text-xs min-h-[64px]"
                  />
                </View>

                {/* Rincian Material & Pekerjaan */}
                <View className="gap-2 pt-1 border-t border-border/60">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[11px] text-muted-foreground font-medium">Daftar Barang & Pekerjaan BAST ({bastItems.length} Item)</Text>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2"
                      onPress={() => setBastItems((prev) => [...prev, { name: "", qty: 1, unit: "unit" }])}
                    >
                      <Plus size={12} color={colors.text} className="mr-1" />
                      <Text className="text-[11px]">+ Tambah Item</Text>
                    </Button>
                  </View>

                  {bastItems.map((item, idx) => (
                    <View key={idx} className="flex-row items-center gap-1.5">
                      <View className="flex-1">
                        <Input
                          value={item.name}
                          onChangeText={(v) => {
                            setBastItems((prev) => prev.map((it, i) => (i === idx ? { ...it, name: v } : it)));
                          }}
                          placeholder="Nama barang / lingkup pekerjaan..."
                          className="h-8 text-xs"
                        />
                      </View>
                      <View className="w-16">
                        <Input
                          value={item.qty === 0 ? "" : String(item.qty)}
                          onChangeText={(v) => {
                            const val = v.replace(/[^0-9]/g, "");
                            setBastItems((prev) => prev.map((it, i) => (i === idx ? { ...it, qty: val === "" ? 0 : Number(val) } : it)));
                          }}
                          keyboardType="numeric"
                          placeholder="Qty"
                          className="h-8 text-xs text-center"
                        />
                      </View>
                      <View className="w-20">
                        <Input
                          value={item.unit}
                          onChangeText={(v) => {
                            setBastItems((prev) => prev.map((it, i) => (i === idx ? { ...it, unit: v } : it)));
                          }}
                          placeholder="Satuan"
                          className="h-8 text-xs text-center"
                        />
                      </View>
                      {bastItems.length > 1 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onPress={() => setBastItems((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          <Trash2 size={13} color={colors.danger} />
                        </Button>
                      )}
                    </View>
                  ))}
                </View>

                {/* Catatan / Garansi */}
                <View className="gap-1 pt-1 border-t border-border/60">
                  <Text className="text-[11px] text-muted-foreground font-medium">Catatan Tambahan / Klausul Garansi</Text>
                  <Input
                    value={bastNotes}
                    onChangeText={setBastNotes}
                    placeholder="Ketentuan garansi atau pemeliharaan..."
                    className="h-8 text-xs"
                  />
                </View>
              </View>

              {/* Preview Format Surat BAST */}
              <View className="bg-panel border-border/80 rounded-xl border p-4 gap-2">
                <Text className="font-bold text-sm tracking-wide text-center">PT GHINA MULTI PRIMA</Text>
                <Text className="text-xs text-muted-foreground text-center">BERITA ACARA SERAH TERIMA PEKERJAAN (BAST)</Text>
                <View className="border-border border-t pt-2 gap-1 mt-1">
                  <Text className="text-xs font-semibold">Nomor: {bastNumber || "-"}</Text>
                  <Text className="text-xs font-semibold">Nama Proyek: {row.nama}</Text>
                  <Text className="text-xs text-muted-foreground">Pihak Pertama (Penyedia): PT Ghina Multi Prima ({bastP1Name || "-"})</Text>
                  <Text className="text-xs text-muted-foreground">Pihak Kedua (Klien): {bastP2Company || "-"} ({bastP2Name || "-"})</Text>
                  <Text className="text-xs text-muted-foreground">Tanggal: {bastDate || "-"}</Text>
                </View>

                <View className="border-border border rounded-lg p-2.5 my-1">
                  <Text className="text-xs leading-relaxed text-muted-foreground">{bastStatement || "-"}</Text>
                </View>

                <View className="border-border border-t pt-4 flex-row justify-between">
                  <View className="items-center w-40">
                    <Text className="text-[11px] text-muted-foreground">Pihak Pertama</Text>
                    <View className="h-12" />
                    <Text className="text-xs font-semibold">{bastP1Name || "Project Manager"}</Text>
                    <Text className="text-[10px] text-muted-foreground">{bastP1Title || "PT Ghina Multi Prima"}</Text>
                  </View>
                  <View className="items-center w-40">
                    <Text className="text-[11px] text-muted-foreground">Pihak Kedua</Text>
                    <View className="h-12" />
                    <Text className="text-xs font-semibold">{bastP2Name || "Penanggung Jawab"}</Text>
                    <Text className="text-[10px] text-muted-foreground">{bastP2Title || bastP2Company}</Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          ) : (
            <View className="py-4 gap-3">
              <Text className="text-xs text-muted-foreground leading-relaxed">
                Lampirkan file dokumen BAST yang sudah ditandatangani basah / hasil scan (PDF, DOCX, JPG, PNG). File akan otomatis terpasang di Tab Dokumen bagian BAST.
              </Text>
              <FileUploader
                label="Unggah File Dokumen BAST Resmi (PDF, DOCX, JPG, PNG)"
                kind="dokumen"
                handleRef={(h) => {
                  bastUploaderRef.current = h;
                }}
              />
            </View>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onPress={() => setBastOpen(false)} disabled={isGeneratingBast}>
              <Text>Tutup</Text>
            </Button>
            {bastMode === "generate" ? (
              <Button
                onPress={handleGenerateBast}
                disabled={isGeneratingBast}
                className="flex-row items-center gap-1.5"
              >
                <Printer size={14} color={colors.background} />
                <Text>{isGeneratingBast ? "Menyimpan & Generate..." : "Simpan & Generate Dokumen BAST"}</Text>
              </Button>
            ) : (
              <Button
                onPress={handleSaveManualBast}
                disabled={isGeneratingBast}
                className="flex-row items-center gap-1.5"
              >
                <Check size={14} color={colors.background} />
                <Text>{isGeneratingBast ? "Menyimpan..." : "Simpan File BAST Manual"}</Text>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CreateInvoiceDialog open={createInvOpen} onOpenChange={setCreateInvOpen} />
      <RecordClientPoDialog
        open={recordClientPoOpen}
        onOpenChange={setRecordClientPoOpen}
        project={row}
        activeQuotation={activeQuotation}
        requirements={requirements}
      />
    </>
  );
}
