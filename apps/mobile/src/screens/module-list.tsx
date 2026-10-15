import * as React from "react";
import { useRouter } from "expo-router";
import { ChevronRight, Plus, Trash2 } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { EmptyState, PageHeader } from "@/components/taska/basics";
import { DataTable, FilterBar } from "@/components/taska/data-table";
import { ConfirmDialog, FormDialog } from "@/components/taska/dialogs";
import { useApp } from "@/store/app-store";
import type { ModuleDef, Role, Row, User } from "@/constants/modules";
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
  users: ["bos", "admin"],
};

export function canCreate(def: ModuleDef, role: Role) {
  if (role === "super_admin") return !!(def.newHref || def.createFields);
  // PRD Aturan: Bos / Admin hanya melihat dan menyetujui, tanpa tombol buat, ubah, atau hapus
  if ((role === "bos" || role === "admin") && def.key !== "users") return false;
  return (def.createRoles ?? CREATE[def.key] ?? []).includes(role) && !!(def.newHref || def.createFields);
}

const DELETE: Record<string, Role[]> = {
  leads: ["sales", "pm", "admin"],
  projects: ["pm", "admin"],
  customers: ["sales", "admin"],
  suppliers: ["procurement", "admin"],
  users: ["bos", "admin"],
  surveys: ["sales", "pm", "admin"],
  quotations: ["sales", "pm", "finance", "admin"],
  "po-client": ["finance", "admin"],
  invoices: ["finance", "admin"],
  "purchase-requests": ["pm", "procurement", "finance", "gudang", "admin"],
  "supplier-pos": ["procurement", "finance", "admin"],
  receiving: ["gudang", "admin"],
  "delivery-notes": ["sales", "pm", "teknisi", "procurement", "finance", "gudang", "se", "admin"],
  expenses: ["sales", "pm", "teknisi", "procurement", "finance", "gudang", "se", "admin"],
  "damage-reports": ["gudang", "admin"],
};

function canDelete(def: ModuleDef, role: Role) {
  if (role === "super_admin") return true;
  return (DELETE[def.key] ?? []).includes(role);
}

function rowLabel(def: ModuleDef, row: Row): string {
  try {
    return def.titleOf(row) || row.name || row.nama || row.nomor || row.id;
  } catch {
    return String(row.name ?? row.nama ?? row.nomor ?? row.id);
  }
}

/** Batasi data yang dilihat per role (aturan lihat data di prompt bagian 6). */
export function scopeRows(def: ModuleDef, rows: Row[], u: User): Row[] {
  const role = (u.role || "").toLowerCase();
  if (role === "super_admin" || role === "finance" || role === "bos" || role === "admin") {
    if (def.key === "surveys") return rows;
  }
  const mine = (v: unknown) => String(v ?? "").includes(u.name);
  switch (def.key) {
    case "quotations":
      return role === "sales" ? rows.filter((r) => r.pemilik === u.name) : rows;
    case "projects":
      return ["pm", "teknisi", "se"].includes(role) ? rows.filter((r) => r.pm === u.name || mine(r.tim)) : rows;
    case "surveys":
      return ["teknisi", "se"].includes(role) ? rows.filter((r) => mine(r.tim)) : rows;
    case "delivery-notes":
      return ["bos", "admin", "finance", "gudang"].includes(role) ? rows : rows.filter((r) => r.pembuat === u.name);
    case "expenses":
      return ["bos", "admin", "finance"].includes(role) ? rows : rows.filter((r) => r.pelapor === u.name);
    default:
      return rows;
  }
}

function sortKey(r: Row): string {
  return String(r.tanggal ?? r.dibuat ?? r.waktu ?? r.jadwal ?? r.mulai ?? "") + r.id;
}

export function ModuleList({ def, title, headerExtra }: { def: ModuleDef; title?: string; headerExtra?: React.ReactNode }) {
  const router = useRouter();
  const { user, data, deleteRow } = useApp();
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Row | null>(null);

  const rows = React.useMemo(() => {
    const scoped = scopeRows(def, data[def.key] ?? [], user!);
    const s = q.trim().toLowerCase();
    return scoped
      .filter((r) => (!status || r[def.statusKey] === status))
      .filter((r) => !s || def.search.some((k) => String(r[k] ?? "").toLowerCase().includes(s)))
      .map((r) => {
        if (def.key === "quotations") {
          return {
            ...r,
            fileStatus: r.fileUploaded ? "Sudah Diupload" : "Belum Ada File",
          };
        }
        return r;
      })
      .sort((a, b) => (sortKey(a) < sortKey(b) ? 1 : -1));
  }, [def, data, user, q, status]);

  const allowed = canCreate(def, user!.role);
  const deleteAllowed = canDelete(def, user!.role);
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
        <DataTable
          columns={def.columns}
          rows={rows}
          onRowPress={(r) => router.push(`/${def.key}/${r.id}` as any)}
          actionsWidth={deleteAllowed ? 104 : 64}
          renderActions={deleteAllowed ? (r) => (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg hover:bg-panel"
                onPress={() => router.push(`/${def.key}/${r.id}` as any)}
              >
                <ChevronRight size={16} color={colors.muted} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg hover:bg-danger/10"
                onPress={() => setDeleteTarget(r)}
              >
                <Trash2 size={15} color={colors.danger} />
              </Button>
            </>
          ) : undefined}
        />
      )}
      {def.createFields ? <FormDialog def={def} open={open} onOpenChange={setOpen} /> : null}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={`Hapus ${def.singular.toLowerCase()} ini?`}
        description={`Data "${deleteTarget ? rowLabel(def, deleteTarget) : ""}" akan dihapus setelah kamu mengonfirmasi. Tindakan ini mengikuti aturan hapus dari server.`}
        confirmLabel="Ya, hapus"
        destructive
        onConfirm={() => {
          if (!deleteTarget) return;
          void deleteRow(def.key, deleteTarget.id).then((ok) => {
            if (ok) setDeleteTarget(null);
          });
        }}
      />
    </>
  );
}
