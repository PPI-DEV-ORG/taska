import * as React from "react";
import { ScrollView, TextInput, View } from "react-native";
import { BellRing, Download, FileSpreadsheet, RefreshCw } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker, SearchableSelect } from "@/components/taska/dialogs";
import { Panel } from "@/components/taska/basics";
import { colors } from "@/tokens";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import { rupiah, tanggal } from "@/lib/format";
import type { SubCategory, SubProvider, SubscriptionReport } from "./types";
import { exportSubscriptionCsv } from "./subscription-utils";

const REPORT_LABEL_MAP: Record<string, string> = {
  totalSubscriptions: "Total Langganan",
  totalCost: "Total Biaya Perolehan",
  totalMrc: "Total MRC",
  totalArc: "Total ARC",
  totalAmount: "Total Nilai",
  postedAmount: "Telah Diamortisasi",
  pendingReview: "Menunggu Review",
  activeButUnused: "Aktif Tidak Terpakai",
};

const REPORT_OPTIONS = [
  { value: "register", label: "Register Langganan" },
  { value: "mrc", label: "Monthly Recurring Cost (MRC)" },
  { value: "arc", label: "Annual Recurring Cost (ARC)" },
  { value: "department", label: "Biaya per Departemen" },
  { value: "provider", label: "Biaya per Provider" },
  { value: "category", label: "Biaya per Kategori" },
  { value: "renewal-forecast", label: "Forecast Renewal 12 Bulan" },
  { value: "payment-history", label: "Riwayat Pembayaran" },
  { value: "price-change", label: "Riwayat Perubahan Harga" },
  { value: "prepaid", label: "Prepaid Expense Schedule" },
  { value: "cancellation", label: "Laporan Pembatalan" },
  { value: "utilization", label: "Laporan Utilisasi" },
];

type Props = {
  categories: SubCategory[];
  providers: SubProvider[];
  onRefresh: () => void;
};

