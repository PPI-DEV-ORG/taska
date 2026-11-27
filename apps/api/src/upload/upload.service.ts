import { BadRequestException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join, normalize, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service.js";
import { SettingsService } from "../settings/settings.service.js";
import { validateUpload } from "../common/utils/upload.js";
import { FileProviderService } from "../file-management/provider.service.js";
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
  md: "text/markdown",
  markdown: "text/markdown",
  txt: "text/plain",
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
  if (c === "absensi" || c.includes("absen") || c.includes("attendance")) return "absensi";
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
    @Optional() private readonly providerService?: FileProviderService,
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
    let ext = validateUpload(buffer, kind, max, originalName);
    if (originalName) {
      const lower = originalName.toLowerCase();
      if (lower.endsWith(".xlsx")) ext = "xlsx";
      else if (lower.endsWith(".xls")) ext = "xls";
      else if (lower.endsWith(".csv")) ext = "csv";
      else if (lower.endsWith(".md") || lower.endsWith(".markdown")) ext = "md";
      else if (lower.endsWith(".txt")) ext = "txt";
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
    const checksum = createHash("sha256").update(buffer).digest("hex");
    const mime = CONTENT_TYPE[ext] ?? "application/octet-stream";
    const fileKind = ["png", "jpg", "webp"].includes(ext) ? "FOTO" : kind === "video" ? "VIDEO" : "DOKUMEN";

    // 1. Dapatkan provider default jika providerService aktif
    let defProvider: { id: number; adapter: any } | null = null;
    if (this.providerService) {
      try {
        defProvider = await this.providerService.getDefaultProvider();
      } catch {}
    }

    // 2. Simpan binary: jika provider eksternal, upload ke adapter; jika lokal atau tanpa provider, simpan ke disk
    let storageKey = rel;
    let externalFileId: string | null = null;

    if (defProvider && defProvider.adapter?.code !== "local") {
      storageKey = rel;
      try {
        const upRes = await defProvider.adapter.upload(storageKey, buffer, { mimeType: mime });
        externalFileId = upRes.externalFileId ?? null;
      } catch (err) {
        // Fallback simpan lokal jika upload eksternal gagal
        storageKey = rel;
        await writeFile(abs, buffer);
      }
    } else {
      await writeFile(abs, buffer);
    }

    const fileCode = `FILE-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    // 3. Simpan entitas File
    const row = await this.prisma.main.file.create({
      data: {
        path: storageKey,
        originalName: safeName,
        displayName: safeName,
        mimeType: mime,
        size: buffer.length,
        kind: fileKind,
        refType: refType ?? null,
        refId: refId ?? null,
        uploadedById: user.id,
        extension: ext,
        checksumSha256: checksum,
        fileCode,
        status: "AVAILABLE",
      },
    });

    // 4. Buat FileVersion dan FileStorageLocation
    try {
      const v = await this.prisma.main.fileVersion.create({
        data: {
          fileId: row.id,
          versionNumber: 1,
          fileName: safeName,
          fileSize: buffer.length,
          mimeType: mime,
          checksumSha256: checksum,
          createdById: user.id,
          status: "CURRENT",
        },
      });

      if (defProvider) {
        await this.prisma.main.fileStorageLocation.create({
          data: {
            fileId: row.id,
            versionId: v.id,
            providerId: defProvider.id,
            storageKey,
            externalFileId,
            isPrimary: true,
            replicaStatus: "PRIMARY",
            verificationStatus: "VERIFIED",
          },
        });
      }

      await this.prisma.main.file.update({
        where: { id: row.id },
        data: { currentVersionId: v.id },
      });
    } catch {}

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
    const row = await this.prisma.main.file.findUnique({
      where: { id },
      include: {
        locations: { include: { provider: true } },
      },
    });
    if (!row) throw new NotFoundException("File tidak ditemukan");

    // 1. Coba baca dari provider lokasi primer jika provider eksternal
    const primaryLoc = row.locations.find((l) => l.isPrimary) ?? row.locations[0];
    if (primaryLoc && this.providerService && primaryLoc.provider?.type !== "LOCAL") {
      try {
        const adapter = await this.providerService.getAdapter(primaryLoc.providerId);
        const buf = await adapter.download(primaryLoc.storageKey);
        return {
          buffer: buf,
          contentType: row.mimeType,
          name: row.originalName,
          size: buf.length,
        };
      } catch (adapterErr) {
        // Fallback otomatis baca salinan lokal jika NAS offline/gagal
      }
    }

    // 2. Baca dari penyimpanan lokal (fallback aman pasca-migrasi atau default lokal)
    const localLoc = row.locations.find(
      (l) => l.provider?.type === "LOCAL" || l.replicaStatus === "PENDING_CLEANUP",
    );
    const filePath = localLoc?.storageKey || row.path;
    let abs = normalize(join(this.root, filePath));
    try {
      await stat(abs);
    } catch {
      const alt = resolve(process.cwd().includes("apps/api") ? "./uploads" : "./apps/api/uploads", filePath);
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

  async isFileReferenced(id: number): Promise<boolean> {
    if (!id || typeof id !== "number" || isNaN(id)) return false;

    const idStr = String(id);
    const checks = await Promise.all([
      // 1. Dokumentasi Foto
      this.prisma.main.documentationPhoto.findFirst({ where: { fileId: id }, select: { id: true } }),
      // 2. Faktur Penjualan (InvoiceOut)
      this.prisma.main.invoiceOut.findFirst({
        where: { OR: [{ fileId: id }, { paidFileId: id }, { latestFileId: id }] },
        select: { id: true },
      }),
      // 3. Pembayaran Faktur (Payment)
      this.prisma.main.payment.findFirst({ where: { fileId: id }, select: { id: true } }),
      // 4. Pengeluaran / Biaya (Expense)
      this.prisma.main.expense.findFirst({
        where: {
          OR: [
            { receiptFileId: id },
            { paidFileId: id },
            { receiptFileIds: { contains: idStr } },
          ],
        },
        select: { id: true },
      }),
      // 5. Permintaan Barang (PurchaseRequest)
      this.prisma.main.purchaseRequest.findFirst({
        where: { OR: [{ evidenceFileId: id }, { doFileId: id }, { paymentProofFileId: id }] },
        select: { id: true },
      }),
      // 6. PO Pemasok (SupplierPO)
      this.prisma.main.supplierPO.findFirst({
        where: { OR: [{ fileId: id }, { doFileId: id }, { soFileId: id }] },
        select: { id: true },
      }),
      // 7. Surat Jalan (DeliveryNote)
      this.prisma.main.deliveryNote.findFirst({
        where: { OR: [{ scanFileId: id }, { reportFileId: id }] },
        select: { id: true },
      }),
      // 8. Proyek (Project)
      this.prisma.main.project.findFirst({
        where: {
          OR: [
            { prdFileId: id },
            { bahpFileId: id },
            { bastFileId: id },
            { doFileId: id },
            { boqFileId: id },
          ],
        },
        select: { id: true },
      }),
      // 9. Tugas Proyek (Task)
      this.prisma.main.task.findFirst({
        where: { OR: [{ bahpFileId: id }, { bastFileId: id }, { doFileId: id }] },
        select: { id: true },
      }),
      // 10. PO Klien (ClientPO)
      this.prisma.main.clientPO.findFirst({
        where: { OR: [{ fileId: id }, { soFileId: id }, { paymentProofFileId: id }] },
        select: { id: true },
      }),
      // 11. Faktur Masuk (InvoiceIn)
      this.prisma.main.invoiceIn.findFirst({
        where: { OR: [{ fileId: id }, { transferFileId: id }] },
        select: { id: true },
      }),
      // 12. Penawaran & Versi Penawaran (Quotation & QuotationVersion)
      this.prisma.main.quotation.findFirst({
        where: { latestFileId: id },
        select: { id: true },
      }),
      this.prisma.main.quotationVersion.findFirst({
        where: { fileId: id },
        select: { id: true },
      }),
      // 13. Penerimaan Barang (Receiving)
      this.prisma.main.receiving.findFirst({
        where: { OR: [{ receiptFileId: id }, { photoFileId: id }] },
        select: { id: true },
      }),
      // 14. Laporan Kendala & Kerusakan (IssueReport & DamageReport)
      this.prisma.main.issueReport.findFirst({ where: { fileId: id }, select: { id: true } }),
      this.prisma.main.damageReport.findFirst({ where: { fileId: id }, select: { id: true } }),
      // 15. POC & Visit Reports
      this.prisma.main.pocReport.findFirst({
        where: { OR: [{ logoFileId: id }, { documentFileId: id }] },
        select: { id: true },
      }),
      this.prisma.main.visitReport.findFirst({
        where: { OR: [{ logoFileId: id }, { documentFileId: id }] },
        select: { id: true },
      }),
      // 16. Pengaturan Profil Perusahaan (SystemSetting)
      this.prisma.main.systemSetting.findFirst({
        where: {
          key: { in: ["company.profile", "company.logo"] },
          value: { contains: idStr },
        },
        select: { key: true },
      }),
      // 17. Foto Absensi (Attendance)
      (this.prisma.main as any).attendance.findFirst({
        where: { OR: [{ checkInPhotoFileId: id }, { checkOutPhotoFileId: id }] },
        select: { id: true },
      }),
    ]);

    return checks.some((c) => Boolean(c));
  }

  async getOwnerId(id: number): Promise<number | null | undefined> {
    const row = await this.prisma.main.file.findUnique({
      where: { id },
      select: { uploadedById: true },
    });
    if (!row) return undefined;
    return row.uploadedById;
  }

  async safeRemove(id: number) {
    if (!id || typeof id !== "number" || isNaN(id)) return { ok: false, reason: "invalid_id" };
    const row = await this.prisma.main.file.findUnique({ where: { id } });
    if (!row) return { ok: true, reason: "already_deleted" };

    const inUse = await this.isFileReferenced(id);
    if (inUse) {
      return { ok: false, reason: "in_use", message: "File masih digunakan oleh dokumen lain" };
    }

    return this.remove(id);
  }

  async remove(id: number) {
    const row = await this.prisma.main.file.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("File tidak ditemukan");
    try {
      const abs = normalize(join(this.root, row.path));
      if (existsSync(abs)) await unlink(abs);
    } catch {}
    await this.prisma.main.file.delete({ where: { id } });
    return { ok: true };
  }
}
