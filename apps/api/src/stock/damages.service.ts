import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { StockService } from "./stock.service.js";
import { SerialsService } from "./serials.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { PostingService } from "../accounting/posting.service.js";
import { MappingService } from "../accounting/mapping.service.js";
import { PostingRules } from "../accounting/posting.rules.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import type { DamageCreateDto, DamageListQuery, DamageReplaceDto } from "./dto.js";

@Injectable()
export class DamagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly serials: SerialsService,
    private readonly notifications: NotificationsService,
    private readonly postingService: PostingService,
    private readonly mappingService: MappingService,
  ) {}

  async list(q: DamageListQuery) {
    const where = {
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.productId ? { productId: q.productId } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.main.damageReport.count({ where }),
      this.prisma.main.damageReport.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true, hasSerial: true } },
          serialUnit: {
            select: {
              id: true,
              sn: true,
              status: true,
              replacedBy: { select: { id: true, sn: true, status: true } },
            },
          },
          reporter: { select: { name: true } },
        },
        orderBy: [{ date: "desc" }, { id: "desc" }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
    ]);
    return { items: rows, total, page: q.page, limit: q.limit };
  }

  async create(dto: DamageCreateDto, user: RequestUser) {
    const product = dto.productId
      ? await this.prisma.main.product.findUnique({ where: { id: dto.productId } })
      : await this.prisma.main.product.findFirst();
    if (!product) throw new NotFoundException("Produk tidak ditemukan");
    let serial = null;
    if (dto.serialUnitId) {
      serial = await this.prisma.main.serialUnit.findUnique({ where: { id: dto.serialUnitId } });
      if (!serial) throw new NotFoundException("Serial number tidak ditemukan");
    } else if (dto.description) {
      const snMatch = dto.description.match(/\[SN:\s*([^\]]+)\]/i);
      if (snMatch?.[1]) {
        serial = await this.prisma.main.serialUnit.findUnique({
          where: { sn: snMatch[1].trim() },
        });
      }
    }

    const type = dto.type ?? "RUSAK";
    const description = dto.description || "-";
    const isReturPenjualan = description.includes("[RETUR-PENJUALAN]");
    const isReturPembelian = description.includes("[RETUR-PEMBELIAN]");
    const qty = dto.qty ?? 1;

    // Cek apakah SN sebelumnya berada di gudang (stok aktif) sehingga harus dikurangi dari stockBalance
    const shouldDeductActiveStock =
      isReturPembelian ||
      (!isReturPenjualan && (!serial || serial.status === "DI_GUDANG" || serial.status === "RESERVED"));

    const wh = serial?.warehouseId
      ? { id: serial.warehouseId }
      : await this.prisma.main.warehouse.findFirst({ select: { id: true } });

    const created = await this.prisma.main.$transaction(async (tx) => {
      const row = await tx.damageReport.create({
        data: {
          date: dto.date ? new Date(dto.date) : new Date(),
          productId: product.id,
          serialUnitId: serial?.id ?? dto.serialUnitId ?? null,
          type,
          qty,
          description,
          status: dto.status ?? "DILAPORKAN",
          fileId: dto.fileId ?? null,
          reporterId: user.id,
        },
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true, hasSerial: true } },
          serialUnit: {
            select: {
              id: true,
              sn: true,
              status: true,
              replacedBy: { select: { id: true, sn: true, status: true } },
            },
          },
          reporter: { select: { name: true } },
        },
      });
      if (serial) {
        const nextSerialStatus = isReturPenjualan || isReturPembelian ? "RETUR" : "RUSAK";
        if (serial.status !== nextSerialStatus) {
          await tx.serialUnit.update({ where: { id: serial.id }, data: { status: nextSerialStatus as any } });
          await tx.serialUnitHistory.create({
            data: {
              serialUnitId: serial.id,
              status: nextSerialStatus as any,
              warehouseId: serial.warehouseId,
              note: description,
              changedById: user.id,
            },
          });
        }
      }
      return row;
    });

    // Guard Stok Negatif (Poin 4 & 5 E7): Cegah laporan barang rusak jika stok fisik kosong
    if (wh?.id && shouldDeductActiveStock) {
      const currentBal = await this.stock.balanceOf(product.id, wh.id);
      if (currentBal < qty) {
        throw new BadRequestException(
          `Stok fisik "${product.name}" di gudang tidak mencukupi (Tersedia: ${currentBal}, Dilaporkan Rusak: ${qty}). Laporan kerusakan ditolak untuk mencegah stok minus.`,
        );
      }
      const deductQty = Math.min(currentBal, qty);
      if (deductQty > 0) {
        await this.stock.applyMovement({
          date: dto.date ? new Date(dto.date) : new Date(),
          type: "OUT",
          category: "PENGGANTIAN",
          productId: product.id,
          fromWarehouseId: wh.id,
          qty: deductQty,
          serialUnitId: serial?.id ?? null,
          reason: `${isReturPembelian ? "Retur Pembelian" : "Laporan Barang Rusak"}${serial?.sn ? ` (SN: ${serial.sn})` : ""}: ${description}`,
          createdById: user.id,
        }).catch(() => {});

        // Posting Akuntansi: Kerusakan Barang (Stock Damage) -> Dr 5105 Cr 1200
        if (!isReturPembelian) {
          try {
            const avg = Number(product.avgCost || product.purchasePrice || 0);
            const totalCost = deductQty * avg;
            if (totalCost > 0) {
              const mappings = await this.mappingService.getAll();
              const dLines = PostingRules.buildDamageLines(
                { id: created.id, number: `DAM-${created.id}`, costTotal: totalCost },
                mappings,
              );
              await this.postingService.post({
                sourceType: "DamageReport",
                sourceId: created.id,
                event: "damaged",
                source: "DAMAGE",
                date: dto.date ? new Date(dto.date) : new Date(),
                memo: `Beban Kerusakan Barang #${created.id} (${product.name})`,
                refNo: `DAM-${String(created.id).padStart(3, "0")}`,
                createdById: user.id,
                lines: dLines,
              });
            }
          } catch (err) {
            console.error("Posting damage error:", err);
          }
        }
      }
    } else if (wh?.id && isReturPenjualan) {
      // Retur dari customer dicatat di riwayat mutasi tanpa menambah stok bagus sebelum diganti/diperbaiki
      await this.prisma.main.stockMovement.create({
        data: {
          date: dto.date ? new Date(dto.date) : new Date(),
          type: "IN",
          category: "RETUR_PROJECT",
          productId: product.id,
          qty,
          toWarehouseId: wh.id,
          serialUnitId: serial?.id ?? null,
          reason: `Retur Penjualan diterima (menunggu penggantian)${serial?.sn ? ` [SN: ${serial.sn}]` : ""}: ${description}`,
          createdById: user.id,
        },
      }).catch(() => {});
    }

    if (dto.fileId) {
      await this.prisma.main.file
        .update({
          where: { id: dto.fileId },
          data: { refType: "damage-report", refId: String(created.id) },
        })
        .catch(() => {});
    }

    const labelKind = isReturPenjualan
      ? "Retur Penjualan"
      : isReturPembelian
        ? "Retur Pembelian"
        : "Laporan Kerusakan";
    await this.notifications
      .notify({
        roles: ["GUDANG", "PROCUREMENT", "FINANCE", "BOS"],
        kind: "STOK",
        title: labelKind,
        text: `${labelKind}: ${product.name}${serial?.sn ? ` (SN: ${serial.sn})` : ` (${qty} ${product.unit})`}`,
        href: `/damage-reports/${created.id}`,
      })
      .catch(() => {});
    this.notifications.dataChange("damage-reports", "create", created.id);
    this.notifications.dataChange("stock", "update", product.id);
    if (serial?.id) this.notifications.dataChange("serials", "update", serial.id);

    return created;
  }

  /** Terima Barang Pengganti (SN baru menggantikan SN lama yang rusak/retur, atau tambah stok pengganti Non-SN). */
  async receiveReplacement(id: number, dto: DamageReplaceDto, user: RequestUser) {
    const row = await this.prisma.main.damageReport.findUnique({
      where: { id },
      include: {
        product: true,
        serialUnit: true,
      },
    });
    if (!row) throw new NotFoundException("Laporan kerusakan / retur tidak ditemukan");
    const reason = dto.reason?.trim() || `Penggantian dari Laporan #${row.id}`;

    // Jika barang memiliki unit SN atau user mengisi SN pengganti baru
    if (row.serialUnitId && dto.newSn?.trim()) {
      const newUnit = await this.serials.replace(
        row.serialUnitId,
        {
          newSn: dto.newSn.trim(),
          reason,
          warrantyEndsAt: dto.warrantyEndsAt,
          damageReportId: row.id,
        },
        user,
      );
      const updatedReport = await this.prisma.main.damageReport.update({
        where: { id: row.id },
        data: {
          status: "SELESAI",
          description: row.description.includes("[DIGANTI:")
            ? row.description
            : `${row.description} [DIGANTI: ${newUnit.sn}]`,
        },
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true, hasSerial: true } },
          serialUnit: {
            select: {
              id: true,
              sn: true,
              status: true,
              replacedBy: { select: { id: true, sn: true, status: true } },
            },
          },
          reporter: { select: { name: true } },
        },
      });
      await this.notifications
        .notify({
          userIds: row.reporterId ? [row.reporterId] : [],
          roles: ["GUDANG", "PROCUREMENT", "FINANCE"],
          kind: "STOK",
          title: "Barang Pengganti Diterima",
          text: `${row.product?.name ?? "Barang"} SN ${row.serialUnit?.sn ?? "-"} telah diganti dengan SN baru ${newUnit.sn}`,
          href: `/damage-reports/${row.id}`,
        })
        .catch(() => {});
      this.notifications.dataChange("damage-reports", "update", row.id);
      this.notifications.dataChange("serials", "update", newUnit.id);
      this.notifications.dataChange("stock", "update", row.productId);
      return { report: updatedReport, newSerialUnit: newUnit };
    }

    // Jika barang ber-SN tetapi pada laporan awal belum tertaut ke serialUnitId (atau SN baru saja didaftarkan)
    if (dto.newSn?.trim()) {
      const cleanNewSn = dto.newSn.trim();
      const wh = dto.warehouseId
        ? { id: dto.warehouseId }
        : await this.prisma.main.warehouse.findFirst({ select: { id: true } });
      if (!wh) throw new BadRequestException("Gudang tidak ditemukan");

      const batchRes = await this.serials.createBatch(
        {
          productId: row.productId,
          warehouseId: wh.id,
          serials: [cleanNewSn],
          warrantyEndsAt: dto.warrantyEndsAt,
          note: reason,
        },
        user,
      );
      const updatedReport = await this.prisma.main.damageReport.update({
        where: { id: row.id },
        data: {
          status: "SELESAI",
          description: `${row.description} [DIGANTI: ${cleanNewSn}]`,
        },
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true, hasSerial: true } },
          serialUnit: {
            select: {
              id: true,
              sn: true,
              status: true,
              replacedBy: { select: { id: true, sn: true, status: true } },
            },
          },
          reporter: { select: { name: true } },
        },
      });
      await this.notifications
        .notify({
          userIds: row.reporterId ? [row.reporterId] : [],
          roles: ["GUDANG", "PROCUREMENT", "FINANCE"],
          kind: "STOK",
          title: "Barang Pengganti Diterima",
          text: `${row.product?.name ?? "Barang"} telah diganti dengan SN baru ${cleanNewSn}`,
          href: `/damage-reports/${row.id}`,
        })
        .catch(() => {});
      this.notifications.dataChange("damage-reports", "update", row.id);
      this.notifications.dataChange("serials", "create", batchRes.units?.[0]?.id);
      this.notifications.dataChange("stock", "update", row.productId);
      return { report: updatedReport, newSerialUnit: batchRes.units?.[0] ?? null };
    }

    // Barang Non-SN: tambahkan kembali stok sejumlah qty pengganti yang diterima
    const wh = dto.warehouseId
      ? { id: dto.warehouseId }
      : await this.prisma.main.warehouse.findFirst({ select: { id: true } });
    if (!wh) throw new BadRequestException("Gudang tidak ditemukan");
    const replaceQty = dto.qty ?? row.qty ?? 1;

    await this.stock.applyMovement({
      date: new Date(),
      type: "IN",
      category: "PENGGANTIAN",
      productId: row.productId,
      toWarehouseId: wh.id,
      qty: replaceQty,
      reason: `Terima barang pengganti (${replaceQty} ${row.product?.unit ?? "unit"}): ${reason}`,
      createdById: user.id,
    });

    const updatedReport = await this.prisma.main.damageReport.update({
      where: { id: row.id },
      data: {
        status: "SELESAI",
        description: `${row.description} [DIGANTI: ${replaceQty} ${row.product?.unit ?? "unit"}]`,
      },
      include: {
        product: { select: { id: true, name: true, sku: true, unit: true, hasSerial: true } },
        serialUnit: {
          select: {
            id: true,
            sn: true,
            status: true,
            replacedBy: { select: { id: true, sn: true, status: true } },
          },
        },
        reporter: { select: { name: true } },
      },
    });
      await this.notifications
        .notify({
          userIds: row.reporterId ? [row.reporterId] : [],
          roles: ["GUDANG", "PROCUREMENT", "FINANCE"],
          kind: "STOK",
          title: "Barang Pengganti Diterima",
          text: `Barang pengganti untuk ${row.product?.name ?? "Barang"} (${replaceQty} ${row.product?.unit ?? "unit"}) telah diterima di gudang`,
          href: `/damage-reports/${row.id}`,
        })
        .catch(() => {});
      this.notifications.dataChange("damage-reports", "update", row.id);
      this.notifications.dataChange("stock", "update", row.productId);
      return { report: updatedReport };
    }

  async get(id: number) {
    const row = await this.prisma.main.damageReport.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, name: true, sku: true, unit: true, hasSerial: true } },
        serialUnit: {
          select: {
            id: true,
            sn: true,
            status: true,
            replacedBy: { select: { id: true, sn: true, status: true } },
          },
        },
        reporter: { select: { id: true, name: true } },
      },
    });
    if (!row) throw new NotFoundException("Laporan tidak ditemukan");
    const file = row.fileId
      ? await this.prisma.main.file.findUnique({
          where: { id: row.fileId },
          select: { id: true, originalName: true, mimeType: true, size: true },
        })
      : null;
    return { ...row, file };
  }

  async update(id: number, dto: DamageCreateDto) {
    const row = await this.prisma.main.damageReport.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Laporan tidak ditemukan");
    const updated = await this.prisma.main.damageReport.update({
      where: { id },
      data: {
        ...(dto.date ? { date: new Date(dto.date) } : {}),
        ...(dto.productId ? { productId: dto.productId } : {}),
        ...(dto.serialUnitId !== undefined ? { serialUnitId: dto.serialUnitId } : {}),
        ...(dto.type ? { type: dto.type } : {}),
        ...(dto.qty !== undefined ? { qty: dto.qty } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.fileId !== undefined ? { fileId: dto.fileId } : {}),
      },
      include: {
        product: { select: { name: true, sku: true, unit: true } },
        serialUnit: { select: { sn: true } },
        reporter: { select: { name: true } },
      },
    });
    if (dto.fileId) {
      await this.prisma.main.file
        .update({
          where: { id: dto.fileId },
          data: { refType: "damage-report", refId: String(id) },
        })
        .catch(() => {});
    }
    return updated;
  }

  async setStatus(id: number, status: "DILAPORKAN" | "DIPROSES" | "SELESAI") {
    const row = await this.prisma.main.damageReport.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Laporan tidak ditemukan");
    return this.prisma.main.damageReport.update({
      where: { id },
      data: { status },
      include: {
        product: { select: { name: true, sku: true, unit: true } },
        serialUnit: { select: { sn: true } },
        reporter: { select: { name: true } },
      },
    });
  }

  async remove(id: number) {
    const row = await this.prisma.main.damageReport.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Laporan tidak ditemukan");
    await this.prisma.main.damageReport.delete({ where: { id } });
    return { id, deleted: true };
  }
}
