import { useLocalSearchParams } from "expo-router";
import { MaintenanceScreen } from "@/modules/maintenance/maintenance-screen";
import { EmptyState } from "@/components/taska/basics";
import { hasUserPermission } from "@/constants/modules";
import { useApp } from "@/store/app-store";

export default function MaintenanceDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useApp();
  const isAllowed =
    hasUserPermission(user, "maintenance", "M") ||
    hasUserPermission(user, "maintenance", "L") ||
    hasUserPermission(user, "maintenance-reports", "M") ||
    hasUserPermission(user, "maintenanceReports", "M");

  if (!isAllowed) {
    return (
      <EmptyState
        title="Akses Ditolak"
        text="Akun kamu tidak memiliki akses untuk membuka modul Manajemen Maintenance."
      />
    );
  }

  return <MaintenanceScreen />;
}
