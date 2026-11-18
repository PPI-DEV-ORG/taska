import type { Row } from "@/constants/modules";
import { d, idOf, n, nameOf } from "../row-helpers";
import { toLabel } from "../status-maps";

export function mapPocReports(raw: any, base: Row): Row {
  const typeLabel =
    raw.type === "DEMO_CLIENT"
      ? "Demo Klien"
      : raw.type === "EXPO_EXHIBITION"
        ? "Pameran / Expo"
        : raw.type === "INTERNAL_POC"
          ? "Pengujian Internal"
          : raw.type || "Demo Klien";
  const clientOrExpo =
    raw.clientName ||
    (raw.customer ? nameOf(raw.customer) : null) ||
    (raw.lead ? `Lead: ${nameOf(raw.lead)}` : null) ||
    "-";
  const membersList = Array.isArray(raw.members)
    ? raw.members
        .map((m: any) => m.user?.name || nameOf(m))
        .filter(Boolean)
        .join(", ")
    : "-";

  return {
    ...base,
    nomor: raw.number || `POC #${raw.id}`,
    judul: raw.title || "-",
    title: raw.title || "-",
    deskripsi: raw.description ?? "",
    description: raw.description ?? "",
    tipe: typeLabel,
    type: typeLabel,
    tipeLabel: typeLabel,
    typeCode: raw.type || "DEMO_CLIENT",
    tanggal: d(raw.date),
    date: raw.date ? String(raw.date).slice(0, 10) : "",
    tanggalSelesai: raw.endDate ? d(raw.endDate) : "-",
    endDate: raw.endDate ? String(raw.endDate).slice(0, 10) : "",
    lokasi: raw.location ?? "-",
    location: raw.location ?? "",
    status: raw.status || "Draft",
    hasilStatus: raw.resultStatus || "Pending Evaluation",
    resultStatus: raw.resultStatus || "Pending Evaluation",
    klien: clientOrExpo,
    clientName: raw.clientName || clientOrExpo,
    customerId: idOf(raw.customer) ?? raw.customerId,
    customer: nameOf(raw.customer) ?? "-",
    projectId: idOf(raw.project) ?? raw.projectId,
    project: nameOf(raw.project) ?? "-",
    leadId: idOf(raw.lead) ?? raw.leadId,
    lead: nameOf(raw.lead) ?? "-",
    pemilik: nameOf(raw.owner) ?? "",
    ownerId: idOf(raw.owner) ?? raw.ownerId,
    targetCriteria: raw.targetCriteria ?? "",
    productsTested: raw.productsTested ?? "",
    anggaran: n(raw.budget),
    budget: n(raw.budget),
    biaya: n(raw.actualCost),
    actualCost: n(raw.actualCost),
    actualExecutionDate: raw.actualExecutionDate
      ? d(raw.actualExecutionDate)
      : null,
    actualAttendees: raw.actualAttendees ?? "",
    activitiesDone: raw.activitiesDone ?? "",
    testResults: raw.testResults ?? "",
    issuesFound: raw.issuesFound ?? "",
    followUpNeeded: raw.followUpNeeded ?? "",
    conclusion: raw.conclusion ?? "",
    recommendations: raw.recommendations ?? "",
    companyHeader: raw.companyHeader ?? "",
    logoFileId: raw.logoFileId ?? null,
    documentFileId: raw.documentFileId ?? null,
    tim: membersList,
    members: raw.members ?? [],
    checklists: raw.checklists ?? [],
    followUps: raw.followUps ?? [],
    _followUps: raw.followUps ?? [],
    expenses: raw.expenses ?? [],
    financeSummary: raw.financeSummary ?? null,
  };
}

