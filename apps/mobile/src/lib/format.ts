export const NOW = new Date("2026-10-08T14:00:00+07:00");

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export function rupiah(n: number | undefined | null): string {
  const v = Math.round(Number(n ?? 0));
  const s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${v < 0 ? "-" : ""}Rp ${s}`;
}

export function rupiahShort(n: number): string {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1).replace(".", ",")} M`;
  if (n >= 1_000_000) return `Rp ${Math.round(n / 1_000_000)} jt`;
  return rupiah(n);
}

export function number(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** "2026-10-08" -> "8 Okt 2026" */
export function tanggal(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00+07:00` : iso);
  if (isNaN(d.getTime())) return iso;
  const wib = new Date(d.getTime() + 7 * 3600_000);
  return `${wib.getUTCDate()} ${BULAN[wib.getUTCMonth()]} ${wib.getUTCFullYear()}`;
}

export function jam(iso: string): string {
  const d = new Date(iso);
  const wib = new Date(d.getTime() + 7 * 3600_000);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${p(wib.getUTCHours())}:${p(wib.getUTCMinutes())}`;
}

export function tanggalJam(iso: string): string {
  return `${tanggal(iso)}, ${jam(iso)}`;
}

export function waktuRelatif(iso: string): string {
  const diff = (NOW.getTime() - new Date(iso).getTime()) / 60000;
  if (diff < 1) return "baru saja";
  if (diff < 60) return `${Math.round(diff)} menit lalu`;
  if (diff < 1440) return `${Math.round(diff / 60)} jam lalu`;
  const days = Math.round(diff / 1440);
  return days === 1 ? "kemarin" : `${days} hari lalu`;
}

export function kelompokHari(iso: string): "Hari ini" | "Kemarin" | "Sebelumnya" {
  const diff = (NOW.getTime() - new Date(iso).getTime()) / 86400000;
  if (diff < 1) return "Hari ini";
  if (diff < 2) return "Kemarin";
  return "Sebelumnya";
}

export function daysFromNow(offset: number): string {
  return new Date(NOW.getTime() + offset * 86400000).toISOString().slice(0, 10);
}

export function hoursAgo(h: number): string {
  return new Date(NOW.getTime() - h * 3600_000).toISOString();
}
