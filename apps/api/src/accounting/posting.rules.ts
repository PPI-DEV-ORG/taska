import { JournalLineSpec, round } from "./accounting.types.js";

export interface InvoiceOutContext {
  id: number;
  number: string;
  type: string;
  customerId: number;
  projectId?: number | null;
  dpp: number;
  ppn: number;
  total: number;
  dpApplied?: number;
  retentionPercent?: number;
  retentionAmount?: number;
  items?: Array<{
    type?: string; // "PRODUCT" | "SERVICE"
    amount?: number | null;
    subtotal?: number | null;
    harga?: number | null;
    price?: number | null;
    qty?: number | null;
  }>;
}

export interface PaymentContext {
  id: number;
  number?: string;
  sourceType: "INVOICE_OUT" | "INVOICE_IN" | "EXPENSE" | "PAYROLL" | "SALES_RETURN" | "PURCHASE_RETURN";
  sourceId: number;
  amount: number;
  accountCode: string;
  pph23Amount?: number;
  partyType?: "CUSTOMER" | "SUPPLIER" | "EMPLOYEE" | "OTHER";
  partyId?: number;
  projectId?: number | null;
}

export class PostingRules {
  /**
   * E1: Penerbitan Invoice Penjualan
   * Piutang penuh dicatat di AR (110302). Potongan PPh 23 tidak di E1 tapi di E3 saat pelunasan.
   * Jika ada klausul retensi, porsi retensi didebit ke AR_RETENTION (110303).
   */
  static buildInvoiceOutLines(
    inv: InvoiceOutContext,
    map: Record<string, string>,
  ): JournalLineSpec[] {
    const lines: JournalLineSpec[] = [];
    const dp = round(Number(inv.dpApplied || 0));
    const retention = round(Number(inv.retentionAmount || 0));
    const totalPiutang = round(Number(inv.total) - dp - retention);

    if (totalPiutang > 0) {
      lines.push({
        accountCode: map.AR || "110302",
        debit: totalPiutang,
        credit: 0,
        memo: `Piutang Usaha Inv ${inv.number}`,
        partyType: "CUSTOMER",
        partyId: inv.customerId,
        projectId: inv.projectId,
      });
    }

    if (retention > 0) {
      lines.push({
        accountCode: map.AR_RETENTION || "110303",
        debit: retention,
        credit: 0,
        memo: `Piutang Retensi Inv ${inv.number}`,
        partyType: "CUSTOMER",
        partyId: inv.customerId,
        projectId: inv.projectId,
      });
    }

    if (dp > 0) {
      lines.push({
        accountCode: map.ADV_SALES || map.CUSTOMER_DP || "210202",
        debit: dp,
        credit: 0,
        memo: `Pelepasan Uang Muka Inv ${inv.number}`,
        partyType: "CUSTOMER",
        partyId: inv.customerId,
        projectId: inv.projectId,
      });
    }

    // Pendapatan Produk vs Jasa
    let prodRev = 0;
    let srvRev = 0;
    if (inv.items && inv.items.length > 0) {
      for (const item of inv.items) {
        const itemAmt = Number(
          item.amount ??
          item.subtotal ??
          ((Number(item.harga ?? item.price ?? 0)) * (Number(item.qty || 1)))
        ) || 0;
        if (item.type === "SERVICE") {
          srvRev += itemAmt;
        } else {
          prodRev += itemAmt;
        }
      }
    } else {
      if (inv.type === "SERVICE") srvRev = Number(inv.dpp);
      else prodRev = Number(inv.dpp);
    }

    prodRev = round(prodRev);
    srvRev = round(srvRev);

    const ppn = round(Number(inv.ppn || 0));
    // Keseimbangan Kredit Pendapatan: Pendapatan + PPN selalu seimbang dengan Total Invoice (Debit)
    const targetRevenue = Math.max(0, round(Number(inv.total) - ppn));
    if (prodRev + srvRev !== targetRevenue) {
      if (srvRev > 0 && prodRev === 0) {
        srvRev = targetRevenue;
      } else if (prodRev > 0 && srvRev === 0) {
        prodRev = targetRevenue;
      } else if (prodRev + srvRev > 0) {
        const ratio = targetRevenue / (prodRev + srvRev);
        prodRev = round(prodRev * ratio);
        srvRev = round(targetRevenue - prodRev);
      } else {
        if (inv.type === "SERVICE") srvRev = targetRevenue;
        else prodRev = targetRevenue;
      }
    }

    if (prodRev > 0) {
      lines.push({
        accountCode: map.REVENUE_GOODS || map.REVENUE_PRODUCT || "4000.01",
        debit: 0,
        credit: prodRev,
        memo: `Pendapatan Barang Inv ${inv.number}`,
        projectId: inv.projectId,
      });
    }

    if (srvRev > 0) {
      lines.push({
        accountCode: map.REVENUE_SERVICE || "4000.02",
        debit: 0,
        credit: srvRev,
        memo: `Pendapatan Jasa Inv ${inv.number}`,
        projectId: inv.projectId,
      });
    }

    if (ppn > 0) {
      lines.push({
        accountCode: map.VAT_OUT || "2100",
        debit: 0,
        credit: ppn,
        memo: `PPN Keluaran Inv ${inv.number}`,
        partyType: "CUSTOMER",
        partyId: inv.customerId,
        projectId: inv.projectId,
      });
    }

    return lines;
  }

