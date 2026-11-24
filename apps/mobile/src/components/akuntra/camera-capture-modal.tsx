import * as React from "react";
import { ActivityIndicator, Platform, Pressable, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Camera, Check, RefreshCw, RotateCcw, Upload, AlertCircle } from "lucide-react-native";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { colors } from "@/tokens";

export type CapturedPhoto = {
  name: string;
  size: number;
  mimeType: string;
  blob?: File;
  uri?: string;
};

/**
 * Helper native (iOS/Android) untuk mengambil foto langsung dari kamera perangkat (bukan galeri).
 */
export async function captureNativePhoto(
  toast: (msg: string, tone?: any) => void,
  options?: { cameraType?: "front" | "back"; quality?: number },
): Promise<CapturedPhoto | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    toast("Izin akses kamera diperlukan untuk mengambil foto langsung.", "danger");
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: options?.quality ?? 0.85,
    cameraType:
      options?.cameraType === "front"
        ? ImagePicker.CameraType.front
        : ImagePicker.CameraType.back,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return {
    name: asset.fileName || `Kamera_${Date.now()}.jpg`,
    size: asset.fileSize || 0,
    mimeType: asset.mimeType || "image/jpeg",
    uri: asset.uri,
  };
}

/**
 * Modal Kamera Langsung untuk Web (Mobile Browser & Desktop Webcam) dengan:
 * - Live viewfinder (getUserMedia)
 * - Ganti kamera Depan / Belakang
 * - Pratinjau foto hasil jepretan + tombol Ulangi / Gunakan Foto
 * - Fallback otomatis ke <input type="file" accept="image/*" capture="..."> bila kamera browser diblokir
 */
