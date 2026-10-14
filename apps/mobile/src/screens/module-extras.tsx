import * as React from "react";
import { View, ScrollView, Pressable, Linking } from "react-native";
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
  FileSpreadsheet,
  TrendingUp,
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Panel, Cell, FormField } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { ScanInput } from "@/components/taska/scan-input";
import { SearchableSelect, DatePicker } from "@/components/taska/dialogs";
import { FileUploader } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import {
  api,
  apiBase,
  getAccess,
  queryString,
  uploadFile,
  uploadQuotationExcel,
  downloadDocumentationPdf,
} from "@/services/api";
import { colors } from "@/tokens";
import { rupiah, tanggal } from "@/lib/format";
import { type Row } from "@/constants/modules";

const PRICE_ROLES = ["super_admin", "procurement", "finance", "pm", "bos"];

type DocPhotoItem = {
  id: number;
  fileId: number;
  caption?: string | null;
  url: string;
  originalName: string;
};

function DocumentationPhotosPanel({
  kind,
  entityId,
  title,
  subtitle,
}: {
  kind: "survey" | "project" | "delivery-note";
  entityId: string | number;
  title: string;
  subtitle: string;
}) {
  const { toast } = useApp();
  const [photos, setPhotos] = React.useState<DocPhotoItem[]>([]);
  const [caption, setCaption] = React.useState("");
  const [pdfBusy, setPdfBusy] = React.useState(false);

  const loadPhotos = React.useCallback(async () => {
    try {
      const res = await api<{ items: DocPhotoItem[] }>(
        "GET",
        `/documentation/photos?kind=${kind}&entityId=${entityId}`,
      );
      if (Array.isArray(res?.items)) {
        setPhotos(res.items);
      }
    } catch {}
  }, [kind, entityId]);

  React.useEffect(() => {
    let active = true;
    api<{ items: DocPhotoItem[] }>(
      "GET",
      `/documentation/photos?kind=${kind}&entityId=${entityId}`,
    )
      .then((res) => {
        if (active && Array.isArray(res?.items)) {
          setPhotos(res.items);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [kind, entityId]);

  async function handleAttachPhoto(file: { name: string; blob?: Blob; uri?: string }) {
    try {
      const payload =
        file.blob ?? (file.uri ? { uri: file.uri, name: file.name, type: "image/jpeg" } : null);
      const category = kind === "delivery-note" ? "surat-jalan" : kind === "survey" ? "survey" : "dokumentasi-proyek";
      const fileId = await uploadFile(payload, "foto", category);
      if (!fileId) {
        toast("Gagal mengunggah foto ke server", "danger");
        return;
      }
      await api("POST", `/documentation/photos?kind=${kind}`, {
        entityId: Number(entityId),
        fileId,
        caption: caption.trim() || file.name,
      });
      setCaption("");
      await loadPhotos();
      toast("Foto dokumentasi berhasil dilampirkan");
    } catch (e: any) {
      toast(e?.message || "Gagal melampirkan foto dokumentasi", "danger");
    }
  }

  async function handleRemovePhoto(id: number) {
    try {
      await api("DELETE", `/documentation/photos/${id}`);
      await loadPhotos();
      toast("Foto dokumentasi dihapus");
    } catch (e: any) {
      toast(e?.message || "Gagal menghapus foto", "danger");
    }
  }

  async function handleDownloadPdf() {
    setPdfBusy(true);
    try {
      const ok = await downloadDocumentationPdf(kind, entityId);
      if (ok) {
        toast("PDF kompilasi dokumentasi berhasil diunduh");
      } else {
        toast("Gagal mengunduh PDF kompilasi", "danger");
      }
    } catch (e: any) {
      toast(e?.message || "Gagal mengunduh PDF kompilasi", "danger");
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <Panel
      title={title}
      subtitle={subtitle}
      right={
        <Button
          size="sm"
          variant="outline"
          onPress={handleDownloadPdf}
          disabled={pdfBusy}
          className="flex-row items-center gap-1.5"
        >
          <FileDown size={14} color={colors.text} />
          <Text className="text-xs">{pdfBusy ? "Membuat PDF..." : "Unduh PDF Kompilasi"}</Text>
        </Button>
      }
    >
      <View className="gap-3">
        {photos.length === 0 ? (
          <Text className="text-xs text-muted-foreground py-1">
            Belum ada foto dokumentasi terlampir pada dokumen ini.
          </Text>
        ) : (
          <View className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {photos.map((p, idx) => (
              <View
                key={p.id}
                className="bg-panel border-border/80 rounded-xl border p-3 justify-between min-h-[90px]"
              >
                <View className="flex-row items-center justify-between gap-1.5">
                  <View className="flex-row items-center gap-1.5 flex-1">
                    <CheckCircle2 size={14} color={colors.primary} />
                    <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
                      Foto {idx + 1}
                    </Text>
                  </View>
                  <Pressable onPress={() => handleRemovePhoto(p.id)} hitSlop={8}>
                    <Trash2 size={13} color={colors.danger} />
                  </Pressable>
                </View>
                <Text className="text-[11px] text-foreground font-medium mt-1" numberOfLines={2}>
                  {p.caption || p.originalName}
                </Text>
                <Text className="text-[10px] text-muted-foreground mt-0.5" numberOfLines={1}>
                  {p.originalName}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View className="gap-2 pt-1">
          <Input
            value={caption}
            onChangeText={setCaption}
            placeholder="Keterangan foto (opsional, misal: Kondisi Plafon / Ruang Server)"
          />
          <FileUploader
            label="Upload Foto Dokumentasi Lapangan (PNG / JPG)"
            kind="foto"
            onFilePicked={handleAttachPhoto}
          />
        </View>
      </View>
    </Panel>
  );
}

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

export function downloadQuotationTemplate(info?: {
  quotationId?: string | number;
  leadId?: string | number;
  customer?: string;
  lead?: string;
  nomor?: string;
  signer?: string;
}) {
  const url = info?.quotationId
    ? `${apiBase()}/quotations/${info.quotationId}/excel?t=${Date.now()}`
    : `${apiBase()}/quotations/template-excel${queryString({
        leadId: info?.leadId,
        customer: info?.customer,
        lead: info?.lead,
        nomor: info?.nomor,
        signer: info?.signer,
      })}`;

  if (typeof window !== "undefined") {
    window.open(url, "_blank");
  } else {
    Linking.openURL(url).catch(() => {});
  }
}

export function downloadQuotationPdf(info?: {
  quotationId?: string | number;
  leadId?: string | number;
  customer?: string;
  lead?: string;
  nomor?: string;
  signer?: string;
}) {
  const url = info?.quotationId
    ? `${apiBase()}/quotations/${info.quotationId}/pdf?t=${Date.now()}`
    : `${apiBase()}/quotations/template-pdf${queryString({
        leadId: info?.leadId,
        customer: info?.customer,
        lead: info?.lead,
        nomor: info?.nomor,
        signer: info?.signer,
      })}`;

  if (typeof window !== "undefined") {
    window.open(url, "_blank");
  } else {
    Linking.openURL(url).catch(() => {});
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
  subject,
  intro,
  notesList,
  city,
  kopText,
  customerAddress,
  signerName,
  signerTitle,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row: Row;
  items: QuotationItem[];
  calcPpn: number;
  discNum: number;
  itemsTotal: number;
  subject?: string;
  intro?: string;
  notesList?: string[];
  city?: string;
  kopText?: string;
  customerAddress?: string;
  signerName?: string;
  signerTitle?: string;
  onSave?: () => void;
}) {
  const activeNotes =
    notesList && notesList.length > 0
      ? notesList
      : [
          "Penawaran ini berlaku 1 bulan",
          "Penambahan material/jasa dikenakan harga sesuai nilai jual material/jasa tersebut",
          "Garansi perangkat 1 Tahun Harddisk dan PSU 6 Bulan Instalasi 3 Bulan",
        ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl md:max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Preview File Penawaran (Format Resmi Excel & PDF)</DialogTitle>
        </DialogHeader>
        <ScrollView style={{ maxHeight: 580 }} contentContainerClassName="gap-3 p-4 bg-white rounded-xl text-black border border-zinc-300">
          {/* KOP SURAT Box */}
          <View className="border border-black py-3 px-3 items-center justify-center bg-white min-h-[50px]">
            <Text className="text-sm font-bold text-black tracking-wide uppercase text-center leading-snug">
              {kopText || row.kopText || "KOP SURAT"}
            </Text>
          </View>

          {/* Tanggal Kanan */}
          <View className="items-end pt-1">
            <Text className="text-xs text-black font-bold">
              {city || row.city || "Bekasi"}, {tanggal(row.dibuat || new Date().toISOString())}
            </Text>
          </View>

          {/* Tujuan */}
          <View className="gap-0.5">
            <Text className="text-xs text-black font-bold">Kepada Yth.</Text>
            <Text className="text-xs text-black font-bold">{row.customer || row.perusahaan || "Nama Customer"}</Text>
            <Text className="text-xs text-black font-bold">{customerAddress || row.customerAddress || "Di Tempat"}</Text>
          </View>

          {/* Subject & Quote No */}
          <View className="gap-0.5 pt-1">
            <Text className="text-xs text-black font-bold">
              Subject : {subject || row.subject || `Penawaran Pengadaan Barang & Jasa Instalasi (${row.lead || row.nama || "-"})`}
            </Text>
            <Text className="text-xs text-black font-bold">Quote No. : {row.nomor || "-"}</Text>
          </View>

          <Text className="text-xs text-black leading-relaxed pt-1">
            Dengan hormat,{"\n"}
            {intro || row.intro || "Sesuai permintaan Bapak / Ibu sebelumnya, berikut penawaran dari kami terkait pengadaan Barang & Jasa Instalasi :"}
          </Text>

          {/* Tabel Item Excel Warna Cyan #00FFFF */}
          <View className="border border-black overflow-hidden">
            <View className="flex-row bg-[#00ffff] border-b border-black py-2 px-2">
              <Text className="w-8 text-[11px] font-bold text-black text-center">No.</Text>
              <Text className="flex-1 text-[11px] font-bold text-black text-center">Item / Jasa</Text>
              <Text className="w-12 text-[11px] font-bold text-black text-center">QTY</Text>
              <Text className="w-16 text-[11px] font-bold text-black text-center">Satuan</Text>
              <Text className="w-24 text-[11px] font-bold text-black text-center">Harga</Text>
              <Text className="w-24 text-[11px] font-bold text-black text-center">Total</Text>
            </View>

            {(items.length > 0
              ? items
              : [{ id: "1", item: row.lead || "Pengadaan Barang & Jasa Instalasi", qty: 1, satuan: "Lot", harga: itemsTotal }]
            ).map((it, idx) => (
              <View key={it.id || idx} className="flex-row border-b border-black py-1.5 px-2 bg-white">
                <Text className="w-8 text-[11px] text-black text-center">{idx + 1}</Text>
                <Text className="flex-1 text-[11px] text-black">{it.item}</Text>
                <Text className="w-12 text-[11px] text-black text-center">{it.qty}</Text>
                <Text className="w-16 text-[11px] text-black text-center">{it.satuan}</Text>
                <Text className="w-24 text-[11px] text-black text-right">{rupiah(it.harga)}</Text>
                <Text className="w-24 text-[11px] text-black text-right">{rupiah(it.qty * it.harga)}</Text>
              </View>
            ))}

            {/* Total rows */}
            <View className="flex-row border-b border-black bg-white py-1.5 px-2">
              <Text className="flex-1 text-[11px] font-bold text-black text-center">TOTAL</Text>
              <Text className="w-24 text-[11px] font-bold text-black text-right">{rupiah(itemsTotal)}</Text>
            </View>
            <View className="flex-row border-b border-black bg-white py-1.5 px-2">
              <Text className="flex-1 text-[11px] font-bold text-black text-center">PPN (11%)</Text>
              <Text className="w-24 text-[11px] font-bold text-black text-right">{rupiah(calcPpn)}</Text>
            </View>
            {discNum > 0 ? (
              <View className="flex-row border-b border-black bg-white py-1.5 px-2">
                <Text className="flex-1 text-[11px] font-bold text-black text-center">DISC</Text>
                <Text className="w-24 text-[11px] font-bold text-black text-right">{rupiah(discNum)}</Text>
              </View>
            ) : null}
            <View className="flex-row bg-white py-2 px-2">
              <Text className="flex-1 text-xs font-bold text-black text-center">GRAND TOTAL</Text>
              <Text className="w-24 text-xs font-bold text-black text-right">
                {rupiah(Math.max(0, itemsTotal + calcPpn - discNum))}
              </Text>
            </View>
          </View>

          {/* Notes */}
          <View className="gap-0.5 pt-1">
            <Text className="text-xs font-bold text-black">Notes:</Text>
            {activeNotes.map((n, idx) => (
              <Text key={idx} className="text-[11px] text-black">
                {idx + 1}. {n.replace(/^\d+\.\s*/, "")}
              </Text>
            ))}
          </View>

          {/* Contact Block */}
          <View className="gap-0.5 pt-2">
            <Text className="text-[11px] text-black">Untuk pertanyaan lebih lanjut bisa hubungi kami melalui :</Text>
            <Text className="text-[11px] text-black">Telp    : 021 2284 3608</Text>
            <Text className="text-[11px] text-black">WA      : 0859 5959 8852 / 0821 2345 9144</Text>
            <Text className="text-[11px] text-black">Email  : cs@ghinamultiprima.co.id</Text>
            <Text className="text-[11px] font-bold text-blue-700 underline">www.ghinamultiprima.co.id</Text>
          </View>

          {/* Penutup & TTD */}
          <View className="gap-3 pt-2">
            <Text className="text-[11px] text-black leading-relaxed">
              Sekian surat penawaran ini kami buat dengan harapan agar Bapak/Ibu bisa bekerjasama dengan perusahaan kami. Kami tunggu tanggapan dan kabar baik.
            </Text>

            <View className="items-start gap-0.5 pt-2">
              <Text className="text-[11px] text-black">TTD,</Text>
              <View className="h-8" />
              <Text className="text-xs font-bold text-black underline">
                {signerName || row.signerName || row.pemilik || "Nama Sales"}
              </Text>
              {(signerTitle || row.signerTitle) ? (
                <Text className="text-[11px] text-black font-medium">
                  {signerTitle || row.signerTitle}
                </Text>
              ) : null}
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
                downloadQuotationPdf({
                  quotationId: row.id,
                  customer: row.customer || row.perusahaan,
                  lead: row.lead || row.nama,
                  nomor: row.nomor,
                  signer: row.pemilik,
                });
              }}
            >
              <FileDown size={15} color={colors.text} />
              <Text>Download PDF Resmi</Text>
            </Button>
            <Button
              onPress={() => {
                if (onSave) {
                  onSave();
                } else {
                  downloadQuotationTemplate({
                    quotationId: row.id,
                    customer: row.customer || row.perusahaan,
                    lead: row.lead || row.nama,
                    nomor: row.nomor,
                    signer: row.pemilik,
                  });
                }
              }}
            >
              <FileDown size={15} color={colors.background} />
              <Text>Simpan & Download Excel (.xlsx)</Text>
            </Button>
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
  onUpdateItems: (
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
  ) => Promise<void> | void;
}) {
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [editItemsOpen, setEditItemsOpen] = React.useState(false);

  const [items, setItems] = React.useState<QuotationItem[]>(row.items && row.items.length ? row.items : []);
  const [kopText, setKopText] = React.useState<string>(row.kopText || "");
  const [city, setCity] = React.useState<string>(row.city || "Bekasi");
  const [customerAddress, setCustomerAddress] = React.useState<string>(row.customerAddress || "");
  const [subject, setSubject] = React.useState<string>(
    row.subject || `Penawaran Pengadaan Barang & Jasa Instalasi (${row.lead || "-"})`,
  );
  const [intro, setIntro] = React.useState<string>(
    row.intro || "Sesuai permintaan Bapak / Ibu sebelumnya, berikut penawaran dari kami terkait pengadaan Barang & Jasa Instalasi :",
  );
  const [signerName, setSignerName] = React.useState<string>(row.signerName || row.pemilik || "");
  const [signerTitle, setSignerTitle] = React.useState<string>(row.signerTitle || "Sales Engineer");
  const [notesText, setNotesText] = React.useState<string>(
    Array.isArray(row.notesList) && row.notesList.length > 0
      ? row.notesList.join("\n")
      : [
          "Penawaran ini berlaku 1 bulan",
          "Penambahan material/jasa dikenakan harga sesuai nilai jual material/jasa tersebut",
          "Garansi perangkat 1 Tahun Harddisk dan PSU 6 Bulan Instalasi 3 Bulan",
        ].join("\n"),
  );

  // New item inputs
  const [newItemName, setNewItemName] = React.useState("");
  const [newItemQty, setNewItemQty] = React.useState("1");
  const [newItemSatuan, setNewItemSatuan] = React.useState("Unit");
  const [newItemHarga, setNewItemHarga] = React.useState("");

  const itemsTotal = items.length > 0 ? items.reduce((acc, curr) => acc + curr.qty * curr.harga, 0) : totNum;
  const activePpn = Math.round(itemsTotal * 0.11);
  const parsedNotes = notesText
    .split("\n")
    .map((s) => s.trim().replace(/^\d+\.\s*/, ""))
    .filter(Boolean);

  function addItem() {
    if (!newItemName.trim()) return;
    const q = Number(newItemQty) || 1;
    const h = Number(newItemHarga.replace(/\D/g, "")) || 0;
    const updated = [
      ...items,
      { id: String(Date.now()), item: newItemName.trim(), qty: q, satuan: newItemSatuan.trim() || "Unit", harga: h },
    ];
    setItems(updated);
    setNewItemName("");
    setNewItemQty("1");
    setNewItemHarga("");
  }

  function updateItemField(id: string, patch: Partial<QuotationItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function removeItem(id: string) {
    setItems(items.filter((it) => it.id !== id));
  }

  async function handleSaveItems(shouldDownload = false) {
    const total = items.reduce((acc, curr) => acc + curr.qty * curr.harga, 0);
    await onUpdateItems(
      items,
      total,
      {
        subject,
        intro,
        notesList: parsedNotes,
        city,
        kopText,
        customerAddress,
        signerName,
        signerTitle,
      },
      shouldDownload,
    );
    setEditItemsOpen(false);
  }

  return (
    <>
      <Panel
        title="Rincian Item & Generator Template Penawaran (.xlsx / .pdf)"
        subtitle="Sales dapat mengubah seluruh isi template penawaran (kop surat, tujuan, kota, notes, item, dan penandatangan). File Excel & PDF akan otomatis tersinkronisasi."
      >
        <View className="gap-3">
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <View>
              <Text className="text-xs text-muted-foreground">Jumlah Item / Jasa Terdaftar</Text>
              <Text className="text-sm font-semibold">
                {items.length} Baris Item · Total Item: {rupiah(itemsTotal)}
              </Text>
            </View>
            <View className="flex-row flex-wrap gap-2">
              <Button variant="outline" size="sm" onPress={() => setEditItemsOpen(true)}>
                <Edit3 size={14} color={colors.text} />
                <Text className="text-xs">Edit Template & Item</Text>
              </Button>
              <Button variant="outline" size="sm" onPress={() => setPreviewOpen(true)}>
                <Eye size={14} color={colors.text} />
                <Text className="text-xs">Preview Surat</Text>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onPress={() => {
                  downloadQuotationPdf({
                    quotationId: row.id,
                    customer: row.customer,
                    lead: row.lead,
                    nomor: row.nomor,
                    signer: signerName || row.pemilik,
                  });
                }}
              >
                <FileDown size={14} color={colors.text} />
                <Text className="text-xs">Download PDF</Text>
              </Button>
              <Button
                size="sm"
                onPress={() => {
                  downloadQuotationTemplate({
                    quotationId: row.id,
                    customer: row.customer,
                    lead: row.lead,
                    nomor: row.nomor,
                    signer: signerName || row.pemilik,
                  });
                }}
              >
                <FileDown size={14} color={colors.background} />
                <Text className="text-xs">Download Excel (.xlsx)</Text>
              </Button>
            </View>
          </View>

          {/* Tabel ringkas item yang ada sekarang */}
          {items.length > 0 ? (
            <View className="border-border/80 rounded-xl border overflow-hidden mt-1">
              <View className="bg-panel border-border/80 flex-row border-b py-2 px-3">
                <Text className="w-8 text-[11px] font-bold">No</Text>
                <Text className="flex-1 text-[11px] font-bold">Item / Jasa</Text>
                <Text className="w-16 text-[11px] font-bold text-center">QTY</Text>
                <Text className="w-24 text-[11px] font-bold text-right">Harga</Text>
                <Text className="w-28 text-[11px] font-bold text-right">Total</Text>
              </View>
              {items.map((it, idx) => (
                <View key={it.id || idx} className="border-border/50 flex-row items-center border-b py-2 px-3">
                  <Text className="w-8 text-xs text-muted-foreground">{idx + 1}</Text>
                  <Text className="flex-1 text-xs font-medium">{it.item}</Text>
                  <Text className="w-16 text-xs text-center">
                    {it.qty} {it.satuan}
                  </Text>
                  <Text className="w-24 text-xs text-right">{rupiah(it.harga)}</Text>
                  <Text className="w-28 text-xs font-semibold text-primary text-right">{rupiah(it.qty * it.harga)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View className="bg-panel/60 border-border/60 rounded-xl border p-3">
              <Text className="text-xs text-muted-foreground">
                Belum ada rincian item per baris. Klik <b>Edit Template & Item</b> untuk mengubah kop surat, tujuan, item, dan ketentuan penawaran di aplikasi.
              </Text>
            </View>
          )}
        </View>
      </Panel>

      {/* Modal Kelola Template & Item Penawaran */}
      <Dialog open={editItemsOpen} onOpenChange={setEditItemsOpen}>
        <DialogContent className="sm:max-w-xl md:max-w-3xl max-h-[92vh]">
          <DialogHeader>
            <DialogTitle>Ubah Seluruh Template & Isi Penawaran</DialogTitle>
          </DialogHeader>
          <ScrollView style={{ maxHeight: 540 }} contentContainerClassName="gap-4 pr-1">
            {/* 1. KOP SURAT & LOKASI */}
            <View className="bg-panel/70 border-border/70 rounded-xl border p-3.5 gap-3">
              <Text className="text-xs font-bold text-primary uppercase tracking-wide">1. Kop Surat & Lokasi</Text>
              <View className="gap-1.5">
                <Text className="text-xs font-semibold">Teks Kop Surat (Perusahaan / Alamat / Header)</Text>
                <Textarea
                  value={kopText}
                  onChangeText={setKopText}
                  placeholder="Contoh: PT GHINA MULTI PRIMA | CCTV & IT Solutions | Telp: 021-22843608 (Kosongkan jika memakai header default)"
                />
              </View>
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Text className="text-xs font-semibold">Kota Dokumen</Text>
                  <Input value={city} onChangeText={setCity} placeholder="Bekasi" />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-semibold">Tujuan / Alamat Customer</Text>
                  <Input
                    value={customerAddress}
                    onChangeText={setCustomerAddress}
                    placeholder="Di Tempat (atau alamat customer)"
                  />
                </View>
              </View>
            </View>

            {/* 2. SUBJECT & PEMBUKA */}
            <View className="bg-panel/70 border-border/70 rounded-xl border p-3.5 gap-3">
              <Text className="text-xs font-bold text-primary uppercase tracking-wide">2. Perihal & Kalimat Pembuka</Text>
              <View className="gap-1.5">
                <Text className="text-xs font-semibold">Subject / Perihal Surat</Text>
                <Input
                  value={subject}
                  onChangeText={setSubject}
                  placeholder="Penawaran Pengadaan Barang & Jasa Instalasi"
                />
              </View>
              <View className="gap-1.5">
                <Text className="text-xs font-semibold">Kalimat Pembuka (Intro)</Text>
                <Textarea
                  value={intro}
                  onChangeText={setIntro}
                  placeholder="Sesuai permintaan Bapak / Ibu sebelumnya, berikut penawaran dari kami terkait pengadaan Barang & Jasa Instalasi :"
                />
              </View>
            </View>

            {/* 3. ITEM & JASA */}
            <View className="bg-panel/70 border-border/70 rounded-xl border p-3.5 gap-3">
              <Text className="text-xs font-bold text-primary uppercase tracking-wide">3. Rincian Item / Jasa</Text>
              <View className="bg-card border-border/80 rounded-xl border p-3 gap-2">
                <Text className="text-xs font-semibold">Tambah Baris Item / Jasa Baru</Text>
                <View className="flex-row flex-wrap gap-2">
                  <View className="flex-1 min-w-[180px]">
                    <Input
                      value={newItemName}
                      onChangeText={setNewItemName}
                      placeholder="Nama item / jasa (misal: HDD 1TB Surveillance)"
                    />
                  </View>
                  <View className="w-16">
                    <Input value={newItemQty} onChangeText={setNewItemQty} keyboardType="numeric" placeholder="Qty" />
                  </View>
                  <View className="w-20">
                    <Input value={newItemSatuan} onChangeText={setNewItemSatuan} placeholder="Unit/Lot" />
                  </View>
                  <View className="flex-1 min-w-[140px]">
                    <Input
                      value={newItemHarga}
                      onChangeText={setNewItemHarga}
                      keyboardType="numeric"
                      placeholder="Harga Satuan (Rp)"
                    />
                  </View>
                  <Button size="sm" onPress={addItem} className="self-end">
                    <Plus size={15} color={colors.background} />
                    <Text className="text-xs">Tambah</Text>
                  </Button>
                </View>
              </View>

              <View className="gap-2">
                <Text className="text-xs font-semibold">Daftar Item ({items.length} Baris)</Text>
                {items.map((it, idx) => (
                  <View
                    key={it.id || idx}
                    className="bg-card border-border/60 flex-row flex-wrap items-center gap-2 rounded-lg border p-2.5"
                  >
                    <Text className="w-5 text-xs font-semibold">{idx + 1}.</Text>
                    <View className="flex-1 min-w-[150px]">
                      <Input
                        value={it.item}
                        onChangeText={(v) => updateItemField(it.id, { item: v })}
                        placeholder="Nama Item"
                      />
                    </View>
                    <View className="w-16">
                      <Input
                        value={String(it.qty)}
                        onChangeText={(v) => updateItemField(it.id, { qty: Number(v.replace(/\D/g, "")) || 0 })}
                        keyboardType="numeric"
                        placeholder="Qty"
                      />
                    </View>
                    <View className="w-20">
                      <Input
                        value={it.satuan}
                        onChangeText={(v) => updateItemField(it.id, { satuan: v })}
                        placeholder="Satuan"
                      />
                    </View>
                    <View className="w-28">
                      <Input
                        value={String(it.harga)}
                        onChangeText={(v) => updateItemField(it.id, { harga: Number(v.replace(/\D/g, "")) || 0 })}
                        keyboardType="numeric"
                        placeholder="Harga"
                      />
                    </View>
                    <Text className="w-24 text-xs font-semibold text-primary text-right">
                      {rupiah(it.qty * it.harga)}
                    </Text>
                    <Button variant="ghost" size="sm" onPress={() => removeItem(it.id)}>
                      <Trash2 size={14} color={colors.danger} />
                    </Button>
                  </View>
                ))}
              </View>
            </View>

            {/* 4. NOTES & SYARAT KETENTUAN */}
            <View className="bg-panel/70 border-border/70 rounded-xl border p-3.5 gap-2">
              <Text className="text-xs font-bold text-primary uppercase tracking-wide">4. Notes / Syarat & Ketentuan</Text>
              <Text className="text-[11px] text-muted-foreground">Tuliskan tiap poin per baris baru (1 baris = 1 poin nomor otomatis di surat penawaran).</Text>
              <Textarea
                value={notesText}
                onChangeText={setNotesText}
                placeholder="Penawaran ini berlaku 1 bulan&#10;Penambahan material/jasa dikenakan harga sesuai nilai jual...&#10;Garansi perangkat 1 Tahun..."
              />
            </View>

            {/* 5. TTD & PENANDATANGAN */}
            <View className="bg-panel/70 border-border/70 rounded-xl border p-3.5 gap-2.5">
              <Text className="text-xs font-bold text-primary uppercase tracking-wide">5. Penandatangan (TTD)</Text>
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Text className="text-xs font-semibold">Nama Penandatangan (Sales / PIC)</Text>
                  <Input
                    value={signerName}
                    onChangeText={setSignerName}
                    placeholder="Nama Sales"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-semibold">Jabatan / Gelar</Text>
                  <Input
                    value={signerTitle}
                    onChangeText={setSignerTitle}
                    placeholder="Sales Engineer / Account Manager"
                  />
                </View>
              </View>
            </View>

            {/* KALKULASI */}
            <View className="bg-panel border-border/50 gap-1 rounded-lg border p-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-muted-foreground">SUBTOTAL ITEM:</Text>
                <Text className="text-xs font-semibold">{rupiah(itemsTotal)}</Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-muted-foreground">PPN (11%):</Text>
                <Text className="text-xs font-semibold">{rupiah(activePpn)}</Text>
              </View>
              {discNum > 0 ? (
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs text-muted-foreground">DISC:</Text>
                  <Text className="text-xs font-semibold text-danger">- {rupiah(discNum)}</Text>
                </View>
              ) : null}
              <View className="flex-row items-center justify-between pt-1 border-t border-border/50">
                <Text className="text-xs font-bold">GRAND TOTAL:</Text>
                <Text className="text-sm font-bold text-primary">
                  {rupiah(Math.max(0, itemsTotal + activePpn - discNum))}
                </Text>
              </View>
            </View>
          </ScrollView>
          <DialogFooter className="flex-row flex-wrap gap-2">
            <Button variant="outline" onPress={() => setEditItemsOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button variant="outline" onPress={() => handleSaveItems(false)}>
              <Text>Simpan Template & Data</Text>
            </Button>
            <Button onPress={() => handleSaveItems(true)}>
              <FileDown size={15} color={colors.background} />
              <Text>Simpan & Download Excel (.xlsx)</Text>
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
        calcPpn={activePpn}
        discNum={discNum}
        itemsTotal={itemsTotal}
        subject={subject}
        intro={intro}
        notesList={parsedNotes}
        city={city}
        kopText={kopText}
        customerAddress={customerAddress}
        signerName={signerName}
        signerTitle={signerTitle}
        onSave={async () => {
          await onUpdateItems(
            items,
            itemsTotal,
            {
              subject,
              intro,
              notesList: parsedNotes,
              city,
              kopText,
              customerAddress,
              signerName,
              signerTitle,
            },
            true,
          );
          setPreviewOpen(false);
        }}
      />
    </>
  );
}

function LeadExtras({ row }: { row: Row }) {
  const router = useRouter();
  const { toast, data, addRow, patchRow, pushHistory, user, reload } = useApp();
  const quotation = (data.quotations ?? []).find(
    (q) => (q.leadId && String(q.leadId) === String(row.id)) || (q.lead && q.lead.toLowerCase() === row.nama.toLowerCase())
  );
  const isQualify = ["Qualification", "Proposal", "Negotiation", "Won"].includes(row.status);
  const lostReasons: string[] = (data.lostReasons ?? []).map((r: Row) => String(r.nama)).filter(Boolean);

  // Follow-up state
  const [fuOpen, setFuOpen] = React.useState(false);
  const [fuMethod, setFuMethod] = React.useState<"Telepon" | "WhatsApp" | "Meeting" | "Email" | "Survey">("Telepon");
  const [fuDate, setFuDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [fuNote, setFuNote] = React.useState("");
  const [fuNextAction, setFuNextAction] = React.useState("");
  const [fuStatus, setFuStatus] = React.useState<"SELESAI" | "JADWAL">("SELESAI");

  const apiFollowups = React.useMemo(() => {
    const fromStore = (data.followups ?? [])
      .filter((f: Row) => String(f.leadId) === String(row.id))
      .map((f: Row) => ({
        id: String(f.id),
        method: String(f.metode || f.method || "Telepon"),
        note: String(f.catatan || f.notes || "-"),
        date: String(f.tanggal || f.date || ""),
        next: f.berikutnya || f.nextAction ? String(f.berikutnya || f.nextAction) : undefined,
        status: String(f.status || "SELESAI"),
      }));
    if (fromStore.length > 0) return fromStore;
    if (Array.isArray(row._followUps) && row._followUps.length > 0) {
      return row._followUps.map((f: any) => ({
        id: String(f.id),
        method: String(f.method || "Telepon"),
        note: String(f.notes || "-"),
        date: String(f.date || ""),
        next: f.nextAction ? String(f.nextAction) : undefined,
        status: String(f.status || "SELESAI"),
      }));
    }
    return [];
  }, [data.followups, row.id, row._followUps]);

  // Reassign Sales state
  const [reassignOpen, setReassignOpen] = React.useState(false);
  const [newOwner, setNewOwner] = React.useState(row.pemilik || "");
  const [reassignReason, setReassignReason] = React.useState("");

  // Edit Lost Reason state
  const [lostReasonOpen, setLostReasonOpen] = React.useState(false);
  const [selectedLostReason, setSelectedLostReason] = React.useState(row.alasanLost || lostReasons[0]);

  const salesUsers: Row[] = (data.users ?? []).filter((u: Row) =>
    ["super_admin", "sales", "pm", "bos", "admin"].includes(String(u.role)),
  );

  async function handleAddFollowup() {
    if (!fuNote.trim()) {
      toast("Catatan follow-up tidak boleh kosong", "danger");
      return;
    }
    const created = await addRow("followups", {
      leadId: row.id,
      date: fuDate || new Date().toISOString().slice(0, 10),
      method: fuMethod,
      notes: fuNote.trim(),
      nextDate: fuNextAction || undefined,
      status: fuStatus,
    });
    if (created) {
      patchRow("leads", row.id, { sepi: 0 });
      pushHistory("leads", row.id, `Follow-up (${fuMethod}): ${fuNote.trim()}${fuNextAction ? ` | Next: ${fuNextAction}` : ""}`);
      setFuNote("");
      setFuNextAction("");
      setFuOpen(false);
    }
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
          subtitle="Saat lead masuk tahap Qualification, penawaran otomatis disiapkan dengan nomor ter-generate & ter-link ke Lead."
        >
          {quotation ? (
            <View className="gap-3">
              <Line left="Nomor Penawaran" right={<Text className="text-primary font-bold">{quotation.nomor}</Text>} />
              <Line left="TOTAL (Sebelum PPN)" right={<Text className="font-semibold">{rupiah(quotation.total || quotation.nilai || 0)}</Text>} />
              <Line left="PPN (11%)" right={<Text className="font-semibold">{rupiah(quotation.ppn ?? Math.round((quotation.total || quotation.nilai || 0) * 0.11))}</Text>} />
              <Line left="DISC" right={<Text className="text-danger font-semibold">- {rupiah(quotation.disc || 0)}</Text>} />
              <Line
                left="TOTAL AFTER DISC (Grand Total)"
                right={<Text className="text-primary font-bold">{rupiah(quotation.totalAfterDisc || quotation.nilai || 0)}</Text>}
              />
              <Line left="Status Penawaran" right={<StatusBadge status={quotation.status || "Not Yet"} />} />
              <Line
                left="File Excel Penawaran"
                right={
                  quotation.fileUploaded ? (
                    <View className="flex-row items-center gap-1.5">
                      <CheckCircle2 size={14} color={colors.primary} />
                      <Text className="text-xs text-primary font-semibold">
                        {quotation.fileName || `Penawaran-${(quotation.nomor || "penawaran").replace(/\//g, "-")}.xlsx`}
                      </Text>
                    </View>
                  ) : (
                    <Text className="text-xs text-muted-foreground font-medium">Belum Diupload</Text>
                  )
                }
              />

              <FileUploader
                label="Upload File Excel Penawaran (.xlsx) — Sistem Otomatis Membaca Tabel & Nilai"
                kind="dokumen"
                autoFlush
                onFilePicked={async (file) => {
                  try {
                    await uploadQuotationExcel(quotation.id, file);
                    await reload();
                    toast("File Excel penawaran berhasil dibaca & disinkronkan ke Lead!");
                  } catch (e: any) {
                    toast(e?.message || "Gagal membaca file Excel", "danger");
                  }
                }}
              />

              <View className="flex-row flex-wrap items-center gap-2 mt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => {
                    downloadQuotationTemplate({
                      quotationId: quotation.id,
                      leadId: row.id,
                      customer: row.perusahaan,
                      lead: row.nama,
                      nomor: quotation.nomor,
                      signer: row.pemilik,
                    });
                    toast("File Excel penawaran (.xlsx) sedang diunduh");
                  }}
                  className="flex-row items-center gap-1.5"
                >
                  <FileDown size={15} color={colors.text} />
                  <Text className="text-xs">Download Excel (.xlsx)</Text>
                </Button>
                <Button
                  size="sm"
                  onPress={() => router.push(`/quotations/${quotation.id}` as any)}
                  className="flex-row items-center gap-1.5"
                >
                  <FileText size={15} color={colors.background} />
                  <Text className="text-xs">Buka & Kelola Penawaran ({quotation.nomor})</Text>
                  <ArrowRight size={14} color={colors.background} />
                </Button>
              </View>
            </View>
          ) : (
            <View className="gap-3">
              <Text className="text-xs text-muted-foreground leading-relaxed">
                Lead sudah masuk tahap kualifikasi. Silakan unduh template Excel penawaran (.xlsx) untuk diisi secara manual, atau buka modul Penawaran.
              </Text>
              <Button
                size="sm"
                variant="outline"
                onPress={() => {
                  downloadQuotationTemplate({
                    leadId: row.id,
                    customer: row.perusahaan,
                    lead: row.nama,
                    signer: row.pemilik,
                  });
                  toast("Template Excel penawaran (.xlsx) sedang diunduh");
                }}
                className="self-start flex-row items-center gap-1.5"
              >
                <FileDown size={15} color={colors.text} />
                <Text className="text-xs">Download Template Excel (.xlsx)</Text>
              </Button>
            </View>
          )}
        </Panel>
      ) : null}

      <Panel
        title="PIC & Kepemilikan Lead"
        subtitle="Setiap lead memiliki PIC Sales yang bertanggung jawab mengawal pipeline."
        right={
          (user?.role === "super_admin" || user?.role === "bos" || user?.role === "admin" || user?.role === "sales") ? (
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
          {apiFollowups.length === 0 ? (
            <Text className="text-muted-foreground text-xs py-2">Belum ada riwayat follow-up tercatat.</Text>
          ) : (
            apiFollowups.map((item) => (
              <View key={item.id} className="border-border border-b py-2.5 last:border-b-0">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View className="bg-primary/10 rounded-md p-1">
                      {item.method === "Telepon" ? <Phone size={13} color={colors.primary} /> : null}
                      {item.method === "WhatsApp" ? <MessageSquare size={13} color={colors.primary} /> : null}
                      {item.method === "Email" ? <Mail size={13} color={colors.primary} /> : null}
                      {!["Telepon", "WhatsApp", "Email"].includes(item.method) ? <Calendar size={13} color={colors.primary} /> : null}
                    </View>
                    <Text className="text-xs font-semibold text-foreground">{item.method}</Text>
                  </View>
                  <Text className="text-[11px] text-muted-foreground">{item.date}</Text>
                </View>
                <Text className="text-xs text-foreground mt-1 leading-relaxed">{item.note}</Text>
                {item.next ? (
                  <View className="bg-panel/60 border-border/60 mt-1.5 flex-row items-center gap-1.5 rounded p-1.5 border">
                    <Calendar size={12} color={colors.info} />
                    <Text className="text-[11px] text-info">Jadwal follow-up berikutnya: {item.next}</Text>
                  </View>
                ) : null}
              </View>
            ))
          )}
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
              <Text className="text-xs text-muted-foreground font-medium">Tanggal Komunikasi</Text>
              <DatePicker value={fuDate} onChange={setFuDate} placeholder="Pilih tanggal follow-up" />
            </View>

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
              <Text className="text-xs text-muted-foreground font-medium">Tanggal Follow-up Berikutnya (Opsional)</Text>
              <DatePicker value={fuNextAction} onChange={setFuNextAction} placeholder="Pilih tanggal jadwal berikutnya" />
            </View>

            <View className="gap-1.5">
              <Text className="text-xs text-muted-foreground font-medium">Status Follow-up</Text>
              <View className="flex-row gap-2">
                {(["SELESAI", "JADWAL"] as const).map((st) => (
                  <Button
                    key={st}
                    size="sm"
                    variant={fuStatus === st ? "default" : "outline"}
                    onPress={() => setFuStatus(st)}
                    className="h-8 px-3"
                  >
                    <Text className="text-xs">{st === "SELESAI" ? "Selesai Dilakukan" : "Terjadwal"}</Text>
                  </Button>
                ))}
              </View>
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
            {lostReasons.map((r) => (
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
        status: "Revisi",
        fileName: `Penawaran-${row.nomor.replace(/\//g, "-")}-v${nextVersionNum}.xlsx`,
        fileUploaded: true,
      });
    }
    setInputTotal(String(revTotNum));
    setInputDisc(String(revDiscNum));
    setRevisiOpen(false);
    toast(`Versi ${nextVersionNum} penawaran berhasil dibuat & berstatus Revisi`);
  }

  const totNum = editFinancials
    ? Number(inputTotal.replace(/\D/g, "")) || 0
    : Number(row.total || row.nilai || 0);
  const discNum = editFinancials
    ? Number(inputDisc.replace(/\D/g, "")) || 0
    : Number(row.disc || 0);
  const calcPpn = Math.round(totNum * 0.11);
  const calcTotalAfterDisc = Math.max(0, totNum + calcPpn - discNum);

  async function handleSaveFinancials() {
    await patchRow("quotations", row.id, {
      total: totNum,
      nilai: totNum,
      ppn: calcPpn,
      disc: discNum,
      totalAfterDisc: calcTotalAfterDisc,
      fileUploaded: true,
      fileName: `Penawaran-${row.nomor.replace(/\//g, "-")}.xlsx`,
      status: row.status === "Not Yet" ? "Done" : row.status,
    });
    setEditFinancials(false);
    toast("Nilai penawaran & file Excel (.xlsx) berhasil diperbarui");
  }

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
                Status masih <b>Not Yet</b>. Anda bisa <b>Edit Item / Jasa di aplikasi</b> atau <b>Upload File Excel (.xlsx)</b> hasil editan manual agar sistem otomatis membaca nilainya dan mengubah status menjadi <b>Done</b>.
              </Text>
            </View>
          )}

          {!editFinancials ? (
            <Button
              variant="outline"
              size="sm"
              onPress={() => {
                setInputTotal(String(row.total || row.nilai || "0"));
                setInputDisc(String(row.disc || "0"));
                setEditFinancials(true);
              }}
              className="mt-2 self-start"
            >
              <Text className="text-xs">Ubah Nilai & Diskon Manual</Text>
            </Button>
          ) : (
            <View className="bg-panel border-border/80 gap-3 rounded-xl border p-4 mt-2">
              <Text className="text-sm font-semibold text-foreground">Edit Nilai & Diskon Penawaran</Text>
              <View className="gap-1">
                <Text className="text-xs text-muted-foreground">TOTAL Nilai Sebelum PPN (Rp)</Text>
                <Input
                  value={inputTotal}
                  onChangeText={setInputTotal}
                  placeholder="Contoh: 3000000"
                  keyboardType="numeric"
                />
              </View>
              <View className="gap-1">
                <Text className="text-xs text-muted-foreground">Diskon / DISC (Rp)</Text>
                <Input
                  value={inputDisc}
                  onChangeText={setInputDisc}
                  placeholder="Contoh: 0"
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
          const newPpn = Math.round(newTotal * 0.11);
          const newAfterDisc = Math.max(0, newTotal + newPpn - discNum);
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
            fileUploaded: true,
            fileName: `Penawaran-${row.nomor.replace(/\//g, "-")}.xlsx`,
            status: row.status === "Not Yet" ? "Done" : row.status,
          });
          setInputTotal(String(newTotal));
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
            <View className="bg-panel border-border/60 rounded-lg border p-2.5">
              <Text className="text-[11px] text-muted-foreground">Preview PPN 11%: {rupiah(revPpn)}</Text>
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
        <Text className="text-sm leading-relaxed text-foreground">{techNotes}</Text>
      </Panel>

      <DocumentationPhotosPanel
        kind="survey"
        entityId={row.id}
        title="Dokumentasi Foto Lapangan"
        subtitle="Bukti kondisi fisik lokasi survey untuk tim project & sales (terkompilasi otomatis ke PDF)."
      />

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
      pelapor: row.penerima || "-",
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

            <FileUploader label="Upload Foto Bukti Kerusakan / Serial Number" kind="foto" category="laporan-kerusakan" autoFlush />
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

  const hasGoods = row.withGoods !== undefined ? Boolean(row.withGoods) : (row.barang && row.barang !== "-");

  return (
    <>
      <Panel
        title="Barang yang Dibawa"
        subtitle={hasGoods ? "Surat jalan membawa barang fisik / unit ber-SN" : "Surat jalan penugasan tanpa barang"}
        right={
          (user?.role === "super_admin" || user?.role === "pm" || user?.role === "bos" || user?.role === "gudang") && !isDelivered ? (
            <Button
              variant="outline"
              size="sm"
              onPress={() => {
                const next = !hasGoods;
                patchRow("delivery-notes", row.id, {
                  withGoods: next,
                  barang: next ? (row.barang && row.barang !== "-" ? row.barang : "Membawa barang operasional") : "-",
                });
                toast(`Surat jalan diubah menjadi ${next ? "Membawa Barang" : "Tanpa Barang"}`);
              }}
            >
              <Text className="text-xs">{hasGoods ? "Ubah ke Tanpa Barang" : "Ubah ke Bawa Barang"}</Text>
            </Button>
          ) : undefined
        }
      >
        {!hasGoods ? (
          <Text className="text-muted-foreground text-sm">Surat jalan ini untuk penugasan tanpa barang.</Text>
        ) : (
          <>
            <Line left={row.barang && row.barang !== "-" ? row.barang : "Membawa barang operasional"} sub="Barang ber-SN wajib di-scan sebelum berangkat" />
            {user!.role === "super_admin" || user!.role === "gudang" || user!.role === "bos" ? (
              <View className="mt-3"><ScanInput existing={Array.isArray(row.snList) ? row.snList : []} /></View>
            ) : null}
          </>
        )}
      </Panel>

      <Panel
        title="Laporan Hasil Kunjungan & Serah Terima Lapangan"
        subtitle="Dokumentasi penerimaan barang di lokasi klien beserta tanda tangan atau foto bukti."
        right={
          !isDelivered && (user!.role === "super_admin" || user!.role === "teknisi" || user!.role === "pm" || user!.role === "bos") ? (
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

      <DocumentationPhotosPanel
        kind="delivery-note"
        entityId={row.id}
        title="Foto Bukti Serah Terima & Dokumentasi Surat Jalan"
        subtitle="Lampirkan foto penerimaan barang di lokasi tujuan dan unduh PDF kompilasi resmi."
      />

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
            <FileUploader label="Upload Foto Bukti Serah Terima / TTD Surat Jalan" kind="foto" category="surat-jalan" autoFlush />
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
  const { toast, data, reload, user } = useApp();
  const products: Row[] = data.products ?? [];
  const [reserveOpen, setReserveOpen] = React.useState(false);
  const [selectedProduct, setSelectedProduct] = React.useState("");
  const [reserveQty, setReserveQty] = React.useState("2");
  const [bastOpen, setBastOpen] = React.useState(false);
  const [requirements, setRequirements] = React.useState<
    { id: string; produk: string; neededQty: number; reservedQty: number; shortageQty: number; status: string }[]
  >([]);

  const activeSelectedProduct = selectedProduct || String(products[0]?.nama ?? "");

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
    return res.map((r: any) => ({
      id: String(r.id),
      produk: r.product?.name ?? "Barang",
      neededQty: Number(r.neededQty ?? 0),
      reservedQty: Number(r.reservedQty ?? 0),
      shortageQty: Number(r.shortageQty ?? 0),
      status:
        Number(r.shortageQty ?? 0) > 0
          ? `Reserved ${r.reservedQty} · Kurang ${r.shortageQty} (Masuk PR Procurement)`
          : `Tersedia & Di-reserve (${r.reservedQty})`,
    }));
  }, []);

  const loadRequirements = React.useCallback(async () => {
    try {
      const res = await api<any[]>("GET", `/projects/${row.id}/requirements`);
      if (Array.isArray(res)) {
        setRequirements(mapRequirements(res));
      }
    } catch {}
  }, [row.id, mapRequirements]);

  React.useEffect(() => {
    let active = true;
    api<any[]>("GET", `/projects/${row.id}/requirements`)
      .then((res) => {
        if (active && Array.isArray(res)) {
          setRequirements(mapRequirements(res));
        }
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
      const res = await api<any>("POST", `/projects/${row.id}/requirements`, {
        items: [{ productId: Number(prod.id), neededQty: q }],
      });
      await loadRequirements();
      await reload();
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
        <Line left="Status Pembayaran Termin" right={<Text className="font-medium text-text-secondary">{row.pembayaran || "Belum lunas"}</Text>} />
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
                    onPress={() => setSelectedProduct(p.nama)}
                    className={`p-2 rounded flex-row items-center justify-between ${
                      activeSelectedProduct === p.nama ? "bg-primary/10" : ""
                    }`}
                  >
                    <Text className="text-xs font-medium">{p.nama}</Text>
                    {activeSelectedProduct === p.nama ? <Check size={14} color={colors.primary} /> : null}
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

function InvoiceExtras({ row }: { row: Row }) {
  const { user, toast, reload } = useApp();
  const sisa = Math.max(0, Number(row.total || 0) - Number(row.terbayar || 0));
  const [payOpen, setPayOpen] = React.useState(false);
  const [payAmount, setPayAmount] = React.useState(String(sisa || row.total || 0));
  const [payDate, setPayDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [payMethod, setPayMethod] = React.useState<"TRANSFER" | "TUNAI" | "QRIS" | "LAINNYA">("TRANSFER");
  const [payRef, setPayRef] = React.useState("");
  const payments: { id: string; amount: number; date: string; method: string; reference: string }[] =
    Array.isArray(row._payments) ? row._payments : [];

  function openPayModal() {
    setPayAmount(String(Math.max(0, Number(row.total || 0) - Number(row.terbayar || 0))));
    setPayOpen(true);
  }

  async function handleSavePayment() {
    const amt = Number(String(payAmount).replace(/\D/g, "")) || 0;
    if (amt <= 0) {
      toast("Nominal pembayaran harus lebih dari 0", "danger");
      return;
    }
    try {
      await api("POST", `/invoices/${row.id}/payments`, {
        amount: amt,
        date: payDate || new Date().toISOString().slice(0, 10),
        method: payMethod,
        reference: payRef.trim() || undefined,
      });
      toast(`Pembayaran ${rupiah(amt)} berhasil dicatat`);
      setPayOpen(false);
      setPayRef("");
      await reload();
    } catch (e: any) {
      toast(e?.message ?? "Gagal mencatat pembayaran", "danger");
    }
  }

  const canExportEfaktur = ["super_admin", "bos", "finance"].includes(user?.role || "");

  function handleDownloadEfaktur() {
    if (!canExportEfaktur) {
      toast("Akses ditolak: Ekspor E-Faktur hanya untuk Finance, Bos, dan Super Admin", "danger");
      return;
    }
    if (typeof window === "undefined" || typeof document === "undefined") {
      toast("Mengunduh CSV E-Faktur DJP");
      return;
    }
    const token = getAccess();
    const url = `${apiBase()}/invoices/efaktur/export?invoiceId=${row.id}${token ? `&token=${encodeURIComponent(token)}` : ""}`;
    const link = document.createElement("a");
    link.href = url;
    link.download = `efaktur-${String(row.nomor || "inv").replace(/[^a-zA-Z0-9_-]/g, "_")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast(`CSV E-Faktur DJP untuk ${row.nomor} berhasil diunduh`);
  }

  return (
    <>
      <Panel
        title="Ringkasan Pembayaran Invoice"
        right={
          <View className="flex-row items-center gap-1.5">
            {canExportEfaktur ? (
              <Button variant="outline" size="sm" onPress={handleDownloadEfaktur} className="flex-row items-center gap-1">
                <FileSpreadsheet size={13} color={colors.success} />
                <Text className="text-xs">CSV E-Faktur</Text>
              </Button>
            ) : null}
            {(user?.role === "super_admin" || user?.role === "finance" || user?.role === "bos" || user?.role === "admin") && sisa > 0 ? (
              <Button variant="outline" size="sm" onPress={openPayModal} className="flex-row items-center gap-1">
                <Plus size={13} color={colors.text} />
                <Text className="text-xs">Catat Pembayaran</Text>
              </Button>
            ) : null}
          </View>
        }
      >
        <Line left="Nilai Sebelum PPN" right={<Text className="text-sm font-medium">{rupiah(row.nilai || 0)}</Text>} />
        <Line left="PPN (11%)" right={<Text className="text-sm font-medium">{rupiah(row.ppn || 0)}</Text>} />
        <Line left="Total Tagihan" right={<Text className="text-sm font-bold">{rupiah(row.total || 0)}</Text>} />
        <Line left="Sudah Dibayar" right={<Text className="text-success text-sm font-medium">{rupiah(row.terbayar || 0)}</Text>} />
        <Line left="Sisa Tagihan" right={<Text className="text-sm font-semibold">{rupiah(sisa)}</Text>} />
      </Panel>
      <Panel title="Riwayat Pembayaran Masuk">
        {payments.length > 0 ? (
          payments.map((p) => (
            <Line
              key={p.id}
              left={`${p.method} · ${p.date}`}
              sub={p.reference && p.reference !== "-" ? `Ref: ${p.reference}` : "Pembayaran terverifikasi"}
              right={<Text className="text-sm font-semibold text-success">{rupiah(p.amount)}</Text>}
            />
          ))
        ) : row.terbayar > 0 ? (
          <Line left="Transfer bank" sub="Bukti transfer tercatat" right={<Text className="text-sm">{rupiah(row.terbayar)}</Text>} />
        ) : (
          <Text className="text-muted-foreground text-sm">Belum ada pembayaran tercatat.</Text>
        )}
      </Panel>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Catat Pembayaran Invoice ({row.nomor})</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <FormField label="Nominal Pembayaran (Rp)" required>
              <Input value={payAmount} onChangeText={setPayAmount} keyboardType="numeric" />
            </FormField>
            <FormField label="Tanggal Pembayaran" required>
              <DatePicker value={payDate} onChange={setPayDate} placeholder="Pilih tanggal bayar" />
            </FormField>
            <FormField label="Metode Pembayaran" required>
              <View className="flex-row flex-wrap gap-1.5">
                {(["TRANSFER", "TUNAI", "QRIS", "LAINNYA"] as const).map((m) => (
                  <Button
                    key={m}
                    size="sm"
                    variant={payMethod === m ? "default" : "outline"}
                    onPress={() => setPayMethod(m)}
                    className="h-8 px-2.5"
                  >
                    <Text className="text-xs">{m}</Text>
                  </Button>
                ))}
              </View>
            </FormField>
            <FormField label="Nomor Referensi / Rekening">
              <Input value={payRef} onChangeText={setPayRef} placeholder="Contoh: TRF-BCA-992811" />
            </FormField>
            <FileUploader label="Upload Bukti Pembayaran (JPG / PDF)" kind="semua" category="foto-struk" autoFlush />
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setPayOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSavePayment}>
              <Text>Simpan Pembayaran</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SupplierPoExtras({ row }: { row: Row }) {
  const { user, patchRow, setStatus, addRow, toast, data, reload } = useApp();
  const steps = ["Di Supplier", "Dikirim", "Sampai"];
  const cur = steps.indexOf(row.pengiriman);
  const showPrice = PRICE_ROLES.includes(user!.role);

  const supplierInvoices: Row[] = (data.invoiceIn ?? []).filter(
    (inv: Row) => String(inv.supplierPoId) === String(row.id) || inv.po === row.nomor
  );

  const [invOpen, setInvOpen] = React.useState(false);
  const [invNumber, setInvNumber] = React.useState(`INV-SUP-${row.nomor || row.id}`);
  const [invAmount, setInvAmount] = React.useState(String(row.total || 0));
  const [invDate, setInvDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [invDue, setInvDue] = React.useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });

  function go(s: string) {
    patchRow("supplier-pos", row.id, { pengiriman: s, status: s });
    setStatus("supplier-pos", row.id, s);
  }

  async function handleCreateInvoiceIn() {
    const amt = Number(String(invAmount).replace(/\D/g, "")) || 0;
    const ppn = Math.round(amt * 0.11);
    const created = await addRow("invoiceIn", {
      nomor: invNumber,
      supplierId: row.supplierId,
      supplier: row.supplier,
      supplierPoId: row.id,
      nilai: amt,
      ppn,
      total: amt + ppn,
      tanggal: invDate,
      jatuhTempo: invDue,
    });
    if (created) {
      setInvOpen(false);
      await reload();
    }
  }

  async function handlePaySupplierInvoice(inv: Row) {
    const sisa = Math.max(0, Number(inv.total || 0) - Number(inv.terbayar || 0));
    if (sisa <= 0) {
      toast("Invoice supplier ini sudah lunas", "info");
      return;
    }
    try {
      await api("POST", `/invoice-in/${inv.id}/payments`, {
        amount: sisa,
        date: new Date().toISOString().slice(0, 10),
        method: "TRANSFER",
        reference: `PAY-${inv.nomor}`,
      });
      toast(`Pembayaran ke supplier sebesar ${rupiah(sisa)} berhasil dicatat`);
      await reload();
    } catch (e: any) {
      toast(e?.message ?? "Gagal mencatat pembayaran supplier", "danger");
    }
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
        {(user!.role === "super_admin" || user!.role === "procurement" || user!.role === "bos" || user!.role === "admin") && cur < 2 && steps[cur + 1] ? (
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

      {showPrice ? (
        <Panel
          title="Invoice Masuk & Pembayaran ke Supplier"
          subtitle="Tagihan dari supplier atas PO ini beserta status pelunasan oleh Finance."
          right={
            <Button size="sm" variant="outline" onPress={() => setInvOpen(true)} className="flex-row items-center gap-1">
              <Plus size={14} color={colors.text} />
              <Text className="text-xs">Catat Invoice Masuk</Text>
            </Button>
          }
        >
          {supplierInvoices.length === 0 ? (
            <Text className="text-muted-foreground text-xs py-1">Belum ada tagihan (Invoice Masuk) dari supplier untuk PO ini.</Text>
          ) : (
            supplierInvoices.map((inv) => {
              const lunas = Number(inv.terbayar || 0) >= Number(inv.total || 0) && Number(inv.total || 0) > 0;
              return (
                <Line
                  key={inv.id}
                  left={`${inv.nomor} · Jatuh tempo ${inv.jatuhTempo}`}
                  sub={`Dibayar: ${rupiah(inv.terbayar || 0)} dari ${rupiah(inv.total || 0)} (${inv.status})`}
                  right={
                    !lunas && (user?.role === "super_admin" || user?.role === "finance" || user?.role === "bos" || user?.role === "admin") ? (
                      <Button size="sm" variant="outline" onPress={() => handlePaySupplierInvoice(inv)}>
                        <Text className="text-xs">Lunasi</Text>
                      </Button>
                    ) : (
                      <StatusBadge status={lunas ? "Lunas" : inv.status} />
                    )
                  }
                />
              );
            })
          )}
        </Panel>
      ) : null}

      <Dialog open={invOpen} onOpenChange={setInvOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Catat Invoice Masuk Supplier</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <FormField label="Nomor Invoice Supplier" required>
              <Input value={invNumber} onChangeText={setInvNumber} />
            </FormField>
            <FormField label="Nilai DPP Sebelum PPN (Rp)" required>
              <Input value={invAmount} onChangeText={setInvAmount} keyboardType="numeric" />
            </FormField>
            <FormField label="Tanggal Invoice" required>
              <DatePicker value={invDate} onChange={setInvDate} />
            </FormField>
            <FormField label="Jatuh Tempo" required>
              <DatePicker value={invDue} onChange={setInvDue} />
            </FormField>
            <FileUploader label="Upload File Invoice dari Supplier" kind="dokumen" category="invoice" autoFlush />
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setInvOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleCreateInvoiceIn}>
              <Text>Simpan Invoice Masuk</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ModuleExtras({ moduleKey, row }: { moduleKey: string; row: Row }) {
  const { user, data } = useApp();

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
    return <InvoiceExtras row={row} />;
  }

  if (moduleKey === "supplier-pos") {
    return <SupplierPoExtras row={row} />;
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

  if (moduleKey === "opname") {
    const details = row._details ?? [];
    return (
      <Panel title={`Rincian Hitungan Fisik (${details.length} Produk)`} subtitle="Perbandingan stok sistem vs hitungan riil di gudang">
        {details.length === 0 ? (
          <Text className="text-muted-foreground text-sm py-2">Belum ada rincian produk.</Text>
        ) : (
          <View className="gap-2">
            {details.map((d: any, idx: number) => {
              const productName = d.product?.name ?? `Produk #${d.productId}`;
              const sku = d.product?.sku ? `SKU: ${d.product.sku} · ` : "";
              const unit = d.product?.unit ? ` ${d.product.unit}` : "";
              const diff = Number(d.diff ?? 0);
              return (
                <View
                  key={d.id ?? idx}
                  className="border-border/60 flex-row items-center justify-between border-b py-3 last:border-b-0"
                >
                  <View className="flex-1 min-w-0 pr-3">
                    <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                      {productName}
                    </Text>
                    <Text className="text-muted-foreground text-xs mt-0.5">
                      {sku}Sistem: {d.systemQty}{unit} · Fisik: {d.countedQty}{unit}
                    </Text>
                    {d.note ? (
                      <Text className="text-muted-foreground text-[11px] italic mt-0.5">Catatan: {d.note}</Text>
                    ) : null}
                  </View>
                  <View className="items-end shrink-0">
                    {diff === 0 ? (
                      <Text className="text-success text-xs font-semibold">Cocok (0)</Text>
                    ) : diff < 0 ? (
                      <Text className="text-danger text-xs font-semibold">{diff}{unit}</Text>
                    ) : (
                      <Text className="text-info text-xs font-semibold">+{diff}{unit}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Panel>
    );
  }

  return null;
}
