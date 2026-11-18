import { describe, expect, it } from 'vitest';
import {
  assertManualInvoiceStatus,
  computeInvoiceOutStatus,
  exportInvoicePphFields,
  exportInvoiceSubject,
  invoiceRevenueItems,
  normalizeInvoiceItems,
  resolveInvoicePpnMode,
  statusAfterInvoicePayment,
} from './invoice-out.rules.js';

const past = new Date(Date.now() - 86_400_000);
const future = new Date(Date.now() + 86_400_000);

describe('computeInvoiceOutStatus', () => {
  it('BATAL selalu menang', () => {
    expect(
      computeInvoiceOutStatus({
        status: 'BATAL',
        total: 1000,
        paidAmount: 1000,
        dueDate: past,
      }),
    ).toBe('BATAL');
  });

  it('lunas hanya dari uang yang tercatat', () => {
    expect(
      computeInvoiceOutStatus({
        status: 'SENT',
        total: 1000,
        paidAmount: 1000,
        dueDate: past,
      }),
    ).toBe('PAID');
  });

  it('invoice lama berstatus PAID dengan total 0 tetap PAID', () => {
    expect(
      computeInvoiceOutStatus({
        status: 'PAID',
        total: 0,
        paidAmount: 0,
        dueDate: past,
      }),
    ).toBe('PAID');
  });

  it('DRAFT tanpa pembayaran tetap DRAFT', () => {
    expect(
      computeInvoiceOutStatus({
        status: 'DRAFT',
        total: 1000,
        paidAmount: 0,
        dueDate: future,
      }),
    ).toBe('DRAFT');
  });

  it('pembayaran sebagian menjadi PARTIAL', () => {
    expect(
      computeInvoiceOutStatus({
        status: 'SENT',
        total: 1000,
        paidAmount: 400,
        dueDate: past,
      }),
    ).toBe('PARTIAL');
  });

  it('belum dibayar dan lewat jatuh tempo menjadi OVERDUE', () => {
    expect(
      computeInvoiceOutStatus({
        status: 'SENT',
        total: 1000,
        paidAmount: 0,
        dueDate: past,
      }),
    ).toBe('OVERDUE');
  });

  it('belum dibayar dan belum jatuh tempo menjadi SENT', () => {
    expect(
      computeInvoiceOutStatus({
        status: 'SENT',
        total: 1000,
        paidAmount: 0,
        dueDate: future,
      }),
    ).toBe('SENT');
  });
});

describe('statusAfterInvoicePayment', () => {
  it('menentukan PAID, PARTIAL, OVERDUE, dan SENT', () => {
    expect(
      statusAfterInvoicePayment({
        status: 'SENT',
        total: 1000,
        paidAmount: 1000,
        dueDate: past,
      }),
    ).toBe('PAID');
    expect(
      statusAfterInvoicePayment({
        status: 'SENT',
        total: 1000,
        paidAmount: 100,
        dueDate: past,
      }),
    ).toBe('PARTIAL');
    expect(
      statusAfterInvoicePayment({
        status: 'SENT',
        total: 1000,
        paidAmount: 0,
        dueDate: past,
      }),
    ).toBe('OVERDUE');
    expect(
      statusAfterInvoicePayment({
        status: 'SENT',
        total: 1000,
        paidAmount: 0,
        dueDate: future,
      }),
    ).toBe('SENT');
  });
});

