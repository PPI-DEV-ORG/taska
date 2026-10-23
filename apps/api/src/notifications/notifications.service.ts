import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { NotificationsGateway } from "./notifications.gateway.js";
import type { NotifKind, Role } from "../generated/prisma/client.js";

export type NotifyInput = {
  userIds?: number[];
  roles?: Role[];
  kind?: NotifKind;
  title?: string;
  text: string;
  href: string;
};

const KIND_TITLE: Record<string, string> = {
  APPROVAL: "Persetujuan Dokumen",
  STOK: "Update Stok & Gudang",
  PENGIRIMAN: "Update Pengiriman",
  LEAD: "Prospek & Penawaran",
  TUGAS: "Tugas & Project",
  SURAT: "Surat Jalan & Dokumen",
  LAINNYA: "Notifikasi Taska ERP",
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
      const targetRoles = Array.from(
        new Set<Role>([...input.roles, "SUPER_ADMIN" as Role, "ADMIN" as Role]),
      );
      const rows = await this.prisma.main.user.findMany({
        where: { status: "AKTIF", role: { in: targetRoles } },
        select: { id: true },
      });
      for (const r of rows) users.add(r.id);
    }
    if (!users.size) return 0;

    const kind = input.kind ?? ("LAINNYA" as NotifKind);
    const title = input.title ?? KIND_TITLE[kind] ?? "Notifikasi Taska ERP";
    const createdAt = new Date().toISOString();

    const rows = await this.prisma.main.$transaction(
      [...users].map((userId) =>
        this.prisma.main.notification.create({
          data: { userId, kind, text: input.text, href: input.href },
          select: { id: true },
        }),
      ),
    );

    let i = 0;
    for (const userId of users) {
      const id = rows[i++]?.id;
      if (id == null) continue;
      this.gateway.push(userId, {
        id,
        kind,
        title,
        text: input.text,
        href: input.href,
        createdAt,
      });
    }
    this.logger.debug(`notifikasi dikirim ke ${users.size} pengguna`);
    return users.size;
  }

  /**
   * Broadcast perubahan data realtime ke semua client.
   * Dipanggil dari service setelah create/update/status/delete agar tabel di FE ikut ter-update.
   */
  dataChange(module: string, action: "create" | "update" | "status" | "delete", id?: number | string): void {
    this.gateway.dataChange(module, action, id);
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
