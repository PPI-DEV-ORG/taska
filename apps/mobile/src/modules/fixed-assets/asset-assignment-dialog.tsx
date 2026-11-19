import * as React from "react";
import { View, TouchableOpacity, ScrollView, ActivityIndicator, TextInput } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect, UserSelect, DatePicker } from "@/components/taska/dialogs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { UserCheck, Calendar } from "lucide-react-native";
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

export function AssetAssignmentDialog(props: Props) {
  if (!props.visible || !props.asset) return null;
  return <AssetAssignmentContent key={props.asset.id} {...props} asset={props.asset} />;
}

function AssetAssignmentContent({
  visible,
  onClose,
  asset,
  users,
  locations,
  onSuccess,
}: Props & { asset: FaAsset }) {
  const [assignedUserId, setAssignedUserId] = React.useState<number | undefined>(
    asset.assignedUserId || undefined,
  );
  const [department, setDepartment] = React.useState(asset.department || "");
  const [locationId, setLocationId] = React.useState<number | undefined>(
    asset.locationId || undefined,
  );
  const [assignmentDate, setAssignmentDate] = React.useState(
    new Date().toISOString().slice(0, 10),
  );
  const [conditionAtHandover, setConditionAtHandover] = React.useState<string>(
    asset.condition || "GOOD",
  );
  const [notes, setNotes] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const safeUsers = Array.isArray(users) ? users : [];
  const safeLocations = Array.isArray(locations) ? locations : [];

  const userOptions = React.useMemo(
    () => safeUsers.map((u) => ({ value: u.id, label: `${u.name}${u.department ? ` (${u.department})` : ""}` })),
    [safeUsers],
  );

  const locationOptions = React.useMemo(
    () => safeLocations.map((loc) => ({ value: loc.id, label: `${loc.name}${loc.building ? ` [${loc.building}]` : ""}` })),
    [safeLocations],
  );

  const CONDITION_OPTIONS = [
    { value: "EXCELLENT", label: "Sangat Baik (A)" },
    { value: "GOOD", label: "Baik (B)" },
    { value: "FAIR", label: "Cukup (C)" },
    { value: "POOR", label: "Kurang (D)" },
  ];

  const handleSubmit = async () => {
    if (!assignedUserId && !department) {
      setError("Pilih karyawan penerima atau tentukan departemen penanggung jawab.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api("POST", `/fixed-assets/${asset.id}/assign`, {
        assignedToUserId: assignedUserId,
        department,
        locationId,
        assignmentDate,
        conditionAtHandover,
        notes,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Gagal melakukan serah terima aset.");
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
            <UserCheck size={20} className="text-primary" />
            <DialogTitle className="font-bold text-base text-foreground">
              Serah Terima Aset (Assignment)
            </DialogTitle>
          </View>
        </DialogHeader>

          {/* Form */}
          <ScrollView className="p-5 max-h-[75vh]" showsVerticalScrollIndicator={false}>
            {/* Info Singkat Aset */}
            <View className="bg-muted/40 p-3 rounded-xl border border-border/60 mb-4">
              <Text className="text-xs text-muted-foreground">Aset yang akan diserahkan:</Text>
              <Text className="text-sm font-bold text-foreground">
                {asset.assetCode} - {asset.name}
              </Text>
              <Text className="text-xs text-muted-foreground">
                Kategori: {asset.category?.name} · Nilai Buku: Rp{" "}
                {Number(asset.bookValue).toLocaleString("id-ID")}
              </Text>
            </View>

            {error ? (
              <View className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg mb-4">
                <Text className="text-xs text-destructive">{error}</Text>
              </View>
            ) : null}

            {/* Pilih Karyawan Penerima (PIC) */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-foreground mb-1.5">
                Karyawan Penerima (PIC) *
              </Text>
              <UserSelect
                userId={assignedUserId}
                value={
                  userOptions.find((u) => u.value === assignedUserId)?.label ||
                  (asset.assignedUser?.name ?? "")
                }
                onChange={(u) => {
                  if (u?.id) {
                    const uId = Number(u.id);
                    setAssignedUserId(uId);
                    if (u.roleLabel && !department) setDepartment(u.roleLabel);
                  } else {
                    setAssignedUserId(undefined);
                  }
                }}
                placeholder="Cari & pilih PIC karyawan..."
                triggerClassName="h-10 rounded-lg bg-card border-border/80"
              />
            </View>

            {/* Departemen */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-foreground mb-1.5">
                Departemen / Unit Kerja
              </Text>
              <Input
                value={department}
                onChangeText={setDepartment}
                placeholder="Contoh: IT Support / Finance / Operasional"
                className="h-10 rounded-lg bg-card border-border/80"
              />
            </View>

            {/* Lokasi Penempatan */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-foreground mb-1.5">
                Lokasi / Ruangan Penempatan
              </Text>
              <FaLocationSelect
                locationId={locationId}
                locations={locations}
                onChange={(loc) => {
                  setLocationId(loc?.id ?? undefined);
                }}
                className="h-10 rounded-lg bg-card border-border/80"
              />
            </View>

            {/* Tanggal Serah Terima & Kondisi */}
            <View className="flex-row gap-3 mb-4">
              <View className="flex-1">
                <Text className="text-xs font-semibold text-foreground mb-1.5">
                  Tanggal Serah Terima *
                </Text>
                <DatePicker
                  value={assignmentDate}
                  onChange={setAssignmentDate}
                  placeholder="Pilih tanggal serah terima"
                />
              </View>

              <View className="flex-1">
                <Text className="text-xs font-semibold text-foreground mb-1.5">
                  Kondisi Saat Serah Terima
                </Text>
                <SearchableSelect
                  value={CONDITION_OPTIONS.find((c) => c.value === conditionAtHandover)?.label || ""}
                  options={CONDITION_OPTIONS.map((c) => c.label)}
                  onChange={(val) => {
                    const match = CONDITION_OPTIONS.find((c) => c.label === val);
                    if (match) setConditionAtHandover(match.value);
                  }}
                  placeholder="Pilih Kondisi"
                  className="h-10 rounded-lg bg-card border-border/80"
                />
              </View>
            </View>

            {/* Catatan BAST */}
            <View className="mb-2">
              <Text className="text-xs font-semibold text-foreground mb-1.5">
                Catatan Berita Acara Serah Terima (BAST)
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Kelengkapan unit (charger, tas, mouse, buku panduan, kondisi fisik)..."
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
              {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text>Simpan Serah Terima</Text>}
            </Button>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
