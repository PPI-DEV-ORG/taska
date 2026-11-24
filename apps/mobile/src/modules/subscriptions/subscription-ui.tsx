import * as React from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";
import {
  CYCLE_LABEL,
  PAYMENT_LABEL,
  STATUS_LABEL,
  cycleText,
  paymentColor,
  statusColor,
} from "./subscription-utils";

export function SubscriptionStatusBadge({ status }: { status: string }) {
  const color = statusColor(status);
  return (
    <View
      className="self-start rounded-full border px-2.5 py-0.5"
      style={{ backgroundColor: `${color}1A`, borderColor: `${color}33` }}
    >
      <Text className="text-[11px] font-semibold" style={{ color }}>
        {STATUS_LABEL[status] ?? status}
      </Text>
    </View>
  );
}

export function PaymentStatusBadge({ status }: { status: string }) {
  const color = paymentColor(status);
  return (
    <View
      className="self-start rounded-full border px-2.5 py-0.5"
      style={{ backgroundColor: `${color}1A`, borderColor: `${color}33` }}
    >
      <Text className="text-[11px] font-semibold" style={{ color }}>
        {PAYMENT_LABEL[status] ?? status}
      </Text>
    </View>
  );
}

export function CycleBadge({ cycle }: { cycle: string }) {
  return (
    <View className="self-start rounded-full border border-border bg-muted/30 px-2.5 py-0.5">
      <Text className="text-[11px] font-medium text-muted-foreground">
        {CYCLE_LABEL[cycle] ?? cycleText(cycle)}
      </Text>
    </View>
  );
}

export function MiniStat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const color =
    tone === "success"
      ? colors.success
      : tone === "warning"
        ? colors.warning
        : tone === "danger"
          ? colors.danger
          : tone === "info"
            ? colors.info
            : colors.muted;
  return (
    <View className="min-w-[140px] flex-1 gap-1 rounded-xl border border-border/70 bg-card px-3 py-2.5">
      <Text className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Text>
      <Text className="text-lg font-bold" style={{ color }}>
        {value}
      </Text>
      {hint ? <Text className="text-[11px] text-muted-foreground">{hint}</Text> : null}
    </View>
  );
}

export type TabItem = { value: string; label: string; count?: number };

export function SubscriptionTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: TabItem[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-1 rounded-xl border border-border/70 bg-card p-1 w-full">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            onPress={() => onChange(tab.value)}
            className={cn(
              "min-h-[34px] flex-row items-center gap-1.5 rounded-lg px-2.5 sm:px-3",
              active ? "bg-primary" : "bg-transparent",
            )}
          >
            <Text
              className={cn(
                "text-xs font-semibold",
                active ? "text-white" : "text-muted-foreground",
              )}
            >
              {tab.label}
            </Text>
            {tab.count != null ? (
              <View
                className={cn(
                  "rounded-full px-1.5 py-0.5",
                  active ? "bg-white/20" : "bg-muted/40",
                )}
              >
                <Text
                  className={cn(
                    "text-[10px] font-bold",
                    active ? "text-white" : "text-muted-foreground",
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

export function InfoLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <View className="min-w-[150px] flex-1 gap-0.5">
      <Text className="text-[11px] text-muted-foreground">{label}</Text>
      <Text className="text-sm font-medium">{value ?? "-"}</Text>
    </View>
  );
}
