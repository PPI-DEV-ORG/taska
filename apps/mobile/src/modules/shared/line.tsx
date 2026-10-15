import * as React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";

export function Line({ left, right, sub }: { left: string; right?: React.ReactNode; sub?: string }) {
  return (
    <View className="border-border flex-row items-center justify-between gap-3 border-b py-2.5">
      <View className="flex-1">
        <Text className="text-sm">{left}</Text>
        {sub ? <Text className="text-muted-foreground text-[13px]">{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}
