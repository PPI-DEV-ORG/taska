import { Redirect, Slot } from "expo-router";
import { AppShell } from "@/components/taska/app-shell";
import { useApp } from "@/store/app-store";

export default function AppLayout() {
  const { user } = useApp();
  if (!user) return <Redirect href="/login" />;
  return (
    <AppShell>
      <Slot />
    </AppShell>
  );
}
