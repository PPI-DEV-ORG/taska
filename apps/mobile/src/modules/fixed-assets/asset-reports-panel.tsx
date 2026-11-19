import * as React from "react";
import { View, ScrollView, Pressable, Platform } from "react-native";
import { Download, RefreshCw, BarChart3, Filter } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/taska/dialogs";
import { colors } from "@/tokens";
import { api, queryString } from "@/services/api";
import { rupiah, tanggal } from "@/lib/format";
import type { FaCategory } from "./types";

const REPORT_OPTIONS = [
  { value: "register", label: "1. Fixed Asset Register" },
  { value: "acquisition", label: "2. Asset Acquisition Report" },
  { value: "movement", label: "3. Asset Movement / Transfer Report" },
  { value: "assignment", label: "4. Asset Assignment Report" },
  { value: "depreciation", label: "5. Depreciation Schedule" },
  { value: "amortization", label: "6. Amortization Schedule (Intangible)" },
  { value: "valuation", label: "7. Asset Valuation Report" },
  { value: "book-value", label: "8. Net Book Value Report" },
  { value: "disposal", label: "9. Asset Disposal Report" },
  { value: "maintenance-cost", label: "10. Maintenance Cost by Asset" },
  { value: "physical-audit", label: "11. Physical Asset Audit Report" },
  { value: "tax-depreciation", label: "12. Commercial vs Tax Depreciation" },
] as const;

