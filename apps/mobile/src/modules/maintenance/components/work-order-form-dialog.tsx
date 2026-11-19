import * as React from "react";
import { View, ScrollView, Platform } from "react-native";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Wrench, ShieldAlert } from "lucide-react-native";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker, SearchableSelect } from "@/components/akuntra/dialogs";
import { AssetSelect } from "@/components/akuntra/document-selects/asset-select";
import { UserSelect } from "@/components/akuntra/document-selects/user-select";
import { colors } from "@/tokens";
import type { MaintWorkOrder, MaintLookups } from "../types";

export function WorkOrderFormDialog(props: {
  visible: boolean;
  onClose: () => void;
  initialData?: MaintWorkOrder | null;
  lookups: MaintLookups;
  onSubmit: (payload: any) => Promise<void>;
}) {
  if (!props.visible) return null;
  return <WoFormContent key={props.initialData?.id ?? "new"} {...props} />;
}

function WoFormContent({
  onClose,
  initialData,
  lookups,
  onSubmit,
}: {
  onClose: () => void;
  initialData?: MaintWorkOrder | null;
  lookups: MaintLookups;
  onSubmit: (payload: any) => Promise<void>;
}) {
  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [assetId, setAssetId] = React.useState<number | "">(initialData?.assetId ?? "");
  const [maintenanceType, setMaintenanceType] = React.useState(initialData?.maintenanceType || "PREVENTIVE");
  const [priority, setPriority] = React.useState(initialData?.priority || "MEDIUM");
  const [problemDescription, setProblemDescription] = React.useState(initialData?.problemDescription || "");
  const [workInstruction, setWorkInstruction] = React.useState(initialData?.workInstruction || "");
  const [assignedToUserId, setAssignedToUserId] = React.useState<number | "">(initialData?.assignedToUserId || "");
  const [checklistId, setChecklistId] = React.useState<number | "">("");
  const [plannedStartDate, setPlannedStartDate] = React.useState(
    initialData?.plannedStartDate ? initialData.plannedStartDate.slice(0, 10) : today,
  );
  const [plannedFinishDate, setPlannedFinishDate] = React.useState(
    initialData?.plannedFinishDate ? initialData.plannedFinishDate.slice(0, 10) : today,
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSave = async () => {
    if (!assetId) {
      setError("Pilih aset yang akan dirawat/diperbaiki");
      return;
    }
    if (!problemDescription.trim()) {
      setError("Deskripsi pekerjaan / masalah harus diisi");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onSubmit({
        assetId: Number(assetId),
        maintenanceType,
        priority,
        problemDescription: problemDescription.trim(),
        workInstruction: workInstruction.trim() || undefined,
        assignedToUserId: assignedToUserId ? Number(assignedToUserId) : undefined,
        checklistId: checklistId ? Number(checklistId) : undefined,
        plannedStartDate: plannedStartDate || undefined,
        plannedFinishDate: plannedFinishDate || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Gagal menyimpan Work Order");
    } finally {
      setSaving(false);
    }
  };

  const selectedAsset = lookups.assets.find((a) => a.id === Number(assetId));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="w-[96vw] max-w-2xl max-h-[92vh] p-0"
        style={Platform.select({
          web: { width: "min(96vw, 680px)", maxWidth: "680px" } as any,
        })}
      >
        <DialogHeader className="border-b border-border/70 px-6 py-4">
          <View className="flex-row items-center gap-3">
            <View className="rounded-lg p-2" style={{ backgroundColor: `${colors.primary}18` }}>
              <Wrench size={18} color={colors.primary} />
            </View>
            <View>
              <DialogTitle>
                {initialData ? `Edit Work Order #${initialData.workOrderNumber}` : "Buat Work Order Baru"}
              </DialogTitle>
              <Text className="text-xs text-muted-foreground">
                Dokumen instruksi kerja resmi perawatan & perbaikan aset
              </Text>
            </View>
          </View>
        </DialogHeader>

        <ScrollView className="max-h-[75vh] px-6 py-4" contentContainerStyle={{ gap: 16 }}>
            {error && (
              <View
                style={{
                  backgroundColor: "#fee2e2",
                  padding: 12,
                  borderRadius: 8,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <ShieldAlert size={16} color="#dc2626" />
                <Text style={{ fontSize: 13, color: "#b91c1c", flex: 1 }}>{error}</Text>
              </View>
            )}

            {/* Aset Picker */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6 }}>
                Pilih Aset (Fixed Assets) <Text style={{ color: "#dc2626" }}>*</Text>
              </Text>
              <AssetSelect
                assetId={assetId}
                assets={lookups.assets as any}
                onChange={(a) => setAssetId(a ? Number(a.id) : "")}
                placeholder="Cari & pilih aset (Fixed Assets)..."
              />
              {selectedAsset && (
                <View
                  style={{
                    backgroundColor: "#f5f5f4",
                    padding: 10,
                    borderRadius: 8,
                    marginTop: 6,
                    gap: 2,
                    borderWidth: 1,
                    borderColor: "#e5e7eb",
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#0f172a" }}>
                    {selectedAsset.name} ({selectedAsset.assetCode})
                  </Text>
                  <Text style={{ fontSize: 11, color: "#64748b" }}>
                    Kondisi saat ini: <Text style={{ fontWeight: "600" }}>{selectedAsset.condition || "GOOD"}</Text> · Lokasi: {selectedAsset.location?.name || "-"} · Dept: {selectedAsset.department || "-"}
                  </Text>
                </View>
              )}
            </View>

            {/* Maintenance Type & Priority */}
            <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
              <View style={{ flex: 1, minWidth: 200 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6 }}>
                  Jenis Perawatan
                </Text>
                <SearchableSelect
                  value={
                    [
                      "PREVENTIVE - Preventive (Servis Berkala / Pencegahan)",
                      "CORRECTIVE - Corrective (Perbaikan Kerusakan)",
                      "EMERGENCY - Emergency (Perbaikan Darurat)",
                      "INSPECTION - Inspection (Pemeriksaan Rutin)",
                    ].find((o) => o.startsWith(maintenanceType)) ?? maintenanceType
                  }
                  options={[
                    "PREVENTIVE - Preventive (Servis Berkala / Pencegahan)",
                    "CORRECTIVE - Corrective (Perbaikan Kerusakan)",
                    "EMERGENCY - Emergency (Perbaikan Darurat)",
                    "INSPECTION - Inspection (Pemeriksaan Rutin)",
                  ]}
                  onChange={(val) => setMaintenanceType(val ? val.split(" - ")[0] ?? "PREVENTIVE" : "PREVENTIVE")}
                />
              </View>

              <View style={{ flex: 1, minWidth: 200 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6 }}>
                  Tingkat Prioritas
                </Text>
                <SearchableSelect
                  value={
                    [
                      "LOW - Low (Rendah)",
                      "MEDIUM - Medium (Sedang)",
                      "HIGH - High (Tinggi)",
                      "CRITICAL - Critical (Kritis / Darurat)",
                    ].find((o) => o.startsWith(priority)) ?? priority
                  }
                  options={[
                    "LOW - Low (Rendah)",
                    "MEDIUM - Medium (Sedang)",
                    "HIGH - High (Tinggi)",
                    "CRITICAL - Critical (Kritis / Darurat)",
                  ]}
                  onChange={(val) => setPriority(val ? val.split(" - ")[0] ?? "MEDIUM" : "MEDIUM")}
                />
              </View>
            </View>

            {/* Problem Description */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6 }}>
                Deskripsi Pekerjaan / Masalah <Text style={{ color: "#dc2626" }}>*</Text>
              </Text>
              <Textarea
                placeholder="Jelaskan kebutuhan perawatan atau kerusakan yang dialami aset..."
                value={problemDescription}
                onChangeText={setProblemDescription}
                numberOfLines={3}
              />
            </View>

            {/* Work Instruction */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6 }}>
                Instruksi Kerja (Work Instruction)
              </Text>
              <Textarea
                placeholder="Petunjuk teknis atau SOP langkah perbaikan untuk teknisi..."
                value={workInstruction}
                onChangeText={setWorkInstruction}
                numberOfLines={2}
              />
            </View>

            {/* Assigned Technician & Checklist Template */}
            <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
              <View style={{ flex: 1, minWidth: 200 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6 }}>
                  Teknisi / PIC Penanggung Jawab
                </Text>
                <UserSelect
                  userId={assignedToUserId}
                  onChange={(u) => setAssignedToUserId(u ? Number(u.id) : "")}
                  placeholder="Cari & pilih teknisi penanggung jawab..."
                />
              </View>

              {!initialData && (
                <View style={{ flex: 1, minWidth: 200 }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6 }}>
                    Template Checklist (Opsional)
                  </Text>
                  <SearchableSelect
                    placeholder="-- Pilih Template Checklist (Opsional) --"
                    value={
                      checklistId
                        ? lookups.checklists.find((c) => c.id === Number(checklistId))
                          ? `${checklistId} - ${lookups.checklists.find((c) => c.id === Number(checklistId))?.name}`
                          : ""
                        : ""
                    }
                    options={lookups.checklists.map((c) => `${c.id} - ${c.name} (${c.items?.length || 0} item)`)}
                    onChange={(val) => setChecklistId(val ? Number(val.split(" - ")[0]) : "")}
                    clearable
                  />
                </View>
              )}
            </View>

            {/* Planned Dates */}
            <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
              <View style={{ flex: 1, minWidth: 200 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6 }}>
                  Rencana Mulai
                </Text>
                <DatePicker value={plannedStartDate} onChange={(val) => setPlannedStartDate(val || "")} />
              </View>
              <View style={{ flex: 1, minWidth: 200 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6 }}>
                  Rencana Selesai
                </Text>
                <DatePicker value={plannedFinishDate} onChange={(val) => setPlannedFinishDate(val || "")} />
              </View>
            </View>
        </ScrollView>

        <DialogFooter className="border-t border-border/70 px-6 py-3">
          <Button variant="outline" onPress={onClose} disabled={saving}>
            <Text>Batal</Text>
          </Button>
          <Button onPress={handleSave} disabled={saving}>
            <Text>{saving ? "Menyimpan..." : initialData ? "Perbarui WO" : "Simpan Work Order"}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
