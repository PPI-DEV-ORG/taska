export type Action = "M" | "L" | "C" | "U" | "A" | "P" | "V" | "E";

export type ModuleKey =
  | "dashboard"
  | "calendar"
  | "customers"
  | "suppliers"
  | "products"
  | "productCategories"
  | "warehouses"
  | "leadSources"
  | "lostReasons"
  | "expenseCategories"
  | "costCenters"
  | "users"
  | "settings"
  | "leads"
  | "surveys"
  | "quotations"
  | "poClient"
  | "financeOut"
  | "invoices"
  | "accounting"
  | "projects"
  | "tasks"
  | "requests"
  | "procurement"
  | "shipments"
  | "receiving"
  | "stock"
  | "opname"
  | "damageReports"
  | "delivery"
  | "expenses"
  | "approvals"
  | "reports"
  | "archive"
  | "audit"
  | "attendance"
  | "payroll"
  | "pocReports"
  | "visitReports"
  | "masterData";

const ALL: Record<ModuleKey, Action[]> = {
  dashboard: ["M", "L", "C", "U", "A", "P", "V", "E"],
  calendar: ["M", "L", "C", "U", "A", "P", "V", "E"],
  customers: ["M", "L", "C", "U", "A", "P", "V", "E"],
  suppliers: ["M", "L", "C", "U", "A", "P", "V", "E"],
  products: ["M", "L", "C", "U", "A", "P", "V", "E"],
  productCategories: ["M", "L", "C", "U", "A", "P", "V", "E"],
  warehouses: ["M", "L", "C", "U", "A", "P", "V", "E"],
  leadSources: ["M", "L", "C", "U", "A", "P", "V", "E"],
  lostReasons: ["M", "L", "C", "U", "A", "P", "V", "E"],
  expenseCategories: ["M", "L", "C", "U", "A", "P", "V", "E"],
  costCenters: ["M", "L", "C", "U", "A", "P", "V", "E"],
  users: ["M", "L", "C", "U", "A", "P", "V", "E"],
  settings: ["M", "L", "C", "U", "A", "P", "V", "E"],
  leads: ["M", "L", "C", "U", "A", "P", "V", "E"],
  surveys: ["M", "L", "C", "U", "A", "P", "V", "E"],
  quotations: ["M", "L", "C", "U", "A", "P", "V", "E"],
  poClient: ["M", "L", "C", "U", "A", "P", "V", "E"],
  financeOut: ["M", "L", "C", "U", "A", "P", "V", "E"],
  invoices: ["M", "L", "C", "U", "A", "P", "V", "E"],
  accounting: ["M", "L", "C", "U", "A", "P", "V", "E"],
  projects: ["M", "L", "C", "U", "A", "P", "V", "E"],
  tasks: ["M", "L", "C", "U", "A", "P", "V", "E"],
  requests: ["M", "L", "C", "U", "A", "P", "V", "E"],
  procurement: ["M", "L", "C", "U", "A", "P", "V", "E"],
  shipments: ["M", "L", "C", "U", "A", "P", "V", "E"],
  receiving: ["M", "L", "C", "U", "A", "P", "V", "E"],
  stock: ["M", "L", "C", "U", "A", "P", "V", "E"],
  opname: ["M", "L", "C", "U", "A", "P", "V", "E"],
  damageReports: ["M", "L", "C", "U", "A", "P", "V", "E"],
  delivery: ["M", "L", "C", "U", "A", "P", "V", "E"],
  expenses: ["M", "L", "C", "U", "A", "P", "V", "E"],
  approvals: ["M", "L", "C", "U", "A", "P", "V", "E"],
  reports: ["M", "L", "C", "U", "A", "P", "V", "E"],
  archive: ["M", "L", "C", "U", "A", "P", "V", "E"],
  audit: ["M", "L", "C", "U", "A", "P", "V", "E"],
  attendance: ["M", "L", "C", "U", "A", "P", "V", "E"],
  payroll: ["M", "L", "C", "U", "A", "P", "V", "E"],
  pocReports: ["M", "L", "C", "U", "A", "P", "V", "E"],
  visitReports: ["M", "L", "C", "U", "A", "P", "V", "E"],
  masterData: ["M", "L", "C", "U", "A", "P", "V", "E"],
};