export function mapVisitReports(raw: any, base: Row): Row {
  const clientNameDisplay =
    raw.clientName ||
    (raw.customer ? nameOf(raw.customer) : null) ||
    (raw.lead ? `Lead: ${nameOf(raw.lead)}` : null) ||
    "-";
  const membersList = Array.isArray(raw.members)
    ? raw.members
        .map((m: any) => m.user?.name || nameOf(m))
        .filter(Boolean)
        .join(", ")
    : "-";
  const actType = raw.activityType?.name || raw.activityTypeName || "-";
  const totalBiaya =
    raw.expenseSummary?.total ??
    (Array.isArray(raw.expenses)
      ? raw.expenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0)
      : 0);

  return {
    ...base,
    nomor: raw.number || `VISIT #${raw.id}`,
    judul: raw.title || "-",
    title: raw.title || "-",
    deskripsi: raw.description ?? "",
    description: raw.description ?? "",
    tipe: actType,
    activityType: actType,
    activityTypeId: raw.activityTypeId,
    activityTypeName: raw.activityTypeName,
    tanggal: d(raw.date),
    date: raw.date ? String(raw.date).slice(0, 10) : "",
    tanggalSelesai: raw.endDate ? d(raw.endDate) : "-",
    endDate: raw.endDate ? String(raw.endDate).slice(0, 10) : "",
    lokasi: raw.location ?? "-",
    location: raw.location ?? "",
    status: raw.status || "Planned",
    klien: clientNameDisplay,
    clientName: raw.clientName || clientNameDisplay,
    kontakKlien: raw.clientContact ?? "-",
    clientContact: raw.clientContact ?? "",
    customerId: idOf(raw.customer) ?? raw.customerId,
    customer: nameOf(raw.customer) ?? "-",
    projectId: idOf(raw.project) ?? raw.projectId,
    project: nameOf(raw.project) ?? "-",
    leadId: idOf(raw.lead) ?? raw.leadId,
    lead: nameOf(raw.lead) ?? "-",
    pemilik: nameOf(raw.owner) ?? "",
    ownerId: idOf(raw.owner) ?? raw.ownerId,
    tim: membersList,
    members: raw.members ?? [],
    memberUserIds: Array.isArray(raw.members)
      ? raw.members.map((m: any) => m.userId || m.user?.id)
      : [],
    tujuan: raw.purpose ?? "",
    purpose: raw.purpose ?? "",
    totalBiaya,
    summary: raw.summary ?? "",
    clientNeeds: raw.clientNeeds ?? "",
    productsIntroduced: raw.productsIntroduced ?? "",
    clientFeedback: raw.clientFeedback ?? "",
    agreements: raw.agreements ?? "",
    potentialOpportunities: raw.potentialOpportunities ?? "",
    obstacles: raw.obstacles ?? "",
    conclusion: raw.conclusion ?? "",
    companyHeader: raw.companyHeader ?? "",
    logoFileId: raw.logoFileId ?? null,
    documentFileId: raw.documentFileId ?? null,
    actions: raw.actions ?? [],
    followUps: raw.followUps ?? [],
    _followUps: raw.followUps ?? [],
    expenses: raw.expenses ?? [],
    expenseSummary: raw.expenseSummary ?? null,
  };
}

