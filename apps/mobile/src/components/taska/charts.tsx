import * as React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { Panel } from "@/components/taska/basics";
import { chartSeries, colors } from "@/tokens";

type Series = { name: string; color: string };

export function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <Panel title={title} subtitle={subtitle} className="min-w-[280px] flex-1">{children}</Panel>;
}

function Legend({ series }: { series: Series[] }) {
  return (
    <View className="mt-3 flex-row flex-wrap items-center justify-center gap-4">
      {series.map((s) => (
        <View key={s.name} className="flex-row items-center gap-1.5">
          <View className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
          <Text className="text-text-secondary text-[13px]">{s.name}</Text>
        </View>
      ))}
    </View>
  );
}

/** Batang vertikal, satu atau beberapa seri (maksimal 5). Grid redup, legenda di bawah. */
export function BarChart({
  data, series, format = (n) => String(n), height = 150,
}: { data: { label: string; values: number[] }[]; series: Series[]; format?: (n: number) => string; height?: number }) {
  const max = Math.max(1, ...data.flatMap((d) => d.values));
  return (
    <View>
      <View style={{ height }} className="relative flex-row items-end gap-2 pt-5">
        {[0, 0.5, 1].map((p) => (
          <View key={p} className="absolute left-0 right-0" style={{ bottom: p * (height - 20), height: 1, backgroundColor: colors.border }} />
        ))}
        {data.map((d) => (
          <View key={d.label} className="flex-1 flex-row items-end justify-center gap-1" style={{ height: "100%" }}>
            {d.values.map((v, i) => (
              <View key={i} className="flex-1 items-center justify-end" style={{ maxWidth: 28, height: "100%" }}>
                {data.length <= 7 && series.length === 1 ? <Text className="text-muted-foreground mb-0.5 text-[11px]">{format(v)}</Text> : null}
                <View style={{ height: Math.max(3, (v / max) * (height - 40)), width: "100%", backgroundColor: series[i]?.color ?? chartSeries[i], borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
              </View>
            ))}
          </View>
        ))}
      </View>
      <View className="mt-1.5 flex-row gap-2">
        {data.map((d) => (
          <Text key={d.label} className="text-muted-foreground flex-1 text-center text-[12px]" numberOfLines={1}>{d.label}</Text>
        ))}
      </View>
      {series.length > 1 || data.length > 7 ? <Legend series={series} /> : null}
    </View>
  );
}

/** Batang horizontal untuk distribusi (sumber lead, alasan Lost, kategori). */
export function HBarChart({
  data, format = (n) => String(n),
}: { data: { label: string; value: number; color?: string }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View className="gap-3">
      {data.map((d, i) => (
        <View key={d.label} className="gap-1">
          <View className="flex-row justify-between gap-2">
            <Text className="flex-1 text-sm" numberOfLines={1}>{d.label}</Text>
            <Text className="text-text-secondary text-sm">{format(d.value)}</Text>
          </View>
          <View className="bg-panel h-2 overflow-hidden rounded-full">
            <View style={{ width: `${(d.value / max) * 100}%`, backgroundColor: d.color ?? chartSeries[i % chartSeries.length], height: "100%", borderRadius: 999 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Funnel lead: lebar batang mengikuti jumlah, label jelas. */
export function Funnel({ data, format = (n) => String(n) }: { data: { label: string; value: number }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View className="gap-2">
      {data.map((d, i) => (
        <View key={d.label} className="flex-row items-center gap-3">
          <Text className="text-text-secondary w-28 text-sm" numberOfLines={1}>{d.label}</Text>
          <View className="flex-1">
            <View className="h-7 justify-center rounded-md px-2" style={{ width: `${Math.max(12, (d.value / max) * 100)}%`, backgroundColor: chartSeries[i % chartSeries.length] }}>
              <Text className="text-[13px] font-semibold" style={{ color: colors.background }}>{format(d.value)}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}
