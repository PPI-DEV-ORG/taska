import { evaluateFlow, type FlowResult, type FlowStepDef } from "@/lib/flow";
import type { Row } from "@/constants/modules";

/**
 * Alur penjualan (rantai dokumen):
 *  Penawaran -> Pesanan Penjualan -> [Surat Jalan] + [Faktur] -> Pembayaran
 * Dokumen mana pun yang sedang dibuka ditandai dalam rantai, dokumen terkait dicari dari data yang sudah dimuat.
 */

export type SalesModule = "quotations" | "po-client" | "delivery-notes" | "invoices";
export const SALES_MODULES: string[] = ["quotations", "po-client", "delivery-notes", "invoices"];

export const SALES_STEPS: FlowStepDef[] = [
  { key: "quote", label: "Penawaran", owner: "sales", hint: "Sales membuat penawaran, Finance/Bos menyetujui, lalu dikirim ke pelanggan." },
  { key: "so", label: "Pesanan Penjualan", owner: "sales", needs: ["quote"], hint: "Catat PO dari pelanggan sebagai Pesanan Penjualan (SO)." },
  { key: "ship", label: "Surat Jalan", owner: "gudang", needs: ["so"], hint: "Gudang mengirim barang dan pelanggan menerimanya." },
  { key: "invoice", label: "Faktur", owner: "finance", needs: ["so"], hint: "Finance menerbitkan faktur ke pelanggan." },
  { key: "pay", label: "Pembayaran", owner: "finance", needs: ["invoice"], hint: "Pelanggan membayar, Finance mencatat sampai lunas." },
];

const same = (a: unknown, b: unknown) => a != null && b != null && a !== "" && a !== "-" && String(a) === String(b);
const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

export function evaluateSales(moduleKey: string, row: Row, data: Record<string, Row[]>): FlowResult & { currentKey: string } {
  const quotations = data.quotations ?? [];
  const sos = data["po-client"] ?? [];
  const invoices = data.invoices ?? [];
  const notes = data["delivery-notes"] ?? [];

  let quote: Row | undefined;
  let linkedSos: Row[] = [];
  let linkedInvoices: Row[] = [];

  if (moduleKey === "quotations") {
    quote = row;
  } else if (moduleKey === "po-client") {
    quote = quotations.find((q) => same(q.id, row.quotationId) || (row.penawaran && norm(q.nomor) === norm(row.penawaran)));
  } else if (moduleKey === "invoices") {
    quote = quotations.find((q) => same(q.id, row.quotationId) || (row.penawaran && norm(q.nomor) === norm(row.penawaran)));
  }

  if (moduleKey === "po-client") linkedSos = [row];
  else if (moduleKey === "invoices") {
    linkedSos = sos.filter((s) => same(s.id, row.clientPoId) || (row.po && norm(s.nomorPoClient) === norm(row.po)));
  } else if (quote) {
    linkedSos = sos.filter((s) => same(s.quotationId, quote!.id) || (s.penawaran && norm(s.penawaran) === norm(quote!.nomor)));
  } else if (moduleKey === "delivery-notes" && row.project && row.project !== "-") {
    linkedSos = sos.filter((s) => norm(s.project) === norm(row.project));
  }

  if (moduleKey === "invoices") linkedInvoices = [row];
  else {
    linkedInvoices = invoices.filter(
      (i) =>
        linkedSos.some((s) => same(i.clientPoId, s.id)) ||
        (quote && (same(i.quotationId, quote.id) || (i.penawaran && norm(i.penawaran) === norm(quote.nomor)))),
    );
  }

  const project = moduleKey === "delivery-notes" ? row.project : linkedSos[0]?.project ?? row.project;
  const linkedNotes =
    moduleKey === "delivery-notes"
      ? [row]
      : project && project !== "-"
      ? notes.filter((n) => norm(n.project) === norm(project))
      : [];

  const qStatus = String(quote?.status ?? "");
  const done = new Set<string>();
  if (!quote || ["Disetujui", "Terkirim"].includes(qStatus) || linkedSos.length) done.add("quote");
  if (linkedSos.length) done.add("so");
  if (linkedNotes.length && linkedNotes.every((n) => n.status === "Diterima")) done.add("ship");
  if (linkedInvoices.length) done.add("invoice");
  if (linkedInvoices.length && linkedInvoices.every((i) => i.status === "Lunas")) done.add("pay");

  const stopped = ["Ditolak", "Kedaluwarsa"].includes(qStatus) && moduleKey === "quotations" ? { label: qStatus } : null;
  const flow = evaluateFlow(SALES_STEPS, done, stopped);
  const currentKey =
    moduleKey === "quotations" ? "quote" : moduleKey === "po-client" ? "so" : moduleKey === "delivery-notes" ? "ship" : "invoice";
  return { ...flow, currentKey };
}
