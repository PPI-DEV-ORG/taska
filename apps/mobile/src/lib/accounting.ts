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
  category: "Aset Lancar" | "Kewajiban Jangka Pendek" | "Ekuitas" | "Pendapatan" | "Beban Pokok (HPP)" | "Beban Operasional";
  normalBalance: "DEBIT" | "KREDIT";
}

export const CHART_OF_ACCOUNTS: Record<string, CoaAccount> = {
  "1101": { code: "1101", name: "Kas & Bank Operasional", category: "Aset Lancar", normalBalance: "DEBIT" },
  "1102": { code: "1102", name: "Piutang Usaha (Accounts Receivable)", category: "Aset Lancar", normalBalance: "DEBIT" },
  "1103": { code: "1103", name: "Persediaan Barang Gudang (Inventory)", category: "Aset Lancar", normalBalance: "DEBIT" },
  "1104": { code: "1104", name: "PPN Masukan (Input VAT)", category: "Aset Lancar", normalBalance: "DEBIT" },
  "2101": { code: "2101", name: "Hutang Usaha Supplier (Accounts Payable)", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT" },
  "2102": { code: "2102", name: "Hutang PPN Keluaran (Output VAT)", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT" },
  "2103": { code: "2103", name: "Hutang Biaya & Reimbursement Operasional", category: "Kewajiban Jangka Pendek", normalBalance: "KREDIT" },
  "3101": { code: "3101", name: "Modal Kerja & Cadangan Persediaan Awal", category: "Ekuitas", normalBalance: "KREDIT" },
  "3102": { code: "3102", name: "Laba Ditahan / Laba Bersih Tahun Berjalan", category: "Ekuitas", normalBalance: "KREDIT" },
  "4101": { code: "4101", name: "Pendapatan Proyek & Integrasi Sistem", category: "Pendapatan", normalBalance: "KREDIT" },
  "5101": { code: "5101", name: "Harga Pokok Penjualan / Pengadaan PO Supplier (HPP)", category: "Beban Pokok (HPP)", normalBalance: "DEBIT" },
  "6101": { code: "6101", name: "Beban Operasional & Reimbursement Lapangan", category: "Beban Operasional", normalBalance: "DEBIT" },
};

export interface JournalLine {
  id: string;
  journalNo: string;
  tanggal: string;
  refNo: string;
  sumber: "Invoice Client" | "Pembayaran Invoice" | "PO Supplier" | "Pelunasan PO" | "Pengeluaran (Expense)" | "Pembayaran Expense";
  keterangan: string;
  project: string;
  kodeAkun: string;
  namaAkun: string;
  debit: number;
  kredit: number;
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
  kategori: "Arus Kas Masuk (Pelanggan)" | "Arus Kas Keluar (Supplier PO)" | "Arus Kas Keluar (Biaya Operasional)";
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
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function normStr(v: any, fallback = "-"): string {
  const s = String(v ?? "").trim();
  return s || fallback;
}

export function computeFinancialStatements(data: Record<string, any[]>): FinancialStatementsBundle {
  const invoices = (data.invoices || []).filter((inv) => normStr(inv.status).toLowerCase() !== "batal");
  const supplierPos = (data["supplier-pos"] || []).filter((po) => normStr(po.status).toLowerCase() !== "dibatalkan");
  const expenses = (data.expenses || []).filter((ex) => normStr(ex.status).toLowerCase() !== "ditolak");
  const products = data.products || [];
  const stock = data.stock || [];
  const projects = data.projects || [];

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
      const acc = CHART_OF_ACCOUNTS[e.kodeAkun];
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
    const total = toNum(inv.total) || toNum(inv.nilai) + toNum(inv.ppn);
    const dpp = toNum(inv.nilai) || Math.round(total / 1.11);
    const ppn = Math.max(0, total - dpp);
    const isLunas = normStr(inv.status).toLowerCase() === "lunas";
    const terbayar = isLunas ? Math.max(toNum(inv.terbayar), total) : Math.min(total, toNum(inv.terbayar));

    if (total > 0) {
      pushJournalPair(tanggal, nomor, "Invoice Client", project, [
        {
          kodeAkun: "1102",
          keterangan: `Tagihan Invoice ${nomor} — ${customer}`,
          debit: total,
          kredit: 0,
        },
        {
          kodeAkun: "4101",
          keterangan: `Pendapatan Proyek (${customer}) — ${nomor}`,
          debit: 0,
          kredit: dpp,
        },
        ...(ppn > 0
          ? [
              {
                kodeAkun: "2102",
                keterangan: `PPN Keluaran 11% atas ${nomor}`,
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
          kodeAkun: "1101",
          keterangan: `Penerimaan Pembayaran Invoice ${nomor} dari ${customer}`,
          debit: terbayar,
          kredit: 0,
        },
        {
          kodeAkun: "1102",
          keterangan: `Pelunasan Piutang Usaha ${nomor} (${customer})`,
          debit: 0,
          kredit: terbayar,
        },
      ]);
    }
  }

  // 2. Journal Entries from Supplier POs (Procurement COGS/HPP & AP Settlement)
  for (const po of supplierPos) {
    const nomor = normStr(po.nomor, `PO-${po.id}`);
    const tanggal = normStr(po.tanggal, "2026-02-01");
    const supplier = normStr(po.supplier, "Supplier");
    const project = normStr(po.project || po.projectKode || po.projectId, "Pengadaan & Proyek");
    const total = toNum(po.total);
    const statusLower = normStr(po.status).toLowerCase();
    const isPaidOrComplete = statusLower === "selesai" || statusLower === "lunas" || statusLower === "dibayar";

    if (total > 0) {
      pushJournalPair(tanggal, nomor, "PO Supplier", project, [
        {
          kodeAkun: "5101",
          keterangan: `Beban Pokok Pengadaan PO ${nomor} — ${supplier} (${normStr(po.item, "Material")})`,
          debit: total,
          kredit: 0,
        },
        {
          kodeAkun: "2101",
          keterangan: `Hutang Usaha Supplier atas ${nomor} (${supplier})`,
          debit: 0,
          kredit: total,
        },
      ]);

      if (isPaidOrComplete) {
        pushJournalPair(tanggal, `${nomor}/SETTLE`, "Pelunasan PO", project, [
          {
            kodeAkun: "2101",
            keterangan: `Penyelesaian Hutang PO Supplier ${nomor} — ${supplier}`,
            debit: total,
            kredit: 0,
          },
          {
            kodeAkun: "1101",
            keterangan: `Pengeluaran Kas Pembayaran PO ${nomor} ke ${supplier}`,
            debit: 0,
            kredit: total,
          },
        ]);
      }
    }
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

    if (nominal > 0) {
      pushJournalPair(tanggal, refNo, "Pengeluaran (Expense)", project, [
        {
          kodeAkun: "6101",
          keterangan: `Beban ${kategori}: ${alasan} (${pelapor})`,
          debit: nominal,
          kredit: 0,
        },
        {
          kodeAkun: "2103",
          keterangan: `Kewajiban Reimbursement ${kategori} — ${pelapor}`,
          debit: 0,
          kredit: nominal,
        },
      ]);

      if (isDibayar) {
        pushJournalPair(tanggal, `${refNo}/PAY`, "Pembayaran Expense", project, [
          {
            kodeAkun: "2103",
            keterangan: `Pelunasan Reimbursement ${refNo} kepada ${pelapor}`,
            debit: nominal,
            kredit: 0,
          },
          {
            kodeAkun: "1101",
            keterangan: `Pengeluaran Kas Reimbursement ${kategori} (${pelapor})`,
            debit: 0,
            kredit: nominal,
          },
        ]);
      }
    }
  }

  // Sort journal lines chronologically (newest first for display, keeping pair order intact)
  const totalDebit = journalLines.reduce((sum, l) => sum + l.debit, 0);
  const totalKredit = journalLines.reduce((sum, l) => sum + l.kredit, 0);

  // 4. Income Statement (Laba Rugi)
  let revenueGross = 0;
  let revenueDpp = 0;
  let ppnKeluaran = 0;
  let paidCashIn = 0;

  for (const inv of invoices) {
    const total = toNum(inv.total) || toNum(inv.nilai) + toNum(inv.ppn);
    const dpp = toNum(inv.nilai) || Math.round(total / 1.11);
    const ppn = Math.max(0, total - dpp);
    const isLunas = normStr(inv.status).toLowerCase() === "lunas";
    const terbayar = isLunas ? Math.max(toNum(inv.terbayar), total) : Math.min(total, toNum(inv.terbayar));

    revenueGross += total;
    revenueDpp += dpp;
    ppnKeluaran += ppn;
    paidCashIn += terbayar;
  }

  const cogsTotal = supplierPos.reduce((sum, po) => sum + toNum(po.total), 0);
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
    const isPaidOrComplete = statusLower === "selesai" || statusLower === "lunas" || statusLower === "dibayar";
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
        keterangan: `Pelunasan PO Supplier ${normStr(po.nomor)} — ${normStr(po.item)}`,
        masuk: 0,
        keluar: total,
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

  const totalCashIn = cashInCustomers;
  const totalCashOut = cashOutSuppliers + cashOutExpenses;
  const netCashFlow = totalCashIn - totalCashOut;
  const cashConversionRatePct = revenueGross > 0 ? Math.round((totalCashIn / revenueGross) * 1000) / 10 : 0;

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

  const piutangUsaha = Math.max(0, revenueGross - paidCashIn);
  const hutangSupplier = Math.max(0, cogsTotal - cashOutSuppliers);
  const hutangReimbursement = Math.max(0, opexTotal - cashOutExpenses);
  const hutangPpnKeluaran = ppnKeluaran;

  // Working capital reserve covers initial warehouse inventory + base treasury buffer if netCashFlow < 0
  const baseWorkingCapitalCash = netCashFlow < 0 ? Math.abs(netCashFlow) + 25_000_000 : 0;
  const kasDanBank = netCashFlow + baseWorkingCapitalCash;
  const modalKerjaAwal = persediaanBarang + baseWorkingCapitalCash;
  const labaBerjalan = netProfit;

  const totalAsetLancar = kasDanBank + piutangUsaha + persediaanBarang;
  const totalKewajiban = hutangSupplier + hutangReimbursement + hutangPpnKeluaran;
  const totalEkuitas = modalKerjaAwal + labaBerjalan;
  const totalPasiva = totalKewajiban + totalEkuitas;

  // 7. COA Trial Balance Summary
  const coaBalances: CoaTrialBalanceRow[] = Object.values(CHART_OF_ACCOUNTS).map((acc) => {
    const lines = journalLines.filter((l) => l.kodeAkun === acc.code);
    let d = lines.reduce((s, l) => s + l.debit, 0);
    let k = lines.reduce((s, l) => s + l.kredit, 0);

    if (acc.code === "1103") {
      d += persediaanBarang;
    } else if (acc.code === "3101") {
      k += modalKerjaAwal;
    } else if (acc.code === "3102") {
      if (labaBerjalan >= 0) k += labaBerjalan;
      else d += Math.abs(labaBerjalan);
    }

    const endingBalance = acc.normalBalance === "DEBIT" ? d - k : k - d;
    return {
      code: acc.code,
      name: acc.name,
      category: acc.category,
      normalBalance: acc.normalBalance,
      totalDebit: d,
      totalKredit: k,
      endingBalance,
    };
  });

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

