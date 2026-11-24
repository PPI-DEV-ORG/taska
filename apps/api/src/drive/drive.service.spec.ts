import { describe, expect, it, vi } from "vitest";
import { DriveService } from "./drive.service.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";

const mockUser: RequestUser = {
  id: 1,
  email: "admin@example.com",
  name: "Admin",
  role: "SUPERADMIN",
};

function createService() {
  const adapterDelete = vi.fn().mockResolvedValue(undefined);
  const defaultAdapterDelete = vi.fn().mockResolvedValue(undefined);

  const prisma = {
    main: {
      driveFolder: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        delete: vi.fn().mockResolvedValue({ id: 10 }),
      },
      driveFile: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        delete: vi.fn().mockResolvedValue({ id: 1 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      $transaction: vi.fn().mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    },
  };

  const providerService = {
    getAdapter: vi.fn().mockResolvedValue({ delete: adapterDelete }),
    getDefaultProvider: vi.fn().mockResolvedValue({
      id: 1,
      name: "Server Lokal",
      adapter: { delete: defaultAdapterDelete },
    }),
  };

  const access = {
    getFolderPermissions: vi.fn().mockResolvedValue({ canDelete: true }),
    getFilePermissions: vi.fn().mockResolvedValue({ canDelete: true }),
  };

  const config = {
    get: vi.fn(),
  };

  const service = new DriveService(
    prisma as never,
    providerService as never,
    access as never,
    config as never,
  );

  return { service, prisma, providerService, adapterDelete, defaultAdapterDelete };
}

describe("DriveService physical deletion", () => {
  it("menghapus record DB dan file fisik saat deleteFile dipanggil", async () => {
    const { service, prisma, providerService, adapterDelete } = createService();
    prisma.main.driveFile.findFirst.mockResolvedValue({
      id: 99,
      providerId: 2,
      storageKey: "general-drive/2026/11/123_demo.pdf",
    });

    const res = await service.deleteFile(99, mockUser);

    expect(res).toEqual({ ok: true, physicalDeleted: true });
    expect(prisma.main.driveFile.delete).toHaveBeenCalledWith({ where: { id: 99 } });
    expect(providerService.getAdapter).toHaveBeenCalledWith(2);
    expect(adapterDelete).toHaveBeenCalledWith("general-drive/2026/11/123_demo.pdf");
  });

  it("menghapus folder, semua subfolder, record file, dan seluruh file fisik saat deleteFolder dipanggil", async () => {
    const { service, prisma, adapterDelete, defaultAdapterDelete } = createService();
    prisma.main.driveFolder.findFirst.mockResolvedValue({ id: 10, name: "Proyek A" });
    prisma.main.driveFolder.findMany
      .mockResolvedValueOnce([{ id: 11 }])
      .mockResolvedValueOnce([]);
    prisma.main.driveFile.findMany.mockResolvedValue([
      { id: 101, providerId: 2, storageKey: "general-drive/2026/11/a.pdf" },
      { id: 102, providerId: null, storageKey: "general-drive/2026/11/b.png" },
    ]);

    const res = await service.deleteFolder(10, mockUser);

    expect(res).toEqual({
      ok: true,
      deletedFolders: 2,
      deletedFiles: 2,
      deletedPhysicalFiles: 2,
    });
    expect(prisma.main.driveFile.deleteMany).toHaveBeenCalledWith({
      where: { folderId: { in: [10, 11] } },
    });
    expect(prisma.main.driveFolder.delete).toHaveBeenCalledWith({
      where: { id: 10 },
    });
    expect(adapterDelete).toHaveBeenCalledWith("general-drive/2026/11/a.pdf");
    expect(defaultAdapterDelete).toHaveBeenCalledWith("general-drive/2026/11/b.png");
  });
});
