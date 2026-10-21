import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { ApprovalsService } from "../approvals/approvals.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { AuditService } from "../audit/audit.service.js";
import { StockService } from "../stock/stock.service.js";
import { DocumentNumberService } from "../document-number/document-number.service.js";
import { SettingsService } from "../settings/settings.service.js";
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
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvals: ApprovalsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly stock: StockService,
    private readonly docnum: DocumentNumberService,
    private readonly settings: SettingsService,
  ) {
    this.approvals.onChange("SURAT_JALAN", (entityId, status) => this.onApproval(entityId, status));
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

    const number =
      dto.number?.trim() ||
      (await this.docnum.next("suratJalan", date));
    if (dto.number?.trim()) {
      await this.docnum.assertUnique(number, async (v) =>
        Boolean(await this.prisma.main.deliveryNote.findUnique({ where: { number: v } })),
      );
    }

    const scanFileId = dto.scanFileId ?? dto.fileId;
    const row = await this.prisma.main.deliveryNote.create({
      data: {
        number,
        creatorId: user.id,
        withGoods,
        date,
        status: dto.status ?? "PENDING",
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
    const row = await this.prisma.main.deliveryNote.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Surat jalan tidak ditemukan");

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

    if (dto.scanFileId || dto.fileId) {
      const fid = dto.scanFileId ?? dto.fileId;
      await this.prisma.main.file.update({
        where: { id: Number(fid) },
        data: { refType: "delivery-note", refId: String(id), kind: "FOTO" },
      }).catch(() => {});
    }
    if (dto.reportFileId) {
      await this.prisma.main.file.update({
        where: { id: Number(dto.reportFileId) },
        data: { refType: "delivery-note-report", refId: String(id), kind: "DOKUMEN" },
      }).catch(() => {});
    }

    this.notifications.dataChange("delivery-notes", "update", updated.id);
    return this.get(id);
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
    return { ...row, approval: await this.approvals.getFor("SURAT_JALAN", id) };
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
    const defaultWarehouse =
      (await this.prisma.main.warehouse.findFirst({ where: { status: "AKTIF" } })) ??
      (await this.prisma.main.warehouse.findFirst());

    let dispatchedCount = 0;

    // 1. Proses Serial Number jika ada
    const serialList = dto.serials ?? [];
    if (serialList.length > 0) {
      const units = await this.prisma.main.serialUnit.findMany({ where: { sn: { in: serialList } } });
      if (units.length !== serialList.length) throw new BadRequestException("Ada serial number yang tidak ditemukan");

      for (const u of units) {
        if (u.status !== "DI_GUDANG") {
          throw new BadRequestException(`Serial ${u.sn} status ${u.status} — harus DI_GUDANG untuk keluar`);
        }
        if (!u.warehouseId) throw new BadRequestException(`Serial ${u.sn} tidak tercatat di gudang mana pun`);
      }

      for (const u of units) {
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
    }

    // 2. Proses Barang Curah / Non-Serial
    const itemsToProcess = dto.items?.length ? dto.items : row.items;
    for (const item of itemsToProcess) {
      const product = await this.prisma.main.product.findUnique({ where: { id: item.productId } });
      if (!product || product.hasSerial) continue; // Barang serial sudah diproses via serialList
      const balance =
        (await this.prisma.main.stockBalance.findFirst({
          where: { productId: item.productId, qty: { gte: item.qty } },
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
          qty: item.qty,
          deliveryNoteId: row.id,
          projectId: firstLocation?.projectId ?? null,
          reason: firstLocation ? `${firstLocation.destination} — ${firstLocation.reason} (Barang curah)` : null,
          createdById: user.id,
        });
        dispatchedCount += item.qty;
      }
    }

    await this.prisma.main.deliveryNote.update({
      where: { id },
      data: { status: "DIKIRIM" },
    });

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
      include: { locations: true },
    });
    if (!row) throw new NotFoundException("Surat jalan tidak ditemukan");

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
