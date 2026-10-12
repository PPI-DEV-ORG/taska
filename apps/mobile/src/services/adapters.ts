import type { Row, User, Role } from "@/mock/data";

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
};

// ─── status label maps (backend enum → UI label) ───
const MAPS: Record<string, Record<string, string>> = {
  leads: {
    PROSPECTING: "Prospecting", QUALIFICATION: "Qualification", PROPOSAL: "Proposal",
    NEGOTIATION: "Negotiation", WON: "Won", LOST: "Lost",
  },
  quotations: {
    NOT_YET: "Not Yet", DRAFT: "Draft", PENDING_APPROVAL: "Menunggu persetujuan",
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
    DI_SUPPLIER: "Di Supplier", DIKIRIM: "Dikirim", SAMPAI: "Sampai",
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
  damageType: { RUSAK: "Rusak", SALAH_BARANG: "Salah barang", KURANG: "Kurang" },
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

export function toLabel(map: string, v: string | null | undefined): string {
  if (v == null) return "-";
  return MAPS[map]?.[v] ?? v;
}
export function toEnum(map: string, label: string | null | undefined): string {
  if (label == null) return "";
  return REVERSE[map]?.[label] ?? label;
}

const ROLE_UI: Record<string, Role> = {
  ADMIN: "admin", BOS: "bos", SALES: "sales", PM: "pm", TEKNISI: "teknisi",
  PROCUREMENT: "procurement", FINANCE: "finance", GUDANG: "gudang", SE: "se",
};
const ROLE_FROM_UI: Record<string, string> = {};
for (const [k, v] of Object.entries(ROLE_UI)) ROLE_FROM_UI[v] = k;

export function roleFromUi(role: string): string {
  return ROLE_FROM_UI[role] ?? "SALES";
}
export function roleToUi(role: string | undefined): Role {
  return (role && ROLE_UI[role]) || "sales";
}

export function apiUserToRow(u: ApiUser): User {
  const role = roleToUi(u.role);
  return {
    id: String(u.id),
    name: u.name,
    email: u.email,
    role,
    roleLabel: "",
    status: toLabel("users", u.status),
    gudang: u.warehouseId != null ? String(u.warehouseId) : "-",
    phone: u.phone ?? "",
    position: u.position ?? "",
    department: u.department ?? "",
    warehouseId: u.warehouseId ?? null,
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
    case "leads":
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
        sepi: 0,
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
      };
    case "quotations":
      return {
        ...base,
        nomor: raw.number ?? "",
        lead: nameOf(raw.lead) ?? "",
        leadId: idOf(raw.lead),
        customer: nameOf(raw.customer) ?? "",
        customerId: idOf(raw.customer),
        nilai: n(raw.total), total: n(raw.total), ppn: n(raw.ppn), disc: n(raw.discount),
        totalAfterDisc: n(raw.grandTotal),
        status: toLabel("quotations", raw.status),
        versi: n(raw.currentVersion) || 1,
        berlaku: d(raw.validUntil),
        pemilik: nameOf(raw.owner),
        dibuat: d(raw.createdAt),
        fileUploaded: n(raw._count?.versions) > 0,
        stage: raw.lead?.stage ?? null,
      };
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
        tim: "",
        progres: n(raw.progress),
        pembayaran: toLabel("paymentStatus", raw.paymentStatus),
        status: toLabel("projects", raw.status),
        mulai: d(raw.startDate),
        selesai: d(raw.endDate),
        barang: "-",
        quotationId: idOf(raw.quotation),
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
        projectId: idOf(raw.project),
        jenisBiaya: toLabel("costType", raw.costType),
        pemohon: nameOf(raw.requester) ?? "",
        pemohonId: raw.requester?.id != null ? String(raw.requester.id) : null,
        item: (raw.items ?? [])
          .map((i: any) => `${nameOf(i.product)} x ${n(i.qty)}${i.product?.unit ? ` ${i.product.unit}` : ""}`)
          .join(", "),
        estimasi: n(raw.estimatedCost),
        status: toLabel("purchase-requests", raw.status),
        tujuan: raw.purpose ?? "",
        supplierId: idOf(raw.supplier),
      };
    case "supplier-pos":
      return {
        ...base,
        nomor: raw.number ?? "",
        supplier: nameOf(raw.supplier) ?? "",
        supplierId: idOf(raw.supplier),
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
          .join(", "),
        requestId: idOf(raw.request),
        projectId: idOf(raw.project),
        shipmentStatus: raw.shipmentStatus,
        poStatus: raw.status,
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
        item: "",
        warehouseId: idOf(raw.warehouse),
        warehouse: nameOf(raw.warehouse) ?? "",
        projectId: idOf(raw.project),
        conditionNote: raw.conditionNote ?? "",
        _items: raw.items ?? [],
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
        barang: "",
        status: toLabel("delivery-notes", raw.status),
        persetujuan: raw.status === "PENDING" ? "Menunggu persetujuan" : "Disetujui",
        withGoods: !!raw.withGoods,
        reportText: raw.reportText ?? "",
        _locations: raw.locations ?? [],
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
        alasan: raw.description ?? "",
        status: toLabel("expenses", raw.status),
        costCenterId: idOf(raw.costCenter),
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
      row.roleLabel = "";
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
    case "opname":
      return {
        ...base,
        tanggal: d(raw.date),
        gudang: nameOf(raw.warehouse) ?? "",
        warehouseId: idOf(raw.warehouse),
        petugas: nameOf(raw.conductor) ?? "",
        selisih: (raw.details ?? []).reduce(
          (a: number, x: any) => a + (n(x.countedQty) - n(x.systemQty ?? x.expectedQty ?? 0)),
          0,
        ),
        status: toLabel("opname", raw.status),
        alasan: raw.reason ?? "",
        _details: raw.details ?? [],
      };
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
  return {
    id: String(raw.id),
    jenis: KIND_LABEL[raw.kind] ?? raw.kind,
    judul: raw.title ?? "",
    pengaju: raw.requestedBy?.name ?? "",
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

export function adaptNotif(raw: any): NotifRow {
  return {
    id: String(raw.id),
    jenis: NOTIF_KIND[raw.kind] ?? "approval",
    teks: raw.text ?? raw.message ?? "",
    waktu: raw.createdAt ?? "",
    baca: !!raw.read,
    href: raw.href ?? "",
    roles: "all",
  };
}

export function adaptNotifList(list: any[] | undefined): NotifRow[] {
  return (list ?? []).map(adaptNotif);
}

// ─── create DTO builders (UI row → backend body) ───
export function buildCreateBody(module: string, row: Record<string, any>): Record<string, any> {
  const num = (v: any) => Number(String(v ?? 0).replace(/[^\d.-]/g, "")) || 0;
  switch (module) {
    case "leads":
      return {
        name: row.nama ?? row.name,
        customerId: row.customerId != null ? Number(row.customerId) : undefined,
        sourceId: row.sourceId != null ? Number(row.sourceId) : undefined,
        clientType: row.tipe ? toEnum("clientType", row.tipe) : undefined,
        estimatedValue: num(row.nilai),
        probability: num(row.peluang) || 20,
        targetClosing: row.closing || undefined,
        contactName: row.kontak || undefined,
        ownerId: row.ownerId != null ? Number(row.ownerId) : undefined,
        stage: "PROSPECTING",
      };
    case "customers":
      return { name: row.nama, city: row.kota, pic: row.kontak, email: row.email || undefined, phone: row.telepon || undefined, notes: row.catatan || undefined, status: "AKTIF" };
    case "suppliers":
      return { name: row.nama, city: row.kota, pic: row.kontak || undefined, email: row.email || undefined, phone: row.telepon || undefined, paymentTerms: row.payment || undefined, notes: row.catatan || undefined, status: "AKTIF" };
    case "users":
      return { name: row.name ?? row.nama, email: row.email, password: row.password, role: roleFromUi(row.role ?? row.roleLabel), status: "AKTIF" };
    case "projects":
      return {
        name: row.nama ?? row.name,
        type: row.jenis ? toEnum("projectType", row.jenis) : "CUSTOMER",
        customerId: row.customerId != null && row.customerId !== "" ? Number(row.customerId) : undefined,
        startDate: new Date().toISOString().slice(0, 10),
        endDate: row.selesai || undefined,
        status: "BERJALAN",
        progress: 0,
        picId: row.pmId != null ? Number(row.pmId) : undefined,
        memberIds: row.memberIds ?? undefined,
      };
    case "po-client":
      return {
        number: row.nomor || undefined,
        customerId: Number(row.customerId),
        amount: num(row.nilai),
        date: row.tanggal,
        quotationId: row.quotationId != null ? Number(row.quotationId) : undefined,
      };
    case "invoices":
      return {
        number: row.nomor || undefined,
        customerId: Number(row.customerId),
        clientPoId: row.clientPoId != null ? Number(row.clientPoId) : undefined,
        type: row.jenis ? toEnum("invoiceType", row.jenis) : "TERMIN",
        amount: num(row.nilai),
        ppn: num(row.ppn),
        total: num(row.total),
        date: row.tanggal || new Date().toISOString().slice(0, 10),
        dueDate: row.jatuhTempo,
        status: "DRAFT",
      };
    case "expenses":
      return {
        date: row.tanggal,
        categoryId: row.categoryId != null && row.categoryId !== "" ? Number(row.categoryId) : undefined,
        amount: num(row.nominal),
        description: row.alasan,
        projectId: row.projectId != null && row.projectId !== "" ? Number(row.projectId) : undefined,
        costCenterId: row.costCenterId != null && row.costCenterId !== "" ? Number(row.costCenterId) : undefined,
      };
    case "damage-reports":
      return {
        date: row.tanggal || new Date().toISOString().slice(0, 10),
        productId: Number(row.productId),
        type: toEnum("damageType", row.jenis),
        qty: num(row.qty) || 1,
        description: row.keterangan,
      };
    case "productCategories":
      return { name: row.nama, description: row.deskripsi || undefined, prefix: row.prefix || undefined, status: "AKTIF" };
    case "warehouses":
      return { name: row.nama, city: row.kota || undefined, status: "AKTIF" };
    case "products":
      return {
        sku: row.sku, name: row.nama, unit: row.satuan,
        categoryId: row.categoryId != null && row.categoryId !== "" ? Number(row.categoryId) : undefined,
        hasSerial: !!row.berSN, minStock: num(row.min), warrantyMonths: row.garansi ? parseInt(String(row.garansi), 10) || undefined : undefined,
        purchasePrice: num(row.hargaBeli), status: "AKTIF",
      };
    case "leadSources":
    case "lostReasons":
    case "expenseCategories":
    case "costCenters":
      return { name: row.nama, status: "AKTIF" };
    default:
      return row;
  }
}

/** Mutasi status: UI label → body untuk endpoint status. */
export function buildStatusBody(module: string, uiStatus: string, note?: string): Record<string, any> {
  const map = module === "supplier-pos" ? "supplier-pos" : module;
  const enumVal = toEnum(map, uiStatus);
  switch (module) {
    case "invoices":
      return { status: enumVal, note };
    default:
      return { status: enumVal, note };
  }
}

export function statusEnumFor(module: string, uiStatus: string): string {
  return toEnum(module, uiStatus);
}
