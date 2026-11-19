import * as React from "react";
import { View, Platform } from "react-native";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react-native";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/taska/dialogs";
import { colors } from "@/tokens";
import { formatDate } from "../maintenance-utils";
import type { MaintSchedule } from "../types";

export function MaintenanceRescheduleDialog(props: {
  visible: boolean;
  onClose: () => void;
  schedule?: MaintSchedule | null;
  onReschedule: (id: number, newDate: string, reason: string) => Promise<void>;
}) {
  if (!props.visible || !props.schedule) return null;
  return <RescheduleContent key={props.schedule.id} {...props} schedule={props.schedule} />;
}

function RescheduleContent({
  onClose,
  schedule,
  onReschedule,
}: {
  onClose: () => void;
  schedule: MaintSchedule;
  onReschedule: (id: number, newDate: string, reason: string) => Promise<void>;
}) {
  const [newDate, setNewDate] = React.useState(schedule.scheduledDate ? schedule.scheduledDate.slice(0, 10) : "");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSave = async () => {
    if (!newDate) {
      setError("Tanggal baru harus ditentukan");
      return;
    }
    if (!reason.trim()) {
      setError("Alasan penjadwalan ulang harus diisi");
      return;
    }

    try {
      setBusy(true);
      setError(null);
      await onReschedule(schedule.id, newDate, reason.trim());
      onClose();
    } catch (err: any) {
      setError(err?.message || "Gagal menjadwalkan ulang");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="w-[96vw] max-w-md p-0"
        style={Platform.select({
          web: { width: "min(96vw, 480px)", maxWidth: "480px" } as any,
        })}
      >
        <DialogHeader className="border-b border-border/70 px-6 py-4">
          <View className="flex-row items-center gap-3">
            <View className="rounded-lg p-2" style={{ backgroundColor: `${colors.primary}18` }}>
              <Clock size={18} color={colors.primary} />
            </View>
            <View>
              <DialogTitle>Jadwalkan Ulang #{schedule.scheduleNumber}</DialogTitle>
              <Text className="text-xs text-muted-foreground">
                Perbarui tanggal pelaksanaan servis dan catat alasannya
              </Text>
            </View>
          </View>
        </DialogHeader>

        <View className="px-6 py-4 gap-4">
          {error && (
            <View style={{ backgroundColor: "#fee2e2", padding: 10, borderRadius: 8 }}>
              <Text style={{ fontSize: 12, color: "#b91c1c" }}>{error}</Text>
            </View>
          )}

          <View style={{ backgroundColor: "#f5f5f4", padding: 12, borderRadius: 8, gap: 2, borderWidth: 1, borderColor: "#e5e7eb" }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#0f172a" }}>
              Aset: {schedule.asset?.assetCode} - {schedule.asset?.name}
            </Text>
            <Text style={{ fontSize: 11, color: "#64748b" }}>
              Jadwal Saat Ini: {formatDate(schedule.scheduledDate)} · Status: {schedule.status}
            </Text>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155" }}>
              Tanggal Baru Servis <Text style={{ color: "#dc2626" }}>*</Text>
            </Text>
            <DatePicker value={newDate} onChange={(val) => setNewDate(val || "")} />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155" }}>
              Alasan Penjadwalan Ulang (PRD 3.3) <Text style={{ color: "#dc2626" }}>*</Text>
            </Text>
            <Textarea
              placeholder="Misal: Teknisi berhalangan, spare part belum tiba, aset masih digunakan mendesak..."
              value={reason}
              onChangeText={setReason}
              numberOfLines={3}
            />
          </View>
        </View>

        <DialogFooter className="border-t border-border/70 px-6 py-3">
          <Button variant="outline" onPress={onClose} disabled={busy}>
            <Text>Batal</Text>
          </Button>
          <Button onPress={handleSave} disabled={busy}>
            <Text>{busy ? "Menyimpan..." : "Simpan Jadwal Baru"}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
