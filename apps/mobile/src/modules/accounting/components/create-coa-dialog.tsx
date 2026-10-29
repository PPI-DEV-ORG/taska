import * as React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/taska/basics";
import { SearchableSelect } from "@/components/taska/dialogs";
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
  newAccParentCode?: string;
  setNewAccParentCode?: (v: string) => void;
  parentOptions?: CoaAccount[];
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
  newAccParentCode = "",
  setNewAccParentCode,
  parentOptions = [],
  onSave,
}: CreateCoaDialogProps) {
  const selectOptions = React.useMemo(() => {
    const formatted = parentOptions.map((p) => `[${p.code}] ${p.name}`);
    return ["- (Akun Induk / Tanpa Parent)", ...formatted];
  }, [parentOptions]);

  const selectedLabel = React.useMemo(() => {
    if (!newAccParentCode || newAccParentCode === "-") {
      return "- (Akun Induk / Tanpa Parent)";
    }
    const found = parentOptions.find((p) => p.code === newAccParentCode);
    return found ? `[${found.code}] ${found.name}` : `- (Akun Induk / Tanpa Parent)`;
  }, [newAccParentCode, parentOptions]);

  const handleSelectParent = (label: string) => {
    if (!setNewAccParentCode) return;
    if (!label || label.startsWith("-")) {
      setNewAccParentCode("");
      return;
    }
    const match = label.match(/^\[([^\]]+)\]/);
    const parentCode = match?.[1] || "";
    setNewAccParentCode(parentCode);

    const parentAcc = parentOptions.find((p) => p.code === parentCode);
    if (parentAcc) {
      setNewAccCategory(parentAcc.category);
      setNewAccNormalBalance(parentAcc.normalBalance);
      if (!newAccCode.trim() || newAccCode.startsWith(`${parentCode}.`)) {
        const childCount = parentOptions.filter((p) => p.parentCode === parentCode || p.code.startsWith(`${parentCode}.`)).length;
        const nextSuffix = String(childCount + 1).padStart(2, "0");
        setNewAccCode(`${parentCode}.${nextSuffix}`);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Akun Baru ke COA</DialogTitle>
        </DialogHeader>

          <FormField label="Kode Akun" required>
            <Input
              value={newAccCode}
              onChangeText={(txt) => {
                setNewAccCode(txt);
                if (txt.includes(".") && setNewAccParentCode) {
                  const prefix = txt.split(".")[0];
                  const found = parentOptions.find((p) => p.code === prefix);
                  if (found) {
                    setNewAccParentCode(found.code);
                    setNewAccCategory(found.category);
                    setNewAccNormalBalance(found.normalBalance);
                  }
                }
              }}
              placeholder="Contoh: 6201.05, 1106, 2105"
            />
          </FormField>

        <View className="gap-3 p-1">
          <FormField label="Parent Account (Akun Induk COA)">
            <SearchableSelect
              value={selectedLabel}
              onChange={handleSelectParent}
              options={selectOptions}
              placeholder="Pilih akun induk (Contoh: [6201] Gaji & Tunjangan)"
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

