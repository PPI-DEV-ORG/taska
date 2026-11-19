import * as React from "react";
import { ScrollView, TextInput, View } from "react-native";
import { BellRing, Download, FileSpreadsheet, RefreshCw } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker, SearchableSelect } from "@/components/akuntra/dialogs";
import { Panel } from "@/components/akuntra/basics";
import { colors } from "@/tokens";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import { rupiah, tanggal } from "@/lib/format";
import type { ContractReportResponse, CtrType } from "./types";
import {
  CONTRACT_STATUS_OPTIONS,
  DEPARTMENT_OPTIONS,
  exportContractCsv,
} from "./contract-utils";

const REPORT_OPTIONS = [
  { value: "register", label: "1. Contract Register" },
  { value: "active", label: "2. Active Contract" },
  { value: "expired", label: "3. Expired Contract" },
  { value: "upcoming-expiration", label: "4. Upcoming Expiration" },
  { value: "renewal-approval", label: "5. Renewal Approval" },
  { value: "contract-value", label: "6. Contract Value" },
  { value: "vendor", label: "7. Vendor Contract" },
  { value: "service-agreement", label: "8. Service Agreement & SLA" },
  { value: "documents", label: "9. Document Register" },
  { value: "amendments", label: "10. Amendment History" },
  { value: "payment-commitments", label: "11. Payment Commitment" },
  { value: "by-department", label: "12. Contract by Department" },
] as const;

const REPORT_COLUMNS: Record<
  string,
  Array<{ key: string; label: string; type?: "currency" | "date" | "number" | "text" }>
