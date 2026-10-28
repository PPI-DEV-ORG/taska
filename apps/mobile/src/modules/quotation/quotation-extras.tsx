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
import { type QuotationItem } from "@/modules/quotation/types";
import {
  PPH_MODE_OPTIONS,
  pphRateFor,
  pphModeToTipe,
  getInitialPphMode,
  type PphMode,
  calcItemPph,
  calcQuotationFinancials,
} from "@/modules/quotation/lib";
import { CreateInvoiceDialog } from "@/modules/invoice/create-invoice-dialog";
import { ConflictAndSwapBanner, SerialItemPickerModal } from "@/components/taska/serial-item-picker";
import { Line } from "../shared/line";

export function QuotationExtras({
  row,
  onRefresh,
}: {
  row: Row;
  onRefresh?: () => Promise<void> | void;
}) {
  const router = useRouter();
  const { user, patchRow, toast, reload, data, addRow, setStatus, pushHistory } = useApp();
  const apiVersions: {
    id: string;
    v: number;
    status?: string;
    total: number;
    ppn: number;
    disc: number;
    totalAfterDisc: number;
    date: string;
    reason: string;
    file: string;
    fileId?: number | null;
  }[] = Array.isArray(row._versions) ? row._versions : [];

  const maxVer = apiVersions.reduce((max, v) => Math.max(max, v.v || 0), Number(row.versi || 0));
  const nextVersionNum = maxVer + 1;
  const [ppnMode, setPpnMode] = React.useState<"exclude" | "include" | "none">(
    row.tipePpn === "Include PPN (Sudah termasuk)" || row.ppnMode === "include"
      ? "include"
      : row.tipePpn === "No PPN (Tanpa PPN)" || row.ppnMode === "none" || (row.ppn === 0 && (row.disc > 0 || (row.total || 0) > 0))
      ? "none"
      : "exclude"
  );

  const items: QuotationItem[] = Array.isArray(row.items) ? row.items : [];
  const totalItemsPph = items.reduce((acc, it) => acc + calcItemPph(it), 0);

  const [pickerOpen, setPickerOpen] = React.useState(false);

  // Revisi state
  const [revisiOpen, setRevisiOpen] = React.useState(false);
  const [revisiTotal, setRevisiTotal] = React.useState(String(row.total || row.nilai || "0"));
  const [revisiDiscType, setRevisiDiscType] = React.useState<"nominal" | "percent">("nominal");
  const [revisiDisc, setRevisiDisc] = React.useState(String(row.disc || "0"));
  const [revisiDiscPercent, setRevisiDiscPercent] = React.useState("0");
  const [revisiReason, setRevisiReason] = React.useState("");
  const [revisiPpnMode, setRevisiPpnMode] = React.useState<"exclude" | "include" | "none">(ppnMode);
  const [revisiFileId, setRevisiFileId] = React.useState<number | null>(null);

  const revTotNum = Number(revisiTotal.replace(/\D/g, "")) || 0;
  const revDiscPercentNum = Number(revisiDiscPercent.replace(/\D/g, "")) || 0;
  const revDiscNum = revisiDiscType === "percent"
    ? Math.round(revTotNum * (revDiscPercentNum / 100))
    : (Number(revisiDisc.replace(/\D/g, "")) || 0);
  const revNet = Math.max(0, revTotNum - revDiscNum);
  const isRevInclude = revisiPpnMode === "include";
  const revDpp = isRevInclude ? Math.round(revNet / 1.11) : revNet;
  const revPpn = revisiPpnMode === "none" ? 0 : isRevInclude ? Math.max(0, revNet - revDpp) : Math.round(revNet * 0.11);
  const revPph = totalItemsPph;
  const revAfterDisc = Math.max(0, (revisiPpnMode === "exclude" ? revNet + revPpn : revNet) - revPph);

  async function handleCreateRevision() {
    try {
      await api("POST", `/quotations/${row.id}/versions`, {
        total: revTotNum,
        ppn: revPpn,
        discount: revDiscNum,
        pph: revPph,
        grandTotal: revAfterDisc,
        note: revisiReason.trim() || `Revisi v${nextVersionNum}`,
        fileId: revisiFileId || undefined,
      });
      await reload();
      await onRefresh?.();
      toast(`Versi ${nextVersionNum} penawaran berhasil dibuat`);
    } catch {
      await patchRow("quotations", row.id, {
        versi: nextVersionNum,
        total: revTotNum,
        nilai: revTotNum,
        disc: revDiscNum,
        ppn: revPpn,
        pph: revPph,
        totalAfterDisc: revAfterDisc,
        ppnMode: revisiPpnMode,
        tipePpn: revisiPpnMode === "exclude" ? "Exclude PPN (11%)" : revisiPpnMode === "include" ? "Include PPN (Sudah termasuk)" : "No PPN (Tanpa PPN)",
        status: "Revisi",
        fileName: `Penawaran-${row.nomor.replace(/\//g, "-")}-v${nextVersionNum}.xlsx`,
        fileUploaded: true,
        latestFileId: revisiFileId || undefined,
      });
      await onRefresh?.();
      toast(`Versi ${nextVersionNum} penawaran berhasil dibuat & berstatus Revisi`);
    }
    setPpnMode(revisiPpnMode);
    setRevisiFileId(null);
    setRevisiOpen(false);
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
    const qNomor = String(row.nomor || "").trim().toLowerCase();
    const qId = String(row.id || "");
    const projId = relatedProject?.id ? String(relatedProject.id) : null;

    return (data.invoices ?? []).filter((inv: Row) => {
      if (inv.quotationId && String(inv.quotationId) === qId) return true;
      if (inv.quotation && String(inv.quotation).trim().toLowerCase() === qNomor) return true;
      const cat = String(inv.catatan || inv.description || "").toLowerCase();
      if (qNomor && cat.includes(qNomor)) return true;
      if (projId && inv.projectId && String(inv.projectId) === projId) return true;
      return false;
    });
  }, [data.invoices, row.id, row.nomor, relatedProject]);

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
      await onRefresh?.();
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

  const canCreateInvoice = ["finance", "admin", "super_admin", "bos"].includes(
    (user?.role || "").toLowerCase()
  );

  async function handleAddItems(newItems: QuotationItem[]) {
    const existingSnSet = new Set<string>();
    items.forEach((it) => {
      if (Array.isArray(it.serialNumbers)) it.serialNumbers.forEach((s) => existingSnSet.add(String(s).trim().toUpperCase()));
      const snVal = String(it.item).match(/\(SN:\s*([^\)]+)\)/i)?.[1]?.trim();
      if (snVal) existingSnSet.add(snVal.toUpperCase());
    });
    const valid: QuotationItem[] = [];
    newItems.forEach((it) => {
      const snList: string[] = [];
      if (Array.isArray(it.serialNumbers)) it.serialNumbers.forEach((s) => snList.push(String(s).trim().toUpperCase()));
      const snVal = String(it.item).match(/\(SN:\s*([^\)]+)\)/i)?.[1]?.trim();
      if (snVal) snList.push(snVal.toUpperCase());
      const hasDup = snList.some((s) => existingSnSet.has(s));
      if (!hasDup) {
        snList.forEach((s) => existingSnSet.add(s));
        valid.push(it);
      }
    });

    const updated = [...items, ...valid];
    const newTotal = updated.reduce((s, it) => s + (Number(it.qty || 1) * Number(it.harga ?? it.price ?? 0)), 0);
    const { dpp, ppn, pph, totalAfterDisc } = calcQuotationFinancials(newTotal, discNum, ppnMode, "none", updated);

    await patchRow("quotations", row.id, {
      items: updated,
      total: newTotal,
      nilai: newTotal,
      dpp,
      ppn,
      pph,
      totalAfterDisc,
      status: row.status === "Not Yet" ? "Done" : row.status,
    });
    await reload();
    await onRefresh?.();
    toast(`Berhasil menambahkan ${valid.length} barang! Stok telah ter-reserve.`);
  }

  async function handleDeleteItem(idx: number) {
    const updated = items.filter((_, i) => i !== idx);
    const newTotal = updated.reduce((s, it) => s + (Number(it.qty || 1) * Number(it.harga ?? it.price ?? 0)), 0);
    const { dpp, ppn, pph, totalAfterDisc } = calcQuotationFinancials(newTotal, discNum, ppnMode, "none", updated);

    await patchRow("quotations", row.id, {
      items: updated,
      total: newTotal,
      nilai: newTotal,
      dpp,
      ppn,
      pph,
      totalAfterDisc,
    });
    await reload();
    await onRefresh?.();
    toast("Barang berhasil dihapus");
  }

  async function handleUpdateItemPph(idx: number, newPphMode: PphMode) {
    const updated = items.map((it, i) =>
      i === idx ? { ...it, pphMode: newPphMode, tipePph: pphModeToTipe(newPphMode) } : it
    );
    const newTotal = updated.reduce((s, it) => s + (Number(it.qty || 1) * Number(it.harga ?? it.price ?? 0)), 0);
    const { dpp, ppn, pph, totalAfterDisc } = calcQuotationFinancials(newTotal, discNum, ppnMode, "none", updated);

    await patchRow("quotations", row.id, {
      items: updated,
      total: newTotal,
      nilai: newTotal,
      dpp,
      ppn,
      pph,
      totalAfterDisc,
    });
    await reload();
    await onRefresh?.();
  }

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
          {ppnMode === "include" ? (
            <>
              <Line left="Nilai Sebelum Diskon (Inc. PPN)" right={<Text className="font-semibold">{rupiah(row.total || row.nilai || 0)}</Text>} />
              {Number(row.disc || 0) > 0 ? (
                <Line left="DISC (Diskon)" right={<Text className="text-danger font-semibold">- {rupiah(row.disc || 0)}</Text>} />
              ) : null}
              <Line left="DPP (Harga Sebelum PPN)" right={<Text className="font-semibold">{rupiah(Math.round(netBeforeTax / 1.11))}</Text>} />
              <Line
                left="PPN 11% (Termasuk)"
                right={<Text className="text-primary font-semibold">{rupiah(row.ppn ?? Math.max(0, netBeforeTax - Math.round(netBeforeTax / 1.11)))}</Text>}
              />
              {totalItemsPph > 0 ? (
                <Line
                  left="Potongan PPh (Akumulasi Per-Item)"
                  right={<Text className="text-danger font-semibold">- {rupiah(totalItemsPph)}</Text>}
                />
              ) : null}
              <Line
                left="TOTAL AKHIR (Inc. PPN)"
                right={<Text className="text-primary text-base font-bold">{rupiah(Math.max(0, netBeforeTax - totalItemsPph))}</Text>}
              />
            </>
          ) : (
            <>
              <Line left="TOTAL (Sebelum PPN & Disc)" right={<Text className="font-semibold">{rupiah(row.total || row.nilai || 0)}</Text>} />
              <Line left="DISC (Diskon)" right={<Text className="text-danger font-semibold">- {rupiah(row.disc || 0)}</Text>} />
              <Line
                left={ppnMode === "none" ? "PPN (Tanpa PPN)" : "PPN (11%)"}
                right={
                  <Text className="font-semibold">
                    {ppnMode === "none"
                      ? "Rp 0"
                      : rupiah(row.ppn ?? Math.round(Math.max(0, (row.total || row.nilai || 0) - (row.disc || 0)) * 0.11))}
                  </Text>
                }
              />
              {totalItemsPph > 0 ? (
                <Line
                  left="Potongan PPh (Akumulasi Per-Item)"
                  right={<Text className="text-danger font-semibold">- {rupiah(totalItemsPph)}</Text>}
                />
              ) : null}
              <Line
                left="TOTAL AFTER DISC (Total Akhir)"
                right={<Text className="text-primary text-base font-bold">{rupiah(Math.max(0, calcTotalAfterDisc - totalItemsPph))}</Text>}
              />
            </>
          )}
          <Line left="Status Penawaran" right={<StatusBadge status={row.status || "Not Yet"} />} />

          <ConflictAndSwapBanner row={row} />

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

      {/* Panel Daftar & Alokasi Barang Penawaran */}
      <Panel
        title="Daftar & Alokasi Barang Penawaran"
        subtitle="Kelola barang, jasa & nomor seri (SN) untuk penawaran ini agar stok ter-reserve otomatis."
        right={
          <Button
            size="sm"
            onPress={() => setPickerOpen(true)}
            className="flex-row items-center gap-1"
          >
            <Plus size={14} color={colors.background} />
            <Text className="text-xs">Tambah Barang</Text>
          </Button>
        }
      >
        <ConflictAndSwapBanner row={row} />

        {items.length > 0 ? (
          <View className="gap-2 pt-1">
            <View className="border border-border/80 rounded-xl overflow-hidden bg-card">
              <View className="flex-row bg-muted/60 p-2.5 border-b border-border/70">
                <Text className="text-[11px] font-bold text-muted-foreground w-8">No</Text>
                <Text className="text-[11px] font-bold text-muted-foreground flex-1">Nama Barang / SKU</Text>
                <Text className="text-[11px] font-bold text-muted-foreground w-16 text-center">Qty</Text>
                <Text className="text-[11px] font-bold text-muted-foreground w-28 text-right">Harga (Rp)</Text>
                <Text className="text-[11px] font-bold text-muted-foreground w-28 text-right">Subtotal (Rp)</Text>
                <Text className="text-[11px] font-bold text-muted-foreground w-12 text-center">Aksi</Text>
              </View>
              {items.map((it, idx) => {
                const itemPrice = Number(it.harga ?? it.price ?? 0);
                const sub = (Number(it.qty) || 1) * itemPrice;
                const snText = Array.isArray(it.serialNumbers) && it.serialNumbers.length > 0
                  ? it.serialNumbers.join(", ")
                  : (String(it.item).match(/\(SN:\s*([^\)]+)\)/i)?.[1] || null);

                const itemPph = calcItemPph(it);
                return (
                  <View key={it.id || idx} className="p-2.5 border-b border-border/40 last:border-b-0 gap-1.5">
                    <View className="flex-row items-center">
                      <Text className="text-xs text-muted-foreground w-8 font-mono">{idx + 1}</Text>
                      <View className="flex-1 mr-2">
                        <Text className="text-xs font-semibold text-foreground">{it.item}</Text>
                        {snText ? (
                          <Text className="text-[10px] text-primary font-mono mt-0.5">SN: {snText}</Text>
                        ) : null}
                      </View>
                      <Text className="text-xs text-foreground w-16 text-center">{it.qty} {it.satuan || it.unit || "unit"}</Text>
                      <Text className="text-xs text-foreground w-28 text-right">{rupiah(itemPrice)}</Text>
                      <View className="w-28 items-end">
                        <Text className="text-xs font-semibold text-foreground">{rupiah(sub)}</Text>
                        {itemPph > 0 ? (
                          <Text className="text-[10px] text-danger font-medium">PPh: -{rupiah(itemPph)}</Text>
                        ) : null}
                      </View>
                      <View className="w-12 items-center">
                        <Button size="icon" variant="ghost" className="size-7" onPress={() => handleDeleteItem(idx)}>
                          <Trash2 size={13} color={colors.danger} />
                        </Button>
                      </View>
                    </View>

                    {/* Selector PPh Per-Item */}
                    <View className="flex-row items-center gap-1 flex-wrap pl-8">
                      <Text className="text-[10px] text-muted-foreground mr-1">Tarif PPh:</Text>
                      {PPH_MODE_OPTIONS.map((opt) => {
                        const active = (it.pphMode || "none") === opt.id;
                        return (
                          <Pressable
                            key={opt.id}
                            onPress={() => handleUpdateItemPph(idx, opt.id)}
                            className={`px-1.5 py-0.5 rounded border ${
                              active ? "bg-primary/10 border-primary" : "bg-muted/40 border-border/60"
                            }`}
                          >
                            <Text className={`text-[9px] ${active ? "text-primary font-bold" : "text-muted-foreground"}`}>
                              {opt.id === "none" ? "Non-PPh" : opt.label.split(" ")[0]}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Ringkasan Kalkulasi Akumulasi Pajak & Total */}
            <View className="bg-panel/70 border border-border/80 rounded-xl p-3.5 gap-2 mt-1">
              <View className="flex-row justify-between items-center">
                <Text className="text-xs text-muted-foreground">Total Nilai Barang & Jasa (Sebelum Pajak):</Text>
                <Text className="text-xs font-semibold">{rupiah(totNum)}</Text>
              </View>
              {discNum > 0 ? (
                <View className="flex-row justify-between items-center">
                  <Text className="text-xs text-muted-foreground">Diskon Penawaran:</Text>
                  <Text className="text-xs font-semibold text-danger">- {rupiah(discNum)}</Text>
                </View>
              ) : null}
              {ppnMode !== "none" ? (
                <View className="flex-row justify-between items-center">
                  <Text className="text-xs text-muted-foreground">{ppnMode === "include" ? "PPN 11% (Termasuk):" : "PPN 11% (Exclude):"}</Text>
                  <Text className="text-xs font-semibold text-primary">{rupiah(calcPpn)}</Text>
                </View>
              ) : (
                <View className="flex-row justify-between items-center">
                  <Text className="text-xs text-muted-foreground">PPN:</Text>
                  <Text className="text-xs font-semibold text-muted-foreground">Tanpa PPN (Rp 0)</Text>
                </View>
              )}
              {totalItemsPph > 0 ? (
                <View className="flex-row justify-between items-center">
                  <Text className="text-xs text-muted-foreground font-medium">
                    Total Potongan PPh (Akumulasi Per-Item):
                  </Text>
                  <Text className="text-xs font-bold text-danger">- {rupiah(totalItemsPph)}</Text>
                </View>
              ) : (
                <View className="flex-row justify-between items-center">
                  <Text className="text-xs text-muted-foreground">Pemotongan PPh:</Text>
                  <Text className="text-xs text-muted-foreground">Rp 0 (Semua Non-PPh)</Text>
                </View>
              )}
              <View className="border-t border-border/60 pt-2 flex-row justify-between items-center">
                <Text className="text-xs font-bold text-foreground">Grand Total Akhir Penawaran:</Text>
                <Text className="text-sm font-bold text-primary">{rupiah(Math.max(0, calcTotalAfterDisc - totalItemsPph))}</Text>
              </View>
            </View>
          </View>
        ) : (
          <View className="p-4 rounded-xl border border-dashed border-border/80 items-center justify-center gap-2">
            <Text className="text-xs text-muted-foreground">Belum ada barang yang ditambahkan ke penawaran ini.</Text>
            <Button size="sm" variant="outline" onPress={() => setPickerOpen(true)} className="flex-row items-center gap-1.5">
              <Plus size={14} color={colors.text} />
              <Text className="text-xs">Pilih dari Stok Gudang</Text>
            </Button>
          </View>
        )}
      </Panel>

      <SerialItemPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentQuotationId={row.id}
        existingItems={items}
        onAddItems={handleAddItems}
      />

      {/* Dokumen Penawaran Manual */}
      <Panel
        title="Dokumen Penawaran Manual"
        subtitle="Upload dokumen file penawaran manual (.pdf / .xlsx / dokumen) untuk dilampirkan ke penawaran ini."
      >
        <FileUploader
          label="Pilih atau Tarik File Dokumen Penawaran Manual (PDF / Excel)"
          kind="dokumen"
          category="penawaran"
          autoFlush
          onFilePicked={async (file) => {
            try {
              const uploadedId = await uploadFile(file, "dokumen", "penawaran", { refType: "quotation", refId: row.id });
              if (!uploadedId) throw new Error("Gagal mengunggah file ke server");
              await patchRow("quotations", row.id, {
                fileUploaded: true,
                fileName: file.name,
                latestFileId: uploadedId,
              });
              await onRefresh?.();
              await reload();
              toast(`File "${file.name}" berhasil diunggah!`);
            } catch (e: any) {
              toast(e?.message || "Gagal mengunggah file", "danger");
            }
          }}
        />
      </Panel>

      <Panel
        title="Riwayat Versi"
        subtitle="Revisi tidak menimpa versi lama. Setiap riwayat versi dapat diunduh dalam format Excel (.xlsx) drafting dan PDF resmi client."
        right={
          <Button size="sm" variant="outline" onPress={() => setRevisiOpen(true)} className="flex-row items-center gap-1">
            <Plus size={14} color={colors.text} />
            <Text className="text-xs">
              {apiVersions.length === 0 ? "Buat Versi 1" : `Buat Revisi (v${nextVersionNum})`}
            </Text>
          </Button>
        }
      >
        <View className="gap-2.5">
          {apiVersions.length === 0 ? (
            <View className="py-6 items-center justify-center">
              <Text className="text-sm text-muted-foreground text-center">
                Belum ada versi resmi penawaran. Klik &quot;Buat Versi 1&quot; atau simpan dari template untuk mendokumentasikan penawaran.
              </Text>
            </View>
          ) : (
            apiVersions.map((ver, i) => (
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
                      <StatusBadge status={ver.v === row.versi ? row.status : ((ver as any).status || "Ditolak")} />
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
          )))}
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
                const uploadedId = await uploadFile(file, "dokumen", "penawaran", { refType: "quotation", refId: row.id });
                if (!uploadedId) throw new Error("Gagal mengunggah file ke server");
                await onRefresh?.();
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
          canCreateInvoice ? (
            <Button
              size="sm"
              onPress={openInvoiceModal}
              className="flex-row items-center gap-1"
            >
              <Plus size={14} color={colors.background} />
              <Text className="text-xs">Buat Invoice</Text>
            </Button>
          ) : undefined
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
              Belum ada invoice yang dibuat untuk penawaran ini.
            </Text>
            {canCreateInvoice ? (
              <Button
                size="sm"
                variant="outline"
                onPress={openInvoiceModal}
                className="self-start flex-row items-center gap-1.5 mt-1"
              >
                <Receipt size={14} color={colors.text} />
                <Text className="text-xs">Buat Invoice untuk Penawaran Ini</Text>
              </Button>
            ) : null}
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
              <Text className="text-xs text-muted-foreground">Nilai baru sebelum disc (Rp)</Text>
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
            <View className="bg-panel border-border/60 rounded-lg border p-2.5 gap-1">
              {revisiPpnMode === "include" ? (
                <>
                  <View className="flex-row justify-between">
                    <Text className="text-[11px] text-muted-foreground">Harga Sebelum PPN (DPP):</Text>
                    <Text className="text-[11px] font-medium text-foreground">{rupiah(revDpp)}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-[11px] text-muted-foreground">PPN (11% Termasuk):</Text>
                    <Text className="text-[11px] font-medium text-primary">{rupiah(revPpn)}</Text>
                  </View>
                </>
              ) : (
                <View className="flex-row justify-between">
                  <Text className="text-[11px] text-muted-foreground">
                    {revisiPpnMode === "none" ? "PPN: Tanpa PPN (Rp 0)" : "PPN (11%):"}
                  </Text>
                  {revisiPpnMode !== "none" && (
                    <Text className="text-[11px] font-medium text-foreground">{rupiah(revPpn)}</Text>
                  )}
                </View>
              )}
              {revPph > 0 ? (
                <View className="flex-row justify-between">
                  <Text className="text-[11px] text-muted-foreground">Potongan PPh (Akumulasi Item):</Text>
                  <Text className="text-[11px] font-medium text-danger">- {rupiah(revPph)}</Text>
                </View>
              ) : null}
              <View className="flex-row justify-between border-t border-border/40 pt-1 mt-0.5">
                <Text className="text-xs font-semibold text-foreground">Preview Total Akhir v{nextVersionNum}:</Text>
                <Text className="text-xs font-bold text-primary">{rupiah(revAfterDisc)}</Text>
              </View>
            </View>
            <FileUploader
              label="Upload File Revisi Baru (PDF / Excel)"
              kind="dokumen"
              category="penawaran"
              autoFlush
              onUploaded={(id) => setRevisiFileId(id)}
            />
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
        onSuccess={onRefresh}
      />
    </>
  );
}
