import * as React from "react";
import { View, ScrollView, Pressable } from "react-native";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/taska/basics";
import { SearchableSelect, DatePicker, formatThousands } from "@/components/taska/dialogs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react-native";
import { colors } from "@/tokens";
import { rupiah } from "@/lib/format";
import { ManualJournalLine, CoaAccount } from "@/lib/accounting";

interface ManualJournalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mjDate: string;
  setMjDate: (v: string) => void;
  mjRef: string;
  setMjRef: (v: string) => void;
  mjDesc: string;
  setMjDesc: (v: string) => void;
  mjLines: ManualJournalLine[];
  setMjLines: React.Dispatch<React.SetStateAction<ManualJournalLine[]>>;
  allAccountsMap: Record<string, CoaAccount>;
  onSave: () => void;
}

export function ManualJournalDialog({
  open,
  onOpenChange,
  mjDate,
  setMjDate,
  mjRef,
  setMjRef,
  mjDesc,
  setMjDesc,
  mjLines,
  setMjLines,
  allAccountsMap,
  onSave,
}: ManualJournalDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Input Ayat Jurnal Manual (Manual Journal Entry)</DialogTitle>
        </DialogHeader>

        <ScrollView className="max-h-[60vh] gap-3 p-1">
          <View className="flex-row gap-2">
            <View className="flex-1">
              <FormField label="Tanggal Jurnal" required>
                <DatePicker value={mjDate} onChange={setMjDate} />
              </FormField>
            </View>
            <View className="flex-1">
              <FormField label="Nomor Referensi Dokumen (Opsional)">
                <Input value={mjRef} onChangeText={setMjRef} placeholder="Contoh: BKK-01/X/2026 atau BM-08" />
              </FormField>
            </View>
          </View>

          <FormField label="Uraian / Keterangan Transaksi" required>
            <Textarea
              value={mjDesc}
              onChangeText={setMjDesc}
              placeholder="Contoh: Setoran modal awal pemegang saham, Biaya administrasi bank, atau Penyesuaian persediaan..."
            />
          </FormField>

          {/* Dynamic Lines */}
          <View className="gap-2 border-t border-border pt-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-bold text-foreground">Rincian Baris Debit & Kredit</Text>
              <Button
                size="sm"
                variant="outline"
                onPress={() =>
                  setMjLines([
                    ...mjLines,
                    { kodeAkun: "1101", keterangan: "", debit: 0, kredit: 0 },
                  ])
                }
                className="h-7 px-2.5 gap-1"
              >
                <Plus size={12} color={colors.primary} />
                <Text className="text-[11px] font-semibold text-primary">+ Tambah Baris</Text>
              </Button>
            </View>

            {mjLines.map((line, idx) => (
              <View key={idx} className="bg-panel border-border/70 rounded-lg border p-2.5 gap-2">
                <View className="flex-row items-center justify-between">
                  <Text className="text-[11px] font-bold text-muted-foreground">Baris #{idx + 1}</Text>
                  {mjLines.length > 2 ? (
                    <Pressable
                      onPress={() => setMjLines(mjLines.filter((_, i) => i !== idx))}
                      hitSlop={8}
                    >
                      <Trash2 size={13} color={colors.danger} />
                    </Pressable>
                  ) : null}
                </View>

                <SearchableSelect
                  value={`[${line.kodeAkun}] ${allAccountsMap[line.kodeAkun]?.name || line.kodeAkun}`}
                  options={Object.values(allAccountsMap).map((a) => `[${a.code}] ${a.name}`)}
                  onChange={(val) => {
                    const m = val.match(/\[(\w+)\]/);
                    if (m && m[1]) {
                      const next = [...mjLines];
                      const nextLine = next[idx];
                      if (!nextLine) return;
                      nextLine.kodeAkun = m[1];
                      setMjLines(next);
                    }
                  }}
                  placeholder="Pilih Akun..."
                />

                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <Text className="text-[10px] text-muted-foreground font-semibold">Debit (Rp)</Text>
                    <Input
                      value={line.debit ? formatThousands(line.debit) : ""}
                      onChangeText={(v) => {
                        const num = Number(v.replace(/\D/g, "")) || 0;
                        const next = [...mjLines];
                        const nextLine = next[idx];
                        if (!nextLine) return;
                        nextLine.debit = num;
                        if (num > 0) nextLine.kredit = 0;
                        setMjLines(next);
                      }}
                      keyboardType="numeric"
                      placeholder="0"
                      className="h-8 text-xs font-mono"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] text-muted-foreground font-semibold">Kredit (Rp)</Text>
                    <Input
                      value={line.kredit ? formatThousands(line.kredit) : ""}
                      onChangeText={(v) => {
                        const num = Number(v.replace(/\D/g, "")) || 0;
                        const next = [...mjLines];
                        const nextLine = next[idx];
                        if (!nextLine) return;
                        nextLine.kredit = num;
                        if (num > 0) nextLine.debit = 0;
                        setMjLines(next);
                      }}
                      keyboardType="numeric"
                      placeholder="0"
                      className="h-8 text-xs font-mono"
                    />
                  </View>
                </View>
              </View>
            ))}

            {/* Total Debit vs Kredit Validation Box */}
            {(() => {
              const totD = mjLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
              const totK = mjLines.reduce((s, l) => s + (Number(l.kredit) || 0), 0);
              const isBalanced = totD > 0 && totD === totK;
              return (
                <View
                  className={`rounded-lg border p-3 flex-row justify-between items-center ${
                    isBalanced
                      ? "bg-success/10 border-success/30 text-success"
                      : "bg-danger/10 border-danger/30 text-danger"
                  }`}
                >
                  <View>
                    <Text className={`text-xs font-bold ${isBalanced ? "text-success" : "text-danger"}`}>
                      {isBalanced ? "Status: SEIMBANG (DEBIT = KREDIT)" : "Status: BELUM SEIMBANG"}
                    </Text>
                    <Text className="text-[11px] text-muted-foreground">
                      Total Debit: {rupiah(totD)} · Total Kredit: {rupiah(totK)}
                    </Text>
                  </View>
                  <Text className={`text-sm font-black font-mono ${isBalanced ? "text-success" : "text-danger"}`}>
                    {rupiah(Math.abs(totD - totK))} {isBalanced ? "✓" : "Selisih"}
                  </Text>
                </View>
              );
            })()}
          </View>
        </ScrollView>

        <DialogFooter className="flex-row justify-between gap-2">
          <Button variant="outline" onPress={() => onOpenChange(false)}>
            <Text>Batal</Text>
          </Button>
          <Button onPress={onSave}>
            <Text>Simpan Jurnal Manual</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