function grant(actions: string): Action[] {
  return [...new Set(actions.split(""))] as Action[];
}

type Table = Partial<Record<ModuleKey, string>>;

/** Matriks peran PRD: role x modul x L/C/U/A. */
export const PERMISSIONS: Record<string, Table> = {
  SUPER_ADMIN: Object.fromEntries(Object.keys(ALL).map((k) => [k, "LCUA"])) as Table,

  ADMIN: Object.fromEntries(Object.keys(ALL).map((k) => [k, "LCUA"])) as Table,

  BOS: Object.fromEntries(Object.keys(ALL).map((k) => [k, "LCUA"])) as Table,

  SALES: {
    dashboard: "L",
    users: "L",
    customers: "LCU",
    suppliers: "LCU",
    products: "L",
    productCategories: "L",
    warehouses: "L",
    stock: "LCU",
    leadSources: "LCU",
    lostReasons: "LCU",
    expenseCategories: "L",
    costCenters: "L",
    leads: "LCU",
    surveys: "LCU",
    quotations: "LCU",
    financeOut: "LCU",
    projects: "LCU",
    delivery: "LCU",
    expenses: "LCU",
    pocReports: "LCU",
    visitReports: "LCU",
    reports: "L",
  },

  PM: {
    dashboard: "L",
    users: "L",
    customers: "LCU",
    suppliers: "LCU",
    products: "L",
    productCategories: "L",
    warehouses: "L",
    leadSources: "L",
    lostReasons: "L",
    expenseCategories: "L",
    costCenters: "L",
    leads: "LCU",
    surveys: "LCUA",
    quotations: "LCU",
    financeOut: "LCU",
    projects: "LCU",
    tasks: "LCU",
    requests: "LCU",
    procurement: "L",
    receiving: "L",
    stock: "LCU",
    delivery: "LCU",
    expenses: "LCU",
    pocReports: "LCU",
    visitReports: "LCU",
    reports: "L",
  },

  TEKNISI: {
    dashboard: "L",
    users: "L",
    customers: "LCU",
    suppliers: "LCU",
    products: "L",
    warehouses: "L",
    expenseCategories: "L",
    costCenters: "L",
    surveys: "LCU",
    projects: "LU",
    tasks: "LU",
    requests: "LC",
    stock: "LC",
    delivery: "LCU",
    expenses: "LCU",
    pocReports: "LCU",
    visitReports: "LCU",
    reports: "L",
  },

  PROCUREMENT: {
    dashboard: "L",
    users: "L",
    customers: "LCU",
    suppliers: "LCUD",
    products: "LCUD",
    productCategories: "LCUD",
    warehouses: "LCU",
    expenseCategories: "L",
    costCenters: "L",
    projects: "L",
    financeOut: "L",
    requests: "LCU",
    procurement: "LCUA",
    receiving: "LCUA",
    stock: "LCUDA",
    delivery: "LCUA",
    expenses: "LCU",
    pocReports: "LCU",
    visitReports: "LCU",
    approvals: "LA",
    reports: "L",
  },

  FINANCE: {
    dashboard: "L",
    users: "L",
    customers: "LCU",
    suppliers: "LCU",
    products: "L",
    productCategories: "L",
    expenseCategories: "LCU",
    costCenters: "LCU",
    warehouses: "L",
    leads: "L",
    surveys: "LU",
    quotations: "LCUA",
    financeOut: "LCUA",
    projects: "LCU",
    tasks: "LCU",
    requests: "LCUA",
    procurement: "LCUA",
    receiving: "L",
    stock: "LCUA",
    delivery: "LCUA",
    expenses: "LCUA",
    pocReports: "LCUA",
    visitReports: "LCUA",
    approvals: "LCUA",
    reports: "L",
    archive: "L",
  },

  GUDANG: {
    dashboard: "L",
    users: "L",
    customers: "LCU",
    suppliers: "LCU",
    products: "LCU",
    productCategories: "LCU",
    warehouses: "LCU",
    expenseCategories: "L",
    costCenters: "L",
    projects: "L",
    financeOut: "L",
    requests: "LCU",
    procurement: "LU",
    receiving: "LCUA",
    stock: "LCU",
    delivery: "LCU",
    expenses: "LCU",
    pocReports: "LCU",
    visitReports: "LCU",
    approvals: "LA",
    reports: "L",
  },

  SE: {
    dashboard: "L",
    users: "L",
    products: "L",
    warehouses: "L",
    stock: "LC",
    expenseCategories: "L",
    costCenters: "L",
    surveys: "LCU",
    projects: "LU",
    tasks: "LU",
    requests: "LC",
    delivery: "LCU",
    expenses: "LCU",
    pocReports: "LCU",
    visitReports: "LCU",
    reports: "L",
  },

  HR: {
    dashboard: "L",
    users: "LCU",
    customers: "LCU",
    suppliers: "LCU",
    attendance: "LCUA",
    payroll: "LCUA",
    expenseCategories: "L",
    costCenters: "L",
    expenses: "LCU",
    surveys: "L",
    projects: "L",
    tasks: "L",
    requests: "LC",
    pocReports: "LCU",
    visitReports: "LCU",
    reports: "L",
  },
};

