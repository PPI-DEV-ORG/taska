import * as React from "react";
import { View, Pressable, Linking, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  CheckCircle2,
  FileDown,
  Plus,
  Minus,
  Receipt,
  Check,
  ArrowRight,
  FileText,
  Trash2,
  ExternalLink,
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Panel } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { DatePicker, formatThousands } from "@/components/taska/dialogs";
import { FileUploader } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { api, apiBase, uploadFile, uploadQuotationExcel } from "@/services/api";
import { colors } from "@/tokens";
import { rupiah } from "@/lib/format";
import { type Row } from "@/constants/modules";
import { downloadQuotationTemplate, downloadQuotationPdf } from "@/modules/quotation/quotation-files";
import { QuotationTemplateGenerator } from "@/modules/quotation/quotation-template-generator";
import { type QuotationItem } from "@/modules/quotation/types";
import { CreateInvoiceDialog } from "@/modules/invoice/create-invoice-dialog";
import { Line } from "../shared/line";

export function QuotationExtras({ row }: { row: Row }) {
  const router = useRouter();
  const { patchRow, toast, reload, data, addRow, setStatus, pushHistory } = useApp();
  const versions = Array.from({ length: row.versi }, (_, i) => row.versi - i);
  const apiVersions: {
    id: string;
    v: number;
    total: number;
    ppn: number;
    disc: number;
    totalAfterDisc: number;
    date: string;
    reason: string;
    file: string;
    fileId?: number | null;
  }[] =
    Array.isArray(row._versions) && row._versions.length > 0
      ? row._versions
      : versions.map((v, i) => ({
          id: `v-${v}`,
          v,
          fileId: null,
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
  const [revisiDiscType, setRevisiDiscType] = React.useState<"nominal" | "percent">("nominal");
  const [revisiDisc, setRevisiDisc] = React.useState(String(row.disc || "0"));
  const [revisiDiscPercent, setRevisiDiscPercent] = React.useState("0");
  const [revisiReason, setRevisiReason] = React.useState("");
  const [revisiPpnMode, setRevisiPpnMode] = React.useState<"exclude" | "include" | "none">(ppnMode);

  const nextVersionNum = (row.versi || 1) + 1;
  const revTotNum = Number(revisiTotal.replace(/\D/g, "")) || 0;
  const revDiscPercentNum = Number(revisiDiscPercent.replace(/\D/g, "")) || 0;
  const revDiscNum = revisiDiscType === "percent"
    ? Math.round(revTotNum * (revDiscPercentNum / 100))
    : (Number(revisiDisc.replace(/\D/g, "")) || 0);
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

  // Related Project & Invoices
  const relatedProject = React.useMemo(() => {
    return (data.projects ?? []).find(
      (p: Row) =>
        (p.quotationId && String(p.quotationId) === String(row.id)) ||
        (row.customerId && p.customerId && String(p.customerId) === String(row.customerId)) ||
        (p.customer && row.customer && p.customer.trim().toLowerCase() === row.customer.trim().toLowerCase())
    );
  }, [data.projects, row.id, row.customerId, row.customer]);

  const quotationInvoices = React.useMemo(() => {
    return (data.invoices ?? []).filter((inv: Row) => {
      if (inv.quotationId && String(inv.quotationId) === String(row.id)) return true;
      if (inv.quotation && String(inv.quotation).trim() === String(row.nomor).trim()) return true;
      return false;
    });
  }, [data.invoices, row.id, row.nomor]);

  const dealAmount = React.useMemo(() => {
    const raw = row.totalAfterDisc || row.total || row.nilai || 0;
    return typeof raw === "number" ? raw : Number(String(raw).replace(/\D/g, "")) || 0;
  }, [row.totalAfterDisc, row.total, row.nilai]);

  const pdfFiles = React.useMemo(() => {
    const list = Array.isArray(row.files) ? row.files : [];
    return list.filter((f: any) => {
      const name = String(f.originalName || "").toLowerCase();
      const mime = String(f.mimeType || "").toLowerCase();
      return name.endsWith(".pdf") || mime === "application/pdf";
    });
  }, [row.files]);

  async function handleDeletePdf(fileId: number, fileName: string) {
    try {
      await api("DELETE", `/files/${fileId}`);
      await reload();
      toast(`File "${fileName}" berhasil dihapus`);
    } catch {
      toast("Gagal menghapus file", "danger");
    }
  }

  const totNum = Number(row.total || row.nilai || 0);
  const discNum = Number(row.disc || 0);
  const netBeforeTax = Math.max(0, totNum - discNum);
  const calcPpn = ppnMode === "exclude" ? Math.round(netBeforeTax * 0.11) : 0;
  const calcTotalAfterDisc = ppnMode === "exclude" ? netBeforeTax + calcPpn : netBeforeTax;
  const baseDealDpp = netBeforeTax || dealAmount || 0;

  // Invoice creation modal state
  const [invModalOpen, setInvModalOpen] = React.useState(false);

  function openInvoiceModal() {
    setInvModalOpen(true);
  }

  return (
    <>
      <Panel
        title="Rincian Nilai & Kalkulasi Penawaran"
        subtitle="Nomor penawaran dibuat otomatis saat Lead masuk Qualification dan ter-link langsung ke Lead."
      >
        <View className="gap-3">
          <Line left="Nomor Penawaran (Auto-Generated)" right={<Text className="text-primary font-bold">{row.nomor}</Text>} />
          <Line
            left="Lead Sumber"
            right={
              <Pressable
                onPress={() => {
                  const targetLeadId =
                    row.leadId ||
                    (data.leads ?? []).find(
                      (l: Row) => String(l.nama ?? "").trim().toLowerCase() === String(row.lead ?? "").trim().toLowerCase()
                    )?.id;
                  if (targetLeadId) router.push(`/leads/${targetLeadId}` as any);
                }}
                className="flex-row items-center gap-1 active:opacity-70"
              >
                <Text className="font-bold text-primary underline">{row.lead || "-"}</Text>
                <ArrowRight size={13} color={colors.primary} />
              </Pressable>
            }
          />
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
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            hint="Hanya file Excel (.xlsx) maksimal 15 MB"
            allowedExtensions={[".xlsx"]}
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
        onUpdateItems={async (
          items: QuotationItem[],
          newTotal: number,
          meta?: {
            subject?: string;
            intro?: string;
            notesList?: string[];
            city?: string;
            kopText?: string;
            kopLogoUrl?: string;
            customerAddress?: string;
            signerName?: string;
            signerTitle?: string;
          },
          shouldDownload?: boolean,
        ) => {
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
            kopLogoUrl: meta?.kopLogoUrl,
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
        subtitle="Revisi tidak menimpa versi lama. Setiap riwayat versi dapat diunduh dalam format Excel (.xlsx) drafting dan PDF resmi client."
        right={
          <Button size="sm" variant="outline" onPress={() => setRevisiOpen(true)} className="flex-row items-center gap-1">
            <Plus size={14} color={colors.text} />
            <Text className="text-xs">Buat Revisi (v{nextVersionNum})</Text>
          </Button>
        }
      >
        <View className="gap-2.5">
          {apiVersions.map((ver, i) => (
            <View
              key={ver.id || ver.v}
              className="bg-card border border-border/80 rounded-xl p-3 gap-2"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1 mr-2">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-sm font-bold text-foreground">
                      Versi {ver.v}
                    </Text>
                    <StatusBadge status={(ver as any).status || (i === 0 ? row.status : "Ditolak")} />
                  </View>
                  <Text className="text-xs text-muted-foreground mt-0.5">
                    {ver.reason ? `${ver.reason} · ` : ""}{ver.date || "-"}
                  </Text>
                </View>
                <Text className="text-sm font-bold text-primary">
                  {rupiah(ver.totalAfterDisc || ver.total)}
                </Text>
              </View>

              <View className="flex-row items-center gap-2 pt-1 border-t border-border/40">
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => {
                    if (ver.fileId) {
                      const url = `${apiBase()}/files/${ver.fileId}`;
                      if (typeof window !== "undefined") {
                        window.open(url, "_blank");
                      } else {
                        Linking.openURL(url).catch(() => {});
                      }
                    } else {
                      downloadQuotationTemplate({
                        quotationId: row.id,
                        customer: row.customer,
                        lead: row.lead,
                        nomor: row.nomor,
                        signer: row.pemilik,
                      });
                    }
                    toast(`Mengunduh file Excel v${ver.v} (.xlsx)`);
                  }}
                  className="flex-row items-center gap-1 h-8 px-2.5"
                >
                  <FileDown size={13} color={colors.text} />
                  <Text className="text-xs">Unduh Excel (.xlsx)</Text>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => {
                    downloadQuotationPdf({
                      quotationId: row.id,
                      customer: row.customer,
                      lead: row.lead,
                      nomor: row.nomor,
                      signer: row.pemilik,
                    });
                    toast(`Mengunduh file PDF resmi v${ver.v}`);
                  }}
                  className="flex-row items-center gap-1 h-8 px-2.5"
                >
                  <FileText size={13} color={colors.text} />
                  <Text className="text-xs">Unduh PDF (Client)</Text>
                </Button>
              </View>
            </View>
          ))}
        </View>
      </Panel>

      <Panel
        title="File & Bukti Pendukung (PDF Resmi untuk Client)"
        subtitle="Upload dokumen penawaran resmi berformat PDF untuk dikirimkan ke client (drafting internal menggunakan .xlsx di atas)."
        right={
          <Button
            size="sm"
            variant="outline"
            onPress={() => {
              downloadQuotationPdf({
                quotationId: row.id,
                customer: row.customer,
                lead: row.lead,
                nomor: row.nomor,
                signer: row.pemilik,
              });
              toast("Mengunduh PDF resmi penawaran dari sistem...");
            }}
            className="flex-row items-center gap-1"
          >
            <FileDown size={14} color={colors.text} />
            <Text className="text-xs">Export PDF Sistem</Text>
          </Button>
        }
      >
        <View className="gap-3">
          <FileUploader
            label="Upload File PDF Penawaran untuk Client"
            kind="dokumen"
            accept="application/pdf,.pdf"
            hint="Hanya file PDF (.pdf) untuk client, maksimal 15 MB"
            allowedExtensions={[".pdf"]}
            autoFlush
            onFilePicked={async (file) => {
              try {
                await uploadFile(file, "dokumen", String(row.id));
                await reload();
                toast(`File PDF "${file.name}" berhasil diunggah!`);
              } catch (e: any) {
                toast(e?.message || "Gagal mengunggah file PDF", "danger");
              }
            }}
          />

          {pdfFiles.length > 0 ? (
            <View className="gap-2 pt-2">
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Daftar File PDF Terupload ({pdfFiles.length})
              </Text>
              {pdfFiles.map((f: any) => {
                const fileUrl = `${apiBase()}/files/${f.id}`;
                return (
                  <View
                    key={f.id}
                    className="flex-row items-center justify-between p-3 rounded-xl border border-border/80 bg-card"
                  >
                    <View className="flex-1 mr-2">
                      <View className="flex-row items-center gap-1.5">
                        <FileText size={16} color={colors.primary} />
                        <Text className="text-xs font-medium text-foreground" numberOfLines={1}>
                          {f.originalName}
                        </Text>
                      </View>
                      <Text className="text-[11px] text-muted-foreground mt-0.5">
                        {f.size ? `${(f.size / 1024).toFixed(1)} KB` : "PDF"} · {f.createdAt ? String(f.createdAt).slice(0, 10) : ""}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => {
                          if (typeof window !== "undefined") {
                            window.open(fileUrl, "_blank");
                          } else {
                            Linking.openURL(fileUrl).catch(() => {});
                          }
                        }}
                      >
                        <ExternalLink size={14} color={colors.primary} />
                        <Text className="text-xs text-primary font-medium">Buka</Text>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => handleDeletePdf(f.id, f.originalName)}
                      >
                        <Trash2 size={14} color={colors.danger} />
                      </Button>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View className="p-3 rounded-xl border border-dashed border-border/80 items-center justify-center">
              <Text className="text-xs text-muted-foreground">
                Belum ada file PDF yang diunggah untuk penawaran ini.
              </Text>
            </View>
          )}
        </View>
      </Panel>

      {/* Panel Invoice & Penagihan */}
      <Panel
        title="Invoice & Penagihan"
        subtitle="Kelola tagihan pembayaran untuk penawaran ini. Status pembayaran project akan otomatis sinkron."
        right={
          <Button
            size="sm"
            onPress={openInvoiceModal}
            className="flex-row items-center gap-1"
          >
            <Plus size={14} color={colors.background} />
            <Text className="text-xs">Buat Invoice</Text>
          </Button>
        }
      >
        {quotationInvoices.length > 0 ? (
          <View className="gap-2.5">
            {quotationInvoices.map((inv: Row) => {
              const isPaid = inv.status === "Lunas";
              return (
                <View
                  key={inv.id}
                  className="bg-card border border-border/80 rounded-xl p-3 gap-2"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <Receipt size={16} color={colors.primary} />
                      <Text className="text-sm font-bold text-foreground">{inv.nomor}</Text>
                    </View>
                    <StatusBadge status={inv.status || "Belum dikirim"} />
                  </View>

                  <View className="flex-row items-center justify-between pt-1">
                    <View>
                      <Text className="text-[11px] text-muted-foreground">Total Tagihan</Text>
                      <Text className="text-xs font-semibold text-foreground">{rupiah(inv.total || inv.nilai || 0)}</Text>
                    </View>
                    <View>
                      <Text className="text-[11px] text-muted-foreground">Terbayar</Text>
                      <Text className={`text-xs font-semibold ${isPaid ? "text-success" : "text-foreground"}`}>
                        {rupiah(inv.terbayar || 0)}
                      </Text>
                    </View>
                    <View>
                      <Text className="text-[11px] text-muted-foreground">Project</Text>
                      <Text className="text-xs font-semibold text-primary" numberOfLines={1}>
                        {inv.project || relatedProject?.nama || "-"}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center justify-end gap-2 pt-1 border-t border-border/40 mt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2.5"
                      onPress={() => router.push(`/invoices/${inv.id}` as any)}
                    >
                      <Text className="text-xs">Buka Detail</Text>
                    </Button>
                    {!isPaid ? (
                      <Button
                        size="sm"
                        className="h-8 px-2.5 bg-success"
                        onPress={async () => {
                          try {
                            await setStatus("invoices", String(inv.id), "Lunas");
                            toast(`Invoice ${inv.nomor} berhasil dilunasi & status Project tersinkronkan!`);
                          } catch {
                            toast("Gagal mengubah status invoice", "danger");
                          }
                        }}
                      >
                        <Check size={13} color="#ffffff" />
                        <Text className="text-xs text-white font-medium ml-1">Jadikan Lunas</Text>
                      </Button>
                    ) : (
                      <View className="flex-row items-center gap-1 px-2 py-1 bg-success/15 rounded-md">
                        <CheckCircle2 size={13} color={colors.success} />
                        <Text className="text-xs text-success font-semibold">Lunas</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View className="gap-2 py-2">
            <Text className="text-xs text-muted-foreground leading-relaxed">
              Belum ada invoice yang dibuat untuk penawaran ini. Anda dapat membuat invoice langsung di sini.
            </Text>
            <Button
              size="sm"
              variant="outline"
              onPress={openInvoiceModal}
              className="self-start flex-row items-center gap-1.5 mt-1"
            >
              <Receipt size={14} color={colors.text} />
              <Text className="text-xs">Buat Invoice untuk Penawaran Ini</Text>
            </Button>
          </View>
        )}
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
                value={formatThousands(revisiTotal)}
                onChangeText={(v) => setRevisiTotal(v.replace(/\D/g, ""))}
                placeholder="Nilai total"
                keyboardType="numeric"
              />
            </View>
            <View className="gap-1.5">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-muted-foreground">Diskon Baru</Text>
                <View className="flex-row gap-1">
                  <Button
                    size="sm"
                    variant={revisiDiscType === "nominal" ? "default" : "outline"}
                    onPress={() => setRevisiDiscType("nominal")}
                    className="h-6 px-2"
                  >
                    <Text className="text-[10px]">Rp Nominal</Text>
                  </Button>
                  <Button
                    size="sm"
                    variant={revisiDiscType === "percent" ? "default" : "outline"}
                    onPress={() => setRevisiDiscType("percent")}
                    className="h-6 px-2"
                  >
                    <Text className="text-[10px]">% Persen</Text>
                  </Button>
                </View>
              </View>
              {revisiDiscType === "percent" ? (
                <View className="flex-row items-center gap-2">
                  <View className="flex-1">
                    <Input
                      value={revisiDiscPercent}
                      onChangeText={(v) => setRevisiDiscPercent(v.replace(/\D/g, ""))}
                      placeholder="Contoh: 10"
                      keyboardType="numeric"
                    />
                  </View>
                  <Text className="text-xs font-semibold text-muted-foreground">%</Text>
                  <Text className="text-xs font-semibold text-primary">= {rupiah(revDiscNum)}</Text>
                </View>
              ) : (
                <Input
                  value={formatThousands(revisiDisc)}
                  onChangeText={(v) => setRevisiDisc(v.replace(/\D/g, ""))}
                  placeholder="Nilai diskon (Rp)"
                  keyboardType="numeric"
                />
              )}
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

      {/* Modal Buat Invoice dari Penawaran */}
      <CreateInvoiceDialog
        open={invModalOpen}
        onOpenChange={setInvModalOpen}
        initialQuotation={row}
      />
    </>
  );
}
