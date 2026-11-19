import * as React from "react";
import { View, ScrollView, Pressable } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Download, FileText, Filter, RefreshCw } from "lucide-react-native";
import { SearchableSelect, DatePicker } from "@/components/taska/dialogs";
import { AssetSelect } from "@/components/taska/document-selects/asset-select";
import { colors } from "@/tokens";
import { formatRupiah, formatDate, exportMaintenanceReportCsv } from "../maintenance-utils";
import { api, queryString } from "@/services/api";
import type { MaintLookups } from "../types";

const REPORT_TYPE_OPTIONS = [
  "work_orders - 1. Laporan Work Order (Work Order Report)",
  "pm_schedule - 2. Laporan Jadwal Preventive (PM Schedule)",
  "corrective - 3. Laporan Kerusakan Aset (Corrective Request)",
  "maintenance_history - 4. Histori Servis Per Aset (History per Asset)",
  "cost_per_asset - 5. Laporan Biaya Servis Per Aset",
  "cost_per_department - 6. Laporan Biaya Servis Per Departemen",
  "spare_parts - 7. Laporan Pemakaian Spare Part",
  "vendor_service - 8. Laporan Biaya Servis Vendor Eksternal",
  "asset_downtime - 9. Laporan Downtime & Keandalan Aset",
  "overdue_maintenance - 10. Laporan Keterlambatan Servis (Overdue)",
];

