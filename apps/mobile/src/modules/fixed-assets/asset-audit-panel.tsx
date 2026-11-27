import * as React from "react";
import { View, TouchableOpacity, ScrollView, ActivityIndicator, Platform } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/akuntra/dialogs";
import { BarcodeScannerModal } from "@/components/akuntra/barcode-scanner-modal";
import {
  Camera,
  ClipboardCheck,
  Plus,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Search,
  Check,
} from "lucide-react-native";
import { FaAudit, FaAuditItem, FaLocation } from "./types";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";

type Props = {
  locations: FaLocation[];
};

export function AssetAuditPanel({ locations }: Props) {
  const { toast } = useApp();
  const [audits, setAudits] = React.useState<FaAudit[]>([]);
  const [selectedAuditId, setSelectedAuditId] = React.useState<number | null>(null);
  const [selectedAudit, setSelectedAudit] = React.useState<FaAudit | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [scanning, setScanning] = React.useState(false);

  // New Audit Modal State
  const [showNewAudit, setShowNewAudit] = React.useState(false);
  const [auditTitle, setAuditTitle] = React.useState("");
  const [auditDept, setAuditDept] = React.useState("");
  const [auditLocationId, setAuditLocationId] = React.useState<number | undefined>(undefined);

  // Scan Input State
  const [scanInput, setScanInput] = React.useState("");
  const [cameraOpen, setCameraOpen] = React.useState(false);
  const [actualCondition, setActualCondition] = React.useState("GOOD");
  const [actualLocId, setActualLocId] = React.useState<number | undefined>(undefined);
  const [scanNotes, setScanNotes] = React.useState("");
  const [scanMessage, setScanMessage] = React.useState("");
  const [scanError, setScanError] = React.useState("");

  const safeLocations = Array.isArray(locations) ? locations : [];

  const locOptions = React.useMemo(
    () => [
      { value: 0, label: "-- Semua Lokasi --" },
      ...safeLocations.map((loc) => ({ value: loc.id, label: loc.name })),
    ],
    [safeLocations],
  );

  const CONDITION_OPTIONS = [
    { value: "EXCELLENT", label: "Kondisi: Sangat Baik" },
    { value: "GOOD", label: "Kondisi: Baik" },
    { value: "FAIR", label: "Kondisi: Cukup" },
    { value: "POOR", label: "Kondisi: Kurang" },
    { value: "BROKEN", label: "Kondisi: Rusak" },
  ];

  const fetchAudits = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<FaAudit[]>("GET", "/fixed-assets/audits");
      setAudits(data || []);
      if (!selectedAuditId && data && data.length > 0) {
        setSelectedAuditId(data[0]!.id);
      }
    } catch (err: any) {
      toast("Tidak dapat terhubung ke server (masalah jaringan)");
    } finally {
      setLoading(false);
    }
  }, [selectedAuditId, toast]);

  const fetchAuditDetail = React.useCallback(async (id: number) => {
    try {
      const detail = await api<FaAudit>("GET", `/fixed-assets/audits/${id}`);
      setSelectedAudit(detail);
    } catch (err: any) {
      toast("Tidak dapat terhubung ke server (masalah jaringan)");
    }
  }, [toast]);

  React.useEffect(() => {
    let active = true;
    api<FaAudit[]>("GET", "/fixed-assets/audits")
      .then((data) => {
        if (!active) return;
        const list = data || [];
        setAudits(list);
        if (!selectedAuditId && list.length > 0) {
          setSelectedAuditId(list[0]!.id);
        }
      })
      .catch(() => {
        if (active) toast("Tidak dapat terhubung ke server (masalah jaringan)");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [toast]);

  React.useEffect(() => {
    if (!selectedAuditId) return;
    let active = true;
    api<FaAudit>("GET", `/fixed-assets/audits/${selectedAuditId}`)
      .then((detail) => {
        if (active) setSelectedAudit(detail);
      })
      .catch(() => {
        if (active) toast("Tidak dapat terhubung ke server (masalah jaringan)");
      });
    return () => {
      active = false;
    };
  }, [selectedAuditId, toast]);

  const handleCreateAudit = async () => {
    if (!auditTitle.trim()) return;
    try {
      const newAudit: any = await api("POST", "/fixed-assets/audits", {
        title: auditTitle,
        auditDate: new Date().toISOString().slice(0, 10),
        department: auditDept || undefined,
        locationId: auditLocationId,
      });
      setShowNewAudit(false);
      setAuditTitle("");
      setAuditDept("");
      await fetchAudits();
      if (newAudit?.id) setSelectedAuditId(newAudit.id);
    } catch (err: any) {
      alert(err?.message || "Gagal membuat jadwal audit.");
    }
  };

  const handleScanSubmit = async () => {
    if (!scanInput.trim() || !selectedAuditId) return;
    setScanning(true);
    setScanMessage("");
    setScanError("");
    try {
      const updated = await api<FaAudit>("POST", `/fixed-assets/audits/${selectedAuditId}/scan`, {
        qrCodeOrAssetCode: scanInput.trim(),
        actualCondition,
        actualLocationId: actualLocId,
        notes: scanNotes || undefined,
      });
      setSelectedAudit(updated);
      setScanMessage(`Berhasil memverifikasi aset '${scanInput.trim()}'!`);
      setScanInput("");
      setScanNotes("");
      await fetchAudits();
    } catch (err: any) {
      setScanError(err?.message || "Gagal memverifikasi aset.");
    } finally {
      setScanning(false);
    }
  };

  const handleCompleteAudit = async () => {
    if (!selectedAuditId) return;
    if (
      !confirm(
        "Apakah Anda yakin ingin menyelesaikan sesi audit ini? Aset yang belum terscan akan ditandai 'TIDAK DITEMUKAN (NOT FOUND)'.",
      )
    )
      return;
    try {
      await api("POST", `/fixed-assets/audits/${selectedAuditId}/complete`, {});
      await fetchAuditDetail(selectedAuditId);
      await fetchAudits();
    } catch (err: any) {
      alert(err?.message || "Gagal menyelesaikan audit.");
    }
  };

  return (
    <View className="gap-5">
      {/* Header Panel */}
      <View className="bg-background rounded-2xl border border-border p-5 shadow-sm">
        <View className="flex-row items-center justify-between pb-4 border-b border-border">
          <View className="flex-row items-center gap-3">
            <View className="bg-primary/10 p-2.5 rounded-xl">
              <ClipboardCheck size={24} className="text-primary" />
            </View>
            <View>
              <Text className="text-base font-bold text-foreground">
                Audit Fisik & Stock Opname Aset via QR Code (PRD Hal. 13–14)
              </Text>
              <Text className="text-xs text-muted-foreground">
                Verifikasi keberadaan fisik, lokasi aktual, dan kondisi aset di lapangan dengan
                memindai label QR Code.
              </Text>
            </View>
          </View>

          <Button
            size="sm"
            variant="default"
            onPress={() => setShowNewAudit(true)}
            className="gap-1.5"
          >
            <Plus size={14} color="#fff" />
            <Text className="text-xs font-bold text-white">Mulai Audit Fisik Baru</Text>
          </Button>
        </View>

        {/* Modal Buat Audit Baru */}
        {showNewAudit && (
          <View className="bg-primary/5 p-4 rounded-xl border border-primary/20 mt-4 gap-3">
            <Text className="text-xs font-bold text-foreground">
              Jadwalkan Audit / Stock Opname Aset
            </Text>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-xs font-semibold text-foreground mb-1">
                  Nama / Judul Audit *
                </Text>
                <Input
                  value={auditTitle}
                  onChangeText={setAuditTitle}
                  placeholder="Contoh: Audit Fisik Perangkat IT Kantor Pusat Q4"
                  className="h-10 rounded-lg bg-card border-border/80"
                />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-semibold text-foreground mb-1">
                  Target Lokasi (Opsional)
                </Text>
                <SearchableSelect
                  value={locOptions.find((l) => l.value === auditLocationId)?.label || ""}
                  options={locOptions.map((l) => l.label)}
                  onChange={(val) => {
                    const match = locOptions.find((l) => l.label === val);
                    setAuditLocationId(match && match.value > 0 ? match.value : undefined);
                  }}
                  placeholder="Semua Lokasi"
                  clearable
                  className="h-10 rounded-lg bg-card border-border/80"
                />
              </View>
            </View>
            <View className="flex-row justify-end gap-2">
              <Button size="sm" variant="outline" onPress={() => setShowNewAudit(false)}>
                <Text className="text-xs">Batal</Text>
              </Button>
              <Button size="sm" variant="default" onPress={handleCreateAudit}>
                <Text className="text-xs">Buat Audit</Text>
              </Button>
            </View>
          </View>
        )}
      </View>

      {/* Main Layout: Sidebar Audit Sessions & Audit Details */}
      <View className="flex-row gap-5">
        {/* Kolom Kiri: Sesi Audit */}
        <View className="w-80 bg-background rounded-2xl border border-border p-4 shadow-sm h-fit">
          <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
            Daftar Sesi Audit ({audits.length})
          </Text>
          {audits.length === 0 ? (
            <Text className="text-xs text-muted-foreground py-4 text-center">
              Belum ada sesi audit fisik.
            </Text>
          ) : (
            <View className="gap-2">
              {audits.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  onPress={() => setSelectedAuditId(a.id)}
                  className={`p-3 rounded-xl border ${
                    selectedAuditId === a.id
                      ? "bg-primary/10 border-primary"
                      : "bg-muted/20 border-border hover:bg-muted/40"
                  }`}
                >
                  <View className="flex-row justify-between items-center mb-1">
                    <Text className="text-xs font-bold text-primary">{a.code}</Text>
                    <View
                      className={`px-2 py-0.5 rounded-full ${
                        a.status === "COMPLETED" ? "bg-emerald-100" : "bg-amber-100"
                      }`}
                    >
                      <Text
                        className={`text-[9px] font-bold ${
                          a.status === "COMPLETED" ? "text-emerald-800" : "text-amber-800"
                        }`}
                      >
                        {a.status === "COMPLETED" ? "SELESAI" : "BERJALAN"}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-xs font-bold text-foreground mb-1" numberOfLines={1}>
                    {a.title}
                  </Text>
                  <Text className="text-[10px] text-muted-foreground">
                    Verifikasi: {a.verifiedAssets}/{a.totalAssets} Aset · Selisih:{" "}
                    {a.discrepancyAssets}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Kolom Kanan: Scanner & Audit Items */}
        <View className="flex-1 bg-background rounded-2xl border border-border overflow-hidden shadow-sm">
          {!selectedAudit ? (
            <View className="py-20 items-center justify-center">
              <Text className="text-xs text-muted-foreground">
                Pilih salah satu sesi audit di sebelah kiri.
              </Text>
            </View>
          ) : (
            <View className="p-5 gap-4">
              {/* Header Sesi Terpilih */}
              <View className="flex-row justify-between items-center pb-3 border-b border-border">
                <View>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-base font-bold text-foreground">
                      {selectedAudit.title}
                    </Text>
                    <Text className="text-xs font-mono text-primary font-bold">
                      ({selectedAudit.code})
                    </Text>
                  </View>
                  <Text className="text-xs text-muted-foreground">
                    Tanggal: {selectedAudit.auditDate} · Status: {selectedAudit.status}
                  </Text>
                </View>

                {selectedAudit.status !== "COMPLETED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={handleCompleteAudit}
                    className="border-emerald-600 text-emerald-600 hover:bg-emerald-50"
                  >
                    <CheckCircle2 size={14} className="text-emerald-600 mr-1.5" />
                    <Text className="text-xs font-bold text-emerald-700">Selesaikan Audit</Text>
                  </Button>
                )}
              </View>

              {/* QR Scanner / Input Bar */}
              {selectedAudit.status !== "COMPLETED" && (
                <View className="bg-muted/30 p-4 rounded-xl border border-border gap-3">
                  <View className="flex-row items-center gap-2">
                    <QrCode size={18} className="text-primary" />
                    <Text className="text-xs font-bold text-foreground">
                      Scan QR Code atau Masukkan Kode Aset
                    </Text>
                  </View>

                  <View className="flex-row flex-wrap gap-2 items-center">
                    <Input
                      value={scanInput}
                      onChangeText={setScanInput}
                      placeholder="Scan payload QR atau ketik AST-2026-00001..."
                      onSubmitEditing={handleScanSubmit}
                      className="flex-1 min-w-[180px] h-10 rounded-lg bg-card border-border/80 font-mono text-xs"
                    />
                    {Platform.OS !== "web" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-10 px-3"
                        onPress={() => setCameraOpen(true)}
                      >
                        <Camera size={16} className="text-primary" />
                      </Button>
                    ) : null}

                    <View className="w-44">
                      <SearchableSelect
                        value={CONDITION_OPTIONS.find((c) => c.value === actualCondition)?.label || ""}
                        options={CONDITION_OPTIONS.map((c) => c.label)}
                        onChange={(val) => {
                          const match = CONDITION_OPTIONS.find((c) => c.label === val);
                          if (match) setActualCondition(match.value);
                        }}
                        placeholder="Pilih Kondisi"
                        className="h-10 rounded-lg bg-card border-border/80 text-xs"
                      />
                    </View>

                    <Button
                      variant="default"
                      onPress={handleScanSubmit}
                      disabled={scanning || !scanInput.trim()}
                      className="px-4"
                    >
                      {scanning ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text className="text-xs font-bold text-white">Verifikasi</Text>
                      )}
                    </Button>
                  </View>

                  {scanMessage ? (
                    <Text className="text-xs text-emerald-600 font-semibold">{scanMessage}</Text>
                  ) : null}
                  {scanError ? (
                    <Text className="text-xs text-destructive font-semibold">{scanError}</Text>
                  ) : null}
                  <BarcodeScannerModal
                    open={cameraOpen}
                    title="Scan QR Aset Tetap"
                    subtitle="Arahkan kamera ke label QR aset tetap untuk verifikasi audit"
                    onClose={() => setCameraOpen(false)}
                    onScanned={(code) => setScanInput(code)}
                  />
                </View>
              )}

              {/* Items List Table */}
              <View className="bg-background rounded-xl border border-border overflow-hidden">
                <View className="flex-row bg-muted/40 px-4 py-2.5 border-b border-border">
                  <Text className="w-32 text-xs font-bold text-muted-foreground">Kode Aset</Text>
                  <Text className="flex-1 text-xs font-bold text-muted-foreground">Nama Aset</Text>
                  <Text className="w-28 text-xs font-bold text-muted-foreground">Kondisi Fisik</Text>
                  <Text className="w-36 text-xs font-bold text-muted-foreground text-center">
                    Hasil Verifikasi
                  </Text>
                </View>

                {(selectedAudit.items || []).length === 0 ? (
                  <View className="py-8 items-center">
                    <Text className="text-xs text-muted-foreground">
                      Tidak ada aset yang terdaftar dalam cakupan audit ini.
                    </Text>
                  </View>
                ) : (
                  (selectedAudit.items || []).map((item) => (
                    <View
                      key={item.id}
                      className="flex-row px-4 py-2 border-b border-border/50 items-center hover:bg-muted/10 text-xs"
                    >
                      <Text className="w-32 text-xs font-mono font-bold text-primary">
                        {item.asset?.assetCode}
                      </Text>
                      <Text className="flex-1 text-xs font-semibold text-foreground pr-2" numberOfLines={1}>
                        {item.asset?.name}
                      </Text>
                      <Text className="w-28 text-xs text-muted-foreground">
                        {item.actualCondition || item.expectedCondition || "-"}
                      </Text>
                      <View className="w-36 items-center">
                        {item.scanStatus === "VERIFIED" ? (
                          <View className="bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex-row items-center gap-1">
                            <CheckCircle2 size={12} className="text-emerald-600" />
                            <Text className="text-[10px] font-bold text-emerald-700">VERIFIED</Text>
                          </View>
                        ) : item.scanStatus === "MOVED" ? (
                          <View className="bg-blue-50 px-2 py-0.5 rounded border border-blue-200 flex-row items-center gap-1">
                            <AlertTriangle size={12} className="text-blue-600" />
                            <Text className="text-[10px] font-bold text-blue-700">LOKASI PINDAH</Text>
                          </View>
                        ) : item.scanStatus === "DAMAGED" ? (
                          <View className="bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex-row items-center gap-1">
                            <AlertTriangle size={12} className="text-amber-600" />
                            <Text className="text-[10px] font-bold text-amber-700">FISIK RUSAK</Text>
                          </View>
                        ) : item.scanStatus === "NOT_FOUND" ? (
                          <View className="bg-destructive/10 px-2 py-0.5 rounded border border-destructive/20 flex-row items-center gap-1">
                            <XCircle size={12} className="text-destructive" />
                            <Text className="text-[10px] font-bold text-destructive">TIDAK DITEMUKAN</Text>
                          </View>
                        ) : (
                          <View className="bg-neutral-100 px-2 py-0.5 rounded flex-row items-center gap-1">
                            <HelpCircle size={12} className="text-neutral-500" />
                            <Text className="text-[10px] text-neutral-600">BELUM DISCANN</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
