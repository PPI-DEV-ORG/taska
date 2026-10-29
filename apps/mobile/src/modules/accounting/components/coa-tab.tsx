import * as React from "react";
import { View, ScrollView, Pressable } from "react-native";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/taska/basics";
import { Plus, Search, ChevronLeft, ChevronRight, ArrowRight, Trash2 } from "lucide-react-native";
import { colors } from "@/tokens";
import { rupiah } from "@/lib/format";
import { CoaTrialBalanceRow } from "@/lib/accounting";
import { COA_CATEGORIES } from "../types";

interface CoaTabProps {
  onOpenCreateCoa: () => void;
  coaQuery: string;
  setCoaQuery: (v: string) => void;
  setCoaPage: React.Dispatch<React.SetStateAction<number>>;
  coaCategoryFilter: string;
  setCoaCategoryFilter: (v: string) => void;
  pagedCoa: CoaTrialBalanceRow[];
  filteredCoa: CoaTrialBalanceRow[];
  currentCoaPage: number;
  totalCoaPages: number;
  COA_PAGE_SIZE: number;
  setCoaPageSize?: (s: number) => void;
  onSelectLedger: (code: string) => void;
  onDeleteCoa: (acc: CoaTrialBalanceRow) => void;
}

export function CoaTab({
  onOpenCreateCoa,
  coaQuery,
  setCoaQuery,
  setCoaPage,
  coaCategoryFilter,
  setCoaCategoryFilter,
  pagedCoa,
  filteredCoa,
  currentCoaPage,
  totalCoaPages,
  COA_PAGE_SIZE,
  setCoaPageSize,
  onSelectLedger,
  onDeleteCoa,
}: CoaTabProps) {
  return (
    <View className="gap-4 w-full">
      <Panel
        title="Bagan Akun Standar & Saldo (Chart of Accounts / COA)"
        subtitle="Daftar master akun akuntansi resmi PT Ghina Multi Prima beserta mutasi dan saldo akhir"
        right={
          <Button size="sm" onPress={onOpenCreateCoa} className="gap-1.5 h-8">
            <Plus size={14} color={colors.background} />
            <Text className="text-xs font-semibold">+ Tambah Akun</Text>
          </Button>
        }
      >
        <View className="gap-3">
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <View className="flex-row items-center gap-2 flex-1 min-w-[240px]">
              <Search size={15} color={colors.textSecondary} />
              <Input
                value={coaQuery}
                onChangeText={(t) => {
                  setCoaQuery(t);
                  setCoaPage(1);
                }}
                placeholder="Cari kode akun atau nama akun..."
                className="flex-1 h-9 text-xs"
              />
            </View>
            <View className="flex-row flex-wrap gap-1.5">
              {["Semua", ...COA_CATEGORIES].map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => {
                    setCoaCategoryFilter(cat);
                    setCoaPage(1);
                  }}
                  className={
                    coaCategoryFilter === cat
                      ? "bg-primary/20 border-primary rounded-md border px-2.5 py-1"
                      : "bg-panel border-border rounded-md border px-2.5 py-1"
                  }
                >
                  <Text
                    className={
                      coaCategoryFilter === cat
                        ? "text-primary text-xs font-semibold"
                        : "text-muted-foreground text-xs"
                    }
                  >
                    {cat}
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
            <View className="min-w-full w-full gap-1">
              <View className="bg-panel border-border flex-row items-center border-b px-4 py-2.5 rounded-t-lg w-full">
                <Text className="w-[120px] text-xs font-bold">Kode</Text>
                <Text className="flex-1 min-w-[260px] text-xs font-bold">Nama Akun (COA)</Text>
                <Text className="w-[180px] text-xs font-bold">Kategori Pos</Text>
                <Text className="w-[110px] text-xs font-bold text-center">Saldo Normal</Text>
                <Text className="w-[130px] text-xs font-bold text-right pr-4">Mutasi Debit</Text>
                <Text className="w-[130px] text-xs font-bold text-right pr-4">Mutasi Kredit</Text>
                <Text className="w-[150px] text-xs font-bold text-right pr-8">Saldo Akhir</Text>
                <Text className="w-[190px] text-xs font-bold text-center pl-4">Aksi</Text>
              </View>
              {(pagedCoa || []).map((acc) => {
                if (!acc) return null;
                const code = String(acc.code ?? "");
                const name = String(acc.name ?? "");
                const category = String(acc.category ?? "");
                const normalBal = String(acc.normalBalance ?? "DEBIT");
                const depth = Number(acc.depth || 0);
                const isHeader = Boolean(acc.isHeader);
                return (
                  <View
                    key={`${code}-${name}`}
                    className={`border-border/60 flex-row items-center border-b px-4 py-2 hover:bg-panel/40 w-full ${
                      isHeader ? "bg-panel/50" : ""
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
                        {code}
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
                        {name}
                      </Text>
                      {acc.parentCode ? (
                        <View className="bg-muted/40 border-border/60 rounded border px-1.5 py-0.5">
                          <Text className="text-[10px] text-muted-foreground font-mono">
                            Sub {acc.parentCode}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text className="w-[180px] text-xs text-muted-foreground">{category}</Text>
                    <View className="w-[110px] items-center justify-center">
                      <View
                        className={`rounded-full px-2.5 py-0.5 border ${
                          normalBal === "DEBIT"
                            ? "bg-blue-500/10 border-blue-500/30"
                            : "bg-amber-500/10 border-amber-500/30"
                        }`}
                      >
                        <Text
                          className={`text-[10px] font-bold ${
                            normalBal === "DEBIT" ? "text-blue-600" : "text-amber-600"
                          }`}
                        >
                          {normalBal}
                        </Text>
                      </View>
                    </View>
                    <Text
                      className={`w-[130px] text-xs font-mono text-right pr-4 ${
                        isHeader ? "font-bold" : ""
                      }`}
                    >
                      {rupiah(acc.totalDebit)}
                    </Text>
                    <Text
                      className={`w-[130px] text-xs font-mono text-right pr-4 ${
                        isHeader ? "font-bold" : ""
                      }`}
                    >
                      {rupiah(acc.totalKredit)}
                    </Text>
                    <Text className="w-[150px] text-xs font-bold font-mono text-right text-primary pr-8">
                      {rupiah(acc.endingBalance)}
                    </Text>
                    <View className="w-[190px] flex-row items-center justify-center gap-2 pl-4">
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => onSelectLedger(code)}
                        className="h-7 px-2.5 flex-row items-center gap-1 border border-border/60"
                      >
                        <ArrowRight size={12} color={colors.primary} />
                        <Text className="text-[11px] text-primary font-medium">Buku Besar</Text>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => onDeleteCoa(acc)}
                        className="h-7 px-2 flex-row items-center gap-1 hover:bg-danger/10 border border-danger/30"
                      >
                        <Trash2 size={12} color={colors.danger} />
                        <Text className="text-[11px] text-danger font-medium">Hapus</Text>
                      </Button>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>

          {filteredCoa.length > 0 && (
            <View className="flex-row flex-wrap items-center justify-between border-t border-border/60 pt-3 px-1 gap-2">
              <View className="flex-row flex-wrap items-center gap-2">
                {setCoaPageSize ? (
                  <>
                    <Text className="text-xs text-muted-foreground">Tampilkan:</Text>
                    <View className="flex-row items-center gap-1">
                      {([10, 20, 30, 50, 100] as const).map((opt) => {
                        const active = COA_PAGE_SIZE === opt;
                        return (
                          <Pressable
                            key={opt}
                            onPress={() => setCoaPageSize(opt)}
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
                  ({(currentCoaPage - 1) * COA_PAGE_SIZE + 1}-{Math.min(currentCoaPage * COA_PAGE_SIZE, filteredCoa.length)} dari {filteredCoa.length} akun)
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
    </View>
  );
}