export function MaintenanceReportsPanel({ lookups }: { lookups: MaintLookups }) {
  const [reportType, setReportType] = React.useState("work_orders");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [selectedAssetId, setSelectedAssetId] = React.useState<number | "">("");
  const [loading, setLoading] = React.useState(false);
  const [reportData, setReportData] = React.useState<any[]>([]);

  const fetchReport = React.useCallback(async () => {
    try {
      setLoading(true);
      const qs = queryString({
        reportType,
        from: from || undefined,
        to: to || undefined,
        assetId: selectedAssetId ? Number(selectedAssetId) : undefined,
      });
      const res: any = await api.get(`/maintenance/reports${qs}`);
      setReportData(res?.data || (Array.isArray(res) ? res : []));
    } catch {
      setReportData([]);
    } finally {
      setLoading(false);
    }
  }, [reportType, from, to, selectedAssetId]);

  React.useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) fetchReport();
    });
    return () => {
      active = false;
    };
  }, [fetchReport]);

  const handleExportCsv = () => {
    if (!reportData || reportData.length === 0) return;

    if (reportType === "pm_schedule") {
      exportMaintenanceReportCsv(
        "Preventive_Maintenance_Schedule_Report",
        [
          { header: "Nomor Jadwal", key: "scheduleNumber" },
          { header: "Aset", key: "assetName" },
          { header: "Rencana Servis", key: "planTitle" },
          { header: "Tanggal Dijadwalkan", key: "scheduledDate" },
          { header: "Teknisi", key: "picName" },
          { header: "Status", key: "status" },
        ],
        reportData.map((d) => ({
          scheduleNumber: d.scheduleNumber,
          assetName: d.asset?.name || "-",
          planTitle: d.plan?.title || "-",
          scheduledDate: formatDate(d.scheduledDate),
          picName: d.assignedUser?.name || "-",
          status: d.status,
        })),
      );
    } else if (reportType === "corrective") {
      exportMaintenanceReportCsv(
        "Corrective_Maintenance_Report",
        [
          { header: "Nomor Tiket", key: "requestNumber" },
          { header: "Aset", key: "assetName" },
          { header: "Tanggal Lapor", key: "requestDate" },
          { header: "Urgensi", key: "urgency" },
          { header: "Pelapor", key: "reporter" },
          { header: "Status", key: "status" },
          { header: "Keluhan", key: "problem" },
        ],
        reportData.map((d) => ({
          requestNumber: d.requestNumber,
          assetName: d.asset?.name || "-",
          requestDate: formatDate(d.requestDate),
          urgency: d.urgency,
          reporter: d.reporterUser?.name || "-",
          status: d.status,
          problem: d.problemDescription,
        })),
      );
    } else if (reportType === "cost_per_asset") {
      exportMaintenanceReportCsv(
        "Maintenance_Cost_Per_Asset_Report",
        [
          { header: "Kode Aset", key: "assetCode" },
          { header: "Nama Aset", key: "name" },
          { header: "Kategori", key: "categoryName" },
          { header: "Departemen", key: "department" },
          { header: "Spare Part (Rp)", key: "sparePartCost" },
          { header: "Tenaga Kerja (Rp)", key: "laborCost" },
          { header: "Jasa Eksternal (Rp)", key: "externalServiceCost" },
          { header: "Total Biaya (Rp)", key: "totalCost" },
          { header: "Jumlah WO", key: "woCount" },
        ],
        reportData,
      );
    } else if (reportType === "cost_per_department") {
      exportMaintenanceReportCsv(
        "Maintenance_Cost_Per_Department_Report",
        [
          { header: "Departemen", key: "department" },
          { header: "Jumlah Aset", key: "assetCount" },
          { header: "Spare Part (Rp)", key: "spareParts" },
          { header: "Tenaga Kerja (Rp)", key: "labor" },
          { header: "Jasa Eksternal (Rp)", key: "external" },
          { header: "Total Biaya (Rp)", key: "totalCost" },
          { header: "Jumlah WO", key: "woCount" },
        ],
        reportData,
      );
    } else if (reportType === "spare_parts") {
      exportMaintenanceReportCsv(
        "Spare_Part_Consumption_Report",
        [
          { header: "Nama Spare Part", key: "sparePartName" },
          { header: "Part Number", key: "partNumber" },
          { header: "Jumlah Qty", key: "quantity" },
          { header: "Satuan", key: "unit" },
          { header: "Harga Satuan (Rp)", key: "unitCost" },
          { header: "Total Biaya (Rp)", key: "totalCost" },
          { header: "Work Order", key: "woNumber" },
        ],
        reportData.map((d) => ({
          sparePartName: d.sparePartName,
          partNumber: d.partNumber || "-",
          quantity: d.quantity,
          unit: d.unit,
          unitCost: d.unitCost,
          totalCost: d.totalCost,
          woNumber: d.workOrder?.workOrderNumber || "-",
        })),
      );
    } else if (reportType === "vendor_service") {
      exportMaintenanceReportCsv(
        "Vendor_Service_Cost_Report",
        [
          { header: "Kode Vendor", key: "code" },
          { header: "Nama Vendor", key: "name" },
          { header: "Kontak", key: "contactPerson" },
          { header: "Telepon", key: "phone" },
          { header: "Spesialisasi", key: "specialization" },
          { header: "Jumlah Servis", key: "serviceCount" },
          { header: "Total Biaya (Rp)", key: "totalCost" },
        ],
        reportData,
      );
    } else if (reportType === "asset_downtime") {
      exportMaintenanceReportCsv(
        "Asset_Downtime_Report",
        [
          { header: "Kode Aset", key: "assetCode" },
          { header: "Nama Aset", key: "assetName" },
          { header: "Mulai Mati", key: "downtimeStart" },
          { header: "Selesai", key: "downtimeEnd" },
          { header: "Durasi (Jam)", key: "durationHours" },
          { header: "Penyebab", key: "cause" },
          { header: "Dampak Operasional", key: "operationalImpact" },
        ],
        reportData.map((d) => ({
          assetCode: d.asset?.assetCode || "-",
          assetName: d.asset?.name || "-",
          downtimeStart: d.downtimeStart,
          downtimeEnd: d.downtimeEnd || "Sedang Berjalan",
          durationHours: d.durationHours,
          cause: d.cause,
          operationalImpact: d.operationalImpact || "-",
        })),
      );
    } else if (reportType === "overdue_maintenance") {
      exportMaintenanceReportCsv(
        "Overdue_Maintenance_Report",
        [
          { header: "Nomor Jadwal", key: "scheduleNumber" },
          { header: "Aset", key: "assetName" },
          { header: "Rencana Servis", key: "planTitle" },
          { header: "Tanggal Terjadwal", key: "scheduledDate" },
          { header: "Teknisi", key: "picName" },
          { header: "Status", key: "status" },
        ],
        reportData.map((d) => ({
          scheduleNumber: d.scheduleNumber,
          assetName: d.asset?.name || "-",
          planTitle: d.plan?.title || "-",
          scheduledDate: formatDate(d.scheduledDate),
          picName: d.assignedUser?.name || "-",
          status: d.status,
        })),
      );
    } else {
      // work_orders
      exportMaintenanceReportCsv(
        "Work_Order_Report",
        [
          { header: "Nomor WO", key: "workOrderNumber" },
          { header: "Aset", key: "assetName" },
          { header: "Tipe", key: "maintenanceType" },
          { header: "Prioritas", key: "priority" },
          { header: "Teknisi", key: "assignedName" },
          { header: "Status", key: "status" },
          { header: "Total Biaya (Rp)", key: "totalCost" },
        ],
        reportData.map((d) => ({
          workOrderNumber: d.workOrderNumber,
          assetName: d.asset?.name || "-",
          maintenanceType: d.maintenanceType,
          priority: d.priority,
          assignedName: d.assignedToUser?.name || "-",
          status: d.status,
          totalCost: d.totalCost,
        })),
      );
    }
  };

  const selectedReportTypeStr =
    REPORT_TYPE_OPTIONS.find((o) => o.startsWith(`${reportType} -`)) || REPORT_TYPE_OPTIONS[0];

  const assetOptions = lookups.assets.map((a) => `${a.id} - ${a.assetCode} · ${a.name}`);
  const selectedAssetStr = selectedAssetId
    ? assetOptions.find((o) => o.startsWith(`${selectedAssetId} -`)) || String(selectedAssetId)
    : "";

  return (
    <View className="gap-4">
      {/* Filters Bar */}
      <View className="bg-card rounded-xl border border-border/80 p-4 gap-3">
        <Text className="text-sm font-bold text-foreground">
          10 Laporan Analitis & Kinerja Maintenance (PRD Bab 9.2)
        </Text>

        <View className="flex-row flex-wrap gap-2.5 items-center">
          <View className="flex-[2] min-w-[260px]">
            <SearchableSelect
              value={selectedReportTypeStr}
              options={REPORT_TYPE_OPTIONS}
              onChange={(val) => setReportType(val.split(" - ")[0] ?? "work_orders")}
            />
          </View>

          <View className="flex-1 min-w-[140px]">
            <DatePicker placeholder="Dari Tanggal" value={from} onChange={(val) => setFrom(val || "")} />
          </View>

          <View className="flex-1 min-w-[140px]">
            <DatePicker placeholder="Sampai Tanggal" value={to} onChange={(val) => setTo(val || "")} />
          </View>

          <View className="flex-1 min-w-[200px]">
            <AssetSelect
              assetId={selectedAssetId}
              assets={lookups.assets as any}
              onChange={(a) => setSelectedAssetId(a ? Number(a.id) : "")}
              placeholder="-- Filter Semua Aset --"
            />
          </View>

          <Button variant="outline" onPress={handleExportCsv} disabled={reportData.length === 0}>
            <Download size={16} />
            <Text>Ekspor CSV</Text>
          </Button>
        </View>
      </View>

      {/* Preview Table matching Contract Management style */}
      <View className="overflow-hidden rounded-xl border border-border/80 bg-card">
        <View className="flex-row items-center justify-between border-b border-border/70 bg-card px-4 py-3">
          <Text className="text-sm font-bold text-foreground">
            Hasil Laporan: {reportData.length} Data Ditemukan
          </Text>
          <Pressable onPress={fetchReport} hitSlop={8} className="p-1 hover:bg-muted/30 rounded-lg">
            <RefreshCw size={16} color={colors.muted} />
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: "100%" }}>
          <View className="min-w-[960px] flex-1">
            {/* Headers */}
            <View className="flex-row items-center border-b border-border/70 bg-muted/60 px-3.5 py-2.5">
              <Text className="w-[200px] text-[11px] font-bold uppercase text-muted-foreground">Dokumen / Aset</Text>
              <Text className="flex-[2] text-[11px] font-bold uppercase text-muted-foreground">Keterangan / Rincian</Text>
              <Text className="w-[180px] text-[11px] font-bold uppercase text-muted-foreground">PIC / Vendor</Text>
              <Text className="w-[150px] text-[11px] font-bold uppercase text-muted-foreground">Biaya / Nilai</Text>
              <Text className="w-[130px] text-[11px] font-bold uppercase text-muted-foreground">Status</Text>
            </View>

            {/* Rows */}
            {loading ? (
              <View className="p-8 items-center">
                <Text className="text-sm text-muted-foreground">Memuat data laporan...</Text>
              </View>
            ) : reportData.length === 0 ? (
              <View className="p-8 items-center">
                <Text className="text-sm text-muted-foreground">Tidak ada data pada periode ini.</Text>
              </View>
            ) : (
              <View className="divide-y divide-border/40">
                {reportData.map((row, idx) => (
                  <View key={idx} className="flex-row items-center px-3.5 py-3 hover:bg-muted/30">
                    <View className="w-[200px] pr-2">
                      <Text className="text-xs font-bold text-primary">
                        {row.workOrderNumber || row.scheduleNumber || row.requestNumber || row.assetCode || row.department || row.name || "-"}
                      </Text>
                      <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                        {row.asset?.name || row.categoryName || row.sparePartName || ""}
                      </Text>
                    </View>

                    <View className="flex-[2] pr-2">
                      <Text className="text-xs text-foreground" numberOfLines={2}>
                        {row.problemDescription || row.plan?.title || row.description || row.cause || row.specialization || "-"}
                      </Text>
                    </View>

                    <View className="w-[180px] pr-2">
                      <Text className="text-xs text-foreground">
                        {row.assignedToUser?.name || row.assignedUser?.name || row.reporterUser?.name || row.contactPerson || "-"}
                      </Text>
                    </View>

                    <View className="w-[150px] pr-2">
                      <Text className="text-xs font-bold text-emerald-600">
                        {formatRupiah(row.totalCost || row.amount || 0)}
                      </Text>
                    </View>

                    <View className="w-[130px]">
                      <Text className="text-xs font-semibold text-primary">
                        {row.status || (row.woCount ? `${row.woCount} Servis` : "-")}
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
