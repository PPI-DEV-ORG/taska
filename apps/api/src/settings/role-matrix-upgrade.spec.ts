import { afterAll, describe, expect, it } from "vitest";
import { SettingsService } from "./settings.service.js";
import { can, getDynamicRoles, setDynamicRoles } from "../rbac/permissions.js";
import { ROLE_MATRIX_VERSION } from "../rbac/role-matrix.js";

/** SystemSetting palsu di memori */
function fakePrisma(initial: Record<string, string>) {
  const store = new Map(Object.entries(initial));
  const systemSetting = {
    findUnique: async ({ where }: any) => (store.has(where.key) ? { key: where.key, value: store.get(where.key) } : null),
    update: async ({ where, data }: any) => {
      store.set(where.key, data.value);
      return { key: where.key, value: data.value };
    },
    upsert: async ({ where, create, update }: any) => {
      store.set(where.key, store.has(where.key) ? update.value : create.value);
      return { key: where.key };
    },
  };
  return { store, prisma: { main: { systemSetting } } as any };
}

describe("migrasi matriks hak akses (upgradeRoleMatrix)", () => {
  it("peran bawaan lama diset ke matriks standar, peran kustom tetap, versi dicatat", async () => {
    const oldRoles = [
      { code: "ADMIN", name: "Admin", description: "", isSystem: true, permissions: { accounting: "MLCUAPVE", reports: "MLPE" } },
      { code: "HR", name: "HR", description: "", isSystem: true, permissions: { hr: "MLCUAPVE", reports: "ML" } },
      { code: "KASIR", name: "Kasir", description: "", isSystem: false, permissions: { invoices: "MLC", accounting: "ML" } },
    ];
    const { store, prisma } = fakePrisma({ "rbac.roles": JSON.stringify(oldRoles), "rbac.matrixVersion": "2" });
    const svc = new SettingsService(prisma);
    await svc.reloadRoles();
    expect(can("ADMIN", "accounting", "L")).toBe(true); // sebelum migrasi

    await svc.upgradeRoleMatrix();

    expect(store.get("rbac.matrixVersion")).toBe(String(ROLE_MATRIX_VERSION));
    expect(can("ADMIN", "accounting", "L")).toBe(false);
    expect(can("HR", "reports", "L")).toBe(false);
    expect(can("FINANCE", "accounting", "L")).toBe(true);
    // peran kustom tidak disentuh
    expect(can("KASIR", "accounting", "L")).toBe(true);
    const saved = JSON.parse(store.get("rbac.roles")!);
    expect(saved.find((r: any) => r.code === "KASIR").permissions.accounting).toBe("ML");
    expect(saved.find((r: any) => r.code === "ADMIN").permissions.accounting).toBe("");
  });

  it("tidak mengubah apa pun bila versi sudah terbaru (perubahan admin setelahnya dipertahankan)", async () => {
    const custom = [{ code: "GUDANG", name: "Gudang", description: "", isSystem: true, permissions: { stock: "ML", accounting: "ML" } }];
    const { store, prisma } = fakePrisma({ "rbac.roles": JSON.stringify(custom), "rbac.matrixVersion": String(ROLE_MATRIX_VERSION) });
    const svc = new SettingsService(prisma);
    await svc.reloadRoles();
    await svc.upgradeRoleMatrix();
    expect(JSON.parse(store.get("rbac.roles")!)).toEqual(custom);
    expect(can("GUDANG", "accounting", "L")).toBe(true);
  });

  // kembalikan matriks default (state global modul permissions) agar spec lain tidak terpengaruh
  afterAll(() => {
    setDynamicRoles(getDynamicRoles().filter((r) => r.isSystem).map((r) => ({ ...r, permissions: undefined as any })));
  });
});
