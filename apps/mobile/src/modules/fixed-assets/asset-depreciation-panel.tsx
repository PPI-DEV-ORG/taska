import * as React from "react";
import { View, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/taska/dialogs";
import { Calculator, Play, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react-native";
import { api } from "@/services/api";

type Props = {
  onDepreciationPosted?: () => void;
};

export function AssetDepreciationPanel({ onDepreciationPosted }: Props) {
  const now = new Date();
  const [periodYear, setPeriodYear] = React.useState(now.getFullYear());
  const [periodMonth, setPeriodMonth] = React.useState(now.getMonth() + 1);

  const [loading, setLoading] = React.useState(true);
  const [posting, setPosting] = React.useState(false);
  const [reportData, setReportData] = React.useState<any[]>([]);
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    api<any[]>(
      "GET",
      `/fixed-assets/reports/depreciation?year=${periodYear}&month=${periodMonth}`,
    )
      .then((data) => {
        if (active) setReportData(data || []);
      })
      .catch((err: any) => {
        if (active) setError(err?.message || "Gagal mengambil data penyusutan.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [periodYear, periodMonth, refreshKey]);

  const handleExecuteDepreciation = async () => {
    setPosting(true);
    setError("");
    setMessage("");
    try {
      const res: any = await api("POST", "/fixed-assets/depreciation/post-monthly", {
        periodYear,
        periodMonth,
      });
      setMessage(res?.message || "Depresiasi bulanan berhasil diproses.");
      setLoading(true);
      setRefreshKey((k) => k + 1);
      if (onDepreciationPosted) onDepreciationPosted();
    } catch (err: any) {
      setError(err?.message || "Gagal memposting depresiasi bulanan.");
    } finally {
      setPosting(false);
    }
  };

  const totalPostedAmount = reportData.reduce(
    (acc, curr) => acc + Number(curr.depreciationAmount || 0),
    0,
  );

  return (
    <View className="gap-5">
      {/* Action Header Card */}
      <View className="bg-background rounded-2xl border border-border p-5 shadow-sm">
        <View className="flex-row items-center justify-between pb-4 border-b border-border">
          <View className="flex-row items-center gap-3">
            <View className="bg-primary/10 p-2.5 rounded-xl">
              <Calculator size={24} className="text-primary" />
            </View>
            <View>
              <Text className="text-base font-bold text-foreground">
                Eksekusi Jurnal Penyusutan Bulanan (PRD Hal. 10–11)
              </Text>
              <Text className="text-xs text-muted-foreground">
                Menghitung depresiasi aset berwujud garis lurus dan otomatis posting jurnal (Debit{" "}
                <Text className="font-mono font-bold text-primary">6101</Text> / Kredit{" "}
                <Text className="font-mono font-bold text-primary">159x</Text>).
              </Text>
            </View>
          </View>
        </View>

        {/* Filter Periode & Execute Button */}
        <View className="flex-row items-center justify-between pt-4 gap-4 flex-wrap">
          <View className="flex-row items-center gap-3">
            <View className="flex-row items-center gap-2">
              <Text className="text-xs font-semibold text-foreground">Tahun:</Text>
              <View className="w-28">
                <SearchableSelect
                  value={String(periodYear)}
                  options={["2024", "2025", "2026", "2027", "2028"]}
                  onChange={(val) => setPeriodYear(Number(val))}
                  placeholder="Tahun"
                  className="h-9 rounded-lg bg-card border-border/80 px-2.5 text-xs"
                />
              </View>
            </View>

            <View className="flex-row items-center gap-2">
              <Text className="text-xs font-semibold text-foreground">Bulan:</Text>
              <View className="w-40">
                <SearchableSelect
                  value={
                    [
                      "01 - Januari",
                      "02 - Februari",
                      "03 - Maret",
                      "04 - April",
                      "05 - Mei",
                      "06 - Juni",
                      "07 - Juli",
                      "08 - Agustus",
                      "09 - September",
                      "10 - Oktober",
                      "11 - November",
                      "12 - Desember",
                    ][periodMonth - 1]
                  }
                  options={[
                    "01 - Januari",
                    "02 - Februari",
                    "03 - Maret",
                    "04 - April",
                    "05 - Mei",
                    "06 - Juni",
                    "07 - Juli",
                    "08 - Agustus",
                    "09 - September",
                    "10 - Oktober",
                    "11 - November",
                    "12 - Desember",
                  ]}
                  onChange={(val) => {
                    const mNum = parseInt(val.slice(0, 2), 10);
                    if (!isNaN(mNum)) setPeriodMonth(mNum);
                  }}
                  placeholder="Bulan"
                  className="h-9 rounded-lg bg-card border-border/80 px-2.5 text-xs"
                />
              </View>
            </View>

            <Button
              size="sm"
              variant="ghost"
              onPress={() => {
                setLoading(true);
                setRefreshKey((k) => k + 1);
              }}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </Button>
          </View>

          <Button
            variant="default"
            size="sm"
            className="gap-2 bg-primary"
            onPress={handleExecuteDepreciation}
            disabled={posting}
          >
            {posting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Play size={14} color="#fff" />
                <Text className="text-xs font-bold text-white">
                  Posting Depresiasi Periode Ini
                </Text>
              </>
            )}
          </Button>
        </View>

        {/* Message Banner */}
        {message ? (
          <View className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl mt-4 flex-row items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <Text className="text-xs text-emerald-800 font-medium">{message}</Text>
          </View>
        ) : null}

        {error ? (
          <View className="bg-destructive/10 border border-destructive/20 p-3 rounded-xl mt-4 flex-row items-center gap-2">
            <AlertCircle size={16} className="text-destructive shrink-0" />
            <Text className="text-xs text-destructive font-medium">{error}</Text>
          </View>
        ) : null}
      </View>

      {/* Tabel Jurnal Depresiasi Terposting */}
      <View className="bg-background rounded-2xl border border-border overflow-hidden shadow-sm">
        <View className="px-5 py-3.5 border-b border-border bg-muted/20 flex-row items-center justify-between">
          <View>
            <Text className="text-xs font-bold text-foreground">
              Daftar Depresiasi Terposting Periode {periodYear}-
              {String(periodMonth).padStart(2, "0")}
            </Text>
            <Text className="text-[11px] text-muted-foreground">
              Total Beban Terposting: Rp {totalPostedAmount.toLocaleString("id-ID")} ({reportData.length} Aset)
            </Text>
          </View>
        </View>

        {loading ? (
          <View className="py-12 items-center justify-center">
            <ActivityIndicator size="small" className="text-primary" />
            <Text className="text-xs text-muted-foreground mt-2">Memuat data penyusutan...</Text>
          </View>
        ) : reportData.length === 0 ? (
          <View className="py-12 items-center justify-center px-4">
            <Calculator size={32} className="text-muted-foreground/40 mb-2" />
            <Text className="text-xs font-medium text-foreground">
              Belum ada depresiasi yang diposting untuk periode {periodYear}-
              {String(periodMonth).padStart(2, "0")}.
            </Text>
            <Text className="text-[11px] text-muted-foreground mt-0.5 text-center max-w-md">
              Klik tombol &quot;Posting Depresiasi Periode Ini&quot; di atas untuk memproses perhitungan susut
              ke jurnal umum.
            </Text>
          </View>
        ) : (
          <View className="overflow-x-auto">
            <View className="flex-row bg-muted/40 px-5 py-2.5 border-b border-border">
              <Text className="w-32 text-xs font-bold text-muted-foreground">Kode Aset</Text>
              <Text className="flex-1 text-xs font-bold text-muted-foreground">Nama Aset</Text>
              <Text className="w-36 text-xs font-bold text-muted-foreground">Kategori</Text>
              <Text className="w-32 text-xs font-bold text-muted-foreground text-right">
                Beban Susut (6101)
              </Text>
              <Text className="w-32 text-xs font-bold text-muted-foreground text-right">
                Akumulasi Susut
              </Text>
              <Text className="w-32 text-xs font-bold text-muted-foreground text-right">
                Nilai Buku Akhir
              </Text>
              <Text className="w-24 text-xs font-bold text-muted-foreground text-center">
                Jurnal GL
              </Text>
            </View>

            {reportData.map((row: any) => (
              <View
                key={row.id}
                className="flex-row px-5 py-2.5 border-b border-border/50 items-center hover:bg-muted/10"
              >
                <Text className="w-32 text-xs font-mono font-bold text-primary">
                  {row.asset?.assetCode}
                </Text>
                <Text className="flex-1 text-xs font-semibold text-foreground pr-2" numberOfLines={1}>
                  {row.asset?.name}
                </Text>
                <Text className="w-36 text-xs text-muted-foreground">
                  {row.asset?.category?.name || "-"}
                </Text>
                <Text className="w-32 text-xs font-bold text-foreground text-right">
                  Rp {Number(row.depreciationAmount).toLocaleString("id-ID")}
                </Text>
                <Text className="w-32 text-xs text-muted-foreground text-right">
                  Rp {Number(row.accumulatedDepreciation).toLocaleString("id-ID")}
                </Text>
                <Text className="w-32 text-xs font-bold text-foreground text-right">
                  Rp {Number(row.endingBookValue).toLocaleString("id-ID")}
                </Text>
                <View className="w-24 items-center">
                  <View className="bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <Text className="text-[10px] font-bold text-emerald-700">POSTED</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
