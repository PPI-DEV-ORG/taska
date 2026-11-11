import * as React from "react";
import { View, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/text";
import { PageHeader, Panel, FormField } from "@/components/taska/basics";
import { Stepper } from "@/components/taska/stepper";
import { FlowTracker } from "@/components/taska/flow-tracker";
import { evaluatePurchase, purchaseKind } from "@/lib/purchase-flow";
import {
  SearchableSelect,
  MultiSelect,
  formatThousands,
  QuickAddSupplierDialog,
  DatePicker,
  SupplierSelect,
  findSupplierMatch,
  cleanSupplierName,
  ProjectSelect,
  ProductSelect,
} from "@/components/taska/dialogs";
import { FileUploader, type FileUploaderHandle } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import type { Row } from "@/constants/modules";
import { rupiah } from "@/lib/format";
import { colors } from "@/tokens";

const STEPS = ["Jenis & Pembayaran", "Pilih Barang", "Cek & Ajukan"];

const PROCUREMENT_MODES = [
  {
    key: "PROJECT_SUPPLIER",
    label: "Proyek — beli lewat PO Pemasok",
    costType: "Project",
    source: "SUPPLIER",
    desc: "Pesan ke pemasok resmi dengan PO.",
  },
  {
    key: "PROJECT_RETAIL",
    label: "Proyek — beli di toko / online",
    costType: "Project",
    source: "RETAIL",
    desc: "Beli langsung, Finance bayar dulu.",
  },
  {
    key: "PROJECT_STOCK",
    label: "Proyek — ambil dari stok gudang",
    costType: "Project",
    source: "GUDANG",
    desc: "Barang sudah ada di gudang, tanpa pembelian.",
  },
  {
    key: "STOK_SUPPLIER",
    label: "Restock gudang — lewat PO Pemasok",
    costType: "Stok",
    source: "SUPPLIER",
    desc: "Isi stok gudang dari pemasok.",
  },
  {
    key: "STOK_RETAIL",
    label: "Restock gudang — beli di toko / online",
    costType: "Stok",
    source: "RETAIL",
    desc: "Isi stok gudang, beli langsung.",
  },
  {
    key: "INTERNAL",
    label: "Kebutuhan internal kantor",
    costType: "Internal",
    source: "RETAIL",
    desc: "Perlengkapan kantor / operasional.",
  },
];

const COST_TYPE_MAP: Record<string, string> = {
  Project: "PROJECT",
  Stok: "STOK",
  Internal: "INTERNAL",
  Lainnya: "LAINNYA",
};

interface CustomItemRow {
  id: string;
  nama: string;
  satuan: string;
  qty: string;
  hargaBeli: string;
  berSN?: boolean;
  isProjectConsumable?: boolean;
  merk?: string;
  sku?: string;
  kategori?: string;
  hargaJual?: string;
}

interface SelectedItemRow {
  isCustom: boolean;
  isProjectConsumable?: boolean;
  customId?: string;
  productId?: number;
  nama: string;
  merk: any;
  sku?: string;
  kategori?: string;
  hargaJual?: string;
  satuan: string;
  berSN: boolean;
  availSns: string[];
  chosenSns: string[];
  hargaBeli: number;
  qty: number;
  stock: number;
  subtotal: number;
}

function generateAutoSku(sku?: string): string {
  if (sku && sku.trim()) return sku.trim().toUpperCase();
  const timePart = Date.now().toString().slice(-6);
  const randPart = Math.floor(Math.random() * 100);
  return `SKU-${timePart}-${randPart}`;
}

function generateCustomItemId(): string {
  return `CUST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function NewPurchaseRequestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ projectId?: string }>();
  const { data, user, addRow, toast } = useApp();

  const products: Row[] = React.useMemo(() => data.products ?? [], [data.products]);
  const projects: Row[] = React.useMemo(() => data.projects ?? [], [data.projects]);
  const suppliers: Row[] = data.suppliers ?? [];
  const stockSummary: any[] = data.stockSummary ?? [];
  const serials: Row[] = data.serials ?? [];

  const [step, setStep] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const fileHandle = React.useRef<FileUploaderHandle | null>(null);

  const initialProj = React.useMemo(() => {
    if (params.projectId) {
      const found = projects.find((p) => String(p.id) === String(params.projectId));
      if (found?.nama) return String(found.nama);
    }
    return projects[0]?.nama ? String(projects[0].nama) : "";
  }, [params.projectId, projects]);

  const [procModeKey, setProcModeKey] = React.useState("PROJECT_SUPPLIER");
  const activeMode = PROCUREMENT_MODES.find((m) => m.key === procModeKey) ?? PROCUREMENT_MODES[0]!;
  const costType = activeMode.costType;
  const procurementSource = activeMode.source;

  const [projectId, setProjectId] = React.useState(initialProj);
  const [supplierName, setSupplierName] = React.useState("");
  const [quickSupplierOpen, setQuickSupplierOpen] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState<"KAS" | "UTANG">("UTANG");
  const [dueDate, setDueDate] = React.useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [otherDesc, setOtherDesc] = React.useState("");

  // Step 2: Master items start EMPTY (fixes pre-selected Konektor RJ45 bug)
  const [selectedNames, setSelectedNames] = React.useState<string[]>([]);
  const [itemQuantities, setItemQuantities] = React.useState<Record<string, string>>({});
  const [itemPrices, setItemPrices] = React.useState<Record<string, string>>({});
  const [itemSerials, setItemSerials] = React.useState<Record<string, string[]>>({});
  const [catFilter, setCatFilter] = React.useState<string>("Semua");

  // Step 2: Non-master (custom / retail) items
  const [customItems, setCustomItems] = React.useState<CustomItemRow[]>([]);
  const [newCustomName, setNewCustomName] = React.useState("");
  const [newCustomMerk, setNewCustomMerk] = React.useState("");
  const [newCustomSku, setNewCustomSku] = React.useState("");
  const [newCustomCategory, setNewCustomCategory] = React.useState("");
  const [newCustomUnit, setNewCustomUnit] = React.useState("unit");
  const [newCustomQty, setNewCustomQty] = React.useState("1");
  const [newCustomPrice, setNewCustomPrice] = React.useState("");
  const [newCustomSellPrice, setNewCustomSellPrice] = React.useState("");
  const [newCustomBerSN, setNewCustomBerSN] = React.useState(false);
  /** Barang pakai habis untuk project (paku, selotip, dll) — tidak masuk master stok. */
  const [newCustomConsumable, setNewCustomConsumable] = React.useState(false);

  const [tujuan, setTujuan] = React.useState("");

  const categoryOptions = React.useMemo(() => {
    const fromMaster = (data.productCategories ?? [])
      .filter((c: any) => c.status !== "NONAKTIF")
      .map((c: any) => String(c.nama || c.name || "").trim())
      .filter(Boolean);
    const fromProducts = products.map((p) => String(p.kategori || "").trim()).filter(Boolean);
    return ["Semua", ...Array.from(new Set([...fromMaster, ...fromProducts]))];
  }, [data.productCategories, products]);

  const selectedMasterItems: SelectedItemRow[] = selectedNames.map((name) => {
    const prod = products.find((p) => p.nama === name);
    const stockAvailable = prod
      ? stockSummary
          .filter((s: any) => String(s.productId) === String(prod.id))
          .reduce((a: number, s: any) => a + Number(s.saldo ?? 0), 0)
      : 0;
    const isTakeFromStock = procurementSource === "GUDANG";
    const chosenSns = isTakeFromStock ? (itemSerials[name] ?? []) : [];
    const q = isTakeFromStock && prod?.berSN && chosenSns.length > 0 ? chosenSns.length : (Number(itemQuantities[name]) || 1);
    const defaultPrice = Number(prod?.hargaBeli ?? 0);
    const unitPrice = itemPrices[name] !== undefined ? (Number(itemPrices[name]) || 0) : defaultPrice;
    const availSns = prod?.berSN
      ? serials
          .filter(
            (s) =>
              (String(s.productId) === String(prod.id) || s.produk === prod.nama) &&
              (s.rawStatus === "DI_GUDANG" || s.status === "Di gudang"),
          )
          .sort((a, b) => Number(a.id) - Number(b.id))
          .map((s) => String(s.sn))
      : [];
    return {
      isCustom: false,
      isProjectConsumable: false,
      productId: prod?.id ? Number(prod.id) : undefined,
      nama: name,
      merk: prod?.merk || prod?.brand || "",
      sku: prod?.sku ? String(prod.sku) : undefined,
      kategori: prod?.kategori ? String(prod.kategori) : undefined,
      hargaJual: prod?.hargaJual ? String(prod.hargaJual) : undefined,
      satuan: String(prod?.satuan || "unit"),
      berSN: !!prod?.berSN,
      availSns,
      chosenSns,
      hargaBeli: unitPrice,
      qty: q,
      stock: stockAvailable,
      subtotal: q * unitPrice,
    };
  });

  const mappedCustomItems: SelectedItemRow[] = customItems.map((ci) => {
    const q = Math.max(1, Number(ci.qty) || 1);
    const unitPrice = Math.max(0, Number(ci.hargaBeli) || 0);
    return {
      isCustom: true,
      isProjectConsumable: !!ci.isProjectConsumable,
      customId: ci.id,
      productId: undefined,
      nama: ci.nama,
      merk: ci.merk || (ci.isProjectConsumable ? "Khusus Proyek (Pakai Habis — Non-Master)" : "Non-Master / Ritel"),
      sku: ci.sku,
      kategori: ci.kategori,
      hargaJual: ci.hargaJual,
      satuan: ci.satuan || "unit",
      berSN: !!ci.berSN,
      availSns: [],
      chosenSns: [],
      hargaBeli: unitPrice,
      qty: q,
      stock: 0,
      subtotal: q * unitPrice,
    };
  });

  const [ppnMode, setPpnMode] = React.useState<"none" | "exclude" | "include">("none");

  const selectedItems = [...selectedMasterItems, ...mappedCustomItems];
  const itemsSubtotal = selectedItems.reduce((acc, it) => acc + it.subtotal, 0);

  const dppCost = ppnMode === "include" ? Math.round(itemsSubtotal / 1.11) : itemsSubtotal;
  const ppnCost = ppnMode === "none" ? 0 : ppnMode === "include" ? Math.max(0, itemsSubtotal - dppCost) : Math.round(itemsSubtotal * 0.11);
  const totalEstimatedCost = ppnMode === "exclude" ? itemsSubtotal + ppnCost : itemsSubtotal;

  const isStockTakeMode = procurementSource === "GUDANG";
  // Ritel selalu dibayar Finance dulu; hanya supplier yang bisa tempo. Gudang tanpa pembayaran.
  const effectivePayment: "KAS" | "UTANG" | undefined =
    procurementSource === "SUPPLIER" ? paymentMethod : procurementSource === "RETAIL" ? "KAS" : undefined;
  const isAllConsumablesPreview = selectedItems.length > 0 && selectedItems.every((it: any) => it.isProjectConsumable);
  const previewFlow = evaluatePurchase({
    source: purchaseKind(procurementSource),
    paymentMethod: effectivePayment,
    rawStatus: "DIAJUKAN",
    isPaid: false,
    poCount: 0,
    poApproved: false,
    isProjectConsumable: costType === "Project" && isAllConsumablesPreview,
  });

  function handleAddCustomItem() {
    const trimmed = newCustomName.trim();
    if (!trimmed) {
      toast("Masukkan nama barang terlebih dahulu", "danger");
      return;
    }
    const autoSku = generateAutoSku(newCustomSku);
    const chosenCat = newCustomCategory.trim() || (categoryOptions.length > 1 ? categoryOptions[1] : "Umum");

    setCustomItems((prev) => [
      ...prev,
      {
        id: generateCustomItemId(),
        nama: trimmed,
        merk: newCustomMerk.trim() || undefined,
        sku: autoSku,
        kategori: chosenCat,
        satuan: newCustomUnit.trim() || "unit",
        qty: newCustomQty.replace(/\D/g, "") || "1",
        hargaBeli: newCustomPrice.replace(/\D/g, "") || "0",
        hargaJual: newCustomSellPrice.replace(/\D/g, "") || "0",
        berSN: newCustomBerSN && !newCustomConsumable,
        isProjectConsumable: costType === "Project" && newCustomConsumable,
      },
    ]);
    setNewCustomName("");
    setNewCustomMerk("");
    setNewCustomSku("");
    setNewCustomCategory("");
    setNewCustomUnit("unit");
    setNewCustomQty("1");
    setNewCustomPrice("");
    setNewCustomSellPrice("");
    setNewCustomBerSN(false);
    setNewCustomConsumable(false);
  }

  async function submit() {
    if (selectedItems.length === 0) {
      toast("Pilih atau tambahkan minimal satu barang terlebih dahulu", "danger");
      return;
    }
    setBusy(true);
    try {
      const fileId = (await fileHandle.current?.flush()) ?? undefined;
      const allConsumables = selectedItems.length > 0 && selectedItems.every((it: any) => it.isProjectConsumable);

      // Otomatis daftarkan barang non-master (yang bukan pakai habis) ke master data produk
      const resolvedItems: any[] = [];
      for (const it of selectedItems) {
        let finalProdId = it.productId;
        if (it.isCustom && !it.isProjectConsumable && !finalProdId) {
          const autoSku = generateAutoSku(it.sku);
          const createdProduct = await addRow("products", {
            nama: it.nama,
            sku: autoSku,
            merk: it.merk || undefined,
            kategori: it.kategori || "Umum",
            satuan: it.satuan || "unit",
            hargaBeli: it.hargaBeli,
            hargaJual: Number(it.hargaJual) || 0,
            berSN: !!it.berSN,
            status: "AKTIF",
          }).catch(() => null);

          if (createdProduct?.id) {
            finalProdId = Number(createdProduct.id);
          }
        }
        resolvedItems.push({
          ...it,
          productId: finalProdId,
        });
      }

      const itemsPayload = resolvedItems.map((it: any) => ({
        productId: it.productId,
        customName: it.isCustom && !it.productId
          ? (it.isProjectConsumable ? `[PAKAI_HABIS] ${it.nama}` : it.nama)
          : undefined,
        customUnit: it.isCustom && !it.productId ? it.satuan : undefined,
        hasSerial: it.berSN,
        qty: it.qty,
        unitCost: it.hargaBeli,
        serials: it.chosenSns && it.chosenSns.length > 0 ? it.chosenSns : undefined,
      }));
      const itemDesc = selectedItems
        .map(
          (it: any) =>
            `${it.nama} x ${it.qty}${it.satuan ? ` ${it.satuan}` : ""}${
              it.chosenSns.length > 0 ? ` (SN: ${it.chosenSns.join(", ")})` : ""
            }${it.isProjectConsumable ? " [Pakai Habis]" : ""}`,
        )
        .join(", ");

      const matchedSupplier = findSupplierMatch(suppliers, supplierName);
      const supplierClean = matchedSupplier ? (matchedSupplier.nama || matchedSupplier.name) : cleanSupplierName(supplierName);
      const matchedProj = projects.find((p) => p.nama === projectId || String(p.id) === String(projectId));

      const tags: string[] = [];
      if (allConsumables) tags.push("[ALL_CONSUMABLES]");
      if (costType === "Lainnya" || costType === "Internal") {
        if (otherDesc) tags.push(otherDesc);
      }
      tags.push(`[PPN:${ppnMode}]`);
      const otherNotePayload = tags.length > 0 ? tags.join(" ") : undefined;

      await addRow("purchase-requests", {
        pemohon: user?.name || "Karyawan",
        project: costType === "Project" ? (matchedProj?.nama || projectId) : "-",
        projectId: costType === "Project" && matchedProj ? Number(matchedProj.id) : undefined,
        costType: COST_TYPE_MAP[costType] || costType.toUpperCase(),
        procurementSource,
        paymentMethod: effectivePayment ?? "KAS",
        dueDate: effectivePayment === "UTANG" ? (dueDate || undefined) : undefined,
        supplier: procurementSource === "SUPPLIER" ? supplierClean || undefined : undefined,
        supplierId: procurementSource === "SUPPLIER" && matchedSupplier?.id ? String(matchedSupplier.id) : undefined,
        otherNote: otherNotePayload,
        purpose: tujuan || activeMode.label,
        item: itemDesc,
        items: itemsPayload,
        estimasi: totalEstimatedCost,
        ppnMode,
        fileId,
        status: "Diajukan",
      });
      router.replace("/purchase-requests");
    } catch (e: any) {
      toast(e?.message ?? "Gagal mengajukan permintaan", "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="w-full gap-5">
      <PageHeader
        back
        title="Buat Permintaan Barang"
        subtitle="Pengajuan pengadaan barang proyek, pembelian ritel/toko, atau pengisian stok gudang"
      />

      <Stepper steps={STEPS} current={step} />

      {step === 0 && (
        <Panel title="Untuk apa dan beli dari mana?">
          <View className="gap-4">
            <View className="gap-2">
              {PROCUREMENT_MODES.map((m) => {
                const active = procModeKey === m.key;
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => setProcModeKey(m.key)}
                    className={`rounded-xl border p-3 ${active ? "bg-primary/10 border-primary" : "bg-card border-border/70"}`}
                  >
                    <Text className={`text-sm font-bold ${active ? "text-primary" : "text-foreground"}`}>{m.label}</Text>
                    <Text className="text-xs text-muted-foreground mt-0.5">{m.desc}</Text>
                  </Pressable>
                );
              })}
            </View>

            {costType === "Project" && (
              <FormField label="Proyek" required>
                <ProjectSelect
                  value={projectId}
                  allowClear={false}
                  onChange={(p) => setProjectId(p?.nama ? String(p.nama) : "")}
                  placeholder="Pilih proyek..."
                />
              </FormField>
            )}

            {procurementSource === "SUPPLIER" ? (
              <>
                <FormField label="Pemasok" hint="Boleh dikosongkan, Procurement memilih saat membuat PO">
                  <SupplierSelect
                    value={supplierName}
                    onChange={(val) => setSupplierName(val)}
                    onAddNew={() => setQuickSupplierOpen(true)}
                    addNewLabel="+ Tambah Pemasok Baru"
                    placeholder="Pilih pemasok..."
                  />
                </FormField>
                <FormField label="Pembayaran ke pemasok" required>
                  <View className="flex-row gap-2.5">
                    {(
                      [
                        { v: "KAS", t: "Tunai", d: "Finance bayar dulu, baru barang dikirim" },
                        { v: "UTANG", t: "Tempo", d: "Barang diterima dulu, bayar belakangan" },
                      ] as const
                    ).map((o) => (
                      <Pressable
                        key={o.v}
                        onPress={() => setPaymentMethod(o.v)}
                        className={`flex-1 rounded-xl border p-3 ${paymentMethod === o.v ? "bg-primary/10 border-primary" : "bg-card border-border/70"}`}
                      >
                        <Text className={`text-sm font-bold ${paymentMethod === o.v ? "text-primary" : "text-foreground"}`}>{o.t}</Text>
                        <Text className="text-xs text-muted-foreground mt-0.5">{o.d}</Text>
                      </Pressable>
                    ))}
                  </View>
                </FormField>
                {paymentMethod === "UTANG" && (
                  <FormField label="Jatuh tempo" required hint="Pengingat muncul di kalender">
                    <DatePicker value={dueDate} onChange={(v) => setDueDate(v)} placeholder="Pilih tanggal jatuh tempo" />
                  </FormField>
                )}
              </>
            ) : null}

            {(costType === "Lainnya" || costType === "Internal") && (
              <FormField label="Keterangan" hint="Jelaskan kebutuhan pembelian internal">
                <Textarea value={otherDesc} onChangeText={setOtherDesc} placeholder="Tujuan dan alasan pembelian" />
              </FormField>
            )}

            <View className="rounded-xl border border-border bg-panel/40 p-4">
              <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-primary">Alur setelah diajukan</Text>
              <FlowTracker flow={previewFlow} compact />
            </View>

            <View className="mt-2 flex-row justify-end">
              <Button
                onPress={() => {
                  if (costType === "Project" && !projectId) return toast("Pilih proyek terlebih dahulu", "danger");
                  setStep(1);
                }}
              >
                <Text>Lanjut: Pilih Barang</Text>
                <ArrowRight size={16} color={colors.background} />
              </Button>
            </View>
          </View>
        </Panel>
      )}

      {step === 1 && (
        <Panel title="Langkah 2: Pilih Barang Master atau Tambah Barang Non-Master (Ritel)">
          <View className="gap-4">
            {/* Bagian A: Pilih dari Master Barang */}
            <View className="bg-panel/30 border-border/70 rounded-xl border p-3.5 gap-3">
              <Text className="text-xs font-bold uppercase tracking-wider text-primary">
                A. Pilih dari Master Barang (Ber-SN maupun Non-SN)
              </Text>
              <FormField
                label="Pilih Barang Master (Tabel Katalog)"
                hint="Klik untuk membuka katalog master stok dan memilih satu atau beberapa barang"
              >
                <ProductSelect
                  multiple
                  selectedNames={selectedNames}
                  onToggleMultiple={(prod) => {
                    const name = String(prod.nama || prod.name);
                    setSelectedNames((prev) => {
                      if (prev.includes(name)) {
                        return prev.filter((n) => n !== name);
                      } else {
                        setItemQuantities((qPrev) => ({ ...qPrev, [name]: qPrev[name] || "1" }));
                        return [...prev, name];
                      }
                    });
                  }}
                  placeholder="Klik untuk membuka tabel katalog & memilih barang master..."
                />
              </FormField>
            </View>

            {/* Barang di luar master (ritel / ketik manual) — lengkap seperti master produk baru */}
            {!isStockTakeMode && (
              <View className="bg-panel/30 border-border/70 rounded-xl border p-4 gap-3.5">
                <View>
                  <Text className="text-xs font-bold uppercase tracking-wider text-info">
                    B. Barang di luar master (Daftar Produk Baru)
                  </Text>
                  <Text className="text-xs text-muted-foreground mt-0.5">
                    Item yang belum terdaftar di katalog. Barang akan otomatis ditambahkan ke Master Produk saat pengajuan disimpan.
                  </Text>
                </View>

                {/* Baris 1: Nama Produk & Merk */}
                <View className="flex-col sm:flex-row gap-3">
                  <View className="flex-1">
                    <FormField label="Nama Barang / Produk *" required>
                      <Input
                        value={newCustomName}
                        onChangeText={setNewCustomName}
                        placeholder="Contoh: Kamera IP UNV 4MP Bullet Outdoor"
                      />
                    </FormField>
                  </View>
                  <View className="flex-1 sm:max-w-[240px]">
                    <FormField label="Merk / Brand (Pabrikan)">
                      <Input
                        value={newCustomMerk}
                        onChangeText={setNewCustomMerk}
                        placeholder="Contoh: Uniview, Belden, Hikvision"
                      />
                    </FormField>
                  </View>
                </View>

                {/* Baris 2: Kategori, Kode SKU, Satuan */}
                <View className="flex-col sm:flex-row gap-3">
                  <View className="flex-1">
                    <FormField label="Kategori Produk">
                      <SearchableSelect
                        value={newCustomCategory}
                        options={categoryOptions.filter((c) => c !== "Semua")}
                        onChange={setNewCustomCategory}
                        placeholder="Pilih atau cari kategori..."
                      />
                    </FormField>
                  </View>
                  <View className="flex-1 sm:max-w-[180px]">
                    <FormField label="Kode SKU (Opsional)" hint="Kosongkan untuk otomatis">
                      <Input
                        value={newCustomSku}
                        onChangeText={setNewCustomSku}
                        placeholder="Contoh: CAM-UNV-4K"
                      />
                    </FormField>
                  </View>
                  <View className="w-full sm:w-28">
                    <FormField label="Satuan" required>
                      <SearchableSelect
                        value={newCustomUnit}
                        options={["unit", "pcs", "roll", "meter", "box", "pack", "set", "lot"]}
                        onChange={setNewCustomUnit}
                        placeholder="unit"
                      />
                    </FormField>
                  </View>
                </View>

                {/* Baris 3: Qty, Harga Beli Satuan, Estimasi Harga Jual */}
                <View className="flex-col sm:flex-row gap-3">
                  <View className="w-full sm:w-24">
                    <FormField label="Qty *" required>
                      <Input
                        value={newCustomQty}
                        onChangeText={(v) => setNewCustomQty(v.replace(/\D/g, ""))}
                        keyboardType="numeric"
                        placeholder="1"
                      />
                    </FormField>
                  </View>
                  <View className="flex-1">
                    <FormField label="Harga Beli Satuan (Rp) *" required>
                      <Input
                        value={formatThousands(newCustomPrice)}
                        onChangeText={(v) => setNewCustomPrice(v.replace(/\D/g, ""))}
                        keyboardType="numeric"
                        placeholder="Contoh: 850.000"
                      />
                    </FormField>
                  </View>
                  <View className="flex-1">
                    <FormField label="Estimasi Harga Jual (Rp)">
                      <Input
                        value={formatThousands(newCustomSellPrice)}
                        onChangeText={(v) => setNewCustomSellPrice(v.replace(/\D/g, ""))}
                        keyboardType="numeric"
                        placeholder="Opsional (Jual)"
                      />
                    </FormField>
                  </View>
                </View>

                {/* Opsi Tipe Barang & Tombol Tambah */}
                <View className="flex-row flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/50">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant={newCustomBerSN ? "default" : "outline"}
                      onPress={() => setNewCustomBerSN((v) => !v)}
                      className="h-9 px-3"
                    >
                      <Text className="text-xs">{newCustomBerSN ? "✓ " : ""}Lacak Nomor Seri (SN)</Text>
                    </Button>
                    {costType === "Project" ? (
                      <Button
                        size="sm"
                        variant={newCustomConsumable ? "default" : "outline"}
                        onPress={() => setNewCustomConsumable((v) => !v)}
                        className="h-9 px-3"
                      >
                        <Text className="text-xs">{newCustomConsumable ? "✓ " : ""}Pakai habis (Barang Tambahan Proyek)</Text>
                      </Button>
                    ) : null}
                  </View>
                  <Button size="sm" onPress={handleAddCustomItem} className="h-9 px-4 gap-1.5 bg-primary">
                    <Plus size={15} color="#fff" />
                    <Text className="text-xs font-semibold text-white">Tambahkan ke Daftar</Text>
                  </Button>
                </View>
              </View>
            )}

            {selectedItems.length > 0 ? (
              <View className="gap-3 pt-1">
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Daftar Barang Dipilih ({selectedItems.length} item)
                </Text>

                {selectedItems.map((item) => {
                  const itemKey = item.isCustom ? (item as any).customId : item.nama;
                  return (
                    <View
                      key={itemKey}
                      className="bg-card border-border/70 rounded-xl border p-3.5 gap-2.5"
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-2 flex-1 pr-2">
                          <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
                            {item.nama}
                          </Text>
                          <View
                            className={`rounded px-1.5 py-0.5 border ${
                              (item as any).isProjectConsumable
                                ? "bg-amber-500/20 border-amber-500/50"
                                : item.isCustom
                                ? "bg-amber-500/15 border-amber-500/40"
                                : item.berSN
                                ? "bg-primary/15 border-primary/40"
                                : "bg-panel border-border/60"
                            }`}
                          >
                            <Text className="text-[10px] font-medium text-foreground">
                              {item.isCustom
                                ? (item as any).isProjectConsumable
                                  ? "Khusus Proyek · Pakai Habis"
                                  : `Non-Master · ${item.berSN ? "Ber-SN" : "Non-SN"}`
                                : item.berSN
                                ? "Master · Ber-SN"
                                : `Master · Non-SN`}
                            </Text>
                          </View>
                        </View>
                        <Pressable
                          onPress={() => {
                            if (item.isCustom) {
                              setCustomItems((prev) => prev.filter((c) => c.id !== (item as any).customId));
                            } else {
                              setSelectedNames((prev) => prev.filter((n) => n !== item.nama));
                            }
                          }}
                          hitSlop={8}
                          className="size-7 items-center justify-center rounded-lg hover:bg-danger/10 active:bg-danger/10"
                        >
                          <Trash2 size={15} color={colors.danger} />
                        </Pressable>
                      </View>

                      {item.isCustom ? (
                        <View className="bg-panel/40 border-border/60 rounded-lg border p-2 flex-row flex-wrap justify-between gap-2">
                          <Text className="text-xs text-muted-foreground">
                            Merk: <Text className="font-semibold text-foreground">{item.merk || "-"}</Text>
                          </Text>
                          <Text className="text-xs text-muted-foreground">
                            Kategori: <Text className="font-semibold text-foreground">{item.kategori || "-"}</Text>
                          </Text>
                          {item.sku ? (
                            <Text className="text-xs text-muted-foreground">
                              SKU: <Text className="font-semibold font-mono text-foreground">{item.sku}</Text>
                            </Text>
                          ) : null}
                        </View>
                      ) : (
                        <View className="bg-panel/40 border-border/60 rounded-lg border p-2 flex-row flex-wrap justify-between gap-1">
                          <Text className="text-xs text-muted-foreground">
                            Stok gudang: <Text className="font-semibold text-foreground">{item.stock} {item.satuan}</Text>
                          </Text>
                          <Text className="text-xs text-muted-foreground">
                            Harga acuan: <Text className="font-semibold text-foreground">{rupiah(item.hargaBeli)} / {item.satuan}</Text>
                          </Text>
                        </View>
                      )}

                      <View className="flex-row flex-wrap items-center justify-between gap-2 pt-1">
                        <View className="flex-row items-center gap-2">
                          <Text className="text-xs text-muted-foreground">Qty:</Text>
                          <Input
                            value={
                              item.isCustom
                                ? String(item.qty)
                                : (itemQuantities[item.nama] ?? "1")
                            }
                            onChangeText={(v) => {
                              const clean = v.replace(/\D/g, "") || "1";
                              if (item.isCustom) {
                                setCustomItems((prev) =>
                                  prev.map((c) => (c.id === (item as any).customId ? { ...c, qty: clean } : c)),
                                );
                              } else {
                                setItemQuantities((prev) => ({ ...prev, [item.nama]: clean }));
                              }
                            }}
                            keyboardType="numeric"
                            className="w-20 h-9 text-center text-sm font-semibold"
                          />
                          <Text className="text-xs text-muted-foreground">{item.satuan}</Text>
                        </View>

                        <View className="flex-row items-center gap-2">
                          <Text className="text-xs text-muted-foreground">Harga Satuan:</Text>
                          <Input
                            value={formatThousands(item.hargaBeli)}
                            onChangeText={(v) => {
                              const clean = v.replace(/\D/g, "") || "0";
                              if (item.isCustom) {
                                setCustomItems((prev) =>
                                  prev.map((c) => (c.id === (item as any).customId ? { ...c, hargaBeli: clean } : c)),
                                );
                              } else {
                                setItemPrices((prev) => ({ ...prev, [item.nama]: clean }));
                              }
                            }}
                            keyboardType="numeric"
                            className="w-32 h-9 text-right text-sm font-semibold"
                          />
                        </View>

                        <View className="items-end">
                          <Text className="text-[11px] text-muted-foreground">Subtotal</Text>
                          <Text className="text-sm font-bold text-primary">
                            {rupiah(item.subtotal)}
                          </Text>
                        </View>
                      </View>

                      {item.berSN && (
                        <View className="pt-2 border-t border-border/50">
                          {procurementSource === "GUDANG" ? (
                            <FormField
                              label={`Pilih Unit SN dari Stok Gudang (${item.availSns.length} unit tersedia)`}
                            >
                              <MultiSelect
                                values={item.chosenSns}
                                options={item.availSns}
                                onChange={(sns) => {
                                  setItemSerials((prev) => ({ ...prev, [item.nama]: sns }));
                                  if (sns.length > 0) {
                                    setItemQuantities((prev) => ({ ...prev, [item.nama]: String(sns.length) }));
                                  }
                                }}
                                placeholder="Pilih unit SN dari gudang..."
                              />
                            </FormField>
                          ) : (
                            <View className="bg-primary/5 border border-primary/20 rounded-lg p-2.5">
                              <Text className="text-xs text-muted-foreground leading-relaxed">
                                ℹ️ <Text className="font-semibold text-foreground">Barang Ber-SN (Pengadaan Baru):</Text> Unit Serial Number tidak perlu dipilih sekarang karena barang belum ada di gudang. Unit SN akan diinput/discan oleh Gudang saat penerimaan barang fisik.
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}

                {/* Pilihan Skema PPN */}
                <View className="bg-panel/40 border-border/70 rounded-xl border p-3.5 gap-2 mt-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-semibold text-foreground">Skema Pajak (PPN)</Text>
                    <Text className="text-[11px] text-muted-foreground">
                      {ppnMode === "none"
                        ? "Tanpa PPN (Non-PKP / Final)"
                        : ppnMode === "exclude"
                        ? "+11% PPN ditambahkan"
                        : "Harga sudah termasuk PPN 11%"}
                    </Text>
                  </View>
                  <View className="flex-row flex-wrap gap-2">
                    {[
                      { id: "none", label: "No PPN" },
                      { id: "exclude", label: "PPN (11%)" },
                      { id: "include", label: "PPN Included" },
                    ].map((opt) => (
                      <Button
                        key={opt.id}
                        size="sm"
                        variant={ppnMode === opt.id ? "default" : "outline"}
                        onPress={() => setPpnMode(opt.id as any)}
                        className="h-8 px-3"
                      >
                        <Text className="text-xs">{opt.label}</Text>
                      </Button>
                    ))}
                  </View>
                </View>

                {/* Total Kalkulasi Card */}
                <View className="bg-primary/10 border-primary/30 rounded-xl border p-3.5 gap-2 mt-1">
                  <View className="flex-row justify-between items-center">
                    <View>
                      <Text className="text-xs font-semibold text-primary">Total Estimasi Pengadaan</Text>
                      <Text className="text-xs text-muted-foreground">
                        {selectedItems.length} macam barang
                        {ppnMode === "exclude" ? " · Termasuk PPN 11%" : ppnMode === "include" ? " · PPN Included" : " · Non-PPN"}
                      </Text>
                    </View>
                    <Text className="text-lg font-bold text-primary">{rupiah(totalEstimatedCost)}</Text>
                  </View>

                  {ppnMode !== "none" ? (
                    <View className="border-t border-primary/20 pt-2 flex-row justify-between text-xs">
                      <Text className="text-xs text-muted-foreground">
                        DPP: <Text className="font-semibold text-foreground">{rupiah(dppCost)}</Text>
                      </Text>
                      <Text className="text-xs text-muted-foreground">
                        PPN Masukan (11%): <Text className="font-semibold text-primary">{rupiah(ppnCost)}</Text>
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : (
              <View className="bg-panel/40 border-border/60 rounded-xl border p-4 items-center">
                <Text className="text-xs text-muted-foreground">
                  Belum ada barang dipilih. Pilih dari Master Barang di atas atau tambahkan Barang Non-Master (Ritel).
                </Text>
              </View>
            )}

            <FormField label="Tujuan / Catatan Kebutuhan">
              <Input
                value={tujuan}
                onChangeText={setTujuan}
                placeholder="Contoh: Pengadaan Smartbox & CCTV Kantor RW / Stok Retail"
              />
            </FormField>

            <View className="mt-4 flex-row justify-between">
              <Button variant="outline" onPress={() => setStep(0)}>
                <ArrowLeft size={16} color={colors.text} />
                <Text>Kembali</Text>
              </Button>
              <Button
                onPress={() => {
                  if (selectedItems.length === 0) {
                    toast("Pilih atau tambahkan minimal satu barang terlebih dahulu", "danger");
                    return;
                  }
                  setStep(2);
                }}
              >
                <Text>Lanjut: Ringkasan</Text>
                <ArrowRight size={16} color={colors.background} />
              </Button>
            </View>
          </View>
        </Panel>
      )}

      {step === 2 && (
        <Panel title="Cek lalu ajukan">
          <View className="gap-4">
            <View className="bg-panel/40 border-border rounded-xl border p-4 gap-2.5">
              <View className="flex-row justify-between gap-3">
                <Text className="text-muted-foreground text-sm">Jenis</Text>
                <Text className="text-sm font-semibold flex-1 text-right">{activeMode.label}</Text>
              </View>
              {costType === "Project" ? (
                <View className="flex-row justify-between gap-3">
                  <Text className="text-muted-foreground text-sm">Proyek</Text>
                  <Text className="text-sm font-semibold flex-1 text-right">{projectId}</Text>
                </View>
              ) : null}
              {effectivePayment ? (
                <View className="flex-row justify-between gap-3">
                  <Text className="text-muted-foreground text-sm">Pembayaran</Text>
                  <Text className="text-sm font-semibold">
                    {effectivePayment === "KAS" ? "Dibayar Finance dulu" : `Tempo, jatuh tempo ${dueDate}`}
                  </Text>
                </View>
              ) : null}

              <View className="border-t border-border/60 my-1 pt-2 gap-1.5">
                <Text className="text-xs font-semibold text-muted-foreground uppercase">
                  Barang ({selectedItems.length})
                </Text>
                {selectedItems.map((item, idx) => (
                  <View key={`${item.nama}-${idx}`} className="flex-row justify-between text-sm py-0.5">
                    <Text className="text-sm text-foreground flex-1 pr-2" numberOfLines={1}>
                      {item.nama}{" "}
                      <Text className="text-muted-foreground">
                        ({item.qty} {item.satuan} · {item.isCustom ? "Non-Master" : "Master"})
                      </Text>
                    </Text>
                    <Text className="text-sm font-medium">{rupiah(item.subtotal)}</Text>
                  </View>
                ))}
              </View>

              <View className="border-t border-border/60 pt-2 flex-row justify-between items-center">
                <Text className="text-sm font-bold text-foreground">Total Perkiraan Biaya:</Text>
                <Text className="text-base font-bold text-primary">{rupiah(totalEstimatedCost)}</Text>
              </View>
              {ppnMode !== "none" ? (
                <View className="flex-row justify-between text-xs pt-0.5">
                  <Text className="text-xs text-muted-foreground">DPP: {rupiah(dppCost)}</Text>
                  <Text className="text-xs text-muted-foreground">PPN (11%): {rupiah(ppnCost)}</Text>
                </View>
              ) : null}
            </View>

            <FileUploader
              label="Lampirkan Bukti Permintaan / Nota Ritel (Foto, PDF, BOQ, atau Struk)"
              kind="semua"
              accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp"
              allowedExtensions={["jpg", "jpeg", "png", "webp", "pdf"]}
              category="request-barang"
              hint="Format gambar (JPG, PNG) atau dokumen (PDF, BOQ)"
              handleRef={(h) => { fileHandle.current = h; }}
            />

            <View className="mt-4 flex-row justify-between">
              <Button variant="outline" onPress={() => setStep(1)}>
                <ArrowLeft size={16} color={colors.text} />
                <Text>Kembali</Text>
              </Button>
              <Button onPress={submit} disabled={busy}>
                <Check size={16} color={colors.background} />
                <Text>{busy ? "Mengajukan..." : "Ajukan Permintaan Barang"}</Text>
              </Button>
            </View>
          </View>
        </Panel>
      )}

      <QuickAddSupplierDialog
        open={quickSupplierOpen}
        onOpenChange={setQuickSupplierOpen}
        onSuccess={(newSupp) => {
          setSupplierName(newSupp.nama);
        }}
      />
    </View>
  );
}
