import * as React from "react";
import { View, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Printer, Plus, Check, CheckCircle2, Circle, ExternalLink, RefreshCw } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Panel, Cell } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { CreateInvoiceDialog } from "@/modules/invoice/create-invoice-dialog";
import { useApp } from "@/store/app-store";
import { api, downloadDocumentationPdf } from "@/services/api";
import { colors } from "@/tokens";
import { rupiah } from "@/lib/format";
import { type Row } from "@/constants/modules";
import { DocumentationPhotosPanel } from "@/modules/shared/documentation-photos-panel";
import { Line } from "@/modules/shared/line";

export function ProjectExtras({ row }: { row: Row }) {
  const router = useRouter();
  const { toast, data, reload, user } = useApp();
  const products: Row[] = data.products ?? [];
  const serials: Row[] = data.serials ?? [];
  const [reserveOpen, setReserveOpen] = React.useState(false);
  const [createInvOpen, setCreateInvOpen] = React.useState(false);
  const [isSyncingBoq, setIsSyncingBoq] = React.useState(false);
  const [selectedProduct, setSelectedProduct] = React.useState("");
  const [reserveQty, setReserveQty] = React.useState("2");
  const [selectedSns, setSelectedSns] = React.useState<string[]>([]);
  const [bastOpen, setBastOpen] = React.useState(false);
  const [requirements, setRequirements] = React.useState<
    {
      id: string;
      productId?: string;
      produk: string;
      neededQty: number;
      reservedQty: number;
      shortageQty: number;
      unitPrice: number;
      status: string;
      serials?: string[];
    }[]
  >([]);

  const activeSelectedProduct = selectedProduct || String(products[0]?.nama ?? "");
  const activeProductObj = products.find((p) => p.nama === activeSelectedProduct) ?? products[0];
  const availableProductSerials = React.useMemo(() => {
    if (!activeProductObj?.berSN) return [];
    return serials
      .filter(
        (s) =>
          (String(s.productId) === String(activeProductObj.id) || s.produk === activeProductObj.nama) &&
          (s.rawStatus === "DI_GUDANG" || s.status === "Di gudang"),
      )
      .sort((a, b) => Number(a.id) - Number(b.id));
  }, [serials, activeProductObj]);

  const normalizedRole = String(user?.role || "").toLowerCase().replace(/[\s-]/g, "_");
  const canViewFinancials = ["super_admin", "superadmin", "bos", "finance", "pm", "sales", "admin"].includes(normalizedRole);
  const linkedQuotation = React.useMemo(() => {
    const cleanQuoNum = String(row.penawaran || "").split(" - ")[0]?.trim().toLowerCase();
    return (data.quotations ?? []).find(
      (q: Row) =>
        (row.quotationId && String(q.id) === String(row.quotationId)) ||
        (cleanQuoNum && cleanQuoNum !== "-" && String(q.nomor || "").toLowerCase() === cleanQuoNum),
    );
  }, [data.quotations, row.quotationId, row.penawaran]);

  const linkedSurveys = React.useMemo(() => {
    return (data.surveys ?? []).filter(
      (s: Row) =>
        (row.leadId && String(s.leadId) === String(row.leadId)) ||
        (linkedQuotation?.leadId && String(s.leadId) === String(linkedQuotation.leadId)) ||
        (row.customer && row.customer !== "-" && s.customer === row.customer),
    );
  }, [data.surveys, row.leadId, row.customer, linkedQuotation]);

  const linkedClientPos = React.useMemo(() => {
    return (data["po-client"] ?? []).filter(
      (po: Row) =>
        (linkedQuotation && String(po.quotationId) === String(linkedQuotation.id)) ||
        (linkedQuotation && String(po.penawaran || "").toLowerCase().includes(String(linkedQuotation.nomor || "").toLowerCase())) ||
        (row.customer && row.customer !== "-" && po.customer === row.customer),
    );
  }, [data, linkedQuotation, row.customer]);

  const projectInvoices = (data.invoices || []).filter(
    (i: any) =>
      i.direction !== "in" &&
      i.status !== "Batal" &&
      (String(i.projectId) === String(row.id) ||
        (i.project && i.project === row.nama) ||
        (linkedQuotation && String(i.quotationId) === String(linkedQuotation.id))),
  );
  const revenue = projectInvoices.reduce((sum: number, i: any) => sum + Number(i.nilai || i.amount || 0), 0);
  const projectPos = (data["supplier-pos"] || []).filter(
    (po: any) => String(po.projectId) === String(row.id) && po.status !== "Ditolak" && po.status !== "DIBATALKAN"
  );
  const poCost = projectPos.reduce((sum: number, po: any) => sum + Number(po.total || 0), 0);
  const projectExpenses = (data.expenses || []).filter(
    (e: any) => String(e.projectId) === String(row.id) && e.status !== "Ditolak"
  );
  const expenseCost = projectExpenses.reduce((sum: number, e: any) => sum + Number(e.nominal || 0), 0);
  const totalCost = poCost + expenseCost;
  const netProfit = revenue - totalCost;
  const marginPct = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : "0.0";

  const mapRequirements = React.useCallback((res: any[]) => {
    return res.map((r: any) => {
      const needed = Number(r.neededQty ?? r.qty ?? 0);
      const reserved = Number(r.reservedQty ?? 0);
      const shortage = Number(r.shortageQty ?? Math.max(0, needed - reserved));
      const unitPrice = Number(r.product?.purchasePrice ?? 0);
      let parsedSerials: string[] = [];
      if (r.serials) {
        try {
          const arr = JSON.parse(r.serials);
          if (Array.isArray(arr)) parsedSerials = arr.map(String);
        } catch {
          parsedSerials = String(r.serials)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        }
      }
      const snNote = parsedSerials.length > 0 ? ` · SN: ${parsedSerials.join(", ")}` : "";
      return {
        id: String(r.id),
        productId: r.product?.id != null ? String(r.product.id) : undefined,
        produk: r.product?.name ?? "Barang",
        neededQty: needed,
        reservedQty: reserved,
        shortageQty: shortage,
        unitPrice,
        serials: parsedSerials,
        status:
          (shortage > 0
            ? `Reserved ${reserved} · Kurang ${shortage} (Masuk PR Procurement)`
            : `Tersedia & Di-reserve (${reserved})`) + snNote,
      };
    });
  }, []);

  const loadRequirements = React.useCallback(async () => {
    try {
      const res = await api<any>("GET", `/projects/${row.id}/requirements`);
      const list = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
      setRequirements(mapRequirements(list));
    } catch {}
  }, [row.id, mapRequirements]);

  React.useEffect(() => {
    let active = true;
    api<any>("GET", `/projects/${row.id}/requirements`)
      .then((res) => {
        if (!active) return;
        const list = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
        setRequirements(mapRequirements(list));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [row.id, mapRequirements]);

  async function handleAddReservation() {
    const q = Number(reserveQty) || 1;
    const prod = products.find((p) => p.nama === activeSelectedProduct) ?? products[0];
    if (!prod) {
      toast("Pilih perangkat terlebih dahulu", "danger");
      return;
    }
    try {
      const effectiveQty = prod.berSN && selectedSns.length > 0 ? selectedSns.length : Math.max(1, Math.round(q));
      const res = await api<any>("POST", `/projects/${row.id}/requirements`, {
        productId: Number(prod.id),
        qty: effectiveQty,
        serials: selectedSns.length > 0 ? selectedSns : undefined,
      });
      await loadRequirements();
      await reload();
      setSelectedSns([]);
      setReserveOpen(false);
      const createdPr = res?.purchaseRequestCreated;
      toast(
        createdPr
          ? `Kebutuhan dicatat: stok tersedia di-reserve & kekurangan otomatis masuk Request Procurement`
          : `Reservasi ${q} unit ${prod.nama} berhasil dicatat`,
      );
    } catch (e: any) {
      toast(e?.message ?? "Gagal menyimpan kebutuhan barang", "danger");
    }
  }

  async function handleSyncBoqFromQuotation() {
    if (!linkedQuotation) {
      toast("Belum ada penawaran yang terhubung ke project ini", "danger");
      return;
    }
    const qItems: any[] = Array.isArray(linkedQuotation.items) ? linkedQuotation.items : [];
    if (qItems.length === 0) {
      toast("Penawaran terkait belum memiliki rincian item BOQ", "danger");
      return;
    }
    setIsSyncingBoq(true);
    try {
      let addedCount = 0;
      for (const it of qItems) {
        const prod = products.find(
          (p) =>
            (it.productId && String(p.id) === String(it.productId)) ||
            String(p.nama || "").toLowerCase() === String(it.name || it.nama || "").toLowerCase(),
        );
        if (!prod || prod.type === "JASA") continue;
        const sn = it.serialNumber || it.sn;
        await api("POST", `/projects/${row.id}/requirements`, {
          productId: Number(prod.id),
          qty: sn ? 1 : Math.max(1, Number(it.qty) || 1),
          serials: sn ? [String(sn)] : undefined,
        });
        addedCount++;
      }
      await loadRequirements();
      await reload();
      toast(
        addedCount > 0
          ? `${addedCount} item BOQ dari Penawaran ${linkedQuotation.nomor} berhasil disinkronkan ke Project`
          : "Tidak ada item barang fisik baru untuk disinkronkan",
      );
    } catch (e: any) {
      toast(e?.message ?? "Gagal menyinkronkan BOQ dari penawaran", "danger");
    } finally {
      setIsSyncingBoq(false);
    }
  }

  async function handlePrintBast() {
    const ok = await downloadDocumentationPdf("project", row.id);
    if (ok) {
      toast("PDF Laporan Dokumentasi Project berhasil diunduh");
      return;
    }
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  const quoServices = React.useMemo(() => {
    const qItems: any[] = Array.isArray(linkedQuotation?.items) ? linkedQuotation.items : [];
    return qItems.filter((it: any) => it.itemType === "CUSTOM" || (!it.productId && !it.serialNumber && !it.sn));
  }, [linkedQuotation]);

  const boqTotalValue = React.useMemo(() => {
    const matVal = requirements.reduce((acc, m) => acc + m.neededQty * (m.unitPrice || 0), 0);
    const svcVal = quoServices.reduce((acc, s) => acc + (Number(s.qty) || 1) * (Number(s.price) || 0), 0);
    return matVal + svcVal;
  }, [requirements, quoServices]);

  const flowSteps = [
    { key: "boq", label: "1. BOQ", done: requirements.length > 0 || quoServices.length > 0, sub: `${requirements.length + quoServices.length} item` },
    { key: "survey", label: "2. Survey (Opsional)", done: linkedSurveys.length > 0, sub: linkedSurveys.length > 0 ? `${linkedSurveys.length} survey` : "Opsional" },
    { key: "penawaran", label: "3. Penawaran Project", done: !!linkedQuotation, sub: linkedQuotation?.nomor || "Belum ada" },
    { key: "po", label: "4. PO Project", done: linkedClientPos.length > 0 || projectPos.length > 0, sub: `${linkedClientPos.length} SO · ${projectPos.length} PO` },
    { key: "progress", label: "5. Progress Project", done: Number(row.progres || 0) > 0, sub: `${row.progres ?? 0}%` },
    { key: "invoice", label: "6. Invoice Project", done: projectInvoices.length > 0, sub: `${projectInvoices.length} invoice` },
    { key: "bast", label: "7. Penyelesaian / BAST", done: row.status === "Selesai" || !!row.bastFileId, sub: row.status === "Selesai" ? "Selesai" : "Menunggu" },
  ];

  return (
    <>
      <Panel
        title="Alur Terpadu Project (End-to-End)"
        subtitle="Pantau kelengkapan 7 tahapan project mulai dari BOQ, Survey, Penawaran, PO, Progress, Invoice, hingga BAST"
      >
        <View className="flex-row flex-wrap gap-2">
          {flowSteps.map((st) => (
            <View
              key={st.key}
              className={`border rounded-xl px-3 py-2 flex-row items-center gap-2 ${
                st.done ? "border-success/40 bg-success/10" : "border-border bg-panel/50"
              }`}
            >
              {st.done ? (
                <CheckCircle2 size={15} color={colors.success} />
              ) : (
                <Circle size={15} color={colors.muted} />
              )}
              <View>
                <Text className="text-xs font-semibold text-foreground">{st.label}</Text>
                <Text className="text-[11px] text-muted-foreground">{st.sub}</Text>
              </View>
            </View>
          ))}
        </View>
      </Panel>

      <Panel
        title="1. BOQ (Bill of Quantities) & Reservasi Material Project"
        subtitle="Daftar seluruh kebutuhan barang (Ber-SN & Non-SN) serta jasa instalasi project. Stok yang tersedia otomatis di-reserve dan kekurangan masuk ke PR Procurement."
        right={
          <View className="flex-row flex-wrap items-center gap-1.5">
            {linkedQuotation ? (
              <Button
                size="sm"
                variant="outline"
                onPress={handleSyncBoqFromQuotation}
                disabled={isSyncingBoq}
                className="flex-row items-center gap-1"
              >
                <RefreshCw size={13} color={colors.primary} />
                <Text className="text-xs text-primary font-semibold">
                  {isSyncingBoq ? "Menyinkronkan..." : "Sinkron BOQ dari Penawaran"}
                </Text>
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onPress={() => setReserveOpen(true)} className="flex-row items-center gap-1">
              <Plus size={14} color={colors.text} />
              <Text className="text-xs">Tambah Item BOQ</Text>
            </Button>
          </View>
        }
      >
        <View className="gap-2">
          {requirements.length === 0 && quoServices.length === 0 ? (
            <Text className="text-muted-foreground text-xs py-2">
              Belum ada item BOQ untuk project ini. Klik &quot;Tambah Item BOQ&quot; atau &quot;Sinkron BOQ dari Penawaran&quot;.
            </Text>
          ) : (
            <>
              {requirements.map((m) => (
                <Line
                  key={m.id}
                  left={m.produk}
                  sub={m.status}
                  right={
                    <View className="items-end">
                      <Text className="font-semibold text-sm">{m.neededQty} unit</Text>
                      {m.unitPrice > 0 ? (
                        <Text className="text-muted-foreground text-[11px]">{rupiah(m.neededQty * m.unitPrice)}</Text>
                      ) : null}
                    </View>
                  }
                />
              ))}
              {quoServices.map((sv: any, idx: number) => (
                <Line
                  key={`svc-${idx}`}
                  left={`${sv.name || sv.nama || "Jasa Instalasi"} (Jasa / Pekerjaan)`}
                  sub={`Dari Penawaran ${linkedQuotation?.nomor || ""} · ${sv.qty || 1} ${sv.unit || "Lot"}`}
                  right={<Text className="font-semibold text-sm">{rupiah((Number(sv.qty) || 1) * (Number(sv.price) || 0))}</Text>}
                />
              ))}
              {boqTotalValue > 0 ? (
                <Line
                  left="Total Estimasi Nilai BOQ (Material + Jasa)"
                  right={<Text className="text-sm font-bold text-primary">{rupiah(boqTotalValue)}</Text>}
                />
              ) : null}
            </>
          )}
        </View>
      </Panel>

      <Panel
        title="2–6. Dokumen Komersial Project (Survey, Penawaran, PO & Invoice Project)"
        subtitle="Integrasi dokumen komersial project dalam satu tampilan terpadu"
        right={
          canViewFinancials ? (
            <Button size="sm" onPress={() => setCreateInvOpen(true)} className="flex-row items-center gap-1 bg-primary">
              <Plus size={13} color={colors.background} />
              <Text className="text-xs text-primary-foreground font-semibold">Buat Invoice Project</Text>
            </Button>
          ) : undefined
        }
      >
        <Line
          left="Survey Lokasi (Opsional)"
          sub={
            linkedSurveys.length > 0
              ? linkedSurveys.map((s: Row) => `${s.lokasi || s.lead} (${s.status})`).join(", ")
              : "Tidak ada / belum ada survey lokasi untuk project ini"
          }
          right={
            linkedSurveys[0] ? (
              <Button size="sm" variant="outline" onPress={() => router.push(`/surveys/${linkedSurveys[0]!.id}` as any)}>
                <ExternalLink size={12} color={colors.text} />
                <Text className="text-xs">Buka Survey</Text>
              </Button>
            ) : (
              <StatusBadge status="Opsional" />
            )
          }
        />

        <Line
          left="Penawaran Project (Quotation)"
          sub={
            linkedQuotation
              ? `${linkedQuotation.nomor} · Nilai: ${rupiah(linkedQuotation.totalAfterDisc || linkedQuotation.nilai || 0)} (${linkedQuotation.status})`
              : "Belum ada penawaran yang ditautkan"
          }
          right={
            linkedQuotation ? (
              <Button size="sm" variant="outline" onPress={() => router.push(`/quotations/${linkedQuotation.id}` as any)}>
                <ExternalLink size={12} color={colors.text} />
                <Text className="text-xs">Buka Penawaran</Text>
              </Button>
            ) : (
              <Button size="sm" variant="outline" onPress={() => router.push("/quotations" as any)}>
                <Text className="text-xs">Lihat Penawaran</Text>
              </Button>
            )
          }
        />

        <Line
          left="PO Project — Sales Order / PO Client"
          sub={
            linkedClientPos.length > 0
              ? linkedClientPos.map((po: Row) => `${po.nomor} (${rupiah(po.nilai)})`).join(", ")
              : "Belum ada PO Client tercatat"
          }
          right={
            linkedClientPos[0] ? (
              <Button size="sm" variant="outline" onPress={() => router.push(`/po-client/${linkedClientPos[0]!.id}` as any)}>
                <ExternalLink size={12} color={colors.text} />
                <Text className="text-xs">Buka SO / PO Client</Text>
              </Button>
            ) : (
              <Button size="sm" variant="outline" onPress={() => router.push("/po-client" as any)}>
                <Text className="text-xs">Catat PO Client</Text>
              </Button>
            )
          }
        />

        <Line
          left="PO Project — Pengadaan ke Supplier"
          sub={
            projectPos.length > 0
              ? projectPos.map((po: Row) => `${po.nomor} · ${po.supplier} (${po.status})`).join(", ")
              : "Belum ada PO Supplier untuk project ini"
          }
          right={
            projectPos[0] ? (
              <Button size="sm" variant="outline" onPress={() => router.push(`/supplier-pos/${projectPos[0]!.id}` as any)}>
                <ExternalLink size={12} color={colors.text} />
                <Text className="text-xs">Buka PO Supplier</Text>
              </Button>
            ) : (
              <StatusBadge status="0 PO Supplier" />
            )
          }
        />

        <View className="mt-2 pt-2 border-t border-border/60 gap-1">
          <Text className="text-xs font-semibold text-foreground mb-1">
            Daftar Invoice Project ({projectInvoices.length})
          </Text>
          {projectInvoices.length === 0 ? (
            <Text className="text-muted-foreground text-xs">Belum ada invoice yang diterbitkan untuk project ini.</Text>
          ) : (
            projectInvoices.map((inv: any) => (
              <Line
                key={inv.id}
                left={`${inv.nomor} (${inv.jenis})`}
                sub={`Total ${rupiah(inv.total)} · Terbayar ${rupiah(inv.terbayar)}`}
                right={
                  <View className="flex-row items-center gap-2">
                    <Cell fmt="status" value={inv.status} />
                    <Button size="sm" variant="outline" onPress={() => router.push(`/invoices/${inv.id}` as any)}>
                      <Text className="text-xs">Buka</Text>
                    </Button>
                  </View>
                }
              />
            ))
          )}
        </View>
      </Panel>

      <DocumentationPhotosPanel
        kind="project"
        entityId={row.id}
        title="Dokumentasi Foto Instalasi & Progress Project"
        subtitle="Galeri foto pemasangan perangkat di lapangan yang terkompilasi ke laporan PDF."
      />

      <Panel
        title="Berita Acara Serah Terima (BAST)"
        subtitle="Dokumen legal serah terima pekerjaan selesai kepada klien."
        right={
          <Button size="sm" variant="outline" onPress={() => setBastOpen(true)} className="flex-row items-center gap-1.5">
            <Printer size={14} color={colors.text} />
            <Text className="text-xs">Generate Draf BAST</Text>
          </Button>
        }
      >
        <Line left="Status Pekerjaan Fisik" right={<StatusBadge status={row.status || "Berjalan"} />} />
        <Line left="Status Pembayaran Termin" right={<StatusBadge status={row.pembayaran || "Belum lunas"} />} />
        <Text className="text-xs text-muted-foreground mt-2 leading-relaxed">
          Setelah seluruh item pekerjaan diuji coba dan disetujui klien, cetak draf BAST resmi untuk ditandatangani kedua belah pihak.
        </Text>
      </Panel>

      {canViewFinancials ? (
        <Panel
          title="Analisa Untung-Rugi (P&L Project)"
          subtitle="Ringkasan margin laba bersih proyek berdasarkan realisasi tagihan dan pengeluaran beban riil."
        >
          <Line
            left="Pendapatan Proyek (DPP Invoice)"
            sub={`${projectInvoices.length} invoice terbit`}
            right={<Text className="font-semibold text-sm">{rupiah(revenue)}</Text>}
          />
          <Line
            left="Biaya Pengadaan Material (PO Supplier)"
            sub={`${projectPos.length} purchase order supplier`}
            right={<Text className="font-semibold text-sm text-danger">{rupiah(poCost)}</Text>}
          />
          <Line
            left="Biaya Operasional & Reimburse"
            sub={`${projectExpenses.length} transaksi operasional`}
            right={<Text className="font-semibold text-sm text-danger">{rupiah(expenseCost)}</Text>}
          />
          <Line
            left="Total Beban & Biaya (HPP + Operasional)"
            right={<Text className="font-bold text-sm text-danger">{rupiah(totalCost)}</Text>}
          />
          <Line
            left="Laba Bersih Proyek (Net Profit)"
            sub={`Margin: ${marginPct}%`}
            right={
              <Text className={`font-bold text-base ${netProfit >= 0 ? "text-success" : "text-danger"}`}>
                {rupiah(netProfit)}
              </Text>
            }
          />
        </Panel>
      ) : null}

      {/* Modal Alokasi Material */}
      <Dialog open={reserveOpen} onOpenChange={setReserveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Kebutuhan Material Project</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <View className="gap-1">
              <Text className="text-xs text-muted-foreground font-medium">Pilih Perangkat / Material</Text>
              <ScrollView style={{ maxHeight: 180 }} className="border border-border rounded-lg p-1">
                {products.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => {
                      setSelectedProduct(p.nama);
                      setSelectedSns([]);
                    }}
                    className={`p-2 rounded flex-row items-center justify-between ${
                      activeSelectedProduct === p.nama ? "bg-primary/10" : ""
                    }`}
                  >
                    <Text className="text-xs font-medium">
                      {p.nama} {p.berSN ? "(Ber-SN)" : ""}
                    </Text>
                    {activeSelectedProduct === p.nama ? <Check size={14} color={colors.primary} /> : null}
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View className="gap-1">
              <Text className="text-xs text-muted-foreground font-medium">Jumlah yang Dibutuhkan</Text>
              <Input value={reserveQty} onChangeText={setReserveQty} placeholder="2" keyboardType="numeric" />
            </View>

            {activeProductObj?.berSN ? (
              <View className="gap-1.5">
                <Text className="text-xs text-muted-foreground font-medium">
                  Pilih Unit SN Spesifik ({availableProductSerials.length} tersedia Di Gudang — kosongkan untuk pilih otomatis FIFO)
                </Text>
                <ScrollView style={{ maxHeight: 140 }} className="border border-border rounded-lg p-1">
                  {availableProductSerials.length === 0 ? (
                    <Text className="text-xs text-muted-foreground p-2 italic">
                      Stok SN Di Gudang sedang kosong (otomatis masuk PR Procurement).
                    </Text>
                  ) : (
                    availableProductSerials.map((s) => {
                      const checked = selectedSns.includes(String(s.sn));
                      return (
                        <Pressable
                          key={s.id}
                          onPress={() => {
                            const snVal = String(s.sn);
                            setSelectedSns((prev) => {
                              const next = prev.includes(snVal)
                                ? prev.filter((x) => x !== snVal)
                                : [...prev, snVal];
                              if (next.length > 0) setReserveQty(String(next.length));
                              return next;
                            });
                          }}
                          className={`p-2 rounded flex-row items-center justify-between ${
                            checked ? "bg-primary/10" : ""
                          }`}
                        >
                          <Text className="text-xs font-mono font-semibold">
                            {s.sn} <Text className="font-normal text-muted-foreground">({s.gudang})</Text>
                          </Text>
                          {checked ? <Check size={14} color={colors.primary} /> : null}
                        </Pressable>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            ) : null}
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setReserveOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleAddReservation}>
              <Text>Cek Stok & Simpan</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Preview & Cetak BAST */}
      <Dialog open={bastOpen} onOpenChange={setBastOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Berita Acara Serah Terima (BAST)</DialogTitle>
          </DialogHeader>
          <ScrollView className="py-2 gap-4">
            <View className="bg-panel border-border/80 rounded-xl border p-4 gap-2">
              <Text className="font-bold text-sm tracking-wide">PT GHINA MULTI PRIMA</Text>
              <Text className="text-xs text-muted-foreground">BERITA ACARA SERAH TERIMA PEKERJAAN (BAST)</Text>
              <View className="border-border border-t pt-2 gap-1 mt-1">
                <Text className="text-xs font-semibold">Nama Proyek: {row.nama}</Text>
                <Text className="text-xs text-muted-foreground">Pihak Pertama (Penyedia): PT Ghina Multi Prima</Text>
                <Text className="text-xs text-muted-foreground">Pihak Kedua (Klien): {row.customer}</Text>
                <Text className="text-xs text-muted-foreground">Project Manager: {row.pm}</Text>
                <Text className="text-xs text-muted-foreground">Tanggal: {new Date().toISOString().slice(0, 10)}</Text>
              </View>
            </View>

            <View className="border-border border rounded-xl p-3 gap-1.5">
              <Text className="text-xs font-semibold">Pernyataan Serah Terima:</Text>
              <Text className="text-xs leading-relaxed text-muted-foreground">
                Dengan ini kedua belah pihak menyatakan bahwa pekerjaan pengadaan, instalasi, dan integrasi perangkat untuk proyek di atas telah diselesaikan dengan baik, telah diuji coba secara bersama-sama, dan dinyatakan berfungsi normal sesuai spesifikasi teknis yang disepakati.
              </Text>
            </View>

            <View className="border-border border rounded-xl p-3 gap-2">
              <Text className="text-xs font-semibold">Rincian Material Project:</Text>
              {requirements.map((m, idx) => (
                <Text key={m.id} className="text-xs text-muted-foreground">{idx + 1}. {m.produk} — {m.neededQty} unit</Text>
              ))}
            </View>

            <View className="border-border border-t pt-4 flex-row justify-between">
              <View className="items-center w-40">
                <Text className="text-[11px] text-muted-foreground">Pihak Pertama</Text>
                <View className="h-14" />
                <Text className="text-xs font-semibold">{row.pm || "Project Manager"}</Text>
                <Text className="text-[10px] text-muted-foreground">PT Ghina Multi Prima</Text>
              </View>
              <View className="items-center w-40">
                <Text className="text-[11px] text-muted-foreground">Pihak Kedua</Text>
                <View className="h-14" />
                <Text className="text-xs font-semibold">{row.customer}</Text>
                <Text className="text-[10px] text-muted-foreground">Penanggung Jawab Proyek</Text>
              </View>
            </View>
          </ScrollView>
          <DialogFooter>
            <Button variant="outline" onPress={() => setBastOpen(false)}>
              <Text>Tutup</Text>
            </Button>
            <Button onPress={handlePrintBast} className="flex-row items-center gap-1.5">
              <Printer size={14} color={colors.background} />
              <Text>Cetak / Simpan BAST</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CreateInvoiceDialog open={createInvOpen} onOpenChange={setCreateInvOpen} />
    </>
  );
}
