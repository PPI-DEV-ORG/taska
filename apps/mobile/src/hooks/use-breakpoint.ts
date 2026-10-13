import { useWindowDimensions } from "react-native";

export type Breakpoint = "mobile" | "tablet" | "desktop";

export function useBreakpoint() {
  const { width } = useWindowDimensions();
  const bp: Breakpoint = width >= 1024 ? "desktop" : width >= 768 ? "tablet" : "mobile";
  return { width, bp, isMobile: bp === "mobile", isDesktop: bp === "desktop", isWide: bp !== "mobile" };
}
