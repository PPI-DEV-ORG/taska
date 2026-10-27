import { CoaAccount } from "@/lib/accounting";

export type AccountingTab = "journal" | "coa" | "ledger" | "summary";

export const COA_CATEGORIES: CoaAccount["category"][] = [
  "Aset Lancar",
  "Kewajiban Jangka Pendek",
  "Ekuitas",
  "Pendapatan",
  "Beban Pokok (HPP)",
  "Beban Operasional",
  "Pendapatan Diluar Usaha",
  "Beban Diluar Usaha",
];