describe('resolveInvoicePpnMode', () => {
  it('memakai mode yang tersimpan di invoice', () => {
    expect(resolveInvoicePpnMode('include', 110, {})).toEqual({
      ppnMode: 'include',
      tipePpn: 'Include PPN (Sudah termasuk)',
    });
  });

  it('jatuh ke mode SO lalu mode invoice induk', () => {
    expect(resolveInvoicePpnMode(null, 110, { soPpnMode: 'exclude' })).toEqual({
      ppnMode: 'exclude',
      tipePpn: 'Exclude PPN (11%)',
    });
    expect(
      resolveInvoicePpnMode(undefined, 110, { parentPpnMode: 'include' }),
    ).toEqual({
      ppnMode: 'include',
      tipePpn: 'Include PPN (Sudah termasuk)',
    });
  });

  it('menyimpulkan include dari grand total penawaran', () => {
    expect(
      resolveInvoicePpnMode(null, 110, {
        quote: { total: 1000, discount: 0, ppn: 110, grandTotal: 1000 },
      }),
    ).toEqual({
      ppnMode: 'include',
      tipePpn: 'Include PPN (Sudah termasuk)',
    });
  });

  it('penawaran tidak cocok -> pakai PPN untuk menentukan exclude', () => {
    expect(
      resolveInvoicePpnMode(null, 110, {
        quote: { total: 1000, discount: 0, ppn: 110, grandTotal: 1110 },
      }),
    ).toEqual({ ppnMode: 'exclude', tipePpn: 'Exclude PPN (11%)' });
  });

  it('tanpa PPN menjadi none', () => {
    expect(resolveInvoicePpnMode(null, 0, {})).toEqual({
      ppnMode: 'none',
      tipePpn: 'No PPN (Tanpa PPN)',
    });
  });
});

