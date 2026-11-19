import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaService } from "../prisma/prisma.service.js";
import { FileCryptoService } from "./crypto.service.js";
import { LocalFsAdapter } from "./adapters/local-fs.adapter.js";
import { S3Adapter, type S3Config, type S3Secret } from "./adapters/s3.adapter.js";
import { WebDavAdapter, type WebDavConfig, type WebDavSecret } from "./adapters/webdav.adapter.js";
import type { BrowseEntry, HealthResult, StorageAdapter } from "./adapters/types.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";

export type CreateProviderDto = {
  name: string;
  type: "LOCAL" | "S3" | "NAS_MOUNT" | "WEBDAV";
  config: Record<string, any>;
  credentials?: Record<string, any>;
  isDefault?: boolean;
};

export type UpdateProviderDto = {
  name?: string;
  config?: Record<string, any>;
  credentials?: Record<string, any>;
  status?: "ACTIVE" | "DISABLED" | "READ_ONLY";
  isDefault?: boolean;
};

@Injectable()
export class FileProviderService implements OnModuleInit {
  private readonly logger = new Logger(FileProviderService.name);
  private readonly adapterCache = new Map<number, StorageAdapter>();
  private localUploadRoots: string[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly crypto: FileCryptoService,
  ) {
    const raw = this.config.get<string>("UPLOAD_DIR") ?? "./uploads";
    const primary = resolve(raw);
    const roots = [primary];
    const cwdUploads = resolve(process.cwd(), "uploads");
    const apiUploads = resolve(process.cwd(), "apps/api/uploads");
    if (existsSync(cwdUploads) && !roots.includes(cwdUploads)) roots.push(cwdUploads);
    if (existsSync(apiUploads) && !roots.includes(apiUploads)) roots.push(apiUploads);
    this.localUploadRoots = roots;
  }

  async onModuleInit() {
    await this.ensureLocalDefaultProvider();
    await this.syncEnvProviders();
  }

  /**
   * Pastikan provider Server Lokal selalu ada di DB dan menjadi default awal.
   */
  async ensureLocalDefaultProvider() {
    try {
      const existing = await this.prisma.main.fileStorageProvider.findFirst({
        where: { type: "LOCAL" },
      });
      if (!existing) {
        await this.prisma.main.fileStorageProvider.create({
          data: {
            name: "Server Lokal",
            type: "LOCAL",
            adapterCode: "local",
            config: { root: this.localUploadRoots[0] },
            source: "DB",
            status: "ACTIVE",
            isDefault: true,
          },
        });
        this.logger.log("Provider 'Server Lokal' berhasil didaftarkan sebagai default.");
      }
    } catch (e) {
      this.logger.error(`Gagal menginisialisasi provider lokal: ${(e as Error).message}`);
    }
  }

  /**
   * Sinkronisasi provider dari environment variable jika ada.
   * Format:
   * FILE_STORAGE_MINIO_TYPE=S3
   * FILE_STORAGE_MINIO_ENDPOINT=http://localhost:9000
   * FILE_STORAGE_MINIO_BUCKET=akuntra
   * FILE_STORAGE_MINIO_ACCESS_KEY=minioadmin
   * FILE_STORAGE_MINIO_SECRET_KEY=minioadmin
   */
  private async syncEnvProviders() {
    const env = process.env;
    const prefix = "FILE_STORAGE_";
    const discovered = new Set<string>();

    for (const key of Object.keys(env)) {
      if (key.startsWith(prefix) && key.endsWith("_TYPE")) {
        const namePart = key.slice(prefix.length, -5);
        if (namePart) discovered.add(namePart);
      }
    }

    for (const namePart of discovered) {
      const type = (env[`${prefix}${namePart}_TYPE`] ?? "").toUpperCase();
      const pName = `ENV: ${namePart.toLowerCase()}`;
      try {
        if (type === "S3") {
          const endpoint = env[`${prefix}${namePart}_ENDPOINT`];
          const bucket = env[`${prefix}${namePart}_BUCKET`];
          const region = env[`${prefix}${namePart}_REGION`];
          const s3Prefix = env[`${prefix}${namePart}_PREFIX`];
          const accessKeyId = env[`${prefix}${namePart}_ACCESS_KEY`];
          const secretAccessKey = env[`${prefix}${namePart}_SECRET_KEY`];

          if (bucket && accessKeyId && secretAccessKey) {
            const secretEnc = this.crypto.isKeyConfigured()
              ? this.crypto.encrypt({ accessKeyId, secretAccessKey })
              : null;

            await this.prisma.main.fileStorageProvider.upsert({
              where: { name: pName },
              update: {
                type: "S3",
                adapterCode: "s3",
                config: { endpoint, bucket, region, prefix: s3Prefix },
                ...(secretEnc ? { secretEnc } : {}),
                source: "ENV",
                status: "ACTIVE",
              },
              create: {
                name: pName,
                type: "S3",
                adapterCode: "s3",
                config: { endpoint, bucket, region, prefix: s3Prefix },
                secretEnc,
                source: "ENV",
                status: "ACTIVE",
                isDefault: false,
              },
            });
            this.logger.log(`Provider ENV S3 '${pName}' tersinkronisasi.`);
          }
        }
      } catch (err) {
        this.logger.warn(`Gagal sinkronisasi provider ENV ${namePart}: ${(err as Error).message}`);
      }
    }
  }

