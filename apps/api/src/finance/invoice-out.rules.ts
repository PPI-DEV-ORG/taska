import { BadRequestException } from '@nestjs/common';
import { withheldTax } from '../accounting/posting.rules.js';
import { itemDiscountFields } from '../crm/item-discount.js';

export type InvoiceOutStatus =
  'DRAFT' | 'SENT' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'BATAL';

/**
 * Status dihitung HANYA dari uang yang benar-benar tercatat (paidAmount = jumlah baris Payment) + jatuh tempo.
 * Tiap invoice (DP / Termin / Pelunasan) adalah piutang tersendiri untuk porsinya masing-masing,
 * jadi invoice DP tidak otomatis "lunas" hanya karena invoice pelunasan sudah dibayar.
 */
export function computeInvoiceOutStatus(
  row: { status: string; total: unknown; paidAmount: unknown; dueDate: Date },
  now = Date.now(),
): InvoiceOutStatus {
  if (row.status === 'BATAL') return 'BATAL';
  const total = Number(row.total);
  const paid = Number(row.paidAmount);
  if (total > 0 && paid >= total) return 'PAID';
  if (total <= 0 && row.status === 'PAID') return 'PAID';
  if (row.status === 'DRAFT' && paid <= 0) return 'DRAFT';
  if (paid > 0) return 'PARTIAL';
  const past = new Date(row.dueDate).getTime() < now;
  if (past) return 'OVERDUE';
  return 'SENT';
}

/**
 * Mode PPN invoice. Dulu mode PPN TIDAK tersimpan saat invoice dibuat (field terbuang validasi), sehingga invoice
 * "include PPN" tampil sebagai exclude dan invoice pelunasan yang mewarisinya salah hitung. Urutan sumber:
 * tersimpan di invoice → mode SO → mode invoice induk (DP) → penawaran (grand total = total − diskon berarti harga
 * sudah termasuk PPN) → ada PPN = exclude.
 */
export function resolveInvoicePpnMode(
  stored: string | null | undefined,
  ppn: number,
  ctx: {
    soPpnMode?: string | null;
    parentPpnMode?: string | null;
    quote?: {
      total?: unknown;
      discount?: unknown;
      ppn?: unknown;
      grandTotal?: unknown;
    } | null;
  },
): { ppnMode: 'exclude' | 'include' | 'none'; tipePpn: string } {
  type Mode = 'exclude' | 'include' | 'none';
  const norm = (m?: string | null): Mode | null =>
    m === 'include' || m === 'exclude' || m === 'none' ? m : null;
  let mode: Mode | null =
    norm(stored) ?? norm(ctx.soPpnMode) ?? norm(ctx.parentPpnMode);
  if (!mode && ctx.quote && Number(ctx.quote.ppn || 0) > 0) {
    const net = Number(ctx.quote.total || 0) - Number(ctx.quote.discount || 0);
    if (net > 0 && Math.abs(Number(ctx.quote.grandTotal || 0) - net) < 2)
      mode = 'include';
  }
  if (!mode) mode = ppn > 0 ? 'exclude' : 'none';
  const tipePpn =
    mode === 'include'
      ? 'Include PPN (Sudah termasuk)'
      : mode === 'exclude'
        ? 'Exclude PPN (11%)'
        : 'No PPN (Tanpa PPN)';
  return { ppnMode: mode, tipePpn };
}

export function normalizeInvoiceItems(rawItems: any[]): any[] {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .filter((it) => String(it?.item ?? '').trim().length > 0)
    .map((it, idx) => {
      const serialNumbers = Array.isArray(it.serialNumbers)
        ? it.serialNumbers
            .map((s: any) => String(s ?? '').trim())
            .filter(Boolean)
        : [];
      const serialUnitIds = Array.isArray(it.serialUnitIds)
        ? it.serialUnitIds
            .map((n: any) => Number(n))
            .filter((n: number) => Number.isFinite(n) && n > 0)
        : [];
      const hasSn = Boolean(
        it.hasSerial || serialNumbers.length > 0 || serialUnitIds.length > 0,
      );
      const kind: 'GOODS' | 'SERVICE' =
        it.kind === 'SERVICE'
          ? 'SERVICE'
          : it.kind === 'GOODS' || it.productId || it.sku || hasSn
            ? 'GOODS'
            : 'SERVICE';
      return {
        id: String(it.id ?? idx + 1),
        item: String(it.item ?? '').trim(),
        qty:
          Number(it.qty) ||
          (serialNumbers.length > 0 ? serialNumbers.length : 1),
        satuan: String(it.satuan || it.unit || 'Unit').trim(),
        harga: Number(it.harga ?? it.price ?? 0) || 0,
        kind,
        ...(it.productId ? { productId: Number(it.productId) } : {}),
        ...(it.sku ? { sku: String(it.sku) } : {}),
        ...(hasSn ? { hasSerial: true } : {}),
        ...(serialUnitIds.length > 0 ? { serialUnitIds } : {}),
        ...(serialNumbers.length > 0 ? { serialNumbers } : {}),
        ...(it.outOfStockAutoSwap ? { outOfStockAutoSwap: true } : {}),
        ...(it.pphMode ? { pphMode: String(it.pphMode) } : {}),
        ...(it.tipePph ? { tipePph: String(it.tipePph) } : {}),
        ...itemDiscountFields(it),
      };
    });
}

