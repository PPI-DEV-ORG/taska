import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Check, Info, Trash2 } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/text";
import { PageHeader, Panel, FormField } from "@/components/taska/basics";
import { DatePicker, SearchableSelect, MultiSelect } from "@/components/taska/dialogs";
import { FileUploader, type FileUploaderHandle } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { Pressable } from "react-native";

export default function NewDeliveryNoteScreen() {
  const router = useRouter();
  const { data, user, addRow, toast } = useApp();
  const fileHandle = React.useRef<FileUploaderHandle | null>(null);

  const [tanggalSj, setTanggalSj] = React.useState(new Date().toISOString().slice(0, 10));
  const [tujuan, setTujuan] = React.useState("");
  const [alasan, setAlasan] = React.useState("");
  const [selectedProject, setSelectedProject] = React.useState("-");
  const [hasGoods, setHasGoods] = React.useState(false);
  const [selectedProductNames, setSelectedProductNames] = React.useState<string[]>([]);
  const [itemQuantities, setItemQuantities] = React.useState<Record<string, string>>({});
  const [itemSerials, setItemSerials] = React.useState<Record<string, string[]>>({});
  const serials: any[] = data.serials ?? [];

  async function submit() {
    if (!tujuan.trim()) {
      toast("Tujuan wajib diisi", "danger");
      return;
    }
    if (!alasan.trim()) {
      toast("Alasan dinas/keluar kantor wajib diisi", "danger");
      return;
    }
    if (hasGoods && selectedProductNames.length === 0) {
      toast("Pilih minimal satu barang yang dibawa", "danger");
      return;
    }

    let fileId: number | undefined;
    try {
      fileId = (await fileHandle.current?.flush()) ?? undefined;
    } catch {
      return;
    }

    const itemsSummary = selectedProductNames
      .map((name) => {
        const prod = data.products.find((p) => p.nama === name);
        const sns = itemSerials[name] ?? [];
        const q = prod?.berSN && sns.length > 0 ? sns.length : (Number(itemQuantities[name]) || 1);
        return `${name} x ${q}${prod?.satuan ? ` ${prod.satuan}` : ""}${sns.length > 0 ? ` (SN: ${sns.join(", ")})` : ""}`;
      })
      .join(", ");

    const itemsList = selectedProductNames.map((name) => {
      const prod = data.products.find((p) => p.nama === name);
      const sns = itemSerials[name] ?? [];
      return {
        productId: prod?.id ? Number(prod.id) : undefined,
        qty: prod?.berSN && sns.length > 0 ? sns.length : (Number(itemQuantities[name]) || 1),
        serials: sns.length > 0 ? sns : undefined,
      };
    });

    const row = {
      nomor: `SJ/${new Date().getFullYear()}/${Math.floor(Math.random() * 800) + 100}`,
      tanggal: tanggalSj,
      tujuan,
      alasan,
      project: selectedProject,
      pembuat: user?.name || "Karyawan",
      barang: hasGoods ? itemsSummary : "-",
      withGoods: hasGoods,
      reportText: hasGoods ? itemsSummary : undefined,
      items: hasGoods ? itemsList : undefined,
      status: "Pending",
      persetujuan: "Menunggu persetujuan",
      fileId,
      scanFileId: fileId ? Number(fileId) : undefined,
    };

    addRow("delivery-notes", row);
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
          <FormField label="Tanggal Surat Jalan" required>
            <DatePicker
              value={tanggalSj}
              onChange={setTanggalSj}
              placeholder="Pilih tanggal"
            />
          </FormField>

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
            variant={hasGoods ? "outline" : "default"}
            size="sm"
            onPress={() => setHasGoods(!hasGoods)}
          >
            <Text>{hasGoods ? "Tanpa Barang" : "Membawa Barang"}</Text>
          </Button>
        }
      >
        {hasGoods ? (
          <View className="gap-4">
            <FormField
              label="Pilih Barang yang Dibawa"
              required
              hint="Bisa pilih beberapa barang dari daftar master"
            >
              <MultiSelect
                values={selectedProductNames}
                onChange={(newNames) => {
                  setSelectedProductNames(newNames);
                  setItemQuantities((prev) => {
                    const next = { ...prev };
                    newNames.forEach((name) => {
                      if (!next[name]) next[name] = "1";
                    });
                    return next;
                  });
                }}
                options={data.products.map((p) => String(p.nama))}
                placeholder="Pilih barang yang dibawa..."
              />
            </FormField>

            {selectedProductNames.length > 0 ? (
              <View className="gap-2.5 pt-1">
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Daftar Barang & Jumlah ({selectedProductNames.length} item)
                </Text>
                {selectedProductNames.map((name) => {
                  const prod = data.products.find((p) => p.nama === name);
                  const chosenSns = itemSerials[name] ?? [];
                  const qtyVal = prod?.berSN && chosenSns.length > 0 ? String(chosenSns.length) : (itemQuantities[name] ?? "1");
                  const availSns = prod?.berSN
                    ? serials
                        .filter(
                          (s) =>
                            (String(s.productId) === String(prod.id) || s.produk === prod.nama) &&
                            (s.rawStatus === "DI_GUDANG" || s.rawStatus === "RESERVED" || s.status === "Di gudang" || s.status === "Reserved"),
                        )
                        .sort((a, b) => Number(a.id) - Number(b.id))
                        .map((s) => String(s.sn))
                    : [];
                  return (
                    <View
                      key={name}
                      className="bg-card border-border/70 rounded-xl border p-3 gap-2.5"
                    >
                      <View className="flex-row items-center justify-between gap-3">
                        <View className="flex-1">
                          <View className="flex-row items-center gap-2">
                            <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                              {name}
                            </Text>
                            {prod?.merk ? (
                              <View className="bg-panel border-border/60 rounded px-1.5 py-0.5 border">
                                <Text className="text-[10px] font-medium text-muted-foreground">{prod.merk}</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text className="text-xs text-muted-foreground mt-0.5">
                            Satuan: {String(prod?.satuan || "unit")} {prod?.berSN ? "· Lacak SN" : "· Curah"}
                          </Text>
                        </View>

                        <View className="flex-row items-center gap-2">
                          <Text className="text-xs text-muted-foreground">Qty:</Text>
                          <Input
                            value={qtyVal}
                            onChangeText={(v) =>
                              setItemQuantities((prev) => ({
                                ...prev,
                                [name]: v.replace(/\D/g, "") || "1",
                              }))
                            }
                            keyboardType="numeric"
                            className="w-16 h-9 text-center text-sm font-semibold"
                          />
                          <Pressable
                            onPress={() => {
                              setSelectedProductNames((prev) => prev.filter((n) => n !== name));
                            }}
                            hitSlop={8}
                            className="size-8 items-center justify-center rounded-lg hover:bg-danger/10 active:bg-danger/10"
                          >
                            <Trash2 size={16} color={colors.danger} />
                          </Pressable>
                        </View>
                      </View>

                      {prod?.berSN && (
                        <View className="pt-2 border-t border-border/50">
                          <FormField label={`Pilih Unit SN yang Dibawa (${availSns.length} unit tersedia/reserved)`}>
                            <MultiSelect
                              values={chosenSns}
                              options={availSns}
                              onChange={(sns) => {
                                setItemSerials((prev) => ({ ...prev, [name]: sns }));
                                if (sns.length > 0) {
                                  setItemQuantities((prev) => ({ ...prev, [name]: String(sns.length) }));
                                }
                              }}
                              placeholder="Pilih SN kamera / perangkat yang dibawa..."
                            />
                          </FormField>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : null}
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
          category="surat-jalan"
          handleRef={(h) => { fileHandle.current = h; }}
        />
      </Panel>

      <Button size="lg" onPress={submit}>
        <Check size={18} color={colors.background} />
        <Text>Ajukan Surat Jalan</Text>
      </Button>
    </View>
  );
}
