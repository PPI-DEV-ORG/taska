import type { Row } from "@/constants/modules";
import { d, idOf, n, nameOf } from "../row-helpers";
import { adaptApproval } from "../approvals";
import { toLabel } from "../status-maps";

export function mapPurchaseRequests(raw: any, base: Row): Row {
  const prSource = String(raw.procurementSource || "SUPPLIER").toUpperCase();
  const prPay = String(raw.paymentMethod || "UTANG").toUpperCase();
  const isProj = raw.costType === "PROJECT" || !!(raw.projectId || raw.project);
  const isInternalStock = prSource === "GUDANG";
  const isDebt = !isInternalStock && prPay !== "KAS";
  const rawPos = Array.isArray(raw.supplierPOs)
    ? raw.supplierPOs
    : raw.supplierPo
      ? [raw.supplierPo]
      : [];
  const isPoPaid = rawPos.some(
    (po: any) =>
      po.isPaid ||
      po.status === "Lunas" ||
      po.status === "LUNAS" ||
      po.status === "DIBAYAR" ||
      (Array.isArray(po.invoiceIns) &&
        po.invoiceIns.some(
          (inv: any) =>
            inv.status === "PAID" ||
            (Number(inv.paidAmount || 0) >= Number(inv.total || 0) &&
              Number(inv.total || 0) > 0),
        )),
  );
  const isPaid =
    isPoPaid || raw.status === "DIBAYAR" || raw.paymentStatus === "DIBAYAR";

  const displayStatus = (() => {
    if (raw.status === "DITERIMA") {
      if (isDebt) {
        return isPaid ? "Lunas" : "Diterima (Belum Lunas)";
      }
      return "Diterima";
    }
    if (raw.status === "DIBAYAR") {
      return isDebt ? "Lunas" : "Dibayar";
    }
    return toLabel("purchase-requests", raw.status);
  })();

  return {
    ...base,
    nomor: raw.number ?? "",
    tanggal: d(raw.date),
    dueDate: d(raw.dueDate),
    rawDueDate: raw.dueDate,
    jatuhTempo: d(raw.dueDate),
    project: nameOf(raw.project) || "-",
    projectId:
      idOf(raw.project) ??
      (raw.projectId != null ? String(raw.projectId) : null),
    costType: raw.costType ?? (isProj ? "PROJECT" : "STOK"),
    jenisBiaya: toLabel("costType", raw.costType),
    procurementSource: prSource,
    sumberPengadaan:
      prSource === "RETAIL"
        ? "Beli Ritel / Toko"
        : prSource === "GUDANG"
          ? "Ambil Stok Gudang"
          : "Supplier / PO",
    paymentMethod: prPay,
    metodePembayaran: prPay === "KAS" ? "Kas / Tunai" : "Utang / Tempo",
    alokasiAkuntansi: isProj
      ? "5101 — HPP Project"
      : "1200 — Aset Persediaan Barang",
    pemohon: nameOf(raw.requester) ?? "",
    pemohonId: raw.requester?.id != null ? String(raw.requester.id) : null,
    item:
      (raw.items ?? [])
        .map((i: any) => {
          const iName = nameOf(i.product) || i.customName || "Barang";
          const iUnit = i.product?.unit || i.customUnit || "";
          return `${iName} x ${n(i.qty)}${iUnit ? ` ${iUnit}` : ""}`;
        })
        .join(", ") ||
      raw.purpose ||
      "-",
    estimasi: n(raw.estimatedCost),
    rawStatus: raw.status,
    status: displayStatus,
    tujuan: raw.purpose ?? "",
    supplier:
      nameOf(raw.supplier) ||
      (Array.isArray(raw.supplierPOs) && raw.supplierPOs[0]?.supplier
        ? nameOf(raw.supplierPOs[0].supplier)
        : "") ||
      (raw.supplierPo?.supplier ? nameOf(raw.supplierPo.supplier) : "") ||
      "-",
    supplierId:
      idOf(raw.supplier) ??
      (Array.isArray(raw.supplierPOs) && raw.supplierPOs[0]?.supplierId != null
        ? String(raw.supplierPOs[0].supplierId)
        : null) ??
      (raw.supplierPo?.supplierId != null
        ? String(raw.supplierPo.supplierId)
        : null),
    fileId: raw.evidenceFileId ?? raw.fileId ?? null,
    doFileId: raw.doFileId ?? null,
    doFile: raw.doFile ?? null,
    paymentProofFileId:
      raw.paymentProofFileId ?? raw.paymentProofFile?.id ?? null,
    paymentProofFile: raw.paymentProofFile ?? null,
    fundingSource: raw.fundingSource ?? raw.paymentAccountCode ?? null,
    ppnMode: raw.ppnMode ?? "none",
    isProjectConsumable: Boolean(raw.isProjectConsumable),
    paymentStatus: isPaid ? "DIBAYAR" : "BELUM_DIBAYAR",
    isPaid,
    rejectReason: raw.rejectReason,
    items: Array.isArray(raw.items) ? raw.items : [],
    stock: Array.isArray(raw.stock) ? raw.stock : [],
    supplierPOs: Array.isArray(raw.supplierPOs) ? raw.supplierPOs : [],
    supplierPo:
      Array.isArray(raw.supplierPOs) && raw.supplierPOs[0]
        ? raw.supplierPOs[0]
        : (raw.supplierPo ?? null),
    approval: raw.approval ? adaptApproval(raw.approval) : undefined,
  };
}

