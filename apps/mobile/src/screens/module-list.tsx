import * as React from "react";
import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { EmptyState, PageHeader } from "@/components/taska/basics";
import { DataTable, FilterBar } from "@/components/taska/data-table";
import { FormDialog } from "@/components/taska/dialogs";
import { useApp } from "@/store/app-store";
import type { ModuleDef } from "@/mock/modules";
import type { Role, Row, User } from "@/mock/data";
import { colors } from "@/tokens";

const CREATE: Record<string, Role[]> = {
  leads: ["sales", "pm"],
  quotations: ["sales", "pm"],
  surveys: ["sales", "pm"],
  "po-client": ["finance"],
  invoices: ["finance"],
  projects: ["pm"],
  "damage-reports": ["gudang"],
  customers: ["sales"],
  suppliers: ["procurement"],
  users: ["bos"], // Admin terpisah di masa depan, saat ini bos hanya akun & audit log bila diperlukan
};

export function canCreate(def: ModuleDef, role: Role) {
  // PRD Aturan: Bos hanya melihat dan menyetujui, tanpa tombol buat, ubah, atau hapus
  if (role === "bos" && def.key !== "users") return false;
  return (def.createRoles ?? CREATE[def.key] ?? []).includes(role) && !!(def.newHref || def.createFields);
}

/** Batasi data yang dilihat per role (aturan lihat data di prompt bagian 6). */
export function scopeRows(def: ModuleDef, rows: Row[], u: User): Row[] {
  const mine = (v: unknown) => String(v ?? "").includes(u.name);
  switch (def.key) {
    case "quotations":
      return u.role === "sales" ? rows.filter((r) => r.pemilik === u.name) : rows;
    case "projects":
      return ["pm", "teknisi", "se"].includes(u.role) ? rows.filter((r) => r.pm === u.name || mine(r.tim)) : rows;
    case "surveys":
      return ["teknisi", "se"].includes(u.role) ? rows.filter((r) => mine(r.tim)) : rows;
    case "delivery-notes":
      return ["bos", "finance", "gudang"].includes(u.role) ? rows : rows.filter((r) => r.pembuat === u.name);
    case "expenses":
      return ["bos", "finance"].includes(u.role) ? rows : rows.filter((r) => r.pelapor === u.name);
    default:
      return rows;
  }
}

function sortKey(r: Row): string {
  return String(r.tanggal ?? r.dibuat ?? r.waktu ?? r.jadwal ?? r.mulai ?? "") + r.id;
}

export function ModuleList({ def, title, headerExtra }: { def: ModuleDef; title?: string; headerExtra?: React.ReactNode }) {
  const router = useRouter();
  const { user, data } = useApp();
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const rows = React.useMemo(() => {
    const scoped = scopeRows(def, data[def.key] ?? [], user!);
    const s = q.trim().toLowerCase();
    return scoped
      .filter((r) => (!status || r[def.statusKey] === status))
      .filter((r) => !s || def.search.some((k) => String(r[k] ?? "").toLowerCase().includes(s)))
      .sort((a, b) => (sortKey(a) < sortKey(b) ? 1 : -1));
  }, [def, data, user, q, status]);

  const allowed = canCreate(def, user!.role);
  const action = allowed ? (
    <Button onPress={() => (def.newHref ? router.push(def.newHref as any) : setOpen(true))}>
      <Plus size={16} color={colors.background} />
      <Text>{def.createLabel ?? `Tambah ${def.singular}`}</Text>
    </Button>
  ) : undefined;

  const isMasterOrSub = ["customers", "suppliers", "users"].includes(def.key);

  return (
    <>
      <PageHeader
        back={isMasterOrSub}
        title={title ?? def.title}
        subtitle={`${rows.length} data`}
        action={action}
      />
      {headerExtra}
      <FilterBar search={q} onSearch={setQ} statuses={def.statuses} status={status} onStatus={setStatus} />
      {rows.length === 0 ? (
        <EmptyState
          icon={def.icon}
          title={q || status ? "Tidak ada yang cocok" : `Belum ada ${def.singular.toLowerCase()}`}
          text={q || status ? "Coba ubah kata kunci atau filter status." : def.emptyText}
          actionLabel={q || status ? "Reset filter" : allowed ? def.createLabel : undefined}
          onAction={() => { if (q || status) { setQ(""); setStatus(""); } else if (def.newHref) router.push(def.newHref as any); else setOpen(true); }}
        />
      ) : (
        <DataTable columns={def.columns} rows={rows} onRowPress={(r) => router.push(`/${def.key}/${r.id}` as any)} />
      )}
      {def.createFields ? <FormDialog def={def} open={open} onOpenChange={setOpen} /> : null}
    </>
  );
}
