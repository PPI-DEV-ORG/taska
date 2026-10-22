import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { ProjectsService } from "./projects.service.js";
import { AssignDto, TaskDto, TaskStatusDto } from "./dto.js";

const MANAGER_ROLES = ["PM", "ADMIN", "BOS", "SUPER_ADMIN"];
const ASSIGNEE_ROLES = ["PM", "SE", "TEKNISI", "SUPER_ADMIN"];

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

  async tree(projectId: number, _user: RequestUser) {
    await this.projectOf(projectId);
    const rows = await this.prisma.main.task.findMany({
      where: { projectId },
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, role: true } },
      },
      orderBy: { id: "asc" as const },
    });
    const ordered: typeof rows = [];
    const visited = new Set<number>();
    const walk = (parentId: number | null) => {
      for (const r of rows) {
        if (r.parentId === parentId && !visited.has(r.id)) {
          visited.add(r.id);
          ordered.push(r);
          walk(r.id);
        }
      }
    };
    walk(null);
    for (const r of rows) {
      if (!visited.has(r.id)) ordered.push(r);
    }
    return { projectId, items: ordered, total: ordered.length };
  }

  async listAll(user: RequestUser) {
    const isManager = MANAGER_ROLES.includes(user.role);
    const where = isManager
      ? {}
      : {
          OR: [
            { assigneeId: user.id },
            { project: { picId: user.id } },
            { project: { members: { some: { userId: user.id } } } },
          ],
        };
    const rows = await this.prisma.main.task.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, picId: true } },
        assignee: { select: { id: true, name: true, role: true } },
        parent: { select: { id: true, name: true } },
      },
      orderBy: [{ projectId: "desc" }, { id: "asc" }],
      take: 500,
    });
    return { items: rows, total: rows.length };
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
      !["SUPER_ADMIN", "ADMIN", "BOS", "PM"].includes(user.role) &&
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
    return user;
  }

  async create(projectId: number, dto: TaskDto, user: RequestUser) {
    const project = await this.projectOf(projectId);
    await this.assertParent(projectId, dto.parentId);
    if (dto.assigneeId !== undefined) await this.assertAssignee(dto.assigneeId);

    const task = await this.prisma.main.task.create({
      data: {
        projectId,
        parentId: dto.parentId,
        name: dto.name || "Tugas Baru",
        description: dto.description ?? null,
        assigneeId: dto.assigneeId ?? user.id,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        priority: dto.priority,
        status: dto.status ?? "TODO",
        progress: dto.status === "DONE" ? 100 : (dto.progress ?? 0),
        needsPurchase: dto.needsPurchase ?? false,
        bahpFileId: dto.bahpFileId,
        bastFileId: dto.bastFileId,
        doFileId: dto.doFileId,
      },
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, role: true } },
      },
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
    this.notifications.dataChange("tasks", "create", task.id);
    this.notifications.dataChange("projects", "update", projectId);
    return task;
  }

  async update(id: number, dto: TaskDto, user: RequestUser) {
    const task = await this.prisma.main.task.findUnique({ where: { id }, include: { project: true } });
    if (!task) throw new NotFoundException("Task tidak ditemukan");
    await this.assertParent(task.projectId, dto.parentId ?? null);
    if (dto.parentId === id) throw new BadRequestException("Task tidak bisa jadi induk dirinya sendiri");
    if (dto.assigneeId !== undefined && dto.assigneeId !== task.assigneeId) {
      await this.assertAssignee(dto.assigneeId);
    }

    const nextProgress =
      dto.progress !== undefined
        ? dto.progress
        : dto.status === "DONE"
          ? 100
          : dto.status === "IN_PROGRESS" && task.progress === 100
            ? 50
            : dto.status === "TODO"
              ? 0
              : task.progress;

    const updated = await this.prisma.main.task.update({
      where: { id },
      data: {
        name: dto.name ?? task.name,
        description: dto.description !== undefined ? dto.description : task.description,
        parentId: dto.parentId !== undefined ? dto.parentId : task.parentId,
        assigneeId: dto.assigneeId !== undefined ? dto.assigneeId : task.assigneeId,
        dueDate: dto.dueDate !== undefined ? (dto.dueDate ? new Date(dto.dueDate) : null) : task.dueDate,
        priority: dto.priority ?? task.priority,
        ...(dto.status ? { status: dto.status } : {}),
        progress: nextProgress,
        needsPurchase: dto.needsPurchase ?? task.needsPurchase,
        bahpFileId: dto.bahpFileId ?? task.bahpFileId,
        bastFileId: dto.bastFileId ?? task.bastFileId,
        doFileId: dto.doFileId ?? task.doFileId,
      },
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, role: true } },
      },
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
    this.notifications.dataChange("tasks", "update", updated.id);
    this.notifications.dataChange("projects", "update", updated.projectId);
    return updated;
  }

  /** PRD #2 (status manual) — DONE otomatis progres 100. */
  async setStatus(id: number, dto: TaskStatusDto, user: RequestUser) {
    const task = await this.prisma.main.task.findUnique({ where: { id }, include: { project: true } });
    if (!task) throw new NotFoundException("Task tidak ditemukan");
    const progress = dto.status === "DONE" ? 100 : (dto.progress ?? task.progress);
    const updated = await this.prisma.main.task.update({
      where: { id },
      data: { status: dto.status, progress },
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, role: true } },
      },
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
    this.notifications.dataChange("tasks", "status", updated.id);
    this.notifications.dataChange("projects", "update", task.projectId);
    return updated;
  }

  /** PRD #17: Admin memindahkan task ke orang lain. */
  async reassign(id: number, dto: AssignDto, user: RequestUser) {
    if (!["SUPER_ADMIN", "ADMIN", "BOS", "PM"].includes(user.role)) {
      throw new ForbiddenException("Hanya Admin, Bos, atau PM yang boleh memindahkan task");
    }
    const task = await this.prisma.main.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException("Task tidak ditemukan");
    const target = await this.assertAssignee(dto.userId);
    const updated = await this.prisma.main.task.update({
      where: { id },
      data: { assigneeId: dto.userId },
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, role: true } },
      },
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
    this.notifications.dataChange("tasks", "update", updated.id);
    return updated;
  }

  async remove(id: number, _user: RequestUser) {
    const task = await this.prisma.main.task.findUnique({ where: { id }, include: { project: true } });
    if (!task) throw new NotFoundException("Task tidak ditemukan");
    await this.prisma.main.$transaction(async (tx) => {
      await tx.projectRequirement.updateMany({ where: { taskId: id }, data: { taskId: null } });
      await tx.task.updateMany({ where: { parentId: id }, data: { parentId: task.parentId } });
      await tx.task.delete({ where: { id } });
    });
    await this.projects.recomputeProgress(task.projectId);
    this.notifications.dataChange("tasks", "delete", id);
    this.notifications.dataChange("projects", "update", task.projectId);
    return { id, deleted: true };
  }

  private async canModify(_assigneeId: number | null, _picId: number, _user: RequestUser) {
    return true;
  }

  private async attachFiles(taskId: number, dto: TaskDto) {
    const map: [number | undefined, string][] = [
      [dto.bahpFileId, "task-bahp"],
      [dto.bastFileId, "task-bast"],
      [dto.doFileId, "task-do"],
    ];
    for (const [fileId, refType] of map) {
      if (fileId) {
        await this.prisma.main.file.update({ where: { id: fileId }, data: { refType, refId: String(taskId) } }).catch(() => {});
      }
    }
  }
}
