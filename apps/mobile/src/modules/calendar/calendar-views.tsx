import * as React from "react";
import { Pressable, View } from "react-native";
import { AlertTriangle } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { StatusBadge } from "@/components/taska/status-badge";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";
import {
  CATEGORY_META, HARI, PRIORITY_LABEL, addDays, groupByDay, parseYmd, startOfWeek, statusLabel, wibTime, ymd,
  type CalItem,
} from "./types";

const catColor = (c: string) => (CATEGORY_META[c] ?? CATEGORY_META.OTHER!).color;

function timeText(it: CalItem): string {
  if (it.isAllDay || it.sourceModule !== "calendar") {
    return it.isAllDay ? "Sepanjang hari" : `${wibTime(it.start)} WIB`;
  }
  return it.end ? `${wibTime(it.start)} - ${wibTime(it.end)} WIB` : `${wibTime(it.start)} WIB`;
}

export function EventPill({ item, onPress, compact }: { item: CalItem; onPress: (i: CalItem) => void; compact?: boolean }) {
  const color = catColor(item.category);
  return (
    <Pressable
      onPress={() => onPress(item)}
      className="flex-row items-center gap-1 rounded-md px-1.5 py-0.5"
      style={{ backgroundColor: `${color}1F`, borderLeftWidth: 3, borderLeftColor: item.isOverdue ? "#EF5350" : color }}
    >
      {item.hasConflict ? <AlertTriangle size={10} color={colors.warning} /> : null}
      <Text
        numberOfLines={1}
        className={cn("flex-1 text-[11px] font-medium", item.isOverdue ? "text-danger" : "text-foreground", item.status === "COMPLETED" && "line-through opacity-60")}
      >
        {compact ? "" : `${item.isAllDay ? "" : wibTime(item.start) + " "}`}
        {item.title}
      </Text>
    </Pressable>
  );
}

