import type { Row, User, Role } from "@/constants/modules";
import { apiBase } from "@/services/api";

export type ApiUser = {
  id: number;
  email: string;
  name: string;
  phone?: string | null;
  position?: string | null;
  department?: string | null;
  role: string;
  status: string;
  warehouseId?: number | null;
  avatarFileId?: number | null;
  lastLoginAt?: string | null;
};

export type Page<T> = { items: T[]; total: number; page: number; limit: number };

export const PATHS: Record<string, string> = {
  leads: "/leads",
  quotations: "/quotations",
  surveys: "/surveys",
  "po-client": "/client-po",
  invoices: "/invoices",
  projects: "/projects",
  tasks: "/tasks",
  "purchase-requests": "/requests",
  "supplier-pos": "/supplier-pos",
  receiving: "/receivings",
  "delivery-notes": "/delivery-notes",
  expenses: "/expenses",
  "damage-reports": "/damages",
  customers: "/customers",
  suppliers: "/suppliers",
  users: "/users",
  "audit-log": "/audit-logs",
  opname: "/opnames",
  warehouses: "/warehouses",
  products: "/products",
  productCategories: "/product-categories",
  leadSources: "/lead-sources",
  lostReasons: "/lost-reasons",
  expenseCategories: "/expense-categories",
  costCenters: "/cost-centers",
  serials: "/serials",
  movements: "/movements",
  reservations: "/reservations",
  followups: "/follow-ups",
  invoiceIn: "/invoice-in",
};

// ─── status label maps (backend enum → UI label) ───
const MAPS: Record<string, Record<string, string>> = {
  leads: {
    PROSPECTING: "Prospecting", QUALIFICATION: "Qualification", PROPOSAL: "Proposal",
    NEGOTIATION: "Negotiation", WON: "Won", LOST: "Lost",
  },
  quotations: {
    NOT_YET: "Not Yet", DONE: "Done", DRAFT: "Draft", PENDING_APPROVAL: "Menunggu persetujuan",
    APPROVED: "Disetujui", REJECTED: "Ditolak", SENT: "Terkirim",
    NEGOTIATION: "Negosiasi", REVISION: "Revisi", EXPIRED: "Kedaluwarsa",
  },
  surveys: { DIMINTA: "Diminta", DIJADWALKAN: "Dijadwalkan", BERJALAN: "Berjalan", SELESAI: "Selesai", BATAL: "Dibatalkan" },
  "po-client": { DITERIMA: "Diterima", DIBATALKAN: "Dibatalkan" },
  invoices: { DRAFT: "Belum dikirim", SENT: "Terkirim", PARTIAL: "Dibayar sebagian", PAID: "Lunas", OVERDUE: "Terlambat", BATAL: "Dibatalkan" },
  projects: {
    DIRENCANAKAN: "Direncanakan", BERJALAN: "Berjalan", DITUNDA: "Ditunda",
    TERLAMBAT: "Terlambat", SELESAI: "Selesai",
  },
  tasks: { TODO: "TODO", IN_PROGRESS: "IN PROGRESS", BLOCKED: "BLOCKED", DONE: "DONE" },
  "purchase-requests": {
    DIAJUKAN: "Diajukan", CEK_STOK: "Cek stok", DISETUJUI: "Disetujui", DITOLAK: "Ditolak",
    PO_DIBUAT: "PO dibuat", DIKIRIM: "Dikirim", DITERIMA: "Diterima", DIBATALKAN: "Dibatalkan",
  },
  "supplier-pos": {
    MENUNGGU_PERSETUJUAN: "Menunggu persetujuan", DISETUJUI: "Disetujui", DITOLAK: "Ditolak", DIBATALKAN: "Dibatalkan",
    BELUM_DIKIRIM: "Di Supplier", DI_SUPPLIER: "Di Supplier", DALAM_PERJALANAN: "Dalam Perjalanan", DIKIRIM: "Dikirim", SAMPAI: "Sampai",
  },
  receiving: { MENUNGGU: "Menunggu penerimaan", DITERIMA_SEBAGIAN: "Diterima sebagian", DITERIMA: "Diterima", DITOLAK: "Ditolak" },
  "delivery-notes": { PENDING: "Pending", DIKIRIM: "Dikirim", DITERIMA: "Diterima", DIBATALKAN: "Dibatalkan" },
  expenses: { DILAPORKAN: "Dilaporkan", DISETUJUI: "Disetujui", DITOLAK: "Ditolak", DIBAYAR: "Dibayar" },
  "damage-reports": { DILAPORKAN: "Dilaporkan", DIPROSES: "Diproses", SELESAI: "Selesai" },
  users: { AKTIF: "Aktif", NONAKTIF: "Nonaktif" },
  opname: { DRAFT: "Draft", MENUNGGU_PERSETUJUAN: "Menunggu persetujuan", DISETUJUI: "Disetujui", DITOLAK: "Ditolak" },
  serials: {
    DI_GUDANG: "Di gudang", RESERVED: "Reserved", DIKIRIM: "Dikirim",
    TERPASANG: "Terpasang", RETUR: "Retur", DIGANTI: "Diganti", RUSAK: "Rusak",
  },
  movements: { IN: "Masuk", OUT: "Keluar", TRANSFER: "Transfer" },
  costType: { PROJECT: "Project", STOK: "Stok", INTERNAL: "Internal", LAINNYA: "Lainnya" },
  clientType: { PARTNER: "Partner", END_USER: "End user" },
  invoiceType: { DP: "DP", TERMIN: "Termin", PELUNASAN: "Pelunasan" },
  projectType: {
    CUSTOMER: "Customer", PRODUCT_RD: "Product/R&D", INTERNAL: "Internal",
    MAINTENANCE: "Maintenance", SUPPORT: "Support", OTHER: "Lainnya",
  },
  paymentStatus: { BELUM_LUNAS: "Belum lunas", LUNAS: "Lunas" },
  damageType: {
    RUSAK: "Rusak", SALAH_BARANG: "Salah barang", KURANG: "Kurang",
  },
  followupMethod: { EMAIL: "Email", TELEPON: "Telepon", WA: "WhatsApp", LAINNYA: "Lainnya" },
  movementCategory: {
    PENERIMAAN_SUPPLIER: "Penerimaan supplier", KELUAR_PROJECT: "Keluar ke project",
    KELUAR_SURAT_JALAN: "Keluar surat jalan", TRANSFER: "Transfer antar gudang",
    RETUR_PROJECT: "Retur dari project", BARANG_TERPAKAI: "Barang terpakai langsung",
    PENGGANTIAN: "Penggantian unit", PENYESUAIAN_OPNAME: "Penyesuaian opname", LAINNYA: "Lainnya",
  },
};

const REVERSE: Record<string, Record<string, string>> = {};
for (const [k, m] of Object.entries(MAPS)) {
  REVERSE[k] = {};
  for (const [enumVal, label] of Object.entries(m)) REVERSE[k][label] = enumVal;
}
REVERSE.quotations = {
  ...REVERSE.quotations,
  Done: "DRAFT",
  Revisi: "NEGOTIATION",
};
REVERSE.damageType = {
  ...REVERSE.damageType,
  "Rusak Fisik": "RUSAK",
  "Cacat Fungsi": "RUSAK",
  "Salah Tipe": "SALAH_BARANG",
  "Kurang Kuantitas": "KURANG",
};
REVERSE.projectType = {
  ...REVERSE.projectType,
  Instalasi: "CUSTOMER",
  Customer: "CUSTOMER",
  Proyek: "CUSTOMER",
  "Product/R&D": "PRODUCT_RD",
  Internal: "INTERNAL",
  Maintenance: "MAINTENANCE",
  Pemeliharaan: "MAINTENANCE",
  Support: "SUPPORT",
  Lainnya: "OTHER",
};

export function toLabel(map: string, v: string | null | undefined): string {
  if (v == null) return "-";
  return MAPS[map]?.[v] ?? v;
}
export function toEnum(map: string, label: string | null | undefined): string {
  if (label == null) return "";
  return REVERSE[map]?.[label] ?? label;
}

const ROLE_UI: Record<string, Role> = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin", BOS: "bos", SALES: "sales", PM: "pm", TEKNISI: "teknisi",
  PROCUREMENT: "procurement", FINANCE: "finance", GUDANG: "gudang", SE: "se",
};
const ROLE_FROM_UI: Record<string, string> = {};
for (const [k, v] of Object.entries(ROLE_UI)) ROLE_FROM_UI[v] = k;

