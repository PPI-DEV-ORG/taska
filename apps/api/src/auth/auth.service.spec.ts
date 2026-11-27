import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import { AuthService } from "./auth.service.js";

describe("AuthService", () => {
  let service: AuthService;
  let prisma: any;
  let jwt: any;
  let config: any;
  let audit: any;

  beforeEach(() => {
    prisma = {
      main: {
        user: {
          findFirst: vi.fn(),
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        refreshToken: {
          create: vi.fn(),
          updateMany: vi.fn(),
        },
        file: {
          findUnique: vi.fn(),
          findFirst: vi.fn().mockResolvedValue(null),
          update: vi.fn(),
        },
        $transaction: vi.fn(async (ops: any[]) => Promise.all(ops)),
      },
    };
    jwt = { signAsync: vi.fn().mockResolvedValue("mock-jwt-token") };
    config = { get: vi.fn().mockReturnValue(undefined) };
    audit = { log: vi.fn().mockResolvedValue(undefined) };
    service = new AuthService(prisma, jwt, config, audit);
  });

  it("revokes all active refresh tokens when changing password", async () => {
    const hash = await bcrypt.hash("OldPass123!", 4);
    prisma.main.user.findUnique.mockResolvedValue({
      id: 7,
      email: "user@akuntra.id",
      passwordHash: hash,
    });
    prisma.main.user.update.mockResolvedValue({ id: 7 });
    prisma.main.refreshToken.updateMany.mockResolvedValue({ count: 2 });

    const res = await service.changePassword(
      { id: 7, email: "user@akuntra.id", name: "User", role: "SALES" },
      "OldPass123!",
      "NewPass456!",
    );

    expect(res).toEqual({ ok: true });
    expect(prisma.main.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 7, revokedAt: null },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      }),
    );
  });

  it("rejects changePassword when old password does not match", async () => {
    const hash = await bcrypt.hash("CorrectPass!", 4);
    prisma.main.user.findUnique.mockResolvedValue({
      id: 7,
      email: "user@akuntra.id",
      passwordHash: hash,
    });

    await expect(
      service.changePassword(
        { id: 7, email: "user@akuntra.id", name: "User", role: "SALES" },
        "WrongPass!",
        "NewPass456!",
      ),
    ).rejects.toThrow("Password lama tidak sesuai");
    expect(prisma.main.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it("blocks updateMe from attaching another user's avatarFileId", async () => {
    prisma.main.file.findUnique.mockResolvedValue({ id: 99, uploadedById: 999 });
    prisma.main.user.findUnique.mockResolvedValue({
      id: 7,
      email: "user@akuntra.id",
      name: "User",
      role: "SALES",
      status: "AKTIF",
    });

    await service.updateMe(
      { id: 7, email: "user@akuntra.id", name: "User", role: "SALES" },
      { avatarFileId: 99 },
    );

    expect(prisma.main.file.update).not.toHaveBeenCalled();
  });
});