// Absensi: setiap karyawan boleh melihat & mencatat absen miliknya (service membatasi ke data sendiri).
// Payroll: setiap karyawan boleh melihat slip miliknya (L); Finance/HR/Admin/Bos memiliki akses penuh (LCUA).
for (const table of Object.values(PERMISSIONS)) {
  if (!table.attendance) table.attendance = "LC";
  if (!table.payroll) table.payroll = "L";
  if (!table.calendar) table.calendar = "LCU";
}
PERMISSIONS.FINANCE!.attendance = "LCU";
PERMISSIONS.FINANCE!.payroll = "LCUAPVE";
PERMISSIONS.FINANCE!.accounting = "LCUAPVE";
PERMISSIONS.FINANCE!.invoices = "LCUAPVE";
PERMISSIONS.FINANCE!.poClient = "LCUAPVE";
PERMISSIONS.FINANCE!.quotations = "LCUAPVE";
PERMISSIONS.FINANCE!.projects = "LCUP";
PERMISSIONS.HR!.attendance = "LCUAPVE";
PERMISSIONS.HR!.payroll = "LCUAPVE";
PERMISSIONS.PM!.projects = "LCUP";
PERMISSIONS.SUPER_ADMIN = Object.fromEntries(Object.keys(ALL).map((k) => [k, "LCUAPVE"])) as Table;
PERMISSIONS.ADMIN = Object.fromEntries(Object.keys(ALL).map((k) => [k, "LCUAPVE"])) as Table;
PERMISSIONS.BOS = Object.fromEntries(Object.keys(ALL).map((k) => [k, "LCUAPVE"])) as Table;

export type RoleDefinition = {
  code: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: Record<string, string>;
};

