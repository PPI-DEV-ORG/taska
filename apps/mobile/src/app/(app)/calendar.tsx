import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, MessageSquare, Plus, Search, X } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Chip, PageHeader, Panel } from "@/components/akuntra/basics";
import { FilterBar } from "@/components/akuntra/data-table";
import { SearchableSelect } from "@/components/akuntra/dialogs";
import { WhatsappDialog } from "@/components/akuntra/whatsapp-dialog";
import { hasUserPermission } from "@/constants/modules";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useApp } from "@/store/app-store";
import { api, queryString } from "@/services/api";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";
import { AgendaView, DayView, EventCard, MonthView, WeekView } from "@/modules/calendar/calendar-views";
import { EventDetailDialog, EventFormDialog } from "@/modules/calendar/event-dialogs";
import {
  BULAN_PANJANG, CATEGORY_KEYS, CATEGORY_META, HARI, STATUS_LABEL, TEAM_FILTER_OPTIONS, addDays, groupByDay, parseYmd, startOfWeek, ymd,
  type CalItem, type CalendarView,
} from "@/modules/calendar/types";

const VIEWS: { key: CalendarView; label: string }[] = [
  { key: "month", label: "Bulan" },
  { key: "week", label: "Minggu" },
  { key: "day", label: "Hari" },
  { key: "agenda", label: "Agenda" },
];

function rangeOf(view: CalendarView, cursor: Date): { from: Date; to: Date } {
  if (view === "day") {
    const s = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
    return { from: s, to: new Date(s.getFullYear(), s.getMonth(), s.getDate(), 23, 59, 59) };
  }
  if (view === "week") {
    const s = startOfWeek(cursor);
    const e = addDays(s, 6);
    return { from: s, to: new Date(e.getFullYear(), e.getMonth(), e.getDate(), 23, 59, 59) };
  }
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);
  if (view === "month") {
    const gs = startOfWeek(first);
    return { from: gs, to: addDays(gs, 41) };
  }
  return { from: first, to: last };
}

function titleOf(view: CalendarView, cursor: Date): string {
  if (view === "day") return `${cursor.getDate()} ${BULAN_PANJANG[cursor.getMonth()]} ${cursor.getFullYear()}`;
  if (view === "week") {
    const s = startOfWeek(cursor);
    const e = addDays(s, 6);
    return `${s.getDate()} ${BULAN_PANJANG[s.getMonth()]!.slice(0, 3)} - ${e.getDate()} ${BULAN_PANJANG[e.getMonth()]!.slice(0, 3)} ${e.getFullYear()}`;
  }
  return `${BULAN_PANJANG[cursor.getMonth()]} ${cursor.getFullYear()}`;
}

