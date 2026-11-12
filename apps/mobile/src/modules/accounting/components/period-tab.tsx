import * as React from "react";
import { View, ScrollView, TextInput } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/taska/basics";
import { ConfirmDialog } from "@/components/taska/dialogs";
import { rupiah } from "@/lib/format";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import { Lock, Unlock, CheckCircle2, AlertTriangle, CalendarCheck, FileSpreadsheet } from "lucide-react-native";
import { colors } from "@/tokens";

interface PeriodTabProps {
  onRefreshParent?: () => void;
}

export function PeriodTab({ onRefreshParent }: PeriodTabProps) {
  const { user, toast } = useApp();
  const roleLower = (user?.role || "").toLowerCase();
  const canApprove = ["super_admin", "admin", "bos"].includes(roleLower);
  const isSuperAdmin = roleLower === "super_admin";

  const [periods, setPeriods] = React.useState<any[]>([]);
  const [fiscalYears, setFiscalYears] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [actioning, setActioning] = React.useState<number | null>(null);

  // Reopen Dialog State
  const [reopenTarget, setReopenTarget] = React.useState<any | null>(null);
  const [reopenReason, setReopenReason] = React.useState("");

  // Fiscal Year Close State
  const [selectedFiscalYear, setSelectedFiscalYear] = React.useState(new Date().getFullYear());
  const [taxEstimatedInput, setTaxEstimatedInput] = React.useState("");
  const [closingFiscal, setClosingFiscal] = React.useState(false);

  const fetchPeriods = React.useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, fyRes] = await Promise.allSettled([
        api<any[]>("GET", "/accounting/periods"),
        api<any[]>("GET", "/accounting/fiscal-years"),
      ]);
      if (pRes.status === "fulfilled" && Array.isArray(pRes.value)) {
        setPeriods(pRes.value);
      }
      if (fyRes.status === "fulfilled" && Array.isArray(fyRes.value)) {
        setFiscalYears(fyRes.value);
      }
    } catch {
      setPeriods([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let active = true;
    Promise.allSettled([
      api<any[]>("GET", "/accounting/periods"),
      api<any[]>("GET", "/accounting/fiscal-years"),
    ]).then(([pRes, fyRes]) => {
      if (!active) return;
      if (pRes.status === "fulfilled" && Array.isArray(pRes.value)) {
        setPeriods(pRes.value);
      }
      if (fyRes.status === "fulfilled" && Array.isArray(fyRes.value)) {
        setFiscalYears(fyRes.value);
      }
    }).catch(() => {
      if (active) setPeriods([]);
    });

    return () => {
      active = false;
    };
  }, []);

  const handleRequestClose = async (p: any) => {
    setActioning(p.id);
    try {
      await api("POST", `/accounting/periods/${p.year}/${p.month}/request-close`);
      toast(`Pengajuan tutup buku ${p.year}-${String(p.month).padStart(2, "0")} berhasil dikirim.`, "success");
      void fetchPeriods();
      onRefreshParent?.();
    } catch (e: any) {
      toast(e?.message || "Gagal mengajukan tutup buku", "danger");
    } finally {
      setActioning(null);
    }
  };

  const handleApproveClose = async (p: any) => {
    setActioning(p.id);
    try {
      await api("POST", `/accounting/periods/${p.year}/${p.month}/approve-close`);
      toast(`Periode ${p.year}-${String(p.month).padStart(2, "0")} resmi DITUTUP (CLOSED). Posting transaksi terkunci.`, "success");
      void fetchPeriods();
      onRefreshParent?.();
    } catch (e: any) {
      toast(e?.message || "Gagal menyetujui tutup buku", "danger");
    } finally {
      setActioning(null);
    }
  };

  const handleExecuteReopen = async () => {
    if (!reopenTarget) return;
    if (!reopenReason.trim()) {
      toast("Alasan pembukaan kembali wajib diisi.", "danger");
      return;
    }
    const target = reopenTarget;
    setReopenTarget(null);
    setActioning(target.id);
    try {
      if (target.isFiscalYear) {
        await api("POST", `/accounting/fiscal-years/${target.year}/reopen`, {
          reopenReason: reopenReason.trim(),
        });
        toast(`Tahun buku ${target.year} berhasil dibuka kembali.`, "success");
      } else {
        await api("POST", `/accounting/periods/${target.year}/${target.month}/reopen`, {
          reopenReason: reopenReason.trim(),
        });
        toast(`Periode ${target.year}-${String(target.month).padStart(2, "0")} dibuka kembali (OPEN).`, "success");
      }
      setReopenReason("");
      void fetchPeriods();
      onRefreshParent?.();
    } catch (e: any) {
      toast(e?.message || "Gagal membuka periode", "danger");
    } finally {
      setActioning(null);
    }
  };

  const handleCloseFiscalYear = async () => {
    const taxAmt = parseFloat(taxEstimatedInput.replace(/\D/g, "") || "0");
    setClosingFiscal(true);
    try {
      await api("POST", `/accounting/fiscal-years/${selectedFiscalYear}/close`, {
        taxEstimated: taxAmt,
      });
      toast(`Tutup Tahun Buku ${selectedFiscalYear} berhasil diproses. Jurnal penutup & laba ditahan telah diposting.`, "success");
      setTaxEstimatedInput("");
      void fetchPeriods();
      onRefreshParent?.();
    } catch (e: any) {
      toast(e?.message || "Gagal melakukan tutup buku tahunan", "danger");
    } finally {
      setClosingFiscal(false);
    }
  };

  const currentFyStatus = fiscalYears.find((fy) => fy.year === selectedFiscalYear);

  return (
    <View className="gap-5 w-full">
      {/* SECTION 1: Tutup Buku Bulanan */}
      <Panel
        title="Daftar Periode Pembukuan & Kontrol Tutup Bulan"
        subtitle="Manajemen status periode akuntansi bulanan (OPEN, REQUESTED_CLOSE, CLOSED). Periode yang ditutup mengunci transaksi dari perubahan."
      >
        <View className="gap-2">
          {periods.length === 0 ? (
            <View className="py-8 items-center justify-center">
              <Text className="text-xs text-muted-foreground">Belum ada periode akuntansi yang dibuat.</Text>
            </View>
          ) : (
            periods.map((p) => {
              const isClosed = p.status === "CLOSED";
              const isRequested = p.status === "REQUESTED_CLOSE";
              const isOpen = p.status === "OPEN";

              return (
                <View
                  key={p.id}
                  className="bg-panel/60 border border-border/80 rounded-xl p-3.5 flex-row flex-wrap items-center justify-between gap-3"
                >
                  <View className="flex-row items-center gap-3">
                    {isClosed ? (
                      <Lock size={18} color={colors.danger} />
                    ) : isRequested ? (
                      <AlertTriangle size={18} color={colors.warning} />
                    ) : (
                      <Unlock size={18} color={colors.success} />
                    )}
                    <View>
                      <Text className="text-sm font-bold font-mono text-foreground">
                        Periode {p.year} - Bulan {String(p.month).padStart(2, "0")}
                      </Text>
                      <Text className="text-xs text-muted-foreground">
                        Status:{" "}
                        <Text
                          className={`font-bold ${
                            isClosed ? "text-danger" : isRequested ? "text-warning" : "text-success"
                          }`}
                        >
                          {p.status}
                        </Text>
                        {p.closedAt ? ` · Ditutup pada ${String(p.closedAt).slice(0, 10)}` : ""}
                        {p.reopenReason ? ` · Catatan: ${p.reopenReason}` : ""}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center gap-2">
                    {isOpen && (
                      <Button
                        size="sm"
                        variant="outline"
                        onPress={() => handleRequestClose(p)}
                        disabled={actioning === p.id}
                        className="h-8"
                      >
                        <Text className="text-xs">Ajukan Tutup Buku</Text>
                      </Button>
                    )}
                    {isRequested && canApprove && (
                      <Button
                        size="sm"
                        onPress={() => handleApproveClose(p)}
                        disabled={actioning === p.id}
                        className="h-8 gap-1.5"
                      >
                        <CheckCircle2 size={13} color="#FFFFFF" />
                        <Text className="text-xs text-white">Setujui Tutup Buku</Text>
                      </Button>
                    )}
                    {isClosed && canApprove && (
                      <Button
                        size="sm"
                        variant="outline"
                        onPress={() => {
                          setReopenTarget(p);
                          setReopenReason("");
                        }}
                        disabled={actioning === p.id}
                        className="h-8 gap-1 border-warning/40"
                      >
                        <Unlock size={12} color={colors.warning} />
                        <Text className="text-xs text-warning">Buka Kembali</Text>
                      </Button>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </Panel>

      {/* SECTION 2: Tutup Tahun Buku (Fiscal Year Closing) */}
      <Panel
        title="Tutup Tahun Buku (Fiscal Year Closing)"
        subtitle="Menutup seluruh akun nominal laba rugi (Pendapatan & Beban) ke Laba Ditahan (Retained Earnings 3102), akrual taksiran PPh Badan 29/28A, dan mengunci seluruh 12 bulan."
      >
        <View className="bg-panel/50 border border-border/80 rounded-xl p-4 gap-4">
          <View className="flex-row flex-wrap items-center justify-between gap-3">
            <View className="flex-row items-center gap-2">
              <CalendarCheck size={18} color={colors.primary} />
              <View>
                <Text className="text-sm font-bold text-foreground">
                  Tahun Buku {selectedFiscalYear}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Status:{" "}
                  <Text className={`font-bold ${currentFyStatus?.status === "CLOSED" ? "text-danger" : "text-success"}`}>
                    {currentFyStatus?.status || "OPEN / BERJALAN"}
                  </Text>
                  {currentFyStatus?.closedAt ? ` · Ditutup pada ${String(currentFyStatus.closedAt).slice(0, 10)}` : ""}
                </Text>
              </View>
            </View>

            {currentFyStatus?.status === "CLOSED" && isSuperAdmin && (
              <Button
                size="sm"
                variant="outline"
                onPress={() => {
                  setReopenTarget({ year: selectedFiscalYear, isFiscalYear: true });
                  setReopenReason("");
                }}
                className="h-8 border-warning/50"
              >
                <Unlock size={12} color={colors.warning} />
                <Text className="text-xs text-warning ml-1">Buka Kembali Tahun Buku</Text>
              </Button>
            )}
          </View>

          {(!currentFyStatus || currentFyStatus.status !== "CLOSED") && (
            <View className="pt-2 border-t border-border/60 gap-3">
              <View className="flex-row flex-wrap items-center gap-3">
                <View className="flex-1 min-w-[200px]">
                  <Text className="text-xs font-semibold text-foreground mb-1">
                    Taksiran Beban PPh Badan Tahunan (Rp):
                  </Text>
                  <TextInput
                    value={taxEstimatedInput}
                    onChangeText={setTaxEstimatedInput}
                    keyboardType="numeric"
                    placeholder="Contoh: 25000000"
                    className="bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground font-mono"
                  />
                  <Text className="text-[10px] text-muted-foreground mt-1">
                    Diakrualkan ke Dr 7201, mengkreditkan prepaid PPh 25 (1105.02) dan PPh 23 (1105.01), selisihnya ke PPh 29 (2109) atau 1106.
                  </Text>
                </View>

                {canApprove && (
                  <View className="items-end pt-3">
                    <Button
                      onPress={handleCloseFiscalYear}
                      disabled={closingFiscal}
                      className="h-9 px-4 gap-1.5"
                    >
                      <CheckCircle2 size={14} color="#FFFFFF" />
                      <Text className="text-xs font-semibold text-white">
                        {closingFiscal ? "Memproses..." : "Eksekusi Tutup Tahun Buku"}
                      </Text>
                    </Button>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      </Panel>

      {/* Dialog Alasan Buka Kembali */}
      {reopenTarget && (
        <View className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <View className="bg-card border border-border rounded-2xl p-5 max-w-md w-full gap-3 shadow-xl">
            <Text className="text-base font-bold text-foreground">
              Buka Kembali {reopenTarget.isFiscalYear ? `Tahun Buku ${reopenTarget.year}` : `Periode ${reopenTarget.year}-${String(reopenTarget.month).padStart(2, "0")}`}
            </Text>
            <Text className="text-xs text-muted-foreground">
              Masukkan alasan resmi pembukaan kembali periode akuntansi. Transaksi akan dapat diposting kembali setelah dibuka.
            </Text>
            <TextInput
              value={reopenReason}
              onChangeText={setReopenReason}
              placeholder="Contoh: Koreksi audit faktur retur & penyesuaian opname"
              multiline
              numberOfLines={3}
              className="bg-panel border border-border rounded-xl p-3 text-xs text-foreground"
            />
            <View className="flex-row justify-end gap-2 pt-2">
              <Button size="sm" variant="ghost" onPress={() => setReopenTarget(null)}>
                <Text className="text-xs text-muted-foreground">Batal</Text>
              </Button>
              <Button size="sm" onPress={handleExecuteReopen} className="bg-warning">
                <Text className="text-xs font-semibold text-white">Konfirmasi Buka Kembali</Text>
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