export const ROLE_METADATA: Record<string, { name: string; description: string }> = {
  SUPER_ADMIN: { name: "Super Admin", description: "Akses penuh ke seluruh modul, pengaturan sistem, dan manajemen peran" },
  ADMIN: { name: "Admin", description: "Administrator operasional kantor dengan akses seluruh modul" },
  BOS: { name: "Direktur / Bos", description: "Pimpinan perusahaan dengan akses persetujuan, laporan P&L, dan seluruh modul" },
  SALES: { name: "Sales", description: "Tim penjualan: mengelola leads, survey, penawaran, SO, dan relasi customer" },
  PM: { name: "Project Manager", description: "Manajer proyek: mengelola jalannya proyek, tugas tim, P&L proyek, dan BAST" },
  TEKNISI: { name: "Teknisi", description: "Tim teknis lapangan: eksekusi tugas proyek, survey lokasi, dan instalasi" },
  PROCUREMENT: { name: "Procurement / Purchasing", description: "Tim pengadaan: mengelola PR, PO Supplier, penerimaan barang, dan harga vendor" },
  FINANCE: { name: "Finance & Accounting", description: "Tim keuangan: mengelola invoice keluar/masuk, pembayaran, pengeluaran, COA, dan P&L" },
  GUDANG: { name: "Admin Gudang", description: "Tim logistik & gudang: mengelola stok, serial number, opname, penerimaan, dan surat jalan" },
  SE: { name: "System Engineer / Presales", description: "Tim presales & solusi teknis: POC, demo, survey, dan pendampingan teknis" },
  HR: { name: "HR / Personalia", description: "Tim SDM: mengelola data karyawan, rekap absensi, lembur, dan slip gaji (payroll)" },
};

const MODULE_ALIASES: Record<string, string[]> = {
  financeOut: ["financeOut", "invoices", "poClient", "po-client", "accounting"],
  invoices: ["invoices", "financeOut"],
  poClient: ["poClient", "po-client", "financeOut"],
  "po-client": ["po-client", "poClient", "financeOut"],
  procurement: ["procurement", "supplier-pos"],
  "supplier-pos": ["supplier-pos", "procurement"],
  requests: ["requests", "purchase-requests"],
  "purchase-requests": ["purchase-requests", "requests"],
  delivery: ["delivery", "delivery-notes"],
  "delivery-notes": ["delivery-notes", "delivery"],
  pocReports: ["pocReports", "poc-reports"],
  "poc-reports": ["poc-reports", "pocReports"],
  visitReports: ["visitReports", "visit-reports"],
  "visit-reports": ["visit-reports", "visitReports"],
  damageReports: ["damageReports", "damage-reports", "stock"],
  "damage-reports": ["damage-reports", "damageReports", "stock"],
  audit: ["audit", "audit-log"],
  "audit-log": ["audit-log", "audit"],
  masterData: [
    "masterData",
    "master-data",
    "products",
    "customers",
    "suppliers",
    "settings",
    "warehouses",
    "productCategories",
    "leadSources",
    "lostReasons",
    "expenseCategories",
    "costCenters",
  ],
  "master-data": [
    "master-data",
    "masterData",
    "products",
    "customers",
    "suppliers",
    "settings",
    "warehouses",
    "productCategories",
    "leadSources",
    "lostReasons",
    "expenseCategories",
    "costCenters",
  ],
  leadSources: ["leadSources", "lead-sources", "master-data", "masterData", "leads", "settings"],
  "lead-sources": ["lead-sources", "leadSources", "master-data", "masterData", "leads", "settings"],
  dealTypes: ["dealTypes", "deal-types", "master-data", "masterData", "leads", "settings"],
  "deal-types": ["deal-types", "dealTypes", "master-data", "masterData", "leads", "settings"],
  lostReasons: ["lostReasons", "lost-reasons", "master-data", "masterData", "leads", "quotations", "settings"],
  "lost-reasons": ["lost-reasons", "lostReasons", "master-data", "masterData", "leads", "quotations", "settings"],
  expenseCategories: ["expenseCategories", "expense-categories", "master-data", "masterData", "expenses", "accounting", "settings"],
  "expense-categories": ["expense-categories", "expenseCategories", "master-data", "masterData", "expenses", "accounting", "settings"],
  costCenters: ["costCenters", "cost-centers", "master-data", "masterData", "expenses", "accounting", "projects", "settings"],
  "cost-centers": ["cost-centers", "costCenters", "master-data", "masterData", "expenses", "accounting", "projects", "settings"],
  productCategories: ["productCategories", "product-categories", "master-data", "masterData", "products", "stock", "settings"],
  "product-categories": ["product-categories", "productCategories", "master-data", "masterData", "products", "stock", "settings"],
  warehouses: ["warehouses", "master-data", "masterData", "stock", "settings"],
  settings: ["settings", "master-data", "masterData"],
  hr: ["hr", "attendance", "payroll"],
  attendance: ["attendance", "hr"],
  payroll: ["payroll", "hr"],
  accounting: ["accounting", "financeOut"],
  opname: ["opname", "stock"],
  shipments: ["shipments", "supplier-pos", "procurement"],
};

