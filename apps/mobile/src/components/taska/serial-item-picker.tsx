import * as React from "react";
import { View, Pressable, ScrollView } from "react-native";
import {
  Package,
  Wrench,
  Plus,
  Check,
  Zap,
  RefreshCw,
  TriangleAlert,
  Info,
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
import type { QuotationItem } from "@/modules/quotation/types";

type Props = {
  open: boolean;
  onClose: () => void;
  onAddItems: (items: QuotationItem[]) => void;
  currentInvoiceId?: string | number | null;
  currentQuotationId?: string | number | null;
};

export function SerialItemPickerModal({
  open,
  onClose,
  onAddItems,
  currentInvoiceId,
  currentQuotationId,
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

  // Service tab states
  const [serviceName, setServiceName] = React.useState("");
  const [serviceQty, setServiceQty] = React.useState("1");
  const [serviceUnit, setServiceUnit] = React.useState("Lot");
  const [servicePrice, setServicePrice] = React.useState("");

  // Quick batch register modal inside picker
  const [batchRegisterOpen, setBatchRegisterOpen] = React.useState(false);

  React.useEffect(() => {
    if (open && refreshModule) {
      void Promise.all([refreshModule("products"), refreshModule("serials"), refreshModule("warehouses")]);
    }
  }, [open, refreshModule]);

  const products = React.useMemo(() => (data.products ?? []) as any[], [data.products]);
  const serials = React.useMemo(() => (data.serials ?? []) as any[], [data.serials]);

  const selectedProduct = React.useMemo(
    () => products.find((p) => String(p.id) === String(selectedProductId)) ?? null,
    [products, selectedProductId],
  );

  // Filter SNs for selected product, sorted FIFO (ID ascending)
  const productSerials = React.useMemo(() => {
    if (!selectedProduct) return [];
    const list = serials
      .filter(
        (s) =>
          String(s.productId) === String(selectedProduct.id) ||
          (s.sku && selectedProduct.sku && String(s.sku) === String(selectedProduct.sku)) ||
          (s.produk && selectedProduct.nama && String(s.produk) === String(selectedProduct.nama)),
      )
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

  const getSerialAvailability = React.useCallback(
    (snRow: any) => {
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
    [currentInvoiceId, currentQuotationId],
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
    setGoodsUnit(found.satuan || "Unit");
    setGoodsPrice(String(found.hargaBeli || 0));
    setCustomItemLabel(found.nama || "");
  };

  const toggleSerial = (id: number) => {
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

  const handleConfirmAdd = () => {
    if (tab === "SERVICE") {
      if (!serviceName.trim()) {
        toast("Masukkan nama jasa / pekerjaan terlebih dahulu.", "danger");
        return;
      }
      const qty = Math.max(1, Number(serviceQty) || 1);
      const harga = Math.max(0, Number(String(servicePrice).replace(/[^\d.-]/g, "")) || 0);
      onAddItems([
        {
          id: `srv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          item: serviceName.trim(),
          qty,
          satuan: serviceUnit.trim() || "Lot",
          harga,
          kind: "SERVICE",
          hasSerial: false,
        },
      ]);
      setServiceName("");
      setServiceQty("1");
      setServicePrice("");
      onClose();
      return;
    }

    if (!selectedProduct) {
      toast("Pilih produk dari daftar stok terlebih dahulu.", "danger");
      return;
    }

    const harga = Math.max(0, Number(String(goodsPrice).replace(/[^\d.-]/g, "")) || 0);
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
        },
      ]);
    }

    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
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
                    Gunakan mode ini untuk pemasangan, instalasi, tarik kabel, konfigurasi, atau biaya jasa lainnya yang bukan barang stok.
                  </Text>
                </View>
                <FormField label="Deskripsi Jasa / Pekerjaan" required>
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
                        value={servicePrice}
                        onChangeText={setServicePrice}
                        keyboardType="numeric"
                        placeholder="1500000"
                      />
                    </FormField>
                  </View>
                </View>
              </View>
            ) : (
              <View className="gap-3.5">
                <FormField label="Pilih Produk dari Master Stok" required>
                  <SearchableSelect
                    value={selectedProduct ? `${selectedProduct.nama} (${selectedProduct.sku})` : ""}
                    options={products.map((p) => `${p.nama} (${p.sku})`)}
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
                            value={goodsPrice}
                            onChangeText={setGoodsPrice}
                            keyboardType="numeric"
                          />
                        </FormField>
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
                              label={`Daftar Unit SN (${availableFifoSerials.length} Di Gudang dari ${productSerials.length} unit)`}
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
            <Button variant="outline" onPress={onClose}>
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
  const [genPrefix, setGenPrefix] = React.useState("UNV-CAM-");
  const [genCount, setGenCount] = React.useState("10");
  const [snText, setSnText] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (defaultProductId) {
      setProductId(defaultProductId);
      const found = serialProducts.find((p) => String(p.id) === String(defaultProductId));
      if (found?.sku) setGenPrefix(`${found.sku}-`);
    }
  }, [defaultProductId, serialProducts]);

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
        sns: parsedSnList,
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

