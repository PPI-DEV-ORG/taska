import type { Row } from "@/constants/modules";

/**
 * Status invoice DP/Termin tidak cukup dilihat dari invoice itu sendiri.
 * Invoice DP bisa sudah dibayar penuh, tetapi kontraknya masih punya sisa
 * yang belum ditagih. Helper ini menyatukan perhitungan status rantai
 * (kontrak -> total ditagih -> total dibayar) agar tabel dan dialog
 * "Lanjutkan Termin / DP" memakai definisi yang sama.
 */

const AMOUNT_TOLERANCE = 1;

export type InvoiceChainState = {
  key: string;
  /** Total nilai kontrak/penawaran/PO. 0 jika tidak ada acuan. */
  contractTotal: number;
  /** True jika contractTotal berasal dari penawaran/PO/project, bukan tebakan. */
  contractKnown: boolean;
  /** Total semua invoice aktif dalam rantai (termasuk PPN). */
  billedTotal: number;
  /** Total pembayaran semua invoice aktif dalam rantai. */
  paidTotal: number;
  /** Sisa yang belum ditagih: contractTotal - billedTotal. */
  remainingToBill: number;
  /** Sisa yang sudah ditagih tetapi belum dibayar: billedTotal - paidTotal. */
  remainingToPay: number;
  hasPaidPelunasan: boolean;
  /** Rantai sudah selesai: ada pelunasan lunas, atau semua sudah ditagih & dibayar. */
  settled: boolean;
};

export type ContinuableInvoice = {
  invoice: Row;
  chain: InvoiceChainState;
};

export type InvoiceChainIndex = {
  keyById: Map<string, string>;
  stateByKey: Map<string, InvoiceChainState>;
};

function amount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstPositive(...values: unknown[]): number {
  for (const value of values) {
    const parsed = amount(value);
    if (parsed > 0) return parsed;
  }
  return 0;
}

function text(value: unknown): string {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized && normalized !== "-" ? normalized : "";
}

function statusText(row: Row): string {
  return String(row.status ?? "").trim().toUpperCase();
}

export function isCancelledInvoice(row: Row): boolean {
  const status = statusText(row);
  return status === "BATAL" || status === "DIBATALKAN";
}

function isPaidStatus(row: Row): boolean {
  const status = statusText(row);
  return status === "PAID" || status === "LUNAS";
}

export function invoiceAmount(row: Row): number {
  return firstPositive(row.total, row.nilai, row.amount);
}

export function invoicePaidAmount(row: Row): number {
  const paid = amount(row.terbayar ?? row.paidAmount);
  if (paid > 0) return paid;
  return isPaidStatus(row) ? invoiceAmount(row) : 0;
}

export function isPelunasanInvoice(row: Row): boolean {
  return /pelunasan/i.test(String(row.jenis ?? row.type ?? ""));
}

export function isDpOrTerminInvoice(row: Row): boolean {
  const jenis = String(row.jenis ?? "").trim().toLowerCase();
  const type = String(row.type ?? "").trim().toUpperCase();
  const number = String(row.nomor ?? row.number ?? "");

  return (
    jenis === "dp" ||
    jenis === "termin" ||
    type === "DP" ||
    type === "TERMIN" ||
    /\/DP\//i.test(number) ||
    /\/TRM\//i.test(number) ||
    /^INV\/\d{4}\/\d{2}\/\d+\/1$/i.test(number)
  );
}

/** Prefix dasar nomor invoice, mis. INV/2026/11/017/1 -> INV/2026/11/017. */
function invoiceBaseNumber(row: Row): string {
  const number = String(row.nomor ?? row.number ?? "").trim();
  const match = number.match(/^(INV\/\d{4}\/\d{2}\/\d+)(?:\/\d+)?$/i);
  return match ? (match[1] ?? "").toUpperCase() : "";
}

function invoiceTermNumber(row: Row): number {
  const number = String(row.nomor ?? row.number ?? "").trim();
  if (!invoiceBaseNumber(row)) return 0;
  const match = number.match(/\/(\d+)$/);
  return match ? Number(match[1]) : 1;
}

