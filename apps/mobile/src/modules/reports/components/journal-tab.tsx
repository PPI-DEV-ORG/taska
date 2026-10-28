import * as React from "react";
import { View, ScrollView, Pressable } from "react-native";
import { CheckCircle2, Search } from "lucide-react-native";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
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

  const filteredJournal = React.useMemo(() => {
    return fin.journalLines.filter((l: any) => {
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
          l.journalNo.toLowerCase().includes(q) ||
          l.refNo.toLowerCase().includes(q) ||
          l.keterangan.toLowerCase().includes(q) ||
          l.namaAkun.toLowerCase().includes(q) ||
          l.kodeAkun.toLowerCase().includes(q) ||
          l.project.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [fin.journalLines, journalQuery, journalDate, journalSourceFilter]);

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
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View className="min-w-[820px] w-full gap-1">
            <View className="bg-panel border-border flex-row items-center border-b px-3 py-2.5 rounded-t-lg">
              <Text className="w-[80px] text-xs font-bold">Kode</Text>
              <Text className="flex-1 text-xs font-bold">Nama Akun (COA)</Text>
              <Text className="w-[160px] text-xs font-bold">Kategori</Text>
              <Text className="w-[90px] text-xs font-bold text-center">Saldo Normal</Text>
              <Text className="w-[130px] text-xs font-bold text-right">Mutasi Debit</Text>
              <Text className="w-[130px] text-xs font-bold text-right">Mutasi Kredit</Text>
              <Text className="w-[140px] text-xs font-bold text-right">Saldo Akhir</Text>
            </View>
            {fin.coaBalances.map((acc: any) => (
              <View
                key={`${acc.code}-${acc.name}`}
                className="border-border/60 flex-row items-center border-b px-3 py-2"
              >
                <Text className="w-[80px] text-xs font-bold font-mono text-primary">
                  {acc.code}
                </Text>
                <Text className="flex-1 text-xs font-medium">{acc.name}</Text>
                <Text className="w-[160px] text-xs text-text-secondary">{acc.category}</Text>
                <View className="w-[90px] items-center">
                  <Pill
                    label={acc.normalBalance}
                    tone={acc.normalBalance === "DEBIT" ? "info" : "primary"}
                  />
                </View>
                <Text className="w-[130px] text-xs font-mono text-right">
                  {rupiah(acc.totalDebit)}
                </Text>
                <Text className="w-[130px] text-xs font-mono text-right">
                  {rupiah(acc.totalKredit)}
                </Text>
                <Text className="w-[140px] text-xs font-bold font-mono text-right">
                  {rupiah(acc.endingBalance)}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
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
                  onChangeText={setJournalQuery}
                  placeholder="Cari nomor jurnal, referensi, akun, atau keterangan..."
                  className="flex-1 h-8 text-xs border-0 bg-transparent px-0 shadow-none"
                />
              </View>
              <View className="w-full sm:w-auto">
                <DatePicker
                  value={journalDate}
                  onChange={setJournalDate}
                  placeholder="Filter tanggal..."
                  clearable
                  className="h-10 min-w-[160px] max-w-[220px] rounded-xl bg-card border-border/80 shadow-sm px-3"
                />
              </View>
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
                "Jurnal Manual",
              ].map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setJournalSourceFilter(s)}
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

          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View className="min-w-[960px] w-full gap-0.5">
              <View className="bg-panel border-border flex-row items-center border-b px-3 py-2.5 rounded-t-lg">
                <Text className="w-[85px] text-xs font-bold">No. Jurnal</Text>
                <Text className="w-[90px] text-xs font-bold">Tanggal</Text>
                <Text className="w-[125px] text-xs font-bold">Referensi</Text>
                <Text className="w-[75px] text-xs font-bold">Akun</Text>
                <Text className="w-[210px] text-xs font-bold">Nama Akun</Text>
                <Text className="flex-1 text-xs font-bold">Uraian / Keterangan</Text>
                <Text className="w-[125px] text-xs font-bold text-right">Debit (Rp)</Text>
                <Text className="w-[125px] text-xs font-bold text-right">Kredit (Rp)</Text>
              </View>
              {(filteredJournal || []).map((line: any) => {
                if (!line) return null;
                const isCredit = (line.kredit ?? 0) > 0 && (line.debit ?? 0) === 0;
                return (
                  <View
                    key={line.id}
                    className="border-border/50 flex-row items-center border-b px-3 py-2"
                  >
                    <Text className="w-[85px] text-xs font-mono text-text-secondary">
                      {line.journalNo}
                    </Text>
                    <Text className="w-[90px] text-xs font-mono text-text-secondary">
                      {line.tanggal}
                    </Text>
                    <Text className="w-[125px] text-xs font-semibold font-mono">
                      {line.refNo}
                    </Text>
                    <Text className="w-[75px] text-xs font-bold font-mono text-primary">
                      {line.kodeAkun}
                    </Text>
                    <Text
                      className={`w-[210px] text-xs font-medium ${isCredit ? "pl-4 text-text-secondary" : ""}`}
                      numberOfLines={1}
                    >
                      {line.namaAkun}
                    </Text>
                    <Text className="flex-1 text-xs text-text-secondary pr-3" numberOfLines={1}>
                      {line.keterangan}
                    </Text>
                    <Text className="w-[125px] text-xs font-mono text-right font-semibold">
                      {line.debit > 0 ? rupiah(line.debit) : "-"}
                    </Text>
                    <Text className="w-[125px] text-xs font-mono text-right font-semibold text-info">
                      {line.kredit > 0 ? rupiah(line.kredit) : "-"}
                    </Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </Panel>
    </View>
  );
}

