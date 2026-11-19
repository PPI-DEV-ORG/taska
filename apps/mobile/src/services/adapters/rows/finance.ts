import type { Row } from "@/constants/modules";
import { d, idOf, n, nameOf } from "../row-helpers";
import { toLabel } from "../status-maps";

export function mapExpenses(raw: any, base: Row): Row {
  return {
    ...base,
    tanggal: d(raw.date),
    pelapor: nameOf(raw.reporter) ?? "",
    kategori: nameOf(raw.category) ?? "-",
    categoryId: idOf(raw.category),
    nominal: n(raw.amount),
    project: nameOf(raw.project) ?? "-",
    projectId: idOf(raw.project),
    surveyId: raw.surveyId != null ? String(raw.surveyId) : null,
    survey: raw.survey
      ? `Survey #${raw.survey.id} - ${raw.survey.lead?.name || raw.survey.location || "Survey"}`
      : "-",
    pocReportId: raw.pocReportId != null ? String(raw.pocReportId) : null,
    pocReport:
      typeof raw.pocReport === "string" && raw.pocReport !== "-"
        ? raw.pocReport
        : raw.pocReport && typeof raw.pocReport === "object"
          ? `POC ${raw.pocReport.number || raw.pocReport.nomor || `#${raw.pocReport.id}`} - ${raw.pocReport.title || raw.pocReport.judul || "POC"}`
          : raw.pocReportId != null
            ? `POC #${raw.pocReportId}`
            : "-",
    visitReportId: raw.visitReportId != null ? String(raw.visitReportId) : null,
    visitReport:
      typeof raw.visitReport === "string" && raw.visitReport !== "-"
        ? raw.visitReport
        : raw.visitReport && typeof raw.visitReport === "object"
          ? `VISIT ${raw.visitReport.number || raw.visitReport.nomor || `#${raw.visitReport.id}`} - ${raw.visitReport.title || raw.visitReport.judul || "Kunjungan"}`
          : raw.visitReportId != null
            ? `VISIT #${raw.visitReportId}`
            : "-",
    maintenanceReportId:
      raw.maintenanceReportId != null ? String(raw.maintenanceReportId) : null,
    maintenanceReport:
      typeof raw.maintenanceReport === "string" && raw.maintenanceReport !== "-"
        ? raw.maintenanceReport
        : raw.maintenanceReport && typeof raw.maintenanceReport === "object"
          ? `MTN ${raw.maintenanceReport.number || raw.maintenanceReport.nomor || `#${raw.maintenanceReport.id}`} - ${raw.maintenanceReport.title || raw.maintenanceReport.judul || "Maintenance"}`
          : raw.maintenanceReportId != null
            ? `MTN #${raw.maintenanceReportId}`
            : "-",
    fundingSource: raw.fundingSource || "PERUSAHAAN",
    sumberDana:
      raw.fundingSource === "TALANGAN_PRIBADI"
        ? "Talangan Pribadi (Reimbursement)"
        : raw.fundingSource === "PETTY_CASH"
          ? "Saldo Petty Cash"
          : raw.fundingSource === "UANG_JALAN"
            ? "Kas Proyek / Petty Cash"
            : "Dana Perusahaan",
    reimbursementStatus: raw.reimbursementStatus ?? null,
    approvedAmount: raw.approvedAmount != null ? n(raw.approvedAmount) : null,
    paidAmount: raw.paidAmount != null ? n(raw.paidAmount) : null,
    paymentMethod: raw.paymentMethod ?? null,
    paidById: raw.paidById ?? null,
    paidBy: nameOf(raw.paidBy) ?? null,
    receiptFileIds: Array.isArray(raw.receiptFileIds) ? raw.receiptFileIds : [],
    alasan: raw.description ?? "",
    status: toLabel("expenses", raw.status),
    costCenterId: idOf(raw.costCenter),
    receiptFileId:
      raw.receiptFileId ?? raw.receiptFile?.id ?? raw.fileId ?? null,
    receiptFile: raw.receiptFile ?? null,
    paidFileId: raw.paidFileId ?? raw.paidFile?.id ?? null,
    paidFile: raw.paidFile ?? null,
    fileId: raw.receiptFileId ?? raw.receiptFile?.id ?? raw.fileId ?? null,
  };
}

