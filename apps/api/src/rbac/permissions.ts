export type Action = "L" | "C" | "U" | "A";

export type ModuleKey =
  | "dashboard"
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
  | "financeOut"
  | "projects"
  | "tasks"
  | "requests"
  | "procurement"
  | "receiving"
  | "stock"
  | "delivery"
  | "expenses"
  | "approvals"
  | "reports"
  | "archive"
  | "audit";

const ALL: Record<ModuleKey, Action[]> = {
  dashboard: ["L", "C", "U", "A"],
  customers: ["L", "C", "U", "A"],
  suppliers: ["L", "C", "U", "A"],
  products: ["L", "C", "U", "A"],
  productCategories: ["L", "C", "U", "A"],
  warehouses: ["L", "C", "U", "A"],
  leadSources: ["L", "C", "U", "A"],
  lostReasons: ["L", "C", "U", "A"],
  expenseCategories: ["L", "C", "U", "A"],
  costCenters: ["L", "C", "U", "A"],
  users: ["L", "C", "U", "A"],
  settings: ["L", "C", "U", "A"],
  leads: ["L", "C", "U", "A"],
  surveys: ["L", "C", "U", "A"],
  quotations: ["L", "C", "U", "A"],
  financeOut: ["L", "C", "U", "A"],
  projects: ["L", "C", "U", "A"],
  tasks: ["L", "C", "U", "A"],
  requests: ["L", "C", "U", "A"],
  procurement: ["L", "C", "U", "A"],
  receiving: ["L", "C", "U", "A"],
  stock: ["L", "C", "U", "A"],
  delivery: ["L", "C", "U", "A"],
  expenses: ["L", "C", "U", "A"],
  approvals: ["L", "C", "U", "A"],
  reports: ["L", "C", "U", "A"],
  archive: ["L", "C", "U", "A"],
  audit: ["L", "C", "U", "A"],
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
    reports: "L",
  },

  PM: {
    dashboard: "L",
    users: "L",
    customers: "LCU",
    suppliers: "L",
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
    approvals: "LA",
    reports: "L",
  },

  TEKNISI: {
    dashboard: "L",
    users: "L",
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
    reports: "L",
  },

  PROCUREMENT: {
    dashboard: "L",
    users: "L",
    suppliers: "LCU",
    products: "LCU",
    productCategories: "LCU",
    warehouses: "LCU",
    expenseCategories: "L",
    costCenters: "L",
    projects: "L",
    requests: "LCU",
    procurement: "LCUA",
    receiving: "LCUA",
    stock: "LCU",
    delivery: "LCU",
    expenses: "LCU",
    approvals: "LA",
    reports: "L",
  },

  FINANCE: {
    dashboard: "L",
    users: "L",
    customers: "LCU",
    suppliers: "L",
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
    requests: "LCU",
    procurement: "LCUA",
    receiving: "L",
    stock: "LCUA",
    delivery: "LCUA",
    expenses: "LCUA",
    approvals: "LUA",
    reports: "L",
    archive: "L",
  },

  GUDANG: {
    dashboard: "L",
    users: "L",
    suppliers: "L",
    products: "LCU",
    productCategories: "LCU",
    warehouses: "LCU",
    expenseCategories: "L",
    costCenters: "L",
    projects: "L",
    requests: "LCU",
    procurement: "LU",
    receiving: "LCUA",
    stock: "LCU",
    delivery: "LCU",
    expenses: "LCU",
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
    reports: "L",
  },
};

export function can(role: string, module: ModuleKey, action: Action): boolean {
  const norm = (role || "").toUpperCase();
  if (norm === "SUPER_ADMIN") return true;
  const table = PERMISSIONS[norm] || PERMISSIONS[role];
  if (!table) return false;
  const actions = table[module];
  if (!actions) return false;
  return grant(actions).includes(action);
}

export function visibleModules(role: string): ModuleKey[] {
  const table = PERMISSIONS[role] ?? {};
  return (Object.keys(table) as ModuleKey[]).filter((m) => grant(table[m] ?? "").includes("L"));
}
