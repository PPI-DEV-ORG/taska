import { View } from "react-native";
import { Text } from "@/components/ui/text";

/** Judul langkah bernomor agar alur form mudah diikuti: sumber → rincian → pembayaran. */
export function StepTitle({
  n,
  title,
  hint,
}: {
  n: number;
  title: string;
  hint?: string;
}) {
  return (
    <View className="flex-row items-start gap-2 mb-2 mt-1">
      <View className="w-6 h-6 rounded-full bg-primary items-center justify-center">
        <Text className="text-[11px] font-bold text-primary-foreground">
          {n}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="text-sm font-bold text-foreground">{title}</Text>
        {hint ? (
          <Text className="text-[11px] text-muted-foreground">{hint}</Text>
        ) : null}
      </View>
    </View>
  );
}
