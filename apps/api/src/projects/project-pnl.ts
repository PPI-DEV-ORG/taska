import type { PrismaClient } from "../generated/prisma/client.js";
import { netUnitCost } from "../accounting/purchase-vat.js";

type Db = Pick<
  PrismaClient,
  "project" | "invoiceOut" | "stockMovement" | "supplierPO" | "purchaseRequest" | "expense" | "clientPO" | "deliveryNote" | "cashAdvance"
>;

/** Kategori pergerakan stok yang berarti barang dipakai / dikirim ke project (HPP). */
const OUT_TO_PROJECT = ["KELUAR_PROJECT", "KELUAR_SURAT_JALAN", "BARANG_TERPAKAI", "PENGGANTIAN"] as const;

export type ProjectPnl = {
  revenue: number;
  revenueSource: "INVOICE" | "SO" | "PENAWARAN" | "NONE";
  hppGoods: number;
  hppLines: Array<{
    productId: number;
    name: string;
    sku: string | null;
    unit: string | null;
    qtyOut: number;
    qtyReturned: number;
    qtyNet: number;
    unitCost: number;
    total: number;
    costSource: "MUTASI" | "RATA_RATA" | "HARGA_BELI" | "TIDAK_ADA";
  }>;
  directPurchases: number;
  directPurchaseLines: Array<{ ref: string; name: string; qty: number; unitCost: number; total: number }>;
  expenses: number;
  /** Uang jalan / kas proyek yang sudah dicairkan dan belum diselesaikan (masih dipegang tim). */
  cashAdvanceOutstanding: number;
  /** Biaya dari uang jalan yang sudah dilaporkan tapi BELUM diverifikasi Finance (belum masuk laba resmi). */
  cashAdvancePending: number;
  /** Laba bila biaya uang jalan yang menunggu verifikasi ikut dihitung. */
  netProfitWithPending: number;
  grossProfit: number;
  netProfit: number;
  marginPct: number;
  missingCostProducts: number;
};

const round = (n: number) => Math.round(n);

/**
 * Laba-rugi project:
 *   Pendapatan  = DPP invoice resmi project (bukan proforma); bila belum ada invoice, DPP SO / penawaran (estimasi).
 *   HPP barang  = semua barang yang keluar ke project — DARI STOK GUDANG maupun pembelian langsung —
 *                 dikurangi retur, dinilai dengan harga pokok (mutasi → rata-rata → harga beli).
 *   Pembelian non-stok = jasa / material non-master yang dibeli khusus project (tidak lewat stok).
 *   Biaya operasional = pengeluaran disetujui / dibayar (termasuk biaya dari uang jalan).
 * PPN tidak dihitung (PPN keluaran/masukan bukan pendapatan/biaya).
 */
