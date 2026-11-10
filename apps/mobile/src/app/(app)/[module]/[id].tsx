import { useLocalSearchParams } from "expo-router";
import { ModuleDetail } from "@/screens/module-detail";
import { MODULES, hasUserPermission } from "@/constants/modules";
import { useApp } from "@/store/app-store";
import { EmptyState } from "@/components/taska/basics";

export default function ModuleDetailRoute() {
  const { module, id } = useLocalSearchParams<{ module: string; id: string }>();
  const { user } = useApp();
  const def = MODULES[module as string];
  if (!def) return <EmptyState title="Halaman tidak ditemukan" text="Menu ini belum tersedia untuk akun kamu." />;

  const isAllowed = hasUserPermission(user, def.key, "M") || hasUserPermission(user, def.key, "L");

  if (!isAllowed) {
    return <EmptyState title="Akses Ditolak" text="Akun kamu tidak memiliki akses untuk membuka halaman ini." />;
  }

  return <ModuleDetail moduleKey={module as string} id={id as string} />;
}
