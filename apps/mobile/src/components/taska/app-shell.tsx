import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePathname, useRouter } from "expo-router";
import {
  Bell, Boxes, CheckSquare, CheckCheck, Ellipsis, FileSignature, ListChecks, LogOut, Menu, PanelLeftClose, Palette, Search,
  Target, Truck, WifiOff, X,
} from "lucide-react-native";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { useApp } from "@/store/app-store";
import { NAV_BY_ROLE, type NavItem } from "@/mock/modules";
import { ROLE_LABEL, SERIALS } from "@/mock/data";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { colors } from "@/tokens";
import { kelompokHari, waktuRelatif } from "@/lib/format";
import { cn } from "@/lib/utils";

const NOTIF_ICON = { approval: CheckSquare, stok: Boxes, pengiriman: Truck, lead: Target, tugas: ListChecks, surat: FileSignature };

function useNav() {
  const { user } = useApp();
  const pathname = usePathname();
  const items = NAV_BY_ROLE[user!.role];
  const active = (i: NavItem) => pathname === i.href || pathname.startsWith(i.href + "/");
  return { items, active, pathname };
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="bg-panel border-border/80 size-9 items-center justify-center rounded-xl border shadow-sm">
        <Text className="text-primary text-base font-black">T</Text>
      </View>
      {compact ? null : (
        <View className="flex-1">
          <Text className="text-base font-bold tracking-tight text-foreground">Taska</Text>
          <Text className="text-muted-foreground text-[11px] leading-tight">IT Solution & Integrator</Text>
        </View>
      )}
    </View>
  );
}