  /**
   * E2: Uang Muka Penjualan (Customer DP)
   */
  static buildCustomerDpLines(
    inv: { number: string; customerId: number; projectId?: number | null; dpp: number; ppn: number; total: number },
    map: Record<string, string>,
  ): JournalLineSpec[] {
    const tot = round(Number(inv.total));
    const ppn = round(Number(inv.ppn || 0));
    const dpp = Math.max(0, round(tot - ppn));
    const lines: JournalLineSpec[] = [
      {
        accountCode: map.AR || "110302",
        debit: tot,
        credit: 0,
        memo: `Piutang Tagihan DP Inv ${inv.number}`,
        partyType: "CUSTOMER",
        partyId: inv.customerId,
        projectId: inv.projectId,
      },
      {
        accountCode: map.ADV_SALES || map.CUSTOMER_DP || "210202",
        debit: 0,
        credit: dpp,
        memo: `Uang Muka Penjualan Inv ${inv.number}`,
        partyType: "CUSTOMER",
        partyId: inv.customerId,
        projectId: inv.projectId,
      },
    ];
    if (ppn > 0) {
      lines.push({
        accountCode: map.VAT_OUT || "2100",
        debit: 0,
        credit: ppn,
        memo: `PPN Keluaran atas DP Inv ${inv.number}`,
        partyType: "CUSTOMER",
        partyId: inv.customerId,
        projectId: inv.projectId,
      });
    }
    return lines;
  }

  /**
   * E3: Pelunasan Invoice Penjualan (Customer Payment)
   * Potongan PPh 23 didebit ke PPH_PREPAID_CUSTOMER (1105.01)
   */
  static buildCustomerPaymentLines(
    pay: PaymentContext,
    map: Record<string, string>,
  ): JournalLineSpec[] {
    const lines: JournalLineSpec[] = [];
    const netReceived = round(Number(pay.amount));
    const pph23 = round(Number(pay.pph23Amount || 0));
    const totalSettled = round(netReceived + pph23);

    lines.push({
      accountCode: pay.accountCode || map.CASH_DEFAULT || "1000.02",
      debit: netReceived,
      credit: 0,
      memo: `Penerimaan Kas Pelunasan Inv #${pay.sourceId}`,
      partyType: pay.partyType || "CUSTOMER",
      partyId: pay.partyId,
      projectId: pay.projectId,
    });

    if (pph23 > 0) {
      lines.push({
        accountCode: map.PPH_PREPAID_CUSTOMER || map.PREPAID_PPH23 || "1105.01",
        debit: pph23,
        credit: 0,
        memo: `Uang Muka PPh 23 Pelunasan Inv #${pay.sourceId}`,
        partyType: pay.partyType || "CUSTOMER",
        partyId: pay.partyId,
        projectId: pay.projectId,
      });
    }

    lines.push({
      accountCode: map.AR || "110302",
      debit: 0,
      credit: totalSettled,
      memo: `Pelunasan Piutang Inv #${pay.sourceId}`,
      partyType: pay.partyType || "CUSTOMER",
      partyId: pay.partyId,
      projectId: pay.projectId,
    });

    return lines;
  }

