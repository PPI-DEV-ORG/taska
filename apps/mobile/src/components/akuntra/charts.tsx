import * as React from "react";
import { Platform, View } from "react-native";
import { Text } from "@/components/ui/text";
import { Panel } from "@/components/akuntra/basics";
import { chartSeries, colors } from "@/tokens";

export type Series = { name: string; color: string };

export function ChartCard({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Panel title={title} subtitle={subtitle} right={right} className="min-w-[280px] flex-1">
      {children}
    </Panel>
  );
}

function Legend({ series }: { series: Series[] }) {
  return (
    <View className="mt-3 flex-row flex-wrap items-center justify-center gap-4">
      {series.map((s) => (
        <View key={s.name} className="flex-row items-center gap-1.5">
          <View className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
          <Text className="text-muted-foreground text-[12px] font-medium">{s.name}</Text>
        </View>
      ))}
    </View>
  );
}

/** Batang vertikal, satu atau beberapa seri (maksimal 5). Grid redup, legenda di bawah. */
export function BarChart({
  data,
  series,
  format = (n) => String(n),
  height = 170,
}: {
  data: { label: string; values: number[] }[];
  series: Series[];
  format?: (n: number) => string;
  height?: number;
}) {
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
                        height: Math.max(4, (v / max) * (height - 48)),
                        width: "100%",
                        backgroundColor: series[i]?.color ?? chartSeries[i % chartSeries.length],
                        borderTopLeftRadius: 6,
                        borderTopRightRadius: 6,
                      }}
                    />
                  </View>
                ))}
              </View>
            ))}
          </View>
          <View className="mt-2.5 flex-row gap-2">
            {data.map((d) => (
              <Text key={d.label} className="text-muted-foreground flex-1 text-center text-[11px] font-medium" numberOfLines={1}>
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
  data,
  format = (n) => String(n),
}: {
  data: { label: string; value: number; color?: string; text?: string; [k: string]: any }[];
  format?: (n: number, item?: any) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View className="gap-3">
      {data.map((d, i) => (
        <View key={d.label} className="gap-1">
          <View className="flex-row justify-between gap-2">
            <Text className="flex-1 text-xs font-medium text-foreground" numberOfLines={1}>
              {d.label}
            </Text>
            <Text className="text-muted-foreground text-xs font-semibold">
              {d.text ?? format(d.value, d)}
            </Text>
          </View>
          <View className="bg-muted/40 h-2.5 overflow-hidden rounded-full">
            <View
              style={{
                width: `${(d.value / max) * 100}%`,
                backgroundColor: d.color ?? chartSeries[i % chartSeries.length],
                height: "100%",
                borderRadius: 999,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Funnel lead: lebar batang mengikuti jumlah, label jelas. */
export function Funnel({
  data,
  format = (n) => String(n),
}: {
  data: { label: string; value: number }[];
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View className="gap-2.5">
      {data.map((d, i) => (
        <View key={d.label} className="flex-row items-center gap-3">
          <Text className="text-muted-foreground w-24 text-xs font-medium" numberOfLines={1}>
            {d.label}
          </Text>
          <View className="flex-1">
            <View
              className="h-7 justify-center rounded-lg px-2.5 shadow-sm"
              style={{
                width: `${Math.max(15, (d.value / max) * 100)}%`,
                backgroundColor: chartSeries[i % chartSeries.length],
              }}
            >
              <Text className="text-xs font-bold text-white">{format(d.value)}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * WaveChart: Grafik area bergelombang halus (Smooth Cubic Bezier)
 * dengan gradasi lembut palet warna Akuntra.
 */
export function WaveChart({
  data,
  color = colors.primary,
  fillGradient = true,
  height = 170,
  format = (n) => String(n),
  badgeText,
}: {
  data: { label: string; value: number }[];
  color?: string;
  fillGradient?: boolean;
  height?: number;
  format?: (n: number) => string;
  badgeText?: string;
}) {
  const gradId = React.useId ? React.useId().replace(/:/g, "") : `wave_${Math.random().toString(36).substring(2, 7)}`;
  const values = data.map((d) => d.value);
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const range = max - min || 1;

  const width = 500;
  const padX = 24;
  const padTop = 18;
  const padBottom = 28;
  const chartHeight = height - 10;
  const innerH = chartHeight - padTop - padBottom;
  const stepX = data.length > 1 ? (width - padX * 2) / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = padX + i * stepX;
    const y = padTop + innerH - ((d.value - min) / range) * innerH;
    return { x, y, value: d.value, label: d.label };
  });

  // Buat Monotone Cubic Bezier path
  const firstPt = points[0];
  const lastPt = points[points.length - 1];
  let pathD = firstPt ? `M ${firstPt.x} ${firstPt.y}` : "";
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    if (p0 && p1) {
      const cpx1 = p0.x + (p1.x - p0.x) / 2;
      const cpy1 = p0.y;
      const cpx2 = p0.x + (p1.x - p0.x) / 2;
      const cpy2 = p1.y;
      pathD += ` C ${cpx1.toFixed(1)} ${cpy1.toFixed(1)}, ${cpx2.toFixed(1)} ${cpy2.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
    }
  }

  const baselineY = padTop + innerH;
  const areaD = firstPt && lastPt
    ? `${pathD} L ${lastPt.x.toFixed(1)} ${baselineY} L ${firstPt.x.toFixed(1)} ${baselineY} Z`
    : "";

  return (
    <View className="w-full">
      {badgeText ? (
        <View className="mb-2 flex-row items-center justify-between">
          <View className="rounded-full bg-primary/10 px-2.5 py-0.5">
            <Text className="text-[11px] font-bold text-primary">{badgeText}</Text>
          </View>
          <Text className="text-[11px] font-semibold text-muted-foreground">
            Tertinggi: {format(max)}
          </Text>
        </View>
      ) : null}

      {Platform.OS === "web" ? (
        <View style={{ height }} className="w-full overflow-hidden">
          <svg
            viewBox={`0 0 ${width} ${chartHeight}`}
            style={{ width: "100%", height: "100%", overflow: "visible" }}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                <stop offset="70%" stopColor={color} stopOpacity={0.06} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* Grid Lines Horisontal */}
            {[0, 0.5, 1].map((p) => {
              const y = padTop + innerH * (1 - p);
              return (
                <line
                  key={p}
                  x1={padX}
                  y1={y}
                  x2={width - padX}
                  y2={y}
                  stroke={colors.border}
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
              );
            })}

            {/* Area Gelombang */}
            {fillGradient && areaD ? (
              <path d={areaD} fill={`url(#${gradId})`} />
            ) : null}

            {/* Garis Kurva */}
            {pathD ? (
              <path
                d={pathD}
                fill="none"
                stroke={color}
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}

            {/* Titik Koordinat (Dots) */}
            {points.map((pt, idx) => (
              <g key={idx}>
                <circle cx={pt.x} cy={pt.y} r={5} fill={color} stroke="#FFFFFF" strokeWidth="2.5" />
                <text
                  x={pt.x}
                  y={pt.y - 10}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="bold"
                  fill={colors.foreground}
                >
                  {format(pt.value)}
                </text>
              </g>
            ))}
          </svg>
        </View>
      ) : (
        /* Fallback View untuk Mobile Native */
        <View style={{ height }} className="flex-row items-end gap-2 pt-6">
          {data.map((d, i) => (
            <View key={i} className="flex-1 items-center justify-end">
              <View
                style={{
                  height: Math.max(6, (d.value / max) * (height - 40)),
                  width: "70%",
                  backgroundColor: color,
                  borderRadius: 4,
                }}
              />
            </View>
          ))}
        </View>
      )}

      {/* Label Sumbu X */}
      <View className="mt-1 flex-row justify-between px-2">
        {data.map((d, i) => (
          <Text
            key={i}
            className="text-[11px] font-semibold text-muted-foreground text-center"
            style={{ width: `${100 / data.length}%` }}
            numberOfLines={1}
          >
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

/**
 * LineChart: Garis tren multi-seri untuk perbandingan metrik over time
 */
export function LineChart({
  data,
  series,
  format = (n) => String(n),
  height = 175,
}: {
  data: { label: string; values: number[] }[];
  series: Series[];
  format?: (n: number) => string;
  height?: number;
}) {
  const allValues = data.flatMap((d) => d.values);
  const max = Math.max(1, ...allValues);
  const min = 0;
  const range = max - min || 1;

  const width = 500;
  const padX = 28;
  const padTop = 18;
  const padBottom = 26;
  const chartHeight = height - 10;
  const innerH = chartHeight - padTop - padBottom;
  const stepX = data.length > 1 ? (width - padX * 2) / (data.length - 1) : 0;

  return (
    <View className="w-full">
      {Platform.OS === "web" ? (
        <View style={{ height }} className="w-full overflow-hidden">
          <svg
            viewBox={`0 0 ${width} ${chartHeight}`}
            style={{ width: "100%", height: "100%", overflow: "visible" }}
            preserveAspectRatio="none"
          >
            {/* Grid Horisontal */}
            {[0, 0.5, 1].map((p) => {
              const y = padTop + innerH * (1 - p);
              return (
                <line
                  key={p}
                  x1={padX}
                  y1={y}
                  x2={width - padX}
                  y2={y}
                  stroke={colors.border}
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
              );
            })}

            {/* Seri Garis */}
            {series.map((s, sIdx) => {
              const pts = data.map((d, i) => ({
                x: padX + i * stepX,
                y: padTop + innerH - ((d.values[sIdx] ?? 0) / range) * innerH,
                val: d.values[sIdx] ?? 0,
              }));

              const firstPt = pts[0];
              let lineD = firstPt ? `M ${firstPt.x} ${firstPt.y}` : "";
              for (let i = 1; i < pts.length; i++) {
                const pt = pts[i];
                if (pt) {
                  lineD += ` L ${pt.x} ${pt.y}`;
                }
              }

              return (
                <g key={s.name}>
                  <path
                    d={lineD}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {pts.map((pt, pIdx) => (
                    <circle
                      key={pIdx}
                      cx={pt.x}
                      cy={pt.y}
                      r={4.5}
                      fill={s.color}
                      stroke="#FFFFFF"
                      strokeWidth="2"
                    />
                  ))}
                </g>
              );
            })}
          </svg>
        </View>
      ) : (
        <BarChart data={data} series={series} format={format} height={height} />
      )}

      {/* Sumbu X */}
      <View className="mt-1 flex-row justify-between px-2">
        {data.map((d, i) => (
          <Text
            key={i}
            className="text-[11px] font-semibold text-muted-foreground text-center"
            style={{ width: `${100 / data.length}%` }}
            numberOfLines={1}
          >
            {d.label}
          </Text>
        ))}
      </View>

      <Legend series={series} />
    </View>
  );
}

/**
 * PieChart / DonutChart: Diagram lingkaran elegan dengan rasio dan legenda
 */
export function PieChart({
  data,
  size = 150,
  donut = true,
  strokeWidth = 24,
  centerLabel,
  centerValue,
  format = (n) => String(n),
}: {
  data: { label: string; value: number; color?: string }[];
  size?: number;
  donut?: boolean;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string;
  format?: (n: number) => string;
}) {
  const total = data.reduce((acc, d) => acc + (d.value || 0), 0);
  const safeTotal = Math.max(1, total);

  // Perhitungan SVG Donut
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let accumulatedOffset = 0;

  const slices = data.map((d, i) => {
    const pct = total > 0 ? (d.value / safeTotal) * 100 : 0;
    const strokeDash = (pct / 100) * circumference;
    const offset = accumulatedOffset;
    accumulatedOffset += strokeDash;
    return {
      ...d,
      pct: Math.round(pct),
      strokeDash,
      offset,
      color: d.color ?? chartSeries[i % chartSeries.length],
    };
  });

  return (
    <View className="flex-row flex-wrap items-center justify-around gap-4 py-1">
      {/* Visual Lingkaran */}
      <View style={{ width: size, height: size }} className="relative items-center justify-center">
        {Platform.OS === "web" ? (
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {/* Lingkaran Latar Belakang */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke={colors.border}
              strokeWidth={strokeWidth}
              opacity={0.3}
            />

            {/* Irisan Donut */}
            {slices.map((sl, idx) => (
              <circle
                key={idx}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={sl.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${sl.strokeDash} ${circumference - sl.strokeDash}`}
                strokeDashoffset={-sl.offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                strokeLinecap="round"
              />
            ))}
          </svg>
        ) : (
          <View
            style={{ width: size, height: size, borderRadius: size / 2, borderWidth: strokeWidth, borderColor: colors.primary }}
          />
        )}

        {/* Teks di Tengah Donut */}
        {donut ? (
          <View className="absolute items-center justify-center pointer-events-none px-2 text-center">
            <Text className="text-sm font-extrabold text-foreground" numberOfLines={1}>
              {centerValue ?? format(total)}
            </Text>
            {centerLabel ? (
              <Text className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider" numberOfLines={1}>
                {centerLabel}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Legenda Kategori & Persentase */}
      <View className="flex-1 min-w-[150px] gap-2">
        {slices.map((sl, idx) => (
          <View key={idx} className="flex-row items-center justify-between gap-2 border-b border-border/40 pb-1.5 last:border-b-0">
            <View className="flex-row items-center gap-2 flex-1 pr-1">
              <View className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: sl.color }} />
              <Text className="text-xs font-medium text-foreground" numberOfLines={1}>
                {sl.label}
              </Text>
            </View>
            <View className="items-end shrink-0">
              <Text className="text-xs font-bold text-foreground">
                {format(sl.value)}
              </Text>
              <Text className="text-[10px] text-muted-foreground font-semibold">
                {sl.pct}%
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

