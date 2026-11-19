import * as React from "react";
import { FixedAssetsScreen } from "@/modules/fixed-assets/fixed-assets-screen";
import { EmptyState } from "@/components/akuntra/basics";
import { hasUserPermission } from "@/constants/modules";
import { useApp } from "@/store/app-store";

export default function FixedAssetsRoute() {
  const { user } = useApp();
  const isAllowed =
    hasUserPermission(user, "fixed-assets", "M") ||
    hasUserPermission(user, "fixed-assets", "L");

  if (!isAllowed) {
    return (
      <EmptyState
        title="Akses Ditolak"
        text="Akun kamu tidak memiliki akses untuk membuka modul Aset Tetap."
      />
    );
  }

  return <FixedAssetsScreen />;
}
