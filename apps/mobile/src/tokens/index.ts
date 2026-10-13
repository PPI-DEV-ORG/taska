let currentMode: "dark" | "light" = "dark";

export function setThemePalette(mode: "dark" | "light") {
  currentMode = mode;
}

export function getThemePalette(): "dark" | "light" {
  return currentMode;
}

const DARK_SURFACE = {
  background: "#191817",
  card: "#232220",
  panel: "#2D2B28",
  border: "#3A3834",
  text: "#F2EFE8",
  textSecondary: "#B5AFA3",
  muted: "#948F84",
} as const;

const LIGHT_SURFACE = {
  background: "#F8F7F4",
  card: "#FFFFFF",
  panel: "#F0EEE9",
  border: "#DEDAD2",
  text: "#1C1A17",
  textSecondary: "#5C5852",
  muted: "#7A756D",
} as const;

export const colors = {
  get background() {
    return currentMode === "light" ? LIGHT_SURFACE.background : DARK_SURFACE.background;
  },
  get card() {
    return currentMode === "light" ? LIGHT_SURFACE.card : DARK_SURFACE.card;
  },
  get panel() {
    return currentMode === "light" ? LIGHT_SURFACE.panel : DARK_SURFACE.panel;
  },
  get border() {
    return currentMode === "light" ? LIGHT_SURFACE.border : DARK_SURFACE.border;
  },
  get text() {
    return currentMode === "light" ? LIGHT_SURFACE.text : DARK_SURFACE.text;
  },
  get textSecondary() {
    return currentMode === "light" ? LIGHT_SURFACE.textSecondary : DARK_SURFACE.textSecondary;
  },
  get muted() {
    return currentMode === "light" ? LIGHT_SURFACE.muted : DARK_SURFACE.muted;
  },
  primary: "#EB5E28",
  primaryHover: "#FF7A45",
  primaryPressed: "#D14E1C",
  success: "#4CC38A",
  warning: "#F2B63C",
  danger: "#EF5350",
  info: "#4DA3FF",
};

export const chartSeries = [
  "#EB5E28",
  "#4DA3FF",
  "#4CC38A",
  "#F2B63C",
  "#A78BFA",
  "#2DD4BF",
  "#F472B6",
  "#94A3B8",
];

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

export const toneColor: Record<Tone, string> = {
  success: "#4CC38A",
  warning: "#F2B63C",
  danger: "#EF5350",
  info: "#4DA3FF",
  get neutral() {
    return colors.textSecondary;
  },
};

/** Dokumen di atas nilai ini wajib juga disetujui Bos (pengaturan sistem). */
export const BOS_THRESHOLD = 10_000_000;

export const LEAD_STAGES = ["Prospecting", "Qualification", "Proposal", "Negotiation", "Won", "Lost"] as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { card: 12, control: 8 };

