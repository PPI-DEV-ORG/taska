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
import { Line } from "../shared/line";
interface TermItem {
  percent: number;
  dpp: number;
  ppn: number;
  pph: number;
  usePpn: boolean;
  usePph: boolean;
  total: number;
  dueDate: string;
}

function buildTerms(
  scheme: "Termin" | "DP & Pelunasan" | "Sekaligus",
  count: number,
  totalDpp: number,
  defaultPpn: boolean,
  baseDate: string | number
): TermItem[] {
  const today = typeof baseDate === "number" ? baseDate : new Date(baseDate).getTime() || 1792372000000;
  if (scheme === "Sekaligus") {
    const dpp = totalDpp;
    const ppn = defaultPpn ? Math.round(dpp * 0.11) : 0;
    return [
      {
        percent: 100,
        dpp,
        ppn,
        pph: 0,
        usePpn: defaultPpn,
        usePph: false,
        total: dpp + ppn,
        dueDate: new Date(today + 30 * 86_400_000).toISOString().slice(0, 10),
      },
    ];
  }
  if (scheme === "DP & Pelunasan") {
    const dpp1 = Math.round(totalDpp * 0.5);
    const dpp2 = Math.max(0, totalDpp - dpp1);
    const ppn1 = defaultPpn ? Math.round(dpp1 * 0.11) : 0;
    const ppn2 = defaultPpn ? Math.round(dpp2 * 0.11) : 0;
    return [
      {
        percent: 50,
        dpp: dpp1,
        ppn: ppn1,
        pph: 0,
        usePpn: defaultPpn,
        usePph: false,
        total: dpp1 + ppn1,
        dueDate: new Date(today + 14 * 86_400_000).toISOString().slice(0, 10),
      },
      {
        percent: 50,
        dpp: dpp2,
        ppn: ppn2,
        pph: 0,
        usePpn: defaultPpn,
        usePph: false,
        total: dpp2 + ppn2,
        dueDate: new Date(today + 45 * 86_400_000).toISOString().slice(0, 10),
      },
    ];
  }
  // Termin (min 3)
  const cnt = Math.max(3, count);
  let percentages: number[] = [];
  if (cnt === 3) {
    percentages = [30, 30, 40];
  } else {
    const basePct = Math.floor(100 / cnt);
    percentages = Array.from({ length: cnt - 1 }, () => basePct);
    percentages.push(100 - basePct * (cnt - 1));
  }
  let allocated = 0;
  return percentages.map((pct, idx) => {
    const isLast = idx === cnt - 1;
    const dpp = isLast ? Math.max(0, totalDpp - allocated) : Math.round(totalDpp * (pct / 100));
    allocated += dpp;
    const ppn = defaultPpn ? Math.round(dpp * 0.11) : 0;
    const days = 14 + idx * 30;
    return {
      percent: pct,
      dpp,
      ppn,
      pph: 0,
      usePpn: defaultPpn,
      usePph: false,
      total: dpp + ppn,
      dueDate: new Date(today + days * 86_400_000).toISOString().slice(0, 10),
    };
  });
}

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

  // Invoice creation modal state (Termin / DP & Pelunasan / Sekaligus)
  const [invModalOpen, setInvModalOpen] = React.useState(false);
  const [invNomor, setInvNomor] = React.useState("");
  const [invScheme, setInvScheme] = React.useState<"Termin" | "DP & Pelunasan" | "Sekaligus">("Termin");
  const [termCount, setTermCount] = React.useState(3);
  const [terms, setTerms] = React.useState<TermItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = React.useState("AUTO_PROJECT");
  const [isSubmittingInv, setIsSubmittingInv] = React.useState(false);

  const baseIsoDate = React.useMemo(() => {
    if (row.dibuat && !isNaN(new Date(row.dibuat).getTime())) {
      return new Date(row.dibuat).toISOString().slice(0, 10);
    }
    return "2026-10-19";
  }, [row.dibuat]);

  function openInvoiceModal() {
    setSelectedProjectId(relatedProject ? String(relatedProject.id) : "AUTO_PROJECT");
    setInvScheme("Termin");
    setTermCount(3);
    setTerms(buildTerms("Termin", 3, baseDealDpp, ppnMode !== "none", baseIsoDate));
    setInvModalOpen(true);
  }

  function handleSwitchScheme(s: "Termin" | "DP & Pelunasan" | "Sekaligus") {
    setInvScheme(s);
    const cnt = s === "Termin" ? Math.max(3, termCount) : s === "DP & Pelunasan" ? 2 : 1;
    setTerms(buildTerms(s, cnt, baseDealDpp, ppnMode !== "none", baseIsoDate));
  }

  function handleTermCountChange(newCnt: number) {
    if (newCnt < 3 || newCnt > 10) return;
    setTermCount(newCnt);
    setTerms(buildTerms("Termin", newCnt, baseDealDpp, ppnMode !== "none", baseIsoDate));
  }

  function handleUpdateTermPercent(index: number, valStr: string) {
    const p = Number(valStr.replace(/\D/g, "")) || 0;
    setTerms((prev) => {
      const next = [...prev];
      const cur = next[index];
      if (!cur) return prev;
      const dpp = Math.round(baseDealDpp * (p / 100));
      const ppn = cur.usePpn ? Math.round(dpp * 0.11) : 0;
      const pph = cur.usePph ? Math.round(dpp * 0.02) : 0;
      next[index] = {
        ...cur,
        percent: p,
        dpp,
        ppn,
        pph,
        total: dpp + ppn - pph,
      };
      return next;
    });
  }

  function handleUpdateTermDpp(index: number, valStr: string) {
    const dpp = Number(valStr.replace(/\D/g, "")) || 0;
    setTerms((prev) => {
      const next = [...prev];
      const cur = next[index];
      if (!cur) return prev;
      const pct = baseDealDpp > 0 ? Math.round((dpp / baseDealDpp) * 100) : 0;
      const ppn = cur.usePpn ? Math.round(dpp * 0.11) : 0;
      const pph = cur.usePph ? Math.round(dpp * 0.02) : 0;
      next[index] = {
        ...cur,
        percent: pct,
        dpp,
        ppn,
        pph,
        total: dpp + ppn - pph,
      };
      return next;
    });
  }

  function handleToggleTermPpn(index: number) {
    setTerms((prev) => {
      const next = [...prev];
      const cur = next[index];
      if (!cur) return prev;
      const usePpn = !cur.usePpn;
      const ppn = usePpn ? Math.round(cur.dpp * 0.11) : 0;
      next[index] = { ...cur, usePpn, ppn, total: cur.dpp + ppn - cur.pph };
      return next;
    });
  }

  function handleToggleTermPph(index: number) {
    setTerms((prev) => {
      const next = [...prev];
      const cur = next[index];
      if (!cur) return prev;
      const usePph = !cur.usePph;
      const pph = usePph ? Math.round(cur.dpp * 0.02) : 0;
      next[index] = { ...cur, usePph, pph, total: cur.dpp + cur.ppn - pph };
      return next;
    });
  }

  function handleUpdateTermDueDate(index: number, d: string) {
    setTerms((prev) => {
      const next = [...prev];
      if (next[index]) next[index] = { ...next[index], dueDate: d };
      return next;
    });
  }

  async function handleCreateInvoice() {
    if (terms.length === 0) {
      toast("Minimal 1 invoice harus dibuat", "danger");
      return;
    }
    const totalDpp = terms.reduce((s, t) => s + t.dpp, 0);
    if (totalDpp <= 0) {
      toast("Total nilai tagihan harus lebih dari 0", "danger");
      return;
    }

    const custName = row.customer || row.perusahaan || "Klien";
    setIsSubmittingInv(true);
    try {
      let targetProjectId = selectedProjectId;
      let targetProjectName = "";

      if (targetProjectId === "AUTO_PROJECT" || !targetProjectId) {
        if (relatedProject) {
          targetProjectId = String(relatedProject.id);
          targetProjectName = relatedProject.nama;
        } else {
          const createdProj = await addRow("projects", {
            nama: `Project ${custName} (${row.nomor})`,
            customer: custName,
            perusahaan: custName,
            customerId: row.customerId,
            quotationId: row.id,
            jenis: "Customer",
            pm: (data.users ?? []).find((u: Row) => u.role === "pm")?.nama || "Dimas Prasetyo",
            mulai: new Date().toISOString().slice(0, 10),
            selesai: new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10),
            status: "Berjalan",
          });
          if (createdProj) {
            targetProjectId = String(createdProj.id);
            targetProjectName = createdProj.nama;
          }
        }
      } else {
        const found = (data.projects ?? []).find((p: Row) => String(p.id) === String(targetProjectId));
        if (found) targetProjectName = found.nama;
      }

      const baseNomor =
        invNomor.trim() ||
        `INV/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, "0")}/${String(row.id).padStart(3, "0")}`;

      const createdNumbers: string[] = [];

      for (let i = 0; i < terms.length; i++) {
        const term = terms[i];
        if (!term) continue;
        const invoiceNumber = terms.length > 1 ? `${baseNomor}/${i + 1}` : baseNomor;
        const invoiceType =
          invScheme === "DP & Pelunasan"
            ? (i === 0 ? "DP" : "Pelunasan")
            : invScheme === "Termin"
            ? "Termin"
            : "Pelunasan";

        const created = await addRow("invoices", {
          nomor: invoiceNumber,
          customer: custName,
          customerId: row.customerId,
          quotationId: row.id,
          quotation: row.nomor,
          project: targetProjectName,
          projectId: targetProjectId && targetProjectId !== "AUTO_PROJECT" ? targetProjectId : undefined,
          jenis: invoiceType,
          nilai: term.dpp,
          ppn: term.ppn,
          total: term.total,
          tanggal: new Date().toISOString().slice(0, 10),
          jatuhTempo: term.dueDate,
          status: "Belum dikirim",
          catatan: `${invScheme} (${term.percent}%) - Penawaran ${row.nomor}${term.pph > 0 ? ` (PPh 2%: ${rupiah(term.pph)})` : ""}`,
        });

        if (created) {
          createdNumbers.push(invoiceNumber);
        }
      }

      if (createdNumbers.length > 0) {
        toast(`${createdNumbers.length} invoice (${createdNumbers.join(", ")}) berhasil dibuat!`);
        pushHistory("quotations", row.id, `${createdNumbers.length} invoice dibuat (${createdNumbers.join(", ")})`);
        setInvModalOpen(false);
        setInvNomor("");
        await reload();
      }
    } catch (e: any) {
      toast(e?.message ?? "Gagal membuat invoice", "danger");
    } finally {
      setIsSubmittingInv(false);
    }
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
                    {i === 0 ? <StatusBadge status={row.status || "Disetujui"} /> : null}
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

      {/* Modal Buat Invoice dari Penawaran (Termin / DP & Pelunasan / Sekaligus) */}
      <Dialog open={invModalOpen} onOpenChange={setInvModalOpen}>
        <DialogContent className="sm:max-w-xl md:max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Buat Invoice & Skema Pembayaran</DialogTitle>
          </DialogHeader>
          <ScrollView style={{ maxHeight: 520 }} contentContainerClassName="gap-3.5 py-1">
            <View className="gap-1">
              <Text className="text-xs font-semibold text-muted-foreground">Nomor Invoice Dasar (Base Number)</Text>
              <Input
                value={invNomor}
                onChangeText={setInvNomor}
                placeholder={`Contoh: INV/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, "0")}/${String(row.id).padStart(3, "0")}`}
              />
              <Text className="text-[11px] text-muted-foreground">
                Setiap termin otomatis diberikan akhiran urut: <Text className="font-semibold text-primary">/1, /2, /3, dst.</Text>
              </Text>
            </View>

            <View className="flex-row gap-2">
              <View className="flex-1 gap-1">
                <Text className="text-xs font-semibold text-muted-foreground">Pelanggan</Text>
                <Input value={row.customer || row.perusahaan || ""} editable={false} className="bg-muted/40" />
              </View>
              <View className="flex-1 gap-1">
                <Text className="text-xs font-semibold text-muted-foreground">Penawaran Sumber</Text>
                <Input value={row.nomor || ""} editable={false} className="bg-muted/40" />
              </View>
            </View>

            <View className="gap-1">
              <Text className="text-xs font-semibold text-muted-foreground">Project Terkait</Text>
              <View className="gap-1.5">
                <Pressable
                  onPress={() => setSelectedProjectId(relatedProject ? String(relatedProject.id) : "AUTO_PROJECT")}
                  className={`border rounded-lg p-2.5 flex-row items-center justify-between ${
                    selectedProjectId === (relatedProject ? String(relatedProject.id) : "AUTO_PROJECT")
                      ? "bg-primary/10 border-primary"
                      : "border-border"
                  }`}
                >
                  <View className="flex-1 pr-2">
                    <Text className="text-xs font-semibold">
                      {relatedProject
                        ? `Project Terkait: ${relatedProject.nama}`
                        : `Buat Project Otomatis (Project ${row.customer || "Client"} - ${row.nomor})`}
                    </Text>
                    <Text className="text-[11px] text-muted-foreground">
                      {relatedProject
                        ? `Status pembayaran project: ${relatedProject.pembayaran || "Belum lunas"}`
                        : "Project baru akan dibuat & pembayaran otomatis LUNAS saat invoice lunas"}
                    </Text>
                  </View>
                  {selectedProjectId === (relatedProject ? String(relatedProject.id) : "AUTO_PROJECT") ? (
                    <Check size={16} color={colors.primary} />
                  ) : null}
                </Pressable>

                {(data.projects ?? [])
                  .filter((p: Row) => !relatedProject || String(p.id) !== String(relatedProject.id))
                  .slice(0, 2)
                  .map((p: Row) => (
                    <Pressable
                      key={p.id}
                      onPress={() => setSelectedProjectId(String(p.id))}
                      className={`border rounded-lg p-2 flex-row items-center justify-between ${
                        selectedProjectId === String(p.id) ? "bg-primary/10 border-primary" : "border-border"
                      }`}
                    >
                      <View className="flex-1 pr-2">
                        <Text className="text-xs font-medium">{p.nama}</Text>
                        <Text className="text-[10px] text-muted-foreground">{p.customer} · {p.pembayaran || "Belum lunas"}</Text>
                      </View>
                      {selectedProjectId === String(p.id) ? <Check size={14} color={colors.primary} /> : null}
                    </Pressable>
                  ))}
              </View>
            </View>

            {/* Pilihan Skema Pembayaran */}
            <View className="gap-1.5 pt-1">
              <Text className="text-xs font-semibold text-muted-foreground">Pilih Skema Pembayaran</Text>
              <View className="flex-row gap-2">
                {(["Termin", "DP & Pelunasan", "Sekaligus"] as const).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={invScheme === s ? "default" : "outline"}
                    onPress={() => handleSwitchScheme(s)}
                    className="flex-1 h-9"
                  >
                    <Text className="text-xs font-semibold">{s}</Text>
                  </Button>
                ))}
              </View>
            </View>

            {/* Input jumlah termin jika Termin */}
            {invScheme === "Termin" && (
              <View className="flex-row items-center justify-between p-3 rounded-xl bg-card border border-border/80">
                <View>
                  <Text className="text-xs font-bold text-foreground">Jumlah Pembayaran Termin</Text>
                  <Text className="text-[11px] text-muted-foreground">Sesuai kesepakatan, minimal 3 kali pembayaran invoice.</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => handleTermCountChange(termCount - 1)}
                    disabled={termCount <= 3}
                    className="h-8 w-8 p-0 items-center justify-center"
                  >
                    <Minus size={14} color={colors.text} />
                  </Button>
                  <Text className="text-sm font-bold text-foreground px-1">{termCount}x</Text>
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => handleTermCountChange(termCount + 1)}
                    disabled={termCount >= 10}
                    className="h-8 w-8 p-0 items-center justify-center"
                  >
                    <Plus size={14} color={colors.text} />
                  </Button>
                </View>
              </View>
            )}

            {/* Ringkasan Nilai & Alokasi */}
            {(() => {
              const allocatedPct = terms.reduce((s, t) => s + t.percent, 0);
              const allocatedDpp = terms.reduce((s, t) => s + t.dpp, 0);
              const isMatch = allocatedPct === 100;
              return (
                <View className={`p-3 rounded-xl border flex-row items-center justify-between ${isMatch ? "bg-primary/5 border-primary/20" : "bg-warning/10 border-warning/30"}`}>
                  <View>
                    <Text className="text-xs text-muted-foreground">Total Nilai DPP Penawaran</Text>
                    <Text className="text-sm font-bold text-foreground">{rupiah(baseDealDpp)}</Text>
                  </View>
                  <View className="items-end">
                    <Text className={`text-xs font-bold ${isMatch ? "text-primary" : "text-warning"}`}>
                      Alokasi: {allocatedPct}% ({rupiah(allocatedDpp)})
                    </Text>
                    {!isMatch && (
                      <Text className="text-[10px] text-warning font-medium">Harus tepat 100%</Text>
                    )}
                  </View>
                </View>
              );
            })()}

            {/* Rincian Setiap Invoice Termin */}
            <View className="gap-2.5 pt-1">
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Daftar Invoice yang Dibuat ({terms.length} Invoice)
              </Text>

              {terms.map((term, idx) => {
                const baseNomor =
                  invNomor.trim() ||
                  `INV/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, "0")}/${String(row.id).padStart(3, "0")}`;
                const invoiceNumber = terms.length > 1 ? `${baseNomor}/${idx + 1}` : baseNomor;
                const label =
                  invScheme === "DP & Pelunasan"
                    ? idx === 0
                      ? "Pembayaran 1 (DP / Uang Muka)"
                      : "Pembayaran 2 (Pelunasan)"
                    : invScheme === "Termin"
                    ? `Termin ke-${idx + 1}`
                    : "Invoice Pembayaran";

                return (
                  <View key={idx} className="bg-card border border-border/80 rounded-xl p-3 gap-2.5">
                    <View className="flex-row items-center justify-between pb-1.5 border-b border-border/40">
                      <View className="flex-row items-center gap-2">
                        <Receipt size={15} color={colors.primary} />
                        <Text className="text-xs font-bold text-foreground">{label}</Text>
                      </View>
                      <Text className="text-xs font-mono font-bold text-primary">{invoiceNumber}</Text>
                    </View>

                    <View className="flex-row gap-2">
                      <View className="w-24 gap-1">
                        <Text className="text-[11px] text-muted-foreground">Porsi (%)</Text>
                        <Input
                          value={String(term.percent)}
                          onChangeText={(v) => handleUpdateTermPercent(idx, v)}
                          keyboardType="numeric"
                          placeholder="%"
                        />
                      </View>
                      <View className="flex-1 gap-1">
                        <Text className="text-[11px] text-muted-foreground">Nilai DPP (Rp)</Text>
                        <Input
                          value={formatThousands(String(term.dpp))}
                          onChangeText={(v) => handleUpdateTermDpp(idx, v)}
                          keyboardType="numeric"
                          placeholder="DPP"
                        />
                      </View>
                    </View>

                    {/* Pajak PPN & PPh */}
                    <View className="flex-row items-center justify-between bg-panel p-2 rounded-lg border border-border/60">
                      <View className="flex-row items-center gap-2">
                        <Button
                          size="sm"
                          variant={term.usePpn ? "default" : "outline"}
                          onPress={() => handleToggleTermPpn(idx)}
                          className="h-7 px-2"
                        >
                          <Text className="text-[11px]">{term.usePpn ? "PPN 11% ✓" : "Tanpa PPN"}</Text>
                        </Button>
                        <Button
                          size="sm"
                          variant={term.usePph ? "default" : "outline"}
                          onPress={() => handleToggleTermPph(idx)}
                          className="h-7 px-2"
                        >
                          <Text className="text-[11px]">{term.usePph ? "PPh 2% ✓" : "Tanpa PPh"}</Text>
                        </Button>
                      </View>
                      <View className="items-end">
                        {term.usePpn && (
                          <Text className="text-[10px] text-muted-foreground">PPN: +{rupiah(term.ppn)}</Text>
                        )}
                        {term.usePph && (
                          <Text className="text-[10px] text-danger">PPh: -{rupiah(term.pph)}</Text>
                        )}
                        <Text className="text-xs font-bold text-primary mt-0.5">
                          Total Invoice: {rupiah(term.total)}
                        </Text>
                      </View>
                    </View>

                    <View className="gap-1">
                      <Text className="text-[11px] text-muted-foreground">Jatuh Tempo Pembayaran</Text>
                      <DatePicker
                        value={term.dueDate}
                        onChange={(d) => handleUpdateTermDueDate(idx, d)}
                        placeholder="Pilih Jatuh Tempo"
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
          <DialogFooter>
            <Button variant="outline" onPress={() => setInvModalOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleCreateInvoice} disabled={isSubmittingInv}>
              <Text>{isSubmittingInv ? "Menyimpan..." : `Simpan & Buat ${terms.length} Invoice`}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