export function WebCameraModal({
  visible,
  onClose,
  onCapture,
  defaultFacing = "environment",
  liveOnly = false,
  title,
  subtitle,
}: {
  visible: boolean;
  onClose: () => void;
  onCapture: (photo: CapturedPhoto) => void;
  defaultFacing?: "environment" | "user";
  liveOnly?: boolean;
  title?: string;
  subtitle?: string;
}) {
  const [facing, setFacing] = React.useState<"environment" | "user">(defaultFacing);
  const [starting, setStarting] = React.useState(false);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [capturedUrl, setCapturedUrl] = React.useState<string | null>(null);
  const [capturedFile, setCapturedFile] = React.useState<File | null>(null);

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const fallbackInputRef = React.useRef<HTMLInputElement | null>(null);

  const stopStream = React.useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const clearPreview = React.useCallback(() => {
    setCapturedUrl((prev) => {
      if (prev && prev.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(prev);
        } catch {}
      }
      return null;
    });
    setCapturedFile(null);
  }, []);

  React.useEffect(() => {
    if (!visible || Platform.OS !== "web" || capturedUrl) {
      if (!visible) {
        stopStream();
        void Promise.resolve().then(() => clearPreview());
      }
      return;
    }

    let alive = true;
    const startCamera = async () => {
      stopStream();
      setStarting(true);
      setCameraError(null);

      try {
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("Browser ini tidak mendukung akses kamera langsung (atau belum memakai HTTPS).");
        }
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: facing }, width: { ideal: 1600 }, height: { ideal: 1200 } },
            audio: false,
          });
        } catch {
          // Fallback jika facingMode tidak tersedia (misal webcam laptop)
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }

        if (!alive) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e: any) {
        if (!alive) return;
        const msg =
          e?.name === "NotAllowedError"
            ? "Izin kamera ditolak oleh browser. Izinkan akses kamera di pengaturan browser atau gunakan tombol kamera perangkat di bawah."
            : e?.message || "Kamera tidak dapat diakses.";
        setCameraError(msg);
      } finally {
        if (alive) setStarting(false);
      }
    };

    void startCamera();

    return () => {
      alive = false;
      stopStream();
    };
  }, [visible, facing, capturedUrl, stopStream, clearPreview]);

  const handleSnap = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const fileName = `Foto_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.jpg`;
        const file = new File([blob], fileName, { type: "image/jpeg" });
        const url = URL.createObjectURL(file);
        stopStream();
        setCapturedFile(file);
        setCapturedUrl(url);
      },
      "image/jpeg",
      0.88,
    );
  };

  const handleConfirm = () => {
    if (!capturedFile) return;
    onCapture({
      name: capturedFile.name,
      size: capturedFile.size,
      mimeType: capturedFile.type || "image/jpeg",
      blob: capturedFile,
    });
    clearPreview();
    onClose();
  };

  const handleFallbackFile = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    stopStream();
    setCapturedFile(file);
    setCapturedUrl(url);
  };

  if (!visible || Platform.OS !== "web") return null;

  return (
    <Dialog open={visible} onOpenChange={(open) => { if (!open) { stopStream(); clearPreview(); onClose(); } }}>
      <DialogContent className="sm:max-w-lg bg-card p-4 sm:p-5 gap-3">
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-border pb-2.5 pr-8">
          <View className="flex-row items-center gap-2">
            <View className="rounded-xl p-2 bg-primary/10">
              <Camera size={18} color={colors.primary} />
            </View>
            <View>
              <Text className="text-base font-bold text-foreground">
                {capturedUrl ? "Pratinjau Hasil Foto" : (title || "Ambil Foto Langsung")}
              </Text>
              <Text className="text-xs text-muted-foreground">
                {capturedUrl
                  ? "Periksa hasil foto sebelum dilampirkan"
                  : (subtitle || "Arahkan kamera ke struk, dokumen, atau objek")}
              </Text>
            </View>
          </View>
        </View>

        {/* Hidden OS Camera Fallback Input (hanya dipakai jika tidak liveOnly, atau saat kamera live gagal di mobile) */}
        <input
          ref={fallbackInputRef}
          type="file"
          accept="image/*"
          capture={facing === "user" ? "user" : "environment"}
          onChange={handleFallbackFile}
          style={{ display: "none" }}
        />

        {/* Viewport */}
        {capturedUrl ? (
          <View className="rounded-2xl border border-border overflow-hidden bg-black/95 items-center justify-center">
            <img
              src={capturedUrl}
              alt="Pratinjau foto kamera"
              style={{ width: "100%", maxHeight: "55vh", objectFit: "contain" }}
            />
          </View>
        ) : cameraError ? (
          <View className="rounded-2xl border border-border bg-muted/20 p-6 items-center gap-3">
            <AlertCircle size={32} color="#D97706" />
            <Text className="text-xs text-muted-foreground text-center leading-5">
              {cameraError}
            </Text>
            <Button
              size="sm"
              onPress={() => fallbackInputRef.current?.click()}
              className="gap-1.5"
              style={{ backgroundColor: colors.primary }}
            >
              <Upload size={14} color="#FFF" />
              <Text className="text-xs font-semibold text-white">Buka Kamera Perangkat</Text>
            </Button>
          </View>
        ) : (
          <View className="rounded-2xl border border-border overflow-hidden bg-black relative min-h-[260px] items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              style={{ width: "100%", maxHeight: "55vh", objectFit: "cover", display: "block" }}
            />
            {starting && (
              <View className="absolute inset-0 bg-black/60 items-center justify-center gap-2">
                <ActivityIndicator size="large" color={colors.primary} />
                <Text className="text-xs text-white">Membuka kamera...</Text>
              </View>
            )}
            {!starting && (
              <Pressable
                onPress={() => setFacing((prev) => (prev === "environment" ? "user" : "environment"))}
                className="absolute top-3 right-3 rounded-full bg-black/60 px-3 py-1.5 flex-row items-center gap-1.5"
              >
                <RefreshCw size={13} color="#FFF" />
                <Text className="text-[11px] font-semibold text-white">Ganti Kamera</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Footer Actions */}
        <View className="flex-row items-center justify-between gap-2 pt-2 border-t border-border">
          {capturedUrl ? (
            <>
              <Button variant="outline" size="sm" onPress={clearPreview} className="gap-1.5">
                <RotateCcw size={14} color={colors.text} />
                <Text className="text-xs font-semibold">Ulangi Foto</Text>
              </Button>
              <Button
                size="sm"
                onPress={handleConfirm}
                className="gap-1.5"
                style={{ backgroundColor: colors.primary }}
              >
                <Check size={14} color="#FFF" />
                <Text className="text-xs font-semibold text-white">Gunakan Foto Ini</Text>
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onPress={() => {
                  stopStream();
                  onClose();
                }}
              >
                <Text className="text-xs font-semibold">Batal</Text>
              </Button>
              <View className="flex-row items-center gap-2">
                {!liveOnly && (
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => fallbackInputRef.current?.click()}
                    className="gap-1"
                  >
                    <Upload size={13} color={colors.text} />
                    <Text className="text-xs font-medium">Kamera OS</Text>
                  </Button>
                )}
                {!cameraError && (
                  <Button
                    size="sm"
                    disabled={starting}
                    onPress={handleSnap}
                    className="gap-1.5"
                    style={{ backgroundColor: colors.primary }}
                  >
                    <Camera size={14} color="#FFF" />
                    <Text className="text-xs font-semibold text-white">Jepret Foto</Text>
                  </Button>
                )}
              </View>
            </>
          )}
        </View>
      </DialogContent>
    </Dialog>
  );
}