  /**
   * E4a: Saldo Awal Persediaan Gudang
   * Dr Persediaan (INVENTORY) / Cr Ekuitas Saldo Awal (EQUITY_INITIAL/CAPITAL).
   */
  static buildInitialStockLines(
    payload: {
      productId: number;
      productName: string;
      qty: number;
      cost: number;
      unit?: string;
    },
    map: Record<string, string>,
  ): JournalLineSpec[] {
    const qty = Number(payload.qty || 0);
    const cost = Number(payload.cost || 0);
    const total = round(qty * cost);
    if (qty <= 0 || total <= 0) return [];

    const memo = `Saldo Awal Persediaan Gudang: ${payload.productName} (${qty}${payload.unit ? ` ${payload.unit}` : ""})`;
    return [
      {
        accountCode: map.INVENTORY || "1200",
        debit: total,
        credit: 0,
        memo,
      },
      {
        accountCode: map.EQUITY_INITIAL || map.CAPITAL || "3101",
        debit: 0,
        credit: total,
        memo,
      },
    ];
  }

  /**
   * E4: Penerimaan Barang (Receiving PO)
   */
  static buildReceivingLines(
    rec: {
      number: string;
      supplierId: number;
      totalValue: number;
      projectId?: number | null;
    },
    map: Record<string, string>,
  ): JournalLineSpec[] {
    const val = round(Number(rec.totalValue));
    return [
      {
        accountCode: map.INVENTORY || "1200",
        debit: val,
        credit: 0,
        memo: `Penerimaan Barang BPB ${rec.number}`,
        partyType: "SUPPLIER",
        partyId: rec.supplierId,
        projectId: rec.projectId,
      },
      {
        accountCode: map.GRNI || "2108",
        debit: 0,
        credit: val,
        memo: `GRNI Titipan Tagihan BPB ${rec.number}`,
        partyType: "SUPPLIER",
        partyId: rec.supplierId,
        projectId: rec.projectId,
      },
    ];
  }

  /**
   * E5: Tagihan Supplier Masuk (Invoice In)
   * Selisih harga PO dicatat ke PURCHASE_PRICE_VARIANCE (5106)
   */
  static buildInvoiceInLines(
    inv: {
      number: string;
      supplierId: number;
      dpp: number;
      ppn: number;
      total: number;
      ppv?: number;
      isExpense?: boolean;
      expenseAccountCode?: string;
      projectId?: number | null;
    },
    map: Record<string, string>,
  ): JournalLineSpec[] {
    const lines: JournalLineSpec[] = [];
    const dpp = round(Number(inv.dpp));
    const ppn = round(Number(inv.ppn || 0));
    const total = round(Number(inv.total));
    const ppv = round(Number(inv.ppv || 0));

    if (inv.isExpense) {
      lines.push({
        accountCode: inv.expenseAccountCode || map.EXPENSE_DEFAULT || "6202.07",
        debit: dpp,
        credit: 0,
        memo: `Beban Operasional Tagihan #${inv.number}`,
        partyType: "SUPPLIER",
        partyId: inv.supplierId,
        projectId: inv.projectId,
      });
    } else {
      const grniBase = round(dpp - ppv);
      lines.push({
        accountCode: map.GRNI || "2108",
        debit: grniBase,
        credit: 0,
        memo: `Kliring GRNI Tagihan Supplier #${inv.number}`,
        partyType: "SUPPLIER",
        partyId: inv.supplierId,
        projectId: inv.projectId,
      });
      if (ppv > 0) {
        lines.push({
          accountCode: map.PURCHASE_PRICE_VARIANCE || "5106",
          debit: ppv,
          credit: 0,
          memo: `Selisih Harga Beli PO #${inv.number}`,
          partyType: "SUPPLIER",
          partyId: inv.supplierId,
          projectId: inv.projectId,
        });
      } else if (ppv < 0) {
        lines.push({
          accountCode: map.PURCHASE_PRICE_VARIANCE || "5106",
          debit: 0,
          credit: Math.abs(ppv),
          memo: `Selisih Harga Beli PO (Hemat) #${inv.number}`,
          partyType: "SUPPLIER",
          partyId: inv.supplierId,
          projectId: inv.projectId,
        });
      }
    }

    if (ppn > 0) {
      lines.push({
        accountCode: map.VAT_IN || "1600",
        debit: ppn,
        credit: 0,
        memo: `PPN Masukan Tagihan #${inv.number}`,
        partyType: "SUPPLIER",
        partyId: inv.supplierId,
        projectId: inv.projectId,
      });
    }

    lines.push({
      accountCode: map.AP || "210102",
      debit: 0,
      credit: total,
      memo: `Hutang Usaha Supplier #${inv.number}`,
      partyType: "SUPPLIER",
      partyId: inv.supplierId,
      projectId: inv.projectId,
    });

    return lines;
  }

