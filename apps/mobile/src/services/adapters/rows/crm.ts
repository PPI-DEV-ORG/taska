import type { Row } from "@/constants/modules";
import { d, idOf, n, nameOf } from "../row-helpers";
import { adaptApproval } from "../approvals";
import { toLabel } from "../status-maps";

export function mapLeads(raw: any, base: Row): Row {
  const latestFu = raw.followUps?.[0]?.date ?? raw.updatedAt ?? raw.createdAt;
  const sepiDays = latestFu
    ? Math.max(
        0,
        Math.floor((Date.now() - new Date(latestFu).getTime()) / 86_400_000),
      )
    : 0;
  const jenisMatch = raw.need?.match(/\[JENIS:([^\]]+)\]/i);
  const cleanNeed = raw.need
    ? raw.need.replace(/\[JENIS:[^\]]+\]\s*/gi, "")
    : "";
  let jenisTransaksi = jenisMatch ? jenisMatch[1].trim() : "";
  if (jenisTransaksi.toUpperCase() === "BARANG") {
    jenisTransaksi = "Penjualan Barang (Perangkat / Retail)";
  } else if (jenisTransaksi.toUpperCase() === "PROYEK") {
    jenisTransaksi = "Proyek (Instalasi & Jasa)";
  }
  if (!jenisTransaksi) {
    jenisTransaksi = /barang|retail|perangkat/i.test(raw.name ?? "")
      ? "Penjualan Barang (Perangkat / Retail)"
      : "Proyek (Instalasi & Jasa)";
  }

  return {
    ...base,
    nama: raw.name ?? "",
    perusahaan: nameOf(raw.customer),
    sumber: nameOf(raw.source),
    nilai: n(raw.estimatedValue),
    peluang: n(raw.probability),
    closing: d(raw.targetClosing),
    pemilik: nameOf(raw.owner),
    status: toLabel("leads", raw.stage),
    jenisTransaksi,
    sepi: sepiDays,
    tipe: toLabel("clientType", raw.clientType),
    kontak: raw.contactName ?? "",
    alasanLost: raw.lostNote ?? nameOf(raw.lostReason),
    need: cleanNeed,
    customerId: idOf(raw.customer),
    sourceId: idOf(raw.source),
    ownerId: raw.owner?.id != null ? String(raw.owner.id) : null,
    lostReasonId: raw.lostReason?.id != null ? String(raw.lostReason.id) : null,
    stage: raw.stage,
    penawaranId:
      raw.quotations?.[0]?.id != null ? String(raw.quotations[0].id) : null,
    penawaranFile: raw.quotations?.[0]?.number ?? null,
    createdAt: raw.createdAt,
    fileId: raw.fileId ?? raw.file?.id ?? raw.files?.[0]?.id ?? null,
    file: raw.file ?? raw.files?.[0] ?? null,
    files: raw.files ?? (raw.file ? [raw.file] : []),
    _followUps: (raw.followUps ?? []).map((f: any) => ({
      id: String(f.id),
      date: d(f.date),
      method: toLabel("followupMethod", f.method),
      notes: f.notes ?? "",
      nextAction: d(f.nextDate),
      status: f.status ?? "SELESAI",
    })),
  };
}