export function EventCard({ item, onPress }: { item: CalItem; onPress: (i: CalItem) => void }) {
  const color = catColor(item.category);
  const meta = CATEGORY_META[item.category] ?? CATEGORY_META.OTHER!;
  return (
    <Pressable
      onPress={() => onPress(item)}
      className="bg-card border-border/80 flex-row gap-3 rounded-xl border p-3"
      style={{ borderLeftWidth: 4, borderLeftColor: item.isOverdue ? "#EF5350" : color }}
    >
      <View className="flex-1 min-w-0">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-sm font-semibold flex-shrink" numberOfLines={2}>{item.title}</Text>
          {item.eventNumber ? (
            <Text className="text-muted-foreground text-[11px]">{item.eventNumber}</Text>
          ) : null}
        </View>
        <Text className="text-muted-foreground mt-0.5 text-xs" numberOfLines={1}>
          {timeText(item)}
          {item.picName ? ` · PIC: ${item.picName}` : ""}
          {item.priority ? ` · Prioritas: ${PRIORITY_LABEL[item.priority] ?? item.priority}` : ""}
        </Text>
        {item.subtitle ? <Text className="text-text-secondary mt-0.5 text-xs" numberOfLines={1}>{item.subtitle}</Text> : null}
        <View className="mt-2 flex-row flex-wrap items-center gap-2">
          <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: `${color}1F` }}>
            <Text className="text-[11px] font-semibold" style={{ color }}>{meta.label}</Text>
          </View>
          <StatusBadge status={statusLabel(item)} />
          {item.hasConflict ? (
            <View className="flex-row items-center gap-1 rounded-full bg-warning/15 border border-warning/30 px-2 py-0.5">
              <AlertTriangle size={11} color={colors.warning} />
              <Text className="text-[11px] font-semibold text-warning">Bentrok: {item.conflictWith}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

// ─────────────────────────────── Month ───────────────────────────────

export function MonthView({
  cursor, items, selected, onSelect, onOpen,
}: {
  cursor: Date; items: CalItem[]; selected: string; onSelect: (k: string) => void; onOpen: (i: CalItem) => void;
}) {
  const { isMobile } = useBreakpoint();
  const byDay = React.useMemo(() => groupByDay(items), [items]);
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const todayKey = ymd(new Date());
  const weeks: Date[][] = [];
  let cur = gridStart;
  for (let w = 0; w < 6; w++) {
    const row: Date[] = [];
    for (let d = 0; d < 7; d++) { row.push(cur); cur = addDays(cur, 1); }
    if (w >= 4 && row[0]!.getMonth() !== cursor.getMonth()) break;
    weeks.push(row);
  }
  const max = isMobile ? 0 : 3;

  return (
    <View>
      <View className="flex-row border-border/60 border-b">
        {HARI.map((h) => (
          <View key={h} className="flex-1 items-center py-2">
            <Text className="text-muted-foreground text-[11px] font-semibold uppercase">{h}</Text>
          </View>
        ))}
      </View>
      {weeks.map((row, wi) => (
        <View key={wi} className="flex-row">
          {row.map((d) => {
            const k = ymd(d);
            const list = byDay[k] ?? [];
            const inMonth = d.getMonth() === cursor.getMonth();
            const isToday = k === todayKey;
            const isSel = k === selected;
            return (
              <Pressable
                key={k}
                onPress={() => onSelect(k)}
                className={cn(
                  "border-border/40 flex-1 border-b border-r p-1",
                  isMobile ? "min-h-[56px]" : "min-h-[104px]",
                  isSel && "bg-primary/10",
                  !inMonth && "opacity-45",
                )}
              >
                <View className="items-end">
                  <View className={cn("size-6 items-center justify-center rounded-full", isToday && "bg-primary")}>
                    <Text className={cn("text-xs font-medium", isToday && "text-primary-foreground")}>{d.getDate()}</Text>
                  </View>
                </View>
                {isMobile ? (
                  <View className="mt-1 flex-row flex-wrap justify-center gap-0.5">
                    {list.slice(0, 4).map((it) => (
                      <View key={it.key} className="size-1.5 rounded-full" style={{ backgroundColor: it.isOverdue ? "#EF5350" : catColor(it.category) }} />
                    ))}
                  </View>
                ) : (
                  <View className="mt-1 gap-0.5">
                    {list.slice(0, max).map((it) => <EventPill key={it.key} item={it} onPress={onOpen} />)}
                    {list.length > max ? (
                      <Text className="text-muted-foreground px-1 text-[11px]">+{list.length - max} lainnya</Text>
                    ) : null}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────── Week ───────────────────────────────

export function WeekView({
  cursor, items, selected, onSelect, onOpen,
}: {
  cursor: Date; items: CalItem[]; selected: string; onSelect: (k: string) => void; onOpen: (i: CalItem) => void;
}) {
  const { isMobile } = useBreakpoint();
  const byDay = React.useMemo(() => groupByDay(items), [items]);
  const start = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const todayKey = ymd(new Date());

  return (
    <View className={isMobile ? "gap-2" : "flex-row"}>
      {days.map((d, i) => {
        const k = ymd(d);
        const list = byDay[k] ?? [];
        const isToday = k === todayKey;
        return (
          <View
            key={k}
            className={cn(isMobile ? "border-border/60 rounded-xl border p-2" : "border-border/40 flex-1 border-r p-1.5 min-h-[260px]", k === selected && "bg-primary/10")}
          >
            <Pressable onPress={() => onSelect(k)} className="mb-2 flex-row items-center gap-2 md:flex-col md:items-start">
              <Text className="text-muted-foreground text-[11px] font-semibold uppercase">{HARI[i]}</Text>
              <View className={cn("size-6 items-center justify-center rounded-full", isToday && "bg-primary")}>
                <Text className={cn("text-xs font-medium", isToday && "text-primary-foreground")}>{d.getDate()}</Text>
              </View>
            </Pressable>
            <View className="gap-1">
              {list.length === 0 ? (
                isMobile ? <Text className="text-muted-foreground text-xs">Tidak ada agenda</Text> : null
              ) : (
                list.map((it) => <EventPill key={it.key} item={it} onPress={onOpen} />)
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─────────────────────────────── Day ───────────────────────────────

export function DayView({ day, items, onOpen }: { day: string; items: CalItem[]; onOpen: (i: CalItem) => void }) {
  const list = React.useMemo(() => groupByDay(items)[day] ?? [], [items, day]);
  const allDay = list.filter((i) => i.isAllDay);
  const timed = list.filter((i) => !i.isAllDay);
  if (list.length === 0) {
    return <Text className="text-muted-foreground py-8 text-center text-sm">Tidak ada agenda pada hari ini.</Text>;
  }
  return (
    <View className="gap-4">
      {allDay.length ? (
        <View className="gap-2">
          <Text className="text-muted-foreground text-xs font-semibold uppercase">Sepanjang hari / Deadline</Text>
          {allDay.map((it) => <EventCard key={it.key} item={it} onPress={onOpen} />)}
        </View>
      ) : null}
      {timed.length ? (
        <View className="gap-2">
          <Text className="text-muted-foreground text-xs font-semibold uppercase">Terjadwal (WIB)</Text>
          {timed.map((it) => <EventCard key={it.key} item={it} onPress={onOpen} />)}
        </View>
      ) : null}
    </View>
  );
}

// ─────────────────────────────── Agenda ───────────────────────────────

const HARI_PANJANG = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export function AgendaView({ items, onOpen }: { items: CalItem[]; onOpen: (i: CalItem) => void }) {
  const byDay = React.useMemo(() => groupByDay(items), [items]);
  const keys = Object.keys(byDay).sort();
  const todayKey = ymd(new Date());
  if (!keys.length) return <Text className="text-muted-foreground py-8 text-center text-sm">Tidak ada agenda pada periode ini.</Text>;
  return (
    <View className="gap-4">
      {keys.map((k) => {
        const d = parseYmd(k);
        return (
          <View key={k} className="gap-2">
            <View className="flex-row items-center gap-2">
              <Text className={cn("text-sm font-semibold", k === todayKey && "text-primary")}>
                {HARI_PANJANG[d.getDay()]}, {d.getDate()} {BULAN_PENDEK[d.getMonth()]} {d.getFullYear()}
              </Text>
              {k === todayKey ? <Text className="text-primary text-xs font-medium">Hari ini</Text> : null}
              {k < todayKey && byDay[k]!.some((i) => i.isOverdue) ? <Text className="text-danger text-xs font-medium">Overdue</Text> : null}
            </View>
            {byDay[k]!.map((it) => <EventCard key={`${k}-${it.key}`} item={it} onPress={onOpen} />)}
          </View>
        );
      })}
    </View>
  );
}
