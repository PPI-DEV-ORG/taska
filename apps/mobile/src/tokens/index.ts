let currentMode: "dark" | "light" = "dark";

export function setThemePalette(mode: "dark" | "light") {
  currentMode = mode;
}

export function getThemePalette(): "dark" | "light" {
  return currentMode;
}

const DARK_SURFACE = {
  background: "#181716",
  card: "#202222",
  panel: "#262A2D",
  border: "#2F353A",
  text: "#FFFFFF",
  textSecondary: "#A9B4BC",
  muted: "#7E8B95",
} as const;

const LIGHT_SURFACE = {
  background: "#F4F7F9",
  card: "#FFFFFF",
  panel: "#EBF0F4",
  border: "#D3DCE3",
  text: "#00254D",
  textSecondary: "#3B5266",
  muted: "#647A8C",
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
  get foreground() {
    return currentMode === "light" ? LIGHT_SURFACE.text : DARK_SURFACE.text;
  },
  get textMuted() {
    return currentMode === "light" ? LIGHT_SURFACE.textSecondary : DARK_SURFACE.textSecondary;
  },
  get mutedForeground() {
    return currentMode === "light" ? LIGHT_SURFACE.textSecondary : DARK_SURFACE.textSecondary;
  },
  get accent() {
    return currentMode === "light" ? "#01A481" : "#00C094";
  },
  get primary() {
    return currentMode === "light" ? "#01A481" : "#00C094";
  },
  get primaryForeground() {
    return currentMode === "light" ? "#FFFFFF" : "#071A16";
  },
  primaryHover: "#1AD4A8",
  primaryPressed: "#01A481",
  navy: "#023768",
  prussian: "#00254D",
  success: "#4CC38A",
  warning: "#F2B63C",
  danger: "#EF5350",
  info: "#4DA3FF",
};

export const chartSeries = [
  "#00C094",
  "#023768",
  "#01A481",
  "#4DA3FF",
  "#A78BFA",
  "#F2B63C",
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

