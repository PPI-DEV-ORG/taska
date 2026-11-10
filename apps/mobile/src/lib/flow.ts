/**
 * Model alur dokumen (ala Accurate): urutan langkah, siapa penanggung jawab tiap langkah,
 * dan apa yang harus dikerjakan berikutnya. Murni data — tidak ada UI di sini.
 */

export type FlowOwner = "pemohon" | "finance" | "procurement" | "gudang" | "pm" | "sales" | "system";

export const OWNER_LABEL: Record<FlowOwner, string> = {
  pemohon: "Pemohon",
  finance: "Finance",
  procurement: "Procurement",
  gudang: "Gudang",
  pm: "PM",
  sales: "Sales",
  system: "Sistem",
};

/** Peran (role app) yang boleh mengerjakan langkah milik owner tertentu. */
const OWNER_ROLES: Record<FlowOwner, string[]> = {
  pemohon: [],
  finance: ["finance", "bos", "admin", "super_admin"],
  procurement: ["procurement", "admin", "super_admin"],
  gudang: ["gudang", "admin", "super_admin"],
  pm: ["pm", "admin", "super_admin"],
  sales: ["sales", "admin", "super_admin"],
  system: [],
};

export function canOwnerAct(owner: FlowOwner, role: string, isRequester = false) {
  if (owner === "pemohon") return isRequester || role === "admin" || role === "super_admin";
  return OWNER_ROLES[owner].includes(role);
}

export type FlowStepDef = {
  key: string;
  label: string;
  owner: FlowOwner;
  /** Langkah yang harus selesai dulu sebelum langkah ini bisa dikerjakan. */
  needs?: string[];
  /** Penjelasan singkat "apa yang dikerjakan di sini". */
  hint: string;
};

export type FlowStep = FlowStepDef & {
  done: boolean;
  /** Bisa dikerjakan sekarang (prasyarat terpenuhi, belum selesai). */
  actionable: boolean;
};

export type FlowResult = {
  steps: FlowStep[];
  /** Langkah yang bisa dikerjakan sekarang (bisa >1 bila paralel, mis. buat PO & bayar). */
  actionable: FlowStep[];
  complete: boolean;
  /** Dokumen berhenti (ditolak / dibatalkan). */
  stopped: null | { label: string; reason?: string };
};

export function evaluateFlow(
  defs: FlowStepDef[],
  doneKeys: Set<string>,
  stopped: FlowResult["stopped"] = null,
): FlowResult {
  const steps: FlowStep[] = defs.map((d) => {
    const done = doneKeys.has(d.key);
    const ready = (d.needs ?? []).every((k) => doneKeys.has(k));
    return { ...d, done, actionable: !stopped && !done && ready };
  });
  return {
    steps,
    actionable: steps.filter((s) => s.actionable),
    complete: steps.every((s) => s.done),
    stopped,
  };
}
