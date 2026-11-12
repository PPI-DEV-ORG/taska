import { describe, it, expect, vi, beforeEach } from "vitest";
import { PostingService } from "./posting.service.js";

describe("PostingService Unit Tests (11.1 & 11.2 Skenario Terpadu)", () => {
  let postingService: PostingService;
  let mockPrisma: any;
  let mockMappingService: any;
  let mockPeriodService: any;

  beforeEach(() => {
    mockMappingService = {
      get: vi.fn().mockImplementation((key, defaultVal) => defaultVal),
      getAll: vi.fn().mockResolvedValue({
        CASH_DEFAULT: "1000.02",
        AR: "110302",
        AP: "210102",
        GRNI: "2108",
        INVENTORY: "1200",
        VAT_OUT: "2100",
        VAT_IN: "1600",
        REVENUE_GOODS: "4000.01",
        REVENUE_SERVICE: "4000.02",
        COGS_PROJECT: "5101",
        COGS_RETAIL: "5102",
        PURCHASE_PRICE_VARIANCE: "5106",
        ROUNDING: "7200.02",
      }),
    };

    mockPeriodService = {
      assertPeriodOpen: vi.fn().mockResolvedValue({ id: 1, year: 2026, month: 11 }),
      getOrCreatePeriod: vi.fn().mockResolvedValue({ id: 1, year: 2026, month: 11, status: "OPEN" }),
    };

    mockPrisma = {
      main: {
        coaAccount: {
          findMany: vi.fn().mockResolvedValue([
            { code: "1000.02", name: "Bank Mandiri", status: "AKTIF", isPostable: true },
            { code: "110302", name: "Piutang Usaha", status: "AKTIF", isPostable: true },
            { code: "1105.01", name: "Uang Muka PPh 23", status: "AKTIF", isPostable: true },
            { code: "1200", name: "Persediaan", status: "AKTIF", isPostable: true },
            { code: "1600", name: "PPN Masukan", status: "AKTIF", isPostable: true },
            { code: "2100", name: "PPN Keluaran", status: "AKTIF", isPostable: true },
            { code: "210102", name: "Hutang Usaha", status: "AKTIF", isPostable: true },
            { code: "210202", name: "Uang Muka Penjualan", status: "AKTIF", isPostable: true },
            { code: "2105", name: "Hutang PPh 21", status: "AKTIF", isPostable: true },
            { code: "2107", name: "Hutang BPJS", status: "AKTIF", isPostable: true },
            { code: "2108", name: "GRNI", status: "AKTIF", isPostable: true },
            { code: "3101", name: "Modal Disetor", status: "AKTIF", isPostable: true },
            { code: "4000.01", name: "Penjualan Barang", status: "AKTIF", isPostable: true },
            { code: "4000.02", name: "Pendapatan Jasa", status: "AKTIF", isPostable: true },
            { code: "5102", name: "HPP Retail", status: "AKTIF", isPostable: true },
            { code: "5106", name: "PPV", status: "AKTIF", isPostable: true },
            { code: "6201.01", name: "Beban Gaji", status: "AKTIF", isPostable: true },
            { code: "6201.05", name: "BPJS Perusahaan", status: "AKTIF", isPostable: true },
            { code: "7200.02", name: "Rounding", status: "AKTIF", isPostable: true },
          ]),
        },
        journalEntry: {
          findFirst: vi.fn().mockResolvedValue(null),
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockImplementation((args) => ({ id: Math.floor(Math.random() * 1000) + 1, ...args.data })),
          update: vi.fn().mockImplementation((args) => args.data),
        },
        $transaction: vi.fn().mockImplementation(async (callback) => callback(mockPrisma.main)),
      },
    };

    postingService = new PostingService(mockPrisma, mockMappingService, mockPeriodService);
  });

  it("T1: Setoran Modal Awal Tunai Rp 50.000.000 (Dr 1000.02 Cr 3101)", async () => {
    const res = await postingService.post({
      date: new Date("2026-11-01"),
      source: "MANUAL",
      memo: "Setoran Modal Awal",
      lines: [
        { accountCode: "1000.02", debit: 50_000_000, credit: 0 },
        { accountCode: "3101", debit: 0, credit: 50_000_000 },
      ],
    });

    expect(res).toBeDefined();
    expect(res.status).toBe("POSTED");
    expect(res.lines.create[0].debit).toBe(50_000_000);
    expect(res.lines.create[1].credit).toBe(50_000_000);
  });

  it("Tolak jurnal tidak seimbang selisih > 2 rupiah", async () => {
    await expect(
      postingService.post({
        date: new Date("2026-11-01"),
        source: "MANUAL",
        memo: "Jurnal Rusak",
        lines: [
          { accountCode: "1000.02", debit: 10_000, credit: 0 },
          { accountCode: "3101", debit: 0, credit: 5_000 },
        ],
      }),
    ).rejects.toThrow("Jurnal tidak seimbang");
  });

  it("Toleransi pembulatan otomatis selisih <= 2 rupiah ke akun ROUNDING", async () => {
    const res = await postingService.post({
      date: new Date("2026-11-01"),
      source: "MANUAL",
      memo: "Jurnal Pembulatan",
      lines: [
        { accountCode: "1000.02", debit: 10_001, credit: 0 },
        { accountCode: "3101", debit: 0, credit: 10_000 },
      ],
    });

    expect(res.lines.create.length).toBe(3);
    const roundingLine = res.lines.create.find((l: any) => l.accountCode === "7200.02");
    expect(roundingLine).toBeDefined();
    expect(roundingLine.credit).toBe(1);
  });

  it("Tolak posting jika akun tidak aktif atau non-postable", async () => {
    mockPrisma.main.coaAccount.findMany.mockResolvedValueOnce([
      { code: "1000", name: "Kas Header", status: "AKTIF", isPostable: false },
      { code: "3101", name: "Modal Disetor", status: "AKTIF", isPostable: true },
    ]);

    await expect(
      postingService.post({
        date: new Date("2026-11-01"),
        source: "MANUAL",
        memo: "Posting ke Header",
        lines: [
          { accountCode: "1000", debit: 10_000, credit: 0 },
          { accountCode: "3101", debit: 0, credit: 10_000 },
        ],
      }),
    ).rejects.toThrow("Header dan tidak dapat dijurnal langsung");
  });
});
