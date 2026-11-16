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
  { key: "quote", label: "Penawaran", owner: "sales", hint: "Sales membuat penawaran harga ke pelanggan." },
  { key: "so", label: "Pesanan Penjualan", owner: "sales", needs: ["quote"], hint: "PO dari pelanggan dicatat sebagai Sales Order (SO)." },
  { key: "ship", label: "Surat Jalan", owner: "gudang", needs: ["so"], hint: "Gudang mengirim barang dan pelanggan menerima barang (DO)." },
  { key: "invoice", label: "Faktur", owner: "finance", needs: ["so"], hint: "Finance menerbitkan faktur penagihan ke pelanggan." },
  { key: "pay", label: "Pembayaran", owner: "finance", needs: ["invoice"], hint: "Pelanggan melunasi tagihan faktur." },
];

const same = (a: unknown, b: unknown) => a != null && b != null && a !== "" && a !== "-" && String(a) === String(b);

export function evaluateSales(
  moduleKey: string,
  row: Row,
  data: Record<string, Row[]>,
): FlowResult & {
  doneKeys: string[];
  currentKey: string;
  quote?: Row;
  linkedSos: Row[];
  linkedInvoices: Row[];
  linkedNotes: Row[];
} {
  const quotations = data.quotations ?? [];
  const sos = data["po-client"] ?? [];
  const invoices = data.invoices ?? [];
  const notes = data["delivery-notes"] ?? [];

  let quote: Row | undefined;
  let linkedSos: Row[] = [];
  let linkedInvoices: Row[] = [];

  // Semua kaitan dokumen lewat ID relasi (quotationId, clientPoId, invoiceId) — tidak lagi menebak dari
  // nomor dokumen, isi teks alasan, atau nama proyek yang sama (dulu bisa menyambungkan dokumen yang tidak berhubungan).
  if (moduleKey === "quotations") {
    quote = row;
  } else if (moduleKey === "po-client" || moduleKey === "invoices") {
    quote = quotations.find((q) => same(q.id, row.quotationId));
  }

  if (moduleKey === "po-client") {
    linkedSos = [row];
  } else if (moduleKey === "invoices") {
    linkedSos = sos.filter((s) => same(s.id, row.clientPoId));
  } else if (quote) {
    linkedSos = sos.filter((s) => same(s.quotationId, quote!.id));
  } else if (moduleKey === "delivery-notes") {
    linkedSos = sos.filter((s) => same(s.id, row.clientPoId));
  }

  if (moduleKey === "invoices") {
    linkedInvoices = [row];
  } else {
    linkedInvoices = invoices.filter(
      (i) =>
        linkedSos.some((s) => same(i.clientPoId, s.id)) ||
        (quote != null && same(i.quotationId, quote.id)) ||
        (moduleKey === "delivery-notes" && same(i.id, row.invoiceId)),
    );
  }

  const linkedNotes = notes.filter((n) => {
    if (moduleKey === "delivery-notes" && same(n.id, row.id)) return true;
    if (linkedInvoices.some((i) => same(n.invoiceId, i.id))) return true;
    return linkedSos.some((s) => same(n.clientPoId, s.id));
  });

  const qStatus = String(quote?.status ?? "");
  const done = new Set<string>();

  // 1. Penawaran selesai jika penawaran sudah disetujui / terkirim atau sudah ada SO
  if (!quote || ["Disetujui", "Terkirim"].includes(qStatus) || linkedSos.length) done.add("quote");

  // 2. Sales Order selesai jika SO sudah dibuat
  if (linkedSos.length) done.add("so");

  // 3. Surat Jalan / Pengiriman selesai jika:
  // - Ada surat jalan yang berstatus Dikirim atau Diterima
  // - Atau SO menandai barang sudah dikirim (goodsDispatched: true)
  // - Atau SO berstatus Lunas / Selesai / Dikirim
  // - Atau invoice menandai barang sudah dikirim (goodsDispatched: true)
  const hasShipped =
    linkedNotes.some((n) => ["Dikirim", "Diterima", "DIKIRIM", "DITERIMA"].includes(String(n.status))) ||
    linkedSos.some(
      (s) =>
        Boolean(s.goodsDispatched) ||
        ["lunas", "selesai", "dikirim"].includes(String(s.status || "").toLowerCase()) ||
        String(s.paymentStatus || "").toLowerCase() === "lunas",
    ) ||
    Boolean(row.goodsDispatched);

  if (hasShipped) done.add("ship");

  // 4. Faktur selesai jika invoice sudah diterbitkan
  if (linkedInvoices.length) done.add("invoice");

  // 5. Pembayaran selesai jika invoice sudah lunas atau SO sudah lunas
  const isPaid =
    linkedInvoices.some(
      (i) =>
        ["Lunas", "PAID", "Dibayar"].includes(String(i.status)) ||
        (i.sisa !== undefined && Number(i.sisa) <= 0),
    ) ||
    linkedSos.some(
      (s) =>
        String(s.status || "").toLowerCase() === "lunas" ||
        String(s.paymentStatus || "").toLowerCase() === "lunas",
    );

  if (isPaid) done.add("pay");

  const stopped =
    ["Ditolak", "Kedaluwarsa"].includes(qStatus) && moduleKey === "quotations" ? { label: qStatus } : null;
  const flow = evaluateFlow(SALES_STEPS, done, stopped);
  const currentKey =
    moduleKey === "quotations"
      ? "quote"
      : moduleKey === "po-client"
      ? "so"
      : moduleKey === "delivery-notes"
      ? "ship"
      : "invoice";

  return {
    ...flow,
    doneKeys: Array.from(done),
    currentKey,
    quote,
    linkedSos,
    linkedInvoices,
    linkedNotes,
  };
}
