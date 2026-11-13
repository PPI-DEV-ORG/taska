import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { can } from "./permissions.js";
import { ROLE_MODULE_KEYS, STANDARD_ROLES } from "./role-matrix.js";

describe("Matriks hak akses standar", () => {
  it("file matriks API & mobile identik (tidak boleh beda sendiri)", () => {
    const api = readFileSync(fileURLToPath(new URL("./role-matrix.ts", import.meta.url)), "utf8");
    const mobile = readFileSync(
      fileURLToPath(new URL("../../../mobile/src/constants/role-matrix.ts", import.meta.url)),
      "utf8",
    );
    expect(mobile.replace(/\r\n/g, "\n")).toBe(api.replace(/\r\n/g, "\n"));
  });

  it("hanya memakai kunci modul & kode aksi yang dikenal", () => {
    for (const [code, r] of Object.entries(STANDARD_ROLES)) {
      for (const [mod, acts] of Object.entries(r.permissions)) {
        expect(ROLE_MODULE_KEYS as readonly string[], `${code}.${mod}`).toContain(mod);
        expect(acts, `${code}.${mod}`).toMatch(/^[MLCUAPVE]*$/);
        if (/[CUAPVE]/.test(acts)) expect(acts, `${code}.${mod}: aksi tanpa Lihat`).toContain("L");
      }
    }
  });
});

/** [role, modul API (seperti di @Require), aksi, boleh?] */
const EXPECT: Array<[string, string, string, boolean]> = [
  // Semua karyawan: absen, ajukan pengeluaran, lihat dashboard, pilih rekan kerja di form
  ...["SALES", "PM", "TEKNISI", "SE", "PROCUREMENT", "FINANCE", "GUDANG", "HR"].flatMap((r) => [
    [r, "attendance", "C", true] as [string, string, string, boolean],
    [r, "expenses", "C", true] as [string, string, string, boolean],
    [r, "dashboard", "L", true] as [string, string, string, boolean],
    [r, "users", "L", true] as [string, string, string, boolean],
  ]),
  // Kelola gaji hanya HR & Finance (dulu karyawan biasa bisa generate slip gaji)
  ["SALES", "payroll", "V", false], ["TEKNISI", "payroll", "V", false], ["GUDANG", "payroll", "V", false],
  ["HR", "payroll", "V", true], ["FINANCE", "payroll", "V", true],
  ["SALES", "attendance", "U", false], ["HR", "attendance", "U", true],

  // Sales
  ["SALES", "leads", "C", true], ["SALES", "quotations", "C", true], ["SALES", "poClient", "C", true],
  ["SALES", "financeOut", "C", true], ["SALES", "customers", "C", true], ["SALES", "surveys", "C", true],
  ["SALES", "procurement", "C", false], ["SALES", "accounting", "C", false], ["SALES", "stock", "U", false],
  ["SALES", "approvals", "V", false], ["SALES", "settings", "U", false], ["SALES", "users", "C", false],

  // Project Manager
  ["PM", "projects", "U", true], ["PM", "tasks", "C", true], ["PM", "requests", "C", true],
  ["PM", "delivery", "C", true], ["PM", "approvals", "V", true], ["PM", "projects", "P", true],
  ["PM", "financeOut", "C", false], ["PM", "procurement", "C", false], ["PM", "accounting", "C", false],

  // Teknisi
  ["TEKNISI", "tasks", "U", true], ["TEKNISI", "tasks", "C", false], ["TEKNISI", "requests", "C", true],
  ["TEKNISI", "surveys", "U", true], ["TEKNISI", "delivery", "U", true], ["TEKNISI", "projects", "U", false],
  ["TEKNISI", "approvals", "V", false], ["TEKNISI", "financeOut", "L", false],

  // System Engineer / Presales
  ["SE", "pocReports", "C", true], ["SE", "visitReports", "C", true], ["SE", "projects", "U", false],

  // Procurement
  ["PROCUREMENT", "procurement", "C", true], ["PROCUREMENT", "procurement", "U", true],
  ["PROCUREMENT", "shipments", "U", true], ["PROCUREMENT", "receiving", "U", true],
  ["PROCUREMENT", "suppliers", "C", true], ["PROCUREMENT", "products", "C", true], ["PROCUREMENT", "approvals", "V", true],
  ["PROCUREMENT", "financeOut", "C", false], ["PROCUREMENT", "accounting", "C", false],

  // Finance
  ["FINANCE", "financeOut", "C", true], ["FINANCE", "financeOut", "U", true], ["FINANCE", "accounting", "C", true],
  ["FINANCE", "accounting", "V", true], ["FINANCE", "expenses", "V", true], ["FINANCE", "procurement", "U", true],
  ["FINANCE", "poClient", "C", true], ["FINANCE", "approvals", "V", true],
  ["FINANCE", "users", "C", false], ["FINANCE", "stock", "C", false],

  // Admin Gudang
  ["GUDANG", "stock", "C", true], ["GUDANG", "receiving", "C", true], ["GUDANG", "delivery", "C", true],
  ["GUDANG", "opname", "C", true], ["GUDANG", "warehouses", "C", true], ["GUDANG", "approvals", "V", true],
  ["GUDANG", "procurement", "U", false], ["GUDANG", "financeOut", "C", false], ["GUDANG", "accounting", "L", false],

  // HR
  ["HR", "users", "C", true], ["HR", "financeOut", "L", false], ["HR", "procurement", "C", false],
];

describe("Hak akses efektif per peran (sesuai alur bisnis)", () => {
  it.each(EXPECT)("%s · %s:%s -> %s", (role, mod, act, allowed) => {
    expect(can(role, mod, act as any)).toBe(allowed);
  });
});
