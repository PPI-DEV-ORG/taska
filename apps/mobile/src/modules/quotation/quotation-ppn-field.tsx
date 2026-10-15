import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { FormField } from "@/components/taska/basics";
import { rupiah } from "@/lib/format";
import { PPN_MODE_OPTIONS, type PpnMode } from "@/modules/quotation/lib";

export function QuotationPpnField({
  mode,
  onChange,
  ppn,
  totalAfterDisc,
}: {
  mode: PpnMode;
  onChange: (mode: PpnMode) => void;
  ppn: number;
  totalAfterDisc: number;
}) {
  return (
    <View className="w-full sm:w-1/2 px-2 py-2">
      <FormField label="Tipe / Skema PPN">
        <View className="gap-2">
          <View className="flex-row flex-wrap gap-1.5">
            {PPN_MODE_OPTIONS.map((opt) => (
              <Button
                key={opt.id}
                size="sm"
                variant={mode === opt.id ? "default" : "outline"}
                onPress={() => onChange(opt.id)}
                className="h-9 px-3"
              >
                <Text className="text-xs">{opt.label}</Text>
              </Button>
            ))}
          </View>
          <View className="bg-card border-border/50 gap-1 rounded-lg border p-2.5">
            <Text className="text-[11px] text-muted-foreground">
              {mode === "include"
                ? "PPN: Sudah Termasuk dalam Nilai"
                : mode === "none"
                ? "PPN: Tanpa PPN (Rp 0)"
                : `Preview PPN (11%): ${rupiah(ppn)}`}
            </Text>
            <Text className="text-xs font-semibold text-primary">
              Preview TOTAL SETELAH DISKON & PPN: {rupiah(totalAfterDisc)}
            </Text>
          </View>
        </View>
      </FormField>
    </View>
  );
}

