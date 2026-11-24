import { describe, expect, it, vi } from "vitest";
import { FileManagementService } from "./file-management.service.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";

const superAdmin: RequestUser = {
  id: 1,
  email: "admin@example.com",
  name: "Super Admin",
  role: "SUPERADMIN",
};

function createService() {
  const localAdapterDelete = vi.fn().mockResolvedValue(undefined);
  const nasAdapterDelete = vi.fn().mockResolvedValue(undefined);

  const prisma = {
    main: {
      file: {
        findUnique: vi.fn(),
        delete: vi.fn().mockResolvedValue({ id: 1 }),
        update: vi.fn().mockResolvedValue({ id: 1 }),
      },
      fileAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 1 }),
      },
    },
  };

  const providerService = {
    getAdapter: vi.fn().mockImplementation(async (providerId: number) => {
      if (providerId === 1) return { delete: localAdapterDelete };
      return { delete: nasAdapterDelete };
    }),
  };

  const accessService = {
    canAccessFile: vi.fn().mockResolvedValue(true),
    resolveConnectedDocuments: vi.fn().mockResolvedValue([]),
  };

  const service = new FileManagementService(
    prisma as never,
    providerService as never,
    accessService as never,
  );

  return { service, prisma, providerService, accessService, localAdapterDelete, nasAdapterDelete };
}

describe("FileManagementService permanent deletion", () => {
  it("menghapus file lepas secara permanen dari DB dan seluruh storage provider saat deleteFile dipanggil", async () => {
    const { service, prisma, localAdapterDelete, nasAdapterDelete } = createService();
    prisma.main.file.findUnique.mockResolvedValue({
      id: 42,
      path: "uploads/foto-dokumen/sample.jpg",
      locations: [
        { id: 1, providerId: 1, storageKey: "foto-dokumen/sample.jpg", replicaStatus: "PRIMARY", provider: { type: "LOCAL" } },
        { id: 2, providerId: 2, storageKey: "foto-dokumen/sample.jpg", replicaStatus: "REPLICA", provider: { type: "WEBDAV" } },
      ],
    });

    const res = await service.deleteFile(42, superAdmin, false);

    expect(res.ok).toBe(true);
    expect(res.physicalDeleted).toBe(true);
    expect(localAdapterDelete).toHaveBeenCalledWith("foto-dokumen/sample.jpg");
    expect(nasAdapterDelete).toHaveBeenCalledWith("foto-dokumen/sample.jpg");
    expect(prisma.main.file.delete).toHaveBeenCalledWith({ where: { id: 42 } });
    expect(prisma.main.fileAuditLog.create).toHaveBeenCalledOnce();
  });

  it("menghapus massal file lepas beserta file fisiknya pada bulkDeleteOrphans dan melewati file terhubung", async () => {
    const { service, prisma, accessService, localAdapterDelete } = createService();
    prisma.main.file.findUnique
      .mockResolvedValueOnce({
        id: 50,
        path: "uploads/general/orphan.pdf",
        locations: [
          { id: 10, providerId: 1, storageKey: "general/orphan.pdf", replicaStatus: "PRIMARY", provider: { type: "LOCAL" } },
        ],
      })
      .mockResolvedValueOnce({
        id: 51,
        path: "uploads/invoices/used.pdf",
        locations: [],
      });

    accessService.resolveConnectedDocuments
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ type: "INVOICE", id: 9, label: "INV-009" }]);

    const res = await service.bulkDeleteOrphans([50, 51], superAdmin);

    expect(res.ok).toBe(true);
    expect(res.deletedCount).toBe(1);
    expect(res.deletedPhysicalCount).toBe(1);
    expect(res.errors).toEqual(["File #51 tidak dihapus karena ternyata terhubung ke dokumen"]);
    expect(localAdapterDelete).toHaveBeenCalledWith("general/orphan.pdf");
    expect(prisma.main.file.delete).toHaveBeenCalledWith({ where: { id: 50 } });
  });
});
