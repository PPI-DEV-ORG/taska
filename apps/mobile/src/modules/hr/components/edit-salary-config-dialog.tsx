import React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { FormField } from "@/components/taska/basics";
import { SearchableSelect, formatThousands } from "@/components/taska/dialogs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface EditSalaryConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: any;
  basicSalary: string;
  setBasicSalary: (v: string) => void;
  allowance: string;
  setAllowance: (v: string) => void;
  ptkp: string;
  setPtkp: (v: string) => void;
  hasNpwpLabel: string;
  setHasNpwpLabel: (v: string) => void;
  customRate: string;
  setCustomRate: (v: string) => void;
  onSave: () => void;
}

export function EditSalaryConfigDialog({
  open,
  onOpenChange,
  target,
  basicSalary,
  setBasicSalary,
  allowance,
  setAllowance,
  ptkp,
  setPtkp,
  hasNpwpLabel,
  setHasNpwpLabel,
  customRate,
  setCustomRate,
  onSave,
}: EditSalaryConfigDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ubah Setting Gaji: {target?.user?.name}</DialogTitle>
        </DialogHeader>

        <View className="gap-3.5 py-2">
          <View className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Gaji Pokok (Rp)" required>
              <Input
                value={basicSalary ? formatThousands(basicSalary) : ""}
                onChangeText={(v) => setBasicSalary(formatThousands(v))}
                keyboardType="numeric"
                placeholder="0"
              />
            </FormField>

            <FormField label="Tunjangan Tetap (Rp)" required>
              <Input
                value={allowance ? formatThousands(allowance) : ""}
                onChangeText={(v) => setAllowance(formatThousands(v))}
                keyboardType="numeric"
                placeholder="0"
              />
            </FormField>
          </View>

          <View className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Status PTKP" required>
              <SearchableSelect
                value={ptkp}
                onChange={(val) => setPtkp(val)}
                options={["TK/0", "TK/1", "K/0", "K/1", "K/2"]}
                placeholder="Pilih status PTKP..."
              />
            </FormField>

            <FormField label="Kepemilikan NPWP" required>
              <SearchableSelect
                value={hasNpwpLabel}
                onChange={(val) => setHasNpwpLabel(val)}
                options={["Punya NPWP", "Tidak Ada (+20% Tarif)"]}
                placeholder="Pilih status NPWP..."
              />
            </FormField>
          </View>

          <FormField
            label="Tarif PPh 21 Khusus (%)"
            hint="Kosongkan atau biarkan 0 untuk otomatis menggunakan skema tarif TER"
          >
            <Input
              value={customRate}
              onChangeText={setCustomRate}
              placeholder="Misal: 5 (opsional)"
              keyboardType="numeric"
            />
          </FormField>
        </View>

        <DialogFooter className="flex-row justify-end gap-2 pt-2">
          <Button variant="outline" onPress={() => onOpenChange(false)}>
            <Text className="text-xs font-semibold">Batal</Text>
          </Button>
          <Button onPress={onSave}>
            <Text className="text-xs font-bold text-white">Simpan Perubahan</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

