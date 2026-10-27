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
  clientType: { PARTNER: "Partner", END_USER: "End user", SI: "SI (Sistem Integrator)" },
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
REVERSE.clientType = {
  ...REVERSE.clientType,
  "end_user": "END_USER",
  "enduser": "END_USER",
  "End User": "END_USER",
  "ENDUSER": "END_USER",
  "partner": "PARTNER",
  "Partner": "PARTNER",
  "si": "SI",
  "SI": "SI",
};
REVERSE["supplier-pos"] = {
  ...REVERSE["supplier-pos"],
  "Di Supplier": "DI_SUPPLIER",
  "Dalam Perjalanan": "DIKIRIM",
  "Dikirim": "DIKIRIM",
  "Sampai": "SAMPAI",
  "Belum Dikirim": "DI_SUPPLIER",
};
REVERSE["delivery-notes"] = {
  ...REVERSE["delivery-notes"],
  "Terima": "DITERIMA",
  "Selesai": "DITERIMA",
  "Kirim": "DIKIRIM",
  "Batal": "DIBATALKAN",
};
REVERSE.surveys = {
  ...REVERSE.surveys,
  "Batal": "BATAL",
  "Dibatalkan": "BATAL",
};
REVERSE.invoices = {
  ...REVERSE.invoices,
  "Lunas": "PAID",
  "Dibayar sebagian": "PARTIAL",
  "Belum dikirim": "DRAFT",
  "Terkirim": "SENT",
  "Dibatalkan": "BATAL",
  "Terlambat": "OVERDUE",
};
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
  if (label == null || label === "") return "";
  const str = String(label).trim();
  const direct = REVERSE[map]?.[str];
  if (direct) return direct;

  const normalized = str.toLowerCase();
  const rev = REVERSE[map];
  if (rev) {
    for (const [k, v] of Object.entries(rev)) {
      if (k.toLowerCase() === normalized) return v;
    }
  }

  const m = MAPS[map];
  if (m) {
    const enumUpper = str.toUpperCase().replace(/[\s\-]/g, "_");
    if (m[enumUpper]) return enumUpper;
    for (const k of Object.keys(m)) {
      if (k.toLowerCase() === normalized || k.replace(/_/g, "") === normalized.replace(/_/g, "")) {
        return k;
      }
    }
  }

  return str;
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
  const base: Row = {
    id: String(raw.id),
    createdAt: raw.createdAt ?? raw.date ?? raw.tanggal ?? raw.dibuat ?? null,
  };
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
        pph: n(raw.pph),
        pphMode: raw.pphMode || "none",
        tipePph: raw.tipePph || (raw.pphMode ? String(raw.pphMode).toUpperCase() : "Tanpa PPh"),
        totalAfterDisc:
          n(raw.grandTotal) === n(raw.total) && n(raw.ppn) > 0
            ? n(raw.total) - n(raw.discount) + n(raw.ppn) - n(raw.pph)
            : (n(raw.grandTotal) || (n(raw.total) - n(raw.discount) + n(raw.ppn) - n(raw.pph))),
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
        customerAddress: raw.customerAddress ?? (raw.customer?.address ?? ""),
        signerName: raw.signerName ?? "",
        signerTitle: raw.signerTitle ?? "",
        latestFileId: raw.latestFileId ?? raw.versions?.[0]?.fileId ?? null,
        fileName: fName,
        fileStatus: hasFile ? fName : "Belum diupload",
        fileUploaded: hasFile,
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
                : (n(v.grandTotal) || (n(v.total) - n(v.discount) + n(v.ppn))),
            date: d(v.createdAt),
            reason: vReason,
            file: v.fileId ? `Penawaran-${String(raw.number || "").replace(/\//g, "-")}-v${v.version}.xlsx` : "-",
          };
        }),
        files: Array.isArray(raw.files) ? raw.files : [],
      };
    }
    case "surveys": {
      const surveyFiles = Array.isArray(raw.files) ? raw.files : [];
      const isMedia = (f: any) => {
        const k = String(f.kind || "").toUpperCase();
        return f.mimeType?.startsWith("image/") || f.mimeType?.startsWith("video/") || k === "FOTO" || k === "VIDEO";
      };
      const isDoc = (f: any) => {
        const k = String(f.kind || "").toUpperCase();
        return k === "DOKUMEN" || (!f.mimeType?.startsWith("image/") && !f.mimeType?.startsWith("video/") && k !== "FOTO" && k !== "VIDEO");
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
        tim: (raw.members ?? []).map((m: any) => nameOf(m.user)).filter(Boolean).join(", "),
        status: toLabel("surveys", raw.status),
        biaya: n(raw.cost),
        need: raw.need ?? "",
        requester: nameOf(raw.requester) ?? "",
        approval: raw.approval ? adaptApproval(raw.approval) : undefined,
        files: surveyFiles,
        evidenceFileId: raw.evidenceFileId ?? mediaFile?.id ?? null,
        documentFileId: raw.documentFileId ?? docFile?.id ?? null,
        mediaFile: mediaFile ?? null,
        docFile: docFile ?? null,
      };
    }
    case "po-client": {
      const custName = nameOf(raw.customer);
      const suppName = nameOf(raw.supplier);
      const isNumberSo = /^SO[\-\/]/i.test(String(raw.number || ""));
      const isNumberPo = /^PO[\-\/]/i.test(String(raw.number || ""));
      const soNum = raw.soNumber && raw.soNumber !== "-" ? raw.soNumber : (isNumberSo ? raw.number : "-");
      const poNum = raw.poClientNumber && raw.poClientNumber !== "-" ? raw.poClientNumber : (isNumberPo ? raw.number : "-");
      const primaryDoc = (raw.number && raw.number !== "-") ? raw.number : (soNum !== "-" ? soNum : poNum !== "-" ? poNum : "");

      return {
        ...base,
        nomor: primaryDoc,
        nomorSo: soNum,
        nomorPoClient: poNum,
        docMode: raw.docMode ?? (soNum !== "-" && poNum !== "-" ? "BOTH" : soNum !== "-" ? "SO" : "PO"),
        customer: custName || (suppName ? `${suppName} (Supplier)` : "-"),
        customerId: idOf(raw.customer),
        supplier: suppName || "-",
        supplierId: idOf(raw.supplier),
        penawaran: raw.quotation?.number ?? "-",
        quotationId: idOf(raw.quotation),
        nilai: n(raw.amount),
        totalInvoice: n(raw.invoices?.reduce?.((a: number, b: any) => a + n(b.total), 0) ?? 0),
        tanggal: d(raw.date),
        status: toLabel("po-client", "DITERIMA"),
        fileId: raw.fileId ?? raw.file?.id ?? null,
        file: raw.file ?? null,
        soFileId: raw.soFileId ?? raw.soFile?.id ?? null,
        soFile: raw.soFile ?? null,
        items: Array.isArray(raw.items) ? raw.items : [],
        catatan: raw.notes ?? raw.catatan ?? "",
      };
    }
    case "invoices": {
      const qNum =
        raw.quotation ??
        raw.clientPo?.quotation?.number ??
        raw.project?.quotation?.number ??
        (raw.description ? (raw.description.match(/(?:QUO|PNW)[-\w\/]+/i)?.[0] ?? undefined) : undefined);
      const qId =
        raw.quotationId ??
        raw.clientPo?.quotationId ??
        raw.project?.quotationId ??
        idOf(raw.clientPo?.quotation) ??
        idOf(raw.project?.quotation) ??
        undefined;
      const descLeadMatch = raw.description ? String(raw.description).match(/\[lead:(\d+)\]/i) : null;
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
      const isDp = raw.type === "DP" || toLabel("invoiceType", raw.type) === "DP";
      const isPaid = raw.status === "PAID" || toLabel("invoices", raw.status) === "Lunas" || (totNum > 0 && paidNum >= totNum);
      const isPartial = !isPaid && ((paidNum > 0 && paidNum < totNum) || (isDp && paidNum > 0));

      let displayStatus = toLabel("invoices", raw.status);
      if (raw.status !== "BATAL" && displayStatus !== "Dibatalkan") {
        if (isPaid) {
          displayStatus = "Lunas";
        } else if (isPartial) {
          displayStatus = "Dibayar sebagian";
        }
      }

      return {
        ...base,
        nomor: raw.number ?? "",
        po: raw.clientPo?.number ?? "-",
        clientPoId: idOf(raw.clientPo),
        quotation: qNum ?? "",
        quotationId: qId ?? null,
        lead: leadName,
        leadId: leadId ? String(leadId) : null,
        paymentNote: isPartial ? "dp setengah bayar sebagian dp termin" : "",
        customer: nameOf(raw.customer) ?? "",
        customerId: idOf(raw.customer),
        jenis: toLabel("invoiceType", raw.type),
        catatan: (raw.description || "").replace(/\[by:\d+\]/g, "").replace(/\[lead:\d+\]/g, "").trim(),
        nilai: n(raw.amount),
        ppn: n(raw.ppn),
        pph: n(raw.pph),
        pphMode: raw.pphMode || "none",
        tipePph: raw.tipePph || (raw.pphMode ? String(raw.pphMode).toUpperCase() : "Tanpa PPh"),
        total: n(raw.total),
        terbayar: n(raw.paidAmount),
        jatuhTempo: d(raw.dueDate),
        status: displayStatus,
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
        fileName: raw.fileName ?? undefined,
        fileUploaded: !!(raw.fileId || raw.fileUploaded),
        stockConflictFlag: !!raw.stockConflictFlag,
        stockConflictMessage: raw.stockConflictMessage ?? null,
        autoSwapLogs: Array.isArray(raw.autoSwapLogs) ? raw.autoSwapLogs : [],
        emergencyPrId: raw.emergencyPrId ?? null,
        emergencyPrNumber: raw.emergencyPrNumber ?? null,
      };
    }
    case "projects": {
      const qNum = raw.quotation?.number ?? raw.quotation?.nomor ?? null;
      const qCust = raw.quotation?.customer?.name ?? raw.quotation?.customer?.nama ?? null;
      const qLead = raw.quotation?.lead?.name ?? raw.quotation?.lead?.nama ?? null;
      const qDisplay = qNum ? (qCust || qLead ? `${qNum} - ${[qCust, qLead].filter(Boolean).join(" · ")}` : qNum) : "-";
      return {
        ...base,
        nama: raw.name ?? "",
        jenis: toLabel("projectType", raw.type),
        customerId: idOf(raw.customer),
        customer: nameOf(raw.customer) ?? "-",
        pm: nameOf(raw.pic) ?? "",
        pmId: raw.pic?.id != null ? String(raw.pic.id) : null,
        tim: (raw.members ?? []).map((m: any) => nameOf(m.user)).filter(Boolean).join(", ") || "-",
        progres: raw.status === "SELESAI" || toLabel("projects", raw.status) === "Selesai" ? 100 : n(raw.progress),
        pembayaran: toLabel("paymentStatus", raw.paymentStatus),
        status: toLabel("projects", raw.status),
        mulai: d(raw.startDate),
        selesai: d(raw.endDate),
        barang: "-",
        quotationId: idOf(raw.quotation),
        penawaran: qDisplay,
        lead: qLead ?? "-",
        leadId: raw.quotation?.leadId ?? null,
        prdFileId: raw.prdFileId ?? null,
        bahpFileId: raw.bahpFileId ?? null,
        bastFileId: raw.bastFileId ?? null,
        doFileId: raw.doFileId ?? null,
        _members: (raw.members ?? []).map((m: any) => ({ id: String(m.userId), name: nameOf(m.user), role: roleToUi(m.user?.role) })),
      };
    }
    case "tasks":
      return {
        ...base,
        project: raw.project?.name ?? "",
        projectId: idOf(raw.project) ?? (raw.projectId != null ? String(raw.projectId) : null),
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
    case "supplier-pos": {
      const rawItems = Array.isArray(raw.items) ? raw.items : [];
      const firstProdName = nameOf(rawItems[0]?.product) || rawItems[0]?.productName || "";
      const itemSummary = rawItems
        .map((i: any) => `${nameOf(i.product) || i.productName || "Barang"} x ${n(i.qty)}`)
        .join(", ");
      const displayItem = firstProdName || (raw.item ? String(raw.item).replace(/\s*x\s*\d+.*$/, "") : "") || itemSummary || "-";

      return {
        ...base,
        nomor: raw.number ?? "",
        nomorSoSupplier: raw.supplierSoNumber ?? "-",
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
        item: displayItem,
        itemsSummary: itemSummary || displayItem,
        items: rawItems,
        requestId: idOf(raw.request),
        projectId: idOf(raw.project),
        shipmentStatus: raw.shipmentStatus,
        poStatus: raw.status,
        fileId: raw.fileId ?? null,
        soFileId: raw.soFileId ?? null,
        doFileId: raw.doFileId ?? null,
      };
    }
    case "receiving":
      return {
        ...base,
        nomor: raw.number ?? "",
        po: raw.supplierPo?.number ?? "-",
        supplierPoId: idOf(raw.supplierPo),
        supplier: raw.supplierPo?.supplier?.name ?? raw.supplierName ?? "-",
        tanggal: d(raw.date),
        penerima: nameOf(raw.receiver) ?? "",
        status: toLabel("receiving", raw.status),
        item: (raw.items ?? []).map((i: any) => `${nameOf(i.product)} x ${n(i.qtyReceived ?? i.qtyGood ?? i.qtyOrdered)} ${i.product?.unit ?? ""}`).join(", ") || raw.conditionNote || "-",
        warehouseId: idOf(raw.warehouse),
        warehouse: nameOf(raw.warehouse) ?? "",
        projectId: idOf(raw.project),
        conditionNote: raw.conditionNote ?? "",
        _items: raw.items ?? [],
        items: raw.items ?? [],
        receiptFileId: raw.receiptFileId ?? null,
        photoFileId: raw.photoFileId ?? null,
        fileId: raw.photoFileId ?? raw.receiptFileId ?? (raw.fileId ?? null),
      };
    case "delivery-notes": {
      const loc = raw.locations?.[0];
      let penerimaNama = raw.penerimaNama || "";
      let penerimaJabatan = raw.penerimaJabatan || "";
      let penerimaKontak = raw.penerimaKontak || "";
      let catatanSerahTerima = raw.catatanSerahTerima || "";
      if (raw.reportText) {
        try {
          const parsed = JSON.parse(raw.reportText);
          if (parsed && typeof parsed === "object") {
            if (parsed.penerimaNama) penerimaNama = parsed.penerimaNama;
            if (parsed.penerimaJabatan) penerimaJabatan = parsed.penerimaJabatan;
            if (parsed.penerimaKontak) penerimaKontak = parsed.penerimaKontak;
            if (parsed.catatanSerahTerima) catatanSerahTerima = parsed.catatanSerahTerima;
          }
        } catch {
          const matchNama = raw.reportText.match(/Penerima:\s*([^(\n-]+)/i);
          const matchJabatan = raw.reportText.match(/\(([^)]+)\)/);
          const matchKontak = raw.reportText.match(/\[(?:Telp|Kontak):\s*([^\]]+)\]/i);
          const matchCatatan = raw.reportText.match(/-\s*(.+)$/);
          if (matchNama) penerimaNama = matchNama[1].trim();
          if (matchJabatan) penerimaJabatan = matchJabatan[1].trim();
          if (matchKontak) penerimaKontak = matchKontak[1].trim();
          if (matchCatatan) catatanSerahTerima = matchCatatan[1].trim();
          else if (!matchNama && !matchJabatan) catatanSerahTerima = raw.reportText;
        }
      }
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
        items: raw.items ?? [],
        _items: raw.items ?? [],
        _locations: raw.locations ?? [],
        fileId: raw.scanFileId ?? raw.signedFileId ?? null,
        scanFileId: raw.scanFileId ?? raw.signedFileId ?? null,
        signedFileId: raw.scanFileId ?? raw.signedFileId ?? null,
        reportFileId: raw.reportFileId ?? null,
        penerimaNama,
        penerimaJabatan,
        penerimaKontak,
        catatanSerahTerima,
        tanggalDiterima: raw.receivedAt ? d(raw.receivedAt) : (raw.tanggalDiterima ? d(raw.tanggalDiterima) : null),
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
    case "damage-reports": {
      const desc = raw.description ?? "";
      const poMatch = desc.match(/\[PO:\s*([^\]]+)\]/);
      const snMatch = desc.match(/\[SN:\s*([^\]]+)\]/);
      const replacedMatch = desc.match(/\[DIGANTI:\s*([^\]]+)\]/i);
      const isReturSales = /\[RETUR-PENJUALAN\]/i.test(desc);
      const isReturPurchase = /\[RETUR-PEMBELIAN\]/i.test(desc);
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
        raw.serialUnit?.replacedBy?.sn ??
        (replacedMatch ? replacedMatch[1].trim() : "-");
      return {
        ...base,
        tanggal: d(raw.date),
        produk: nameOf(raw.product) ?? "",
        productId: idOf(raw.product),
        hasSerial: !!raw.product?.hasSerial,
        sn: raw.serialUnit?.sn ?? (snMatch ? snMatch[1].trim() : "-"),
        snPengganti,
        serialUnitId: idOf(raw.serialUnit),
        jenis: jenisLabel,
        kategoriLaporan,
        po: poMatch ? poMatch[1].trim() : "-",
        pelapor: nameOf(raw.reporter) ?? "",
        status: toLabel("damage-reports", raw.status),
        keterangan: desc
          .replace(/\[RETUR-PENJUALAN\]\s*/gi, "")
          .replace(/\[RETUR-PEMBELIAN\]\s*/gi, "")
          .replace(/\[PO:\s*[^\]]+\]\s*/g, "")
          .replace(/\[SN:\s*[^\]]+\]\s*/g, "")
          .replace(/\[DIGANTI:\s*[^\]]+\]\s*/gi, ""),
        qty: n(raw.qty),
        fileId: raw.fileId ?? null,
      };
    }
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
    case "products": {
      const pType = String(raw.type || "BARANG").toUpperCase() === "JASA" ? "JASA" : "BARANG";
      const isJasa = pType === "JASA";
      return {
        ...base, sku: raw.sku ?? "", nama: raw.name ?? "", merk: raw.brand ?? "", brand: raw.brand ?? "",
        deskripsi: raw.description ?? "", description: raw.description ?? "", satuan: raw.unit ?? "",
        type: pType,
        jenisItem: isJasa ? "Jasa" : "Barang",
        tipeSN: isJasa ? "Jasa (Non-Stok)" : raw.hasSerial ? "Barang Ber-SN" : "Barang Non-SN",
        berSN: isJasa ? false : !!raw.hasSerial,
        garansi: raw.warrantyMonths != null ? `${raw.warrantyMonths} bln` : "-",
        min: n(raw.minStock), hargaBeli: n(raw.purchasePrice),
        kategori: nameOf(raw.category) ?? "",
        categoryId: idOf(raw.category),
        status: toLabel("users", raw.status),
      };
    }
    case "productCategories":
      return { ...base, nama: raw.name ?? "", deskripsi: raw.description ?? "", prefix: raw.prefix ?? "", status: toLabel("users", raw.status) };
    case "leadSources":
    case "lostReasons":
    case "expenseCategories":
    case "costCenters":
      return { ...base, nama: raw.name ?? "", status: toLabel("users", raw.status ?? "AKTIF") };
    case "serials": {
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
        productId: idOf(raw.product) ?? (raw.productId != null ? String(raw.productId) : null),
        gudang: nameOf(raw.warehouse) ?? "-",
        warehouseId: idOf(raw.warehouse) ?? (raw.warehouseId != null ? String(raw.warehouseId) : null),
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
    case "reservations": {
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
        invoiceId: idOf(raw.invoice) ?? (raw.invoiceId != null ? String(raw.invoiceId) : null),
        quotationId: idOf(raw.quotation) ?? (raw.quotationId != null ? String(raw.quotationId) : null),
        purchaseRequestId: idOf(raw.purchaseRequest) ?? (raw.purchaseRequestId != null ? String(raw.purchaseRequestId) : null),
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
    case "invoiceIn": {
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
      return {
        ...base,
        nomor: raw.number ?? "",
        customer: suppName ? `${suppName} (Supplier)` : "Supplier",
        supplier: suppName,
        supplierId: idOf(raw.supplier),
        po: raw.supplierPo?.number ?? "-",
        supplierPoId: idOf(raw.supplierPo),
        jenis: "Tagihan Supplier",
        direction: "in",
        nilai: n(raw.amount),
        ppn: n(raw.ppn),
        total: n(raw.total),
        terbayar: n(raw.paidAmount),
        tanggal: d(raw.date || raw.createdAt),
        jatuhTempo: d(raw.dueDate),
        status: displayStatus,
        fileId: raw.fileId ?? raw.file?.id ?? null,
        file: raw.file ?? null,
        transferFileId: raw.transferFileId ?? null,
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
  createdAt?: string | null;
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
    createdAt: raw.createdAt ?? null,
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
    const cleanValDash = (sVal.split(" - ")[0] ?? sVal).trim().toLowerCase();
    const match = list.find((r) => {
      const candidates = [r.nama, r.name, r.nomor, r.number, r.sku].filter(Boolean);
      return candidates.some((c) => {
        const sc = String(c).trim().toLowerCase();
        return sc === sVal.toLowerCase() || sc === cleanVal || sc === cleanValDash;
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
  if (row.tim !== undefined) {
    const timStr = String(row.tim || "").trim();
    if (!timStr || timStr === "-") return [];
    const names = timStr
      .split(",")
      .map((s) => (s.split("(")[0] ?? "").trim().toLowerCase())
      .filter(Boolean);
    const usersList = (db?.users && db.users.length > 0) ? db.users : [];
    const ids = usersList
      .filter((u: any) => names.includes(String(u.name ?? u.nama ?? "").trim().toLowerCase()))
      .map((u: any) => Number(u.id))
      .filter((x: number) => !Number.isNaN(x) && x > 0);
    return ids;
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
      const pph = row.pph != null ? num(row.pph) : 0;
      grand = Math.max(0, grand - pph);
      return {
        leadId: row.leadId != null && row.leadId !== "" ? Number(row.leadId) : findId(db?.leads, row.lead),
        customerId: row.customerId != null && row.customerId !== "" ? Number(row.customerId) : findId(db?.customers, row.customer ?? row.perusahaan),
        total: tot,
        ppn,
        pph,
        pphMode: row.pphMode || "none",
        tipePph: row.tipePph || "Tanpa PPh",
        discount: disc,
        grandTotal: grand,
        validUntil: row.berlaku || row.validUntil || undefined,
        fileId: row.fileId ? Number(row.fileId) : undefined,
        notes: row.notes ?? row.catatan ?? undefined,
        status: row.status ? (toEnum("quotations", row.status) || "DRAFT") : "DRAFT",
        items: Array.isArray(row.items) ? row.items : undefined,
        subject: row.subject || undefined,
        intro: row.intro || undefined,
        notesList: Array.isArray(row.notesList) ? row.notesList : undefined,
        city: row.city || undefined,
        kopText: row.kopText || undefined,
        customerAddress: row.customerAddress || undefined,
        signerName: row.signerName || undefined,
        signerTitle: row.signerTitle || undefined,
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

      let leadObj: any = null;
      if (row.leadId) {
        leadObj = (db?.leads ?? []).find((l: any) => Number(l.id) === Number(row.leadId));
      } else if (row.lead && row.lead !== "-") {
        const leadName = (String(row.lead).split(" · ")[0] ?? "").trim().toLowerCase();
        leadObj = (db?.leads ?? []).find((l: any) => l.nama?.toLowerCase() === leadName || l.name?.toLowerCase() === leadName);
      }

      const qObj = leadObj
        ? (db?.quotations ?? []).find((q: any) => (q.leadId && String(q.leadId) === String(leadObj.id)) || (q.lead && q.lead.toLowerCase() === leadObj.nama?.toLowerCase()))
        : null;

      const qId = row.quotationId != null && row.quotationId !== ""
        ? Number(row.quotationId)
        : (qObj?.id ? Number(qObj.id) : findId(db?.quotations, row.penawaran));

      const custId = row.customerId != null && row.customerId !== ""
        ? Number(row.customerId)
        : (leadObj?.customerId ? Number(leadObj.customerId) : (findId(db?.customers, row.customer ?? row.perusahaan) ?? (qObj?.customerId != null ? Number(qObj.customerId) : undefined)));
      const custObj = db?.customers?.find((c: any) => c.id === custId || c.nama === (row.customer ?? row.perusahaan));
      const custName = custObj?.nama || row.customer || row.perusahaan || leadObj?.perusahaan || leadObj?.customer || "Customer";
      const rawProjName = row.nama ?? row.name;
      const projName = rawProjName && !String(rawProjName).includes("undefined")
        ? rawProjName
        : `Project ${custName}`;

      return {
        name: projName,
        type: safeType,
        customerId: custId,
        quotationId: qId ?? undefined,
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
        description: row.deskripsi || row.description || undefined,
        parentId: row.parentId != null && row.parentId !== "" ? Number(row.parentId) : undefined,
        assigneeId: row.assigneeId != null && row.assigneeId !== "" ? Number(row.assigneeId) : findId(db?.users, row.pic),
        dueDate: row.tenggat || row.dueDate || undefined,
        priority: row.priority || undefined,
        status: row.status ? (toEnum("tasks", row.status) || row.status.replace(" ", "_")) : "TODO",
        progress: num(row.progres ?? row.progress),
        needsPurchase: !!(row.perluBarang ?? row.needsPurchase),
      };
    case "po-client": {
      const mode = row.docMode || (row.nomorSo && row.nomorSo !== "-" && row.nomorPoClient && row.nomorPoClient !== "-" ? "BOTH" : row.nomorPoClient && row.nomorPoClient !== "-" ? "PO" : "SO");
      const numVal = row.nomor || (mode === "PO" ? row.nomorPoClient : row.nomorSo) || undefined;
      return {
        number: numVal,
        soNumber: mode !== "PO" ? (row.nomorSo && row.nomorSo !== "-" ? row.nomorSo : undefined) : undefined,
        poClientNumber: mode !== "SO" ? (row.nomorPoClient && row.nomorPoClient !== "-" ? row.nomorPoClient : undefined) : undefined,
        customerId:
          row.customerId != null && row.customerId !== "" && row.customerId !== "-"
            ? Number(row.customerId)
            : row.customer && row.customer !== "-"
              ? findId(db?.customers, row.customer)
              : undefined,
        supplierId:
          row.supplierId != null && row.supplierId !== "" && row.supplierId !== "-"
            ? Number(row.supplierId)
            : row.supplier && row.supplier !== "-"
              ? findId(db?.suppliers, row.supplier)
              : undefined,
        amount: num(row.nilai ?? row.amount),
        date: row.tanggal || row.date || today,
        quotationId:
          row.quotationId != null && row.quotationId !== "" && row.quotationId !== "-"
            ? Number(row.quotationId)
            : row.penawaran && row.penawaran !== "-"
              ? findId(db?.quotations, row.penawaran)
              : undefined,
        fileId: row.fileId ? Number(row.fileId) : undefined,
        soFileId: row.soFileId ? Number(row.soFileId) : undefined,
        items: Array.isArray(row.items) ? row.items : undefined,
        notes: row.catatan || row.notes || undefined,
      };
    }
    case "invoices": {
      const amt = num(row.nilai ?? row.amount);
      const ppn = row.ppn != null ? num(row.ppn) : Math.round(amt * 0.11);
      const pph = row.pph != null ? num(row.pph) : 0;
      const tot = num(row.total) || Math.max(0, amt + ppn - pph);
      return {
        number: row.nomor || row.number || undefined,
        customerId:
          row.customerId != null && row.customerId !== ""
            ? Number(row.customerId)
            : findId(db?.customers, row.customer) ?? (db?.customers?.[0]?.id != null ? Number(db.customers[0].id) : undefined),
        clientPoId: row.clientPoId != null && row.clientPoId !== "" ? Number(row.clientPoId) : findId(db?.["po-client"], row.po),
        projectId: row.projectId != null && row.projectId !== "" ? Number(row.projectId) : findId(db?.projects, row.project),
        leadId: row.leadId != null && row.leadId !== "" ? Number(row.leadId) : undefined,
        type: row.jenis ? (toEnum("invoiceType", row.jenis) || "TERMIN") : "TERMIN",
        amount: amt,
        discount: row.discount != null ? num(row.discount) : undefined,
        ppn,
        pph,
        pphMode: row.pphMode || "none",
        tipePph: row.tipePph || "Tanpa PPh",
        total: tot,
        date: row.tanggal || row.date || today,
        dueDate: row.jatuhTempo || row.dueDate || new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
        fileId: row.fileId ? Number(row.fileId) : undefined,
        description: row.catatan || row.description || undefined,
        quotationId: row.quotationId != null && row.quotationId !== "" ? Number(row.quotationId) : undefined,
        quotation: row.quotation || undefined,
        items: Array.isArray(row.items) ? row.items : undefined,
        subject: row.subject || undefined,
        intro: row.intro || undefined,
        notesList: Array.isArray(row.notesList) ? row.notesList : undefined,
        city: row.city || undefined,
        kopText: row.kopText || undefined,
        kopLogoUrl: row.kopLogoUrl || undefined,
        customerAddress: row.customerAddress || undefined,
        signerName: row.signerName || undefined,
        signerTitle: row.signerTitle || undefined,
        dpLabel: row.dpLabel || undefined,
        dpAmount: row.dpAmount != null ? num(row.dpAmount) : undefined,
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
    case "supplier-pos": {
      let items = Array.isArray(row.items) && row.items.length ? row.items : undefined;
      if (!items && row.item) {
        const cleanItem = String(row.item || "").replace(/\s*x\s*\d+.*$/, "").trim().toLowerCase();
        const prod = (db?.products ?? []).find(
          (p: any) =>
            String(p.nama || p.name || "").trim().toLowerCase() === cleanItem ||
            String(p.sku || "").trim().toLowerCase() === cleanItem
        );
        if (prod) {
          items = [
            {
              productId: Number(prod.id),
              qty: Number(row.qty) || 1,
              price: num(row.total) || Number(prod.purchasePrice || prod.hargaBeli || 0),
            },
          ];
        }
      }
      return {
        number: row.nomor || row.number || undefined,
        supplierSoNumber: row.nomorSoSupplier && row.nomorSoSupplier !== "-" ? row.nomorSoSupplier : (row.supplierSoNumber || undefined),
        supplierId:
          row.supplierId != null && row.supplierId !== ""
            ? Number(row.supplierId)
            : findId(db?.suppliers, row.supplier) ?? (db?.suppliers?.[0]?.id != null ? Number(db.suppliers[0].id) : undefined),
        requestId: row.requestId != null && row.requestId !== "" ? Number(row.requestId) : findId(db?.["purchase-requests"], row.request),
        projectId: row.projectId != null && row.projectId !== "" ? Number(row.projectId) : findId(db?.projects, row.project),
        date: row.tanggal || row.date || today,
        eta: row.eta || undefined,
        paymentTerms: row.payment || row.paymentTerms || undefined,
        total: num(row.total),
        fileId: row.fileId ? Number(row.fileId) : undefined,
        soFileId: row.soFileId ? Number(row.soFileId) : undefined,
        items,
      };
    }
    case "receiving":
      return {
        supplierPoId: row.supplierPoId != null && row.supplierPoId !== "" ? Number(row.supplierPoId) : (row.po && row.po !== "-" ? findId(db?.["supplier-pos"], row.po) : undefined),
        supplierName: row.supplierName || (row.supplier && row.supplier !== "-" ? row.supplier : undefined),
        warehouseId: row.warehouseId != null && row.warehouseId !== "" ? Number(row.warehouseId) : findId(db?.warehouses, row.gudang ?? row.warehouse),
        date: row.tanggal || row.date || today,
        conditionNote: row.conditionNote || row.catatan || undefined,
        status: row.status ? toEnum("receiving", row.status) : undefined,
        receiptFileId: row.receiptFileId ?? (row.fileId ? Number(row.fileId) : undefined),
        photoFileId: row.photoFileId ? Number(row.photoFileId) : undefined,
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
        items: Array.isArray(row.items) && row.items.length ? row.items : undefined,
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
    case "damage-reports": {
      const baseDesc = row.keterangan || row.description || "-";
      const poVal = row.po && row.po !== "-" ? (String(row.po).split(" - ")[0] ?? "").trim() : "";
      const snVal = row.sn && row.sn !== "-" ? (String(row.sn).split(" (")[0] ?? "").trim() : "";
      const matchedSn = snVal
        ? (db?.serials ?? []).find((s: any) => String(s.sn || "").trim().toLowerCase() === snVal.toLowerCase())
        : null;
      const serialUnitId =
        row.serialUnitId != null && row.serialUnitId !== ""
          ? Number(row.serialUnitId)
          : matchedSn?.id != null
          ? Number(matchedSn.id)
          : undefined;
      const jenisStr = String(row.jenis || "");
      const isReturSales = /retur\s*penjualan/i.test(jenisStr);
      const isReturPurchase = /retur\s*pembelian/i.test(jenisStr);
      const prefixes: string[] = [];
      if (isReturSales && !/\[RETUR-PENJUALAN\]/i.test(baseDesc)) prefixes.push("[RETUR-PENJUALAN]");
      if (isReturPurchase && !/\[RETUR-PEMBELIAN\]/i.test(baseDesc)) prefixes.push("[RETUR-PEMBELIAN]");
      if (poVal) prefixes.push(`[PO: ${poVal}]`);
      if (snVal) prefixes.push(`[SN: ${snVal}]`);
      return {
        date: row.tanggal || row.date || today,
        productId: row.productId != null && row.productId !== "" ? Number(row.productId) : findId(db?.products, row.produk),
        serialUnitId,
        type: (isReturSales || isReturPurchase) ? "RUSAK" : (toEnum("damageType", row.jenis) || "RUSAK"),
        qty: num(row.qty) || 1,
        description: prefixes.length ? `${prefixes.join(" ")} ${baseDesc}` : baseDesc,
        fileId: row.fileId ? Number(row.fileId) : undefined,
      };
    }
    case "productCategories":
      return { name: row.nama ?? row.name, description: row.deskripsi || row.description || undefined, prefix: row.prefix || undefined, status: "AKTIF" };
    case "warehouses":
      return { name: row.nama ?? row.name, city: row.kota || row.city || undefined, status: "AKTIF" };
    case "products": {
      const isJasa =
        String(row.type || row.jenisItem || "").toUpperCase().includes("JASA") ||
        String(row.tipeSN || "").toUpperCase().includes("JASA");
      return {
        sku: row.sku,
        name: row.nama ?? row.name,
        type: isJasa ? "JASA" : "BARANG",
        brand: row.merk || row.brand || undefined,
        description: row.deskripsi || row.description || undefined,
        unit: row.satuan ?? row.unit ?? (isJasa ? "Jasa" : "Unit"),
        categoryId: row.categoryId != null && row.categoryId !== "" ? Number(row.categoryId) : findId(db?.productCategories, row.kategori),
        hasSerial: isJasa ? false : (row.berSN != null ? !!row.berSN : !!row.hasSerial),
        minStock: isJasa ? 0 : num(row.min ?? row.minStock),
        warrantyMonths: row.garansi ? parseInt(String(row.garansi), 10) || undefined : undefined,
        purchasePrice: num(row.hargaBeli ?? row.purchasePrice),
        status: "AKTIF",
      };
    }
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
      const suppId =
        row.supplierId != null && row.supplierId !== ""
          ? Number(row.supplierId)
          : findId(db?.suppliers, row.supplier) ?? (db?.suppliers?.[0]?.id != null ? Number(db.suppliers[0].id) : 1);
      const poId =
        row.supplierPoId != null && row.supplierPoId !== ""
          ? Number(row.supplierPoId)
          : findId(db?.["supplier-pos"], row.po);
      const dueStr = row.jatuhTempo || row.dueDate || new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
      return {
        number: row.nomor || row.number || `INV-SUP-${Date.now().toString().slice(-5)}`,
        supplierId: suppId,
        supplierPoId: poId || undefined,
        amount: amt,
        ppn,
        total: tot,
        dueDate: dueStr && /^\d{4}-\d{2}-\d{2}/.test(dueStr) ? dueStr : new Date().toISOString().slice(0, 10),
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
  products: ["sku", "name", "type", "brand", "description", "categoryId", "unit", "hasSerial", "minStock", "warrantyMonths", "purchasePrice", "status"],
  productCategories: ["name", "description", "prefix", "status"],
  warehouses: ["name", "city", "status"],
  leadSources: ["name", "status"],
  lostReasons: ["name", "status"],
  expenseCategories: ["name", "status"],
  costCenters: ["name", "status"],
  leads: ["name", "customerId", "sourceId", "clientType", "need", "contactName", "estimatedValue", "probability", "targetClosing", "ownerId", "needsSurvey", "stage", "lostReasonId", "lostNote", "fileId"],
  surveys: ["leadId", "location", "need", "notes", "scheduleAt", "cost", "status", "memberIds", "evidenceFileId", "documentFileId", "fileId"],
  quotations: [
    "leadId",
    "customerId",
    "validUntil",
    "discount",
    "ppn",
    "pph",
    "pphMode",
    "tipePph",
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
  "po-client": ["number", "soNumber", "poClientNumber", "customerId", "supplierId", "quotationId", "amount", "date", "fileId", "soFileId", "items", "notes"],
  invoices: [
    "number",
    "clientPoId",
    "projectId",
    "customerId",
    "description",
    "type",
    "amount",
    "discount",
    "quotationId",
    "quotation",
    "ppn",
    "pph",
    "pphMode",
    "tipePph",
    "total",
    "date",
    "dueDate",
    "status",
    "fileId",
    "items",
    "subject",
    "intro",
    "notesList",
    "city",
    "kopText",
    "kopLogoUrl",
    "customerAddress",
    "signerName",
    "signerTitle",
    "dpLabel",
    "dpAmount",
  ],
  expenses: ["date", "categoryId", "amount", "description", "projectId", "surveyId", "deliveryNoteId", "costCenterId", "receiptFileId", "paidFileId"],
  "supplier-pos": ["number", "supplierSoNumber", "supplierId", "requestId", "projectId", "date", "eta", "paymentTerms", "total", "fileId", "soFileId", "doFileId", "status", "shipmentStatus", "items"],
  "purchase-requests": ["date", "costType", "projectId", "taskId", "supplierId", "condition", "purpose", "otherNote", "evidenceFileId", "items"],
  receiving: ["supplierPoId", "warehouseId", "projectId", "date", "conditionNote", "receiptFileId", "photoFileId", "items"],
  "delivery-notes": ["number", "date", "withGoods", "locations", "items", "scanFileId", "signedFileId", "reportFileId", "reportText"],
  "damage-reports": ["date", "productId", "serialUnitId", "warehouseId", "receivingId", "type", "qty", "description", "status", "fileId"],
  invoiceIn: ["number", "supplierId", "supplierPoId", "amount", "ppn", "total", "dueDate", "fileId"],
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
  if (patch.merk !== undefined) out.brand = patch.merk;
  if (patch.berSN !== undefined) out.hasSerial = !!patch.berSN;
  if (patch.min !== undefined) out.minStock = num(patch.min);
  if (patch.hargaBeli !== undefined) out.purchasePrice = num(patch.hargaBeli);
  if (patch.garansi !== undefined) out.warrantyMonths = parseInt(String(patch.garansi), 10) || undefined;
  if (patch.payment !== undefined) out.paymentTerms = patch.payment;

  if (patch.fileId !== undefined) {
    if (module === "expenses") out.receiptFileId = patch.fileId ? Number(patch.fileId) : null;
    else if (module === "purchase-requests") out.evidenceFileId = patch.fileId ? Number(patch.fileId) : null;
    else if (module === "receiving") out.receiptFileId = patch.fileId ? Number(patch.fileId) : null;
    else if (module === "delivery-notes") out.scanFileId = patch.fileId ? Number(patch.fileId) : null;
    else out.fileId = patch.fileId ? Number(patch.fileId) : null;
  }
  if (patch.receiptFileId !== undefined) out.receiptFileId = patch.receiptFileId ? Number(patch.receiptFileId) : null;
  if (patch.paidFileId !== undefined) out.paidFileId = patch.paidFileId ? Number(patch.paidFileId) : null;
  if (patch.evidenceFileId !== undefined) out.evidenceFileId = patch.evidenceFileId ? Number(patch.evidenceFileId) : null;
  if (patch.documentFileId !== undefined) out.documentFileId = patch.documentFileId ? Number(patch.documentFileId) : null;
  if (patch.scanFileId !== undefined) out.scanFileId = patch.scanFileId ? Number(patch.scanFileId) : null;
  if (patch.reportFileId !== undefined) out.reportFileId = patch.reportFileId ? Number(patch.reportFileId) : null;
  if (patch.doFileId !== undefined) out.doFileId = patch.doFileId ? Number(patch.doFileId) : null;
  if (patch.soFileId !== undefined) out.soFileId = patch.soFileId ? Number(patch.soFileId) : null;
  if (patch.prdFileId !== undefined) out.prdFileId = patch.prdFileId ? Number(patch.prdFileId) : null;
  if (patch.bahpFileId !== undefined) out.bahpFileId = patch.bahpFileId ? Number(patch.bahpFileId) : null;
  if (patch.bastFileId !== undefined) out.bastFileId = patch.bastFileId ? Number(patch.bastFileId) : null;
  if (patch.photoFileId !== undefined) out.photoFileId = patch.photoFileId ? Number(patch.photoFileId) : null;
  if (patch.latestFileId !== undefined && module === "quotations") out.fileId = patch.latestFileId ? Number(patch.latestFileId) : null;

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
    if (patch.pph !== undefined) out.pph = num(patch.pph);
    if (patch.pphMode !== undefined) out.pphMode = patch.pphMode;
    if (patch.tipePph !== undefined) out.tipePph = patch.tipePph;
    if (patch.totalAfterDisc !== undefined) out.grandTotal = num(patch.totalAfterDisc);
    if (patch.berlaku !== undefined) {
      const v = String(patch.berlaku).trim();
      out.validUntil = v && v !== "-" ? new Date(v).toISOString() : undefined;
      delete out.berlaku;
    }
    if (patch.validUntil !== undefined) {
      const v = String(patch.validUntil).trim();
      out.validUntil = v && v !== "-" ? new Date(v).toISOString() : undefined;
    }
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
    if (patch.lead !== undefined) {
      if (patch.lead === "-" || !patch.lead) {
        out.quotationId = null;
      } else {
        const selName = (String(patch.lead).split(" · ")[0] ?? "").trim().toLowerCase();
        const leadObj = (db?.leads ?? []).find((l: any) => l.nama?.toLowerCase() === selName || l.name?.toLowerCase() === selName);
        const qObj = leadObj
          ? (db?.quotations ?? []).find((q: any) => (q.leadId && String(q.leadId) === String(leadObj.id)) || (q.lead && q.lead.toLowerCase() === leadObj.nama?.toLowerCase()))
          : null;
        if (qObj?.id) out.quotationId = Number(qObj.id);
        if (leadObj?.customerId && out.customerId === undefined) out.customerId = Number(leadObj.customerId);
      }
    }
    if (patch.penawaran !== undefined) {
      out.quotationId = patch.penawaran === "-" || !patch.penawaran ? null : (findId(db?.quotations, patch.penawaran) ?? null);
    }
    if (patch.quotationId !== undefined) out.quotationId = patch.quotationId ? Number(patch.quotationId) : null;
    if (patch.pmId !== undefined) out.picId = patch.pmId ? Number(patch.pmId) : null;
    else if (patch.pm !== undefined) {
      const foundPic = findId(db?.users, patch.pm);
      if (foundPic !== undefined) out.picId = foundPic;
    }
    if (patch.mulai !== undefined) out.startDate = patch.mulai;
    if (patch.selesai !== undefined) out.endDate = patch.selesai;
    if (patch.progres !== undefined) out.progress = num(patch.progres);
    if (patch.status !== undefined) {
      out.status = toEnum("projects", patch.status) || patch.status;
      if (out.status === "SELESAI" || patch.status === "Selesai") {
        out.progress = 100;
      }
    }
    if (Array.isArray(patch.memberIds)) out.memberIds = patch.memberIds;
    else if (patch.tim !== undefined) out.memberIds = resolveMemberIds(patch, db);
  } else if (module === "tasks") {
    if (patch.pic !== undefined) out.assigneeId = findId(db?.users, patch.pic);
    if (patch.tenggat !== undefined) out.dueDate = patch.tenggat;
    if (patch.progres !== undefined) out.progress = num(patch.progres);
    if (patch.perluBarang !== undefined) out.needsPurchase = !!patch.perluBarang;
    if (patch.status !== undefined) out.status = toEnum("tasks", patch.status) || String(patch.status).replace(" ", "_");
  } else if (module === "po-client") {
    if (patch.customer !== undefined) {
      out.customerId = patch.customer && patch.customer !== "-" ? findId(db?.customers, patch.customer) : null;
    }
    if (patch.supplier !== undefined) {
      out.supplierId = patch.supplier && patch.supplier !== "-" ? findId(db?.suppliers, patch.supplier) : null;
    }
    if (patch.penawaran !== undefined) {
      out.quotationId = patch.penawaran && patch.penawaran !== "-" ? findId(db?.quotations, patch.penawaran) : null;
    }
    if (patch.nilai !== undefined) out.amount = num(patch.nilai);
    if (patch.nomorSo !== undefined) out.soNumber = patch.nomorSo;
    if (patch.nomorPoClient !== undefined) {
      out.poClientNumber = patch.nomorPoClient;
      out.number = patch.nomorPoClient;
    }
    if (patch.items !== undefined) out.items = patch.items;
  } else if (module === "supplier-pos") {
    if (patch.nomorSoSupplier !== undefined) out.supplierSoNumber = patch.nomorSoSupplier;
    if (patch.status !== undefined) out.status = toEnum("supplier-pos", patch.status) || patch.status;
    if (patch.pengiriman !== undefined || patch.shipmentStatus !== undefined) {
      const shipVal = patch.pengiriman ?? patch.shipmentStatus;
      out.shipmentStatus = toEnum("supplier-pos", shipVal) || shipVal;
    }
  } else if (module === "invoices") {
    if (patch.customer !== undefined) out.customerId = findId(db?.customers, patch.customer);
    if (patch.nilai !== undefined) out.amount = num(patch.nilai);
    if (patch.ppn !== undefined) out.ppn = num(patch.ppn);
    if (patch.pph !== undefined) out.pph = num(patch.pph);
    if (patch.pphMode !== undefined) out.pphMode = patch.pphMode;
    if (patch.tipePph !== undefined) out.tipePph = patch.tipePph;
    if (patch.total !== undefined) out.total = num(patch.total);
    if (patch.jatuhTempo !== undefined) out.dueDate = patch.jatuhTempo;
    if (patch.jenis !== undefined) out.type = toEnum("invoiceType", patch.jenis);
    if (patch.status !== undefined) out.status = toEnum("invoices", patch.status) || patch.status;
    if (patch.items !== undefined) out.items = patch.items;
    if (patch.subject !== undefined) out.subject = patch.subject;
    if (patch.intro !== undefined) out.intro = patch.intro;
    if (patch.notesList !== undefined) out.notesList = patch.notesList;
    if (patch.city !== undefined) out.city = patch.city;
    if (patch.kopText !== undefined) out.kopText = patch.kopText;
    if (patch.kopLogoUrl !== undefined) out.kopLogoUrl = patch.kopLogoUrl;
    if (patch.customerAddress !== undefined) out.customerAddress = patch.customerAddress;
    if (patch.signerName !== undefined) out.signerName = patch.signerName;
    if (patch.signerTitle !== undefined) out.signerTitle = patch.signerTitle;
    if (patch.dpLabel !== undefined) out.dpLabel = patch.dpLabel;
    if (patch.dpAmount !== undefined) out.dpAmount = num(patch.dpAmount);
  } else if (module === "delivery-notes") {
    if (patch.penerimaNama || patch.catatanSerahTerima || patch.penerimaJabatan || patch.penerimaKontak) {
      out.reportText = [
        patch.penerimaNama ? `Penerima: ${patch.penerimaNama}` : "",
        patch.penerimaJabatan ? `(${patch.penerimaJabatan})` : "",
        patch.penerimaKontak ? `[Kontak: ${patch.penerimaKontak}]` : "",
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
  } else if (module === "damage-reports") {
    if (patch.produk !== undefined) out.productId = findId(db?.products, patch.produk);
    const jenisStr = String(patch.jenis || "");
    const isReturSales = /retur\s*penjualan/i.test(jenisStr);
    const isReturPurchase = /retur\s*pembelian/i.test(jenisStr);
    if (patch.jenis !== undefined) {
      out.type = (isReturSales || isReturPurchase) ? "RUSAK" : (toEnum("damageType", patch.jenis) || "RUSAK");
    }
    if (patch.qty !== undefined) out.qty = num(patch.qty);
    if (patch.serialUnitId !== undefined) out.serialUnitId = patch.serialUnitId ? Number(patch.serialUnitId) : null;
    else if (patch.sn !== undefined) {
      const snClean = (String(patch.sn).split(" (")[0] ?? "").trim();
      const matchedSn = snClean
        ? (db?.serials ?? []).find((s: any) => String(s.sn || "").trim().toLowerCase() === snClean.toLowerCase())
        : null;
      if (matchedSn?.id != null) out.serialUnitId = Number(matchedSn.id);
    }
    if (patch.po !== undefined || patch.keterangan !== undefined || patch.sn !== undefined || isReturSales || isReturPurchase) {
      const p = patch.po && patch.po !== "-" ? (String(patch.po).split(" - ")[0] ?? "").trim() : "";
      const snClean = patch.sn && patch.sn !== "-" ? (String(patch.sn).split(" (")[0] ?? "").trim() : "";
      const d = patch.keterangan !== undefined ? patch.keterangan : "";
      const prefixes: string[] = [];
      if (isReturSales && !/\[RETUR-PENJUALAN\]/i.test(d)) prefixes.push("[RETUR-PENJUALAN]");
      if (isReturPurchase && !/\[RETUR-PEMBELIAN\]/i.test(d)) prefixes.push("[RETUR-PEMBELIAN]");
      if (p) prefixes.push(`[PO: ${p}]`);
      if (snClean) prefixes.push(`[SN: ${snClean}]`);
      if (prefixes.length) {
        out.description = `${prefixes.join(" ")} ${d}`.trim();
      } else if (d) {
        out.description = d;
      }
    }
  } else if (
    ["customers", "suppliers", "products", "productCategories", "warehouses", "leadSources", "lostReasons", "expenseCategories", "costCenters"].includes(module)
  ) {
    if (patch.status !== undefined) out.status = toEnum("users", patch.status) || patch.status;
    if (module === "products") {
      if (patch.kategori !== undefined) out.categoryId = findId(db?.productCategories, patch.kategori);
      if (patch.jenisItem !== undefined || patch.type !== undefined) {
        const isJasa = String(patch.type || patch.jenisItem || "").toUpperCase().includes("JASA");
        out.type = isJasa ? "JASA" : "BARANG";
        if (isJasa) out.hasSerial = false;
      }
    }
  } else if (module === "purchase-requests") {
    if (patch.jenisBiaya !== undefined || patch.costType !== undefined) {
      out.costType = String(toEnum("costType", patch.costType || patch.jenisBiaya) || patch.costType || patch.jenisBiaya || "STOK").toUpperCase();
    }
    if (patch.project !== undefined) out.projectId = findId(db?.projects, patch.project);
    if (patch.supplier !== undefined) out.supplierId = findId(db?.suppliers, patch.supplier);
  } else if (module === "supplier-pos") {
    if (patch.supplier !== undefined) out.supplierId = findId(db?.suppliers, patch.supplier);
    if (patch.total !== undefined) out.total = num(patch.total);
    if (patch.eta !== undefined) out.eta = patch.eta ? new Date(patch.eta).toISOString() : undefined;
    if (patch.item !== undefined) {
      const cleanItem = String(patch.item || "").replace(/\s*x\s*\d+.*$/, "").trim().toLowerCase();
      const prod = (db?.products ?? []).find(
        (p: any) =>
          String(p.nama || p.name || "").trim().toLowerCase() === cleanItem ||
          String(p.sku || "").trim().toLowerCase() === cleanItem
      );
      if (prod) {
        out.items = [
          {
            productId: Number(prod.id),
            qty: 1,
            price: num(patch.total) || Number(prod.purchasePrice || prod.hargaBeli || 0),
          },
        ];
      }
    }
    if (patch.items !== undefined && Array.isArray(patch.items)) {
      out.items = patch.items;
    }
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
