import * as React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";

export function Line({ left, right, sub }: { left: string; right?: React.ReactNode; sub?: string }) {
  return (
    <View className="border-border/70 flex-row flex-wrap items-center justify-between gap-2 border-b py-2.5 last:border-b-0">
      <View className="flex-1 min-w-[160px]">
        <Text className="text-sm font-medium text-foreground">{left}</Text>
        {sub ? <Text className="text-muted-foreground text-xs mt-0.5 leading-relaxed">{sub}</Text> : null}
      </View>
      {right ? <View className="shrink-0 self-end sm:self-auto">{right}</View> : null}
    </View>
  );
}
