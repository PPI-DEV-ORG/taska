import * as React from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, ArrowRight, Check, Trash2 } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/text";
import { PageHeader, Panel, FormField } from "@/components/taska/basics";
import { Stepper } from "@/components/taska/stepper";
import { SearchableSelect, MultiSelect } from "@/components/taska/dialogs";
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

  const [selectedNames, setSelectedNames] = React.useState<string[]>(
    products[0]?.nama ? [String(products[0].nama)] : []
  );
  const [itemQuantities, setItemQuantities] = React.useState<Record<string, string>>({});
  const [tujuan, setTujuan] = React.useState("");

  const selectedItems = selectedNames.map((name) => {
    const prod = products.find((p) => p.nama === name);
    const stockAvailable = prod
      ? stockSummary
          .filter((s: any) => String(s.productId) === String(prod.id))
          .reduce((a: number, s: any) => a + Number(s.saldo ?? 0), 0)
      : 0;
    const q = Number(itemQuantities[name]) || 1;
    const unitPrice = Number(prod?.hargaBeli ?? 0);
    return {
      productId: prod?.id ? Number(prod.id) : undefined,
      nama: name,
      satuan: String(prod?.satuan || "unit"),
      hargaBeli: unitPrice,
      qty: q,
      stock: stockAvailable,
      subtotal: q * unitPrice,
    };
  });

  const totalEstimatedCost = selectedItems.reduce((acc, it) => acc + it.subtotal, 0);

  async function submit() {
    if (selectedItems.length === 0) {
      toast("Pilih minimal satu barang terlebih dahulu", "danger");
      return;
    }
    setBusy(true);
    try {
      const fileId = (await fileHandle.current?.flush()) ?? undefined;
      const itemsPayload = selectedItems.map((it) => ({
        productId: it.productId,
        qty: it.qty,
        unitCost: it.hargaBeli,
      }));
      const itemDesc = selectedItems
        .map((it) => `${it.nama} x ${it.qty}${it.satuan ? ` ${it.satuan}` : ""}`)
        .join(", ");

      addRow("purchase-requests", {
        pemohon: user?.name || "Karyawan",
        project: costType === "Project" ? projectId : "-",
        costType: COST_TYPE_MAP[costType] || costType.toUpperCase(),
        otherNote: costType === "Lainnya" ? otherDesc : undefined,
        purpose: tujuan || "Kebutuhan operasional lapangan",
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
            <FormField
              label="Pilih Barang Master"
              required
              hint="Bisa pilih beberapa barang sekaligus dari daftar master"
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
                options={products.map((p) => String(p.nama))}
                placeholder="Pilih barang..."
              />
            </FormField>

            {selectedItems.length > 0 ? (
              <View className="gap-3 pt-1">
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Daftar Barang & Jumlah ({selectedItems.length} item)
                </Text>

                {selectedItems.map((item) => (
                  <View
                    key={item.nama}
                    className="bg-card border-border/70 rounded-xl border p-3.5 gap-2.5"
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm font-bold text-foreground flex-1 pr-2" numberOfLines={1}>
                        {item.nama}
                      </Text>
                      <Pressable
                        onPress={() => setSelectedNames((prev) => prev.filter((n) => n !== item.nama))}
                        hitSlop={8}
                        className="size-7 items-center justify-center rounded-lg hover:bg-danger/10 active:bg-danger/10"
                      >
                        <Trash2 size={15} color={colors.danger} />
                      </Pressable>
                    </View>

                    <View className="bg-panel/40 border-border/60 rounded-lg border p-2 flex-row flex-wrap justify-between gap-1">
                      <Text className="text-xs text-muted-foreground">
                        Stok gudang: <Text className="font-semibold text-foreground">{item.stock} {item.satuan}</Text>
                      </Text>
                      <Text className="text-xs text-muted-foreground">
                        Estimasi harga: <Text className="font-semibold text-foreground">{rupiah(item.hargaBeli)} / {item.satuan}</Text>
                      </Text>
                    </View>

                    <View className="flex-row items-center justify-between pt-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-xs text-muted-foreground">Jumlah (Qty):</Text>
                        <Input
                          value={itemQuantities[item.nama] ?? "1"}
                          onChangeText={(v) =>
                            setItemQuantities((prev) => ({
                              ...prev,
                              [item.nama]: v.replace(/\D/g, "") || "1",
                            }))
                          }
                          keyboardType="numeric"
                          className="w-20 h-9 text-center text-sm font-semibold"
                        />
                        <Text className="text-xs text-muted-foreground">{item.satuan}</Text>
                      </View>

                      <View className="items-end">
                        <Text className="text-[11px] text-muted-foreground">Subtotal</Text>
                        <Text className="text-sm font-bold text-primary">
                          {rupiah(item.subtotal)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}

                {/* Total Kalkulasi Card */}
                <View className="bg-primary/10 border-primary/30 rounded-xl border p-3.5 flex-row justify-between items-center mt-1">
                  <View>
                    <Text className="text-xs font-semibold text-primary">Total Estimasi Kebutuhan</Text>
                    <Text className="text-xs text-muted-foreground">{selectedItems.length} macam barang</Text>
                  </View>
                  <Text className="text-lg font-bold text-primary">{rupiah(totalEstimatedCost)}</Text>
                </View>
              </View>
            ) : null}

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
              <Button
                onPress={() => {
                  if (selectedItems.length === 0) {
                    toast("Pilih minimal satu barang terlebih dahulu", "danger");
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
        <Panel title="Langkah 3: Ringkasan & Lampiran Bukti">
          <View className="gap-4">
            <View className="bg-panel/40 border-border rounded-xl border p-4 gap-2.5">
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

              <View className="border-t border-border/60 my-1 pt-2 gap-1.5">
                <Text className="text-xs font-semibold text-muted-foreground uppercase">Rincian Barang ({selectedItems.length} item):</Text>
                {selectedItems.map((item) => (
                  <View key={item.nama} className="flex-row justify-between text-sm py-0.5">
                    <Text className="text-sm text-foreground flex-1 pr-2" numberOfLines={1}>
                      {item.nama} <Text className="text-muted-foreground">({item.qty} {item.satuan})</Text>
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
              label="Lampirkan Bukti Permintaan (Chat WA / Email / BOQ)"
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
