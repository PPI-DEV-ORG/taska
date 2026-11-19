const MAPS: Record<string, Record<string, string>> = {
  "poc-reports": {
    Draft: "Draft",
    Planned: "Planned",
    Preparation: "Preparation",
    Ready: "Ready",
    "In Progress": "In Progress",
    Completed: "Completed",
    "On Hold": "On Hold",
    Cancelled: "Cancelled",
  },
  "visit-reports": {
    Planned: "Planned",
    Completed: "Completed",
    Cancelled: "Cancelled",
  },
  "maintenance-reports": {
    Scheduled: "Scheduled",
    In_Progress: "In_Progress",
    Completed: "Completed",
    Cancelled: "Cancelled",
  },
  leads: {
    PROSPECTING: "Prospecting",
    QUALIFICATION: "Qualification",
    PROPOSAL: "Proposal",
    NEGOTIATION: "Negotiation",
    WON: "Won",
    LOST: "Lost",
  },
  quotations: {
    NOT_YET: "Not Yet",
    DONE: "Done",
    DRAFT: "Draft",
    PENDING_APPROVAL: "Menunggu persetujuan",
    APPROVED: "Disetujui",
    REJECTED: "Ditolak",
    SENT: "Terkirim",
    NEGOTIATION: "Negosiasi",
    REVISION: "Revisi",
    EXPIRED: "Kedaluwarsa",
  },
  surveys: {
    DIMINTA: "Diminta",
    DIJADWALKAN: "Dijadwalkan",
    BERJALAN: "Berjalan",
    SELESAI: "Selesai",
    BATAL: "Dibatalkan",
  },
  "po-client": {
    PENDING: "Belum dibayar",
    DITERIMA: "Belum dibayar",
    LUNAS_SEBAGIAN: "Lunas sebagian",
    LUNAS: "Lunas",
    DIBATALKAN: "Dibatalkan",
  },
  invoices: {
    DRAFT: "Belum dikirim",
    SENT: "Terkirim",
    PARTIAL: "Dibayar sebagian",
    PAID: "Lunas",
    OVERDUE: "Terlambat",
    BATAL: "Dibatalkan",
  },
  projects: {
    DIRENCANAKAN: "Direncanakan",
    BERJALAN: "Berjalan",
    DITUNDA: "Ditunda",
    TERLAMBAT: "Terlambat",
    SELESAI: "Selesai",
  },
  tasks: {
    TODO: "TODO",
    IN_PROGRESS: "IN PROGRESS",
    PENDING: "PENDING",
    TESTED: "TESTED",
    DONE: "DONE",
    REJECTED: "REJECTED",
    BLOCKED: "BLOCKED",
  },
  "purchase-requests": {
    DIAJUKAN: "Diajukan",
    CEK_STOK: "Cek stok",
    DISETUJUI: "Disetujui",
    DIBAYAR: "Dibayar",
    DITOLAK: "Ditolak",
    PO_DIBUAT: "PO dibuat",
    DIKIRIM: "Dikirim",
    DITERIMA: "Diterima",
    DIBATALKAN: "Dibatalkan",
  },
  "supplier-pos": {
    MENUNGGU_PERSETUJUAN: "Menunggu persetujuan",
    DISETUJUI: "Disetujui",
    DITOLAK: "Ditolak",
    DIBATALKAN: "Dibatalkan",
    BELUM_DIKIRIM: "Di Supplier",
    DI_SUPPLIER: "Di Supplier",
    DALAM_PERJALANAN: "Dalam Perjalanan",
    DIKIRIM: "Dikirim",
    SAMPAI: "Sampai",
  },
  receiving: {
    MENUNGGU: "Menunggu penerimaan",
    DITERIMA_SEBAGIAN: "Diterima sebagian",
    DITERIMA: "Diterima",
    DITOLAK: "Ditolak",
  },
  "delivery-notes": {
    PENDING: "Menunggu pengiriman",
    DIKIRIM: "Dikirim",
    DITERIMA: "Diterima",
    DIBATALKAN: "Dibatalkan",
  },
  expenses: {
    DILAPORKAN: "Dilaporkan",
    DISETUJUI: "Disetujui",
    DITOLAK: "Ditolak",
    DIBAYAR: "Dibayar",
  },
  "damage-reports": {
    DILAPORKAN: "Dilaporkan",
    DIPROSES: "Diproses",
    SELESAI: "Selesai",
  },
  users: { AKTIF: "Aktif", NONAKTIF: "Nonaktif" },
  opname: {
    DRAFT: "Draft",
    MENUNGGU_PERSETUJUAN: "Menunggu persetujuan",
    DISETUJUI: "Disetujui",
    DITOLAK: "Ditolak",
  },
  serials: {
    DI_GUDANG: "Di gudang",
    RESERVED: "Reserved",
    DIKIRIM: "Dikirim",
    TERPASANG: "Terpasang",
    RETUR: "Retur",
    DIGANTI: "Diganti",
    RUSAK: "Rusak",
  },
  movements: { IN: "Masuk", OUT: "Keluar", TRANSFER: "Transfer" },
  costType: {
    PROJECT: "Project",
    STOK: "Stok",
    INTERNAL: "Internal",
    LAINNYA: "Lainnya",
  },
  clientType: {
    PARTNER: "Partner",
    END_USER: "End user",
    SI: "SI (Sistem Integrator)",
  },
  invoiceType: { DP: "DP", TERMIN: "Termin", PELUNASAN: "Pelunasan" },
  projectType: {
    CUSTOMER: "Customer",
    PRODUCT_RD: "Product/R&D",
    INTERNAL: "Internal",
    MAINTENANCE: "Maintenance",
    SUPPORT: "Support",
    OTHER: "Lainnya",
  },
  paymentStatus: {
    BELUM_LUNAS: "Belum lunas",
    LUNAS_SEBAGIAN: "Lunas sebagian",
    LUNAS: "Lunas",
  },
  damageType: {
    RUSAK: "Rusak",
    SALAH_BARANG: "Salah barang",
    KURANG: "Kurang",
  },
  followupMethod: {
    EMAIL: "Email",
    TELEPON: "Telepon",
    WA: "WhatsApp",
    LAINNYA: "Lainnya",
  },
  movementCategory: {
    PENERIMAAN_SUPPLIER: "Penerimaan supplier",
    KELUAR_PROJECT: "Keluar ke project",
    KELUAR_SURAT_JALAN: "Keluar surat jalan",
    TRANSFER: "Transfer antar gudang",
    RETUR_PROJECT: "Retur dari project",
    BARANG_TERPAKAI: "Barang terpakai langsung",
    PENGGANTIAN: "Penggantian unit",
    PENYESUAIAN_OPNAME: "Penyesuaian opname",
    SALDO_AWAL: "Saldo awal gudang",
    LAINNYA: "Lainnya",
  },
};

