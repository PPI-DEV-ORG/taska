import { Redirect, Slot } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { AppShell } from "@/components/taska/app-shell";
import { useApp } from "@/store/app-store";

export default function AppLayout() {
  const { user, hydrated } = useApp();
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