// Form users mengirim label Indonesia (roleLabel) → enum backend.
// "Admin / Bos" dipetakan ke BOS (akses penuh, sesuai makna label gabungan).
const ROLE_FROM_LABEL: Record<string, string> = {
  "Super Admin": "SUPER_ADMIN",
  "Admin / Bos": "BOS",
  Admin: "ADMIN",
  Bos: "BOS",
  Sales: "SALES",
  "Project Manager": "PM",
  Teknisi: "TEKNISI",
  Procurement: "PROCUREMENT",
  Finance: "FINANCE",
  Gudang: "GUDANG",
  "Software Engineer": "SE",
};

export function roleFromUi(role: string): string {
  return ROLE_FROM_LABEL[role] ?? ROLE_FROM_UI[role] ?? "SALES";
}

// Label role untuk ditampilkan (detail/daftar), dihitung dari enum backend.
export function roleLabelOf(role: string | undefined): string {
  const ui = roleToUi(role);
  const entry = Object.entries(ROLE_FROM_LABEL).find(([, v]) => v === (role ?? "").toUpperCase());
  if (entry) return entry[0];
  return ui.charAt(0).toUpperCase() + ui.slice(1);
}
export function roleToUi(role: string | undefined): Role {
  return (role && ROLE_UI[role]) || "sales";
}

export function apiUserToRow(u: ApiUser): User {
  const role = roleToUi(u.role);
  const roleLabel = roleLabelOf(u.role);
  return {
    id: String(u.id),
    name: u.name,
    nama: u.name,
    email: u.email ?? "",
    role,
    roleLabel,
    peran: roleLabel,
    status: u.status ? toLabel("users", u.status) : "Aktif",
    gudang: u.warehouseId != null ? String(u.warehouseId) : "-",
    phone: u.phone ?? "",
    position: u.position ?? "",
    department: u.department ?? "",
    warehouseId: u.warehouseId ?? null,
    avatarFileId: u.avatarFileId ?? null,
    avatarUrl: u.avatarFileId ? `${apiBase()}/files/${u.avatarFileId}` : "",
    lastLoginAt: u.lastLoginAt ?? null,
  } as User;
}

const n = (v: unknown): number => (v == null ? 0 : Number(v));
const s = (v: unknown): string => (v == null ? "" : String(v));
const d = (v: unknown): string => (v ? String(v).slice(0, 10) : "");
const nameOf = (x: any): string => (x?.name ?? "");
const idOf = (x: any): string | null => (x?.id != null ? String(x.id) : null);

