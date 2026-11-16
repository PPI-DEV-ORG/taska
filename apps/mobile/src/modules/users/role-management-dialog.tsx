import * as React from "react";
import { View, ScrollView, Pressable, Platform, Alert } from "react-native";
import { Shield, Plus, Trash2, RotateCcw, ChevronDown, ChevronRight, Search, Check, Lock } from "lucide-react-native";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { FormField } from "@/components/taska/basics";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";
import type { ActionCode, RoleDef } from "@/constants/modules";
import {
  ALL_ACTION_CODES,
  PERMISSION_ALIAS_TO_UI_KEY,
  getDefaultRoleDef,
  normalizePermissionMap,
} from "@/constants/modules";
import { STANDARD_ROLES } from "@/constants/role-matrix";

// ─────────────────────────────── Model ───────────────────────────────

type Perms = Record<string, ActionCode[]>;
type Level = "none" | "view" | "manage" | "full";

/** Level sederhana yang dipilih admin. Kombinasi lain ditampilkan sebagai "Kustom". */
const LEVELS: { id: Level; label: string; hint: string; actions: ActionCode[] }[] = [
  { id: "none", label: "Tidak", hint: "Tidak punya akses", actions: [] },
  { id: "view", label: "Lihat", hint: "Buka menu & lihat data", actions: ["M", "L"] },
  { id: "manage", label: "Kelola", hint: "Lihat + buat & ubah data", actions: ["M", "L", "C", "U"] },
  { id: "full", label: "Penuh", hint: "Semua, termasuk hapus, setujui, ekspor & harga", actions: [...ALL_ACTION_CODES] },
];

const ACTION_LABEL: Record<ActionCode, { label: string; hint: string }> = {
  M: { label: "Tampil di menu", hint: "Modul muncul di sidebar" },
  L: { label: "Lihat data", hint: "Baca data & dipakai di pilihan form" },
  C: { label: "Buat", hint: "Tambah data / dokumen baru" },
  U: { label: "Ubah", hint: "Edit data & ubah status" },
  A: { label: "Hapus / batal", hint: "Hapus atau batalkan dokumen" },
  P: { label: "Lihat harga & laba", hint: "HPP, margin, laba/rugi" },
  V: { label: "Setujui", hint: "Approve / tolak pengajuan" },
  E: { label: "Ekspor / cetak", hint: "PDF, Excel, E-Faktur" },
};

