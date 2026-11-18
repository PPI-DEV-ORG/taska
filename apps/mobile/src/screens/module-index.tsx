import { EmptyState } from "@/components/taska/basics";
import { ModuleList } from "@/screens/module-list";
import { IncomingShipments } from "@/modules/receiving/incoming-shipments";
import { MODULES, hasUserPermission } from "@/constants/modules";
import { useApp } from "@/store/app-store";

/** Halaman daftar modul generik. Dipakai rute dinamis `[module]` dan rute statis `<modul>/index`. */
export function ModuleIndexScreen({ moduleKey }: { moduleKey: string | undefined }) {
  const { user } = useApp();
  const def = moduleKey ? MODULES[moduleKey] : undefined;
  if (!def) return <EmptyState title="Halaman tidak ditemukan" text="Menu ini belum tersedia untuk akun kamu." />;

  const isAllowed = hasUserPermission(user, def.key, "M");
  if (!isAllowed) {
    return <EmptyState title="Akses Ditolak" text="Akun kamu tidak memiliki akses untuk membuka halaman ini." />;
  }

  const title = def.key === "projects" && (user!.role === "teknisi" || user!.role === "se") ? "Proyek saya" : undefined;
  // Penerimaan: barang yang sedang dikirim tampil di atas tabel
  const headerExtra = def.key === "receiving" ? <IncomingShipments /> : undefined;
  return <ModuleList def={def} title={title} headerExtra={headerExtra} />;
}
