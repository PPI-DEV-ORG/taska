import * as React from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname, useRouter } from "expo-router";
import { Maximize2, Sparkles } from "lucide-react-native";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { colors } from "@/tokens";
import type { AiPageContext } from "@/services/api";
import { AiAssistantScreen } from "./ai-assistant-screen";

const DETAIL_MODULES = new Set([
  "projects",
  "leads",
  "invoices",
  "quotations",
  "supplier-pos",
  "customers",
  "contracts",
  "subscriptions",
  "fixed-assets",
  "delivery-notes",
  "purchase-requests",
]);

function parsePageContext(pathname: string): AiPageContext | undefined {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length >= 2) {
    const mod = parts[0]!.toLowerCase();
    const id = parts[1]!;
    if (DETAIL_MODULES.has(mod) && /^\d+$/.test(id)) {
      return { pathname, module: mod, entityId: id };
    }
  }
  return pathname ? { pathname } : undefined;
}

export function AiFloatingDrawer() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const { isMobile } = useBreakpoint();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = React.useState(false);

  // Jangan tampilkan FAB jika sudah berada di halaman penuh Asisten AI
  if (pathname === "/ai-assistant" || pathname.startsWith("/ai-assistant/")) {
    return null;
  }

  const pageContext = parsePageContext(pathname);
  const hasDocContext = Boolean(pageContext?.module && pageContext?.entityId);
  // BottomTabs tingginya h-16 (64px) + insets.bottom; beri jarak 16px di atasnya agar tidak menutupi navbar
  const bottomOffset = isMobile ? 80 + insets.bottom : 24 + insets.bottom;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityLabel="Buka Asisten AI"
        style={{
          position: "absolute",
          right: isMobile ? 16 : 24,
          bottom: bottomOffset,
          zIndex: 40,
        }}
        className="bg-primary flex-row items-center gap-2 rounded-full px-4 py-3 shadow-lg active:opacity-85"
      >
        <Sparkles size={18} color="#ffffff" />
        <Text className="text-primary-foreground text-xs font-bold">
          {hasDocContext ? "Tanya Dokumen Ini" : "Asisten AI"}
        </Text>
      </Pressable>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <View className="flex-row items-center justify-between gap-2 pr-8">
              <DialogTitle>Asisten AI ERP</DialogTitle>
              <Pressable
                onPress={() => {
                  setOpen(false);
                  router.push("/ai-assistant" as never);
                }}
                className="flex-row items-center gap-1 rounded-lg px-2 py-1 hover:bg-panel"
              >
                <Maximize2 size={13} color={colors.muted} />
                <Text className="text-muted-foreground text-xs">Layar Penuh</Text>
              </Pressable>
            </View>
          </DialogHeader>
          <AiAssistantScreen
            compact
            pageContext={pageContext}
            onNavigate={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
