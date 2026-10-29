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
    | "Pembayaran Invoice"
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
    const tanggal = normStr(inv.tanggal, "2026-02-01");
    const customer = normStr(inv.customer, "Pelanggan");
    const project = normStr(inv.project, "-");
    const pph = toNum(inv.pph);
    const tipePph = normStr(inv.tipePph || inv.pphMode);
    const total = toNum(inv.total) || Math.max(0, toNum(inv.nilai) + toNum(inv.ppn) - pph);
    const dpp = toNum(inv.nilai) || Math.round((total + pph) / 1.11);
    const ppn = toNum(inv.ppn) || Math.max(0, (total + pph) - dpp);
    const isLunas = normStr(inv.status).toLowerCase() === "lunas";
    const terbayar = isLunas ? Math.max(toNum(inv.terbayar), total) : Math.min(total, toNum(inv.terbayar));

    if (total > 0 || pph > 0) {
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

    if (terbayar > 0) {
      pushJournalPair(tanggal, `${nomor}/PAY`, "Pembayaran Invoice", project, [
        {
          kodeAkun: "1000.01",
          keterangan: `Penerimaan Pembayaran Kas/Bank ${nomor} dari ${customer}`,
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

    // Jika Invoice Penjualan Retail (tanpa Project), catat HPP Retail (Debit 5102) & pengurangan Aset Persediaan (Kredit 1200)
    const isRetailInv = !inv.projectId && (!inv.project || inv.project === "-");
    if (isRetailInv && Array.isArray(inv.items) && inv.items.length > 0) {
      const retailCost = inv.items.reduce((acc: number, it: any) => {
        const qty = Math.max(1, toNum(it.qty || 1));
        const prodMatch = products.find(
          (p: any) =>
            (it.productId && String(p.id) === String(it.productId)) ||
            normStr(p.nama || p.name).toLowerCase() === normStr(it.name || it.nama || it.product?.name).toLowerCase()
        );
        const unitCost =
          toNum(it.purchasePrice || it.hargaBeli || prodMatch?.hargaBeli || prodMatch?.purchasePrice) ||
          Math.round(toNum(it.price || it.harga) * 0.7);
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
    const tanggal = normStr(po.tanggal, "2026-02-01");
    const supplier = normStr(po.supplier, "Supplier");
    const linkedPr = purchaseRequests.find(
      (pr: any) =>
        (po.requestId && String(pr.id) === String(po.requestId)) ||
        (po.request && po.request !== "-" && normStr(pr.nomor).toLowerCase() === normStr(po.request).toLowerCase())
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
    const isPaidOrComplete =
      isKasDirect || statusLower === "selesai" || statusLower === "lunas" || statusLower === "dibayar";

    const debitAccountCode = isProjectPo ? "5101" : "1200";
    const debitDesc = isProjectPo
      ? `HPP Project Pengadaan PO ${nomor} — ${supplier} (${normStr(po.item, "Material Proyek")})`
      : `Pembelian Aset Persediaan Stok/Retail PO ${nomor} — ${supplier} (${normStr(po.item, "Barang Stok")})`;

    if (total > 0) {
      if (isProjectPo) {
        cogsProjectTotal += total;
      }

      if (isKasDirect) {
        pushJournalPair(tanggal, nomor, "PO Supplier", projectLabel, [
          {
            kodeAkun: debitAccountCode,
            keterangan: debitDesc,
            debit: total,
            kredit: 0,
          },
          {
            kodeAkun: "1000.01",
            keterangan: `Pengeluaran Kas/Bank Tunai Pembelian PO ${nomor} ke ${supplier}`,
            debit: 0,
            kredit: total,
          },
        ]);
      } else {
        pushJournalPair(tanggal, nomor, "PO Supplier", projectLabel, [
          {
            kodeAkun: debitAccountCode,
            keterangan: debitDesc,
            debit: total,
            kredit: 0,
          },
          {
            kodeAkun: "210102",
            keterangan: `Hutang Usaha Supplier atas ${nomor} (${supplier})`,
            debit: 0,
            kredit: total,
          },
        ]);

        if (isPaidOrComplete) {
          pushJournalPair(tanggal, `${nomor}/SETTLE`, "Pelunasan PO", projectLabel, [
            {
              kodeAkun: "210102",
              keterangan: `Penyelesaian Hutang PO Supplier ${nomor} — ${supplier}`,
              debit: total,
              kredit: 0,
            },
            {
              kodeAkun: "1000.01",
              keterangan: `Pengeluaran Kas/Bank Pelunasan PO ${nomor} ke ${supplier}`,
              debit: 0,
              kredit: total,
            },
          ]);
        }
      }
    }
  }

  // 2b. Direct Retail Purchase Requests (Request Barang yang dibeli langsung dari ritel tanpa PO Supplier terpisah)
  for (const pr of purchaseRequests) {
    const stLower = normStr(pr.status).toLowerCase();
    const isApprovedOrDone = ["disetujui", "dikirim", "diterima", "selesai"].includes(stLower);
    if (!isApprovedOrDone) continue;

    const hasPo = supplierPos.some(
      (po: any) =>
        (po.requestId && String(po.requestId) === String(pr.id)) ||
        (pr.nomor && po.request && normStr(po.request).toLowerCase() === normStr(pr.nomor).toLowerCase())
    );
    if (hasPo) continue;

    const isRetailSource = String(pr.procurementSource || "").toUpperCase() === "RETAIL";
    if (!isRetailSource) continue;

    const totalPr = toNum(pr.estimasi);
    if (totalPr <= 0) continue;

    const nomorPr = normStr(pr.nomor, `PR-${pr.id}`);
    const tanggalPr = normStr(pr.tanggal, "2026-02-01");
    const isProjectPr =
      String(pr.costType || "").toUpperCase() === "PROJECT" ||
      !!(pr.projectId || (pr.project && pr.project !== "-"));
    const isKasPr = String(pr.paymentMethod || "").toUpperCase() === "KAS";
    const projectLabel = isProjectPr ? normStr(pr.project, "Proyek") : "Stok Gudang / Retail";
    const debitCode = isProjectPr ? "5101" : "1200";
    const debitDesc = isProjectPr
      ? `HPP Project Beli Ritel ${nomorPr} (${normStr(pr.item, pr.tujuan)})`
      : `Pembelian Aset Persediaan Ritel/Stok ${nomorPr} (${normStr(pr.item, pr.tujuan)})`;

    if (isProjectPr) {
      cogsProjectTotal += totalPr;
    }
    if (isKasPr) {
      cashOutDirectRetail += totalPr;
    }

    pushJournalPair(tanggalPr, nomorPr, "Request Barang / Ritel", projectLabel, [
      {
        kodeAkun: debitCode,
        keterangan: debitDesc,
        debit: totalPr,
        kredit: 0,
      },
      {
        kodeAkun: isKasPr ? "1000.01" : "210102",
        keterangan: isKasPr
          ? `Pengeluaran Kas Pembelian Ritel ${nomorPr}`
          : `Hutang Pembelian Ritel ${nomorPr} (${normStr(pr.supplier, "Toko Ritel")})`,
        debit: 0,
        kredit: totalPr,
      },
    ]);
  }

  // 3. Journal Entries from Operational Expenses (Accrual + Reimbursement Payout)
  for (const ex of expenses) {
    const refNo = `EXP-${String(ex.id).padStart(3, "0")}`;
    const tanggal = normStr(ex.tanggal, "2026-02-01");
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
    const tanggal = normStr(mj.tanggal, "2026-02-01");
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
    const tanggal = normStr(p.paidAt ? String(p.paidAt).slice(0, 10) : p.tanggal, `${p.period}-28`);
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
  for (const ex of expenses) {
    const kat = normStr(ex.kategori, "Operasional Lainnya");
    const nom = toNum(ex.nominal);
    opexTotal += nom;
    const prev = opexMap.get(kat) || { nominal: 0, count: 0 };
    opexMap.set(kat, { nominal: prev.nominal + nom, count: prev.count + 1 });
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
    const statusLower = normStr(po.status).toLowerCase();
    const isKasDirect =
      String(po.paymentMethod || "").toUpperCase() === "KAS" ||
      /kas|tunai|cash/i.test(String(po.paymentTerms || ""));
    const isPaidOrComplete =
      isKasDirect || statusLower === "selesai" || statusLower === "lunas" || statusLower === "dibayar";
    const total = toNum(po.total);
    if (isPaidOrComplete && total > 0) {
      cashOutSuppliers += total;
      cashFlowItems.push({
        id: `CF-PO-${po.id || po.nomor}`,
        tanggal: normStr(po.tanggal, "2026-02-01"),
        refNo: normStr(po.nomor),
        kategori: "Arus Kas Keluar (Supplier PO)",
        pihak: normStr(po.supplier),
        project: normStr(po.project, "Pengadaan Gudang"),
        keterangan: `Pembayaran PO Supplier ${normStr(po.nomor)} — ${normStr(po.item)}`,
        masuk: 0,
        keluar: total,
      });
    }
  }
  cashOutSuppliers += cashOutDirectRetail;

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
  const hutangReimbursement = Math.max(0, opexTotal - cashOutExpenses);
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

  const totalAsetLancar = kasDanBank + piutangUsaha + persediaanBarang + uangMukaPph;
  const totalKewajiban = hutangSupplier + hutangReimbursement + hutangPpnKeluaran;
  const totalEkuitas = modalKerjaAwal + labaBerjalan;
  const totalPasiva = totalKewajiban + totalEkuitas;

  return {
    journalLines,
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