function invoiceTime(row: Row): number {
  const value = String(row.tanggal ?? row.date ?? "").trim();
  if (!value) return 0;
  const parsed = new Date(value.length <= 10 ? `${value}T00:00:00` : value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function findQuotation(row: Row, quotations: Row[]): Row | null {
  const quotationId = row.quotationId;
  if (quotationId) {
    const match = quotations.find((q) => String(q.id) === String(quotationId));
    if (match) return match;
  }

  const quotationNumber = text(row.quotation);
  if (quotationNumber) {
    const match = quotations.find((q) => text(q.nomor) === quotationNumber);
    if (match) return match;
  }

  return null;
}

function findProject(row: Row, projects: Row[]): Row | null {
  const projectId = row.projectId;
  if (projectId) {
    const match = projects.find((p) => String(p.id) === String(projectId));
    if (match) return match;
  }

  const projectName = text(row.project);
  if (projectName) {
    const match = projects.find(
      (p) => text(p.nama) === projectName || text(p.name) === projectName,
    );
    if (match) return match;
  }

  return null;
}

function findClientPo(row: Row, clientPos: Row[]): Row | null {
  const clientPoId = row.clientPoId;
  if (clientPoId) {
    const match = clientPos.find((p) => String(p.id) === String(clientPoId));
    if (match) return match;
  }

  const poNumber = text(row.po);
  if (poNumber) {
    const match = clientPos.find(
      (p) =>
        text(p.nomor) === poNumber ||
        text(p.number) === poNumber ||
        text(p.nomorSo) === poNumber ||
        text(p.nomorPoClient) === poNumber,
    );
    if (match) return match;
  }

  return null;
}

/** Ambil nomor penawaran dari tampilan project, mis. "PNW/2026/11/016 - Pelanggan". */
function quotationNumberFromText(value: unknown): string {
  const raw = String(value ?? "");
  const match = raw.match(/(?:PNW|QUO)[-\w/]+/i);
  return match ? match[0].toLowerCase() : "";
}

function chainKey(row: Row, quotations: Row[], projects: Row[], clientPos: Row[]): string {
  const quotation = findQuotation(row, quotations);
  if (quotation) return `q:${quotation.id}`;
  if (row.quotationId) return `q:${row.quotationId}`;

  const quotationNumber = text(row.quotation);
  if (quotationNumber) return `qn:${quotationNumber}`;

  const project = findProject(row, projects);
  const projectQuotationId = project?.quotationId ?? project?.quotationid;
  if (projectQuotationId) return `q:${projectQuotationId}`;
  if (project) return `p:${project.id}`;
  if (row.projectId) return `p:${row.projectId}`;

  const projectName = text(row.project);
  if (projectName) return `pn:${projectName}`;

  const clientPo = findClientPo(row, clientPos);
  const clientPoQuotationId = clientPo?.quotationId;
  if (clientPoQuotationId) return `q:${clientPoQuotationId}`;
  if (clientPo) return `po:${clientPo.id}`;
  if (row.clientPoId) return `po:${row.clientPoId}`;

  const poNumber = text(row.po);
  if (poNumber) return `pon:${poNumber}`;

  const baseNumber = invoiceBaseNumber(row);
  if (baseNumber) return `n:${baseNumber}`;

  if (row.parentInvoiceId) return `parent:${row.parentInvoiceId}`;
  return `id:${row.id}`;
}

/** Nilai kontrak dari penawaran/PO/project, atau estimasi dari label DP/Termin. */
function resolveContractTotal(
  row: Row,
  quotations: Row[],
  projects: Row[],
  clientPos: Row[],
): number {
  const quotation = findQuotation(row, quotations);
  let total = firstPositive(
    quotation?.totalAfterDisc,
    quotation?.grandTotal,
    quotation?.total,
    quotation?.nilai,
  );
  if (total > 0) return total;

  const clientPo = findClientPo(row, clientPos);
  total = firstPositive(clientPo?.total, clientPo?.totalInvoice, clientPo?.nilai);
  if (total > 0) return total;

  const project = findProject(row, projects);
  const projectQuotation = project
    ? quotations.find(
        (q) =>
          String(q.id) === String(project.quotationId ?? project.quotationid) ||
          quotationNumberFromText(project.penawaran) === text(q.nomor),
      )
    : null;
  if (projectQuotation) {
    total = firstPositive(
      projectQuotation.totalAfterDisc,
      projectQuotation.grandTotal,
      projectQuotation.total,
      projectQuotation.nilai,
    );
    if (total > 0) return total;
  }

  total = firstPositive(project?.nilaiKontrak, project?.contractValue, project?.nilai);
  if (total > 0) return total;

  // Fallback untuk invoice langsung/walk-in yang tidak punya penawaran/PO.
  // Hanya ambil persentase dari label DP/Termin/Pelunasan, bukan dari catatan
  // lain seperti "PPN 11%" atau "PPh 2%".
  const label = `${row.dpLabel ?? ""} ${row.catatan ?? ""} ${row.description ?? ""}`;
  const percentMatch = label.match(
    /\b(?:DP|Termin(?:\s*\d+)?|Pelunasan)\s*\((\d+(?:[.,]\d+)?)\s*%\)/i,
  );
  const percent = percentMatch ? Number(String(percentMatch[1] ?? "").replace(",", ".")) : 0;
  const invoiceTotal = invoiceAmount(row);
  if (percent > 0 && percent <= 100 && invoiceTotal > 0) {
    return Math.round((invoiceTotal / percent) * 100);
  }

  return 0;
}

function computeChainState(
  key: string,
  siblings: Row[],
  representative: Row,
  quotations: Row[],
  projects: Row[],
  clientPos: Row[],
): InvoiceChainState {
  const contractTotal = resolveContractTotal(representative, quotations, projects, clientPos);
  const billedTotal = siblings.reduce((sum, row) => sum + invoiceAmount(row), 0);
  const paidTotal = siblings.reduce((sum, row) => sum + invoicePaidAmount(row), 0);

  const hasPaidPelunasan = siblings.some(
    (row) =>
      isPelunasanInvoice(row) &&
      invoiceAmount(row) > 0 &&
      invoicePaidAmount(row) >= invoiceAmount(row) - AMOUNT_TOLERANCE,
  );

  const remainingToBill = contractTotal > 0 ? Math.max(0, contractTotal - billedTotal) : 0;
  const remainingToPay = Math.max(0, billedTotal - paidTotal);
  const settled =
    hasPaidPelunasan ||
    (contractTotal > 0 &&
      remainingToBill <= AMOUNT_TOLERANCE &&
      remainingToPay <= AMOUNT_TOLERANCE);

  return {
    key,
    contractTotal,
    contractKnown: contractTotal > 0,
    billedTotal,
    paidTotal,
    remainingToBill,
    remainingToPay,
    hasPaidPelunasan,
    settled,
  };
}

/** Hitung semua rantai sekali agar tabel tidak melakukan scan berulang per baris. */
export function buildInvoiceChainIndex(
  allInvoices: Row[] = [],
  quotations: Row[] = [],
  projects: Row[] = [],
  clientPos: Row[] = [],
): InvoiceChainIndex {
  const keyById = new Map<string, string>();
  const groups = new Map<string, Row[]>();

  for (const invoice of allInvoices) {
    const key = chainKey(invoice, quotations, projects, clientPos);
    keyById.set(String(invoice.id), key);
    if (isCancelledInvoice(invoice)) continue;

    const group = groups.get(key);
    if (group) group.push(invoice);
    else groups.set(key, [invoice]);
  }

  const stateByKey = new Map<string, InvoiceChainState>();
  for (const [key, group] of groups) {
    const sorted = [...group].sort((a, b) => {
      const termDiff = invoiceTermNumber(a) - invoiceTermNumber(b);
      return termDiff !== 0 ? termDiff : invoiceTime(a) - invoiceTime(b);
    });
    const representative = sorted[0];
    if (!representative) continue;
    stateByKey.set(
      key,
      computeChainState(key, group, representative, quotations, projects, clientPos),
    );
  }

  return { keyById, stateByKey };
}

export function getInvoiceChainState(
  invoice: Row,
  allInvoices: Row[] = [],
  quotations: Row[] = [],
  projects: Row[] = [],
  clientPos: Row[] = [],
  index?: InvoiceChainIndex,
): InvoiceChainState {
  const resolvedIndex =
    index ?? buildInvoiceChainIndex(allInvoices, quotations, projects, clientPos);
  const key =
    resolvedIndex.keyById.get(String(invoice.id)) ??
    chainKey(invoice, quotations, projects, clientPos);
  const state = resolvedIndex.stateByKey.get(key);
  if (state) return state;

  return computeChainState(key, [invoice], invoice, quotations, projects, clientPos);
}

export function isInvoiceContinuable(invoice: Row, chain: InvoiceChainState): boolean {
  if (isCancelledInvoice(invoice) || isPelunasanInvoice(invoice)) return false;
  if (chain.hasPaidPelunasan || chain.settled) return false;

  const total = invoiceAmount(invoice);
  const paid = invoicePaidAmount(invoice);
  const invoiceOutstanding = total > 0 && paid < total - AMOUNT_TOLERANCE;
  const chainOutstanding = chain.contractKnown && chain.remainingToBill > AMOUNT_TOLERANCE;

  return invoiceOutstanding || chainOutstanding;
}

/**
 * Ambil satu invoice acuan terbaru per rantai kontrak yang masih bisa
 * dilanjutkan. Invoice DP/Termin yang sudah lunas tetap ikut jika kontraknya
 * masih memiliki sisa yang belum ditagih.
 */
export function collectContinuableInvoices(
  allInvoices: Row[] = [],
  quotations: Row[] = [],
  projects: Row[] = [],
  clientPos: Row[] = [],
): ContinuableInvoice[] {
  const candidates: ContinuableInvoice[] = [];
  const index = buildInvoiceChainIndex(allInvoices, quotations, projects, clientPos);

  for (const invoice of allInvoices) {
    const chain = getInvoiceChainState(
      invoice,
      allInvoices,
      quotations,
      projects,
      clientPos,
      index,
    );
    if (isInvoiceContinuable(invoice, chain)) {
      candidates.push({ invoice, chain });
    }
  }

  candidates.sort((a, b) => {
    const termDiff = invoiceTermNumber(b.invoice) - invoiceTermNumber(a.invoice);
    if (termDiff !== 0) return termDiff;
    return invoiceTime(b.invoice) - invoiceTime(a.invoice);
  });

  const picked: ContinuableInvoice[] = [];
  for (const candidate of candidates) {
    const candidateKey = candidate.chain.key;
    if (picked.some((item) => item.chain.key === candidateKey)) continue;
    picked.push(candidate);
  }

  return picked;
}
