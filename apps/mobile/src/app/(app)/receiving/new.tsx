import * as React from "react";
import { View, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Check, PackageCheck } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/text";
import { PageHeader, Panel, FormField } from "@/components/taska/basics";
import { SearchableSelect } from "@/components/taska/dialogs";
import { ScanInput, type Scan } from "@/components/taska/scan-input";
import { FileUploader } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";

export default function NewReceivingScreen() {
  const router = useRouter();
  const { data, addRow, toast } = useApp();

  const [selectedPo, setSelectedPo] = React.useState(data["supplier-pos"][0]?.nomor || "");
  const [qtyReceived, setQtyReceived] = React.useState("4");
  const [notes, setNotes] = React.useState("");
  const [scannedUnits, setScannedUnits] = React.useState<Scan[]>([]);

  const po = data["supplier-pos"].find((p) => p.nomor === selectedPo) || data["supplier-pos"][0];

  function submit() {
    if (!po) return;
    const row = {
      nomor: `TB/2026/10/${Math.floor(Math.random() * 800) + 100}`,
      po: selectedPo,
      supplier: po.supplier,
      item: `${po.item} (${qtyReceived} unit diterima)`,
      tanggal: "2026-10-08",
      penerima: "Eko Saputra",
      status: "Diterima",
      catatan: notes,
    };

    addRow("receiving", row);
    toast("Penerimaan barang dicatat di Gudang");
    router.replace("/receiving");
  }

  return (
    <View className="max-w-2xl self-center w-full gap-5">
      <PageHeader
        back
        title="Penerimaan Barang (Gudang)"
        subtitle="Verifikasi fisik barang tiba dari supplier & pencatatan Serial Number"
      />

      <Panel title="Pilih PO Supplier & Cek Fisik">
        <View className="gap-4">
          <FormField label="Pilih PO Supplier Terkait" required>
            <SearchableSelect
              value={selectedPo}
              onChange={setSelectedPo}
              options={data["supplier-pos"].map((p) => p.nomor)}
              placeholder="Pilih nomor PO"
            />
          </FormField>

          {po && (
            <View className="bg-panel/40 border-border rounded-xl border p-4 gap-1.5">
              <Text className="text-text-secondary text-xs">Informasi PO Terpilih:</Text>
              <Text className="text-sm font-semibold">{po.supplier}</Text>
              <Text className="text-muted-foreground text-xs">Barang dipesan: {po.item}</Text>
              <Text className="text-muted-foreground text-xs">Total nilai: {po.total ? po.total.toLocaleString("id-ID") : "-"}</Text>
            </View>
          )}

          <FormField label="Jumlah Diterima (Penerimaan sebagian diperbolehkan)" required>
            <Input
              value={qtyReceived}
              onChangeText={setQtyReceived}
              keyboardType="numeric"
              placeholder="Jumlah unit/pcs/meter yang tiba"
            />
          </FormField>

          <FormField label="Catatan Kondisi Fisik Kemasan/Barang">
            <Textarea
              value={notes}
              onChangeText={setNotes}
              placeholder="Kondisi kardus baik, segel utuh, tidak ada cacat fisik"
            />
          </FormField>
        </View>
      </Panel>

      <Panel
        title="Scan Serial Number (SN) Unit Tiba"
        subtitle="Scan barcode fisik atau input manual satu per satu. SN harus unik."
      >
        <ScanInput onResult={setScannedUnits} />
      </Panel>

      <Panel title="Foto Dokumentasi & Surat Jalan Supplier (DO)">
        <FileUploader
          label="Foto Kondisi Barang & Tanda Terima"
          kind="foto"
        />
      </Panel>

      <Button size="lg" onPress={submit}>
        <Check size={18} color={colors.background} />
        <Text>Simpan Penerimaan Barang</Text>
      </Button>
    </View>
  );
}
