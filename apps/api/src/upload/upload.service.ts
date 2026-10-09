import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, normalize, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service.js";
import { SettingsService } from "../settings/settings.service.js";
import { validateUpload } from "../common/utils/upload.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";

export type UploadKind = "foto" | "dokumen" | "video";

const CONTENT_TYPE: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  zip: "application/zip",
  mp4: "video/mp4",
  mkv: "video/x-matroska",
};

@Injectable()
export class UploadService {
  private readonly root: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    config: ConfigService,
  ) {
    this.root = resolve(config.get<string>("UPLOAD_DIR") ?? "./uploads");
  }

  private async store(
    buffer: Buffer,
    kind: UploadKind,
    originalName: string | undefined,
    user: RequestUser,
    refType?: string,
    refId?: string,
  ) {
    const max = await this.settings.getNumber(`upload.maksimal.${kind}`);
    const ext = validateUpload(buffer, kind, max);

    const now = new Date();
    const period = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
    const safeName = originalName
      ? originalName.replace(/[^\w.\- ()]/g, "_").slice(0, 120)
      : `upload.${ext}`;
    const rel = `${period}/${randomUUID()}__${safeName}`;
    const abs = join(this.root, rel);

    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, buffer);

    const row = await this.prisma.main.file.create({
      data: {
        path: rel,
        originalName: safeName,
        mimeType: CONTENT_TYPE[ext] ?? "application/octet-stream",
        size: buffer.length,
        kind: kind === "foto" ? "FOTO" : kind === "video" ? "VIDEO" : "DOKUMEN",
        refType: refType ?? null,
        refId: refId ?? null,
        uploadedById: user.id,
      },
    });

    return {
      id: row.id,
      url: `/api/files/${row.id}`,
      originalName: row.originalName,
      size: row.size,
      mimeType: row.mimeType,
      ext,
      createdAt: row.createdAt,
    };
  }

  /** Simpan file hasil upload (nama asli dipertahankan). */
  saveNamed(
    buffer: Buffer,
    kind: UploadKind,
    originalName: string | undefined,
    user: RequestUser,
    refType?: string,
    refId?: string,
  ) {
    return this.store(buffer, kind, originalName, user, refType, refId);
  }

  async read(id: number) {
    const row = await this.prisma.main.file.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("File tidak ditemukan");

    const abs = normalize(join(this.root, row.path));
    if (!abs.startsWith(this.root)) throw new BadRequestException("Path tidak valid");
    try {
      await stat(abs);
    } catch {
      throw new NotFoundException("Berkas tidak ada di penyimpanan");
    }

    return {
      buffer: await readFile(abs),
      contentType: row.mimeType,
      name: row.originalName,
      size: row.size,
    };
  }

  async meta(id: number) {
    const row = await this.prisma.main.file.findUnique({
      where: { id },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        size: true,
        kind: true,
        refType: true,
        refId: true,
        createdAt: true,
      },
    });
    if (!row) throw new NotFoundException("File tidak ditemukan");
    return { ...row, url: `/api/files/${row.id}` };
  }
}
