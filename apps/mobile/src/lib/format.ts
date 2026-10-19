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

/** Bersihkan nomor HP menjadi format standar internasional 628xxx (tanpa +, tanpa spasi) */
export function cleanPhone(raw?: string | null): string {
  if (!raw) return "";
  let digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("0")) {
    digits = "62" + digits.slice(1);
  } else if (digits.startsWith("8")) {
    digits = "62" + digits;
  }
  return digits;
}

/** Format tampilan nomor telepon: +62 812-3456-7890 */
export function formatPhone(raw?: string | null): string {
  const p = cleanPhone(raw);
  if (!p) return raw ? String(raw) : "-";
  if (p.startsWith("62") && p.length >= 10) {
    const rest = p.slice(2);
    const p1 = rest.slice(0, 3);
    const p2 = rest.slice(3, 7);
    const p3 = rest.slice(7);
    return `+62 ${p1}-${p2}${p3 ? `-${p3}` : ""}`;
  }
  return `+${p}`;
}

/** Buat link WhatsApp langsung: https://wa.me/628xxx */
export function waLink(raw?: string | null): string {
  const p = cleanPhone(raw);
  return p ? `https://wa.me/${p}` : "";
}

/** Urutkan data secara menurun (terbaru ke terlama) berdasarkan tanggal/waktu, dengan fallback ke numeric ID */
export function compareDesc(a: any, b: any): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  // 1. Ekstrak timestamp/tanggal
  const dateA = a.createdAt || a.tanggal || a.dibuat || a.waktu || a.jadwal || a.mulai || a.date || a.updatedAt;
  const dateB = b.createdAt || b.tanggal || b.dibuat || b.waktu || b.jadwal || b.mulai || b.date || b.updatedAt;

  if (dateA && dateB) {
    const timeA = new Date(dateA).getTime();
    const timeB = new Date(dateB).getTime();
    if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
      return timeB - timeA; // terbaru di atas
    }
    if (String(dateA) !== String(dateB)) {
      const cmp = String(dateB).localeCompare(String(dateA));
      if (cmp !== 0) return cmp;
    }
  } else if (dateA && !dateB) {
    return -1;
  } else if (!dateA && dateB) {
    return 1;
  }

  // 2. Ekstrak numeric ID
  const rawIdA = a.rawId ?? a.id;
  const rawIdB = b.rawId ?? b.id;
  const numA = Number(String(rawIdA ?? "").replace(/\D/g, "")) || 0;
  const numB = Number(String(rawIdB ?? "").replace(/\D/g, "")) || 0;
  if (numA !== numB) {
    return numB - numA;
  }

  // 3. Fallback string ID
  return String(rawIdB ?? "").localeCompare(String(rawIdA ?? ""), undefined, { numeric: true });
}