  /**
   * E6: Pelunasan Tagihan Supplier
   */
  static buildSupplierPaymentLines(
    pay: PaymentContext,
    map: Record<string, string>,
  ): JournalLineSpec[] {
    const amount = round(Number(pay.amount));
    return [
      {
        accountCode: map.AP || "210102",
        debit: amount,
        credit: 0,
        memo: `Pelunasan Hutang Supplier #${pay.sourceId}`,
        partyType: pay.partyType || "SUPPLIER",
        partyId: pay.partyId,
        projectId: pay.projectId,
      },
      {
        accountCode: pay.accountCode || map.CASH_DEFAULT || "1000.02",
        debit: 0,
        credit: amount,
        memo: `Pengeluaran Kas Pembayaran Tagihan #${pay.sourceId}`,
        partyType: pay.partyType || "SUPPLIER",
        partyId: pay.partyId,
        projectId: pay.projectId,
      },
    ];
  }

  /**
   * E7: Pengiriman Barang / Surat Jalan -> Dr HPP, Cr Persediaan
   */
  static buildDeliveryLines(
    del: {
      number: string;
      costTotal: number;
      isProject: boolean;
      projectId?: number | null;
      customerId?: number | null;
    },
    map: Record<string, string>,
  ): JournalLineSpec[] {
    const cost = round(Number(del.costTotal));
    const cogsAccount = del.isProject ? (map.COGS_PROJECT || "5101") : (map.COGS_RETAIL || "5102");
    return [
      {
        accountCode: cogsAccount,
        debit: cost,
        credit: 0,
        memo: `HPP Pengiriman Barang SJ ${del.number}`,
        projectId: del.projectId,
        partyType: del.customerId ? "CUSTOMER" : undefined,
        partyId: del.customerId,
      },
      {
        accountCode: map.INVENTORY || "1200",
        debit: 0,
        credit: cost,
        memo: `Pengurangan Persediaan SJ ${del.number}`,
        projectId: del.projectId,
        partyType: del.customerId ? "CUSTOMER" : undefined,
        partyId: del.customerId,
      },
    ];
  }

  /**
   * E8a: Biaya Operasional Disetujui
   */
  static buildExpenseApprovedLines(
    exp: {
      id: number;
      number: string;
      amount: number;
      expenseAccountCode?: string;
      projectId?: number | null;
      partyId?: number | null;
      description?: string;
      reporterName?: string;
      categoryName?: string;
    },
    map: Record<string, string>,
  ): JournalLineSpec[] {
    const amount = round(Number(exp.amount));
    const pelapor = exp.reporterName || "Karyawan";
    const kategori = exp.categoryName || "Operasional";
    const deskripsi = exp.description ? `: ${exp.description}` : "";

    return [
      {
        accountCode: exp.expenseAccountCode || map.EXPENSE_DEFAULT || "6202.07",
        debit: amount,
        credit: 0,
        memo: `Beban ${kategori}${deskripsi} (${pelapor})`.slice(0, 255),
        partyType: "EMPLOYEE",
        partyId: exp.partyId,
        projectId: exp.projectId,
      },
      {
        accountCode: map.EXPENSE_PAYABLE || "2103",
        debit: 0,
        credit: amount,
        memo: `Kewajiban Biaya/Reimbursement ${kategori} — ${pelapor}`.slice(0, 255),
        partyType: "EMPLOYEE",
        partyId: exp.partyId,
        projectId: exp.projectId,
      },
    ];
  }

