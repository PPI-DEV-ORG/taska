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
import { SearchableSelect, MultiSelect } from "@/components/taska/dialogs";
import { FileUploader, type FileUploaderHandle } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import type { Row } from "@/constants/modules";
import { rupiah } from "@/lib/format";
import { colors } from "@/tokens";

const STEPS = [
  "Tujuan, Sumber & Pembayaran",
  "Pilih Barang (Master / Non-Master)",
  "Ringkasan & Konfirmasi",
];

const PROCUREMENT_MODES = [
  {
    key: "PROJECT_SUPPLIER",
    label: "Pengadaan Project (via Supplier / PO)",
    costType: "Project",
    source: "SUPPLIER",
    desc: "Beli barang untuk kebutuhan Project melalui PO Supplier → Masuk HPP Project (5101)",
  },
  {
    key: "PROJECT_RETAIL",
    label: "Pengadaan Project (Beli dari Ritel / Toko)",
    costType: "Project",
    source: "RETAIL",
    desc: "Beli barang untuk Project dari toko ritel/marketplace (bisa barang non-master) → Masuk HPP Project (5101)",
  },
  {
    key: "STOK_RETAIL",
    label: "Pembelian Ritel / Stok Gudang",
    costType: "Stok",
    source: "RETAIL",
    desc: "Beli barang untuk stok/dijual kembali (Retail) → Masuk Aset Persediaan Barang Dagang (1200)",
  },
  {
    key: "STOK_SUPPLIER",
    label: "Restock Gudang (via Supplier / PO)",
    costType: "Stok",
    source: "SUPPLIER",
    desc: "Pengadaan stok gudang lewat PO Supplier → Masuk Aset Persediaan Barang Dagang (1200)",
  },
  {
    key: "INTERNAL",
    label: "Kebutuhan Internal / Operasional Lainnya",
    costType: "Internal",
    source: "RETAIL",
    desc: "Kebutuhan perlengkapan internal kantor/operasional",
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
}

export default function NewPurchaseRequestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ projectId?: string }>();
  const { data, user, addRow, toast } = useApp();

  const products: Row[] = data.products ?? [];
  const projects: Row[] = data.projects ?? [];
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
  const [paymentMethod, setPaymentMethod] = React.useState<"KAS" | "UTANG">("UTANG");
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
  const [newCustomUnit, setNewCustomUnit] = React.useState("unit");
  const [newCustomQty, setNewCustomQty] = React.useState("1");
  const [newCustomPrice, setNewCustomPrice] = React.useState("");

  const [tujuan, setTujuan] = React.useState("");

  const categoryOptions = React.useMemo(() => {
    const fromMaster = (data.productCategories ?? [])
      .filter((c: any) => c.status !== "NONAKTIF")
      .map((c: any) => String(c.nama || c.name || "").trim())
      .filter(Boolean);
    const fromProducts = products.map((p) => String(p.kategori || "").trim()).filter(Boolean);
    return ["Semua", ...Array.from(new Set([...fromMaster, ...fromProducts]))];
  }, [data.productCategories, products]);

  const selectedMasterItems = selectedNames.map((name) => {
    const prod = products.find((p) => p.nama === name);
    const stockAvailable = prod
      ? stockSummary
          .filter((s: any) => String(s.productId) === String(prod.id))
          .reduce((a: number, s: any) => a + Number(s.saldo ?? 0), 0)
      : 0;
    const chosenSns = itemSerials[name] ?? [];
    const q = prod?.berSN && chosenSns.length > 0 ? chosenSns.length : (Number(itemQuantities[name]) || 1);
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
      productId: prod?.id ? Number(prod.id) : undefined,
      nama: name,
      merk: prod?.merk || prod?.brand || "",
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

  const mappedCustomItems = customItems.map((ci) => {
    const q = Math.max(1, Number(ci.qty) || 1);
    const unitPrice = Math.max(0, Number(ci.hargaBeli) || 0);
    return {
      isCustom: true,
      customId: ci.id,
      productId: undefined as number | undefined,
      nama: ci.nama,
      merk: "Non-Master / Ritel",
      satuan: ci.satuan || "unit",
      berSN: false,
      availSns: [] as string[],
      chosenSns: [] as string[],
      hargaBeli: unitPrice,
      qty: q,
      stock: 0,
      subtotal: q * unitPrice,
    };
  });

  const selectedItems = [...selectedMasterItems, ...mappedCustomItems];
  const totalEstimatedCost = selectedItems.reduce((acc, it) => acc + it.subtotal, 0);

  const isProjectAlloc = costType === "Project";
  const debitAccountLabel = isProjectAlloc
    ? "[5101] HPP Project (Pengadaan Barang & Material Proyek)"
    : "[1200] Persediaan Barang Dagang (Aset Lancar)";
  const creditAccountLabel =
    paymentMethod === "KAS"
      ? "[1000.01] Kas / Bank Operasional (Kas Berkurang)"
      : "[210102] Account Payable / Hutang Usaha (Timbul Utang)";

  function handleAddCustomItem() {
    const trimmed = newCustomName.trim();
    if (!trimmed) {
      toast("Masukkan nama barang non-master terlebih dahulu", "danger");
      return;
    }
    setCustomItems((prev) => [
      ...prev,
      {
        id: `CUST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nama: trimmed,
        satuan: newCustomUnit.trim() || "unit",
        qty: newCustomQty.replace(/\D/g, "") || "1",
        hargaBeli: newCustomPrice.replace(/\D/g, "") || "0",
      },
    ]);
    setNewCustomName("");
    setNewCustomUnit("unit");
    setNewCustomQty("1");
    setNewCustomPrice("");
  }

  async function submit() {
    if (selectedItems.length === 0) {
      toast("Pilih atau tambahkan minimal satu barang terlebih dahulu", "danger");
      return;
    }
    setBusy(true);
    try {
      const fileId = (await fileHandle.current?.flush()) ?? undefined;
      const itemsPayload = selectedItems.map((it) => ({
        productId: it.productId,
        customName: it.isCustom ? it.nama : undefined,
        customUnit: it.isCustom ? it.satuan : undefined,
        qty: it.qty,
        unitCost: it.hargaBeli,
        serials: it.chosenSns.length > 0 ? it.chosenSns : undefined,
      }));
      const itemDesc = selectedItems
        .map(
          (it) =>
            `${it.nama} x ${it.qty}${it.satuan ? ` ${it.satuan}` : ""}${
              it.chosenSns.length > 0 ? ` (SN: ${it.chosenSns.join(", ")})` : ""
            }`,
        )
        .join(", ");

      const matchedSupplier = suppliers.find((s) => s.nama === supplierName);

      await addRow("purchase-requests", {
        pemohon: user?.name || "Karyawan",
        project: costType === "Project" ? projectId : "-",
        costType: COST_TYPE_MAP[costType] || costType.toUpperCase(),
        procurementSource,
        paymentMethod,
        supplier: supplierName || undefined,
        supplierId: matchedSupplier?.id ? String(matchedSupplier.id) : undefined,
        otherNote: costType === "Lainnya" || costType === "Internal" ? otherDesc : undefined,
        purpose: tujuan || activeMode.label,
        item: itemDesc,
        items: itemsPayload,
        estimasi: totalEstimatedCost,
        fileId,
        status: "Diajukan",
      });
      router.replace("/purchase-requests");
    } catch (e: any) {
      toast(e?.message ?? "Gagal mengajukan request", "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="w-full gap-5">
      <PageHeader
        back
        title="Buat Request Barang"
        subtitle="Pengajuan pengadaan barang project, pembelian ritel/toko, atau pengisian stok gudang"
      />

      <Stepper steps={STEPS} current={step} />

      {step === 0 && (
        <Panel title="Langkah 1: Tujuan Pengadaan, Sumber & Pembayaran">
          <View className="gap-4">
            <FormField label="Kategori & Sumber Pengadaan" required>
              <View className="gap-2">
                {PROCUREMENT_MODES.map((m) => {
                  const active = procModeKey === m.key;
                  return (
                    <Pressable
                      key={m.key}
                      onPress={() => setProcModeKey(m.key)}
                      className={`rounded-xl border p-3 ${
                        active ? "bg-primary/10 border-primary" : "bg-card border-border/70"
                      }`}
                    >
                      <View className="flex-row items-center justify-between">
                        <Text className={`text-sm font-bold ${active ? "text-primary" : "text-foreground"}`}>
                          {m.label}
                        </Text>
                        <View
                          className={`px-2 py-0.5 rounded border ${
                            m.costType === "Project"
                              ? "bg-info/15 border-info/40"
                              : "bg-emerald-500/15 border-emerald-500/40"
                          }`}
                        >
                          <Text className="text-[10px] font-bold">
                            {m.costType === "Project" ? "HPP PROJECT (5101)" : "ASET STOK (1200)"}
                          </Text>
                        </View>
                      </View>
                      <Text className="text-xs text-muted-foreground mt-1">{m.desc}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </FormField>

            {costType === "Project" && (
              <FormField label="Pilih Project" required hint="Barang yang dibeli akan dialokasikan ke HPP Project ini">
                <SearchableSelect
                  value={projectId}
                  onChange={setProjectId}
                  options={projects.map((p) => String(p.nama))}
                  placeholder="Pilih project terkait"
                />
              </FormField>
            )}

            <FormField
              label="Supplier / Toko Ritel (Opsional)"
              hint="Pilih supplier rekanan atau kosongkan jika beli langsung di toko ritel"
            >
              <SearchableSelect
                value={supplierName}
                onChange={setSupplierName}
                options={["-", ...suppliers.map((s) => String(s.nama))]}
                placeholder="Pilih supplier (opsional)..."
              />
            </FormField>

            <FormField
              label="Metode Pembayaran Pembelian"
              required
              hint="Baik pembelian Project maupun Ritel/Stok bisa dibayar via Kas/Tunai atau Utang/Tempo"
            >
              <View className="flex-row gap-2.5">
                <Pressable
                  onPress={() => setPaymentMethod("KAS")}
                  className={`flex-1 rounded-xl border p-3 ${
                    paymentMethod === "KAS" ? "bg-primary/10 border-primary" : "bg-card border-border/70"
                  }`}
                >
                  <Text className={`text-sm font-bold ${paymentMethod === "KAS" ? "text-primary" : "text-foreground"}`}>
                    Kas / Tunai (Langsung)
                  </Text>
                  <Text className="text-xs text-muted-foreground mt-0.5">
                    Kredit langsung mengurangi Kas / Bank (1000.01)
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setPaymentMethod("UTANG")}
                  className={`flex-1 rounded-xl border p-3 ${
                    paymentMethod === "UTANG" ? "bg-primary/10 border-primary" : "bg-card border-border/70"
                  }`}
                >
                  <Text className={`text-sm font-bold ${paymentMethod === "UTANG" ? "text-primary" : "text-foreground"}`}>
                    Utang / Tempo (PO / Invoice)
                  </Text>
                  <Text className="text-xs text-muted-foreground mt-0.5">
                    Kredit masuk Hutang Usaha (210102) & terhubung ke Invoice Masuk
                  </Text>
                </Pressable>
              </View>
            </FormField>

            {/* Preview Jurnal Akuntansi */}
            <View className="bg-panel/60 border-border rounded-xl border p-3 gap-1.5">
              <Text className="text-xs font-bold uppercase tracking-wider text-primary">
                Skema Pencatatan Akuntansi Otomatis
              </Text>
              <View className="flex-row justify-between items-center">
                <Text className="text-xs text-muted-foreground">Pos DEBIT (Bertambah):</Text>
                <Text className="text-xs font-semibold text-foreground">{debitAccountLabel}</Text>
              </View>
              <View className="flex-row justify-between items-center">
                <Text className="text-xs text-muted-foreground">Pos KREDIT (Berkurang/Utang):</Text>
                <Text className="text-xs font-semibold text-foreground">{creditAccountLabel}</Text>
              </View>
            </View>

            {(costType === "Lainnya" || costType === "Internal") && (
              <FormField label="Keterangan Tambahan" hint="Jelaskan kebutuhan pembelian internal">
                <Textarea
                  value={otherDesc}
                  onChangeText={setOtherDesc}
                  placeholder="Tulis tujuan dan justifikasi biaya"
                />
              </FormField>
            )}

            <View className="mt-4 flex-row justify-end">
              <Button onPress={() => setStep(1)}>
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
              <FormField label="Filter Kategori Barang">
                <SearchableSelect
                  value={catFilter}
                  onChange={setCatFilter}
                  options={categoryOptions}
                  placeholder="Pilih kategori barang"
                />
              </FormField>

              <FormField
                label="Pilih Barang Master"
                hint="Kosong secara default — pilih satu atau beberapa barang dari katalog Master"
              >
                <MultiSelect
                  values={selectedNames}
                  onChange={(newNames) => {
                    setSelectedNames(newNames);
                    setItemQuantities((prev) => {
                      const next = { ...prev };
                      newNames.forEach((n) => {
                        if (!next[n]) next[n] = "1";
                      });
                      return next;
                    });
                  }}
                  options={(catFilter === "Semua" ? products : products.filter((p) => String(p.kategori || "").trim().toLowerCase() === catFilter.toLowerCase())).map((p) => `${p.nama}`)}
                  placeholder="Klik untuk memilih barang dari Master..."
                />
              </FormField>
            </View>

            {/* Bagian B: Tambah Barang Non-Master / Beli Ritel Manual */}
            <View className="bg-panel/30 border-border/70 rounded-xl border p-3.5 gap-3">
              <View>
                <Text className="text-xs font-bold uppercase tracking-wider text-info">
                  B. Tambah Barang Non-Master (Beli Ritel / Ketik Manual)
                </Text>
                <Text className="text-xs text-muted-foreground mt-0.5">
                  Gunakan ini jika barang dibeli dari ritel/toko dan belum ada di Master Barang (misal: Smartbox, aksesoris, material tambahan)
                </Text>
              </View>

              <View className="flex-row flex-wrap gap-2 items-end">
                <View className="flex-1 min-w-[180px] gap-1">
                  <Text className="text-xs text-muted-foreground">Nama Barang Non-Master</Text>
                  <Input
                    value={newCustomName}
                    onChangeText={setNewCustomName}
                    placeholder="Contoh: Smartbox Outdoor / Kabel Roll"
                  />
                </View>
                <View className="w-20 gap-1">
                  <Text className="text-xs text-muted-foreground">Qty</Text>
                  <Input
                    value={newCustomQty}
                    onChangeText={(v) => setNewCustomQty(v.replace(/\D/g, ""))}
                    keyboardType="numeric"
                    placeholder="1"
                  />
                </View>
                <View className="w-24 gap-1">
                  <Text className="text-xs text-muted-foreground">Satuan</Text>
                  <Input
                    value={newCustomUnit}
                    onChangeText={setNewCustomUnit}
                    placeholder="unit/pcs"
                  />
                </View>
                <View className="w-36 gap-1">
                  <Text className="text-xs text-muted-foreground">Harga Satuan (Rp)</Text>
                  <Input
                    value={newCustomPrice}
                    onChangeText={(v) => setNewCustomPrice(v.replace(/\D/g, ""))}
                    keyboardType="numeric"
                    placeholder="Contoh: 250000"
                  />
                </View>
                <Button size="sm" onPress={handleAddCustomItem} className="h-10 px-3">
                  <Plus size={15} color="#fff" />
                  <Text className="text-xs font-semibold text-white">Tambah</Text>
                </Button>
              </View>
            </View>

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
                              item.isCustom
                                ? "bg-amber-500/15 border-amber-500/40"
                                : item.berSN
                                ? "bg-primary/15 border-primary/40"
                                : "bg-panel border-border/60"
                            }`}
                          >
                            <Text className="text-[10px] font-medium text-foreground">
                              {item.isCustom ? "Non-Master (Ritel)" : item.berSN ? "Master · Ber-SN" : `Master · Non-SN`}
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

                      {!item.isCustom ? (
                        <View className="bg-panel/40 border-border/60 rounded-lg border p-2 flex-row flex-wrap justify-between gap-1">
                          <Text className="text-xs text-muted-foreground">
                            Stok gudang: <Text className="font-semibold text-foreground">{item.stock} {item.satuan}</Text>
                          </Text>
                          <Text className="text-xs text-muted-foreground">
                            Harga acuan: <Text className="font-semibold text-foreground">{rupiah(item.hargaBeli)} / {item.satuan}</Text>
                          </Text>
                        </View>
                      ) : null}

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
                            value={String(item.hargaBeli)}
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
                          <FormField
                            label={`Pilih Unit SN dari Stok Gudang (${item.availSns.length} unit tersedia — Opsional)`}
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
                              placeholder="Pilih SN spesifik (atau kosongkan jika pengadaan baru)..."
                            />
                          </FormField>
                        </View>
                      )}
                    </View>
                  );
                })}

                {/* Total Kalkulasi Card */}
                <View className="bg-primary/10 border-primary/30 rounded-xl border p-3.5 flex-row justify-between items-center mt-1">
                  <View>
                    <Text className="text-xs font-semibold text-primary">Total Estimasi Pengadaan</Text>
                    <Text className="text-xs text-muted-foreground">{selectedItems.length} macam barang</Text>
                  </View>
                  <Text className="text-lg font-bold text-primary">{rupiah(totalEstimatedCost)}</Text>
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
        <Panel title="Langkah 3: Ringkasan, Jurnal Akuntansi & Lampiran Bukti">
          <View className="gap-4">
            <View className="bg-panel/40 border-border rounded-xl border p-4 gap-2.5">
              <View className="flex-row justify-between">
                <Text className="text-muted-foreground text-sm">Kategori Pengadaan:</Text>
                <Text className="text-sm font-semibold">{activeMode.label}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-muted-foreground text-sm">Sumber Pembelian:</Text>
                <Text className="text-sm font-semibold">
                  {procurementSource === "RETAIL" ? "Beli Ritel / Toko" : "Supplier / PO"}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-muted-foreground text-sm">Metode Pembayaran:</Text>
                <Text className="text-sm font-semibold">
                  {paymentMethod === "KAS" ? "Kas / Tunai (Kredit Kas)" : "Utang / Tempo (Kredit Hutang Usaha)"}
                </Text>
              </View>
              {costType === "Project" ? (
                <View className="flex-row justify-between">
                  <Text className="text-muted-foreground text-sm">Project:</Text>
                  <Text className="text-sm font-semibold">{projectId}</Text>
                </View>
              ) : null}
              <View className="flex-row justify-between">
                <Text className="text-muted-foreground text-sm">Pos Debit Akuntansi:</Text>
                <Text className="text-sm font-semibold text-primary">{debitAccountLabel}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-muted-foreground text-sm">Pos Kredit Akuntansi:</Text>
                <Text className="text-sm font-semibold text-warning">{creditAccountLabel}</Text>
              </View>

              <View className="border-t border-border/60 my-1 pt-2 gap-1.5">
                <Text className="text-xs font-semibold text-muted-foreground uppercase">
                  Rincian Barang ({selectedItems.length} item):
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
            </View>

            <FileUploader
              label="Lampirkan Bukti Permintaan / Nota Ritel (Chat WA / Email / BOQ / Struk)"
              kind="foto"
              category="request-barang"
              handleRef={(h) => { fileHandle.current = h; }}
            />

            <View className="mt-4 flex-row justify-between">
              <Button variant="outline" onPress={() => setStep(1)}>
                <ArrowLeft size={16} color={colors.text} />
                <Text>Kembali</Text>
              </Button>
              <Button onPress={submit} disabled={busy}>
                <Check size={16} color={colors.background} />
                <Text>{busy ? "Mengajukan..." : "Ajukan Request Barang"}</Text>
              </Button>
            </View>
          </View>
        </Panel>
      )}
    </View>
  );
}