const REVERSE: Record<string, Record<string, string>> = {};
for (const [k, m] of Object.entries(MAPS)) {
  REVERSE[k] = {};
  for (const [enumVal, label] of Object.entries(m)) REVERSE[k][label] = enumVal;
}
REVERSE.clientType = {
  ...REVERSE.clientType,
  end_user: "END_USER",
  enduser: "END_USER",
  "End User": "END_USER",
  ENDUSER: "END_USER",
  partner: "PARTNER",
  Partner: "PARTNER",
  si: "SI",
  SI: "SI",
};
REVERSE["supplier-pos"] = {
  ...REVERSE["supplier-pos"],
  "Di Supplier": "DI_SUPPLIER",
  "Dalam Perjalanan": "DIKIRIM",
  Dikirim: "DIKIRIM",
  Sampai: "SAMPAI",
  "Sampai (Belum Lunas)": "SAMPAI_BELUM_LUNAS",
  "Belum Dikirim": "DI_SUPPLIER",
};
REVERSE["purchase-requests"] = {
  ...REVERSE["purchase-requests"],
  "Diterima (Belum Lunas)": "DITERIMA",
  Lunas: "DIBAYAR",
  Selesai: "DITERIMA",
};
REVERSE["delivery-notes"] = {
  ...REVERSE["delivery-notes"],
  Terima: "DITERIMA",
  Selesai: "DITERIMA",
  Kirim: "DIKIRIM",
  Batal: "DIBATALKAN",
};
REVERSE.surveys = {
  ...REVERSE.surveys,
  Batal: "BATAL",
  Dibatalkan: "BATAL",
};
REVERSE.invoices = {
  ...REVERSE.invoices,
  Lunas: "PAID",
  "Dibayar sebagian": "PARTIAL",
  "Belum dikirim": "DRAFT",
  Terkirim: "SENT",
  Dibatalkan: "BATAL",
  Terlambat: "OVERDUE",
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
REVERSE["supplier-pos"] = {
  ...REVERSE["supplier-pos"],
  Sampai: "SAMPAI",
  "Sampai (Belum Lunas)": "SAMPAI_BELUM_LUNAS",
  Lunas: "LUNAS",
  Dikirim: "DIKIRIM",
  "Di Supplier": "DI_SUPPLIER",
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
      if (
        k.toLowerCase() === normalized ||
        k.replace(/_/g, "") === normalized.replace(/_/g, "")
      ) {
        return k;
      }
    }
  }

  return str;
}
