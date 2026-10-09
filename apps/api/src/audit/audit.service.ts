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
          actorName: input.actor?.name ?? "sistem",
          action: input.action,
          entityType: input.entityType,
          entityId: String(input.entityId),
          detail: input.detail,
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
}