  /**
   * Dapatkan instance StorageAdapter berdasarkan ID provider
   */
  async getAdapter(providerId: number): Promise<StorageAdapter> {
    const cached = this.adapterCache.get(providerId);
    if (cached) return cached;

    const row = await this.prisma.main.fileStorageProvider.findUnique({
      where: { id: providerId },
    });
    if (!row) throw new NotFoundException(`Storage provider id=${providerId} tidak ditemukan`);

    const adapter = this.buildAdapter(row);
    this.adapterCache.set(providerId, adapter);
    return adapter;
  }

  /**
   * Bangun adapter dari konfigurasi provider & kredensial terenkripsi
   */
  buildAdapter(provider: {
    type: string;
    config: any;
    secretEnc: string | null;
  }): StorageAdapter {
    const cfg = (provider.config || {}) as Record<string, any>;

    switch (provider.type) {
      case "LOCAL": {
        const root = cfg.root ? [String(cfg.root)] : this.localUploadRoots;
        return new LocalFsAdapter("local", root);
      }
      case "NAS_MOUNT": {
        const mountPath = String(cfg.mountPath || cfg.path || "");
        if (!mountPath) throw new BadRequestException("Mount path NAS wajib diisi");
        return new LocalFsAdapter("nas_mount", [mountPath]);
      }
      case "S3": {
        let creds: S3Secret = { accessKeyId: "", secretAccessKey: "" };
        if (provider.secretEnc) {
          try {
            creds = this.crypto.decrypt<S3Secret>(provider.secretEnc);
          } catch (e) {
            throw new BadRequestException(
              "Gagal mendekripsi kredensial S3. Kemungkinan FILE_SECRET_KEY diubah. Silakan masukkan ulang kredensial.",
            );
          }
        }
        const s3Cfg: S3Config = {
          endpoint: cfg.endpoint,
          region: cfg.region,
          bucket: cfg.bucket,
          prefix: cfg.prefix,
          pathStyle: cfg.pathStyle,
        };
        return new S3Adapter(s3Cfg, creds);
      }
      case "WEBDAV": {
        let creds: WebDavSecret = { username: "", password: "" };
        if (provider.secretEnc) {
          try {
            creds = this.crypto.decrypt<WebDavSecret>(provider.secretEnc);
          } catch (e) {
            throw new BadRequestException(
              "Gagal mendekripsi kredensial WebDAV. Silakan masukkan ulang kredensial.",
            );
          }
        }
        const webdavCfg: WebDavConfig = {
          url: cfg.url,
          prefix: cfg.prefix,
        };
        return new WebDavAdapter(webdavCfg, creds);
      }
      default:
        throw new BadRequestException(`Tipe provider storage '${provider.type}' belum didukung`);
    }
  }

  /**
   * Tes koneksi lengkap: cek health, coba tulis berkas uji kecil, verifikasi pembacaan & checksum, lalu hapus.
   */
  async testAdapter(adapter: StorageAdapter): Promise<HealthResult> {
    const health = await adapter.healthCheck();
    if (!health.ok) {
      return health;
    }

    // Uji tulis dan baca
    const probeKey = `__probe_akuntra_${Date.now()}_${randomBytes(4).toString("hex")}.tmp`;
    const testContent = Buffer.from(
      `Akuntra Probe Test @ ${new Date().toISOString()} - ${probeKey}`,
      "utf8",
    );
    const expectedChecksum = createHash("sha256").update(testContent).digest("hex");

    try {
      await adapter.upload(probeKey, testContent, { mimeType: "text/plain" });
      const readBack = await adapter.download(probeKey);
      const actualChecksum = createHash("sha256").update(readBack).digest("hex");
      if (actualChecksum !== expectedChecksum) {
        throw new Error("Verifikasi integritas file uji gagal (checksum mismatch saat membaca ulang)");
      }
      await adapter.delete(probeKey);
      return {
        ok: true,
        latencyMs: health.latencyMs,
        capacity: health.capacity,
        message: "Koneksi berhasil dan hak akses baca-tulis terverifikasi.",
      };
    } catch (err) {
      try {
        await adapter.delete(probeKey);
      } catch {}
      return {
        ok: false,
        latencyMs: health.latencyMs,
        message: `Gagal verifikasi tulis/baca: ${(err as Error).message}`,
      };
    }
  }

