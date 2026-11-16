import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConflictException } from "@nestjs/common";
import { PostingService } from "./posting.service.js";

const accounts = ["1000.02", "1000.01", "110302", "4000.01", "7200.02"].map((code) => ({
  code, name: code, status: "AKTIF", isPostable: true,
}));

function setup(existing: any[] = []) {
  const entries = [...existing];
  const journalEntry = {
    findFirst: vi.fn(async ({ where, orderBy }: any) => {
      const rows = entries
        .filter(
          (e) =>
            (where.sourceType === undefined || e.sourceType === where.sourceType) &&
            (where.sourceId === undefined || e.sourceId === where.sourceId) &&
            (where.event === undefined || e.event === where.event) &&
            (where.status === undefined || e.status === where.status) &&
            (where.number?.startsWith === undefined || e.number.startsWith(where.number.startsWith)),
        )
        .sort((a, b) => (orderBy?.version ? b.version - a.version : 0));
      return rows[0] ?? null;
    }),
    findUnique: vi.fn(async ({ where }: any) => entries.find((e) => e.id === where.id) ?? null),
    create: vi.fn(async ({ data }: any) => {
      const row = { id: entries.length + 100, status: "POSTED", ...data, lines: data.lines?.create ?? [] };
      entries.push(row);
      return row;
    }),
    update: vi.fn(async ({ where, data }: any) => Object.assign(entries.find((e) => e.id === where.id), data)),
  };
  const prisma: any = {
    main: {
      coaAccount: { findMany: vi.fn(async () => accounts) },
      journalEntry,
      $transaction: vi.fn(async (cb: any) => cb(prisma.main)),
    },
  };
  const mapping: any = { get: vi.fn(async (_k: string, d: string) => d), getAll: vi.fn(async () => ({})) };
  const period: any = {
    assertPeriodOpen: vi.fn(async () => ({ id: 1, year: 2026, month: 11 })),
    getOrCreatePeriod: vi.fn(async () => ({ id: 1, year: 2026, month: 11, status: "OPEN" })),
  };
  return { svc: new PostingService(prisma, mapping, period), entries, journalEntry };
}

const payReq = (account = "1000.02", amount = 500_000) => ({
  date: new Date("2026-11-10"),
  source: "INVOICE_OUT_PAYMENT",
  sourceType: "Payment",
  sourceId: 7,
  event: "received",
  memo: "Bayar",
  lines: [
    { accountCode: account, debit: amount },
    { accountCode: "110302", credit: amount },
  ],
});

describe("PostingService idempotensi (anti jurnal dobel)", () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => (ctx = setup()));

  it("posting kedua dengan isi sama mengembalikan jurnal yang sama (double click aman)", async () => {
    const a = await ctx.svc.post(payReq());
    const b = await ctx.svc.post(payReq());
    expect(b.id).toBe(a.id);
    expect(ctx.journalEntry.create).toHaveBeenCalledTimes(1);
  });

  it("posting kedua dengan isi berbeda DITOLAK (bukan diam-diam membuat jurnal kedua)", async () => {
    await ctx.svc.post(payReq("1000.02", 500_000));
    await expect(ctx.svc.post(payReq("1000.02", 900_000))).rejects.toBeInstanceOf(ConflictException);
    expect(ctx.journalEntry.create).toHaveBeenCalledTimes(1);
  });

  it("ganti akun kas dengan total sama tetap terdeteksi berbeda", async () => {
    await ctx.svc.post(payReq("1000.02"));
    await expect(ctx.svc.post(payReq("1000.01"))).rejects.toBeInstanceOf(ConflictException);
  });

  it("repost: isi sama -> tidak ada perubahan; isi beda -> balik versi lama & posting versi berikutnya", async () => {
    const first = await ctx.svc.post(payReq());
    const same = await ctx.svc.repost(payReq());
    expect(same.id).toBe(first.id);
    expect(ctx.journalEntry.create).toHaveBeenCalledTimes(1);

    const next = await ctx.svc.repost(payReq("1000.02", 600_000));
    expect(next.version).toBe(2);
    expect(ctx.entries.find((e) => e.id === first.id)?.status).toBe("REVERSED");
    const reversal = ctx.entries.find((e) => e.reversalOfId === first.id);
    expect(reversal?.event).toBe("received:rev");
  });

  it("sameLines mengabaikan baris pembulatan ≤ 2 rupiah", () => {
    expect(
      PostingService.sameLines(
        [{ accountCode: "A", debit: 1001 }, { accountCode: "B", credit: 1000 }, { accountCode: "R", credit: 1 }],
        [{ accountCode: "A", debit: 1001 }, { accountCode: "B", credit: 1000 }],
      ),
    ).toBe(true);
  });
});
