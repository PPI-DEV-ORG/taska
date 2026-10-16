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
  data, series, format = (n) => String(n), height = 160,
}: { data: { label: string; values: number[] }[]; series: Series[]; format?: (n: number) => string; height?: number }) {
  const max = Math.max(1, ...data.flatMap((d) => d.values));
  const yTicks = [
    { p: 1, label: format(max) },
    { p: 0.5, label: format(Math.round(max * 0.5 * 10) / 10) },
    { p: 0, label: "0" },
  ];

  return (
    <View>
      <View className="flex-row items-end">
        {/* Y-axis labels */}
        <View style={{ height }} className="w-12 relative justify-between pb-1 pr-2">
          {yTicks.map((t) => (
            <View
              key={t.p}
              className="absolute right-2"
              style={{ bottom: t.p * (height - 30) }}
            >
              <Text className="text-[10px] text-muted-foreground text-right font-medium" numberOfLines={1}>
                {t.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Chart bars & grid */}
        <View className="flex-1">
          <View style={{ height }} className="relative flex-row items-end gap-2 pt-6">
            {[0, 0.5, 1].map((p) => (
              <View
                key={p}
                className="absolute left-0 right-0"
                style={{ bottom: p * (height - 30) + 6, height: 1, backgroundColor: colors.border }}
              />
            ))}
            {data.map((d) => (
              <View key={d.label} className="flex-1 flex-row items-end justify-center gap-1.5" style={{ height: "100%" }}>
                {d.values.map((v, i) => (
                  <View key={i} className="flex-1 items-center justify-end" style={{ maxWidth: 32, height: "100%" }}>
                    {v > 0 ? (
                      <Text className="text-foreground font-semibold mb-1 text-[10px] text-center" numberOfLines={1}>
                        {format(v)}
                      </Text>
                    ) : null}
                    <View
                      style={{
                        height: Math.max(3, (v / max) * (height - 48)),
                        width: "100%",
                        backgroundColor: series[i]?.color ?? chartSeries[i],
                        borderTopLeftRadius: 4,
                        borderTopRightRadius: 4,
                      }}
                    />
                  </View>
                ))}
              </View>
            ))}
          </View>
          <View className="mt-2 flex-row gap-2">
            {data.map((d) => (
              <Text key={d.label} className="text-muted-foreground flex-1 text-center text-[12px] font-medium" numberOfLines={1}>
                {d.label}
              </Text>
            ))}
          </View>
        </View>
      </View>
      {series.length > 1 || data.length > 7 ? <Legend series={series} /> : null}
    </View>
  );
}

/** Batang horizontal untuk distribusi (sumber lead, alasan Lost, kategori). */
export function HBarChart({
  data, format = (n) => String(n),
}: { data: { label: string; value: number; color?: string; text?: string; [k: string]: any }[]; format?: (n: number, item?: any) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View className="gap-3">
      {data.map((d, i) => (
        <View key={d.label} className="gap-1">
          <View className="flex-row justify-between gap-2">
            <Text className="flex-1 text-sm" numberOfLines={1}>{d.label}</Text>
            <Text className="text-text-secondary text-sm">{d.text ?? format(d.value, d)}</Text>
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
