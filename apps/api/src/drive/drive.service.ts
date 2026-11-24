import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service.js";
import { FileProviderService } from "../file-management/provider.service.js";
import { getDynamicRoles } from "../rbac/permissions.js";
import { DriveAccessService } from "./drive-access.service.js";
import { buildDrivePreview, classifyFileType, getExtension } from "./drive-preview.util.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";

export type BrowseDriveQuery = {
  folderId?: number | null;
  search?: string;
  fileType?: string; // all | pdf | excel | word | image | video | audio | text | other
  sortBy?: "name" | "updatedAt" | "size";
  sortDir?: "asc" | "desc";
};

export type CreateFolderDto = {
  name: string;
  parentId?: number | null;
  description?: string;
  color?: string;
  isRestricted?: boolean;
};

export type UpdateFolderDto = {
  name?: string;
  description?: string;
  color?: string;
  isRestricted?: boolean;
};

export type PermissionEntryDto = {
  principalType: "USER" | "ROLE";
  principalId: string;
  canView: boolean;
  canUpload: boolean;
  canDownload: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export type UploadedDriveFile = {
  buffer: Buffer;
  originalname?: string;
  mimetype?: string;
  size?: number;
};

@Injectable()
export class DriveService {
  private readonly logger = new Logger(DriveService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerService: FileProviderService,
    private readonly access: DriveAccessService,
    private readonly config: ConfigService,
  ) {}

  private sanitizeSegment(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 100) || "file";
  }

  private getSigningSecret(): string {
    return this.config.get<string>("JWT_SECRET") || "akuntra-drive-token-secret";
  }

  /**
   * Buat token unduh/pratinjau sementara (berlaku 2 menit) untuk native Linking / browser openURL
   * tanpa harus membuka endpoint sebagai @Public() tanpa proteksi.
   */
  async createShortLivedToken(fileId: number, user: RequestUser, mode: "inline" | "attachment" = "inline") {
    const perms = await this.access.getFilePermissions(user, fileId);
    if (mode === "attachment" ? !perms.canDownload : !perms.canView) {
      throw new ForbiddenException("Kamu tidak memiliki izin untuk mengakses berkas ini.");
    }
    const exp = Date.now() + 120_000;
    const payload = `${fileId}:${user.id}:${mode}:${exp}`;
    const sig = createHmac("sha256", this.getSigningSecret()).update(payload).digest("hex");
    return {
      token: Buffer.from(`${payload}:${sig}`).toString("base64url"),
      expiresAt: new Date(exp).toISOString(),
    };
  }

  verifyShortLivedToken(token: string, expectedFileId: number): { mode: "inline" | "attachment" } {
    try {
      const raw = Buffer.from(token, "base64url").toString("utf8");
      const parts = raw.split(":");
      if (parts.length !== 5) throw new Error("Invalid token");
      const [fidStr, uidStr, mode, expStr, sig] = parts;
      if (Number(fidStr) !== expectedFileId) throw new Error("File mismatch");
      if (Date.now() > Number(expStr)) throw new Error("Token expired");
      const payload = `${fidStr}:${uidStr}:${mode}:${expStr}`;
      const expectedSig = createHmac("sha256", this.getSigningSecret()).update(payload).digest("hex");
      const a = Buffer.from(sig!, "hex");
      const b = Buffer.from(expectedSig, "hex");
      if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Bad signature");
      return { mode: mode === "attachment" ? "attachment" : "inline" };
    } catch {
      throw new ForbiddenException("Tautan pratinjau/unduhan tidak valid atau sudah kedaluwarsa.");
    }
  }

  /**
   * Buat Share Link untuk berkas Dokumen Umum (mirip Google Drive).
   * Mendukung masa berlaku (1/7/30 hari atau selamanya), mode pratinjau/unduh, dan opsional kata sandi.
   */
  async createShareLink(
    fileId: number,
    dto: { expiresInDays?: number | null; permission?: "VIEW" | "DOWNLOAD"; password?: string },
    user: RequestUser,
  ) {
    const file = await this.prisma.main.driveFile.findFirst({
      where: { id: fileId, deletedAt: null },
    });
    if (!file) throw new NotFoundException("Berkas tidak ditemukan.");

    const perms = await this.access.getFilePermissions(user, fileId);
    const permission = dto.permission === "DOWNLOAD" ? "DOWNLOAD" : "VIEW";
    if (permission === "DOWNLOAD" ? !perms.canDownload : !perms.canView) {
      throw new ForbiddenException("Kamu tidak memiliki izin untuk membagikan berkas ini.");
    }

    const days = dto.expiresInDays && Number(dto.expiresInDays) > 0 ? Number(dto.expiresInDays) : 0;
    const exp = days > 0 ? Date.now() + days * 86_400_000 : 0; // 0 = berlaku selamanya
    const pwd = (dto.password || "").trim();
    const pwdHash = pwd
      ? createHash("sha256").update(`${this.getSigningSecret()}:${pwd}`).digest("hex").slice(0, 16)
      : "";

    const payloadObj = {
      f: fileId,
      p: permission === "DOWNLOAD" ? "d" : "v",
      e: exp,
      h: pwdHash,
      u: user.id,
    };
    const payloadB64 = Buffer.from(JSON.stringify(payloadObj), "utf8").toString("base64url");
    const sig = createHmac("sha256", this.getSigningSecret())
      .update(`share:${payloadB64}`)
      .digest("base64url");
    const token = `${payloadB64}.${sig}`;

    return {
      token,
      sharePath: `/api/drive/share/${token}`,
      permission,
      hasPassword: Boolean(pwdHash),
      expiresAt: exp > 0 ? new Date(exp).toISOString() : null,
      fileName: file.name,
    };
  }

  async accessShareLink(token: string, password?: string) {
    const parts = (token || "").split(".");
    if (parts.length !== 2) {
      throw new ForbiddenException("Tautan berbagi tidak valid.");
    }
    const [payloadB64, sig] = parts as [string, string];
    const expectedSig = createHmac("sha256", this.getSigningSecret())
      .update(`share:${payloadB64}`)
      .digest("base64url");

    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ForbiddenException("Tautan berbagi tidak valid atau rusak.");
    }

    let payload: { f: number; p: string; e: number; h: string };
    try {
      payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    } catch {
      throw new ForbiddenException("Tautan berbagi tidak valid.");
    }

    if (payload.e && payload.e > 0 && Date.now() > payload.e) {
      throw new ForbiddenException("Tautan berbagi sudah kedaluwarsa.");
    }

    if (payload.h) {
      if (!password) {
        return { requiresPassword: true as const };
      }
      const actualHash = createHash("sha256")
        .update(`${this.getSigningSecret()}:${password.trim()}`)
        .digest("hex")
        .slice(0, 16);
      if (actualHash !== payload.h) {
        throw new ForbiddenException("Kata sandi tautan salah.");
      }
    }

    const mode = payload.p === "d" ? "attachment" : "inline";
    const content = await this.getFileContent(payload.f, null, mode, true);
    return {
      requiresPassword: false as const,
      mode,
      ...content,
    };
  }

  async getBreadcrumbs(folderId: number | null): Promise<Array<{ id: number; name: string }>> {
    const crumbs: Array<{ id: number; name: string }> = [];
    let cursor = folderId;
    const visited = new Set<number>();
    while (cursor !== null && !visited.has(cursor) && crumbs.length < 25) {
      visited.add(cursor);
      const row = await this.prisma.main.driveFolder.findUnique({
        where: { id: cursor },
        select: { id: true, name: true, parentId: true, deletedAt: true },
      });
      if (!row || row.deletedAt) break;
      crumbs.unshift({ id: row.id, name: row.name });
      cursor = row.parentId;
    }
    return crumbs;
  }

  /**
   * Jelajah folder & file di Dokumen Umum (mendukung navigasi hirarkis, pencarian global/lokal, dan filter tipe).
   */
  async browse(query: BrowseDriveQuery, user: RequestUser) {
    if (!this.access.canAccessDriveModule(user)) {
      throw new ForbiddenException("Kamu tidak memiliki akses ke modul Dokumen Umum.");
    }

    const folderId = query.folderId && Number(query.folderId) > 0 ? Number(query.folderId) : null;
    const search = (query.search || "").trim();
    const fileType = (query.fileType || "all").toLowerCase().trim();
    const sortDir: "asc" | "desc" = query.sortDir === "asc" ? "asc" : "desc";
    const sortBy = query.sortBy || "updatedAt";

    let currentFolder: any = null;
    if (folderId !== null) {
      currentFolder = await this.prisma.main.driveFolder.findFirst({
        where: { id: folderId, deletedAt: null },
        include: {
          createdBy: { select: { id: true, name: true } },
          _count: { select: { children: { where: { deletedAt: null } }, files: { where: { deletedAt: null } } } },
        },
      });
      if (!currentFolder) throw new NotFoundException("Folder tidak ditemukan.");
      const perms = await this.access.getFolderPermissions(user, folderId);
      if (!perms.canView) {
        throw new ForbiddenException("Kamu tidak memiliki izin untuk membuka folder ini.");
      }
    }

    const [currentPermissions, breadcrumbs] = await Promise.all([
      this.access.getFolderPermissions(user, folderId),
      this.getBreadcrumbs(folderId),
    ]);

    const isGlobalSearch = Boolean(search) || (fileType !== "all" && fileType !== "");

    // 1. Ambil kandidat folder
    const folderWhere: any = { deletedAt: null };
    if (search) {
      folderWhere.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
      if (folderId !== null) folderWhere.parentId = folderId;
    } else if (!isGlobalSearch) {
      folderWhere.parentId = folderId;
    } else {
      // Jika hanya filter tipe file (misal PDF), tidak tampilkan folder kecuali ada search
      folderWhere.id = -1;
    }

    const rawFolders = await this.prisma.main.driveFolder.findMany({
      where: folderWhere,
      orderBy: sortBy === "name" ? { name: sortDir } : { updatedAt: sortDir },
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: {
          select: {
            children: { where: { deletedAt: null } },
            files: { where: { deletedAt: null } },
          },
        },
      },
    });

    const visibleFolders = (
      await Promise.all(
        rawFolders.map(async (f) => {
          const perms = await this.access.getFolderPermissions(user, f.id);
          if (!perms.canView) return null;
          return {
            id: f.id,
            parentId: f.parentId,
            name: f.name,
            description: f.description,
            color: f.color,
            isRestricted: f.isRestricted,
            createdBy: f.createdBy,
            createdAt: f.createdAt,
            updatedAt: f.updatedAt,
            subfolderCount: f._count.children,
            fileCount: f._count.files,
            permissions: perms,
          };
        }),
      )
    ).filter((x): x is NonNullable<typeof x> => x !== null);

    // 2. Ambil kandidat file
    const fileWhere: any = { deletedAt: null };
    if (search) {
      fileWhere.OR = [
        { name: { contains: search } },
        { originalName: { contains: search } },
        { extension: { contains: search } },
        { description: { contains: search } },
      ];
      if (folderId !== null) fileWhere.folderId = folderId;
    } else if (!isGlobalSearch) {
      fileWhere.folderId = folderId;
    } else if (folderId !== null) {
      fileWhere.folderId = folderId;
    }

    const fileOrderBy =
      sortBy === "name"
        ? { name: sortDir }
        : sortBy === "size"
          ? { size: sortDir }
          : { updatedAt: sortDir };

    const rawFiles = await this.prisma.main.driveFile.findMany({
      where: fileWhere,
      orderBy: fileOrderBy,
      include: {
        uploader: { select: { id: true, name: true, role: true } },
        folder: { select: { id: true, name: true } },
        provider: { select: { id: true, name: true, type: true } },
      },
    });

    const visibleFiles = (
      await Promise.all(
        rawFiles.map(async (f) => {
          const ext = getExtension(f.name || f.originalName, f.extension);
          const category = classifyFileType(ext, f.mimeType);
          if (fileType && fileType !== "all" && category !== fileType) return null;

          const perms = await this.access.getFilePermissions(user, f.id);
          if (!perms.canView) return null;

          return {
            id: f.id,
            folderId: f.folderId,
            folderName: f.folder?.name ?? "Dokumen Umum",
            name: f.name,
            originalName: f.originalName,
            extension: ext,
            fileType: category,
            mimeType: f.mimeType,
            size: f.size,
            description: f.description,
            checksumSha256: f.checksumSha256,
            uploader: f.uploader,
            provider: f.provider ?? { id: 0, name: "Server Lokal", type: "LOCAL" },
            createdAt: f.createdAt,
            updatedAt: f.updatedAt,
            permissions: perms,
          };
        }),
      )
    ).filter((x): x is NonNullable<typeof x> => x !== null);

    // 3. Statistik ringkas hanya dari folder & berkas yang boleh dilihat user ini (tidak membocorkan folder privat orang lain)
    const totalFolders = visibleFolders.length;
    const totalFiles = visibleFiles.length;
    const totalBytes = visibleFiles.reduce((sum, f) => sum + (f.size || 0), 0);

    return {
      currentFolder: currentFolder
        ? {
            id: currentFolder.id,
            parentId: currentFolder.parentId,
            name: currentFolder.name,
            description: currentFolder.description,
            color: currentFolder.color,
            isRestricted: currentFolder.isRestricted,
            createdBy: currentFolder.createdBy,
            createdAt: currentFolder.createdAt,
            updatedAt: currentFolder.updatedAt,
          }
        : null,
      breadcrumbs,
      permissions: currentPermissions,
      folders: visibleFolders,
      files: visibleFiles,
      stats: {
        totalFolders,
        totalFiles,
        totalBytes,
      },
    };
  }

  /**
   * Daftar seluruh folder yang dapat diakses user untuk dialog Pindah Folder / File.
   */
  async getFolderTree(user: RequestUser) {
    if (!this.access.canAccessDriveModule(user)) {
      throw new ForbiddenException("Kamu tidak memiliki akses ke modul Dokumen Umum.");
    }

    const all = await this.prisma.main.driveFolder.findMany({
      where: { deletedAt: null },
      orderBy: [{ parentId: "asc" }, { name: "asc" }],
      select: { id: true, parentId: true, name: true, isRestricted: true, color: true },
    });

    const visible = (
      await Promise.all(
        all.map(async (f) => {
          const perms = await this.access.getFolderPermissions(user, f.id);
          if (!perms.canView) return null;
          return { ...f, canUpload: perms.canUpload };
        }),
      )
    ).filter((x): x is NonNullable<typeof x> => x !== null);

    return visible;
  }

  async createFolder(dto: CreateFolderDto, user: RequestUser) {
    const name = (dto.name || "").trim();
    if (!name) throw new BadRequestException("Nama folder wajib diisi.");
    if (name.length > 180) throw new BadRequestException("Nama folder maksimal 180 karakter.");

    const parentId = dto.parentId && Number(dto.parentId) > 0 ? Number(dto.parentId) : null;
    if (parentId !== null) {
      const parent = await this.prisma.main.driveFolder.findFirst({
        where: { id: parentId, deletedAt: null },
      });
      if (!parent) throw new NotFoundException("Folder induk tidak ditemukan.");
    }

    const perms = await this.access.getFolderPermissions(user, parentId);
    if (!perms.canUpload) {
      throw new ForbiddenException("Kamu tidak memiliki izin untuk membuat folder di lokasi ini.");
    }

    const dup = await this.prisma.main.driveFolder.findFirst({
      where: { parentId, name, deletedAt: null },
    });
    if (dup) {
      throw new BadRequestException(`Folder dengan nama "${name}" sudah ada di lokasi ini.`);
    }

    // Default: folder baru bersifat privat (isRestricted = true) sehingga hanya pembuatnya
    // (dan admin) yang bisa melihat, sampai pembuatnya mengubah/membagikan akses folder.
    const isRestricted = dto.isRestricted !== undefined ? Boolean(dto.isRestricted) : true;

    const created = await this.prisma.main.driveFolder.create({
      data: {
        name,
        parentId,
        description: dto.description?.trim() || null,
        color: dto.color?.trim() || null,
        isRestricted,
        createdById: user.id,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    return created;
  }

  async updateFolder(id: number, dto: UpdateFolderDto, user: RequestUser) {
    const folder = await this.prisma.main.driveFolder.findFirst({
      where: { id, deletedAt: null },
    });
    if (!folder) throw new NotFoundException("Folder tidak ditemukan.");

    const perms = await this.access.getFolderPermissions(user, id);
    if (!perms.canEdit) {
      throw new ForbiddenException("Kamu tidak memiliki izin untuk mengubah folder ini.");
    }
    if (dto.isRestricted !== undefined && !perms.canManageAccess) {
      throw new ForbiddenException("Kamu tidak memiliki izin untuk mengubah pembatasan akses folder.");
    }

    const nextName = dto.name !== undefined ? dto.name.trim() : folder.name;
    if (!nextName) throw new BadRequestException("Nama folder tidak boleh kosong.");

    if (nextName !== folder.name) {
      const dup = await this.prisma.main.driveFolder.findFirst({
        where: { parentId: folder.parentId, name: nextName, deletedAt: null, id: { not: id } },
      });
      if (dup) throw new BadRequestException(`Folder "${nextName}" sudah ada di lokasi yang sama.`);
    }

    return this.prisma.main.driveFolder.update({
      where: { id },
      data: {
        name: nextName,
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.color !== undefined ? { color: dto.color?.trim() || null } : {}),
        ...(dto.isRestricted !== undefined ? { isRestricted: Boolean(dto.isRestricted) } : {}),
      },
    });
  }

  async moveFolder(id: number, targetParentIdRaw: number | null | undefined, user: RequestUser) {
    const folder = await this.prisma.main.driveFolder.findFirst({
      where: { id, deletedAt: null },
    });
    if (!folder) throw new NotFoundException("Folder tidak ditemukan.");

    const targetParentId =
      targetParentIdRaw && Number(targetParentIdRaw) > 0 ? Number(targetParentIdRaw) : null;

    if (targetParentId === id) {
      throw new BadRequestException("Folder tidak dapat dipindahkan ke dalam dirinya sendiri.");
    }

    const [srcPerms, dstPerms] = await Promise.all([
      this.access.getFolderPermissions(user, id),
      this.access.getFolderPermissions(user, targetParentId),
    ]);
    if (!srcPerms.canEdit) {
      throw new ForbiddenException("Kamu tidak memiliki izin untuk memindahkan folder ini.");
    }
    if (!dstPerms.canUpload) {
      throw new ForbiddenException("Kamu tidak memiliki izin untuk memindahkan folder ke lokasi tujuan.");
    }

    // Cek cycle: pastikan targetParentId bukan turunan dari folder ini
    if (targetParentId !== null) {
      const target = await this.prisma.main.driveFolder.findFirst({
        where: { id: targetParentId, deletedAt: null },
      });
      if (!target) throw new NotFoundException("Folder tujuan tidak ditemukan.");

      let cursor: number | null = targetParentId;
      const visited = new Set<number>();
      while (cursor !== null && !visited.has(cursor)) {
        if (cursor === id) {
          throw new BadRequestException("Folder tidak dapat dipindahkan ke dalam subfoldernya sendiri.");
        }
        visited.add(cursor);
        const parentRow: { parentId: number | null } | null = await this.prisma.main.driveFolder.findUnique({
          where: { id: cursor },
          select: { parentId: true },
        });
        cursor = parentRow?.parentId ?? null;
      }
    }

    const dup = await this.prisma.main.driveFolder.findFirst({
      where: { parentId: targetParentId, name: folder.name, deletedAt: null, id: { not: id } },
    });
    if (dup) {
      throw new BadRequestException(`Folder "${folder.name}" sudah ada di lokasi tujuan.`);
    }

    return this.prisma.main.driveFolder.update({
      where: { id },
      data: { parentId: targetParentId },
    });
  }

  async deleteFolder(id: number, user: RequestUser) {
    const folder = await this.prisma.main.driveFolder.findFirst({
      where: { id, deletedAt: null },
    });
    if (!folder) throw new NotFoundException("Folder tidak ditemukan.");

    const perms = await this.access.getFolderPermissions(user, id);
    if (!perms.canDelete) {
      throw new ForbiddenException("Kamu tidak memiliki izin untuk menghapus folder ini.");
    }

    // Kumpulkan semua descendant folder IDs secara BFS
    const folderIds: number[] = [id];
    let queue: number[] = [id];
    while (queue.length > 0) {
      const children = await this.prisma.main.driveFolder.findMany({
        where: { parentId: { in: queue } },
        select: { id: true },
      });
      queue = children.map((c) => c.id).filter((cid) => !folderIds.includes(cid));
      folderIds.push(...queue);
    }

    const filesToDelete = await this.prisma.main.driveFile.findMany({
      where: { folderId: { in: folderIds } },
      select: { id: true, providerId: true, storageKey: true },
    });

    // Hapus file dan folder permanen dari DB (child folder & permission ikut terhapus lewat cascade)
    await this.prisma.main.$transaction([
      this.prisma.main.driveFile.deleteMany({
        where: { folderId: { in: folderIds } },
      }),
      this.prisma.main.driveFolder.delete({
        where: { id },
      }),
    ]);

    let deletedPhysicalFiles = 0;
    for (const file of filesToDelete) {
      if (await this.deletePhysicalFile(file)) {
        deletedPhysicalFiles++;
      }
    }

    return {
      ok: true,
      deletedFolders: folderIds.length,
      deletedFiles: filesToDelete.length,
      deletedPhysicalFiles,
    };
  }

  /**
   * Upload single atau multiple file ke dalam folder Dokumen Umum.
   * Disimpan ke default StorageProvider dengan prefix terisolasi `general-drive/YYYY/MM/...`.
   */
  async uploadFiles(
    files: UploadedDriveFile[],
    folderIdRaw: number | null | undefined,
    description: string | undefined,
    user: RequestUser,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException("Minimal satu berkas wajib diunggah.");
    }

    const folderId = folderIdRaw && Number(folderIdRaw) > 0 ? Number(folderIdRaw) : null;
    if (folderId !== null) {
      const folder = await this.prisma.main.driveFolder.findFirst({
        where: { id: folderId, deletedAt: null },
      });
      if (!folder) throw new NotFoundException("Folder tujuan tidak ditemukan.");
    }

    const perms = await this.access.getFolderPermissions(user, folderId);
    if (!perms.canUpload) {
      throw new ForbiddenException("Kamu tidak memiliki izin untuk mengunggah berkas di folder ini.");
    }

    const defaultProvider = await this.providerService.getDefaultProvider();
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, "0");

    const uploaded: any[] = [];
    const failed: Array<{ name: string; error: string }> = [];

    for (const f of files) {
      const origName = (f.originalname || "file").trim();
      try {
        if (!f.buffer?.length) {
          throw new Error("Berkas kosong.");
        }
        const ext = getExtension(origName);
        const safeName = this.sanitizeSegment(origName);
        const uniqueToken = `${Date.now()}_${randomBytes(4).toString("hex")}`;
        const storageKey = `general-drive/${yyyy}/${mm}/${uniqueToken}_${safeName}`;
        const mimeType = f.mimetype || "application/octet-stream";
        const checksum = createHash("sha256").update(f.buffer).digest("hex");

        await defaultProvider.adapter.upload(storageKey, f.buffer, { mimeType });

        const created = await this.prisma.main.driveFile.create({
          data: {
            folderId,
            name: origName,
            originalName: origName,
            extension: ext || null,
            mimeType,
            size: f.buffer.length,
            storageKey,
            providerId: defaultProvider.id,
            checksumSha256: checksum,
            description: description?.trim() || null,
            uploadedById: user.id,
          },
          include: {
            uploader: { select: { id: true, name: true, role: true } },
            provider: { select: { id: true, name: true, type: true } },
          },
        });

        uploaded.push(created);
      } catch (err) {
        failed.push({ name: origName, error: (err as Error).message });
      }
    }

    return {
      uploaded,
      failed,
      uploadedCount: uploaded.length,
      failedCount: failed.length,
    };
  }

  async updateFile(id: number, dto: { name?: string; description?: string }, user: RequestUser) {
    const file = await this.prisma.main.driveFile.findFirst({
      where: { id, deletedAt: null },
    });
    if (!file) throw new NotFoundException("Berkas tidak ditemukan.");

    const perms = await this.access.getFilePermissions(user, id);
    if (!perms.canEdit) {
      throw new ForbiddenException("Kamu tidak memiliki izin untuk mengubah berkas ini.");
    }

    let nextName = dto.name !== undefined ? dto.name.trim() : file.name;
    if (!nextName) throw new BadRequestException("Nama berkas tidak boleh kosong.");

    // Pertahankan ekstensi asli jika user mengganti nama tanpa menulis ekstensi
    if (dto.name !== undefined && file.extension && !nextName.includes(".")) {
      nextName = `${nextName}.${file.extension}`;
    }

    const nextExt = getExtension(nextName, file.extension);

    return this.prisma.main.driveFile.update({
      where: { id },
      data: {
        name: nextName,
        extension: nextExt || file.extension,
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
      },
    });
  }

  async moveFile(id: number, targetFolderIdRaw: number | null | undefined, user: RequestUser) {
    const file = await this.prisma.main.driveFile.findFirst({
      where: { id, deletedAt: null },
    });
    if (!file) throw new NotFoundException("Berkas tidak ditemukan.");

    const targetFolderId =
      targetFolderIdRaw && Number(targetFolderIdRaw) > 0 ? Number(targetFolderIdRaw) : null;

    if (targetFolderId !== null) {
      const dst = await this.prisma.main.driveFolder.findFirst({
        where: { id: targetFolderId, deletedAt: null },
      });
      if (!dst) throw new NotFoundException("Folder tujuan tidak ditemukan.");
    }

    const [srcPerms, dstPerms] = await Promise.all([
      this.access.getFilePermissions(user, id),
      this.access.getFolderPermissions(user, targetFolderId),
    ]);
    if (!srcPerms.canEdit) {
      throw new ForbiddenException("Kamu tidak memiliki izin untuk memindahkan berkas ini.");
    }
    if (!dstPerms.canUpload) {
      throw new ForbiddenException("Kamu tidak memiliki izin untuk memindahkan berkas ke folder tujuan.");
    }

    return this.prisma.main.driveFile.update({
      where: { id },
      data: { folderId: targetFolderId },
    });
  }

  async deleteFile(id: number, user: RequestUser) {
    const file = await this.prisma.main.driveFile.findFirst({
      where: { id, deletedAt: null },
    });
    if (!file) throw new NotFoundException("Berkas tidak ditemukan.");

    const perms = await this.access.getFilePermissions(user, id);
    if (!perms.canDelete) {
      throw new ForbiddenException("Kamu tidak memiliki izin untuk menghapus berkas ini.");
    }

    await this.prisma.main.driveFile.delete({
      where: { id },
    });

    const physicalDeleted = await this.deletePhysicalFile(file);

    return { ok: true, physicalDeleted };
  }

  private async deletePhysicalFile(file: {
    id: number;
    providerId: number | null;
    storageKey: string;
  }): Promise<boolean> {
    if (!file.storageKey) return false;

    if (file.providerId) {
      try {
        const adapter = await this.providerService.getAdapter(file.providerId);
        await adapter.delete(file.storageKey);
        return true;
      } catch (err) {
        this.logger.warn(
          `Gagal menghapus berkas fisik driveFile#${file.id} pada provider#${file.providerId}, mencoba provider default: ${(err as Error).message}`,
        );
      }
    }

    try {
      const def = await this.providerService.getDefaultProvider();
      await def.adapter.delete(file.storageKey);
      return true;
    } catch (err) {
      this.logger.warn(
        `Gagal menghapus berkas fisik driveFile#${file.id} (${file.storageKey}): ${(err as Error).message}`,
      );
      return false;
    }
  }

  private async readFileBuffer(file: { providerId: number | null; storageKey: string }): Promise<Buffer> {
    if (file.providerId) {
      try {
        const adapter = await this.providerService.getAdapter(file.providerId);
        return await adapter.download(file.storageKey);
      } catch {
        // Fallback ke default provider jika provider lama tidak tersedia
      }
    }
    const def = await this.providerService.getDefaultProvider();
    return def.adapter.download(file.storageKey);
  }

  async getFileContent(
    id: number,
    user: RequestUser | null,
    mode: "inline" | "attachment" = "inline",
    skipAccessCheck = false,
  ) {
    const file = await this.prisma.main.driveFile.findFirst({
      where: { id, deletedAt: null },
    });
    if (!file) throw new NotFoundException("Berkas tidak ditemukan.");

    if (!skipAccessCheck) {
      if (!user) throw new ForbiddenException("Autentikasi diperlukan.");
      const perms = await this.access.getFilePermissions(user, id);
      if (mode === "attachment" ? !perms.canDownload : !perms.canView) {
        throw new ForbiddenException("Kamu tidak memiliki izin untuk mengakses berkas ini.");
      }
    }

    const buffer = await this.readFileBuffer(file);
    return {
      buffer,
      mimeType: file.mimeType || "application/octet-stream",
      fileName: file.name || file.originalName,
      size: buffer.length,
    };
  }

  async getFilePreview(id: number, user: RequestUser) {
    const file = await this.prisma.main.driveFile.findFirst({
      where: { id, deletedAt: null },
    });
    if (!file) throw new NotFoundException("Berkas tidak ditemukan.");

    const perms = await this.access.getFilePermissions(user, id);
    if (!perms.canView) {
      throw new ForbiddenException("Kamu tidak memiliki izin untuk melihat pratinjau berkas ini.");
    }

    const ext = getExtension(file.name || file.originalName, file.extension);
    const kind = classifyFileType(ext, file.mimeType);

    // Media & PDF tidak perlu di-parse ulang ke JSON — frontend render via authenticated content stream
    if (kind === "image" || kind === "pdf" || kind === "video" || kind === "audio") {
      return {
        kind,
        mimeType: file.mimeType,
        fileName: file.name,
        size: file.size,
      };
    }

    const buffer = await this.readFileBuffer(file);
    return buildDrivePreview(buffer, file.name || file.originalName, file.mimeType, file.extension);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Folder & File ACL Management (PRD §2.D)
  // ───────────────────────────────────────────────────────────────────────────

  async getFolderAccess(folderId: number, user: RequestUser) {
    const perms = await this.access.getFolderPermissions(user, folderId);
    if (!perms.canManageAccess) {
      throw new ForbiddenException("Kamu tidak memiliki izin untuk mengelola hak akses folder.");
    }
    const folder = await this.prisma.main.driveFolder.findFirst({
      where: { id: folderId, deletedAt: null },
      include: { permissions: { orderBy: { id: "asc" } } },
    });
    if (!folder) throw new NotFoundException("Folder tidak ditemukan.");
    return {
      folderId: folder.id,
      name: folder.name,
      isRestricted: folder.isRestricted,
      entries: folder.permissions,
    };
  }

  async setFolderAccess(
    folderId: number,
    dto: { isRestricted: boolean; entries: PermissionEntryDto[] },
    user: RequestUser,
  ) {
    const perms = await this.access.getFolderPermissions(user, folderId);
    if (!perms.canManageAccess) {
      throw new ForbiddenException("Kamu tidak memiliki izin untuk mengelola hak akses folder.");
    }
    const folder = await this.prisma.main.driveFolder.findFirst({
      where: { id: folderId, deletedAt: null },
    });
    if (!folder) throw new NotFoundException("Folder tidak ditemukan.");

    const cleanEntries = (dto.entries || [])
      .filter((e) => e && (e.principalType === "USER" || e.principalType === "ROLE") && String(e.principalId || "").trim())
      .map((e) => ({
        folderId,
        principalType: e.principalType,
        principalId: String(e.principalId).trim(),
        canView: Boolean(e.canView),
        canUpload: Boolean(e.canUpload),
        canDownload: Boolean(e.canDownload),
        canEdit: Boolean(e.canEdit),
        canDelete: Boolean(e.canDelete),
        grantedById: user.id,
      }));

    await this.prisma.main.$transaction([
      this.prisma.main.driveFolder.update({
        where: { id: folderId },
        data: { isRestricted: Boolean(dto.isRestricted) },
      }),
      this.prisma.main.drivePermission.deleteMany({ where: { folderId } }),
      ...(cleanEntries.length > 0
        ? [this.prisma.main.drivePermission.createMany({ data: cleanEntries })]
        : []),
    ]);

    return this.getFolderAccess(folderId, user);
  }

  async getAccessPrincipals(user: RequestUser) {
    if (!this.access.canAccessDriveModule(user)) {
      throw new ForbiddenException("Kamu tidak memiliki akses ke modul Dokumen Umum.");
    }
    const users = await this.prisma.main.user.findMany({
      where: { status: "AKTIF" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true, department: true },
    });
    const roles = getDynamicRoles().map((r) => ({
      code: r.code,
      name: r.name,
      description: r.description,
    }));
    return { users, roles };
  }
}
