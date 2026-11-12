import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { ApprovalsService } from "../approvals/approvals.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { AuditService } from "../audit/audit.service.js";
import { StockService } from "../stock/stock.service.js";
import { DocumentNumberService } from "../document-number/document-number.service.js";
import { SettingsService } from "../settings/settings.service.js";
import { PostingService } from "../accounting/posting.service.js";
import { MappingService } from "../accounting/mapping.service.js";
import { PostingRules } from "../accounting/posting.rules.js";
import { can } from "../rbac/permissions.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import type {
  DeliveryCreateDto,
  DeliveryListQuery,
  DeliveryReportDto,
  DeliveryStatusDto,
  GoodsDto,
} from "./dto.js";

@Injectable()
export class DeliveryService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvals: ApprovalsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly stock: StockService,
    private readonly docnum: DocumentNumberService,
    private readonly settings: SettingsService,
    private readonly postingService: PostingService,
    private readonly mappingService: MappingService,
  ) {
    this.approvals.onChange("SURAT_JALAN", (entityId, status) => this.onApproval(entityId, status));
  }

  async onModuleInit() {
    await this.prisma.main
      .$executeRawUnsafe("ALTER TABLE `DeliveryNote` MODIFY COLUMN `reportText` LONGTEXT NULL")
      .catch(() => {});
  }

  private async onApproval(entityId: number, status: "MENUNGGU" | "DISETUJUI" | "DITOLAK") {
    const row = await this.prisma.main.deliveryNote.findUnique({ where: { id: entityId } });
    if (!row || row.status !== "PENDING") return;
    if (status === "DITOLAK") {
      await this.prisma.main.deliveryNote.update({
        where: { id: entityId },
        data: { status: "DIBATALKAN" },
      });
    }
  }

  async suggestNumber() {
    return { number: await this.docnum.suggest("suratJalan") };
  }

  async create(dto: DeliveryCreateDto, user: RequestUser) {
    const locations = dto.locations?.length ? dto.locations : [{ destination: "-", reason: "Dinas luar" }];
    const withGoods = dto.withGoods === true || dto.withGoods === "true";
    const date = dto.date ? new Date(dto.date) : new Date();

    let number = dto.number?.trim();
    if (number) {
      const dup = await this.prisma.main.deliveryNote.findUnique({ where: { number } });
      if (dup) {
        const isAutoPattern = /^SJN\/\d{4}\/\d{2}\/\d+$/i.test(number);
        if (isAutoPattern) {
          number = await this.docnum.next("suratJalan", date);
        } else {
          throw new ConflictException(`Nomor ${number} sudah dipakai`);
        }
      }
    } else {
      number = await this.docnum.next("suratJalan", date);
    }

    const scanFileId = dto.scanFileId ?? dto.fileId;
    const createData = {
      number,
      creatorId: user.id,
      withGoods,
      date,
      status: (dto.status ?? "PENDING") as any,
      reportText: dto.reportText,
      reportFileId: dto.reportFileId,
      scanFileId,
      locations: {
        create: locations.map((l) => ({
          destination: l.destination || "-",
          reason: l.reason || "Dinas luar",
          projectId: l.projectId ?? null,
        })),
      },
      items: dto.items?.length
        ? {
            create: dto.items.map((i) => ({
              productId: i.productId,
              qty: i.qty ?? 1,
              serials: i.serials ?? null,
              note: i.note ?? null,
            })),
          }
        : undefined,
    };
    const includeSelect = {
      creator: { select: { name: true, role: true } },
      locations: { include: { project: { select: { name: true } } } },
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true, hasSerial: true, brand: true } },
        },
      },
    };

    let row;
    try {
      row = await this.prisma.main.deliveryNote.create({
        data: createData,
        include: includeSelect,
      });
    } catch (err: any) {
      if (err?.code === "P2000" || err?.message?.includes("reportText") || err?.message?.includes("too long")) {
        await this.prisma.main
          .$executeRawUnsafe("ALTER TABLE `DeliveryNote` MODIFY COLUMN `reportText` LONGTEXT NULL")
          .catch(() => {});
        row = await this.prisma.main.deliveryNote.create({
          data: createData,
          include: includeSelect,
        });
      } else {
        throw err;
      }
    }

    if (scanFileId) {
      await this.prisma.main.file.update({
        where: { id: scanFileId },
        data: { refType: "delivery-note", refId: String(row.id) },
      }).catch(() => {});
    }

    await this.approvals.request({
      kind: "SURAT_JALAN",
      entityId: row.id,
      title: `Surat jalan ${number}`,
      amount: 0,
      requestedBy: user,
      href: `/delivery-notes/${row.id}`,
    });

    if (withGoods) {
      await this.notifications.notify({
        roles: ["GUDANG"],
        kind: "SURAT",
        text: `Surat jalan ${number} — barang siap discan untuk ${locations[0].destination}`,
        href: `/delivery-notes/${row.id}`,
      });
    }
    this.notifications.dataChange("delivery-notes", "create", row.id);
    return row;
  }

  async update(id: number, dto: DeliveryCreateDto, user: RequestUser) {
    const row = await this.prisma.main.deliveryNote.findUnique({
      where: { id },
      include: { locations: true },
    });
    if (!row) throw new NotFoundException("Surat jalan tidak ditemukan");

    if (dto.status === "DITERIMA") {
      const hasProof = dto.scanFileId ?? dto.fileId ?? row.scanFileId;
      if (!hasProof) {
        throw new BadRequestException("Bukti tanda terima / scan surat jalan bertanda tangan wajib dilampirkan sebelum status dapat diubah menjadi Diterima");
      }
    }

    if (dto.status === "DIBATALKAN") {
      await this.postingService.reverse("DeliveryNote", id, "shipped", dto.reason || "Surat jalan dibatalkan", user.id).catch(() => {});
    }

    const updated = await this.prisma.main.deliveryNote.update({
      where: { id },
      data: {
        ...(dto.date ? { date: new Date(dto.date) } : {}),
        ...(dto.withGoods !== undefined ? { withGoods: dto.withGoods === true || dto.withGoods === "true" } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.reportText !== undefined ? { reportText: dto.reportText, reportAt: new Date() } : {}),
        ...(dto.reportFileId !== undefined ? { reportFileId: dto.reportFileId } : {}),
        ...(dto.scanFileId !== undefined || dto.fileId !== undefined ? { scanFileId: dto.scanFileId ?? dto.fileId } : {}),
        ...(dto.locations?.length
          ? {
              locations: {
                deleteMany: {},
                create: dto.locations.map((l) => ({
                  destination: l.destination || "-",
                  reason: l.reason || "Dinas luar",
                  projectId: l.projectId ?? null,
                })),
              },
            }
          : {}),
        ...(dto.items?.length
          ? {
              items: {
                deleteMany: {},
                create: dto.items.map((i) => ({
                  productId: i.productId,
                  qty: i.qty ?? 1,
                  serials: i.serials ?? null,
                  note: i.note ?? null,
                })),
              },
            }
          : {}),
      },
      include: {
        creator: { select: { name: true, role: true } },
        locations: { include: { project: { select: { name: true } } } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, unit: true, hasSerial: true, brand: true } },
          },
        },
      },
    });

    const effectiveStatus = dto.status || row.status;
    if (["DIKIRIM", "DITERIMA"].includes(effectiveStatus) && dto.items?.length) {
      const firstLoc = updated.locations?.[0] || row.locations?.[0];
      await this.syncSerialsOnUpdate(id, row.number, effectiveStatus, firstLoc, dto.items, user);
    }

    if (dto.scanFileId || dto.fileId) {
      const fid = dto.scanFileId ?? dto.fileId;
      const fileRow = await this.prisma.main.file.findUnique({ where: { id: Number(fid) } }).catch(() => null);
      const isImg = fileRow?.mimeType?.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(fileRow?.originalName || "");
      await this.prisma.main.file.update({
        where: { id: Number(fid) },
        data: { refType: "delivery-note", refId: String(id), kind: isImg ? "FOTO" : "DOKUMEN" },
      }).catch(() => {});
    }
    if (dto.reportFileId) {
      const fileRow = await this.prisma.main.file.findUnique({ where: { id: Number(dto.reportFileId) } }).catch(() => null);
      const isImg = fileRow?.mimeType?.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(fileRow?.originalName || "");
      await this.prisma.main.file.update({
        where: { id: Number(dto.reportFileId) },
        data: { refType: "delivery-note-report", refId: String(id), kind: isImg ? "FOTO" : "DOKUMEN" },
      }).catch(() => {});
    }

    this.notifications.dataChange("delivery-notes", "update", updated.id);
    return this.get(id);
  }

  private async syncSerialsOnUpdate(
    id: number,
    dnNumber: string,
    dnStatus: string,
    firstLocation: any,
    items: any[],
    user: RequestUser,
  ) {
    const rawSerials = (items ?? [])
      .flatMap((it) => (it.serials ? String(it.serials).split(",") : []))
      .map((s) => s.trim())
      .filter(Boolean);
    const uniqueSerials = Array.from(new Set(rawSerials));
    if (uniqueSerials.length === 0) return;

    const units = await this.prisma.main.serialUnit.findMany({
      where: { sn: { in: uniqueSerials } },
    });

    const isDelivered = dnStatus === "DITERIMA";
    const targetStatus = isDelivered && firstLocation?.projectId ? "TERPASANG" : "DIKIRIM";

    for (const u of units) {
      const existingMovement = await this.prisma.main.stockMovement.findFirst({
        where: { deliveryNoteId: id, serialUnitId: u.id },
      });

      if (!existingMovement) {
        const unlinkedMovement = await this.prisma.main.stockMovement.findFirst({
          where: { deliveryNoteId: id, productId: u.productId, serialUnitId: null },
        });

        if (unlinkedMovement) {
          if (Number(unlinkedMovement.qty) > 1) {
            await this.prisma.main.stockMovement.update({
              where: { id: unlinkedMovement.id },
              data: { qty: Number(unlinkedMovement.qty) - 1 },
            });
            await this.prisma.main.stockMovement.create({
              data: {
                date: unlinkedMovement.date,
                type: "OUT",
                category: unlinkedMovement.category,
                productId: u.productId,
                fromWarehouseId: unlinkedMovement.fromWarehouseId,
                qty: 1,
                serialUnitId: u.id,
                deliveryNoteId: id,
                projectId: firstLocation?.projectId ?? unlinkedMovement.projectId ?? null,
                reason: unlinkedMovement.reason,
                createdById: user.id,
              },
            });
          } else {
            await this.prisma.main.stockMovement.update({
              where: { id: unlinkedMovement.id },
              data: { serialUnitId: u.id },
            });
          }
        } else {
          await this.stock.applyMovement({
            date: new Date(),
            type: "OUT",
            category: "KELUAR_SURAT_JALAN",
            productId: u.productId,
            fromWarehouseId: u.warehouseId ?? undefined,
            qty: 1,
            serialUnitId: u.id,
            deliveryNoteId: id,
            projectId: firstLocation?.projectId ?? null,
            reason: firstLocation ? `${firstLocation.destination} — ${firstLocation.reason}` : null,
            createdById: user.id,
          }).catch(() => {});
        }
      }

      if (u.status !== targetStatus) {
        await this.prisma.main.serialUnit.update({
          where: { id: u.id },
          data: {
            status: targetStatus,
            warehouseId: null,
            ...(isDelivered && firstLocation?.projectId ? { projectId: firstLocation.projectId } : {}),
          },
        });
        await this.prisma.main.stockReservation.updateMany({
          where: { serialUnitId: u.id, releasedAt: null },
          data: { releasedAt: new Date() },
        });
        await this.prisma.main.serialUnitHistory.create({
          data: {
            serialUnitId: u.id,
            status: targetStatus,
            projectId: isDelivered ? firstLocation?.projectId : null,
            note: isDelivered
              ? `Diterima dan terpasang di lokasi ${firstLocation?.destination ?? "-"} (surat jalan ${dnNumber})`
              : `Keluar dengan surat jalan ${dnNumber} (input SN)`,
            changedById: user.id,
          },
        });
      }
    }
  }

  async list(q: DeliveryListQuery) {
    const where = {
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.withGoods !== undefined ? { withGoods: q.withGoods === "true" } : {}),
      ...(q.creatorId ? { creatorId: q.creatorId } : {}),
      ...(q.from || q.to
        ? { date: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } }
        : {}),
      ...(q.q ? { number: { contains: q.q } } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.main.deliveryNote.count({ where }),
      this.prisma.main.deliveryNote.findMany({
        where,
        include: {
          creator: { select: { name: true, role: true } },
          locations: { include: { project: { select: { name: true } } } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true, unit: true, hasSerial: true, brand: true } },
            },
          },
        },
        orderBy: [{ date: "desc" }, { id: "desc" }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
    ]);
    const items = await Promise.all(
      rows.map(async (r) => ({ ...r, approval: await this.approvals.getFor("SURAT_JALAN", r.id) })),
    );
    return { items, total, page: q.page, limit: q.limit };
  }

  async get(id: number) {
    const row = await this.prisma.main.deliveryNote.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, role: true } },
        locations: { include: { project: { select: { id: true, name: true } } } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, unit: true, hasSerial: true, brand: true } },
          },
        },
        movements: {
          include: {
            serialUnit: { select: { sn: true, status: true } },
            product: { select: { name: true, sku: true, unit: true } },
            fromWarehouse: { select: { name: true } },
          },
        },
        expenses: { select: { id: true, amount: true, description: true, status: true } },
      },
    });
    if (!row) throw new NotFoundException("Surat jalan tidak ditemukan");
    const [scanFile, reportFile, approval] = await Promise.all([
      row.scanFileId
        ? this.prisma.main.file.findUnique({
            where: { id: row.scanFileId },
            select: { id: true, originalName: true, mimeType: true, size: true, kind: true },
          }).catch(() => null)
        : null,
      row.reportFileId
        ? this.prisma.main.file.findUnique({
            where: { id: row.reportFileId },
            select: { id: true, originalName: true, mimeType: true, size: true, kind: true },
          }).catch(() => null)
        : null,
      this.approvals.getFor("SURAT_JALAN", id),
    ]);
    return { ...row, scanFile, reportFile, approval };
  }

  private async assertApproved(id: number) {
    const approval = await this.approvals.getFor("SURAT_JALAN", id);
    if (approval && approval.status === "DITOLAK") {
      throw new BadRequestException("Surat jalan ditolak Finance/Bos");
    }
  }

  /** Siapkan dan keluarkan barang (Serial Number & Barang Curah) untuk Surat Jalan. */
  async prepareGoods(id: number, dto: GoodsDto, user: RequestUser) {
    const row = await this.prisma.main.deliveryNote.findUnique({
      where: { id },
      include: {
        locations: true,
        items: { include: { product: true } },
      },
    });
    if (!row) throw new NotFoundException("Surat jalan tidak ditemukan");

    const firstLocation = row.locations[0];
    // Guard Stok Negatif (Poin 4 & 5 E7): Verifikasi saldo stok fisik gudang sebelum Surat Jalan dikirim
    const itemsToCheck = dto.items?.length ? dto.items : row.items;
    for (const it of itemsToCheck) {
      if (!it.productId) continue;
      const totalAvail = await this.prisma.main.stockBalance.aggregate({
        where: { productId: it.productId },
        _sum: { qty: true },
      });
      const currentStock = totalAvail._sum.qty || 0;
      if (currentStock < Number(it.qty || 0)) {
        const prod = await this.prisma.main.product.findUnique({ where: { id: it.productId } });
        throw new BadRequestException(
          `Stok tidak mencukupi untuk "${prod?.name || it.productId}". Tersedia: ${currentStock}, Dikirim: ${it.qty}. Pengiriman Surat Jalan ditolak untuk mencegah stok minus.`,
        );
      }
    }

    const defaultWarehouse =
      (await this.prisma.main.warehouse.findFirst({ where: { status: "AKTIF" } })) ??
      (await this.prisma.main.warehouse.findFirst());

    const alreadyDispatched = await this.prisma.main.stockMovement.count({
      where: { deliveryNoteId: id, type: "OUT" },
    });
    if (alreadyDispatched > 0) {
      await this.prisma.main.deliveryNote.update({
        where: { id },
        data: { status: "DIKIRIM" },
      });
      return this.get(id);
    }

    let dispatchedCount = 0;

    // 1. Proses Serial Number jika ada (gabungkan dto.serials & SN yang tersimpan di item surat jalan)
    const itemSerials = (row.items ?? [])
      .flatMap((it) => (it.serials ? it.serials.split(",") : []))
      .map((s) => s.trim())
      .filter(Boolean);
    const serialList = Array.from(
      new Set([
        ...(dto.serials ?? []).map((s) => s.trim()).filter(Boolean),
        ...itemSerials,
      ]),
    );
    const dispatchedSerialProductQty = new Map<number, number>();
    if (serialList.length > 0) {
      const units = await this.prisma.main.serialUnit.findMany({ where: { sn: { in: serialList } } });
      for (const u of units) {
        if ((u.status === "DI_GUDANG" || u.status === "RESERVED") && u.warehouseId) {
          await this.stock.applyMovement({
            date: row.date,
            type: "OUT",
            category: "KELUAR_SURAT_JALAN",
            productId: u.productId,
            fromWarehouseId: u.warehouseId,
            qty: 1,
            serialUnitId: u.id,
            deliveryNoteId: row.id,
            projectId: firstLocation?.projectId ?? null,
            reason: firstLocation ? `${firstLocation.destination} — ${firstLocation.reason}` : null,
            createdById: user.id,
          });
          await this.prisma.main.serialUnit.update({
            where: { id: u.id },
            data: { status: "DIKIRIM", warehouseId: null },
          });
          await this.prisma.main.stockReservation.updateMany({
            where: { serialUnitId: u.id, releasedAt: null },
            data: { releasedAt: new Date() },
          });
          await this.prisma.main.serialUnitHistory.create({
            data: {
              serialUnitId: u.id,
              status: "DIKIRIM",
              warehouseId: u.warehouseId,
              note: `Keluar dengan surat jalan ${row.number}`,
              changedById: user.id,
            },
          });
          dispatchedCount++;
          dispatchedSerialProductQty.set(u.productId, (dispatchedSerialProductQty.get(u.productId) ?? 0) + 1);
        }
      }
    }

    // 2. Proses Barang Curah & Sisa Barang Serial yang belum ter-scan SN spesifik
    const itemsToProcess = dto.items?.length ? dto.items : row.items;
    for (const item of itemsToProcess) {
      if (!item.productId) continue;
      const product = await this.prisma.main.product.findUnique({ where: { id: item.productId } });
      if (!product) continue;
      const alreadyForProd = dispatchedSerialProductQty.get(item.productId) ?? 0;
      const remainingQty = Math.max(0, Number(item.qty || 0) - alreadyForProd);
      if (remainingQty <= 0) continue;

      if (product.hasSerial) {
        const itemHasDeclaredSerials = Boolean(item.serials && String(item.serials).trim().length > 0);
        if (itemHasDeclaredSerials) {
          const autoUnits = await this.prisma.main.serialUnit.findMany({
            where: {
              productId: item.productId,
              status: { in: ["DI_GUDANG", "RESERVED"] },
              warehouseId: { not: null },
            },
            take: remainingQty,
          });
          for (const u of autoUnits) {
            if (!u.warehouseId) continue;
            await this.stock.applyMovement({
              date: row.date,
              type: "OUT",
              category: "KELUAR_SURAT_JALAN",
              productId: u.productId,
              fromWarehouseId: u.warehouseId,
              qty: 1,
              serialUnitId: u.id,
              deliveryNoteId: row.id,
              projectId: firstLocation?.projectId ?? null,
              reason: firstLocation ? `${firstLocation.destination} — ${firstLocation.reason}` : null,
              createdById: user.id,
            });
            await this.prisma.main.serialUnit.update({
              where: { id: u.id },
              data: { status: "DIKIRIM", warehouseId: null },
            });
            await this.prisma.main.stockReservation.updateMany({
              where: { serialUnitId: u.id, releasedAt: null },
              data: { releasedAt: new Date() },
            });
            await this.prisma.main.serialUnitHistory.create({
              data: {
                serialUnitId: u.id,
                status: "DIKIRIM",
                warehouseId: u.warehouseId,
                note: `Keluar dengan surat jalan ${row.number}`,
                changedById: user.id,
              },
            });
            dispatchedCount++;
          }
          const stillRemaining = remainingQty - autoUnits.length;
          if (stillRemaining <= 0) continue;
        }

        const balance =
          (await this.prisma.main.stockBalance.findFirst({
            where: { productId: item.productId, qty: { gte: remainingQty } },
          })) ??
          (await this.prisma.main.stockBalance.findFirst({
            where: { productId: item.productId, qty: { gt: 0 } },
          }));
        const warehouseId = balance?.warehouseId ?? defaultWarehouse?.id;
        if (warehouseId) {
          await this.stock.applyMovement({
            date: row.date,
            type: "OUT",
            category: "KELUAR_SURAT_JALAN",
            productId: item.productId,
            fromWarehouseId: warehouseId,
            qty: remainingQty,
            deliveryNoteId: row.id,
            projectId: firstLocation?.projectId ?? null,
            reason: firstLocation ? `${firstLocation.destination} — ${firstLocation.reason} (Barang SN belum scan)` : null,
            createdById: user.id,
          }).catch(() => {});
          dispatchedCount += remainingQty;
        }
        continue;
      }

      const balance =
        (await this.prisma.main.stockBalance.findFirst({
          where: { productId: item.productId, qty: { gte: remainingQty } },
        })) ??
        (await this.prisma.main.stockBalance.findFirst({
          where: { productId: item.productId, qty: { gt: 0 } },
        }));
      const warehouseId = balance?.warehouseId ?? defaultWarehouse?.id;
      if (warehouseId) {
        await this.stock.applyMovement({
          date: row.date,
          type: "OUT",
          category: "KELUAR_SURAT_JALAN",
          productId: item.productId,
          fromWarehouseId: warehouseId,
          qty: remainingQty,
          deliveryNoteId: row.id,
          projectId: firstLocation?.projectId ?? null,
          reason: firstLocation ? `${firstLocation.destination} — ${firstLocation.reason} (Barang curah)` : null,
          createdById: user.id,
        }).catch(() => {});
        dispatchedCount += remainingQty;
      }
    }

    await this.prisma.main.deliveryNote.update({
      where: { id },
      data: { status: "DIKIRIM" },
    });

    // Posting Akuntansi E7: Pengiriman Barang Surat Jalan -> Dr HPP Cr Persediaan (1200)
    try {
      let costTotal = 0;
      for (const it of (itemsToProcess || [])) {
        if (!it.productId) continue;
        const p = await this.prisma.main.product.findUnique({ where: { id: it.productId } });
        const avg = Number(p?.avgCost || p?.purchasePrice || 0);
        costTotal += (Number(it.qty || 0)) * avg;
      }
      if (costTotal > 0) {
        const mappings = await this.mappingService.getAll();
        const dLines = PostingRules.buildDeliveryLines(
          {
            number: row.number,
            costTotal,
            isProject: !!firstLocation?.projectId,
            projectId: firstLocation?.projectId,
          },
          mappings,
        );
        await this.postingService.post({
          sourceType: "DeliveryNote",
          sourceId: row.id,
          event: "shipped",
          source: "DELIVERY",
          date: row.date,
          memo: `HPP Pengiriman Barang SJ ${row.number}`,
          refNo: row.number,
          projectId: firstLocation?.projectId,
          createdById: user.id,
          lines: dLines,
        });
      }
    } catch (err) {
      console.error("Posting delivery error:", err);
    }

    await this.notifications.notify({
      userIds: [row.creatorId],
      kind: "SURAT",
      text: `${dispatchedCount} unit/item barang siap & diberangkatkan dengan surat jalan ${row.number}`,
      href: `/delivery-notes/${row.id}`,
    });
    await this.audit.log({
      actor: user,
      action: "SCAN_BARANG_SURAT_JALAN",
      entityType: "deliveryNote",
      entityId: row.id,
      detail: `${row.number}: ${dispatchedCount} barang diberangkatkan`,
    });
    return this.get(id);
  }

  async setStatus(id: number, dto: DeliveryStatusDto, user: RequestUser) {
    const row = await this.prisma.main.deliveryNote.findUnique({
      where: { id },
      include: { locations: true, items: true },
    });
    if (!row) throw new NotFoundException("Surat jalan tidak ditemukan");

    if (dto.scanFileId) {
      await this.prisma.main.deliveryNote.update({
        where: { id },
        data: { scanFileId: dto.scanFileId },
      });
      row.scanFileId = dto.scanFileId;
    }

    if (dto.status === "DITERIMA") {
      const hasProof = row.scanFileId || dto.scanFileId;
      if (!hasProof) {
        throw new BadRequestException("Bukti tanda terima / scan surat jalan bertanda tangan wajib dilampirkan sebelum status dapat diubah menjadi Diterima");
      }
    }

    if (dto.status === "DIKIRIM" && (row.withGoods || (row.items && row.items.length > 0))) {
      await this.prepareGoods(id, {}, user).catch(() => {});
    }

    if (dto.status === "DITERIMA") {
      const firstLocation = row.locations[0];
      if (firstLocation?.projectId) {
        const movements = await this.prisma.main.stockMovement.findMany({
          where: { deliveryNoteId: id, serialUnitId: { not: null } },
        });
        for (const m of movements) {
          if (m.serialUnitId) {
            await this.prisma.main.serialUnit.update({
              where: { id: m.serialUnitId },
              data: { status: "TERPASANG", projectId: firstLocation.projectId },
            });
            await this.prisma.main.serialUnitHistory.create({
              data: {
                serialUnitId: m.serialUnitId,
                status: "TERPASANG",
                projectId: firstLocation.projectId,
                note: `Diterima dan terpasang di lokasi proyek ${firstLocation.destination}`,
                changedById: user.id,
              },
            });
          }
        }
      }
    }

    if (dto.status === "DIBATALKAN") {
      await this.postingService.reverse("DeliveryNote", id, "shipped", dto.reason || "Surat jalan dibatalkan", user.id).catch(() => {});
    }

    const updated = await this.prisma.main.deliveryNote.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.status === "DITERIMA" ? { receiveById: user.id, receivedAt: new Date() } : {}),
      },
      include: { creator: { select: { name: true } } },
    });
    await this.audit.log({
      actor: user,
      action: "UBAH_STATUS_SURAT_JALAN",
      entityType: "deliveryNote",
      entityId: id,
      detail: `${row.number}: ${row.status} → ${dto.status}${dto.reason ? ` — ${dto.reason}` : ""}`,
    });
    if (row.creatorId !== user.id) {
      await this.notifications.notify({
        userIds: [row.creatorId],
        kind: "SURAT",
        text: `Surat jalan ${row.number}: ${row.status} → ${dto.status}${dto.reason ? ` (${dto.reason})` : ""}`,
        href: `/delivery-notes/${id}`,
      });
    }
    if (dto.status === "DITERIMA") {
      await this.notifications.notify({
        roles: ["GUDANG", "PM"],
        kind: "SURAT",
        text: `Surat jalan ${row.number} telah diterima di lokasi tujuan`,
        href: `/delivery-notes/${id}`,
      });
    }
    this.notifications.dataChange("delivery-notes", "status", updated.id);
    return updated;
  }

  /** Pembuat (atau Gudang/Admin) membatalkan surat jalan sendiri. */
  async cancel(id: number, reason: string, user: RequestUser) {
    const row = await this.prisma.main.deliveryNote.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Surat jalan tidak ditemukan");
    return this.setStatus(id, { status: "DIBATALKAN", reason: reason || "Dibatalkan" }, user);
  }

  async remove(id: number, user: RequestUser) {
    const row = await this.prisma.main.deliveryNote.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Surat jalan tidak ditemukan");
    await this.prisma.main.$transaction(async (tx) => {
      await tx.approval.deleteMany({ where: { kind: "SURAT_JALAN", entityId: id } });
      await tx.deliveryNoteLocation.deleteMany({ where: { deliveryNoteId: id } });
      await tx.deliveryNoteItem.deleteMany({ where: { deliveryNoteId: id } });
      await tx.deliveryNote.delete({ where: { id } });
    });
    await this.audit.log({
      actor: user,
      action: "HAPUS_SURAT_JALAN",
      entityType: "deliveryNote",
      entityId: id,
      detail: `${row.number} dihapus`,
    });
    this.notifications.dataChange("delivery-notes", "delete", id);
    return { id, deleted: true };
  }

  /** Laporan hasil setelah selesai (pembuat wajib mengisi). */
  async report(id: number, dto: DeliveryReportDto, user: RequestUser) {
    const row = await this.prisma.main.deliveryNote.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Surat jalan tidak ditemukan");
    const allowed =
      row.creatorId === user.id ||
      user.role === "SUPER_ADMIN" ||
      user.role === "ADMIN" ||
      can(user.role, "delivery", "U");
    if (!allowed) throw new ForbiddenException("Hanya pembuat, Gudang, atau Admin yang dapat mengisi laporan");

    const updated = await this.prisma.main.deliveryNote.update({
      where: { id },
      data: { reportText: dto.reportText, reportFileId: dto.reportFileId ?? null, reportAt: new Date() },
    });
    await this.audit.log({
      actor: user,
      action: "LAPORAN_SURAT_JALAN",
      entityType: "deliveryNote",
      entityId: id,
      detail: `${row.number} — laporan hasil diisi`,
    });
    await this.notifications.notify({
      roles: ["FINANCE", "BOS"],
      kind: "SURAT",
      text: `Laporan hasil surat jalan ${row.number} oleh ${user.name}`,
      href: `/delivery-notes/${id}`,
    });
    this.notifications.dataChange("delivery-notes", "update", updated.id);
    return updated;
  }

  private company = async (): Promise<string> => {
    try {
      const profile = await this.settings.getCompanyProfile();
      if (profile?.name) return profile.name;
      return await this.settings.getValue("nama.perusahaan");
    } catch {
      return "Taska";
    }
  };

  /** PDF surat jalan (dicetak, ditandatangani, discan ulang). */
  async toPdf(id: number) {
    const row = await this.get(id);
    const company = await this.company();
    const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString("id-ID") : "-");
    const locations = row.locations.map((l, i) => [
      String(i + 1),
      l.destination,
      l.reason,
      l.project?.name ?? "-",
    ]);
    const goods = row.movements
      .filter((m) => m.serialUnit)
      .map((m, i) => [String(i + 1), m.serialUnit!.sn, m.product.name, m.fromWarehouse?.name ?? "-"]);

    return {
      company,
      number: row.number,
      date: fmt(new Date(row.date)),
      status: row.status,
      creator: row.creator.name,
      withGoods: row.withGoods,
      locations,
      goods,
      reportText: row.reportText ?? "",
      approval: row.approval?.status ?? "-",
    };
  }
}
