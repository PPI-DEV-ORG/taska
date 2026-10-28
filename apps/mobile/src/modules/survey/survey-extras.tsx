import * as React from "react";
import { View, ScrollView, Pressable, Linking, Image } from "react-native";
import { Printer, Plus, Edit3, Camera } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Panel } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { DatePicker, formatThousands } from "@/components/taska/dialogs";
import { FileUploader, type FileUploaderHandle } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { apiBase, downloadDocumentationPdf } from "@/services/api";
import { colors } from "@/tokens";
import { rupiah, tanggal } from "@/lib/format";
import { type Row } from "@/constants/modules";
import { DocumentationPhotosPanel } from "@/modules/shared/documentation-photos-panel";
import { Line } from "@/modules/shared/line";

export function SurveyExtras({ row }: { row: Row }) {
  const { addRow, patchRow, toast, data, user } = useApp();
  const [techNoteOpen, setTechNoteOpen] = React.useState(false);
  const [techNotes, setTechNotes] = React.useState(row.catatanTeknis || "");
  const [inputTechNotes, setInputTechNotes] = React.useState(techNotes);
  const [selectedExp, setSelectedExp] = React.useState<Row | null>(null);

  const [expenseOpen, setExpenseOpen] = React.useState(false);
  const [expNominal, setExpNominal] = React.useState("");
  const [expKategori, setExpKategori] = React.useState("Bensin");
  const [expFundingSource, setExpFundingSource] = React.useState<"PERUSAHAAN" | "TALANGAN_PRIBADI">("TALANGAN_PRIBADI");
  const [expTanggal, setExpTanggal] = React.useState("");
  const [expKet, setExpKet] = React.useState("");
  const [expFileId, setExpFileId] = React.useState<number | null>(null);
  const fileUploaderRef = React.useRef<FileUploaderHandle | null>(null);

  const [reportOpen, setReportOpen] = React.useState(false);

  const surveyExpenses = React.useMemo(() => {
    return (data.expenses ?? []).filter((e: Row) => {
      if (e.surveyId && String(e.surveyId) === String(row.id)) return true;
      if (e.survey && String(e.survey).includes(`#${row.id}`)) return true;
      if (row.lead && e.alasan && String(e.alasan).toLowerCase().includes(`survey ${String(row.lead).toLowerCase()}`)) return true;
      return false;
    });
  }, [data.expenses, row.id, row.lead]);

  const totalBiayaTerpakai = React.useMemo(() => {
    return surveyExpenses.reduce((acc: number, e: Row) => acc + (Number(e.nominal || e.amount) || 0), 0);
  }, [surveyExpenses]);

  const companyCost = React.useMemo(() => {
    return surveyExpenses
      .filter(
        (e: Row) =>
          e.fundingSource === "PERUSAHAAN" ||
          e.sumberDana?.includes("Perusahaan") ||
          (!e.fundingSource && !e.sumberDana?.includes("Talangan"))
      )
      .reduce((acc: number, e: Row) => acc + (Number(e.nominal || e.amount) || 0), 0);
  }, [surveyExpenses]);

  const personalAdvanceCost = React.useMemo(() => {
    return surveyExpenses
      .filter(
        (e: Row) =>
          e.fundingSource === "TALANGAN_PRIBADI" ||
          e.sumberDana?.includes("Talangan")
      )
      .reduce((acc: number, e: Row) => acc + (Number(e.nominal || e.amount) || 0), 0);
  }, [surveyExpenses]);

  function handleSaveTechNotes() {
    setTechNotes(inputTechNotes);
    patchRow("surveys", row.id, { catatanTeknis: inputTechNotes });
    setTechNoteOpen(false);
    toast("Catatan teknis lapangan berhasil disimpan");
  }

  async function handleAddExpense() {
    const nom = Number(expNominal.replace(/\D/g, "")) || 0;
    if (nom <= 0) {
      toast("Nominal pengeluaran tidak valid", "danger");
      return;
    }
    let uploadedId = expFileId;
    if (!uploadedId && fileUploaderRef.current?.hasStaged()) {
      try {
        uploadedId = await fileUploaderRef.current.flush();
      } catch {}
    }
    const today = new Date().toISOString().slice(0, 10);
    const reporterName = user?.name || (String(row.tim || "Teknisi").split("+")[0]?.trim() || "Teknisi");

    await addRow("expenses", {
      surveyId: Number(row.id),
      survey: `Survey #${row.id} - ${row.lead || row.customer || "Survey"}`,
      project: row.lead || row.customer || "-",
      nominal: nom,
      kategori: expKategori,
      tanggal: expTanggal || today,
      alasan: expKet.trim() || `Survey ${row.lead || ""}: ${expKategori}`.trim(),
      pelapor: reporterName,
      fileId: uploadedId || null,
      receiptFileId: uploadedId || null,
      fundingSource: expFundingSource,
      sumberDana: expFundingSource === "TALANGAN_PRIBADI" ? "Talangan Pribadi (Reimbursement)" : "Kas Kecil / Petty Cash Perusahaan",
      status: "Dilaporkan",
    });

    setExpenseOpen(false);
    setExpNominal("");
    setExpKet("");
    setExpTanggal("");
    setExpFileId(null);
    setExpFundingSource("TALANGAN_PRIBADI");
    toast(`Biaya survey ${rupiah(nom)} dicatat ke modul Pengeluaran`);
  }

  async function handlePrintSurveyReport() {
    const ok = await downloadDocumentationPdf("survey", row.id);
    if (ok) {
      toast("PDF Laporan Survey berhasil diunduh");
      return;
    }
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  return (
    <>
      <Panel
        title="Catatan Teknis Lapangan"
        subtitle="Spesifikasi kondisi lapangan untuk pertimbangan estimasi biaya & penawaran teknis."
        right={
          <Button size="sm" variant="outline" onPress={() => { setInputTechNotes(techNotes); setTechNoteOpen(true); }}>
            <Edit3 size={13} color={colors.text} />
            <Text className="text-xs">Ubah Catatan</Text>
          </Button>
        }
      >
        {techNotes.trim() ? (
          <Text className="text-sm leading-relaxed text-foreground">{techNotes}</Text>
        ) : (
          <Text className="text-xs text-muted-foreground italic py-1">
            Belum ada catatan teknis lapangan. Klik &quot;Ubah Catatan&quot; untuk menambahkan kondisi teknis (plafon, instalasi kabel, akses, kendala, dll).
          </Text>
        )}
      </Panel>

      <DocumentationPhotosPanel
        kind="survey"
        entityId={row.id}
        title="Dokumentasi Foto Lapangan"
        subtitle="Bukti kondisi fisik lokasi survey untuk tim project & sales (terkompilasi otomatis ke PDF)."
      />

      <Panel
        title="Biaya Operasional & Reimbursement Survey"
        subtitle="Tracking pengeluaran terhubung, pemisahan dana perusahaan vs talangan pribadi"
        right={
          <Button size="sm" onPress={() => setExpenseOpen(true)} className="gap-1.5">
            <Plus size={14} color={colors.background} />
            <Text className="text-xs font-semibold">+ Catat Biaya Survey</Text>
          </Button>
        }
      >
        <View className="gap-4">
          <View className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <View className="p-3 rounded-lg bg-card/60 border border-border">
              <Text className="text-xs text-muted-foreground">Anggaran (Budget)</Text>
              <Text className="text-base font-bold mt-1">{rupiah(row.biaya || row.cost || row.anggaran || 0)}</Text>
            </View>
            <View className="p-3 rounded-lg bg-card/60 border border-border">
              <Text className="text-xs text-muted-foreground">Total Biaya Terpakai</Text>
              <Text className="text-base font-bold mt-1 text-primary">{rupiah(totalBiayaTerpakai)}</Text>
            </View>
            <View className="p-3 rounded-lg bg-card/60 border border-border">
              <Text className="text-xs text-muted-foreground">Dana Perusahaan</Text>
              <Text className="text-base font-bold mt-1">{rupiah(companyCost)}</Text>
            </View>
            <View className="p-3 rounded-lg bg-card/60 border border-border">
              <Text className="text-xs text-muted-foreground">Talangan Pribadi (Klaim)</Text>
              <Text className="text-base font-bold mt-1 text-amber-500">{rupiah(personalAdvanceCost)}</Text>
            </View>
          </View>

          {/* Expense table */}
          {surveyExpenses.length === 0 ? (
            <Text className="text-xs text-muted-foreground py-4 text-center">
              Belum ada pengeluaran yang dicatat untuk survey ini.
            </Text>
          ) : (
            <View className="divide-y divide-border border border-border rounded-lg overflow-hidden">
              {surveyExpenses.map((exp: Row, idx: number) => {
                const hasReceipt = !!(exp.receiptFileId || exp.fileId || (exp.receiptFile as any)?.id);
                const isTalangan = exp.fundingSource === "TALANGAN_PRIBADI" || exp.sumberDana?.includes("Talangan");
                return (
                  <Pressable
                    key={exp.id || idx}
                    onPress={() => setSelectedExp(exp)}
                    className="p-3 flex-row items-center justify-between bg-card/30 hover:bg-muted/30 active:opacity-75 transition-colors cursor-pointer"
                  >
                    <View className="flex-1 pr-2">
                      <View className="flex-row items-center gap-2 flex-wrap">
                        <Text className="text-sm font-semibold text-foreground">
                          {exp.alasan || exp.description || exp.kategori}
                        </Text>
                        <StatusBadge status={exp.status || "Dilaporkan"} />
                        <View
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            isTalangan
                              ? "bg-amber-500/15 text-amber-500"
                              : "bg-blue-500/15 text-blue-500"
                          }`}
                        >
                          <Text className="text-[10px]">
                            {isTalangan ? "Talangan Pribadi" : "Dana Kantor"}
                          </Text>
                        </View>
                      </View>
                      <View className="flex-row items-center gap-2 mt-1 flex-wrap">
                        <Text className="text-xs text-muted-foreground">
                          {tanggal(exp.tanggal || exp.date || exp.dibuat)} • Pelapor: {exp.pelapor || "Teknisi"} • Kategori: {exp.kategori || "-"}
                        </Text>
                        {hasReceipt ? (
                          <View className="flex-row items-center gap-0.5 bg-primary/10 px-1.5 py-0.5 rounded">
                            <Camera size={10} color={colors.primary} />
                            <Text className="text-[9px] text-primary font-medium">Ada Nota</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <View className="items-end gap-1">
                      <Text className="text-sm font-bold text-foreground">{rupiah(exp.nominal || exp.amount || 0)}</Text>
                      <Text className="text-[10px] text-primary underline">Lihat Detail</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </Panel>

      <Panel
        title="Kompilasi Laporan Survey Resmi"
        subtitle="Buat dokumen kompilasi laporan survey teknis untuk dilampirkan atau dicetak."
      >
        <View className="flex-row items-center justify-between">
          <Text className="text-xs text-muted-foreground flex-1 pr-3">
            Kompilasi mencakup data pelanggan, tim teknisi, catatan kondisi fisik, dan galeri foto.
          </Text>
          <Button size="sm" variant="outline" onPress={() => setReportOpen(true)} className="flex-row items-center gap-1.5">
            <Printer size={14} color={colors.text} />
            <Text className="text-xs">Preview & Unduh PDF</Text>
          </Button>
        </View>
      </Panel>

      {/* Modal Edit Catatan Teknis */}
      <Dialog open={techNoteOpen} onOpenChange={setTechNoteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Catatan Teknis Lapangan</DialogTitle>
          </DialogHeader>
          <View className="py-2">
            <Textarea
              value={inputTechNotes}
              onChangeText={setInputTechNotes}
              placeholder="Tuliskan kondisi plafon, jarak kabel, stop kontak, kendala..."
              numberOfLines={4}
            />
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setTechNoteOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSaveTechNotes}>
              <Text>Simpan Catatan</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Catat Biaya Survey */}
      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Catat Biaya Operasional Survey</DialogTitle>
          </DialogHeader>
          <ScrollView className="py-2">
            <View className="gap-3">
              <View className="gap-1.5">
                <Text className="text-xs text-muted-foreground font-medium">Kategori Biaya</Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {(["Bensin", "Makan", "Parkir & tol", "Transport", "Perlengkapan", "Lainnya"] as const).map((k) => (
                    <Button
                      key={k}
                      size="sm"
                      variant={expKategori === k ? "default" : "outline"}
                      onPress={() => setExpKategori(k)}
                      className="h-8 px-2.5"
                    >
                      <Text className="text-xs">{k}</Text>
                    </Button>
                  ))}
                </View>
              </View>
              <View className="gap-1.5">
                <Text className="text-xs text-muted-foreground font-medium">Sumber Dana</Text>
                <View className="flex-row gap-2">
                  <Button
                    size="sm"
                    variant={expFundingSource === "TALANGAN_PRIBADI" ? "default" : "outline"}
                    onPress={() => setExpFundingSource("TALANGAN_PRIBADI")}
                    className="flex-1 h-8"
                  >
                    <Text className="text-xs">Talangan Pribadi</Text>
                  </Button>
                  <Button
                    size="sm"
                    variant={expFundingSource === "PERUSAHAAN" ? "default" : "outline"}
                    onPress={() => setExpFundingSource("PERUSAHAAN")}
                    className="flex-1 h-8"
                  >
                    <Text className="text-xs">Dana Kantor</Text>
                  </Button>
                </View>
              </View>
              <View className="gap-1">
                <Text className="text-xs text-muted-foreground">Nominal (Rp)</Text>
                <Input
                  value={expNominal}
                  onChangeText={(v) => setExpNominal(formatThousands(v))}
                  placeholder="Contoh: 150.000"
                  keyboardType="numeric"
                />
              </View>
              <View className="gap-1">
                <Text className="text-xs text-muted-foreground">Tanggal Pengeluaran</Text>
                <DatePicker
                  value={expTanggal || new Date().toISOString().slice(0, 10)}
                  onChange={setExpTanggal}
                  placeholder="Pilih tanggal pengeluaran"
                />
              </View>
              <View className="gap-1">
                <Text className="text-xs text-muted-foreground">Keterangan / Keperluan</Text>
                <Input
                  value={expKet}
                  onChangeText={setExpKet}
                  placeholder="Contoh: Bensin motor survey lokasi PP"
                />
              </View>
              <View className="gap-1 pt-1">
                <Text className="text-xs text-muted-foreground font-medium">Foto Nota Pembayaran (Opsional)</Text>
                <FileUploader
                  label="Unggah Foto Struk / Nota / Bon"
                  kind="foto"
                  category="foto-struk"
                  handleRef={(h) => { fileUploaderRef.current = h; }}
                  onUploaded={(id) => setExpFileId(id)}
                />
              </View>
            </View>
          </ScrollView>
          <DialogFooter>
            <Button variant="outline" onPress={() => setExpenseOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleAddExpense}>
              <Text>Simpan Biaya</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Detail Biaya Survey */}
      <Dialog open={!!selectedExp} onOpenChange={(open) => { if (!open) setSelectedExp(null); }}>
        <DialogContent className="sm:max-w-md max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Detail Biaya Operasional Survey</DialogTitle>
          </DialogHeader>
          {selectedExp ? (() => {
            const fid = selectedExp.receiptFileId || selectedExp.fileId || (selectedExp.receiptFile as any)?.id;
            const photoUrl = fid ? `${apiBase()}/files/${fid}` : null;

            return (
              <ScrollView className="py-2">
                <View className="gap-2.5">
                  <View className="gap-2 bg-panel/50 p-2.5 rounded-xl border border-border/70">
                    <Line left="Kategori Biaya" right={<StatusBadge status={selectedExp.kategori || "Biaya"} />} />
                    <Line left="Nominal" right={<Text className="text-base font-bold text-primary">{rupiah(selectedExp.nominal || 0)}</Text>} />
                    <Line left="Keterangan / Alasan" right={<Text className="text-xs font-medium max-w-[220px] text-right">{selectedExp.alasan || "-"}</Text>} />
                    <Line left="Pelapor" right={<Text className="text-xs font-semibold">{selectedExp.pelapor || "-"}</Text>} />
                    <Line
                      left="Sumber Dana"
                      right={
                        <Text className="text-xs font-semibold">
                          {selectedExp.fundingSource === "TALANGAN_PRIBADI" || selectedExp.sumberDana?.includes("Talangan")
                            ? "Talangan Pribadi (Reimbursement)"
                            : "Kas Kecil / Perusahaan"}
                        </Text>
                      }
                    />
                    <Line left="Tanggal Dicatat" right={<Text className="text-xs text-muted-foreground">{selectedExp.tanggal || selectedExp.dibuat || "-"}</Text>} />
                    <Line left="Status Pengeluaran" right={<StatusBadge status={selectedExp.status || "Dilaporkan"} />} />
                  </View>

                  {photoUrl ? (
                    <View className="gap-1.5 pt-1">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs text-muted-foreground font-semibold">Bukti Nota / Struk Pembayaran</Text>
                        <Pressable onPress={() => Linking.openURL(photoUrl).catch(() => {})}>
                          <Text className="text-[11px] text-primary underline">Buka Ukuran Penuh</Text>
                        </Pressable>
                      </View>
                      <Pressable
                        onPress={() => Linking.openURL(photoUrl).catch(() => {})}
                        className="h-48 w-full bg-muted/20 rounded-xl overflow-hidden border border-border/80 items-center justify-center cursor-pointer active:opacity-75"
                      >
                        <Image
                          source={{ uri: photoUrl }}
                          style={{ width: "100%", height: "100%" }}
                          resizeMode="contain"
                        />
                      </Pressable>
                    </View>
                  ) : (
                    <Text className="text-xs text-muted-foreground italic py-1 text-center">
                      Tidak ada lampiran foto nota pembayaran untuk pengeluaran ini.
                    </Text>
                  )}
                </View>
              </ScrollView>
            );
          })() : null}
          <DialogFooter>
            <Button onPress={() => setSelectedExp(null)}>
              <Text>Tutup</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Preview Laporan Survey */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Laporan Hasil Survey Teknis Lapangan</DialogTitle>
          </DialogHeader>
          <ScrollView className="py-2 gap-4">
            <View className="bg-panel border-border/80 rounded-xl border p-4 gap-2">
              <Text className="font-bold text-sm tracking-wide">PT GHINA MULTI PRIMA / TASKA</Text>
              <Text className="text-xs text-muted-foreground">Laporan Resmi Inspeksi Lapangan</Text>
              <View className="border-border border-t pt-2 gap-1 mt-1">
                <Text className="text-xs font-semibold">Lead / Project: {row.lead}</Text>
                <Text className="text-xs text-muted-foreground">Customer: {row.customer}</Text>
                <Text className="text-xs text-muted-foreground">Lokasi: {row.lokasi}</Text>
                <Text className="text-xs text-muted-foreground">Jadwal: {tanggal(row.jadwal)}</Text>
                <Text className="text-xs text-muted-foreground">Tim Teknisi: {row.tim}</Text>
              </View>
            </View>

            <View className="border-border border rounded-xl p-3 gap-1.5">
              <Text className="text-xs font-semibold text-foreground">Catatan Hasil Pengecekan Fisik</Text>
              <Text className="text-xs leading-relaxed text-muted-foreground">{techNotes}</Text>
            </View>

            <View className="border-border border rounded-xl p-3 flex-row items-center justify-between">
              <Text className="text-xs font-semibold">Total Biaya Operasional Survey:</Text>
              <Text className="text-sm font-bold text-primary">{rupiah(row.biaya || 0)}</Text>
            </View>
          </ScrollView>
          <DialogFooter>
            <Button variant="outline" onPress={() => setReportOpen(false)}>
              <Text>Tutup</Text>
            </Button>
            <Button onPress={handlePrintSurveyReport} className="flex-row items-center gap-1.5">
              <Printer size={14} color={colors.background} />
              <Text>Unduh / Cetak PDF</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
