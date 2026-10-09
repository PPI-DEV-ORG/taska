import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { DocumentNumberService } from "../document-number/document-number.service.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip } from "../common/utils/query.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { LeadDto } from "./dto.js";

const STAGES = ["PROSPECTING", "QUALIFICATION", "PROPOSAL", "NEGOTIATION", "WON", "LOST"] as const;

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly docnum: DocumentNumberService,
  ) {}

  async list(q: PageQuery & { stage?: string; ownerId?: number; sourceId?: number; customerId?: number }) {
    const where = {
      ...(q.stage ? { stage: q.stage as never } : {}),
      ...(q.ownerId ? { owner_id: q.ownerId } : {}),
      ...(q.sourceId ? { sourceId: q.sourceId } : {}),
      ...(q.customerId ? { customerId: q.customerId } : {}),
      ...(q.q
        ? {
            OR: [
              { name: { contains: q.q } },
              { contactName: { contains: q.q } },
              { need: { contains: q.q } },
              { customer: { name: { contains: q.q } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.main.lead.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          source: { select: { id: true, name: true } },
          lostReason: { select: { id: true, name: true } },
          owner: { select: { id: true, name: true, role: true } },
          quotations: { select: { id: true, number: true, status: true } },
        },
        orderBy: orderBy(q.sort, q.dir, ["createdAt", "targetClosing", "stage"], "createdAt"),
        ...pageSkip(q),
      }),
      this.prisma.main.lead.count({ where }),
    ]);
    return paginate(items, total, q);
  }

  async get(id: number) {
    const lead = await this.prisma.main.lead.findUnique({
      where: { id },
      include: {
        customer: true,
        source: true,
        lostReason: true,
        owner: { select: { id: true, name: true, role: true } },
        followUps: { orderBy: { date: "desc" }, include: { creator: { select: { id: true, name: true } } } },
        surveys: { orderBy: { id: "desc" } },
        quotations: { orderBy: { id: "desc" } },
      },
    });
    if (!lead) throw new NotFoundException("Lead tidak ditemukan");
    return lead;
  }

  async create(dto: LeadDto, user: RequestUser) {
    const { ownerId, stage, ...rest } = dto;
    const targetStage = stage ?? "PROSPECTING";
    if (targetStage === "LOST" && !dto.lostReasonId) {
      throw new BadRequestException("Lead Lost wajib punya alasan dari daftar master");
    }

    const lead = await this.prisma.main.lead.create({
      data: {
        ...rest,
        stage: targetStage,
        owner_id: ownerId ?? user.id,
        targetClosing: dto.targetClosing ? new Date(dto.targetClosing) : undefined,
        lostReasonId: dto.lostReasonId,
      },
      include: { owner: { select: { id: true, name: true } } },
    });

    await this.ensureQuotation(lead.id, lead.customerId, lead.owner_id, lead.stage);
    await this.audit.log({
      actor: user,
      action: "BUAT_LEAD",
      entityType: "lead",
      entityId: lead.id,
      detail: `${lead.name} (${lead.stage})`,
    });
    if (lead.owner_id !== user.id) {
      await this.notifications.notify({
        userIds: [lead.owner_id],
        kind: "LEAD",
        text: `Lead baru ditugaskan ke Anda: ${lead.name}`,
        href: `/leads/${lead.id}`,
      });
    }
    return lead;
  }

  async update(id: number, dto: LeadDto, user: RequestUser) {
    const current = await this.prisma.main.lead.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Lead tidak ditemukan");

    if (current.owner_id !== user.id && !["ADMIN", "BOS", "PM"].includes(user.role)) {
      throw new ForbiddenException("Hanya pemilik lead atau Admin yang boleh mengubahnya");
    }
    if (dto.ownerId !== undefined && !["ADMIN", "BOS", "PM"].includes(user.role)) {
      throw new ForbiddenException("Hanya Admin yang boleh memindahkan kepemilikan lead");
    }

    const stage = dto.stage ?? (current.stage as (typeof STAGES)[number]);
    if (stage === "LOST" && !dto.lostReasonId && !current.lostReasonId) {
      throw new BadRequestException("Lead Lost wajib punya alasan dari daftar master");
    }
    if (stage === "WON" && current.stage !== "WON") {
      const po = await this.prisma.main.clientPO.findFirst({
        where: { quotation: { leadId: id } },
      });
      if (!po) throw new BadRequestException("Lead hanya bisa Won setelah PO client masuk");
    }

    const { ownerId, stage: _s, ...rest } = dto;
    const lead = await this.prisma.main.lead.update({
      where: { id },
      data: {
        ...rest,
        stage,
        ...(ownerId !== undefined ? { owner_id: ownerId } : {}),
        ...(dto.targetClosing !== undefined ? { targetClosing: new Date(dto.targetClosing) } : {}),
      },
      include: { owner: { select: { id: true, name: true } } },
    });

    await this.ensureQuotation(lead.id, lead.customerId, lead.owner_id, lead.stage);

    if (current.stage !== lead.stage) {
      await this.audit.log({
        actor: user,
        action: "UBAH_STAGE",
        entityType: "lead",
        entityId: id,
        detail: `${lead.name}: ${current.stage} → ${lead.stage}${dto.lostNote ? ` — ${dto.lostNote}` : ""}`,
      });
    }
    if (ownerId !== undefined && ownerId !== current.owner_id) {
      await this.notifications.notify({
        userIds: [ownerId],
        kind: "LEAD",
        text: `Lead dipindahkan ke Anda: ${lead.name}`,
        href: `/leads/${id}`,
      });
    }
    return lead;
  }

  /** Baris penawaran dibuat otomatis saat lead masuk Qualification (PRD). */
  private async ensureQuotation(leadId: number, customerId: number | null, ownerId: number, stage: string) {
    const idx = STAGES.indexOf(stage as (typeof STAGES)[number]);
    const active = stage === "LOST" || idx >= STAGES.indexOf("QUALIFICATION");
    if (!active) return null;

    const existing = await this.prisma.main.quotation.findFirst({ where: { leadId } });
    if (existing) return existing;

    const number = await this.docnum.next("penawaran");
    return this.prisma.main.quotation.create({
      data: { number, leadId, customerId, ownerId, status: "NOT_YET" },
    });
  }

  /** Reassign oleh Admin (PRD #17). */
  async reassign(id: number, ownerId: number, user: RequestUser) {
    if (!["ADMIN", "BOS"].includes(user.role)) {
      throw new ForbiddenException("Hanya Admin atau Bos yang boleh memindahkan kepemilikan");
    }
    const target = await this.prisma.main.user.findUnique({ where: { id: ownerId } });
    if (!target) throw new NotFoundException("Tujuan pemindahan tidak ditemukan");
    const lead = await this.prisma.main.lead.update({
      where: { id },
      data: { owner_id: ownerId },
      include: { owner: { select: { id: true, name: true } } },
    });
    await this.audit.log({
      actor: user,
      action: "REASSIGN_LEAD",
      entityType: "lead",
      entityId: id,
      detail: `${lead.name} → ${target.name}`,
    });
    await this.notifications.notify({
      userIds: [ownerId],
      kind: "LEAD",
      text: `Lead dipindahkan ke Anda: ${lead.name}`,
      href: `/leads/${id}`,
    });
    return lead;
  }
}
