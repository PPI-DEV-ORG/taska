import * as React from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, Inbox, type LucideIcon } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { StatusBadge } from "@/components/taska/status-badge";
import { cn } from "@/lib/utils";
import { number, rupiah, tanggal, waktuRelatif } from "@/lib/format";
import { colors, toneColor, type Tone } from "@/tokens";
import type { Fmt } from "@/mock/modules";
import { useBreakpoint } from "@/hooks/use-breakpoint";

export function Panel({
  title, subtitle, right, icon: Icon, children, className, pad = true,
}: {
  title?: string; subtitle?: string; right?: React.ReactNode; icon?: LucideIcon; children?: React.ReactNode; className?: string; pad?: boolean;
}) {
  return (
    <View className={cn("bg-card border-border/80 rounded-2xl border shadow-sm", className)}>
      {title ? (
        <View className="border-border/60 flex-row items-center justify-between gap-3 border-b px-5 py-4">
          <View className="flex-1 flex-row items-center gap-3">
            {Icon ? (
              <View className="size-8 rounded-lg bg-primary/10 items-center justify-center">
                <Icon size={18} color={colors.primary} />
              </View>
            ) : null}
            <View className="flex-1">
              <Text className="text-base font-semibold tracking-tight">{title}</Text>
              {subtitle ? <Text className="text-muted-foreground text-xs mt-0.5">{subtitle}</Text> : null}
            </View>
          </View>
          {right}
        </View>
      ) : null}
      <View className={pad ? "p-5" : ""}>{children}</View>
    </View>
  );
}

export function PageHeader({
  title, subtitle, action, back, status, children,
}: {
  title: string; subtitle?: string; action?: React.ReactNode; back?: boolean; status?: string; children?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <View className="mb-6 gap-2">
      {back ? (
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/dashboard"))} className="min-h-[44px] flex-row items-center gap-2 self-start">
          <ArrowLeft size={18} color={colors.textSecondary} />
          <Text className="text-text-secondary text-sm">Kembali</Text>
        </Pressable>
      ) : null}
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <View className="min-w-[200px] flex-1 gap-1">
          <Text className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">{title}</Text>
          {subtitle ? <Text className="text-text-secondary text-sm">{subtitle}</Text> : null}
          {status ? <View className="mt-1"><StatusBadge status={status} /></View> : null}
        </View>
        {action ? <View className="flex-row flex-wrap items-center gap-2">{action}</View> : null}
      </View>
      {children}
    </View>
  );
}

