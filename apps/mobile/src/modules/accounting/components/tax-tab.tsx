import * as React from "react";
import { View, ScrollView, Pressable, TextInput } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Panel, KpiCard } from "@/components/taska/basics";
import { rupiah } from "@/lib/format";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import { CheckCircle2, Send, Calendar } from "lucide-react-native";
import { colors } from "@/tokens";

interface TaxTabProps {
  onRefreshParent?: () => void;
}

export function TaxTab({ onRefreshParent }: TaxTabProps) {
  const { toast } = useApp();
  const [year, setYear] = React.useState(new Date().getFullYear());
  const [month, setMonth] = React.useState(new Date().getMonth() + 1);
  const [summary, setSummary] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);
  const [settling, setSettling] = React.useState(false);
  const [remitting, setRemitting] = React.useState<string | null>(null);

  // Modal / Form input untuk setor pajak PPh / BPJS
  const [remitType, setRemitType] = React.useState<"PPH21" | "PPH23" | "PPH42" | "BPJS" | "PPH25" | null>(null);
  const [remitAmount, setRemitAmount] = React.useState("");
  const [payAccountCode, setPayAccountCode] = React.useState("1000.02");

  const fetchTax = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<any>("GET", `/accounting/tax/summary?year=${year}&month=${month}`);
      setSummary(res);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  React.useEffect(() => {
    let active = true;
    api<any>("GET", `/accounting/tax/summary?year=${year}&month=${month}`)
      .then((res) => {
        if (active) setSummary(res);
      })
      .catch(() => {
        if (active) setSummary(null);
      });

    return () => {
      active = false;
    };
  }, [year, month]);

  const handleSettleVat = async () => {
    setSettling(true);
    try {
      const res: any = await api("POST", "/accounting/tax/vat-settlement", {
        year,
        month,
        date: new Date().toISOString().slice(0, 10),
        payAccountCode,
      });
      toast(res?.message || "Settlement / kompensasi PPN Masa berhasil diposting ke jurnal.", "success");
      void fetchTax();
      onRefreshParent?.();
    } catch (e: any) {
      toast(e?.message || "Gagal melakukan settlement PPN", "danger");
    } finally {
      setSettling(false);
    }
  };

  const handleRemitWithholding = async () => {
    if (!remitType) return;
    const amt = parseFloat(remitAmount.replace(/\D/g, ""));
    if (!amt || amt <= 0) {
      toast("Nominal penyetoran pajak tidak valid.", "danger");
      return;
    }
    setRemitting(remitType);
    try {
      await api("POST", "/accounting/tax/withholding-remittance", {
        taxType: remitType,
        amount: amt,
        date: new Date().toISOString().slice(0, 10),
        payAccountCode,
        memo: `Setoran Pajak ${remitType} Masa ${month}/${year}`,
      });
      toast(`Setoran ${remitType} sebesar ${rupiah(amt)} berhasil dicatat di jurnal.`, "success");
      setRemitType(null);
      setRemitAmount("");
      void fetchTax();
      onRefreshParent?.();
    } catch (e: any) {
      toast(e?.message || "Gagal mencatat setoran pajak", "danger");
    } finally {
      setRemitting(null);
    }
  };

  const vatOut = Number(summary?.vat?.vatOut ?? summary?.vat?.output ?? 0);
  const vatIn = Number(summary?.vat?.vatIn ?? summary?.vat?.input ?? 0);
  const vatPayable = Number(summary?.vat?.vatPayable ?? summary?.vat?.netPayable ?? 0);
  const vatCompensation = Number(summary?.vat?.vatCompensation ?? summary?.vat?.compensation ?? 0);

  const pph21 = Number(summary?.withholding?.pph21 ?? summary?.withholdingPayables?.pph21 ?? 0);
  const pph23Vendor = Number(summary?.withholding?.pph23Vendor ?? summary?.withholdingPayables?.pph23Vendor ?? 0);
  const pph42 = Number(summary?.withholding?.pph42 ?? summary?.withholdingPayables?.pph42 ?? 0);
  const bpjs = Number(summary?.withholding?.bpjs ?? summary?.withholdingPayables?.bpjs ?? 0);
  const pph23Customer = Number(summary?.prepaid?.pph23Customer ?? summary?.prepaidTax?.pph23Customer ?? 0);
  const pph25Prepaid = Number(summary?.prepaid?.pph25Prepaid ?? summary?.prepaidTax?.pph25Prepaid ?? 0);

  const monthsList = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  return (
    <View className="gap-5 w-full">
      {/* Month & Year Filter Bar */}
      <View className="bg-panel/70 border border-border/80 rounded-2xl p-3.5 flex-row flex-wrap items-center justify-between gap-3">
        <View className="flex-row items-center gap-2">
          <Calendar size={16} color={colors.primary} />
          <Text className="text-xs font-bold text-foreground">
            Masa Pajak: {monthsList[month - 1]} {year}
          </Text>
        </View>

        <View className="flex-row items-center gap-2">
          {/* Quick Month Select */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-1.5 max-w-xl">
            {monthsList.map((mName, idx) => {
              const mVal = idx + 1;
              const isSelected = month === mVal;
              return (
                <Pressable
                  key={mVal}
                  onPress={() => setMonth(mVal)}
                  className={`px-2.5 py-1 rounded-lg border transition-all ${
                    isSelected
                      ? "bg-primary border-primary"
                      : "bg-panel/80 border-border/60 hover:bg-card"
                  }`}
                >
                  <Text className={`text-[11px] font-medium ${isSelected ? "text-white" : "text-muted-foreground"}`}>
                    {mName.slice(0, 3)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Year Buttons */}
          <View className="flex-row items-center gap-1 border-l border-border/60 pl-2">
            {[2025, 2026, 2027].map((y) => (
              <Pressable
                key={y}
                onPress={() => setYear(y)}
                className={`px-2.5 py-1 rounded-lg border ${
                  year === y ? "bg-primary/20 border-primary" : "bg-panel border-border/60"
                }`}
              >
                <Text className={`text-[11px] font-mono ${year === y ? "text-primary font-bold" : "text-muted-foreground"}`}>
                  {y}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <View className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 w-full">
        <KpiCard
          label="PPN Keluaran (Penjualan)"
          value={rupiah(vatOut)}
          hint="Kredit akun [2100] PPN Keluaran"
          tone="info"
        />
        <KpiCard
          label="PPN Masukan (Pembelian)"
          value={rupiah(vatIn)}
          hint="Debit akun [1600] PPN Masukan"
          tone="success"
        />
        <KpiCard
          label="PPN Kurang Bayar (KB)"
          value={rupiah(vatPayable)}
          hint={vatPayable > 0 ? "Wajib disetor ke Kas Negara" : "Nihil / Lebih Bayar"}
          tone={vatPayable > 0 ? "danger" : undefined}
        />
        <KpiCard
          label="PPN Lebih Bayar (LB)"
          value={rupiah(vatCompensation)}
          hint="Hak kompensasi ke masa berikutnya"
          tone={vatCompensation > 0 ? "warning" : undefined}
        />
      </View>

      {/* Panel SPT PPN */}
      <Panel
        title={`Rekapitulasi SPT Masa PPN (${monthsList[month - 1]} ${year})`}
        subtitle="Perhitungan kompensasi PPN Keluaran terhadap PPN Masukan PKP PT Ghina Multi Prima"
        right={
          vatOut > 0 || vatIn > 0 ? (
            <Button size="sm" onPress={handleSettleVat} disabled={settling} className="h-8 gap-1.5">
              <CheckCircle2 size={13} color="#FFFFFF" />
              <Text className="text-xs text-white">Proses Kompensasi / Setor PPN</Text>
            </Button>
          ) : null
        }
      >
        <View className="gap-3">
          <View className="bg-panel/50 border border-border/80 rounded-xl p-3.5 gap-2">
            <View className="flex-row justify-between items-center py-1">
              <Text className="text-xs text-muted-foreground">[2100] PPN Keluaran Terutang Atas Penyerahan BKP/JKP:</Text>
              <Text className="text-xs font-mono font-bold">{rupiah(vatOut)}</Text>
            </View>
            <View className="flex-row justify-between items-center py-1 border-t border-border/40">
              <Text className="text-xs text-muted-foreground">[1600] PPN Masukan yang Dapat Dikreditkan:</Text>
              <Text className="text-xs font-mono font-bold text-success">({rupiah(vatIn)})</Text>
            </View>
            <View className="flex-row justify-between items-center py-2 border-t border-border">
              <Text className="text-sm font-bold">Status SPT Masa PPN:</Text>
              <Text
                className={`text-sm font-bold font-mono ${
                  vatPayable > 0 ? "text-danger" : vatCompensation > 0 ? "text-warning" : "text-primary"
                }`}
              >
                {vatPayable > 0
                  ? `Kurang Bayar: ${rupiah(vatPayable)}`
                  : vatCompensation > 0
                  ? `Lebih Bayar: ${rupiah(vatCompensation)} (Kompensasi)`
                  : "Nihil (Rp 0)"}
              </Text>
            </View>
          </View>
        </View>
      </Panel>

      {/* Panel Withholding PPh & BPJS */}
      <Panel
        title="Kewajiban Pajak Penghasilan (Withholding Tax PPh & BPJS)"
        subtitle="Saldo hutang berjalan pemotongan PPh 21, PPh 23, PPh 4(2), dan BPJS yang wajib disetor ke kas negara / kas BPJS"
      >
        <View className="gap-2">
          <View className="flex-row justify-between items-center py-2 border-b border-border/40">
            <View>
              <Text className="text-xs font-semibold text-foreground">[2105] Hutang PPh Pasal 21 (Gaji Staf/Karyawan):</Text>
              <Text className="text-[11px] text-muted-foreground">Kewajiban setor pemotongan PPh 21 atas slip gaji</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-xs font-mono font-bold">{rupiah(pph21)}</Text>
              {pph21 > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => {
                    setRemitType("PPH21");
                    setRemitAmount(String(pph21));
                  }}
                  className="h-7 px-2"
                >
                  <Text className="text-[11px]">Setor</Text>
                </Button>
              )}
            </View>
          </View>

          <View className="flex-row justify-between items-center py-2 border-b border-border/40">
            <View>
              <Text className="text-xs font-semibold text-foreground">[2106] Hutang PPh Pasal 23 (Jasa Vendor/Subkon):</Text>
              <Text className="text-[11px] text-muted-foreground">Kewajiban setor pemotongan jasa vendor pihak ketiga</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-xs font-mono font-bold">{rupiah(pph23Vendor)}</Text>
              {pph23Vendor > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => {
                    setRemitType("PPH23");
                    setRemitAmount(String(pph23Vendor));
                  }}
                  className="h-7 px-2"
                >
                  <Text className="text-[11px]">Setor</Text>
                </Button>
              )}
            </View>
          </View>

          <View className="flex-row justify-between items-center py-2 border-b border-border/40">
            <View>
              <Text className="text-xs font-semibold text-foreground">[2107] Hutang Iuran BPJS Ketenagakerjaan & Kesehatan:</Text>
              <Text className="text-[11px] text-muted-foreground">Akumulasi iuran tanggungan perusahaan & karyawan</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-xs font-mono font-bold">{rupiah(bpjs)}</Text>
              {bpjs > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => {
                    setRemitType("BPJS");
                    setRemitAmount(String(bpjs));
                  }}
                  className="h-7 px-2"
                >
                  <Text className="text-[11px]">Setor</Text>
                </Button>
              )}
            </View>
          </View>

          <View className="flex-row justify-between items-center py-2 border-b border-border/40">
            <View>
              <Text className="text-xs font-semibold text-foreground">[1105.01] Uang Muka PPh 23 (Kredit Pajak Customer):</Text>
              <Text className="text-[11px] text-muted-foreground">Bukti potong yang diterima dari customer saat pelunasan termin</Text>
            </View>
            <Text className="text-xs font-mono font-bold text-primary">{rupiah(pph23Customer)}</Text>
          </View>

          <View className="flex-row justify-between items-center py-2">
            <View>
              <Text className="text-xs font-semibold text-foreground">[1105.02] Uang Muka PPh 25 (Angsuran Pajak Badan):</Text>
              <Text className="text-[11px] text-muted-foreground">Kredit pajak angsuran tahunan berjalan</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-xs font-mono font-bold text-primary">{rupiah(pph25Prepaid)}</Text>
              <Button
                size="sm"
                variant="outline"
                onPress={() => {
                  setRemitType("PPH25");
                  setRemitAmount("");
                }}
                className="h-7 px-2"
              >
                <Text className="text-[11px]">+ Bayar PPh 25</Text>
              </Button>
            </View>
          </View>
        </View>

        {/* Modal / Inline Penyetoran Pajak */}
        {remitType && (
          <View className="mt-4 p-3.5 bg-primary/5 border border-primary/30 rounded-xl gap-3">
            <Text className="text-xs font-bold text-primary">
              Formulir Penyetoran Kas / Bank: {remitType}
            </Text>
            <View className="flex-row flex-wrap items-center gap-3">
              <View className="flex-1 min-w-[140px]">
                <Text className="text-[10px] text-muted-foreground mb-1">Nominal Setor (Rp):</Text>
                <TextInput
                  value={remitAmount}
                  onChangeText={setRemitAmount}
                  keyboardType="numeric"
                  placeholder="0"
                  className="bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-mono"
                />
              </View>
              <View className="flex-1 min-w-[140px]">
                <Text className="text-[10px] text-muted-foreground mb-1">Akun Kas/Bank:</Text>
                <View className="bg-card border border-border rounded-lg px-2.5 py-1.5">
                  <Text className="text-xs font-mono text-foreground">[1000.02] Bank Mandiri PT GMP</Text>
                </View>
              </View>
              <View className="flex-row items-end gap-2 pt-3">
                <Button size="sm" onPress={handleRemitWithholding} disabled={!!remitting} className="h-8 gap-1.5">
                  <Send size={12} color="#FFFFFF" />
                  <Text className="text-xs text-white">Posting Setoran</Text>
                </Button>
                <Button size="sm" variant="ghost" onPress={() => setRemitType(null)} className="h-8">
                  <Text className="text-xs text-muted-foreground">Batal</Text>
                </Button>
              </View>
            </View>
          </View>
        )}
      </Panel>
    </View>
  );
}
