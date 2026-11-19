import * as React from "react";
import { View, ScrollView, Platform, Pressable } from "react-native";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ShieldCheck, ShieldAlert } from "lucide-react-native";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchableSelect, DatePicker } from "@/components/akuntra/dialogs";
import { AssetSelect } from "@/components/akuntra/document-selects/asset-select";
import { colors } from "@/tokens";
import type { MaintRequest, MaintLookups } from "../types";

export function MaintenanceRequestDialog(props: {
  visible: boolean;
  onClose: () => void;
  lookups: MaintLookups;
  onSubmit: (payload: any) => Promise<void>;
}) {
  if (!props.visible) return null;
  return <RequestFormContent {...props} />;
}

function RequestFormContent({
  onClose,
  lookups,
  onSubmit,
  ...props
}: {
  onClose: () => void;
  lookups: MaintLookups;
  onSubmit: (payload: any) => Promise<void>;
}) {
  const [assetId, setAssetId] = React.useState<number | "">("");
  const [requestDate, setRequestDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [problemDescription, setProblemDescription] = React.useState("");
  const [urgency, setUrgency] = React.useState("MEDIUM");
  const [fileUrl, setFileUrl] = React.useState("");
  const [fileTitle, setFileTitle] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSave = async () => {
    if (!assetId) {
      setError("Pilih aset yang mengalami kerusakan");
      return;
    }
    if (!problemDescription.trim()) {
      setError("Deskripsi kerusakan atau keluhan harus diisi");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onSubmit({
        assetId: Number(assetId),
        requestDate,
        problemDescription: problemDescription.trim(),
        urgency,
        attachments: fileUrl.trim()
          ? [{ fileUrl: fileUrl.trim(), title: fileTitle.trim() || "Foto Bukti Kerusakan" }]
          : undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Gagal mengirim laporan kerusakan");
    } finally {
      setSaving(false);
    }
  };

  const selectedAsset = lookups.assets.find((a) => a.id === Number(assetId));

  const assetOptions = lookups.assets.map((a) => `${a.id} - ${a.name} (${a.assetCode})`);
  const selectedAssetStr = assetId
    ? assetOptions.find((o) => o.startsWith(`${assetId} -`)) || String(assetId)
    : "";

  const urgencyOptions = [
    "LOW - Low (Tidak mengganggu operasional)",
    "MEDIUM - Medium (Mengganggu sebagian pekerjaan)",
    "HIGH - High (Mengganggu operasional utama)",
    "CRITICAL - Critical (Aset mati total / darurat)",
  ];
  const selectedUrgencyStr =
    urgencyOptions.find((o) => o.startsWith(`${urgency} -`)) || "MEDIUM - Medium (Mengganggu sebagian pekerjaan)";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="w-[96vw] max-w-xl max-h-[90vh] p-0"
        style={Platform.select({
          web: { width: "min(96vw, 620px)", maxWidth: "620px" } as any,
        })}
      >
        <DialogHeader className="border-b border-border/70 px-6 py-4">
          <View className="flex-row items-center gap-3">
            <View className="rounded-lg p-2" style={{ backgroundColor: `${colors.primary}18` }}>
              <AlertTriangle size={18} color={colors.primary} />
            </View>
            <View>
              <DialogTitle>Lapor Kerusakan Aset (Corrective)</DialogTitle>
              <Text className="text-xs text-muted-foreground">
                Buat tiket laporan gangguan atau kerusakan operasional aset
              </Text>
            </View>
          </View>
        </DialogHeader>

        <ScrollView className="max-h-[75vh] px-6 py-4" contentContainerStyle={{ gap: 16 }}>
          {error && (
            <View style={{ backgroundColor: "#fee2e2", padding: 12, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <ShieldAlert size={16} color="#dc2626" />
              <Text style={{ fontSize: 13, color: "#b91c1c", flex: 1 }}>{error}</Text>
            </View>
          )}

          {/* Aset Picker */}
          <View>
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6 }}>
              Aset yang Mengalami Gangguan / Kerusakan <Text style={{ color: "#dc2626" }}>*</Text>
            </Text>
            <AssetSelect
              assetId={assetId}
              assets={lookups.assets as any}
              onChange={(a) => setAssetId(a ? Number(a.id) : "")}
              placeholder="Cari & pilih aset (Fixed Assets)..."
            />
            {selectedAsset && (
              <View style={{ backgroundColor: "#f5f5f4", padding: 10, borderRadius: 8, marginTop: 6, borderWidth: 1, borderColor: "#e5e7eb" }}>
                <Text style={{ fontSize: 11, color: "#64748b" }}>
                  Lokasi: {selectedAsset.location?.name || "-"} · Penanggung Jawab: {selectedAsset.department || "-"} · Kondisi: {selectedAsset.condition || "GOOD"}
                </Text>
              </View>
            )}
          </View>

          {/* Tanggal & Urgensi */}
          <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
            <View style={{ flex: 1, minWidth: 200 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6 }}>
                Tanggal Kerusakan
              </Text>
              <DatePicker value={requestDate} onChange={(val) => setRequestDate(val || "")} />
            </View>

            <View style={{ flex: 1, minWidth: 200 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6 }}>
                Tingkat Urgensi
              </Text>
              <SearchableSelect
                value={selectedUrgencyStr}
                options={urgencyOptions}
                onChange={(val) => setUrgency(val.split(" - ")[0] ?? "MEDIUM")}
              />
            </View>
          </View>

          {/* Problem Description */}
          <View>
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6 }}>
              Deskripsi Kerusakan / Gejala Gangguan <Text style={{ color: "#dc2626" }}>*</Text>
            </Text>
            <Textarea
              placeholder="Jelaskan secara rinci gejala kerusakan (misal: mesin mati mendadak, layar bergaris, server mati lampu, dll)..."
              value={problemDescription}
              onChangeText={setProblemDescription}
              numberOfLines={4}
            />
          </View>

          {/* Foto Bukti Kerusakan */}
          <View style={{ backgroundColor: "#f5f5f4", padding: 14, borderRadius: 10, gap: 10, borderWidth: 1, borderColor: "#e5e7eb" }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155" }}>
              Unggah Foto / Video Bukti Kerusakan (Opsional)
            </Text>
            <Input
              placeholder="Keterangan foto (misal: Foto bagian mesin yang bocor)"
              value={fileTitle}
              onChangeText={setFileTitle}
            />
            <Input
              placeholder="URL Foto atau tautan file dokumen penunjang..."
              value={fileUrl}
              onChangeText={setFileUrl}
            />
          </View>
        </ScrollView>

        <DialogFooter className="border-t border-border/70 px-6 py-3">
          <Button variant="outline" onPress={onClose} disabled={saving}>
            <Text>Batal</Text>
          </Button>
          <Button onPress={handleSave} disabled={saving}>
            <Text>{saving ? "Mengirim..." : "Kirim Laporan Kerusakan"}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function InitialInspectionDialog(props: {
  visible: boolean;
  onClose: () => void;
  request?: MaintRequest | null;
  onInspect: (id: number, notes: string, decision: "APPROVED" | "REJECTED", reason?: string) => Promise<void>;
  onCreateWo: (id: number) => Promise<void>;
}) {
  if (!props.visible || !props.request) return null;
  return <InspectionFormContent key={props.request.id} {...props} request={props.request} />;
}

function InspectionFormContent({
  onClose,
  request,
  onInspect,
  onCreateWo,
}: {
  onClose: () => void;
  request: MaintRequest;
  onInspect: (id: number, notes: string, decision: "APPROVED" | "REJECTED", reason?: string) => Promise<void>;
  onCreateWo: (id: number) => Promise<void>;
}) {
  const [notes, setNotes] = React.useState(request.initialInspectionNotes || "");
  const [decision, setDecision] = React.useState<"APPROVED" | "REJECTED">("APPROVED");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const handleSubmit = async () => {
    if (!notes.trim()) {
      alert("Catatan hasil pemeriksaan awal harus diisi");
      return;
    }
    try {
      setBusy(true);
      await onInspect(request.id, notes.trim(), decision, reason.trim() || undefined);
      if (decision === "APPROVED") {
        await onCreateWo(request.id);
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const decisionOptions = [
    "APPROVED - Setujui & Buat Work Order Perbaikan",
    "REJECTED - Tolak Permintaan (Reject)",
  ];
  const selectedDecisionStr =
    decision === "REJECTED" ? decisionOptions[1] : decisionOptions[0];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="w-[96vw] max-w-lg max-h-[90vh] p-0"
        style={Platform.select({
          web: { width: "min(96vw, 560px)", maxWidth: "560px" } as any,
        })}
      >
        <DialogHeader className="border-b border-border/70 px-6 py-4">
          <View className="flex-row items-center gap-3">
            <View className="rounded-lg p-2" style={{ backgroundColor: `${colors.primary}18` }}>
              <ShieldCheck size={18} color={colors.primary} />
            </View>
            <View>
              <DialogTitle>Pemeriksaan Awal #{request.requestNumber}</DialogTitle>
              <Text className="text-xs text-muted-foreground">
                Verifikasi kondisi dan tentukan tindakan perbaikan
              </Text>
            </View>
          </View>
        </DialogHeader>

        <ScrollView className="max-h-[75vh] px-6 py-4" contentContainerStyle={{ gap: 14 }}>
          <View style={{ backgroundColor: "#f5f5f4", padding: 12, borderRadius: 8, gap: 4, borderWidth: 1, borderColor: "#e5e7eb" }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#0f172a" }}>
              Aset: {request.asset?.assetCode} - {request.asset?.name}
            </Text>
            <Text style={{ fontSize: 12, color: "#475569" }}>
              Keluhan: {request.problemDescription}
            </Text>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155" }}>
              Catatan Hasil Pemeriksaan Awal Supervisor <Text style={{ color: "#dc2626" }}>*</Text>
            </Text>
            <Textarea
              placeholder="Hasil verifikasi fisik, diagnosis sementara, dan rekomendasi perbaikan..."
              value={notes}
              onChangeText={setNotes}
              numberOfLines={3}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155" }}>
              Keputusan Permintaan
            </Text>
            <SearchableSelect
              value={selectedDecisionStr}
              options={decisionOptions}
              onChange={(val) => setDecision(val.startsWith("REJECTED") ? "REJECTED" : "APPROVED")}
            />
          </View>

          {decision === "REJECTED" && (
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155" }}>
                Alasan Penolakan <Text style={{ color: "#dc2626" }}>*</Text>
              </Text>
              <Input
                placeholder="Tuliskan alasan penolakan..."
                value={reason}
                onChangeText={setReason}
              />
            </View>
          )}
        </ScrollView>

        <DialogFooter className="border-t border-border/70 px-6 py-3">
          <Button variant="outline" onPress={onClose} disabled={busy}>
            <Text>Batal</Text>
          </Button>
          <Button onPress={handleSubmit} disabled={busy}>
            <Text>{busy ? "Memproses..." : decision === "APPROVED" ? "Setujui & Buat WO" : "Tolak Permintaan"}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
