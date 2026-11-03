import * as React from "react";
import { View, Pressable, ScrollView, Platform, TextInput } from "react-native";
import {
  Package,
  Wrench,
  Plus,
  Check,
  Zap,
  RefreshCw,
  TriangleAlert,
  Info,
  ScanLine,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FormField } from "@/components/taska/basics";
import { SearchableSelect } from "@/components/taska/dialogs";
import { StatusBadge } from "@/components/taska/status-badge";
import { useApp } from "@/store/app-store";
import { api } from "@/services/api";
import { colors } from "@/tokens";
import { formatThousands } from "@/lib/format";
import { pphModeToTipe, type PphMode } from "@/modules/quotation/lib";
import type { QuotationItem } from "@/modules/quotation/types";

function playScanBeep(ok: boolean) {
  if (Platform.OS !== "web") return;
  try {
    const AC = (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = ok ? 880 : 220;
    g.gain.value = 0.05;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.12);
  } catch {}
}

type Props = {
  open: boolean;
  onClose: () => void;
  onAddItems: (items: QuotationItem[]) => void;
  currentInvoiceId?: string | number | null;
  currentQuotationId?: string | number | null;
  existingItems?: any[];
};

export function SerialItemPickerModal({
  open,
  onClose,
  onAddItems,
  currentInvoiceId,
  currentQuotationId,
  existingItems,
}: Props) {
  const { data, reload, toast, refreshModule } = useApp();

  const [tab, setTab] = React.useState<"GOODS" | "SERVICE">("GOODS");
  const [selectedProductId, setSelectedProductId] = React.useState<string>("");
  const [snSearch, setSnSearch] = React.useState("");
  const [selectedSerialIds, setSelectedSerialIds] = React.useState<number[]>([]);
  const [splitMode, setSplitMode] = React.useState<"PER_SN" | "COMBINED">("PER_SN");
  const [fifoCountInput, setFifoCountInput] = React.useState("1");
  const [goodsQty, setGoodsQty] = React.useState("1");
  const [goodsUnit, setGoodsUnit] = React.useState("Unit");
  const [goodsPrice, setGoodsPrice] = React.useState("");
  const [customItemLabel, setCustomItemLabel] = React.useState("");
  const [goodsPphMode, setGoodsPphMode] = React.useState<PphMode>("none");

  // Service tab states
  const [serviceName, setServiceName] = React.useState("");
  const [serviceQty, setServiceQty] = React.useState("1");
  const [serviceUnit, setServiceUnit] = React.useState("Lot");
  const [servicePrice, setServicePrice] = React.useState("");
  const [servicePphMode, setServicePphMode] = React.useState<PphMode>("none");

  // Quick batch register modal inside picker
  const [batchRegisterOpen, setBatchRegisterOpen] = React.useState(false);
  const [fallbackSerials, setFallbackSerials] = React.useState<any[]>([]);

  // Scanner barcode & multi-scan states
  const [scanInput, setScanInput] = React.useState("");
  const [scanFeedback, setScanFeedback] = React.useState<{
    type: "success" | "warning" | "error";
    message: string;
  } | null>(null);
  const [multiScanModalOpen, setMultiScanModalOpen] = React.useState(false);
  const [multiScanText, setMultiScanText] = React.useState("");
  const scanInputRef = React.useRef<TextInput>(null);

  const handleClose = () => {
    setGoodsPphMode("none");
    setServicePphMode("none");
    onClose();
  };

  React.useEffect(() => {
    if (!open) return;
    if (refreshModule) {
      void Promise.all([refreshModule("products"), refreshModule("serials"), refreshModule("warehouses")]);
    }
    api<any>("GET", "/serials?limit=500")
      .then((res) => {
        const items = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
        if (items.length > 0) {
          setFallbackSerials(
            items.map((s: any) => ({
              ...s,
              id: String(s.id),
              sn: s.sn ?? "",
              sku: s.product?.sku ?? s.sku ?? "",
              produk: s.product?.name ?? s.produk ?? "",
              productId: s.product?.id != null ? String(s.product.id) : (s.productId != null ? String(s.productId) : null),
              gudang: s.warehouse?.name ?? s.gudang ?? "-",
              rawStatus: s.status ?? "DI_GUDANG",
              status: s.status === "DI_GUDANG" ? "Di gudang" : s.status,
              reservations: Array.isArray(s.reservations) ? s.reservations : [],
            }))
          );
        }
      })
      .catch(() => {});
  }, [open, refreshModule]);

  const products = React.useMemo(() => (data.products ?? []) as any[], [data.products]);
  const serials = React.useMemo(() => {
    const fromStore = (data.serials ?? []) as any[];
    if (fromStore.length > 0) return fromStore;
    return fallbackSerials;
  }, [data.serials, fallbackSerials]);

  const selectedProduct = React.useMemo(
    () => products.find((p) => String(p.id) === String(selectedProductId)) ?? null,
    [products, selectedProductId],
  );

  // Filter SNs for selected product, sorted FIFO (ID ascending)
  const productSerials = React.useMemo(() => {
    if (!selectedProduct) return [];
    const selId = String(selectedProduct.id);
    const selSku = String(selectedProduct.sku || "").trim().toLowerCase();
    const selName = String(selectedProduct.nama || "").trim().toLowerCase();

    const list = serials
      .filter((s: any) => {
        const pIdMatch = s.productId != null && String(s.productId) === selId;
        const skuMatch = selSku && s.sku && String(s.sku).trim().toLowerCase() === selSku;
        const nameMatch = selName && s.produk && String(s.produk).trim().toLowerCase() === selName;
        return pIdMatch || skuMatch || nameMatch;
      })
      .sort((a, b) => Number(a.id) - Number(b.id));

    if (!snSearch.trim()) return list;
    const q = snSearch.trim().toLowerCase();
    return list.filter(
      (s) =>
        String(s.sn || "").toLowerCase().includes(q) ||
        String(s.gudang || "").toLowerCase().includes(q) ||
        String(s.status || "").toLowerCase().includes(q),
    );
  }, [serials, selectedProduct, snSearch]);

  const existingSns = React.useMemo(() => {
    const set = new Set<string>();
    if (!Array.isArray(existingItems)) return set;
    for (const it of existingItems) {
      if (!it) continue;
      if (it.sn) set.add(String(it.sn).trim().toUpperCase());
      if (it.serialNumber) set.add(String(it.serialNumber).trim().toUpperCase());
      if (Array.isArray(it.serialNumbers)) {
        it.serialNumbers.forEach((s: any) => set.add(String(s).trim().toUpperCase()));
      }
      const snStr = String(it.item || it.name || "").match(/\(SN:\s*([^\)]+)\)/i)?.[1];
      if (snStr) {
        snStr.split(",").forEach((s) => set.add(s.trim().toUpperCase()));
      }
    }
    return set;
  }, [existingItems]);

  const getSerialAvailability = React.useCallback(
    (snRow: any) => {
      const cleanSn = String(snRow.sn || "").trim().toUpperCase();
      if (cleanSn && existingSns.has(cleanSn)) {
        return {
          selectable: false,
          badge: "Sudah Ada di Dokumen",
          tone: "Ditolak",
        };
      }

      const rawSt = String(snRow.rawStatus || snRow.status || "").toUpperCase();
      const activeRes: any[] = Array.isArray(snRow.reservations) ? snRow.reservations : [];

      const reservedByOtherInvoice = activeRes.find(
        (rv) => rv.invoiceId != null && String(rv.invoiceId) !== String(currentInvoiceId ?? ""),
      );
      if (reservedByOtherInvoice) {
        const invNo = reservedByOtherInvoice.invoice?.number || `#${reservedByOtherInvoice.invoiceId}`;
        return {
          selectable: false,
          badge: `Reserved Invoice ${invNo}`,
          tone: "Ditolak",
        };
      }

      if (["DIKIRIM", "TERPASANG", "RUSAK", "DIGANTI", "RETUR"].includes(rawSt)) {
        return {
          selectable: false,
          badge: snRow.status || rawSt,
          tone: snRow.status || "Nonaktif",
        };
      }

      const reservedByThisInvoice = activeRes.find(
        (rv) => currentInvoiceId != null && String(rv.invoiceId) === String(currentInvoiceId),
      );
      if (reservedByThisInvoice) {
        return {
          selectable: true,
          badge: "Direserve Invoice Ini",
          tone: "Berjalan",
        };
      }

      const reservedByQuotation = activeRes.find(
        (rv) => rv.quotationId != null && String(rv.quotationId) !== String(currentQuotationId ?? ""),
      );
      if (reservedByQuotation) {
        const quoNo = reservedByQuotation.quotation?.number || `#${reservedByQuotation.quotationId}`;
        return {
          selectable: true,
          badge: `Penawaran ${quoNo} (Auto-Swap FIFO)`,
          tone: "Menunggu",
        };
      }

      if (rawSt === "RESERVED") {
        return {
          selectable: false,
          badge: snRow.reservedFor && snRow.reservedFor !== "-" ? `Reserved (${snRow.reservedFor})` : "Reserved",
          tone: "Menunggu",
        };
      }

      return {
        selectable: true,
        badge: "Di gudang",
        tone: "Tersedia",
      };
    },
    [currentInvoiceId, currentQuotationId, existingSns],
  );

  const availableFifoSerials = React.useMemo(() => {
    return productSerials.filter((s) => {
      const av = getSerialAvailability(s);
      const rawSt = String(s.rawStatus || "").toUpperCase();
      return av.selectable && (rawSt === "DI_GUDANG" || s.status === "Di gudang");
    });
  }, [productSerials, getSerialAvailability]);

  const handleSelectProduct = (prodNameOrLabel: string) => {
    const clean = (prodNameOrLabel.split(" (")[0] ?? prodNameOrLabel).trim();
    const found = products.find(
      (p) =>
        `${p.nama} (${p.sku})` === prodNameOrLabel ||
        p.nama === clean ||
        p.sku === clean,
    );
    if (!found) return;
    setSelectedProductId(String(found.id));
    setSelectedSerialIds([]);
    setScanInput("");
    setScanFeedback(null);
    setMultiScanText("");
    setGoodsUnit(found.satuan || "Unit");
    const rawPrice = found.hargaBeli ?? found.purchasePrice ?? found.price ?? found.harga ?? 0;
    setGoodsPrice(rawPrice > 0 ? formatThousands(rawPrice) : "");
    setCustomItemLabel(found.nama || "");
  };

  const toggleSerial = (id: number) => {
    const snObj = serials.find((s) => Number(s.id) === id);
    if (snObj) {
      const cleanSn = String(snObj.sn || "").trim().toUpperCase();
      if (cleanSn && existingSns.has(cleanSn)) {
        toast(`Barang/item dengan SN ${snObj.sn} sudah ada di daftar dokumen ini.`, "danger");
        return;
      }
    }
    setSelectedSerialIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleAutoPickFifo = () => {
    const count = Math.max(1, parseInt(fifoCountInput, 10) || 1);
    const picked = availableFifoSerials.slice(0, count).map((s) => Number(s.id));
    if (picked.length === 0) {
      toast("Tidak ada unit SN berstatus Di Gudang untuk produk ini.", "danger");
      return;
    }
    setSelectedSerialIds(picked);
    if (picked.length < count) {
      toast(`Hanya tersedia ${picked.length} unit SN Di Gudang (diurutkan FIFO).`);
    } else {
      toast(`${picked.length} unit SN dipilih otomatis secara FIFO.`);
    }
  };

  const processScannedText = (rawText: string) => {
    const tokens = rawText
      .split(/[\r\n,;\s]+/)
      .map((t) => t.trim().toUpperCase())
      .filter((t) => t.length > 0);

    if (tokens.length === 0) return;

    let addedCount = 0;
    let alreadySelectedCount = 0;
    const notFoundTokens: string[] = [];
    const unavailableTokens: string[] = [];
    const newSelected = new Set(selectedSerialIds);

    for (const token of tokens) {
      let match = productSerials.find(
        (s) => String(s.sn || "").trim().toUpperCase() === token
      );

      if (!match) {
        const anyMatch = serials.find((s) => String(s.sn || "").trim().toUpperCase() === token);
        if (anyMatch) {
          if (!selectedProductId || selectedProductId !== String(anyMatch.productId)) {
            setSelectedProductId(String(anyMatch.productId));
            const prod = products.find((p) => Number(p.id) === Number(anyMatch.productId));
            if (prod) {
              setCustomItemLabel(prod.nama);
              setGoodsUnit(prod.satuan || "Unit");
              setGoodsPrice(String(prod.hargaJual || prod.harga || ""));
            }
          }
          match = anyMatch;
        } else {
          const prodMatch = products.find(
            (p) =>
              String(p.sku || "").trim().toUpperCase() === token ||
              String(p.kode || "").trim().toUpperCase() === token
          );
          if (prodMatch) {
            setSelectedProductId(String(prodMatch.id));
            setCustomItemLabel(prodMatch.nama);
            setGoodsUnit(prodMatch.satuan || "Unit");
            setGoodsPrice(String(prodMatch.hargaJual || prodMatch.harga || ""));
            if (prodMatch.berSN) {
              const avail = serials.find(
                (s) =>
                  String(s.productId) === String(prodMatch.id) &&
                  !existingSns.has(String(s.sn).trim().toUpperCase()) &&
                  !newSelected.has(Number(s.id)) &&
                  (s.rawStatus === "DI_GUDANG" || s.rawStatus === "RESERVED" || s.status === "Di gudang" || s.status === "Reserved")
              );
              if (avail) {
                match = avail;
              } else {
                unavailableTokens.push(`${token} (Semua SN Di Gudang sudah terpakai)`);
                continue;
              }
            } else {
              setGoodsQty((prev) => String((Number(prev) || 1) + 1));
              addedCount++;
              continue;
            }
          } else {
            notFoundTokens.push(token);
            continue;
          }
        }
      }

      const matchId = Number(match.id);
      if (newSelected.has(matchId)) {
        alreadySelectedCount++;
        continue;
      }

      const cleanSn = String(match.sn || "").trim().toUpperCase();
      if (existingSns.has(cleanSn)) {
        unavailableTokens.push(`${cleanSn} (sudah di dokumen)`);
        continue;
      }

      const avail = getSerialAvailability(match);
      if (!avail.selectable) {
        unavailableTokens.push(`${cleanSn} (${avail.badge})`);
        continue;
      }

      newSelected.add(matchId);
      addedCount++;
    }

    if (addedCount > 0) {
      setSelectedSerialIds(Array.from(newSelected));
      playScanBeep(true);
      let msg = `✓ ${addedCount} unit SN berhasil diselect.`;
      if (alreadySelectedCount > 0) msg += ` (${alreadySelectedCount} sudah terpilih)`;
      if (notFoundTokens.length > 0) msg += ` (${notFoundTokens.length} tidak cocok)`;
      setScanFeedback({ type: "success", message: msg });
    } else if (alreadySelectedCount > 0 && notFoundTokens.length === 0 && unavailableTokens.length === 0) {
      playScanBeep(false);
      setScanFeedback({
        type: "warning",
        message: `Semua SN yang discan sudah terpilih (${alreadySelectedCount} unit).`,
      });
    } else {
      playScanBeep(false);
      const errors = [...notFoundTokens, ...unavailableTokens];
      setScanFeedback({
        type: "error",
        message: `Gagal select: ${errors.slice(0, 3).join(", ")}${errors.length > 3 ? ` (+${errors.length - 3} lainnya)` : ""}`,
      });
    }

    setScanInput("");
    setTimeout(() => {
      scanInputRef.current?.focus();
    }, 50);
  };

  const multiScanAnalysis = React.useMemo(() => {
    if (!multiScanText.trim() || !selectedProduct) return null;
    const tokens = multiScanText
      .split(/[\r\n,;\s]+/)
      .map((t) => t.trim().toUpperCase())
      .filter((t) => t.length > 0);

    const uniqueTokens = Array.from(new Set(tokens));
    const matchedAvailable: number[] = [];
    const alreadySelected: number[] = [];
    const unavailable: string[] = [];
    const notFound: string[] = [];

    const currentSelectedSet = new Set(selectedSerialIds);

    for (const token of uniqueTokens) {
      const match = productSerials.find(
        (s) => String(s.sn || "").trim().toUpperCase() === token
      );
      if (!match) {
        notFound.push(token);
        continue;
      }
      const matchId = Number(match.id);
      if (currentSelectedSet.has(matchId)) {
        alreadySelected.push(matchId);
        continue;
      }
      const cleanSn = String(match.sn || "").trim().toUpperCase();
      if (existingSns.has(cleanSn)) {
        unavailable.push(`${cleanSn} (sudah di dokumen)`);
        continue;
      }
      const avail = getSerialAvailability(match);
      if (!avail.selectable) {
        unavailable.push(`${cleanSn} (${avail.badge})`);
        continue;
      }
      matchedAvailable.push(matchId);
    }

    return {
      tokens: uniqueTokens,
      matchedAvailable,
      alreadySelected,
      unavailable,
      notFound,
    };
  }, [multiScanText, selectedProduct, productSerials, selectedSerialIds, existingSns, getSerialAvailability]);

  const handleConfirmAdd = () => {
    if (tab === "SERVICE") {
      if (!serviceName.trim()) {
        toast("Masukkan nama jasa / pekerjaan terlebih dahulu.", "danger");
        return;
      }
      const qty = Math.max(1, Number(serviceQty) || 1);
      const harga = Math.max(0, Number(String(servicePrice).replace(/\D/g, "")) || 0);
      onAddItems([
        {
          id: `srv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          item: serviceName.trim(),
          qty,
          satuan: serviceUnit.trim() || "Lot",
          harga,
          kind: "SERVICE",
          hasSerial: false,
          pphMode: servicePphMode,
          tipePph: pphModeToTipe(servicePphMode),
        },
      ]);
      setServiceName("");
      setServiceQty("1");
      setServicePrice("");
      setServicePphMode("none");
      onClose();
      return;
    }

    if (!selectedProduct) {
      toast("Pilih produk dari daftar stok terlebih dahulu.", "danger");
      return;
    }

    const harga = Math.max(0, Number(String(goodsPrice).replace(/\D/g, "")) || 0);
    const satuan = goodsUnit.trim() || selectedProduct.satuan || "Unit";
    const baseName = customItemLabel.trim() || selectedProduct.nama;
    const isSerialProduct = !!selectedProduct.berSN;

    if (isSerialProduct) {
      if (selectedSerialIds.length === 0) {
        toast("Pilih minimal 1 Serial Number (SN) untuk barang ber-SN ini.", "danger");
        return;
      }
      const chosenRows = selectedSerialIds
        .map((id) => productSerials.find((s) => Number(s.id) === id))
        .filter(Boolean);

      const duplicateSns = chosenRows
        .map((sRow) => String(sRow.sn || "").trim())
        .filter((sn) => existingSns.has(sn.toUpperCase()));
      if (duplicateSns.length > 0) {
        toast(`Barang/item dengan SN (${duplicateSns.join(", ")}) sudah ada di daftar!`, "danger");
        return;
      }

      if (splitMode === "PER_SN") {
        const newItems: QuotationItem[] = chosenRows.map((sRow, idx) => ({
          id: `gds-${Date.now()}-${idx}-${sRow.id}`,
          item: `${baseName} (SN: ${sRow.sn})`,
          qty: 1,
          satuan,
          harga,
          kind: "GOODS",
          productId: Number(selectedProduct.id),
          sku: selectedProduct.sku || undefined,
          hasSerial: true,
          serialUnitIds: [Number(sRow.id)],
          serialNumbers: [String(sRow.sn)],
          pphMode: goodsPphMode,
          tipePph: pphModeToTipe(goodsPphMode),
        }));
        onAddItems(newItems);
      } else {
        const sns = chosenRows.map((s) => String(s.sn));
        const sIds = chosenRows.map((s) => Number(s.id));
        onAddItems([
          {
            id: `gds-${Date.now()}-${selectedProduct.id}`,
            item: baseName,
            qty: sns.length,
            satuan,
            harga,
            kind: "GOODS",
            productId: Number(selectedProduct.id),
            sku: selectedProduct.sku || undefined,
            hasSerial: true,
            serialUnitIds: sIds,
            serialNumbers: sns,
            pphMode: goodsPphMode,
            tipePph: pphModeToTipe(goodsPphMode),
          },
        ]);
      }
    } else {
      const qty = Math.max(1, Number(goodsQty) || 1);
      onAddItems([
        {
          id: `gds-${Date.now()}-${selectedProduct.id}`,
          item: baseName,
          qty,
          satuan,
          harga,
          kind: "GOODS",
          productId: Number(selectedProduct.id),
          sku: selectedProduct.sku || undefined,
          hasSerial: false,
          pphMode: goodsPphMode,
          tipePph: pphModeToTipe(goodsPphMode),
        },
      ]);
    }

    handleClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent className="sm:max-w-2xl md:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tambah Item (Stok Per-SN / Jasa Non-Barang)</DialogTitle>
          </DialogHeader>

          <View className="gap-4 py-1">
            {/* Mode Switcher */}
            <View className="flex-row gap-2 p-1 rounded-xl bg-muted/40 border border-border">
              <Pressable
                onPress={() => setTab("GOODS")}
                className={`flex-1 flex-row items-center justify-center gap-2 py-2.5 px-3 rounded-lg ${
                  tab === "GOODS" ? "bg-card border border-primary/40 shadow-sm" : ""
                }`}
              >
                <Package size={15} color={tab === "GOODS" ? colors.primary : colors.muted} />
                <Text
                  className={`text-xs font-semibold ${
                    tab === "GOODS" ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  Ambil dari Data Stok & SN
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setTab("SERVICE")}
                className={`flex-1 flex-row items-center justify-center gap-2 py-2.5 px-3 rounded-lg ${
                  tab === "SERVICE" ? "bg-card border border-primary/40 shadow-sm" : ""
                }`}
              >
                <Wrench size={15} color={tab === "SERVICE" ? colors.primary : colors.muted} />
                <Text
                  className={`text-xs font-semibold ${
                    tab === "SERVICE" ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  Jasa / Non-Barang (Teks Saja)
                </Text>
              </Pressable>
            </View>

            {tab === "SERVICE" ? (
              <View className="gap-3 p-3.5 rounded-xl border border-border bg-card">
                <View className="flex-row items-center gap-2">
                  <Info size={14} color={colors.primary} />
                  <Text className="text-xs text-muted-foreground flex-1">
                    Pilih dari Katalog Master Jasa atau ketik manual untuk pemasangan, instalasi, tarik kabel, konfigurasi, atau layanan lainnya.
                  </Text>
                </View>
                {products.some((p) => p.type === "JASA" || p.jenisItem === "Jasa") ? (
                  <FormField label="Pilih dari Katalog Master Jasa (Opsional)">
                    <SearchableSelect
                      value={serviceName}
                      options={products
                        .filter((p) => p.type === "JASA" || p.jenisItem === "Jasa")
                        .map((p) => `${p.nama} (${p.sku})`)}
                      onChange={(val) => {
                        const clean = (val.split(" (")[0] ?? val).trim();
                        const found = products.find(
                          (p) => `${p.nama} (${p.sku})` === val || p.nama === clean || p.sku === clean,
                        );
                        setServiceName(found?.nama || clean);
                        if (found?.satuan) setServiceUnit(found.satuan);
                        const sPrice = found?.hargaBeli ?? found?.purchasePrice ?? found?.price ?? found?.harga ?? 0;
                        if (sPrice > 0) setServicePrice(formatThousands(sPrice));
                      }}
                      placeholder="Pilih dari katalog jasa terdaftar..."
                    />
                  </FormField>
                ) : null}
                <FormField label="Deskripsi Jasa / Pekerjaan (Atau Ketik Bebas)" required>
                  <Input
                    value={serviceName}
                    onChangeText={setServiceName}
                    placeholder="Contoh: Jasa Instalasi & Pemasangan Kamera CCTV"
                  />
                </FormField>
                <View className="flex-row gap-2">
                  <View className="w-24">
                    <FormField label="Qty">
                      <Input
                        value={serviceQty}
                        onChangeText={setServiceQty}
                        keyboardType="numeric"
                      />
                    </FormField>
                  </View>
                  <View className="w-28">
                    <FormField label="Satuan">
                      <Input
                        value={serviceUnit}
                        onChangeText={setServiceUnit}
                        placeholder="Lot / Titik"
                      />
                    </FormField>
                  </View>
                  <View className="flex-1">
                    <FormField label="Harga Satuan (Rp)">
                      <Input
                        value={servicePrice ? formatThousands(servicePrice) : ""}
                        onChangeText={(v) => setServicePrice(formatThousands(v))}
                        keyboardType="numeric"
                        placeholder="1.500.000"
                      />
                    </FormField>
                  </View>
                </View>

                <View className="gap-1.5 pt-1">
                  <Text className="text-xs text-muted-foreground font-medium">Tarif Pajak PPh Jasa</Text>
                  <View className="flex-row items-center gap-1.5 flex-wrap">
                    {([
                      { id: "none", label: "Non-PPh" },
                      { id: "pph21", label: "PPh 21 (0.5%)" },
                      { id: "pph23", label: "PPh 23 (2%)" },
                      { id: "pph4_2", label: "PPh 4(2) (1.75%)" },
                      { id: "pph22", label: "PPh 22 (1.5%)" },
                    ] as const).map((opt) => {
                      const active = servicePphMode === opt.id;
                      return (
                        <Pressable
                          key={opt.id}
                          onPress={() => setServicePphMode(opt.id)}
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
            ) : (
              <View className="gap-3.5">
                {/* Scanner Barcode Langsung (Tanpa perlu pilih produk dahulu) */}
                <View className="p-3 rounded-xl border border-primary/40 bg-primary/5 gap-2.5">
                  <View className="flex-row items-center justify-between flex-wrap gap-2">
                    <View className="flex-row items-center gap-1.5">
                      <ScanLine size={16} color={colors.primary} />
                      <Text className="text-xs font-bold text-primary">
                        Scan Barcode / SN Langsung (Auto-Pilih Produk)
                      </Text>
                    </View>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2.5 flex-row items-center gap-1 bg-background"
                      onPress={() => setMultiScanModalOpen(true)}
                    >
                      <ClipboardList size={12} color={colors.text} />
                      <Text className="text-[11px] font-medium">📋 Paste / Multi-Scan Banyak SN</Text>
                    </Button>
                  </View>

                  <View className="flex-row items-center gap-2">
                    <View className="flex-1 bg-background border border-border focus:border-primary rounded-lg flex-row items-center px-2.5 h-10">
                      <ScanLine size={15} color={colors.muted} style={{ marginRight: 6 }} />
                      <TextInput
                        ref={scanInputRef}
                        value={scanInput}
                        onChangeText={setScanInput}
                        onSubmitEditing={() => processScannedText(scanInput)}
                        placeholder="Scan barcode SN / ketik SN langsung lalu Enter..."
                        placeholderTextColor={colors.muted}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        returnKeyType="done"
                        blurOnSubmit={false}
                        style={{ flex: 1, color: colors.text, fontSize: 13, outlineStyle: "none" } as any}
                      />
                      {scanInput.trim().length > 0 && (
                        <Pressable onPress={() => setScanInput("")} hitSlop={8} className="p-1">
                          <Text className="text-xs text-muted-foreground font-bold">✕</Text>
                        </Pressable>
                      )}
                    </View>
                    <Button
                      size="sm"
                      className="h-10 px-3.5 bg-primary"
                      disabled={!scanInput.trim()}
                      onPress={() => processScannedText(scanInput)}
                    >
                      <Text className="text-xs text-white font-semibold">Scan / Select</Text>
                    </Button>
                  </View>

                  {scanFeedback && (
                    <View
                      className={`flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${
                        scanFeedback.type === "success"
                          ? "bg-emerald-500/10 border-emerald-500/30"
                          : scanFeedback.type === "warning"
                          ? "bg-amber-500/10 border-amber-500/30"
                          : "bg-danger/10 border-danger/30"
                      }`}
                    >
                      {scanFeedback.type === "success" ? (
                        <CheckCircle2 size={13} color={colors.success} />
                      ) : (
                        <AlertCircle size={13} color={scanFeedback.type === "warning" ? colors.warning : colors.danger} />
                      )}
                      <Text
                        className={`text-xs flex-1 ${
                          scanFeedback.type === "success"
                            ? "text-emerald-700 dark:text-emerald-300 font-medium"
                            : scanFeedback.type === "warning"
                            ? "text-amber-700 dark:text-amber-300 font-medium"
                            : "text-danger font-medium"
                        }`}
                      >
                        {scanFeedback.message}
                      </Text>
                      <Pressable onPress={() => setScanFeedback(null)} hitSlop={6}>
                        <Text className="text-[11px] text-muted-foreground font-bold">✕</Text>
                      </Pressable>
                    </View>
                  )}
                </View>

                <FormField label="Pilih Produk dari Master Stok" required>
                  <SearchableSelect
                    value={selectedProduct ? `${selectedProduct.nama} (${selectedProduct.sku})` : ""}
                    options={products.filter((p) => p.type !== "JASA" && p.jenisItem !== "Jasa").map((p) => `${p.nama} (${p.sku})`)}
                    onChange={handleSelectProduct}
                    placeholder="Cari / pilih kamera, NVR, perangkat, atau material..."
                  />
                </FormField>

                {selectedProduct && (
                  <View className="p-3 rounded-xl border border-border bg-card gap-3">
                    <View className="flex-row items-center justify-between flex-wrap gap-2">
                      <View className="flex-row items-center gap-2 flex-wrap">
                        <StatusBadge status={selectedProduct.sku || "SKU"} />
                        <StatusBadge
                          status={
                            selectedProduct.berSN
                              ? "Barang Ber-SN (Unik per Unit)"
                              : "Barang Non-SN"
                          }
                        />
                      </View>
                      {selectedProduct.berSN && (
                        <Button
                          size="sm"
                          variant="outline"
                          onPress={() => setBatchRegisterOpen(true)}
                        >
                          <Plus size={14} color={colors.text} />
                          <Text className="text-xs">Tambah / Registrasi SN Baru</Text>
                        </Button>
                      )}
                    </View>

                    <View className="flex-row gap-2">
                      <View className="flex-1">
                        <FormField label="Nama Tampilan di Dokumen">
                          <Input
                            value={customItemLabel}
                            onChangeText={setCustomItemLabel}
                          />
                        </FormField>
                      </View>
                      <View className="w-24">
                        <FormField label="Satuan">
                          <Input value={goodsUnit} onChangeText={setGoodsUnit} />
                        </FormField>
                      </View>
                      <View className="w-36">
                        <FormField label="Harga Satuan (Rp)">
                          <Input
                            value={goodsPrice ? formatThousands(goodsPrice) : ""}
                            onChangeText={(v) => setGoodsPrice(formatThousands(v))}
                            keyboardType="numeric"
                            placeholder="0"
                          />
                        </FormField>
                      </View>
                    </View>

                    <View className="gap-1.5">
                      <Text className="text-xs text-muted-foreground font-medium">Tarif Pajak PPh Barang</Text>
                      <View className="flex-row items-center gap-1.5 flex-wrap">
                        {([
                          { id: "none", label: "Non-PPh" },
                          { id: "pph21", label: "PPh 21 (0.5%)" },
                          { id: "pph23", label: "PPh 23 (2%)" },
                          { id: "pph4_2", label: "PPh 4(2) (1.75%)" },
                          { id: "pph22", label: "PPh 22 (1.5%)" },
                        ] as const).map((opt) => {
                          const active = goodsPphMode === opt.id;
                          return (
                            <Pressable
                              key={opt.id}
                              onPress={() => setGoodsPphMode(opt.id)}
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

                    {!selectedProduct.berSN ? (
                      <View className="w-32">
                        <FormField label="Jumlah (Qty)">
                          <Input
                            value={goodsQty}
                            onChangeText={setGoodsQty}
                            keyboardType="numeric"
                          />
                        </FormField>
                      </View>
                    ) : (
                      <View className="gap-3 pt-2 border-t border-border">
                        <View className="gap-1.5">
                          <Text className="text-xs font-semibold text-foreground">
                            Cara Memasukkan SN ke Daftar Item:
                          </Text>
                          <View className="flex-row gap-2">
                            <Pressable
                              onPress={() => setSplitMode("PER_SN")}
                              className={`flex-1 p-2.5 rounded-lg border ${
                                splitMode === "PER_SN"
                                  ? "border-primary bg-primary/10"
                                  : "border-border bg-background"
                              }`}
                            >
                              <Text
                                className={`text-xs font-bold ${
                                  splitMode === "PER_SN" ? "text-primary" : "text-foreground"
                                }`}
                              >
                                1 SN = 1 Item Sendiri (Satuan)
                              </Text>
                              <Text className="text-[11px] text-muted-foreground mt-0.5">
                                Setiap kamera dengan SN unik masuk sebagai 1 baris item tersendiri (Qty 1).
                              </Text>
                            </Pressable>
                            <Pressable
                              onPress={() => setSplitMode("COMBINED")}
                              className={`flex-1 p-2.5 rounded-lg border ${
                                splitMode === "COMBINED"
                                  ? "border-primary bg-primary/10"
                                  : "border-border bg-background"
                              }`}
                            >
                              <Text
                                className={`text-xs font-bold ${
                                  splitMode === "COMBINED" ? "text-primary" : "text-foreground"
                                }`}
                              >
                                Banyak Sekaligus (1 Baris)
                              </Text>
                              <Text className="text-[11px] text-muted-foreground mt-0.5">
                                Gabung semua SN terpilih dalam 1 baris item (Qty = {selectedSerialIds.length || "N"} unit).
                              </Text>
                            </Pressable>
                          </View>
                        </View>

                        <View className="flex-row items-end gap-2 flex-wrap">
                          <View className="flex-1 min-w-[160px]">
                            <FormField
                              label={`Daftar Unit SN (${selectedSerialIds.length > 0 ? `${selectedSerialIds.length} Terpilih · ` : ""}${availableFifoSerials.length} Di Gudang dari ${productSerials.length} unit)`}
                            >
                              <Input
                                value={snSearch}
                                onChangeText={setSnSearch}
                                placeholder="Cari nomor SN / gudang..."
                              />
                            </FormField>
                          </View>
                          <View className="w-20">
                            <FormField label="Jml FIFO">
                              <Input
                                value={fifoCountInput}
                                onChangeText={setFifoCountInput}
                                keyboardType="numeric"
                              />
                            </FormField>
                          </View>
                          <Button size="sm" variant="outline" onPress={handleAutoPickFifo}>
                            <Zap size={14} color={colors.primary} />
                            <Text className="text-xs">Pilih FIFO</Text>
                          </Button>
                          {selectedSerialIds.length > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onPress={() => setSelectedSerialIds([])}
                            >
                              <Text className="text-xs">Reset ({selectedSerialIds.length})</Text>
                            </Button>
                          )}
                        </View>

                        <ScrollView className="max-h-56 rounded-lg border border-border bg-background">
                          {productSerials.length === 0 ? (
                            <View className="p-5 items-center gap-2">
                              <Text className="text-xs text-muted-foreground text-center">
                                Belum ada unit Serial Number (SN) terdaftar untuk {selectedProduct.nama}.
                              </Text>
                              <Button
                                size="sm"
                                onPress={() => setBatchRegisterOpen(true)}
                              >
                                <Plus size={14} color={colors.background} />
                                <Text className="text-xs">Tambah Daftar SN Sekarang</Text>
                              </Button>
                            </View>
                          ) : (
                            productSerials.map((snRow, idx) => {
                              const idNum = Number(snRow.id);
                              const checked = selectedSerialIds.includes(idNum);
                              const avail = getSerialAvailability(snRow);
                              return (
                                <Pressable
                                  key={snRow.id}
                                  disabled={!avail.selectable}
                                  onPress={() => toggleSerial(idNum)}
                                  className={`flex-row items-center justify-between px-3 py-2.5 border-b border-border ${
                                    checked
                                      ? "bg-primary/10"
                                      : !avail.selectable
                                      ? "opacity-50 bg-muted/20"
                                      : ""
                                  }`}
                                >
                                  <View className="flex-row items-center gap-2.5 flex-1">
                                    <View
                                      className={`w-4 h-4 rounded items-center justify-center border ${
                                        checked
                                          ? "bg-primary border-primary"
                                          : "border-border"
                                      }`}
                                    >
                                      {checked && <Check size={11} color="#ffffff" />}
                                    </View>
                                    <View className="flex-1">
                                      <View className="flex-row items-center gap-2">
                                        <Text className="text-xs font-mono font-bold text-foreground">
                                          {snRow.sn}
                                        </Text>
                                        <Text className="text-[10px] text-muted-foreground">
                                          #{idx + 1} · {snRow.gudang || "Gudang Utama"}
                                        </Text>
                                      </View>
                                    </View>
                                  </View>
                                  <StatusBadge status={avail.badge} />
                                </Pressable>
                              );
                            })
                          )}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>

          <DialogFooter>
            <Button variant="outline" onPress={handleClose}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleConfirmAdd}>
              <Plus size={15} color={colors.background} />
              <Text>
                {tab === "SERVICE"
                  ? "Tambah Jasa / Non-Barang"
                  : selectedProduct?.berSN
                  ? splitMode === "PER_SN"
                    ? `Tambah ${selectedSerialIds.length} Item per-SN`
                    : `Tambah 1 Baris (${selectedSerialIds.length} SN)`
                  : "Tambah Barang Stok"}
              </Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedProduct && (
        <BatchSerialRegisterModal
          open={batchRegisterOpen}
          onClose={() => setBatchRegisterOpen(false)}
          defaultProductId={String(selectedProduct.id)}
          onSuccess={async (createdUnits) => {
            await reload();
            if (Array.isArray(createdUnits) && createdUnits.length > 0) {
              const newIds = createdUnits
                .map((u: any) => Number(u.id))
                .filter((n) => !Number.isNaN(n));
              setSelectedSerialIds((prev) => Array.from(new Set([...prev, ...newIds])));
            }
          }}
        />
      )}

      {/* Dialog Multi-Scan / Paste SN Sekaligus */}
      <Dialog open={multiScanModalOpen} onOpenChange={setMultiScanModalOpen}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle className="flex-row items-center gap-2">
              <ScanLine size={18} color={colors.primary} />
              <Text className="text-base font-bold text-foreground">
                Multi-Scan / Paste Daftar SN Sekaligus
              </Text>
            </DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <Text className="text-xs text-muted-foreground">
              Scan barcode satu per satu secara beruntun (scanner otomatis enter), atau paste daftar SN yang disalin dari dokumen/catatan fisik:
            </Text>
            <Textarea
              value={multiScanText}
              onChangeText={setMultiScanText}
              placeholder={`Contoh:\nUNV-0001\nUNV-0002\nUNV-0003`}
              numberOfLines={6}
              style={{ minHeight: 120, fontFamily: "monospace", fontSize: 12 }}
            />
            {multiScanAnalysis && (
              <View className="bg-panel/70 border border-border/80 rounded-lg p-2.5 gap-2">
                <View className="flex-row items-center gap-1.5 flex-wrap">
                  <View className="bg-primary/10 px-2 py-0.5 rounded">
                    <Text className="text-[11px] font-bold text-primary">
                      {multiScanAnalysis.tokens.length} Total SN
                    </Text>
                  </View>
                  <View className="bg-emerald-500/10 px-2 py-0.5 rounded">
                    <Text className="text-[11px] font-bold text-emerald-600">
                      {multiScanAnalysis.matchedAvailable.length} Cocok & Siap Select
                    </Text>
                  </View>
                  {multiScanAnalysis.alreadySelected.length > 0 && (
                    <View className="bg-muted px-2 py-0.5 rounded">
                      <Text className="text-[11px] text-muted-foreground">
                        {multiScanAnalysis.alreadySelected.length} Sudah terpilih
                      </Text>
                    </View>
                  )}
                  {multiScanAnalysis.notFound.length > 0 && (
                    <View className="bg-danger/10 px-2 py-0.5 rounded">
                      <Text className="text-[11px] font-bold text-danger">
                        {multiScanAnalysis.notFound.length} Tidak ada di stok
                      </Text>
                    </View>
                  )}
                  {multiScanAnalysis.unavailable.length > 0 && (
                    <View className="bg-amber-500/10 px-2 py-0.5 rounded">
                      <Text className="text-[11px] font-bold text-amber-600">
                        {multiScanAnalysis.unavailable.length} Tidak tersedia
                      </Text>
                    </View>
                  )}
                </View>

                {multiScanAnalysis.matchedAvailable.length > 0 && (
                  <Text className="text-[11px] text-emerald-600 font-medium">
                    ✓ Klik &quot;Terapkan Selection&quot; untuk langsung memilih semua unit ini.
                  </Text>
                )}
              </View>
            )}
          </View>
          <DialogFooter className="flex-row justify-end gap-2">
            <Button variant="outline" onPress={() => setMultiScanModalOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button
              className="bg-primary"
              disabled={!multiScanAnalysis || multiScanAnalysis.matchedAvailable.length === 0}
              onPress={() => {
                if (multiScanAnalysis && multiScanAnalysis.matchedAvailable.length > 0) {
                  const newSet = new Set(selectedSerialIds);
                  multiScanAnalysis.matchedAvailable.forEach((id) => newSet.add(id));
                  setSelectedSerialIds(Array.from(newSet));
                  playScanBeep(true);
                  toast(`${multiScanAnalysis.matchedAvailable.length} unit SN berhasil diselect.`);
                  setMultiScanText("");
                  setMultiScanModalOpen(false);
                }
              }}
            >
              <Text className="text-white font-semibold">
                Terapkan Selection ({multiScanAnalysis?.matchedAvailable.length ?? 0} SN)
              </Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type BatchModalProps = {
  open: boolean;
  onClose: () => void;
  defaultProductId?: string;
  onSuccess?: (createdUnits: any[]) => void;
};

export function BatchSerialRegisterModal({
  open,
  onClose,
  defaultProductId,
  onSuccess,
}: BatchModalProps) {
  const { data, reload, toast } = useApp();

  const serialProducts = React.useMemo(
    () => ((data.products ?? []) as any[]).filter((p) => p.berSN || p.hasSerial),
    [data.products],
  );
  const warehouses = React.useMemo(() => (data.warehouses ?? []) as any[], [data.warehouses]);

  const [productId, setProductId] = React.useState<string>(defaultProductId || "");
  const [warehouseId, setWarehouseId] = React.useState<string>(
    warehouses[0]?.id ? String(warehouses[0].id) : "1",
  );
  const [genPrefix, setGenPrefix] = React.useState(() => {
    const found = serialProducts.find((p) => String(p.id) === String(defaultProductId));
    return found?.sku ? `${found.sku}-` : "UNV-CAM-";
  });
  const [genCount, setGenCount] = React.useState("10");
  const [snText, setSnText] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const selectedProduct = React.useMemo(
    () => serialProducts.find((p) => String(p.id) === String(productId)) ?? null,
    [serialProducts, productId],
  );

  const parsedSnList = React.useMemo(() => {
    return Array.from(
      new Set(
        snText
          .split(/[\n,;]+/)
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    );
  }, [snText]);

  const handleAutoGenerate = () => {
    const cnt = Math.min(200, Math.max(1, parseInt(genCount, 10) || 10));
    const skuPrefix =
      genPrefix.trim() ||
      (selectedProduct?.sku ? `${selectedProduct.sku}-` : "SN-");
    const stamp = Date.now().toString().slice(-4);
    const generated: string[] = [];
    for (let i = 1; i <= cnt; i++) {
      generated.push(`${skuPrefix}${stamp}-${String(i).padStart(3, "0")}`);
    }
    setSnText((prev) =>
      prev.trim() ? `${prev.trim()}\n${generated.join("\n")}` : generated.join("\n"),
    );
  };

  const handleSaveBatch = async () => {
    const pid = Number(productId || selectedProduct?.id);
    if (!pid) {
      toast("Pilih produk ber-SN terlebih dahulu.", "danger");
      return;
    }
    if (parsedSnList.length === 0) {
      toast("Masukkan minimal 1 Serial Number (SN).", "danger");
      return;
    }
    const wid = Number(warehouseId || warehouses[0]?.id || 1);
    setSaving(true);
    try {
      const res = await api<any>("POST", "/serials/batch", {
        productId: pid,
        warehouseId: wid,
        serials: parsedSnList,
      });
      await reload();
      toast(
        `Berhasil menambahkan ${res?.createdCount ?? parsedSnList.length} unit SN untuk ${selectedProduct?.nama || "produk"}.`,
      );
      setSnText("");
      onSuccess?.(res?.items ?? []);
      onClose();
    } catch (e: any) {
      toast(e?.message || "Gagal menyimpan daftar SN", "danger");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tambah Daftar Barang per-SN (Multi-Unit Sekaligus)</DialogTitle>
        </DialogHeader>

        <View className="gap-3.5 py-1">
          <View className="p-3 rounded-xl bg-primary/10 border border-primary/30">
            <Text className="text-xs text-foreground">
              Setiap Serial Number (SN) yang Anda masukkan di bawah akan tercatat sebagai 1 unit item tersendiri di dalam daftar stok produk (contoh: 10 kamera UNV dengan 10 SN berbeda).
            </Text>
          </View>

          <View className="flex-row gap-2">
            <View className="flex-1">
              <FormField label="Produk Ber-SN" required>
                <SearchableSelect
                  value={selectedProduct ? `${selectedProduct.nama} (${selectedProduct.sku})` : ""}
                  options={serialProducts.map((p) => `${p.nama} (${p.sku})`)}
                  onChange={(val) => {
                    const found = serialProducts.find(
                      (p) => `${p.nama} (${p.sku})` === val || p.nama === val,
                    );
                    if (found) {
                      setProductId(String(found.id));
                      setGenPrefix(`${found.sku || "SN"}-`);
                    }
                  }}
                  placeholder="Pilih produk kamera / perangkat ber-SN..."
                />
              </FormField>
            </View>
            <View className="w-44">
              <FormField label="Lokasi Gudang" required>
                <SearchableSelect
                  value={
                    warehouses.find((w) => String(w.id) === String(warehouseId))?.nama ||
                    warehouses[0]?.nama ||
                    ""
                  }
                  options={warehouses.map((w) => String(w.nama))}
                  onChange={(val) => {
                    const found = warehouses.find((w) => w.nama === val);
                    if (found) setWarehouseId(String(found.id));
                  }}
                />
              </FormField>
            </View>
          </View>

          <View className="p-3 rounded-xl border border-border bg-card gap-2">
            <Text className="text-xs font-semibold text-foreground">
              Bantuan Generate Cepat (Opsional):
            </Text>
            <View className="flex-row items-end gap-2">
              <View className="flex-1">
                <FormField label="Prefix SN">
                  <Input
                    value={genPrefix}
                    onChangeText={setGenPrefix}
                    placeholder="UNV-IPC-"
                  />
                </FormField>
              </View>
              <View className="w-24">
                <FormField label="Jumlah Unit">
                  <Input
                    value={genCount}
                    onChangeText={setGenCount}
                    keyboardType="numeric"
                  />
                </FormField>
              </View>
              <Button size="sm" variant="outline" onPress={handleAutoGenerate}>
                <Zap size={14} color={colors.primary} />
                <Text className="text-xs">Buat {genCount || 10} SN</Text>
              </Button>
            </View>
          </View>

          <FormField
            label={`Daftar Serial Number (1 baris = 1 unit item SN) • ${parsedSnList.length} Unit siap disimpan`}
            required
          >
            <Textarea
              value={snText}
              onChangeText={setSnText}
              placeholder={
                "Ketik atau tempel (paste) daftar SN di sini, pisahkan dengan baris baru (Enter) atau koma:\nUNV-CAM-001\nUNV-CAM-002\nUNV-CAM-003"
              }
              numberOfLines={6}
            />
          </FormField>
        </View>

        <DialogFooter>
          <Button variant="outline" onPress={onClose}>
            <Text>Batal</Text>
          </Button>
          <Button disabled={saving} onPress={handleSaveBatch}>
            <Check size={15} color={colors.background} />
            <Text>{saving ? "Menyimpan..." : `Simpan ${parsedSnList.length} Unit SN`}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ConflictAndSwapBanner({ row }: { row: any }) {
  const hasConflict = !!row?.stockConflictFlag;
  const conflictMsg = row?.stockConflictMessage;
  const emergencyPrNumber = row?.emergencyPrNumber;
  const swapLogs: any[] = Array.isArray(row?.autoSwapLogs) ? row.autoSwapLogs : [];

  if (!hasConflict && swapLogs.length === 0) return null;

  return (
    <View className="gap-2.5 mb-3">
      {hasConflict && (
        <View className="p-3.5 rounded-xl border border-rose-500/50 bg-rose-500/10 gap-1.5">
          <View className="flex-row items-center justify-between flex-wrap gap-2">
            <View className="flex-row items-center gap-2">
              <TriangleAlert size={16} color="#e11d48" />
              <Text className="text-xs font-bold text-rose-500">
                FLAG KONFLIK STOK SN — STOK PENGGANTI HABIS
              </Text>
            </View>
            {emergencyPrNumber ? (
              <StatusBadge status={`Auto-PR Darurat: ${emergencyPrNumber}`} />
            ) : null}
          </View>
          <Text className="text-xs text-foreground leading-relaxed">
            {conflictMsg ||
              "Unit SN pada dokumen ini telah terpakai oleh Invoice lain yang sudah Lunas, dan stok SN pengganti model yang sama sedang kosong di gudang. Sistem telah membuat Request Pembelian (PR) Darurat secara otomatis."}
          </Text>
        </View>
      )}

      {swapLogs.length > 0 && (
        <View className="p-3 rounded-xl border border-amber-500/50 bg-amber-500/10 gap-1.5">
          <View className="flex-row items-center gap-2">
            <RefreshCw size={14} color="#f59e0b" />
            <Text className="text-xs font-bold text-amber-500">
              Riwayat Auto-Swap SN Otomatis (FIFO Anti-Tabrakan)
            </Text>
          </View>
          {swapLogs.slice(-5).map((log, i) => (
            <View key={i} className="flex-row items-start gap-1.5 pl-1">
              <Text className="text-[11px] text-amber-500">•</Text>
              <Text className="text-[11px] text-foreground flex-1">
                <Text className="font-semibold">{log.productName || "Produk"}</Text>: SN{" "}
                <Text className="font-mono font-bold line-through text-muted-foreground">
                  {log.oldSn}
                </Text>{" "}
                {log.newSn ? (
                  <>
                    diganti otomatis secara FIFO ke SN{" "}
                    <Text className="font-mono font-bold text-emerald-500">
                      {log.newSn}
                    </Text>
                  </>
                ) : (
                  <Text className="font-bold text-rose-500">
                    (Stok Habis — Menunggu PR {log.emergencyPrNumber || "Darurat"})
                  </Text>
                )}{" "}
                karena Invoice {log.triggeredByInvoice} telah dibayar lunas.
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

