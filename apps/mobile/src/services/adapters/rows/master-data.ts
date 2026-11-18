import type { Row } from "@/constants/modules";
import { d, idOf, n, nameOf } from "../row-helpers";
import { apiUserToRow } from "../roles";
import { toLabel } from "../status-maps";

export function mapCustomers(raw: any, base: Row): Row {
  return {
    ...base,
    nama: raw.name ?? "",
    kota: raw.city ?? "",
    kontak: raw.pic ?? "",
    email: raw.email ?? "",
    telepon: raw.phone ?? "",
    catatan: raw.notes ?? "",
    status: toLabel("users", raw.status),
  };
}

export function mapSuppliers(raw: any, base: Row): Row {
  return {
    ...base,
    nama: raw.name ?? "",
    kota: raw.city ?? "",
    kontak: raw.pic ?? "",
    email: raw.email ?? "",
    telepon: raw.phone ?? "",
    payment: raw.paymentTerms ?? "",
    catatan: raw.notes ?? "",
    status: toLabel("users", raw.status),
    taxStatus: raw.taxStatus || "NON_PKP",
    jenisUsaha: raw.taxStatus === "PKP" ? "PKP" : "Non-PKP",
    tags: Array.isArray(raw.itemTags) ? raw.itemTags : [],
    tagSummary: (raw.itemTags ?? []).map((t: any) => t.itemName).join(", "),
  };
}

export function mapUsers(raw: any, base: Row): Row {
  const row = apiUserToRow(raw);
  row.gudang =
    nameOf(raw.warehouse) ||
    (raw.warehouseId != null ? String(raw.warehouseId) : "-");
  return row;
}

export function mapAuditLog(raw: any, base: Row): Row {
  return {
    ...base,
    waktu: raw.createdAt ?? raw.timestamp ?? "",
    pengguna: raw.actorName ?? raw.actor?.name ?? "",
    aksi: raw.action ?? "",
    jenis: raw.entityType ?? "",
    refId: raw.entityId != null ? String(raw.entityId) : "",
    detail: raw.detail ?? "",
  };
}

export function mapOpname(raw: any, base: Row): Row {
  const diffSum = (raw.details ?? []).reduce(
    (a: number, x: any) =>
      a + (n(x.countedQty) - n(x.systemQty ?? x.expectedQty ?? 0)),
    0,
  );
  return {
    ...base,
    tanggal: d(raw.date),
    gudang: nameOf(raw.warehouse) ?? "",
    warehouseId: idOf(raw.warehouse),
    petugas: nameOf(raw.conductor) ?? "",
    selisih:
      diffSum === 0
        ? "0 SKU (Cocok)"
        : `${diffSum > 0 ? "+" : ""}${diffSum} SKU`,
    status: toLabel("opname", raw.status),
    alasan: raw.reason ?? "",
    _details: raw.details ?? [],
  };
}

export function mapWarehouses(raw: any, base: Row): Row {
  return {
    ...base,
    nama: raw.name ?? "",
    kota: raw.city ?? "",
    staf: "-",
    status: toLabel("users", raw.status),
  };
}

export function mapProducts(raw: any, base: Row): Row {
  const pType =
    String(raw.type || "BARANG").toUpperCase() === "JASA" ? "JASA" : "BARANG";
  const isJasa = pType === "JASA";
  const desc = String(raw.description ?? "");
  const sellMatch = desc.match(/SELL:([^;]+)/);
  const cleanDesc = desc
    .replace(/SELL:[^;]+;?/g, "")
    .replace(/PPH:[^;]+;?/g, "")
    .trim();
  const parsedSellPrice = sellMatch ? Number(sellMatch[1]) : 0;
  const effectiveSellPrice =
    parsedSellPrice > 0
      ? parsedSellPrice
      : Number(raw.price ?? raw.hargaJual ?? raw.harga ?? 0) || 0;

  return {
    ...base,
    sku: raw.sku ?? "",
    nama: raw.name ?? "",
    merk: raw.brand ?? "",
    brand: raw.brand ?? "",
    deskripsi: cleanDesc || raw.description || "",
    description: raw.description ?? "",
    satuan: raw.unit ?? "",
    type: pType,
    jenisItem: isJasa ? "Jasa" : "Barang",
    tipeSN: isJasa
      ? "Jasa (Non-Stok)"
      : raw.hasSerial
        ? "Barang Ber-SN"
        : "Barang Non-SN",
    berSN: isJasa ? false : !!raw.hasSerial,
    garansi: raw.warrantyMonths != null ? `${raw.warrantyMonths} bln` : "-",
    min: n(raw.minStock),
    minStock: n(raw.minStock),
    hargaBeli: n(raw.purchasePrice),
    hargaJual: effectiveSellPrice,
    price: effectiveSellPrice,
    kategori: nameOf(raw.category) ?? "",
    categoryId: idOf(raw.category),
    status: toLabel("users", raw.status),
  };
}

export function mapProductCategories(raw: any, base: Row): Row {
  return {
    ...base,
    nama: raw.name ?? "",
    deskripsi: raw.description ?? "",
    prefix: raw.prefix ?? "",
    status: toLabel("users", raw.status),
  };
}

export function mapLeadSourcesGroup(raw: any, base: Row): Row {
  return {
    ...base,
    nama: raw.name ?? "",
    status: toLabel("users", raw.status ?? "AKTIF"),
  };
}
