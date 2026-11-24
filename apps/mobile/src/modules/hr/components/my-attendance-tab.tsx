import React from "react";
import { View, ActivityIndicator, Image, Pressable, Platform, Linking } from "react-native";
import { Text } from "@/components/ui/text";
import {
  Clock,
  CheckCircle2,
  Camera,
  MapPin,
  RefreshCw,
  RotateCcw,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react-native";
import { colors } from "@/tokens";
import { Panel, FormField } from "@/components/akuntra/basics";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  WebCameraModal,
  captureNativePhoto,
  type CapturedPhoto,
} from "@/components/akuntra/camera-capture-modal";
import {
  captureCurrentGps,
  formatDistanceLabel,
  formatLocationStatusLabel,
  googleMapsUrl,
  haversineDistanceMeters,
  reverseGeocodeAddress,
  type GpsSnapshot,
} from "@/utils/gps-location";
import { apiBase } from "@/services/api";
import { useApp } from "@/store/app-store";

export interface AttendanceSubmitPayload {
  notes: string;
  address: string;
  photo: CapturedPhoto | null;
  gps: GpsSnapshot | null;
}

interface MyAttendanceTabProps {
  todayAtt: any;
  attSettings?: any;
  loadingToday: boolean;
  submittingAtt: boolean;
  checkInNote: string;
  setCheckInNote: (v: string) => void;
  checkOutNote: string;
  setCheckOutNote: (v: string) => void;
  handleCheckIn: (payload: AttendanceSubmitPayload) => Promise<boolean>;
  handleCheckOut: (payload: AttendanceSubmitPayload) => Promise<boolean>;
}

function resolvePhotoUrl(fileId?: number | null): string | null {
  if (!fileId) return null;
  return `${apiBase()}/files/${fileId}`;
}

function LocationToneBadge({ status }: { status?: string | null }) {
  const { label, tone } = formatLocationStatusLabel(status);
  const fallbackStyle = {
    box: "bg-panel border-border",
    text: "text-muted-foreground",
  };
  const styles: Record<string, { box: string; text: string }> = {
    success: {
      box: "bg-emerald-500/10 border-emerald-500/30",
      text: "text-emerald-600 dark:text-emerald-400",
    },
    info: {
      box: "bg-blue-500/10 border-blue-500/30",
      text: "text-blue-600 dark:text-blue-400",
    },
    warning: {
      box: "bg-amber-500/10 border-amber-500/30",
      text: "text-amber-600 dark:text-amber-400",
    },
    danger: {
      box: "bg-red-500/10 border-red-500/30",
      text: "text-red-600 dark:text-red-400",
    },
    neutral: fallbackStyle,
  };
  const st = styles[tone] ?? fallbackStyle;
  return (
    <View className={`rounded-full border px-2.5 py-0.5 self-start ${st.box}`}>
      <Text className={`text-[11px] font-semibold ${st.text}`}>{label}</Text>
    </View>
  );
}

