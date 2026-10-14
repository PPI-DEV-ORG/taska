import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { existsSync } from "node:fs";
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
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  csv: "text/csv",
  doc: "application/msword",
  zip: "application/zip",
  mp4: "video/mp4",
  mkv: "video/x-matroska",
};

export function resolveUploadFolder(
  categoryOrRefType?: string,
  originalName?: string,
  ext?: string,
  kind?: string,
): string {
  const c = (categoryOrRefType || "").toLowerCase().trim();
  const name = (originalName || "").toLowerCase().trim();

  // 1. Kategori eksplisit & refType
  if (c === "foto-profil" || c.includes("profil") || c.includes("avatar") || c.includes("profile")) return "foto-profil";
  if (c === "foto-struk" || c.includes("struk") || c.includes("expense") || c.includes("reimburse") || c.includes("nota") || c.includes("biaya")) return "foto-struk";
  if (c === "penawaran" || c.includes("penawaran") || c.includes("quotation")) return "penawaran";
  if (c === "opname" || c.includes("opname")) return "opname";
  if (c === "surat-jalan" || c.includes("surat-jalan") || c.includes("delivery-note") || c.includes("delivery")) return "surat-jalan";
  if (c === "laporan-kerusakan" || c.includes("kerusakan") || c.includes("damage")) return "laporan-kerusakan";
  if (c === "request-barang" || c.includes("request") || c.includes("permintaan") || c.includes("purchase-request")) return "request-barang";
  if (c === "po-supplier" || c.includes("po-supplier") || c.includes("supplier-po")) return "po-supplier";
  if (c === "penerimaan" || c.includes("penerimaan") || c.includes("receiving")) return "penerimaan";
  if (c === "survey" || c.includes("survey")) return "survey";
  if (c.includes("proyek") || c.includes("project") || c.includes("dokumentasi")) return "dokumentasi-proyek";
  if (c.includes("invoice") || c.includes("tagihan")) return "invoice";
  if (c.includes("whatsapp")) return "whatsapp";

  // 2. Deteksi dari nama file asli
  if (name.includes("profil") || name.includes("avatar")) return "foto-profil";
  if (name.includes("nota") || name.includes("struk") || name.includes("kwitansi") || name.includes("reimburse")) return "foto-struk";
  if (name.includes("penawaran") || name.includes("quotation")) return "penawaran";
  if (name.includes("opname")) return "opname";
  if (name.includes("surat_jalan") || name.includes("surat-jalan") || name.startsWith("sj")) return "surat-jalan";
  if (name.includes("rusak") || name.includes("damage")) return "laporan-kerusakan";
  if (name.includes("request") || name.includes("boq")) return "request-barang";
  if (name.includes("po-s") || name.includes("supplier")) return "po-supplier";
  if (name.includes("surat") || name.includes("do-")) return "penerimaan";

  // 3. Fallback berdasarkan jenis file
  if (["png", "jpg", "jpeg", "webp"].includes(ext ?? "") || kind === "foto") return "foto-dokumen";
  if (["mp4", "mkv"].includes(ext ?? "") || kind === "video") return "video";
  return "dokumen";
}

@Injectable()
export class UploadService {
  private readonly root: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    config: ConfigService,
  ) {
    const raw = config.get<string>("UPLOAD_DIR") ?? "./uploads";
    if (raw.startsWith("/app") && !existsSync("/app")) {
      const fallback = existsSync(resolve(process.cwd(), "uploads"))
        ? resolve(process.cwd(), "uploads")
        : resolve(process.cwd(), "apps/api/uploads");
      this.root = fallback;
    } else {
      this.root = resolve(raw);
    }
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
    let ext = validateUpload(buffer, kind, max);
    if (originalName) {
      const lower = originalName.toLowerCase();
      if (lower.endsWith(".xlsx")) ext = "xlsx";
      else if (lower.endsWith(".xls")) ext = "xls";
      else if (lower.endsWith(".csv")) ext = "csv";
    }

    const folder = resolveUploadFolder(refType, originalName, ext, kind);
    const safeName = originalName
      ? originalName.replace(/[^\w.\- ()]/g, "_").slice(0, 120)
      : `upload.${ext}`;
    const rel = `${folder}/${Date.now()}-${randomUUID().slice(0, 8)}__${safeName}`;
    let abs = join(this.root, rel);

    try {
      await mkdir(dirname(abs), { recursive: true });
    } catch {
      const localRoot = resolve(process.cwd().includes("apps/api") ? "./uploads" : "./apps/api/uploads");
      abs = join(localRoot, rel);
      await mkdir(dirname(abs), { recursive: true });
    }
    await writeFile(abs, buffer);

    const row = await this.prisma.main.file.create({
      data: {
        path: rel,
        originalName: safeName,
        mimeType: CONTENT_TYPE[ext] ?? "application/octet-stream",
        size: buffer.length,
        kind: ["png", "jpg", "webp"].includes(ext) ? "FOTO" : kind === "video" ? "VIDEO" : "DOKUMEN",
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

  /** Simpan buffer dokumen langsung (misal Excel penawaran otomatis/upload). */
  async saveBufferDirect(
    buffer: Buffer,
    originalName: string,
    ext: keyof typeof CONTENT_TYPE,
    userId?: number,
    refType?: string,
    refId?: string,
  ) {
    const folder = resolveUploadFolder(refType, originalName, ext, "dokumen");
    const safeName = originalName.replace(/[^\w.\- ()]/g, "_").slice(0, 120);
    const rel = `${folder}/${Date.now()}-${randomUUID().slice(0, 8)}__${safeName}`;
    let abs = join(this.root, rel);

    try {
      await mkdir(dirname(abs), { recursive: true });
    } catch {
      const localRoot = resolve(process.cwd().includes("apps/api") ? "./uploads" : "./apps/api/uploads");
      abs = join(localRoot, rel);
      await mkdir(dirname(abs), { recursive: true });
    }
    await writeFile(abs, buffer);

    const row = await this.prisma.main.file.create({
      data: {
        path: rel,
        originalName: safeName,
        mimeType: CONTENT_TYPE[ext] ?? "application/octet-stream",
        size: buffer.length,
        kind: "DOKUMEN",
        refType: refType ?? null,
        refId: refId ?? null,
        uploadedById: userId ?? null,
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

  async read(id: number) {
    const row = await this.prisma.main.file.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("File tidak ditemukan");

    let abs = normalize(join(this.root, row.path));
    try {
      await stat(abs);
    } catch {
      const alt = resolve(process.cwd().includes("apps/api") ? "./uploads" : "./apps/api/uploads", row.path);
      if (existsSync(alt)) {
        abs = alt;
      } else {
        throw new NotFoundException("Berkas tidak ada di penyimpanan");
      }
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
