import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, ArrowRight, Check } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/text";
import { PageHeader, Panel, FormField } from "@/components/taska/basics";
import { Stepper } from "@/components/taska/stepper";
import { SearchableSelect } from "@/components/taska/dialogs";
import { FileUploader, type FileUploaderHandle } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { api } from "@/services/api";
import type { Row } from "@/constants/modules";
import { rupiah } from "@/lib/format";
import { colors } from "@/tokens";

const STEPS = [
  "Pilih Project & Jenis Biaya",
  "Pilih Barang & Jumlah",
  "Ringkasan & Konfirmasi",
];

const COST_TYPE_MAP: Record<string, string> = {
  Project: "PROJECT",
  Stok: "STOK",
  Internal: "INTERNAL",
  Lainnya: "LAINNYA",
};

export default function NewPurchaseRequestScreen() {
  const router = useRouter();
  const { data, user, addRow, toast } = useApp();

  const products: Row[] = data.products ?? [];
  const projects: Row[] = data.projects ?? [];
  const stockSummary: any[] = data.stockSummary ?? [];

  const [step, setStep] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const fileHandle = React.useRef<FileUploaderHandle | null>(null);

  const [costType, setCostType] = React.useState("Project");
  const [projectId, setProjectId] = React.useState(projects[0]?.nama || "");
  const [otherDesc, setOtherDesc] = React.useState("");

  const defaultProd = products[0];
  const [selectedProduct, setSelectedProduct] = React.useState(defaultProd?.nama || "");
  const [qty, setQty] = React.useState("1");
  const [tujuan, setTujuan] = React.useState("");

  const currentProd = products.find((p) => p.nama === selectedProduct) ?? defaultProd;
  const stockAvailable = currentProd
    ? stockSummary
        .filter((s: any) => String(s.productId) === String(currentProd.id))
        .reduce((a: number, s: any) => a + Number(s.saldo ?? 0), 0)
    : 0;

  const estimatedTotal = (Number(qty) || 1) * Number(currentProd?.hargaBeli ?? 0);

  async function submit() {
    if (!currentProd) {
      toast("Pilih barang terlebih dahulu", "danger");
      return;
    }
    setBusy(true);
    try {
      const uploaded = await fileHandle.current?.flush();
      const fileId = uploaded?.[0]?.id;
      addRow("purchase-requests", {
        nomor: `PR/${new Date().getFullYear()}/${Math.floor(Math.random() * 900) + 100}`,
        pemohon: user?.name || "Karyawan",
        project: costType === "Project" ? projectId : "-",
        costType,
        otherNote: costType === "Lainnya" ? otherDesc : undefined,
        purpose: tujuan || "Kebutuhan operasional lapangan",
        item: `${currentProd.nama} (${Number(qty) || 1} ${currentProd.satuan || "unit"})`,
        items: [{ productId: Number(currentProd.id), qty: Number(qty) || 1, unitCost: Number(currentProd.hargaBeli ?? 0) }],
        estimasi: estimatedTotal,
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
                  options={projects.map((p) => String(p.nama))}
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
                options={products.map((p) => String(p.nama))}
                placeholder="Pilih barang"
              />
            </FormField>

            <View className="bg-panel/40 border-border rounded-xl border p-3">
              <Text className="text-text-secondary text-xs">Informasi Ketersediaan:</Text>
              <Text className="text-sm font-semibold mt-1">
                Stok tersedia saat ini: <Text className="text-primary">{stockAvailable} {String(currentProd?.satuan ?? "")}</Text>
              </Text>
              <Text className="text-muted-foreground text-xs mt-0.5">
                Estimasi harga beli: {rupiah(Number(currentProd?.hargaBeli ?? 0))} / {String(currentProd?.satuan ?? "")}
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
                <Text className="text-sm font-semibold">{String(currentProd?.nama ?? "-")}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-muted-foreground text-sm">Jumlah:</Text>
                <Text className="text-sm font-semibold">{qty} {String(currentProd?.satuan ?? "")}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-muted-foreground text-sm">Perkiraan Biaya:</Text>
                <Text className="text-sm font-semibold text-primary">{rupiah(estimatedTotal)}</Text>
              </View>
            </View>

            <FileUploader
              label="Lampirkan Bukti Permintaan (Chat WA / Email / BOQ)"
              kind="foto"
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