export const DEFAULT_UI_PERMISSIONS: Record<string, Record<string, string>> = {
  SUPER_ADMIN: Object.fromEntries(
    [
      "leads", "quotations", "surveys", "poc-reports", "visit-reports", "customers",
      "po-client", "projects", "tasks", "delivery-notes",
      "purchase-requests", "supplier-pos", "shipments", "receiving", "stock", "opname", "damage-reports", "suppliers", "warehouses", "products",
      "invoices", "expenses", "accounting", "reports",
      "hr",
      "dashboard", "calendar", "approvals", "master-data", "users", "archive", "audit-log",
    ].map((k) => [k, "MLCUAPVE"])
  ),
  ADMIN: Object.fromEntries(
    [
      "leads", "quotations", "surveys", "poc-reports", "visit-reports", "customers",
      "po-client", "projects", "tasks", "delivery-notes",
      "purchase-requests", "supplier-pos", "shipments", "receiving", "stock", "opname", "damage-reports", "suppliers", "warehouses", "products",
      "invoices", "expenses", "accounting", "reports",
      "hr",
      "dashboard", "calendar", "approvals", "master-data", "users", "archive", "audit-log",
    ].map((k) => [k, "MLCUAPVE"])
  ),
  BOS: Object.fromEntries(
    [
      "leads", "quotations", "surveys", "poc-reports", "visit-reports", "customers",
      "po-client", "projects", "tasks", "delivery-notes",
      "purchase-requests", "supplier-pos", "shipments", "receiving", "stock", "opname", "damage-reports", "suppliers", "warehouses", "products",
      "invoices", "expenses", "accounting", "reports",
      "hr",
      "dashboard", "calendar", "approvals", "master-data", "users", "archive", "audit-log",
    ].map((k) => [k, "MLCUAPVE"])
  ),
  SALES: {
    dashboard: "ML",
    calendar: "MLCUA",
    leads: "MLCUAEP",
    quotations: "MLCUPEA",
    surveys: "MLCUA",
    "poc-reports": "MLCUA",
    "visit-reports": "MLCUA",
    customers: "MLCUA",
    "po-client": "MLCU",
    "delivery-notes": "ML",
    expenses: "MLCU",
    hr: "MLC",
    "master-data": "ML",
    products: "L",
    stock: "L",
    projects: "L",
    suppliers: "L",
    reports: "L",
    invoices: "L",
  },
  PM: {
    dashboard: "ML",
    calendar: "MLCUA",
    projects: "MLCUPE",
    tasks: "MLCU",
    surveys: "MLCUAP",
    "poc-reports": "MLCUAP",
    "visit-reports": "MLCUAP",
    "purchase-requests": "MLCU",
    "delivery-notes": "MLCU",
    expenses: "MLCU",
    hr: "MLC",
    quotations: "L",
    leads: "L",
    customers: "LCU",
    stock: "L",
    products: "L",
    suppliers: "L",
    reports: "L",
  },
  TEKNISI: {
    dashboard: "ML",
    calendar: "MLCUA",
    tasks: "MLU",
    projects: "ML",
    surveys: "MLCUA",
    "poc-reports": "MLCUA",
    "visit-reports": "MLCUA",
    "purchase-requests": "MLC",
    "delivery-notes": "ML",
    expenses: "MLC",
    hr: "MLC",
    customers: "LC",
    stock: "L",
    products: "L",
    warehouses: "L",
  },
  PROCUREMENT: {
    dashboard: "ML",
    calendar: "MLCUA",
    approvals: "MLVA",
    "purchase-requests": "MLCUV",
    "supplier-pos": "MLCUAPE",
    shipments: "MLCU",
    receiving: "MLCUA",
    stock: "MLCUP",
    opname: "MLCU",
    "damage-reports": "MLCU",
    suppliers: "MLCUA",
    warehouses: "MLCU",
    products: "MLCUP",
    "delivery-notes": "MLCU",
    expenses: "MLCU",
    hr: "MLC",
    "master-data": "ML",
    customers: "LC",
    projects: "L",
    reports: "L",
    invoices: "L",
    quotations: "L",
    "po-client": "L",
  },
  FINANCE: {
    dashboard: "ML",
    calendar: "MLCUA",
    approvals: "MLVA",
    invoices: "MLCUAPVE",
    accounting: "MLCUAPVE",
    expenses: "MLCUAPVE",
    hr: "MLCUAPVE",
    "po-client": "MLCUP",
    "purchase-requests": "MLUV",
    "supplier-pos": "MLCUPVE",
    "delivery-notes": "MLC",
    reports: "MLPE",
    quotations: "LPE",
    projects: "LP",
    archive: "L",
    customers: "LCU",
    suppliers: "LCU",
    leads: "L",
    products: "L",
    receiving: "L",
    shipments: "L",
    stock: "L",
  },
  GUDANG: {
    dashboard: "ML",
    calendar: "MLCUA",
    approvals: "MLVA",
    stock: "MLCU",
    opname: "MLCUA",
    receiving: "MLCUA",
    "delivery-notes": "MLCU",
    "damage-reports": "MLCUA",
    "purchase-requests": "MLCU",
    "supplier-pos": "ML",
    warehouses: "MLCUA",
    products: "MLCUA",
    expenses: "MLCUA",
    hr: "MLC",
    "master-data": "ML",
    customers: "L",
    suppliers: "L",
    shipments: "L",
    invoices: "L",
    quotations: "L",
    projects: "L",
    "po-client": "L",
  },
  SE: {
    dashboard: "ML",
    calendar: "MLCUA",
    "poc-reports": "MLCUA",
    "visit-reports": "MLCUA",
    surveys: "MLCU",
    projects: "MLCU",
    tasks: "MLCU",
    "delivery-notes": "ML",
    "purchase-requests": "MLCU",
    expenses: "MLC",
    hr: "MLC",
    leads: "L",
    quotations: "L",
    customers: "L",
    suppliers: "L",
    products: "L",
    stock: "L",
  },
  HR: {
    dashboard: "ML",
    calendar: "MLCUA",
    hr: "MLCUAPVE",
    users: "MLCU",
    expenses: "MLCU",
    "purchase-requests": "MLC",
    reports: "ML",
    "visit-reports": "ML",
    "poc-reports": "ML",
    customers: "L",
    suppliers: "L",
    products: "L",
    stock: "L",
    projects: "L",
    leads: "L",
    quotations: "L",
    invoices: "L",
    "delivery-notes": "L",
    surveys: "L",
  },
};