export function SubscriptionReportsPanel({ categories, providers, onRefresh }: Props) {
  const { toast } = useApp();
  const [type, setType] = React.useState("register");
  const [report, setReport] = React.useState<SubscriptionReport | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [department, setDepartment] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [providerId, setProviderId] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [reminderBusy, setReminderBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      if (department.trim()) params.set("department", department.trim());
      if (categoryId) params.set("categoryId", categoryId);
      if (providerId) params.set("providerId", providerId);
      if (status) params.set("status", status);
      const query = params.toString();
      const data = await api.get<SubscriptionReport>(
        `/subscriptions/reports/${type}${query ? `?${query}` : ""}`,
      );
      setReport(data);
    } catch (e: any) {
      toast(e?.message ?? "Gagal memuat laporan", "danger");
    } finally {
      setLoading(false);
    }
  }, [categoryId, department, fromDate, providerId, status, toDate, toast, type]);

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  async function runReminders() {
    setReminderBusy(true);
    try {
      const result = await api.post<{ createdCount: number; asOfDate: string }>(
        "/subscriptions/reminders/run",
        {},
      );
      toast(`${result.createdCount} reminder renewal dibuat untuk ${result.asOfDate}`);
      onRefresh();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menjalankan reminder", "danger");
    } finally {
      setReminderBusy(false);
    }
  }

  async function exportReport() {
    if (!report) return;
    await exportSubscriptionCsv(
      `subscription-${report.type}`,
      report.columns,
      report.rows,
      toast,
    );
  }

  function formatCell(value: any, cellType?: string) {
    if (value == null || value === "") return "-";
    if (cellType === "currency") return rupiah(Number(value));
    if (cellType === "number") return Number(value).toLocaleString("id-ID");
    if (cellType === "date") return tanggal(String(value));
    if (cellType === "boolean") return value ? "Ya" : "Tidak";
    return String(value);
  }

  return (
    <View className="gap-3">
      <Panel
        title="Laporan Subscription"
        subtitle="12 laporan recurring cost, renewal, pembayaran, prepaid, pembatalan, dan utilisasi"
        icon={FileSpreadsheet}
        right={
          <View className="flex-row flex-wrap items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onPress={runReminders}
              disabled={reminderBusy}
            >
              <BellRing size={13} color={colors.primary} />
              <Text className="text-[11px]">{reminderBusy ? "Menjalankan..." : "Reminder Renewal"}</Text>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onPress={load} disabled={loading}>
              <RefreshCw size={13} color={colors.primary} />
              <Text className="text-[11px]">{loading ? "Memuat..." : "Muat Ulang"}</Text>
            </Button>
            <Button size="sm" className="gap-1.5" onPress={exportReport} disabled={!report || !report.rows.length}>
              <Download size={13} color="#fff" />
              <Text className="text-[11px]">Export CSV</Text>
            </Button>
          </View>
        }
      >
        <View className="gap-3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Tabs value={type} onValueChange={setType}>
              <TabsList className="flex-row flex-wrap">
                {REPORT_OPTIONS.map((option) => (
                  <TabsTrigger key={option.value} value={option.value}>
                    <Text className="text-[11px]">{option.label}</Text>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </ScrollView>

          <View className="flex-row flex-wrap gap-2">
            <View className="min-w-[150px] flex-1">
              <Text className="mb-1 text-[11px] font-semibold text-muted-foreground">Dari Tanggal</Text>
              <DatePicker value={fromDate} onChange={setFromDate} clearable placeholder="Semua" />
            </View>
            <View className="min-w-[150px] flex-1">
              <Text className="mb-1 text-[11px] font-semibold text-muted-foreground">Sampai Tanggal</Text>
              <DatePicker value={toDate} onChange={setToDate} clearable placeholder="Semua" />
            </View>
            <View className="min-w-[160px] flex-1">
              <Text className="mb-1 text-[11px] font-semibold text-muted-foreground">Kategori</Text>
              <SearchableSelect
                value={
                  categoryId
                    ? categories.find((c) => String(c.id) === categoryId)
                      ? `${categoryId} - ${categories.find((c) => String(c.id) === categoryId)!.name}`
                      : ""
                    : ""
                }
                options={categories.map((c) => `${c.id} - ${c.name}`)}
                onChange={(value) => setCategoryId(value ? value.split(" - ")[0] ?? "" : "")}
                placeholder="Semua kategori"
                clearable
                className="h-10 rounded-lg border-border/80 bg-card"
              />
            </View>
            <View className="min-w-[160px] flex-1">
              <Text className="mb-1 text-[11px] font-semibold text-muted-foreground">Provider</Text>
              <SearchableSelect
                value={
                  providerId
                    ? providers.find((p) => String(p.id) === providerId)
                      ? `${providerId} - ${providers.find((p) => String(p.id) === providerId)!.name}`
                      : ""
                    : ""
                }
                options={providers.map((p) => `${p.id} - ${p.name}`)}
                onChange={(value) => setProviderId(value ? value.split(" - ")[0] ?? "" : "")}
                placeholder="Semua provider"
                clearable
                className="h-10 rounded-lg border-border/80 bg-card"
              />
            </View>
            <View className="min-w-[150px] flex-1">
              <Text className="mb-1 text-[11px] font-semibold text-muted-foreground">Departemen</Text>
              <TextInput
                value={department}
                onChangeText={setDepartment}
                placeholder="Semua departemen"
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              />
            </View>
            <View className="min-w-[140px] flex-1">
              <Text className="mb-1 text-[11px] font-semibold text-muted-foreground">Status</Text>
              <TextInput
                value={status}
                onChangeText={setStatus}
                placeholder="Semua status"
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              />
            </View>
          </View>

          {report ? (
            <>
              <View className="flex-row flex-wrap gap-2">
                <View className="min-w-[110px] flex-1 rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                  <Text className="text-[10px] uppercase text-muted-foreground">Jumlah Baris</Text>
                  <Text className="text-sm font-bold">{report.rows.length}</Text>
                </View>
                {Object.entries(report.summary)
                  .filter(([key]) => key !== "totalRows" && key !== "column" && key !== "totalSubscriptions")
                  .slice(0, 5)
                  .map(([key, value]) => {
                    const isCurrency =
                      typeof value === "number" &&
                      /amount|mrc|arc|cost|allocated|posted/i.test(key) &&
                      !/count|rows|subscriptions|pending|active/i.test(key);
                    const label =
                      REPORT_LABEL_MAP[key] ??
                      key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
                    return (
                      <View key={key} className="min-w-[140px] flex-1 rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                        <Text className="text-[10px] uppercase text-muted-foreground">{label}</Text>
                        <Text className="text-sm font-bold">
                          {isCurrency
                            ? rupiah(value)
                            : typeof value === "number"
                              ? value.toLocaleString("id-ID")
                              : String(value)}
                        </Text>
                      </View>
                    );
                  })}
              </View>

              <View className="overflow-hidden rounded-xl border border-border/80 bg-card">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View>
                    <View className="flex-row items-center border-b border-border/70 bg-muted/60 px-3 py-2">
                      {report.columns.map((column) => (
                        <View key={column.key} style={{ minWidth: 140 }} className="px-2">
                          <Text className="text-[11px] font-bold text-muted-foreground">{column.label}</Text>
                        </View>
                      ))}
                    </View>
                    {report.rows.length === 0 ? (
                      <View className="items-center justify-center py-8">
                        <Text className="text-xs text-muted-foreground">Tidak ada data untuk filter ini</Text>
                      </View>
                    ) : (
                      <View className="divide-y divide-border/40">
                        {report.rows.map((row, rowIndex) => (
                          <View key={rowIndex} className="flex-row items-center px-3 py-2.5">
                            {report.columns.map((column) => (
                              <View key={column.key} style={{ minWidth: 140 }} className="px-2">
                                <Text className="text-xs" numberOfLines={3}>
                                  {formatCell(row[column.key], column.type)}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </ScrollView>
              </View>
              <Text className="text-[10px] text-muted-foreground">
                Dibuat {tanggal(report.generatedAt)} · sumber data Subscription Management
              </Text>
            </>
          ) : null}
        </View>
      </Panel>
    </View>
  );
}