export function adaptRow(module: string, raw: any): Row {
  const base: Row = { id: String(raw.id) };
  switch (module) {
    case "leads": {
      const latestFu = raw.followUps?.[0]?.date ?? raw.updatedAt ?? raw.createdAt;
      const sepiDays = latestFu
        ? Math.max(0, Math.floor((Date.now() - new Date(latestFu).getTime()) / 86_400_000))
        : 0;
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
        sepi: sepiDays,
        tipe: toLabel("clientType", raw.clientType),
        kontak: raw.contactName ?? "",
        alasanLost: raw.lostNote ?? nameOf(raw.lostReason),
        need: raw.need ?? "",
        customerId: idOf(raw.customer),
        sourceId: idOf(raw.source),
        ownerId: raw.owner?.id != null ? String(raw.owner.id) : null,
        lostReasonId: raw.lostReason?.id != null ? String(raw.lostReason.id) : null,
        stage: raw.stage,
        penawaranId: raw.quotations?.[0]?.id != null ? String(raw.quotations[0].id) : null,
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
    case "quotations": {
      const hasFile =
        Boolean(raw.latestFileId) ||
        (Array.isArray(raw.items) && raw.items.length > 0) ||
        n(raw._count?.versions) > 0 ||
        (raw.versions?.length ?? 0) > 0 ||
        n(raw.total) > 0;
      const defaultXlsxName = raw.number
        ? `Penawaran-${String(raw.number).replace(/\//g, "-")}.xlsx`
        : "Penawaran.xlsx";
      const fName = raw.latestFileName || (hasFile ? defaultXlsxName : "");
      return {
        ...base,
        nomor: raw.number ?? "",
        lead: nameOf(raw.lead) ?? "",
        leadId: idOf(raw.lead),
        customer: nameOf(raw.customer) ?? "",
        customerId: idOf(raw.customer),
        nilai: n(raw.total),
        total: n(raw.total),
        ppn: n(raw.ppn),
        disc: n(raw.discount),
        totalAfterDisc: n(raw.grandTotal),
        status: toLabel("quotations", raw.status),
        versi: n(raw.currentVersion) || 1,
        berlaku: d(raw.validUntil),
        pemilik: nameOf(raw.owner),
        dibuat: d(raw.createdAt),
        items: Array.isArray(raw.items) ? raw.items : [],
        subject: raw.subject ?? "",
        intro: raw.intro ?? "",
        notesList: Array.isArray(raw.notesList) ? raw.notesList : [],
        city: raw.city ?? "Bekasi",
        kopText: raw.kopText ?? "",
        customerAddress: raw.customerAddress ?? (raw.customer?.address ?? ""),
        signerName: raw.signerName ?? "",
        signerTitle: raw.signerTitle ?? "",
        latestFileId: raw.latestFileId ?? raw.versions?.[0]?.fileId ?? null,
        fileName: fName,
        fileStatus: hasFile ? fName : "Belum diupload",
        fileUploaded: hasFile,
        stage: raw.lead?.stage ?? null,
        _versions: (raw.versions ?? []).map((v: any) => ({
          id: String(v.id),
          v: n(v.version),
          total: n(v.total),
          ppn: n(v.ppn),
          disc: n(v.discount),
          totalAfterDisc: n(v.grandTotal),
          date: d(v.createdAt),
          reason: v.note || `Revisi v${v.version}`,
          file: v.fileId ? `Penawaran-${String(raw.number || "").replace(/\//g, "-")}-v${v.version}.xlsx` : "-",
        })),
      };
    }
    case "surveys":
      return {
        ...base,
        lead: nameOf(raw.lead) ?? "",
        leadId: idOf(raw.lead),
        customer: raw.lead?.customer?.name ?? "",
        lokasi: raw.location ?? "",
        jadwal: d(raw.scheduleAt),
        tim: (raw.members ?? []).map((m: any) => nameOf(m.user)).filter(Boolean).join(", "),
        status: toLabel("surveys", raw.status),
        biaya: n(raw.cost),
        need: raw.need ?? "",
        requester: nameOf(raw.requester) ?? "",
        approval: raw.approval ? adaptApproval(raw.approval) : undefined,
      };
    case "po-client":
      return {
        ...base,
        nomor: raw.number ?? "",
        customer: nameOf(raw.customer) ?? "",
        customerId: idOf(raw.customer),
        penawaran: raw.quotation?.number ?? "-",
        quotationId: idOf(raw.quotation),
        nilai: n(raw.amount),
        totalInvoice: n(raw.invoices?.reduce?.((a: number, b: any) => a + n(b.total), 0) ?? 0),
        tanggal: d(raw.date),
        status: toLabel("po-client", "DITERIMA"),
        fileId: raw.fileId ?? null,
      };
    case "invoices":
      return {
        ...base,
        nomor: raw.number ?? "",
        po: raw.clientPo?.number ?? "-",
        clientPoId: idOf(raw.clientPo),
        customer: nameOf(raw.customer) ?? "",
        customerId: idOf(raw.customer),
        jenis: toLabel("invoiceType", raw.type),
        nilai: n(raw.amount), ppn: n(raw.ppn), total: n(raw.total), terbayar: n(raw.paidAmount),
        jatuhTempo: d(raw.dueDate),
        status: toLabel("invoices", raw.status),
        tanggal: d(raw.date),
        projectId: idOf(raw.project),
        project: nameOf(raw.project) ?? "",
        fileId: raw.fileId ?? null,
        _payments: (raw.payments ?? []).map((p: any) => ({
          id: String(p.id),
          amount: n(p.amount),
          date: d(p.date),
          method: p.method ?? "TRANSFER",
          reference: p.reference ?? "-",
          fileId: p.fileId ?? null,
        })),
      };
    case "projects":
      return {
        ...base,
        nama: raw.name ?? "",
        jenis: toLabel("projectType", raw.type),
        customerId: idOf(raw.customer),
        customer: nameOf(raw.customer) ?? "-",
        pm: nameOf(raw.pic) ?? "",
        pmId: raw.pic?.id != null ? String(raw.pic.id) : null,
        tim: (raw.members ?? []).map((m: any) => nameOf(m.user)).filter(Boolean).join(", ") || "-",
        progres: n(raw.progress),
        pembayaran: toLabel("paymentStatus", raw.paymentStatus),
        status: toLabel("projects", raw.status),
        mulai: d(raw.startDate),
        selesai: d(raw.endDate),
        barang: "-",
        quotationId: idOf(raw.quotation),
        prdFileId: raw.prdFileId ?? null,
        bahpFileId: raw.bahpFileId ?? null,
        bastFileId: raw.bastFileId ?? null,
        doFileId: raw.doFileId ?? null,
        _members: (raw.members ?? []).map((m: any) => ({ id: String(m.userId), name: nameOf(m.user), role: roleToUi(m.user?.role) })),
      };
    case "tasks":
      return {
        ...base,
        project: raw.project?.name ?? "",
        projectId: idOf(raw.project) ?? (raw.projectId != null ? String(raw.projectId) : null),
        parent: raw.parentId != null ? String(raw.parentId) : "",
        parentId: raw.parentId != null ? String(raw.parentId) : null,
        nama: raw.name ?? "",
        pic: nameOf(raw.assignee) ?? "",
        assigneeId: idOf(raw.assignee),
        tenggat: d(raw.dueDate),
        status: toLabel("tasks", raw.status),
        perluBarang: !!raw.needsPurchase,
        progres: n(raw.progress),
        priority: raw.priority,
      };
    case "purchase-requests":
      return {
        ...base,
        nomor: raw.number ?? "",
        tanggal: d(raw.date),
        project: nameOf(raw.project) ?? "-",
        projectId: idOf(raw.project) ?? (raw.projectId != null ? String(raw.projectId) : null),
        jenisBiaya: toLabel("costType", raw.costType),
        pemohon: nameOf(raw.requester) ?? "",
        pemohonId: raw.requester?.id != null ? String(raw.requester.id) : null,
        item: (raw.items ?? [])
          .map((i: any) => `${nameOf(i.product)} x ${n(i.qty)}${i.product?.unit ? ` ${i.product.unit}` : ""}`)
          .join(", ") || raw.purpose || "-",
        estimasi: n(raw.estimatedCost),
        rawStatus: raw.status,
        status: toLabel("purchase-requests", raw.status),
        tujuan: raw.purpose ?? "",
        supplierId: idOf(raw.supplier),
        fileId: raw.evidenceFileId ?? (raw.fileId ?? null),
        rejectReason: raw.rejectReason,
        items: Array.isArray(raw.items) ? raw.items : [],
        stock: Array.isArray(raw.stock) ? raw.stock : [],
        approval: raw.approval ? adaptApproval(raw.approval) : undefined,
      };
    case "supplier-pos":
      return {
        ...base,
        nomor: raw.number ?? "",
        supplier: nameOf(raw.supplier) ?? "",
        supplierId: idOf(raw.supplier),
        pembuat: nameOf(raw.creator) ?? "",
        tanggal: d(raw.date),
        eta: d(raw.eta),
        total: n(raw.total),
        persetujuan: toLabel("supplier-pos", raw.status),
        pengiriman: toLabel("supplier-pos", raw.shipmentStatus),
        status: raw.status === "MENUNGGU_PERSETUJUAN"
          ? "Menunggu persetujuan"
          : raw.status === "DITOLAK" || raw.status === "DIBATALKAN"
            ? toLabel("supplier-pos", raw.status)
            : toLabel("supplier-pos", raw.shipmentStatus),
        item: (raw.items ?? [])
          .map((i: any) => `${nameOf(i.product)} x ${n(i.qty)}`)
          .join(", ") || "-",
        requestId: idOf(raw.request),
        projectId: idOf(raw.project),
        shipmentStatus: raw.shipmentStatus,
        poStatus: raw.status,
        fileId: raw.fileId ?? null,
        doFileId: raw.doFileId ?? null,
      };
    case "receiving":
      return {
        ...base,
        nomor: raw.number ?? "",
        po: raw.supplierPo?.number ?? "",
        supplierPoId: idOf(raw.supplierPo),
        supplier: raw.supplierPo?.supplier?.name ?? "",
        tanggal: d(raw.date),
        penerima: nameOf(raw.receiver) ?? "",
        status: toLabel("receiving", raw.status),
        item: (raw.items ?? []).map((i: any) => `${nameOf(i.product)} x ${n(i.qtyGood)}`).join(", ") || raw.conditionNote || "-",
        warehouseId: idOf(raw.warehouse),
        warehouse: nameOf(raw.warehouse) ?? "",
        projectId: idOf(raw.project),
        conditionNote: raw.conditionNote ?? "",
        _items: raw.items ?? [],
        fileId: raw.receiptFileId ?? (raw.fileId ?? null),
      };
    case "delivery-notes": {
      const loc = raw.locations?.[0];
      return {
        ...base,
        nomor: raw.number ?? "",
        tanggal: d(raw.date),
        tujuan: loc?.destination ?? "-",
        alasan: loc?.reason ?? "-",
        project: nameOf(loc?.project) ?? "-",
        projectId: idOf(loc?.project),
        pembuat: nameOf(raw.creator) ?? "",
        barang: (raw.items ?? []).map((i: any) => `${nameOf(i.product)} x ${n(i.qty)}`).join(", ") || (raw.withGoods ? (raw.reportText || "Membawa barang") : "-"),
        status: toLabel("delivery-notes", raw.status),
        persetujuan: raw.status === "PENDING" ? "Menunggu persetujuan" : "Disetujui",
        withGoods: !!raw.withGoods,
        reportText: raw.reportText ?? "",
        _locations: raw.locations ?? [],
        fileId: raw.scanFileId ?? raw.signedFileId ?? (raw.reportFileId ?? null),
        scanFileId: raw.scanFileId ?? raw.signedFileId ?? null,
        signedFileId: raw.scanFileId ?? raw.signedFileId ?? null,
        reportFileId: raw.reportFileId ?? null,
      };
    }
    case "expenses":
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
        alasan: raw.description ?? "",
        status: toLabel("expenses", raw.status),
        costCenterId: idOf(raw.costCenter),
        receiptFileId: raw.receiptFileId ?? (raw.receiptFile?.id ?? (raw.fileId ?? null)),
        receiptFile: raw.receiptFile ?? null,
        paidFileId: raw.paidFileId ?? (raw.paidFile?.id ?? null),
        paidFile: raw.paidFile ?? null,
        fileId: raw.receiptFileId ?? (raw.receiptFile?.id ?? (raw.fileId ?? null)),
      };
    case "damage-reports":
      return {
        ...base,
        tanggal: d(raw.date),
        produk: nameOf(raw.product) ?? "",
        productId: idOf(raw.product),
        jenis: toLabel("damageType", raw.type),
        po: raw.serialUnit?.sn ?? "",
        pelapor: nameOf(raw.reporter) ?? "",
        status: toLabel("damage-reports", raw.status),
        keterangan: raw.description ?? "",
        qty: n(raw.qty),
        fileId: raw.fileId ?? null,
      };
    case "customers":
      return {
        ...base,
        nama: raw.name ?? "",
        kota: raw.city ?? "",
        kontak: raw.pic ?? "",
        email: raw.email ?? "",
        telepon: raw.phone ?? "",
        catatan: raw.notes ?? "",
        status: toLabel("users", raw.status),
      };
    case "suppliers":
      return {
        ...base,
        nama: raw.name ?? "",
        kota: raw.city ?? "",
        kontak: raw.pic ?? "",
        email: raw.email ?? "",
        telepon: raw.phone ?? "",
        payment: raw.paymentTerms ?? "",
        catatan: raw.notes ?? "",
        status: toLabel("users", raw.status),
      };
    case "users": {
      const row = apiUserToRow(raw);
      row.gudang = nameOf(raw.warehouse) || (raw.warehouseId != null ? String(raw.warehouseId) : "-");
      return row;
    }
    case "audit-log":
      return {
        ...base,
        waktu: raw.createdAt ?? raw.timestamp ?? "",
        pengguna: raw.actorName ?? raw.actor?.name ?? "",
        aksi: raw.action ?? "",
        jenis: raw.entityType ?? "",
        refId: raw.entityId != null ? String(raw.entityId) : "",
        detail: raw.detail ?? "",
      };
    case "opname": {
      const diffSum = (raw.details ?? []).reduce(
        (a: number, x: any) => a + (n(x.countedQty) - n(x.systemQty ?? x.expectedQty ?? 0)),
        0,
      );
      return {
        ...base,
        tanggal: d(raw.date),
        gudang: nameOf(raw.warehouse) ?? "",
        warehouseId: idOf(raw.warehouse),
        petugas: nameOf(raw.conductor) ?? "",
        selisih: diffSum === 0 ? "0 SKU (Cocok)" : `${diffSum > 0 ? "+" : ""}${diffSum} SKU`,
        status: toLabel("opname", raw.status),
        alasan: raw.reason ?? "",
        _details: raw.details ?? [],
      };
    }
    case "warehouses":
      return { ...base, nama: raw.name ?? "", kota: raw.city ?? "", staf: "-", status: toLabel("users", raw.status) };
    case "products":
      return {
        ...base, sku: raw.sku ?? "", nama: raw.name ?? "", satuan: raw.unit ?? "",
        berSN: !!raw.hasSerial, garansi: raw.warrantyMonths != null ? `${raw.warrantyMonths} bln` : "-",
        min: n(raw.minStock), hargaBeli: n(raw.purchasePrice),
        kategori: nameOf(raw.category) ?? "",
        categoryId: idOf(raw.category),
        status: toLabel("users", raw.status),
      };
    case "productCategories":
      return { ...base, nama: raw.name ?? "", deskripsi: raw.description ?? "", prefix: raw.prefix ?? "", status: toLabel("users", raw.status) };
    case "leadSources":
    case "lostReasons":
    case "expenseCategories":
    case "costCenters":
      return { ...base, nama: raw.name ?? "", status: toLabel("users", raw.status ?? "AKTIF") };
    case "serials":
      return {
        ...base,
        sn: raw.sn ?? "",
        sku: raw.product?.sku ?? "",
        produk: nameOf(raw.product) ?? "",
        productId: idOf(raw.product),
        gudang: nameOf(raw.warehouse) ?? "-",
        warehouseId: idOf(raw.warehouse),
        project: nameOf(raw.project) ?? "-",
        projectId: idOf(raw.project),
        status: toLabel("serials", raw.status),
        garansiMulai: d(raw.warrantyStart),
        garansiBerakhir: d(raw.warrantyEnd),
        digantiDengan: raw.replacedBy?.sn ?? raw.replacedTo ?? "",
      };
    case "movements": {
      const tLabel = toLabel("movements", raw.type);
      const gudangLabel =
        raw.type === "TRANSFER"
          ? `${nameOf(raw.fromWarehouse) || "-"} → ${nameOf(raw.toWarehouse) || "-"}`
          : nameOf(raw.toWarehouse) || nameOf(raw.fromWarehouse) || "-";
      return {
        ...base,
        waktu: raw.date ? String(raw.date).replace("T", " ").slice(0, 16) : d(raw.createdAt),
        jenis: tLabel,
        kategori: toLabel("movementCategory", raw.category),
        produk: nameOf(raw.product) ?? "",
        productId: idOf(raw.product),
        qty: n(raw.qty),
        gudang: gudangLabel,
        project: nameOf(raw.project) ?? "-",
        projectId: idOf(raw.project),
        sn: raw.snList ?? "-",
        catatan: raw.note ?? "-",
        oleh: nameOf(raw.creator) ?? "-",
      };
    }
    case "reservations":
      return {
        ...base,
        project: nameOf(raw.project) ?? "-",
        projectId: idOf(raw.project),
        produk: nameOf(raw.product) ?? "-",
        productId: idOf(raw.product),
        sku: raw.product?.sku ?? "",
        sn: raw.serialUnit?.sn ?? "-",
        serialUnitId: idOf(raw.serialUnit),
        qty: n(raw.qty),
        status: raw.releasedAt ? "Dirilis" : "Aktif",
        tanggal: d(raw.createdAt),
      };
    case "followups":
      return {
        ...base,
        leadId: raw.leadId != null ? String(raw.leadId) : idOf(raw.lead),
        lead: nameOf(raw.lead) ?? "",
        quotationId: raw.quotationId != null ? String(raw.quotationId) : null,
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
    case "invoiceIn":
      return {
        ...base,
        nomor: raw.number ?? "",
        supplier: nameOf(raw.supplier) ?? "",
        supplierId: idOf(raw.supplier),
        po: raw.supplierPo?.number ?? "-",
        supplierPoId: idOf(raw.supplierPo),
        nilai: n(raw.amount),
        ppn: n(raw.ppn),
        total: n(raw.total),
        terbayar: n(raw.paidAmount),
        tanggal: d(raw.date),
        jatuhTempo: d(raw.dueDate),
        status: raw.status ?? "UNPAID",
        _payments: (raw.payments ?? []).map((p: any) => ({
          id: String(p.id),
          amount: n(p.amount),
          date: d(p.date),
          method: p.method ?? "TRANSFER",
          reference: p.reference ?? "-",
          fileId: p.fileId ?? null,
        })),
      };
    default:
      return { ...base, ...raw };
  }
}

export function adaptRows(module: string, list: any[] | undefined): Row[] {
  return (list ?? []).map((r) => adaptRow(module, r));
}

// ─── approvals ───
const KIND_LABEL: Record<string, string> = {
  PENAWARAN: "Penawaran", PURCHASE_REQUEST: "Request barang", SUPPLIER_PO: "PO supplier",
  INVOICE_IN: "Invoice masuk", PENGELUARAN: "Pengeluaran", OPNAME: "Opname",
  PERMINTAAN_SURVEY: "Survey", SURAT_JALAN: "Surat jalan", PENERIMAAN: "Penerimaan",
};
const KIND_MODULE: Record<string, string> = {
  PENAWARAN: "quotations", PURCHASE_REQUEST: "purchase-requests", SUPPLIER_PO: "supplier-pos",
  INVOICE_IN: "invoices", PENGELUARAN: "expenses", OPNAME: "opname",
  PERMINTAAN_SURVEY: "surveys", SURAT_JALAN: "delivery-notes", PENERIMAAN: "receiving",
};
const STATUS_LABEL: Record<string, string> = { MENUNGGU: "Menunggu", DISETUJUI: "Disetujui", DITOLAK: "Ditolak" };

export type ApprovalRow = {
  id: string; jenis: string; judul: string; pengaju: string; nilai: number;
  jam: number; module: string; refId: string; status: "Menunggu" | "Disetujui" | "Ditolak";
  alasan?: string; pendingRoles?: string[];
};

export function adaptApproval(raw: any): ApprovalRow {
  const created = raw.createdAt ? new Date(raw.createdAt).getTime() : Date.now();
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
  };
}

