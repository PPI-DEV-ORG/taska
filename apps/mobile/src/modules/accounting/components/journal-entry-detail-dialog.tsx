import * as React from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { ExternalLink } from "lucide-react-native";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { rupiah } from "@/lib/format";
import type { JournalLine } from "@/lib/accounting";
import { useApp } from "@/store/app-store";
import { resolveJournalRelatedDocument } from "../journal-related";

type JournalEntryDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  line: JournalLine | null;
  allLines: JournalLine[];
};

function sameEntry(a: JournalLine, b: JournalLine): boolean {
  if (a.journalEntryId && b.journalEntryId) {
    return a.journalEntryId === b.journalEntryId;
  }
  return a.journalNo === b.journalNo;
}

function InfoRow({
  label,
  value,
  mono,
  valueClassName,
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueClassName?: string;
}) {
  return (
    <View className="flex-row items-start justify-between gap-3">
      <Text className="text-[11px] text-muted-foreground">{label}</Text>
      <Text
        className={`flex-1 text-right text-[11px] font-medium text-foreground ${
          mono ? "font-mono" : ""
        } ${valueClassName ?? ""}`}
      >
        {value || "-"}
      </Text>
    </View>
  );
}

export function JournalEntryDetailDialog({
  open,
  onOpenChange,
  line,
  allLines,
}: JournalEntryDetailDialogProps) {
  const router = useRouter();
  const { data } = useApp();

  const entryLines = React.useMemo(() => {
    if (!line) return [];
    const matching = allLines.filter((row) => sameEntry(row, line));
    const lines = matching.length > 0 ? matching : [line];
    return [...lines].sort((a, b) => (a.lineNo ?? 0) - (b.lineNo ?? 0));
  }, [allLines, line]);

  const totalDebit = entryLines.reduce((sum, row) => sum + (Number(row.debit) || 0), 0);
  const totalKredit = entryLines.reduce((sum, row) => sum + (Number(row.kredit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalKredit) < 1;

  const related = React.useMemo(
    () => resolveJournalRelatedDocument(line, data),
    [data, line],
  );

  const openRelatedDocument = () => {
    if (!related) return;
    onOpenChange(false);
    router.push(related.href as any);
  };

  if (!line) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[92vh] gap-0 p-0 overflow-hidden">
        <View className="border-border/60 border-b px-5 py-4 pr-12">
          <DialogHeader>
            <DialogTitle>Detail Ayat Jurnal</DialogTitle>
            <Text className="text-xs text-muted-foreground">
              {line.journalNo} · {line.tanggal}
            </Text>
          </DialogHeader>
        </View>

        <ScrollView
          className="max-h-[64vh]"
          contentContainerClassName="p-4 sm:p-5 gap-4"
          showsVerticalScrollIndicator={false}
        >
          <View className="bg-panel/60 border-border/70 gap-2.5 rounded-xl border p-3.5">
            <InfoRow label="No. Jurnal" value={line.journalNo} mono />
            <InfoRow label="Tanggal & Waktu" value={line.tanggal} mono />
            <InfoRow label="Referensi" value={line.refNo} mono />
            <InfoRow label="Sumber" value={line.sumber} />
            {line.project && line.project !== "-" ? (
              <InfoRow label="Proyek" value={line.project} />
            ) : null}
            {line.entryStatus ? (
              <InfoRow
                label="Status Jurnal"
                value={
                  line.entryStatus === "POSTED"
                    ? "Posted"
                    : line.entryStatus === "REVERSED"
                      ? "Dibatalkan"
                      : line.entryStatus
                }
              />
            ) : null}
            <View className="border-border/50 border-t pt-2.5">
              <Text className="text-[11px] text-muted-foreground">Uraian Transaksi</Text>
              <Text className="mt-1 text-xs font-medium leading-relaxed text-foreground">
                {line.entryMemo || line.keterangan || "-"}
              </Text>
            </View>
          </View>

          <View className="bg-card border-border/70 overflow-hidden rounded-xl border">
            <View className="border-border/60 flex-row items-center justify-between border-b px-3.5 py-2.5">
              <View>
                <Text className="text-xs font-semibold text-foreground">Rincian Debit & Kredit</Text>
                <Text className="text-[11px] text-muted-foreground">
                  {entryLines.length} baris ayat jurnal
                </Text>
              </View>
              <View
                className={`rounded-full border px-2.5 py-1 ${
                  balanced
                    ? "border-success/30 bg-success/10"
                    : "border-danger/30 bg-danger/10"
                }`}
              >
                <Text
                  className={`text-[10px] font-semibold ${
                    balanced ? "text-success" : "text-danger"
                  }`}
                >
                  {balanced ? "Seimbang" : "Tidak seimbang"}
                </Text>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View style={{ minWidth: 760 }}>
                <View className="bg-panel/60 border-border/50 flex-row items-center border-b px-3.5 py-2">
                  <Text className="w-[95px] text-[11px] font-bold">Akun</Text>
                  <Text className="w-[190px] text-[11px] font-bold">Nama Akun</Text>
                  <Text className="min-w-[220px] flex-1 text-[11px] font-bold">Uraian</Text>
                  <Text className="w-[125px] pr-2 text-right text-[11px] font-bold">Debit (Rp)</Text>
                  <Text className="w-[125px] pl-2 text-right text-[11px] font-bold">Kredit (Rp)</Text>
                </View>

                {entryLines.map((row) => {
                  const isCredit = (row.kredit ?? 0) > 0 && (row.debit ?? 0) === 0;
                  return (
                    <View
                      key={`${row.journalEntryId ?? row.journalNo}-${row.id}`}
                      className="border-border/40 flex-row items-start border-b px-3.5 py-2"
                    >
                      <Text className="w-[95px] font-mono text-[11px] font-semibold text-primary">
                        {row.kodeAkun}
                      </Text>
                      <Text
                        className={`w-[190px] pr-2 text-[11px] font-medium ${
                          isCredit ? "pl-3 text-muted-foreground" : "text-foreground"
                        }`}
                        numberOfLines={2}
                      >
                        {row.namaAkun}
                      </Text>
                      <Text
                        className="min-w-[220px] flex-1 pr-3 text-[11px] text-muted-foreground"
                        numberOfLines={2}
                      >
                        {row.keterangan || "-"}
                      </Text>
                      <Text className="w-[125px] pr-2 text-right font-mono text-[11px] font-semibold">
                        {(row.debit ?? 0) > 0 ? rupiah(row.debit) : "-"}
                      </Text>
                      <Text className="w-[125px] pl-2 text-right font-mono text-[11px] font-semibold text-info">
                        {(row.kredit ?? 0) > 0 ? rupiah(row.kredit) : "-"}
                      </Text>
                    </View>
                  );
                })}

                <View className="bg-panel/50 flex-row items-center px-3.5 py-2.5">
                  <Text className="w-[95px] text-[11px] font-bold">Total</Text>
                  <View className="w-[190px]" />
                  <View className="min-w-[220px] flex-1" />
                  <Text className="w-[125px] pr-2 text-right font-mono text-xs font-bold">
                    {rupiah(totalDebit)}
                  </Text>
                  <Text className="w-[125px] pl-2 text-right font-mono text-xs font-bold text-info">
                    {rupiah(totalKredit)}
                  </Text>
                </View>
              </View>
            </ScrollView>
          </View>

          {!related ? (
            <View className="bg-panel/50 border-border/60 rounded-xl border border-dashed p-3">
              <Text className="text-[11px] text-muted-foreground">
                Tidak ada dokumen sumber yang bisa dibuka untuk jurnal ini.
              </Text>
            </View>
          ) : null}
        </ScrollView>

        <DialogFooter className="border-border/60 flex-row items-center justify-end border-t px-5 py-3">
          <Button variant="outline" size="sm" onPress={() => onOpenChange(false)}>
            <Text className="text-xs">Tutup</Text>
          </Button>
          {related ? (
            <Button size="sm" onPress={openRelatedDocument} className="gap-1.5">
              <ExternalLink size={13} color="#FFFFFF" />
              <Text className="text-xs font-semibold text-white">{related.label}</Text>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
