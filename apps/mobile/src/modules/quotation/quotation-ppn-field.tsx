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
  dpp,
}: {
  mode: PpnMode;
  onChange: (mode: PpnMode) => void;
  ppn: number;
  totalAfterDisc: number;
  dpp?: number;
}) {
  const isInclude = mode === "include";
  const effectiveDpp = dpp !== undefined && dpp > 0
    ? dpp
    : isInclude
    ? Math.round(totalAfterDisc / 1.11)
    : totalAfterDisc;
  const effectivePpn = isInclude ? Math.max(0, totalAfterDisc - effectiveDpp) : ppn;

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
            {isInclude ? (
              <View className="gap-1">
                <View className="flex-row justify-between">
                  <Text className="text-[11px] text-muted-foreground">Harga Sebelum PPN (DPP):</Text>
                  <Text className="text-[11px] font-medium text-foreground">{rupiah(effectiveDpp)}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-[11px] text-muted-foreground">PPN (11% Termasuk):</Text>
                  <Text className="text-[11px] font-medium text-primary">{rupiah(effectivePpn)}</Text>
                </View>
                <View className="flex-row justify-between border-t border-border/40 pt-1 mt-0.5">
                  <Text className="text-xs font-semibold text-foreground">Total (Termasuk PPN):</Text>
                  <Text className="text-xs font-bold text-primary">{rupiah(totalAfterDisc)}</Text>
                </View>
              </View>
            ) : (
              <>
                <Text className="text-[11px] text-muted-foreground">
                  {mode === "none" ? "PPN: Tanpa PPN (Rp 0)" : `Preview PPN (11%): +${rupiah(ppn)}`}
                </Text>
                <Text className="text-xs font-semibold text-primary">
                  Preview TOTAL SETELAH DISKON & PPN: {rupiah(totalAfterDisc)}
                </Text>
              </>
            )}
          </View>
        </View>
      </FormField>
    </View>
  );
}

