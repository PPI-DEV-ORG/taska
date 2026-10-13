import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { can, type ModuleKey } from "../rbac/permissions.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";

export type ImportType = "customer" | "supplier" | "product" | "warehouse" | "stock" | "serial";

const MODULE_FOR: Record<ImportType, ModuleKey> = {
  customer: "customers",
  supplier: "suppliers",
  product: "products",
  warehouse: "warehouses",
  stock: "stock",
  serial: "stock",
};

type Cell = string | number | null | undefined;

const TEMPLATES: Record<ImportType, { columns: string[]; example: Array<string | number>; notes: string[] }> = {
  customer: {
    columns: ["name", "pic", "city", "phone", "email", "address"],
    example: ["PT Maju Jaya", "Bu Rina", "Jakarta", "0812xxxx", "rina@maju.co.id", "Jl. Merdeka 1"],
    notes: ["name wajib diisi", "email harus unik bila diisi"],
  },
  supplier: {
    columns: ["name", "pic", "phone", "email", "city", "paymentTerms"],
    example: ["CV Elektro", "Andi", "0813xxxx", "andi@elektro.id", "Bandung", "30 hari"],
    notes: ["name wajib diisi"],
  },
  product: {
    columns: [
      "sku",
      "name",
      "unit",
      "type",
      "categoryName",
      "hasSerial",
      "minStock",
      "purchasePrice",
      "warrantyMonths",
    ],
    example: ["CAM-001", "IP Camera 4MP", "pcs", "Kamera", "CCTV", "YA", 5, 900000, 12],
    notes: [
      "sku wajib & unik",
      "hasSerial: YA/TIDAK",
      "categoryName harus ada di master kategori (atau diisi nama baru = dibuat)",
      "angka tanpa pemisah ribuan",
    ],
  },
  warehouse: {
    columns: ["name", "city"],
    example: ["Gudang Pusat", "Jakarta"],
    notes: ["name wajib & unik"],
  },
  stock: {
    columns: ["sku", "warehouse", "qty", "serials"],
    example: ["CAM-001", "Gudang Pusat", 10, "SN-A1,SN-A2"],
    notes: [
      "saldo stok awal per gudang",
      "serials wajib (pisahkan koma) bila produk hasSerial dan qty > 0",
      "qty harus bilangan bulat >= 0",
    ],
  },
  serial: {
    columns: ["sku", "warehouse", "sn"],
    example: ["CAM-001", "Gudang Pusat", "SN-B1"],
    notes: ["satu baris satu SN", "SN harus unik", "produk harus hasSerial"],
  },
};

type FailedRow = { row: number; error: string; data: Record<string, Cell> };
type ImportResult = {
  type: ImportType;
  total: number;
  imported: number;
  failed: FailedRow[];
};

function str(v: Cell): string {
  return v === null || v === undefined ? "" : String(v).trim();
}

function num(v: Cell): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[\s.]/g, "").replace(/,/g, "."));
  return Number.isFinite(n) ? n : null;
}

