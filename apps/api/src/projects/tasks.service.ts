import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { ProjectsService } from "./projects.service.js";
import { AssignDto, TaskDto, TaskStatusDto } from "./dto.js";

const MANAGER_ROLES = ["PM", "ADMIN", "BOS"];
const ASSIGNEE_ROLES = ["PM", "SE", "TEKNISI"];

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly projects: ProjectsService,
  ) {}

  private async projectOf(projectId: number) {
    const project = await this.prisma.main.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException("Project tidak ditemukan");
    return project;
  }

  /** SE/Teknisi hanya melihat task miliknya, tetapi induknya tetap ditampilkan sebagai kerangka (PRD: L tugasnya). */
  private pruneTree<T extends { id: number; parentId: number | null; assigneeId: number | null }>(
    nodes: T[],
    userId: number,
    isManager: boolean,
  ): (T & { children: (T & { children: unknown[] })[] })[] {
    const childrenOf = (parentId: number | null) => nodes.filter((n) => n.parentId === parentId);
    const walk = (parentId: number | null): (T & { children: unknown[] })[] => {
      const out: (T & { children: unknown[] })[] = [];
      for (const node of childrenOf(parentId)) {
        const kids = walk(node.id);
        if (isManager || node.assigneeId === userId || kids.length) {
          out.push({ ...node, children: kids });
        }
      }
      return out;
    };
    return walk(null) as never;
  }

  async tree(projectId: number, user: RequestUser) {
    const project = await this.projectOf(projectId);
    const isMember = await this.prisma.main.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });
    if (!["ADMIN", "BOS"].includes(user.role) && project.picId !== user.id && !isMember) {
      throw new ForbiddenException("Anda bukan anggota project ini");
    }
    const isManager = ["ADMIN", "BOS", "PM"].includes(user.role) || project.picId === user.id;

    const rows = await this.prisma.main.task.findMany({
      where: { projectId },
      include: { assignee: { select: { id: true, name: true, role: true } } },
      orderBy: { id: "asc" as const },
    });
    const items = this.pruneTree(rows, user.id, isManager);
    const visible = isManager ? rows.length : rows.filter((r) => r.assigneeId === user.id).length;
    return { projectId, items, total: visible };
  }

  async get(id: number, user: RequestUser) {
    const task = await this.prisma.main.task.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true, picId: true, status: true } },
        assignee: { select: { id: true, name: true, role: true } },
        parent: { select: { id: true, name: true } },
        children: { include: { assignee: { select: { id: true, name: true } } } },
        requirements: { include: { product: { select: { id: true, sku: true, name: true, unit: true } } } },
      },
    });
    if (!task) throw new NotFoundException("Task tidak ditemukan");
    if (
      !["ADMIN", "BOS", "PM"].includes(user.role) &&
      task.assigneeId !== user.id &&
      task.project.picId !== user.id
    ) {
      throw new ForbiddenException("Anda tidak punya akses ke task ini");
    }
    return task;
  }

  private async assertParent(projectId: number, parentId?: number | null) {
    if (!parentId) return;
    const parent = await this.prisma.main.task.findUnique({ where: { id: parentId } });
    if (!parent) throw new NotFoundException("Task induk tidak ditemukan");
    if (parent.projectId !== projectId) throw new BadRequestException("Task induk bukan milik project ini");
  }

  private async assertAssignee(userId: number) {
    const user = await this.prisma.main.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("PIC task tidak ditemukan");
    if (!ASSIGNEE_ROLES.includes(user.role)) throw new BadRequestException("PIC task harus PM, SE, atau Teknisi");
    return user;
  }

  async create(projectId: number, dto: TaskDto, user: RequestUser) {
    const project = await this.projectOf(projectId);
    if (!MANAGER_ROLES.includes(user.role) && project.picId !== user.id) {
      throw new ForbiddenException("Hanya PIC project, PM, Admin, atau Bos yang boleh membuat task");
    }
    await this.assertParent(projectId, dto.parentId);
    if (dto.assigneeId !== undefined) await this.assertAssignee(dto.assigneeId);

    const task = await this.prisma.main.task.create({
      data: {
        projectId,
        parentId: dto.parentId,
        name: dto.name,
        assigneeId: dto.assigneeId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        priority: dto.priority,
        progress: dto.progress ?? 0,
        needsPurchase: dto.needsPurchase ?? false,
        bahpFileId: dto.bahpFileId,
        bastFileId: dto.bastFileId,
        doFileId: dto.doFileId,
      },
      include: { assignee: { select: { id: true, name: true, role: true } } },
    });
    await this.attachFiles(task.id, dto);

    await this.audit.log({
      actor: user,
      action: "BUAT_TASK",
      entityType: "task",
      entityId: task.id,
      detail: `${project.name} — ${task.name}`,
    });
    if (task.assigneeId && task.assigneeId !== user.id) {
      await this.notifications.notify({
        userIds: [task.assigneeId],
        kind: "TUGAS",
        text: `Task baru: ${task.name} (${project.name})`,
        href: `/projects/${projectId}/tasks/${task.id}`,
      });
    }
    await this.projects.recomputeProgress(projectId);
    return task;
  }

  async update(id: number, dto: TaskDto, user: RequestUser) {
    const task = await this.prisma.main.task.findUnique({ where: { id }, include: { project: true } });
    if (!task) throw new NotFoundException("Task tidak ditemukan");
    if (!(await this.canModify(task.assigneeId, task.project.picId, user))) {
      throw new ForbiddenException("Anda hanya boleh mengubah task milik Anda sendiri");
    }
    await this.assertParent(task.projectId, dto.parentId ?? null);
    if (dto.parentId === id) throw new BadRequestException("Task tidak bisa jadi induk dirinya sendiri");
    if (dto.assigneeId !== undefined && dto.assigneeId !== task.assigneeId) {
      if (!MANAGER_ROLES.includes(user.role)) {
        throw new ForbiddenException("Hanya PM, Admin, atau Bos yang boleh mengganti PIC task");
      }
      await this.assertAssignee(dto.assigneeId);
    }

    const updated = await this.prisma.main.task.update({
      where: { id },
      data: {
        name: dto.name,
        parentId: dto.parentId ?? task.parentId,
        assigneeId: dto.assigneeId ?? task.assigneeId,
        dueDate: dto.dueDate !== undefined ? (dto.dueDate ? new Date(dto.dueDate) : null) : task.dueDate,
        priority: dto.priority ?? task.priority,
        progress: dto.progress ?? task.progress,
        needsPurchase: dto.needsPurchase ?? task.needsPurchase,
        bahpFileId: dto.bahpFileId ?? task.bahpFileId,
        bastFileId: dto.bastFileId ?? task.bastFileId,
        doFileId: dto.doFileId ?? task.doFileId,
      },
      include: { assignee: { select: { id: true, name: true, role: true } } },
    });
    await this.attachFiles(id, dto);

    await this.audit.log({
      actor: user,
      action: "UBAH_TASK",
      entityType: "task",
      entityId: id,
      detail: updated.name,
    });
    if (updated.assigneeId && updated.assigneeId !== task.assigneeId && updated.assigneeId !== user.id) {
      await this.notifications.notify({
        userIds: [updated.assigneeId],
        kind: "TUGAS",
        text: `Task ditugaskan ke Anda: ${updated.name}`,
        href: `/projects/${updated.projectId}/tasks/${id}`,
      });
    }
    await this.projects.recomputeProgress(updated.projectId);
    return updated;
  }

  /** PRD #2 (status manual) — DONE otomatis progres 100. */
  async setStatus(id: number, dto: TaskStatusDto, user: RequestUser) {
    const task = await this.prisma.main.task.findUnique({ where: { id }, include: { project: true } });
    if (!task) throw new NotFoundException("Task tidak ditemukan");
    if (!(await this.canModify(task.assigneeId, task.project.picId, user))) {
      throw new ForbiddenException("Anda hanya boleh mengubah status task milik Anda sendiri");
    }
    const progress = dto.status === "DONE" ? 100 : (dto.progress ?? task.progress);
    const updated = await this.prisma.main.task.update({
      where: { id },
      data: { status: dto.status, progress },
      include: { assignee: { select: { id: true, name: true, role: true } } },
    });
    await this.audit.log({
      actor: user,
      action: "UBAH_STATUS_TASK",
      entityType: "task",
      entityId: id,
      detail: `${task.name}: ${task.status} → ${dto.status} (${progress}%)${dto.note ? ` — ${dto.note}` : ""}`,
    });
    if (task.project.picId !== user.id && (dto.status === "DONE" || dto.status === "BLOCKED")) {
      await this.notifications.notify({
        userIds: [task.project.picId],
        kind: "TUGAS",
        text: `Task ${dto.status}: ${task.name} (${task.project.name})`,
        href: `/projects/${task.projectId}/tasks/${id}`,
      });
    }
    await this.projects.recomputeProgress(task.projectId);
    return updated;
  }

  /** PRD #17: Admin memindahkan task ke orang lain. */
  async reassign(id: number, dto: AssignDto, user: RequestUser) {
    if (!["ADMIN", "BOS"].includes(user.role)) {
      throw new ForbiddenException("Hanya Admin atau Bos yang boleh memindahkan task");
    }
    const task = await this.prisma.main.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException("Task tidak ditemukan");
    const target = await this.assertAssignee(dto.userId);
    const updated = await this.prisma.main.task.update({
      where: { id },
      data: { assigneeId: dto.userId },
      include: { assignee: { select: { id: true, name: true, role: true } } },
    });
    await this.audit.log({
      actor: user,
      action: "REASSIGN_TASK",
      entityType: "task",
      entityId: id,
      detail: `${task.name} → ${target.name}`,
    });
    if (dto.userId !== user.id) {
      await this.notifications.notify({
        userIds: [dto.userId],
        kind: "TUGAS",
        text: `Task dipindahkan ke Anda: ${task.name}`,
        href: `/projects/${task.projectId}/tasks/${id}`,
      });
    }
    return updated;
  }

  private async canModify(assigneeId: number | null, picId: number, user: RequestUser) {
    if (MANAGER_ROLES.includes(user.role) || picId === user.id) return true;
    return assigneeId === user.id;
  }

  private async attachFiles(taskId: number, dto: TaskDto) {
    const map: [number | undefined, string][] = [
      [dto.bahpFileId, "task-bahp"],
      [dto.bastFileId, "task-bast"],
      [dto.doFileId, "task-do"],
    ];
    for (const [fileId, refType] of map) {
      if (fileId) {
        await this.prisma.main.file.update({ where: { id: fileId }, data: { refType, refId: String(taskId) } });
      }
    }
  }
}
