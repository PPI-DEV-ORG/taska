import * as React from "react";
import { Pressable, View } from "react-native";
import { Lock, RotateCcw, Save, ShieldCheck } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, Panel } from "@/components/taska/basics";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import { cn } from "@/lib/utils";

type Action = "L" | "C" | "U" | "A";
type ModuleMeta = { key: string; label: string; group: string; actions: Action[]; hint?: string };
type RoleRow = {
  role: string;
  label: string;
  locked: boolean;
  permissions: Record<string, string>;
  defaults: Record<string, string>;
};
type Matrix = { actions: Record<Action, string>; modules: ModuleMeta[]; roles: RoleRow[] };

const ORDER: Action[] = ["L", "C", "U", "A"];

/** Aturan sama dengan server: Buat/Ubah/Setujui otomatis menyertakan Lihat; mencabut Lihat mencabut semuanya. */
function toggle(current: string, action: Action, allowed: Action[]): string {
  const set = new Set(current.split("").filter((c) => allowed.includes(c as Action)));
  if (set.has(action)) {
    if (action === "L") set.clear();
    else set.delete(action);
  } else {
    set.add(action);
    if (allowed.includes("L")) set.add("L");
  }
  return ORDER.filter((a) => set.has(a)).join("");
}

/** Bandingkan hanya aksi yang tampil di layar. */
const visibleOf = (s: string | undefined, allowed: Action[] | undefined) =>
  ORDER.filter((a) => (allowed ?? []).includes(a) && (s ?? "").includes(a)).join("");

