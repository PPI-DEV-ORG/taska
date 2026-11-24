import React from "react";
import { View, ActivityIndicator, Image, Pressable, Linking } from "react-native";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Camera,
  MapPin,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react-native";
import { colors } from "@/tokens";
import { apiBase } from "@/services/api";
import {
  formatDistanceLabel,
  formatLocationStatusLabel,
  googleMapsUrl,
} from "@/utils/gps-location";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface AttendanceDetailDialogProps {
  selectedAttendance: any;
  setSelectedAttendance: (att: any) => void;
  isSuperAdminOrBos: boolean;
  editAttOtHours: string;
  setEditAttOtHours: (v: string) => void;
  handleUpdateAttendanceRecord: () => void;
  handleVerifyAttendance?: (
    status: "TERVERIFIKASI" | "PERLU_VERIFIKASI" | "DITOLAK",
  ) => void;
  savingAttDetail: boolean;
}

function EvidenceCard({
  title,
  timestamp,
  photoFileId,
  latitude,
  longitude,
  accuracy,
  distanceMeters,
  locationStatus,
  address,
  onPreview,
}: {
  title: string;
  timestamp?: string | null;
  photoFileId?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  distanceMeters?: number | null;
  locationStatus?: string | null;
  address?: string | null;
  onPreview: (url: string) => void;
}) {
  const photoUrl = photoFileId ? `${apiBase()}/files/${photoFileId}` : null;
  const loc = formatLocationStatusLabel(locationStatus);
  const toneClass =
    loc.tone === "success"
      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
      : loc.tone === "info"
      ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400"
      : loc.tone === "warning"
      ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
      : loc.tone === "danger"
      ? "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400"
      : "bg-panel border-border text-muted-foreground";

  return (
    <View className="bg-card border-border/80 rounded-xl border p-3.5 gap-2.5">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-xs font-bold text-foreground">{title}</Text>
        <View className={`rounded-full border px-2 py-0.5 ${toneClass.split(" ").slice(0, 2).join(" ")}`}>
          <Text className={`text-[10px] font-semibold ${toneClass.split(" ").slice(2).join(" ")}`}>
            {loc.label}
          </Text>
        </View>
      </View>

      {photoUrl ? (
        <Pressable
          onPress={() => onPreview(photoUrl)}
          className="rounded-lg overflow-hidden border border-border bg-black/90"
        >
          <Image
            source={{ uri: photoUrl }}
            style={{ width: "100%", height: 150 }}
            resizeMode="cover"
          />
        </Pressable>
      ) : (
        <View className="rounded-lg border border-dashed border-border bg-panel/50 h-[110px] items-center justify-center gap-1">
          <Camera size={20} color={colors.muted} />
          <Text className="text-[11px] text-muted-foreground">
            {timestamp ? "Tidak ada foto bukti" : "Belum tercatat"}
          </Text>
        </View>
      )}

      <View className="gap-1">
        {latitude != null && longitude != null ? (
          <>
            <View className="flex-row items-center justify-between gap-2">
              <View className="flex-row items-center gap-1 flex-1">
                <MapPin size={12} color={colors.primary} />
                <Text className="text-[11px] font-medium text-foreground select-text" numberOfLines={1}>
                  {Number(latitude).toFixed(6)}, {Number(longitude).toFixed(6)}
                </Text>
              </View>
              <Pressable
                onPress={() => void Linking.openURL(googleMapsUrl(latitude, longitude))}
                className="flex-row items-center gap-1"
              >
                <ExternalLink size={12} color={colors.primary} />
                <Text className="text-[11px] font-semibold text-primary">Maps</Text>
              </Pressable>
            </View>
            <View className="flex-row items-center gap-3 flex-wrap">
              {accuracy != null && (
                <Text className="text-[11px] text-muted-foreground">
                  Akurasi: ±{Math.round(accuracy)} m
                </Text>
              )}
              {distanceMeters != null && (
                <Text className="text-[11px] text-muted-foreground">
                  Jarak kantor: {formatDistanceLabel(distanceMeters)}
                </Text>
              )}
            </View>
          </>
        ) : (
          <Text className="text-[11px] text-muted-foreground">Koordinat GPS tidak tersedia</Text>
        )}
        {address ? (
          <Text className="text-[11px] text-foreground leading-relaxed select-text pt-0.5">
            Alamat: {address}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function AttendanceDetailDialog({
  selectedAttendance,
  setSelectedAttendance,
  isSuperAdminOrBos,
  editAttOtHours,
  setEditAttOtHours,
  handleUpdateAttendanceRecord,
  handleVerifyAttendance,
  savingAttDetail,
}: AttendanceDetailDialogProps) {
  const [enlargedPhotoUrl, setEnlargedPhotoUrl] = React.useState<string | null>(null);

  const verStatus = selectedAttendance?.verificationStatus || "TERVERIFIKASI";

  return (
    <>
      <Dialog
        open={!!selectedAttendance}
        onOpenChange={(open) => {
          if (!open) setSelectedAttendance(null);
        }}
      >
        <DialogContent className="w-[96vw] max-w-xl md:max-w-2xl max-h-[90vh] p-4 sm:p-6 overflow-y-auto">
          <DialogHeader className="pr-8">
            <DialogTitle>Detail Presensi Karyawan</DialogTitle>
          </DialogHeader>

          {selectedAttendance && (
            <View className="gap-4 py-2">
              <View className="bg-panel border border-border/80 rounded-xl p-4 flex-row flex-wrap items-center justify-between gap-3">
                <View className="gap-0.5">
                  <Text className="text-base font-bold text-foreground">
                    {selectedAttendance.user?.name || `Karyawan #${selectedAttendance.userId}`}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {selectedAttendance.user?.role || "-"} · {selectedAttendance.user?.email || "-"}
                  </Text>
                  <Text className="text-xs font-medium text-foreground mt-1">
                    Tanggal: {selectedAttendance.date ? String(selectedAttendance.date).slice(0, 10) : "-"}
                  </Text>
                </View>

                <View className="items-end gap-1.5">
                  <View
                    className={`rounded-lg px-3 py-1.5 ${
                      selectedAttendance.status === "HADIR"
                        ? "bg-emerald-500/10 border border-emerald-500/30"
                        : selectedAttendance.status === "ALPHA"
                        ? "bg-red-500/10 border border-red-500/30"
                        : "bg-amber-500/10 border border-amber-500/30"
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        selectedAttendance.status === "HADIR"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : selectedAttendance.status === "ALPHA"
                          ? "text-red-600 dark:text-red-400"
                          : "text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      Status: {selectedAttendance.status}
                    </Text>
                  </View>

                  <View
                    className={`rounded-full px-2.5 py-0.5 border flex-row items-center gap-1 ${
                      verStatus === "TERVERIFIKASI"
                        ? "bg-emerald-500/10 border-emerald-500/30"
                        : verStatus === "DITOLAK"
                        ? "bg-red-500/10 border-red-500/30"
                        : "bg-amber-500/10 border-amber-500/30"
                    }`}
                  >
                    {verStatus === "TERVERIFIKASI" ? (
                      <CheckCircle2 size={11} color="#10B981" />
                    ) : verStatus === "DITOLAK" ? (
                      <XCircle size={11} color="#EF4444" />
                    ) : (
                      <AlertTriangle size={11} color="#D97706" />
                    )}
                    <Text
                      className={`text-[10px] font-bold ${
                        verStatus === "TERVERIFIKASI"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : verStatus === "DITOLAK"
                          ? "text-red-600 dark:text-red-400"
                          : "text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {verStatus === "TERVERIFIKASI"
                        ? "Terverifikasi"
                        : verStatus === "DITOLAK"
                        ? "Ditolak"
                        : "Perlu Verifikasi"}
                    </Text>
                  </View>
                </View>
              </View>

              {/* KPI Boxes */}
              <View className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <View className="bg-card border-border/80 rounded-xl border p-3.5 shadow-sm">
                  <Text className="text-muted-foreground text-xs font-medium">Jam Masuk (Check-In)</Text>
                  <Text className="text-foreground text-lg font-bold mt-1">
                    {selectedAttendance.checkIn
                      ? new Date(selectedAttendance.checkIn).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "--:--"}
                  </Text>
                  <Text className="text-muted-foreground text-[11px] mt-0.5">
                    {selectedAttendance.lateMinutes > 0
                      ? `Terlambat ${selectedAttendance.lateMinutes} menit`
                      : selectedAttendance.checkIn
                      ? new Date(selectedAttendance.checkIn).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "Belum check-in"}
                  </Text>
                </View>

                <View className="bg-card border-border/80 rounded-xl border p-3.5 shadow-sm">
                  <Text className="text-muted-foreground text-xs font-medium">Jam Pulang (Check-Out)</Text>
                  <Text className="text-foreground text-lg font-bold mt-1">
                    {selectedAttendance.checkOut
                      ? new Date(selectedAttendance.checkOut).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "--:--"}
                  </Text>
                  <Text className="text-muted-foreground text-[11px] mt-0.5">
                    {selectedAttendance.checkOut
                      ? new Date(selectedAttendance.checkOut).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "Belum check-out"}
                  </Text>
                </View>

                <View className="bg-card border-border/80 rounded-xl border p-3.5 shadow-sm">
                  <Text className="text-muted-foreground text-xs font-medium">Jam Lembur</Text>
                  <Text className="text-primary text-lg font-bold mt-1">
                    {Number(selectedAttendance.overtimeHours) > 0
                      ? `${selectedAttendance.overtimeHours} Jam`
                      : "0 Jam"}
                  </Text>
                  <Text className="text-muted-foreground text-[11px] mt-0.5">Dihitung otomatis</Text>
                </View>
              </View>

              {/* Bukti Foto & Lokasi GPS (Check-In & Check-Out) */}
              <View className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <EvidenceCard
                  title="Bukti Foto & GPS Check-In"
                  timestamp={selectedAttendance.checkIn}
                  photoFileId={selectedAttendance.checkInPhotoFileId}
                  latitude={selectedAttendance.checkInLatitude}
                  longitude={selectedAttendance.checkInLongitude}
                  accuracy={selectedAttendance.checkInAccuracy}
                  distanceMeters={selectedAttendance.checkInDistanceMeters}
                  locationStatus={selectedAttendance.checkInLocationStatus}
                  address={selectedAttendance.checkInAddress}
                  onPreview={setEnlargedPhotoUrl}
                />
                <EvidenceCard
                  title="Bukti Foto & GPS Check-Out"
                  timestamp={selectedAttendance.checkOut}
                  photoFileId={selectedAttendance.checkOutPhotoFileId}
                  latitude={selectedAttendance.checkOutLatitude}
                  longitude={selectedAttendance.checkOutLongitude}
                  accuracy={selectedAttendance.checkOutAccuracy}
                  distanceMeters={selectedAttendance.checkOutDistanceMeters}
                  locationStatus={selectedAttendance.checkOutLocationStatus}
                  address={selectedAttendance.checkOutAddress}
                  onPreview={setEnlargedPhotoUrl}
                />
              </View>

              {/* Catatan / Keterangan Lengkap */}
              <View className="bg-card border-border/80 rounded-xl border p-4 shadow-sm gap-2">
                <Text className="text-xs font-bold text-foreground">Catatan / Keterangan Lengkap</Text>
                <View className="rounded-lg bg-panel/60 border border-border/60 p-3.5 min-h-[70px]">
                  <Text className="text-xs leading-relaxed text-foreground select-text">
                    {selectedAttendance.notes || "Tidak ada catatan untuk presensi ini."}
                  </Text>
                </View>
              </View>

              {/* Verifikasi Presensi (HR / Admin / Bos / Super Admin) */}
              {isSuperAdminOrBos && handleVerifyAttendance && (
                <View className="bg-card border-border/80 rounded-xl border p-4 shadow-sm gap-3">
                  <Text className="text-xs font-bold text-foreground">
                    Verifikasi Kehadiran (HR / Admin / Bos)
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={verStatus === "TERVERIFIKASI" ? "default" : "outline"}
                      disabled={savingAttDetail}
                      onPress={() => handleVerifyAttendance("TERVERIFIKASI")}
                      className="gap-1.5 h-9 px-3"
                    >
                      <CheckCircle2
                        size={14}
                        color={verStatus === "TERVERIFIKASI" ? "#FFFFFF" : "#10B981"}
                      />
                      <Text
                        className={`text-xs font-semibold ${
                          verStatus === "TERVERIFIKASI" ? "text-white" : "text-foreground"
                        }`}
                      >
                        Verifikasi Valid
                      </Text>
                    </Button>

                    <Button
                      size="sm"
                      variant={verStatus === "PERLU_VERIFIKASI" ? "default" : "outline"}
                      disabled={savingAttDetail}
                      onPress={() => handleVerifyAttendance("PERLU_VERIFIKASI")}
                      className="gap-1.5 h-9 px-3"
                    >
                      <AlertTriangle
                        size={14}
                        color={verStatus === "PERLU_VERIFIKASI" ? "#FFFFFF" : "#D97706"}
                      />
                      <Text
                        className={`text-xs font-semibold ${
                          verStatus === "PERLU_VERIFIKASI" ? "text-white" : "text-foreground"
                        }`}
                      >
                        Perlu Verifikasi
                      </Text>
                    </Button>

                    <Button
                      size="sm"
                      variant={verStatus === "DITOLAK" ? "destructive" : "outline"}
                      disabled={savingAttDetail}
                      onPress={() => handleVerifyAttendance("DITOLAK")}
                      className="gap-1.5 h-9 px-3"
                    >
                      <XCircle
                        size={14}
                        color={verStatus === "DITOLAK" ? "#FFFFFF" : "#EF4444"}
                      />
                      <Text
                        className={`text-xs font-semibold ${
                          verStatus === "DITOLAK" ? "text-white" : "text-red-500"
                        }`}
                      >
                        Tolak Absensi
                      </Text>
                    </Button>
                  </View>
                  <Text className="text-[11px] text-muted-foreground">
                    Absensi berstatus Ditolak tidak akan dihitung sebagai hari hadir pada perhitungan Payroll.
                  </Text>
                </View>
              )}

              {/* Atur Jam Lembur Khusus Super Admin & Bos */}
              {isSuperAdminOrBos && (
                <View className="bg-card border-border/80 rounded-xl border p-4 shadow-sm gap-3">
                  <Text className="text-xs font-bold text-foreground">
                    Koreksi / Atur Jam Lembur (Super Admin & Bos)
                  </Text>
                  <View className="flex-row items-center gap-3">
                    <View className="flex-1">
                      <Input
                        value={editAttOtHours}
                        onChangeText={setEditAttOtHours}
                        keyboardType="numeric"
                        placeholder="0"
                      />
                    </View>
                    <Button
                      onPress={handleUpdateAttendanceRecord}
                      disabled={savingAttDetail}
                      className="h-10 px-4"
                    >
                      {savingAttDetail ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text className="text-xs font-bold text-white">Simpan Jam Lembur</Text>
                      )}
                    </Button>
                  </View>
                </View>
              )}
            </View>
          )}

          <DialogFooter className="flex-row justify-end pt-2">
            <Button variant="outline" onPress={() => setSelectedAttendance(null)}>
              <Text className="text-xs font-semibold">Tutup</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Perbesar Foto */}
      <Dialog
        open={!!enlargedPhotoUrl}
        onOpenChange={(open) => {
          if (!open) setEnlargedPhotoUrl(null);
        }}
      >
        <DialogContent className="sm:max-w-lg bg-card p-4">
          <DialogHeader>
            <DialogTitle>Foto Bukti Kehadiran</DialogTitle>
          </DialogHeader>
          {enlargedPhotoUrl && (
            <View className="rounded-xl overflow-hidden bg-black/95 items-center justify-center min-h-[300px]">
              <Image
                source={{ uri: enlargedPhotoUrl }}
                style={{ width: "100%", height: 420 }}
                resizeMode="contain"
              />
            </View>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
