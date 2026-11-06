import * as React from "react";
import { View, ScrollView, Pressable } from "react-native";
import { Plus, Trash2, Package, Check, Layers, AlertCircle, ShoppingCart, Sparkles, Building2, Settings, FileText } from "lucide-react-native";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/taska/basics";
import { SearchableSelect, DatePicker, QuickAddSupplierDialog, formatThousands } from "@/components/taska/dialogs";
import { FileUploader, type FileUploaderHandle } from "@/components/taska/file-uploader";
import { StatusBadge } from "@/components/taska/status-badge";
import { SupplierPaymentTermsDialog } from "@/modules/supplier-po/supplier-payment-terms-dialog";
import { PPH_MODE_OPTIONS, pphRateFor, pphModeToTipe, type PphMode } from "@/modules/quotation/lib";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { rupiah } from "@/lib/format";
import type { Row } from "@/constants/modules";

export interface PoItemEntry {
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
  sellPrice?: number;
  isNewItem?: boolean;
  isNonInventory?: boolean;
  itemType?: "JASA" | "NON_STOK" | "BARANG";
  pphMode?: PphMode;
  pph?: number;
}

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDefaultEtaIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().slice(0, 10);
}

export function CreateSupplierPoDialog({
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
      <CreateSupplierPoForm onClose={() => onOpenChange(false)} onSuccess={onSuccess} />
    </Dialog>
  );
}

