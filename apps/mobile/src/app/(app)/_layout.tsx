import * as React from "react";
import { Redirect, Slot, usePathname } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { AppShell } from "@/components/taska/app-shell";
import { useApp } from "@/store/app-store";
import { getAccess } from "@/services/api";

export default function AppLayout() {
  const { user, hydrated, logout, offline } = useApp();
  const pathname = usePathname();

  // Sesi habis (token dibersihkan oleh api layer): saat pindah halaman, lempar ke login.
  React.useEffect(() => {
    if (hydrated && user && !offline && !getAccess()) logout();
  }, [pathname, hydrated, user, offline, logout]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#191817" }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;
  return (
    <AppShell>
      <Slot />
    </AppShell>
  );
}
