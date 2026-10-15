import * as React from "react";
import { View } from "react-native";
import { AlertTriangle, ShieldAlert } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Panel } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { FileUploader } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { type Row } from "@/constants/modules";
import { Line } from "@/modules/shared/line";

export function ReceivingExtras({ row }: { row: Row }) {
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