export async function computeProjectPnl(db: Db, projectId: number): Promise<ProjectPnl> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      quotationId: true,
      quotation: { select: { total: true, discount: true, ppn: true, grandTotal: true } },
    },
  });
  if (!project) throw new Error("Project tidak ditemukan");

  const [invoices, sos] = await Promise.all([
    db.invoiceOut.findMany({
      where: { projectId, isProforma: false, status: { not: "BATAL" } },
      select: { id: true, amount: true },
    }),
    db.clientPO.findMany({
      where: { OR: [{ projectId }, ...(project.quotationId ? [{ quotationId: project.quotationId }] : [])] },
      select: { id: true, amount: true },
    }),
  ]);
  // Barang project sering keluar lewat SURAT JALAN yang terhubung ke SO / invoice project (mutasinya tanpa projectId).
  const dns = await db.deliveryNote.findMany({
    where: {
      OR: [
        { locations: { some: { projectId } } },
        ...(sos.length ? [{ clientPoId: { in: sos.map((s) => s.id) } }] : []),
        ...(invoices.length ? [{ invoiceId: { in: invoices.map((i) => i.id) } }] : []),
      ],
    },
    select: { id: true },
  });
  const dnIds = dns.map((d) => d.id);

  const [movements, pos, prs, expenses, advances] = await Promise.all([
    db.stockMovement.findMany({
      where: {
        AND: [
          { OR: [{ projectId }, ...(dnIds.length ? [{ deliveryNoteId: { in: dnIds } }] : [])] },
          {
            OR: [
              { type: "OUT", category: { in: [...OUT_TO_PROJECT] } },
              { type: "IN", category: "RETUR_PROJECT" },
            ],
          },
        ],
      },
      select: {
        type: true,
        qty: true,
        unitCost: true,
        totalCost: true,
        productId: true,
        product: { select: { id: true, name: true, sku: true, unit: true, avgCost: true, purchasePrice: true } },
      },
    }),
    db.supplierPO.findMany({
      where: { projectId, status: { notIn: ["DITOLAK", "DIBATALKAN"] } },
      select: {
        number: true,
        requestId: true,
        ppnMode: true,
        request: { select: { ppnMode: true } },
        items: { select: { productId: true, customName: true, qty: true, price: true } },
      },
    }),
    db.purchaseRequest.findMany({
      where: { projectId, status: { notIn: ["DITOLAK", "DIBATALKAN"] } },
      select: { id: true, number: true, ppnMode: true, items: { select: { productId: true, customName: true, qty: true, unitCost: true } } },
    }),
    db.expense.findMany({
      where: { projectId, status: { in: ["DISETUJUI", "DIBAYAR"] } },
      select: { amount: true },
    }),
    db.cashAdvance.findMany({
      where: { projectId, status: { in: ["DICAIRKAN", "DILAPORKAN"] } },
      select: { disbursedAmount: true, items: { select: { amount: true } } },
    }),
  ]);

  // ── Pendapatan (DPP, tanpa PPN) ──
  let revenue = invoices.reduce((s, i) => s + Number(i.amount || 0), 0);
  let revenueSource: ProjectPnl["revenueSource"] = revenue > 0 ? "INVOICE" : "NONE";
  if (revenue <= 0) {
    const soDpp = sos.reduce((s, so) => s + Number(so.amount || 0), 0);
    if (soDpp > 0) {
      revenue = soDpp;
      revenueSource = "SO";
    } else if (project.quotation) {
      const q = project.quotation;
      const net = Math.max(0, Number(q.total || 0) - Number(q.discount || 0));
      // Harga termasuk PPN bila grandTotal ≈ net (PPN sudah di dalam harga)
      const include = Number(q.ppn || 0) > 0 && Math.abs(Number(q.grandTotal || 0) - net) < 2;
      revenue = include ? round(net / 1.11) : net;
      revenueSource = revenue > 0 ? "PENAWARAN" : "NONE";
    }
  }

  // ── HPP barang: stok gudang + pembelian langsung ke project, dikurangi retur ──
  const byProduct = new Map<number, ProjectPnl["hppLines"][number] & { mutationCost: number; mutationQty: number }>();
  for (const m of movements) {
    const p = m.product;
    const line =
      byProduct.get(m.productId) ??
      {
        productId: m.productId,
        name: p?.name ?? `Produk #${m.productId}`,
        sku: p?.sku ?? null,
        unit: p?.unit ?? null,
        qtyOut: 0,
        qtyReturned: 0,
        qtyNet: 0,
        unitCost: 0,
        total: 0,
        costSource: "TIDAK_ADA" as const,
        mutationCost: 0,
        mutationQty: 0,
      };
    if (m.type === "OUT") line.qtyOut += m.qty;
    else line.qtyReturned += m.qty;
    const mvCost = Number(m.totalCost || 0) > 0 ? Number(m.totalCost) : Number(m.unitCost || 0) * m.qty;
    if (mvCost > 0 && m.type === "OUT") {
      line.mutationCost += mvCost;
      line.mutationQty += m.qty;
    }
    byProduct.set(m.productId, line);
  }
  const productInfo = new Map(movements.map((m) => [m.productId, m.product]));
  const hppLines: ProjectPnl["hppLines"] = [];
  let missingCostProducts = 0;
  for (const line of byProduct.values()) {
    const p = productInfo.get(line.productId);
    line.qtyNet = Math.max(0, line.qtyOut - line.qtyReturned);
    if (line.mutationQty > 0) {
      line.unitCost = line.mutationCost / line.mutationQty;
      line.costSource = "MUTASI";
    } else if (Number(p?.avgCost || 0) > 0) {
      line.unitCost = Number(p?.avgCost);
      line.costSource = "RATA_RATA";
    } else if (Number(p?.purchasePrice || 0) > 0) {
      line.unitCost = Number(p?.purchasePrice);
      line.costSource = "HARGA_BELI";
    } else {
      missingCostProducts += line.qtyNet > 0 ? 1 : 0;
    }
    line.total = round(line.qtyNet * line.unitCost);
    const { mutationCost: _c, mutationQty: _q, ...clean } = line;
    if (clean.qtyOut > 0 || clean.qtyReturned > 0) hppLines.push({ ...clean, unitCost: round(clean.unitCost) });
  }
  hppLines.sort((a, b) => b.total - a.total);
  const hppGoods = hppLines.reduce((s, l) => s + l.total, 0);

  // ── Pembelian non-stok (jasa / material non-master) khusus project ──
  // Barang ber-produk TIDAK dihitung di sini: sudah masuk HPP saat keluar ke project.
  const directPurchaseLines: ProjectPnl["directPurchaseLines"] = [];
  const prWithPo = new Set(pos.map((p) => p.requestId).filter((v): v is number => typeof v === "number"));
  for (const po of pos) {
    for (const it of po.items) {
      if (it.productId) continue;
      const unitCost = netUnitCost(Number(it.price || 0), po.ppnMode ?? po.request?.ppnMode);
      const total = round(it.qty * unitCost);
      if (total > 0) directPurchaseLines.push({ ref: po.number, name: it.customName || "Item non-stok", qty: it.qty, unitCost: round(unitCost), total });
    }
  }
  for (const pr of prs) {
    if (prWithPo.has(pr.id)) continue; // sudah dihitung dari PO-nya
    for (const it of pr.items) {
      if (it.productId) continue;
      const unitCost = netUnitCost(Number(it.unitCost || 0), pr.ppnMode);
      const total = round(it.qty * unitCost);
      if (total > 0) directPurchaseLines.push({ ref: pr.number, name: (it.customName || "Item non-stok").replace(/\[PAKAI_HABIS\]|\[CONSUMABLE\]/gi, "").trim(), qty: it.qty, unitCost: round(unitCost), total });
    }
  }
  const directPurchases = directPurchaseLines.reduce((s, l) => s + l.total, 0);

  const expenseTotal = round(expenses.reduce((s, e) => s + Number(e.amount || 0), 0));
  const grossProfit = round(revenue - hppGoods - directPurchases);
  const netProfit = round(grossProfit - expenseTotal);
  const marginPct = revenue > 0 ? Math.round((netProfit / revenue) * 1000) / 10 : 0;
  const cashAdvanceOutstanding = round(advances.reduce((s, a) => s + Number(a.disbursedAmount || 0), 0));
  const cashAdvancePending = round(advances.reduce((s, a) => s + a.items.reduce((t, it) => t + Number(it.amount || 0), 0), 0));

  return {
    revenue: round(revenue),
    revenueSource,
    hppGoods,
    hppLines,
    directPurchases,
    directPurchaseLines,
    expenses: expenseTotal,
    cashAdvanceOutstanding,
    cashAdvancePending,
    netProfitWithPending: round(netProfit - cashAdvancePending),
    grossProfit,
    netProfit,
    marginPct,
    missingCostProducts,
  };
}