export default function CalendarScreen() {
  const { user, data, toast } = useApp();
  const { isMobile } = useBreakpoint();
  const role = (user?.role || "").toLowerCase();
  const canViewAll = role === "super_admin" || role === "bos" || role === "admin";

  const [view, setView] = React.useState<CalendarView>("month");
  const [cursor, setCursor] = React.useState(() => new Date());
  const [selected, setSelected] = React.useState(() => ymd(new Date()));
  // Pimpinan langsung melihat seluruh jadwal perusahaan, PM jadwal tim lapangannya; selain itu agenda sendiri.
  const [scope, setScope] = React.useState<"me" | "team" | "all">(() => (canViewAll ? "all" : role === "pm" ? "team" : "me"));
  const [cats, setCats] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState("");
  const [onlyOverdue, setOnlyOverdue] = React.useState(false);
  const [pic, setPic] = React.useState("");
  const [team, setTeam] = React.useState("");
  const [q, setQ] = React.useState("");
  const [items, setItems] = React.useState<CalItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [detail, setDetail] = React.useState<CalItem | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<number | null>(null);
  const [editOccDate, setEditOccDate] = React.useState<string | undefined>(undefined);
  const [jumpOpen, setJumpOpen] = React.useState(false);
  const [waOpen, setWaOpen] = React.useState(false);
  const [jumpYear, setJumpYear] = React.useState(() => new Date().getFullYear());
  const canConfigWa = canViewAll || hasUserPermission(user, "settings", "L");
  const [jumpMonth, setJumpMonth] = React.useState(() => new Date().getMonth());

  function openJump() {
    setJumpYear(cursor.getFullYear());
    setJumpMonth(cursor.getMonth());
    setJumpOpen(true);
  }

  function jumpToMonth(y: number, m: number) {
    const d = new Date(y, m, 1);
    setCursor(d);
    setSelected(ymd(d));
    if (view === "day") setView("month");
    setJumpOpen(false);
  }

  function jumpToDate(y: number, m: number, day: number) {
    const d = new Date(y, m, day);
    setCursor(d);
    setSelected(ymd(d));
    setJumpOpen(false);
  }

  const userNames = React.useMemo(
    () => (data.users ?? []).map((u: any) => String(u.name || u.nama || "")).filter(Boolean),
    [data.users],
  );

  const load = React.useCallback(async () => {
    const { from, to } = rangeOf(view, cursor);
    const picId = pic ? (data.users ?? []).find((u: any) => (u.name || u.nama) === pic)?.id : undefined;
    const teamKey = team ? TEAM_FILTER_OPTIONS.find((t) => t.label === team)?.code : undefined;
    setLoading(true);
    try {
      const r = await api<{ items: CalItem[] }>(
        "GET",
        `/calendar/events${queryString({
          from: from.toISOString(),
          to: to.toISOString(),
          scope: scope === "all" && !canViewAll ? "team" : scope,
          category: cats.join(","),
          status: Object.entries(STATUS_LABEL).find(([, l]) => l === status)?.[0],
          assigneeId: picId,
          team: teamKey,
          overdue: onlyOverdue ? "1" : undefined,
          q: q.trim() || undefined,
        })}`,
      );
      setItems(r.items ?? []);
    } catch (e: any) {
      toast(e?.message ?? "Gagal memuat kalender", "danger");
    } finally {
      setLoading(false);
    }
  }, [view, cursor, scope, cats, status, onlyOverdue, pic, team, q, canViewAll, data.users, toast]);

  React.useEffect(() => {
    const t = setTimeout(() => void load(), 150);
    return () => clearTimeout(t);
  }, [load]);

  function shift(dir: -1 | 1) {
    setCursor((c) => {
      if (view === "day") return addDays(c, dir);
      if (view === "week") return addDays(c, dir * 7);
      return new Date(c.getFullYear(), c.getMonth() + dir, 1);
    });
    if (view === "day") setSelected(ymd(addDays(parseYmd(selected), dir)));
  }

  function goToday() {
    const t = new Date();
    setCursor(t);
    setSelected(ymd(t));
  }

  function selectDay(k: string) {
    setSelected(k);
    if (view === "day") setCursor(parseYmd(k));
  }

  function openDay(k: string) {
    setSelected(k);
    setCursor(parseYmd(k));
    setView("day");
  }

  const overdueCount = items.filter((i) => i.isOverdue).length;
  const selectedList = React.useMemo(() => groupByDay(items)[selected] ?? [], [items, selected]);

  const scopeOptions = React.useMemo(() => {
    const opts = [
      { key: "me", label: "Agenda saya" },
      { key: "team", label: "Tim & Proyek saya" },
    ];
    if (canViewAll) {
      opts.push({ key: "all", label: "Semua perusahaan" });
    }
    return opts;
  }, [canViewAll]);

  const statusOptions = React.useMemo(() => [
    "Semua Status",
    ...Object.values(STATUS_LABEL),
  ], []);

  const categoryOptions = React.useMemo(() => [
    "Semua Kategori",
    ...CATEGORY_KEYS.map((k) => CATEGORY_META[k]!.label),
    `Overdue${overdueCount ? ` (${overdueCount})` : ""}`,
  ], [overdueCount]);

  const activeCategoryLabel = React.useMemo(() => {
    if (onlyOverdue) return `Overdue${overdueCount ? ` (${overdueCount})` : ""}`;
    if (cats.length === 0) return "Semua Kategori";
    if (cats.length === 1) return CATEGORY_META[cats[0] as any]?.label || "Kategori";
    return `${cats.length} Kategori Dipilih`;
  }, [onlyOverdue, overdueCount, cats]);

  return (
    <View className="gap-5">
      <PageHeader
        title="Kalender Kerja"
        subtitle={
          scope === "all" && canViewAll
            ? "Seluruh agenda, jadwal, dan deadline perusahaan"
            : scope === "team"
              ? "Agenda tim, proyek, dan kegiatan lintas anggota di mana saya terlibat"
              : "Agenda pribadi, tugas, dan kegiatan yang melibatkan saya"
        }
        action={
          <>
            {canConfigWa ? (
              <Button size="sm" variant="outline" onPress={() => setWaOpen(true)}>
                <MessageSquare size={14} color="#22c55e" />
                <Text className="text-xs">Notifikasi WA</Text>
              </Button>
            ) : null}
            <Button size="sm" onPress={() => { setEditId(null); setEditOccDate(undefined); setFormOpen(true); }}>
              <Plus size={15} color="#fff" />
              <Text className="text-xs">Buat agenda</Text>
            </Button>
          </>
        }
      />

      {isMobile ? (
        <View className="gap-2.5">
          {/* Search bar */}
          <View className="bg-card border-border/80 h-10 flex-row items-center gap-2 rounded-xl border px-3 shadow-sm">
            <Search size={15} color={colors.muted} />
            <Input
              value={q}
              onChangeText={setQ}
              placeholder="Cari agenda, klien, atau PIC..."
              className="h-8 flex-1 border-0 bg-transparent px-0 text-xs shadow-none outline-none"
            />
            {q ? (
              <Pressable onPress={() => setQ("")} hitSlop={8}>
                <X size={14} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>

          {/* Dropdown Filters Grid */}
          <View className="gap-2">
            <View className="flex-row gap-2">
              <View className="flex-1">
                <SearchableSelect
                  value={scopeOptions.find((s) => s.key === scope)?.label || "Scope"}
                  onChange={(val) => {
                    const match = scopeOptions.find((s) => s.label === val);
                    if (match) setScope(match.key as any);
                  }}
                  options={scopeOptions.map((s) => s.label)}
                  placeholder="Pilih Scope"
                  className="h-10 text-xs"
                />
              </View>
              <View className="flex-1">
                <SearchableSelect
                  value={status ? STATUS_LABEL[status as keyof typeof STATUS_LABEL] || status : "Semua Status"}
                  onChange={(val) => {
                    if (val === "Semua Status") {
                      setStatus("");
                    } else {
                      const matchKey = Object.entries(STATUS_LABEL).find(([, l]) => l === val)?.[0] || val;
                      setStatus(matchKey);
                    }
                  }}
                  options={statusOptions}
                  placeholder="Semua Status"
                  className="h-10 text-xs"
                />
              </View>
            </View>

            <View className="w-full">
              <SearchableSelect
                value={activeCategoryLabel}
                onChange={(val) => {
                  if (val.startsWith("Overdue")) {
                    setOnlyOverdue(true);
                    setCats([]);
                  } else if (val === "Semua Kategori") {
                    setCats([]);
                    setOnlyOverdue(false);
                  } else {
                    const foundKey = CATEGORY_KEYS.find((k) => CATEGORY_META[k]?.label === val);
                    if (foundKey) {
                      setCats([foundKey]);
                      setOnlyOverdue(false);
                    }
                  }
                }}
                options={categoryOptions}
                placeholder="Pilih Kategori"
                className="h-10 text-xs"
              />
            </View>

            {(scope === "team" || (canViewAll && scope === "all")) ? (
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <SearchableSelect
                    value={pic}
                    onChange={(v) => setPic(v === pic ? "" : v)}
                    options={userNames}
                    placeholder="Filter PIC"
                    className="h-10 text-xs"
                    clearable
                  />
                </View>
                <View className="flex-1">
                  <SearchableSelect
                    value={team}
                    onChange={(v) => setTeam(v === team ? "" : v)}
                    options={TEAM_FILTER_OPTIONS.filter((t) => t.code !== "").map((t) => t.label)}
                    placeholder="Filter Tim"
                    className="h-10 text-xs"
                    clearable
                  />
                </View>
              </View>
            ) : null}
          </View>
        </View>
      ) : (
        <>
          <FilterBar
            search={q}
            onSearch={setQ}
            placeholder="Cari agenda, klien, atau PIC..."
            right={
              <View className="flex-row flex-wrap gap-2">
                <Chip label="Agenda saya" active={scope === "me"} onPress={() => setScope("me")} />
                <Chip label="Tim & Proyek saya" active={scope === "team"} onPress={() => setScope("team")} />
                {canViewAll ? (
                  <Chip label="Semua perusahaan" active={scope === "all"} onPress={() => setScope("all")} />
                ) : null}
              </View>
            }
            statuses={Object.values(STATUS_LABEL)}
            status={status}
            onStatus={setStatus}
          />

          <View className="w-full min-w-0 flex-row flex-wrap gap-2 py-0.5">
            <Chip label="Semua kategori" active={cats.length === 0} onPress={() => setCats([])} />
            {CATEGORY_KEYS.map((k) => (
              <Chip
                key={k}
                label={CATEGORY_META[k]!.label}
                active={cats.includes(k)}
                onPress={() => setCats((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]))}
              />
            ))}
            <Chip label={`Overdue${overdueCount ? ` (${overdueCount})` : ""}`} active={onlyOverdue} onPress={() => setOnlyOverdue((v) => !v)} />
          </View>

          {(scope === "team" || (canViewAll && scope === "all")) ? (
            <View className="flex-row flex-wrap gap-3">
              <View className="w-64">
                <SearchableSelect value={pic} onChange={(v) => setPic(v === pic ? "" : v)} options={userNames} placeholder="Filter penanggung jawab (PIC)" />
              </View>
              <View className="w-64">
                <SearchableSelect
                  value={team}
                  onChange={(v) => setTeam(v === team ? "" : v)}
                  options={TEAM_FILTER_OPTIONS.filter((t) => t.code !== "").map((t) => t.label)}
                  placeholder="Filter tim / divisi"
                />
              </View>
            </View>
          ) : null}
        </>
      )}

      <Panel
        title={titleOf(view, cursor)}
        subtitle={loading ? "Memuat..." : `${items.length} aktivitas · Zona waktu WIB (UTC+7)`}
        right={
          isMobile ? (
            <View className="w-full gap-2.5 mt-2">
              {/* Row 1: View mode tabs - Full width segmented control */}
              <View className="flex-row items-center rounded-xl border border-border/80 bg-muted/60 p-1 w-full">
                {VIEWS.map((v) => {
                  const isActive = view === v.key;
                  return (
                    <Pressable
                      key={v.key}
                      onPress={() => setView(v.key)}
                      className={cn(
                        "flex-1 h-8 items-center justify-center rounded-lg transition-colors",
                        isActive ? "bg-primary shadow-xs" : "hover:bg-muted/40 active:bg-muted/60"
                      )}
                    >
                      <Text
                        className={cn(
                          "text-xs font-medium text-center",
                          isActive ? "text-primary-foreground font-bold" : "text-muted-foreground"
                        )}
                      >
                        {v.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Row 2: Navigasi Prev/Next Proporsional */}
              <View className="flex-row items-center justify-between gap-1.5 w-full">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 px-3 rounded-xl border-border/80 shrink-0"
                  onPress={() => shift(-1)}
                >
                  <ChevronLeft size={16} color={colors.text} />
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 flex-1 rounded-xl border-border/80 px-2"
                  onPress={goToday}
                >
                  <Text className="text-xs font-semibold">Hari ini</Text>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 flex-1 gap-1.5 px-2.5 rounded-xl border-border/80"
                  onPress={openJump}
                >
                  <CalendarIcon size={14} color={colors.text} />
                  <Text className="text-xs font-semibold" numberOfLines={1}>
                    Pilih tanggal
                  </Text>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 px-3 rounded-xl border-border/80 shrink-0"
                  onPress={() => shift(1)}
                >
                  <ChevronRight size={16} color={colors.text} />
                </Button>
              </View>
            </View>
          ) : (
            <>
              <View className="flex-row items-center rounded-lg border border-border/60 bg-muted/60 p-0.5">
                {VIEWS.map((v) => (
                  <Button
                    key={v.key}
                    size="sm"
                    variant={view === v.key ? "default" : "ghost"}
                    className="h-7 px-2.5"
                    onPress={() => setView(v.key)}
                  >
                    <Text className="text-xs">{v.label}</Text>
                  </Button>
                ))}
              </View>
              <Button size="sm" variant="outline" className="h-8 px-2" onPress={() => shift(-1)}>
                <ChevronLeft size={16} color={colors.text} />
              </Button>
              <Button size="sm" variant="outline" className="h-8" onPress={goToday}>
                <Text className="text-xs">Hari ini</Text>
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1.5 px-2.5" onPress={openJump}>
                <CalendarIcon size={14} color={colors.text} />
                <Text className="text-xs">Pilih bulan / tanggal</Text>
              </Button>
              <Button size="sm" variant="outline" className="h-8 px-2" onPress={() => shift(1)}>
                <ChevronRight size={16} color={colors.text} />
              </Button>
            </>
          )
        }
        pad={view === "day" || view === "agenda"}
      >
        {view === "month" ? (
          <MonthView cursor={cursor} items={items} selected={selected} onSelect={selectDay} onOpen={setDetail} />
        ) : view === "week" ? (
          <WeekView cursor={cursor} items={items} selected={selected} onSelect={openDay} onOpen={setDetail} />
        ) : view === "day" ? (
          <DayView day={selected} items={items} onOpen={setDetail} />
        ) : (
          <AgendaView items={items} onOpen={setDetail} />
        )}
      </Panel>

      {view === "month" ? (
        <Panel
          title={`Agenda ${parseYmd(selected).getDate()} ${BULAN_PANJANG[parseYmd(selected).getMonth()]}`}
          subtitle={`${selectedList.length} aktivitas`}
          right={
            <Button size="sm" variant="outline" className="h-8" onPress={() => openDay(selected)}>
              <Text className="text-xs">Lihat hari</Text>
            </Button>
          }
        >
          {selectedList.length ? (
            <View className={cn("gap-2")}>
              {selectedList.map((it) => <EventCard key={it.key} item={it} onPress={setDetail} />)}
            </View>
          ) : (
            <Text className="text-muted-foreground text-sm">Tidak ada agenda pada tanggal ini.</Text>
          )}
        </Panel>
      ) : null}

      <EventDetailDialog
        item={detail}
        onClose={() => setDetail(null)}
        onChanged={() => void load()}
        onEdit={(id, occDate) => { setEditId(id); setEditOccDate(occDate); setFormOpen(true); }}
      />
      <EventFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        eventId={editId}
        defaultDate={selected}
        occurrenceDate={editOccDate}
        onSaved={() => void load()}
      />

      <Dialog open={jumpOpen} onOpenChange={setJumpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Loncat ke Bulan / Tanggal</DialogTitle>
          </DialogHeader>

          <View className="gap-3">
            {/* Pemilih Tahun */}
            <View className="bg-panel/60 border-border flex-row items-center justify-between rounded-xl border px-2 py-1.5">
              <Pressable
                onPress={() => setJumpYear((y) => y - 1)}
                hitSlop={8}
                className="size-9 items-center justify-center rounded-lg hover:bg-card active:bg-card"
              >
                <ChevronLeft size={18} color={colors.text} />
              </Pressable>
              <Text className="text-sm font-bold text-foreground">Tahun {jumpYear}</Text>
              <Pressable
                onPress={() => setJumpYear((y) => y + 1)}
                hitSlop={8}
                className="size-9 items-center justify-center rounded-lg hover:bg-card active:bg-card"
              >
                <ChevronRight size={18} color={colors.text} />
              </Pressable>
            </View>

            {/* Grid 12 Bulan */}
            <View className="flex-row flex-wrap gap-1.5">
              {BULAN_PANJANG.map((namaBulan, mIdx) => {
                const active = mIdx === jumpMonth;
                return (
                  <Pressable
                    key={namaBulan}
                    onPress={() => setJumpMonth(mIdx)}
                    className={cn(
                      "w-[23%] grow items-center justify-center rounded-lg border py-2",
                      active
                        ? "border-primary bg-primary/15"
                        : "border-border bg-card hover:bg-panel"
                    )}
                  >
                    <Text
                      className={cn(
                        "text-xs",
                        active ? "font-bold text-primary" : "font-medium text-foreground"
                      )}
                    >
                      {namaBulan.slice(0, 3)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Grid Tanggal pada Bulan Terpilih */}
            <View className="border-border/60 border-t pt-2.5 gap-1">
              <View className="mb-1 flex-row items-center justify-between">
                <Text className="text-muted-foreground text-xs font-semibold">
                  Pilih tanggal di {BULAN_PANJANG[jumpMonth]} {jumpYear}
                </Text>
                <Button size="sm" variant="default" className="h-7 px-2.5" onPress={() => jumpToMonth(jumpYear, jumpMonth)}>
                  <Text className="text-[11px]">Buka {BULAN_PANJANG[jumpMonth]} {jumpYear}</Text>
                </Button>
              </View>

              <View className="flex-row">
                {HARI.map((d) => (
                  <View key={d} className="flex-1 items-center py-1">
                    <Text className="text-muted-foreground text-[11px] font-semibold">{d}</Text>
                  </View>
                ))}
              </View>

              {(() => {
                const firstDay = new Date(jumpYear, jumpMonth, 1);
                const startOffset = (firstDay.getDay() + 6) % 7;
                const daysInMonth = new Date(jumpYear, jumpMonth + 1, 0).getDate();
                const cells: (number | null)[] = [];
                for (let i = 0; i < startOffset; i++) cells.push(null);
                for (let d = 1; d <= daysInMonth; d++) cells.push(d);
                while (cells.length % 7 !== 0) cells.push(null);
                const todayKey = ymd(new Date());

                return Array.from({ length: cells.length / 7 }, (_, wIdx) => (
                  <View key={wIdx} className="flex-row">
                    {cells.slice(wIdx * 7, wIdx * 7 + 7).map((dayNum, di) => {
                      if (!dayNum) return <View key={`e-${di}`} className="flex-1 h-9" />;
                      const iso = ymd(new Date(jumpYear, jumpMonth, dayNum));
                      const isSel = iso === selected;
                      const isToday = iso === todayKey;
                      return (
                        <Pressable
                          key={iso}
                          onPress={() => jumpToDate(jumpYear, jumpMonth, dayNum)}
                          className={cn(
                            "m-0.5 h-9 flex-1 items-center justify-center rounded-lg",
                            isSel
                              ? "bg-primary"
                              : isToday
                                ? "border border-primary/60 bg-primary/10"
                                : "hover:bg-panel active:bg-panel"
                          )}
                        >
                          <Text
                            className={cn(
                              "text-xs font-medium",
                              isSel ? "font-bold text-primary-foreground" : isToday ? "font-bold text-primary" : "text-foreground"
                            )}
                          >
                            {dayNum}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ));
              })()}
            </View>
          </View>

          <DialogFooter>
            <Button variant="outline" onPress={() => setJumpOpen(false)}>
              <Text>Tutup</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {canConfigWa ? (
        <WhatsappDialog open={waOpen} onOpenChange={setWaOpen} initialTab="schedule" />
      ) : null}
    </View>
  );
}

