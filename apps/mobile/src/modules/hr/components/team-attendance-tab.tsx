import React from "react";
import { View, ScrollView, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Text } from "@/components/ui/text";
import { Search, X, RefreshCw } from "lucide-react-native";
import { colors } from "@/tokens";
import { DatePicker, SearchableSelect } from "@/components/taska/dialogs";
import { Button } from "@/components/ui/button";

interface TeamAttendanceTabProps {
  attSummary: any;
  searchAttQuery: string;
  setSearchAttQuery: (v: string) => void;
  filterDate: string;
  setFilterDate: (v: string) => void;
  setSelectedMonth: (v: string) => void;
  fetchAttendanceList: () => void;
  loadingList: boolean;
  currentFilterEmployeeLabel: string;
  employeeFilterOptions: string[];
  setSelectedUserFilter: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  filteredAttendance: any[];
  setSelectedAttendance: (row: any) => void;
  setEditAttOtHours: (v: string) => void;
}

export function TeamAttendanceTab({
  attSummary,
  searchAttQuery,
  setSearchAttQuery,
  filterDate,
  setFilterDate,
  setSelectedMonth,
  fetchAttendanceList,
  loadingList,
  currentFilterEmployeeLabel,
  employeeFilterOptions,
  setSelectedUserFilter,
  statusFilter,
  setStatusFilter,
  filteredAttendance,
  setSelectedAttendance,
  setEditAttOtHours,
}: TeamAttendanceTabProps) {
  return (
    <View className="gap-4 w-full">
      {/* KPI Cards Presensi */}
      {attSummary && (
        <View className="grid grid-cols-2 md:grid-cols-6 gap-3 w-full">
          <View className="bg-card border-border/80 rounded-2xl border p-4 shadow-sm">
            <Text className="text-muted-foreground text-xs font-medium">Hadir</Text>
            <Text className="text-success text-lg md:text-xl font-bold mt-1">{attSummary.hadir}</Text>
            <Text className="text-muted-foreground text-[11px] mt-0.5">Total kehadiran</Text>
          </View>
          <View className="bg-card border-border/80 rounded-2xl border p-4 shadow-sm">
            <Text className="text-muted-foreground text-xs font-medium">Izin</Text>
            <Text className="text-blue-500 text-lg md:text-xl font-bold mt-1">{attSummary.izin}</Text>
            <Text className="text-muted-foreground text-[11px] mt-0.5">Izin keperluan</Text>
          </View>
          <View className="bg-card border-border/80 rounded-2xl border p-4 shadow-sm">
            <Text className="text-muted-foreground text-xs font-medium">Sakit</Text>
            <Text className="text-warning text-lg md:text-xl font-bold mt-1">{attSummary.sakit}</Text>
            <Text className="text-muted-foreground text-[11px] mt-0.5">Surat dokter</Text>
          </View>
          <View className="bg-card border-border/80 rounded-2xl border p-4 shadow-sm">
            <Text className="text-muted-foreground text-xs font-medium">Cuti</Text>
            <Text className="text-purple-500 text-lg md:text-xl font-bold mt-1">{attSummary.cuti}</Text>
            <Text className="text-muted-foreground text-[11px] mt-0.5">Cuti tahunan</Text>
          </View>
          <View className="bg-card border-border/80 rounded-2xl border p-4 shadow-sm">
            <Text className="text-muted-foreground text-xs font-medium">Alpha</Text>
            <Text className="text-danger text-lg md:text-xl font-bold mt-1">{attSummary.alpha}</Text>
            <Text className="text-muted-foreground text-[11px] mt-0.5">Tanpa keterangan</Text>
          </View>
          <View className="bg-card border-border/80 rounded-2xl border p-4 shadow-sm">
            <Text className="text-muted-foreground text-xs font-medium">Jam Lembur</Text>
            <Text className="text-foreground text-lg md:text-xl font-bold mt-1">{attSummary.totalOvertime} Jam</Text>
            <Text className="text-muted-foreground text-[11px] mt-0.5">Total lembur tim</Text>
          </View>
        </View>
      )}

      {/* Filter Bar Selaras Accounting */}
      <View className="bg-card border-border/80 rounded-2xl border p-4 gap-3 shadow-sm">
        <View className="flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Bar */}
          <View className="bg-panel border-border/80 flex-1 flex-row items-center gap-2 rounded-lg border px-3 py-2">
            <Search size={14} color={colors.textSecondary} />
            <TextInput
              value={searchAttQuery}
              onChangeText={setSearchAttQuery}
              placeholder="Cari nama karyawan, catatan, tanggal..."
              placeholderTextColor={colors.muted}
              className="flex-1 text-xs text-foreground p-0 outline-none"
            />
            {searchAttQuery ? (
              <Pressable onPress={() => setSearchAttQuery("")}>
                <X size={14} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>

          {/* Date, Month & Action Buttons */}
          <View className="flex-row items-center flex-wrap gap-2">
            <View className="w-48 sm:w-56">
              <DatePicker
                value={filterDate}
                onChange={(d) => {
                  setFilterDate(d);
                  if (d) {
                    setSelectedMonth(d.slice(0, 7));
                  }
                }}
                placeholder="Pilih Tanggal Presensi..."
                className="h-9 rounded-lg bg-panel border-border/80 text-xs px-2.5"
              />
            </View>
            {filterDate ? (
              <Button
                size="sm"
                variant="ghost"
                onPress={() => setFilterDate("")}
                className="h-9 px-2 gap-1"
              >
                <X size={13} color={colors.muted} />
                <Text className="text-xs text-muted-foreground">Semua Tgl</Text>
              </Button>
            ) : null}

            <Button size="sm" variant="outline" onPress={fetchAttendanceList} className="gap-1.5 h-9 px-3">
              <RefreshCw size={13} className={loadingList ? "animate-spin" : ""} />
              <Text className="text-xs font-medium">Tampilkan</Text>
            </Button>
          </View>
        </View>

        {/* Employee & Status Filter Pills */}
        <View className="flex-col md:flex-row md:items-center justify-between gap-3 border-t border-border/50 pt-3">
          <View className="w-full md:w-64">
            <SearchableSelect
              value={currentFilterEmployeeLabel}
              onChange={(val) => {
                if (!val || val === "Semua Karyawan") {
                  setSelectedUserFilter("ALL");
                } else {
                  const id = val.split(" - ")[0];
                  if (id) setSelectedUserFilter(id);
                }
              }}
              options={employeeFilterOptions}
              placeholder="Pilih Karyawan..."
            />
          </View>

          {/* Status Pills */}
          <View className="flex-row items-center flex-wrap gap-1.5">
            {["Semua", "HADIR", "IZIN", "SAKIT", "CUTI", "ALPHA"].map((st) => (
              <Pressable
                key={st}
                onPress={() => setStatusFilter(st)}
                className={
                  statusFilter === st
                    ? "bg-primary/20 border-primary rounded-md border px-2.5 py-1"
                    : "bg-panel border-border rounded-md border px-2.5 py-1"
                }
              >
                <Text
                  className={
                    statusFilter === st
                      ? "text-primary text-xs font-semibold"
                      : "text-muted-foreground text-xs"
                  }
                >
                  {st}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* Table Container Selaras DataTable */}
      <View className="bg-card border-border/80 w-full overflow-hidden rounded-2xl border shadow-sm">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ minWidth: "100%", width: "100%" }}
          className="w-full"
        >
          <View className="w-full flex-1 min-w-full">
            <View className="border-border/70 bg-card/60 flex-row items-center border-b px-4 py-3.5 w-full">
              <Text style={{ flex: 1, minWidth: 100 }} className="text-muted-foreground text-xs font-semibold tracking-wider">Tanggal</Text>
              <Text style={{ flex: 1.8, minWidth: 160 }} className="text-muted-foreground text-xs font-semibold tracking-wider">Karyawan</Text>
              <Text style={{ flex: 1, minWidth: 90 }} className="text-muted-foreground text-xs font-semibold tracking-wider">Status</Text>
              <Text style={{ flex: 0.9, minWidth: 85 }} className="text-muted-foreground text-xs font-semibold tracking-wider">Jam Masuk</Text>
              <Text style={{ flex: 0.9, minWidth: 85 }} className="text-muted-foreground text-xs font-semibold tracking-wider">Jam Pulang</Text>
              <Text style={{ flex: 0.9, minWidth: 85 }} className="text-muted-foreground text-xs font-semibold tracking-wider">Jam Lembur</Text>
              <Text style={{ flex: 2, minWidth: 160 }} className="text-muted-foreground text-xs font-semibold tracking-wider">Catatan / Keterangan</Text>
              <Text style={{ width: 80 }} className="text-muted-foreground text-xs font-semibold tracking-wider text-right">Aksi</Text>
            </View>

            {loadingList ? (
              <View className="py-12 items-center justify-center">
                <ActivityIndicator size="small" />
              </View>
            ) : filteredAttendance.length === 0 ? (
              <View className="py-12 items-center justify-center">
                <Text className="text-xs text-muted-foreground">Tidak ada baris presensi yang sesuai filter.</Text>
              </View>
            ) : (
              filteredAttendance.map((row) => (
                <Pressable
                  key={row.id}
                  onPress={() => {
                    setSelectedAttendance(row);
                    setEditAttOtHours(String(row.overtimeHours ?? 0));
                  }}
                  className="border-border/60 hover:bg-panel/40 flex-row items-center border-b px-4 py-3.5 transition-colors w-full cursor-pointer"
                >
                  <Text style={{ flex: 1, minWidth: 100 }} className="text-xs text-muted-foreground">
                    {row.date ? String(row.date).slice(0, 10) : "-"}
                  </Text>
                  <View style={{ flex: 1.8, minWidth: 160 }} className="pr-3">
                    <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                      {row.user?.name || `User #${row.userId}`}
                    </Text>
                    <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
                      {row.user?.role || "-"}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 90 }}>
                    <View
                      className={`rounded px-2.5 py-1 self-start ${
                        row.status === "HADIR"
                          ? "bg-emerald-500/10 border border-emerald-500/30"
                          : row.status === "ALPHA"
                          ? "bg-red-500/10 border border-red-500/30"
                          : "bg-amber-500/10 border border-amber-500/30"
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          row.status === "HADIR"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : row.status === "ALPHA"
                            ? "text-red-600 dark:text-red-400"
                            : "text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {row.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ flex: 0.9, minWidth: 85 }} className="text-xs text-foreground">
                    {row.checkIn
                      ? new Date(row.checkIn).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "-"}
                  </Text>
                  <Text style={{ flex: 0.9, minWidth: 85 }} className="text-xs text-foreground">
                    {row.checkOut
                      ? new Date(row.checkOut).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "-"}
                  </Text>
                  <Text style={{ flex: 0.9, minWidth: 85 }} className="text-xs text-foreground">
                    {Number(row.overtimeHours) > 0 ? `${row.overtimeHours} Jam` : "-"}
                  </Text>
                  <Text style={{ flex: 2, minWidth: 160 }} className="text-xs text-muted-foreground pr-2" numberOfLines={1}>
                    {row.notes || "-"}
                  </Text>
                  <View style={{ width: 80 }} className="items-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => {
                        setSelectedAttendance(row);
                        setEditAttOtHours(String(row.overtimeHours ?? 0));
                      }}
                      className="h-8 px-2.5"
                    >
                      <Text className="text-xs font-medium text-foreground">Detail</Text>
                    </Button>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

