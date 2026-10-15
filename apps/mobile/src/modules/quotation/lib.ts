import type { Row } from "@/constants/modules";

export type PpnMode = "exclude" | "include" | "none";

export const PPN_MODE_OPTIONS: { id: PpnMode; label: string }[] = [
  { id: "exclude", label: "Exclude PPN (11%)" },
  { id: "include", label: "Include PPN" },
  { id: "none", label: "No PPN" },
];

export function getInitialPpnMode(row: Row | null | undefined): PpnMode {
  if (!row) return "exclude";
  if (row.tipePpn === "Include PPN (Sudah termasuk)" || row.ppnMode === "include") return "include";
  if (
    row.tipePpn === "No PPN (Tanpa PPN)" ||
    row.ppnMode === "none" ||
    (row.ppn === 0 && ((row.disc ?? 0) > 0 || (row.total ?? 0) > 0 || (row.nilai ?? 0) > 0))
  )
    return "none";
  return "exclude";
}

export function ppnModeToTipe(mode: PpnMode): string {
  return mode === "exclude"
    ? "Exclude PPN (11%)"
    : mode === "include"
    ? "Include PPN (Sudah termasuk)"
    : "No PPN (Tanpa PPN)";
}

export function calcQuotationFinancials(nilaiRaw: unknown, discRaw: unknown, mode: PpnMode) {
  const totNum = Number(String(nilaiRaw).replace(/\D/g, "")) || 0;
  const discNum = Number(String(discRaw).replace(/\D/g, "")) || 0;
  const netBeforeTax = Math.max(0, totNum - discNum);
  const ppn = mode === "exclude" ? Math.round(netBeforeTax * 0.11) : 0;
  const totalAfterDisc = mode === "exclude" ? netBeforeTax + ppn : netBeforeTax;
  return { totNum, discNum, ppn, totalAfterDisc };
}