const MODULE_GROUPS: { group: string; items: { key: string; label: string; desc: string }[] }[] = [
  {
    group: "Penjualan & CRM",
    items: [
      { key: "leads", label: "Leads", desc: "Prospek & pipeline penjualan" },
      { key: "quotations", label: "Penawaran", desc: "Penawaran harga ke customer" },
      { key: "surveys", label: "Survey", desc: "Survey teknis lapangan" },
      { key: "poc-reports", label: "POC & Demo", desc: "Uji coba perangkat" },
      { key: "visit-reports", label: "Kunjungan", desc: "Laporan kunjungan / MoM" },
      { key: "customers", label: "Customer", desc: "Data pelanggan & PIC" },
      { key: "po-client", label: "Sales Order", desc: "PO masuk dari customer" },
    ],
  },
  {
    group: "Proyek & Pengiriman",
    items: [
      { key: "projects", label: "Project", desc: "Progres, BOQ & BAST" },
      { key: "tasks", label: "Tugas", desc: "Penugasan teknisi" },
      { key: "delivery-notes", label: "Surat Jalan", desc: "Pengiriman barang ke customer" },
    ],
  },
  {
    group: "Pembelian & Gudang",
    items: [
      { key: "purchase-requests", label: "Request Barang", desc: "Pengajuan pembelian / ambil stok" },
      { key: "supplier-pos", label: "PO Supplier", desc: "PO ke vendor & tagihan supplier" },
      { key: "shipments", label: "Pengiriman PO", desc: "Lacak barang dari supplier" },
      { key: "receiving", label: "Penerimaan Barang", desc: "Cek barang masuk & input SN" },
      { key: "stock", label: "Stok & SN", desc: "Kartu stok & serial number" },
      { key: "opname", label: "Stok Opname", desc: "Hitung fisik stok" },
      { key: "damage-reports", label: "Kerusakan & Retur", desc: "Barang rusak & klaim garansi" },
      { key: "suppliers", label: "Supplier", desc: "Data vendor" },
      { key: "warehouses", label: "Gudang", desc: "Lokasi penyimpanan" },
      { key: "products", label: "Produk & Jasa", desc: "Katalog & harga" },
    ],
  },
  {
    group: "Keuangan",
    items: [
      { key: "invoices", label: "Invoice", desc: "Tagihan ke customer & pembayaran" },
      { key: "expenses", label: "Pengeluaran", desc: "Biaya operasional & reimburse" },
      { key: "accounting", label: "Akuntansi", desc: "Jurnal, COA, tutup buku" },
      { key: "reports", label: "Laporan", desc: "Rekap & analitik" },
    ],
  },
  {
    group: "SDM",
    items: [{ key: "hr", label: "Absensi & Payroll", desc: "Kehadiran & slip gaji" }],
  },
  {
    group: "Sistem",
    items: [
      { key: "dashboard", label: "Dashboard", desc: "Ringkasan KPI" },
      { key: "calendar", label: "Kalender", desc: "Jadwal kerja" },
      { key: "approvals", label: "Persetujuan", desc: "Antrean approval dokumen" },
      { key: "master-data", label: "Master Data & Pengaturan", desc: "Termasuk atur hak akses ini" },
      { key: "users", label: "Pengguna", desc: "Akun & role pengguna" },
      { key: "archive", label: "Arsip", desc: "Berkas dokumen" },
      { key: "audit-log", label: "Audit Log", desc: "Jejak perubahan data" },
    ],
  },
];

const ALL_MODULE_KEYS = MODULE_GROUPS.flatMap((g) => g.items.map((i) => i.key));

const sameSet = (a: ActionCode[], b: ActionCode[]) => a.length === b.length && a.every((x) => b.includes(x));

function levelOf(acts: ActionCode[] = []): Level | "custom" {
  return LEVELS.find((l) => sameSet(l.actions, acts))?.id ?? "custom";
}

/** Izin role dalam kunci UI. Data server = sumber kebenaran; default hanya dipakai bila role belum punya data. */
function rolePerms(role?: RoleDef): Perms {
  if (!role) return {};
  const raw = role.permissions as Record<string, any> | undefined;
  const source = raw && typeof raw === "object" ? raw : getDefaultRoleDef(role.code)?.permissions;
  const norm = normalizePermissionMap(source);
  const out: Perms = {};
  // Kunci UI menang atas kunci alias lama bila keduanya ada
  for (const [k, v] of Object.entries(norm)) {
    const ui = PERMISSION_ALIAS_TO_UI_KEY[k];
    if (ui && !(ui in norm)) out[ui] = v;
    else if (!ui) out[k] = v;
  }
  return out;
}

function changedKeys(a: Perms, b: Perms): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].filter((k) => !sameSet(a[k] ?? [], b[k] ?? []));
}

/** Jumlah modul yang berbeda dari matriks standar (null = bukan peran bawaan). */
function diffFromStandard(code: string, perms: Perms): number | null {
  const std = STANDARD_ROLES[code];
  if (!std || code === "SUPER_ADMIN") return null;
  return changedKeys(perms, normalizePermissionMap(std.permissions)).length;
}

function confirmAsync(title: string, message: string, okLabel = "Ya, lanjutkan"): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(typeof window !== "undefined" ? window.confirm(`${title}\n\n${message}`) : true);
  }
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: "Batal", style: "cancel", onPress: () => resolve(false) },
      { text: okLabel, style: "destructive", onPress: () => resolve(true) },
    ]),
  );
}

