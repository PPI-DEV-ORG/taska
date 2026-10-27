import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { FormField } from "@/components/taska/basics";
import { rupiah } from "@/lib/format";
import { PPH_MODE_OPTIONS, type PphMode } from "@/modules/quotation/lib";

export function QuotationPphField({
  mode,
  onChange,
  pph,
}: {
  mode: PphMode;
  onChange: (mode: PphMode) => void;
  pph: number;
}) {
  const selectedOpt = PPH_MODE_OPTIONS.find((o) => o.id === mode) || PPH_MODE_OPTIONS[0];

  return (
    <View className="w-full sm:w-1/2 px-2 py-2">
      <FormField label="Skema PPh (Withholding Tax)">
        <View className="gap-2">
          <View className="flex-row flex-wrap gap-1.5">
            {PPH_MODE_OPTIONS.map((opt) => (
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
              {selectedOpt?.desc}
            </Text>
            {pph > 0 ? (
              <Text className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                Potongan PPh: -{rupiah(pph)} (Customer memotong & menerbitkan Bukti Potong)
              </Text>
            ) : (
              <Text className="text-[11px] text-muted-foreground">
                Tidak ada pemotongan PPh (Default)
              </Text>
            )}
          </View>
        </View>
      </FormField>
    </View>
  );
}

