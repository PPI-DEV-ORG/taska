import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NotificationsService } from "./notifications.service.js";

describe("NotificationsService (Expo Push)", () => {
  let service: NotificationsService;
  let prisma: any;
  let gateway: any;

  beforeEach(() => {
    prisma = {
      main: {
        userPushToken: {
          upsert: vi.fn().mockResolvedValue({ id: 1 }),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
          findMany: vi.fn().mockResolvedValue([]),
        },
        notification: {
          create: vi.fn().mockResolvedValue({ id: 42 }),
        },
        $transaction: vi.fn(async (ops: any[]) => Promise.all(ops)),
      },
    };
    gateway = {
      push: vi.fn(),
      dataChange: vi.fn(),
    };
    service = new NotificationsService(prisma, gateway);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers and unregisters Expo push tokens cleanly", async () => {
    await service.registerPushToken(5, "ExponentPushToken[abc123]", "android", "Pixel 8");
    expect(prisma.main.userPushToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token: "ExponentPushToken[abc123]" },
      }),
    );

    await service.unregisterPushToken(5, "ExponentPushToken[abc123]");
    expect(prisma.main.userPushToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 5, token: "ExponentPushToken[abc123]" },
    });
  });

  it("prunes DeviceNotRegistered tokens returned by Expo Push API", async () => {
    prisma.main.userPushToken.findMany.mockResolvedValue([
      { token: "ExponentPushToken[dead-token]" },
    ]);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ status: "error", details: { error: "DeviceNotRegistered" } }],
      }),
    } as any);

    await service.notify({
      userIds: [5],
      text: "Dokumen butuh persetujuan",
      href: "/approvals",
    });

    // Tunggu fire-and-forget sendExpoPush selesai
    await new Promise((r) => setTimeout(r, 20));

    expect(fetchMock).toHaveBeenCalledWith(
      "https://exp.host/--/api/v2/push/send",
      expect.objectContaining({ method: "POST" }),
    );
    expect(prisma.main.userPushToken.deleteMany).toHaveBeenCalledWith({
      where: { token: { in: ["ExponentPushToken[dead-token]"] } },
    });
  });
});
