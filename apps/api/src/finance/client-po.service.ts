import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { DocumentNumberService } from "../document-number/document-number.service.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip } from "../common/utils/query.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { ClientPoDto } from "./dto.js";

@Injectable()
export class ClientPoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly docnum: DocumentNumberService,
  ) {}

  async list(q: PageQuery & { customerId?: number; from?: string; to?: string }) {
    const where = {
      ...(q.customerId ? { customerId: q.customerId } : {}),
      ...(q.from || q.to
        ? {
            date: {
              ...(q.from ? { gte: new Date(q.from) } : {}),
              ...(q.to ? { lte: new Date(q.to) } : {}),
            },
          }
        : {}),
      ...(q.q
        ? {
            OR: [
              { number: { contains: q.q } },
              { customer: { name: { contains: q.q } } },
              { notes: { contains: q.q } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.main.clientPO.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          quotation: { select: { id: true, number: true } },
          _count: { select: { invoices: true } },
        },
        orderBy: orderBy(q.sort, q.dir, ["date", "createdAt"], "date"),
        ...pageSkip(q),
      }),
      this.prisma.main.clientPO.count({ where }),
    ]);
    return paginate(items, total, q);
  }

  async get(id: number) {
    const row = await this.prisma.main.clientPO.findUnique({
      where: { id },
      include: { customer: true, quotation: { select: { id: true, number: true } }, invoices: true },
    });
    if (!row) throw new NotFoundException("PO client tidak ditemukan");
    return row;
  }

  async create(dto: ClientPoDto, user: RequestUser) {
    const number = dto.number?.trim() || (await this.docnum.next("clientPO"));
    await this.docnum.assertUnique(number, async (v) => !!(await this.prisma.main.clientPO.findFirst({ where: { number: v } })));
    if (!dto.fileId) throw new BadRequestException("File PO client wajib diunggah (bukti wajib)");

    const customer = await this.prisma.main.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer) throw new NotFoundException("Customer tidak ditemukan");

    const row = await this.prisma.main.clientPO.create({
      data: {
        number,
        customerId: dto.customerId,
        quotationId: dto.quotationId,
        amount: dto.amount,
        date: new Date(dto.date),
        notes: dto.notes,
      },
      include: { customer: true },
    });
    if (dto.fileId) {
      await this.prisma.main.file.update({
        where: { id: dto.fileId },
        data: { refType: "clientPo", refId: String(row.id) },
      });
    }
    await this.audit.log({
      actor: user,
      action: "BUAT_PO_CLIENT",
      entityType: "client-po",
      entityId: row.id,
      detail: `${number} Rp${dto.amount} — ${customer.name}`,
    });
    return row;
  }

  async update(id: number, dto: ClientPoDto, user: RequestUser) {
    const row = await this.get(id);
    if (dto.number && dto.number !== row.number) {
      await this.docnum.assertUnique(dto.number, async (v) => !!(await this.prisma.main.clientPO.findFirst({ where: { number: v, NOT: { id } } })));
    }
    const updated = await this.prisma.main.clientPO.update({
      where: { id },
      data: {
        ...(dto.number ? { number: dto.number } : {}),
        customerId: dto.customerId,
        quotationId: dto.quotationId ?? row.quotationId,
        amount: dto.amount,
        date: new Date(dto.date),
        notes: dto.notes ?? row.notes,
      },
      include: { customer: true },
    });
    if (dto.fileId) {
      await this.prisma.main.file.update({
        where: { id: dto.fileId },
        data: { refType: "clientPo", refId: String(id) },
      });
    }
    await this.audit.log({
      actor: user,
      action: "UBAH_PO_CLIENT",
      entityType: "client-po",
      entityId: id,
      detail: `${updated.number} Rp${updated.amount}`,
    });
    return updated;
  }

  suggestNumber() {
    return this.docnum.suggest("clientPO");
  }
}
