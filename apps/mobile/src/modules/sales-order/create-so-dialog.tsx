import * as React from "react";
import { View, ScrollView, Pressable } from "react-native";
import {
  Plus,
  Trash2,
  Package,
  ShoppingCart,
  FileText,
  FileCheck,
  Building2,
  User,
  Sparkles,
  ArrowRight,
  Receipt,
  Layers,
} from "lucide-react-native";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/taska/basics";
import { SearchableSelect, DatePicker, QuickAddCustomerDialog, formatThousands } from "@/components/taska/dialogs";
import { FileUploader, type FileUploaderHandle } from "@/components/taska/file-uploader";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { rupiah } from "@/lib/format";
import { PPH_MODE_OPTIONS, calcItemPph, pphModeToTipe, pphRateFor, type PphMode, getInitialPpnMode } from "@/modules/quotation/lib";
import { getKasBankAccounts } from "@/lib/accounting";
import type { Row } from "@/constants/modules";

export interface SoItemEntry {
  id: string;
  productId?: string;
  name: string;
  sku?: string;
  unit: string;
  hasSerial: boolean;
  categoryId?: string;
  categoryName?: string;
  qty: number;
  price: number;
  itemType?: "JASA" | "BARANG";
  isNonInventory?: boolean;
  pphMode?: PphMode;
  tipePph?: string;
  isNewItem?: boolean;
}

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDefaultEtaIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().slice(0, 10);
}

export function CreateSalesOrderDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <CreateSalesOrderForm onClose={() => onOpenChange(false)} onSuccess={onSuccess} />
    </Dialog>
  );
}

