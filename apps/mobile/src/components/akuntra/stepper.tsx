import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

/** Indikator "Langkah 2 dari 4" + judul langkah. */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <View className="mb-5 gap-2">
      <Text className="text-text-secondary text-sm">Langkah {current + 1} dari {steps.length}</Text>
      <View className="flex-row gap-1.5">
        {steps.map((s, i) => (
          <View key={s} className={cn("h-1.5 flex-1 rounded-full", i <= current ? "bg-primary" : "bg-border")} />
        ))}
      </View>
      <Text className="text-lg font-semibold">{steps[current]}</Text>
    </View>
  );
}
