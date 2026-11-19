import * as React from "react";
import { View, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Briefcase,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  Truck,
  Warehouse,
  type LucideIcon,
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/text";
import { PageHeader, Panel, FormField } from "@/components/akuntra/basics";
import { Stepper } from "@/components/akuntra/stepper";
import { FlowTracker } from "@/components/akuntra/flow-tracker";
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
} from "@/components/akuntra/dialogs";
import { FileUploader, type FileUploaderHandle } from "@/components/akuntra/file-uploader";
import { useApp } from "@/store/app-store";
import type { Row } from "@/constants/modules";
import { rupiah } from "@/lib/format";
import { colors } from "@/tokens";

/**
 * Form permintaan barang — dibuat sesederhana mungkin untuk orang baru:
 *   1. Untuk apa?   (proyek / stok gudang / kantor)  +  dapat dari mana? (stok / toko / supplier)
 *   2. Barang apa saja?  (cari dari katalog, atau ketik barang baru)
 *   3. Cek & kirim
 */

const STEPS = ["Untuk apa?", "Barang apa saja?", "Cek & kirim"];

type Purpose = "PROJECT" | "STOK" | "INTERNAL";
type Source = "GUDANG" | "RETAIL" | "SUPPLIER";

const PURPOSES: { key: Purpose; label: string; desc: string; icon: LucideIcon }[] = [
  { key: "PROJECT", label: "Proyek", desc: "Barang untuk dipasang / dipakai di proyek", icon: Briefcase },
  { key: "STOK", label: "Stok gudang", desc: "Menambah persediaan di gudang", icon: Warehouse },
  { key: "INTERNAL", label: "Kantor", desc: "Perlengkapan & operasional kantor", icon: Building2 },
];

const SOURCES: Record<Source, { label: string; desc: string; icon: LucideIcon }> = {
  GUDANG: { label: "Ambil dari stok gudang", desc: "Barang sudah ada di gudang — tidak perlu beli", icon: Boxes },
  RETAIL: { label: "Beli di toko / online", desc: "Beli langsung, Finance yang membayar", icon: ShoppingBag },
  SUPPLIER: { label: "Pesan ke supplier", desc: "Dibuatkan PO resmi oleh Procurement", icon: Truck },
};

/** Sumber yang masuk akal per tujuan. */
const SOURCES_FOR: Record<Purpose, Source[]> = {
  PROJECT: ["GUDANG", "RETAIL", "SUPPLIER"],
  STOK: ["RETAIL", "SUPPLIER"],
  INTERNAL: ["RETAIL"],
};

const COST_TYPE: Record<Purpose, string> = { PROJECT: "PROJECT", STOK: "STOK", INTERNAL: "INTERNAL" };
const PURPOSE_LABEL: Record<Purpose, string> = { PROJECT: "Proyek", STOK: "Restock gudang", INTERNAL: "Kebutuhan kantor" };

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

/** Kartu pilihan besar (satu ketukan). */
function ChoiceCard({
  active,
  onPress,
  icon: Icon,
  label,
  desc,
}: {
  active: boolean;
  onPress: () => void;
  icon: LucideIcon;
  label: string;
  desc: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      className={`flex-1 min-w-[150px] flex-row items-center gap-3 rounded-xl border p-3 ${
        active ? "bg-primary/10 border-primary" : "bg-card border-border/70 active:bg-muted"
      }`}
    >
      <View className={`size-9 rounded-lg items-center justify-center ${active ? "bg-primary" : "bg-muted"}`}>
        <Icon size={18} color={active ? "#fff" : colors.muted} />
      </View>
      <View className="flex-1">
        <Text className={`text-sm font-semibold ${active ? "text-primary" : "text-foreground"}`}>{label}</Text>
        <Text className="text-[11px] text-muted-foreground">{desc}</Text>
      </View>
      {active ? <Check size={16} color={colors.primary} /> : null}
    </Pressable>
  );
}