export function mapMaintenanceReports(raw: any, base: Row): Row {
  const clientNameDisplay =
    raw.clientName ||
    (raw.customer ? nameOf(raw.customer) : null) ||
    (raw.lead ? `Lead: ${nameOf(raw.lead)}` : null) ||
    "-";
  const membersList = Array.isArray(raw.members)
    ? raw.members
        .map((m: any) => m.user?.name || nameOf(m))
        .filter(Boolean)
        .join(", ")
    : "-";
  const totalBiaya =
    raw.expenseSummary?.total ??
    (Array.isArray(raw.expenses)
      ? raw.expenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0)
      : raw.totalBiaya || 0);

  return {
    ...base,
    nomor: raw.number || `MTN #${raw.id}`,
    judul: raw.title || "-",
    title: raw.title || "-",
    deskripsi: raw.description ?? "",
    description: raw.description ?? "",
    tipe: raw.maintenanceType || "Preventive",
    maintenanceType: raw.maintenanceType || "Preventive",
    tanggal: d(raw.startDate),
    startDate: raw.startDate ? String(raw.startDate).slice(0, 10) : "",
    tanggalSelesai: raw.endDate ? d(raw.endDate) : "-",
    endDate: raw.endDate ? String(raw.endDate).slice(0, 10) : "",
    lokasi: raw.location ?? "-",
    location: raw.location ?? "",
    status: raw.status || "Scheduled",
    klien: clientNameDisplay,
    clientName: raw.clientName || clientNameDisplay,
    kontakKlien: raw.clientContact ?? "-",
    clientContact: raw.clientContact ?? "",
    customerId: idOf(raw.customer) ?? raw.customerId,
    customer: nameOf(raw.customer) ?? "-",
    projectId: idOf(raw.project) ?? raw.projectId,
    project: nameOf(raw.project) ?? "-",
    leadId: idOf(raw.lead) ?? raw.leadId,
    lead: nameOf(raw.lead) ?? "-",
    pemilik: nameOf(raw.owner) ?? "",
    ownerId: idOf(raw.owner) ?? raw.ownerId,
    tim: membersList,
    members: raw.members ?? [],
    memberUserIds: Array.isArray(raw.members)
      ? raw.members.map((m: any) => m.userId || m.user?.id)
      : [],
    tujuan: raw.purpose ?? "",
    purpose: raw.purpose ?? "",
    totalBiaya,
    findings: raw.findings ?? "",
    actionsTaken: raw.actionsTaken ?? "",
    recommendations: raw.recommendations ?? "",
    conclusion: raw.conclusion ?? "",
    companyHeader: raw.companyHeader ?? "",
    logoFileId: raw.logoFileId ?? null,
    documentFileId: raw.documentFileId ?? null,
    actions: raw.actions ?? [],
    followUps: raw.followUps ?? [],
    _followUps: raw.followUps ?? [],
    expenses: raw.expenses ?? [],
    expenseSummary: raw.expenseSummary ?? null,
  };
}

export function mapDamageReports(raw: any, base: Row): Row {
  // Jenis, PO asal & catatan penggantian sekarang kolom sendiri (dulu tag di deskripsi).
  const desc = raw.description ?? "";
  const isReturSales = raw.category === "RETUR_PENJUALAN";
  const isReturPurchase = raw.category === "RETUR_PEMBELIAN";
  const jenisLabel = isReturSales
    ? "Retur Penjualan"
    : isReturPurchase
      ? "Retur Pembelian"
      : toLabel("damageType", raw.type);
  const kategoriLaporan = isReturSales
    ? "Retur Penjualan"
    : isReturPurchase
      ? "Retur Pembelian"
      : "Kerusakan";
  const snPengganti =
    raw.serialUnit?.replacedBy?.sn ?? raw.replacementNote ?? "-";
  return {
    ...base,
    tanggal: d(raw.date),
    produk: nameOf(raw.product) ?? "",
    productId: idOf(raw.product),
    hasSerial: !!raw.product?.hasSerial,
    sn: raw.serialUnit?.sn ?? "-",
    snPengganti,
    serialUnitId: idOf(raw.serialUnit),
    jenis: jenisLabel,
    kategoriLaporan,
    po: raw.supplierPo?.number
      ? String(raw.supplierPo.number).replace(/^(?:POD|PO-S)\//i, "PO/")
      : "-",
    supplierPoId: raw.supplierPoId != null ? String(raw.supplierPoId) : null,
    category: raw.category ?? "KERUSAKAN",
    pelapor: nameOf(raw.reporter) ?? "",
    status: toLabel("damage-reports", raw.status),
    keterangan: desc,
    qty: n(raw.qty),
    fileId: raw.fileId ?? null,
  };
}
