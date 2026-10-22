import * as React from "react";
import { View, ScrollView, Pressable } from "react-native";
import { Printer, Plus, Check } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Panel } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { useApp } from "@/store/app-store";
import { api, downloadDocumentationPdf } from "@/services/api";
import { colors } from "@/tokens";
import { rupiah } from "@/lib/format";
import { type Row } from "@/constants/modules";
import { DocumentationPhotosPanel } from "@/modules/shared/documentation-photos-panel";
import { Line } from "@/modules/shared/line";

export function ProjectExtras({ row }: { row: Row }) {
  const { toast, data, reload, user } = useApp();
  const products: Row[] = data.products ?? [];
  const serials: Row[] = data.serials ?? [];
  const [reserveOpen, setReserveOpen] = React.useState(false);
  const [selectedProduct, setSelectedProduct] = React.useState("");
  const [reserveQty, setReserveQty] = React.useState("2");
  const [selectedSns, setSelectedSns] = React.useState<string[]>([]);
  const [bastOpen, setBastOpen] = React.useState(false);
  const [requirements, setRequirements] = React.useState<
    { id: string; produk: string; neededQty: number; reservedQty: number; shortageQty: number; status: string; serials?: string[] }[]
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

  const canViewFinancials = ["super_admin", "bos", "finance"].includes(user?.role || "");
  const projectInvoices = (data.invoices || []).filter(
    (i: any) => String(i.projectId) === String(row.id) && i.status !== "Batal"
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
        produk: r.product?.name ?? "Barang",
        neededQty: needed,
        reservedQty: reserved,
        shortageQty: shortage,
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

  return (
    <>
      <Panel
        title="Kebutuhan & Reservasi Material Gudang"
        subtitle="Sistem otomatis mengecek stok, me-reserve yang tersedia, dan membuat Request ke Procurement jika kurang."
        right={
          <Button size="sm" variant="outline" onPress={() => setReserveOpen(true)} className="flex-row items-center gap-1">
            <Plus size={14} color={colors.text} />
            <Text className="text-xs">Tambah Kebutuhan Barang</Text>
          </Button>
        }
      >
        <View className="gap-2">
          {requirements.length === 0 ? (
            <Text className="text-muted-foreground text-xs py-2">Belum ada daftar kebutuhan barang untuk project ini.</Text>
          ) : (
            requirements.map((m) => (
              <Line
                key={m.id}
                left={m.produk}
                sub={m.status}
                right={<Text className="font-semibold text-sm">{m.neededQty} unit</Text>}
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
    </>
  );
}
