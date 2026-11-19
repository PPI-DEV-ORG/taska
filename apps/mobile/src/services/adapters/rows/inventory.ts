import type { Row } from "@/constants/modules";
import { d, idOf, n, nameOf } from "../row-helpers";
import { toLabel } from "../status-maps";

export function mapSerials(raw: any, base: Row): Row {
  const activeRes = Array.isArray(raw.reservations) ? raw.reservations : [];
  const reservedFor = activeRes
    .map((rv: any) =>
      rv.invoice?.number
        ? `INV: ${rv.invoice.number}`
        : rv.quotation?.number
          ? `QUO: ${rv.quotation.number}`
          : rv.purchaseRequest?.number
            ? `PR: ${rv.purchaseRequest.number}`
            : rv.project?.name
              ? `PRJ: ${rv.project.name}`
              : null,
    )
    .filter(Boolean)
    .join(", ");
  return {
    ...base,
    sn: raw.sn ?? "",
    sku: raw.product?.sku ?? "",
    produk: nameOf(raw.product) ?? "",
    productId:
      idOf(raw.product) ??
      (raw.productId != null ? String(raw.productId) : null),
    gudang: nameOf(raw.warehouse) ?? "-",
    warehouseId:
      idOf(raw.warehouse) ??
      (raw.warehouseId != null ? String(raw.warehouseId) : null),
    project: nameOf(raw.project) || reservedFor || "-",
    projectId: idOf(raw.project),
    rawStatus: raw.status ?? "DI_GUDANG",
    status: toLabel("serials", raw.status),
    garansiMulai: d(raw.warrantyStart),
    garansiBerakhir: d(raw.warrantyEnd),
    digantiDengan: raw.replacedBy?.sn ?? raw.replacedTo ?? "",
    reservations: activeRes,
    reservedFor: reservedFor || "-",
  };
}

export function mapMovements(raw: any, base: Row): Row {
  const tLabel = toLabel("movements", raw.type);
  const gudangLabel =
    raw.type === "TRANSFER"
      ? `${nameOf(raw.fromWarehouse) || "-"} → ${nameOf(raw.toWarehouse) || "-"}`
      : nameOf(raw.toWarehouse) || nameOf(raw.fromWarehouse) || "-";
  return {
    ...base,
    waktu: raw.date
      ? String(raw.date).replace("T", " ").slice(0, 16)
      : d(raw.createdAt),
    jenis: tLabel,
    kategori: toLabel("movementCategory", raw.category),
    produk: nameOf(raw.product) ?? "",
    productId: idOf(raw.product),
    qty: n(raw.qty),
    gudang: gudangLabel,
    project: nameOf(raw.project) ?? "-",
    projectId: idOf(raw.project),
    sn: raw.snList ?? "-",
    catatan: raw.reason ?? raw.note ?? "-",
    oleh: nameOf(raw.creator) ?? "-",
  };
}

export function mapReservations(raw: any, base: Row): Row {
  const docLabel = raw.invoice?.number
    ? `Invoice ${raw.invoice.number}`
    : raw.quotation?.number
      ? `Penawaran ${raw.quotation.number}`
      : raw.purchaseRequest?.number
        ? `PR ${raw.purchaseRequest.number}`
        : nameOf(raw.project) || "-";
  return {
    ...base,
    project: docLabel,
    projectId: idOf(raw.project),
    invoiceId:
      idOf(raw.invoice) ??
      (raw.invoiceId != null ? String(raw.invoiceId) : null),
    quotationId:
      idOf(raw.quotation) ??
      (raw.quotationId != null ? String(raw.quotationId) : null),
    purchaseRequestId:
      idOf(raw.purchaseRequest) ??
      (raw.purchaseRequestId != null ? String(raw.purchaseRequestId) : null),
    produk: nameOf(raw.product) ?? "-",
    productId: idOf(raw.product),
    sku: raw.product?.sku ?? "",
    sn: raw.serialUnit?.sn ?? "-",
    serialUnitId: idOf(raw.serialUnit),
    qty: n(raw.qty),
    status: raw.releasedAt ? "Dirilis" : "Aktif",
    tanggal: d(raw.createdAt),
  };
}

export function mapFollowups(raw: any, base: Row): Row {
  return {
    ...base,
    leadId: raw.leadId != null ? String(raw.leadId) : idOf(raw.lead),
    lead: nameOf(raw.lead) ?? "",
    quotationId: raw.quotationId != null ? String(raw.quotationId) : null,
    pocReportId:
      raw.pocReportId != null ? String(raw.pocReportId) : idOf(raw.pocReport),
    visitReportId:
      raw.visitReportId != null
        ? String(raw.visitReportId)
        : idOf(raw.visitReport),
    maintenanceReportId:
      raw.maintenanceReportId != null
        ? String(raw.maintenanceReportId)
        : idOf(raw.maintenanceReport),
    tanggal: d(raw.date),
    date: d(raw.date),
    metode: toLabel("followupMethod", raw.method),
    method: toLabel("followupMethod", raw.method),
    catatan: raw.notes ?? "",
    notes: raw.notes ?? "",
    berikutnya: d(raw.nextDate),
    nextAction: d(raw.nextDate),
    status: raw.status ?? "SELESAI",
    pencatat: nameOf(raw.creator) ?? "",
  };
}
