import React from "react";
import { View, ScrollView, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Text } from "@/components/ui/text";
import { Search, X, RefreshCw, Calendar, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react-native";
import { colors } from "@/tokens";
import { Button } from "@/components/ui/button";
import { formatRupiah, formatPeriodLabel } from "../types";

interface PayrollHistoryTabProps {
  historySearchQuery: string;
  setHistorySearchQuery: (v: string) => void;
  historyStatusFilter: string;
  setHistoryStatusFilter: (v: string) => void;
  historyPeriodFilter: string;
  setHistoryPeriodFilter: (v: string) => void;
  historyExpandedPeriods: { [period: string]: boolean };
  setHistoryExpandedPeriods: React.Dispatch<React.SetStateAction<{ [period: string]: boolean }>>;
  historyPagePerMonth: { [period: string]: number };
  setHistoryPagePerMonth: React.Dispatch<React.SetStateAction<{ [period: string]: number }>>;
  fetchHistorySlips: () => void;
  loadingHistory: boolean;
  availableHistoryPeriods: string[];
  groupedHistorySlips: any[];
  setSelectedSlip: (slip: any) => void;
}

export function PayrollHistoryTab({
  historySearchQuery,
  setHistorySearchQuery,
  historyStatusFilter,
  setHistoryStatusFilter,
  historyPeriodFilter,
  setHistoryPeriodFilter,
  historyExpandedPeriods,
  setHistoryExpandedPeriods,
  historyPagePerMonth,
  setHistoryPagePerMonth,
  fetchHistorySlips,
  loadingHistory,
  availableHistoryPeriods,
  groupedHistorySlips,
  setSelectedSlip,
}: PayrollHistoryTabProps) {
  return (
    <View className="gap-4 w-full">
      {/* Filter Bar */}
      <View className="bg-card border-border/80 rounded-2xl border p-4 gap-3 shadow-sm">
        <View className="flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Bar */}
          <View className="bg-panel border-border/80 flex-1 flex-row items-center gap-2 rounded-lg border px-3 py-2">
            <Search size={14} color={colors.textSecondary} />
            <TextInput
              value={historySearchQuery}
              onChangeText={setHistorySearchQuery}
              placeholder="Cari nama karyawan atau periode (YYYY-MM)..."
              placeholderTextColor={colors.muted}
              className="flex-1 text-xs text-foreground p-0 outline-none"
            />
            {historySearchQuery ? (
              <Pressable onPress={() => setHistorySearchQuery("")}>
                <X size={14} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>

          {/* Status Pills & Refresh */}
          <View className="flex-row flex-wrap items-center gap-2">
            <View className="flex-row items-center gap-1.5">
              {["Semua", "PAID", "DRAFT"].map((st) => (
                <Pressable
                  key={st}
                  onPress={() => setHistoryStatusFilter(st)}
                  className={
                    historyStatusFilter === st
                      ? "bg-primary/20 border-primary rounded-md border px-2.5 py-1"
                      : "bg-panel border-border rounded-md border px-2.5 py-1"
                  }
                >
                  <Text
                    className={
                      historyStatusFilter === st
                        ? "text-primary text-xs font-semibold"
                        : "text-muted-foreground text-xs"
                    }
                  >
                    {st === "PAID" ? "Dibayar" : st === "DRAFT" ? "Draft" : "Semua Status"}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Button size="sm" variant="outline" onPress={fetchHistorySlips} className="gap-1.5 h-9 px-3">
              <RefreshCw size={13} className={loadingHistory ? "animate-spin" : ""} />
              <Text className="text-xs font-medium">Refresh</Text>
            </Button>
          </View>
        </View>

        {/* Sub-bar: Filter Periode Spesifik & Expand/Collapse */}
        {availableHistoryPeriods.length > 1 && (
          <View className="flex-row flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
            <View className="flex-row flex-wrap items-center gap-1.5">
              <Text className="text-xs text-muted-foreground mr-1">Filter Periode:</Text>
              <Pressable
                onPress={() => setHistoryPeriodFilter("Semua")}
                className={
                  historyPeriodFilter === "Semua"
                    ? "bg-primary rounded-md px-2.5 py-1"
                    : "bg-panel border border-border rounded-md px-2.5 py-1"
                }
              >
                <Text
                  className={
                    historyPeriodFilter === "Semua"
                      ? "text-white text-xs font-semibold"
                      : "text-muted-foreground text-xs"
                  }
                >
                  Semua Periode
                </Text>
              </Pressable>
              {availableHistoryPeriods.map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setHistoryPeriodFilter(p)}
                  className={
                    historyPeriodFilter === p
                      ? "bg-primary rounded-md px-2.5 py-1"
                      : "bg-panel border border-border rounded-md px-2.5 py-1"
                  }
                >
                  <Text
                    className={
                      historyPeriodFilter === p
                        ? "text-white text-xs font-semibold"
                        : "text-muted-foreground text-xs"
                    }
                  >
                    {formatPeriodLabel(p)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View className="flex-row items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onPress={() => {
                  const allExp: { [p: string]: boolean } = {};
                  availableHistoryPeriods.forEach((p) => {
                    allExp[p] = true;
                  });
                  setHistoryExpandedPeriods(allExp);
                }}
                className="h-7 px-2"
              >
                <Text className="text-[11px] text-muted-foreground">Buka Semua</Text>
              </Button>
              <Text className="text-muted-foreground text-xs">·</Text>
              <Button
                size="sm"
                variant="ghost"
                onPress={() => {
                  const allCol: { [p: string]: boolean } = {};
                  availableHistoryPeriods.forEach((p) => {
                    allCol[p] = false;
                  });
                  setHistoryExpandedPeriods(allCol);
                }}
                className="h-7 px-2"
              >
                <Text className="text-[11px] text-muted-foreground">Tutup Semua</Text>
              </Button>
            </View>
          </View>
        )}
      </View>

      {/* List Group per Bulan */}
      {loadingHistory ? (
        <View className="bg-card border-border/80 rounded-2xl border p-12 items-center justify-center shadow-sm">
          <ActivityIndicator size="small" />
        </View>
      ) : groupedHistorySlips.length === 0 ? (
        <View className="bg-card border-border/80 rounded-2xl border p-12 items-center justify-center shadow-sm">
          <Text className="text-xs text-muted-foreground">Belum ada riwayat slip gaji tercatat.</Text>
        </View>
      ) : (
        groupedHistorySlips.map((group, groupIdx) => {
          const isExpanded =
            historyExpandedPeriods[group.period] !== undefined
              ? historyExpandedPeriods[group.period]
              : (groupIdx === 0 || !!historySearchQuery.trim() || historyPeriodFilter !== "Semua");

          const HIST_PAGE_SIZE = 10;
          const page = historyPagePerMonth[group.period] || 1;
          const totalPages = Math.max(1, Math.ceil(group.slips.length / HIST_PAGE_SIZE));
          const currentPage = Math.min(Math.max(1, page), totalPages);
          const pagedSlips = group.slips.slice(
            (currentPage - 1) * HIST_PAGE_SIZE,
            currentPage * HIST_PAGE_SIZE
          );

          return (
            <View
              key={group.period}
              className="bg-card border-border/80 rounded-2xl border overflow-hidden shadow-sm"
            >
              {/* Header Group Bulan */}
              <Pressable
                onPress={() =>
                  setHistoryExpandedPeriods((prev) => ({
                    ...prev,
                    [group.period]: !isExpanded,
                  }))
                }
                className="hover:bg-panel/40 p-4 flex-row flex-wrap items-center justify-between gap-3 cursor-pointer transition-colors"
              >
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center border border-primary/20">
                    <Calendar size={18} color={colors.primary} />
                  </View>
                  <View>
                    <View className="flex-row items-center gap-2">
                      <Text className="text-sm font-bold text-foreground">
                        {formatPeriodLabel(group.period)}
                      </Text>
                      <View className="bg-panel border border-border/80 px-2 py-0.5 rounded">
                        <Text className="text-[11px] font-semibold text-muted-foreground">
                          {group.period}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-xs text-muted-foreground mt-0.5">
                      {group.slips.length} Karyawan · Total Bersih:{" "}
                      <Text className="text-success font-semibold">
                        {formatRupiah(group.totalNetSalary)}
                      </Text>
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center gap-3">
                  <View className="flex-row items-center gap-1.5">
                    {group.paidCount > 0 && (
                      <View className="bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded">
                        <Text className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          {group.paidCount} Dibayar
                        </Text>
                      </View>
                    )}
                    {group.draftCount > 0 && (
                      <View className="bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded">
                        <Text className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                          {group.draftCount} Draft
                        </Text>
                      </View>
                    )}
                  </View>
                  <View className="w-8 h-8 rounded-lg bg-panel border border-border/80 items-center justify-center">
                    {isExpanded ? (
                      <ChevronUp size={16} color={colors.textSecondary} />
                    ) : (
                      <ChevronDown size={16} color={colors.textSecondary} />
                    )}
                  </View>
                </View>
              </Pressable>

              {/* Table saat Expanded */}
              {isExpanded && (
                <View className="border-t border-border/70">
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ minWidth: "100%", width: "100%" }}
                    className="w-full"
                  >
                    <View className="w-full flex-1 min-w-full">
                      <View className="border-border/70 bg-card/60 flex-row items-center border-b px-4 py-3.5 w-full">
                        <Text style={{ flex: 1.8, minWidth: 160 }} className="text-muted-foreground text-xs font-semibold tracking-wider">Karyawan</Text>
                        <Text style={{ flex: 1, minWidth: 100 }} className="text-muted-foreground text-xs font-semibold tracking-wider">Tgl Dibayar</Text>
                        <Text style={{ flex: 1.1, minWidth: 100 }} className="text-muted-foreground text-xs font-semibold tracking-wider text-right">Gaji Pokok</Text>
                        <Text style={{ flex: 1.1, minWidth: 100 }} className="text-muted-foreground text-xs font-semibold tracking-wider text-right">Gross</Text>
                        <Text style={{ flex: 1, minWidth: 90 }} className="text-muted-foreground text-xs font-semibold tracking-wider text-right text-warning">PPh 21</Text>
                        <Text style={{ flex: 1, minWidth: 90 }} className="text-muted-foreground text-xs font-semibold tracking-wider text-right text-blue-500">BPJS</Text>
                        <Text style={{ flex: 1.2, minWidth: 110 }} className="text-muted-foreground text-xs font-semibold tracking-wider text-right text-success">Gaji Bersih</Text>
                        <Text style={{ flex: 0.9, minWidth: 80 }} className="text-muted-foreground text-xs font-semibold tracking-wider text-center">Status</Text>
                        <Text style={{ width: 90 }} className="text-muted-foreground text-xs font-semibold tracking-wider text-right">Aksi</Text>
                      </View>

                      {pagedSlips.map((row) => (
                        <View
                          key={row.id}
                          className="border-border/60 hover:bg-panel/40 flex-row items-center border-b px-4 py-3.5 transition-colors w-full"
                        >
                          <View style={{ flex: 1.8, minWidth: 160 }} className="pr-2">
                            <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                              {row.user?.name || `Karyawan #${row.userId}`}
                            </Text>
                            <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
                              {row.user?.role || "-"}
                            </Text>
                          </View>
                          <Text style={{ flex: 1, minWidth: 100 }} className="text-xs text-muted-foreground">
                            {row.paidAt ? String(row.paidAt).slice(0, 10) : "-"}
                          </Text>
                          <Text style={{ flex: 1.1, minWidth: 100 }} className="text-xs text-right text-foreground">
                            {formatRupiah(row.basicSalary)}
                          </Text>
                          <Text style={{ flex: 1.1, minWidth: 100 }} className="text-xs text-right text-foreground">
                            {formatRupiah(row.grossSalary)}
                          </Text>
                          <Text style={{ flex: 1, minWidth: 90 }} className="text-xs text-right text-warning font-semibold">
                            {formatRupiah(row.pph21)}
                          </Text>
                          <Text style={{ flex: 1, minWidth: 90 }} className="text-xs text-right text-blue-500 font-semibold">
                            {formatRupiah(row.bpjs)}
                          </Text>
                          <Text style={{ flex: 1.2, minWidth: 110 }} className="text-sm font-bold text-right text-success">
                            {formatRupiah(row.netSalary)}
                          </Text>
                          <View style={{ flex: 0.9, minWidth: 80 }} className="items-center">
                            <View
                              className={`rounded px-2.5 py-1 ${
                                row.status === "PAID"
                                  ? "bg-emerald-500/10 border border-emerald-500/30"
                                  : "bg-amber-500/10 border border-amber-500/30"
                              }`}
                            >
                              <Text
                                className={`text-xs font-bold ${
                                  row.status === "PAID"
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-amber-600 dark:text-amber-400"
                                }`}
                              >
                                {row.status === "PAID" ? "DIBAYAR" : "DRAFT"}
                              </Text>
                            </View>
                          </View>
                          <View style={{ width: 90 }} className="items-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onPress={() => setSelectedSlip(row)}
                              className="h-8 px-2.5"
                            >
                              <Text className="text-xs font-medium text-foreground">Lihat</Text>
                            </Button>
                          </View>
                        </View>
                      ))}
                    </View>
                  </ScrollView>

                  {/* Pagination Footer per Bulan */}
                  {group.slips.length > 0 && (
                    <View className="border-border/60 bg-card/60 flex-row flex-wrap items-center justify-between border-t px-4 py-3 gap-2">
                      <Text className="text-xs text-muted-foreground">
                        Menampilkan {(currentPage - 1) * HIST_PAGE_SIZE + 1} -{" "}
                        {Math.min(currentPage * HIST_PAGE_SIZE, group.slips.length)} dari{" "}
                        {group.slips.length} slip gaji (Hal {currentPage}/{totalPages})
                      </Text>
                      <View className="flex-row items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage <= 1}
                          onPress={() =>
                            setHistoryPagePerMonth((prev) => ({
                              ...prev,
                              [group.period]: Math.max(1, currentPage - 1),
                            }))
                          }
                          className="h-8 px-2.5 flex-row items-center gap-1"
                        >
                          <ChevronLeft size={14} color={colors.text} />
                          <Text className="text-xs font-medium">Sebelumnya</Text>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage >= totalPages}
                          onPress={() =>
                            setHistoryPagePerMonth((prev) => ({
                              ...prev,
                              [group.period]: Math.min(totalPages, currentPage + 1),
                            }))
                          }
                          className="h-8 px-2.5 flex-row items-center gap-1"
                        >
                          <Text className="text-xs font-medium">Selanjutnya</Text>
                          <ChevronRight size={14} color={colors.text} />
                        </Button>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

