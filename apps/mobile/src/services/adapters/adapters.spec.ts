import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  PATHS,
  adaptApproval,
  adaptApprovalList,
  adaptNotif,
  adaptNotifList,
  adaptRow,
  adaptRows,
  apiUserToRow,
  buildCreateBody,
  buildPatchBody,
  buildStatusBody,
  normalizeNotifHref,
  roleFromUi,
  roleLabelOf,
  roleToUi,
  statusEnumFor,
  toEnum,
  toLabel,
} from "@/services/adapters";
import expectedHashes from "./__tests__/expected-hashes.json";
import { db, rawFor } from "./__tests__/fixtures";
import { fingerprint } from "./__tests__/hash";

vi.mock("@/constants/modules", () => ({
  ROLE_LABEL: {
    super_admin: "Super Admin",
    admin: "Admin",
    bos: "Bos",
    sales: "Sales",
    pm: "Project Manager",
    teknisi: "Teknisi",
    procurement: "Procurement",
    finance: "Finance",
    gudang: "Gudang",
    se: "Software Engineer",
    hr: "HR / Personalia",
  },
  getClientDynamicRoles: () => [
    { code: "AUDITOR", name: "Auditor" },
    { code: "QC", name: "Quality Control" },
  ],
}));

vi.mock("@/services/api", () => ({
  apiBase: () => "http://localhost:3030/api",
}));

const modules = Object.keys(PATHS);
const hashes = expectedHashes as Record<string, string>;

beforeAll(() => {
  vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));
});

