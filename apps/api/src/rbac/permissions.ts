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

/** Matriks peran PRD: 9 role x modul x L/C/U/A. */
export const PERMISSIONS: Record<string, Table> = {
  ADMIN: Object.fromEntries(Object.keys(ALL).map((k) => [k, "LCUA"])) as Table,

  BOS: {
    dashboard: "L",
    customers: "L",
    suppliers: "L",
    products: "L",
    productCategories: "L",
    warehouses: "L",
    leadSources: "L",
    lostReasons: "L",
    expenseCategories: "L",
    costCenters: "L",
    users: "LCU",
    settings: "LCU",
    leads: "L",
    surveys: "L",
    quotations: "LA",
    financeOut: "LA",
    projects: "L",
    tasks: "L",
    requests: "LA",
    procurement: "LA",
    receiving: "LA",
    stock: "LA",
    delivery: "LA",
    expenses: "LA",
    approvals: "LA",
    reports: "L",
    archive: "L",
    audit: "L",
  },

  SALES: {
    dashboard: "L",
    customers: "LCU",
    leadSources: "LCU",
    lostReasons: "LCU",
    expenseCategories: "L",
    costCenters: "L",
    leads: "LCU",
    surveys: "LC",
    quotations: "LCU",
    delivery: "LC",
    expenses: "LC",
    reports: "L",
  },

  PM: {
    dashboard: "L",
    customers: "L",
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
    financeOut: "L",
    projects: "LCU",
    tasks: "LCU",
    requests: "LC",
    procurement: "L",
    receiving: "L",
    stock: "L",
    delivery: "LC",
    expenses: "LC",
    approvals: "LA",
    reports: "L",
  },

  TEKNISI: {
    dashboard: "L",
    expenseCategories: "L",
    costCenters: "L",
    surveys: "LCU",
    projects: "LU",
    tasks: "LU",
    stock: "L",
    delivery: "LC",
    expenses: "LC",
    reports: "L",
  },

  PROCUREMENT: {
    dashboard: "L",
    suppliers: "LCU",
    products: "L",
    productCategories: "L",
    warehouses: "L",
    expenseCategories: "L",
    costCenters: "L",
    projects: "L",
    requests: "LU",
    procurement: "LCU",
    receiving: "LA",
    stock: "L",
    delivery: "LC",
    expenses: "LC",
    approvals: "LA",
    reports: "L",
  },

  FINANCE: {
    dashboard: "L",
    customers: "L",
    suppliers: "L",
    products: "L",
    expenseCategories: "LCU",
    costCenters: "LCU",
    warehouses: "L",
    leads: "L",
    surveys: "L",
    quotations: "LA",
    financeOut: "LCUA",
    projects: "L",
    requests: "LC",
    procurement: "LCUA",
    receiving: "L",
    stock: "LA",
    delivery: "LCA",
    expenses: "LCUA",
    approvals: "LUA",
    reports: "L",
    archive: "L",
  },

  GUDANG: {
    dashboard: "L",
    products: "LCU",
    productCategories: "LCU",
    warehouses: "L",
    expenseCategories: "L",
    costCenters: "L",
    projects: "L",
    requests: "LC",
    receiving: "LCUA",
    stock: "LCU",
    delivery: "LCU",
    expenses: "LC",
    approvals: "LA",
    reports: "L",
  },

  SE: {
    dashboard: "L",
    expenseCategories: "L",
    costCenters: "L",
    surveys: "LCU",
    projects: "LU",
    tasks: "LU",
    delivery: "LC",
    expenses: "LC",
    reports: "L",
  },
};

export function can(role: string, module: ModuleKey, action: Action): boolean {
  const table = PERMISSIONS[role];
  if (!table) return false;
  const actions = table[module];
  if (!actions) return false;
  return grant(actions).includes(action);
}

export function visibleModules(role: string): ModuleKey[] {
  const table = PERMISSIONS[role] ?? {};
  return (Object.keys(table) as ModuleKey[]).filter((m) => grant(table[m] ?? "").includes("L"));
}
