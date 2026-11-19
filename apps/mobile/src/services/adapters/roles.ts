import {
  getClientDynamicRoles,
  ROLE_LABEL,
  type Role,
  type User,
} from "@/constants/modules";
import { apiBase } from "@/services/api";
import type { ApiUser } from "./types";
import { toLabel } from "./status-maps";

const ROLE_UI: Record<string, Role> = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  BOS: "bos",
  SALES: "sales",
  PM: "pm",
  TEKNISI: "teknisi",
  PROCUREMENT: "procurement",
  FINANCE: "finance",
  GUDANG: "gudang",
  SE: "se",
  HR: "hr",
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
  HR: "HR",
  "HR / Personalia": "HR",
  Sales: "SALES",
  "Project Manager": "PM",
  Teknisi: "TEKNISI",
  Procurement: "PROCUREMENT",
  Finance: "FINANCE",
  Gudang: "GUDANG",
  "Software Engineer": "SE",
};

export function roleFromUi(role: string): string {
  const dyn = getClientDynamicRoles();
  const matchedDyn = dyn.find(
    (r) =>
      r.name.toLowerCase() === String(role || "").toLowerCase() ||
      r.code.toLowerCase() === String(role || "").toLowerCase(),
  );
  if (matchedDyn) return matchedDyn.code;
  return (
    ROLE_FROM_LABEL[role] ??
    ROLE_FROM_UI[role] ??
    String(role || "SALES")
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, "_")
  );
}

// Label role untuk ditampilkan (detail/daftar), dihitung dari enum backend.
export function roleLabelOf(role: string | undefined): string {
  if (!role) return "Sales";
  const dyn = getClientDynamicRoles();
  const matchedDyn = dyn.find(
    (r) => r.code.toUpperCase() === role.toUpperCase(),
  );
  if (matchedDyn) return matchedDyn.name;
  if (ROLE_LABEL[role.toLowerCase()]) return ROLE_LABEL[role.toLowerCase()]!;
  const ui = roleToUi(role);
  const entry = Object.entries(ROLE_FROM_LABEL).find(
    ([, v]) => v === role.toUpperCase(),
  );
  if (entry) return entry[0];
  return ui.charAt(0).toUpperCase() + ui.slice(1);
}
export function roleToUi(role: string | undefined): Role {
  if (!role) return "sales";
  if (ROLE_UI[role]) return ROLE_UI[role];
  const upper = role.toUpperCase();
  if (ROLE_UI[upper]) return ROLE_UI[upper];
  return role.toLowerCase();
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
