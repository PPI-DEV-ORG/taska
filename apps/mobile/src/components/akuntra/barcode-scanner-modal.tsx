import * as React from "react";
import { Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { Camera, Flashlight, FlashlightOff, X } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

export function BarcodeScannerModal({
  open,
  title = "Scan Barcode / QR Code",
  subtitle = "Arahkan kamera ke barcode nomor seri atau QR aset",
  onClose,
  onScanned,
}: {
  open: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onScanned: (code: string) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = React.useState(false);
  const lockedRef = React.useRef(false);

  const handleClose = React.useCallback(() => {
    setTorch(false);
    onClose();
  }, [onClose]);

  React.useEffect(() => {
    if (open) {
      lockedRef.current = false;
      if (Platform.OS !== "web" && permission && !permission.granted && permission.canAskAgain) {
        void requestPermission();
      }
    }
  }, [open, permission, requestPermission]);

  const handleBarcode = React.useCallback(
    (result: BarcodeScanningResult) => {
      if (lockedRef.current) return;
      const code = (result?.data || "").trim();
      if (!code) return;
      lockedRef.current = true;
      onScanned(code);
      handleClose();
    },
    [onScanned, handleClose],
  );

  if (!open || Platform.OS === "web") return null;

  return (
    <Modal visible={open} animationType="slide" transparent={false} onRequestClose={handleClose}>
      <View className="flex-1 bg-black">
        <View className="flex-row items-center justify-between px-4 pt-12 pb-3 bg-black/80 z-10">
          <View className="flex-1 pr-3">
            <Text className="text-base font-bold text-white">{title}</Text>
            <Text className="text-xs text-white/70">{subtitle}</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => setTorch((prev) => !prev)}
              className="size-10 rounded-full bg-white/15 items-center justify-center"
            >
              {torch ? <FlashlightOff size={18} color="#fff" /> : <Flashlight size={18} color="#fff" />}
            </Pressable>
            <Pressable
              onPress={handleClose}
              className="size-10 rounded-full bg-white/15 items-center justify-center"
            >
              <X size={20} color="#fff" />
            </Pressable>
          </View>
        </View>

        {!permission?.granted ? (
          <View className="flex-1 items-center justify-center p-6 gap-4">
            <Camera size={44} color="#fff" />
            <Text className="text-center text-sm text-white">
              Izin kamera diperlukan untuk memindai barcode atau QR Code.
            </Text>
            <Button onPress={() => void requestPermission()}>
              <Text>Izinkan Kamera</Text>
            </Button>
          </View>
        ) : (
          <View className="flex-1 relative">
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torch}
              barcodeScannerSettings={{
                barcodeTypes: [
                  "qr",
                  "code128",
                  "code39",
                  "code93",
                  "ean13",
                  "ean8",
                  "upc_a",
                  "upc_e",
                  "datamatrix",
                  "pdf417",
                  "itf14",
                ],
              }}
              onBarcodeScanned={handleBarcode}
            />
            <View
              pointerEvents="none"
              className="flex-1 items-center justify-center"
            >
              <View className="w-64 h-64 rounded-2xl border-2 border-emerald-400 bg-transparent" />
              <Text className="mt-4 text-xs font-medium text-white bg-black/60 px-3 py-1.5 rounded-full">
                Posisikan barcode / QR di dalam kotak
              </Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}