export function KpiCard({
  label, value, hint, tone, icon: Icon, onPress, className,
}: { label: string; value: string; hint?: string; tone?: Tone; icon?: LucideIcon; onPress?: () => void; className?: string }) {
  const { isMobile } = useBreakpoint();
  const body = (
    <View
      className={cn(
        "bg-card border-border/80 rounded-2xl border p-4 sm:p-5 shadow-sm justify-between",
        isMobile ? "w-full gap-1.5" : "min-h-[110px] flex-1 gap-2.5",
        className
      )}
    >
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-text-secondary text-[11px] sm:text-xs font-medium uppercase tracking-wider">{label}</Text>
        {Icon ? (
          <View className="size-7 sm:size-8 rounded-lg bg-panel/80 items-center justify-center">
            <Icon size={15} color={tone ? toneColor[tone] : colors.primary} />
          </View>
        ) : null}
      </View>
      <Text className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground">{value}</Text>
      {hint ? (
        <Text className="text-[11px] sm:text-xs" style={{ color: tone ? toneColor[tone] : colors.muted }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} className={cn("w-full active:opacity-80", !isMobile && "min-w-[200px] flex-1")}>{body}</Pressable>
  ) : (
    <View className={cn("w-full", !isMobile && "min-w-[200px] flex-1")}>{body}</View>
  );
}

export function SegmentedProgress({ percent, segments = 24 }: { percent: number; segments?: number }) {
  const activeCount = Math.round((Math.min(100, Math.max(0, percent)) / 100) * segments);
  return (
    <View className="flex-row items-center gap-2.5">
      <View className="flex-row items-center gap-[2.5px]">
        {Array.from({ length: segments }).map((_, idx) => (
          <View
            key={idx}
            className={cn(
              "w-[3px] h-3.5 rounded-full",
              idx < activeCount ? "bg-primary" : "bg-panel"
            )}
          />
        ))}
      </View>
      <Text className="text-primary text-xs font-bold w-9 text-right">{percent}%</Text>
    </View>
  );
}

export function QuickActionButton({
  label, icon: Icon, shortcut, onPress, className,
}: { label: string; icon: LucideIcon; shortcut?: string; onPress: () => void; className?: string }) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        "bg-card hover:bg-panel border-border/80 active:bg-panel flex-row items-center justify-between gap-2.5 rounded-xl border px-4 py-3 shadow-sm",
        className
      )}
    >
      <View className="flex-row items-center gap-2.5">
        <Icon size={16} color={colors.primary} />
        <Text className="text-foreground text-xs font-medium">{label}</Text>
      </View>
      {shortcut ? (
        <View className="bg-panel border-border/60 rounded border px-1.5 py-0.5">
          <Text className="text-muted-foreground font-mono text-[10px]">{shortcut}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function KpiRow({ children }: { children: React.ReactNode }) {
  return <View className="mb-4 sm:mb-6 flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 w-full">{children}</View>;
}

export function EmptyState({
  title, text, actionLabel, onAction, icon: Icon = Inbox,
}: { title: string; text: string; actionLabel?: string; onAction?: () => void; icon?: LucideIcon }) {
  return (
    <View className="items-center gap-3 px-6 py-12">
      <View className="bg-panel size-14 items-center justify-center rounded-full">
        <Icon size={24} color={colors.muted} />
      </View>
      <Text className="text-lg font-semibold">{title}</Text>
      <Text className="text-text-secondary max-w-sm text-center text-sm">{text}</Text>
      {actionLabel ? (
        <Button onPress={onAction} className="mt-1"><Text>{actionLabel}</Text></Button>
      ) : null}
    </View>
  );
}

export function Cell({ fmt, value }: { fmt?: Fmt; value: any }) {
  switch (fmt) {
    case "rupiah": return <Text className="text-sm" numberOfLines={1}>{rupiah(value)}</Text>;
    case "date": return <Text className="text-sm" numberOfLines={1}>{tanggal(value)}</Text>;
    case "pct": return <Text className="text-sm" numberOfLines={1}>{value}%</Text>;
    case "number": return <Text className="text-sm" numberOfLines={1}>{number(Number(value))}</Text>;
    case "status": return value ? <StatusBadge status={String(value)} /> : <Text className="text-sm">-</Text>;
    default: return <Text className="text-sm" numberOfLines={1} ellipsizeMode="tail">{value === undefined || value === "" ? "-" : String(value)}</Text>;
  }
}

export function InfoGrid({ fields, row }: { fields: { label: string; key: string; fmt?: Fmt }[]; row: Record<string, any> }) {
  const { isMobile } = useBreakpoint();
  return (
    <View className="flex-row flex-wrap">
      {fields.map((f) => (
        <View key={f.key} className="gap-1 py-2 pr-4" style={{ width: isMobile ? "100%" : "50%" }}>
          <Text className="text-muted-foreground text-[13px]">{f.label}</Text>
          <Cell fmt={f.fmt} value={row[f.key]} />
        </View>
      ))}
    </View>
  );
}

export function Timeline({ items }: { items: { id: string; who: string; what: string; when: string }[] }) {
  return (
    <View>
      {items.map((it, i) => (
        <View key={it.id} className="flex-row gap-3">
          <View className="items-center">
            <View className="bg-primary mt-1.5 size-2.5 rounded-full" />
            {i < items.length - 1 ? <View className="bg-border w-px flex-1" /> : null}
          </View>
          <View className="flex-1 pb-4">
            <Text className="text-sm"><Text className="text-sm font-semibold">{it.who}</Text> {it.what.charAt(0).toLowerCase() + it.what.slice(1)}</Text>
            <Text className="text-muted-foreground text-[13px]">{waktuRelatif(it.when)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export function FormField({
  label, required, error, hint, children,
}: { label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium">
        {label}
        {required ? <Text className="text-danger text-sm"> *</Text> : null}
      </Text>
      {children}
      {hint && !error ? <Text className="text-muted-foreground text-[13px]">{hint}</Text> : null}
      {error ? <Text className="text-danger text-[13px]">{error}</Text> : null}
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        "min-h-[36px] justify-center rounded-full border px-3",
        active ? "border-primary bg-primary/15" : "border-border bg-card",
      )}
    >
      <Text className={cn("text-sm", active ? "text-primary font-medium" : "text-text-secondary")}>{label}</Text>
    </Pressable>
  );
}
