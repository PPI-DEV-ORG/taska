import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service.js";
import { FileProviderService } from "./provider.service.js";
import { FileAccessService } from "./file-access.service.js";
import {
  isLocalFileInUploadDir,
  getSubfolderFromPath,
  normalizeRelativeUploadPath,
} from "./file-utils.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";

export type StartMigrationDto = {
  sourceProviderId: number;
  targetProviderId: number;
  folder?: string; // subfolder target (misal: "penawaran", "invoice", atau undefined / "all" = semua)
  olderThanDays?: number;
  includeOrphans?: boolean; // Default false (sesuai arahan user, file lepas tidak ikut)
};

@Injectable()
export class FileMigrationService {
  private readonly logger = new Logger(FileMigrationService.name);
  private runningJobs = new Set<number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerService: FileProviderService,
    private readonly accessService: FileAccessService,
  ) {}

  /**
   * Preview filter migrasi sebelum dieksekusi: hitung berkas valid, berkas lepas & estimasi byte
   */
  async previewMigration(params: {
    sourceProviderId: number;
    targetProviderId?: number;
    folder?: string;
    olderThanDays?: number;
  }) {
    const sourceId = Number(params.sourceProviderId);
    if (!sourceId || isNaN(sourceId)) {
      return {
        sourceProvider: null,
        targetProvider: null,
        folder: params.folder || "all",
        olderThanDays: null,
        eligibleFilesCount: 0,
        eligibleTotalBytes: 0,
        excludedOrphansCount: 0,
        sampleFiles: [],
      };
    }

    const targetId = params.targetProviderId && !isNaN(Number(params.targetProviderId))
      ? Number(params.targetProviderId)
      : undefined;

    const [src, tgt] = await Promise.all([
      this.prisma.main.fileStorageProvider.findUnique({ where: { id: sourceId } }),
      targetId ? this.prisma.main.fileStorageProvider.findUnique({ where: { id: targetId } }) : null,
    ]);

    const cutoffDate = params.olderThanDays && Number(params.olderThanDays) > 0
      ? new Date(Date.now() - Number(params.olderThanDays) * 86400 * 1000)
      : undefined;

    const folderFilter = params.folder && params.folder !== "all"
      ? params.folder.toLowerCase().trim()
      : undefined;

    let candidateFiles: Array<{
      id: number;
      createdAt: Date;
      displayName: string | null;
      originalName: string;
      path: string;
      size: number;
      refType: string | null;
    }> = [];

    if (src?.type === "LOCAL") {
      candidateFiles = await this.prisma.main.file.findMany({
        where: {
          deletedAt: null,
          status: "AVAILABLE",
          ...(cutoffDate ? { createdAt: { lte: cutoffDate } } : {}),
        },
        select: {
          id: true,
          createdAt: true,
          displayName: true,
          originalName: true,
          path: true,
          size: true,
          refType: true,
        },
        take: 3000,
      });

      candidateFiles = candidateFiles.filter((f) => isLocalFileInUploadDir(f.path));
      if (folderFilter) {
        candidateFiles = candidateFiles.filter((f) => getSubfolderFromPath(f.path) === folderFilter);
      }
    } else {
      const locs = await this.prisma.main.fileStorageLocation.findMany({
        where: {
          providerId: sourceId,
          isPrimary: true,
          file: {
            status: "AVAILABLE",
            deletedAt: null,
            ...(cutoffDate ? { createdAt: { lte: cutoffDate } } : {}),
          },
        },
        include: {
          file: {
            select: { id: true, createdAt: true, displayName: true, originalName: true, path: true, size: true, refType: true },
          },
        },
        take: 3000,
      });
      candidateFiles = locs.map((l) => l.file);
      if (folderFilter) {
        candidateFiles = candidateFiles.filter((f) => getSubfolderFromPath(f.path) === folderFilter);
      }
    }

    if (candidateFiles.length === 0) {
      return {
        sourceProvider: src ? { id: src.id, name: src.name, type: src.type } : null,
        targetProvider: tgt ? { id: tgt.id, name: tgt.name, type: tgt.type } : null,
        folder: params.folder || "all",
        olderThanDays: params.olderThanDays ? Number(params.olderThanDays) : null,
        eligibleFilesCount: 0,
        eligibleTotalBytes: 0,
        excludedOrphansCount: 0,
        sampleFiles: [],
      };
    }

    const connectedSet = await this.accessService.getConnectedFileIdSet();
    const eligibleFiles: typeof candidateFiles = [];
    let eligibleBytes = 0;
    let excludedOrphans = 0;

    for (const f of candidateFiles) {
      const isConnected = (f.refType && f.refType.trim() !== "") || connectedSet.has(f.id);
      if (isConnected) {
        eligibleFiles.push(f);
        eligibleBytes += f.size || 0;
      } else {
        excludedOrphans++;
      }
    }

    return {
      sourceProvider: src ? { id: src.id, name: src.name, type: src.type } : null,
      targetProvider: tgt ? { id: tgt.id, name: tgt.name, type: tgt.type } : null,
      folder: params.folder || "all",
      olderThanDays: params.olderThanDays ? Number(params.olderThanDays) : null,
      eligibleFilesCount: eligibleFiles.length,
      eligibleTotalBytes: eligibleBytes,
      excludedOrphansCount: excludedOrphans,
      sampleFiles: eligibleFiles.slice(0, 5).map((f) => ({
        id: f.id,
        name: f.displayName || f.originalName,
        size: f.size,
      })),
    };
  }

  /**
   * Mulai job migrasi manual atau terjadwal
   */
  async startMigration(
    dto: StartMigrationDto,
    user?: RequestUser,
    mode: "MANUAL" | "SCHEDULED" = "MANUAL",
    scheduleId?: number,
  ) {
    if (dto.sourceProviderId === dto.targetProviderId) {
      throw new BadRequestException("Provider sumber dan provider tujuan tidak boleh sama");
    }

    const [src, tgt] = await Promise.all([
      this.prisma.main.fileStorageProvider.findUnique({ where: { id: dto.sourceProviderId } }),
      this.prisma.main.fileStorageProvider.findUnique({ where: { id: dto.targetProviderId } }),
    ]);

    if (!src) throw new NotFoundException("Provider sumber tidak ditemukan");
    if (!tgt) throw new NotFoundException("Provider tujuan tidak ditemukan");
    if (tgt.status === "READ_ONLY") {
      throw new BadRequestException("Provider tujuan dalam status READ_ONLY dan tidak menerima file baru");
    }

    // Jika sumber adalah Server Lokal, pastikan lokasi primer tercatat
    if (src.type === "LOCAL") {
      const filesNeedingLocation = await this.prisma.main.file.findMany({
        where: {
          deletedAt: null,
          status: "AVAILABLE",
          locations: { none: { providerId: src.id } },
        },
        select: {
          id: true,
          path: true,
          size: true,
          mimeType: true,
          originalName: true,
          versions: {
            take: 1,
            select: { id: true },
          },
        },
        take: 3000,
      });

      for (const f of filesNeedingLocation) {
        let versionId = f.versions[0]?.id;
        if (!versionId) {
          const v = await this.prisma.main.fileVersion.create({
            data: {
              fileId: f.id,
              versionNumber: 1,
              fileName: f.originalName || "file",
              fileSize: f.size || 0,
              mimeType: f.mimeType || "application/octet-stream",
              status: "CURRENT",
            },
          });
          versionId = v.id;
        }

        await this.prisma.main.fileStorageLocation.create({
          data: {
            fileId: f.id,
            versionId,
            providerId: src.id,
            storageKey: f.path,
            isPrimary: true,
            replicaStatus: "PRIMARY",
            verificationStatus: "VERIFIED",
          },
        });
      }
    }

    // Cari lokasi file yang ada di sourceProvider dan berstatus PRIMARY
    const cutoffDate = dto.olderThanDays && dto.olderThanDays > 0
      ? new Date(Date.now() - dto.olderThanDays * 86400 * 1000)
      : undefined;

    const candidateLocations = await this.prisma.main.fileStorageLocation.findMany({
      where: {
        providerId: dto.sourceProviderId,
        isPrimary: true,
        file: {
          status: "AVAILABLE",
          deletedAt: null,
          ...(cutoffDate ? { createdAt: { lte: cutoffDate } } : {}),
          ...(dto.folder && dto.folder !== "all" ? { path: { contains: dto.folder.toLowerCase().trim() } } : {}),
        },
      },
      include: {
        file: {
          select: { id: true, createdAt: true, originalName: true, path: true, size: true, refType: true },
        },
        version: {
          select: { id: true, versionNumber: true, fileName: true, checksumSha256: true },
        },
      },
      take: 2000,
    });

    if (candidateLocations.length === 0) {
      throw new BadRequestException("Tidak ada file yang memenuhi syarat untuk dimigrasikan");
    }

    // Filter file lepas jika includeOrphans !== true secara cepat (batch)
    const connectedSet = await this.accessService.getConnectedFileIdSet();
    const eligibleLocations: typeof candidateLocations = [];

    for (const loc of candidateLocations) {
      if (dto.includeOrphans) {
        eligibleLocations.push(loc);
      } else {
        const isConnected = (loc.file.refType && loc.file.refType.trim() !== "") || connectedSet.has(loc.fileId);
        if (isConnected) {
          eligibleLocations.push(loc);
        }
      }
    }

    if (eligibleLocations.length === 0) {
      throw new BadRequestException(
        "Semua file yang ditemukan adalah file lepas (standalone). Sesuai kebijakan, file lepas tidak diikutsertakan dalam migrasi.",
      );
    }

    // Buat record job
    const job = await this.prisma.main.fileMigrationJob.create({
      data: {
        sourceProviderId: dto.sourceProviderId,
        targetProviderId: dto.targetProviderId,
        mode,
        scheduleId,
        olderThanDays: dto.olderThanDays,
        status: "RUNNING",
        totalFiles: eligibleLocations.length,
        processedFiles: 0,
        failedFiles: 0,
        cleanedFiles: 0,
        startedAt: new Date(),
        createdById: user?.id,
      },
    });

    // Buat item job
    await this.prisma.main.fileMigrationItem.createMany({
      data: eligibleLocations.map((loc) => ({
        jobId: job.id,
        fileId: loc.fileId,
        versionId: loc.versionId,
        status: "PENDING",
        sourceLocationId: loc.id,
      })),
      skipDuplicates: true,
    });

    // Jalankan background runner tanpa memblokir HTTP response
    this.processJob(job.id).catch((e) => {
      this.logger.error(`Error pada runner job migrasi #${job.id}: ${(e as Error).message}`);
    });

    return this.getJobDetail(job.id);
  }

  /**
   * Background processor untuk job migrasi
   */
  private async processJob(jobId: number) {
    if (this.runningJobs.has(jobId)) return;
    this.runningJobs.add(jobId);

    try {
      const job = await this.prisma.main.fileMigrationJob.findUnique({
        where: { id: jobId },
        include: {
          items: {
            where: { status: { in: ["PENDING", "FAILED"] } },
          },
        },
      });

      if (!job || job.items.length === 0) {
        await this.prisma.main.fileMigrationJob.update({
          where: { id: jobId },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
        return;
      }

      const srcAdapter = await this.providerService.getAdapter(job.sourceProviderId);
      const tgtAdapter = await this.providerService.getAdapter(job.targetProviderId);

      for (const item of job.items) {
        try {
          const loc = await this.prisma.main.fileStorageLocation.findUnique({
            where: { id: item.sourceLocationId ?? 0 },
            include: { file: true, version: true },
          });

          if (!loc) {
            await this.prisma.main.fileMigrationItem.update({
              where: { id: item.id },
              data: { status: "FAILED", error: "Lokasi sumber tidak ditemukan", attempts: item.attempts + 1 },
            });
            continue;
          }

          // 1. Download dari sumber
          const buffer = await srcAdapter.download(loc.storageKey);
          const computedChecksum = createHash("sha256").update(buffer).digest("hex");

          // 2. Buat target key sesuai struktur folder modul lokal (foto-profil/..., penawaran/...)
          let targetKey: string;
          const cleanLocalPath = normalizeRelativeUploadPath(loc.file.path || loc.storageKey);
          if (cleanLocalPath && cleanLocalPath.includes("/")) {
            // Path lokal sudah punya folder nama modul (e.g. "penawaran/xxx.pdf", "foto-profil/xxx.png")
            targetKey = cleanLocalPath;
          } else {
            const subfolder = getSubfolderFromPath(loc.file.path || loc.storageKey) || "dokumen";
            const safeName = (loc.version.fileName || loc.file.originalName || "berkas")
              .replace(/[^\w.\- ()]/g, "_")
              .slice(0, 100);
            targetKey = `${subfolder}/${safeName}`;
          }

          // 3. Upload ke target
          const upRes = await tgtAdapter.upload(targetKey, buffer, { mimeType: loc.version.mimeType });

          // 4. Verifikasi di target: metadata, size, dan jika perlu read ulang
          const meta = await tgtAdapter.getMetadata(targetKey);
          if (!meta) {
            throw new Error("File berhasil diupload ke target namun tidak terdeteksi saat diverifikasi");
          }
          if (meta.size !== buffer.length) {
            throw new Error(`Ukuran file tidak cocok (diunggah: ${buffer.length}, terbaca di target: ${meta.size})`);
          }

          // 5. Transaksi DB: tandai target sebagai PRIMARY & verified; tandai sumber sebagai PENDING_CLEANUP
          await this.prisma.main.$transaction(async (tx) => {
            // Lokasi target baru
            const newLoc = await tx.fileStorageLocation.create({
              data: {
                fileId: loc.fileId,
                versionId: loc.versionId,
                providerId: job.targetProviderId,
                storageKey: targetKey,
                externalFileId: upRes.externalFileId ?? null,
                isPrimary: true,
                replicaStatus: "PRIMARY",
                verificationStatus: "VERIFIED",
                lastVerifiedAt: new Date(),
              },
            });

            // Update path berkas utama ke targetKey baru
            await tx.file.update({
              where: { id: loc.fileId },
              data: { path: targetKey },
            });

            // Ubah lokasi sumber menjadi REPLICA / PENDING_CLEANUP
            await tx.fileStorageLocation.update({
              where: { id: loc.id },
              data: {
                isPrimary: false,
                replicaStatus: "PENDING_CLEANUP",
              },
            });

            // Update item
            await tx.fileMigrationItem.update({
              where: { id: item.id },
              data: {
                status: "SUCCESS",
                checksum: computedChecksum,
                targetLocationId: newLoc.id,
                error: null,
              },
            });

            // Update counter job
            await tx.fileMigrationJob.update({
              where: { id: jobId },
              data: {
                processedFiles: { increment: 1 },
              },
            });
          });
        } catch (itemErr) {
          this.logger.warn(`Gagal migrasi file #${item.fileId}: ${(itemErr as Error).message}`);
          await this.prisma.main.fileMigrationItem.update({
            where: { id: item.id },
            data: {
              status: "FAILED",
              error: (itemErr as Error).message,
              attempts: item.attempts + 1,
            },
          });
          await this.prisma.main.fileMigrationJob.update({
            where: { id: jobId },
            data: {
              failedFiles: { increment: 1 },
            },
          });
        }
      }

      // Selesai
      const finalCount = await this.prisma.main.fileMigrationItem.count({
        where: { jobId, status: "FAILED" },
      });

      await this.prisma.main.fileMigrationJob.update({
        where: { id: jobId },
        data: {
          status: finalCount > 0 ? "PARTIAL" : "COMPLETED",
          completedAt: new Date(),
        },
      });
    } finally {
      this.runningJobs.delete(jobId);
    }
  }

  /**
   * Bersihkan file lokal sumber setelah migrasi berhasil dan terverifikasi ulang (PRD §5.5)
   */
  async cleanupJobFiles(jobId: number, user: RequestUser) {
    const job = await this.prisma.main.fileMigrationJob.findUnique({
      where: { id: jobId },
      include: {
        items: {
          where: { status: "SUCCESS" },
          include: {
            job: true,
          },
        },
      },
    });
    if (!job) throw new NotFoundException("Job migrasi tidak ditemukan");

    const srcAdapter = await this.providerService.getAdapter(job.sourceProviderId);
    const tgtAdapter = await this.providerService.getAdapter(job.targetProviderId);

    let cleaned = 0;
    const errors: string[] = [];

    for (const item of job.items) {
      if (!item.sourceLocationId || !item.targetLocationId) continue;

      const [srcLoc, tgtLoc] = await Promise.all([
        this.prisma.main.fileStorageLocation.findUnique({ where: { id: item.sourceLocationId } }),
        this.prisma.main.fileStorageLocation.findUnique({ where: { id: item.targetLocationId } }),
      ]);

      if (!srcLoc || srcLoc.replicaStatus === "CLEANED") continue;
      if (!tgtLoc || !tgtLoc.isPrimary) {
        errors.push(`File #${item.fileId}: Lokasi target bukan primary, pembersihan lokal dibatalkan`);
        continue;
      }

      // Verifikasi ulang target fisik
      const targetExists = await tgtAdapter.exists(tgtLoc.storageKey);
      if (!targetExists) {
        errors.push(`File #${item.fileId}: Target tidak ditemukan di penyimpanan eksternal! Pembersihan lokal dicegah.`);
        continue;
      }

      // Hapus dari penyimpanan sumber
      try {
        await srcAdapter.delete(srcLoc.storageKey);
        await this.prisma.main.fileStorageLocation.update({
          where: { id: srcLoc.id },
          data: { replicaStatus: "CLEANED" },
        });
        cleaned++;
      } catch (delErr) {
        errors.push(`File #${item.fileId}: Gagal menghapus file lokal: ${(delErr as Error).message}`);
      }
    }

    await this.prisma.main.fileMigrationJob.update({
      where: { id: jobId },
      data: {
        cleanedFiles: { increment: cleaned },
      },
    });

    return {
      ok: true,
      cleanedCount: cleaned,
      errors: errors.length > 0 ? errors : undefined,
      message: `Berhasil membersihkan ${cleaned} berkas dari penyimpanan sumber.`,
    };
  }

  /**
   * Rollback migrasi jika file sumber belum dihapus (PRD §5.5)
   */
  async rollbackJob(jobId: number, user: RequestUser) {
    const job = await this.prisma.main.fileMigrationJob.findUnique({
      where: { id: jobId },
      include: {
        items: {
          where: { status: "SUCCESS" },
        },
      },
    });
    if (!job) throw new NotFoundException("Job migrasi tidak ditemukan");

    let rolledBack = 0;
    const tgtAdapter = await this.providerService.getAdapter(job.targetProviderId);

    for (const item of job.items) {
      if (!item.sourceLocationId || !item.targetLocationId) continue;

      const [srcLoc, tgtLoc] = await Promise.all([
        this.prisma.main.fileStorageLocation.findUnique({ where: { id: item.sourceLocationId } }),
        this.prisma.main.fileStorageLocation.findUnique({ where: { id: item.targetLocationId } }),
      ]);

      if (!srcLoc || srcLoc.replicaStatus === "CLEANED") {
        continue; // Jika file sumber sudah dibersihkan, tidak bisa dirollback
      }

      if (tgtLoc) {
        try {
          // Hapus objek di target
          await tgtAdapter.delete(tgtLoc.storageKey);
        } catch {}

        await this.prisma.main.$transaction(async (tx) => {
          // Kembalikan sumber menjadi PRIMARY
          await tx.fileStorageLocation.update({
            where: { id: srcLoc.id },
            data: { isPrimary: true, replicaStatus: "PRIMARY" },
          });

          await tx.file.update({
            where: { id: srcLoc.fileId },
            data: { path: srcLoc.storageKey },
          });

          // Hapus lokasi target
          await tx.fileStorageLocation.delete({ where: { id: tgtLoc.id } });

          // Update status item
          await tx.fileMigrationItem.update({
            where: { id: item.id },
            data: { status: "ROLLED_BACK", targetLocationId: null },
          });
        });
        rolledBack++;
      }
    }

    await this.prisma.main.fileMigrationJob.update({
      where: { id: jobId },
      data: { status: "ROLLED_BACK" },
    });

    return {
      ok: true,
      rolledBackCount: rolledBack,
      message: `Berhasil me-rollback ${rolledBack} berkas kembali ke lokasi sumber semula.`,
    };
  }

  /**
   * Ulangi item yang gagal pada suatu job
   */
  async retryJob(jobId: number) {
    const job = await this.prisma.main.fileMigrationJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException("Job tidak ditemukan");

    await this.prisma.main.fileMigrationJob.update({
      where: { id: jobId },
      data: { status: "RUNNING" },
    });

    this.processJob(jobId).catch((e) => {
      this.logger.error(`Error retry job #${jobId}: ${(e as Error).message}`);
    });

    return { ok: true, message: "Proses retry job migrasi telah dimulai di latar belakang." };
  }

  async listJobs(limit = 50) {
    return this.prisma.main.fileMigrationJob.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        _count: {
          select: { items: true },
        },
      },
    });
  }

  async getJobDetail(id: number) {
    const job = await this.prisma.main.fileMigrationJob.findUnique({
      where: { id },
      include: {
        items: {
          take: 100,
          orderBy: { id: "asc" },
        },
      },
    });
    if (!job) throw new NotFoundException("Job tidak ditemukan");
    return job;
  }
}
