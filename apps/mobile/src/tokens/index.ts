export const colors = {
  background: "#191817",
  card: "#232220",
  panel: "#2D2B28",
  border: "#3A3834",
  text: "#F2EFE8",
  textSecondary: "#B5AFA3",
  muted: "#948F84",
  primary: "#EB5E28",
  primaryHover: "#FF7A45",
  primaryPressed: "#D14E1C",
  success: "#4CC38A",
  warning: "#F2B63C",
  danger: "#EF5350",
  info: "#4DA3FF",
} as const;

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
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  info: colors.info,
  neutral: colors.textSecondary,
};

/** Dokumen di atas nilai ini wajib juga disetujui Bos (pengaturan sistem). */
export const BOS_THRESHOLD = 10_000_000;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { card: 12, control: 8 };