describe("status dan role mapping", () => {
  it("memetakan enum backend ke label UI dan sebaliknya", () => {
    expect(toLabel("leads", "PROSPECTING")).toBe("Prospecting");
    expect(toLabel("invoices", "PAID")).toBe("Lunas");
    expect(toLabel("invoices", "TIDAK_DIKENAL")).toBe("TIDAK_DIKENAL");
    expect(toLabel("invoices", null)).toBe("-");
    expect(toEnum("leads", "Prospecting")).toBe("PROSPECTING");
    expect(toEnum("invoices", "Lunas")).toBe("PAID");
    expect(toEnum("clientType", "End User")).toBe("END_USER");
    expect(toEnum("invoices", "")).toBe("");
  });

  it("memetakan role UI, enum, dan label termasuk role dinamis", () => {
    expect(roleFromUi("Sales")).toBe("SALES");
    expect(roleFromUi("Admin / Bos")).toBe("BOS");
    expect(roleFromUi("Auditor")).toBe("AUDITOR");
    expect(roleFromUi("tidak dikenal")).toBe("TIDAK_DIKENAL");
    expect(roleLabelOf("SALES")).toBe("Sales");
    expect(roleLabelOf("AUDITOR")).toBe("Auditor");
    expect(roleToUi("PROCUREMENT")).toBe("procurement");
    expect(roleToUi("unknown_role")).toBe("unknown_role");
  });

  it("mengubah user API menjadi row UI", () => {
    expect(
      apiUserToRow({
        id: 4,
        email: "test@example.com",
        name: "Budi",
        phone: "0812",
        position: "Sales",
        department: "Sales",
        role: "SALES",
        status: "AKTIF",
        warehouseId: 5,
        avatarFileId: 11,
        lastLoginAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toMatchSnapshot();
  });
});

describe.each(modules)("adapter modul %s", (module) => {
  it("adaptRow", () => {
    expect(fingerprint(adaptRow(module, rawFor(module)))).toBe(
      hashes[`${module}:adaptRow`],
    );
  });

  it("buildCreateBody", () => {
    expect(fingerprint(buildCreateBody(module, rawFor(module), db))).toBe(
      hashes[`${module}:create`],
    );
  });

  it("buildPatchBody", () => {
    expect(fingerprint(buildPatchBody(module, rawFor(module), db))).toBe(
      hashes[`${module}:patch`],
    );
  });
});

describe("snapshot alur utama", () => {
  it.each([
    "leads",
    "quotations",
    "invoices",
    "projects",
    "purchase-requests",
    "supplier-pos",
    "receiving",
    "delivery-notes",
  ])("adaptRow %s", (module) => {
    expect(adaptRow(module, rawFor(module))).toMatchSnapshot();
  });

  it("adaptRows", () => {
    expect(
      adaptRows("invoices", [
        rawFor("invoices"),
        { ...rawFor("invoices"), id: 43 },
      ]),
    ).toMatchSnapshot();
  });

  it.each(["invoices", "supplier-pos", "receiving", "delivery-notes"])(
    "buildCreateBody %s",
    (module) => {
      expect(buildCreateBody(module, rawFor(module), db)).toMatchSnapshot();
    },
  );

  it.each(["invoices", "supplier-pos"])("buildPatchBody %s", (module) => {
    expect(buildPatchBody(module, rawFor(module), db)).toMatchSnapshot();
  });
});

describe("approval, notifikasi, dan status body", () => {
  it("adaptApproval", () => {
    const raw = rawFor("approvals");
    expect(adaptApproval(raw)).toMatchSnapshot();
    expect(
      adaptApprovalList([raw, { ...raw, id: 43, status: "DISETUJUI" }]),
    ).toMatchSnapshot();
  });

  it("normalisasi href notifikasi", () => {
    expect(normalizeNotifHref(null)).toBe("/");
    expect(normalizeNotifHref("/requests/1")).toBe("/purchase-requests/1");
    expect(normalizeNotifHref("/procurement/po/2")).toBe("/supplier-pos/2");
    expect(normalizeNotifHref("/receivings/3")).toBe("/receiving/3");
    expect(normalizeNotifHref("/stock/opnames/4")).toBe("/stock");
    expect(normalizeNotifHref("/invoice-in/5")).toBe("/supplier-pos");
    expect(normalizeNotifHref("/projects/1/tasks/2")).toBe("/tasks/2");
    expect(normalizeNotifHref("/other")).toBe("/other");
  });

  it("adaptNotif", () => {
    const raw = rawFor("notifications");
    expect(adaptNotif(raw)).toMatchSnapshot();
    expect(
      adaptNotifList([raw, { ...raw, id: 43, read: true }]),
    ).toMatchSnapshot();
  });

  it("buildStatusBody memakai field note untuk modul biasa", () => {
    expect(
      buildStatusBody("leads", "Menunggu", "catatan", { extra: 1 }),
    ).toEqual({
      status: "Menunggu",
      note: "catatan",
      extra: 1,
    });
  });

  it("buildStatusBody memakai field reason untuk modul dengan alasan", () => {
    expect(buildStatusBody("expenses", "Ditolak", "catatan")).toEqual({
      status: "DITOLAK",
      reason: "catatan",
    });
    expect(buildStatusBody("delivery-notes", "Dikirim")).toEqual({
      status: "DIKIRIM",
    });
  });

  it("statusEnumFor mengembalikan enum backend", () => {
    expect(statusEnumFor("invoices", "Lunas")).toBe("PAID");
    expect(statusEnumFor("expenses", "Ditolak")).toBe("DITOLAK");
  });
});

describe("patch penerimaan barang dari form edit", () => {
  it("memetakan nama gudang & nomor PO yang dipilih ke ID", () => {
    expect(buildPatchBody("receiving", { warehouse: "Gudang Utama", po: "POD/001" }, db)).toMatchObject({
      warehouseId: 5,
      supplierPoId: 21,
    });
  });

  it("warehouseId / supplierPoId eksplisit tetap diutamakan", () => {
    expect(
      buildPatchBody("receiving", { warehouse: "Gudang Utama", warehouseId: 9, po: "POD/001", supplierPoId: 8 }, db),
    ).toMatchObject({ warehouseId: 9, supplierPoId: 8 });
  });
});