export function mapQuotations(raw: any, base: Row): Row {
  const hasFile = Boolean(
    raw.latestFileId ||
    raw.fileId ||
    (Array.isArray(raw.versions) && raw.versions.some((v: any) => v.fileId)),
  );
  const fObj = (raw.files ?? []).find(
    (f: any) => f.id === raw.latestFileId || f.id === raw.fileId,
  );
  const isPdf =
    fObj?.originalName?.toLowerCase().endsWith(".pdf") ||
    fObj?.mimeType === "application/pdf" ||
    String(raw.latestFileName || "")
      .toLowerCase()
      .endsWith(".pdf");
  const ext = isPdf ? "pdf" : "xlsx";
  const fName =
    raw.latestFileName ||
    fObj?.originalName ||
    (hasFile
      ? raw.fileName ||
        (raw.number
          ? `Penawaran-${String(raw.number).replace(/\//g, "-")}.${ext}`
          : `Penawaran.${ext}`)
      : "");
  const qRawTot = n(raw.total);
  const qRawDisc = n(raw.discount);
  const qRawNet = Math.max(0, qRawTot - qRawDisc);
  const qRawPpn = n(raw.ppn);
  const qRawGrand = n(raw.grandTotal);
  const qRawPph = n(raw.pph);
  const qPphMode = raw.pphMode || "none";
  const qTipePph =
    raw.tipePph ||
    (qPphMode !== "none" ? String(qPphMode).toUpperCase() : "Tanpa PPh");

  let qPpnMode: "exclude" | "include" | "none" = "exclude";
  let qTipePpn = "Exclude PPN (11%)";
  if (
    raw.ppnMode === "include" ||
    String(raw.tipePpn || "").includes("Include")
  ) {
    qPpnMode = "include";
    qTipePpn = "Include PPN (Sudah termasuk)";
  } else if (
    raw.ppnMode === "none" ||
    String(raw.tipePpn || "").includes("No") ||
    String(raw.tipePpn || "").includes("Tanpa") ||
    (qRawPpn === 0 && qRawGrand > 0 && Math.abs(qRawGrand - qRawNet) < 2)
  ) {
    qPpnMode = "none";
    qTipePpn = "No PPN (Tanpa PPN)";
  } else if (
    qRawPpn > 0 &&
    qRawGrand > 0 &&
    // harga sudah termasuk PPN: grand = net (data baru) atau net − PPh (data lama)
    (Math.abs(qRawGrand - qRawNet) < 2 ||
      Math.abs(qRawGrand + qRawPph - qRawNet) < 2)
  ) {
    qPpnMode = "include";
    qTipePpn = "Include PPN (Sudah termasuk)";
  }

  // Nilai penawaran = DPP + PPN. PPh tidak mengurangi nilai dokumen (dipotong customer saat membayar).
  // Dihitung ulang dari komponennya agar data lama (yang dulu dikurangi PPh) tampil sama dengan data baru.
  const qTotalAfterDisc = qPpnMode === "exclude" ? qRawNet + qRawPpn : qRawNet;

  return {
    ...base,
    nomor: raw.number ?? "",
    lead: nameOf(raw.lead) ?? "",
    leadId: idOf(raw.lead),
    customer: nameOf(raw.customer) ?? "",
    customerId: idOf(raw.customer),
    nilai: qRawTot,
    total: qRawTot,
    ppn: qRawPpn,
    disc: qRawDisc,
    discount: qRawDisc,
    pph: qRawPph,
    pphMode: qPphMode,
    tipePph: qTipePph,
    ppnMode: qPpnMode,
    tipePpn: qTipePpn,
    totalAfterDisc: qTotalAfterDisc,
    netReceived: Math.max(0, qTotalAfterDisc - qRawPph),
    status: toLabel("quotations", raw.status),
    versi: n(raw.currentVersion) || 0,
    berlaku: d(raw.validUntil),
    pemilik: nameOf(raw.owner),
    dibuat: d(raw.createdAt),
    items: Array.isArray(raw.items) ? raw.items : [],
    subject: raw.subject ?? "",
    intro: raw.intro ?? "",
    notesList: Array.isArray(raw.notesList) ? raw.notesList : [],
    city: raw.city ?? "Bekasi",
    kopText: raw.kopText ?? "",
    customerAddress: raw.customerAddress ?? raw.customer?.address ?? "",
    signerName: raw.signerName ?? "",
    signerTitle: raw.signerTitle ?? "",
    latestFileId: raw.latestFileId ?? raw.versions?.[0]?.fileId ?? null,
    fileName: fName,
    fileStatus: hasFile ? fName : "Belum diupload",
    fileUploaded: hasFile,
    files: Array.isArray(raw.files) ? raw.files : [],
    stage: raw.lead?.stage ?? null,
    stockConflictFlag: !!raw.stockConflictFlag,
    stockConflictMessage: raw.stockConflictMessage ?? null,
    autoSwapLogs: Array.isArray(raw.autoSwapLogs) ? raw.autoSwapLogs : [],
    emergencyPrId: raw.emergencyPrId ?? null,
    emergencyPrNumber: raw.emergencyPrNumber ?? null,
    _versions: (raw.versions ?? []).map((v: any) => {
      let vStatus = "Draft";
      let vReason = v.note || `Revisi v${v.version}`;
      const match = String(v.note || "").match(/^\[STATUS:([^\]]+)\]\s*(.*)$/);
      if (v.version === raw.currentVersion) {
        vStatus = toLabel("quotations", raw.status) || match?.[1] || "Menunggu";
        vReason = match?.[2] || v.note || `Revisi v${v.version}`;
      } else if (match) {
        vStatus = match[1] ?? "Draft";
        vReason = match[2] || `Revisi v${v.version}`;
      } else if (v.version < (raw.currentVersion || 1)) {
        vStatus = "Ditolak";
      } else {
        vStatus = toLabel("quotations", raw.status) || "Menunggu";
      }
      const fObj = (raw.files ?? []).find((f: any) => f.id === v.fileId);
      const isVerPdf =
        fObj?.originalName?.toLowerCase().endsWith(".pdf") ||
        fObj?.mimeType === "application/pdf" ||
        String(v.file || "")
          .toLowerCase()
          .endsWith(".pdf");
      const verExt = isVerPdf ? "pdf" : "xlsx";
      const vFileName =
        v.file ||
        fObj?.originalName ||
        (v.fileId
          ? `Penawaran-${String(raw.number || "").replace(/\//g, "-")}-v${v.version}.${verExt}`
          : "-");
      return {
        id: String(v.id),
        v: n(v.version),
        status: vStatus,
        fileId: v.fileId ? Number(v.fileId) : null,
        total: n(v.total),
        ppn: n(v.ppn),
        disc: n(v.discount),
        totalAfterDisc:
          n(v.grandTotal) === n(v.total) && n(v.ppn) > 0
            ? n(v.total) - n(v.discount) + n(v.ppn)
            : n(v.grandTotal) || n(v.total) - n(v.discount) + n(v.ppn),
        date: d(v.createdAt),
        reason: vReason,
        file: vFileName,
      };
    }),
  };
}

