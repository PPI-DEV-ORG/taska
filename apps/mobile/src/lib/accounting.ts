/**
 * Accounting & Financial Statement Engine (SAK / PSAK Double-Entry Bookkeeping)
 * Automatically derives:
 * 1. Chart of Accounts (Bagan Akun / COA)
 * 2. General Journal (Jurnal Umum Double-Entry)
 * 3. Income Statement / Profit & Loss (Laporan Laba Rugi Standar & Per Proyek)
 * 4. Balance Sheet (Laporan Posisi Keuangan / Neraca)
 * 5. Cash Flow Statement (Laporan Arus Kas - Metode Langsung)
 */

export interface CoaAccount {
  code: string;
  name: string;
  category: "Aset Lancar" | "Kewajiban Jangka Pendek" | "Ekuitas" | "Pendapatan" | "Beban Pokok (HPP)" | "Beban Operasional" | "Pendapatan Diluar Usaha" | "Beban Diluar Usaha";
  normalBalance: "DEBIT" | "KREDIT";
  type?: string;
  parentCode?: string;
}

export const CHART_OF_ACCOUNTS: Record<string, CoaAccount> = {
  // 1000 KAS & BANK
  "1000": { code: "1000", name: "Kas & Bank (Header)", category: "Aset Lancar", normalBalance: "DEBIT" },
  "1000.01": { code: "1000.01", name: "Kas Kecil", category: "Aset Lancar", normalBalance: "DEBIT", type: "cash/bank", parentCode: "1000" },
  "1000.02": { code: "1000.02", name: "Bank Mandiri PT GMP", category: "Aset Lancar", normalBalance: "DEBIT", type: "cash/bank", parentCode: "1000" },

  // 1100 PIUTANG
  "1100": { code: "1100", name: "Piutang (Header)", category: "Aset Lancar", normalBalance: "DEBIT" },
  "1100.02": { code: "1100.02", name: "Uang Muka Pembelian", category: "Aset Lancar", normalBalance: "DEBIT", type: "account receivable", parentCode: "1100" },
  "110302": { code: "110302", name: "Account Receivable (Piutang Usaha)", category: "Aset Lancar", normalBalance: "DEBIT", type: "account receivable", parentCode: "1100" },
  "1105": { code: "1105", name: "Uang Muka PPh / Pajak Dibayar Dimuka", category: "Aset Lancar", normalBalance: "DEBIT", type: "other current asset", parentCode: "1100" },

  // 1200 ASSET
  "1200": { code: "1200", name: "Persediaan barang dagang", category: "Aset Lancar", normalBalance: "DEBIT", type: "inventory" },
  "1300": { code: "1300", name: "Perlengkapan", category: "Aset Lancar", normalBalance: "DEBIT", type: "other current asset" },
  "1600": { code: "1600", name: "Ppn masukan", category: "Aset Lancar", normalBalance: "DEBIT", type: "other current asset" },

  // 2000 HUTANG
  "2000": { code: "2000", name: "Hutang (Header)", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT" },
  "2100": { code: "2100", name: "Ppn Keluaran", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", type: "other current liability", parentCode: "2000" },
  "210102": { code: "210102", name: "Account Payable (Hutang Usaha)", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", type: "account payable", parentCode: "2000" },
  "210202": { code: "210202", name: "Advance Sales (Uang Muka Penjualan)", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", type: "account payable", parentCode: "2000" },
  "2103": { code: "2103", name: "Hutang Biaya & Reimbursement Operasional", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", parentCode: "2000" },
  "2104": { code: "2104", name: "Hutang PPh Potong / Pungut", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", parentCode: "2000" },
  "2105": { code: "2105", name: "Hutang PPh Pasal 21 (Karyawan)", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", type: "other current liability", parentCode: "2000" },
  "2106": { code: "2106", name: "Hutang PPh Pasal 23 (Jasa / Vendor)", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", type: "other current liability", parentCode: "2000" },
  "2107": { code: "2107", name: "Hutang BPJS Karyawan", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT", type: "other current liability", parentCode: "2000" },

  // 3000 Modal
  "3000": { code: "3000", name: "Modal (Header)", category: "Ekuitas", normalBalance: "KREDIT" },
  "310001": { code: "310001", name: "OPENING BALANCE EQUITY", category: "Ekuitas", normalBalance: "KREDIT", type: "equity", parentCode: "3000" },
  "3200.02": { code: "3200.02", name: "Dividend", category: "Ekuitas", normalBalance: "KREDIT", type: "equity", parentCode: "3000" },
  "3102": { code: "3102", name: "Laba Ditahan / Laba Bersih Tahun Berjalan", category: "Ekuitas", normalBalance: "KREDIT", parentCode: "3000" },

  // 4000 Pendapatan
  "4000": { code: "4000", name: "Pendapatan (Header)", category: "Pendapatan", normalBalance: "KREDIT" },
  "4000.01": { code: "4000.01", name: "Penjualan", category: "Pendapatan", normalBalance: "KREDIT", type: "revenue", parentCode: "4000" },
  "4000.02": { code: "4000.02", name: "Pendapatan jasa", category: "Pendapatan", normalBalance: "KREDIT", type: "revenue", parentCode: "4000" },
  "4000.03": { code: "4000.03", name: "Pendapatan software dan lisensi", category: "Pendapatan", normalBalance: "KREDIT", type: "revenue", parentCode: "4000" },
  "4000.04": { code: "4000.04", name: "Retur penjualan", category: "Pendapatan", normalBalance: "DEBIT", type: "revenue", parentCode: "4000" },
  "4000.05": { code: "4000.05", name: "Potongan penjualan", category: "Pendapatan", normalBalance: "DEBIT", type: "revenue", parentCode: "4000" },

  // 5000 HPP
  "5000": { code: "5000", name: "Beban Pokok Penjualan (HPP - Header)", category: "Beban Pokok (HPP)", normalBalance: "DEBIT" },
  "5101": { code: "5101", name: "HPP Project (Pengadaan Barang & Material Proyek)", category: "Beban Pokok (HPP)", normalBalance: "DEBIT", parentCode: "5000" },
  "5102": { code: "5102", name: "HPP Retail (Harga Pokok Penjualan Barang Stok)", category: "Beban Pokok (HPP)", normalBalance: "DEBIT", parentCode: "5000" },

  // 6000 EXPENSE
  "6000": { code: "6000", name: "EXPENSE (Header)", category: "Beban Operasional", normalBalance: "DEBIT" },
  "6100": { code: "6100", name: "Biaya pemasaran", category: "Beban Operasional", normalBalance: "DEBIT", type: "expense", parentCode: "6000" },
  "6101": { code: "6101", name: "Biaya iklan", category: "Beban Operasional", normalBalance: "DEBIT", type: "expense", parentCode: "6100" },
  "6102": { code: "6102", name: "Biaya komisi", category: "Beban Operasional", normalBalance: "DEBIT", type: "expense", parentCode: "6100" },
  "6103": { code: "6103", name: "Biaya entertain", category: "Beban Operasional", normalBalance: "DEBIT", type: "expense", parentCode: "6100" },

  "6200": { code: "6200", name: "Biaya Umum & Administrasi", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6000" },
  "6201": { code: "6201", name: "Gaji & Tunjangan", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6200" },
  "6201.01": { code: "6201.01", name: "Biaya gaji", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6201" },
  "6201.02": { code: "6201.02", name: "Biaya transport karyawan", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6201" },
  "6201.03": { code: "6201.03", name: "Biaya catering & Makan karyawan", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6201" },
  "6201.04": { code: "6201.04", name: "Biaya THR", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6201" },

  "6202": { code: "6202", name: "Beban Utility", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6200" },
  "6202.01": { code: "6202.01", name: "Biaya Listrik", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6202" },
  "6202.02": { code: "6202.02", name: "Biaya PAM", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6202" },
  "6202.03": { code: "6202.03", name: "Biaya Telekomunikasi", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6202" },
  "6202.04": { code: "6202.04", name: "Biaya Pajak", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6202" },
  "6202.05": { code: "6202.05", name: "Biaya Retribusi & sumbangan", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6202" },
  "6202.06": { code: "6202.06", name: "Biaya ATK", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6202" },
  "6202.07": { code: "6202.07", name: "Biaya Umum & Adm lainnya", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6202" },
  "6202.08": { code: "6202.08", name: "Beban Reimburse", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6202" },

  "6203": { code: "6203", name: "Repair & maintenance expense", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6200" },
  "6203.01": { code: "6203.01", name: "pemeliharaan gedung", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6203" },
  "6203.02": { code: "6203.02", name: "pemeliharaan kendaraan", category: "Beban Operasional", normalBalance: "DEBIT", parentCode: "6203" },

  // 7100 Pendapatan diluar usaha
  "7100": { code: "7100", name: "Pendapatan diluar usaha", category: "Pendapatan Diluar Usaha", normalBalance: "KREDIT" },
  "7100.01": { code: "7100.01", name: "Pendapatan bunga deposito", category: "Pendapatan Diluar Usaha", normalBalance: "KREDIT", parentCode: "7100" },
  "7100.02": { code: "7100.02", name: "penjualan inventory / perlengkapan", category: "Pendapatan Diluar Usaha", normalBalance: "KREDIT", parentCode: "7100" },
  "7100.03": { code: "7100.03", name: "pendapatan lain-lain", category: "Pendapatan Diluar Usaha", normalBalance: "KREDIT", parentCode: "7100" },

  // 7200 Biaya diluar usaha
  "7200": { code: "7200", name: "Biaya diluar usaha", category: "Beban Diluar Usaha", normalBalance: "DEBIT" },
  "7200.01": { code: "7200.01", name: "biaya adm bank", category: "Beban Diluar Usaha", normalBalance: "DEBIT", parentCode: "7200" },
  "7200.02": { code: "7200.02", name: "beban lain-lain", category: "Beban Diluar Usaha", normalBalance: "DEBIT", parentCode: "7200" },

  // Aliases for backward compatibility
  "1101": { code: "1000.01", name: "Kas & Bank Operasional", category: "Aset Lancar", normalBalance: "DEBIT" },
  "1102": { code: "110302", name: "Piutang Usaha (Accounts Receivable)", category: "Aset Lancar", normalBalance: "DEBIT" },
  "1103": { code: "1200", name: "Persediaan Barang Gudang (Inventory)", category: "Aset Lancar", normalBalance: "DEBIT" },
  "1104": { code: "1600", name: "PPN Masukan (Input VAT)", category: "Aset Lancar", normalBalance: "DEBIT" },
  "2101": { code: "210102", name: "Hutang Usaha Supplier (Accounts Payable)", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT" },
  "2102": { code: "2100", name: "Hutang PPN Keluaran (Output VAT)", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT" },
  "3101": { code: "310001", name: "Modal Kerja & Cadangan Persediaan Awal", category: "Ekuitas", normalBalance: "KREDIT" },
  "4101": { code: "4000.01", name: "Pendapatan Proyek & Penjualan", category: "Pendapatan", normalBalance: "KREDIT" },
};

export interface JournalLine {
  id: string;
  journalNo: string;
  tanggal: string;
  refNo: string;
  sumber:
    | "Invoice Client"
    | "Invoice Masuk"
    | "Pembayaran Invoice"
    | "Penjualan Langsung (Kas)"
    | "HPP Penjualan Retail"
    | "PO Supplier"
    | "Pelunasan PO"
    | "Request Barang / Ritel"
    | "Pengeluaran (Expense)"
    | "Pembayaran Pengeluaran"
    | "Pembayaran Expense"
    | "Reimburse"
    | "Pembayaran Reimburse"
    | "Payroll & Gaji"
    | "Jurnal Manual";
  keterangan: string;
  project: string;
  kodeAkun: string;
  namaAkun: string;
  debit: number;
  kredit: number;
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
      (acc.code === "1000.01" || acc.code === "1000.02" || acc.parentCode === "1000" || acc.type === "cash/bank")
    ) {
      merged[acc.code] = { code: acc.code, name: acc.name, rawName: acc.name };
    }
  });

  custom.forEach((acc) => {
    if (
      !deleted.has(acc.code) &&
      (acc.parentCode === "1000" || acc.code.startsWith("1000.") || acc.type === "cash/bank")
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
  };
  liabilities: {
    hutangSupplier: number;
    hutangReimbursement: number;
    hutangPpnKeluaran: number;
    totalKewajiban: number;
  };
  equity: {
    modalKerjaAwal: number;
    labaBerjalan: number;
    totalEkuitas: number;
  };
  totalPasiva: number;
  isBalanced: boolean;
}

export interface CashFlowItem {
  id: string;
  tanggal: string;
  refNo: string;
  kategori:
    | "Arus Kas Masuk (Pelanggan)"
    | "Arus Kas Keluar (Supplier PO)"
    | "Arus Kas Keluar (Biaya Operasional)"
    | "Arus Kas Keluar (Invoice Masuk)"
    | "Arus Kas Keluar (Gaji Karyawan)";
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

function toNum(v: any): number {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v) : 0;
  if (!v) return 0;
  const cleaned = String(v).replace(/[^\d.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function normStr(v: any, fallback = "-"): string {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function resolveExpenseCoaCode(kategori: string, alasan: string): string {
  const text = `${kategori} ${alasan}`.toLowerCase();
  if (text.includes("reimburse")) return "6202.08";
  if (text.includes("gaji") || text.includes("payroll")) return "6201.01";
  if (text.includes("transport") || text.includes("bensin") || text.includes("tol") || text.includes("parkir")) return "6201.02";
  if (text.includes("makan") || text.includes("catering") || text.includes("konsumsi")) return "6201.03";
  if (text.includes("thr") || text.includes("bonus")) return "6201.04";
  if (text.includes("listrik") || text.includes("pln")) return "6202.01";
  if (text.includes("pam") || text.includes("air")) return "6202.02";
  if (text.includes("telepon") || text.includes("internet") || text.includes("wifi") || text.includes("pulsa")) return "6202.03";
  if (text.includes("pajak") || text.includes("tax")) return "6202.04";
  if (text.includes("retribusi") || text.includes("sumbangan")) return "6202.05";
  if (text.includes("atk") || text.includes("kertas") || text.includes("alat tulis")) return "6202.06";
  if (text.includes("iklan") || text.includes("ads") || text.includes("google") || text.includes("meta")) return "6101";
  if (text.includes("komisi") || text.includes("fee")) return "6102";
  if (text.includes("entertain") || text.includes("jamuan")) return "6103";
  if (text.includes("gedung") || text.includes("kantor") || text.includes("renovasi")) return "6203.01";
  if (text.includes("kendaraan") || text.includes("mobil") || text.includes("motor") || text.includes("servis")) return "6203.02";
  return "6202.07";
}

export function formatJournalDateTime(rawDate?: any, rawCreatedAt?: any): string {
  const pad = (n: number) => String(n).padStart(2, "0");

  const candidate = rawCreatedAt || rawDate;
  if (candidate) {
    const d = new Date(candidate);
    if (!isNaN(d.getTime())) {
      const isDateOnly = typeof candidate === "string" && candidate.trim().length <= 10;
      if (!isDateOnly) {
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
    }
  }

  if (rawDate && rawCreatedAt) {
    const cd = new Date(rawCreatedAt);
    if (!isNaN(cd.getTime())) {
      const dateStr = String(rawDate).slice(0, 10);
      return `${dateStr} ${pad(cd.getHours())}:${pad(cd.getMinutes())}`;
    }
  }

  if (rawDate) {
    const dateStr = String(rawDate).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return `${dateStr} 00:00`;
    }
    return String(rawDate);
  }

  return "2026-02-01 00:00";
}

export function computeFinancialStatements(
  data: Record<string, any[]>,
  manualJournals: ManualJournal[] = [],
  customAccounts: CoaAccount[] = [],
  deletedCoaCodes: string[] = []
): FinancialStatementsBundle {
  const activeCoa: Record<string, CoaAccount> = { ...CHART_OF_ACCOUNTS };
  customAccounts.forEach((acc) => {
    activeCoa[acc.code] = acc;
  });
  deletedCoaCodes.forEach((c) => {
    delete activeCoa[c];
  });

  // Strict status filters: do not include rejected, canceled, or voided transactions
  const invoices = ((data?.invoices) || []).filter(
    (inv) => inv && !["batal", "dibatalkan"].includes(normStr(inv.status).toLowerCase())
  );
  const supplierPos = ((data?.["supplier-pos"]) || []).filter(
    (po) => po && !["dibatalkan", "ditolak", "batal", "draft"].includes(normStr(po.status).toLowerCase())
  );
  const purchaseRequests = ((data?.["purchase-requests"]) || []).filter(
    (pr) => pr && !["dibatalkan", "ditolak", "batal"].includes(normStr(pr.status).toLowerCase())
  );
  const expenses = ((data?.expenses) || []).filter(
    (ex) => {
      if (!ex) return false;
      const st = normStr(ex.status).toLowerCase();
      return ["disetujui", "dibayar", "approved", "paid"].includes(st);
    }
  );
  const products = (data?.products || []).filter(Boolean);
  const stock = (data?.stock || []).filter(Boolean);
  const projects = (data?.projects || []).filter(Boolean);
  const deliveryNotes = (data?.["delivery-notes"] || []).filter(Boolean);
  const poClients = (data?.["po-client"] || []).filter(Boolean);

  const journalLines: JournalLine[] = [];
  let seq = 1;

  const pushJournalPair = (
    tanggal: string,
    refNo: string,
    sumber: JournalLine["sumber"],
    project: string,
    entries: { kodeAkun: string; keterangan: string; debit: number; kredit: number }[]
  ) => {
    const jNo = `JU-${String(seq++).padStart(4, "0")}`;
    entries.forEach((e, idx) => {
      if (e.debit === 0 && e.kredit === 0) return;
      const acc = activeCoa[e.kodeAkun];
      journalLines.push({
        id: `${jNo}-${idx + 1}`,
        journalNo: jNo,
        tanggal: normStr(tanggal, "2026-02-01"),
        refNo: normStr(refNo),
        sumber,
        keterangan: e.keterangan,
        project: normStr(project),
        kodeAkun: e.kodeAkun,
        namaAkun: acc ? acc.name : e.kodeAkun,
        debit: toNum(e.debit),
        kredit: toNum(e.kredit),
      });
    });
  };

  // 1. Journal Entries from Client Invoices (Accrual + Cash Receipt)
  for (const inv of invoices) {
    const nomor = normStr(inv.nomor, `INV-${inv.id}`);
    const tanggal = formatJournalDateTime(inv.tanggal || inv.date, inv.createdAt);
    const customer = normStr(inv.customer, "Pelanggan");
    const project = normStr(inv.project, "-");
    const pph = toNum(inv.pph);
    const tipePph = normStr(inv.tipePph || inv.pphMode);
    const total = toNum(inv.total) || Math.max(0, toNum(inv.nilai) + toNum(inv.ppn) - pph);
    const dpp = toNum(inv.nilai) || Math.round((total + pph) / 1.11);
    const ppn = toNum(inv.ppn) || Math.max(0, (total + pph) - dpp);
    const isLunas = normStr(inv.status).toLowerCase() === "lunas";
    const terbayar = isLunas ? Math.max(toNum(inv.terbayar), total) : Math.min(total, toNum(inv.terbayar));

    const isDp = inv.jenis === "DP" || String(inv.type).toUpperCase() === "DP" || String(nomor).includes("/DP/");
    const isDirectCashSale =
      isLunas &&
      (String(inv.description || "").includes("Pembayaran Langsung / Nota Kontan") ||
        String(inv.catatan || "").includes("Pembayaran Langsung") ||
        String(inv.catatan || "").includes("Nota Kontan") ||
        String(inv.catatan || "").includes("Penjualan Langsung (Walk-in)"));

    if (total > 0 || pph > 0) {
      if (isDirectCashSale) {
        // Penjualan Langsung / Nota Kontan (Walk-in): 1 Jurnal Kas Langsung (Debit Kas/Bank vs Kredit Pendapatan & PPN)
        const matchAcc =
          String(inv.description || "").match(/\[AKUN:([^\]]+)\]/)?.[1] ||
          String(inv.catatan || "").match(/\[AKUN:([^\]]+)\]/)?.[1] ||
          (Array.isArray(inv._payments) && inv._payments[0]?.reference?.match(/\[(1000\.\d+)\]/)?.[1]);
        const payMethodStr = String(inv._payments?.[0]?.method || (inv.catatan || "")).toUpperCase();
        const targetKasCode = matchAcc
          ? matchAcc
          : payMethodStr.includes("TUNAI") || payMethodStr.includes("KAS")
            ? "1000.01"
            : "1000.02";
        const targetKasLabel = activeCoa[targetKasCode]?.name || (targetKasCode === "1000.01" ? "Kas Kecil" : "Bank Mandiri PT GMP");

        pushJournalPair(tanggal, nomor, "Penjualan Langsung (Kas)", project, [
          {
            kodeAkun: targetKasCode,
            keterangan: `Penerimaan Penjualan Langsung (${targetKasLabel}) ${nomor} dari ${customer}`,
            debit: total,
            kredit: 0,
          },
          ...(pph > 0
            ? [
                {
                  kodeAkun: "1105",
                  keterangan: `Uang Muka PPh (${tipePph || "Dipotong Pelanggan"}) atas ${nomor}`,
                  debit: pph,
                  kredit: 0,
                },
              ]
            : []),
          {
            kodeAkun: "4000.01",
            keterangan: `Pendapatan Penjualan Langsung (${customer}) — ${nomor}`,
            debit: 0,
            kredit: dpp,
          },
          ...(ppn > 0
            ? [
                {
                  kodeAkun: "2100",
                  keterangan: `PPN Keluaran atas ${nomor}`,
                  debit: 0,
                  kredit: ppn,
                },
              ]
            : []),
        ]);
      } else if (isDp) {
        // Tagihan Uang Muka (DP) Penjualan: Piutang (Debit 110302) vs Uang Muka Penjualan (Kredit 210202)
        pushJournalPair(tanggal, nomor, "Invoice Client", project, [
          {
            kodeAkun: "110302",
            keterangan: `Tagihan Uang Muka (DP) Invoice ${nomor} — ${customer}`,
            debit: total,
            kredit: 0,
          },
          ...(pph > 0
            ? [
                {
                  kodeAkun: "1105",
                  keterangan: `Uang Muka PPh (${tipePph || "Dipotong Pelanggan"}) atas ${nomor}`,
                  debit: pph,
                  kredit: 0,
                },
              ]
            : []),
          {
            kodeAkun: "210202",
            keterangan: `Uang Muka Penjualan (Advance Sales) — ${nomor}`,
            debit: 0,
            kredit: dpp,
          },
          ...(ppn > 0
            ? [
                {
                  kodeAkun: "2100",
                  keterangan: `PPN Keluaran atas Uang Muka ${nomor}`,
                  debit: 0,
                  kredit: ppn,
                },
              ]
            : []),
        ]);
      } else {
        pushJournalPair(tanggal, nomor, "Invoice Client", project, [
          {
            kodeAkun: "110302",
            keterangan: `Tagihan Piutang Invoice ${nomor} — ${customer}`,
            debit: total,
            kredit: 0,
          },
          ...(pph > 0
            ? [
                {
                  kodeAkun: "1105",
                  keterangan: `Uang Muka PPh (${tipePph || "Dipotong Pelanggan"}) atas ${nomor}`,
                  debit: pph,
                  kredit: 0,
                },
              ]
            : []),
          {
            kodeAkun: "4000.01",
            keterangan: `Pendapatan Penjualan Proyek (${customer}) — ${nomor}`,
            debit: 0,
            kredit: dpp,
          },
          ...(ppn > 0
            ? [
                {
                  kodeAkun: "2100",
                  keterangan: `PPN Keluaran atas ${nomor}`,
                  debit: 0,
                  kredit: ppn,
                },
              ]
            : []),
        ]);
      }
    }

    if (terbayar > 0 && !isDirectCashSale) {
      const matchAcc =
        String(inv.catatan || "").match(/\[AKUN:([^\]]+)\]/)?.[1] ||
        (Array.isArray(inv._payments) && inv._payments[0]?.reference?.match(/\[(1000\.\d+)\]/)?.[1]);
      const payMethodStr = String(inv._payments?.[0]?.method || (inv.catatan || "")).toUpperCase();
      const targetKasCode = matchAcc
        ? matchAcc
        : payMethodStr.includes("TUNAI") || payMethodStr.includes("KAS")
          ? "1000.01"
          : "1000.02";
      const targetKasLabel = activeCoa[targetKasCode]?.name || (targetKasCode === "1000.01" ? "Kas Kecil" : "Bank Mandiri PT GMP");

      pushJournalPair(tanggal, `${nomor}/PAY`, "Pembayaran Invoice", project, [
        {
          kodeAkun: targetKasCode,
          keterangan: `Penerimaan Pembayaran (${targetKasLabel}) ${nomor} dari ${customer}`,
          debit: terbayar,
          kredit: 0,
        },
        {
          kodeAkun: "110302",
          keterangan: `Pelunasan Piutang Usaha ${nomor} (${customer})`,
          debit: 0,
          kredit: terbayar,
        },
      ]);
    }

    // Catat HPP (Debit 5102) & pengurangan Aset Persediaan (Kredit 1200) HANYA jika barang sudah dikirim lewat Surat Jalan (Dikirim / Diterima)
    const isRetailInv = !inv.projectId && (!inv.project || inv.project === "-");
    const catSoMatch = String(inv.catatan || "").match(/\b(SO[\-\/][^\s\)\]]+)\b/i);
    const invSoNum = (inv.po && inv.po !== "-" ? String(inv.po) : (catSoMatch?.[1] || "")).toLowerCase();

    const shippedDn = deliveryNotes.find((dn: any) => {
      const dnStatus = normStr(dn.status).toLowerCase();
      if (dnStatus !== "dikirim" && dnStatus !== "diterima") return false;
      if (inv.clientPoId && (String(dn.soId) === String(inv.clientPoId) || String(dn.clientPoId) === String(inv.clientPoId))) {
        return true;
      }
      if (inv.clientPoId && String(dn.alasan || "").includes(`[so:${inv.clientPoId}]`)) {
        return true;
      }
      if (invSoNum) {
        if (
          String(dn.soNumber || "").toLowerCase() === invSoNum ||
          String(dn.alasan || "").toLowerCase().includes(invSoNum) ||
          String(dn.reportText || "").toLowerCase().includes(invSoNum)
        ) {
          return true;
        }
      }
      return false;
    });

    const linkedSo = poClients.find((so: any) => {
      if (inv.clientPoId && String(so.id) === String(inv.clientPoId)) return true;
      if (invSoNum) {
        const sNum = String(so.nomorSo && so.nomorSo !== "-" ? so.nomorSo : (so.nomor || "")).toLowerCase();
        if (sNum && sNum === invSoNum) return true;
      }
      return false;
    });

    const effectiveInvItems =
      Array.isArray(inv.items) && inv.items.length > 0
        ? inv.items
        : Array.isArray(linkedSo?.items) && linkedSo.items.length > 0
          ? linkedSo.items
          : Array.isArray(shippedDn?.items) && shippedDn.items.length > 0
            ? shippedDn.items
            : [];

    if (isRetailInv && shippedDn && effectiveInvItems.length > 0) {
      const retailCost = effectiveInvItems.reduce((acc: number, it: any) => {
        const qty = Math.max(1, toNum(it.qty || 1));
        const prodMatch = products.find(
          (p: any) =>
            (it.productId && String(p.id) === String(it.productId)) ||
            normStr(p.nama || p.name).toLowerCase() === normStr(it.name || it.nama || it.item || it.product?.name).toLowerCase()
        );
        const unitCost =
          toNum(it.purchasePrice || it.hargaBeli || it.product?.purchasePrice || prodMatch?.hargaBeli || prodMatch?.purchasePrice) ||
          Math.round(toNum(it.price || it.harga || it.product?.sellPrice) * 0.7);
        return acc + qty * unitCost;
      }, 0);

      if (retailCost > 0) {
        pushJournalPair(tanggal, `${nomor}/HPP`, "HPP Penjualan Retail", "Penjualan Retail", [
          {
            kodeAkun: "5102",
            keterangan: `HPP Penjualan Barang Retail atas Invoice ${nomor} (${customer})`,
            debit: retailCost,
            kredit: 0,
          },
          {
            kodeAkun: "1200",
            keterangan: `Pengurangan Aset Persediaan Barang atas Penjualan Retail ${nomor}`,
            debit: 0,
            kredit: retailCost,
          },
        ]);
      }
    }
  }

  // 2. Journal Entries from Supplier POs & Direct Retail Purchase Requests
  // - Pengadaan untuk Project -> Debit 5101 (HPP Project) | Kredit 1000.01 (Kas) atau 210102 (Hutang Usaha)
  // - Pembelian untuk Retail / Stok Gudang -> Debit 1200 (Aset Persediaan Barang Dagang) | Kredit 1000.01 (Kas) atau 210102 (Hutang Usaha)
  let cogsProjectTotal = 0;
  let cogsRetailTotal = journalLines
    .filter((l) => l.kodeAkun === "5102")
    .reduce((s, l) => s + l.debit - l.kredit, 0);
  let cashOutDirectRetail = 0;

  for (const po of supplierPos) {
    const nomor = normStr(po.nomor, `PO-${po.id}`);
    const tanggal = formatJournalDateTime(po.tanggal || po.date, po.createdAt);
    const supplier = normStr(po.supplier, "Supplier");
    const poSuffix = normStr(po.nomor).replace(/^(?:POD|PO-S|PO)\//i, "");
    const linkedPr = purchaseRequests.find(
      (pr: any) =>
        (po.requestId && String(pr.id) === String(po.requestId)) ||
        (po.request && po.request !== "-" && normStr(pr.nomor).toLowerCase() === normStr(po.request).toLowerCase()) ||
        (pr.supplierPo && (String(pr.supplierPo.id) === String(po.id) || pr.supplierPo.number === po.nomor)) ||
        (Array.isArray(pr.supplierPOs) && pr.supplierPOs.some((sp: any) => String(sp.id) === String(po.id) || sp.number === po.nomor)) ||
        (po.nomor && String(pr.otherNote || "").includes(po.nomor)) ||
        (poSuffix && pr.nomor && normStr(pr.nomor).replace(/^(?:PNJ|REQ|PR)\//i, "") === poSuffix) ||
        (toNum(po.total) === toNum(pr.estimasi) && po.supplier && pr.supplier && normStr(po.supplier).toLowerCase() === normStr(pr.supplier).toLowerCase())
    );
    const hasValidProjectName =
      po.project &&
      !["-", "pengadaan & proyek", "pengadaan gudang", "stok", "retail", "stok gudang"].includes(
        normStr(po.project).toLowerCase()
      );
    const isProjectPo = !!(
      po.projectId ||
      linkedPr?.projectId ||
      hasValidProjectName ||
      String(po.costType || linkedPr?.costType || "").toUpperCase() === "PROJECT"
    );
    const projectLabel = isProjectPo
      ? normStr(hasValidProjectName ? po.project : (linkedPr?.project || po.projectKode || po.projectId), "Proyek")
      : "Stok Gudang / Retail";

    const total = toNum(po.total);
    const statusLower = normStr(po.status).toLowerCase();
    const isKasDirect =
      String(po.paymentMethod || linkedPr?.paymentMethod || "").toUpperCase() === "KAS" ||
      /kas|tunai|cash/i.test(String(po.paymentTerms || ""));

    // Standard Accounting (Accrual Basis):
    // PO adalah komitmen pesanan dan BUKAN dokumen pembukuan.
    // Jurnal pembelian baru dicatat jika ada Invoice Masuk dari Supplier atau pembelian kas langsung.
    const invMap = new Map<string, any>();
    (Array.isArray(po.invoiceIns) ? po.invoiceIns : []).forEach((inv: any) => {
      if (inv?.id != null) invMap.set(String(inv.id), inv);
    });
    (data?.invoiceIn || []).forEach((inv: any) => {
      const match =
        (inv.supplierPoId && String(inv.supplierPoId) === String(po.id)) ||
        (inv.po && normStr(inv.po).toLowerCase() === normStr(nomor).toLowerCase()) ||
        (inv.po && normStr(inv.po).toLowerCase() === normStr(po.nomor).toLowerCase()) ||
        (inv.po && normStr(inv.po).toLowerCase() === normStr(po.number).toLowerCase());
      if (match && inv?.id != null) {
        const idKey = String(inv.id);
        const existing = invMap.get(idKey) || {};
        invMap.set(idKey, { ...existing, ...inv });
      }
    });
    const linkedInvoices = Array.from(invMap.values()).filter(
      (inv: any) => !["batal", "dibatalkan"].includes(normStr(inv.status).toLowerCase())
    );

    const debitAccountCode = isProjectPo ? "5101" : "1200";

    // Kasus 1: Ada Invoice Masuk dari Supplier
    if (linkedInvoices.length > 0) {
      for (const inv of linkedInvoices) {
        const invDppRaw = toNum(inv.nilai ?? inv.amount);
        const invPpn = toNum(inv.ppn);
        const invTot = toNum(inv.total) || (invDppRaw + invPpn);
        const invDpp = invDppRaw > 0 ? invDppRaw : (invTot > 0 && invPpn > 0 ? Math.max(0, invTot - invPpn) : invTot);
        const invPaid = toNum(inv.paidAmount ?? inv.terbayar);
        const invNumber = normStr(inv.nomor || inv.number, nomor);
        const invDate = formatJournalDateTime(inv.tanggal || inv.date || inv.dueDate, inv.createdAt || po.tanggal);

        let invCoa = String(inv.coaAccount || "").trim();
        const pmts: any[] = inv.payments || inv._payments || [];
        for (const p of pmts) {
          const match = (p.reference || "").match(/\[(?:AKUN|COA):([^\]]+)\]/i);
          if (match?.[1]) {
            invCoa = match[1].trim();
            break;
          }
        }
        const effFundingSource = invCoa || po.fundingSource || linkedPr?.fundingSource || "1000.01";
        const effFundingCode =
          activeCoa[effFundingSource]?.code ||
          (effFundingSource === "1000.02" || /mandiri|bank/i.test(String(effFundingSource))
            ? "1000.02"
            : "1000.01");
        const effFundingLabel = activeCoa[effFundingCode]?.name || "Kas/Bank";

        const isInvPaid =
          inv.status === "PAID" ||
          inv.status === "Lunas" ||
          (invPaid >= invTot && invTot > 0) ||
          Boolean(po.isPaid) ||
          statusLower === "lunas" ||
          statusLower === "selesai";

        if (invTot > 0) {
          if (isProjectPo) {
            cogsProjectTotal += invDpp;
          }

          // Tahap 1: Pengakuan Tagihan / Hutang Usaha (per tanggal Invoice Supplier)
          const invoiceDebits: { kodeAkun: string; keterangan: string; debit: number; kredit: number }[] = [
            {
              kodeAkun: debitAccountCode,
              keterangan: isProjectPo
                ? `HPP Project Pengadaan PO ${nomor} (${invNumber}) — ${supplier}`
                : `Pembelian Aset Persediaan Stok/Retail PO ${nomor} (${invNumber}) — ${supplier}`,
              debit: invDpp,
              kredit: 0,
            },
          ];

          if (invPpn > 0) {
            invoiceDebits.push({
              kodeAkun: "1600",
              keterangan: `PPN Masukan (11%) Invoice ${invNumber} atas PO ${nomor} (${supplier})`,
              debit: invPpn,
              kredit: 0,
            });
          }

          pushJournalPair(invDate, `${nomor} (${invNumber})`, "PO Supplier", projectLabel, [
            ...invoiceDebits,
            {
              kodeAkun: "210102",
              keterangan: `Hutang Usaha Supplier atas Invoice ${invNumber} (${supplier})`,
              debit: 0,
              kredit: invTot,
            },
          ]);

          // Tahap 2: Pelunasan Hutang (saat Invoice dibayar/lunas)
          if (pmts.length > 0) {
            for (const p of pmts) {
              const pAmt = toNum(p.amount);
              if (pAmt > 0) {
                const pDate = formatJournalDateTime(p.date || inv.tanggal || inv.date || inv.dueDate, p.createdAt || inv.createdAt || invDate);
                pushJournalPair(pDate, `${invNumber}/PAY`, "Pelunasan PO", projectLabel, [
                  {
                    kodeAkun: "210102",
                    keterangan: `Penyelesaian Hutang Invoice ${invNumber} — ${supplier}`,
                    debit: pAmt,
                    kredit: 0,
                  },
                  {
                    kodeAkun: effFundingCode,
                    keterangan: `Pengeluaran ${effFundingLabel} Pembayaran Invoice ${invNumber} ke ${supplier}`,
                    debit: 0,
                    kredit: pAmt,
                  },
                ]);
              }
            }
          } else if (isInvPaid) {
            const payAmt = invPaid > 0 ? invPaid : invTot;
            pushJournalPair(invDate, `${invNumber}/SETTLE`, "Pelunasan PO", projectLabel, [
              {
                kodeAkun: "210102",
                keterangan: `Penyelesaian Hutang Invoice ${invNumber} — ${supplier}`,
                debit: payAmt,
                kredit: 0,
              },
              {
                kodeAkun: effFundingCode,
                keterangan: `Pengeluaran ${effFundingLabel} Pelunasan Invoice ${invNumber} ke ${supplier}`,
                debit: 0,
                kredit: payAmt,
              },
            ]);
          }
        }
      }
    } else if (isKasDirect || Boolean(po.isPaid) || statusLower === "lunas" || statusLower === "dibayar") {
      // Kasus 2: Pembelian Langsung Tunai / Kas tanpa invoice tempo terpisah
      if (total > 0) {
        if (isProjectPo) {
          cogsProjectTotal += total;
        }
        const poFundingSource = po.fundingSource || linkedPr?.fundingSource || "1000.01";
        const poFundingCode =
          activeCoa[poFundingSource]?.code ||
          (poFundingSource === "1000.02" || /mandiri|bank/i.test(String(poFundingSource))
            ? "1000.02"
            : "1000.01");
        const poFundingLabel = activeCoa[poFundingCode]?.name || "Kas/Bank";

        pushJournalPair(tanggal, nomor, "PO Supplier", projectLabel, [
          {
            kodeAkun: debitAccountCode,
            keterangan: isProjectPo
              ? `HPP Project Pengadaan PO ${nomor} — ${supplier}`
              : `Pembelian Aset Persediaan Stok/Retail PO ${nomor} — ${supplier}`,
            debit: total,
            kredit: 0,
          },
          {
            kodeAkun: poFundingCode,
            keterangan: `Pengeluaran ${poFundingLabel} Pembelian Langsung PO ${nomor} ke ${supplier}`,
            debit: 0,
            kredit: total,
          },
        ]);
      }
    }
    // Kasus 3: PO bertempo yang belum ada invoice supplier -> TIDAK dijurnal (sesuai standar akuntansi)
  }

  // 2b. Standalone Supplier Invoices / Invoice Masuk Langsung (Tagihan Listrik, Internet, Operasional, atau Supplier tanpa PO)
  const standaloneInvoices = (data?.invoiceIn || []).filter(
    (inv: any) =>
      inv &&
      !["batal", "dibatalkan"].includes(normStr(inv.status).toLowerCase()) &&
      !supplierPos.some((po: any) =>
        (inv.supplierPoId && String(inv.supplierPoId) === String(po.id)) ||
        (inv.po && normStr(inv.po).toLowerCase() === normStr(po.nomor || po.number).toLowerCase())
      )
  );

  const standaloneOpexList: Array<{ kategori: string; nominal: number }> = [];
  let cashOutStandaloneInvoices = 0;

  for (const inv of standaloneInvoices) {
    const invDppRaw = toNum(inv.nilai ?? inv.amount);
    const invPpn = toNum(inv.ppn);
    const invTot = toNum(inv.total) || (invDppRaw + invPpn);
    const invDpp = invDppRaw > 0 ? invDppRaw : (invTot > 0 && invPpn > 0 ? Math.max(0, invTot - invPpn) : invTot);
    const invPaid = toNum(inv.paidAmount ?? inv.terbayar);
    const invNumber = normStr(inv.nomor || inv.number, `INV-IN-${inv.id}`);
    const invDate = formatJournalDateTime(inv.tanggal || inv.date, inv.createdAt);
    const supplier = normStr(inv.supplier, "Supplier / Vendor");

    let invCoa = String(inv.coaAccount || "").trim();
    const pmts: any[] = inv.payments || inv._payments || [];
    for (const p of pmts) {
      const match = (p.reference || "").match(/\[(?:AKUN|COA):([^\]]+)\]/i);
      if (match?.[1]) {
        invCoa = match[1].trim();
        break;
      }
    }
    const effFundingCode =
      activeCoa[invCoa]?.code ||
      (invCoa === "1000.02" || /mandiri|bank/i.test(invCoa) ? "1000.02" : "1000.01");
    const effFundingLabel = activeCoa[effFundingCode]?.name || "Kas/Bank";
    const isInvPaid =
      inv.status === "PAID" ||
      inv.status === "Lunas" ||
      (invPaid >= invTot && invTot > 0);

    // Resolve debit account (Expense / COGS / Inventory)
    const rawDebitAcc = String(inv.debitAccount || "").trim();
    const textHint = `${inv.category || ""} ${inv.jenis || ""} ${inv.catatan || ""} ${supplier}`.toLowerCase();
    let debitCode = activeCoa[rawDebitAcc]?.code || "";
    if (!debitCode) {
      if (/listrik|pln|token/.test(textHint)) debitCode = "6202.01";
      else if (/internet|wifi|indihome|biznet|telkom|telepon|pulsa|komunikasi/.test(textHint)) debitCode = "6202.03";
      else if (/air|pdam|pam/.test(textHint)) debitCode = "6202.02";
      else if (/atk|alat tulis|kertas|printer/.test(textHint)) debitCode = "6202.06";
      else if (/gedung|sewa|kantor|kebersihan|keamanan/.test(textHint)) debitCode = "6203.01";
      else if (/kendaraan|servis|oli|bengkel|bensin|bbm|tol|parkir/.test(textHint)) debitCode = "6203.02";
      else if (/iklan|promosi|marketing/.test(textHint)) debitCode = "6101";
      else if (/proyek|project/.test(textHint)) debitCode = "5101";
      else if (/operasional|tagihan|beban|biaya|jasa/.test(textHint)) debitCode = "6202.07";
      else debitCode = "1200";
    }
    const debitAccName = activeCoa[debitCode]?.name || "Persediaan / Beban Operasional";
    const invCategoryLabel = normStr(
      inv.category && inv.category !== "Tagihan Supplier" ? inv.category : debitAccName,
      debitAccName
    );
    const invSumber = debitCode.startsWith("6") || debitCode.startsWith("7") ? "Invoice Masuk" : "PO Supplier";
    const invProjLabel = debitCode.startsWith("6") || debitCode.startsWith("7") ? "Operasional Umum" : "Stok Gudang / Retail";

    if (invTot > 0) {
      if (debitCode === "5101") {
        cogsProjectTotal += invDpp;
      } else if (debitCode === "5102") {
        cogsRetailTotal += invDpp;
      } else if (debitCode.startsWith("6") || debitCode.startsWith("7")) {
        standaloneOpexList.push({ kategori: invCategoryLabel, nominal: invDpp });
      }

      const invoiceDebits = [
        {
          kodeAkun: debitCode,
          keterangan: `${debitAccName} — Invoice Masuk ${invNumber} (${supplier})`,
          debit: invDpp,
          kredit: 0,
        },
      ];
      if (invPpn > 0) {
        invoiceDebits.push({
          kodeAkun: "1600",
          keterangan: `PPN Masukan (11%) Invoice ${invNumber} (${supplier})`,
          debit: invPpn,
          kredit: 0,
        });
      }
      pushJournalPair(invDate, invNumber, invSumber, invProjLabel, [
        ...invoiceDebits,
        {
          kodeAkun: "210102",
          keterangan: `Hutang Usaha / Tagihan Masuk ${invNumber} (${supplier})`,
          debit: 0,
          kredit: invTot,
        },
      ]);

      if (pmts.length > 0) {
        for (const p of pmts) {
          const pAmt = toNum(p.amount);
          if (pAmt > 0) {
            cashOutStandaloneInvoices += pAmt;
            const pDate = formatJournalDateTime(p.date || inv.tanggal || inv.date, p.createdAt || inv.createdAt || invDate);
            pushJournalPair(pDate, `${invNumber}/PAY`, "Pelunasan PO", invProjLabel, [
              {
                kodeAkun: "210102",
                keterangan: `Penyelesaian Hutang Invoice Masuk ${invNumber} — ${supplier}`,
                debit: pAmt,
                kredit: 0,
              },
              {
                kodeAkun: effFundingCode,
                keterangan: `Pengeluaran ${effFundingLabel} Pembayaran Invoice ${invNumber} ke ${supplier}`,
                debit: 0,
                kredit: pAmt,
              },
            ]);
          }
        }
      } else if (isInvPaid) {
        const payAmt = invPaid > 0 ? invPaid : invTot;
        cashOutStandaloneInvoices += payAmt;
        pushJournalPair(invDate, `${invNumber}/SETTLE`, "Pelunasan PO", invProjLabel, [
          {
            kodeAkun: "210102",
            keterangan: `Penyelesaian Hutang Invoice Masuk ${invNumber} — ${supplier}`,
            debit: payAmt,
            kredit: 0,
          },
          {
            kodeAkun: effFundingCode,
            keterangan: `Pengeluaran ${effFundingLabel} Pelunasan Invoice ${invNumber} ke ${supplier}`,
            debit: 0,
            kredit: payAmt,
          },
        ]);
      }
    }
  }

  // 2b. Request Barang (Ambil Stok Gudang untuk Project & Pembelian Ritel Tunai / Tempo)
  for (const pr of purchaseRequests) {
    const stLower = normStr(pr.status).toLowerCase();
    const rawStUpper = String(pr.rawStatus || "").toUpperCase();
    const isApprovedOrDone =
      ["disetujui", "dibayar", "dikirim", "diterima", "selesai", "lunas"].includes(stLower) ||
      stLower.includes("diterima") ||
      (stLower.includes("lunas") && !stLower.includes("belum")) ||
      ["DISETUJUI", "DIBAYAR", "DIKIRIM", "DITERIMA"].includes(rawStUpper);
    if (!isApprovedOrDone) continue;

    const prSuffix = normStr(pr.nomor).replace(/^(?:PNJ|REQ|PR)\//i, "");
    const hasPo = supplierPos.some(
      (po: any) =>
        (po.requestId && String(po.requestId) === String(pr.id)) ||
        (pr.nomor && po.request && po.request !== "-" && normStr(po.request).toLowerCase() === normStr(pr.nomor).toLowerCase()) ||
        (pr.supplierPo && (String(pr.supplierPo.id) === String(po.id) || pr.supplierPo.number === po.nomor)) ||
        (Array.isArray(pr.supplierPOs) && pr.supplierPOs.some((sp: any) => String(sp.id) === String(po.id) || sp.number === po.nomor)) ||
        (po.nomor && String(pr.otherNote || "").includes(po.nomor)) ||
        (prSuffix && po.nomor && normStr(po.nomor).replace(/^(?:POD|PO-S|PO)\//i, "") === prSuffix) ||
        (toNum(po.total) === toNum(pr.estimasi) && po.supplier && pr.supplier && normStr(po.supplier).toLowerCase() === normStr(pr.supplier).toLowerCase())
    );
    if (hasPo) continue;

    const totalPr = toNum(pr.estimasi);
    if (totalPr <= 0) continue;

    const nomorPr = normStr(pr.nomor, `PR-${pr.id}`);
    const tanggalPr = formatJournalDateTime(pr.tanggal || pr.date, pr.createdAt);
    const isProjectPr =
      String(pr.costType || "").toUpperCase() === "PROJECT" ||
      !!(pr.projectId || (pr.project && pr.project !== "-"));
    const projectLabel = isProjectPr ? normStr(pr.project, "Proyek") : "Stok Gudang / Retail";
    const debitCode = isProjectPr ? "5101" : "1200";

    const procSource = String(pr.procurementSource || "").toUpperCase();

    // ─── Flow 1: Ambil Stok Gudang untuk Project (Internal Material Transfer) ───
    if (procSource === "GUDANG") {
      const isDispatchedOrReceived = ["dikirim", "diterima", "selesai"].includes(stLower);
      if (isDispatchedOrReceived && isProjectPr) {
        cogsProjectTotal += totalPr;
        pushJournalPair(tanggalPr, nomorPr, "Request Barang / Ritel", projectLabel, [
          {
            kodeAkun: "5101",
            keterangan: `HPP Project (Bahan/Material dari Gudang) ${nomorPr} (${normStr(pr.item, pr.tujuan)})`,
            debit: totalPr,
            kredit: 0,
          },
          {
            kodeAkun: "1200",
            keterangan: `Pengeluaran Persediaan Barang Gudang ${nomorPr}`,
            debit: 0,
            kredit: totalPr,
          },
        ]);
      }
      continue;
    }

    // ─── Flow 2 & 3: Pembelian Ritel / Non-PO (Tunai vs Hutang/Tempo) ───
    const isRetailSource = procSource === "RETAIL" || !procSource || procSource === "SUPPLIER";
    if (!isRetailSource) continue;

    const isKasPr = String(pr.paymentMethod || "").toUpperCase() === "KAS";
    const isPaid =
      String(pr.paymentStatus || "").toUpperCase() === "DIBAYAR" ||
      !!pr.paymentProofFileId ||
      !!pr.buktiPembayaran ||
      stLower === "dibayar" ||
      stLower === "lunas" ||
      (stLower.includes("lunas") && !stLower.includes("belum")) ||
      (pr.otherNote as string)?.includes("[DIBAYAR");

    const prFundingCode =
      pr.fundingSource === "1000.02" || /mandiri|bank/i.test(String(pr.fundingSource || ""))
        ? "1000.02"
        : pr.fundingSource === "1000.01" || /kecil|petty/i.test(String(pr.fundingSource || ""))
          ? "1000.01"
          : (activeCoa[pr.fundingSource]?.code || "1000.01");
    const prFundingLabel = activeCoa[prFundingCode]?.name || "Kas Kecil";

    const ppnMode = String(
      pr.ppnMode ||
      (pr.otherNote?.match(/\[PPN:([^\]]+)\]/)?.[1] ?? "none")
    ).toLowerCase();

    let dppPr = totalPr;
    let ppnPr = 0;
    let effTotalPr = totalPr;

    if (ppnMode === "exclude") {
      const itemsSum = Array.isArray(pr.items) && pr.items.length > 0
        ? pr.items.reduce((s: number, i: any) => s + (Number(i.qty) || 1) * (Number(i.unitCost ?? i.price) || 0), 0)
        : 0;

      if (itemsSum > 0 && Math.abs(totalPr - Math.round(itemsSum * 1.11)) <= 1) {
        dppPr = itemsSum;
        ppnPr = totalPr - dppPr;
        effTotalPr = totalPr;
      } else if (itemsSum > 0 && Math.abs(totalPr - itemsSum) <= 1) {
        dppPr = itemsSum;
        ppnPr = Math.round(itemsSum * 0.11);
        effTotalPr = dppPr + ppnPr;
      } else {
        dppPr = Math.round(totalPr / 1.11);
        ppnPr = totalPr - dppPr;
        effTotalPr = totalPr;
      }
    } else if (ppnMode === "include") {
      effTotalPr = totalPr;
      dppPr = Math.round(totalPr / 1.11);
      ppnPr = Math.max(0, totalPr - dppPr);
    }

    if (isKasPr) {
      // Pembelian Ritel Tunai / Lunas: Jurnal Kas Keluar tercatat saat ditandai Dibayar
      if (!isPaid && !["dibayar", "dikirim", "diterima", "selesai"].includes(stLower)) continue;

      if (isProjectPr) cogsProjectTotal += dppPr;
      cashOutDirectRetail += effTotalPr;

      const debitDesc = isProjectPr
        ? `HPP Project Beli Ritel Tunai ${nomorPr} (${normStr(pr.item, pr.tujuan)})`
        : `Pembelian Aset Persediaan Ritel Tunai ${nomorPr} (${normStr(pr.item, pr.tujuan)})`;

      pushJournalPair(tanggalPr, nomorPr, "Request Barang / Ritel", projectLabel, [
        {
          kodeAkun: debitCode,
          keterangan: debitDesc,
          debit: dppPr,
          kredit: 0,
        },
        ...(ppnPr > 0
          ? [
              {
                kodeAkun: "1600",
                keterangan: `PPN Masukan (11%) Beli Ritel ${nomorPr}`,
                debit: ppnPr,
                kredit: 0,
              },
            ]
          : []),
        {
          kodeAkun: prFundingCode,
          keterangan: `Pengeluaran ${prFundingLabel} Beli Ritel ${nomorPr}`,
          debit: 0,
          kredit: effTotalPr,
        },
      ]);
    } else {
      // Pembelian Ritel Hutang / Tempo / Nota Bon Toko
      const isDispatchedOrReceived =
        ["dikirim", "diterima", "selesai", "lunas"].includes(stLower) ||
        stLower.includes("diterima") ||
        stLower.includes("dikirim") ||
        stLower.includes("lunas") ||
        ["DIKIRIM", "DITERIMA"].includes(rawStUpper);

      // Tahap 1: Pengakuan Hutang saat barang & nota bon dikirim/diterima
      if (isDispatchedOrReceived || isPaid) {
        if (isProjectPr) cogsProjectTotal += dppPr;

        const debitDesc = isProjectPr
          ? `HPP Project Beli Ritel Tempo ${nomorPr} (${normStr(pr.item, pr.tujuan)})`
          : `Persediaan Beli Ritel Tempo ${nomorPr} (${normStr(pr.item, pr.tujuan)})`;

        pushJournalPair(tanggalPr, nomorPr, "Request Barang / Ritel", projectLabel, [
          {
            kodeAkun: debitCode,
            keterangan: debitDesc,
            debit: dppPr,
            kredit: 0,
          },
          ...(ppnPr > 0
            ? [
                {
                  kodeAkun: "1600",
                  keterangan: `PPN Masukan (11%) Beli Ritel ${nomorPr}`,
                  debit: ppnPr,
                  kredit: 0,
                },
              ]
            : []),
          {
            kodeAkun: "210102",
            keterangan: `Hutang Usaha Toko Ritel ${nomorPr} (${normStr(pr.supplier, "Toko")})`,
            debit: 0,
            kredit: effTotalPr,
          },
        ]);
      }

      // Tahap 2: Pelunasan Hutang saat Finance bayar
      if (isPaid) {
        cashOutDirectRetail += effTotalPr;
        pushJournalPair(tanggalPr, nomorPr, "Request Barang / Ritel", projectLabel, [
          {
            kodeAkun: "210102",
            keterangan: `Pelunasan Hutang Toko Ritel ${nomorPr}`,
            debit: effTotalPr,
            kredit: 0,
          },
          {
            kodeAkun: prFundingCode,
            keterangan: `Pengeluaran ${prFundingLabel} Pelunasan Hutang ${nomorPr}`,
            debit: 0,
            kredit: effTotalPr,
          },
        ]);
      }
    }
  }

  // 3. Journal Entries from Operational Expenses (Accrual + Reimbursement Payout)
  for (const ex of expenses) {
    const refNo = `EXP-${String(ex.id).padStart(3, "0")}`;
    const tanggal = formatJournalDateTime(ex.tanggal || ex.date, ex.createdAt);
    const pelapor = normStr(ex.pelapor, "Staf");
    const kategori = normStr(ex.kategori, "Operasional");
    const project = normStr(ex.project, "Operasional Umum");
    const nominal = toNum(ex.nominal);
    const alasan = normStr(ex.alasan, kategori);
    const isDibayar = normStr(ex.status).toLowerCase() === "dibayar";
    const coaExpenseCode = resolveExpenseCoaCode(kategori, alasan);
    const isReimburse =
      coaExpenseCode === "6202.08" ||
      /reimburse/i.test(`${kategori} ${alasan}`);

    if (nominal > 0) {
      pushJournalPair(
        tanggal,
        refNo,
        isReimburse ? "Reimburse" : "Pengeluaran (Expense)",
        project,
        [
          {
            kodeAkun: coaExpenseCode,
            keterangan: `${isReimburse ? "Beban Reimburse" : `Beban ${kategori}`}: ${alasan} (${pelapor})`,
            debit: nominal,
            kredit: 0,
          },
          {
            kodeAkun: "2103",
            keterangan: `Kewajiban Biaya/Reimbursement ${kategori} — ${pelapor}`,
            debit: 0,
            kredit: nominal,
          },
        ]
      );

      if (isDibayar) {
        pushJournalPair(
          tanggal,
          `${refNo}/PAY`,
          isReimburse ? "Pembayaran Reimburse" : "Pembayaran Pengeluaran",
          project,
          [
            {
              kodeAkun: "2103",
              keterangan: `Pelunasan Biaya/Reimbursement ${refNo} kepada ${pelapor}`,
              debit: nominal,
              kredit: 0,
            },
            {
              kodeAkun: "1000.01",
              keterangan: `Pengeluaran Kas/Bank ${kategori} (${pelapor})`,
              debit: 0,
              kredit: nominal,
            },
          ]
        );
      }
    }
  }

  // 3b. Manual Journals (Entri Jurnal Penyesuaian Manual)
  for (const mj of manualJournals) {
    const jNo = mj.journalNo || `JM-${String(seq++).padStart(4, "0")}`;
    const tanggal = formatJournalDateTime(mj.tanggal, mj.createdAt);
    const refNo = normStr(mj.refNo, "-");
    const project = normStr(mj.project, "-");

    (mj.lines || []).forEach((l, idx) => {
      const d = toNum(l.debit);
      const k = toNum(l.kredit);
      if (d === 0 && k === 0) return;
      const acc = activeCoa[l.kodeAkun];
      journalLines.push({
        id: `${jNo}-${idx + 1}`,
        journalNo: jNo,
        tanggal,
        refNo,
        sumber: "Jurnal Manual",
        keterangan: l.keterangan || mj.keterangan,
        project,
        kodeAkun: l.kodeAkun,
        namaAkun: acc ? acc.name : l.kodeAkun,
        debit: d,
        kredit: k,
      });
    });
  }

  // 3c. Journal Entries from Payroll (Beban Gaji, Titipan PPh 21, Titipan BPJS, Kas/Bank)
  const payrollSlips = ((data?.payrollSlips || data?.payroll || []) as any[]).filter(
    (p) => p && normStr(p.status).toUpperCase() === "PAID"
  );
  for (const p of payrollSlips) {
    const slipNo = normStr(p.nomor, `PAY-${p.period}-${p.userId || p.id}`);
    const tanggal = formatJournalDateTime(p.paidAt ? String(p.paidAt) : p.tanggal, p.createdAt);
    const karyawan = normStr(p.userName || p.user?.name, `Karyawan #${p.userId}`);
    const gross = toNum(p.grossSalary || p.gross);
    const pph21 = toNum(p.pph21);
    const bpjs = toNum(p.bpjs);
    const net = toNum(p.netSalary || p.net) || Math.max(0, gross - pph21 - bpjs);

    if (gross > 0) {
      const pairLines: Array<{ kodeAkun: string; keterangan: string; debit: number; kredit: number }> = [
        {
          kodeAkun: "6201.01",
          keterangan: `Beban Gaji Karyawan (${karyawan} - Periode ${p.period})`,
          debit: gross,
          kredit: 0,
        },
      ];

      if (pph21 > 0) {
        pairLines.push({
          kodeAkun: "2105",
          keterangan: `Hutang/Titipan PPh 21 Gaji (${karyawan} - ${p.period})`,
          debit: 0,
          kredit: pph21,
        });
      }
      if (bpjs > 0) {
        pairLines.push({
          kodeAkun: "2107",
          keterangan: `Hutang/Titipan BPJS Karyawan (${karyawan} - ${p.period})`,
          debit: 0,
          kredit: bpjs,
        });
      }
      pairLines.push({
        kodeAkun: "1000.02",
        keterangan: `Pembayaran Net Gaji ke Rekening (${karyawan} - ${p.period})`,
        debit: 0,
        kredit: net,
      });

      pushJournalPair(
        tanggal,
        slipNo,
        "Payroll & Gaji",
        "Operasional Umum",
        pairLines
      );
    }
  }

  // Sort journal lines chronologically (newest first for display, keeping pair order intact)
  const totalDebit = journalLines.reduce((sum, l) => sum + l.debit, 0);
  const totalKredit = journalLines.reduce((sum, l) => sum + l.kredit, 0);

  // 4. Income Statement (Laba Rugi)
  let revenueGross = 0;
  let revenueDpp = 0;
  let ppnKeluaran = 0;
  let totalPphWithheld = 0;
  let paidCashIn = 0;

  for (const inv of invoices) {
    const pph = toNum(inv.pph);
    const total = toNum(inv.total) || Math.max(0, toNum(inv.nilai) + toNum(inv.ppn) - pph);
    const dpp = toNum(inv.nilai) || Math.round((total + pph) / 1.11);
    const ppn = toNum(inv.ppn) || Math.max(0, (total + pph) - dpp);
    const isLunas = normStr(inv.status).toLowerCase() === "lunas";
    const terbayar = isLunas ? Math.max(toNum(inv.terbayar), total) : Math.min(total, toNum(inv.terbayar));

    revenueGross += (dpp + ppn);
    revenueDpp += dpp;
    ppnKeluaran += ppn;
    totalPphWithheld += pph;
    paidCashIn += terbayar;
  }

  const manual5101 = journalLines
    .filter((l) => l.sumber === "Jurnal Manual" && l.kodeAkun === "5101")
    .reduce((s, l) => s + l.debit - l.kredit, 0);
  const manual5102 = journalLines
    .filter((l) => l.sumber === "Jurnal Manual" && l.kodeAkun === "5102")
    .reduce((s, l) => s + l.debit - l.kredit, 0);

  const cogsProject = Math.max(0, cogsProjectTotal + manual5101);
  const cogsRetail = Math.max(0, cogsRetailTotal + manual5102);
  const cogsTotal = cogsProject + cogsRetail;
  const grossProfit = revenueDpp - cogsTotal;
  const grossMarginPct = revenueDpp > 0 ? Math.round((grossProfit / revenueDpp) * 1000) / 10 : 0;

  const opexMap = new Map<string, { nominal: number; count: number }>();
  let opexTotal = 0;
  let expensesTableTotal = 0;
  for (const ex of expenses) {
    const kat = normStr(ex.kategori, "Operasional Lainnya");
    const nom = toNum(ex.nominal);
    opexTotal += nom;
    expensesTableTotal += nom;
    const prev = opexMap.get(kat) || { nominal: 0, count: 0 };
    opexMap.set(kat, { nominal: prev.nominal + nom, count: prev.count + 1 });
  }
  for (const sop of standaloneOpexList) {
    const kat = normStr(sop.kategori, "Tagihan Operasional");
    const nom = toNum(sop.nominal);
    if (nom > 0) {
      opexTotal += nom;
      const prev = opexMap.get(kat) || { nominal: 0, count: 0 };
      opexMap.set(kat, { nominal: prev.nominal + nom, count: prev.count + 1 });
    }
  }

  const opexByCategory = Array.from(opexMap.entries())
    .map(([kategori, v]) => ({ kategori, nominal: v.nominal, count: v.count }))
    .sort((a, b) => b.nominal - a.nominal);

  const operatingProfit = grossProfit - opexTotal;
  const netProfit = operatingProfit;
  const netMarginPct = revenueDpp > 0 ? Math.round((netProfit / revenueDpp) * 1000) / 10 : 0;

  // Per-Project P&L Breakdown
  const projectKeySet = new Set<string>();
  projects.forEach((p: any) => {
    const code = normStr(p.kode, "");
    if (code && code !== "-") projectKeySet.add(code);
  });
  invoices.forEach((inv: any) => {
    const code = normStr(inv.project, "");
    if (code && code !== "-") projectKeySet.add(code);
  });
  expenses.forEach((ex: any) => {
    const code = normStr(ex.project, "");
    if (code && code !== "-") projectKeySet.add(code);
  });

  const projectRows: ProjectPnlRow[] = Array.from(projectKeySet).map((projCode) => {
    const pObj = projects.find((p: any) => normStr(p.kode) === projCode || normStr(p.nama) === projCode);
    const pInvs = invoices.filter((inv: any) => normStr(inv.project) === projCode);
    const pExps = expenses.filter((ex: any) => normStr(ex.project) === projCode);
    const pPos = supplierPos.filter(
      (po: any) => normStr(po.project) === projCode || normStr(po.projectKode) === projCode
    );

    const pRevGross = pInvs.reduce((s, i) => s + (toNum(i.total) || toNum(i.nilai) + toNum(i.ppn)), 0);
    const pRevDpp = pInvs.reduce((s, i) => {
      const tot = toNum(i.total) || toNum(i.nilai) + toNum(i.ppn);
      return s + (toNum(i.nilai) || Math.round(tot / 1.11));
    }, 0);
    const pPpn = Math.max(0, pRevGross - pRevDpp);
    const pPaid = pInvs.reduce((s, i) => {
      const tot = toNum(i.total) || toNum(i.nilai) + toNum(i.ppn);
      const lunas = normStr(i.status).toLowerCase() === "lunas";
      return s + (lunas ? Math.max(toNum(i.terbayar), tot) : Math.min(tot, toNum(i.terbayar)));
    }, 0);
    const pAr = Math.max(0, pRevGross - pPaid);
    const pCogs = pPos.reduce((s, po) => s + toNum(po.total), 0);
    const pOpex = pExps.reduce((s, ex) => s + toNum(ex.nominal), 0);
    const pGross = pRevDpp - pCogs;
    const pNet = pGross - pOpex;
    const pMargin = pRevDpp > 0 ? Math.round((pNet / pRevDpp) * 1000) / 10 : 0;

    return {
      project: projCode,
      customer: normStr(pObj?.customer || pInvs[0]?.customer, "Internal / Umum"),
      revenueGross: pRevGross,
      revenueDpp: pRevDpp,
      ppnKeluaran: pPpn,
      paidCashIn: pPaid,
      arOutstanding: pAr,
      cogsPo: pCogs,
      opexExpense: pOpex,
      grossProfit: pGross,
      netProfit: pNet,
      marginPct: pMargin,
      statusKesehatan: pNet < 0 ? "Rugi" : pMargin < 15 ? "Waspada" : "Sehat",
    };
  });

  // 5. Cash Flow Statement (Arus Kas - Metode Langsung)
  const cashFlowItems: CashFlowItem[] = [];
  let cashInCustomers = 0;
  let cashOutSuppliers = 0;
  let cashOutExpenses = 0;

  for (const inv of invoices) {
    const total = toNum(inv.total) || toNum(inv.nilai) + toNum(inv.ppn);
    const isLunas = normStr(inv.status).toLowerCase() === "lunas";
    const terbayar = isLunas ? Math.max(toNum(inv.terbayar), total) : Math.min(total, toNum(inv.terbayar));
    if (terbayar > 0) {
      cashInCustomers += terbayar;
      cashFlowItems.push({
        id: `CF-IN-${inv.id || inv.nomor}`,
        tanggal: normStr(inv.tanggal, "2026-02-01"),
        refNo: normStr(inv.nomor),
        kategori: "Arus Kas Masuk (Pelanggan)",
        pihak: normStr(inv.customer),
        project: normStr(inv.project),
        keterangan: `Pembayaran Invoice ${normStr(inv.nomor)} (${normStr(inv.status)})`,
        masuk: terbayar,
        keluar: 0,
      });
    }
  }

  for (const po of supplierPos) {
    const nomor = normStr(po.nomor || po.number);
    const statusLower = normStr(po.status).toLowerCase();
    const isKasDirect =
      String(po.paymentMethod || "").toUpperCase() === "KAS" ||
      /kas|tunai|cash/i.test(String(po.paymentTerms || ""));
    const rawLinkedInvs = (
      Array.isArray(po.invoiceIns) && po.invoiceIns.length > 0
        ? po.invoiceIns
        : (data?.invoiceIn || []).filter(
            (inv: any) =>
              (inv.supplierPoId && String(inv.supplierPoId) === String(po.id)) ||
              (inv.po && normStr(inv.po).toLowerCase() === nomor.toLowerCase()) ||
              (inv.po && normStr(inv.po).toLowerCase() === normStr(po.nomor).toLowerCase())
          )
    ).filter((i: any) => !["batal", "dibatalkan"].includes(normStr(i.status).toLowerCase()));

    const hasPaidInvoice = rawLinkedInvs.some(
      (inv: any) =>
        inv.status === "PAID" ||
        inv.status === "Lunas" ||
        (Number(inv.paidAmount || 0) >= Number(inv.total || 0) && Number(inv.total || 0) > 0)
    );
    const isPaidOrComplete =
      Boolean(po.isPaid) ||
      hasPaidInvoice ||
      isKasDirect ||
      statusLower === "selesai" ||
      statusLower === "lunas" ||
      statusLower === "dibayar";

    const invTot = rawLinkedInvs.reduce((s: number, i: any) => s + toNum(i.total), 0);
    const effTotal = invTot > 0 ? invTot : toNum(po.total);

    if (isPaidOrComplete && effTotal > 0) {
      cashOutSuppliers += effTotal;
      cashFlowItems.push({
        id: `CF-PO-${po.id || po.nomor}`,
        tanggal: normStr(po.tanggal, "2026-02-01"),
        refNo: normStr(po.nomor),
        kategori: "Arus Kas Keluar (Supplier PO)",
        pihak: normStr(po.supplier),
        project: normStr(po.project, "Pengadaan Gudang"),
        keterangan: `Pembayaran PO Supplier ${normStr(po.nomor)} — ${normStr(po.item)}`,
        masuk: 0,
        keluar: effTotal,
      });
    }
  }
  cashOutSuppliers += cashOutDirectRetail + cashOutStandaloneInvoices;
  for (const inv of standaloneInvoices) {
    const invTot = toNum(inv.total) || (toNum(inv.nilai ?? inv.amount) + toNum(inv.ppn));
    const invPaid = toNum(inv.paidAmount ?? inv.terbayar);
    const isInvPaid =
      inv.status === "PAID" ||
      inv.status === "Lunas" ||
      (invPaid >= invTot && invTot > 0);
    const paidAmt = isInvPaid ? (invPaid > 0 ? invPaid : invTot) : invPaid;
    if (paidAmt > 0) {
      cashFlowItems.push({
        id: `CF-INVIN-${inv.id || inv.nomor}`,
        tanggal: normStr(inv.tanggal || inv.date, "2026-02-01"),
        refNo: normStr(inv.nomor || inv.number),
        kategori: "Arus Kas Keluar (Invoice Masuk)",
        pihak: normStr(inv.supplier, "Vendor / Tagihan"),
        project: normStr(inv.category, "Operasional / Tagihan"),
        keterangan: `Pembayaran Invoice Masuk ${normStr(inv.nomor || inv.number)} — ${normStr(inv.supplier)}`,
        masuk: 0,
        keluar: paidAmt,
      });
    }
  }

  for (const ex of expenses) {
    const isDibayar = normStr(ex.status).toLowerCase() === "dibayar";
    const nominal = toNum(ex.nominal);
    if (isDibayar && nominal > 0) {
      cashOutExpenses += nominal;
      cashFlowItems.push({
        id: `CF-EX-${ex.id}`,
        tanggal: normStr(ex.tanggal, "2026-02-01"),
        refNo: `EXP-${String(ex.id).padStart(3, "0")}`,
        kategori: "Arus Kas Keluar (Biaya Operasional)",
        pihak: normStr(ex.pelapor),
        project: normStr(ex.project),
        keterangan: `Reimbursement ${normStr(ex.kategori)}: ${normStr(ex.alasan)}`,
        masuk: 0,
        keluar: nominal,
      });
    }
  }

  let cashOutPayroll = 0;
  for (const p of payrollSlips) {
    const net = toNum(p.netSalary || p.net);
    const slipNo = normStr(p.nomor, `PAY-${p.period}-${p.userId || p.id}`);
    const tanggal = normStr(p.paidAt ? String(p.paidAt).slice(0, 10) : p.tanggal, `${p.period}-28`);
    const karyawan = normStr(p.userName || p.user?.name, `Karyawan #${p.userId}`);
    if (net > 0) {
      cashOutPayroll += net;
      cashFlowItems.push({
        id: `CF-PAY-${p.id || slipNo}`,
        tanggal,
        refNo: slipNo,
        kategori: "Arus Kas Keluar (Gaji Karyawan)",
        pihak: karyawan,
        project: "Operasional Umum",
        keterangan: `Pembayaran Gaji Karyawan Periode ${p.period}`,
        masuk: 0,
        keluar: net,
      });
    }
  }

  const totalCashIn = Number.isFinite(cashInCustomers) ? cashInCustomers : 0;
  const totalCashOut = Number.isFinite(cashOutSuppliers + cashOutExpenses + cashOutPayroll)
    ? cashOutSuppliers + cashOutExpenses + cashOutPayroll
    : 0;
  const netCashFlow = totalCashIn - totalCashOut;
  const cashConversionRatePct = revenueGross > 0 && Number.isFinite(totalCashIn)
    ? Math.round((totalCashIn / revenueGross) * 1000) / 10
    : 0;

  // 6. Balance Sheet (Neraca: Aset = Kewajiban + Ekuitas)
  // Compute Warehouse Inventory Value from products/stock
  let persediaanBarang = 0;
  if (products.length > 0) {
    for (const prod of products) {
      const qty = toNum(prod.stok ?? prod.tersedia ?? prod.qty ?? 0);
      const hppUnit = toNum(prod.hargaBeli) || Math.round(toNum(prod.hargaJual) * 0.7);
      persediaanBarang += qty * hppUnit;
    }
  } else if (stock.length > 0) {
    for (const st of stock) {
      const qty = toNum(st.tersedia ?? st.stok ?? 0);
      persediaanBarang += qty * toNum(st.hargaBeli || 500000);
    }
  }

  const uangMukaPph = totalPphWithheld;
  const piutangUsaha = Math.max(0, (revenueGross - uangMukaPph) - paidCashIn);
  const ap210102Lines = journalLines.filter((l) => l.kodeAkun === "210102");
  const hutangSupplier = Math.max(
    0,
    ap210102Lines.reduce((s, l) => s + l.kredit - l.debit, 0)
  );
  const inv1200Lines = journalLines.filter((l) => l.kodeAkun === "1200");
  const netInvPurchases = inv1200Lines.reduce((s, l) => s + l.debit - l.kredit, 0);
  const initialPhysicalStock = persediaanBarang;
  persediaanBarang = Math.max(0, initialPhysicalStock + netInvPurchases);
  const hutangReimbursement = Math.max(0, expensesTableTotal - cashOutExpenses);
  const hutangPpnKeluaran = ppnKeluaran;

  // Working capital reserve covers initial warehouse inventory + base treasury buffer if netCashFlow < 0
  const baseWorkingCapitalCash = netCashFlow < 0 ? Math.abs(netCashFlow) + 25_000_000 : 0;
  const kasDanBank = netCashFlow + baseWorkingCapitalCash;
  const modalKerjaAwal = initialPhysicalStock + baseWorkingCapitalCash;
  const labaBerjalan = netProfit;

  // 7. COA Trial Balance Summary (Aggregates standard + custom user accounts + manual journals)
  // Deduplicate by acc.code so legacy aliases do not duplicate rows or React keys
  const uniqueAccountsMap: Record<string, CoaAccount> = {};
  for (const [key, acc] of Object.entries(activeCoa)) {
    if (deletedCoaCodes.includes(acc.code) || deletedCoaCodes.includes(key)) continue;
    if (!uniqueAccountsMap[acc.code] || key === acc.code) {
      uniqueAccountsMap[acc.code] = { ...acc };
    }
  }

  // Auto-infer parentCode for dot-notation sub-accounts (e.g. 6201.02 -> 6201) if not explicitly set
  for (const acc of Object.values(uniqueAccountsMap)) {
    if (!acc.parentCode && acc.code.includes(".")) {
      const prefix = acc.code.split(".")[0];
      if (prefix && uniqueAccountsMap[prefix]) {
        acc.parentCode = prefix;
      }
    }
  }

  const directMutasiMap: Record<string, { d: number; k: number }> = {};
  for (const acc of Object.values(uniqueAccountsMap)) {
    const lines = journalLines.filter((l) => l.kodeAkun === acc.code);
    let d = lines.reduce((s, l) => s + l.debit, 0);
    let k = lines.reduce((s, l) => s + l.kredit, 0);

    if (acc.code === "1200" || acc.code === "1103") {
      d += initialPhysicalStock;
    } else if (acc.code === "310001" || acc.code === "3101") {
      k += modalKerjaAwal;
    } else if (acc.code === "3102") {
      if (labaBerjalan >= 0) k += labaBerjalan;
      else d += Math.abs(labaBerjalan);
    }
    directMutasiMap[acc.code] = { d, k };
  }

  const childrenMap: Record<string, CoaAccount[]> = {};
  const rootAccounts: CoaAccount[] = [];
  for (const acc of Object.values(uniqueAccountsMap)) {
    const pCode = acc.parentCode && uniqueAccountsMap[acc.parentCode] ? acc.parentCode : undefined;
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
    const base = directMutasiMap[code] || { d: 0, k: 0 };
    let totalD = base.d;
    let totalK = base.k;
    for (const child of childrenMap[code] || []) {
      const sub = computeSubtreeTotals(child.code, visited);
      totalD += sub.d;
      totalK += sub.k;
    }
    return { d: totalD, k: totalK };
  }

  const coaBalances: CoaTrialBalanceRow[] = [];
  function traverseCoa(acc: CoaAccount, depth: number, visited = new Set<string>()) {
    if (visited.has(acc.code)) return;
    visited.add(acc.code);
    const kids = childrenMap[acc.code] || [];
    const { d, k } = computeSubtreeTotals(acc.code);
    const endingBalance = acc.normalBalance === "DEBIT" ? d - k : k - d;
    const parentAcc = acc.parentCode ? uniqueAccountsMap[acc.parentCode] : undefined;

    coaBalances.push({
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
      isHeader: kids.length > 0,
    });

    for (const child of kids) {
      traverseCoa(child, depth + 1, visited);
    }
  }

  for (const root of rootAccounts) {
    traverseCoa(root, 0);
  }

  const ppnMasukanTotal = journalLines
    .filter((l) => l.kodeAkun === "1600" || l.kodeAkun === "1104")
    .reduce((s, l) => s + l.debit - l.kredit, 0);

  const totalAsetLancar = kasDanBank + piutangUsaha + persediaanBarang + uangMukaPph + Math.max(0, ppnMasukanTotal);
  const totalKewajiban = hutangSupplier + hutangReimbursement + hutangPpnKeluaran;
  const totalEkuitas = modalKerjaAwal + labaBerjalan;
  const totalPasiva = totalKewajiban + totalEkuitas;

  const sortedJournalLines = [...journalLines].sort((a, b) => {
    // 1. Tanggal terbaru paling atas
    const dateCmp = (b.tanggal || "").localeCompare(a.tanggal || "");
    if (dateCmp !== 0) return dateCmp;

    // 2. Nomor jurnal terbaru paling atas
    if (a.journalNo !== b.journalNo) {
      return b.journalNo.localeCompare(a.journalNo, undefined, { numeric: true });
    }

    // 3. Di dalam jurnal yang sama, baris debit tetap di atas baris kredit
    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });

  return {
    journalLines: sortedJournalLines,
    totalDebit,
    totalKredit,
    isJournalBalanced: totalDebit === totalKredit,
    coaBalances,
    incomeStatement: {
      revenueGross,
      revenueDpp,
      ppnKeluaran,
      cogsProject,
      cogsRetail,
      cogsTotal,
      grossProfit,
      grossMarginPct,
      opexByCategory,
      opexTotal,
      operatingProfit,
      netProfit,
      netMarginPct,
      projectRows,
    },
    balanceSheet: {
      assets: {
        kasDanBank,
        piutangUsaha,
        persediaanBarang,
        uangMukaPph,
        ppnMasukan: Math.max(0, ppnMasukanTotal),
        totalAsetLancar,
      },
      liabilities: {
        hutangSupplier,
        hutangReimbursement,
        hutangPpnKeluaran,
        totalKewajiban,
      },
      equity: {
        modalKerjaAwal,
        labaBerjalan,
        totalEkuitas,
      },
      totalPasiva,
      isBalanced: Math.abs(totalAsetLancar - totalPasiva) < 5,
    },
    cashFlow: {
      cashInCustomers,
      cashOutSuppliers,
      cashOutExpenses,
      totalCashIn,
      totalCashOut,
      netCashFlow,
      cashConversionRatePct,
      items: cashFlowItems,
    },
  };
}

