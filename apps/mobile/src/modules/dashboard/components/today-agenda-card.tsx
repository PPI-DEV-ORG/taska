import * as React from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Calendar as CalendarIcon, CheckCircle2, ChevronRight, Plus } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Panel } from "@/components/taska/basics";
import { useApp } from "@/store/app-store";
import { api, queryString } from "@/services/api";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";
import { EventCard } from "@/modules/calendar/calendar-views";
import { EventDetailDialog, EventFormDialog } from "@/modules/calendar/event-dialogs";
import {
  BULAN_PANJANG,
  daysOf,
  parseYmd,
  wibKey,
  type CalItem,
} from "@/modules/calendar/types";

const HARI_PANJANG = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export function TodayAgendaCard({ refreshKey }: { refreshKey?: number }) {
  const router = useRouter();
  const { user } = useApp();

  const role = (user?.role || "").toLowerCase();
  const canViewAll = role === "super_admin" || role === "bos" || role === "admin";

  const [scope, setScope] = React.useState<"all" | "team">(canViewAll ? "all" : "team");
  const [items, setItems] = React.useState<CalItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  // Dialogs
  const [selectedItem, setSelectedItem] = React.useState<CalItem | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<number | null>(null);
  const [editOccDate, setEditOccDate] = React.useState<string | undefined>(undefined);

  const now = new Date();
  const todayKey = wibKey(now.toISOString());
  const todayDate = parseYmd(todayKey);
  const dayName = HARI_PANJANG[todayDate.getDay()] ?? "";
  const dateStr = `${dayName}, ${todayDate.getDate()} ${BULAN_PANJANG[todayDate.getMonth()]} ${todayDate.getFullYear()}`;

  const load = React.useCallback(async () => {
    const d = parseYmd(todayKey);
    const from = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 0, 0, 0);
    const to = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 23, 59, 59);

    setLoading(true);
    try {
      const res = await api<{ items: CalItem[] }>(
        "GET",
        `/calendar/events${queryString({
          from: from.toISOString(),
          to: to.toISOString(),
          scope: scope === "all" && canViewAll ? "all" : "team",
        })}`,
      );
      setItems(res.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [canViewAll, scope, todayKey]);

  React.useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load, refreshKey]);

  const todayItems = items.filter((it) => daysOf(it).includes(todayKey));
  const overdueCount = todayItems.filter((it) => it.isOverdue).length;
  const visibleItems = expanded ? todayItems : todayItems.slice(0, 4);

  return (
    <>
      <Panel
        icon={CalendarIcon}
        title="Agenda & Jadwal Hari Ini"
        subtitle={dateStr}
        right={
          <View className="flex-row flex-wrap items-center gap-2">
            {canViewAll ? (
              <View className="flex-row items-center bg-muted/50 rounded-lg p-0.5 border border-border/40">
                <Pressable
                  onPress={() => setScope("all")}
                  className={cn(
                    "px-2.5 py-1 rounded-md",
                    scope === "all" ? "bg-primary" : "bg-transparent",
                  )}
                >
                  <Text
                    className={cn(
                      "text-xs font-medium",
                      scope === "all" ? "text-primary-foreground font-semibold" : "text-muted-foreground",
                    )}
                  >
                    Semua
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setScope("team")}
                  className={cn(
                    "px-2.5 py-1 rounded-md",
                    scope === "team" ? "bg-primary" : "bg-transparent",
                  )}
                >
                  <Text
                    className={cn(
                      "text-xs font-medium",
                      scope === "team" ? "text-primary-foreground font-semibold" : "text-muted-foreground",
                    )}
                  >
                    Saya
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {todayItems.length > 0 ? (
              <View className="rounded-full bg-primary/10 px-2.5 py-1">
                <Text className="text-xs font-semibold text-primary">{todayItems.length} Agenda</Text>
              </View>
            ) : null}

            {overdueCount > 0 ? (
              <View className="rounded-full bg-danger/10 px-2.5 py-1">
                <Text className="text-xs font-semibold text-danger">{overdueCount} Perlu Perhatian</Text>
              </View>
            ) : null}

            <Button
              size="sm"
              variant="outline"
              onPress={() => router.push("/calendar" as any)}
            >
              <CalendarIcon size={14} color={colors.text} />
              <Text className="text-xs">Kalender</Text>
            </Button>

            <Button
              size="sm"
              onPress={() => {
                setEditId(null);
                setEditOccDate(undefined);
                setFormOpen(true);
              }}
            >
              <Plus size={14} color="#fff" />
              <Text className="text-xs">Buat Agenda</Text>
            </Button>
          </View>
        }
      >
        {todayItems.length === 0 ? (
          <View className="flex-row items-center justify-between py-2.5 px-1">
            <View className="flex-row items-center gap-3">
              <View className="size-10 rounded-xl bg-success/10 items-center justify-center">
                <CheckCircle2 size={20} color={colors.success} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">
                  {loading ? "Memuat agenda hari ini..." : "Tidak ada agenda terjadwal untuk hari ini"}
                </Text>
                <Text className="text-xs text-muted-foreground mt-0.5">
                  Semua agenda, meeting, atau deadline hari ini tidak ada atau telah selesai.
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View className="gap-2.5">
            {visibleItems.map((item) => (
              <EventCard
                key={item.key}
                item={item}
                onPress={(it) => setSelectedItem(it)}
              />
            ))}

            {todayItems.length > 4 ? (
              <View className="pt-1 flex-row items-center justify-between">
                <Pressable
                  onPress={() => setExpanded(!expanded)}
                  className="py-1 px-2"
                >
                  <Text className="text-xs font-semibold text-primary">
                    {expanded ? "Tampilkan lebih sedikit" : `+ Tampilkan ${todayItems.length - 4} agenda lainnya`}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push("/calendar" as any)}
                  className="flex-row items-center gap-1 py-1 px-2"
                >
                  <Text className="text-xs text-muted-foreground">Buka Kalender Kerja</Text>
                  <ChevronRight size={13} color={colors.textSecondary} />
                </Pressable>
              </View>
            ) : null}
          </View>
        )}
      </Panel>

      <EventDetailDialog
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onChanged={() => void load()}
        onEdit={(id, occDate) => {
          setSelectedItem(null);
          setEditId(id);
          setEditOccDate(occDate);
          setFormOpen(true);
        }}
      />

      <EventFormDialog
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) {
            setEditId(null);
            setEditOccDate(undefined);
          }
        }}
        eventId={editId}
        defaultDate={todayKey}
        occurrenceDate={editOccDate}
        onSaved={() => void load()}
      />
    </>
  );
}