  /**
   * E8b: Pembayaran Biaya Operasional
   */
  static buildExpensePaidLines(
    exp: {
      id: number;
      number: string;
      amount: number;
      paidAccountCode: string;
      projectId?: number | null;
      partyId?: number | null;
      description?: string;
      reporterName?: string;
      categoryName?: string;
    },
    map: Record<string, string>,
  ): JournalLineSpec[] {
    const amount = round(Number(exp.amount));
    const expCode = exp.number.replace(/\/PAY$/, "").startsWith("EXP-")
      ? exp.number.replace(/\/PAY$/, "")
      : `EXP-${String(exp.id).padStart(3, "0")}`;
    const pelapor = exp.reporterName || "Karyawan";
    const kategori = exp.categoryName || "Operasional";
    const deskripsi = exp.description ? ` (${exp.description})` : "";

    return [
      {
        accountCode: map.EXPENSE_PAYABLE || "2103",
        debit: amount,
        credit: 0,
        memo: `Pelunasan Biaya/Reimbursement ${expCode} kepada ${pelapor}`.slice(0, 255),
        partyType: "EMPLOYEE",
        partyId: exp.partyId,
        projectId: exp.projectId,
      },
      {
        accountCode: exp.paidAccountCode || map.CASH_DEFAULT || "1000.02",
        debit: 0,
        credit: amount,
        memo: `Pengeluaran Kas/Bank ${kategori} (${pelapor})${deskripsi}`.slice(0, 255),
        partyType: "EMPLOYEE",
        partyId: exp.partyId,
        projectId: exp.projectId,
      },
    ];
  }

  /**
   * E9: Opname & Kerusakan Barang
   */
  static buildDamageLines(
    dam: {
      id: number;
      number: string;
      costTotal: number;
    },
    map: Record<string, string>,
  ): JournalLineSpec[] {
    const val = round(Number(dam.costTotal));
    return [
      {
        accountCode: map.DAMAGE_EXPENSE || map.STOCK_DAMAGE || "5105",
        debit: val,
        credit: 0,
        memo: `Beban Kerusakan Barang Rusak #${dam.number}`,
      },
      {
        accountCode: map.INVENTORY || "1200",
        debit: 0,
        credit: val,
        memo: `Pengurangan Stok Barang Rusak #${dam.number}`,
      },
    ];
  }

  static buildOpnameLines(
    opn: { id: number; number: string; diffValue: number },
    map: Record<string, string>,
  ): JournalLineSpec[] {
    const diff = round(Number(opn.diffValue));
    if (diff > 0) {
      return [
        {
          accountCode: map.INVENTORY || "1200",
          debit: diff,
          credit: 0,
          memo: `Penyesuaian Lebih Fisik Opname ${opn.number}`,
        },
        {
          accountCode: map.INVENTORY_ADJ || map.STOCK_OPNAME_DIFF || "5104",
          debit: 0,
          credit: diff,
          memo: `Selisih Fisik Lebih Opname ${opn.number}`,
        },
      ];
    } else {
      const absDiff = Math.abs(diff);
      return [
        {
          accountCode: map.INVENTORY_ADJ || map.STOCK_OPNAME_DIFF || "5104",
          debit: absDiff,
          credit: 0,
          memo: `Selisih Fisik Kurang Opname ${opn.number}`,
        },
        {
          accountCode: map.INVENTORY || "1200",
          debit: 0,
          credit: absDiff,
          memo: `Pengurangan Persediaan Opname ${opn.number}`,
        },
      ];
    }
  }

