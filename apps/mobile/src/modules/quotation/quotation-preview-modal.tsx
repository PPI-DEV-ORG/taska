import { View, ScrollView, Image } from "react-native";
import { FileDown } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { colors } from "@/tokens";
import { rupiah, tanggal } from "@/lib/format";
import { type Row } from "@/constants/modules";
import { type QuotationItem } from "@/modules/quotation/types";
import { downloadQuotationTemplate, downloadQuotationPdf } from "@/modules/quotation/quotation-files";

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
  kopLogoUrl,
  customerAddress,
  signerName,
  signerTitle,
  title,
  dpLabel,
  dpAmount,
  closingText,
  onDownloadPdf,
  onDownloadExcel,
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
  kopLogoUrl?: string;
  customerAddress?: string;
  signerName?: string;
  signerTitle?: string;
  title?: string;
  dpLabel?: string;
  dpAmount?: number;
  closingText?: string;
  onDownloadPdf?: () => void;
  onDownloadExcel?: () => void;
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

  const logoSource = kopLogoUrl || (row as any).kopLogoUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl md:max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{title || "Preview File Penawaran (Format Resmi Excel & PDF)"}</DialogTitle>
        </DialogHeader>
        <ScrollView style={{ maxHeight: 580 }} contentContainerClassName="gap-3 p-4 bg-white rounded-xl text-black border border-zinc-300">
          {/* KOP SURAT Box */}
          <View className="border border-black py-3 px-3 items-center justify-center bg-white min-h-[50px] gap-1.5">
            {logoSource ? (
              <Image
                source={{ uri: logoSource }}
                style={{ width: 140, height: 50, resizeMode: "contain" }}
              />
            ) : null}
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
            {discNum > 0 ? (
              <View className="flex-row border-b border-black bg-white py-1.5 px-2">
                <Text className="flex-1 text-[11px] font-bold text-black text-center">DISC</Text>
                <Text className="w-24 text-[11px] font-bold text-red-600 text-right">- {rupiah(discNum)}</Text>
              </View>
            ) : null}
            {calcPpn > 0 ? (
              <View className="flex-row border-b border-black bg-white py-1.5 px-2">
                <Text className="flex-1 text-[11px] font-bold text-black text-center">PPN (11%)</Text>
                <Text className="w-24 text-[11px] font-bold text-black text-right">{rupiah(calcPpn)}</Text>
              </View>
            ) : null}
            {Number(row.pph || 0) > 0 ? (
              <View className="flex-row border-b border-black bg-white py-1.5 px-2">
                <Text className="flex-1 text-[11px] font-bold text-black text-center">
                  PPh {row.tipePph ? `(${row.tipePph})` : ""}
                </Text>
                <Text className="w-24 text-[11px] font-bold text-red-600 text-right">- {rupiah(Number(row.pph || 0))}</Text>
              </View>
            ) : null}
            <View className="flex-row bg-white py-2 px-2">
              <Text className="flex-1 text-xs font-bold text-black text-center">GRAND TOTAL</Text>
              <Text className="w-24 text-xs font-bold text-black text-right">
                {rupiah(Math.max(0, itemsTotal - discNum + calcPpn - Number(row.pph || 0)))}
              </Text>
            </View>
            {dpLabel && dpAmount !== undefined ? (
              <View className="flex-row border-t border-black bg-white py-1.5 px-2">
                <Text className="flex-1 text-[11px] font-bold text-black text-center">{dpLabel}</Text>
                <Text className="w-24 text-[11px] font-bold text-black text-right">{rupiah(dpAmount)}</Text>
              </View>
            ) : null}
          </View>

          {/* Notes */}
          <View className="gap-0.5 pt-1">
            <Text className="text-xs font-bold text-black">Notes:</Text>
            {activeNotes.map((n, idx) => {
              const isBankInfo = /^(pembayaran|bank|no\.\s*rek|nama|alamat|bekasi)/i.test(n.trim());
              return (
                <Text
                  key={idx}
                  className={`text-[11px] text-black ${isBankInfo && /^(pembayaran|nama)/i.test(n.trim()) ? "font-semibold" : ""}`}
                >
                  {isBankInfo ? n : `${idx + 1}. ${n.replace(/^\d+\.\s*/, "")}`}
                </Text>
              );
            })}
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
              {closingText || "Sekian surat penawaran ini kami buat dengan harapan agar Bapak/Ibu bisa bekerjasama dengan perusahaan kami. Kami tunggu tanggapan dan kabar baik."}
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
                if (onDownloadPdf) {
                  onDownloadPdf();
                } else {
                  downloadQuotationPdf({
                    quotationId: row.id,
                    customer: row.customer || row.perusahaan,
                    lead: row.lead || row.nama,
                    nomor: row.nomor,
                    signer: row.pemilik,
                  });
                }
              }}
            >
              <FileDown size={15} color={colors.text} />
              <Text>Download PDF Resmi</Text>
            </Button>
            <Button
              onPress={() => {
                if (onSave) {
                  onSave();
                } else if (onDownloadExcel) {
                  onDownloadExcel();
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