function buildRoleDefinition(code: string, perms?: Record<string, any>, isSys: boolean = true): RoleDefinition {
  const norm = code.toUpperCase();
  const defaultUi = DEFAULT_UI_PERMISSIONS[norm] ?? {};
  const basePerms: Record<string, string> = { ...defaultUi };

  if (perms) {
    for (const [k, v] of Object.entries(perms)) {
      if (Array.isArray(v)) {
        basePerms[k] = v.join("");
      } else if (typeof v === "string") {
        basePerms[k] = v;
      }
    }
  }

  return {
    code: norm,
    name: ROLE_METADATA[norm]?.name ?? code,
    description: ROLE_METADATA[norm]?.description ?? `Peran ${code}`,
    isSystem: isSys,
    permissions: basePerms,
  };
}

let dynamicRolesStore: RoleDefinition[] = Object.keys(DEFAULT_UI_PERMISSIONS).map((code) =>
  buildRoleDefinition(code, undefined, true),
);

export function getDynamicRoles(): RoleDefinition[] {
  return dynamicRolesStore;
}

export function setDynamicRoles(roles: RoleDefinition[]) {
  if (!Array.isArray(roles) || roles.length === 0) return;
  const byCode = new Map<string, RoleDefinition>();

  // Inisialisasi 11 role sistem dari DEFAULT_UI_PERMISSIONS
  for (const code of Object.keys(DEFAULT_UI_PERMISSIONS)) {
    byCode.set(code, buildRoleDefinition(code, undefined, true));
  }

  for (const r of roles) {
    if (!r || !r.code) continue;
    const normCode = String(r.code).toUpperCase().trim().replace(/[\s\-]+/g, "_");
    const isSys = Boolean(DEFAULT_UI_PERMISSIONS[normCode]);
    const existing = byCode.get(normCode);
    const hasCustomPerms = r.permissions && Object.keys(r.permissions).length > 0;

    byCode.set(normCode, {
      code: normCode,
      name: r.name || existing?.name || normCode,
      description: r.description ?? existing?.description ?? "",
      isSystem: isSys,
      permissions: hasCustomPerms
        ? Object.fromEntries(
            Object.entries(r.permissions).map(([k, v]) => [k, Array.isArray(v) ? v.join("") : String(v)])
          )
        : (existing?.permissions ?? {}),
    });
  }

  dynamicRolesStore = Array.from(byCode.values());
}

