import * as React from "react";
import { View, ScrollView, Pressable } from "react-native";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/taska/basics";
import { DatePicker } from "@/components/taska/dialogs";
import { CheckCircle2, FileSpreadsheet, Search, ChevronLeft, ChevronRight } from "lucide-react-native";
import { colors } from "@/tokens";
import { rupiah } from "@/lib/format";
import { JournalLine } from "@/lib/accounting";

interface JournalTabProps {
  fin: any;
  handleExportJournalCsv: () => void;
  journalQuery: string;
  setJournalQuery: (v: string) => void;
  journalDate?: string;
  setJournalDate?: (v: string) => void;
  journalPage: number;
  setJournalPage: React.Dispatch<React.SetStateAction<number>>;
  journalSourceFilter: string;
  setJournalSourceFilter: (v: string) => void;
  filteredJournal: JournalLine[];
  pagedJournal: JournalLine[];
  currentJournalPage: number;
  totalJournalPages: number;
  JOURNAL_PAGE_SIZE: number;
  setJournalPageSize?: (s: number) => void;
  onSelectAccount: (code: string) => void;
}

export function JournalTab({
  fin,
  handleExportJournalCsv,
  journalQuery,
  setJournalQuery,
  journalDate,
  setJournalDate,
  setJournalPage,
  journalSourceFilter,
  setJournalSourceFilter,
  filteredJournal,
  pagedJournal,
  currentJournalPage,
  totalJournalPages,
  JOURNAL_PAGE_SIZE,
  setJournalPageSize,
  onSelectAccount,
}: JournalTabProps) {
  return (
    <View className="gap-4 w-full">
      <View className="bg-primary/10 border-primary/30 rounded-xl border p-4 flex-row flex-wrap items-center justify-between gap-3">
        <View className="flex-row items-center gap-3">
          <CheckCircle2 size={20} color={colors.primary} />
          <View>
            <Text className="text-sm font-bold text-foreground">
              Buku Jurnal Umum Berpasangan (Double-Entry General Journal)
            </Text>
            <Text className="text-xs text-muted-foreground">
              Total Debit: {rupiah(fin.totalDebit)} · Total Kredit: {rupiah(fin.totalKredit)} · Selisih: Rp 0 (Seimbang)
            </Text>
          </View>
        </View>
        <Button size="sm" variant="outline" onPress={handleExportJournalCsv} className="gap-1.5 h-8">
          <FileSpreadsheet size={14} color={colors.success} />
          <Text className="text-xs">Download CSV Jurnal</Text>
        </Button>
      </View>

      <Panel title="Daftar Transaksi Ayat Jurnal" subtitle="Pencatatan kronologis debit dan kredit atas seluruh transaksi operasional & manual">
        <View className="gap-3">
          <View className="flex-row flex-wrap items-center justify-between gap-2.5">
            <View className="flex-row flex-wrap items-center gap-2 flex-1 min-w-[280px]">
              <View className="flex-row items-center gap-2 flex-1 min-w-[200px] bg-card border border-border/80 rounded-xl px-3 h-10 shadow-sm">
                <Search size={15} color={colors.textSecondary} />
                <Input
                  value={journalQuery}
                  onChangeText={(value) => {
                    setJournalQuery(value);
                    setJournalPage(1);
                  }}
                  placeholder="Cari nomor jurnal, referensi, kode/nama akun, uraian..."
                  className="flex-1 h-8 text-xs border-0 bg-transparent px-0 shadow-none"
                />
              </View>
              {setJournalDate ? (
                <View className="w-full sm:w-auto">
                  <DatePicker
                    value={journalDate}
                    onChange={(val) => {
                      setJournalDate(val);
                      setJournalPage(1);
                    }}
                    placeholder="Filter tanggal..."
                    clearable
                    className="h-10 min-w-[160px] max-w-[220px] rounded-xl bg-card border-border/80 shadow-sm px-3"
                  />
                </View>
              ) : null}
            </View>
            <View className="flex-row flex-wrap gap-1.5">
              {[
                "Semua",
                "Invoice Client",
                "Pembayaran Invoice",
                "PO Supplier",
                "Pelunasan PO",
                "Pengeluaran (Expense)",
                "Pembayaran Pengeluaran",
                "Reimburse",
                "Pembayaran Reimburse",
                "Payroll & Gaji",
                "Jurnal Manual",
              ].map((s) => (
                <Pressable
                  key={s}
                  onPress={() => {
                    setJournalSourceFilter(s);
                    setJournalPage(1);
                  }}
                  className={
                    journalSourceFilter === s
                      ? "bg-primary/20 border-primary rounded-md border px-2.5 py-1"
                      : "bg-panel border-border rounded-md border px-2.5 py-1"
                  }
                >
                  <Text
                    className={
                      journalSourceFilter === s
                        ? "text-primary text-xs font-semibold"
                        : "text-muted-foreground text-xs"
                    }
                  >
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            contentContainerStyle={{ minWidth: "100%" }}
            className="w-full"
          >
            <View className="min-w-full w-full gap-0.5">
              <View className="bg-panel border-border flex-row items-center border-b px-3 py-2.5 rounded-t-lg">
                <Text className="w-[85px] text-xs font-bold">No. Jurnal</Text>
                <Text className="w-[90px] text-xs font-bold">Tanggal</Text>
                <Text className="w-[125px] text-xs font-bold">Referensi</Text>
                <Text className="w-[75px] text-xs font-bold">Akun</Text>
                <Text className="w-[220px] text-xs font-bold">Nama Akun</Text>
                <Text className="flex-1 text-xs font-bold">Uraian Transaksi</Text>
                <Text className="w-[125px] text-xs font-bold text-right">Debit (Rp)</Text>
                <Text className="w-[125px] text-xs font-bold text-right">Kredit (Rp)</Text>
              </View>
              {filteredJournal.length === 0 ? (
                <View className="py-12 items-center justify-center">
                  <Text className="text-xs text-muted-foreground">Tidak ada baris jurnal yang sesuai filter.</Text>
                </View>
              ) : (
                pagedJournal.map((line) => {
                  if (!line) return null;
                  const isCredit = (line.kredit ?? 0) > 0 && (line.debit ?? 0) === 0;
                  return (
                    <View
                      key={line.id}
                      className="border-border/50 flex-row items-center border-b px-3 py-2 hover:bg-panel/40"
                    >
                      <Text className="w-[85px] text-xs font-mono text-muted-foreground">
                        {line.journalNo}
                      </Text>
                      <Text className="w-[90px] text-xs font-mono text-muted-foreground">
                        {line.tanggal}
                      </Text>
                      <Text className="w-[125px] text-xs font-semibold font-mono" numberOfLines={1}>
                        {line.refNo}
                      </Text>
                      <Pressable
                        onPress={() => onSelectAccount(line.kodeAkun)}
                        className="w-[75px]"
                      >
                        <Text className="text-xs font-bold font-mono text-primary underline">
                          {line.kodeAkun}
                        </Text>
                      </Pressable>
                      <Text
                        className={`w-[220px] text-xs font-medium ${isCredit ? "pl-4 text-muted-foreground" : "text-foreground"}`}
                        numberOfLines={1}
                      >
                        {line.namaAkun}
                      </Text>
                      <Text className="flex-1 text-xs text-muted-foreground pr-3" numberOfLines={1}>
                        {line.keterangan}
                      </Text>
                      <Text className="w-[125px] text-xs font-mono text-right font-semibold">
                        {(line.debit ?? 0) > 0 ? rupiah(line.debit) : "-"}
                      </Text>
                      <Text className="w-[125px] text-xs font-mono text-right font-semibold text-info">
                        {(line.kredit ?? 0) > 0 ? rupiah(line.kredit) : "-"}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>

          {/* Pagination Footer */}
          {filteredJournal.length > 0 && (
            <View className="border-border/60 bg-card/60 flex-row flex-wrap items-center justify-between border-t px-4 py-3 gap-2">
              <View className="flex-row flex-wrap items-center gap-2">
                {setJournalPageSize ? (
                  <>
                    <Text className="text-xs text-muted-foreground">Tampilkan:</Text>
                    <View className="flex-row items-center gap-1">
                      {([10, 20, 30, 50, 100] as const).map((opt) => {
                        const active = JOURNAL_PAGE_SIZE === opt;
                        return (
                          <Pressable
                            key={opt}
                            onPress={() => setJournalPageSize(opt)}
                            className={`h-7 px-2 items-center justify-center rounded-md border ${
                              active
                                ? "bg-primary/15 border-primary"
                                : "bg-panel border-border/80 hover:bg-panel/80"
                            }`}
                          >
                            <Text
                              className={`text-xs ${
                                active ? "text-primary font-bold" : "text-muted-foreground font-medium"
                              }`}
                            >
                              {opt}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                ) : null}
                <Text className="text-xs text-muted-foreground">
                  ({(currentJournalPage - 1) * JOURNAL_PAGE_SIZE + 1}-{Math.min(currentJournalPage * JOURNAL_PAGE_SIZE, filteredJournal.length)} dari {filteredJournal.length} baris)
                </Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentJournalPage <= 1}
                  onPress={() => setJournalPage((p) => Math.max(1, p - 1))}
                  className="h-8 px-2.5 flex-row items-center gap-1"
                >
                  <ChevronLeft size={14} color={colors.text} />
                  <Text className="text-xs font-semibold">Prev</Text>
                </Button>
                <Text className="text-xs font-medium px-2">
                  Hal {currentJournalPage} / {totalJournalPages}
                </Text>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentJournalPage >= totalJournalPages}
                  onPress={() => setJournalPage((p) => Math.min(totalJournalPages, p + 1))}
                  className="h-8 px-2.5 flex-row items-center gap-1"
                >
                  <Text className="text-xs font-semibold">Next</Text>
                  <ChevronRight size={14} color={colors.text} />
                </Button>
              </View>
            </View>
          )}
        </View>
      </Panel>
    </View>
  );
}

