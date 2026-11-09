import { useLocalSearchParams } from "expo-router";
import { EmptyState } from "@/components/taska/basics";
import { ModuleList } from "@/screens/module-list";
import { MODULES, NAV_BY_ROLE, type Role } from "@/constants/modules";
import { useApp } from "@/store/app-store";

export default function ModuleIndex() {
  const { module } = useLocalSearchParams<{ module: string }>();
  const { user } = useApp();
  const def = MODULES[module as string];
  if (!def) return <EmptyState title="Halaman tidak ditemukan" text="Menu ini belum tersedia untuk akun kamu." />;

  const userRole = (user?.role || "").toLowerCase() as Role;
  const isSuperOrAdmin = ["super_admin", "admin", "bos"].includes(userRole);
  const navItems = userRole && NAV_BY_ROLE[userRole] ? NAV_BY_ROLE[userRole] : [];
  const allowedKeys = new Set(navItems.map((n) => n.key));
  const isAllowed = isSuperOrAdmin || allowedKeys.has(def.key);

  if (!isAllowed) {
    return <EmptyState title="Akses Ditolak" text="Akun kamu tidak memiliki akses untuk membuka halaman ini." />;
  }

  const title = def.key === "projects" && (user!.role === "teknisi" || user!.role === "se") ? "Project saya" : undefined;
  return <ModuleList def={def} title={title} />;
}