  /**
   * Dapatkan provider default aktif
   */
  async getDefaultProvider(): Promise<{ id: number; name: string; adapter: StorageAdapter }> {
    const p = await this.prisma.main.fileStorageProvider.findFirst({
      where: { isDefault: true, status: "ACTIVE" },
    });
    if (p) {
      return { id: p.id, name: p.name, adapter: await this.getAdapter(p.id) };
    }
    // Fallback: provider type LOCAL
    const local = await this.prisma.main.fileStorageProvider.findFirst({
      where: { type: "LOCAL", status: "ACTIVE" },
    });
    if (local) {
      return { id: local.id, name: local.name, adapter: await this.getAdapter(local.id) };
    }
    throw new NotFoundException("Tidak ada storage provider aktif yang dapat digunakan");
  }

  /**
   * List semua provider dengan ringkasan & kesehatan
   */
  async listProviders() {
    const rows = await this.prisma.main.fileStorageProvider.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      include: {
        _count: {
          select: { locations: true },
        },
      },
    });

    const results = await Promise.all(
      rows.map(async (row) => {
        let health: HealthResult | null = null;
        try {
          const adapter = await this.getAdapter(row.id);
          health = await adapter.healthCheck();
        } catch (e) {
          health = { ok: false, latencyMs: 0, message: (e as Error).message };
        }

        // Sensor file count & bytes
        const filesCount = await this.prisma.main.fileStorageLocation.count({
          where: { providerId: row.id, file: { status: "AVAILABLE" } },
        });

        // Non-secret config presentation
        const safeConfig = { ...(row.config as Record<string, any>) };

        return {
          id: row.id,
          name: row.name,
          type: row.type,
          adapterCode: row.adapterCode,
          config: safeConfig,
          source: row.source,
          status: row.status,
          isDefault: row.isDefault,
          needsReauth: row.needsReauth,
          lastOkAt: row.lastOkAt,
          lastError: row.lastError,
          uploadOk: row.uploadOk,
          uploadFail: row.uploadFail,
          fileCount: filesCount,
          totalFiles: row._count.locations,
          createdAt: row.createdAt,
          health,
          hasCredentials: Boolean(row.secretEnc),
        };
      }),
    );

    return results;
  }

  async getProviderDetail(id: number) {
    const row = await this.prisma.main.fileStorageProvider.findUnique({
      where: { id },
      include: {
        _count: {
          select: { locations: true },
        },
      },
    });
    if (!row) throw new NotFoundException("Provider tidak ditemukan");

    let health: HealthResult | null = null;
    try {
      const adapter = await this.getAdapter(row.id);
      health = await adapter.healthCheck();
    } catch (e) {
      health = { ok: false, latencyMs: 0, message: (e as Error).message };
    }

    const fileCount = await this.prisma.main.fileStorageLocation.count({
      where: { providerId: row.id, file: { status: "AVAILABLE" } },
    });

    return {
      ...row,
      secretEnc: undefined, // jangan pernah ekspos ciphertext ke luar
      hasCredentials: Boolean(row.secretEnc),
      fileCount,
      health,
    };
  }

  /**
   * Tambah provider baru dari UI (Wajib lolos test koneksi sebelum simpan)
   */
  async createProvider(dto: CreateProviderDto, user: RequestUser) {
    if (!dto.name?.trim()) throw new BadRequestException("Nama provider wajib diisi");

    const existing = await this.prisma.main.fileStorageProvider.findUnique({
      where: { name: dto.name.trim() },
    });
    if (existing) throw new BadRequestException(`Provider dengan nama '${dto.name}' sudah ada`);

    let secretEnc: string | null = null;
    if (dto.credentials && Object.keys(dto.credentials).length > 0) {
      if (!this.crypto.isKeyConfigured()) {
        throw new BadRequestException(
          "FILE_SECRET_KEY belum diisi di file .env server. Kredensial tidak dapat disimpan secara aman.",
        );
      }
      secretEnc = this.crypto.encrypt(dto.credentials);
    }

    // Bangun adapter sementara untuk verifikasi koneksi & hak akses
    const tempAdapter = this.buildAdapter({
      type: dto.type,
      config: dto.config,
      secretEnc,
    });

    const testRes = await this.testAdapter(tempAdapter);
    if (!testRes.ok) {
      throw new BadRequestException(
        `Gagal menyambungkan ke storage: ${testRes.message || "Koneksi ditolak"}. Penyimpanan tidak disimpan.`,
      );
    }

    // Jika diset default, cabut default dari provider lain
    if (dto.isDefault) {
      await this.prisma.main.fileStorageProvider.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const adapterCode =
      dto.type === "S3" ? "s3" : dto.type === "WEBDAV" ? "webdav" : dto.type === "NAS_MOUNT" ? "nas_mount" : "local";

    const created = await this.prisma.main.fileStorageProvider.create({
      data: {
        name: dto.name.trim(),
        type: dto.type,
        adapterCode,
        config: dto.config ?? {},
        secretEnc,
        source: "DB",
        status: "ACTIVE",
        isDefault: Boolean(dto.isDefault),
        lastOkAt: new Date(),
      },
    });

    this.adapterCache.delete(created.id);
    return this.getProviderDetail(created.id);
  }

  /**
   * Update provider (jika kredensial/config diubah, dites lagi)
   */
  async updateProvider(id: number, dto: UpdateProviderDto, user: RequestUser) {
    const current = await this.prisma.main.fileStorageProvider.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Provider tidak ditemukan");

    if (current.source === "ENV" && (dto.config || dto.credentials)) {
      throw new BadRequestException("Provider yang dikonfigurasi melalui .env tidak dapat diedit konfigurasi/kredensialnya lewat UI");
    }

    let secretEnc = current.secretEnc;
    if (dto.credentials && Object.keys(dto.credentials).length > 0) {
      if (!this.crypto.isKeyConfigured()) {
        throw new BadRequestException("FILE_SECRET_KEY belum diisi di .env.");
      }
      secretEnc = this.crypto.encrypt(dto.credentials);
    }

    const nextConfig = dto.config ? { ...(current.config as any), ...dto.config } : current.config;

    // Jika config atau credential berubah, tes ulang koneksi
    if (dto.config || dto.credentials) {
      const tempAdapter = this.buildAdapter({
        type: current.type,
        config: nextConfig,
        secretEnc,
      });
      const testRes = await this.testAdapter(tempAdapter);
      if (!testRes.ok) {
        throw new BadRequestException(`Pengujian koneksi gagal: ${testRes.message}. Perubahan dibatalkan.`);
      }
    }

    if (dto.isDefault) {
      await this.prisma.main.fileStorageProvider.updateMany({
        where: { id: { not: id }, isDefault: true },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.main.fileStorageProvider.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.config ? { config: nextConfig } : {}),
        ...(dto.credentials ? { secretEnc, needsReauth: false } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
      },
    });

    this.adapterCache.delete(id);
    return this.getProviderDetail(updated.id);
  }

  /**
   * Tes koneksi provider yang sudah ada
   */
  async testExistingProvider(id: number) {
    const adapter = await this.getAdapter(id);
    const res = await this.testAdapter(adapter);
    await this.prisma.main.fileStorageProvider.update({
      where: { id },
      data: {
        lastOkAt: res.ok ? new Date() : undefined,
        lastError: res.ok ? null : res.message,
      },
    });
    return res;
  }

  /**
   * Set provider sebagai default
   */
  async setDefault(id: number) {
    const row = await this.prisma.main.fileStorageProvider.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Provider tidak ditemukan");
    if (row.status !== "ACTIVE") throw new BadRequestException("Hanya provider dengan status ACTIVE yang dapat dijadikan default");

    await this.prisma.main.fileStorageProvider.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
    await this.prisma.main.fileStorageProvider.update({
      where: { id },
      data: { isDefault: true },
    });
    return { ok: true, message: `Provider '${row.name}' sekarang menjadi default upload.` };
  }

  /**
   * Hapus provider (Ditolak keras jika masih ada file di provider ini sesuai PRD §5.1 / §6.3)
   */
  async deleteProvider(id: number) {
    const row = await this.prisma.main.fileStorageProvider.findUnique({
      where: { id },
      include: {
        _count: { select: { locations: true } },
      },
    });
    if (!row) throw new NotFoundException("Provider tidak ditemukan");
    if (row.type === "LOCAL") {
      throw new BadRequestException("Provider 'Server Lokal' tidak boleh dihapus.");
    }
    if (row._count.locations > 0) {
      throw new BadRequestException(
        `Provider '${row.name}' tidak dapat dihapus karena masih menyimpan ${row._count.locations} lokasi file. Migrasikan seluruh file terlebih dahulu.`,
      );
    }
    if (row.isDefault) {
      throw new BadRequestException("Provider default tidak dapat dihapus. Pindahkan default ke provider lain terlebih dahulu.");
    }

    await this.prisma.main.fileStorageProvider.delete({ where: { id } });
    this.adapterCache.delete(id);
    return { ok: true, message: `Provider '${row.name}' berhasil dihapus.` };
  }

  /**
   * Jelajah isi penyimpanan eksternal (Folder/File browsing)
   */
  async browseProvider(id: number, prefix: string = ""): Promise<BrowseEntry[]> {
    const adapter = await this.getAdapter(id);
    return adapter.list(prefix);
  }
}