function CreateSalesOrderForm({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { data, addRow, reload, toast, pushHistory, refreshModule } = useApp();

  // Document fields
  const [nomorSo, setNomorSo] = React.useState<string>("");
  const [suggestedSoNumber, setSuggestedSoNumber] = React.useState<string>("");
  const [nomorPoClient, setNomorPoClient] = React.useState<string>("");
  const [customerId, setCustomerId] = React.useState<string>("");
  const [customerName, setCustomerName] = React.useState<string>("");
  const [quickCustomerOpen, setQuickCustomerOpen] = React.useState<boolean>(false);

  const [quotationId, setQuotationId] = React.useState<string>("");
  const [quotationLabel, setQuotationLabel] = React.useState<string>("");
  const [projectId, setProjectId] = React.useState<string>("");

  const [tanggal, setTanggal] = React.useState<string>(getTodayIso);
  const [eta, setEta] = React.useState<string>(getDefaultEtaIso);
  const [paymentFlow, setPaymentFlow] = React.useState<"REGULER" | "WALK_IN">("REGULER");

  // Items
  const [items, setItems] = React.useState<SoItemEntry[]>([]);
  const [itemMode, setItemMode] = React.useState<"master" | "custom">("master");

  // Master product inputs
  const [selectedProductId, setSelectedProductId] = React.useState<string>("");
  const [masterQty, setMasterQty] = React.useState<string>("1");
  const [masterPrice, setMasterPrice] = React.useState<string>("");
  const [masterPphMode, setMasterPphMode] = React.useState<PphMode>("none");

  // Custom / non-master product inputs
  const [newNonInvType, setNewNonInvType] = React.useState<"JASA" | "NON_STOK">("JASA");
  const [newName, setNewName] = React.useState<string>("");
  const [newUnit, setNewUnit] = React.useState<string>("paket");
  const [newQty, setNewQty] = React.useState<string>("1");
  const [newPrice, setNewPrice] = React.useState<string>("");
  const [newHasSerial, setNewHasSerial] = React.useState<boolean>(false);
  const [newPphMode, setNewPphMode] = React.useState<PphMode>("pph23");

  // Walk-in payment inputs
  const [walkinCoaAccount, setWalkinCoaAccount] = React.useState<string>("1000.01");
  const [walkinPayMethod, setWalkinPayMethod] = React.useState<"TRANSFER" | "TUNAI">("TUNAI");
  const walkinFileHandleRef = React.useRef<FileUploaderHandle | null>(null);

  // Tax Scheme: Non PPN, PPN 11% Exclude, PPN Included
  const [ppnMode, setPpnMode] = React.useState<"none" | "exclude" | "include">("exclude");

  // Additional Notes & Attachments
  const [catatan, setCatatan] = React.useState<string>("");
  const fileHandleRef = React.useRef<FileUploaderHandle | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

  // Fetch suggested SO number
  React.useEffect(() => {
    let isMounted = true;
    void (async () => {
      try {
        const res = await api<{ number?: string }>("GET", "/client-po/suggest-number");
        if (res?.number && isMounted) {
          setSuggestedSoNumber(res.number);
        }
      } catch {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const seq = String((data["po-client"]?.length || 0) + 1).padStart(3, "0");
        if (isMounted) {
          setSuggestedSoNumber(`SO/${yyyy}/${mm}/${seq}`);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [data["po-client"]]);

  // Customer options
  const customerOptions = React.useMemo(() => {
    return (data.customers ?? []).map((c: Row) => ({
      id: String(c.id),
      name: c.nama || c.name || `Customer #${c.id}`,
    }));
  }, [data.customers]);

  // Quotation options
  const quotationOptions = React.useMemo(() => {
    return (data.quotations ?? []).map((q: Row) => ({
      id: String(q.id),
      number: q.nomor || q.number || `QUO #${q.id}`,
      customer: q.customer || "-",
      amount: Number(q.totalAfterDisc || q.total || q.nilai || 0),
      raw: q,
      label: `${q.nomor || q.number} — ${q.customer || "-"} (${rupiah(Number(q.totalAfterDisc || q.total || q.nilai || 0))})`,
    }));
  }, [data.quotations]);

  const stockSummary: any[] = React.useMemo(() => data.stockSummary ?? [], [data.stockSummary]);
  const serialsList: any[] = React.useMemo(() => data.serials ?? [], [data.serials]);

  const getProductStock = React.useCallback(
    (product: any): number => {
      if (!product) return 0;
      if (product.type === "JASA" || product.jenisItem === "Jasa") return 0;
      if (product.berSN || product.hasSerial) {
        return serialsList.filter(
          (s: any) =>
            (String(s.productId) === String(product.id) || s.produk === product.nama || s.produk === product.name) &&
            (s.rawStatus === "DI_GUDANG" || s.rawStatus === "RESERVED" || s.status === "Di gudang" || s.status === "Reserved"),
        ).length;
      }
      const sum = stockSummary
        .filter((s: any) => String(s.productId) === String(product.id))
        .reduce((acc: number, cur: any) => acc + Number(cur.saldo ?? cur.qty ?? cur.stok ?? 0), 0);
      if (sum > 0) return sum;
      return Number(product.stok ?? product.stock ?? product.tersedia ?? 0);
    },
    [serialsList, stockSummary]
  );

  // Project options
  const projectOptions = React.useMemo(() => {
    return (data.projects ?? []).map((p: Row) => ({
      id: String(p.id),
      name: p.nama || p.name,
      label: `${p.nama || p.name} — ${p.customer || "-"}`,
    }));
  }, [data.projects]);

  // Selected master product
  const selectedProductObj = React.useMemo(() => {
    if (!selectedProductId) return null;
    return (data.products ?? []).find((p: Row) => String(p.id) === String(selectedProductId)) || null;
  }, [data.products, selectedProductId]);

  // Handle master product selected
  function handleSelectMasterProduct(prodId: string) {
    setSelectedProductId(prodId);
    const prod = (data.products ?? []).find((p: Row) => String(p.id) === String(prodId));
    if (prod) {
      const defaultSell = Number(prod.hargaJual ?? prod.price ?? 0);
      if (defaultSell > 0) {
        setMasterPrice(formatThousands(defaultSell));
      } else {
        const defaultCost = Number(prod.hargaBeli ?? prod.purchasePrice ?? 0);
        setMasterPrice(defaultCost > 0 ? formatThousands(Math.round(defaultCost * 1.25)) : "");
      }
    }
  }

  // Handle quotation selected
  async function handleSelectQuotation(label: string) {
    setQuotationLabel(label);
    const match = quotationOptions.find((q) => q.label === label || q.number === label);
    if (!match) {
      setQuotationId("");
      return;
    }

    setQuotationId(match.id);

    // Auto-fill customer if available
    if (match.customer && match.customer !== "-") {
      setCustomerName(match.customer);
      const custObj = (data.customers ?? []).find(
        (c: Row) => (c.nama || c.name || "").trim().toLowerCase() === match.customer.trim().toLowerCase()
      );
      if (custObj) {
        setCustomerId(String(custObj.id));
      }
    }

    // Auto-match project if any
    const projMatch = (data.projects ?? []).find(
      (p: Row) => p.quotationId === match.id || p.lead === match.raw.lead
    );
    if (projMatch) {
      setProjectId(String(projMatch.id));
    }

    // Try to load items from quotation
    try {
      let qItems: any[] = [];
      if (Array.isArray(match.raw.items) && match.raw.items.length > 0) {
        qItems = match.raw.items;
      } else {
        const fullQ = await api<any>("GET", `/quotations/${match.id}`).catch(() => null);
        if (fullQ && Array.isArray(fullQ.items) && fullQ.items.length > 0) {
          qItems = fullQ.items;
        }
      }

      if (qItems.length > 0) {
        const mappedItems: SoItemEntry[] = qItems.map((qi: any, idx: number) => {
          const p = Number(qi.harga || qi.price || qi.hargaJual || 0);
          const q = Number(qi.qty || 1);
          return {
            id: `q-item-${match.id}-${idx}-${Date.now()}`,
            productId: qi.productId ? String(qi.productId) : undefined,
            name: qi.nama || qi.name || qi.deskripsi || "Barang",
            sku: qi.sku || undefined,
            unit: qi.satuan || qi.unit || "unit",
            hasSerial: Boolean(qi.berSN || qi.hasSerial),
            qty: q,
            price: p,
            pphMode: qi.pphMode || "none",
            tipePph: qi.tipePph || pphModeToTipe(qi.pphMode || "none"),
            isNewItem: false,
          };
        });
        setItems(mappedItems);
        toast(`Berhasil memuat ${mappedItems.length} item dari penawaran ${match.number}`);
      } else if (match.amount > 0 && items.length === 0) {
        // Fallback: create 1 summary line if no detailed items
        setItems([
          {
            id: `q-summary-${Date.now()}`,
            name: `Pekerjaan sesuai Penawaran ${match.number}`,
            unit: "paket",
            hasSerial: false,
            qty: 1,
            price: match.amount,
            isNewItem: false,
          },
        ]);
      }

      // Check PPN mode from quotation
      const qTipe = String(match.raw.tipePpn || "").toLowerCase();
      if (qTipe.includes("no") || match.raw.ppnMode === "none") {
        setPpnMode("none");
      } else if (qTipe.includes("include") || match.raw.ppnMode === "include") {
        setPpnMode("include");
      } else {
        setPpnMode("exclude");
      }
    } catch {
      // Ignore background quotation item fetch failure
    }
  }

  // Add item from master
  function handleAddFromMaster() {
    if (!selectedProductObj) {
      toast("Pilih barang dari master produk terlebih dahulu", "danger");
      return;
    }
    const q = Number(String(masterQty).replace(/\D/g, "")) || 0;
    if (q <= 0) {
      toast("Jumlah kuantitas (Qty) harus lebih dari 0", "danger");
      return;
    }
    const p = Number(String(masterPrice).replace(/\D/g, "")) || 0;

    const newItem: SoItemEntry = {
      id: `item-${Date.now()}-${Math.random()}`,
      productId: String(selectedProductObj.id),
      name: selectedProductObj.nama || selectedProductObj.name || "Barang",
      sku: selectedProductObj.sku || undefined,
      unit: selectedProductObj.satuan || selectedProductObj.unit || "unit",
      hasSerial: Boolean(selectedProductObj.berSN ?? selectedProductObj.hasSerial),
      categoryId: selectedProductObj.categoryId ? String(selectedProductObj.categoryId) : undefined,
      categoryName: selectedProductObj.kategori || undefined,
      qty: q,
      price: p,
      pphMode: masterPphMode,
      tipePph: pphModeToTipe(masterPphMode),
      isNewItem: false,
    };

    setItems((prev) => [...prev, newItem]);
    setSelectedProductId("");
    setMasterQty("1");
    setMasterPrice("");
    setMasterPphMode("none");
  }

  // Add custom / manual item
  function handleAddCustomItem() {
    const trimmedName = newName.trim();
    if (!trimmedName) {
      toast("Nama barang / jasa wajib diisi", "danger");
      return;
    }
    const q = Number(String(newQty).replace(/\D/g, "")) || 0;
    if (q <= 0) {
      toast("Jumlah kuantitas (Qty) harus lebih dari 0", "danger");
      return;
    }
    const p = Number(String(newPrice).replace(/\D/g, "")) || 0;

    const isJasa = newNonInvType === "JASA";
    const displayName = isJasa && !/^\[JASA\]/i.test(trimmedName) ? `[JASA] ${trimmedName}` : trimmedName;

    const newItem: SoItemEntry = {
      id: `custom-${Date.now()}-${Math.random()}`,
      name: displayName,
      unit: newUnit.trim() || (isJasa ? "paket" : "unit"),
      hasSerial: isJasa ? false : newHasSerial,
      qty: q,
      price: p,
      itemType: isJasa ? "JASA" : "BARANG",
      isNonInventory: true,
      pphMode: isJasa ? newPphMode : "none",
      tipePph: isJasa ? pphModeToTipe(newPphMode) : "Tanpa PPh",
      isNewItem: true,
    };

    setItems((prev) => [...prev, newItem]);
    setNewName("");
    setNewUnit(isJasa ? "paket" : "unit");
    setNewQty("1");
    setNewPrice("");
    setNewHasSerial(false);
  }

  function handleRemoveItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  // Calculations
  const subtotalDpp = React.useMemo(() => {
    return items.reduce((sum, item) => sum + item.qty * item.price, 0);
  }, [items]);

  const totalPph = React.useMemo(() => {
    return items.reduce((sum, item) => sum + calcItemPph(item), 0);
  }, [items]);

  const ppnAmount = React.useMemo(() => {
    if (ppnMode === "none") return 0;
    if (ppnMode === "include") return Math.max(0, subtotalDpp - Math.round(subtotalDpp / 1.11));
    return Math.round(subtotalDpp * 0.11);
  }, [subtotalDpp, ppnMode]);

  const grandTotal = React.useMemo(() => {
    const base = ppnMode === "exclude" ? subtotalDpp + ppnAmount : subtotalDpp;
    return Math.max(0, base - totalPph);
  }, [subtotalDpp, ppnAmount, ppnMode, totalPph]);

  // Submit SO
  async function handleSubmit() {
    if (items.length === 0) {
      toast("Tambahkan minimal 1 barang / jasa ke daftar Sales Order", "danger");
      return;
    }
    if (grandTotal <= 0) {
      toast("Total nilai SO harus lebih dari Rp 0", "danger");
      return;
    }

    setIsSubmitting(true);
    try {
      let uploadedFileId: number | null = null;
      if (fileHandleRef.current) {
        try {
          uploadedFileId = await fileHandleRef.current.flush();
        } catch (err: any) {
          toast(err?.message || "Gagal mengunggah file lampiran SO", "danger");
          setIsSubmitting(false);
          return;
        }
      }

      const finalItemsPayload: any[] = [];
      for (const item of items) {
        let finalProdId = item.productId;

        // Hanya daftarkan ke master produk jika BUKAN jasa dan bukan non-inventory
        if ((item.isNewItem || !finalProdId) && item.itemType !== "JASA" && !item.isNonInventory) {
          const autoSku = `SKU-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`;
          const createdProduct = await addRow("products", {
            nama: item.name,
            sku: autoSku,
            satuan: item.unit,
            unit: item.unit,
            berSN: item.hasSerial,
            hasSerial: item.hasSerial,
            categoryId: item.categoryId || undefined,
            kategori: item.categoryName || undefined,
            hargaBeli: Math.round(item.price * 0.75),
            purchasePrice: Math.round(item.price * 0.75),
            hargaJual: item.price,
            price: item.price,
            status: "AKTIF",
          }).catch(() => null);

          if (createdProduct?.id) {
            finalProdId = String(createdProduct.id);
          }
        }

        finalItemsPayload.push({
          productId: finalProdId ? Number(finalProdId) : undefined,
          name: item.name,
          nama: item.name,
          item: item.name,
          customName: item.name,
          unit: item.unit,
          satuan: item.unit,
          customUnit: item.unit,
          qty: item.qty,
          price: item.price,
          harga: item.price,
          hasSerial: item.hasSerial,
          berSN: item.hasSerial,
          itemType: item.itemType || (item.pphMode && item.pphMode !== "none" ? "JASA" : "BARANG"),
          isNonInventory: item.isNonInventory ?? (item.itemType === "JASA"),
          pphMode: item.pphMode || "none",
          tipePph: item.tipePph || pphModeToTipe(item.pphMode || "none"),
          pph: calcItemPph(item),
        });
      }

      const effectiveSoNumber = nomorSo.trim() || suggestedSoNumber || undefined;

      const payload: any = {
        nomor: effectiveSoNumber,
        nomorSo: effectiveSoNumber,
        nomorPoClient: nomorPoClient.trim() || undefined,
        docMode: "SO",
        customerId: customerId ? Number(customerId) : undefined,
        customer: customerName || undefined,
        quotationId: quotationId ? Number(quotationId) : undefined,
        projectId: projectId ? Number(projectId) : undefined,
        tanggal,
        eta,
        nilai: ppnMode === "include" ? subtotalDpp - ppnAmount : subtotalDpp,
        ppn: ppnAmount,
        tipePpn:
          ppnMode === "none"
            ? "Non PPN"
            : ppnMode === "include"
            ? "PPN Included (11%)"
            : "Exclude PPN (11%)",
        ppnMode,
        pph: totalPph,
        tipePph: totalPph > 0 ? (items.find((it) => it.pphMode && it.pphMode !== "none")?.tipePph || "PPh") : "Tanpa PPh",
        pphMode: items.find((it) => it.pphMode && it.pphMode !== "none")?.pphMode || "none",
        total: grandTotal,
        amount: grandTotal,
        catatan: catatan.trim() || undefined,
        notes: catatan.trim() || undefined,
        items: finalItemsPayload,
        fileId: uploadedFileId || undefined,
        paymentFlow,
      };

      const created = await addRow("po-client", payload);

      if (created) {
        if (paymentFlow === "WALK_IN" && created.id) {
          let walkinUploadedFileId: number | null = null;
          if (walkinFileHandleRef.current) {
            try {
              walkinUploadedFileId = await walkinFileHandleRef.current.flush();
            } catch {}
          }
          await api("POST", `/client-po/${created.id}/direct-settlement`, {
            coaAccount: walkinCoaAccount,
            fileId: walkinUploadedFileId || uploadedFileId || undefined,
            notes: `Pembayaran Walk-in Langsung Lunas (${walkinPayMethod}) SO ${created.nomor || effectiveSoNumber}`,
          }).catch(() => {});
          toast(`Sales Order ${created.nomor || effectiveSoNumber} & Invoice Lunas (Walk-in) berhasil dicatat!`);
        } else {
          toast(`Sales Order ${created.nomor || effectiveSoNumber || ""} berhasil diterbitkan!`);
        }
        void pushHistory(
          "po-client",
          String(created.id),
          `Sales Order ${created.nomor || effectiveSoNumber} berhasil diterbitkan senilai ${rupiah(grandTotal)} (${items.length} item)`
        );
        void refreshModule("po-client");
        void refreshModule("invoices");
        void refreshModule("quotations");
        void reload();
        onSuccess?.();
        onClose();
      } else {
        toast("Gagal menerbitkan Sales Order", "danger");
      }
    } catch (err: any) {
      toast(err?.message || "Terjadi kesalahan saat menyimpan Sales Order", "danger");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <DialogContent className="sm:max-w-xl md:max-w-2xl lg:max-w-4xl p-0 overflow-hidden">
      <DialogHeader className="p-4 sm:p-5 border-b border-border bg-panel/60">
        <View className="flex-row items-center justify-between gap-3">
          <View className="gap-1">
            <View className="flex-row items-center gap-2">
              <FileCheck size={18} color={colors.primary} />
              <DialogTitle className="text-base sm:text-lg font-bold">
                Buat Sales Order (SO)
              </DialogTitle>
            </View>
            <Text className="text-xs text-muted-foreground">
              Formulir penerbitan pesanan penjualan (SO) ke customer & pencatatan PO Client
            </Text>
          </View>
          <View className="px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30">
            <Text className="text-[11px] font-semibold text-primary">Sisi Penjualan (SO)</Text>
          </View>
        </View>
      </DialogHeader>

      <ScrollView style={{ maxHeight: 620 }} contentContainerClassName="p-4 sm:p-5 gap-5">
        {/* 1. Alur Penjualan */}
        <View className="p-3.5 rounded-xl bg-panel border border-border/80 gap-2.5">
          <Text className="text-xs font-bold text-foreground">
            Alur Penjualan & Pembayaran Customer:
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <Button
              size="sm"
              variant={paymentFlow === "REGULER" ? "default" : "outline"}
              onPress={() => setPaymentFlow("REGULER")}
              className="flex-1 min-w-[170px] h-9 px-3"
            >
              <FileText size={14} className="mr-1.5" />
              <Text className="text-xs font-semibold">Reguler / PO Client (Tempo / DP)</Text>
            </Button>
            <Button
              size="sm"
              variant={paymentFlow === "WALK_IN" ? "default" : "outline"}
              onPress={() => setPaymentFlow("WALK_IN")}
              className="flex-1 min-w-[170px] h-9 px-3"
            >
              <Receipt size={14} className="mr-1.5" />
              <Text className="text-xs font-semibold">Datang Langsung / Nota (Langsung Lunas)</Text>
            </Button>
          </View>
          <Text className="text-[11px] text-muted-foreground leading-relaxed">
            {paymentFlow === "REGULER"
              ? "Sistem membuat Sales Order berstatus pesanan aktif untuk ditindaklanjuti dengan invoice termin/DP atau Surat Jalan gudang."
              : "Penjualan langsung / kasir (Walk-in). SO langsung dilunasi dan invoice keluar dibuat seketika saat transaksi disimpan."}
          </Text>

          {paymentFlow === "WALK_IN" ? (
            <View className="mt-2 p-3 rounded-lg bg-card border border-border/80 gap-3">
              <Text className="text-xs font-bold text-foreground">
                Detail Penerimaan Kas / Bank Penjualan Walk-In:
              </Text>
              <View className="flex-col sm:flex-row gap-3">
                <View className="w-full sm:w-48">
                  <FormField label="Metode Bayar" hint="Penerimaan langsung">
                    <View className="flex-row gap-1">
                      <Button
                        size="sm"
                        variant={walkinPayMethod === "TUNAI" ? "default" : "outline"}
                        onPress={() => {
                          setWalkinPayMethod("TUNAI");
                          setWalkinCoaAccount("1000.01");
                        }}
                        className="flex-1 h-8 px-2"
                      >
                        <Text className="text-xs">Tunai / Kas</Text>
                      </Button>
                      <Button
                        size="sm"
                        variant={walkinPayMethod === "TRANSFER" ? "default" : "outline"}
                        onPress={() => {
                          setWalkinPayMethod("TRANSFER");
                          setWalkinCoaAccount("1000.02");
                        }}
                        className="flex-1 h-8 px-2"
                      >
                        <Text className="text-xs">Transfer</Text>
                      </Button>
                    </View>
                  </FormField>
                </View>
                <View className="flex-1">
                  <FormField label="Pilih Akun Kas / Bank (CoA) Penerima *" hint="Rekening penampung uang masuk">
                    <SearchableSelect
                      value={getKasBankAccounts().find((a) => a.code === walkinCoaAccount)?.name || walkinCoaAccount}
                      options={getKasBankAccounts().map((a) => a.name)}
                      onChange={(lbl) => {
                        const m = getKasBankAccounts().find((a) => a.name === lbl);
                        if (m) setWalkinCoaAccount(m.code);
                      }}
                      placeholder="Pilih rekening Kas / Bank"
                    />
                  </FormField>
                </View>
              </View>
              <FormField label="Upload Bukti Struk / Transfer (Opsional)" hint="Foto struk kasir atau bukti mutasi">
                <FileUploader
                  handleRef={(h) => (walkinFileHandleRef.current = h)}
                  category="invoices"
                  kind="semua"
                  label="Bukti Bayar"
                  allowedExtensions={["pdf", "png", "jpg", "jpeg"]}
                />
              </FormField>
            </View>
          ) : null}
        </View>

        {/* 2. Informasi Dokumen & Customer */}
        <View className="p-4 rounded-xl bg-card border border-border gap-4">
          <View className="flex-row items-center gap-2 border-b border-border/60 pb-2.5">
            <Building2 size={16} color={colors.primary} />
            <Text className="text-xs font-bold uppercase tracking-wider text-foreground">
              I. Informasi Dokumen & Pelanggan
            </Text>
          </View>

          {/* Baris 1: Customer & Penawaran */}
          <View className="flex-col sm:flex-row gap-3">
            <View className="flex-1">
              <FormField
                label="Customer / Pelanggan (Opsional)"
                hint="Pilih pelanggan tujuan Sales Order ini (bisa dikosongkan jika umum/walk-in)"
              >
                <SearchableSelect
                  value={customerName}
                  options={["- Tanpa Customer (Umum / Walk-in) -", ...customerOptions.map((c) => c.name)]}
                  onChange={(val) => {
                    if (val === "- Tanpa Customer (Umum / Walk-in) -") {
                      setCustomerName("");
                      setCustomerId("");
                      return;
                    }
                    setCustomerName(val);
                    const match = (data.customers ?? []).find(
                      (c: Row) => (c.nama || c.name) === val || String(c.id) === String(val)
                    );
                    if (match) {
                      setCustomerId(String(match.id));
                    } else {
                      setCustomerId("");
                    }
                  }}
                  onAddNew={() => setQuickCustomerOpen(true)}
                  addNewLabel="+ Tambah Customer Baru"
                  placeholder="Pilih customer atau kosongkan..."
                />
              </FormField>
            </View>

            <View className="flex-1">
              <FormField
                label="Berdasarkan Penawaran Asal (Opsional)"
                hint="Pilih penawaran (quotation) untuk otomatis mengisi item & nilai"
              >
                <SearchableSelect
                  value={quotationLabel}
                  options={["-", ...quotationOptions.map((q) => q.label)]}
                  onChange={(val) => {
                    if (val === "-" || !val) {
                      setQuotationLabel("");
                      setQuotationId("");
                    } else {
                      void handleSelectQuotation(val);
                    }
                  }}
                  placeholder="Pilih penawaran jika ada..."
                />
              </FormField>
            </View>
          </View>

          {/* Baris 2: Nomor SO & Nomor PO Client */}
          <View className="flex-col sm:flex-row gap-3">
            <View className="flex-1">
              <FormField
                label="Nomor Sales Order (SO)"
                hint={`Kosongkan untuk otomatis sistem (${suggestedSoNumber || "Otomatis"})`}
              >
                <Input
                  value={nomorSo}
                  onChangeText={setNomorSo}
                  placeholder={suggestedSoNumber || "Contoh: SO/2026/11/001"}
                />
              </FormField>
            </View>

            <View className="flex-1">
              <FormField
                label="Nomor PO Client (Opsional)"
                hint="Nomor dokumen PO resmi dari pihak customer"
              >
                <Input
                  value={nomorPoClient}
                  onChangeText={setNomorPoClient}
                  placeholder="Contoh: PO-CUST/102/2026"
                />
              </FormField>
            </View>
          </View>

          {/* Baris 3: Tanggal SO, Estimasi Pengiriman & Proyek */}
          <View className="flex-col sm:flex-row gap-3">
            <View className="flex-1">
              <FormField label="Tanggal Terbit SO" required hint="Tanggal penerbitan dokumen SO">
                <DatePicker value={tanggal} onChange={setTanggal} placeholder="Pilih tanggal..." />
              </FormField>
            </View>

            <View className="flex-1">
              <FormField label="Estimasi Pengiriman (ETA)" hint="Perkiraan barang siap dikirim ke customer">
                <DatePicker value={eta} onChange={setEta} placeholder="Pilih estimasi pengiriman..." />
              </FormField>
            </View>

            <View className="flex-1">
              <FormField label="Alokasi Proyek Terkait (Opsional)" hint="Hubungkan dengan data project">
                <SearchableSelect
                  value={projectOptions.find((p) => p.id === projectId)?.label || ""}
                  options={["-", ...projectOptions.map((p) => p.label)]}
                  onChange={(val) => {
                    if (val === "-" || !val) {
                      setProjectId("");
                    } else {
                      const match = projectOptions.find((p) => p.label === val);
                      setProjectId(match ? match.id : "");
                    }
                  }}
                  placeholder="Pilih project..."
                />
              </FormField>
            </View>
          </View>
        </View>

        {/* 3. Daftar Barang & Jasa yang Dipesan */}
        <View className="p-4 rounded-xl bg-card border border-border gap-4">
          <View className="flex-row items-center justify-between border-b border-border/60 pb-2.5">
            <View className="flex-row items-center gap-2">
              <ShoppingCart size={16} color={colors.primary} />
              <Text className="text-xs font-bold uppercase tracking-wider text-foreground">
                II. Rincian Barang & Jasa (SO Items)
              </Text>
            </View>
            <Text className="text-xs font-semibold text-primary">{items.length} Item Tercatat</Text>
          </View>

          {/* Form Penambahan Barang */}
          <View className="p-3.5 rounded-xl bg-panel border border-border/80 gap-3">
            {/* Tab Pilihan Sumber Barang */}
            <View className="flex-row items-center gap-2">
              <Button
                size="sm"
                variant={itemMode === "master" ? "default" : "outline"}
                onPress={() => setItemMode("master")}
                className="h-8 px-3"
              >
                <Package size={13} className="mr-1.5" />
                <Text className="text-xs">Dari Master Stok</Text>
              </Button>
              <Button
                size="sm"
                variant={itemMode === "custom" ? "default" : "outline"}
                onPress={() => setItemMode("custom")}
                className="h-8 px-3"
              >
                <Plus size={13} className="mr-1.5" />
                <Text className="text-xs">Item Manual / Jasa</Text>
              </Button>
            </View>

            {itemMode === "master" ? (
              <View className="gap-3 pt-1">
                <FormField label="Pilih Produk dari Master Stok" hint="Pilih barang dari katalog gudang">
                  <SearchableSelect
                    value={
                      selectedProductObj
                        ? `${selectedProductObj.nama || selectedProductObj.name} (Stok: ${getProductStock(
                            selectedProductObj
                          )} ${selectedProductObj.satuan || selectedProductObj.unit || "unit"})`
                        : ""
                    }
                    options={(data.products ?? []).map(
                      (p: Row) =>
                        `${p.nama || p.name} (Stok: ${getProductStock(p)} ${p.satuan || p.unit || "unit"})`
                    )}
                    onChange={(val) => {
                      const match = (data.products ?? []).find(
                        (p: Row) =>
                          `${p.nama || p.name} (Stok: ${getProductStock(p)} ${p.satuan || p.unit || "unit"})` === val
                      );
                      if (match) {
                        handleSelectMasterProduct(String(match.id));
                      } else {
                        setSelectedProductId("");
                      }
                    }}
                    placeholder="Ketik untuk mencari produk..."
                  />
                </FormField>

                <View className="flex-col sm:flex-row gap-3">
                  <View className="w-full sm:w-28">
                    <FormField label="Jumlah (Qty)" hint="Kuantitas">
                      <Input
                        value={masterQty}
                        onChangeText={(v) => setMasterQty(formatThousands(v))}
                        keyboardType="numeric"
                        placeholder="1"
                      />
                    </FormField>
                  </View>

                  <View className="flex-1">
                    <FormField
                      label="Harga Jual Satuan (Rp)"
                      hint={
                        selectedProductObj
                          ? `Harga acuan jual: ${rupiah(Number(selectedProductObj.hargaJual || selectedProductObj.price || 0))}`
                          : "Harga jual ke customer"
                      }
                    >
                      <Input
                        value={masterPrice}
                        onChangeText={(v) => setMasterPrice(formatThousands(v))}
                        keyboardType="numeric"
                        placeholder="Contoh: 1.500.000"
                      />
                    </FormField>
                  </View>
                </View>

                <View className="flex-col sm:flex-row items-end gap-3 pt-1">
                  <View className="flex-1 w-full">
                    <FormField label="PPh Barang / Jasa (Opsional)" hint="Pilih pemotongan PPh jika ada">
                      <SearchableSelect
                        value={pphModeToTipe(masterPphMode)}
                        options={PPH_MODE_OPTIONS.map((o) => o.label)}
                        onChange={(lbl) => {
                          const m = PPH_MODE_OPTIONS.find((o) => o.label === lbl);
                          setMasterPphMode(m?.id || "none");
                        }}
                        placeholder="Tanpa PPh"
                      />
                    </FormField>
                  </View>

                  <Button
                    onPress={handleAddFromMaster}
                    className="h-10 px-5 flex-row items-center justify-center gap-1.5 w-full sm:w-auto"
                  >
                    <Plus size={15} color={colors.background} />
                    <Text className="text-xs font-semibold">Tambah ke SO</Text>
                  </Button>
                </View>
              </View>
            ) : (
              <View className="gap-3 pt-1">
                {/* Sub-pilihan jenis Item Non-Master */}
                <View className="gap-1.5">
                  <Text className="text-xs font-medium text-foreground">Jenis Item Non-Master:</Text>
                  <View className="flex-row gap-2">
                    <Button
                      size="sm"
                      variant={newNonInvType === "JASA" ? "default" : "outline"}
                      onPress={() => {
                        setNewNonInvType("JASA");
                        setNewUnit("paket");
                        setNewPphMode("pph23");
                      }}
                      className="h-8 px-3"
                    >
                      <Text className="text-xs">Jasa / Pekerjaan / Subkon</Text>
                    </Button>
                    <Button
                      size="sm"
                      variant={newNonInvType === "NON_STOK" ? "default" : "outline"}
                      onPress={() => {
                        setNewNonInvType("NON_STOK");
                        setNewUnit("unit");
                        setNewPphMode("none");
                      }}
                      className="h-8 px-3"
                    >
                      <Text className="text-xs">Barang Non-Stok / Pakai Habis</Text>
                    </Button>
                  </View>
                </View>

                <View className="flex-col sm:flex-row gap-3">
                  <View className="flex-1">
                    <FormField
                      label={newNonInvType === "JASA" ? "Nama Jasa / Pekerjaan *" : "Nama Barang Non-Stok *"}
                      hint={newNonInvType === "JASA" ? "Contoh: Jasa Pemasangan CCTV & Setting DVR (Tidak masuk master inventori)" : "Contoh: Kabel UTP Patch Cord 2m"}
                    >
                      <Input
                        value={newName}
                        onChangeText={setNewName}
                        placeholder={newNonInvType === "JASA" ? "Contoh: Jasa Instalasi Jaringan & Setting" : "Contoh: Kabel Roll 50m / Konektor"}
                      />
                    </FormField>
                  </View>

                  <View className="w-full sm:w-28">
                    <FormField label="Satuan *" hint={newNonInvType === "JASA" ? "paket / titik / jam" : "unit / roll / m"}>
                      <Input
                        value={newUnit}
                        onChangeText={setNewUnit}
                        placeholder={newNonInvType === "JASA" ? "paket" : "unit"}
                      />
                    </FormField>
                  </View>
                </View>

                <View className="flex-col sm:flex-row gap-3">
                  <View className="w-full sm:w-28">
                    <FormField label="Qty *" hint="Kuantitas">
                      <Input
                        value={newQty}
                        onChangeText={(v) => setNewQty(formatThousands(v))}
                        keyboardType="numeric"
                        placeholder="1"
                      />
                    </FormField>
                  </View>

                  <View className="flex-1">
                    <FormField
                      label={newNonInvType === "JASA" ? "Biaya Jasa Satuan (Rp) *" : "Harga Jual Satuan (Rp) *"}
                      hint="Harga jual satuan ke customer"
                    >
                      <Input
                        value={newPrice}
                        onChangeText={(v) => setNewPrice(formatThousands(v))}
                        keyboardType="numeric"
                        placeholder="Contoh: 500.000"
                      />
                    </FormField>
                  </View>
                </View>

                {newNonInvType === "JASA" ? (
                  <View className="gap-1.5 bg-card/60 border border-border/80 rounded-lg p-3">
                    <Text className="text-xs font-semibold text-foreground">Pemotongan PPh Jasa (Vendor / Customer):</Text>
                    <Text className="text-[11px] text-muted-foreground">
                      PPh dipotong dari biaya jasa ini oleh customer (PPh pasal 23/4(2)/21)
                    </Text>
                    <View className="flex-row gap-1.5 flex-wrap pt-1">
                      {PPH_MODE_OPTIONS.map((opt) => (
                        <Button
                          key={opt.id}
                          size="sm"
                          variant={newPphMode === opt.id ? "default" : "outline"}
                          onPress={() => setNewPphMode(opt.id)}
                          className="h-7 px-2.5"
                        >
                          <Text className={`text-[11px] font-semibold ${newPphMode === opt.id ? "text-primary-foreground" : ""}`}>{opt.label}</Text>
                        </Button>
                      ))}
                    </View>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setNewHasSerial(!newHasSerial)}
                    className={`h-10 flex-row items-center gap-2 px-3.5 rounded-lg border self-start ${
                      newHasSerial ? "bg-primary/10 border-primary" : "bg-panel border-border"
                    }`}
                  >
                    <View
                      className={`size-4 rounded border items-center justify-center ${
                        newHasSerial ? "bg-primary border-primary" : "border-border"
                      }`}
                    >
                      {newHasSerial ? <Text className="text-[10px] text-background">✓</Text> : null}
                    </View>
                    <Text className="text-xs font-medium">Lacak SN untuk barang ini</Text>
                  </Pressable>
                )}

                <Button
                  onPress={handleAddCustomItem}
                  className="h-10 px-5 flex-row items-center justify-center gap-1.5 self-start"
                >
                  <Plus size={15} color={colors.background} />
                  <Text className="text-xs font-semibold">{newNonInvType === "JASA" ? "+ Tambah Jasa" : "+ Tambah Barang"}</Text>
                </Button>
              </View>
            )}
          </View>

          {/* Tabel / List Item Terpilih */}
          {items.length === 0 ? (
            <View className="p-6 rounded-xl bg-panel/50 border border-dashed border-border items-center justify-center gap-1">
              <ShoppingCart size={24} color={colors.textSecondary} />
              <Text className="text-xs font-medium text-text-secondary text-center mt-1">
                Belum ada barang di daftar Sales Order.
              </Text>
              <Text className="text-[11px] text-muted-foreground text-center">
                Pilih produk dari master stok atau tambahkan item kustom/jasa di atas.
              </Text>
            </View>
          ) : (
            <View className="gap-2">
              {items.map((item, idx) => (
                <View
                  key={item.id}
                  className="p-3 rounded-lg bg-panel border border-border/80 flex-row items-center justify-between gap-3"
                >
                  <View className="flex-1 min-w-0">
                    <View className="flex-row items-center gap-2 flex-wrap">
                      <Text className="text-xs font-bold text-foreground">
                        {idx + 1}. {item.name}
                      </Text>
                      {item.isNewItem ? (
                        <Text className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                          + Custom / Baru
                        </Text>
                      ) : null}
                      {item.hasSerial ? (
                        <Text className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-info/15 text-info">
                          SN Lacak
                        </Text>
                      ) : null}
                      {item.pphMode && item.pphMode !== "none" ? (
                        <Text className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-danger/15 text-danger">
                          {item.tipePph || item.pphMode} (-{rupiah(calcItemPph(item))})
                        </Text>
                      ) : null}
                    </View>
                    <Text className="text-[11px] text-muted-foreground mt-0.5">
                      {item.qty} {item.unit} × {rupiah(item.price)}
                    </Text>
                  </View>

                  <View className="flex-row items-center gap-3">
                    <Text className="text-sm font-bold font-mono text-foreground">
                      {rupiah(item.qty * item.price)}
                    </Text>
                    <Pressable
                      onPress={() => handleRemoveItem(item.id)}
                      className="size-7 rounded-md bg-danger/10 items-center justify-center hover:bg-danger/20"
                    >
                      <Trash2 size={13} color={colors.danger} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 4. Skema PPN & Ringkasan Nilai SO */}
        <View className="p-4 rounded-xl bg-card border border-border gap-4">
          <View className="flex-row items-center gap-2 border-b border-border/60 pb-2.5">
            <Layers size={16} color={colors.primary} />
            <Text className="text-xs font-bold uppercase tracking-wider text-foreground">
              III. Skema Pajak PPN & Ringkasan Nilai
            </Text>
          </View>

          {/* Opsi PPN */}
          <View className="gap-2">
            <Text className="text-xs font-bold text-foreground">Pilihan Perlakuan PPN:</Text>
            <View className="flex-row flex-wrap gap-2">
              <Button
                size="sm"
                variant={ppnMode === "none" ? "default" : "outline"}
                onPress={() => setPpnMode("none")}
                className="flex-1 min-w-[120px] h-9"
              >
                <Text className="text-xs font-semibold">Non PPN (0%)</Text>
              </Button>
              <Button
                size="sm"
                variant={ppnMode === "exclude" ? "default" : "outline"}
                onPress={() => setPpnMode("exclude")}
                className="flex-1 min-w-[130px] h-9"
              >
                <Text className="text-xs font-semibold">PPN 11% (Exclude)</Text>
              </Button>
              <Button
                size="sm"
                variant={ppnMode === "include" ? "default" : "outline"}
                onPress={() => setPpnMode("include")}
                className="flex-1 min-w-[140px] h-9"
              >
                <Text className="text-xs font-semibold">PPN Termasuk (Include)</Text>
              </Button>
            </View>
          </View>

          {/* Rincian Finansial Card */}
          <View className="p-3.5 rounded-xl bg-panel border border-border gap-2">
            <View className="flex-row justify-between items-center py-0.5">
              <Text className="text-xs text-text-secondary">Subtotal Barang & Jasa (DPP)</Text>
              <Text className="text-xs font-mono font-medium">
                {rupiah(ppnMode === "include" ? subtotalDpp - ppnAmount : subtotalDpp)}
              </Text>
            </View>

            <View className="flex-row justify-between items-center py-0.5">
              <View className="flex-row items-center gap-1.5">
                <Text className="text-xs text-text-secondary">PPN Keluaran (11%)</Text>
                {ppnMode === "none" ? (
                  <Text className="text-[10px] text-muted-foreground">(Bebas PPN)</Text>
                ) : ppnMode === "include" ? (
                  <Text className="text-[10px] text-primary">(Sudah Termasuk)</Text>
                ) : (
                  <Text className="text-[10px] text-warning">(Ditambahkan)</Text>
                )}
              </View>
              <Text className="text-xs font-mono font-medium text-warning">
                {rupiah(ppnAmount)}
              </Text>
            </View>

            {totalPph > 0 && (
              <View className="flex-row justify-between items-center py-0.5">
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-xs text-text-secondary">Potongan PPh Jasa</Text>
                  <Text className="text-[10px] text-danger font-medium">(Dihitung dari Item Jasa)</Text>
                </View>
                <Text className="text-xs font-mono font-medium text-danger">
                  - {rupiah(totalPph)}
                </Text>
              </View>
            )}

            <View className="border-t border-border pt-2 flex-row justify-between items-center">
              <Text className="text-sm font-bold text-foreground">TOTAL NILAI SALES ORDER</Text>
              <Text className="text-base font-bold font-mono text-primary">
                {rupiah(grandTotal)}
              </Text>
            </View>
          </View>
        </View>

        {/* 5. Lampiran Dokumen & Catatan */}
        <View className="p-4 rounded-xl bg-card border border-border gap-4">
          <View className="flex-row items-center gap-2 border-b border-border/60 pb-2.5">
            <FileText size={16} color={colors.primary} />
            <Text className="text-xs font-bold uppercase tracking-wider text-foreground">
              IV. Lampiran Dokumen & Catatan Tambahan
            </Text>
          </View>

          <FormField
            label="Upload Dokumen PO Client / SPK Kontrak (Opsional)"
            hint="Format PDF, PNG, JPG maks 15 MB"
          >
            <FileUploader
              handleRef={(h) => (fileHandleRef.current = h)}
              category="po-client"
              kind="dokumen"
              label="Dokumen PO Client"
              allowedExtensions={["pdf", "png", "jpg", "jpeg"]}
            />
          </FormField>

          <FormField label="Catatan Tambahan (Opsional)" hint="Instruksi pengiriman, termin, atau ketentuan khusus">
            <Input
              value={catatan}
              onChangeText={setCatatan}
              placeholder="Contoh: Pengiriman dilakukan bertahap, garansi servis 1 tahun..."
            />
          </FormField>
        </View>
      </ScrollView>

      <DialogFooter className="p-4 sm:p-5 border-t border-border bg-panel/60 flex-row justify-between items-center">
        <Button variant="outline" onPress={onClose} disabled={isSubmitting}>
          <Text className="text-xs">Batal</Text>
        </Button>

        <Button
          onPress={handleSubmit}
          disabled={isSubmitting || items.length === 0}
          className="flex-row items-center gap-2 px-5"
        >
          <FileCheck size={15} color={colors.background} />
          <Text className="text-xs font-semibold text-background">
            {isSubmitting ? "Menerbitkan SO..." : `Terbitkan Sales Order (${rupiah(grandTotal)})`}
          </Text>
        </Button>
      </DialogFooter>

      {/* Quick Add Customer Dialog */}
      <QuickAddCustomerDialog
        open={quickCustomerOpen}
        onOpenChange={setQuickCustomerOpen}
        onSuccess={(newCust) => {
          if (newCust?.id) {
            setCustomerId(String(newCust.id));
            setCustomerName(newCust.nama || newCust.name || "");
          }
        }}
      />
    </DialogContent>
  );
}

