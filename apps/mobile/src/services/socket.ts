import { io, type Socket } from "socket.io-client";
import { apiOrigin, getAccess, hydrateTokens } from "@/services/api";

export type WsDataChange = {
  module: string;
  action: "create" | "update" | "status" | "delete";
  id?: string | number;
  at?: string;
};

export type WsNotification = {
  id?: number;
  kind: string;
  title?: string;
  text: string;
  href: string;
  createdAt?: string;
};

type Handlers = {
  onDataChange: (c: WsDataChange) => void;
  onNotification: (n: WsNotification) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (e: unknown) => void;
};

let socket: Socket | null = null;

/** Koneksi WS realtime ke backend (path /api/ws, auth via JWT). */
export async function connectSocket(handlers: Handlers): Promise<() => void> {
  await hydrateTokens();
  const token = getAccess();
  if (!token) return () => {};

  // putuskan koneksi lama bila ada (single-socket policy)
  socket?.disconnect();
  socket = io(apiOrigin(), {
    path: "/api/ws",
    transports: ["websocket", "polling"],
    auth: (cb) => {
      cb({ token: getAccess() ?? token });
    },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  socket.on("connect", () => handlers.onConnect?.());
  socket.on("disconnect", () => handlers.onDisconnect?.());
  socket.on("connect_error", (e) => handlers.onError?.(e));
  socket.on("data-change", (c: WsDataChange) => handlers.onDataChange(c));
  socket.on("notification", (n: WsNotification) => handlers.onNotification(n));

  return () => {
    socket?.disconnect();
    socket = null;
  };
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
