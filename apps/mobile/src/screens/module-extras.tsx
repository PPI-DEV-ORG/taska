import * as React from "react";
import { View, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { AlertTriangle, CheckCircle2, Circle, FileText, ArrowRight, FileDown, Printer, Plus, Trash2, Edit3, Eye } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Panel, Cell } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { ScanInput } from "@/components/taska/scan-input";
import { FileUploader } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { rupiah, tanggal } from "@/lib/format";
import type { Row } from "@/mock/data";

const PRICE_ROLES = ["procurement", "finance", "pm", "bos"];

function Line({ left, right, sub }: { left: string; right?: React.ReactNode; sub?: string }) {
  return (
    <View className="border-border flex-row items-center justify-between gap-3 border-b py-2.5">
      <View className="flex-1">
        <Text className="text-sm">{left}</Text>
        {sub ? <Text className="text-muted-foreground text-[13px]">{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export type QuotationItem = {
  id: string;
  item: string;
  qty: number;
  satuan: string;
  harga: number;
};

export function downloadQuotationTemplate(info?: { customer?: string; lead?: string; nomor?: string }) {
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    try {
      const csvContent =
        "data:text/csv;charset=utf-8," +
        encodeURIComponent(
          [
            "KOP SURAT PERUSAHAAN - PT GHINA MULTI PRIMA / TASKA SYSTEM",
            `Kepada Yth: ${info?.customer || "Nama Pelanggan / Perusahaan"}`,
            `Tanggal: ${new Date().toISOString().slice(0, 10)}`,
            `Quote No: ${info?.nomor || "PNW/2026/10/001"}`,
            `Subject: Penawaran Pengadaan Barang & Jasa Instalasi (${info?.lead || "Pekerjaan"})`,
            "",
            "No,Item / Jasa,QTY,Satuan,Harga Satuan,Total",
            '1,"HDD 1TB Surveillance",1,Unit,1050000,1050000',
            '2,"Adaptor XVR/DVR 12v 2a",1,Unit,450000,450000',
            '3,"Jasa Pergantian HDD XVR & Setup Kamera",1,Lot,1500000,1500000',
            "TOTAL,,,,,3000000",
            "PPN (11%),,,,,330000",
            "GRAND TOTAL,,,,,3330000",
            "",
            "Notes:",
            "1. Penawaran ini berlaku 1 bulan",
            "2. Penambahan material/jasa dikenakan harga sesuai nilai jual material/jasa tersebut",
            "3. Garansi perangkat 1 Tahun Harddisk dan PSU 6 Bulan Instalasi 3 Bulan",
          ].join("\n")
        );
      const link = document.createElement("a");
      link.setAttribute("href", csvContent);
      link.setAttribute("download", `template-penawaran-${(info?.lead || "lead").toLowerCase().replace(/[^a-z0-9]/g, "-")}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {}
  }
}

export function QuotationPreviewModal({
  open,
  onOpenChange,
  row,
  items,
  calcPpn,
  discNum,
  itemsTotal,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row: Row;
  items: QuotationItem[];
  calcPpn: number;
  discNum: number;
  itemsTotal: number;
  onSave?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl md:max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Surat Penawaran Resmi (Template Taska)</DialogTitle>
        </DialogHeader>
        <ScrollView style={{ maxHeight: 600 }} contentContainerClassName="gap-4 p-3 bg-white rounded-xl text-black">
          {/* Kop Surat */}
          <View className="border-b-2 border-black pb-3 items-center">
            <Text className="text-base font-bold text-black tracking-widest uppercase">KOP SURAT PERUSAHAAN</Text>
            <Text className="text-xs text-black">PT GHINA MULTI PRIMA / TASKA SYSTEM</Text>
            <Text className="text-[10px] text-zinc-600">Telp: 021 2284 3608 · WA: 0859 5959 8852 / 0821 2345 9144</Text>
            <Text className="text-[10px] text-zinc-600">Email: cs@ghinamultiprima.co.id · www.ghinamultiprima.co.id</Text>
          </View>

          {/* Tanggal & Tujuan */}
          <View className="flex-row justify-between">
            <View className="gap-0.5">
              <Text className="text-xs text-black font-semibold">Kepada Yth.</Text>
              <Text className="text-sm text-black font-bold">{row.customer || row.perusahaan || "Yayasan BM 400"}</Text>
              <Text className="text-xs text-black font-semibold">Di Tempat</Text>
            </View>
            <View className="items-end">
              <Text className="text-xs text-black font-semibold">Bekasi, {tanggal(row.dibuat || new Date().toISOString())}</Text>
            </View>
          </View>

          {/* Subject & Quote No */}
          <View className="gap-1 bg-zinc-50 p-2.5 rounded border border-zinc-200">
            <Text className="text-xs text-black font-semibold">Subject : Penawaran Pengadaan Barang & Jasa Instalasi ({row.lead || row.nama || "Sistem CCTV / Jaringan"})</Text>
            <Text className="text-xs text-black font-semibold">Quote No. : {row.nomor || "0249/GM/IX/2026"}</Text>
          </View>

          <Text className="text-xs text-black leading-relaxed">
            Dengan hormat,{"\n"}
            Sesuai permintaan Bapak / Ibu sebelumnya, berikut penawaran dari kami terkait pengadaan Barang & Jasa Instalasi:
          </Text>

          {/* Tabel Item Mirip Excel Warna Cyan/Biru */}
          <View className="border border-black overflow-hidden rounded">
            <View className="flex-row bg-[#00bcd4] border-b border-black py-2 px-2">
              <Text className="w-8 text-[11px] font-bold text-black text-center">No.</Text>
              <Text className="flex-1 text-[11px] font-bold text-black">Item / Jasa</Text>
              <Text className="w-12 text-[11px] font-bold text-black text-center">QTY</Text>
              <Text className="w-16 text-[11px] font-bold text-black text-center">Satuan</Text>
              <Text className="w-24 text-[11px] font-bold text-black text-right">Harga</Text>
              <Text className="w-24 text-[11px] font-bold text-black text-right">Total</Text>
            </View>

            {items.map((it, idx) => (
              <View key={it.id} className="flex-row border-b border-zinc-300 py-1.5 px-2 bg-white">
                <Text className="w-8 text-[11px] text-black text-center">{idx + 1}</Text>
                <Text className="flex-1 text-[11px] text-black font-medium">{it.item}</Text>
                <Text className="w-12 text-[11px] text-black text-center">{it.qty}</Text>
                <Text className="w-16 text-[11px] text-black text-center">{it.satuan}</Text>
                <Text className="w-24 text-[11px] text-black text-right">{rupiah(it.harga)}</Text>
                <Text className="w-24 text-[11px] text-black text-right font-medium">{rupiah(it.qty * it.harga)}</Text>
              </View>
            ))}

            {/* Total rows */}
            <View className="flex-row border-b border-black bg-zinc-50 py-1.5 px-2">
              <Text className="flex-1 text-[11px] font-bold text-black text-right pr-4">TOTAL</Text>
              <Text className="w-24 text-[11px] font-bold text-black text-right">{rupiah(itemsTotal)}</Text>
            </View>
            <View className="flex-row border-b border-black bg-zinc-50 py-1.5 px-2">
              <Text className="flex-1 text-[11px] font-bold text-black text-right pr-4">PPN (11%)</Text>
              <Text className="w-24 text-[11px] font-bold text-black text-right">{rupiah(calcPpn)}</Text>
            </View>
            <View className="flex-row bg-zinc-100 py-2 px-2">
              <Text className="flex-1 text-xs font-bold text-black text-right pr-4">GRAND TOTAL</Text>
              <Text className="w-24 text-xs font-bold text-black text-right">{rupiah(itemsTotal + calcPpn - discNum)}</Text>
            </View>
          </View>

          {/* Notes */}
          <View className="gap-1 pt-1">
            <Text className="text-xs font-bold text-black">Notes:</Text>
            <Text className="text-[11px] text-black">1. Penawaran ini berlaku 1 bulan (s/d {tanggal(row.berlaku || new Date().toISOString())})</Text>
            <Text className="text-[11px] text-black">2. Penambahan material/jasa dikenakan harga sesuai nilai jual material/jasa tersebut</Text>
            <Text className="text-[11px] text-black">3. Garansi perangkat 1 Tahun, Harddisk dan PSU 6 Bulan, Instalasi 3 Bulan</Text>
          </View>

          {/* Penutup & TTD */}
          <View className="gap-4 pt-2">
            <Text className="text-[11px] text-black leading-relaxed">
              Sekian surat penawaran ini kami buat dengan harapan agar Bapak/Ibu bisa bekerjasama dengan perusahaan kami. Kami tunggu tanggapan dan kabar baik.
            </Text>

            <View className="items-start gap-1 pt-4">
              <Text className="text-[11px] text-black">TTD,</Text>
              <View className="h-10" />
              <Text className="text-xs font-bold text-black underline">{row.pemilik || "Iqbal / Dewi Lestari"}</Text>
              <Text className="text-[10px] text-zinc-600">Sales Representative</Text>
            </View>
          </View>
        </ScrollView>

        <DialogFooter className="flex-row flex-wrap justify-between gap-2 w-full">
          <Button variant="outline" onPress={() => onOpenChange(false)}>
            <Text>Tutup</Text>
          </Button>
          <View className="flex-row flex-wrap gap-2">
            <Button
              variant="outline"
              onPress={() => {
                if (typeof window !== "undefined") {
                  window.print?.();
                }
              }}
            >
              <Printer size={15} color={colors.text} />
              <Text>Cetak / Simpan PDF</Text>
            </Button>
            {onSave ? (
              <Button
                onPress={() => {
                  // Otomatis download file Excel / CSV berbasis template
                  if (typeof window !== "undefined" && typeof document !== "undefined") {
                    try {
                      const csvContent =
                        "data:text/csv;charset=utf-8," +
                        encodeURIComponent(
                          [
                            "KOP SURAT PERUSAHAAN - PT GHINA MULTI PRIMA / TASKA SYSTEM",
                            `Kepada Yth: ${row.customer || row.perusahaan || "Pelanggan"}`,
                            `Tanggal: ${row.dibuat || new Date().toISOString().slice(0, 10)}`,
                            `Quote No: ${row.nomor || "PNW/2026/10/001"}`,
                            `Subject: Penawaran Pengadaan Barang & Jasa Instalasi (${row.lead || row.nama || "Sistem"})`,
                            "",
                            "No,Item / Jasa,QTY,Satuan,Harga Satuan,Total",
                            ...items.map((it, idx) => `${idx + 1},"${it.item}",${it.qty},${it.satuan},${it.harga},${it.qty * it.harga}`),
                            `TOTAL,,,,,"${itemsTotal}"`,
                            `PPN (11%),,,,,"${calcPpn}"`,
                            `GRAND TOTAL,,,,,"${itemsTotal + calcPpn - discNum}"`,
                            "",
                            "Notes:",
                            "1. Penawaran ini berlaku 1 bulan",
                            "2. Penambahan material/jasa dikenakan harga sesuai nilai jual material/jasa tersebut",
                            "3. Garansi perangkat 1 Tahun Harddisk dan PSU 6 Bulan Instalasi 3 Bulan",
                          ].join("\n")
                        );
                      const link = document.createElement("a");
                      link.setAttribute("href", csvContent);
                      link.setAttribute("download", `${(row.nomor || "penawaran").replace(/\//g, "-")}-template.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    } catch {}
                  }
                  onSave();
                }}
              >
                <FileDown size={15} color={colors.background} />
                <Text>Generate & Download Penawaran</Text>
              </Button>
            ) : null}
          </View>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function QuotationTemplateGenerator({
  row,
  totNum,
  calcPpn,
  calcTotalAfterDisc,
  discNum,
  onUpdateItems,
}: {
  row: Row;
  totNum: number;
  calcPpn: number;
  calcTotalAfterDisc: number;
  discNum: number;
  onUpdateItems: (items: QuotationItem[], newTotal: number) => void;
}) {
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [editItemsOpen, setEditItemsOpen] = React.useState(false);

  // Default items sesuai template
  const defaultItems: QuotationItem[] = [
    { id: "1", item: "HDD 1TB Surveillance", qty: 1, satuan: "Unit", harga: Math.round((totNum || 3000000) * 0.35) },
    { id: "2", item: "Adaptor XVR/DVR 12v 2a", qty: 1, satuan: "Unit", harga: Math.round((totNum || 3000000) * 0.15) },
    { id: "3", item: "Jasa Pergantian HDD XVR & Setup Kamera", qty: 1, satuan: "Lot", harga: Math.round((totNum || 3000000) * 0.5) },
  ];

  const [items, setItems] = React.useState<QuotationItem[]>(row.items && row.items.length ? row.items : defaultItems);

  // New item inputs
  const [newItemName, setNewItemName] = React.useState("");
  const [newItemQty, setNewItemQty] = React.useState("1");
  const [newItemSatuan, setNewItemSatuan] = React.useState("Unit");
  const [newItemHarga, setNewItemHarga] = React.useState("");

  const itemsTotal = items.reduce((acc, curr) => acc + curr.qty * curr.harga, 0);

  function addItem() {
    if (!newItemName.trim()) return;
    const q = Number(newItemQty) || 1;
    const h = Number(newItemHarga.replace(/\D/g, "")) || 0;
    const updated = [...items, { id: String(Date.now()), item: newItemName.trim(), qty: q, satuan: newItemSatuan.trim() || "Unit", harga: h }];
    setItems(updated);
    setNewItemName("");
    setNewItemQty("1");
    setNewItemHarga("");
  }

  function removeItem(id: string) {
    setItems(items.filter((it) => it.id !== id));
  }

  function handleSaveItems() {
    const total = items.reduce((acc, curr) => acc + curr.qty * curr.harga, 0);
    onUpdateItems(items, total);
    setEditItemsOpen(false);
  }

  return (
    <>
      <Panel
        title="Generate Penawaran dari Sistem (Template Resmi)"
        subtitle="Sistem meng-generate surat penawaran otomatis berdasarkan template Excel resmi Taska."
      >
        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-xs text-muted-foreground">Jumlah Item / Jasa Terdaftar</Text>
              <Text className="text-sm font-semibold">{items.length} Baris Item</Text>
            </View>
            <View className="flex-row gap-2">
              <Button variant="outline" size="sm" onPress={() => setEditItemsOpen(true)}>
                <Edit3 size={14} color={colors.text} />
                <Text className="text-xs">Kelola Item / Jasa</Text>
              </Button>
              <Button size="sm" onPress={() => setPreviewOpen(true)}>
                <Eye size={14} color={colors.background} />
                <Text className="text-xs">Lihat Template & Cetak</Text>
              </Button>
            </View>
          </View>
        </View>
      </Panel>

      {/* Modal Kelola Item Penawaran */}
      <Dialog open={editItemsOpen} onOpenChange={setEditItemsOpen}>
        <DialogContent className="sm:max-w-xl md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Kelola Item & Jasa Penawaran</DialogTitle>
          </DialogHeader>
          <View className="gap-4">
            <Text className="text-xs text-muted-foreground">
              Masukkan rincian barang/jasa sesuai kebutuhan lead. Total akan dihitung otomatis ke kalkulasi penawaran.
            </Text>

            <View className="bg-panel border-border/80 rounded-xl border p-3 gap-2">
              <Text className="text-xs font-semibold">Tambah Baris Baru</Text>
              <View className="flex-row flex-wrap gap-2">
                <View className="flex-1 min-w-[180px]">
                  <Input value={newItemName} onChangeText={setNewItemName} placeholder="Nama item / jasa (misal: HDD 1TB)" />
                </View>
                <View className="w-16">
                  <Input value={newItemQty} onChangeText={setNewItemQty} keyboardType="numeric" placeholder="Qty" />
                </View>
                <View className="w-20">
                  <Input value={newItemSatuan} onChangeText={setNewItemSatuan} placeholder="Unit/Lot" />
                </View>
                <View className="flex-1 min-w-[140px]">
                  <Input value={newItemHarga} onChangeText={setNewItemHarga} keyboardType="numeric" placeholder="Harga Satuan (Rp)" />
                </View>
                <Button size="sm" onPress={addItem} className="self-end">
                  <Plus size={15} color={colors.background} />
                  <Text className="text-xs">Tambah</Text>
                </Button>
              </View>
            </View>

            <ScrollView style={{ maxHeight: 240 }} contentContainerClassName="gap-2">
              {items.map((it, idx) => (
                <View key={it.id} className="bg-card border-border/60 flex-row items-center justify-between rounded-lg border p-2.5">
                  <View className="flex-1 mr-2">
                    <Text className="text-xs font-semibold">{idx + 1}. {it.item}</Text>
                    <Text className="text-[11px] text-muted-foreground">{it.qty} {it.satuan} × {rupiah(it.harga)}</Text>
                  </View>
                  <Text className="text-xs font-semibold text-primary mr-3">{rupiah(it.qty * it.harga)}</Text>
                  <Button variant="ghost" size="sm" onPress={() => removeItem(it.id)}>
                    <Trash2 size={14} color={colors.danger} />
                  </Button>
                </View>
              ))}
            </ScrollView>

            <View className="bg-panel border-border/50 flex-row items-center justify-between rounded-lg border p-3">
              <Text className="text-xs font-semibold">Total Item & Jasa:</Text>
              <Text className="text-sm font-bold text-primary">{rupiah(itemsTotal)}</Text>
            </View>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setEditItemsOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSaveItems}>
              <Text>Simpan ke Penawaran</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Preview Template Resmi */}
      <QuotationPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        row={row}
        items={items}
        calcPpn={calcPpn}
        discNum={discNum}
        itemsTotal={itemsTotal}
        onSave={() => {
          onUpdateItems(items, itemsTotal);
          setPreviewOpen(false);
        }}
      />
    </>
  );
}

function LeadExtras({ row }: { row: Row }) {
  const router = useRouter();
  const { toast, data } = useApp();
  const quotation = (data.quotations ?? []).find(
    (q) => (q.leadId && q.leadId === row.id) || (q.lead && q.lead.toLowerCase() === row.nama.toLowerCase())
  );
  const isQualify = ["Qualification", "Proposal", "Negotiation", "Won"].includes(row.status);

  const fu = [
    ["Telepon", "Membahas ruang lingkup dan jadwal survey", row.sepi],
    ["WhatsApp", "Mengirim contoh penawaran sebelumnya", row.sepi + 4],
    ["Email", "Perkenalan dan permintaan data kebutuhan", row.sepi + 9],
  ];

  return (
    <>
      {isQualify ? (
        <Panel
          title="Penawaran untuk Lead Ini"
          subtitle="Saat lead masuk tahap Qualification, penawaran otomatis disiapkan dengan nomor ter-generate."
        >
          {quotation ? (
            <View className="gap-3">
              <Line left="Nomor Penawaran" right={<Text className="text-primary font-bold">{quotation.nomor}</Text>} />
              <Line left="Total Nilai" right={<Text className="font-semibold">{rupiah(quotation.totalAfterDisc || quotation.nilai || 0)}</Text>} />
              <Line left="Status Penawaran" right={<StatusBadge status={quotation.status || "Not Yet"} />} />
              <Line
                left="File Dokumen"
                right={
                  quotation.fileUploaded ? (
                    <View className="flex-row items-center gap-1.5">
                      <CheckCircle2 size={14} color={colors.primary} />
                      <Text className="text-xs text-primary font-semibold">
                        {quotation.fileName || `${(quotation.nomor || "penawaran").replace(/\//g, "-")}-template.csv`}
                      </Text>
                    </View>
                  ) : (
                    <Text className="text-xs text-muted-foreground font-medium">Belum Diupload</Text>
                  )
                }
              />
              <View className="flex-row items-center gap-2 mt-1">
                <Button
                  size="sm"
                  onPress={() => router.push(`/quotations/${quotation.id}` as any)}
                  className="flex-row items-center gap-1.5"
                >
                  <FileText size={15} color={colors.background} />
                  <Text className="text-xs">Buka Penawaran ({quotation.nomor})</Text>
                  <ArrowRight size={14} color={colors.background} />
                </Button>
              </View>
            </View>
          ) : (
            <View className="gap-3">
              <Text className="text-xs text-muted-foreground leading-relaxed">
                Lead sudah masuk tahap kualifikasi. Silakan unduh template penawaran untuk diisi secara manual, lalu upload hasilnya di modul Penawaran.
              </Text>
              <Button
                size="sm"
                variant="outline"
                onPress={() => {
                  downloadQuotationTemplate({ customer: row.perusahaan, lead: row.nama });
                  toast("Template penawaran berhasil diunduh");
                }}
                className="self-start flex-row items-center gap-1.5"
              >
                <FileDown size={15} color={colors.text} />
                <Text className="text-xs">Download Template Penawaran</Text>
              </Button>
            </View>
          )}
        </Panel>
      ) : null}

      {row.status === "Lost" ? (
        <Panel title="Alasan Lost"><Text className="text-danger text-sm">{row.alasanLost || "-"}</Text></Panel>
      ) : null}
      {row.sepi > 7 && row.status !== "Won" && row.status !== "Lost" ? (
        <View className="bg-warning/15 flex-row items-center gap-2 rounded-xl p-3">
          <AlertTriangle size={16} color={colors.warning} />
          <Text className="text-warning flex-1 text-sm">Belum ada tindak lanjut selama {row.sepi} hari.</Text>
        </View>
      ) : null}
      <Panel title="Riwayat tindak lanjut">
        {fu.map(([m, n, d]) => (
          <Line key={String(n)} left={`${m}: ${n}`} sub={`${d} hari lalu`} />
        ))}
      </Panel>
    </>
  );
}

function QuotationExtras({ row }: { row: Row }) {
  const { patchRow, toast } = useApp();
  const versions = Array.from({ length: row.versi }, (_, i) => row.versi - i);
  const [editFinancials, setEditFinancials] = React.useState(false);
  const [inputTotal, setInputTotal] = React.useState(String(row.total || row.nilai || "0"));
  const [inputDisc, setInputDisc] = React.useState(String(row.disc || "0"));

  const totNum = Number(inputTotal.replace(/\D/g, "")) || 0;
  const discNum = Number(inputDisc.replace(/\D/g, "")) || 0;
  const calcPpn = Math.round(totNum * 0.11);
  const calcTotalAfterDisc = Math.max(0, totNum + calcPpn - discNum);

  function handleSaveFinancials() {
    patchRow("quotations", row.id, {
      total: totNum,
      nilai: totNum,
      ppn: calcPpn,
      disc: discNum,
      totalAfterDisc: calcTotalAfterDisc,
    });
    setEditFinancials(false);
    toast("Nilai penawaran berhasil diperbarui");
  }

  return (
    <>
      <Panel
        title="Rincian Nilai & Kalkulasi Penawaran"
        subtitle="Nomor penawaran dibuat otomatis oleh sistem. Sales menginput nilai & diskon dari draft Excel."
      >
        <View className="gap-3">
          <Line left="Nomor Penawaran (Auto-Generated)" right={<Text className="text-primary font-bold">{row.nomor}</Text>} />
          <Line left="Lead Sumber" right={<Text className="font-semibold">{row.lead}</Text>} />
          <Line left="Customer" right={<Text className="text-text-secondary">{row.customer}</Text>} />
          <Line left="TOTAL (Sebelum PPN & Disc)" right={<Text className="font-semibold">{rupiah(row.total || row.nilai || 0)}</Text>} />
          <Line left="PPN (11%)" right={<Text className="font-semibold">{rupiah(row.ppn ?? Math.round((row.total || row.nilai || 0) * 0.11))}</Text>} />
          <Line left="DISC (Diskon)" right={<Text className="text-danger font-semibold">- {rupiah(row.disc || 0)}</Text>} />
          <Line
            left="TOTAL AFTER DISC (Total Akhir)"
            right={<Text className="text-primary text-base font-bold">{rupiah(row.totalAfterDisc || row.total || row.nilai || 0)}</Text>}
          />
          <Line left="Status Penawaran" right={<StatusBadge status={row.status || "Not Yet"} />} />

          {row.status === "Not Yet" && (
            <View className="bg-warning/10 border-warning/30 flex-row items-center gap-2 rounded-xl border p-3 mt-1">
              <AlertTriangle size={16} color={colors.warning} />
              <Text className="text-warning text-xs flex-1">
                Status masih <b>Not Yet</b>. Silakan upload file Excel/PDF penawaran dan sesuaikan nilai di bawah agar status menjadi <b>Done</b>.
              </Text>
            </View>
          )}

          {!editFinancials ? (
            <Button variant="outline" size="sm" onPress={() => setEditFinancials(true)} className="mt-2 self-start">
              <Text className="text-xs">Ubah Nilai & Diskon</Text>
            </Button>
          ) : (
            <View className="bg-panel border-border/80 gap-3 rounded-xl border p-4 mt-2">
              <Text className="text-sm font-semibold text-foreground">Edit Nilai Penawaran</Text>
              <View className="gap-1">
                <Text className="text-xs text-muted-foreground">TOTAL Nilai (Rp)</Text>
                <Input
                  value={inputTotal}
                  onChangeText={setInputTotal}
                  placeholder="Contoh: 185000000"
                  keyboardType="numeric"
                />
              </View>
              <View className="gap-1">
                <Text className="text-xs text-muted-foreground">Diskon / DISC (Rp)</Text>
                <Input
                  value={inputDisc}
                  onChangeText={setInputDisc}
                  placeholder="Contoh: 5000000"
                  keyboardType="numeric"
                />
              </View>
              <View className="bg-card border-border/50 gap-1 rounded-lg border p-2.5">
                <Text className="text-[11px] text-muted-foreground">Preview PPN (11%): {rupiah(calcPpn)}</Text>
                <Text className="text-xs font-semibold text-primary">Preview TOTAL AFTER DISC: {rupiah(calcTotalAfterDisc)}</Text>
              </View>
              <View className="flex-row gap-2 pt-1">
                <Button variant="outline" size="sm" onPress={() => setEditFinancials(false)}>
                  <Text className="text-xs">Batal</Text>
                </Button>
                <Button size="sm" onPress={handleSaveFinancials}>
                  <Text className="text-xs">Simpan Perubahan</Text>
                </Button>
              </View>
            </View>
          )}
        </View>
      </Panel>

      <Panel
        title="Upload File Penawaran (Excel / PDF)"
        subtitle="Upload dokumen penawaran hasil olahan manual Excel dari sales."
      >
        <View className="gap-3">
          <Line
            left="Status File Dokumen"
            right={
              row.fileUploaded ? (
                <View className="flex-row items-center gap-1.5">
                  <CheckCircle2 size={15} color={colors.primary} />
                  <Text className="text-xs font-semibold text-primary">File Terupload</Text>
                </View>
              ) : (
                <Text className="text-xs text-muted-foreground font-medium">Belum Ada File</Text>
              )
            }
          />
          {row.fileName ? (
            <Line left="Nama File Terakhir" right={<Text className="text-xs text-foreground font-mono">{row.fileName}</Text>} />
          ) : null}

          <FileUploader
            label="Pilih atau Tarik File Excel/PDF"
            kind="dokumen"
            onChange={(count) => {
              if (count > 0) {
                patchRow("quotations", row.id, {
                  fileUploaded: true,
                  fileName: `${row.nomor.replace(/\//g, "-")}-penawaran.xlsx`,
                  status: row.status === "Not Yet" ? "Done" : row.status,
                });
                toast("File penawaran berhasil diupload. Status kini 'Done'");
              }
            }}
          />
        </View>
      </Panel>

      <QuotationTemplateGenerator
        row={row}
        totNum={totNum}
        calcPpn={calcPpn}
        calcTotalAfterDisc={calcTotalAfterDisc}
        discNum={discNum}
        onUpdateItems={(items, newTotal) => {
          const newPpn = Math.round(newTotal * 0.11);
          const newAfterDisc = Math.max(0, newTotal + newPpn - discNum);
          patchRow("quotations", row.id, {
            items,
            total: newTotal,
            nilai: newTotal,
            ppn: newPpn,
            totalAfterDisc: newAfterDisc,
            fileUploaded: true,
            fileName: `${row.nomor.replace(/\//g, "-")}-auto-generated.pdf`,
            status: row.status === "Not Yet" ? "Done" : row.status,
          });
          setInputTotal(String(newTotal));
          toast("Template penawaran berhasil di-generate & disimpan!");
        }}
      />

      <Panel title="Riwayat Versi" subtitle="Revisi tidak menimpa versi lama. Hanya versi terakhir dipakai sebagai acuan nilai.">
        {versions.map((v, i) => (
          <Line
            key={v}
            left={`Versi ${v}`}
            sub={`${row.nomor.replace(/\//g, "-")}-v${v}.pdf`}
            right={
              <View className="items-end gap-1">
                <Text className="text-sm font-medium">{rupiah(row.nilai * (1 + i * 0.04))}</Text>
                {i === 0 ? <StatusBadge status={row.status || "Disetujui"} /> : null}
              </View>
            }
          />
        ))}
      </Panel>
    </>
  );
}

export function ModuleExtras({ moduleKey, row }: { moduleKey: string; row: Row }) {
  const { user, patchRow, setStatus, toast, data } = useApp();

  if (moduleKey === "leads") {
    return <LeadExtras row={row} />;
  }

  if (moduleKey === "quotations") {
    return <QuotationExtras row={row} />;
  }

  if (moduleKey === "po-client") {
    const sisa = row.nilai - row.totalInvoice;
    return (
      <>
        {row.totalInvoice > row.nilai ? (
          <View className="bg-warning/15 flex-row items-center gap-2 rounded-xl p-3">
            <AlertTriangle size={16} color={colors.warning} />
            <Text className="text-warning flex-1 text-sm">Total invoice melebihi nilai PO sebesar {rupiah(-sisa)}. Ini hanya peringatan, data tetap tersimpan.</Text>
          </View>
        ) : null}
        <Panel title="Ringkasan PO">
          <Line left="Total PO" right={<Text className="text-sm font-medium">{rupiah(row.nilai)}</Text>} />
          <Line left="Total invoice" right={<Text className="text-sm font-medium">{rupiah(row.totalInvoice)}</Text>} />
          <Line left="Sisa" right={<Text className="text-sm font-medium">{rupiah(Math.max(0, sisa))}</Text>} />
        </Panel>
      </>
    );
  }

  if (moduleKey === "invoices") {
    const sisa = row.total - row.terbayar;
    function pay() {
      const amount = Math.min(sisa, Math.round(row.total * 0.3));
      if (amount <= 0) { toast("Invoice sudah lunas", "info"); return; }
      const terbayar = row.terbayar + amount;
      patchRow("invoices", row.id, { terbayar, status: terbayar >= row.total ? "Lunas" : "Dibayar sebagian" });
      toast(`Pembayaran ${rupiah(amount)} dicatat`);
    }
    return (
      <>
        <Panel title="Ringkasan pembayaran" right={user!.role === "finance" || user!.role === "bos" ? <Button variant="outline" size="sm" onPress={pay}><Text>Catat pembayaran</Text></Button> : undefined}>
          <Line left="Total tagihan" right={<Text className="text-sm font-medium">{rupiah(row.total)}</Text>} />
          <Line left="Sudah dibayar" right={<Text className="text-success text-sm font-medium">{rupiah(row.terbayar)}</Text>} />
          <Line left="Sisa" right={<Text className="text-sm font-medium">{rupiah(sisa)}</Text>} />
        </Panel>
        <Panel title="Pembayaran masuk">
          {row.terbayar > 0 ? (
            <Line left="Transfer bank" sub="Bukti: bukti-transfer.jpg" right={<Text className="text-sm">{rupiah(row.terbayar)}</Text>} />
          ) : (
            <Text className="text-muted-foreground text-sm">Belum ada pembayaran.</Text>
          )}
        </Panel>
      </>
    );
  }

  if (moduleKey === "supplier-pos") {
    const steps = ["Di Supplier", "Dikirim", "Sampai"];
    const cur = steps.indexOf(row.pengiriman);
    const showPrice = PRICE_ROLES.includes(user!.role);
    function go(s: string) {
      patchRow("supplier-pos", row.id, { pengiriman: s, status: s });
      setStatus("supplier-pos", row.id, s);
    }
    return (
      <>
        <Panel title="Pengiriman dari supplier" subtitle="Status diubah manual oleh Procurement dengan bukti DO">
          {steps.map((s, i) => (
            <View key={s} className="flex-row items-center gap-3 py-2">
              {i <= cur ? <CheckCircle2 size={20} color={colors.success} /> : <Circle size={20} color={colors.border} />}
              <Text className={i <= cur ? "text-sm font-medium" : "text-muted-foreground text-sm"}>{s}</Text>
            </View>
          ))}
          {(user!.role === "procurement" || user!.role === "bos") && cur < 2 && steps[cur + 1] ? (
            <Button
              className="mt-2 self-start"
              variant="outline"
              onPress={() => {
                const nextStep = steps[cur + 1];
                if (nextStep) go(nextStep);
              }}
            >
              <Text>Tandai {steps[cur + 1]}</Text>
            </Button>
          ) : null}
        </Panel>
        <Panel title="Barang di PO ini">
          {String(row.item).split(", ").map((it) => (
            <Line key={it} left={it} right={showPrice ? <Text className="text-muted-foreground text-sm">Harga beli tampil</Text> : undefined} />
          ))}
          {showPrice ? <Line left="Total harga beli" right={<Text className="text-sm font-semibold">{rupiah(row.total)}</Text>} /> : null}
          <Text className="text-muted-foreground mt-2 text-[13px]">Penerimaan sebagian diperbolehkan di Gudang.</Text>
        </Panel>
      </>
    );
  }

  if (moduleKey === "delivery-notes") {
    return (
      <>
        <Panel title="Barang yang dibawa">
          {row.barang === "-" ? (
            <Text className="text-muted-foreground text-sm">Surat jalan ini tanpa barang.</Text>
          ) : (
            <>
              <Line left={row.barang} sub="Barang ber-SN wajib di-scan sebelum berangkat" />
              {user!.role === "gudang" || user!.role === "bos" ? (
                <View className="mt-3"><ScanInput /></View>
              ) : null}
            </>
          )}
        </Panel>
        {row.status === "Dikirim" && row.barang !== "-" && (user!.role === "teknisi" || user!.role === "bos") ? (
          <Button className="self-start" variant="outline" onPress={() => setStatus("delivery-notes", row.id, "Diterima")}><Text>Tandai diterima di lokasi</Text></Button>
        ) : null}
      </>
    );
  }

  if (moduleKey === "expenses") {
    return row.nominal > 10_000_000 ? (
      <View className="bg-warning/15 flex-row items-center gap-2 rounded-xl p-3">
        <AlertTriangle size={16} color={colors.warning} />
        <Text className="text-warning flex-1 text-sm">Nominal besar. Perlu persetujuan Bos selain Finance.</Text>
      </View>
    ) : null;
  }

  if (moduleKey === "receiving") {
    return (
      <Panel title="Isi penerimaan">
        <Line left={row.item} sub={`PO ${row.po}`} right={<StatusBadge status={row.status} />} />
        <Text className="text-muted-foreground mt-2 text-[13px]">Disetujui Gudang dan Procurement.</Text>
      </Panel>
    );
  }

  if (moduleKey === "customers") {
    const leads = (data.leads ?? []).filter((l: Row) => l.perusahaan === row.nama);
    return (
      <Panel title={`Lead milik customer ini (${leads.length})`}>
        {leads.length === 0 ? <Text className="text-muted-foreground text-sm">Belum ada lead.</Text> : leads.map((l) => (
          <Line key={l.id} left={l.nama} sub={`Perkiraan closing ${tanggal(l.closing)}`} right={<Cell fmt="status" value={l.status} />} />
        ))}
      </Panel>
    );
  }

  return null;
}
