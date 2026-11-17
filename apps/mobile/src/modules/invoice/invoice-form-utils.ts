import type { Row } from "@/constants/modules";
import {
  getInitialPpnMode,
  sumItemDiscounts,
  sumItemGross,
} from "@/modules/quotation/lib";

export function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getDefaultDueDateIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export function generateInvoiceNumber(
  isLanjut: boolean,
  currentScheme: "sekaligus" | "dp" | "termin",
  existingInvoices: Row[],
  totalInvoiceCount: number,
  allInvoices?: Row[],
): string {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");

  let maxSeq = 0;
  const prefix = `INV/${year}/${month}/`;
  for (const inv of allInvoices || []) {
    const num = String(inv.nomor || inv.number || "");
    if (num.startsWith(prefix)) {
      const parts = num.slice(prefix.length).split("/");
      const seq = parseInt(parts[0] ?? "", 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }
  const count = Math.max(maxSeq + 1, totalInvoiceCount + 1);
  const baseSeq = String(count).padStart(3, "0");

  if (isLanjut) {
    const nextTermNum = existingInvoices.length + 1;
    const lastInv = existingInvoices[existingInvoices.length - 1];
    if (lastInv?.nomor && lastInv.nomor.includes("/")) {
      const parts = lastInv.nomor.split("/");
      if (!isNaN(Number(parts[parts.length - 1]))) {
        parts[parts.length - 1] = String(nextTermNum);
        return parts.join("/");
      }
    }
    return `INV/${year}/${month}/${baseSeq}/${nextTermNum}`;
  }

  if (currentScheme === "dp" || currentScheme === "termin") {
    return `INV/${year}/${month}/${baseSeq}/1`;
  }
  return `INV/${year}/${month}/${baseSeq}`;
}

export function generateInvoiceInNumber(
  scheme: "sekaligus" | "dp" | "termin",
  existingInvoices: Row[],
  totalInvoiceInCount: number,
  allInvoiceIn?: Row[],
  continuationType?: "termin" | "pelunasan",
): string {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");
  const prefix = `INV-IN/${year}/${month}/`;

  let maxSeq = 0;
  for (const inv of allInvoiceIn || []) {
    const num = String(inv.nomor || inv.number || "");
    if (num.startsWith(prefix)) {
      const parts = num.slice(prefix.length).split(/[/_-]/);
      const seq = parseInt(parts[0] ?? "", 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }
  const count = Math.max(maxSeq + 1, totalInvoiceInCount + 1);
  const baseSeq = String(count).padStart(3, "0");

  if (existingInvoices.length > 0) {
    const nextTermNum = existingInvoices.length + 1;
    const lastInv = existingInvoices[existingInvoices.length - 1];
    const lastNum = String(lastInv?.nomor || lastInv?.number || "");
    const matchPrefix = lastNum.match(/^(INV-IN\/\d{4}\/\d{2}\/\d+)/i)?.[1];
    const base = matchPrefix || `INV-IN/${year}/${month}/${baseSeq}`;
    if (continuationType === "pelunasan") {
      return `${base}/PELUNASAN`;
    }
    return `${base}/${nextTermNum}`;
  }

  if (scheme === "dp") {
    return `INV-IN/${year}/${month}/${baseSeq}/DP`;
  }
  if (scheme === "termin") {
    return `INV-IN/${year}/${month}/${baseSeq}/1`;
  }
  return `INV-IN/${year}/${month}/${baseSeq}`;
}

export type InvoiceSourceType =
  "direct_sale" | "direct_purchase" | "po" | "quotation" | "lead" | "customer";

/**
 * Diskon yang masih "tersisa" di Sales Order: selisih total harga item SO dengan nilai SO sebelum pajak.
 * SO baru menyimpan harga item yang sudah net -> 0. SO lama yang menyimpan harga kotor -> nilai diskonnya.
 */
export function soImpliedDiscount(po: Row | null | undefined): number {
  if (!po) return 0;
  const explicitDisc = Number(po.discount || po.disc || 0);
  if (!Array.isArray(po.items) || po.items.length === 0) return explicitDisc;
  const gross = sumItemGross(po.items);
  const itemDisc = sumItemDiscounts(po.items);
  const base =
    getInitialPpnMode(po) === "include"
      ? Number(po.total || po.nilai || 0)
      : Number(po.nilai || 0);
  const diff = base > 0 && gross - base > 2 ? Math.round(gross - base) : 0;
  return Math.max(explicitDisc, itemDisc, diff);
}
