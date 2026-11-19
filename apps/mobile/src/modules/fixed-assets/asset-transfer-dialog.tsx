import * as React from "react";
import { View, TouchableOpacity, ScrollView, ActivityIndicator, TextInput } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect, UserSelect, DatePicker } from "@/components/taska/dialogs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowRightLeft } from "lucide-react-native";
import { FaAsset, FaLocation } from "./types";
import { FaLocationSelect } from "./fa-location-select";
import { api } from "@/services/api";

type Props = {
  visible: boolean;
  onClose: () => void;
  asset: FaAsset | null;
  users: Array<{ id: number; name: string; department?: string }>;
  locations: FaLocation[];
  onSuccess: () => void;
};

export function AssetTransferDialog(props: Props) {
  if (!props.visible || !props.asset) return null;
  return <AssetTransferContent key={props.asset.id} {...props} asset={props.asset} />;
}

function AssetTransferContent({
  visible,
  onClose,
  asset,
  users,
  locations,
  onSuccess,
}: Props & { asset: FaAsset }) {
  const [toUserId, setToUserId] = React.useState<number | undefined>(undefined);
  const [toDepartment, setToDepartment] = React.useState(asset.department || "");
  const [toLocationId, setToLocationId] = React.useState<number | undefined>(
    asset.locationId || undefined,
  );
  const [transferDate, setTransferDate] = React.useState(
    new Date().toISOString().slice(0, 10),
  );
  const [condition, setCondition] = React.useState<string>(asset.condition || "GOOD");
  const [reason, setReason] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const safeUsers = Array.isArray(users) ? users : [];
  const safeLocations = Array.isArray(locations) ? locations : [];

  const userOptions = React.useMemo(
    () => [
      { value: 0, label: "-- Tanpa PIC Individu (Pool / Departemen) --" },
      ...safeUsers.map((u) => ({ value: u.id, label: `${u.name}${u.department ? ` (${u.department})` : ""}` })),
    ],
    [safeUsers],
  );

  const locationOptions = React.useMemo(
    () => [
      { value: 0, label: "-- Tetap di lokasi saat ini --" },
      ...safeLocations.map((loc) => ({ value: loc.id, label: `${loc.name}${loc.building ? ` [${loc.building}]` : ""}` })),
    ],
    [safeLocations],
  );

  const CONDITION_OPTIONS = [
    { value: "EXCELLENT", label: "Sangat Baik (A)" },
    { value: "GOOD", label: "Baik (B)" },
    { value: "FAIR", label: "Cukup (C)" },
    { value: "POOR", label: "Kurang (D)" },
    { value: "BROKEN", label: "Rusak (E)" },
  ];

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError("Alasan mutasi/pemindahan aset wajib diisi.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api("POST", `/fixed-assets/${asset.id}/transfer`, {
        toUserId,
        toDepartment,
        toLocationId,
        transferDate,
        condition,
        reason,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Gagal melakukan mutasi aset.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={visible} onOpenChange={(op) => { if (!op) onClose(); }}>
      <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] gap-0 p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="flex-row items-center justify-between px-5 py-4 border-b border-border">
          <View className="flex-row items-center gap-2">
            <ArrowRightLeft size={20} className="text-primary" />
            <DialogTitle className="font-bold text-base text-foreground">
              Mutasi / Perpindahan Aset (Transfer)
            </DialogTitle>
          </View>
        </DialogHeader>

          {/* Form */}
          <ScrollView className="p-5 max-h-[75vh]" showsVerticalScrollIndicator={false}>
            {/* Info Posisi Aset Saat Ini */}
            <View className="bg-muted/40 p-3 rounded-xl border border-border/60 mb-4">
              <Text className="text-xs font-semibold text-foreground mb-1">
                Aset: {asset.assetCode} - {asset.name}
              </Text>
              <View className="flex-row justify-between text-xs text-muted-foreground">
                <Text className="text-xs text-muted-foreground">
                  PIC Saat Ini: {asset.assignedUser?.name || "Belum ada PIC"}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Lokasi: {asset.location?.name || "-"}
                </Text>
              </View>
            </View>

            {error ? (
              <View className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg mb-4">
                <Text className="text-xs text-destructive">{error}</Text>
              </View>
            ) : null}

            {/* Target PIC Baru */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-foreground mb-1.5">
                PIC Baru (Opsional, kosongkan jika tidak ditugaskan ke individu)
              </Text>
              <UserSelect
                userId={toUserId}
                value={userOptions.find((u) => u.value === toUserId)?.label || ""}
                onChange={(u) => {
                  if (u?.id) {
                    const uId = Number(u.id);
                    setToUserId(uId);
                    if (u.roleLabel && !toDepartment) setToDepartment(u.roleLabel);
                  } else {
                    setToUserId(undefined);
                  }
                }}
                placeholder="Pilih PIC Baru"
                triggerClassName="h-10 rounded-lg bg-card border-border/80"
              />
            </View>

            {/* Target Lokasi Baru */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-foreground mb-1.5">
                Lokasi / Ruangan Baru
              </Text>
              <FaLocationSelect
                locationId={toLocationId}
                locations={locations}
                onChange={(loc) => {
                  setToLocationId(loc?.id ?? undefined);
                }}
                className="h-10 rounded-lg bg-card border-border/80"
              />
            </View>

            {/* Target Departemen Baru */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-foreground mb-1.5">
                Departemen Baru
              </Text>
              <Input
                value={toDepartment}
                onChangeText={setToDepartment}
                placeholder="Departemen penanggung jawab baru"
                className="h-10 rounded-lg bg-card border-border/80"
              />
            </View>

            {/* Tanggal Mutasi & Kondisi */}
            <View className="flex-row gap-3 mb-4">
              <View className="flex-1">
                <Text className="text-xs font-semibold text-foreground mb-1.5">
                  Tanggal Mutasi *
                </Text>
                <DatePicker
                  value={transferDate}
                  onChange={setTransferDate}
                  placeholder="Pilih tanggal mutasi"
                />
              </View>

              <View className="flex-1">
                <Text className="text-xs font-semibold text-foreground mb-1.5">
                  Kondisi Saat Mutasi
                </Text>
                <SearchableSelect
                  value={CONDITION_OPTIONS.find((c) => c.value === condition)?.label || ""}
                  options={CONDITION_OPTIONS.map((c) => c.label)}
                  onChange={(val) => {
                    const match = CONDITION_OPTIONS.find((c) => c.label === val);
                    if (match) setCondition(match.value);
                  }}
                  placeholder="Pilih Kondisi"
                  className="h-10 rounded-lg bg-card border-border/80"
                />
              </View>
            </View>

            {/* Alasan Mutasi */}
            <View className="mb-2">
              <Text className="text-xs font-semibold text-foreground mb-1.5">
                Alasan Mutasi / Pemindahan *
              </Text>
              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder="Contoh: Rotasi staf, pergantian kantor cabang, pemindahan server ke rak lab..."
                multiline
                numberOfLines={3}
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              />
            </View>
          </ScrollView>

          {/* Footer */}
          <DialogFooter className="flex-row items-center justify-end gap-2 px-5 py-3.5 border-t border-border bg-muted/20">
            <Button variant="outline" onPress={onClose} disabled={loading}>
              <Text>Batal</Text>
            </Button>
            <Button variant="default" onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text>Proses Mutasi</Text>}
            </Button>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
