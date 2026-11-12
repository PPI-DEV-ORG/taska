export interface JournalLineSpec {
  accountCode: string;
  debit?: number;
  credit?: number;
  memo?: string;
  projectId?: number | null;
  partyType?: "CUSTOMER" | "SUPPLIER" | "EMPLOYEE" | "OTHER" | null;
  partyId?: number | null;
}

export interface PostRequest {
  date: Date | string;
  source: string;
  sourceType?: string;
  sourceId?: number;
  event?: string;
  memo: string;
  refNo?: string;
  projectId?: number | null;
  createdById?: number | null;
  lines: JournalLineSpec[];
}

export type MappingResolver = (key: string) => Promise<string> | string;

export function round(amount: number): number {
  return Math.round((Number(amount) || 0) + Number.EPSILON);
}

// Cut-Off Date: Dokumen bertanggal sebelum tanggal ini tidak diposting ke jurnal
export const CUTOFF_DATE = new Date("2026-01-01T00:00:00.000Z");
