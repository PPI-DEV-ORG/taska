import { afterEach, describe, expect, it } from "vitest";
import { can, getDynamicRoles, setDynamicRoles, DEFAULT_UI_PERMISSIONS } from "./permissions.js";

const base = () => getDynamicRoles().find((r) => r.code === "FINANCE")!;
const reset = () => setDynamicRoles([{ code: "FINANCE", name: "Finance", description: "", isSystem: true, permissions: DEFAULT_UI_PERMISSIONS.FINANCE! }]);

describe("RBAC: perubahan matriks peran benar-benar berlaku", () => {
  afterEach(reset);

  it("mencabut semua hak sebuah modul tersimpan (tidak diisi ulang default)", () => {
    setDynamicRoles([{ ...base(), permissions: { ...base().permissions, invoices: "" } }]);
    expect(base().permissions.invoices).toBe("");
    expect(can("FINANCE", "financeOut", "C")).toBe(false);
    expect(can("FINANCE", "financeOut", "L")).toBe(false);
  });

  it("hak modul spesifik tidak bocor dari modul alias (mis. Buku Besar / Sales Order)", () => {
    // Finance masih punya akses penuh accounting & po-client, tapi invoice hanya lihat
    setDynamicRoles([{ ...base(), permissions: { ...base().permissions, invoices: "ML" } }]);
    expect(can("FINANCE", "financeOut", "L")).toBe(true);
    expect(can("FINANCE", "financeOut", "C")).toBe(false);
  });

  it("objek permissions kosong = role tanpa akses (dulu diabaikan)", () => {
    setDynamicRoles([{ code: "MAGANG", name: "Magang", description: "", isSystem: false, permissions: {} }]);
    setDynamicRoles([{ code: "MAGANG", name: "Magang", description: "", isSystem: false, permissions: { leads: "MLC" } }]);
    expect(can("MAGANG", "leads", "C")).toBe(true);
    setDynamicRoles([{ code: "MAGANG", name: "Magang", description: "", isSystem: false, permissions: {} }]);
    expect(can("MAGANG", "leads", "L")).toBe(false);
  });

  it("menambah hak juga langsung berlaku & format array diterima", () => {
    setDynamicRoles([{ ...base(), permissions: { ...base().permissions, users: ["M", "L", "C", "U"] as any } }]);
    expect(can("FINANCE", "users", "C")).toBe(true);
  });

  it("modul lookup tetap bisa dibaca lewat modul induk bila tidak diatur khusus", () => {
    // Finance tidak punya entri productCategories, tapi punya products: L -> dropdown kategori tetap jalan
    expect(can("FINANCE", "productCategories", "L")).toBe(true);
  });
});
