import * as React from "react";
import { View, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Printer, Plus, Check, CheckCircle2, Circle, ExternalLink, RefreshCw, Package, Edit2, Trash2 } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Panel, Cell } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { CreateInvoiceDialog } from "@/modules/invoice/create-invoice-dialog";
import { SerialItemPickerModal } from "@/components/taska/serial-item-picker";
import { useApp } from "@/store/app-store";
import { api, downloadDocumentationPdf } from "@/services/api";
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
  const [customBoqPrice, setCustomBoqPrice] = React.useState("");
  const [customBoqUnit, setCustomBoqUnit] = React.useState("pcs");
  const [customBoqQty, setCustomBoqQty] = React.useState("1");
  const [customBoqPphMode, setCustomBoqPphMode] = React.useState("none");
  const [bastOpen, setBastOpen] = React.useState(false);
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
      unitPrice: number;
      unit?: string;
      pphMode?: string;
      status: string;
      serials?: string[];
    }[]
  >([]);

  // Edit BOQ Requirement state
  const [editReqOpen, setEditReqOpen] = React.useState(false);
  const [editingReq, setEditingReq] = React.useState<any>(null);
  const [editReqName, setEditReqName] = React.useState("");
  const [editReqQty, setEditReqQty] = React.useState("1");
  const [editReqUnit, setEditReqUnit] = React.useState("unit");
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
  const canViewFinancials = ["super_admin", "superadmin", "bos", "finance", "pm", "sales", "admin"].includes(normalizedRole);
  const linkedQuotation = React.useMemo(() => {
    const cleanQuoNum = String(row.penawaran || "").split(" - ")[0]?.trim().toLowerCase();
    return (data.quotations ?? []).find(
      (q: Row) =>
        (row.quotationId && String(q.id) === String(row.quotationId)) ||
        (cleanQuoNum && cleanQuoNum !== "-" && String(q.nomor || "").toLowerCase() === cleanQuoNum),
    );
  }, [data.quotations, row.quotationId, row.penawaran]);

  const linkedSurveys = React.useMemo(() => {
    return (data.surveys ?? []).filter(
      (s: Row) =>
        (row.leadId && String(s.leadId) === String(row.leadId)) ||
        (linkedQuotation?.leadId && String(s.leadId) === String(linkedQuotation.leadId)) ||
        (row.customer && row.customer !== "-" && s.customer === row.customer),
    );
  }, [data.surveys, row.leadId, row.customer, linkedQuotation]);

  const linkedClientPos = React.useMemo(() => {
    return (data["po-client"] ?? []).filter(
      (po: Row) =>
        (linkedQuotation && String(po.quotationId) === String(linkedQuotation.id)) ||
        (linkedQuotation && String(po.penawaran || "").toLowerCase().includes(String(linkedQuotation.nomor || "").toLowerCase())) ||
        (row.customer && row.customer !== "-" && po.customer === row.customer),
    );
  }, [data, linkedQuotation, row.customer]);

  const projectInvoices = (data.invoices || []).filter(
    (i: any) =>
      i.direction !== "in" &&
      i.status !== "Batal" &&
      (String(i.projectId) === String(row.id) ||
        (i.project && i.project === row.nama) ||
        (linkedQuotation && String(i.quotationId) === String(linkedQuotation.id))),
  );
  const revenue = projectInvoices.reduce((sum: number, i: any) => sum + Number(i.nilai || i.amount || 0), 0);
  const projectPos = (data["supplier-pos"] || []).filter(
    (po: any) => String(po.projectId) === String(row.id) && po.status !== "Ditolak" && po.status !== "DIBATALKAN"
  );
  const poCost = projectPos.reduce((sum: number, po: any) => sum + Number(po.total || 0), 0);
  const projectExpenses = useProjectExpenses(row.id, row.nama);
  const expenseCost = projectExpenses.reduce((sum: number, e: any) => sum + Number(e.nominal || 0), 0);
  const totalCost = poCost + expenseCost;
  const netProfit = revenue - totalCost;
  const marginPct = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : "0.0";

  const mapRequirements = React.useCallback((res: any[]) => {
    return res.map((r: any) => {
      const needed = Number(r.neededQty ?? r.qty ?? 0);
      const reserved = Number(r.reservedQty ?? 0);
      const shortage = Number(r.shortageQty ?? Math.max(0, needed - reserved));
      const unitPrice = Number(r.product?.purchasePrice ?? 0);
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
      const snNote = parsedSerials.length > 0 ? ` · SN: ${parsedSerials.join(", ")}` : "";
      const desc = r.product?.description || "";
      const pphMatch = desc.match(/^PPH:(.+)$/);
      const matchedQuoItem = Array.isArray(linkedQuotation?.items)
        ? linkedQuotation.items.find((qi: any) =>
            (qi.productId && String(qi.productId) === String(r.product?.id)) ||
            String(qi.item || qi.name || "").toLowerCase() === String(r.product?.name || "").toLowerCase()
          )
        : null;
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
        unitPrice,
        serials: parsedSerials,
        status:
          (shortage > 0
            ? `Reserved ${reserved} · Kurang ${shortage} (Masuk PR Procurement)`
            : `Tersedia & Di-reserve (${reserved})`) + snNote,
      };
    });
  }, [linkedQuotation]);

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
        const priceNum = Number(it.price ?? it.harga ?? prod?.purchasePrice ?? 0);
        await api("POST", `/projects/${row.id}/requirements`, {
          productId: prod ? Number(prod.id) : (it.productId ? Number(it.productId) : undefined),
          name: !prod && !it.productId ? it.item : undefined,
          unit: it.unit || it.satuan || prod?.unit || "unit",
          price: priceNum,
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
    const priceNum = Number(customBoqPrice.replace(/\D/g, "")) || 0;
    try {
      await api("POST", `/projects/${row.id}/requirements`, {
        name: customBoqName.trim(),
        unit: customBoqUnit.trim() || "pcs",
        price: priceNum,
        qty: q,
        pphMode: customBoqPphMode,
      });
      await loadRequirements();
      await reload();
      setCustomBoqName("");
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
    if (!linkedQuotation) {
      toast("Belum ada penawaran yang terhubung ke project ini", "danger");
      return;
    }
    const qItems: any[] = Array.isArray(linkedQuotation.items) ? linkedQuotation.items : [];
    if (qItems.length === 0) {
      toast("Penawaran terkait belum memiliki rincian item BOQ", "danger");
      return;
    }
    setIsSyncingBoq(true);
    try {
      let addedCount = 0;
      for (const it of qItems) {
        const prod = products.find(
          (p) =>
            (it.productId && String(p.id) === String(it.productId)) ||
            String(p.nama || "").toLowerCase() === String(it.name || it.nama || "").toLowerCase(),
        );
        if (!prod || prod.type === "JASA") continue;
        const sn = it.serialNumber || it.sn;
        await api("POST", `/projects/${row.id}/requirements`, {
          productId: Number(prod.id),
          qty: sn ? 1 : Math.max(1, Number(it.qty) || 1),
          serials: sn ? [String(sn)] : undefined,
          pphMode: it.pphMode,
        });
        addedCount++;
      }
      await loadRequirements();
      await reload();
      toast(
        addedCount > 0
          ? `${addedCount} item BOQ dari Penawaran ${linkedQuotation.nomor} berhasil disinkronkan ke Project`
          : "Tidak ada item barang fisik baru untuk disinkronkan",
      );
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
    setEditReqPrice(m.unitPrice ? formatThousands(m.unitPrice) : "");
    setEditReqPphMode(m.pphMode || "none");
    setEditReqOpen(true);
  }

  async function handleSaveEditRequirement() {
    if (!editingReq) return;
    const q = Math.max(1, Math.round(Number(editReqQty) || 1));
    const priceNum = Number(String(editReqPrice).replace(/\D/g, "")) || 0;
    try {
      await api("PUT", `/projects/${row.id}/requirements/${editingReq.id}`, {
        name: editReqName.trim() || undefined,
        qty: q,
        unit: editReqUnit.trim() || "unit",
        price: priceNum,
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

  function openEditService(sv: any, idx: number) {
    setEditingServiceIdx(idx);
    setEditServiceName(sv.name || sv.nama || sv.item || "Jasa Instalasi");
    setEditServiceQty(String(sv.qty || 1));
    setEditServiceUnit(sv.unit || sv.satuan || "Lot");
    setEditServicePrice(sv.price || sv.harga ? formatThousands(sv.price || sv.harga) : "");
    setEditServicePphMode(sv.pphMode || "none");
    setEditServiceOpen(true);
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

  async function handleDeleteService(idx: number) {
    if (!linkedQuotation) return;
    const qItems = [...(Array.isArray(linkedQuotation.items) ? linkedQuotation.items : [])];
    const targetService = quoServices[idx];
    if (!targetService) return;
    const realIdx = qItems.findIndex(
      (it) => it === targetService || (it.item === targetService.item && it.id === targetService.id)
    );
    if (realIdx === -1) return;

    qItems.splice(realIdx, 1);
    try {
      await patchRow("quotations", linkedQuotation.id, { items: qItems });
      await reload();
      toast("Jasa BOQ berhasil dihapus");
    } catch (e: any) {
      toast(e?.message ?? "Gagal menghapus jasa BOQ", "danger");
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

  const qItems: any[] = Array.isArray(linkedQuotation?.items) ? linkedQuotation.items : [];
  const quoServices = qItems.filter(
    (it: any) => it.itemType === "CUSTOM" || (!it.productId && !it.serialNumber && !it.sn)
  );

  const boqTotalValue = React.useMemo(() => {
    const matVal = requirements.reduce((acc, m) => acc + m.neededQty * (m.unitPrice || 0), 0);
    const svcVal = quoServices.reduce((acc, s) => acc + (Number(s.qty) || 1) * (Number(s.price) || 0), 0);
    return matVal + svcVal;
  }, [requirements, quoServices]);

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

      <Panel
        title="1. BOQ (Bill of Quantities) & Reservasi Material Project"
        subtitle="Daftar seluruh kebutuhan barang (Ber-SN & Non-SN) serta jasa instalasi project. Stok yang tersedia otomatis di-reserve dan kekurangan masuk ke PR Procurement."
        right={
          <View className="flex-row flex-wrap items-center gap-1.5">
            {linkedQuotation ? (
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
            ) : null}
            <Button size="sm" variant="outline" onPress={() => setCustomBoqOpen(true)} className="flex-row items-center gap-1">
              <Plus size={14} color={colors.text} />
              <Text className="text-xs">+ Item Kustom</Text>
            </Button>
            <Button size="sm" variant="default" onPress={() => setPickerOpen(true)} className="flex-row items-center gap-1 bg-primary">
              <Package size={14} color="#fff" />
              <Text className="text-xs text-white font-medium">+ Pilih Stok & SN / Jasa</Text>
            </Button>
          </View>
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
          {requirements.length === 0 && quoServices.length === 0 ? (
            <Text className="text-muted-foreground text-xs py-2">
              Belum ada item BOQ untuk project ini. Klik &quot;Tambah Item BOQ&quot; atau &quot;Sinkron BOQ dari Penawaran&quot;.
            </Text>
          ) : (
            <>
              {requirements.map((m) => (
                <Line
                  key={m.id}
                  left={m.produk}
                  sub={`${m.sku ? `SKU: ${m.sku} · ` : ""}${m.kategori ? `Kategori: ${m.kategori} · ` : ""}${m.pphMode && m.pphMode !== "none" ? `PPh: ${m.pphMode.toUpperCase()} · ` : ""}${m.status}`}
                  right={
                    <View className="flex-row items-center gap-3">
                      <View className="items-end">
                        <Text className="font-semibold text-sm">{m.neededQty} {m.unit || "unit"}</Text>
                        {m.unitPrice > 0 ? (
                          <Text className="text-muted-foreground text-[11px]">{rupiah(m.neededQty * m.unitPrice)}</Text>
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
              {quoServices.map((sv: any, idx: number) => (
                <Line
                  key={`svc-${idx}`}
                  left={`${sv.name || sv.nama || sv.item || "Jasa Instalasi"} (Jasa / Pekerjaan)`}
                  sub={`Dari Penawaran ${linkedQuotation?.nomor || ""} · ${sv.qty || 1} ${sv.unit || sv.satuan || "Lot"}${sv.pphMode && sv.pphMode !== "none" ? ` · PPh: ${sv.pphMode.toUpperCase()}` : ""}`}
                  right={
                    <View className="flex-row items-center gap-3">
                      <View className="items-end">
                        <Text className="font-semibold text-sm">{rupiah((Number(sv.qty) || 1) * (Number(sv.price || sv.harga) || 0))}</Text>
                      </View>
                      <View className="flex-row items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          onPress={() => openEditService(sv, idx)}
                        >
                          <Edit2 size={13} color={colors.text} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          onPress={() => handleDeleteService(idx)}
                        >
                          <Trash2 size={13} color={colors.danger} />
                        </Button>
                      </View>
                    </View>
                  }
                />
              ))}
              {boqTotalValue > 0 ? (
                <Line
                  left="Total Estimasi Nilai BOQ (Material + Jasa)"
                  right={<Text className="text-sm font-bold text-primary">{rupiah(boqTotalValue)}</Text>}
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
              <Button size="sm" variant="outline" onPress={() => router.push(`/po-client/${linkedClientPos[0]!.id}` as any)}>
                <ExternalLink size={12} color={colors.text} />
                <Text className="text-xs">Buka SO / PO Client</Text>
              </Button>
            ) : (
              <Button size="sm" variant="outline" onPress={() => router.push("/po-client" as any)}>
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
        <Line left="Status Pembayaran Termin" right={<StatusBadge status={row.pembayaran || "Belum lunas"} />} />
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
            <View className="grid grid-cols-2 md:grid-cols-4 gap-3">
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

            <View className="flex-row gap-2">
              <View className="flex-1 gap-1">
                <Text className="text-xs text-muted-foreground font-medium">Estimasi Harga Satuan (Rp)</Text>
                <Input
                  value={customBoqPrice ? formatThousands(customBoqPrice) : ""}
                  onChangeText={(v) => setCustomBoqPrice(formatThousands(v))}
                  keyboardType="numeric"
                  placeholder="Contoh: 25.000"
                />
              </View>
              <View className="w-24 gap-1">
                <Text className="text-xs text-muted-foreground font-medium">Satuan</Text>
                <Input
                  value={customBoqUnit}
                  onChangeText={setCustomBoqUnit}
                  placeholder="pcs / batang"
                />
              </View>
            </View>

            <View className="gap-1">
              <Text className="text-xs text-muted-foreground font-medium">Jumlah yang Dibutuhkan (Qty)</Text>
              <Input
                value={customBoqQty}
                onChangeText={setCustomBoqQty}
                placeholder="1"
                keyboardType="numeric"
              />
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

            <View className="flex-row gap-2">
              <View className="flex-1 gap-1">
                <Text className="text-xs text-muted-foreground font-medium">Estimasi Harga Satuan (Rp)</Text>
                <Input
                  value={editReqPrice ? formatThousands(editReqPrice) : ""}
                  onChangeText={(v) => setEditReqPrice(formatThousands(v))}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </View>
              <View className="w-24 gap-1">
                <Text className="text-xs text-muted-foreground font-medium">Satuan</Text>
                <Input
                  value={editReqUnit}
                  onChangeText={setEditReqUnit}
                  placeholder="unit / pcs"
                />
              </View>
            </View>

            <View className="gap-1">
              <Text className="text-xs text-muted-foreground font-medium">Jumlah yang Dibutuhkan (Qty)</Text>
              <Input
                value={editReqQty}
                onChangeText={setEditReqQty}
                placeholder="1"
                keyboardType="numeric"
              />
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

      {/* Modal Preview & Cetak BAST */}
      <Dialog open={bastOpen} onOpenChange={setBastOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Berita Acara Serah Terima (BAST)</DialogTitle>
          </DialogHeader>
          <ScrollView className="py-2 gap-4">
            <View className="bg-panel border-border/80 rounded-xl border p-4 gap-2">
              <Text className="font-bold text-sm tracking-wide">PT GHINA MULTI PRIMA</Text>
              <Text className="text-xs text-muted-foreground">BERITA ACARA SERAH TERIMA PEKERJAAN (BAST)</Text>
              <View className="border-border border-t pt-2 gap-1 mt-1">
                <Text className="text-xs font-semibold">Nama Proyek: {row.nama}</Text>
                <Text className="text-xs text-muted-foreground">Pihak Pertama (Penyedia): PT Ghina Multi Prima</Text>
                <Text className="text-xs text-muted-foreground">Pihak Kedua (Klien): {row.customer}</Text>
                <Text className="text-xs text-muted-foreground">Project Manager: {row.pm}</Text>
                <Text className="text-xs text-muted-foreground">Tanggal: {new Date().toISOString().slice(0, 10)}</Text>
              </View>
            </View>

            <View className="border-border border rounded-xl p-3 gap-1.5">
              <Text className="text-xs font-semibold">Pernyataan Serah Terima:</Text>
              <Text className="text-xs leading-relaxed text-muted-foreground">
                Dengan ini kedua belah pihak menyatakan bahwa pekerjaan pengadaan, instalasi, dan integrasi perangkat untuk proyek di atas telah diselesaikan dengan baik, telah diuji coba secara bersama-sama, dan dinyatakan berfungsi normal sesuai spesifikasi teknis yang disepakati.
              </Text>
            </View>

            <View className="border-border border rounded-xl p-3 gap-2">
              <Text className="text-xs font-semibold">Rincian Material Project:</Text>
              {requirements.map((m, idx) => (
                <Text key={m.id} className="text-xs text-muted-foreground">{idx + 1}. {m.produk} — {m.neededQty} unit</Text>
              ))}
            </View>

            <View className="border-border border-t pt-4 flex-row justify-between">
              <View className="items-center w-40">
                <Text className="text-[11px] text-muted-foreground">Pihak Pertama</Text>
                <View className="h-14" />
                <Text className="text-xs font-semibold">{row.pm || "Project Manager"}</Text>
                <Text className="text-[10px] text-muted-foreground">PT Ghina Multi Prima</Text>
              </View>
              <View className="items-center w-40">
                <Text className="text-[11px] text-muted-foreground">Pihak Kedua</Text>
                <View className="h-14" />
                <Text className="text-xs font-semibold">{row.customer}</Text>
                <Text className="text-[10px] text-muted-foreground">Penanggung Jawab Proyek</Text>
              </View>
            </View>
          </ScrollView>
          <DialogFooter>
            <Button variant="outline" onPress={() => setBastOpen(false)}>
              <Text>Tutup</Text>
            </Button>
            <Button onPress={handlePrintBast} className="flex-row items-center gap-1.5">
              <Printer size={14} color={colors.background} />
              <Text>Cetak / Simpan BAST</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CreateInvoiceDialog open={createInvOpen} onOpenChange={setCreateInvOpen} />
    </>
  );
}
