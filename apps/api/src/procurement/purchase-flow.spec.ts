import { describe, expect, it } from "vitest";
import {
  assertPoCanBeCreatedFromPr,
  assertPoShipmentTransition,
  assertPrEditable,
  assertPrTransition,
  assertReceivable,
  canPayRequest,
  canPaySupplier,
  needsPrepayment,
  paymentTermsFromRequest,
} from "./purchase-flow.js";

const user = (role: string, id = 1) => ({ id, role });
const ctx = (over: Partial<Parameters<typeof assertPrTransition>[3]> = {}) => ({
  activePoCount: 0,
  hasApprovedPo: false,
  ...over,
});
const pr = (over: Record<string, unknown> = {}) => ({
  status: "DISETUJUI",
  requesterId: 9,
  procurementSource: "SUPPLIER",
  paymentMethod: "UTANG",
  ...over,
});

describe("needsPrepayment", () => {
  it("ritel selalu wajib bayar dulu", () => expect(needsPrepayment({ procurementSource: "RETAIL", paymentMethod: "UTANG" })).toBe(true));
  it("supplier utang tidak wajib", () => expect(needsPrepayment({ procurementSource: "SUPPLIER", paymentMethod: "UTANG" })).toBe(false));
  it("supplier tunai wajib", () => expect(needsPrepayment({ procurementSource: "SUPPLIER", paymentMethod: "KAS" })).toBe(true));
  it("ambil stok gudang tidak", () => expect(needsPrepayment({ procurementSource: "GUDANG" })).toBe(false));
});

describe("assertPrTransition", () => {
  it("tidak boleh menyetujui lewat status", () => {
    expect(() => assertPrTransition(pr({ status: "DIAJUKAN" }), "DISETUJUI", user("FINANCE"), ctx())).toThrow(/Persetujuan/);
  });
  it("PO_DIBUAT hanya sistem", () => {
    expect(() => assertPrTransition(pr(), "PO_DIBUAT", user("PROCUREMENT"), ctx())).toThrow();
  });
  it("tidak bisa dikirim sebelum disetujui", () => {
    expect(() => assertPrTransition(pr({ status: "DIAJUKAN" }), "DIKIRIM", user("PROCUREMENT"), ctx())).toThrow(/belum disetujui/);
  });
  it("supplier wajib punya PO disetujui sebelum dikirim", () => {
    expect(() => assertPrTransition(pr(), "DIKIRIM", user("PROCUREMENT"), ctx())).toThrow(/PO supplier dulu/);
    expect(() => assertPrTransition(pr({ status: "PO_DIBUAT" }), "DIKIRIM", user("PROCUREMENT"), ctx({ activePoCount: 1 }))).toThrow(/belum disetujui/);
    expect(() =>
      assertPrTransition(pr({ status: "PO_DIBUAT" }), "DIKIRIM", user("PROCUREMENT"), ctx({ activePoCount: 1, hasApprovedPo: true })),
    ).not.toThrow();
  });
  it("ritel wajib dibayar sebelum dikirim", () => {
    const retail = pr({ procurementSource: "RETAIL" });
    expect(() => assertPrTransition(retail, "DIKIRIM", user("PROCUREMENT"), ctx())).toThrow(/dibayar Finance/);
    expect(() => assertPrTransition({ ...retail, status: "DIBAYAR" }, "DIKIRIM", user("PROCUREMENT"), ctx())).not.toThrow();
  });
  it("hanya procurement yang menandai dikirim", () => {
    const retail = pr({ procurementSource: "RETAIL", status: "DIBAYAR" });
    expect(() => assertPrTransition(retail, "DIKIRIM", user("GUDANG"), ctx())).toThrow(/Procurement/);
    expect(() => assertPrTransition(retail, "DIKIRIM", user("PM"), ctx())).toThrow();
  });
  it("hanya finance yang membayar, dan wajib bukti", () => {
    const retail = pr({ procurementSource: "RETAIL" });
    expect(() => assertPrTransition(retail, "DIBAYAR", user("PROCUREMENT"), ctx({ paymentProofProvided: true }))).toThrow(/Finance/);
    expect(() => assertPrTransition(retail, "DIBAYAR", user("FINANCE"), ctx())).toThrow(/Bukti/);
    expect(() => assertPrTransition(retail, "DIBAYAR", user("FINANCE"), ctx({ paymentProofProvided: true }))).not.toThrow();
  });
  it("tidak bisa dibayar sebelum disetujui", () => {
    expect(() => assertPrTransition(pr({ status: "DIAJUKAN" }), "DIBAYAR", user("FINANCE"), ctx({ paymentProofProvided: true }))).toThrow(/disetujui/);
  });
  it("pembelian tidak bisa diterima lewat status — harus lewat penerimaan gudang", () => {
    expect(() => assertPrTransition(pr({ status: "DIKIRIM" }), "DITERIMA", user("GUDANG"), ctx())).toThrow(/Penerimaan Barang/);
  });
  it("request ambil stok: gudang serahkan, pemohon terima", () => {
    const stok = pr({ procurementSource: "GUDANG" });
    expect(() => assertPrTransition(stok, "DIKIRIM", user("GUDANG"), ctx())).not.toThrow();
    expect(() => assertPrTransition(stok, "DIKIRIM", user("PROCUREMENT"), ctx())).toThrow();
    expect(() => assertPrTransition({ ...stok, status: "DIKIRIM" }, "DITERIMA", user("TEKNISI", 9), ctx())).not.toThrow();
    expect(() => assertPrTransition({ ...stok, status: "DIKIRIM" }, "DITERIMA", user("TEKNISI", 3), ctx())).toThrow();
  });
  it("status akhir tidak bisa digerakkan lagi", () => {
    expect(() => assertPrTransition(pr({ status: "DITOLAK" }), "DIKIRIM", user("PROCUREMENT"), ctx())).toThrow(/ditolak/);
    expect(() => assertPrTransition(pr({ status: "DITERIMA" }), "DIKIRIM", user("PROCUREMENT"), ctx())).toThrow();
  });
  it("pembatalan ditolak bila sudah bayar/kirim atau masih ada PO", () => {
    expect(() => assertPrTransition(pr({ status: "DIKIRIM" }), "DIBATALKAN", user("ADMIN"), ctx())).toThrow();
    expect(() => assertPrTransition(pr({ paymentStatus: "DIBAYAR" }), "DIBATALKAN", user("ADMIN"), ctx())).toThrow();
    expect(() => assertPrTransition(pr(), "DIBATALKAN", user("ADMIN"), ctx({ activePoCount: 1 }))).toThrow(/PO/);
    expect(() => assertPrTransition(pr({ status: "DIAJUKAN" }), "DIBATALKAN", user("PM", 9), ctx())).not.toThrow();
  });
});

