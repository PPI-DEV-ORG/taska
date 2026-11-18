import * as React from "react";
import { View, ScrollView, Platform, Switch, Pressable } from "react-native";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar, Bell, ShieldAlert } from "lucide-react-native";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/taska/dialogs";
import { UserSelect } from "@/components/taska/document-selects/user-select";
import { colors } from "@/tokens";
import type { MaintPlan, MaintLookups } from "../types";

export function MaintenancePlanDialog(props: {
  visible: boolean;
  onClose: () => void;
  initialData?: MaintPlan | null;
  lookups: MaintLookups;
  onSubmit: (payload: any) => Promise<void>;
}) {
  if (!props.visible) return null;
  return <PlanFormContent key={props.initialData?.id ?? "new"} {...props} />;
}

function PlanFormContent({
  onClose,
  initialData,
  lookups,
  onSubmit,
}: {
  onClose: () => void;
  initialData?: MaintPlan | null;
  lookups: MaintLookups;
  onSubmit: (payload: any) => Promise<void>;
}) {
  const [title, setTitle] = React.useState(initialData?.title || "");
  const [categoryId, setCategoryId] = React.useState<number | "">(initialData?.categoryId || lookups.categories[0]?.id || "");
  const [method, setMethod] = React.useState(initialData?.method || "CALENDAR_BASED");
  const [intervalValue, setIntervalValue] = React.useState(String(initialData?.intervalValue || 1));
  const [intervalUnit, setIntervalUnit] = React.useState(initialData?.intervalUnit || "MONTHS");
  const [checklistId, setChecklistId] = React.useState<number | "">(initialData?.checklistId || "");
  const [picUserId, setPicUserId] = React.useState<number | "">(initialData?.picUserId || "");
  const [autoGenerate, setAutoGenerate] = React.useState(initialData?.autoGenerate !== undefined ? initialData.autoGenerate : true);
  const [generationHorizon, setGenerationHorizon] = React.useState(initialData?.generationHorizon || "NEXT_CYCLE");
  const [reminderLeadDays, setReminderLeadDays] = React.useState(initialData?.reminderLeadDays || "14,7,3,1");
  const [description, setDescription] = React.useState(initialData?.description || "");
  const [selectedAssetIds, setSelectedAssetIds] = React.useState<number[]>(initialData?.assets?.map((a) => a.assetId) || []);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const toggleAsset = (aId: number) => {
    if (selectedAssetIds.includes(aId)) {
      setSelectedAssetIds(selectedAssetIds.filter((id) => id !== aId));
    } else {
      setSelectedAssetIds([...selectedAssetIds, aId]);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Judul rencana maintenance harus diisi");
      return;
    }
    if (!categoryId) {
      setError("Pilih kategori maintenance");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onSubmit({
        title: title.trim(),
        categoryId: Number(categoryId),
        method,
        intervalValue: Number(intervalValue) || 1,
        intervalUnit,
        checklistId: checklistId ? Number(checklistId) : undefined,
        picUserId: picUserId ? Number(picUserId) : undefined,
        autoGenerate,
        generationHorizon,
        reminderLeadDays,
        description: description.trim() || undefined,
        assetIds: selectedAssetIds,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Gagal menyimpan rencana maintenance");
    } finally {
      setSaving(false);
    }
  };

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
              <Calendar size={18} color={colors.primary} />
            </View>
            <View>
              <DialogTitle>
                {initialData ? `Edit Rencana #${initialData.planNumber}` : "Buat Rencana Servis Berkala (Preventive)"}
              </DialogTitle>
              <Text className="text-xs text-muted-foreground">
                Konfigurasi jadwal servis otomatis & reminder jatuh tempo aset
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

            {/* Judul & Kategori */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6 }}>
                Judul Rencana Servis <Text style={{ color: "#dc2626" }}>*</Text>
              </Text>
              <Input
                placeholder="Contoh: Servis Berkala Laptop & Komputer Bulanan"
                value={title}
                onChangeText={setTitle}
              />
            </View>

            <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
              <View style={{ flex: 1, minWidth: 200 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6 }}>
                  Kategori Maintenance <Text style={{ color: "#dc2626" }}>*</Text>
                </Text>
                <SearchableSelect
                  placeholder="-- Pilih Kategori --"
                  value={
                    categoryId
                      ? lookups.categories.find((c) => c.id === Number(categoryId))
                        ? `${categoryId} - ${lookups.categories.find((c) => c.id === Number(categoryId))?.name} (${lookups.categories.find((c) => c.id === Number(categoryId))?.code})`
                        : String(categoryId)
                      : ""
                  }
                  options={lookups.categories.map((c) => `${c.id} - ${c.name} (${c.code})`)}
                  onChange={(val) => setCategoryId(val ? Number(val.split(" - ")[0]) : "")}
                  clearable
                />
              </View>

              <View style={{ flex: 1, minWidth: 200 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6 }}>
                  Metode Perawatan
                </Text>
                <SearchableSelect
                  value={
                    method === "USAGE_BASED"
                      ? "USAGE_BASED - Berdasarkan Pemakaian (KM / Jam)"
                      : method === "CONDITION_BASED"
                      ? "CONDITION_BASED - Berdasarkan Hasil Inspeksi"
                      : method === "MANUAL"
                      ? "MANUAL - Manual Sesuai Kebutuhan"
                      : "CALENDAR_BASED - Berdasarkan Tanggal / Kalender"
                  }
                  options={[
                    "CALENDAR_BASED - Berdasarkan Tanggal / Kalender",
                    "USAGE_BASED - Berdasarkan Pemakaian (KM / Jam)",
                    "CONDITION_BASED - Berdasarkan Hasil Inspeksi",
                    "MANUAL - Manual Sesuai Kebutuhan",
                  ]}
                  onChange={(val) => setMethod(val.split(" - ")[0] ?? "CALENDAR_BASED")}
                />
              </View>
            </View>

            {/* Interval Nilai & Satuan */}
            <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
              <View style={{ flex: 1, minWidth: 140 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6 }}>
                  Interval Frekuensi
                </Text>
                <Input
                  value={intervalValue}
                  onChangeText={setIntervalValue}
                  keyboardType="numeric"
                  placeholder="1"
                />
              </View>

              <View style={{ flex: 2, minWidth: 200 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6 }}>
                  Satuan Interval
                </Text>
                <SearchableSelect
                  value={
                    intervalUnit === "WEEKS"
                      ? "WEEKS - Minggu (Weeks)"
                      : intervalUnit === "DAYS"
                      ? "DAYS - Hari (Days)"
                      : intervalUnit === "YEARS"
                      ? "YEARS - Tahun (Years)"
                      : intervalUnit === "KM"
                      ? "KM - Kilometer (KM)"
                      : intervalUnit === "HOURS"
                      ? "HOURS - Jam Operasi (Hours)"
                      : "MONTHS - Bulan (Months)"
                  }
                  options={[
                    "MONTHS - Bulan (Months)",
                    "WEEKS - Minggu (Weeks)",
                    "DAYS - Hari (Days)",
                    "YEARS - Tahun (Years)",
                    "KM - Kilometer (KM)",
                    "HOURS - Jam Operasi (Hours)",
                  ]}
                  onChange={(val) => setIntervalUnit(val.split(" - ")[0] ?? "MONTHS")}
                />
              </View>
            </View>

            {/* Checklist Template & PIC */}
            <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
              <View style={{ flex: 1, minWidth: 200 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6 }}>
                  Template Checklist SOP
                </Text>
                <SearchableSelect
                  placeholder="-- Pilih Template Checklist (Opsional) --"
                  value={
                    checklistId
                      ? lookups.checklists.find((c) => c.id === Number(checklistId))
                        ? `${checklistId} - ${lookups.checklists.find((c) => c.id === Number(checklistId))?.name}`
                        : String(checklistId)
                      : ""
                  }
                  options={lookups.checklists.map((c) => `${c.id} - ${c.name} (${c.items?.length || 0} item)`)}
                  onChange={(val) => setChecklistId(val ? Number(val.split(" - ")[0]) : "")}
                  clearable
                />
              </View>

              <View style={{ flex: 1, minWidth: 200 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6 }}>
                  PIC / Teknisi Standar
                </Text>
                <UserSelect
                  userId={picUserId}
                  onChange={(u) => setPicUserId(u ? Number(u.id) : "")}
                  placeholder="Cari & pilih PIC teknisi..."
                />
              </View>
            </View>

            {/* Konfigurasi Auto-Generate & Horizon (User Feedback) */}
            <View
              style={{
                backgroundColor: "#f5f5f4",
                padding: 14,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "#e5e7eb",
                gap: 12,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#0f172a" }}>
                    Pembuatan Jadwal Servis Otomatis
                  </Text>
                  <Text style={{ fontSize: 11, color: "#64748b" }}>
                    Aktifkan jika ingin sistem men-generate jadwal servis otomatis ke kalender
                  </Text>
                </View>
                <Switch
                  value={autoGenerate}
                  onValueChange={setAutoGenerate}
                  trackColor={{ false: "#e5e7eb", true: colors.primary }}
                />
              </View>

              {autoGenerate && (
                <View style={{ borderTopWidth: 1, borderColor: "#e5e7eb", paddingTop: 10 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#334155", marginBottom: 6 }}>
                    Berapa Lama / Jangka Waktu Pembuatan Jadwal (Horizon)
                  </Text>
                  <SearchableSelect
                    value={
                      generationHorizon === "3_MONTHS"
                        ? "3_MONTHS - 3 Bulan ke Depan"
                        : generationHorizon === "6_MONTHS"
                        ? "6_MONTHS - 6 Bulan ke Depan"
                        : generationHorizon === "1_YEAR"
                        ? "1_YEAR - 1 Tahun Penuh ke Depan"
                        : "NEXT_CYCLE - 1 Siklus ke Depan (Next Cycle Sahaja)"
                    }
                    options={[
                      "NEXT_CYCLE - 1 Siklus ke Depan (Next Cycle Sahaja)",
                      "3_MONTHS - 3 Bulan ke Depan",
                      "6_MONTHS - 6 Bulan ke Depan",
                      "1_YEAR - 1 Tahun Penuh ke Depan",
                    ]}
                    onChange={(val) => setGenerationHorizon(val.split(" - ")[0] ?? "NEXT_CYCLE")}
                  />
                </View>
              )}
            </View>

            {/* Konfigurasi Notifikasi Pengingat (User Feedback) */}
            <View
              style={{
                backgroundColor: "#f5f5f4",
                padding: 14,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "#e5e7eb",
                gap: 8,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Bell size={16} color={colors.warning} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#0f172a" }}>
                  Pilihan Waktu Pengingat Sebelum Jatuh Tempo
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: "#64748b" }}>
                Kapan saja pengingat ingin dikirim sebelum jadwal servis tiba (Format multi-hari pisahkan koma: misal 14,7,3,1,0 untuk H-14, H-7, H-3, H-1, dan Hari H)
              </Text>
              <Input
                placeholder="14,7,3,1"
                value={reminderLeadDays}
                onChangeText={setReminderLeadDays}
              />
            </View>

            {/* Target Multi Aset */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155" }}>
                Pilih Aset yang Didaftarkan ({selectedAssetIds.length} Aset Dipilih)
              </Text>
              <View
                style={{
                  maxHeight: 180,
                  borderWidth: 1,
                  borderColor: "#e5e7eb",
                  borderRadius: 8,
                  padding: 8,
                }}
              >
                <ScrollView nestedScrollEnabled>
                  {lookups.assets.map((a) => {
                    const isSelected = selectedAssetIds.includes(a.id);
                    return (
                      <Pressable
                        key={a.id}
                        onPress={() => toggleAsset(a.id)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingVertical: 6,
                          paddingHorizontal: 8,
                          borderRadius: 6,
                          backgroundColor: isSelected ? `${colors.primary}18` : "transparent",
                          gap: 8,
                        }}
                      >
                        <View
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 4,
                            borderWidth: 1,
                            borderColor: isSelected ? colors.primary : "#94a3b8",
                            backgroundColor: isSelected ? colors.primary : "#ffffff",
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          {isSelected && <Text style={{ color: "#ffffff", fontSize: 10, fontWeight: "800" }}>✓</Text>}
                        </View>
                        <Text style={{ fontSize: 12, color: "#0f172a", flex: 1 }}>
                          {a.assetCode} - {a.name} ({a.department || a.location?.name || "General"})
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            {/* Description */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6 }}>
                Keterangan Tambahan
              </Text>
              <Textarea
                placeholder="Catatan ruang lingkup atau petunjuk umum..."
                value={description}
                onChangeText={setDescription}
                numberOfLines={2}
              />
            </View>
        </ScrollView>

        {/* Footer */}
        <DialogFooter className="border-t border-border/70 px-6 py-3">
          <Button variant="outline" onPress={onClose} disabled={saving}>
            <Text>Batal</Text>
          </Button>
          <Button onPress={handleSave} disabled={saving}>
            <Text>{saving ? "Menyimpan..." : initialData ? "Perbarui Rencana" : "Simpan Rencana Servis"}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