export function mapInvoiceIn(raw: any, base: Row): Row {
  const suppName = nameOf(raw.supplier) ?? "";
  const statusMap: Record<string, string> = {
    PAID: "Lunas",
    PARTIAL: "Dibayar sebagian",
    OVERDUE: "Terlambat",
    BATAL: "Batal",
    UNPAID: "Belum lunas",
  };
  const totNum = n(raw.total);
  const paidNum = n(raw.paidAmount);
  const isPartial = paidNum > 0 && paidNum < totNum;
  let displayStatus = statusMap[raw.status] ?? raw.status ?? "Belum lunas";
  if (raw.status !== "BATAL" && displayStatus !== "Batal") {
    if (totNum > 0 && paidNum >= totNum) {
      displayStatus = "Lunas";
    } else if (isPartial) {
      displayStatus = "Dibayar sebagian";
    }
  }
  const termOrType =
    raw.type ||
    raw.jenis ||
    (raw.notes && /DP|Termin|Pelunasan/i.test(raw.notes)
      ? raw.notes.match(/^(DP[^\.\n]*|Termin[^\.\n]*|Pelunasan[^\.\n]*)/i)?.[1]
      : undefined);
  return {
    ...base,
    nomor: raw.number ?? "",
    customer: suppName
      ? raw.category
        ? `${suppName} (${raw.category})`
        : `${suppName} (Supplier)`
      : "Supplier / Vendor",
    supplier: suppName,
    supplierId: idOf(raw.supplier),
    po: raw.supplierPo?.number ?? "-",
    supplierPoId: idOf(raw.supplierPo),
    jenis:
      termOrType ||
      raw.category ||
      (raw.supplierPo ? "Tagihan Supplier" : "Invoice Masuk Langsung"),
    type: raw.type || (termOrType ? "TERMIN" : "INVOICE_IN"),
    category: raw.category ?? "",
    debitAccount: raw.debitAccount ?? "",
    coaAccount: raw.coaAccount ?? "",
    catatan: raw.notes ?? "",
    items: raw.items ?? [],
    direction: "in",
    nilai: n(raw.amount),
    discount: n(raw.discount || raw.quotation?.discount || 0),
    disc: n(raw.discount || raw.quotation?.discount || 0),
    ppn: n(raw.ppn),
    // Tagihan dari PO mengikuti mode PPN PO; tanpa PO: ada PPN = exclude
    ppnMode:
      raw.supplierPo?.ppnMode === "include" ||
      raw.supplierPo?.ppnMode === "exclude" ||
      raw.supplierPo?.ppnMode === "none"
        ? raw.supplierPo.ppnMode
        : n(raw.ppn) > 0
          ? "exclude"
          : "none",
    pph: n(raw.pph),
    pphMode: raw.pphMode ?? "none",
    tipePph: raw.tipePph ?? "",
    total: n(raw.total),
    terbayar: n(raw.paidAmount),
    tanggal: d(raw.date || raw.createdAt),
    jatuhTempo: d(raw.dueDate),
    status: displayStatus,
    fileId: raw.fileId ?? raw.file?.id ?? null,
    file: raw.file ?? null,
    transferFileId:
      raw.transferFileId ??
      (raw.payments ?? []).find((p: any) => p.fileId)?.fileId ??
      null,
    transferFile: raw.transferFile ?? null,
    taxInvoiceFileId: raw.taxInvoiceFileId ?? null,
    taxInvoiceNumber: raw.taxInvoiceNumber ?? "",
    _payments: (raw.payments ?? []).map((p: any) => ({
      id: String(p.id),
      amount: n(p.amount),
      date: d(p.date),
      method: p.method ?? "TRANSFER",
      reference: p.reference ?? "-",
      fileId: p.fileId ?? null,
    })),
  };
}
