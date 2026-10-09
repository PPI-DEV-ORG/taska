import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { ApprovalsService } from "../approvals/approvals.service.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip } from "../common/utils/query.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { SurveyDto, SurveyStatusDto } from "./dto.js";

const MEMBER_ROLES = ["PM", "TEKNISI", "SE"];

@Injectable()
export class SurveysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly approvals: ApprovalsService,
  ) {
    this.approvals.onChange("PERMINTAAN_SURVEY", (entityId, status) =>
      this.onApprovalDecision(entityId, status),
    );
  }

  private async assertLeadExists(leadId: number) {
    const lead = await this.prisma.main.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException("Lead tidak ditemukan");
    return lead;
  }

  async list(q: PageQuery & { status?: string; leadId?: number }, user: RequestUser) {
    const scope =
      ["BOS", "ADMIN", "PM"].includes(user.role)
        ? {}
        : ["TEKNISI", "SE"].includes(user.role)
          ? { members: { some: { userId: user.id } } }
          : { requestedById: user.id };

    const where = {
      ...scope,
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.leadId ? { leadId: q.leadId } : {}),
      ...(q.q ? { OR: [{ location: { contains: q.q } }, { need: { contains: q.q } }, { lead: { name: { contains: q.q } } }] } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.main.survey.findMany({
        where,
        include: {
          lead: { select: { id: true, name: true, customer: { select: { name: true } } } },
          requester: { select: { id: true, name: true, role: true } },
          members: { include: { user: { select: { id: true, name: true, role: true } } } },
        },
        orderBy: orderBy(q.sort, q.dir, ["scheduleAt", "createdAt"], "createdAt"),
        ...pageSkip(q),
      }),
      this.prisma.main.survey.count({ where }),
    ]);
    return paginate(items, total, q);
  }

  async get(id: number) {
    const survey = await this.prisma.main.survey.findUnique({
      where: { id },
      include: {
        lead: { select: { id: true, name: true, customer: { select: { id: true, name: true } } } },
        requester: { select: { id: true, name: true, role: true } },
        approver: { select: { id: true, name: true } },
        members: { include: { user: { select: { id: true, name: true, role: true } } } },
        expenses: true,
      },
    });
    if (!survey) throw new NotFoundException("Survey tidak ditemukan");
    const files = await this.prisma.main.file.findMany({
      where: { refType: "survey", refId: String(id) },
      select: { id: true, originalName: true, mimeType: true, size: true, kind: true, createdAt: true },
    });
    const approval = await this.approvals.getFor("PERMINTAAN_SURVEY", id);
    return { ...survey, files, approval };
  }

  async create(dto: SurveyDto, user: RequestUser) {
    if (!["SALES", "PM", "ADMIN"].includes(user.role)) {
      throw new ForbiddenException("Peran Anda tidak boleh membuat permintaan survey");
    }
    const lead = await this.assertLeadExists(dto.leadId);
    const isSales = user.role === "SALES";

    const memberIds = (dto.memberIds ?? []).filter((id) => id !== user.id);
    if (memberIds.length) {
      const members = await this.prisma.main.user.findMany({
        where: { id: { in: memberIds }, status: "AKTIF", role: { in: MEMBER_ROLES as never } },
        select: { id: true },
      });
      if (members.length !== memberIds.length) {
        throw new BadRequestException("Anggota tim survey harus berstatus aktif dan berperan PM/Teknisi/SE");
      }
    }

    const survey = await this.prisma.main.survey.create({
      data: {
        leadId: dto.leadId,
        location: dto.location,
        need: dto.need,
        notes: dto.notes,
        scheduleAt: dto.scheduleAt ? new Date(dto.scheduleAt) : undefined,
        cost: dto.cost ?? 0,
        status: isSales ? "DIMINTA" : dto.scheduleAt ? "DIJADWALKAN" : "BERJALAN",
        requestedById: user.id,
        members: { create: [{ userId: user.id }, ...memberIds.map((userId) => ({ userId }))] },
      },
      include: { members: { include: { user: { select: { id: true, name: true, role: true } } } } },
    });

    await this.audit.log({
      actor: user,
      action: "BUAT_SURVEY",
      entityType: "survey",
      entityId: survey.id,
      detail: `${lead.name} — ${dto.location}`,
    });

    if (isSales) {
      await this.approvals.request({
        kind: "PERMINTAAN_SURVEY",
        entityId: survey.id,
        title: `Permintaan survey: ${lead.name} (${dto.location})`,
        amount: 0,
        requestedBy: user,
        href: `/surveys/${survey.id}`,
      });
    } else {
      await this.notifications.notify({
        userIds: memberIds,
        kind: "LEAD",
        text: `Anda ditugaskan ke survey: ${lead.name} — ${dto.location}`,
        href: `/surveys/${survey.id}`,
      });
    }

    return survey;
  }

  async update(id: number, dto: SurveyDto | SurveyStatusDto | Record<string, unknown>, user: RequestUser) {
    const survey = await this.prisma.main.survey.findUnique({
      where: { id },
      include: { members: true },
    });
    if (!survey) throw new NotFoundException("Survey tidak ditemukan");

    const isMember = survey.members.some((m) => m.userId === user.id);
    const allowed = ["ADMIN", "PM", "BOS"].includes(user.role) || isMember;
    if (!allowed) throw new ForbiddenException("Anda tidak berkepentingan dengan survey ini");

    const payload = dto as Partial<SurveyDto> & Partial<SurveyStatusDto> & { memberIds?: number[] };

    if (payload.memberIds && ["ADMIN", "PM"].includes(user.role)) {
      const valid = await this.prisma.main.user.findMany({
        where: { id: { in: payload.memberIds }, status: "AKTIF", role: { in: MEMBER_ROLES as never } },
        select: { id: true },
      });
      if (valid.length !== payload.memberIds.length) {
        throw new BadRequestException("Anggota tim survey tidak valid");
      }
      await this.prisma.main.surveyMember.deleteMany({ where: { surveyId: id } });
      await this.prisma.main.surveyMember.createMany({
        data: payload.memberIds.map((userId) => ({ surveyId: id, userId })),
      });
      await this.notifications.notify({
        userIds: payload.memberIds,
        kind: "LEAD",
        text: `Anda ditugaskan ke survey #${id}`,
        href: `/surveys/${id}`,
      });
    }

    const updated = await this.prisma.main.survey.update({
      where: { id },
      data: {
        ...(payload.location ? { location: payload.location } : {}),
        ...(payload.need !== undefined ? { need: payload.need } : {}),
        ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
        ...(payload.scheduleAt !== undefined
          ? { scheduleAt: payload.scheduleAt ? new Date(payload.scheduleAt) : null }
          : {}),
        ...(payload.cost !== undefined ? { cost: payload.cost } : {}),
        ...(payload.status ? { status: payload.status } : {}),
      },
      include: {
        lead: { select: { id: true, name: true } },
        members: { include: { user: { select: { id: true, name: true, role: true } } } },
      },
    });

    if (payload.status && payload.status !== survey.status) {
      await this.audit.log({
        actor: user,
        action: "UBAH_STATUS_SURVEY",
        entityType: "survey",
        entityId: id,
        detail: `${survey.status} → ${payload.status}`,
      });
      await this.notifications.notify({
        userIds: [survey.requestedById],
        kind: "LEAD",
        text: `Survey "${updated.lead.name}" menjadi ${payload.status}`,
        href: `/surveys/${id}`,
      });
    }
    return updated;
  }

  /** Dipanggil ApprovalsService saat persetujuan permintaan survey berubah. */
  private async onApprovalDecision(entityId: number, status: string) {
    const survey = await this.prisma.main.survey.findUnique({
      where: { id: entityId },
      include: { lead: { select: { name: true } }, members: { select: { userId: true } } },
    });
    if (!survey) return;

    const next = status === "DISETUJUI" ? (survey.scheduleAt ? "DIJADWALKAN" : "BERJALAN") : "BATAL";
    if (survey.status !== "DIMINTA") return;

    await this.prisma.main.survey.update({ where: { id: entityId }, data: { status: next } });
    await this.notifications.notify({
      userIds: [survey.requestedById, ...survey.members.map((m) => m.userId)],
      kind: "LEAD",
      text: `Permintaan survey ${survey.lead.name}: ${status.toLowerCase()} → ${next}`,
      href: `/surveys/${entityId}`,
    });
  }

  /** Lampiran bukti (foto/dokumen laporan). */
  async attachFile(id: number, fileId: number, user: RequestUser) {
    const survey = await this.prisma.main.survey.findUnique({ where: { id } });
    if (!survey) throw new NotFoundException("Survey tidak ditemukan");
    const file = await this.prisma.main.file.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException("File tidak ditemukan");
    await this.prisma.main.file.update({
      where: { id: fileId },
      data: { refType: "survey", refId: String(id) },
    });
    await this.audit.log({
      actor: user,
      action: "LAMPIRAN_SURVEY",
      entityType: "survey",
      entityId: id,
      detail: file.originalName,
    });
    return { ok: true, fileId };
  }
}
