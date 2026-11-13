/**
 * Accounting Core Types & Client Master Data
 * (Sesuai Standar Akuntansi Keuangan SAK / PSAK Double-Entry)
 * Seluruh kalkulasi laporan keuangan & buku besar diproses resmi oleh backend di /accounting/*.
 */

export interface CoaAccount {
  code: string;
  name: string;
  category:
    | "Aset Lancar"
    | "Kewajiban Jangka Pendek"
    | "Ekuitas"
    | "Pendapatan"
    | "Beban Pokok (HPP)"
    | "Beban Operasional"
    | "Pendapatan Diluar Usaha"
    | "Beban Diluar Usaha";
  normalBalance: "DEBIT" | "KREDIT";
  type?: string;
  parentCode?: string;
  isPostable?: boolean;
  isCash?: boolean;
  isSystem?: boolean;
}

export const CHART_OF_ACCOUNTS: Record<string, CoaAccount> = {
  // 1000 KAS & BANK
  "1000": { code: "1000", name: "Kas & Bank (Header)", category: "Aset Lancar", normalBalance: "DEBIT", isPostable: false },
  "1000.01": { code: "1000.01", name: "Kas Kecil", category: "Aset Lancar", normalBalance: "DEBIT", type: "cash/bank", parentCode: "1000", isCash: true },
  "1000.02": { code: "1000.02", name: "Bank Mandiri PT GMP", category: "Aset Lancar", normalBalance: "DEBIT", type: "cash/bank", parentCode: "1000", isCash: true },

  // 1100 PIUTANG
  "1100": { code: "1100", name: "Piutang (Header)", category: "Aset Lancar", normalBalance: "DEBIT", isPostable: false },
  "1100.02": { code: "1100.02", name: "Uang Muka Pembelian", category: "Aset Lancar", normalBalance: "DEBIT", type: "account receivable", parentCode: "1100" },
  "110302": { code: "110302", name: "Account Receivable (Piutang Usaha)", category: "Aset Lancar", normalBalance: "DEBIT", type: "account receivable", parentCode: "1100" },
  "110303": { code: "110303", name: "Piutang Retensi Proyek", category: "Aset Lancar", normalBalance: "DEBIT", type: "account receivable", parentCode: "1100" },
  "1105.01": { code: "1105.01", name: "Uang Muka PPh 23 (Dipotong Customer)", category: "Aset Lancar", normalBalance: "DEBIT", type: "other current asset", parentCode: "1100" },
  "1105.02": { code: "1105.02", name: "Uang Muka PPh 25 (Angsuran Bulanan)", category: "Aset Lancar", normalBalance: "DEBIT", type: "other current asset", parentCode: "1100" },
  "1106": { code: "1106", name: "Piutang Kelebihan Bayar Pajak", category: "Aset Lancar", normalBalance: "DEBIT", type: "other current asset", parentCode: "1100" },
  "1105": { code: "1105", name: "Uang Muka PPh / Pajak Dibayar Dimuka", category: "Aset Lancar", normalBalance: "DEBIT", type: "other current asset", parentCode: "1100" },

  // 1200 ASSET & PERSEDIAAN
  "1200": { code: "1200", name: "Persediaan barang dagang", category: "Aset Lancar", normalBalance: "DEBIT", type: "inventory" },
  "1300": { code: "1300", name: "Perlengkapan", category: "Aset Lancar", normalBalance: "DEBIT", type: "other current asset" },
  "1600": { code: "1600", name: "Ppn masukan", category: "Aset Lancar", normalBalance: "DEBIT", type: "other current asset" },

  // 2000 HUTANG & KEWAJIBAN
  "2000": { code: "2000", name: "Hutang (Header)", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", isPostable: false },
  "2100": { code: "2100", name: "Ppn Keluaran", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", type: "other current liability", parentCode: "2000" },
  "210102": { code: "210102", name: "Account Payable (Hutang Usaha)", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", type: "account payable", parentCode: "2000" },
  "210202": { code: "210202", name: "Advance Sales (Uang Muka Penjualan)", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", type: "account payable", parentCode: "2000" },
  "2103": { code: "2103", name: "Hutang Biaya & Reimbursement Operasional", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", parentCode: "2000" },
  "2104": { code: "2104", name: "Hutang PPh Potong / Pungut", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", parentCode: "2000" },
  "2105": { code: "2105", name: "Hutang PPh Pasal 21 (Karyawan)", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", type: "other current liability", parentCode: "2000" },
  "2106": { code: "2106", name: "Hutang PPh Pasal 23 (Jasa / Vendor)", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", type: "other current liability", parentCode: "2000" },
  "2107": { code: "2107", name: "Hutang BPJS Karyawan", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", type: "other current liability", parentCode: "2000" },
  "2108": { code: "2108", name: "Goods Received Not Invoiced (GRNI)", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", type: "other current liability", parentCode: "2000" },
  "2109": { code: "2109", name: "Hutang Pajak Penghasilan (PPh 29)", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", type: "other current liability", parentCode: "2000" },

  // 3000 MODAL & EKUITAS
  "3000": { code: "3000", name: "Modal (Header)", category: "Ekuitas", normalBalance: "KREDIT", isPostable: false },
  "310001": { code: "310001", name: "OPENING BALANCE EQUITY", category: "Ekuitas", normalBalance: "KREDIT", type: "equity", parentCode: "3000" },
  "3101": { code: "3101", name: "Modal Disetor", category: "Ekuitas", normalBalance: "KREDIT", type: "equity", parentCode: "3000" },
  "3102": { code: "3102", name: "Laba Ditahan", category: "Ekuitas", normalBalance: "KREDIT", parentCode: "3000" },
  "3200.02": { code: "3200.02", name: "Dividend", category: "Ekuitas", normalBalance: "KREDIT", type: "equity", parentCode: "3000" },

  // 4000 PENDAPATAN
  "4000": { code: "4000", name: "Pendapatan (Header)", category: "Pendapatan", normalBalance: "KREDIT", isPostable: false },
  "4000.01": { code: "4000.01", name: "Penjualan Barang Dagang", category: "Pendapatan", normalBalance: "KREDIT", type: "revenue", parentCode: "4000" },
  "4000.02": { code: "4000.02", name: "Pendapatan Jasa & Instalasi", category: "Pendapatan", normalBalance: "KREDIT", type: "revenue", parentCode: "4000" },
  "4000.03": { code: "4000.03", name: "Pendapatan Software & Lisensi", category: "Pendapatan", normalBalance: "KREDIT", type: "revenue", parentCode: "4000" },
  "4000.04": { code: "4000.04", name: "Retur Penjualan", category: "Pendapatan", normalBalance: "DEBIT", type: "revenue", parentCode: "4000" },
  "4000.05": { code: "4000.05", name: "Potongan Penjualan", category: "Pendapatan", normalBalance: "DEBIT", type: "revenue", parentCode: "4000" },

  // 5000 HPP
  "5000": { code: "5000", name: "Beban Pokok Penjualan (HPP - Header)", category: "Beban Pokok (HPP)", normalBalance: "DEBIT", isPostable: false },
  "5101": { code: "5101", name: "HPP Project", category: "Beban Pokok (HPP)", normalBalance: "DEBIT", parentCode: "5000" },
  "5102": { code: "5102", name: "HPP Retail", category: "Beban Pokok (HPP)", normalBalance: "DEBIT", parentCode: "5000" },
  "5104": { code: "5104", name: "Selisih Inventaris (Stock Opname Loss)", category: "Beban Pokok (HPP)", normalBalance: "DEBIT", parentCode: "5000" },
  "5105": { code: "5105", name: "Kerusakan Barang (Inventory Damage)", category: "Beban Pokok (HPP)", normalBalance: "DEBIT", parentCode: "5000" },
  "5106": { code: "5106", name: "Selisih Harga Pembelian (PPV)", category: "Beban Pokok (HPP)", normalBalance: "DEBIT", parentCode: "5000" },

  // 6000 BEBAN OPERASIONAL
  "6000": { code: "6000", name: "EXPENSE (Header)", category: "Beban Operasional", normalBalance: "DEBIT", isPostable: false },
  "6100": { code: "6100", name: "Biaya pemasaran", category: "Beban Operasional", normalBalance: "DEBIT", type: "expense", parentCode: "6000" },
  "6200": { code: "6200", name: "Biaya Umum & Administrasi", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6000", isPostable: false },
  "6201": { code: "6201", name: "Gaji & Tunjangan", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6200", isPostable: false },
  "6201.01": { code: "6201.01", name: "Biaya Gaji Karyawan", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6201" },
  "6201.05": { code: "6201.05", name: "Beban BPJS Ketenagakerjaan & Kesehatan (Perusahaan)", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6201" },
  "6202": { code: "6202", name: "Beban Operasional Lainnya", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6200" },

  // 7000 LAIN-LAIN & PAJAK
  "7100": { code: "7100", name: "Pendapatan Lain-lain", category: "Pendapatan Diluar Usaha", normalBalance: "KREDIT" },
  "7200": { code: "7200", name: "Beban Lain-lain", category: "Beban Diluar Usaha", normalBalance: "DEBIT" },
  "7201": { code: "7201", name: "Beban Pajak Penghasilan Badan", category: "Beban Diluar Usaha", normalBalance: "DEBIT" },
  "7202": { code: "7202", name: "Selisih Pembulatan", category: "Beban Diluar Usaha", normalBalance: "DEBIT" },

  // Standard 4-digit accounts & aliases for balance sheet & general journal
  "1101": { code: "1101", name: "Kas & Bank Operasional", category: "Aset Lancar", normalBalance: "DEBIT", type: "cash/bank", parentCode: "1000", isCash: true },
  "1102": { code: "1102", name: "Piutang Usaha (Accounts Receivable)", category: "Aset Lancar", normalBalance: "DEBIT", type: "account receivable", parentCode: "1100" },
  "1103": { code: "1103", name: "Persediaan Barang Gudang (Inventory)", category: "Aset Lancar", normalBalance: "DEBIT", type: "inventory" },
  "1104": { code: "1104", name: "PPN Masukan (Input VAT)", category: "Aset Lancar", normalBalance: "DEBIT", type: "other current asset" },
  "2101": { code: "2101", name: "Hutang Usaha Supplier (Accounts Payable)", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", type: "account payable", parentCode: "2000" },
  "2102": { code: "2102", name: "Hutang PPN Keluaran (Output VAT)", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", type: "other current liability", parentCode: "2000" },
  "4101": { code: "4101", name: "Pendapatan Proyek & Penjualan", category: "Pendapatan", normalBalance: "KREDIT", type: "revenue", parentCode: "4000" },
};

export interface JournalLine {
  id: string;
  journalNo: string;
  tanggal: string;
  refNo: string;
  sumber: string;
  keterangan: string;
  project: string;
  kodeAkun: string;
  namaAkun: string;
  debit: number;
  kredit: number;
  manualJournalId?: string;
  /** Metadata entry jurnal untuk modal detail dan tautan dokumen sumber. */
  journalEntryId?: string;
  lineNo?: number;
  source?: string;
  sourceType?: string;
  sourceId?: string;
  event?: string;
  entryMemo?: string;
  entryStatus?: string;
  projectId?: string;
  partyType?: string;
  partyId?: string;
}

export interface ManualJournalLine {
  kodeAkun: string;
  keterangan: string;
  debit: number;
  kredit: number;
}

export interface ManualJournal {
  id: string;
  journalNo?: string;
  tanggal: string;
  refNo: string;
  keterangan: string;
  project?: string;
  createdBy?: string;
  createdAt?: string;
  lines: ManualJournalLine[];
}

export const STORAGE_MANUAL_JOURNALS_KEY = "taska.accounting.manual_journals";
export const STORAGE_CUSTOM_COA_KEY = "taska.accounting.custom_coa";
export const STORAGE_DELETED_COA_KEY = "taska.accounting.deleted_coa_codes";

export function loadManualJournals(): ManualJournal[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_MANUAL_JOURNALS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveManualJournals(journals: ManualJournal[]) {
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(STORAGE_MANUAL_JOURNALS_KEY, JSON.stringify(journals));
  }
}

export function loadCustomCoa(): CoaAccount[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_CUSTOM_COA_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomCoa(accounts: CoaAccount[]) {
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(STORAGE_CUSTOM_COA_KEY, JSON.stringify(accounts));
  }
}

export function loadDeletedCoaCodes(): string[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_DELETED_COA_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDeletedCoaCodes(codes: string[]) {
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(STORAGE_DELETED_COA_KEY, JSON.stringify(codes));
  }
}

export function getKasBankAccounts(): { code: string; name: string; rawName: string }[] {
  const custom = loadCustomCoa();
  const deleted = new Set(loadDeletedCoaCodes());
  const merged: Record<string, { code: string; name: string; rawName: string }> = {};

  Object.values(CHART_OF_ACCOUNTS).forEach((acc) => {
    if (
      !deleted.has(acc.code) &&
      acc.category === "Aset Lancar" &&
      (acc.code === "1000.01" || acc.code === "1000.02" || acc.parentCode === "1000" || acc.type === "cash/bank" || acc.isCash)
    ) {
      merged[acc.code] = { code: acc.code, name: acc.name, rawName: acc.name };
    }
  });

  custom.forEach((acc) => {
    if (
      !deleted.has(acc.code) &&
      (acc.parentCode === "1000" || acc.code.startsWith("1000.") || acc.type === "cash/bank" || acc.isCash)
    ) {
      merged[acc.code] = { code: acc.code, name: acc.name, rawName: acc.name };
    }
  });

  const list = Object.values(merged);
  if (list.length === 0) {
    return [
      { code: "1000.02", name: "Bank Mandiri PT GMP [1000.02]", rawName: "Bank Mandiri PT GMP" },
      { code: "1000.01", name: "Kas Kecil [1000.01]", rawName: "Kas Kecil" },
    ];
  }
  return list.map((a) => ({
    code: a.code,
    name: `${a.name} [${a.code}]`,
    rawName: a.name,
  }));
}

export interface ProjectPnlRow {
  project: string;
  customer: string;
  revenueGross: number;
  revenueDpp: number;
  ppnKeluaran: number;
  paidCashIn: number;
  arOutstanding: number;
  cogsPo: number;
  opexExpense: number;
  grossProfit: number;
  netProfit: number;
  marginPct: number;
  statusKesehatan: "Sehat" | "Waspada" | "Rugi";
}

export interface IncomeStatementSummary {
  revenueGross: number;
  revenueDpp: number;
  ppnKeluaran: number;
  cogsProject: number;
  cogsRetail: number;
  cogsTotal: number;
  grossProfit: number;
  grossMarginPct: number;
  opexByCategory: { kategori: string; nominal: number; count: number }[];
  opexTotal: number;
  operatingProfit: number;
  netProfit: number;
  netMarginPct: number;
  projectRows: ProjectPnlRow[];
}

export interface BalanceSheetSummary {
  assets: {
    kasDanBank: number;
    piutangUsaha: number;
    persediaanBarang: number;
    uangMukaPph: number;
    ppnMasukan?: number;
    totalAsetLancar: number;
    items?: Array<{ code: string; name: string; category?: string; amount: number }>;
  };
  liabilities: {
    hutangSupplier: number;
    hutangReimbursement: number;
    hutangPpnKeluaran: number;
    totalKewajiban: number;
    items?: Array<{ code: string; name: string; category?: string; amount: number }>;
  };
  equity: {
    modalKerjaAwal: number;
    labaBerjalan: number;
    totalEkuitas: number;
    items?: Array<{ code: string; name: string; category?: string; amount: number }>;
  };
  totalPasiva: number;
  isBalanced: boolean;
  discrepancy: number;
}

export interface CashFlowItem {
  id: string;
  tanggal: string;
  refNo: string;
  kategori: string;
  pihak: string;
  project: string;
  keterangan: string;
  masuk: number;
  keluar: number;
}

export interface CashFlowSummary {
  cashInCustomers: number;
  cashOutSuppliers: number;
  cashOutExpenses: number;
  totalCashIn: number;
  totalCashOut: number;
  netCashFlow: number;
  cashConversionRatePct: number;
  items: CashFlowItem[];
}

export interface CoaTrialBalanceRow {
  code: string;
  name: string;
  category: CoaAccount["category"];
  normalBalance: "DEBIT" | "KREDIT";
  totalDebit: number;
  totalKredit: number;
  endingBalance: number;
  parentCode?: string;
  parentName?: string;
  depth?: number;
  isHeader?: boolean;
}

export interface FinancialStatementsBundle {
  journalLines: JournalLine[];
  totalDebit: number;
  totalKredit: number;
  isJournalBalanced: boolean;
  coaBalances: CoaTrialBalanceRow[];
  incomeStatement: IncomeStatementSummary;
  balanceSheet: BalanceSheetSummary;
  cashFlow: CashFlowSummary;
}

/**
 * Membangun struktur pohon hierarkis COA (Parent & Children / Sub-Akun),
 * lengkap dengan rekursi depth (↳), urutan visual, dan agregasi total mutasi anak ke parent header.
 */
export function buildCoaTree(
  accountsMap: Record<string, CoaAccount>,
  trialBalanceRows?: Array<{
    code: string;
    totalDebit?: number;
    totalCredit?: number;
    balanceDebit?: number;
    balanceCredit?: number;
  }>,
  deletedCodes: string[] = []
): CoaTrialBalanceRow[] {
  const deletedSet = new Set(deletedCodes);
  const uniqueAccounts: Record<string, CoaAccount> = {};

  for (const [code, acc] of Object.entries(accountsMap)) {
    if (!acc || deletedSet.has(code) || deletedSet.has(acc.code)) continue;
    uniqueAccounts[acc.code] = { ...acc };
  }

  // Infer parent for dot notation (e.g. 1000.01 -> 1000, 6201.02 -> 6201) if not explicitly set
  for (const acc of Object.values(uniqueAccounts)) {
    if (!acc.parentCode && acc.code.includes(".")) {
      const prefix = acc.code.split(".")[0];
      if (prefix && uniqueAccounts[prefix]) {
        acc.parentCode = prefix;
      }
    }
  }

  // Direct mutasi map from trial balance rows
  const tbMap = new Map<string, { d: number; k: number }>();
  if (Array.isArray(trialBalanceRows)) {
    for (const r of trialBalanceRows) {
      tbMap.set(r.code, {
        d: Number(r.totalDebit || 0),
        k: Number(r.totalCredit || 0),
      });
    }
  }

  const directMutasi: Record<string, { d: number; k: number }> = {};
  for (const code of Object.keys(uniqueAccounts)) {
    directMutasi[code] = tbMap.get(code) || { d: 0, k: 0 };
  }

  // Build tree relations
  const childrenMap: Record<string, CoaAccount[]> = {};
  const rootAccounts: CoaAccount[] = [];

  for (const acc of Object.values(uniqueAccounts)) {
    const pCode = acc.parentCode && uniqueAccounts[acc.parentCode] ? acc.parentCode : undefined;
    if (pCode) {
      if (!childrenMap[pCode]) childrenMap[pCode] = [];
      childrenMap[pCode].push(acc);
    } else {
      rootAccounts.push(acc);
    }
  }

  const sortByCode = (a: CoaAccount, b: CoaAccount) =>
    a.code.localeCompare(b.code, undefined, { numeric: true });

  rootAccounts.sort(sortByCode);
  for (const list of Object.values(childrenMap)) {
    list.sort(sortByCode);
  }

  function computeSubtreeTotals(code: string, visited = new Set<string>()): { d: number; k: number } {
    if (visited.has(code)) return { d: 0, k: 0 };
    visited.add(code);
    const base = directMutasi[code] || { d: 0, k: 0 };
    let totalD = base.d;
    let totalK = base.k;
    for (const child of childrenMap[code] || []) {
      const sub = computeSubtreeTotals(child.code, visited);
      totalD += sub.d;
      totalK += sub.k;
    }
    return { d: totalD, k: totalK };
  }

  const result: CoaTrialBalanceRow[] = [];
  function traverse(acc: CoaAccount, depth: number, visited = new Set<string>()) {
    if (visited.has(acc.code)) return;
    visited.add(acc.code);
    const kids = childrenMap[acc.code] || [];
    const { d, k } = computeSubtreeTotals(acc.code);
    const endingBalance = acc.normalBalance === "DEBIT" ? d - k : k - d;
    const parentAcc = acc.parentCode ? uniqueAccounts[acc.parentCode] : undefined;

    result.push({
      code: acc.code,
      name: acc.name,
      category: acc.category,
      normalBalance: acc.normalBalance,
      totalDebit: d,
      totalKredit: k,
      endingBalance,
      parentCode: parentAcc?.code,
      parentName: parentAcc?.name,
      depth,
      isHeader: kids.length > 0 || acc.isPostable === false,
    });

    for (const child of kids) {
      traverse(child, depth + 1, visited);
    }
  }

  for (const root of rootAccounts) {
    traverse(root, 0);
  }

  return result;
}

/**
 * Fallback empty financial bundle when waiting for server response
 */
export function computeFinancialStatements(
  _data?: Record<string, any[]>,
  _manualJournals: ManualJournal[] = [],
  _customAccounts: CoaAccount[] = [],
  _deletedCoaCodes: string[] = []
): FinancialStatementsBundle {
  const mergedMap: Record<string, CoaAccount> = { ...CHART_OF_ACCOUNTS };
  _customAccounts.forEach((acc) => {
    mergedMap[acc.code] = acc;
  });
  const coaBalances = buildCoaTree(mergedMap, [], _deletedCoaCodes);

  return {
    journalLines: [],
    totalDebit: 0,
    totalKredit: 0,
    isJournalBalanced: true,
    coaBalances,
    incomeStatement: {
      revenueGross: 0,
      revenueDpp: 0,
      ppnKeluaran: 0,
      cogsProject: 0,
      cogsRetail: 0,
      cogsTotal: 0,
      grossProfit: 0,
      grossMarginPct: 0,
      opexByCategory: [],
      opexTotal: 0,
      operatingProfit: 0,
      netProfit: 0,
      netMarginPct: 0,
      projectRows: [],
    },
    balanceSheet: {
      assets: {
        kasDanBank: 0,
        piutangUsaha: 0,
        persediaanBarang: 0,
        uangMukaPph: 0,
        ppnMasukan: 0,
        totalAsetLancar: 0,
      },
      liabilities: {
        hutangSupplier: 0,
        hutangReimbursement: 0,
        hutangPpnKeluaran: 0,
        totalKewajiban: 0,
      },
      equity: {
        modalKerjaAwal: 0,
        labaBerjalan: 0,
        totalEkuitas: 0,
      },
      totalPasiva: 0,
      isBalanced: true,
      discrepancy: 0,
    },
    cashFlow: {
      cashInCustomers: 0,
      cashOutSuppliers: 0,
      cashOutExpenses: 0,
      totalCashIn: 0,
      totalCashOut: 0,
      netCashFlow: 0,
      cashConversionRatePct: 0,
      items: [],
    },
  };
}
