export type ReportTab = "cards" | "pnl" | "balance-sheet" | "cash-flow" | "journal";

export type DownloadFormat = "xlsx" | "pdf" | "docx";

export interface ReportCardItem {
  type: string;
  title: string;
  desc: string;
  stat: string;
  badge?: string;
  isEfaktur?: boolean;
}

