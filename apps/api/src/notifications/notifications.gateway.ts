import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";

/** Notifikasi realtime — `id` = row persisted agar FE bisa tandai dibaca. */
export type WsNotification = {
  id: number;
  kind: string;
  title?: string;
  text: string;
  href: string;
  createdAt?: string;
};

/** Perubahan data realtime — dipakai frontend untuk refresh tabel. */
export type WsDataChange = {
  module: string;
  action: "create" | "update" | "status" | "delete";
  id?: string | number;
  at?: string;
};

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  path: "/api/ws",
})
export class NotificationsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const raw =
        (client.handshake.auth?.token as string | undefined) ||
        (client.handshake.query?.token as string | undefined) ||
        (client.handshake.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (!raw) throw new Error("token kosong");
      const payload = await this.jwt.verifyAsync(raw);
      const userId = Number(payload.sub);
      client.data.userId = userId;
      await client.join(this.room(userId));
      this.logger.debug(`client ${client.id} masuk room ${userId}`);
    } catch {
      this.logger.warn(`koneksi ws ditolak: ${client.id}`);
      client.disconnect(true);
    }
  }

  private room(userId: number): string {
    return `user:${userId}`;
  }

  push(userId: number, payload: WsNotification): void {
    this.server?.to(this.room(userId)).emit("notification", payload);
  }

  pushMany(userIds: number[], payload: WsNotification): void {
    for (const id of userIds) this.push(id, payload);
  }

  /** Broadcast perubahan data ke semua client yang terhubung (semua role). */
  dataChange(module: WsDataChange["module"], action: WsDataChange["action"], id?: string | number): void {
    const payload: WsDataChange = { module, action, id, at: new Date().toISOString() };
    this.server?.emit("data-change", payload);
  }
}
