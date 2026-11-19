import * as React from "react";
import { View, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  X,
  QrCode,
  UserCheck,
  ArrowRightLeft,
  Trash2,
  Edit,
  Calendar,
  Building,
  User,
  ShieldAlert,
  Wrench,
  BookOpen,
  DollarSign,
} from "lucide-react-native";
import { FaAsset, CONDITION_COLORS, STATUS_COLORS } from "./types";
import { tanggal } from "@/lib/format";
import { api } from "@/services/api";

type Props = {
  visible: boolean;
  onClose: () => void;
  assetId: number | null;
  onOpenQr: (asset: FaAsset) => void;
  onOpenAssign: (asset: FaAsset) => void;
  onOpenTransfer: (asset: FaAsset) => void;
  onOpenDisposal: (asset: FaAsset) => void;
  onOpenEdit: (asset: FaAsset) => void;
};

export function AssetDetailModal(props: Props) {
  if (!props.visible || !props.assetId) return null;
  return <AssetDetailContent key={props.assetId} {...props} assetId={props.assetId} />;
}

function AssetDetailContent({
  visible,
  onClose,
  assetId,
  onOpenQr,
  onOpenAssign,
  onOpenTransfer,
  onOpenDisposal,
  onOpenEdit,
}: Props & { assetId: number }) {
  const [asset, setAsset] = React.useState<FaAsset | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<
    "overview" | "depreciation" | "assignments" | "transfers" | "maintenance" | "ledger"
  >("overview");

  React.useEffect(() => {
    let active = true;
    api<FaAsset>("GET", `/fixed-assets/${assetId}`)
      .then((res) => {
        if (active) setAsset(res);
      })
      .catch(() => {
        // network / offline handled silently
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [assetId]);

  if (!visible) return null;

  const cond = asset?.condition ? CONDITION_COLORS[asset.condition] : null;
  const stat = asset?.status ? STATUS_COLORS[asset.status] : null;

  return (
    <Dialog open={visible} onOpenChange={(op) => { if (!op) onClose(); }}>
      <DialogContent className="w-[96vw] max-w-5xl max-h-[92vh] gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 py-3.5 border-b border-border bg-muted/10 pr-14">
          <View className="flex-row items-center justify-between gap-3 flex-wrap">
            <View className="flex-row items-center gap-3">
              <View className="bg-primary/10 p-2 rounded-xl">
                <BookOpen size={24} className="text-primary" />
              </View>

              <View>
                <View className="flex-row items-center gap-2 flex-wrap">
                  <DialogTitle className="text-lg font-bold text-foreground">
                    {asset?.assetCode || "..."}
                  </DialogTitle>
                  {stat ? (
                    <View
                      className="px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: stat.bg }}
                    >
                      <Text className="text-[10px] font-bold" style={{ color: stat.text }}>
                        {stat.label}
                      </Text>
                    </View>
                  ) : null}
                  {cond ? (
                    <View
                      className="px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: cond.bg }}
                    >
                      <Text className="text-[10px] font-bold" style={{ color: cond.text }}>
                        {cond.label}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text className="text-sm font-semibold text-muted-foreground">{asset?.name}</Text>
              </View>
            </View>

            <View className="flex-row items-center gap-1.5 flex-wrap">
              {asset && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-8 px-2.5"
                    onPress={() => onOpenQr(asset)}
                  >
                    <QrCode size={13} className="text-foreground" />
                    <Text className="text-xs">QR Label</Text>
                  </Button>
                  {asset.status !== "DISPOSED" && asset.status !== "WRITTEN_OFF" ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 h-8 px-2.5"
                        onPress={() => onOpenAssign(asset)}
                      >
                        <UserCheck size={13} className="text-foreground" />
                        <Text className="text-xs">Serah Terima</Text>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 h-8 px-2.5"
                        onPress={() => onOpenTransfer(asset)}
                      >
                        <ArrowRightLeft size={13} className="text-foreground" />
                        <Text className="text-xs">Mutasi</Text>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 h-8 px-2.5 text-destructive border-destructive/20 hover:bg-destructive/10"
                        onPress={() => onOpenDisposal(asset)}
                      >
                        <Trash2 size={13} className="text-destructive" />
                        <Text className="text-xs text-destructive">Disposal</Text>
                      </Button>
                    </>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={() => onOpenEdit(asset)}
                    className="h-8 w-8 p-0"
                  >
                    <Edit size={15} className="text-muted-foreground" />
                  </Button>
                </>
              )}
            </View>
          </View>
        </DialogHeader>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="border-b border-border bg-muted/20 flex-shrink-0"
          contentContainerStyle={{ paddingHorizontal: 24, gap: 20 }}
        >
          {[
            { id: "overview", label: "Ringkasan & Finansial" },
            { id: "depreciation", label: "Jadwal Depresiasi" },
            { id: "assignments", label: "Riwayat PIC (Assignment)" },
            { id: "transfers", label: "Riwayat Mutasi" },
            { id: "maintenance", label: "Riwayat Perawatan" },
            { id: "ledger", label: "Buku Pembantu (Ledger)" },
          ].map((t) => (
            <TouchableOpacity
              key={t.id}
              onPress={() => setActiveTab(t.id as any)}
              className={`py-3 border-b-2 ${
                activeTab === t.id ? "border-primary" : "border-transparent"
              }`}
            >
              <Text
                className={`text-xs font-bold whitespace-nowrap ${
                  activeTab === t.id ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Body Content */}
          {loading ? (
            <View className="py-20 items-center justify-center">
              <ActivityIndicator size="large" className="text-primary" />
              <Text className="text-xs text-muted-foreground mt-2">Memuat detail aset...</Text>
            </View>
          ) : !asset ? (
            <View className="py-12 items-center">
              <Text className="text-sm text-muted-foreground">Data aset tidak ditemukan.</Text>
            </View>
          ) : (
            <ScrollView className="p-6 max-h-[65vh]" showsVerticalScrollIndicator={false}>
              {/* TAB 1: OVERVIEW & FINANSIAL */}
              {activeTab === "overview" && (
                <View className="gap-5">
                  {/* KPI Cards Ringkasan Nilai */}
                  <View className="flex-row gap-3">
                    <View className="flex-1 bg-muted/30 p-3.5 rounded-xl border border-border">
                      <Text className="text-[11px] text-muted-foreground font-medium">
                        Harga Perolehan Awal
                      </Text>
                      <Text className="text-base font-bold text-foreground mt-0.5">
                        Rp {Number(asset.acquisitionCost).toLocaleString("id-ID")}
                      </Text>
                      <Text className="text-[10px] text-muted-foreground mt-1">
                        Tgl Perolehan: {asset.acquisitionDate ? tanggal(asset.acquisitionDate) : "-"}
                      </Text>
                    </View>

                    <View className="flex-1 bg-amber-500/10 p-3.5 rounded-xl border border-amber-500/20">
                      <Text className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                        Akumulasi Penyusutan
                      </Text>
                      <Text className="text-base font-bold text-amber-700 dark:text-amber-400 mt-0.5">
                        Rp {Number(asset.accumulatedDepreciation).toLocaleString("id-ID")}
                      </Text>
                      <Text className="text-[10px] text-muted-foreground mt-1">
                        Metode: {asset.depreciationMethod}
                      </Text>
                    </View>

                    <View className="flex-1 bg-emerald-500/10 p-3.5 rounded-xl border border-emerald-500/20">
                      <Text className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                        Nilai Buku Terkini (NBV)
                      </Text>
                      <Text className="text-base font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                        Rp {Number(asset.bookValue).toLocaleString("id-ID")}
                      </Text>
                      <Text className="text-[10px] text-muted-foreground mt-1">
                        Residu: Rp {Number(asset.residualValue).toLocaleString("id-ID")}
                      </Text>
                    </View>
                  </View>

                  {/* Detail Grid */}
                  <View className="bg-background rounded-xl border border-border p-4 gap-3">
                    <Text className="text-xs font-bold text-primary uppercase tracking-wider">
                      Spesifikasi & Informasi Operasional
                    </Text>
                    <View className="grid grid-cols-2 gap-4">
                      <View className="flex-row justify-between py-1.5 border-b border-border/50">
                        <Text className="text-xs text-muted-foreground">Kategori:</Text>
                        <Text className="text-xs font-semibold text-foreground">
                          {asset.category?.name} ({asset.type})
                        </Text>
                      </View>
                      <View className="flex-row justify-between py-1.5 border-b border-border/50">
                        <Text className="text-xs text-muted-foreground">Merek & Model:</Text>
                        <Text className="text-xs font-semibold text-foreground">
                          {asset.brand || "-"} {asset.model ? `(${asset.model})` : ""}
                        </Text>
                      </View>
                      <View className="flex-row justify-between py-1.5 border-b border-border/50">
                        <Text className="text-xs text-muted-foreground">Serial Number:</Text>
                        <Text className="text-xs font-mono font-bold text-foreground">
                          {asset.serialNumber || "-"}
                        </Text>
                      </View>
                      <View className="flex-row justify-between py-1.5 border-b border-border/50">
                        <Text className="text-xs text-muted-foreground">Lokasi Penempatan:</Text>
                        <Text className="text-xs font-semibold text-foreground">
                          {asset.location?.name || "-"}
                        </Text>
                      </View>
                      <View className="flex-row justify-between py-1.5 border-b border-border/50">
                        <Text className="text-xs text-muted-foreground">Departemen:</Text>
                        <Text className="text-xs font-semibold text-foreground">
                          {asset.department || "-"}
                        </Text>
                      </View>
                      <View className="flex-row justify-between py-1.5 border-b border-border/50">
                        <Text className="text-xs text-muted-foreground">Penanggung Jawab (PIC):</Text>
                        <Text className="text-xs font-semibold text-foreground">
                          {asset.assignedUser?.name || "Belum Ditugaskan"}
                        </Text>
                      </View>
                      <View className="flex-row justify-between py-1.5 border-b border-border/50">
                        <Text className="text-xs text-muted-foreground">Masa Manfaat:</Text>
                        <Text className="text-xs font-semibold text-foreground">
                          {asset.usefulLifeMonths} Bulan (
                          {(asset.usefulLifeMonths / 12).toFixed(1)} Tahun)
                        </Text>
                      </View>
                      <View className="flex-row justify-between py-1.5 border-b border-border/50">
                        <Text className="text-xs text-muted-foreground">Masa Garansi:</Text>
                        <Text className="text-xs font-semibold text-foreground">
                          {asset.warrantyExpiry ? tanggal(asset.warrantyExpiry) : "-"}
                        </Text>
                      </View>
                    </View>

                    {asset.description ? (
                      <View className="mt-2 pt-2 border-t border-border">
                        <Text className="text-xs text-muted-foreground mb-1">Catatan Tambahan:</Text>
                        <Text className="text-xs text-foreground leading-relaxed">
                          {asset.description}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Akun COA Terkait */}
                  <View className="bg-muted/20 rounded-xl border border-border p-4">
                    <Text className="text-xs font-bold text-foreground mb-2">
                      Pemetaan Bagan Akun (Chart of Accounts):
                    </Text>
                    <View className="flex-row gap-4">
                      <View className="flex-1 bg-background p-2.5 rounded-lg border border-border">
                        <Text className="text-[10px] text-muted-foreground">Akun Aset Tetap:</Text>
                        <Text className="text-xs font-bold font-mono text-primary">
                          {asset.category?.assetAccountCode || "1504"}
                        </Text>
                      </View>
                      <View className="flex-1 bg-background p-2.5 rounded-lg border border-border">
                        <Text className="text-[10px] text-muted-foreground">
                          Akun Akumulasi Susut:
                        </Text>
                        <Text className="text-xs font-bold font-mono text-primary">
                          {asset.category?.accumDepAccountCode || "1592"}
                        </Text>
                      </View>
                      <View className="flex-1 bg-background p-2.5 rounded-lg border border-border">
                        <Text className="text-[10px] text-muted-foreground">
                          Akun Beban Penyusutan:
                        </Text>
                        <Text className="text-xs font-bold font-mono text-primary">
                          {asset.category?.depExpenseAccountCode || "6101"}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* TAB 2: JADWAL DEPRESIASI BULANAN */}
              {activeTab === "depreciation" && (
                <View className="gap-3">
                  <View className="flex-row justify-between items-center mb-1">
                    <Text className="text-xs text-muted-foreground">
                      Jadwal kalkulasi penyusutan per bulan hingga akhir masa manfaat.
                    </Text>
                    <Text className="text-xs font-bold text-foreground">
                      Total Periode: {asset.depreciationSchedules?.length || 0} Bulan
                    </Text>
                  </View>

                  <View className="bg-background rounded-xl border border-border overflow-hidden">
                    <View className="flex-row bg-muted/40 px-4 py-2.5 border-b border-border">
                      <Text className="w-16 text-xs font-bold text-muted-foreground">Bulan</Text>
                      <Text className="w-28 text-xs font-bold text-muted-foreground">Periode</Text>
                      <Text className="flex-1 text-xs font-bold text-muted-foreground text-right">
                        Nilai Susut
                      </Text>
                      <Text className="flex-1 text-xs font-bold text-muted-foreground text-right">
                        Akumulasi Susut
                      </Text>
                      <Text className="flex-1 text-xs font-bold text-muted-foreground text-right">
                        Nilai Buku Akhir
                      </Text>
                      <Text className="w-24 text-xs font-bold text-muted-foreground text-center">
                        Status Jurnal
                      </Text>
                    </View>

                    {(asset.depreciationSchedules || []).length === 0 ? (
                      <View className="py-8 items-center">
                        <Text className="text-xs text-muted-foreground">
                          Aset ini tidak memiliki jadwal penyusutan (Metode NONE atau masa manfaat 0).
                        </Text>
                      </View>
                    ) : (
                      (asset.depreciationSchedules || []).map((s) => (
                        <View
                          key={s.id}
                          className="flex-row px-4 py-2 border-b border-border/50 items-center hover:bg-muted/10"
                        >
                          <Text className="w-16 text-xs font-mono text-muted-foreground">
                            #{s.monthIndex}
                          </Text>
                          <Text className="w-28 text-xs font-semibold text-foreground">
                            {s.periodYear}-{String(s.periodMonth).padStart(2, "0")}
                          </Text>
                          <Text className="flex-1 text-xs text-foreground font-medium text-right">
                            Rp {Number(s.depreciationAmount).toLocaleString("id-ID")}
                          </Text>
                          <Text className="flex-1 text-xs text-muted-foreground text-right">
                            Rp {Number(s.accumulatedDepreciation).toLocaleString("id-ID")}
                          </Text>
                          <Text className="flex-1 text-xs font-bold text-foreground text-right">
                            Rp {Number(s.endingBookValue).toLocaleString("id-ID")}
                          </Text>
                          <View className="w-24 items-center">
                            {s.isPosted ? (
                              <View className="bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                <Text className="text-[10px] font-bold text-emerald-700">POSTED</Text>
                              </View>
                            ) : (
                              <View className="bg-neutral-100 px-2 py-0.5 rounded">
                                <Text className="text-[10px] text-neutral-500">TERJADWAL</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              )}

              {/* TAB 3: RIWAYAT PIC / ASSIGNMENT */}
              {activeTab === "assignments" && (
                <View className="gap-3">
                  {(asset.assignments || []).length === 0 ? (
                    <View className="py-8 items-center bg-muted/20 rounded-xl border border-border">
                      <Text className="text-xs text-muted-foreground">
                        Belum ada riwayat serah terima penugasan (PIC) untuk aset ini.
                      </Text>
                    </View>
                  ) : (
                    (asset.assignments || []).map((asn) => (
                      <View
                        key={asn.id}
                        className="bg-background p-4 rounded-xl border border-border gap-2"
                      >
                        <View className="flex-row justify-between items-center">
                          <Text className="text-xs font-bold text-primary">{asn.code}</Text>
                          <View
                            className={`px-2 py-0.5 rounded-full ${
                              asn.status === "ACTIVE" ? "bg-emerald-100" : "bg-neutral-100"
                            }`}
                          >
                            <Text
                              className={`text-[10px] font-bold ${
                                asn.status === "ACTIVE" ? "text-emerald-800" : "text-neutral-600"
                              }`}
                            >
                              {asn.status === "ACTIVE" ? "AKTIF / SEDANG DIGUNAKAN" : "DIKEMBALIKAN"}
                            </Text>
                          </View>
                        </View>
                        <View className="flex-row justify-between text-xs">
                          <Text className="text-muted-foreground">Karyawan PIC:</Text>
                          <Text className="font-bold text-foreground">
                            {asn.assignedToUser?.name || "-"}
                          </Text>
                        </View>
                        <View className="flex-row justify-between text-xs">
                          <Text className="text-muted-foreground">Departemen:</Text>
                          <Text className="text-foreground">{asn.department || "-"}</Text>
                        </View>
                        <View className="flex-row justify-between text-xs">
                          <Text className="text-muted-foreground">Tanggal Serah Terima:</Text>
                          <Text className="text-foreground">{tanggal(asn.assignmentDate)}</Text>
                        </View>
                        {asn.returnDate && (
                          <View className="flex-row justify-between text-xs">
                            <Text className="text-muted-foreground">Tanggal Pengembalian:</Text>
                            <Text className="text-foreground">{tanggal(asn.returnDate)}</Text>
                          </View>
                        )}
                        {asn.notes && (
                          <View className="mt-1 pt-1 border-t border-border/50">
                            <Text className="text-[11px] text-muted-foreground">
                              Catatan BAST: {asn.notes}
                            </Text>
                          </View>
                        )}
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* TAB 4: RIWAYAT MUTASI / TRANSFER */}
              {activeTab === "transfers" && (
                <View className="gap-3">
                  {(asset.transfers || []).length === 0 ? (
                    <View className="py-8 items-center bg-muted/20 rounded-xl border border-border">
                      <Text className="text-xs text-muted-foreground">
                        Belum ada mutasi lokasi / ruangan untuk aset ini.
                      </Text>
                    </View>
                  ) : (
                    (asset.transfers || []).map((trf) => (
                      <View
                        key={trf.id}
                        className="bg-background p-4 rounded-xl border border-border gap-2"
                      >
                        <View className="flex-row justify-between items-center">
                          <Text className="text-xs font-bold text-primary">{trf.code}</Text>
                          <Text className="text-xs text-muted-foreground">{tanggal(trf.transferDate)}</Text>
                        </View>
                        <View className="flex-row justify-between text-xs">
                          <Text className="text-muted-foreground">Dari Departemen:</Text>
                          <Text className="text-foreground">{trf.fromDepartment || "-"}</Text>
                        </View>
                        <View className="flex-row justify-between text-xs">
                          <Text className="text-muted-foreground">Ke Departemen:</Text>
                          <Text className="font-bold text-foreground">
                            {trf.toDepartment || "-"}
                          </Text>
                        </View>
                        {trf.reason && (
                          <View className="mt-1 pt-1 border-t border-border/50">
                            <Text className="text-[11px] text-muted-foreground">
                              Alasan: {trf.reason}
                            </Text>
                          </View>
                        )}
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* TAB 5: RIWAYAT PEMELIHARAAN (MAINTENANCE) */}
              {activeTab === "maintenance" && (
                <View className="gap-3">
                  {(asset.maintenanceRefs || []).length === 0 ? (
                    <View className="py-8 items-center bg-muted/20 rounded-xl border border-border">
                      <Wrench size={24} className="text-muted-foreground mb-1" />
                      <Text className="text-xs text-muted-foreground">
                        Belum ada catatan servis / perbaikan yang terhubung untuk aset ini.
                      </Text>
                    </View>
                  ) : (
                    (asset.maintenanceRefs || []).map((m: any) => (
                      <View
                        key={m.id}
                        className="bg-background p-4 rounded-xl border border-border gap-1.5"
                      >
                        <View className="flex-row justify-between">
                          <Text className="text-xs font-bold text-foreground">
                            {m.description}
                          </Text>
                          <Text className="text-xs font-bold text-primary">
                            Rp {Number(m.cost).toLocaleString("id-ID")}
                          </Text>
                        </View>
                        <Text className="text-[11px] text-muted-foreground">
                          Tgl Servis: {tanggal(m.serviceDate)} · Teknisi: {m.technicianName || "-"} · Vendor:{" "}
                          {m.vendorName || "-"}
                        </Text>
                        {m.maintenanceReport && (
                          <Text className="text-[11px] text-primary">
                            Terkait Laporan Maintenance: {m.maintenanceReport.number} -{" "}
                            {m.maintenanceReport.title}
                          </Text>
                        )}
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* TAB 6: BUKU PEMBANTU (LEDGER) */}
              {activeTab === "ledger" && (
                <View className="gap-3">
                  <View className="bg-background rounded-xl border border-border overflow-hidden">
                    <View className="flex-row bg-muted/40 px-4 py-2.5 border-b border-border">
                      <Text className="w-24 text-xs font-bold text-muted-foreground">Tanggal</Text>
                      <Text className="w-28 text-xs font-bold text-muted-foreground">Transaksi</Text>
                      <Text className="flex-1 text-xs font-bold text-muted-foreground">Keterangan</Text>
                      <Text className="w-28 text-xs font-bold text-muted-foreground text-right">
                        Debit
                      </Text>
                      <Text className="w-28 text-xs font-bold text-muted-foreground text-right">
                        Kredit
                      </Text>
                      <Text className="w-28 text-xs font-bold text-muted-foreground text-right">
                        Nilai Buku
                      </Text>
                    </View>
                    {(asset.ledgerEntries || []).length === 0 ? (
                      <View className="py-8 items-center">
                        <Text className="text-xs text-muted-foreground">
                          Belum ada catatan mutasi nilai di buku pembantu aset.
                        </Text>
                      </View>
                    ) : (
                      (asset.ledgerEntries || []).map((l: any) => (
                        <View
                          key={l.id}
                          className="flex-row px-4 py-2 border-b border-border/50 items-center text-xs"
                        >
                          <Text className="w-24 text-xs text-muted-foreground">
                            {tanggal(l.transactionDate)}
                          </Text>
                          <Text className="w-28 text-xs font-bold text-foreground">
                            {l.transactionType}
                          </Text>
                          <Text className="flex-1 text-xs text-foreground truncate">
                            {l.description}
                          </Text>
                          <Text className="w-28 text-xs text-foreground text-right">
                            {Number(l.debit) > 0
                              ? `Rp ${Number(l.debit).toLocaleString("id-ID")}`
                              : "-"}
                          </Text>
                          <Text className="w-28 text-xs text-foreground text-right">
                            {Number(l.credit) > 0
                              ? `Rp ${Number(l.credit).toLocaleString("id-ID")}`
                              : "-"}
                          </Text>
                          <Text className="w-28 text-xs font-bold text-foreground text-right">
                            Rp {Number(l.bookValueAfter).toLocaleString("id-ID")}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              )}
            </ScrollView>
          )}

          {/* Footer */}
          <DialogFooter className="flex-row justify-end px-6 py-3 border-t border-border bg-muted/20">
            <Button variant="outline" onPress={onClose}>
              <Text>Tutup</Text>
            </Button>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
