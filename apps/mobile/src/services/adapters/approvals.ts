import { n } from "./row-helpers";

// ─── approvals ───
const KIND_LABEL: Record<string, string> = {
  PENAWARAN: "Penawaran",
  PURCHASE_REQUEST: "Request barang",
  SUPPLIER_PO: "PO supplier",
  INVOICE_IN: "Invoice masuk",
  PENGELUARAN: "Pengeluaran",
  OPNAME: "Opname",
  PERMINTAAN_SURVEY: "Survey",
  SURAT_JALAN: "Surat jalan",
  PENERIMAAN: "Penerimaan",
};
const KIND_MODULE: Record<string, string> = {
  PENAWARAN: "quotations",
  PURCHASE_REQUEST: "purchase-requests",
  SUPPLIER_PO: "supplier-pos",
  INVOICE_IN: "invoices",
  PENGELUARAN: "expenses",
  OPNAME: "opname",
  PERMINTAAN_SURVEY: "surveys",
  SURAT_JALAN: "delivery-notes",
  PENERIMAAN: "receiving",
};
const STATUS_LABEL: Record<string, string> = {
  MENUNGGU: "Menunggu",
  DISETUJUI: "Disetujui",
  DITOLAK: "Ditolak",
};

export type ApprovalRow = {
  id: string;
  jenis: string;
  judul: string;
  pengaju: string;
  nilai: number;
  jam: number;
  module: string;
  refId: string;
  status: "Menunggu" | "Disetujui" | "Ditolak";
  alasan?: string;
  pendingRoles?: string[];
  canApprove?: boolean;
  requestedById?: number | null;
  steps?: any[];
  createdAt?: string | null;
};

export function adaptApproval(raw: any): ApprovalRow {
  const created = raw.createdAt
    ? new Date(raw.createdAt).getTime()
    : Date.now();
  const jam = Math.max(0, Math.round((Date.now() - created) / 3_600_000));
  const pengaju =
    raw.requestedBy?.name ||
    raw.requested_by?.name ||
    (typeof raw.requestedBy === "string" ? raw.requestedBy : "") ||
    (typeof raw.requested_by === "string" ? raw.requested_by : "") ||
    raw.pelapor ||
    raw.pembuat ||
    raw.reporter?.name ||
    raw.creator?.name ||
    raw.requester?.name ||
    "";
  return {
    id: String(raw.id),
    jenis: KIND_LABEL[raw.kind] ?? raw.kind,
    judul: raw.title ?? "",
    pengaju,
    nilai: n(raw.amount),
    jam,
    module: KIND_MODULE[raw.kind] ?? "",
    refId: String(raw.entityId),
    status: (STATUS_LABEL[raw.status] as any) ?? "Menunggu",
    pendingRoles: raw.pendingRoles ?? [],
    canApprove:
      typeof raw.canApprove === "boolean" ? raw.canApprove : undefined,
    requestedById: raw.requestedById ?? raw.requestedBy?.id ?? null,
    steps: Array.isArray(raw.steps) ? raw.steps : [],
    createdAt: raw.createdAt ?? null,
  };
}

export function adaptApprovalList(list: any[] | undefined): ApprovalRow[] {
  return (list ?? []).map(adaptApproval);
}

// ─── notifications ───
