import { Prisma } from "../generated/prisma/client.js";
import { DEFAULT_QUOTATION_NOTES, type QuotationMeta } from "./quotation-excel.js";

/**
 * Metadata penawaran (item, template, konflik stok, ...) sekarang kolom pada tabel Quotation.
 * Dulu JSON di SystemSetting "quotation.meta.<id>" yang dibaca lewat key mentah di banyak servis.
 * Servis lain cukup memanggil quotationMetaFromRow(<baris Quotation>).
 */

const str = (v: unknown) => (v == null || v === "" ? undefined : (v as string));

/** Baris Quotation -> bentuk metadata yang dipakai pembuat dokumen & servis lain. */
export function quotationMetaFromRow(r: any): QuotationMeta {
  const notes = Array.isArray(r?.notes) && r.notes.length > 0 ? (r.notes as string[]) : DEFAULT_QUOTATION_NOTES;
  return {
    items: Array.isArray(r?.items) ? r.items : [],
    subject: str(r?.subject),
    intro: str(r?.intro),
    notes,
    city: str(r?.city),
    kopText: str(r?.kopText),
    customerAddress: str(r?.customerAddress),
    signerName: str(r?.signerName),
    signerTitle: str(r?.signerTitle),
    pph: r?.pph == null ? undefined : Number(r.pph),
    pphMode: str(r?.pphMode),
    tipePph: str(r?.tipePph),
    latestFileId: r?.latestFileId ?? null,
    latestFileName: r?.latestFileName ?? null,
    stockConflictFlag: Boolean(r?.stockConflictFlag),
    stockConflictMessage: r?.stockConflictMessage ?? null,
    autoSwapLogs: Array.isArray(r?.autoSwapLogs) ? r.autoSwapLogs : [],
    emergencyPrId: r?.emergencyPrId ?? null,
    emergencyPrNumber: r?.emergencyPrNumber ?? null,
  };
}

/** Patch metadata -> kolom Quotation (hanya kunci yang dikirim). */
export function quotationMetaToData(patch: Partial<QuotationMeta>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const has = (k: keyof QuotationMeta) => patch[k] !== undefined;
  const strOrNull = (v: unknown) => (v == null || v === "" ? null : String(v));
  const intOrNull = (v: unknown) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Math.trunc(Number(v)));

  for (const k of [
    "subject", "intro", "city", "kopText", "customerAddress", "signerName", "signerTitle",
    "pphMode", "tipePph", "latestFileName", "stockConflictMessage", "emergencyPrNumber",
  ] as const) {
    if (has(k)) data[k] = strOrNull(patch[k]);
  }
  if (has("pph")) data.pph = patch.pph == null || Number.isNaN(Number(patch.pph)) ? null : Number(patch.pph);
  if (has("latestFileId")) data.latestFileId = intOrNull(patch.latestFileId);
  if (has("emergencyPrId")) data.emergencyPrId = intOrNull(patch.emergencyPrId);
  if (has("stockConflictFlag")) data.stockConflictFlag = Boolean(patch.stockConflictFlag);
  if (has("items")) data.items = patch.items == null ? Prisma.DbNull : (patch.items as unknown as Prisma.InputJsonValue);
  if (has("autoSwapLogs")) {
    data.autoSwapLogs = patch.autoSwapLogs == null ? Prisma.DbNull : (patch.autoSwapLogs as unknown as Prisma.InputJsonValue);
  }
  // Catatan: kosong / sama dengan bawaan = null (bawaan dipakai saat dibaca); array kosong diabaikan.
  if (patch.notes !== undefined && Array.isArray(patch.notes) && patch.notes.length > 0) {
    const isDefault =
      patch.notes.length === DEFAULT_QUOTATION_NOTES.length &&
      patch.notes.every((n, i) => n === DEFAULT_QUOTATION_NOTES[i]);
    data.notes = isDefault ? Prisma.DbNull : (patch.notes as Prisma.InputJsonValue);
  }
  return data;
}
