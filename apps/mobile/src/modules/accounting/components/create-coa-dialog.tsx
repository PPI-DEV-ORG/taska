import * as React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/taska/basics";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CoaAccount } from "@/lib/accounting";
import { COA_CATEGORIES } from "../types";

interface CreateCoaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newAccCode: string;
  setNewAccCode: (v: string) => void;
  newAccName: string;
  setNewAccName: (v: string) => void;
  newAccCategory: CoaAccount["category"];
  setNewAccCategory: (v: CoaAccount["category"]) => void;
  newAccNormalBalance: "DEBIT" | "KREDIT";
  setNewAccNormalBalance: (v: "DEBIT" | "KREDIT") => void;
  onSave: () => void;
}

export function CreateCoaDialog({
  open,
  onOpenChange,
  newAccCode,
  setNewAccCode,
  newAccName,
  setNewAccName,
  newAccCategory,
  setNewAccCategory,
  newAccNormalBalance,
  setNewAccNormalBalance,
  onSave,
}: CreateCoaDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Akun Baru ke COA</DialogTitle>
        </DialogHeader>

        <View className="gap-3 p-1">
          <FormField label="Kode Akun" required>
            <Input
              value={newAccCode}
              onChangeText={setNewAccCode}
              placeholder="Contoh: 1106, 2105, 6102"
              keyboardType="numeric"
            />
          </FormField>

          <FormField label="Nama Akun" required>
            <Input
              value={newAccName}
              onChangeText={setNewAccName}
              placeholder="Contoh: Bank BCA Operasional, Beban Pemeliharaan Server"
            />
          </FormField>

          <FormField label="Kategori Pos" required>
            <View className="flex-row flex-wrap gap-1.5">
              {COA_CATEGORIES.map((cat) => (
                <Button
                  key={cat}
                  size="sm"
                  variant={newAccCategory === cat ? "default" : "outline"}
                  onPress={() => {
                    setNewAccCategory(cat);
                    if (cat === "Aset Lancar" || cat === "Beban Pokok (HPP)" || cat === "Beban Operasional") {
                      setNewAccNormalBalance("DEBIT");
                    } else {
                      setNewAccNormalBalance("KREDIT");
                    }
                  }}
                  className="h-8 px-2.5"
                >
                  <Text className="text-xs">{cat}</Text>
                </Button>
              ))}
            </View>
          </FormField>

          <FormField label="Saldo Normal" required>
            <View className="flex-row gap-2">
              {(["DEBIT", "KREDIT"] as const).map((bal) => (
                <Button
                  key={bal}
                  size="sm"
                  variant={newAccNormalBalance === bal ? "default" : "outline"}
                  onPress={() => setNewAccNormalBalance(bal)}
                  className="flex-1 h-8"
                >
                  <Text className="text-xs">{bal}</Text>
                </Button>
              ))}
            </View>
          </FormField>
        </View>

        <DialogFooter className="flex-row justify-between gap-2">
          <Button variant="outline" onPress={() => onOpenChange(false)}>
            <Text>Batal</Text>
          </Button>
          <Button onPress={onSave}>
            <Text>Simpan Akun</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