export function can(role: string, module: ModuleKey | string, action: Action): boolean {
  const norm = (role || "").toUpperCase().trim().replace(/[\s\-]+/g, "_");
  if (norm === "SUPER_ADMIN" || norm === "SUPERADMIN") return true;

  const dynRole = dynamicRolesStore.find((r) => r.code === norm);
  const table: Record<string, string | string[] | undefined> = dynRole?.permissions ?? PERMISSIONS[norm] ?? PERMISSIONS[role] ?? {};
  if (!table) return false;

  const candidates = MODULE_ALIASES[module] ?? [module as string];
  for (const mod of candidates) {
    const rawActions = table[mod];
    if (rawActions) {
      const actionsList = Array.isArray(rawActions) ? rawActions : grant(String(rawActions));
      if (actionsList.includes(action)) {
        return true;
      }
      // Hak Menu/Page ('M') otomatis boleh membaca data ('L')
      if (action === "L" && actionsList.includes("M")) {
        return true;
      }
      // Backward compatibility: jika role legacy hanya punya 'L'
      if (action === "M" && actionsList.includes("L") && !actionsList.includes("M")) {
        return true;
      }
      // Saling kompatibel antara 'V' (Approve di UI) dan 'A' (Approve legacy) pada modul approvals
      if (module === "approvals" && (action === "A" || action === "V") && (actionsList.includes("V") || actionsList.includes("A"))) {
        return true;
      }
    }
  }

  // Jika cek modul approvals untuk persetujuan ('A' atau 'V'), izinkan jika role punya hak Approve pada modul pengadaan/keuangan apapun
  if (module === "approvals" && (action === "A" || action === "V")) {
    const hasAnyApprove = Object.values(table).some((acts) => {
      if (!acts) return false;
      const list = Array.isArray(acts) ? acts : grant(String(acts));
      return list.includes("V") || list.includes("A");
    });
    if (hasAnyApprove) return true;
  }

  return false;
}

export function visibleModules(role: string): ModuleKey[] {
  const norm = (role || "").toUpperCase().trim().replace(/[\s\-]+/g, "_");
  const dynRole = dynamicRolesStore.find((r) => r.code === norm);
  const table: Record<string, string | string[] | undefined> = dynRole?.permissions ?? PERMISSIONS[norm] ?? PERMISSIONS[role] ?? {};
  return (Object.keys(table) as ModuleKey[]).filter((m) => {
    const rawActions = table[m];
    const actionsList = Array.isArray(rawActions) ? rawActions : grant(String(rawActions ?? ""));
    return actionsList.includes("M") || actionsList.includes("L");
  });
}
