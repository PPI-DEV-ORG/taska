import type { Row } from "@/constants/modules";
import { d, idOf, n, nameOf } from "../row-helpers";
import { toLabel } from "../status-maps";

export function mapDeliveryNotes(raw: any, base: Row): Row {
  const loc = raw.locations?.[0];
  let penerimaNama = raw.recipientName || raw.penerimaNama || "";
  let penerimaJabatan = raw.recipientTitle || raw.penerimaJabatan || "";
  let penerimaKontak = raw.recipientPhone || raw.penerimaKontak || "";
  let catatanSerahTerima = raw.catatanSerahTerima || "";
  if (raw.reportText) {
    try {
      const parsed = JSON.parse(raw.reportText);
      if (parsed && typeof parsed === "object") {
        if (parsed.penerimaNama && !raw.recipientName)
          penerimaNama = parsed.penerimaNama;
        if (parsed.penerimaJabatan && !raw.recipientTitle)
          penerimaJabatan = parsed.penerimaJabatan;
        if (parsed.penerimaKontak && !raw.recipientPhone)
          penerimaKontak = parsed.penerimaKontak;
        if (parsed.catatanSerahTerima)
          catatanSerahTerima = parsed.catatanSerahTerima;
      }
    } catch {
      const matchNama = raw.reportText.match(/Penerima:\s*([^(\n-]+)/i);
      const matchJabatan = raw.reportText.match(/\(([^)]+)\)/);
      const matchKontak = raw.reportText.match(
        /\[(?:Telp|Kontak):\s*([^\]]+)\]/i,
      );
      const matchCatatan = raw.reportText.match(/-\s*(.+)$/);
      if (matchNama && !raw.recipientName) penerimaNama = matchNama[1].trim();
      if (matchJabatan && !raw.recipientTitle)
        penerimaJabatan = matchJabatan[1].trim();
      if (matchKontak && !raw.recipientPhone)
        penerimaKontak = matchKontak[1].trim();
      if (matchCatatan) catatanSerahTerima = matchCatatan[1].trim();
      else if (!matchNama && !matchJabatan) catatanSerahTerima = raw.reportText;
    }
  }
  // Kaitan SO / invoice dari kolom relasi surat jalan (dulu tag "[so:id]" / "[inv:id]" di alasan).
  const resolvedSoId =
    raw.clientPoId != null ? String(raw.clientPoId) : undefined;
  const resolvedSoNum =
    raw.clientPo?.soNumber || raw.clientPo?.number || undefined;
  const resolvedInvoiceId =
    raw.invoiceId != null ? String(raw.invoiceId) : undefined;
  const resolvedInvoiceNum = raw.invoice?.number || undefined;

  return {
    ...base,
    nomor: raw.number ?? "",
    tanggal: d(raw.date),
    dueDate: d(raw.dueDate),
    rawDueDate: raw.dueDate,
    jatuhTempo: d(raw.dueDate),
    tujuan: loc?.destination ?? "-",
    alasan: loc?.reason ?? "-",
    project: nameOf(loc?.project) ?? "-",
    projectId: idOf(loc?.project),
    soId: resolvedSoId,
    clientPoId: resolvedSoId,
    soNumber: resolvedSoNum,
    invoiceId: resolvedInvoiceId,
    invoiceNumber: resolvedInvoiceNum,
    pembuat: nameOf(raw.creator) ?? "",
    barang:
      (raw.items ?? [])
        .map((i: any) => `${nameOf(i.product)} x ${n(i.qty)}`)
        .join(", ") ||
      (raw.withGoods ? raw.reportText || "Membawa barang" : "-"),
    status: toLabel("delivery-notes", raw.status),
    persetujuan:
      raw.status === "PENDING" ? "Menunggu persetujuan" : "Disetujui",
    withGoods: !!raw.withGoods,
    reportText: raw.reportText ?? "",
    items: raw.items ?? [],
    _items: raw.items ?? [],
    _locations: raw.locations ?? [],
    fileId: raw.scanFileId ?? raw.signedFileId ?? null,
    scanFileId: raw.scanFileId ?? raw.signedFileId ?? null,
    signedFileId: raw.scanFileId ?? raw.signedFileId ?? null,
    reportFileId: raw.reportFileId ?? null,
    scanFile: raw.scanFile ?? null,
    reportFile: raw.reportFile ?? null,
    scanFileMimeType: raw.scanFile?.mimeType ?? null,
    scanFileName: raw.scanFile?.originalName ?? null,
    reportFileMimeType: raw.reportFile?.mimeType ?? null,
    reportFileName: raw.reportFile?.originalName ?? null,
    penerimaNama,
    penerimaJabatan,
    penerimaKontak,
    penerimaId:
      raw.recipientUserId != null ? String(raw.recipientUserId) : null,
    catatanSerahTerima,
    // Penanda tangan surat jalan
    pengirim: nameOf(raw.sender) ?? raw.senderName ?? nameOf(raw.creator) ?? "",
    pengirimId: raw.senderId != null ? String(raw.senderId) : null,
    pengirimEkspedisi: raw.senderName ?? "",
    kendaraan: raw.vehicleNo ?? "",
    gudang: nameOf(raw.warehouse) ?? "",
    gudangId: raw.warehouseId != null ? String(raw.warehouseId) : null,
    petugasGudang: nameOf(raw.warehouseStaff) ?? "",
    petugasGudangId:
      raw.warehouseStaffId != null ? String(raw.warehouseStaffId) : null,
    tanggalDiterima: raw.receivedAt
      ? d(raw.receivedAt)
      : raw.tanggalDiterima
        ? d(raw.tanggalDiterima)
        : null,
    soDisplay: resolvedSoNum || (resolvedSoId ? `SO #${resolvedSoId}` : "-"),
    invoiceDisplay:
      resolvedInvoiceNum ||
      (resolvedInvoiceId ? `INV #${resolvedInvoiceId}` : "-"),
  };
}
