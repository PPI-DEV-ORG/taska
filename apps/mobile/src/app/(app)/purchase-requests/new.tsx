import * as React from "react";
import { View, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, ArrowRight, Check } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/text";
import { PageHeader, Panel, FormField } from "@/components/taska/basics";
import { Stepper } from "@/components/taska/stepper";
import { SearchableSelect } from "@/components/taska/dialogs";
import { FileUploader } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { PRODUCTS, STOCK_QTY } from "@/mock/data";
import { rupiah } from "@/lib/format";
import { colors } from "@/tokens";

const STEPS = [
  "Pilih Project & Jenis Biaya",
  "Pilih Barang & Jumlah",
  "Ringkasan & Konfirmasi",
];

export default function NewPurchaseRequestScreen() {
  const router = useRouter();
  const { data, addRow, toast } = useApp();

  const [step, setStep] = React.useState(0);

  // Step 1
  const [costType, setCostType] = React.useState("Project");
  const [projectId, setProjectId] = React.useState(data.projects[0]?.nama || "");
  const [otherDesc, setOtherDesc] = React.useState("");

  // Step 2
  const defaultProd = PRODUCTS[0]!;
  const [selectedProduct, setSelectedProduct] = React.useState(defaultProd.nama);
  const [qty, setQty] = React.useState("1");
  const [tujuan, setTujuan] = React.useState("");

  const currentProd = PRODUCTS.find((p) => p.nama === selectedProduct) ?? defaultProd;
  const stockList = STOCK_QTY[currentProd.id];
  const stockAvailable = stockList
    ? (stockList[0] ?? 0) + (stockList[1] ?? 0) + (stockList[2] ?? 0)
    : 0;

  const estimatedTotal = (Number(qty) || 1) * currentProd.hargaBeli;

  function submit() {
    const row = {
      nomor: `RB/2026/10/${Math.floor(Math.random() * 800) + 100}`,
      project: costType === "Project" ? projectId : "-",
      jenisBiaya: costType === "Lainnya" ? `Lainnya (${otherDesc})` : costType,
      pemohon: "Budi Santoso",
      item: `${currentProd.nama} x ${qty} ${currentProd.satuan}`,
      estimasi: estimatedTotal,
      status: "Diajukan",
      tujuan: tujuan || "Kebutuhan operasional lapangan",
    };

    addRow("purchase-requests", row);
    toast("Request barang berhasil diajukan");
    router.replace("/purchase-requests");
  }

  return (
    <View className="w-full gap-5">
      <PageHeader
        back
        title="Buat Request Barang"
        subtitle="Pengajuan pengadaan atau penarikan stok gudang"
      />

      <Stepper steps={STEPS} current={step} />

      {step === 0 && (
        <Panel title="Langkah 1: Jenis Biaya & Project">
          <View className="gap-4">
            <FormField label="Jenis Biaya" required>
              <SearchableSelect
                value={costType}
                onChange={setCostType}
                options={["Project", "Stok", "Internal", "Lainnya"]}
                placeholder="Pilih jenis biaya"
              />
            </FormField>

            {costType === "Project" && (
              <FormField label="Pilih Project" required hint="Wajib dipilih untuk cost type Project">
                <SearchableSelect
                  value={projectId}
                  onChange={setProjectId}
                  options={data.projects.map((p) => p.nama)}
                  placeholder="Pilih project terkait"
                />
              </FormField>
            )}

            {costType === "Lainnya" && (
              <FormField label="Keterangan Tambahan" required hint="Jelaskan kebutuhan pembelian non-project">
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
        <Panel title="Langkah 2: Pilih Barang & Qty">
          <View className="gap-4">
            <FormField label="Pilih Barang Master" required>
              <SearchableSelect
                value={selectedProduct}
                onChange={setSelectedProduct}
                options={PRODUCTS.map((p) => p.nama)}
                placeholder="Pilih barang"
              />
            </FormField>

            <View className="bg-panel/40 border-border rounded-xl border p-3">
              <Text className="text-text-secondary text-xs">Informasi Ketersediaan:</Text>
              <Text className="text-sm font-semibold mt-1">
                Stok tersedia saat ini: <Text className="text-primary">{stockAvailable} {currentProd.satuan}</Text>
              </Text>
              <Text className="text-muted-foreground text-xs mt-0.5">
                Estimasi harga beli: {rupiah(currentProd.hargaBeli)} / {currentProd.satuan}
              </Text>
            </View>

            <FormField label="Jumlah yang Dibutuhkan" required>
              <Input
                value={qty}
                onChangeText={setQty}
                keyboardType="numeric"
                placeholder="Contoh: 5"
              />
            </FormField>

            <FormField label="Tujuan / Catatan Kebutuhan">
              <Input
                value={tujuan}
                onChangeText={setTujuan}
                placeholder="Contoh: Penggantian perangkat di lantai 2"
              />
            </FormField>

            <View className="mt-4 flex-row justify-between">
              <Button variant="outline" onPress={() => setStep(0)}>
                <ArrowLeft size={16} color={colors.text} />
                <Text>Kembali</Text>
              </Button>
              <Button onPress={() => setStep(2)}>
                <Text>Lanjut: Ringkasan</Text>
                <ArrowRight size={16} color={colors.background} />
              </Button>
            </View>
          </View>
        </Panel>
      )}

      {step === 2 && (
        <Panel title="Langkah 3: Ringkasan & Lampiran Bukti">
          <View className="gap-4">
            <View className="bg-panel/40 border-border rounded-xl border p-4 gap-2">
              <View className="flex-row justify-between">
                <Text className="text-muted-foreground text-sm">Jenis Biaya:</Text>
                <Text className="text-sm font-semibold">{costType}</Text>
              </View>
              {costType === "Project" ? (
                <View className="flex-row justify-between">
                  <Text className="text-muted-foreground text-sm">Project:</Text>
                  <Text className="text-sm font-semibold">{projectId}</Text>
                </View>
              ) : null}
              <View className="flex-row justify-between">
                <Text className="text-muted-foreground text-sm">Barang:</Text>
                <Text className="text-sm font-semibold">{currentProd.nama}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-muted-foreground text-sm">Jumlah:</Text>
                <Text className="text-sm font-semibold">{qty} {currentProd.satuan}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-muted-foreground text-sm">Perkiraan Biaya:</Text>
                <Text className="text-sm font-semibold text-primary">{rupiah(estimatedTotal)}</Text>
              </View>
            </View>

            <FileUploader
              label="Lampirkan Bukti Permintaan (Chat WA / Email / BOQ)"
              kind="foto"
            />

            <View className="mt-4 flex-row justify-between">
              <Button variant="outline" onPress={() => setStep(1)}>
                <ArrowLeft size={16} color={colors.text} />
                <Text>Kembali</Text>
              </Button>
              <Button onPress={submit}>
                <Check size={16} color={colors.background} />
                <Text>Ajukan Request Barang</Text>
              </Button>
            </View>
          </View>
        </Panel>
      )}
    </View>
  );
}
