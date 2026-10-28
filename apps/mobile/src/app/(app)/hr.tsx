import React from "react";
import { View, Pressable, ScrollView } from "react-native";
import { Text } from "@/components/ui/text";
import {
  UserCheck,
  Calendar,
  CreditCard,
  History,
  Settings,
  Plus,
} from "lucide-react-native";
import { useApp } from "@/store/app-store";
import { api } from "@/services/api";
import { colors } from "@/tokens";
import { PageHeader } from "@/components/taska/basics";
import { Button } from "@/components/ui/button";
import { formatThousands } from "@/lib/format";

import { TabType, formatPeriodLabel } from "@/modules/hr/types";
import { MyAttendanceTab } from "@/modules/hr/components/my-attendance-tab";
import { TeamAttendanceTab } from "@/modules/hr/components/team-attendance-tab";
import { PayrollTab } from "@/modules/hr/components/payroll-tab";
import { PayrollHistoryTab } from "@/modules/hr/components/payroll-history-tab";
import { PayrollConfigTab } from "@/modules/hr/components/payroll-config-tab";
import { SalarySlipDialog } from "@/modules/hr/components/salary-slip-dialog";
import { EditSalaryConfigDialog } from "@/modules/hr/components/edit-salary-config-dialog";
import { ManualAttendanceDialog } from "@/modules/hr/components/manual-attendance-dialog";
import { AttendanceDetailDialog } from "@/modules/hr/components/attendance-detail-dialog";
import { ScheduleSettingsDialog } from "@/modules/hr/components/schedule-settings-dialog";

