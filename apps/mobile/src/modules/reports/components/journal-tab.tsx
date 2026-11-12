import * as React from "react";
import { View, ScrollView, Pressable } from "react-native";
import { CheckCircle2, Search, ChevronLeft, ChevronRight } from "lucide-react-native";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/taska/basics";
import { DatePicker } from "@/components/taska/dialogs";
import { rupiah } from "@/lib/format";
import { colors } from "@/tokens";
import { Pill, ExportBar } from "./report-ui-helpers";
import type { DownloadFormat } from "../types";

interface JournalTabProps {
  fin: any;
  onDownload: (type: string, title: string, format: DownloadFormat) => void;
}

export function JournalTab({ fin, onDownload }: JournalTabProps) {
  const [journalQuery, setJournalQuery] = React.useState("");
  const [journalDate, setJournalDate] = React.useState("");
  const [journalSourceFilter, setJournalSourceFilter] = React.useState<string>("Semua");
  const [journalPage, setJournalPage] = React.useState(1);
  const [journalPageSize, setJournalPageSize] = React.useState<number>(30);

  const [coaQuery, setCoaQuery] = React.useState("");
  const [coaPage, setCoaPage] = React.useState(1);
  const [coaPageSize, setCoaPageSize] = React.useState<number>(20);

  const filteredJournal = React.useMemo(() => {
    return (fin.journalLines || []).filter((l: any) => {
      if (journalDate) {
        const target = journalDate.slice(0, 10);
        if (!l.tanggal?.startsWith(target)) return false;
      }
      if (journalSourceFilter !== "Semua") {
        if (journalSourceFilter === "Pengeluaran (Expense)") {
          if (l.sumber !== "Pengeluaran (Expense)") return false;
        } else if (journalSourceFilter === "Pembayaran Pengeluaran") {
          if (l.sumber !== "Pembayaran Pengeluaran" && l.sumber !== "Pembayaran Expense") return false;
        } else if (journalSourceFilter === "Reimburse") {
          if (
            l.sumber !== "Reimburse" &&
            l.sumber !== "Pembayaran Reimburse" &&
            l.kodeAkun !== "6202.08" &&
            !(l.keterangan || "").toLowerCase().includes("reimburse")
          ) {
            return false;
          }
        } else if (journalSourceFilter === "Pembayaran Reimburse") {
          if (l.sumber !== "Pembayaran Reimburse") return false;
        } else if (l.sumber !== journalSourceFilter) {
          return false;
        }
      }
      if (journalQuery.trim()) {
        const q = journalQuery.toLowerCase();
        return (
          (l.journalNo || "").toLowerCase().includes(q) ||
          (l.refNo || "").toLowerCase().includes(q) ||
          (l.keterangan || "").toLowerCase().includes(q) ||
          (l.namaAkun || "").toLowerCase().includes(q) ||
          (l.kodeAkun || "").toLowerCase().includes(q) ||
          (l.project || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [fin.journalLines, journalQuery, journalDate, journalSourceFilter]);

  const totalJournalPages = Math.max(1, Math.ceil(filteredJournal.length / journalPageSize));
  const currentJournalPage = Math.min(Math.max(1, journalPage), totalJournalPages);
  const pagedJournal = React.useMemo(() => {
    const start = (currentJournalPage - 1) * journalPageSize;
    return filteredJournal.slice(start, start + journalPageSize);
  }, [filteredJournal, currentJournalPage, journalPageSize]);

  const filteredCoa = React.useMemo(() => {
    return (fin.coaBalances || []).filter((acc: any) => {
      if (!acc) return false;
      if (!coaQuery.trim()) return true;
      const q = coaQuery.toLowerCase();
      return (
        (acc.code || "").toLowerCase().includes(q) ||
        (acc.name || "").toLowerCase().includes(q) ||
        (acc.category || "").toLowerCase().includes(q)
      );
    });
  }, [fin.coaBalances, coaQuery]);

  const totalCoaPages = Math.max(1, Math.ceil(filteredCoa.length / coaPageSize));
  const currentCoaPage = Math.min(Math.max(1, coaPage), totalCoaPages);
  const pagedCoa = React.useMemo(() => {
    const start = (currentCoaPage - 1) * coaPageSize;
    return filteredCoa.slice(start, start + coaPageSize);
  }, [filteredCoa, currentCoaPage, coaPageSize]);

  return (
    <View className="gap-5 w-full">
      <View className="bg-primary/10 border-primary/40 rounded-xl border p-4 flex-row flex-wrap items-center justify-between gap-3">
        <View className="flex-row items-center gap-3">
          <CheckCircle2 size={20} color={colors.primary} />
          <View>
            <Text className="text-sm font-bold">
              Verifikasi Jurnal Double-Entry: TOTAL DEBIT ({rupiah(fin.totalDebit)}) = TOTAL KREDIT ({rupiah(fin.totalKredit)})
            </Text>
            <Text className="text-xs text-text-secondary">
              {fin.journalLines.length} baris ayat jurnal otomatis dari Invoice, PO Supplier, dan Reimbursement Pengeluaran
            </Text>
          </View>
        </View>
        <ExportBar type="general-journal" title="Laporan Jurnal Umum" onDownload={onDownload} />
      </View>

      <Panel
        title="Bagan Akun Standar & Neraca Saldo (Chart of Accounts / COA)"
        subtitle="Rekapitulasi mutasi debit, kredit, dan saldo akhir per kode akun akuntansi"
      >
        <View className="gap-3">
          <View className="flex-row items-center gap-2 max-w-sm bg-card border border-border/80 rounded-xl px-3 h-10 shadow-sm">
            <Search size={15} color={colors.textSecondary} />
            <Input
              value={coaQuery}
              onChangeText={(t) => {
                setCoaQuery(t);
                setCoaPage(1);
              }}
              placeholder="Cari kode akun, nama, atau kategori..."
              className="flex-1 h-8 text-xs border-0 bg-transparent px-0 shadow-none"
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            contentContainerStyle={{ minWidth: "100%" }}
            className="w-full"
          >
            <View className="min-w-full w-full gap-1">
              <View className="bg-panel border-border flex-row items-center border-b px-4 py-2.5 rounded-t-lg w-full">
                <Text className="w-[120px] text-xs font-bold">Kode</Text>
                <Text className="flex-1 min-w-[260px] text-xs font-bold">Nama Akun (COA)</Text>
                <Text className="w-[180px] text-xs font-bold">Kategori</Text>
                <Text className="w-[110px] text-xs font-bold text-center">Saldo Normal</Text>
                <Text className="w-[140px] text-xs font-bold text-right pr-3">Mutasi Debit</Text>
                <Text className="w-[140px] text-xs font-bold text-right pr-3">Mutasi Kredit</Text>
                <Text className="w-[160px] text-xs font-bold text-right pr-4">Saldo Akhir</Text>
              </View>
              {pagedCoa.length === 0 ? (
                <View className="py-8 items-center justify-center">
                  <Text className="text-xs text-text-secondary">Tidak ada data akun COA</Text>
                </View>
              ) : (
                pagedCoa.map((acc: any) => {
                  const depth = Number(acc.depth || 0);
                  const isHeader = Boolean(acc.isHeader);
                  return (
                    <View
                      key={`${acc.code}-${acc.name}`}
                      className={`border-border/60 flex-row items-center border-b px-4 py-2 hover:bg-panel/40 w-full ${
                        isHeader ? "bg-panel/60" : ""
                      }`}
                    >
                      <View
                        style={{ paddingLeft: depth * 12 }}
                        className="w-[120px] flex-row items-center gap-1"
                      >
                        {depth > 0 ? (
                          <Text className="text-xs font-mono text-muted-foreground">↳</Text>
                        ) : null}
                        <Text
                          className={`text-xs font-mono ${
                            isHeader ? "font-bold text-primary" : "font-semibold text-primary/90"
                          }`}
                        >
                          {acc.code}
                        </Text>
                      </View>
                      <View
                        style={{ paddingLeft: depth * 16 }}
                        className="flex-1 min-w-[260px] flex-row items-center gap-2 pr-2"
                      >
                        {depth > 0 ? (
                          <View className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                        ) : null}
                        <Text
                          className={`text-xs ${
                            isHeader ? "font-bold text-foreground" : "font-medium text-foreground/90"
                          }`}
                        >
                          {acc.name}
                        </Text>
                        {acc.parentCode ? (
                          <View className="bg-muted/40 border-border/60 rounded border px-1.5 py-0.5">
                            <Text className="text-[10px] text-muted-foreground font-mono">
                              Sub {acc.parentCode}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text className="w-[180px] text-xs text-text-secondary">{acc.category}</Text>
                      <View className="w-[110px] items-center">
                        <Pill
                          label={acc.normalBalance}
                          tone={acc.normalBalance === "DEBIT" ? "info" : "primary"}
                        />
                      </View>
                      <Text
                        className={`w-[140px] text-xs font-mono text-right pr-3 ${
                          isHeader ? "font-bold" : ""
                        }`}
                      >
                        {rupiah(acc.totalDebit)}
                      </Text>
                      <Text
                        className={`w-[140px] text-xs font-mono text-right pr-3 ${
                          isHeader ? "font-bold" : ""
                        }`}
                      >
                        {rupiah(acc.totalKredit)}
                      </Text>
                      <Text className="w-[160px] text-xs font-bold font-mono text-right pr-4">
                        {rupiah(acc.endingBalance)}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>

          {/* Pagination Footer COA */}
          {filteredCoa.length > 0 && (
            <View className="border-border/60 bg-card/60 flex-row flex-wrap items-center justify-between border-t px-4 py-3 gap-2">
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className="text-xs text-text-secondary">Tampilkan:</Text>
                <View className="flex-row items-center gap-1">
                  {([10, 20, 50, 100] as const).map((opt) => {
                    const active = coaPageSize === opt;
                    return (
                      <Pressable
                        key={opt}
                        onPress={() => {
                          setCoaPageSize(opt);
                          setCoaPage(1);
                        }}
                        className={`h-7 px-2 items-center justify-center rounded-md border ${
                          active
                            ? "bg-primary/15 border-primary"
                            : "bg-panel border-border/80"
                        }`}
                      >
                        <Text
                          className={`text-xs ${
                            active ? "text-primary font-bold" : "text-text-secondary font-medium"
                          }`}
                        >
                          {opt}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text className="text-xs text-text-secondary">
                  ({(currentCoaPage - 1) * coaPageSize + 1}-
                  {Math.min(currentCoaPage * coaPageSize, filteredCoa.length)} dari{" "}
                  {filteredCoa.length} akun)
                </Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentCoaPage <= 1}
                  onPress={() => setCoaPage((p) => Math.max(1, p - 1))}
                  className="h-8 px-2.5 flex-row items-center gap-1"
                >
                  <ChevronLeft size={14} color={colors.text} />
                  <Text className="text-xs font-semibold">Prev</Text>
                </Button>
                <Text className="text-xs font-medium px-2">
                  Hal {currentCoaPage} / {totalCoaPages}
                </Text>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentCoaPage >= totalCoaPages}
                  onPress={() => setCoaPage((p) => Math.min(totalCoaPages, p + 1))}
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

      <Panel
        title="Buku Jurnal Umum (General Journal)"
        subtitle="Pencatatan kronologis ayat jurnal berpasangan (Debit & Kredit)"
      >
        <View className="gap-3">
          <View className="flex-row flex-wrap items-center justify-between gap-2.5">
            <View className="flex-row flex-wrap items-center gap-2 flex-1 min-w-[280px]">
              <View className="flex-row items-center gap-2 flex-1 min-w-[200px] bg-card border border-border/80 rounded-xl px-3 h-10 shadow-sm">
                <Search size={15} color={colors.textSecondary} />
                <Input
                  value={journalQuery}
                  onChangeText={(t) => {
                    setJournalQuery(t);
                    setJournalPage(1);
                  }}
                  placeholder="Cari nomor jurnal, referensi, akun, atau keterangan..."
                  className="flex-1 h-8 text-xs border-0 bg-transparent px-0 shadow-none"
                />
              </View>
              <View className="w-full sm:w-auto">
                <DatePicker
                  value={journalDate}
                  onChange={(d) => {
                    setJournalDate(d);
                    setJournalPage(1);
                  }}
                  placeholder="Filter tanggal..."
                  clearable
                  className="h-10 min-w-[160px] max-w-[220px] rounded-xl bg-card border-border/80 shadow-sm px-3"
                />
              </View>
            </View>
            <View className="flex-row flex-wrap gap-1.5">
              {[
                "Semua",
                "Faktur Pelanggan",
                "Pembayaran Faktur",
                "PO Pemasok",
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
                        : "text-text-secondary text-xs"
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
              <View className="bg-panel border-border flex-row items-center border-b px-4 py-2.5 rounded-t-lg w-full">
                <Text className="w-[145px] text-xs font-bold">No. Jurnal</Text>
                <Text className="w-[115px] text-xs font-bold">Tanggal & Waktu</Text>
                <Text className="w-[170px] text-xs font-bold pr-2">Referensi</Text>
                <Text className="w-[95px] text-xs font-bold pr-2">Akun</Text>
                <Text className="w-[220px] text-xs font-bold">Nama Akun</Text>
                <Text className="flex-1 min-w-[220px] text-xs font-bold">Uraian / Keterangan</Text>
                <Text className="w-[135px] text-xs font-bold text-right pr-2">Debit (Rp)</Text>
                <Text className="w-[135px] text-xs font-bold text-right pr-2">Kredit (Rp)</Text>
              </View>
              {pagedJournal.length === 0 ? (
                <View className="py-8 items-center justify-center">
                  <Text className="text-xs text-text-secondary">Tidak ada data jurnal</Text>
                </View>
              ) : (
                pagedJournal.map((line: any) => {
                  if (!line) return null;
                  const isCredit = (line.kredit ?? 0) > 0 && (line.debit ?? 0) === 0;
                  return (
                    <View
                      key={line.id}
                      className="border-border/50 flex-row items-center border-b px-4 py-2 hover:bg-panel/40 w-full"
                    >
                      <Text className="w-[145px] text-xs font-mono text-text-secondary" numberOfLines={1}>
                        {line.journalNo}
                      </Text>
                      <Text className="w-[115px] text-xs font-mono text-text-secondary">
                        {line.tanggal}
                      </Text>
                      <Text className="w-[170px] text-xs font-semibold font-mono pr-2" numberOfLines={1}>
                        {line.refNo}
                      </Text>
                      <Text className="w-[95px] text-xs font-bold font-mono text-primary pr-2">
                        {line.kodeAkun}
                      </Text>
                      <Text
                        className={`w-[220px] text-xs font-medium ${isCredit ? "pl-4 text-text-secondary" : ""}`}
                        numberOfLines={1}
                      >
                        {line.namaAkun}
                      </Text>
                      <Text className="flex-1 min-w-[220px] text-xs text-text-secondary pr-3" numberOfLines={1}>
                        {line.keterangan}
                      </Text>
                      <Text className="w-[135px] text-xs font-mono text-right font-semibold pr-2">
                        {line.debit > 0 ? rupiah(line.debit) : "-"}
                      </Text>
                      <Text className="w-[135px] text-xs font-mono text-right font-semibold text-info pr-2">
                        {line.kredit > 0 ? rupiah(line.kredit) : "-"}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>

          {/* Pagination Footer Jurnal Umum */}
          {filteredJournal.length > 0 && (
            <View className="border-border/60 bg-card/60 flex-row flex-wrap items-center justify-between border-t px-4 py-3 gap-2">
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className="text-xs text-text-secondary">Tampilkan:</Text>
                <View className="flex-row items-center gap-1">
                  {([10, 20, 30, 50, 100] as const).map((opt) => {
                    const active = journalPageSize === opt;
                    return (
                      <Pressable
                        key={opt}
                        onPress={() => {
                          setJournalPageSize(opt);
                          setJournalPage(1);
                        }}
                        className={`h-7 px-2 items-center justify-center rounded-md border ${
                          active
                            ? "bg-primary/15 border-primary"
                            : "bg-panel border-border/80"
                        }`}
                      >
                        <Text
                          className={`text-xs ${
                            active ? "text-primary font-bold" : "text-text-secondary font-medium"
                          }`}
                        >
                          {opt}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text className="text-xs text-text-secondary">
                  ({(currentJournalPage - 1) * journalPageSize + 1}-
                  {Math.min(currentJournalPage * journalPageSize, filteredJournal.length)} dari{" "}
                  {filteredJournal.length} baris)
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

