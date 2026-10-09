import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip } from "../common/utils/query.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { FollowUpDto } from "./dto.js";

@Injectable()
export class FollowUpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q: PageQuery & { leadId?: number; quotationId?: number; status?: string }) {
    const where = {
      ...(q.leadId ? { leadId: q.leadId } : {}),
      ...(q.quotationId ? { quotationId: q.quotationId } : {}),
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.q ? { notes: { contains: q.q } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.main.followUp.findMany({
        where,
        include: {
          lead: { select: { id: true, name: true } },
          creator: { select: { id: true, name: true } },
        },
        orderBy: orderBy(q.sort, q.dir, ["date", "createdAt"], "date"),
        ...pageSkip(q),
      }),
      this.prisma.main.followUp.count({ where }),
    ]);
    return paginate(items, total, q);
  }

  async create(dto: FollowUpDto, user: RequestUser) {
    if (!dto.leadId && !dto.quotationId) {
      throw new NotFoundException("Follow-up harus tertaut ke lead atau penawaran");
    }
    const row = await this.prisma.main.followUp.create({
      data: {
        leadId: dto.leadId,
        quotationId: dto.quotationId,
        date: new Date(dto.date),
        method: dto.method,
        notes: dto.notes,
        nextDate: dto.nextDate ? new Date(dto.nextDate) : undefined,
        status: dto.status ?? "SELESAI",
        createdById: user.id,
      },
      include: { lead: { select: { id: true, name: true } } },
    });
    await this.audit.log({
      actor: user,
      action: "BUAT_FOLLOW_UP",
      entityType: "follow-up",
      entityId: row.id,
      detail: `${row.lead?.name ?? "-"} — ${dto.notes.slice(0, 120)}`,
    });
    return row;
  }

  async update(id: number, dto: FollowUpDto, user: RequestUser) {
    const row = await this.prisma.main.followUp.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Follow-up tidak ditemukan");
    if (row.createdById && row.createdById !== user.id && user.role !== "ADMIN") {
      throw new ForbiddenException("Hanya pencatat follow-up yang boleh mengubahnya");
    }
    const updated = await this.prisma.main.followUp.update({
      where: { id },
      data: {
        date: new Date(dto.date),
        method: dto.method,
        notes: dto.notes,
        nextDate: dto.nextDate ? new Date(dto.nextDate) : undefined,
        status: dto.status ?? row.status,
      },
      include: { lead: { select: { id: true, name: true } } },
    });
    await this.audit.log({
      actor: user,
      action: "UBAH_FOLLOW_UP",
      entityType: "follow-up",
      entityId: id,
      detail: updated.notes.slice(0, 120),
    });
    return updated;
  }
}
