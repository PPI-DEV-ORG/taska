const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Kembalikan tanggal bisnis WIB (UTC+7) dalam format YYYY-MM-DD. */
export function toWibDateIso(date: Date = new Date()): string {
  return new Date(date.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/** Kembalikan bulan bisnis WIB (UTC+7) dalam format YYYY-MM. */
export function toWibMonthIso(date: Date = new Date()): string {
  return new Date(date.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 7);
}