> = {
  register: [
    { key: "contractNumber", label: "Kode CTR" },
    { key: "officialNumber", label: "Nomor Resmi" },
    { key: "title", label: "Judul Kontrak" },
    { key: "category", label: "Kategori" },
    { key: "counterpartyName", label: "Pihak Terkait" },
    { key: "department", label: "Departemen" },
    { key: "ownerName", label: "PIC Internal" },
    { key: "effectiveDate", label: "Mulai Berlaku", type: "date" },
    { key: "expirationDate", label: "Tanggal Berakhir", type: "date" },
    { key: "contractValue", label: "Nilai Kontrak", type: "currency" },
    { key: "status", label: "Status" },
    { key: "approvalStatus", label: "Approval" },
  ],
  active: [
    { key: "contractNumber", label: "Kode CTR" },
    { key: "title", label: "Judul Kontrak" },
    { key: "category", label: "Kategori" },
    { key: "counterpartyName", label: "Pihak Terkait" },
    { key: "department", label: "Departemen" },
    { key: "ownerName", label: "PIC Internal" },
    { key: "effectiveDate", label: "Mulai", type: "date" },
    { key: "expirationDate", label: "Berakhir", type: "date" },
    { key: "daysRemaining", label: "Sisa Hari", type: "number" },
    { key: "contractValue", label: "Nilai Kontrak", type: "currency" },
    { key: "status", label: "Status" },
  ],
  expired: [
    { key: "contractNumber", label: "Kode CTR" },
    { key: "title", label: "Judul Kontrak" },
    { key: "category", label: "Kategori" },
    { key: "counterpartyName", label: "Pihak Terkait" },
    { key: "department", label: "Departemen" },
    { key: "ownerName", label: "PIC Internal" },
    { key: "expirationDate", label: "Tanggal Berakhir", type: "date" },
    { key: "daysOverdue", label: "Lewat (Hari)", type: "number" },
    { key: "contractValue", label: "Nilai Kontrak", type: "currency" },
    { key: "status", label: "Status" },
  ],
  "upcoming-expiration": [
    { key: "contractNumber", label: "Kode CTR" },
    { key: "title", label: "Judul Kontrak" },
    { key: "category", label: "Kategori" },
    { key: "counterpartyName", label: "Pihak Terkait" },
    { key: "department", label: "Departemen" },
    { key: "ownerName", label: "PIC Internal" },
    { key: "renewalDate", label: "Tgl Evaluasi Renewal", type: "date" },
    { key: "expirationDate", label: "Tanggal Berakhir", type: "date" },
    { key: "daysLeft", label: "Sisa Hari", type: "number" },
    { key: "isAutoRenewal", label: "Auto-Renewal" },
    { key: "contractValue", label: "Nilai Kontrak", type: "currency" },
  ],
  "renewal-approval": [
    { key: "renewalCode", label: "Kode Renewal" },
    { key: "contractNumber", label: "Kode CTR" },
    { key: "title", label: "Judul Kontrak" },
    { key: "counterpartyName", label: "Pihak Terkait" },
    { key: "submissionDate", label: "Tgl Pengajuan", type: "date" },
    { key: "proposedPeriod", label: "Periode Baru" },
    { key: "previousValue", label: "Nilai Lama", type: "currency" },
    { key: "proposedValue", label: "Nilai Baru", type: "currency" },
    { key: "status", label: "Status" },
    { key: "submittedBy", label: "Diajukan Oleh" },
    { key: "reviewedBy", label: "Direview Oleh" },
  ],
  "contract-value": [
    { key: "contractNumber", label: "Kode CTR" },
    { key: "title", label: "Judul Kontrak" },
    { key: "category", label: "Kategori" },
    { key: "counterpartyName", label: "Pihak Terkait" },
    { key: "valueType", label: "Tipe Nilai" },
    { key: "paymentFrequency", label: "Frekuensi" },
    { key: "baseAmount", label: "DPP", type: "currency" },
    { key: "taxAmount", label: "Pajak (PPN)", type: "currency" },
    { key: "totalAmount", label: "Total Nilai", type: "currency" },
    { key: "downPayment", label: "Uang Muka (DP)", type: "currency" },
    { key: "retention", label: "Retensi", type: "currency" },
    { key: "costCenter", label: "Cost Center" },
  ],
  vendor: [
    { key: "contractNumber", label: "Kode CTR" },
    { key: "officialNumber", label: "Nomor Resmi" },
    { key: "vendorName", label: "Nama Vendor / Supplier" },
    { key: "title", label: "Judul Kontrak" },
    { key: "category", label: "Kategori" },
    { key: "department", label: "Departemen" },
    { key: "effectiveDate", label: "Mulai", type: "date" },
    { key: "expirationDate", label: "Berakhir", type: "date" },
    { key: "paymentTerms", label: "Ketentuan Bayar" },
    { key: "contractValue", label: "Nilai Kontrak", type: "currency" },
    { key: "status", label: "Status" },
  ],
  "service-agreement": [
    { key: "contractNumber", label: "Kode CTR" },
    { key: "title", label: "Judul Perjanjian" },
    { key: "providerName", label: "Penyedia Layanan" },
    { key: "category", label: "Kategori" },
    { key: "serviceNames", label: "Daftar Layanan" },
    { key: "slaIndicators", label: "Ketentuan SLA" },
    { key: "effectiveDate", label: "Mulai", type: "date" },
    { key: "expirationDate", label: "Berakhir", type: "date" },
    { key: "contractValue", label: "Biaya Layanan", type: "currency" },
    { key: "status", label: "Status" },
  ],
  documents: [
    { key: "contractNumber", label: "Kode CTR" },
    { key: "contractTitle", label: "Judul Kontrak" },
    { key: "counterpartyName", label: "Pihak Terkait" },
    { key: "documentTitle", label: "Judul Dokumen" },
    { key: "documentCategory", label: "Kategori Dokumen" },
    { key: "currentVersion", label: "Versi Aktif" },
    { key: "isConfidential", label: "Kerahasiaan" },
    { key: "isLocked", label: "Status Kunci" },
    { key: "signedDate", label: "Tanggal TTD", type: "date" },
    { key: "uploadedBy", label: "Diunggah Oleh" },
  ],
  amendments: [
    { key: "amendmentNumber", label: "Nomor Addendum" },
    { key: "amendmentDate", label: "Tanggal", type: "date" },
    { key: "contractNumber", label: "Kode CTR" },
    { key: "contractTitle", label: "Judul Kontrak" },
    { key: "counterpartyName", label: "Pihak Terkait" },
    { key: "amendmentTitle", label: "Judul Addendum" },
    { key: "description", label: "Uraian Perubahan" },
    { key: "valueAdjustment", label: "Penyesuaian Nilai", type: "currency" },
    { key: "newExpirationDate", label: "Tgl Berakhir Baru", type: "date" },
  ],
  "payment-commitments": [
    { key: "contractNumber", label: "Kode CTR" },
    { key: "contractTitle", label: "Judul Kontrak" },
    { key: "counterpartyName", label: "Pihak Terkait" },
    { key: "department", label: "Departemen" },
    { key: "milestoneName", label: "Termin / Milestone" },
    { key: "dueDate", label: "Jatuh Tempo", type: "date" },
    { key: "totalAmount", label: "Nominal Komitmen", type: "currency" },
    { key: "paymentStatus", label: "Status" },
    { key: "paidDate", label: "Tanggal Realisasi", type: "date" },
  ],
  "by-department": [
    { key: "department", label: "Departemen" },
    { key: "totalContracts", label: "Total Kontrak", type: "number" },
    { key: "activeContracts", label: "Kontrak Aktif", type: "number" },
    { key: "expiringSoon", label: "Mendekati Berakhir", type: "number" },
    { key: "expired", label: "Expired", type: "number" },
    { key: "totalValue", label: "Total Nilai Kontrak", type: "currency" },
  ],
};

