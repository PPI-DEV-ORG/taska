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
import { AppProvider, useApp } from "@/store/app-store";

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

function NavigationShell() {
  const { theme } = useApp();

  React.useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.title = "Taska - Mini ERP";
      try {
        let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
        if (!link) {
          link = document.createElement("link");
          link.rel = "shortcut icon";
          document.head.appendChild(link);
        }
        link.type = "image/png";
        link.href = "/favicon.png";
      } catch {}
    }
  }, []);

  return (
    <ThemeProvider value={theme === "light" ? NAV_THEME.light : NAV_THEME.dark}>
      <StatusBar style={theme === "light" ? "dark" : "light"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme === "light" ? "#F8F7F4" : "#191817" },
        }}
      />
      <PortalHost />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
        <NavigationShell />
      </AppProvider>
    </GestureHandlerRootView>
  );
}

