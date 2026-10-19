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
    const role = (user.role || "").toUpperCase();
    const scope =
      ["SUPER_ADMIN", "BOS", "ADMIN", "PM", "FINANCE"].includes(role)
        ? {}
        : ["TEKNISI", "SE"].includes(role)
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
    let approval = await this.approvals.getFor("PERMINTAAN_SURVEY", id);
    if (!approval && survey.status === "DIMINTA") {
      const requester = (survey as any).requester ?? { id: survey.requestedById, name: "Staf", role: "SALES" };
      await this.approvals.request({
        kind: "PERMINTAAN_SURVEY",
        entityId: survey.id,
        title: `Permintaan survey: ${survey.lead.name} (${survey.location})`,
        amount: Number(survey.cost || 0),
        requestedBy: requester as any,
        href: `/surveys/${survey.id}`,
      });
      approval = await this.approvals.getFor("PERMINTAAN_SURVEY", id);
    }
    return { ...survey, files, approval };
  }

  async create(dto: SurveyDto, user: RequestUser) {
    if (!["SUPER_ADMIN", "SALES", "PM", "ADMIN", "BOS", "TEKNISI", "SE"].includes(user.role)) {
      throw new ForbiddenException("Peran Anda tidak boleh membuat permintaan survey");
    }
    const lead = dto.leadId
      ? await this.assertLeadExists(dto.leadId)
      : await this.prisma.main.lead.findFirst({ orderBy: { id: "desc" } });
    if (!lead) throw new NotFoundException("Lead tidak ditemukan");

    const isSales = user.role === "SALES";
    const location = dto.location || "-";

    const rawMemberIds = Array.from(new Set(dto.memberIds ?? []));
    let memberIds: number[] = [];
    if (rawMemberIds.length) {
      const members = await this.prisma.main.user.findMany({
        where: { id: { in: rawMemberIds }, status: "AKTIF" },
        select: { id: true },
      });
      memberIds = members.map((m) => m.id);
    }

    const survey = await this.prisma.main.survey.create({
      data: {
        leadId: lead.id,
        location,
        need: dto.need,
        notes: dto.notes,
        scheduleAt: dto.scheduleAt ? new Date(dto.scheduleAt) : undefined,
        cost: dto.cost ?? 0,
        status: dto.status ?? (isSales ? "DIMINTA" : dto.scheduleAt ? "DIJADWALKAN" : "BERJALAN"),
        requestedById: user.id,
        members: { create: memberIds.map((userId) => ({ userId })) },
      },
      include: {
        lead: { select: { id: true, name: true, customer: { select: { name: true } } } },
        requester: { select: { id: true, name: true, role: true } },
        members: { include: { user: { select: { id: true, name: true, role: true } } } },
      },
    });

    await this.audit.log({
      actor: user,
      action: "BUAT_SURVEY",
      entityType: "survey",
      entityId: survey.id,
      detail: `${lead.name} — ${location}`,
    });

    if (survey.status === "DIMINTA") {
      await this.approvals.request({
        kind: "PERMINTAAN_SURVEY",
        entityId: survey.id,
        title: `Permintaan survey: ${lead.name} (${location})`,
        amount: Number(survey.cost || 0),
        requestedBy: user,
        href: `/surveys/${survey.id}`,
      });
    } else if (memberIds.length) {
      await this.notifications.notify({
        userIds: memberIds,
        kind: "LEAD",
        text: `Anda ditugaskan ke survey: ${lead.name} — ${location}`,
        href: `/surveys/${survey.id}`,
      });
    }

    this.notifications.dataChange("surveys", "create", survey.id);
    return survey;
  }

  async update(id: number, dto: SurveyDto | SurveyStatusDto | Record<string, unknown>, user: RequestUser) {
    const survey = await this.prisma.main.survey.findUnique({
      where: { id },
      include: { members: true },
    });
    if (!survey) throw new NotFoundException("Survey tidak ditemukan");

    const isMember = survey.members.some((m) => m.userId === user.id);
    const role = (user.role || "").toUpperCase();
    const allowed = ["SUPER_ADMIN", "ADMIN", "PM", "BOS", "SALES", "TEKNISI", "SE", "FINANCE"].includes(role) || isMember || survey.requestedById === user.id;
    if (!allowed) throw new ForbiddenException("Anda tidak berkepentingan dengan survey ini");

    const payload = dto as Partial<SurveyDto> & Partial<SurveyStatusDto> & { memberIds?: number[] };

    if (payload.memberIds) {
      const valid = await this.prisma.main.user.findMany({
        where: { id: { in: payload.memberIds }, status: "AKTIF" },
        select: { id: true },
      });
      const validIds = valid.map((u) => u.id);
      if (validIds.length) {
        await this.prisma.main.surveyMember.deleteMany({ where: { surveyId: id } });
        await this.prisma.main.surveyMember.createMany({
          data: validIds.map((userId) => ({ surveyId: id, userId })),
        });
        await this.notifications.notify({
          userIds: validIds,
          kind: "LEAD",
          text: `Anda ditugaskan ke survey #${id}`,
          href: `/surveys/${id}`,
        });
      }
    }

    const updated = await this.prisma.main.survey.update({
      where: { id },
      data: {
        ...(payload.leadId ? { leadId: payload.leadId } : {}),
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

    const anyDto = dto as Record<string, any>;
    if (anyDto.evidenceFileId) {
      await this.prisma.main.file.update({
        where: { id: Number(anyDto.evidenceFileId) },
        data: { refType: "survey", refId: String(id), kind: "FOTO" },
      }).catch(() => {});
    }
    if (anyDto.documentFileId) {
      await this.prisma.main.file.update({
        where: { id: Number(anyDto.documentFileId) },
        data: { refType: "survey", refId: String(id), kind: "DOKUMEN" },
      }).catch(() => {});
    }
    if (anyDto.fileId && !anyDto.evidenceFileId && !anyDto.documentFileId) {
      await this.prisma.main.file.update({
        where: { id: Number(anyDto.fileId) },
        data: { refType: "survey", refId: String(id) },
      }).catch(() => {});
    }

    if (payload.status && payload.status !== survey.status) {
      if (survey.status === "DIMINTA" && (payload.status === "DIJADWALKAN" || payload.status === "BERJALAN" || payload.status === "BATAL")) {
        const app = await this.approvals.getFor("PERMINTAAN_SURVEY", id);
        if (app && app.status === "MENUNGGU") {
          try {
            await this.approvals.decide(app.id, user, payload.status !== "BATAL", payload.status === "BATAL" ? "Dibatalkan manual" : undefined);
          } catch {}
        }
      }
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
    this.notifications.dataChange("surveys", payload.status ? "status" : "update", updated.id);
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
    this.notifications.dataChange("surveys", "status", entityId);
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

  async remove(id: number, user: RequestUser) {
    const survey = await this.prisma.main.survey.findUnique({ where: { id } });
    if (!survey) throw new NotFoundException("Survey tidak ditemukan");
    await this.prisma.main.$transaction(async (tx) => {
      await tx.approval.deleteMany({ where: { kind: "PERMINTAAN_SURVEY", entityId: id } });
      await tx.surveyMember.deleteMany({ where: { surveyId: id } });
      await tx.survey.delete({ where: { id } });
    });
    await this.audit.log({
      actor: user,
      action: "HAPUS_SURVEY",
      entityType: "survey",
      entityId: id,
      detail: `Survey #${id} dihapus`,
    });
    this.notifications.dataChange("surveys", "delete", id);
    return { id, deleted: true };
  }
}
