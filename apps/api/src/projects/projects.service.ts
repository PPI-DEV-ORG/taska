import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { ReservationsService } from "../stock/reservations.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip } from "../common/utils/query.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import type { Project } from "../generated/prisma/client.js";
import { AssignDto, MemberDto, ProjectDto, ProjectListQuery, ProjectStatusDto, RequirementDto } from "./dto.js";

const MANAGER_ROLES = ["PM", "ADMIN", "BOS"];
const MEMBER_ROLES = ["PM", "SE", "TEKNISI"];

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly reservations: ReservationsService,
  ) {}

  private async access(project: Project, user: RequestUser, forWrite = false) {
    const allowed =
      MANAGER_ROLES.includes(user.role) ||
      project.picId === user.id ||
      (await this.prisma.main.projectMember.findUnique({
        where: { projectId_userId: { projectId: project.id, userId: user.id } },
      })) !== null;
    if (!allowed) throw new ForbiddenException("Anda tidak punya akses ke project ini");
    if (forWrite && !MANAGER_ROLES.includes(user.role) && project.picId !== user.id) {
      throw new ForbiddenException("Hanya PIC project, PM, Admin, atau Bos yang boleh mengubahnya");
    }
  }

  private async syncPayment(projectId: number): Promise<Project> {
    const invoices = await this.prisma.main.invoiceOut.findMany({
      where: { projectId, status: { not: "BATAL" } },
      select: { total: true, paidAmount: true, status: true },
    });
    const allPaid =
      invoices.length > 0 && invoices.every((i) => Number(i.paidAmount) >= Number(i.total) && Number(i.total) > 0);
    const current = await this.prisma.main.project.findUniqueOrThrow({ where: { id: projectId } });
    if ((allPaid ? "LUNAS" : "BELUM_LUNAS") === current.paymentStatus) return current;
    return this.prisma.main.project.update({
      where: { id: projectId },
      data: { paymentStatus: allPaid ? "LUNAS" : "BELUM_LUNAS" },
    });
  }

  /** Rerata progres task (PRD: PM memantau progres). */
  async recomputeProgress(projectId: number): Promise<Project> {
    const tasks = await this.prisma.main.task.findMany({ where: { projectId }, select: { progress: true } });
    const progress = tasks.length
      ? Math.round(tasks.reduce((s, t) => s + t.progress, 0) / tasks.length)
      : 0;
    const current = await this.prisma.main.project.findUniqueOrThrow({ where: { id: projectId } });
    if (current.progress === progress) return current;
    return this.prisma.main.project.update({ where: { id: projectId }, data: { progress } });
  }

  async list(q: ProjectListQuery, user: RequestUser) {
    const scope = ["ADMIN", "BOS"].includes(user.role)
      ? {}
      : user.role === "PM"
        ? { OR: [{ picId: user.id }, { members: { some: { userId: user.id } } }] }
        : { OR: [{ picId: user.id }, { members: { some: { userId: user.id } } }] };
    const where = {
      ...scope,
      ...(q.status ? { status: q.status } : {}),
      ...(q.type ? { type: q.type } : {}),
      ...(q.picId ? { picId: q.picId } : {}),
      ...(q.customerId ? { customerId: q.customerId } : {}),
      ...(q.memberId ? { members: { some: { userId: q.memberId } } } : {}),
      ...(q.paymentStatus ? { paymentStatus: q.paymentStatus } : {}),
      ...(q.q
        ? { OR: [{ name: { contains: q.q } }, { customer: { name: { contains: q.q } } }, { notes: { contains: q.q } }] }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.main.project.findMany({
        where,
        include: {
          pic: { select: { id: true, name: true, role: true } },
          customer: { select: { id: true, name: true } },
          quotation: { select: { id: true, number: true, status: true } },
          _count: { select: { members: true, tasks: true } },
        },
        orderBy: orderBy(q.sort, q.dir, ["startDate", "endDate", "createdAt"], "startDate"),
        ...pageSkip(q),
      }),
      this.prisma.main.project.count({ where }),
    ]);
    const rows = await Promise.all(items.map((r) => this.syncPayment(r.id)));
    const statusById = new Map(rows.map((r) => [r.id, r.paymentStatus]));
    return paginate(
      items.map((r) => ({ ...r, paymentStatus: statusById.get(r.id) ?? r.paymentStatus })),
      total,
      q,
    );
  }

  async get(id: number, user: RequestUser) {
    const project = await this.prisma.main.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException("Project tidak ditemukan");
    await this.access(project, user);
    const synced = await this.syncPayment(id);
    const [row, prdFile] = await Promise.all([
      this.prisma.main.project.findUnique({
        where: { id },
        include: {
          pic: { select: { id: true, name: true, role: true } },
          customer: { select: { id: true, name: true } },
          quotation: { select: { id: true, number: true, status: true, grandTotal: true } },
          members: { include: { user: { select: { id: true, name: true, role: true } } } },
          requirements: {
            include: { product: { select: { id: true, sku: true, name: true, unit: true } } },
            orderBy: { id: "asc" as const },
          },
          tasks: {
            where: { parentId: null },
            include: {
              assignee: { select: { id: true, name: true } },
              children: { include: { assignee: { select: { id: true, name: true } } } },
            },
            orderBy: { id: "asc" as const },
          },
          invoices: { select: { id: true, number: true, total: true, paidAmount: true, status: true, dueDate: true } },
          _count: { select: { members: true, tasks: true, purchaseRequests: true } },
        },
      }),
      project.prdFileId
        ? this.prisma.main.file.findUnique({ where: { id: project.prdFileId } })
        : Promise.resolve(null),
    ]);
    if (!row) throw new NotFoundException("Project tidak ditemukan");
    return { ...row, paymentStatus: synced.paymentStatus, prdFile };
  }

  async create(dto: ProjectDto, user: RequestUser) {
    const type = dto.type ?? "CUSTOMER";
    const picId = dto.picId ?? user.id;
    const pic = await this.prisma.main.user.findUnique({ where: { id: picId } });
    if (!pic) throw new NotFoundException("PIC tidak ditemukan");
    if (!["PM", "ADMIN"].includes(pic.role)) {
      throw new BadRequestException("PIC project harus berrole PM atau Admin");
    }
    if (type === "CUSTOMER" && !dto.customerId) {
      throw new BadRequestException("Project tipe customer wajib punya customer");
    }
    if (dto.customerId) {
      const customer = await this.prisma.main.customer.findUnique({ where: { id: dto.customerId } });
      if (!customer) throw new NotFoundException("Customer tidak ditemukan");
    }
    if (dto.quotationId) {
      await this.assertFromWonWithPayment(dto.quotationId);
    }
    const memberIds = dto.memberIds ?? [];
    await this.assertMembers(memberIds);

    const project = await this.prisma.main.project.create({
      data: {
        name: dto.name,
        type,
        customerId: dto.customerId,
        picId,
        quotationId: dto.quotationId,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        status: dto.status ?? "BERJALAN",
        progress: dto.progress ?? 0,
        prdFileId: dto.prdFileId,
        notes: dto.notes,
        members: { create: memberIds.map((userId) => ({ userId })) },
      },
      include: {
        pic: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        members: { include: { user: { select: { id: true, name: true, role: true } } } },
      },
    });
    if (dto.prdFileId) await this.attachFile(dto.prdFileId, "project", project.id);

    await this.audit.log({
      actor: user,
      action: "BUAT_PROJECT",
      entityType: "project",
      entityId: project.id,
      detail: `${project.name} (${type}) — PIC ${pic.name}`,
    });
    const targets = [...new Set([picId, ...memberIds])].filter((id) => id !== user.id);
    if (targets.length) {
      await this.notifications.notify({
        userIds: targets,
        kind: "TUGAS",
        text: `Project baru: ${project.name}`,
        href: `/projects/${project.id}`,
      });
    }
    return project;
  }

  /** PRD: project dari lead Won hanya setelah pembayaran pertama diterima. */
  private async assertFromWonWithPayment(quotationId: number) {
    const quotation = await this.prisma.main.quotation.findUnique({
      where: { id: quotationId },
      include: { lead: { select: { stage: true, name: true } } },
    });
    if (!quotation) throw new NotFoundException("Penawaran tidak ditemukan");
    if (quotation.lead.stage !== "WON") {
      throw new BadRequestException("Project dari penawaran hanya bisa dibuat setelah lead Won");
    }
    const paid = await this.prisma.main.invoiceOut.findFirst({
      where: { clientPo: { quotationId }, paidAmount: { gt: 0 } },
      select: { id: true },
    });
    if (!paid) {
      throw new BadRequestException("Project dibuat setelah pembayaran pertama (DP/termin) diterima");
    }
  }

  private async assertMembers(userIds: number[]) {
    if (!userIds.length) return;
    const users = await this.prisma.main.user.findMany({ where: { id: { in: userIds } } });
    if (users.length !== userIds.length) throw new NotFoundException("Ada anggota tim yang tidak ditemukan");
    const invalid = users.filter((u) => !MEMBER_ROLES.includes(u.role));
    if (invalid.length) {
      throw new BadRequestException(`Anggota project harus PM, SE, atau Teknisi (${invalid.map((u) => u.name).join(", ")})`);
    }
  }

  async update(id: number, dto: ProjectDto, user: RequestUser) {
    const project = await this.prisma.main.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException("Project tidak ditemukan");
    await this.access(project, user, true);

    if (dto.quotationId !== undefined && dto.quotationId !== project.quotationId) {
      await this.assertFromWonWithPayment(dto.quotationId);
    }
    const type = dto.type ?? project.type;
    if (type === "CUSTOMER" && !(dto.customerId ?? project.customerId)) {
      throw new BadRequestException("Project tipe customer wajib punya customer");
    }
    if (dto.picId !== undefined && dto.picId !== project.picId) {
      const pic = await this.prisma.main.user.findUnique({ where: { id: dto.picId } });
      if (!pic) throw new NotFoundException("PIC tidak ditemukan");
      if (!["PM", "ADMIN"].includes(pic.role)) throw new BadRequestException("PIC project harus berrole PM atau Admin");
    }
    if (dto.memberIds) await this.assertMembers(dto.memberIds);

    const updated = await this.prisma.main.project.update({
      where: { id },
      data: {
        name: dto.name,
        type,
        customerId: dto.customerId ?? project.customerId,
        picId: dto.picId ?? project.picId,
        quotationId: dto.quotationId ?? project.quotationId,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.progress !== undefined ? { progress: dto.progress } : {}),
        prdFileId: dto.prdFileId ?? project.prdFileId,
        notes: dto.notes ?? project.notes,
        ...(dto.memberIds
          ? { members: { deleteMany: {}, create: dto.memberIds.map((userId) => ({ userId })) } }
          : {}),
      },
      include: {
        pic: { select: { id: true, name: true } },
        members: { include: { user: { select: { id: true, name: true, role: true } } } },
      },
    });
    if (dto.prdFileId) await this.attachFile(dto.prdFileId, "project", id);

    await this.audit.log({
      actor: user,
      action: "UBAH_PROJECT",
      entityType: "project",
      entityId: id,
      detail: `${updated.name}${dto.status && dto.status !== project.status ? ` — status ${project.status} → ${dto.status}` : ""}`,
    });
    if (dto.memberIds && dto.memberIds.length) {
      const targets = dto.memberIds.filter((uid) => uid !== user.id);
      if (targets.length) {
        await this.notifications.notify({
          userIds: targets,
          kind: "TUGAS",
          text: `Anda ditugaskan di project: ${updated.name}`,
          href: `/projects/${id}`,
        });
      }
    }
    return updated;
  }

  /** PRD #2 (status manual) + #1 (penutupan wajib file bukti). */
  async setStatus(id: number, dto: ProjectStatusDto, user: RequestUser) {
    const project = await this.prisma.main.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException("Project tidak ditemukan");
    await this.access(project, user, true);

    let warning: string | undefined;
    if (dto.status === "SELESAI" && !project.prdFileId) {
      throw new BadRequestException("Penutupan project wajib mengunggah dokumen pendukung (PRD/BAST)");
    }
    const synced = await this.syncPayment(id);
    if (dto.status === "SELESAI" && synced.paymentStatus !== "LUNAS") {
      warning = "Project ditutup namun pembayaran belum lunas";
    }

    const updated = await this.prisma.main.project.update({
      where: { id },
      data: {
        status: dto.status,
        completedAt: dto.status === "SELESAI" ? new Date() : null,
        ...(dto.note ? { notes: dto.note } : {}),
      },
      include: { pic: { select: { id: true, name: true } } },
    });
    await this.audit.log({
      actor: user,
      action: "UBAH_STATUS_PROJECT",
      entityType: "project",
      entityId: id,
      detail: `${project.name}: ${project.status} → ${dto.status}${dto.note ? ` — ${dto.note}` : ""}`,
    });
    if (dto.status === "SELESAI" && project.status !== "SELESAI") {
      await this.reservations.releaseForProject(id);
    }
    if (dto.status !== project.status && project.picId !== user.id) {
      await this.notifications.notify({
        userIds: [project.picId],
        kind: "TUGAS",
        text: `Status project ${project.name}: ${project.status} → ${dto.status}`,
        href: `/projects/${id}`,
      });
    }
    return { ...updated, ...(warning ? { warning } : {}) };
  }

  /** PRD #17: Admin memindahkan project ke orang lain. */
  async reassign(id: number, dto: AssignDto, user: RequestUser) {
    if (!["ADMIN", "BOS"].includes(user.role)) {
      throw new ForbiddenException("Hanya Admin atau Bos yang boleh memindahkan project");
    }
    const project = await this.prisma.main.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException("Project tidak ditemukan");
    const target = await this.prisma.main.user.findUnique({ where: { id: dto.userId } });
    if (!target) throw new NotFoundException("Tujuan pemindahan tidak ditemukan");
    if (!["PM", "ADMIN"].includes(target.role)) throw new BadRequestException("PIC project harus berrole PM atau Admin");

    const updated = await this.prisma.main.project.update({
      where: { id },
      data: { picId: dto.userId },
      include: { pic: { select: { id: true, name: true } } },
    });
    await this.audit.log({
      actor: user,
      action: "REASSIGN_PROJECT",
      entityType: "project",
      entityId: id,
      detail: `${project.name}: → ${target.name}`,
    });
    await this.notifications.notify({
      userIds: [dto.userId],
      kind: "TUGAS",
      text: `Project dipindahkan ke Anda: ${project.name}`,
      href: `/projects/${id}`,
    });
    return updated;
  }

  async addMember(projectId: number, dto: MemberDto, user: RequestUser) {
    const project = await this.prisma.main.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException("Project tidak ditemukan");
    await this.access(project, user, true);
    await this.assertMembers([dto.userId]);
    await this.prisma.main.projectMember.upsert({
      where: { projectId_userId: { projectId, userId: dto.userId } },
      create: { projectId, userId: dto.userId },
      update: {},
    });
    await this.audit.log({
      actor: user,
      action: "TAMBAH_ANGGOTA_PROJECT",
      entityType: "project",
      entityId: projectId,
      detail: `user #${dto.userId}`,
    });
    if (dto.userId !== user.id) {
      await this.notifications.notify({
        userIds: [dto.userId],
        kind: "TUGAS",
        text: `Anda ditugaskan di project: ${project.name}`,
        href: `/projects/${projectId}`,
      });
    }
    return { projectId, userId: dto.userId, added: true };
  }

  async removeMember(projectId: number, userId: number, user: RequestUser) {
    const project = await this.prisma.main.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException("Project tidak ditemukan");
    await this.access(project, user, true);
    await this.prisma.main.projectMember.deleteMany({ where: { projectId, userId } });
    await this.audit.log({
      actor: user,
      action: "HAPUS_ANGGOTA_PROJECT",
      entityType: "project",
      entityId: projectId,
      detail: `user #${userId}`,
    });
    return { projectId, userId, removed: true };
  }

  // ── Kebutuhan barang (PRD: PM isi, sistem cek stok & auto-reserve) ──

  async listRequirements(projectId: number, user: RequestUser) {
    const project = await this.prisma.main.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException("Project tidak ditemukan");
    await this.access(project, user);
    return this.prisma.main.projectRequirement.findMany({
      where: { projectId },
      include: { product: { select: { id: true, sku: true, name: true, unit: true, hasSerial: true } } },
      orderBy: { id: "asc" },
    });
  }

  /** Ketersediaan = saldo gudang − reserve aktif proyek lain. */
  private async availableQty(productId: number, excludeProjectId: number) {
    const [balance, reserved] = await Promise.all([
      this.prisma.main.stockBalance.aggregate({ where: { productId }, _sum: { qty: true } }),
      this.prisma.main.stockReservation.aggregate({
        where: { productId, releasedAt: null, NOT: { projectId: excludeProjectId } },
        _sum: { qty: true },
      }),
    ]);
    return Math.max(0, (balance._sum.qty ?? 0) - (reserved._sum.qty ?? 0));
  }

  private async reserveFor(projectId: number, requirementId: number, productId: number, qty: number) {
    await this.prisma.main.stockReservation.updateMany({
      where: { requirementId, releasedAt: null },
      data: { releasedAt: new Date() },
    });
    const available = await this.availableQty(productId, projectId);
    const reserveQty = Math.min(available, qty);
    if (reserveQty > 0) {
      await this.prisma.main.stockReservation.create({
        data: { projectId, productId, qty: reserveQty, requirementId },
      });
    }
    const status = reserveQty >= qty ? "DIRESERVE" : reserveQty > 0 ? "DIRESERVE" : "DIBUTUHKAN";
    await this.prisma.main.projectRequirement.update({
      where: { id: requirementId },
      data: { reservedQty: reserveQty, status: status as never },
    });
    return { reservedQty: reserveQty, shortage: qty - reserveQty };
  }

  async addRequirement(projectId: number, dto: RequirementDto, user: RequestUser) {
    const project = await this.prisma.main.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException("Project tidak ditemukan");
    await this.access(project, user, true);
    const product = await this.prisma.main.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException("Barang tidak ditemukan");
    if (dto.taskId) {
      const task = await this.prisma.main.task.findUnique({ where: { id: dto.taskId } });
      if (!task || task.projectId !== projectId) throw new BadRequestException("Task bukan milik project ini");
    }

    const row = await this.prisma.main.projectRequirement.create({
      data: { projectId, taskId: dto.taskId, productId: dto.productId, qty: dto.qty },
    });
    const reserved = await this.reserveFor(projectId, row.id, dto.productId, dto.qty);
    const created = await this.prisma.main.projectRequirement.findUnique({
      where: { id: row.id },
      include: { product: { select: { id: true, sku: true, name: true, unit: true } } },
    });

    await this.audit.log({
      actor: user,
      action: "TAMBAH_KEBUTUHAN_BARANG",
      entityType: "project-requirement",
      entityId: row.id,
      detail: `${product.name} x${dto.qty} — reserve ${reserved.reservedQty}, kurang ${reserved.shortage}`,
    });
    if (reserved.shortage > 0) {
      await this.notifications.notify({
        roles: ["PROCUREMENT"],
        kind: "STOK",
        text: `Kekurangan barang untuk ${project.name}: ${product.name} (${reserved.shortage} ${product.unit})`,
        href: `/projects/${projectId}`,
      });
    }
    return { ...created, ...reserved };
  }

  async updateRequirement(projectId: number, id: number, dto: RequirementDto, user: RequestUser) {
    const project = await this.prisma.main.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException("Project tidak ditemukan");
    await this.access(project, user, true);
    const row = await this.prisma.main.projectRequirement.findUnique({ where: { id } });
    if (!row || row.projectId !== projectId) throw new NotFoundException("Kebutuhan tidak ditemukan");

    const updated = await this.prisma.main.projectRequirement.update({
      where: { id },
      data: { qty: dto.qty, productId: dto.productId, taskId: dto.taskId ?? row.taskId },
    });
    const reserved = await this.reserveFor(projectId, id, updated.productId, updated.qty);
    const current = await this.prisma.main.projectRequirement.findUnique({
      where: { id },
      include: { product: { select: { id: true, sku: true, name: true, unit: true } } },
    });
    await this.audit.log({
      actor: user,
      action: "UBAH_KEBUTUHAN_BARANG",
      entityType: "project-requirement",
      entityId: id,
      detail: `qty → ${updated.qty}`,
    });
    return { ...current, ...reserved };
  }

  async removeRequirement(projectId: number, id: number, user: RequestUser) {
    const project = await this.prisma.main.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException("Project tidak ditemukan");
    await this.access(project, user, true);
    const row = await this.prisma.main.projectRequirement.findUnique({ where: { id } });
    if (!row || row.projectId !== projectId) throw new NotFoundException("Kebutuhan tidak ditemukan");

    await this.prisma.main.$transaction([
      this.prisma.main.stockReservation.updateMany({
        where: { requirementId: id, releasedAt: null },
        data: { releasedAt: new Date() },
      }),
      this.prisma.main.projectRequirement.delete({ where: { id } }),
    ]);
    await this.audit.log({
      actor: user,
      action: "HAPUS_KEBUTUHAN_BARANG",
      entityType: "project-requirement",
      entityId: id,
      detail: `project #${projectId}`,
    });
    return { id, deleted: true };
  }

  private async attachFile(fileId: number, refType: string, refId: number) {
    await this.prisma.main.file.update({
      where: { id: fileId },
      data: { refType, refId: String(refId) },
    });
  }
}