export default function RbacScreen() {
  const { user, toast, refreshPerms } = useApp();
  const [matrix, setMatrix] = React.useState<Matrix | null>(null);
  const [role, setRole] = React.useState<string>("ADMIN");
  const [draft, setDraft] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resetOpen, setResetOpen] = React.useState(false);

  const isSuper = user?.role === "super_admin";

  const load = React.useCallback(async () => {
    try {
      const m = await api<Matrix>("GET", "/rbac/matrix");
      if (!Array.isArray(m?.modules) || !Array.isArray(m?.roles) || m.modules.some((x) => !Array.isArray(x.actions))) {
        throw new Error("Data hak akses dari server tidak lengkap. Pastikan API sudah di-restart dengan versi terbaru.");
      }
      setMatrix(m);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Gagal memuat hak akses");
    }
  }, []);
  React.useEffect(() => {
    if (isSuper) void load();
  }, [isSuper, load]);

  const current = matrix?.roles.find((r) => r.role === role);
  // draft dikosongkan setiap ganti peran / data baru dari server
  React.useEffect(() => setDraft({}), [role, matrix]);

  const valueOf = (m: ModuleMeta) => draft[m.key] ?? current?.permissions[m.key] ?? "";
  const changed = React.useMemo(
    () => (matrix?.modules ?? []).filter((m) => draft[m.key] !== undefined && visibleOf(draft[m.key]!, m.actions) !== visibleOf(current?.permissions[m.key] ?? "", m.actions)),
    [draft, matrix, current],
  );

  function onToggle(m: ModuleMeta, a: Action) {
    if (!current || current.locked) return;
    setDraft((d) => ({ ...d, [m.key]: toggle(d[m.key] ?? current.permissions[m.key] ?? "", a, m.actions) }));
  }

  async function save() {
    if (!current || !changed.length) return;
    setSaving(true);
    try {
      const body = Object.fromEntries(changed.map((m) => [m.key, draft[m.key]!]));
      const m = await api<Matrix>("PUT", `/rbac/roles/${current.role}`, { permissions: body });
      setMatrix(m);
      toast(`Hak akses ${current.label} disimpan. Berlaku langsung.`);
      void refreshPerms();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menyimpan hak akses", "danger");
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!current) return;
    setSaving(true);
    try {
      const m = await api<Matrix>("POST", `/rbac/roles/${current.role}/reset`, {});
      setMatrix(m);
      setResetOpen(false);
      toast(`Hak akses ${current.label} dikembalikan ke pengaturan bawaan.`);
      void refreshPerms();
    } catch (e: any) {
      toast(e?.message ?? "Gagal mengembalikan hak akses", "danger");
    } finally {
      setSaving(false);
    }
  }

  if (!isSuper) {
    return (
      <View className="gap-4">
        <PageHeader title="Hak Akses" subtitle="Atur apa yang boleh dilakukan tiap peran" />
        <View className="items-center gap-2 rounded-xl border border-border bg-card p-8">
          <Lock size={22} color="#94a3b8" />
          <Text className="text-sm text-muted-foreground">Hanya Super Admin yang dapat mengatur hak akses.</Text>
        </View>
      </View>
    );
  }

  const groups = Array.from(new Set((matrix?.modules ?? []).map((m) => m.group)));
  const diffFromDefault = (m: ModuleMeta) =>
    current ? visibleOf(valueOf(m), m.actions) !== visibleOf(current.defaults[m.key] ?? "", m.actions) : false;
  const customCount = (matrix?.modules ?? []).filter(diffFromDefault).length;

  return (
    <View className="gap-4 pb-12">
      <PageHeader
        title="Hak Akses"
        subtitle="Atur apa yang boleh dilakukan tiap peran. Perubahan berlaku langsung tanpa login ulang. Super Admin selalu penuh."
      />

      {error ? (
        <View className="rounded-xl border border-destructive/40 bg-destructive/10 p-4">
          <Text className="text-sm text-destructive">{error}</Text>
          <Button size="sm" variant="outline" className="mt-2 self-start" onPress={() => void load()}>
            <Text className="text-xs">Coba lagi</Text>
          </Button>
        </View>
      ) : null}

      {/* Pilih peran */}
      <View className="flex-row flex-wrap gap-2">
        {(matrix?.roles ?? []).map((r) => {
          const active = r.role === role;
          return (
            <Pressable
              key={r.role}
              onPress={() => setRole(r.role)}
              className={cn("flex-row items-center gap-1.5 rounded-full border px-3.5 py-1.5", active ? "border-primary bg-primary" : "border-border bg-card")}
            >
              {r.locked ? <Lock size={11} color={active ? "#fff" : "#94a3b8"} /> : null}
              <Text className={cn("text-sm font-semibold", active ? "text-white" : "text-foreground")}>{r.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {current?.locked ? (
        <View className="flex-row items-center gap-2 rounded-xl border border-border bg-muted p-3">
          <ShieldCheck size={16} color="#10b981" />
          <Text className="flex-1 text-xs text-muted-foreground">
            Super Admin selalu memiliki semua hak akses dan tidak bisa diubah, supaya tidak ada yang terkunci dari sistem.
          </Text>
        </View>
      ) : (
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <Text className="text-xs text-muted-foreground">
            {customCount > 0 ? `${customCount} modul berbeda dari pengaturan bawaan` : "Sama dengan pengaturan bawaan"}
            {changed.length ? ` · ${changed.length} perubahan belum disimpan` : ""}
          </Text>
          <View className="flex-row gap-2">
            <Button size="sm" variant="outline" onPress={() => setDraft({})} disabled={!changed.length || saving}>
              <Text className="text-xs">Batalkan</Text>
            </Button>
            <Button size="sm" variant="outline" onPress={() => setResetOpen(true)} disabled={saving || customCount === 0}>
              <RotateCcw size={13} />
              <Text className="text-xs">Kembalikan ke bawaan</Text>
            </Button>
            <Button size="sm" onPress={() => void save()} disabled={!changed.length || saving}>
              <Save size={13} color="#fff" />
              <Text className="text-xs font-semibold text-white">{saving ? "Menyimpan..." : "Simpan perubahan"}</Text>
            </Button>
          </View>
        </View>
      )}

      {/* Matriks per kelompok */}
      {current
        ? groups.map((g) => (
            <Panel key={g} title={g}>
              <View>
                {(matrix?.modules ?? [])
                  .filter((m) => m.group === g)
                  .map((m) => {
                    const val = valueOf(m);
                    const edited = draft[m.key] !== undefined && changed.includes(m);
                    return (
                      <View key={m.key} className="gap-2 border-b border-border/60 py-3">
                        <View className="flex-row flex-wrap items-center gap-2">
                          <Text className="text-sm font-semibold">{m.label}</Text>
                          {edited ? (
                            <View className="rounded bg-amber-500/20 px-1.5 py-0.5">
                              <Text className="text-[10px] font-bold text-amber-700 dark:text-amber-400">DIUBAH</Text>
                            </View>
                          ) : diffFromDefault(m) ? (
                            <View className="rounded bg-sky-500/15 px-1.5 py-0.5">
                              <Text className="text-[10px] font-bold text-sky-700 dark:text-sky-400">BEDA DARI BAWAAN</Text>
                            </View>
                          ) : null}
                        </View>
                        {m.hint ? <Text className="text-xs text-muted-foreground">{m.hint}</Text> : null}
                        <View className="flex-row flex-wrap gap-2">
                          {m.actions.map((a) => {
                            const on = val.includes(a);
                            return (
                              <Pressable
                                key={a}
                                disabled={current.locked}
                                onPress={() => onToggle(m, a)}
                                className={cn(
                                  "min-h-[36px] flex-row items-center gap-1.5 rounded-lg border px-3 py-1.5",
                                  on ? "border-emerald-600 bg-emerald-600/15" : "border-border bg-card",
                                  current.locked && "opacity-60",
                                )}
                              >
                                <View className={cn("h-4 w-4 items-center justify-center rounded border", on ? "border-emerald-600 bg-emerald-600" : "border-border")}>
                                  {on ? <Text className="text-[10px] font-bold text-white">✓</Text> : null}
                                </View>
                                <Text className={cn("text-xs font-semibold", on ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
                                  {matrix!.actions[a]}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })}
              </View>
            </Panel>
          ))
        : null}

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Kembalikan ke pengaturan bawaan?</DialogTitle>
            <DialogDescription>
              Semua hak akses peran {current?.label} akan dikembalikan seperti pengaturan awal aplikasi. Perubahan berlaku langsung.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onPress={() => setResetOpen(false)} disabled={saving}>
              <Text>Batal</Text>
            </Button>
            <Button variant="destructive" onPress={() => void reset()} disabled={saving}>
              <Text>Ya, kembalikan</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  );
}