export default function HrScreen() {
  const { user, toast } = useApp();
  const roleLower = (user?.role || "").toLowerCase();
  const isFinanceOrAdmin = ["super_admin", "admin", "bos", "finance"].includes(roleLower);
  const isSuperAdminOrBos = ["super_admin", "bos"].includes(roleLower);

  const [activeTab, setActiveTab] = React.useState<TabType>("my-attendance");

  // ── State: Tab 1 (Presensi Saya) ──
  const [todayAtt, setTodayAtt] = React.useState<any>(null);
  const [loadingToday, setLoadingToday] = React.useState(false);
  const [checkInNote, setCheckInNote] = React.useState("");
  const [checkOutNote, setCheckOutNote] = React.useState("");
  const [submittingAtt, setSubmittingAtt] = React.useState(false);

  // ── State: Tab 2 (Rekap Presensi Tim) ──
  const [attendanceList, setAttendanceList] = React.useState<any[]>([]);
  const [attSummary, setAttSummary] = React.useState<any>(null);
  const [loadingList, setLoadingList] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState("Semua");
  const [searchAttQuery, setSearchAttQuery] = React.useState("");
  const [filterDate, setFilterDate] = React.useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [selectedMonth, setSelectedMonth] = React.useState(() => {
    return new Date().toISOString().slice(0, 7);
  });
  const [selectedUserFilter, setSelectedUserFilter] = React.useState<string>("ALL");

  // Manual Attendance Modal
  const [manualModalOpen, setManualModalOpen] = React.useState(false);
  const [manualUserId, setManualUserId] = React.useState("");
  const [manualUserLabel, setManualUserLabel] = React.useState("");
  const [manualDate, setManualDate] = React.useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [manualStatus, setManualStatus] = React.useState<"HADIR" | "IZIN" | "SAKIT" | "CUTI" | "ALPHA">("HADIR");
  const [manualNote, setManualNote] = React.useState("");
  const [manualOvertime, setManualOvertime] = React.useState("0");

  // Detail Attendance Modal
  const [selectedAttendance, setSelectedAttendance] = React.useState<any>(null);
  const [editAttOtHours, setEditAttOtHours] = React.useState("0");
  const [savingAttDetail, setSavingAttDetail] = React.useState(false);

  // Settings Modal (Work Schedule & Overtime)
  const [scheduleModalOpen, setScheduleModalOpen] = React.useState(false);
  const [workStartTime, setWorkStartTime] = React.useState("08:00");
  const [workEndTime, setWorkEndTime] = React.useState("17:00");
  const [lateTolerance, setLateTolerance] = React.useState("15");
  const [breakStartTime, setBreakStartTime] = React.useState("12:00");
  const [breakEndTime, setBreakEndTime] = React.useState("13:00");
  const [otCalculationMode, setOtCalculationMode] = React.useState<"AFTER_HOURS" | "AFTER_WORK_END">("AFTER_HOURS");
  const [otThresholdHours, setOtThresholdHours] = React.useState("8");
  const [otMinMinutes, setOtMinMinutes] = React.useState("30");
  const [otRatePerHour, setOtRatePerHour] = React.useState("0");
  const [savingSchedule, setSavingSchedule] = React.useState(false);

  // ── State: Payroll & Gaji ──
  const [payrollPeriod, setPayrollPeriod] = React.useState(() => {
    return new Date().toISOString().slice(0, 7);
  });
  const [slips, setSlips] = React.useState<any[]>([]);
  const [loadingSlips, setLoadingSlips] = React.useState(false);
  const [selectedSlip, setSelectedSlip] = React.useState<any>(null);

  // ── State: History Slip Gaji ──
  const [historySlips, setHistorySlips] = React.useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = React.useState(false);
  const [historySearchQuery, setHistorySearchQuery] = React.useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = React.useState("Semua");
  const [historyPeriodFilter, setHistoryPeriodFilter] = React.useState("Semua");
  const [historyExpandedPeriods, setHistoryExpandedPeriods] = React.useState<{ [period: string]: boolean }>({});
  const [historyPagePerMonth, setHistoryPagePerMonth] = React.useState<{ [period: string]: number }>({});

  // ── State: Konfigurasi Gaji ──
  const [configs, setConfigs] = React.useState<any[]>([]);
  const [loadingConfigs, setLoadingConfigs] = React.useState(false);
  const [editConfigModalOpen, setEditConfigModalOpen] = React.useState(false);
  const [editConfigTarget, setEditConfigTarget] = React.useState<any>(null);
  const [editBasicSalary, setEditBasicSalary] = React.useState("");
  const [editAllowance, setEditAllowance] = React.useState("");
  const [editPtkp, setEditPtkp] = React.useState("TK/0");
  const [editHasNpwpLabel, setEditHasNpwpLabel] = React.useState("Punya NPWP");
  const [editCustomRate, setEditCustomRate] = React.useState("");

  // Users options
  const [userOptions, setUserOptions] = React.useState<any[]>([]);

  // ── Loaders ──
  const fetchToday = React.useCallback(async () => {
    try {
      setLoadingToday(true);
      const res = await api<any>("GET", "/hr/attendance/today");
      setTodayAtt(res || null);
    } catch (e: any) {
      console.warn("Error fetching today attendance:", e?.message);
    } finally {
      setLoadingToday(false);
    }
  }, []);

  const fetchAttendanceList = React.useCallback(async () => {
    try {
      setLoadingList(true);
      const params = new URLSearchParams();
      if (filterDate.trim()) params.append("date", filterDate.trim());
      else if (selectedMonth.trim()) params.append("month", selectedMonth.trim());
      if (selectedUserFilter && selectedUserFilter !== "ALL") params.append("userId", selectedUserFilter);

      const [listRes, sumRes] = await Promise.all([
        api<any[]>("GET", `/hr/attendance?${params.toString()}`),
        api<any>("GET", `/hr/attendance/summary?month=${selectedMonth}`),
      ]);
      setAttendanceList(listRes || []);
      setAttSummary(sumRes || null);
    } catch (e: any) {
      console.warn("Error fetching attendance list:", e?.message);
    } finally {
      setLoadingList(false);
    }
  }, [selectedMonth, filterDate, selectedUserFilter]);

  const fetchSlips = React.useCallback(async () => {
    try {
      setLoadingSlips(true);
      const res = await api<any[]>("GET", `/hr/payroll/slips?period=${payrollPeriod}`);
      setSlips(res || []);
    } catch (e: any) {
      console.warn("Error fetching slips:", e?.message);
    } finally {
      setLoadingSlips(false);
    }
  }, [payrollPeriod]);

  const fetchHistorySlips = React.useCallback(async () => {
    try {
      setLoadingHistory(true);
      const res = await api<any[]>("GET", "/hr/payroll/slips");
      setHistorySlips(res || []);
    } catch (e: any) {
      console.warn("Error fetching history slips:", e?.message);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const fetchConfigs = React.useCallback(async () => {
    try {
      setLoadingConfigs(true);
      const res = await api<any[]>("GET", "/hr/payroll/configs");
      setConfigs(res || []);
      setUserOptions((res || []).map((c: any) => c.user).filter(Boolean));
    } catch (e: any) {
      console.warn("Error fetching configs:", e?.message);
    } finally {
      setLoadingConfigs(false);
    }
  }, []);

  const fetchScheduleSettings = React.useCallback(async () => {
    try {
      const res = await api<any>("GET", "/hr/attendance/settings");
      if (res) {
        if (res.workStartTime) setWorkStartTime(res.workStartTime);
        if (res.workEndTime) setWorkEndTime(res.workEndTime);
        if (res.lateToleranceMinutes !== undefined) setLateTolerance(String(res.lateToleranceMinutes));
        if (res.breakStartTime) setBreakStartTime(res.breakStartTime);
        if (res.breakEndTime) setBreakEndTime(res.breakEndTime);
        if (res.overtimeCalculationMode) setOtCalculationMode(res.overtimeCalculationMode);
        if (res.overtimeThresholdHours !== undefined) setOtThresholdHours(String(res.overtimeThresholdHours));
        if (res.overtimeMinMinutes !== undefined) setOtMinMinutes(String(res.overtimeMinMinutes));
        if (res.overtimeRatePerHour !== undefined) setOtRatePerHour(String(res.overtimeRatePerHour));
      }
    } catch (e: any) {
      console.warn("Error fetching schedule settings:", e?.message);
    }
  }, []);

  const handleSaveSchedule = async () => {
    try {
      setSavingSchedule(true);
      await api("POST", "/hr/attendance/settings", {
        workStartTime,
        workEndTime,
        lateToleranceMinutes: Number(lateTolerance) || 0,
        breakStartTime,
        breakEndTime,
        overtimeCalculationMode: otCalculationMode,
        overtimeThresholdHours: Number(otThresholdHours) || 8,
        overtimeMinMinutes: Number(otMinMinutes) || 30,
        overtimeRatePerHour: Number(otRatePerHour) || 0,
      });
      toast("Pengaturan jam kerja & aturan lembur berhasil disimpan");
      setScheduleModalOpen(false);
    } catch (e: any) {
      toast(e?.message || "Gagal menyimpan pengaturan", "danger");
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleUpdateAttendanceRecord = async () => {
    if (!selectedAttendance) return;
    try {
      setSavingAttDetail(true);
      await api("PATCH", `/hr/attendance/${selectedAttendance.id}`, {
        overtimeHours: Number(editAttOtHours) || 0,
      });
      toast("Data jam lembur berhasil diperbarui");
      setSelectedAttendance(null);
      fetchAttendanceList();
    } catch (e: any) {
      toast(e?.message || "Gagal memperbarui lembur", "danger");
    } finally {
      setSavingAttDetail(false);
    }
  };

  // ── Effects ──
  React.useEffect(() => {
    let active = true;
    api<any>("GET", "/hr/attendance/today")
      .then((res) => {
        if (active) setTodayAtt(res || null);
      })
      .catch((e: any) => console.warn(e?.message));
    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    let active = true;
    if (activeTab === "team-attendance") {
      const params = new URLSearchParams();
      if (filterDate.trim()) params.append("date", filterDate.trim());
      else if (selectedMonth.trim()) params.append("month", selectedMonth.trim());
      if (selectedUserFilter && selectedUserFilter !== "ALL") params.append("userId", selectedUserFilter);

      Promise.all([
        api<any[]>("GET", `/hr/attendance?${params.toString()}`),
        api<any>("GET", `/hr/attendance/summary?month=${selectedMonth}`),
        api<any[]>("GET", "/hr/payroll/configs"),
        api<any>("GET", "/hr/attendance/settings").catch(() => null),
      ])
        .then(([listRes, sumRes, confRes, schedRes]) => {
          if (!active) return;
          setAttendanceList(listRes || []);
          setAttSummary(sumRes || null);
          setConfigs(confRes || []);
          setUserOptions((confRes || []).map((c: any) => c.user).filter(Boolean));
          if (schedRes) {
            if (schedRes.workStartTime) setWorkStartTime(schedRes.workStartTime);
            if (schedRes.workEndTime) setWorkEndTime(schedRes.workEndTime);
            if (schedRes.lateToleranceMinutes !== undefined) setLateTolerance(String(schedRes.lateToleranceMinutes));
            if (schedRes.breakStartTime) setBreakStartTime(schedRes.breakStartTime);
            if (schedRes.breakEndTime) setBreakEndTime(schedRes.breakEndTime);
            if (schedRes.overtimeCalculationMode) setOtCalculationMode(schedRes.overtimeCalculationMode);
            if (schedRes.overtimeThresholdHours !== undefined) setOtThresholdHours(String(schedRes.overtimeThresholdHours));
            if (schedRes.overtimeMinMinutes !== undefined) setOtMinMinutes(String(schedRes.overtimeMinMinutes));
            if (schedRes.overtimeRatePerHour !== undefined) setOtRatePerHour(String(schedRes.overtimeRatePerHour));
          }
        })
        .catch((e: any) => console.warn(e?.message));
    } else if (activeTab === "payroll") {
      api<any[]>("GET", `/hr/payroll/slips?period=${payrollPeriod}`)
        .then((res) => {
          if (active) setSlips(res || []);
        })
        .catch((e: any) => console.warn(e?.message));
    } else if (activeTab === "payroll-history") {
      api<any[]>("GET", "/hr/payroll/slips")
        .then((res) => {
          if (active) setHistorySlips(res || []);
        })
        .catch((e: any) => console.warn(e?.message));
    } else if (activeTab === "config") {
      api<any[]>("GET", "/hr/payroll/configs")
        .then((res) => {
          if (!active) return;
          setConfigs(res || []);
          setUserOptions((res || []).map((c: any) => c.user).filter(Boolean));
        })
        .catch((e: any) => console.warn(e?.message));
    }
    return () => {
      active = false;
    };
  }, [activeTab, selectedMonth, filterDate, selectedUserFilter, payrollPeriod]);

  // ── Actions ──
  const handleCheckIn = async () => {
    try {
      setSubmittingAtt(true);
      await api("POST", "/hr/attendance/check-in", { notes: checkInNote });
      toast("Berhasil melakukan check-in hari ini!", "success");
      setCheckInNote("");
      fetchToday();
    } catch (e: any) {
      toast(e?.message || "Gagal check-in", "danger");
    } finally {
      setSubmittingAtt(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setSubmittingAtt(true);
      await api("POST", "/hr/attendance/check-out", { notes: checkOutNote });
      toast("Berhasil melakukan check-out. Sampai jumpa besok!", "success");
      setCheckOutNote("");
      fetchToday();
    } catch (e: any) {
      toast(e?.message || "Gagal check-out", "danger");
    } finally {
      setSubmittingAtt(false);
    }
  };

  const handleSaveManualAttendance = async () => {
    if (!manualUserId || !manualDate) {
      toast("Pilih karyawan dan tanggal presensi!", "danger");
      return;
    }
    try {
      await api("POST", "/hr/attendance/manual", {
        userId: Number(manualUserId),
        date: manualDate,
        status: manualStatus,
        overtimeHours: Number(manualOvertime) || 0,
        notes: manualNote,
      });
      toast("Data presensi karyawan berhasil disimpan", "success");
      setManualModalOpen(false);
      setManualNote("");
      setManualOvertime("0");
      fetchAttendanceList();
    } catch (e: any) {
      toast(e?.message || "Gagal mencatat presensi", "danger");
    }
  };

  const handleGenerateSlips = async () => {
    try {
      setLoadingSlips(true);
      const res = await api<any>("POST", "/hr/payroll/generate", { period: payrollPeriod });
      toast(`Slip gaji periode ${payrollPeriod} berhasil di-generate (${res?.generated || 0} staf)`, "success");
      fetchSlips();
    } catch (e: any) {
      toast(e?.message || "Gagal men-generate slip gaji", "danger");
    } finally {
      setLoadingSlips(false);
    }
  };

  const handlePaySlip = async (slipId: string | number) => {
    try {
      await api("POST", `/hr/payroll/slips/${slipId}/pay`, {});
      toast("Slip gaji berhasil ditandai telah dibayarkan!", "success");
      if (selectedSlip && selectedSlip.id === slipId) {
        setSelectedSlip({ ...selectedSlip, status: "PAID", paidAt: new Date().toISOString() });
      }
      if (activeTab === "payroll") fetchSlips();
      if (activeTab === "payroll-history") fetchHistorySlips();
    } catch (e: any) {
      toast(e?.message || "Gagal memperbarui status slip", "danger");
    }
  };

  const handleSaveConfig = async () => {
    if (!editConfigTarget) return;
    try {
      await api("POST", "/hr/payroll/configs", {
        userId: editConfigTarget.userId,
        basicSalary: Number(String(editBasicSalary).replace(/\D/g, "")) || 0,
        allowance: Number(String(editAllowance).replace(/\D/g, "")) || 0,
        ptkp: editPtkp,
        hasNpwp: editHasNpwpLabel.startsWith("Punya"),
        pph21Rate: editCustomRate ? Number(editCustomRate) : null,
      });
      toast("Konfigurasi gaji karyawan berhasil disimpan", "success");
      setEditConfigModalOpen(false);
      fetchConfigs();
    } catch (e: any) {
      toast(e?.message || "Gagal menyimpan konfigurasi", "danger");
    }
  };

  // ── Computations ──
  const filteredAttendance = React.useMemo(() => {
    return attendanceList.filter((row) => {
      if (statusFilter !== "Semua" && row.status !== statusFilter) {
        return false;
      }
      if (searchAttQuery.trim()) {
        const q = searchAttQuery.toLowerCase();
        const userName = (row.user?.name || "").toLowerCase();
        const notes = (row.notes || "").toLowerCase();
        const dateStr = (row.date ? String(row.date) : "").toLowerCase();
        if (!userName.includes(q) && !notes.includes(q) && !dateStr.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [attendanceList, statusFilter, searchAttQuery]);

  const availableHistoryPeriods = React.useMemo(() => {
    const set = new Set<string>();
    historySlips.forEach((s) => {
      if (s.period) set.add(s.period);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [historySlips]);

  const filteredHistorySlips = React.useMemo(() => {
    return historySlips.filter((s) => {
      if (historyPeriodFilter !== "Semua" && s.period !== historyPeriodFilter) {
        return false;
      }
      if (historyStatusFilter !== "Semua" && (s.status || "").toUpperCase() !== historyStatusFilter.toUpperCase()) {
        return false;
      }
      if (historySearchQuery.trim()) {
        const q = historySearchQuery.toLowerCase();
        const userName = (s.user?.name || "").toLowerCase();
        const periodStr = (s.period || "").toLowerCase();
        if (!userName.includes(q) && !periodStr.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [historySlips, historyPeriodFilter, historyStatusFilter, historySearchQuery]);

  const groupedHistorySlips = React.useMemo(() => {
    const groups: { [period: string]: typeof filteredHistorySlips } = {};
    filteredHistorySlips.forEach((slip) => {
      const p = slip.period || "Lainnya";
      if (!groups[p]) groups[p] = [];
      groups[p].push(slip);
    });
    const sortedPeriods = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    return sortedPeriods.map((period) => {
      const slips = groups[period] ?? [];
      const totalNetSalary = slips.reduce((acc, row) => acc + (Number(row.netSalary) || 0), 0);
      const paidCount = slips.filter((s) => s.status === "PAID").length;
      const draftCount = slips.filter((s) => s.status !== "PAID").length;
      return {
        period,
        slips,
        totalNetSalary,
        paidCount,
        draftCount,
      };
    });
  }, [filteredHistorySlips]);

  // Metrics Tab 3
  const totalGross = slips.reduce((s, row) => s + (Number(row.grossSalary) || 0), 0);
  const totalPph21 = slips.reduce((s, row) => s + (Number(row.pph21) || 0), 0);
  const totalBpjs = slips.reduce((s, row) => s + (Number(row.bpjs) || 0), 0);
  const totalNet = slips.reduce((s, row) => s + (Number(row.netSalary) || 0), 0);

  // Employee Dropdown Options
  const employeeSelectOptions = React.useMemo(() => {
    return userOptions.map((u) => `${u.id} - ${u.name} (${u.role || u.email || "Karyawan"})`);
  }, [userOptions]);

  const employeeFilterOptions = React.useMemo(() => {
    return ["Semua Karyawan", ...userOptions.map((u) => `${u.id} - ${u.name}`)];
  }, [userOptions]);

  const currentFilterEmployeeLabel = React.useMemo(() => {
    if (selectedUserFilter === "ALL") return "Semua Karyawan";
    const found = userOptions.find((u) => String(u.id) === selectedUserFilter);
    return found ? `${found.id} - ${found.name}` : "Semua Karyawan";
  }, [selectedUserFilter, userOptions]);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingBottom: 64 }}>
      <View className="gap-5 w-full">
        {/* Header Selaras PageHeader TASKA */}
        <PageHeader
          title="HR: Absensi & Payroll"
          subtitle="Presensi Kehadiran Harian, Rekap Tim, Payroll Gaji, PPh 21 TER, dan BPJS Karyawan"
          showRefresh={false}
          action={
            activeTab === "team-attendance" ? (
              <View className="flex-row items-center gap-2">
                {isSuperAdminOrBos && (
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => {
                      fetchScheduleSettings();
                      setScheduleModalOpen(true);
                    }}
                    className="gap-1.5 h-9 px-3"
                  >
                    <Settings size={14} color={colors.text} />
                    <Text className="text-xs font-semibold text-foreground">Atur Jam Kerja & Lembur</Text>
                  </Button>
                )}
                {isFinanceOrAdmin && (
                  <Button size="sm" onPress={() => setManualModalOpen(true)} className="gap-1.5 h-9 px-3">
                    <Plus size={14} color="#FFFFFF" />
                    <Text className="text-xs font-semibold text-white" style={{ color: "#FFFFFF" }}>
                      Catat Presensi
                    </Text>
                  </Button>
                )}
              </View>
            ) : null
          }
        />

        {/* Tab Switcher - Identik dengan Buku Besar & COA */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="w-full">
          <View className="bg-panel border-border/80 flex-row items-center rounded-2xl border p-1.5 gap-1.5">
            {[
              { id: "my-attendance", label: "Absensi Saya", icon: UserCheck, count: null },
              {
                id: "team-attendance",
                label: "Rekap Presensi",
                icon: Calendar,
                count: attendanceList.length,
                hide: !isFinanceOrAdmin,
              },
              {
                id: "payroll",
                label: "Payroll & Gaji",
                icon: CreditCard,
                count: slips.length,
                hide: !isFinanceOrAdmin,
              },
              {
                id: "payroll-history",
                label: "History Slip Gaji",
                icon: History,
                count: historySlips.length,
              },
              {
                id: "config",
                label: "Setting Gaji",
                icon: Settings,
                count: configs.length,
                hide: !isFinanceOrAdmin,
              },
            ]
              .filter((t) => !t.hide)
              .map((t) => {
                const active = activeTab === t.id;
                const IconComp = t.icon;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => setActiveTab(t.id as TabType)}
                    className={`flex-row items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                      active ? "bg-primary shadow-sm" : "hover:bg-card/60"
                    }`}
                  >
                    <IconComp size={15} color={active ? "#FFFFFF" : colors.textSecondary} />
                    <Text
                      className={`text-xs font-semibold ${
                        active ? "text-white" : "text-muted-foreground"
                      }`}
                    >
                      {t.label}
                    </Text>
                    {t.count !== null && (
                      <View
                        className={`rounded-full px-1.5 py-0.2 min-w-[18px] items-center justify-center ${
                          active ? "bg-white/20" : "bg-panel border border-border/60"
                        }`}
                      >
                        <Text
                          className={`text-[10px] font-bold ${
                            active ? "text-white" : "text-muted-foreground"
                          }`}
                        >
                          {t.count}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
          </View>
        </ScrollView>

        {/* ──────────────── TAB 1: ABSENSI SAYA ──────────────── */}
        {activeTab === "my-attendance" && (
          <MyAttendanceTab
            todayAtt={todayAtt}
            loadingToday={loadingToday}
            submittingAtt={submittingAtt}
            checkInNote={checkInNote}
            setCheckInNote={setCheckInNote}
            checkOutNote={checkOutNote}
            setCheckOutNote={setCheckOutNote}
            handleCheckIn={handleCheckIn}
            handleCheckOut={handleCheckOut}
          />
        )}

        {/* ──────────────── TAB 2: REKAP PRESENSI TIM ──────────────── */}
        {activeTab === "team-attendance" && (
          <TeamAttendanceTab
            attSummary={attSummary}
            searchAttQuery={searchAttQuery}
            setSearchAttQuery={setSearchAttQuery}
            filterDate={filterDate}
            setFilterDate={setFilterDate}
            setSelectedMonth={setSelectedMonth}
            fetchAttendanceList={fetchAttendanceList}
            loadingList={loadingList}
            currentFilterEmployeeLabel={currentFilterEmployeeLabel}
            employeeFilterOptions={employeeFilterOptions}
            setSelectedUserFilter={setSelectedUserFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            filteredAttendance={filteredAttendance}
            setSelectedAttendance={setSelectedAttendance}
            setEditAttOtHours={setEditAttOtHours}
          />
        )}

        {/* ──────────────── TAB 3: PAYROLL & GAJI ──────────────── */}
        {activeTab === "payroll" && (
          <PayrollTab
            totalGross={totalGross}
            totalPph21={totalPph21}
            totalBpjs={totalBpjs}
            totalNet={totalNet}
            payrollPeriod={payrollPeriod}
            setPayrollPeriod={setPayrollPeriod}
            fetchSlips={fetchSlips}
            loadingSlips={loadingSlips}
            isFinanceOrAdmin={isFinanceOrAdmin}
            handleGenerateSlips={handleGenerateSlips}
            slips={slips}
            setSelectedSlip={setSelectedSlip}
            handlePaySlip={handlePaySlip}
          />
        )}

        {/* ──────────────── TAB 4: HISTORY SLIP GAJI ──────────────── */}
        {activeTab === "payroll-history" && (
          <PayrollHistoryTab
            historySearchQuery={historySearchQuery}
            setHistorySearchQuery={setHistorySearchQuery}
            historyStatusFilter={historyStatusFilter}
            setHistoryStatusFilter={setHistoryStatusFilter}
            historyPeriodFilter={historyPeriodFilter}
            setHistoryPeriodFilter={setHistoryPeriodFilter}
            historyExpandedPeriods={historyExpandedPeriods}
            setHistoryExpandedPeriods={setHistoryExpandedPeriods}
            historyPagePerMonth={historyPagePerMonth}
            setHistoryPagePerMonth={setHistoryPagePerMonth}
            fetchHistorySlips={fetchHistorySlips}
            loadingHistory={loadingHistory}
            availableHistoryPeriods={availableHistoryPeriods}
            groupedHistorySlips={groupedHistorySlips}
            setSelectedSlip={setSelectedSlip}
          />
        )}

        {/* ──────────────── TAB 5: CONFIG GAJI KARYAWAN ──────────────── */}
        {activeTab === "config" && isFinanceOrAdmin && (
          <PayrollConfigTab
            loadingConfigs={loadingConfigs}
            configs={configs}
            fetchConfigs={fetchConfigs}
            onEditConfig={(c) => {
              setEditConfigTarget(c);
              setEditBasicSalary(c.basicSalary ? formatThousands(c.basicSalary) : "");
              setEditAllowance(c.allowance ? formatThousands(c.allowance) : "");
              setEditPtkp(c.ptkp || "TK/0");
              setEditHasNpwpLabel(c.hasNpwp ? "Punya NPWP" : "Tidak Ada (+20% Tarif)");
              setEditCustomRate(c.pph21Rate ? String(c.pph21Rate) : "");
              setEditConfigModalOpen(true);
            }}
          />
        )}
      </View>

      {/* ──────────────── DIALOGS ──────────────── */}
      <SalarySlipDialog
        selectedSlip={selectedSlip}
        setSelectedSlip={setSelectedSlip}
        isFinanceOrAdmin={isFinanceOrAdmin}
        handlePaySlip={handlePaySlip}
      />

      <EditSalaryConfigDialog
        open={editConfigModalOpen}
        onOpenChange={setEditConfigModalOpen}
        target={editConfigTarget}
        basicSalary={editBasicSalary}
        setBasicSalary={setEditBasicSalary}
        allowance={editAllowance}
        setAllowance={setEditAllowance}
        ptkp={editPtkp}
        setPtkp={setEditPtkp}
        hasNpwpLabel={editHasNpwpLabel}
        setHasNpwpLabel={setEditHasNpwpLabel}
        customRate={editCustomRate}
        setCustomRate={setEditCustomRate}
        onSave={handleSaveConfig}
      />

      <ManualAttendanceDialog
        open={manualModalOpen}
        onOpenChange={setManualModalOpen}
        manualUserLabel={manualUserLabel}
        setManualUserLabel={setManualUserLabel}
        setManualUserId={setManualUserId}
        userOptions={userOptions}
        employeeSelectOptions={employeeSelectOptions}
        manualDate={manualDate}
        setManualDate={setManualDate}
        manualStatus={manualStatus}
        setManualStatus={setManualStatus}
        manualOvertime={manualOvertime}
        setManualOvertime={setManualOvertime}
        manualNote={manualNote}
        setManualNote={setManualNote}
        onSave={handleSaveManualAttendance}
      />

      <AttendanceDetailDialog
        selectedAttendance={selectedAttendance}
        setSelectedAttendance={setSelectedAttendance}
        isSuperAdminOrBos={isSuperAdminOrBos}
        editAttOtHours={editAttOtHours}
        setEditAttOtHours={setEditAttOtHours}
        handleUpdateAttendanceRecord={handleUpdateAttendanceRecord}
        savingAttDetail={savingAttDetail}
      />

      <ScheduleSettingsDialog
        open={scheduleModalOpen}
        onOpenChange={setScheduleModalOpen}
        workStartTime={workStartTime}
        setWorkStartTime={setWorkStartTime}
        workEndTime={workEndTime}
        setWorkEndTime={setWorkEndTime}
        lateTolerance={lateTolerance}
        setLateTolerance={setLateTolerance}
        breakStartTime={breakStartTime}
        setBreakStartTime={setBreakStartTime}
        breakEndTime={breakEndTime}
        setBreakEndTime={setBreakEndTime}
        otCalculationMode={otCalculationMode}
        setOtCalculationMode={setOtCalculationMode}
        otThresholdHours={otThresholdHours}
        setOtThresholdHours={setOtThresholdHours}
        otMinMinutes={otMinMinutes}
        setOtMinMinutes={setOtMinMinutes}
        savingSchedule={savingSchedule}
        onSave={handleSaveSchedule}
      />
    </ScrollView>
  );
}
