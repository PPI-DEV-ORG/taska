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
    if (!dto.locations.length) throw new BadRequestException("Minimal satu tujuan lokasi");
    for (const l of dto.locations) {
      if (l.projectId) {
        const p = await this.prisma.main.project.findUnique({ where: { id: l.projectId } });
        if (!p) throw new NotFoundException(`Project #${l.projectId} tidak ditemukan`);
      }
    }
    const withGoods = dto.withGoods === true || dto.withGoods === "true";

    const number =
      dto.number?.trim() ||
      (await this.docnum.next("suratJalan", new Date(dto.date)));
    if (dto.number?.trim()) {
      await this.docnum.assertUnique(number, async (v) =>
        Boolean(await this.prisma.main.deliveryNote.findUnique({ where: { number: v } })),
      );
    }

    const row = await this.prisma.main.deliveryNote.create({
      data: {
        number,
        creatorId: user.id,
        withGoods,
        date: new Date(dto.date),
        locations: {
          create: dto.locations.map((l) => ({
            destination: l.destination,
            reason: l.reason,
            projectId: l.projectId ?? null,
          })),
        },
      },
      include: { locations: true },
    });

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
        text: `Surat jalan ${number} — barang siap discan untuk ${dto.locations[0].destination}`,
        href: `/delivery-notes/${row.id}`,
      });
    }
    return row;
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
    if (approval?.status !== "DISETUJUI") {
      throw new BadRequestException("Surat jalan belum disetujui Finance/Bos");
    }
  }

  /** Scan SN barang yang dibawa — wajib sebelum berangkat (PRD surat jalan). */
  async prepareGoods(id: number, dto: GoodsDto, user: RequestUser) {
    const row = await this.prisma.main.deliveryNote.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Surat jalan tidak ditemukan");
    if (!row.withGoods) throw new BadRequestException("Surat jalan ini tidak membawa barang");
    if (row.status !== "PENDING") throw new BadRequestException("Surat jalan sudah berangkat/ditutup");
    await this.assertApproved(id);
    if (!dto.serials.length) throw new BadRequestException("Isi minimal satu serial number");

    const units = await this.prisma.main.serialUnit.findMany({ where: { sn: { in: dto.serials } } });
    if (units.length !== dto.serials.length) throw new BadRequestException("Ada serial number yang tidak ditemukan");
    const firstLocation = await this.prisma.main.deliveryNoteLocation.findFirst({
      where: { deliveryNoteId: id },
      orderBy: { id: "asc" },
    });

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
    }

    await this.notifications.notify({
      userIds: [row.creatorId],
      kind: "SURAT",
      text: `${dto.serials.length} unit discan keluar untuk surat jalan ${row.number}`,
      href: `/delivery-notes/${row.id}`,
    });
    await this.audit.log({
      actor: user,
      action: "SCAN_BARANG_SURAT_JALAN",
      entityType: "deliveryNote",
      entityId: row.id,
      detail: `${row.number}: ${dto.serials.join(", ")}`,
    });
    return this.get(id);
  }

  async setStatus(id: number, dto: DeliveryStatusDto, user: RequestUser) {
    const row = await this.prisma.main.deliveryNote.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Surat jalan tidak ditemukan");
    if (row.status === "DIBATALKAN") throw new BadRequestException("Surat jalan sudah dibatalkan");
    if (dto.status === "DIBATALKAN" && !dto.reason) {
      throw new BadRequestException("Pembatalan wajib beralasan");
    }
    if (dto.status === "DIKIRIM") {
      await this.assertApproved(id);
      if (row.withGoods) {
        const goods = await this.prisma.main.stockMovement.count({ where: { deliveryNoteId: id } });
        if (!goods) throw new BadRequestException("Surat jalan ber-SN: scan barang dulu sebelum berangkat");
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
    return updated;
  }

  /** Pembuat (atau Gudang/Admin) membatalkan surat jalan sendiri. */
  async cancel(id: number, reason: string, user: RequestUser) {
    const row = await this.prisma.main.deliveryNote.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Surat jalan tidak ditemukan");
    const allowed =
      row.creatorId === user.id ||
      user.role === "ADMIN" ||
      can(user.role, "delivery", "U");
    if (!allowed) throw new ForbiddenException("Hanya pembuat, Gudang, atau Admin yang dapat membatalkan");
    if (row.status !== "PENDING") throw new BadRequestException("Hanya surat jalan PENDING yang bisa dibatalkan");
    return this.setStatus(id, { status: "DIBATALKAN", reason }, user);
  }

  /** Laporan hasil setelah selesai (pembuat wajib mengisi). */
  async report(id: number, dto: DeliveryReportDto, user: RequestUser) {
    const row = await this.prisma.main.deliveryNote.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Surat jalan tidak ditemukan");
    const allowed =
      row.creatorId === user.id ||
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
