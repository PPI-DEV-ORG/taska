import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Check, Info } from "lucide-react-native";
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

export default function NewDeliveryNoteScreen() {
  const router = useRouter();
  const { data, user, addRow, toast } = useApp();

  const [tujuan, setTujuan] = React.useState("");
  const [alasan, setAlasan] = React.useState("");
  const [selectedProject, setSelectedProject] = React.useState("-");
  const [hasGoods, setHasGoods] = React.useState(false);
  const [goodsDesc, setGoodsDesc] = React.useState("");
  const [scannedItems, setScannedItems] = React.useState<Scan[]>([]);

  function submit() {
    if (!tujuan.trim()) {
      toast("Tujuan wajib diisi", "danger");
      return;
    }
    if (!alasan.trim()) {
      toast("Alasan dinas/keluar kantor wajib diisi", "danger");
      return;
    }

    const row = {
      nomor: `SJ/2026/10/${Math.floor(Math.random() * 800) + 100}`,
      tanggal: "2026-10-08",
      tujuan,
      alasan,
      project: selectedProject,
      pembuat: user?.name || "Karyawan",
      barang: hasGoods ? (goodsDesc || `${scannedItems.length} unit SN`) : "-",
      status: "Pending",
      persetujuan: "Menunggu persetujuan",
    };

    addRow("delivery-notes", row);
    toast("Surat jalan berhasil dibuat dan menunggu persetujuan Finance");
    router.replace("/delivery-notes");
  }

  return (
    <View className="max-w-2xl self-center w-full gap-5">
      <PageHeader
        back
        title="Buat Surat Jalan"
        subtitle="Untuk setiap aktivitas tugas kerja ke luar kantor"
      />

      <View className="bg-panel/40 border-border flex-row items-center gap-2 rounded-xl border p-3">
        <Info size={18} color={colors.info} />
        <Text className="text-text-secondary text-xs flex-1">
          Surat jalan dibuat setiap kali karyawan keluar untuk urusan pekerjaan (survey, meeting, antar barang, instalasi). Keluar hanya untuk beli makan atau jajan tidak perlu surat jalan.
        </Text>
      </View>

      <Panel title="Detail Tujuan & Alasan Tugas">
        <View className="gap-4">
          <FormField label="Lokasi Tujuan (Bisa lebih dari 1 lokasi)" required>
            <Input
              value={tujuan}
              onChangeText={setTujuan}
              placeholder="Contoh: Gedung Wisma Sudirman Lt. 8 & Ruko Bekasi"
            />
          </FormField>

          <FormField label="Alasan / Keperluan Kerja" required hint="Alasan wajib diisi secara jelas">
            <Textarea
              value={alasan}
              onChangeText={setAlasan}
              placeholder="Contoh: Instalasi reader access control lantai 3 & survey jalur kabel"
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
        </View>
      </Panel>

      <Panel
        title="Barang yang Dibawa"
        subtitle="Surat jalan boleh dengan barang atau tanpa barang"
        right={
          <Button
            variant={hasGoods ? "default" : "outline"}
            size="sm"
            onPress={() => setHasGoods(!hasGoods)}
          >
            <Text>{hasGoods ? "Membawa Barang" : "Tanpa Barang"}</Text>
          </Button>
        }
      >
        {hasGoods ? (
          <View className="gap-4">
            <FormField label="Keterangan Barang yang Dibawa">
              <Input
                value={goodsDesc}
                onChangeText={setGoodsDesc}
                placeholder="Contoh: 4 pcs Reader Fingerprint, 1 box Kabel LAN"
              />
            </FormField>

            <View className="gap-2">
              <Text className="text-sm font-medium">Scan SN Unit Barang (Wajib di-scan Gudang sebelum keluar)</Text>
              <ScanInput onResult={setScannedItems} />
            </View>
          </View>
        ) : (
          <Text className="text-muted-foreground text-sm">
            Surat jalan ini tidak membawa barang (hanya keperluan dinas luar/meeting/survey).
          </Text>
        )}
      </Panel>

      <Panel title="Lampiran / Surat Jalan Bertandatangan">
        <FileUploader
          label="Upload Dokumen Pendukung (Opsional)"
          kind="semua"
        />
      </Panel>

      <Button size="lg" onPress={submit}>
        <Check size={18} color={colors.background} />
        <Text>Ajukan Surat Jalan</Text>
      </Button>
    </View>
  );
}
