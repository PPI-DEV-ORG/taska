import { describe, it, expect } from "vitest";
import { PostingRules } from "./posting.rules.js";

describe("PostingRules Unit Tests (11.1)", () => {
  const map: Record<string, string> = {
    CASH_DEFAULT: "1000.02",
    AR: "110302",
    AR_RETENTION: "110303",
    AP: "210102",
    GRNI: "2108",
    INVENTORY: "1200",
    VAT_OUT: "2100",
    VAT_IN: "1600",
    REVENUE_GOODS: "4000.01",
    REVENUE_SERVICE: "4000.02",
    COGS_PROJECT: "5101",
    COGS_RETAIL: "5102",
    CUSTOMER_DP: "210202",
    ADV_SALES: "210202",
    SUPPLIER_DP: "1100.02",
    ADV_PURCHASE: "1100.02",
    STOCK_OPNAME_DIFF: "5104",
    STOCK_DAMAGE: "5105",
    PURCHASE_PRICE_VARIANCE: "5106",
    EXPENSE_PAYABLE: "2103",
    EXPENSE_DEFAULT: "6202.07",
    WAGES_EXPENSE: "6201.01",
    BPJS_COMPANY_EXPENSE: "6201.05",
    PPH21_PAYABLE: "2105",
    BPJS_PAYABLE: "2107",
    PPH_PREPAID_CUSTOMER: "1105.01",
    PREPAID_PPH25: "1105.02",
    ROUNDING: "7200.02",
  };

  it("E1: Invoice Out balance test (Goods & Service with PPN)", () => {
    const lines = PostingRules.buildInvoiceOutLines(
      {
        id: 1,
        number: "INV/001",
        type: "PROJECT",
        customerId: 10,
        dpp: 10_000_000,
        ppn: 1_100_000,
        total: 11_100_000,
        items: [
          { type: "PRODUCT", amount: 4_000_000 },
          { type: "SERVICE", amount: 6_000_000 },
        ],
      },
      map,
    );

    const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
    expect(totalDebit).toBe(11_100_000);
    expect(totalCredit).toBe(11_100_000);
    expect(lines.find((l) => l.accountCode === "110302")?.debit).toBe(11_100_000);
    expect(lines.find((l) => l.accountCode === "4000.01")?.credit).toBe(4_000_000);
    expect(lines.find((l) => l.accountCode === "4000.02")?.credit).toBe(6_000_000);
    expect(lines.find((l) => l.accountCode === "2100")?.credit).toBe(1_100_000);
  });

  it("E1: Invoice Out with retention and DP applied", () => {
    const lines = PostingRules.buildInvoiceOutLines(
      {
        id: 2,
        number: "INV/002",
        type: "PROJECT",
        customerId: 10,
        dpp: 10_000_000,
        ppn: 1_100_000,
        total: 11_100_000,
        dpApplied: 4_000_000,
        retentionAmount: 500_000,
      },
      map,
    );

    const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
    expect(totalDebit).toBe(11_100_000);
    expect(totalCredit).toBe(11_100_000);
    expect(lines.find((l) => l.accountCode === "110302")?.debit).toBe(6_600_000);
    expect(lines.find((l) => l.accountCode === "110303")?.debit).toBe(500_000);
    expect(lines.find((l) => l.accountCode === "210202")?.debit).toBe(4_000_000);
  });

  it("E3: Pelunasan customer payment with PPh 23 withholding", () => {
    const lines = PostingRules.buildCustomerPaymentLines(
      {
        id: 1,
        sourceType: "INVOICE_OUT",
        sourceId: 1,
        amount: 6_540_000,
        accountCode: "1000.02",
        pph23Amount: 120_000,
        partyType: "CUSTOMER",
        partyId: 10,
      },
      map,
    );

    const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
    expect(totalDebit).toBe(6_660_000);
    expect(totalCredit).toBe(6_660_000);
    expect(lines.find((l) => l.accountCode === "1000.02")?.debit).toBe(6_540_000);
    expect(lines.find((l) => l.accountCode === "1105.01")?.debit).toBe(120_000);
    expect(lines.find((l) => l.accountCode === "110302")?.credit).toBe(6_660_000);
  });

  it("E5: Invoice in with PPV (Purchase Price Variance)", () => {
    const lines = PostingRules.buildInvoiceInLines(
      {
        number: "INV-SUPP-001",
        supplierId: 5,
        dpp: 10_200_000,
        ppn: 1_122_000,
        total: 11_322_000,
        ppv: 200_000,
      },
      map,
    );

    const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
    expect(totalDebit).toBe(11_322_000);
    expect(totalCredit).toBe(11_322_000);
    expect(lines.find((l) => l.accountCode === "2108")?.debit).toBe(10_000_000);
    expect(lines.find((l) => l.accountCode === "5106")?.debit).toBe(200_000);
    expect(lines.find((l) => l.accountCode === "1600")?.debit).toBe(1_122_000);
    expect(lines.find((l) => l.accountCode === "210102")?.credit).toBe(11_322_000);
  });

  it("E10: Payroll with BPJS Company portion and PPh 21", () => {
    const lines = PostingRules.buildPayrollLines(
      {
        id: 1,
        slipNumber: "SLIP/001",
        grossSalary: 4_000_000,
        bpjsCompany: 400_000,
        pph21: 100_000,
        bpjsEmployee: 150_000,
        netSalary: 3_750_000,
        paidAccountCode: "1000.02",
        employeeId: 2,
      },
      map,
    );

    const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
    expect(totalDebit).toBe(4_400_000);
    expect(totalCredit).toBe(4_400_000);
    expect(lines.find((l) => l.accountCode === "6201.01")?.debit).toBe(4_000_000);
    expect(lines.find((l) => l.accountCode === "6201.05")?.debit).toBe(400_000);
    expect(lines.find((l) => l.accountCode === "2105")?.credit).toBe(100_000);
    expect(lines.find((l) => l.accountCode === "2107")?.credit).toBe(550_000);
    expect(lines.find((l) => l.accountCode === "1000.02")?.credit).toBe(3_750_000);
  });
});
