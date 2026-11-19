import * as React from "react";
import { View, Image, Platform } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Download, QrCode } from "lucide-react-native";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import { FaAsset } from "./types";

type Props = {
  visible: boolean;
  onClose: () => void;
  asset: FaAsset | null;
};

export function AssetQrDialog({ visible, onClose, asset }: Props) {
  const { companyProfile } = useApp();
  const companyName = companyProfile?.name || "Akuntra";
  const [qrData, setQrData] = React.useState<{ assetId: FaAsset["id"]; dataUrl: string } | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);

  React.useEffect(() => {
    if (!visible || !asset) {
      return;
    }

    let isMounted = true;
    api<{ dataUrl: string }>("GET", `/fixed-assets/${asset.id}/qr-code`)
      .then((res) => {
        if (isMounted && res?.dataUrl) {
          setQrData({ assetId: asset.id, dataUrl: res.dataUrl });
        }
      })
      .catch(() => {
        // Fallback jika endpoint belum siap
      });

    return () => {
      isMounted = false;
    };
  }, [visible, asset?.id]);

  if (!visible || !asset) return null;

  const qrDataUrl = qrData?.assetId === asset.id ? qrData.dataUrl : null;
  const qrPayload = asset.qrCodeKey || asset.assetCode;
  const qrFallbackUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
    qrPayload,
  )}`;
  const displayQrUri = qrDataUrl || qrFallbackUrl;

  const handleDownloadPng = async () => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !asset) return;

    setIsGenerating(true);
    try {
      const qrSrc = displayQrUri;

      // 1. Muat QR Image ke elemen Image browser
      const qrImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new (window as any).Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = (e: any) => reject(e);
        img.src = qrSrc;
      });

      // 2. Setup Canvas resolusi tinggi (2x Retina scale)
      const scale = 2;
      const width = 360;
      const height = 490;
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.scale(scale, scale);

      // Background kartu putih
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      // Border putus-putus (Dashed Border)
      const pad = 12;
      const cardW = width - pad * 2;
      const cardH = height - pad * 2;
      const r = 12;

      ctx.save();
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);

      ctx.beginPath();
      ctx.moveTo(pad + r, pad);
      ctx.lineTo(pad + cardW - r, pad);
      ctx.quadraticCurveTo(pad + cardW, pad, pad + cardW, pad + r);
      ctx.lineTo(pad + cardW, pad + cardH - r);
      ctx.quadraticCurveTo(pad + cardW, pad + cardH, pad + cardW - r, pad + cardH);
      ctx.lineTo(pad + r, pad + cardH);
      ctx.quadraticCurveTo(pad, pad + cardH, pad, pad + cardH - r);
      ctx.lineTo(pad, pad + r);
      ctx.quadraticCurveTo(pad, pad, pad + r, pad);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      // Konten Stiker
      const innerPadX = 26;
      let currY = 30;

      // Header: AKUNTRA ERP ASSET / Nama Perusahaan
      ctx.fillStyle = "#01a481";
      ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("AKUNTRA ERP ASSET", innerPadX, currY);

      ctx.fillStyle = "#71717a";
      ctx.font = "10px system-ui, -apple-system, sans-serif";
      ctx.fillText(companyName, innerPadX, currY + 13);

      // Badge: INVENTARIS
      const badgeW = 76;
      const badgeH = 20;
      const badgeX = width - innerPadX - badgeW;
      const badgeY = currY - 11;
      ctx.fillStyle = "#ecfdf5";
      ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
      ctx.strokeStyle = "#a7f3d0";
      ctx.lineWidth = 1;
      ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);

      ctx.fillStyle = "#023768";
      ctx.font = "bold 10px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("INVENTARIS", badgeX + badgeW / 2, badgeY + 14);

      // Garis Divider
      currY += 23;
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(innerPadX, currY);
      ctx.lineTo(width - innerPadX, currY);
      ctx.stroke();

      // QR Code Box Container
      currY += 12;
      const qrSize = 150;
      const qrBoxW = qrSize + 16;
      const qrBoxH = qrSize + 16;
      const qrBoxX = (width - qrBoxW) / 2;
      const qrBoxY = currY;

      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      if ((ctx as any).roundRect) {
        (ctx as any).roundRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 8);
      } else {
        ctx.rect(qrBoxX, qrBoxY, qrBoxW, qrBoxH);
      }
      ctx.fill();
      ctx.stroke();

      // Gambar QR
      ctx.drawImage(qrImg, qrBoxX + 8, qrBoxY + 8, qrSize, qrSize);

      currY = qrBoxY + qrBoxH + 18;

      // Kode Aset
      ctx.fillStyle = "#18181b";
      ctx.font = "bold 17px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(asset.assetCode, width / 2, currY);

      // Nama Aset
      currY += 16;
      ctx.fillStyle = "#3f3f46";
      ctx.font = "600 12px system-ui, -apple-system, sans-serif";
      ctx.fillText(asset.name, width / 2, currY, cardW - 24);

      // Box Rincian Atribut Operasional
      currY += 12;
      const infoBoxX = innerPadX;
      const infoBoxW = width - innerPadX * 2;

      const rows: { label: string; value: string; isMono?: boolean }[] = [
        { label: "Kategori:", value: asset.category?.name || "-" },
        ...(asset.brand
          ? [
              {
                label: "Merek/Model:",
                value: `${asset.brand} ${asset.model ? `(${asset.model})` : ""}`.trim(),
              },
            ]
          : []),
        ...(asset.serialNumber
          ? [{ label: "Serial Number:", value: asset.serialNumber, isMono: true }]
          : []),
        { label: "Lokasi:", value: asset.location?.name || "-" },
        { label: "PIC:", value: asset.assignedUser?.name || "Belum Ditugaskan" },
      ];

      const rowH = 17;
      const infoBoxH = rows.length * rowH + 12;

      ctx.fillStyle = "#f8fafc";
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      if ((ctx as any).roundRect) {
        (ctx as any).roundRect(infoBoxX, currY, infoBoxW, infoBoxH, 8);
      } else {
        ctx.rect(infoBoxX, currY, infoBoxW, infoBoxH);
      }
      ctx.fill();
      ctx.stroke();

      let rowY = currY + 16;
      for (const row of rows) {
        ctx.fillStyle = "#64748b";
        ctx.font = "11px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(row.label, infoBoxX + 10, rowY);

        ctx.fillStyle = "#1e293b";
        ctx.font = `${row.isMono ? "bold" : "500"} 11px ${
          row.isMono ? "monospace, " : ""
        }system-ui, -apple-system, sans-serif`;
        ctx.textAlign = "right";
        ctx.fillText(row.value, infoBoxX + infoBoxW - 10, rowY, infoBoxW - 90);

        rowY += rowH;
      }

      // Catatan Footer Peringatan
      currY += infoBoxH + 14;
      ctx.fillStyle = "#94a3b8";
      ctx.font = "italic 9px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        "* Dilarang melepas atau merusak label stiker ini tanpa persetujuan Asset Manager.",
        width / 2,
        currY,
      );

      // Trigger download file PNG
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = `Label-Aset-${asset.assetCode}.png`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, "image/png");
    } catch (err) {
      console.error("Gagal export PNG label stiker:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={visible} onOpenChange={(op) => { if (!op) onClose(); }}>
      <DialogContent className="w-[95vw] sm:max-w-md gap-0 p-0 overflow-hidden">
        {/* Header Modal */}
        <DialogHeader className="flex-row items-center justify-between px-5 py-4 border-b border-border">
          <View className="flex-row items-center gap-2">
            <QrCode size={20} className="text-primary" />
            <DialogTitle className="font-bold text-base text-foreground">Label QR Code Aset Tetap</DialogTitle>
          </View>
        </DialogHeader>

        {/* Asset Tag Sticker Container */}
        <View className="p-6 items-center">
          <View
            className="w-full bg-white rounded-xl border-2 border-dashed border-neutral-300 p-5 items-center shadow-sm"
            style={{ maxWidth: 340 }}
          >
            {/* Header Label Perusahaan */}
            <View className="w-full border-b border-neutral-200 pb-2 mb-3 flex-row items-center justify-between">
              <View>
                <Text className="text-xs font-bold tracking-widest text-[#01a481]">
                  AKUNTRA ERP ASSET
                </Text>
                <Text className="text-[10px] text-neutral-500">{companyName}</Text>
              </View>
              <View className="bg-[#ecfdf5] px-2 py-0.5 rounded border border-[#a7f3d0]">
                <Text className="text-[10px] font-bold text-[#023768]">INVENTARIS</Text>
              </View>
            </View>

            {/* QR Image */}
            <View className="bg-white p-2 border border-neutral-200 rounded-lg shadow-sm mb-3">
              <Image
                source={{ uri: displayQrUri }}
                style={{ width: 160, height: 160 }}
                resizeMode="contain"
              />
            </View>

            {/* Asset Code & Details */}
            <Text className="text-lg font-bold tracking-wider text-neutral-900 mb-0.5">
              {asset.assetCode}
            </Text>
            <Text className="text-xs font-semibold text-neutral-700 text-center mb-2 px-2" numberOfLines={2}>
              {asset.name}
            </Text>

            <View className="w-full bg-neutral-50 rounded-lg p-2.5 border border-neutral-200 gap-1">
              <View className="flex-row justify-between">
                <Text className="text-[11px] text-neutral-500">Kategori:</Text>
                <Text className="text-[11px] font-medium text-neutral-800">
                  {asset.category?.name || "-"}
                </Text>
              </View>
              {asset.brand ? (
                <View className="flex-row justify-between">
                  <Text className="text-[11px] text-neutral-500">Merek/Model:</Text>
                  <Text className="text-[11px] font-medium text-neutral-800">
                    {asset.brand} {asset.model ? `(${asset.model})` : ""}
                  </Text>
                </View>
              ) : null}
              {asset.serialNumber ? (
                <View className="flex-row justify-between">
                  <Text className="text-[11px] text-neutral-500">Serial Number:</Text>
                  <Text className="text-[11px] font-mono font-medium text-neutral-800">
                    {asset.serialNumber}
                  </Text>
                </View>
              ) : null}
              <View className="flex-row justify-between">
                <Text className="text-[11px] text-neutral-500">Lokasi:</Text>
                <Text className="text-[11px] font-medium text-neutral-800">
                  {asset.location?.name || "-"}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-[11px] text-neutral-500">PIC:</Text>
                <Text className="text-[11px] font-medium text-neutral-800">
                  {asset.assignedUser?.name || "Belum Ditugaskan"}
                </Text>
              </View>
            </View>

            <Text className="text-[9px] text-neutral-400 mt-3 text-center italic">
              * Dilarang melepas atau merusak label stiker ini tanpa persetujuan Asset Manager.
            </Text>
          </View>
        </View>

        {/* Footer Actions */}
        <DialogFooter className="flex-row items-center justify-end gap-2 px-5 py-3.5 border-t border-border bg-muted/20">
          <Button variant="outline" onPress={onClose}>
            <Text>Tutup</Text>
          </Button>
          {Platform.OS === "web" && (
            <Button
              variant="default"
              onPress={handleDownloadPng}
              disabled={isGenerating}
              className="gap-2 bg-primary"
            >
              <Download size={16} className="text-primary-foreground" />
              <Text>{isGenerating ? "Menyiapkan PNG..." : "Cetak / Unduh Label PNG"}</Text>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