/** Judul dokumen: proforma selalu berjudul PROFORMA INVOICE agar tidak tertukar dengan tagihan resmi. */
export function exportInvoiceSubject(
  row: { isProforma?: boolean },
  subject?: string | null,
): string {
  if (!row.isProforma) return subject || 'INVOICE PENAGIHAN';
  return subject && /proforma/i.test(subject)
    ? subject
    : `PROFORMA INVOICE${subject ? ` - ${subject}` : ''}`;
}

/** Baris "POTONGAN PPh" di PDF/Excel hanya untuk invoice yang PPh-nya dipotong saat invoice terbit. */
export function exportInvoicePphFields(row: {
  amount: unknown;
  ppn: unknown;
  total: unknown;
  pph?: unknown;
  tipePph?: string | null;
}) {
  const pph = withheldTax({
    dpp: Number(row.amount || 0),
    ppn: Number(row.ppn || 0),
    total: Number(row.total || 0),
    pph: Number(row.pph || 0),
  });
  return pph > 0 ? { pph, tipePph: row.tipePph || 'PPh' } : {};
}

/**
 * Aturan ubah status manual. PAID/PARTIAL/OVERDUE adalah status turunan dari pembayaran,
 * jadi tidak bisa "dipaksa" tanpa uang yang tercatat.
 */
export function assertManualInvoiceStatus(
  status: string,
  s: { paid: number; total: number },
) {
  const sisa = Math.max(0, s.total - s.paid);
  if (status === 'PAID' && s.total > 0 && sisa > 0) {
    throw new BadRequestException(
      `Masih ada sisa tagihan Rp${sisa.toLocaleString('id-ID')}. Catat pembayaran lewat menu Pembayaran agar kas & piutang tercatat.`,
    );
  }
  if (['DRAFT', 'SENT', 'BATAL'].includes(status) && s.paid > 0) {
    throw new BadRequestException(
      `Invoice sudah menerima pembayaran Rp${s.paid.toLocaleString('id-ID')}. Void pembayarannya terlebih dahulu sebelum mengubah ke ${status}.`,
    );
  }
}

/** Status turunan setelah paidAmount berubah. */
export function statusAfterInvoicePayment(
  row: { status: string; total: unknown; paidAmount: unknown; dueDate: Date },
  now = Date.now(),
): InvoiceOutStatus {
  const total = Number(row.total);
  const paid = Number(row.paidAmount);
  if (total > 0 && paid >= total) return 'PAID';
  if (paid > 0) return 'PARTIAL';
  return new Date(row.dueDate).getTime() < now ? 'OVERDUE' : 'SENT';
}

/** Klasifikasi item invoice untuk pemisahan pendapatan barang vs jasa. */
export function invoiceRevenueItems(rawItems: any[]) {
  return rawItems.map((it: any) => {
    const name = String(it.name || it.item || it.productName || '').trim();
    const unit = String(it.unit || it.satuan || '')
      .trim()
      .toLowerCase();
    const isService =
      it.kind === 'SERVICE' ||
      it.type === 'SERVICE' ||
      it.itemType === 'JASA' ||
      it.tipe === 'JASA' ||
      /jasa|instalasi|service|pasang|delivery|ongkir|ongkos\s*kirim|pengiriman|setting|konfigurasi|maintenance/i.test(
        name,
      ) ||
      (['paket', 'ls', 'lot', 'titik', 'jam', 'hari', 'jasa'].includes(unit) &&
        !it.productId &&
        !it.hasSerial);
    const gross =
      (Number(it.harga ?? it.price ?? 0) || 0) * (Number(it.qty) || 1);
    const pct = Number(it.diskonPct) || 0;
    const lineDisc =
      pct > 0
        ? Math.round((gross * Math.min(100, pct)) / 100)
        : Math.max(0, Number(it.diskon) || 0);
    const net = Math.max(0, gross - Math.min(gross, lineDisc));
    return {
      type: isService ? 'SERVICE' : 'PRODUCT',
      amount: net || Number(it.subtotal || it.amount || 0),
    };
  });
}
