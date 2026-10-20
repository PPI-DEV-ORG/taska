import * as React from "react";
import { View, Image, Pressable, Linking } from "react-native";
import { Eye, ExternalLink, Download, FileText, Image as ImageIcon, FileX, Clock, Upload } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiBase } from "@/services/api";
import { colors } from "@/tokens";
import type { Row } from "@/constants/modules";
import { FileUploader } from "@/components/taska/file-uploader";

function formatBytes(bytes?: number | null) {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export type ResolvedDocItem = {
  label: string;
  fieldKey?: string;
  kind?: "foto" | "dokumen" | "semua";
  fileId?: number | string | null;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  isImage?: boolean;
  emptyHint?: string;
};

export function resolveModuleDocs(moduleKey: string, docLabel: string, row: Row): ResolvedDocItem {
  const labelLower = docLabel.toLowerCase();

  if (moduleKey === "expenses") {
    if (/transfer|reimbursement|bayar/i.test(labelLower)) {
      const paidFile = (row as any).paidFile;
      const paidFileId = (row as any).paidFileId ?? paidFile?.id ?? null;
      return {
        label: docLabel,
        fieldKey: "paidFileId",
        kind: "semua",
        fileId: paidFileId,
        fileName: paidFile?.originalName ?? (paidFileId ? `bukti-reimbursement-${row.id}.jpg` : null),
        mimeType: paidFile?.mimeType ?? "image/jpeg",
        fileSize: paidFile?.size ?? null,
        isImage: !paidFile?.mimeType || paidFile.mimeType.startsWith("image/"),
        emptyHint: "Belum dibayar oleh finance (bukti transfer belum tersedia)",
      };
    }
    // Nota / Foto
    const receiptFile = (row as any).receiptFile;
    const receiptFileId = (row as any).receiptFileId ?? receiptFile?.id ?? (row as any).fileId ?? null;
    return {
      label: docLabel,
      fieldKey: "receiptFileId",
      kind: "semua",
      fileId: receiptFileId,
      fileName: receiptFile?.originalName ?? (receiptFileId ? `nota-${row.id}.jpg` : null),
      mimeType: receiptFile?.mimeType ?? "image/jpeg",
      fileSize: receiptFile?.size ?? null,
      isImage: !receiptFile?.mimeType || receiptFile.mimeType.startsWith("image/"),
      emptyHint: "Belum ada foto nota yang diunggah",
    };
  }

  if (moduleKey === "purchase-requests") {
    const fileId = (row as any).evidenceFileId ?? (row as any).fileId ?? null;
    const fileMeta = (row as any).evidenceFile ?? (row as any).file;
    return {
      label: docLabel,
      fieldKey: "evidenceFileId",
      kind: "semua",
      fileId,
      fileName: fileMeta?.originalName ?? (fileId ? `bukti-request-${row.id}` : null),
      mimeType: fileMeta?.mimeType,
      fileSize: fileMeta?.size,
      isImage: fileMeta?.mimeType?.startsWith("image/"),
      emptyHint: "Belum ada bukti permintaan yang dilampirkan",
    };
  }

  if (moduleKey === "supplier-pos") {
    if (/do|delivery/i.test(labelLower)) {
      const fileId = (row as any).doFileId ?? null;
      return {
        label: docLabel,
        fieldKey: "doFileId",
        kind: "semua",
        fileId,
        fileName: fileId ? `do-supplier-${row.id}` : null,
        emptyHint: "Belum ada bukti Delivery Order (DO)",
      };
    }
    const fileId = (row as any).fileId ?? null;
    return {
      label: docLabel,
      fieldKey: "fileId",
      kind: "dokumen",
      fileId,
      fileName: fileId ? `po-supplier-${row.id}` : null,
      emptyHint: "Belum ada file PO supplier",
    };
  }

  if (moduleKey === "receiving") {
    if (/kondisi|foto/i.test(labelLower)) {
      const fileId = (row as any).photoFileId ?? (row as any).fileId ?? null;
      return {
        label: docLabel,
        fieldKey: "photoFileId",
        kind: "foto",
        fileId,
        fileName: fileId ? `foto-kondisi-${row.id}.jpg` : null,
        isImage: true,
        emptyHint: "Belum ada foto kondisi barang",
      };
    }
    const fileId = (row as any).receiptFileId ?? (row as any).fileId ?? null;
    return {
      label: docLabel,
      fieldKey: "receiptFileId",
      kind: "semua",
      fileId,
      fileName: fileId ? `tanda-terima-${row.id}` : null,
      emptyHint: "Belum ada dokumen tanda terima",
    };
  }

  if (moduleKey === "delivery-notes") {
    const scanId = (row as any).scanFileId ?? (row as any).signedFileId ?? (row as any).fileId ?? null;
    if (/scan|surat|tanda tangan|pendukung/i.test(labelLower)) {
      return {
        label: docLabel,
        fieldKey: "scanFileId",
        kind: "semua",
        fileId: scanId,
        fileName: scanId ? `surat-jalan-${row.id}.jpg` : null,
        isImage: true,
        emptyHint: "Belum ada scan surat jalan bertanda tangan",
      };
    }
    const reportId = (row as any).reportFileId ?? (scanId ? null : (row as any).fileId) ?? null;
    return {
      label: docLabel,
      fieldKey: "reportFileId",
      kind: "semua",
      fileId: reportId,
      fileName: reportId ? `laporan-hasil-${row.id}` : null,
      emptyHint: "Belum ada laporan hasil dan dokumentasi",
    };
  }

  if (moduleKey === "damage-reports") {
    const fileId = (row as any).fileId ?? null;
    return {
      label: docLabel,
      fieldKey: "fileId",
      kind: "foto",
      fileId,
      fileName: fileId ? `foto-kerusakan-${row.id}.jpg` : null,
      isImage: true,
      emptyHint: "Belum ada foto barang bermasalah",
    };
  }

  if (moduleKey === "invoices") {
    if (/bayar|transfer/i.test(labelLower)) {
      const fileId = (row as any).paidFileId ?? (row as any).paymentFileId ?? null;
      return {
        label: docLabel,
        fieldKey: "paidFileId",
        kind: "semua",
        fileId,
        fileName: fileId ? `bukti-bayar-invoice-${row.id}` : null,
        emptyHint: "Belum ada bukti pembayaran dari customer",
      };
    }
    const fileId = (row as any).fileId ?? null;
    return {
      label: docLabel,
      fieldKey: "fileId",
      kind: "dokumen",
      fileId,
      fileName: fileId ? `file-invoice-${row.id}` : null,
      emptyHint: "Belum ada file invoice yang diunggah",
    };
  }

  if (moduleKey === "po-client") {
    const file = (row as any).file;
    const fileId = (row as any).fileId ?? file?.id ?? null;
    return {
      label: docLabel,
      fieldKey: "fileId",
      kind: "dokumen",
      fileId,
      fileName: file?.originalName ?? (fileId ? `po-client-${row.id}` : null),
      mimeType: file?.mimeType,
      fileSize: file?.size,
      emptyHint: "Belum ada file PO dari client",
    };
  }

  if (moduleKey === "projects") {
    if (/prd|spesifikasi/i.test(labelLower)) {
      const fileId = (row as any).prdFileId ?? null;
      return {
        label: docLabel,
        fieldKey: "prdFileId",
        kind: "dokumen",
        fileId,
        fileName: fileId ? `prd-spesifikasi-${row.id}.pdf` : null,
        emptyHint: "Belum ada dokumen PRD / spesifikasi teknis",
      };
    }
    if (/bahp/i.test(labelLower)) {
      const fileId = (row as any).bahpFileId ?? null;
      return {
        label: docLabel,
        fieldKey: "bahpFileId",
        kind: "dokumen",
        fileId,
        fileName: fileId ? `bahp-${row.id}.pdf` : null,
        emptyHint: "Belum ada dokumen Berita Acara Hasil Pekerjaan (BAHP)",
      };
    }
    if (/bast/i.test(labelLower)) {
      const fileId = (row as any).bastFileId ?? null;
      return {
        label: docLabel,
        fieldKey: "bastFileId",
        kind: "dokumen",
        fileId,
        fileName: fileId ? `bast-${row.id}.pdf` : null,
        emptyHint: "Belum ada dokumen Berita Acara Serah Terima (BAST)",
      };
    }
    if (/do|delivery|surat jalan/i.test(labelLower)) {
      const fileId = (row as any).doFileId ?? null;
      return {
        label: docLabel,
        fieldKey: "doFileId",
        kind: "foto",
        fileId,
        fileName: fileId ? `do-surat-jalan-${row.id}` : null,
        isImage: true,
        emptyHint: "Belum ada file Delivery Order (DO) bertandatangan",
      };
    }
  }

  if (moduleKey === "quotations") {
    const fileId = (row as any).latestFileId ?? (row as any).fileId ?? null;
    return {
      label: docLabel,
      fieldKey: "latestFileId",
      kind: "dokumen",
      fileId,
      fileName: (row as any).fileName ?? (fileId ? `penawaran-${row.id}` : null),
      emptyHint: "Belum ada file penawaran yang diunggah",
    };
  }

  if (moduleKey === "leads") {
    const file = (row as any).file ?? (row as any).files?.[0];
    const fileId = (row as any).fileId ?? file?.id ?? null;
    return {
      label: docLabel,
      fieldKey: "fileId",
      kind: "semua",
      fileId,
      fileName: file?.originalName ?? (fileId ? `dokumen-lead-${row.id}` : null),
      mimeType: file?.mimeType,
      fileSize: file?.size,
      isImage: file?.mimeType ? file.mimeType.startsWith("image/") : false,
      emptyHint: "Belum ada dokumen pendukung atau brief yang dilampirkan",
    };
  }

  if (moduleKey === "surveys") {
    if (/foto|video|lokasi/i.test(labelLower)) {
      const mediaFile = (row as any).mediaFile;
      const fileId = (row as any).evidenceFileId ?? mediaFile?.id ?? null;
      return {
        label: docLabel,
        fieldKey: "evidenceFileId",
        kind: "semua",
        fileId,
        fileName: mediaFile?.originalName ?? (fileId ? `bukti-lokasi-${row.id}` : null),
        mimeType: mediaFile?.mimeType,
        fileSize: mediaFile?.size,
        isImage: mediaFile?.mimeType ? mediaFile.mimeType.startsWith("image/") : false,
        emptyHint: "Belum ada foto atau video lokasi survey yang diunggah",
      };
    }
    const docFile = (row as any).docFile;
    const fileId = (row as any).documentFileId ?? docFile?.id ?? null;
    return {
      label: docLabel,
      fieldKey: "documentFileId",
      kind: "dokumen",
      fileId,
      fileName: docFile?.originalName ?? (fileId ? `dokumen-survey-${row.id}` : null),
      mimeType: docFile?.mimeType,
      fileSize: docFile?.size,
      emptyHint: "Belum ada catatan atau dokumen survey yang dilampirkan",
    };
  }

  // Fallback
  const fallbackFileId = (row as any).fileId ?? null;
  const isImg = /foto|nota|gambar|kondisi|bukti/i.test(labelLower);
  return {
    label: docLabel,
    fieldKey: "fileId",
    kind: isImg ? "foto" : "semua",
    fileId: fallbackFileId,
    fileName: fallbackFileId ? `${docLabel}-${row.id}` : null,
    isImage: isImg,
  };
}

export function DocumentViewerItem({
  item,
  onUploadFile,
  canUpload = true,
}: {
  item: ResolvedDocItem;
  onUploadFile?: (fieldKey: string, fileId: number, item: ResolvedDocItem) => Promise<void> | void;
  canUpload?: boolean;
}) {
  const [uploaderOpen, setUploaderOpen] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [imgError, setImgError] = React.useState(false);

  const fileUrl = item.fileId ? `${apiBase()}/files/${item.fileId}` : "";

  const handleOpen = () => {
    if (!fileUrl) return;
    if (typeof window !== "undefined") {
      window.open(fileUrl, "_blank");
    } else {
      Linking.openURL(fileUrl).catch(() => {});
    }
  };

  if (uploaderOpen) {
    return (
      <View className="p-3.5 rounded-xl border border-primary/40 bg-card gap-2.5">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-semibold text-foreground">
            {item.fileId ? `Ganti ${item.label}` : `Upload ${item.label}`}
          </Text>
          <Button size="sm" variant="ghost" className="h-7 px-2" onPress={() => setUploaderOpen(false)} disabled={uploading}>
            <Text className="text-xs text-muted-foreground">Batal</Text>
          </Button>
        </View>
        <FileUploader
          label=""
          autoFlush
          kind={item.kind ?? (item.isImage ? "foto" : "semua")}
          onUploaded={async (fileId) => {
            if (onUploadFile && item.fieldKey) {
              setUploading(true);
              try {
                await onUploadFile(item.fieldKey, fileId, item);
                setUploaderOpen(false);
              } finally {
                setUploading(false);
              }
            } else {
              setUploaderOpen(false);
            }
          }}
        />
      </View>
    );
  }

  if (!item.fileId) {
    return (
      <View className="flex-row items-center justify-between gap-3 p-3.5 rounded-xl border border-dashed border-border/80 bg-panel/30">
        <View className="flex-row items-center gap-3 flex-1">
          <View className="w-9 h-9 rounded-lg bg-muted/30 items-center justify-center shrink-0">
            <Clock size={18} color={colors.muted} />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-semibold text-foreground">{item.label}</Text>
            <Text className="text-xs text-muted-foreground mt-0.5">{item.emptyHint || "Belum ada file terlampir"}</Text>
          </View>
        </View>
        {canUpload && onUploadFile ? (
          <Button size="sm" variant="outline" className="h-8 px-2.5" onPress={() => setUploaderOpen(true)}>
            <Upload size={13} color={colors.primary} className="mr-1.5" />
            <Text className="text-xs text-primary font-medium">Upload</Text>
          </Button>
        ) : null}
      </View>
    );
  }

  const showImage = item.isImage && !imgError;

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-semibold text-foreground">{item.label}</Text>
        {item.fileSize ? <Text className="text-[11px] text-muted-foreground">{formatBytes(item.fileSize)}</Text> : null}
      </View>

      {showImage ? (
        <View className="rounded-xl border border-border bg-panel overflow-hidden">
          <Pressable onPress={() => setPreviewOpen(true)} className="relative group bg-muted/10 items-center justify-center">
            <Image
              source={{ uri: fileUrl }}
              style={{ width: "100%", height: 180 }}
              resizeMode="contain"
              onError={() => setImgError(true)}
            />
            <View className="absolute inset-0 bg-black/0 hover:bg-black/10 items-center justify-center transition-colors">
              <View className="bg-black/60 rounded-full px-3 py-1 flex-row items-center gap-1.5 opacity-90">
                <Eye size={13} color="#ffffff" />
                <Text className="text-white text-xs font-medium">Klik untuk perbesar</Text>
              </View>
            </View>
          </Pressable>

          <View className="flex-row items-center justify-between px-3 py-2 border-t border-border bg-panel/90">
            <View className="flex-row items-center gap-1.5 flex-1 mr-2">
              <ImageIcon size={14} color={colors.primary} />
              <Text className="text-xs text-foreground truncate" numberOfLines={1}>
                {item.fileName || `${item.label}.jpg`}
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <Button size="sm" variant="ghost" className="h-7 px-2" onPress={() => setPreviewOpen(true)}>
                <Eye size={13} color={colors.primary} className="mr-1" />
                <Text className="text-xs text-primary font-medium">Lihat</Text>
              </Button>
              <Button size="sm" variant="outline" className="h-7 px-2" onPress={handleOpen}>
                <ExternalLink size={13} color={colors.textSecondary} className="mr-1" />
                <Text className="text-xs text-muted-foreground">Unduh</Text>
              </Button>
              {canUpload && onUploadFile ? (
                <Button size="sm" variant="outline" className="h-7 px-2" onPress={() => setUploaderOpen(true)}>
                  <Upload size={13} color={colors.text} className="mr-1" />
                  <Text className="text-xs text-foreground">Ganti</Text>
                </Button>
              ) : null}
            </View>
          </View>
        </View>
      ) : (
        <View className="flex-row items-center justify-between p-3 rounded-xl border border-border bg-panel">
          <View className="flex-row items-center gap-3 flex-1 mr-3">
            <View className="w-9 h-9 rounded-lg bg-primary/10 items-center justify-center shrink-0">
              <FileText size={18} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-medium text-foreground truncate" numberOfLines={1}>
                {item.fileName || `${item.label}`}
              </Text>
              <Text className="text-[11px] text-muted-foreground mt-0.5">
                {item.fileSize ? formatBytes(item.fileSize) : "Dokumen terlampir"}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center gap-1.5">
            <Button size="sm" variant="outline" className="h-7 px-2.5" onPress={handleOpen}>
              <Download size={13} color={colors.textSecondary} className="mr-1" />
              <Text className="text-xs">Buka</Text>
            </Button>
            {canUpload && onUploadFile ? (
              <Button size="sm" variant="outline" className="h-7 px-2" onPress={() => setUploaderOpen(true)}>
                <Upload size={13} color={colors.text} className="mr-1" />
                <Text className="text-xs text-foreground">Ganti</Text>
              </Button>
            ) : null}
          </View>
        </View>
      )}

      {showImage && (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[92vh]">
            <DialogHeader>
              <DialogTitle>{item.label}</DialogTitle>
            </DialogHeader>
            <View className="items-center justify-center bg-black/5 rounded-xl overflow-hidden p-1 my-2">
              <Image
                source={{ uri: fileUrl }}
                style={{ width: "100%", height: 380 }}
                resizeMode="contain"
              />
            </View>
            <DialogFooter className="flex-row items-center justify-between gap-2">
              <Text className="text-xs text-muted-foreground truncate flex-1" numberOfLines={1}>
                {item.fileName || item.label}
              </Text>
              <Button size="sm" onPress={handleOpen}>
                <Download size={14} color={colors.background} className="mr-1.5" />
                <Text>Unduh / Buka File</Text>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </View>
  );
}

export function DocumentViewerList({
  moduleKey,
  docs,
  row,
  onUploadFile,
  canUpload = true,
}: {
  moduleKey: string;
  docs: string[];
  row: Row;
  onUploadFile?: (fieldKey: string, fileId: number, item: ResolvedDocItem) => Promise<void> | void;
  canUpload?: boolean;
}) {
  const items = React.useMemo(() => {
    return docs.map((d) => resolveModuleDocs(moduleKey, d, row));
  }, [moduleKey, docs, row]);

  return (
    <View className="gap-3.5">
      {items.map((item, idx) => (
        <DocumentViewerItem
          key={`${item.label}-${idx}`}
          item={item}
          onUploadFile={onUploadFile}
          canUpload={canUpload}
        />
      ))}
    </View>
  );
}