  /**
   * E10: Penggajian Karyawan & BPJS Perusahaan
   */
  static buildPayrollLines(
    pay: {
      id: number;
      slipNumber: string;
      grossSalary: number;
      bpjsCompany: number;
      pph21: number;
      bpjsEmployee: number;
      netSalary: number;
      paidAccountCode: string;
      employeeId?: number;
    },
    map: Record<string, string>,
  ): JournalLineSpec[] {
    const gross = round(Number(pay.grossSalary));
    const bpjsComp = round(Number(pay.bpjsCompany || 0));
    const pph21 = round(Number(pay.pph21 || 0));
    const bpjsTotal = round(Number(pay.bpjsCompany || 0) + Number(pay.bpjsEmployee || 0));
    const net = round(Number(pay.netSalary));

    const lines: JournalLineSpec[] = [
      {
        accountCode: map.PAYROLL_EXPENSE || map.WAGES_EXPENSE || "6201.01",
        debit: gross,
        credit: 0,
        memo: `Beban Gaji Slip ${pay.slipNumber}`,
        partyType: "EMPLOYEE",
        partyId: pay.employeeId,
      },
    ];

    if (bpjsComp > 0) {
      lines.push({
        accountCode: map.BPJS_COMPANY_EXPENSE || map.BPJS_EXPENSE || "6201.05",
        debit: bpjsComp,
        credit: 0,
        memo: `Beban BPJS Perusahaan Slip ${pay.slipNumber}`,
        partyType: "EMPLOYEE",
        partyId: pay.employeeId,
      });
    }

    if (pph21 > 0) {
      lines.push({
        accountCode: map.PPH_PAYABLE_21 || map.PPH21_PAYABLE || "2105",
        debit: 0,
        credit: pph21,
        memo: `Hutang PPh 21 Karyawan Slip ${pay.slipNumber}`,
        partyType: "EMPLOYEE",
        partyId: pay.employeeId,
      });
    }

    if (bpjsTotal > 0) {
      lines.push({
        accountCode: map.BPJS_PAYABLE || "2107",
        debit: 0,
        credit: bpjsTotal,
        memo: `Hutang BPJS Slip ${pay.slipNumber}`,
        partyType: "EMPLOYEE",
        partyId: pay.employeeId,
      });
    }

    lines.push({
      accountCode: pay.paidAccountCode || map.CASH_DEFAULT || "1000.02",
      debit: 0,
      credit: net,
      memo: `Kas Keluar Gaji Bersih Slip ${pay.slipNumber}`,
      partyType: "EMPLOYEE",
      partyId: pay.employeeId,
    });

    return lines;
  }

  /**
   * E13: Retur Penjualan (Customer Return)
   * 1. Pembalik Pendapatan & Kas/Piutang
   * 2. Pemulihan Persediaan & HPP
   */
  static buildSalesReturnLines(
    ret: {
      number: string;
      dpp: number;
      ppn: number;
      total: number;
      costTotal: number;
      isCashRefund?: boolean;
      paidAccountCode?: string;
      customerId?: number;
      projectId?: number | null;
      isProject?: boolean;
    },
    map: Record<string, string>,
  ): { financialLines: JournalLineSpec[]; inventoryLines: JournalLineSpec[] } {
    const dpp = round(Number(ret.dpp));
    const ppn = round(Number(ret.ppn || 0));
    const total = round(Number(ret.total));
    const cost = round(Number(ret.costTotal || 0));

    const financialLines: JournalLineSpec[] = [
      {
        accountCode: map.REVENUE_GOODS || "4000.01",
        debit: dpp,
        credit: 0,
        memo: `Retur Penjualan Barang #${ret.number}`,
        partyType: "CUSTOMER",
        partyId: ret.customerId,
        projectId: ret.projectId,
      },
    ];

    if (ppn > 0) {
      financialLines.push({
        accountCode: map.VAT_OUT || "2100",
        debit: ppn,
        credit: 0,
        memo: `Pembalikan PPN Keluaran Retur #${ret.number}`,
        partyType: "CUSTOMER",
        partyId: ret.customerId,
        projectId: ret.projectId,
      });
    }

    if (ret.isCashRefund) {
      financialLines.push({
        accountCode: ret.paidAccountCode || map.CASH_DEFAULT || "1000.02",
        debit: 0,
        credit: total,
        memo: `Pengembalian Kas Retur Penjualan #${ret.number}`,
        partyType: "CUSTOMER",
        partyId: ret.customerId,
        projectId: ret.projectId,
      });
    } else {
      financialLines.push({
        accountCode: map.AR || "110302",
        debit: 0,
        credit: total,
        memo: `Pengurangan Piutang Retur Penjualan #${ret.number}`,
        partyType: "CUSTOMER",
        partyId: ret.customerId,
        projectId: ret.projectId,
      });
    }

    const cogsAccount = ret.isProject ? (map.COGS_PROJECT || "5101") : (map.COGS_RETAIL || "5102");
    const inventoryLines: JournalLineSpec[] = [
      {
        accountCode: map.INVENTORY || "1200",
        debit: cost,
        credit: 0,
        memo: `Pemulihan Stok Retur Penjualan #${ret.number}`,
        projectId: ret.projectId,
      },
      {
        accountCode: cogsAccount,
        debit: 0,
        credit: cost,
        memo: `Pembalikan HPP Retur Penjualan #${ret.number}`,
        projectId: ret.projectId,
      },
    ];

    return { financialLines, inventoryLines };
  }

