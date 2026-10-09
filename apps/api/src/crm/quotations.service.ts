import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { DocumentNumberService } from "../document-number/document-number.service.js";
import { ApprovalsService } from "../approvals/approvals.service.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip } from "../common/utils/query.js";
import type { ApprovalStatus } from "../generated/prisma/client.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { QuotationDto, VersionDto } from "./dto.js";

const MANUAL_STATUSES = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "SENT", "NEGOTIATION", "EXPIRED"];

@Injectable()
export class QuotationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly docnum: DocumentNumberService,
    private readonly approvals: ApprovalsService,
  ) {
    this.approvals.onChange("PENAWARAN", (entityId, status) =>
      this.onApprovalDecision(entityId, status),
    );
  }

  private isExpired(validUntil: Date | null): boolean {
    if (!validUntil) return false;
    const end = new Date(validUntil);
    end.setHours(23, 59, 59, 999);
    return end.getTime() < Date.now();
  }

  private shape<T extends { status: string; validUntil: Date | null }>(row: T): T & { status: string } {
    if (row.status !== "NOT_YET" && this.isExpired(row.validUntil)) {
      return { ...row, status: "EXPIRED" };
    }
    return row;
  }

  async list(q: PageQuery & { status?: string; leadId?: number; ownerId?: number }) {
    const where = {
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.leadId ? { leadId: q.leadId } : {}),
      ...(q.ownerId ? { ownerId: q.ownerId } : {}),
      ...(q.q
        ? {
            OR: [
              { number: { contains: q.q } },
              { lead: { name: { contains: q.q } } },
              { customer: { name: { contains: q.q } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.main.quotation.findMany({
        where,
        include: {
          lead: { select: { id: true, name: true, stage: true } },
          customer: { select: { id: true, name: true } },
          owner: { select: { id: true, name: true } },
          _count: { select: { versions: true, clientPOs: true } },
        },
        orderBy: orderBy(q.sort, q.dir, ["number", "createdAt"], "createdAt"),
        ...pageSkip(q),
      }),
      this.prisma.main.quotation.count({ where }),
    ]);
    const items = rows.map((r) => this.shape(r));
    return paginate(items, total, q);
  }

  async get(id: number) {
    const row = await this.prisma.main.quotation.findUnique({
      where: { id },
      include: {
        lead: { select: { id: true, name: true, stage: true } },
        customer: true,
        owner: { select: { id: true, name: true } },
        versions: { orderBy: { version: "desc" } },
        clientPOs: true,
        followUps: { orderBy: { date: "desc" } },
      },
    });
    if (!row) throw new NotFoundException("Penawaran tidak ditemukan");
    const approval = await this.approvals.getFor("PENAWARAN", id);
    const files = await this.prisma.main.file.findMany({
      where: { refType: "quotation", refId: String(id) },
      select: { id: true, originalName: true, mimeType: true, size: true, kind: true, createdAt: true },
    });
    return { ...this.shape(row), approval, files };
  }

  /** Baris penawaran untuk lead (dibuat otomatis saat Qualification). */
  async createForLead(leadId: number, user: RequestUser) {
    const lead = await this.prisma.main.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException("Lead tidak ditemukan");

    const existing = await this.prisma.main.quotation.findFirst({ where: { leadId } });
    if (existing) return existing;

    const number = await this.docnum.next("penawaran");
    const row = await this.prisma.main.quotation.create({
      data: { number, leadId, customerId: lead.customerId, ownerId: lead.owner_id, status: "NOT_YET" },
    });
    await this.audit.log({
      actor: user,
      action: "BUAT_PENAWARAN",
      entityType: "quotation",
      entityId: row.id,
      detail: `${row.number} — ${lead.name}`,
    });
    return row;
  }

  /** Isi detail penawaran (nilai, tanggal berlaku, file). */
  async fill(id: number, dto: QuotationDto, user: RequestUser) {
    const row = await this.getEditable(id, user);
    const data = {
      ...(dto.customerId !== undefined ? { customerId: dto.customerId } : {}),
      ...(dto.validUntil !== undefined ? { validUntil: new Date(dto.validUntil) } : {}),
      ...(dto.total !== undefined ? { total: dto.total } : {}),
      ...(dto.ppn !== undefined ? { ppn: dto.ppn } : {}),
      ...(dto.discount !== undefined ? { discount: dto.discount } : {}),
      ...(dto.grandTotal !== undefined ? { grandTotal: dto.grandTotal } : {}),
      ...(row.status === "NOT_YET" ? { status: "DRAFT" as const } : {}),
    };
    const updated = await this.prisma.main.quotation.update({
      where: { id },
      data,
      include: { lead: { select: { id: true, name: true } } },
    });
    if (dto.fileId) await this.attachFile(id, dto.fileId);
    await this.audit.log({
      actor: user,
      action: "ISI_PENAWARAN",
      entityType: "quotation",
      entityId: id,
      detail: `${updated.number} total=${updated.grandTotal}`,
    });
    return updated;
  }

  private async getEditable(id: number, user: RequestUser) {
    const row = await this.prisma.main.quotation.findUnique({
      where: { id },
      include: { lead: true },
    });
    if (!row) throw new NotFoundException("Penawaran tidak ditemukan");
    if (["ADMIN", "PM"].includes(user.role) || row.ownerId === user.id) return row;
    throw new ForbiddenException("Hanya pemilik penawaran, PM, atau Admin yang boleh mengubahnya");
  }

  /** Ajukan ke persetujuan Finance/Bos (PRD #14). */
  async submit(id: number, user: RequestUser) {
    const row = await this.getEditable(id, user);
    const file = await this.prisma.main.file.findFirst({
      where: { refType: "quotation", refId: String(id) },
    });
    if (!file) throw new BadRequestException("File penawaran wajib diunggah sebelum diajukan");

    const updated = await this.prisma.main.quotation.update({
      where: { id },
      data: { status: "PENDING_APPROVAL" },
    });
    await this.approvals.request({
      kind: "PENAWARAN",
      entityId: id,
      title: `Penawaran ${row.number}${row.lead ? ` — ${row.lead.name}` : ""}`,
      amount: Number(row.grandTotal),
      requestedBy: user,
      href: `/quotations/${id}`,
    });
    await this.audit.log({
      actor: user,
      action: "AJUKAN_PENAWARAN",
      entityType: "quotation",
      entityId: id,
      detail: row.number,
    });
    return updated;
  }

  /** Kirim ke client — wajib sudah disetujui Finance/Bos dan ada file. */
  async send(id: number, user: RequestUser) {
    const row = await this.getEditable(id, user);
    const approval = await this.approvals.getFor("PENAWARAN", id);
    if (!approval || approval.status !== "DISETUJUI") {
      throw new BadRequestException("Penawaran harus disetujui Finance atau Bos sebelum dikirim");
    }
    const updated = await this.prisma.main.quotation.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date() },
    });
    await this.audit.log({
      actor: user,
      action: "KIRIM_PENAWARAN",
      entityType: "quotation",
      entityId: id,
      detail: row.number,
    });
    return updated;
  }

  /** Status diubah manual dan boleh loncat (PRD #2) — selalu dicatat. */
  async setStatus(id: number, status: string, user: RequestUser) {
    if (!MANUAL_STATUSES.includes(status)) {
      throw new BadRequestException(`Status tidak dikenal: ${status}`);
    }
    const row = await this.getEditable(id, user);
    if (status === "SENT") return this.send(id, user);

    const updated = await this.prisma.main.quotation.update({
      where: { id },
      data: { status: status as never, ...(status === "SENT" ? { sentAt: new Date() } : {}) },
    });
    await this.audit.log({
      actor: user,
      action: "UBAH_STATUS_PENAWARAN",
      entityType: "quotation",
      entityId: id,
      detail: `${row.number}: ${row.status} → ${status}`,
    });
    return updated;
  }

  /** Revisi = versi baru, riwayat tidak boleh hilang (PRD #14). */
  async addVersion(id: number, dto: VersionDto, user: RequestUser) {
    const row = await this.getEditable(id, user);
    const version = row.currentVersion + 1;
    await this.prisma.main.quotationVersion.create({
      data: {
        quotationId: id,
        version,
        fileId: dto.fileId,
        total: dto.total ?? row.total,
        ppn: dto.ppn ?? row.ppn,
        discount: dto.discount ?? row.discount,
        grandTotal: dto.grandTotal ?? row.grandTotal,
        note: dto.note,
        createdById: user.id,
      },
    });
    const updated = await this.prisma.main.quotation.update({
      where: { id },
      data: {
        currentVersion: version,
        total: dto.total ?? row.total,
        ppn: dto.ppn ?? row.ppn,
        discount: dto.discount ?? row.discount,
        grandTotal: dto.grandTotal ?? row.grandTotal,
        ...(row.status === "NOT_YET" ? { status: "DRAFT" } : {}),
      },
      include: { versions: { orderBy: { version: "desc" } } },
    });
    await this.attachFile(id, dto.fileId);
    await this.audit.log({
      actor: user,
      action: "REVISI_PENAWARAN",
      entityType: "quotation",
      entityId: id,
      detail: `${row.number} v${version}`,
    });
    return updated;
  }

  private async attachFile(quotationId: number, fileId: number) {
    await this.prisma.main.file.update({
      where: { id: fileId },
      data: { refType: "quotation", refId: String(quotationId) },
    });
  }

  private async onApprovalDecision(entityId: number, status: ApprovalStatus) {
    const row = await this.prisma.main.quotation.findUnique({ where: { id: entityId } });
    if (!row || row.status !== "PENDING_APPROVAL") return;
    const next = status === "DISETUJUI" ? "APPROVED" : "REJECTED";
    await this.prisma.main.quotation.update({ where: { id: entityId }, data: { status: next } });
    await this.notifications.notify({
      userIds: [row.ownerId],
      kind: "APPROVAL",
      text: `Penawaran ${row.number}: ${next === "APPROVED" ? "disetujui Finance" : "ditolak"}`,
      href: `/quotations/${entityId}`,
    });
  }

  /** Nomor otomatis untuk pratinjau form. */
  suggestNumber() {
    return this.docnum.suggest("penawaran");
  }

  async assertUniqueNumber(value: string, excludeId?: number) {
    const dup = await this.prisma.main.quotation.findFirst({
      where: { number: value, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    });
    if (dup) throw new ConflictException(`Nomor ${value} sudah dipakai`);
  }
}
