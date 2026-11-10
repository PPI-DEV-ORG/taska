/**
 * Hak akses di mobile mengikuti server (/rbac/me), yang diatur Super Admin di layar "Hak Akses".
 * Server tetap yang menentukan (setiap API dicek ulang); ini hanya untuk menyembunyikan menu/tombol yang tidak boleh dipakai.
 */

export type PermAction = "L" | "C" | "U" | "A";
export type Perms = Record<string, string>;

/** Kunci modul/menu di mobile -> kunci modul hak akses di backend. Yang tidak terdaftar tidak difilter. */
export const NAV_TO_PERM: Record<string, string> = {
  dashboard: "dashboard",
  calendar: "dashboard",
  approvals: "approvals",
  leads: "leads",
  quotations: "quotations",
  surveys: "surveys",
  "poc-reports": "pocReports",
  "visit-reports": "visitReports",
  customers: "customers",
  suppliers: "suppliers",
  projects: "projects",
  tasks: "tasks",
  "purchase-requests": "requests",
  "supplier-pos": "procurement",
  "purchase-orders": "procurement",
  shipments: "procurement",
  receiving: "receiving",
  stock: "stock",
  opname: "stock",
  "damage-reports": "stock",
  "po-client": "financeOut",
  invoices: "financeOut",
  "delivery-notes": "delivery",
  expenses: "expenses",
  accounting: "reports",
  reports: "reports",
  "master-data": "products",
  users: "users",
  archive: "archive",
  hr: "attendance",
  "audit-log": "audit",
};

/** Boleh melakukan aksi pada modul mobile ini? undefined = tidak diketahui (jangan diblokir di sisi tampilan). */
export function permitted(perms: Perms | null | undefined, navKey: string, action: PermAction): boolean | undefined {
  if (!perms) return undefined;
  const mod = NAV_TO_PERM[navKey];
  if (!mod) return undefined;
  const actions = perms[mod];
  if (actions === undefined) return undefined;
  return actions.includes(action);
}