export function MyAttendanceTab({
  todayAtt,
  attSettings,
  loadingToday,
  submittingAtt,
  checkInNote,
  setCheckInNote,
  checkOutNote,
  setCheckOutNote,
  handleCheckIn,
  handleCheckOut,
}: MyAttendanceTabProps) {
  const { toast } = useApp();
  const [gps, setGps] = React.useState<GpsSnapshot | null>(null);
  const [gpsLoading, setGpsLoading] = React.useState(false);
  const [gpsError, setGpsError] = React.useState<string | null>(null);
  const [address, setAddress] = React.useState("");
  const [addressLoading, setAddressLoading] = React.useState(false);
  const addressEditedRef = React.useRef(false);

  const [capturedPhoto, setCapturedPhoto] = React.useState<CapturedPhoto | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = React.useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = React.useState(false);
  const [previewModalUrl, setPreviewModalUrl] = React.useState<string | null>(null);

  const needsAction = !todayAtt?.checkIn || !todayAtt?.checkOut;
  const requirePhoto = attSettings?.requirePhotoOnAttendance ?? true;
  const requireGps = attSettings?.requireGpsOnAttendance ?? true;

  const fetchGps = React.useCallback(async () => {
    setGpsLoading(true);
    setGpsError(null);
    try {
      const snap = await captureCurrentGps();
      setGps(snap);
      // Isi alamat otomatis bila user belum mengetik manual
      if (!addressEditedRef.current) {
        setAddressLoading(true);
        void reverseGeocodeAddress(snap.latitude, snap.longitude)
          .then((resolved) => {
            if (resolved && !addressEditedRef.current) {
              setAddress(resolved);
            }
          })
          .finally(() => setAddressLoading(false));
      }
      return snap;
    } catch (e: any) {
      const msg = e?.message || "Gagal mengambil lokasi GPS";
      setGpsError(msg);
      return null;
    } finally {
      setGpsLoading(false);
    }
  }, []);

  // Otomatis ambil lokasi GPS saat tab dibuka jika masih perlu Check-In atau Check-Out
  React.useEffect(() => {
    if (!needsAction) return;
    let alive = true;
    const timer = setTimeout(() => {
      if (!alive) return;
      void fetchGps();
    }, 100);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [needsAction, fetchGps]);

  // Bersihkan blob URL saat foto diganti / unmount
  React.useEffect(() => {
    return () => {
      if (photoPreviewUrl && photoPreviewUrl.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(photoPreviewUrl);
        } catch {}
      }
    };
  }, [photoPreviewUrl]);

  const setPhotoWithPreview = React.useCallback((photo: CapturedPhoto | null) => {
    setPhotoPreviewUrl((prev) => {
      if (prev && prev.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(prev);
        } catch {}
      }
      if (!photo) return null;
      if (photo.blob && typeof URL !== "undefined") {
        return URL.createObjectURL(photo.blob);
      }
      return photo.uri || null;
    });
    setCapturedPhoto(photo);
  }, []);

  const handleOpenCamera = async () => {
    if (Platform.OS === "web") {
      setCameraOpen(true);
      return;
    }
    const photo = await captureNativePhoto(toast, {
      cameraType: "front",
      quality: 0.75,
    });
    if (photo) {
      setPhotoWithPreview(photo);
    }
  };

  // Hitung jarak ke kantor secara live jika koordinat kantor sudah diatur
  const officeDistanceMeters =
    gps &&
    typeof attSettings?.officeLatitude === "number" &&
    typeof attSettings?.officeLongitude === "number"
      ? haversineDistanceMeters(
          gps.latitude,
          gps.longitude,
          attSettings.officeLatitude,
          attSettings.officeLongitude,
        )
      : null;

  const withinOfficeRadius =
    officeDistanceMeters !== null
      ? officeDistanceMeters <= (Number(attSettings?.officeRadiusMeters) || 150)
      : null;

  const submitAction = async (mode: "in" | "out") => {
    let activeGps = gps;
    if (!activeGps) {
      activeGps = await fetchGps();
    }
    if (requireGps && !activeGps) {
      toast(
        "Lokasi GPS belum didapatkan. Pastikan izin & layanan GPS aktif lalu tekan Perbarui GPS.",
        "danger",
      );
      return;
    }
    if (requirePhoto && !capturedPhoto) {
      toast(
        `Ambil foto langsung dari kamera terlebih dahulu sebelum ${mode === "in" ? "Check-In" : "Check-Out"}.`,
        "danger",
      );
      return;
    }

    const ok =
      mode === "in"
        ? await handleCheckIn({
            notes: checkInNote,
            address: address.trim(),
            photo: capturedPhoto,
            gps: activeGps,
          })
        : await handleCheckOut({
            notes: checkOutNote,
            address: address.trim(),
            photo: capturedPhoto,
            gps: activeGps,
          });

    if (ok) {
      setPhotoWithPreview(null);
      setAddress("");
      addressEditedRef.current = false;
    }
  };

  const checkInPhotoUrl = resolvePhotoUrl(todayAtt?.checkInPhotoFileId);
  const checkOutPhotoUrl = resolvePhotoUrl(todayAtt?.checkOutPhotoFileId);

  return (
    <View className="gap-5 w-full">
      <Panel
        title="Presensi Kehadiran Hari Ini"
        subtitle={new Date().toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        right={
          <View className="flex-row items-center gap-1.5 flex-wrap">
            <View className="rounded-full bg-primary/10 border border-primary/20 px-3 py-1">
              <Text className="text-xs font-semibold text-primary">
                Status: {todayAtt?.status || "Belum Absen"}
              </Text>
            </View>
            {todayAtt?.verificationStatus === "PERLU_VERIFIKASI" && (
              <View className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 flex-row items-center gap-1">
                <AlertTriangle size={12} color="#D97706" />
                <Text className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  Perlu Verifikasi HR
                </Text>
              </View>
            )}
          </View>
        }
      >
        {loadingToday ? (
          <View className="py-8 items-center justify-center">
            <ActivityIndicator size="small" />
          </View>
        ) : (
          <View className="gap-4">
            {/* KPI Boxes */}
            <View className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
              <View className="bg-card border-border/80 rounded-2xl border p-4 shadow-sm">
                <Text className="text-muted-foreground text-xs font-medium">Jam Masuk (Check-In)</Text>
                <Text className="text-foreground text-lg md:text-xl font-bold mt-1">
                  {todayAtt?.checkIn
                    ? new Date(todayAtt.checkIn).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "--:--"}
                </Text>
                <Text className="text-muted-foreground text-[11px] mt-0.5">
                  {todayAtt?.lateMinutes > 0
                    ? `Terlambat ${todayAtt.lateMinutes} menit`
                    : "Waktu check-in sistem"}
                </Text>
              </View>

              <View className="bg-card border-border/80 rounded-2xl border p-4 shadow-sm">
                <Text className="text-muted-foreground text-xs font-medium">Jam Pulang (Check-Out)</Text>
                <Text className="text-foreground text-lg md:text-xl font-bold mt-1">
                  {todayAtt?.checkOut
                    ? new Date(todayAtt.checkOut).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "--:--"}
                </Text>
                <Text className="text-muted-foreground text-[11px] mt-0.5">Waktu selesai kerja</Text>
              </View>

              <View className="bg-card border-border/80 rounded-2xl border p-4 shadow-sm">
                <Text className="text-muted-foreground text-xs font-medium">Jam Lembur</Text>
                <Text className="text-primary text-lg md:text-xl font-bold mt-1">
                  {todayAtt?.overtimeHours ? `${todayAtt.overtimeHours} Jam` : "0 Jam"}
                </Text>
                <Text className="text-muted-foreground text-[11px] mt-0.5">Dihitung otomatis / input</Text>
              </View>
            </View>

            {/* Form Check-In / Check-Out dengan Live Foto & GPS Otomatis */}
            {needsAction ? (
              <View
                className={`rounded-2xl border p-4 gap-4 ${
                  !todayAtt?.checkIn
                    ? "border-primary/25 bg-primary/5"
                    : "border-amber-500/25 bg-amber-500/5"
                }`}
              >
                {/* 1. Kartu GPS Otomatis */}
                <View className="rounded-xl border border-border/80 bg-card p-3.5 gap-2.5">
                  <View className="flex-row items-center justify-between gap-2 flex-wrap">
                    <View className="flex-row items-center gap-2">
                      <View className="rounded-lg p-1.5 bg-primary/10">
                        <MapPin size={16} color={colors.primary} />
                      </View>
                      <View>
                        <Text className="text-xs font-bold text-foreground">
                          Lokasi GPS Otomatis {requireGps ? "(Wajib)" : "(Opsional)"}
                        </Text>
                        <Text className="text-[11px] text-muted-foreground">
                          Koordinat diambil langsung dari perangkat Anda
                        </Text>
                      </View>
                    </View>
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => void fetchGps()}
                      disabled={gpsLoading}
                      className="h-8 px-2.5 gap-1.5"
                    >
                      {gpsLoading ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <RefreshCw size={13} color={colors.text} />
                      )}
                      <Text className="text-xs font-semibold">
                        {gpsLoading ? "Mencari GPS..." : "Perbarui GPS"}
                      </Text>
                    </Button>
                  </View>

                  {gpsError ? (
                    <View className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 flex-row items-start gap-2">
                      <ShieldAlert size={15} color="#EF4444" />
                      <Text className="text-xs text-red-600 dark:text-red-400 flex-1 leading-relaxed">
                        {gpsError}
                      </Text>
                    </View>
                  ) : gps ? (
                    <View className="rounded-lg bg-panel/70 border border-border/60 p-3 gap-1.5">
                      <View className="flex-row items-center justify-between flex-wrap gap-2">
                        <View className="flex-row items-center gap-1.5">
                          <ShieldCheck size={14} color={colors.success} />
                          <Text className="text-xs font-semibold text-foreground select-text">
                            {gps.latitude.toFixed(6)}, {gps.longitude.toFixed(6)}
                          </Text>
                          {gps.accuracy != null && (
                            <Text className="text-[11px] text-muted-foreground">
                              (±{gps.accuracy} m)
                            </Text>
                          )}
                        </View>
                        <Pressable
                          onPress={() => void Linking.openURL(googleMapsUrl(gps.latitude, gps.longitude))}
                          className="flex-row items-center gap-1"
                        >
                          <ExternalLink size={12} color={colors.primary} />
                          <Text className="text-[11px] font-semibold text-primary">Lihat Peta</Text>
                        </Pressable>
                      </View>

                      {gps.accuracy != null && gps.accuracy > 200 && (
                        <View className="flex-row items-center gap-1.5 pt-0.5">
                          <AlertTriangle size={12} color="#D97706" />
                          <Text className="text-[11px] text-amber-600 dark:text-amber-400 flex-1">
                            Akurasi GPS rendah (±{gps.accuracy} m, biasanya dari Wi-Fi/PC). Gunakan smartphone dengan GPS aktif untuk koordinat lebih presisi.
                          </Text>
                        </View>
                      )}

                      {officeDistanceMeters !== null && (
                        <View className="flex-row items-center gap-2 flex-wrap pt-1">
                          <View
                            className={`rounded-full border px-2 py-0.5 ${
                              withinOfficeRadius
                                ? "bg-emerald-500/10 border-emerald-500/30"
                                : "bg-amber-500/10 border-amber-500/30"
                            }`}
                          >
                            <Text
                              className={`text-[11px] font-semibold ${
                                withinOfficeRadius
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-amber-600 dark:text-amber-400"
                              }`}
                            >
                              {withinOfficeRadius
                                ? `Di Area ${attSettings?.officeName || "Kantor"} (${formatDistanceLabel(officeDistanceMeters)})`
                                : `Di Luar Radius ${attSettings?.officeName || "Kantor"} (${formatDistanceLabel(officeDistanceMeters)})`}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View className="flex-row items-center gap-2 py-1">
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text className="text-xs text-muted-foreground">
                        Mengambil titik koordinat GPS perangkat...
                      </Text>
                    </View>
                  )}

                  {/* Input Alamat Lokasi (terisi otomatis dari GPS atau bisa diketik manual) */}
                  <View className="pt-1 gap-1">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs font-semibold text-foreground">
                        Alamat Lokasi (Opsional)
                      </Text>
                      {addressLoading && (
                        <Text className="text-[10px] text-muted-foreground">
                          Mendeteksi alamat...
                        </Text>
                      )}
                    </View>
                    <Input
                      value={address}
                      onChangeText={(v) => {
                        addressEditedRef.current = true;
                        setAddress(v);
                      }}
                      placeholder="Contoh: Jl. Sudirman No. 10, Kantor Pusat / Lokasi Site Klien..."
                    />
                  </View>
                </View>

                {/* 2. Kartu Foto Langsung (Kamera Only — Tanpa Galeri) */}
                <View className="rounded-xl border border-border/80 bg-card p-3.5 gap-3">
                  <View className="flex-row items-center justify-between gap-2 flex-wrap">
                    <View className="flex-row items-center gap-2">
                      <View className="rounded-lg p-1.5 bg-primary/10">
                        <Camera size={16} color={colors.primary} />
                      </View>
                      <View>
                        <Text className="text-xs font-bold text-foreground">
                          Foto Bukti Langsung {requirePhoto ? "(Wajib)" : "(Opsional)"}
                        </Text>
                        <Text className="text-[11px] text-muted-foreground">
                          Harus foto langsung dari kamera, tidak diperbolehkan dari galeri
                        </Text>
                      </View>
                    </View>
                    <Button
                      size="sm"
                      variant={capturedPhoto ? "outline" : "default"}
                      onPress={() => void handleOpenCamera()}
                      className="h-8 px-3 gap-1.5"
                    >
                      {capturedPhoto ? (
                        <RotateCcw size={13} color={colors.text} />
                      ) : (
                        <Camera size={13} color="#FFFFFF" />
                      )}
                      <Text
                        className={`text-xs font-semibold ${
                          capturedPhoto ? "text-foreground" : "text-white"
                        }`}
                      >
                        {capturedPhoto ? "Foto Ulang" : "Ambil Foto Langsung"}
                      </Text>
                    </Button>
                  </View>

                  {photoPreviewUrl ? (
                    <View className="flex-row items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-2.5">
                      <Pressable onPress={() => setPreviewModalUrl(photoPreviewUrl)}>
                        <Image
                          source={{ uri: photoPreviewUrl }}
                          style={{ width: 68, height: 68, borderRadius: 10 }}
                          resizeMode="cover"
                        />
                      </Pressable>
                      <View className="flex-1 gap-0.5">
                        <View className="flex-row items-center gap-1.5">
                          <CheckCircle2 size={14} color={colors.success} />
                          <Text className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            Foto langsung siap dikirim
                          </Text>
                        </View>
                        <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                          {capturedPhoto?.name}
                        </Text>
                        <Pressable onPress={() => setPreviewModalUrl(photoPreviewUrl)}>
                          <Text className="text-[11px] font-semibold text-primary mt-0.5">
                            Ketuk foto untuk memperbesar
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => void handleOpenCamera()}
                      className="rounded-xl border border-dashed border-border bg-panel/50 py-5 px-4 items-center justify-center gap-1.5"
                    >
                      <Camera size={24} color={colors.muted} />
                      <Text className="text-xs font-semibold text-foreground">
                        Ketuk untuk membuka kamera langsung
                      </Text>
                      <Text className="text-[11px] text-muted-foreground text-center">
                        Ambil foto selfie / lokasi kerja secara real-time sebelum {!todayAtt?.checkIn ? "Check-In" : "Check-Out"}
                      </Text>
                    </Pressable>
                  )}
                </View>

                {/* 3. Catatan & Tombol Submit */}
                {!todayAtt?.checkIn ? (
                  <>
                    <FormField
                      label="Catatan Check-In (Opsional)"
                      hint="Lokasi kerja, dinas, atau informasi penting lainnya"
                    >
                      <Input
                        value={checkInNote}
                        onChangeText={setCheckInNote}
                        placeholder="Contoh: Kantor pusat, site proyek..."
                      />
                    </FormField>
                    <Button
                      disabled={submittingAtt}
                      onPress={() => void submitAction("in")}
                      className="w-full gap-2 h-11"
                    >
                      {submittingAtt ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Clock size={16} color="#FFFFFF" />
                      )}
                      <Text className="text-sm font-bold text-white">
                        {submittingAtt ? "Mengunggah & Menyimpan..." : "Absen Masuk Sekarang (Check-In)"}
                      </Text>
                    </Button>
                  </>
                ) : (
                  <>
                    <FormField
                      label="Catatan Check-Out & Laporan Hari Ini"
                      hint="Ringkasan tugas atau kendala hari ini"
                    >
                      <Input
                        value={checkOutNote}
                        onChangeText={setCheckOutNote}
                        placeholder="Pekerjaan selesai, laporan serah terima..."
                      />
                    </FormField>
                    <Button
                      disabled={submittingAtt}
                      onPress={() => void submitAction("out")}
                      className="w-full gap-2 h-11 bg-amber-600 hover:bg-amber-700"
                    >
                      {submittingAtt ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <CheckCircle2 size={16} color="#FFFFFF" />
                      )}
                      <Text className="text-sm font-bold text-white">
                        {submittingAtt ? "Mengunggah & Menyimpan..." : "Absen Pulang (Check-Out)"}
                      </Text>
                    </Button>
                  </>
                )}
              </View>
            ) : (
              <View className="flex-row items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <CheckCircle2 size={24} color={colors.success} />
                <View className="flex-1">
                  <Text className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    Presensi Hari Ini Telah Lengkap!
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Data kehadiran, foto bukti, dan koordinat GPS Anda hari ini telah tersimpan dalam sistem.
                  </Text>
                </View>
              </View>
            )}

            {/* Bukti Tersimpan Hari Ini (Check-In / Check-Out) */}
            {(todayAtt?.checkIn || todayAtt?.checkOut) && (
              <View className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {todayAtt?.checkIn && (
                  <View className="rounded-xl border border-border/80 bg-card p-3.5 gap-2.5">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs font-bold text-foreground">Bukti Check-In</Text>
                      <LocationToneBadge status={todayAtt.checkInLocationStatus} />
                    </View>
                    <View className="flex-row gap-3 items-center">
                      {checkInPhotoUrl ? (
                        <Pressable onPress={() => setPreviewModalUrl(checkInPhotoUrl)}>
                          <Image
                            source={{ uri: checkInPhotoUrl }}
                            style={{ width: 64, height: 64, borderRadius: 10 }}
                            resizeMode="cover"
                          />
                        </Pressable>
                      ) : (
                        <View className="w-16 h-16 rounded-xl bg-panel items-center justify-center border border-border">
                          <Camera size={18} color={colors.muted} />
                        </View>
                      )}
                      <View className="flex-1 gap-1">
                        <Text className="text-xs text-muted-foreground">
                          Pukul{" "}
                          <Text className="font-semibold text-foreground">
                            {new Date(todayAtt.checkIn).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                        </Text>
                        {todayAtt.checkInLatitude != null && todayAtt.checkInLongitude != null ? (
                          <Pressable
                            onPress={() =>
                              void Linking.openURL(
                                googleMapsUrl(todayAtt.checkInLatitude, todayAtt.checkInLongitude),
                              )
                            }
                            className="flex-row items-center gap-1"
                          >
                            <MapPin size={12} color={colors.primary} />
                            <Text className="text-[11px] font-medium text-primary">
                              {Number(todayAtt.checkInLatitude).toFixed(6)},{" "}
                              {Number(todayAtt.checkInLongitude).toFixed(6)}
                            </Text>
                          </Pressable>
                        ) : (
                          <Text className="text-[11px] text-muted-foreground">Tanpa koordinat GPS</Text>
                        )}
                        {todayAtt.checkInAddress ? (
                          <Text className="text-[11px] text-foreground" numberOfLines={2}>
                            {todayAtt.checkInAddress}
                          </Text>
                        ) : null}
                        {todayAtt.checkInDistanceMeters != null && (
                          <Text className="text-[11px] text-muted-foreground">
                            Jarak dari kantor: {formatDistanceLabel(todayAtt.checkInDistanceMeters)}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                )}

                {todayAtt?.checkOut && (
                  <View className="rounded-xl border border-border/80 bg-card p-3.5 gap-2.5">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs font-bold text-foreground">Bukti Check-Out</Text>
                      <LocationToneBadge status={todayAtt.checkOutLocationStatus} />
                    </View>
                    <View className="flex-row gap-3 items-center">
                      {checkOutPhotoUrl ? (
                        <Pressable onPress={() => setPreviewModalUrl(checkOutPhotoUrl)}>
                          <Image
                            source={{ uri: checkOutPhotoUrl }}
                            style={{ width: 64, height: 64, borderRadius: 10 }}
                            resizeMode="cover"
                          />
                        </Pressable>
                      ) : (
                        <View className="w-16 h-16 rounded-xl bg-panel items-center justify-center border border-border">
                          <Camera size={18} color={colors.muted} />
                        </View>
                      )}
                      <View className="flex-1 gap-1">
                        <Text className="text-xs text-muted-foreground">
                          Pukul{" "}
                          <Text className="font-semibold text-foreground">
                            {new Date(todayAtt.checkOut).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                        </Text>
                        {todayAtt.checkOutLatitude != null && todayAtt.checkOutLongitude != null ? (
                          <Pressable
                            onPress={() =>
                              void Linking.openURL(
                                googleMapsUrl(todayAtt.checkOutLatitude, todayAtt.checkOutLongitude),
                              )
                            }
                            className="flex-row items-center gap-1"
                          >
                            <MapPin size={12} color={colors.primary} />
                            <Text className="text-[11px] font-medium text-primary">
                              {Number(todayAtt.checkOutLatitude).toFixed(6)},{" "}
                              {Number(todayAtt.checkOutLongitude).toFixed(6)}
                            </Text>
                          </Pressable>
                        ) : (
                          <Text className="text-[11px] text-muted-foreground">Tanpa koordinat GPS</Text>
                        )}
                        {todayAtt.checkOutAddress ? (
                          <Text className="text-[11px] text-foreground" numberOfLines={2}>
                            {todayAtt.checkOutAddress}
                          </Text>
                        ) : null}
                        {todayAtt.checkOutDistanceMeters != null && (
                          <Text className="text-[11px] text-muted-foreground">
                            Jarak dari kantor: {formatDistanceLabel(todayAtt.checkOutDistanceMeters)}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </Panel>

      {/* Modal Kamera Langsung Web (Live Only — Tidak ada Galeri) */}
      <WebCameraModal
        visible={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(photo) => setPhotoWithPreview(photo)}
        defaultFacing="user"
        liveOnly={true}
        title="Foto Absensi Langsung"
        subtitle="Ambil foto langsung menggunakan kamera perangkat (bukan dari galeri)"
      />

      {/* Modal Perbesar Foto */}
      <Dialog open={!!previewModalUrl} onOpenChange={(open) => { if (!open) setPreviewModalUrl(null); }}>
        <DialogContent className="sm:max-w-lg bg-card p-4">
          <DialogHeader>
            <DialogTitle>Pratinjau Foto Absensi</DialogTitle>
          </DialogHeader>
          {previewModalUrl && (
            <View className="rounded-xl overflow-hidden bg-black/95 items-center justify-center min-h-[300px]">
              <Image
                source={{ uri: previewModalUrl }}
                style={{ width: "100%", height: 380 }}
                resizeMode="contain"
              />
            </View>
          )}
        </DialogContent>
      </Dialog>
    </View>
  );
}
