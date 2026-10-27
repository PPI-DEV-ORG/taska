import React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { FormField } from "@/components/taska/basics";
import { SearchableSelect, DatePicker } from "@/components/taska/dialogs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface ManualAttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manualUserLabel: string;
  setManualUserLabel: (v: string) => void;
  setManualUserId: (v: string) => void;
  userOptions: any[];
  employeeSelectOptions: string[];
  manualDate: string;
  setManualDate: (v: string) => void;
  manualStatus: string;
  setManualStatus: (v: any) => void;
  manualOvertime: string;
  setManualOvertime: (v: string) => void;
  manualNote: string;
  setManualNote: (v: string) => void;
  onSave: () => void;
}

export function ManualAttendanceDialog({
  open,
  onOpenChange,
  manualUserLabel,
  setManualUserLabel,
  setManualUserId,
  userOptions,
  employeeSelectOptions,
  manualDate,
  setManualDate,
  manualStatus,
  setManualStatus,
  manualOvertime,
  setManualOvertime,
  manualNote,
  setManualNote,
  onSave,
}: ManualAttendanceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Catat Presensi Karyawan</DialogTitle>
        </DialogHeader>

        <View className="gap-3.5 py-2">
          {/* Dropdown Select Karyawan */}
          <FormField label="Pilih Karyawan" required hint="Pilih nama karyawan dari daftar staf">
            <SearchableSelect
              value={manualUserLabel}
              onChange={(val) => {
                setManualUserLabel(val);
                const matched = userOptions.find(
                  (u) => `${u.id} - ${u.name} (${u.role || u.email || "Karyawan"})` === val
                );
                if (matched) {
                  setManualUserId(String(matched.id));
                } else {
                  const id = val.split(" - ")[0] ?? "";
                  setManualUserId(id);
                }
              }}
              options={employeeSelectOptions}
              placeholder="Cari & pilih karyawan..."
            />
          </FormField>

          <View className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Tanggal Presensi" required hint="Pilih tanggal presensi yang dicatat">
              <DatePicker
                value={manualDate}
                onChange={setManualDate}
                placeholder="Pilih tanggal presensi"
              />
            </FormField>

            <FormField label="Status Presensi" required>
              <SearchableSelect
                value={manualStatus}
                onChange={(val) => setManualStatus(val as any)}
                options={["HADIR", "IZIN", "SAKIT", "CUTI", "ALPHA"]}
                placeholder="Pilih status presensi..."
              />
            </FormField>
          </View>

          <FormField label="Jam Lembur Tambahan (Jam)" hint="Isi 0 jika tidak ada jam lembur">
            <Input
              value={manualOvertime}
              onChangeText={setManualOvertime}
              keyboardType="numeric"
              placeholder="0"
            />
          </FormField>

          <FormField label="Keterangan / Alasan" hint="Catatan surat izin, keterangan dokter, atau dinas">
            <Input
              value={manualNote}
              onChangeText={setManualNote}
              placeholder="Contoh: Izin keperluan keluarga / surat dokter..."
            />
          </FormField>
        </View>

        <DialogFooter className="flex-row justify-end gap-2 pt-2">
          <Button variant="outline" onPress={() => onOpenChange(false)}>
            <Text className="text-xs font-semibold">Batal</Text>
          </Button>
          <Button onPress={onSave}>
            <Text className="text-xs font-bold text-white">Simpan Presensi</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

