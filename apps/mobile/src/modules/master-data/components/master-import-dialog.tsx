import * as React from "react";
import { View, ScrollView } from "react-native";
import { FileSpreadsheet, CheckCircle2 } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FormField } from "@/components/taska/basics";
import { SearchableSelect } from "@/components/taska/dialogs";
import { FileUploader } from "@/components/taska/file-uploader";
import { apiBase, getAccess, uploadMasterImport, type MasterImportType } from "@/services/api";
import { colors } from "@/tokens";

interface MasterImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void>;
  toast: (msg: string, type?: "success" | "danger" | "info" | "warning") => void;
}

export function MasterImportDialog({
  open,
  onOpenChange,
  onSuccess,
  toast,
}: MasterImportDialogProps) {
  const [importTarget, setImportTarget] = React.useState("Customer (Data Klien & PIC)");
  const [importFile, setImportFile] = React.useState<{ name: string; blob?: Blob; uri?: string } | null>(null);
  const [importBusy, setImportBusy] = React.useState(false);
  const [importResult, setImportResult] = React.useState<{
    total: number;
    imported: number;
    failed: Array<{ row: number; error: string; data: Record<string, any> }>;
  } | null>(null);

  function resolveImportType(target: string): MasterImportType {
    if (target.includes("Customer")) return "customer";
    if (target.includes("Supplier")) return "supplier";
    if (target.includes("Gudang")) return "warehouse";
    if (target.includes("Serial Number (Per Unit)")) return "serial";
    if (target.includes("Saldo")) return "stock";
    return "product";
  }

  async function handleExecuteImport() {
    if (!importFile) {
      toast("Silakan pilih berkas template Excel (.xlsx) terlebih dahulu", "danger");
      return;
    }
    const typeKey = resolveImportType(importTarget);
    setImportBusy(true);
    try {
      const res = await uploadMasterImport(typeKey, importFile);
      setImportResult(res);
      await onSuccess();
      if (res.failed.length === 0) {
        toast(`Berhasil mengimpor ${res.imported} dari ${res.total} baris ke master ${importTarget}!`);
      } else {
        toast(
          `Import selesai: ${res.imported} berhasil, ${res.failed.length} baris gagal validasi.`,
          res.imported > 0 ? "info" : "danger",
        );
      }
    } catch (e: any) {
      toast(e?.message || "Gagal mengimpor berkas Excel", "danger");
    } finally {
      setImportBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setImportFile(null);
          setImportResult(null);
        }
      }}
    >
      <DialogContent className="sm:max-w-xl md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Data via Template Excel (.xlsx)</DialogTitle>
        </DialogHeader>
        <View className="gap-4">
          <Text className="text-xs text-muted-foreground leading-relaxed">
            Sistem akan memvalidasi tiap baris data. Baris yang valid akan diimport ke master data, sedangkan baris gagal akan dilaporkan tanpa menggagalkan baris lainnya.
          </Text>

          <FormField label="Pilih Target Master Data" required>
            <SearchableSelect
              value={importTarget}
              onChange={(v) => {
                setImportTarget(v);
                setImportResult(null);
              }}
              options={[
                "Customer (Data Klien & PIC)",
                "Supplier (Vendor Penyedia)",
                "Produk & SKU Barang",
                "Gudang & Lokasi Inventori",
                "Saldo Stok Awal per Gudang",
                "Serial Number (Per Unit)",
              ]}
              placeholder="Pilih target master data"
            />
          </FormField>

          <View className="bg-panel/40 border-border/70 rounded-xl border p-3.5 gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-semibold">Template Contoh Excel ({importTarget})</Text>
              <Button
                variant="outline"
                size="sm"
                onPress={async () => {
                  const typeKey = resolveImportType(importTarget);
                  if (typeof window !== "undefined" && typeof document !== "undefined") {
                    try {
                      const token = getAccess();
                      const res = await fetch(`${apiBase()}/imports/template?type=${typeKey}`, {
                        headers: token ? { Authorization: `Bearer ${token}` } : {},
                      });
                      if (res.ok) {
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = `template-import-${typeKey}.xlsx`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                        toast("Template Excel resmi berhasil diunduh");
                        return;
                      }
                    } catch {}
                    toast("Gagal mengunduh template dari server", "danger");
                  }
                }}
                className="flex-row items-center gap-1.5"
              >
                <FileSpreadsheet size={13} color={colors.success} />
                <Text className="text-xs">Unduh Template</Text>
              </Button>
            </View>
            <Text className="text-[11px] text-muted-foreground">
              Gunakan template resmi di atas untuk memastikan format kolom dan tipe data sesuai standar.
            </Text>
          </View>

          <FileUploader
            label="Unggah Berkas Excel (.xlsx)"
            kind="dokumen"
            onFilePicked={(file) => {
              setImportFile(file);
              setImportResult(null);
            }}
            onChange={(count) => {
              if (count === 0) {
                setImportFile(null);
                setImportResult(null);
              }
            }}
          />

          {importResult ? (
            <View className="gap-2">
              <View
                className={`${
                  importResult.failed.length === 0
                    ? "bg-success/15 border-success/30"
                    : "bg-warning/15 border-warning/30"
                } rounded-lg border p-3 flex-row items-center gap-2`}
              >
                <CheckCircle2
                  size={16}
                  color={importResult.failed.length === 0 ? colors.success : colors.warning}
                />
                <Text
                  className={`${
                    importResult.failed.length === 0 ? "text-success" : "text-warning"
                  } text-xs font-semibold flex-1`}
                >
                  Hasil Import: {importResult.imported} dari {importResult.total} baris berhasil disimpan (
                  {importResult.failed.length} baris gagal).
                </Text>
              </View>
              {importResult.failed.length > 0 ? (
                <ScrollView style={{ maxHeight: 140 }} className="bg-panel border-border rounded-lg border p-2.5">
                  {importResult.failed.map((f, idx) => (
                    <Text key={`${f.row}-${idx}`} className="text-[11px] text-danger py-0.5">
                      • Baris {f.row}: {f.error}
                    </Text>
                  ))}
                </ScrollView>
              ) : null}
            </View>
          ) : null}
        </View>
        <DialogFooter>
          <Button variant="outline" onPress={() => onOpenChange(false)}>
            <Text>{importResult ? "Tutup" : "Batal"}</Text>
          </Button>
          <Button onPress={handleExecuteImport} disabled={!importFile || importBusy}>
            <Text>{importBusy ? "Memproses..." : "Eksekusi Import Data"}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