function CreateSupplierPoForm({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { data, addRow, reload, toast, pushHistory } = useApp();

  // Document fields
  const [nomor, setNomor] = React.useState<string>("");
  const [nomorSoSupplier, setNomorSoSupplier] = React.useState<string>("");
  const [supplierId, setSupplierId] = React.useState<string>("");
  const [supplierName, setSupplierName] = React.useState<string>("");
  const [quickSupplierOpen, setQuickSupplierOpen] = React.useState<boolean>(false);

  const [paymentTerms, setPaymentTerms] = React.useState<string>("Net 30");
  const [paymentTermsOptions, setPaymentTermsOptions] = React.useState<string[]>([
    "Tunai",
    "Net 14",
    "Net 30",
    "Net 60",
    "COD",
    "DP 50%, Pelunasan 50%",
  ]);
  const [termsDialogOpen, setTermsDialogOpen] = React.useState<boolean>(false);
  const [tanggal, setTanggal] = React.useState<string>(getTodayIso);
  const [eta, setEta] = React.useState<string>(getDefaultEtaIso);
  const [projectId, setProjectId] = React.useState<string>("");

  // Load payment terms from settings
  React.useEffect(() => {
    if (!open) return;
    let isMounted = true;
    void (async () => {
      try {
        const res = await api<any[]>("GET", "/settings");
        if (Array.isArray(res) && isMounted) {
          const item = res.find((s) => s.key === "supplier.payment.terms");
          if (item?.value) {
            try {
              const parsed = JSON.parse(item.value);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setPaymentTermsOptions(parsed);
                return;
              }
            } catch {}
          }
        }
      } catch (err) {
        console.warn("Failed to fetch supplier payment terms:", err);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [open]);

  // Upload files
  const [fileId, setFileId] = React.useState<number | null>(null);
  const [soFileId, setSoFileId] = React.useState<number | null>(null);

  // Items
  const [items, setItems] = React.useState<PoItemEntry[]>([]);

  // Item Picker Mode & State
  const [addItemMode, setAddItemMode] = React.useState<"master" | "new" | "service">("master");
  const [isAddingItem, setIsAddingItem] = React.useState<boolean>(true);

  // Master product picker state
  const [selectedProductId, setSelectedProductId] = React.useState<string>("");
  const [masterQty, setMasterQty] = React.useState<string>("1");
  const [masterPrice, setMasterPrice] = React.useState<string>("");

  // New item input state
  const [newName, setNewName] = React.useState<string>("");
  const [newHasSerial, setNewHasSerial] = React.useState<boolean>(false);
  const [newCategoryId, setNewCategoryId] = React.useState<string>("");
  const [newUnit, setNewUnit] = React.useState<string>("unit");
  const [newQty, setNewQty] = React.useState<string>("1");
  const [newPrice, setNewPrice] = React.useState<string>("");
  const [newSellPrice, setNewSellPrice] = React.useState<string>("");

  // Non-inventory / Service item state
  const [serviceType, setServiceType] = React.useState<"JASA" | "NON_STOK">("JASA");
  const [serviceName, setServiceName] = React.useState<string>("");
  const [serviceUnit, setServiceUnit] = React.useState<string>("paket");
  const [serviceQty, setServiceQty] = React.useState<string>("1");
  const [servicePrice, setServicePrice] = React.useState<string>("");
  const [servicePphMode, setServicePphMode] = React.useState<PphMode>("pph23");

  // Tax mode
  const [ppnMode, setPpnMode] = React.useState<"none" | "exclude" | "include">("none");

  // Submitting
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

  // Supplier options
  const supplierOptions = React.useMemo(() => {
    return (data.suppliers ?? []).map((s: Row) => ({
      id: String(s.id),
      name: s.nama || s.name || `Supplier #${s.id}`,
    }));
  }, [data.suppliers]);

  // Project options
  const projectOptions = React.useMemo(() => {
    return (data.projects ?? []).map((p: Row) => ({
      id: String(p.id),
      label: `${p.nama || p.name} — ${p.customer || "-"}`,
      name: p.nama || p.name,
    }));
  }, [data.projects]);

  // Product categories
  const categoryOptions = React.useMemo(() => {
    return (data.productCategories ?? []).map((c: Row) => ({
      id: String(c.id),
      name: c.nama || c.name || "Kategori",
    }));
  }, [data.productCategories]);

  // Selected product object from master
  const selectedProductObj = React.useMemo(() => {
    if (!selectedProductId) return null;
    return (data.products ?? []).find((p: Row) => String(p.id) === String(selectedProductId)) || null;
  }, [data.products, selectedProductId]);

  // Handle master product selected
  function handleSelectMasterProduct(prodId: string) {
    setSelectedProductId(prodId);
    const prod = (data.products ?? []).find((p: Row) => String(p.id) === String(prodId));
    if (prod) {
      const defaultCost = Number(prod.hargaBeli ?? prod.purchasePrice ?? 0);
      if (defaultCost > 0) {
        setMasterPrice(formatThousands(defaultCost));
      } else {
        setMasterPrice("");
      }
    }
  }

  // Add item from master
  function handleAddFromMaster() {
    if (!selectedProductObj) {
      toast("Pilih barang dari master stok terlebih dahulu", "danger");
      return;
    }
    const q = Number(String(masterQty).replace(/\D/g, "")) || 0;
    if (q <= 0) {
      toast("Jumlah kuantitas (Qty) harus lebih dari 0", "danger");
      return;
    }
    const p = Number(String(masterPrice).replace(/\D/g, "")) || 0;

    const newItem: PoItemEntry = {
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
      isNewItem: false,
    };

    setItems((prev) => [...prev, newItem]);
    setSelectedProductId("");
    setMasterQty("1");
    setMasterPrice("");
  }

  // Add new item (not yet in master)
  function handleAddNewItem() {
    const trimmedName = newName.trim();
    if (!trimmedName) {
      toast("Nama barang baru wajib diisi", "danger");
      return;
    }
    const q = Number(String(newQty).replace(/\D/g, "")) || 0;
    if (q <= 0) {
      toast("Jumlah kuantitas (Qty) harus lebih dari 0", "danger");
      return;
    }
    const p = Number(String(newPrice).replace(/\D/g, "")) || 0;
    const sp = Number(String(newSellPrice).replace(/\D/g, "")) || 0;

    const catObj = (data.productCategories ?? []).find((c: Row) => String(c.id) === String(newCategoryId));

    const newItem: PoItemEntry = {
      id: `new-${Date.now()}-${Math.random()}`,
      name: trimmedName,
      unit: newUnit.trim() || "unit",
      hasSerial: newHasSerial,
      categoryId: newCategoryId || undefined,
      categoryName: catObj?.nama || catObj?.name || undefined,
      qty: q,
      price: p,
      sellPrice: sp > 0 ? sp : undefined,
      isNewItem: true,
    };

    setItems((prev) => [...prev, newItem]);
    setNewName("");
    setNewQty("1");
    setNewPrice("");
    setNewSellPrice("");
  }

  // Add non-inventory / service item
  function handleAddServiceItem() {
    const trimmedName = serviceName.trim();
    if (!trimmedName) {
      toast(serviceType === "JASA" ? "Nama jasa / pekerjaan wajib diisi" : "Nama barang non-stok wajib diisi", "danger");
      return;
    }
    const q = Number(String(serviceQty).replace(/\D/g, "")) || 0;
    if (q <= 0) {
      toast("Jumlah kuantitas (Qty) harus lebih dari 0", "danger");
      return;
    }
    const p = Number(String(servicePrice).replace(/\D/g, "")) || 0;
    const itemSubtotal = q * p;
    const itemPphRate = serviceType === "JASA" ? pphRateFor(servicePphMode) : 0;
    const itemPph = Math.round(itemSubtotal * itemPphRate);

    const newItem: PoItemEntry = {
      id: `service-${Date.now()}-${Math.random()}`,
      name: trimmedName,
      unit: serviceUnit.trim() || (serviceType === "JASA" ? "paket" : "unit"),
      hasSerial: false,
      qty: q,
      price: p,
      isNewItem: false,
      isNonInventory: true,
      itemType: serviceType,
      pphMode: serviceType === "JASA" ? servicePphMode : "none",
      pph: itemPph,
    };

    setItems((prev) => [...prev, newItem]);
    setServiceName("");
    setServiceQty("1");
    setServicePrice("");
  }

  // Remove item
  function handleRemoveItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  // Calculations
  const subtotalDpp = React.useMemo(() => {
    return items.reduce((sum, item) => sum + item.qty * item.price, 0);
  }, [items]);

  const ppnAmount = React.useMemo(() => {
    if (ppnMode === "none") return 0;
    if (ppnMode === "include") return Math.max(0, subtotalDpp - Math.round(subtotalDpp / 1.11));
    return Math.round(subtotalDpp * 0.11);
  }, [subtotalDpp, ppnMode]);

  const effectiveDpp = React.useMemo(() => {
    return ppnMode === "include" ? Math.max(0, subtotalDpp - ppnAmount) : subtotalDpp;
  }, [subtotalDpp, ppnAmount, ppnMode]);

  const totalPphJasa = React.useMemo(() => {
    return items.reduce((sum, item) => sum + (item.pph || 0), 0);
  }, [items]);

  const grandTotal = React.useMemo(() => {
    const baseWithPpn = ppnMode === "include" || ppnMode === "none" ? subtotalDpp : subtotalDpp + ppnAmount;
    return Math.max(0, baseWithPpn - totalPphJasa);
  }, [subtotalDpp, ppnAmount, ppnMode, totalPphJasa]);

  // Submit PO
  async function handleSubmit() {
    if (!supplierId && !supplierName) {
      toast("Supplier wajib dipilih", "danger");
      return;
    }
    if (items.length === 0) {
      toast("Tambahkan minimal 1 barang ke daftar PO", "danger");
      return;
    }
    if (grandTotal <= 0) {
      toast("Total nilai PO harus lebih dari Rp 0", "danger");
      return;
    }

    setIsSubmitting(true);
    try {
      const finalItemsPayload: any[] = [];

      // 1. Process items: If item is new & not non-inventory, register to master products first!
      for (const item of items) {
        let finalProdId = item.productId;

        if (!item.isNonInventory && (item.isNewItem || !finalProdId)) {
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
            hargaBeli: item.price,
            purchasePrice: item.price,
            price: item.sellPrice || item.price,
            status: "AKTIF",
          }).catch(() => null);

          if (createdProduct?.id) {
            finalProdId = String(createdProduct.id);
          }
        }

        finalItemsPayload.push({
          productId: finalProdId ? Number(finalProdId) : undefined,
          customName: item.name,
          customUnit: item.unit,
          qty: item.qty,
          price: item.price,
          hasSerial: item.hasSerial,
          isNonInventory: item.isNonInventory,
          itemType: item.itemType,
          pphMode: item.pphMode,
          pph: item.pph,
        });
      }

      const primaryPphItem = items.find((it) => it.pphMode && it.pphMode !== "none");
      const dominantPphMode: PphMode = primaryPphItem?.pphMode ?? "none";

      // 2. Submit Supplier PO
      const createdPo = await addRow("supplier-pos", {
        nomor: nomor.trim() || undefined,
        nomorSoSupplier: nomorSoSupplier.trim() || undefined,
        supplierId: supplierId || undefined,
        supplier: supplierName || undefined,
        payment: paymentTerms,
        paymentTerms,
        tanggal,
        date: tanggal,
        eta,
        projectId: projectId || undefined,
        total: grandTotal,
        dpp: effectiveDpp,
        ppn: ppnAmount,
        ppnMode,
        pph: totalPphJasa,
        pphMode: dominantPphMode,
        tipePph: pphModeToTipe(dominantPphMode),
        fileId: fileId || undefined,
        soFileId: soFileId || undefined,
        items: finalItemsPayload,
      });

      if (createdPo) {
        const poNumber = createdPo.nomor || createdPo.number || nomor || "Baru";
        pushHistory("supplier-pos", createdPo.id, `PO Pembelian ${poNumber} (${rupiah(grandTotal)}) dibuat dengan ${items.length} item barang`);
        toast(`Purchase Order ${poNumber} berhasil dibuat dengan ${items.length} item barang!`);
        onClose();
        await reload();
        onSuccess?.();
      }
    } catch (e: any) {
      toast(e?.message ?? "Gagal membuat Purchase Order (PO)", "danger");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <DialogContent className="w-[96vw] max-w-4xl max-h-[92vh]">
        <DialogHeader>
          <View className="flex-row items-center gap-2.5">
            <View className="p-2 bg-primary/10 rounded-xl">
              <ShoppingCart size={18} color={colors.primary} />
            </View>
            <DialogTitle>Buat Purchase Order (PO) Supplier</DialogTitle>
          </View>
        </DialogHeader>

        <ScrollView className="max-h-[75vh] px-1" showsVerticalScrollIndicator={false}>
          <View className="gap-4 pb-4">
            {/* 1. Header & General Info */}
            <View className="p-3.5 rounded-xl bg-card border border-border gap-3.5">
              <View className="flex-row items-center gap-2 pb-1 border-b border-border/50">
                <Building2 size={15} color={colors.primary} />
                <Text className="text-xs font-bold text-foreground">Data Pembelian & Supplier</Text>
              </View>

              {/* Baris 1: Supplier & Syarat Pembayaran */}
              <View className="flex-col sm:flex-row gap-3">
                <View className="flex-1">
                  <FormField label="Pilih Supplier" required hint="Pemasok / vendor tujuan pemesanan">
                    <SearchableSelect
                      value={supplierName}
                      options={supplierOptions.map((s) => s.name)}
                      onChange={(val) => {
                        setSupplierName(val);
                        const match = (data.suppliers ?? []).find(
                          (s: Row) => (s.nama || s.name) === val || String(s.id) === String(val)
                        );
                        if (match) {
                          setSupplierId(String(match.id));
                          const supTerm = match.payment || match.paymentTerms || match.syaratPembayaran;
                          if (supTerm) {
                            setPaymentTerms(supTerm);
                            if (!paymentTermsOptions.includes(supTerm)) {
                              setPaymentTermsOptions((prev) => [...prev, supTerm]);
                            }
                          }
                        } else {
                          setSupplierId("");
                        }
                      }}
                      onAddNew={() => setQuickSupplierOpen(true)}
                      addNewLabel="+ Tambah Supplier Baru"
                      placeholder="Cari & pilih supplier..."
                    />
                  </FormField>
                </View>

                <View className="flex-1">
                  <FormField
                    label={
                      <View className="flex-row items-center justify-between">
                        <Text className="text-sm font-medium">
                          Syarat Pembayaran<Text className="text-danger"> *</Text>
                        </Text>
                        <Pressable
                          onPress={() => setTermsDialogOpen(true)}
                          className="flex-row items-center gap-1 px-2 py-0.5 rounded-md bg-panel border border-border/70 hover:border-primary/50 active:opacity-70"
                        >
                          <Settings size={11} color={colors.primary} />
                          <Text className="text-[11px] font-semibold text-primary">Kelola Opsi</Text>
                        </Pressable>
                      </View>
                    }
                    hint="Ketentuan pembayaran ke supplier"
                  >
                    <SearchableSelect
                      value={paymentTerms}
                      options={paymentTermsOptions}
                      onChange={setPaymentTerms}
                      onAddNew={() => setTermsDialogOpen(true)}
                      addNewLabel="+ Kelola / Tambah Syarat Pembayaran"
                      placeholder="Pilih syarat pembayaran..."
                    />
                  </FormField>
                </View>
              </View>

              {/* Baris 2: Nomor PO & Nomor SO Supplier */}
              <View className="flex-col sm:flex-row gap-3">
                <View className="flex-1">
                  <FormField label="Nomor PO (Opsional)" hint="Kosongkan untuk nomor otomatis sistem">
                    <Input
                      value={nomor}
                      onChangeText={setNomor}
                      placeholder="Otomatis (contoh: PO/2026/11/001)"
                    />
                  </FormField>
                </View>

                <View className="flex-1">
                  <FormField label="Nomor SO Supplier (Opsional)" hint="Nomor ref pesanan dari supplier jika ada">
                    <Input
                      value={nomorSoSupplier}
                      onChangeText={setNomorSoSupplier}
                      placeholder="Contoh: SO-VENDOR/101"
                    />
                  </FormField>
                </View>
              </View>

              {/* Baris 3: Tanggal Dokumen & Perkiraan Tiba (ETA) */}
              <View className="flex-col sm:flex-row gap-3">
                <View className="flex-1">
                  <FormField label="Tanggal Dokumen PO" required hint="Tanggal penerbitan PO">
                    <DatePicker
                      value={tanggal}
                      onChange={setTanggal}
                      placeholder="Pilih tanggal PO..."
                    />
                  </FormField>
                </View>

                <View className="flex-1">
                  <FormField label="Perkiraan Tiba (ETA)" required hint="Estimasi barang sampai di gudang">
                    <DatePicker
                      value={eta}
                      onChange={setEta}
                      placeholder="Pilih tanggal tiba..."
                    />
                  </FormField>
                </View>
              </View>

              {/* Baris 4: Proyek Terkait */}
              <View>
                <FormField label="Alokasi Proyek Terkait (Opsional)" hint="Jika pembelian barang ini khusus dialokasikan untuk proyek">
                  <SearchableSelect
                    value={projectOptions.find((p) => p.id === projectId)?.label || ""}
                    options={projectOptions.map((p) => p.label)}
                    onChange={(val) => {
                      const match = projectOptions.find((p) => p.label === val);
                      setProjectId(match ? match.id : "");
                    }}
                    placeholder="Pilih proyek jika ada..."
                  />
                </FormField>
              </View>
            </View>

            {/* 2. Daftar Barang yang Dipesan */}
            <View className="p-3 rounded-xl bg-card border border-border gap-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <Package size={15} color={colors.primary} />
                  <Text className="text-xs font-bold text-foreground">Daftar Barang yang Dipesan</Text>
                </View>
                <Text className="text-xs font-semibold text-primary">{items.length} Barang Tercatat</Text>
              </View>

              {items.length === 0 ? (
                <View className="p-4 rounded-xl bg-panel border border-dashed border-border items-center justify-center">
                  <Text className="text-xs text-muted-foreground text-center">
                    Belum ada barang di daftar PO ini. Masukkan barang melalui form di bawah.
                  </Text>
                </View>
              ) : (
                <View className="gap-2">
                  {items.map((item, idx) => (
                    <View
                      key={item.id}
                      className="p-2.5 rounded-lg bg-panel border border-border/80 flex-row items-center justify-between gap-2"
                    >
                      <View className="flex-1 min-w-0">
                        <View className="flex-row items-center gap-1.5 flex-wrap">
                          <Text className="text-xs font-bold text-foreground">{item.name}</Text>
                          {item.itemType === "JASA" ? (
                            <Text className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400">
                              Jasa / Subkon
                            </Text>
                          ) : item.itemType === "NON_STOK" ? (
                            <Text className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
                              Non-Inventory
                            </Text>
                          ) : item.isNewItem ? (
                            <Text className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-primary/15 text-primary">
                              + Item Baru
                            </Text>
                          ) : null}
                          {item.itemType === "JASA" && item.pphMode && item.pphMode !== "none" && (item.pph || 0) > 0 ? (
                            <Text className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-danger/15 text-danger">
                              Pot. {pphModeToTipe(item.pphMode)} (-{rupiah(item.pph || 0)})
                            </Text>
                          ) : null}
                          {item.itemType !== "JASA" && item.itemType !== "NON_STOK" ? (
                            <Text className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                              item.hasSerial ? "bg-accent/20 text-accent-foreground" : "bg-muted text-muted-foreground"
                            }`}>
                              {item.hasSerial ? "Ber-SN" : "Non-SN"}
                            </Text>
                          ) : null}
                        </View>
                        <Text className="text-[11px] text-muted-foreground mt-0.5">
                          {item.sku ? `SKU: ${item.sku} · ` : ""}{item.qty} {item.unit} × {rupiah(item.price)}
                          {item.pph && item.pph > 0 ? ` (Bersih: ${rupiah(item.qty * item.price - item.pph)})` : ""}
                        </Text>
                      </View>

                      <View className="flex-row items-center gap-3">
                        <Text className="text-xs font-bold text-foreground">
                          {rupiah(item.qty * item.price)}
                        </Text>
                        <Pressable
                          onPress={() => handleRemoveItem(item.id)}
                          className="p-1 rounded hover:bg-danger/10 text-danger"
                        >
                          <Trash2 size={14} color={colors.danger} />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Form Tambah Item */}
              <View className="mt-2 p-3 rounded-xl bg-panel/70 border border-border gap-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-bold text-foreground">Tambah Barang ke PO</Text>
                  <View className="flex-row gap-1 bg-card p-0.5 rounded-lg border border-border">
                    <Button
                      variant={addItemMode === "master" ? "default" : "ghost"}
                      size="sm"
                      onPress={() => setAddItemMode("master")}
                      className="h-6 px-2 text-[11px]"
                    >
                      <Text className={`text-[11px] font-semibold ${addItemMode === "master" ? "text-primary-foreground" : "text-muted-foreground"}`}>
                        Dari Master Stok
                      </Text>
                    </Button>
                    <Button
                      variant={addItemMode === "new" ? "default" : "ghost"}
                      size="sm"
                      onPress={() => setAddItemMode("new")}
                      className="h-6 px-2 text-[11px]"
                    >
                      <Text className={`text-[11px] font-semibold ${addItemMode === "new" ? "text-primary-foreground" : "text-muted-foreground"}`}>
                        + Item Baru (Stok)
                      </Text>
                    </Button>
                    <Button
                      variant={addItemMode === "service" ? "default" : "ghost"}
                      size="sm"
                      onPress={() => setAddItemMode("service")}
                      className="h-6 px-2 text-[11px]"
                    >
                      <Text className={`text-[11px] font-semibold ${addItemMode === "service" ? "text-primary-foreground" : "text-muted-foreground"}`}>
                        + Jasa / Non-Stok
                      </Text>
                    </Button>
                  </View>
                </View>

                {addItemMode === "master" ? (
                  <View className="gap-2.5">
                    <FormField label="Pilih Produk dari Master Stok *" required>
                      <SearchableSelect
                        value={
                          selectedProductObj
                            ? `${selectedProductObj.nama || selectedProductObj.name} (${selectedProductObj.sku || "-"})`
                            : ""
                        }
                        options={(data.products ?? []).map(
                          (p: Row) => `${p.nama || p.name} (${p.sku || "-"})`
                        )}
                        onChange={(val) => {
                          const match = (data.products ?? []).find(
                            (p: Row) => `${p.nama || p.name} (${p.sku || "-"})` === val
                          );
                          if (match) handleSelectMasterProduct(String(match.id));
                        }}
                        placeholder="Cari nama barang atau SKU master..."
                      />
                    </FormField>

                    {selectedProductObj ? (
                      <View className="p-2 rounded bg-card border border-border/60 flex-row justify-between text-xs mb-1">
                        <Text className="text-[11px] text-muted-foreground">
                          Satuan: <Text className="font-semibold text-foreground">{selectedProductObj.satuan || selectedProductObj.unit || "unit"}</Text> · Tipe: <Text className="font-semibold text-foreground">{selectedProductObj.berSN || selectedProductObj.hasSerial ? "Ber-SN" : "Non-SN"}</Text>
                        </Text>
                        <Text className="text-[11px] text-muted-foreground">
                          Estimasi Beli: <Text className="font-semibold text-foreground">{rupiah(selectedProductObj.hargaBeli || selectedProductObj.purchasePrice || 0)}</Text>
                        </Text>
                      </View>
                    ) : null}

                    <View className="flex-row gap-2">
                      <View className="w-24">
                        <FormField label="Qty *" required>
                          <Input
                            value={masterQty}
                            onChangeText={setMasterQty}
                            keyboardType="numeric"
                            placeholder="1"
                          />
                        </FormField>
                      </View>
                      <View className="flex-1">
                        <FormField label="Harga Beli Satuan (Rp) *" required>
                          <Input
                            value={masterPrice}
                            onChangeText={(v) => setMasterPrice(formatThousands(v))}
                            keyboardType="numeric"
                            placeholder="Contoh: 150.000"
                          />
                        </FormField>
                      </View>
                      <View className="justify-end pb-0.5">
                        <Button
                          size="sm"
                          onPress={handleAddFromMaster}
                          className="h-10 px-3 bg-primary"
                        >
                          <Plus size={14} color="#fff" />
                          <Text className="text-white text-xs font-semibold ml-1">Tambah</Text>
                        </Button>
                      </View>
                    </View>
                  </View>
                ) : addItemMode === "new" ? (
                  <View className="gap-2.5">
                    <FormField label="Nama Barang Baru *" required hint="Nama item yang akan didaftarkan ke master barang">
                      <Input
                        value={newName}
                        onChangeText={setNewName}
                        placeholder="Contoh: Kabel UTP Cat6 305m Belden"
                      />
                    </FormField>

                    <View className="flex-row gap-2">
                      <View className="flex-1">
                        <FormField label="Tipe Barang *" required>
                          <View className="flex-row gap-1">
                            <Button
                              variant={!newHasSerial ? "default" : "outline"}
                              size="sm"
                              onPress={() => setNewHasSerial(false)}
                              className="flex-1 h-8 px-2"
                            >
                              <Text className={`text-[11px] font-semibold ${!newHasSerial ? "text-primary-foreground" : ""}`}>
                                Non-SN
                              </Text>
                            </Button>
                            <Button
                              variant={newHasSerial ? "default" : "outline"}
                              size="sm"
                              onPress={() => setNewHasSerial(true)}
                              className="flex-1 h-8 px-2"
                            >
                              <Text className={`text-[11px] font-semibold ${newHasSerial ? "text-primary-foreground" : ""}`}>
                                Ber-SN
                              </Text>
                            </Button>
                          </View>
                        </FormField>
                      </View>

                      <View className="flex-1">
                        <FormField label="Kategori Barang">
                          <SearchableSelect
                            value={categoryOptions.find((c) => c.id === newCategoryId)?.name || ""}
                            options={categoryOptions.map((c) => c.name)}
                            onChange={(val) => {
                              const match = categoryOptions.find((c) => c.name === val);
                              setNewCategoryId(match ? match.id : "");
                            }}
                            placeholder="Pilih kategori..."
                          />
                        </FormField>
                      </View>

                      <View className="w-24">
                        <FormField label="Satuan" required>
                          <Input
                            value={newUnit}
                            onChangeText={setNewUnit}
                            placeholder="unit, pcs, m..."
                          />
                        </FormField>
                      </View>
                    </View>

                    <View className="flex-row gap-2">
                      <View className="w-24">
                        <FormField label="Qty *" required>
                          <Input
                            value={newQty}
                            onChangeText={setNewQty}
                            keyboardType="numeric"
                            placeholder="1"
                          />
                        </FormField>
                      </View>
                      <View className="flex-1">
                        <FormField label="Harga Beli Satuan (Rp) *" required>
                          <Input
                            value={newPrice}
                            onChangeText={(v) => setNewPrice(formatThousands(v))}
                            keyboardType="numeric"
                            placeholder="Contoh: 1.250.000"
                          />
                        </FormField>
                      </View>
                      <View className="flex-1">
                        <FormField label="Estimasi Harga Jual (Rp)">
                          <Input
                            value={newSellPrice}
                            onChangeText={(v) => setNewSellPrice(formatThousands(v))}
                            keyboardType="numeric"
                            placeholder="Opsional (Jual)"
                          />
                        </FormField>
                      </View>
                      <View className="justify-end pb-0.5">
                        <Button
                          size="sm"
                          onPress={handleAddNewItem}
                          className="h-10 px-3 bg-primary"
                        >
                          <Sparkles size={14} color="#fff" />
                          <Text className="text-white text-xs font-semibold ml-1">Simpan & Tambah</Text>
                        </Button>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View className="gap-2.5">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs font-semibold text-foreground">Jenis Item Non-Inventory:</Text>
                      <View className="flex-row gap-1">
                        <Button
                          variant={serviceType === "JASA" ? "default" : "outline"}
                          size="sm"
                          onPress={() => {
                            setServiceType("JASA");
                            setServiceUnit("paket");
                            if (servicePphMode === "none") setServicePphMode("pph23");
                          }}
                          className="h-7 px-2.5"
                        >
                          <Text className={`text-[11px] font-semibold ${serviceType === "JASA" ? "text-primary-foreground" : ""}`}>
                            Jasa / Pekerjaan / Subkon
                          </Text>
                        </Button>
                        <Button
                          variant={serviceType === "NON_STOK" ? "default" : "outline"}
                          size="sm"
                          onPress={() => {
                            setServiceType("NON_STOK");
                            setServiceUnit("unit");
                          }}
                          className="h-7 px-2.5"
                        >
                          <Text className={`text-[11px] font-semibold ${serviceType === "NON_STOK" ? "text-primary-foreground" : ""}`}>
                            Barang Non-Stok / Pakai Habis
                          </Text>
                        </Button>
                      </View>
                    </View>

                    <FormField
                      label={serviceType === "JASA" ? "Nama Jasa / Pekerjaan *" : "Nama Barang Non-Stok *"}
                      required
                      hint={serviceType === "JASA" ? "Contoh: Jasa Pemasangan CCTV & Setting DVR (Tidak masuk master inventori)" : "Contoh: Biaya Ekspedisi / Lakban & Packing Custom"}
                    >
                      <Input
                        value={serviceName}
                        onChangeText={setServiceName}
                        placeholder={serviceType === "JASA" ? "Contoh: Jasa Instalasi & Tarik Kabel" : "Contoh: Konsumsi Teknisi / Packing Kayu"}
                      />
                    </FormField>

                    {/* Pemilihan PPh Khusus Item Jasa */}
                    {serviceType === "JASA" ? (
                      <View className="p-2.5 rounded-lg bg-card border border-border/70 gap-1.5">
                        <View className="flex-row items-center justify-between flex-wrap gap-1">
                          <Text className="text-xs font-semibold text-foreground">
                            Ketentuan Potongan PPh atas Jasa ini:
                          </Text>
                          <Text className="text-[10px] text-muted-foreground">
                            {PPH_MODE_OPTIONS.find((o) => o.id === servicePphMode)?.desc}
                          </Text>
                        </View>
                        <View className="flex-row gap-1 flex-wrap">
                          {PPH_MODE_OPTIONS.map((opt) => (
                            <Button
                              key={opt.id}
                              variant={servicePphMode === opt.id ? "default" : "outline"}
                              size="sm"
                              onPress={() => setServicePphMode(opt.id)}
                              className="h-7 px-2"
                            >
                              <Text className={`text-[11px] font-semibold ${servicePphMode === opt.id ? "text-primary-foreground" : ""}`}>
                                {opt.label}
                              </Text>
                            </Button>
                          ))}
                        </View>
                      </View>
                    ) : null}

                    <View className="flex-row gap-2">
                      <View className="w-24">
                        <FormField label="Qty *" required>
                          <Input
                            value={serviceQty}
                            onChangeText={setServiceQty}
                            keyboardType="numeric"
                            placeholder="1"
                          />
                        </FormField>
                      </View>
                      <View className="w-28">
                        <FormField label="Satuan" required>
                          <Input
                            value={serviceUnit}
                            onChangeText={setServiceUnit}
                            placeholder="paket, jasa, lot, kali..."
                          />
                        </FormField>
                      </View>
                      <View className="flex-1">
                        <FormField label="Biaya Satuan (Rp) *" required>
                          <Input
                            value={servicePrice}
                            onChangeText={(v) => setServicePrice(formatThousands(v))}
                            keyboardType="numeric"
                            placeholder="Contoh: 500.000"
                          />
                        </FormField>
                      </View>
                      <View className="justify-end pb-0.5">
                        <Button
                          size="sm"
                          onPress={handleAddServiceItem}
                          className="h-10 px-3 bg-primary"
                        >
                          <Plus size={14} color="#fff" />
                          <Text className="text-white text-xs font-semibold ml-1">Tambah</Text>
                        </Button>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* 3. Pajak PPN & Ringkasan Total */}
            <View className="p-3 rounded-xl bg-card border border-border gap-2.5">
              <Text className="text-xs font-bold text-foreground">Pajak & Ringkasan Tagihan</Text>

              {/* PPN Selector */}
              <View className="flex-row items-center justify-between flex-wrap gap-2">
                <Text className="text-xs text-muted-foreground">Perlakuan PPN (11%):</Text>
                <View className="flex-row gap-1">
                  <Button
                    variant={ppnMode === "none" ? "default" : "outline"}
                    size="sm"
                    onPress={() => setPpnMode("none")}
                    className="h-7 px-2"
                  >
                    <Text className={`text-[11px] font-semibold ${ppnMode === "none" ? "text-primary-foreground" : ""}`}>
                      Tanpa PPN
                    </Text>
                  </Button>
                  <Button
                    variant={ppnMode === "exclude" ? "default" : "outline"}
                    size="sm"
                    onPress={() => setPpnMode("exclude")}
                    className="h-7 px-2"
                  >
                    <Text className={`text-[11px] font-semibold ${ppnMode === "exclude" ? "text-primary-foreground" : ""}`}>
                      Exclude (+11%)
                    </Text>
                  </Button>
                  <Button
                    variant={ppnMode === "include" ? "default" : "outline"}
                    size="sm"
                    onPress={() => setPpnMode("include")}
                    className="h-7 px-2"
                  >
                    <Text className={`text-[11px] font-semibold ${ppnMode === "include" ? "text-primary-foreground" : ""}`}>
                      Include (11%)
                    </Text>
                  </Button>
                </View>
              </View>

              <View className="border-t border-border/60 pt-2 gap-1.5 text-xs">
                <View className="flex-row justify-between">
                  <Text className="text-xs text-muted-foreground">
                    {ppnMode === "include"
                      ? `DPP (Sebelum PPN · ${items.length} item):`
                      : `Subtotal DPP (${items.length} item):`}
                  </Text>
                  <Text className="text-xs font-semibold text-foreground">
                    {rupiah(effectiveDpp)}
                  </Text>
                </View>
                {ppnMode !== "none" ? (
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-muted-foreground">
                      PPN 11% ({ppnMode === "include" ? "Sudah Termasuk" : "Tambahan"}):
                    </Text>
                    <Text className="text-xs font-semibold text-foreground">{rupiah(ppnAmount)}</Text>
                  </View>
                ) : null}
                {totalPphJasa > 0 ? (
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-danger font-medium">
                      Potongan PPh Jasa (Dihitung dari Item Jasa):
                    </Text>
                    <Text className="text-xs font-semibold text-danger">-{rupiah(totalPphJasa)}</Text>
                  </View>
                ) : null}
                <View className="flex-row justify-between border-t border-border pt-1.5 items-center">
                  <Text className="text-sm font-bold text-foreground">Total Nilai PO:</Text>
                  <Text className="text-base font-bold text-primary">{rupiah(grandTotal)}</Text>
                </View>
              </View>
            </View>

            {/* 4. Lampiran Dokumen PO / SO */}
            <View className="p-3.5 rounded-xl bg-card border border-border gap-3">
              <View className="flex-row items-center gap-2 pb-1 border-b border-border/50">
                <FileText size={15} color={colors.primary} />
                <Text className="text-xs font-bold text-foreground">Lampiran Dokumen (Opsional)</Text>
              </View>
              <View className="flex-col sm:flex-row gap-3">
                <View className="flex-1">
                  <FormField label="File Purchase Order (PO)">
                    <FileUploader
                      label="Unggah File PO"
                      autoFlush
                      onUploaded={(id) => setFileId(id)}
                      hint="Unggah dokumen PO terbitan (PDF / Foto)"
                    />
                  </FormField>
                </View>
                <View className="flex-1">
                  <FormField label="File Sales Order (SO) dari Supplier">
                    <FileUploader
                      label="Unggah File SO Supplier"
                      autoFlush
                      onUploaded={(id) => setSoFileId(id)}
                      hint="Unggah dokumen SO supplier (PDF / Foto)"
                    />
                  </FormField>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        <DialogFooter className="gap-2 border-t border-border pt-3">
          <Button variant="outline" onPress={onClose} disabled={isSubmitting}>
            <Text>Batal</Text>
          </Button>
          <Button onPress={handleSubmit} disabled={isSubmitting} className="bg-primary px-4">
            <Check size={15} color="#fff" />
            <Text className="text-white font-semibold ml-1.5">
              {isSubmitting ? "Menyimpan PO..." : "Buat & Terbitkan PO"}
            </Text>
          </Button>
        </DialogFooter>
      </DialogContent>

      <QuickAddSupplierDialog
        open={quickSupplierOpen}
        onOpenChange={setQuickSupplierOpen}
        onSuccess={(newSup: Row) => {
          if (newSup) {
            setSupplierId(String(newSup.id));
            setSupplierName(newSup.nama || newSup.name || "");
            const supTerm = newSup.payment || newSup.paymentTerms || newSup.syaratPembayaran;
            if (supTerm) {
              setPaymentTerms(supTerm);
            }
          }
        }}
      />

      <SupplierPaymentTermsDialog
        open={termsDialogOpen}
        onOpenChange={setTermsDialogOpen}
        onSaved={(newTerms) => {
          setPaymentTermsOptions(newTerms);
          if (newTerms.length > 0 && !newTerms.includes(paymentTerms)) {
            setPaymentTerms(newTerms[0] ?? "");
          }
        }}
      />
    </>
  );
}

