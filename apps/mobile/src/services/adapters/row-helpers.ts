export const n = (v: unknown): number => (v == null ? 0 : Number(v));
export const d = (v: unknown): string => (v ? String(v).slice(0, 10) : "");
export const nameOf = (x: any): string => x?.name ?? "";
export const idOf = (x: any): string | null =>
  x?.id != null ? String(x.id) : null;
