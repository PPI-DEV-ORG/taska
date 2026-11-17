import type { Role } from "@/constants/modules";

export type NotifRow = {
  id: string;
  jenis: "approval" | "stok" | "pengiriman" | "lead" | "tugas" | "surat";
  teks: string;
  waktu: string;
  baca: boolean;
  href: string;
  roles: Role[] | "all";
};

const NOTIF_KIND: Record<string, NotifRow["jenis"]> = {
  APPROVAL: "approval",
  STOK: "stok",
  PENGIRIMAN: "pengiriman",
  LEAD: "lead",
  TUGAS: "tugas",
  SURAT: "surat",
  LAINNYA: "approval",
};

/** Normalisasi href notifikasi dari backend agar sesuai dengan route Expo Router di mobile/web. */
export function normalizeNotifHref(href: string | null | undefined): string {
  if (!href) return "/";
  let h = href.trim();
  if (h.startsWith("/requests/")) {
    h = h.replace(/^\/requests\//, "/purchase-requests/");
  } else if (h.startsWith("/procurement/po/")) {
    h = h.replace(/^\/procurement\/po\//, "/supplier-pos/");
  } else if (h.startsWith("/receivings/")) {
    h = h.replace(/^\/receivings\//, "/receiving/");
  } else if (h.startsWith("/stock/opnames")) {
    h = "/stock";
  } else if (h.startsWith("/invoice-in/")) {
    h = "/supplier-pos";
  } else if (/^\/projects\/\d+\/tasks\/\d+/.test(h)) {
    const taskId = h.split("/").pop();
    h = `/tasks/${taskId}`;
  }
  return h;
}

export function adaptNotif(raw: any): NotifRow {
  return {
    id: String(raw.id),
    jenis: NOTIF_KIND[raw.kind] ?? "approval",
    teks: raw.text ?? raw.message ?? "",
    waktu: raw.createdAt ?? "",
    baca: !!raw.read,
    href: normalizeNotifHref(raw.href),
    roles: "all",
  };
}

export function adaptNotifList(list: any[] | undefined): NotifRow[] {
  return (list ?? []).map(adaptNotif);
}
