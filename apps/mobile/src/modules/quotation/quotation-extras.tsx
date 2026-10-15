import * as React from "react";
import { View } from "react-native";
import { AlertTriangle, CheckCircle2, FileDown, Plus } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Panel } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { FileUploader } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { api, uploadQuotationExcel } from "@/services/api";
import { colors } from "@/tokens";
import { rupiah } from "@/lib/format";
import { type Row } from "@/constants/modules";
import { Line } from "@/modules/shared/line";
import { downloadQuotationTemplate } from "@/modules/quotation/quotation-files";
import { QuotationTemplateGenerator } from "@/modules/quotation/quotation-template-generator";

export function QuotationExtras({ row }: { row: Row }) {
  const { patchRow, toast, reload } = useApp();
  const versions = Array.from({ length: row.versi }, (_, i) => row.versi - i);
  const apiVersions: { id: string; v: number; total: number; ppn: number; disc: number; totalAfterDisc: number; date: string; reason: string; file: string }[] =
    Array.isArray(row._versions) && row._versions.length > 0
      ? row._versions
      : versions.map((v, i) => ({
          id: `v-${v}`,
          v,
          total: row.total || row.nilai || 0,
          ppn: row.ppn || 0,
          disc: row.disc || 0,
          totalAfterDisc: (row.totalAfterDisc || row.nilai || 0) * (1 - i * 0.02),
          date: row.dibuat || "",
          reason: `Versi ${v}`,
          file: `Penawaran-${row.nomor.replace(/\//g, "-")}-v${v}.xlsx`,
        }));
  const [ppnMode, setPpnMode] = React.useState<"exclude" | "include" | "none">(
    row.tipePpn === "Include PPN (Sudah termasuk)" || row.ppnMode === "include"
      ? "include"
      : row.tipePpn === "No PPN (Tanpa PPN)" || row.ppnMode === "none" || (row.ppn === 0 && (row.disc > 0 || (row.total || 0) > 0))
      ? "none"
      : "exclude"
  );

  // Revisi state
  const [revisiOpen, setRevisiOpen] = React.useState(false);
  const [revisiTotal, setRevisiTotal] = React.useState(String(row.total || row.nilai || "0"));
  const [revisiDisc, setRevisiDisc] = React.useState(String(row.disc || "0"));
  const [revisiReason, setRevisiReason] = React.useState("");
  const [revisiPpnMode, setRevisiPpnMode] = React.useState<"exclude" | "include" | "none">(ppnMode);

  const nextVersionNum = (row.versi || 1) + 1;
  const revTotNum = Number(revisiTotal.replace(/\D/g, "")) || 0;
  const revDiscNum = Number(revisiDisc.replace(/\D/g, "")) || 0;
  const revNet = Math.max(0, revTotNum - revDiscNum);
  const revPpn = revisiPpnMode === "exclude" ? Math.round(revNet * 0.11) : 0;
  const revAfterDisc = revisiPpnMode === "exclude" ? revNet + revPpn : revNet;

  async function handleCreateRevision() {
    try {
      await api("POST", `/quotations/${row.id}/versions`, {
        total: revTotNum,
        ppn: revPpn,
        discount: revDiscNum,
        grandTotal: revAfterDisc,
        note: revisiReason.trim() || `Revisi v${nextVersionNum}`,
      });
      await reload();
    } catch {
      patchRow("quotations", row.id, {
        versi: nextVersionNum,
        total: revTotNum,
        nilai: revTotNum,
        disc: revDiscNum,
        ppn: revPpn,
        totalAfterDisc: revAfterDisc,
        ppnMode: revisiPpnMode,
        tipePpn: revisiPpnMode === "exclude" ? "Exclude PPN (11%)" : revisiPpnMode === "include" ? "Include PPN (Sudah termasuk)" : "No PPN (Tanpa PPN)",
        status: "Revisi",
        fileName: `Penawaran-${row.nomor.replace(/\//g, "-")}-v${nextVersionNum}.xlsx`,
        fileUploaded: true,
      });
    }
    setPpnMode(revisiPpnMode);
    setRevisiOpen(false);
    toast(`Versi ${nextVersionNum} penawaran berhasil dibuat & berstatus Revisi`);
  }

  const totNum = Number(row.total || row.nilai || 0);
  const discNum = Number(row.disc || 0);
  const netBeforeTax = Math.max(0, totNum - discNum);
  const calcPpn = ppnMode === "exclude" ? Math.round(netBeforeTax * 0.11) : 0;
  const calcTotalAfterDisc = ppnMode === "exclude" ? netBeforeTax + calcPpn : netBeforeTax;

  return (
    <>
      <Panel
        title="Rincian Nilai & Kalkulasi Penawaran"
        subtitle="Nomor penawaran dibuat otomatis saat Lead masuk Qualification dan ter-link langsung ke Lead."
      >
        <View className="gap-3">
          <Line left="Nomor Penawaran (Auto-Generated)" right={<Text className="text-primary font-bold">{row.nomor}</Text>} />
          <Line left="Lead Sumber" right={<Text className="font-semibold">{row.lead}</Text>} />
          <Line left="Customer" right={<Text className="text-text-secondary">{row.customer}</Text>} />
          <Line left="TOTAL (Sebelum PPN & Disc)" right={<Text className="font-semibold">{rupiah(row.total || row.nilai || 0)}</Text>} />
          <Line left="DISC (Diskon)" right={<Text className="text-danger font-semibold">- {rupiah(row.disc || 0)}</Text>} />
          <Line
            left={ppnMode === "include" ? "PPN (Sudah Termasuk)" : ppnMode === "none" ? "PPN (Tanpa PPN)" : "PPN (11%)"}
            right={
              <Text className="font-semibold">
                {ppnMode === "include"
                  ? "Included"
                  : ppnMode === "none"
                  ? "Rp 0"
                  : rupiah(row.ppn ?? Math.round(Math.max(0, (row.total || row.nilai || 0) - (row.disc || 0)) * 0.11))}
              </Text>
            }
          />
          <Line
            left="TOTAL AFTER DISC (Total Akhir)"
            right={<Text className="text-primary text-base font-bold">{rupiah(row.totalAfterDisc || row.total || row.nilai || 0)}</Text>}
          />
          <Line left="Status Penawaran" right={<StatusBadge status={row.status || "Not Yet"} />} />

          {row.status === "Not Yet" && (
            <View className="bg-warning/10 border-warning/30 flex-row items-center gap-2 rounded-xl border p-3 mt-1">
              <AlertTriangle size={16} color={colors.warning} />
              <Text className="text-warning text-xs flex-1">
                Status masih <b>Not Yet</b>. Anda bisa <b>Edit Item / Jasa di aplikasi</b> atau <b>Upload File Excel (.xlsx)</b> hasil editan manual agar sistem otomatis membaca nilainya dan mengubah status menjadi <b>Done</b>.
              </Text>
            </View>
          )}
        </View>
      </Panel>

      <Panel
        title="File Excel Penawaran — Download & Smart Upload (.xlsx)"
        subtitle="Cara 1: Download file Excel (.xlsx) sesuai contoh, edit manual di Excel, lalu upload kembali — sistem otomatis membaca tabel item, TOTAL, PPN, DISC & GRAND TOTAL."
      >
        <View className="gap-3">
          <Line
            left="Status File Dokumen"
            right={
              row.fileUploaded ? (
                <View className="flex-row items-center gap-1.5">
                  <CheckCircle2 size={15} color={colors.primary} />
                  <Text className="text-xs font-semibold text-primary">File Terupload & Ter-link ke Lead</Text>
                </View>
              ) : (
                <Text className="text-xs text-muted-foreground font-medium">Belum Ada File</Text>
              )
            }
          />
          {row.fileName ? (
            <Line left="Nama File Terakhir" right={<Text className="text-xs text-foreground font-mono">{row.fileName}</Text>} />
          ) : null}

          <View className="flex-row flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onPress={() => {
                downloadQuotationTemplate({
                  quotationId: row.id,
                  customer: row.customer,
                  lead: row.lead,
                  nomor: row.nomor,
                  signer: row.pemilik,
                });
                toast("File Excel penawaran (.xlsx) sedang diunduh");
              }}
            >
              <FileDown size={15} color={colors.text} />
              <Text className="text-xs">Download File Excel (.xlsx) Saat Ini</Text>
            </Button>
          </View>

          <FileUploader
            label="Pilih atau Tarik File Excel (.xlsx) Penawaran — Sistem Otomatis Baca Isi Tabel & Total"
            kind="dokumen"
            autoFlush
            onFilePicked={async (file) => {
              try {
                await uploadQuotationExcel(row.id, file);
                await reload();
                toast("File Excel berhasil dibaca! Tabel item, TOTAL, PPN, DISC & status otomatis diperbarui.");
              } catch (e: any) {
                toast(e?.message || "Gagal memproses file Excel", "danger");
              }
            }}
          />
        </View>
      </Panel>

      <QuotationTemplateGenerator
        key={`${row.id}-${row.versi}-${row.total}-${row.disc}-${(row.items ?? []).length}`}
        row={row}
        totNum={totNum}
        calcPpn={calcPpn}
        calcTotalAfterDisc={calcTotalAfterDisc}
        discNum={discNum}
        onUpdateItems={async (items, newTotal, meta, shouldDownload) => {
          const net = Math.max(0, newTotal - discNum);
          const newPpn = ppnMode === "exclude" ? Math.round(net * 0.11) : 0;
          const newAfterDisc = ppnMode === "exclude" ? net + newPpn : net;
          await patchRow("quotations", row.id, {
            items,
            subject: meta?.subject,
            intro: meta?.intro,
            notesList: meta?.notesList,
            city: meta?.city,
            kopText: meta?.kopText,
            customerAddress: meta?.customerAddress,
            signerName: meta?.signerName,
            signerTitle: meta?.signerTitle,
            total: newTotal,
            nilai: newTotal,
            ppn: newPpn,
            disc: discNum,
            totalAfterDisc: newAfterDisc,
            ppnMode,
            tipePpn: ppnMode === "exclude" ? "Exclude PPN (11%)" : ppnMode === "include" ? "Include PPN (Sudah termasuk)" : "No PPN (Tanpa PPN)",
            fileUploaded: true,
            fileName: `Penawaran-${row.nomor.replace(/\//g, "-")}.xlsx`,
            status: row.status === "Not Yet" ? "Done" : row.status,
          });
          if (shouldDownload) {
            downloadQuotationTemplate({
              quotationId: row.id,
              customer: row.customer,
              lead: row.lead,
              nomor: row.nomor,
              signer: meta?.signerName || row.pemilik,
            });
            toast("Template penawaran disimpan & file Excel (.xlsx) diunduh!");
          } else {
            toast("Template & item penawaran berhasil disimpan!");
          }
        }}
      />

      <Panel
        title="Riwayat Versi"
        subtitle="Revisi tidak menimpa versi lama. Hanya versi terakhir dipakai sebagai acuan nilai."
        right={
          <Button size="sm" variant="outline" onPress={() => setRevisiOpen(true)} className="flex-row items-center gap-1">
            <Plus size={14} color={colors.text} />
            <Text className="text-xs">Buat Revisi (v{nextVersionNum})</Text>
          </Button>
        }
      >
        {apiVersions.map((ver, i) => (
          <Line
            key={ver.id || ver.v}
            left={`Versi ${ver.v}${ver.reason ? ` — ${ver.reason}` : ""}`}
            sub={`${ver.file || `${row.nomor.replace(/\//g, "-")}-v${ver.v}.pdf`}${ver.date ? ` · ${ver.date}` : ""}`}
            right={
              <View className="items-end gap-1">
                <Text className="text-sm font-medium">{rupiah(ver.totalAfterDisc || ver.total)}</Text>
                {i === 0 ? <StatusBadge status={row.status || "Disetujui"} /> : null}
              </View>
            }
          />
        ))}
      </Panel>

      {/* Modal Buat Revisi Baru */}
      <Dialog open={revisiOpen} onOpenChange={setRevisiOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Buat Revisi Penawaran (Versi {nextVersionNum})</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <Text className="text-xs text-muted-foreground">
              Membuat draf revisi baru untuk penawaran ini. Versi lama ({row.versi}) akan tetap tersimpan sebagai arsip.
            </Text>
            <View className="gap-1">
              <Text className="text-xs text-muted-foreground">Alasan / Catatan Revisi</Text>
              <Input
                value={revisiReason}
                onChangeText={setRevisiReason}
                placeholder="Contoh: Permintaan potongan harga / penambahan perangkat"
              />
            </View>
            <View className="gap-1">
              <Text className="text-xs text-muted-foreground">Nilai Baru Sebelum PPN & Disc (Rp)</Text>
              <Input
                value={revisiTotal}
                onChangeText={setRevisiTotal}
                placeholder="Nilai total"
                keyboardType="numeric"
              />
            </View>
            <View className="gap-1">
              <Text className="text-xs text-muted-foreground">Diskon Baru (Rp)</Text>
              <Input
                value={revisiDisc}
                onChangeText={setRevisiDisc}
                placeholder="Nilai diskon"
                keyboardType="numeric"
              />
            </View>
            <View className="gap-1">
              <Text className="text-xs text-muted-foreground">Tipe / Skema PPN Revisi</Text>
              <View className="flex-row gap-1.5">
                {[
                  { id: "exclude", label: "Exclude PPN (11%)" },
                  { id: "include", label: "Include PPN" },
                  { id: "none", label: "No PPN" },
                ].map((opt) => (
                  <Button
                    key={opt.id}
                    size="sm"
                    variant={revisiPpnMode === opt.id ? "default" : "outline"}
                    onPress={() => setRevisiPpnMode(opt.id as any)}
                    className="h-8 px-2.5"
                  >
                    <Text className="text-xs">{opt.label}</Text>
                  </Button>
                ))}
              </View>
            </View>
            <View className="bg-panel border-border/60 rounded-lg border p-2.5">
              <Text className="text-[11px] text-muted-foreground">
                {revisiPpnMode === "include" ? "PPN: Sudah Termasuk dalam Nilai" : revisiPpnMode === "none" ? "PPN: Tanpa PPN (Rp 0)" : `Preview PPN (11%): ${rupiah(revPpn)}`}
              </Text>
              <Text className="text-xs font-semibold text-primary">Preview Total Akhir v{nextVersionNum}: {rupiah(revAfterDisc)}</Text>
            </View>
            <FileUploader label="Upload File Revisi Baru (PDF / Excel)" kind="dokumen" category="penawaran" autoFlush />
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setRevisiOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleCreateRevision}>
              <Text>Rilis Versi {nextVersionNum}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
