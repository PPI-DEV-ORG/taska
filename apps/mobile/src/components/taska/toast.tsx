import { View } from "react-native";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { toneColor } from "@/tokens";

export type ToastItem = { id: number; msg: string; tone: "success" | "danger" | "warning" | "info" };

const ICON = { success: CircleCheck, danger: CircleAlert, warning: TriangleAlert, info: Info };

export function ToastHost({ items }: { items: ToastItem[] }) {
  return (
    <View
      pointerEvents="none"
      className="absolute bottom-24 left-0 right-0 items-center gap-2 px-4 md:bottom-8"
      style={{ zIndex: 1000 }}
    >
      {items.map((t) => {
        const Icon = ICON[t.tone];
        const color = toneColor[t.tone];
        return (
          <View
            key={t.id}
            className="bg-popover border-border max-w-md flex-row items-center gap-3 rounded-xl border px-4 py-3"
          >
            <Icon size={18} color={color} />
            <Text className="flex-shrink text-sm">{t.msg}</Text>
          </View>
        );
      })}
    </View>
  );
}