/** Tombol kembali / lanjut di bawah tiap langkah. */
function Footer({ onBack, next }: { onBack?: () => void; next: React.ReactNode }) {
  return (
    <View className="mt-2 flex-row items-center justify-between gap-2">
      {onBack ? (
        <Button variant="outline" onPress={onBack}>
          <ArrowLeft size={16} color={colors.text} />
          <Text>Kembali</Text>
        </Button>
      ) : (
        <View />
      )}
      {next}
    </View>
  );
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
    return "";
  }, [params.projectId, projects]);

  // ── Langkah 1: untuk apa & dari mana ──
  const [purpose, setPurpose] = React.useState<Purpose>("PROJECT");
  const [sourceChoice, setSourceChoice] = React.useState<Source>("SUPPLIER");
  const allowedSources = SOURCES_FOR[purpose];
  const procurementSource: Source = allowedSources.includes(sourceChoice) ? sourceChoice : allowedSources[0]!;
  const isProject = purpose === "PROJECT";
  const isStockTakeMode = procurementSource === "GUDANG";

  const [projectId, setProjectId] = React.useState(initialProj);
  const [supplierName, setSupplierName] = React.useState("");
  const [quickSupplierOpen, setQuickSupplierOpen] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState<"KAS" | "UTANG">("UTANG");
  const [dueDate, setDueDate] = React.useState<string>(() => {
    // Tanggal lokal (bukan UTC) supaya tidak mundur sehari di WIB sebelum jam 07.00.
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  // ── Langkah 2: barang ──
  const [selectedNames, setSelectedNames] = React.useState<string[]>([]);
  const [itemQuantities, setItemQuantities] = React.useState<Record<string, string>>({});
  const [itemPrices, setItemPrices] = React.useState<Record<string, string>>({});
  const [itemSerials, setItemSerials] = React.useState<Record<string, string[]>>({});

  const [customItems, setCustomItems] = React.useState<CustomItemRow[]>([]);
  const [newOpen, setNewOpen] = React.useState(false);
  const [moreOpen, setMoreOpen] = React.useState(false);
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
  const [ppnMode, setPpnMode] = React.useState<"none" | "exclude" | "include">("none");

  // ── Langkah 3 ──
  const [tujuan, setTujuan] = React.useState("");

  const categoryOptions = React.useMemo(() => {
    const fromMaster = (data.productCategories ?? [])
      .filter((c: any) => c.status !== "NONAKTIF")
      .map((c: any) => String(c.nama || c.name || "").trim())
      .filter(Boolean);
    const fromProducts = products.map((p) => String(p.kategori || "").trim()).filter(Boolean);
    return Array.from(new Set([...fromMaster, ...fromProducts]));
  }, [data.productCategories, products]);

  const selectedMasterItems: SelectedItemRow[] = selectedNames.map((name) => {
    const prod = products.find((p) => p.nama === name);
    const stockAvailable = prod
      ? stockSummary
          .filter((s: any) => String(s.productId) === String(prod.id))
          .reduce((a: number, s: any) => a + Number(s.saldo ?? 0), 0)
      : 0;
    const chosenSns = isStockTakeMode ? (itemSerials[name] ?? []) : [];
    const q = isStockTakeMode && prod?.berSN && chosenSns.length > 0 ? chosenSns.length : (Number(itemQuantities[name]) || 1);
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
      merk: ci.merk || "",
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

  const selectedItems = [...selectedMasterItems, ...mappedCustomItems];
  const itemsSubtotal = selectedItems.reduce((acc, it) => acc + it.subtotal, 0);
  const effectivePpn = isStockTakeMode ? "none" : ppnMode;
  const dppCost = effectivePpn === "include" ? Math.round(itemsSubtotal / 1.11) : itemsSubtotal;
  const ppnCost = effectivePpn === "none" ? 0 : effectivePpn === "include" ? Math.max(0, itemsSubtotal - dppCost) : Math.round(itemsSubtotal * 0.11);
  const totalEstimatedCost = effectivePpn === "exclude" ? itemsSubtotal + ppnCost : itemsSubtotal;

  // Ritel selalu dibayar Finance dulu; hanya supplier yang bisa tempo. Ambil stok tanpa pembayaran.
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
    isProjectConsumable: isProject && isAllConsumablesPreview,
  });

  function resetNewItem() {
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
    setMoreOpen(false);
  }

  function handleAddCustomItem() {
    const trimmed = newCustomName.trim();
    if (!trimmed) {
      toast("Isi nama barangnya dulu", "danger");
      return;
    }
    setCustomItems((prev) => [
      ...prev,
      {
        id: generateCustomItemId(),
        nama: trimmed,
        merk: newCustomMerk.trim() || undefined,
        sku: generateAutoSku(newCustomSku),
        kategori: newCustomCategory.trim() || categoryOptions[0] || "Umum",
        satuan: newCustomUnit.trim() || "unit",
        qty: newCustomQty.replace(/\D/g, "") || "1",
        hargaBeli: newCustomPrice.replace(/\D/g, "") || "0",
        hargaJual: newCustomSellPrice.replace(/\D/g, "") || "0",
        berSN: newCustomBerSN && !newCustomConsumable,
        isProjectConsumable: isProject && newCustomConsumable,
      },
    ]);
    resetNewItem();
    setNewOpen(false);
  }

  function removeItem(item: SelectedItemRow) {
    if (item.isCustom) setCustomItems((prev) => prev.filter((c) => c.id !== item.customId));
    else setSelectedNames((prev) => prev.filter((n) => n !== item.nama));
  }

  function setQty(item: SelectedItemRow, v: string) {
    const clean = v.replace(/\D/g, "") || "1";
    if (item.isCustom) setCustomItems((prev) => prev.map((c) => (c.id === item.customId ? { ...c, qty: clean } : c)));
    else setItemQuantities((prev) => ({ ...prev, [item.nama]: clean }));
  }

  function setPrice(item: SelectedItemRow, v: string) {
    const clean = v.replace(/\D/g, "") || "0";
    if (item.isCustom) setCustomItems((prev) => prev.map((c) => (c.id === item.customId ? { ...c, hargaBeli: clean } : c)));
    else setItemPrices((prev) => ({ ...prev, [item.nama]: clean }));
  }

  async function submit() {
    if (selectedItems.length === 0) {
      toast("Tambahkan minimal satu barang", "danger");
      return;
    }
    setBusy(true);
    try {
      const fileId = (await fileHandle.current?.flush()) ?? undefined;
      const allConsumables = selectedItems.length > 0 && selectedItems.every((it: any) => it.isProjectConsumable);

      // Barang baru (bukan pakai habis) otomatis didaftarkan ke Master Barang
      const resolvedItems: any[] = [];
      for (const it of selectedItems) {
        let finalProdId = it.productId;
        if (it.isCustom && !it.isProjectConsumable && !finalProdId) {
          const createdProduct = await addRow("products", {
            nama: it.nama,
            sku: generateAutoSku(it.sku),
            merk: it.merk || undefined,
            kategori: it.kategori || "Umum",
            satuan: it.satuan || "unit",
            hargaBeli: it.hargaBeli,
            hargaJual: Number(it.hargaJual) || 0,
            berSN: !!it.berSN,
            status: "AKTIF",
          }).catch(() => null);
          if (createdProduct?.id) finalProdId = Number(createdProduct.id);
        }
        resolvedItems.push({ ...it, productId: finalProdId });
      }

      const itemsPayload = resolvedItems.map((it: any) => ({
        productId: it.productId,
        customName: it.isCustom && !it.productId ? it.nama : undefined,
        isConsumable: Boolean(it.isProjectConsumable),
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
      const defaultPurpose = `${PURPOSE_LABEL[purpose]} — ${SOURCES[procurementSource].label.toLowerCase()}`;

      await addRow("purchase-requests", {
        pemohon: user?.name || "Karyawan",
        project: isProject ? (matchedProj?.nama || projectId) : "-",
        projectId: isProject && matchedProj ? Number(matchedProj.id) : undefined,
        costType: COST_TYPE[purpose],
        procurementSource,
        paymentMethod: effectivePayment ?? "KAS",
        dueDate: effectivePayment === "UTANG" ? (dueDate || undefined) : undefined,
        supplier: procurementSource === "SUPPLIER" ? supplierClean || undefined : undefined,
        supplierId: procurementSource === "SUPPLIER" && matchedSupplier?.id ? String(matchedSupplier.id) : undefined,
        otherNote: purpose === "INTERNAL" && tujuan ? tujuan : undefined,
        purpose: tujuan.trim() || defaultPurpose,
        item: itemDesc,
        items: itemsPayload,
        estimasi: totalEstimatedCost,
        ppnMode: effectivePpn,
        isProjectConsumable: Boolean(allConsumables),
        fileId,
        status: "Diajukan",
      });
      toast("Permintaan barang terkirim. Pantau prosesnya di halaman detail.");
      router.replace("/purchase-requests");
    } catch (e: any) {
      toast(e?.message ?? "Gagal mengirim permintaan", "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="w-full gap-5">
      <PageHeader back title="Minta Barang" subtitle="Isi 3 langkah singkat — tim terkait akan memprosesnya" />

      <Stepper steps={STEPS} current={step} />

      {/* ───────── Langkah 1: Untuk apa? ───────── */}
      {step === 0 && (
        <Panel>
          <View className="gap-5">
            <View className="gap-2">
              <Text className="text-sm font-semibold text-foreground">Barangnya untuk apa?</Text>
              <View className="flex-row flex-wrap gap-2">
                {PURPOSES.map((p) => (
                  <ChoiceCard
                    key={p.key}
                    active={purpose === p.key}
                    onPress={() => setPurpose(p.key)}
                    icon={p.icon}
                    label={p.label}
                    desc={p.desc}
                  />
                ))}
              </View>
            </View>

            {isProject ? (
              <FormField label="Proyek yang mana?" required>
                <ProjectSelect
                  value={projectId}
                  allowClear={false}
                  onChange={(p) => setProjectId(p?.nama ? String(p.nama) : "")}
                  placeholder="Pilih proyek..."
                />
              </FormField>
            ) : null}

            {allowedSources.length > 1 ? (
              <View className="gap-2">
                <Text className="text-sm font-semibold text-foreground">Barangnya didapat dari mana?</Text>
                <View className="flex-row flex-wrap gap-2">
                  {allowedSources.map((s) => (
                    <ChoiceCard
                      key={s}
                      active={procurementSource === s}
                      onPress={() => setSourceChoice(s)}
                      icon={SOURCES[s].icon}
                      label={SOURCES[s].label}
                      desc={SOURCES[s].desc}
                    />
                  ))}
                </View>
              </View>
            ) : (
              <Text className="text-xs text-muted-foreground">Dibeli langsung di toko / online, Finance yang membayar.</Text>
            )}

            {procurementSource === "SUPPLIER" ? (
              <View className="gap-3 rounded-xl border border-border/70 bg-muted/30 p-3">
                <FormField label="Supplier (opsional)" hint="Kosongkan bila belum tahu — Procurement yang memilih">
                  <SupplierSelect
                    value={supplierName}
                    onChange={(val) => setSupplierName(val)}
                    onAddNew={() => setQuickSupplierOpen(true)}
                    addNewLabel="+ Tambah supplier baru"
                    placeholder="Pilih supplier..."
                  />
                </FormField>
                <FormField label="Cara bayar ke supplier">
                  <View className="flex-row gap-2">
                    {(
                      [
                        { v: "UTANG", t: "Tempo", d: "Barang datang dulu, bayar belakangan" },
                        { v: "KAS", t: "Tunai", d: "Dibayar dulu, baru barang dikirim" },
                      ] as const
                    ).map((o) => (
                      <Pressable
                        key={o.v}
                        onPress={() => setPaymentMethod(o.v)}
                        className={`flex-1 rounded-xl border p-2.5 ${paymentMethod === o.v ? "bg-primary/10 border-primary" : "bg-card border-border/70"}`}
                      >
                        <Text className={`text-sm font-semibold ${paymentMethod === o.v ? "text-primary" : "text-foreground"}`}>{o.t}</Text>
                        <Text className="text-[11px] text-muted-foreground">{o.d}</Text>
                      </Pressable>
                    ))}
                  </View>
                </FormField>
                {paymentMethod === "UTANG" ? (
                  <FormField label="Jatuh tempo">
                    <DatePicker value={dueDate} onChange={(v) => setDueDate(v)} placeholder="Pilih tanggal" />
                  </FormField>
                ) : null}
              </View>
            ) : null}

            <Footer
              next={
                <Button
                  onPress={() => {
                    if (isProject && !projectId) return toast("Pilih proyeknya dulu", "danger");
                    setStep(1);
                  }}
                >
                  <Text>Lanjut</Text>
                  <ArrowRight size={16} color={colors.background} />
                </Button>
              }
            />
          </View>
        </Panel>
      )}

      {/* ───────── Langkah 2: Barang apa saja? ───────── */}
      {step === 1 && (
        <Panel>
          <View className="gap-4">
            {/* Cari dari katalog */}
            <View className="gap-1.5">
              <Text className="text-sm font-semibold text-foreground">
                {isStockTakeMode ? "Pilih barang dari stok gudang" : "Cari barang di katalog"}
              </Text>
              <ProductSelect
                multiple
                selectedNames={selectedNames}
                onToggleMultiple={(prod) => {
                  const name = String(prod.nama || prod.name);
                  setSelectedNames((prev) => {
                    if (prev.includes(name)) return prev.filter((n) => n !== name);
                    setItemQuantities((qPrev) => ({ ...qPrev, [name]: qPrev[name] || "1" }));
                    return [...prev, name];
                  });
                }}
                placeholder="Ketuk untuk mencari & memilih barang..."
              />
            </View>

            {/* Barang baru (belum ada di katalog) */}
            {!isStockTakeMode ? (
              newOpen ? (
                <View className="gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
                  <Text className="text-sm font-semibold text-foreground">Barang baru</Text>
                  <FormField label="Nama barang" required>
                    <Input value={newCustomName} onChangeText={setNewCustomName} placeholder="Contoh: Kabel UTP Cat6 1 roll" autoFocus />
                  </FormField>
                  <View className="flex-row gap-2">
                    <View className="w-24">
                      <FormField label="Jumlah">
                        <Input value={newCustomQty} onChangeText={(v) => setNewCustomQty(v.replace(/\D/g, ""))} keyboardType="numeric" placeholder="1" />
                      </FormField>
                    </View>
                    <View className="w-28">
                      <FormField label="Satuan">
                        <SearchableSelect
                          value={newCustomUnit}
                          options={["unit", "pcs", "roll", "meter", "box", "pack", "set", "lot"]}
                          onChange={setNewCustomUnit}
                          placeholder="unit"
                        />
                      </FormField>
                    </View>
                    <View className="flex-1">
                      <FormField label="Perkiraan harga / satuan">
                        <Input
                          value={formatThousands(newCustomPrice)}
                          onChangeText={(v) => setNewCustomPrice(v.replace(/\D/g, ""))}
                          keyboardType="numeric"
                          placeholder="Rp"
                        />
                      </FormField>
                    </View>
                  </View>

                  <Pressable onPress={() => setMoreOpen((v) => !v)} className="flex-row items-center gap-1 self-start">
                    {moreOpen ? <ChevronUp size={14} color={colors.primary} /> : <ChevronDown size={14} color={colors.primary} />}
                    <Text className="text-xs font-semibold text-primary">{moreOpen ? "Sembunyikan detail" : "Detail lain (opsional)"}</Text>
                  </Pressable>
                  {moreOpen ? (
                    <View className="gap-3">
                      <View className="flex-row flex-wrap gap-2">
                        <View className="flex-1 min-w-[140px]">
                          <FormField label="Merk">
                            <Input value={newCustomMerk} onChangeText={setNewCustomMerk} placeholder="Contoh: Belden" />
                          </FormField>
                        </View>
                        <View className="flex-1 min-w-[140px]">
                          <FormField label="Kategori">
                            <SearchableSelect value={newCustomCategory} options={categoryOptions} onChange={setNewCustomCategory} placeholder="Pilih kategori" />
                          </FormField>
                        </View>
                      </View>
                      <View className="flex-row flex-wrap gap-2">
                        <View className="flex-1 min-w-[140px]">
                          <FormField label="Kode barang (SKU)" hint="Kosongkan = otomatis">
                            <Input value={newCustomSku} onChangeText={setNewCustomSku} placeholder="Otomatis" />
                          </FormField>
                        </View>
                        <View className="flex-1 min-w-[140px]">
                          <FormField label="Perkiraan harga jual">
                            <Input
                              value={formatThousands(newCustomSellPrice)}
                              onChangeText={(v) => setNewCustomSellPrice(v.replace(/\D/g, ""))}
                              keyboardType="numeric"
                              placeholder="Rp"
                            />
                          </FormField>
                        </View>
                      </View>
                      <View className="flex-row flex-wrap gap-2">
                        <Button size="sm" variant={newCustomBerSN ? "default" : "outline"} onPress={() => setNewCustomBerSN((v) => !v)}>
                          <Text className="text-xs">{newCustomBerSN ? "✓ " : ""}Punya nomor seri (SN)</Text>
                        </Button>
                        {isProject ? (
                          <Button size="sm" variant={newCustomConsumable ? "default" : "outline"} onPress={() => setNewCustomConsumable((v) => !v)}>
                            <Text className="text-xs">{newCustomConsumable ? "✓ " : ""}Barang habis pakai (paku, selotip, dll)</Text>
                          </Button>
                        ) : null}
                      </View>
                    </View>
                  ) : null}

                  <View className="flex-row justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => {
                        resetNewItem();
                        setNewOpen(false);
                      }}
                    >
                      <Text className="text-xs">Batal</Text>
                    </Button>
                    <Button size="sm" onPress={handleAddCustomItem}>
                      <Plus size={14} color="#fff" />
                      <Text className="text-xs font-semibold text-white">Tambahkan</Text>
                    </Button>
                  </View>
                </View>
              ) : (
                <Pressable onPress={() => setNewOpen(true)} className="flex-row items-center gap-2 self-start py-1">
                  <Search size={14} color={colors.primary} />
                  <Text className="text-xs font-semibold text-primary">Barang tidak ada di katalog? Ketik barang baru</Text>
                </Pressable>
              )
            ) : null}

            {/* Daftar barang */}
            {selectedItems.length === 0 ? (
              <View className="items-center rounded-xl border border-dashed border-border p-6">
                <Text className="text-xs text-muted-foreground text-center">Belum ada barang. Cari di katalog di atas.</Text>
              </View>
            ) : (
              <View className="rounded-xl border border-border">
                {selectedItems.map((item, idx) => {
                  const key = item.isCustom ? item.customId! : item.nama;
                  return (
                    <View key={key} className={`p-3 gap-2 ${idx > 0 ? "border-t border-border/60" : ""}`}>
                      <View className="flex-row items-start justify-between gap-2">
                        <View className="flex-1 min-w-0">
                          <Text className="text-sm font-medium text-foreground" numberOfLines={2}>
                            {item.nama}
                          </Text>
                          <Text className="text-[11px] text-muted-foreground">
                            {item.isCustom
                              ? item.isProjectConsumable
                                ? "Barang baru · habis pakai"
                                : "Barang baru · otomatis masuk katalog"
                              : `Stok gudang: ${item.stock} ${item.satuan}`}
                          </Text>
                        </View>
                        <Pressable onPress={() => removeItem(item)} hitSlop={8} className="size-7 items-center justify-center rounded-lg active:bg-danger/10">
                          <Trash2 size={15} color={colors.danger} />
                        </Pressable>
                      </View>

                      <View className="flex-row flex-wrap items-center gap-2">
                        <View className="flex-row items-center gap-1.5">
                          <Input
                            value={item.isCustom ? String(item.qty) : (itemQuantities[item.nama] ?? "1")}
                            onChangeText={(v) => setQty(item, v)}
                            keyboardType="numeric"
                            className="w-16 h-9 text-center text-sm"
                            editable={!(isStockTakeMode && item.berSN && item.chosenSns.length > 0)}
                          />
                          <Text className="text-xs text-muted-foreground">{item.satuan}</Text>
                        </View>
                        {!isStockTakeMode ? (
                          <>
                            <Text className="text-xs text-muted-foreground">×</Text>
                            <Input
                              value={formatThousands(item.hargaBeli)}
                              onChangeText={(v) => setPrice(item, v)}
                              keyboardType="numeric"
                              placeholder="Perkiraan harga"
                              className="w-32 h-9 text-right text-sm"
                            />
                            <Text className="ml-auto text-sm font-semibold text-foreground">{rupiah(item.subtotal)}</Text>
                          </>
                        ) : null}
                      </View>

                      {/* Ambil dari stok: pilih unit SN */}
                      {isStockTakeMode && item.berSN ? (
                        <MultiSelect
                          values={item.chosenSns}
                          options={item.availSns}
                          onChange={(sns) => {
                            setItemSerials((prev) => ({ ...prev, [item.nama]: sns }));
                            if (sns.length > 0) setItemQuantities((prev) => ({ ...prev, [item.nama]: String(sns.length) }));
                          }}
                          placeholder={`Pilih nomor seri (${item.availSns.length} tersedia) — opsional`}
                        />
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}

            {/* PPN & total (bukan untuk ambil stok) */}
            {selectedItems.length > 0 && !isStockTakeMode ? (
              <View className="gap-3">
                <View className="gap-1.5">
                  <Text className="text-xs font-semibold text-foreground">Harga di atas sudah termasuk PPN?</Text>
                  <View className="flex-row flex-wrap gap-1.5">
                    {(
                      [
                        { id: "none", label: "Tidak ada PPN" },
                        { id: "exclude", label: "Belum (+11%)" },
                        { id: "include", label: "Sudah termasuk" },
                      ] as const
                    ).map((opt) => (
                      <Pressable
                        key={opt.id}
                        onPress={() => setPpnMode(opt.id)}
                        className={`rounded-full border px-3 py-1.5 ${ppnMode === opt.id ? "bg-primary border-primary" : "bg-card border-border"}`}
                      >
                        <Text className={`text-xs ${ppnMode === opt.id ? "text-white font-semibold" : "text-foreground"}`}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View className="flex-row items-center justify-between rounded-xl bg-primary/10 px-4 py-3">
                  <View>
                    <Text className="text-xs text-muted-foreground">Perkiraan total</Text>
                    {effectivePpn !== "none" ? (
                      <Text className="text-[11px] text-muted-foreground">
                        {effectivePpn === "include" ? "Sudah termasuk" : "Termasuk"} PPN {rupiah(ppnCost)}
                      </Text>
                    ) : null}
                  </View>
                  <Text className="text-lg font-bold text-primary">{rupiah(totalEstimatedCost)}</Text>
                </View>
              </View>
            ) : null}

            <Footer
              onBack={() => setStep(0)}
              next={
                <Button
                  onPress={() => {
                    if (selectedItems.length === 0) return toast("Tambahkan minimal satu barang", "danger");
                    setStep(2);
                  }}
                >
                  <Text>Lanjut</Text>
                  <ArrowRight size={16} color={colors.background} />
                </Button>
              }
            />
          </View>
        </Panel>
      )}

      {/* ───────── Langkah 3: Cek & kirim ───────── */}
      {step === 2 && (
        <Panel>
          <View className="gap-4">
            <View className="rounded-xl border border-border p-3 gap-2">
              {[
                ["Untuk", isProject ? `Proyek ${projectId}` : PURPOSE_LABEL[purpose]],
                ["Dari", SOURCES[procurementSource].label],
                ...(procurementSource === "SUPPLIER" && supplierName ? [["Supplier", supplierName]] : []),
                ...(effectivePayment
                  ? [["Pembayaran", effectivePayment === "KAS" ? "Dibayar Finance dulu" : `Tempo, jatuh tempo ${dueDate}`]]
                  : []),
              ].map(([k, v]) => (
                <View key={k} className="flex-row justify-between gap-3">
                  <Text className="text-xs text-muted-foreground">{k}</Text>
                  <Text className="text-xs font-semibold text-foreground flex-1 text-right">{v}</Text>
                </View>
              ))}
              <View className="border-t border-border/60 pt-2 gap-1">
                {selectedItems.map((item, idx) => (
                  <View key={`${item.nama}-${idx}`} className="flex-row justify-between gap-2">
                    <Text className="text-sm text-foreground flex-1" numberOfLines={1}>
                      {item.nama} <Text className="text-xs text-muted-foreground">× {item.qty} {item.satuan}</Text>
                    </Text>
                    {!isStockTakeMode ? <Text className="text-sm text-foreground">{rupiah(item.subtotal)}</Text> : null}
                  </View>
                ))}
              </View>
              {!isStockTakeMode ? (
                <View className="border-t border-border/60 pt-2 flex-row justify-between">
                  <Text className="text-sm font-semibold text-foreground">Perkiraan total</Text>
                  <Text className="text-sm font-bold text-primary">{rupiah(totalEstimatedCost)}</Text>
                </View>
              ) : null}
            </View>

            <FormField label="Catatan (opsional)" hint="Contoh: untuk pemasangan CCTV lantai 2, dibutuhkan Senin">
              <Textarea value={tujuan} onChangeText={setTujuan} placeholder="Jelaskan singkat kebutuhannya..." />
            </FormField>

            <FileUploader
              label="Lampiran (opsional)"
              kind="semua"
              accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp"
              allowedExtensions={["jpg", "jpeg", "png", "webp", "pdf"]}
              category="request-barang"
              hint="Foto / PDF: chat WA, BOQ, atau penawaran toko"
              handleRef={(h) => {
                fileHandle.current = h;
              }}
            />

            <View className="rounded-xl border border-border bg-muted/30 p-3 gap-2">
              <Text className="text-xs font-semibold text-foreground">Setelah dikirim</Text>
              <FlowTracker flow={previewFlow} compact />
            </View>

            <Footer
              onBack={() => setStep(1)}
              next={
                <Button onPress={submit} disabled={busy}>
                  <Check size={16} color={colors.background} />
                  <Text>{busy ? "Mengirim..." : "Kirim Permintaan"}</Text>
                </Button>
              }
            />
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