describe('normalizeInvoiceItems', () => {
  it('mengembalikan array kosong untuk input bukan array', () => {
    expect(normalizeInvoiceItems(null as any)).toEqual([]);
    expect(normalizeInvoiceItems(undefined as any)).toEqual([]);
  });

  it('menyaring item tanpa nama dan mengisi default', () => {
    const out = normalizeInvoiceItems([
      { item: '  ' },
      { item: 'Jasa pasang', harga: 500_000 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: '1',
      item: 'Jasa pasang',
      qty: 1,
      satuan: 'Unit',
      harga: 500_000,
      kind: 'SERVICE',
    });
  });

  it('barang dengan productId/sku/hasSerial diklasifikasikan GOODS', () => {
    const [product, sku, serial] = normalizeInvoiceItems([
      { item: 'Barang A', productId: 7, harga: 1000 },
      { item: 'Barang B', sku: 'SKU-1', harga: 1000 },
      { item: 'Barang C', hasSerial: true, harga: 1000 },
    ]);
    expect(product).toMatchObject({ kind: 'GOODS', productId: 7 });
    expect(sku).toMatchObject({ kind: 'GOODS', sku: 'SKU-1' });
    expect(serial).toMatchObject({ kind: 'GOODS', hasSerial: true });
  });

  it('membersihkan SN dan memakai jumlah SN sebagai qty', () => {
    const [row] = normalizeInvoiceItems([
      {
        item: 'Barang SN',
        harga: 1000,
        serialNumbers: [' SN-1 ', '', 'SN-2'],
        serialUnitIds: [3, '4', 0, null],
      },
    ]);
    expect(row).toMatchObject({
      qty: 2,
      hasSerial: true,
      serialNumbers: ['SN-1', 'SN-2'],
      serialUnitIds: [3, 4],
    });
  });

  it('mempertahankan field diskon, PPh, dan auto swap', () => {
    const [row] = normalizeInvoiceItems([
      {
        item: 'Barang',
        harga: 1000,
        qty: 2,
        diskonPct: 10,
        pphMode: '23',
        tipePph: 'PPh 23',
        outOfStockAutoSwap: true,
      },
    ]);
    expect(row).toMatchObject({
      diskonPct: 10,
      diskon: 200,
      pphMode: '23',
      tipePph: 'PPh 23',
      outOfStockAutoSwap: true,
    });
  });
});

describe('exportInvoiceSubject', () => {
  it('memakai subject apa adanya untuk invoice biasa', () => {
    expect(exportInvoiceSubject({}, 'Tagihan Proyek')).toBe('Tagihan Proyek');
    expect(exportInvoiceSubject({})).toBe('INVOICE PENAGIHAN');
  });

  it('proforma selalu memakai judul PROFORMA INVOICE', () => {
    expect(exportInvoiceSubject({ isProforma: true })).toBe('PROFORMA INVOICE');
    expect(exportInvoiceSubject({ isProforma: true }, 'Proforma DP')).toBe(
      'Proforma DP',
    );
    expect(exportInvoiceSubject({ isProforma: true }, 'Tagihan DP')).toBe(
      'PROFORMA INVOICE - Tagihan DP',
    );
  });
});

describe('exportInvoicePphFields', () => {
  it('mengembalikan PPh bila total cocok dengan DPP + PPN - PPh', () => {
    expect(
      exportInvoicePphFields({
        amount: 1000,
        ppn: 110,
        total: 1000,
        pph: 110,
        tipePph: 'PPh 23',
      }),
    ).toEqual({ pph: 110, tipePph: 'PPh 23' });
  });

  it('mengembalikan objek kosong bila PPh nol atau total tidak cocok', () => {
    expect(
      exportInvoicePphFields({ amount: 1000, ppn: 110, total: 1110, pph: 0 }),
    ).toEqual({});
    expect(
      exportInvoicePphFields({ amount: 1000, ppn: 110, total: 1200, pph: 110 }),
    ).toEqual({});
  });
});

describe('assertManualInvoiceStatus', () => {
  it('menolak PAID bila masih ada sisa tagihan', () => {
    expect(() =>
      assertManualInvoiceStatus('PAID', { paid: 400, total: 1000 }),
    ).toThrow(/Masih ada sisa tagihan/);
  });

  it('menolak status tanpa uang bila sudah ada pembayaran', () => {
    for (const status of ['DRAFT', 'SENT', 'BATAL']) {
      expect(() =>
        assertManualInvoiceStatus(status, { paid: 1, total: 1000 }),
      ).toThrow(/sudah menerima pembayaran/);
    }
  });

  it('mengizinkan PAID yang benar-benar lunas dan status lain tanpa pembayaran', () => {
    expect(() =>
      assertManualInvoiceStatus('PAID', { paid: 1000, total: 1000 }),
    ).not.toThrow();
    expect(() =>
      assertManualInvoiceStatus('SENT', { paid: 0, total: 1000 }),
    ).not.toThrow();
    expect(() =>
      assertManualInvoiceStatus('PAID', { paid: 0, total: 0 }),
    ).not.toThrow();
  });
});

describe('invoiceRevenueItems', () => {
  it('memisahkan pendapatan jasa dan barang', () => {
    expect(
      invoiceRevenueItems([
        { item: 'Jasa instalasi', harga: 500_000, qty: 2 },
        { item: 'Barang', harga: 100_000, qty: 3 },
      ]),
    ).toEqual([
      { type: 'SERVICE', amount: 1_000_000 },
      { type: 'PRODUCT', amount: 300_000 },
    ]);
  });

  it('mengenali jasa dari kind, tipe, dan satuan', () => {
    expect(
      invoiceRevenueItems([
        { item: 'X', kind: 'SERVICE', harga: 1000 },
        { item: 'Y', tipe: 'JASA', harga: 1000 },
        { item: 'Z', satuan: 'paket', harga: 1000 },
      ]),
    ).toEqual([
      { type: 'SERVICE', amount: 1000 },
      { type: 'SERVICE', amount: 1000 },
      { type: 'SERVICE', amount: 1000 },
    ]);
  });

  it('menghitung diskon persen dan nominal', () => {
    expect(
      invoiceRevenueItems([
        { item: 'Barang', harga: 1000, qty: 2, diskonPct: 10 },
        { item: 'Barang', harga: 1000, qty: 2, diskon: 300 },
      ]),
    ).toEqual([
      { type: 'PRODUCT', amount: 1800 },
      { type: 'PRODUCT', amount: 1700 },
    ]);
  });

  it('memakai subtotal/amount bila hasil net nol', () => {
    expect(
      invoiceRevenueItems([
        { item: 'Barang', harga: 0, qty: 1, subtotal: 750 },
        { item: 'Barang', harga: 0, qty: 1, amount: 800 },
      ]),
    ).toEqual([
      { type: 'PRODUCT', amount: 750 },
      { type: 'PRODUCT', amount: 800 },
    ]);
  });
});
