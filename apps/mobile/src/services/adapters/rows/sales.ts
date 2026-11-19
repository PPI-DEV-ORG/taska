import type { Row } from "@/constants/modules";
import { d, idOf, n, nameOf } from "../row-helpers";
import { roleToUi } from "../roles";
import { toLabel } from "../status-maps";

export function mapPoClient(raw: any, base: Row): Row {
  const custName = nameOf(raw.customer);
  const suppName = nameOf(raw.supplier);
  const normOrderNum = (v?: string | null) =>
    v
      ? String(v)
          .replace(/^(?:POD|PO-S)\//i, "PO/")
          .replace(/^(?:POC|SO-S)\//i, "SO/")
      : "";
  const normRawNumber = normOrderNum(raw.number);
  const isNumberSo = /^SO[\-\/]/i.test(normRawNumber);
  const isNumberPo = /^PO[\-\/]/i.test(normRawNumber);
  const soNum =
    raw.soNumber && raw.soNumber !== "-"
      ? normOrderNum(raw.soNumber)
      : isNumberSo
        ? normRawNumber
        : "-";
  const poNum =
    raw.poClientNumber && raw.poClientNumber !== "-"
      ? normOrderNum(raw.poClientNumber)
      : isNumberPo
        ? normRawNumber
        : "-";
  const primaryDoc =
    normRawNumber && normRawNumber !== "-"
      ? normRawNumber
      : soNum !== "-"
        ? soNum
        : poNum !== "-"
          ? poNum
          : "";

  const effectiveTotal =
    n(raw.total) || (n(raw.ppn) ? n(raw.amount) + n(raw.ppn) : n(raw.amount));
  const activeInvs = Array.isArray(raw.invoices)
    ? raw.invoices.filter((b: any) => b.status !== "BATAL")
    : [];
  const totalInvoiceVal = activeInvs.reduce(
    (a: number, b: any) => a + n(b.total),
    0,
  );
  const totalPaidVal = activeInvs.reduce(
    (a: number, b: any) =>
      a + n(b.paidAmount ?? (b.status === "PAID" ? b.total : 0)),
    0,
  );
  const hasPaidPelunasan = activeInvs.some(
    (b: any) => b.status === "PAID" && b.type === "PELUNASAN" && n(b.total) > 0,
  );
  const allInvoicesPaid =
    activeInvs.length > 0 &&
    activeInvs.every((b: any) => b.status === "PAID" && n(b.total) > 0) &&
    totalPaidVal >= effectiveTotal &&
    effectiveTotal > 0;
  const isDirectSettled =
    raw.paymentStatus === "LUNAS" &&
    !!(
      raw.settledAt ||
      raw.paymentProofFileId ||
      raw.settlementType === "LANGSUNG"
    );
  const isSoLunas =
    isDirectSettled ||
    hasPaidPelunasan ||
    allInvoicesPaid ||
    raw.paymentStatus === "LUNAS";
  const isSoPartial =
    !isSoLunas &&
    (raw.paymentStatus === "LUNAS_SEBAGIAN" ||
      totalPaidVal > 0 ||
      activeInvs.some(
        (b: any) =>
          (b.status === "PAID" || b.status === "PARTIAL") && n(b.total) > 0,
      ));
  const soStatusLabel = isSoLunas
    ? "Lunas"
    : isSoPartial
      ? "Lunas sebagian"
      : "Belum dibayar";
  const soPaymentStatus = isSoLunas
    ? "LUNAS"
    : isSoPartial
      ? "LUNAS_SEBAGIAN"
      : "PENDING";

  return {
    ...base,
    nomor: primaryDoc,
    nomorSo: soNum,
    nomorPoClient: poNum,
    docMode:
      raw.docMode ??
      (soNum !== "-" && poNum !== "-" ? "BOTH" : soNum !== "-" ? "SO" : "PO"),
    customer: custName || (suppName ? `${suppName} (Supplier)` : "-"),
    customerId: idOf(raw.customer),
    supplier: suppName || "-",
    supplierId: idOf(raw.supplier),
    penawaran: raw.quotation?.number ?? "-",
    quotationId: idOf(raw.quotation),
    nilai: n(raw.amount),
    discount: n(raw.discount || raw.quotation?.discount || 0),
    disc: n(raw.discount || raw.quotation?.discount || 0),
    ppn: n(raw.ppn),
    tipePpn: raw.tipePpn ?? (n(raw.ppn) > 0 ? "PPN 11%" : "Non PPN"),
    ppnMode: raw.ppnMode ?? (n(raw.ppn) > 0 ? "exclude" : "none"),
    pph: n(raw.pph),
    tipePph: raw.tipePph ?? (n(raw.pph) > 0 ? "PPh" : "Tanpa PPh"),
    pphMode: raw.pphMode ?? (n(raw.pph) > 0 ? "pph23" : "none"),
    total: effectiveTotal,
    totalInvoice: totalInvoiceVal,
    terbayar: isDirectSettled ? effectiveTotal : totalPaidVal,
    tanggal: d(raw.date),
    status: soStatusLabel,
    paymentStatus: soPaymentStatus,
    settlementType: raw.settlementType ?? null,
    paymentProofFileId: raw.paymentProofFileId ?? null,
    paymentProofFile: raw.paymentProofFile ?? null,
    coaAccount: raw.coaAccount ?? null,
    settledAt: raw.settledAt ?? null,
    goodsDispatched: raw.goodsDispatched ?? false,
    fileId: raw.fileId ?? raw.file?.id ?? null,
    file: raw.file ?? null,
    soFileId: raw.soFileId ?? raw.soFile?.id ?? null,
    soFile: raw.soFile ?? null,
    items: Array.isArray(raw.items) ? raw.items : [],
    catatan: raw.notes ?? raw.catatan ?? "",
    lead: raw.quotation?.lead?.name ?? raw.lead?.name ?? "-",
    leadId: raw.quotation?.leadId ?? idOf(raw.lead) ?? null,
    project: nameOf(raw.project) || raw.projectName || "-",
    projectId: raw.projectId ?? idOf(raw.project) ?? null,
    projectName: raw.projectName ?? null,
  };
}

export function mapInvoices(raw: any, base: Row): Row {
  const qNum =
    raw.quotation ??
    raw.clientPo?.quotation?.number ??
    raw.project?.quotation?.number ??
    (raw.description
      ? (raw.description.match(/(?:QUO|PNW)[-\w\/]+/i)?.[0] ?? undefined)
      : undefined);
  const qId =
    raw.quotationId ??
    raw.clientPo?.quotationId ??
    raw.project?.quotationId ??
    idOf(raw.clientPo?.quotation) ??
    idOf(raw.project?.quotation) ??
    undefined;
  const descLeadMatch = raw.description
    ? String(raw.description).match(/\[lead:(\d+)\]/i)
    : null;
  const descLeadId = descLeadMatch ? descLeadMatch[1] : undefined;
  const leadId =
    raw.leadId ??
    raw.project?.leadId ??
    raw.project?.lead?.id ??
    raw.clientPo?.quotation?.leadId ??
    (descLeadId ? String(descLeadId) : undefined) ??
    null;
  const leadName =
    raw.lead ??
    raw.project?.lead?.name ??
    raw.project?.quotation?.lead?.name ??
    raw.clientPo?.quotation?.lead?.name ??
    "";
  const totNum = n(raw.total);
  const paidNum = n(raw.paidAmount);
  const isSelfPaid =
    raw.status === "PAID" ||
    toLabel("invoices", raw.status) === "Lunas" ||
    (totNum > 0 && paidNum >= totNum);
  const isDpOrTermin =
    raw.type === "DP" ||
    raw.type === "TERMIN" ||
    String(raw.number || "").includes("/DP/") ||
    String(raw.number || "").includes("/TRM/") ||
    /INV\/\d{4}\/\d{2}\/\d+\/1$/i.test(String(raw.number || ""));

  let displayStatus = toLabel("invoices", raw.status);
  if (raw.status !== "BATAL" && displayStatus !== "Dibatalkan") {
    if (raw.status === "PAID") {
      displayStatus = "Lunas";
    } else if (raw.status === "PARTIAL" || (isDpOrTermin && isSelfPaid)) {
      displayStatus = "Dibayar sebagian";
    } else if (isSelfPaid) {
      displayStatus = "Lunas";
    } else if (paidNum > 0) {
      displayStatus = "Dibayar sebagian";
    }
  }
  // Proforma bukan tagihan resmi -> status sendiri agar tidak tercampur filter Belum lunas / Lunas
  if (raw.isProforma && raw.status !== "BATAL") {
    displayStatus = raw.convertedTo
      ? "Proforma (sudah jadi invoice)"
      : raw.status === "DRAFT"
        ? "Proforma (draft)"
        : "Proforma";
  }
  const isPartial = displayStatus === "Dibayar sebagian";

  const rawAmt = n(raw.amount);
  const rawPpn = n(raw.ppn);
  const rawPph = n(raw.pph);
  const invPphMode = raw.pphMode || "none";
  const invTipePph =
    raw.tipePph ||
    (invPphMode !== "none" ? String(invPphMode).toUpperCase() : "Tanpa PPh");

  let invPpnMode: "exclude" | "include" | "none" = "exclude";
  let invTipePpn = "Exclude PPN (11%)";
  if (
    raw.ppnMode === "include" ||
    String(raw.tipePpn || "").includes("Include")
  ) {
    invPpnMode = "include";
    invTipePpn = "Include PPN (Sudah termasuk)";
  } else if (
    raw.ppnMode === "exclude" ||
    String(raw.tipePpn || "").includes("Exclude") ||
    rawPpn > 0 ||
    (totNum > rawAmt && rawAmt > 0)
  ) {
    invPpnMode = "exclude";
    invTipePpn = "Exclude PPN (11%)";
  } else if (
    raw.ppnMode === "none" ||
    String(raw.tipePpn || "").includes("No") ||
    String(raw.tipePpn || "").includes("Tanpa") ||
    (rawPpn === 0 && totNum > 0)
  ) {
    invPpnMode = "none";
    invTipePpn = "No PPN (Tanpa PPN)";
  } else if (
    rawPpn > 0 &&
    totNum > 0 &&
    Math.abs(totNum + rawPph - rawAmt) < 2
  ) {
    invPpnMode = "include";
    invTipePpn = "Include PPN (Sudah termasuk)";
  }

  return {
    ...base,
    nomor: raw.number ?? "",
    po: raw.clientPo?.number ?? "-",
    clientPoId: idOf(raw.clientPo),
    quotation: qNum ?? "",
    penawaran: qNum ?? "",
    quotationId: qId ?? null,
    lead: leadName,
    leadId: leadId ? String(leadId) : null,
    project: nameOf(raw.project) || (raw.projectName ? raw.projectName : "-"),
    projectId: idOf(raw.project) ?? null,
    paymentNote: isPartial ? "dp setengah bayar sebagian dp termin" : "",
    customer:
      nameOf(raw.customer) ||
      (raw.customerName && raw.customerName !== "-" ? raw.customerName : "") ||
      (raw.customerId
        ? ""
        : /nota kontan|pembayaran langsung|walk-?in/i.test(
              String(raw.description || ""),
            )
          ? "Pelanggan Langsung (Walk-in)"
          : "Pelanggan Umum"),
    customerId: idOf(raw.customer),
    jenis: toLabel("invoiceType", raw.type),
    catatan: (raw.description || "")
      .replace(/\[by:\d+\]/g, "")
      .replace(/\[lead:\d+\]/g, "")
      .trim(),
    nilai: rawAmt,
    ppn:
      rawPpn ||
      (invPpnMode === "exclude"
        ? Math.round(rawAmt * 0.11)
        : invPpnMode === "include"
          ? Math.max(0, totNum - Math.round(totNum / 1.11))
          : 0),
    pph: rawPph,
    pphMode: invPphMode,
    tipePph: invTipePph,
    ppnMode: invPpnMode,
    tipePpn: invTipePpn,
    total: totNum,
    terbayar: n(raw.paidAmount),
    jatuhTempo: d(raw.dueDate),
    status: displayStatus,
    tanggal: d(raw.date),
    fileId: raw.fileId ?? null,
    file: raw.file ?? null,
    fileName: raw.fileName ?? raw.file?.originalName ?? null,
    paidFileId:
      raw.paidFileId ??
      (raw.payments ?? []).find((p: any) => p.fileId)?.fileId ??
      null,
    paidFile: raw.paidFile ?? null,
    _payments: (raw.payments ?? []).map((p: any) => ({
      id: String(p.id),
      amount: n(p.amount),
      date: d(p.date),
      method: p.method ?? "TRANSFER",
      reference: p.reference ?? "-",
      fileId: p.fileId ?? null,
      file: p.file ?? null,
      fileName: p.file?.originalName ?? null,
    })),
    discount: raw.discount != null ? n(raw.discount) : undefined,
    items: Array.isArray(raw.items) ? raw.items : [],
    subject: raw.subject ?? undefined,
    intro: raw.intro ?? undefined,
    notesList: Array.isArray(raw.notesList) ? raw.notesList : undefined,
    city: raw.city ?? undefined,
    kopText: raw.kopText ?? undefined,
    kopLogoUrl: raw.kopLogoUrl ?? undefined,
    customerAddress: raw.customerAddress ?? undefined,
    signerName: raw.signerName ?? undefined,
    signerTitle: raw.signerTitle ?? undefined,
    dpLabel: raw.dpLabel ?? undefined,
    dpAmount: raw.dpAmount != null ? n(raw.dpAmount) : undefined,
    fileUploaded: !!(raw.fileId || raw.fileUploaded),
    stockConflictFlag: !!raw.stockConflictFlag,
    stockConflictMessage: raw.stockConflictMessage ?? null,
    autoSwapLogs: Array.isArray(raw.autoSwapLogs) ? raw.autoSwapLogs : [],
    emergencyPrId: raw.emergencyPrId ?? null,
    emergencyPrNumber: raw.emergencyPrNumber ?? null,
    // Proforma invoice: bukan tagihan resmi (tidak dijurnal, tidak bisa dibayar)
    isProforma: !!raw.isProforma,
    convertedTo: raw.convertedTo ?? null,
    proformaRef: raw.proforma ?? null,
    parentInvoiceId: raw.parentInvoiceId ?? null,
    isContinuation: !!raw.isContinuation,
  };
}

export function mapProjects(raw: any, base: Row): Row {
  const qNum = raw.quotation?.number ?? raw.quotation?.nomor ?? null;
  const qCust =
    raw.quotation?.customer?.name ?? raw.quotation?.customer?.nama ?? null;
  const qLead = raw.quotation?.lead?.name ?? raw.quotation?.lead?.nama ?? null;
  const qDisplay = qNum
    ? qCust || qLead
      ? `${qNum} - ${[qCust, qLead].filter(Boolean).join(" · ")}`
      : qNum
    : "-";
  const statusLabel = toLabel("projects", raw.status);
  const isSelesai =
    String(raw.status).toUpperCase() === "SELESAI" || statusLabel === "Selesai";
  const progressVal = isSelesai ? 100 : n(raw.progress ?? raw.progres);
  const paymentVal = toLabel(
    "paymentStatus",
    raw.paymentStatus ?? raw.pembayaran,
  );
  const typeVal = toLabel("projectType", raw.type ?? raw.jenis);
  const custName =
    (typeof raw.customer === "string"
      ? raw.customer
      : (raw.customer?.name ?? raw.customer?.nama)) ??
    nameOf(raw.customer) ??
    "-";
  const qId =
    idOf(raw.quotation) ??
    (raw.quotationId != null
      ? String(raw.quotationId)
      : raw.quotationid != null
        ? String(raw.quotationid)
        : null);
  const rawName = raw.name ?? raw.nama ?? "";
  const safeName =
    typeof rawName === "string"
      ? rawName
      : (rawName?.name ?? rawName?.nama ?? "");
  const rawPm =
    (typeof raw.pic === "string"
      ? raw.pic
      : (raw.pic?.name ?? raw.pic?.nama)) ??
    nameOf(raw.pic) ??
    raw.pm ??
    "";
  const safePm =
    typeof rawPm === "string" ? rawPm : (rawPm?.name ?? rawPm?.nama ?? "");
  const safeStatus = typeof statusLabel === "string" ? statusLabel : "Berjalan";

  return {
    ...base,
    nama: safeName,
    name: safeName,
    jenis: typeVal,
    type: raw.type ?? typeVal,
    customerId:
      idOf(raw.customer) ??
      (raw.customerId != null ? String(raw.customerId) : null),
    customer: custName,
    pm: safePm,
    pmId:
      raw.pic?.id != null
        ? String(raw.pic.id)
        : raw.picId != null
          ? String(raw.picId)
          : null,
    tim:
      (raw.members ?? [])
        .map((m: any) => nameOf(m.user))
        .filter(Boolean)
        .join(", ") || "-",
    progres: progressVal,
    progress: progressVal,
    pembayaran: paymentVal,
    paymentStatus: paymentVal,
    status: safeStatus,
    mulai: d(raw.startDate ?? raw.mulai),
    selesai: d(raw.endDate ?? raw.selesai),
    barang: "-",
    quotationId: qId,
    quotationid: qId,
    penawaran: qDisplay,
    lead: qLead ?? "-",
    leadId:
      raw.quotation?.leadId ?? (raw.leadId != null ? String(raw.leadId) : null),
    prdFileId: raw.prdFileId ?? null,
    bahpFileId: raw.bahpFileId ?? null,
    bastFileId: raw.bastFileId ?? null,
    doFileId: raw.doFileId ?? null,
    boqFileId: raw.boqFileId ?? null,
    prdFile: raw.prdFile ?? null,
    bahpFile: raw.bahpFile ?? null,
    bastFile: raw.bastFile ?? null,
    doFile: raw.doFile ?? null,
    boqFile: raw.boqFile ?? null,
    stages: raw.stages ?? null,
    _members: (raw.members ?? []).map((m: any) => ({
      id: String(m.userId),
      name: nameOf(m.user),
      role: roleToUi(m.user?.role),
    })),
    _invoices: Array.isArray(raw.invoices) ? raw.invoices : [],
  };
}

export function mapTasks(raw: any, base: Row): Row {
  return {
    ...base,
    project: raw.project?.name ?? "",
    projectId:
      idOf(raw.project) ??
      (raw.projectId != null ? String(raw.projectId) : null),
    parent: raw.parentId != null ? String(raw.parentId) : "",
    parentId: raw.parentId != null ? String(raw.parentId) : null,
    nama: raw.name ?? "",
    deskripsi: raw.description ?? "",
    pic: nameOf(raw.assignee) ?? "",
    assigneeId: idOf(raw.assignee),
    tenggat: d(raw.dueDate),
    status: toLabel("tasks", raw.status),
    perluBarang: !!raw.needsPurchase,
    progres: n(raw.progress),
    priority: raw.priority,
    proofFileId: raw.proofFileId ?? raw.bastFileId ?? raw.fileId ?? null,
    fileId: raw.proofFileId ?? raw.bastFileId ?? raw.fileId ?? null,
  };
}
