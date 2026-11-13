import { describe, expect, it, vi } from "vitest";
import { InvoiceOutService } from "./invoice-out.service.js";

const day = 24 * 3600 * 1000;
const inv = (over: Record<string, unknown>) => ({
  id: 1,
  number: "INV/2026/11/001/1",
  type: "TERMIN",
  status: "SENT",
  total: 1000,
  paidAmount: 0,
  projectId: null,
  clientPoId: null,
  description: "",
  dueDate: new Date(Date.now() + 10 * day),
  ...over,
});

function makeService(opts: { paidClosers?: any[]; pos?: any[]; invoices?: any[] }) {
  const invoiceOut = {
    findMany: vi.fn(async (args: any) => (args?.where?.status === "PAID" ? opts.paidClosers ?? [] : opts.invoices ?? [])),
    update: vi.fn(),
    updateMany: vi.fn(),
  };
  const clientPO = { findMany: vi.fn(async () => opts.pos ?? []) };
  const prisma = { main: { invoiceOut, clientPO } } as any;
  const svc = new (InvoiceOutService as any)(prisma, {}, {}, {}, {}, {}, {}, {});
  return { svc: svc as any, invoiceOut, clientPO };
}

describe("InvoiceOutService.viewMany (baca-saja & batch)", () => {
  it("tidak menulis ke database dan memakai query tetap meski barisnya banyak", async () => {
    const rows = Array.from({ length: 50 }, (_, i) =>
      inv({ id: i + 1, number: `INV/2026/11/${String(i + 1).padStart(3, "0")}/1`, clientPoId: 7 }),
    );
    const { svc, invoiceOut, clientPO } = makeService({
      paidClosers: [],
      pos: [{ id: 7, amount: 100 }],
      invoices: rows.map((r) => ({ clientPoId: 7, total: 1000 })),
    });
    const out = await svc.viewMany(rows);
    expect(out).toHaveLength(50);
    // 1 query jumlah invoice per PO + 1 query nilai PO = 2, bukan 50x
    expect(invoiceOut.findMany.mock.calls.length + clientPO.findMany.mock.calls.length).toBe(2);
    expect(invoiceOut.update).not.toHaveBeenCalled();
    expect(invoiceOut.updateMany).not.toHaveBeenCalled();
  });

  it("status jatuh tempo diturunkan saat baca tanpa menulis", async () => {
    const { svc, invoiceOut } = makeService({});
    const [v] = await svc.viewMany([inv({ type: "PELUNASAN", dueDate: new Date(Date.now() - 2 * day) })]);
    expect(v.status).toBe("OVERDUE");
    expect(invoiceOut.update).not.toHaveBeenCalled();
  });

  it("termin yang belum dibayar TIDAK ikut lunas hanya karena invoice pelunasan sudah dibayar", async () => {
    // Tagihan bertahap: tiap invoice menagih porsinya sendiri. Menganggapnya lunas = piutang hilang tanpa uang masuk.
    const row = inv({ id: 1, number: "INV/2026/11/001/1", type: "TERMIN", projectId: 5 });
    const { svc, invoiceOut } = makeService({
      paidClosers: [{ id: 2, number: "INV/2026/11/001/2", type: "PELUNASAN", description: "", projectId: 5 }],
    });
    const [v] = await svc.viewMany([row]);
    expect(v.status).toBe("SENT");
    expect(Number(v.paidAmount)).toBe(0);
    expect(invoiceOut.update).not.toHaveBeenCalled();
  });

  it("status Lunas hanya dari uang yang tercatat", async () => {
    const { svc } = makeService({});
    const [paid, partial, legacyForced] = await svc.viewMany([
      inv({ id: 1, paidAmount: 1000 }),
      inv({ id: 2, paidAmount: 400 }),
      inv({ id: 3, status: "PAID", paidAmount: 0 }),
    ]);
    expect(paid.status).toBe("PAID");
    expect(partial.status).toBe("PARTIAL");
    expect(legacyForced.status).toBe("SENT");
  });

  it("peringatan muncul bila total invoice melebihi nilai PO", async () => {
    const row = inv({ clientPoId: 9, type: "PELUNASAN" });
    const { svc } = makeService({ pos: [{ id: 9, amount: 500 }], invoices: [{ clientPoId: 9, total: 1000 }] });
    const [v] = await svc.viewMany([row]);
    expect(v.warning).toMatch(/melebihi nilai PO/);
  });
});
