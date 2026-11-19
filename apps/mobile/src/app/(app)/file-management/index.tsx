import * as React from "react";
import { FileManagementScreen } from "@/modules/file-management/file-management-screen";
import { EmptyState } from "@/components/taska/basics";
import { hasUserPermission } from "@/constants/modules";
import { useApp } from "@/store/app-store";

export default function FileManagementRoute() {
  const { user } = useApp();
  const isAllowed =
    hasUserPermission(user, "file-management", "M") ||
    hasUserPermission(user, "file-management", "L");

  if (!isAllowed) {
    return (
      <EmptyState
        title="Akses Ditolak"
        text="Akun kamu tidak memiliki akses untuk membuka modul Manajemen File."
      />
    );
  }

  return <FileManagementScreen />;
}