type Props = {
  types: CtrType[];
  onRefresh: () => void;
};

export function ContractReportsPanel({ types, onRefresh }: Props) {
  const { toast } = useApp();
  const [reportKey, setReportKey] = React.useState("register");
  const [report, setReport] = React.useState<ContractReportResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [reminderBusy, setReminderBusy] = React.useState(false);

  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [typeId, setTypeId] = React.useState("");
  const [department, setDepartment] = React.useState("");
  const [counterpartyName, setCounterpartyName] = React.useState("");
  const [status, setStatus] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (typeId) params.set("typeId", typeId);
      if (department) params.set("department", department);
      if (counterpartyName.trim()) params.set("counterpartyName", counterpartyName.trim());
      if (status) params.set("status", status);
      const qs = params.toString();
      const res = await api.get<ContractReportResponse>(
        `/contracts/reports/${reportKey}${qs ? `?${qs}` : ""}`,
      );
      setReport(res);
    } catch (e: any) {
      toast(e?.message ?? "Gagal memuat laporan kontrak", "danger");
    } finally {
      setLoading(false);
    }
  }, [counterpartyName, dateFrom, dateTo, department, reportKey, status, toast, typeId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function runReminders() {
    setReminderBusy(true);
    try {
      const res = await api.post<{ sentCount: number; asOfDate: string }>(
        "/contracts/reminders/run",
        {},
      );
      toast(`${res.sentCount} notifikasi reminder kontrak diproses untuk ${res.asOfDate}`);
      onRefresh();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menjalankan reminder kontrak", "danger");
    } finally {
      setReminderBusy(false);
    }
  }

  const columns = REPORT_COLUMNS[reportKey] ?? REPORT_COLUMNS.register!;

  function formatCell(val: any, cellType?: string) {
    if (val === null || val === undefined || val === "") return "-";
    if (cellType === "currency") return rupiah(Number(val));
    if (cellType === "number") return Number(val).toLocaleString("id-ID");
    if (cellType === "date") {
      const s = String(val);
      return s === "-" ? "-" : tanggal(s);
    }
    return String(val);
  }

  return (
    <View className="gap-3">
      <Panel
        title="Laporan Analitik Contract Management"
        subtitle="12 laporan standar PRD: Register, Expiration, Renewal, Komitmen Finansial, Vendor, SLA, Dokumen & Addendum"
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
              <Text className="text-[11px]">
                {reminderBusy ? "Memproses..." : "Jalankan Reminder (H-90 s/d H+1)"}
              </Text>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onPress={load}
              disabled={loading}
            >
              <RefreshCw size={13} color={colors.primary} />
              <Text className="text-[11px]">{loading ? "Memuat..." : "Muat Ulang"}</Text>
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onPress={() =>
                report &&
                exportContractCsv(`contract-${report.reportType}`, columns, report.rows, toast)
              }
              disabled={!report || report.rows.length === 0}
            >
              <Download size={13} color="#fff" />
              <Text className="text-[11px] text-white">Export CSV</Text>
            </Button>
          </View>
        }
      >
        <View className="gap-3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Tabs value={reportKey} onValueChange={setReportKey}>
              <TabsList className="flex-row flex-wrap">
                {REPORT_OPTIONS.map((opt) => (
                  <TabsTrigger key={opt.value} value={opt.value}>
                    <Text className="text-[11px]">{opt.label}</Text>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </ScrollView>

          {/* Filter Bar */}
          <View className="flex-row flex-wrap gap-2">
            <View className="min-w-[145px] flex-1">
              <Text className="mb-1 text-[11px] font-semibold text-muted-foreground">
                Dari Tanggal
              </Text>
              <DatePicker value={dateFrom} onChange={setDateFrom} clearable placeholder="Semua" />
            </View>
            <View className="min-w-[145px] flex-1">
              <Text className="mb-1 text-[11px] font-semibold text-muted-foreground">
                Sampai Tanggal
              </Text>
              <DatePicker value={dateTo} onChange={setDateTo} clearable placeholder="Semua" />
            </View>
            <View className="min-w-[170px] flex-1">
              <Text className="mb-1 text-[11px] font-semibold text-muted-foreground">
                Kategori Kontrak
              </Text>
              <SearchableSelect
                value={
                  typeId
                    ? types.find((t) => String(t.id) === typeId)?.name ?? ""
                    : ""
                }
                options={types.map((t) => `${t.id} - ${t.name}`)}
                onChange={(val) => setTypeId(val ? val.split(" - ")[0] ?? "" : "")}
                placeholder="Semua kategori"
                clearable
                className="h-10 rounded-lg border-border/80 bg-card"
              />
            </View>
            <View className="min-w-[160px] flex-1">
              <Text className="mb-1 text-[11px] font-semibold text-muted-foreground">
                Departemen
              </Text>
              <SearchableSelect
                value={department}
                options={DEPARTMENT_OPTIONS}
                onChange={setDepartment}
                placeholder="Semua departemen"
                clearable
                className="h-10 rounded-lg border-border/80 bg-card"
              />
            </View>
            <View className="min-w-[150px] flex-1">
              <Text className="mb-1 text-[11px] font-semibold text-muted-foreground">
                Vendor / Pelanggan
              </Text>
              <TextInput
                value={counterpartyName}
                onChangeText={setCounterpartyName}
                placeholder="Cari pihak terkait..."
                className="h-10 rounded-lg border border-border bg-background px-3 text-xs text-foreground"
              />
            </View>
            <View className="min-w-[150px] flex-1">
              <Text className="mb-1 text-[11px] font-semibold text-muted-foreground">
                Status Kontrak
              </Text>
              <SearchableSelect
                value={
                  status
                    ? CONTRACT_STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status
                    : ""
                }
                options={CONTRACT_STATUS_OPTIONS.filter((s) => s.value !== "").map((s) => s.label)}
                onChange={(label) => {
                  const found = CONTRACT_STATUS_OPTIONS.find((s) => s.label === label);
                  setStatus(found?.value ?? "");
                }}
                placeholder="Semua status"
                clearable
                className="h-10 rounded-lg border-border/80 bg-card"
              />
            </View>
          </View>

          {report ? (
            <>
              <View className="flex-row flex-wrap gap-2">
                <View className="min-w-[130px] flex-1 rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                  <Text className="text-[10px] uppercase text-muted-foreground">Jumlah Baris</Text>
                  <Text className="text-sm font-bold">{report.totalRows}</Text>
                </View>
                <View className="min-w-[180px] flex-1 rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                  <Text className="text-[10px] uppercase text-muted-foreground">
                    Total Nilai / Komitmen
                  </Text>
                  <Text className="text-sm font-bold text-primary">
                    {rupiah(report.totalValue)}
                  </Text>
                </View>
              </View>

              <View className="overflow-hidden rounded-xl border border-border/80 bg-card">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View>
                    <View className="flex-row items-center border-b border-border/70 bg-muted/60 px-3 py-2">
                      {columns.map((col) => (
                        <View key={col.key} style={{ minWidth: 145 }} className="px-2">
                          <Text className="text-[11px] font-bold text-muted-foreground">
                            {col.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                    {report.rows.length === 0 ? (
                      <View className="items-center justify-center py-8">
                        <Text className="text-xs text-muted-foreground">
                          Tidak ada data untuk filter laporan ini
                        </Text>
                      </View>
                    ) : (
                      <View className="divide-y divide-border/40">
                        {report.rows.map((row, idx) => (
                          <View key={idx} className="flex-row items-center px-3 py-2.5">
                            {columns.map((col) => (
                              <View key={col.key} style={{ minWidth: 145 }} className="px-2">
                                <Text className="text-xs" numberOfLines={3}>
                                  {formatCell(row[col.key], col.type)}
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
            </>
          ) : null}
        </View>
      </Panel>
    </View>
  );
}
