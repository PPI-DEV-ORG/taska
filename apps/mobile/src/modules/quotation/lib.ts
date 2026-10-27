import type { Row } from "@/constants/modules";

export type PpnMode = "exclude" | "include" | "none";

export type PphMode = "none" | "pph21" | "pph23" | "pph4_2" | "pph22";

export const PPN_MODE_OPTIONS: { id: PpnMode; label: string }[] = [
  { id: "exclude", label: "Exclude PPN (11%)" },
  { id: "include", label: "Include PPN" },
  { id: "none", label: "No PPN" },
];

export const PPH_MODE_OPTIONS: { id: PphMode; label: string; rate: number; desc: string }[] = [
  { id: "none", label: "Tanpa PPh", rate: 0, desc: "Tidak ada pemotongan PPh (0%)" },
  { id: "pph23", label: "PPh 23 (2%)", rate: 0.02, desc: "Jasa Teknik / IT / Instalasi Badan (2%)" },
  { id: "pph4_2", label: "PPh 4(2) (1.75%)", rate: 0.0175, desc: "Jasa Konstruksi / Renovasi (1.75%)" },
  { id: "pph21", label: "PPh 21 (2.5%)", rate: 0.025, desc: "Jasa Tenaga Ahli / Orang Pribadi (2.5%)" },
  { id: "pph22", label: "PPh 22 (1.5%)", rate: 0.015, desc: "Pembelian Instansi Pemerintah / BUMN (1.5%)" },
];

export function pphRateFor(mode: PphMode): number {
  const opt = PPH_MODE_OPTIONS.find((o) => o.id === mode);
  return opt ? opt.rate : 0;
}

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

export function getInitialPphMode(row: Row | null | undefined): PphMode {
  if (!row) return "none";
  if (row.pphMode) return row.pphMode as PphMode;
  if (row.tipePph) {
    const t = String(row.tipePph).toLowerCase();
    if (t.includes("23")) return "pph23";
    if (t.includes("4") || t.includes("konstruksi")) return "pph4_2";
    if (t.includes("21")) return "pph21";
    if (t.includes("22")) return "pph22";
  }
  return "none";
}

export function pphModeToTipe(mode: PphMode): string {
  const opt = PPH_MODE_OPTIONS.find((o) => o.id === mode);
  return opt ? opt.label : "Tanpa PPh";
}

export function calcQuotationFinancials(
  nilaiRaw: unknown,
  discRaw: unknown,
  ppnMode: PpnMode = "exclude",
  pphMode: PphMode = "none"
) {
  const totNum = Number(String(nilaiRaw).replace(/\D/g, "")) || 0;
  const discNum = Number(String(discRaw).replace(/\D/g, "")) || 0;
  const netBeforeTax = Math.max(0, totNum - discNum);
  const ppn = ppnMode === "exclude" ? Math.round(netBeforeTax * 0.11) : 0;
  const pphRate = pphRateFor(pphMode);
  const pph = Math.round(netBeforeTax * pphRate);
  const totalAfterDisc = Math.max(0, netBeforeTax + ppn - pph);
  return { totNum, discNum, ppn, pph, totalAfterDisc };
}