export function mapSurveys(raw: any, base: Row): Row {
  const surveyFiles = Array.isArray(raw.files) ? raw.files : [];
  const isMedia = (f: any) => {
    const k = String(f.kind || "").toUpperCase();
    return (
      f.mimeType?.startsWith("image/") ||
      f.mimeType?.startsWith("video/") ||
      k === "FOTO" ||
      k === "VIDEO"
    );
  };
  const isDoc = (f: any) => {
    const k = String(f.kind || "").toUpperCase();
    return (
      k === "DOKUMEN" ||
      (!f.mimeType?.startsWith("image/") &&
        !f.mimeType?.startsWith("video/") &&
        k !== "FOTO" &&
        k !== "VIDEO")
    );
  };
  const mediaFile = surveyFiles.find(isMedia);
  const docFile = surveyFiles.find(isDoc);
  return {
    ...base,
    lead: nameOf(raw.lead) ?? "",
    leadId: idOf(raw.lead),
    customer: raw.lead?.customer?.name ?? "",
    lokasi: raw.location ?? "",
    jadwal: d(raw.scheduleAt),
    tim: (raw.members ?? [])
      .map((m: any) => nameOf(m.user))
      .filter(Boolean)
      .join(", "),
    status: toLabel("surveys", raw.status),
    biaya: n(raw.cost),
    need: raw.need ?? "",
    notes: raw.notes ?? "",
    catatan: raw.notes ?? "",
    catatanTeknis: raw.notes ?? "",
    requester: nameOf(raw.requester) ?? "",
    approval: raw.approval ? adaptApproval(raw.approval) : undefined,
    files: surveyFiles,
    evidenceFileId: raw.evidenceFileId ?? mediaFile?.id ?? null,
    documentFileId: raw.documentFileId ?? docFile?.id ?? null,
    mediaFile: mediaFile ?? null,
    docFile: docFile ?? null,
  };
}
