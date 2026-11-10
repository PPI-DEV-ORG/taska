import { afterEach, describe, expect, it, vi } from "vitest";
import { can, setRuntimePermissions, visibleModules } from "./permissions.js";
import { normalizeActions } from "./rbac-meta.js";
import { RbacService } from "./rbac.service.js";

afterEach(() => setRuntimePermissions(null));

describe("can() dengan hak akses yang bisa diubah", () => {
  it("memakai matriks bawaan bila belum ada override", () => {
    expect(can("FINANCE", "approvals", "A")).toBe(true);
    expect(can("TEKNISI", "financeOut", "L")).toBe(false);
  });

  it("override database menggantikan bawaan, seketika", () => {
    setRuntimePermissions({ TEKNISI: { financeOut: "L" }, FINANCE: { approvals: "L" } });
    expect(can("TEKNISI", "financeOut", "L")).toBe(true);
    expect(can("TEKNISI", "financeOut", "C")).toBe(false);
    expect(can("FINANCE", "approvals", "A")).toBe(false); // dicabut
  });

  it("modul tanpa baris override tetap memakai bawaan", () => {
    setRuntimePermissions({ TEKNISI: { financeOut: "L" } });
    expect(can("FINANCE", "approvals", "A")).toBe(true);
  });

  it("Super Admin selalu penuh walau ada override (tidak bisa terkunci)", () => {
    setRuntimePermissions({ SUPER_ADMIN: { users: "" } });
    expect(can("SUPER_ADMIN", "users", "A")).toBe(true);
  });

  it("visibleModules mengikuti hak Lihat", () => {
    setRuntimePermissions({ TEKNISI: { financeOut: "L", leads: "" } });
    expect(visibleModules("TEKNISI")).toContain("financeOut");
    expect(visibleModules("TEKNISI")).not.toContain("leads");
  });
});

describe("normalizeActions", () => {
  it("membuang huruf tak dikenal dan duplikat, urutan tetap", () => {
    expect(normalizeActions("UUxC", ["L", "C", "U"])).toBe("LCU");
  });
  it("membuat/ubah/setujui otomatis menyertakan Lihat", () => {
    expect(normalizeActions("C", ["L", "C", "U"])).toBe("LC");
    expect(normalizeActions("A", ["L", "A"])).toBe("LA");
  });
  it("aksi yang tidak dipakai modul dibuang", () => {
    expect(normalizeActions("LCUA", ["L"])).toBe("L");
  });
  it("kosong tetap kosong", () => {
    expect(normalizeActions("", ["L", "C", "U"])).toBe("");
  });
});

function makeService() {
  const rolePermission = {
    upsert: vi.fn((a: any) => a),
    findMany: vi.fn(async () => []),
    createMany: vi.fn(),
  };
  const prisma = { main: { rolePermission, $transaction: vi.fn(async (ops: any[]) => ops) } } as any;
  const audit = { log: vi.fn(async () => undefined) } as any;
  const svc = new RbacService(prisma, audit);
  return { svc, rolePermission, prisma, audit };
}
const superAdmin = { id: 1, role: "SUPER_ADMIN", name: "Root", email: "r@x" } as any;

describe("RbacService.updateRole", () => {
  it("menolak selain Super Admin", async () => {
    const { svc } = makeService();
    await expect(svc.updateRole("FINANCE", { leads: "L" }, { id: 2, role: "ADMIN", name: "A" } as any)).rejects.toThrow(/Super Admin/);
  });

  it("tidak bisa mengubah hak akses Super Admin", async () => {
    const { svc } = makeService();
    await expect(svc.updateRole("SUPER_ADMIN", { leads: "" }, superAdmin)).rejects.toThrow(/tidak bisa diubah/);
  });

  it("menolak modul tidak dikenal dan peran tidak dikenal", async () => {
    const { svc } = makeService();
    await expect(svc.updateRole("FINANCE", { ngawur: "L" }, superAdmin)).rejects.toThrow(/tidak dikenal/);
    await expect(svc.updateRole("TUKANG", { leads: "L" }, superAdmin)).rejects.toThrow(/tidak dikenal/);
  });

  it("hanya menulis modul yang benar-benar berubah, dan mencatat audit", async () => {
    const { svc, rolePermission, audit } = makeService();
    // TEKNISI bawaan: financeOut kosong -> beri Lihat; leads dikirim sama dengan bawaan -> tidak ditulis
    const before = (await import("./permissions.js")).actionsOf("TEKNISI", "leads");
    await svc.updateRole("TEKNISI", { financeOut: "L", leads: before }, superAdmin);
    expect(rolePermission.upsert).toHaveBeenCalledTimes(1);
    expect(rolePermission.upsert.mock.calls[0]![0].create).toMatchObject({ role: "TEKNISI", module: "financeOut", actions: "L" });
    expect(audit.log).toHaveBeenCalledTimes(1);
  });

  it("Buat tanpa Lihat otomatis ikut Lihat", async () => {
    const { svc, rolePermission } = makeService();
    await svc.updateRole("TEKNISI", { financeOut: "C" }, superAdmin);
    expect(rolePermission.upsert.mock.calls[0]![0].create.actions).toBe("LC");
  });
});

describe("RbacService.forUser", () => {
  it("memberi hak efektif per modul", () => {
    const { svc } = makeService();
    setRuntimePermissions({ TEKNISI: { financeOut: "L" } });
    const r = svc.forUser({ id: 3, role: "TEKNISI", name: "T" } as any);
    expect(r.permissions.financeOut).toBe("L");
    expect(svc.forUser(superAdmin).permissions.users).toBe("LCUA");
  });
});
