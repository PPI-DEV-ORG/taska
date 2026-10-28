import * as React from "react";
import { View, ScrollView } from "react-native";
import { Text } from "@/components/ui/text";
import { Panel } from "@/components/taska/basics";
import { SearchableSelect, DatePicker } from "@/components/taska/dialogs";
import { rupiah } from "@/lib/format";

interface LedgerTabProps {
  selectedAcc: any;
  selectedLedgerCode: string;
  setSelectedLedgerCode: (v: string) => void;
  ledgerDate?: string;
  setLedgerDate?: (v: string) => void;
  fin: any;
  ledgerLines: any[];
}

export function LedgerTab({
  selectedAcc,
  selectedLedgerCode,
  setSelectedLedgerCode,
  ledgerDate,
  setLedgerDate,
  fin,
  ledgerLines,
}: LedgerTabProps) {
  return (
    <View className="gap-4 w-full">
      <Panel
        title={`Buku Besar (General Ledger): [${selectedAcc?.code}] ${selectedAcc?.name}`}
        subtitle={`Kategori: ${selectedAcc?.category} · Saldo Normal: ${selectedAcc?.normalBalance} · Total ${ledgerLines.length} Mutasi Transaksi`}
        right={
          <View className="flex-row flex-wrap items-center gap-2">
            <View className="w-56 sm:w-64">
              <SearchableSelect
                value={selectedLedgerCode ? `[${selectedLedgerCode}] ${selectedAcc?.name}` : ""}
                options={fin.coaBalances.map((a: any) => `[${a.code}] ${a.name}`)}
                onChange={(val) => {
                  const m = val.match(/\[(\w+)\]/);
                  if (m && m[1]) setSelectedLedgerCode(m[1]);
                }}
                placeholder="Pilih Akun Buku Besar..."
              />
            </View>
            {setLedgerDate ? (
              <DatePicker
                value={ledgerDate}
                onChange={setLedgerDate}
                placeholder="Filter tanggal..."
                clearable
                className="h-10 min-w-[150px] max-w-[200px] rounded-xl bg-card border-border/80 shadow-sm px-3"
              />
            ) : null}
          </View>
        }
      >
        <View className="gap-3">
          {/* Account Quick Card */}
          <View className="bg-panel border-border rounded-xl border p-4 flex-row flex-wrap justify-between items-center gap-3">
            <View className="gap-0.5">
              <Text className="text-sm font-bold text-foreground">
                [{selectedAcc?.code}] {selectedAcc?.name}
              </Text>
              <Text className="text-xs text-muted-foreground">
                Kelompok: {selectedAcc?.category} · Saldo Normal: {selectedAcc?.normalBalance}
              </Text>
            </View>
            <View className="flex-row items-center gap-4">
              <View className="text-right items-end">
                <Text className="text-[10px] text-muted-foreground uppercase font-semibold">Total Mutasi Debit</Text>
                <Text className="text-xs font-bold font-mono">
                  {rupiah(ledgerLines.reduce((s, l) => s + l.debit, 0))}
                </Text>
              </View>
              <View className="text-right items-end">
                <Text className="text-[10px] text-muted-foreground uppercase font-semibold">Total Mutasi Kredit</Text>
                <Text className="text-xs font-bold font-mono text-info">
                  {rupiah(ledgerLines.reduce((s, l) => s + l.kredit, 0))}
                </Text>
              </View>
              <View className="bg-primary/10 border-primary/30 border rounded-lg px-3 py-1.5 items-end">
                <Text className="text-[10px] text-primary uppercase font-bold">Saldo Akhir Berjalan</Text>
                <Text className="text-sm font-black font-mono text-primary">
                  {rupiah(ledgerLines.length > 0 ? (ledgerLines[ledgerLines.length - 1]?.runningBalance ?? 0) : 0)}
                </Text>
              </View>
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
                <Text className="w-[130px] text-xs font-bold">Sumber Transaksi</Text>
                <Text className="flex-1 text-xs font-bold">Uraian / Keterangan</Text>
                <Text className="w-[115px] text-xs font-bold text-right">Debit (Rp)</Text>
                <Text className="w-[115px] text-xs font-bold text-right">Kredit (Rp)</Text>
                <Text className="w-[130px] text-xs font-bold text-right">Saldo Berjalan</Text>
              </View>
              {ledgerLines.length === 0 ? (
                <View className="py-12 items-center justify-center">
                  <Text className="text-xs text-muted-foreground">
                    Belum ada mutasi pembukuan pada akun [{selectedAcc?.code}] {selectedAcc?.name}.
                  </Text>
                </View>
              ) : (
                (ledgerLines || []).map((l) => {
                  if (!l) return null;
                  return (
                    <View
                      key={l.id}
                      className="border-border/50 flex-row items-center border-b px-3 py-2 hover:bg-panel/40"
                    >
                      <Text className="w-[85px] text-xs font-mono text-muted-foreground">
                        {l.journalNo}
                      </Text>
                      <Text className="w-[90px] text-xs font-mono text-muted-foreground">
                        {l.tanggal}
                      </Text>
                      <Text className="w-[125px] text-xs font-semibold font-mono" numberOfLines={1}>
                        {l.refNo}
                      </Text>
                      <Text className="w-[130px] text-xs text-muted-foreground" numberOfLines={1}>
                        {l.sumber}
                      </Text>
                      <Text className="flex-1 text-xs text-foreground pr-3" numberOfLines={1}>
                        {l.keterangan}
                      </Text>
                      <Text className="w-[115px] text-xs font-mono text-right font-semibold">
                        {l.debit > 0 ? rupiah(l.debit) : "-"}
                      </Text>
                      <Text className="w-[115px] text-xs font-mono text-right font-semibold text-info">
                        {l.kredit > 0 ? rupiah(l.kredit) : "-"}
                      </Text>
                      <Text className="w-[130px] text-xs font-bold font-mono text-right text-primary">
                        {rupiah(l.runningBalance)}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
        </View>
      </Panel>
    </View>
  );
}

