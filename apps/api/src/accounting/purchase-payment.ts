import { round } from "./accounting.types.js";

/**
 * Satu pembelian hanya boleh dibayar lewat SATU jalur kas:
 *   A. Bayar langsung di Request Barang (status DIBAYAR)       -> jurnal PurchaseRequest:paid  (Dr GRNI/HPP  Cr Kas)
 *   B. Tandai PO Supplier "Lunas" (tanpa invoice supplier)      -> jurnal SupplierPO:paid       (Dr GRNI      Cr Kas)
 *   C. Bayar Invoice Supplier (Invoice In)                      -> jurnal Payment:settled       (Dr Hutang    Cr Kas)
 *
 * A/B disebut "pembayaran di muka / langsung". Bila sudah terjadi lalu invoice supplier datang,
 * invoice itu dilunasi lewat KOMPENSASI (Dr Hutang Cr GRNI), bukan kas keluar lagi.
 * Sebaliknya, bila invoice supplier sudah dibayar (C), jalur A/B hanya menandai status tanpa jurnal kas.
 */

/** Penanda referensi Payment hasil kompensasi pembayaran di muka (bukan kas). */
export const PREPAID_OFFSET_REF = "OFFSET-PREPAID";

export type PurchaseScope = { requestId?: number | null; supplierPoId?: number | null };

async function resolveScope(client: any, scope: PurchaseScope): Promise<{ requestId: number | null; poIds: number[] }> {
  let requestId = scope.requestId ?? null;
  if (!requestId && scope.supplierPoId) {
    const po = await client.supplierPO.findUnique({ where: { id: scope.supplierPoId }, select: { requestId: true } });
    requestId = po?.requestId ?? null;
  }
  const poIds = new Set<number>();
  if (scope.supplierPoId) poIds.add(scope.supplierPoId);
  if (requestId) {
    const pos = await client.supplierPO.findMany({ where: { requestId }, select: { id: true } });
    for (const p of pos) poIds.add(p.id);
  }
  return { requestId, poIds: [...poIds] };
}

export type DirectPrepayment = {
  /** Total kas yang sudah keluar lewat jalur A/B. */
  amount: number;
  /** Bagian PPN Masukan yang sudah diakui di jurnal pembayaran di muka. */
  vat: number;
  /** Total yang sudah dipakai untuk kompensasi invoice supplier. */
  offsetUsed: number;
  /** Sisa yang masih bisa dipakai untuk kompensasi. */
  available: number;
  /** Nomor jurnal sumber, untuk pesan. */
  journals: string[];
};

/** Pembayaran langsung (jalur A/B) yang masih POSTED untuk sebuah pembelian. */
export async function getDirectPrepayment(
  client: any,
  scope: PurchaseScope,
  map: Record<string, string> = {},
): Promise<DirectPrepayment> {
  const { requestId, poIds } = await resolveScope(client, scope);
  const or: any[] = [];
  if (requestId) or.push({ sourceType: "PurchaseRequest", sourceId: requestId });
  if (poIds.length) or.push({ sourceType: "SupplierPO", sourceId: { in: poIds } });
  if (!or.length) return { amount: 0, vat: 0, offsetUsed: 0, available: 0, journals: [] };

  // "ppn-fix" = jurnal koreksi PPN Masukan atas pembayaran lama (prisma/repair-purchase-ppn.ts): bukan kas, hanya PPN-nya.
  const all = await client.journalEntry.findMany({
    where: { status: "POSTED", event: { in: ["paid", "ppn-fix"] }, OR: or },
    include: { lines: true },
  });
  const entries = all.filter((e: any) => e.event === "paid");
  const vatCode = map.VAT_IN || "1600";
  let amount = 0;
  let vat = 0;
  for (const e of all) {
    for (const l of e.lines ?? []) {
      if (e.event === "paid") amount += Number(l.debit || 0);
      if (l.accountCode === vatCode) vat += Number(l.debit || 0);
    }
  }

  const offsetUsed = poIds.length
    ? (
        await client.payment.findMany({
          where: { invoiceIn: { supplierPoId: { in: poIds } }, reference: { startsWith: PREPAID_OFFSET_REF } },
          select: { amount: true },
        })
      ).reduce((s: number, p: any) => s + Number(p.amount), 0)
    : 0;

  amount = round(amount);
  return {
    amount,
    vat: round(vat),
    offsetUsed: round(offsetUsed),
    available: Math.max(0, round(amount - offsetUsed)),
    journals: entries.map((e: any) => e.number),
  };
}

/**
 * Tagihan supplier (Invoice In) aktif untuk pembelian ini. Bila ada, pembayaran HANYA boleh lewat tagihan itu
 * (bukan tombol bayar di Request Barang / status "Lunas" di PO), supaya satu pembelian punya satu tempat bayar.
 */
export async function findActiveSupplierInvoices(
  client: any,
  scope: PurchaseScope,
): Promise<Array<{ id: number; number: string | null; supplierPoId: number | null }>> {
  const { poIds } = await resolveScope(client, scope);
  if (!poIds.length) return [];
  return client.invoiceIn.findMany({
    where: { supplierPoId: { in: poIds }, status: { not: "BATAL" } },
    select: { id: true, number: true, supplierPoId: true },
  });
}

/** Sudah ada pembayaran KAS atas invoice supplier (jalur C) untuk pembelian ini? */
export async function hasSupplierInvoiceCashPayment(client: any, scope: PurchaseScope): Promise<boolean> {
  const { poIds } = await resolveScope(client, scope);
  if (!poIds.length) return false;
  const count = await client.payment.count({
    where: {
      invoiceIn: { supplierPoId: { in: poIds }, status: { not: "BATAL" } },
      NOT: { reference: { startsWith: PREPAID_OFFSET_REF } },
    },
  });
  return count > 0;
}
