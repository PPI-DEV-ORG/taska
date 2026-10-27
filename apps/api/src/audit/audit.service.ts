import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";

export type AuditInput = {
  actor?: RequestUser | null;
  action: string;
  entityType: string;
  entityId: string | number;
  detail?: string;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Catat aksi. Tidak pernah melempar — audit tidak boleh menjatuhkan request. */
  async log(input: AuditInput): Promise<void> {
    try {
      await this.prisma.main.auditLog.create({
        data: {
          actorId: input.actor?.id ?? null,
          actorName: (input.actor?.name ?? "sistem").slice(0, 191),
          action: (input.action ?? "").slice(0, 191),
          entityType: (input.entityType ?? "").slice(0, 191),
          entityId: String(input.entityId ?? "").slice(0, 191),
          detail: input.detail ? String(input.detail).slice(0, 191) : null,
        },
      });
    } catch (e) {
      this.logger.error(`Gagal menulis audit log: ${(e as Error).message}`);
    }
  }

  async list(opts: { page: number; limit: number; q?: string; entityType?: string; actorId?: number }) {
    const where = {
      ...(opts.entityType ? { entityType: opts.entityType } : {}),
      ...(opts.actorId ? { actorId: opts.actorId } : {}),
      ...(opts.q
        ? {
            OR: [
              { action: { contains: opts.q } },
              { entityType: { contains: opts.q } },
              { entityId: { contains: opts.q } },
              { detail: { contains: opts.q } },
              { actorName: { contains: opts.q } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.main.auditLog.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      this.prisma.main.auditLog.count({ where }),
    ]);
    return { items, total, page: opts.page, limit: opts.limit };
  }

  async forEntity(entityType: string, entityId: string | number) {
    const rawType = String(entityType).toLowerCase();
    const variants = new Set([
      rawType,
      rawType.replace(/s$/, ""),
      rawType + "s",
    ]);
    if (rawType.includes("pos") || rawType.includes("po")) {
      variants.add("supplier-pos");
      variants.add("supplierPO");
      variants.add("supplier-po");
      variants.add("client-po");
    }
    if (rawType.includes("note")) {
      variants.add("delivery-notes");
      variants.add("deliveryNote");
    }
    if (rawType.includes("request")) {
      variants.add("purchase-requests");
      variants.add("purchaseRequest");
    }

    return this.prisma.main.auditLog.findMany({
      where: {
        entityType: { in: Array.from(variants) },
        entityId: String(entityId),
      },
      orderBy: { id: "desc" },
      take: 100,
    });
  }
}
