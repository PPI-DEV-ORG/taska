import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip, searchWhere } from "../common/utils/query.js";
import { SupplierDto } from "./dto.js";

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: PageQuery & { status?: string }) {
    const where = searchWhere(
      q,
      [["name", "contains"], ["pic", "contains"], ["city", "contains"], ["email", "contains"]],
      q.status ? { status: q.status as "AKTIF" | "NONAKTIF" } : {},
    );
    if (q.q && Array.isArray(where.OR)) {
      where.OR.push({ itemTags: { some: { itemName: { contains: q.q } } } });
    }
    const [items, total] = await Promise.all([
      (this.prisma.main.supplier as any).findMany({
        where,
        include: { itemTags: true },
        orderBy: orderBy(q.sort, q.dir, ["name", "createdAt"], "createdAt"),
        ...pageSkip(q),
      }),
      this.prisma.main.supplier.count({ where }),
    ]);
    return paginate(items, total, q);
  }

  options() {
    return (this.prisma.main.supplier as any).findMany({
      where: { status: "AKTIF" },
      select: { id: true, name: true, city: true, paymentTerms: true, taxStatus: true, itemTags: true },
      orderBy: { name: "asc" },
    });
  }

  async get(id: number) {
    const row = await (this.prisma.main.supplier as any).findUnique({
      where: { id },
      include: { itemTags: true },
    });
    if (!row) throw new NotFoundException("Supplier tidak ditemukan");
    return row;
  }

  async create(dto: SupplierDto) {
    const { tags, ...supplierData } = dto;
    return (this.prisma.main.supplier as any).create({
      data: {
        ...supplierData,
        name: dto.name || "Supplier Baru",
        taxStatus: dto.taxStatus || "NON_PKP",
        ...(Array.isArray(tags) && tags.length > 0
          ? {
              itemTags: {
                create: tags
                  .filter((t) => t.itemName?.trim())
                  .map((t) => ({
                    itemName: t.itemName.trim(),
                    price: t.price != null && !Number.isNaN(Number(t.price)) ? Number(t.price) : null,
                  })),
              },
            }
          : {}),
      },
      include: { itemTags: true },
    });
  }

  async update(id: number, dto: SupplierDto) {
    await this.get(id);
    const { tags, ...supplierData } = dto;
    if (Array.isArray(tags)) {
      await (this.prisma.main as any).supplierItemTag.deleteMany({ where: { supplierId: id } }).catch(() => {});
      const validTags = tags.filter((t) => t.itemName?.trim());
      if (validTags.length > 0) {
        await (this.prisma.main as any).supplierItemTag.createMany({
          data: validTags.map((t) => ({
            supplierId: id,
            itemName: t.itemName.trim(),
            price: t.price != null && !Number.isNaN(Number(t.price)) ? Number(t.price) : null,
          })),
        }).catch(() => {});
      }
    }
    return (this.prisma.main.supplier as any).update({
      where: { id },
      data: {
        ...supplierData,
        ...(dto.taxStatus ? { taxStatus: dto.taxStatus } : {}),
      },
      include: { itemTags: true },
    });
  }

  async remove(id: number) {
    await this.get(id);
    const [requests, pos, invoices] = await Promise.all([
      this.prisma.main.purchaseRequest.count({ where: { supplierId: id } }),
      this.prisma.main.supplierPO.count({ where: { supplierId: id } }),
      this.prisma.main.invoiceIn.count({ where: { supplierId: id } }),
    ]);
    const used = [
      { label: "request pembelian", count: requests },
      { label: "PO supplier", count: pos },
      { label: "invoice masuk", count: invoices },
    ].filter((b) => b.count > 0);
    if (used.length) {
      throw new ConflictException(
        `Supplier masih dipakai oleh ${used.map((b) => `${b.count} ${b.label}`).join(", ")}`,
      );
    }
    await this.prisma.main.supplier.delete({ where: { id } });
    return { id, deleted: true };
  }
}