function boolYa(v: Cell): boolean | null {
  const s = str(v).toUpperCase();
  if (["YA", "Y", "YES", "TRUE", "1"].includes(s)) return true;
  if (["TIDAK", "T", "NO", "FALSE", "0", ""].includes(s)) return false;
  return null;
}

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private assertAccess(type: ImportType, user: RequestUser, action: "L" | "C") {
    const mod = MODULE_FOR[type];
    if (!can(user.role, mod, action)) {
      throw new ForbiddenException(
        `Akses ditolak: peran ${user.role} tidak memiliki hak ${action} pada modul ${mod}`,
      );
    }
  }

  async template(type: ImportType): Promise<Buffer> {
    const t = TEMPLATES[type];
    if (!t) throw new BadRequestException(`Jenis import tidak dikenal: ${type}`);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(type.slice(0, 31));
    ws.addRow([`Template import ${type}`]).font = { bold: true, size: 13 };
    ws.addRow([]);
    const header = ws.addRow(t.columns);
    header.eachCell((c) => {
      c.font = { bold: true };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDDEBF7" } };
    });
    ws.addRow(t.example);
    ws.addRow([]);
    ws.addRow(["Catatan:"]).font = { bold: true };
    for (const n of t.notes) ws.addRow([n]);
    t.columns.forEach((col, i) => {
      ws.getColumn(i + 1).width = Math.min(Math.max(col.length + 4, 14), 30);
    });
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  async import(type: ImportType, buffer: Buffer, user: RequestUser): Promise<ImportResult> {
    this.assertAccess(type, user, "C");
    const t = TEMPLATES[type];
    if (!t) throw new BadRequestException(`Jenis import tidak dikenal: ${type}`);

    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buffer as never);
    } catch {
      throw new BadRequestException("File bukan Excel yang valid (.xlsx)");
    }
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException("Sheet tidak ditemukan");

    const headerRow = ws.getRow(1);
    const colIndex: Record<string, number> = {};
    const lowerToCol: Record<string, string> = {};
    for (const c of t.columns) lowerToCol[c.toLowerCase()] = c;
    headerRow.eachCell((cell, colNumber) => {
      const raw = str(cell.value as Cell).toLowerCase();
      const canonical = lowerToCol[raw];
      if (canonical) colIndex[canonical] = colNumber;
    });
    for (const c of t.columns) {
      if (!(c in colIndex)) {
        throw new BadRequestException(`Kolom "${c}" tidak ditemukan di baris header. Lihat template.`);
      }
    }

    const failed: FailedRow[] = [];
    let imported = 0;
    let total = 0;

    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const data: Record<string, Cell> = {};
      for (const c of t.columns) data[c] = row.getCell(colIndex[c]).value as Cell;
      const isEmpty = t.columns.every((c) => str(data[c]) === "");
      if (isEmpty) continue;
      total++;
      try {
        await this.importRow(type, data);
        imported++;
      } catch (e) {
        failed.push({ row: r, error: e instanceof Error ? e.message : String(e), data });
      }
    }

    await this.audit.log({
      actor: user,
      action: "IMPORT_EXCEL",
      entityType: "import",
      entityId: 0,
      detail: `${type}: ${imported}/${total} baris berhasil, ${failed.length} gagal`,
    });

    return { type, total, imported, failed };
  }

  private async importRow(type: ImportType, data: Record<string, Cell>): Promise<void> {
    switch (type) {
      case "customer":
        return this.importCustomer(data);
      case "supplier":
        return this.importSupplier(data);
      case "product":
        return this.importProduct(data);
      case "warehouse":
        return this.importWarehouse(data);
      case "stock":
        return this.importStock(data);
      case "serial":
        return this.importSerial(data);
    }
  }

  private async importCustomer(d: Record<string, Cell>) {
    const name = str(d.name);
    if (!name) throw new Error("name wajib diisi");
    const email = str(d.email) || undefined;
    if (email) {
      const dup = await this.prisma.main.customer.findFirst({ where: { email } });
      if (dup) throw new Error(`email ${email} sudah dipakai customer lain`);
    }
    const dupName = await this.prisma.main.customer.findFirst({ where: { name } });
    if (dupName) throw new Error(`nama customer "${name}" sudah ada`);
    await this.prisma.main.customer.create({
      data: {
        name,
        pic: str(d.pic) || "-",
        city: str(d.city) || undefined,
        phone: str(d.phone) || undefined,
        email,
        address: str(d.address) || undefined,
      },
    });
  }

  private async importSupplier(d: Record<string, Cell>) {
    const name = str(d.name);
    if (!name) throw new Error("name wajib diisi");
    const dup = await this.prisma.main.supplier.findFirst({ where: { name } });
    if (dup) throw new Error(`nama supplier "${name}" sudah ada`);
    await this.prisma.main.supplier.create({
      data: {
        name,
        pic: str(d.pic) || undefined,
        phone: str(d.phone) || undefined,
        email: str(d.email) || undefined,
        city: str(d.city) || undefined,
        paymentTerms: str(d.paymentTerms) || undefined,
      },
    });
  }

  private async importProduct(d: Record<string, Cell>) {
    const sku = str(d.sku);
    const name = str(d.name);
    const unit = str(d.unit);
    if (!sku) throw new Error("sku wajib diisi");
    if (!name) throw new Error("name wajib diisi");
    if (!unit) throw new Error("unit wajib diisi");
    const dup = await this.prisma.main.product.findUnique({ where: { sku } });
    if (dup) throw new Error(`SKU ${sku} sudah dipakai`);

    const hasSerial = boolYa(d.hasSerial);
    if (hasSerial === null) throw new Error("hasSerial harus YA atau TIDAK");

    let categoryId: number | undefined;
    const catName = str(d.categoryName);
    if (catName) {
      let cat = await this.prisma.main.productCategory.findFirst({ where: { name: catName } });
      if (!cat) cat = await this.prisma.main.productCategory.create({ data: { name: catName } });
      categoryId = cat.id;
    }

    const minStock = num(d.minStock);
    const purchasePrice = num(d.purchasePrice);
    const warrantyMonths = num(d.warrantyMonths);

    await this.prisma.main.product.create({
      data: {
        sku,
        name,
        unit,
        type: str(d.type) || undefined,
        categoryId,
        hasSerial,
        minStock: minStock ?? 0,
        purchasePrice: purchasePrice ?? undefined,
        warrantyMonths: warrantyMonths ?? undefined,
      },
    });
  }

  private async importWarehouse(d: Record<string, Cell>) {
    const name = str(d.name);
    if (!name) throw new Error("name wajib diisi");
    const dup = await this.prisma.main.warehouse.findFirst({ where: { name } });
    if (dup) throw new Error(`nama gudang "${name}" sudah ada`);
    await this.prisma.main.warehouse.create({ data: { name, city: str(d.city) || undefined } });
  }

  private async findProductBySku(sku: string) {
    const p = await this.prisma.main.product.findUnique({ where: { sku } });
    if (!p) throw new Error(`produk dengan SKU ${sku} tidak ditemukan`);
    return p;
  }

  private async findWarehouseByName(name: string) {
    const w = await this.prisma.main.warehouse.findFirst({ where: { name } });
    if (!w) throw new Error(`gudang "${name}" tidak ditemukan`);
    return w;
  }

  /** Saldo stok awal: upsert balance + gerak LAINNYA + SN bila produk hasSerial. */
  private async importStock(d: Record<string, Cell>) {
    const sku = str(d.sku);
    const whName = str(d.warehouse);
    if (!sku) throw new Error("sku wajib diisi");
    if (!whName) throw new Error("warehouse wajib diisi");
    const qty = num(d.qty);
    if (qty === null || !Number.isInteger(qty) || qty < 0) throw new Error("qty harus bilangan bulat >= 0");

    const product = await this.findProductBySku(sku);
    const warehouse = await this.findWarehouseByName(whName);

    let sns: string[] = [];
    if (product.hasSerial) {
      const raw = str(d.serials);
      if (!raw) throw new Error("produk hasSerial — kolom serials wajib (pisahkan koma)");
      sns = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (sns.length !== qty) {
        throw new Error(`jumlah serials (${sns.length}) harus sama dengan qty (${qty})`);
      }
      for (const sn of sns) {
        const exists = await this.prisma.main.serialUnit.findUnique({ where: { sn } });
        if (exists) throw new Error(`SN ${sn} sudah tercatat`);
      }
    } else if (str(d.serials)) {
      throw new Error("produk tidak hasSerial — kolom serials harus kosong");
    }

    await this.prisma.main.$transaction(async (tx) => {
      await tx.stockBalance.upsert({
        where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
        create: { productId: product.id, warehouseId: warehouse.id, qty },
        update: { qty: { increment: qty } },
      });
      if (qty > 0) {
        await tx.stockMovement.create({
          data: {
            date: new Date(),
            type: "IN",
            category: "LAINNYA",
            productId: product.id,
            toWarehouseId: warehouse.id,
            qty,
            reason: "Impor saldo stok awal (Excel)",
          },
        });
      }
      for (const sn of sns) {
        const unit = await tx.serialUnit.create({
          data: { sn, productId: product.id, warehouseId: warehouse.id, status: "DI_GUDANG" },
        });
        await tx.serialUnitHistory.create({
          data: { serialUnitId: unit.id, status: "DI_GUDANG", warehouseId: warehouse.id },
        });
      }
    });
  }

  /** Tambah SN ke stok gudang yang sudah ada (qty +1 per baris). */
  private async importSerial(d: Record<string, Cell>) {
    const sku = str(d.sku);
    const whName = str(d.warehouse);
    const sn = str(d.sn);
    if (!sku) throw new Error("sku wajib diisi");
    if (!whName) throw new Error("warehouse wajib diisi");
    if (!sn) throw new Error("sn wajib diisi");

    const product = await this.findProductBySku(sku);
    if (!product.hasSerial) throw new Error(`produk ${sku} tidak ber-SN (hasSerial=false)`);
    const warehouse = await this.findWarehouseByName(whName);
    const dup = await this.prisma.main.serialUnit.findUnique({ where: { sn } });
    if (dup) throw new Error(`SN ${sn} sudah tercatat`);

    await this.prisma.main.$transaction(async (tx) => {
      const unit = await tx.serialUnit.create({
        data: { sn, productId: product.id, warehouseId: warehouse.id, status: "DI_GUDANG" },
      });
      await tx.stockBalance.upsert({
        where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
        create: { productId: product.id, warehouseId: warehouse.id, qty: 1 },
        update: { qty: { increment: 1 } },
      });
      await tx.stockMovement.create({
        data: {
          date: new Date(),
          type: "IN",
          category: "LAINNYA",
          productId: product.id,
          toWarehouseId: warehouse.id,
          qty: 1,
          serialUnitId: unit.id,
          reason: `Impor serial number ${sn} (Excel)`,
        },
      });
    });
  }
}