  /**
   * E14: Retur Pembelian (Vendor Return)
   * Dr AP (210102) atau Dr Kas/Bank (jika supplier refund transfer uang)
   * Cr INVENTORY (1200) harga perolehan retur, Cr VAT_IN (1600) membalik pajak masukan
   */
  static buildPurchaseReturnLines(
    ret: {
      number: string;
      dpp: number;
      ppn: number;
      total: number;
      isCashRefund?: boolean;
      paidAccountCode?: string;
      supplierId?: number;
      projectId?: number | null;
    },
    map: Record<string, string>,
  ): JournalLineSpec[] {
    const dpp = round(Number(ret.dpp));
    const ppn = round(Number(ret.ppn || 0));
    const total = round(Number(ret.total || dpp + ppn));

    const lines: JournalLineSpec[] = [
      {
        accountCode: ret.isCashRefund
          ? ret.paidAccountCode || map.CASH_DEFAULT || "1000.02"
          : map.AP || "210102",
        debit: total,
        credit: 0,
        memo: ret.isCashRefund
          ? `Penerimaan Refund Kas Retur Pembelian #${ret.number}`
          : `Pengurangan Hutang Usaha Retur Pembelian #${ret.number}`,
        partyType: "SUPPLIER",
        partyId: ret.supplierId,
        projectId: ret.projectId,
      },
      {
        accountCode: map.INVENTORY || "1200",
        debit: 0,
        credit: dpp,
        memo: `Pengurangan Persediaan Retur Pembelian #${ret.number}`,
        partyType: "SUPPLIER",
        partyId: ret.supplierId,
        projectId: ret.projectId,
      },
    ];

    if (ppn > 0) {
      lines.push({
        accountCode: map.VAT_IN || "1600",
        debit: 0,
        credit: ppn,
        memo: `Pembalikan PPN Masukan Retur Pembelian #${ret.number}`,
        partyType: "SUPPLIER",
        partyId: ret.supplierId,
        projectId: ret.projectId,
      });
    }

    return lines;
  }

  /**
   * E15: Invoice Retensi (Retention Claim)
   * Opsi A: Reklasifikasi Piutang Dr AR Cr AR_RETENTION
   */
  static buildRetentionInvoiceLines(
    ret: {
      number: string;
      amount: number;
      customerId: number;
      projectId?: number | null;
      optionB?: boolean; // Jika retensi belum pernah diakui di termin
      ppn?: number;
    },
    map: Record<string, string>,
  ): JournalLineSpec[] {
    const amt = round(Number(ret.amount));
    if (ret.optionB) {
      const ppn = round(Number(ret.ppn || 0));
      const tot = round(amt + ppn);
      const lines: JournalLineSpec[] = [
        {
          accountCode: map.AR || "110302",
          debit: tot,
          credit: 0,
          memo: `Tagihan Retensi Proyek Inv ${ret.number}`,
          partyType: "CUSTOMER",
          partyId: ret.customerId,
          projectId: ret.projectId,
        },
        {
          accountCode: map.REVENUE_SERVICE || "4000.02",
          debit: 0,
          credit: amt,
          memo: `Pendapatan Retensi Inv ${ret.number}`,
          projectId: ret.projectId,
        },
      ];
      if (ppn > 0) {
        lines.push({
          accountCode: map.VAT_OUT || "2100",
          debit: 0,
          credit: ppn,
          memo: `PPN Keluaran Retensi Inv ${ret.number}`,
          projectId: ret.projectId,
        });
      }
      return lines;
    }

    // Opsi A: Reklasifikasi Piutang (Pendapatan sudah diakui di termin sebelumnya)
    return [
      {
        accountCode: map.AR || "110302",
        debit: amt,
        credit: 0,
        memo: `Reklasifikasi Piutang Retensi Lancar Inv ${ret.number}`,
        partyType: "CUSTOMER",
        partyId: ret.customerId,
        projectId: ret.projectId,
      },
      {
        accountCode: map.AR_RETENTION || "110303",
        debit: 0,
        credit: amt,
        memo: `Pelepasan Piutang Retensi Proyek Inv ${ret.number}`,
        partyType: "CUSTOMER",
        partyId: ret.customerId,
        projectId: ret.projectId,
      },
    ];
  }
}