function Sidebar({ compact, onToggle }: { compact: boolean; onToggle?: () => void }) {
  const router = useRouter();
  const { user, logout, data } = useApp();
  const { items, active } = useNav();
  const recentProjects = data.projects.slice(0, 3);
  const dotColors = [colors.primary, colors.info, colors.warning];

  return (
    <View className="bg-card border-border/70 border-r" style={{ width: compact ? 76 : 256 }}>
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <View className="h-16 flex-row items-center justify-between px-4 border-b border-border/40">
          <Brand compact={compact} />
          {onToggle && !compact ? (
            <Pressable onPress={onToggle} hitSlop={10} className="size-8 items-center justify-center rounded-lg hover:bg-panel">
              <PanelLeftClose size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView className="flex-1 px-3" contentContainerClassName="gap-1 py-3" showsVerticalScrollIndicator={false}>
          {!compact ? (
            <Text className="text-[10px] font-bold tracking-wider text-muted-foreground/70 uppercase px-3 py-1.5">
              Navigation
            </Text>
          ) : null}

          {items.map((i) => {
            const on = active(i);
            const Icon = i.icon;
            return (
              <Pressable
                key={i.label}
                onPress={() => router.push(i.href as any)}
                className={cn(
                  "min-h-[42px] flex-row items-center gap-3 rounded-xl px-3 transition-colors",
                  on ? "bg-primary/15 text-primary font-semibold shadow-sm" : "hover:bg-panel/70 active:bg-panel",
                  compact && "justify-center px-0 min-h-[44px]"
                )}
              >
                <Icon size={18} color={on ? colors.primary : colors.textSecondary} />
                {compact ? null : (
                  <Text className={cn("text-sm", on ? "text-primary font-semibold" : "text-text-secondary")}>
                    {i.label}
                  </Text>
                )}
              </Pressable>
            );
          })}

          {!compact && recentProjects.length > 0 ? (
            <View className="mt-4 pt-3 border-t border-border/40 gap-1">
              <Text className="text-[10px] font-bold tracking-wider text-muted-foreground/70 uppercase px-3 py-1.5">
                Recent Projects
              </Text>
              {recentProjects.map((p, idx) => (
                <Pressable
                  key={p.id}
                  onPress={() => router.push(`/projects/${p.id}` as any)}
                  className="flex-row items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-panel/50 active:bg-panel"
                >
                  <View className="size-2 rounded-full" style={{ backgroundColor: dotColors[idx] ?? colors.primary }} />
                  <Text className="text-text-secondary text-xs font-medium flex-1" numberOfLines={1}>
                    {p.nama}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>

        <View className="border-border/60 border-t p-3 bg-panel/20">
          {compact ? (
            <Pressable onPress={logout} className="min-h-[44px] items-center justify-center rounded-xl hover:bg-panel">
              <LogOut size={18} color={colors.muted} />
            </Pressable>
          ) : (
            <View className="flex-row items-center gap-3">
              <View className="bg-panel border border-border/80 size-9 items-center justify-center rounded-xl">
                <Text className="text-sm font-bold text-foreground">{user!.name[0]}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>{user!.name}</Text>
                <Text className="text-muted-foreground text-[11px]" numberOfLines={1}>{ROLE_LABEL[user!.role]}</Text>
              </View>
              <Pressable onPress={logout} hitSlop={10} className="p-1.5 rounded-lg hover:bg-panel">
                <LogOut size={16} color={colors.muted} />
              </Pressable>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

function BottomTabs({ onMore }: { onMore: () => void }) {
  const router = useRouter();
  const { items, active } = useNav();
  const visible = items.length <= 5 ? items : items.slice(0, 4);
  const restActive = items.length > 5 && items.slice(4).some(active);
  return (
    <View className="bg-card border-border border-t">
      <SafeAreaView edges={["bottom"]}>
        <View className="h-16 flex-row">
          {visible.map((i) => {
            const on = active(i);
            const Icon = i.icon;
            return (
              <Pressable key={i.label} onPress={() => router.push(i.href as any)} className="flex-1 items-center justify-center gap-1">
                <Icon size={22} color={on ? colors.primary : colors.muted} />
                <Text className={cn("text-[11px]", on ? "text-primary font-semibold" : "text-muted-foreground")} numberOfLines={1}>{i.short ?? i.label}</Text>
              </Pressable>
            );
          })}
          {items.length > 5 ? (
            <Pressable onPress={onMore} className="flex-1 items-center justify-center gap-1">
              <Ellipsis size={22} color={restActive ? colors.primary : colors.muted} />
              <Text className={cn("text-[11px]", restActive ? "text-primary font-semibold" : "text-muted-foreground")}>Lainnya</Text>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

function SearchPanel({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const { data } = useApp();
  const [q, setQ] = React.useState("");
  const res = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    const out: { id: string; type: string; title: string; href: string }[] = [];
    data.leads.forEach((r) => r.nama.toLowerCase().includes(s) && out.push({ id: r.id, type: "Lead", title: r.nama, href: `/leads/${r.id}` }));
    data.projects.forEach((r) => r.nama.toLowerCase().includes(s) && out.push({ id: r.id, type: "Project", title: r.nama, href: `/projects/${r.id}` }));
    data.quotations.forEach((r) => r.nomor.toLowerCase().includes(s) && out.push({ id: r.id, type: "Penawaran", title: r.nomor, href: `/quotations/${r.id}` }));
    data.invoices.forEach((r) => r.nomor.toLowerCase().includes(s) && out.push({ id: r.id, type: "Invoice", title: r.nomor, href: `/invoices/${r.id}` }));
    data["delivery-notes"].forEach((r) => r.nomor.toLowerCase().includes(s) && out.push({ id: r.id, type: "Surat jalan", title: r.nomor, href: `/delivery-notes/${r.id}` }));
    SERIALS.forEach((r) => r.sn.toLowerCase().includes(s) && out.push({ id: r.id, type: "SN", title: `${r.sn} · ${r.produk}`, href: "/stock" }));
    return out.slice(0, 8);
  }, [q, data]);
  return (
    <View className="gap-3">
      <View className="bg-input border-border h-11 flex-row items-center gap-2 rounded-lg border px-3">
        <Search size={16} color={colors.muted} />
        <Input autoFocus value={q} onChangeText={setQ} placeholder="Cari lead, project, dokumen, atau SN" className="h-9 flex-1 border-0 bg-transparent px-0 shadow-none sm:h-9" />
      </View>
      {q.trim().length >= 2 && res.length === 0 ? <Text className="text-muted-foreground px-1 text-sm">Tidak ada hasil untuk &quot;{q}&quot;.</Text> : null}
      {res.map((r) => (
        <Pressable key={r.type + r.id} onPress={() => { onDone(); router.push(r.href as any); }} className="hover:bg-panel active:bg-panel min-h-[44px] flex-row items-center gap-3 rounded-lg px-2">
          <View className="bg-panel rounded-md px-2 py-0.5"><Text className="text-text-secondary text-[12px]">{r.type}</Text></View>
          <Text className="flex-1 text-sm" numberOfLines={1}>{r.title}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function NotifDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const { notifs, markRead, markAllRead } = useApp();
  const groups = ["Hari ini", "Kemarin", "Sebelumnya"] as const;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[94vw] max-w-[94vw] sm:max-w-2xl p-4 sm:p-6">
        <DialogHeader>
          <View className="flex-row items-center justify-between pr-8">
            <DialogTitle className="text-base sm:text-lg font-bold">Notifikasi</DialogTitle>
            <Pressable
              onPress={markAllRead}
              accessibilityLabel="Tandai semua dibaca"
              className="size-8 items-center justify-center rounded-lg hover:bg-panel active:bg-panel"
              hitSlop={8}
            >
              <CheckCheck size={18} color={colors.primary} />
            </Pressable>
          </View>
        </DialogHeader>
        <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
          {notifs.length === 0 ? <Text className="text-muted-foreground py-8 text-center text-sm">Belum ada notifikasi.</Text> : null}
          {groups.map((g) => {
            const list = notifs.filter((n) => kelompokHari(n.waktu) === g);
            if (!list.length) return null;
            return (
              <View key={g} className="mb-3">
                <Text className="text-muted-foreground py-2 text-[13px] font-medium">{g}</Text>
                {list.map((n) => {
                  const Icon = NOTIF_ICON[n.jenis];
                  return (
                    <Pressable
                      key={n.id}
                      onPress={() => { markRead(n.id); onOpenChange(false); router.push(n.href as any); }}
                      className="hover:bg-panel active:bg-panel flex-row items-start gap-3.5 rounded-xl px-3 py-3"
                    >
                      <View className="bg-panel size-10 items-center justify-center rounded-xl">
                        <Icon size={18} color={colors.textSecondary} />
                      </View>
                      <View className="flex-1 gap-1">
                        <Text className={cn("text-sm leading-snug", !n.baca ? "font-semibold text-foreground" : "text-muted-foreground")}>
                          {n.teks}
                        </Text>
                        <Text className="text-muted-foreground text-xs">{waktuRelatif(n.waktu)}</Text>
                      </View>
                      {!n.baca ? <View className="bg-primary mt-2 size-2 rounded-full" /> : null}
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      </DialogContent>
    </Dialog>
  );
}

function AccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const { user, logout, offline, setOffline } = useApp();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Akun</DialogTitle></DialogHeader>
        <View className="flex-row items-center gap-3">
          <View className="bg-panel size-12 items-center justify-center rounded-full"><Text className="text-lg font-semibold">{user!.name[0]}</Text></View>
          <View>
            <Text className="text-base font-semibold">{user!.name}</Text>
            <Text className="text-text-secondary text-sm">{ROLE_LABEL[user!.role]}</Text>
          </View>
        </View>
        <View className="border-border flex-row items-center justify-between rounded-lg border p-3">
          <View className="flex-1 pr-3">
            <Text className="text-sm font-medium">Simulasi tanpa koneksi</Text>
            <Text className="text-muted-foreground text-[13px]">Hanya untuk demo mode offline</Text>
          </View>
          <Switch checked={offline} onCheckedChange={setOffline} />
        </View>
        <Button variant="outline" onPress={() => { onOpenChange(false); router.push("/styleguide" as any); }}><Palette size={16} color={colors.text} /><Text>Panduan gaya</Text></Button>
        <Button variant="outline" onPress={() => { onOpenChange(false); logout(); }}><LogOut size={16} color={colors.text} /><Text>Keluar</Text></Button>
      </DialogContent>
    </Dialog>
  );
}

function MoreDialog({ open, onOpenChange, onNotif }: { open: boolean; onOpenChange: (v: boolean) => void; onNotif: () => void }) {
  const router = useRouter();
  const { items, active } = useNav();
  const rest = items.slice(4);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Menu lainnya</DialogTitle></DialogHeader>
        <ScrollView style={{ maxHeight: 420 }}>
          {rest.map((i) => {
            const Icon = i.icon;
            const on = active(i);
            return (
              <Pressable key={i.label} onPress={() => { onOpenChange(false); router.push(i.href as any); }} className={cn("min-h-[48px] flex-row items-center gap-3 rounded-lg px-2", on && "bg-primary/15")}>
                <Icon size={20} color={on ? colors.primary : colors.textSecondary} />
                <Text className={cn("text-base", on && "text-primary font-semibold")}>{i.label}</Text>
              </Pressable>
            );
          })}
          <Pressable onPress={() => { onOpenChange(false); onNotif(); }} className="min-h-[48px] flex-row items-center gap-3 rounded-lg px-2">
            <Bell size={20} color={colors.textSecondary} /><Text className="text-base">Notifikasi</Text>
          </Pressable>
        </ScrollView>
      </DialogContent>
    </Dialog>
  );
}

function Topbar({ onMenu, onNotif, onAccount }: { onMenu?: () => void; onNotif: () => void; onAccount: () => void }) {
  const { isMobile } = useBreakpoint();
  const { items, active } = useNav();
  const { unread, user } = useApp();
  const current = items.find(active)?.label ?? "Taska";
  return (
    <View className="bg-card/40 border-border/70 border-b" style={{ zIndex: 20 }}>
      <SafeAreaView edges={isMobile ? ["top"] : []}>
        <View className="h-16 flex-row items-center gap-3 px-4 md:px-6">
          {onMenu ? (
            <Pressable onPress={onMenu} hitSlop={10} className="p-2 rounded-lg hover:bg-panel">
              <Menu size={20} color={colors.textSecondary} />
            </Pressable>
          ) : null}
          {isMobile ? <Brand compact /> : null}

          <Text className="text-base font-bold text-foreground" numberOfLines={1}>
            {current}
          </Text>

          <View className="flex-1" />

          <Pressable onPress={onNotif} className="size-10 items-center justify-center rounded-xl hover:bg-panel relative">
            <Bell size={18} color={colors.textSecondary} />
            {unread > 0 ? (
              <View className="bg-primary absolute right-1.5 top-1.5 min-w-[16px] h-4 items-center justify-center rounded-full px-1">
                <Text className="text-primary-foreground text-[10px] font-bold">{unread}</Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable
            onPress={onAccount}
            className="bg-panel border border-border/80 size-9 items-center justify-center rounded-xl shadow-sm hover:border-primary/50"
          >
            <Text className="text-sm font-bold text-foreground">{user!.name[0]}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { offline } = useApp();
  const { bp, isMobile } = useBreakpoint();
  const [expanded, setExpanded] = React.useState(false);
  const [more, setMore] = React.useState(false);
  const [notif, setNotif] = React.useState(false);
  const [account, setAccount] = React.useState(false);
  const compact = bp === "tablet" && !expanded;

  return (
    <View className="bg-background flex-1 flex-row">
      {!isMobile ? <Sidebar compact={compact} onToggle={bp === "tablet" ? () => setExpanded(false) : undefined} /> : null}
      <View className="flex-1">
        <Topbar onMenu={bp === "tablet" ? () => setExpanded((v) => !v) : undefined} onNotif={() => setNotif(true)} onAccount={() => setAccount(true)} />
        {offline ? (
          <View className="bg-warning/15 flex-row items-center gap-2 px-4 py-2">
            <WifiOff size={16} color={colors.warning} />
            <Text className="text-warning flex-1 text-[13px]">Tidak ada koneksi. Catatan dan laporan akan dikirim saat tersambung</Text>
          </View>
        ) : null}
        <ScrollView className="flex-1" contentContainerClassName="w-full p-4 pb-12 md:p-6 lg:px-8 lg:py-6">
          {children}
        </ScrollView>
        {isMobile ? <BottomTabs onMore={() => setMore(true)} /> : null}
      </View>
      <MoreDialog open={more} onOpenChange={setMore} onNotif={() => setNotif(true)} />
      <NotifDialog open={notif} onOpenChange={setNotif} />
      <AccountDialog open={account} onOpenChange={setAccount} />
    </View>
  );
}
