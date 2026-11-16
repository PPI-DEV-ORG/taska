import { describe, expect, it, vi } from "vitest";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { InvoiceOutService } from "./invoice-out.service.js";

const user = { id: 1, role: "FINANCE", name: "Fin" } as any;

/**
 * Simulasi DB minimal: invoiceOut.updateMany menerapkan syarat `paidAmount <= X` seperti MySQL,
 * jadi dua pembayaran "bersamaan" hanya satu yang lolos.
 */
function makeService(invOver: Record<string, unknown> = {}, opts: { failJournal?: boolean } = {}) {
  const inv: any = {
    id: 1, number: "INV/2026/11/001", type: "PELUNASAN", status: "SENT",
    total: 1_000_000, paidAmount: 0, projectId: null, clientPoId: null, customerId: 3,
    description: "", dueDate: new Date(Date.now() + 86400000), date: new Date(),
    ...invOver,
  };
  const payments: any[] = [];
  const invoiceOut = {
    findUnique: vi.fn(async () => ({ ...inv })),
    findUniqueOrThrow: vi.fn(async () => ({ ...inv })),
    findMany: vi.fn(async () => []),
    updateMany: vi.fn(async ({ where, data }: any) => {
      const max = Number(where.paidAmount.lte);
      if (inv.status === "BATAL" || Number(inv.paidAmount) > max) return { count: 0 };
      inv.paidAmount = Number(inv.paidAmount) + Number(data.paidAmount.increment);
      return { count: 1 };
    }),
    update: vi.fn(async ({ data }: any) => Object.assign(inv, data) && { ...inv, payments }),
  };
  const payment = {
    create: vi.fn(async ({ data }: any) => {
      const p = { id: payments.length + 1, ...data };
      payments.push(p);
      return p;
    }),
  };
  const main: any = {
    invoiceOut,
    payment,
    clientPO: { findMany: vi.fn(async () => []) },
    project: { update: vi.fn(async () => ({})) },
    file: { update: vi.fn(async () => ({})) },
  };
  // Transaksi: bila callback melempar error, rollback HANYA perubahan yang dibuat transaksi itu sendiri
  main.$transaction = vi.fn(async (cb: any) => {
    let incremented = 0;
    const created: any[] = [];
    const txClient = {
      ...main,
      invoiceOut: {
        ...invoiceOut,
        updateMany: async (args: any) => {
          const r = await invoiceOut.updateMany(args);
          if (r.count) incremented += Number(args.data.paidAmount.increment);
          return r;
        },
      },
      payment: {
        create: async (args: any) => {
          const p = await payment.create(args);
          created.push(p);
          return p;
        },
      },
    };
    try {
      return await cb(txClient);
    } catch (e) {
      inv.paidAmount = Number(inv.paidAmount) - incremented;
      for (const p of created) payments.splice(payments.indexOf(p), 1);
      throw e;
    }
  });
  const posting = {
    post: vi.fn(async () => {
      if (opts.failJournal) throw new BadRequestException("Akun 1000.02 tidak ditemukan di Bagan Akun.");
      return { id: 99 };
    }),
    repost: vi.fn(async () => ({})),
  };
  const mapping = { getAll: vi.fn(async () => ({ CASH_DEFAULT: "1000.02" })) };
  const noop = { log: vi.fn(async () => {}), notify: vi.fn(async () => {}), dataChange: vi.fn() };
  const reservations = { releaseForDocument: vi.fn(async () => {}) };
  const svc: any = new (InvoiceOutService as any)({ main }, noop, {}, {}, reservations, noop, {}, posting, mapping);
  // Isolasi dari logika stok / SN / jurnal penerbitan
  svc.assertStockAvailabilityForInvoice = vi.fn(async () => {});
  svc.postInvoiceJournalIfEligible = vi.fn(async () => {});
  svc.lockAndAutoSwapOnPaid = vi.fn(async () => {});
  svc.warningFor = vi.fn(async () => ({}));
  return { svc, inv, payments, posting };
}

describe("InvoiceOutService.addPayment — anti bayar dobel", () => {
  it("bayar penuh -> PAID, satu baris Payment, satu jurnal", async () => {
    const { svc, inv, payments, posting } = makeService();
    await svc.addPayment(1, { amount: 1_000_000 }, user);
    expect(inv.paidAmount).toBe(1_000_000);
    expect(inv.status).toBe("PAID");
    expect(payments).toHaveLength(1);
    expect(posting.post).toHaveBeenCalledTimes(1);
  });

  it("menolak pembayaran pada invoice yang sudah lunas", async () => {
    const { svc, payments } = makeService({ paidAmount: 1_000_000, status: "PAID" });
    await expect(svc.addPayment(1, { amount: 1_000_000 }, user)).rejects.toThrow(/sudah lunas/);
    expect(payments).toHaveLength(0);
  });

  it("menolak pembayaran yang melebihi sisa tagihan", async () => {
    const { svc } = makeService({ paidAmount: 600_000 });
    await expect(svc.addPayment(1, { amount: 500_000 }, user)).rejects.toThrow(/melebihi sisa tagihan/);
  });

  it("dua pembayaran penuh bersamaan (double click / dua perangkat): hanya satu yang tercatat", async () => {
    const { svc, inv, payments } = makeService();
    const results = await Promise.allSettled([
      svc.addPayment(1, { amount: 1_000_000 }, user),
      svc.addPayment(1, { amount: 1_000_000 }, user),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ConflictException);
    expect(payments).toHaveLength(1);
    expect(inv.paidAmount).toBe(1_000_000);
  });

  it("bila jurnal kas gagal, pembayaran ikut dibatalkan (tidak ada uang 'masuk' tanpa jurnal)", async () => {
    const { svc, inv, payments } = makeService({}, { failJournal: true });
    await expect(svc.addPayment(1, { amount: 1_000_000 }, user)).rejects.toThrow(/Bagan Akun/);
    expect(payments).toHaveLength(0);
    expect(inv.paidAmount).toBe(0);
  });

  it("PPh 23 yang dipotong customer ikut melunasi piutang", async () => {
    const { svc, inv, payments } = makeService();
    await svc.addPayment(1, { amount: 980_000, pph23Amount: 20_000 }, user);
    expect(inv.status).toBe("PAID");
    expect(payments[0].amount).toBe(1_000_000);
  });
});

describe("InvoiceOutService.setStatus — status lunas tidak bisa dipaksa", () => {
  it("menandai PAID tanpa pembayaran tercatat ditolak", async () => {
    const { svc } = makeService();
    await expect(svc.setStatus(1, "PAID", user)).rejects.toThrow(/Catat pembayaran/);
  });

  it("mengembalikan invoice berbayar ke SENT ditolak (dulu me-reset paidAmount -> bisa dibayar lagi)", async () => {
    const { svc } = makeService({ paidAmount: 1_000_000, status: "PAID" });
    await expect(svc.setStatus(1, "SENT", user)).rejects.toThrow(/Void pembayarannya/);
  });
});
