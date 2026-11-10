import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { ReservationsService } from "../stock/reservations.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip } from "../common/utils/query.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import type { Project } from "../generated/prisma/client.js";
import { AssignDto, GenerateBastDto, MemberDto, ProjectDto, ProjectListQuery, ProjectStatusDto, RequirementDto, ReturnMaterialsDto } from "./dto.js";
import { StockService } from "../stock/stock.service.js";
import { UploadService } from "../upload/upload.service.js";
import { renderPdf } from "../common/pdf.js";

const MANAGER_ROLES = ["PM", "ADMIN", "BOS", "SUPER_ADMIN"];
const MEMBER_ROLES = ["PM", "SE", "TEKNISI", "SUPER_ADMIN"];

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly reservations: ReservationsService,
    private readonly stock: StockService,
    private readonly upload: UploadService,
  ) {}

  private async access(project: Project, user: RequestUser, forWrite = false) {
    const allowed =
      MANAGER_ROLES.includes(user.role) ||
      ["FINANCE", "SALES", "PROCUREMENT", "GUDANG", "TEKNISI", "SE"].includes(user.role) ||
      project.picId === user.id ||
      (await this.prisma.main.projectMember.findUnique({
        where: { projectId_userId: { projectId: project.id, userId: user.id } },
      })) !== null;
    if (!allowed) throw new ForbiddenException("Anda tidak punya akses ke project ini");
    if (forWrite && !MANAGER_ROLES.includes(user.role) && project.picId !== user.id) {
      throw new ForbiddenException("Hanya PIC project, PM, Admin, atau Bos yang boleh mengubahnya");
    }
  }

  async linkProjectInvoices(projectId: number) {
    const project = await this.prisma.main.project.findUnique({
      where: { id: projectId },
      include: {
        quotation: {
          include: {
            clientPOs: { select: { id: true } },
            lead: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!project) return;

    let quotation = project.quotation;
    if (!quotation && project.customerId) {
      const cleanName = project.name.replace(/^Project\s+/i, "").trim();
      const quoteFilters: any[] = [{ customerId: project.customerId }];

      if (cleanName) {
        quoteFilters.push(
          { lead: { name: { contains: cleanName } } },
          { number: { contains: cleanName } },
        );
      }

      const q = await this.prisma.main.quotation.findFirst({
        where: { OR: quoteFilters },
        include: {
          clientPOs: { select: { id: true } },
          lead: { select: { id: true, name: true } },
        },
        orderBy: { id: "desc" },
      });

      if (q) {
        quotation = q;
        await this.prisma.main.project
          .update({
            where: { id: projectId },
            data: { quotationId: q.id },
          })
          .catch(() => {});
      }
    }

    const orConditions: any[] = [];
    if (quotation) {
      if (quotation.clientPOs?.length) {
        orConditions.push({ clientPoId: { in: quotation.clientPOs.map((p) => p.id) } });
      }
      if (quotation.leadId) {
        orConditions.push({ description: { contains: `[lead:${quotation.leadId}]` } });
      }
      if (quotation.number) {
        orConditions.push({ description: { contains: quotation.number } });
      }
    }

    const cleanProjName = project.name.replace(/^Project\s+/i, "").trim();
    if (cleanProjName) {
      orConditions.push({ description: { contains: cleanProjName } });
    }
    if (project.customerId && cleanProjName) {
      orConditions.push({
        customerId: project.customerId,
        description: { contains: cleanProjName },
      });
    }

    if (orConditions.length) {
      await this.prisma.main.invoiceOut
        .updateMany({
          where: {
            projectId: null,
            OR: orConditions,
          },
          data: { projectId },
        })
        .catch(() => {});
    }
  }

  private async syncPayment(projectId: number): Promise<Project> {
    await this.linkProjectInvoices(projectId);

    const invoices = await this.prisma.main.invoiceOut.findMany({
      where: { projectId, status: { not: "BATAL" } },
      select: { total: true, paidAmount: true, status: true },
    });
    const allPaid =
      invoices.length > 0 &&
      invoices.every(
        (i) => (Number(i.paidAmount) >= Number(i.total) && Number(i.total) > 0) || i.status === "PAID",
      );
    const current = await this.prisma.main.project.findUniqueOrThrow({ where: { id: projectId } });
    if ((allPaid ? "LUNAS" : "BELUM_LUNAS") === current.paymentStatus) return current;
    return this.prisma.main.project.update({
      where: { id: projectId },
      data: { paymentStatus: allPaid ? "LUNAS" : "BELUM_LUNAS" },
    });
  }

  /** Progres project ditentukan secara manual oleh PM. Jika project SELESAI, selalu 100%. */
  async recomputeProgress(projectId: number): Promise<Project> {
    const current = await this.prisma.main.project.findUniqueOrThrow({ where: { id: projectId } });
    if (current.status === "SELESAI" && current.progress !== 100) {
      return this.prisma.main.project.update({ where: { id: projectId }, data: { progress: 100 } });
    }
    return current;
  }

  async list(q: ProjectListQuery, user: RequestUser) {
    const scope = ["SUPER_ADMIN", "ADMIN", "BOS", "FINANCE", "SALES", "PROCUREMENT", "GUDANG", "TEKNISI", "SE", "PM"].includes(user.role)
      ? {}
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
          quotation: {
            select: {
              id: true,
              number: true,
              status: true,
              customer: { select: { id: true, name: true } },
              lead: { select: { id: true, name: true } },
            },
          },
          members: { include: { user: { select: { id: true, name: true, role: true } } } },
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
    const fileIds = [project.prdFileId, project.bahpFileId, project.bastFileId, project.doFileId, project.boqFileId].filter(
      (fid): fid is number => typeof fid === "number" && fid > 0,
    );
    const [row, files] = await Promise.all([
      this.prisma.main.project.findUnique({
        where: { id },
        include: {
          pic: { select: { id: true, name: true, role: true } },
          customer: { select: { id: true, name: true } },
          quotation: {
            select: {
              id: true,
              number: true,
              status: true,
              grandTotal: true,
              customer: { select: { id: true, name: true } },
              lead: { select: { id: true, name: true } },
            },
          },
          members: { include: { user: { select: { id: true, name: true, role: true } } } },
          requirements: {
            include: { product: { select: { id: true, sku: true, name: true, unit: true, category: { select: { id: true, name: true } } } } },
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
      fileIds.length
        ? this.prisma.main.file.findMany({
            where: { id: { in: fileIds } },
            select: { id: true, originalName: true, mimeType: true, size: true },
          })
        : Promise.resolve([]),
    ]);
    if (!row) throw new NotFoundException("Project tidak ditemukan");
    const fileMap = new Map(files.map((f) => [f.id, f]));
    const prdFile = project.prdFileId ? fileMap.get(project.prdFileId) ?? null : null;
    const bahpFile = project.bahpFileId ? fileMap.get(project.bahpFileId) ?? null : null;
    const bastFile = project.bastFileId ? fileMap.get(project.bastFileId) ?? null : null;
    const doFile = project.doFileId ? fileMap.get(project.doFileId) ?? null : null;
    const boqFile = project.boqFileId ? fileMap.get(project.boqFileId) ?? null : null;

    // Tahapan project dihitung di server agar identik untuk semua role (PM, Procurement, dll.)
    const [invoiceCount, poCount, clientPoCount, surveyCount] = await Promise.all([
      this.prisma.main.invoiceOut.count({ where: { projectId: id, status: { not: "BATAL" as never } } }).catch(() => 0),
      this.prisma.main.supplierPO.count({ where: { projectId: id, status: { notIn: ["DITOLAK", "DIBATALKAN"] as never } } }).catch(() => 0),
      project.quotationId
        ? this.prisma.main.clientPO.count({ where: { quotationId: project.quotationId } }).catch(() => 0)
        : Promise.resolve(0),
      project.quotationId
        ? this.prisma.main.quotation
            .findUnique({ where: { id: project.quotationId }, select: { leadId: true } })
            .then((q) => (q?.leadId ? this.prisma.main.survey.count({ where: { leadId: q.leadId } }) : 0))
            .catch(() => 0)
        : Promise.resolve(0),
    ]);
    const stages = {
      boq: !!project.boqFileId || row.requirements.length > 0,
      survey: surveyCount > 0,
      penawaran: !!project.quotationId,
      po: poCount > 0 || clientPoCount > 0,
      progress: project.progress > 0,
      invoice: invoiceCount > 0,
      bast: project.status === "SELESAI" || !!project.bastFileId,
      counts: { requirements: row.requirements.length, surveys: surveyCount, clientPos: clientPoCount, supplierPos: poCount, invoices: invoiceCount },
    };
    return { ...row, paymentStatus: synced.paymentStatus, prdFile, bahpFile, bastFile, doFile, boqFile, stages };
  }

  async create(dto: ProjectDto, user: RequestUser) {
    const type = dto.type ?? "CUSTOMER";
    const picId = dto.picId ?? user.id;
    const pic = await this.prisma.main.user.findUnique({ where: { id: picId } });
    if (!pic) throw new NotFoundException("PIC tidak ditemukan");

    const customerId = dto.customerId;
    if (customerId) {
      const customer = await this.prisma.main.customer.findUnique({ where: { id: customerId } });
      if (!customer) throw new NotFoundException("Customer tidak ditemukan");
    }

    const requestedMembers = dto.memberIds ?? [];
    let memberIds: number[] = [];
    if (requestedMembers.length) {
      const users = await this.prisma.main.user.findMany({ where: { id: { in: requestedMembers } } });
      memberIds = users.map((u) => u.id);
    }

    let quotationId = dto.quotationId;
    if (!quotationId && dto.leadId) {
      const q = await this.prisma.main.quotation.findFirst({
        where: { leadId: dto.leadId },
        orderBy: { id: "desc" },
      });
      if (q) quotationId = q.id;
    }
    if (!quotationId && customerId) {
      const cleanName = (dto.name || "").replace(/^Project\s+/i, "").trim();
      const q = await this.prisma.main.quotation.findFirst({
        where: {
          customerId,
          OR: [
            ...(cleanName ? [{ lead: { name: { contains: cleanName } } }] : []),
            ...(cleanName ? [{ number: { contains: cleanName } }] : []),
          ],
        },
        orderBy: { id: "desc" },
      });
      if (q) quotationId = q.id;
    }

    const project = await this.prisma.main.project.create({
      data: {
        name: dto.name || "Project Baru",
        type,
        customerId,
        picId,
        quotationId: quotationId ?? undefined,
        startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
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
    await this.linkProjectInvoices(project.id);
    await this.syncPayment(project.id).catch(() => {});

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
    this.notifications.dataChange("projects", "create", project.id);
    if (project.quotationId) {
      await this.syncQuotationRequirements(project.id, project.quotationId, user).catch((err) => {
        console.warn("Gagal auto-sync BOQ penawaran ke proyek:", err);
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
  }

  private async assertMembers(userIds: number[]) {
    if (!userIds.length) return;
    const users = await this.prisma.main.user.findMany({ where: { id: { in: userIds } } });
    if (users.length !== userIds.length) throw new NotFoundException("Ada anggota tim yang tidak ditemukan");
  }

  async update(id: number, dto: ProjectDto, user: RequestUser) {
    const project = await this.prisma.main.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException("Project tidak ditemukan");
    await this.access(project, user, true);

    const type = dto.type ?? project.type;
    if (dto.picId !== undefined && dto.picId !== project.picId) {
      if (dto.picId !== null) {
        const pic = await this.prisma.main.user.findUnique({ where: { id: dto.picId } });
        if (!pic) throw new NotFoundException("PIC tidak ditemukan");
      }
    }

    let validMemberIds: number[] | undefined = undefined;
    if (dto.memberIds !== undefined) {
      if (dto.memberIds.length === 0) {
        validMemberIds = [];
      } else {
        const existingUsers = await this.prisma.main.user.findMany({
          where: { id: { in: dto.memberIds } },
          select: { id: true },
        });
        const existingSet = new Set(existingUsers.map((u) => u.id));
        validMemberIds = dto.memberIds.filter((uid) => existingSet.has(uid));
      }
    }

    const nextStatus = dto.status ?? project.status;
    const isSelesai = nextStatus === "SELESAI";
    const nextProgress = isSelesai
      ? 100
      : dto.progress !== undefined
      ? dto.progress
      : project.progress;

    const updated = await this.prisma.main.project.update({
      where: { id },
      data: {
        name: dto.name ?? project.name,
        type,
        customerId: dto.customerId !== undefined ? dto.customerId : project.customerId,
        picId: dto.picId !== undefined ? dto.picId : project.picId,
        quotationId: dto.quotationId !== undefined ? dto.quotationId : project.quotationId,
        startDate: dto.startDate ? new Date(dto.startDate) : project.startDate,
        endDate: dto.endDate !== undefined ? (dto.endDate ? new Date(dto.endDate) : null) : project.endDate,
        ...(dto.status ? { status: dto.status } : {}),
        progress: nextProgress,
        completedAt: isSelesai ? (project.completedAt ?? new Date()) : null,
        prdFileId: dto.prdFileId !== undefined ? dto.prdFileId : project.prdFileId,
        bahpFileId: dto.bahpFileId !== undefined ? dto.bahpFileId : project.bahpFileId,
        bastFileId: dto.bastFileId !== undefined ? dto.bastFileId : project.bastFileId,
        doFileId: dto.doFileId !== undefined ? dto.doFileId : project.doFileId,
        boqFileId: dto.boqFileId !== undefined ? dto.boqFileId : project.boqFileId,
        notes: dto.notes !== undefined ? dto.notes : project.notes,
        ...(validMemberIds !== undefined
          ? { members: { deleteMany: {}, create: validMemberIds.map((userId) => ({ userId })) } }
          : {}),
      },
      include: {
        pic: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        members: { include: { user: { select: { id: true, name: true, role: true } } } },
      },
    });
    for (const fid of [dto.prdFileId, dto.bahpFileId, dto.bastFileId, dto.doFileId, dto.boqFileId]) {
      if (fid) await this.attachFile(fid, "project", id);
    }

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
    if (dto.quotationId && dto.quotationId !== project.quotationId) {
      await this.syncQuotationRequirements(id, dto.quotationId, user).catch((err) => {
        console.warn("Gagal auto-sync BOQ penawaran ke proyek:", err);
      });
    }
    await this.linkProjectInvoices(id);
    await this.syncPayment(id).catch(() => {});
    return updated;
  }

  async remove(id: number, user: RequestUser) {
    const project = await this.prisma.main.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException("Project tidak ditemukan");
    await this.access(project, user, true);

    const [invoices, expenses, requests] = await Promise.all([
      this.prisma.main.invoiceOut.count({ where: { projectId: id } }),
      this.prisma.main.expense.count({ where: { projectId: id } }),
      this.prisma.main.purchaseRequest.count({ where: { projectId: id } }),
    ]);
    const used = [
      { label: "invoice", count: invoices },
      { label: "pengeluaran", count: expenses },
      { label: "request pembelian", count: requests },
    ].filter((b) => b.count > 0);
    if (used.length) {
      throw new BadRequestException(
        `Project masih memiliki ${used.map((b) => `${b.count} ${b.label}`).join(", ")}`,
      );
    }

    await this.prisma.main.$transaction(async (tx) => {
      await tx.stockReservation.deleteMany({ where: { projectId: id } });
      await tx.projectRequirement.deleteMany({ where: { projectId: id } });
      await tx.task.updateMany({ where: { projectId: id }, data: { parentId: null } });
      await tx.task.deleteMany({ where: { projectId: id } });
      await tx.projectMember.deleteMany({ where: { projectId: id } });
      await tx.project.delete({ where: { id } });
    });
    await this.audit.log({
      actor: user,
      action: "HAPUS_PROJECT",
      entityType: "project",
      entityId: id,
      detail: `${project.name} dihapus permanen`,
    });
    this.notifications.dataChange("projects", "delete", id);
    return { id, deleted: true };
  }

  /** PRD #2 (status manual) + #1 (penutupan wajib file bukti). */
  async setStatus(id: number, dto: ProjectStatusDto, user: RequestUser) {
    const project = await this.prisma.main.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException("Project tidak ditemukan");
    await this.access(project, user, true);

    let warning: string | undefined;
    if (dto.status === "SELESAI" && !project.prdFileId) {
      warning = "Project ditutup tanpa dokumen PRD/BAST";
    }
    const synced = await this.syncPayment(id);
    if (dto.status === "SELESAI" && synced.paymentStatus !== "LUNAS") {
      warning = "Project ditutup namun pembayaran belum lunas";
    }

    const isSelesai = dto.status === "SELESAI";
    const updated = await this.prisma.main.project.update({
      where: { id },
      data: {
        status: dto.status,
        completedAt: isSelesai ? new Date() : null,
        ...(isSelesai ? { progress: 100 } : {}),
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
    this.notifications.dataChange("projects", "status", id);
    return { ...updated, ...(warning ? { warning } : {}) };
  }

  /** PRD #17: Admin memindahkan project ke orang lain. */
  async reassign(id: number, dto: AssignDto, user: RequestUser) {
    if (!["SUPER_ADMIN", "ADMIN", "BOS"].includes(user.role)) {
      throw new ForbiddenException("Hanya Admin atau Bos yang boleh memindahkan project");
    }
    const project = await this.prisma.main.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException("Project tidak ditemukan");
    const target = await this.prisma.main.user.findUnique({ where: { id: dto.userId } });
    if (!target) throw new NotFoundException("Tujuan pemindahan tidak ditemukan");
    if (!["PM", "ADMIN", "SUPER_ADMIN"].includes(target.role)) throw new BadRequestException("PIC project harus berrole PM atau Admin");

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
    this.notifications.dataChange("projects", "update", updated.id);
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

    // 1. Bersihkan produk temporary / non-master dari database master agar tidak pernah masuk ke inventory
    try {
      const nonMasterProds = await this.prisma.main.product.findMany({
        where: {
          OR: [
            { sku: { startsWith: "SKU-PR-" } },
            { description: { contains: "Non-Master" } },
            { type: "NON_MASTER" },
          ],
        },
        select: { id: true },
      });
      if (nonMasterProds.length > 0) {
        const ids = nonMasterProds.map((p) => p.id);
        await this.prisma.main.projectRequirement.deleteMany({ where: { productId: { in: ids } } }).catch(() => {});
        await this.prisma.main.stockReservation.deleteMany({ where: { productId: { in: ids } } }).catch(() => {});
        await this.prisma.main.purchaseRequestItem.updateMany({ where: { productId: { in: ids } }, data: { productId: null } }).catch(() => {});
        await this.prisma.main.stockBalance.deleteMany({ where: { productId: { in: ids } } }).catch(() => {});
        await this.prisma.main.stockMovement.deleteMany({ where: { productId: { in: ids } } }).catch(() => {});
        await this.prisma.main.serialUnit.deleteMany({ where: { productId: { in: ids } } }).catch(() => {});
        await this.prisma.main.product.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
      }
    } catch {}

    // 2. Ambil kebutuhan barang reguler / katalog master
    let rows = await this.prisma.main.projectRequirement.findMany({
      where: { projectId },
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            unit: true,
            hasSerial: true,
            purchasePrice: true,
            description: true,
            category: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { id: "asc" },
    });

    // Cari penawaran terkait project untuk menentukan item mana yang merupakan BOQ kontrak awal penawaran vs item tambahan di luar BOQ
    let quotationId = project.quotationId;
    if (!quotationId && project.customerId) {
      const q = await this.prisma.main.quotation.findFirst({
        where: { customerId: project.customerId },
        orderBy: { id: "desc" },
      });
      if (q) {
        quotationId = q.id;
        await this.prisma.main.project
          .update({ where: { id: projectId }, data: { quotationId: q.id } })
          .catch(() => {});
      }
    }

    const contractProductIds = new Set<number>();
    const contractSkus = new Set<string>();
    const contractNames = new Set<string>();

    if (quotationId) {
      const quoteRow = await this.prisma.main.quotation.findUnique({ where: { id: quotationId }, select: { items: true } });
      {
        try {
          const qItems: any[] = Array.isArray(quoteRow?.items) ? (quoteRow!.items as any[]) : [];
          for (const it of qItems) {
            if (it.productId) contractProductIds.add(Number(it.productId));
            if (it.sku) contractSkus.add(String(it.sku).trim().toLowerCase());
            const rawName = String(it.item || it.name || "");
            const clean = rawName
              .replace(/\s*\(SN:.*?\)/gi, "")
              .replace(/\s*\[SN:.*?\]/gi, "")
              .replace(/\s*\(SKU-.*?\)/gi, "")
              .replace(/\s*#\d+/g, "")
              .trim()
              .toLowerCase();
            if (clean) contractNames.add(clean);
          }
        } catch {}
      }
    }

    const hasContractItems = contractProductIds.size > 0 || contractSkus.size > 0 || contractNames.size > 0;

    const withAvailability = await Promise.all(
      rows.map(async (r) => {
        const avail = await this.availableQty(r.productId, projectId);
        const prodSku = (r.product?.sku || "").trim().toLowerCase();
        const cleanProdName = (r.product?.name || "").trim().toLowerCase();

        let isFromContract = false;
        if (hasContractItems) {
          isFromContract =
            contractProductIds.has(r.productId) ||
            (Boolean(prodSku) && contractSkus.has(prodSku)) ||
            (Boolean(cleanProdName) && (
              contractNames.has(cleanProdName) ||
              Array.from(contractNames).some((cn) => cleanProdName.includes(cn) || cn.includes(cleanProdName))
            ));
        }

        return {
          ...r,
          neededQty: r.qty,
          shortageQty: Math.max(0, r.qty - r.reservedQty),
          availableQty: avail,
          isExtra: hasContractItems ? !isFromContract : false,
        };
      }),
    );

    // 3. Gabungkan material non-master / pakai habis dari Purchase Request project secara virtual (tanpa disimpan ke master product)
    const validStatuses: ("DISETUJUI" | "DIBAYAR" | "DITERIMA")[] = ["DISETUJUI", "DIBAYAR", "DITERIMA"];
    const prs = await this.prisma.main.purchaseRequest.findMany({
      where: {
        projectId,
        OR: [
          { status: { in: validStatuses } },
          { paymentStatus: "DIBAYAR" },
        ],
      },
      include: { items: true },
    });

    const consumableTotals = new Map<string, {
      name: string;
      totalQty: number;
      unit: string;
      unitCost: number;
      prNumbers: string[];
      prItemIds: number[];
    }>();

    for (const pr of prs) {
      for (const it of pr.items) {
        if (it.customName) {
          const cleanName = it.customName.replace(/\[PAKAI_HABIS\]|\[CONSUMABLE\]/gi, "").trim();
          if (!cleanName) continue;
          const key = cleanName.toLowerCase();
          const existing = consumableTotals.get(key) || {
            name: cleanName,
            totalQty: 0,
            unit: it.customUnit || "pcs",
            unitCost: Number(it.unitCost || 0),
            prNumbers: [],
            prItemIds: [],
          };
          existing.totalQty += it.qty;
          if (it.customUnit) existing.unit = it.customUnit;
          if (Number(it.unitCost || 0) > 0) existing.unitCost = Number(it.unitCost || 0);
          if (!existing.prNumbers.includes(pr.number)) existing.prNumbers.push(pr.number);
          existing.prItemIds.push(it.id);
          consumableTotals.set(key, existing);
        }
      }
    }

    const consumableItems: any[] = [];
    let virtualId = -1000;
    for (const [_, entry] of consumableTotals) {
      const assignedId = entry.prItemIds.length > 0 ? -entry.prItemIds[0] : virtualId--;
      consumableItems.push({
        id: assignedId,
        projectId,
        productId: null,
        qty: entry.totalQty,
        neededQty: entry.totalQty,
        reservedQty: entry.totalQty,
        shortageQty: 0,
        availableQty: entry.totalQty,
        costPrice: entry.unitCost,
        unitPrice: entry.unitCost,
        isExtra: true,
        status: `Tersedia & Di-reserve (${entry.totalQty})`,
        product: {
          id: null,
          sku: "-",
          name: entry.name,
          unit: entry.unit,
          hasSerial: false,
          purchasePrice: entry.unitCost,
          description: `Material Khusus Proyek (Pakai Habis / Non-Master)`,
          category: { id: 0, name: "Material Proyek" },
        },
      });
    }

    const combined = [...withAvailability, ...consumableItems];
    return { items: combined, total: combined.length };
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

  private async reserveFor(
    projectId: number,
    requirementId: number,
    productId: number,
    qty: number,
    serialsStr?: string | null,
  ) {
    await this.prisma.main.stockReservation.updateMany({
      where: { requirementId, releasedAt: null },
      data: { releasedAt: new Date() },
    });

    const snList = (serialsStr || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (snList.length > 0) {
      const units = await this.prisma.main.serialUnit.findMany({
        where: { productId, sn: { in: snList } },
      });
      for (const u of units) {
        await this.prisma.main.stockReservation.create({
          data: {
            projectId,
            productId,
            serialUnitId: u.id,
            qty: 1,
            requirementId,
          },
        });
        if (u.status === "DI_GUDANG") {
          await this.prisma.main.serialUnit.update({
            where: { id: u.id },
            data: { status: "RESERVED", projectId },
          });
        }
      }
      const reserveQty = units.length;
      const status = reserveQty >= qty ? "DIRESERVE" : reserveQty > 0 ? "DIRESERVE" : "DIBUTUHKAN";
      await this.prisma.main.projectRequirement.update({
        where: { id: requirementId },
        data: { reservedQty: reserveQty, status: status as never },
      });
      return { reservedQty: reserveQty, shortage: Math.max(0, qty - reserveQty) };
    }

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

    let productId = dto.productId;
    if (!productId && dto.name) {
      let prod = await this.prisma.main.product.findFirst({
        where: { name: dto.name.trim() },
      });
      const effectiveCost = dto.costPrice !== undefined ? Number(dto.costPrice) : (dto.price !== undefined ? Number(dto.price) : 0);
      const descParts: string[] = [];
      if (dto.pphMode) descParts.push(`PPH:${dto.pphMode}`);
      if (dto.sellingPrice !== undefined) descParts.push(`SELL:${dto.sellingPrice}`);
      const descStr = descParts.length > 0 ? descParts.join(";") : null;

      if (!prod) {
        const sku = `SKU-BOQ-${Date.now().toString(36).toUpperCase()}`;
        prod = await this.prisma.main.product.create({
          data: {
            sku,
            name: dto.name.trim(),
            unit: dto.unit || "unit",
            purchasePrice: effectiveCost,
            description: descStr,
            type: "BARANG",
          },
        });
      } else if (effectiveCost > 0 || descStr) {
        await this.prisma.main.product.update({
          where: { id: prod.id },
          data: {
            ...(effectiveCost > 0 ? { purchasePrice: effectiveCost } : {}),
            ...(descStr ? { description: descStr } : {}),
          },
        });
      }
      productId = prod.id;
    }
    if (!productId) throw new BadRequestException("Barang atau nama barang wajib diisi");

    const product = await this.prisma.main.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException("Barang tidak ditemukan");
    if (Number(product.purchasePrice) === 0 && (dto.costPrice || dto.price)) {
      const effectiveCost = Number(dto.costPrice ?? dto.price ?? 0);
      if (effectiveCost > 0) {
        await this.prisma.main.product.update({
          where: { id: productId },
          data: { purchasePrice: effectiveCost },
        }).catch(() => {});
      }
    }
    if (dto.taskId) {
      const task = await this.prisma.main.task.findUnique({ where: { id: dto.taskId } });
      if (!task || task.projectId !== projectId) throw new BadRequestException("Task bukan milik project ini");
    }

    const row = await this.prisma.main.projectRequirement.create({
      data: {
        projectId,
        taskId: dto.taskId,
        productId,
        qty: dto.qty,
        serials: dto.serials ?? null,
      },
    });
    const reserved = await this.reserveFor(projectId, row.id, productId, dto.qty, dto.serials);
    const created = await this.prisma.main.projectRequirement.findUnique({
      where: { id: row.id },
      include: { product: { select: { id: true, sku: true, name: true, unit: true, hasSerial: true, category: { select: { id: true, name: true } } } } },
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
    if (id < 0) {
      const prItemId = Math.abs(id);
      const prItem = await this.prisma.main.purchaseRequestItem.findUnique({
        where: { id: prItemId },
        include: { request: true },
      });
      if (prItem && prItem.request.projectId === projectId) {
        const effectiveCost = dto.costPrice !== undefined ? Number(dto.costPrice) : (dto.price !== undefined ? Number(dto.price) : undefined);
        await this.prisma.main.purchaseRequestItem.update({
          where: { id: prItemId },
          data: {
            ...(dto.qty ? { qty: dto.qty } : {}),
            ...(dto.name ? { customName: dto.name.trim() } : {}),
            ...(dto.unit ? { customUnit: dto.unit.trim() } : {}),
            ...(effectiveCost !== undefined ? { unitCost: effectiveCost } : {}),
          },
        });
      }
      return { id, ...dto, product: { id: null, name: dto.name, unit: dto.unit } };
    }
    const project = await this.prisma.main.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException("Project tidak ditemukan");
    await this.access(project, user, true);
    const row = await this.prisma.main.projectRequirement.findUnique({ where: { id } });
    if (!row || row.projectId !== projectId) throw new NotFoundException("Kebutuhan tidak ditemukan");

    if (dto.name || dto.unit || dto.price !== undefined || dto.costPrice !== undefined || dto.sellingPrice !== undefined || dto.pphMode !== undefined) {
      const effectiveCost = dto.costPrice !== undefined ? Number(dto.costPrice) : (dto.price !== undefined ? Number(dto.price) : undefined);
      const descParts: string[] = [];
      if (dto.pphMode) descParts.push(`PPH:${dto.pphMode}`);
      if (dto.sellingPrice !== undefined) descParts.push(`SELL:${dto.sellingPrice}`);
      const descStr = descParts.length > 0 ? descParts.join(";") : undefined;

      await this.prisma.main.product.update({
        where: { id: row.productId },
        data: {
          ...(dto.name ? { name: dto.name.trim() } : {}),
          ...(dto.unit ? { unit: dto.unit.trim() } : {}),
          ...(effectiveCost !== undefined ? { purchasePrice: effectiveCost } : {}),
          ...(descStr !== undefined ? { description: descStr } : {}),
        },
      });
    }

    const updated = await this.prisma.main.projectRequirement.update({
      where: { id },
      data: {
        qty: dto.qty,
        productId: dto.productId,
        taskId: dto.taskId ?? row.taskId,
        ...(dto.serials !== undefined ? { serials: dto.serials || null } : {}),
      },
    });
    const reserved = await this.reserveFor(projectId, id, updated.productId, updated.qty, updated.serials);
    const current = await this.prisma.main.projectRequirement.findUnique({
      where: { id },
      include: { product: { select: { id: true, sku: true, name: true, unit: true, hasSerial: true, category: { select: { id: true, name: true } } } } },
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
    if (id < 0) {
      const prItemId = Math.abs(id);
      const prItem = await this.prisma.main.purchaseRequestItem.findUnique({
        where: { id: prItemId },
        include: { request: true },
      });
      if (prItem && prItem.request.projectId === projectId) {
        const cleanName = (prItem.customName || "").replace(/\[PAKAI_HABIS\]|\[CONSUMABLE\]/gi, "").trim();
        const matchingItems = await this.prisma.main.purchaseRequestItem.findMany({
          where: {
            request: { projectId },
            customName: { contains: cleanName },
          },
        });

        for (const item of matchingItems) {
          const otherItemsCount = await this.prisma.main.purchaseRequestItem.count({
            where: { requestId: item.requestId, NOT: { id: item.id } },
          });
          if (otherItemsCount === 0) {
            await this.prisma.main.approval.deleteMany({
              where: { kind: "PURCHASE_REQUEST", entityId: item.requestId },
            }).catch(() => {});
            await this.prisma.main.purchaseRequestItem.deleteMany({
              where: { requestId: item.requestId },
            }).catch(() => {});
            await this.prisma.main.purchaseRequest.delete({
              where: { id: item.requestId },
            }).catch(() => {});
          } else {
            await this.prisma.main.purchaseRequestItem.delete({
              where: { id: item.id },
            }).catch(() => {});
          }
        }
      }
      return { id, deleted: true };
    }
    const project = await this.prisma.main.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException("Project tidak ditemukan");
    await this.access(project, user, true);
    const row = await this.prisma.main.projectRequirement.findUnique({ where: { id } });
    if (!row || row.projectId !== projectId) throw new NotFoundException("Kebutuhan tidak ditemukan");

    // Cari purchase request aktif untuk project ini yang mengandung barang ini
    const relatedPrs = await this.prisma.main.purchaseRequest.findMany({
      where: {
        projectId,
        status: { notIn: ["DITOLAK", "DIBATALKAN"] },
        items: { some: { productId: row.productId } },
      },
      include: { items: true, supplierPOs: true },
    });

    // Cek apakah ada request yang sudah berjalan (bukan DIAJUKAN atau sudah dibuat PO supplier)
    const isRunning = relatedPrs.some(
      (pr) => pr.status !== "DIAJUKAN" || (pr.supplierPOs && pr.supplierPOs.length > 0),
    );
    if (isRunning) {
      throw new BadRequestException("Request sudah berjalan, tidak bisa hapus barang");
    }

    // Jika request masih berstatus DIAJUKAN, hapus request atau item terkait
    await this.prisma.main.$transaction(async (tx) => {
      for (const pr of relatedPrs) {
        if (pr.items.length <= 1) {
          await tx.approval.deleteMany({ where: { kind: "PURCHASE_REQUEST", entityId: pr.id } });
          await tx.purchaseRequestItem.deleteMany({ where: { requestId: pr.id } });
          await tx.purchaseRequest.delete({ where: { id: pr.id } });
        } else {
          await tx.purchaseRequestItem.deleteMany({
            where: { requestId: pr.id, productId: row.productId },
          });
        }
      }

      await tx.stockReservation.updateMany({
        where: { requirementId: id, releasedAt: null },
        data: { releasedAt: new Date() },
      });
      await tx.projectRequirement.delete({ where: { id } });
    });

    await this.audit.log({
      actor: user,
      action: "HAPUS_KEBUTUHAN_BARANG",
      entityType: "project-requirement",
      entityId: id,
      detail: `project #${projectId}, produk #${row.productId}`,
    });
    return { id, deleted: true };
  }

  async syncQuotationRequirements(projectId: number, quotationId: number, user: RequestUser) {
    const project = await this.prisma.main.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException("Project tidak ditemukan");

    const quoteRow = await this.prisma.main.quotation.findUnique({ where: { id: quotationId }, select: { items: true } });
    if (!Array.isArray(quoteRow?.items)) return { imported: 0, items: [] };

    const qItems: any[] = quoteRow.items as any[];
    let imported = 0;
    const results = [];

    for (const item of qItems) {
      if (item.kind === "SERVICE") continue;
      const itemName = String(item.name || item.item || "").trim();
      const itemQty = Math.max(1, Math.round(Number(item.qty || item.jumlah) || 1));
      if (!itemName && !item.productId) continue;

      let prod = item.productId
        ? await this.prisma.main.product.findUnique({ where: { id: Number(item.productId) } })
        : null;
      if (!prod && item.sku) {
        prod = await this.prisma.main.product.findFirst({ where: { sku: String(item.sku) } });
      }
      if (!prod && itemName) {
        const cleanName = itemName.replace(/\s*\(SN:.*$/i, "").replace(/\s*\[SN:.*$/i, "").trim();
        prod = await this.prisma.main.product.findFirst({
          where: {
            OR: [
              { name: { equals: cleanName } },
              { sku: { equals: cleanName } },
            ],
          },
        });
        if (!prod) {
          prod = await this.prisma.main.product.findFirst({
            where: { name: { contains: cleanName } },
          });
        }
      }
      if (!prod) {
        // Item penawaran hanya berupa teks deskripsi commercial, jangan buat produk atau SN baru di master data
        continue;
      }

      const itemSns: string[] = Array.isArray(item.serialNumbers)
        ? item.serialNumbers.map((s: any) => String(s ?? "").trim()).filter(Boolean)
        : [];
      const existingReq = await this.prisma.main.projectRequirement.findFirst({
        where: { projectId, productId: prod.id },
      });

      if (!existingReq) {
        const serialsStr = itemSns.length > 0 ? itemSns.join(", ") : null;
        const reqRow = await this.prisma.main.projectRequirement.create({
          data: {
            projectId,
            productId: prod.id,
            qty: itemQty,
            serials: serialsStr,
          },
        });
        await this.reserveFor(projectId, reqRow.id, prod.id, itemQty, serialsStr);
        imported++;
        results.push(reqRow);
      } else if (itemSns.length > 0) {
        // Gabungkan jika ada beberapa baris kamera yang sama (1 SN = 1 baris di penawaran)
        const prevSns = (existingReq.serials || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const mergedSns = Array.from(new Set([...prevSns, ...itemSns]));
        const newQty = Math.max(existingReq.qty + itemQty, mergedSns.length);
        const serialsStr = mergedSns.join(", ");
        const updatedReq = await this.prisma.main.projectRequirement.update({
          where: { id: existingReq.id },
          data: { qty: newQty, serials: serialsStr },
        });
        await this.reserveFor(projectId, existingReq.id, prod.id, newQty, serialsStr);
        results.push(updatedReq);
      }
    }

    if (imported > 0) {
      await this.audit.log({
        actor: user,
        action: "SYNC_BOQ_PENAWARAN",
        entityType: "project",
        entityId: projectId,
        detail: `Impor ${imported} item kebutuhan barang dari Penawaran #${quotationId}`,
      });
      await this.notifications.notify({
        roles: ["PROCUREMENT", "GUDANG"],
        kind: "STOK",
        text: `${imported} item kebutuhan barang proyek ditarik dari Penawaran #${quotationId}`,
        href: `/projects/${projectId}`,
      });
      this.notifications.dataChange("projects", "update", projectId);
      this.notifications.dataChange("stock", "update");
    }

    return { imported, items: results };
  }

  async returnMaterials(projectId: number, dto: ReturnMaterialsDto, user: RequestUser) {
    const project = await this.prisma.main.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException("Project tidak ditemukan");
    await this.access(project, user, true);

    const warehouse = await this.prisma.main.warehouse.findUnique({ where: { id: dto.warehouseId } });
    if (!warehouse) throw new NotFoundException("Gudang tujuan retur tidak ditemukan");

    if (!dto.items?.length) throw new BadRequestException("Pilih minimal satu barang yang diretur");

    const returnedItems: Array<{ productId: number; name: string; qty: number }> = [];

    await this.prisma.main.$transaction(async (tx) => {
      for (const item of dto.items) {
        const prod = await tx.product.findUnique({ where: { id: item.productId } });
        if (!prod) continue;

        if (prod.hasSerial && item.serials?.length) {
          for (const sn of item.serials) {
            const unit = await tx.serialUnit.findUnique({ where: { sn } });
            if (unit) {
              await tx.serialUnit.update({
                where: { id: unit.id },
                data: {
                  status: "DI_GUDANG",
                  warehouseId: warehouse.id,
                  projectId: null,
                },
              });
              await tx.serialUnitHistory.create({
                data: {
                  serialUnitId: unit.id,
                  status: "DI_GUDANG",
                  warehouseId: warehouse.id,
                  note: `Retur sisa material proyek ${project.name}`,
                  changedById: user.id,
                },
              });
              await this.stock.applyMovement({
                date: new Date(),
                type: "IN",
                category: "RETUR_PROJECT",
                productId: prod.id,
                toWarehouseId: warehouse.id,
                qty: 1,
                serialUnitId: unit.id,
                projectId,
                reason: dto.reason || `Retur sisa material dari proyek ${project.name}`,
                createdById: user.id,
              });
            }
          }
        } else {
          // Barang curah
          await this.stock.applyMovement({
            date: new Date(),
            type: "IN",
            category: "RETUR_PROJECT",
            productId: prod.id,
            toWarehouseId: warehouse.id,
            qty: item.qty,
            projectId,
            reason: dto.reason || `Retur sisa material dari proyek ${project.name}`,
            createdById: user.id,
          });
        }

        // Sesuaikan reservasi di project requirement jika ada
        const req = await tx.projectRequirement.findFirst({
          where: { projectId, productId: item.productId },
        });
        if (req && req.reservedQty >= item.qty) {
          await tx.projectRequirement.update({
            where: { id: req.id },
            data: { reservedQty: { decrement: item.qty } },
          });
          await tx.stockReservation.updateMany({
            where: { requirementId: req.id, releasedAt: null },
            data: { releasedAt: new Date() },
          });
        }

        returnedItems.push({ productId: prod.id, name: prod.name, qty: item.qty });
      }
    });

    await this.audit.log({
      actor: user,
      action: "RETUR_MATERIAL_PROYEK",
      entityType: "project",
      entityId: projectId,
      detail: `${returnedItems.length} item sisa diretur ke ${warehouse.name}`,
    });

    await this.notifications.notify({
      roles: ["GUDANG", "PM"],
      kind: "STOK",
      text: `${returnedItems.length} item material sisa proyek ${project.name} diretur ke ${warehouse.name}`,
      href: `/projects/${projectId}`,
    });

    this.notifications.dataChange("stock", "update");
    this.notifications.dataChange("projects", "update", projectId);

    return { success: true, returned: returnedItems };
  }

  async generateBast(id: number, dto: GenerateBastDto, user: RequestUser) {
    const project = await this.prisma.main.project.findUnique({
      where: { id },
      include: {
        customer: true,
        pic: true,
        requirements: {
          include: { product: true },
          orderBy: { id: "asc" },
        },
      },
    });
    if (!project) throw new NotFoundException("Project tidak ditemukan");
    await this.access(project, user, true);

    const docNumber = dto.number?.trim() || `BAST-${project.id}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
    const docDate = dto.date ? new Date(dto.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    const p1Comp = dto.party1Company?.trim() || "PT GHINA MULTI PRIMA";
    const p1Name = dto.party1Name?.trim() || project.pic?.name || user.name || "Project Manager";
    const p1Title = dto.party1Title?.trim() || "Project Manager";
    const p2Comp = dto.party2Company?.trim() || project.customer?.name || "Customer";
    const p2Name = dto.party2Name?.trim() || "Penanggung Jawab Proyek";
    const p2Title = dto.party2Title?.trim() || "Penanggung Jawab Proyek";
    const statement = dto.statement?.trim() ||
      "Dengan ini kedua belah pihak menyatakan bahwa seluruh pekerjaan pengadaan, instalasi, dan integrasi perangkat untuk proyek di atas telah diselesaikan dengan baik, telah diuji coba secara bersama-sama, dan dinyatakan berfungsi normal sesuai spesifikasi teknis yang disepakati.";
    const notes = dto.notes?.trim() || "Garansi pemeliharaan dan perangkat berlaku sesuai ketentuan kontrak yang disepakati kedua belah pihak.";

    const items = (dto.items && dto.items.length)
      ? dto.items
      : project.requirements.map((r) => ({
          name: r.product?.name || "Barang",
          qty: Number(r.qty || 1),
          unit: r.product?.unit || "unit",
        }));

    const tableBody: any[] = [
      [
        { text: "No", style: "tableHeader", alignment: "center", bold: true, fillColor: "#f3f4f6" },
        { text: "Deskripsi Pekerjaan / Barang", style: "tableHeader", bold: true, fillColor: "#f3f4f6" },
        { text: "Jumlah", style: "tableHeader", alignment: "center", bold: true, fillColor: "#f3f4f6" },
        { text: "Satuan", style: "tableHeader", alignment: "center", bold: true, fillColor: "#f3f4f6" },
      ],
    ];

    items.forEach((it, idx) => {
      tableBody.push([
        { text: String(idx + 1), alignment: "center" },
        { text: it.name },
        { text: String(it.qty), alignment: "center" },
        { text: it.unit || "unit", alignment: "center" },
      ]);
    });

    let logoImage: string | undefined;
    if (dto.logoFileId) {
      try {
        const file = await this.upload.read(dto.logoFileId);
        if (file?.buffer) {
          const mime = file.contentType || "image/png";
          logoImage = `data:${mime};base64,${file.buffer.toString("base64")}`;
        }
      } catch {}
    } else if (dto.logoBase64) {
      logoImage = dto.logoBase64;
    }

    const headerElement = logoImage
      ? {
          columns: [
            {
              width: 85,
              image: logoImage,
              fit: [80, 50],
              alignment: "left",
            },
            {
              width: "*",
              stack: [
                { text: p1Comp.toUpperCase(), fontSize: 13, bold: true, alignment: "right" },
                { text: "BERITA ACARA SERAH TERIMA PEKERJAAN (BAST)", fontSize: 10, bold: true, color: "#374151", alignment: "right", margin: [0, 4, 0, 0] },
              ],
              margin: [10, 4, 0, 0],
            },
          ],
          margin: [0, 0, 0, 8],
        }
      : {
          stack: [
            { text: p1Comp.toUpperCase(), fontSize: 14, bold: true, alignment: "center" },
            { text: "BERITA ACARA SERAH TERIMA PEKERJAAN (BAST)", fontSize: 11, bold: true, alignment: "center", margin: [0, 4, 0, 8] },
          ],
          margin: [0, 0, 0, 8],
        };

    const docDefinition: any = {
      pageSize: "A4",
      pageMargins: [40, 40, 40, 40],
      content: [
        headerElement,
        {
          canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: "#1f2937" }],
          margin: [0, 0, 0, 15],
        },
        {
          columns: [
            { width: 110, text: "Nomor BAST", bold: true, fontSize: 10 },
            { width: "*", text: `: ${docNumber}`, fontSize: 10 },
          ],
          margin: [0, 2, 0, 2],
        },
        {
          columns: [
            { width: 110, text: "Tanggal", bold: true, fontSize: 10 },
            { width: "*", text: `: ${docDate}`, fontSize: 10 },
          ],
          margin: [0, 2, 0, 2],
        },
        {
          columns: [
            { width: 110, text: "Nama Proyek", bold: true, fontSize: 10 },
            { width: "*", text: `: ${project.name}`, fontSize: 10 },
          ],
          margin: [0, 2, 0, 2],
        },
        {
          columns: [
            { width: 110, text: "Pihak Pertama (Penyedia)", bold: true, fontSize: 10 },
            { width: "*", text: `: ${p1Comp} (PIC: ${p1Name})`, fontSize: 10 },
          ],
          margin: [0, 2, 0, 2],
        },
        {
          columns: [
            { width: 110, text: "Pihak Kedua (Klien)", bold: true, fontSize: 10 },
            { width: "*", text: `: ${p2Comp} (PIC: ${p2Name})`, fontSize: 10 },
          ],
          margin: [0, 2, 0, 15],
        },
        {
          text: "Pernyataan Serah Terima:",
          bold: true,
          fontSize: 10,
          margin: [0, 0, 0, 4],
        },
        {
          text: statement,
          fontSize: 10,
          lineHeight: 1.4,
          margin: [0, 0, 0, 15],
        },
        {
          text: "Rincian Barang & Pekerjaan yang Diserahterimakan:",
          bold: true,
          fontSize: 10,
          margin: [0, 0, 0, 6],
        },
        {
          table: {
            headerRows: 1,
            widths: [30, "*", 60, 60],
            body: tableBody,
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 15],
        },
        ...(notes
          ? [
              { text: "Catatan Tambahan & Ketentuan:", bold: true, fontSize: 10, margin: [0, 0, 0, 4] },
              { text: notes, fontSize: 10, lineHeight: 1.3, margin: [0, 0, 0, 20] },
            ]
          : []),
        {
          columns: [
            {
              width: "*",
              alignment: "center",
              stack: [
                { text: "Pihak Pertama (Penyedia)", fontSize: 10, color: "#4b5563" },
                { text: p1Comp, bold: true, fontSize: 10, margin: [0, 2, 0, 45] },
                { text: p1Name, bold: true, fontSize: 10, decoration: "underline" },
                { text: p1Title, fontSize: 9, color: "#6b7280" },
              ],
            },
            {
              width: "*",
              alignment: "center",
              stack: [
                { text: "Pihak Kedua (Klien)", fontSize: 10, color: "#4b5563" },
                { text: p2Comp, bold: true, fontSize: 10, margin: [0, 2, 0, 45] },
                { text: p2Name, bold: true, fontSize: 10, decoration: "underline" },
                { text: p2Title, fontSize: 9, color: "#6b7280" },
              ],
            },
          ],
          margin: [0, 20, 0, 0],
        },
      ],
      defaultStyle: {
        font: "Helvetica",
      },
    };

    const pdfBuffer = await renderPdf(docDefinition);
    const fileName = `BAST-${project.name.replace(/[^\w-]/g, "_")}-${docNumber.replace(/[^\w-]/g, "_")}.pdf`;
    const saved = await this.upload.saveNamed(pdfBuffer, "dokumen", fileName, user, "project", String(id));

    await this.prisma.main.project.update({
      where: { id },
      data: { bastFileId: saved.id },
    });

    await this.prisma.main.systemSetting.upsert({
      where: { key: `project.bast.${id}` },
      update: {
        value: JSON.stringify({
          party1Company: p1Comp,
          party1Name: p1Name,
          party1Title: p1Title,
          logoFileId: dto.logoFileId ?? null,
        }),
      },
      create: {
        key: `project.bast.${id}`,
        value: JSON.stringify({
          party1Company: p1Comp,
          party1Name: p1Name,
          party1Title: p1Title,
          logoFileId: dto.logoFileId ?? null,
        }),
      },
    }).catch(() => {});

    await this.audit.log({
      actor: user,
      action: "GENERATE_BAST",
      entityType: "project",
      entityId: id,
      detail: `Generate Dokumen BAST resmi: ${docNumber}`,
    });

    this.notifications.dataChange("projects", "update", id);

    return {
      fileId: saved.id,
      file: saved,
      url: saved.url,
      number: docNumber,
    };
  }

  private async attachFile(fileId: number, refType: string, refId: number) {
    await this.prisma.main.file.update({
      where: { id: fileId },
      data: { refType, refId: String(refId) },
    });
  }
}
