import "@/global.css";

import * as React from "react";
import { LogBox, Platform } from "react-native";
import { Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PortalHost } from "@rn-primitives/portal";
import { colorScheme } from "nativewind";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { configureReanimatedLogger, ReanimatedLogLevel } from "react-native-reanimated";

import { NAV_THEME } from "@/lib/theme";
import { AppProvider } from "@/store/app-store";

try {
  configureReanimatedLogger({
    level: ReanimatedLogLevel.warn,
    strict: false,
  });
} catch {}

LogBox.ignoreLogs([
  "[Reanimated] Reading from `value`",
  "[Reanimated] Writing to `value`",
]);

export default function RootLayout() {
  React.useEffect(() => {
    if (Platform.OS !== "web" || typeof window !== "undefined") {
      try {
        colorScheme.set("dark");
      } catch {}
    }
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.documentElement.classList.add("dark");
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={NAV_THEME.dark}>
        <AppProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#191817" } }} />
          <PortalHost />
        </AppProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