export function mapSupplierPos(raw: any, base: Row): Row {
  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const firstProdName =
    nameOf(rawItems[0]?.product) ||
    rawItems[0]?.customName ||
    rawItems[0]?.productName ||
    "";
  const itemSummary = rawItems
    .map(
      (i: any) =>
        `${nameOf(i.product) || i.customName || i.productName || "Barang"} x ${n(i.qty)}`,
    )
    .join(", ");
  const displayItem =
    firstProdName ||
    (raw.item ? String(raw.item).replace(/\s*x\s*\d+.*$/, "") : "") ||
    itemSummary ||
    "-";
  const effProjId =
    idOf(raw.project) ??
    (raw.projectId != null
      ? String(raw.projectId)
      : raw.request?.projectId != null
        ? String(raw.request.projectId)
        : null);
  const effProjName = nameOf(raw.project) || "";
  const effCostType =
    raw.request?.costType || (effProjId || effProjName ? "PROJECT" : "STOK");
  const effPayMethod =
    raw.request?.paymentMethod ||
    (/kas|tunai|cash/i.test(String(raw.paymentTerms || "")) ? "KAS" : "UTANG");
  const manualStatus = raw.manualStatus;
  const isManualLunas = manualStatus === "LUNAS" || raw.status === "LUNAS";
  const isManualBelumLunas =
    manualStatus === "SAMPAI_BELUM_LUNAS" ||
    raw.status === "SAMPAI_BELUM_LUNAS";

  const isInvoicePaid =
    !isManualBelumLunas &&
    Array.isArray(raw.invoiceIns) &&
    raw.invoiceIns.some(
      (inv: any) =>
        inv.status === "PAID" ||
        inv.status === "Lunas" ||
        (Number(inv.paidAmount || 0) >= Number(inv.total || 0) &&
          Number(inv.total || 0) > 0),
    );
  const isPaid =
    isManualLunas ||
    (!isManualBelumLunas &&
      (Boolean(raw.isPaid) ||
        isInvoicePaid ||
        raw.paymentStatus === "DIBAYAR" ||
        raw.request?.status === "DIBAYAR" ||
        raw.request?.status === "LUNAS" ||
        raw.request?.paymentStatus === "DIBAYAR"));

  const displayStatus =
    raw.status === "DITOLAK" || raw.status === "DIBATALKAN"
      ? toLabel("supplier-pos", raw.status)
      : isManualBelumLunas
        ? "Sampai (Belum Lunas)"
        : isPaid
          ? "Lunas"
          : raw.shipmentStatus === "SAMPAI"
            ? effPayMethod !== "KAS"
              ? "Sampai (Belum Lunas)"
              : "Sampai"
            : raw.shipmentStatus === "DIKIRIM"
              ? "Dikirim"
              : raw.status === "MENUNGGU_PERSETUJUAN"
                ? "Menunggu persetujuan"
                : toLabel("supplier-pos", raw.shipmentStatus || raw.status);

  const poRawTotal = n(raw.total);
  const poItemsSum = rawItems.reduce(
    (sum: number, i: any) => sum + (n(i.qty) || 1) * n(i.price ?? i.unitCost),
    0,
  );
  const reqPpnMode = raw.request?.ppnMode ?? null;
  let poPpnMode: "none" | "exclude" | "include" = "none";
  if (
    raw.ppnMode === "exclude" ||
    raw.ppnMode === "include" ||
    raw.ppnMode === "none"
  ) {
    poPpnMode = raw.ppnMode;
  } else if (reqPpnMode === "exclude" || reqPpnMode === "include") {
    poPpnMode = reqPpnMode;
  } else if (
    poItemsSum > 0 &&
    poRawTotal > poItemsSum &&
    Math.abs(poRawTotal - Math.round(poItemsSum * 1.11)) <= 5
  ) {
    poPpnMode = "exclude";
  }

  const poDpp =
    raw.dpp != null && n(raw.dpp) > 0
      ? n(raw.dpp)
      : poPpnMode === "exclude"
        ? poItemsSum > 0
          ? poItemsSum
          : Math.round(poRawTotal / 1.11)
        : poPpnMode === "include"
          ? Math.round(poRawTotal / 1.11)
          : poRawTotal;
  const poPpn =
    raw.ppn != null && n(raw.ppn) >= 0 && raw.ppnMode
      ? n(raw.ppn)
      : poPpnMode === "exclude"
        ? Math.max(
            0,
            poRawTotal > poDpp ? poRawTotal - poDpp : Math.round(poDpp * 0.11),
          )
        : poPpnMode === "include"
          ? Math.max(0, poRawTotal - poDpp)
          : 0;
  const poPph = n(raw.pph);
  const poPphMode = raw.pphMode || "none";
  const poTipePph = raw.tipePph || "Tanpa PPh";

  return {
    ...base,
    nomor: String(raw.number ?? "").replace(/^(?:POD|PO-S)\//i, "PO/"),
    nomorSoSupplier: raw.supplierSoNumber
      ? String(raw.supplierSoNumber).replace(/^SO-S\//i, "SO/")
      : "-",
    supplier: nameOf(raw.supplier) ?? "",
    supplierId: idOf(raw.supplier),
    pembuat: nameOf(raw.creator) ?? "",
    tanggal: d(raw.date),
    eta: d(raw.eta),
    total: poRawTotal,
    dpp: poDpp,
    ppn: poPpn,
    ppnMode: poPpnMode,
    pph: poPph,
    pphMode: poPphMode,
    tipePph: poTipePph,
    persetujuan: toLabel("supplier-pos", raw.status),
    pengiriman: toLabel("supplier-pos", raw.shipmentStatus),
    status: displayStatus,
    manualStatus: manualStatus || null,
    isPaid,
    item: displayItem,
    itemsSummary: itemSummary || displayItem,
    items: rawItems,
    receivings: Array.isArray(raw.receivings) ? raw.receivings : [],
    request: raw.request?.number ?? "-",
    requestId: idOf(raw.request),
    project: effProjName || "-",
    projectId: effProjId,
    costType: effCostType,
    procurementSource: raw.request?.procurementSource ?? "SUPPLIER",
    paymentMethod: effPayMethod,
    paymentTerms: raw.paymentTerms ?? "",
    // Data dari Request Barang asal: dipakai sebagai default form tagihan supplier (tidak diisi ulang).
    requestDueDate: raw.request?.dueDate
      ? String(raw.request.dueDate).slice(0, 10)
      : null,
    requestPaid:
      raw.request?.status === "DIBAYAR" ||
      String(raw.request?.paymentStatus ?? "").toUpperCase() === "DIBAYAR",
    shipmentStatus: raw.shipmentStatus,
    poStatus: raw.status,
    fileId: raw.fileId ?? null,
    soFileId: raw.soFileId ?? null,
    doFileId: raw.doFileId ?? null,
    invoiceIns: Array.isArray(raw.invoiceIns) ? raw.invoiceIns : [],
  };
}

export function mapReceiving(raw: any, base: Row): Row {
  const effReqNum = raw.request?.number || "-";
  return {
    ...base,
    nomor: raw.number ?? "",
    po: raw.supplierPo?.number ?? "-",
    supplierPoId:
      idOf(raw.supplierPo) ??
      (raw.supplierPoId != null ? String(raw.supplierPoId) : null),
    requestId:
      idOf(raw.request) ??
      (raw.requestId != null ? String(raw.requestId) : null),
    requestNumber: effReqNum,
    request: effReqNum,
    supplier: raw.supplierPo?.supplier?.name ?? raw.supplierName ?? "-",
    supplierName: raw.supplierPo?.supplier?.name ?? raw.supplierName ?? "-",
    tanggal: d(raw.date),
    penerima: nameOf(raw.receiver) ?? "",
    status: toLabel("receiving", raw.status),
    rawStatus: raw.status,
    item:
      (raw.items ?? [])
        .map(
          (i: any) =>
            `${nameOf(i.product)} x ${n(i.qtyReceived ?? i.qtyGood ?? i.qtyOrdered)} ${i.product?.unit ?? ""}`,
        )
        .join(", ") ||
      raw.conditionNote ||
      "-",
    warehouseId: idOf(raw.warehouse),
    warehouse: nameOf(raw.warehouse) ?? "",
    projectId: idOf(raw.project),
    conditionNote: raw.conditionNote ?? "",
    _items: raw.items ?? [],
    items: raw.items ?? [],
    receiptFileId: raw.receiptFileId ?? null,
    photoFileId: raw.photoFileId ?? null,
    fileId:
      raw.receiptFileId ?? (raw.photoFileId ? null : (raw.fileId ?? null)),
  };
}
