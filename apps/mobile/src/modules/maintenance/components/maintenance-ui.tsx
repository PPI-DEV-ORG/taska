import * as React from "react";
import { View, Pressable } from "react-native";
import { Text } from "@/components/ui/text";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";
import {
  WO_STATUS_CONFIG,
  PRIORITY_CONFIG,
  SCHEDULE_STATUS_CONFIG,
  ASSET_CONDITION_CONFIG,
} from "../maintenance-utils";

const DEFAULT_WO_STATUS = { label: "Draft", bg: "#f5f5f4", text: "#57534e" };
const DEFAULT_PRIORITY = { label: "Medium", bg: "#ffedd5", text: "#ea580c" };
const DEFAULT_SCHEDULE_STATUS = { label: "Dijadwalkan", bg: "#ffedd5", text: "#ea580c" };
const DEFAULT_ASSET_CONDITION = { label: "Baik (Good)", bg: "#dcfce7", text: "#16a34a" };

export function WorkOrderStatusBadge({ status }: { status?: string | null }) {
  const s = (status || "DRAFT").toUpperCase();
  const cfg = WO_STATUS_CONFIG[s] ?? DEFAULT_WO_STATUS;
  return (
    <View
      className="self-start rounded-full border px-2.5 py-0.5"
      style={{ backgroundColor: `${cfg.bg}`, borderColor: `${cfg.text}33` }}
    >
      <Text className="text-[11px] font-semibold" style={{ color: cfg.text }}>
        {cfg.label}
      </Text>
    </View>
  );
}

export function PriorityBadge({ priority }: { priority?: string | null }) {
  const p = (priority || "MEDIUM").toUpperCase();
  const cfg = PRIORITY_CONFIG[p] ?? DEFAULT_PRIORITY;
  return (
    <View
      className="self-start rounded-full border px-2.5 py-0.5"
      style={{ backgroundColor: `${cfg.bg}`, borderColor: `${cfg.text}33` }}
    >
      <Text className="text-[11px] font-semibold" style={{ color: cfg.text }}>
        {cfg.label}
      </Text>
    </View>
  );
}

export function ScheduleStatusBadge({ status }: { status?: string | null }) {
  const s = (status || "SCHEDULED").toUpperCase();
  const cfg = SCHEDULE_STATUS_CONFIG[s] ?? DEFAULT_SCHEDULE_STATUS;
  return (
    <View
      className="self-start rounded-full border px-2.5 py-0.5"
      style={{ backgroundColor: `${cfg.bg}`, borderColor: `${cfg.text}33` }}
    >
      <Text className="text-[11px] font-semibold" style={{ color: cfg.text }}>
        {cfg.label}
      </Text>
    </View>
  );
}

export function AssetConditionBadge({ condition }: { condition?: string | null }) {
  const c = (condition || "GOOD").toUpperCase();
  const cfg = ASSET_CONDITION_CONFIG[c] ?? DEFAULT_ASSET_CONDITION;
  return (
    <View
      className="self-start rounded-full border px-2.5 py-0.5"
      style={{ backgroundColor: `${cfg.bg}`, borderColor: `${cfg.text}33` }}
    >
      <Text className="text-[11px] font-semibold" style={{ color: cfg.text }}>
        {cfg.label}
      </Text>
    </View>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  color,
  icon: Icon,
  onPress,
}: {
  label: string;
  value: React.ReactNode;
  hint: React.ReactNode;
  color: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  onPress?: () => void;
}) {
  const cardClass =
    "min-w-[145px] sm:min-w-[210px] flex-1 overflow-hidden rounded-2xl border border-border/80 bg-card p-4 shadow-sm";
  const inner = (
    <>
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 min-w-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </Text>
        <View className="shrink-0 rounded-lg p-1.5" style={{ backgroundColor: `${color}18` }}>
          <Icon size={14} color={color} />
        </View>
      </View>
      <Text className="mt-1 text-xl font-bold tracking-tight sm:text-2xl" style={{ color }}>
        {value}
      </Text>
      <Text className="mt-1 text-xs text-muted-foreground">{hint}</Text>
    </>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} className={cardClass}>
        {inner}
      </Pressable>
    );
  }
  return <View className={cardClass}>{inner}</View>;
}

export type MaintenanceTabItem = {
  value: string;
  label: string;
  count?: number;
  icon?: React.ComponentType<{ size?: number; color?: string }>;
};

export function MaintenanceTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: MaintenanceTabItem[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-1 rounded-xl border border-border/70 bg-card p-1 w-full">
      {tabs.map((tab) => {
        const active = tab.value === value;
        const Icon = tab.icon;
        return (
          <Pressable
            key={tab.value}
            onPress={() => onChange(tab.value)}
            className="min-h-[34px] flex-row items-center gap-1.5 rounded-lg px-2.5 sm:px-3"
            style={{ backgroundColor: active ? colors.primary : "transparent" }}
          >
            {Icon && (
              <Icon size={14} color={active ? colors.primaryForeground : colors.textMuted} />
            )}
            <Text
              className={cn(
                "text-xs font-semibold",
                active ? "text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {tab.label}
            </Text>
            {tab.count != null ? (
              <View
                className={cn(
                  "rounded-full px-1.5 py-0.5",
                  active ? "bg-black/15" : "bg-muted/40",
                )}
              >
                <Text
                  className={cn(
                    "text-[10px] font-bold",
                    active ? "text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {tab.count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function EmptyRow({ text }: { text: string }) {
  return (
    <View className="items-center justify-center gap-1 py-8">
      <Text className="text-sm font-medium text-muted-foreground">{text}</Text>
    </View>
  );
}