export function FixedAssetReportsPanel({ categories }: { categories: FaCategory[] }) {
  const [reportType, setReportType] = React.useState<string>("register");
  const [department, setDepartment] = React.useState<string>("");
  const [categoryId, setCategoryId] = React.useState<string>("");
  const [year, setYear] = React.useState<string>(String(new Date().getFullYear()));
  const [month, setMonth] = React.useState<string>("");

  const [loading, setLoading] = React.useState(false);
  const [reportData, setReportData] = React.useState<any[]>([]);

  const fetchReport = React.useCallback(async () => {
    await Promise.resolve();
    try {
      setLoading(true);
      const qs = queryString({
        department: department || undefined,
        categoryId: categoryId ? Number(categoryId) : undefined,
        year: year ? Number(year) : undefined,
        month: month ? Number(month) : undefined,
      });
      const res: any = await api.get(`/fixed-assets/reports/${reportType}${qs}`);
      setReportData(Array.isArray(res) ? res : res?.data || []);
    } catch {
      setReportData([]);
    } finally {
      setLoading(false);
    }
  }, [reportType, department, categoryId, year, month]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      void fetchReport();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchReport]);

  const handleExportCsv = () => {
    if (!reportData || reportData.length === 0) return;
    const first = reportData[0];
    const keys = Object.keys(first).filter((k) => typeof first[k] !== "object");
    const headerRow = keys.join(",");
    const rows = reportData.map((row) =>
      keys
        .map((k) => {
          const val = row[k] ?? "";
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(","),
    );
    const csvContent = [headerRow, ...rows].join("\n");

    if (Platform.OS === "web" && typeof window !== "undefined") {
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Fixed_Asset_${reportType}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const selectedReportStr =
    REPORT_OPTIONS.find((r) => r.value === reportType)?.label || REPORT_OPTIONS[0].label;

  const categoryOptions = [
    "-- Semua Kategori --",
    ...categories.map((c) => `${c.id} - ${c.name}`),
  ];

  return (
    <View className="gap-4 w-full">
      {/* Filters Bar */}
      <View className="bg-card rounded-2xl border border-border/80 p-4 gap-3 shadow-sm">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <BarChart3 size={16} color={colors.primary} />
            <Text className="text-sm font-bold text-foreground">
              12 Laporan Analitis Aset Tetap (PRD Bab 10)
            </Text>
          </View>
          <Button variant="outline" size="sm" onPress={handleExportCsv} disabled={reportData.length === 0}>
            <Download size={14} color={colors.primary} />
            <Text className="text-xs">Ekspor CSV</Text>
          </Button>
        </View>

        <View className="flex-row flex-wrap gap-2.5 items-center">
          <View className="flex-[2] min-w-[260px]">
            <SearchableSelect
              value={selectedReportStr}
              options={REPORT_OPTIONS.map((o) => `${o.value} - ${o.label}`)}
              onChange={(val) => {
                const valKey = val.split(" - ")[0] || "register";
                setReportType(valKey);
              }}
            />
          </View>

          <View className="flex-1 min-w-[180px]">
            <SearchableSelect
              value={categoryId ? categoryOptions.find((c) => c.startsWith(`${categoryId} -`)) || categoryId : "-- Semua Kategori --"}
              options={categoryOptions}
              onChange={(val) => {
                if (val.startsWith("--")) setCategoryId("");
                else setCategoryId(val.split(" - ")[0] || "");
              }}
            />
          </View>

          <View className="flex-1 min-w-[150px]">
            <SearchableSelect
              value={department || "-- Semua Departemen --"}
              options={["-- Semua Departemen --", "IT", "Operasional", "Finance", "HR", "Marketing", "Gudang", "Management"]}
              onChange={(val) => setDepartment(val.startsWith("--") ? "" : val)}
            />
          </View>

          <View className="w-[110px]">
            <SearchableSelect
              value={year}
              options={["2024", "2025", "2026", "2027"]}
              onChange={setYear}
            />
          </View>
        </View>
      </View>

      {/* Report Table Card */}
      <View className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
        <View className="flex-row items-center justify-between border-b border-border/70 bg-card px-4 py-3">
          <Text className="text-sm font-bold text-foreground">
            Hasil Laporan: {reportData.length} Baris Data
          </Text>
          <Pressable onPress={fetchReport} hitSlop={8} className="p-1 hover:bg-muted/30 rounded-lg">
            <RefreshCw size={15} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: "100%" }}>
          <View className="min-w-[960px] flex-1">
            {/* Headers */}
            <View className="flex-row items-center border-b border-border/70 bg-muted/60 px-3.5 py-2.5">
              <Text className="w-[180px] text-[11px] font-bold uppercase text-muted-foreground">Kode / Dokumen</Text>
              <Text className="flex-[2] text-[11px] font-bold uppercase text-muted-foreground">Nama Aset / Keterangan</Text>
              <Text className="w-[160px] text-[11px] font-bold uppercase text-muted-foreground">Kategori / Lokasi</Text>
              <Text className="w-[160px] text-[11px] font-bold uppercase text-muted-foreground">Nilai Perolehan</Text>
              <Text className="w-[160px] text-[11px] font-bold uppercase text-muted-foreground">Nilai Buku / Beban</Text>
              <Text className="w-[120px] text-[11px] font-bold uppercase text-muted-foreground">Status / Kondisi</Text>
            </View>

            {/* Rows */}
            {loading ? (
              <View className="p-8 items-center">
                <Text className="text-sm text-muted-foreground">Memuat data laporan...</Text>
              </View>
            ) : reportData.length === 0 ? (
              <View className="p-8 items-center">
                <Text className="text-sm text-muted-foreground">Tidak ada data untuk filter yang dipilih.</Text>
              </View>
            ) : (
              <View className="divide-y divide-border/40">
                {reportData.map((row, idx) => (
                  <View key={idx} className="flex-row items-center px-3.5 py-3 hover:bg-muted/30">
                    <View className="w-[180px] pr-2">
                      <Text className="text-xs font-bold" style={{ color: colors.primary }}>
                        {row.assetCode || row.code || row.asset?.assetCode || "-"}
                      </Text>
                      <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                        {row.acquisitionDate ? tanggal(row.acquisitionDate) : row.transferDate ? tanggal(row.transferDate) : row.period || ""}
                      </Text>
                    </View>

                    <View className="flex-[2] pr-2">
                      <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
                        {row.name || row.asset?.name || row.assetName || row.title || "-"}
                      </Text>
                      <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                        {row.department ? `Dept: ${row.department}` : row.brand ? `Brand: ${row.brand}` : row.poNumber ? `PO: ${row.poNumber}` : ""}
                      </Text>
                    </View>

                    <View className="w-[160px] pr-2">
                      <Text className="text-xs text-foreground" numberOfLines={1}>
                        {row.category || row.asset?.category?.name || row.location || "-"}
                      </Text>
                      {row.assignedUser ? (
                        <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                          PIC: {row.assignedUser}
                        </Text>
                      ) : null}
                    </View>

                    <View className="w-[160px] pr-2">
                      <Text className="text-xs font-semibold text-foreground">
                        {row.acquisitionCost != null ? rupiah(row.acquisitionCost) : row.commercialDepreciation != null ? rupiah(row.commercialDepreciation) : "-"}
                      </Text>
                    </View>

                    <View className="w-[160px] pr-2">
                      <Text className="text-xs font-bold text-emerald-600">
                        {row.netBookValue != null
                          ? rupiah(row.netBookValue)
                          : row.depreciationAmount != null
                          ? rupiah(row.depreciationAmount)
                          : row.totalCost != null
                          ? rupiah(row.totalCost)
                          : row.fiscalDepreciation != null
                          ? rupiah(row.fiscalDepreciation)
                          : "-"}
                      </Text>
                    </View>

                    <View className="w-[120px]">
                      <Text className="text-xs font-medium text-muted-foreground">
                        {row.condition || row.status || (row.servicedCount ? `${row.servicedCount}x Servis` : "-")}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