describe("assertPrEditable", () => {
  it("terkunci setelah disetujui", () => expect(() => assertPrEditable(pr(), user("ADMIN"))).toThrow());
  it("hanya pemohon/admin saat diajukan", () => {
    expect(() => assertPrEditable(pr({ status: "DIAJUKAN" }), user("GUDANG", 2))).toThrow();
    expect(() => assertPrEditable(pr({ status: "DIAJUKAN" }), user("GUDANG", 9))).not.toThrow();
  });
});

describe("PO rules", () => {
  it("PO hanya dari request yang sudah disetujui", () => {
    expect(() => assertPoCanBeCreatedFromPr(pr({ status: "DIAJUKAN" }))).toThrow(/belum disetujui/);
    expect(() => assertPoCanBeCreatedFromPr(pr())).not.toThrow();
    expect(() => assertPoCanBeCreatedFromPr(pr({ procurementSource: "RETAIL" }))).toThrow();
    expect(() => assertPoCanBeCreatedFromPr(pr({ status: "DIKIRIM" }))).toThrow();
  });
  it("pengiriman PO: SAMPAI tidak manual, harus disetujui, bayar dulu bila tunai", () => {
    const po = { status: "DISETUJUI", shipmentStatus: "DI_SUPPLIER" };
    expect(() => assertPoShipmentTransition(po, "SAMPAI", user("PROCUREMENT"))).toThrow(/Penerimaan Barang/);
    expect(() => assertPoShipmentTransition({ ...po, status: "MENUNGGU_PERSETUJUAN" }, "DIKIRIM", user("PROCUREMENT"))).toThrow(/disetujui/);
    expect(() => assertPoShipmentTransition(po, "DIKIRIM", user("GUDANG"))).toThrow();
    expect(() => assertPoShipmentTransition(po, "DIKIRIM", user("PROCUREMENT"), pr({ paymentMethod: "KAS" }))).toThrow(/dibayar/);
    expect(() => assertPoShipmentTransition(po, "DIKIRIM", user("PROCUREMENT"), pr())).not.toThrow();
  });
});

describe("assertReceivable", () => {
  it("hanya setelah dikirim", () => {
    expect(() => assertReceivable(pr({ status: "DISETUJUI" }))).toThrow(/belum menandai/);
    expect(() => assertReceivable(pr({ status: "DIKIRIM" }))).not.toThrow();
    expect(() => assertReceivable(pr({ status: "DITERIMA" }))).toThrow(/sudah diterima/);
    expect(() => assertReceivable(null)).not.toThrow();
  });
});

describe("hak bayar pembelian (RBAC Setujui)", () => {
  it("Finance boleh bayar request & tagihan supplier", () => {
    expect(canPayRequest("FINANCE")).toBe(true);
    expect(canPaySupplier("FINANCE")).toBe(true);
  });
  it("Procurement tidak boleh mencatat uang keluar", () => {
    expect(canPayRequest("PROCUREMENT")).toBe(false);
    expect(canPaySupplier("PROCUREMENT")).toBe(false);
  });
  it("Gudang & Sales tidak boleh bayar", () => {
    expect(canPaySupplier("GUDANG")).toBe(false);
    expect(canPaySupplier("SALES")).toBe(false);
  });
  it("Procurement ditolak saat menandai request dibayar", () =>
    expect(() => assertPrTransition(pr(), "DIBAYAR", user("PROCUREMENT"), ctx({ paymentProofProvided: true }))).toThrow());
});

describe("paymentTermsFromRequest", () => {
  it("tempo ikut jatuh tempo request", () =>
    expect(paymentTermsFromRequest({ procurementSource: "SUPPLIER", paymentMethod: "UTANG", dueDate: new Date("2026-12-01") })).toBe("Tempo s/d 2026-12-01"));
  it("tempo tanpa tanggal", () => expect(paymentTermsFromRequest({ procurementSource: "SUPPLIER", paymentMethod: "UTANG" })).toBe("Tempo"));
  it("tunai", () => expect(paymentTermsFromRequest({ procurementSource: "SUPPLIER", paymentMethod: "KAS" })).toBe("Tunai (dibayar di muka)"));
});
