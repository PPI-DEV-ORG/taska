import * as React from "react";
import { View, ScrollView, Platform } from "react-native";
import { FileCheck, FileText, CheckCircle2, AlertCircle } from "lucide-react-native";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/taska/basics";
import { DatePicker, formatThousands } from "@/components/taska/dialogs";
import { FileUploader, type FileUploaderHandle } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { rupiah } from "@/lib/format";
import type { Row } from "@/constants/modules";

interface RecordClientPoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Row;
  activeQuotation?: any;
  requirements?: any[];
  onSuccess?: (createdPo: any) => void;
}

export function RecordClientPoDialog({
  open,
  onOpenChange,
  project,
  activeQuotation,
  requirements,
  onSuccess,
}: RecordClientPoDialogProps) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <RecordClientPoForm
        project={project}
        activeQuotation={activeQuotation}
        requirements={requirements}
        onClose={() => onOpenChange(false)}
        onSuccess={onSuccess}
      />
    </Dialog>
  );
}

function RecordClientPoForm({
  project,
  activeQuotation,
  requirements,
  onClose,
  onSuccess,
}: {
  project: Row;
  activeQuotation?: any;
  requirements?: any[];
  onClose: () => void;
  onSuccess?: (createdPo: any) => void;
}) {
  const { addRow, refreshModule, pushHistory, toast } = useApp();
  const fileHandleRef = React.useRef<FileUploaderHandle | null>(null);

  const initialAmount = React.useMemo(() => {
    const qAmount = Number(activeQuotation?.totalAfterDisc || activeQuotation?.total || activeQuotation?.nilai || 0);
    const pAmount = Number(project.nilai || 0);
    return qAmount > 0 ? qAmount : pAmount;
  }, [activeQuotation, project.nilai]);

  const [poNumber, setPoNumber] = React.useState<string>("");
  const [date, setDate] = React.useState<string>(() => new Date().toISOString().slice(0, 10));
  const [amountStr, setAmountStr] = React.useState<string>(() =>
    initialAmount > 0 ? formatThousands(initialAmount) : ""
  );
  const [notes, setNotes] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

  const customerName = project.customer || activeQuotation?.customer || "-";
  const quotationNumber = activeQuotation?.nomor || project.penawaran || "-";

  // Items count from quotation or requirements
  const linkedItems = React.useMemo(() => {
    if (Array.isArray(activeQuotation?.items) && activeQuotation.items.length > 0) {
      return activeQuotation.items;
    }
    if (Array.isArray(requirements) && requirements.length > 0) {
      return requirements.map((r: any) => ({
        name: r.name,
        qty: r.neededQty || 1,
        unit: r.unit || "unit",
        harga: r.unitPrice || r.costPrice || 0,
      }));
    }
    return [];
  }, [activeQuotation?.items, requirements]);

  async function handleSubmit() {
    const cleanAmount = Number(String(amountStr).replace(/\D/g, "")) || 0;
    if (cleanAmount <= 0) {
      toast("Nilai PO harus lebih dari 0", "danger");
      return;
    }

    setIsSubmitting(true);
    try {
      // Flush uploaded file if staged
      let uploadedFileId: number | null = null;
      if (fileHandleRef.current?.hasStaged()) {
        uploadedFileId = await fileHandleRef.current.flush();
      }

      const created = await addRow("po-client", {
        nomor: poNumber.trim() || undefined,
        nomorPoClient: poNumber.trim() || undefined,
        docMode: "PO",
        customer: customerName,
        customerId: project.customerId ? Number(project.customerId) : activeQuotation?.customerId ? Number(activeQuotation.customerId) : undefined,
        penawaran: quotationNumber,
        quotationId: activeQuotation?.id ? Number(activeQuotation.id) : project.quotationId ? Number(project.quotationId) : undefined,
        nilai: cleanAmount,
        tanggal: date,
        catatan: notes ? `[project:${project.id}] ${notes}` : `[project:${project.id}] Catat PO Customer untuk ${project.nama}`,
        projectId: Number(project.id),
        projectName: project.nama,
        fileId: uploadedFileId || undefined,
        items: linkedItems,
      });

      if (created) {
        void refreshModule("po-client");
        void refreshModule("projects");
        pushHistory("projects", project.id, `Mencatat PO Customer ${poNumber.trim() || created.nomor} (${rupiah(cleanAmount)})`);
        toast("PO Pelanggan berhasil dicatat!");
        onSuccess?.(created);
        onClose();
      }
    } catch (err: any) {
      toast(err?.message || "Gagal mencatat PO Pelanggan", "danger");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden">
      <DialogHeader className="p-4 border-b border-border/60">
        <View className="flex-row items-center gap-2.5">
          <View className="w-9 h-9 rounded-lg bg-primary/10 items-center justify-center">
            <FileCheck size={20} color={colors.primary} />
          </View>
          <View className="flex-1">
            <DialogTitle>Catat PO Pelanggan</DialogTitle>
            <Text className="text-xs text-muted-foreground mt-0.5">
              Catat dokumen PO yang diterima dari customer untuk project ini tanpa menerbitkan Sales Order (SO)
            </Text>
          </View>
        </View>
      </DialogHeader>

      <ScrollView contentContainerClassName="p-4 gap-4" style={{ maxHeight: 540 }}>
        {/* Project Context Box */}
        <View className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 gap-2">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-1.5 flex-1 mr-2">
              <FileText size={14} color={colors.primary} />
              <Text className="text-xs font-semibold text-primary truncate" numberOfLines={1}>
                {project.nama}
              </Text>
            </View>
            <View className="px-2 py-0.5 rounded-full bg-primary/15">
              <Text className="text-[10px] font-semibold text-primary">PO Masuk (Tanpa SO)</Text>
            </View>
          </View>

          <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <Text className="text-xs text-muted-foreground">
              Customer: <Text className="font-semibold text-foreground">{customerName}</Text>
            </Text>
            {quotationNumber !== "-" && (
              <Text className="text-xs text-muted-foreground">
                Penawaran: <Text className="font-semibold text-foreground">{quotationNumber}</Text>
              </Text>
            )}
          </View>
        </View>

        {/* Form Inputs */}
        <View className="gap-3.5">
          <View className="flex-row flex-wrap gap-3">
            {/* Nomor PO */}
            <View className="flex-1 min-w-[240px]">
              <FormField
                label="Nomor PO Pelanggan"
                helper="Nomor PO resmi dari pelanggan. Kosongkan untuk nomor otomatis sistem."
              >
                <Input
                  value={poNumber}
                  onChangeText={setPoNumber}
                  placeholder="Contoh: PO-CUST/2026/11/001"
                />
              </FormField>
            </View>

            {/* Tanggal PO */}
            <View className="flex-1 min-w-[240px]">
              <FormField label="Tanggal Dokumen PO *" helper="Tanggal terbit PO dari pihak pelanggan">
                <DatePicker value={date} onChange={setDate} placeholder="Pilih tanggal PO" />
              </FormField>
            </View>
          </View>

          <View className="flex-row flex-wrap gap-3">
            {/* Nilai PO */}
            <View className="flex-1 min-w-[240px]">
              <FormField
                label="Total Nilai PO (Rp) *"
                helper="Total nilai pesanan / kontrak sesuai PO pelanggan"
              >
                <Input
                  value={amountStr}
                  onChangeText={(val) => setAmountStr(formatThousands(val))}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </FormField>
            </View>

            {/* Customer Info (Read-only) */}
            <View className="flex-1 min-w-[240px]">
              <FormField label="Pelanggan Proyek" helper="Pelanggan pemesan (terikat otomatis ke proyek ini)">
                <View className="h-10 px-3 justify-center rounded-lg border border-border/70 bg-muted/40">
                  <Text className="text-sm font-medium text-foreground truncate" numberOfLines={1}>
                    {customerName}
                  </Text>
                </View>
              </FormField>
            </View>
          </View>

          {/* File Upload PO Customer */}
          <View className="mt-1">
            <FileUploader
              label="Upload Berkas PO Pelanggan (PDF / Gambar)"
              kind="dokumen"
              category="po-client"
              handleRef={(h) => {
                fileHandleRef.current = h;
              }}
              hint="Lampirkan file scan/PDF resmi PO dari pelanggan (maks. 15 MB)"
            />
          </View>

          {/* Catatan / Keterangan */}
          <FormField
            label="Catatan PO Pelanggan (Opsional)"
            helper="Ketentuan termin penagihan, catatan instruksi pengiriman, atau catatan lainnya"
          >
            <Input
              value={notes}
              onChangeText={setNotes}
              placeholder="Contoh: Termin pembayaran 30 hari kalender setelah BAST ditandatangani"
              multiline
              numberOfLines={2}
            />
          </FormField>

          {/* Items attached info */}
          {linkedItems.length > 0 && (
            <View className="flex-row items-center gap-2 p-2.5 rounded-lg bg-muted/50 border border-border/50">
              <CheckCircle2 size={15} color={colors.primary} />
              <Text className="text-xs text-muted-foreground flex-1">
                <Text className="font-semibold text-foreground">{linkedItems.length} item barang & jasa</Text> dari project/penawaran akan otomatis ditautkan ke PO ini.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <DialogFooter className="p-3 border-t border-border/60 flex-row items-center justify-end gap-2 bg-muted/20">
        <Button variant="outline" size="sm" onPress={onClose} disabled={isSubmitting}>
          <Text>Batal</Text>
        </Button>
        <Button variant="default" size="sm" onPress={handleSubmit} disabled={isSubmitting}>
          <FileCheck size={14} color="#ffffff" className="mr-1.5" />
          <Text className="font-semibold text-white">
            {isSubmitting ? "Menyimpan..." : "Simpan Catatan PO"}
          </Text>
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

