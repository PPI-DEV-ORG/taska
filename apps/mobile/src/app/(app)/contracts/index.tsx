import { useLocalSearchParams } from "expo-router";
import { ContractsScreen } from "@/modules/contracts/contracts-screen";
import { EmptyState } from "@/components/taska/basics";
import { hasUserPermission } from "@/constants/modules";
import { useApp } from "@/store/app-store";

export default function ContractsRoute() {
  const { search } = useLocalSearchParams<{ search?: string }>();
  const { user } = useApp();
  const isAllowed =
    hasUserPermission(user, "contracts", "M") ||
    hasUserPermission(user, "contracts", "L");

  if (!isAllowed) {
    return (
      <EmptyState
        title="Akses Ditolak"
        text="Akun kamu tidak memiliki akses untuk membuka modul Manajemen Kontrak."
      />
    );
  }

  return <ContractsScreen initialSearch={search} />;
}
