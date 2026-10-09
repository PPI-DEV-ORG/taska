import * as React from "react";
import { View, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  FileText,
  ArrowRight,
  FileDown,
  Printer,
  Plus,
  Trash2,
  Edit3,
  Eye,
  Phone,
  MessageSquare,
  Mail,
  Calendar,
  UserCheck,
  ShieldAlert,
  Package,
  Check,
  RefreshCw,
  Layers,
  UploadCloud,
  FileCheck2,
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Panel, Cell, FormField } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { ScanInput } from "@/components/taska/scan-input";
import { SearchableSelect } from "@/components/taska/dialogs";
import { FileUploader } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { rupiah, tanggal } from "@/lib/format";
import { type Row, LOST_REASONS, USERS, PRODUCTS } from "@/mock/data";

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
  const { toast, data, patchRow, pushHistory, user } = useApp();
  const quotation = (data.quotations ?? []).find(
    (q) => (q.leadId && q.leadId === row.id) || (q.lead && q.lead.toLowerCase() === row.nama.toLowerCase())
  );
  const isQualify = ["Qualification", "Proposal", "Negotiation", "Won"].includes(row.status);

  // Follow-up state
  const [fuOpen, setFuOpen] = React.useState(false);
  const [fuMethod, setFuMethod] = React.useState<"Telepon" | "WhatsApp" | "Meeting" | "Email" | "Survey">("Telepon");
  const [fuNote, setFuNote] = React.useState("");
  const [fuNextAction, setFuNextAction] = React.useState("");
  const [localFollowups, setLocalFollowups] = React.useState<{ id: string; method: string; note: string; date: string; next?: string }[]>([
    { id: "fu-1", method: "Telepon", note: "Membahas ruang lingkup dan jadwal survey", date: `${row.sepi} hari lalu` },
    { id: "fu-2", method: "WhatsApp", note: "Mengirim contoh penawaran dan spesifikasi perangkat", date: `${row.sepi + 4} hari lalu` },
    { id: "fu-3", method: "Email", note: "Perkenalan awal dan permintaan data teknis lokasi", date: `${row.sepi + 9} hari lalu` },
  ]);

  // Reassign Sales state
  const [reassignOpen, setReassignOpen] = React.useState(false);
  const [newOwner, setNewOwner] = React.useState(row.pemilik || "Dewi Lestari");
  const [reassignReason, setReassignReason] = React.useState("");

  // Edit Lost Reason state
  const [lostReasonOpen, setLostReasonOpen] = React.useState(false);
  const [selectedLostReason, setSelectedLostReason] = React.useState(row.alasanLost || LOST_REASONS[0]);

  const salesUsers = USERS.filter((u) => ["sales", "pm", "bos", "admin"].includes(u.role));

  function handleAddFollowup() {
    if (!fuNote.trim()) {
      toast("Catatan follow-up tidak boleh kosong", "danger");
      return;
    }
    const newEntry = {
      id: `fu-${Date.now()}`,
      method: fuMethod,
      note: fuNote.trim(),
      date: "Baru saja",
      next: fuNextAction.trim() || undefined,
    };
    setLocalFollowups([newEntry, ...localFollowups]);
    patchRow("leads", row.id, { sepi: 0 });
    pushHistory("leads", row.id, `Follow-up (${fuMethod}): ${fuNote.trim()}${fuNextAction ? ` | Next: ${fuNextAction.trim()}` : ""}`);
    toast("Tindak lanjut berhasil dicatat. Masa sepi di-reset ke 0 hari.");
    setFuNote("");
    setFuNextAction("");
    setFuOpen(false);
  }

  function handleReassign() {
    if (!newOwner) return;
    patchRow("leads", row.id, { pemilik: newOwner });
    pushHistory("leads", row.id, `Kepemilikan dialihkan ke ${newOwner}${reassignReason ? ` (${reassignReason})` : ""}`);
    toast(`Lead berhasil dialihkan kepada ${newOwner}`);
    setReassignOpen(false);
    setReassignReason("");
  }

  function handleSaveLostReason() {
    patchRow("leads", row.id, { alasanLost: selectedLostReason });
    pushHistory("leads", row.id, `Alasan Lost diperbarui: ${selectedLostReason}`);
    toast("Alasan Lost diperbarui");
    setLostReasonOpen(false);
  }

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

      <Panel
        title="PIC & Kepemilikan Lead"
        subtitle="Setiap lead memiliki PIC Sales yang bertanggung jawab mengawal pipeline."
        right={
          (user?.role === "bos" || user?.role === "admin" || user?.role === "sales") ? (
            <Button size="sm" variant="outline" onPress={() => setReassignOpen(true)}>
              <UserCheck size={14} color={colors.text} />
              <Text className="text-xs">Alihkan PIC</Text>
            </Button>
          ) : undefined
        }
      >
        <Line left="Sales Penanggung Jawab" right={<Text className="font-semibold text-primary">{row.pemilik || "-"}</Text>} />
        <Line left="Tipe Pelanggan" right={<Text className="font-medium">{row.tipe || "End user"}</Text>} />
        <Line left="Kontak Person Klien" right={<Text className="text-muted-foreground">{row.kontak || "-"}</Text>} />
      </Panel>

      {row.status === "Lost" ? (
        <Panel
          title="Alasan Lost"
          subtitle="Analisis penyebab kegagalan peluang untuk evaluasi sales."
          right={
            !["bos", "admin"].includes(user?.role || "") ? (
              <Button size="sm" variant="outline" onPress={() => setLostReasonOpen(true)}>
                <Edit3 size={13} color={colors.text} />
                <Text className="text-xs">Ubah Alasan</Text>
              </Button>
            ) : undefined
          }
        >
          <Text className="text-danger font-medium text-sm">{row.alasanLost || "Belum ada alasan tercatat"}</Text>
        </Panel>
      ) : null}

      {row.sepi > 7 && row.status !== "Won" && row.status !== "Lost" ? (
        <View className="bg-warning/15 border-warning/40 flex-row items-center gap-2 rounded-xl border p-3">
          <AlertTriangle size={16} color={colors.warning} />
          <Text className="text-warning flex-1 text-sm">
            Belum ada tindak lanjut selama {row.sepi} hari. Segera hubungi customer untuk mencegah lead dingin!
          </Text>
        </View>
      ) : null}

      <Panel
        title="Riwayat Tindak Lanjut (Follow-up)"
        subtitle="Aktivitas komunikasi sales dengan calon pelanggan. Otomatis me-reset masa sepi."
        right={
          <Button size="sm" onPress={() => setFuOpen(true)} className="flex-row items-center gap-1">
            <Plus size={14} color={colors.background} />
            <Text className="text-xs">Catat Follow-up</Text>
          </Button>
        }
      >
        <View className="gap-2">
          {localFollowups.map((item) => (
            <View key={item.id} className="border-border border-b py-2.5 last:border-b-0">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <View className="bg-primary/10 rounded-md p-1">
                    {item.method === "Telepon" ? <Phone size={13} color={colors.primary} /> : null}
                    {item.method === "WhatsApp" ? <MessageSquare size={13} color={colors.primary} /> : null}
                    {item.method === "Meeting" ? <UserCheck size={13} color={colors.primary} /> : null}
                    {item.method === "Email" ? <Mail size={13} color={colors.primary} /> : null}
                    {item.method === "Survey" ? <Calendar size={13} color={colors.primary} /> : null}
                  </View>
                  <Text className="text-xs font-semibold text-foreground">{item.method}</Text>
                </View>
                <Text className="text-[11px] text-muted-foreground">{item.date}</Text>
              </View>
              <Text className="text-xs text-foreground mt-1 leading-relaxed">{item.note}</Text>
              {item.next ? (
                <View className="bg-panel/60 border-border/60 mt-1.5 flex-row items-center gap-1.5 rounded p-1.5 border">
                  <Calendar size={12} color={colors.info} />
                  <Text className="text-[11px] text-info">Rencana aksi berikutnya: {item.next}</Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </Panel>

      {/* Modal Catat Follow-up */}
      <Dialog open={fuOpen} onOpenChange={setFuOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Catat Tindak Lanjut (Follow-up)</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <View className="gap-1.5">
              <Text className="text-xs text-muted-foreground font-medium">Metode Komunikasi</Text>
              <View className="flex-row flex-wrap gap-1.5">
                {(["Telepon", "WhatsApp", "Meeting", "Email", "Survey"] as const).map((m) => (
                  <Button
                    key={m}
                    size="sm"
                    variant={fuMethod === m ? "default" : "outline"}
                    onPress={() => setFuMethod(m)}
                    className="h-8 px-2.5"
                  >
                    <Text className="text-xs">{m}</Text>
                  </Button>
                ))}
              </View>
            </View>

            <View className="gap-1.5">
              <Text className="text-xs text-muted-foreground font-medium">Catatan / Ringkasan Pembicaraan</Text>
              <Textarea
                value={fuNote}
                onChangeText={setFuNote}
                placeholder="Contoh: Diskusi kebutuhan 16 titik kamera di gudang utama, customer meminta estimasi diskon 5%..."
                numberOfLines={3}
              />
            </View>

            <View className="gap-1.5">
              <Text className="text-xs text-muted-foreground font-medium">Rencana Aksi Berikutnya (Next Action)</Text>
              <Input
                value={fuNextAction}
                onChangeText={setFuNextAction}
                placeholder="Contoh: Kirim revisi penawaran hari Jumat jam 14:00"
              />
            </View>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setFuOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleAddFollowup}>
              <Text>Simpan Follow-up</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Reassign Kepemilikan Sales */}
      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alihkan PIC Sales</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <Text className="text-xs text-muted-foreground">
              Pindahkan tanggung jawab lead ini ke sales lain. Semua riwayat follow-up dan penawaran akan tetap utuh.
            </Text>
            <View className="gap-1.5">
              <Text className="text-xs text-muted-foreground font-medium">Pilih Sales Baru</Text>
              <View className="gap-1">
                {salesUsers.map((u) => (
                  <Pressable
                    key={u.id}
                    onPress={() => setNewOwner(u.name)}
                    className={`border rounded-lg p-2.5 flex-row items-center justify-between ${
                      newOwner === u.name ? "bg-primary/10 border-primary" : "border-border"
                    }`}
                  >
                    <View>
                      <Text className="text-xs font-semibold">{u.name}</Text>
                      <Text className="text-[11px] text-muted-foreground">{u.role.toUpperCase()} · {u.email}</Text>
                    </View>
                    {newOwner === u.name ? <Check size={16} color={colors.primary} /> : null}
                  </Pressable>
                ))}
              </View>
            </View>

            <View className="gap-1.5">
              <Text className="text-xs text-muted-foreground font-medium">Alasan Pengalihan (Opsional)</Text>
              <Input
                value={reassignReason}
                onChangeText={setReassignReason}
                placeholder="Contoh: Cuti tahunan / pembagian wilayah"
              />
            </View>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setReassignOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleReassign}>
              <Text>Simpan Perubahan</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Ubah Alasan Lost */}
      <Dialog open={lostReasonOpen} onOpenChange={setLostReasonOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ubah Alasan Lost</DialogTitle>
          </DialogHeader>
          <View className="gap-2 py-2">
            {LOST_REASONS.map((r) => (
              <Pressable
                key={r}
                onPress={() => setSelectedLostReason(r)}
                className={`border rounded-lg p-2.5 flex-row items-center justify-between ${
                  selectedLostReason === r ? "bg-danger/10 border-danger" : "border-border"
                }`}
              >
                <Text className="text-xs flex-1 pr-2">{r}</Text>
                {selectedLostReason === r ? <Check size={16} color={colors.danger} /> : null}
              </Pressable>
            ))}
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setLostReasonOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSaveLostReason}>
              <Text>Simpan</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function QuotationExtras({ row }: { row: Row }) {
  const { patchRow, toast } = useApp();
  const versions = Array.from({ length: row.versi }, (_, i) => row.versi - i);
  const [editFinancials, setEditFinancials] = React.useState(false);
  const [inputTotal, setInputTotal] = React.useState(String(row.total || row.nilai || "0"));
  const [inputDisc, setInputDisc] = React.useState(String(row.disc || "0"));

  // Revisi state
  const [revisiOpen, setRevisiOpen] = React.useState(false);
  const [revisiTotal, setRevisiTotal] = React.useState(String(row.total || row.nilai || "0"));
  const [revisiDisc, setRevisiDisc] = React.useState(String(row.disc || "0"));
  const [revisiReason, setRevisiReason] = React.useState("");

  const nextVersionNum = (row.versi || 1) + 1;
  const revTotNum = Number(revisiTotal.replace(/\D/g, "")) || 0;
  const revDiscNum = Number(revisiDisc.replace(/\D/g, "")) || 0;
  const revPpn = Math.round(revTotNum * 0.11);
  const revAfterDisc = Math.max(0, revTotNum + revPpn - revDiscNum);

  function handleCreateRevision() {
    patchRow("quotations", row.id, {
      versi: nextVersionNum,
      total: revTotNum,
      nilai: revTotNum,
      disc: revDiscNum,
      ppn: revPpn,
      totalAfterDisc: revAfterDisc,
      status: "Revisi",
      fileName: `${row.nomor.replace(/\//g, "-")}-v${nextVersionNum}.pdf`,
      fileUploaded: true,
    });
    setInputTotal(String(revTotNum));
    setInputDisc(String(revDiscNum));
    setRevisiOpen(false);
    toast(`Versi ${nextVersionNum} penawaran berhasil dibuat & berstatus Revisi`);
  }

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
            <View className="bg-panel border-border/60 rounded-lg border p-2.5">
              <Text className="text-[11px] text-muted-foreground">Preview PPN 11%: {rupiah(revPpn)}</Text>
              <Text className="text-xs font-semibold text-primary">Preview Total Akhir v{nextVersionNum}: {rupiah(revAfterDisc)}</Text>
            </View>
            <FileUploader label="Upload File Revisi Baru (PDF / Excel)" kind="dokumen" />
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

function SurveyExtras({ row }: { row: Row }) {
  const { addRow, patchRow, toast } = useApp();
  const [techNoteOpen, setTechNoteOpen] = React.useState(false);
  const [techNotes, setTechNotes] = React.useState(
    row.catatanTeknis ||
      "Pengecekan teknis: Plafon gypsum 4m, jarak tarikan kabel dari ruang server ke titik terjauh ±45 meter. Stop kontak siap di 2 titik. Diperlukan tangga lipat 6 meter dan pipa conduit pelindung."
  );
  const [inputTechNotes, setInputTechNotes] = React.useState(techNotes);

  const [expenseOpen, setExpenseOpen] = React.useState(false);
  const [expNominal, setExpNominal] = React.useState("");
  const [expKategori, setExpKategori] = React.useState("Bensin");
  const [expKet, setExpKet] = React.useState("");

  const [reportOpen, setReportOpen] = React.useState(false);

  const photos = [
    "Kondisi Plafon & Jalur Kabel Utama",
    "Ruang Server & Panel Distribusi Listrik",
    "Titik Pasang Kamera Outdoor Area Parkir",
  ];

  function handleSaveTechNotes() {
    setTechNotes(inputTechNotes);
    patchRow("surveys", row.id, { catatanTeknis: inputTechNotes });
    setTechNoteOpen(false);
    toast("Catatan teknis lapangan berhasil disimpan");
  }

  function handleAddExpense() {
    const nom = Number(expNominal.replace(/\D/g, "")) || 0;
    if (nom <= 0) {
      toast("Nominal pengeluaran tidak valid", "danger");
      return;
    }
    addRow("expenses", {
      project: row.lead || row.customer || "Survey Lapangan",
      alasan: `Survey ${row.lead}: ${expKet.trim() || expKategori}`,
      nominal: nom,
      kategori: expKategori,
      pelapor: String(row.tim || "Teknisi").split("+")[0]?.trim() || "Teknisi",
      status: "Dilaporkan",
    });
    const curBiaya = Number(row.biaya) || 0;
    patchRow("surveys", row.id, { biaya: curBiaya + nom });
    setExpenseOpen(false);
    setExpNominal("");
    setExpKet("");
    toast(`Biaya survey ${rupiah(nom)} dicatat ke modul Pengeluaran`);
  }

  function handlePrintSurveyReport() {
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
        <Text className="text-sm leading-relaxed text-foreground">{techNotes}</Text>
      </Panel>

      <Panel
        title="Dokumentasi Foto Lapangan"
        subtitle="Bukti kondisi fisik lokasi survey untuk tim project & sales."
      >
        <View className="gap-3">
          <View className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {photos.map((p, idx) => (
              <View key={p} className="bg-panel border-border/80 rounded-xl border p-3 justify-between min-h-[90px]">
                <View className="flex-row items-center gap-1.5">
                  <CheckCircle2 size={14} color={colors.primary} />
                  <Text className="text-xs font-semibold text-foreground">Foto {idx + 1}</Text>
                </View>
                <Text className="text-[11px] text-muted-foreground mt-1">{p}</Text>
              </View>
            ))}
          </View>
          <FileUploader label="Upload Tambahan Foto Lapangan" kind="foto" />
        </View>
      </Panel>

      <Panel
        title="Biaya Operasional Survey"
        subtitle="Bensin, makan, tol, atau parkir teknisi selama survey lapangan."
        right={
          <Button size="sm" onPress={() => setExpenseOpen(true)} className="flex-row items-center gap-1">
            <Plus size={14} color={colors.background} />
            <Text className="text-xs">Catat Biaya</Text>
          </Button>
        }
      >
        <Line left="Total Biaya Terpakai" right={<Text className="font-bold text-primary">{rupiah(row.biaya || 0)}</Text>} />
        <Line left="Tim Pelaksana" right={<Text className="text-text-secondary">{row.tim || "-"}</Text>} />
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
            <Text className="text-xs">Preview & Cetak PDF</Text>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Catat Biaya Operasional Survey</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <View className="gap-1.5">
              <Text className="text-xs text-muted-foreground font-medium">Kategori Biaya</Text>
              <View className="flex-row flex-wrap gap-1.5">
                {(["Bensin", "Makan", "Parkir & tol", "Transport", "Perlengkapan"] as const).map((k) => (
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
            <View className="gap-1">
              <Text className="text-xs text-muted-foreground">Nominal (Rp)</Text>
              <Input
                value={expNominal}
                onChangeText={setExpNominal}
                placeholder="Contoh: 150000"
                keyboardType="numeric"
              />
            </View>
            <View className="gap-1">
              <Text className="text-xs text-muted-foreground">Keterangan / Alasan</Text>
              <Input
                value={expKet}
                onChangeText={setExpKet}
                placeholder="Contoh: Bensin motor survey ke Bekasi PP"
              />
            </View>
          </View>
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

            <View className="border-border border rounded-xl p-3 gap-2">
              <Text className="text-xs font-semibold text-foreground">Dokumentasi Terlampir</Text>
              <View className="gap-1">
                {photos.map((p, idx) => (
                  <Text key={p} className="text-xs text-muted-foreground">• Foto {idx + 1}: {p}</Text>
                ))}
              </View>
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
              <Text>Cetak / Simpan PDF</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReceivingExtras({ row }: { row: Row }) {
  const { addRow, patchRow, toast } = useApp();
  const [issueOpen, setIssueOpen] = React.useState(false);
  const [issueType, setIssueType] = React.useState<"Rusak Fisik" | "Cacat Fungsi" | "Salah Tipe" | "Kurang Kuantitas">("Rusak Fisik");
  const [issueItem, setIssueItem] = React.useState<string>(row.item ? (String(row.item).split(",")[0] ?? "") : "");
  const [issueQty, setIssueQty] = React.useState("1");
  const [issueNotes, setIssueNotes] = React.useState("");
  const [issueSolusi, setIssueSolusi] = React.useState("Retur Tukar Baru ke Supplier");

  const [issueList, setIssueList] = React.useState<
    {
      id: string;
      type: string;
      item: string;
      qty: number;
      notes: string;
      solusi: string;
      status: string;
    }[]
  >([
    ...(row.hasIssue
      ? [
          {
            id: "DR-01",
            type: "Rusak Fisik",
            item: (String(row.item).split(",")[0] ?? "Perangkat") as string,
            qty: 1,
            notes: "Casing penyok saat unboxing dari ekspedisi",
            solusi: "Retur Tukar Baru ke Supplier",
            status: "Diproses Supplier",
          },
        ]
      : []),
  ]);

  function handleSaveIssue() {
    if (!issueNotes.trim()) {
      toast("Keterangan masalah wajib diisi", "danger");
      return;
    }
    const qNum = Number(issueQty) || 1;
    const itemStr = issueItem.trim() || (String(row.item).split(",")[0] ?? "Perangkat");
    const newIssue: {
      id: string;
      type: string;
      item: string;
      qty: number;
      notes: string;
      solusi: string;
      status: string;
    } = {
      id: `DR-${Date.now()}`,
      type: issueType,
      item: itemStr,
      qty: qNum,
      notes: issueNotes.trim(),
      solusi: issueSolusi,
      status: "Menunggu Tindakan Supplier",
    };
    setIssueList([newIssue, ...issueList]);
    addRow("damage-reports", {
      produk: issueItem,
      jenis: issueType,
      po: row.po,
      pelapor: row.penerima || "Eko Saputra",
      status: "Dilaporkan",
      keterangan: `${issueNotes.trim()} (${issueSolusi})`,
    });
    patchRow("receiving", row.id, { hasIssue: true });
    setIssueOpen(false);
    setIssueNotes("");
    toast("Issue Report berhasil dicatat & diteruskan ke Procurement");
  }

  return (
    <>
      <Panel title="Rincian Penerimaan PO">
        <Line left="Barang Diterima" right={<Text className="font-semibold">{row.item}</Text>} />
        <Line left="Nomor PO Supplier" right={<Text className="text-text-secondary">{row.po}</Text>} />
        <Line left="Supplier" right={<Text className="text-text-secondary">{row.supplier}</Text>} />
        <Line left="Petugas Gudang" right={<Text className="text-text-secondary">{row.penerima}</Text>} />
        <Line left="Status Penerimaan" right={<StatusBadge status={row.status} />} />
      </Panel>

      <Panel
        title="Pelaporan Barang Bermasalah (Issue Report)"
        subtitle="Laporkan jika ada barang rusak, cacat fungsi, salah tipe barang, atau jumlah kurang dari PO."
        right={
          <Button size="sm" variant="outline" onPress={() => setIssueOpen(true)} className="flex-row items-center gap-1">
            <ShieldAlert size={14} color={colors.danger} />
            <Text className="text-xs text-danger font-medium">Lapor Masalah</Text>
          </Button>
        }
      >
        {issueList.length === 0 ? (
          <Text className="text-muted-foreground text-xs leading-relaxed py-1">
            Tidak ada laporan barang bermasalah untuk penerimaan ini. Semua unit dalam kondisi baik dan sesuai pesanan.
          </Text>
        ) : (
          <View className="gap-2.5">
            {issueList.map((issue) => (
              <View key={issue.id} className="bg-panel border-border/80 rounded-xl border p-3 gap-2">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <AlertTriangle size={15} color={colors.danger} />
                    <Text className="text-xs font-semibold text-danger">{issue.type}</Text>
                    <Text className="text-xs text-muted-foreground">({issue.qty} unit)</Text>
                  </View>
                  <StatusBadge status={issue.status} />
                </View>
                <Text className="text-xs font-medium text-foreground">{issue.item}</Text>
                <Text className="text-xs text-muted-foreground leading-relaxed">{issue.notes}</Text>
                <View className="bg-card border-border/50 rounded-md p-1.5 border">
                  <Text className="text-[11px] text-primary">Rekomendasi tindakan: {issue.solusi}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </Panel>

      {/* Modal Lapor Barang Bermasalah */}
      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Lapor Barang Bermasalah (Issue Report)</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <View className="gap-1.5">
              <Text className="text-xs text-muted-foreground font-medium">Jenis Masalah</Text>
              <View className="flex-row flex-wrap gap-1.5">
                {(["Rusak Fisik", "Cacat Fungsi", "Salah Tipe", "Kurang Kuantitas"] as const).map((t) => (
                  <Button
                    key={t}
                    size="sm"
                    variant={issueType === t ? "default" : "outline"}
                    onPress={() => setIssueType(t)}
                    className="h-8 px-2.5"
                  >
                    <Text className="text-xs">{t}</Text>
                  </Button>
                ))}
              </View>
            </View>

            <View className="gap-1">
              <Text className="text-xs text-muted-foreground">Nama Item / Produk</Text>
              <Input value={issueItem} onChangeText={setIssueItem} placeholder="Nama barang" />
            </View>

            <View className="gap-1">
              <Text className="text-xs text-muted-foreground">Kuantitas Bermasalah (Unit / Qty)</Text>
              <Input value={issueQty} onChangeText={setIssueQty} placeholder="1" keyboardType="numeric" />
            </View>

            <View className="gap-1">
              <Text className="text-xs text-muted-foreground">Keterangan Detail Masalah</Text>
              <Textarea
                value={issueNotes}
                onChangeText={setIssueNotes}
                placeholder="Jelaskan kondisi barang saat unboxing atau testing..."
                numberOfLines={3}
              />
            </View>

            <View className="gap-1">
              <Text className="text-xs text-muted-foreground">Tindakan yang Diminta (Rekomendasi)</Text>
              <Input
                value={issueSolusi}
                onChangeText={setIssueSolusi}
                placeholder="Contoh: Retur Tukar Baru / Potong Invoice"
              />
            </View>

            <FileUploader label="Upload Foto Bukti Kerusakan / Serial Number" kind="foto" />
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setIssueOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSaveIssue}>
              <Text>Kirim Laporan</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DeliveryNotesExtras({ row }: { row: Row }) {
  const { user, setStatus, patchRow, toast } = useApp();
  const [handoverOpen, setHandoverOpen] = React.useState(false);
  const [recipientName, setRecipientName] = React.useState(row.penerimaNama || "");
  const [recipientPhone, setRecipientPhone] = React.useState(row.penerimaKontak || "");
  const [recipientTitle, setRecipientTitle] = React.useState(row.penerimaJabatan || "PIC Lapangan / Security");
  const [handoverNotes, setHandoverNotes] = React.useState("");

  const isDelivered = row.status === "Diterima";

  function handleCompleteHandover() {
    if (!recipientName.trim()) {
      toast("Nama penerima lapangan wajib diisi", "danger");
      return;
    }
    patchRow("delivery-notes", row.id, {
      penerimaNama: recipientName.trim(),
      penerimaKontak: recipientPhone.trim(),
      penerimaJabatan: recipientTitle.trim(),
      catatanSerahTerima: handoverNotes.trim(),
      tanggalDiterima: new Date().toISOString().slice(0, 10),
      status: "Diterima",
    });
    setStatus("delivery-notes", row.id, "Diterima");
    setHandoverOpen(false);
    toast("Tanda terima lapangan berhasil dicatat. Status surat jalan kini 'Diterima'");
  }

  return (
    <>
      <Panel title="Barang yang Dibawa">
        {row.barang === "-" ? (
          <Text className="text-muted-foreground text-sm">Surat jalan ini untuk penugasan tanpa barang.</Text>
        ) : (
          <>
            <Line left={row.barang} sub="Barang ber-SN wajib di-scan sebelum berangkat" />
            {user!.role === "gudang" || user!.role === "bos" ? (
              <View className="mt-3"><ScanInput /></View>
            ) : null}
          </>
        )}
      </Panel>

      <Panel
        title="Laporan Hasil Kunjungan & Serah Terima Lapangan"
        subtitle="Dokumentasi penerimaan barang di lokasi klien beserta tanda tangan atau foto bukti."
        right={
          !isDelivered && (user!.role === "teknisi" || user!.role === "pm" || user!.role === "bos") ? (
            <Button size="sm" onPress={() => setHandoverOpen(true)} className="flex-row items-center gap-1">
              <CheckCircle2 size={14} color={colors.background} />
              <Text className="text-xs">Catat Tanda Terima</Text>
            </Button>
          ) : undefined
        }
      >
        {isDelivered ? (
          <View className="bg-success/10 border-success/30 rounded-xl border p-3.5 gap-2">
            <View className="flex-row items-center gap-2">
              <CheckCircle2 size={16} color={colors.success} />
              <Text className="text-xs font-semibold text-success">Barang Berhasil Diserahterimakan</Text>
            </View>
            <View className="gap-1 mt-1">
              <Text className="text-xs text-foreground font-medium">Penerima: {row.penerimaNama || "PIC Lapangan"}</Text>
              <Text className="text-[11px] text-muted-foreground">Jabatan / Kontak: {row.penerimaJabatan || "-"} ({row.penerimaKontak || "-"})</Text>
              <Text className="text-[11px] text-muted-foreground">Waktu Diterima: {tanggal(row.tanggalDiterima || row.tanggal)}</Text>
              {row.catatanSerahTerima ? (
                <Text className="text-xs text-foreground mt-1 bg-card p-2 rounded border border-border/50">
                  Catatan: {row.catatanSerahTerima}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          <View className="gap-2">
            <Text className="text-xs text-muted-foreground leading-relaxed">
              Surat jalan sedang dalam perjalanan menuju lokasi: <b>{row.tujuan}</b>.
              Setelah teknisi menyerahkan barang kepada pihak klien, catat tanda terima untuk menyelesaikan surat jalan.
            </Text>
          </View>
        )}
      </Panel>

      {/* Modal Catat Tanda Terima Lapangan */}
      <Dialog open={handoverOpen} onOpenChange={setHandoverOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Catat Tanda Terima Lapangan</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <View className="gap-1">
              <Text className="text-xs text-muted-foreground font-medium">Nama Penerima di Lokasi</Text>
              <Input
                value={recipientName}
                onChangeText={setRecipientName}
                placeholder="Contoh: Bpk. Bambang Hartono"
              />
            </View>
            <View className="gap-1">
              <Text className="text-xs text-muted-foreground font-medium">Jabatan / Peran</Text>
              <Input
                value={recipientTitle}
                onChangeText={setRecipientTitle}
                placeholder="Contoh: Building Manager / Kepala Cabang"
              />
            </View>
            <View className="gap-1">
              <Text className="text-xs text-muted-foreground font-medium">No. Telepon / WhatsApp</Text>
              <Input
                value={recipientPhone}
                onChangeText={setRecipientPhone}
                placeholder="Contoh: 0812-3456-7890"
              />
            </View>
            <View className="gap-1">
              <Text className="text-xs text-muted-foreground font-medium">Catatan Kondisi Barang Saat Tiba</Text>
              <Textarea
                value={handoverNotes}
                onChangeText={setHandoverNotes}
                placeholder="Contoh: Barang diterima lengkap, kardus segel utuh, dititipkan ke ruang IT..."
                numberOfLines={2}
              />
            </View>
            <FileUploader label="Upload Foto Bukti Serah Terima / TTD Surat Jalan" kind="foto" />
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setHandoverOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleCompleteHandover}>
              <Text>Tandai Diterima</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProjectExtras({ row }: { row: Row }) {
  const { toast } = useApp();
  const [reserveOpen, setReserveOpen] = React.useState(false);
  const [selectedProduct, setSelectedProduct] = React.useState(PRODUCTS[0]?.nama || "Access Controller 4 Pintu");
  const [reserveQty, setReserveQty] = React.useState("2");
  const [bastOpen, setBastOpen] = React.useState(false);

  const [materials, setMaterials] = React.useState<{ id: string; produk: string; qty: number; status: string }[]>([
    { id: "mat-1", produk: "Access Controller 4 Pintu", qty: 2, status: "Tersedia & Di-reserve" },
    { id: "mat-2", produk: "Reader Fingerprint", qty: 4, status: "Tersedia & Di-reserve" },
    { id: "mat-3", produk: "Kabel LAN UTP Cat6 (per meter)", qty: 300, status: "Tersedia di Gudang Jakarta" },
  ]);

  function handleAddReservation() {
    const q = Number(reserveQty) || 1;
    setMaterials([...materials, { id: `mat-${Date.now()}`, produk: selectedProduct, qty: q, status: "Tersedia & Di-reserve" }]);
    setReserveOpen(false);
    toast(`Reservasi ${q} unit ${selectedProduct} berhasil dicatat`);
  }

  function handlePrintBast() {
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  return (
    <>
      <Panel
        title="Kebutuhan & Reservasi Material Gudang"
        subtitle="Alokasi stok gudang untuk kebutuhan project agar tidak terpakai oleh pekerjaan lain."
        right={
          <Button size="sm" variant="outline" onPress={() => setReserveOpen(true)} className="flex-row items-center gap-1">
            <Plus size={14} color={colors.text} />
            <Text className="text-xs">Alokasikan Material</Text>
          </Button>
        }
      >
        <View className="gap-2">
          {materials.map((m) => (
            <Line
              key={m.id}
              left={m.produk}
              sub={`Status: ${m.status}`}
              right={<Text className="font-semibold text-sm">{m.qty} unit</Text>}
            />
          ))}
        </View>
      </Panel>

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
        <Line left="Status Pembayaran Termin" right={<Text className="font-medium text-text-secondary">{row.pembayaran || "Belum lunas"}</Text>} />
        <Text className="text-xs text-muted-foreground mt-2 leading-relaxed">
          Setelah seluruh item pekerjaan diuji coba dan disetujui klien, cetak draf BAST resmi untuk ditandatangani kedua belah pihak.
        </Text>
      </Panel>

      {/* Modal Alokasi Material */}
      <Dialog open={reserveOpen} onOpenChange={setReserveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alokasi / Reserve Material Gudang</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <View className="gap-1">
              <Text className="text-xs text-muted-foreground font-medium">Pilih Perangkat / Material</Text>
              <ScrollView style={{ maxHeight: 180 }} className="border border-border rounded-lg p-1">
                {PRODUCTS.slice(0, 10).map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => setSelectedProduct(p.nama)}
                    className={`p-2 rounded flex-row items-center justify-between ${
                      selectedProduct === p.nama ? "bg-primary/10" : ""
                    }`}
                  >
                    <Text className="text-xs font-medium">{p.nama}</Text>
                    {selectedProduct === p.nama ? <Check size={14} color={colors.primary} /> : null}
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View className="gap-1">
              <Text className="text-xs text-muted-foreground font-medium">Jumlah yang Dibutuhkan</Text>
              <Input value={reserveQty} onChangeText={setReserveQty} placeholder="2" keyboardType="numeric" />
            </View>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setReserveOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleAddReservation}>
              <Text>Simpan Reservasi</Text>
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
              <Text className="text-xs font-semibold">Rincian Material Terpasang:</Text>
              {materials.map((m, idx) => (
                <Text key={m.id} className="text-xs text-muted-foreground">{idx + 1}. {m.produk} — {m.qty} unit</Text>
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

export function ModuleExtras({ moduleKey, row }: { moduleKey: string; row: Row }) {
  const { user, patchRow, setStatus, toast, data } = useApp();

  if (moduleKey === "leads") {
    return <LeadExtras row={row} />;
  }

  if (moduleKey === "quotations") {
    return <QuotationExtras row={row} />;
  }

  if (moduleKey === "surveys") {
    return <SurveyExtras row={row} />;
  }

  if (moduleKey === "projects") {
    return <ProjectExtras row={row} />;
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
    return <DeliveryNotesExtras row={row} />;
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
    return <ReceivingExtras row={row} />;
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