export function adaptApprovalList(list: any[] | undefined): ApprovalRow[] {
  return (list ?? []).map(adaptApproval);
}

// ─── notifications ───
export type NotifRow = {
  id: string;
  jenis: "approval" | "stok" | "pengiriman" | "lead" | "tugas" | "surat";
  teks: string;
  waktu: string;
  baca: boolean;
  href: string;
  roles: Role[] | "all";
};

const NOTIF_KIND: Record<string, NotifRow["jenis"]> = {
  APPROVAL: "approval", STOK: "stok", PENGIRIMAN: "pengiriman", LEAD: "lead",
  TUGAS: "tugas", SURAT: "surat", LAINNYA: "approval",
};

/** Normalisasi href notifikasi dari backend agar sesuai dengan route Expo Router di mobile/web. */
export function normalizeNotifHref(href: string | null | undefined): string {
  if (!href) return "/";
  let h = href.trim();
  if (h.startsWith("/requests/")) {
    h = h.replace(/^\/requests\//, "/purchase-requests/");
  } else if (h.startsWith("/procurement/po/")) {
    h = h.replace(/^\/procurement\/po\//, "/supplier-pos/");
  } else if (h.startsWith("/receivings/")) {
    h = h.replace(/^\/receivings\//, "/receiving/");
  } else if (h.startsWith("/stock/opnames")) {
    h = "/stock";
  } else if (h.startsWith("/invoice-in/")) {
    h = "/supplier-pos";
  } else if (/^\/projects\/\d+\/tasks\/\d+/.test(h)) {
    const taskId = h.split("/").pop();
    h = `/tasks/${taskId}`;
  }
  return h;
}

export function adaptNotif(raw: any): NotifRow {
  return {
    id: String(raw.id),
    jenis: NOTIF_KIND[raw.kind] ?? "approval",
    teks: raw.text ?? raw.message ?? "",
    waktu: raw.createdAt ?? "",
    baca: !!raw.read,
    href: normalizeNotifHref(raw.href),
    roles: "all",
  };
}

export function adaptNotifList(list: any[] | undefined): NotifRow[] {
  return (list ?? []).map(adaptNotif);
}

function findId(list: any[] | undefined, val: any): number | undefined {
  if (val == null || val === "" || val === "-") return undefined;
  const sVal = String(val).trim();
  if (!sVal) return undefined;
  if (Array.isArray(list)) {
    const cleanVal = (sVal.split("(")[0] ?? sVal).trim().toLowerCase();
    const match = list.find((r) => {
      const candidates = [r.nama, r.name, r.nomor, r.number, r.sku].filter(Boolean);
      return candidates.some((c) => {
        const sc = String(c).trim().toLowerCase();
        return sc === sVal.toLowerCase() || sc === cleanVal;
      });
    });
    if (match?.id != null) return Number(match.id);
  }
  const numVal = Number(sVal);
  if (!Number.isNaN(numVal) && numVal > 0 && /^\d+$/.test(sVal)) return numVal;
  return undefined;
}

function resolveMemberIds(row: Record<string, any>, db?: Record<string, any>): number[] | undefined {
  if (Array.isArray(row.memberIds)) return row.memberIds.map(Number).filter((x) => !Number.isNaN(x) && x > 0);
  if (row.tim) {
    const names = String(row.tim)
      .split(",")
      .map((s) => (s.split("(")[0] ?? "").trim().toLowerCase())
      .filter(Boolean);
    const ids = (db?.users ?? [])
      .filter((u: any) => names.includes(String(u.name ?? u.nama ?? "").trim().toLowerCase()))
      .map((u: any) => Number(u.id))
      .filter((x: number) => !Number.isNaN(x) && x > 0);
    return ids.length ? ids : undefined;
  }
  return undefined;
}

// ─── create DTO builders (UI row → backend body) ───
export function buildCreateBody(module: string, row: Record<string, any>, db?: Record<string, any>): Record<string, any> {
  const num = (v: any) => Number(String(v ?? 0).replace(/[^\d.-]/g, "")) || 0;
  const today = new Date().toISOString().slice(0, 10);
  switch (module) {
    case "leads":
      return {
        name: row.nama ?? row.name ?? "Lead Baru",
        customerId: row.customerId != null && row.customerId !== "" ? Number(row.customerId) : findId(db?.customers, row.perusahaan ?? row.customer),
        sourceId: row.sourceId != null && row.sourceId !== "" ? Number(row.sourceId) : findId(db?.leadSources, row.sumber),
        clientType: row.tipe ? (toEnum("clientType", row.tipe) || "END_USER") : "END_USER",
        estimatedValue: num(row.nilai ?? row.estimatedValue),
        probability: num(row.peluang ?? row.probability) || 20,
        targetClosing: row.closing || row.targetClosing || undefined,
        contactName: row.kontak && row.kontak !== "-" ? row.kontak : undefined,
        need: row.need || row.catatan || undefined,
        ownerId: row.ownerId != null && row.ownerId !== "" ? Number(row.ownerId) : findId(db?.users, row.pemilik),
        stage: row.status ? (toEnum("leads", row.status) || "PROSPECTING") : "PROSPECTING",
        fileId: row.fileId != null && row.fileId !== "" ? Number(row.fileId) : undefined,
      };
    case "quotations": {
      const tot = num(row.total ?? row.nilai);
      const disc = num(row.disc ?? row.discount);
      const net = Math.max(0, tot - disc);
      const tipe = String(row.tipePpn || "");
      let ppn: number;
      let grand: number;
      if (tipe.toLowerCase().includes("no") || tipe.toLowerCase().includes("tanpa")) {
        ppn = 0;
        grand = net;
      } else if (tipe.toLowerCase().includes("include")) {
        ppn = Math.round(net - (net / 1.11));
        grand = net;
      } else {
        ppn = row.ppn != null ? num(row.ppn) : Math.round(net * 0.11);
        grand = num(row.totalAfterDisc ?? row.grandTotal) || (net + ppn);
      }
      return {
        leadId: row.leadId != null && row.leadId !== "" ? Number(row.leadId) : findId(db?.leads, row.lead),
        customerId: row.customerId != null && row.customerId !== "" ? Number(row.customerId) : findId(db?.customers, row.customer ?? row.perusahaan),
        total: tot,
        ppn,
        discount: disc,
        grandTotal: grand,
        validUntil: row.berlaku || row.validUntil || undefined,
        fileId: row.fileId ? Number(row.fileId) : undefined,
        notes: row.notes ?? row.catatan ?? undefined,
        status: row.status ? (toEnum("quotations", row.status) || "DRAFT") : "DRAFT",
      };
    }
    case "surveys": {
      const leadId =
        row.leadId != null && row.leadId !== ""
          ? Number(row.leadId)
          : findId(db?.leads, row.lead) ?? (db?.leads?.[0]?.id != null ? Number(db.leads[0].id) : undefined);
      return {
        leadId,
        location: row.lokasi || row.location || "-",
        scheduleAt: row.jadwal || row.scheduleAt || today,
        need: row.need || row.lead || undefined,
        notes: row.catatanTeknis || row.catatan || row.notes || undefined,
        cost: row.biaya != null ? num(row.biaya) : undefined,
        memberIds: resolveMemberIds(row, db),
      };
    }
    case "customers":
      return {
        name: row.nama ?? row.name,
        city: row.kota ?? row.city ?? undefined,
        pic: row.kontak ?? row.pic ?? "-",
        email: row.email && row.email !== "-" ? row.email : undefined,
        phone: row.telepon || row.phone || undefined,
        notes: row.catatan && row.catatan !== "-" ? row.catatan : undefined,
        status: "AKTIF",
      };
    case "suppliers":
      return {
        name: row.nama ?? row.name,
        city: row.kota ?? row.city ?? undefined,
        pic: row.kontak || row.pic || undefined,
        email: row.email || undefined,
        phone: row.telepon || row.phone || undefined,
        paymentTerms: row.payment || row.paymentTerms || undefined,
        notes: row.catatan || row.notes || undefined,
        status: "AKTIF",
      };
    case "users":
      return {
        name: row.name ?? row.nama,
        email: row.email,
        password: row.password || "taska123",
        role: roleFromUi(row.role ?? row.roleLabel),
        phone: row.phone || row.telepon || undefined,
        position: row.position || row.jabatan || undefined,
        department: row.department || row.divisi || undefined,
        warehouseId: row.warehouseId != null && row.warehouseId !== "" ? Number(row.warehouseId) : findId(db?.warehouses, row.gudang),
        status: "AKTIF",
      };
    case "projects": {
      const allowedTypes = ["CUSTOMER", "PRODUCT_RD", "INTERNAL", "MAINTENANCE", "SUPPORT", "OTHER"];
      const rawType = row.jenis ?? row.type;
      const mappedType = toEnum("projectType", rawType);
      const safeType = allowedTypes.includes(mappedType) ? mappedType : "CUSTOMER";
      const custId = row.customerId != null && row.customerId !== ""
        ? Number(row.customerId)
        : findId(db?.customers, row.customer ?? row.perusahaan);
      const custObj = db?.customers?.find((c: any) => c.id === custId || c.nama === (row.customer ?? row.perusahaan));
      const custName = custObj?.nama || row.customer || row.perusahaan || "Customer";
      const rawProjName = row.nama ?? row.name;
      const projName = rawProjName && !String(rawProjName).includes("undefined")
        ? rawProjName
        : `Project ${custName}`;

      return {
        name: projName,
        type: safeType,
        customerId: custId,
        startDate: row.mulai || row.startDate || today,
        endDate: row.selesai || row.endDate || undefined,
        status: "BERJALAN",
        progress: num(row.progres ?? row.progress),
        picId: row.pmId != null && row.pmId !== "" ? Number(row.pmId) : findId(db?.users, row.pm),
        prdFileId: row.prdFileId ?? (row.fileId ? Number(row.fileId) : undefined),
        memberIds: resolveMemberIds(row, db),
      };
    }
    case "tasks":
      return {
        name: row.nama ?? row.name ?? "Tugas Baru",
        parentId: row.parentId != null && row.parentId !== "" ? Number(row.parentId) : undefined,
        assigneeId: row.assigneeId != null && row.assigneeId !== "" ? Number(row.assigneeId) : findId(db?.users, row.pic),
        dueDate: row.tenggat || row.dueDate || undefined,
        priority: row.priority || undefined,
        status: row.status ? (toEnum("tasks", row.status) || row.status.replace(" ", "_")) : "TODO",
        progress: num(row.progres ?? row.progress),
        needsPurchase: !!(row.perluBarang ?? row.needsPurchase),
      };
    case "po-client":
      return {
        number: row.nomor || row.number || undefined,
        customerId:
          row.customerId != null && row.customerId !== ""
            ? Number(row.customerId)
            : findId(db?.customers, row.customer) ?? (db?.customers?.[0]?.id != null ? Number(db.customers[0].id) : undefined),
        amount: num(row.nilai ?? row.amount),
        date: row.tanggal || row.date || today,
        quotationId: row.quotationId != null && row.quotationId !== "" ? Number(row.quotationId) : findId(db?.quotations, row.penawaran),
        fileId: row.fileId ? Number(row.fileId) : undefined,
        notes: row.catatan || row.notes || undefined,
      };
    case "invoices": {
      const amt = num(row.nilai ?? row.amount);
      const ppn = row.ppn != null ? num(row.ppn) : Math.round(amt * 0.11);
      const tot = num(row.total) || amt + ppn;
      return {
        number: row.nomor || row.number || undefined,
        customerId:
          row.customerId != null && row.customerId !== ""
            ? Number(row.customerId)
            : findId(db?.customers, row.customer) ?? (db?.customers?.[0]?.id != null ? Number(db.customers[0].id) : undefined),
        clientPoId: row.clientPoId != null && row.clientPoId !== "" ? Number(row.clientPoId) : findId(db?.["po-client"], row.po),
        projectId: row.projectId != null && row.projectId !== "" ? Number(row.projectId) : findId(db?.projects, row.project),
        type: row.jenis ? (toEnum("invoiceType", row.jenis) || "TERMIN") : "TERMIN",
        amount: amt,
        ppn,
        total: tot,
        date: row.tanggal || row.date || today,
        dueDate: row.jatuhTempo || row.dueDate || new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
        fileId: row.fileId ? Number(row.fileId) : undefined,
        status: "DRAFT",
      };
    }
    case "purchase-requests":
      return {
        date: row.tanggal || row.date || today,
        costType: String(toEnum("costType", row.costType || row.jenisBiaya) || row.costType || row.jenisBiaya || "STOK").toUpperCase(),
        projectId: row.projectId != null && row.projectId !== "" ? Number(row.projectId) : findId(db?.projects, row.project),
        supplierId: row.supplierId != null && row.supplierId !== "" ? Number(row.supplierId) : findId(db?.suppliers, row.supplier),
        purpose: row.purpose || row.tujuan || row.item || "Kebutuhan operasional",
        otherNote: row.otherNote || row.catatan || undefined,
        evidenceFileId: row.evidenceFileId ?? (row.fileId ? Number(row.fileId) : undefined),
        items: Array.isArray(row.items) && row.items.length ? row.items : undefined,
      };
    case "supplier-pos":
      return {
        number: row.nomor || row.number || undefined,
        supplierId: row.supplierId != null && row.supplierId !== "" ? Number(row.supplierId) : findId(db?.suppliers, row.supplier),
        requestId: row.requestId != null && row.requestId !== "" ? Number(row.requestId) : findId(db?.["purchase-requests"], row.request),
        projectId: row.projectId != null && row.projectId !== "" ? Number(row.projectId) : findId(db?.projects, row.project),
        date: row.tanggal || row.date || today,
        eta: row.eta || undefined,
        paymentTerms: row.payment || row.paymentTerms || undefined,
        total: num(row.total),
        fileId: row.fileId ? Number(row.fileId) : undefined,
        items: Array.isArray(row.items) && row.items.length ? row.items : undefined,
      };
    case "receiving":
      return {
        supplierPoId: row.supplierPoId != null && row.supplierPoId !== "" ? Number(row.supplierPoId) : findId(db?.["supplier-pos"], row.po),
        warehouseId: row.warehouseId != null && row.warehouseId !== "" ? Number(row.warehouseId) : findId(db?.warehouses, row.gudang ?? row.warehouse),
        date: row.tanggal || row.date || today,
        conditionNote: row.conditionNote || row.catatan || row.item || undefined,
        receiptFileId: row.receiptFileId ?? (row.fileId ? Number(row.fileId) : undefined),
        items: Array.isArray(row.items) && row.items.length ? row.items : undefined,
      };
    case "delivery-notes":
      return {
        number: row.nomor || row.number || undefined,
        date: row.tanggal || row.date || today,
        withGoods: row.withGoods ?? !!(row.barang && row.barang !== "-"),
        locations:
          Array.isArray(row.locations) && row.locations.length
            ? row.locations
            : [
                {
                  destination: row.tujuan || "-",
                  reason: row.alasan || "Dinas luar",
                  projectId: row.projectId != null && row.projectId !== "" ? Number(row.projectId) : findId(db?.projects, row.project),
                },
              ],
        reportText: row.reportText || (row.barang && row.barang !== "-" ? String(row.barang) : undefined),
        scanFileId: row.scanFileId ?? (row.fileId ? Number(row.fileId) : undefined),
        reportFileId: row.reportFileId ? Number(row.reportFileId) : undefined,
      };
    case "expenses":
      return {
        date: row.tanggal || row.date || today,
        categoryId: row.categoryId != null && row.categoryId !== "" ? Number(row.categoryId) : findId(db?.expenseCategories, row.kategori),
        amount: num(row.nominal ?? row.amount),
        description: row.alasan || row.description || "Pengeluaran operasional",
        projectId:
          row.projectId != null && row.projectId !== "" && row.projectId !== "-"
            ? Number(row.projectId)
            : row.project && row.project !== "-"
            ? findId(db?.projects, row.project)
            : undefined,
        surveyId:
          row.surveyId != null && row.surveyId !== "" && row.surveyId !== "-"
            ? Number(row.surveyId)
            : row.survey && row.survey !== "-"
            ? Number(String(row.survey).match(/#(\d+)/)?.[1] || findId(db?.surveys, row.survey)) || undefined
            : undefined,
        costCenterId: row.costCenterId != null && row.costCenterId !== "" ? Number(row.costCenterId) : findId(db?.costCenters, row.costCenter),
        receiptFileId: row.receiptFileId ?? (row.fileId ? Number(row.fileId) : undefined),
      };
    case "damage-reports":
      return {
        date: row.tanggal || row.date || today,
        productId: row.productId != null && row.productId !== "" ? Number(row.productId) : findId(db?.products, row.produk),
        type: toEnum("damageType", row.jenis) || "RUSAK",
        qty: num(row.qty) || 1,
        description: row.keterangan || row.description || "-",
        fileId: row.fileId ? Number(row.fileId) : undefined,
      };
    case "productCategories":
      return { name: row.nama ?? row.name, description: row.deskripsi || row.description || undefined, prefix: row.prefix || undefined, status: "AKTIF" };
    case "warehouses":
      return { name: row.nama ?? row.name, city: row.kota || row.city || undefined, status: "AKTIF" };
    case "products":
      return {
        sku: row.sku,
        name: row.nama ?? row.name,
        unit: row.satuan ?? row.unit,
        categoryId: row.categoryId != null && row.categoryId !== "" ? Number(row.categoryId) : findId(db?.productCategories, row.kategori),
        hasSerial: row.berSN != null ? !!row.berSN : !!row.hasSerial,
        minStock: num(row.min ?? row.minStock),
        warrantyMonths: row.garansi ? parseInt(String(row.garansi), 10) || undefined : undefined,
        purchasePrice: num(row.hargaBeli ?? row.purchasePrice),
        status: "AKTIF",
      };
    case "leadSources":
    case "lostReasons":
    case "expenseCategories":
    case "costCenters":
      return { name: row.nama ?? row.name, status: "AKTIF" };
    case "followups": {
      const mRaw = String(row.method ?? row.metode ?? "WA").toUpperCase();
      const method =
        mRaw.includes("WA") || mRaw.includes("WHATSAPP")
          ? "WA"
          : mRaw.includes("TEL") || mRaw.includes("CALL")
            ? "TELEPON"
            : mRaw.includes("EMAIL")
              ? "EMAIL"
              : "LAINNYA";
      const nextD = row.nextDate ?? row.nextAction ?? row.berikutnya;
      const validNext = nextD && /^\d{4}-\d{2}-\d{2}/.test(String(nextD)) ? String(nextD).slice(0, 10) : undefined;
      return {
        leadId: row.leadId != null && row.leadId !== "" ? Number(row.leadId) : undefined,
        quotationId: row.quotationId != null && row.quotationId !== "" ? Number(row.quotationId) : undefined,
        date: row.date || row.tanggal || today,
        method,
        notes: row.notes || row.catatan || "-",
        nextDate: validNext,
        status: row.status || "SELESAI",
      };
    }
    case "invoiceIn": {
      const amt = num(row.nilai ?? row.amount);
      const ppn = row.ppn != null ? num(row.ppn) : Math.round(amt * 0.11);
      const tot = num(row.total) || amt + ppn;
      return {
        number: row.nomor || row.number || `INV-SUP-${Date.now().toString().slice(-5)}`,
        supplierId: row.supplierId != null && row.supplierId !== "" ? Number(row.supplierId) : findId(db?.suppliers, row.supplier),
        supplierPoId: row.supplierPoId != null && row.supplierPoId !== "" ? Number(row.supplierPoId) : findId(db?.["supplier-pos"], row.po),
        amount: amt,
        ppn,
        total: tot,
        date: row.tanggal || row.date || today,
        dueDate: row.jatuhTempo || row.dueDate || new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
        fileId: row.fileId ? Number(row.fileId) : undefined,
      };
    }
    default:
      return row;
  }
}

/** Kolom yang boleh dikirim saat PATCH — hindari 400 forbidNonWhitelisted
 *  karena field create-only (status AKTIF, progress 0, stage, dll) ikut terkirim. */
const PATCH_FIELDS: Record<string, readonly string[]> = {
  users: ["name", "email", "password", "phone", "position", "department", "role", "status", "warehouseId"],
  customers: ["name", "company", "pic", "email", "phone", "address", "city", "notes", "status"],
  suppliers: ["name", "pic", "email", "phone", "city", "paymentTerms", "notes", "status"],
  products: ["sku", "name", "type", "categoryId", "unit", "hasSerial", "minStock", "warrantyMonths", "purchasePrice", "status"],
  productCategories: ["name", "description", "prefix", "status"],
  warehouses: ["name", "city", "status"],
  leadSources: ["name", "status"],
  lostReasons: ["name", "status"],
  expenseCategories: ["name", "status"],
  costCenters: ["name", "status"],
  leads: ["name", "customerId", "sourceId", "clientType", "need", "contactName", "estimatedValue", "probability", "targetClosing", "ownerId", "needsSurvey", "stage", "lostReasonId", "lostNote", "fileId"],
  surveys: ["leadId", "location", "need", "notes", "scheduleAt", "cost", "status", "memberIds"],
  quotations: [
    "leadId",
    "customerId",
    "validUntil",
    "discount",
    "ppn",
    "total",
    "grandTotal",
    "notes",
    "status",
    "fileId",
    "items",
    "subject",
    "intro",
    "notesList",
    "city",
    "kopText",
    "customerAddress",
    "signerName",
    "signerTitle",
  ],
  projects: ["name", "type", "customerId", "picId", "quotationId", "startDate", "endDate", "status", "progress", "prdFileId", "bahpFileId", "bastFileId", "doFileId", "notes", "memberIds"],
  tasks: ["name", "parentId", "assigneeId", "dueDate", "priority", "status", "progress", "needsPurchase", "bahpFileId", "bastFileId", "doFileId"],
  "po-client": ["number", "customerId", "quotationId", "amount", "date", "fileId", "notes"],
  invoices: ["number", "clientPoId", "projectId", "customerId", "description", "type", "amount", "ppn", "total", "date", "dueDate", "status", "fileId"],
  expenses: ["date", "categoryId", "amount", "description", "projectId", "surveyId", "deliveryNoteId", "costCenterId", "receiptFileId", "paidFileId"],
  "supplier-pos": ["number", "supplierId", "requestId", "projectId", "date", "eta", "paymentTerms", "total", "fileId", "doFileId", "items"],
  "purchase-requests": ["date", "costType", "projectId", "taskId", "supplierId", "condition", "purpose", "otherNote", "evidenceFileId", "items"],
  receiving: ["supplierPoId", "warehouseId", "projectId", "date", "conditionNote", "receiptFileId", "items"],
  "delivery-notes": ["number", "date", "withGoods", "locations", "items", "scanFileId", "signedFileId", "reportFileId", "reportText"],
  "damage-reports": ["date", "productId", "serialUnitId", "warehouseId", "receivingId", "type", "qty", "description", "fileId"],
  followups: ["method", "notes", "date", "nextDate", "status"],
};

/** Hapus field yang tidak dikenal DTO update agar tidak 400. */
export function forPatch(module: string, body: Record<string, any>): Record<string, any> {
  const allow = PATCH_FIELDS[module];
  if (!allow) return body;
  const out: Record<string, any> = {};
  for (const k of allow) if (body[k] !== undefined) out[k] = body[k];
  return out;
}

/** Konversi partial patch UI → partial DTO backend tanpa menyuntikkan default create. */
export function buildPatchBody(module: string, patch: Record<string, any>, db?: Record<string, any>): Record<string, any> {
  const num = (v: any) => Number(String(v ?? 0).replace(/[^\d.-]/g, "")) || 0;
  const out: Record<string, any> = {};

  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) out[k] = v;
  }

  if (patch.nama !== undefined) out.name = patch.nama;
  if (patch.kota !== undefined) out.city = patch.kota;
  if (patch.kontak !== undefined) {
    if (module === "leads") out.contactName = patch.kontak;
    else out.pic = patch.kontak;
  }
  if (patch.telepon !== undefined) out.phone = patch.telepon;
  if (patch.catatan !== undefined) {
    if (module === "receiving") out.conditionNote = patch.catatan;
    else if (module === "purchase-requests") out.otherNote = patch.catatan;
    else out.notes = patch.catatan;
  }
  if (patch.catatanTeknis !== undefined) out.notes = patch.catatanTeknis;
  if (patch.deskripsi !== undefined) out.description = patch.deskripsi;
  if (patch.keterangan !== undefined) out.description = patch.keterangan;
  if (patch.alasan !== undefined && module === "expenses") out.description = patch.alasan;
  if (patch.tujuan !== undefined && module === "purchase-requests") out.purpose = patch.tujuan;
  if (patch.nomor !== undefined) out.number = patch.nomor;
  if (patch.tanggal !== undefined) out.date = patch.tanggal;
  if (patch.jadwal !== undefined) out.scheduleAt = patch.jadwal;
  if (patch.lokasi !== undefined) out.location = patch.lokasi;
  if (patch.biaya !== undefined) out.cost = num(patch.biaya);
  if (patch.nominal !== undefined) out.amount = num(patch.nominal);
  if (patch.satuan !== undefined) out.unit = patch.satuan;
  if (patch.berSN !== undefined) out.hasSerial = !!patch.berSN;
  if (patch.min !== undefined) out.minStock = num(patch.min);
  if (patch.hargaBeli !== undefined) out.purchasePrice = num(patch.hargaBeli);
  if (patch.garansi !== undefined) out.warrantyMonths = parseInt(String(patch.garansi), 10) || undefined;
  if (patch.payment !== undefined) out.paymentTerms = patch.payment;

  if (patch.fileId !== undefined) {
    if (module === "expenses") out.receiptFileId = patch.fileId ? Number(patch.fileId) : null;
    else if (module === "purchase-requests") out.evidenceFileId = patch.fileId ? Number(patch.fileId) : null;
    else if (module === "receiving") out.receiptFileId = patch.fileId ? Number(patch.fileId) : null;
    else if (module === "delivery-notes") out.signedFileId = patch.fileId ? Number(patch.fileId) : null;
    else out.fileId = patch.fileId ? Number(patch.fileId) : null;
  }
  if (patch.receiptFileId !== undefined) out.receiptFileId = patch.receiptFileId ? Number(patch.receiptFileId) : null;
  if (patch.paidFileId !== undefined) out.paidFileId = patch.paidFileId ? Number(patch.paidFileId) : null;
  if (patch.evidenceFileId !== undefined) out.evidenceFileId = patch.evidenceFileId ? Number(patch.evidenceFileId) : null;
  if (patch.signedFileId !== undefined) out.signedFileId = patch.signedFileId ? Number(patch.signedFileId) : null;
  if (patch.reportFileId !== undefined) out.reportFileId = patch.reportFileId ? Number(patch.reportFileId) : null;

  if (module === "expenses") {
    if (patch.kategori !== undefined) out.categoryId = findId(db?.expenseCategories, patch.kategori);
    if (patch.project !== undefined) out.projectId = findId(db?.projects, patch.project);
    if (patch.survey !== undefined) {
      out.surveyId =
        patch.survey === "-" || !patch.survey
          ? null
          : Number(String(patch.survey).match(/#(\d+)/)?.[1]) || null;
    }
    if (patch.surveyId !== undefined) out.surveyId = patch.surveyId ? Number(patch.surveyId) : null;
    if (patch.costCenter !== undefined) out.costCenterId = findId(db?.costCenters, patch.costCenter);
  }

  if (module === "leads") {
    if (patch.perusahaan !== undefined) out.customerId = findId(db?.customers, patch.perusahaan);
    if (patch.sumber !== undefined) out.sourceId = findId(db?.leadSources, patch.sumber);
    if (patch.pemilik !== undefined) out.ownerId = findId(db?.users, patch.pemilik);
    if (patch.nilai !== undefined) out.estimatedValue = num(patch.nilai);
    if (patch.peluang !== undefined) out.probability = num(patch.peluang);
    if (patch.closing !== undefined) out.targetClosing = patch.closing;
    if (patch.tipe !== undefined) out.clientType = toEnum("clientType", patch.tipe);
    if (patch.status !== undefined) out.stage = toEnum("leads", patch.status);
    if (patch.alasanLost !== undefined) {
      out.lostNote = patch.alasanLost;
      const lrId = findId(db?.lostReasons, patch.alasanLost);
      if (lrId) out.lostReasonId = lrId;
    }
  } else if (module === "quotations") {
    if (patch.nilai !== undefined && patch.total === undefined) out.total = num(patch.nilai);
    if (patch.total !== undefined) out.total = num(patch.total);
    if (patch.disc !== undefined) out.discount = num(patch.disc);
    if (patch.ppn !== undefined) out.ppn = num(patch.ppn);
    if (patch.totalAfterDisc !== undefined) out.grandTotal = num(patch.totalAfterDisc);
    if (patch.berlaku !== undefined) out.validUntil = patch.berlaku;
    if (patch.status !== undefined) out.status = toEnum("quotations", patch.status) || patch.status;
    if (patch.items !== undefined) out.items = patch.items;
    if (patch.subject !== undefined) out.subject = patch.subject;
    if (patch.intro !== undefined) out.intro = patch.intro;
    if (patch.notesList !== undefined) out.notesList = patch.notesList;
    if (patch.city !== undefined) out.city = patch.city;
    if (patch.kopText !== undefined) out.kopText = patch.kopText;
    if (patch.customerAddress !== undefined) out.customerAddress = patch.customerAddress;
    if (patch.signerName !== undefined) out.signerName = patch.signerName;
    if (patch.signerTitle !== undefined) out.signerTitle = patch.signerTitle;
  } else if (module === "surveys") {
    if (patch.status !== undefined) out.status = toEnum("surveys", patch.status) || patch.status;
    if (patch.tim !== undefined) out.memberIds = resolveMemberIds(patch, db);
  } else if (module === "projects") {
    if (patch.jenis !== undefined) out.type = toEnum("projectType", patch.jenis);
    if (patch.customer !== undefined) out.customerId = findId(db?.customers, patch.customer);
    if (patch.pm !== undefined) out.picId = findId(db?.users, patch.pm);
    if (patch.mulai !== undefined) out.startDate = patch.mulai;
    if (patch.selesai !== undefined) out.endDate = patch.selesai;
    if (patch.progres !== undefined) out.progress = num(patch.progres);
    if (patch.status !== undefined) out.status = toEnum("projects", patch.status) || patch.status;
  } else if (module === "tasks") {
    if (patch.pic !== undefined) out.assigneeId = findId(db?.users, patch.pic);
    if (patch.tenggat !== undefined) out.dueDate = patch.tenggat;
    if (patch.progres !== undefined) out.progress = num(patch.progres);
    if (patch.perluBarang !== undefined) out.needsPurchase = !!patch.perluBarang;
    if (patch.status !== undefined) out.status = toEnum("tasks", patch.status) || String(patch.status).replace(" ", "_");
  } else if (module === "po-client") {
    if (patch.customer !== undefined) out.customerId = findId(db?.customers, patch.customer);
    if (patch.nilai !== undefined) out.amount = num(patch.nilai);
  } else if (module === "invoices") {
    if (patch.customer !== undefined) out.customerId = findId(db?.customers, patch.customer);
    if (patch.nilai !== undefined) out.amount = num(patch.nilai);
    if (patch.jatuhTempo !== undefined) out.dueDate = patch.jatuhTempo;
    if (patch.jenis !== undefined) out.type = toEnum("invoiceType", patch.jenis);
    if (patch.status !== undefined) out.status = toEnum("invoices", patch.status) || patch.status;
  } else if (module === "delivery-notes") {
    if (patch.penerimaNama || patch.catatanSerahTerima) {
      out.reportText = [
        patch.penerimaNama ? `Penerima: ${patch.penerimaNama}` : "",
        patch.penerimaJabatan ? `(${patch.penerimaJabatan})` : "",
        patch.catatanSerahTerima ? `- ${patch.catatanSerahTerima}` : "",
      ]
        .filter(Boolean)
        .join(" ");
    }
  } else if (module === "users") {
    if (patch.roleLabel !== undefined || patch.role !== undefined) {
      out.role = roleFromUi(patch.role ?? patch.roleLabel);
    }
    if (patch.gudang !== undefined) out.warehouseId = findId(db?.warehouses, patch.gudang);
    if (patch.status !== undefined) out.status = toEnum("users", patch.status) || patch.status;
  } else if (
    ["customers", "suppliers", "products", "productCategories", "warehouses", "leadSources", "lostReasons", "expenseCategories", "costCenters"].includes(module)
  ) {
    if (patch.status !== undefined) out.status = toEnum("users", patch.status) || patch.status;
    if (module === "products" && patch.kategori !== undefined) {
      out.categoryId = findId(db?.productCategories, patch.kategori);
    }
  } else if (module === "purchase-requests") {
    if (patch.jenisBiaya !== undefined || patch.costType !== undefined) {
      out.costType = String(toEnum("costType", patch.costType || patch.jenisBiaya) || patch.costType || patch.jenisBiaya || "STOK").toUpperCase();
    }
    if (patch.project !== undefined) out.projectId = findId(db?.projects, patch.project);
    if (patch.supplier !== undefined) out.supplierId = findId(db?.suppliers, patch.supplier);
  }

  return forPatch(module, out);
}

/** Modul yang DTO status-nya memakai `reason`, bukan `note`. */
const STATUS_REASON_MODULES = new Set(["expenses", "purchase-requests", "delivery-notes", "opname", "damage-reports"]);

/** Mutasi status: UI label → body untuk endpoint status. */
export function buildStatusBody(module: string, uiStatus: string, note?: string, extra?: Record<string, any>): Record<string, any> {
  const enumVal = toEnum(module, uiStatus);
  const field = STATUS_REASON_MODULES.has(module) ? "reason" : "note";
  const base = note !== undefined ? { status: enumVal, [field]: note } : { status: enumVal };
  return extra ? { ...base, ...extra } : base;
}

export function statusEnumFor(module: string, uiStatus: string): string {
  return toEnum(module, uiStatus);
}
