import { Pressable, View } from "react-native";
import {
  Bell,
  CircleAlert,
  CircleCheck,
  ClipboardCheck,
  FileText,
  Info,
  Package,
  TriangleAlert,
  Truck,
  UserPlus,
  X,
} from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { colors, toneColor } from "@/tokens";
import type { Notif } from "@/constants/modules";

export type ToastItem = { id: number; msg: string; tone: "success" | "danger" | "warning" | "info" };

export type NotifPopupItem = {
  id: string;
  notifId: string;
  jenis: Notif["jenis"];
  title: string;
  text: string;
  href?: string;
};

const ICON = { success: CircleCheck, danger: CircleAlert, warning: TriangleAlert, info: Info };

const NOTIF_ICON: Record<Notif["jenis"], any> = {
  approval: ClipboardCheck,
  stok: Package,
  pengiriman: Truck,
  lead: UserPlus,
  tugas: Bell,
  surat: FileText,
};

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

export function NotifPopupHost({
  items,
  onClose,
  onSelect,
}: {
  items: NotifPopupItem[];
  onClose: (id: string) => void;
  onSelect?: (item: NotifPopupItem) => void;
}) {
  if (!items.length) return null;
  return (
    <View
      pointerEvents="box-none"
      className="absolute right-4 top-4 w-80 max-w-[92vw] gap-2.5 md:w-96"
      style={{ zIndex: 9999 }}
    >
      {items.map((item) => {
        const Icon = NOTIF_ICON[item.jenis] ?? Bell;
        return (
          <View
            key={item.id}
            className="bg-card border-border overflow-hidden rounded-xl border shadow-lg"
            style={{
              borderLeftWidth: 4,
              borderLeftColor: colors.accent,
            }}
          >
            <View className="flex-row items-start gap-3 p-3.5">
              <Pressable
                onPress={() => onSelect?.(item)}
                className="flex-1 flex-row items-start gap-3 active:opacity-80"
              >
                <View
                  className="mt-0.5 h-8 w-8 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${colors.accent}22` }}
                >
                  <Icon size={16} color={colors.accent} />
                </View>
                <View className="flex-1 pr-1">
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className="text-xs font-bold tracking-wide" style={{ color: colors.accent }}>
                      {item.title}
                    </Text>
                    <Text className="text-muted-foreground text-[10px]">Baru saja</Text>
                  </View>
                  <Text className="text-foreground mt-1 text-xs leading-4" numberOfLines={3}>
                    {item.text}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() => onClose(item.id)}
                hitSlop={8}
                accessibilityLabel="Tutup notifikasi"
                className="hover:bg-secondary/80 -mr-1 -mt-1 h-6 w-6 items-center justify-center rounded-md active:opacity-70"
              >
                <X size={14} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}
