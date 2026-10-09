import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { NotificationsGateway } from "./notifications.gateway.js";
import type { NotifKind, Role } from "../generated/prisma/client.js";

export type NotifyInput = {
  userIds?: number[];
  roles?: Role[];
  kind?: NotifKind;
  text: string;
  href: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async notify(input: NotifyInput): Promise<number> {
    const users = new Set<number>();

    if (input.userIds?.length) {
      for (const id of input.userIds) users.add(id);
    }
    if (input.roles?.length) {
      const rows = await this.prisma.main.user.findMany({
        where: { status: "AKTIF", role: { in: input.roles } },
        select: { id: true },
      });
      for (const r of rows) users.add(r.id);
    }
    if (!users.size) return 0;

    const payload = {
      kind: input.kind ?? ("LAINNYA" as NotifKind),
      text: input.text,
      href: input.href,
    };

    await this.prisma.main.notification.createMany({
      data: [...users].map((userId) => ({ userId, ...payload })),
    });

    for (const userId of users) this.gateway.push(userId, payload);
    this.logger.debug(`notifikasi dikirim ke ${users.size} pengguna`);
    return users.size;
  }

  async list(userId: number, opts: { page: number; limit: number; unread?: boolean }) {
    const where = { userId, ...(opts.unread ? { read: false } : {}) };
    const [items, total, unread] = await Promise.all([
      this.prisma.main.notification.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      this.prisma.main.notification.count({ where }),
      this.prisma.main.notification.count({ where: { userId, read: false } }),
    ]);
    return { items, total, unread, page: opts.page, limit: opts.limit };
  }

  async unreadCount(userId: number) {
    return { unread: await this.prisma.main.notification.count({ where: { userId, read: false } }) };
  }

  async markRead(userId: number, ids?: number[]) {
    if (ids?.length) {
      await this.prisma.main.notification.updateMany({
        where: { userId, id: { in: ids } },
        data: { read: true },
      });
    } else {
      await this.prisma.main.notification.updateMany({ where: { userId }, data: { read: true } });
    }
    return this.unreadCount(userId);
  }
}