// ─────────────────────────────── UI kecil ───────────────────────────────

function LevelPicker({
  value,
  onChange,
  disabled,
  compact,
}: {
  value: Level | "custom";
  onChange: (l: Level) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <View className="flex-row rounded-lg border border-border bg-panel/50 p-0.5" style={{ flexShrink: 0 }}>
      {LEVELS.map((l) => {
        const active = value === l.id;
        return (
          <Pressable
            key={l.id}
            disabled={disabled}
            onPress={() => onChange(l.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${l.label}: ${l.hint}`}
            className={cn(
              "rounded-md items-center justify-center",
              compact ? "px-2 min-h-[30px]" : "px-3 min-h-[34px]",
              active ? (l.id === "none" ? "bg-muted/60" : "bg-primary") : "",
            )}
          >
            <Text
              className={cn(
                "text-xs font-semibold",
                active ? (l.id === "none" ? "text-foreground" : "text-primary-foreground") : "text-muted-foreground",
              )}
            >
              {l.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ActionToggle({ code, checked, onPress }: { code: ActionCode; checked: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      className={cn(
        "flex-row items-center gap-1.5 rounded-full border px-2.5 min-h-[32px]",
        checked ? "border-primary bg-primary/15" : "border-border bg-card",
      )}
    >
      <View
        className={cn(
          "size-4 rounded-full items-center justify-center border",
          checked ? "bg-primary border-primary" : "border-muted-foreground/50",
        )}
      >
        {checked ? <Check size={10} color={colors.background} /> : null}
      </View>
      <Text className={cn("text-xs", checked ? "text-primary font-semibold" : "text-muted-foreground")}>
        {ACTION_LABEL[code].label}
      </Text>
    </Pressable>
  );
}

// ─────────────────────────────── Dialog ───────────────────────────────

export function RoleManagementDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { roles, saveRole, deleteRole, applyStandardRoles, toast } = useApp();
  const [selectedCode, setSelectedCode] = React.useState<string>("SALES");
  const [creatingNew, setCreatingNew] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newCode, setNewCode] = React.useState("");
  const [cloneFrom, setCloneFrom] = React.useState<string>("SALES");
  const [draftName, setDraftName] = React.useState("");
  const [draftDesc, setDraftDesc] = React.useState("");
  const [draftPerms, setDraftPerms] = React.useState<Perms>({});
  const [baseline, setBaseline] = React.useState<{ name: string; desc: string; perms: Perms }>({ name: "", desc: "", perms: {} });
  const [saving, setSaving] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [openGroups, setOpenGroups] = React.useState<Set<string>>(new Set([MODULE_GROUPS[0]!.group]));
  const [detailOpen, setDetailOpen] = React.useState<Set<string>>(new Set());
  const loadedRef = React.useRef<RoleDef | null>(null);

  const activeRole = React.useMemo(() => roles.find((r) => r.code === selectedCode) ?? roles[0], [roles, selectedCode]);
  const isSuperAdmin = !creatingNew && activeRole?.code === "SUPER_ADMIN";

  const changed = React.useMemo(() => changedKeys(draftPerms, baseline.perms), [draftPerms, baseline]);
  const metaChanged = !creatingNew && (draftName.trim() !== baseline.name || draftDesc.trim() !== baseline.desc);
  const dirty = creatingNew ? Boolean(newName.trim()) || changed.length > 0 : changed.length > 0 || metaChanged;

  // Peran bawaan yang tersimpan berbeda dari matriks standar terbaru
  const nonStandard = React.useMemo(
    () => roles.filter((r) => (diffFromStandard(r.code, rolePerms(r)) ?? 0) > 0),
    [roles],
  );
  const draftDiff = !creatingNew && activeRole ? diffFromStandard(activeRole.code, draftPerms) : null;

  async function handleApplyStandardAll() {
    if (!(await guardDiscard())) return;
    const names = nonStandard.map((r) => r.name).join(", ");
    if (!(await confirmAsync("Terapkan hak akses standar?", `Izin peran berikut akan diganti dengan standar: ${names}.\nPeran kustom tidak berubah.`, "Terapkan"))) return;
    setSaving(true);
    try {
      const updated = await applyStandardRoles();
      const fresh = updated?.find((r) => r.code === activeRole?.code);
      if (fresh) loadRole(fresh);
    } finally {
      setSaving(false);
    }
  }

  const loadRole = React.useCallback((role: RoleDef) => {
    const perms = rolePerms(role);
    setDraftName(role.name);
    setDraftDesc(role.description || "");
    setDraftPerms(perms);
    setBaseline({ name: role.name, desc: role.description || "", perms });
    setDetailOpen(new Set());
    loadedRef.current = role;
  }, []);

  // Muat draft saat dialog dibuka / ganti role / data role dari server berubah (hanya bila tidak ada edit yang belum disimpan)
  React.useEffect(() => {
    if (!open) {
      loadedRef.current = null;
      return;
    }
    if (creatingNew || !activeRole) return;
    const prev = loadedRef.current;
    if (!prev || prev.code !== activeRole.code || (prev !== activeRole && !dirty)) loadRole(activeRole);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, creatingNew, activeRole, loadRole]);

  async function guardDiscard(): Promise<boolean> {
    if (!dirty) return true;
    return confirmAsync("Buang perubahan?", "Ada perubahan hak akses yang belum disimpan.", "Buang");
  }

  async function selectRole(code: string) {
    if (code === activeRole?.code && !creatingNew) return;
    if (!(await guardDiscard())) return;
    setCreatingNew(false);
    loadedRef.current = null;
    setSelectedCode(code);
  }

  async function startCreateNew() {
    if (!(await guardDiscard())) return;
    const source = roles.find((r) => r.code === cloneFrom) ?? activeRole;
    setCreatingNew(true);
    setNewName("");
    setNewCode("");
    const perms = rolePerms(source);
    setDraftPerms(perms);
    setBaseline({ name: "", desc: "", perms: {} });
  }

  function pickTemplate(code: string) {
    setCloneFrom(code);
    setDraftPerms(rolePerms(roles.find((r) => r.code === code)));
  }

  async function handleClose(v: boolean) {
    if (!v && !(await guardDiscard())) return;
    if (!v) setCreatingNew(false);
    onOpenChange(v);
  }

  // ── Ubah izin ──
  const setModuleLevel = (key: string, level: Level) =>
    setDraftPerms((p) => ({ ...p, [key]: [...LEVELS.find((l) => l.id === level)!.actions] }));

  const setGroupLevel = (keys: string[], level: Level) =>
    setDraftPerms((p) => {
      const next = { ...p };
      for (const k of keys) next[k] = [...LEVELS.find((l) => l.id === level)!.actions];
      return next;
    });

  function toggleAction(key: string, code: ActionCode) {
    setDraftPerms((prev) => {
      const s = new Set<ActionCode>(prev[key] ?? []);
      if (s.has(code)) {
        s.delete(code);
        // Tanpa "Lihat data", aksi lain tidak bermakna
        if (code === "L") ALL_ACTION_CODES.forEach((c) => s.delete(c));
      } else {
        s.add(code);
        s.add("L");
      }
      return { ...prev, [key]: ALL_ACTION_CODES.filter((c) => s.has(c)) };
    });
  }

  function resetToDefault() {
    if (!activeRole) return;
    const def = getDefaultRoleDef(activeRole.code);
    if (!def) return;
    setDraftPerms(normalizePermissionMap(def.permissions));
    toast("Diisi dengan izin default. Tekan Simpan untuk menerapkan.", "info");
  }

  /** Kirim hanya modul yang punya akses + modul yang sebelumnya diatur lalu dikosongkan (agar pencabutan tersimpan). */
  function buildPayload(perms: Perms, base: Perms): Perms {
    const out: Perms = {};
    for (const k of new Set([...Object.keys(base), ...Object.keys(perms)])) {
      const acts = perms[k] ?? [];
      if (acts.length > 0 || k in base) out[k] = acts;
    }
    return out;
  }

  async function handleSave() {
    if (creatingNew) {
      if (!newName.trim()) {
        toast("Nama peran wajib diisi", "danger");
        return;
      }
      const code = (newCode.trim() || newName.trim()).toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
      if (roles.some((r) => r.code === code)) {
        toast(`Kode ${code} sudah dipakai, ganti nama atau kode`, "danger");
        return;
      }
      setSaving(true);
      try {
        const updated = await saveRole(
          { code, name: newName.trim(), description: `Peran kustom ${newName.trim()}`, permissions: buildPayload(draftPerms, {}) },
          false,
        );
        if (updated) {
          setCreatingNew(false);
          loadedRef.current = null;
          setSelectedCode(code);
        }
      } finally {
        setSaving(false);
      }
      return;
    }
    if (!activeRole) return;
    setSaving(true);
    try {
      const updated = await saveRole(
        {
          code: activeRole.code,
          name: draftName.trim() || activeRole.name,
          description: draftDesc.trim(),
          permissions: buildPayload(draftPerms, baseline.perms),
        },
        true,
      );
      const fresh = updated?.find((r) => r.code === activeRole.code);
      if (fresh) loadRole(fresh); // tampilkan persis apa yang tersimpan di server
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!activeRole || activeRole.isSystem) return;
    if (!(await confirmAsync(`Hapus peran "${activeRole.name}"?`, "Peran kustom ini akan dihapus permanen.", "Hapus"))) return;
    setSaving(true);
    try {
      const updated = await deleteRole(activeRole.code);
      if (updated?.length) {
        loadedRef.current = null;
        setSelectedCode(updated[0]!.code);
      }
    } finally {
      setSaving(false);
    }
  }

  // ── Turunan tampilan ──
  const q = query.trim().toLowerCase();
  const groups = MODULE_GROUPS.map((g) => ({
    ...g,
    items: q ? g.items.filter((i) => `${i.label} ${i.desc}`.toLowerCase().includes(q)) : g.items,
  })).filter((g) => g.items.length > 0);
  const activeCount = ALL_MODULE_KEYS.filter((k) => (draftPerms[k] ?? []).length > 0).length;

  const toggleGroup = (g: string) =>
    setOpenGroups((s) => {
      const n = new Set(s);
      if (n.has(g)) n.delete(g);
      else n.add(g);
      return n;
    });
  const toggleDetail = (k: string) =>
    setDetailOpen((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  return (
    <Dialog open={open} onOpenChange={(v) => void handleClose(v)}>
      <DialogContent
        className="w-[94vw] max-w-[760px] h-[86vh] max-h-[86vh] p-0 overflow-hidden flex flex-col"
        style={Platform.select({
          web: { width: "94vw", maxWidth: 760, height: "86vh", maxHeight: "86vh" } as any,
          default: { width: "94%", maxWidth: 760, maxHeight: "90%" },
        })}
      >
        {/* Header */}
        <DialogHeader style={{ flexShrink: 0 }} className="px-4 pt-4 pb-3 border-b border-border">
          <View className="flex-row items-center gap-2.5 pr-8">
            <View className="size-9 rounded-xl bg-primary/15 items-center justify-center">
              <Shield size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <DialogTitle className="text-base font-bold">Hak Akses Peran</DialogTitle>
              <Text className="text-xs text-muted-foreground">Pilih peran, lalu atur akses tiap modul.</Text>
            </View>
          </View>

          {/* Pilih role */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 12 }}>
            {roles.map((r) => {
              const active = !creatingNew && r.code === activeRole?.code;
              return (
                <Pressable
                  key={r.code}
                  onPress={() => void selectRole(r.code)}
                  className={cn(
                    "min-h-[34px] justify-center rounded-full border px-3",
                    active ? "border-primary bg-primary/15" : "border-border bg-card",
                  )}
                >
                  <Text className={cn("text-xs", active ? "text-primary font-semibold" : "text-foreground")}>
                    {r.name}
                    {!r.isSystem ? <Text className="text-[10px] text-muted-foreground"> · kustom</Text> : null}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => void startCreateNew()}
              className={cn(
                "min-h-[34px] flex-row items-center gap-1 rounded-full border border-dashed px-3",
                creatingNew ? "border-primary bg-primary/15" : "border-border",
              )}
            >
              <Plus size={13} color={colors.primary} />
              <Text className="text-xs text-primary font-semibold">Peran baru</Text>
            </Pressable>
          </ScrollView>
        </DialogHeader>

        <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          {nonStandard.length > 0 && !creatingNew ? (
            <View className="rounded-xl border border-warning/40 bg-warning/10 p-3 gap-2">
              <Text className="text-xs text-foreground">
                <Text className="text-xs font-semibold">{nonStandard.length} peran bawaan</Text> belum memakai hak akses standar terbaru:{" "}
                {nonStandard.map((r) => r.name).join(", ")}.
              </Text>
              <Button
                size="sm"
                variant="outline"
                onPress={() => void handleApplyStandardAll()}
                disabled={saving}
                style={{ alignSelf: "flex-start" }}
              >
                <Text className="text-xs font-semibold">Terapkan standar ke semua peran bawaan</Text>
              </Button>
            </View>
          ) : null}

          {/* Identitas role */}
          {creatingNew ? (
            <View className="rounded-xl border border-primary/30 bg-primary/5 p-3 gap-3">
              <View className="flex-row flex-wrap gap-3">
                <View style={{ flex: 1, minWidth: 200 }}>
                  <FormField label="Nama peran" required>
                    <Input value={newName} onChangeText={setNewName} placeholder="Mis. Supervisor Gudang" autoFocus />
                  </FormField>
                </View>
                <View style={{ flex: 1, minWidth: 200 }}>
                  <FormField label="Kode" hint="Opsional, otomatis dari nama">
                    <Input
                      value={newCode}
                      onChangeText={(v) => setNewCode(v.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))}
                      placeholder={newName ? newName.toUpperCase().replace(/[^A-Z0-9]+/g, "_") : "SUPERVISOR_GUDANG"}
                    />
                  </FormField>
                </View>
              </View>
              <View className="gap-1.5">
                <Text className="text-sm font-medium">Mulai dari izin peran</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {roles
                    .filter((r) => r.code !== "SUPER_ADMIN")
                    .map((r) => (
                      <Pressable
                        key={r.code}
                        onPress={() => pickTemplate(r.code)}
                        className={cn(
                          "min-h-[32px] justify-center rounded-full border px-3",
                          cloneFrom === r.code ? "border-primary bg-primary/15" : "border-border bg-card",
                        )}
                      >
                        <Text className={cn("text-xs", cloneFrom === r.code ? "text-primary font-semibold" : "text-foreground")}>
                          {r.name}
                        </Text>
                      </Pressable>
                    ))}
                </ScrollView>
              </View>
            </View>
          ) : activeRole ? (
            <View className="rounded-xl border border-border bg-panel/40 p-3 gap-3">
              <View className="flex-row flex-wrap items-center gap-2">
                <View style={{ flex: 1, minWidth: 160 }}>
                  <Text className="text-sm font-bold">{activeRole.name}</Text>
                  <Text className="text-[11px] text-muted-foreground">
                    {activeRole.isSystem ? "Peran bawaan" : "Peran kustom"} · {activeRole.code}
                    {draftDiff === 0 ? " · sesuai standar" : draftDiff ? ` · beda dari standar di ${draftDiff} modul` : ""}
                  </Text>
                </View>
                {activeRole.isSystem && !isSuperAdmin && draftDiff ? (
                  <Button size="sm" variant="ghost" onPress={resetToDefault} className="flex-row items-center gap-1.5">
                    <RotateCcw size={13} color={colors.textSecondary} />
                    <Text className="text-xs text-muted-foreground">Pakai standar</Text>
                  </Button>
                ) : null}
                {!activeRole.isSystem ? (
                  <Button size="sm" variant="ghost" onPress={() => void handleDelete()} disabled={saving} className="flex-row items-center gap-1.5">
                    <Trash2 size={13} color={colors.danger} />
                    <Text className="text-xs text-danger">Hapus peran</Text>
                  </Button>
                ) : null}
              </View>
              {!isSuperAdmin ? (
                <View className="flex-row flex-wrap gap-3">
                  <View style={{ flex: 1, minWidth: 180 }}>
                    <FormField label="Nama tampilan">
                      <Input value={draftName} onChangeText={setDraftName} />
                    </FormField>
                  </View>
                  <View style={{ flex: 2, minWidth: 220 }}>
                    <FormField label="Deskripsi">
                      <Input value={draftDesc} onChangeText={setDraftDesc} placeholder="Tugas singkat peran ini" />
                    </FormField>
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          {isSuperAdmin ? (
            <View className="rounded-xl border border-border bg-card p-4 flex-row items-center gap-3">
              <Lock size={18} color={colors.textSecondary} />
              <Text className="text-sm text-muted-foreground" style={{ flex: 1 }}>
                Super Admin selalu punya akses penuh ke semua modul dan tidak bisa dibatasi.
              </Text>
            </View>
          ) : (
            <>
              {/* Cari + ringkasan + legenda level */}
              <View className="gap-2">
                <View className="flex-row items-center gap-2 rounded-lg border border-border bg-card px-3">
                  <Search size={15} color={colors.textSecondary} />
                  <Input
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Cari modul… (mis. invoice, stok)"
                    className="flex-1 border-0 bg-transparent shadow-none px-0"
                  />
                </View>
                <Text className="text-[11px] text-muted-foreground">
                  {activeCount} dari {ALL_MODULE_KEYS.length} modul aktif · <Text className="text-[11px] font-semibold">Lihat</Text> = buka & baca ·{" "}
                  <Text className="text-[11px] font-semibold">Kelola</Text> = + buat & ubah · <Text className="text-[11px] font-semibold">Penuh</Text> = semua
                  aksi
                </Text>
              </View>

              {groups.map((g) => {
                const keys = g.items.map((i) => i.key);
                const isOpen = Boolean(q) || openGroups.has(g.group);
                const on = keys.filter((k) => (draftPerms[k] ?? []).length > 0).length;
                const groupLevel = (() => {
                  const lv = keys.map((k) => levelOf(draftPerms[k]));
                  return lv.every((x) => x === lv[0]) ? lv[0]! : "custom";
                })();
                return (
                  <View key={g.group} className="rounded-xl border border-border bg-card overflow-hidden">
                    <Pressable
                      onPress={() => toggleGroup(g.group)}
                      className="flex-row items-center gap-2 px-3 py-2.5"
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isOpen }}
                    >
                      {isOpen ? <ChevronDown size={16} color={colors.text} /> : <ChevronRight size={16} color={colors.text} />}
                      <View style={{ flex: 1 }}>
                        <Text className="text-sm font-semibold">{g.group}</Text>
                        <Text className="text-[11px] text-muted-foreground">
                          {on}/{keys.length} modul aktif
                        </Text>
                      </View>
                      {isOpen ? (
                        <View className="items-end gap-0.5">
                          <Text className="text-[10px] text-muted-foreground">Atur semua</Text>
                          <LevelPicker compact value={groupLevel} onChange={(l) => setGroupLevel(keys, l)} />
                        </View>
                      ) : null}
                    </Pressable>

                    {isOpen
                      ? g.items.map((m) => {
                          const acts = draftPerms[m.key] ?? [];
                          const lv = levelOf(acts);
                          const showDetail = detailOpen.has(m.key) || lv === "custom";
                          const isChanged = changed.includes(m.key);
                          return (
                            <View key={m.key} className="border-t border-border/60 px-3 py-2.5 gap-2">
                              <View className="flex-row flex-wrap items-center gap-2">
                                <View style={{ flex: 1, minWidth: 150 }}>
                                  <View className="flex-row items-center gap-1.5">
                                    <Text className="text-sm font-medium">{m.label}</Text>
                                    {isChanged ? <View className="size-1.5 rounded-full bg-warning" /> : null}
                                    {lv === "custom" ? (
                                      <View className="rounded bg-primary/15 px-1.5 py-0.5">
                                        <Text className="text-[10px] text-primary">Kustom</Text>
                                      </View>
                                    ) : null}
                                  </View>
                                  <Text className="text-[11px] text-muted-foreground">{m.desc}</Text>
                                </View>
                                <LevelPicker value={lv} onChange={(l) => setModuleLevel(m.key, l)} />
                              </View>

                              {acts.length > 0 || showDetail ? (
                                <Pressable onPress={() => toggleDetail(m.key)} hitSlop={6} style={{ alignSelf: "flex-start" }}>
                                  <Text className="text-[11px] text-primary">{showDetail ? "Sembunyikan detail" : "Atur detail"}</Text>
                                </Pressable>
                              ) : null}

                              {showDetail ? (
                                <View className="gap-1.5">
                                  <View className="flex-row flex-wrap gap-1.5">
                                    {ALL_ACTION_CODES.map((c) => (
                                      <ActionToggle key={c} code={c} checked={acts.includes(c)} onPress={() => toggleAction(m.key, c)} />
                                    ))}
                                  </View>
                                  {acts.includes("L") && !acts.includes("M") ? (
                                    <Text className="text-[11px] text-muted-foreground">
                                      Tidak tampil di menu, tapi datanya tetap bisa dipilih di form modul lain.
                                    </Text>
                                  ) : null}
                                </View>
                              ) : null}
                            </View>
                          );
                        })
                      : null}
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>

        {/* Footer */}
        <DialogFooter className="px-4 py-3 border-t border-border flex-row flex-wrap items-center gap-2" style={{ flexShrink: 0 }}>
          <View style={{ flex: 1, minWidth: 140 }}>
            {isSuperAdmin ? null : dirty ? (
              <Text className="text-xs text-warning font-medium">
                {creatingNew ? "Peran baru belum disimpan" : `${changed.length + (metaChanged ? 1 : 0)} perubahan belum disimpan`}
              </Text>
            ) : (
              <Text className="text-xs text-muted-foreground">Semua perubahan tersimpan</Text>
            )}
          </View>
          {dirty && !creatingNew ? (
            <Button variant="ghost" size="sm" onPress={() => activeRole && loadRole(activeRole)} disabled={saving}>
              <Text className="text-xs">Batalkan</Text>
            </Button>
          ) : null}
          {creatingNew ? (
            <Button variant="ghost" size="sm" onPress={() => { setCreatingNew(false); loadedRef.current = null; }} disabled={saving}>
              <Text className="text-xs">Batal</Text>
            </Button>
          ) : null}
          {!isSuperAdmin ? (
            <Button size="sm" onPress={() => void handleSave()} disabled={saving || !dirty}>
              <Text className="text-xs font-semibold">{saving ? "Menyimpan…" : creatingNew ? "Buat peran" : "Simpan"}</Text>
            </Button>
          ) : (
            <Button size="sm" variant="outline" onPress={() => onOpenChange(false)}>
              <Text className="text-xs">Tutup</Text>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
