import { useLocalSearchParams } from "expo-router";
import { EmptyState } from "@/components/taska/basics";
import { ModuleList } from "@/screens/module-list";
import { MODULES } from "@/mock/modules";
import { useApp } from "@/store/app-store";

export default function ModuleIndex() {
  const { module } = useLocalSearchParams<{ module: string }>();
  const { user } = useApp();
  const def = MODULES[module as string];
  if (!def) return <EmptyState title="Halaman tidak ditemukan" text="Menu ini belum tersedia untuk akun kamu." />;
  const title = def.key === "projects" && (user!.role === "teknisi" || user!.role === "se") ? "Project saya" : undefined;
  return <ModuleList def={def} title={title} />;
}
