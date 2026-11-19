import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, stat, statfs, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service.js";
import { FileProviderService } from "./provider.service.js";
import { FileAccessService, type ConnectedDocument } from "./file-access.service.js";
import {
  isLocalFileInUploadDir,
  getSubfolderFromPath,
  getUploadRoots,
  normalizeRelativeUploadPath,
  SUBFOLDER_METADATA,
} from "./file-utils.js";
import { can } from "../rbac/permissions.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";

export type ListFilesQuery = {
  search?: string;
  folder?: string;
  categoryId?: number;
  providerId?: number;
  kind?: string;
  status?: string;
  isOrphan?: string | boolean;
  dateFrom?: string;
  dateTo?: string;
  showDeleted?: boolean | string;
  page?: number;
  limit?: number;
};

export type CreateShareDto = {
  expiresAt: string; // ISO date string
  permission?: "VIEW" | "DOWNLOAD";
  password?: string;
  oneTime?: boolean;
};

@Injectable()
export class FileManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providerService: FileProviderService,
    private readonly accessService: FileAccessService,
  ) {}

  /**
   * Overview & KPI statistik pengelolaan file
   */
  async getOverview() {
    const [
      categories,
      providers,
      recentFilesRaw,
      deletedCount,
      allFiles,
      connectedSet,
    ] = await Promise.all([
      this.prisma.main.fileCategory.findMany({
        where: { isActive: true },
        include: {
          _count: { select: { files: { where: { deletedAt: null } } } },
        },
      }),
      this.prisma.main.fileStorageProvider.findMany({
        select: {
          id: true,
          name: true,
          type: true,
          isDefault: true,
          status: true,
          _count: { select: { locations: { where: { isPrimary: true, file: { deletedAt: null } } } } },
        },
      }),
      this.prisma.main.file.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          category: { select: { id: true, name: true } },
          uploader: { select: { id: true, name: true } },
          locations: {
            where: { isPrimary: true },
            include: { provider: { select: { id: true, name: true, type: true } } },
          },
        },
      }),
      this.prisma.main.file.count({ where: { deletedAt: { not: null } } }),
      this.prisma.main.file.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          path: true,
          size: true,
          refType: true,
          refId: true,
          locations: {
            where: { isPrimary: true },
            select: { provider: { select: { type: true } } },
          },
        },
      }),
      this.accessService.getConnectedFileIdSet(),
    ]);

    // Hanya hitung file yang ada di direktori upload lokal (atau provider remote aktif)
    const validFiles = allFiles.filter((f) => {
      const hasRemote = f.locations.some((l) => l.provider?.type !== "LOCAL");
      if (hasRemote) return true;
      return isLocalFileInUploadDir(f.path);
    });

    const totalFiles = validFiles.length;
    const totalBytes = validFiles.reduce((sum, f) => sum + (f.size || 0), 0);

    // Hitung per subfolder
    const folderStatsMap: Record<
      string,
      { folder: string; label: string; count: number; totalBytes: number; color: string; description: string }
    > = {};
    for (const [folderKey, meta] of Object.entries(SUBFOLDER_METADATA)) {
      folderStatsMap[folderKey] = {
        folder: folderKey,
        label: meta.label,
        count: 0,
        totalBytes: 0,
        color: meta.color,
        description: meta.description,
      };
    }

    let orphanCount = 0;
    let orphanSize = 0;

    for (const f of validFiles) {
      const sf = getSubfolderFromPath(f.path);
      if (!folderStatsMap[sf]) {
        folderStatsMap[sf] = {
          folder: sf,
          label: sf,
          count: 0,
          totalBytes: 0,
          color: "#64748B",
          description: `Folder ${sf}`,
        };
      }
      folderStatsMap[sf]!.count++;
      folderStatsMap[sf]!.totalBytes += f.size || 0;

      const isConnected = (f.refType && f.refType.trim() !== "") || connectedSet.has(f.id);
      if (!isConnected) {
        orphanCount++;
        orphanSize += f.size || 0;
      }
    }

    const subfolders = Object.values(folderStatsMap)
      .filter((s) => s.count > 0)
      .sort((a, b) => b.count - a.count);

    const recentFiles = recentFilesRaw
      .filter((f) => {
        const hasRemote = f.locations.some((l) => l.provider?.type !== "LOCAL");
        if (hasRemote) return true;
        return isLocalFileInUploadDir(f.path);
      })
      .slice(0, 8);

    return {
      totalFiles,
      totalBytes,
      orphanFiles: orphanCount,
      orphanBytes: orphanSize,
      deletedFiles: deletedCount,
      subfolders,
      categories: categories.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        count: c._count.files,
      })),
      providers: providers.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        isDefault: p.isDefault,
        status: p.status,
        count: p._count.locations,
      })),
      recentFiles,
    };
  }

  /**
   * Informasi kapasitas penyimpanan server fisik tempat Akuntra berjalan
   */
  async getServerStorage() {
    try {
      const cwd = process.cwd();
      const sfs = await statfs(cwd);
      const total = Number(sfs.blocks) * Number(sfs.bsize);
      const free = Number(sfs.bavail) * Number(sfs.bsize);
      const used = Math.max(0, total - free);

      // Hitung ukuran folder uploads lokal jika memungkinkan
      let uploadFolderBytes = 0;
      const uploadDir = join(cwd, "uploads");
      try {
        const scanDir = async (dir: string): Promise<number> => {
          let b = 0;
          const entries = await readdir(dir, { withFileTypes: true });
          for (const ent of entries) {
            const p = join(dir, ent.name);
            if (ent.isDirectory()) {
              b += await scanDir(p);
            } else if (ent.isFile()) {
              const s = await stat(p);
              b += s.size;
            }
          }
          return b;
        };
        uploadFolderBytes = await scanDir(uploadDir);
      } catch {}

      return {
        diskTotal: total,
        diskUsed: used,
        diskFree: free,
        diskUsedPercent: total > 0 ? Math.round((used / total) * 100) : 0,
        uploadsSizeBytes: uploadFolderBytes,
        serverPath: cwd,
      };
    } catch (e) {
      return {
        diskTotal: 0,
        diskUsed: 0,
        diskFree: 0,
        diskUsedPercent: 0,
        uploadsSizeBytes: 0,
        error: (e as Error).message,
      };
    }
  }

  /**
   * List file dengan pencarian, filter, relasi dokumen & kontrol hak akses
   */
  async listFiles(query: ListFilesQuery, user: RequestUser) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 50)));

    const where: any = {};

    // Soft delete
    if (String(query.showDeleted) === "true") {
      where.deletedAt = { not: null };
    } else {
      where.deletedAt = null;
    }

    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { originalName: { contains: q } },
        { displayName: { contains: q } },
        { fileCode: { contains: q } },
        { description: { contains: q } },
        { path: { contains: q } },
      ];
    }

    if (query.categoryId) where.categoryId = Number(query.categoryId);
    if (query.kind) where.kind = query.kind;
    if (query.status) where.status = query.status;

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }

    if (query.providerId) {
      where.locations = {
        some: {
          providerId: Number(query.providerId),
          isPrimary: true,
        },
      };
    }

    if (query.folder && query.folder !== "all") {
      where.path = { contains: query.folder.toLowerCase().trim() };
    }

    const rawFiles = await this.prisma.main.file.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        category: { select: { id: true, name: true, code: true } },
        uploader: { select: { id: true, name: true, role: true } },
        locations: {
          where: { isPrimary: true },
          include: {
            provider: { select: { id: true, name: true, type: true } },
          },
        },
      },
    });

    // 1. Filter keluar berkas di luar folder upload server (kecuali primary provider remote aktif)
    const validRawFiles = rawFiles.filter((f) => {
      const hasRemoteLoc = f.locations.some((l) => l.isPrimary && l.provider?.type !== "LOCAL");
      if (hasRemoteLoc) return true;
      return isLocalFileInUploadDir(f.path);
    });

    // 2. Filter per subfolder presisi jika diminta
    let folderFiltered = validRawFiles;
    if (query.folder && query.folder !== "all") {
      const targetFolder = query.folder.toLowerCase().trim();
      folderFiltered = validRawFiles.filter((f) => getSubfolderFromPath(f.path) === targetFolder);
    }

    // 3. Filter orphan secara cepat jika query.isOrphan diberikan
    let candidateFiles = folderFiltered;
    if (query.isOrphan !== undefined) {
      const wantOrphan = String(query.isOrphan) === "true";
      const connectedSet = await this.accessService.getConnectedFileIdSet();
      candidateFiles = folderFiltered.filter((f) => {
        const isConnected = (f.refType && f.refType.trim() !== "") || connectedSet.has(f.id);
        return wantOrphan ? !isConnected : isConnected;
      });
    }

    const total = candidateFiles.length;
    const skip = (page - 1) * limit;
    const paginatedSlice = candidateFiles.slice(skip, skip + limit);

    // Enrich HANYA untuk item pada halaman ini (sangat cepat, <20ms)
    const hasFullPerm = (user.role || "").toUpperCase() === "SUPER_ADMIN" || can(user.role, "fileManagement", "P");

    const enrichedItems = await Promise.all(
      paginatedSlice.map(async (f) => {
        const sf = getSubfolderFromPath(f.path);
        const sfMeta = SUBFOLDER_METADATA[sf];
        const usedBy = await this.accessService.resolveConnectedDocuments(f.id);
        const isOrphan = usedBy.length === 0;

        let isAllowed = hasFullPerm;
        if (!isAllowed) {
          if (isOrphan) {
            isAllowed = false;
          } else {
            isAllowed = usedBy.some(
              (doc) => can(user.role, doc.moduleKey, "L") || can(user.role, doc.moduleKey, "M"),
            );
          }
        }

        const primaryLoc = f.locations[0] ?? null;

        return {
          id: f.id,
          fileCode: f.fileCode || `FILE-${f.id}`,
          originalName: f.originalName,
          displayName: f.displayName || f.originalName,
          extension: f.extension,
          mimeType: f.mimeType,
          size: f.size,
          kind: f.kind,
          status: f.status,
          visibility: f.visibility,
          checksumSha256: f.checksumSha256,
          description: f.description,
          createdAt: f.createdAt,
          deletedAt: f.deletedAt,
          category: f.category,
          uploader: f.uploader,
          provider: primaryLoc?.provider ?? { id: 0, name: "Server Lokal", type: "LOCAL" },
          storageKey: primaryLoc?.storageKey ?? f.path,
          subfolder: sf,
          subfolderLabel: sfMeta?.label ?? sf,
          subfolderColor: sfMeta?.color ?? "#64748B",
          usedBy,
          isOrphan,
          isAllowed,
          downloadUrl: `/api/files/${f.id}`,
        };
      }),
    );

    const items = enrichedItems.filter((i) => i.isAllowed);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Detail satu file lengkap
   */
  async getFileDetail(id: number, user: RequestUser) {
    const file = await this.prisma.main.file.findUnique({
      where: { id },
      include: {
        category: true,
        uploader: { select: { id: true, name: true, role: true } },
        versions: {
          orderBy: { versionNumber: "desc" },
        },
        locations: {
          include: {
            provider: { select: { id: true, name: true, type: true } },
          },
        },
        permissions: true,
        shares: {
          where: { revokedAt: null },
        },
      },
    });

    if (!file) throw new NotFoundException("File tidak ditemukan");

    // Periksa hak akses
    const allowed = await this.accessService.canAccessFile(user, file.id, "VIEW");
    if (!allowed) {
      throw new ForbiddenException("Kamu tidak memiliki hak akses untuk membuka file ini.");
    }

    const usedBy = await this.accessService.resolveConnectedDocuments(file.id);
    const primaryLoc = file.locations.find((l) => l.isPrimary) ?? file.locations[0] ?? null;

    return {
      ...file,
      fileCode: file.fileCode || `FILE-${file.id}`,
      displayName: file.displayName || file.originalName,
      usedBy,
      isOrphan: usedBy.length === 0,
      primaryLocation: primaryLoc,
      downloadUrl: `/api/files/${file.id}`,
    };
  }

  /**
   * Update metadata file (nama tampilan, deskripsi, kategori, visibilitas)
   */
  async updateMetadata(
    id: number,
    dto: { displayName?: string; description?: string; categoryId?: number; visibility?: string },
    user: RequestUser,
  ) {
    const allowed = await this.accessService.canAccessFile(user, id, "EDIT");
    if (!allowed) throw new ForbiddenException("Kamu tidak memiliki hak akses untuk mengedit file ini.");

    const updated = await this.prisma.main.file.update({
      where: { id },
      data: {
        ...(dto.displayName ? { displayName: dto.displayName.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId || null } : {}),
        ...(dto.visibility ? { visibility: dto.visibility } : {}),
      },
    });

    // Catat audit log
    await this.prisma.main.fileAuditLog.create({
      data: {
        fileId: id,
        userId: user.id,
        action: "UPDATE_METADATA",
        metadata: dto,
      },
    });

    return updated;
  }

  /**
   * Ganti berkas (Replace File) -> Menghasilkan versi baru (PRD §4.3)
   */
  async replaceFile(
    id: number,
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    user: RequestUser,
  ) {
    const file = await this.prisma.main.file.findUnique({
      where: { id },
      include: {
        locations: { where: { isPrimary: true } },
        versions: { orderBy: { versionNumber: "desc" }, take: 1 },
      },
    });
    if (!file) throw new NotFoundException("File tidak ditemukan");

    const allowed = await this.accessService.canAccessFile(user, id, "EDIT");
    if (!allowed) throw new ForbiddenException("Kamu tidak memiliki hak akses untuk mengganti file ini.");

    const nextVerNum = (file.versions[0]?.versionNumber ?? 1) + 1;
    const checksum = createHash("sha256").update(buffer).digest("hex");

    // Tentukan provider yang digunakan (gunakan provider lokasi primer sekarang)
    const currentLoc = file.locations[0];
    const providerId = currentLoc?.providerId ?? (await this.providerService.getDefaultProvider()).id;
    const adapter = await this.providerService.getAdapter(providerId);

    // Format target key baru sesuai struktur folder modul lokal
    const subfolder = getSubfolderFromPath(file.path) || "dokumen";
    const safeName = originalName.replace(/[^\w.\- ()]/g, "_").slice(0, 100);
    const targetKey = `${subfolder}/${id}_v${nextVerNum}__${safeName}`;

    // Upload berkas baru ke adapter
    const upRes = await adapter.upload(targetKey, buffer, { mimeType });

    // Update database dalam transaksi
    const result = await this.prisma.main.$transaction(async (tx) => {
      // 1. Buat FileVersion baru
      const newVersion = await tx.fileVersion.create({
        data: {
          fileId: id,
          versionNumber: nextVerNum,
          fileName: safeName,
          fileSize: buffer.length,
          mimeType,
          checksumSha256: checksum,
          createdById: user.id,
          changeNotes: `Diunggah oleh ${user.name}`,
          status: "CURRENT",
        },
      });

      // 2. Set versi lama menjadi SUPERSEDED
      await tx.fileVersion.updateMany({
        where: { fileId: id, id: { not: newVersion.id } },
        data: { status: "SUPERSEDED" },
      });

      // 3. Buat FileStorageLocation baru untuk versi ini
      await tx.fileStorageLocation.create({
        data: {
          fileId: id,
          versionId: newVersion.id,
          providerId,
          storageKey: targetKey,
          externalFileId: upRes.externalFileId ?? null,
          isPrimary: true,
          replicaStatus: "PRIMARY",
          verificationStatus: "VERIFIED",
          lastVerifiedAt: new Date(),
        },
      });

      // 4. Nonaktifkan primary lama
      if (currentLoc) {
        await tx.fileStorageLocation.update({
          where: { id: currentLoc.id },
          data: { isPrimary: false },
        });
      }

      // 5. Update data utama file
      const ext = originalName.includes(".") ? originalName.split(".").pop()?.toLowerCase() : file.extension;
      return tx.file.update({
        where: { id },
        data: {
          currentVersionId: newVersion.id,
          originalName: safeName,
          displayName: safeName,
          size: buffer.length,
          mimeType,
          extension: ext ?? null,
          checksumSha256: checksum,
          updatedAt: new Date(),
        },
      });
    });

    // Audit log
    await this.prisma.main.fileAuditLog.create({
      data: {
        fileId: id,
        versionId: result.currentVersionId,
        userId: user.id,
        action: "REPLACE_FILE",
        metadata: { originalName, size: buffer.length, version: nextVerNum },
      },
    });

    return this.getFileDetail(id, user);
  }

  /**
   * Hapus / bersihkan salinan lokal berkas yang sudah dimigrasikan ke NAS / S3.
   * Hanya menghapus file fisik di server lokal untuk menghemat kapasitas disk.
   * File primer di NAS tetap aman dan dokumen ERP tetap terhubung tanpa gangguan.
   */
  async cleanupLocalCopy(id: number, user: RequestUser) {
    const file = await this.prisma.main.file.findUnique({
      where: { id },
      include: {
        locations: { include: { provider: true } },
      },
    });

    if (!file) throw new NotFoundException("Berkas tidak ditemukan");

    // Periksa hak akses (membutuhkan hak UPDATE di modul dokumen atau file management)
    const allowed = await this.accessService.canAccessFile(user, id, "EDIT");
    if (!allowed) throw new ForbiddenException("Kamu tidak memiliki hak akses untuk membersihkan berkas ini.");

    // Cari lokasi primer di eksternal
    const primary = file.locations.find((l) => l.isPrimary);
    if (!primary || primary.provider?.type === "LOCAL") {
      throw new BadRequestException("Berkas belum dimigrasikan ke penyimpanan eksternal (NAS/S3).");
    }

    // Verifikasi berkas di penyimpanan eksternal benar-benar ada dan sehat sebelum menghapus lokal
    const adapter = await this.providerService.getAdapter(primary.providerId);
    const meta = await adapter.getMetadata(primary.storageKey);
    if (!meta || meta.size === 0) {
      throw new BadRequestException("Gagal membersihkan: Berkas di NAS belum terverifikasi utuh.");
    }

    // Cari lokasi lokal yang berstatus PENDING_CLEANUP atau lokal non-primer
    const localLocs = file.locations.filter(
      (l) => !l.isPrimary && (l.provider?.type === "LOCAL" || l.replicaStatus === "PENDING_CLEANUP"),
    );

    let cleaned = false;
    for (const loc of localLocs) {
      const roots = getUploadRoots();
      for (const root of roots) {
        const fullPath = resolve(root, normalizeRelativeUploadPath(loc.storageKey));
        if (existsSync(fullPath)) {
          try {
            await unlink(fullPath);
            cleaned = true;
          } catch {}
        }
      }

      await this.prisma.main.fileStorageLocation.update({
        where: { id: loc.id },
        data: { replicaStatus: "CLEANED" },
      });
    }

    await this.prisma.main.fileAuditLog.create({
      data: {
        fileId: id,
        userId: user.id,
        action: "CLEANUP_LOCAL_COPY",
        metadata: { primaryStorageKey: primary.storageKey, provider: primary.provider?.name },
      },
    });

    return {
      ok: true,
      cleaned,
      message: "Salinan cadangan lokal berhasil dibersihkan. Berkas primer di NAS tetap aman dan aktif.",
    };
  }

  /**
   * Hapus file (Soft delete).
   * File yang masih digunakan dokumen TIDAK BISA DIHAPUS kecuali Super Admin dengan force=true.
   */
  async deleteFile(id: number, user: RequestUser, force: boolean = false) {
    const file = await this.prisma.main.file.findUnique({ where: { id } });
    if (!file) throw new NotFoundException("File tidak ditemukan");

    const isSuperAdmin = (user.role || "").toUpperCase() === "SUPER_ADMIN" || (user.role || "").toUpperCase() === "SUPERADMIN";

    const allowed = isSuperAdmin || (await this.accessService.canAccessFile(user, id, "DELETE"));
    if (!allowed) throw new ForbiddenException("Kamu tidak memiliki hak akses untuk menghapus file ini.");

    const usedBy = await this.accessService.resolveConnectedDocuments(id);
    const inUse = usedBy.length > 0;

    if (inUse) {
      if (!isSuperAdmin) {
        throw new BadRequestException(
          `File ini masih digunakan oleh ${usedBy.length} dokumen (${usedBy.map((d) => d.label).join(", ")}). File terpakai tidak dapat dihapus.`,
        );
      }
      if (!force) {
        throw new BadRequestException(
          `File masih digunakan oleh ${usedBy.length} dokumen. Konfirmasikan 'force=true' jika Super Admin ingin tetap menghapusnya secara paksa.`,
        );
      }
    }

    // Soft delete
    await this.prisma.main.file.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: "PENDING_DELETION",
      },
    });

    await this.prisma.main.fileAuditLog.create({
      data: {
        fileId: id,
        userId: user.id,
        action: force ? "FORCE_DELETE" : "SOFT_DELETE",
        metadata: { inUse, connectedCount: usedBy.length },
      },
    });

    return { ok: true, message: "File berhasil dipindahkan ke tempat sampah (soft delete)." };
  }

  /**
   * Hapus permanen file yatim secara massal
   */
  async bulkDeleteOrphans(fileIds: number[], user: RequestUser) {
    const isSuperAdmin = (user.role || "").toUpperCase() === "SUPER_ADMIN";
    const hasPerm = isSuperAdmin || can(user.role, "fileManagement", "P");
    if (!hasPerm) {
      throw new ForbiddenException("Hanya Super Admin atau pengelola file berwenang yang dapat menghapus file yatim.");
    }

    let deletedCount = 0;
    const errors: string[] = [];

    for (const id of fileIds) {
      const usedBy = await this.accessService.resolveConnectedDocuments(id);
      if (usedBy.length > 0) {
        errors.push(`File #${id} tidak dihapus karena ternyata terhubung ke dokumen`);
        continue;
      }
      await this.prisma.main.file.update({
        where: { id },
        data: { deletedAt: new Date(), status: "DELETED" },
      });
      deletedCount++;
    }

    return {
      ok: true,
      deletedCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `Berhasil menghapus ${deletedCount} file yatim.`,
    };
  }

  /**
   * Buat Share Link untuk file (PRD §7.4)
   */
  async createShareLink(fileId: number, dto: CreateShareDto, user: RequestUser) {
    const file = await this.prisma.main.file.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException("File tidak ditemukan");

    const allowed = await this.accessService.canAccessFile(user, fileId, "VIEW");
    if (!allowed) throw new ForbiddenException("Kamu tidak memiliki hak untuk membagikan file ini.");

    // Generate random secure token
    const rawToken = randomBytes(24).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    const expiresAt = new Date(dto.expiresAt);
    if (isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException("Tanggal kedaluwarsa tautan wajib diisi di masa depan.");
    }

    let passwordHash: string | null = null;
    if (dto.password?.trim()) {
      passwordHash = await bcrypt.hash(dto.password.trim(), 10);
    }

    const share = await this.prisma.main.fileShare.create({
      data: {
        fileId,
        tokenHash,
        permission: dto.permission || "VIEW",
        expiresAt,
        passwordHash,
        oneTime: Boolean(dto.oneTime),
        createdById: user.id,
      },
    });

    return {
      id: share.id,
      shareToken: rawToken, // Dikembalikan sekali kepada pembuat
      shareUrl: `/api/share/${rawToken}`,
      expiresAt: share.expiresAt,
      permission: share.permission,
      oneTime: share.oneTime,
      hasPassword: Boolean(passwordHash),
    };
  }

  /**
   * Akses publik ke file melalui Share Token
   */
  async accessSharedFile(token: string, password?: string, ip?: string, userAgent?: string) {
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const share = await this.prisma.main.fileShare.findUnique({
      where: { tokenHash },
      include: {
        file: {
          include: {
            locations: { where: { isPrimary: true }, include: { provider: true } },
          },
        },
      },
    });

    if (!share || share.revokedAt) {
      throw new NotFoundException("Tautan berbagi tidak ditemukan atau telah dicabut.");
    }

    if (share.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException("Tautan berbagi ini sudah kedaluwarsa.");
    }

    if (share.oneTime && share.usedAt) {
      throw new BadRequestException("Tautan berbagi sekali pakai ini telah digunakan sebelumnya.");
    }

    // Periksa password jika dilindungi sandi
    if (share.passwordHash) {
      if (!password) {
        throw new BadRequestException("Tautan ini dilindungi kata sandi. Masukkan password.");
      }
      const match = await bcrypt.compare(password, share.passwordHash);
      if (!match) {
        await this.prisma.main.fileShareAccessLog.create({
          data: { shareId: share.id, ip, userAgent, success: false, reason: "Password salah" },
        });
        throw new ForbiddenException("Kata sandi yang dimasukkan salah.");
      }
    }

    // Ambil binary dari adapter primer
    const primaryLoc = share.file.locations[0];
    const providerId = primaryLoc?.providerId ?? (await this.providerService.getDefaultProvider()).id;
    const adapter = await this.providerService.getAdapter(providerId);
    const key = primaryLoc?.storageKey ?? share.file.path;

    const buffer = await adapter.download(key);

    // Tandai usedAt jika oneTime
    if (share.oneTime) {
      await this.prisma.main.fileShare.update({
        where: { id: share.id },
        data: { usedAt: new Date() },
      });
    }

    // Catat log akses sukses
    await this.prisma.main.fileShareAccessLog.create({
      data: { shareId: share.id, ip, userAgent, success: true },
    });

    return {
      buffer,
      fileName: share.file.originalName,
      mimeType: share.file.mimeType,
      size: buffer.length,
      permission: share.permission,
    };
  }
}
