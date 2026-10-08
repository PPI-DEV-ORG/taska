import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { AlertTriangle, Check } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/text";
import { PageHeader, Panel, FormField } from "@/components/taska/basics";
import { SearchableSelect } from "@/components/taska/dialogs";
import { FileUploader } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { BOS_THRESHOLD, colors } from "@/tokens";
import { rupiah } from "@/lib/format";

const KATEGORI_LIST = [
  "Bensin",
  "Makan & Lembur",
  "Transport & Taksi",
  "Parkir & Tol",
  "Perlengkapan Teknisi",
  "Penginapan / Hotel",
  "Lain-lain",
];

export default function NewExpenseScreen() {
  const router = useRouter();
  const { data, user, addRow, toast } = useApp();

  const [nominal, setNominal] = React.useState("");
  const [kategori, setKategori] = React.useState(KATEGORI_LIST[0]);
  const [selectedProject, setSelectedProject] = React.useState("-");
  const [alasan, setAlasan] = React.useState("");
  const [photoCount, setPhotoCount] = React.useState(0);

  const numNominal = Number(nominal.replace(/\D/g, "")) || 0;
  const isBig = numNominal > BOS_THRESHOLD;

  function submit() {
    if (numNominal <= 0) {
      toast("Nominal pengeluaran harus lebih dari 0", "danger");
      return;
    }
    if (!alasan.trim()) {
      toast("Keterangan pengeluaran wajib diisi", "danger");
      return;
    }

    const row = {
      tanggal: "2026-10-08",
      pelapor: user?.name || "Karyawan",
      kategori,
      nominal: numNominal,
      project: selectedProject,
      alasan,
      status: "Dilaporkan",
      nota: photoCount > 0 ? "nota.jpg" : "-",
    };

    addRow("expenses", row);
    toast("Pengeluaran dilaporkan ke Finance untuk reimbursement");
    router.replace("/expenses");
  }

  return (
    <View className="max-w-2xl self-center w-full gap-5">
      <PageHeader
        back
        title="Catat Pengeluaran Cepat"
        subtitle="Klaim reimbursement harian, bensin, makan, atau perlengkapan lapangan"
      />

      <Panel title="Detail Pengeluaran">
        <View className="gap-4">
          <FormField label="Nominal Pengeluaran (Rp)" required>
            <Input
              value={nominal ? rupiah(numNominal) : ""}
              onChangeText={(v) => setNominal(v.replace(/\D/g, ""))}
              keyboardType="numeric"
              placeholder="Contoh: 150000"
            />
          </FormField>

          {isBig && (
            <View className="bg-warning/15 flex-row items-center gap-2 rounded-xl p-3">
              <AlertTriangle size={18} color={colors.warning} />
              <Text className="text-warning text-xs flex-1">
                Nominal di atas {rupiah(BOS_THRESHOLD)} otomatis memerlukan persetujuan tambahan dari Bos selain Finance.
              </Text>
            </View>
          )}

          <FormField label="Kategori Pengeluaran" required>
            <SearchableSelect
              value={kategori}
              onChange={setKategori}
              options={KATEGORI_LIST}
              placeholder="Pilih kategori"
            />
          </FormField>

          <FormField label="Terkait Project (Opsional)">
            <SearchableSelect
              value={selectedProject}
              onChange={setSelectedProject}
              options={["-", ...data.projects.map((p) => p.nama)]}
              placeholder="Pilih project jika ada"
            />
          </FormField>

          <FormField label="Alasan / Keperluan Pengeluaran" required>
            <Textarea
              value={alasan}
              onChangeText={setAlasan}
              placeholder="Contoh: Isi bensin mobil operasional perjalanan ke lokasi Surabaya"
            />
          </FormField>
        </View>
      </Panel>

      <Panel title="Foto Bukti Nota / Struk Pembayaran" subtitle="Wajib melampirkan foto nota untuk reimbursement">
        <FileUploader
          label="Foto Nota Pembayaran"
          kind="foto"
          required
          onChange={setPhotoCount}
        />
      </Panel>

      <Button size="lg" onPress={submit}>
        <Check size={18} color={colors.background} />
        <Text>Kirim Laporan Pengeluaran</Text>
      </Button>
    </View>
  );
}
